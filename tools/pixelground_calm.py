# Draws the calm ground tiles, sprites/ground/<biome>.png for every biome: one seamless 288 px tile each (36 m at 8 px a meter) under both exhibits (#b-<biome>)
# and the park (#p-<biome>). A flat floor (BIOMES.<biome>.color), faint 1 px specks, and a few small details in low-contrast tones, so the outlined animals and buildings
# stand out. Everything wraps over the edges. Desert: sand with dune arcs, dry tufts, twigs, pebble trios and small rocks. Scrubland: terracotta hardpan (Permian red beds) with cracks,
# red sandstone pebbles and chips, twigs and dead brush (no grass, so it suits the Permian on). Boreal: dark olive moss floor with fallen needles,
# pine cones, moss clumps, twigs and grey stones. Grassland: grass tufts, dry blades, seed heads and pebbles (Neogene on). Wetland: small pools, mud, algae and dead stems.
# Fern Prairie: bare loam with fern fronds, horsetail stubs, cracks and pebbles. Seasonal Forest: moss, plant litter, twigs and stones. Tundra: frost cracks, green and ochre lichen
# and grey stones. Tropical: plant litter, red-brown humus, sprouts, roots and twigs. Nothing from after a biome's first period (no leaves before broadleaf trees, no grass before the Neogene).
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
  "grassland": dict(seed=53, specks=240, details=2200, pal={
      "b": "#C5BB29",   # sunlit grass floor: BIOMES.grassland.color in data.js
      "s": "#BBB126",   # faint speck
      "d": "#AFA524",   # darker speck
      "g": "#ADAA2A",   # grass tuft lit
      "G": "#959424",   # grass tuft dark
      "y": "#D1C746",   # dry blade, pale
      "t": "#9C8A36",   # twig, seed head
      "T": "#7E6E2C",   # twig, dark
      "p": "#BCB078",   # pebble lit
      "P": "#9C9058",   # pebble shade
      "m": "#B9AF27",   # ground shade under things
    }, stamps={
      "tuft":   ["g.g.g", ".gGg.", "..G..", ".mmm."],
      "tuft2":  ["..g.g..", "g.gGg.g", ".gGGGg.", "..mmm.."],
      "blades": ["y...y.", ".y.y..", "..yy.y", "...y.."],
      "seeds":  [".t.t.", "t.T.t", "..g..", ".mm.."],
      "twig":   ["...t.....", "TttT.t...", "....TTt..", ".......T."],
      "pebs":   [".pp....", "pPPP.p.", ".mm..P.", "......."],
      "stone":  [".ppp.", "pPPPP", ".mmm."],
    }, weights=[("tuft", 3), ("tuft2", 2), ("blades", 3), ("seeds", 2), ("twig", 1), ("pebs", 2), ("stone", 1)]),
  "wetland": dict(seed=61, specks=220, details=2000, pal={
      "b": "#5B6D2B",   # marsh mud and algae: BIOMES.wetland.color in data.js
      "s": "#566828",   # faint speck
      "d": "#4F6025",   # darker speck
      "o": "#64772F",   # algae, moss lit
      "O": "#506427",   # algae, moss
      "u": "#535A27",   # mud
      "U": "#474D22",   # mud, deep
      "w": "#536A4A",   # small pool
      "l": "#6F8A6C",   # pool glint
      "t": "#4A4823",   # dead stem
      "T": "#3C3A1D",   # dead stem, dark
      "p": "#7A7A5C",   # pebble lit
      "P": "#62634C",   # pebble shade
      "m": "#56682A",   # ground shade under things
    }, stamps={
      "pool":   [".www..", "wlwwww", ".wwww.", "..mm.."],
      "pool2":  [".ww.", "wlww", ".mm."],
      "mud":    ["..uu...", ".uUUuu.", "uUUUUu.", ".uuu..."],
      "mud2":   [".uu.", "uUUu", ".uu."],
      "algae":  ["..oo..", ".oOOo.", "oOOOOo", ".mmmm."],
      "algae2": [".o.o", "oOo.", ".mm."],
      "stems":  ["t....t.", ".T..t..", "..TT...", "....T.."],
      "pebs":   [".pp...", "pPP.p.", ".mm.P."],
    }, weights=[("pool", 2), ("pool2", 2), ("mud", 2), ("mud2", 3), ("algae", 2), ("algae2", 2), ("stems", 2), ("pebs", 2)]),
  "fern": dict(seed=67, specks=240, details=2200, pal={
      "b": "#8F6843",   # bare loam between the ferns: BIOMES.fern.color in data.js
      "s": "#87623F",   # faint speck
      "d": "#7E5B3B",   # darker speck
      "f": "#7A7A3A",   # fern frond lit
      "F": "#61652E",   # fern frond dark
      "h": "#768446",   # horsetail stub
      "t": "#6E4E30",   # twig
      "T": "#593F27",   # twig, dark
      "c": "#835E3C",   # crack
      "p": "#A57F5A",   # pebble lit
      "P": "#7C5736",   # pebble shade
      "m": "#896340",   # ground shade under things
    }, stamps={
      "frond":  ["f.f.f..", ".fFfFf.", "..f.F.f", "...mm.."],
      "frond2": [".f.f", "fFF.", ".Ff.", ".mm."],
      "curl":   [".ff.", "f..F", ".FF.", "..m."],
      "horse":  ["h..h", "F..h", "h..F", "mm.m"],
      "twig":   ["...t.....", "TttT.t...", "....TTt..", ".......T."],
      "crack":  ["c......", ".cc..c.", "...cc..", "....c.."],
      "pebs":   [".pp....", "pPP..p.", ".mm..P."],
      "stone":  [".ppp.", "pPPPP", ".mmm."],
    }, weights=[("frond", 2), ("frond2", 3), ("curl", 1), ("horse", 2), ("twig", 2), ("crack", 2), ("pebs", 2), ("stone", 1)]),
  "temperate": dict(seed=71, specks=220, details=2000, pal={
      "b": "#40813F",   # moss and groundcover: BIOMES.temperate.color in data.js
      "s": "#3C7A3B",   # faint speck
      "d": "#387337",   # darker speck
      "o": "#4C8D42",   # moss clump lit
      "O": "#367036",   # moss clump
      "h": "#4F6E38",   # humus, plant litter
      "H": "#456235",   # humus, dark
      "t": "#4E5A36",   # twig
      "T": "#3F4A2E",   # twig, dark
      "g": "#6E7C64",   # stone lit
      "G": "#58664F",   # stone
      "k": "#465440",   # stone shade
      "m": "#3C7A3B",   # ground shade under things
    }, stamps={
      "moss":   ["..ooo..", ".oOOoo.", "ooOOOo.", ".mmmm.."],
      "moss2":  [".oo.", "oOOo", ".mm."],
      "litter": ["h..h.", ".hH.h", "H.hH.", ".H..."],
      "litter2":["..h", "hH.", ".H."],
      "twig":   ["...t.....", "TttT.t...", "....TTt..", ".......T."],
      "twig2":  ["..t..t", "TTtTt.", "...m.."],
      "stone":  [".ggg.", "gGGGk", ".kkk."],
    }, weights=[("moss", 2), ("moss2", 3), ("litter", 3), ("litter2", 2), ("twig", 2), ("twig2", 1), ("stone", 1)]),
  "tundra": dict(seed=79, specks=220, details=2100, pal={
      "b": "#C3CDD4",   # frosted grit: BIOMES.tundra.color in data.js
      "s": "#B9C3CA",   # faint speck
      "d": "#ADB8C0",   # darker speck
      "c": "#B2BDC6",   # frost crack
      "C": "#A3AFB9",   # frost crack, deep
      "h": "#AFBCA9",   # lichen, green
      "H": "#98A794",   # lichen, green dark
      "y": "#C6C1A6",   # lichen, ochre
      "Y": "#ADA98E",   # lichen, ochre dark
      "g": "#A9B0B5",   # stone lit
      "G": "#8F979D",   # stone
      "k": "#7D858B",   # stone shade
      "m": "#BAC4CB",   # ground shade under things
    }, stamps={
      "crack":  ["...c.....", "..c.C....", ".c...CC..", "c......Cc"],
      "crack2": ["c......", ".CC..c.", "...Cc..", "....C..", "....c.."],
      "lichen": [".hh.", "hHHh", ".mh."],
      "lichen2":["..yy.", ".yYYy", "..Ym."],
      "spots":  ["h...y", "..H..", "y...h"],
      "pebs":   [".gg....", "gGGk.g.", ".kk..G.", "......."],
      "stone":  [".ggg.", "gGGGk", ".kkk."],
    }, weights=[("crack", 3), ("crack2", 2), ("lichen", 2), ("lichen2", 2), ("spots", 2), ("pebs", 2), ("stone", 1)]),
  "tropical": dict(seed=83, specks=200, details=1800, pal={
      "b": "#155310",   # wet forest floor: BIOMES.tropical.color in data.js
      "s": "#144D0F",   # faint speck
      "d": "#12470E",   # darker speck
      "l": "#3A4A16",   # plant litter, olive
      "L": "#2E3C12",   # plant litter, dark
      "r": "#4A3A16",   # red-brown humus
      "R": "#3A2D12",   # humus, dark
      "n": "#1F6618",   # sprout lit
      "N": "#195C13",   # sprout
      "t": "#36361A",   # twig, root
      "T": "#282A13",   # twig, root, dark
      "m": "#134E0F",   # ground shade under things
    }, stamps={
      "litter": ["l..l.", ".lL.l", "L.lL.", ".L..."],
      "litter2":["..l", "lL.", ".L."],
      "humus":  [".rr..", "rRRr.", ".RRr.", "..m.."],
      "humus2": [".r.", "rRr", ".m."],
      "sprout": ["n.n", ".N.", ".m."],
      "sprout2":["n...n", ".nNn.", "..N..", ".mm.."],
      "root":   ["....t....", "TttT.TTt.", ".......Tt"],
      "twig":   ["...t.....", "TttT.t...", "....TTt..", ".......T."],
    }, weights=[("litter", 3), ("litter2", 3), ("humus", 2), ("humus2", 2), ("sprout", 2), ("sprout2", 1), ("root", 1), ("twig", 2)]),
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
