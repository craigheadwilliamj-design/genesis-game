# Draws the shelters (barns, caves, canopies, burrow) and the food trays in the flat pixel style (see CLAUDE.md, Art direction): flat fills, no outlines, light from the
# top left, a lit top-left edge and shade on the undersides and right. Pixels are 0.13 m (ROCK_MPP). Upright pictures stand with their base on the bottom row;
# the trays lie flat, empty (the game draws the food over the well, see TRAY_SPRITES in data.js).
#   sprites/shelter: shelter (Small Barn), barn (Large Barn, open front), burrow, cavesm, cavelg, canopysm, canopylg
#   sprites/tray:    traysm, traymd, traylg
# Usage: python3 -I tools/pixelshelter.py [outdir] [sheet.png]   (default sprites; the optional sheet is a x8 view of every picture)
import sys, os, math
from PIL import Image

def mix(a, b, t): return tuple(round(x * (1 - t) + y * t) for x, y in zip(a, b))
def ramp(base): return {"hi": mix(base, (255, 255, 255), .26), "mid": base, "lo": mix(base, (0, 0, 0), .24), "deep": mix(base, (0, 0, 0), .46)}
WHITE = (255, 255, 255)
POST, ROOF, HAY, SOIL = ramp((92, 70, 48)), ramp((124, 94, 66)), ramp((206, 176, 90)), ramp((122, 92, 62))
DARK = (40, 32, 26)

class Cv:
    def __init__(s, w, h): s.w, s.h, s.px = w, h, {}
    def put(s, x, y, c):
        if 0 <= x < s.w and 0 <= y < s.h: s.px[(x, y)] = c
    def rect(s, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): s.put(x, y, c)
    def has(s, x, y): return (x, y) in s.px
    def inside(s, x, y, cx, cy, rx, ry): return ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1
    def img(s):
        im = Image.new("RGBA", (s.w, s.h), (0, 0, 0, 0))
        for (x, y), c in s.px.items(): im.putpixel((x, y), c + (255,))
        return im

