# Draws the wooden post-and-rail fence as three 3 m sections in the Dimetrodon's flat style: pristine, degrading (weathered grey, a sagging rail, moss and nail rust) and broken (a smashed gap: rails snapped, boards on the ground).
# Pixels are 0.13 m (ROCK_MPP), so a 3 m section is 23 px wide and the 1.6 m fence (FENCE34.wood.h) is 12 px tall, side-on, the post on the left edge so sections tile end to end.
# Flat fills, no outline, light from the top left: a lit left edge and top, shadow under rails and on the right of the post. Grain is rows of short dashes on a steady rhythm, never scatter.
# The keeper gate (wood-gate.png, same size) never wears or breaks: one 3 m section with a heavy post at each end, a double leaf with a diagonal brace, and a gold latch plate (the gate marker's #D8B04A). Frames -1, -2, -3 swing it open for a keeper going through: each leaf shortens toward its hinge post, and the latch goes.
# Usage: python3 -I tools/pixelfence_wood.py [outdir] [sheet.png]   (default sprites/fence; the optional sheet is a x16 view of every picture, fence on the top row and gate under it)
import sys, os
from PIL import Image

W, H = 23, 12
TOP, BOT = 2, 7             # rail rows (each rail is three rows: lit, body, shaded)
def mix(a, b, t): return tuple(round(x * (1 - t) + y * t) for x, y in zip(a, b))
def ramp(base): return {"hi": mix(base, (255, 255, 255), .26), "mid": base, "lo": mix(base, (0, 0, 0), .24), "deep": mix(base, (0, 0, 0), .42)}
WOOD = ramp((122, 90, 56))      # FENCE34.wood colour #7A5A38
GREY = ramp((142, 130, 114))    # weathered, silvered wood
MOSS = ramp((97, 111, 34))      # the Dimetrodon's olive
RUST = ramp((178, 78, 0))
PALE = ramp((205, 172, 120))    # fresh splinters where it snapped
GOLD = ramp((216, 176, 74))     # the gate marker colour #D8B04A
D, G, M, R, P, Y = WOOD, GREY, MOSS, RUST, PALE, GOLD

class Sec:
    def __init__(s): s.px = {}
    def put(s, x, y, c):
        if 0 <= x < W and 0 <= y < H: s.px[(x, y)] = c
    def clear(s, x, y): s.px.pop((x, y), None)
    def img(s):
        im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        for (x, y), c in s.px.items(): im.putpixel((x, y), c + (255,))
        return im

def post(s, T, cap=True):
    # two wide, lit on the left, shaded on the right, set in a small footing
    for y in range(0, H): s.put(0, y, T["hi"]); s.put(1, y, T["lo"])
    if cap: s.put(0, 0, T["hi"]); s.put(1, 0, T["mid"])
    s.put(0, H - 1, T["mid"]); s.put(1, H - 1, T["deep"]); s.put(2, H - 1, T["deep"])
    for y in (3, 8): s.put(1, y, T["mid"])   # grain

def rail(s, T, y0, x0=2, x1=W, sag=None):
    # three rows: lit top, body, shaded underside; sag(x) drops the whole rail that many rows
    for x in range(x0, x1):
        d = sag(x) if sag else 0
        s.put(x, y0 + d, T["hi"]); s.put(x, y0 + 1 + d, T["mid"]); s.put(x, y0 + 2 + d, T["lo"])
        if x % 5 == 3: s.put(x, y0 + 1 + d, T["lo"])      # a grain dash every fifth column
        if x % 7 == 5: s.put(x, y0 + d, T["mid"])

def base(T, sag=None):
    s = Sec(); post(s, T)
    rail(s, T, TOP, sag=sag); rail(s, T, BOT)
    # a nail head where each rail meets the post
    for y in (TOP + 1, BOT + 1): s.put(1, y, T["deep"])
    return s

