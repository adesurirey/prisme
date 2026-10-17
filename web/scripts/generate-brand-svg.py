#!/usr/bin/env python3
"""Generate the Prisme brand SVG assets from the Inter variable font.

Outputs (web/src/assets/brand/):
  prisme-wordmark-nav.svg      wordmark, tracking 0.08em, opsz 14  (small contexts)
  prisme-wordmark-display.svg  wordmark, tracking 0.04em, opsz 32  (large contexts)
  prisme-mark.svg              skewed P (+12°, the wordmark angle), opsz 14 (favicon, app icons)

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
from fontTools.pens.recordingPen import RecordingPen
from fontTools.misc.transform import Transform
import math
import os
import urllib.request

FONT_URL = "https://github.com/google/fonts/raw/main/ofl/fraunces/Fraunces%5BSOFT%2CWONK%2Copsz%2Cwght%5D.ttf"
FONT_PATH = os.path.join(os.environ.get("TMPDIR", "/tmp"), "Fraunces-var.ttf")
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "src", "assets", "brand")

WEIGHT = 700  # Bold
# Uppercase PRISME; fan linéaire (courbe 1) de +max° à -max° sur les 6 lettres.
MAX_ANGLE = 8.0  # degrees, + = top leans left
ANGLES = {
    c: MAX_ANGLE * (1 - 2 * i / (len("PRISME") - 1))
    for i, c in enumerate("PRISME")
}
UPM = 2000  # Fraunces

# Per-letter "pinch" warp (experimental effect): each glyph is stretched
# toward its top-left and bottom-right corners while its centre stays put —
# as if the wordmark were grabbed by those two corners and pulled apart.
# Horizontal displacement only, cubic in the anti-diagonal coordinate
# t = u + v - 1 (t = -1 at the glyph's top-left, +1 at its bottom-right):
#   dx = cap * (t * (1 - sharp) + sharp * t^3)
# cap 0 = straight glyphs (no warp). Applied to nav, display and mark.
PINCH_SHARP = 2.0
PINCH_CAP_NAV = 400.0
PINCH_CAP_DISPLAY = 400.0
PINCH_CAP_MARK = 400.0

LETTERS = "PRISME"


def load_font(opsz):
    if not os.path.exists(FONT_PATH):
        urllib.request.urlretrieve(FONT_URL, FONT_PATH)
    font = TTFont(FONT_PATH)
    # WONK 0 : vérifié sans effet sur les glyphes PRISME (alternates de
    # Fraunces vivent dans d'autres lettres) — on fige pour l'exactitude.
    instantiateVariableFont(
        font, {"wght": WEIGHT, "opsz": opsz, "SOFT": 0, "WONK": 0}, inplace=True
    )
    return font


def glyph_path(glyphSet, name, k, tx, pinch=None):
    """SVG path data for glyph `name`, skewX(k) about the baseline, y flipped
    to SVG (down), translated by tx. pinch=(cap, sharp) applies the per-glyph
    pinch warp (see PINCH_* above). Returns (path_d, transformed_bbox)."""
    transform = Transform(1, 0, -k, -1, tx, 0)
    bp = BoundsPen(glyphSet)
    glyphSet[name].draw(TransformPen(bp, transform))
    rec = RecordingPen()
    glyphSet[name].draw(TransformPen(rec, transform))
    if pinch:
        cap, sharp = pinch
        x0, y0, x1, y1 = bp.bounds
        w, h = x1 - x0, y1 - y0

        def warp(pt):
            x, y = pt
            u, v = (x - x0) / w, (y - y0) / h
            t = u + v - 1
            return (x + cap * (t * (1 - sharp) + sharp * t * t * t), y)

        warped = RecordingPen()
        for op, pts in rec.value:
            if op in ("moveTo", "lineTo"):
                warped.value.append((op, (warp(pts[0]),)))
            elif op in ("curveTo", "qCurveTo"):
                warped.value.append(
                    (op, tuple(warp(p) if p is not None else None for p in pts))
                )
            else:
                warped.value.append((op, pts))
        rec = warped
    spen = SVGPathPen(glyphSet, ntos=lambda v: f"{v:.1f}".rstrip("0").rstrip("."))
    rec.replay(spen)
    return spen.getCommands(), bp.bounds


def build(letters, tracking_em, opsz, angles=None, pinch=None):
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
        d, (x0, y0, x1, y1) = glyph_path(glyphSet, gname, k, x, pinch=pinch)
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
        "prisme-wordmark-nav.svg": build(LETTERS, 0.0, 14, pinch=(PINCH_CAP_NAV, PINCH_SHARP)),
        "prisme-wordmark-display.svg": build(LETTERS, 0.0, 32, pinch=(PINCH_CAP_DISPLAY, PINCH_SHARP)),
        # l'angle du P du wordmark, adopté au rendu réel
        "prisme-mark.svg": build("P", 0, 14, pinch=(PINCH_CAP_MARK, PINCH_SHARP)),
    }
    for name, svg in assets.items():
        with open(os.path.join(OUT_DIR, name), "w") as f:
            f.write(svg)
        print(f"wrote {name}  ({len(svg)} bytes)")


if __name__ == "__main__":
    main()