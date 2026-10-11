# Draws the tropical rocks and boulders: sprites/rocks/{boulder,rock}-tropical-<n>.png, in the same flat style as tools/pixelrocks_flat.py but NOT built from stacked polygon tiers, which made every
# stone look like a stepped cake. Each stone here is a rounded, lopsided lump: an outline from a few low harmonics (so every stone is its own shape), a flatter bottom, a domed height field with
# smooth bumps, and flat tone bands cut from the light (top-left): top / hi / mid / lo / deep, no outline, no dithering. Structured detail only: rows of short dashes on the shaded bands, a few
# cracks and pits, a lighter silhouette edge at the top left and a darker one along the bottom and right, and on the mossy ones a flat moss cap where the stone faces up.
# Palettes: pale river grey, mossy river stone, warm tannin-stained stone, and dark volcanic (kept light enough to read on the near-black jungle floor, #002104). Clusters are single stones overlapped.
# Deterministic (fixed seeds). The script prints each picture's [width, height]: put them in ROCK_SPRITES.tropical in js/data.js in the same order.
# Usage: python3 -I tools/pixelrocks_tropical.py [outdir]
import sys, os, random, math
from PIL import Image

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

def stone(seed, w, h, pal, lump=.16, squash=0., moss=0., cracks=0, pits=2, bumps=.1, lean=0.):
    # w x h is the stone's size in pixels; lump how uneven the outline is; squash flattens the base; moss 0 to 1 how much of the up-facing side is moss; lean shifts the peak sideways (-1 to 1)
    rnd = random.Random(seed); W, H = w + 8, h + 8; cx, cy = W / 2, H / 2 + 1
    harm = [(k, lump / (k - 1) ** 1.1 * rnd.uniform(.5, 1.3), rnd.random() * 6.283) for k in range(2, 6)]
    big = noise2(rnd, (W, H), 4); small = noise2(rnd, (W, H), 9); mossn = noise2(rnd, (W, H), 5)
    hf = [[0.0] * W for _ in range(H)]; inside = [[False] * W for _ in range(H)]
    for y in range(H):
        for x in range(W):
            dx = (x + .5 - cx) / (w / 2); dy = (y + .5 - cy) / (h / 2)
            p = 2.0 if dy < 0 else 2.0 + 1.6 * (1 - squash * .3)   # a squarer, flatter base
            r = (abs(dx) ** p + abs(dy) ** p) ** (1 / p); th = math.atan2(dy, dx)
            R = 1 + sum(a * math.cos(k * th + ph) for k, a, ph in harm)
            d = r / R
            if d < 1:
                inside[y][x] = True; t = max(0, 1 - d * d)
                hf[y][x] = (t ** .55) * (1 + bumps * (big(x, y) - .5) * 4 + bumps * .6 * (small(x, y) - .5) * 4) + lean * dx * .25 * t
    sc = h * .45   # height in pixels, so the slopes read
    g = [[None] * W for _ in range(H)]; band = [[2] * W for _ in range(H)]
    for y in range(H):
        for x in range(W):
            if not inside[y][x]: continue
            hx0 = hf[y][x - 1] if x and inside[y][x - 1] else hf[y][x]; hx1 = hf[y][x + 1] if x < W - 1 and inside[y][x + 1] else hf[y][x]
            hy0 = hf[y - 1][x] if y and inside[y - 1][x] else hf[y][x]; hy1 = hf[y + 1][x] if y < H - 1 and inside[y + 1][x] else hf[y][x]
            gx, gy = (hx1 - hx0) / 2 * sc, (hy1 - hy0) / 2 * sc; nl = math.sqrt(gx * gx + gy * gy + 1); nx, ny, nz = -gx / nl, -gy / nl, 1 / nl
            s = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]
            k = 0 if s > .86 else 1 if s > .68 else 2 if s > .46 else 3 if s > .24 else 4
            P = pal
            if moss and k <= 1 and mossn(x, y) + (cy - y) / H * .5 > 1 - moss: P = MOSS   # moss only on the up-facing side
            g[y][x] = P[KEYS[k]]; band[y][x] = k
            if k in (2, 3) and y % 4 == 2 and (x + (y // 4) * 3) % 7 < 3: g[y][x] = P[KEYS[k + 1]]   # rows of short dashes on the shaded bands
    for _ in range(cracks):   # a crack: a short wandering line down from near the top
        x = rnd.randint(W // 4, 3 * W // 4); y = int(H * rnd.uniform(.2, .4)); n = rnd.randint(h // 4, h // 2)
        for _ in range(n):
            if 0 <= y < H and 0 <= x < W and g[y][x] is not None and band[y][x] >= 2: g[y][x] = pal["deep"]
            y += 1; x += rnd.choice((-1, 0, 0, 1))
    for _ in range(pits):   # pits: a dark pixel pair with a lit one above
        x, y = rnd.randint(W // 5, 4 * W // 5), rnd.randint(H // 3, 3 * H // 4)
        if 0 < y < H - 1 and x + 1 < W and g[y][x] is not None and g[y][x + 1] is not None and g[y - 1][x] is not None and band[y][x] in (2, 3):
            g[y][x] = pal["deep"]; g[y][x + 1] = pal["deep"]; g[y - 1][x] = pal["hi"]
    for y in range(H):   # drop lone pixels
        for x in range(W):
            if g[y][x] is not None and sum(1 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= x + dx < W and 0 <= y + dy < H and g[y + dy][x + dx] is not None) <= 1: g[y][x] = None
    out = [r[:] for r in g]   # silhouette edge: lighter on the top and left, darker on the bottom and right
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
    S["boulder-tropical-1"] = stone(301, 58, 48, RIVER, lump=0.15, squash=.5, moss=.55, cracks=1, bumps=.14, lean=-.6)                        # big lopsided river stone with a moss cap
    S["boulder-tropical-2"] = stone(302, 38, 46, VOLCANIC, lump=0.20, squash=.2, cracks=2, bumps=.16, lean=.5)                              # tall knuckle of dark lava, leaning right
    S["boulder-tropical-3"] = cluster([(stone(303, 46, 38, SLATE, lump=0.17, moss=.35, cracks=1, bumps=.14), 24, 44), (stone(304, 34, 30, TANNIN, lump=0.18, bumps=.12, lean=-.4), 0, 50)])   # two stones leaning together
    S["boulder-tropical-4"] = stone(305, 64, 30, TANNIN, lump=0.17, squash=.8, moss=.4, cracks=1, bumps=.1, lean=.3)                        # low, wide, flattened boulder
    S["rock-tropical-1"] = stone(311, 30, 22, RIVER, lump=0.18, squash=.4, bumps=.12, lean=-.3)
    S["rock-tropical-2"] = stone(312, 24, 24, VOLCANIC, lump=0.21, bumps=.16, lean=.4, pits=1)
    S["rock-tropical-3"] = stone(313, 34, 20, SLATE, lump=0.17, squash=.6, moss=.5, bumps=.1)
    S["rock-tropical-4"] = stone(314, 22, 17, TANNIN, lump=0.22, bumps=.14, lean=-.5, pits=1)
    S["rock-tropical-5"] = cluster([(stone(315, 22, 18, RIVER, lump=0.20, bumps=.12), 0, 24), (stone(316, 18, 14, VOLCANIC, lump=0.22, bumps=.12), 17, 24), (stone(317, 11, 9, TANNIN, lump=0.22, bumps=.1, pits=0), 11, 28)])   # a small scatter
    S["rock-tropical-6"] = stone(318, 28, 26, SLATE, lump=0.22, squash=.2, moss=.3, bumps=.18, lean=.4, cracks=1)
    return S

out = sys.argv[1] if len(sys.argv) > 1 else "sprites/rocks"
os.makedirs(out, exist_ok=True)
for k, im in shapes().items(): im.save(f"{out}/{k}.png"); print(k, list(im.size), len({p[:3] for p in im.getdata() if p[3]}), "colors")
