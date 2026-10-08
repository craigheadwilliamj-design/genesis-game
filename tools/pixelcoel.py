# Builds the coded pixel Coelophysis (js/pixelart.js) from sprites/coel.png and sprites/coel-walk.png.
# Usage: python3 -I tools/pixelcoel.py [out.js]
import sys
from PIL import Image
from collections import Counter
F = 1                       # 1 keeps every source pixel (100x75), 2 halves it
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
# Walk: the body of the first walk frame with its legs wiped, then both legs redrawn each frame (see walkFrames).
import math
WALK = 6
def walkFrames(W, H, base):
    body = {k: v for k, v in base.items() if not (44 <= k[0] <= 63 and k[1] >= 39)}
    FAR, NEAR = (107, 31, 8), (135, 39, 10)
    def line(g, a, b, col, wd):
        n = max(round(abs(b[0]-a[0])), round(abs(b[1]-a[1])), 1)
        for i in range(n+1):
            x, y = round(a[0] + (b[0]-a[0])*i/n), round(a[1] + (b[1]-a[1])*i/n)
            for dx in range(wd): g[(x + dx - wd//2, y)] = col
    def foot(p):                       # ankle position over the cycle: slide back while planted, lift and swing forward
        if p < .6: return 62 - 15 * p / .6, 47
        u = (p - .6) / .4
        return 47 + 15 * (u*u*(3 - 2*u)), 47 - 4 * math.sin(math.pi * u)
    out = []
    for k in range(WALK):
        p = k / WALK
        b = math.floor(1 + math.cos(4*math.pi*p) + .5)   # body sinks when the feet are apart, rises as they pass
        g = {(x, y + b): c for (x, y), c in body.items()}
        hip = (57, 38 + b)
        for ph, col in ((p + .5) % 1, FAR), (p, NEAR):
            ax, ay = foot(ph)
            dx, dy = ax - hip[0], ay - hip[1]; d = min(math.hypot(dx, dy), 9.9)
            t = 5; a = math.acos(d / (2*t)); base_a = math.atan2(dy, dx)
            kx, ky = hip[0] + t*math.cos(base_a - a), hip[1] + t*math.sin(base_a - a)   # knee swings forward
            line(g, (hip[0], hip[1]-1), (kx, ky), col, 4); line(g, (kx, ky), (ax, ay), col, 2)
            line(g, (ax, ay), (ax, 49), col, 2); line(g, (ax, 49), (ax + 3, 50), col, 2)
        out.append((W, H, g))
    return out
grids = grids[:1] + walkFrames(*grids[1][:2], grids[1][2])
# one shared palette: the most used colors, everything else snaps to the nearest
use = Counter(c for _, _, g in grids for c in g.values())
pal = [c for c, _ in use.most_common(len(KEYS))]
print(len(use), "source colors")
def near(c): return min(range(len(pal)), key=lambda i: sum((a-b)**2 for a, b in zip(pal[i], c)))
rows = []
for W, H, g in grids:
    rows.append(["".join(KEYS[near(g[(x, y)])] if (x, y) in g else "." for x in range(W)) for y in range(H)])
js = "// Coded pixel Coelophysis, built by tools/pixelcoel.py: PIXEL_ART.coel = {pal, frames: [stand, walk1, walk2]}, one letter per pixel ('.' is clear).\nconst PIXEL_ART = {coel: {\n  pal: {" + ", ".join(f'{KEYS[i]}:"#%02x%02x%02x"' % c for i, c in enumerate(pal)) + "},\n  frames: [\n" + ",\n".join("    [\n" + ",\n".join(f'      "{r}"' for r in fr) + "\n    ]" for fr in rows) + "\n  ]\n}};\n"
open(sys.argv[1] if len(sys.argv) > 1 else "js/pixelart.js", "w").write(js)
print(len(pal), "colors", grids[0][:2])
