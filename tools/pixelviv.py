# Draws the vivarium props in the park style (docs/art.md, "Park style"; the browns and greens are tools/genesis_style.py PAL): each material is a set of a dark edge
# tinted to it, a light, a mid and a shade; light from the top left, a lit top-left edge and shade on the undersides and right; Cv.img() puts a one-pixel edge round
# the silhouette in the material's edge color, so every picture is 2 px wider and taller than its canvas (VIV_SPRITES in data.js). Pixels are 0.13 m (ROCK_MPP). Upright props are drawn with their base at the bottom middle; the pool, the light pool and the dish are flat on the floor.
#   vbark   Cork Bark Hide      vbranch Climbing Branches   vdig  Dig Box            vfeed Live-Feed Dispenser   vmist Misters
#   vdish   Food Dish (empty bowl; the food is drawn over it)   vlamp Basking Lamp (+ vlamp-pool, its warm pool of light)   vpool Pool
# Usage: python3 -I tools/pixelviv.py [outdir] [sheet.png]   (default sprites/viv; the optional sheet is a x8 view of every picture)
import sys, os, math
from PIL import Image

def mix(a, b, t): return tuple(round(x * (1 - t) + y * t) for x, y in zip(a, b))
EDGE, SHADE = {}, {}   # every material tone -> that material's dark edge (for the outline) and its shade (to fill gaps the outline can't reach)
def mat(edge, hi, md, lo):
    m = {"hi": hi, "mid": md, "lo": lo, "deep": edge, "edge": edge}
    for c in (hi, md, lo, edge): EDGE.setdefault(c, edge); SHADE.setdefault(c, lo)
    return m
NO_EDGE = set()   # see-through bits drawn without an outline (spray, glow)
# browns from PAL (X light, W/V mid, U shade, M joints, G darkest)
BARK = mat((44, 35, 19), (165, 125, 74), (132, 101, 59), (110, 85, 49))
WOOD = mat((44, 35, 19), (165, 125, 74), (143, 109, 64), (110, 85, 49))
SOIL = mat((44, 35, 19), (132, 101, 59), (110, 85, 49), (66, 53, 29))
STEEL = mat((31, 37, 41), (184, 192, 196), (138, 146, 152), (96, 104, 110))
WATER = mat((20, 50, 70), (120, 188, 216), (62, 134, 168), (44, 102, 134))
STONE = mat((38, 36, 30), (176, 170, 152), (138, 133, 118), (102, 98, 86))
COPPER = mat((66, 32, 12), (228, 152, 92), (190, 112, 52), (142, 80, 36))
OLIVE = mat((40, 44, 10), (140, 152, 60), (97, 111, 34), (70, 80, 24))
BULB = mat((120, 84, 20), (255, 240, 180), (250, 214, 110), (220, 170, 70))
def ramp(base): return mat(mix(base, (0, 0, 0), .7), mix(base, (255, 255, 255), .28), base, mix(base, (0, 0, 0), .24))   # a set from one color, for a material with no PAL tones

