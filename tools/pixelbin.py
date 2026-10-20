"""Trash bin sprites in the Genesis restroom's style (sprites/bld/restroom-*.png): a green tiled lid with a dark green edge, cream plaster
with tan shading and dark brown edges, a dark band under the lid, a brown tiled base and the same see-through shadow, at 0.13 m a pixel.
Writes sprites/bld/bin-<front|back|left|right>[-full|-broken].png (14 x 21 px): the base slab's bottom is row 18 (binSprite34 in propart.js stands it on the bin's front edge), the shadow rows 19-20.
The side views are the same both ways (the flap is edge-on); the full one has a heap of litter, the broken one its lid knocked off to the back.
Run: python3 tools/pixelbin.py [--sheet out.png]"""
import sys, os
from PIL import Image

PAL = {
  "A":(18,34,19), "L":(63,124,69), "H":(48,94,50), "F":(43,84,45),          # lid, as the restroom roof
  "C":(28,26,16), "D":(33,26,14), "T":(106,100,77), "a":(227,221,195), "Z":(198,188,147),   # body, as the restroom walls
  "G":(44,35,19), "M":(66,53,29), "X":(165,125,74), "W":(143,109,64),       # base, as the restroom slab
  "w":(231,231,231), "r":(189,72,58), "y":(222,182,72), "b":(132,101,59),   # litter
  "S":(29,43,34,100),                                                       # shadow, see-through
}
TOP = 3   # empty rows above the lid, for a full bin's heap

LID = [
  "..AAAAAAAAAA..",
  ".ALLLLLLLLLLA.",
  ".ALLHLLLLHLLA.",
  ".AHHHHHHHHHHA.",
  ".AAAAAAAAAAAA.",
  ".AFFFFFFFFFFA.",
  ".AAAAAAAAAAAA.",
]
NL = len(LID)
BASE = [
  "..CGMMMMMMGC..",
  "..CWXMXXXMWC..",
  "..CCCCCCCCCC..",
  "..SSSSSSSSSS..",
  "...SSSSSSSS...",
]
BODY = {   # under the lid, above the base
  "front":["..CDDDDDDDDC..", "..CMMMMMMMMC..", "..CZZZZZZZZC..", "..CZaaLHaaZC..", "..CZaaHFaaZC..", "..CZaaaaaaZC.."],   # the flap opening, and a green badge
  "back": ["..CTTTTTTTTC..", "..CZZZZZZZZC..", "..CZaZaaZaZC..", "..CZaZaaZaZC..", "..CZaZaaZaZC..", "..CZaaaaaaZC.."],   # two rails
  "side": ["..CTTTTTTTTC..", "..CZZZZZZZZC..", "..CZaaaaaaZC..", "..CZZZZZZZZC..", "..CZaaaaaaZC..", "..CZZZZZZZZC.."],   # grooves down the sides
}

def grid(view):
  body = BODY["front" if view == "front" else "back" if view == "back" else "side"]
  rows = ["." * 14] * TOP + LID + body + BASE
  return [list(r) for r in rows]

def put(g, x, y, c):
  if 0 <= y < len(g) and 0 <= x < len(g[0]): g[y][x] = c

def full(g, view):
  # a heap above the lid and bits spilling from the flap
  heap = [".....wy.r.....", "....brwwyb....", "...yrwbbrwr...", "..rwbyrwbyrw.."]
  for j, row in enumerate(heap):
    for i, c in enumerate(row):
      if c != ".": put(g, i, TOP - 3 + j, c)
  if view == "front":
    for x, c in ((4, "w"), (6, "r"), (8, "y"), (9, "w")): put(g, x, TOP + NL, c)
    put(g, 1, TOP + NL + 7, "r"); put(g, 12, TOP + NL + 6, "w")

def broken(g, view):
  # the lid knocked askew: up and to the right, the open top showing dark inside, and a crack down the front
  lid = [r[:] for r in g[TOP:TOP + NL]]
  for y in range(TOP, TOP + NL):
    for x in range(14): g[y][x] = "."
  for y in range(TOP + 2, TOP + NL):   # the open top: a dark rim round the dark inside
    for x in range(2, 12): g[y][x] = "D" if 2 < x < 11 and TOP + 2 < y < TOP + NL - 1 else "C"
  for j, row in enumerate(lid):
    for i, c in enumerate(row):
      if c != ".": put(g, i + 2, TOP - 1 + j, c)
  for y, x in ((TOP + NL + 2, 7), (TOP + NL + 3, 6), (TOP + NL + 4, 6)): put(g, x, y, "C")

def image(g):
  im = Image.new("RGBA", (len(g[0]), len(g)), (0, 0, 0, 0)); p = im.load()
  for y, row in enumerate(g):
    for x, c in enumerate(row):
      if c != ".": col = PAL[c]; p[x, y] = col if len(col) == 4 else col + (255,)
  return im

def main():
  root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
  out, ims = os.path.join(root, "sprites", "bld"), []
  for view in ("front", "back", "left", "right"):
    for state in ("", "full", "broken"):
      g = grid(view)
      if state == "full": full(g, view)
      if state == "broken": broken(g, view)
      im = image(g); ims.append(im)
      im.save(os.path.join(out, f"bin-{view}{'-' + state if state else ''}.png"))
  if "--sheet" in sys.argv:
    s, w, h = 8, ims[0].width, ims[0].height
    sheet = Image.new("RGBA", (3 * (w * s + 8), 4 * (h * s + 8)), (200, 215, 190, 255))
    for i, im in enumerate(ims): sheet.alpha_composite(im.resize((w * s, h * s), Image.NEAREST), ((i % 3) * (w * s + 8), (i // 3) * (h * s + 8)))
    sheet.save(sys.argv[sys.argv.index("--sheet") + 1])

main()
