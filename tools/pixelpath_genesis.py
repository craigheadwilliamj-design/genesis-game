# Draws the Genesis footpath tile, sprites/paths/genesis.png, in the Dimetrodon's flat style: poured warm-gray concrete slabs in a straight grid.
# The tile is a transparent overlay laid over the path color (THEMES.genesis.path.live / .dead), so connected and unconnected paths still read differently.
# 40 x 40 px at 0.13 m a pixel (5.2 m): a straight grid of 20 px poured slabs. Each joint is a dark line with the slab's lit top/left edge
# just inside it and a shaded bottom/right row, then rhythmic texture only: short dashes in loose rows, paired aggregate flecks, a few 2x2 stained blocks.
# Light is from the top left. Features wrap over the tile edges so it repeats cleanly.
# Usage: python3 -I tools/pixelpath_genesis.py [outfile]
import sys, random
from PIL import Image

def hexc(h): return tuple(int(h[i:i+2], 16) for i in (1, 3, 5))
LIVE = hexc("#D9D4C7")   # THEMES.genesis.path.live, the overlay colors are all relative to it
JOINT, LIT, SHADE = hexc("#9C9789") + (255,), hexc("#EDE9DE") + (255,), hexc("#B5B0A2") + (255,)
DASH, FLECK, STAIN = hexc("#C4BFB1") + (255,), hexc("#A8A294") + (255,), hexc("#CAC5B7") + (210,)
N, SLAB = 40, 20
rnd = random.Random(7); im = Image.new("RGBA", (N, N), (0, 0, 0, 0))
def put(x, y, c): im.putpixel((x % N, y % N), c)
for row in range(2):   # rows of slabs
    y0, off = row * SLAB, 0
    for i in range(N):   # the horizontal joint along the top of the row, lit row below it, shaded row above it
        put(i, y0, JOINT); put(i, y0 + 1, LIT); put(i, y0 - 1, SHADE)
    for k in range(2):
        x0 = off + k * SLAB
        for j in range(SLAB):
            if j == 0 or j == 1 and False: continue
            y = y0 + j
            put(x0, y, JOINT)
            if j > 1: put(x0 + 1, y, LIT)   # lit left edge of the slab
            if j > 0: put(x0 - 1, y, SHADE)   # shaded right edge of the slab before it
for _ in range(7):   # stained blocks, 2x2, away from the joints
    x, y = rnd.randrange(N), rnd.randrange(N)
    if im.getpixel((x % N, y % N))[3]: continue
    for dx in range(2):
        for dy in range(2):
            if not im.getpixel(((x + dx) % N, (y + dy) % N))[3]: put(x + dx, y + dy, STAIN)
for _ in range(9):   # short dashes of surface texture, loosely in rows
    x, y = rnd.randrange(N), rnd.randrange(N // 5) * 5 + 3
    for i in range(rnd.randint(2, 4)):
        if not im.getpixel(((x + i) % N, y % N))[3]: put(x + i, y, DASH)
for _ in range(10):   # aggregate flecks: a dark pixel with a pale one under-right of it
    x, y = rnd.randrange(N), rnd.randrange(N)
    if not im.getpixel((x, y))[3] and not im.getpixel(((x + 1) % N, (y + 1) % N))[3]: put(x, y, FLECK); put(x + 1, y + 1, LIT)
im.save(sys.argv[1] if len(sys.argv) > 1 else "sprites/paths/genesis.png")
