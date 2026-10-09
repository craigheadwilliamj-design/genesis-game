# (Wetland rocks, the wet slate, silt and mossy stones, are at the bottom of shapes(): lower and rounder than the scrubland strata, from the same render().)
# Draws the scrubland rocks and boulders in the Dimetrodon's flat, simple style (the same stack of strata as tools/pixelrocks.py, which is the older dithered, outlined version):
# every face is one flat tone (a lit top, a lit left wall, a base front wall, a shaded right wall, a darker band under each ledge), no outline, no dithering.
# Detail is structured: a lighter silhouette edge at the top left, a darker one along the bottom and right, rows of short dashes on the walls, a few cracks.
# Light comes from the top left. Same strata layouts and seeds as before, so the shapes and sizes match ROCK_SPRITES in data.js (check it when a size changes).
# Usage: python3 -I tools/pixelrocks_flat.py [outdir]
import sys, os, random, math
from PIL import Image, ImageDraw

def mix(a, b, t): return tuple(round(x * (1 - t) + y * t) for x, y in zip(a, b))
def ramp(base): return {"top": mix(base, (255, 255, 255), .3), "hi": mix(base, (255, 255, 255), .1), "mid": base, "lo": mix(base, (0, 0, 0), .22), "deep": mix(base, (0, 0, 0), .4)}
SAND = ramp((178, 84, 24))     # rust orange, from the Dimetrodon family
PALE = ramp((205, 160, 118))   # pale cream stone
BASALT = ramp((82, 76, 72))    # dark lava
SLATE = ramp((88, 108, 104))   # wet grey-green stone
SILT = ramp((128, 112, 92))    # warm grey-brown, mud-stained
MOSS = ramp((88, 108, 104)); MOSS["top"] = mix((97, 111, 34), (255, 255, 255), .14); MOSS["hi"] = mix(MOSS["hi"], (97, 111, 34), .35)   # slate with a moss-green cap, from the Dimetrodon's olive
WALL = ("hi", "mid", "lo", "deep")
K = .62   # ground depth to screen height
LIGHT = (-.7, -.35)

def foot(rnd, cx, cy, rx, ry, n, jit, jag=1.0):
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
    cx, cy, rx, ry, n, jit, layers = spec; base = foot(rnd, cx, cy, rx, ry, n, jit); out = []; z = 0
    for h, s, dx, dy in layers:
        pts = [(cx + (x - cx) * s + dx + (rnd.random() - .5) * .8, cy + (y - cy) * s + dy + (rnd.random() - .5) * .5) for x, y in base]
        out.append({"pts": pts, "z0": z, "z1": z + h, "shift": rnd.choice((-1, 0, 0, 0, 1))}); z += h
    return out