class Cv:
    def __init__(s, w, h): s.w, s.h, s.px = w, h, {}
    def put(s, x, y, c):
        if 0 <= x < s.w and 0 <= y < s.h: s.px[(x, y)] = c
    def rect(s, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): s.put(x, y, c)
    def ell(s, cx, cy, rx, ry, c, top=None):
        # filled ellipse; the rows in `top` (a count) from the upper edge are drawn in that colour pair's lit tone by the caller
        for y in range(s.h):
            for x in range(s.w):
                if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1: s.put(x, y, c)
    def inside(s, x, y, cx, cy, rx, ry): return ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1
    def line(s, x0, y0, x1, y1, th, c_hi, c_mid, c_lo):
        # a thick stick: left pixel lit, right pixel shaded
        n = max(abs(x1 - x0), abs(y1 - y0)) or 1
        for i in range(n + 1):
            x, y = round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n)
            for k in range(th): s.put(x + k, y, c_hi if k == 0 else c_lo if k == th - 1 else c_mid)
    def img(s, a=255):
        # the picture with a one-pixel edge round its silhouette (4-neighbours), in the edge color of the pixel it borders (above first, then left, right, below);
        # gaps inside the silhouette that the outside can't reach are filled with the shade of what's round them instead, so they don't turn to dark specks
        im = Image.new("RGBA", (s.w + 2, s.h + 2), (0, 0, 0, 0)); solid = {k for k, c in s.px.items() if c not in NO_EDGE}
        out, todo = {(-2, -2)}, [(-2, -2)]
        while todo:
            x, y = todo.pop()
            for q in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if -2 <= q[0] <= s.w + 1 and -2 <= q[1] <= s.h + 1 and q not in out and q not in solid: out.add(q); todo.append(q)
        for y in range(-1, s.h + 1):
            for x in range(-1, s.w + 1):
                if (x, y) in solid: continue
                for nb in ((x, y + 1), (x + 1, y), (x - 1, y), (x, y - 1)):
                    if nb in solid:
                        c = s.px[nb]; im.putpixel((x + 1, y + 1), (EDGE.get(c, mix(c, (0, 0, 0), .7)) if (x, y) in out else SHADE.get(c, c)) + (a,)); break
        for (x, y), c in s.px.items(): im.putpixel((x + 1, y + 1), c + (a,) if len(c) == 3 else c)
        return im

def bark():
    c = Cv(16, 10)
    # a curl of cork bark: a dome with a dark opening, lit on the top left, grooves running down it
    for y in range(10):
        for x in range(16):
            if c.inside(x, y, 8, 10, 8, 9.6):
                lit = (x - 8) / 8 + (y - 10) / 9.6 < -.9
                shade = x > 11 or y > 8
                c.put(x, y, BARK["hi"] if lit else BARK["lo"] if shade else BARK["mid"])
    for x in (4, 7, 10, 13):
        for y in range(2 + (x % 3), 8, 2):
            if (x, y) in c.px and c.px[(x, y)] != BARK["hi"]: c.put(x, y, BARK["lo"])
    for y in range(5, 10):
        for x in range(4, 12):
            if c.inside(x, y, 8, 10, 3.6, 4.6): c.put(x, y, BARK["deep"])
    for x in range(1, 15): 
        if (x, 9) in c.px and c.px[(x, 9)] != BARK["deep"]: c.put(x, 9, BARK["lo"])
    return c

def branch():
    c = Cv(16, 20)
    H, M, L = WOOD["hi"], WOOD["mid"], WOOD["lo"]
    c.line(7, 19, 8, 8, 3, H, M, L)          # trunk
    c.line(8, 8, 3, 2, 2, H, M, L)           # left fork
    c.line(8, 10, 13, 4, 2, H, M, L)         # right fork
    c.line(5, 5, 2, 7, 2, H, M, L)           # twig
    c.line(11, 7, 14, 10, 2, H, M, L)        # twig
    for y in (13, 16): c.put(8, y, WOOD["deep"])   # knots
    c.put(10, 5, WOOD["deep"]); c.put(5, 4, WOOD["deep"])
    for x in range(5, 12): c.put(x, 19, WOOD["deep"])   # a flat foot
    for x in range(6, 11): c.put(x, 18, L)
    return c

def dig():
    c = Cv(16, 11)
    # top face: loose soil with scooped holes and dashes; front face: planks
    for y in range(0, 5):
        for x in range(1, 15): c.put(x, y, SOIL["mid"])
    for x in range(1, 15): c.put(x, 0, SOIL["hi"])
    for y in range(0, 5): c.put(1, y, SOIL["hi"]); c.put(14, y, SOIL["lo"])
    for (x, y, w) in ((4, 1, 3), (9, 2, 3), (5, 3, 2), (11, 1, 2)):
        for k in range(w): c.put(x + k, y, SOIL["lo"])
    for x in range(8, 11): c.put(x, 3, SOIL["deep"])
    for y in range(5, 11):
        for x in range(0, 16): c.put(x, y, WOOD["mid"])
    for x in range(0, 16): c.put(x, 5, WOOD["hi"]); c.put(x, 10, WOOD["deep"]); c.put(x, 9, WOOD["lo"])
    for y in range(5, 11): c.put(0, y, WOOD["hi"]); c.put(15, y, WOOD["lo"])
    for x in (5, 10): 
        for y in range(6, 9): c.put(x, y, WOOD["lo"])
    for x in (2, 7, 12): c.put(x, 7, WOOD["lo"])
    return c

