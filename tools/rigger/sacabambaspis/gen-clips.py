#!/usr/bin/env python3
"""Write sacabambaspis-clips.json from sacabambaspis-rig.json (the hand-made project from the pixel editor, parts shaded there:
body and head in one armored piece, tail, tail fin, anal fin). Every clip comes from one travelling wave (the tail a step of phase
behind the body, the fin a step behind the tail, the body counter-turning a little, the anal fin trailing):
`swim` (the stroke), `hover` (the same wave small and slow) and `flick` (a quick double beat now and then while hovering).
The fish is drawn on the cell's bottom rows, so the body is lifted `LIFT` px to sit mid-cell where the game expects a swimmer.
    python3 -I gen-clips.py   then   rigtogame.py tools/rigger/sacabambaspis/sacabambaspis-clips.json saca --walk swim --stand hover --idle flick
With SHEETS=<dir> in the environment it also writes a contact sheet and GIF of each clip."""
import json, math, os, sys
from PIL import Image
here = os.path.dirname(os.path.abspath(__file__))
proj = json.load(open(os.path.join(here, "sacabambaspis-rig.json")))
ids = {n["name"]: n["id"] for n in proj["nodes"]}
BODY, TAIL, FIN, ANAL = ids["Body+Head"], ids["Tail"], ids["Tail Fins"], ids["Anal Fin :["]
LIFT = 22
for n in proj["nodes"]:
    if n["parent"] is None: n["ly"] -= LIFT
SWING = {TAIL: 8, FIN: 12, ANAL: 10}   # degrees at full stroke; the turns add up down the chain
LAG = {TAIL: .9, FIN: 1.8, ANAL: 1.3}
def wave(N, amp, head=1.5, bob=0, beats=1):
    out = []
    for i in range(N):
        t = 2 * math.pi * beats * i / N
        f = {k: {"r": round(amp * SWING[k] * math.sin(t - LAG[k]), 2)} for k in SWING}
        f[BODY] = {"r": round(-head * amp * math.sin(t), 2), "dy": round(bob * math.sin(2 * t), 2)}
        out.append(f)
    return out
flick = wave(10, 1.6, head=2, beats=2)
for i, f in enumerate(flick):   # fades in and out so it starts and ends on the hover pose
    e = math.sin(math.pi * i / len(flick))
    for p in f.values(): p["r"] = round(p["r"] * e, 2)
proj["clips"] = [{"name": "swim", "fps": 12, "frames": wave(12, 1, bob=.4)},
                 {"name": "hover", "fps": 8, "frames": wave(16, .35, head=1)},
                 {"name": "flick", "fps": 14, "frames": flick}]
json.dump(proj, open(os.path.join(here, "sacabambaspis-clips.json"), "w"), separators=(",", ":"))
out = os.environ.get("SHEETS")
if out:
    sys.path.insert(0, os.path.join(here, ".."))
    from rigdraw import Draw
    d = Draw(proj); os.makedirs(out, exist_ok=True); Z = 4; W = proj["cell"]["w"]
    for c in proj["clips"]:
        fr = [d.pose(f).crop((0, 22, W, 62)) for f in c["frames"]]
        sheet = Image.new("RGBA", (fr[0].width * 4, fr[0].height * math.ceil(len(fr) / 4)), (40, 90, 120, 255))
        for i, im in enumerate(fr): sheet.alpha_composite(im, ((i % 4) * im.width, (i // 4) * im.height))
        sheet.resize((sheet.width * Z, sheet.height * Z), Image.NEAREST).save(os.path.join(out, c["name"] + ".png"))
        bg = [Image.alpha_composite(Image.new("RGBA", im.size, (40, 90, 120, 255)), im).resize((im.width * Z, im.height * Z), Image.NEAREST) for im in fr]
        bg[0].save(os.path.join(out, c["name"] + ".gif"), save_all=True, append_images=bg[1:], duration=int(1000 / c["fps"]), loop=0)