def pristine():
    s = base(D)
    # a knot in each rail, a lighter board edge on the post
    s.put(9, TOP + 1, D["deep"]); s.put(10, TOP + 1, D["lo"]); s.put(16, BOT + 1, D["deep"]); s.put(15, BOT + 1, D["lo"])
    s.put(0, 4, D["hi"]); s.put(0, 9, D["hi"])
    return s

def degrading():
    s = base(G, sag=lambda x: 1 if x >= 15 else 0)   # the top rail has dropped a row toward the far end
    # silvered, cracked: dark splits along the grain, a few green stains low down
    for x in (6, 7, 8): s.put(x, TOP + 1, G["deep"])
    for x in (12, 13): s.put(x, BOT + 1, G["deep"])
    s.put(18, TOP + 2, G["deep"]); s.put(19, TOP + 2, G["deep"])
    for y in (4, 5, 6): s.put(0, y, G["mid"])         # post faded to bare grey
    s.put(1, 5, G["deep"]); s.put(1, 6, G["deep"])
    # nails rusted, moss at the footing and on the lower rail
    for y in (TOP + 1, BOT + 1): s.put(1, y, R["mid"])
    s.put(0, H - 2, M["mid"]); s.put(1, H - 2, M["lo"]); s.put(0, H - 3, M["hi"]); s.put(2, H - 1, M["lo"])
    for x in (4, 5, 9, 10): s.put(x, BOT + 2, M["mid"] if x % 2 else M["lo"])
    s.put(21, BOT + 2, M["mid"])
    # one plank end has split and drooped at the far side
    s.put(22, TOP + 2 + 1, G["deep"]); s.put(22, TOP + 4, G["lo"])
    return s

def broken():
    # a gap an animal went through, or a fence left at 0%: the post is snapped, the rails fall away, boards lie in the dirt
    s = Sec(); post(s, G, cap=False)
    s.put(0, 0, G["lo"]); s.put(1, 1, G["deep"]); s.put(0, 1, P["mid"]); s.put(1, 0, P["hi"])      # snapped top, fresh splinters
    for y in (H - 3, H - 2): s.put(0, y, M["mid"])
    # the rails stay nailed to the post and hang down the near side, broken short
    for x in (2, 3, 4): s.put(x, TOP, G["hi"]); s.put(x, TOP + 1, G["mid"]); s.put(x, TOP + 2, G["lo"])
    s.put(5, TOP + 2, G["mid"]); s.put(5, TOP + 3, G["lo"]); s.put(6, TOP + 3, G["deep"]); s.put(6, TOP + 4, P["mid"])
    for x in (2, 3, 4, 5): s.put(x, BOT, G["hi"]); s.put(x, BOT + 1, G["mid"]); s.put(x, BOT + 2, G["lo"])
    s.put(6, BOT + 1, P["hi"]); s.put(6, BOT + 2, P["mid"])
    # the far end: a stub of rail still on the next post's place
    for x in (20, 21, 22): s.put(x, TOP + 1, G["hi"]); s.put(x, TOP + 2, G["mid"]); s.put(x, TOP + 3, G["lo"])
    for x in (20, 21, 22): s.put(x, BOT + 1, G["hi"]); s.put(x, BOT + 2, G["mid"]); s.put(x, BOT + 3, G["lo"])
    s.put(19, TOP + 3, P["mid"]); s.put(19, BOT + 2, P["hi"]); s.put(19, BOT + 3, P["mid"])
    # boards on the ground across the gap: two rows of timber lying at slight angles, splinters at the ends
    for x in range(7, 19): s.put(x, H - 1, G["deep"])
    for x in range(7, 19): s.put(x, H - 2, G["mid"] if x % 4 else G["lo"])
    for x in range(8, 18): s.put(x, H - 3, G["hi"] if x % 5 else G["mid"])
    for x in range(9, 15): s.put(x, H - 4, G["lo"])
    s.put(9, H - 4, P["mid"]); s.put(14, H - 4, P["hi"]); s.put(10, H - 5, G["hi"]); s.put(11, H - 5, G["mid"]); s.put(16, H - 4, P["mid"])
    s.put(7, H - 3, P["mid"]); s.put(18, H - 3, P["hi"]); s.put(13, H - 5, R["mid"]); s.put(12, H - 3, R["lo"])   # a bent nail
    return s

