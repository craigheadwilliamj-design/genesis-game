# Draws four more fences as three 3 m sections each in the Dimetrodon's flat style: the bamboo fence (15 px, 1.9 m), the log palisade (22 px, 2.8 m), the wrought-iron fence (17 px, 2.2 m) and the dry-stone wall (11 px, 1.4 m).
# Each has pristine, degrading and broken pictures and a keeper gate with swing frames -1, -2, -3 (each leaf shortens toward its hinge post, the latch goes). Pixels are 0.13 m (ROCK_MPP); every section has a 3 px post or quoin on its left edge so sections tile end to end.
# Flat fills, no outline, light from the top left: each cane, log or stone has a lit left and top and a shaded right and bottom; texture is rhythm (nodes, bark grooves, courses), never scatter.
#   bamboo   green canes with darker nodes between rope lashings; yellowed, split and frayed when degrading; snapped stubs and fallen canes when broken. Gate: bamboo leaves with a diagonal brace.
#   palisade pointed brown logs bound with rope, weathered grey with moss and a rotted log when degrading; stumps and a fallen log when broken. Gate: plank leaves with iron bands.
#   iron     black bars with spear finials, two rails and scroll rings, see-through; rusting, a bent bar and a missing finial when degrading; stubs, a hanging rail and a bar on the ground when broken. Gate: ornate bar leaves.
#   drystone a low mortarless wall of rounded stones under scalloped caps, mossy; more moss, a missing stone and a slipped cap when degrading; a tumbled gap with a heap when broken. Gate: a timber field gate between two stone posts.
# Every gate has a gold latch plate (the gate marker's #D8B04A) and never wears.
# Usage: python3 -I tools/pixelfence_more.py [outdir] [sheet.png]   (default sprites/fence; the optional sheet is a x12 view of every picture)
import sys, os
from PIL import Image

W = 23
def mix(a, b, t): return tuple(round(x * (1 - t) + y * t) for x, y in zip(a, b))
def ramp(base): return {"hi": mix(base, (255, 255, 255), .28), "mid": base, "lo": mix(base, (0, 0, 0), .26), "deep": mix(base, (0, 0, 0), .46)}
BAM = ramp((126, 146, 52)); BAMO = ramp((190, 164, 80)); ROPE = ramp((176, 136, 86))
LOG = ramp((140, 96, 58)); LOGO = ramp((134, 128, 116)); SOIL = ramp((110, 84, 56))
IRON = ramp((50, 56, 64)); RUST = ramp((178, 78, 0))
DS = [ramp((152, 146, 132)), ramp((134, 132, 122)), ramp((160, 148, 126))]; DSJ = mix(DS[0]["lo"], (30, 26, 20), .3)
MOSS = ramp((97, 111, 34)); LICHEN = (172, 170, 92)
WOOD = ramp((120, 86, 54))
GOLD = ramp((216, 176, 74))

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

def hsh(x, y): return (x * 7 + y * 13 + x * y * 3) % 5

# ===================================================================== BAMBOO (23 x 15)
BAH = 15
def cane(s, x, w, top, pal):
    for y in range(top, BAH - 1):
        for i in range(w): s.put(x + i, y, pal["hi"] if i == 0 and y == top else pal["mid"] if i < w - 1 else pal["lo"])
        if (y - top) % 5 == 4:                          # a node: a dark ring and a lit lip under it
            for i in range(w): s.put(x + i, y, pal["deep"] if i else pal["lo"])
            for i in range(w): s.put(x + i, y + 1, pal["hi"]) if y + 1 < BAH - 1 and i == 0 else None
    for i in range(w): s.put(x + i, BAH - 1, pal["deep"])

def bamboo_base(pal, tops):
    s = Sec(BAH); cane(s, 0, 3, 0, pal)                  # the thick post on the left edge
    for k, x in enumerate(range(3, 22, 3)): cane(s, x, 2, tops[k], pal)
    for y in (4, 10):                                    # rope lashings across every cane
        for x in range(0, W): s.put(x, y, ROPE["mid"]); s.put(x, y + 1, ROPE["lo"] if x % 2 else ROPE["mid"])
    return s
