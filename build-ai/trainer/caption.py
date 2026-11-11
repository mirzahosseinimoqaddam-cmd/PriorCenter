"""Write captions for prepared images that have none (or all, with --all), using a small
open image-captioning model on a GPU.

    python caption.py --data data16            # fill empty captions
    python caption.py --data data16 --all      # recaption everything

Pixel art is enlarged with nearest-neighbour to 256x256 on a grey background first,
because captioning models were trained on normal-size photos.
"""
import argparse
import json
import os

import numpy as np
import torch
from PIL import Image

PREFIX = "pixel art of"


def render(tok, palette, size, transparent, scale=16):
    pal = np.concatenate([np.array(palette, np.uint8), np.zeros((256 - len(palette), 3), np.uint8)])
    rgb = pal[tok].reshape(size, size, 3)
    rgb[tok.reshape(size, size) == transparent] = 128
    return Image.fromarray(rgb).resize((size * scale, size * scale), Image.NEAREST)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True)
    ap.add_argument("--model", default="Salesforce/blip-image-captioning-large")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--batch", type=int, default=128)
    args = ap.parse_args()

    from transformers import BlipForConditionalGeneration, BlipProcessor

    tokens = np.load(os.path.join(args.data, "tokens.npy"))
    caps = json.load(open(os.path.join(args.data, "captions.json")))
    pal = json.load(open(os.path.join(args.data, "palette.json")))
    info = json.load(open(os.path.join(args.data, "stats.json")))
    size, transparent = info["size"], info["transparent"]

    todo = [i for i, c in enumerate(caps) if args.all or not c]
    print(f"captioning {len(todo)} of {len(caps)} images")
    dev = "cuda" if torch.cuda.is_available() else "cpu"
    proc = BlipProcessor.from_pretrained(args.model)
    model = BlipForConditionalGeneration.from_pretrained(args.model, torch_dtype=torch.float16 if dev == "cuda" else torch.float32).to(dev).eval()

    for s in range(0, len(todo), args.batch):
        idx = todo[s : s + args.batch]
        ims = [render(tokens[i], pal, size, transparent) for i in idx]
        inp = proc(images=ims, text=[PREFIX] * len(ims), return_tensors="pt").to(dev, model.dtype)
        with torch.no_grad():
            out = model.generate(**inp, max_new_tokens=24)
        for i, t in zip(idx, proc.batch_decode(out, skip_special_tokens=True)):
            t = t.lower().replace(PREFIX, "").strip()
            caps[i] = f"{caps[i]}, {t}" if caps[i] and args.all else t
        if (s // args.batch) % 50 == 0:
            print(f"{s + len(idx)}/{len(todo)}  e.g. {caps[idx[0]]!r}", flush=True)
            json.dump(caps, open(os.path.join(args.data, "captions.json"), "w"))
    json.dump(caps, open(os.path.join(args.data, "captions.json"), "w"))
    print("done")


if __name__ == "__main__":
    main()
