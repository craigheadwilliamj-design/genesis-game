# Draws three theme fences as three 3 m sections each in the Dimetrodon's flat style: the adobe wall (desert, 16 px, 2.1 m), the stake fence (boreal and Scandinavian, 12 px, 1.5 m) and the bone fence (ice age and stone age, 18 px, 2.4 m).
# Each has pristine, degrading and broken pictures and a keeper gate with swing frames -1, -2, -3 (each leaf shortens toward its hinge post, the latch goes). Pixels are 0.13 m (ROCK_MPP); every section has a 3 px post on its left edge so sections tile end to end.
# Flat fills, no outline, light from the top left: a lit left and top, a shaded right and bottom, and texture as rhythm (trowel streaks, crossing stakes, growth ticks), never scatter.
#   adobe  plastered mud-brick under a rounded top, with two dark roof-beam ends (vigas) poking out; the plaster flakes off to bare bricks, cracks and erodes at the foot when degrading; a slumped heap of mud with a fallen beam when broken. Gate: turquoise plank leaves between rounded adobe posts.
#   stake  the Scandinavian gardsgard: pale split stakes leaning both ways, crossing, bound to two riders between round posts; grey, mossy and gappy when degrading; collapsed stakes lying near the ground when broken. Gate: a braced timber bar gate.
#   bone   mammoth ribs leaning in a V, lashed with rawhide to a femur post with a knuckle top; yellowed, cracked and mossy when degrading; scattered bones, a tusk and a small skull when broken. Gate: rib leaves between femur posts.
# Every gate has a gold latch plate (the gate marker's #D8B04A) and never wears.
# Usage: python3 -I tools/pixelfence_themed.py [outdir] [sheet.png]   (default sprites/fence; the optional sheet is a x12 view of every picture)
import sys, os
from PIL import Image

W = 23
def mix(a, b, t): return tuple(round(x * (1 - t) + y * t) for x, y in zip(a, b))
def ramp(base): return {"hi": mix(base, (255, 255, 255), .28), "mid": base, "lo": mix(base, (0, 0, 0), .26), "deep": mix(base, (0, 0, 0), .46)}
ADO = ramp((204, 152, 98)); ADB = ramp((176, 108, 60)); TURQ = ramp((64, 156, 148)); BEAM = ramp((98, 66, 40))
PINE = ramp((184, 146, 92)); GREY = ramp((140, 134, 122)); RIDER = ramp((120, 92, 60))
IVORY = ramp((226, 212, 176)); BONEO = ramp((196, 172, 112)); HIDE = ramp((126, 88, 58))
MOSS = ramp((97, 111, 34)); DRY = (176, 160, 92); GOLD = ramp((216, 176, 74)); SKIN = (60, 44, 34)

class Sec:
    def __init__(s, h): s.px = {}; s.H = h
    def put(s, x, y, c):
        if 0 <= x < W and 0 <= y < s.H: s.px[(x, y)] = c
    def clear(s, x, y): s.px.pop((x, y), None)
    def box(s, x0, y0, x1, y1):
        for x in range(x0, x1):
            for y in range(y0, y1): s.clear(x, y)
    def img(s):
        im = Image.new("RGBA", (W, s.H), (0, 0, 0, 0))
        for (x, y), c in s.px.items(): im.putpixel((x, y), c + (255,))
        return im

# ===================================================================== ADOBE (23 x 16)
AH = 16
def adobe_body(s, x0, x1):
    for y in range(2, AH - 1):
        for x in range(x0, x1): s.put(x, y, ADO["mid"])
    for x in range(x0, x1):
        s.put(x, AH - 1, ADO["deep"]); s.put(x, AH - 2, ADO["lo"]); s.put(x, AH - 3, ADO["lo"] if x % 3 else ADO["mid"])        # the damp foot
        s.put(x, 2, ADO["lo"])                                                                                                  # shade under the cap
    for y in (6, 9, 12):                                                                                                        # trowel streaks: short lit dashes in rows
        for x in range(x0, x1):
            if (x + y * 2) % 7 in (0, 1): s.put(x, y, ADO["hi"])
    for y, x in ((7, 11), (10, 5), (11, 18), (8, 20), (5, 4)): s.put(x, y, ADO["lo"])

def adobe_post(s):
    for y in range(2, AH - 1):
        for x, key in enumerate(("hi", "mid", "lo")): s.put(x, y, ADO[key])
    for x in range(3): s.put(x, AH - 1, ADO["deep"]); s.put(x, AH - 2, ADO["lo"])

