# Builds sprites/plat-walk.png (the Plateosaurus walk strip) from the standing sprites/plat.png, no hand animation.
# The four limbs are cut off the standing picture and redrawn each frame with a two-bone leg (hip, knee, ankle) walking a stance and swing cycle,
# the body dips on each footfall, the tail sways behind it and the neck counter-dips. Colors stay the standing sprite's own palette.
# Usage: python3 -I tools/pixelplat_walk.py [dir]   (dir holds plat.png, default sprites; writes plat-walk.png there)
import sys, math
from PIL import Image
W, H, N = 100, 75, 6
T, B, G = (185, 162, 81), (51, 36, 70), (94, 134, 125)          # near limbs: lit tan, shadow purple, teal edge
FO, FD, FT = (102, 89, 41), (37, 27, 51), (76, 106, 101)         # far limbs: olive, dark, dark teal
PALE, GREY, FK = (213, 210, 157), (149, 149, 119), (68, 60, 26)  # claws, far claws, far foot
GROUND = 48                  # row the toes rest on
HIP, SHOULDER = (55, 34), (74, 35)
L1, L2 = 7.0, 7.5            # thigh and shin lengths
STANCE = .67                 # share of the cycle a foot is on the ground
HIND_STEP, ARM_STEP = (61, 49), (77, 71)   # (front, back) ankle x for the hind legs and where the hand lands for the arms
BOB = [0, 1, 0, 0, 1, 0]     # body dip a frame (down is plus)

def segs_ik(h, a, flip=-1):
    # knee of a two-bone leg from hip h to ankle a, bent forward (+x)
    dx, dy = a[0] - h[0], a[1] - h[1]; d = max(1e-3, min(math.hypot(dx, dy), L1 + L2 - .01))
    along = (L1 * L1 - L2 * L2 + d * d) / (2 * d); off = math.sqrt(max(0, L1 * L1 - along * along))
    ux, uy = dx / d, dy / d
    return (h[0] + ux * along + flip * -uy * off, h[1] + uy * along + flip * ux * off)

def put(img, x, y, c):
    x, y = int(round(x)), int(round(y))
    if 0 <= x < W and 0 <= y < H: img[y][x] = c

def thick(img, p, q, cols):
    # a segment p to q w pixels wide: columns when steep (left lit, right shaded), rows when shallow (top lit, rest shaded)
    (x0, y0), (x1, y1) = p, q; w = len(cols)
    if abs(y1 - y0) >= abs(x1 - x0):
        n = max(1, int(round(abs(y1 - y0))))
        for i in range(n + 1):
            t = i / n; xc = x0 + (x1 - x0) * t; yy = y0 + (y1 - y0) * t; xl = round(xc - (w - 1) / 2)
            for k, c in enumerate(cols): put(img, xl + k, yy, c)
    else:
        n = max(1, int(round(abs(x1 - x0))))
        for i in range(n + 1):
            t = i / n; xx = x0 + (x1 - x0) * t; yc = y0 + (y1 - y0) * t; yt = round(yc - (w - 1) / 2)
            for k, c in enumerate(cols): put(img, xx, yt + k, c)

def foot_pos(phase, front, back, lift):
    # ankle x and height above ground: on the ground sliding back through stance, then up and forward through swing
    p = phase % 1.0
    if p < STANCE: return front + (back - front) * (p / STANCE), 0.0
    s = (p - STANCE) / (1 - STANCE); return back + (front - back) * s, lift * math.sin(math.pi * s)

