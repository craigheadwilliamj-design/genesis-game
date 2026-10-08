# Draws the large Permian scrubland plant (Callistophyton, a thin scrambling stem with drooping seed-fern fronds) in the Dimetrodon's flat, simple style:
# flat fills, a small palette, stair-stepped shapes, no outline, a lit top-left edge, shaded undersides, a lighter rib down each frond and small grooves for the pinnae.
# Writes sprites/plants/per-scrubland-large.png (same 72x96 canvas as before). Usage: python3 -I tools/pixelplant_flat.py [out.png]
import sys, math
from PIL import Image

W, H = 72, 96
C = {"stem": (96, 64, 34), "stemhi": (128, 90, 50), "stemlo": (66, 44, 24),
     "leaf": (97, 111, 34), "leafhi": (123, 139, 48), "leaflo": (67, 75, 22), "rib": (166, 178, 88)}   # the leaf greens are the Dimetrodon's olive family
grid = [[None] * W for _ in range(H)]
def put(x, y, c):
    x, y = int(round(x)), int(round(y))
    if 0 <= x < W and 0 <= y < H: grid[y][x] = c
def get(x, y): return grid[y][x] if 0 <= x < W and 0 <= y < H else None
def bez(p0, p1, p2, t): return tuple((1 - t) ** 2 * a + 2 * (1 - t) * t * b + t * t * c for a, b, c in zip(p0, p1, p2))
def tangent(p0, p1, p2, t): return tuple(2 * (1 - t) * (b - a) + 2 * t * (c - b) for a, b, c in zip(p0, p1, p2))

# the stem: a gently wandering line, thicker at the foot
S = [(30, 93), (28, 82), (33, 70), (38, 58), (35, 46), (40, 34), (44, 22), (42, 11)]
for i in range(len(S) - 1):
    (x0, y0), (x1, y1) = S[i], S[i + 1]; n = int(max(abs(x1 - x0), abs(y1 - y0)) * 2)
    for k in range(n + 1):
        t = k / n; x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t; r = 1.9 - (i + t) * .13
        for dy in range(-2, 3):
            for dx in range(-2, 3):
                if dx * dx + dy * dy <= r * r: put(x + dx, y + dy, "stem")
for x in range(26, 35): put(x, 94, "stem"); put(x, 93, "stem") if abs(x - 30) < 3 else None   # a small flare at the foot

def frond(base, ctrl, tip, wmax, pinnae):
    # a feathery blade along a curved rachis; the width swells and pinches pinna by pinna, which makes the stair-stepped scalloped edge
    n = 220; pts = []
    for k in range(n + 1):
        t = k / n; bx, by = bez(base, ctrl, tip, t); tx, ty = tangent(base, ctrl, tip, t); d = math.hypot(tx, ty) or 1; nx, ny = -ty / d, tx / d
        fr = (t * pinnae) % 1.0; w = wmax * math.sin(math.pi * t) ** .65 * (.5 + .5 * (1 - abs(2 * fr - 1)) ** .8)
        pts.append((t, bx, by, nx, ny, w, fr))
    for t, bx, by, nx, ny, w, fr in pts:
        m = int(w * 2) + 1
        for j in range(-m, m + 1):
            s = j / 2
            if abs(s) <= w: put(bx + nx * s, by + ny * s, "leaf")
    for t, bx, by, nx, ny, w, fr in pts:   # a groove at each pinna, from the rib partway out on the lower side
        if fr < .04 and 0 < t < .96:
            for side in (1, -1):
                for s in range(1, int(w * .85) + 1):
                    px, py = bx + nx * s * side, by + ny * s * side
                    if get(round(px), round(py)) == "leaf": put(px, py, "leaflo")
    for t, bx, by, nx, ny, w, fr in pts: 
        if t > .03: put(bx, by, "rib")   # the lighter rib down the middle

# leaves alternate left and right up the stem, arching out and drooping, the lower ones longest
for base, ctrl, tip, w, p in (((28, 82), (15, 71), (5, 83), 5.4, 8), ((33, 70), (51, 59), (64, 71), 5.4, 8), ((38, 58), (22, 47), (9, 59), 5.0, 7),
                              ((35, 46), (53, 35), (65, 47), 5.0, 7), ((40, 34), (24, 23), (12, 35), 4.4, 6), ((44, 22), (58, 11), (66, 23), 4.2, 6), ((42, 11), (43, 3), (53, 5), 3.2, 4)):
    frond(base, ctrl, tip, w, p)

# shading, light from the top left: a lit upper edge, shadow on the undersides and right edges, in the same lighter/darker greens
out = [row[:] for row in grid]
for y in range(H):
    for x in range(W):
        c = grid[y][x]; up, dn, lf, rt = get(x, y - 1), get(x, y + 1), get(x - 1, y), get(x + 1, y)
        if c == "leaf":
            if up is None and (x + y) % 3 != 0: out[y][x] = "leafhi"
            elif lf is None and y % 2 == 0: out[y][x] = "leafhi"
            elif dn is None or (rt is None and y % 2 == 0): out[y][x] = "leaflo"
            elif dn == "leaf" and get(x, y + 2) is None and (x + y) % 2 == 0: out[y][x] = "leaflo"
        elif c == "stem":
            if lf is None: out[y][x] = "stemhi"
            elif rt is None or (x + y) % 4 == 0 and rt != "stem": out[y][x] = "stemlo"
img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
for y in range(H):
    for x in range(W):
        if out[y][x]: img.putpixel((x, y), C[out[y][x]] + (255,))
img.save(sys.argv[1] if len(sys.argv) > 1 else "sprites/plants/per-scrubland-large.png"); print(img.size, len({v for r in out for v in r if v}), "colors")
