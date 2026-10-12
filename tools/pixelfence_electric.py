# Draws the electrified fence as three 3 m sections in the Dimetrodon's flat style: pristine, degrading (rust, a sagging wire, a dim lamp) and broken (a snapped post, cut wires coiled on the ground), plus an "-off" twin of the first two for when the generators fail (lamp dark, wires dull).
# Pixels are 0.13 m (ROCK_MPP), so a 3 m section is 23 px wide and the fence (FENCE34.electric: 3.2 m of wire plus the post lamp) is 27 px tall, side-on, the post on the left edge so sections tile end to end.
# Flat fills, no outline, light from the top left: a lit left edge on the post, shadow on its right, five taut wires on cream insulators and an amber lamp on top (the Genesis post lights: lit while powered, dark when not).
# The keeper gate (electric-gate.png, same size, plus -off and swing frames -1, -2, -3 for each) never wears: heavy posts with lamps, a double leaf of steel frame with three wires, and a gold latch plate (#D8B04A). Each leaf shortens toward its hinge post as it swings.
# Usage: python3 -I tools/pixelfence_electric.py [outdir] [sheet.png]   (default sprites/fence; the optional sheet is a x12 view of every picture)
import sys, os, math
from PIL import Image

W, H = 23, 27
WIRES = (21, 17, 12, 8, 3)  # wire rows, from 0.6 m to 3.0 m up (FENCE34.electric.rails)
def mix(a, b, t): return tuple(round(x * (1 - t) + y * t) for x, y in zip(a, b))
def ramp(base): return {"hi": mix(base, (255, 255, 255), .28), "mid": base, "lo": mix(base, (0, 0, 0), .26), "deep": mix(base, (0, 0, 0), .45)}
STEEL = ramp((90, 96, 104))     # FENCE34.electric colour #5A6068
RUST = ramp((178, 78, 0))
AMBER = ramp((255, 181, 71))    # the post lights #FFB547 / #FFC25E
GOLD = ramp((216, 176, 74))     # the gate marker colour #D8B04A
CREAM = (232, 230, 214)         # insulators
DARK = (42, 46, 43)             # a lamp with no power, #2A2E2B
S, R, A, G = STEEL, RUST, AMBER, GOLD

class Sec:
    def __init__(s): s.px = {}
    def put(s, x, y, c):
        if 0 <= x < W and 0 <= y < H: s.px[(x, y)] = c
    def clear(s, x, y): s.px.pop((x, y), None)
    def img(s):
        im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        for (x, y), c in s.px.items(): im.putpixel((x, y), c + (255,))
        return im

def lamp(s, x0, wide, state):
    # state: "on" bright with a halo, "dim" worn and low, "off" dark, "smashed" cracked
    xs = range(x0, x0 + wide)
    for y in (0, 1):
        for x in xs:
            if state == "on": c = A["hi"] if (x == x0 and y == 0) else A["lo"] if (x == x0 + wide - 1 and y == 1) else A["mid"]
            elif state == "dim": c = A["lo"] if y == 0 else A["deep"]
            elif state == "smashed": c = None if (x + y) % 2 else S["deep"]
            else: c = DARK
            if c: s.put(x, y, c)
    if state == "on": s.put(x0 + wide, 0, A["lo"]); s.put(x0 + wide, 1, A["deep"])   # a halo to the right of the lamp
    for x in xs: s.put(x, 2, S["lo"])    # the housing

def post(s, state, T=None, top=2):
    T = T or S
    for y in range(top, H): s.put(0, y, T["hi"]); s.put(1, y, T["lo"])
    for x in (0, 1, 2): s.put(x, H - 2, T["mid"]); s.put(x, H - 1, T["deep"])
    s.put(2, H - 2, T["lo"])
    for y in (8, 14, 20): s.put(0, y, S["mid"])   # a seam every six rows
    if state: lamp(s, 0, 2, state)

def wires(s, powered, rows=WIRES, x0=2, x1=W, sag=None, rust=False):
    # one pixel a wire: lit while it is live and tight, duller without power; every sixth pixel a shade darker, an insulator at the post
    for i, y in enumerate(rows):
        for x in range(x0, x1):
            d = sag(i, x) if sag else 0
            c = (S["hi"] if powered else S["mid"]) if x % 6 != 4 else (S["mid"] if powered else S["lo"])
            if rust and (x + i * 2) % 7 in (1, 2): c = R["mid"] if (x + i) % 2 else R["lo"]
            s.put(x, y + d, c)
        s.put(2, y, CREAM)
        s.put(2, y + 1, S["lo"])

def pristine(powered):
    s = Sec(); post(s, "on" if powered else "off"); wires(s, powered)
    for y in (3, 12): s.put(0, y, S["hi"])
    return s

def degrading(powered):
    # rust at the foot and in streaks on the post, the middle wire has slackened, wires pick up rust in dashes, one insulator is gone, the lamp is worn low
    s = Sec(); post(s, "dim" if powered else "off")
    sag = lambda i, x: round(2 * math.sin(math.pi * (x - 2) / 20)) if i == 2 else (1 if i == 3 and x > 14 else 0)
    wires(s, powered, sag=sag, rust=True)
    for y in range(17, H - 2): s.put(1, y, R["lo"])
    for y in (15, 18, 21, 23): s.put(0, y, R["mid"])
    s.put(0, 19, R["hi"]); s.put(0, 24, R["hi"]); s.put(1, 10, R["lo"]); s.put(1, 11, R["lo"])
    s.put(2, WIRES[3], S["lo"]); s.clear(2, WIRES[3] + 1)   # that insulator has come off
    return s

