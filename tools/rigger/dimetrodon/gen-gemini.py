#!/usr/bin/env python3
"""Cuts the Dimetrodon's master picture (dime-master.png, 110 x 55, hand-finished in the park palette) into the rig's 14 parts and writes them into dimetrodon-rig.json (the hand rig that gen-walk.js reads).
    python3 -I tools/rigger/dimetrodon/gen-gemini.py
Same nodes, parents and draw order as before, so the walk, idle and rest clips keep working; only the pictures and the joints move. Each part reaches a few pixels under the one it
hangs from (legs up into the body, the head and tail pieces back into their neighbours), so a turn opens no gap. The master sits in the 110 x 75 cell with its feet on row 68.
If the project has no `rest` clip yet it is copied in from RIGS.dime in js/rigs.js. Then, in order:
    node tools/rigger/dimetrodon/gen-walk.js     (the walk, aimed at the new joints; it leaves a project marked "shaded" alone)
    python3 -I tools/rigtogame.py tools/rigger/dimetrodon/dimetrodon.json dime --walk walk --idle idle --rest rest
    python3 tools/packsprites.py"""
import base64, io, json, os, re
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, "..", "..", "..")
M = Image.open(os.path.join(HERE, "dime-master.png")).convert("RGBA"); MW, MH = M.size
CW, CH, DY = 110, 75, 69 - MH   # the cell, and how far the master is dropped so its feet land on row 68
px = lambda x, y: M.getpixel((x, y)) if 0 <= x < MW and 0 <= y < MH else (0, 0, 0, 0)
SAIL = {(140, 60, 0), (178, 78, 0), (200, 98, 14)}
solid = lambda x, y: px(x, y)[3] > 0

def mouth(x): return 33 if x <= 95 else 35 if x <= 98 else 36 if x <= 103 else 35   # the jaw is everything under the mouth line (cheek, then the smile stepping down and up at the snout)
def head(x, y): return solid(x, y) and ((x >= 88 and 22 <= y <= 43) or (80 <= x < 88 and 26 <= y <= 38 and px(x, y)[:3] not in SAIL))
def jaw(x, y): return head(x, y) and x >= 88 and y > mouth(x)

# each part: a test for its pixels, its joint (master coordinates), the part it hangs from, and a few rows or columns it borrows from its parent
LEGS = {   # name: (x0, x1, y0, y1, foot_y0, pivot, foot pivot)
    "FAR_FRONT": (82, 95, 44, 52, 50, (86, 45), (86, 50)), "FAR_BACK": (36, 44, 45, 52, 51, (41, 46), (41, 51)),
    "NEAR_FRONT": (71, 82, 47, 54, 51, (74, 48), (75, 51)), "NEAR_BACK": (45, 57, 45, 54, 52, (50, 46), (50, 52)),
}
def in_leg(n, x, y):
    x0, x1, y0, y1, fy, *_ = LEGS[n]
    if not (x0 <= x <= x1 and y0 <= y <= y1 and solid(x, y)): return False
    if n == "NEAR_BACK" and y < 50 and x > 54: return False   # the belly's edge beside it
    return True

def body(x, y):
    if not solid(x, y): return False
    return not (head(x, y) or any(in_leg(n, x, y) for n in LEGS) or (x <= 36 and y >= 32))

def tail(lo, hi): return lambda x, y: solid(x, y) and x <= 36 and y >= 32 and lo <= x < hi

def grid(test, extra=()):
    g = {(x, y): px(x, y) for y in range(MH) for x in range(MW) if test(x, y)}
    for k, v in extra: g[k] = v
    return g

HIP = {"FAR_FRONT": (85, 89), "FAR_BACK": (38, 44), "NEAR_FRONT": (72, 77), "NEAR_BACK": (46, 54)}   # the columns of a leg's top that get repeated above its joint

def borrow_up(n, rows, from_body):   # a leg's top rows repeated above its joint: the body's own pixels for a near leg, the first row's colors for a far one (they sit behind the body)
    y0 = LEGS[n][2]; x0, x1 = HIP[n]; out = []
    for dy in range(1, rows + 1):
        for x in range(x0, x1 + 1):
            if from_body:
                if body(x, y0 - dy): out.append(((x, y0 - dy), px(x, y0 - dy)))
            elif in_leg(n, x, y0): out.append(((x, y0 - dy), px(x, y0)))
    return out

