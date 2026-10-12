# Draws the Genesis path tiles in the Dimetrodon's flat style: poured warm-gray concrete slabs, as transparent overlays on the path color (THEMES.genesis.path.live / .dead),
# so connected and unconnected paths still read differently. 0.13 m a pixel. Four tiles, in sprites/paths/ (the path is 5 m wide, the wide promenade 10 m):
#   genesis.png        footpath, straight runs: a straight grid of 20 px (2.6 m) slabs, 40 x 40 px
#   genesis-d.png      footpath, 45° runs: the same slabs turned a quarter turn, 28 x 28 px
#   genesis-wide.png   promenade, straight runs: one 40 px (5.2 m) slab to the tile, 40 x 40 px
#   genesis-wide-d.png promenade, 45° runs: 56 x 56 px
# map.js lays each tile with its origin on the start of the run (a pattern with a translate), so a joint always sits on the path's centerline.
# Each joint is a dark line with the slab's lit top/left edge just inside it and a shaded bottom/right row, then rhythmic texture only: short dashes in loose rows, paired
# aggregate flecks, a few 2x2 stained blocks. A 45° joint is a perfect pixel stair: "\" joints where (x - y) mod D is 0 or 1, "/" joints where (x + y) mod D is 0 or 1 (a slab is D / sqrt 2 px).
# Light from the top left: the slab under a "/" joint has it as its upper-left edge (lit pixel on the lower-right side), a "\" joint is a slab's upper-right edge (lit on the lower-left side).
# Usage: python3 -I tools/pixelpath_genesis.py [outdir]
import sys, os, random
from PIL import Image

def hexc(h): return tuple(int(h[i:i+2], 16) for i in (1, 3, 5))
JOINT, LIT, SHADE = hexc("#9C9789") + (255,), hexc("#EDE9DE") + (255,), hexc("#B5B0A2") + (255,)
DASH, FLECK, STAIN = hexc("#C4BFB1") + (255,), hexc("#A8A294") + (255,), hexc("#CAC5B7") + (210,)
OUT = sys.argv[1] if len(sys.argv) > 1 else "sprites/paths"

def straight(N, SLAB, seed, stains, dashes, flecks):
    rnd = random.Random(seed); im = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    def put(x, y, c): im.putpixel((x % N, y % N), c)
    free = lambda x, y: not im.getpixel((x % N, y % N))[3]
    for r in range(N // SLAB):
        y0 = r * SLAB
        for i in range(N): put(i, y0, JOINT); put(i, y0 + 1, LIT); put(i, y0 - 1, SHADE)   # the joint along the top of the row, a lit row below it, a shaded row above it
        for k in range(N // SLAB):
            x0 = k * SLAB
            for j in range(1, SLAB):
                y = y0 + j; put(x0, y, JOINT)
                if j > 1: put(x0 + 1, y, LIT)   # lit left edge of the slab
                put(x0 - 1, y, SHADE)   # shaded right edge of the slab before it
    for _ in range(stains):
        x, y = rnd.randrange(N), rnd.randrange(N)
        if all(free(x + a, y + b) for a in range(2) for b in range(2)):
            for a in range(2):
                for b in range(2): put(x + a, y + b, STAIN)
    for _ in range(dashes):   # short dashes of surface texture, loosely in rows
        x, y = rnd.randrange(N), rnd.randrange(N // 5) * 5 + 3
        for i in range(rnd.randint(2, 4)):
            if free(x + i, y): put(x + i, y, DASH)
    for _ in range(flecks):   # a dark pixel with a pale one under-right of it
        x, y = rnd.randrange(N), rnd.randrange(N)
        if free(x, y) and free(x + 1, y + 1): put(x, y, FLECK); put(x + 1, y + 1, LIT)
    return im

def turned(D, seed, stains, dashes, flecks):
    rnd = random.Random(seed); im = Image.new("RGBA", (D, D), (0, 0, 0, 0))
    for y in range(D):
        for x in range(D):
            u, v = (x - y) % D, (x + y) % D
            if u in (0, 1) or v in (0, 1): c = JOINT
            elif u == D - 1 or v == 2: c = LIT
            elif u == 2 or v == D - 1: c = SHADE
            else: continue
            im.putpixel((x, y), c)
    def put(x, y, c):
        if not im.getpixel((x % D, y % D))[3]: im.putpixel((x % D, y % D), c)
    for _ in range(stains):
        x, y = rnd.randrange(D), rnd.randrange(D)
        if all(not im.getpixel(((x + a) % D, (y + b) % D))[3] for a in range(2) for b in range(2)):
            for a in range(2):
                for b in range(2): put(x + a, y + b, STAIN)
    for _ in range(dashes):   # short dashes along the "\" direction
        x, y = rnd.randrange(D), rnd.randrange(D)
        for i in range(3): put(x + i, y + i, DASH)
    for _ in range(flecks):
        x, y = rnd.randrange(D), rnd.randrange(D)
        if not im.getpixel((x, y))[3] and not im.getpixel(((x + 1) % D, (y + 1) % D))[3]: put(x, y, FLECK); put(x + 1, y + 1, LIT)
    return im

os.makedirs(OUT, exist_ok=True)
straight(40, 20, 7, 7, 9, 10).save(os.path.join(OUT, "genesis.png"))
turned(28, 5, 4, 5, 6).save(os.path.join(OUT, "genesis-d.png"))
straight(40, 40, 3, 4, 5, 8).save(os.path.join(OUT, "genesis-wide.png"))
turned(56, 9, 8, 10, 14).save(os.path.join(OUT, "genesis-wide-d.png"))
