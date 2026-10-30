# Draws the desert ground, sprites/ground/desert.png: one seamless 288 px tile (36 m at 8 px a meter) under both exhibits (#b-desert) and the park (#p-desert).
# Pale calm sand (BIOMES.desert.color), faint 1 px specks about one every 4 square meters, and a few small details about one every 40: stair-stepped dune arcs,
# dry grass tufts, twigs, pebble trios and small rocks, all in low-contrast tans so the outlined animals and buildings stand out. Everything wraps over the edges.
# Usage: python3 -I tools/pixelground_desert.py [outdir]
import sys, os, random
from PIL import Image

N = 288
H = lambda h: tuple(int(h[i:i+2], 16) for i in (1, 3, 5))
PAL = {
  "b": H("#F0DDB2"),   # sand: BIOMES.desert.color in data.js
  "s": H("#D9C094"),   # faint speck
  "d": H("#C4A574"),   # darker speck, rock body
  "l": H("#E2CB9C"),   # dune line, lit side
  "m": H("#D6BA88"),   # dune line, shaded side and the ground under a tuft
  "t": H("#A9835A"),   # twig, tuft
  "T": H("#82603F"),   # twig, tuft, dark
  "p": H("#CDAE7E"),   # pebble lit top
  "P": H("#A88660"),   # pebble shade
}
STAMPS = {
  "tuft":    ["t...t.t", ".t.t.t.", "..tTt..", "..mmm.."],
  "tuft2":   [".t.t.", "t.tt.", ".tT..", ".mm.."],
  "twig":    ["....t....", ".ttT.t...", "TT....Tt.", ".......T."],
  "twig2":   ["..t..t", "TTtTt.", "...m.."],
  "pebbles": ["pp.....", "PP..p..", "....P.p", "......P"],
  "rock":    [".ppp.", "pdddd", "PPPPP"],
  "dune":    [".......llllll........", "....llll.....llll.....", "..lll...........mmm...", "ll.................mm."],
  "dune2":   ["......lllll.....", "...llll....mm...", ".lll.........mm.", "l...............m"],
}
WEIGHTS = [("dune", 3), ("dune2", 3), ("tuft", 2), ("tuft2", 2), ("twig", 1), ("twig2", 1), ("pebbles", 2), ("rock", 1)]

def desert_tile(seed=11):
  rnd = random.Random(seed)
  im = Image.new("RGB", (N, N), PAL["b"]); p = im.load()
  def put(x, y, c): p[x % N, y % N] = PAL[c]
  for _ in range(N * N // 256): put(rnd.randrange(N), rnd.randrange(N), "d" if rnd.random() < .25 else "s")
  bag = [k for k, w in WEIGHTS for _ in range(w)]
  for _ in range(N * N // 2560):
    name, x0, y0 = rnd.choice(bag), rnd.randrange(N), rnd.randrange(N)
    for y, row in enumerate(STAMPS[name]):
      for x, c in enumerate(row):
        if c != ".": put(x0 + x, y0 + y, c)
  return im

if __name__ == "__main__":
  out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "sprites", "ground")
  im = desert_tile(); im.save(f"{out}/desert.png"); print("desert", im.size, len(set(im.get_flattened_data())), "colors")
