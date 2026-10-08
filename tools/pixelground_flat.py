# Draws the seamless scrubland ground tiles in the Dimetrodon's flat, simple style (tools/pixelground.py is the older dithered version): sprites/ground/scrubland-<exhibit|park>.png,
# laid over the biome color (BIOMES.scrubland.color / .park), 0.125 m per pixel. Flat, stair-stepped patches of slightly warmer and paler soil (no dithering), short horizontal
# hardpan dashes in loose rows, little two-tone pebbles and a few small clusters of sandstone and dark stones, each lit on its top row and shaded on its bottom row.
# Nothing modern, so it suits any era. Every feature is small and nothing is long, so the tile doesn't show its repeat; features wrap over the edges. Light is from the top left.
# Usage: python3 -I tools/pixelground_flat.py [outdir]
import sys, os, random
from PIL import Image

def hexc(h): return tuple(int(h[i:i+2], 16) for i in (1, 3, 5))
def mix(a, b, t): return tuple(round(x * (1 - t) + y * t) for x, y in zip(a, b))
WHITE, BLACK = (255, 255, 255), (0, 0, 0)
SAND = {"exhibit": hexc("#BFA96C"), "park": hexc("#C8BC8A")}   # the biome colors in data.js; the patches are mixed from them so the tile sits on its floor
RED = [mix((178, 84, 24), WHITE, .3), (178, 84, 24), mix((178, 84, 24), BLACK, .25)]   # sandstone, top / body / base: the rocks' flat red
DARK = [(110, 102, 94), (82, 76, 72), (58, 53, 50)]   # dark stones, same three rows

def tile(base, size, seed, clusters, dashes, pebbles, cell=11, warm=.6, pale=.32):
    rnd = random.Random(seed); px = {}
    def put(x, y, c): px[(x % size, y % size)] = c
    patch = {"warm": mix(base, (178, 84, 24), .11), "pale": mix(base, (235, 220, 170), .22), "dash": mix(base, BLACK, .3), "grit": mix(base, BLACK, .16)}
    g = max(4, size // cell); grids = [(g, [[rnd.random() for _ in range(g)] for _ in range(g)], .62), (g * 2 + 1, [[rnd.random() for _ in range(g * 2 + 1)] for _ in range(g * 2 + 1)], .38)]   # periodic noise at two scales: where the patches go
    def vn(x, y):
        v = 0
        for g, grid, wt in grids:
            fx, fy = x / size * g, y / size * g; ix, iy = int(fx), int(fy); tx, ty = fx - ix, fy - iy
            a = grid[iy % g][ix % g] * (1 - tx) + grid[iy % g][(ix + 1) % g] * tx; b = grid[(iy + 1) % g][ix % g] * (1 - tx) + grid[(iy + 1) % g][(ix + 1) % g] * tx
            v += wt * (a * (1 - ty) + b * ty)
        return v
    step = 2   # patches are built from 2x2 blocks, so their edges are clean stair steps
    for by in range(0, size, step):
        for bx in range(0, size, step):
            n = vn(bx + 1, by + 1) + ((bx // step * 7 + by // step * 13) % 5 - 2) * .012   # a tiny wobble breaks up straight stair runs
            c = patch["warm"] if n > warm else patch["pale"] if n < pale else None
            if c:
                for dy in range(step):
                    for dx in range(step): put(bx + dx, by + dy, c)
    for _ in range(dashes):   # short dashes of cracked hardpan: mostly horizontal, an odd step down at the end, loosely in rows
        x = rnd.randrange(size); y = rnd.randrange(size // 4) * 4 + rnd.choice((0, 1)); n = rnd.randint(3, 6)
        for i in range(n): put(x + i, y, patch["dash"])
        if rnd.random() < .3: put(x + n, y + 1, patch["dash"])
    for _ in range(size * size // 1800): x, y = rnd.randrange(size), rnd.randrange(size); put(x, y, patch["grit"]); put(x + 1, y, patch["grit"])   # grit
    for _ in range(pebbles):   # a little pebble: a lit top row, a shaded base row, one dark pixel of shadow beside it
        x, y = rnd.randrange(size), rnd.randrange(size); w = rnd.choice((2, 3, 3, 4)); pal = DARK if rnd.random() < .5 else [mix(base, WHITE, .35), mix(base, BLACK, .15), mix(base, BLACK, .38)]
        for i in range(w): put(x + i, y, pal[0]); put(x + i, y + 1, pal[1] if w > 2 and 0 < i < w - 1 else pal[2])
        put(x + w, y + 1, patch["dash"])
    for _ in range(clusters):   # a few small stones lying together: sandstone mostly, some dark, each a lit top row, a body and a shaded base row
        x, y = rnd.randrange(size), rnd.randrange(size)
        for _ in range(rnd.randint(2, 4)):
            sx, sy = x + rnd.randint(-5, 5), y + rnd.randint(-2, 2); w, h = rnd.randint(3, 7), rnd.randint(3, 4); pal = RED if rnd.random() < .65 else DARK
            for yy in range(h):
                for xx in range(w):
                    if (xx == 0 or xx == w - 1) and (yy == 0 or yy == h - 1): continue
                    put(sx + xx, sy + yy, pal[0] if yy == 0 else pal[2] if yy == h - 1 else pal[1])
            for xx in range(1, w + 2): put(sx + xx, sy + h, patch["dash"])   # the foot, a little shadow
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    for (x, y), c in px.items(): im.putpixel((x, y), c + (255,))
    return im

out = sys.argv[1] if len(sys.argv) > 1 else "sprites/ground"
os.makedirs(out, exist_ok=True)
# the exhibit floor repeats every 18 m (144 px); the park ground every 32 m (256 px), a little sparser
for name, im in (("scrubland-exhibit", tile(SAND["exhibit"], 144, 7, 3, 34, 20)), ("scrubland-park", tile(SAND["park"], 256, 8, 8, 100, 56, cell=13, warm=.64, pale=.28))):
    im.save(f"{out}/{name}.png"); print(name, im.size, len({p[:3] for p in im.get_flattened_data() if p[3]}), "colors")
