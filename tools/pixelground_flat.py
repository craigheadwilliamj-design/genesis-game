# (The tropical tile, sprites/ground/tropical.png, is drawn by tropical_tile below: wet green, red-brown humus, leaf litter and twigs, no grass or flowers, same rules.)
# (The grassland tile, sprites/ground/grassland.png, is drawn by grassland_tile below: sunlit loam with pale silt, clay and soil flecks and small pebbles. No grass, flowers or modern plants, so it suits the Neogene on and stays free of anything from the wrong era.)
# (The boreal tile, sprites/ground/boreal.png, is drawn by boreal_tile below: cold conifer-forest floor of needle and leaf litter, moss, dark humus and small stones. No grass, flowers or modern plants, so it suits the Permian on and stays free of anything from the wrong era.)
# (The tundra tile, sprites/ground/tundra.png, is drawn by tundra_tile below: frost-heaved grit with pale and dark flecks, frost cracks, pebbles and tiny lichen specks. No grass, flowers or plants, so it suits the Neogene on and stays free of anything from another biome.)
# (The temperate tile, sprites/ground/temperate.png, is drawn by temperate_tile below: loam, moss crust and humus flecks, no grass or flowers, same rules.)
# (The wetland tile, sprites/ground/wetland.png, is drawn by wetland_tile below: mud, algae and small shallow pools, same rules.)
# Draws the older seamless 144 px ground tiles (18 m at 0.125 m a pixel), each laid over its biome color (BIOMES.<biome>.color, the same as .park), in the Dimetrodon's flat, simple style:
# flat, stair-stepped features lit on their top row and shaded on their bottom row, no dithering, every feature small and wrapping over the edges so the repeat doesn't show.
# Light is from the top left. (The desert and scrubland tiles are drawn by tools/pixelground_calm.py.)
# Usage: python3 -I tools/pixelground_flat.py [outdir]
import sys, os, random
from PIL import Image

def hexc(h): return tuple(int(h[i:i+2], 16) for i in (1, 3, 5))
def mix(a, b, t): return tuple(round(x * (1 - t) + y * t) for x, y in zip(a, b))
WHITE, BLACK = (255, 255, 255), (0, 0, 0)
RED = [mix((178, 84, 24), WHITE, .3), (178, 84, 24), mix((178, 84, 24), BLACK, .25)]   # sandstone, top / body / base: the rocks' flat red
DARK = [(110, 102, 94), (82, 76, 72), (58, 53, 50)]   # dark stones, same three rows

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

