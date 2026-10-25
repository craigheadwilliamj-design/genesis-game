# Draws the lagoon wall (BARRIERS.lagoon, the only fence that holds sea water) as three 3 m sections in the Dimetrodon's flat style: a pale seawall parapet under a rounded coping,
# a band of teal tiles along its top and a steel guard rail standing on it; degrading (green algae up from the foot, rust run down from the rail, tiles gone, a sagging rail) and broken
# (a breach smashed through the parapet, the rail snapped and hanging, a rubble heap).
# Pixels are 0.13 m (ROCK_MPP), so a 3 m section is 23 px wide and the 2.3 m wall (FENCE34.lagoon.h) is 18 px tall, side-on, a pilaster and stanchion on the left edge so sections tile end to end.
# Flat fills, no outline, light from the top left: a lit coping top and pilaster edge, shade under the coping, tiles in a steady rhythm of grout lines, panel seams as plain lines.
# The keeper catwalk (lagoon-gate.png and -s -e -w, FENCE_SPRITES.lagoon gateW/gateH/gateDeep): a 5 m x 5 m teal deck over the water on stilts, a rail on its water sides, gold capped corner posts and a ladder down the OUTSIDE of the wall, never swinging.
# The picture is chosen by which way the exhibit lies from the wall: gate (the exhibit behind it, ladder in front), -s (the exhibit in front, ladder behind), -e and -w (wall seen end on, 41 px wide with the ladder beside the deck).
# Usage: python3 -I tools/pixelfence_lagoon.py [outdir] [sheet.png]   (default sprites/fence; the optional sheet is a x14 view of every picture, wall on the top row and gate under it)
import sys, os
from PIL import Image

W, H = 23, 18
def mix(a, b, t): return tuple(round(x * (1 - t) + y * t) for x, y in zip(a, b))
def ramp(base): return {"hi": mix(base, (255, 255, 255), .28), "mid": base, "lo": mix(base, (0, 0, 0), .26), "deep": mix(base, (0, 0, 0), .46)}
C = ramp((214, 208, 192))       # the parapet's pale render, FENCE34.lagoon colour #D6D0C0
T = ramp((58, 146, 160))        # the teal tiles and the gate doors
S = ramp((150, 160, 168))       # the guard rail's steel
R = ramp((178, 78, 0))          # rust
A = ramp((88, 124, 66))         # algae
G = ramp((216, 176, 74))        # the gate marker colour #D8B04A
GROUT = mix(C["mid"], C["lo"], .5)
TOP = 5                         # the coping's top row: the rail stands on the five rows above it

class Sec:
    def __init__(s, w=W, h=H): s.px = {}; s.w = w; s.h = h
    def put(s, x, y, c):
        if 0 <= x < s.w and 0 <= y < s.h: s.px[(x, y)] = c
    def clear(s, x, y): s.px.pop((x, y), None)
    def img(s):
        im = Image.new("RGBA", (s.w, s.h), (0, 0, 0, 0))
        for (x, y), c in s.px.items(): im.putpixel((x, y), c + (255,))
        return im

def rail(s, x0=0, x1=W, sag=None):
    # a top rail and a mid rail on stanchions every 1.5 m (11 to 12 px), see-through between; sag drops part of the top rail a pixel
    for x in range(x0, x1):
        d = 1 if sag and sag[0] <= x < sag[1] else 0
        s.put(x, 0 + d, S["hi"]); s.put(x, 1 + d, S["lo"])
        s.put(x, 3, S["mid"])
    for x in (0, 11):
        if x0 <= x < x1:
            for y in range(0, TOP): s.put(x, y, S["hi"]); s.put(x + 1, y, S["lo"])

