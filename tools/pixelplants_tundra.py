# Draws the tundra landscape plants (Neogene and Quaternary only: no tundra before the Neogene) and the Labrador Tea Park Plant in the Dimetrodon's flat, simple style
# (helpers copied from tools/pixelplants_grassland.py, because -I scripts can't import each other): flat fills, no outline, stair-stepped shapes, a lit top-left edge, shadow on undersides
# and right edges. Leaves are dark and cool (blue-green, russet), so they stand out from the pale frost-green ground.
#   neo-tundra-small   Eriophorum (cottongrass): a thin dark blade tuft with round white cotton heads on slender stalks
#   neo-tundra-medium  Empetrum (crowberry): a low dense mound of needle-like evergreen leaves, ragged at the edge, dotted with black berries
#   neo-tundra-large   Salix arctica (arctic willow): a gnarled wind-bent shrub, grey-brown limbs swept one way, small round blue-green leaves and silver catkins
#   qua-tundra-small   Saxifraga (purple saxifrage): a tight dark-green cushion of tiny rosettes, covered in small purple flowers
#   qua-tundra-medium  Dryas (mountain avens): a spreading mat of crinkled oak-like leaves with white eight-petal flowers and silky seed swirls
#   qua-tundra-large   Betula nana (dwarf birch): many thin red-brown stems forking into a round twiggy crown of small scalloped leaves, some turned russet
#   q-labrador-tea     the Park Plant: a dense low shrub of narrow leathery leaves with rusty stems and rounded white flower clusters
# Usage: python3 -I tools/pixelplants_tundra.py [outdir]
import sys, math, random
from PIL import Image

def mix(a, b, t): return tuple(round(x * (1 - t) + y * t) for x, y in zip(a, b))
def tones(base): return (base, mix(base, (255, 255, 255), .22), mix(base, (0, 0, 0), .32))   # base, lit, shaded
OLIVE = (97, 111, 34)   # the Dimetrodon's olive; each size steps a little darker, small to large
STEM = tones((96, 64, 34))
SEED = tones((178, 110, 20))   # rust orange / amber, from the Dimetrodon family

class Sprite:
    def __init__(s, w, h, leaf):
        s.w, s.h = w, h; s.g = [[None] * w for _ in range(h)]
        lf = tones(leaf)
        s.C = {"leaf": lf[0], "leafhi": lf[1], "leaflo": lf[2], "rib": mix(leaf, (235, 240, 150), .5),
               "stem": STEM[0], "stemhi": STEM[1], "stemlo": STEM[2], "seed": SEED[0], "seedhi": SEED[1], "seedlo": SEED[2]}
    def put(s, x, y, c):
        x, y = int(math.floor(x + .5)), int(math.floor(y + .5))
        if 0 <= x < s.w and 0 <= y < s.h: s.g[y][x] = c
    def get(s, x, y): return s.g[y][x] if 0 <= x < s.w and 0 <= y < s.h else None
    def line(s, x0, y0, x1, y1, c, r=0):
        n = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
        for k in range(n + 1):
            t = k / n; x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            if r <= .5: s.put(x, y, c)
            else:
                for dy in range(-int(r) - 1, int(r) + 2):
                    for dx in range(-int(r) - 1, int(r) + 2):
                        if dx * dx + dy * dy <= r * r: s.put(x + dx, y + dy, c)
    def fill(s, cx, cy, rx, ry, c):
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1: s.put(x, y, c)
    def shade(s):
        # a lit upper and left edge, shadow on undersides and right edges, from the neighbours of each filled pixel (the same rules as pixelplant_flat.py)
        out = [r[:] for r in s.g]
        for y in range(s.h):
            for x in range(s.w):
                c = s.g[y][x]
                if c is None or c.endswith(("hi", "lo")) or c + "hi" not in s.C: continue   # any color with a hi and lo ramp is shaded
                hi, lo = c + "hi", c + "lo"; up, dn, lf, rt = s.get(x, y - 1), s.get(x, y + 1), s.get(x - 1, y), s.get(x + 1, y)
                if up is None and (x + y) % 3 != 0: out[y][x] = hi
                elif lf is None and y % 2 == 0: out[y][x] = hi
                elif dn is None or (rt is None and y % 2 == 0): out[y][x] = lo
                elif dn == c and s.get(x, y + 2) is None and (x + y) % 2 == 0: out[y][x] = lo
        s.g = out
    def save(s, path):
        s.shade(); im = Image.new("RGBA", (s.w, s.h), (0, 0, 0, 0))
        for y in range(s.h):
            for x in range(s.w):
                if s.g[y][x]: im.putpixel((x, y), s.C[s.g[y][x]] + (255,))
        im.save(path); print(path, im.size, len({v for r in s.g for v in r if v}), "colors")

