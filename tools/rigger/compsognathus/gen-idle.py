#!/usr/bin/env python3
"""Make the standing `idle` loop bolder: writes compsognathus-clips.json from compsognathus-rig.json with a breath
(body rises 1.5 px, neck and head sway, tail wave rolling out to the tip) laid over the hand-made idle's own jaw and
forearm flicks. Every other clip is left as drawn. Run from anywhere; `rigtogame.py` then takes compsognathus-clips.json."""
import json, math, os
here = os.path.dirname(os.path.abspath(__file__))
d = json.load(open(os.path.join(here, "compsognathus-rig.json")))
ids = {n["name"]: n["id"] for n in d["nodes"]}
BODY, NECK, HEAD, TB, TM, TE = (ids["COMP_" + k] for k in ("BODY", "NECK", "HEAD", "TAIL_BASE", "TAIL_MID", "TAIL_END"))
clip = next(c for c in d["clips"] if c["name"] == "idle")
N = len(clip["frames"])
for i, f in enumerate(clip["frames"]):
    t = 2 * math.pi * i / N
    breath = (1 - math.cos(t)) / 2
    f[BODY] = {**f.get(BODY, {}), "dy": round(-1.5 * breath, 2)}
    f[NECK] = {**f.get(NECK, {}), "r": round(5 * math.sin(t - .5), 2)}
    f[HEAD] = {**f.get(HEAD, {}), "r": round(13 + 4 * math.sin(t - 1.1), 2)}
    f[TB] = {**f.get(TB, {}), "r": round(12.5 + 3 * math.sin(t - .8), 2)}
    f[TM] = {**f.get(TM, {}), "r": round(5 * math.sin(t - 1.6), 2)}
    f[TE] = {**f.get(TE, {}), "r": round(7 * math.sin(t - 2.4), 2)}
json.dump(d, open(os.path.join(here, "compsognathus-clips.json"), "w"), separators=(",", ":"))
