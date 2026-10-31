# Draws the vivarium props in the park style (docs/art.md, "Park style"; the browns and greens are tools/genesis_style.py PAL), at the case's fine pixel:
# DET (3) times finer than the park's 0.13 m (0.043 m a pixel), to match the animals, which are drawn that big in a case. Each picture is built from parts;
# a part is a mask in one material (a set of a dark edge tinted to it, a light, a mid, a shade and a deep detail tone): its own one-pixel edge all round, a
# two-pixel lit rim along its top and left and a shaded rim along its bottom and right, then structured detail (grain, seams, rivets, grooves) in its tones.
# A later part laid over an earlier one keeps its edge, so the parts read apart. Upright props have their base on the bottom row, centered; the pool and the
# dish lie flat on the floor. VIV_SPRITES in js/data.js lists each picture's size in fine pixels (VIV_MPP a pixel).
#   vbark   Cork Bark Hide      vbranch Climbing Branches   vdig  Dig Box            vfeed Live-Feed Dispenser   vmist Misters
#   vdish   Food Dish (empty bowl; the food is drawn over it)   vlamp Basking Lamp (+ vlamp-pool, its warm pool of light, at 0.13 m)   vpool Pool
# Usage: python3 -I tools/pixelviv.py [outdir] [sheet.png]   (default sprites/viv; the optional sheet is a x4 view of every picture)
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from pixelvivscene import ell, line, stroke, curve, DET

U = DET   # one park pixel in fine pixels
def mix(a, b, t): return tuple(round(x * (1 - t) + y * t) for x, y in zip(a, b))
def mat(edge, hi, md, lo):
    return {"hi": hi, "mid": md, "lo": lo, "deep": mix(lo, edge, .45), "edge": edge}
def ramp(base): return mat(mix(base, (0, 0, 0), .7), mix(base, (255, 255, 255), .28), base, mix(base, (0, 0, 0), .24))   # a set from one color, for a material with no PAL tones
# browns from PAL (X light, W/V mid, U shade, M joints, G darkest)
BARK = mat((44, 35, 19), (165, 125, 74), (132, 101, 59), (110, 85, 49))
WOOD = mat((44, 35, 19), (165, 125, 74), (143, 109, 64), (110, 85, 49))
SOIL = mat((44, 35, 19), (132, 101, 59), (110, 85, 49), (84, 66, 38))
STEEL = mat((31, 37, 41), (196, 204, 208), (146, 154, 160), (104, 112, 118))
WATER = mat((20, 50, 70), (120, 188, 216), (62, 134, 168), (44, 102, 134))
STONE = mat((38, 36, 30), (180, 174, 156), (140, 135, 120), (104, 100, 88))
COPPER = mat((66, 32, 12), (232, 160, 100), (192, 114, 54), (144, 82, 38))
OLIVE = mat((40, 44, 10), (150, 162, 66), (104, 118, 38), (74, 84, 26))
BULB = mat((120, 84, 20), (255, 244, 196), (250, 216, 116), (222, 172, 72))
GOLD = mat((80, 58, 14), (240, 210, 120), (216, 176, 74), (170, 132, 46))

class Cv:
    def __init__(s, w, h): s.w, s.h, s.px = w, h, {}
    def put(s, x, y, c):
        if 0 <= x < s.w and 0 <= y < s.h: s.px[(x, y)] = c
    def part(s, mask, M, tex=None, rim=2):
        # mask in material M: its edge, a lit rim top and left, a shaded rim bottom and right; tex(x, y) can then name a tone ("hi", "lo", "deep", "edge") for an inside pixel
        mask = {p for p in mask if 0 <= p[0] < s.w and 0 <= p[1] < s.h}
        for (x, y) in mask:
            if any(q not in mask for q in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1))): s.px[(x, y)] = M["edge"]; continue
            lit = any((x - k, y) not in mask or (x, y - k) not in mask for k in range(2, rim + 2))
            dark = any((x + k, y) not in mask or (x, y + k) not in mask for k in range(2, rim + 2))
            tone = "hi" if lit and not dark else "lo" if dark and not lit else "mid"
            t = tex(x, y) if tex else None
            s.px[(x, y)] = M[t or tone]
        return mask
    def dot(s, pts, col):
        for x, y in pts: s.put(x, y, col)
    def img(s):
        im = Image.new("RGBA", (s.w, s.h), (0, 0, 0, 0)); p = im.load()
        for (x, y), c in s.px.items(): p[x, y] = c + (255,) if len(c) == 3 else c
        return im
