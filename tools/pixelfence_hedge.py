# Draws the hedge row as three 3 m sections in the Dimetrodon's flat style: pristine (a dense green wall of clumps), degrading (thin, browning, branches showing through gaps) and broken (a trampled gap: stubs at both ends, snapped branches and leaves on the ground).
# Pixels are 0.13 m (ROCK_MPP), so a 3 m section is 23 px wide and the 1.8 m hedge (FENCE34.hedge.h) is 14 px tall, side-on. A hedge has no posts, so sections tile by the top outline matching at both ends (the first and last columns are the same height).
# Flat fills, no outline, light from the top left: the lit edge of each clump, shadow low down and under it, leaf texture as short dashes on a steady rhythm. Palette: the old hedge colors (#6BA851, #4E8A3E, #3F7A32, #24461F), olive and warm browns for the worn states.
# The keeper gate (hedge-gate.png, same size) never wears or breaks: a pillar of hedge at each end and a wooden double gate between, with a gold latch plate (the gate marker's #D8B04A). Frames -1, -2, -3 swing it open for a keeper going through: each leaf shortens toward its hinge pillar, and the latch goes.
# Usage: python3 -I tools/pixelfence_hedge.py [outdir] [sheet.png]   (default sprites/fence; the optional sheet is a x16 view of every picture, fence on the top row and gate under it)
import sys, os
from PIL import Image

W, H = 23, 14
def mix(a, b, t): return tuple(round(x * (1 - t) + y * t) for x, y in zip(a, b))
LEAF = {"hi": (107, 168, 81), "mid": (78, 138, 62), "lo": (58, 108, 46), "deep": (36, 70, 31)}   # #6BA851, #4E8A3E, ..., #24461F
DRY = {"hi": (186, 184, 92), "mid": (146, 150, 66), "lo": (112, 112, 52), "deep": (74, 66, 38)}   # browning leaves
BARK = {"hi": (160, 120, 78), "mid": (122, 90, 56), "lo": (88, 64, 40), "deep": (60, 44, 30)}     # branches, and the gate's wood (#7A5A38)
PALE = (205, 172, 120)                                                                              # fresh splinters where a branch snapped
GOLD = {"hi": (227, 198, 125), "mid": (216, 176, 74), "lo": (164, 134, 56), "deep": (110, 88, 36)}  # the gate marker colour #D8B04A
L, D, B, Y = LEAF, DRY, BARK, GOLD
TOP = (3, 2, 1, 1, 1, 2, 2, 3, 2, 1, 0, 0, 1, 1, 2, 3, 2, 1, 1, 0, 1, 2, 3)   # the top row of each column: clumps, stair-stepped; first and last match so sections tile

class Sec:
    def __init__(s): s.px = {}
    def put(s, x, y, c):
        if 0 <= x < W and 0 <= y < H: s.px[(x, y)] = c
    def clear(s, x, y): s.px.pop((x, y), None)
    def img(s):
        im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        for (x, y), c in s.px.items(): im.putpixel((x, y), c + (255,))
        return im

def body(s, P, top=TOP, x0=0, x1=W, drop=0):
    # the wall: a lit rim on the clump's left and top, leaf dashes in rows, shade low down, a dark line where it meets the ground
    for x in range(x0, x1):
        t = top[x] + drop
        left = top[x - 1] + drop if x > 0 else t
        for y in range(t, H):
            c = P["mid"]
            if y == t or (left > t and y <= t + 1): c = P["hi"]          # lit top, and the lit face of a clump that rises from a lower neighbour
            elif y >= H - 3: c = P["lo"]
            elif (x + 2 * y) % 5 == 0: c = P["hi"]                       # leaf dashes: a steady diagonal rhythm
            elif (3 * x + y) % 7 == 0: c = P["lo"]
            s.put(x, y, c)
        s.put(x, H - 1, P["deep"])
        right = top[x + 1] + drop if x + 1 < len(top) else t
        if right > t: s.put(x, t + 2, P["lo"]); s.put(x, t + 3, P["lo"])  # the shaded right side of a clump that drops away

def pristine():
    s = Sec(); body(s, L)
    # a few berries-sized highlights low in the leaves, spaced evenly
    for x in (5, 13, 20): s.put(x, 8, L["hi"]); s.put(x + 1, 8, L["hi"])
    return s

def degrading():
    s = Sec(); body(s, D, drop=1)
    # thin patches: bare branches show through where leaves have dropped, a dashed rhythm of brown twigs
    for x, y in ((3, 6), (4, 7), (5, 6), (4, 8), (9, 5), (10, 6), (9, 7), (10, 8), (15, 6), (16, 7), (17, 6), (16, 8), (20, 8), (21, 9)): s.put(x, y, B["lo"] if (x + y) % 2 else B["mid"])
    for x, y in ((3, 7), (10, 7), (16, 6), (4, 9)): s.put(x, y, B["hi"])
    for x in range(1, W, 4): s.put(x, 4, L["mid"]); s.put(x + 1, 4, L["lo"])   # a few green leaves left on top
    for x in range(0, W, 3): s.put(x, H - 2, B["lo"])                          # bare stems at the foot
    return s

