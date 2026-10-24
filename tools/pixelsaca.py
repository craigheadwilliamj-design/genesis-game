# Draws the Sacabambaspis in the flat pixel style (see CLAUDE.md, Art direction): flat fills, no outlines, light from the top left, structured texture
# (rows of scale dashes, plate seams), side-on facing right on the usual 100 x 75 species canvas. A jawless Ordovician fish: a big armored head shield, two
# little eyes right at the front like headlights, a small mouth fixed open under them, a scaly body tapering to a fan tail, no other fins.
# Usage: python3 -I tools/pixelsaca.py [out.png] [--sheet sheet.png]   (default sprites/saca.png; the sheet is a x6 view)
import sys, os, math
from PIL import Image

def mix(a, b, t): return tuple(round(x * (1 - t) + y * t) for x, y in zip(a, b))
def ramp(base): return {"hi": mix(base, (255, 255, 255), .26), "mid": base, "lo": mix(base, (0, 0, 0), .22), "deep": mix(base, (0, 0, 0), .45)}
ARMOR, SCALE, BELLY, TAIL, EYE = ramp((176, 148, 92)), ramp((122, 116, 78)), ramp((214, 200, 156)), ramp((104, 98, 66)), ramp((236, 232, 214))
W, H = 100, 75

def body():
    # the outline: a deep rounded head shield in front, tapering back to the tail stalk; (x, top, bottom) for each column
    cols = {}
    for x in range(10, 82):   # round in front up to the deepest point, then a straight taper to the tail stalk
        top = 15 * math.sqrt(max(0, 1 - ((x - 32) / 23) ** 2)) if x <= 32 else 15 - (x - 32) * 13 / 50
        bot = 13 * math.sqrt(max(0, 1 - ((x - 30) / 21) ** 2)) if x <= 30 else 13 - (x - 30) * 11 / 52
        cols[x] = (round(40 - top), round(40 + bot))
    return cols

def draw():
    px = {}
    put = lambda x, y, c: px.__setitem__((x, y), c) if 0 <= x < W and 0 <= y < H else None
    cols = body()
    for x, (top, bot) in cols.items():
        for y in range(top, bot + 1):
            head = x < 40
            R = ARMOR if head else SCALE
            belly = y > 40 + (bot - 40) * .45
            c = BELLY["mid"] if belly and head else BELLY["lo"] if belly else R["mid"]
            if y <= top + 1: c = (ARMOR if head else SCALE)["hi"]   # lit top edge
            elif y >= bot - 1: c = (BELLY if belly else R)["lo"] if y == bot - 1 else R["deep"]   # shade underneath
            put(x, y, c)
    # the head shield: a seam where it meets the body, and plate seams in rows across it
    for x in (39, 40):
        top, bot = cols[x]
        for y in range(top + 2, bot - 1): put(x, y, ARMOR["deep"] if x == 40 else ARMOR["lo"])
    for x in range(16, 38):
        top, bot = cols[x]
        if x % 7 == 3:
            for y in range(top + 3, 40): put(x, y, ARMOR["lo"])
        if (x // 2) % 2 == 0: put(x, top + 6, ARMOR["lo"])
    # scales: staggered rows of short dashes along the body, lit ones on the upper rows
    for x in range(43, 80):
        top, bot = cols[x]
        for y in range(top + 3, bot - 2):
            if (y - top) % 3 == 0 and (x + (y // 3) * 2) % 5 < 2: put(x, y, SCALE["lo"] if y > 40 else SCALE["hi"])
    # the tail: a stalk opening into a fan, longer underneath, with dark rays
    for x in range(80, 97):
        spread = (x - 80) * .9 + 2
        for y in range(round(40 - spread * .8), round(40 + spread * 1.1) + 1):
            c = TAIL["mid"]
            if (y - 40) % 3 == 0: c = TAIL["lo"]
            if y == round(40 - spread * .8): c = TAIL["hi"]
            if x == 96 or y == round(40 + spread * 1.1): c = TAIL["deep"]
            put(x, y, c)
    # the eyes, right at the front: the near one big and round, the far one peeking over the snout
    for (cx, cy, r) in ((15.5, 34.5, 3.2),):
        for y in range(28, 42):
            for x in range(10, 22):
                if (x + .5 - cx) ** 2 + (y + .5 - cy) ** 2 <= r * r: put(x, y, EYE["mid"])
        put(14, 33, EYE["hi"]); put(15, 33, EYE["hi"])
        for (x, y) in ((16, 34), (17, 34), (16, 35), (17, 35)): put(x, y, (24, 22, 18))   # the pupil, looking forward
    for (x, y) in ((11, 30), (12, 30), (12, 29), (11, 31)): put(x, y, EYE["lo"])   # the far eye
    put(11, 29, (24, 22, 18))
    # the mouth: a small dark "o" under the eyes, fixed open
    for (x, y) in ((11, 43), (12, 43), (10, 44), (13, 44), (10, 45), (13, 45), (11, 46), (12, 46)): put(x, y, ARMOR["deep"])
    for (x, y) in ((11, 44), (12, 44), (11, 45), (12, 45)): put(x, y, (58, 34, 30))
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for (x, y), c in px.items(): im.putpixel((x, y), c + (255,))
    return im

if __name__ == "__main__":
    args = sys.argv[1:]
    sheet = args[args.index("--sheet") + 1] if "--sheet" in args else None
    if sheet: del args[args.index("--sheet"):args.index("--sheet") + 2]
    out = args[0] if args else "sprites/saca.png"
    im = draw(); im.save(out)
    if sheet:
        bg = Image.new("RGBA", (W * 6, H * 6), (62, 134, 168, 255)); bg.alpha_composite(im.resize((W * 6, H * 6), Image.NEAREST)); bg.save(sheet)
