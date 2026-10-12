# Draws the acrylic fence as three 3 m sections in the Dimetrodon's flat style: pristine (clear panel in an aluminium frame), degrading (clouded and yellowed, scratched, a crack across one corner, grime at the bottom) and broken (the panel smashed out, shards on the ground).
# Pixels are 0.13 m (ROCK_MPP), so a 3 m section is 23 px wide and the 2.2 m fence (FENCE34.acrylic.h) is 17 px tall, side-on, the post on the left edge so sections tile end to end.
# Flat fills, no outline, light from the top left. The panel is see-through: pale ice blue at low alpha, a bright lit top and left edge, a darker bottom and right edge, and a few diagonal glare streaks on a steady rhythm. Animals and plants behind it show through.
# The keeper gate (acrylic-gate.png, same size) never wears or breaks: a glass double door in an aluminium frame, heavy posts with a cap, and a gold latch plate (the gate marker's #D8B04A). Frames -1, -2, -3 swing it open for a keeper going through: each leaf shortens toward its hinge post, and the latch goes.
# Usage: python3 -I tools/pixelfence_acrylic.py [outdir] [sheet.png]   (default sprites/fence; the optional sheet is a x16 view of every picture, fence on the top row and gate under it)
import sys, os
from PIL import Image

W, H = 23, 17
def mix(a, b, t): return tuple(round(x * (1 - t) + y * t) for x, y in zip(a, b))
def ramp(base): return {"hi": mix(base, (255, 255, 255), .3), "mid": base, "lo": mix(base, (0, 0, 0), .25), "deep": mix(base, (0, 0, 0), .45)}
ALU = ramp((168, 176, 184))     # aluminium frame
RUST = ramp((178, 78, 0))
GRIME = ramp((97, 111, 34))     # the Dimetrodon's olive, algae in the bottom channel
GOLD = ramp((216, 176, 74))     # the gate marker colour #D8B04A
def a(c, al): return tuple(c[:3]) + (al,)
PANE = (159, 207, 224)          # FENCE34.acrylic colour #9FCFE0
CLEAR, EDGE_HI, EDGE_LO, GLARE = a(PANE, 70), a((235, 248, 252), 215), a((98, 160, 184), 150), a((255, 255, 255), 125)
CLOUD, SCRATCH, CRACK = a((214, 208, 160), 120), a((255, 255, 255), 175), a((255, 255, 255), 235)
SHARD, SHARD_HI = a(PANE, 130), a((235, 248, 252), 235)
A_, R_, G_, Y_ = ALU, RUST, GRIME, GOLD
TOPR, BOTR = 1, 14               # frame channel rows (two rows each: lit, then shaded); the panel sits between rows 3 and 13

class Sec:
    def __init__(s): s.px = {}
    def put(s, x, y, c):
        if 0 <= x < W and 0 <= y < H: s.px[(x, y)] = c
    def clear(s, x, y): s.px.pop((x, y), None)
    def img(s):
        im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        for (x, y), c in s.px.items(): im.putpixel((x, y), c if len(c) == 4 else c + (255,))
        return im

def post(s, cap=True):
    for y in range(0, H): s.put(0, y, A_["hi"]); s.put(1, y, A_["lo"])
    if cap: s.put(0, 0, A_["hi"]); s.put(1, 0, A_["mid"])
    for x in (0, 1, 2): s.put(x, H - 1, A_["deep"])
    s.put(2, H - 2, A_["lo"]); s.put(0, 5, A_["mid"]); s.put(0, 10, A_["mid"])

def channels(s, x0=2, x1=W):
    # the aluminium channel the panel slots into, top and bottom
    for y0 in (TOPR, BOTR):
        for x in range(x0, x1): s.put(x, y0, A_["hi"]); s.put(x, y0 + 1, A_["lo"])

def panel(s, tint=CLEAR, x0=2, x1=W, y0=3, y1=13):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1): s.put(x, y, tint)
    for x in range(x0, x1): s.put(x, y0, EDGE_HI); s.put(x, y1, EDGE_LO)
    for y in range(y0, y1 + 1): s.put(x0, y, EDGE_HI)
    for y in range(y0 + 1, y1 + 1): s.put(x1 - 1, y, EDGE_LO)

