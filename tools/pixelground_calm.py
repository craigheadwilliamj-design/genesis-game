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
      "b": "#BAB45C",   # sunlit grass floor: BIOMES.grassland.color in data.js
      "s": "#B7B053",   # faint speck
      "d": "#B1AA4A",   # darker speck
      "g": "#B0AE50",   # grass tuft lit
      "G": "#9C9B46",   # grass tuft dark
      "y": "#C3BE7C",   # dry blade, pale
      "t": "#A39658",   # twig, seed head
      "T": "#897D4A",   # twig, dark
      "p": "#BFB99E",   # pebble lit
      "P": "#A29B7B",   # pebble shade
      "m": "#B6AF53",   # ground shade under things
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
      "b": "#265523",   # wet forest floor: BIOMES.tropical.color in data.js
      "s": "#255021",   # faint speck
      "d": "#224B1F",   # darker speck
      "l": "#424E27",   # plant litter, olive
      "L": "#374221",   # plant litter, dark
      "r": "#4E4227",   # red-brown humus
      "R": "#403620",   # humus, dark
      "n": "#32652D",   # sprout lit
      "N": "#2B5C27",   # sprout
      "t": "#3D3D27",   # twig, root
      "T": "#31321F",   # twig, root, dark
      "m": "#245121",   # ground shade under things
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

