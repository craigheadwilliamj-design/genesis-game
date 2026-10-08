# Renders a false-3D 3/4-view pixel Dimetrodon (PIXEL_ART.dime in js/pixelart.js) from a small 3D model built to the proportions and colors of a reference
# illustration: a low barrel body, a long thin tail, a big blocky head with a heavy brow and fangs, and a huge fan sail with yellow blotches in arcing rows.
# The model (ellipsoids and capsules blended smoothly, plus a fan) is ray-marched from a camera above and in front, shaded from the top left, and quantized
# to 5-tone ramps like the plants and rocks. The same model is posed for a stand frame and four walk frames (a diagonal gait), so the anatomy matches in all of them.
# Usage: python3 -I tools/pixeldime3d.py [pixelart.js]   (with a path it rewrites the Dimetrodon block; without, it only draws the preview sheets)
import sys, math, numpy as np
from PIL import Image

W, H = 170, 150                    # working canvas; the sprites are cropped to the union of their bounds
ELEV, YAW = math.radians(14), math.radians(30)   # camera height above the ground plane; how far the animal turns toward the viewer
LIGHT = np.array([-.62, .7, .32]); LIGHT /= np.linalg.norm(LIGHT)   # from the top left and a little toward the viewer (camera space: x right, y up, z toward viewer)
BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0
OUT = "/tmp/claude-0/-home-user-genesis-game/1dc99202-6460-592d-946c-173bd97ee53b/scratchpad/"

def hexc(h): return tuple(int(h[i:i+2], 16) for i in (1, 3, 5))
# tones run dark to light; sage-green hide, cream-pink belly, brown-orange sail membrane with yellow blotches (the reference's colors)
GREEN = [hexc(c) for c in ("#2F3A22", "#4C5A36", "#7B8A58", "#9CAA74", "#BCC794")]
BELLY = [hexc(c) for c in ("#8C6E52", "#B8946C", "#DDBF94", "#EBD3AE", "#F6E6C8")]
SAIL  = [hexc(c) for c in ("#4E250A", "#7E3E10", "#A85A1E", "#C7762E", "#E0944A")]
SPOT  = [hexc(c) for c in ("#8A5A18", "#B87A22", "#E3A63A", "#F2C65C", "#FAE08A")]
OUTLN = {"g": hexc("#1C2214"), "b": hexc("#4A3524"), "s": hexc("#3A1A06")}
EYE, PUPIL, TOOTH, NOSE, MOUTH, CLAW = hexc("#C98A2A"), hexc("#0A0A06"), hexc("#F1EBD0"), hexc("#1C2214"), hexc("#E8A33A"), hexc("#E4DCBC")

def smin(a, b, k):
    h = np.maximum(k - np.abs(a - b), 0) / k; return np.minimum(a, b) - h * h * k * .25
def ellipsoid(P, c, r):
    c, r = np.array(c, float), np.array(r, float); q = (P - c) / r; k0 = np.linalg.norm(q, axis=1); k1 = np.linalg.norm((P - c) / (r * r), axis=1); return k0 * (k0 - 1) / np.maximum(k1, 1e-6)
def capsule(P, a, b, r1, r2):
    a, b = np.array(a, float), np.array(b, float); pa, ba = P - a, b - a; h = np.clip(pa @ ba / (ba @ ba), 0, 1)
    return np.linalg.norm(pa - h[:, None] * ba, axis=1) - (r1 + (r2 - r1) * h)
def sphere(P, c, r): return np.linalg.norm(P - np.array(c, float), axis=1) - r

LIFT = 6.2   # how far the body rides above its old height, leaving a gap under the belly
SAIL_H, SAIL_W, SAIL_X = 41.0, 24.6, -1.0   # height above the spine, half-width, and where it's centered along the back
def spine_y(x, bob): return 12 + bob + 9.2 * np.sqrt(np.clip(1 - (x / 22) ** 2, 0, 1)) - 1.4
def sail_h(x): return SAIL_H * np.sqrt(np.clip(1 - ((x - SAIL_X) / SAIL_W) ** 2, 0, 1)) ** .85

def pose_of(phase, walking):
    # foot offsets (forward, lift) for each leg and the body's sway, from the gait phase (0..1)
    def foot(p):
        p %= 1.0
        if p < .5: return 7.0 - (p / .5) * 14.0, 0.0
        q = (p - .5) / .5; return -7.0 + q * 14.0, 3.6 * math.sin(math.pi * q)
    if not walking: return {"FR": (4.5, 0), "HL": (6.5, 0), "FL": (-4.5, 0), "HR": (-4.5, 0), "sway": 0.0, "bob": 0.0, "head": 0.0}
    return {"FR": foot(phase), "HL": foot(phase), "FL": foot(phase + .5), "HR": foot(phase + .5),
            "sway": math.sin(2 * math.pi * phase), "bob": math.sin(4 * math.pi * phase), "head": -math.sin(2 * math.pi * phase)}

