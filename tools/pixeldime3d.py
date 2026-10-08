# Renders a false-3D 3/4-view pixel Dimetrodon (PIXEL_ART.dime in js/pixelart.js, and a preview sheet).
# A small model (ellipsoids and capsules blended smoothly, plus a fan-shaped sail) is ray-marched from a camera above and in front, shaded from the top left,
# and quantized to the original sprite's colors (olive body, yellow-olive belly, orange sail with light spines). The same model is posed for a stand frame and
# four walk frames (a diagonal gait), so the anatomy is the same in all of them. Usage: python3 -I tools/pixeldime3d.py [pixelart.js]
import sys, math, numpy as np
from PIL import Image

W, H = 150, 130                    # working canvas; the sprites are cropped to the union of their bounds
ELEV, YAW = math.radians(32), math.radians(28)   # camera height above the ground plane; how far the animal turns toward the viewer
LIGHT = np.array([-.62, .7, .32]); LIGHT /= np.linalg.norm(LIGHT)   # from the top left and a little toward the viewer (camera space: x right, y up, z toward viewer)
BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0

def hexc(h): return tuple(int(h[i:i+2], 16) for i in (1, 3, 5))
# tones run dark to light; the middle ones are the original sprite's colors
GREEN  = [hexc(c) for c in ("#2B3210", "#434B16", "#616F22", "#7D8E2E", "#9BAE45")]
BELLY  = [hexc(c) for c in ("#6E6528", "#948A38", "#B2A542", "#CFC262", "#E5DF96")]
SAIL   = [hexc(c) for c in ("#5A2600", "#8A3C00", "#B24E00", "#B46C33", "#D68C52")]
OUTLN  = {"g": hexc("#1B2008"), "b": hexc("#4A4318"), "s": hexc("#3F1A00")}
EYE, PUPIL, TOOTH, NOSE = hexc("#DAA200"), hexc("#000000"), hexc("#E5DF96"), hexc("#262C0C")

def smin(a, b, k):
    h = np.maximum(k - np.abs(a - b), 0) / k; return np.minimum(a, b) - h * h * k * .25
def ellipsoid(P, c, r):
    c, r = np.array(c, float), np.array(r, float); q = (P - c) / r; k0 = np.linalg.norm(q, axis=1); k1 = np.linalg.norm((P - c) / (r * r), axis=1); return k0 * (k0 - 1) / np.maximum(k1, 1e-6)
def capsule(P, a, b, r1, r2):
    a, b = np.array(a, float), np.array(b, float); pa, ba = P - a, b - a; h = np.clip(pa @ ba / (ba @ ba), 0, 1)
    return np.linalg.norm(pa - h[:, None] * ba, axis=1) - (r1 + (r2 - r1) * h)
def sphere(P, c, r): return np.linalg.norm(P - np.array(c, float), axis=1) - r

def pose_of(phase, walking):
    # foot offsets (forward, lift) for each leg and the body's sway, from the gait phase (0..1)
    def foot(p):
        p %= 1.0
        if p < .5: return 8.0 - (p / .5) * 16.0, 0.0
        q = (p - .5) / .5; return -8.0 + q * 16.0, 4.0 * math.sin(math.pi * q)
    if not walking: return {"FR": (0, 0), "HL": (0, 0), "FL": (0, 0), "HR": (0, 0), "sway": 0.0, "bob": 0.0, "head": 0.0}
    return {"FR": foot(phase), "HL": foot(phase), "FL": foot(phase + .5), "HR": foot(phase + .5),
            "sway": math.sin(2 * math.pi * phase), "bob": math.sin(4 * math.pi * phase), "head": -math.sin(2 * math.pi * phase)}

