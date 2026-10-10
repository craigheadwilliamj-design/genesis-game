# Adds the flat-style shading and texture back to the Dimetrodon's rig (the part pictures inside a rigger project JSON, tools/rigger/dimetrodon/dimetrodon.json).
# The rig's parts are flat base colors, so the animal lost what tools/pixeldime_shade.py gives the strips: this runs that script's rules (lit back and head, scale rows,
# belly scutes, sail rim and grooves) over each part in its own frame, since parts turn with the animal. Limbs (legs) skip the lit-top rule because their tops sit under the body:
# they get a lit left edge and a shaded right edge instead, the far (dark) ones and the feet stay flat. Every pixel keeps its place and hue. The rim ribs turn into a lit color that can't be read back
# to a rib, so a shaded project is marked ("shaded") and this refuses to run on it again: shade a fresh flat one (gen-walk.js makes it and runs this itself).
# Order: node tools/rigger/dimetrodon/gen-walk.js (it shades), then rigtogame.py:
#     python3 tools/pixeldime_rig_shade.py [PROJECT.json]
#     python3 tools/rigtogame.py tools/rigger/dimetrodon/dimetrodon.json dime --walk walk --idle idle
import sys, os, io, json, base64
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from pixeldime_shade import shade, BASE, SHADE, ROOT

def limb(grid):
    h, w = len(grid), len(grid[0]); g = lambda x, y: grid[y][x] if 0 <= x < w and 0 <= y < h else None
    out = [row[:] for row in grid]
    for y in range(h):
        for x in range(w):
            if grid[y][x] != "body": continue
            if g(x - 1, y) is None and y % 2 == 0: out[y][x] = "bodyhi"        # the left edge catches the light, every other row
            elif g(x + 1, y) is None and y % 2 == 1: out[y][x] = "bodylo"      # the right edge is in shade
    return out

def main(path):
    proj = json.load(open(path))
    if proj.get("shaded"): sys.exit(f"{path} is already shaded; make a flat one again with gen-walk.js")
    allc = {**BASE, **SHADE}; rev = {v: k for k, v in allc.items()}
    for n in proj["nodes"]:
        nm = n["name"]; a = n["asset"]
        if "FOOT" in nm or "BEHIND" in nm: continue   # feet are a few pixels and the far limbs are the dark ones: left flat
        im = Image.open(io.BytesIO(base64.b64decode(proj["assets"][a].split(",", 1)[1]))).convert("RGBA"); px = im.load()
        grid = [[None] * im.width for _ in range(im.height)]
        for y in range(im.height):
            for x in range(im.width):
                r, g_, b, al = px[x, y]
                if al: k = rev.get((r, g_, b)); assert k, (nm, x, y, (r, g_, b)); grid[y][x] = ROOT.get(k, k)   # read any earlier shading back to its base
        res = limb(grid) if "LEG" in nm else shade(grid)[0]
        out = Image.new("RGBA", im.size, (0, 0, 0, 0)); chg = tot = 0
        for y in range(im.height):
            for x in range(im.width):
                if res[y][x]:
                    out.putpixel((x, y), allc[res[y][x]] + (255,)); tot += 1; chg += res[y][x] != grid[y][x]
        for y in range(im.height):
            for x in range(im.width): assert out.getpixel((x, y))[3] == im.getpixel((x, y))[3], "the shape changed"
        buf = io.BytesIO(); out.save(buf, "PNG"); proj["assets"][a] = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
        print(f"{nm}: {tot} pixels, {chg} shaded")
    proj["shaded"] = "pixeldime_rig_shade"
    json.dump(proj, open(path, "w"), separators=(",", ":"))

main(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "rigger", "dimetrodon", "dimetrodon.json"))
