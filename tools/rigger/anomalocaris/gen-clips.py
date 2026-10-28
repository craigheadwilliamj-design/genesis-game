#!/usr/bin/env python3
"""Write anom-clips.json from anom-rig.json (the hand-made, already shaded project; its hidden "Old Sprites" reference layer is left out) with clips
from one rippling stroke: `swim` (the belly flaps beat in a wave from front to back, the far flaps half a beat behind, the tail fan
sweeping and the body bobbing, grasping arms tucked back), `hover` (the same stroke small and slow, the arms swaying) and `grab`
(the head lifts and the arms reach forward, sweep back under the head to the mouth over two frames, chew a moment and let go).
    python3 -I gen-clips.py [SHEETS=dir]   then   rigtogame.py tools/rigger/anomalocaris/anom-clips.json anom --walk swim --stand hover --idle grab
In an aquarium the walk clip is its swim stroke. With SHEETS=<dir> in the environment it also writes a contact sheet and GIF of each clip."""
import json, math, os, sys
here = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(here, ".."))
proj = json.load(open(os.path.join(here, "anom-rig.json")))
proj["nodes"] = [n for n in proj["nodes"] if not n.get("hidden")]   # the old sprite traced over, not a part
used = {n["asset"] for n in proj["nodes"]}; proj["assets"] = {k: v for k, v in proj["assets"].items() if k in used}
BODY, HEAD, TAIL, ARM, ARMF = "n2", "n4", "n14", "n30", "n37"
FA, FB, FAF, FBF = "n12", "n10", "n47", "n49"   # near front and rear flaps, and the far ones
TAU = 2 * math.pi

def stroke(t, amp, armR, armAmp):
    """Pose at phase t (0..1) of a stroke: flap swing amp degrees, arms held at armR with armAmp of sway."""
    w = lambda lag: math.sin(TAU * (t - lag))
    return {
        FA: {"r": amp * w(0), "dx": 0, "dy": 0},
        FB: {"r": amp * w(.2), "dx": 0, "dy": 0},
        FAF: {"r": amp * w(.5), "dx": 0, "dy": 0},
        FBF: {"r": amp * w(.7), "dx": 0, "dy": 0},
        TAIL: {"r": amp * .6 * w(.35), "dx": 0, "dy": 0},
        BODY: {"r": amp * .06 * w(.25), "dx": 0, "dy": round(.6 * amp / 12 * w(.1), 2)},
        HEAD: {"r": -amp * .12 * w(.25), "dx": 0, "dy": 0},
        ARM: {"r": armR + armAmp * w(.4), "dx": 0, "dy": 0},
        ARMF: {"r": armR + armAmp * w(.55), "dx": 0, "dy": 0},
    }

def loop(n, **k): return [stroke(i / n, **k) for i in range(n)]

def grab():
    """Hover pose; the head lifts and the arms reach forward, sweep back to the mouth, chew, let go. Keys ease into each other."""
    base = stroke(0, amp=4, armR=8, armAmp=0)
    keys = [(0, 8, 0), (4, -30, -10), (6, -34, -12), (8, 24, 2), (10, 18, 1), (11, 26, 2), (12, 18, 1), (13, 26, 2), (17, 8, 0)]   # (frame, arm turn, head turn)
    out = []
    for f in range(keys[-1][0] + 1):
        a, b = next((keys[i], keys[i + 1]) for i in range(len(keys) - 1) if keys[i][0] <= f <= keys[i + 1][0])
        u = (f - a[0]) / (b[0] - a[0]); u = u * u * (3 - 2 * u)
        arm, nod = a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u
        p = json.loads(json.dumps(base))
        p[ARM]["r"] = arm; p[ARMF]["r"] = arm - (6 if 6 < f < 8 else 0)   # the far arm a hair behind on the sweep
        p[HEAD]["r"] = nod
        out.append(p)
    return out

proj["clips"] = [
    {"name": "swim", "fps": 8, "frames": loop(8, amp=10, armR=14, armAmp=4)},
    {"name": "hover", "fps": 4, "frames": loop(8, amp=5, armR=8, armAmp=4)},
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
