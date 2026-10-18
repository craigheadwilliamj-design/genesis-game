# Draws the vivarium scenes in the flat pixel style (see CLAUDE.md, Art direction): flat fills, no outlines, stair-stepped shapes, light from the top left,
# 0.13 m a pixel. A scene is an era (paleozoic, mesozoic, cenozoic) and a biome (the BIOMES keys in js/data.js), drawn as two layers for each case size:
#   <scene>-<S|M|L>-wall.png    the back wall, the pane above the sill (sky, far hills, far and near plants, a strip of ground)
#   <scene>-<S|M|L>-floor.png   the floor, flat and seen from above (rows squashed by TILT like the rest of the 3/4 art)
# <scene> is "<era>-<biome>" (a later "<period>-<biome>" scene overrides its era; see VIV_SCENE_PERIODS in data.js). Every picture is built from the same
# parts (shapes, palettes, layout), sized from the case, so a new size or scene comes from the tables below and is never drawn by hand.
# Usage: python3 -I tools/pixelvivscene.py [outdir] [--sheet sheet.png]   (default sprites/vivscene; the sheet is a x4 view of every scene)
import sys, os, math, zlib, random
from PIL import Image

PX, TILT = .13, .7
SIZES = {"S":(6, 4, .35), "M":(10, 6, .45), "L":(16, 10, .55)}   # w, d (VIVARIUMS) and sill height (VIV34 in map.js); the glass stands d * .45 tall
def dims(size):
    w, d, sill = SIZES[size]
    return round(w / PX), round((d * .45 - sill) / PX), round(d * TILT / PX)   # width, wall rows, floor rows

def mix(a, b, t): return tuple(round(x * (1 - t) + y * t) for x, y in zip(a, b))
def ramp(base): return {"hi": mix(base, (255, 255, 255), .26), "mid": base, "lo": mix(base, (0, 0, 0), .22), "deep": mix(base, (0, 0, 0), .42)}

ERAS = {   # leaf and trunk colors, and a haze laid over the sky
    "paleozoic": {"leaf":(46, 104, 86), "trunk":(88, 86, 62), "haze":((176, 198, 166), .35)},
    "mesozoic":  {"leaf":(84, 118, 44), "trunk":(118, 86, 56), "haze":((222, 208, 176), .25)},
    "cenozoic":  {"leaf":(78, 138, 54), "trunk":(112, 84, 58), "haze":((200, 220, 236), .1)},
}
BIOMES = {   # ground, sky, a tint pulled into the leaves, how thick the plants stand, the floor's decals; wet ones get a strip of water
    "desert":    {"ground":(206, 182, 122), "sky":(234, 216, 172), "tint":((176, 156, 84), .45), "dens":.35, "dec":["ripple", "pebble", "ripple"]},
    "tropical":  {"ground":(88, 72, 44),    "sky":(178, 208, 172), "tint":((30, 112, 40), .25),  "dens":1.4, "dec":["litter", "frond", "pebble"]},
    "grassland": {"ground":(176, 160, 92),  "sky":(196, 220, 232), "tint":((172, 172, 70), .3),  "dens":.6,  "dec":["tuft", "tuft", "pebble"]},
    "fern":      {"ground":(128, 96, 58),   "sky":(208, 214, 188), "tint":((100, 122, 40), .15), "dens":.8,  "dec":["frond", "tuft", "pebble"]},
    "scrubland": {"ground":(162, 120, 76),  "sky":(228, 210, 174), "tint":((134, 122, 62), .35), "dens":.55, "dec":["pebble", "tuft", "pebble"]},
    "wetland":   {"ground":(86, 94, 62),    "sky":(188, 210, 198), "tint":((60, 112, 82), .2),   "dens":.9,  "dec":["puddle", "moss", "tuft"], "wet":True},
    "temperate": {"ground":(106, 86, 56),   "sky":(190, 214, 224), "tint":((60, 120, 50), .1),   "dens":1.0, "dec":["litter", "litter", "pebble"]},
    "boreal":    {"ground":(94, 80, 60),    "sky":(178, 198, 202), "tint":((30, 70, 52), .35),   "dens":1.0, "dec":["needles", "moss", "pebble"]},
    "tundra":    {"ground":(152, 150, 130), "sky":(216, 226, 232), "tint":((142, 152, 132), .4), "dens":.4,  "dec":["snow", "moss", "pebble"]},
}
STONE, WATER, SNOW, LITTER = ramp((130, 126, 116)), ramp((70, 128, 150)), ramp((226, 232, 236)), ramp((168, 120, 58))

