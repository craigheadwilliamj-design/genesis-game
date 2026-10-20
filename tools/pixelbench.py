"""Bench sprites in the Genesis restroom's style (palette in tools/genesis_style.py), at 0.13 m a pixel: wooden planks in the restroom's base browns
with dark brown ends, green metal end frames like the bin's lid, and the see-through shadow. The seat is on the front, the backrest behind it.
Writes sprites/bld/bench-<front|back|left|right>[-broken].png. Front 26 x 16 px (the 2.8 m bench across, the seat's top face and the backrest
behind it), back 26 x 12 (the backrest's back with the frame struts), sides 12 x 15 (end on, the projection is cheated: the end profile with a short top,
since a true end-on view would be two tall strips). Broken ones have planks missing.
Run: python3 tools/pixelbench.py [--sheet out.png]"""
import sys, os
from genesis_style import put, image, sheet

def plank(c): return "..C" + c * 20 + "C.."
EDGE = ".." + "C" * 22 + ".."
def frame(row, c="LH"):   # the two end frames drawn over a row, 8 px either side of the middle
  r = list(row)
  for x in (4, 20): r[x], r[x + 1] = c[0], c[1]
  return "".join(r)
BLANK = "." * 26
SHADOW = [".." + "S" * 22 + "..", "..." + "S" * 20 + "..."]

FRONT = [EDGE, plank("X"), plank("G"), plank("X"), plank("V"), frame(BLANK), EDGE, plank("X"), plank("G"), plank("X"), EDGE,
         frame(BLANK), frame(BLANK), frame(BLANK, "AA")] + SHADOW
BACK = [EDGE, frame(plank("X")), frame(plank("G")), frame(plank("X")), frame(plank("V")), frame(EDGE),
        frame(BLANK), frame(BLANK), frame(BLANK), frame(BLANK, "AA")] + SHADOW

def side(view):
  # end on, the projection is cheated: the bench is drawn as its end profile with only a few rows of depth, so it reads as a bench and not two posts
  g = [["."] * 12 for _ in range(16)]
  seat, gap, back = (range(2, 7), 7, (8, 9)) if view == "left" else (range(5, 10), 4, (2, 3))
  for x, c in zip(seat, "XVGXV"):   # the seat: far edge, a short top (slats lit on their left), the near end
    put(g, x, 4, "C")
    for y in (5, 6, 7): put(g, x, y, c)
    put(g, x, 8, "W"); put(g, x, 9, "C")
  for x, top, end in zip(back, "XV", "WU"):   # the backrest: its top, then its near end down to the seat
    put(g, x, 0, "C")
    for y in (1, 2): put(g, x, y, top)
    for y in range(3, 9): put(g, x, y, end)
    put(g, x, 9, "C")
  for y in range(4, 10): put(g, gap, y, "H")   # the near end frame: an upright, a rail under the seat and two legs
  for x in range(2, 10): put(g, x, 10, "L")
  for y in (11, 12): put(g, 2, y, "H"); put(g, 9, y, "H")
  put(g, 2, 12, "A"); put(g, 9, 12, "A")
  for i in range(2):
    for x in range(2 + i, 10 - i): put(g, x, 13 + i, "S")
  return [r for r in g[:15]]

def broken(g, view):
  if view == "front":
    for x in range(13, 20): put(g, x, 9, "."); put(g, x, 10, ".")
    for x in range(15, 21): put(g, x, 1, "G")
  elif view == "back":
    for x in range(8, 14): put(g, x, 1, "G")
    for x in range(16, 20): put(g, x, 3, "G")
  else:   # a slat gone from the seat and the backrest snapped short
    sx = 5 if view == "left" else 8
    for y in (5, 6, 7): put(g, sx, y, "G")
    for x in ((8, 9) if view == "left" else (2, 3)):
      for y in range(0, 3): put(g, x, y, ".")
      put(g, x, 3, "C")

def main():
  out, ims = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "sprites", "bld"), []
  for view in ("front", "back", "left", "right"):
    for st in ("", "broken"):
      g = [list(r) for r in FRONT] if view == "front" else [list(r) for r in BACK] if view == "back" else side(view)
      if st: broken(g, view)
      im = image(g); ims.append(im)
      im.save(os.path.join(out, f"bench-{view}{'-' + st if st else ''}.png"))
  if "--sheet" in sys.argv: sheet(ims, 2, sys.argv[sys.argv.index("--sheet") + 1])

main()
