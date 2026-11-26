#!/bin/sh
# Renders the icons and the link preview from their SVG sources in art/ into public/, which Vite copies to the site's
# root. Run after changing a source; needs rsvg-convert (librsvg). The PNGs are committed, so the build needs neither.
set -eu
cd "$(dirname "$0")/.."
cp art/icon.svg public/favicon.svg
rsvg-convert -w 32 -h 32 art/icon.svg -o public/favicon-32.png
rsvg-convert -w 180 -h 180 art/icon.svg -o public/apple-touch-icon.png
rsvg-convert -w 192 -h 192 art/icon.svg -o public/icon-192.png
rsvg-convert -w 512 -h 512 art/icon.svg -o public/icon-512.png
rsvg-convert -w 1200 -h 630 art/og-image.svg -o public/og-image.png
