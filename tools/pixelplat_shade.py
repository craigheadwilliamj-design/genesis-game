# Adds the flat-style shading and texture to the Plateosaurus (the rig's part pictures in sprites/plat/, and the strips sprites/plat.png and plat-walk.png)
# without touching its shapes or its colors: navy back, tan belly, teal rim light, cream claws, near side and (darker) far side.
# Every pixel keeps its place; only fills change, to a lighter or darker shade of the same hue (light from the top left): a lit edge along the back, neck and tail,
# the left edge of the legs, shadow under the body and down the right side, short dark dashes in rows on the back, light flecks between them, scutes on the belly.
# It reads shaded colors back to their base colors first, so running it twice gives the same pictures. Run it after tools/rigtogame.py (which writes flat parts):
#     python3 -I tools/pixelplat_shade.py [repo root]
# Parts turn with the animal, so a part is shaded in its own frame; limb parts (thigh, leg, forearm, foot) skip the lit-top rule because their tops sit under the body.
import os, sys, glob
from PIL import Image

NEAR = {"dark": (51, 36, 70), "belly": (185, 162, 81), "rim": (94, 134, 126), "cream": (212, 210, 156)}
FAR = {"dark": (37, 26, 50), "belly": (101, 89, 42), "rim": (76, 107, 101), "cream": (149, 148, 120)}
KEEP = {(68, 60, 28): "brow", (0, 0, 0): "black", (201, 198, 180): "glint"}   # the head's brow and mouth line, eye and eye shine: left as they are
HI = {"dark": 1.75, "belly": 1.15, "rim": 1.2, "cream": 1.0}
LO = {"dark": .74, "belly": .82, "rim": .84, "cream": .86}

def mul(c, f): return tuple(max(0, min(255, round(v * f))) for v in c)

# color -> (side, role, level), level 0 base, 1 lit, -1 shaded; a shade that lands on another color would make the read-back ambiguous, so that stops the script
COLORS = {}
for side, pal in (("near", NEAR), ("far", FAR)):
    for role, c in pal.items():
        for lvl, col in ((0, c), (1, mul(c, HI[role])), (-1, mul(c, LO[role]))):
            if col == c and lvl: continue   # cream has no lit shade
            assert col not in COLORS, f"{side} {role} {lvl} {col} collides with {COLORS[col]}"
            COLORS[col] = (side, role, lvl)

H = lambda x, y, m: (x * 7 + y * 13 + (x * y) % 5) % m   # a fixed scatter by position, so the texture sits still

def shade(grid, sides, limb):
    h, w = len(grid), len(grid[0]); g = lambda x, y: grid[y][x] if 0 <= x < w and 0 <= y < h else None
    out = [row[:] for row in grid]
    for y in range(h):
        for x in range(w):
            c = grid[y][x]
            if c in (None, "brow", "black", "glint"): continue
            up, dn, lf, rt = g(x, y - 1), g(x, y + 1), g(x - 1, y), g(x + 1, y); n = 0
            if c == "dark":
                if lf is None and H(x, y, 3) != 0: n = 1                                               # the left edge catches the light
                elif not limb and up in (None, "rim") and H(x, y, 4) != 0: n = 1                       # a lit edge along the back, neck and tail, broken up
                elif up == "rim" and H(x, y, 3) == 0: n = 1
                elif rt is None and H(x, y, 3) != 0: n = -1                                            # the right side is in shade
                elif dn in (None, "belly") and (x + y) % 2 == 0: n = -1                                # shadow where the body turns under, dithered
                elif not limb and y % 3 == 0 and (x + (y // 3) * 3) % 7 in (0, 1) and up == "dark" and dn == "dark": n = -1      # rows of short dark dashes, staggered
                elif not limb and y % 3 == 1 and (x + (y // 3) * 3 + 3) % 7 == 0 and up in ("dark",) and dn == "dark": n = 1      # and a light fleck between the rows
                elif limb and y % 3 == 1 and (x + y) % 4 == 0 and lf == "dark" and rt == "dark": n = -1                           # a crease or two on the legs
            elif c == "belly":
                if dn is None: n = -1                                                                  # the underside is in shadow
                elif x % 4 == 1 and up == "dark": n = 1                                                # belly scutes: short light dashes along the line
                elif up is None and not limb and x % 3 == 0: n = 1
                elif lf is None and limb and H(x, y, 2) == 0: n = 1
                elif y % 2 == 0 and x % 5 == 2 and up == "belly" and dn == "belly": n = -1             # and a faint groove or two
            elif c == "rim":
                if up is None and lf != "rim" and H(x, y, 2) == 0: n = 1                           # the brightest bit of the rim
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
    out = shade(grid, sides, limb); n = 0
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
                col = pal[role] if lvl == 0 else mul(pal[role], HI[role] if lvl > 0 else LO[role])
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