def parts(P, pz):
    # every named piece of the animal in its own frame: x forward, y up, z toward its right. Returns the blended distance and a dict of piece distances.
    sw, bob, hd = pz["sway"], pz["bob"] * .35 + LIFT, pz["head"]
    D = {}
    torso = ellipsoid(P, (0, 12 + bob, 0), (22, 9.6, 10.4)); D["torso"] = torso
    chest = ellipsoid(P, (12, 12.4 + bob, 0), (11, 10.2, 10.2)); D["chest"] = chest
    hips = ellipsoid(P, (-13, 12 + bob, 0), (10, 9.2, 9.4)); D["hips"] = hips
    body = smin(smin(torso, chest, 4), hips, 4)
    tail = None   # long, thin and tapering, swaying to one side
    for i in range(20):
        t = i / 19; x = -18 - t * 54; y = 9.8 + bob - t * 8.4; z = (sw * 7.0) * t * t + 1.5 * math.sin(t * 3.0)
        s = sphere(P, (x, y, z), 5.9 * (1 - t) ** 1.1 + 1.0); tail = s if tail is None else smin(tail, s, 3)
    D["tail"] = tail; body = smin(body, tail, 4)
    neck = capsule(P, (17, 13.6 + bob, 0), (28, 16.8 + bob, hd), 7.6, 5.4); D["neck"] = neck; body = smin(body, neck, 3)
    hz = hd * 1.3
    skull = ellipsoid(P, (34, 18.6 + bob, hz), (12.2, 9.0, 7.8)); D["skull"] = skull; body = smin(body, skull, 1.5)
    brow = ellipsoid(P, (33, 25.4 + bob, hz), (6.6, 2.2, 8.2)); D["brow"] = brow; body = smin(body, brow, 1.2)
    snout = capsule(P, (37, 17.2 + bob, hz), (45.5, 15.8 + bob, hz + hd * .7), 5.8, 4.0); D["snout"] = snout; body = smin(body, snout, 2)
    jaw = capsule(P, (31, 12.8 + bob, hz), (44, 12.4 + bob, hz + hd * .7), 4.2, 2.6); D["jaw"] = jaw; body = smin(body, jaw, 1.2)
    # legs: short and sprawling, elbows out; shoulder, elbow, wrist, then a foot with three toes
    for name, xs, side in (("FR", 18.5, 1), ("FL", 18.5, -1), ("HR", -17, 1), ("HL", -17, -1)):
        fx, lift = pz[name]; zs = 1.0 if side > 0 else .58; sh = (xs, 9.8 + bob, side * 8.2); el = (xs + fx * .45 + (-2.5 if xs > 0 else 2.5), 6.2 + LIFT * .5 + lift * .55, side * 14.2 * zs)
        wr = (xs + fx * .9, 3.6 + LIFT * .15 + lift, side * 15.0 * zs); ft = (xs + fx * .9 + 2.2, 1.3 + lift, side * 15.6 * zs)
        d1 = capsule(P, sh, el, 3.5, 2.6); d2 = capsule(P, el, wr, 2.4, 1.8); pad = ellipsoid(P, ft, (3.0, 1.4, 2.2))
        # four thin toes fanned out over the ground, long enough to leave gaps between them, each ending in a pale claw
        toes = None
        for k, ang in enumerate((-42, -15, 15, 42)):
            a_ = math.radians(ang); L = 10.5 if k in (1, 2) else 8.8; dx, dz = math.cos(a_), math.sin(a_) * side
            tip = (ft[0] + .8 + dx * L, ft[1] - .2, ft[2] + dz * L); t = capsule(P, (ft[0] + .8, ft[1], ft[2] + dz * .4), tip, 1.0, .65)
            toes = t if toes is None else np.minimum(toes, t); D["claw%s%d" % (name, k)] = sphere(P, (tip[0] + dx * .5, tip[1] - .05, tip[2] + dz * .5), .8)
        d = smin(smin(d1, d2, 1.5), pad, 1.2); d = np.minimum(d, toes); D["leg" + name] = smin(d1, d2, 1.5); D["toe" + name] = np.minimum(pad, toes); body = smin(body, d1, 3)
        legs_all = d if name == "FR" else np.minimum(legs_all, d)
    # the sail: a thin fan standing on the back, wide and tall, reaching low at the tail end
    x, y, z = P[:, 0], P[:, 1], P[:, 2]; yb = spine_y(x, bob)
    D["sail"] = np.maximum(np.maximum(np.maximum((y - (yb + sail_h(x))) * .7, (yb - 1.5) - y), np.abs(z - sw * .3) - 1.25), np.abs(x - SAIL_X) - SAIL_W + .2)
    D["eye"] = sphere(P, (36.2, 24.0 + bob, hz + 7.4), 1.8); D["nose"] = sphere(P, (46.2, 16.8 + bob, hz + hd * .7 + 2.6), .85)
    claws = np.minimum.reduce([v for k, v in D.items() if k.startswith("claw")])
    total = np.minimum(np.minimum(np.minimum(body, legs_all), claws), np.minimum(np.minimum(D["sail"], D["eye"]), D["nose"]))
    return total, D

