# (The desert tile, sprites/ground/desert.png, is drawn by desert_tile below: dune sand with wind ripples, pebbles and sandstone chips, same rules.)
# (The temperate tile, sprites/ground/temperate.png, is drawn by temperate_tile below: loam, moss crust and humus flecks, no grass or flowers, same rules.)
# (The wetland tile, sprites/ground/wetland.png, is drawn by wetland_tile below: mud, algae and small shallow pools, same rules.)
# Draws the seamless scrubland ground tiles in the Dimetrodon's flat, simple style (tools/pixelground.py is the older dithered version): sprites/ground/scrubland.png (one tile for exhibits and the park),
# laid over the biome color (BIOMES.scrubland.color, the same as .park), 0.125 m per pixel. Flat, stair-stepped patches of slightly warmer and paler soil (no dithering), short horizontal
# hardpan dashes in loose rows, little two-tone pebbles and a few small clusters of sandstone and dark stones, each lit on its top row and shaded on its bottom row.
# Nothing modern, so it suits any era. Every feature is small and nothing is long, so the tile doesn't show its repeat; features wrap over the edges. Light is from the top left.
# Usage: python3 -I tools/pixelground_flat.py [outdir]
import sys, os, random
from PIL import Image

def hexc(h): return tuple(int(h[i:i+2], 16) for i in (1, 3, 5))
def mix(a, b, t): return tuple(round(x * (1 - t) + y * t) for x, y in zip(a, b))
WHITE, BLACK = (255, 255, 255), (0, 0, 0)
SAND = hexc("#BFA96C")   # BIOMES.scrubland.color in data.js, and its park color too: one floor for exhibits and the park
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

