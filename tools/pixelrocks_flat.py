# Draws the rocks and boulders of every biome but tropical (tools/pixelrocks_tropical.py) to sprites/rocks/<type>-<biome>-<n>.png, in the Dimetrodon's flat style seen 3/4.
# Each stone is a squashed ellipsoid sunk into the ground and chipped by flat cuts at random angles (body()), so it is a faceted lump, not a stack of tiers; clusters are a few
# overlapping bodies. Each pixel is ray cast into the bodies, and its face picks one flat tone from the light (top left): top / hi / mid / lo / deep, each cut face nudged a little
# so neighbouring facets read apart. Sandstone (strata) is colored in level beds with a darker line between them. Structured detail only: rows of short dashes, cracks with a lit edge, pits,
# a lighter rim at the top left, a darker one along the bottom, and a 1 px near-black outline tinted to the stone, like the plants. Colors are pulled 30% toward grey (desat).
# Deterministic (fixed seeds). The script prints each picture's [width, height]: put them in ROCK_SPRITES in js/data.js, then run tools/spritehit.py and tools/packsprites.py.
# Fern Prairie's rocks are copies of scrubland's: cp sprites/rocks/*-scrubland-* to the matching *-fern-* names.
# Usage: python3 -I tools/pixelrocks_flat.py [outdir]
import sys, os, random, math
from PIL import Image

def mix(a, b, t): return tuple(round(x * (1 - t) + y * t) for x, y in zip(a, b))
def desat(c, t=.3):   # pull a color toward its own grey, so the rocks sit in the ground instead of on it
    l = c[0] * .299 + c[1] * .587 + c[2] * .114; return mix(c, (l, l, l), t)
def ink(c): return mix(c, (0, 0, 0), .72)   # the outline: near black, tinted to the stone it wraps
def ramp(base): return {"top": mix(base, (255, 255, 255), .3), "hi": mix(base, (255, 255, 255), .1), "mid": base, "lo": mix(base, (0, 0, 0), .22), "deep": mix(base, (0, 0, 0), .4)}
SAND = ramp((178, 84, 24))     # rust orange, from the Dimetrodon family
PALE = ramp((205, 160, 118))   # pale cream stone
BASALT = ramp((82, 76, 72))    # dark lava
SLATE = ramp((88, 108, 104))   # wet grey-green stone
SILT = ramp((128, 112, 92))    # warm grey-brown, mud-stained
MOSS = ramp((88, 108, 104)); MOSS["top"] = mix((97, 111, 34), (255, 255, 255), .14); MOSS["hi"] = mix(MOSS["hi"], (97, 111, 34), .35)   # slate with a moss-green cap, from the Dimetrodon's olive
GREY = ramp((134, 138, 140))   # temperate: ROCK_STONE grey
WARM = ramp((124, 116, 104))   # grey-brown, tannin stained
MOSSY = ramp((134, 138, 140)); MOSSY["top"] = mix((84, 122, 70), (255, 255, 255), .12); MOSSY["hi"] = mix(MOSSY["hi"], (84, 122, 70), .3)   # grey with a moss cap
LITTER = ramp((128, 130, 128)); LITTER["top"] = mix((140, 98, 52), (255, 255, 255), .1); LITTER["hi"] = mix(LITTER["hi"], (140, 98, 52), .25)   # grey with a leaf-litter cap
BUFF = ramp((190, 150, 108))   # desert: sandstone strata, buff / rust red / cream, from ROCK_STONE desert
RUST = ramp((168, 88, 50)); CREAM = ramp((222, 198, 150)); VARNISH = ramp((92, 74, 64))
FIELD = ramp((142, 145, 136))   # grassland: fieldstone, ROCK_STONE grey-green
LIME = ramp((208, 202, 180))    # pale limestone
FSTAIN = ramp((142, 145, 136)); FSTAIN["top"] = mix((142, 145, 136), (176, 150, 90), .35); FSTAIN["hi"] = mix(FSTAIN["hi"], (176, 150, 90), .2)   # fieldstone with an iron-stained, sun-bleached cap
FMOSS = ramp((142, 145, 136)); FMOSS["top"] = mix((140, 160, 80), (255, 255, 255), .12); FMOSS["hi"] = mix(FMOSS["hi"], (140, 160, 80), .3)   # fieldstone with a lichen-green cap
SLAB = ramp((127, 135, 128))    # tundra: frost-shattered grey slab, ROCK_STONE grey-green
DSLAB = ramp((92, 98, 98))      # darker frost-split slate
PGRAN = ramp((170, 172, 166))   # pale granite
LICHY = ramp((127, 135, 128)); LICHY["top"] = mix((170, 176, 120), (255, 255, 255), .1); LICHY["hi"] = mix(LICHY["hi"], (170, 176, 120), .3)   # slab with a yellow-green lichen cap
LICHO = ramp((127, 135, 128)); LICHO["top"] = mix((196, 146, 84), (255, 255, 255), .08); LICHO["hi"] = mix(LICHO["hi"], (196, 146, 84), .28)   # slab with an orange lichen cap
LICHG = ramp((96, 102, 100)); LICHG["top"] = mix((206, 208, 190), (255, 255, 255), .1); LICHG["hi"] = mix(LICHG["hi"], (206, 208, 190), .3)   # dark slate with a pale grey-white lichen cap
GRAN = ramp((95, 106, 115))     # boreal: dark wet granite, ROCK_STONE blue-grey
WETG = ramp((70, 80, 88))       # darker, rain-soaked granite
BPALE = ramp((138, 146, 150))   # paler weathered granite
BMOSS = ramp((95, 106, 115)); BMOSS["top"] = mix((78, 120, 72), (255, 255, 255), .1); BMOSS["hi"] = mix(BMOSS["hi"], (78, 120, 72), .35)   # granite under a thick moss cap
BSTAIN = ramp((95, 106, 115)); BSTAIN["top"] = mix((95, 106, 115), (150, 104, 60), .4); BSTAIN["hi"] = mix(BSTAIN["hi"], (150, 104, 60), .2)   # granite with a rusty tannin-stained top

