# Builds the coded pixel Coelophysis (js/pixelart.js) from sprites/coel.png and sprites/coel-walk.png.
# Usage: python3 -I tools/pixelcoel.py [out.js]
import sys
from PIL import Image
from collections import Counter
F = 2                       # shrink factor: 100x75 -> 50x38
KEYS = "abcdefghijklmnop"
def load(path, n):
    im = Image.open(path).convert("RGBA"); w = im.width // n
    return [im.crop((i*w, 0, (i+1)*w, im.height)) for i in range(n)]
def shrink(fr):
    W, H = (fr.width + F - 1)//F, (fr.height + F - 1)//F
    px = fr.load(); out = {}
    for y in range(H):
        for x in range(W):
            c = Counter()
            for dy in range(F):
                for dx in range(F):
                    xx, yy = x*F+dx, y*F+dy
                    if xx < fr.width and yy < fr.height:
                        r, g, b, a = px[xx, yy]
                        c[(r, g, b) if a > 127 else None] += 1
            clear = c.pop(None, 0)
            if c and sum(c.values()) >= clear: out[(x, y)] = c.most_common(1)[0][0]
    return W, H, out
frames = [load("sprites/coel.png", 1)[0]] + load("sprites/coel-walk.png", 2)
grids = [shrink(f) for f in frames]
# one shared palette: the most used colors, everything else snaps to the nearest
use = Counter(c for _, _, g in grids for c in g.values())
pal = [c for c, _ in use.most_common(len(KEYS))]
def near(c): return min(range(len(pal)), key=lambda i: sum((a-b)**2 for a, b in zip(pal[i], c)))
rows = []
for W, H, g in grids:
    rows.append(["".join(KEYS[near(g[(x, y)])] if (x, y) in g else "." for x in range(W)) for y in range(H)])
js = "// Coded pixel Coelophysis, built by tools/pixelcoel.py: PIXEL_ART.coel = {pal, frames: [stand, walk1, walk2]}, one letter per pixel ('.' is clear).\nconst PIXEL_ART = {coel: {\n  pal: {" + ", ".join(f'{KEYS[i]}:"#%02x%02x%02x"' % c for i, c in enumerate(pal)) + "},\n  frames: [\n" + ",\n".join("    [\n" + ",\n".join(f'      "{r}"' for r in fr) + "\n    ]" for fr in rows) + "\n  ]\n}};\n"
open(sys.argv[1] if len(sys.argv) > 1 else "js/pixelart.js", "w").write(js)
print(len(pal), "colors", grids[0][:2])
