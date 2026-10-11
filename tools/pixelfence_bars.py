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
    s = base(post_cap=False); S = STEEL; R = RUST
    # post: snapped cap leaves a ragged top, steel mostly kept, rust only at the foot and in a few flakes
    s.put(0, 1, S["lo"]); s.clear(1, 1); s.put(1, 2, S["deep"])
    for y in range(12, H - 2): s.put(1, y, R["lo"])
    for y in (14, 16): s.put(0, y, R["mid"])
    s.put(0, 15, R["hi"]); s.put(0, 7, R["mid"]); s.put(1, 8, R["lo"])
    s.put(2, H - 2, R["deep"]); s.clear(2, H - 1)
    # left bar snapped off at the middle: a short stub above the top rail, then a gap, then the lower half with a torn end
    for y in range(4, 9): s.clear(3, y)
    s.put(3, 9, R["lo"]); s.put(3, 10, S["mid"]); s.put(3, 12, R["mid"]); s.put(3, 15, R["mid"])
    # right bar bent out of line: pushed over a pixel through the middle, and a gap where it has sheared at the top
    for y in range(1, 4): s.clear(6, y)
    s.put(6, 4, R["lo"])
    for y in (7, 8, 9, 10): s.clear(6, y); s.put(7, y, S["lo"])
    s.put(7, 7, S["mid"]); s.put(7, 10, R["mid"]); s.put(6, 11, R["lo"]); s.put(6, 5, S["mid"]); s.put(6, 6, S["mid"])
    s.put(6, 14, R["mid"]); s.put(6, 17, R["mid"])
    # top rail: torn through the middle, the right end drooping on its last bar
    for x in (4, 5): s.clear(x, 2); s.clear(x, 3)
    s.put(4, 3, R["lo"]); s.put(4, 4, R["deep"])
    s.put(3, 2, R["mid"]); s.put(3, 3, R["lo"])
    for x in (6, 7): s.clear(x, 2); s.clear(x, 3)
    s.put(6, 4, S["hi"]); s.put(7, 4, S["hi"]); s.put(6, 5, S["lo"]); s.put(7, 5, R["lo"])
    # bottom rail: bent down at the right and eaten through at one pixel
    s.put(7, 15, R["mid"]); s.put(7, 16, R["lo"]); s.clear(5, 15); s.put(5, 16, R["deep"]); s.put(4, 16, R["mid"])
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
