# Draws every biome's water tiles (not the sea's), sprites/water/<biome>-1..4.png (8 x 8 px, 1 m; WATER_TILES in data.js): tile 1 plain and 2 to 4 the glint frames
# (a sparkle that slides down and right, the way the wave bands sweep, so every biome's water runs the same way). Desert is a soft oasis teal on the pale sand, scrubland a murkier green-teal on the terracotta, boreal a cold steel blue on the moss,
# grassland a clear green-blue river, wetland tannin-green, fern a green-teal pool, temperate a blue pond, tundra pale glacial blue, tropical a deep blue-green. The bank (shallows band, wet and damp ground)
# is each biome's WATER_TEX entry in js/landscape.js.
# Usage: python3 -I tools/pixelwater_calm.py [outdir]
import sys, os
from PIL import Image

H = lambda h: tuple(int(h[i:i+2], 16) for i in (1, 3, 5))
E = "........"
BIOMES = {
  "desert": ({".": "#4F9C9E", "g": "#A9D8CF"}, [   # water, glint
    [E] * 8,
    [E, ".gg.....", E, E, E, E, E, E],
    [E, "..g.....", "...gg...", E, E, E, E, E],
    [E, E, "....g...", E, E, E, E, E],
  ]),
  "scrubland": ({".": "#4E8A7E", "g": "#A9CDB9"}, [
    [E] * 8,
    [E, ".gg.....", E, E, E, E, E, E],
    [E, "..g.....", "...gg...", E, E, E, E, E],
    [E, E, "....g...", E, E, E, E, E],
  ]),
  "boreal": ({".": "#4A7A8C", "g": "#B7D3D6"}, [
    [E] * 8,
    [E, ".gg.....", E, E, E, E, E, E],
    [E, "..g.....", "...gg...", E, E, E, E, E],
    [E, E, "....g...", E, E, E, E, E],
  ]),
  "grassland": ({".": "#4C8A92", "g": "#A8D2D2"}, [   # a clear green-blue river on the dry grass
    [E] * 8,
    [E, ".gg.....", E, E, E, E, E, E],
    [E, "..g.....", "...gg...", E, E, E, E, E],
    [E, E, "....g...", E, E, E, E, E],
  ]),
  "wetland": ({".": "#46706A", "g": "#9DC2B2"}, [   # tannin-green marsh water on the olive mud
    [E] * 8,
    [E, ".gg.....", E, E, E, E, E, E],
    [E, "..g.....", "...gg...", E, E, E, E, E],
    [E, E, "....g...", E, E, E, E, E],
  ]),
  "fern": ({".": "#4D8278", "g": "#A6CBBA"}, [   # green-teal pool on the brown loam
    [E] * 8,
    [E, ".gg.....", E, E, E, E, E, E],
    [E, "..g.....", "...gg...", E, E, E, E, E],
    [E, E, "....g...", E, E, E, E, E],
  ]),
  "temperate": ({".": "#457C92", "g": "#A8CCD6"}, [   # a blue pond in the green woods
    [E] * 8,
    [E, ".gg.....", E, E, E, E, E, E],
    [E, "..g.....", "...gg...", E, E, E, E, E],
    [E, E, "....g...", E, E, E, E, E],
  ]),
  "tundra": ({".": "#6B98AE", "g": "#D2E6EE"}, [   # pale glacial blue on the frost
    [E] * 8,
    [E, ".gg.....", E, E, E, E, E, E],
    [E, "..g.....", "...gg...", E, E, E, E, E],
    [E, E, "....g...", E, E, E, E, E],
  ]),
  "tropical": ({".": "#2F7E78", "g": "#8FCDBF"}, [   # deep blue-green jungle pool
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
