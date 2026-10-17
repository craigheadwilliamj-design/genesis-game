#!/usr/bin/env python3
"""Make the game's Platyhystrix rig from platyhystrix-rig.json (gen-strips.js bakes the strips a vivarium used to draw from the same clips): its `idle` is the
7-frame basic loop (`stand`, 125 ms a frame like the strip) followed by 6 frames of jaw gape (`jaw gape`), and `dynamic idle` is the leg shuffle (both 110 ms a frame).
Writes platyhystrix-clips.json; then
    python3 tools/rigtogame.py tools/rigger/platyhystrix/platyhystrix-clips.json plhy --stand stand --idle "jaw gape" "dynamic idle" """
import json, os
here = os.path.dirname(os.path.abspath(__file__))
proj = json.load(open(os.path.join(here, "platyhystrix-rig.json")))
idle = next(c for c in proj["clips"] if c["name"] == "idle")["frames"]; dyn = next(c for c in proj["clips"] if c["name"] == "dynamic idle")["frames"]
assert len(idle) == 13 and len(dyn) == 19
proj["clips"] = [{"name": "stand", "fps": 8, "frames": idle[:7]}, {"name": "jaw gape", "fps": 1000 / 110, "frames": idle[7:]}, {"name": "dynamic idle", "fps": 1000 / 110, "frames": dyn}]
json.dump(proj, open(os.path.join(here, "platyhystrix-clips.json"), "w"), separators=(",", ":"))
