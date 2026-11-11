"""Turn the open 16x16 sprite set from the DeepLearning.AI diffusion course
(sprites_1788_16x16.npy + sprite_labels_nc_1788_16x16.npy, 89,400 sprites) into a folder
of transparent PNGs with captions, so prepare.py --folder can read it.

    python import_npy_sprites.py sprites_1788_16x16.npy sprite_labels_nc_1788_16x16.npy out_dir
"""
import os
import sys
from collections import deque

import numpy as np
from PIL import Image

LABELS = ["hero character front view", "monster creature", "food", "magic item", "hero character side view"]


def remove_background(rgb, near_white=225):
    """Flood-fill the near-white background from the border and make it transparent."""
    h, w, _ = rgb.shape
    bg = (rgb >= near_white).all(-1)
    seen = np.zeros((h, w), bool)
    q = deque((y, x) for y in range(h) for x in (0, w - 1)) + deque((y, x) for x in range(w) for y in (0, h - 1))
    while q:
        y, x = q.popleft()
        if 0 <= y < h and 0 <= x < w and bg[y, x] and not seen[y, x]:
            seen[y, x] = True
            q.extend(((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)))
    out = np.dstack([rgb, np.where(seen, 0, 255).astype(np.uint8)])
    out[seen] = 0
    return out


def main():
    x = np.load(sys.argv[1])
    y = np.load(sys.argv[2]).argmax(1)
    out = sys.argv[3]
    os.makedirs(out, exist_ok=True)
    kept = 0
    for i, (img, lab) in enumerate(zip(x, y)):
        rgba = remove_background(img)
        opaque = rgba[..., 3] > 0
        if opaque.sum() < 8 or len(np.unique(rgba[opaque][:, :3], axis=0)) > 48:
            continue  # copies with added noise
        Image.fromarray(rgba, "RGBA").save(os.path.join(out, f"s{i:05d}.png"))
        open(os.path.join(out, f"s{i:05d}.txt"), "w").write(LABELS[lab])
        kept += 1
    print(f"kept {kept} of {len(x)}")


if __name__ == "__main__":
    main()