def parapet(s, x0=0, x1=W):
    for x in range(x0, x1): s.put(x, TOP, C["hi"]); s.put(x, TOP + 1, C["mid"]); s.put(x, TOP + 2, C["lo"])   # the rounded coping: lit top, body, shaded underside
    for x in range(x0, x1):                                                                               # two rows of tiles under it, grout every 3 px, offset by a row
        for k, y in enumerate((TOP + 3, TOP + 4)):
            s.put(x, y, GROUT if (x + k * 2) % 3 == 0 else T["hi"] if k == 0 else T["mid"])
    for y in range(TOP + 5, H - 2):
        for x in range(x0, x1): s.put(x, y, C["mid"])
    for x in range(x0, x1): s.put(x, TOP + 5, C["lo"])                                                    # a shadow line under the tiles
    for y in range(TOP + 6, H - 2):                                                                       # a panel seam halfway along
        if x0 <= 12 < x1: s.put(12, y, C["lo"]); s.put(13, y, C["hi"]) if y % 2 else None
    for x, y in ((6, 13), (7, 13), (17, 12), (18, 12), (9, 15), (19, 15)): s.put(x, y, GROUT)               # a few dashes of grain
    for x in range(x0, x1): s.put(x, H - 2, C["lo"]); s.put(x, H - 1, C["deep"])                          # the footing

def pilaster(s):
    for y in range(TOP, H): s.put(0, y, C["hi"]); s.put(1, y, C["mid"]); s.put(2, y, C["lo"])
    for x in (0, 1, 2): s.put(x, TOP, C["hi"]); s.put(x, H - 1, C["deep"])
    s.put(1, TOP + 3, T["mid"]); s.put(1, TOP + 4, T["lo"])

def pristine():
    s = Sec(); parapet(s); pilaster(s); rail(s)
    return s

def degrading():
    s = Sec(); parapet(s); pilaster(s); rail(s, sag=(13, 20))
    for x in range(0, W):                                                                                 # algae climbing from the foot in fronds
        h = (2, 3, 1, 4, 2, 1, 3)[x % 7]
        for y in range(H - 2 - h, H - 1): s.put(x, y, A["mid"] if y > H - 2 - h else A["hi"])
        s.put(x, H - 1, A["deep"])
    for x, n in ((5, 4), (14, 6), (20, 3)):                                                               # rust run down from the rail's feet
        for y in range(TOP + 1, TOP + 1 + n): s.put(x, y, R["lo"] if y % 3 else R["mid"])
    for x in (0, 11): s.put(x, 2, R["mid"]); s.put(x + 1, 3, R["lo"])
    for x in (7, 8, 16): s.put(x, TOP + 3, C["deep"]); s.put(x, TOP + 4, C["lo"])                         # fallen tiles
    for x in (9, 10): s.clear(x, TOP); s.put(x, TOP + 1, C["lo"])                                         # a chip out of the coping
    return s

def broken():
    s = Sec(); pilaster(s)
    parapet(s, 0, 6); parapet(s, 18, W)
    for y in range(TOP, H - 1):                                                                           # ragged edges where it snapped
        for x in range(6, 6 + (y > TOP + 4) + (y > TOP + 8)): s.put(x, y, C["mid"])
        for x in range(18 - (y > TOP + 3) - (y > TOP + 7), 18): s.put(x, y, C["mid"])
    for x, y in ((6, TOP + 2), (7, TOP + 7), (17, TOP + 3), (16, TOP + 8)): s.put(x, y, C["hi"])
    rail(s, 0, 7); rail(s, 17, W)
    for x, y in ((7, 1), (8, 2), (9, 3), (10, 4), (17, 1), (16, 2), (15, 4), (15, 5)): s.put(x, y, S["mid"] if (x + y) % 2 else S["lo"])   # the rail snapped and hanging
    heap = ((7, 13, 3, 3), (10, 12, 4, 4), (14, 13, 3, 3), (9, 15, 3, 2), (12, 15, 3, 2))                  # rubble across the gap, a few tiles in it
    for x0, y0, w, h in heap:
        for x in range(x0, x0 + w):
            for y in range(y0, y0 + h):
                if y < H - 1: s.put(x, y, C["hi"] if (x == x0 or y == y0) else C["lo"] if (x == x0 + w - 1 or y == y0 + h - 1) else C["mid"])
    s.put(11, 13, T["mid"]); s.put(15, 14, T["hi"]); s.put(8, 14, T["lo"])
    for x in range(6, 18): s.put(x, H - 1, C["deep"])
    return s