# ---- the keeper gate: posts at x 0..2 and 20..22, a double leaf between with a split at x 10/11
def gpost(s, x0, cap=True):
    for y in range(1, H - 1): s.put(x0, y, D["hi"]); s.put(x0 + 1, y, D["mid"]); s.put(x0 + 2, y, D["lo"])
    if cap: s.put(x0, 0, D["hi"]); s.put(x0 + 1, 0, Y["hi"]); s.put(x0 + 2, 0, D["mid"]); s.put(x0 + 1, 1, Y["mid"])   # a gold cap on top
    for x in (0, 1, 2): s.put(x0 + x, H - 1, D["deep"])
    s.put(x0 + 1, 4, D["lo"]); s.put(x0 + 1, 8, D["lo"])

def gate(sc=1.0):
    # sc is how far across the leaves still reach: 1 is shut, less is swung open (a leaf turning away from us shortens toward its hinge post)
    s = Sec(); gpost(s, 0); gpost(s, 20)
    fl = lambda x: 3 + round((x - 3) * sc)      # left leaf, hinged at x 3
    fr = lambda x: 19 - round((19 - x) * sc)    # right leaf, hinged at x 19
    for y0 in (TOP, BOT):
        for x in range(3, fl(10) + 1): s.put(x, y0, D["hi"]); s.put(x, y0 + 1, D["mid"]); s.put(x, y0 + 2, D["lo"])
        for x in range(fr(11), 20): s.put(x, y0, D["hi"]); s.put(x, y0 + 1, D["mid"]); s.put(x, y0 + 2, D["lo"])
    # stiles at hinge and free end of each leaf
    for y in range(TOP, BOT + 3):
        s.put(3, y, D["mid"]); s.put(fl(10), y, D["lo"]); s.put(fr(11), y, D["hi"]); s.put(19, y, D["lo"])
    # the diagonal brace on each leaf, from the low hinge corner up to the high free corner
    for k in range(0, 8):
        y = BOT + 1 - round(k * (BOT - TOP - 1) / 7)
        s.put(fl(3 + k), y, D["deep"]); s.put(fr(19 - k), y, D["deep"])
    for x, y in ((3, TOP + 1), (3, BOT + 1), (19, TOP + 1), (19, BOT + 1)): s.put(x, y, D["deep"])   # hinge pins
    if sc == 1.0:
        # the latch plate on the split
        for x in (10, 11): s.put(x, 5, Y["hi"]); s.put(x, 6, Y["mid"]); s.put(x, 7, Y["lo"])
        s.put(11, 6, Y["deep"])
    return s

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "sprites/fence"
    sheet_path = sys.argv[2] if len(sys.argv) > 2 else None
    os.makedirs(out, exist_ok=True)
    states = {"pristine": pristine(), "degrading": degrading(), "broken": broken()}
    gates = {"": gate(1.0), "-1": gate(.66), "-2": gate(.33), "-3": gate(.1)}
    z, gap = 16, 4
    sheet = Image.new("RGBA", ((max(len(states), len(gates)) * (W + gap) + gap) * z, (2 * (H + gap) + gap // 2) * z), (176, 190, 150, 255))   # on a park-green ground
    for row, (pre, group) in enumerate((("wood-", states), ("wood-gate", gates))):
        for i, (name, sec) in enumerate(group.items()):
            im = sec.img(); im.save(f"{out}/{pre}{name}.png")
            sheet.alpha_composite(im.resize((W * z, H * z), Image.NEAREST), ((gap + i * (W + gap)) * z, (gap // 2 + row * (H + gap)) * z))
            print(pre + name, im.size)
    if sheet_path: sheet.save(sheet_path)
