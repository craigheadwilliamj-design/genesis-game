#!/usr/bin/env python3
"""Restyle the Anomalocaris rig's parts to the art direction: the dark outlines go (a silhouette edge becomes the lit or shaded
shade of the color inside it by which side it faces, segment lines inside become deep grooves, each plate shaded on its back edge and lit on
its front edge so the segments stand out), and the hot crimson and peach move to the earthy palette family (brick red, rust orange, sand).
Each part is done in its own frame; far flaps stay a step darker and flat. Reads anom-rig.json, writes anom-shaded.json.
    python3 -I tools/pixelanom_rig_shade.py   then   python3 tools/rigger/anomalocaris/gen-clips.py"""
import base64, io, json, os
from PIL import Image
here = os.path.join(os.path.dirname(os.path.abspath(__file__)), "rigger", "anomalocaris")
proj = json.load(open(os.path.join(here, "anom-rig.json")))

# ramps: (lit, base, shade, deep)
SHELL = ((184, 84, 56), (160, 62, 42), (126, 44, 32), (98, 34, 26))
FLAP = ((200, 98, 14), (178, 78, 0), (140, 60, 0), (108, 46, 4))
FARF = ((150, 66, 10), (128, 54, 6), (102, 42, 6), (80, 34, 6))
SAND = ((222, 180, 118), (204, 152, 92))
ROLE = {   # old color -> (ramp, role); role "edge" means an outline pixel
    (181, 39, 67): (SHELL, 0), (168, 36, 62): (SHELL, 1), (155, 33, 57): (SHELL, 2),
    (157, 6, 36): (SHELL, "edge"), (142, 5, 33): (SHELL, "edge"), (127, 4, 30): (SHELL, "edge"), (172, 7, 39): (SHELL, "edge"),
    (112, 4, 26): (SHELL, 3), (82, 3, 19): (SHELL, 3),
    (208, 97, 37): (FLAP, 1), (173, 61, 1): (FLAP, "edge"), (130, 61, 25): (FLAP, 2), (229, 158, 121): (SAND, 1), (235, 150, 99): (SAND, 1),
    (150, 70, 29): (FARF, 1), (125, 44, 1): (FARF, "edge"), (94, 44, 20): (FARF, 2), (175, 134, 121): (FARF, 0),
}
BASES = ((168, 36, 62), (181, 39, 67), (155, 33, 57), (208, 97, 37))
def restyle(im, far):
    W, H = im.size; px = im.load(); out = im.copy(); o = out.load()
    solid = lambda x, y: 0 <= x < W and 0 <= y < H and px[x, y][3] >= 128
    grooves = []
    for y in range(H):
        for x in range(W):
            c = px[x, y]
            if c[3] < 128: continue
            rgb = c[:3]
            if rgb == (243, 186, 155): o[x, y] = (*SAND[0], 255); continue   # flap tips and belly edge
            if rgb not in ROLE: continue   # the eye
            ramp, role = ROLE[rgb]
            if far and ramp is FLAP: ramp = FARF
            if role == 0 and ramp is SHELL and solid(x, y - 1) and any(not solid(x, y - k) for k in (2, 3, 4)): role = 1   # the drawn highlight under the back's edge; the edge itself is lit now
            if role == "edge":
                if not solid(x, y - 1) or not solid(x - 1, y): role = 0 if not far else 1
                elif not solid(x, y + 1): role = 3
                elif not solid(x + 1, y): role = 2
                elif any(not solid(x, y - k) for k in (2, 3)): role = 1   # the thick outline under the back's lit edge, so the back isn't a light cap
                else: role = 3; grooves.append((x, y, ramp))   # a segment line inside: a deep groove
            o[x, y] = (*ramp[role], 255)
    # each plate's back edge (left of a groove) faces right, so it's shaded; its front edge (right of a groove) faces left, so it's lit
    if not far:
        for x, y, ramp in grooves:
            if solid(x - 1, y) and px[x - 1, y][:3] in BASES: o[x - 1, y] = (*ramp[2], 255)
            if solid(x + 1, y) and px[x + 1, y][:3] in BASES: o[x + 1, y] = (*ramp[0], 255)
    return out

for n in proj["nodes"]:
    data = proj["assets"][n["asset"]].split(",", 1)[1]
    im = restyle(Image.open(io.BytesIO(base64.b64decode(data))).convert("RGBA"), "far" in n["name"].lower())
    buf = io.BytesIO(); im.save(buf, "PNG")
    proj["assets"][n["asset"]] = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
proj["shaded"] = "pixelanom_rig_shade"
json.dump(proj, open(os.path.join(here, "anom-shaded.json"), "w"))