def feed():
    c = Cv(10, 15)
    S = STEEL
    # a hopper with a spout and a little tray; olive crickets in the tray
    for y in range(0, 7):
        for x in range(0, 10):
            half = 5 - y * .4
            if abs(x + .5 - 5) <= half: c.put(x, y, S["mid"])
    for y in range(0, 7):
        for x in range(0, 10):
            if (x, y) in c.px and x + .5 - 5 < -(5 - y * .4) + 1.2: c.put(x, y, S["hi"])
            elif (x, y) in c.px and x + .5 - 5 > (5 - y * .4) - 1.4: c.put(x, y, S["lo"])
    for x in range(1, 9): c.put(x, 0, S["hi"])
    c.rect(4, 7, 5, 10, S["lo"]); c.put(4, 7, S["mid"]); c.put(4, 8, S["mid"])
    c.rect(1, 11, 8, 13, S["mid"]); c.rect(1, 11, 8, 11, S["hi"]); c.rect(1, 13, 8, 13, S["lo"]); c.put(8, 12, S["lo"])
    c.rect(2, 12, 7, 12, S["deep"])
    for x in (3, 5, 6): c.put(x, 12, OLIVE["mid"])
    c.put(4, 12, OLIVE["hi"])
    c.rect(0, 14, 9, 14, S["deep"])
    c.put(3, 3, (216, 176, 74)); c.put(4, 3, (216, 176, 74))   # a gold hatch
    return c

def mist():
    c = Cv(14, 17)
    S = STEEL
    c.rect(6, 6, 7, 15, S["mid"]); c.rect(6, 6, 6, 15, S["hi"]); c.rect(7, 6, 7, 15, S["lo"])
    c.rect(3, 15, 10, 16, S["lo"]); c.rect(3, 15, 10, 15, S["mid"])
    c.rect(4, 4, 9, 5, S["mid"]); c.rect(4, 4, 9, 4, S["hi"]); c.rect(4, 5, 9, 5, S["lo"])
    # the spray: pale blue droplets fanning down and out, thinner as they fall
    DR, DR2 = (190, 226, 240), (124, 186, 214); NO_EDGE.update((DR, DR2))
    for (x, y, d) in ((3, 6, 0), (2, 8, 1), (3, 10, 0), (10, 6, 0), (11, 8, 1), (10, 10, 0), (6, 3, 0), (7, 2, 1), (1, 11, 1), (12, 11, 1), (5, 8, 1), (8, 9, 1)):
        c.put(x, y, DR if d == 0 else DR2)
    return c

def dish():
    c = Cv(12, 6)
    for y in range(6):
        for x in range(12):
            if c.inside(x, y, 6, 2.6, 6, 2.6): c.put(x, y, STEEL["mid"])
    for y in range(6):
        for x in range(12):
            if (x, y) in c.px and (x + y * .8 < 5): c.put(x, y, STEEL["hi"])
    for y in range(6):
        for x in range(12):
            if c.inside(x, y, 6, 2.4, 4.4, 1.7): c.put(x, y, STEEL["deep"])
    for x in range(2, 10): c.put(x, 5, STEEL["lo"])
    for x in range(3, 9): 
        if (x, 5) in c.px: c.put(x, 5, STEEL["deep"])
    return c

