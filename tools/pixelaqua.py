# Draws the aquarium fittings in the park style like the vivarium props (tools/pixelviv.py, whose fine canvas, part painter and materials it borrows): each
# part with its own dark edge tinted to its material, a lit rim top and left, a shaded rim bottom and right, and structured detail, at the case's fine pixel
# (DET times finer than 0.13 m). All stand upright with their base on the bottom row, centered.
#   afilter Canister Filter   asump Sump Filter   arock Rock Arch   aweed Seaweed Bed   abubble Bubble Curtain
#   aboulder Boulder Pile   abrain Brain Coral   acoral Branching Coral   afan Sea Fan   asponge Sponge Cluster   akelp Kelp Stand   ashell Giant Ammonite Shell
# Usage: python3 -I tools/pixelaqua.py [outdir] [sheet.png]   (default sprites/viv; the optional sheet is a x4 view of every picture)
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixelviv import Cv, U, mat, ramp, mix, rect, poly, ell, line, stroke, curve, sheet, STEEL, STONE

SLATE = mat((18, 32, 38), (104, 136, 146), (74, 100, 110), (54, 76, 84))
FOAM = ((232, 244, 244), (176, 214, 218), (110, 156, 168))   # bubble glint, body, ring
LED = mat((30, 70, 24), (170, 240, 140), (110, 200, 90), (70, 150, 60))
KELP = mat((18, 34, 19), (63, 124, 69), (48, 94, 50), (43, 84, 45))   # PAL greens
SPONGEMEDIA = mat((80, 40, 30), (230, 140, 110), (200, 100, 76), (160, 76, 56))
CORAL, BRAIN, FAN, SPONGE, GOLD, SHELL, MOSS = ramp((228, 132, 70)), ramp((198, 176, 104)), ramp((156, 84, 146)), ramp((190, 148, 92)), ramp((156, 138, 56)), ramp((206, 178, 128)), ramp((92, 120, 60))
DARK = lambda M: mat(M["edge"], M["lo"], M["deep"], M["deep"])

def canister():
    c = Cv(10 * U, 16 * U); W, H = c.w, c.h
    c.part(rect(U, 5 * U, W - 2 * U, H - 1), SLATE, lambda x, y: "deep" if y in (8 * U, 11 * U) else "lo" if y in (8 * U + 1, 11 * U + 1) else None)   # the canister, banded
    c.part(rect(2 * U, 12 * U + 2, 5 * U, 14 * U), mat(SLATE["edge"], (200, 210, 212), (170, 182, 186), (140, 152, 156)))   # its label plate
    c.part(ell(6.5 * U, 13 * U, U * .5, U * .5), LED)   # the running light
    c.part(rect(0, 3 * U, W - U - 1, 5 * U), STEEL)   # the lid
    c.dot([(x, 4 * U) for x in range(U, W - U, 2 * U)], STEEL["edge"])   # its clips
    c.part(curve([(4.5 * U, 3 * U), (4.5 * U, U), (6 * U, U * .5), (W - 1, U * .5)], U * 1.1), STEEL)   # the intake pipe
    return c

def sump():
    c = Cv(18 * U, 14 * U); W, H = c.w, c.h
    c.part(rect(0, 3 * U, W - 1, H - 1), SLATE)
    c.part(rect(2 * U, 5 * U, 10 * U, 10 * U), mat(SLATE["edge"], (150, 196, 204), (110, 160, 172), (84, 128, 140)))   # a window onto the filter media
    c.part(rect(3 * U, 7 * U, 9 * U, 10 * U - 1), SPONGEMEDIA, lambda x, y: "deep" if (x + y) % 3 == 0 and (x - y) % 3 == 0 else None)
    for x in range(12 * U, W - 2 * U, U + 1): c.part(rect(x, 5 * U, x + 1, 10 * U), DARK(SLATE))   # vent slits
    c.part(ell(13 * U, 12 * U, U * .5, U * .5), LED); c.part(ell(15 * U, 12 * U, U * .5, U * .5), LED)
    for px in (3 * U, W - 4 * U): c.part(rect(px, 0, px + 2 * U - 1, 3 * U), STEEL)   # pipes up out of the top
    c.part(rect(0, H - U, W - 1, H - 1), DARK(SLATE))
    return c

