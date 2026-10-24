# Draws the aquarium fittings in the same flat pixel style as the vivarium props (tools/pixelviv.py, whose canvas and ramps it borrows): flat fills, no outlines,
# light from the top left, a lit top-left edge and shade on the undersides and right. Pixels are 0.13 m (ROCK_MPP). All stand upright with their base at the bottom middle.
#   afilter Canister Filter   asump Sump Filter   arock Rock Arch   aweed Seaweed Bed   abubble Bubble Curtain
# Usage: python3 -I tools/pixelaqua.py [outdir] [sheet.png]   (default sprites/viv; the optional sheet is a x8 view of every picture)
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from pixelviv import Cv, ramp, mix, STEEL, STONE, OLIVE

SLATE, KELP, FOAM, LED = ramp((70, 96, 106)), ramp((78, 122, 58)), ramp((159, 207, 224)), ramp((110, 200, 90))

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
    # three columns of bubbles rising, each a 2x2 with a lit corner, smaller and further apart toward the top
    for col, x in enumerate((2, 5, 8)):
        y = 19 - col
        while y > 0:
            big = y > 8
            c.put(x, y, mix(FOAM["hi"], (255, 255, 255), .4))
            if big: c.put(x + 1, y, FOAM["mid"]); c.put(x, y + 1, FOAM["mid"]); c.put(x + 1, y + 1, FOAM["lo"])
            y -= 4 if big else 5
    return c

ALL = {"afilter":canister, "asump":sump, "arock":arch, "aweed":weed, "abubble":bubbles}

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
