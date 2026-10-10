#!/usr/bin/env python3
"""Turn a rigger project (the Save project JSON from tools/rigger) into game files.

    python3 tools/rigtogame.py PROJECT.json plat --walk walk --idle plat_idle

writes `sprites/<id>/<part>.png`, one picture per part cropped to its pixels, and replaces the line
`RIGS.<id> = ...;` in js/rigs.js with the parts (draw order, parent, joint, picture box) and the poses of the
walk and idle clips. Then give the species `rig:1` in SPRITES (data.js). It can be run again; it overwrites.

Poses are sparse: a frame lists only the parts that are turned or shifted, as `index: r` or `index: [r, dx, dy]`
(degrees, and pixels in the parent's frame), the same numbers as the rigger. A part not listed is at rest.
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
    ap.add_argument("--idle", help="name of the idle clip (a loop played at its fps while the animal stands)")
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
    def frames(clip_name):
        clip = next((c for c in proj["clips"] if c["name"] == clip_name), None)
        if not clip: sys.exit(f"no clip named {clip_name}; the project has {[c['name'] for c in proj['clips']]}")
        out = []
        for f in clip["frames"]:
            row = {}
            for nid, p in f.items():
                if nid not in index: continue
                r, dx, dy = p.get("r", 0), p.get("dx", 0), p.get("dy", 0)
                if not (r or dx or dy): continue
                row[str(index[nid])] = num(r) if not (dx or dy) else [num(r), num(dx), num(dy)]
            out.append(row)
        return clip["fps"], out
    clips = {}
    if a.walk: clips["walk"] = {"frames": frames(a.walk)[1]}
    if a.idle: fps, fr = frames(a.idle); clips["idle"] = {"fps": fps, "frames": fr}
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
    print(f"{a.id}: {len(parts)} parts in sprites/{a.id}/, walk {len(clips.get('walk', {}).get('frames', []))} frames, idle {len(clips.get('idle', {}).get('frames', []))} frames, js/rigs.js updated")

if __name__ == "__main__":
    main()
