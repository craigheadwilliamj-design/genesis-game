# Draws Cotylorhynchus (a big barrel-bodied caseid: tiny head, short thick neck, heavy body, stubby sprawling legs, a tapering tail) in the Dimetrodon's flat, simple style:
# flat fills, no outline, stair-stepped silhouette, about 8 base colors each with a lighter and darker shade, a lit top-left edge, shadow under the belly and on the right,
# rhythmic detail (rows of short dashes on the hide, grooves between the ribs, belly scutes, a rust stripe down the back). Side-on, facing right, feet on row 62 like the Dimetrodon.
# Writes sprites/coty.png (standing), sprites/coty-walk.png (4 frames side by side) and sprites/coty-idle.png (6 frames: the head dips to graze and comes back up, the barrel breathes).
# Usage: python3 -I tools/pixelcoty.py [outdir]
import sys, math
from PIL import Image

W, H, GROUND = 100, 75, 62
def mix(a, b, t): return tuple(round(x * (1 - t) + y * t) for x, y in zip(a, b))
def tones(c): return {"": c, "hi": mix(c, (255, 255, 255), .2), "lo": mix(c, (0, 0, 0), .25)}
BASE = {"body": (118, 100, 42), "dark": (92, 76, 32), "belly": (178, 165, 66), "rust": (178, 78, 0)}   # warm olive-brown hide, the Dimetrodon's yellow-olive belly and rust orange
C = {"eye": (218, 162, 0), "pupil": (0, 0, 0), "nose": (50, 40, 18), "mouth": (60, 46, 20)}
for k, v in BASE.items():
    for s, c in tones(v).items(): C[k + s] = c

def lerp(pts, x):   # a piecewise-linear profile through (x, y) points
    if x <= pts[0][0]: return pts[0][1]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if x <= x1: return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return pts[-1][1]
TOP = [(3, 58), (14, 57), (26, 54), (34, 44), (40, 35), (50, 30), (62, 29), (72, 31), (78, 35), (82, 37), (85, 37), (87, 35), (92, 35), (96, 38)]
BOT = [(3, 60), (14, 61), (26, 59), (34, 55), (42, 52), (56, 53), (66, 52), (74, 50), (80, 46), (84, 44), (88, 43), (92, 42), (96, 41)]

class Frame:
    def __init__(s): s.g = [[None] * W for _ in range(H)]
    def put(s, x, y, c):
        if 0 <= x < W and 0 <= y < H: s.g[y][x] = c
    def get(s, x, y): return s.g[y][x] if 0 <= x < W and 0 <= y < H else None

def smooth(t): t = max(0, min(1, t)); return t * t * (3 - 2 * t)

def body(f, dip, breathe):
    # the head end sags by dip pixels (grazing), the barrel swells by breathe
    cols = {}
    for x in range(3, 97):
        d = dip * smooth((x - 74) / 14); t = round(lerp(TOP, x) + d); b = round(lerp(BOT, x) + d + (breathe if 36 < x < 76 else 0))
        if 38 < x < 74: t -= breathe
        cols[x] = (t, b)
        for y in range(t, b + 1): f.put(x, y, "body")
    return cols

def leg(f, hx, hy, foot_x, foot_y, w, c):
    # a thick limb from the hip down to a flat foot with toes pointing right; w is its width at the top
    for y in range(hy, foot_y + 1):
        t = (y - hy) / max(1, foot_y - hy); cx = hx + (foot_x - hx) * t ** 1.3; hw = w / 2 * (1 - .22 * t)
        for x in range(int(cx - hw + .5), int(cx + hw + .5) + 1): f.put(x, y, c)
    for x in range(int(foot_x - w / 2 + .5) + 1, int(foot_x + w / 2 + .5) + 4): f.put(x, foot_y, c); f.put(x, foot_y - 1, c) if x < foot_x + w / 2 + 2 else None

def legs(f, phase, cols):
    # near and far legs, front and rear; phase 0..1 along the stride (None stands). Swinging legs lift 2 px and reach forward.
    for far, hx, hipy, ph in ((True, 40, 53, .5), (True, 68, 52, 0), (False, 46, 54, 0), (False, 74, 52, .5)):
        if phase is None: off, lift = 0, 0
        else:
            p = (phase + ph) % 1; off = round(5 * math.cos(2 * math.pi * p)); lift = round(3 * max(0, -math.sin(2 * math.pi * p)) ** .8) if True else 0
        hy = cols.get(hx, (0, hipy))[1] - 3
        leg(f, hx + (0 if far else 0), hy, hx + off + (1 if far else 0), GROUND - lift, (8 if hx > 60 else 9) if far else (10 if hx > 60 else 11), "dark" if far else "body")