def arch():
    c = Cv(20 * U, 12 * U); W, H = c.w, c.h
    block = lambda x, y: "deep" if (y % (2 * U) == 0) or ((x + (y // (2 * U)) % 2 * 2 * U) % (4 * U) == 0) else None   # laid stone courses
    rk = c.part({p for p in ell(W / 2, H, W / 2 - .5, H - .5) if p[1] < H}, STONE, block)
    c.part({p for p in ell(W / 2, H, 4.2 * U, 6 * U) if p[1] < H}, mat((24, 22, 18), (70, 66, 58), (44, 42, 36), (36, 34, 30)))   # the opening
    for mx, my, r in ((5 * U, 3 * U, 2.2 * U), (13 * U, 1.6 * U, 1.8 * U), (17 * U, 5 * U, 1.4 * U)):   # moss caps
        c.part({p for p in ell(mx, my, r, r * .55) if p in rk}, MOSS)
    return c

def weed():
    c = Cv(14 * U, 22 * U); W, H = c.w, c.h
    c.part(rect(U, H - 2 * U, W - U - 1, H - 1), STONE, lambda x, y: "deep" if x % (3 * U) == 0 else None)   # the stony base
    for x0, tall, ph in ((3, 13, 0), (6, 19, 1), (8.5, 21, 2), (10.5, 15, 3), (12.5, 9, 4), (4.5, 16, 5)):   # fronds swaying up, leaves stepping off them
        pts = [(x0 * U + math.sin(i / 2 + ph) * U * .9, H - 2 * U - i * U * tall / 8) for i in range(9)]
        m = curve(pts, U * .9)
        for i, (px, py) in enumerate(pts[1:-1]):
            d = 1 if (i + ph) % 2 else -1; m |= stroke(px, py, px + d * 1.6 * U, py - U, U * .7)
        c.part(m, KELP, lambda x, y: "hi" if (x + y) % 7 == 0 else None)
    return c

def bubbles():
    c = Cv(12 * U, 24 * U); W, H = c.w, c.h
    c.part(rect(U, 21 * U, W - U - 1, H - 1), STEEL)   # the air bar on the floor, with its holes
    c.dot([(x, 22 * U + 1) for x in range(2 * U, W - 2 * U, 2 * U)] + [(x + 1, 22 * U + 1) for x in range(2 * U, W - 2 * U, 2 * U)], STEEL["edge"])
    # three staggered columns of bubbles rising, each a ring with a glint, smaller toward the top (see-through, their ring is their edge)
    G, B, R = FOAM
    for x0, y in ((2.5 * U, 19 * U), (6 * U, 16 * U), (9.5 * U, 20 * U)):
        k = 0
        while y > 1:
            r = 1.6 * U if y > 13 * U else 1.1 * U if y > 6 * U else .7 * U; cx = x0 + math.sin(k * 1.3) * U * .5
            m = ell(cx, y, r, r)
            for p in m:
                ring = any(q not in m for q in ((p[0] - 1, p[1]), (p[0] + 1, p[1]), (p[0], p[1] - 1), (p[0], p[1] + 1)))
                c.put(p[0], p[1], R if ring else B + (150,))
            c.put(round(cx - r * .4), round(y - r * .4), G); c.put(round(cx - r * .4) + 1, round(y - r * .4), G)
            y -= r * 2 + U * 1.4; k += 1
    return c

def boulders():
    c = Cv(18 * U, 10 * U); W, H = c.w, c.h
    for cx, rx, ry in ((5 * U, 5 * U, 8 * U), (13 * U, 5 * U, 6.5 * U), (9 * U, 3.6 * U, 4.6 * U)):   # three stones, the middle one in front
        m = c.part({p for p in ell(cx, H, rx, ry) if p[1] < H}, STONE, lambda x, y: "hi" if (x * 2 + y * 3) % 23 == 0 else None)
        for p in line(round(cx + rx * .2), H - round(ry * .8), round(cx + rx * .4), H - round(ry * .3)):
            if p in m: c.put(p[0], p[1], STONE["deep"])
    return c

def brain():
    c = Cv(16 * U, 10 * U); W, H = c.w, c.h
    c.part({p for p in ell(W / 2, H, W / 2 - .5, H - .5) if p[1] < H}, BRAIN, lambda x, y: "deep" if (x + round(math.sin(y / 2.2) * 2.5) + (y // 4) * 3) % 6 == 0 and y > 2 else "hi" if (x + round(math.sin(y / 2.2) * 2.5) + (y // 4) * 3) % 6 == 1 and y > 2 else None)
    return c

def coral():
    c = Cv(16 * U, 16 * U); W, H = c.w, c.h
    polyps = lambda x, y: "deep" if (x * 3 + y * 5) % 9 == 0 else None
    arms = [[(8, 16), (7.5, 11), (7, 8)], [(7.2, 9.5), (4.5, 6), (3, 2)], [(7.4, 9), (10, 6), (12.5, 3), (13, .8)], [(7, 8.5), (6.5, 5), (6.5, 2)], [(9.5, 7), (13, 6.5), (14.2, 4)], [(6, 11.5), (2.5, 9.5), (1.4, 6.5)]]
    for a in arms: c.part(curve([(x * U, y * U) for x, y in a], U * 1.4), CORAL, polyps)
    for x, y in ((3, 2), (13, .8), (6.5, 2), (14.2, 4), (1.4, 6.5)): c.part(ell(x * U, y * U + 1, U * .8, U * .8), mat(CORAL["edge"], (250, 200, 160), (244, 170, 120), CORAL["mid"]))   # pale tips
    c.part(rect(5 * U, H - U, 11 * U, H - 1), DARK(CORAL))
    return c

def fan():
    c = Cv(16 * U, 18 * U); W, H = c.w, c.h
    cy = 13 * U
    c.part(rect(5 * U, H - U, 11 * U, H - 1), DARK(FAN))   # the holdfast
    c.part(stroke(8 * U, H - U, 8 * U, cy, U * 1.2), FAN)
    def net(x, y):   # ribs fanning out from the stem and two rings of cross strands
        dx, dy = x + .5 - 8 * U, cy - (y + .5); ang = math.degrees(math.atan2(dy, dx)); r = math.hypot(dx / (8 * U), dy / cy)
        return "deep" if (int(ang) % 15 < 3 and r > .15) or abs(r - .45) < .03 or abs(r - .75) < .025 else "hi" if int(ang) % 15 == 4 else None
    c.part({p for p in ell(8 * U, cy, 8 * U - .5, cy - .5) if p[1] <= cy}, FAN, net)
    return c

def sponges():
    c = Cv(14 * U, 14 * U); W, H = c.w, c.h
    for x0, top, w in ((U, 6 * U, 3 * U), (5 * U, U, 4 * U), (10 * U, 4 * U, 3 * U)):   # three barrel sponges of different heights, each open at the top, rows of pores
        c.part(rect(x0, top, x0 + w - 1, H - 1), SPONGE, lambda x, y, x0=x0, w=w, top=top: "deep" if y > top + 3 * U and (y - top) % (2 * U) == 0 and abs(x - x0 - w // 2) <= 1 else "lo" if (x - x0) % 3 == 0 and y % 4 == 0 else None)
        c.part(ell(x0 + w / 2 - .5, top + U * .6, w / 2 - 2, U * .5), DARK(SPONGE))
    return c

def kelpstand():
    c = Cv(12 * U, 30 * U); W, H = c.w, c.h
    for x0, tall, ph in ((3.5, 28, 0), (7.5, 23, 2)):   # two stalks swaying, a blade every few park pixels on alternate sides, a float bulb at each blade's root
        pts = [(x0 * U + math.sin(i / 2.5 + ph) * U * .7, H - 2 * U - i * U * tall / 14) for i in range(15)]
        c.part(curve(pts, U * .8), GOLD)
        for i, (px, py) in enumerate(pts[2:-1:2]):
            d = 1 if (i + ph // 2) % 2 else -1
            c.part(poly([(px, py), (px + d * 3.2 * U, py - 1.6 * U), (px + d * 3.6 * U, py - 2.4 * U), (px + d * .6 * U, py - 1.2 * U)]), GOLD, lambda x, y: "lo" if (x + y) % 4 == 0 else None)
            c.part(ell(px, py, U * .7, U * .7), mat(GOLD["edge"], (210, 196, 110), (184, 166, 80), GOLD["mid"]))
    c.part({p for p in ell(W / 2, H, 4.5 * U, 2.2 * U) if p[1] < H}, STONE)   # the holdfast on a stone
    return c

def shell():
    c = Cv(20 * U, 17 * U); W, H = c.w, c.h
    cx, cy, rx, ry = W / 2, 9 * U, 9.5 * U, 8 * U
    def coil(x, y):   # whorls and ribs round the outer whorl, lit on the top left
        dx, dy = x + .5 - cx, (y + .5 - cy) * rx / ry; d = math.hypot(dx, dy) / U; a = math.atan2(dy, dx)
        if abs(d - 3.2) < .35 or abs(d - 6.2) < .35: return "deep"
        if d > 6.6 and (a * 18 / math.pi) % 2 < .45: return "lo"
        if 3.6 < d < 5.8 and (a * 12 / math.pi) % 2 < .35: return "lo"
        return None
    c.part(ell(cx, cy, rx, ry), SHELL, coil)
    c.part({p for p in ell(cx, cy, rx, ry) if p[0] > cx + 6.4 * U and abs(p[1] - cy - U) < 3 * U}, mat(SHELL["edge"], (110, 92, 62), (70, 58, 38), (56, 46, 30)))   # the opening
    c.part(ell(cx, cy, U * .9, U * .8), DARK(SHELL))
    return c

ALL = {"afilter":canister, "asump":sump, "arock":arch, "aweed":weed, "abubble":bubbles, "aboulder":boulders, "abrain":brain, "acoral":coral, "afan":fan, "asponge":sponges, "akelp":kelpstand, "ashell":shell}

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "sprites/viv"
    os.makedirs(out, exist_ok=True)
    ims = {}
    for k, fn in ALL.items(): ims[k] = fn().img(); ims[k].save(os.path.join(out, k + ".png"))
    if len(sys.argv) > 2: sheet(list(ims.values()), sys.argv[2], (62, 134, 168, 255))
