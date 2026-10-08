# Draws pixel-art plants to sprites/plants/<LAND key>.png (3/4 view, trunk base at the bottom middle, light from the top left).
# References (searched, not drawn from photos): Peltaspermum = umbrella seed discs with pendant ovules (Townrow 1960); its leaves are Lepidopteris, bipinnate
# with small pinnules; Comia = once-pinnate narrow simple pinnules (Mamay et al. 2009, its overall shape is a guess); Callistophyton = thin
# scrambling/climbing stem branching from the leaf axils with fern-like leaves (Pennsylvanian, not Permian).
# Usage: python3 -I tools/pixelplants.py [outdir]   Currently: the three Permian scrubland plants.
import sys, random, math
from PIL import Image

def mix(a, b, t): return tuple(round(x*(1-t) + y*t) for x, y in zip(a, b))
def hexc(h): return tuple(int(h[i:i+2], 16) for i in (1, 3, 5))
# Permian scrubland leaf green (PLANT_SHADE.scrubland mixed lightly with the Permian red), as a 5-tone ramp: dark to highlight
def ramp(h):
    b = mix(hexc(h), hexc("#F04028"), .07)
    return [mix(b, (0, 0, 0), .5), mix(b, (0, 0, 0), .25), b, mix(b, (255, 255, 255), .2), mix(b, (255, 255, 255), .38)]
TRUNK = [hexc(c) for c in ("#3E2A18", "#5E4126", "#85603A")]
SEED = [hexc(c) for c in ("#7A5424", "#B98B3E", "#E3C376")]

class Canvas:
    def __init__(s, w, h): s.w, s.h, s.px = w, h, {}
    def set(s, x, y, c):
        x, y = round(x), round(y)
        if 0 <= x < s.w and 0 <= y < s.h: s.px[(x, y)] = c
    def line(s, x0, y0, x1, y1, c):
        n = max(abs(x1-x0), abs(y1-y0), 1)
        for i in range(int(n) + 1): s.set(x0 + (x1-x0)*i/n, y0 + (y1-y0)*i/n, c)
    def disc(s, cx, cy, rx, ry, c):
        for y in range(int(cy-ry)-1, int(cy+ry)+2):
            for x in range(int(cx-rx)-1, int(cx+rx)+2):
                if ((x-cx)/rx)**2 + ((y-cy)/ry)**2 <= 1: s.set(x, y, c)
    def image(s, outline):
        im = Image.new("RGBA", (s.w, s.h), (0, 0, 0, 0)); px = im.load()
        for (x, y), c in s.px.items(): px[x, y] = c + (255,)
        o = Image.new("RGBA", (s.w, s.h), (0, 0, 0, 0)); op = o.load()
        for y in range(s.h):
            for x in range(s.w):
                if px[x, y][3] == 0 and any(0 <= x+dx < s.w and 0 <= y+dy < s.h and px[x+dx, y+dy][3] for dx, dy in ((1,0),(-1,0),(0,1),(0,-1))): op[x, y] = outline + (255,)
        o.alpha_composite(im); return o

def bez(p0, p1, p2, t): return tuple((1-t)**2*a + 2*(1-t)*t*b + t*t*c for a, b, c in zip(p0, p1, p2))

def frond(cv, g, base, tip, bend, leaflets, ll, rnd):
    # A pinnate seed-fern frond: an arching midrib with paired leaflets that shrink toward the tip. Leaflets on the lit (upper-left) side are lighter.
    ctrl = ((base[0]+tip[0])/2 + bend[0], (base[1]+tip[1])/2 + bend[1])
    pts = [bez(base, ctrl, tip, i/leaflets) for i in range(leaflets + 1)]
    for i in range(1, leaflets + 1):
        (x0, y0), (x1, y1) = pts[i-1], pts[i]; dx, dy = x1-x0, y1-y0; d = math.hypot(dx, dy) or 1
        nx, ny = -dy/d, dx/d; L = ll * (1 - .75 * i/leaflets) + rnd.random()*.6
        for side in (1, -1):
            lit = (nx*side - ny*side) < 0 or side*ny < 0   # leaflets pointing up or left catch the light
            col = g[3] if lit else g[1]
            ex, ey = x1 + nx*side*L + dx/d*.8, y1 + ny*side*L + dy/d*.8 + .5   # leaflets droop a touch
            cv.line(x1, y1, ex, ey, col); cv.line(x1, y1 + 1, ex, ey + 1, g[2] if lit else g[1])
            if L > 2.2 and lit: cv.set(ex, ey, g[4])
        cv.set(x1, y1, g[2])
    cv.line(base[0], base[1], pts[1][0], pts[1][1], g[2])