# The two other grounds each biome paints with (GROUND_KINDS in js/data.js), sprites/ground/<biome>-<kind>.png, same size and recipe. Their "b" is GROUND_KINDS' color.
# They count as their biome; they only give an exhibit's floor some variety. Same era rule as above.
STONES = {"pebs": [".pp....", "pPPP.p.", ".mm..P.", "......."], "stone": [".ppp.", "pPPPP", ".mmm."], "chip": ["pP", "PP"]}
TWIGS = {"twig": ["...t.....", "TttT.t...", "....TTt..", ".......T."], "twig2": ["..t..t", "TTtTt.", "...m.."]}
CRACKS = {"crack": ["...c.....", "..c.C....", ".c...CC..", "c......Cc"], "crack2": ["c......", ".CC..c.", "...Cc..", "....C..", "....c.."], "crack3": ["..c..", "CC.cc", "..C..", "..c.."]}
KINDS = {
  "desert-gravel": dict(seed=111, specks=180, details=1100, pal={"b": "#D9C39B", "s": "#CFB78E", "d": "#BFA57D", "p": "#E6D3AD", "P": "#A88B66", "m": "#CDB68D", "t": "#A9835A", "T": "#82603F"},
      stamps={**STONES, **TWIGS}, weights=[("pebs", 4), ("stone", 3), ("chip", 5), ("twig", 1)]),
  "desert-salt": dict(seed=113, specks=260, details=1600, pal={"b": "#F3EEE0", "s": "#E9E3D2", "d": "#DCD4BF", "c": "#E2DBC7", "C": "#D3CAB2", "p": "#D8CBAA", "P": "#BFAF8C", "m": "#E8E2D1"},
      stamps={**CRACKS, "pebs": STONES["pebs"]}, weights=[("crack", 4), ("crack2", 4), ("crack3", 4), ("pebs", 1)]),
  "scrubland-rubble": dict(seed=123, specks=200, details=1000, pal={"b": "#C9917A", "s": "#BE8770", "d": "#AC7660", "p": "#CF7F55", "P": "#9A5434", "m": "#BC8670", "t": "#94704E", "T": "#6E5038"},
      stamps={**STONES, "twig": TWIGS["twig"], "rock": [".ppp..", "pPPPp.", "pPPPPP", ".mmmm."]}, weights=[("pebs", 3), ("stone", 3), ("chip", 4), ("rock", 2), ("twig", 1)]),
  "scrubland-wash": dict(seed=127, specks=220, details=1700, pal={"b": "#E2C3A3", "s": "#D7B696", "d": "#C9A584", "l": "#EBD0B3", "n": "#D2AE8C", "p": "#C8936E", "P": "#A87556", "m": "#D8B999", "t": "#94704E", "T": "#6E5038"},
      stamps={"ripple": ["..llllll...", "ll......nn.", "..........n"], "ripple2": [".llll...", "l....nn."], "pebs": STONES["pebs"], "chip": STONES["chip"], "twig": TWIGS["twig"]},
      weights=[("ripple", 4), ("ripple2", 4), ("pebs", 2), ("chip", 2), ("twig", 1)]),
  "boreal-needles": dict(seed=141, specks=200, details=1300, pal={"b": "#5C5341", "s": "#554C3B", "d": "#4C4434", "n": "#6A5E46", "N": "#463E2F", "c": "#4E4332", "C": "#3F3628", "k": "#2F291F", "m": "#564D3C", "t": "#43392A", "T": "#352D21"},
      stamps={"needles": ["n...n..", ".N.n..n", "..n.Nn.", ".n...n."], "needles2": ["..n.N", "nn.n.", "...nN"], "cone": [".cC.", "cCCk", ".kk."], **TWIGS},
      weights=[("needles", 4), ("needles2", 4), ("cone", 2), ("twig", 2), ("twig2", 1)]),
  "boreal-lichen": dict(seed=143, specks=200, details=1300, pal={"b": "#666C64", "s": "#5F655D", "d": "#565C54", "h": "#7C876E", "H": "#6B7560", "y": "#857F62", "p": "#757B74", "P": "#4E544D", "m": "#60665E", "o": "#4F5F47", "O": "#45553E"},
      stamps={"lichen": [".hh.", "hHHh", ".mh."], "lichen2": ["..yy.", ".yhhy", "..ym."], "spots": ["h...y", "..H..", "y...h"], "moss": [".oo.", "oOOo", ".mm."], **STONES},
      weights=[("lichen", 3), ("lichen2", 2), ("spots", 3), ("moss", 2), ("pebs", 2), ("stone", 2), ("chip", 2)]),
  "grassland-straw": dict(seed=153, specks=220, details=1500, pal={"b": "#CCC07E", "s": "#C4B875", "d": "#B8AC69", "y": "#D9CF95", "Y": "#B5A766", "t": "#A39658", "T": "#897D4A", "g": "#B7B25E", "m": "#C3B776", "p": "#C9C2A6", "P": "#A9A182"},
      stamps={"blades": ["y...y.", ".Y.y..", "..yY.y", "...Y.."], "blades2": ["y.y", ".Yy", "Y.."], "seeds": [".t.t.", "t.T.t", "..Y..", ".mm.."], "tuft": ["g.g.g", ".gYg.", "..Y..", ".mmm."], "pebs": STONES["pebs"]},
      weights=[("blades", 4), ("blades2", 4), ("seeds", 2), ("tuft", 2), ("pebs", 1)]),
  "grassland-bare": dict(seed=157, specks=200, details=1600, pal={"b": "#A99168", "s": "#A0885F", "d": "#947D56", "g": "#A6A250", "G": "#8E8C44", "c": "#9C855C", "C": "#8C7650", "p": "#BBA684", "P": "#8D7653", "m": "#A08960"},
      stamps={"tuft": ["g.g.g", ".gGg.", "..G..", ".mmm."], "tuft2": [".g.g", "gGg.", ".mm."], "crack": CRACKS["crack"], "crack3": CRACKS["crack3"], **STONES},
      weights=[("tuft", 2), ("tuft2", 3), ("crack", 2), ("crack3", 2), ("pebs", 2), ("stone", 1), ("chip", 2)]),
  "wetland-mud": dict(seed=161, specks=200, details=1300, pal={"b": "#665B3A", "s": "#5F5536", "d": "#564C30", "w": "#56614F", "l": "#76866F", "c": "#5A5033", "C": "#4D442B", "t": "#4A4823", "T": "#3C3A1D", "m": "#5E5436", "o": "#5E6C2E", "O": "#4F5C27"},
      stamps={"pool": [".www..", "wlwwww", ".wwww.", "..mm.."], "pool2": [".ww.", "wlww", ".mm."], "crack": CRACKS["crack"], "crack2": CRACKS["crack2"], "stems": ["t....t.", ".T..t..", "..TT...", "....T.."], "algae": [".o.o", "oOo.", ".mm."]},
      weights=[("pool", 2), ("pool2", 3), ("crack", 2), ("crack2", 2), ("stems", 2), ("algae", 2)]),
  "wetland-peat": dict(seed=163, specks=200, details=1200, pal={"b": "#443F27", "s": "#3F3A24", "d": "#373220", "o": "#5D7230", "O": "#4C5F28", "y": "#6F7A36", "u": "#3A3520", "U": "#302B1A", "t": "#57532C", "T": "#2E2B18", "m": "#3E3923"},
      stamps={"hummock": ["..oo..", ".oyOo.", "oOOOOo", ".mmmm."], "hummock2": [".oy.", "oOOo", ".mm."], "moss": ["o.o", ".O.", "o.."], "mud": [".uu.", "uUUu", ".uu."], "stems": ["t....t.", ".T..t..", "..TT...", "....T.."]},
      weights=[("hummock", 2), ("hummock2", 3), ("moss", 3), ("mud", 2), ("stems", 2)]),
  "fern-fronds": dict(seed=167, specks=220, details=1000, pal={"b": "#6F6A3A", "s": "#686336", "d": "#5E5A31", "f": "#828443", "F": "#5B5F2C", "h": "#7E8C4C", "t": "#5B4A2C", "T": "#4A3C24", "m": "#67623A"},
      stamps={"frond": ["f.f.f..", ".fFfFf.", "..f.F.f", "...mm.."], "frond2": [".f.f", "fFF.", ".Ff.", ".mm."], "curl": [".ff.", "f..F", ".FF.", "..m."], "horse": ["h..h", "F..h", "h..F", "mm.m"], "twig": TWIGS["twig"]},
      weights=[("frond", 3), ("frond2", 4), ("curl", 2), ("horse", 2), ("twig", 1)]),
  "fern-silt": dict(seed=169, specks=220, details=1700, pal={"b": "#AD8C66", "s": "#A4835E", "d": "#987856", "l": "#B99A75", "n": "#9E7E59", "p": "#C2A37E", "P": "#8E6C4A", "m": "#A5845F", "f": "#7A7A3A", "F": "#61652E"},
      stamps={"ripple": ["..llllll...", "ll......nn.", "..........n"], "ripple2": [".llll...", "l....nn."], "frond2": [".f.f", "fFF.", ".Ff.", ".mm."], "pebs": STONES["pebs"], "chip": STONES["chip"]},
      weights=[("ripple", 4), ("ripple2", 4), ("frond2", 1), ("pebs", 2), ("chip", 2)]),
  "temperate-litter": dict(seed=171, specks=200, details=1100, pal={"b": "#5C5A36", "s": "#565432", "d": "#4E4C2D", "h": "#6C6439", "H": "#4B4429", "o": "#4C7A3E", "O": "#3E6834", "t": "#4A3F28", "T": "#3B3220", "m": "#55532F"},
      stamps={"litter": ["h..h.", ".hH.h", "H.hH.", ".H..."], "litter2": ["..h", "hH.", ".H."], "moss2": [".oo.", "oOOo", ".mm."], **TWIGS},
      weights=[("litter", 4), ("litter2", 4), ("moss2", 2), ("twig", 2), ("twig2", 2)]),
  "temperate-rocky": dict(seed=173, specks=200, details=1100, pal={"b": "#5D7350", "s": "#576C4B", "d": "#506445", "o": "#4C8D42", "O": "#3E7537", "p": "#7E8A76", "P": "#56604F", "m": "#566B4A", "t": "#4E5A36", "T": "#3F4A2E"},
      stamps={**STONES, "rock": [".ppp..", "pPPPp.", "pPPPPP", ".mmmm."], "moss2": [".oo.", "oOOo", ".mm."], "twig": TWIGS["twig"]},
      weights=[("pebs", 3), ("stone", 3), ("chip", 3), ("rock", 2), ("moss2", 3), ("twig", 1)]),
  "tundra-snow": dict(seed=179, specks=300, details=2400, pal={"b": "#E9EEF2", "s": "#E0E6EB", "d": "#D4DCE3", "l": "#F4F7F9", "n": "#D6DEE5", "p": "#A9B0B5", "P": "#8F979D", "m": "#DCE3E9"},
      stamps={"drift": [".......llllll........", "....llll.....llll.....", "..lll...........nnn...", "ll.................nn."], "drift2": ["......lllll.....", "...llll....nn...", ".lll.........nn.", "l...............n"], "pebs": [".pp..", "pPP.p", ".mm.P"]},
      weights=[("drift", 3), ("drift2", 3), ("pebs", 1)]),
  "tundra-heath": dict(seed=181, specks=220, details=1100, pal={"b": "#A9AD91", "s": "#A1A589", "d": "#979B80", "h": "#93A283", "H": "#7E8E72", "y": "#BDB48A", "Y": "#A39A72", "r": "#9C7A68", "p": "#B3B8B6", "P": "#878F94", "m": "#A2A68A"},
      stamps={"lichen": [".hh.", "hHHh", ".mh."], "lichen2": ["..yy.", ".yYYy", "..Ym."], "spots": ["h...y", "..H..", "y...h"], "berry": [".h.", "hrH", ".m."], "pebs": STONES["pebs"]},
      weights=[("lichen", 3), ("lichen2", 3), ("spots", 3), ("berry", 1), ("pebs", 2)]),
  "tropical-clay": dict(seed=183, specks=200, details=1400, pal={"b": "#7A4630", "s": "#723F2B", "d": "#673827", "c": "#6E3E2A", "C": "#5E3323", "n": "#3F6A2E", "N": "#335C27", "t": "#55331F", "T": "#452819", "p": "#93604A", "P": "#5E3828", "m": "#703F2B"},
      stamps={"crack": CRACKS["crack"], "crack3": CRACKS["crack3"], "sprout": ["n.n", ".N.", ".m."], "root": ["....t....", "TttT.TTt.", ".......Tt"], "pebs": STONES["pebs"], "chip": STONES["chip"]},
      weights=[("crack", 2), ("crack3", 2), ("sprout", 2), ("root", 2), ("pebs", 2), ("chip", 2)]),
  "tropical-litter": dict(seed=187, specks=200, details=1000, pal={"b": "#3E4426", "s": "#3A3F23", "d": "#343920", "l": "#525A2E", "L": "#2F3419", "r": "#57462A", "R": "#45371F", "n": "#32652D", "N": "#2B5C27", "t": "#3D3D27", "T": "#2A2A19", "m": "#393E22"},
      stamps={"litter": ["l..l.", ".lL.l", "L.lL.", ".L..."], "litter2": ["..l", "lL.", ".L."], "humus": [".rr..", "rRRr.", ".RRr.", "..m.."], "sprout": ["n.n", ".N.", ".m."], **TWIGS},
      weights=[("litter", 4), ("litter2", 4), ("humus", 2), ("sprout", 1), ("twig", 2), ("twig2", 1)]),
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
  for name, b in KINDS.items():
    im = calm_tile(**b); im.save(f"{out}/{name}.png"); print(name, im.size)
