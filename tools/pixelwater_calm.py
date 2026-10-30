# Draws the desert and scrubland water tiles, sprites/water/<biome>-1..4.png (8 x 8 px, 1 m; WATER_TILES in data.js): tile 1 plain and 2 to 4 the glint frames
# (a sparkle that rises and fades). Desert is a soft oasis teal on the pale sand, scrubland a murkier green-teal on the terracotta. The bank (shallows band, wet and damp ground)
# is each biome's WATER_TEX entry in js/landscape.js.
# Usage: python3 -I tools/pixelwater_calm.py [outdir]
import sys, os
from PIL import Image

H = lambda h: tuple(int(h[i:i+2], 16) for i in (1, 3, 5))
E = "........"
BIOMES = {
  "desert": ({".": "#4F9C9E", "g": "#A9D8CF"}, [   # water, glint
    [E] * 8,
    [E, E, "....g...", E, E, E, E, E],
    [E, "..g.....", "...gg...", E, E, E, E, E],
    [E, ".gg.....", E, E, E, E, E, E],
  ]),
  "scrubland": ({".": "#4E8A7E", "g": "#A9CDB9"}, [
    [E] * 8,
    [E, ".gg.....", E, E, E, E, E, E],
    [E, "..g.....", "...gg...", E, E, E, E, E],
    [E, E, "....g...", E, E, E, E, E],
  ]),
}
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "sprites", "water")
for name, (pal, tiles) in BIOMES.items():
  for i, g in enumerate(tiles, 1):
    im = Image.new("RGB", (8, 8)); p = im.load()
    for y, row in enumerate(g):
      for x, c in enumerate(row): p[x, y] = H(pal[c])
    im.save(f"{out}/{name}-{i}.png")
  print(name, "water", len(tiles), "tiles")
