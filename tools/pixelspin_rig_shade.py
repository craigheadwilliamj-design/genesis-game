# Re-textures the Spinosaurus's rig (the part pictures inside a rigger project JSON, tools/rigger/spinosaurus/) in the flat style, the croc-scute way.
# The source parts have a random olive, lime and dark mottle, which reads as noise, so every pixel is first sorted into a role (body, dark, belly, sail stripe, eye) and the mottle is dropped.
# Then, per part and in its own frame (parts turn with the animal, so light stays top left): a lit top and left edge, shade under the flank and on the right, staggered rows of short scute dashes,
# a row of dorsal osteoderms along the top of the back and tail, dark bands across the tail, ventral bands on the belly, and a banded sail (dark membrane between the orange stripes, each stripe lit on its left).
# Far limbs stay flat and darker. Edges on a joint (the tail's ends, the neck's ends) are left alone so no seam shows when a part turns; the eye, the claws and the crest keep their place.
# It refuses a project it already re-textured. Usage: python3 -I tools/pixelspin_rig_shade.py IN.json OUT.json   (IN is tools/rigger/spinosaurus/spinosaurus-source.json)
import sys, io, json, base64
from PIL import Image

C = {"body": (76, 100, 38), "hi": (110, 134, 58), "lo": (52, 72, 28), "scale": (54, 75, 29), "dark": (8, 29, 18), "bandd": (34, 54, 24), "osteo": (30, 46, 22),
     "belly": (208, 206, 173), "bellylo": (176, 174, 142), "bellyhi": (228, 226, 198), "rib": (192, 190, 158),
     "orange": (223, 115, 44), "orangehi": (242, 158, 78), "orangelo": (176, 84, 24), "sail": (8, 29, 18), "sail2": (17, 46, 28),
     "far": (58, 78, 32), "farhi": (70, 92, 40), "farclaw": (150, 148, 112), "eye": (255, 255, 255), "eyeb": (0, 0, 0)}
CREAM = {(208, 206, 173), (118, 119, 78), (154, 155, 102)}

def role(px):
    r, g, b, a = px
    if a < 128: return None
    c = (r, g, b)
    if c == (255, 255, 255): return "eye"
    if c == (0, 0, 0): return "eyeb"
    if c == (223, 115, 44): return "orange"
    if c in CREAM: return "belly"
    if r <= 10 and g <= 30: return "dark"
    return "body"

def shade_part(grid, name):
    h, w = len(grid), len(grid[0]); g = lambda x, y: grid[y][x] if 0 <= x < w and 0 <= y < h else None
    out = [row[:] for row in grid]
    far = "FAR_" in name
    limb = any(k in name for k in ("THIGH", "LEG", "ARM", "HAND", "FOOT"))
    head, jaw, tail, neck, body = "HEAD" in name, "JAW" in name, "TAIL" in name or "TAL_" in name, "NECK" in name, name.endswith("BODY")
    xs = [x for y in range(h) for x in range(w) if grid[y][x] is not None]; x0, x1 = min(xs), max(xs)
    ys = [y for y in range(h) for x in range(w) if grid[y][x] == "orange"]; sail_y = max(ys) if ys else -1
    for y in range(h):
        for x in range(w):
            c = grid[y][x]
            if c is None or c in ("eye", "eyeb"): continue
            up, dn, lf, rt = g(x, y - 1), g(x, y + 1), g(x - 1, y), g(x + 1, y)
            if body and y <= sail_y:                                    # the sail: dark membrane in two tones, orange stripes lit on their left edge, with a darker foot
                if c == "orange":
                    n = "orangehi" if lf != "orange" else "orangelo" if (dn is None or g(x, y + 1) != "orange") and y == sail_y else "orange"
                else: n = "sail2" if (y + x // 3) % 2 == 0 else "sail"
                out[y][x] = n; continue
            if c == "orange": out[y][x] = "orange"; continue            # the head's crest
            if far:
                out[y][x] = "farclaw" if c == "belly" else "farhi" if (limb and lf is None and c != "belly") else "far"; continue
            if c == "belly":
                n = "belly"
                if jaw: n = "bellylo" if dn is None else "bellyhi" if up is None else "belly"
                elif limb: n = "bellylo" if rt is None else "belly"        # the claws
                elif (dn is None or dn != "belly") and not neck: n = "bellylo"   # shade under the belly's lower edge
                elif up not in ("belly",) and not neck and not tail: n = "bellyhi"
                elif y % 2 == 0 and not neck: n = "rib"                 # ventral bands
                out[y][x] = n; continue
            # body hide (the head keeps its dark snout)
            n = "dark" if (c == "dark" and (head or jaw)) else "body"
            if body and sail_y >= 0 and y in (sail_y + 1, sail_y + 2) and n == "body": n = "bandd"   # the dark band at the sail's foot
            elif jaw: n = "bellylo" if dn is None else "body"
            elif limb:
                if lf is None: n = "hi"
                elif rt is None or (dn is None): n = "lo"
                elif y % 3 == 1 and (x % 4) < 2 and n == "body": n = "scale"
            elif n == "body":
                joint_end = (tail or neck) and (x <= x0 + 1 or x >= x1 - 1)
                if up is None and not joint_end:
                    n = "osteo" if (x % 3 == 0 and not head) else "hi"    # lit back edge, studded with osteoderms
                elif (dn is None or (dn == "belly" and not head)) and not joint_end: n = "lo"
                elif head and rt is None: n = "lo"
                elif tail and ((x // 4) % 3 == 2) and up is not None and not joint_end: n = "bandd"   # dark bands across the tail
                elif y % 3 == 1 and ((x + 2 * (y // 3)) % 4) < 2: n = "scale"   # rows of short dashes
            if head and c == "dark" and n == "body": n = "dark"
            out[y][x] = n
    return out

def main():
    src, dst = sys.argv[1], sys.argv[2]
    proj = json.load(open(src))
    if proj.get("shaded") == "pixelspin_rig_shade": sys.exit("already re-textured: run it on tools/rigger/spinosaurus/spinosaurus-source.json")
    names = {n["asset"]: n["name"] for n in proj["nodes"]}
    for aid, data in proj["assets"].items():
        im = Image.open(io.BytesIO(base64.b64decode(data.split(",", 1)[1]))).convert("RGBA"); W, H = im.size; px = im.load()
        box = im.getchannel("A").point(lambda v: 255 if v >= 128 else 0).getbbox()
        if not box: continue
        X0, Y0, X1, Y1 = box
        grid = [[role(px[X0 + x, Y0 + y]) for x in range(X1 - X0)] for y in range(Y1 - Y0)]
        res = shade_part(grid, names[aid])
        for y in range(Y1 - Y0):
            for x in range(X1 - X0):
                k = res[y][x]
                if k is not None and grid[y][x] not in ("eye", "eyeb"): px[X0 + x, Y0 + y] = C[k] + (px[X0 + x, Y0 + y][3],)
        buf = io.BytesIO(); im.save(buf, "PNG"); proj["assets"][aid] = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
    proj["shaded"] = "pixelspin_rig_shade"
    json.dump(proj, open(dst, "w"), separators=(",", ":"))
    print("re-textured", len(proj["assets"]), "parts ->", dst)

if __name__ == "__main__": main()
