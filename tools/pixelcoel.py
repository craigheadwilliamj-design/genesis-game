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
# Standing and walking both: the body with its legs wiped, a yellow underbelly line run straight along the new bottom edge, then both legs
# redrawn below it (see poses). The walk body is the first walk frame; the standing body is the standing picture.
import math
WALK = 6
FAR, NEAR, BELLY = (107, 31, 8), (135, 39, 10), (189, 180, 48)
def line(g, a, b, col, wd):
    n = max(round(abs(b[0]-a[0])), round(abs(b[1]-a[1])), 1)
    for i in range(n+1):
        x, y = round(a[0] + (b[0]-a[0])*i/n), round(a[1] + (b[1]-a[1])*i/n)
        for dx in range(wd): g[(x + dx - wd//2, y)] = col
def bare(base, top, low=99):           # the body without legs (rows top to low-1 only when low is set), belly line yellow across the rump
    body = {k: v for k, v in base.items() if not (44 <= k[0] <= 63 and top <= k[1] < low)}
    for x in range(47, 64):
        ys = [y for (xx, y) in body if xx == x and y < top]
        if ys: body[(x, max(ys))] = BELLY
    return body
def leg(g, hip, ank, col):             # thigh, shin and a three-toe-wide foot, the knee bending forward
    dx, dy = ank[0] - hip[0], ank[1] - hip[1]; d = min(math.hypot(dx, dy), 9.9)
    t = 5; a = math.acos(d / (2*t)); ba = math.atan2(dy, dx)
    kn = (hip[0] + t*math.cos(ba - a), hip[1] + t*math.sin(ba - a))
    line(g, hip, kn, col, 4); line(g, kn, ank, col, 2)
    line(g, ank, (ank[0], 49), col, 2); line(g, (ank[0], 49), (ank[0] + 3, 50), col, 2)
def pose(body, bob, hipY, near, far):
    g = {(x, y + bob): c for (x, y), c in body.items()}
    hip = (57, hipY + bob)
    leg(g, hip, far, FAR); leg(g, hip, near, NEAR)
    return g
def foot(p):                           # ankle over the cycle: slide back while planted, lift and swing forward
    if p < .6: return 62 - 15 * p / .6, 47
    u = (p - .6) / .4
    return 47 + 15 * (u*u*(3 - 2*u)), 47 - 4 * math.sin(math.pi * u)
W, H = grids[0][:2]
stand = bare(grids[0][2], 38, 41)      # the original standing legs stay: only the bulge above them goes, and a short thigh joins them to the body
for y in range(37, 41):   # from the belly row down, so the thigh covers the yellow line only where it is
    for x, c in ((55, FAR), (56, FAR), (57, FAR), (58, NEAR), (59, NEAR), (60, NEAR)): stand[(x, y)] = c
walk = [pose(bare(grids[1][2], 39), math.floor(1 + math.cos(4*math.pi*k/WALK) + .5), 38, foot(k/WALK), foot((k/WALK + .5) % 1)) for k in range(WALK)]
grids = [(W, H, stand)] + [(W, H, g) for g in walk]
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
