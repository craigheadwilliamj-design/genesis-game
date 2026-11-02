# Draws the lagoon decorations (LAND lagoon in js/data.js; LAGOON_SPRITES gives each its size and frames) in the park style like the aquarium fittings
# (tools/pixelaqua.py, whose part painter it borrows), but at the park's own pixel, 0.13 m (ROCK_MPP), since a lagoon is an open exhibit. Each part has its
# own dark edge tinted to its material, a lit rim top and left and a shaded rim bottom and right. All stand upright with their base on the bottom row, centered.
# They are drawn in their own clean colors: the game tints and fades the sunk ones like a diving pool animal (lagoonSpriteSvg). The sea stack stands out of the water with a ring of foam.
#   sea water only:   lcoral Coral Head   lsponge Sponge Reef   lkelp Kelp Bed (swaying)   lcrinoid Crinoid Garden   lammo Ammonite Fossil
#   fresh water only: llog Sunken Log   ldrift Driftwood Snag   lweed Waterweed Thicket (swaying)   leel Eelgrass Meadow (swaying)   lstones River Stones
#                     llily Lily Pads (floating on the surface, drawn over the ripples, never tinted)
#   any water:        lstack Sea Stack
# Usage: python3 -I tools/pixellagoon.py [outdir] [sheet.png]   (default sprites/lagoon; the optional sheet is a x6 view of every picture)
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixelviv import Cv as VCv, mat, ramp, mix, rect, poly, ell, stroke, curve, sheet, STONE

class Cv(VCv):
    def part(s, mask, M, tex=None, rim=1): return super().part(mask, M, tex, rim) if not M.get("soft") else super().part(mask, {**M, "edge":mix(M["lo"], M["edge"], .5)}, tex, rim)

soft = lambda M: {**M, "soft":True}   # a lighter edge, for thin parts that would be all edge
CORAL, BRAIN, FAN, SPONGE, PURP, KELP = soft(ramp((240, 124, 76))), ramp((214, 188, 104)), soft(ramp((186, 92, 166))), ramp((226, 170, 84)), ramp((156, 104, 190)), soft(ramp((176, 160, 64)))
CRIN, CRIN2, SHELL, LOGB, MOSS = soft(ramp((224, 108, 124))), soft(ramp((240, 204, 120))), ramp((214, 186, 136)), ramp((120, 90, 58)), ramp((100, 130, 64))
ROCK = mat((70, 66, 58), (170, 164, 148), (132, 126, 112), (98, 94, 84))
SAND = mat((120, 100, 60), (236, 220, 170), (214, 196, 140), (188, 168, 112))
FOAM = mat((150, 200, 206), (250, 252, 250), (226, 242, 242), (190, 224, 228))
DARK = lambda M: mat(M["edge"], M["lo"], M["deep"], M["deep"])
def mound(cx, b, rx, ry): return {p for p in ell(cx, b, rx, ry) if p[1] < b}   # a half dome standing on row b

