"""Sea water tiles for pools: sprites/water/sea-<n>.png (shallow sea) and deep-<n>.png (deep sea), 8 x 8 px, 1 m each.

Same recipe as the biome water tiles (WATER_TILES in js/data.js, built by buildTiles in js/biomepaint.js):
tile 1 is plain, tile 2 the detail tile (a mark on some cells of each chunk), tiles 3-5 the glint frames.
Shallow sea is bright turquoise with pale sand ripples showing through; deep sea is dark blue with darker swells.
Run: python3 tools/pixelseawater.py, then python3 tools/packsprites.py.
"""
import os
from PIL import Image

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "sprites", "water")
SETS = {
    # plain, detail mark, glint
    "sea":  ("#3AA6B4", "#56BCC2", "#9EE0DE"),
    "deep": ("#1E4C86", "#173E70", "#4A7FB8"),
}
# detail marks: shallow sea, a sand ripple seen through the water; deep sea, a darker trough between swells
DETAIL = {
    "sea":  [(1, 2), (2, 2), (3, 3), (4, 3), (5, 3), (6, 2)],
    "deep": [(1, 5), (2, 5), (3, 5), (4, 4), (5, 4), (6, 4), (2, 6), (3, 6)],
}
# glints, one per frame: a fleck that opens out and closes (as on the biome water tiles)
GLINTS = [[(1, 1), (2, 1)], [(2, 1), (3, 2), (4, 2)], [(4, 2)]]

def rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)

def tile(base, marks, col):
    im = Image.new("RGBA", (8, 8), rgb(base))
    for x, y in marks:
        im.putpixel((x, y), rgb(col))
    return im

for name, (base, mark, glint) in SETS.items():
    frames = [tile(base, [], base), tile(base, DETAIL[name], mark)] + [tile(base, g, glint) for g in GLINTS]
    for i, im in enumerate(frames, 1):
        im.save(os.path.join(OUT, f"{name}-{i}.png"))
    print(name, len(frames), "tiles")