def barn(W, H, wood, bays):
    # a gable shed seen from the front: shingled roof on top, then an OPEN front: posts and a header beam round a dark interior with a lit floor and a hay bale
    c = Cv(W, H)
    W_ = ramp(wood)
    rh = round(H * .46)
    for y in range(rh):
        hw = W / 2 * (.16 + .84 * y / (rh - 1))
        for x in range(W):
            d = abs(x + .5 - W / 2)
            if d <= hw:
                col = ROOF["hi"] if (x + .5 - W / 2) < -hw + 2.2 else ROOF["lo"] if (x + .5 - W / 2) > hw - 2.2 else ROOF["mid"]
                if col == ROOF["mid"] and y % 3 == 2 and (x + (y // 3) * 2) % 4 < 2: col = ROOF["lo"]    # shingle rows
                c.put(x, y, col)
    for x in range(W):
        if c.has(x, rh - 1): c.put(x, rh - 1, ROOF["deep"])      # eave shadow line
    for x in range(round(W / 2 - 1), round(W / 2 + 1)): c.put(x, 0, ROOF["hi"])   # ridge cap
    top = rh                                                         # header beam
    c.rect(1, top, W - 2, top + 1, W_["mid"]); c.rect(1, top, W - 2, top, W_["hi"]); c.rect(1, top + 1, W - 2, top + 1, W_["lo"])
    c.rect(1, top + 2, W - 2, top + 2, W_["deep"])
    inner0, inner1, floor = 3, W - 4, H - 3
    c.rect(inner0, top + 3, inner1, H - 2, DARK)                     # the dark interior
    c.rect(inner0, top + 3, inner1, top + 3, mix(DARK, (0, 0, 0), .35))   # shade under the beam
    for x in range(inner0, inner1 + 1):                              # a lit dirt floor
        c.put(x, floor, SOIL["mid"] if (x // 2) % 2 else SOIL["lo"]); c.put(x, floor + 1, SOIL["lo"])
    for x in range(inner0 + 1, inner1, 5): c.put(x, floor, SOIL["hi"])
    # a faint back-wall board line so the inside reads as a room
    for x in range(inner0, inner1 + 1):
        if x % 4 != 3: c.put(x, top + 6, mix(DARK, W_["lo"], .28))
    # posts: left edge, right edge and the bays between, each lit on the left and shaded on the right
    xs = [0] + [round((W - 3) * k / bays) for k in range(1, bays)] + [W - 3]
    for px in xs:
        for y in range(top, H):
            c.put(px, y, W_["hi"]); c.put(px + 1, y, W_["mid"]); c.put(px + 2, y, W_["lo"])
        c.put(px + 1, H - 1, W_["deep"]); c.put(px, H - 1, W_["lo"]); c.put(px + 2, H - 1, W_["deep"])
        for y in range(top + 4, H - 2, 4): c.put(px + 1, y, W_["lo"])    # grain dashes
    # braces under the beam
    for px in xs:
        for k in range(3):
            c.put(px + 3 + k, top + 3 + k, W_["mid"]) if px + 3 + k < W - 3 and not (px + 3 + k) in xs else None
    # a hay bale in the first bay
    bx0 = xs[1 if bays > 1 else 0] - 9 if bays > 1 else 4
    bx0 = max(inner0 + 1, min(bx0, inner1 - 8)); by1 = floor - 1
    c.rect(bx0, by1 - 4, bx0 + 7, by1, HAY["mid"]); c.rect(bx0, by1 - 4, bx0 + 7, by1 - 4, HAY["hi"]); c.rect(bx0 + 7, by1 - 4, bx0 + 7, by1, HAY["lo"]); c.rect(bx0, by1, bx0 + 7, by1, HAY["lo"])
    for x in (bx0 + 3,): c.rect(x, by1 - 3, x, by1 - 1, HAY["deep"])    # a binding strap
    for x in (bx0 + 1, bx0 + 5): c.put(x, by1 - 2, HAY["hi"])
    return c

def rockdome(W, H, stone, mouth_w, mouth_h, seed):
    c = Cv(W, H)
    S = ramp(stone)
    cx, cy, rx, ry = W / 2, H - 1.0, W / 2, H * 1.04
    for y in range(H):
        for x in range(W):
            if c.inside(x, y, cx, cy, rx, ry):
                u, v = (x + .5 - cx) / rx, (y + .5 - cy) / ry
                c.put(x, y, S["hi"] if u + v < -.62 else S["lo"] if (u > .55 or y >= H - 2 or u + v > .95) else S["mid"])
    for y in range(3, H - 3, 5):                                      # strata: rows of short dashes, shifted each row
        for x in range(2 + (y * seed) % 5, W - 2, 6):
            for k in range(3):
                if c.has(x + k, y) and c.px[(x + k, y)] != S["hi"]: c.put(x + k, y, S["lo"])
    # the mouth: a dark arch at the front with a lit left rim
    mx0, mx1 = round(W / 2 - mouth_w / 2), round(W / 2 + mouth_w / 2)
    for y in range(H - 1 - mouth_h, H - 1):
        for x in range(mx0, mx1):
            t = (y + .5 - (H - 1 - mouth_h)) / mouth_h
            ex = (x + .5 - W / 2) / (mouth_w / 2)
            if (ex * ex + (1 - min(1, t * 1.0)) ** 2 <= 1.0 if t < 1 else True) and abs(ex) <= 1: c.put(x, y, DARK)
    for y in range(H - 1 - mouth_h, H - 1):
        xs = [x for x in range(mx0, mx1) if c.px.get((x, y)) == DARK]
        if xs: c.put(min(xs) - 1, y, S["hi"]) if c.has(min(xs) - 1, y) else None; c.put(max(xs) + 1, y, S["deep"]) if c.has(max(xs) + 1, y) else None
    for x in range(mx0 + 1, mx1 - 1): c.put(x, H - 2, mix(DARK, S["mid"], .35))   # floor
    for x in range(mx0, mx1): c.put(x, H - 1, S["deep"])
    return c

def cave(W, H, stone, mw, mh, seed):
    c = rockdome(W, H, stone, mw, mh, seed)
    S = ramp(stone)
    for (x, y) in ((2, H - 2), (3, H - 2), (W - 4, H - 2), (W - 3, H - 3), (W - 3, H - 2), (round(W * .3), H - 1), (round(W * .72), H - 1)):   # rubble at the foot
        if 0 <= x < W: c.put(x, y, S["mid"] if x < W / 2 else S["lo"])
    return c

def burrow(W, H):
    c = Cv(W, H)
    D = ramp((138, 107, 71))
    cx, cy, rx, ry = W / 2, H - .5, W / 2, H * 1.05
    for y in range(H):
        for x in range(W):
            if c.inside(x, y, cx, cy, rx, ry):
                u, v = (x + .5 - cx) / rx, (y + .5 - cy) / ry
                c.put(x, y, D["hi"] if u + v < -.55 else D["lo"] if (u > .45 or y == H - 1) else D["mid"])
    for (x, y) in ((4, 3), (8, 2), (15, 3), (19, 5), (6, 6), (21, 7)):   # clods
        if c.has(x, y) and c.px[(x, y)] != D["hi"]: c.put(x, y, D["lo"]); c.put(x + 1, y, D["lo"]) if c.has(x + 1, y) else None
    hx0, hx1, hy0 = round(W * .32), round(W * .68), H - 7
    for y in range(hy0, H - 1):
        for x in range(hx0, hx1):
            if c.inside(x, y, W / 2, H - 1.5, (hx1 - hx0) / 2, (H - 1.5 - hy0)): c.put(x, y, DARK)
    return c

def canopy(W, H, cloth):
    c = Cv(W, H)
    C = ramp(cloth)
    ch = round(H * .62)
    pole = ramp((92, 76, 56))
    for fx in (.14, .42, .6, .86):                                    # poles under the hem
        x = round((W - 1) * fx)
        for y in range(ch + 1, H): c.put(x, y, pole["hi"] if fx < .5 else pole["lo"])
        c.put(x, H - 1, pole["deep"])
    n = 6
    for y in range(ch):
        hw = W / 2 * math.sqrt(max(0, 1 - ((ch - 1 - y + .5) / ch) ** 2)) if y < ch - 1 else W / 2
        hw = max(hw, .8)
        for x in range(W):
            if abs(x + .5 - W / 2) <= hw:
                k = min(n - 1, int((x + .5) / W * n)); u = (x + .5 - W / 2) / (W / 2)
                col = C["hi"] if u < -.55 else C["lo"] if u > .5 else C["mid"]
                if k % 2 == 1 and col == C["mid"]: col = mix(C["mid"], WHITE, .12)    # alternate panels
                c.put(x, y, col)
        # panel seams run from the peak to the hem
    for k in range(1, n):
        for y in range(1, ch):
            x = round(W / 2 + (k * W / n - W / 2) * (y / ch))
            if c.has(x, y): c.put(x, y, C["lo"])
    for x in range(W):                                                # a scalloped hem
        if c.has(x, ch - 1) or True:
            c.put(x, ch, C["mid"] if (x // 3) % 2 == 0 else C["lo"]); c.put(x, ch + 1, C["lo"] if (x // 3) % 2 == 0 else None) if (x // 3) % 2 == 0 else None
    for x in range(W):
        if (x, ch + 1) in c.px and c.px[(x, ch + 1)] is None: del c.px[(x, ch + 1)]
    c.px = {k: v for k, v in c.px.items() if v is not None}
    c.rect(round(W / 2) - 1, 0, round(W / 2), 1, pole["hi"]); c.put(round(W / 2) - 1, 0, pole["mid"])   # finial
    return c

STEEL = ramp((138, 143, 150))
WELL = (75, 79, 85)
def tray(W, H, well):
    c = Cv(W, H)
    for y in range(H):
        for x in range(W):
            if c.inside(x, y, W / 2, H / 2, W / 2, H / 2):
                c.put(x, y, STEEL["hi"] if (x + .5) / W + (y + .5) / H < .55 else STEEL["lo"] if (x + .5) / W + (y + .5) / H > 1.25 or y >= H - 1 else STEEL["mid"])
    cx, cy, rx, ry = well
    for y in range(H):
        for x in range(W):
            if c.inside(x, y, cx, cy, rx, ry): c.put(x, y, mix(WELL, (0, 0, 0), .25) if y < cy - ry * .3 else WELL)
    return c

SHELTERS = {
    "shelter": lambda: barn(48, 40, (154, 123, 85), 2),
    "barn": lambda: barn(84, 62, (126, 97, 66), 3),
    "burrow": lambda: burrow(26, 14),
    "cavesm": lambda: cave(62, 34, (111, 106, 98), 20, 20, 3),
    "cavelg": lambda: cave(92, 50, (91, 87, 80), 28, 30, 2),
    "canopysm": lambda: canopy(42, 34, (185, 167, 126)),
    "canopylg": lambda: canopy(70, 52, (168, 148, 106)),
}
TRAYS = {
    "traysm": ((18, 9), (9, 4.5, 6.5, 2.6)),
    "traymd": ((30, 14), (15, 7, 11.5, 4.6)),
    "traylg": ((46, 20), (23, 10, 18, 7.4)),
}

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "sprites"
    os.makedirs(os.path.join(out, "shelter"), exist_ok=True); os.makedirs(os.path.join(out, "tray"), exist_ok=True)
    ims = {}
    for k, fn in SHELTERS.items():
        ims[k] = fn().img(); ims[k].save(os.path.join(out, "shelter", k + ".png"))
    for k, (size, well) in TRAYS.items():
        ims[k] = tray(*size, well).img(); ims[k].save(os.path.join(out, "tray", k + ".png"))
    if len(sys.argv) > 2:
        Z, pad = 6, 3
        sheet = Image.new("RGBA", (sum(i.width for i in ims.values()) * Z + pad * Z * (len(ims) + 1), max(i.height for i in ims.values()) * Z + pad * Z * 2), (125, 160, 105, 255))
        x = pad * Z
        for im in ims.values():
            sheet.alpha_composite(im.resize((im.width * Z, im.height * Z), Image.NEAREST), (x, pad * Z)); x += (im.width + pad) * Z
        sheet.save(sys.argv[2])
