"""Make a small synthetic pixel-art set (coloured shapes with captions) to test the
whole pipeline without downloading anything. Images are saved 4x enlarged on purpose,
so prepare.py's "undo upscaling" step is tested too.

    python make_demo_data.py demo_png 6000
"""
import os
import random
import sys

import numpy as np
from PIL import Image

COLOURS = {"red": (220, 40, 40), "green": (40, 180, 70), "blue": (50, 90, 220), "yellow": (240, 210, 40),
           "purple": (150, 60, 190), "orange": (240, 130, 30), "pink": (240, 120, 180), "white": (240, 240, 240)}


def shape_mask(kind, s, r):
    y, x = np.mgrid[0:s, 0:s] + 0.5
    cx = cy = s / 2
    if kind == "circle":
        return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
    if kind == "square":
        return (abs(x - cx) <= r) & (abs(y - cy) <= r)
    if kind == "diamond":
        return abs(x - cx) + abs(y - cy) <= r
    if kind == "cross":
        return ((abs(x - cx) <= r / 3) & (abs(y - cy) <= r)) | ((abs(y - cy) <= r / 3) & (abs(x - cx) <= r))
    if kind == "heart":
        u, v = (x - cx) / r, (cy - y) / r + 0.2
        return (u * u + v * v - 1) ** 3 - u * u * v ** 3 <= 0
    if kind == "triangle":
        return (y >= cy - r) & (y <= cy + r) & (abs(x - cx) <= (y - (cy - r)) / 2)
    raise ValueError(kind)


def make(kind, colour, size_word, s=16):
    r = {"small": 3.5, "big": 6.5}[size_word]
    m = shape_mask(kind, s, r)
    img = np.zeros((s, s, 4), np.uint8)
    base = np.array(COLOURS[colour])
    img[m, :3] = base
    img[m, 3] = 255
    # dark outline and a highlight, like real sprites
    pad = np.pad(m, 1)
    edge = ~m & (pad[:-2, 1:-1] | pad[2:, 1:-1] | pad[1:-1, :-2] | pad[1:-1, 2:])
    img[edge] = (*(base // 4), 255)
    ys, xs = np.nonzero(m)
    if len(ys):
        hy, hx = ys.min() + 1, xs[ys == ys.min()].min() + 1
        if 0 <= hy < s and 0 <= hx < s and m[hy, hx]:
            img[hy, hx, :3] = np.minimum(base + 70, 255)
    return img


def main():
    out, n = sys.argv[1], int(sys.argv[2])
    os.makedirs(out, exist_ok=True)
    kinds = ["circle", "square", "diamond", "cross", "heart", "triangle"]
    rnd = random.Random(0)
    for i in range(n):
        k, c, z = rnd.choice(kinds), rnd.choice(list(COLOURS)), rnd.choice(["small", "big"])
        img = make(k, c, z)
        dx, dy = rnd.randint(-2, 2), rnd.randint(-2, 2)
        img = np.roll(img, (dy, dx), (0, 1))
        Image.fromarray(img).resize((64, 64), Image.NEAREST).save(os.path.join(out, f"{i:05d}.png"))
        open(os.path.join(out, f"{i:05d}.txt"), "w").write(f"{z} {c} {k}")


if __name__ == "__main__":
    main()
