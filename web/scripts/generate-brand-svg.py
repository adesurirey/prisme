#!/usr/bin/env python3
"""Generate the Prisme brand SVG assets from the Inter variable font.

Outputs (web/src/assets/brand/):
  prisme-wordmark-nav.svg      wordmark, tracking 0.08em, opsz 14  (small contexts)
  prisme-wordmark-display.svg  wordmark, tracking 0.04em, opsz 32  (large contexts)
  prisme-mark.svg              upright P, opsz 14                  (favicon, app icons)

Every letterform is the exact Inter glyph outline (quadratic-free, the source
curves), transformed by exact affine matrices — no hand tracing, no rounding
beyond 1 decimal. See docs/research/logo/recette-finale.md for the recipe.
Uppercase PRISME per the adopted recipe; run again to regenerate after any
recipe change.
"""

from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.misc.transform import Transform
import math
import os
import urllib.request

FONT_URL = "https://github.com/google/fonts/raw/main/ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf"
FONT_PATH = os.path.join(os.environ.get("TMPDIR", "/tmp"), "Inter-var.ttf")
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "src", "assets", "brand")

WEIGHT = 800
# Uppercase PRISME, adopted after live UI comparison (the mixed heights of
# 'Prisme' read as jitter under skew; the all-caps block holds).
LETTERS = "PRISME"
ANGLES = {c: a for c, a in zip("PRISME", (20, 12, 4, -4, -12, -20))}  # degrees, + = top leans left
UPM = 2048


def load_font(opsz):
    if not os.path.exists(FONT_PATH):
        urllib.request.urlretrieve(FONT_URL, FONT_PATH)
    font = TTFont(FONT_PATH)
    instantiateVariableFont(font, {"wght": WEIGHT, "opsz": opsz}, inplace=True)
    return font


def glyph_path(glyphSet, name, k, tx):
    """SVG path data for glyph `name`, skewX(k) about the baseline, y flipped
    to SVG (down), translated by tx. Returns (path_d, transformed_bbox)."""
    transform = Transform(1, 0, -k, -1, tx, 0)
    tp = TransformPen(glyphSet[name], transform)
    pen = SVGPathPen(glyphSet)
    tp.addComponent = None  # components resolved by glyphSet pen chain
    # TransformPen wraps the glyph drawing; feed it through SVGPathPen via a
    # recording pen is overkill — draw with TransformPen outputting into SVGPathPen
    from fontTools.pens.transformPen import TransformPen as TP
    spen = SVGPathPen(glyphSet, ntos=lambda v: f"{v:.1f}".rstrip("0").rstrip("."))
    glyphSet[name].draw(TP(spen, transform))
    bp = BoundsPen(glyphSet)
    glyphSet[name].draw(TP(bp, transform))
    return spen.getCommands(), bp.bounds


def build(letters, tracking_em, opsz, angles=None):
    if angles is None:
        angles = ANGLES
    font = load_font(opsz)
    glyphSet = font.getGlyphSet()
    cmap = font.getBestCmap()
    hmtx = font["hmtx"]

    tracking = tracking_em * UPM
    paths = []
    xs_min = ys_min = float("inf")
    xs_max = ys_max = float("-inf")
    x = 0.0
    for i, ch in enumerate(letters):
        gname = cmap[ord(ch)]
        k = math.tan(math.radians(angles[ch])) if ch in angles else 0.0
        d, (x0, y0, x1, y1) = glyph_path(glyphSet, gname, k, x)
        paths.append(d)
        xs_min, xs_max = min(xs_min, x0), max(xs_max, x1)
        ys_min, ys_max = min(ys_min, y0), max(ys_max, y1)
        x += hmtx[gname][0] + tracking
    vb = f"{xs_min:.1f} {ys_min:.1f} {xs_max - xs_min:.1f} {ys_max - ys_min:.1f}"
    d = " ".join(paths)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" role="img" aria-label="Prisme"><path fill="currentColor" d="{d}"/></svg>\n'


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    assets = {
                "prisme-wordmark-nav.svg": build(LETTERS, 0.08, 14),
        "prisme-wordmark-display.svg": build(LETTERS, 0.04, 32),
        "prisme-mark.svg": build("P", 0, 14, angles={}),
    }
    for name, svg in assets.items():
        with open(os.path.join(OUT_DIR, name), "w") as f:
            f.write(svg)
        print(f"wrote {name}  ({len(svg)} bytes)")


if __name__ == "__main__":
    main()