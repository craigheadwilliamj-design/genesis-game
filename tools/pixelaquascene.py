# Draws the aquarium backdrops in the park style like the vivarium scenes, with their canvas, shading, edges and sizes (tools/pixelvivscene.py):
# flat fills with a dark edge tinted to each thing (softer on the far shapes and rises), stair-stepped shapes, light from the top left, 0.13 m a pixel. A backdrop is a stretch of sea floor from one part of the past
# (AQUA_SCENES in js/data.js), drawn as two layers for each case size:
#   sea-<scene>-<S|M|L>-wall.png    the back wall above the sill: the water in stepped bands with slanting light, far shapes, near shapes, a strip of sea floor
#   sea-<scene>-<S|M|L>-floor.png   the floor, flat and seen from above, with its scatter of shells and bits
# Scenes: cambrian (mud, microbial mats, sponges, stalked animals, no fish or coral), paleozoic (crinoid gardens, horn and honeycomb corals, Ordovician to Permian),
# mesozoic (the first stony corals, glass sponges, ammonite shells), cenozoic (kelp forest and a modern reef: sea fans, table and branching corals, starfish),
# fresh (a river or lake bed for freshwater aquariums, any period: tea-green water, gravel, reeds, waterweed, eelgrass and sunken branches; pebbles, twigs, snails and leaves). The aquarium's water tint is laid over all of it in the game, so the colors here run a little bright.
# Usage: python3 -I tools/pixelaquascene.py [outdir] [--sheet sheet.png]   (default sprites/vivscene; the sheet is a x4 view of every backdrop)
import sys, os, math, zlib, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from pixelvivscene import Cv, SIZES, dims, mix, ramp, shade, flat, edge, ell, line, pick

SCENES = {   # the water (top and deep), the floor, what stands on it, what lies about on the floor and the colors they're drawn in
    "cambrian":  {"water":((128, 164, 150), (70, 104, 100)), "ground":(124, 118, 94), "dens":.8,
                  "near":[("sponge", 3), ("mat", 3), ("stalk", 2), ("strand", 2)], "dec":["mat", "burrow", "cone", "burrow"],
                  "col":{"sponge":(176, 148, 86), "mat":(92, 100, 64), "stalk":(176, 114, 102), "strand":(104, 126, 70), "cone":(170, 156, 120)}},
    "paleozoic": {"water":((110, 170, 186), (50, 104, 136)), "ground":(178, 160, 118), "dens":1.0,
                  "near":[("crinoid", 4), ("horncoral", 2), ("honeycomb", 2), ("crinoid2", 2)], "dec":["shell", "stem", "shell", "coralbit"],
                  "col":{"crinoid":(150, 92, 112), "crinoid2":(200, 150, 86), "horncoral":(196, 152, 102), "honeycomb":(164, 142, 104), "shell":(206, 186, 150), "stem":(176, 140, 120), "coralbit":(196, 152, 102)}},
    "mesozoic":  {"water":((104, 184, 206), (40, 108, 156)), "ground":(208, 192, 150), "dens":1.1,
                  "near":[("staghorn", 3), ("brain", 2), ("vase", 2), ("staghorn2", 2)], "dec":["ammonite", "belemnite", "coralbit", "ammonite"],
                  "col":{"staghorn":(214, 122, 102), "staghorn2":(220, 176, 96), "brain":(192, 172, 100), "vase":(184, 144, 92), "ammonite":(196, 168, 120), "belemnite":(168, 128, 90), "coralbit":(226, 196, 176)}},
    "cenozoic":  {"water":((100, 192, 212), (30, 110, 152)), "ground":(222, 208, 166), "dens":1.1,
                  "near":[("kelp", 4), ("seafan", 2), ("table", 2), ("staghorn3", 2)], "dec":["sanddollar", "scallop", "starfish", "coralbit"],
                  "col":{"kelp":(150, 132, 52), "seafan":(156, 84, 146), "table":(188, 160, 116), "staghorn3":(228, 132, 70), "sanddollar":(220, 214, 186), "scallop":(214, 156, 120), "starfish":(222, 110, 60), "coralbit":(232, 200, 186)}},
    "fresh":     {"water":((136, 170, 132), (48, 88, 70)), "ground":(146, 128, 96), "dens":1.0,
                  "near":[("reed", 3), ("weed", 3), ("strand", 2), ("snag", 1)], "dec":["pebble", "twig", "snail", "leaf", "pebble"],
                  "col":{"reed":(132, 150, 70), "weed":(84, 128, 62), "strand":(110, 140, 66), "snag":(112, 88, 62), "pebble":(156, 150, 136), "twig":(120, 94, 64), "snail":(178, 150, 104), "leaf":(170, 120, 60)}},
}
TALL = {"sponge":.55, "stalk":.5, "strand":.7, "crinoid":.85, "crinoid2":.65, "horncoral":.35, "staghorn":.55, "staghorn2":.45, "vase":.5, "kelp":.95, "seafan":.5, "table":.38, "staghorn3":.5, "reed":.8, "weed":.6}   # height, as a share of the wall
LOW = {"mat":.14, "honeycomb":.24, "brain":.26, "snag":.16}

