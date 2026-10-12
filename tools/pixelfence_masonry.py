# Draws the brick wall and the stone wall as three 3 m sections each in the Dimetrodon's flat style: pristine, degrading and broken, plus a keeper gate with swing frames.
# Pixels are 0.13 m (ROCK_MPP), so a 3 m section is 23 px wide. The brick wall is 2.2 m (17 px) with a stone coping, the stone wall 2.6 m (20 px) with flat capstones: both lower than the concrete wall (28 px), a pier on the left edge so sections tile end to end.
# Flat fills, no outline, light from the top left: each brick or stone has a lit top (and left) edge and a darker bottom (and right), mortar is a plain line between, texture is rhythm (courses, staggered joints), never scatter.
# Degrading: brick gets pale salt streaks under the joints, dark gaps in the mortar, a missing brick and moss at the foot; stone gets moss on the ledges and foot, lichen dashes, a loose stone and a stepped crack. Broken: a breach with toothed edges where the courses were knocked out and a heap of loose bricks or stones across the gap.
# The keeper gates (brick-gate.png, stone-gate.png) never wear: a capped pier at each end with a gold finial, and between them a planked green-black wooden double door with iron straps (brick) or a black iron-bar double gate (stone), both with a gold latch plate (the gate marker's #D8B04A). Frames -1, -2, -3 swing it open: each leaf shortens toward its hinge pier, and the latch goes.
# Usage: python3 -I tools/pixelfence_masonry.py [outdir] [sheet.png]   (default sprites/fence; the optional sheet is a x14 view of every picture, brick on the top two rows and stone under)
import sys, os
from PIL import Image

W = 23
def mix(a, b, t): return tuple(round(x * (1 - t) + y * t) for x, y in zip(a, b))
def ramp(base): return {"hi": mix(base, (255, 255, 255), .28), "mid": base, "lo": mix(base, (0, 0, 0), .26), "deep": mix(base, (0, 0, 0), .46)}
BRICK = ramp((172, 82, 52))       # fired clay, the Dimetrodon's rust family
BRICK2 = ramp((150, 70, 46))      # a darker batch, a few bricks in the wall
BRICK3 = ramp((190, 100, 62))     # a paler one
MORT = ramp((200, 188, 164))      # lime mortar
CAP = ramp((168, 160, 146))       # coping and footing stone
ST = [ramp((158, 152, 140)), ramp((140, 142, 136)), ramp((164, 152, 132))]   # the wall's stones: warm grey, cool grey, buff
STJ = mix(ST[0]["lo"], (30, 26, 20), .3)    # the dark joint between stones
MOSS = ramp((97, 111, 34))        # the Dimetrodon's olive
LICHEN = (172, 170, 92)
RUST = ramp((178, 78, 0))
WOOD = ramp((74, 62, 44))         # gate planks
IRON = ramp((52, 58, 64))
GOLD = ramp((216, 176, 74))       # the gate marker colour #D8B04A
SALT = mix(MORT["mid"], (255, 255, 255), .5)

class Sec:
    def __init__(s, h): s.px = {}; s.H = h
    def put(s, x, y, c):
        if 0 <= x < W and 0 <= y < s.H: s.px[(x, y)] = c
    def clear(s, x, y): s.px.pop((x, y), None)
    def get(s, x, y): return s.px.get((x, y))
    def img(s):
        im = Image.new("RGBA", (W, s.H), (0, 0, 0, 0))
        for (x, y), c in s.px.items(): im.putpixel((x, y), c + (255,))
        return im

def hsh(x, y): return (x * 7 + y * 13 + x * y * 3) % 5

# =========================================================== BRICK (23 x 17)
BH = 17
BRICK_TOP = 3                                  # rows 3.. are courses of three: brick, brick, mortar bed
def bcourse(c): return BRICK_TOP + 3 * c

