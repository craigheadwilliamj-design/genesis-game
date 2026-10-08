# Adds shading and texture to Cotylorhynchus (sprites/coty.png, coty-walk.png, coty-idle.png) without touching its shape or its colors' hues (the same idea as tools/pixeldime_shade.py).
# Every pixel keeps its place; only fills inside the shapes change, to a lighter or darker shade of the same color (light from the top left): a lit edge along the back and the top of the head,
# shadow under the belly and down the right side, notched shade under the rust stripe, scale rows of short dashes on the hide, and scutes on the belly.
# It reads shaded colors back to their base colors first, so running it twice gives the same result. Usage: python3 -I tools/pixelcoty_shade.py [dir]
import sys
from PIL import Image

def mix(a, b, t): return tuple(round(x * (1 - t) + y * t) for x, y in zip(a, b))
W, WHITE, BLACK = 100, (255, 255, 255), (0, 0, 0)
BASE = {"body": (38, 42, 65), "rust": (144, 47, 12), "belly": (96, 90, 58), "dark": (20, 24, 35)}   # the colors the sprite is drawn with
SHADE = {}
for k, c in BASE.items():
    SHADE[k + "hi"] = mix(c, WHITE, {"body": .13, "rust": .2, "belly": .18, "dark": .12}[k]); SHADE[k + "lo"] = mix(c, BLACK, {"body": .3, "rust": .28, "belly": .22, "dark": .3}[k])
ALL = {**BASE, **SHADE}; ROOT = {k: k[:-2] for k in SHADE}
H = lambda x, y, m: (x * 7 + y * 13 + (x * y) % 5) % m   # a fixed scatter by position, so the texture sits still from frame to frame
REV = {v: k for k, v in ALL.items()}

def classify(im):
    px = im.load(); g = [[None] * im.width for _ in range(im.height)]
    for y in range(im.height):
        for x in range(im.width):
            r, gg, b, a = px[x, y]
            if a: k = REV.get((r, gg, b)); g[y][x] = ROOT.get(k, k) if k else (r, gg, b)   # anything else (the eye, the odd speck) stays exactly as it is
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
                if up in (None, "rust") and H(x, y, 3) != 0: n = "bodyhi"                                       # a lit edge along the back and the top of the head, broken up
                elif dn in ("belly", None) and (x + y) % 2 == 0: n = "bodylo"                                    # shadow where the body turns under, dithered
                elif dn == "dark" and x % 2 == 0: n = "bodylo"                                                   # and above the far legs
                elif rt is None and y % 2 == 0: n = "bodylo"                                                     # the right edge (chest, rump) is in shade
                elif y % 4 == 0 and (x + (y // 4) * 3) % 6 in (0, 1) and up == "body" and dn == "body": n = "bodylo"   # scale rows: short dark dashes, staggered
                if g(x, y + 1) == (255, 255, 255) or g(x + 1, y) == (255, 255, 255): n = "bodylo"                # a shadowed brow and cheek at the eye
            elif c == "rust":
                if up is None and (x + y) % 3 != 0: n = "rusthi"                                                 # the stripe's top catches the light
                elif lf is None and y % 2 == 0: n = "rusthi"
                elif dn in ("body", "bodylo", "bodyhi", None) and (x + y) % 2 == 0: n = "rustlo"                 # shade where it meets the back, and on its notched lower edge
                elif rt is None and y % 2 == 0: n = "rustlo"
            elif c == "belly":
                if dn is None: n = "bellylo"                                                                     # the underside is in shadow
                elif x % 4 == 1 and up in ("body", "bodylo", "bodyhi"): n = "bellyhi"                            # belly scutes: short light dashes
                elif up is None and x % 3 == 0: n = "bellyhi"
            elif c == "dark":
                if up is None and H(x, y, 2) == 0: n = "darkhi"                                                  # a lit top on the legs
                elif rt is None and y % 2 == 0: n = "darklo"
            if n != c: out[y][x] = n
    return out

def process(path):
    im = Image.open(path).convert("RGBA"); n = im.width // W; out = Image.new("RGBA", im.size, (0, 0, 0, 0)); changed = total = 0
    for i in range(n):
        fr = im.crop((i * W, 0, (i + 1) * W, im.height)); grid = classify(fr); res = shade(grid)
        for y in range(fr.height):
            for x in range(fr.width):
                c = res[y][x]
                if c is None: continue
                total += 1; changed += c != grid[y][x]
                out.putpixel((i * W + x, y), (ALL[c] if isinstance(c, str) else c) + (255,))
    assert out.getchannel("A").tobytes() == im.getchannel("A").tobytes(), "the shape changed"
    out.save(path); print(path, f"{changed} of {total} pixels shaded ({100 * changed // max(total, 1)}%)")

d = sys.argv[1] if len(sys.argv) > 1 else "sprites"
for f in ("coty", "coty-walk", "coty-idle"): process(f"{d}/{f}.png")
