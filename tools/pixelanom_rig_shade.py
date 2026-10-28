#!/usr/bin/env python3
"""Restyle the Anomalocaris rig's parts to the art direction: the dark outlines go (a silhouette edge becomes the lit or shaded
shade of the color inside it by which side it faces, segment lines inside become deep grooves, each plate shaded on its back edge and lit on
its front edge so the segments stand out), and the hot crimson and orange move to the earthy palette family (brick red, rust orange).
Each part is done in its own frame; far parts are a step darker and flat. The eyes stay as drawn. Reads anom-rig.json, writes anom-shaded.json.
    python3 -I tools/pixelanom_rig_shade.py   then   python3 tools/rigger/anomalocaris/gen-clips.py"""
import base64, io, json, os
from PIL import Image
here = os.path.join(os.path.dirname(os.path.abspath(__file__)), "rigger", "anomalocaris")
proj = json.load(open(os.path.join(here, "anom-rig.json")))

# ramps: (lit, base, shade, deep)
SHELL = ((184, 84, 56), (160, 62, 42), (126, 44, 32), (98, 34, 26))
BELLY = ((222, 128, 58), (200, 104, 36), (160, 76, 24), (120, 54, 16))
FARS = ((150, 56, 38), (126, 44, 32), (98, 34, 26), (74, 26, 20))
OUTLINE = {(24, 1, 6), (17, 1, 5), (37, 1, 9), (157, 6, 36), (142, 5, 33), (127, 4, 30), (172, 7, 39), (124, 5, 30)}   # dark outline: lit or shaded edge outside, groove inside
GROOVE = {(52, 2, 12), (59, 2, 15), (99, 47, 12)}   # drawn segment lines
BASE = {(168, 36, 62), (181, 39, 67), (155, 33, 57), (229, 123, 57), (231, 132, 71), (208, 97, 37)}   # the plates' own colors
EYE = {(0, 0, 0), (8, 8, 8), (223, 223, 223), (255, 255, 255)}
def is_belly(c): return c[1] > 40 and c[0] > 190 or c == (99, 47, 12)
def restyle(im, far):
    W, H = im.size; px = im.load(); out = im.copy(); o = out.load()
    solid = lambda x, y: 0 <= x < W and 0 <= y < H and px[x, y][3] >= 128
    belly = lambda x, y: solid(x, y) and is_belly(px[x, y][:3])
    grooves = []
    for y in range(H):
        for x in range(W):
            c = px[x, y]
            if c[3] < 128 or c[:3] in EYE: continue
            rgb = c[:3]
            ramp = BELLY if is_belly(rgb) else (FARS if far else SHELL)
            if rgb in OUTLINE:
                if rgb == (24, 1, 6) and any(is_belly(px[x + dx, y + dy][:3]) for dx, dy in ((0, 1), (0, -1), (1, 0), (-1, 0)) if solid(x + dx, y + dy)): ramp = BELLY
                if not solid(x, y - 1) or not solid(x - 1, y): role = 1 if far else 0
                elif not solid(x, y + 1): role = 3
                elif not solid(x + 1, y): role = 2
                elif any(not solid(x, y - k) for k in (2, 3)): role = 1   # the thick outline under the back's lit edge, so the back isn't a light cap
                else: role = 3; grooves.append((x, y, ramp))
            elif rgb in GROOVE:
                role = 3; grooves.append((x, y, ramp))
            elif rgb in BASE:
                role = 1
                if ramp is SHELL and solid(x, y - 1) and any(not solid(x, y - k) for k in (2, 3, 4)): role = 1
            else:   # the other reds: the pinkish tints are lit, the dark ones deep
                role = 0 if rgb[1] > 20 else 3
            o[x, y] = (*ramp[role], 255)
    # each plate's back edge (left of a groove) faces right, so it's shaded; its front edge (right of a groove) faces left, so it's lit
    if not far:
        for x, y, ramp in grooves:
            if solid(x - 1, y) and px[x - 1, y][:3] in BASE: o[x - 1, y] = (*ramp[2], 255)
            if solid(x + 1, y) and px[x + 1, y][:3] in BASE: o[x + 1, y] = (*ramp[0], 255)
    return out

for n in proj["nodes"]:
    if n.get("hidden"): continue
    data = proj["assets"][n["asset"]].split(",", 1)[1]
    im = restyle(Image.open(io.BytesIO(base64.b64decode(data))).convert("RGBA"), "far" in n["name"].lower())
    buf = io.BytesIO(); im.save(buf, "PNG")
    proj["assets"][n["asset"]] = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
proj["nodes"] = [n for n in proj["nodes"] if not n.get("hidden")]   # the scratch layer of old sprites goes
proj["assets"] = {k: v for k, v in proj["assets"].items() if any(n["asset"] == k for n in proj["nodes"])}
proj["shaded"] = "pixelanom_rig_shade"
json.dump(proj, open(os.path.join(here, "anom-shaded.json"), "w"))
