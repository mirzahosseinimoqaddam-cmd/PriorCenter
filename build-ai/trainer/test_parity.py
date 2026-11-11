"""Check that the phone engine (web/engine.js) computes the same thing as PyTorch.

    python test_parity.py model.bin

Loads model.bin both ways, feeds the same prompt and pixels, and compares every
pixel's logits. Needs `node` on PATH.
"""
import json
import os
import subprocess
import sys
import tempfile

import numpy as np
import torch

from export import load_bin
from model import Config, PixelModel

ENGINE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "web", "engine.js")

NODE = r"""
const E = require(process.argv[2]);
const fs = require('fs');
const buf = fs.readFileSync(process.argv[3]);
const m = E.loadModel(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length));
const ref = JSON.parse(fs.readFileSync(process.argv[4]));
const out = ref.cases.map(c => E.allLogits(m, c.ids, c.pixels).map(a => Array.from(a)));
fs.writeFileSync(process.argv[5], JSON.stringify(out));
"""


def main():
    path = sys.argv[1]
    header, w = load_bin(path)
    cfg = Config(**header["config"])
    model = PixelModel(cfg).eval()
    model.load_state_dict({k: torch.from_numpy(v) for k, v in w.items()})
    rng = np.random.default_rng(0)
    N = cfg.size * cfg.size
    cases = []
    for n_words in (3, 0, cfg.text_len):  # normal prompt, empty prompt, full prompt
        ids = [int(rng.integers(2, cfg.text_vocab)) for _ in range(n_words)] + [0] * (cfg.text_len - n_words)
        pixels = rng.integers(0, cfg.palette + 1, N).tolist()
        cases.append({"ids": ids, "pixels": pixels})
    with torch.no_grad():
        ref = [model(torch.tensor([c["ids"]]), torch.tensor([c["pixels"]]))[0].numpy() for c in cases]
    with tempfile.TemporaryDirectory() as d:
        rp, op, js = (os.path.join(d, f) for f in ("ref.json", "out.json", "run.js"))
        json.dump({"cases": cases}, open(rp, "w"))
        open(js, "w").write(NODE)
        subprocess.run(["node", js, os.path.abspath(ENGINE), os.path.abspath(path), rp, op], check=True)
        got = [np.array(x, np.float32) for x in json.load(open(op))]
    worst = 0.0
    for r, g in zip(ref, got):
        assert r.shape == g.shape, (r.shape, g.shape)
        worst = max(worst, float(np.abs(r - g).max()))
    agree = np.mean([(r.argmax(-1) == g.argmax(-1)).mean() for r, g in zip(ref, got)])
    print(f"max logit difference {worst:.2e}, same top colour {agree * 100:.1f}% of pixels")
    if worst > 1e-3:
        raise SystemExit("FAIL: engine.js does not match the PyTorch model")
    print("PASS")


if __name__ == "__main__":
    main()
