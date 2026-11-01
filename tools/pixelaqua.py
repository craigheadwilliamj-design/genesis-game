# Draws the aquarium fittings in the park style like the vivarium props (tools/pixelviv.py, whose fine canvas, part painter and materials it borrows): each
# part with its own dark edge tinted to its material, a lit rim top and left, a shaded rim bottom and right, and structured detail, at the case's fine pixel
# (DET times finer than 0.13 m). All stand upright with their base on the bottom row, centered.
#   afilter Canister Filter   asump Sump Filter   arock Rock Arch   aweed Seaweed Bed   abubble Bubble Curtain
#   aboulder Boulder Pile   abrain Brain Coral   acoral Branching Coral   afan Sea Fan   asponge Sponge Cluster   akelp Kelp Stand   ashell Giant Ammonite Shell
#   freshwater only: fdrift Driftwood   flog Sunken Log   fhorn Hornwort Thicket   feel Eelgrass Meadow   flily Water Lily   fstones River Stones
# Usage: python3 -I tools/pixelaqua.py [outdir] [sheet.png]   (default sprites/viv; the optional sheet is a x4 view of every picture)
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixelviv import Cv, U, mat, ramp, mix, rect, poly, ell, line, stroke, curve, sheet, save, STEEL, STONE

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

def weed(f=0, n=1):
    c = Cv(16 * U, 22 * U); W, H = c.w, c.h
    c.part(rect(2 * U, H - 2 * U, W - 2 * U - 1, H - 1), STONE, lambda x, y: "deep" if x % (3 * U) == 0 else None)   # the stony base
    for x0, tall, ph in ((4, 13, 0), (7, 19, 1), (9.5, 21, 2), (11.5, 15, 3), (13.5, 9, 4), (5.5, 16, 5)):   # fronds swaying (more toward the tips, each a beat apart), leaves stepping off them
        sw = math.sin(2 * math.pi * f / n - ph * .9)
        pts = [(x0 * U + math.sin(i / 2 + ph) * U * .9 + sw * 1.1 * U * (i / 8) ** 1.5, H - 2 * U - i * U * tall / 8) for i in range(9)]
        m = curve(pts, U * .9)
        for i, (px, py) in enumerate(pts[1:-1]):
            d = 1 if (i + ph) % 2 else -1; m |= stroke(px, py, px + d * 1.6 * U, py - U - sw * d * .3 * U, U * .7)
        c.part(m, KELP, lambda x, y: "hi" if (x + y) % 7 == 0 else None)
    return c

def bubbles(f=0, n=1):
    c = Cv(12 * U, 24 * U); W, H = c.w, c.h
    c.part(rect(U, 21 * U, W - U - 1, H - 1), STEEL)   # the air bar on the floor, with its holes
    c.dot([(x, 22 * U + 1) for x in range(2 * U, W - 2 * U, 2 * U)] + [(x + 1, 22 * U + 1) for x in range(2 * U, W - 2 * U, 2 * U)], STEEL["edge"])
    # three staggered columns of bubbles rising, each a ring with a glint, smaller toward the top (see-through, their ring is their edge); each frame
    # every bubble moves a frame's share of the spacing up its own wobbling path, so the last frame runs into the first
    G, B, R = FOAM; gap = 4.4 * U
    for col, x0 in enumerate((2.5 * U, 6 * U, 9.5 * U)):
        for k in range(-1, 8):
            d = (k + f / n + col * .37) * gap; y = 20 * U - d
            if y < 1 or y > 20.5 * U: continue
            r = .5 * U + 1.1 * U * min(1, y / (20 * U)) ** 1.3; cx = x0 + math.sin(d / (2.2 * U) + col) * U * .6
            m = ell(cx, y, r, r)
            for p in m:
                ring = any(q not in m for q in ((p[0] - 1, p[1]), (p[0] + 1, p[1]), (p[0], p[1] - 1), (p[0], p[1] + 1)))
                c.put(p[0], p[1], R if ring else B + (150,))
            c.put(round(cx - r * .4), round(y - r * .4), G); c.put(round(cx - r * .4) + 1, round(y - r * .4), G)
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