# What grows where: (shape, weight) lists for the near row; the far row draws from the same list
FOREST = {"paleozoic":[("lycopsid", 3), ("treefern", 2), ("horsetail", 2)], "mesozoic":[("conifer", 3), ("treefern", 2), ("cycad", 2)], "cenozoic":[("broadleaf", 4), ("bush", 1)]}
FLORA = {
    "tropical":  {"paleozoic":[("lycopsid", 3), ("treefern", 3), ("fernmound", 1)], "mesozoic":[("treefern", 3), ("cycad", 2), ("conifer", 1)], "cenozoic":[("palm", 3), ("broadleaf", 3), ("fernmound", 1)]},
    "temperate": FOREST,
    "boreal":    {"paleozoic":[("lycopsid", 4), ("horsetail", 2)], "mesozoic":[("conifer", 5), ("fernmound", 1)], "cenozoic":[("conifer", 5), ("bush", 1)]},
    "wetland":   {"paleozoic":[("lycopsid", 2), ("horsetail", 4)], "mesozoic":[("horsetail", 3), ("treefern", 2), ("cycad", 1)], "cenozoic":[("reeds", 4), ("broadleaf", 2)]},
    "grassland": {"paleozoic":[("horsetail", 3), ("fernmound", 2)], "mesozoic":[("fernmound", 3), ("cycad", 1)], "cenozoic":[("grass", 5), ("bush", 1), ("broadleaf", 1)]},
    "fern":      {"paleozoic":[("fernmound", 4), ("horsetail", 2)], "mesozoic":[("fernmound", 4), ("cycad", 2), ("horsetail", 1)], "cenozoic":[("fernmound", 3), ("grass", 2)]},
    "scrubland": {"paleozoic":[("fernmound", 2), ("rock", 2), ("horsetail", 1)], "mesozoic":[("cycad", 2), ("bush", 2), ("rock", 1)], "cenozoic":[("bush", 4), ("grass", 1), ("rock", 1)]},
    "desert":    {"paleozoic":[("rock", 3), ("fernmound", 1)], "mesozoic":[("rock", 3), ("cycad", 1)], "cenozoic":[("rock", 2), ("cactus", 2)]},
    "tundra":    {"paleozoic":[("moss", 3), ("rock", 2), ("horsetail", 1)], "mesozoic":[("moss", 3), ("rock", 2), ("conifer", 1)], "cenozoic":[("moss", 3), ("grass", 2), ("rock", 2)]},
}
TALL = {"conifer":1, "broadleaf":1, "palm":1, "lycopsid":1, "treefern":.9, "horsetail":.6, "cycad":.55, "cactus":.6, "reeds":.55}   # height, as a share of the wall
LOW = {"fernmound":.32, "bush":.34, "grass":.26, "rock":.26, "moss":.16}

class Cv:
    def __init__(s, w, h): s.w, s.h, s.px = w, h, {}
    def put(s, x, y, c):
        if 0 <= x < s.w and 0 <= y < s.h: s.px[(x, y)] = c
    def img(s):
        im = Image.new("RGBA", (s.w, s.h), (0, 0, 0, 0))
        for (x, y), c in s.px.items(): im.putpixel((x, y), c + (255,))
        return im

