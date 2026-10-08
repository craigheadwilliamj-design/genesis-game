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
block = "// Coded pixel Dimetrodon, built by tools/pixeldime.py: PIXEL_ART.dime = {pal, frames: [stand, walk1, walk2]}.\nPIXEL_ART.dime = {\n  pal: {" + ", ".join(f'{KEYS[i]}:"#%02x%02x%02x"' % c for i, c in enumerate(pal)) + "},\n  frames: [\n" + ",\n".join("    [\n" + ",\n".join(f'      "{r}"' for r in fr) + "\n    ]" for fr in rows) + "\n  ]\n};\n"
path = sys.argv[1] if len(sys.argv) > 1 else "js/pixelart.js"
src = open(path).read()
i = src.find("// Coded pixel Dimetrodon")
if i >= 0: src = src[:i]
open(path, "w").write(src + block)
print(len(pal), "colors", frames[0].size, len(frames), "frames")
