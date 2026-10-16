# Draws the rope fence as three 3 m sections in the Dimetrodon's flat style: plain wood posts with rope tied between them (23 x 10 px, 1.3 m).
# Pristine, degrading and broken pictures and a keeper gate with swing frames -1, -2, -3 (each leaf shortens toward its hinge post, the latch goes). Pixels are 0.13 m (ROCK_MPP); every section has a 3 px post on its left edge so sections tile end to end, and the ropes meet at the same height on both sides of a post.
# Flat fills, no outline, light from the top left: the post is lit on the left and top, shaded on the right; the rope is a swag of two-pixel strands with a rhythm of lit twists, tied round each post with a wrap.
#   pristine  warm brown posts, two tan ropes sagging a little between them
#   degrading silvered grey posts with moss, grey frayed rope hanging low with a gap in the upper one
#   broken    the post stands, both ropes cut and lying in loose coils on the ground
#   gate      two gold-capped posts and two plank leaves with a rope brace; a gold latch plate (the gate marker's #D8B04A); it never wears
# Usage: python3 -I tools/pixelfence_rope.py [outdir] [sheet.png]   (default sprites/fence; the optional sheet is a x12 view of every picture)
import sys, os
from PIL import Image

W = 23
H = 10
def mix(a, b, t): return tuple(round(x * (1 - t) + y * t) for x, y in zip(a, b))
def ramp(base): return {"hi": mix(base, (255, 255, 255), .28), "mid": base, "lo": mix(base, (0, 0, 0), .26), "deep": mix(base, (0, 0, 0), .46)}
ROPE = ramp((184, 144, 88)); ROPEO = ramp((150, 134, 108))
POST = ramp((130, 92, 58)); POSTO = ramp((134, 128, 116)); SOIL = ramp((110, 84, 56))
WOOD = ramp((120, 86, 54)); MOSS = ramp((97, 111, 34)); GOLD = ramp((216, 176, 74))

class Sec:
    def __init__(s): s.px = {}
    def put(s, x, y, c):
        if 0 <= x < W and 0 <= y < H: s.px[(x, y)] = c
    def clear(s, x, y): s.px.pop((x, y), None)
    def img(s):
        im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        for (x, y), c in s.px.items(): im.putpixel((x, y), c + (255,))
        return im

def post(s, x0, pal):                          # a plain square post, lit left, shaded right, a lit top and a footing in the soil
    for y in range(0, H - 1):
        for i, key in enumerate(("hi", "mid", "lo")): s.put(x0 + i, y, pal[key])
    for i in range(3): s.put(x0 + i, 0, pal["hi"])
    for y in (4, 7): s.put(x0 + 2, y, pal["deep"])            # a grain line on the shaded side, spaced evenly
    for i in range(3): s.put(x0 + i, H - 1, SOIL["deep"])
def tie(s, x0, y, pal):                        # the rope wrapped twice round a post
    for i in range(3): s.put(x0 + i, y, pal["mid"]); s.put(x0 + i, y + 1, pal["lo"])
    s.put(x0, y, pal["hi"])
def swag(s, y0, sag, pal, gap=None, drop=None):   # one rope from the post at x 0..2 to the next one at x 23, two pixels thick with a lit twist every third pixel
    xa, xb = 3, W - 1
    for x in range(xa, xb + 1):
        t = (x - xa) / (xb - xa)
        y = y0 + round(sag * 4 * t * (1 - t)) + (round(drop * 4 * t * (1 - t)) if drop else 0)
        if gap and gap[0] <= x <= gap[1]: continue
        s.put(x, y, pal["hi"] if x % 3 == 0 else pal["mid"]); s.put(x, y + 1, pal["lo"])

def rope_pristine():
    s = Sec(); post(s, 0, POST); tie(s, 0, 2, ROPE); tie(s, 0, 5, ROPE)
    swag(s, 2, 2, ROPE); swag(s, 5, 1, ROPE)
    return s