def adobe_top(s):
    for x in range(W): s.put(x, 0, ADO["hi"] if 0 < x < W - 1 else ADO["mid"]) if 0 < x < W - 1 else None
    for x in range(W): s.put(x, 1, ADO["hi"] if x % 6 < 3 else ADO["mid"])
    s.put(0, 1, ADO["mid"]); s.put(W - 1, 1, ADO["lo"])

def adobe_vigas(s, xs):
    for x in xs:                                    # a round beam end: dark, lit top left, a shadow under it
        s.put(x, 5, BEAM["hi"]); s.put(x + 1, 5, BEAM["hi"]); s.put(x + 2, 5, BEAM["mid"]); s.put(x, 6, BEAM["mid"]); s.put(x + 1, 6, BEAM["lo"]); s.put(x + 2, 6, BEAM["deep"]); [s.put(x + i, 7, ADO["lo"]) for i in range(3)]

def adobe_pristine():
    s = Sec(AH); adobe_body(s, 3, W); adobe_post(s); adobe_top(s); adobe_vigas(s, (9, 17)); return s
def adobe_degrading():
    s = adobe_pristine()
    for x in range(11, 17):                                                                                                      # plaster gone: bare bricks showing
        for y in range(8, 12):
            c = ADB["mid"] if (x + (2 if y % 2 else 0)) % 3 else ADB["lo"]
            s.put(x, y, c)
    for x in range(11, 17): s.put(x, 8, ADB["hi"]) if x % 3 == 0 else None
    s.put(10, 9, ADO["lo"]); s.put(17, 10, ADO["lo"]); s.put(12, 12, ADO["lo"])
    for x, y in ((6, 3), (6, 4), (7, 5), (7, 6), (8, 7), (19, 3), (19, 4), (20, 5)): s.put(x, y, ADO["deep"])                   # cracks
    for x in range(3, W):                                                                                                         # the foot eroded and dry weeds
        if x % 4 in (0, 1): s.put(x, AH - 4, ADO["lo"]); s.put(x, AH - 3, ADO["deep"])
        if x % 5 == 2: s.put(x, AH - 4, DRY); s.put(x, AH - 5, DRY) if x % 10 == 2 else None
    s.clear(13, 0); s.clear(14, 0); s.put(13, 1, ADO["lo"]); s.put(14, 1, ADO["lo"])                                             # a worn top
    s.put(0, AH - 4, DRY); s.put(2, AH - 5, DRY)
    return s
def adobe_broken():
    s = adobe_pristine()
    s.box(6, 0, 19, AH - 1)
    for x in range(3, 6):                                                                                                         # ragged ends of the standing wall
        for y in range(0, 3 + (x - 3) * 2): s.clear(x, y)
    for x in range(19, W):
        for y in range(0, 2 + (x - 19) * 2 if x < 21 else 0): s.clear(x, y)
    for x, y in ((6, 6), (6, 7), (7, 5), (7, 6), (5, 9)): s.put(x, y, ADO["mid"]) if x < 6 else None
    heap = ((6, 10, 5, 5), (10, 9, 5, 6), (14, 11, 4, 4), (8, 12, 4, 3), (12, 12, 4, 3))
    for x0, y0, w, h in heap:
        for x in range(x0, x0 + w):
            for y in range(y0, min(y0 + h, AH - 1)): s.put(x, y, ADO["hi"] if (x == x0 or y == y0) else ADO["lo"] if (x == x0 + w - 1 or y == y0 + h - 1) else ADO["mid"])
    for x in range(6, 19): s.put(x, AH - 1, ADO["deep"])
    for x in range(9, 16): s.put(x, 8, BEAM["mid"]); s.put(x, 9, BEAM["lo"]) if x > 9 else None                                  # a fallen beam across the heap
    s.put(9, 8, BEAM["hi"]); s.put(9, 9, BEAM["mid"])
    for x, y in ((11, 11), (15, 13), (8, 14)): s.put(x, y, ADB["mid"])
    return s

def adobe_gpost(s, x0):
    for y in range(1, AH - 1):
        for x, key in enumerate(("hi", "mid", "lo")): s.put(x0 + x, y, ADO[key])
    s.put(x0, 0, ADO["mid"]); s.put(x0 + 1, 0, GOLD["mid"]); s.put(x0 + 2, 0, ADO["lo"])
    for x in range(3): s.put(x0 + x, AH - 2, ADO["lo"]); s.put(x0 + x, AH - 1, ADO["deep"])
