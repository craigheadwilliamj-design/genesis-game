#!/usr/bin/env python3
"""Write anom-clips.json from anom-shaded.json (the hand-made anom-rig.json restyled by tools/pixelanom_rig_shade.py), and clips from one rippling stroke:
`swim` (the side flaps beat in a wave from front to back, the far flaps half a beat behind, the tail fan sweeping and the body
bobbing, grasping arms tucked back), `hover` (the same stroke small and slow, the arms swaying) and `grab` (the arms reach forward,
snap back under the head to the mouth, chew a moment and let go).
    python3 gen-clips.py [SHEETS=dir]   then   rigtogame.py tools/rigger/anomalocaris/anom-clips.json anom --walk swim --stand hover --idle grab
In an aquarium the walk clip is its swim stroke. With SHEETS=<dir> in the environment it also writes a contact sheet and GIF of each clip."""
import json, math, os, sys
here = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(here, ".."))
proj = json.load(open(os.path.join(here, "anom-shaded.json")))   # the parts after tools/pixelanom_rig_shade.py
BODY, HEAD, TAIL, ARM, ARMF = "n2", "n4", "n14", "n6", "n8"
FA, FB, FAF, FBF = "n12", "n10", "n15", "n17"   # near front flaps, near rear flaps, and the far ones
TAU = 2 * math.pi

def stroke(t, amp, armR, armAmp):
    """Pose at phase t (0..1) of a stroke: flap swing amp degrees, arms held at armR with armAmp of sway."""
    w = lambda lag: math.sin(TAU * (t - lag))
    return {
        FA: {"r": amp * w(0), "dx": 0, "dy": 0},
        FB: {"r": amp * w(.18), "dx": 0, "dy": 0},
        FAF: {"r": amp * w(.5), "dx": 0, "dy": 0},
        FBF: {"r": amp * w(.68), "dx": 0, "dy": 0},
        TAIL: {"r": amp * .7 * w(.35), "dx": 0, "dy": 0},
        BODY: {"r": amp * .08 * w(.25), "dx": 0, "dy": round(.8 * amp / 14 * w(.1), 2)},
        HEAD: {"r": -amp * .1 * w(.25), "dx": 0, "dy": 0},
        ARM: {"r": armR + armAmp * w(.4), "dx": 0, "dy": 0},
        ARMF: {"r": armR + armAmp * w(.6), "dx": 0, "dy": 0},
    }

def loop(n, **k): return [stroke(i / n, **k) for i in range(n)]

def grab():
    """Hover pose, arms reach forward and up, snap back under the mouth, chew, let go."""
    base = stroke(0, amp=4, armR=6, armAmp=0)
    keys = [(0, 6, 0), (3, -38, -2), (5, -42, -3), (6, 30, 2), (8, 26, 1), (9, 32, 2), (10, 26, 1), (11, 32, 2), (14, 6, 0)]   # (frame, arm turn, head nod)
    out = []
    for f in range(keys[-1][0] + 1):
        a, b = next((keys[i], keys[i + 1]) for i in range(len(keys) - 1) if keys[i][0] <= f <= keys[i + 1][0])
        u = (f - a[0]) / (b[0] - a[0]); u = u * u * (3 - 2 * u)
        arm, nod = a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u
        p = json.loads(json.dumps(base))
        p[ARM]["r"] = arm; p[ARMF]["r"] = arm + (3 if f in (5, 6) else 0)   # the far arm a hair behind at the snap
        p[HEAD]["r"] = nod
        out.append(p)
    return out

proj["clips"] = [
    {"name": "swim", "fps": 8, "frames": loop(8, amp=14, armR=14, armAmp=4)},
    {"name": "hover", "fps": 4, "frames": loop(8, amp=5, armR=6, armAmp=5)},
    {"name": "grab", "fps": 10, "frames": grab()},
]
for c in proj["clips"]:
    for f in c["frames"]:
        for v in f.values():
            v["r"] = round(v["r"], 2)
json.dump(proj, open(os.path.join(here, "anom-clips.json"), "w"))

if os.environ.get("SHEETS"):
    from PIL import Image
    from rigdraw import Draw
    d, out = Draw(proj), os.environ["SHEETS"]
    os.makedirs(out, exist_ok=True)
    for c in proj["clips"]:
        ims = [d.pose(f) for f in c["frames"]]
        sheet = Image.new("RGBA", (d.W * len(ims), d.H), (40, 60, 80, 255))
        for i, im in enumerate(ims): sheet.alpha_composite(im, (i * d.W, 0))
        sheet.resize((sheet.width * 3, sheet.height * 3), Image.NEAREST).save(os.path.join(out, f"anom-{c['name']}.png"))
        bg = [Image.alpha_composite(Image.new("RGBA", im.size, (40, 60, 80, 255)), im).resize((d.W * 4, d.H * 4), Image.NEAREST) for im in ims]
        bg[0].save(os.path.join(out, f"anom-{c['name']}.gif"), save_all=True, append_images=bg[1:], duration=1000 // c["fps"], loop=0)
