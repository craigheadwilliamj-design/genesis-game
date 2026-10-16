# Adds the flat-style shading, texture and detail to the Scutosaurus's rig (the part pictures inside a rigger project JSON, tools/rigger/scutosaurus/), keeping its colors, shape and markings.
# Every pixel keeps its own color family: nothing is recolored, a pixel is only made a step lighter or darker than it already is, so the charcoal hide, rust back plates, olive spikes, tan belly and pale jaw stay where they were painted.
# On top it adds what the other rigs have: a lit top and left edge (light comes from the top left), shade where the flank turns under and on the right side, a lit left edge on each rust plate with a shaded foot,
# a small shadow under and beside every bright osteoderm bump (so they stand up off the plate), rows of short scale dashes on the flank and the thighs, ventral bands on the tan belly, and a shaded jaw and horn.
# Parts turn with the animal, so every part is shaded in its own frame. Far limbs, the eye, the dark markings and the existing grey bumps stay as painted, and edges that sit on a joint (the tail's root, the head's and body's ends) are left alone, so no seam shows when a part turns.
# It refuses a project it already shaded. Usage: python3 -I tools/pixelscut_rig_shade.py IN.json OUT.json   (IN is tools/rigger/scutosaurus/scutosaurus-rig.json, the flat parts)
import sys, io, json, base64
from PIL import Image

LIT, SHADOW, DASH, BAND = 1.22, .78, 1.3, .92   # the dashes are a step lighter than the hide: on near-black a darker one would not show
ROLES = {(46, 45, 44): "hide", (119, 50, 31): "rust", (155, 65, 40): "dot", (143, 125, 82): "tan", (190, 188, 183): "pale", (148, 140, 135): "pale"}   # anything else (dark markings, rust edges, spikes, bumps, eye) stays as painted

def role(px):
    if px[3] < 128: return None
    return ROLES.get(px[:3], "keep")

def tone(c, k):
    # a step lighter (k > 1) or darker (k < 1) of the same color, hue kept; light steps also lift the darkest colors a little so they show
    r, g, b = c
    if k > 1: return tuple(min(255, int(v * k + 6)) for v in (r, g, b))
    return tuple(int(v * k) for v in (r, g, b))

def shade_part(grid, cols, name):
    h, w = len(grid), len(grid[0]); g = lambda x, y: grid[y][x] if 0 <= x < w and 0 <= y < h else None
    out = [row[:] for row in cols]
    if "FAR_" in name: return out                                        # far limbs stay as painted, dark behind the body
    limb = any(k in name for k in ("THIGH", "LEG", "FOOT"))
    head, jaw, tail, body = name.endswith("HEAD"), name.endswith("JAW"), name.endswith("TAIL"), name.endswith("BODY")
    xs = [x for y in range(h) for x in range(w) if grid[y][x] is not None]; x0, x1 = min(xs), max(xs)
    for y in range(h):
        for x in range(w):
            c = grid[y][x]
            if c is None or c == "keep": continue
            up, dn, lf, rt = g(x, y - 1), g(x, y + 1), g(x - 1, y), g(x + 1, y); k = None
            joint = (tail and x >= x1 - 1) or (head and x <= x0 + 1) or (jaw and (x <= x0 + 1 or y <= 0)) or (body and (x <= x0 + 1 or x >= x1 - 1))
            bump = any(g(x - dx, y - dy) == "dot" for dx, dy in ((1, 0), (0, 1), (1, 1)))   # just under or beside an osteoderm bump
            if c == "tan":
                if dn is None: k = .84                                    # the belly's lower edge turns under
                elif x % 3 == 1 and dn == "tan": k = BAND                 # ventral bands
                elif up not in ("tan", None) and up != "keep": k = 1.08   # where the belly meets the flank, lit
            elif c == "pale":
                if jaw or head:
                    if dn is None or rt is None: k = .86                   # the jaw patch and horn: shaded underside and right
                    elif up is None or lf is None: k = 1.05
            elif joint: k = None
            elif c == "rust":
                if bump: k = .82                                          # a shadow under and beside each bump
                elif lf not in ("rust", "dot") and lf is not None and rt == "rust": k = 1.14   # each plate lit on its left edge
                elif dn in ("hide", "keep", None) and up in ("rust", "dot"): k = .84   # and a step darker at its foot
            elif c == "dot": k = 1.1                                      # the bumps themselves catch the light
            else:                                                         # the charcoal hide
                if limb:
                    if lf is None or up is None: k = LIT                  # a lit left and top edge
                    elif rt is None or dn is None: k = SHADOW             # a shaded right and lower edge
                    elif "THIGH" in name and y % 3 == 1 and (x + y // 3) % 4 < 2: k = DASH   # rows of short scale dashes
                elif head:
                    if up is None: k = LIT
                    elif dn is None or dn == "pale": k = SHADOW
                    elif rt is None: k = SHADOW + .06
                elif jaw:
                    if up is None: k = 1.14
                    elif dn is None: k = SHADOW
                elif up is None: k = LIT                                   # a lit back, snout or tail top
                elif lf is None and not tail: k = 1.14
                elif dn is None or dn == "tan": k = SHADOW + .04          # shade where the flank turns under
                elif g(x, y + 2) in (None, "tan"): k = .9                 # and a softer row above it
                elif rt is None: k = SHADOW + .08
                elif y % 3 == 1 and (x + 2 * (y // 3)) % 4 < 2 and up not in ("rust", "dot") and dn not in ("rust", "dot"): k = DASH   # short scale dashes on the flank, clear of the plates
            if k: out[y][x] = tone(cols[y][x], k)
    return out

def main():
    src, dst = sys.argv[1], sys.argv[2]
    proj = json.load(open(src))
    if proj.get("shaded") == "pixelscut_rig_shade": sys.exit("already shaded: run it on tools/rigger/scutosaurus/scutosaurus-rig.json")
    names = {n["asset"]: n["name"] for n in proj["nodes"]}
    for aid, data in proj["assets"].items():
        if aid not in names: continue
        im = Image.open(io.BytesIO(base64.b64decode(data.split(",", 1)[1]))).convert("RGBA"); px = im.load()
        box = im.getchannel("A").point(lambda v: 255 if v >= 128 else 0).getbbox()
        if not box: continue
        X0, Y0, X1, Y1 = box
        grid = [[role(px[X0 + x, Y0 + y]) for x in range(X1 - X0)] for y in range(Y1 - Y0)]
        cols = [[px[X0 + x, Y0 + y][:3] for x in range(X1 - X0)] for y in range(Y1 - Y0)]
        res = shade_part(grid, cols, names[aid])
        for y in range(Y1 - Y0):
            for x in range(X1 - X0):
                if grid[y][x] is not None: px[X0 + x, Y0 + y] = tuple(res[y][x]) + (px[X0 + x, Y0 + y][3],)
        buf = io.BytesIO(); im.save(buf, "PNG"); proj["assets"][aid] = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
    proj["shaded"] = "pixelscut_rig_shade"
    json.dump(proj, open(dst, "w"), separators=(",", ":"))
    print("shaded", len(names), "parts ->", dst)

if __name__ == "__main__": main()