def render(seed, towers, pal, cracks=0, bands=1):
    rnd = random.Random(seed); layers = []
    for sp in sorted(towers, key=lambda t: t[1]): layers.append(tower(rnd, sp))
    allp = [(x, y, L["z1"]) for T in layers for L in T for x, y in L["pts"]]
    minx, maxx = min(p[0] for p in allp), max(p[0] for p in allp); front = max(p[1] for p in allp) * K; top = min(p[1] * K - p[2] for p in allp)
    W, H = int(math.ceil(maxx - minx)) + 8, int(math.ceil(front - top)) + 8; ox, oy = 4 - minx, H - 4 - front
    sx = lambda x: x + ox; sy = lambda y, z: y * K - z + oy
    g = [[None] * W for _ in range(H)]; kind = [[0] * W for _ in range(H)]
    def mask(poly):
        m = Image.new("L", (W, H), 0); ImageDraw.Draw(m).polygon(poly, fill=255); return m.load()
    for T in layers:
        for ti, L in enumerate(T):
            pts, z0, z1 = L["pts"], L["z0"], L["z1"]; cxm = sum(p[0] for p in pts) / len(pts); cym = sum(p[1] for p in pts) / len(pts); last = ti == len(T) - 1
            quads = []
            for i in range(len(pts)):
                (x0, y0), (x1, y1) = pts[i], pts[(i + 1) % len(pts)]; ex, ey = x1 - x0, y1 - y0; d = math.hypot(ex, ey) or 1; nx, ny = ey / d, -ex / d
                if nx * ((x0 + x1) / 2 - cxm) + ny * ((y0 + y1) / 2 - cym) < 0: nx, ny = -nx, -ny
                quads.append(((y0 + y1) / 2, (x0, y0, x1, y1), nx, ny))
            for _, (x0, y0, x1, y1), nx, ny in sorted(quads):
                q = [(sx(x0), sy(y0, z0)), (sx(x1), sy(y1, z0)), (sx(x1), sy(y1, z1)), (sx(x0), sy(y0, z1))]; m = mask(q)
                lit = -(nx * LIGHT[0] + ny * LIGHT[1]); base = 0 if lit > .45 else 1 if lit > -.2 else 2
                tone = min(3, max(0, base + L["shift"] * bands)); face = pal[WALL[tone]]; dash = pal[WALL[min(3, tone + 1)]]
                for y in range(max(0, int(min(p[1] for p in q))), min(H, int(max(p[1] for p in q)) + 1)):
                    for x in range(max(0, int(min(p[0] for p in q))), min(W, int(max(p[0] for p in q)) + 1)):
                        if not m[x, y]: continue
                        g[y][x] = face; kind[y][x] = 1
                        if tone < 3 and y % 4 == 2 and (x + (y // 4) * 3) % 7 < 3: g[y][x] = dash   # rows of short dashes, offset row to row
            cap = [(sx(x), sy(y, z1)) for x, y in pts]; m = mask(cap); xs = [p[0] for p in cap]; ys = [p[1] for p in cap]
            for y in range(max(0, int(min(ys))), min(H, int(max(ys)) + 1)):
                for x in range(max(0, int(min(xs))), min(W, int(max(xs)) + 1)):
                    if m[x, y]: g[y][x] = pal["top"]; kind[y][x] = 2
            if not last:   # the layer above leaves a darker band on this ledge, to its right and front
                nxt = [(sx(x) + 2, sy(y, T[ti + 1]["z1"]) + 1.5) for x, y in T[ti + 1]["pts"]]; nm = mask(nxt)
                for y in range(H):
                    for x in range(W):
                        if nm[x, y] and kind[y][x] == 2 and g[y][x] is not None: g[y][x] = mix(pal["top"], (0, 0, 0), .2)
    for _ in range(cracks):
        x = rnd.randint(W // 4, 3 * W // 4); y = int(H * .3)
        while y < H - 4:
            if 0 <= x < W and kind[y][x] == 1: g[y][x] = pal["deep"]
            y += 1; x += rnd.choice((-1, 0, 0, 1))
    for y in range(H):   # polygon corners can leave a lone pixel sticking out; drop any pixel with one filled neighbour or none
        for x in range(W):
            if g[y][x] is not None and sum(1 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= x + dx < W and 0 <= y + dy < H and g[y + dy][x + dx] is not None) <= 1: g[y][x] = None
    out = [r[:] for r in g]   # the silhouette edge: lighter on the top and left, darker on the bottom and right
    for y in range(H):
        for x in range(W):
            c = g[y][x]
            if c is None: continue
            up = g[y - 1][x] if y else None; dn = g[y + 1][x] if y < H - 1 else None; lf = g[y][x - 1] if x else None; rt = g[y][x + 1] if x < W - 1 else None
            if dn is None or (rt is None and y % 2 == 0): out[y][x] = mix(c, (0, 0, 0), .3)
            elif up is None or (lf is None and y % 2 == 0): out[y][x] = mix(c, (255, 255, 255), .16)
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for y in range(H):
        for x in range(W):
            if out[y][x]: im.putpixel((x, y), out[y][x] + (255,))
    return im

def shapes():
    S = {}
    S["boulder-scrubland-1"] = render(121, [(0, 0, 30, 22, 6, .14, [(8, 1, 0, 0), (7, .96, .5, 0), (6, .93, .8, 0), (8, .88, 1, 0), (5, .78, 1.5, .3)])], SAND, cracks=1)
    S["boulder-scrubland-2"] = render(122, [(0, 0, 13, 11, 6, .16, [(6, 1, 0, 0), (5, .97, .6, 0), (6, .93, 1.2, 0), (5, .9, 1.8, 0), (6, .84, 2.6, 0), (5, .76, 3.5, 0), (4, .64, 4.5, 0), (4, .45, 5.5, 0)])], SAND, cracks=1)
    S["boulder-scrubland-3"] = render(123, [(-16, 5, 18, 14, 6, .14, [(6, 1, 0, 0), (6, .95, .3, 0), (5, .9, .6, 0), (5, .8, 1, 0)]), (14, -5, 22, 16, 6, .14, [(7, 1, 0, 0), (6, .97, .4, 0), (6, .93, .8, 0), (6, .88, 1.2, 0), (5, .8, 1.6, 0), (4, .65, 2, 0)])], SAND, cracks=1)
    S["boulder-scrubland-4"] = render(124, [(0, 0, 26, 20, 5, .2, [(10, 1, 0, 0), (9, .97, .6, 0), (8, .9, 1.2, 0), (6, .72, 2, 0)])], BASALT, cracks=2, bands=0)
    S["rock-scrubland-1"] = render(221, [(0, 0, 19, 12, 6, .14, [(5, 1, 0, 0), (4, .9, .5, 0)])], SAND)
    S["rock-scrubland-2"] = render(222, [(0, 0, 13, 10, 5, .14, [(6, 1, 0, 0), (5, .9, .4, 0), (3, .7, .6, 0)])], SAND)
    S["rock-scrubland-3"] = render(223, [(0, 0, 12, 10, 5, .16, [(7, 1, 0, 0), (6, .92, .5, 0), (5, .8, 1, 0), (3, .55, 1.5, 0)])], SAND, cracks=1)
    S["rock-scrubland-4"] = render(224, [(0, 0, 11, 9, 6, .12, [(5, 1, 0, 0), (4, .9, .3, 0), (3, .7, .5, 0)])], PALE)
    S["rock-scrubland-5"] = render(225, [(0, 0, 14, 10, 5, .18, [(7, 1, 0, 0), (5, .82, .6, 0)])], BASALT, bands=0)
    S["rock-scrubland-6"] = render(226, [(0, 0, 15, 11, 6, .12, [(5, 1, 0, 0), (4, .95, .2, 0), (5, .55, -3, -1), (4, .5, -3.5, -1), (2, .35, -3.5, -1)])], SAND)
    S["boulder-wetland-1"] = render(131, [(0, 0, 28, 20, 7, .1, [(7, 1, 0, 0), (6, .96, .4, 0), (6, .9, .8, 0), (5, .78, 1.2, 0), (3, .55, 1.6, 0)])], SLATE, cracks=1)
    S["boulder-wetland-2"] = render(132, [(-15, 4, 17, 13, 6, .12, [(5, 1, 0, 0), (5, .94, .3, 0), (4, .84, .6, 0)]), (13, -4, 21, 15, 7, .1, [(6, 1, 0, 0), (6, .96, .4, 0), (5, .9, .8, 0), (5, .8, 1.2, 0), (3, .6, 1.5, 0)])], MOSS, cracks=0)
    S["boulder-wetland-3"] = render(133, [(0, 0, 24, 17, 6, .14, [(6, 1, 0, 0), (6, .97, .5, 0), (5, .9, 1, 0), (4, .72, 1.6, 0)])], SILT, cracks=1)
    S["rock-wetland-1"] = render(231, [(0, 0, 17, 11, 7, .1, [(5, 1, 0, 0), (4, .88, .4, 0)])], SLATE)
    S["rock-wetland-2"] = render(232, [(0, 0, 12, 9, 6, .12, [(5, 1, 0, 0), (5, .9, .4, 0), (3, .65, .6, 0)])], MOSS, bands=0)
    S["rock-wetland-3"] = render(233, [(0, 0, 14, 10, 6, .14, [(5, 1, 0, 0), (4, .94, .3, 0), (4, .72, .6, 0)])], SILT)
    S["rock-wetland-4"] = render(234, [(0, 0, 10, 8, 5, .14, [(4, 1, 0, 0), (4, .9, .3, 0), (3, .7, .5, 0)])], SLATE, bands=0)
    S["rock-wetland-5"] = render(235, [(-6, 1, 9, 7, 5, .12, [(4, 1, 0, 0), (3, .88, .3, 0)]), (6, -1, 11, 8, 6, .12, [(5, 1, 0, 0), (4, .92, .4, 0), (3, .7, .6, 0)])], SILT, bands=0)
    return S

out = sys.argv[1] if len(sys.argv) > 1 else "sprites/rocks"
os.makedirs(out, exist_ok=True)
for k, im in shapes().items(): im.save(f"{out}/{k}.png"); print(k, list(im.size), len({p[:3] for p in im.getdata() if p[3]}), "colors")
