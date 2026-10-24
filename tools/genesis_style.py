"""Shared palette and helpers for props drawn in the Genesis restroom's style (sprites/bld/restroom-*.png), at 0.13 m a pixel.
Every picture is a grid of these letters ("." is clear). Its base's bottom is the third row from the bottom and the two rows under it are the see-through shadow;
propSprite34 (js/propart.js) stands that row on the prop's front edge, centered across the picture."""
from PIL import Image

PAL = {
  "A":(18,34,19), "L":(63,124,69), "H":(48,94,50), "F":(43,84,45),          # green, as the restroom roof (the dark edge, light, mid, fascia)
  "C":(28,26,16), "D":(33,26,14), "T":(106,100,77), "a":(227,221,195), "Z":(198,188,147),   # as the restroom walls: dark edge, dark inside, soffit, plaster, plaster shade
  "G":(44,35,19), "M":(66,53,29), "X":(165,125,74), "W":(143,109,64), "U":(110,85,49), "V":(132,101,59),   # browns, as the restroom's base slab
  "w":(231,231,231), "r":(189,72,58), "y":(222,182,72), "b":(132,101,59),   # litter
  "e":(36,65,74), "k":(126,168,170), "g":(176,214,218), "n":(232,244,244),   # glass: dark teal frame, the back seen through it, lit edge, glint
  "S":(29,43,34,100),                                                       # shadow, see-through
}

def put(g, x, y, c):
  if 0 <= y < len(g) and 0 <= x < len(g[0]): g[y][x] = c

def image(g):
  im = Image.new("RGBA", (len(g[0]), len(g)), (0, 0, 0, 0)); p = im.load()
  for y, row in enumerate(g):
    for x, c in enumerate(row):
      if c != ".": col = PAL[c]; p[x, y] = col if len(col) == 4 else col + (255,)
  return im

def sheet(ims, cols, path, s=8):
  w, h = max(i.width for i in ims), max(i.height for i in ims)
  out = Image.new("RGBA", (cols * (w * s + 8), -(-len(ims) // cols) * (h * s + 8)), (200, 215, 190, 255))
  for i, im in enumerate(ims): out.alpha_composite(im.resize((im.width * s, im.height * s), Image.NEAREST), ((i % cols) * (w * s + 8), (i // cols) * (h * s + 8)))
  out.save(path)
