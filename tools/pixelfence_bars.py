# Draws the metal bar fence as three 3 m sections in the Dimetrodon's flat style: pristine, degrading (rust in streaks, one bar sagging) and broken (a trampled hole: the middle flattened into the dirt).
# Pixels are 0.13 m (ROCK_MPP), so a 3 m section is 23 px wide and the 2.6 m fence (FENCE34.bars.h) is 20 px tall, side-on, the post on the left edge so sections tile end to end.
# Flat fills, no outline, light from the top left: a lit left edge and top, shadow under rails and on the right of the post.
# Usage: python3 -I tools/pixelfence_bars.py [outdir] [sheet.png]   (default sprites/fence; the optional sheet is a x16 view of one section a state with a gap between)
import sys, os
from PIL import Image

W, H = 23, 20
BARS = (4, 8, 12, 16, 20)   # five bars, 4 px apart, two clear of each post
TOP, BOT = 2, 15            # rail rows (each rail is two rows: lit, then shaded)
def mix(a, b, t): return tuple(round(x * (1 - t) + y * t) for x, y in zip(a, b))
def ramp(base): return {"hi": mix(base, (255, 255, 255), .28), "mid": base, "lo": mix(base, (0, 0, 0), .24), "deep": mix(base, (0, 0, 0), .42)}
STEEL = ramp((126, 133, 140))   # FENCE34.bars colour #7E858C
RUST = ramp((178, 78, 0))       # the Dimetrodon's rust orange
S, R = STEEL, RUST

class Sec:
    def __init__(s): s.px = {}
    def put(s, x, y, c):
        if 0 <= x < W and 0 <= y < H: s.px[(x, y)] = c
    def clear(s, x, y): s.px.pop((x, y), None)
    def img(s):
        im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        for (x, y), c in s.px.items(): im.putpixel((x, y), c + (255,))
        return im

def post(s, cap=True):
    # two wide, lit on the left, in shade on the right, on a small footing
    for y in range(1, H): s.put(0, y, S["hi"]); s.put(1, y, S["lo"])
    if cap: s.put(0, 0, S["hi"]); s.put(1, 0, S["mid"])
    for x in (0, 1, 2): s.put(x, H - 2, S["mid"]); s.put(x, H - 1, S["deep"])
    s.put(2, H - 2, S["lo"])

def base():
    s = Sec(); post(s)
    # bars with a lit spear tip, from the footing rail to above the top rail
    for x in BARS:
        for y in range(1, 18): s.put(x, y, S["mid"])
        s.put(x, 1, S["hi"])
    # rails: lit top row, shaded row under, running to where the next post will start
    for y0 in (TOP, BOT):
        for x in range(2, W): s.put(x, y0, S["hi"]); s.put(x, y0 + 1, S["lo"])
    return s

def pristine():
    s = base()
    # a glint on each bar at a steady rhythm, so it reads as steel
    for i, x in enumerate(BARS):
        y = 6 + (i % 2) * 3
        s.put(x, y, S["hi"]); s.put(x, y + 5, S["hi"])
    s.put(0, 6, S["hi"]); s.put(0, 12, S["hi"]); s.put(1, 4, S["mid"])
    return s

