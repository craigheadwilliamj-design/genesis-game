# Builds the Lystrosaurus resting strip (sprites/lyst-rest.png, 7 frames of 100x75 side by side) from the standing picture, sprites/lyst.png: it crouches, then lies down like a sphinx with its belly
# on the ground, forelegs stretched out in front, hind feet folded under it and its chin resting on its forelegs, and its eyes close. The last two frames (closed eyes, a slow breath) are the ones the game
# holds and alternates. The body above the legs drops straight down and the head sags (more at the nose); while it is still crouching the standing legs are squashed into the room left, and once it
# lies down they are drawn as flat folded limbs (an elbow, a forearm along the ground, toes) in the hide's own shades. The eye is redrawn open, half shut and shut. Usage: python3 -I tools/pixellyst_rest.py [dir]
import sys
from PIL import Image
W, H = 100, 75
LEG_Y, FOOT_Y = 46, 57            # the legs start at this row and stand on this one
HEAD0, HEAD1 = 64, 86             # the head's sag ramps in across these columns
BODY, DARK = (115, 110, 32, 255), (67, 65, 20, 255)
EYE = [(x, y) for x in (88, 89, 90) for y in (24, 25, 26)]   # the standing picture's eye, 3 by 3
SOCKET = [(x, y) for x in (87, 88, 89, 90, 91) for y in (23, 24, 25, 26, 27) if (x, y) not in EYE]   # the dark ring around it
HI, LO, TOE, TOE2 = (140, 134, 46, 255), (95, 91, 26, 255), (235, 227, 136, 255), (241, 236, 167, 255)
DHI, DLO = (88, 85, 28, 255), (52, 50, 15, 255)
# per frame: how far the body drops, the head's extra sag, the eye (0 open, 1 half shut, 2 shut), and whether it lies with its legs laid out (else the standing legs are squashed)
FRAMES = [(0, 0, 0, 0), (4, 0, 0, 0), (8, 0, 0, 0), (10, 3, 0, 1), (10, 3, 1, 1), (10, 4, 2, 1), (10, 5, 2, 1)]

def smooth(t): t = max(0, min(1, t)); return t * t * (3 - 2 * t)

def lids(src, eye):   # a copy of the standing picture with the eye half shut (a slit) or shut (the ring gone, one dark line)
    out = src.copy(); o = out.load()
    if eye == 1:
        for x in (88, 89, 90): o[x, 24] = BODY; o[x, 26] = BODY
    if eye == 2:
        for x, y in EYE + SOCKET: o[x, y] = BODY
        for x in (88, 89, 90): o[x, 25] = DARK
    return out

def limb(o, x0, x1, top, bottom, dark=False, elbow=0):
    """A flat limb lying along the ground: rows top to bottom, x0 (the elbow or knee) to x1 (the toes); a crease along its top where it overlaps the body, a lit top row, a shaded bottom row,
    an elbow bump that is `elbow` rows taller, cream toes (a near limb) or a dark toe tip (a far one)."""
    base, hi, lo = ((67, 65, 20, 255), DHI, DLO) if dark else ((115, 110, 32, 255), HI, LO)
    for x in range(x0, x1 + 1):
        t = top - (elbow if x < x0 + 7 else 0) + (1 if x > x1 - 3 else 0)   # the elbow bump, and the paw dipping a row at the end
        if not dark and x < x1 - 4 and o[x, t - 1][3]: o[x, t - 1] = LO   # a crease where the limb overlaps the body
        for y in range(t, bottom + 1):
            o[x, y] = lo if y == bottom else hi if y == t and (x + y) % 3 else base
    if not dark:
        for x in (x1 - 2, x1 - 1, x1): o[x, bottom] = TOE if x % 2 else TOE2
        o[x1 + 1, bottom] = TOE2
    else:
        for y in range(bottom - 1, bottom + 1): o[x1 + 1, y] = DLO

def frame(src, drop, sag, eye, lying):
    sp = lids(src, eye).load(); out = Image.new("RGBA", (W, H), (0, 0, 0, 0)); o = out.load()
    if not lying:
        for y in range(LEG_Y + drop, FOOT_Y + 1):   # the legs, squashed into the room under the body
            t = (y - (LEG_Y + drop)) / max(1, FOOT_Y - (LEG_Y + drop)); sy = round(LEG_Y + t * (FOOT_Y - LEG_Y))
            for x in range(W):
                if sp[x, sy][3]: o[x, y] = sp[x, sy]
    for y in range(LEG_Y):   # the body above them drops straight down, the head sagging a little more
        for x in range(W):
            c = sp[x, y]
            if not c[3]: continue
            ny = y + drop + round(sag * smooth((x - HEAD0) / (HEAD1 - HEAD0)))
            if 0 <= ny < H: o[x, ny] = c
    if lying:   # far limbs first, then the near ones over them: hind feet folded forward under the belly, forelegs stretched out in front with the chin on them
        limb(o, 38, 55, 52, 56, dark=True); limb(o, 30, 47, 53, 57, elbow=1)
        limb(o, 64, 90, 51, 55, dark=True); limb(o, 58, 84, 52, 57, elbow=2)
    return out

def main(d):
    src = Image.open(f"{d}/lyst.png").convert("RGBA"); strip = Image.new("RGBA", (W * len(FRAMES), H), (0, 0, 0, 0))
    for i, f in enumerate(FRAMES): strip.paste(frame(src, *f), (i * W, 0))
    strip.save(f"{d}/lyst-rest.png"); print(f"{d}/lyst-rest.png", len(FRAMES), "frames")

main(sys.argv[1] if len(sys.argv) > 1 else "sprites")
