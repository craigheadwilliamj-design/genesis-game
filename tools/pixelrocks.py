# Draws pixel-art rocks to sprites/rocks/<type>-<biome>-<n>.png (3/4 view, flat base at the bottom, light from the top left).
# Scrubland: red sandstone with banded strata (like Snow Canyon, Utah), a pale cream stone and dark basalt. Each shape is a smoothed polygon (or two) shaded as a dome,
# with strata bands, speckle and cracks added on top. Usage: python3 -I tools/pixelrocks.py [outdir]
import sys, random, math
from PIL import Image

def hexc(h): return tuple(int(h[i:i+2], 16) for i in (1, 3, 5))
SAND  = [hexc(c) for c in ("#5E2B22", "#8F4128", "#BF5F34", "#DE8449", "#F2B06D")]
PALE  = [hexc(c) for c in ("#6B4A3A", "#9C6F55", "#C79A78", "#E3BD9A", "#F4DCBF")]
BASALT = [hexc(c) for c in ("#1E1A1B", "#322C2C", "#4A4241", "#686059", "#8A8076")]
EDGE = {id(SAND): hexc("#3A1915"), id(PALE): hexc("#4A3025"), id(BASALT): hexc("#0F0C0D")}
BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]

def blob(rnd, cx, cy, rx, ry, n, jit, smooth, base):
    # a closed polygon around (cx, cy), rounded by Chaikin cuts, with its bottom flattened at `base`
    a0 = rnd.random() * 6.283; pts = []
    for i in range(n):
        a = a0 + i * 6.283 / n; k = 1 + (rnd.random() * 2 - 1) * jit
        pts.append((cx + math.cos(a) * rx * k, cy + math.sin(a) * ry * k))
    for _ in range(smooth):
        q = []
        for i in range(len(pts)):
            (x0, y0), (x1, y1) = pts[i], pts[(i + 1) % len(pts)]
            q += [(x0 * .75 + x1 * .25, y0 * .75 + y1 * .25), (x0 * .25 + x1 * .75, y0 * .25 + y1 * .75)]
        pts = q
    return [(x, min(y, base)) for x, y in pts]

def inside(pts, x, y):
    c = False
    for i in range(len(pts)):
        (x0, y0), (x1, y1) = pts[i], pts[i - 1]
        if (y0 > y) != (y1 > y) and x < (x1 - x0) * (y - y0) / (y1 - y0) + x0: c = not c
    return c

