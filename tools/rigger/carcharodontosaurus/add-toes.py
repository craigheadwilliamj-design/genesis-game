# Adds toes to the Carcharodontosaurus's flat foot parts in carcharodontosaurus-rig.json: along the foot's bottom row (x 46 to 52) every other pixel from x 48 is a pale toe,
# so the heel is slate and the three toes alternate pale, slate, pale, slate, pale. The foot keeps its shape, so the ground contact is unchanged. Safe to run again.
#   python3 -I tools/rigger/carcharodontosaurus/add-toes.py [RIG.json]
import sys, os, io, json, base64
from PIL import Image
path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "carcharodontosaurus-rig.json")
proj = json.load(open(path))
PALE = {"CARC_NEAR_FOOT": (219, 219, 213), "CARC_FAR_FOOT": (150, 150, 150)}
for n in proj["nodes"]:
    if n["name"] not in PALE: continue
    im = Image.open(io.BytesIO(base64.b64decode(proj["assets"][n["asset"]].split(",", 1)[1]))).convert("RGBA")
    for x in (48, 50, 52): assert im.getpixel((x, 37))[3], (n["name"], x)
    for x in (48, 50, 52): im.putpixel((x, 37), PALE[n["name"]] + (255,))
    buf = io.BytesIO(); im.save(buf, "PNG"); proj["assets"][n["asset"]] = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
    print(n["name"], "toes added")
json.dump(proj, open(path, "w"), separators=(",", ":"))
