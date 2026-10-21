#!/usr/bin/env python3
"""Extract page 1 of a campaign guide PDF and use it as the product cover.

The Hall of Beorn snapshots are only 235x235, which looks wrong inside the 3:4
cover frame on the new-game screen. The campaign guides ship with a proper
portrait cover, so we render page 1, crop it to 3:4 and overwrite the WebP that
`product-catalog.js` already points at.

Usage:
    python scripts/extract-pdf-covers.py --source "C:/Users/Administrator/Downloads"

Requires PyMuPDF and Pillow in the venv:
    pip install --proxy http://127.0.0.1:7899 -i https://pypi.org/simple PyMuPDF
"""
import argparse
import io
import os
import sys

import pymupdf
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_IMG = os.path.join(ROOT, 'assets', 'products')

# PDF basename (no extension) -> product slug used by product-catalog.js
MAPPING = {
    '安格玛觉醒': 'Angmar-Awakened-Campaign-Expansion',
    '逐梦者': 'Dream-chaser-Campaign-Expansion',
    '埃瑞德米斯林': 'Ered-Mithrin-Campaign-Expansion',
}

TARGET = 640   # longest side; the square frame uses contain + a blurred backdrop
RENDER_DPI = 200


def fit_longest(im, longest):
    """Scale so the longest side is `longest`, never upscaling; keeps the original ratio."""
    w, h = im.size
    scale = min(1.0, longest / max(w, h))
    if scale < 1.0:
        return im.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.LANCZOS)
    return im


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--source', required=True, help='folder holding the campaign guide PDFs')
    ap.add_argument('--quality', type=int, default=85)
    ap.add_argument('--force', action='store_true', help='rewrite covers that already exist')
    args = ap.parse_args()

    os.makedirs(OUT_IMG, exist_ok=True)
    done = missing = 0

    for stem, slug in MAPPING.items():
        pdf = os.path.join(args.source, stem + '.pdf')
        if not os.path.isfile(pdf):
            print('missing  %s' % pdf)
            missing += 1
            continue
        dest = os.path.join(OUT_IMG, slug + '.webp')
        doc = pymupdf.open(pdf)
        pix = doc[0].get_pixmap(dpi=RENDER_DPI)
        im = Image.open(io.BytesIO(pix.tobytes('png'))).convert('RGB')
        pages = doc.page_count
        doc.close()
        im = fit_longest(im, TARGET)
        im.save(dest, 'WEBP', quality=args.quality, method=6)
        size = os.path.getsize(dest)
        print('wrote    %-46s %4dx%-4d %5.1fKB  <- %s.pdf (%d pages)'
              % (slug + '.webp', im.size[0], im.size[1], size / 1024, stem, pages))
        done += 1

    print('covers written=%d missing=%d' % (done, missing))
    return 1 if missing else 0


if __name__ == '__main__':
    sys.exit(main())
