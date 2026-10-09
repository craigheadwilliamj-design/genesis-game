# Draws the seamless water tiles (wetland swamp; scrubland brackish pool, kept clean: only ripples and glints, no wash blocks, film, silt or twigs) in the Dimetrodon's flat, simple style: sprites/water/wetland.png, 144 px = 18 m (0.125 m a pixel, like the ground tiles), fully opaque,
# used as the #w-wetland pattern behind wetland water (waterSvg in landscape.js; index.html has the pattern). Dark tannin-green water built from small low-contrast details
# so the repeat doesn't show: a fine two-tone wash of deeper and lighter water in 2x2 blocks, a few small patches of algal film, rows of short ripple dashes (a lit top pixel run
# with a darker run under it), tiny sun glints, and silt flecks and little drifting twigs. Nothing modern, no plants. Light is from the top left. Features wrap over the edges.
# Usage: python3 -I tools/pixelwater_flat.py [outdir]
import sys, os, random
from PIL import Image

def mix(a, b, t): return tuple(round(x * (1 - t) + y * t) for x, y in zip(a, b))
WHITE, BLACK = (255, 255, 255), (0, 0, 0)
# one palette per biome: base water, the wash's lighter tint, the film patches' (color, mix share), ripple and glint tints, silt flecks, drifting dashes
PAL = {
    "wetland":   dict(base=(62, 102, 98), lite=(150, 190, 170), film=((120, 150, 80), .6), ripple=(170, 215, 205), glint=(225, 245, 235), silt=(110, 92, 56), twig=(96, 72, 42)),   # swamp water, algal film, twigs
    "scrubland": dict(base=(108, 134, 124), lite=(190, 205, 180), film=((226, 224, 200), .8), ripple=(206, 210, 180), glint=(246, 244, 226), silt=(128, 104, 68), twig=(214, 208, 180), calm=True),   # brackish pool, salt film, pale salt dashes
}

def tile(size, seed, pal):
    BASE = pal["base"]; rnd = random.Random(seed); px = {}
    def put(x, y, c): px[(x % size, y % size)] = c
    deep = mix(BASE, BLACK, .14); lite = mix(BASE, pal["lite"], .1); film = mix(pal["film"][0], BASE, pal["film"][1]); film_hi = mix(film, WHITE, .14)
    ripple_hi = mix(BASE, pal["ripple"], .38); ripple_lo = mix(BASE, BLACK, .3); glint = mix(BASE, pal["glint"], .7); silt = mix(BASE, pal["silt"], .5); twig = mix(pal["twig"], BASE, .15)
    g = 12; grids = [(g, [[rnd.random() for _ in range(g)] for _ in range(g)], .5), (g * 2, [[rnd.random() for _ in range(g * 2)] for _ in range(g * 2)], .5)]
    def vn(x, y, grids=grids):
        v = 0
        for g, grid, wt in grids:
            fx, fy = x / size * g, y / size * g; ix, iy = int(fx), int(fy); tx, ty = fx - ix, fy - iy
            a = grid[iy % g][ix % g] * (1 - tx) + grid[iy % g][(ix + 1) % g] * tx; b = grid[(iy + 1) % g][ix % g] * (1 - tx) + grid[(iy + 1) % g][(ix + 1) % g] * tx
            v += wt * (a * (1 - ty) + b * ty)
        return v
    g2 = 20; grids2 = [(g2, [[rnd.random() for _ in range(g2)] for _ in range(g2)], 1.0)]   # where the algal film gathers
    for y in range(size): 
        for x in range(size): px[(x, y)] = BASE
    for by in range(0, size, 2):
        for bx in range(0, size, 2):
            n = vn(bx + 1, by + 1) + ((bx // 2 * 7 + by // 2 * 13) % 5 - 2) * .02; f = vn(bx + 1, by + 1, grids2)
            c = None if pal.get("calm") else film if f > .8 else deep if n > .64 else lite if n < .34 else None
            if c:
                for dy in range(2):
                    for dx in range(2): put(bx + dx, by + dy, c)
    for (x, y), c in list(px.items()):
        if c == film and px.get((x, (y - 1) % size)) != film: px[(x, y)] = film_hi
    for _ in range(120):   # ripples: a lit run, a darker run under it offset one pixel, in loose rows
        x = rnd.randrange(size); y = rnd.randrange(size // 4) * 4 + rnd.choice((0, 1)); n = rnd.randint(3, 6)
        for i in range(n): put(x + i, y, ripple_hi)
        for i in range(n - 1): put(x + 1 + i, y + 1, ripple_lo)
    for _ in range(36): x, y = rnd.randrange(size), rnd.randrange(size); put(x, y, glint); put(x + 1, y, glint) if rnd.random() < .5 else None   # sun glints
    for _ in range(0 if pal.get("calm") else 320):   # silt flecks
        x, y = rnd.randrange(size), rnd.randrange(size); put(x, y, silt if rnd.random() < .55 else lite)
    for _ in range(0 if pal.get("calm") else 12):   # a little twig drifting: a dark dash with a lit top-left pixel
        x, y = rnd.randrange(size), rnd.randrange(size); n = rnd.randint(4, 7)
        for i in range(n): put(x + i, y + (i // 4), twig)
        put(x, y - 1, mix(twig, WHITE, .3))
    im = Image.new("RGBA", (size, size))
    for (x, y), c in px.items(): im.putpixel((x, y), c + (255,))
    return im

out = sys.argv[1] if len(sys.argv) > 1 else "sprites/water"
os.makedirs(out, exist_ok=True)
for name, seed in (("wetland", 5), ("scrubland", 11)):
    im = tile(144, seed, PAL[name]); im.save(f"{out}/{name}.png"); print(name, im.size, len({p[:3] for p in im.get_flattened_data()}), "colors")