def leg(img, hip, phase, far):
    fx, up = foot_pos(phase, HIND_STEP[0], HIND_STEP[1], 4)
    ank = (fx, GROUND - 2 - up); knee = segs_ik(hip, ank)
    c3, c2, cf, cp = ((FO, FD, FT), (FO, FD), FK, GREY) if far else ((T, B, B, G), (T, B), T, PALE)
    thick(img, hip, knee, list(c3)); thick(img, knee, ank, list(c2))
    toe = (ank[0] + 4, ank[1] + 1.5 + (1 if up > 1.5 else 0) * 0)         # a flat foot, toes forward
    thick(img, (ank[0], ank[1] + 1), (toe[0] - 1, ank[1] + 1), [cf, cf]); put(img, toe[0], ank[1] + 1, cp); put(img, toe[0], ank[1] + 2, cp)

def arm(img, sh, phase, far):
    fx, up = foot_pos(phase, ARM_STEP[0] - 1, ARM_STEP[1] + 3, 2)
    hand = (fx, 44 - up); sh = (sh[0], sh[1]); elb = ((sh[0] + hand[0]) / 2 - 1, (sh[1] + hand[1]) / 2)
    c = (FO, FD) if far else (T, B)
    thick(img, sh, elb, list(c)); thick(img, elb, hand, list(c)); put(img, hand[0], hand[1] + 1, GREY if far else PALE); put(img, hand[0] + 1, hand[1] + 1, GREY if far else PALE)

def split(std):
    # the standing sprite minus the four limbs: far legs and arms go entirely, the near hind leg below the hip
    body = [row[:] for row in std]
    for y in range(H):
        for x in range(W):
            c = body[y][x]
            if c is None: continue
            if 38 <= y <= 49 and 46 <= x <= 68 and (c in (FO, FD, FT, FK, GREY, PALE) or x <= 58 and c in (T, B, G, PALE)): body[y][x] = None   # hind legs
            elif 37 <= y <= 49 and 70 <= x <= 80: body[y][x] = None                                                                                     # arms
    return body

def shift_cols(body, dy_of):
    out = [[None] * W for _ in range(H)]
    for x in range(W):
        d = dy_of(x)
        for y in range(H):
            if body[y][x] is not None and 0 <= y + d < H: out[y + d][x] = body[y][x]
    return out

def fill_holes(img):
    # a pixel with the same color above and below (a seam the column shifts opened) takes it
    for y in range(1, H - 1):
        for x in range(W):
            if img[y][x] is None and img[y - 1][x] is not None and img[y - 1][x] == img[y + 1][x]: img[y][x] = img[y - 1][x]

def frame(body, i):
    ph = i / N; bob = BOB[i]; img = [[None] * W for _ in range(H)]
    hip = (HIP[0], HIP[1] + bob); sh = (SHOULDER[0], SHOULDER[1] + bob)
    def dy(x):
        if x >= 66: return int(round(bob - bob * min(1.0, (x - 62) / 30)))                       # the neck eases back up, the head stays steady
        if x < 46: return bob + int(round(1.6 * min(1.0, (46 - x) / 24) * math.sin(2 * math.pi * ph + (46 - x) / 11)))
        return bob
    leg(img, hip, ph + .5, True); arm(img, sh, ph, True)
    shifted = shift_cols(body, dy)
    for y in range(H):
        for x in range(W):
            if shifted[y][x] is not None: img[y][x] = shifted[y][x]
    fill_holes(img)
    leg(img, hip, ph, False); arm(img, sh, ph + .5, False)
    return img

def main(d):
    im = Image.open(f"{d}/plat.png").convert("RGBA"); px = im.load()
    std = [[(px[x, y][:3] if px[x, y][3] else None) for x in range(W)] for y in range(H)]
    body = split(std); out = Image.new("RGBA", (W * N, H), (0, 0, 0, 0)); o = out.load()
    for i in range(N):
        f = frame(body, i)
        for y in range(H):
            for x in range(W):
                if f[y][x] is not None: o[i * W + x, y] = f[y][x] + (255,)
    out.save(f"{d}/plat-walk.png"); print("wrote", f"{d}/plat-walk.png")

if __name__ == "__main__": main(sys.argv[1] if len(sys.argv) > 1 else "sprites")