def to_local(Pc):
    c, s = math.cos(YAW), math.sin(YAW); return np.stack([Pc[:, 0] * c + Pc[:, 2] * s, Pc[:, 1], -Pc[:, 0] * s + Pc[:, 2] * c], 1)
def to_cam(v):
    c, s = math.cos(YAW), math.sin(YAW); return np.stack([v[:, 0] * c - v[:, 2] * s, v[:, 1], v[:, 0] * s + v[:, 2] * c], 1)

def render(pz, ox, oy):
    # orthographic rays from the camera: a ray per pixel, marched through the model
    js, is_ = np.mgrid[0:H, 0:W]; X = (is_ + .5 - ox).ravel(); ys = (oy - (js + .5)).ravel()
    ce, se = math.cos(ELEV), math.sin(ELEV); base = np.stack([X, ys * ce, -ys * se], 1); dirv = np.array([0, se, ce])
    t = np.full(len(X), 150.0); hit = np.zeros(len(X), bool)
    for _ in range(100):
        P = base + t[:, None] * dirv; d, _ = parts(to_local(P), pz)
        hit |= d < .25; t = np.where(hit, t, t - np.maximum(d, .25) * .9)
        if hit.all(): break
    P = base + t[:, None] * dirv; Pl = to_local(P); d0, D = parts(Pl, pz); hit = d0 < .6
    e = .6; n = np.zeros_like(Pl)
    for k in range(3):
        off = np.zeros(3); off[k] = e; n[:, k] = parts(Pl + off, pz)[0] - parts(Pl - off, pz)[0]
    n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-6); nc = to_cam(n)
    nv = np.stack([nc[:, 0], nc[:, 1] * ce - nc[:, 2] * se, nc[:, 2] * ce + nc[:, 1] * se], 1)
    lit = np.clip(nv @ LIGHT, 0, 1)
    names = list(D); M = np.stack([D[k] for k in names], 1); who = np.array(names)[np.argmin(M, 1)]
    img = np.zeros((H, W, 4), np.uint8); mat = np.full((H, W), "", object)
    xl, yl, zl, nyl = Pl[:, 0], Pl[:, 1], Pl[:, 2], n[:, 1]; bob = pz["bob"] * .35 + LIFT
    for i in np.where(hit)[0]:
        r, c = divmod(i, W); w = who[i]; b = BAYER[r % 4, c % 4] - .5
        if w == "eye": img[r, c] = EYE + (255,); mat[r, c] = "g"; continue
        if w == "nose": img[r, c] = NOSE + (255,); mat[r, c] = "g"; continue
        if w.startswith("claw"): img[r, c] = CLAW + (255,); mat[r, c] = "g"; continue
        if w == "sail":
            a = math.atan2(yl[i] - 6, xl[i] - SAIL_X); rr = math.hypot(yl[i] - 6, xl[i] - SAIL_X); s = a / (math.pi / 24); fs = s - math.floor(s)
            rb = (rr - 11) / 7.2; fr = rb - math.floor(rb); k = math.floor(rb); ph = (s + (.5 if k % 2 else 0)) % 1.0
            rib = fs < .13 or fs > .93; spot = rr > 11 and ((fr - .5) / .24) ** 2 + ((ph - .55) / .26) ** 2 < 1 and not rib
            top = yl[i] > spine_y(xl[i], bob) + sail_h(xl[i]) - 2.2
            idx = 1.7 + lit[i] * 1.2 + (1.7 if rib else 0) + (.5 if top else 0) - (1 - min(1, max(0, (yl[i] - 14) / 16))) * .8 + b * .35
            ramp = SPOT if (spot and not rib) else SAIL; mat[r, c] = "s"
        else:
            if w in ("jaw", "snout", "skull") and abs(D["snout"][i] - D["jaw"][i]) < 1.2 and xl[i] > 35 and nv[i, 0] > -.2 and nyl[i] > -.5:
                img[r, c] = (TOOTH if int(xl[i] * .8) % 2 == 0 and xl[i] < 47 else MOUTH) + (255,); mat[r, c] = "g"; continue
            under = nyl[i] < -.2 and w in ("torso", "chest", "hips", "tail", "neck", "jaw", "skull", "snout")
            leg = w.startswith(("leg", "toe")); ramp = BELLY if under else GREEN; mat[r, c] = "b" if under else "g"
            idx = .8 + lit[i] * 3.0 - (.7 if leg else 0) - (1 - min(1, max(0, (yl[i] - 2) / 9))) * .7 + b * .4
            if not under:   # the coat: dark blotches on the back, bars down the flank, rings on the tail
                if w == "tail" and math.sin(xl[i] * .85) > .35: idx -= 1.3
                elif w in ("torso", "chest", "hips", "neck") and (math.sin(xl[i] * .55 + yl[i] * .3) * math.sin(yl[i] * .9 + zl[i] * .45 + xl[i] * .2) > .5 or (yl[i] < 11 and math.sin(xl[i] * 1.15) > .5)): idx -= 1.2
                elif w in ("skull", "snout", "brow") and (math.sin(xl[i] * .9 + zl[i] * .5) > .55 and yl[i] > 16): idx -= 1.0
        img[r, c] = ramp[int(max(0, min(4, round(idx))))] + (255,)
    ey = [(r, c) for r in range(H) for c in range(W) if tuple(img[r, c, :3]) == EYE]
    if ey:   # a clean hand-placed eye: a small amber oval with a dark pupil
        r0, c0 = int(round(np.mean([a for a, _ in ey]))), int(round(np.mean([b for _, b in ey])))
        for a, b in ey: img[a, b] = 0
        for a, b in ((0, 0), (0, 1), (1, 0), (1, 1), (-1, 0), (-1, 1)): img[r0 + a, c0 + b] = EYE + (255,); mat[r0 + a, c0 + b] = "g"
        img[r0, c0 + 1] = PUPIL + (255,)
    return img, mat