def bez(p0, p1, p2, t): return tuple((1 - t) ** 2 * a + 2 * (1 - t) * t * b + t * t * c for a, b, c in zip(p0, p1, p2))
def tangent(p0, p1, p2, t): return tuple(2 * (1 - t) * (b - a) + 2 * t * (c - b) for a, b, c in zip(p0, p1, p2))

def lens(sp, x0, y0, x1, y1, w, teeth=True):
    # one lanceolate pinna: a pointed lens along a line, a little toothed on both edges, with a lighter rib down the middle
    dx, dy = x1 - x0, y1 - y0; d = math.hypot(dx, dy) or 1; nx, ny = -dy / d, dx / d; n = int(d * 2) + 2
    for i in range(n + 1):
        t = i / n; hw = w * math.sin(math.pi * min(max(t, .06), .97)) ** .8 + (.4 if teeth and w > 1.8 and int(t * d) % 3 == 0 and .15 < t < .85 else 0)
        for k in range(-int(hw * 2) - 1, int(hw * 2) + 2):
            if abs(k / 2) <= hw: sp.put(x0 + dx * t + nx * k / 2, y0 + dy * t + ny * k / 2, "leaf")
    if d > 5:
        for i in range(2, n - 1): t = i / n; sp.put(x0 + dx * t, y0 + dy * t, "rib")

def stem(sp, pts, r0, r1):
    for i in range(len(pts) - 1):
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]; n = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
        for k in range(n + 1):
            t = k / n; r = r0 + (r1 - r0) * ((i + t) / (len(pts) - 1)); x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            for dy in range(-3, 4):
                for dx in range(-3, 4):
                    if dx * dx + dy * dy <= r * r: sp.put(x + dx, y + dy, "stem")

FERN = mix(OLIVE, (40, 130, 100), .3)   # the wetland leaf: the olive pulled toward teal
def blade(sp, x0, y0, x1, y1, w, bowx=0, bowy=0):   # a long narrow leaf along a bent curve (grass, reed, strap), a lens in short runs with a rib
    c = ((x0 + x1) / 2 + bowx, (y0 + y1) / 2 + bowy); n = max(3, int(math.hypot(x1 - x0, y1 - y0) / 4))
    for i in range(n):
        a = bez((x0, y0), c, (x1, y1), i / n); b = bez((x0, y0), c, (x1, y1), (i + 1) / n); lens(sp, *a, *b, w * (1 - .55 * i / n), teeth=False)



def ramp(sp, name, rgb): t = tones(rgb); sp.C.update({name: t[0], name + "hi": t[1], name + "lo": t[2]})   # a new shaded color

def tuft(sp, bx, by, n, L, spread, w=.9, lean=0, rnd=0, key="leaf"):   # a fountain of blades from one point: n blades, longest L, fanning +-spread px at the tip
    for i in range(n):
        t = (i / (n - 1) - .5) * 2 if n > 1 else 0; k = 1 - .45 * abs(t) ** 1.5; j = ((i * 7 + rnd) % 5 - 2) * .06
        x1 = bx + t * spread + lean; y1 = by - L * (k + j)
        blade(sp, bx + t * 2, by, x1, y1, w, bowx=t * spread * .35, bowy=L * .12) if key == "leaf" else None

def seedstalk(sp, x0, y0, x1, y1, head, key="stem"):   # a thin stalk with a head drawn by the caller
    sp.line(x0, y0, x1, y1, key, 0); head(x1, y1)

def recolor(sp, name, rgb): ramp(sp, name, rgb)
def wood(sp, rgb):   # the sprite's "stem" color as a woody tone
    t = tones(rgb); sp.C.update(stem=t[0], stemhi=t[1], stemlo=t[2])

def eriophorum():   # small: cottongrass, a thin dark blade tuft with round white cotton heads on slender stalks
    sp = Sprite(44, 38, (62, 100, 64)); ramp(sp, "cot", (238, 238, 226)); wood(sp, (120, 132, 78)); bx, by = 22, 36
    tuft(sp, bx, by, 12, 15, 15, .8, rnd=2)
    for x0, x1, h in ((-6, -10, 26), (0, -2, 31), (4, 6, 27), (8, 13, 21)):
        sx, sy = bx + x1, by - h
        sp.line(bx + x0 * .5, by - 6, sx, sy + 3, "stem", 0)
        sp.fill(sx, sy, 3.6, 3.2, "cot")   # the cotton ball
        for k in range(10):   # fluffy rim: a few loose strands past the edge
            a = k / 10 * 6.283 + x1; sp.put(sx + math.cos(a) * 4.6, sy + math.sin(a) * 4.0, "cot") if k % 2 == 0 else None
        sp.put(sx - 2, sy - 2, "cothi"); sp.put(sx - 1, sy - 3, "cothi"); sp.put(sx + 2, sy + 2, "cotlo"); sp.put(sx + 1, sy + 3, "cotlo")
    for x in range(bx - 8, bx + 9): sp.put(x, by + 1, "leaflo")
    return sp

