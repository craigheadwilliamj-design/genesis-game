# Draws the concrete wall as three 3 m sections in the Dimetrodon's flat style: pristine (precast panels under a coping, with form-tie holes), degrading (rain stains, moss at the foot, cracks, a spalled patch showing rusty rebar) and broken (a breach smashed through: bent rebar and a rubble heap).
# Pixels are 0.13 m (ROCK_MPP), so a 3 m section is 23 px wide and the 3.6 m wall (FENCE34.concrete.h) is 28 px tall, side-on, a pilaster on the left edge so sections tile end to end.
# Flat fills, no outline, light from the top left: a lit pilaster edge and coping top, shadow under the coping and on the pilaster's right, formwork seams as plain lines, a steady grid of tie holes, and a few short dashes of grain.
# The keeper gate (concrete-gate.png, same size) never wears or breaks: a capped concrete pillar at each end and a dark steel double door between with ribs, hinge pins and a gold latch plate (the gate marker's #D8B04A). Frames -1, -2, -3 swing it open for a keeper going through: each leaf shortens toward its hinge pillar, and the latch goes.
# Usage: python3 -I tools/pixelfence_concrete.py [outdir] [sheet.png]   (default sprites/fence; the optional sheet is a x14 view of every picture, wall on the top row and gate under it)
import sys, os
from PIL import Image

W, H = 23, 28
def mix(a, b, t): return tuple(round(x * (1 - t) + y * t) for x, y in zip(a, b))
def ramp(base): return {"hi": mix(base, (255, 255, 255), .28), "mid": base, "lo": mix(base, (0, 0, 0), .26), "deep": mix(base, (0, 0, 0), .46)}
CON = ramp((184, 177, 162))     # FENCE34.concrete colour #B8B1A2
RUST = ramp((178, 78, 0))       # rebar
MOSS = ramp((97, 111, 34))      # the Dimetrodon's olive
STEEL = ramp((74, 84, 94))      # the gate's door
GOLD = ramp((216, 176, 74))     # the gate marker colour #D8B04A
C, R, M, T, G = CON, RUST, MOSS, STEEL, GOLD
GRAIN = mix(C["mid"], C["lo"], .45)   # a dash of grain, a step darker than the face
STAIN = mix(C["mid"], (70, 60, 40), .35)

class Sec:
    def __init__(s): s.px = {}
    def put(s, x, y, c):
        if 0 <= x < W and 0 <= y < H: s.put_(x, y, c)
    def put_(s, x, y, c): s.px[(x, y)] = c
    def clear(s, x, y): s.px.pop((x, y), None)
    def img(s):
        im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        for (x, y), c in s.px.items(): im.putpixel((x, y), c + (255,))
        return im

def coping(s, x0=0, x1=W):
    # a projecting cap: lit top, body, a dark underside that throws shade onto the wall
    for x in range(x0, x1): s.put(x, 0, C["hi"]); s.put(x, 1, C["mid"]); s.put(x, 2, C["lo"])

def wall(s, x0=3, x1=W):
    for y in range(3, H - 1):
        for x in range(x0, x1): s.put(x, y, C["mid"])
    for x in range(x0, x1): s.put(x, 3, C["lo"])                      # shade under the coping
    for y in (11, 19):
        for x in range(x0, x1): s.put(x, y, C["lo"]); s.put(x, y + 1, C["hi"])   # formwork seams: a shaded line, then a lit one under it
    for x in (8, 16):                                                  # form-tie holes in a grid, lit on the lower right
        for y in (7, 15, 23): s.put(x, y, C["deep"]); s.put(x + 1, y + 1, C["hi"])
    for x, y in ((5, 5), (6, 5), (12, 9), (13, 9), (19, 6), (20, 6), (5, 14), (6, 14), (11, 17), (12, 17), (19, 14), (20, 14), (13, 22), (14, 22), (20, 21), (21, 21)): s.put(x, y, GRAIN)   # grain dashes
    for x in range(x0, x1): s.put(x, 24, C["hi"]); s.put(x, 25, C["lo"]); s.put(x, 26, C["lo"])   # the plinth
    for x in range(x0, x1): s.put(x, H - 1, C["deep"])

def pilaster(s):
    for y in range(3, H): s.put(0, y, C["hi"]); s.put(1, y, C["mid"]); s.put(2, y, C["lo"])
    for x in (0, 1, 2): s.put(x, H - 1, C["deep"])
    for y in (11, 19): s.put(0, y, C["lo"]); s.put(1, y, C["lo"])
    s.put(1, 7, C["deep"]); s.put(1, 15, C["deep"]); s.put(1, 23, C["deep"])

