# Draws the aquarium backdrops in the park style like the vivarium scenes, with their canvas, shading, edges and sizes (tools/pixelvivscene.py):
# flat fills with a dark edge tinted to each thing (softer on the far shapes and rises), stair-stepped shapes, light from the top left, at the scenes' fine
# pixel (DET times finer than 0.13 m, to match the animals; strokes and spacing in units of U, one park pixel). A backdrop is a stretch of sea floor from one part of the past
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
from pixelvivscene import Cv, SIZES, dims, mix, ramp, shade, flat, edge, ell, line, stroke, curve, pick, U

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

# Each shape gives (body pixels, extra pixels drawn in the body's darkest tone) standing on (x, b), h fine pixels tall
def sponge(x, b, h):   # a clump of upright tubes, each open at the top, with rows of pores
    body, ex = set(), set()
    for dx, f in ((-2, .7), (0, 1), (2, .8)):
        t = max(3 * U, round(h * f)); x0 = x + dx * U; body |= {(x0 + k, y) for y in range(b - t + 1, b + 1) for k in range(2 * U)}
        ex |= {(x0 + k, b - t + 1 + j) for k in range(1, 2 * U - 1) for j in range(2)} | {(x0 + U, y) for y in range(b - t + 3 * U, b - U, 2 * U)}
    return body, ex
def mat(x, b, h):
    m = {p for p in ell(x, b + 1, max(3 * U, h * 3), max(1.5 * U, h)) if p[1] <= b}
    return m, {p for p in m if p[1] % 3 == 0 and (p[0] + p[1]) % 4 == 0}
def stalk(x, b, h):   # a thin stalk with a cup on top (like Dinomischus)
    body = stroke(x, b, x, b - h + 3 * U, 2) | ell(x + .5, b - h + 2 * U, 2 * U, 1.6 * U)
    return body, {(x + k, b - h + 2 * U - 1) for k in range(-U, U + 1)}
def strand(x, b, h):   # a ribbon of seaweed, swaying side to side
    return curve([(x + math.sin(i / 3) * U, b - i * h / 12) for i in range(13)], 2 * U * .8), set()
def crinoid(x, b, h):   # a sea lily: a long jointed stalk, a cup, and feathery arms fanning up and out
    cy = b - h + 5 * U; body = stroke(x, b, x, cy, U * .8); ex = {(x + k, y) for y in range(b - 2, cy, -3) for k in (-1, 0)}
    for a in (-2.2, -1.1, 0, 1.1, 2.2):
        ex_, ey_ = x + a * 1.6 * U, b - h + U - abs(2.2 - abs(a)) * .8 * U; body |= curve([(x, cy), (x + a * .9 * U, cy - 2 * U), (ex_, ey_)], 2)
        for t in (.45, .7, .9):
            px_, py_ = x + a * 1.2 * U * t, cy - (cy - ey_) * t; body |= stroke(px_, py_, px_ - U * .5, py_ + U * .3, 1.2) | stroke(px_, py_, px_ + U * .5, py_ + U * .3, 1.2)
    return body | ell(x + .5, cy, 1.6 * U, 1.4 * U), ex