PRAIRIE = hexc("#C3CC76")   # BIOMES.grassland.color in data.js, and its park color too (the park used to be the paler #B7C995): one floor for exhibits and the park
def grassland_tile(base, size, seed, flecks, dashes, pebbles):
    # Open-plains floor built from small, low-contrast details so the repeat is hidden: a faint two-scale wash of sun-bleached and damp-loam patches, lots of 1 to 3 px flecks of pale silt,
    # warm clay and soil, short dry-earth dashes, a few small pebbles (lit top row, shaded base). No grass, flowers or plants, so nothing is out of its era.
    rnd = random.Random(seed); px = {}
    def put(x, y, c): px[(x % size, y % size)] = c
    bleach = mix(base, (226, 226, 150), .22); loam = mix(base, (110, 120, 60), .2); damp = mix(base, BLACK, .08); dash = mix(base, (120, 110, 50), .3); dry = mix(base, (190, 170, 100), .45)
    fleck_p = mix(base, (236, 232, 170), .5); fleck_s = mix(base, (110, 96, 56), .4)
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
            c = loam if n > .72 else damp if n > .65 else bleach if n < .3 else None
            if c:
                for dy in range(2):
                    for dx in range(2): put(bx + dx, by + dy, c)
    for _ in range(flecks):
        x, y = rnd.randrange(size), rnd.randrange(size); c = fleck_s if rnd.random() < .5 else fleck_p
        put(x, y, c)
        if rnd.random() < .5: put(x + 1, y, c)
        if rnd.random() < .2: put(x, y + 1, c)
    for _ in range(dashes):   # short dry-earth dashes, 2 to 4 px
        x = rnd.randrange(size); y = rnd.randrange(size // 3) * 3 + rnd.choice((0, 1)); n = rnd.randint(2, 4); c = dry if rnd.random() < .4 else dash
        for i in range(n): put(x + i, y, c)
    for _ in range(pebbles):
        x, y = rnd.randrange(size), rnd.randrange(size); w = rnd.choice((2, 2, 3)); pal = [(176, 172, 160), (140, 138, 128), (104, 102, 96)] if rnd.random() < .4 else [mix(base, WHITE, .3), mix(base, BLACK, .15), mix(base, BLACK, .38)]
        for i in range(w): put(x + i, y, pal[0]); put(x + i, y + 1, pal[2])
        put(x + w, y + 1, dash)
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    for (x, y), c in px.items(): im.putpixel((x, y), c + (255,))
    return im

JUNGLE = hexc("#002104")   # BIOMES.tropical.color in data.js, and its park color too: one floor for exhibits and the park
def tropical_tile(base, size, seed, flecks, dashes, twigs, pebbles):
    # Humid forest floor built from small, low-contrast details so the repeat is hidden: a faint two-scale wash of deep wet green and rich red-brown humus, lots of 1 to 3 px flecks,
    # short rows of leaf litter, a few diagonal twigs (a lit pixel up-left of each shaded one), and a few damp pebbles. No grass, flowers or modern plants, so it suits any era from the Devonian on.
    rnd = random.Random(seed); px = {}
    def put(x, y, c): px[(x % size, y % size)] = c
    deep = mix(base, BLACK, .5); humus = mix(base, (105, 68, 38), .38); brown2 = mix(base, (140, 92, 48), .48); night = (0, 8, 1); night2 = (0, 14, 2); damp = mix(base, BLACK, .14); lush = mix(base, (60, 150, 60), .22)
    litter = mix(base, (165, 100, 48), .7); leafs = [mix(base, (170, 110, 50), .75), mix(base, (130, 80, 40), .7), mix(base, (190, 140, 60), .6), mix(base, (95, 62, 36), .6)]; dash = mix(base, BLACK, .3); lit = mix(base, (190, 220, 130), .35)
    fleck_h = mix(base, (140, 90, 45), .7); fleck_d = mix(base, BLACK, .26); fleck_l = mix(base, (170, 225, 120), .38)
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
            c = brown2 if n > .86 else humus if n > .62 else night if n > .58 else deep if n > .54 else night2 if n < .17 else lush if n < .24 else damp if n < .32 else None
            if c:
                for dy in range(2):
                    for dx in range(2): put(bx + dx, by + dy, c)
    for _ in range(flecks):
        x, y = rnd.randrange(size), rnd.randrange(size); r = rnd.random(); c = fleck_h if r < .4 else fleck_d if r < .75 else fleck_l
        put(x, y, c)
        if rnd.random() < .5: put(x + 1, y, c)
        if rnd.random() < .2: put(x, y + 1, c)
    for _ in range(dashes):   # leaf-litter dashes, 2 to 4 px, most red-brown, some dark
        x = rnd.randrange(size); y = rnd.randrange(size // 3) * 3 + rnd.choice((0, 1)); n = rnd.randint(2, 4); c = litter if rnd.random() < .6 else dash
        for i in range(n): put(x + i, y, c)
        if n > 2 and c == litter: put(x, y, mix(litter, WHITE, .2))
    for _ in range(dashes // 2):   # fallen brown leaves: 3 x 2 px lens, lit top row, shaded bottom, in several browns
        x, y = rnd.randrange(size), rnd.randrange(size); c = rnd.choice(leafs); lo = mix(c, BLACK, .3); hi = mix(c, WHITE, .2)
        put(x + 1, y, hi); put(x + 2, y, c); put(x, y + 1, c); put(x + 1, y + 1, lo); put(x + 2, y + 1, lo)
    for _ in range(twigs):   # fallen twigs: 3 to 4 px on the down-right diagonal, shaded, with a lit top-left pixel
        x, y = rnd.randrange(size), rnd.randrange(size); n = rnd.randint(3, 4)
        for i in range(n): put(x + i, y + i, dash)
        put(x, y, litter)
    for _ in range(pebbles):
        x, y = rnd.randrange(size), rnd.randrange(size); w = rnd.choice((2, 2, 3)); pal = DARK if rnd.random() < .5 else [mix(base, WHITE, .3), mix(base, BLACK, .15), mix(base, BLACK, .38)]
        for i in range(w): put(x + i, y, pal[0]); put(x + i, y + 1, pal[2])
        put(x + w, y + 1, dash)
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    for (x, y), c in px.items(): im.putpixel((x, y), c + (255,))
    return im

FROST = hexc("#B3BDA3")   # BIOMES.tundra.color in data.js, and its park color too (the park used to be the paler #CBD2C2): one floor for exhibits and the park
def tundra_tile(base, size, seed, flecks, cracks, pebbles, lichens):
    # Frost-heaved gravel floor built from small, low-contrast details so the repeat is hidden: a faint two-scale wash of frost-bleached and damp-peat patches, 1 to 3 px flecks of pale grit,
    # dark soil and moss, short frost-crack dashes (a dark run with a pale lip under it), small pebbles (lit top row, shaded base) and tiny grey and yellow-green lichen specks.
    # No grass, flowers or plants, so it suits the Neogene on and stays free of anything from another biome.
    rnd = random.Random(seed); px = {}
    def put(x, y, c): px[(x % size, y % size)] = c
    bleach = mix(base, (232, 236, 224), .2); peat = mix(base, (92, 100, 76), .16); damp = mix(base, BLACK, .07)
    crack = mix(base, (70, 78, 64), .34); lip = mix(base, WHITE, .3)
    fleck_p = mix(base, (240, 242, 232), .5); fleck_s = mix(base, (86, 90, 70), .4); fleck_m = mix(base, (110, 130, 70), .38)
    lich_a = mix(base, (206, 208, 190), .55); lich_b = mix(base, (196, 190, 110), .5)
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
            c = peat if n > .72 else damp if n > .65 else bleach if n < .3 else None
            if c:
                for dy in range(2):
                    for dx in range(2): put(bx + dx, by + dy, c)
    for _ in range(flecks):
        x, y = rnd.randrange(size), rnd.randrange(size); r = rnd.random(); c = fleck_s if r < .4 else fleck_p if r < .8 else fleck_m
        put(x, y, c)
        if rnd.random() < .5: put(x + 1, y, c)
        if rnd.random() < .2: put(x, y + 1, c)
    for _ in range(cracks):   # frost cracks: 3 to 6 px wandering dark runs with a pale lip one row under
        x = rnd.randrange(size); y = rnd.randrange(size); n = rnd.randint(3, 6); yy = y
        for i in range(n):
            if rnd.random() < .25: yy += rnd.choice((-1, 1))
            put(x + i, yy, crack); put(x + i, yy + 1, lip) if rnd.random() < .6 else None
    for _ in range(pebbles):
        x, y = rnd.randrange(size), rnd.randrange(size); w = rnd.choice((2, 2, 3)); pal = DARK if rnd.random() < .4 else [mix(base, WHITE, .3), mix(base, BLACK, .15), mix(base, BLACK, .38)]
        for i in range(w): put(x + i, y, pal[0]); put(x + i, y + 1, pal[2])
        put(x + w, y + 1, crack)
    for _ in range(lichens):   # lichen specks on the grit: 1 to 3 px, grey-white or yellow-green
        x, y = rnd.randrange(size), rnd.randrange(size); c = lich_a if rnd.random() < .6 else lich_b
        put(x, y, c)
        if rnd.random() < .5: put(x + 1, y, c)
        if rnd.random() < .3: put(x, y + 1, c)
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    for (x, y), c in px.items(): im.putpixel((x, y), c + (255,))
    return im

TAIGA = hexc("#587260")   # BIOMES.boreal.color in data.js, and its park color too (the park used to be the paler #8FA694): one floor for exhibits and the park
def boreal_tile(base, size, seed, flecks, litter, twigs, stones):
    # Cold forest floor built from small, low-contrast details so the repeat is hidden: a faint two-scale wash of damp moss and dark humus patches, 1 to 3 px flecks of moss, humus and pale rot,
    # short litter dashes (brown, 2 to 4 px, some a step up or down), a few thin twig runs, and small wet stones (lit top row, shaded base). No grass, flowers or modern plants.
    rnd = random.Random(seed); px = {}
    def put(x, y, c): px[(x % size, y % size)] = c
    moss = mix(base, (96, 150, 84), .2); humus = mix(base, (56, 46, 36), .24); damp = mix(base, BLACK, .08)
    lit_l = mix(base, (176, 138, 90), .5); dry_l = mix(base, (150, 110, 70), .5); shade_l = mix(base, (60, 44, 34), .45)
    fleck_m = mix(base, (120, 172, 98), .4); fleck_h = mix(base, (44, 38, 30), .4); fleck_r = mix(base, (206, 204, 184), .35)
    twig = mix(base, (62, 48, 38), .55); twig_hi = mix(base, (150, 118, 84), .4)
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
        x, y = rnd.randrange(size), rnd.randrange(size); r = rnd.random(); c = fleck_m if r < .45 else fleck_h if r < .85 else fleck_r
        put(x, y, c)
        if rnd.random() < .5: put(x + 1, y, c)
        if rnd.random() < .2: put(x, y + 1, c)
    for _ in range(litter):   # litter: a 2 to 4 px dash, one end a row higher or lower, a shaded pixel under it
        x, y = rnd.randrange(size), rnd.randrange(size); n = rnd.randint(2, 4); c = rnd.choice((lit_l, dry_l, shade_l)); up = rnd.choice((-1, 0, 0, 1)); h = n // 2
        for i in range(n): put(x + i, y + (up if i >= h and up else 0), c)
        if rnd.random() < .5: put(x + n - 1, y + 1 + (up if up > 0 else 0), shade_l)
    for _ in range(twigs):   # a thin twig: 4 to 7 px, a small step in the middle, a lit pixel at the top left
        x, y = rnd.randrange(size), rnd.randrange(size); n = rnd.randint(4, 7); st = rnd.choice((-1, 1)); at = rnd.randint(2, n - 2)
        for i in range(n): put(x + i, y + (st if i >= at else 0), twig)
        put(x, y - 1, twig_hi)
    for _ in range(stones):   # small wet stones: 2 to 3 px wide, lit top row, dark base, a shadow pixel to the right
        x, y = rnd.randrange(size), rnd.randrange(size); w = rnd.choice((2, 2, 3)); pal = [mix(base, (170, 176, 176), .5), mix(base, (96, 106, 112), .55), mix(base, (36, 42, 46), .6)]
        for i in range(w): put(x + i, y, pal[0]); put(x + i, y + 1, pal[1] if i < w - 1 else pal[2])
        put(x + w, y + 1, twig)
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    for (x, y), c in px.items(): im.putpixel((x, y), c + (255,))
    return im

out = sys.argv[1] if len(sys.argv) > 1 else "sprites/ground"
os.makedirs(out, exist_ok=True)
im = wetland_tile(MARSH, 144, 11, 14, 520, 90, 26)   # 18 m, under both exhibits (#b-wetland) and the park (#p-wetland)
im.save(f"{out}/wetland.png"); print("wetland", im.size, len({p[:3] for p in im.get_flattened_data() if p[3]}), "colors")
im = temperate_tile(LOAM, 144, 7, 520, 80, 22)   # 18 m, under both exhibits (#b-temperate) and the park (#p-temperate)
im.save(f"{out}/temperate.png"); print("temperate", im.size, len({p[:3] for p in im.get_flattened_data() if p[3]}), "colors")
im = tropical_tile(JUNGLE, 144, 9, 560, 110, 14, 12)   # 18 m, under both exhibits (#b-tropical) and the park (#p-tropical)
im.save(f"{out}/tropical.png"); print("tropical", im.size, len({p[:3] for p in im.get_flattened_data() if p[3]}), "colors")
im = grassland_tile(PRAIRIE, 144, 13, 520, 80, 22)   # 18 m, under both exhibits (#b-grassland) and the park (#p-grassland)
im.save(f"{out}/grassland.png"); print("grassland", im.size, len({p[:3] for p in im.get_flattened_data() if p[3]}), "colors")
im = tundra_tile(FROST, 144, 17, 500, 45, 20, 60)   # 18 m, under both exhibits (#b-tundra) and the park (#p-tundra)
im.save(f"{out}/tundra.png"); print("tundra", im.size, len({p[:3] for p in im.get_flattened_data() if p[3]}), "colors")
im = boreal_tile(TAIGA, 144, 41, 520, 150, 22, 16)   # 18 m, under both exhibits (#b-boreal) and the park (#p-boreal)
im.save(f"{out}/boreal.png"); print("boreal", im.size, len({p[:3] for p in im.get_flattened_data() if p[3]}), "colors")
