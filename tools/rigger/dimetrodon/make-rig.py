#!/usr/bin/env python3
"""Cuts sprites/dime.png into rigger parts and writes dimetrodon-rig.json (the rig with no clips; gen-clips.js adds them).
    python3 -I tools/rigger/dimetrodon/make-rig.py
The picture is already shaded, and the body, sail and tail turn only a few degrees, so the parts keep its pixels; the legs are new (the old picture only hints at them).
Each part is a full 100x75 cell with the part where it belongs, as the rigger wants. Tail segments overlap their neighbor by a column so a turn leaves no gap."""
import base64, io, json, os
from PIL import Image
here = os.path.dirname(os.path.abspath(__file__)); src = Image.open(os.path.join(here, "../../../sprites/dime.png")).convert("RGBA")
W, H = src.size
C = {"b": (97,111,34), "B": (123,139,48), "v": (80,92,28), "d": (67,75,22), "l": (178,165,66), "L": (201,190,90), "m": (143,132,50)}
SAIL = {(178,78,0), (200,98,14), (140,60,0), (180,108,51)}; BELLY = {C["l"], C["L"], C["m"]}
px = {(x, y): src.getpixel((x, y))[:3] for y in range(H) for x in range(W) if src.getpixel((x, y))[3]}
for (x, y) in list(px):   # the old picture's leg blobs go; the belly keeps its shadow line
    if y >= 59 and (44 <= x < 55 or 74 <= x < 86):
        if y == 59: px[(x, y)] = C["m"]
        else: del px[(x, y)]
parts = {k: {} for k in ("sail", "tail1", "tail2", "tail3", "body", "head", "jaw")}
for (x, y), c in px.items():
    if c in SAIL: parts["sail"][(x, y)] = c
    elif x >= 88 and 50 <= y <= 52 or (x >= 88 and y == 49 and c in BELLY): parts["jaw"][(x, y)] = c
    elif x >= 87 and y < 50: parts["head"][(x, y)] = c
    elif x < 14: parts["tail3"][(x, y)] = c
    elif x < 28: parts["tail2"][(x, y)] = c
    elif x < 40: parts["tail1"][(x, y)] = c
    else: parts["body"][(x, y)] = c
for (x, y), c in px.items():   # the head overlaps the neck by two columns so turning it opens no seam
    if x in (85, 86) and y < 50 and c not in SAIL: parts["head"][(x, y)] = c
for k, lo in (("tail1", 28), ("tail2", 14), ("tail3", 0)):   # overlap the next segment toward the body by one column
    hi = {"tail1": 40, "tail2": 28, "tail3": 14}[k]
    for (x, y), c in px.items():
        if x == hi and c not in SAIL: parts[k][(x, y)] = c
# legs: a thigh and shin piece that turns at the hip, and a foot that stays flat. Near legs are olive, far ones a shade darker.
def leg(hx, hy, far):
    t, s, f = (C["v"], C["d"], C["d"]) if far else (C["b"], C["d"], C["d"])
    lit = C["v"] if far else C["B"]
    leg_px = {(hx-1, hy): lit, (hx, hy): t, (hx+1, hy): C["v"], (hx-1, hy+1): t, (hx, hy+1): t, (hx+1, hy+1): C["v"],
              (hx, hy+2): s, (hx+1, hy+2): s, (hx, hy+3): s, (hx+1, hy+3): s, (hx, hy+4): s, (hx+1, hy+4): s}
    foot_px = {(hx, hy+5): f, (hx+1, hy+5): f, (hx+2, hy+5): f, (hx+3, hy+5): f}
    return leg_px, foot_px
HIP = 58; LEGS = {"far-hind": (52, True), "far-front": (76, True), "near-hind": (46, False), "near-front": (81, False)}
for k, (hx, far) in LEGS.items():
    parts[k + "-leg"], parts[k + "-foot"] = leg(hx, HIP, far)
def asset(d):
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for (x, y), c in d.items(): im.putpixel((x, y), c + (255,))
    b = io.BytesIO(); im.save(b, "PNG"); return "data:image/png;base64," + base64.b64encode(b.getvalue()).decode()
# (name, parent, joint world x,y); order is draw order, back to front
BJ = (62, 56)
spec = [("sail", "body", (62, 49)), ("far-hind-leg", "body", (52, HIP)), ("far-hind-foot", "far-hind-leg", (52, HIP+5)), ("far-front-leg", "body", (76, HIP)), ("far-front-foot", "far-front-leg", (76, HIP+5)),
        ("tail3", "tail2", (14, 60)), ("tail2", "tail1", (28, 59)), ("tail1", "body", (40, 57)), ("body", None, BJ), ("head", "body", (87, 48)), ("jaw", "head", (89, 50)),
        ("near-hind-leg", "body", (46, HIP)), ("near-hind-foot", "near-hind-leg", (46, HIP+5)), ("near-front-leg", "body", (81, HIP)), ("near-front-foot", "near-front-leg", (81, HIP+5))]
pair = {"far-hind-leg": "near-hind-leg", "far-front-leg": "near-front-leg", "far-hind-foot": "near-hind-foot", "far-front-foot": "near-front-foot"}
pair.update({v: k for k, v in list(pair.items())})
ids = {n: "n%d" % (i*2+2) for i, (n, _, _) in enumerate(spec)}; world = {n: j for n, _, j in spec}
nodes, assets = [], {}
for i, (n, par, j) in enumerate(spec):
    a = "a%d" % (i*2+1); assets[a] = asset(parts[n])
    pw = world[par] if par else (0, 0)
    nodes.append({"id": ids[n], "name": n, "asset": a, "px": j[0], "py": j[1], "parent": ids[par] if par else None, "lx": j[0]-pw[0], "ly": j[1]-pw[1], "flip": False, "hidden": False, "mirror": ids[pair[n]] if n in pair else None})
json.dump({"name": "Dimetrodon", "cell": {"w": W, "h": H}, "ground": 62, "seq": 60, "assets": assets, "nodes": nodes, "ref": None, "clips": [{"name": "walk", "fps": 8, "frames": [{}]}]}, open(os.path.join(here, "dimetrodon-rig.json"), "w"))
print({n: ids[n] for n, _, _ in spec})