def kelpstand(f=0, n=1):
    c = Cv(16 * U, 30 * U); W, H = c.w, c.h
    sway = math.sin(2 * math.pi * f / n)
    for x0, tall, ph in ((5.5, 28, 0), (9.5, 23, 2)):   # two stalks swaying (more toward the tip, the second a beat behind), a blade every few park pixels on alternate sides, a float bulb at each blade's root
        sw = math.sin(2 * math.pi * f / n - ph * .6)
        pts = [(x0 * U + math.sin(i / 2.5 + ph) * U * .7 + sw * 1.3 * U * (i / 14) ** 1.5, H - 2 * U - i * U * tall / 14) for i in range(15)]
        c.part(curve(pts, U * 1.4), GOLD, lambda x, y: "hi" if (x + y) % 5 == 0 else None)
        for i, (px, py) in enumerate(pts[2:-1:2]):
            d = 1 if (i + ph // 2) % 2 else -1; lift = sw * d * .5 * U   # the blades lift and droop a little as the stalk swings
            c.part(poly([(px, py + .4 * U), (px + d * 2 * U, py - .2 * U - lift * .6), (px + d * 4.2 * U, py - 1.6 * U - lift), (px + d * 4.4 * U, py - 2.8 * U - lift), (px + d * 2.2 * U, py - 2.4 * U - lift * .6), (px + d * .4 * U, py - 1.4 * U)]), GOLD,
                   lambda x, y, px=px, py=py, d=d: "deep" if abs((y - py) + (x - px) * d * .45 + 1.2 * U) < .6 else "lo" if (x * 2 + y) % 5 == 0 else None)   # a broad blade with a midrib
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

# Freshwater fittings (LAND fresh: fresh water only), to go with the river bed backdrop
DRIFT, LOGB, HORN, EEL, PAD, STEM, PETAL, STAMEN = ramp((168, 150, 122)), ramp((112, 84, 54)), ramp((70, 120, 58)), ramp((112, 146, 70)), ramp((74, 128, 62)), ramp((118, 140, 72)), ramp((236, 158, 186)), ramp((246, 214, 96))
PEBBLES = (STONE, ramp((152, 124, 98)), ramp((112, 118, 124)), ramp((176, 160, 128)))

def driftwood():
    c = Cv(18 * U, 12 * U); W, H = c.w, c.h
    grain = lambda x, y: "deep" if (y + round(math.sin(x / 4) * 1.5)) % 4 == 0 and x % 7 else "hi" if (y + round(math.sin(x / 4) * 1.5)) % 4 == 2 and x % 5 == 0 else None   # wavy grain along the wood
    c.part(curve([(1.5 * U, H - 2 * U), (6 * U, H - 2.6 * U), (12 * U, H - 2.2 * U), (16.5 * U, H - 3.2 * U)], 3.2 * U), DRIFT, grain)   # the lying trunk
    c.part(curve([(5 * U, H - 3 * U), (4 * U, 6 * U), (2.5 * U, 2 * U)], 2.2 * U), DRIFT, grain)   # limbs reaching up, worn smooth
    c.part(curve([(9.5 * U, H - 3 * U), (11 * U, 6 * U), (10 * U, 3 * U), (11.5 * U, 1.2 * U)], 2 * U), DRIFT, grain)
    c.part(curve([(14 * U, H - 3.5 * U), (15.5 * U, 5.5 * U)], 1.7 * U), DRIFT, grain)
    c.part(stroke(1.2 * U, H - 2.4 * U, 0, H - U, 1.4 * U) | stroke(1.5 * U, H - 1.5 * U, 3 * U, H - 1, U * 1.1), DRIFT)   # root stubs
    c.part(ell(7 * U, H - 2.5 * U, U * .9, U * .6), DARK(DRIFT))   # a knot hole
    return c

def sunkenlog():
    c = Cv(20 * U, 9 * U); W, H = c.w, c.h
    body = rect(3 * U, U, W - U - 1, H - 1) | ell(W - U - 1, H / 2 + U * .5, U, H / 2 - U * .5)
    c.part(body, LOGB, lambda x, y: "deep" if x % 5 == 0 and (y // 3 + x // 5) % 3 else "hi" if y == U + 3 and x % 4 else None)   # bark in long broken furrows
    c.part(ell(3 * U, H / 2 + U * .5, 2.6 * U, H / 2 - U * .5), mat(LOGB["edge"], (186, 150, 104), (160, 124, 82), (130, 98, 62)), lambda x, y: "deep" if abs(math.hypot((x + .5 - 3 * U) / 2.6, (y + .5 - H / 2 - U * .5) / (H / 2 / U - .5)) / U - 1.2) < .14 else None)   # the cut end with its rings
    c.part(ell(3 * U, H / 2 + U * .6, 1.5 * U, H / 2 - 2 * U), mat((20, 16, 10), (64, 50, 32), (40, 31, 20), (32, 25, 16)))   # hollow inside
    for mx, w in ((9 * U, 3 * U), (15 * U, 2 * U)): c.part({p for p in ell(mx, U * 1.2, w, U * .9) if p in body}, MOSS, lambda x, y: "hi" if (x + y) % 3 == 0 else None)   # moss on top
    return c

def hornwort(f=0, n=1):
    c = Cv(14 * U, 22 * U); W, H = c.w, c.h
    for x0, tall, ph in ((3.5, 18, 0), (6.5, 21, 1.4), (9.5, 16, 2.6), (11.5, 12, 3.7), (5, 13, 4.6)):   # stems with whorls of fine needle leaves, swaying a beat apart
        sw = math.sin(2 * math.pi * f / n - ph)
        pts = [(x0 * U + math.sin(i / 2 + ph) * U * .5 + sw * 1.1 * U * (i / 10) ** 1.5, H - U - i * U * tall / 10) for i in range(11)]
        m = curve(pts, 1.6)
        for i, (px, py) in enumerate(pts[1:]):
            w = U * (1.5 - .6 * i / 10)
            for a in (-150, -120, -60, -30): m |= stroke(px, py, px + math.cos(math.radians(a)) * w, py + math.sin(math.radians(a)) * w * .8, 1.3)
        c.part(m, HORN, lambda x, y: "hi" if (x + y * 2) % 7 == 0 else None, rim=1)
    c.part({p for p in ell(W / 2, H, 5 * U, 1.4 * U) if p[1] < H}, ramp((120, 104, 80)))   # the gravel it roots in
    return c

def eelgrass(f=0, n=1):
    c = Cv(16 * U, 26 * U); W, H = c.w, c.h
    for k in range(9):   # long ribbon blades from a tuft, each swaying a beat after the last, curling over at the tip
        x0 = 4 * U + k * U; tall = H * (.62 + .34 * math.sin(k * 2.1) ** 2); lean = (k - 4) * .8 * U + math.sin(k * 1.7) * 1.2 * U; sw = math.sin(2 * math.pi * f / n - k * .7)
        pts = [(x0 + lean * (i / 8) ** 1.4 + sw * 1.6 * U * (i / 8) ** 1.6 + math.sin(i / 2 + k) * .5 * U, H - U - tall * i / 8) for i in range(9)]
        c.part(curve(pts, U * .9), EEL, lambda x, y, k=k: "hi" if (x + k) % 3 == 0 and y % 5 < 3 else None, rim=1)
    c.part({p for p in ell(W / 2, H, 5 * U, 1.4 * U) if p[1] < H}, ramp((120, 104, 80)))
    return c

def lily():
    c = Cv(18 * U, 30 * U); W, H = c.w, c.h
    pads = ((4.2 * U, 4.6 * U, 3.6 * U), (13.4 * U, 3.2 * U, 4 * U), (8.6 * U, 9 * U, 3 * U))
    for px, py, r in pads: c.part(curve([(W / 2, H - U), (W / 2 + (px - W / 2) * .4, H * .6), (px, py + U)], U * .9), STEM, rim=1)   # long stems up from the root to each pad
    c.part(curve([(W / 2, H - U), (W / 2 + U, H * .5), (10.5 * U, 3.4 * U)], U * .9), STEM, rim=1)   # and to the flower
    for px, py, r in pads:   # the pads, tipped toward us, each with its notch and veins
        pad = ell(px, py, r, r * .5) - {(x, y) for x in range(round(px), round(px + r) + 1) for y in range(round(py) - abs(round((x - px) * .25)), round(py) + abs(round((x - px) * .25)) + 1)}
        c.part(pad, PAD, lambda x, y, px=px, py=py: "deep" if (round(math.degrees(math.atan2(y - py, (x - px) / 2))) % 40) < 5 else None)
    fl = set()
    for a in range(-170, 0, 24): fl |= stroke(10.5 * U, 3.4 * U, 10.5 * U + math.cos(math.radians(a)) * 2.2 * U, 3.4 * U + math.sin(math.radians(a)) * 2.2 * U, U * 1.1)
    c.part(fl, PETAL, lambda x, y: "hi" if (x + y) % 4 == 0 else None, rim=1); c.part(ell(10.5 * U, 3 * U, U * .8, U * .55), STAMEN, rim=1)   # the flower
    c.part({p for p in ell(W / 2, H, 3 * U, 1.2 * U) if p[1] < H}, ramp((96, 80, 52)))   # the rootstock in the mud
    return c

def riverstones():
    c = Cv(18 * U, 9 * U); W, H = c.w, c.h
    for i, (cx, cy, rx, ry) in enumerate(((4, 6, 3.4, 2.6), (13.5, 6.2, 3.8, 2.4), (8.8, 5, 3.2, 2.6), (6.2, 7.6, 2.4, 1.6), (16, 7.8, 1.8, 1.3), (11, 7.8, 2.2, 1.4), (1.6, 7.9, 1.5, 1.1))):   # rounded cobbles, the far ones first, in mixed colors, banded or speckled
        M = PEBBLES[i % 4]; tex = (lambda x, y: "hi" if (x * 3 + y * 7) % 19 == 0 else None) if i % 2 else (lambda x, y, cy=cy: "lo" if round(y - cy * U) % 5 == 2 else None)
        c.part({p for p in ell(cx * U, cy * U, rx * U, ry * U) if p[1] < H}, M, tex)
    return c

FRAMES = {"abubble":6, "akelp":8, "aweed":8, "fhorn":8, "feel":8}   # animated fittings: frame count (<key>.png is the first, then <key>-2.png and on)
ALL = {"afilter":canister, "asump":sump, "arock":arch, "aweed":weed, "abubble":bubbles, "aboulder":boulders, "abrain":brain, "acoral":coral, "afan":fan, "asponge":sponges, "akelp":kelpstand, "ashell":shell,
       "fdrift":driftwood, "flog":sunkenlog, "fhorn":hornwort, "feel":eelgrass, "flily":lily, "fstones":riverstones}

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "sprites/viv"
    os.makedirs(out, exist_ok=True)
    ims = {}
    save(ALL, FRAMES, out, ims)
    if len(sys.argv) > 2: sheet(list(ims.values()), sys.argv[2], (62, 134, 168, 255))