def make(seed, W, H, polys, ramp, bandH=0, bands=0, cracks=0, light=1.0, speckle=.05, topbonus=1.5, sides=1.4):
    rnd = random.Random(seed); m = [[any(inside(p, x + .5, y + .5) for p in polys) for x in range(W)] for y in range(H)]
    # distance from the edge (two-pass chamfer), then a dome height from it
    INF = 1e9; d = [[0 if not m[y][x] else INF for x in range(W)] for y in range(H)]
    for y in range(H):
        for x in range(W):
            if m[y][x]:
                for dx, dy, c in ((-1, 0, 1), (0, -1, 1), (-1, -1, 1.4), (1, -1, 1.4)):
                    xx, yy = x + dx, y + dy
                    d[y][x] = min(d[y][x], (d[yy][xx] if 0 <= xx < W and 0 <= yy < H else 0) + c)
    for y in range(H - 1, -1, -1):
        for x in range(W - 1, -1, -1):
            if m[y][x]:
                for dx, dy, c in ((1, 0, 1), (0, 1, 1), (1, 1, 1.4), (-1, 1, 1.4)):
                    xx, yy = x + dx, y + dy
                    d[y][x] = min(d[y][x], (d[yy][xx] if 0 <= xx < W and 0 <= yy < H else 0) + c)
    D = max(max(r) for r in d) * .9 or 1
    h = [[math.sqrt(max(0, 1 - (1 - min(d[y][x] / D, 1)) ** 2)) * D * .16 if m[y][x] else 0 for x in range(W)] for y in range(H)]
    g = lambda x, y: h[min(max(y, 0), H - 1)][min(max(x, 0), W - 1)]
    ph = rnd.random() * 6.283; crack = set()
    edges, yy = [], rnd.randint(0, 3)   # strata: random thicknesses down the rock, a slight tilt, each layer its own tone
    while yy < H + 8: edges.append((yy, rnd.choice((-.9, -.45, 0, 0, .35, .6)))); yy += rnd.randint(max(2, bandH - 2), bandH + 3) if bandH else 99
    tilt = (rnd.random() - .5) * .12
    topy = [next((y for y in range(H) if m[y][x]), H) for x in range(W)]   # where each column starts, for the lit top face
    tdep = max(4, H * .26)
    for _ in range(cracks):   # a jagged crack running down from near the top
        x, y = rnd.randint(W // 4, 3 * W // 4), rnd.randint(H // 5, H // 3)
        for _ in range(rnd.randint(H // 4, H // 2)):
            crack.add((x, y)); y += 1; x += rnd.choice((-1, 0, 0, 1))
    out = Image.new("RGBA", (W, H), (0, 0, 0, 0)); px = out.load()
    for y in range(H):
        for x in range(W):
            if not m[y][x]: continue
            hx, hy = (g(x + 1, y) - g(x - 1, y)) / 2, (g(x, y + 1) - g(x, y - 1)) / 2
            lit = (.6 * hx + .8 * hy) * 1.6 / (D * .16) * D * .12 + .5   # roughly 0 (dark) to 1 (lit)
            idx = 1.7 + (lit - .5) * 3.0 * light + (.5 - x / W) * sides
            if bandH:
                yb = y + tilt * (x - W / 2) + .5 * math.sin(x * .13 + ph); face = min(1, max(0, (y - topy[x]) / tdep - .3))   # no strata on the top face
                e, t = next(((e, t) for e, t in reversed(edges) if e <= yb), (-9, 0))
                idx += bands * t * face + (.9 * face if int(yb) == e else 0)   # each layer its own tone, with a lit edge along its top
            idx += max(0, 1 - (y - topy[x]) / tdep) * topbonus   # the top face catches the light
            if d[y][x] < 2.2 and y > H * .6: idx -= .5   # shaded foot
            idx += (BAYER[y % 4][x % 4] / 16 - .5) * .7 + (rnd.random() - .5) * speckle * 6
            if (x, y) in crack: idx = 0
            px[x, y] = ramp[max(0, min(4, int(round(idx))))] + (255,)
    # the outline, a little darker than the darkest tone
    o = Image.new("RGBA", (W, H), (0, 0, 0, 0)); op = o.load()
    for y in range(H):
        for x in range(W):
            if px[x, y][3] == 0 and any(0 <= x+dx < W and 0 <= y+dy < H and px[x+dx, y+dy][3] for dx, dy in ((1,0),(-1,0),(0,1),(0,-1))): op[x, y] = EDGE[id(ramp)] + (255,)
    o.alpha_composite(out); return o

def poly(rnd, pts, jag=1.0):
    # an outline from hand-placed corners: each edge gets a nudged midpoint so the sides aren't ruler-straight
    q = []
    for i in range(len(pts)):
        (x0, y0), (x1, y1) = pts[i], pts[(i + 1) % len(pts)]
        q += [(x0, y0), ((x0 + x1) / 2 + (rnd.random() - .5) * 2 * jag, (y0 + y1) / 2 + (rnd.random() - .5) * 2 * jag)]
    return q

def shapes():
    def one(seed, W, H, parts, ramp, **kw):
        r = random.Random(seed); return make(seed, W, H, [poly(r, p, kw.pop("jag", 1.0)) for p in parts], ramp, **kw)
    S = {}
    # boulders: big, blocky. Corners are (x, y) in pixels with y down; the flat base sits at the bottom.
    S["boulder-scrubland-1"] = one(121, 70, 50, [[(3,47),(5,37),(10,31),(12,23),(21,17),(35,14),(50,15),(58,21),(60,30),(66,36),(67,47)]], SAND, bandH=5, bands=1.1, cracks=1)    # a broad butte
    S["boulder-scrubland-2"] = one(122, 52, 64, [[(8,61),(9,41),(13,29),(15,15),(24,5),(33,8),(37,21),(44,31),(46,45),(47,61)]], SAND, bandH=6, bands=1.1, cracks=1)               # a tall fin
    S["boulder-scrubland-3"] = one(123, 80, 50, [[(3,47),(4,33),(10,25),(26,21),(35,25),(37,47)], [(28,47),(30,29),(36,18),(52,11),(66,15),(74,27),(76,47)]], SAND, bandH=5, bands=1.1, cracks=1)   # two blocks
    S["boulder-scrubland-4"] = one(124, 62, 54, [[(4,51),(7,39),(5,27),(14,17),(26,10),(42,8),(54,17),(58,31),(57,51)]], BASALT, light=1.2, speckle=.09, cracks=2, topbonus=1.1)      # dark lava block
    # rocks: small
    S["rock-scrubland-1"] = one(221, 42, 26, [[(2,23),(4,15),(12,9),(30,8),(38,13),(40,23)]], SAND, bandH=3, bands=1.1, jag=.8)                                                  # a low slab
    S["rock-scrubland-2"] = one(222, 32, 28, [[(3,25),(4,13),(10,6),(22,5),(28,12),(29,25)]], SAND, bandH=4, bands=1.0, jag=.8)                                                   # a squat block
    S["rock-scrubland-3"] = one(223, 36, 34, [[(3,31),(6,20),(4,12),(14,4),(26,6),(32,16),(33,31)]], SAND, bandH=4, bands=1.1, cracks=1, jag=.9)                                   # an angular chunk
    S["rock-scrubland-4"] = one(224, 28, 24, [[(3,21),(4,12),(11,5),(20,6),(25,13),(25,21)]], PALE, bandH=3, bands=.9, jag=.7)                                                     # a small pale stone
    S["rock-scrubland-5"] = one(225, 34, 26, [[(3,23),(5,13),(13,6),(26,7),(31,15),(31,23)]], BASALT, light=1.2, speckle=.09, topbonus=1.1, jag=.8)                                # a dark chunk
    S["rock-scrubland-6"] = one(226, 32, 34, [[(2,31),(3,20),(10,16),(24,15),(30,22),(30,31)], [(8,19),(9,10),(14,3),(22,4),(26,11),(25,19)]], SAND, bandH=3, bands=1.1, jag=.7)     # two stacked stones
    return S

out = sys.argv[1] if len(sys.argv) > 1 else "sprites/rocks"
import os; os.makedirs(out, exist_ok=True)
for k, im in shapes().items(): im.save(f"{out}/{k}.png"); print(k, im.size)
