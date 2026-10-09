# Builds the Lystrosaurus idle strip (sprites/lyst-idle.png, 12 frames of 100x75 side by side) from hand-posed reference pictures, tools/lyst-idle/2.webp to 6.webp:
# frame 1 is the standing picture (sprites/lyst.png), 2 to 6 are the sniff and paw poses (head down, foreleg reaching and planting), and 7 to 12 play them back down to standing, so it loops.
# Each reference is a big picture on a 13.55 px grid, 75 rows tall, with soft edges at the new joints. Every cell is sampled to one color, snapped to the sprite's palette,
# shaded with pixellyst_shade.py's rules (lined up with the standing picture, so the thigh and shoulder creases fall in the same places), then the whole animal is moved SHIFT pixels left
# so the lowered snout stays inside the 100 px frame (the standing picture's snout stops at x 98, the poses reach x 101). Run pixellyst_shade.py first. Usage: python3 -I tools/pixellyst_idle.py [dir]
import sys, os, importlib.util
from collections import Counter
from PIL import Image
W, H = 100, 75
P, OX, OY = 13.55, 13.25, 13.5   # the references' pixel size and where the grid starts
OFF, SHIFT = 22, 2               # grid column of the standing picture's x 0, and the move left
ORDER = [0, 1, 2, 3, 4, 5, 5, 4, 3, 2, 1, 0]   # 0 is standing, 1 to 5 are references 2 to 6
PAL = [(115, 110, 32), (67, 65, 20), (89, 27, 27), (217, 189, 53), (167, 149, 48), (0, 0, 0), (235, 227, 136), (241, 236, 167), (177, 133, 14), (139, 139, 96)]
here = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("lystshade", os.path.join(here, "pixellyst_shade.py")); ls = importlib.util.module_from_spec(spec); spec.loader.exec_module(ls)
BASE = {v: k for k, v in ls.BASE.items()}; ALLC = {**ls.BASE, **ls.SHADE}

def cells(path):
    im = Image.open(path).convert("RGBA"); px = im.load(); w, h = im.size; cols, rows = int((w - OX) // P) + 1, int((h - OY) // P) + 1; out = {}
    for r in range(rows):
        for c in range(cols):
            x0, y0 = OX + c * P, OY + r * P; cnt = Counter()
            for y in range(int(y0 + P * .2), int(y0 + P * .8)):
                for x in range(int(x0 + P * .2), int(x0 + P * .8)):
                    if 0 <= x < w and 0 <= y < h: p = px[x, y]; cnt[p if p[3] >= 128 else None] += 1
            top = cnt.most_common(1)[0][0] if cnt else None
            if top: out[c, r] = min(PAL, key=lambda k: sum((a - b) ** 2 for a, b in zip(top, k)))
    return out

def pose(path):
    cl = cells(path); wd = W + SHIFT + 8; grid = [[None] * wd for _ in range(H)]
    for (c, r), q in cl.items():
        x = c - OFF
        if 0 <= x < wd and r < H: grid[r][x] = "belly" if q == (167, 149, 48) else BASE[q]
    res, _ = ls.shade(grid); out = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for y in range(H):
        for x in range(wd):
            if res[y][x]:
                assert 0 <= x - SHIFT < W, (path, x, y, "the animal leaves the frame")
                out.putpixel((x - SHIFT, y), ALLC[res[y][x]] + (255,))
    return out

def main(d):
    frames = [Image.open(f"{d}/lyst.png").convert("RGBA")] + [pose(os.path.join(here, "lyst-idle", f"{n}.webp")) for n in range(2, 7)]
    strip = Image.new("RGBA", (W * len(ORDER), H), (0, 0, 0, 0))
    for i, k in enumerate(ORDER): strip.paste(frames[k], (i * W, 0))
    strip.save(f"{d}/lyst-idle.png"); print(f"{d}/lyst-idle.png", len(ORDER), "frames")

main(sys.argv[1] if len(sys.argv) > 1 else "sprites")