def adobe_leaf(s, xa, xb, left):
    for x in range(xa, xb + 1):
        for y in range(3, AH - 1): s.put(x, y, TURQ["lo"] if (x - xa) % 3 == 2 else TURQ["hi"] if (x - xa) % 3 == 0 else TURQ["mid"])
    for x in range(xa, xb + 1): s.put(x, 3, TURQ["hi"]); s.put(x, AH - 2, TURQ["deep"])
    for y in (6, 11):
        for x in range(xa, xb + 1): s.put(x, y, BEAM["mid"]); s.put(x, y + 1, BEAM["lo"]) if x % 2 else None
    for y in range(3, AH - 1): s.put(xa if left else xb, y, TURQ["deep"])

# ===================================================================== STAKE FENCE (23 x 12)
SH = 12
def stake_line(s, x, up_right, pal, k):
    # one stake: a diagonal, two px across for every four up, 1 px wide with a lit upper edge
    for y in range(SH - 2, 0, -1):
        t = SH - 2 - y
        xx = x + t if up_right else x + 9 - t
        if 3 <= xx < W: s.put(xx, y, pal["mid"]); s.put(xx + 1, y, pal["lo"]) if 3 <= xx + 1 < W and t % 2 == 0 else None
        if 3 <= xx < W and t == SH - 3: s.put(xx, y, pal["hi"])
def stake_base(pal, skip=()):
    s = Sec(SH)
    for y in (3, 8):                                                                       # the two riders the stakes cross over
        for x in range(3, W): s.put(x, y, RIDER["hi"] if pal is PINE else GREY["hi"]); s.put(x, y + 1, RIDER["lo"] if pal is PINE else GREY["lo"])

    for i, x in enumerate(range(-8, 24, 8)):
        if i in skip: continue
        stake_line(s, x, True, pal, i)
        stake_line(s, x + 1, False, pal, i)
    for y in range(1, SH - 1):                                                             # the round post
        for x, key in enumerate(("hi", "mid", "lo")): s.put(x, y, (PINE if pal is PINE else GREY)[key])
    s.put(0, 1, PINE["hi"] if pal is PINE else GREY["hi"]); s.put(1, 0, pal["hi"]); s.put(2, 1, pal["lo"]); s.put(0, 0, None) if False else None
    for y in (3, 8):
        for x in range(3): s.put(x, y, RIDER["mid"] if pal is PINE else GREY["mid"])
    for x in range(W): s.put(x, SH - 1, PINE["deep"] if pal is PINE else GREY["deep"])
    return s
