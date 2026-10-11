# (Rebuilt to be seen 3/4: each stone is rings of a rounded dome with a vertical front wall, so it shows a lit top and a shaded front like the other biomes, but with a smooth lopsided outline instead of stepped tiers.)
# Draws the tropical rocks and boulders: sprites/rocks/{boulder,rock}-tropical-<n>.png, in the same flat style as tools/pixelrocks_flat.py but NOT built from stacked polygon tiers, which made every
# stone look like a stepped cake. Each stone here is a rounded, lopsided lump: an outline from a few low harmonics (so every stone is its own shape), a flatter bottom, a domed height field with
# smooth bumps, and flat tone bands cut from the light (top-left): top / hi / mid / lo / deep, no outline, no dithering. Structured detail only: rows of short dashes on the shaded bands, a few
# cracks and pits, a lighter silhouette edge at the top left and a darker one along the bottom and right, and on the mossy ones a flat moss cap where the stone faces up.
# Palettes: pale river grey, mossy river stone, warm tannin-stained stone, and dark volcanic (kept light enough to read on the near-black jungle floor, #002104). Clusters are single stones overlapped.
# Deterministic (fixed seeds). The script prints each picture's [width, height]: put them in ROCK_SPRITES.tropical in js/data.js in the same order.
# Usage: python3 -I tools/pixelrocks_tropical.py [outdir]
import sys, os, random, math
from PIL import Image, ImageDraw

def mix(a, b, t): return tuple(round(x * (1 - t) + y * t) for x, y in zip(a, b))
def ramp(base): return {"top": mix(base, (255, 255, 255), .3), "hi": mix(base, (255, 255, 255), .1), "mid": base, "lo": mix(base, (0, 0, 0), .22), "deep": mix(base, (0, 0, 0), .4)}
RIVER = ramp((120, 128, 124))     # pale river grey with a green cast
TANNIN = ramp((130, 112, 88))     # warm brown, stained by leaf tea
VOLCANIC = ramp((88, 92, 92))     # dark lava stone, still lighter than the floor
SLATE = ramp((98, 118, 112))      # wet grey-green
MOSS = ramp((52, 132, 46))        # the cap color
LIGHT = (-.55, -.6, .58); LL = math.sqrt(sum(c * c for c in LIGHT)); LIGHT = tuple(c / LL for c in LIGHT)
KEYS = ("top", "hi", "mid", "lo", "deep")

def noise2(rnd, size, g):   # smooth value noise, returns f(x, y) over a size[0] x size[1] canvas
    grid = [[rnd.random() for _ in range(g + 2)] for _ in range(g + 2)]
    def f(x, y):
        fx, fy = x / size[0] * g, y / size[1] * g; ix, iy = int(fx), int(fy); tx, ty = fx - ix, fy - iy
        tx, ty = tx * tx * (3 - 2 * tx), ty * ty * (3 - 2 * ty)
        a = grid[iy][ix] * (1 - tx) + grid[iy][ix + 1] * tx; b = grid[iy + 1][ix] * (1 - tx) + grid[iy + 1][ix + 1] * tx
        return a * (1 - ty) + b * ty
    return f

K = .62   # ground depth to screen height, the 3/4 view (the same as tools/pixelrocks_flat.py)
LT = (-.5, .3, .81); _l = math.sqrt(sum(c * c for c in LT)); LT = tuple(c / _l for c in LT)   # light in ground x, ground y (toward the viewer), up: top left, and a little from the front
VIEW = (0, .62, .78)