def glare(s):
    # two diagonal streaks, each a run of steps down and to the left, a fixed distance apart
    for x0 in (10, 18):
        for i in range(5):
            s.put(x0 - i, 4 + i * 2, GLARE); s.put(x0 + 1 - i, 4 + i * 2, GLARE)
            if i < 4: s.put(x0 - i, 5 + i * 2, GLARE)

def bolts(s, c):
    for x, y in ((3, 4), (3, 12), (21, 4), (21, 12)): s.put(x, y, c)

def pristine():
    s = Sec(); post(s); panel(s); channels(s); glare(s)
    bolts(s, A_["mid"])
    return s

def degrading():
    s = Sec(); post(s); panel(s, CLOUD); channels(s)
    # clouded, scratched: short pale scratches at odd angles on a loose rhythm, a crack fanning from the top right corner
    for x, y in ((6, 6), (7, 7), (8, 8), (12, 10), (13, 11), (14, 10), (15, 5), (16, 5), (17, 5), (5, 11), (6, 11), (9, 4)): s.put(x, y, SCRATCH)
    for x, y in ((20, 4), (19, 5), (19, 6), (18, 7), (17, 8), (17, 9), (16, 10), (20, 6), (19, 7), (18, 7), (21, 8), (20, 8), (19, 9)): s.put(x, y, CRACK)
    # grime and algae along the bottom channel, rust on the bolts and the post foot
    for x in range(2, W):
        if x % 4 in (0, 1): s.put(x, BOTR + 1, G_["lo"]); s.put(x, 13, a(G_["mid"], 170))
        if x % 7 == 2: s.put(x, BOTR, G_["mid"])
    bolts(s, R_["mid"]); s.put(21, 12, R_["lo"])
    for y in (12, 13, 14, 15): s.put(1, y, R_["lo"])
    s.put(0, 13, R_["mid"]); s.put(0, 15, R_["hi"]); s.put(0, 9, R_["mid"])
    for x in (12, 13, 14, 15): s.put(x, TOPR, A_["mid"])   # the top channel dulled and dented
    return s

def broken():
    s = Sec(); post(s, cap=False)
    s.put(0, 0, A_["lo"]); s.put(1, 2, A_["deep"]); s.put(0, 6, R_["mid"]); s.put(1, 7, R_["lo"]); s.put(0, 12, R_["mid"])
    # the frame channels are bent and torn off in the middle, still holding their ends
    for x in (2, 3, 4, 5): s.put(x, TOPR, A_["hi"]); s.put(x, TOPR + 1, A_["lo"])
    s.put(6, TOPR + 2, A_["mid"]); s.put(7, TOPR + 3, A_["lo"])
    for x in (19, 20, 21, 22): s.put(x, TOPR + 1, A_["hi"]); s.put(x, TOPR + 2, A_["lo"])
    s.put(18, TOPR + 3, A_["mid"]); s.put(17, TOPR + 4, A_["lo"])
    for x in (2, 3, 4, 5): s.put(x, BOTR, A_["hi"]); s.put(x, BOTR + 1, A_["lo"])
    for x in (18, 19, 20, 21, 22): s.put(x, BOTR, A_["hi"]); s.put(x, BOTR + 1, A_["lo"])
    # shards of the panel left in the frame: jagged teeth hanging from the top and standing in the bottom, each with a bright edge
    for x0, ys in ((2, (3, 4, 5, 6, 7, 8)), (3, (3, 4, 5, 6)), (4, (3, 4, 5)), (5, (3,))):
        for y in ys: s.put(x0, y, SHARD)
        s.put(x0, ys[-1], SHARD_HI)
    for x0, ys in ((21, (3, 4, 5, 6, 7)), (20, (3, 4, 5)), (19, (3, 4)), (22, (3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13))):
        for y in ys: s.put(x0, y, SHARD)
        s.put(x0, ys[-1], SHARD_HI)
    for x, y in ((2, 12), (2, 13), (3, 13), (4, 13), (3, 12)): s.put(x, y, SHARD)
    s.put(2, 12, SHARD_HI); s.put(4, 13, SHARD_HI)
    # shards and broken pieces on the ground across the gap, a few bright edges, dirt-dark where they meet the ground
    for x in range(6, 18): s.put(x, H - 1, a((52, 66, 72), 190))
    for x, y in ((6, 14), (7, 15), (8, 14), (9, 15), (10, 13), (11, 14), (12, 15), (13, 14), (14, 13), (15, 14), (16, 15), (17, 14)): s.put(x, y, SHARD)
    for x, y in ((6, 15), (8, 15), (10, 14), (11, 15), (13, 15), (14, 14), (16, 14), (17, 15)): s.put(x, y, SHARD)
    for x, y in ((7, 14), (9, 14), (12, 14), (15, 13), (10, 12), (13, 13), (16, 14)): s.put(x, y, SHARD_HI)
    for x, y in ((8, 13), (14, 12)): s.put(x, y, CRACK)
    return s

