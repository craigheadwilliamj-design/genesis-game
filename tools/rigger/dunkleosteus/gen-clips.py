#!/usr/bin/env python3
"""Write dunkleosteus-clips.json from dunkleosteus-rig.json (the hand-made project from the pixel editor, parts shaded there: armored body
and head in one piece, jaw, tail, tail fin, near and far pectoral and anal fins, every part hanging off the body). Every clip comes from one
travelling wave (the tail a step of phase behind the body, the fin a step behind the tail, the body counter-turning a little, the fins sculling):
`swim` (the stroke), `hover` (the same wave small and slow), `snap` (the jaw drops wide and slams shut twice, the body lunging a little)
and `gulp` (a slow gape and close, the jaw working once more).
    python3 -I gen-clips.py   then   rigtogame.py tools/rigger/dunkleosteus/dunkleosteus-clips.json dunk --walk swim --stand hover --idle snap gulp
With SHEETS=<dir> in the environment it also writes a contact sheet and GIF of each clip."""
import json, math, os, sys
from PIL import Image
here = os.path.dirname(os.path.abspath(__file__))
proj = json.load(open(os.path.join(here, "dunkleosteus-rig.json")))
ids = {n["name"]: n["id"] for n in proj["nodes"]}
BODY, JAW, TAIL, FIN = ids["Body"], ids["Jaw"], ids["Tail"], ids["Tail Fin"]
PEC, PECF, ANAL, ANALF = ids["Pectoral Fin"], ids["Pectoral Fin far"], ids["Anal Fins :("], ids["Anal Fins :( far"]
LIFT = 4   # drawn on the cell's bottom row; lifted so the fins stay inside it as the body turns
for n in proj["nodes"]:
    if n["parent"] is None: n["ly"] -= LIFT
SWING = {TAIL: 9, FIN: 14, ANAL: 6, ANALF: 6}   # degrees at full stroke; the tail fin's turn adds to the tail's
LAG = {TAIL: .9, FIN: 1.8, ANAL: 1.4, ANALF: 1.6}
PADDLE = {PEC: (10, .3), PECF: (10, .3 + math.pi)}   # pectorals scull, the far one half a beat behind

def wave(N, amp, head=1.2, bob=0, beats=1, fin=1):
    out = []
    for i in range(N):
        t = 2 * math.pi * beats * i / N
        f = {k: {"r": amp * SWING[k] * math.sin(t - LAG[k])} for k in SWING}
        for k, (a, lag) in PADDLE.items(): f[k] = {"r": fin * amp * a * math.sin(t - lag)}
        f[BODY] = {"r": -head * amp * math.sin(t), "dy": bob * math.sin(2 * t)}
        out.append(f)
    return out

def keyed(keys, base):
    """Ease between key frames (frame, {part: r} with BODY's dx too) laid over a hover pose."""
    out = []
    for f in range(keys[-1][0] + 1):
        a, b = next((keys[i], keys[i + 1]) for i in range(len(keys) - 1) if keys[i][0] <= f <= keys[i + 1][0])
        u = (f - a[0]) / (b[0] - a[0]) if b[0] > a[0] else 0; u = u * u * (3 - 2 * u)
        fr = json.loads(json.dumps(base[f % len(base)]))
        for k in set(a[1]) | set(b[1]):
            for c in ("r", "dx"):
                va, vb = a[1].get(k, {}).get(c, 0), b[1].get(k, {}).get(c, 0)
                if va or vb: fr.setdefault(k, {})[c] = fr.get(k, {}).get(c, 0) + va + (vb - va) * u
        out.append(fr)
    return out

hover = wave(16, .35, head=1)
# snap: head tips up a touch as the jaw drops wide, slams shut with a small lunge, again, then settles (Dunkleosteus's famous fast bite)
O = lambda jaw, rb=0, dx=0: {JAW: {"r": jaw}, BODY: {"r": rb, "dx": dx}}
snap = keyed([(0, O(0)), (3, O(26, -3)), (4, O(28, -3)), (5, O(0, 1, 2)), (7, O(0)), (9, O(22, -2)), (10, O(0, 1, 2)), (12, O(0)), (15, O(0))], hover)
gulp = keyed([(0, O(0)), (5, O(18, -2)), (8, O(18, -2)), (11, O(4)), (13, O(10)), (15, O(0)), (17, O(0))], hover)
proj["clips"] = [{"name": "swim", "fps": 10, "frames": wave(12, 1, bob=.4)},
                 {"name": "hover", "fps": 8, "frames": hover},
                 {"name": "snap", "fps": 14, "frames": snap},
                 {"name": "gulp", "fps": 8, "frames": gulp}]
for c in proj["clips"]:
    for f in c["frames"]:
        for v in f.values():
            for k in v: v[k] = round(v[k], 2)
json.dump(proj, open(os.path.join(here, "dunkleosteus-clips.json"), "w"), separators=(",", ":"))
out = os.environ.get("SHEETS")
if out:
    sys.path.insert(0, os.path.join(here, ".."))
    from rigdraw import Draw
    d = Draw(proj); os.makedirs(out, exist_ok=True); Z = 4; W = proj["cell"]["w"]
    for c in proj["clips"]:
        fr = [d.pose(f).crop((0, 35, W, 75)) for f in c["frames"]]
        sheet = Image.new("RGBA", (fr[0].width * 4, fr[0].height * math.ceil(len(fr) / 4)), (40, 90, 120, 255))
        for i, im in enumerate(fr): sheet.alpha_composite(im, ((i % 4) * im.width, (i // 4) * im.height))
        sheet.resize((sheet.width * Z, sheet.height * Z), Image.NEAREST).save(os.path.join(out, c["name"] + ".png"))
        bg = [Image.alpha_composite(Image.new("RGBA", im.size, (40, 90, 120, 255)), im).resize((im.width * Z, im.height * Z), Image.NEAREST) for im in fr]
        bg[0].save(os.path.join(out, c["name"] + ".gif"), save_all=True, append_images=bg[1:], duration=int(1000 / c["fps"]), loop=0)