def parts():
    P = []   # (name, parent name, pixels, joint)
    def leg(n, nm, from_body):
        x0, x1, y0, y1, fy, pv, fv = LEGS[n]
        P.append((f"DIME_LEG_{nm}", "DIME_BODY", grid(lambda x, y: in_leg(n, x, y) and y < fy, borrow_up(n, 3, from_body)), pv))
        P.append((f"DIME_FOOT_{nm}", f"DIME_LEG_{nm}", grid(lambda x, y: in_leg(n, x, y) and y >= fy), fv))
    leg("FAR_FRONT", "BEHIND_FRONT", False); leg("FAR_BACK", "BEHIND_BACK", False)
    P.append(("DIME_BODY", None, grid(body), (75, 40)))
    leg("NEAR_FRONT", "NEAR_FRONT", True)
    P.append(("DIME_JAW", "DIME_HEAD", grid(jaw), (89, 35)))
    P.append(("DIME_HEAD", "DIME_BODY", grid(lambda x, y: head(x, y) and not jaw(x, y), [((x, y), px(x, y)) for x in range(77, 80) for y in range(26, 39) if body(x, y) and px(x, y)[:3] not in SAIL]), (84, 34)))
    P.append(("DIME_TAIL_BASE", "DIME_BODY", grid(tail(24, 37), [((x, y), px(x, y)) for x in range(37, 40) for y in range(32, 45) if body(x, y)]), (38, 38)))
    leg("NEAR_BACK", "NEAR_BACK", True)
    P.append(("DIME_TAIL_MID", "DIME_TAIL_BASE", grid(tail(11, 24), [((x, y), px(x, y)) for x in range(24, 27) for y in range(32, 49) if tail(24, 37)(x, y)]), (24, 42)))
    P.append(("DIME_TAIL_END", "DIME_TAIL_MID", grid(tail(0, 11), [((x, y), px(x, y)) for x in range(11, 14) for y in range(32, 49) if tail(11, 24)(x, y)]), (11, 46)))
    return P

def asset(g):
    im = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    for (x, y), c in g.items(): im.putpixel((x, y + DY), c)
    b = io.BytesIO(); im.save(b, "PNG"); return "data:image/png;base64," + base64.b64encode(b.getvalue()).decode()

def main():
    path = os.path.join(HERE, "dimetrodon-rig.json"); proj = json.load(open(path)); old = {n["name"]: n for n in proj["nodes"]}
    order = [n["name"] for n in proj["nodes"]]; P = sorted(parts(), key=lambda p: order.index(p[0])); assert [p[0] for p in P] == order
    world = {p[0]: p[3] for p in P}; assets = {}; nodes = []
    seen = {}
    for name, parent, g, (jx, jy) in P:
        assert g, name + " is empty"
        o = old[name]; assets[o["asset"]] = asset(g); seen[name] = len(g)
        px_, py_ = jx, jy + DY; lx, ly = (75, 55) if parent is None else (jx - world[parent][0], jy - world[parent][1])
        nodes.append({**o, "px": px_, "py": py_, "lx": lx, "ly": ly})
    # every opaque pixel of the master is in a part
    cover = set()
    for name, parent, g, _ in P: cover |= set(g)
    miss = [(x, y) for y in range(MH) for x in range(MW) if solid(x, y) and (x, y) not in cover]
    assert not miss, f"pixels in no part: {miss[:10]}"
    proj["assets"] = assets; proj["nodes"] = nodes; proj["shaded"] = "dime-master"
    if not any(c["name"] == "rest" for c in proj["clips"]):
        src = open(os.path.join(ROOT, "js", "rigs.js")).read(); rig = json.loads(re.search(r"^RIGS\.dime = (.*);$", src, re.M).group(1))
        ids = [n["id"] for n in nodes]; frames = []
        for f in rig["clips"]["rest"]["frames"]:
            row = {}
            for k, v in f.items():
                r, dx, dy = (v, 0, 0) if not isinstance(v, list) else v; row[ids[int(k)]] = {"r": r, "dx": dx, "dy": dy}
            frames.append(row)
        proj["clips"].append({"name": "rest", "fps": rig["clips"]["rest"]["fps"], "frames": frames})
    json.dump(proj, open(path, "w"), separators=(",", ":"))
    print({k: v for k, v in seen.items()})

if __name__ == "__main__": main()
