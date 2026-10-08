# Builds the coded pixel Tiktaalik (PIXEL_ART.tikt in js/pixelart.js) from sprites/tikt-idle.png: just its two idle frames, no separate standing picture.
# The PNGs are already flat pixel art, so every pixel is kept as is. Usage: python3 -I tools/pixeltikt.py [pixelart.js]
import sys
from PIL import Image
from collections import Counter
KEYS = "abcdefghijklmnop"
def load(path, n):
    im = Image.open(path).convert("RGBA"); w = im.width // n
    return [im.crop((i*w, 0, (i+1)*w, im.height)) for i in range(n)]
idle = load("sprites/tikt-idle.png", 2)
use = Counter(p[:3] for f in idle for p in f.getdata() if p[3] > 127)
assert len(use) <= len(KEYS), "too many colors"
pal = [c for c, _ in use.most_common(len(KEYS))]
def near(c): return min(range(len(pal)), key=lambda i: sum((a-b)**2 for a, b in zip(pal[i], c)))
def rows(f):
    px = f.load()
    return ["".join(KEYS[near(px[x, y][:3])] if px[x, y][3] > 127 else "." for x in range(f.width)) for y in range(f.height)]
fmt = lambda frs: "[\n" + ",\n".join("    [\n" + ",\n".join(f'      "{r}"' for r in rows(f)) + "\n    ]" for f in frs) + "\n  ]"
block = "// Coded pixel Tiktaalik, built by tools/pixeltikt.py: PIXEL_ART.tikt = {pal, idle: [idle1, idle2]} (vivarium strip).\nPIXEL_ART.tikt = {\n  pal: {" + ", ".join(f'{KEYS[i]}:"#%02x%02x%02x"' % c for i, c in enumerate(pal)) + "},\n  idle: " + fmt(idle) + "\n};\n"
path = sys.argv[1] if len(sys.argv) > 1 else "js/pixelart.js"
src = open(path).read()
i = src.find("// Coded pixel Tiktaalik")
if i >= 0: src = src[:i]
open(path, "w").write(src + block)
print(len(pal), "colors", idle[0].size, len(idle), "frames")
