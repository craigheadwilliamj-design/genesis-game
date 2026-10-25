"""The animal crate (sprites/crate.png): a wooden shipping crate in the park style (tools/genesis_style.py), 3/4 view, 14 x 17 px at 0.13 m a pixel.
A crated animal is boxed off the map (state.science.ready); the crate shows on the Crates tab, the rail button and the placing ghost.
Light from the top left: a lit plank top, a front of planks in a frame of lit and shaded rails and posts, a diagonal brace, edges in the darkest brown (not black).
Its base's bottom is the third row from the bottom, and the two rows under it are the see-through shadow.
Usage: python3 -I tools/pixelcrate.py [sheet.png]"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from genesis_style import put, image, sheet

W, H = 14, 17
g = [["."] * W for _ in range(H)]
for x in range(1, W - 1): put(g, x, 0, "G")                                   # the top's back edge
for y in range(1, 4):                                                         # the top: lit planks, a seam between
  put(g, 0, y, "G"); put(g, W - 1, y, "G")
  for x in range(1, W - 1): put(g, x, y, "W" if y == 2 else "X")
for y in range(4, 15):                                                        # the front: planks in a frame
  put(g, 0, y, "G"); put(g, W - 1, y, "G")
  for x in range(1, W - 1): put(g, x, y, "W")
for x in range(1, W - 1): put(g, x, 4, "X"); put(g, x, 5, "V"); put(g, x, 12, "V"); put(g, x, 13, "U")   # top and bottom rails, lit above, shaded below
for y in range(4, 14): put(g, 1, y, "X"); put(g, 2, y, "V"); put(g, 11, y, "V"); put(g, 12, y, "U")     # corner posts: lit left, shaded right
for x in range(3, 11): put(g, x, 9, "U")                                       # a seam across the planks
for x in range(3, 11):                                                        # the diagonal brace, low left to high right, lit on its upper edge
  y = 11 - round((x - 3) * 5 / 7)
  put(g, x, y, "M"); put(g, x, y - 1, "X") if y - 1 > 5 else None
for x in range(0, W): put(g, x, 14, "G")                                      # the base's bottom edge
for x in range(1, W): put(g, x, 15, "S")                                      # the shadow, falling down and right
for x in range(2, W): put(g, x, 16, "S")

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "sprites", "crate.png")
im = image(g); im.save(out); print("crate", im.size)
if len(sys.argv) > 1: sheet([im], 1, sys.argv[1], 12)