def brick_wall(s, x0=3, x1=W):
    for c in range(4):
        y = bcourse(c)
        for x in range(x0, x1):
            j = (x + (3 if c % 2 else 0)) % 6
            if j == 5:                                           # a vertical joint
                s.put(x, y, MORT["mid"]); s.put(x, y + 1, MORT["lo"])
            else:
                b = (BRICK, BRICK2, BRICK3)[0 if hsh(x // 6, c) > 1 else 1 + hsh(x // 6, c) % 2]
                s.put(x, y, b["hi"] if j == 0 else b["mid"]); s.put(x, y + 1, b["lo"])
            s.put(x, y + 2, MORT["mid"])                         # the bed under the course
    for x in range(x0, x1): s.put(x, 2, CAP["lo"])               # shade under the coping

def brick_pier(s):
    for c in range(4):
        y = bcourse(c)
        for x, (t, b, m) in enumerate(((BRICK["hi"], BRICK["mid"], MORT["hi"]), (BRICK["mid"], BRICK["lo"], MORT["mid"]), (BRICK["lo"], BRICK["deep"], MORT["lo"]))):
            s.put(x, y, t); s.put(x, y + 1, b); s.put(x, y + 2, m)
    for x in range(3): s.put(x, 2, CAP["lo"])

def brick_foot(s):
    for x in range(W): s.put(x, 15, CAP["mid"]); s.put(x, 16, CAP["deep"])
    for x in range(0, W, 5): s.put(x, 15, CAP["hi"])             # a lit edge on the footing stones

def brick_coping(s, x0=0, x1=W):
    for x in range(x0, x1): s.put(x, 0, CAP["hi"]); s.put(x, 1, CAP["mid"])
    for x in range(x0, x1):
        if x % 6 == 2: s.put(x, 0, CAP["mid"]); s.put(x, 1, CAP["lo"])      # joints between the coping stones

def brick_pristine():
    s = Sec(BH); brick_wall(s); brick_pier(s); brick_foot(s); brick_coping(s)
    return s

def brick_degrading():
    s = brick_pristine()
    # pale salt streaks creeping down from the mortar beds
    for x, y, n in ((6, 5, 3), (13, 8, 4), (19, 5, 5), (9, 11, 3), (16, 11, 2)):
        for k in range(n): s.put(x, y + k, SALT) if (x + k) % 4 != 3 else None
    # dark gaps where the mortar has washed out
    for x, y in ((8, 8), (9, 8), (10, 8), (14, 5), (15, 5), (18, 11), (19, 11), (5, 11), (6, 11), (20, 8)): s.put(x, y, BRICK["deep"])
    # a brick gone from the third course: a dark socket
    for x in range(10, 14):
        for y in (9, 10): s.put(x, y, BRICK["deep"])
    for x in range(10, 14): s.put(x, 9, BRICK2["deep"]) ; s.put(x, 11, MORT["lo"])
    # chipped bricks: a corner knocked off
    for x, y in ((4, 6), (15, 6), (21, 9), (7, 12)): s.put(x, y, BRICK["deep"]); s.put(x + 1, y, BRICK["lo"])
    # a stepped crack along the joints
    for x, y in ((17, 3), (17, 4), (18, 5), (18, 6), (19, 6)): s.put(x, y, BRICK["deep"])
    # moss along the foot
    for x in range(3, W):
        if x % 5 in (0, 1, 2): s.put(x, 14, MOSS["lo"]); s.put(x, 13, MOSS["mid"]) if x % 5 == 1 else None
        if x % 5 == 1: s.put(x, 12, MOSS["hi"])
        if x % 3 == 0: s.put(x, 15, MOSS["mid"])
    s.put(1, 14, MOSS["lo"]); s.put(2, 13, MOSS["mid"]); s.put(1, 12, MOSS["lo"])
    # a chip off the coping
    s.clear(11, 0); s.clear(12, 0); s.put(11, 1, CAP["lo"]); s.put(12, 1, CAP["deep"])
    return s

def brick_broken():
    s = brick_pristine()
    # the breach: courses knocked out between two ragged ends (each course stops at a different column, like missing bricks)
    limL = [8, 6, 9, 7]; limR = [15, 17, 14, 16]
    for y in range(0, 15):
        c = min(3, max(0, (y - BRICK_TOP) // 3))
        for x in range(limL[c], limR[c]): s.clear(x, y)
    for x in range(8, 15): s.clear(x, 15)
    for x in range(8, 15): s.put(x, 16, CAP["deep"])
    # a lit edge on the broken courses
    for c, lim in enumerate(limL): s.put(lim - 1, bcourse(c), BRICK["hi"])
    for c, lim in enumerate(limR): s.put(lim, bcourse(c) + 1, BRICK["deep"])
    # the heap: loose bricks, lit top, dark bottom
    heap = ((8, 12, 3, 2), (11, 11, 3, 2), (6, 14, 3, 2), (9, 14, 3, 2), (12, 13, 3, 2), (14, 14, 3, 2), (10, 9, 3, 2), (13, 10, 2, 2), (7, 12, 2, 2))
    for i, (x0, y0, w, h) in enumerate(heap):
        b = (BRICK, BRICK2, BRICK3)[i % 3]
        for x in range(x0, x0 + w):
            s.put(x, y0, b["hi"] if x == x0 else b["mid"]); s.put(x, y0 + 1, b["lo"])
    for x, y in ((9, 13), (13, 12), (11, 15)): s.put(x, y, MORT["mid"])   # mortar crumbs
    return s

# =========================================================== STONE (23 x 20)
SH = 20
STONE_TOP = 4
COURSES = [(4, [7, 6, 7]), (4, [5, 8, 4, 3]), (5, [6, 7, 7])]     # (height, stone widths over the 20 px between the piers)
def stone_one(s, x, y, w, h, t):
    # one stone: lit top and left edges, dark bottom and right, the last row and column are the dark joint
    st = ST[t % 3]
    for xx in range(x, x + w):
        for yy in range(y, y + h): s.put(xx, yy, st["mid"])
    for xx in range(x, x + w - 1): s.put(xx, y, st["hi"])
    for yy in range(y, y + h - 1): s.put(x, yy, st["hi"])
    for xx in range(x + 1, x + w - 1): s.put(xx, y + h - 2, st["lo"])
    for yy in range(y + 1, y + h - 1): s.put(x + w - 2, yy, st["lo"])
    for xx in range(x, x + w): s.put(xx, y + h - 1, STJ)
    for yy in range(y, y + h): s.put(x + w - 1, yy, STJ)

def stone_wall(s):
    y = STONE_TOP
    for ci, (h, ws) in enumerate(COURSES):
        x = 3
        for k, w in enumerate(ws):
            stone_one(s, x, y, w, h, ci + k); x += w
        y += h
    for x in range(3, W): s.put(x, 3, CAP["lo"])                 # shade under the capstones
    # grain: a dash of short darker strokes, one a stone
    for x, yy in ((5, 5), (11, 5), (17, 6), (6, 9), (12, 10), (16, 9), (8, 14), (14, 14), (20, 13)): s.put(x, yy, ST[0]["lo"]); s.put(x + 1, yy, ST[0]["lo"])

def stone_pier(s):
    y = STONE_TOP
    for ci, (h, ws) in enumerate(COURSES):
        for x, key in enumerate(("hi", "mid", "lo")):
            for yy in range(y, y + h - 1): s.put(x, yy, ST[(ci + 1) % 3][key])
            s.put(x, y + h - 1, STJ)
        y += h
    for x in range(3): s.put(x, 3, CAP["lo"])

def stone_foot(s):
    for x in range(W): s.put(x, 17, CAP["mid"]); s.put(x, 18, CAP["lo"]); s.put(x, 19, CAP["deep"])
    for x in range(0, W, 6): s.put(x, 17, CAP["hi"])

def stone_caps(s):
    # flat capstones in three lengths, a lit top and a dark underside
    x = 0
    for w in (8, 7, 8):
        for xx in range(x, x + w - 1): s.put(xx, 0, CAP["hi"]); s.put(xx, 1, CAP["mid"]); s.put(xx, 2, CAP["lo"])
        s.put(x + w - 1, 0, CAP["lo"]); s.put(x + w - 1, 1, CAP["lo"]); s.put(x + w - 1, 2, CAP["deep"])
        x += w

def stone_pristine():
    s = Sec(SH); stone_wall(s); stone_pier(s); stone_foot(s); stone_caps(s)
    return s

def stone_degrading():
    s = stone_pristine()
    # moss on the ledges: along the tops of stones, thinning as it goes
    for x, y, n in ((5, 8, 4), (13, 8, 3), (9, 12, 5), (17, 12, 4), (4, 4, 3), (14, 4, 3)):
        for k in range(n): s.put(x + k, y, MOSS["mid"] if k % 2 == 0 else MOSS["lo"])
        s.put(x + 1, y - 1, MOSS["hi"]) if y > 4 else None
    # moss along the foot, patches that thin as they go up
    for x in range(3, W):
        if x % 5 in (0, 1, 2): s.put(x, 16, MOSS["lo"]); s.put(x, 17, MOSS["mid"])
        if x % 5 == 1: s.put(x, 15, MOSS["hi"]); s.put(x, 14, MOSS["mid"]) if x % 10 == 1 else None
    for y in (14, 15, 16, 17): s.put(2, y, MOSS["lo"]) if y % 2 else s.put(1, y, MOSS["mid"])
    # lichen dashes in rows on the pale stones
    for x, y in ((8, 6), (9, 6), (19, 6), (20, 6), (6, 10), (7, 10), (15, 10), (16, 10), (11, 15), (12, 15)): s.put(x, y, LICHEN)
    # a stepped crack
    for x, y in ((12, 8), (12, 9), (13, 10), (13, 11), (14, 12), (14, 13), (15, 14)): s.put(x, y, STJ)
    # a stone slipped out of the middle course: a dark socket, its neighbours' edges chipped
    for x in range(4, 8):
        for y in (9, 10): s.put(x, y, STJ)
    s.put(8, 9, ST[1]["lo"]); s.put(3, 10, ST[0]["lo"])
    # a chip out of a capstone and its end dark
    s.clear(10, 0); s.clear(11, 0); s.put(10, 1, CAP["lo"]); s.put(11, 1, CAP["deep"])
    return s

def stone_broken():
    s = stone_pristine()
    # the breach: courses knocked out down to the footing, ragged where whole stones came away
    limL = [8, 6, 9, 7]; limR = [15, 17, 14, 16]
    lim = lambda y: 0 if y < 4 else 1 if y < 8 else 2 if y < 12 else 3
    for y in range(0, 17):
        c = lim(y)
        for x in range(limL[c], limR[c]): s.clear(x, y)
    for x in range(8, 15):
        for y in (17, 18): s.clear(x, y)
    # lit edges of the broken courses
    for y, x in ((4, 7), (8, 5), (12, 8), (15, 6)): s.put(x, y, ST[0]["hi"])
    for y, x in ((5, 15), (9, 17), (13, 14)): s.put(x, y, STJ)
    # the heap: stones of every size, lit top-left, dark right and bottom
    heap = ((6, 14, 4, 3), (10, 13, 4, 4), (14, 14, 3, 3), (8, 11, 3, 3), (12, 10, 3, 3), (7, 16, 3, 2), (11, 16, 4, 2), (15, 16, 3, 2), (10, 8, 2, 2), (13, 8, 2, 2))
    for i, (x0, y0, w, h) in enumerate(heap): stone_one(s, x0, y0, w, h, i) if w * h > 4 else None
    for i, (x0, y0, w, h) in enumerate(heap):
        if w * h <= 4:
            st = ST[i % 3]
            for x in range(x0, x0 + w):
                s.put(x, y0, st["hi"] if x == x0 else st["mid"]); s.put(x, y0 + 1, st["lo"])
    return s

# =========================================================== GATES
def gpier(s, x0, brick):
    # a pier with a gold-capped top the full height of the gate
    H = s.H
    for y in range(0, H - 3):
        for x, key in enumerate(("hi", "mid", "lo")): s.put(x0 + x, y, (BRICK if brick else ST[1])[key])
    for x in range(3): s.put(x0 + x, 0, GOLD["hi"] if x == 1 else CAP["hi"]); s.put(x0 + x, 1, GOLD["mid"] if x == 1 else CAP["mid"]); s.put(x0 + x, 2, CAP["lo"])
    # courses on the pier
    step = 3 if brick else 4
    for y in range(3 + step - 1, H - 3, step):
        for x in range(3): s.put(x0 + x, y, (MORT if brick else {"hi": STJ, "mid": STJ, "lo": STJ})["mid" if brick else "mid"])
    for x in range(3): s.put(x0 + x, H - 3, CAP["mid"]); s.put(x0 + x, H - 2, CAP["lo"]); s.put(x0 + x, H - 1, CAP["deep"])

def gate_brick(sc=1.0):
    s = Sec(BH); gpier(s, 0, True); gpier(s, 20, True)
    fl = lambda x: 3 + round((x - 3) * sc); fr = lambda x: 19 - round((19 - x) * sc)
    for xa, xb in ((3, fl(10)), (fr(11), 19)):
        for y in range(4, 14):
            for x in range(xa, xb + 1): s.put(x, y, WOOD["mid"] if (x - xa) % 3 else WOOD["lo"])      # planks
        for x in range(xa, xb + 1): s.put(x, 4, WOOD["hi"]); s.put(x, 13, WOOD["deep"])
        for y in (6, 11):                                                                           # iron straps
            for x in range(xa, xb + 1): s.put(x, y, IRON["mid"]); s.put(x, y + 1, IRON["lo"]) if x % 2 else None
    for y in range(4, 14): s.put(3, y, WOOD["hi"]); s.put(fl(10), y, WOOD["deep"]); s.put(fr(11), y, WOOD["lo"]); s.put(19, y, WOOD["deep"])
    for x, y in ((3, 6), (3, 11), (19, 6), (19, 11)): s.put(x, y, IRON["deep"])                     # hinge pins
    if sc == 1.0:
        for x in (10, 11): s.put(x, 8, GOLD["hi"]); s.put(x, 9, GOLD["mid"]); s.put(x, 10, GOLD["lo"])
    return s

def gate_stone(sc=1.0):
    s = Sec(SH); gpier(s, 0, False); gpier(s, 20, False)
    fl = lambda x: 3 + round((x - 3) * sc); fr = lambda x: 19 - round((19 - x) * sc)
    for xa, xb in ((3, fl(10)), (fr(11), 19)):
        for x in range(xa, xb + 1): s.put(x, 5, IRON["hi"]); s.put(x, 6, IRON["mid"]); s.put(x, 15, IRON["lo"]); s.put(x, 16, IRON["deep"])   # top and bottom rails
        for x in range(xa, xb + 1, 2):                                                                                                            # bars, a lit one and a shaded one
            for y in range(7, 15): s.put(x, y, IRON["mid"] if (x - xa) % 4 == 0 else IRON["lo"])
            s.put(x, 4, IRON["hi"])                                                                                                               # spear tips
    for y in range(5, 17): s.put(3, y, IRON["hi"]); s.put(fl(10), y, IRON["deep"]); s.put(fr(11), y, IRON["lo"]); s.put(19, y, IRON["deep"])
    if sc == 1.0:
        for x in (10, 11): s.put(x, 9, GOLD["hi"]); s.put(x, 10, GOLD["mid"]); s.put(x, 11, GOLD["lo"])
    return s

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "sprites/fence"
    sheet_path = sys.argv[2] if len(sys.argv) > 2 else None
    os.makedirs(out, exist_ok=True)
    kinds = {
        "brick": ({"pristine": brick_pristine(), "degrading": brick_degrading(), "broken": brick_broken()}, {"": gate_brick(1.0), "-1": gate_brick(.66), "-2": gate_brick(.33), "-3": gate_brick(.1)}),
        "stone": ({"pristine": stone_pristine(), "degrading": stone_degrading(), "broken": stone_broken()}, {"": gate_stone(1.0), "-1": gate_stone(.66), "-2": gate_stone(.33), "-3": gate_stone(.1)}),
    }
    z, gap = 14, 4
    rows = [(k + pre, grp) for k, (states, gates) in kinds.items() for pre, grp in (("-", states), ("-gate", gates))]
    sheet = Image.new("RGBA", ((4 * (W + gap) + gap) * z, (len(rows) * (SH + gap) + gap // 2) * z), (176, 190, 150, 255))   # on a park-green ground
    for row, (pre, group) in enumerate(rows):
        for i, (name, sec) in enumerate(group.items()):
            im = sec.img(); im.save(f"{out}/{pre}{name}.png")
            sheet.alpha_composite(im.resize((W * z, sec.H * z), Image.NEAREST), ((gap + i * (W + gap)) * z, (gap // 2 + row * (SH + gap)) * z))
            print(pre + name, im.size)
    if sheet_path: sheet.save(sheet_path)
