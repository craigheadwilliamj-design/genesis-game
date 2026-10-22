# Adds the flat-style shading and texture to the Plateosaurus (the rig's part pictures in sprites/plat/, and the strips sprites/plat.png and plat-walk.png)
# without touching its shapes: violet back (lifted from the rig's near-black navy), tan belly, teal rim light, cream claws, near side and (darker) far side.
# Every pixel keeps its place; only fills change, to a lighter or darker shade of the same hue (light from the top left): a solid lit edge along the back, neck and tail
# and down the left edges, solid shadow under the body and down the right side, staggered rows of short dark dashes on the back, scutes on the belly. No scatter.
# It reads shaded colors back to their base colors first, so running it twice gives the same pictures. Run it after tools/rigtogame.py (which writes flat parts):
#     python3 -I tools/pixelplat_shade.py [repo root]
# Parts turn with the animal, so a part is shaded in its own frame; limb parts (thigh, leg, forearm, foot) skip the lit-top rule because their tops sit under the body.
import os, sys, glob
from PIL import Image

# Base, lit and shaded fill of each color, near side and (darker) far side. The navy is a mid violet, so the back reads as a color on the ground, not a hole.
NEAR = {"dark": ((72, 54, 100), (90, 70, 122), (56, 41, 79)), "belly": ((185, 162, 81), (213, 186, 93), (152, 133, 66)),
        "rim": ((94, 134, 126), (113, 161, 151), (79, 113, 106)), "cream": ((212, 210, 156), None, (182, 181, 134))}
FAR = {"dark": ((52, 39, 74), (64, 49, 90), (41, 30, 58)), "belly": ((101, 89, 42), (116, 102, 48), (83, 73, 34)),
       "rim": ((76, 107, 101), (91, 128, 121), (64, 90, 85)), "cream": ((149, 148, 120), None, (128, 127, 103))}
KEEP = {(68, 60, 28): "brow", (0, 0, 0): "black", (201, 198, 180): "glint"}   # the head's brow and mouth line, eye and eye shine: left as they are
# The rig project's navy and its old high-contrast shades read back as the dark too (rigtogame.py writes parts in it)
SRC_DARK = {"near": ((51, 36, 70), (89, 63, 122), (38, 27, 52)), "far": ((37, 26, 50), (65, 46, 88), (27, 19, 37))}

# color -> (side, role, level), level 0 base, 1 lit, -1 shaded; a shade that lands on another color would make the read-back ambiguous, so that stops the script
COLORS = {}
def add(col, v):
    if col is None: return
    assert col not in COLORS or COLORS[col] == v, f"{v} {col} collides with {COLORS[col]}"
    COLORS[col] = v
for side, pal in (("near", NEAR), ("far", FAR)):
    for role, cs in pal.items():
        for lvl, col in zip((0, 1, -1), cs): add(col, (side, role, lvl))
    for lvl, col in zip((0, 1, -1), SRC_DARK[side]): add(col, (side, "dark", lvl))

def shade(grid, limb):
    h, w = len(grid), len(grid[0]); g = lambda x, y: grid[y][x] if 0 <= x < w and 0 <= y < h else None
    out = [row[:] for row in grid]
    for y in range(h):
        for x in range(w):
            c = grid[y][x]
            if c in (None, "brow", "black", "glint"): continue
            up, dn, lf, rt = g(x, y - 1), g(x, y + 1), g(x - 1, y), g(x + 1, y); n = 0
            if c == "dark":
                if not limb and up in (None, "rim"): n = 1                                             # a lit edge along the back, neck and tail
                elif lf is None: n = 1                                                                 # the left edge catches the light
                elif rt is None or dn in (None, "belly"): n = -1                                       # the right side and where the body turns under are in shade
                elif not limb and y % 3 == 2 and (x + y // 3 * 3) % 6 in (0, 1) and up == "dark" and dn == "dark": n = -1   # rows of short dashes, staggered: scale rows
                elif limb and y % 4 == 2 and lf == "dark" and rt == "dark": n = -1                     # a crease now and then down the legs
            elif c == "belly":
                if dn is None: n = -1                                                                  # the underside is in shadow
                elif x % 4 == 1 and up == "dark": n = 1                                                # belly scutes: short light dashes along the line
                elif lf is None and limb: n = 1                                                        # the front of the legs is lit
            elif c == "rim":
                if up is None and lf != "rim": n = 1                                                   # the rim's leading pixel catches the light
                elif dn is None or rt is None: n = -1
            elif c == "cream":
                if dn is None: n = -1                                                                  # claws dim at the tip
            if n: out[y][x] = (c, n)
    return out

def process(path, limb):
    im = Image.open(path).convert("RGBA"); w, h = im.size; px = im.load()
    grid, sides = [], {}
    for y in range(h):
        row = []
        for x in range(w):
            r, g_, b, a = px[x, y]
            if a < 128: row.append(None); continue
            col = (r, g_, b)
            if col in KEEP: row.append(KEEP[col]); continue
            if col not in COLORS: sys.exit(f"{path}: unknown color {col} at {x},{y}")
            side, role, _ = COLORS[col]; sides[(x, y)] = side; row.append(role)
        grid.append(row)
    out = shade(grid, limb); n = 0
    # which side a pixel is on comes from the picture, so a far limb stays its darker set
    base = {v: k for k, v in KEEP.items()}
    for y in range(h):
        for x in range(w):
            c = out[y][x]
            if c is None: continue
            if isinstance(c, tuple): role, lvl = c
            else: role, lvl = c, 0
            if role in base: col = base[role]
            else:
                pal = NEAR if sides[(x, y)] == "near" else FAR
                col = pal[role][{0: 0, 1: 1, -1: 2}[lvl]]
            if px[x, y][:3] != col: n += 1
            px[x, y] = col + (255,)
    im.save(path, optimize=True)
    return n

if __name__ == "__main__":
    root = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
    for f in sorted(glob.glob(os.path.join(root, "sprites", "plat", "*.png"))):
        if "jaw" in f: continue   # a one-pixel line, left as drawn
        limb = any(k in os.path.basename(f) for k in ("thigh", "leg", "forearm", "foot"))
        print(os.path.basename(f), process(f, limb), "pixels changed")
    for f in ("plat.png", "plat-walk.png"):
        p = os.path.join(root, "sprites", f)
        if os.path.exists(p): print(f, process(p, False), "pixels changed")