def coralhead():
    c = Cv(28, 18); W, H = c.w, c.h
    c.part(mound(W / 2, H, 13.5, 5), SAND)   # a sandy patch
    c.part(mound(9, H - 1, 7.5, 8), BRAIN, lambda x, y: "deep" if (x + round(math.sin(y / 1.4) * 1.5) + (y // 2) * 2) % 4 == 0 and y > H - 8 else None)   # brain coral, its grooves wandering
    polyps = lambda x, y: "deep" if (x * 3 + y * 5) % 7 == 0 else None
    for a in ([(18, 17), (18, 11), (17, 7)], [(18, 12), (15, 8), (14, 4)], [(18, 11), (21, 7), (22, 3)], [(19, 14), (23, 11), (25, 8)]): c.part(curve(a, 2.6), CORAL, polyps)   # branching coral
    for x, y in ((17, 7), (14, 4), (22, 3), (25, 8)): c.put(x, y - 1, (250, 206, 170))   # pale tips
    c.part({p for p in ell(10, 6, 5, 6) if p[1] <= 6} | stroke(10, 6, 10, 9, 1), FAN, lambda x, y: "deep" if (x - 10) % 2 == 0 and y < 5 else None)   # a sea fan behind
    return c

def spongereef():
    c = Cv(26, 20); W, H = c.w, c.h
    c.part(mound(W / 2, H, 12.5, 4), ROCK)
    for x0, top, w, M in ((2, 9, 5, SPONGE), (8, 2, 6, PURP), (15, 6, 5, SPONGE), (20, 11, 4, PURP)):   # barrel sponges, open at the top, rows of pores
        c.part(rect(x0, top, x0 + w - 1, H - 2), M, lambda x, y, x0=x0, top=top: "deep" if (y - top) % 3 == 2 and (x - x0) % 2 == 1 and y > top + 2 else None)
        c.part(rect(x0 + 1, top, x0 + w - 2, top), DARK(M))
    return c

def kelpbed(f=0, n=1):
    c = Cv(24, 34); W, H = c.w, c.h
    for x0, tall, ph in ((5, 30, 0), (11, 33, 1.7), (17, 27, 3.1), (21, 22, .8)):   # stalks swaying (more toward the tip, each a beat apart), a blade every few pixels on alternate sides
        sw = math.sin(2 * math.pi * f / n - ph)
        pts = [(x0 + math.sin(i / 2 + ph) * .6 + sw * 1.6 * (i / 10) ** 1.5, H - 2 - i * tall / 10) for i in range(11)]
        c.part(curve(pts, 2), KELP, lambda x, y: "hi" if (x + y) % 4 == 0 else None)
        for i, (px, py) in enumerate(pts[2:-1:2]):
            d = 1 if (i + int(ph)) % 2 else -1; lift = sw * d * .5
            c.part(poly([(px, py + .5), (px + d * 3, py - 1 - lift), (px + d * 4.6, py - 3.4 - lift), (px + d * 1.4, py - 3.2)]), KELP, lambda x, y: "hi" if (x + y) % 3 == 0 else None)
    c.part(mound(W / 2, H, 10, 3), ROCK)   # holdfasts on a reef stone
    return c

def crinoids():
    c = Cv(24, 26); W, H = c.w, c.h
    c.part(mound(W / 2, H, 11.5, 3.5), ROCK)
    for x0, top, M, lean in ((5, 9, CRIN, -1), (12, 5, CRIN2, 0), (18, 11, CRIN, 1)):   # sea lilies: a jointed stalk and a feathery crown of arms
        c.part(curve([(x0, H - 2), (x0 + lean * .5, (H + top) / 2), (x0 + lean, top + 4)], 2), soft(DARK(M)), lambda x, y: "hi" if y % 2 == 0 else None)
        cx, cy = x0 + lean, top + 3
        arms = set()
        for a in range(-2, 3): arms |= curve([(cx, cy), (cx + a * 1.1, cy - 2.6), (cx + a * 2, cy - 5 + abs(a) * .6)], 1.5)   # arms raised in a cup
        c.part(arms, M, lambda x, y: "hi" if (x + y) % 2 == 0 else None)
        c.part(ell(cx, cy + .5, 1.2, 1), DARK(M))
    return c

def ammonite():
    c = Cv(24, 20); W, H = c.w, c.h
    c.part(mound(W / 2, H, 11.5, 3.5), SAND)
    cx, cy, rx, ry = 11, 10, 9, 8.5
    def coil(x, y):   # whorls and ribs round the outer whorl
        dx, dy = x + .5 - cx, (y + .5 - cy) * rx / ry; d = math.hypot(dx, dy); a = math.atan2(dy, dx)
        if abs(d - 3) < .5 or abs(d - 6) < .5: return "deep"
        if d > 6.5 and (a * 16 / math.pi) % 2 < .6: return "lo"
        return None
    c.part(ell(cx, cy, rx, ry), SHELL, coil)
    c.part({p for p in ell(cx, cy, rx, ry) if p[0] > cx + 6 and abs(p[1] - cy - 1) < 3}, mat(SHELL["edge"], (110, 92, 62), (70, 58, 38), (56, 46, 30)))   # the opening
    c.part(ell(cx, cy, 1, 1), DARK(SHELL))
    return c

def sunkenlog():
    c = Cv(32, 12); W, H = c.w, c.h
    body = rect(4, 2, W - 2, H - 2) | ell(W - 2, H / 2, 1.5, H / 2 - 2)
    c.part(body, LOGB, lambda x, y: "deep" if x % 4 == 0 and (y // 2 + x // 4) % 3 else None)
    c.part(ell(4, H / 2, 3, H / 2 - 2), mat(LOGB["edge"], (186, 150, 104), (160, 124, 82), (130, 98, 62)))   # the cut end
    c.part(ell(4, H / 2, 1.5, H / 2 - 3.5), mat((20, 16, 10), (64, 50, 32), (40, 31, 20), (32, 25, 16)))   # hollow
    for mx, w in ((12, 4), (22, 3)): c.part({p for p in ell(mx, 2.5, w, 1.4) if p in body}, MOSS)
    c.part(rect(0, H - 1, W - 1, H - 1) - body, mat(SAND["edge"], SAND["lo"], SAND["deep"], SAND["deep"]))
    return c

DRIFT, WEED, EEL, PAD, PETAL, STAMEN = soft(ramp((178, 162, 134))), soft(ramp((76, 132, 62))), soft(ramp((122, 158, 74))), ramp((80, 140, 66)), soft(ramp((240, 162, 190))), ramp((248, 216, 96))
GRAVEL = ramp((132, 116, 88))
PEBBLES = (ROCK, ramp((160, 130, 102)), ramp((118, 124, 130)), ramp((184, 168, 134)))

def driftwood():
    c = Cv(32, 16); W, H = c.w, c.h
    grain = lambda x, y: "deep" if (y + round(math.sin(x / 3) * 1)) % 3 == 0 and x % 5 else None   # wavy grain along the wood
    c.part(mound(W / 2, H, 15, 3), GRAVEL)
    c.part(curve([(2, H - 3), (11, H - 4), (21, H - 3.5), (29, H - 5)], 3.4), DRIFT, grain)   # the lying trunk
    c.part(curve([(8, H - 4), (6, 7), (3, 2)], 2.2), DRIFT)   # limbs reaching up, worn smooth
    c.part(curve([(17, H - 4), (19, 8), (18, 4), (20, 1)], 2.2), DRIFT)
    c.part(curve([(25, H - 5), (27, 6)], 2), DRIFT)
    c.part(stroke(2, H - 3, 0, H - 1, 1.6), DRIFT)   # a root stub
    c.dot([(12, H - 4)], DRIFT["deep"])   # a knot
    return c

def waterweed(f=0, n=1):
    c = Cv(24, 28); W, H = c.w, c.h
    for x0, tall, ph in ((5, 22, 0), (9, 26, 1.4), (13, 20, 2.6), (17, 24, 3.7), (20, 15, 4.6)):   # stems in whorls of short leaves, swaying a beat apart
        sw = math.sin(2 * math.pi * f / n - ph)
        pts = [(x0 + math.sin(i / 2 + ph) * .5 + sw * 1.5 * (i / 8) ** 1.5, H - 2 - i * tall / 8) for i in range(9)]
        m = curve(pts, 1.6)
        for px, py in pts[1::2]: m |= stroke(px - 1.8, py + .6, px + 1.8, py - .6 + sw * .4, 1.2)
        c.part(m, WEED, lambda x, y: "hi" if (x + y * 2) % 5 == 0 else None)
    c.part(mound(W / 2, H, 10, 2.5), GRAVEL)
    return c

def eelgrass(f=0, n=1):
    c = Cv(30, 22); W, H = c.w, c.h
    for k in range(8):   # long ribbon blades in a meadow, each swaying a beat after the last, curling over at the tip
        x0 = 3 + k * 3.4; tall = H * (.55 + .4 * math.sin(k * 2.1) ** 2); lean = (k - 4) * .4 + math.sin(k * 1.7) * 1.4; sw = math.sin(2 * math.pi * f / n - k * .7)
        pts = [(x0 + lean * (i / 6) ** 1.4 + sw * 1.6 * (i / 6) ** 1.6, H - 2 - tall * i / 6) for i in range(7)]
        c.part(curve(pts, 2.4), EEL, lambda x, y, k=k: "hi" if (x + k) % 3 == 0 and y % 4 < 2 else None)
    c.part(mound(W / 2, H, 14, 2.5), GRAVEL)
    return c

def riverstones():
    c = Cv(28, 13); W, H = c.w, c.h
    for i, (cx, cy, rx, ry) in enumerate(((7, 7, 5, 4), (20, 7.5, 5.5, 3.6), (13.5, 6, 4.6, 4), (10, 10, 3.4, 2.4), (24.5, 10.5, 2.8, 2), (17, 10.5, 3, 2), (3, 10.6, 2.4, 1.8))):   # rounded cobbles in mixed colors, the far ones first
        M = PEBBLES[i % 4]; tex = (lambda x, y: "hi" if (x * 3 + y * 7) % 13 == 0 else None) if i % 2 else (lambda x, y, cy=cy: "lo" if round(y - cy) % 3 == 1 else None)
        c.part({p for p in ell(cx, cy, rx, ry) if p[1] < H}, M, tex)
    return c

def lilypads():
    c = Cv(32, 14); W, H = c.w, c.h
    for px, py, r in ((7, 8.5, 6.5), (21, 9, 7.5), (27, 4.5, 4.5), (13, 4, 5)):   # pads flat on the water, seen from above at a slant, each with its notch and veins
        pad = ell(px, py, r, r * .55) - {(x, y) for x in range(round(px), round(px + r) + 1) for y in range(round(py) - abs(round((x - px) * .12)), round(py) + abs(round((x - px) * .12)) + 1)}   # a thin notch
        c.part(pad, PAD, lambda x, y, px=px, py=py: "deep" if (round(math.degrees(math.atan2(y - py, (x - px) / 2))) % 60) < 8 else None)
    fl = set()
    for a in range(-170, 0, 30): fl |= stroke(16, 9, 16 + math.cos(math.radians(a)) * 3.6, 9 + math.sin(math.radians(a)) * 3.6, 2)
    c.part(fl, PETAL, lambda x, y: "hi" if (x + y) % 3 == 0 else None); c.part(ell(16, 8, 1.4, 1), STAMEN)   # a flower
    return c

def seastack():
    c = Cv(30, 40); W, H = c.w, c.h
    strata = lambda x, y: "deep" if y % 5 == 0 and (x + y) % 7 else "hi" if (x * 3 + y) % 17 == 0 else None
    c.part(poly([(4, H - 3), (6, 22), (8, 12), (11, 4), (16, 1), (20, 5), (22, 14), (25, 24), (26, H - 3)]), ROCK, strata)   # the pillar, wider at the foot
    c.part(poly([(16, 1), (20, 5), (22, 14), (19, 14), (17, 6)]), mat(ROCK["edge"], ROCK["hi"], ROCK["hi"], ROCK["mid"]))   # a lit face
    c.part(poly([(18, 30), (24, 26), (27, H - 3), (17, H - 3)]), DARK(ROCK))   # shade on the right foot
    c.dot([(13, 3), (14, 2), (17, 2), (12, 5)], (240, 238, 228))   # bird lime on the top
    c.part(poly([(12, 0), (13, 0), (14, 1), (12, 1)]), mat((40, 40, 44), (230, 230, 226), (200, 200, 196), (160, 160, 156)))   # a gull
    wet = {(x, y) for x in range(W) for y in range(H - 6, H - 3) if (x, y) in c.px}
    for x, y in wet: c.px[(x, y)] = mix(c.px[(x, y)], (40, 70, 60), .45)   # the wet, weedy band at the waterline
    c.part({p for p in ell(W / 2, H - 3, 14.5, 2.6)} - {p for p in ell(W / 2, H - 3.5, 10.5, 1.6)}, FOAM, lambda x, y: "mid" if (x + y) % 3 else "hi")   # foam ring round the foot
    return c

FRAMES = {"lkelp":6, "lweed":6, "leel":6}
ALL = {"lcoral":coralhead, "lsponge":spongereef, "lkelp":kelpbed, "lcrinoid":crinoids, "lammo":ammonite, "llog":sunkenlog, "ldrift":driftwood, "lweed":waterweed, "leel":eelgrass, "lstones":riverstones, "llily":lilypads, "lstack":seastack}

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "sprites/lagoon"
    os.makedirs(out, exist_ok=True)
    ims = {}
    for k, fn in ALL.items():
        n = FRAMES.get(k, 1)
        for f in range(n):
            im = (fn(f, n) if n > 1 else fn()).img(); im.save(os.path.join(out, k + (f"-{f + 1}" if f else "") + ".png"))
            if not f: ims[k] = im
    for k, im in ims.items(): print(k, im.size)
    if len(sys.argv) > 2: sheet(list(ims.values()), sys.argv[2], (58, 166, 180, 255), Z=6)
