#!/usr/bin/env python3
"""Shade and texture the Sacabambaspis (sprites/saca.png, the flat picture drawn in the pixel editor) in place, keeping every pixel where it is:
a lit top edge and shaded underside, the head shield's front edge lit against the seam with the trunk shaded under its rear rim, rows of
raised tubercles on the shield, staggered rows of scale dashes on the trunk, rays on the tail fin and plate rows on the pale belly.
It reads its own shades back to the flat colors first, so running it twice gives the same result.
    python3 -I tools/pixelsaca_shade.py   then   python3 tools/rigger/sacabambaspis/gen-rig.py
    and   python3 tools/rigtogame.py tools/rigger/sacabambaspis/sacabambaspis-rig.json saca --walk swim --stand hover --idle flick"""
import os
from PIL import Image
path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "sprites", "saca.png")
im = Image.open(path).convert("RGBA"); W, H = im.size

# ramps: (lit, base, shade); the deep olive is the fin and the shield seam
BODY = ((172, 156, 70), (150, 134, 54), (126, 112, 44))
FIN = ((126, 112, 46), (106, 94, 38), (88, 78, 32))
BELLY = ((212, 216, 134), (193, 199, 107), (170, 177, 86))
RAMPS = (BODY, FIN, BELLY)
back = {c: r[1] for r in RAMPS for c in r}   # any shade back to its flat color
px = im.load()
for y in range(H):
    for x in range(W):
        c = px[x, y]
        if c[3] and c[:3] in back: px[x, y] = (*back[c[:3]], 255)
flat = im.copy(); f = flat.load()
col = lambda x, y: f[x, y][:3] if 0 <= x < W and 0 <= y < H and f[x, y][3] >= 128 else None
solid = lambda x, y: col(x, y) is not None
put = lambda x, y, r, i: px.__setitem__((x, y), (*r[i], 255))

# the seam between head shield and trunk: in each row, the rightmost deep-olive pixel that has body color on both sides of its run
seam = {}
for y in range(H):
    for x in range(W - 1, 0, -1):
        if col(x, y) == FIN[1] and col(x + 1, y) == BODY[1]:
            l = x
            while col(l - 1, y) == FIN[1]: l -= 1
            if col(l - 1, y) == BODY[1]: seam[y] = (l, x)
            break
shield = lambda x, y: y in seam and x > seam[y][1]

for y in range(H):
    for x in range(W):
        c = col(x, y)
        if c == BODY[1]:
            if not solid(x, y - 1): put(x, y, BODY, 0); continue   # the back catches the light
            if not solid(x, y + 1) or not solid(x + 1, y): put(x, y, BODY, 2); continue
            if shield(x, y):
                if x == seam[y][1] + 1: put(x, y, BODY, 0)   # the shield's front edge faces the light
                elif col(x, y + 1) != BODY[1] and col(x, y + 1) is not None: put(x, y, BODY, 2)   # its lower rim over the gill plates
                else:   # raised tubercles in staggered rows: lit on top, shaded under
                    k = (y - 31) % 4
                    if k == 0 and (x + (y // 4) * 2) % 4 == 0: put(x, y, BODY, 0)
                    elif k == 1 and (x + ((y - 1) // 4) * 2) % 4 == 0 and col(x, y - 1) == BODY[1]: put(x, y, BODY, 2)
            else:
                if y in seam and x == seam[y][0] - 1: put(x, y, BODY, 2); continue   # the trunk under the shield's rear rim
                # staggered rows of scale dashes running back, each lit on its leading pixel
                k = (y - 33) % 3; row = (y - 33) // 3
                if k == 0 and solid(x, y - 2) and solid(x, y + 2):
                    p = (x + row * 3) % 6
                    if p in (0, 1): put(x, y, BODY, 2)
                    elif p == 2: put(x, y, BODY, 0)
        elif c == FIN[1] and not (y in seam and seam[y][0] <= x <= seam[y][1]):
            if not solid(x, y - 1): put(x, y, FIN, 0); continue
            if not solid(x, y + 1) or not solid(x - 1, y): put(x, y, FIN, 2); continue
            # rays: shaded streaks running back along each lobe, every third row out from the stalk
            if abs(y - 39) % 3 == 0 and solid(x - 2, y) and col(x + 1, y) == FIN[1]: put(x, y, FIN, 2)
        elif c == BELLY[1]:
            if not solid(x, y + 1) or not solid(x + 1, y): put(x, y, BELLY, 2); continue
            k = (y - 46) % 3; row = (y - 46) // 3   # rows of ventral plates
            if k == 0 and y > 45 and solid(x, y + 1) and (x + row * 2) % 5 in (0, 1): put(x, y, BELLY, 2)
im.save(path)