def peltate(cv, x, y, r, rnd):
    # Peltaspermum seed organ: an umbrella disc on a stalk with ovules hanging from its underside
    cv.disc(x, y, r, max(1.5, r*.5), SEED[1])
    cv.line(x - r + 1, y, x + r - 1, y, SEED[0])
    for i in range(-r + 1, r, 2): cv.set(x + i - 1, y - 1, SEED[2])
    for i in range(-r + 1, r, 2): cv.line(x + i, y + 2, x + i, y + 4 + (i % 4 == 0), SEED[0]); cv.set(x + i, y + 4 + (i % 4 == 0), SEED[2])

def stalks(cv, x0, y0, x1, y1, c):
    cv.line(x0, y0, x1, y1, c)

def peltaspermum():   # small: a few fine bipinnate Lepidopteris fronds, with branched stalks carrying seed discs
    rnd = random.Random(11); g = ramp("#A8AE62"); cv = Canvas(44, 46); bx, by = 22, 43
    cv.disc(bx, by - 3, 6, 2, g[0])
    for tx, ty, b in ((-19, 8, -4), (19, 9, 4), (-12, 15, -3), (11, 16, 3), (-2, 18, -1)):
        frond(cv, g, (bx + tx*.1, by - 2), (bx + tx, by - 2 - ty), (b*2, -2), 8, 3.2, rnd)
    for tx, ty in ((9, 27), (-8, 31)):   # a stalk curves up from the base and ends under a disc
        n = ty
        for i in range(n + 1):
            t = i / n; x = bx + tx * (t ** 1.6); y = by - 2 - i
            cv.set(x, y, SEED[0]); cv.set(x + 1, y, SEED[1])
        peltate(cv, bx + tx, by - 2 - ty - 3, 4, rnd)
    cv.set(bx, by, TRUNK[1]); cv.set(bx - 1, by, TRUNK[0]); cv.set(bx + 1, by, TRUNK[0])
    return cv.image(g[0])

def comia():   # medium: once-pinnate fronds with narrow separate pinnules, fanned wide and low off a short stem
    rnd = random.Random(23); g = ramp("#8E9654"); cv = Canvas(64, 46); bx, by = 32, 43
    cv.line(bx, by, bx, by - 5, TRUNK[1]); cv.line(bx-1, by, bx-1, by - 4, TRUNK[0]); cv.line(bx+1, by, bx+1, by - 4, TRUNK[2])
    top = (bx, by - 5)
    fr = [(-30, 2, -3), (30, 3, 3), (-26, 9, -7), (27, 10, 7), (-19, 15, -6), (20, 16, 6), (-10, 17, -3), (11, 18, 3)]   # (tip dx, tip rise, bend)
    fr.sort(key=lambda f: -abs(f[0]))
    for tx, ty, b in fr: frond(cv, g, top, (bx + tx, top[1] - ty), (b, -5), 6, 6.5, rnd)
    return cv.image(g[0])

def callistophyton():   # large: a thin scrambling stem that branches from the leaf axils and carries fern-like leaves; no trunk, no crown
    rnd = random.Random(37); g = ramp("#747E48"); cv = Canvas(72, 96); bx, by = 30, 93
    pts = [(bx, by), (bx - 2, by - 12), (bx + 3, by - 24), (bx + 8, by - 36), (bx + 5, by - 48), (bx + 10, by - 60), (bx + 14, by - 72), (bx + 12, by - 84)]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        cv.line(x0, y0, x1, y1, TRUNK[1]); cv.line(x0 - 1, y0, x1 - 1, y1, TRUNK[0])
    for x in range(bx - 3, bx + 4): cv.set(x, by, TRUNK[0])
    # side shoots from the axils: (node, tip dx, tip dy), each carrying a leaf at the end
    sh = [(1, -16, -4), (2, 17, -6), (3, -18, -10), (4, 18, -6), (5, -15, -14), (6, 17, -10)]
    for i, dx, dy in sh:
        x0, y0 = pts[i]; x1, y1 = x0 + dx*.5, y0 + dy*.5
        cv.line(x0, y0, x1, y1 - 2, TRUNK[1])
        frond(cv, g, (x1, y1 - 2), (x0 + dx, y0 + dy + 8), (dx*.15, -9), 7, 7, rnd)   # leaf droops from the shoot tip
    frond(cv, g, pts[-1], (pts[-1][0] + 6, pts[-1][1] - 10), (4, -3), 4, 5, rnd)   # young leaf at the growing tip
    return cv.image(g[0])

out = sys.argv[1] if len(sys.argv) > 1 else "sprites/plants"
for key, fn in (("per-scrubland-small", peltaspermum), ("per-scrubland-medium", comia), ("per-scrubland-large", callistophyton)):
    im = fn(); im.save(f"{out}/{key}.png"); print(key, im.size)
