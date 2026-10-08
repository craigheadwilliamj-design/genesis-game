# Draws pixel-art rocks to sprites/rocks/<type>-<biome>-<n>.png in a false-3D 3/4 view: each rock is a stack of strata layers, each an extruded footprint seen from above
# at an angle (K squashes ground depth), so you see a lit top face on every ledge, a front wall and a shaded right-hand side. Light is from the top left.
# SUPERSEDED by tools/pixelrocks_flat.py (flat style); running this overwrites the new rocks with the older dithered, outlined ones.
# Scrubland: red sandstone (like Snow Canyon, Utah), a pale cream stone and dark basalt. Usage: python3 -I tools/pixelrocks.py [outdir]
import sys, os, random, math
from PIL import Image, ImageDraw

def hexc(h): return tuple(int(h[i:i+2], 16) for i in (1, 3, 5))
SAND   = [hexc(c) for c in ("#5E2B22", "#8F4128", "#BF5F34", "#DE8449", "#F2B06D")]
PALE   = [hexc(c) for c in ("#6B4A3A", "#9C6F55", "#C79A78", "#E3BD9A", "#F4DCBF")]
BASALT = [hexc(c) for c in ("#1E1A1B", "#322C2C", "#4A4241", "#686059", "#8A8076")]
EDGE = {id(SAND): hexc("#3A1915"), id(PALE): hexc("#4A3025"), id(BASALT): hexc("#0F0C0D")}
BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]
K = .62   # ground depth to screen height (the game's TILT is .7; a touch flatter keeps the small ones readable)
LIGHT = (-.7, -.35)   # the ground direction the light comes from: left and a little behind

def foot(rnd, cx, cy, rx, ry, n, jit, jag=1.0):
    # a ground outline of n corners around (cx, cy), each edge's midpoint nudged so it isn't ruler-straight
    a0 = rnd.random() * 6.283; pts = []
    for i in range(n):
        a = a0 + i * 6.283 / n; k = 1 + (rnd.random() * 2 - 1) * jit
        pts.append((cx + math.cos(a) * rx * k, cy + math.sin(a) * ry * k))
    q = []
    for i in range(n):
        (x0, y0), (x1, y1) = pts[i], pts[(i + 1) % n]
        q += [(x0, y0), ((x0 + x1) / 2 + (rnd.random() - .5) * 2 * jag, (y0 + y1) / 2 + (rnd.random() - .5) * 2 * jag * .7)]
    return q

def tower(rnd, spec):
    # spec: (cx, cy, rx, ry, n, jit, layers) with layers (height, scale, dx, dy): each layer is the footprint scaled and shifted, so it steps in and leaves a ledge
    cx, cy, rx, ry, n, jit, layers = spec; base = foot(rnd, cx, cy, rx, ry, n, jit); out = []; z = 0
    for h, s, dx, dy in layers:
        pts = [(cx + (x - cx) * s + dx + (rnd.random() - .5) * .8, cy + (y - cy) * s + dy + (rnd.random() - .5) * .5) for x, y in base]
        out.append({"pts": pts, "z0": z, "z1": z + h, "shift": rnd.choice((-.8, -.4, 0, 0, .3, .5))}); z += h
    return out