K = .62   # ground depth to screen height
LT = (-.62, -.18, .76); _l = math.sqrt(sum(c * c for c in LT)); LT = tuple(c / _l for c in LT)   # light: left, a little behind, and above

def body(rnd, cx, cy, a, b, c, n=12, jit=.2, mesa=0., blocky=0., lean=0.):
    # One stone: a squashed ellipsoid (a wide, b deep, c tall, sunk a quarter into the ground) cut by n flat planes at random angles, each cutting in up to jit of the way,
    # so it is a chipped, faceted lump. blocky (0 to 1) turns the cuts toward upright walls (sandstone, basalt); mesa (0 to 1) shaves a flat top; lean slides the top sideways.
    C = c * 1.3; ctr = (cx, cy, -c * .3); P = []
    def sup(n): return math.sqrt((a * n[0]) ** 2 + (b * n[1]) ** 2 + (C * n[2]) ** 2)
    def plane(az, el, cut):
        n = (math.cos(el) * math.cos(az), math.cos(el) * math.sin(az), math.sin(el)); n = (n[0] - lean * n[2] * .3, n[1], n[2]); l = math.sqrt(sum(v * v for v in n)); n = tuple(v / l for v in n)
        P.append((n, sup(n) * (1 - cut), ctr, rnd.uniform(-.16, .16) if cut else 0))   # each cut face shaded a touch apart from its neighbours
    for i in range(16): plane(i * math.pi / 8, 0, 0)   # an uncut ring keeps the base rounded and the body closed
    for i in range(12): plane(i * math.pi / 6 + .26, .7, 0)
    plane(0, math.pi / 2, 0)
    a0 = rnd.random() * 6.283
    for i in range(n):
        az = a0 + (i + rnd.random() * .7) * 6.283 / n
        el = rnd.uniform(0, .35) if rnd.random() < blocky else rnd.uniform(.15, 1.25)
        plane(az, el, jit * rnd.uniform(.3, 1))
    if mesa: plane(rnd.uniform(0, 6.283), math.pi / 2 - rnd.uniform(0, .12), mesa * rnd.uniform(.25, .4))
    return P

