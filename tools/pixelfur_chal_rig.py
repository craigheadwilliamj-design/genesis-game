# Fur texture for the Chalicotherium's rig parts (tools/rigger/chalicotherium/): the first mammal, so short fur strokes instead of scale dashes.
# Reads each pixel back to a role (coat, saddle marks, mane, belly) from the colors the part holds, then paints the roles in the flat style:
# a lit top-left edge, shade under the flank and down the right side, staggered rows of short fur strokes slanting back (dark ones, and lit ones high on the coat),
# hair strands down the mane, a lighter top and darker underside on the saddle marks, a lit line where the belly meets the flank.
# Every pixel keeps its place (asserted), the head's face, the jaw, ear, hands, feet and claws stay as they are, far limbs stay flat, and a second run gives the same result.
# Usage: python3 -I tools/pixelfur_chal_rig.py   (rewrites the rig and clips JSONs in place, then run rigtogame.py as in docs/rigs.md)
import os, io, json, base64
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
H = lambda s: tuple(int(s[i:i + 2], 16) for i in (1, 3, 5))
FILES = ["chalicotherium-rig.json", "chalicotherium-clips.json"]
# colors the parts hold now -> role (the older shading pass's tones read back to their base role)
MAP = {"#75440d": "base", "#834c0f": "base", "#673c0b": "base", "#59340a": "far",
       "#413107": "mark", "#4f3b08": "mark",
       "#433923": "mane", "#4d4228": "mane", "#574b2d": "mane",
       "#b8984a": "belly", "#ae8f44": "belly", "#987d3c": "belly"}
NEW = {"base": "#75440d", "hi": "#94591a", "hi2": "#844e12", "lo": "#5c3508", "fur": "#653b0b", "furhi": "#8a5214", "far": "#59340a",
       "mark": "#4a380a", "markhi": "#5e4812", "marklo": "#372a07", "markfur": "#413107",
       "mane": "#4b4127", "manehi": "#6b5d3b", "manelo": "#352d1a", "strand": "#3f3620",
       "belly": "#b39448", "bellyhi": "#cbb064", "bellylo": "#927636", "bellyfur": "#a3863f"}
FLAT = ("FOOT", "HAND", "JAW", "EAR", "FAR")                     # parts named with any of these words are left exactly as they are

def depths(grid):
    # how many pixels of the part sit above / below each pixel in its column (0 = the edge row)
    h, w = len(grid), len(grid[0]); top = [[0] * w for _ in range(h)]; bot = [[0] * w for _ in range(h)]
    for x in range(w):
        for y in range(h):
            if grid[y][x] is not None: top[y][x] = top[y - 1][x] + 1 if y and grid[y - 1][x] is not None else 0
        for y in range(h - 1, -1, -1):
            if grid[y][x] is not None: bot[y][x] = bot[y + 1][x] + 1 if y < h - 1 and grid[y + 1][x] is not None else 0
    return top, bot

