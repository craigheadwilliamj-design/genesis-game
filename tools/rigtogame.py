#!/usr/bin/env python3
"""Turn a rigger project (the Save project JSON from tools/rigger) into game files.

    python3 tools/rigtogame.py PROJECT.json plat --walk walk --idle plat_idle [idle2 ...] --rest resting --rest-end 14 [--swim swim --waterline 40]

writes `sprites/<id>/<part>.png`, one picture per part cropped to its pixels, and replaces the line
`RIGS.<id> = ...;` in js/rigs.js with the parts (draw order, parent, joint, picture box) and the poses of the
walk, idle and rest clips. Then give the species `rig:1` in SPRITES (data.js). It can be run again; it overwrites.

Poses are sparse: a frame lists only the parts that are turned or shifted, as `index: r` or `index: [r, dx, dy]`
(degrees, and pixels in the parent's frame), the same numbers as the rigger. A part not listed is at rest.
A part marked "Hidden unless a frame shows it" in the rigger gets `off:1`, and a frame that shows or hides a part
other than its default writes `index: [r, dx, dy, v]` (v 1 shown, 0 hidden); visibility switches at frames, never tweens.
"""
import argparse, base64, io, json, os, re, sys
from PIL import Image

def slug(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "part"

def num(v):
    v = round(v, 1)
    return int(v) if v == int(v) else v

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("project"); ap.add_argument("id")
    ap.add_argument("--walk", help="name of the walk clip (a loop; one cycle of the stride)")
    ap.add_argument("--idle", nargs="+", help="name of the idle clip (played once now and then at its fps while the animal stands); give several names and they take turns at random (idle, idle2, ...)")
    ap.add_argument("--rest", help="name of the rest clip (played once when the animal settles to rest, then its last frame is held)")
    ap.add_argument("--swim", help="name of the swim clip (a loop played while the animal is in water: everything under the waterline is clipped away and ghosted, with ripples on it)")
    ap.add_argument("--waterline", type=int, default=40, help="the cell row of the waterline for the swim clip (rows above show, rows below are under water)")
    ap.add_argument("--rest-end", type=int, help="index of the last frame to play of the rest clip (default: all); later frames, like getting up, are left out")
    ap.add_argument("--root", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."), help="the repo root")
    a = ap.parse_args()
    proj = json.load(open(a.project))
    nodes = proj["nodes"]
    index = {n["id"]: i for i, n in enumerate(nodes)}
    outdir = os.path.join(a.root, "sprites", a.id)
    os.makedirs(outdir, exist_ok=True)
    used, parts = set(), []
    for n in nodes:
        data = proj["assets"][n["asset"]].split(",", 1)[1]
        im = Image.open(io.BytesIO(base64.b64decode(data))).convert("RGBA")
        box = im.getchannel("A").point(lambda v: 255 if v >= 128 else 0).getbbox() or (0, 0, 1, 1)
        name = slug(n["name"]); k = 2
        while name in used: name = f"{slug(n['name'])}-{k}"; k += 1
        used.add(name)
        im.crop(box).save(os.path.join(outdir, name + ".png"), optimize=True)
        # the part's picture, as a box in its own frame (its joint is the origin)
        parts.append({"n": n["name"], "img": f"sprites/{a.id}/{name}.png", "ix": box[0] - n["px"], "iy": box[1] - n["py"],
                      "iw": box[2] - box[0], "ih": box[3] - box[1],
                      "p": index[n["parent"]] if n.get("parent") else -1, "x": n["lx"], "y": n["ly"], "f": 1 if n.get("flip") else 0})
        if n.get("off"): parts[-1]["off"] = 1
    def frames(clip_name):
        clip = next((c for c in proj["clips"] if c["name"] == clip_name), None)
        if not clip: sys.exit(f"no clip named {clip_name}; the project has {[c['name'] for c in proj['clips']]}")
        out = []
        for f in clip["frames"]:
            row = {}
            for nid, p in f.items():
                if nid not in index: continue
                r, dx, dy, v = p.get("r", 0), p.get("dx", 0), p.get("dy", 0), p.get("v")
                off = bool(nodes[index[nid]].get("off"))
                if v is not None and bool(v) == (not off): v = None   # same as the part's default
                if v is not None: row[str(index[nid])] = [num(r), num(dx), num(dy), 1 if v else 0]; continue
                if not (r or dx or dy): continue
                row[str(index[nid])] = num(r) if not (dx or dy) else [num(r), num(dx), num(dy)]
            out.append(row)
        return clip["fps"], out
    clips = {}
    if a.walk: clips["walk"] = {"frames": frames(a.walk)[1]}
    for i, name in enumerate(a.idle or []): fps, fr = frames(name); clips["idle" + (str(i + 1) if i else "")] = {"fps": fps, "frames": fr}
    if a.rest:
        fps, fr = frames(a.rest)
        clips["rest"] = {"fps": fps, "frames": fr[:a.rest_end + 1] if a.rest_end is not None else fr}
    if a.swim: fps, fr = frames(a.swim); clips["swim"] = {"fps": fps, "wl": a.waterline, "frames": fr}
    rig = {"w": proj["cell"]["w"], "h": proj["cell"]["h"], "parts": parts, "clips": clips}
    line = f"RIGS.{a.id} = " + json.dumps(rig, separators=(",", ":")) + ";"
    path = os.path.join(a.root, "js", "rigs.js")
    src = open(path).read()
    pat = re.compile(r"^RIGS\." + re.escape(a.id) + r" = .*;$", re.M)
    if pat.search(src): src = pat.sub(lambda m: line, src)
    else:
        mark = "// rigs: one line a species, written by tools/rigtogame.py\n"
        if mark not in src: sys.exit("js/rigs.js has no marker line for the species data")
        src = src.replace(mark, mark + line + "\n", 1)
    open(path, "w").write(src)
    print(f"{a.id}: {len(parts)} parts in sprites/{a.id}/, walk {len(clips.get('walk', {}).get('frames', []))} frames, idle {'+'.join(str(len(c['frames'])) for k, c in clips.items() if k.startswith('idle')) or 0} frames, rest {len(clips.get('rest', {}).get('frames', []))} frames, swim {len(clips.get('swim', {}).get('frames', []))} frames, js/rigs.js updated")

if __name__ == "__main__":
    main()
