#!/usr/bin/env python3
"""Write mosasaurus-clips.json from mosasaurus-rig.json (hand-made, flat parts: body, head, jaws, tail, near and far front and back fins) with clips
from one travelling body wave: `swim` (the body, tail and head ripple in turn, the tail beating widest, fins paddling), `hover` (the same wave small and
slow, fins sculling) and `bite` (head lifts, jaws gape wide, snap shut twice, back to a hover). Head, jaws and tail are root parts, so each is
shifted with the body's turn about its middle.
    python3 -I gen-clips.py [SHEETS=dir]   then   rigtogame.py tools/rigger/mosasaurus/mosasaurus-clips.json mosa --walk swim --stand hover --idle bite
In a pool the walk clip is the swim stroke (`poolSwim` plays it by distance). With SHEETS=<dir> in the environment it also writes a contact sheet and GIF of each clip."""
import json, math, os, sys
here = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(here, ".."))
proj = json.load(open(os.path.join(here, "mosasaurus-rig.json")))
BODY, HEAD, JAWS, TAIL = "n2", "n4", "n6", "n12"
FF, FB, FFF, FBF = "n8", "n10", "n13", "n15"   # near front and back fins, far front and back
NODE = {n["id"]: n for n in proj["nodes"]}
TAU = 2 * math.pi

def spin(p, pivot, r):
    """How far turning point p about pivot by r degrees (clockwise on screen) moves it."""
    a = math.radians(r); x, y = p[0] - pivot[0], p[1] - pivot[1]
    return x * math.cos(a) - y * math.sin(a) - x, x * math.sin(a) + y * math.cos(a) - y

def joint(i): return (NODE[i]["lx"], NODE[i]["ly"])

def pose(rb, rt, rh, jaw, fins, bob=0):
    """Body turned rb degrees about its joint, tail rt, head rh and jaws open by jaw (all relative to what carries them); fins = rotations (FF, FB, FFF, FBF)."""
    bj = joint(BODY)
    tdx, tdy = spin(joint(TAIL), bj, rb)
    hdx, hdy = spin(joint(HEAD), bj, rb)
    jdx, jdy = spin(joint(JAWS), bj, rb)
    jx, jy = spin(joint(JAWS), joint(HEAD), rb + rh)   # the jaws' joint also swings round the head's
    jx2, jy2 = spin(joint(JAWS), joint(HEAD), rb)
    p = {
        BODY: {"r": rb, "dx": 0, "dy": bob},
        TAIL: {"r": rb + rt, "dx": tdx, "dy": tdy + bob},
        HEAD: {"r": rb + rh, "dx": hdx, "dy": hdy + bob},
        JAWS: {"r": rb + rh + jaw, "dx": jdx + (jx - jx2), "dy": jdy + bob + (jy - jy2)},
    }
    for i, r in zip((FF, FB, FFF, FBF), fins): p[i] = {"r": r, "dx": 0, "dy": 0}
    return p

def stroke(t, amp, fin):
    w = lambda lag: math.sin(TAU * (t - lag))
    return pose(rb=amp * .35 * w(.1), rt=amp * 1.1 * w(.35), rh=-amp * .3 * w(.2), jaw=0,
                fins=(fin * w(0), fin * w(.15), fin * w(.5), fin * w(.65)), bob=round(.5 * amp / 6 * w(0), 2))

def loop(n, **k): return [stroke(i / n, **k) for i in range(n)]

def bite():
    """Hover pose; the head lifts, the jaws gape, snap shut, gape a little and snap again, then settle. Keys ease into each other."""
    keys = [(0, 0, 0), (3, -6, 6), (5, -10, 26), (6, -10, 28), (8, -6, 0), (9, -6, 14), (10, -6, 0), (14, 0, 0)]   # (frame, head turn, jaw gape)
    out = []
    for f in range(keys[-1][0] + 1):
        a, b = next((keys[i], keys[i + 1]) for i in range(len(keys) - 1) if keys[i][0] <= f <= keys[i + 1][0])
        u = (f - a[0]) / (b[0] - a[0]); u = u * u * (3 - 2 * u)
        out.append(pose(rb=0, rt=0, rh=a[1] + (b[1] - a[1]) * u, jaw=a[2] + (b[2] - a[2]) * u, fins=(6, 6, 6, 6)))
    return out

proj["clips"] = [
    {"name": "swim", "fps": 8, "frames": loop(8, amp=9, fin=14)},
    {"name": "hover", "fps": 4, "frames": loop(8, amp=3.5, fin=7)},
    {"name": "bite", "fps": 10, "frames": bite()},
]
for c in proj["clips"]:
    for f in c["frames"]:
        for v in f.values():
            for k in v: v[k] = round(v[k], 2)
json.dump(proj, open(os.path.join(here, "mosasaurus-clips.json"), "w"))

out = os.environ.get("SHEETS")
if out:
    from PIL import Image
    from rigdraw import Draw
    d = Draw(proj); os.makedirs(out, exist_ok=True)
    for c in proj["clips"]:
        fr = [d.pose(f) for f in c["frames"]]; cols = min(len(fr), 8); rows = -(-len(fr) // cols)
        sheet = Image.new("RGBA", (cols * 100, rows * 75), (40, 90, 140, 255))
        for i, im in enumerate(fr): sheet.alpha_composite(im, ((i % cols) * 100, (i // cols) * 75))
        sheet.resize((sheet.width * 2, sheet.height * 2), 0).save(os.path.join(out, c["name"] + ".png"))
