#!/usr/bin/env bash
# Minifies the app (src/einstelab.html) into the single page both phone apps bundle.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p android/assets
npx --yes html-minifier-terser@7.2.0 --collapse-whitespace --remove-comments --minify-css true \
  --minify-js '{"compress":{"passes":2}}' -o android/assets/index.html src/einstelab.html
echo "Built $(pwd)/android/assets/index.html"