def degrading():
    s = base()
    # rust runs down from each rail join as a short streak, and thickens toward the ground
    for x in BARS:
        for y in (4, 5, 6): s.put(x, y, R["mid"] if y != 5 else R["lo"])          # under the top rail
        for y in range(11, 15):
            if (x // 4 + y) % 3: s.put(x, y, R["mid"] if y % 2 else R["lo"])     # up from the lower rail
        for y in (17,): s.put(x, y, R["lo"])
    s.put(4, 1, R["mid"]); s.put(12, 1, R["mid"]); s.put(20, 1, R["mid"])
    # rails pick up rust in dashes: a row of short stains, then clean steel
    for x in range(2, W):
        if x % 4 in (1, 2): s.put(x, TOP + 1, R["lo"]); s.put(x, BOT, R["mid"])
        if x % 5 == 0: s.put(x, TOP, R["mid"])
        if x % 3 == 0: s.put(x, BOT + 1, R["deep"])
    # post: rust at the foot, flaking up the shaded side
    for y in range(10, H - 2): s.put(1, y, R["lo"])
    for y in (13, 15, 17): s.put(0, y, R["mid"])
    s.put(0, 14, R["hi"]); s.put(0, 16, R["hi"]); s.put(1, H - 2, R["mid"]); s.put(2, H - 2, R["lo"])
    # the middle bar has sagged: shoved over a pixel through the middle of its length
    for y in (7, 8, 9, 10): s.clear(12, y); s.put(13, y, S["lo"] if y % 2 else R["lo"])
    return s

def broken():
    # a hole an animal went through, or a fence left at 0%: the middle is flattened, with nothing upright between the two end bars
    s = Sec(); post(s, cap=False)
    # post: cap sheared off, rusted at the foot
    s.put(0, 1, S["lo"]); s.put(1, 3, S["deep"]); s.put(0, 6, R["mid"]); s.put(1, 7, R["lo"])
    for y in range(12, H - 2): s.put(1, y, R["lo"])
    for y in (14, 17): s.put(0, y, R["mid"])
    s.put(0, 15, R["hi"])
    # the end bars next to the post stay up, torn off short
    for y in range(4, 18): s.put(4, y, S["mid"] if y % 4 else R["mid"])
    for y in range(3, 18): s.put(20, y, S["mid"] if y % 4 else R["mid"])
    s.put(4, 4, S["hi"]); s.put(5, 3, S["lo"]); s.put(20, 3, S["hi"]); s.put(19, 2, S["lo"])
    # top rail: torn off in the middle, each end hanging from its bar and drooping toward the ground
    for x in (2, 3, 4, 5): s.put(x, TOP, S["hi"]); s.put(x, TOP + 1, S["lo"])
    s.put(6, TOP + 1, R["lo"]); s.put(7, TOP + 2, R["mid"]); s.put(7, TOP + 3, R["deep"]); s.put(6, TOP + 2, R["deep"])
    for x in (19, 20, 21, 22): s.put(x, TOP + 1, S["hi"]); s.put(x, TOP + 2, S["lo"])
    s.put(18, TOP + 2, R["lo"]); s.put(17, TOP + 3, R["mid"]); s.put(17, TOP + 4, R["deep"]); s.put(18, TOP + 3, R["deep"])
    # bottom rail: kept at the ends, bent down and out through the middle
    for x in (2, 3, 4, 5): s.put(x, BOT, R["mid"] if x % 2 else S["hi"]); s.put(x, BOT + 1, S["lo"])
    for x in (18, 19, 20, 21, 22): s.put(x, BOT, R["mid"] if x % 2 else S["hi"]); s.put(x, BOT + 1, S["lo"])
    # the heap: bars and rails trodden flat into the dirt across the gap, a few ends sticking up, rust on the broken edges
    for x in range(6, 18): s.put(x, 19, S["deep"])
    for x, y in ((6, 16), (7, 17), (8, 16), (9, 17), (10, 15), (11, 16), (12, 17), (13, 16), (14, 15), (15, 16), (16, 17), (17, 16)): s.put(x, y, S["hi"])
    for x, y in ((6, 17), (7, 18), (8, 17), (9, 18), (10, 16), (11, 17), (12, 18), (13, 17), (14, 16), (15, 17), (16, 18), (17, 17)): s.put(x, y, S["lo"])
    for x, y in ((8, 18), (11, 18), (13, 18), (16, 19), (6, 18), (15, 18)): s.put(x, y, R["mid"])
    for x, y in ((9, 16), (12, 16), (7, 16), (15, 15), (10, 17), (14, 17)): s.put(x, y, R["mid"] if (x + y) % 2 else R["lo"])
    for x, y in ((10, 14), (14, 14), (7, 15)): s.put(x, y, S["hi"])
    s.put(10, 15, R["lo"]); s.put(14, 15, R["lo"])
    return s

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "sprites/fence"
    sheet_path = sys.argv[2] if len(sys.argv) > 2 else None
    os.makedirs(out, exist_ok=True)
    states = {"pristine": pristine(), "degrading": degrading(), "broken": broken()}
    z, gap = 16, 4
    sheet = Image.new("RGBA", ((len(states) * (W + gap) + gap) * z, (H + gap) * z), (176, 190, 150, 255))   # on a park-green ground
    for i, (name, sec) in enumerate(states.items()):
        im = sec.img(); im.save(f"{out}/bars-{name}.png")
        sheet.alpha_composite(im.resize((W * z, H * z), Image.NEAREST), ((gap + i * (W + gap)) * z, gap // 2 * z))
        print(name, im.size)
    if sheet_path: sheet.save(sheet_path)
