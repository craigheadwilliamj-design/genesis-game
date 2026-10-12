# Draws the Genesis path tiles in the Dimetrodon's flat style: poured warm-gray concrete slabs, as transparent overlays on the path color (THEMES.genesis.path.live / .dead),
# so connected and unconnected paths still read differently. A path tile is 5 m on a 5 m grid (js/tiles.js), drawn 38 px across (a pixel is 5 / 38 = 0.13 m, the game's 0.13 m).
#   genesis-tile.png        footpath: a 2 x 2 grid of 19 px (2.5 m) slabs
#   genesis-wide-tile.png   promenade: one 38 px (5 m) slab with a small matte gold diamond in the middle (gold is only ever a line or a dot)
# The tiles repeat across the map from the origin, so slab joints line up from tile to tile. Each joint is a dark line with the slab's lit top/left edge just inside it and a shaded
# bottom/right row, then rhythmic texture only: short dashes in loose rows, paired aggregate flecks, a few 2x2 stained blocks. Light from the top left.
# Usage: python3 -I tools/pixelpath_genesis.py [outdir]
import sys, os, random
from PIL import Image

def hexc(h): return tuple(int(h[i:i+2], 16) for i in (1, 3, 5))
JOINT, LIT, SHADE = hexc("#9C9789") + (255,), hexc("#EDE9DE") + (255,), hexc("#B5B0A2") + (255,)
DASH, FLECK, STAIN = hexc("#C4BFB1") + (255,), hexc("#A8A294") + (255,), hexc("#CAC5B7") + (210,)
GOLD, GOLD_LIT = hexc("#C9A24B") + (255,), hexc("#E2C57A") + (255,)
OUT = sys.argv[1] if len(sys.argv) > 1 else "sprites/paths"
N = 38

def slabs(SLAB, seed, stains, dashes, flecks):
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

os.makedirs(OUT, exist_ok=True)
slabs(19, 7, 6, 8, 9).save(os.path.join(OUT, "genesis-tile.png"))
w = slabs(38, 3, 4, 5, 8)
for dx, dy in [(0, 0), (-1, 0), (1, 0), (0, -1), (0, 1)]: w.putpixel((19 + dx, 19 + dy), GOLD)   # a small matte gold diamond in the middle
w.putpixel((19, 18), GOLD_LIT)
w.save(os.path.join(OUT, "genesis-wide-tile.png"))
