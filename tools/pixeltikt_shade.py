# Adds shading to Tiktaalik (sprites/tikt.png, tikt-idle.png) without touching its shape or its colors' hues (same idea as tools/pixelprio_shade.py, kept sleek: a few clean bands, no speckle).
# Every pixel keeps its place and stays opaque or clear; only fills inside the shapes change, to a lighter or darker shade of the same color (light from the top left): a lit edge along the back,
# the head and the tail's top, shadow under the belly, the flank's underside and the right side, a lit left edge and shaded underside on the fins. The back stripe, eye and dark marks are left as they are.
# It reads shaded colors back to their base colors first, so running it twice gives the same result. The game paints PIXEL_ART.tikt (js/pixelart.js) in place of tikt-idle.png, so the last step rewrites that block's idle frames from the shaded PNG (same pixels, a palette with the shades added).
# Usage: python3 -I tools/pixeltikt_shade.py [dir] [pixelart.js]
import sys, re
from PIL import Image

def mix(a, b, t): return tuple(round(x * (1 - t) + y * t) for x, y in zip(a, b))
W, WHITE, BLACK = 100, (255, 255, 255), (0, 0, 0)
BASE = {"body": (103, 126, 61), "tail": (154, 118, 61), "belly": (128, 159, 75), "head": (112, 139, 65), "fin": (95, 116, 56), "stripe": (108, 44, 44)}   # the colors the sprite is drawn with
HI = {"body": .2, "tail": .2, "belly": .18, "head": .2, "fin": .2, "stripe": .2}; LO = {"body": .25, "tail": .28, "belly": .22, "head": .25, "fin": .25, "stripe": .25}
SHADE = {}
for k, c in BASE.items(): SHADE[k + "hi"] = mix(c, WHITE, HI[k]); SHADE[k + "lo"] = mix(c, BLACK, LO[k])
ALL = {**BASE, **SHADE}; ROOT = {k: k[:-2] for k in SHADE}; REV = {v: k for k, v in ALL.items()}
assert len(REV) == len(ALL), "a shade landed on another color"

def classify(im):
    px = im.load(); g = [[None] * im.width for _ in range(im.height)]
    for y in range(im.height):
        for x in range(im.width):
            r, gg, b, a = px[x, y]
            if a: k = REV.get((r, gg, b)); g[y][x] = ROOT.get(k, k) if k else (r, gg, b)   # the eye and the dark marks stay exactly as they are
    return g

def shade(grid):
    h, w = len(grid), len(grid[0]); g = lambda x, y: grid[y][x] if 0 <= x < w and 0 <= y < h else None
    out = [row[:] for row in grid]
    for y in range(h):
        for x in range(w):
            c = grid[y][x]
            if c not in BASE: continue
            up, dn, lf, rt = g(x, y - 1), g(x, y + 1), g(x - 1, y), g(x + 1, y); n = c
            if c == "body":
                if up in (None, "tail"): n = "bodyhi"                                  # a clean lit edge along the back
                elif dn in ("belly", None, "fin", "tail"): n = "bodylo"                # one band of shade where the flank turns under
            elif c == "stripe":
                if up is None: n = "stripehi"                                          # the back stripe's lit top
            elif c == "tail":
                if up is None: n = "tailhi"                                            # the tail's top catches the light
                elif dn is None or dn == "body" and rt in ("body", "bodylo"): n = "taillo"   # shade under the tail
            elif c == "belly":
                if dn is None: n = "bellylo"                                           # the underside is in shadow
                elif up is None: n = "bellyhi"
            elif c == "head":
                if up is None: n = "headhi"                                            # the head's lit top
                elif dn in (None, "belly") or rt is None: n = "headlo"                 # shade under the jaw and on the snout tip
            elif c == "fin":
                if lf is None: n = "finhi"                                             # a lit left edge on each fin
                elif dn is None or rt is None: n = "finlo"                             # its underside and right side in shade
            if n != c: out[y][x] = n
    return out

def process(path):
    im = Image.open(path).convert("RGBA"); n = im.width // W
    out = Image.new("RGBA", im.size, (0, 0, 0, 0)); changed = total = 0
    for i in range(n):
        fr = im.crop((i * W, 0, (i + 1) * W, im.height)); grid = classify(fr); res = shade(grid)
        for y in range(fr.height):
            for x in range(fr.width):
                c = res[y][x]
                if c is None: continue
                total += 1; changed += c != grid[y][x]
                out.putpixel((i * W + x, y), (ALL[c] if isinstance(c, str) else c) + (255,))
    for y in range(im.height):   # the shape must be exactly where it was
        for x in range(im.width): assert out.getpixel((x, y))[3] == im.getpixel((x, y))[3], "the shape changed"
    out.save(path); print(path, f"{changed} of {total} pixels shaded ({100 * changed // max(total, 1)}%)")

def sync_art(png, path):   # PIXEL_ART.tikt.idle = the strip's frames, one letter a pixel; letters of the old palette keep their places, new colors are added after them
    src = open(path).read(); a = src.index("// Coded pixel Tiktaalik"); blk = src[a:]
    pal = dict(re.findall(r'(\w):"(#[0-9a-fA-F]{6})"', blk.split("  idle: [", 1)[0])); keys = list(pal.values())
    im = Image.open(png).convert("RGBA"); n = im.width // W; rows = []
    for i in range(n):
        fr = []
        for y in range(im.height):
            row = ""
            for x in range(W):
                r, g, b, al = im.getpixel((i * W + x, y))
                if not al: row += "."; continue
                hx = "#%02x%02x%02x" % (r, g, b)
                if hx not in keys: keys.append(hx)
                row += "abcdefghijklmnopqrstuvwxyz"[keys.index(hx)]
            fr.append(row)
        rows.append(fr)
    head = ("// Coded pixel Tiktaalik, built by tools/pixeltikt.py and shaded by tools/pixeltikt_shade.py: PIXEL_ART.tikt = {pal, idle: [idle1, idle2]} (vivarium strip).\nPIXEL_ART.tikt = {\n  pal: {"
            + ", ".join(f'{"abcdefghijklmnopqrstuvwxyz"[i]}:"{c}"' for i, c in enumerate(keys)) + "},\n  idle: [\n"
            + ",\n".join("    [\n" + ",\n".join(f'      "{r}"' for r in fr) + "\n    ]" for fr in rows) + "\n  ]\n};\n")
    open(path, "w").write(src[:a] + head); print(path, f"Tiktaalik idle rewritten, {len(keys)} colors")

d = sys.argv[1] if len(sys.argv) > 1 else "sprites"
for f in ("tikt", "tikt-idle"): process(f"{d}/{f}.png")
sync_art(f"{d}/tikt-idle.png", sys.argv[2] if len(sys.argv) > 2 else "js/pixelart.js")
