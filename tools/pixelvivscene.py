# Draws the vivarium scenes in the park style (docs/art.md, "Park style"): flat fills with a dark edge tinted to each thing (near plants and rocks, floor
# decals; far plants, hills and the horizon get a softer one so they stay back), stair-stepped shapes, structured texture, light from the top left.
# Inside a case everything is drawn DET times finer than the park's 0.13 m a pixel (0.043 m), to match the animals, which are drawn that big in a case:
# every shape is sized in fine pixels, with strokes and spacing in units of U (= DET, one park pixel), and the texture and edges a fine pixel wide. A scene is an era (paleozoic, mesozoic, cenozoic) and a biome (the BIOMES keys in js/data.js), drawn as two layers for each case size:
#   <scene>-<S|M|L>-wall.png    the back wall, the pane above the sill (sky, far hills, far and near plants, a strip of ground)
#   <scene>-<S|M|L>-floor.png   the floor, flat and seen from above (rows squashed by TILT like the rest of the 3/4 art)
# <scene> is "<era>-<biome>" (a later "<period>-<biome>" scene overrides its era; see VIV_SCENE_PERIODS in data.js). Every picture is built from the same
# parts (shapes, palettes, layout), sized from the case, so a new size or scene comes from the tables below and is never drawn by hand.
# Usage: python3 -I tools/pixelvivscene.py [outdir] [--sheet sheet.png]   (default sprites/vivscene; the sheet is a x4 view of every scene)
import sys, os, math, zlib, random
from PIL import Image

PX, TILT, DET = .13, .7, 3   # DET: fine pixels to a park pixel inside a case
U = DET
FPX = PX / DET
SIZES = {"S":(10, 5, .65), "M":(15, 10, .78), "L":(25, 15, .91)}   # w, d (VIVARIUMS) and sill height (VIV34 in map.js); the glass stands d * .45 tall
def dims(size):
    w, d, sill = SIZES[size]
    return round(w / FPX), round((d * .45 - sill) / FPX), round(d * TILT / FPX)   # width, wall rows, floor rows, in fine pixels

def mix(a, b, t): return tuple(round(x * (1 - t) + y * t) for x, y in zip(a, b))
def ramp(base): return {"hi": mix(base, (255, 255, 255), .26), "mid": base, "lo": mix(base, (0, 0, 0), .22), "deep": mix(base, (0, 0, 0), .42), "edge": mix(base, (0, 0, 0), .66)}

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
        im = Image.new("RGBA", (s.w, s.h), (0, 0, 0, 0)); p = im.load()
        for (x, y), c in s.px.items(): p[x, y] = c + (255,)
        return im

