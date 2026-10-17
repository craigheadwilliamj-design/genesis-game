#!/usr/bin/env python3
"""Render the Compsognathus's clips into the strips a vivarium draws (it can't use the rig):
sprites/comp.png (the standing picture, idle frame 0) and sprites/comp-idle.png (frames side by side: the 10-frame
standing loop, then the three dynamic idles, the 12 fps one thinned to the strip's one speed). Prints the SPRITES numbers.
Reads compsognathus-clips.json (gen-idle.py writes it). Needs Pillow. Whole pixels only: nearest-neighbor turns."""
import base64, io, json, math, os
from PIL import Image
here = os.path.dirname(os.path.abspath(__file__)); spr = os.path.join(here, "..", "..", "..", "sprites")
proj = json.load(open(os.path.join(here, "compsognathus-clips.json")))
nodes = {n["id"]: n for n in proj["nodes"]}; W, H = proj["cell"]["w"], proj["cell"]["h"]
assets = {k: Image.open(io.BytesIO(base64.b64decode(v.split(",", 1)[1]))).convert("RGBA") for k, v in proj["assets"].items()}
def mat(n, pose):
    p = pose.get(n["id"], {}); r = math.radians(p.get("r", 0)); c, s = math.cos(r), math.sin(r)
    m = [c, -s, n["lx"] + p.get("dx", 0), s, c, n["ly"] + p.get("dy", 0)]
    if n.get("parent"):
        a = mat(nodes[n["parent"]], pose)
        m = [a[0]*m[0] + a[1]*m[3], a[0]*m[1] + a[1]*m[4], a[0]*m[2] + a[1]*m[5] + a[2], a[3]*m[0] + a[4]*m[3], a[3]*m[1] + a[4]*m[4], a[3]*m[2] + a[4]*m[5] + a[5]]
    return m
def draw(pose):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for n in proj["nodes"]:
        im = assets[n["asset"]]
        if n.get("flip"): im = im.transpose(Image.FLIP_LEFT_RIGHT)
        a, b, c, d, e, f = mat(n, pose); det = a*e - b*d; ia, ib, ic, ie = e/det, -b/det, -d/det, a/det
        img = Image.alpha_composite(img, im.transform((W, H), Image.AFFINE, (ia, ib, n["px"] - (ia*c + ib*f), ic, ie, n["py"] - (ic*c + ie*f)), Image.NEAREST))
    return img
clip = lambda name: next(c for c in proj["clips"] if c["name"] == name)["frames"]
base = clip("idle"); d1, d2, d3 = clip("Dynamic idle 1"), clip("dynamic idle 2"), clip("dynamic idle 3")
d3 = [d3[min(len(d3) - 1, round(k * 1.5))] for k in range(int(len(d3) / 1.5))]   # 12 fps thinned to 8
groups = [base, d1, d2, d3]; frames = [f for g in groups for f in g]
strip = Image.new("RGBA", (W * len(frames), H), (0, 0, 0, 0))
for i, f in enumerate(frames): strip.paste(draw(f), (W * i, 0))
strip.save(os.path.join(spr, "comp-idle.png"), optimize=True); draw(base[0]).save(os.path.join(spr, "comp.png"), optimize=True)
at = 0; dyn = []
for g in groups: dyn.append([at, len(g)]); at += len(g)
print(f"idle:{len(frames)}, base:{len(base)}, dyn:{json.dumps(dyn[1:], separators=(',', ':'))}")
