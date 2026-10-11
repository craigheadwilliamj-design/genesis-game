# Draws the metal bar fence as three 1 m sections in the Dimetrodon's flat style: pristine, degrading (rusting, one bar bent) and broken (bars snapped, rail torn, post cap gone).
# Pixels are 0.13 m (ROCK_MPP), so a 1 m section is 8 px wide and the 2.6 m fence (FENCE34.bars.h) is 20 px tall, side-on, the post on the left edge so sections tile end to end.
# Flat fills, no outline, light from the top left: a lit left edge and top, shadow under rails and on the right of the post.
# Usage: python3 -I tools/pixelfence_bars.py [outdir]   (default sprites/fence; optional 2nd arg: where to write a x8 contact sheet, default outdir/bars-sheet.png)
import sys, os
from PIL import Image

W, H = 8, 20
def mix(a, b, t): return tuple(round(x * (1 - t) + y * t) for x, y in zip(a, b))
def ramp(base): return {"hi": mix(base, (255, 255, 255), .28), "mid": base, "lo": mix(base, (0, 0, 0), .24), "deep": mix(base, (0, 0, 0), .42)}
STEEL = ramp((126, 133, 140))   # FENCE34.bars colour #7E858C
RUST = ramp((178, 78, 0))       # the Dimetrodon's rust orange
BARE = ramp((112, 82, 62))      # rust gone dark where it has eaten in

class Sec:
    def __init__(s): s.px = {}
    def put(s, x, y, c):
        if 0 <= x < W and 0 <= y < H: s.px[(x, y)] = c
    def clear(s, x, y): s.px.pop((x, y), None)
    def img(s):
        im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        for (x, y), c in s.px.items(): im.putpixel((x, y), c + (255,))
        return im

def base(post_cap=True):
    s = Sec(); S = STEEL
    # post: two wide, lit on the left, in shade on the right, on a small footing
    for y in range(1, H):
        s.put(0, y, S["hi"]); s.put(1, y, S["lo"])
    if post_cap: s.put(0, 0, S["hi"]); s.put(1, 0, S["mid"])
    for x in (0, 1, 2): s.put(x, H - 2, S["mid"]); s.put(x, H - 1, S["deep"])
    s.put(2, H - 2, S["lo"])
    # bars at x3 and x6 with a lit spear tip, running from the footing rail to above the top rail
    for x in (3, 6):
        for y in range(1, 18): s.put(x, y, S["mid"])
        s.put(x, 1, S["hi"])
    # rails: lit top row, shaded row under
    for y0 in (2, 15):
        for x in range(2, W): s.put(x, y0, S["hi"]); s.put(x, y0 + 1, S["lo"])
    for x in (3, 6): s.put(x, 2, S["mid"]) if False else None
    return s

def pristine():
    s = base()
    # a short glint on each bar, in the same place, so it reads as steel
    for x in (3, 6): s.put(x, 6, STEEL["hi"]); s.put(x, 11, STEEL["hi"])
    s.put(0, 6, STEEL["hi"]); s.put(1, 4, STEEL["mid"])
    return s

def degrading():
    s = base(); S = STEEL; R = RUST
    # rust creeps up from the footing and sits at the rail joins; the hi pixels are gone where it has taken
    for y in range(11, H - 2): s.put(1, y, R["lo"])
    for y in (13, 15, 17): s.put(0, y, R["mid"])
    s.put(0, 14, R["hi"]); s.put(0, 16, R["hi"]); s.put(2, H - 2, R["lo"]); s.put(1, H - 2, R["mid"])
    for x, ys in ((3, (4, 5, 9, 13, 14, 17)), (6, (3, 7, 8, 12, 16, 17))):
        for y in ys: s.put(x, y, R["mid"])
        s.put(x, ys[0], R["hi"] if False else R["mid"])
    for x in (2, 4, 7): s.put(x, 15, R["mid"]); s.put(x, 16, R["lo"])
    s.put(5, 2, R["mid"]); s.put(7, 3, R["lo"]); s.put(4, 16, R["deep"])
    s.put(5, 16, R["mid"]); s.put(2, 3, R["lo"])
    # the right bar has sagged: its middle is shoved one pixel over
    for y in (8, 9, 10): s.clear(6, y); s.put(7, y, S["lo"])
    s.put(7, 8, R["mid"]); s.put(7, 10, R["mid"])
    s.put(3, 1, R["mid"]); s.put(6, 1, S["hi"])
    return s

def broken():
    # a hole an animal went through, or a fence left at 0%: the middle is flattened, no upright bars, everything trampled into the dirt
    S = STEEL; R = RUST; s = Sec()
    # post still stands, cap sheared off, rusted at the foot
    for y in range(2, H): s.put(0, y, S["hi"]); s.put(1, y, S["lo"])
    s.put(0, 1, S["lo"]); s.put(1, 3, S["deep"]); s.put(0, 6, R["mid"]); s.put(1, 7, R["lo"])
    for y in (12, 13, 14, 15, 16): s.put(1, y, R["lo"])
    s.put(0, 14, R["mid"]); s.put(0, 15, R["hi"]); s.put(0, 17, R["mid"])
    for x in (0, 1, 2): s.put(x, H - 2, S["mid"]); s.put(x, H - 1, S["deep"])
    s.put(2, H - 2, R["lo"])
    # top rail torn off and hanging from the post by its end, drooping down its side
    s.put(2, 2, S["hi"]); s.put(2, 3, S["lo"]); s.put(2, 4, R["mid"]); s.put(2, 5, R["lo"]); s.put(2, 6, R["deep"])
    # the rest lies flat on the ground: bars and rails bent over and pressed into a low heap, nothing standing above y15
    for x, y in ((3, 17), (4, 16), (5, 17), (6, 16), (7, 17)): s.put(x, y, S["hi"])
    for x, y in ((3, 18), (4, 17), (5, 18), (6, 17), (7, 18)): s.put(x, y, S["lo"])
    for x, y in ((3, 16), (5, 16), (7, 16)): s.put(x, y, R["mid"])
    for x, y in ((4, 18), (6, 18)): s.put(x, y, R["mid"])
    for x in (4, 5, 6, 7): s.put(x, 19, S["deep"])
    s.put(3, 19, R["deep"]); s.put(2, 17, R["lo"]); s.put(7, 15, R["lo"]); s.put(4, 15, R["deep"])
    return s

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "sprites/fence"
    sheet_path = sys.argv[2] if len(sys.argv) > 2 else f"{out}/bars-sheet.png"
    os.makedirs(out, exist_ok=True)
    states = {"pristine": pristine(), "degrading": degrading(), "broken": broken()}
    sheet = Image.new("RGBA", ((3 * (W * 4 + 1) + 1) * 8, (H + 2) * 8), (176, 190, 150, 255))   # on a park-green ground
    x0 = 1
    for name, sec in states.items():
        im = sec.img(); im.save(f"{out}/bars-{name}.png")
        # each state shown as four sections side by side so the tiling shows
        for k in range(4): sheet.alpha_composite(im.resize((W * 8, H * 8), Image.NEAREST), ((x0 + k * W) * 8, 8))
        x0 += W * 4 + 1
        print(name, im.size)
    sheet.save(sheet_path)