def stroke(x, y, gap=6, row=4, n=3):
    # a fur stroke N pixels long slanting down and back (the animal faces right): rows every ROW px, strokes every GAP px, each row shifted along
    for k in range(n):
        yy, xx = y - k, x - k
        if yy % row == 0 and (-xx + 2 * (yy // row)) % gap == 0: return True
    return False

def shade(grid, name):
    h, w = len(grid), len(grid[0]); g = lambda x, y: grid[y][x] if 0 <= x < w and 0 <= y < h else None
    out = [row[:] for row in grid]; top, bot = depths(grid)
    limb, head = any(k in name for k in ("THIGH", "LEG", "FOREARM", "UPARM")), "HEAD" in name
    for y in range(h):
        for x in range(w):
            c = grid[y][x]
            if not isinstance(c, str): continue
            up, dn, lf, rt = g(x, y - 1), g(x, y + 1), g(x - 1, y), g(x + 1, y); n = c
            if c == "base":
                if head: n = "hi" if up is None else c                    # the face is drawn by hand: only the crown gets lit
                elif limb:
                    l = r = 0
                    while g(x - l - 1, y) is not None: l += 1
                    while g(x + r + 1, y) is not None: r += 1
                    if l == 0: pass                                     # no lit front edge: on a limb it reads as a seam line down the chest and leg
                    elif r == 0: n = "lo"
                    elif l >= 1 and r >= 2 and stroke(x, y, 6, 4, 3 if l + r >= 8 else 2): n = "fur"     # long strokes on the thigh and upper arm, short on the shins
                elif up is None or up == "mane": n = "hi"                       # lit along the back and under the mane
                elif top[y][x] == 1: n = "hi2"
                elif dn is None or dn == "belly" or rt is None: n = "lo"          # shade where the flank turns under, and down the right side
                elif stroke(x, y): n = "furhi" if top[y][x] <= 4 else "fur"
            elif c == "mark":
                if up is None or up in ("base", "mane"): n = "markhi"
                elif dn is None or dn in ("base", "belly"): n = "marklo"
                elif stroke(x, y, 6, 4, 2): n = "markfur"
            elif c == "mane":
                if up is None: n = "manehi"
                elif dn is None or dn not in ("mane",): n = "manelo"
                elif x % 3 == 1 and g(x, y - 1) == "mane": n = "strand"   # hair strands hanging down the crest
                elif x % 3 == 0 and top[y][x] == 1: n = "manehi"
            elif c == "belly":
                if dn is None: n = "bellylo"
                elif up in ("base", "mark", None): n = "bellyhi"
                elif stroke(x, y, 5, 3, 2) and dn == "belly": n = "bellyfur"
            if n != c: out[y][x] = n
    return out

def run():
    rev = {H(k): v for k, v in MAP.items()}; new = {k: H(v) for k, v in NEW.items()}
    for k, v in new.items():                                          # its own colors read back to their role
        base = {"hi": "base", "hi2": "base", "lo": "base", "fur": "base", "furhi": "base", "markhi": "mark", "marklo": "mark", "markfur": "mark",
                "manehi": "mane", "manelo": "mane", "strand": "mane", "bellyhi": "belly", "bellylo": "belly", "bellyfur": "belly"}.get(k, k)
        rev.setdefault(v, base)
    for f in FILES:
        path = os.path.join(HERE, "rigger", "chalicotherium", f)
        proj = json.load(open(path)); done = set()
        for nd in proj["nodes"]:
            nm, a = nd["name"].upper(), nd["asset"]
            if a in done: continue
            done.add(a)
            im = Image.open(io.BytesIO(base64.b64decode(proj["assets"][a].split(",", 1)[1]))).convert("RGBA")
            if set(nm.split("_")) & set(FLAT): continue
            grid = [[None] * im.width for _ in range(im.height)]
            for y in range(im.height):
                for x in range(im.width):
                    r, gg, b, al = im.getpixel((x, y))
                    if al: k = rev.get((r, gg, b)); grid[y][x] = k if k and not ("HEAD" in nm and (r, gg, b) != H("#75440d") and k == "base") else (r, gg, b)
            res = shade(grid, nm)
            out = Image.new("RGBA", im.size, (0, 0, 0, 0))
            for y in range(im.height):
                for x in range(im.width):
                    c = res[y][x]
                    if c is not None: out.putpixel((x, y), (new[c] if isinstance(c, str) else c) + (255,))
            for y in range(im.height):
                for x in range(im.width): assert out.getpixel((x, y))[3] == im.getpixel((x, y))[3], "the shape changed"
            buf = io.BytesIO(); out.save(buf, "PNG"); proj["assets"][a] = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
        proj["shaded"] = "pixelfur_chal_rig"
        json.dump(proj, open(path, "w"), separators=(",", ":"))
        print(f"chal: {f} done")

if __name__ == "__main__": run()
