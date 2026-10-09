# Builds the Lystrosaurus resting strip (sprites/lyst-rest.png, 7 frames of 100x75 side by side) from the standing picture, sprites/lyst.png: it crouches, lies down belly to the ground
# with its legs folded under, its eyes close, and the last two frames (closed eyes, a slow breath) are the ones the game holds and alternates.
# The body above the legs drops straight down, the legs are squashed into the room left (their feet stay on the ground row), the head sags a little more at the end, and the eye is redrawn
# (open, half shut, shut) in the hide's own colors. Nothing else is repainted, so the shading is the standing picture's. Usage: python3 -I tools/pixellyst_rest.py [dir]
import sys
from PIL import Image
W, H = 100, 75
LEG_Y, FOOT_Y = 46, 57            # the legs start at this row and stand on this one
HEAD0, HEAD1 = 64, 86             # the head's sag ramps in across these columns
BODY, DARK = (115, 110, 32, 255), (67, 65, 20, 255)
EYE = [(x, y) for x in (88, 89, 90) for y in (24, 25, 26)]   # the standing picture's eye, 3 by 3
SOCKET = [(x, y) for x in (87, 88, 89, 90, 91) for y in (23, 24, 25, 26, 27) if (x, y) not in EYE]   # the dark ring around it
# per frame: how far the body drops, the head's extra sag, the eye (0 open, 1 half shut, 2 shut)
FRAMES = [(0, 0, 0), (4, 0, 0), (8, 0, 0), (11, 1, 0), (11, 1, 1), (11, 2, 2), (12, 2, 2)]

def smooth(t): t = max(0, min(1, t)); return t * t * (3 - 2 * t)

def lids(src, eye):   # a copy of the standing picture with the eye half shut (a slit) or shut (the ring gone, one dark line)
    out = src.copy(); o = out.load()
    if eye == 1:
        for x in (88, 89, 90): o[x, 24] = BODY; o[x, 26] = BODY
    if eye == 2:
        for x, y in EYE + SOCKET: o[x, y] = BODY
        for x in (88, 89, 90): o[x, 25] = DARK
    return out

def frame(src, drop, sag, eye):
    sp = lids(src, eye).load(); out = Image.new("RGBA", (W, H), (0, 0, 0, 0)); o = out.load()
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
    return out

def main(d):
    src = Image.open(f"{d}/lyst.png").convert("RGBA"); strip = Image.new("RGBA", (W * len(FRAMES), H), (0, 0, 0, 0))
    for i, f in enumerate(FRAMES): strip.paste(frame(src, *f), (i * W, 0))
    strip.save(f"{d}/lyst-rest.png"); print(f"{d}/lyst-rest.png", len(FRAMES), "frames")

main(sys.argv[1] if len(sys.argv) > 1 else "sprites")