MARSH = hexc("#6F9A7A")   # BIOMES.wetland.color in data.js, and its park color too: one floor for exhibits and the park
def wetland_tile(base, size, seed, pools, flecks, dashes, pebbles):
    # Soggy ground built from many small, low-contrast details so no one feature stands out and the tile's repeat is hidden: a faint two-scale wash of damp and dry,
    # lots of 1 to 3 px flecks of mud and algae, short silt dashes, tiny puddle glints and small shallow puddles (a lit top row, a base row), a few wet pebbles. Nothing modern, no plants.
    rnd = random.Random(seed); px = {}
    def put(x, y, c): px[(x % size, y % size)] = c
    mud = mix(base, (104, 76, 46), .24); wet = mix(base, (70, 60, 40), .16); film = mix(base, (200, 210, 110), .12); silt = mix(base, BLACK, .24); glint = mix(base, (190, 225, 225), .35)
    fleck_mud = mix(base, (104, 76, 46), .4); fleck_film = mix(base, (205, 215, 120), .26)
    water = [mix((86, 140, 150), WHITE, .2), (86, 140, 150), mix((86, 140, 150), BLACK, .28)]
    g = 12; grids = [(g, [[rnd.random() for _ in range(g)] for _ in range(g)], .5), (g * 2, [[rnd.random() for _ in range(g * 2)] for _ in range(g * 2)], .5)]   # fine noise, 6 px cells
    def vn(x, y):
        v = 0
        for g, grid, wt in grids:
            fx, fy = x / size * g, y / size * g; ix, iy = int(fx), int(fy); tx, ty = fx - ix, fy - iy
            a = grid[iy % g][ix % g] * (1 - tx) + grid[iy % g][(ix + 1) % g] * tx; b = grid[(iy + 1) % g][ix % g] * (1 - tx) + grid[(iy + 1) % g][(ix + 1) % g] * tx
            v += wt * (a * (1 - ty) + b * ty)
        return v
    for by in range(0, size, 2):   # the wash: 2x2 blocks, only the extremes of the noise, so patches are small and scattered
        for bx in range(0, size, 2):
            n = vn(bx + 1, by + 1) + ((bx // 2 * 7 + by // 2 * 13) % 5 - 2) * .02
            c = wet if n > .68 else mud if n > .6 else film if n < .32 else None
            if c:
                for dy in range(2):
                    for dx in range(2): put(bx + dx, by + dy, c)
    for _ in range(flecks):   # 1 to 3 px flecks, scattered evenly
        x, y = rnd.randrange(size), rnd.randrange(size); c = fleck_mud if rnd.random() < .6 else fleck_film
        put(x, y, c)
        if rnd.random() < .5: put(x + 1, y, c)
        if rnd.random() < .2: put(x, y + 1, c)
    for _ in range(dashes):   # short silt dashes, 2 to 4 px
        x = rnd.randrange(size); y = rnd.randrange(size // 3) * 3 + rnd.choice((0, 1)); n = rnd.randint(2, 4)
        for i in range(n): put(x + i, y, silt)
    for _ in range(dashes // 2): x, y = rnd.randrange(size), rnd.randrange(size); put(x, y, glint); put(x + 1, y, glint)   # puddle glints
    for _ in range(pools):   # small shallow puddles, 5 to 9 px wide
        x, y = rnd.randrange(size), rnd.randrange(size); w, h = rnd.randint(5, 9), rnd.choice((3, 3, 4))
        for yy in range(h):
            inset = 1 if yy in (0, h - 1) else 0
            for xx in range(inset, w - inset): put(x + xx, y + yy, water[0] if yy == 0 else water[2] if yy == h - 1 else water[1])
        for xx in range(1, w + 1): put(x + xx, y + h, silt)
    for _ in range(pebbles):
        x, y = rnd.randrange(size), rnd.randrange(size); w = rnd.choice((2, 2, 3)); pal = DARK if rnd.random() < .5 else [mix(base, WHITE, .3), mix(base, BLACK, .15), mix(base, BLACK, .38)]
        for i in range(w): put(x + i, y, pal[0]); put(x + i, y + 1, pal[2])
        put(x + w, y + 1, silt)
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    for (x, y), c in px.items(): im.putpixel((x, y), c + (255,))
    return im

LOAM = hexc("#7DAA68")   # BIOMES.temperate.color in data.js, and its park color too: one floor for exhibits and the park
def temperate_tile(base, size, seed, flecks, dashes, pebbles):
    # Forest-floor loam built from many small, low-contrast details so the repeat is hidden: a faint two-scale wash of mossy green and damp brown humus, lots of 1 to 3 px flecks of humus
    # and moss, short litter dashes, a few small pebbles (lit top row, shaded base). No grass, flowers or modern plants, so it suits any era from the Devonian on.
    rnd = random.Random(seed); px = {}
    def put(x, y, c): px[(x % size, y % size)] = c
    moss = mix(base, (70, 140, 70), .2); humus = mix(base, (96, 84, 52), .26); damp = mix(base, BLACK, .1); litter = mix(base, (120, 96, 50), .5); dash = mix(base, BLACK, .26)
    fleck_h = mix(base, (96, 84, 52), .45); fleck_m = mix(base, (150, 200, 100), .3)
    g = 12; grids = [(g, [[rnd.random() for _ in range(g)] for _ in range(g)], .5), (g * 2, [[rnd.random() for _ in range(g * 2)] for _ in range(g * 2)], .5)]
    def vn(x, y):
        v = 0
        for g, grid, wt in grids:
            fx, fy = x / size * g, y / size * g; ix, iy = int(fx), int(fy); tx, ty = fx - ix, fy - iy
            a = grid[iy % g][ix % g] * (1 - tx) + grid[iy % g][(ix + 1) % g] * tx; b = grid[(iy + 1) % g][ix % g] * (1 - tx) + grid[(iy + 1) % g][(ix + 1) % g] * tx
            v += wt * (a * (1 - ty) + b * ty)
        return v
    for by in range(0, size, 2):   # the wash: 2x2 blocks, only the extremes of the noise
        for bx in range(0, size, 2):
            n = vn(bx + 1, by + 1) + ((bx // 2 * 7 + by // 2 * 13) % 5 - 2) * .02
            c = humus if n > .72 else damp if n > .65 else moss if n < .3 else None
            if c:
                for dy in range(2):
                    for dx in range(2): put(bx + dx, by + dy, c)
    for _ in range(flecks):
        x, y = rnd.randrange(size), rnd.randrange(size); c = fleck_h if rnd.random() < .55 else fleck_m
        put(x, y, c)
        if rnd.random() < .5: put(x + 1, y, c)
        if rnd.random() < .2: put(x, y + 1, c)
    for _ in range(dashes):   # short litter dashes, 2 to 4 px, some in a dried-leaf brown
        x = rnd.randrange(size); y = rnd.randrange(size // 3) * 3 + rnd.choice((0, 1)); n = rnd.randint(2, 4); c = litter if rnd.random() < .4 else dash
        for i in range(n): put(x + i, y, c)
    for _ in range(pebbles):
        x, y = rnd.randrange(size), rnd.randrange(size); w = rnd.choice((2, 2, 3)); pal = DARK if rnd.random() < .4 else [mix(base, WHITE, .3), mix(base, BLACK, .15), mix(base, BLACK, .38)]
        for i in range(w): put(x + i, y, pal[0]); put(x + i, y + 1, pal[2])
        put(x + w, y + 1, dash)
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    for (x, y), c in px.items(): im.putpixel((x, y), c + (255,))
    return im

SANDY = hexc("#DFC48A")   # BIOMES.desert.color in data.js, and its park color too: one floor for exhibits and the park
def desert_tile(base, size, seed, flecks, ripples, pebbles, chips):
    # Dune sand built from small, low-contrast details so the repeat is hidden: a faint two-scale wash of pale and warm sand, 1 to 3 px flecks, short wind ripples (a lit top row, a shaded
    # row under and to the right), a few pebbles and tiny sandstone chips (lit top row, shaded base). No plants, so it suits any era.
    rnd = random.Random(seed); px = {}
    def put(x, y, c): px[(x % size, y % size)] = c
    pale = mix(base, (250, 238, 200), .3); warm = mix(base, (190, 120, 60), .16); lit = mix(base, WHITE, .34); shade = mix(base, (150, 100, 50), .3)
    fleck_d = mix(base, (150, 100, 50), .38); fleck_l = mix(base, WHITE, .4)
    g = 12; grids = [(g, [[rnd.random() for _ in range(g)] for _ in range(g)], .5), (g * 2, [[rnd.random() for _ in range(g * 2)] for _ in range(g * 2)], .5)]
    def vn(x, y):
        v = 0
        for g, grid, wt in grids:
            fx, fy = x / size * g, y / size * g; ix, iy = int(fx), int(fy); tx, ty = fx - ix, fy - iy
            a = grid[iy % g][ix % g] * (1 - tx) + grid[iy % g][(ix + 1) % g] * tx; b = grid[(iy + 1) % g][ix % g] * (1 - tx) + grid[(iy + 1) % g][(ix + 1) % g] * tx
            v += wt * (a * (1 - ty) + b * ty)
        return v
    for by in range(0, size, 2):   # the wash: 2x2 blocks, only the extremes of the noise
        for bx in range(0, size, 2):
            n = vn(bx + 1, by + 1) + ((bx // 2 * 7 + by // 2 * 13) % 5 - 2) * .02
            c = warm if n > .66 else pale if n < .34 else None
            if c:
                for dy in range(2):
                    for dx in range(2): put(bx + dx, by + dy, c)
    for _ in range(flecks):
        x, y = rnd.randrange(size), rnd.randrange(size); c = fleck_d if rnd.random() < .6 else fleck_l
        put(x, y, c)
        if rnd.random() < .5: put(x + 1, y, c)
    for _ in range(ripples):   # wind ripples: a short lit dash with a shaded one a row down, shifted a pixel right; loosely in rows
        x = rnd.randrange(size); y = rnd.randrange(size // 4) * 4 + rnd.choice((0, 1)); n = rnd.randint(4, 8)
        for i in range(n): put(x + i, y, lit)
        for i in range(1, n): put(x + i + 1, y + 1, shade)
    for _ in range(pebbles):
        x, y = rnd.randrange(size), rnd.randrange(size); w = rnd.choice((2, 2, 3)); pal = DARK if rnd.random() < .4 else [mix(base, WHITE, .3), mix(base, BLACK, .15), mix(base, BLACK, .38)]
        for i in range(w): put(x + i, y, pal[0]); put(x + i, y + 1, pal[2])
        put(x + w, y + 1, shade)
    for _ in range(chips):   # tiny sandstone chips, red or cream
        x, y = rnd.randrange(size), rnd.randrange(size); w = rnd.choice((2, 3, 3)); pal = RED if rnd.random() < .6 else [mix(base, WHITE, .5), mix(base, (200, 170, 110), .6), mix(base, (150, 110, 70), .7)]
        for i in range(w): put(x + i, y, pal[0]); put(x + i, y + 1, pal[2])
        put(x + w, y + 1, shade)
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    for (x, y), c in px.items(): im.putpixel((x, y), c + (255,))
    return im

out = sys.argv[1] if len(sys.argv) > 1 else "sprites/ground"
os.makedirs(out, exist_ok=True)
im = tile(SAND, 144, 7, 3, 34, 20)   # repeats every 18 m (144 px), under both exhibits (#b-scrubland) and the park (#p-scrubland)
im.save(f"{out}/scrubland.png"); print("scrubland", im.size, len({p[:3] for p in im.get_flattened_data() if p[3]}), "colors")
im = wetland_tile(MARSH, 144, 11, 14, 520, 90, 26)   # 18 m, under both exhibits (#b-wetland) and the park (#p-wetland)
im.save(f"{out}/wetland.png"); print("wetland", im.size, len({p[:3] for p in im.get_flattened_data() if p[3]}), "colors")
im = temperate_tile(LOAM, 144, 7, 520, 80, 22)   # 18 m, under both exhibits (#b-temperate) and the park (#p-temperate)
im.save(f"{out}/temperate.png"); print("temperate", im.size, len({p[:3] for p in im.get_flattened_data() if p[3]}), "colors")
im = desert_tile(SANDY, 144, 5, 520, 70, 14, 10)   # 18 m, under both exhibits (#b-desert) and the park (#p-desert)
im.save(f"{out}/desert.png"); print("desert", im.size, len({p[:3] for p in im.get_flattened_data() if p[3]}), "colors")