def render(seed, bodies, pal, cracks=0, pits=None, strata=0, dashes=True):
    # bodies: [(cx, cy, a, b, c, options)], cy toward the viewer. strata: height of sandstone bands in px (0 for none); pal: a ramp, or a list of ramps for colored bands.
    rnd = random.Random(seed); Bs = [body(rnd, *bd[:5], **(bd[5] if len(bd) > 5 else {})) for bd in bodies]
    x0 = int(min(bd[0] - bd[2] for bd in bodies)) - 6; x1 = int(max(bd[0] + bd[2] for bd in bodies)) + 6
    y0 = int(min((bd[1] - bd[3]) * K - bd[4] * 1.1 for bd in bodies)) - 6; y1 = int(max((bd[1] + bd[3]) * K for bd in bodies)) + 6
    W, H = x1 - x0, y1 - y0; g = [[None] * W for _ in range(H)]; kind = [[0] * W for _ in range(H)]; fid = [[None] * W for _ in range(H)]
    ramps = pal if isinstance(pal, list) else [pal]; ph = rnd.random() * 6.283
    bend = lambda X: .7 * math.sin(X * .09 + ph) + X * .04   # beds run nearly level, dipping gently
    for py in range(H):
        for px in range(W):
            X, Y = x0 + px + .5, y0 + py + .5; best = None
            for bi, Pl in enumerate(Bs):
                lo, hi, hp = Y / K, 1e9, None
                for pi, (nv, d, ct, _) in enumerate(Pl):
                    co = nv[1] + nv[2] * K; rhs = d - nv[0] * (X - ct[0]) + nv[1] * ct[1] + nv[2] * (Y + ct[2])
                    if abs(co) < 1e-9:
                        if rhs < 0: lo = 1e9
                    elif co > 0:
                        if rhs / co < hi: hi, hp = rhs / co, pi
                    elif rhs / co > lo: lo = rhs / co
                if hp is not None and hi >= lo and (best is None or hi > best[0]): best = (hi, bi, hp)
            if not best: continue
            t, bi, pi = best; nv = Pl_n = Bs[bi][pi][0]; z = t * K - Y
            lit = sum(u * v for u, v in zip(nv, LT)) + Bs[bi][pi][3]
            key = "top" if nv[2] > .8 else "hi" if lit > .5 else "mid" if lit > -.05 else "lo" if lit > -.45 else "deep"
            R = ramps[int((z + bend(X)) // strata) % len(ramps)] if strata and len(ramps) > 1 else ramps[0]
            if strata and key != "top" and (z + bend(X)) % strata < 1: key = {"hi": "mid", "mid": "lo", "lo": "deep", "deep": "deep"}[key]   # a darker line between beds
            g[py][px] = R[key]; kind[py][px] = 2 if key == "top" else 1; fid[py][px] = (bi, pi)
    P0 = ramps[0]
    if dashes:
        for y in range(H):   # rows of short dashes on the lit and front walls
            for x in range(W):
                if kind[y][x] == 1 and g[y][x] in (P0["hi"], P0["mid"]) and y % 4 == 2 and (x + (y // 4) * 3) % 9 < 2: g[y][x] = P0["lo"] if g[y][x] == P0["mid"] else P0["mid"]
    for _ in range(cracks):   # a crack down the walls, dark with a lit pixel on its left
        x = rnd.randint(W // 3, 2 * W // 3); y = next((yy for yy in range(H) if kind[yy][x] == 1), H); n_ = rnd.randint(H // 4, H // 2)
        for _ in range(n_):
            if 0 <= x < W and y < H and kind[y][x] == 1:
                g[y][x] = ink(P0["deep"])
                if x and kind[y][x - 1] == 1: g[y][x - 1] = P0["hi"]
            y += 1; x += rnd.choice((-1, 0, 0, 1))
    for _ in range(W // 12 if pits is None else pits):   # pits: a dark pixel pair with a lit one above
        x, y = rnd.randint(W // 5, 4 * W // 5), rnd.randint(H // 3, H - 6)
        if 0 < y and x + 1 < W and kind[y][x] == 1 and kind[y][x + 1] == 1 and kind[y - 1][x] == 1:
            g[y][x] = g[y][x + 1] = P0["deep"]; g[y - 1][x] = P0["hi"]
    for y in range(H):   # drop lone pixels
        for x in range(W):
            if g[y][x] is not None and sum(1 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= x + dx < W and 0 <= y + dy < H and g[y + dy][x + dx] is not None) <= 1: g[y][x] = None
    out = [r[:] for r in g]   # the silhouette edge: lighter on the top and left, darker along the bottom
    for y in range(H):
        for x in range(W):
            c = g[y][x]
            if c is None: continue
            up = g[y - 1][x] if y else None; dn = g[y + 1][x] if y < H - 1 else None; lf = g[y][x - 1] if x else None
            if dn is None: out[y][x] = mix(c, (0, 0, 0), .3)
            elif up is None or lf is None: out[y][x] = mix(c, (255, 255, 255), .16)
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for y in range(H):
        for x in range(W):
            if out[y][x]: im.putpixel((x, y), desat(out[y][x]) + (255,))
            else:   # a 1 px outline around the silhouette, like the plants
                nb = [g[y + dy][x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= x + dx < W and 0 <= y + dy < H and g[y + dy][x + dx]]
                if nb: im.putpixel((x, y), ink(desat(min(nb, key=sum))) + (255,))
    bb = im.getbbox(); return im.crop((bb[0] - 3, bb[1] - 3, bb[2] + 3, bb[3] + 3))   # 4 px from the stone (the outline is 1) on every side, as before

def shapes():
    S = {}
    # scrubland: red sandstone in level beds, blocky with flat tops (like Snow Canyon, Utah), a pale cream stone and dark basalt
    S["boulder-scrubland-1"] = render(121, [(0, 0, 30, 22, 30, dict(n=12, jit=.25, blocky=.7, mesa=.5))], SAND, cracks=1, strata=5)
    S["boulder-scrubland-2"] = render(122, [(0, 0, 14, 12, 42, dict(n=10, jit=.3, blocky=.6, lean=.4))], SAND, cracks=1, strata=5)
    S["boulder-scrubland-3"] = render(123, [(-16, 5, 18, 14, 20, dict(n=10, jit=.25, blocky=.6, mesa=.4)), (14, -5, 22, 16, 32, dict(n=12, jit=.25, blocky=.7, mesa=.5))], SAND, cracks=1, strata=5)
    S["boulder-scrubland-4"] = render(124, [(0, 0, 26, 20, 30, dict(n=9, jit=.35, blocky=.8))], BASALT, cracks=2, dashes=False)
    S["rock-scrubland-1"] = render(221, [(0, 0, 19, 12, 9, dict(n=9, jit=.3, blocky=.5, mesa=.4))], SAND, strata=4)
    S["rock-scrubland-2"] = render(222, [(0, 0, 13, 10, 13, dict(n=9, jit=.3, blocky=.5))], SAND, strata=4)
    S["rock-scrubland-3"] = render(223, [(0, 0, 12, 10, 20, dict(n=9, jit=.3, blocky=.6, lean=-.3))], SAND, cracks=1, strata=4)
    S["rock-scrubland-4"] = render(224, [(0, 0, 11, 9, 11, dict(n=12, jit=.15))], PALE)
    S["rock-scrubland-5"] = render(225, [(0, 0, 14, 10, 12, dict(n=8, jit=.35, blocky=.8))], BASALT, dashes=False)
    S["rock-scrubland-6"] = render(226, [(2, 1, 15, 11, 8, dict(n=9, jit=.25, blocky=.5, mesa=.4)), (-5, -4, 8, 6, 14, dict(n=8, jit=.3, blocky=.6))], SAND, strata=4)
    # wetland: low, rounded, water-worn slate, silt and mossy stones
    S["boulder-wetland-1"] = render(131, [(0, 0, 28, 20, 24, dict(n=14, jit=.14))], SLATE, cracks=1)
    S["boulder-wetland-2"] = render(132, [(-15, 4, 17, 13, 16, dict(n=12, jit=.14)), (13, -4, 21, 15, 24, dict(n=14, jit=.14))], MOSS)
    S["boulder-wetland-3"] = render(133, [(0, 0, 24, 17, 20, dict(n=13, jit=.18))], SILT, cracks=1)
    S["rock-wetland-1"] = render(231, [(0, 0, 17, 11, 8, dict(n=12, jit=.14))], SLATE)
    S["rock-wetland-2"] = render(232, [(0, 0, 12, 9, 11, dict(n=12, jit=.15))], MOSS, dashes=False)
    S["rock-wetland-3"] = render(233, [(0, 0, 14, 10, 10, dict(n=12, jit=.18))], SILT)
    S["rock-wetland-4"] = render(234, [(0, 0, 10, 8, 9, dict(n=10, jit=.16))], SLATE, dashes=False)
    S["rock-wetland-5"] = render(235, [(-6, 1, 9, 7, 7, dict(n=10, jit=.15)), (6, -1, 11, 8, 11, dict(n=11, jit=.15))], SILT, dashes=False)
    # temperate: grey stone, rounded with a few clean breaks, moss and leaf litter caps
    S["boulder-temperate-1"] = render(141, [(0, 0, 27, 20, 28, dict(n=13, jit=.2))], GREY, cracks=1)
    S["boulder-temperate-2"] = render(142, [(-15, 4, 17, 13, 16, dict(n=12, jit=.18)), (13, -4, 21, 15, 26, dict(n=13, jit=.18))], MOSSY)
    S["boulder-temperate-3"] = render(143, [(0, 0, 13, 11, 36, dict(n=11, jit=.24, lean=.3))], WARM, cracks=1)
    S["boulder-temperate-4"] = render(144, [(0, 0, 24, 18, 22, dict(n=12, jit=.2))], LITTER, cracks=1)
    S["rock-temperate-1"] = render(241, [(0, 0, 17, 11, 9, dict(n=11, jit=.2))], GREY)
    S["rock-temperate-2"] = render(242, [(0, 0, 12, 9, 12, dict(n=11, jit=.18))], MOSSY, dashes=False)
    S["rock-temperate-3"] = render(243, [(0, 0, 14, 10, 12, dict(n=11, jit=.2))], LITTER)
    S["rock-temperate-4"] = render(244, [(0, 0, 11, 8, 10, dict(n=10, jit=.22))], WARM, dashes=False)
    S["rock-temperate-5"] = render(245, [(-6, 1, 9, 7, 7, dict(n=10, jit=.2)), (6, -1, 11, 8, 11, dict(n=11, jit=.2))], GREY, dashes=False)
    # desert: buff, rust and cream sandstone beds, blocky mesas, and dark desert-varnished stone
    D = [BUFF, RUST, CREAM]
    S["boulder-desert-1"] = render(151, [(0, 0, 30, 22, 30, dict(n=12, jit=.22, blocky=.75, mesa=.55))], D, cracks=1, strata=5)
    S["boulder-desert-2"] = render(152, [(0, 0, 14, 12, 42, dict(n=10, jit=.28, blocky=.7, mesa=.3))], [RUST, CREAM, BUFF], cracks=1, strata=5)
    S["boulder-desert-3"] = render(153, [(-16, 5, 18, 14, 20, dict(n=10, jit=.25, blocky=.7, mesa=.5)), (14, -5, 22, 16, 32, dict(n=12, jit=.25, blocky=.7, mesa=.5))], [BUFF, CREAM, RUST], cracks=1, strata=5)
    S["boulder-desert-4"] = render(154, [(0, 0, 26, 20, 30, dict(n=9, jit=.32, blocky=.6))], VARNISH, cracks=2, dashes=False)
    S["rock-desert-1"] = render(251, [(0, 0, 19, 12, 9, dict(n=9, jit=.28, blocky=.6, mesa=.4))], [BUFF, CREAM], strata=4)
    S["rock-desert-2"] = render(252, [(0, 0, 13, 10, 13, dict(n=9, jit=.28, blocky=.6))], [RUST, BUFF, CREAM], strata=4)
    S["rock-desert-3"] = render(253, [(0, 0, 12, 10, 20, dict(n=9, jit=.28, blocky=.6, lean=.3))], D, cracks=1, strata=4)
    S["rock-desert-4"] = render(254, [(0, 0, 11, 9, 11, dict(n=12, jit=.16))], CREAM)
    S["rock-desert-5"] = render(255, [(0, 0, 14, 10, 12, dict(n=8, jit=.32, blocky=.5))], VARNISH, dashes=False)
    S["rock-desert-6"] = render(256, [(-6, 1, 9, 7, 7, dict(n=9, jit=.25, blocky=.6)), (6, -1, 11, 8, 11, dict(n=9, jit=.25, blocky=.6, mesa=.4))], [BUFF, RUST], strata=4)
    # grassland: rounded fieldstone and pale limestone, half sunk in the turf, with lichen and iron-stained caps
    S["boulder-grassland-1"] = render(161, [(0, 0, 26, 20, 24, dict(n=14, jit=.15))], FIELD, cracks=1)
    S["boulder-grassland-2"] = render(162, [(-14, 3, 15, 12, 16, dict(n=12, jit=.15)), (12, -4, 19, 14, 22, dict(n=13, jit=.15))], FMOSS)
    S["boulder-grassland-3"] = render(163, [(0, 0, 15, 12, 26, dict(n=12, jit=.2, blocky=.3))], LIME, cracks=1)
    S["boulder-grassland-4"] = render(164, [(0, 0, 22, 14, 20, dict(n=13, jit=.16))], FSTAIN, cracks=1)
    S["rock-grassland-1"] = render(261, [(0, 0, 16, 10, 9, dict(n=12, jit=.15))], FIELD)
    S["rock-grassland-2"] = render(262, [(0, 0, 11, 8, 10, dict(n=11, jit=.18))], FSTAIN, dashes=False)
    S["rock-grassland-3"] = render(263, [(0, 0, 13, 9, 11, dict(n=11, jit=.2, blocky=.3))], LIME)
    S["rock-grassland-4"] = render(264, [(0, 0, 10, 8, 9, dict(n=11, jit=.16))], FMOSS, dashes=False)
    S["rock-grassland-5"] = render(265, [(-6, 1, 8, 6, 6, dict(n=10, jit=.16)), (6, -1, 10, 7, 9, dict(n=11, jit=.16))], FIELD, dashes=False)
    S["rock-grassland-6"] = render(266, [(0, 0, 14, 7, 7, dict(n=11, jit=.18))], LIME, dashes=False)
    # tundra: frost-shattered slabs, low and angular (few deep cuts), with lichen-colored caps
    S["boulder-tundra-1"] = render(171, [(0, 0, 27, 17, 22, dict(n=8, jit=.4, blocky=.4, mesa=.4))], LICHY, cracks=2)
    S["boulder-tundra-2"] = render(172, [(-15, 3, 17, 11, 13, dict(n=7, jit=.4, mesa=.4)), (13, -4, 20, 13, 18, dict(n=8, jit=.4, blocky=.3, mesa=.3))], SLAB, cracks=1)
    S["boulder-tundra-3"] = render(173, [(0, 0, 14, 10, 30, dict(n=8, jit=.4, blocky=.5, lean=-.3))], LICHG, cracks=2)
    S["boulder-tundra-4"] = render(174, [(0, 0, 30, 14, 14, dict(n=8, jit=.38, mesa=.5))], LICHO, cracks=1)
    S["rock-tundra-1"] = render(271, [(0, 0, 16, 9, 9, dict(n=7, jit=.4, mesa=.4))], SLAB)
    S["rock-tundra-2"] = render(272, [(0, 0, 11, 8, 11, dict(n=7, jit=.42))], LICHY, dashes=False)
    S["rock-tundra-3"] = render(273, [(0, 0, 15, 6, 7, dict(n=7, jit=.4, mesa=.5))], DSLAB)
    S["rock-tundra-4"] = render(274, [(0, 0, 10, 8, 10, dict(n=7, jit=.42))], LICHO, dashes=False)
    S["rock-tundra-5"] = render(275, [(-6, 1, 8, 6, 6, dict(n=6, jit=.4)), (6, -1, 10, 7, 10, dict(n=7, jit=.4))], PGRAN, dashes=False)
    S["rock-tundra-6"] = render(276, [(0, 0, 13, 7, 9, dict(n=7, jit=.4, mesa=.4))], LICHG, dashes=False)
    # boreal: rounded, dark, rain-wet granite (glacial erratics: many shallow cuts) with moss caps
    S["boulder-boreal-1"] = render(181, [(0, 0, 27, 20, 28, dict(n=16, jit=.13))], GRAN, cracks=1)
    S["boulder-boreal-2"] = render(182, [(-15, 3, 17, 12, 18, dict(n=14, jit=.13)), (13, -4, 20, 14, 26, dict(n=15, jit=.13))], BMOSS)
    S["boulder-boreal-3"] = render(183, [(0, 0, 14, 11, 36, dict(n=14, jit=.15, lean=.2))], WETG, cracks=1)
    S["boulder-boreal-4"] = render(184, [(0, 0, 25, 15, 20, dict(n=15, jit=.13))], BSTAIN, cracks=1)
    S["rock-boreal-1"] = render(281, [(0, 0, 16, 10, 10, dict(n=13, jit=.13))], GRAN)
    S["rock-boreal-2"] = render(282, [(0, 0, 11, 8, 11, dict(n=13, jit=.14))], BMOSS, dashes=False)
    S["rock-boreal-3"] = render(283, [(0, 0, 13, 9, 11, dict(n=13, jit=.14))], BPALE)
    S["rock-boreal-4"] = render(284, [(0, 0, 10, 8, 10, dict(n=12, jit=.14))], WETG, dashes=False)
    S["rock-boreal-5"] = render(285, [(-6, 1, 8, 6, 7, dict(n=12, jit=.13)), (6, -1, 10, 7, 10, dict(n=12, jit=.13))], BMOSS, dashes=False)
    S["rock-boreal-6"] = render(286, [(0, 0, 14, 7, 8, dict(n=13, jit=.14))], BSTAIN, dashes=False)
    return S

out = sys.argv[1] if len(sys.argv) > 1 else "sprites/rocks"
os.makedirs(out, exist_ok=True)
for k, im in shapes().items(): im.save(f"{out}/{k}.png"); print(k, list(im.size))