def parts(P, pz):
    # every named piece of the animal in its own frame: x forward, y up, z toward its right. Returns the blended body distance and a dict of piece distances.
    sw, bob, hd = pz["sway"], pz["bob"] * .4, pz["head"]
    D = {}
    torso = ellipsoid(P, (0, 17.4 + bob, 0), (19, 10.4, 10)); D["torso"] = torso
    chest = ellipsoid(P, (9, 17 + bob, 0), (11, 10.6, 10.2)); D["chest"] = chest
    body = smin(torso, chest, 4)
    # tail: a tapering chain curving to one side as it sways
    tail = None
    for i in range(9):
        t = i / 8; x = -16 - t * 40; y = 15.5 + bob - t * 11; z = (sw * 7.5) * t * t + 1.8 * math.sin(t * 3.0) * (1 - t * .3)
        r = 7.4 * (1 - t) ** .9 + .8
        s = sphere(P, (x, y, z), r); tail = s if tail is None else smin(tail, s, 3)
    D["tail"] = tail; body = smin(body, tail, 4)
    neck = capsule(P, (15, 18.5 + bob, 0), (27, 21 + bob, hd * 1.2), 6.0, 4.2); D["neck"] = neck; body = smin(body, neck, 2.5)
    hz = hd * 1.6
    skull = ellipsoid(P, (33.5, 21.5 + bob, hz), (9.2, 6.6, 5.8)); D["skull"] = skull; body = smin(body, skull, 1.2)
    brow = ellipsoid(P, (36, 24.4 + bob, hz), (4.4, 1.9, 6.0)); D["brow"] = brow; body = smin(body, brow, 1.5)
    snout = capsule(P, (35, 21.2 + bob, hz), (49, 19.6 + bob, hz + hd * .8), 4.8, 2.8); D["snout"] = snout; body = smin(body, snout, 2.5)
    jaw = capsule(P, (31, 17.2 + bob, hz), (46, 16.6 + bob, hz + hd * .8), 3.4, 1.8); D["jaw"] = jaw; body = smin(body, jaw, 1.5)
    # legs: shoulder, elbow, wrist, foot; far-side legs get the same pose
    legs = {}
    for name, xs, side in (("FR", 11.5, 1), ("FL", 11.5, -1), ("HR", -12, 1), ("HL", -12, -1)):
        fx, lift = pz[name]; sh = (xs, 12.8 + bob, side * 7.6); el = (xs + fx * .45 - (2 if xs > 0 else -2), 7.0 + lift * .55, side * 13.2)
        wr = (xs + fx * .9, 3.2 + lift, side * 14.2); ft = (xs + fx * .9 + 2.8, 1.3 + lift, side * 14.6)
        d1 = capsule(P, sh, el, 3.8, 3.0); d2 = capsule(P, el, wr, 2.8, 2.2); d3 = ellipsoid(P, ft, (5.0, 1.6, 2.8))
        for tz in (-1.6, 0, 1.6):
            d3 = smin(d3, capsule(P, (ft[0] + 2, ft[1], ft[2] + tz * 1.1), (ft[0] + 6.4, ft[1] - .1, ft[2] + tz * 1.5), 1.1, .8), .8)
        d = smin(smin(d1, d2, 1.5), d3, 1.5); legs[name] = d; D["leg" + name] = d
        body = smin(body, d1, 3)
    # the sail: a thin fan standing on the spine, taller toward the middle
    x, y, z = P[:, 0], P[:, 1], P[:, 2]
    yb = 17.4 + bob + 9.8 * np.sqrt(np.clip(1 - (x / 20) ** 2, 0, 1)) - 1.8
    hgt = 46 * np.sqrt(np.clip(1 - ((x + 3) / 16.5) ** 2, 0, 1)) ** .9
    sail = np.maximum(np.maximum(np.maximum((y - (yb + hgt)) * .7, (yb - 1.5) - y), np.abs(z - sw * .3) - 1.3), np.abs(x + 3) - 16.4); D["sail"] = sail
    # small details: the eye on the right side and the nostril, as spheres that sit in the skin
    D["eye"] = sphere(P, (36.5, 24 + bob, hz + 4.9), 1.7); D["nose"] = sphere(P, (48.6, 20.8 + bob, hz + hd * .8 + 1.5), .8)
    total = np.minimum(np.minimum(body, sail), np.minimum(D["eye"], D["nose"]))
    return total, D

def to_local(Pc):
    # camera-world (X right, Y up, Z toward viewer) -> the animal's frame
    c, s = math.cos(YAW), math.sin(YAW); return np.stack([Pc[:, 0] * c + Pc[:, 2] * s, Pc[:, 1], -Pc[:, 0] * s + Pc[:, 2] * c], 1)
def to_cam(v):
    c, s = math.cos(YAW), math.sin(YAW); return np.stack([v[:, 0] * c - v[:, 2] * s, v[:, 1], v[:, 0] * s + v[:, 2] * c], 1)

