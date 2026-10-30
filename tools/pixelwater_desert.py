# Draws the desert water tiles, sprites/water/desert-1..4.png (8 x 8 px, 1 m; WATER_TILES.desert in data.js): a soft oasis teal that sits back against the pale sand,
# tile 1 plain and 2 to 4 the glint frames (a sparkle that rises and fades). The bank (shallows band, wet and damp sand) is WATER_TEX.desert in js/landscape.js.
# Usage: python3 -I tools/pixelwater_desert.py [outdir]
import sys, os
from PIL import Image

H = lambda h: tuple(int(h[i:i+2], 16) for i in (1, 3, 5))
PAL = {".": H("#4F9C9E"), "g": H("#A9D8CF")}   # water, glint
TILES = [
  ["........"] * 8,
  ["........", "........", "....g...", "........", "........", "........", "........", "........"],
  ["........", "..g.....", "...gg...", "........", "........", "........", "........", "........"],
  ["........", ".gg.....", "........", "........", "........", "........", "........", "........"],
]
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "sprites", "water")
for i, g in enumerate(TILES, 1):
  im = Image.new("RGB", (8, 8)); p = im.load()
  for y, row in enumerate(g):
    for x, c in enumerate(row): p[x, y] = PAL[c]
  im.save(f"{out}/desert-{i}.png")
print("desert water", len(TILES), "tiles")