def rope_degrading():
    s = Sec(); post(s, 0, POSTO); tie(s, 0, 2, ROPEO); tie(s, 0, 5, ROPEO)
    swag(s, 2, 3, ROPEO, gap=(10, 12)); swag(s, 5, 2, ROPEO)
    for x, y in ((9, 5), (13, 5)): s.put(x, y, ROPEO["lo"]); s.put(x, y + 1, ROPEO["mid"])     # frayed ends hanging off the broken upper rope
    for x, y in ((14, 4), (17, 6)): s.clear(x, y)                                              # thin patches in the strands
    for x in range(0, 3): s.put(x, H - 2, MOSS["mid"]); s.put(x, H - 3, MOSS["lo"]) if x == 1 else None
    for x in range(3, W):
        if x % 5 in (0, 1): s.put(x, H - 2, MOSS["lo"])
    s.put(0, 6, MOSS["hi"]); s.put(1, 6, MOSS["mid"])
    return s
def rope_broken():
    s = Sec(); post(s, 0, POST)
    for k, y in enumerate((2, 3)): s.put(3, y + k, ROPE["mid"]); s.put(4, y + k + 1, ROPE["lo"])       # a cut end hanging off the post
    s.put(0, 2, ROPE["mid"]); s.put(1, 2, ROPE["hi"]); s.put(2, 2, ROPE["lo"]); s.put(0, 3, ROPE["lo"])
    for x in range(5, 20):                                                                             # the rope lying on the ground in loose coils
        y = H - 3 + (1 if (x // 3) % 2 else 0)
        s.put(x, y, ROPE["hi"] if x % 3 == 0 else ROPE["mid"]); s.put(x, y + 1, ROPE["lo"]) if y + 1 < H - 1 else None
    for x, y in ((8, 5), (9, 5), (14, 4), (15, 4), (16, 5)): s.put(x, y, ROPE["mid"]); s.put(x, y + 1, ROPE["lo"])   # a loop standing up out of the heap
    for x in range(3, W): s.put(x, H - 1, SOIL["deep"]) if x % 4 else None
    return s

# gate: two gold-capped posts, two plank leaves with a rope brace
def gpost(s, x0):
    post(s, x0, POST); s.put(x0 + 1, 0, GOLD["mid"]); s.put(x0, 0, GOLD["hi"]); s.put(x0 + 2, 0, GOLD["lo"])
    tie(s, x0, 3, ROPE)
def gleaf(s, xa, xb, left):
    for y in (2, 5):
        for x in range(xa, xb + 1): s.put(x, y, WOOD["hi"]); s.put(x, y + 1, WOOD["lo"])
    span = max(1, xb - xa)
    for x in range(xa, xb + 1):
        y = round(5 - 3 * (x - xa) / span) if left else round(2 + 3 * (x - xa) / span)
        s.put(x, y, ROPE["mid"]) if x % 2 else s.put(x, y, ROPE["lo"])
    for y in range(2, H - 1): s.put(xa if left else xb, y, WOOD["deep"])
def latch(s):
    for x in (10, 11): s.put(x, 3, GOLD["hi"]); s.put(x, 4, GOLD["mid"]); s.put(x, 5, GOLD["lo"])
def gate(sc=1.0):
    s = Sec(); gpost(s, 0); gpost(s, 20)
    fl = lambda x: 3 + round((x - 3) * sc); fr = lambda x: 19 - round((19 - x) * sc)
    gleaf(s, 3, fl(10), True); gleaf(s, fr(11), 19, False)
    if sc == 1.0: latch(s)
    return s

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "sprites/fence"
    sheet_path = sys.argv[2] if len(sys.argv) > 2 else None
    os.makedirs(out, exist_ok=True)
    z, gap = 12, 4
    sheet = Image.new("RGBA", ((4 * (W + gap) + gap) * z, (2 * (H + gap) + gap) * z), (176, 190, 150, 255))
    for i, (name, fn) in enumerate(zip(("pristine", "degrading", "broken"), (rope_pristine, rope_degrading, rope_broken))):
        im = fn().img(); im.save(f"{out}/rope-{name}.png"); print("rope", name, im.size)
        sheet.alpha_composite(im.resize((W * z, H * z), Image.NEAREST), ((gap + i * (W + gap)) * z, gap * z))
    for i, (suf, sc) in enumerate((("", 1.0), ("-1", .66), ("-2", .33), ("-3", .1))):
        im = gate(sc).img(); im.save(f"{out}/rope-gate{suf}.png")
        sheet.alpha_composite(im.resize((W * z, H * z), Image.NEAREST), ((gap + i * (W + gap)) * z, (2 * gap + H) * z))
    if sheet_path: sheet.save(sheet_path)
