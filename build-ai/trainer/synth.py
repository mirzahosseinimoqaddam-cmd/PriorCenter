"""Draw extra training sprites with a ready pixel-art AI (needs a GPU, e.g. Kaggle T4).

Uses Pixel Art XL (nerijs/pixel-art-xl, a LoRA for SDXL) with the LCM LoRA, as its model
card recommends: 8 steps, guidance 1.5, LoRA strength 1.2, fixed fp16 VAE. Every concept
in concepts.txt is drawn several times on a white background. The background is removed,
the sprite is cropped and shrunk to fit 16x16, and saved with its caption, ready for
prepare.py --folder.

    python synth.py --out synth_png --per 8
"""
import argparse
import os
import re

import numpy as np
import torch
from PIL import Image

from import_npy_sprites import remove_background
from prepare import is_halal

NEG = "3d render, realistic, photo, text, watermark, multiple objects, scene, landscape, frame, border, blurry"


def shrink(rgba, size):
    """Crop to the sprite and shrink it to fit size x size (area average, then hard alpha)."""
    ys, xs = np.nonzero(rgba[..., 3])
    if len(ys) < 16:
        return None
    a = rgba[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1]
    h, w = a.shape[:2]
    if max(h, w) > 3 * min(h, w):
        return None
    k = max(h, w) / size
    im = Image.fromarray(a, "RGBA").convert("RGBa").resize((max(1, round(w / k)), max(1, round(h / k))), Image.BOX).convert("RGBA")
    out = np.asarray(im).copy()
    out[out[..., 3] < 128] = 0
    out[..., 3] = np.where(out[..., 3] > 0, 255, 0)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--concepts", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "concepts.txt"))
    ap.add_argument("--per", type=int, default=8, help="pictures per concept")
    ap.add_argument("--batch", type=int, default=4)
    ap.add_argument("--size", type=int, default=16)
    args = ap.parse_args()

    from diffusers import AutoencoderKL, DiffusionPipeline, LCMScheduler

    concepts = [l.strip() for l in open(args.concepts, encoding="utf-8") if l.strip() and not l.startswith("#")]
    concepts = [c for c in concepts if is_halal(c)]
    vae = AutoencoderKL.from_pretrained("madebyollin/sdxl-vae-fp16-fix", torch_dtype=torch.float16)
    pipe = DiffusionPipeline.from_pretrained("stabilityai/stable-diffusion-xl-base-1.0", vae=vae,
                                             torch_dtype=torch.float16, variant="fp16").to("cuda")
    pipe.scheduler = LCMScheduler.from_config(pipe.scheduler.config)
    pipe.load_lora_weights("latent-consistency/lcm-lora-sdxl", adapter_name="lcm")
    pipe.load_lora_weights("nerijs/pixel-art-xl", weight_name="pixel-art-xl.safetensors", adapter_name="pixel")
    pipe.set_adapters(["lcm", "pixel"], adapter_weights=[1.0, 1.2])
    pipe.set_progress_bar_config(disable=True)

    os.makedirs(args.out, exist_ok=True)
    kept = 0
    for ci, concept in enumerate(concepts):
        prompt = f"pixel, {concept}, single game item sprite, centered, plain white background"
        slug = re.sub(r"[^a-z0-9]+", "_", concept.lower())
        for start in range(0, args.per, args.batch):
            n = min(args.batch, args.per - start)
            g = torch.Generator("cuda").manual_seed(ci * 1000 + start)
            ims = pipe([prompt] * n, negative_prompt=[NEG] * n, num_inference_steps=8, guidance_scale=1.5, generator=g).images
            for j, im in enumerate(ims):
                # the LoRA draws on an 8x grid: nearest-neighbour down 8x gives the real pixels
                small = np.asarray(im.convert("RGB").resize((im.width // 8, im.height // 8), Image.NEAREST))
                sprite = shrink(remove_background(small, near_white=215), args.size)
                if sprite is None:
                    continue
                name = f"{slug}_{start + j:02d}"
                Image.fromarray(sprite, "RGBA").save(os.path.join(args.out, name + ".png"))
                open(os.path.join(args.out, name + ".txt"), "w").write(concept)
                kept += 1
        print(f"{ci + 1}/{len(concepts)} {concept}: {kept} sprites so far", flush=True)


if __name__ == "__main__":
    main()