def shade(c, mask, R, tex=True):
    # light from the top left: two fine pixels along the top and left edges lit, two along the bottom and right shaded; a leaf clump gets rows of short
    # dark and light leaf marks, staggered row to row (structured, not noise)
    for (x, y) in mask:
        l = (x - 1, y) not in mask or (x - 2, y) not in mask; r = (x + 1, y) not in mask or (x + 2, y) not in mask
        t = (x, y - 1) not in mask or (x, y - 2) not in mask; b = (x, y + 1) not in mask or (x, y + 2) not in mask
        col = R["hi"] if (l and not r) or (t and not b) else R["lo"] if (r and not l) or (b and not t) else R["mid"]
        if tex and col == R["mid"]:
            if y % 4 == 1 and (x + (y // 4) * 3) % 7 < 2: col = R["lo"]
            elif y % 4 == 3 and (x + (y // 4) * 3 + 4) % 7 < 2: col = R["hi"]
        c.put(x, y, col)
def edge(c, mask, col):   # a one-pixel edge round a shape, on whatever is behind it (4-neighbours)
    for (x, y) in {(x + dx, y + dy) for (x, y) in mask for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))} - mask: c.put(x, y, col)
def flat(c, mask, R):   # far away: one tone, darker down the right edge
    for (x, y) in mask: c.put(x, y, R["lo"] if (x + 1, y) not in mask else R["mid"])

def ell(cx, cy, rx, ry):
    return {(x, y) for y in range(math.floor(cy - ry), math.ceil(cy + ry) + 1) for x in range(math.floor(cx - rx), math.ceil(cx + rx) + 1)
            if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1}
def line(x0, y0, x1, y1, th=1):
    n = max(abs(x1 - x0), abs(y1 - y0)) or 1
    return {(round(x0 + (x1 - x0) * i / n) + k, round(y0 + (y1 - y0) * i / n)) for i in range(n + 1) for k in range(th)}
def stroke(x0, y0, x1, y1, w):   # a line w fine pixels thick, round-ended
    n = max(1, round(math.hypot(x1 - x0, y1 - y0))); r = w / 2; out = set()
    for i in range(n + 1):
        cx, cy = x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n
        out |= {(x, y) for y in range(math.floor(cy - r), math.ceil(cy + r) + 1) for x in range(math.floor(cx - r), math.ceil(cx + r) + 1) if (x + .5 - cx) ** 2 + (y + .5 - cy) ** 2 <= r * r + .25}
    return out
def curve(pts, w):   # strokes through a list of points
    out = set()
    for a, b in zip(pts, pts[1:]): out |= stroke(a[0], a[1], b[0], b[1], w)
    return out

# Each shape returns (trunk pixels, leaf pixels, extra pixels in the trunk's darkest tone) standing on (x, b), h fine pixels tall
def conifer(x, b, h):
    top, th = b - h + 1, max(2 * U, h // 4)
    trunk = {(x + k, y) for y in range(b - 2 * U, b + 1) for k in range(-U // 2, U - U // 2)}
    leaf = set()
    for y in range(top, b - 2 * U):   # tiers that widen downward, each overhanging the one below
        r = y - top; half = min(h // 3 + U, (r // th) * U + (r % th) * 2 // 3)
        leaf |= {(x + k, y) for k in range(-half, half + 1)}
    return trunk, leaf, set()
def broadleaf(x, b, h):
    R = max(2 * U, h * .34); cy = b - h + R; tw = U * (1 + (h > 16 * U))
    trunk = {(x + k, y) for y in range(round(cy), b + 1) for k in range(-tw // 2, tw - tw // 2)} | stroke(x, cy + R * .6, x - R * .5, cy + R * .2, U * .8) | stroke(x, cy + R * .7, x + R * .55, cy + R * .25, U * .8)
    leaf = ell(x + .5, cy, R * 1.15, R) | ell(x - R * .6, cy + R * .45, R * .6, R * .5) | ell(x + R * .8, cy + R * .4, R * .55, R * .5) | ell(x - R * .2, cy - R * .5, R * .6, R * .45)
    return trunk, leaf, set()
def palm(x, b, h):
    top = b - h + 2 * U; trunk = set()
    for y in range(top, b + 1): trunk |= {(x + (b - y) // 5 + k, y) for k in range(U)}
    rings = {(x + (b - y) // 5 + k, y) for y in range(top + U, b, 2 * U) for k in range(U)}   # ring scars
    tx = x + (b - top) // 5 + U // 2; L = max(3 * U, h // 3); leaf = set()
    for sd in (-1, 1):
        leaf |= curve([(tx + sd * L * i / 6, top + (i / 6) ** 2 * L * .6) for i in range(7)], U)
        leaf |= curve([(tx + sd * L * .66 * i / 6, top - U + (i / 6) ** 2 * L * .3) for i in range(7)], U)
        for i in range(2, 7):   # leaflets hanging off each frond
            fx, fy = tx + sd * L * i / 6, top + (i / 6) ** 2 * L * .6; leaf |= stroke(fx, fy, fx + sd * U * .6, fy + U * 1.4, 1.2)
    leaf |= ell(tx, top - U, U, U * 1.2)
    return trunk, leaf, rings
def lycopsid(x, b, h):
    top = b - h + 1; tw = 2 * U; trunk = {(x + k, y) for y in range(top + 2 * U, b + 1) for k in range(tw)}
    bark = {(x + k, y) for y in range(top + 3 * U, b + 1) for k in range(tw) if (y // 2 + (k + (y // 4) % 2 * 2) // 2) % 3 == 0}   # the diamond leaf-scar pattern
    leaf = ell(x + U, top + U, U * 2, U * 1.2) | stroke(x + U, top + U, x - U, top + 2.5 * U, U * .8) | stroke(x + U, top + U, x + 3 * U, top + 2.5 * U, U * .8)
    for y in range(top + 3 * U, top + h // 2, 3 * U): leaf |= stroke(x, y, x - U, y + U, 2)   # short leaves low on the trunk
    for y in range(top + 4 * U, top + h // 2, 3 * U): leaf |= stroke(x + tw - 1, y, x + tw + U, y + U, 2)
    return trunk, leaf, bark
def horsetail(x, b, h):
    top = b - h + 1; trunk = {(x + k, y) for y in range(top + 2 * U, b + 1) for k in range(-1, 1)}
    leaf = set()
    for i, y in enumerate(range(top + 3 * U, b - U, 2 * U)):   # whorls of needles angled up, the low ones wider
        w = U * (1 + (i % 2)); leaf |= stroke(x, y, x - w, y - U // 2, 1.5) | stroke(x, y, x + w, y - U // 2, 1.5)
    nodes = {(x + k, y) for y in range(top + 3 * U, b, 2 * U) for k in range(-1, 1)}
    return trunk | nodes, leaf, ell(x, top + U, U * .6, U * 1.1) | nodes   # the cone at the tip, dark joints
def treefern(x, b, h):
    top = b - h + 2 * U; trunk = {(x + k, y) for y in range(top, b + 1) for k in range(-U // 2, U - U // 2)}; L = max(3 * U, h // 3); leaf = ell(x, top - U // 2, U, U)
    for sd in (-1, 1):
        for drop, rise in ((.7, 0), (.5, -1)):
            pts = [(x + sd * L * i / 6, top + rise * U + (i / 6) ** 2 * L * drop) for i in range(7)]; leaf |= curve(pts, U * .8)
            for i in range(1, 7):   # pinnae down each frond
                fx, fy = pts[i]; leaf |= stroke(fx, fy, fx + sd * U * .4, fy + U * 1.2, 1.5)
    return trunk, leaf, {(x + k, y) for y in range(top + U, b + 1, 2 * U) for k in range(-U // 2, U - U // 2)}
def cycad(x, b, h):
    th = max(2 * U, h * 2 // 5); trunk = {(x + k, y) for y in range(b - th + 1, b + 1) for k in range(2 * U)}
    bark = {(x + k, y) for y in range(b - th + 1, b + 1) for k in range(2 * U) if (y + (k // 2) * 2) % 4 == 0}   # crossed leaf-base scales
    top, L, leaf = b - th, max(2 * U, h - th), set()
    for a in (-155, -125, -90, -55, -25):
        ax, ay = math.cos(math.radians(a)), math.sin(math.radians(a)); x0 = x + U
        x1, y1 = x0 + ax * L * 1.2, top + ay * L * .9; leaf |= stroke(x0, top, x1, y1, U * .7)
        for i in range(2, 7):   # leaflets along each frond
            fx, fy = x0 + (x1 - x0) * i / 7, top + (y1 - top) * i / 7; leaf |= stroke(fx, fy, fx - ay * U * .8, fy + ax * U * .8, 1.2) | stroke(fx, fy, fx + ay * U * .8, fy - ax * U * .8, 1.2)
    return trunk, leaf, bark
def fernmound(x, b, h):
    rx = h * 1.3; leaf = {p for p in ell(x, b + 1, rx, h) if p[1] <= b}
    for i in range(-3, 4):   # fronds arching out over the mound
        a = math.radians(-90 + i * 24); leaf |= stroke(x, b - h * .3, x + math.cos(a) * rx * 1.05, b + math.sin(a) * h * 1.05 + h * .25, U * .8)
    return set(), leaf, set()
def bush(x, b, h):
    leaf = {p for p in ell(x, b - h * .45, h * 1.1, h * .62) | ell(x - h * .7, b - h * .25, h * .5, h * .4) | ell(x + h * .75, b - h * .28, h * .5, h * .38) | ell(x - h * .2, b - h * .8, h * .5, h * .3) if p[1] <= b}
    return set(), leaf, set()
def grass(x, b, h):
    leaf = set()
    for k in range(-5, 6):   # a tussock of blades fanning out, the outer ones shorter
        hh = max(U, h - abs(k) * h // 7); leaf |= stroke(x + k * U * .4, b, x + k * U * .9, b - hh, 1.5)
    return set(), leaf, set()
def reeds(x, b, h):
    stems, heads = set(), set()
    for i, k in enumerate((-2, -1, 0, 1, 2)):
        hh = h - (i % 2) * h // 4; sx = x + k * U
        stems |= stroke(sx, b, sx + k * U * .3, b - hh + 2 * U, 1.5); heads |= ell(sx + k * U * .3, b - hh + U * 1.2, U * .55, U * 1.3)
    return set(), stems, heads   # stems drawn as leaf, heads in the trunk's dark tone
def cactus(x, b, h):
    w = U * 3; leaf = {(x + k, y) for y in range(b - h + U, b + 1) for k in range(w)} | ell(x + w / 2, b - h + U, w / 2, U)
    m = b - h // 2; leaf |= stroke(x, m, x - 2 * U, m, U * 1.6) | stroke(x - 2 * U, m, x - 2 * U, m - 3 * U, U * 1.6) | stroke(x + w, m - 2 * U, x + w + 2 * U, m - 2 * U, U * 1.6) | stroke(x + w + 2 * U, m - 2 * U, x + w + 2 * U, m - 5 * U, U * 1.6)
    ribs = {(x + k, y) for y in range(b - h + 2 * U, b) for k in (U - 1, 2 * U - 1)}   # ribs down the stem
    return ribs, leaf, set()
def rock(x, b, h): return set(), {p for p in ell(x, b + 1, h * 1.4, h) if p[1] <= b}, set()
def moss(x, b, h): return set(), {p for p in ell(x, b + 1, max(2 * U, h * 2.2), max(1.2 * U, h)) if p[1] <= b}, set()
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
        edge(c, trunk | leaf, lr["deep"]); flat(c, trunk | leaf, lr)
    else:
        if kind == "cactus": edge(c, leaf, lr["edge"]); shade(c, leaf, lr, False); [c.put(px, py, lr["lo"]) for px, py in trunk]; return
        edge(c, trunk, P["trunk"]["edge"]); edge(c, leaf, lr["edge"])
        shade(c, trunk, P["trunk"], False); shade(c, leaf, lr, kind not in ("rock",))
        if kind == "rock":   # a crack or two, and a lit ledge
            for i in range(2): x0 = x + (i * 2 - 1) * h // 2; [c.put(px, py, lr["deep"]) for px, py in line(x0, b - h // 2, x0 + U, b - h // 5) if (px, py) in leaf]
        for p in extra: c.put(p[0], p[1], P["trunk"]["deep"])

def wall(era, biome, size):
    W, H, _ = dims(size); c = Cv(W, H); P, B = palette(era, biome), BIOMES[biome]
    rng = random.Random(zlib.crc32(f"{era}-{biome}-{size}-wall".encode()))
    g = max(2 * U, round(H * .18)); hz = H - g   # the ground strip is the bottom g rows; hz is the first of them
    for y in range(hz):   # sky: three flat bands, lighter toward the horizon
        for x in range(W): c.put(x, y, P["sky"]["mid"] if y < hz * .3 else mix(P["sky"]["mid"], P["sky"]["hi"], .5) if y < hz * .55 else P["sky"]["hi"])
    hh = max(2 * U, H // 4); ph = rng.uniform(0, 6)   # far hills: a stepped skyline, each step a park pixel wide
    tops = [hz - 1 - round(hh * (.55 + .3 * math.sin(x // U * U * .09 / U + ph) + .15 * math.sin(x // U * U * .23 / U + ph * 2))) for x in range(W)]
    for x in range(W):
        top = tops[x]
        for y in range(top, hz): c.put(x, y, P["hill"]["hi"] if top < y <= top + 2 and x % (3 * U) < U else P["hill"]["lo"] if y > top + 4 and (y + x // (2 * U)) % (2 * U) == 0 and x % 5 < 2 else P["hill"]["mid"])
        for y in range(top, min(hz, max(top + 1, tops[x - 1] if x else top, tops[x + 1] if x + 1 < W else top))): c.put(x, y, P["hill"]["deep"])   # its skyline edge, down each step
    opts, dens = FLORA[biome][era], B["dens"]
    def row(far):
        step = max(3, round((7 if far else 10) / dens * (H / U / 20) ** .5)) * U; x = rng.randrange(step)
        while x < W + 2 * U:
            k = pick(rng, opts); share = TALL.get(k) or LOW[k]
            h = max(3 * U, round(H * share * rng.uniform(.75, 1.1) * (.5 if far else 1)))
            plant(c, k, x, hz if far else H - 1 - rng.randrange(max(1, g - U)), h, P, far)
            x += step + rng.randrange(-step // 3, step // 3 + 1)
    row(True)
    G = P["ground"]
    for y in range(hz, H):   # the ground strip: a dark horizon row, then rows of short dashes; a wet biome has water along the back of it
        for x in range(W):
            wet = B.get("wet") and hz <= y < hz + U and x % (11 * U) < 7 * U
            c.put(x, y, (WATER["hi"] if x % (11 * U) in range(U, 3 * U) and y == hz + 1 else WATER["mid"]) if wet else G["deep"] if y == hz else G["lo"] if (y - hz) % 4 == 2 and (x + (y - hz) // 4 * 5) % 9 < 3 else G["hi"] if (y - hz) % 4 == 0 and (x + (y - hz) // 4 * 5 + 4) % 11 < 2 else G["mid"])
    row(False)
    return c

def floor(era, biome, size):
    W, _, F = dims(size); c = Cv(W, F); P, B = palette(era, biome), BIOMES[biome]
    G = P["ground"]; rng = random.Random(zlib.crc32(f"{era}-{biome}-{size}-floor".encode()))
    for y in range(F):   # the substrate: flat, with staggered rows of short darker dashes and every third dash row lighter (like the case floor in map.js)
        for x in range(W):
            dash = y % 6 == 3 and (x + (y // 6 * 7) % 13) % 14 < 4
            grain = y % 6 == 0 and (x + (y // 6) * 5) % 9 == 0
            c.put(x, y, G["lo"] if y < 2 else (G["hi"] if y // 6 % 3 == 2 else G["lo"]) if dash else G["lo"] if grain else G["mid"])
    L, T = P["leaf"], P["trunk"]
    def blob(m, R, tex=False): edge(c, m, R["edge"]); shade(c, m, R, tex)
    def decal(kind, x, y):
        if kind == "pebble":   # a pebble lit on top, its edge only along the bottom and right where it's in shade
            m = ell(x, y, U * rng.uniform(.8, 1.3), U * .7); shade(c, m, P["stone"], False)
            for px, py in {(px + 1, py) for px, py in m} | {(px, py + 1) for px, py in m}:
                if (px, py) not in m: c.put(px, py, P["stone"]["deep"])
        elif kind == "ripple":
            for k in range(5 * U): c.put(x + k, y + round(math.sin(k / U) * .8), G["hi"]); c.put(x + k + 1, y + 1 + round(math.sin(k / U) * .8), G["lo"])
        elif kind == "tuft":
            m = set()
            for k in range(-3, 4): m |= stroke(x + k * .6, y, x + k * 1.6, y - (2 * U - abs(k)), 1.2)
            blob(m, L)
        elif kind == "frond":
            m = stroke(x - 2 * U, y + U * .3, x + 2 * U, y - U * .3, 1.5)
            for i in range(-3, 4): fx = x + i * U * .55; m |= stroke(fx, y, fx - U * .4, y - U * .8, 1.2) | stroke(fx, y, fx + U * .4, y + U * .8, 1.2)
            blob(m, L)
        elif kind == "litter":
            for dx, dy in ((0, 0), (2.6 * U, U)): m = ell(x + dx, y + dy, U * .9, U * .45); blob(m, LITTER); [c.put(px, py, LITTER["lo"]) for px, py in line(round(x + dx - U * .6), y + dy, round(x + dx + U * .6), y + dy)]
        elif kind == "needles":
            for dx, dy, ex, ey in ((0, 0, 1.5, 1), (2, -1, 4, 0), (1, 2, 3, 2.5)): [c.put(px, py, T["lo"]) for px, py in line(x + dx * U, y + dy * U // 2, x + round(ex * U), y + round(ey * U / 2))]
        elif kind in ("moss", "puddle", "snow"):
            R = L if kind == "moss" else WATER if kind == "puddle" else SNOW; rx = rng.choice((2.5, 3.5, 4.5)) * U
            m = ell(x, y, rx, max(U, rx * .4)); blob(m, R)
            if kind == "puddle": [c.put(x - U + k, y - 1, mix(WATER["hi"], (255, 255, 255), .4)) for k in range(2 * U)]
            if kind == "moss": [c.put(px, py, R["hi"]) for px, py in m if py % 3 == 0 and (px + py) % 5 == 0]
    cw, ch = 9 * U, 6 * U   # one decal at most in each cell of a grid, nudged inside it, so they spread evenly
    for gy in range(U, F, ch):
        for gx in range(0, W, cw):
            if rng.random() < .35 + .25 * B["dens"]: decal(rng.choice(B["dec"]), gx + rng.randrange(U, cw - 2 * U), min(F - 2 * U, gy + rng.randrange(U, ch - U)))
    return c

def scenes(): return [(e, b) for e in ERAS for b in BIOMES]

if __name__ == "__main__":
    args = [a for a in sys.argv[1:]]
    sheet = args[args.index("--sheet") + 1] if "--sheet" in args else None
    if sheet: del args[args.index("--sheet"):args.index("--sheet") + 2]
    only = args[args.index("--only") + 1].split(",") if "--only" in args else None
    if only: del args[args.index("--only"):args.index("--only") + 2]
    out = args[0] if args else "sprites/vivscene"
    os.makedirs(out, exist_ok=True)
    ims = []
    for era, biome in scenes():
        if only and f"{era}-{biome}" not in only: continue
        row = []
        for size in SIZES:
            w, f = wall(era, biome, size).img(), floor(era, biome, size).img()
            for im, layer in ((w, "wall"), (f, "floor")):   # opaque with few colors: a palette PNG keeps the sprite pack small
                im.convert("RGB").convert("P", palette=Image.ADAPTIVE, colors=48).save(os.path.join(out, f"{era}-{biome}-{size}-{layer}.png"), optimize=True)
            row.append((w, f))
        ims.append(row)
    if sheet:
        Z, pad = 2, 4 * U; cw = sum(dims(s)[0] + pad for s in SIZES) + pad; rh = max(dims(s)[1] + dims(s)[2] for s in SIZES) + pad
        im = Image.new("RGBA", (cw * Z, rh * len(ims) * Z + pad * Z), (40, 44, 48, 255))
        for i, row in enumerate(ims):
            x = pad
            for w, f in row:
                y = pad + i * rh
                im.alpha_composite(w.resize((w.width * Z, w.height * Z), Image.NEAREST), (x * Z, y * Z)); im.alpha_composite(f.resize((f.width * Z, f.height * Z), Image.NEAREST), (x * Z, (y + w.height) * Z))
                x += w.width + pad
        im.save(sheet)
    print(len(ims), "scenes,", len(ims) * len(SIZES) * 2, "pictures")
