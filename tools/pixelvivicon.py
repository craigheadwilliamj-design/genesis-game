"""Vivarium thumbnails for the build menu in the Genesis restroom's style (palette in tools/genesis_style.py): a glass tank with a green tiled lid,
dark teal frame and a lit glass pane over a little scene (back wall, sandy floor, a fern and a rock), on a brown tiled base slab with the see-through shadow.
Writes sprites/menu/viv-<S|M|L>.png, one height, wider for the bigger tanks (menuSprite in js/menu.js shows them on the Vivariums buttons).
Run: python3 tools/pixelvivicon.py [--sheet out.png]"""
import sys, os
from genesis_style import put, image, sheet

H = 24
WIDTHS = {"S":22, "M":28, "L":34}

def grid(w):
  g = [["."] * w for _ in range(H)]
  row = lambda y, x0, x1, c: [put(g, x, y, c) for x in range(x0, x1)]
  # lid: dark green edge, light top with staggered tile joints, fascia under it
  row(0, 2, w - 2, "A")
  row(1, 1, w - 1, "L"); put(g, 1, 1, "A"); put(g, w - 2, 1, "A")
  row(2, 1, w - 1, "H"); put(g, 1, 2, "A"); put(g, w - 2, 2, "A")
  for x in range(3, w - 3, 4): put(g, x, 1, "H"); put(g, x + 2, 2, "L")
  row(3, 0, w, "A"); row(4, 0, w, "F"); put(g, 0, 4, "A"); put(g, w - 1, 4, "A"); row(5, 0, w, "A")
  # glass: teal frame round the pane, back wall then floor seen through it
  top, floor, bot = 6, 13, 17
  for y in range(top, bot + 1):
    for x in range(1, w - 1):
      edge = x in (1, w - 2) or y in (top, bot)
      put(g, x, y, "e" if edge else "k" if y < floor else "X" if y == floor else "W" if y < bot - 1 else "U")
  for x in range(3, w - 3, 5): put(g, x, floor + 1, "X"); put(g, x + 2, floor + 2, "V")   # sand ripples
  for y in range(top + 1, bot): put(g, 2, y, "g")   # the lit left edge of the pane
  # a fern a little left of middle: dark stem, fronds out to both sides, light on their tops and left
  fx = w * 2 // 5 + 1
  fern = ["...A...", ".L.A.L.", "LHHAHHA", ".LLAHA.", "LHHAHA.", ".LHAA..", "..LA..."]
  for j, r in enumerate(fern):
    for i, c in enumerate(r):
      if c != ".": put(g, fx - 3 + i, floor - 6 + j, c)
  # a rock right of it, lit top left, dark edge
  rx = w - w // 4 - 3
  rock = [".CCCC.", "CaaZZC", "CaZZTC", "CZZTTC", ".CCCC."]
  for j, r in enumerate(rock):
    for i, c in enumerate(r):
      if c != ".": put(g, rx + i, floor - 2 + j, c)
  # glints: two short diagonal streaks on the glass, top left
  for d in range(3): put(g, 3 + d, top + 3 - d, "n"); put(g, 3 + d, top + 5 - d, "n")
  # base slab: dark edge, joints, light row, dark bottom, then the shadow
  b = bot + 1
  row(b, 0, w, "C"); row(b + 1, 0, w, "X"); row(b + 2, 0, w, "W"); row(b + 3, 0, w, "G")
  for y in (b + 1, b + 2): put(g, 0, y, "C"); put(g, w - 1, y, "C")
  for x in range(4, w - 2, 5): put(g, x, b + 1, "M"); put(g, x + 2, b + 2, "M")
  put(g, 1, b + 1, "a")
  row(b + 4, 0, w, "S"); row(b + 5, 1, w - 1, "S")
  return g

if __name__ == "__main__":
  root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
  ims = []
  for k, w in WIDTHS.items():
    im = image(grid(w)); ims.append(im)
    os.makedirs(os.path.join(root, "sprites/menu"), exist_ok=True)
    im.save(os.path.join(root, f"sprites/menu/viv-{k}.png"))
  if "--sheet" in sys.argv: sheet(ims, 3, sys.argv[sys.argv.index("--sheet") + 1])
