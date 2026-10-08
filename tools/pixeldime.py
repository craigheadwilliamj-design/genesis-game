# Builds the coded pixel Dimetrodon (PIXEL_ART.dime in js/pixelart.js) from sprites/dime.png and sprites/dime-walk.png.
# The PNGs are already flat pixel art, so every pixel is kept as is. Usage: python3 -I tools/pixeldime.py [pixelart.js]
import sys
from PIL import Image
from collections import Counter
KEYS = "abcdefghijklmnop"
def load(path, n):
    im = Image.open(path).convert("RGBA"); w = im.width // n
    return [im.crop((i*w, 0, (i+1)*w, im.height)) for i in range(n)]
frames = load("sprites/dime.png", 1) + load("sprites/dime-walk.png", 2)
use = Counter(p[:3] for f in frames for p in f.getdata() if p[3] > 127)
pal = [c for c, _ in use.most_common(len(KEYS))]
assert len(use) <= len(KEYS), "too many colors"
def near(c): return min(range(len(pal)), key=lambda i: sum((a-b)**2 for a, b in zip(pal[i], c)))
rows = []
for f in frames:
    px = f.load()
    rows.append(["".join(KEYS[near(px[x, y][:3])] if px[x, y][3] > 127 else "." for x in range(f.width)) for y in range(f.height)])
# Two passing poses between the drawn walk frames (cycle: walk1, passA, walk2, passB). The body is walk1's; only the belly line and legs
# are redrawn. Letters: the palette keys of the near leg (olive), far leg (dark) and belly (yellow), looked up by color.
key = lambda c: KEYS[pal.index(c)]
NEAR, FAR, BELLY = key((97, 111, 34)), key((67, 75, 22)), key((178, 165, 66))
def passing(legs):
    g = [list(r) for r in rows[1]]
    for y in (58, 59):                                  # belly line straight across, then the legs go over it
        for x in range(38, 75):
            if g[y][x] in (NEAR, FAR) or rows[2][y][x] == BELLY: g[y][x] = BELLY if (y == 59 or g[y][x] == NEAR) else g[y][x]
    for y in range(57, 60): g[y][79:95] = rows[2][y][79:95]   # clean chest: no leftover far-leg pixels from walk1
    for y in range(60, 66):
        for x in range(36, 95): g[y][x] = "."
    for ch, y, x0, w in legs:
        for x in range(x0, x0 + w): g[y][x] = {"n": NEAR, "f": FAR}[ch]
    return ["".join(r) for r in g]
# (leg, row, first column, width): far legs first so near legs draw over them
passA = [("f",60,48,2),("f",61,48,5),                   # rear far swings forward, lifted
         ("f",58,80,2),("f",59,80,2),("f",60,80,2),("f",61,81,2),("f",62,81,4),   # front far planted
         ("n",58,49,4),("n",59,48,4),("n",60,48,3),("n",61,48,3),("n",62,48,3),("n",63,48,5),   # rear near planted
         ("n",60,76,3),("n",61,77,4)]                                                           # front near swings forward, lifted
passB = [("f",60,47,2),("f",61,47,2),("f",62,47,5),     # rear far planted
         ("f",57,82,1),("f",58,80,4),("f",59,81,3),("f",60,82,4),("f",61,84,3),   # front far swings forward, lifted
         ("n",58,50,4),("n",59,49,4),("n",60,50,3),("n",61,51,3),("n",62,52,5),                 # rear near swings forward, lifted
         ("n",60,76,3),("n",61,77,3),("n",62,77,3),("n",63,77,5)]                               # front near planted
rows = [rows[0], rows[1], passing(passA), rows[2], passing(passB)]
block = "// Coded pixel Dimetrodon, built by tools/pixeldime.py: PIXEL_ART.dime = {pal, frames: [stand, walk1, pass, walk2, pass]}.\nPIXEL_ART.dime = {\n  pal: {" + ", ".join(f'{KEYS[i]}:"#%02x%02x%02x"' % c for i, c in enumerate(pal)) + "},\n  frames: [\n" + ",\n".join("    [\n" + ",\n".join(f'      "{r}"' for r in fr) + "\n    ]" for fr in rows) + "\n  ]\n};\n"
path = sys.argv[1] if len(sys.argv) > 1 else "js/pixelart.js"
src = open(path).read()
i = src.find("// Coded pixel Dimetrodon")
if i >= 0: src = src[:i]
open(path, "w").write(src + block)
print(len(pal), "colors", frames[0].size, len(frames), "frames")