def render(seed, towers, ramp, bands=1.0, cracks=0, speckle=.05, light=1.0):
    rnd = random.Random(seed); layers = []
    for sp in sorted(towers, key=lambda t: t[1]): layers.append(tower(rnd, sp))   # back towers first
    allp = [(x, y, L["z1"]) for T in layers for L in T for x, y in L["pts"]]
    minx, maxx = min(p[0] for p in allp), max(p[0] for p in allp); front = max(p[1] for p in allp) * K; top = min(p[1] * K - p[2] for p in allp)
    W, H = int(math.ceil(maxx - minx)) + 8, int(math.ceil(front - top)) + 8; ox, oy = 4 - minx, H - 4 - front
    sx = lambda x: x + ox; sy = lambda y, z: y * K - z + oy
    img = [[None] * W for _ in range(H)]; kind = [[0] * W for _ in range(H)]
    gw, gh = W // 3 + 3, H // 3 + 3; grid = [[rnd.random() for _ in range(gw)] for _ in range(gh)]
    def vn(x, y):   # soft blotches about 3 pixels across
        fx, fy = x / 3, y / 3; ix, iy = int(fx), int(fy); tx, ty = fx - ix, fy - iy
        a = grid[iy][ix] * (1 - tx) + grid[iy][ix + 1] * tx; b = grid[iy + 1][ix] * (1 - tx) + grid[iy + 1][ix + 1] * tx
        return a * (1 - ty) + b * ty
    def mask(poly):
        m = Image.new("L", (W, H), 0); ImageDraw.Draw(m).polygon(poly, fill=255); return m.load()
    def put(x, y, idx, k):
        idx += (BAYER[y % 4][x % 4] / 16 - .5) * .7 + (rnd.random() - .5) * speckle * 6
        img[y][x] = idx; kind[y][x] = k
    for T in layers:
        for ti, L in enumerate(T):
            pts, z0, z1 = L["pts"], L["z0"], L["z1"]; hl = z1 - z0; cxm = sum(p[0] for p in pts) / len(pts); cym = sum(p[1] for p in pts) / len(pts)
            quads = []
            for i in range(len(pts)):
                (x0, y0), (x1, y1) = pts[i], pts[(i + 1) % len(pts)]; ex, ey = x1 - x0, y1 - y0; d = math.hypot(ex, ey) or 1; nx, ny = ey / d, -ex / d
                if nx * ((x0 + x1) / 2 - cxm) + ny * ((y0 + y1) / 2 - cym) < 0: nx, ny = -nx, -ny   # point the normal outward
                quads.append(((y0 + y1) / 2, (x0, y0, x1, y1), nx, ny))
            for _, (x0, y0, x1, y1), nx, ny in sorted(quads):
                q = [(sx(x0), sy(y0, z0)), (sx(x1), sy(y1, z0)), (sx(x1), sy(y1, z1)), (sx(x0), sy(y0, z1))]; m = mask(q)
                lit = nx * LIGHT[0] * -1 + ny * LIGHT[1] * -1   # +1 facing the light, -1 facing away
                for y in range(max(0, int(min(p[1] for p in q))), min(H, int(max(p[1] for p in q)) + 1)):
                    for x in range(max(0, int(min(p[0] for p in q))), min(W, int(max(p[0] for p in q)) + 1)):
                        if not m[x, y]: continue
                        u = (x - q[0][0]) / (q[1][0] - q[0][0]) if abs(q[1][0] - q[0][0]) > .5 else .5
                        t = max(0, min(1, (q[0][1] + (q[1][1] - q[0][1]) * u - y) / hl))   # 0 at the foot of the layer, 1 at its top
                        put(x, y, 1.7 + lit * 2.5 * light + L["shift"] * bands - (1 - t) * .6 + (.3 if t > .85 else 0) - (x / W - .5) * 1.1, 1)
            cap = [(sx(x), sy(y, z1)) for x, y in pts]; m = mask(cap); xs = [p[0] for p in cap]; ys = [p[1] for p in cap]; last = ti == len(T) - 1
            for y in range(max(0, int(min(ys))), min(H, int(max(ys)) + 1)):
                for x in range(max(0, int(min(xs))), min(W, int(max(xs)) + 1)):
                    if m[x, y]:
                        r = rnd.random(); tex = (vn(x, y) - .5) * 1.7 - (1.1 if r < .05 else 0) + (.7 if .05 <= r < .09 else 0)   # patches, pits and light grit
                        put(x, y, (3.4 if last else 2.9) + L["shift"] * .4 * bands - ((x - sum(xs) / len(xs)) / W * 2.2) + .15 * light + tex, 2)
            if not last:   # the layer above throws a shadow onto this ledge, to its right and front
                nxt = [(sx(x) + 2.5, sy(y, T[ti + 1]["z1"]) + 1.5) for x, y in T[ti + 1]["pts"]]; nm = mask(nxt)
                for y in range(H):
                    for x in range(W):
                        if nm[x, y] and kind[y][x] == 2 and img[y][x] is not None: img[y][x] -= 1.0
    for _ in range(cracks):   # a jagged crack running down a wall
        x = rnd.randint(W // 4, 3 * W // 4); y = int(top * 0 + H * .25)
        while y < H - 4:
            if 0 <= x < W and kind[y][x] == 1: img[y][x] = 0
            y += 1; x += rnd.choice((-1, 0, 0, 1))
    out = Image.new("RGBA", (W, H), (0, 0, 0, 0)); px = out.load()
    for y in range(H):
        for x in range(W):
            if img[y][x] is not None: px[x, y] = ramp[max(0, min(4, int(round(img[y][x]))))] + (255,)
    o = Image.new("RGBA", (W, H), (0, 0, 0, 0)); op = o.load()
    for y in range(H):
        for x in range(W):
            if px[x, y][3] == 0 and any(0 <= x+dx < W and 0 <= y+dy < H and px[x+dx, y+dy][3] for dx, dy in ((1,0),(-1,0),(0,1),(0,-1))): op[x, y] = EDGE[id(ramp)] + (255,)
    o.alpha_composite(out); return o

def shapes():
    S = {}
    # towers are (cx, cy, rx, ry, corners, jitter, layers); a layer is (height, scale, dx, dy), stacked bottom to top
    S["boulder-scrubland-1"] = render(121, [(0, 0, 30, 22, 6, .14, [(8, 1, 0, 0), (7, .96, .5, 0), (6, .93, .8, 0), (8, .88, 1, 0), (5, .78, 1.5, .3)])], SAND, cracks=1)                    # a broad stepped butte
    S["boulder-scrubland-2"] = render(122, [(0, 0, 13, 11, 6, .16, [(6, 1, 0, 0), (5, .97, .6, 0), (6, .93, 1.2, 0), (5, .9, 1.8, 0), (6, .84, 2.6, 0), (5, .76, 3.5, 0), (4, .64, 4.5, 0), (4, .45, 5.5, 0)])], SAND, cracks=1)   # a tall leaning fin
    S["boulder-scrubland-3"] = render(123, [(-16, 5, 18, 14, 6, .14, [(6, 1, 0, 0), (6, .95, .3, 0), (5, .9, .6, 0), (5, .8, 1, 0)]), (14, -5, 22, 16, 6, .14, [(7, 1, 0, 0), (6, .97, .4, 0), (6, .93, .8, 0), (6, .88, 1.2, 0), (5, .8, 1.6, 0), (4, .65, 2, 0)])], SAND, cracks=1)   # two towers, the near one lower
    S["boulder-scrubland-4"] = render(124, [(0, 0, 26, 20, 5, .2, [(10, 1, 0, 0), (9, .97, .6, 0), (8, .9, 1.2, 0), (6, .72, 2, 0)])], BASALT, bands=.5, cracks=2, light=1.2, speckle=.09)   # a dark angular lava block
    S["rock-scrubland-1"] = render(221, [(0, 0, 19, 12, 6, .14, [(5, 1, 0, 0), (4, .9, .5, 0)])], SAND)                                                                                        # a low slab
    S["rock-scrubland-2"] = render(222, [(0, 0, 13, 10, 5, .14, [(6, 1, 0, 0), (5, .9, .4, 0), (3, .7, .6, 0)])], SAND)                                                                         # a squat block
    S["rock-scrubland-3"] = render(223, [(0, 0, 12, 10, 5, .16, [(7, 1, 0, 0), (6, .92, .5, 0), (5, .8, 1, 0), (3, .55, 1.5, 0)])], SAND, cracks=1)                                              # an angular chunk
    S["rock-scrubland-4"] = render(224, [(0, 0, 11, 9, 6, .12, [(5, 1, 0, 0), (4, .9, .3, 0), (3, .7, .5, 0)])], PALE)                                                                          # a small pale stone
    S["rock-scrubland-5"] = render(225, [(0, 0, 14, 10, 5, .18, [(7, 1, 0, 0), (5, .82, .6, 0)])], BASALT, bands=.5, light=1.2, speckle=.09)                                                    # a dark chunk
    S["rock-scrubland-6"] = render(226, [(0, 0, 15, 11, 6, .12, [(5, 1, 0, 0), (4, .95, .2, 0), (5, .55, -3, -1), (4, .5, -3.5, -1), (2, .35, -3.5, -1)])], SAND)                                   # a block with a smaller one stacked on it
    return S

out = sys.argv[1] if len(sys.argv) > 1 else "sprites/rocks"
os.makedirs(out, exist_ok=True)
for k, im in shapes().items(): im.save(f"{out}/{k}.png"); print(k, list(im.size))