# Each shape gives (body pixels, extra pixels drawn in the body's darkest tone) standing on (x, b), h pixels tall
def sponge(x, b, h):   # a clump of upright tubes, each open at the top
    body, ex = set(), set()
    for dx, f in ((-2, .7), (0, 1), (2, .8)):
        t = max(3, round(h * f)); body |= {(x + dx + k, y) for y in range(b - t + 1, b + 1) for k in range(2)}; ex.add((x + dx, b - t + 1))
    return body, ex
def mat(x, b, h): return {p for p in ell(x, b + 1, max(3, h * 3), max(1.5, h)) if p[1] <= b}, set()
def stalk(x, b, h):   # a thin stalk with a cup on top (like Dinomischus)
    body = line(x, b, x, b - h + 3)
    return body | ell(x + .5, b - h + 2, 2, 1.6), {(x, b - h + 2)}
def strand(x, b, h):   # a ribbon of seaweed, stepping side to side
    return {(x + (1 if (i // 3) % 2 else 0) + k, b - i) for i in range(h) for k in range(2)}, set()
def crinoid(x, b, h):   # a sea lily: a long stalk with joints, a cup, and arms fanning up and out
    body = line(x, b, x, b - h + 5); ex = {(x, y) for y in range(b - 2, b - h + 5, -3)}
    for a in (-2.2, -1.2, 0, 1.2, 2.2): body |= line(x, b - h + 5, round(x + a * 1.6), b - h + 1 - round(abs(2.2 - abs(a)) * .8))
    return body | ell(x + .5, b - h + 5, 1.6, 1.4), ex
def crinoid2(x, b, h): return crinoid(x, b, h)
def horncoral(x, b, h):   # a curved cone, wide at the top, with growth rings
    body = set()
    for i in range(h):
        w = 1 + i * 3 // max(1, h); cx = x + round((h - i) * .25)
        body |= {(cx + k, b - i) for k in range(-w // 2, w - w // 2 + 1)}
    return body, {p for p in body if (b - p[1]) % 3 == 2 and p[0] % 2 == 0}
def honeycomb(x, b, h):   # a low dome cut into cells
    body = {p for p in ell(x, b + 1, h * 1.6, h) if p[1] <= b}
    return body, {p for p in body if (p[1] % 2 == 0 and p[0] % 3 == 0) or (p[1] % 2 == 1 and p[0] % 3 == 1 and p[1] % 4 == 1)}
def staghorn(x, b, h):   # a branching stony coral
    body = line(x, b, x, b - h // 2, 2)
    for dx, top in ((-3, .8), (3, .9), (-1, 1), (2, .65)): body |= line(x, b - h // 2, x + dx, b - round(h * top), 1) | {(x + dx, b - round(h * top))}
    return body, set()
def staghorn2(x, b, h): return staghorn(x, b, h)
def brain(x, b, h):   # a dome with winding grooves
    body = {p for p in ell(x, b + 1, h * 1.5, h) if p[1] <= b}
    return body, {p for p in body if (p[0] + (p[1] // 2) * 3) % 5 == 0}
def vase(x, b, h):   # a glass sponge: a vase widening up to an open rim
    body = set()
    for i in range(h): w = 1 + round(i * 2.4 / max(1, h)); body |= {(x + k, b - i) for k in range(-w, w + 1)}
    return body, {(x + k, b - h + 1) for k in range(-1, 2)} | {(x, b - i) for i in range(2, h - 1, 3)}
def kelp(x, b, h):   # a kelp frond: a stalk that steps side to side, a blade off it every few rows (alternating sides), a float bulb at each blade's root
    body, ex = set(), set()
    for i in range(h):
        sx = x + (1 if (i // 4) % 2 else 0); body.add((sx, b - i))
        if i > 2 and i % 4 == 1:
            d = 1 if (i // 4) % 2 else -1; body |= {(sx + d * k, b - i - (k // 2)) for k in range(1, 4)}; ex.add((sx, b - i))
    return body, ex
def seafan(x, b, h):   # a sea fan: a short stem under a flat half-round net
    body = line(x, b, x, b - 2) | {p for p in ell(x + .5, b - 2, h * .7, h - 2) if p[1] <= b - 2}
    return body, {p for p in body if p[1] < b - 2 and (p[0] + p[1]) % 3 == 0 and (p[0] - p[1]) % 3 != 0}
def table(x, b, h):   # a table coral: a stout stem holding up a wide flat plate
    body = {(x + k, y) for y in range(b - h + 3, b + 1) for k in range(2)} | {(x + k, y) for y in range(b - h + 1, b - h + 3) for k in range(-round(h * .9), round(h * .9) + 2)}
    return body, {(x + k, b - h + 2) for k in range(-round(h * .9) + 1, round(h * .9) + 1, 3)}
def staghorn3(x, b, h): return staghorn(x, b, h)
def reed(x, b, h):   # a clump of thin blades a pixel apart, the outer ones shorter and leaning out, the tallest tipped with a cattail head
    body, ex = set(), set()
    for dx, f, lean in ((-3, .55, -1), (-1, .85, 0), (1, 1, 0), (3, .65, 1)):
        t = max(3, round(h * f)); body |= {(x + dx + (lean if i > t * .6 else 0), b - i) for i in range(t)}
    t = max(3, h); ex |= {(x + 1 + k, b - t + 2 + j) for k in (-1, 0) for j in range(4)}
    return body | ex, ex
def weed(x, b, h):   # waterweed: a stem with whorls of short leaves, wider at the middle
    body, ex = {(x, b - i) for i in range(h)}, set()
    for i in range(2, h, 3):
        w = 1 + round(2 * math.sin(math.pi * i / h)); body |= {(x + k, b - i) for k in range(-w, w + 1)} | {(x + k, b - i + 1) for k in (-w, w)}
        ex.add((x, b - i))
    return body, ex
def snag(x, b, h):   # a sunken branch lying on the bed, two pixels thick, with a side branch sticking up and back
    L = h * 5; body = {(x + k, b - j - (k * 2 // L)) for k in range(L) for j in range(2)}
    body |= line(x + L // 3, b - 2, x + L // 3 + 3, b - h - 2, 1) | line(x + L * 2 // 3, b - 2, x + L * 2 // 3 - 2, b - h, 1)
    return body, {(x + k, b) for k in range(0, L, 3)}
SHAPES = {k: globals()[k] for k in list(TALL) + list(LOW)}

def palette(scene):
    S = SCENES[scene]; top, deep = S["water"]
    return {"top":ramp(top), "deep":ramp(deep), "far":ramp(mix(deep, top, .45)), "ground":ramp(S["ground"]), "col":{k: ramp(v) for k, v in S["col"].items()}}

def wall(scene, size):
    W, H, _ = dims(size); c = Cv(W, H); P, S = palette(scene), SCENES[scene]
    rng = random.Random(zlib.crc32(f"sea-{scene}-{size}-wall".encode()))
    g = max(2, round(H * .16)); hz = H - g
    bands = 5   # the water: stepped bands from the light top to the deep bottom, and shafts of light slanting down to the right from the top left
    for y in range(hz):
        t = min(bands - 1, y * bands // max(1, hz)) / (bands - 1); col = mix(P["top"]["mid"], P["deep"]["mid"], t)
        for x in range(W):
            ray = y < hz * .7 and (x - y // 2) % 23 < 3
            c.put(x, y, mix(col, P["top"]["hi"], .35 * (1 - y / hz)) if ray else col)
    tops = [hz - 1 - round(H * .1 * (.6 + .4 * math.sin(x // 3 * 3 * .11 + 1.3))) for x in range(W)]
    for x in range(W):   # far rises of sea floor, one flat tone, with a soft edge along their tops and down each step
        top = tops[x]
        for y in range(top, hz): c.put(x, y, P["far"]["mid"])
        for y in range(top, min(hz, max(top + 1, tops[x - 1] if x else top, tops[x + 1] if x + 1 < W else top))): c.put(x, y, P["far"]["deep"])
    def row(far):
        step = max(3, round((6 if far else 9) / S["dens"] * (H / 20) ** .5)); x = rng.randrange(step)
        while x < W + 2:
            k = pick(rng, S["near"]); share = TALL.get(k) or LOW[k]
            h = max(3, round(H * share * rng.uniform(.75, 1.1) * (.55 if far else 1)))
            b = hz if far else H - 1 - rng.randrange(max(1, g - 1))
            body, ex = SHAPES[k](x, b, h)
            if far: F = P["far"] if k in LOW else ramp(mix(P["far"]["lo"], P["deep"]["lo"], .5)); edge(c, body, F["deep"]); flat(c, body, F)
            else:
                R = P["col"][k]; edge(c, body, R["edge"]); shade(c, body, R, False)
                for p in ex: c.put(p[0], p[1], R["deep"])
            x += step + rng.randrange(-step // 3, step // 3 + 1)
    row(True)
    G = P["ground"]
    for y in range(hz, H):   # the strip of sea floor, with rows of darker dashes
        for x in range(W): c.put(x, y, G["deep"] if y == hz else G["lo"] if (y - hz) % 2 == 1 and (x + y * 3) % 5 < 2 else G["mid"])
    row(False)
    return c

def floor(scene, size):
    W, _, F = dims(size); c = Cv(W, F); P, S = palette(scene), SCENES[scene]
    G, C = P["ground"], P["col"]; rng = random.Random(zlib.crc32(f"sea-{scene}-{size}-floor".encode()))
    for y in range(F):   # the sand or mud: flat, with rows of short darker dashes and every third row lighter ones
        for x in range(W):
            dash = y % 3 == 1 and (x + (y // 3 * 7) % 5) % 6 < 2
            c.put(x, y, G["lo"] if y == 0 else (G["hi"] if y // 3 % 3 == 2 else G["lo"]) if dash else G["mid"])
    def decal(kind, x, y):
        if kind == "burrow": c.put(x, y, G["deep"]); c.put(x + 1, y, G["deep"]); c.put(x, y - 1, G["hi"]); c.put(x + 1, y + 1, G["lo"])
        elif kind == "mat": m = ell(x, y, rng.choice((2.5, 3.5, 4.5)), 1.4); edge(c, m, C["mat"]["edge"]); shade(c, m, C["mat"], False)
        elif kind == "cone":
            for k in range(4): c.put(x + k, y, C["cone"]["hi"] if k == 0 else C["cone"]["mid"])
            c.put(x + 3, y + 1, C["cone"]["lo"])
        elif kind == "shell":
            for dx, dy, t in ((0, 0, "hi"), (1, 0, "hi"), (2, 0, "mid"), (-1, 1, "hi"), (0, 1, "mid"), (1, 1, "mid"), (2, 1, "lo"), (3, 1, "lo"), (1, 2, "lo")): c.put(x + dx, y + dy, C["shell"][t])
        elif kind == "stem":
            for k in range(0, 6, 2): c.put(x + k, y, C["stem"]["hi"]); c.put(x + k + 1, y, C["stem"]["lo"])
        elif kind == "coralbit":
            for dx, dy, t in ((0, 0, "hi"), (1, -1, "mid"), (2, 0, "mid"), (3, -1, "lo"), (1, 0, "mid")): c.put(x + dx, y + dy, C["coralbit"][t])
        elif kind == "ammonite":
            for dx, dy, t in ((0, -1, "hi"), (1, -1, "hi"), (2, -1, "mid"), (-1, 0, "hi"), (2, 0, "lo"), (3, 0, "mid"), (-1, 1, "mid"), (0, 1, "deep"), (3, 1, "lo"), (0, 2, "lo"), (1, 2, "lo"), (2, 2, "lo"), (1, 0, "mid"), (1, 1, "mid")): c.put(x + dx, y + dy, C["ammonite"][t])
        elif kind == "sanddollar":
            m = ell(x, y, 2.2, 1.4); edge(c, m, C["sanddollar"]["edge"]); shade(c, m, C["sanddollar"], False); c.put(x, y, C["sanddollar"]["deep"]); c.put(x - 1, y, C["sanddollar"]["lo"]); c.put(x + 1, y, C["sanddollar"]["lo"])
        elif kind == "scallop":
            for dx, dy, t in ((0, -1, "hi"), (1, -1, "hi"), (2, -1, "mid"), (-1, 0, "hi"), (0, 0, "lo"), (1, 0, "mid"), (2, 0, "lo"), (3, 0, "mid"), (0, 1, "mid"), (1, 1, "mid"), (2, 1, "lo"), (1, 2, "deep")): c.put(x + dx, y + dy, C["scallop"][t])
        elif kind == "starfish":
            for dx, dy, t in ((0, 0, "mid"), (1, 0, "mid"), (0, -1, "hi"), (-1, 0, "hi"), (-2, 1, "hi"), (2, 0, "lo"), (3, 1, "lo"), (0, 1, "lo"), (-1, 2, "lo"), (1, 1, "lo"), (2, 2, "lo")): c.put(x + dx, y + dy, C["starfish"][t])
        elif kind == "pebble":
            r = rng.choice((1.2, 1.6, 2)); m = ell(x, y, r, max(1, r * .7)); edge(c, m, C["pebble"]["edge"]); shade(c, m, C["pebble"], False)
        elif kind == "twig":
            for k in range(rng.choice((4, 5, 6))): c.put(x + k, y + (k > 2), C["twig"]["mid" if k % 3 else "lo"])
        elif kind == "snail":
            for dx, dy, t in ((0, -1, "hi"), (1, -1, "mid"), (-1, 0, "hi"), (0, 0, "deep"), (1, 0, "mid"), (2, 0, "lo"), (0, 1, "lo"), (1, 1, "lo")): c.put(x + dx, y + dy, C["snail"][t])
        elif kind == "leaf":
            for dx, dy, t in ((0, 0, "hi"), (1, 0, "mid"), (2, 0, "mid"), (1, -1, "hi"), (2, 1, "lo"), (3, 0, "lo")): c.put(x + dx, y + dy, C["leaf"][t])
        elif kind == "belemnite":
            for k in range(5): c.put(x + k, y, C["belemnite"]["hi" if k < 2 else "mid" if k < 4 else "lo"])
    cw, ch = 9, 6   # one decal at most in each cell of a grid, nudged inside it, so they spread evenly
    for gy in range(1, F, ch):
        for gx in range(0, W, cw):
            if rng.random() < .3 + .25 * S["dens"]: decal(rng.choice(S["dec"]), gx + rng.randrange(1, cw - 3), min(F - 3, gy + rng.randrange(1, ch - 1)))
    return c

if __name__ == "__main__":
    args = sys.argv[1:]
    sheet = args[args.index("--sheet") + 1] if "--sheet" in args else None
    if sheet: del args[args.index("--sheet"):args.index("--sheet") + 2]
    out = args[0] if args else "sprites/vivscene"
    os.makedirs(out, exist_ok=True)
    ims = []
    for scene in SCENES:
        row = []
        for size in SIZES:
            w, f = wall(scene, size).img(), floor(scene, size).img()
            for im, layer in ((w, "wall"), (f, "floor")):   # opaque with few colors: a palette PNG keeps the sprite pack small
                im.convert("RGB").convert("P", palette=Image.ADAPTIVE, colors=32).save(os.path.join(out, f"sea-{scene}-{size}-{layer}.png"), optimize=True)
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
    print(len(ims), "backdrops,", len(ims) * len(SIZES) * 2, "pictures")