def decorate(f, cols, dip):
    # belly color, the rust stripe down the back, the eye and the face
    x0, x1 = 36, 80
    for x in range(x0, x1):
        if x not in cols: continue
        t, b = cols[x]
        depth = 4 + (1 if x % 8 < 4 else 0)   # the belly's edge steps up and down in a regular rhythm
        for y in range(b - depth + 1, b + 1):
            if f.get(x, y) == "body": f.put(x, y, "belly")
    for x in range(4, 36):   # the underside of the tail
        if x in cols:
            t, b = cols[x]
            if b - t >= 4 and f.get(x, b) == "body": f.put(x, b, "belly")
    for x in range(38, 80):   # rust stripe: a band along the spine whose lower edge steps in a zigzag, like ribs showing through
        if x not in cols: continue
        t, b = cols[x]; depth = 4 + (1 if (x // 3) % 2 == 0 else 0) - (2 if x > 74 else 0) - (1 if x < 42 else 0)
        for y in range(t, t + max(1, depth)):
            if f.get(x, y) == "body": f.put(x, y, "rust")
    for x in range(14, 40):   # the stripe thins out along the tail
        if x in cols:
            t, b = cols[x]
            if f.get(x, t) == "body" and (x % 5) != 0: f.put(x, t, "rust")
    ht = cols[90][0]   # the face
    ex, ey = 90, ht + 2
    f.put(ex, ey, "eye"); f.put(ex + 1, ey, "pupil")
    f.put(95, cols[95][0] + 1, "nose")
    for x in range(88, 96):
        if f.get(x, cols[x][1] - 1) == "body": f.put(x, cols[x][1] - 1, "mouth")

def shade(f):
    out = [r[:] for r in f.g]
    for y in range(H):
        for x in range(W):
            c = f.g[y][x]
            if c not in ("body", "dark", "belly", "rust"): continue
            up, dn, lf, rt = f.get(x, y - 1), f.get(x, y + 1), f.get(x - 1, y), f.get(x + 1, y)
            n = c
            if up is None and (x + y) % 3 != 0: n = c + "hi"
            elif lf is None and y % 2 == 0: n = c + "hi"
            elif dn is None or (rt is None and y % 2 == 0): n = c + "lo"
            elif c == "body":
                if y % 6 == 0 and not 43 < x < 73 and (x + (y // 6) * 4) % 8 in (0, 1, 2) and up == "body" and dn in ("body", "belly"): n = "bodylo"   # scale rows: short dark dashes, staggered
                elif 44 < x < 72 and x % 7 == 3 and 4 <= y - ytop(f, x) <= 12: n = "bodylo"                                         # grooves between the ribs
            elif c == "belly":
                if x % 4 == 1 and up in ("body", "bodylo", "bodyhi"): n = "bellyhi"                                                  # belly scutes: short light dashes
                elif up not in ("belly", "bellyhi", "bellylo") and x % 3 == 0: n = "bellyhi"
            elif c == "rust":
                if dn not in ("rust", "rusthi", "rustlo") and x % 2 == 0: n = "rustlo"                                               # the stripe's lower edge is in shade
            out[y][x] = n
    f.g = out

def ytop(f, x):
    for y in range(H):
        if f.g[y][x] is not None: return y
    return 0

def render(phase=None, dip=0, breathe=0):
    f = Frame(); cols = body(f, dip, breathe)
    legs(f, phase, cols)   # far legs first inside legs(): they're listed first, so near legs paint over them
    decorate(f, cols, dip)
    shade(f)
    # the near legs' belly-side: leave them olive-brown; add a lit left edge and a dark base so they read as heavy limbs
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for y in range(H):
        for x in range(W):
            if f.g[y][x]: im.putpixel((x, y), C[f.g[y][x]] + (255,))
    return im

def strip(frames):
    im = Image.new("RGBA", (W * len(frames), H), (0, 0, 0, 0))
    for i, fr in enumerate(frames): im.paste(fr, (i * W, 0))
    return im

out = sys.argv[1] if len(sys.argv) > 1 else "sprites"
render().save(f"{out}/coty.png")
strip([render(p) for p in (0, .25, .5, .75)]).save(f"{out}/coty-walk.png")
dips = (0, 2, 4, 4, 2, 0); breath = (0, 0, 1, 1, 0, 0)
strip([render(None, d, b) for d, b in zip(dips, breath)]).save(f"{out}/coty-idle.png")
print("coty", W, H, "walk 4, idle 6")