def rect(x0, y0, x1, y1): return {(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)}
def poly(pts):   # a filled polygon (pixel centers inside)
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]; out = set()
    for y in range(math.floor(min(ys)), math.ceil(max(ys)) + 1):
        for x in range(math.floor(min(xs)), math.ceil(max(xs)) + 1):
            cx, cy, inside = x + .5, y + .5, False
            for (ax, ay), (bx, by) in zip(pts, pts[1:] + pts[:1]):
                if (ay > cy) != (by > cy) and cx < ax + (cy - ay) * (bx - ax) / (by - ay): inside = not inside
            if inside: out.add((x, y))
    return out

def bark():
    c = Cv(16 * U, 10 * U); W, H = c.w, c.h
    # a curl of cork bark: a dome with grooves running down it, a dark opening low in the middle
    dome = {p for p in ell(W / 2, H, W / 2, H - .5) if p[1] < H}
    c.part(dome, BARK, lambda x, y: "deep" if (x + round(math.sin(y / 3) * 1.5)) % 6 == 0 and y > 3 else "lo" if (x * 2 + y) % 9 == 0 and y % 4 == 1 else None)
    c.part({p for p in ell(W / 2, H, 3.6 * U, 4.6 * U) if p[1] < H}, mat((24, 18, 10), (60, 46, 28), (40, 31, 18), (32, 24, 14)))
    c.dot([(x, H - 1) for x in range(W) if (x, H - 1) in dome and not (W / 2 - 3.6 * U < x < W / 2 + 3.6 * U)], BARK["edge"])
    return c

