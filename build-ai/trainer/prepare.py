"""Turn pixel-art collections into Build AI training data.

    python prepare.py --out data16 --size 16 --hf Angais/pixel-art-atlas-1.4m
    python prepare.py --out data16 --size 16 --folder my_sprites/   # captions from .txt or file name

Writes to --out:
    tokens.npy    uint8 (N, size*size) palette index per pixel (palette size = transparent)
    captions.json list of N cleaned captions
    palette.json  list of [r, g, b]
    stats.json    what was kept / skipped and why
"""
import argparse
import hashlib
import io
import json
import math
import os
import re
from collections import Counter
from functools import reduce

import numpy as np
from PIL import Image

TEXT_KEYS = ["text", "caption", "prompt", "description", "label", "labels", "tags", "name", "title", "category"]


# ---------- pixel grid ----------

def _scale(diff_any):
    """Largest block size that all colour changes along one axis line up with."""
    edges = np.nonzero(diff_any)[0] + 1
    n = len(diff_any) + 1
    return reduce(math.gcd, edges.tolist(), n) if len(edges) else n


def to_grid(img: Image.Image, size: int, fit: bool = True):
    """Undo nearest-neighbour upscaling, crop empty borders, then fit into size x size.

    With fit, art up to 6x too big is shrunk (area average, then hard alpha).
    Returns uint8 RGBA (size, size, 4) or None if it is not usable at this size.
    """
    a = np.asarray(img.convert("RGBA"), dtype=np.uint8).copy()
    a[a[..., 3] < 128] = 0          # one transparent colour
    a[..., 3] = np.where(a[..., 3] > 0, 255, 0)
    h, w = a.shape[:2]
    if h < 2 or w < 2:
        return None
    sx = _scale((a[:, 1:] != a[:, :-1]).any(axis=(0, 2)))
    sy = _scale((a[1:] != a[:-1]).any(axis=(1, 2)))
    a = a[sy // 2 :: sy, sx // 2 :: sx]
    ys, xs = np.nonzero(a[..., 3])
    if len(ys) < 4:
        return None
    a = a[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1]
    h, w = a.shape[:2]
    if max(h, w) > 3 * min(h, w) and max(h, w) > size:
        return None  # long bars and strips do not shrink into a sprite
    if h > size or w > size:
        k = max(h, w) / size
        if not fit or k > 6:
            return None
        nh, nw = max(1, round(h / k)), max(1, round(w / k))
        im = Image.fromarray(a, "RGBA")
        im = im.convert("RGBa").resize((nw, nh), Image.BOX).convert("RGBA")  # premultiplied, so no dark halos
        a = np.asarray(im).copy()
        a[a[..., 3] < 128] = 0
        a[..., 3] = np.where(a[..., 3] > 0, 255, 0)
        h, w = a.shape[:2]
    out = np.zeros((size, size, 4), np.uint8)
    y, x = (size - h) // 2, (size - w) // 2
    out[y : y + h, x : x + w] = a
    opaque = out[..., 3] > 0
    if opaque.sum() < 4:
        return None
    if len(np.unique(out[opaque][:, :3], axis=0)) < 2:
        return None
    return out


COLOUR_WORDS = {"red", "orange", "yellow", "green", "cyan", "blue", "purple", "pink", "brown", "black", "white", "gray", "grey", "gold", "silver"}


def main_colour(rgba):
    """Name of the most common colour family among opaque pixels."""
    px = rgba[rgba[..., 3] > 0][:, :3].astype(np.float32) / 255
    mx, mn = px.max(1), px.min(1)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    r, g, b = px.T
    d = np.maximum(mx - mn, 1e-6)
    hue = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    names = np.empty(len(px), object)
    grey = sat < 0.2
    names[grey & (mx < 0.25)] = "black"
    names[grey & (mx >= 0.25) & (mx < 0.8)] = "gray"
    names[grey & (mx >= 0.8)] = "white"
    c = ~grey
    bins = [(15, "red"), (40, "orange"), (70, "yellow"), (165, "green"), (195, "cyan"), (255, "blue"), (290, "purple"), (335, "pink"), (361, "red")]
    for lo_hi in range(len(bins)):
        lo = bins[lo_hi - 1][0] if lo_hi else -1
        hi, name = bins[lo_hi]
        names[c & (hue > lo) & (hue <= hi)] = name
    names[c & (hue > 15) & (hue <= 45) & (mx < 0.6)] = "brown"
    # ignore outline-dark pixels when there is real colour
    vals, counts = np.unique(names[(names != "black") | (np.mean(names == "black") > 0.6)].astype(str), return_counts=True)
    return vals[counts.argmax()] if len(vals) else "black"


def with_colour(caption, rgba):
    if COLOUR_WORDS & set(re.findall(r"[a-z]+", caption)):
        return caption
    return f"{main_colour(rgba)} {caption}".strip()


# ---------- captions ----------

def clean_caption(t):
    if isinstance(t, (list, tuple)):
        t = ", ".join(map(str, t))
    t = str(t).lower().replace("_", " ").replace("-", " ")
    t = re.sub(r"\.(png|gif|bmp|jpg|jpeg|webp)$", "", t)
    t = re.sub(r"[^a-z0-9 ,]+", " ", t)
    t = re.sub(r"(?<=[a-z])(16|24|32|48|64)\b|\bv\d+\b|\b\d+x\d+\b", " ", t)  # icon names: apple32-v2, coin_16x16
    return re.sub(r"\s+", " ", t).strip(" ,")


# Images whose caption has any of these words are left out of training (halal filter).
# Add words here; matching is per whole word.
NOT_HALAL = set("""
alcohol beer beers wine wines vodka whisky whiskey liquor cocktail champagne brandy martini booze tequila gin rum
sake tumbler clinking cork
pork bacon ham pig pigs swine boar
casino gamble gambling poker roulette lottery jackpot bet betting blackjack slot
nude naked sexy sex nsfw porn lingerie bikini erotic boobs breasts underwear kiss kissing middle
cigarette cigarettes cigar smoking weed marijuana cannabis cocaine heroin drug drugs bong
idol idols moai
""".split())


def is_halal(caption):
    return not NOT_HALAL & set(re.findall(r"[a-z0-9]+", caption.lower()))


def words(t):
    return re.findall(r"[a-z0-9]+", t)


# ---------- sources ----------

SKIP_FILES = re.compile(r"sheet|preview|header|screenshot|sample|tileset|atlas|thumbnail|banner|logo|readme|license", re.I)
GENERIC = set("png sprites sprite assets asset pack art icons icon images image img tiles tile files file pixel pixelart export exports new old frame frames anim animation idle default base set extra extras retired archive misc other the a of and".split())


def emoji_name(stem):
    """Twemoji-style file name '1f34e' or '1f468-200d-1f373' -> 'red apple' / 'man cook'."""
    import unicodedata

    parts = []
    for cp in stem.split("-"):
        c = chr(int(cp, 16))
        if cp in ("200d", "fe0f", "20e3"):
            continue
        if 0x1F1E6 <= ord(c) <= 0x1F1FF:
            return "flag"
        n = unicodedata.name(c, "")
        if 0x1F3FB <= ord(c) <= 0x1F3FF:
            continue  # skin tone modifiers
        parts.append(n.lower())
    return " ".join(parts)


def caption_from_path(root, path):
    """Caption from the file name; when it says little ('04', 'tile_0012'), add the folder names."""
    stem = os.path.splitext(os.path.basename(path))[0]
    if re.fullmatch(r"[0-9a-f]{4,6}(-[0-9a-f]{4,6})*", stem.lower()):
        return emoji_name(stem.lower())
    rel = os.path.relpath(os.path.dirname(path), root)
    parts = [stem] + ([] if rel == "." else rel.split(os.sep)[::-1])

    def wordify(t):
        t = re.sub(r"\([^)]*\)", " ", t)  # '(230 assets)'
        t = re.sub(r"([a-z])([A-Z])", r"\1 \2", t)  # camelCase
        return [w for w in re.findall(r"[a-z]+", t.lower()) if w not in GENERIC and len(w) > 1]

    out = []
    for part in parts:
        for w in wordify(part):
            if w not in out:
                out.append(w)
        if len(out) >= 2:
            break
    return " ".join(out[:6])


def from_folder(path):
    for root, _, files in os.walk(path):
        for f in sorted(files):
            if not f.lower().endswith((".png", ".gif", ".bmp", ".webp")) or SKIP_FILES.search(f):
                continue
            p = os.path.join(root, f)
            txt = os.path.splitext(p)[0] + ".txt"
            cap = open(txt, encoding="utf-8").read() if os.path.exists(txt) else caption_from_path(path, p)
            try:
                yield Image.open(p), cap
            except Exception:
                continue


def from_hf(name, split, image_key=None, text_key=None):
    from datasets import load_dataset

    ds = load_dataset(name, split=split, streaming=True)
    feats = ds.features or {}
    first = None
    if not image_key or not text_key:
        first = next(iter(ds))
        cols = list(first.keys())
        print(f"[{name}] columns: {cols}")
        if not image_key:
            image_key = next((k for k in cols if isinstance(first[k], Image.Image)), None) or next(
                (k for k in cols if k in ("image", "img", "png", "sprite")), None)
        if not text_key:
            text_key = next((k for k in TEXT_KEYS if k in cols), None)
        print(f"[{name}] image column: {image_key}  text column: {text_key}")
    if not image_key:
        raise SystemExit(f"{name}: no image column found; pass --image-key")
    names = None
    if text_key and text_key in feats and hasattr(feats[text_key], "names"):
        names = feats[text_key].names  # ClassLabel -> words
    for row in ds:
        img = row[image_key]
        if isinstance(img, dict):
            img = Image.open(io.BytesIO(img["bytes"]))
        elif isinstance(img, (bytes, bytearray)):
            img = Image.open(io.BytesIO(img))
        cap = row.get(text_key, "") if text_key else ""
        if names is not None and isinstance(cap, int):
            cap = names[cap]
        yield img, cap


# ---------- palette ----------

def build_palette(rgba_list, k, seed=0):
    from sklearn.cluster import MiniBatchKMeans

    rng = np.random.default_rng(seed)
    px = np.concatenate([a[a[..., 3] > 0][:, :3] for a in rgba_list]).astype(np.float32)
    if len(px) > 3_000_000:
        px = px[rng.choice(len(px), 3_000_000, replace=False)]
    uniq = np.unique(px, axis=0)
    if len(uniq) <= k:
        centers = uniq
    else:
        km = MiniBatchKMeans(n_clusters=k, random_state=seed, batch_size=8192, n_init=3).fit(px)
        centers = km.cluster_centers_
    return np.clip(np.rint(centers), 0, 255).astype(np.uint8)


def quantize(rgba, palette, transparent):
    """(N, H, W, 4) -> (N, H*W) palette ids."""
    n = rgba.shape[0]
    flat = rgba.reshape(-1, 4)
    out = np.full(len(flat), transparent, np.uint8)
    pal = palette.astype(np.int32)
    step = 1 << 16  # 65k pixels x 255 colours at a time keeps memory near 200 MB
    for s in range(0, len(flat), step):
        chunk = flat[s : s + step]
        op = chunk[:, 3] > 0
        rgb = chunk[op, :3].astype(np.int32)
        d = ((rgb[:, None, :] - pal[None]) ** 2).sum(-1)
        idx = np.full(len(chunk), transparent, np.uint8)
        idx[op] = d.argmin(1).astype(np.uint8)
        out[s : s + len(chunk)] = idx
    return out.reshape(n, -1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--size", type=int, default=16)
    ap.add_argument("--palette", type=int, default=255)
    ap.add_argument("--hf", action="append", default=[], help="Hugging Face dataset (repeatable)")
    ap.add_argument("--split", default="train")
    ap.add_argument("--image-key")
    ap.add_argument("--text-key")
    ap.add_argument("--folder", action="append", default=[], help="folder of images (repeatable)")
    ap.add_argument("--no-fit", action="store_true", help="only keep art that is already this size or smaller")
    ap.add_argument("--limit", type=int, default=0, help="stop after this many kept images")
    args = ap.parse_args()
    if args.palette > 255:
        raise SystemExit("--palette must be <= 255 (tokens are stored as uint8)")

    sources = [(f"hf:{n}", from_hf(n, args.split, args.image_key, args.text_key)) for n in args.hf]
    sources += [(f"folder:{f}", from_folder(f)) for f in args.folder]
    if not sources:
        raise SystemExit("give at least one --hf or --folder")

    seen, imgs, caps, src = set(), [], [], []
    stats = Counter()
    for si, (name, it) in enumerate(sources):
        try:  # one broken or gated source must not stop a long run
            for img, cap in it:
                stats["seen"] += 1
                try:
                    g = to_grid(img, args.size, fit=not args.no_fit)
                except Exception:
                    stats["unreadable"] += 1
                    continue
                if g is None:
                    stats["wrong_size_or_empty"] += 1
                    continue
                h = hashlib.md5(g.tobytes()).digest()
                if h in seen:
                    stats["duplicate"] += 1
                    continue
                seen.add(h)
                imgs.append(g)
                caps.append(with_colour(clean_caption(cap), g))
                src.append(si)
                stats["kept"] += 1
                if stats["seen"] % 20000 == 0:
                    print(dict(stats), flush=True)
                if args.limit and stats["kept"] >= args.limit:
                    break
        except Exception as e:
            print(f"skipped the rest of {name}: {e}", flush=True)
        if args.limit and stats["kept"] >= args.limit:
            break
    if not imgs:
        raise SystemExit(f"nothing usable: {dict(stats)}")

    os.makedirs(args.out, exist_ok=True)
    rgba = np.stack(imgs)
    pal = build_palette(imgs, args.palette)
    tokens = quantize(rgba, pal, transparent=args.palette)
    np.save(os.path.join(args.out, "tokens.npy"), tokens)
    json.dump(caps, open(os.path.join(args.out, "captions.json"), "w"))
    np.save(os.path.join(args.out, "sources.npy"), np.array(src, np.int16))  # lets training balance big and small sources
    stats["per_source"] = {name: src.count(i) for i, (name, _) in enumerate(sources)}
    json.dump(pal.tolist(), open(os.path.join(args.out, "palette.json"), "w"))
    stats["with_caption"] = sum(1 for c in caps if c)
    stats["palette_colours"] = len(pal)
    stats["size"] = args.size
    stats["transparent"] = args.palette
    json.dump(dict(stats), open(os.path.join(args.out, "stats.json"), "w"), indent=1)
    print("done:", dict(stats))


if __name__ == "__main__":
    main()
