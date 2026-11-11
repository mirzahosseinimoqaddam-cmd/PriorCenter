"""Train the Build AI pixel model.

    python train.py --data data16 --out run16 --steps 60000          # GPU (Kaggle/Colab)
    python train.py --data demo16 --out demo --steps 1500 --dim 128 --layers 4   # CPU smoke test

Saves run/ckpt.pt (resumes automatically if it exists) and run/samples.png now and then.
"""
import argparse
import json
import math
import os
import re
import time
from collections import Counter

import numpy as np
import torch
import torch.nn.functional as F

from model import Config, PixelModel, count_params


def build_vocab(caps, size, min_count=2):
    cnt = Counter(w for c in caps for w in re.findall(r"[a-z0-9]+", c))
    words = [w for w, n in cnt.most_common(size - 2) if n >= min_count]
    return ["<pad>", "<unk>"] + words


def encode(caption, index, text_len):
    ids = [index.get(w, 1) for w in re.findall(r"[a-z0-9]+", caption.lower())][:text_len]
    return ids + [0] * (text_len - len(ids))


def save_grid(model, vocab, palette, prompts, path, device, seed=0):
    from PIL import Image

    c = model.c
    index = {w: i for i, w in enumerate(vocab)}
    text = torch.tensor([encode(p, index, c.text_len) for p in prompts], device=device)
    model.eval()
    g = torch.Generator(device=device).manual_seed(seed)
    pix = model.generate(text, generator=g).cpu().numpy()
    model.train()
    pal = np.zeros((256, 3), np.uint8)
    pal[: len(palette)] = palette
    s, k = c.size, 8
    sheet = np.full(((s * k + 2) * 1, (s * k + 2) * len(prompts), 3), 40, np.uint8)
    for j, p in enumerate(pix):
        rgb = pal[p].reshape(s, s, 3)
        rgb[p.reshape(s, s) == c.transparent] = (40, 40, 40)
        sheet[1 : 1 + s * k, j * (s * k + 2) + 1 : j * (s * k + 2) + 1 + s * k] = rgb.repeat(k, 0).repeat(k, 1)
    Image.fromarray(sheet).save(path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--steps", type=int, default=60000)
    ap.add_argument("--batch", type=int, default=256)
    ap.add_argument("--lr", type=float, default=6e-4)
    ap.add_argument("--dim", type=int, default=256)
    ap.add_argument("--layers", type=int, default=6)
    ap.add_argument("--heads", type=int, default=8)
    ap.add_argument("--text-vocab", type=int, default=4096)
    ap.add_argument("--drop-caption", type=float, default=0.1, help="for classifier-free guidance")
    ap.add_argument("--prompts", default="red potion,green slime,sword,heart,tree,skull,coin,cat")
    ap.add_argument("--every", type=int, default=2000)
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    dev = "cuda" if torch.cuda.is_available() else "cpu"
    tokens = torch.from_numpy(np.load(os.path.join(args.data, "tokens.npy")).astype(np.int64))
    caps = json.load(open(os.path.join(args.data, "captions.json")))
    palette = json.load(open(os.path.join(args.data, "palette.json")))
    info = json.load(open(os.path.join(args.data, "stats.json")))
    ck_path = os.path.join(args.out, "ckpt.pt")
    ck = torch.load(ck_path, map_location="cpu") if os.path.exists(ck_path) else None

    if ck:
        cfg, vocab = Config(**ck["config"]), ck["vocab"]
    else:
        vocab = build_vocab(caps, args.text_vocab)
        cfg = Config(size=info["size"], palette=info["transparent"], text_vocab=len(vocab),
                     dim=args.dim, layers=args.layers, heads=args.heads)
    index = {w: i for i, w in enumerate(vocab)}
    text = torch.tensor([encode(c, index, cfg.text_len) for c in caps])
    print(f"{len(tokens)} images, {len(vocab)} words, device {dev}")

    model = PixelModel(cfg).to(dev)
    print(f"model: {count_params(model) / 1e6:.2f}M parameters")
    decay = [p for n, p in model.named_parameters() if p.dim() == 2 and "pos" not in n]
    other = [p for n, p in model.named_parameters() if not (p.dim() == 2 and "pos" not in n)]
    opt = torch.optim.AdamW([{"params": decay, "weight_decay": 0.1}, {"params": other, "weight_decay": 0}],
                            lr=args.lr, betas=(0.9, 0.95), fused=dev == "cuda")
    step = 0
    if ck:
        model.load_state_dict(ck["model"])
        opt.load_state_dict(ck["opt"])
        step = ck["step"]
        print(f"resumed at step {step}")

    use_amp = dev == "cuda"
    amp_dtype = torch.bfloat16 if use_amp and torch.cuda.is_bf16_supported() else torch.float16
    scaler = torch.amp.GradScaler(enabled=use_amp and amp_dtype == torch.float16)
    s = cfg.size
    warm = max(1, min(1000, args.steps // 10))
    t0, avg = time.time(), None
    model.train()
    while step < args.steps:
        idx = torch.randint(0, len(tokens), (args.batch,))
        pix, txt = tokens[idx].clone(), text[idx].clone()
        # mirror half the images; pixel art reads the same both ways
        flip = torch.rand(args.batch) < 0.5
        pix[flip] = pix[flip].view(-1, s, s).flip(-1).reshape(-1, s * s)
        # drop single words now and then, and whole captions for guidance
        txt[torch.rand(txt.shape) < 0.1] = 0
        txt[torch.rand(args.batch) < args.drop_caption] = 0
        # keep words packed at the front after dropping
        txt = torch.stack([torch.cat([r[r != 0], r[r == 0]]) for r in txt])
        pix, txt = pix.to(dev, non_blocking=True), txt.to(dev, non_blocking=True)

        lr = args.lr * min(1, (step + 1) / warm) * (0.1 + 0.9 * 0.5 * (1 + math.cos(math.pi * step / args.steps)))
        for g in opt.param_groups:
            g["lr"] = lr
        with torch.autocast(dev, dtype=amp_dtype, enabled=use_amp):
            logits = model(txt, pix)
            loss = F.cross_entropy(logits.float().reshape(-1, logits.shape[-1]), pix.reshape(-1))
        opt.zero_grad(set_to_none=True)
        scaler.scale(loss).backward()
        scaler.unscale_(opt)
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        scaler.step(opt)
        scaler.update()
        step += 1
        avg = loss.item() if avg is None else 0.98 * avg + 0.02 * loss.item()
        if step % 100 == 0:
            print(f"step {step}/{args.steps}  loss {avg:.3f}  lr {lr:.2e}  {time.time() - t0:.0f}s", flush=True)
        if step % args.every == 0 or step == args.steps:
            torch.save({"model": model.state_dict(), "opt": opt.state_dict(), "step": step,
                        "config": cfg.to_dict(), "vocab": vocab, "palette": palette}, ck_path)
            save_grid(model, vocab, palette, args.prompts.split(","), os.path.join(args.out, f"samples_{step}.png"), dev)
            print(f"saved {ck_path}", flush=True)


if __name__ == "__main__":
    main()