def bamboo_pristine(): return bamboo_base(BAM, [1, 0, 2, 0, 1, 2, 0])
def bamboo_degrading():
    s = bamboo_base(BAMO, [1, 0, 3, 0, 2, 4, 1])
    for x, y0, n in ((4, 6, 4), (10, 2, 3), (13, 6, 5), (19, 7, 4), (7, 11, 2)):         # splits down the canes
        for k in range(n): s.put(x, y0 + k, BAMO["deep"])
    for x, y in ((6, 4), (7, 4), (15, 10), (16, 10), (12, 4), (20, 10)): s.clear(x, y); s.put(x, y + 1, ROPE["lo"]) if x % 2 else None          # frayed lashings
    for x in range(3, W):
        if x % 4 in (0, 1): s.put(x, BAH - 2, MOSS["mid"])
        if x % 4 == 0: s.put(x, BAH - 3, MOSS["lo"])
    for x, y in ((0, 12), (2, 11), (1, 13)): s.put(x, y, MOSS["lo"])
    return s
def bamboo_broken():
    s = bamboo_pristine()
    s.box(5, 0, 18, BAH - 1)
    for x, h in ((6, 6), (9, 4), (12, 3), (15, 5), (17, 2)):                              # snapped stubs
        for y in range(BAH - 1 - h, BAH - 1): s.put(x, y, BAM["mid"]); s.put(x + 1, y, BAM["lo"]) if x + 1 < 17 else None
        s.put(x, BAH - 1 - h, BAM["hi"]); s.put(x + 1, BAH - 2 - h, BAM["lo"]) if x % 2 else None
    for x in range(7, 15): s.put(x, 11, BAM["mid"]); s.put(x, 12, BAM["lo"])               # a cane lying on the ground
    for x in range(8, 15): s.put(x, 9, BAM["hi"]) if x % 5 else s.put(x, 9, BAM["deep"])    # and one propped across it
    for x in range(5, 18): s.put(x, BAH - 1, BAM["deep"])
    for x, y in ((5, 5), (5, 6), (17, 4), (17, 5)): s.put(x, y, ROPE["mid"])                # rope left hanging off the ends
    return s

