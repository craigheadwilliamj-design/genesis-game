#!/usr/bin/env python3
"""Render the Compsognathus's clips into the strips a vivarium draws (it can't use the rig):
sprites/comp.png (the standing picture, idle frame 0) and sprites/comp-idle.png (frames side by side: the 10-frame
standing loop, then the three dynamic idles, the 12 fps one thinned to the strip's one speed). Prints the SPRITES numbers.
Reads compsognathus-clips.json (gen-idle.py writes it). Needs Pillow. Whole pixels only: nearest-neighbor turns."""
import json, os, sys
from PIL import Image
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from rigdraw import Draw
here = os.path.dirname(os.path.abspath(__file__)); spr = os.path.join(here, "..", "..", "..", "sprites")
proj = json.load(open(os.path.join(here, "compsognathus-clips.json")))
W, H = proj["cell"]["w"], proj["cell"]["h"]; D = Draw(proj); draw = D.pose
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