def broken():
    # a gap an animal went through, or a hedge left at 0%: stubs at both ends, torn branches, litter on the ground
    s = Sec()
    left = (3, 4, 6, 8, 10, 11)       # top rows of the left stub's first columns (it falls away)
    right = (11, 9, 7, 5, 4, 3)       # and the right stub, mirrored
    for i, t in enumerate(left):
        for y in range(t, H): s.put(i, y, D["hi"] if y == t else D["mid"] if y < H - 3 else D["lo"])
        s.put(i, H - 1, D["deep"])
    for i, t in enumerate(right):
        x = W - len(right) + i
        for y in range(t, H): s.put(x, y, D["hi"] if y == t else D["mid"] if y < H - 3 else D["lo"])
        s.put(x, H - 1, D["deep"])
    for x, y in ((1, 4), (3, 9), (4, 10), (18, 8), (19, 6), (21, 5)): s.put(x, y, L["hi"])
    for x, y in ((2, 7), (4, 8)): s.put(x, y, L["lo"])
    # snapped branches sticking out of the stubs, with pale splinters
    for x, y in ((5, 9), (6, 9), (7, 8)): s.put(x, y, B["mid"])
    s.put(7, 7, PALE); s.put(8, 8, B["hi"])
    for x, y in ((17, 8), (16, 8), (15, 7)): s.put(x, y, B["mid"])
    s.put(15, 6, PALE); s.put(14, 7, B["hi"])
    # the gap: trampled twigs and leaf litter lying on the ground
    for x in range(6, 17): s.put(x, H - 1, D["deep"])
    for x in range(6, 17): s.put(x, H - 2, D["lo"] if x % 3 else B["lo"])
    for x, y in ((7, 11), (9, 11), (11, 11), (13, 11), (15, 11), (8, 10), (12, 10), (14, 10)): s.put(x, y, L["lo"] if x % 2 else D["mid"])
    for x, y in ((8, 11), (10, 10), (12, 11), (14, 11)): s.put(x, y, D["hi"])
    for x, y in ((9, 10), (13, 10)): s.put(x, y, B["mid"])
    s.put(10, 11, PALE); s.put(15, 10, PALE)
    return s

# ---- the keeper gate: a hedge pillar at x 0..2 and 20..22, a wooden double gate between with a split at x 10/11
PIL = (2, 1, 2)    # the pillar's top rows
def pillar(s, x0):
    for i in range(3):
        for y in range(PIL[i], H): s.put(x0 + i, y, L["hi"] if (y == PIL[i] or i == 0 and y < H - 3) else L["mid"] if i == 1 and y < H - 3 else L["lo"])
        s.put(x0 + i, H - 1, L["deep"])
    for y in (5, 8): s.put(x0 + 1, y, L["hi"])

def gate(sc=1.0):
    # sc is how far across the leaves still reach: 1 is shut, less is swung open (a leaf turning away from us shortens toward its hinge pillar)
    s = Sec(); pillar(s, 0); pillar(s, 20)
    fl = lambda x: 3 + round((x - 3) * sc)      # left leaf, hinged at x 3
    fr = lambda x: 19 - round((19 - x) * sc)    # right leaf, hinged at x 19
    for xa, xb in ((3, fl(10)), (fr(11), 19)):
        for y in range(3, H - 1):
            for x in range(xa, xb + 1): s.put(x, y, B["mid"] if (x - xa) % 3 else B["lo"])   # boards, a seam every third column
        for x in range(xa, xb + 1): s.put(x, 3, B["hi"]); s.put(x, 4, B["mid"]); s.put(x, H - 3, B["hi"]); s.put(x, H - 2, B["lo"]); s.put(x, 8, B["hi"]) if x == xa else None
    for y in range(3, H - 1):
        s.put(3, y, B["mid"]); s.put(fl(10), y, B["deep"]); s.put(fr(11), y, B["hi"]); s.put(19, y, B["deep"])
    for x, y in ((3, 5), (3, 10), (19, 5), (19, 10)): s.put(x, y, B["deep"])   # hinge pins
    if sc == 1.0:
        for x in (10, 11): s.put(x, 6, GOLD["hi"]); s.put(x, 7, GOLD["mid"]); s.put(x, 8, GOLD["lo"])
        s.put(11, 7, GOLD["deep"])
    return s

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "sprites/fence"
    sheet_path = sys.argv[2] if len(sys.argv) > 2 else None
    os.makedirs(out, exist_ok=True)
    states = {"pristine": pristine(), "degrading": degrading(), "broken": broken()}
    gates = {"": gate(1.0), "-1": gate(.66), "-2": gate(.33), "-3": gate(.1)}
    z, gap = 16, 4
    sheet = Image.new("RGBA", ((max(len(states), len(gates)) * (W + gap) + gap) * z, (2 * (H + gap) + gap // 2) * z), (190, 176, 140, 255))   # on dry ground, so the green shows
    for row, (pre, group) in enumerate((("hedge-", states), ("hedge-gate", gates))):
        for i, (name, sec) in enumerate(group.items()):
            im = sec.img(); im.save(f"{out}/{pre}{name}.png")
            sheet.alpha_composite(im.resize((W * z, H * z), Image.NEAREST), ((gap + i * (W + gap)) * z, (gap // 2 + row * (H + gap)) * z))
            print(pre + name, im.size)
    if sheet_path: sheet.save(sheet_path)