def pristine():
    s = Sec(); wall(s); pilaster(s); coping(s)
    return s

def degrading():
    s = Sec(); wall(s); pilaster(s); coping(s)
    # rain stains run down from the coping in streaks of different lengths
    for x, n in ((6, 9), (7, 5), (12, 11), (13, 6), (18, 8), (21, 12)):
        for y in range(4, 4 + n):
            if (x * 3 + y) % 7 != 0: s.put(x, y, STAIN)
    # moss along the plinth, in patches that thin as they go up
    for x in range(3, W):
        if x % 5 in (0, 1, 2): s.put(x, 25, M["mid"]); s.put(x, 24, M["lo"]) if x % 5 == 1 else None
        if x % 5 == 1: s.put(x, 23, M["hi"])
        if x % 3 == 0: s.put(x, 26, M["lo"])
    for y in (22, 23, 24, 25, 26): s.put(2, y, M["lo"]) if y % 2 else s.put(1, y, M["mid"])
    # a crack from a tie hole, stepping down and across
    for x, y in ((9, 8), (9, 9), (10, 10), (10, 11), (11, 12), (11, 13), (12, 14), (12, 15), (13, 16)): s.put(x, y, C["deep"])
    s.put(10, 9, C["lo"]); s.put(11, 11, C["lo"])
    # a spalled patch: the face has broken away and the rebar behind it is rusting
    for x in range(16, 21):
        for y in range(13, 17): s.put(x, y, C["deep"] if (x + y) % 3 else C["lo"])
    for x in range(16, 21): s.put(x, 15, R["mid"] if x % 2 else R["lo"])
    s.put(15, 14, C["lo"]); s.put(21, 15, C["lo"]); s.put(17, 16, R["hi"]); s.put(19, 13, R["lo"])
    for y in (17, 18): s.put(18, y, R["lo"])   # rust bleeding down below it
    # a chip out of the coping, and the pilaster foot stained
    for x in (10, 11): s.clear(x, 0)
    s.put(10, 1, C["lo"]); s.put(11, 1, C["deep"]); s.put(12, 0, C["mid"])
    for y in range(18, 24): s.put(1, y, STAIN)
    return s

def broken():
    # a breach: the panel is smashed out between two remnants of the wall, rebar bent and sticking out, rubble in a heap
    s = Sec(); pilaster(s)
    for y in range(3, 20): 
        for x in range(3, 5 + (y > 8) + (y > 13) * 2 - (y < 6)): s.put(x, y, C["mid"])   # the left remnant, ragged on its right
    for x in range(3, 8): s.put(x, 24, C["hi"]); s.put(x, 25, C["lo"]); s.put(x, 26, C["lo"]); s.put(x, H - 1, C["deep"])
    for x in range(3, 6): s.put(x, 3, C["lo"])
    for x in range(0, 6): s.put(x, 0, C["hi"]); s.put(x, 1, C["mid"]); s.put(x, 2, C["lo"])
    for y in range(14, 24): s.put(5, y, C["mid"]); s.put(6, y, C["mid"]) if y > 17 else None
    for y in range(3, H - 1):                                                  # the right remnant
        for x in range(19 + (y < 10) - (y > 15), W): s.put(x, y, C["mid"])
    for x in range(18, W): s.put(x, 24, C["hi"]); s.put(x, 25, C["lo"]); s.put(x, 26, C["lo"]); s.put(x, H - 1, C["deep"])
    for x in range(19, W): s.put(x, 0, C["hi"]); s.put(x, 1, C["mid"]); s.put(x, 2, C["lo"])
    for x in range(19, W): s.put(x, 3, C["lo"])
    # jagged lit edges where the concrete snapped
    for x, y in ((5, 9), (6, 14), (7, 19), (4, 5), (20, 9), (19, 14), (18, 19), (19, 5)): s.put(x, y, C["hi"])
    for x, y in ((5, 11), (7, 17), (19, 12), (18, 17)): s.put(x, y, C["deep"])
    # rebar: bent bars out of both remnants, rust-brown, with a lit top
    for x, y in ((7, 8), (8, 8), (9, 9), (10, 10), (11, 11), (7, 13), (8, 14), (9, 15), (10, 17)): s.put(x, y, R["mid"] if (x + y) % 2 else R["lo"])
    for x, y in ((17, 6), (16, 6), (15, 7), (14, 9), (13, 11), (17, 12), (16, 13), (15, 15)): s.put(x, y, R["mid"] if (x + y) % 2 else R["lo"])
    s.put(7, 7, R["hi"]); s.put(17, 5, R["hi"]); s.put(11, 10, R["hi"])
    # the rubble: blocks of every size, lit on the top left, dark on the lower right, heaped across the gap
    for x in range(6, 19): s.put(x, H - 1, C["deep"])
    heap = ((7, 22, 3, 3), (10, 21, 4, 4), (14, 22, 3, 3), (12, 19, 3, 3), (9, 24, 3, 2), (16, 24, 2, 2), (13, 24, 3, 2), (11, 25, 2, 2), (15, 20, 2, 2), (8, 20, 2, 2))
    for x0, y0, w, h in heap:
        for x in range(x0, x0 + w):
            for y in range(y0, y0 + h):
                if y < H - 1: s.put(x, y, C["hi"] if (x == x0 or y == y0) else C["lo"] if (x == x0 + w - 1 or y == y0 + h - 1) else C["mid"])
    s.put(12, 22, R["mid"]); s.put(9, 23, R["lo"]); s.put(15, 25, R["mid"]); s.put(17, 23, GRAIN)
    return s

