# Draws the aquarium fittings in the park style like the vivarium props (tools/pixelviv.py, whose canvas, materials and outline it borrows): a dark edge tinted
# to each material round the silhouette, light from the top left, a lit top-left edge and shade on the undersides and right. Pixels are 0.13 m (ROCK_MPP). All stand upright with their base at the bottom middle.
#   afilter Canister Filter   asump Sump Filter   arock Rock Arch   aweed Seaweed Bed   abubble Bubble Curtain
#   aboulder Boulder Pile   abrain Brain Coral   acoral Branching Coral   afan Sea Fan   asponge Sponge Cluster   akelp Kelp Stand   ashell Giant Ammonite Shell
# Usage: python3 -I tools/pixelaqua.py [outdir] [sheet.png]   (default sprites/viv; the optional sheet is a x8 view of every picture)
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from pixelviv import Cv, ramp, mat, mix, NO_EDGE, STEEL, STONE, OLIVE

SLATE, FOAM, LED = mat((18, 32, 38), (98, 128, 138), (70, 96, 106), (50, 72, 80)), mat((52, 100, 120), (232, 244, 244), (176, 214, 218), (126, 168, 170)), ramp((110, 200, 90))
KELP = mat((18, 34, 19), (63, 124, 69), (48, 94, 50), (43, 84, 45))   # PAL greens
CORAL, BRAIN, FAN, SPONGE, GOLD, SHELL = ramp((228, 132, 70)), ramp((192, 172, 100)), ramp((156, 84, 146)), ramp((184, 144, 92)), ramp((150, 132, 52)), ramp((196, 168, 120))

def box(c, x0, y0, x1, y1, R):
    # a lit top row and left column, a shade row along the bottom and a shade column down the right
    c.rect(x0, y0, x1, y1, R["mid"])
    for x in range(x0, x1 + 1): c.put(x, y0, R["hi"]); c.put(x, y1, R["lo"])
    for y in range(y0, y1 + 1): c.put(x0, y, R["hi"]); c.put(x1, y, R["lo"])

def canister():
    c = Cv(10, 16)
    box(c, 1, 5, 7, 15, SLATE)                  # the canister
    for y in (8, 11):
        for x in range(2, 7): c.put(x, y, SLATE["lo"])   # its bands
    box(c, 0, 3, 8, 5, STEEL)                   # the lid
    c.rect(4, 0, 5, 2, STEEL["mid"]); c.put(4, 0, STEEL["hi"]); c.put(5, 1, STEEL["lo"])   # the intake pipe up out of the lid
    c.rect(8, 0, 9, 0, STEEL["mid"]); c.put(6, 0, STEEL["mid"]); c.put(7, 0, STEEL["mid"])
    c.put(2, 13, LED["hi"])                     # the running light
    for x in range(1, 8): c.put(x, 15, SLATE["deep"])
    return c

def sump():
    c = Cv(18, 14)
    box(c, 1, 4, 16, 13, SLATE)                 # the cabinet
    box(c, 0, 2, 17, 4, STEEL)                  # its lid
    for x in range(3, 15, 2):                   # vent slats
        for y in range(6, 10): c.put(x, y, SLATE["deep"] if y < 9 else SLATE["lo"])
    c.rect(3, 0, 4, 1, STEEL["mid"]); c.put(3, 0, STEEL["hi"])   # return pipes
    c.rect(13, 0, 14, 1, STEEL["mid"]); c.put(13, 0, STEEL["hi"])
    c.put(3, 11, LED["hi"]); c.put(5, 11, LED["mid"])
    for x in range(1, 17): c.put(x, 13, SLATE["deep"])
    return c

def arch():
    c = Cv(20, 12)
    # a stone arch: a low dome with a dark hollow through it, lit on the top left, a few cracks in rows
    for y in range(12):
        for x in range(20):
            if c.inside(x, y, 10, 12.5, 10, 12):
                lit = (x - 10) / 10 + (y - 12.5) / 12 < -.95
                shade = x > 14 or y > 10
                c.put(x, y, STONE["hi"] if lit else STONE["lo"] if shade else STONE["mid"])
    for y in range(5, 12):
        for x in range(20):
            if c.inside(x, y, 10, 12.5, 4.2, 6.8): c.put(x, y, STONE["deep"])
    for (x, y) in ((4, 4), (5, 5), (15, 3), (16, 4), (2, 8), (17, 8)):
        if (x, y) in c.px and c.px[(x, y)] != STONE["deep"]: c.put(x, y, STONE["lo"])
    for (x, y) in ((6, 2), (7, 2), (12, 1), (13, 1)): c.put(x, y, OLIVE["mid"])   # a bit of growth on top
    return c

