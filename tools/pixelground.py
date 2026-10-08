# Draws seamless pixel-art ground tiles to sprites/ground/<biome>-<exhibit|park>.png, laid over the biome color (BIOMES[x].color / .park), 0.125 m per pixel.
# SUPERSEDED by tools/pixelground_flat.py (flat style); running this writes the old two-tile files (scrubland-exhibit/park.png), which nothing uses any more.
# Scrubland: red-ochre and pale sand patches (dithered), cracked hardpan, pebbles, short hardpan cracks and small clusters of sandstone and dark stones (nothing modern, so it suits any era), like the Utah reference.
# The tiles wrap, so features near an edge continue on the other side. Usage: python3 -I tools/pixelground.py [outdir]
import sys, os, random, math
from PIL import Image

def hexc(h): return tuple(int(h[i:i+2], 16) for i in (1, 3, 5))
OCHRE, OCHRE2 = hexc("#C99A62"), hexc("#B98456")
PALE, SAND = hexc("#E0CC96"), hexc("#CDB77C")
DARK, CRACK = hexc("#8A7448"), hexc("#7A6540")
STONE = [hexc(c) for c in ("#6C6254", "#8F8472", "#B5AA94")]
STRAW, OLIVE, OLIVE2 = hexc("#D9CC8A"), hexc("#8C8A52"), hexc("#6E6C3C")
RED = [hexc(c) for c in ("#5E2B22", "#8F4128", "#BF5F34", "#DE8449")]   # the rocks' sandstone
BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]

def tile(size, seed, tufts, shrubs, cracks, pebbles, cell=18, oc=.62, pl=.27):
    rnd = random.Random(seed); im = Image.new("RGBA", (size, size), (0, 0, 0, 0)); px = im.load()
    put = lambda x, y, c: px.__setitem__((x % size, y % size), c + (255,))
    g = max(4, size // cell); grid = [[rnd.random() for _ in range(g)] for _ in range(g)]   # periodic low-frequency noise: soft patches of soil color
    def vn(x, y):
        fx, fy = x / size * g, y / size * g; ix, iy = int(fx), int(fy); tx, ty = fx - ix, fy - iy
        a = grid[iy % g][ix % g] * (1 - tx) + grid[iy % g][(ix + 1) % g] * tx; b = grid[(iy + 1) % g][ix % g] * (1 - tx) + grid[(iy + 1) % g][(ix + 1) % g] * tx
        return a * (1 - ty) + b * ty
    for y in range(size):
        for x in range(size):
            n, d = vn(x, y), BAYER[y % 4][x % 4] / 16
            if n > oc and d < (n - oc) * 1.8: put(x, y, OCHRE2 if d < (n - oc) * .8 else OCHRE)   # warm red patches
            elif n < pl and d < (pl - n) * 1.6: put(x, y, PALE)                                      # bleached sand
            elif pl < n < .5 and d < .07: put(x, y, SAND)
            elif rnd.random() < .006: put(x, y, DARK)                                                # grit
    for _ in range(cracks):   # lots of short cracks, a few pixels each, some with a tiny fork: no long feature that could show the tile repeating
        x, y = rnd.randrange(size), rnd.randrange(size); dx, dy = rnd.choice((-1, 1)), rnd.choice((0, 1, 1))
        for i in range(rnd.randint(3, 8)):
            put(x, y, CRACK); x += dx if rnd.random() < .75 else 0; y += dy if rnd.random() < .55 else rnd.choice((-1, 0, 1))
            if i > 1 and rnd.random() < .22: put(x + dx, y + rnd.choice((-1, 1)), CRACK); put(x + 2 * dx, y + rnd.choice((-1, 1)), CRACK)
    for _ in range(pebbles):   # little stones: a lit top-left pixel, a body, a dark base
        x, y = rnd.randrange(size), rnd.randrange(size); w = rnd.choice((2, 3, 3, 4))
        for i in range(w): put(x + i, y, STONE[1]); put(x + i, y + 1, STONE[0])
        put(x, y - 1 + 1, STONE[2]); put(x + w, y + 1, DARK) if w > 2 else None
    for _ in range(shrubs):   # a few small stones lying together: sandstone or dark, each lit top left with a dark base
        x, y = rnd.randrange(size), rnd.randrange(size)
        for _ in range(rnd.randint(2, 4)):
            sx, sy = x + rnd.randint(-5, 5), y + rnd.randint(-2, 2); w, h = rnd.randint(3, 7), rnd.randint(2, 4); pal = RED if rnd.random() < .65 else [STONE[0], STONE[0], STONE[1], STONE[2]]
            for yy in range(h):
                for xx in range(w):
                    if (xx == 0 or xx == w - 1) and (yy == 0 or yy == h - 1): continue   # round the corners
                    lit = -(xx / w) * .5 - (yy / h) * .8 + 1.2 + (BAYER[(sy + yy) % 4][(sx + xx) % 4] / 16 - .5) * .6
                    put(sx + xx, sy + yy, pal[max(0, min(3, int((lit + .75) * 2.1)))])
            for xx in range(1, w + 2): put(sx + xx, sy + h, DARK)   # the foot, a little shadow
    return im

out = sys.argv[1] if len(sys.argv) > 1 else "sprites/ground"
os.makedirs(out, exist_ok=True)
# the exhibit floor repeats every 18 m (144 px); the park ground every 32 m (256 px), a little sparser
for name, im in (("scrubland-exhibit", tile(144, 7, 0, 3, 34, 20)), ("scrubland-park", tile(256, 8, 0, 8, 100, 56, cell=20, oc=.68, pl=.25))):
    im.save(f"{out}/{name}.png"); print(name, im.size)
