# Builds the coded pixel Dimetrodon (js/pixelart-dime.js) from sprites/dime.png and sprites/dime-walk.png.
# Usage: python3 -I tools/pixeldime.py [out.js]
# Standing keeps the original art. Walk: the first walk frame's body with its legs wiped, a belly line run straight
# along the underside, then all four legs redrawn each frame (diagonal pairs, sprawled: knees forward, elbows back).
import sys, math
from PIL import Image
from collections import Counter
KEYS = "abcdefgh"
WALK = 6
def load(path, n):
    im = Image.open(path).convert("RGBA"); w = im.width // n; out = []
    for i in range(n):
        px = {}
        for y in range(im.height):
            for x in range(w):
                r, g, b, a = im.getpixel((i*w + x, y))
                if a > 127: px[(x, y)] = (r, g, b)
        out.append(px)
    return out, w, im.height
(stand,), W, H = load("sprites/dime.png", 1)
walks, _, _ = load("sprites/dime-walk.png", 2)
OLIVE, DARK, BELLY = (97, 111, 34), (67, 75, 22), (178, 165, 66)
def line(g, a, b, col, wd, th=2):    # a solid stroke: every step stamps a wd x th block, so limbs never break into stray pixels
    n = max(round(abs(b[0]-a[0])), round(abs(b[1]-a[1])), 1)
    for i in range(n+1):
        x, y = round(a[0] + (b[0]-a[0])*i/n), round(a[1] + (b[1]-a[1])*i/n)
        for dx in range(wd):
            for dy in range(th): g[(x + dx - wd//2, y + dy)] = col
def leg(g, hip, ank, col, fwd):       # upper and lower leg, the joint bending forward (knee) or back (elbow), then a flat foot
    dx, dy = ank[0] - hip[0], ank[1] - hip[1]; d = min(math.hypot(dx, dy), 5.9)
    t = 3.2; a = math.acos(d / (2*t)); ba = math.atan2(dy, dx)
    jn = (hip[0] + t*math.cos(ba - fwd*a), hip[1] + t*math.sin(ba - fwd*a))
    line(g, hip, jn, col, 4); line(g, jn, ank, col, 3)
    fx, fy = round(ank[0]), round(ank[1]) + 1
    for i in range(-1, 4): g[(fx + i, fy)] = col; g[(fx + i, fy + 1)] = col if 0 <= i <= 2 else g.get((fx + i, fy + 1))
    for k in [k for k, v in g.items() if v is None]: del g[k]
def bare(base):                        # body with the legs wiped (rows 60 down, plus leg tops in row 59), belly line filled in
    body = {k: v for k, v in base.items() if not (40 <= k[0] <= 95 and (k[1] >= 60 or (k[1] == 59 and v in (OLIVE, DARK))))}
    for x in range(41, 76): body.setdefault((x, 59), BELLY)
    return body
def foot(p, hx, up=2.5):               # foot slides back while planted, lifts and swings forward
    if p < .6: return hx + 5 - 10 * p / .6, 62
    u = (p - .6) / .4
    return hx - 5 + 10 * (u*u*(3 - 2*u)), 62 - up * math.sin(math.pi * u)
def pose(body, bob, p):
    g = {(x, y + bob): c for (x, y), c in body.items()}
    # far legs first (dark), then near; diagonal pairs: near hind with far front, far hind with near front
    for hx, col, fwd, ph in ((79, DARK, -1, p), (50, DARK, 1, (p + .5) % 1), (79, OLIVE, -1, (p + .5) % 1), (50, OLIVE, 1, p)):
        leg(g, (hx, 58 + bob), foot(ph, hx), col, fwd)
    return g
walkBody = bare(walks[0])
walk = [pose(walkBody, math.floor(.5 + .5 * math.cos(4*math.pi*k/WALK) + .5), k / WALK) for k in range(WALK)]
grids = [stand] + walk
use = Counter(c for g in grids for c in g.values())
pal = [c for c, _ in use.most_common(len(KEYS))]
def near(c): return min(range(len(pal)), key=lambda i: sum((a-b)**2 for a, b in zip(pal[i], c)))
rows = [["".join(KEYS[near(g[(x, y)])] if (x, y) in g else "." for x in range(W)) for y in range(H)] for g in grids]
js = "// Coded pixel Dimetrodon, built by tools/pixeldime.py: PIXEL_ART.dime = {pal, frames: [stand, walk1..walk6]}, one letter per pixel ('.' is clear).\nPIXEL_ART.dime = {\n  pal: {" + ", ".join(f'{KEYS[i]}:"#%02x%02x%02x"' % c for i, c in enumerate(pal)) + "},\n  frames: [\n" + ",\n".join("    [\n" + ",\n".join(f'      "{r}"' for r in fr) + "\n    ]" for fr in rows) + "\n  ]\n};\n"
open(sys.argv[1] if len(sys.argv) > 1 else "js/pixelart-dime.js", "w").write(js)
print(len(use), "colors,", len(rows), "frames")