# ===================================================================== PALISADE (23 x 22)
PLH = 22
def log(s, x, w, peak, pal, k):
    for y in range(peak, PLH - 2):
        for i in range(w):
            if y == peak and not (i == w // 2 or (w == 4 and i == 1)): continue
            c = pal["hi"] if i == 0 else pal["lo"] if i == w - 1 else pal["mid"]
            s.put(x + i, y, pal["hi"] if y == peak else c)
        if (y + k * 3) % 7 == 0 and y > peak + 1: s.put(x + w // 2, y, pal["deep"])          # a bark groove, one a log, spaced evenly
    for i in range(w): s.put(x + i, PLH - 2, pal["lo"])

def palisade_base(pal, peaks):
    s = Sec(PLH); log(s, 0, 3, 0, pal, 0)
    x = 3
    for k, (w, p) in enumerate(zip((3, 3, 3, 3, 4, 4), peaks)): log(s, x, w, p, pal, k + 1); x += w
    for y in (9, 17):                                    # rope bindings over every log
        for x in range(W): s.put(x, y, ROPE["mid"]); s.put(x, y + 1, ROPE["lo"] if x % 2 else ROPE["deep"])
    for x in range(W): s.put(x, PLH - 1, SOIL["deep"]); s.put(x, PLH - 2, SOIL["mid"] if x % 3 else s.px.get((x, PLH - 2), SOIL["mid"]))
    return s
def palisade_pristine(): return palisade_base(LOG, [2, 1, 3, 1, 2, 3])
def palisade_degrading():
    s = palisade_base(LOGO, [2, 4, 3, 1, 5, 3])
    for x, y0, n in ((4, 11, 4), (10, 4, 5), (15, 12, 4), (19, 6, 4)):                      # cracks
        for k in range(n): s.put(x, y0 + k, LOGO["deep"])
    for x in range(W):
        if x % 5 in (0, 1, 2): s.put(x, PLH - 3, MOSS["mid"]); s.put(x, PLH - 4, MOSS["lo"]) if x % 5 == 1 else None
        if x % 5 == 1: s.put(x, PLH - 5, MOSS["hi"])
    for x, y in ((6, 6), (7, 6), (14, 14), (15, 14), (20, 11)): s.put(x, y, LICHEN)
    for x, y in ((5, 9), (6, 9), (13, 17), (14, 17), (19, 9)): s.clear(x, y)                # rope gone in patches
    return s
def palisade_broken():
    s = palisade_pristine()
    s.box(6, 0, 18, PLH - 2)
    for x, y in ((6, 14), (7, 12), (8, 15), (9, 11), (10, 15), (11, 13), (12, 16), (13, 12), (14, 15), (15, 10), (16, 15), (17, 13)): s.put(x, y, LOG["hi"]) if x % 3 == 0 else None
    for x0, top in ((6, 14), (9, 11), (12, 16), (15, 10)):                                   # snapped stumps with splintered tops
        for x in range(x0, x0 + 3):
            for y in range(top + (x - x0) % 2 * 2, PLH - 2): s.put(x, y, LOG["hi"] if x == x0 else LOG["lo"] if x == x0 + 2 else LOG["mid"])
        s.put(x0 + 1, top - 1, LOG["hi"])
    for x in range(5, 19):                                                                   # a log lying across the gap
        for y in (18, 19): s.put(x, y, LOG["mid"])
        s.put(x, 17, LOG["hi"]); s.put(x, 20, LOG["lo"])
    for y in (17, 18, 19, 20): s.put(18, y, LOG["deep"]) if y in (18, 19) else s.put(18, y, LOG["lo"])
    s.put(5, 18, LOG["hi"]); s.put(5, 19, LOG["lo"])
    for x in range(6, 18): s.put(x, PLH - 1, SOIL["deep"])
    for x, y in ((8, 21), (14, 21), (11, 20)): s.put(x, y, SOIL["mid"])
    return s

# ===================================================================== WROUGHT IRON (23 x 17)
IH = 17
def iron_base(tone):
    s = Sec(IH)
    for x, key in enumerate(("hi", "mid", "lo")):                                                 # the post and its ball
        for y in range(2, IH - 1): s.put(x, y, tone[key])
    for x in range(3): s.put(x, 1, GOLD["mid"] if x == 1 else GOLD["lo"]); s.put(x, 14, tone["lo"]); s.put(x, IH - 1, tone["deep"])
    s.put(1, 0, GOLD["hi"])
    for x in range(4, W, 2):
        spear = (x - 4) % 8 == 0
        top = 0 if spear else 3
        for y in range(top, IH - 1): s.put(x, y, tone["mid"])
        s.put(x, top, tone["hi"])
        if spear: s.put(x - 1, 2, tone["mid"]); s.put(x + 1, 2, tone["lo"]) if x + 1 < W else None; s.put(x, 1, tone["hi"])
        s.put(x, IH - 1, tone["deep"])
    for y in (4, 13):
        for x in range(3, W): s.put(x, y, tone["hi"] if x % 2 == 0 else tone["mid"]); s.put(x, y + 1, tone["lo"])
    for cx in (9, 17):                                                                               # scroll rings between bars
        for dx, dy in ((0, 0), (1, 0), (0, 2), (1, 2), (-1, 1), (2, 1)): s.put(cx + dx, 7 + dy, tone["hi"] if dy == 0 else tone["mid"])
    return s
def iron_pristine(): return iron_base(IRON)
def iron_degrading():
    s = iron_base(IRON)
    for (x, y), c in list(s.px.items()):
        if c != GOLD["hi"] and hsh(x, y) == 0 and 3 <= x: s.px[(x, y)] = RUST["mid"] if (x + y) % 2 else RUST["lo"]
    for x, y in ((6, 6), (6, 7), (10, 6), (14, 6), (14, 7), (18, 6), (20, 14), (8, 14), (16, 15), (12, 15)): s.put(x, y, RUST["lo"])        # rust runs down from the rails
    for y in range(6, 12): s.put(12, y, IRON["mid"]) if False else None
    for y in range(7, 12): s.clear(12, y); s.put(13, y, IRON["mid"])                              # a bent bar
    s.clear(12, 4); s.put(13, 4, IRON["mid"]); s.clear(12, 3)
    s.clear(12, 0); s.clear(12, 1); s.clear(11, 2); s.clear(13, 2)                                  # a finial lost
    s.put(12, 2, RUST["lo"]); s.put(0, 5, RUST["mid"]); s.put(2, 9, RUST["lo"]); s.put(1, 12, RUST["mid"])
    return s
def iron_broken():
    s = iron_pristine()
    s.box(5, 0, 19, IH - 1)
    for x, h, bend in ((6, 7, 1), (8, 5, 0), (10, 8, -1), (14, 4, 1), (16, 6, 0), (18, 9, -1)):   # snapped bars, tops bent over
        for y in range(IH - 1 - h, IH - 1): s.put(x, y, IRON["mid"])
        s.put(x + bend, IH - 2 - h, IRON["hi"])
    for x in range(7, 15): s.put(x, 14, IRON["mid"]); s.put(x, 15, IRON["lo"]) if x % 2 else None   # a bar on the ground
    for x, y in ((6, 4), (7, 5), (8, 6), (9, 7), (10, 8)): s.put(x, y, IRON["mid"]); s.put(x, y + 1, IRON["lo"])   # a rail hanging down
    for x, y in ((15, 5), (16, 5), (17, 5), (18, 4)): s.put(x, y, IRON["mid"])
    for x in range(5, 19): s.put(x, IH - 1, IRON["deep"]) if x % 2 == 0 else None
    return s

# ===================================================================== DRY STONE (23 x 11)
DH = 11
def ds_stone(s, x, y, w, h, t, last=False):
    st = DS[t % 3]
    for xx in range(x, x + w):
        for yy in range(y, y + h): s.put(xx, yy, st["mid"])
    for xx in range(x, x + w - 1): s.put(xx, y, st["hi"])
    for yy in range(y, y + h - 1): s.put(x, yy, st["hi"])
    for xx in range(x + 1, x + w - (0 if last else 1)): s.put(xx, y + h - 2, st["lo"])
    for yy in range(y + 1, y + h - 1): s.put(x + w - (1 if last else 2), yy, st["lo"])
    for xx in range(x, x + w): s.put(xx, y + h - 1, DSJ)
    if not last:
        for yy in range(y, y + h): s.put(x + w - 1, yy, DSJ)

def ds_base():
    s = Sec(DH)
    x = 0
    for k, w in enumerate((4, 6, 3, 5, 5)): ds_stone(s, x, 3, w, 4, k, k == 4); x += w                 # upper course
    x = 0
    for k, w in enumerate((6, 4, 5, 3, 5)): ds_stone(s, x, 7, w, 4, k + 1, k == 4); x += w             # lower course
    x = 0
    for k, w in enumerate((5, 4, 5, 4, 5)):                                                               # scalloped capstones: corners left bare
        for xx in range(x, x + w):
            s.put(xx, 0, DS[2]["hi"]) if x < xx < x + w - 1 else None
            s.put(xx, 1, DS[2]["hi"] if xx == x else DS[2]["mid"]); s.put(xx, 2, DS[2]["lo"])
        x += w
    return s
def ds_pristine():
    s = ds_base()
    for x, y in ((3, 0), (4, 0), (15, 0), (19, 1), (11, 2)): s.put(x, y, MOSS["mid"]); s.put(x + 1, y + 1, MOSS["lo"]) if y < 2 and x % 2 else None
    return s
def ds_degrading():
    s = ds_base()
    for x in range(W):                                                                                    # moss over the caps and foot
        if x % 3 != 2: s.put(x, 0, MOSS["mid"]) if s.px.get((x, 0)) else None
        if x % 4 in (0, 1): s.put(x, 1, MOSS["lo"])
        if x % 5 in (0, 1, 2): s.put(x, DH - 2, MOSS["mid"])
    for x, y in ((6, 4), (7, 4), (17, 8), (18, 8), (2, 8)): s.put(x, y, LICHEN)
    s.box(10, 3, 13, 6)                                                                                   # a stone fallen out of the upper course
    for x in range(10, 13): s.put(x, 3, DSJ); s.put(x, 4, DSJ); s.put(x, 5, DS[1]["deep"])
    s.box(14, 0, 19, 3)                                                                                   # a capstone slipped off, its place bare
    for x in range(14, 19): s.put(x, 2, DS[0]["deep"])
    return s
def ds_broken():
    s = ds_base()
    s.box(7, 0, 17, 7)
    s.box(8, 7, 16, DH - 1)
    for y, x in ((3, 6), (4, 6), (5, 6), (6, 6)): s.put(x, y, DS[0]["hi"]) if y % 2 else None
    heap = ((7, 6, 4, 4), (11, 5, 4, 5), (14, 7, 3, 3), (9, 8, 3, 3), (12, 8, 3, 3), (5, 8, 3, 3), (15, 4, 3, 3))
    for i, (x0, y0, w, h) in enumerate(heap):
        if y0 + h > DH: h = DH - y0
        ds_stone(s, x0, y0, w, h, i)
    for x in range(7, 17): s.put(x, DH - 1, DSJ)
    return s

# ===================================================================== GATES
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

# bamboo: thick poles with a gold-tipped cap, bamboo leaves with rails and a diagonal brace
def bam_post(s, x0):
    cane(s, x0, 3, 0, BAM); s.put(x0 + 1, 0, GOLD["mid"]); s.put(x0 + 1, 1, GOLD["lo"]) if False else None
def bam_leaf(s, xa, xb, left):
    for x in range(xa, xb + 1):
        if (x - xa) % 2 == 0:
            for y in range(1, BAH - 1): s.put(x, y, BAM["mid"] if (y - 1) % 5 != 4 else BAM["deep"])
            s.put(x, 1, BAM["hi"])
    for y in (3, 11):
        for x in range(xa, xb + 1): s.put(x, y, ROPE["mid"]); s.put(x, y + 1, ROPE["lo"])
    span = max(1, xb - xa)
    for x in range(xa, xb + 1):
        y = round(11 - 8 * (x - xa) / span) if left else round(3 + 8 * (x - xa) / span)
        s.put(x, y, BAM["hi"]); s.put(x, y + 1, BAM["lo"])
    for y in range(1, BAH - 1): s.put(xa if left else xb, y, BAM["lo"])
def gate_bamboo(sc): return gate(BAH, bam_post, bam_leaf, gold_latch(6), sc)

# palisade: tall log posts, plank leaves with iron bands
def pal_post(s, x0):
    log(s, x0, 3, 0, LOG, 3); s.put(x0 + 1, 0, GOLD["mid"])
    for y in (9, 17):
        for x in range(3): s.put(x0 + x, y, ROPE["mid"]); s.put(x0 + x, y + 1, ROPE["lo"])
    for x in range(3): s.put(x0 + x, PLH - 1, SOIL["deep"])
def pal_leaf(s, xa, xb, left):
    for x in range(xa, xb + 1):
        for y in range(3, PLH - 2): s.put(x, y, LOG["lo"] if (x - xa) % 3 == 2 else LOG["hi"] if (x - xa) % 3 == 0 else LOG["mid"])
    for x in range(xa, xb + 1): s.put(x, 3, LOG["hi"]); s.put(x, PLH - 2, LOG["deep"])
    for y in (7, 16):
        for x in range(xa, xb + 1): s.put(x, y, IRON["mid"]); s.put(x, y + 1, IRON["lo"]) if x % 2 else None
    for y in range(3, PLH - 2): s.put(xa if left else xb, y, LOG["deep"])
def gate_palisade(sc): return gate(PLH, pal_post, pal_leaf, gold_latch(11), sc)

# wrought iron: iron posts with gold balls, ornate bar leaves with an arched top rail
def ir_post(s, x0):
    for x, key in enumerate(("hi", "mid", "lo")):
        for y in range(2, IH - 1): s.put(x0 + x, y, IRON[key])
    for x in range(3): s.put(x0 + x, 1, GOLD["mid"] if x == 1 else GOLD["lo"]); s.put(x0 + x, IH - 1, IRON["deep"])
    s.put(x0 + 1, 0, GOLD["hi"])
def ir_leaf(s, xa, xb, left):
    for x in range(xa, xb + 1):
        if (x - xa) % 2 == 0:
            top = 2 if (x - xa) % 4 == 0 else 3
            for y in range(top, IH - 1): s.put(x, y, IRON["mid"])
            s.put(x, top, IRON["hi"])
    for y in (4, 13):
        for x in range(xa, xb + 1): s.put(x, y, IRON["hi"] if x % 2 == 0 else IRON["mid"]); s.put(x, y + 1, IRON["lo"])
    mid = (xa + xb) // 2
    for dx, dy in ((0, 0), (1, 0), (0, 2), (1, 2), (-1, 1), (2, 1)): s.put(mid + dx, 7 + dy, IRON["hi"])
    for y in range(2, IH - 1): s.put(xa if left else xb, y, IRON["lo"])
def gate_iron(sc): return gate(IH, ir_post, ir_leaf, gold_latch(8), sc)

# dry stone: low stone posts with gold caps, a field gate of three timber rails with a brace
def ds_post(s, x0):
    for y in range(1, DH - 1):
        for x, key in enumerate(("hi", "mid", "lo")): s.put(x0 + x, y, DS[1][key])
    for y in (4, 8):
        for x in range(3): s.put(x0 + x, y, DSJ)
    for x in range(3): s.put(x0 + x, 0, GOLD["hi"] if x == 1 else DS[2]["hi"]); s.put(x0 + x, DH - 1, DSJ)
def ds_leaf(s, xa, xb, left):
    for y in (2, 5, 8):
        for x in range(xa, xb + 1): s.put(x, y, WOOD["hi"]); s.put(x, y + 1, WOOD["lo"])
    span = max(1, xb - xa)
    for x in range(xa, xb + 1):
        y = round(8 - 6 * (x - xa) / span) if left else round(2 + 6 * (x - xa) / span)
        s.put(x, y, WOOD["mid"])
    for y in range(2, DH - 1): s.put(xa if left else xb, y, WOOD["deep"])
def gate_ds(sc): return gate(DH, ds_post, ds_leaf, gold_latch(4), sc)

KINDS = {
    "bamboo":   (BAH, (bamboo_pristine, bamboo_degrading, bamboo_broken), gate_bamboo),
    "palisade": (PLH, (palisade_pristine, palisade_degrading, palisade_broken), gate_palisade),
    "iron":     (IH, (iron_pristine, iron_degrading, iron_broken), gate_iron),
    "drystone": (DH, (ds_pristine, ds_degrading, ds_broken), gate_ds),
}

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "sprites/fence"
    sheet_path = sys.argv[2] if len(sys.argv) > 2 else None
    os.makedirs(out, exist_ok=True)
    z, gap, RH = 12, 4, 26
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