def stone(seed, w, d, H, pal, lump=.12, moss=0., cracks=0, pits=2, wob=.05, lean=0., m=12, n=36, rim=.0):
    # A rounded, lopsided stone seen 3/4: w wide and d deep on the ground, H tall, built from m rings of a rounded dome (an outline of n points from a few low harmonics, each ring a little
    # different so it is lumpy, and sliding sideways by lean) so it has a real front wall, a rounded shoulder and a lit top. lump: how uneven the outline is; wob: how much each ring drifts;
    # moss: how much of the up-facing side is moss (0 to 1); rim: 0 to 1 lifts a vertical foot of wall (a flatter, blockier base).
    rnd = random.Random(seed)
    harm = [(k, lump / (k - 1) ** 1.1 * rnd.uniform(.6, 1.3), rnd.random() * 6.283) for k in range(2, 6)]
    drift = [(k, wob / (k - 1) * rnd.uniform(.5, 1.2), rnd.random() * 6.283, rnd.uniform(-.5, .5)) for k in range(2, 5)]
    chip = [(k, .028 * rnd.uniform(.6, 1.2), rnd.random() * 6.283, rnd.uniform(1.5, 4)) for k in range(6, 10)]   # small lumps and notches that shift with height
    ang = [i * 6.283 / n for i in range(n)]
    def ring(s, t):   # t 0 (rim) to 1 (top): the outline at scale s, drifting with height
        pts = []
        for a in ang:
            R = 1 + sum(c * math.cos(k * a + ph) for k, c, ph in harm) + t * sum(c * math.cos(k * a + ph + sh * 3) for k, c, ph, sh in drift) + sum(c * math.cos(k * a + ph + t * sh) for k, c, ph, sh in chip)
            pts.append((math.cos(a) * w / 2 * R * s + lean * t * w * .22, math.sin(a) * d / 2 * R * s))
        return pts
    prof = []   # (scale, height, tilt of the surface from vertical) per ring, a quarter ellipse with a short vertical foot
    foot = rim * H * .18
    for j in range(m + 1):
        ph = j / m * math.pi / 2; prof.append((math.cos(ph) ** 1.15, foot + (H - foot) * math.sin(ph) ** .5, ph))
    rings = [ring(sc, j / m) for j, (sc, z, ph) in enumerate(prof)]
    allp = [(x, y, z) for pts, (sc, z, ph) in zip(rings, prof) for x, y in pts]
    minx, maxx = min(p[0] for p in allp), max(p[0] for p in allp); front = max(p[1] for p in allp) * K; top = min(p[1] * K - p[2] for p in allp)
    W, Ht = int(math.ceil(maxx - minx)) + 8, int(math.ceil(front - top + foot)) + 8; ox, oy = 4 - minx, Ht - 4 - front
    sx = lambda x: x + ox; sy = lambda y, z: y * K - z + oy
    big = noise2(rnd, (W, Ht), 5); mossn = noise2(rnd, (W, Ht), 6)
    g = [[None] * W for _ in range(Ht)]; band = [[2] * W for _ in range(Ht)]
    def mask(poly):
        im = Image.new("L", (W, Ht), 0); ImageDraw.Draw(im).polygon(poly, fill=255); return im.load()
    def paint(poly, k, P):
        mk = mask(poly); xs = [p[0] for p in poly]; ys = [p[1] for p in poly]
        for y in range(max(0, int(min(ys))), min(Ht, int(max(ys)) + 1)):
            for x in range(max(0, int(min(xs))), min(W, int(max(xs)) + 1)):
                if mk[x, y]: g[y][x] = P[KEYS[k]]; band[y][x] = k
    if foot:   # the vertical foot first: a wall from the ground up to the first ring
        pass
    cxm = 0; cym = 0
    for j in range(m):
        (s0, z0, p0), (s1, z1, p1) = prof[j], prof[j + 1]; pm = (p0 + p1) / 2; A, B = rings[j], rings[j + 1]
        quads = []
        for i in range(n):
            i2 = (i + 1) % n; mx = (A[i][0] + A[i2][0]) / 2; my = (A[i][1] + A[i2][1]) / 2
            ex, ey = A[i2][0] - A[i][0], A[i2][1] - A[i][1]; dl = math.hypot(ex, ey) or 1; nx, ny = ey / dl, -ex / dl
            if nx * mx + ny * my < 0: nx, ny = -nx, -ny
            c, sn = math.cos(pm) ** .6, math.sin(pm) ** 1.6   # a steeper shoulder than a sphere
            nv = math.sqrt((nx * c) ** 2 + (ny * c) ** 2 + sn * sn); N = (nx * c / nv, ny * c / nv, sn / nv)
            if N[0] * VIEW[0] + N[1] * VIEW[1] + N[2] * VIEW[2] <= 0: continue   # turned away from the viewer
            lit = N[0] * LT[0] + N[1] * LT[1] + N[2] * LT[2]
            quads.append((my, i, lit))
        for my, i, lit in sorted(quads):
            i2 = (i + 1) % n
            q = [(sx(A[i][0]), sy(A[i][1], z0)), (sx(A[i2][0]), sy(A[i2][1], z0)), (sx(B[i2][0]), sy(B[i2][1], z1)), (sx(B[i][0]), sy(B[i][1], z1))]
            k = 0 if lit > .76 else 1 if lit > .56 else 2 if lit > .26 else 3 if lit > -.05 else 4
            qx = sum(p[0] for p in q) / 4; qy = sum(p[1] for p in q) / 4
            if k >= 1 and lit > .3: k = max(0, k - (1 if big(qx, qy) > .62 else 0)) if k > 1 else k   # blotches of lit stone
            P = pal
            if moss and k <= 1 and j >= m * .6 and mossn(qx, qy) > .95 - moss * 1.2: P = MOSS   # moss only up on the shoulder and top
            paint(q, k, P)
    cap = [(sx(x), sy(y, prof[m][1])) for x, y in rings[m]]; paint(cap, 0, pal)   # the flat top
    if moss:
        mk = mask(cap)
        for y in range(Ht):
            for x in range(W):
                if mk[x, y] and mossn(x, y) > .85 - moss * 1.2: g[y][x] = MOSS["top"] if mossn(x, y) > .8 else MOSS["hi"]
    Ht_ = Ht
    for y in range(Ht):   # rows of short dashes on the shaded bands
        for x in range(W):
            if g[y][x] is not None and band[y][x] in (2, 3) and y % 4 == 2 and (x + (y // 4) * 3) % 7 < 3: g[y][x] = pal[KEYS[band[y][x] + 1]] if g[y][x] in (pal["mid"], pal["lo"]) else g[y][x]
    for _ in range(cracks):   # a crack: a short wandering line down the front
        x = rnd.randint(W // 3, 2 * W // 3); y = int(Ht * rnd.uniform(.35, .5)); n_ = rnd.randint(Ht // 5, Ht // 3)
        for _ in range(n_):
            if 0 <= y < Ht and 0 <= x < W and g[y][x] is not None and band[y][x] >= 2: g[y][x] = pal["deep"]
            y += 1; x += rnd.choice((-1, 0, 0, 1))
    for _ in range(pits):   # pits: a dark pixel pair with a lit one above
        x, y = rnd.randint(W // 5, 4 * W // 5), rnd.randint(Ht // 2, 3 * Ht // 4)
        if 0 < y < Ht - 1 and x + 1 < W and g[y][x] is not None and g[y][x + 1] is not None and g[y - 1][x] is not None and band[y][x] in (2, 3):
            g[y][x] = pal["deep"]; g[y][x + 1] = pal["deep"]; g[y - 1][x] = pal["hi"]
    for y in range(Ht):   # drop lone pixels
        for x in range(W):
            if g[y][x] is not None and sum(1 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= x + dx < W and 0 <= y + dy < Ht and g[y + dy][x + dx] is not None) <= 1: g[y][x] = None
    out = [r[:] for r in g]   # silhouette edge: lighter on the top and left, darker on the bottom and right
    for y in range(Ht):
        for x in range(W):
            c = g[y][x]
            if c is None: continue
            up = g[y - 1][x] if y else None; dn = g[y + 1][x] if y < Ht - 1 else None; lf = g[y][x - 1] if x else None; rt = g[y][x + 1] if x < W - 1 else None
            if dn is None or (rt is None and y % 2 == 0): out[y][x] = mix(c, (0, 0, 0), .3)
            elif up is None or (lf is None and y % 2 == 0): out[y][x] = mix(c, (255, 255, 255), .16)
    im = Image.new("RGBA", (W, Ht), (0, 0, 0, 0))
    for y in range(Ht):
        for x in range(W):
            if out[y][x]: im.putpixel((x, y), out[y][x] + (255,))
    return crop(im)

def crop(im):
    bb = im.getbbox(); return im.crop((max(0, bb[0] - 1), max(0, bb[1] - 1), min(im.width, bb[2] + 1), min(im.height, bb[3] + 1)))

def cluster(parts):
    # parts: [(image, x, y)] with y the bottom edge, drawn in the order given (back first); bottoms may differ so stones sit at different depths
    W = max(x + im.width for im, x, y in parts); H = max(y for im, x, y in parts); T = min(y - im.height for im, x, y in parts)
    out = Image.new("RGBA", (W, H - T), (0, 0, 0, 0))
    for im, x, y in parts: out.alpha_composite(im, (x, y - im.height - T))
    return crop(out)

def shapes():
    S = {}
    S["boulder-tropical-1"] = stone(301, 58, 40, 26, RIVER, lump=0.21, moss=.5, cracks=1, wob=0.11, lean=-.5)                       # big lopsided river stone, moss on top
    S["boulder-tropical-2"] = stone(302, 34, 28, 44, VOLCANIC, lump=0.24, cracks=2, wob=0.16, lean=.6, rim=.6)                       # tall knuckle of dark lava, leaning right
    S["boulder-tropical-3"] = cluster([(stone(303, 42, 30, 30, SLATE, lump=0.21, moss=.35, cracks=1, wob=0.13), 22, 44), (stone(304, 32, 24, 22, TANNIN, lump=0.24, wob=0.11, lean=-.4), 0, 50)])   # two stones leaning together
    S["boulder-tropical-4"] = stone(305, 62, 34, 16, TANNIN, lump=0.22, moss=.4, cracks=1, wob=0.09, lean=.3)                        # low, wide, flattened boulder
    S["rock-tropical-1"] = stone(311, 30, 20, 13, RIVER, lump=0.22, wob=0.09, lean=-.3)
    S["rock-tropical-2"] = stone(312, 22, 18, 17, VOLCANIC, lump=0.27, wob=0.14, lean=.4, pits=1)
    S["rock-tropical-3"] = stone(313, 32, 20, 10, SLATE, lump=0.21, moss=.5, wob=0.09)
    S["rock-tropical-4"] = stone(314, 20, 14, 11, TANNIN, lump=0.30, wob=0.13, lean=-.5, pits=1)
    S["rock-tropical-5"] = cluster([(stone(315, 20, 14, 12, RIVER, lump=0.27, wob=0.11), 0, 24), (stone(316, 16, 12, 10, VOLCANIC, lump=0.30, wob=0.11), 16, 24), (stone(317, 10, 8, 6, TANNIN, lump=0.30, wob=0.09, pits=0), 10, 29)])   # a small scatter
    S["rock-tropical-6"] = stone(318, 26, 18, 18, SLATE, lump=0.30, moss=.3, wob=0.16, lean=.4, cracks=1)
    return S

out = sys.argv[1] if len(sys.argv) > 1 else "sprites/rocks"
os.makedirs(out, exist_ok=True)
for k, im in shapes().items(): im.save(f"{out}/{k}.png"); print(k, list(im.size), len({p[:3] for p in im.getdata() if p[3]}), "colors")
