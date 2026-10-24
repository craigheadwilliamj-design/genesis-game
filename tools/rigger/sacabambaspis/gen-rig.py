#!/usr/bin/env python3
"""Build sacabambaspis-rig.json from sprites/saca.png: the picture cut into a chain (armored body, two tail segments, tail fin), each rear
piece reaching a few pixels under the one in front so a bend never opens a gap, and its clips, all from one travelling wave:
`swim` (the stroke, a tail beat rolling back with growing swing and a small counter-turn of the head), `hover` (the same wave small
and slow) and `flick` (a quick double beat now and then while hovering). The armor is one rigid piece, like the real fish.
    python3 gen-rig.py [SHEETS=dir]   then   rigtogame.py tools/rigger/sacabambaspis/sacabambaspis-rig.json saca --walk swim --stand hover --idle flick
In an aquarium the walk clip is its swim stroke. With SHEETS=<dir> in the environment it also writes a contact sheet and GIF of each clip."""
import base64, io, json, math, os, sys
from PIL import Image
here = os.path.dirname(os.path.abspath(__file__))
root = os.path.join(here, "..", "..", "..")
src = Image.open(os.path.join(root, "sprites", "saca.png")).convert("RGBA")
W, H = src.size
# cut columns, rear to front: fin | tail 2 | tail 1 | body, each joint on the body's midline at the cut
CUTS = [17, 33, 50]
LAP = 3   # how far a rear piece reaches under the piece in front
def mid(x):   # the middle of the body (not the fin lobes) in column x
    ys = [y for y in range(H) if src.getpixel((x, y))[3] >= 128 and src.getpixel((x, y))[:3] != (106, 94, 38)]
    return round((min(ys) + max(ys)) / 2) if ys else 41
def piece(x0, x1):
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    im.paste(src.crop((x0, 0, x1, H)), (x0, 0))
    buf = io.BytesIO(); im.save(buf, "PNG"); return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
J = [(x, mid(x)) for x in CUTS]
body = (74, mid(74))
spec = [   # draw order: rear first, so each joint is hidden under the piece in front
    ("n1", "SACA_FIN",   piece(0, CUTS[0] + LAP),       J[0], "n2"),
    ("n2", "SACA_TAIL2", piece(CUTS[0], CUTS[1] + LAP), J[1], "n3"),
    ("n3", "SACA_TAIL1", piece(CUTS[1], CUTS[2] + LAP), J[2], "n4"),
    ("n4", "SACA_BODY",  piece(CUTS[2], W),             body, None),
]
at = {nid: j for nid, _, _, j, _ in spec}
nodes, assets = [], {}
for nid, name, img, (px, py), par in spec:
    a = "a" + nid[1:]; assets[a] = img
    lx, ly = (px - at[par][0], py - at[par][1]) if par else (px, py)
    nodes.append({"id": nid, "name": name, "asset": a, "px": px, "py": py, "parent": par, "lx": lx, "ly": ly, "flip": False, "hidden": False})
# the wave: each link turns by its own swing, a step of phase behind the one in front (turns add up down the chain)
SWING = {"n3": 5, "n2": 7, "n1": 11}
LAG = {"n3": .8, "n2": 1.6, "n1": 2.4}
def wave(N, amp, head=1.5, bob=0, beats=1):
    out = []
    for i in range(N):
        t = 2 * math.pi * beats * i / N
        f = {k: {"r": round(amp * SWING[k] * math.sin(t - LAG[k]), 2)} for k in SWING}
        f["n4"] = {"r": round(-head * amp * math.sin(t), 2), "dy": round(bob * math.sin(2 * t), 2)}
        out.append(f)
    return out
flick = wave(10, 1.6, head=2, beats=2)
for i, f in enumerate(flick):   # fades in and out so it starts and ends on the hover pose
    e = math.sin(math.pi * i / len(flick))
    for p in f.values(): p["r"] = round(p["r"] * e, 2)
clips = [{"name": "swim", "fps": 12, "frames": wave(12, 1, bob=.4)},
         {"name": "hover", "fps": 8, "frames": wave(16, .35, head=1)},
         {"name": "flick", "fps": 14, "frames": flick}]
proj = {"name": "saca", "cell": {"w": W, "h": H}, "ground": 56, "seq": 10, "assets": assets, "nodes": nodes, "ref": None, "clips": clips}
json.dump(proj, open(os.path.join(here, "sacabambaspis-rig.json"), "w"), separators=(",", ":"))
print("joints", J, "body", body)
out = os.environ.get("SHEETS")
if out:
    sys.path.insert(0, os.path.join(here, ".."))
    from rigdraw import Draw
    d = Draw(proj); os.makedirs(out, exist_ok=True); Z = 4
    for c in clips:
        fr = [d.pose(f).crop((0, 22, W, 62)) for f in c["frames"]]
        sheet = Image.new("RGBA", (fr[0].width * 4, fr[0].height * math.ceil(len(fr) / 4)), (40, 90, 120, 255))
        for i, im in enumerate(fr): sheet.alpha_composite(im, ((i % 4) * im.width, (i // 4) * im.height))
        sheet.resize((sheet.width * Z, sheet.height * Z), Image.NEAREST).save(os.path.join(out, c["name"] + ".png"))
        bg = [Image.alpha_composite(Image.new("RGBA", im.size, (40, 90, 120, 255)), im).resize((im.width * Z, im.height * Z), Image.NEAREST) for im in fr]
        bg[0].save(os.path.join(out, c["name"] + ".gif"), save_all=True, append_images=bg[1:], duration=int(1000 / c["fps"]), loop=0)