def lamp():
    c = Cv(10, 19)
    S, C = STEEL, COPPER
    c.rect(2, 17, 7, 18, S["lo"]); c.rect(2, 17, 7, 17, S["mid"])
    c.rect(5, 6, 6, 17, S["mid"]); c.rect(5, 6, 5, 17, S["hi"]); c.rect(6, 6, 6, 17, S["lo"])
    # the shade: a copper dome leaning over the stand, with a glowing bulb under it
    for y in range(0, 8):
        for x in range(0, 10):
            if c.inside(x, y, 5, 8, 5, 7.6) and y <= 6:
                c.put(x, y, C["hi"] if (x - 5) / 5 + (y - 8) / 7.6 < -.85 else C["lo"] if x > 6 or y > 5 else C["mid"])
    for x in range(0, 10):
        if (x, 6) in c.px: c.put(x, 6, C["deep"])
    c.rect(3, 7, 6, 7, BULB["mid"]); c.rect(4, 7, 5, 7, BULB["hi"])
    c.put(4, 8, (255, 232, 160)); c.put(5, 8, (255, 232, 160)); NO_EDGE.add((255, 232, 160))   # the glow under the bulb
    return c

def lamp_pool():
    # the pool of warm light on the floor: three stepped bands, each a flat tone at one opacity (no soft edges)
    W, H = 44, 20
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    bands = ((1.0, 1.0, 34), (.72, .74, 40), (.42, .46, 48))
    for rx, ry, a in bands:
        for y in range(H):
            for x in range(W):
                if ((x + .5 - W / 2) / (W / 2 * rx)) ** 2 + ((y + .5 - H / 2) / (H / 2 * ry)) ** 2 <= 1:
                    old = im.getpixel((x, y))
                    im.putpixel((x, y), (255, 214, 120, min(255, old[3] + a)))
    return im

def pool():
    c = Cv(20, 11)
    cx, cy, rx, ry = 10, 5.5, 10, 5.5
    for y in range(11):
        for x in range(20):
            if c.inside(x, y, cx, cy, rx, ry):
                c.put(x, y, STONE["lo"] if (y > 7 or x > 16) else STONE["hi"] if (y < 3 and x < 9) else STONE["mid"])
    # stones along the rim: a few darker joints
    for (x, y) in ((3, 2), (7, 0), (13, 0), (17, 3), (18, 6), (14, 10), (7, 10), (2, 7)):
        if (x, y) in c.px: c.put(x, y, STONE["deep"])
    # the water, set in the rim: darker toward the far (top) side, lit glints
    for y in range(11):
        for x in range(20):
            if c.inside(x, y, cx, cy + .2, rx - 2, ry - 1.7):
                c.put(x, y, WATER["lo"] if y < 4 else WATER["mid"] if y < 7 else WATER["hi"])
    for (x, y, w) in ((5, 4, 3), (11, 6, 4), (7, 7, 2), (13, 4, 2)):
        for k in range(w):
            if (x + k, y) in c.px: c.put(x + k, y, mix(WATER["hi"], (255, 255, 255), .45))
    for x in range(4, 16):
        if (x, 2) in c.px and c.px[(x, 2)] == WATER["lo"]: c.put(x, 2, WATER["deep"])
    return c

ALL = {"vbark":bark, "vbranch":branch, "vdig":dig, "vfeed":feed, "vmist":mist, "vdish":dish, "vlamp":lamp, "vpool":pool}

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "sprites/viv"
    os.makedirs(out, exist_ok=True)
    ims = {}
    for k, fn in ALL.items():
        ims[k] = fn().img(); ims[k].save(os.path.join(out, k + ".png"))
    ims["vlamp-pool"] = lamp_pool(); ims["vlamp-pool"].save(os.path.join(out, "vlamp-pool.png"))
    if len(sys.argv) > 2:
        Z, pad = 8, 3
        sheet = Image.new("RGBA", (sum(i.width for i in ims.values()) * Z + pad * Z * (len(ims) + 1), max(i.height for i in ims.values()) * Z + pad * Z * 2), (214, 200, 160, 255))
        x = pad * Z
        for im in ims.values():
            sheet.alpha_composite(im.resize((im.width * Z, im.height * Z), Image.NEAREST), (x, pad * Z)); x += (im.width + pad) * Z
        sheet.save(sys.argv[2])
