# Adds toes to the Carcharodontosaurus's flat foot parts in carcharodontosaurus-rig.json (they were a bare two-row block): a split between two forward toes
# with a claw on each tip, and a small spur at the heel. The foot keeps its height, so the ground contact is unchanged. Safe to run again (it sets pixels).
#   python3 -I tools/rigger/carcharodontosaurus/add-toes.py [RIG.json]
import sys, os, io, json, base64
from PIL import Image
path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "carcharodontosaurus-rig.json")
proj = json.load(open(path))
LOOK = {"CARC_NEAR_FOOT": ((97, 107, 118), (219, 219, 213)), "CARC_FAR_FOOT": ((62, 68, 77), (150, 150, 150))}   # toe color, claw color
TOES = [(51, 36), (52, 36), (53, 37), (45, 37)]                 # second toe, its tip, the long toe's tip, the heel spur
CLAWS = [(53, 36), (54, 37)]
for n in proj["nodes"]:
    if n["name"] not in LOOK: continue
    body, claw = LOOK[n["name"]]
    im = Image.open(io.BytesIO(base64.b64decode(proj["assets"][n["asset"]].split(",", 1)[1]))).convert("RGBA")
    for x, y in TOES: im.putpixel((x, y), body + (255,))
    for x, y in CLAWS: im.putpixel((x, y), claw + (255,))
    buf = io.BytesIO(); im.save(buf, "PNG"); proj["assets"][n["asset"]] = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
    print(n["name"], "toes added")
json.dump(proj, open(path, "w"), separators=(",", ":"))