def broken():
    # the post is snapped off short and leans, its lamp smashed; the wires that were on it are cut, two hang from the far edge, the rest lie coiled on the ground
    s = Sec(); post(s, None, top=11)
    s.put(0, 10, S["lo"]); s.put(1, 9, S["deep"]); s.put(0, 9, R["mid"]); s.put(1, 10, R["lo"])
    for y in range(16, H - 2): s.put(1, y, R["lo"])
    for y in (14, 18, 22): s.put(0, y, R["mid"])
    # wires cut: the top ones are gone from this side, two lower ones trail off the post a few pixels and droop
    for i, y in ((3, WIRES[3]), (4, WIRES[4])):
        for x in range(2, 6 + i): s.put(x, y + (x - 2) // 3 + 3, S["mid"])
    for y in (WIRES[0], WIRES[1]):
        for x in range(2, 7): s.put(x, y + (x - 2) // 2, S["hi"] if x % 6 != 4 else S["mid"])
    s.put(2, WIRES[0], CREAM); s.put(2, WIRES[1], CREAM)
    # across the gap the wires hang from the far edge as the next section's post would, snapped and swinging
    for x, top in ((21, 8), (22, 3)):
        for y in range(top, 21 + (x - 21) * 2): s.put(x, y, S["hi"] if y % 5 else S["mid"])
    s.put(20, 21, S["lo"]); s.put(19, 22, S["lo"])
    # coils of cut wire on the ground: scribbled loops, with a rust-brown snapped end or two
    for x in range(6, 21):
        s.put(x, H - 1, S["deep"])
        s.put(x, H - 2 - (x % 3 == 0), S["hi"] if x % 2 else S["mid"])
        if x % 4 in (1, 2): s.put(x, H - 4 + (x % 3), S["lo"])
    for x, y in ((9, 21), (10, 20), (11, 21), (13, 20), (14, 19), (15, 20), (17, 21), (18, 20)): s.put(x, y, S["mid"])
    for x, y in ((8, 22), (12, 22), (16, 22)): s.put(x, y, S["hi"])
    s.put(10, 22, R["mid"]); s.put(15, 21, R["mid"]); s.put(9, 20, R["lo"]); s.put(19, 21, R["mid"])
    s.put(6, H - 3, R["mid"]); s.put(7, H - 4, S["hi"]); s.put(20, H - 3, R["lo"])
    return s

# ---- the keeper gate: posts at x 0..2 and 20..22, a double leaf between with a split at x 10/11
def gpost(s, x0, powered):
    for y in range(3, H - 1): s.put(x0, y, S["hi"]); s.put(x0 + 1, y, S["mid"]); s.put(x0 + 2, y, S["lo"])
    lamp(s, x0, 3, "on" if powered else "off")
    for x in (0, 1, 2): s.put(x0 + x, H - 1, S["deep"]); s.put(x0 + x, H - 2, S["mid"] if x < 2 else S["lo"])
    for y in (9, 15, 21): s.put(x0, y, S["hi"]); s.put(x0 + 1, y, S["lo"])

GROWS = (9, 13, 17)   # the three wires across each leaf
def gate(sc=1.0, powered=True):
    # sc is how far across the leaves still reach: 1 is shut, less is swung open
    s = Sec(); gpost(s, 0, powered); gpost(s, 20, powered)
    fl = lambda x: 3 + round((x - 3) * sc)      # left leaf, hinged at x 3
    fr = lambda x: 19 - round((19 - x) * sc)    # right leaf, hinged at x 19
    for y0 in (6, 21):
        for x in range(3, fl(10) + 1): s.put(x, y0, S["hi"]); s.put(x, y0 + 1, S["lo"])
        for x in range(fr(11), 20): s.put(x, y0, S["hi"]); s.put(x, y0 + 1, S["lo"])
    for y in range(6, 23):
        s.put(3, y, S["mid"]); s.put(fl(10), y, S["lo"]); s.put(fr(11), y, S["hi"]); s.put(19, y, S["lo"])
    for y in GROWS:
        for x in range(4, fl(10)): s.put(x, y, S["hi"] if powered else S["mid"])
        for x in range(fr(11) + 1, 19): s.put(x, y, S["hi"] if powered else S["mid"])
    for x, y in ((3, 8), (3, 19), (19, 8), (19, 19)): s.put(x, y, S["deep"])   # hinge pins
    if sc == 1.0:
        for x in (10, 11): s.put(x, 12, G["hi"]); s.put(x, 13, G["mid"]); s.put(x, 14, G["lo"])
        s.put(11, 13, G["deep"])
    return s

def named():
    out = {"pristine": pristine(True), "pristine-off": pristine(False), "degrading": degrading(True), "degrading-off": degrading(False), "broken": broken()}
    for off in (False, True):
        for f, sc in (("", 1.0), ("-1", .66), ("-2", .33), ("-3", .1)): out["gate" + ("-off" if off else "") + f] = gate(sc, not off)
    return out

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "sprites/fence"
    sheet_path = sys.argv[2] if len(sys.argv) > 2 else None
    os.makedirs(out, exist_ok=True)
    pics = named(); z, gap, cols = 12, 4, 5
    rows = (len(pics) + cols - 1) // cols
    sheet = Image.new("RGBA", ((cols * (W + gap) + gap) * z, (rows * (H + gap) + gap) * z), (176, 190, 150, 255))   # on a park-green ground
    for i, (name, sec) in enumerate(pics.items()):
        im = sec.img(); im.save(f"{out}/electric-{name}.png")
        sheet.alpha_composite(im.resize((W * z, H * z), Image.NEAREST), ((gap + (i % cols) * (W + gap)) * z, (gap + (i // cols) * (H + gap)) * z))
        print("electric-" + name, im.size)
    if sheet_path: sheet.save(sheet_path)