# ---- the keeper gate: pillars at x 0..2 and 20..22, teal steel double doors between with a split at x 10/11
GW, GH = 38, 51                 # the keeper catwalk: a 5 m x 5 m deck (38 px across, 27 rows deep at the 3/4 tilt) on stilts, its face 18 rows tall below it
DECK = 33                       # the row its front edge sits on; the plane is rows 5..32 with the rail rows above it
M = 3                           # the east and west pictures (41 px) have 3 px beside the deck for the ladder on the wall's outside

def planks(s, ox):
    for y in range(5, DECK):
        for x in range(ox, ox + GW): s.put(x, y, T["hi"] if y % 5 == 0 else T["lo"] if y % 5 == 4 else T["mid"])
    for y in range(5, DECK):
        for x in range(ox + 4, ox + GW - 3, 6): s.put(x, y, T["lo"])

def stilts(s, ox, plate=True):
    for x in range(ox, ox + GW): s.put(x, DECK, C["hi"]); s.put(x, DECK + 1, C["mid"]); s.put(x, DECK + 2, C["lo"]); s.put(x, DECK + 3, C["deep"])
    for x0 in (ox + 2, ox + GW - 5):
        for y in range(DECK + 4, GH - 1):
            s.put(x0, y, C["hi"]); s.put(x0 + 1, y, C["mid"]); s.put(x0 + 2, y, C["lo"])
        for x in range(3): s.put(x0 + x, GH - 1, C["deep"])
    if plate:
        for x in (ox + 18, ox + 19): s.put(x, DECK + 1, G["hi"]); s.put(x, DECK + 2, G["mid"])             # the gold marker plate on the fascia

def cap(s, x):
    for y in (0, 1): s.put(x, y, G["hi"]); s.put(x + 1, y, G["mid"])

def sides(s, ox):
    for x in (ox, ox + 1, ox + GW - 2, ox + GW - 1):                                                         # the side rails, seen end on
        for y in range(0, DECK): s.put(x, y, S["hi"] if x < ox + 2 else S["lo"])
    for y in range(2, DECK, 4):
        for x in (ox + 2, ox + GW - 3): s.put(x, y, S["mid"])

def back_rail(s, ox):
    for x in range(ox, ox + GW): s.put(x, 0, S["hi"]); s.put(x, 1, S["lo"]); s.put(x, 3, S["mid"])
    for x in range(ox, ox + GW, 9):
        for y in range(0, 6): s.put(x, y, S["hi"]); s.put(x + 1, y, S["lo"])

def front_rail(s, ox):
    for x in range(ox, ox + GW): s.put(x, DECK - 6, S["hi"]); s.put(x, DECK - 5, S["lo"]); s.put(x, DECK - 3, S["mid"])
    for x in range(ox, ox + GW, 9):
        for y in range(DECK - 6, DECK): s.put(x, y, S["hi"]); s.put(x + 1, y, S["lo"])

def hatch_front(s, ox):                                                                                    # the opening on the front edge the ladder goes down through
    for x in range(ox + 18, ox + 22):
        for y in range(DECK - 6, DECK): s.put(x, y, mix(T["deep"], (20, 30, 40), .5))
    for x in (ox + 16, ox + 21):
        for y in range(DECK - 9, DECK): s.put(x, y, S["hi"] if x == ox + 16 else S["lo"])