def outline(img, mat):
    out = img.copy(); h, w = mat.shape
    for y in range(h):
        for x in range(w):
            if img[y, x, 3]: continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                xx, yy = x + dx, y + dy
                if 0 <= xx < w and 0 <= yy < h and img[yy, xx, 3]: out[y, x] = OUTLN[mat[yy, xx]] + (255,); break
    return out

def export(ims, path):
    # palette letters for every color used, then rows of letters ('.' is clear), written over the Dimetrodon block of js/pixelart.js
    KEYS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"; cols = []
    for im in ims:
        for p in im.get_flattened_data() if hasattr(im, "get_flattened_data") else im.getdata():
            if p[3] > 127 and p[:3] not in cols: cols.append(p[:3])
    assert len(cols) <= len(KEYS), len(cols)
    rows = [["".join(KEYS[cols.index(im.getpixel((x, y))[:3])] if im.getpixel((x, y))[3] > 127 else "." for x in range(im.width)) for y in range(im.height)] for im in ims]
    block = "// Coded pixel Dimetrodon in a false-3D 3/4 view, rendered by tools/pixeldime3d.py: PIXEL_ART.dime = {pal, frames: [stand, walk1, pass, walk2, pass]}.\nPIXEL_ART.dime = {\n  pal: {" + ", ".join(f'{KEYS[i]}:"#%02x%02x%02x"' % c for i, c in enumerate(cols)) + "},\n  frames: [\n" + ",\n".join("    [\n" + ",\n".join(f'      "{r}"' for r in fr) + "\n    ]" for fr in rows) + "\n  ]\n};\n"
    print(len(cols), "colors", ims[0].size, len(ims), "frames")
    if not path: return
    src = open(path).read(); a = src.index("// Coded pixel Dimetrodon"); b = src.index("// Coded pixel Tiktaalik")
    open(path, "w").write(src[:a] + block + src[b:])

if __name__ == "__main__":
    ox, oy = W * .5, H * .88
    frames = [render(pose_of(0, False), ox, oy)] + [render(pose_of(p, True), ox, oy) for p in (0, .25, .5, .75)]
    ims = [Image.fromarray(outline(*f)) for f in frames]
    boxes = [im.getbbox() for im in ims]; box = (min(b[0] for b in boxes) - 1, min(b[1] for b in boxes) - 1, max(b[2] for b in boxes) + 1, max(b[3] for b in boxes) + 1)
    ims = [im.crop(box) for im in ims]; print("size", ims[0].size)
    export(ims, sys.argv[1] if len(sys.argv) > 1 else None)
    sheet = Image.new("RGBA", (ims[0].width * 5 + 60, ims[0].height + 20), (200, 188, 138, 255))
    for i, im in enumerate(ims): sheet.alpha_composite(im, (10 + i * (im.width + 10), 10))
    sheet.resize((sheet.width * 3, sheet.height * 3), Image.NEAREST).save(OUT + "dime3d.png")
    big = Image.new("RGBA", (ims[0].width + 20, ims[0].height + 20), (200, 188, 138, 255)); big.alpha_composite(ims[0], (10, 10)); big.resize((big.width * 8, big.height * 8), Image.NEAREST).save(OUT + "dime3d_big.png")