def empetrum():   # medium: crowberry, a low dense mound of needle leaves, ragged at the edge, with black berries
    sp = Sprite(64, 52, (52, 92, 62)); ramp(sp, "berry", (54, 40, 72)); wood(sp, (140, 84, 54)); bx, by = 32, 50; rnd = random.Random(11)
    cx, cy, rx, ry = 31, 42, 26, 17
    for y in range(int(cy - ry) - 1, by + 1):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1: sp.put(x, y, "leaf")
    for i in range(70):   # needles spiking out past the rim, mostly up and out
        a = math.pi + i / 69 * math.pi; ex = cx + math.cos(a) * rx; ey = cy + math.sin(a) * ry; l = 2 + (i * 5) % 3
        sp.line(ex, ey, ex + math.cos(a) * l, ey + math.sin(a) * l * .9, "leaf", 0)
    for _ in range(8):   # bare red-brown stems low at the sides
        s = rnd.choice((-1, 1)); x = bx + s * rnd.randint(14, 24); sp.line(x, by - 1, x + s * 2, by - 3 - rnd.randint(0, 2), "stem", 0)
    for y in range(int(cy - ry) + 2, by - 1, 2):   # rows of needle dashes: lit up and left, shaded down and right
        for x in range(int(cx - rx) + 1, int(cx + rx), 4):
            xx = x + (y // 2 % 2) * 2
            if sp.get(xx, y) != "leaf" or rnd.random() < .45: continue
            up = ((xx - cx) / rx + (y - cy) / ry) < -.2; k = "leafhi" if up else "leaflo"
            sp.put(xx, y, k)
            if rnd.random() < .6: sp.put(xx + 1, y + 1, k)
    for _ in range(15):   # berries: 2 px black-purple, lit top left
        x = rnd.randint(int(cx - 20), int(cx + 20)); y = rnd.randint(int(cy - 13), int(cy + 5))
        if ((x - cx) / (rx - 3)) ** 2 + ((y - cy) / (ry - 2)) ** 2 > 1: continue
        sp.put(x, y, "berry"); sp.put(x + 1, y, "berry"); sp.put(x, y + 1, "berry"); sp.put(x, y, "berryhi"); sp.put(x + 1, y + 1, "berrylo")
    for x in range(bx - 20, bx + 21): sp.put(x, by + 1, "leaflo")
    return sp

def salix():   # large: arctic willow, a gnarled wind-bent shrub with limbs swept to the right, round leaves and silver catkins
    sp = Sprite(72, 92, (70, 110, 94)); ramp(sp, "cat", (206, 206, 192)); wood(sp, (112, 92, 72)); bx, by = 26, 90; rnd = random.Random(3)
    stem(sp, [(26, 90), (24, 78), (29, 66), (26, 54), (31, 42)], 3.4, 1.8)
    sp.fill(26, 89, 5, 2, "stem")
    limbs = [([(28, 74), (40, 68), (52, 62), (64, 60)], 1.5), ([(28, 62), (40, 52), (52, 44), (63, 38)], 1.5), ([(28, 50), (38, 38), (46, 28), (54, 20)], 1.4),
             ([(25, 76), (16, 70), (9, 70)], 1.2), ([(31, 42), (33, 30), (37, 18), (44, 10)], 1.3), ([(40, 52), (46, 56), (54, 56)], 1.0), ([(46, 28), (54, 30), (62, 28)], 1.0)]
    for pts, r in limbs: stem(sp, pts, r + .6, r - .4 if r > 1 else .5)
    for pts, r in limbs:   # round blue-green leaves along the outer half of each limb, plus a catkin at the tip
        for i in range(len(pts) - 1):
            (x0, y0), (x1, y1) = pts[i], pts[i + 1]
            for k in range(0 if i else 2, 6, 1 if i >= len(pts) - 2 else 2):
                t = k / 6; x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
                for s2 in (-1, 1):
                    lx, ly = x + rnd.uniform(-1, 1) + s2 * 1.6, y + rnd.uniform(-3.2, -.4) if s2 < 0 else y + rnd.uniform(.4, 3)
                    sp.fill(lx, ly, 2.4, 1.8, "leaf")
                    if rnd.random() < .5: sp.put(lx, ly, "rib")
        tx, ty = pts[-1]; sp.fill(tx + 1, ty - 3, 1.2, 2.4, "cat"); sp.put(tx, ty - 5, "cathi"); sp.put(tx + 1, ty - 1, "catlo")
        sp.fill(tx - 2, ty + 1, 1.2, 2.2, "cat"); sp.put(tx - 3, ty - 1, "cathi")
    for x in range(bx - 8, bx + 9): sp.put(x, by + 1, "stemlo")
    return sp

def saxifraga():   # small: purple saxifrage, a tight dark cushion of tiny rosettes covered in purple flowers
    sp = Sprite(44, 32, (46, 92, 70)); ramp(sp, "pur", (160, 74, 160)); bx, by = 22, 30; rnd = random.Random(7)
    cx, cy, rx, ry = 22, 24, 19, 12
    for y in range(int(cy - ry) - 1, by + 1):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1: sp.put(x, y, "leaf")
    for y in range(int(cy - ry) + 2, by - 1, 2):   # the rosettes: short dashes in rows, lit up and left
        for x in range(int(cx - rx) + 1, int(cx + rx), 3):
            xx = x + (y // 2 % 2) * 1
            if sp.get(xx, y) == "leaf": sp.put(xx, y, "leafhi" if ((xx - cx) / rx + (y - cy) / ry) < -.1 else "leaflo")
    pts = []
    for _ in range(60):
        x = rnd.uniform(cx - rx + 3, cx + rx - 3); y = rnd.uniform(cy - ry + 2, cy + 4)
        if ((x - cx) / (rx - 2)) ** 2 + ((y - cy) / (ry - 1)) ** 2 > 1 or any(abs(x - a) < 4 and abs(y - b) < 3 for a, b in pts): continue
        pts.append((x, y))
    for x, y in pts:   # a five-pixel flower, lit top left, a pale eye
        x, y = int(x), int(y)
        for dx, dy in ((0, 0), (-1, 0), (1, 0), (0, -1), (0, 1)): sp.put(x + dx, y + dy, "pur")
        sp.put(x - 1, y - 1, "purhi") if rnd.random() < .5 else None; sp.put(x, y - 1, "purhi"); sp.put(x + 1, y + 1, "purlo") if rnd.random() < .5 else None; sp.put(x, y, "purhi") if False else None
    for x in range(bx - 14, bx + 15): sp.put(x, by + 1, "leaflo")
    return sp

def dryas():   # medium: mountain avens, a spreading mat of crinkled oak-like leaves with white eight-petal flowers and silky seed swirls
    sp = Sprite(64, 48, (52, 92, 62)); ramp(sp, "white", (246, 246, 238)); ramp(sp, "gold", (228, 184, 52)); ramp(sp, "silk", (196, 194, 172)); wood(sp, (120, 96, 70)); bx, by = 31, 46; rnd = random.Random(5)
    for i in range(34):   # leaves radiating over the mat, flat and wide, upper ones tilted up
        a = i / 34 * 6.283 * 2.0 + .3; r = 8 + (i * 7) % 20 * .75; up = math.sin(a) < 0
        x1 = bx + math.cos(a) * r * 1.3; y1 = by - 3 - abs(math.sin(a)) * r * .45 - (4 if up else 0) + (0 if up else 0)
        x0, y0 = bx + math.cos(a) * 3, by - 2
        lens(sp, x0, y0, x1, min(y1, by - 1), 2.2 + (i % 3) * .3)
    for fx, h in ((-17, 17), (-8, 23), (2, 19), (11, 24), (19, 15)):   # flowers on short stalks: eight white petals round a gold eye
        x, y = bx + fx, by - h
        sp.line(bx + fx * .6, by - 5, x, y + 2, "stem", 0)
        for k in range(8):
            a = k / 8 * 6.283; sp.put(x + math.cos(a) * 3.4, y + math.sin(a) * 2.6, "white"); sp.put(x + math.cos(a) * 2.2, y + math.sin(a) * 1.7, "white")
        sp.put(x, y, "gold"); sp.put(x + 1, y, "gold"); sp.put(x, y + 1, "goldlo"); sp.put(x - 2, y - 2, "whitehi"); sp.put(x - 3, y, "whitehi")
    for fx, h in ((-13, 26), (6, 31)):   # a seed swirl: a silky tuft with curling plumes
        x, y = bx + fx, by - h
        sp.line(bx + fx * .6, by - 5, x, y + 2, "stem", 0)
        sp.fill(x, y, 3, 3, "silk")
        for k in range(6): a = k / 6 * 6.283; sp.put(x + math.cos(a) * 4.4, y + math.sin(a) * 4.0, "silk")
        sp.put(x - 1, y - 2, "silkhi"); sp.put(x - 2, y, "silkhi"); sp.put(x + 1, y + 2, "silklo")
    return sp

def betula():   # large: dwarf birch, many thin red-brown stems forking into a round twiggy crown of small scalloped leaves, some turned russet
    sp = Sprite(72, 92, (78, 112, 52)); ramp(sp, "rust", (160, 86, 42)); wood(sp, (96, 58, 46)); bx, by = 36, 90; rnd = random.Random(9)
    leaves = []
    def branch(x, y, ang, ln, d):
        x1, y1 = x + math.sin(ang) * ln, y - math.cos(ang) * ln
        if not 5 < x1 < 66: return
        sp.line(x, y, x1, y1, "stem", 1 if d == 0 else 0)
        if d >= 3 or ln < 5: leaves.append((x1, y1)); return
        if d >= 1: leaves.append(((x + x1) / 2, (y + y1) / 2))
        for da in (-.5, .45):
            branch(x1, y1, ang + da * .62 + rnd.uniform(-.1, .1), ln * rnd.uniform(.6, .7), d + 1)
    for i, (dx, ang, ln) in enumerate(((-5, -.3, 27), (-3, -.16, 32), (0, 0, 35), (3, .15, 32), (5, .3, 27), (-1, -.08, 23), (2, .08, 20))):
        branch(bx + dx, by - 2, ang, ln, 0)
    for x, y in leaves:   # small round leaves in clumps, a third russet
        for _ in range(2):
            lx, ly = min(max(x + rnd.uniform(-3.2, 3.2), 5), 66), y + rnd.uniform(-3, 2.4); c = "rust" if rnd.random() < .16 else "leaf"
            sp.fill(lx, ly, 1.9, 1.6, c)
            if rnd.random() < .4: sp.put(lx, ly, "rib" if c == "leaf" else "rusthi")
    for x in range(bx - 9, bx + 10): sp.put(x, by + 1, "stemlo")
    return sp

def labrador():   # Park Plant: a dense low shrub of narrow leathery leaves, rusty stems and rounded white flower clusters
    sp = Sprite(48, 40, (62, 98, 58)); ramp(sp, "white", (244, 244, 236)); ramp(sp, "rust", (176, 104, 52)); wood(sp, (140, 84, 50)); bx, by = 23, 38; rnd = random.Random(13)
    tips = []
    for i, (x0, x1, h) in enumerate(((-14, -16, 20), (-9, -10, 25), (-4, -4, 29), (1, 2, 27), (6, 8, 30), (11, 12, 24), (16, 15, 19))):
        sp.line(bx + x0 * .4, by - 2, bx + x1, by - h + 3, "stem", 0); tips.append((bx + x1, by - h))
        for k in range(1, 5):   # narrow leathery leaves in pairs down the stem, a rust edge showing under each
            t = k / 5; x = bx + x0 * .4 + (x1 - x0 * .4) * t; y = by - 2 - (h - 5) * t
            for s2 in (-1, 1): lens(sp, x, y, x + s2 * 6, y - 3 - k * .3, 1.0, teeth=False); sp.put(x + s2 * 4, y - 1, "rust")
    for x, y in tips:   # a round umbel: short spokes ending in white flowers
        for k in range(7):
            a = -math.pi * .9 + k / 6 * math.pi * 1.8 * .55 - .3; ex, ey = x + math.cos(a) * 3.8, y - 2 + math.sin(a) * 2.8
            sp.line(x, y, ex, ey, "leaf", 0); sp.put(ex, ey, "white"); sp.put(ex + 1, ey, "white"); sp.put(ex, ey - 1, "whitehi"); sp.put(ex + 1, ey + 1, "whitelo")
        sp.fill(x, y - 3, 1.5, 1.2, "white"); sp.put(x - 1, y - 4, "whitehi")
    for x in range(bx - 11, bx + 12): sp.put(x, by + 1, "leaflo")
    return sp

out = sys.argv[1] if len(sys.argv) > 1 else "sprites/plants"
for key, fn in (("neo-tundra-small", eriophorum), ("neo-tundra-medium", empetrum), ("neo-tundra-large", salix),
                ("qua-tundra-small", saxifraga), ("qua-tundra-medium", dryas), ("qua-tundra-large", betula), ("q-labrador-tea", labrador)):
    fn().save(f"{out}/{key}.png")
