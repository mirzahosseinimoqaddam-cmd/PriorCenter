# Build AI

An AI that makes pixel art from a short text, running **on your phone** (CPU and RAM only, no internet).
Version 1 makes **16×16** art. 32×32, 64×64 and more than pixel art come later.

## How it works

- Every picture is a grid of colour numbers from one shared palette (plus "transparent").
- A small transformer reads your words, then **draws the picture pixel by pixel**, row by row, like writing a sentence.
  Each pixel is an exact palette colour, so the result is always real, sharp pixel art. Nothing gets blurred and nothing needs cleanup.
- "Follow prompt" uses classifier-free guidance: the model draws with and without your words and pushes towards the difference.
- The model file (`model.bin`) is compressed to 8-bit: about **6 MB** for the full 16×16 model (6M parameters).
- On the phone, `web/engine.js` runs it in plain JavaScript on up to 4 CPU cores. It gives the same numbers as PyTorch,
  which `trainer/test_parity.py` checks.

```
build-ai/
  trainer/   prepare.py (images -> palette tokens), caption.py, model.py, train.py, export.py,
             test_parity.py, make_demo_data.py, train_16x16.ipynb (Kaggle / Colab)
  web/       index.html (the app screen), engine.js (the phone engine)
  android/   the APK shell (WebView, no internet permission), build.sh
  models/    model files bundled into the APK
```

## Status

| Step | State |
|---|---|
| Data prep: undo upscaling, dedupe, palette, captions | done, tested on synthetic sprites |
| Model + training (GPU or CPU, resumes) | done, tested |
| Phone engine (matches PyTorch to 1e-5) | done, tested |
| App: English/فارسی, 1–4 pictures, creativity, follow-prompt, symmetric, Game Boy / PICO-8 / NES palettes, save PNG and 512px, history, import model | done, tested in a browser |
| APK | built by GitHub Actions → release `buildai-latest` |
| **Real 16×16 model on the 1.4M-image set** | **next: run `trainer/train_16x16.ipynb` on Kaggle or Colab** |

The APK carries `models/pixel16.bin`: 3M parameters, trained on a CPU on 10,149 free images (see Data and licences).
The notebook trains a bigger model on the 1.4M set as well; import its `pixel16.bin` in the app or commit it here.

## Train the real model

1. Open `trainer/train_16x16.ipynb` on Kaggle (GPU T4, Internet on) or Colab (GPU) and run all cells.
   The first cell checks the dataset (columns, captions, how many images are true 16×16).
2. Download `pixel16.bin` at the end.
3. Either import it in the app (**Import model file**), or commit it as `build-ai/models/pixel16.bin`.
   The next APK build then carries it.

Local CPU test of the whole pipeline (about 15 minutes):

```
pip install -r trainer/requirements.txt
cd trainer
python make_demo_data.py demo_png 6000
python prepare.py --out demo16 --folder demo_png
python train.py --data demo16 --out demo --steps 1500 --batch 64 --dim 128 --layers 4 --heads 4 --lr 1e-3
python export.py --ckpt demo/ckpt.pt --out demo.bin --name "Demo"
python test_parity.py demo.bin
```

## Data and licences

| Source | Licence | Used for |
|---|---|---|
| [Angais/pixel-art-atlas-1.4m](https://huggingface.co/datasets/Angais/pixel-art-atlas-1.4m) | see its dataset card (checked in notebook step 1) | main set (notebook) |
| [ptx0/free-to-use-pixelart](https://huggingface.co/datasets/ptx0/free-to-use-pixelart) | MIT (PixilArt free-to-use) | more art, captioned by BLIP (notebook) |
| [jainr3/diffusiondb-pixelart](https://huggingface.co/datasets/jainr3/diffusiondb-pixelart) | CC0 | AI pixel-art generator samples (notebook) |
| 16×16 sprites of the DeepLearning.AI "How Diffusion Models Work" course ([copy](https://github.com/Shamik-07/CodeSnippets)) | free course data; sprites by ElvGames, kyrise and FrootsnVeggies (itch.io free packs) | 1,114 unique heroes, monsters, food, items |
| [Twemoji](https://github.com/jdecked/twemoji) | CC-BY 4.0, © Twitter / X and contributors | 3,955 emoji (names give 1,000+ words) |
| [Kenney asset pack 1](https://github.com/iwenzhou/kenney) | CC0 (Kenney.nl) | 3,048 game sprites |
| [Pixel-Art-Prototyping-CC0-Collection](https://github.com/PixelRubro/Pixel-Art-Prototyping-CC0-Collection) | CC0 | 784 pirate / platformer sprites |
| [project-cordon-sprites](https://github.com/doficia/project-cordon-sprites) | CC0 | 79 sprites |
| [Pixel_Icons](https://github.com/MarcelloCalligaris/Pixel_Icons) | CC0 | 44 icons |
| [unicornhat weather icons](https://github.com/LoveBootCaptain/unicornhat_weather_icons) | MIT | 23 weather icons |
| [tstamborski/pixelart-icons](https://github.com/tstamborski/pixelart-icons) | CC0 | 254 icons |
| [famfamfam Silk icons](http://www.famfamfam.com/lab/icons/silk/) ([GitHub copy](https://github.com/markjames/famfamfam-silk-icons)) | CC-BY 2.5, credit Mark James | 997 icons |

The model bundled in the APK (`models/pixel16.bin`) was trained on the GitHub sources above (10,149 images after the halal filter).
Art bigger than 16×16 is cropped to its content and shrunk (at most 6×); a colour word is added to every caption.

**Halal filter:** `train.py` leaves out every image whose caption contains a word from `NOT_HALAL` in `prepare.py`
(alcohol, pork, gambling, nudity, drugs, idols), plus every image with no caption. The model never sees those words, so prompts with them are ignored.

`prepare.py` takes any number of sources: `--hf <dataset>` (repeatable) and `--folder <dir>` (captions from a `.txt` next to each image, or the file name).
Before adding a source, check its licence. Prefer CC0 / CC-BY sets (for example OpenGameArt packs), and leave out sprites ripped from commercial games.

## Next

- 32×32 and 64×64: the same model with `--size 32/64`. For 64×64 (4,096 pixels) it will draw in small patches instead of single pixels, to stay fast on a phone.
- Edit an existing sprite, fill in a half-drawn one, animation frames, tilesets.
- Beyond pixel art: the same on-device engine design, with bigger vocabularies and other kinds of output.
