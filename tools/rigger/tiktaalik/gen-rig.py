#!/usr/bin/env python3
"""Make the game's Tiktaalik rig from tiktaalik.json (written by gen-idles.js, which also writes the strips a vivarium used to draw): the 20-frame `idle`
is cut into the 4-frame slow loop (`stand`, 600 ms a frame like the strip) and the two small movements (`look around`, `push-up`, 130 ms a frame), and the
parts are moved so the rest pose sits where the strips put it (x 2, belly on row 43). Writes tiktaalik-clips.json; then
    python3 tools/rigtogame.py tools/rigger/tiktaalik/tiktaalik-clips.json tikt --stand stand --idle "look around" "push-up"
Needs Pillow."""
import json, os, sys
here = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(here, ".."))
from rigdraw import Draw
proj = json.load(open(os.path.join(here, "tiktaalik.json")))
box = Draw(proj).pose({}).getchannel("A").point(lambda v: 255 if v > 127 else 0).getbbox()
ox, oy = 2 - box[0], 43 - (box[3] - 1)
for n in proj["nodes"]:
    if not n.get("parent"): n["lx"] += ox; n["ly"] += oy
fr = next(c for c in proj["clips"] if c["name"] == "idle")["frames"]; assert len(fr) == 20
proj["clips"] = [{"name": "stand", "fps": 1000 / 600, "frames": fr[:4]}, {"name": "look around", "fps": 1000 / 130, "frames": fr[4:12]}, {"name": "push-up", "fps": 1000 / 130, "frames": fr[12:20]}]
json.dump(proj, open(os.path.join(here, "tiktaalik-clips.json"), "w"), separators=(",", ":"))
print("moved the root parts by", ox, oy)
