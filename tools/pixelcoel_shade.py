# Adds shading to the coded pixel Coelophysis (sprites/coel.png and coel-walk.png) without touching its shape or color scheme (same idea as tools/pixeldime_shade.py, kept sleek like the Prionosuchus).
# Every pixel keeps its place; only fills inside the shapes change, to a lighter or darker shade of the same hue (light from the top left): a lit edge along the back, the head and the legs' left sides,
# shadow under the body and down the right edges. The thin tail, the yellow belly line, the far legs, the eye and the pupil are left as they are.
# It reads shaded colors back to their base colors first, so running it twice gives the same result. Usage: python3 -I tools/pixelcoel_shade.py [dir]
import sys
from PIL import Image
W = 100

def mix(a, b, t): return tuple(round(x * (1 - t) + y * t) for x, y in zip(a, b))
BASE = {"body": (135, 39, 10), "belly": (189, 180, 48), "stripe": (170, 60, 0), "far": (107, 31, 8), "black": (0, 0, 0), "eye": (230, 165, 0)}
SHADE = {"bodyhi": mix(BASE["body"], (255, 255, 255), .2), "bodylo": mix(BASE["body"], (0, 0, 0), .3), "bellylo": mix(BASE["belly"], (0, 0, 0), .25), "stripehi": mix(BASE["stripe"], (255, 255, 255), .2)}
ROOT = {"bodyhi": "body", "bodylo": "body", "bellylo": "belly", "stripehi": "stripe"}

def shade(grid):
    h, w = len(grid), len(grid[0]); g = lambda x, y: grid[y][x] if 0 <= x < w and 0 <= y < h else None
    out = [row[:] for row in grid]; changed = 0
    for y in range(h):
        for x in range(w):
            c = grid[y][x]; up, dn, lf, rt = g(x, y - 1), g(x, y + 1), g(x - 1, y), g(x + 1, y); n = c
            if c == "body":
                if up is None and dn is None: pass                                      # the thin tail stays as it is
                elif up is None: n = "bodyhi"                                           # a clean lit edge along the back and the top of the head
                elif dn in (None, "belly") or rt is None: n = "bodylo"                  # one band of shade under the body and down the right edge
                elif lf is None and dn == "body": n = "bodyhi"                          # a lit left side on the legs and the chest
            elif c == "stripe":
                if up is None: n = "stripehi"                                           # the stripes' lit tops
            elif c == "belly":
                if dn is None and up == "belly": n = "bellylo"                          # the jaw's lower row (the belly line is one row, so it stays bright)
            if n != c: out[y][x] = n; changed += 1
    return out, changed

def main(d, files):
    allc = {**BASE, **SHADE}; rev = {v: k for k, v in allc.items()}; assert len(rev) == len(allc), "a shade landed on another color"
    for f in files:
        path = f"{d}/{f}.png"; im = Image.open(path).convert("RGBA"); n = im.width // W; out = Image.new("RGBA", im.size, (0, 0, 0, 0)); chg = tot = 0
        for i in range(n):
            fr = im.crop((i * W, 0, (i + 1) * W, im.height)); px = fr.load(); grid = [[None] * fr.width for _ in range(fr.height)]
            for y in range(fr.height):
                for x in range(fr.width):
                    r, g_, b, a = px[x, y]
                    if a: k = rev.get((r, g_, b)); assert k, (path, x, y, (r, g_, b)); grid[y][x] = ROOT.get(k, k)   # read any earlier shading back to the base color
            res, c = shade(grid); chg += c
            for y in range(fr.height):
                for x in range(fr.width):
                    if res[y][x]: tot += 1; out.putpixel((i * W + x, y), allc[res[y][x]] + (255,))
        for y in range(im.height):   # the shape must be exactly where it was
            for x in range(im.width): assert out.getpixel((x, y))[3] == im.getpixel((x, y))[3], "the shape changed"
        out.save(path); print(path, f"{chg} of {tot} pixels shaded ({100 * chg // max(tot, 1)}%)")

main(sys.argv[1] if len(sys.argv) > 1 else "sprites", ("coel", "coel-walk"))