def crinoid2(x, b, h): return crinoid(x, b, h)
def horncoral(x, b, h):   # a curved cone, wide at the top, with growth rings
    body = set()
    for i in range(h):
        w = U + i * 3 * U // max(1, h); cx = x + round((h - i) * .25)
        body |= {(cx + k, b - i) for k in range(-w // 2, w - w // 2 + 1)}
    return body, {p for p in body if (b - p[1]) % (3 * U // 2) == 0}
def honeycomb(x, b, h):   # a low dome cut into cells
    body = {p for p in ell(x, b + 1, h * 1.6, h) if p[1] <= b}
    return body, {p for p in body if p[1] % 4 == 0 or (p[0] + (p[1] // 4) % 2 * 3) % 6 == 0}
def staghorn(x, b, h):   # a branching stony coral, round-tipped arms dotted with polyp pores
    body = stroke(x, b, x, b - h // 2, 2 * U)
    for dx, top in ((-3, .8), (3, .9), (-1, 1), (2, .65)):
        tx, ty = x + dx * U, b - round(h * top); body |= curve([(x, b - h // 2), (x + dx * U * .6, b - h * .6), (tx, ty)], U * 1.1)
    return body, {p for p in body if (p[0] * 3 + p[1] * 5) % 11 == 0}
def staghorn2(x, b, h): return staghorn(x, b, h)
def brain(x, b, h):   # a dome with winding grooves
    body = {p for p in ell(x, b + 1, h * 1.5, h) if p[1] <= b}
    return body, {p for p in body if (p[0] + round(math.sin(p[1] / 2) * 2) + (p[1] // 3) * 2) % 5 == 0}
def vase(x, b, h):   # a glass sponge: a vase widening up to an open rim, a lattice down its side
    body = set()
    for i in range(h): w = U // 2 + round(i * 2.4 * U / max(1, h)); body |= {(x + k, b - i) for k in range(-w, w + 1)}
    rim = {(x + k, b - h + 1 + j) for k in range(-U, U + 1) for j in range(2)}
    return body, rim | {p for p in body if (b - p[1]) > 2 and (b - p[1]) % 2 == 0 and (p[0] - x + (b - p[1])) % 4 == 0}
def kelp(x, b, h):   # a kelp frond: a swaying stalk, a blade off it every few park pixels (alternating sides), a float bulb at each blade's root
    body, ex = set(), set(); pts = [(x + math.sin(i / 4) * U, b - i * h / 16) for i in range(17)]; body |= curve(pts, 2)
    for j, (px_, py_) in enumerate(pts[2:-1:2]):
        d = 1 if j % 2 else -1; body |= ell(px_ + d * 2 * U, py_ - U, 2 * U, U * .8); ex |= ell(px_, py_, U * .5, U * .5)
    return body, ex
def seafan(x, b, h):   # a sea fan: a short stem under a flat half-round net of ribs and rings
    cy = b - 2 * U; body = stroke(x, b, x, cy, U) | {p for p in ell(x + .5, cy, h * .7, h - 2 * U) if p[1] <= cy}
    ex = set()
    for p in body:
        if p[1] >= cy: continue
        dx, dy = p[0] + .5 - x, cy - p[1]; ang = math.degrees(math.atan2(dy, dx)); r = math.hypot(dx / (h * .7), dy / (h - 2 * U))
        if int(ang) % 20 < 4 or abs(r - .5) < .05 or abs(r - .78) < .04: ex.add(p)
    return body, ex
def table(x, b, h):   # a table coral: a stout stem holding up a wide flat plate, ridged underneath
    w = round(h * .9); body = {(x + k, y) for y in range(b - h + 3 * U, b + 1) for k in range(2 * U)} | {(x + k, y) for y in range(b - h + U, b - h + 3 * U) for k in range(-w, w + 2 * U)}
    return body, {(x + k, b - h + 3 * U - 1) for k in range(-w + 1, w + 2 * U, 3)}
def staghorn3(x, b, h): return staghorn(x, b, h)
def reed(x, b, h):   # a clump of thin blades, the outer ones shorter and leaning out, the tallest tipped with a cattail head
    body, ex = set(), set()
    for dx, f, lean in ((-3, .55, -1), (-1, .85, -.3), (1, 1, .2), (3, .65, 1)):
        t = max(3 * U, round(h * f)); body |= curve([(x + dx * U, b), (x + dx * U, b - t * .6), (x + dx * U + lean * U, b - t)], 1.6)
    ex |= ell(x + 1.2 * U, b - h + 3 * U, U * .7, 1.8 * U)
    return body | ex, ex
def weed(x, b, h):   # waterweed: a stem with whorls of short leaves, wider at the middle
    body, ex = stroke(x, b, x, b - h, 1.6), set()
    for i in range(2 * U, h, 3 * U):
        w = U + round(2 * U * math.sin(math.pi * i / h)); body |= stroke(x, b - i, x - w, b - i - U * .6, 1.5) | stroke(x, b - i, x + w, b - i - U * .6, 1.5)
        ex |= ell(x, b - i, 1, 1)
    return body, ex
def snag(x, b, h):   # a sunken branch lying on the bed, with a side branch sticking up and back, and bark lines
    L = h * 5; body = stroke(x, b - U, x + L, b - 3 * U, 2 * U)
    body |= stroke(x + L // 3, b - 2 * U, x + L // 3 + 3 * U, b - h - 2 * U, U) | stroke(x + L * 2 // 3, b - 2 * U, x + L * 2 // 3 - 2 * U, b - h, U)
    return body, {p for p in body if (p[0] - p[1] * 2) % 7 == 0}
SHAPES = {k: globals()[k] for k in list(TALL) + list(LOW)}

def palette(scene):
    S = SCENES[scene]; top, deep = S["water"]
    return {"top":ramp(top), "deep":ramp(deep), "far":ramp(mix(deep, top, .45)), "ground":ramp(S["ground"]), "col":{k: ramp(v) for k, v in S["col"].items()}}

def wall(scene, size):
    W, H, _ = dims(size); c = Cv(W, H); P, S = palette(scene), SCENES[scene]
    rng = random.Random(zlib.crc32(f"sea-{scene}-{size}-wall".encode()))
    g = max(2 * U, round(H * .16)); hz = H - g
    bands = 6   # the water: stepped bands from the light top to the deep bottom, and shafts of light slanting down to the right from the top left
    for y in range(hz):
        t = min(bands - 1, y * bands // max(1, hz)) / (bands - 1); col = mix(P["top"]["mid"], P["deep"]["mid"], t)
        for x in range(W):
            ray = y < hz * .7 and (x - y // 2) % (23 * U) < 3 * U
            c.put(x, y, mix(col, P["top"]["hi"], .35 * (1 - y / hz)) if ray else col)
    tops = [hz - 1 - round(H * .1 * (.6 + .4 * math.sin(x // U * U * .11 / U + 1.3))) for x in range(W)]
    for x in range(W):   # far rises of sea floor, one flat tone, with a soft edge along their tops and down each step
        top = tops[x]
        for y in range(top, hz): c.put(x, y, P["far"]["mid"])
        for y in range(top, min(hz, max(top + 1, tops[x - 1] if x else top, tops[x + 1] if x + 1 < W else top))): c.put(x, y, P["far"]["deep"])
    def row(far):
        step = max(3, round((6 if far else 9) / S["dens"] * (H / U / 20) ** .5)) * U; x = rng.randrange(step)
        while x < W + 2 * U:
            k = pick(rng, S["near"]); share = TALL.get(k) or LOW[k]
            h = max(3 * U, round(H * share * rng.uniform(.75, 1.1) * (.55 if far else 1)))
            b = hz if far else H - 1 - rng.randrange(max(1, g - U))
            body, ex = SHAPES[k](x, b, h)
            if far: F = P["far"] if k in LOW else ramp(mix(P["far"]["lo"], P["deep"]["lo"], .5)); edge(c, body, F["deep"]); flat(c, body, F)
            else:
                R = P["col"][k]; edge(c, body, R["edge"]); shade(c, body, R, False)
                for p in ex:
                    if p in body: c.put(p[0], p[1], R["deep"])
            x += step + rng.randrange(-step // 3, step // 3 + 1)
    row(True)
    G = P["ground"]
    for y in range(hz, H):   # the strip of sea floor: a dark edge row, then rows of short dashes
        for x in range(W): c.put(x, y, G["deep"] if y == hz else G["lo"] if (y - hz) % 4 == 2 and (x + (y - hz) // 4 * 5) % 9 < 3 else G["hi"] if (y - hz) % 4 == 0 and (x + (y - hz) // 4 * 5 + 4) % 11 < 2 else G["mid"])
    row(False)
    return c

def floor(scene, size):
    W, _, F = dims(size); c = Cv(W, F); P, S = palette(scene), SCENES[scene]
    G, C = P["ground"], P["col"]; rng = random.Random(zlib.crc32(f"sea-{scene}-{size}-floor".encode()))
    for y in range(F):   # the sand or mud: flat, with staggered rows of short darker dashes and every third dash row lighter
        for x in range(W):
            dash = y % 6 == 3 and (x + (y // 6 * 7) % 13) % 14 < 4
            grain = y % 6 == 0 and (x + (y // 6) * 5) % 9 == 0
            c.put(x, y, G["lo"] if y < 2 else (G["hi"] if y // 6 % 3 == 2 else G["lo"]) if dash else G["lo"] if grain else G["mid"])
    def blob(m, R, deep=()):
        edge(c, m, R["edge"]); shade(c, m, R, False)
        for p in deep:
            if p in m: c.put(p[0], p[1], R["deep"])
    def decal(kind, x, y):
        if kind == "burrow":
            m = ell(x, y, U * 1.2, U * .7); blob(m, G, m)
            for k in range(2 * U): c.put(x - U + k, y - U, G["hi"])
        elif kind == "mat": m = ell(x, y, rng.choice((2.5, 3.5, 4.5)) * U, 1.4 * U); blob(m, C["mat"], {p for p in m if p[1] % 3 == 0 and (p[0] + p[1]) % 4 == 0})
        elif kind == "cone": blob(stroke(x, y, x + 4 * U, y + U * .5, U * 1.1) | ell(x, y, U * .8, U * .8), C["cone"], {(x + k, y) for k in range(U, 4 * U, 3)})
        elif kind == "shell":   # a brachiopod: a ribbed fan
            m = {p for p in ell(x, y, 2 * U, 1.4 * U) if p[1] <= y + U // 2}; blob(m, C["shell"], {p for p in m if (p[0] - x) % 3 == 0 and p[1] > y - U})
        elif kind == "stem":
            for k in range(0, 6, 2): blob(ell(x + k * U, y, U * .6, U * .5), C["stem"])
        elif kind == "coralbit": blob(curve([(x, y), (x + U, y - U), (x + 2 * U, y), (x + 3 * U, y - U)], U * .9), C["coralbit"])
        elif kind == "ammonite":
            m = ell(x, y, 2 * U, 1.6 * U); blob(m, C["ammonite"], {p for p in m if abs(math.hypot((p[0] + .5 - x) / 2, (p[1] + .5 - y) / 1.6) - U * .5) < .5} | {p for p in m if math.atan2(p[1] - y, p[0] - x) * 10 % 2 < .3})
        elif kind == "sanddollar":
            m = ell(x, y, 2.2 * U, 1.4 * U); blob(m, C["sanddollar"], {p for k in range(5) for p in line(x, y, round(x + math.cos(k * 1.257) * U * 1.2), round(y + math.sin(k * 1.257) * U * .8))})
        elif kind == "scallop":
            m = {p for p in ell(x, y, 2 * U, 1.6 * U) if p[1] <= y + U} | ell(x, y + U, U * .8, U * .5); blob(m, C["scallop"], {p for p in m if (p[0] - x) % 3 == 0 and p[1] < y + U})
        elif kind == "starfish":
            m = ell(x, y, U * .8, U * .6)
            for k in range(5): a = -math.pi / 2 + k * 1.2566; m |= stroke(x, y, x + math.cos(a) * 2.4 * U, y + math.sin(a) * 1.6 * U, U * .9)
            blob(m, C["starfish"], {p for p in m if (p[0] + p[1]) % 3 == 0})
        elif kind == "pebble":
            r = rng.choice((1.2, 1.6, 2)) * U; blob(ell(x, y, r, max(U, r * .7)), C["pebble"])
        elif kind == "twig":
            L = rng.choice((4, 5, 6)) * U; blob(stroke(x, y, x + L, y + U, U * .8) | stroke(x + L // 2, y + U // 2, x + L // 2 + U, y - U, 1.5), C["twig"])
        elif kind == "snail":
            m = ell(x, y, 1.4 * U, U); blob(m, C["snail"], {p for p in m if abs(math.hypot(p[0] + .5 - x, (p[1] + .5 - y) * 1.4) - U * .6) < .6})
        elif kind == "leaf":
            m = ell(x, y, 2 * U, U * .8); blob(m, C["leaf"], set(line(x - 2 * U + 1, y, x + 2 * U - 1, y)))
        elif kind == "belemnite": blob(stroke(x, y, x + 5 * U, y, U) | {(x + 5 * U + k, y) for k in range(U)}, C["belemnite"])
    cw, ch = 9 * U, 6 * U   # one decal at most in each cell of a grid, nudged inside it, so they spread evenly
    for gy in range(U, F, ch):
        for gx in range(0, W, cw):
            if rng.random() < .3 + .25 * S["dens"]: decal(rng.choice(S["dec"]), gx + rng.randrange(2 * U, cw - 3 * U), min(F - 3 * U, gy + rng.randrange(U, ch - U)))
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
                im.convert("RGB").convert("P", palette=Image.ADAPTIVE, colors=48).save(os.path.join(out, f"sea-{scene}-{size}-{layer}.png"), optimize=True)
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
    print(len(ims), "backdrops,", len(ims) * len(SIZES) * 2, "pictures")