def branch():
    c = Cv(16 * U, 20 * U); W, H = c.w, c.h
    groove = lambda x, y: "deep" if x % 4 == 1 and (y // 5 + x) % 3 else None   # bark lines running along, broken every few pixels
    c.part(rect(5 * U, H - 2, 11 * U, H - 1) | rect(6 * U, H - 4, 10 * U, H - 3), WOOD)   # a flat foot
    c.part(curve([(8 * U, H - 2), (8 * U - 1, 14 * U), (8.5 * U, 8 * U)], 2.6 * U), WOOD, groove)   # trunk
    c.part(curve([(8.5 * U, 8.5 * U), (6 * U, 5 * U), (3 * U, 2 * U)], 1.8 * U), WOOD, groove)   # left fork
    c.part(curve([(8.5 * U, 10 * U), (11 * U, 7 * U), (13.5 * U, 4 * U)], 1.8 * U), WOOD, groove)   # right fork
    c.part(stroke(5 * U, 5 * U, 1.5 * U, 7 * U, 1.3 * U), WOOD); c.part(stroke(11.5 * U, 7 * U, 14.5 * U, 10 * U, 1.3 * U), WOOD)   # twigs
    for kx, ky in ((8 * U, 13 * U), (8 * U, 16.5 * U), (5 * U, 4.5 * U)): c.part(ell(kx, ky, U * .8, U * .6), mat(WOOD["edge"], WOOD["lo"], WOOD["deep"], WOOD["deep"]))   # knots
    return c

def dig():
    c = Cv(16 * U, 11 * U); W, H = c.w, c.h
    top = 5 * U
    # top face: loose soil with scooped hollows and crumbs; front face: two planks with a gap, grain and nails, a post at each end
    c.part(rect(U, 0, W - U - 1, top), SOIL, lambda x, y: "lo" if (x + (y // 3) * 4) % 9 < 2 and y % 3 == 1 else "hi" if (x + y * 5) % 17 == 0 else None)
    for hx, hy, rx in ((4.5 * U, 2 * U, 1.6 * U), (10.5 * U, 2.6 * U, 1.4 * U), (7.5 * U, 3.6 * U, 1.1 * U)):
        c.part(ell(hx, hy, rx, rx * .55), mat(SOIL["edge"], SOIL["lo"], SOIL["deep"], SOIL["deep"]))
    for i, (y0, y1) in enumerate(((top + 1, top + 3 * U - 1), (top + 3 * U + 1, H - 1))):
        c.part(rect(0, y0, W - 1, y1), WOOD, lambda x, y, i=i: "lo" if (y - y0) % 3 == 1 and (x + i * 7 + (y // 3) * 5) % 13 < 6 else None)
    for px in (0, W - 1 - 2 * U): c.part(rect(px, top, px + 2 * U, H - 1), WOOD)
    for nx in (U, W - U - 1):
        for ny in (top + U + 1, top + 4 * U + 1): c.part(rect(nx - 1, ny, nx, ny + 1), STEEL)
    return c

def feed():
    c = Cv(10 * U, 15 * U); W, H = c.w, c.h
    # a steel hopper with a seam and rivets and a gold hatch, a spout, and a tray of crickets
    c.part(poly([(0, 0), (W, 0), (W - 3 * U, 7 * U), (3 * U, 7 * U)]), STEEL, lambda x, y: "deep" if y == 2 * U else "lo" if x == W // 2 and y > 2 * U else None)
    c.dot([(x, 2 * U - 2) for x in range(U + 1, W - U - 1, 2 * U)], STEEL["edge"])   # rivets
    c.part(rect(3 * U, 3 * U, 5 * U, 5 * U - 1), GOLD); c.dot([(4 * U, 4 * U)], GOLD["edge"])
    c.part(rect(4 * U, 7 * U, 6 * U - 1, 11 * U), STEEL)
    c.part(rect(U // 2, 11 * U, W - U // 2 - 1, 14 * U - 1), STEEL); c.part(rect(U + 2, 11 * U + 3, W - U - 3, 13 * U - 1), mat((24, 26, 28), (60, 64, 68), (44, 48, 52), (36, 40, 44)))
    for cx in (2.5 * U, 5 * U, 7.5 * U):   # crickets: a body and two kicked-back legs
        c.part(ell(cx, 12 * U - 1, U * 1.1, U * .7), OLIVE); c.dot([(round(cx + U * .5), round(12 * U) - 3), (round(cx + U), round(12 * U) - 4), (round(cx - U), round(12 * U) - 3)], OLIVE["edge"])
    c.part(rect(0, H - U, W - 1, H - 1), STEEL)
    return c

DROPS = ((190, 226, 240), (124, 186, 214))
def mist(f=0, n=1):
    c = Cv(14 * U, 17 * U); W, H = c.w, c.h
    cx = W // 2
    c.part(rect(3 * U, H - 2 * U, W - 3 * U - 1, H - 1), STEEL)   # base plate
    c.part(rect(cx - U, 6 * U, cx + U - 1, H - 2 * U), STEEL, lambda x, y: "deep" if y % (3 * U) == 0 else None)   # the pole, jointed
    c.part(rect(4 * U, 4 * U, W - 4 * U - 1, 6 * U), STEEL)   # the nozzle head
    c.dot([(x, 6 * U - 1) for x in range(5 * U, W - 5 * U, U)], STEEL["edge"])   # its jets
    # the spray (see-through bits with no edge): on each side three streams of droplets thrown out and falling, each droplet a third of the way behind
    # the next, moving a frame's share along its arc, smaller as it falls; frame f of n, so the last frame runs into the first
    for sd in (-1, 1):
        for vx, vy in ((1.6, -.4), (2.4, .2), (1.0, .6)):
            for j in range(3):
                t = (j / 3 + f / n) % 1; x = round(cx + sd * (U + vx * t * 4 * U)); y = round(6 * U + (vy * t * 4 + t * t * 5) * U); sz = 2 if t < .55 else 1
                for a in range(sz):
                    for b_ in range(sz): c.put(x + a, y + b_, DROPS[0] if (a, b_) == (0, 0) else DROPS[1])
    for j in range(3):   # a puff of fine mist drifting up off the nozzle
        t = (j / 3 + f / n) % 1; c.put(round(cx - 1 + math.sin(t * 6.3 + j) * 2), round(4 * U - 1 - t * 3.5 * U), DROPS[0] if t < .5 else DROPS[1])
    return c

def dish():
    c = Cv(12 * U, 6 * U); W, H = c.w, c.h
    c.part(ell(W / 2, H / 2 - .5, W / 2, H / 2 - .5), STEEL)
    c.part(ell(W / 2, H / 2 - U * .3, W / 2 - 1.6 * U, H / 2 - 1.3 * U), mat((24, 26, 28), (70, 74, 80), (48, 52, 56), (40, 44, 48)))   # the well
    c.dot([(x, U) for x in range(3 * U, 6 * U)], STEEL["hi"])   # a glint on the rim
    return c

def lamp():
    c = Cv(10 * U, 19 * U); W, H = c.w, c.h
    cx = W // 2
    c.part(rect(2 * U, H - 2 * U, W - 2 * U - 1, H - 1), STEEL)
    c.part(rect(cx - 1, 7 * U, cx + U, H - 2 * U), STEEL, lambda x, y: "deep" if y in (11 * U, 15 * U) else None)
    # the shade: a copper dome with ribs, a rolled rim, and the glowing bulb under it
    c.part({p for p in ell(cx, 7 * U, W / 2, 6.6 * U) if p[1] < 7 * U}, COPPER, lambda x, y: "deep" if abs(x - cx) % (2 * U) == 0 and y > U * 2 and x != cx else "hi" if abs(x - cx + 1) % (2 * U) == 0 and y > U * 2 and x < cx else None)
    c.part(rect(0, 6 * U, W - 1, 7 * U), COPPER)
    c.part(ell(cx, 7.6 * U, 1.8 * U, U * .9), BULB)
    for k in range(-2, 3): c.put(cx + k, 8 * U + 2, (255, 236, 170))
    return c

def lamp_pool():
    # the pool of warm light on the floor, at the park's 0.13 m (it lies on the map's floor, not in the case's fine pixels): three stepped bands, each one flat tone at one opacity
    W, H = 44, 20
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for rx, ry, a in ((1.0, 1.0, 34), (.72, .74, 40), (.42, .46, 48)):
        for y in range(H):
            for x in range(W):
                if ((x + .5 - W / 2) / (W / 2 * rx)) ** 2 + ((y + .5 - H / 2) / (H / 2 * ry)) ** 2 <= 1:
                    old = im.getpixel((x, y)); im.putpixel((x, y), (255, 214, 120, min(255, old[3] + a)))
    return im

def pool():
    c = Cv(20 * U, 11 * U); W, H = c.w, c.h
    c.part(ell(W / 2, H / 2, W / 2 - .5, H / 2 - .5), STONE)
    c.part(ell(W / 2, H / 2 + U * .3, W / 2 - 2.2 * U, H / 2 - 1.8 * U), WATER, lambda x, y: "lo" if y < H * .38 else "hi" if (y - 4) % 5 == 0 and (x + y * 3) % 13 < 5 else None)
    for i in range(14):   # stones round the rim, each with its edge
        a = i / 14 * 2 * math.pi; sx, sy = W / 2 + math.cos(a) * (W / 2 - 1.2 * U), H / 2 + math.sin(a) * (H / 2 - 1.1 * U)
        c.part(ell(sx, sy, 1.4 * U, U), STONE)
    return c

FRAMES = {"vmist":6}   # animated props: frame count (<key>.png is the first, then <key>-2.png and on; VIV_SPRITES gives each its frames and fps)
def save(fns, frames, out, ims):
    for k, fn in fns.items():
        n = frames.get(k, 1)
        for f in range(n):
            im = (fn(f, n) if n > 1 else fn()).img(); im.save(os.path.join(out, k + (f"-{f + 1}" if f else "") + ".png"))
            if not f: ims[k] = im
ALL = {"vbark":bark, "vbranch":branch, "vdig":dig, "vfeed":feed, "vmist":mist, "vdish":dish, "vlamp":lamp, "vpool":pool}

def sheet(ims, path, bg=(214, 200, 160, 255), Z=4, pad=4):
    sh = Image.new("RGBA", (sum(i.width for i in ims) * Z + pad * Z * (len(ims) + 1), max(i.height for i in ims) * Z + pad * Z * 2), bg); x = pad * Z
    for im in ims: sh.alpha_composite(im.resize((im.width * Z, im.height * Z), Image.NEAREST), (x, pad * Z)); x += (im.width + pad) * Z
    sh.save(path)

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "sprites/viv"
    os.makedirs(out, exist_ok=True)
    ims = {}
    save(ALL, FRAMES, out, ims)
    lamp_pool().save(os.path.join(out, "vlamp-pool.png"))
    if len(sys.argv) > 2: sheet(list(ims.values()), sys.argv[2])
