"""Build AI pixel model: a small decoder-only transformer.

One sequence per image:  [text tokens (TEXT_LEN, padded)] [BOS] [pixel tokens (SIZE*SIZE - 1)]
Every pixel token is an index into a shared palette (PALETTE colours) or TRANSPARENT.
The model predicts each pixel from the text and the pixels before it (row by row),
so output is always exact pixel art - no blur, no cleanup.

The forward pass here is mirrored line by line in web/engine.js (the phone engine);
keep both in sync.
"""
import math
from dataclasses import dataclass, asdict

import torch
import torch.nn as nn
import torch.nn.functional as F


@dataclass
class Config:
    size: int = 16            # image side in pixels
    palette: int = 255        # palette colours; token `palette` = transparent
    text_vocab: int = 4096    # word vocabulary (0 = pad, 1 = unknown)
    text_len: int = 24        # max words per prompt
    dim: int = 256
    layers: int = 6
    heads: int = 8

    @property
    def pix_vocab(self):      # colours + transparent + BOS
        return self.palette + 2

    @property
    def transparent(self):
        return self.palette

    @property
    def bos(self):
        return self.palette + 1

    @property
    def seq_len(self):  # text + BOS + all pixels but the last (it is only predicted)
        return self.text_len + self.size * self.size

    def to_dict(self):
        return asdict(self)


class Block(nn.Module):
    def __init__(self, c: Config):
        super().__init__()
        self.heads = c.heads
        self.ln1 = nn.LayerNorm(c.dim)
        self.qkv = nn.Linear(c.dim, 3 * c.dim)
        self.proj = nn.Linear(c.dim, c.dim)
        self.ln2 = nn.LayerNorm(c.dim)
        self.fc1 = nn.Linear(c.dim, 4 * c.dim)
        self.fc2 = nn.Linear(4 * c.dim, c.dim)

    def forward(self, x, mask):
        B, T, D = x.shape
        q, k, v = self.qkv(self.ln1(x)).split(D, dim=2)
        q, k, v = (t.view(B, T, self.heads, D // self.heads).transpose(1, 2) for t in (q, k, v))
        a = F.scaled_dot_product_attention(q, k, v, attn_mask=mask)
        x = x + self.proj(a.transpose(1, 2).reshape(B, T, D))
        return x + self.fc2(F.gelu(self.fc1(self.ln2(x)), approximate="tanh"))


class PixelModel(nn.Module):
    def __init__(self, c: Config):
        super().__init__()
        self.c = c
        self.text_emb = nn.Embedding(c.text_vocab, c.dim)
        self.pix_emb = nn.Embedding(c.pix_vocab, c.dim)
        self.pos = nn.Parameter(torch.zeros(c.seq_len, c.dim))
        self.blocks = nn.ModuleList(Block(c) for _ in range(c.layers))
        self.ln_f = nn.LayerNorm(c.dim)
        self.head = nn.Linear(c.dim, c.palette + 1)  # colours + transparent
        nn.init.normal_(self.pos, std=0.02)
        self.apply(self._init)

    @staticmethod
    def _init(m):
        if isinstance(m, (nn.Linear, nn.Embedding)):
            nn.init.normal_(m.weight, std=0.02)
            if getattr(m, "bias", None) is not None:
                nn.init.zeros_(m.bias)

    def mask(self, text, device):
        """Causal mask, plus padding words are never looked at.

        Returns a bool mask (B, 1, T, T): True = may attend.
        """
        T = self.c.seq_len
        causal = torch.ones(T, T, dtype=torch.bool, device=device).tril()
        keep = torch.ones(text.shape[0], T, dtype=torch.bool, device=device)
        keep[:, : self.c.text_len] = text != 0
        m = causal[None] & keep[:, None, :]
        m |= torch.eye(T, dtype=torch.bool, device=device)[None]  # a pad position still sees itself
        return m[:, None]

    def forward(self, text, pixels):
        """text: (B, text_len) word ids; pixels: (B, size*size) palette ids.

        Returns logits (B, size*size, palette+1) for every pixel.
        """
        c = self.c
        B = text.shape[0]
        bos = torch.full((B, 1), c.bos, dtype=pixels.dtype, device=pixels.device)
        x = torch.cat([self.text_emb(text), self.pix_emb(torch.cat([bos, pixels[:, :-1]], 1))], 1)
        x = x + self.pos
        m = self.mask(text, x.device)
        for b in self.blocks:
            x = b(x, m)
        return self.head(self.ln_f(x[:, c.text_len :]))

    @torch.no_grad()
    def generate(self, text, temperature=0.7, top_k=10, guidance=2.0, generator=None):
        """Slow reference sampler (full recompute each step). The phone uses a KV cache."""
        c = self.c
        B = text.shape[0]
        N = c.size * c.size
        pix = torch.zeros(B, N, dtype=torch.long, device=text.device)
        empty = torch.zeros_like(text)
        for i in range(N):
            logits = self(text, pix)[:, i]
            if guidance != 1.0:
                u = self(empty, pix)[:, i]
                logits = u + guidance * (logits - u)
            logits = logits / max(temperature, 1e-5)
            if top_k:
                v, _ = logits.topk(top_k, -1)
                logits[logits < v[:, -1:]] = -float("inf")
            pix[:, i] = torch.multinomial(F.softmax(logits, -1), 1, generator=generator)[:, 0]
        return pix


def count_params(m):
    return sum(p.numel() for p in m.parameters())