def gate(var="n"):
    # n: the exhibit lies behind the wall (north), so the deck goes back and the ladder comes down the front.
    # s: the exhibit lies in front, so the deck comes forward and the ladder is behind it, out of sight but for the rails over the edge.
    # e / w: a wall seen end on; the deck juts east or west and the ladder hangs on the far side, beside the deck.
    wide = var in "ew"; ox = M if var == "e" else 0
    s = Sec(GW + (M if wide else 0), GH)
    if var == "w": ox = 0
    planks(s, ox)
    for x in range(ox, ox + GW): s.put(x, 5, T["hi"]); s.put(x, DECK - 1, T["hi"])
    if var == "n":
        back_rail(s, ox); sides(s, ox); hatch_front(s, ox); cap(s, ox); cap(s, ox + GW - 2)
        stilts(s, ox)
        for y in range(DECK + 4, GH):
            s.put(ox + 16, y, S["hi"]); s.put(ox + 17, y, S["lo"]); s.put(ox + 20, y, S["hi"]); s.put(ox + 21, y, S["lo"])
            if (y - DECK) % 3 == 0:
                for x in (ox + 18, ox + 19): s.put(x, y, S["mid"])
    elif var == "s":
        front_rail(s, ox); sides(s, ox); cap(s, ox); cap(s, ox + GW - 2)
        for x in range(ox + 18, ox + 22):
            for y in range(5, 11): s.put(x, y, mix(T["deep"], (20, 30, 40), .5))
        for x in (ox + 16, ox + 21):
            for y in range(0, 8): s.put(x, y, S["hi"] if x == ox + 16 else S["lo"])
        for y in (2, 5): s.put(ox + 17, y, S["mid"]); s.put(ox + 18, y, S["mid"]); s.put(ox + 19, y, S["mid"]); s.put(ox + 20, y, S["mid"])
        stilts(s, ox)
    else:
        a0 = ox if var == "e" else GW - 4 + 0                                                              # the wall side's x (e: the left edge, w: the right edge)
        back_rail(s, ox); front_rail(s, ox)
        far = ox + GW - 2 if var == "e" else ox                                                            # the water side's rail, end on
        for x in (far, far + 1):
            for y in range(0, DECK): s.put(x, y, S["hi"] if x == far else S["lo"])
        cap(s, far); cap(s, ox if var == "e" else ox + GW - 2)
        for y in range(14, 23):                                                                            # the hatch on the wall side, the ladder rails over it
            for x in ((ox, ox + 1) if var == "e" else (ox + GW - 2, ox + GW - 1)): s.put(x, y, mix(T["deep"], (20, 30, 40), .5))
        stilts(s, ox, plate=False)
        lx = 1 if var == "e" else ox + GW + 1                                                              # the ladder down the outside, seen edge on
        for y in range(14, GH): s.put(lx, y, S["hi"] if var == "e" else S["lo"])
        for y in range(DECK + 4, GH, 3): s.put(lx - 1, y, S["mid"]); s.put(lx + 1, y, S["mid"])
        for y in range(16, DECK, 3): s.put(lx - 1, y, S["mid"]); s.put(lx + 1, y, S["mid"])
    return s

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "sprites/fence"
    sheet_path = sys.argv[2] if len(sys.argv) > 2 else None
    os.makedirs(out, exist_ok=True)
    states = {"pristine": pristine(), "degrading": degrading(), "broken": broken()}
    gates = {"": gate("n"), "-s": gate("s"), "-e": gate("e"), "-w": gate("w")}
    z, gap = 14, 4
    sheet = Image.new("RGBA", ((max(len(states) * (W + gap), len(gates) * (GW + gap)) + gap) * z, (H + GH + 3 * gap) * z), (176, 190, 150, 255))
    for row, (pre, group) in enumerate((("lagoon-", states), ("lagoon-gate", gates))):
        for i, (name, sec) in enumerate(group.items()):
            im = sec.img(); im.save(f"{out}/{pre}{name}.png")
            sheet.alpha_composite(im.resize((im.width * z, im.height * z), Image.NEAREST), ((gap + i * (im.width + gap)) * z, (gap + row * (H + gap)) * z))
            print(pre + name, im.size)
    if sheet_path: sheet.save(sheet_path)
