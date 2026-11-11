"""Pack a trained checkpoint into model.bin for the Build AI app.

    python export.py --ckpt run16/ckpt.pt --out model.bin

Layout (little endian):
    "BAI1" | uint32 header length | header JSON (utf-8) | padding to 4 bytes | tensor data
Every 2-D weight is int8 with one float32 scale per row (about 4x smaller than float32);
1-D weights (biases, norms) stay float32. The phone turns everything back into float32 once
on load. load_bin() below does the same, so tests can compare the phone engine against it.
"""
import argparse
import json
import struct

import numpy as np
import torch

MAGIC = b"BAI1"


def quantize_rows(w):
    scale = np.abs(w).max(axis=1) / 127.0
    scale[scale == 0] = 1.0
    q = np.clip(np.rint(w / scale[:, None]), -127, 127).astype(np.int8)
    return q, scale.astype(np.float32)


def export(ckpt, out, name="Build AI pixel 16", aliases=None):
    sd = {k: v.float().numpy() for k, v in ckpt["model"].items()}
    tensors, blobs, off = [], [], 0

    def add(arr):
        nonlocal off
        b = arr.tobytes()
        pad = (-len(b)) % 4
        blobs.append(b + b"\0" * pad)
        start = off
        off += len(b) + pad
        return start

    for k, w in sd.items():
        if w.ndim == 2:
            q, sc = quantize_rows(w)
            tensors.append({"name": k, "shape": list(w.shape), "dtype": "q8", "data": add(q), "scale": add(sc)})
        else:
            tensors.append({"name": k, "shape": list(w.shape), "dtype": "f32", "data": add(w.astype(np.float32))})
    palette = ckpt["palette"]
    header = {"format": 1, "name": name, "config": ckpt["config"], "vocab": ckpt["vocab"],
              "palette": palette, "tensors": tensors, "step": ckpt.get("step", 0), "aliases": aliases or {}}
    hb = json.dumps(header, separators=(",", ":")).encode()
    hb += b" " * ((-(8 + len(hb))) % 4)
    with open(out, "wb") as f:
        f.write(MAGIC + struct.pack("<I", len(hb)) + hb + b"".join(blobs))
    return out


def load_bin(path):
    """Read model.bin back -> (header, {name: float32 array}). Mirrors engine.js loadModel."""
    raw = open(path, "rb").read()
    assert raw[:4] == MAGIC, "not a Build AI model"
    n = struct.unpack("<I", raw[4:8])[0]
    header = json.loads(raw[8 : 8 + n])
    base = 8 + n
    out = {}
    for t in header["tensors"]:
        size = int(np.prod(t["shape"]))
        if t["dtype"] == "q8":
            q = np.frombuffer(raw, np.int8, size, base + t["data"]).reshape(t["shape"]).astype(np.float32)
            sc = np.frombuffer(raw, np.float32, t["shape"][0], base + t["scale"])
            out[t["name"]] = q * sc[:, None]
        else:
            out[t["name"]] = np.frombuffer(raw, np.float32, size, base + t["data"]).reshape(t["shape"]).copy()
    return header, out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ckpt", required=True)
    ap.add_argument("--out", default="model.bin")
    ap.add_argument("--name", default="Build AI pixel 16")
    ap.add_argument("--aliases", help="aliases.json from make_aliases.py (synonyms and Persian words)")
    args = ap.parse_args()
    ck = torch.load(args.ckpt, map_location="cpu")
    export(ck, args.out, args.name, json.load(open(args.aliases, encoding="utf-8")) if args.aliases else None)
    import os
    print(f"wrote {args.out} ({os.path.getsize(args.out) / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
