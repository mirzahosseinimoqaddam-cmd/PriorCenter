"""Let the model understand words it never saw in training.

Uses pretrained GloVe word vectors (glove-wiki-gigaword-100, from the gensim-data
GitHub releases) to map the most common English words onto the closest word the
model knows: kitty -> cat, blade -> sword, crimson -> red. Also adds a Persian
dictionary for common words. The result is stored inside model.bin by export.py.

    python make_aliases.py --ckpt run16/ckpt.pt --glove glove-wiki-gigaword-100.gz --out aliases.json
"""
import argparse
import gzip
import json
import os

import numpy as np
import torch

from prepare import NOT_HALAL

STOP = set("a an the of and or with in on at to for from by is are be this that it its as into over under very".split())


def load_glove(path, limit):
    words, vecs = [], []
    with gzip.open(path, "rt", encoding="utf-8") as f:
        first = f.readline().split()
        if len(first) > 2:  # no header line
            f.seek(0)
        for line in f:
            parts = line.rstrip().split(" ")
            words.append(parts[0])
            vecs.append(np.asarray(parts[1:], np.float32))
            if len(words) >= limit:
                break
    v = np.stack(vecs)
    return words, v / np.linalg.norm(v, axis=1, keepdims=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ckpt", required=True)
    ap.add_argument("--glove", required=True)
    ap.add_argument("--out", default="aliases.json")
    ap.add_argument("--words", type=int, default=40000, help="how many common English words to map")
    ap.add_argument("--min-sim", type=float, default=0.55)
    args = ap.parse_args()

    vocab = torch.load(args.ckpt, map_location="cpu")["vocab"]
    known = {w for w in vocab[2:] if w not in STOP and not w.isdigit()}
    words, vecs = load_glove(args.glove, args.words)
    index = {w: i for i, w in enumerate(words)}
    targets = [w for w in known if w in index]
    tv = vecs[[index[w] for w in targets]]
    sims = vecs @ tv.T
    best = sims.argmax(1)
    aliases = {}
    for i, w in enumerate(words):
        if w in known or w in STOP or not w.isalpha() or w in NOT_HALAL:
            continue
        s = sims[i, best[i]]
        if s >= args.min_sim:
            aliases[w] = targets[best[i]]
    fa = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "persian_words.json"), encoding="utf-8"))
    for p, en in fa.items():  # Persian word -> English phrase; keep only words the model can use
        ok = [x for x in en.split() if x in known or x in aliases]
        if ok:
            aliases[p] = " ".join(x if x in known else aliases[x] for x in ok)
    json.dump(aliases, open(args.out, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    sample = ["kitty", "blade", "crimson", "flask", "puppy", "castle", "dragon", "banana", "spaceship", "سیب", "شمشیر"]
    print(f"{len(aliases)} aliases for {len(targets)} known words; e.g.", {w: aliases.get(w) for w in sample})


if __name__ == "__main__":
    main()