def weed():
    c = Cv(14, 22)
    # five fronds swaying up from a stony base: each a two-pixel stalk, its left pixel lit, with leaves stepping off it
    fronds = ((2, 12, (0, 1, 1, 0, -1, -1, 0)), (5, 19, (0, 0, 1, 1, 0, 0, -1, -1, 0, 0)), (8, 21, (0, -1, -1, 0, 1, 1, 0, 0, -1, -1, 0)), (10, 15, (0, 1, 1, 0, 0, -1, -1, 0)), (12, 9, (0, -1, -1, 0, 0)))
    for x0, tall, sway in fronds:
        x = x0
        for i in range(tall):
            y = 20 - i
            x = x0 + sway[(i // 2) % len(sway)]
            c.put(x, y, KELP["hi"]); c.put(x + 1, y, KELP["lo"])
            if i % 4 == 2 and i < tall - 1: c.put(x - 1, y, KELP["mid"]); c.put(x + 2, y - 1, KELP["mid"])
        c.put(x, 20 - tall, KELP["hi"])
    for x in range(1, 14): c.put(x, 21, STONE["lo"]); c.put(x, 20, STONE["mid"] if x % 3 else STONE["hi"])
    return c

def bubbles():
    c = Cv(12, 24)
    box(c, 1, 21, 10, 23, STEEL)                # the air bar on the floor
    for x in range(3, 9, 2): c.put(x, 22, STEEL["deep"])   # its holes
    # three staggered columns of bubbles rising, each a ring with a lit corner: 4 px low down, 3 px higher, 2 px near the top
    E, H, M = FOAM["lo"], FOAM["hi"], FOAM["mid"]
    BIG, MID, SMALL = [".EE.", "EHME", "EMME", ".EE."], [".E.", "EHE", ".E."], ["HE", "EE"]
    for x0, y in ((0, 16), (4, 12), (8, 17)):
        while y > 0:
            g = BIG if y > 11 else MID if y > 5 else SMALL
            for j, r in enumerate(g):
                for i, ch in enumerate(r):
                    if ch != ".": c.put(x0 + i + (2 - len(g[0]) // 2), y + j, {"E": E, "H": H, "M": M}[ch])
            y -= 5 if y > 11 else 4
    NO_EDGE.update((E, H, M))   # the rings are their own edge
    return c

def lump(c, cx, cy, rx, ry, R, cut=None):
    # a rounded mound lit on the top left and shaded on the bottom right, cut flat at row `cut`
    for y in range(c.h):
        for x in range(c.w):
            if (cut is None or y <= cut) and c.inside(x, y, cx, cy, rx, ry):
                t = (x + .5 - cx) / rx + (y + .5 - cy) / ry
                c.put(x, y, R["hi"] if t < -.8 else R["lo"] if t > .55 else R["mid"])

def boulders():
    c = Cv(18, 10)
    lump(c, 5, 10, 5, 9.5, STONE, 9); lump(c, 13, 10, 5, 7.5, STONE, 9); lump(c, 9, 10, 3.5, 5, STONE, 9)   # three stones, the middle one in front
    for x in range(18):
        if (x, 9) in c.px: c.put(x, 9, STONE["deep"])
    for (x, y) in ((3, 5), (4, 6), (14, 6), (15, 7)): c.put(x, y, STONE["lo"])   # cracks
    return c

def brain():
    c = Cv(16, 10)
    lump(c, 8, 10, 8, 9.5, BRAIN, 9)
    for (x, y) in list(c.px):   # winding grooves in rows, stepping like a maze
        if c.px[(x, y)] != BRAIN["hi"] and y < 9 and (x + (y // 2) * 3) % 5 == 0: c.put(x, y, BRAIN["deep"])
    for x in range(16):
        if (x, 9) in c.px: c.put(x, 9, BRAIN["lo"])
    return c

def coral():
    c = Cv(16, 16)
    # branching coral: a stout base splitting into upturned arms, each lit on its left pixel, tipped paler
    arms = ((7, 15, 7, 8), (7, 9, 3, 4), (3, 4, 2, 1), (8, 9, 12, 3), (12, 3, 13, 0), (7, 8, 6, 2), (10, 6, 14, 6), (14, 6, 14, 3), (5, 11, 1, 9), (1, 9, 1, 6))
    for x0, y0, x1, y1 in arms: c.line(x0, y0, x1, y1, 2, CORAL["hi"], CORAL["mid"], CORAL["lo"])
    for (x, y) in ((2, 1), (13, 0), (6, 2), (14, 3), (1, 6), (3, 4)): c.put(x, y, mix(CORAL["hi"], (255, 255, 255), .35))
    for x in range(5, 11): c.put(x, 15, CORAL["deep"])
    return c

def fan():
    c = Cv(16, 18)
    for y in range(13, 18): c.put(7, y, FAN["mid"]); c.put(8, y, FAN["lo"])   # the stem
    # a flat half-round fan: ribs fanning out from the stem's top and two rings of cross strands, lit along its top left rim
    for y in range(14):
        for x in range(16):
            if not c.inside(x, y, 8, 14, 8, 14): continue
            dx, dy = x + .5 - 8, 14 - (y + .5); ang = math.degrees(math.atan2(dy, dx)); r = math.hypot(dx, dy * 8 / 14)
            rib = int(ang) % 22 < 5 and r > 1.5; ring = abs(r - 4.5) < .5 or abs(r - 6.8) < .45
            rim = not c.inside(x - 1, y, 8, 14, 8, 14) or not c.inside(x, y - 1, 8, 14, 8, 14)
            c.put(x, y, FAN["hi"] if rim and x < 10 else FAN["lo"] if rib or ring or (rim and x >= 10) else FAN["mid"])
    for x in range(4, 12): c.put(x, 17, FAN["deep"])
    return c

def sponges():
    c = Cv(14, 14)
    for x0, top, w in ((1, 6, 3), (5, 1, 4), (10, 4, 3)):   # three barrel sponges of different heights, each open at the top
        for y in range(top, 14):
            for k in range(w): c.put(x0 + k, y, SPONGE["hi"] if k == 0 else SPONGE["lo"] if k == w - 1 else SPONGE["mid"])
        for k in range(1, w - 1): c.put(x0 + k, top, SPONGE["deep"])
        for y in range(top + 3, 13, 3): c.put(x0 + w // 2, y, SPONGE["lo"])   # pores in a row
    for x in range(14):
        if (x, 13) in c.px: c.put(x, 13, SPONGE["deep"])
    return c

def kelpstand():
    c = Cv(12, 30)
    for x0, tall, ph in ((3, 29, 0), (7, 24, 2)):   # two stalks stepping side to side, a blade every four rows on alternate sides, a float at each blade
        for i in range(tall):
            sx = x0 + (1 if ((i + ph) // 4) % 2 else 0); c.put(sx, 29 - i, GOLD["mid"])
            if i > 2 and i % 4 == 1:
                d = 1 if ((i + ph) // 4) % 2 else -1
                for k in range(1, 4): c.put(sx + d * k, 29 - i - k // 2, GOLD["hi"] if d < 0 else GOLD["lo"])
                c.put(sx, 29 - i, GOLD["deep"])
    for x in range(2, 10): c.put(x, 29, STONE["mid"])   # the holdfast on a stone
    return c

def shell():
    c = Cv(20, 17)
    # a big ammonite lying on its edge: a coil with ribs, lit on the top left, its opening dark on the right
    lump(c, 10, 9, 9.5, 8, SHELL)
    for (x, y) in list(c.px):
        d = math.hypot(x + .5 - 10, (y + .5 - 9) * 9.5 / 8)
        if int(d) in (3, 6) and c.px[(x, y)] != SHELL["hi"]: c.put(x, y, SHELL["lo"])   # the whorls
        elif d > 6.5 and math.atan2(y + .5 - 9, x + .5 - 10) * 18 / math.pi % 2 < .7: c.put(x, y, SHELL["lo"] if x > 10 else SHELL["mid"])   # ribs round the outer whorl
    for y in range(7, 13):
        for x in range(16, 20):
            if c.inside(x, y, 10, 9, 9.5, 8) and not c.inside(x, y, 10, 9, 7.6, 6.4): c.put(x, y, SHELL["deep"])   # the opening
    c.put(10, 9, SHELL["deep"]); c.put(9, 9, SHELL["lo"])
    for x in range(3, 17):
        if (x, 16) in c.px: c.put(x, 16, SHELL["deep"])
    return c

ALL = {"afilter":canister, "asump":sump, "arock":arch, "aweed":weed, "abubble":bubbles, "aboulder":boulders, "abrain":brain, "acoral":coral, "afan":fan, "asponge":sponges, "akelp":kelpstand, "ashell":shell}

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "sprites/viv"
    os.makedirs(out, exist_ok=True)
    ims = {}
    for k, fn in ALL.items():
        ims[k] = fn().img(); ims[k].save(os.path.join(out, k + ".png"))
    if len(sys.argv) > 2:
        Z, pad = 8, 3
        sheet = Image.new("RGBA", (sum(i.width for i in ims.values()) * Z + pad * Z * (len(ims) + 1), max(i.height for i in ims.values()) * Z + pad * Z * 2), (62, 134, 168, 255))
        x = pad * Z
        for im in ims.values():
            sheet.alpha_composite(im.resize((im.width * Z, im.height * Z), Image.NEAREST), (x, pad * Z)); x += (im.width + pad) * Z
        sheet.save(sys.argv[2])