# ---- the keeper gate: concrete pillars at x 0..2 and 20..22, a dark steel double door between with a split at x 10/11
def gpost(s, x0):
    for y in range(0, H - 1): s.put(x0, y, C["hi"]); s.put(x0 + 1, y, C["mid"]); s.put(x0 + 2, y, C["lo"])
    for x in range(3): s.put(x0 + x, 0, G["hi"] if x == 1 else C["hi"]); s.put(x0 + x, 1, G["mid"] if x == 1 else C["mid"])   # a gold-capped top
    for x in range(3): s.put(x0 + x, 2, C["lo"]); s.put(x0 + x, H - 1, C["deep"])
    for y in (11, 19): s.put(x0, y, C["lo"]); s.put(x0 + 1, y, C["lo"])

def gate(sc=1.0):
    # sc is how far across the leaves still reach: 1 is shut, less is swung open (a leaf turning away from us shortens toward its hinge pillar)
    s = Sec(); gpost(s, 0); gpost(s, 20)
    fl = lambda x: 3 + round((x - 3) * sc)      # left leaf, hinged at x 3
    fr = lambda x: 19 - round((19 - x) * sc)    # right leaf, hinged at x 19
    for xa, xb in ((3, fl(10)), (fr(11), 19)):
        for y in range(4, 26):
            for x in range(xa, xb + 1): s.put(x, y, T["mid"])
        for x in range(xa, xb + 1): s.put(x, 4, T["hi"]); s.put(x, 25, T["deep"])
        for y in (9, 14, 19):                                          # horizontal ribs: a lit line, a shaded line
            for x in range(xa + 1, xb): s.put(x, y, T["lo"]); s.put(x, y + 1, T["hi"]) if x % 2 else None
    for y in range(4, 26):
        s.put(3, y, T["hi"]); s.put(fl(10), y, T["deep"]); s.put(fr(11), y, T["lo"]); s.put(19, y, T["deep"])
    for x, y in ((3, 7), (3, 22), (19, 7), (19, 22)): s.put(x, y, C["deep"])   # hinge pins
    if sc == 1.0:
        for x in (10, 11): s.put(x, 13, G["hi"]); s.put(x, 14, G["mid"]); s.put(x, 15, G["lo"])
        s.put(11, 14, G["deep"])
    return s

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "sprites/fence"
    sheet_path = sys.argv[2] if len(sys.argv) > 2 else None
    os.makedirs(out, exist_ok=True)
    states = {"pristine": pristine(), "degrading": degrading(), "broken": broken()}
    gates = {"": gate(1.0), "-1": gate(.66), "-2": gate(.33), "-3": gate(.1)}
    z, gap = 14, 4
    sheet = Image.new("RGBA", ((max(len(states), len(gates)) * (W + gap) + gap) * z, (2 * (H + gap) + gap // 2) * z), (176, 190, 150, 255))   # on a park-green ground
    for row, (pre, group) in enumerate((("concrete-", states), ("concrete-gate", gates))):
        for i, (name, sec) in enumerate(group.items()):
            im = sec.img(); im.save(f"{out}/{pre}{name}.png")
            sheet.alpha_composite(im.resize((W * z, H * z), Image.NEAREST), ((gap + i * (W + gap)) * z, (gap // 2 + row * (H + gap)) * z))
            print(pre + name, im.size)
    if sheet_path: sheet.save(sheet_path)
