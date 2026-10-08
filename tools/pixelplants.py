# Draws pixel-art plants to sprites/plants/<LAND key>.png (3/4 view, trunk base at the bottom middle, light from the top left).
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
    # A seed-bearing umbrella disc on a stalk: the mark of Peltaspermum
    cv.line(x, y, x, y + r + 2, SEED[0])
    cv.disc(x, y, r, max(1, r*.55), SEED[1])
    for i in range(int(r*2)): cv.set(x - r + 1 + i, y - 1, SEED[2]) if i % 2 == 0 and r > 1.5 else None
    cv.set(x - r*.5, y - 1, SEED[2]); cv.set(x + r, y, SEED[0])

def peltaspermum():   # small: a low tuft of short fronds, a few seed discs
    rnd = random.Random(11); g = ramp("#A8AE62"); cv = Canvas(40, 36); bx, by = 20, 33
    for d in (-1, 1, -.5, .5, 0):   # back fronds first, so the front ones overlap
        pass
    cv.disc(bx, by - 7, 9, 4, g[0]); cv.disc(bx, by - 8, 7, 3, g[1])
    angles = [(-15, 12, -4), (13, 11, 4), (-9, 17, -2), (7, 16, 3), (-3, 20, 0)]
    for tx, ty, b in angles: frond(cv, g, (bx + tx*.15, by), (bx + tx, by - ty), (b*2, -3), 5, 5, rnd)
    for x, y in ((12, 21), (28, 22)): peltate(cv, x, y, 2, rnd)
    cv.set(bx, by, TRUNK[1]); cv.set(bx - 1, by, TRUNK[0]); cv.set(bx + 1, by, TRUNK[0])
    return cv.image(g[0])

def comia():   # medium: an arching mound of long fronds off a short stem, seed discs among them
    rnd = random.Random(23); g = ramp("#8E9654"); cv = Canvas(56, 52); bx, by = 28, 49
    for h in (3, 4):   # short stem
        pass
    cv.line(bx, by, bx, by - 6, TRUNK[1]); cv.line(bx-1, by, bx-1, by - 5, TRUNK[0]); cv.line(bx+1, by, bx+1, by - 5, TRUNK[2])
    top = (bx, by - 6)
    cv.disc(bx, by - 12, 12, 7, g[0]); cv.disc(bx - 1, by - 13, 9, 5, g[1])
    fr = [(-23, 8, -9), (23, 9, 9), (-17, 21, -6), (17, 22, 6), (-8, 28, -3), (9, 30, 3), (0, 32, 0)]
    fr.sort(key=lambda f: -abs(f[0]))   # sides first, middle on top
    for tx, ty, b in fr: frond(cv, g, top, (bx + tx, top[1] - ty + abs(tx)*.35), (b, -7), 7, 7, rnd)
    for x, y in ((14, 28), (42, 29), (28, 10)): peltate(cv, x, y, 3, rnd)
    return cv.image(g[0])

def callistophyton():   # large: a slim climbing trunk carrying a loose crown of drooping fronds
    rnd = random.Random(37); g = ramp("#747E48"); cv = Canvas(76, 100); bx, by = 38, 97
    path = [(bx, by), (bx - 1, by - 14), (bx + 2, by - 28), (bx, by - 42), (bx - 2, by - 54)]
    for (x0, y0), (x1, y1) in zip(path, path[1:]):
        for dx, c in ((-1, TRUNK[0]), (0, TRUNK[1]), (1, TRUNK[2])): cv.line(x0 + dx, y0, x1 + dx, y1, c)
    for y in range(by - 52, by, 5): cv.set(bx + (y % 3) - 1, y, TRUNK[0])   # leaf scars
    for x in range(bx - 3, bx + 4): cv.set(x, by, TRUNK[0])
    cv.line(bx - 4, by, bx - 1, by - 2, TRUNK[1]); cv.line(bx + 4, by, bx + 1, by - 2, TRUNK[1])   # root flare
    for ox, oy, n in ((-1, 54, 0), (2, 42, 1)):   # lower fronds hang from the trunk
        pass
    # (tip dx, tip dy up, bend): crown fronds from the top, then lower ones that droop down the trunk
    crown = (bx - 2, by - 54)
    cv.disc(crown[0], crown[1] - 2, 17, 8, g[0]); cv.disc(crown[0] - 1, crown[1] - 3, 13, 6, g[1])
    fr = [(-34, -6, -14, 16), (34, -4, 14, 16), (-28, 10, -12, 14), (28, 12, 12, 14), (-16, 22, -7, 12), (17, 24, 7, 12), (-4, 26, -2, 12), (5, 27, 2, 12)]
    fr.sort(key=lambda f: -abs(f[0]))
    for tx, ty, b, n in fr: frond(cv, g, crown, (crown[0] + tx, crown[1] - ty + abs(tx)*.55), (b*.4, -9), n//2 + 1, 9, rnd)
    for sx, sy, tx, ty in ((-1, 42, -22, 24), (2, 32, 24, 16)):   # lower drooping fronds
        base = (bx + sx, by - sy); frond(cv, g, base, (base[0] + tx, base[1] + ty), (tx*.3, -8), 6, 7, rnd)
    for x, y in ((14, 36), (62, 38), (34, 22), (50, 52)): peltate(cv, x, y, 3, rnd)
    return cv.image(g[0])

out = sys.argv[1] if len(sys.argv) > 1 else "sprites/plants"
for key, fn in (("per-scrubland-small", peltaspermum), ("per-scrubland-medium", comia), ("per-scrubland-large", callistophyton)):
    im = fn(); im.save(f"{out}/{key}.png"); print(key, im.size)