# ---- the keeper gate: posts at x 0..2 and 20..22, a double glass door between with a split at x 10/11
def gpost(s, x0):
    for y in range(1, H - 1): s.put(x0, y, A_["hi"]); s.put(x0 + 1, y, A_["mid"]); s.put(x0 + 2, y, A_["lo"])
    s.put(x0, 0, A_["hi"]); s.put(x0 + 1, 0, Y_["hi"]); s.put(x0 + 2, 0, A_["mid"]); s.put(x0 + 1, 1, Y_["mid"])   # a gold cap on top
    for x in (0, 1, 2): s.put(x0 + x, H - 1, A_["deep"])
    s.put(x0, 5, A_["lo"]); s.put(x0, 10, A_["lo"])

def gate(sc=1.0):
    # sc is how far across the leaves still reach: 1 is shut, less is swung open (a leaf turning away from us shortens toward its hinge post)
    s = Sec(); gpost(s, 0); gpost(s, 20)
    fl = lambda x: 3 + round((x - 3) * sc)      # left leaf, hinged at x 3
    fr = lambda x: 19 - round((19 - x) * sc)    # right leaf, hinged at x 19
    for xa, xb in ((3, fl(10)), (fr(11), 19)):
        for y in range(3, 14):
            for x in range(xa + 1, xb): s.put(x, y, CLEAR)
        for x in range(xa, xb + 1): s.put(x, 2, A_["hi"]); s.put(x, 3, A_["lo"]); s.put(x, 13, A_["hi"]); s.put(x, 14, A_["lo"])
    for y in range(2, 15):
        s.put(3, y, A_["mid"]); s.put(fl(10), y, A_["lo"]); s.put(fr(11), y, A_["hi"]); s.put(19, y, A_["lo"])
    if sc == 1.0:
        for x in range(4, 10): s.put(x, 4, EDGE_HI)
        for x in range(12, 19): s.put(x, 4, EDGE_HI)
        for i in range(4): s.put(8 - i, 5 + i * 2, GLARE); s.put(9 - i, 5 + i * 2, GLARE)
    for x, y in ((3, 4), (3, 12), (19, 4), (19, 12)): s.put(x, y, A_["deep"])   # hinge pins
    if sc == 1.0:
        for x in (10, 11): s.put(x, 7, Y_["hi"]); s.put(x, 8, Y_["mid"]); s.put(x, 9, Y_["lo"])
        s.put(11, 8, Y_["deep"])
    return s

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "sprites/fence"
    sheet_path = sys.argv[2] if len(sys.argv) > 2 else None
    os.makedirs(out, exist_ok=True)
    states = {"pristine": pristine(), "degrading": degrading(), "broken": broken()}
    gates = {"": gate(1.0), "-1": gate(.66), "-2": gate(.33), "-3": gate(.1)}
    z, gap = 16, 4
    sheet = Image.new("RGBA", ((max(len(states), len(gates)) * (W + gap) + gap) * z, (2 * (H + gap) + gap // 2) * z), (118, 140, 96, 255))   # on a park-green ground, darker so the see-through panel shows
    for row, (pre, group) in enumerate((("acrylic-", states), ("acrylic-gate", gates))):
        for i, (name, sec) in enumerate(group.items()):
            im = sec.img(); im.save(f"{out}/{pre}{name}.png")
            sheet.alpha_composite(im.resize((W * z, H * z), Image.NEAREST), ((gap + i * (W + gap)) * z, (gap // 2 + row * (H + gap)) * z))
            print(pre + name, im.size)
    if sheet_path: sheet.save(sheet_path)