def shade(c, mask, R, tex=True):
    # light from the top left: a pixel on the left or top edge of the shape is lit, one on the right or bottom edge shaded; leaf clumps as a regular dot pattern
    for (x, y) in mask:
        l, r, t, b = (x - 1, y) not in mask, (x + 1, y) not in mask, (x, y - 1) not in mask, (x, y + 1) not in mask
        col = R["hi"] if l and not r else R["lo"] if r and not l else R["hi"] if t and not b else R["lo"] if b and not t else R["mid"]
        if tex and col == R["mid"] and y % 3 == 1 and (x + y // 3 * 2) % 4 == 0: col = R["lo"]
        c.put(x, y, col)
def flat(c, mask, R):   # far away: one tone, darker on the right edge
    for (x, y) in mask: c.put(x, y, R["lo"] if (x + 1, y) not in mask else R["mid"])

def ell(cx, cy, rx, ry):
    return {(x, y) for y in range(math.floor(cy - ry), math.ceil(cy + ry) + 1) for x in range(math.floor(cx - rx), math.ceil(cx + rx) + 1)
            if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1}
def line(x0, y0, x1, y1, th=1):
    n = max(abs(x1 - x0), abs(y1 - y0)) or 1
    return {(round(x0 + (x1 - x0) * i / n) + k, round(y0 + (y1 - y0) * i / n)) for i in range(n + 1) for k in range(th)}

# Each shape returns (trunk pixels, leaf pixels, extra pixels in the trunk's darkest tone) standing on (x, b), h pixels tall
def conifer(x, b, h):
    top, th = b - h + 1, max(2, h // 4)
    trunk = {(x, y) for y in range(b - 1, b + 1)}
    leaf = set()
    for y in range(top, b - 1):
        r = y - top; half = min(h // 3 + 1, r // th + (r % th) * 2 // 3)
        leaf |= {(x + k, y) for k in range(-half, half + 1)}
    return trunk, leaf, set()
def broadleaf(x, b, h):
    R = max(2, h * .34); cy = b - h + R
    trunk = {(x + k, y) for y in range(round(cy), b + 1) for k in range(1 + (h > 16))}
    leaf = ell(x + .5, cy, R * 1.15, R) | ell(x - R * .6, cy + R * .45, R * .6, R * .5) | ell(x + R * .8, cy + R * .4, R * .55, R * .5)
    return trunk, leaf, set()
def palm(x, b, h):
    top = b - h + 2; trunk = set()
    for y in range(top, b + 1): trunk.add((x + (b - y) // 5, y))
    tx = x + (b - top) // 5; L = max(3, h // 3); leaf = set()
    for sd in (-1, 1):
        for i in range(L + 1): leaf.add((tx + sd * i, top + round(i * i / L * .6)))
        for i in range(L * 2 // 3 + 1): leaf.add((tx + sd * i, top - 1 + round(i * i / L * .3)))
    leaf |= {(tx, top - 1), (tx, top - 2)}
    return trunk, leaf, set()
def lycopsid(x, b, h):
    top = b - h + 1; trunk = {(x + k, y) for y in range(top + 2, b + 1) for k in range(2)}
    bark = {(x + (y // 2) % 2, y) for y in range(top + 3, b + 1) if y % 2 == 0}   # the diamond leaf-scar pattern
    leaf = {(x - 1, top + 1), (x, top), (x + 1, top), (x + 2, top + 1), (x - 2, top + 2), (x + 3, top + 2), (x, top + 1), (x + 1, top + 1)}
    leaf |= {(x - 1, y) for y in range(top + 3, top + h // 2, 3)} | {(x + 2, y) for y in range(top + 4, top + h // 2, 3)}
    return trunk, leaf, bark
def horsetail(x, b, h):
    top = b - h + 1; trunk = {(x, y) for y in range(top + 2, b + 1)}
    leaf = {(x + k, y) for y in range(top + 3, b - 1, 2) for k in (-1, 1)} | {(x + k, y) for y in range(top + 4, b - 2, 4) for k in (-2, 2)}
    return trunk, leaf, {(x, top), (x, top + 1)}   # the cone at the tip
def treefern(x, b, h):
    top = b - h + 2; trunk = {(x, y) for y in range(top, b + 1)}; L = max(3, h // 3); leaf = {(x, top - 1)}
    for sd in (-1, 1):
        for i in range(1, L + 1): leaf |= {(x + sd * i, top + round((i / L) ** 2 * L * .7)), (x + sd * i, top - 1 + round((i / L) ** 2 * L * .5))}
    return trunk, leaf, {(x, y) for y in range(top + 1, b + 1, 2)}
def cycad(x, b, h):
    th = max(2, h * 2 // 5); trunk = {(x + k, y) for y in range(b - th + 1, b + 1) for k in range(2)}
    bark = {(x + (y % 2), y) for y in range(b - th + 1, b + 1)}
    top, L, leaf = b - th, max(2, h - th), set()
    for a in (-150, -120, -90, -60, -30):
        ax, ay = math.cos(math.radians(a)), math.sin(math.radians(a))
        leaf |= line(x + (a > -90), top, round(x + (a > -90) + ax * L * 1.2), round(top + ay * L * .9))
    return trunk, leaf, bark
def fernmound(x, b, h):
    rx = h * 1.3; leaf = {p for p in ell(x, b + 1, rx, h) if p[1] <= b}
    tops = {p for p in leaf if (p[0], p[1] - 1) not in leaf}
    leaf -= {p for p in tops if p[0] % 3 == 0}   # notched frond tips
    leaf |= {(p[0], p[1] - 1) for p in tops if p[0] % 4 == 1}
    return set(), leaf, set()
def bush(x, b, h):
    leaf = {p for p in ell(x, b - h * .45, h * 1.1, h * .62) | ell(x - h * .7, b - h * .25, h * .5, h * .4) | ell(x + h * .75, b - h * .28, h * .5, h * .38) if p[1] <= b}
    return set(), leaf, set()
def grass(x, b, h):
    leaf = set()
    for k in (-2, -1, 0, 1, 2):
        hh = max(1, h - abs(k) * h // 4)
        for r in range(hh): leaf.add((x + k + (k * r) // max(1, h), b - r))
    return set(), leaf, set()
def reeds(x, b, h):
    trunk, extra = set(), set()
    for i, k in enumerate((-2, 0, 2)):
        hh = h - (i % 2) * h // 4
        trunk |= {(x + k, b - r) for r in range(hh - 2)}; extra |= {(x + k, b - hh + 1), (x + k, b - hh + 2)}
    return set(), trunk, extra   # stems drawn as leaf, heads in the trunk's dark tone
def cactus(x, b, h):
    leaf = {(x + k, y) for y in range(b - h + 1, b + 1) for k in range(3)}
    m = b - h // 2; leaf |= {(x - 1, m), (x - 2, m)} | {(x - 2, y) for y in range(m - 3, m)} | {(x + 3, m - 2), (x + 4, m - 2)} | {(x + 4, y) for y in range(m - 5, m - 2)}
    return set(), leaf, set()
def rock(x, b, h): return set(), {p for p in ell(x, b + 1, h * 1.4, h) if p[1] <= b}, set()
def moss(x, b, h): return set(), {p for p in ell(x, b + 1, max(2, h * 2.2), max(1.2, h)) if p[1] <= b}, set()
SHAPES = {k: globals()[k] for k in list(TALL) + list(LOW)}

def pick(rng, opts):
    n = rng.uniform(0, sum(w for _, w in opts))
    for k, w in opts:
        n -= w
        if n <= 0: return k
    return opts[-1][0]

def palette(era, biome):
    E, B = ERAS[era], BIOMES[biome]
    leaf = mix(E["leaf"], B["tint"][0], B["tint"][1]); sky = mix(B["sky"], E["haze"][0], E["haze"][1])
    return {"sky":ramp(sky), "hill":ramp(mix(sky, mix(leaf, B["ground"], .5), .42)), "far":ramp(mix(leaf, sky, .45)), "leaf":ramp(leaf),
            "trunk":ramp(E["trunk"]), "ground":ramp(B["ground"]), "stone":STONE if biome != "desert" else ramp((176, 150, 104))}

def plant(c, kind, x, b, h, P, far):
    trunk, leaf, extra = SHAPES[kind](x, b, h)
    lr = P["stone"] if kind == "rock" else P["far"] if far else P["leaf"]
    if far:
        flat(c, trunk | leaf, lr)
    else:
        shade(c, trunk, P["trunk"], False); shade(c, leaf, lr, kind != "rock")
        for p in extra: c.put(p[0], p[1], P["trunk"]["deep"])

def wall(era, biome, size):
    W, H, _ = dims(size); c = Cv(W, H); P, B = palette(era, biome), BIOMES[biome]
    rng = random.Random(zlib.crc32(f"{era}-{biome}-{size}-wall".encode()))
    g = max(2, round(H * .18)); hz = H - g   # the ground strip is the bottom g rows; hz is the first of them
    for y in range(hz):   # sky: two flat bands, lighter toward the horizon
        for x in range(W): c.put(x, y, P["sky"]["mid"] if y < hz * .45 else P["sky"]["hi"])
    hh = max(2, H // 4); ph = rng.uniform(0, 6)   # far hills: a stepped skyline, each step 3 px wide
    for x in range(W):
        sx = x // 3 * 3; top = hz - 1 - round(hh * (.55 + .3 * math.sin(sx * .09 + ph) + .15 * math.sin(sx * .23 + ph * 2)))
        for y in range(top, hz): c.put(x, y, P["hill"]["hi"] if y == top and x % 3 == 0 else P["hill"]["mid"])
    opts, dens = FLORA[biome][era], B["dens"]
    def row(far):
        step = max(3, round((7 if far else 10) / dens * (H / 20) ** .5)); x = rng.randrange(step)
        while x < W + 2:
            k = pick(rng, opts); share = TALL.get(k) or LOW[k]
            h = max(3, round(H * share * rng.uniform(.75, 1.1) * (.5 if far else 1)))
            plant(c, k, x, hz if far else H - 1 - rng.randrange(max(1, g - 1)), h, P, far)
            x += step + rng.randrange(-step // 3, step // 3 + 1)
    row(True)
    for y in range(hz, H):   # the ground strip, with a row of darker dashes; a wet biome has water along the back of it
        for x in range(W):
            wet = B.get("wet") and y == hz and x % 11 < 7
            c.put(x, y, WATER["hi" if x % 11 in (1, 2) else "mid"] if wet else P["ground"]["lo"] if (y - hz) % 2 == 1 and (x + y * 3) % 5 < 2 else P["ground"]["mid"])
    row(False)
    return c

def floor(era, biome, size):
    W, _, F = dims(size); c = Cv(W, F); P, B = palette(era, biome), BIOMES[biome]
    G = P["ground"]; rng = random.Random(zlib.crc32(f"{era}-{biome}-{size}-floor".encode()))
    for y in range(F):   # the substrate: flat, with rows of short darker dashes and every third row lighter ones (like the case floor in map.js)
        for x in range(W):
            dash = y % 3 == 1 and (x + (y // 3 * 7) % 5) % 6 < 2
            c.put(x, y, G["lo"] if y == 0 else (G["hi"] if y // 3 % 3 == 2 else G["lo"]) if dash else G["mid"])
    L, T = P["leaf"], P["trunk"]
    def decal(kind, x, y):
        if kind == "pebble": c.put(x, y, P["stone"]["hi"]); c.put(x + 1, y, P["stone"]["mid"]); c.put(x, y + 1, P["stone"]["lo"]); c.put(x + 1, y + 1, P["stone"]["lo"])
        elif kind == "ripple":
            for k in range(5): c.put(x + k, y, G["hi"]); c.put(x + k + 1, y + 1, G["lo"])
        elif kind == "tuft":
            for dx, dy in ((0, 0), (1, -1), (2, 0), (1, 0)): c.put(x + dx, y + dy, L["hi"] if dx == 0 else L["mid"] if dx == 1 else L["lo"])
        elif kind == "frond":
            for dx, dy, t in ((0, 0, "mid"), (-1, 0, "hi"), (-2, 0, "hi"), (1, 0, "lo"), (2, 0, "lo"), (0, -1, "hi"), (0, 1, "lo"), (-1, -1, "mid"), (1, 1, "lo")): c.put(x + dx, y + dy, L[t])
        elif kind == "litter":
            for dx, dy, t in ((0, 0, "mid"), (1, 0, "lo"), (3, 1, "hi"), (4, 1, "mid"), (1, 2, "lo")): c.put(x + dx, y + dy, LITTER[t])
        elif kind == "needles":
            for dx, dy in ((0, 0), (1, 1), (3, 0), (4, -1), (2, 2)): c.put(x + dx, y + dy, T["lo"])
        elif kind in ("moss", "puddle", "snow"):
            R = L if kind == "moss" else WATER if kind == "puddle" else SNOW; rx = rng.choice((2.5, 3.5, 4.5))
            m = ell(x, y, rx, max(1, rx * .4)); shade(c, m, R, False)
            if kind == "puddle": c.put(x - 1, y, mix(WATER["hi"], (255, 255, 255), .4)); c.put(x, y, mix(WATER["hi"], (255, 255, 255), .4))
    cw, ch = 9, 6   # one decal at most in each cell of a grid, nudged inside it, so they spread evenly
    for gy in range(1, F, ch):
        for gx in range(0, W, cw):
            if rng.random() < .35 + .25 * B["dens"]: decal(rng.choice(B["dec"]), gx + rng.randrange(1, cw - 2), min(F - 2, gy + rng.randrange(1, ch - 1)))
    return c

def scenes(): return [(e, b) for e in ERAS for b in BIOMES]

if __name__ == "__main__":
    args = [a for a in sys.argv[1:]]
    sheet = args[args.index("--sheet") + 1] if "--sheet" in args else None
    if sheet: del args[args.index("--sheet"):args.index("--sheet") + 2]
    out = args[0] if args else "sprites/vivscene"
    os.makedirs(out, exist_ok=True)
    ims = []
    for era, biome in scenes():
        row = []
        for size in SIZES:
            w, f = wall(era, biome, size).img(), floor(era, biome, size).img()
            for im, layer in ((w, "wall"), (f, "floor")):   # opaque with few colors: a palette PNG keeps the sprite pack small
                im.convert("RGB").convert("P", palette=Image.ADAPTIVE, colors=32).save(os.path.join(out, f"{era}-{biome}-{size}-{layer}.png"), optimize=True)
            row.append((w, f))
        ims.append(row)
    if sheet:
        Z, pad = 4, 4; cw = sum(dims(s)[0] + pad for s in SIZES) + pad; rh = max(dims(s)[1] + dims(s)[2] for s in SIZES) + pad
        im = Image.new("RGBA", (cw * Z, rh * len(ims) * Z + pad * Z), (40, 44, 48, 255))
        for i, row in enumerate(ims):
            x = pad
            for w, f in row:
                y = pad + i * rh
                im.alpha_composite(w.resize((w.width * Z, w.height * Z), Image.NEAREST), (x * Z, y * Z)); im.alpha_composite(f.resize((f.width * Z, f.height * Z), Image.NEAREST), (x * Z, (y + w.height) * Z))
                x += w.width + pad
        im.save(sheet)
    print(len(ims), "scenes,", len(ims) * len(SIZES) * 2, "pictures")