def render(pz, ox, oy):
    # orthographic rays from the camera: a ray per pixel, marched through the model
    js, is_ = np.mgrid[0:H, 0:W]; X = (is_ + .5 - ox).ravel(); ys = (oy - (js + .5)).ravel()
    ce, se = math.cos(ELEV), math.sin(ELEV); base = np.stack([X, ys * ce, -ys * se], 1); dirv = np.array([0, se, ce])   # dirv points toward the viewer
    t = np.full(len(X), 140.0); hit = np.zeros(len(X), bool)
    for _ in range(90):
        P = base + t[:, None] * dirv; d, _ = parts(to_local(P), pz)
        hit |= d < .25; t = np.where(hit, t, t - np.maximum(d, .25) * .9)
        if hit.all(): break
    P = base + t[:, None] * dirv; Pl = to_local(P); d0, D = parts(Pl, pz); hit = d0 < .6
    # normals from the distance field
    e = .6; n = np.zeros_like(Pl)
    for k in range(3):
        off = np.zeros(3); off[k] = e; n[:, k] = parts(Pl + off, pz)[0] - parts(Pl - off, pz)[0]
    n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-6); nc = to_cam(n)
    # one extra rotation for the camera tilt: normals into the view frame, where the light is defined
    nv = np.stack([nc[:, 0], nc[:, 1] * ce - nc[:, 2] * se, nc[:, 2] * ce + nc[:, 1] * se], 1)
    lit = np.clip(nv @ LIGHT, 0, 1)
    names = list(D); M = np.stack([D[k] for k in names], 1); who = np.array(names)[np.argmin(M, 1)]
    img = np.zeros((H, W, 4), np.uint8); mat = np.full((H, W), "", object); ys_, xs_ = ys, X
    yl, nyl = Pl[:, 1], n[:, 1]; xl = Pl[:, 0]
    for i in np.where(hit)[0]:
        r, c = divmod(i, W); w = who[i]; b = BAYER[r % 4, c % 4] - .5
        if w == "eye": img[r, c] = EYE + (255,); mat[r, c] = "g"; continue
        if w == "nose": img[r, c] = NOSE + (255,); mat[r, c] = "g"; continue
        if w == "sail":
            a = math.atan2(yl[i] - 5, xl[i] + 3); stripe = int(math.floor(a / (math.pi / 30))) % 2; rim = yl[i] > 17.4 + 9.8 - 1.8 + 46 * math.sqrt(max(0, 1 - ((xl[i] + 3) / 16.5) ** 2)) ** .9 - 2.4
            idx = 1.6 + lit[i] * 1.4 + (.9 if stripe else 0) + (.6 if rim else 0) - (1 - min(1, max(0, (yl[i] - 14) / 16))) * .8 + b * .35; ramp = SAIL; mat[r, c] = "s"
        else:
            mouth = w in ("jaw", "snout", "skull") and abs(D["snout"][i] - D["jaw"][i]) < 1.1 and xl[i] > 31 and nv[i, 0] > -.2 and nyl[i] > -.5
            if mouth:
                img[r, c] = (TOOTH if int(xl[i] * .55) % 2 == 0 and xl[i] < 47 else GREEN[0]) + (255,); mat[r, c] = "g"; continue
            under = nyl[i] < -.22 and w in ("torso", "chest", "tail", "neck", "jaw", "skull", "snout")
            leg = w.startswith("leg"); ramp = BELLY if under else GREEN; mat[r, c] = "b" if under else "g"
            idx = .8 + lit[i] * 3.0 - (1.0 if leg else 0) - (1 - min(1, max(0, (yl[i] - 2) / 9))) * .7 + b * .4
        img[r, c] = ramp[int(max(0, min(4, round(idx))))] + (255,)
    ey = [(r, c) for r in range(H) for c in range(W) if tuple(img[r, c, :3]) == EYE]
    if ey:
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
        for p in im.getdata():
            if p[3] > 127 and p[:3] not in cols: cols.append(p[:3])
    assert len(cols) <= len(KEYS), len(cols)
    rows = [["".join(KEYS[cols.index(im.getpixel((x, y))[:3])] if im.getpixel((x, y))[3] > 127 else "." for x in range(im.width)) for y in range(im.height)] for im in ims]
    block = "// Coded pixel Dimetrodon in a false-3D 3/4 view, rendered by tools/pixeldime3d.py: PIXEL_ART.dime = {pal, frames: [stand, walk1, pass, walk2, pass]}.\nPIXEL_ART.dime = {\n  pal: {" + ", ".join(f'{KEYS[i]}:"#%02x%02x%02x"' % c for i, c in enumerate(cols)) + "},\n  frames: [\n" + ",\n".join("    [\n" + ",\n".join(f'      "{r}"' for r in fr) + "\n    ]" for fr in rows) + "\n  ]\n};\n"
    print(len(cols), "colors", ims[0].size, len(ims), "frames")
    if not path: return
    src = open(path).read(); a = src.index("// Coded pixel Dimetrodon"); b = src.index("// Coded pixel Tiktaalik")
    open(path, "w").write(src[:a] + block + src[b:])

if __name__ == "__main__":
    ox, oy = W * .52, H * .9
    frames = [render(pose_of(0, False), ox, oy)] + [render(pose_of(p, True), ox, oy) for p in (0, .25, .5, .75)]
    ims = [Image.fromarray(outline(*f)) for f in frames]
    boxes = [im.getbbox() for im in ims]; box = (min(b[0] for b in boxes) - 1, min(b[1] for b in boxes) - 1, max(b[2] for b in boxes) + 1, max(b[3] for b in boxes) + 1)
    ims = [im.crop(box) for im in ims]; print("size", ims[0].size)
    sheet = Image.new("RGBA", (ims[0].width * 5 + 40, ims[0].height + 20), (200, 188, 138, 255))
    for i, im in enumerate(ims): sheet.alpha_composite(im, (10 + i * (im.width + 5), 10))
    export(ims, sys.argv[1] if len(sys.argv) > 1 else None)
    big = Image.new('RGBA', (ims[0].width + 20, ims[0].height + 20), (200, 188, 138, 255)); big.alpha_composite(ims[0], (10, 10)); big.resize((big.width * 8, big.height * 8), Image.NEAREST).save('/tmp/claude-0/-home-user-genesis-game/1dc99202-6460-592d-946c-173bd97ee53b/scratchpad/dime3d_big.png')
    sheet.resize((sheet.width * 4, sheet.height * 4), Image.NEAREST).save("/tmp/claude-0/-home-user-genesis-game/1dc99202-6460-592d-946c-173bd97ee53b/scratchpad/dime3d.png")