def stake_pristine(): return stake_base(PINE)
def stake_degrading():
    s = stake_base(GREY, skip=(2,))
    for x in range(W):
        if x % 4 in (0, 1): s.put(x, SH - 2, MOSS["mid"]); s.put(x, SH - 3, MOSS["lo"]) if x % 4 == 1 else None
    for x, y in ((6, 5), (14, 6), (19, 4), (10, 7)): s.put(x, y, GREY["deep"])
    for x in range(12, 17): s.clear(x, 3); s.clear(x, 4)                                  # a rider sagging at the middle
    for x in range(12, 17): s.put(x, 4 + (x - 12) // 2, GREY["lo"])
    s.put(1, 5, MOSS["lo"]); s.put(0, 7, MOSS["mid"]); s.put(2, 9, MOSS["lo"])
    return s
def stake_broken():
    s = stake_pristine()
    s.box(5, 0, 19, SH - 1)
    for x, y in ((5, 2), (5, 3), (6, 4), (18, 3), (18, 4), (19, 5)): s.put(x, y, None) if False else None
    for x in range(5, 19): s.put(x, SH - 1, PINE["deep"])
    for x0, y0, n, dy in ((6, 7, 8, 0), (9, 5, 7, 1), (12, 9, 6, 0), (7, 4, 5, 1)):        # stakes fallen, lying at shallow angles
        for i in range(n):
            y = y0 + (i * dy) // 3
            s.put(x0 + i, y, PINE["hi"] if i == 0 else PINE["mid"]); s.put(x0 + i, y + 1, PINE["lo"])
    for x, y in ((5, 3), (5, 4), (18, 2), (18, 3), (17, 4)): s.put(x, y, PINE["mid"])      # split ends of the rider left hanging
    return s

def stake_gpost(s, x0):
    for y in range(1, SH - 1):
        for x, key in enumerate(("hi", "mid", "lo")): s.put(x0 + x, y, PINE[key])
    s.put(x0 + 1, 0, GOLD["mid"]); s.put(x0, 0, PINE["hi"]); s.put(x0 + 2, 0, PINE["lo"])
    for x in range(3): s.put(x0 + x, SH - 1, PINE["deep"])
def stake_leaf(s, xa, xb, left):
    for y in (2, 5, 8):
        for x in range(xa, xb + 1): s.put(x, y, PINE["hi"]); s.put(x, y + 1, PINE["lo"])
    span = max(1, xb - xa)
    for x in range(xa, xb + 1):
        yy = round(8 - 6 * (x - xa) / span) if left else round(2 + 6 * (x - xa) / span)
        s.put(x, yy, PINE["mid"]); s.put(x, yy + 1, PINE["hi"]) if x % 2 else None
    for y in range(2, SH - 1): s.put(xa if left else xb, y, PINE["lo"])

# ===================================================================== BONE FENCE (23 x 18)
BH = 18
def rib(s, x, tip, lean, pal):
    # a rib: two px wide, leaning one way over its height, a pointed tip, a lit left and a dark right
    for y in range(tip, BH - 1):
        xx = x + round((BH - 2 - y) * lean / (BH - 2 - tip))
        if 3 <= xx and xx + 1 < W + 1:
            s.put(xx, y, pal["hi"] if y < tip + 2 else pal["mid"])
            if xx + 1 < W and y > tip: s.put(xx + 1, y, pal["lo"])
        if (y - tip) % 6 == 5 and 3 <= xx < W: s.put(xx, y, pal["lo"])                     # a growth tick
    for x2 in range(x, x + 2): s.put(x2, BH - 1, pal["deep"]) if 3 <= x2 < W else None
def bone_base(pal, tips, skip=()):
    s = Sec(BH)
    for i, (x, tip) in enumerate(zip(range(4, 22, 3), tips)):
        if i in skip: continue
        rib(s, x, tip, 2 if i % 2 else -2, pal)
    for y in (6, 12):                                                                       # rawhide lashings and a knot
        for x in range(W): s.put(x, y, HIDE["mid"]); s.put(x, y + 1, HIDE["lo"])
        s.put(5, y - 1, HIDE["hi"]); s.put(14, y - 1, HIDE["hi"]); s.put(20, y - 1, HIDE["hi"])
    for y in range(3, BH - 1):                                                              # the femur post
        for x, key in enumerate(("hi", "mid", "lo")): s.put(x, y, pal[key])
    for x in range(3): s.put(x, 2, pal["mid"]); s.put(x, BH - 1, pal["deep"])
    s.put(0, 1, pal["hi"]); s.put(2, 1, pal["mid"]); s.put(0, 2, pal["hi"]); s.put(1, 2, pal["hi"])      # the knuckle
    for y in (6, 12):
        for x in range(3): s.put(x, y, HIDE["mid"]); s.put(x, y + 1, HIDE["lo"])
    return s
def bone_pristine(): return bone_base(IVORY, [1, 3, 0, 2, 1, 3])
def bone_degrading():
    s = bone_base(BONEO, [2, 6, 1, 3, 4, 5], skip=(1,))
    for x, y0, n in ((10, 8, 4), (16, 3, 5), (19, 9, 4), (7, 4, 3)):                       # cracks
        for k in range(n): s.put(x, y0 + k, BONEO["deep"])
    for x in range(W):
        if x % 5 in (0, 1, 2): s.put(x, BH - 2, MOSS["mid"]); s.put(x, BH - 3, MOSS["lo"]) if x % 5 == 1 else None
    for x, y in ((5, 6), (6, 6), (14, 12), (15, 12), (20, 6)): s.clear(x, y)               # lashings gone in patches
    s.put(1, 9, MOSS["lo"]); s.put(0, 14, MOSS["mid"]); s.put(2, 15, MOSS["lo"])
    return s
def bone_broken():
    s = bone_pristine()
    s.box(6, 0, 19, BH - 1)
    for x in range(6, 19): s.put(x, BH - 1, IVORY["deep"])
    for x, top in ((7, 12), (10, 9), (15, 13)):                                             # snapped rib stubs
        for y in range(top, BH - 1): s.put(x, y, IVORY["mid"]); s.put(x + 1, y, IVORY["lo"])
        s.put(x, top, IVORY["hi"]); s.put(x + 1, top - 1, IVORY["lo"]) if x % 2 else None
    for x in range(7, 17):                                                                  # a long tusk lying across, curved up at the tip
        y = 15 - (1 if x > 13 else 0) - (1 if x > 15 else 0)
        s.put(x, y, IVORY["hi"]); s.put(x, y + 1, IVORY["mid"]); s.put(x, y + 2, IVORY["lo"]) if x < 15 else None
    for x, y in ((12, 11), (13, 11), (14, 12), (11, 12), (12, 12)): s.put(x, y, IVORY["mid"])    # a skull
    for x, y in ((11, 11), (12, 12), (13, 12)): s.put(x, y, IVORY["hi"])
    s.put(12, 11, IVORY["hi"]); s.put(13, 12, SKIN); s.put(11, 12, IVORY["lo"])
    for x, y in ((8, 13), (14, 14), (9, 16), (16, 15)): s.put(x, y, IVORY["lo"])
    return s

def bone_gpost(s, x0):
    for y in range(2, BH - 1):
        for x, key in enumerate(("hi", "mid", "lo")): s.put(x0 + x, y, IVORY[key])
    for x in range(3): s.put(x0 + x, 1, IVORY["mid"]); s.put(x0 + x, BH - 1, IVORY["deep"])
    s.put(x0, 0, IVORY["hi"]); s.put(x0 + 1, 0, GOLD["mid"]); s.put(x0 + 2, 0, IVORY["lo"])
    for y in (6, 12):
        for x in range(3): s.put(x0 + x, y, HIDE["mid"]); s.put(x0 + x, y + 1, HIDE["lo"])
def bone_leaf(s, xa, xb, left):
    for x in range(xa, xb + 1):
        if (x - xa) % 3 != 2:
            tip = 3 + (x - xa) % 2
            for y in range(tip, BH - 1): s.put(x, y, IVORY["hi"] if (x - xa) % 3 == 0 and y < tip + 2 else IVORY["mid"] if (x - xa) % 3 == 0 else IVORY["lo"])
    for y in (6, 12):
        for x in range(xa, xb + 1): s.put(x, y, HIDE["mid"]); s.put(x, y + 1, HIDE["lo"])
    for y in range(3, BH - 1): s.put(xa if left else xb, y, IVORY["lo"])

def gate(H, post, leaf, latch, sc=1.0):
    s = Sec(H); post(s, 0); post(s, 20)
    fl = lambda x: 3 + round((x - 3) * sc); fr = lambda x: 19 - round((19 - x) * sc)
    leaf(s, 3, fl(10), True); leaf(s, fr(11), 19, False)
    if sc == 1.0: latch(s)
    return s
def gold_latch(y):
    def f(s):
        for x in (10, 11): s.put(x, y, GOLD["hi"]); s.put(x, y + 1, GOLD["mid"]); s.put(x, y + 2, GOLD["lo"])
    return f

KINDS = {
    "adobe": (AH, (adobe_pristine, adobe_degrading, adobe_broken), lambda sc: gate(AH, adobe_gpost, adobe_leaf, gold_latch(8), sc)),
    "stake": (SH, (stake_pristine, stake_degrading, stake_broken), lambda sc: gate(SH, stake_gpost, stake_leaf, gold_latch(4), sc)),
    "bone":  (BH, (bone_pristine, bone_degrading, bone_broken), lambda sc: gate(BH, bone_gpost, bone_leaf, gold_latch(9), sc)),
}

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "sprites/fence"
    sheet_path = sys.argv[2] if len(sys.argv) > 2 else None
    os.makedirs(out, exist_ok=True)
    z, gap, RH = 12, 4, 20
    sheet = Image.new("RGBA", ((4 * (W + gap) + gap) * z, (2 * len(KINDS) * (RH + gap) + gap) * z), (176, 190, 150, 255))
    row = 0
    for k, (h, states, gt) in KINDS.items():
        for i, (name, fn) in enumerate(zip(("pristine", "degrading", "broken"), states)):
            im = fn().img(); im.save(f"{out}/{k}-{name}.png"); print(k, name, im.size)
            sheet.alpha_composite(im.resize((W * z, h * z), Image.NEAREST), ((gap + i * (W + gap)) * z, (gap + row * (RH + gap)) * z))
        row += 1
        for i, (suf, sc) in enumerate((("", 1.0), ("-1", .66), ("-2", .33), ("-3", .1))):
            im = gt(sc).img(); im.save(f"{out}/{k}-gate{suf}.png")
            sheet.alpha_composite(im.resize((W * z, h * z), Image.NEAREST), ((gap + i * (W + gap)) * z, (gap + row * (RH + gap)) * z))
        row += 1
    if sheet_path: sheet.save(sheet_path)
