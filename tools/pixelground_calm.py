# Draws the calm ground tiles, sprites/ground/<biome>.png for desert, scrubland and boreal (Coniferous Forest): one seamless 288 px tile each (36 m at 8 px a meter) under both exhibits (#b-<biome>)
# and the park (#p-<biome>). A pale flat floor (BIOMES.<biome>.color), faint 1 px specks, and a few small details in low-contrast tones, so the outlined animals and buildings
# stand out. Everything wraps over the edges. Desert: sand with dune arcs, dry tufts, twigs, pebble trios and small rocks. Scrubland: terracotta hardpan (Permian red beds) with cracks,
# red sandstone pebbles and chips, twigs and dead brush (no grass, so it suits the Permian on). Boreal: dark olive moss floor with fallen needles,
# pine cones, moss clumps, twigs and grey stones.
# Usage: python3 -I tools/pixelground_calm.py [outdir]
import sys, os, random
from PIL import Image

N = 288
H = lambda h: tuple(int(h[i:i+2], 16) for i in (1, 3, 5))
BIOMES = {
  "desert": dict(seed=11, specks=256, details=2560, pal={
      "b": "#F0DDB2",   # sand: BIOMES.desert.color in data.js
      "s": "#D9C094",   # faint speck
      "d": "#C4A574",   # darker speck, rock body
      "l": "#E2CB9C",   # dune line, lit side
      "m": "#D6BA88",   # dune line, shaded side and the ground under a tuft
      "t": "#A9835A",   # twig, tuft
      "T": "#82603F",   # twig, tuft, dark
      "p": "#CDAE7E",   # pebble lit top
      "P": "#A88660",   # pebble shade
    }, stamps={
      "tuft":    ["t...t.t", ".t.t.t.", "..tTt..", "..mmm.."],
      "tuft2":   [".t.t.", "t.tt.", ".tT..", ".mm.."],
      "twig":    ["....t....", ".ttT.t...", "TT....Tt.", ".......T."],
      "twig2":   ["..t..t", "TTtTt.", "...m.."],
      "pebbles": ["pp.....", "PP..p..", "....P.p", "......P"],
      "rock":    [".ppp.", "pdddd", "PPPPP"],
      "dune":    [".......llllll........", "....llll.....llll.....", "..lll...........mmm...", "ll.................mm."],
      "dune2":   ["......lllll.....", "...llll....mm...", ".lll.........mm.", "l...............m"],
    }, weights=[("dune", 3), ("dune2", 3), ("tuft", 2), ("tuft2", 2), ("twig", 1), ("twig2", 1), ("pebbles", 2), ("rock", 1)]),
  "scrubland": dict(seed=23, specks=240, details=2300, pal={
      "b": "#D9A98A",   # hardpan: BIOMES.scrubland.color in data.js
      "s": "#C8957A",   # faint speck
      "d": "#B07A60",   # darker speck
      "c": "#C08C70",   # crack
      "C": "#A6765C",   # crack, deep
      "r": "#C8794E",   # sandstone lit
      "R": "#A85E3A",   # sandstone body
      "q": "#7E4630",   # sandstone shade
      "t": "#94704E",   # twig, brush
      "T": "#6E5038",   # twig, brush, dark
      "m": "#CC9C80",   # ground shade under things
    }, stamps={
      "crack":  ["...c.....", "..c.C....", ".c...CC..", "c......Cc"],
      "crack2": ["c......", ".CC..c.", "...Cc..", "....C..", "....c.."],
      "crack3": ["..c..", "CC.cc", "..C..", "..c.."],
      "pebs":   [".rr....", "rRRq.r.", ".qq..Rq", "......."],
      "stone":  [".rrr.", "rRRRq", "RRRqq", ".mmm."],
      "chip":   ["rR", "qq"],
      "twig":   ["...t.....", "TttT.t...", "....TTt..", ".......T."],
      "brush":  ["t.t.t", ".tTt.", "t.T.t", ".mmm."],
      "brush2": ["..t.t..", "t.tTt.t", ".tTTTt.", "..mmm.."],
    }, weights=[("crack", 3), ("crack2", 2), ("crack3", 2), ("pebs", 2), ("stone", 1), ("chip", 2), ("twig", 2), ("brush", 2), ("brush2", 1)]),
  "boreal": dict(seed=41, specks=220, details=1900, pal={
      "b": "#4F594A",   # dark olive moss floor, a touch of spruce blue: BIOMES.boreal.color in data.js
      "s": "#485344",   # faint speck
      "d": "#404A3C",   # darker speck
      "n": "#424131",   # fallen needles
      "c": "#463E2F",   # pine cone lit
      "C": "#3A3426",   # pine cone body
      "k": "#2D2B20",   # pine cone shade
      "o": "#3D4D37",   # moss clump lit
      "O": "#33442E",   # moss clump
      "m": "#495345",   # ground shade under things
      "t": "#373528",   # twig
      "T": "#2B2C22",   # twig, dark
      "g": "#575F58",   # stone lit
      "G": "#4A514B",   # stone
    }, stamps={
      "needles":  ["n...n..", ".n.n..n", "..n.nn.", ".n...n."],
      "needles2": ["..n.n", "nn.n.", "...nn"],
      "cone":     [".cC.", "cCCk", ".kk."],
      "cones":    [".cC....", "cCCk.cC", ".kk.cCk", ".....k."],
      "moss":     ["..ooo..", ".oOOoo.", "ooOOOo.", ".mmmm.."],
      "moss2":    [".oo.", "oOOo", ".mm."],
      "twig":     ["...t.....", "TttT.t...", "....TTt..", ".......T."],
      "stone":    [".ggg.", "gGGGk", ".kkk."],
    }, weights=[("needles", 3), ("needles2", 3), ("cone", 2), ("cones", 1), ("moss", 2), ("moss2", 2), ("twig", 2), ("stone", 1)]),
}

def calm_tile(seed, specks, details, pal, stamps, weights):
  rnd = random.Random(seed); pal = {k: H(v) for k, v in pal.items()}
  im = Image.new("RGB", (N, N), pal["b"]); p = im.load()
  def put(x, y, c): p[x % N, y % N] = pal[c]
  for _ in range(N * N // specks): put(rnd.randrange(N), rnd.randrange(N), "d" if rnd.random() < .25 else "s")   # about one speck every specks / 64 square meters, mostly faint
  bag = [k for k, w in weights for _ in range(w)]
  for _ in range(N * N // details):   # about one detail every details / 64 square meters
    name, x0, y0 = rnd.choice(bag), rnd.randrange(N), rnd.randrange(N)
    for y, row in enumerate(stamps[name]):
      for x, c in enumerate(row):
        if c != ".": put(x0 + x, y0 + y, c)
  return im

if __name__ == "__main__":
  out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "sprites", "ground")
  for name, b in BIOMES.items():
    im = calm_tile(**b); im.save(f"{out}/{name}.png"); print(name, im.size, len(set(im.get_flattened_data())), "colors")
