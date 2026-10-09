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
STANCE = .67                 # share of the cycle a foot is on the ground
FRONT, BACK = 62, 50       # where a hind foot lands and leaves, as in the standing picture (far foot 62, near foot 50)
FAR_FOOT, NEAR_FOOT, NEAR_LAG = 62, 50, .67   # the standing picture has the far foot at the front and the near foot at the back, so frame 0 matches it
BOB = [0, 1, 0, 0, 1, 0]     # body dip a frame (down is plus)

def put(img, x, y, c):
    x, y = int(round(x)), int(round(y))
    if 0 <= x < W and 0 <= y < H: img[y][x] = c

def foot_x(phase, front, back, lift):
    # foot x and how far it is lifted: sliding back on the ground through stance, then up and forward through swing
    p = phase % 1.0
    if p < STANCE: return front + (back - front) * (p / STANCE), 0.0
    s = (p - STANCE) / (1 - STANCE); return back + (front - back) * s, lift * math.sin(math.pi * s)

def limb(img, px, top, foot0, footx, drop, lift, cut):
    # his own limb pixels (px: {(x, y): color}) moved as drawn: each row slides sideways in proportion to how far down it is (the foot goes to footx,
    # the top stays on the body), and rows are cut out of the shin so the leg shortens by lift (swing) plus drop (the body dipping), keeping the toes on the ground
    ys = sorted({y for _, y in px}); bot = ys[-1]; n = int(round(lift + drop)); cuts = set(range(cut, cut + n))
    for (x, y), c in px.items():
        if y in cuts: continue
        t = (y - top) / max(1, bot - top); dx = int(round((footx - foot0) * max(0.0, t)))
        put(img, x + dx, y + drop - sum(1 for r in cuts if r < y), c)

def parts(std):
    # the standing sprite split into the body (minus the limbs) and the limbs' own pixels
    body = [row[:] for row in std]; near, far, arms = {}, {}, {}
    for y in range(H):
        for x in range(W):
            c = std[y][x]
            if c is None: continue
            if 38 <= y <= 49 and 46 <= x <= 68 and c in (FO, FD, FT, FK, GREY, PALE) and not (x <= 58 and c in (PALE,)): far[(x, y)] = c; body[y][x] = None
            elif 38 <= y <= 49 and 46 <= x <= 58 and c in (T, B, G, PALE): near[(x, y)] = c; body[y][x] = None
            elif 37 <= y <= 49 and 70 <= x <= 80: arms[(x, y)] = c; body[y][x] = None
    return body, near, far, arms

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

def frame(body, near, far, arms, i):
    ph = i / N; bob = BOB[i]; img = [[None] * W for _ in range(H)]
    def dy(x):
        if x >= 66: return int(round(bob - bob * min(1.0, (x - 62) / 30)))                       # the neck eases back up, the head stays steady
        if x < 46: return bob + int(round(1.6 * min(1.0, (46 - x) / 24) * math.sin(2 * math.pi * ph + (46 - x) / 11)))
        return bob
    def hind(px, phase, foot0):
        fx, up = foot_x(phase, FRONT, BACK, 3); limb(img, px, 37, foot0, fx, bob, up, 43)
    def fore(px, phase, hand0):
        fx, up = foot_x(phase, 0, -4, 1); limb(img, px, 36, hand0, hand0 + fx, bob, up, 40)
    hind(far, ph, FAR_FOOT); fore({k: v for k, v in arms.items() if v in (FO, FD, FT, FK, GREY)}, ph, 0)
    shifted = shift_cols(body, dy)
    for y in range(H):
        for x in range(W):
            if shifted[y][x] is not None: img[y][x] = shifted[y][x]
    fill_holes(img)
    hind(near, ph + NEAR_LAG, NEAR_FOOT); fore({k: v for k, v in arms.items() if v not in (FO, FD, FT, FK, GREY)}, ph + .5, 0)
    return img

def main(d):
    im = Image.open(f"{d}/plat.png").convert("RGBA"); px = im.load()
    std = [[(px[x, y][:3] if px[x, y][3] else None) for x in range(W)] for y in range(H)]
    body, near, far, arms = parts(std); out = Image.new("RGBA", (W * N, H), (0, 0, 0, 0)); o = out.load()
    for i in range(N):
        f = frame(body, near, far, arms, i)
        for y in range(H):
            for x in range(W):
                if f[y][x] is not None: o[i * W + x, y] = f[y][x] + (255,)
    out.save(f"{d}/plat-walk.png"); print("wrote", f"{d}/plat-walk.png")

if __name__ == "__main__": main(sys.argv[1] if len(sys.argv) > 1 else "sprites")
