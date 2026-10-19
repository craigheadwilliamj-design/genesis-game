# New hide texture for four rigged animals: the Allosaurus, Dryosaurus, Compsognathus and Platyhystrix (part pictures inside their rigger projects, tools/rigger/<species>/).
# Their parts already carry an older shading pass, so this reads each pixel back to a role (base hide, belly, markings, sail...) from the colors the part holds now, then paints the roles again in the flat style:
# a lit top-left edge, shade under the flank and the right side, rows of short scale dashes, belly scutes, a lit line where belly meets flank, markings with a lighter top and darker underside.
# Every pixel keeps its place (asserted), eyes, claws and anything it doesn't know stay exactly as they are, and it is safe to run twice (it reads its own colors back).
# Far limbs and feet stay flat. Parts turn with the animal, so each part is shaded in its own frame.
# Usage: python3 -I tools/pixelretex4_rig.py [allo|dryo|comp|plhy ...]   (no argument = all four; rewrites the rig and clips JSONs in place, then run rigtogame.py as in docs/rigs.md)
import sys, os, io, json, base64
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
H = lambda s: tuple(int(s[i:i + 2], 16) for i in (1, 3, 5))

# per species: DIR/FILES (projects), PART (name fragment -> kind), MAP (color a part holds now -> role), NEW (role -> color), and which roles use which rule.
SPECIES = {
    "allo": {
        "dir": "allosaurus", "files": ["allosaurus-rig.json", "allosaurus-clips.json"],
        "map": {"#b08756": "base", "#b58e60": "base", "#9e774a": "far", "#8a6740": "belly", "#892929": "mark", "#952d2d": "mark", "#c3c3c3": "band", "#d3d3d3": "band",
                "#bf8a5a": "base"},
        "new": {"base": "#b98e5a", "hi": "#d0a874", "lo": "#94693f", "scale": "#a97f4d", "far": "#9a7447",
                "belly": "#d9bf8a", "bellyhi": "#e8d3a3", "bellylo": "#b8985f", "rib": "#c7a96f",
                "mark": "#8e2b2b", "markhi": "#b04438", "marklo": "#681d22", "band": "#cfcbbd", "bandhi": "#e6e3d6", "bandlo": "#a6a294"},
        "scale": True, "ribs": True, "soft": True,
    },
    "dryo": {
        "dir": "dryosaurus", "files": ["dryosaurus-rig.json", "dryosaurus-clips.json"],
        "map": {"#2e4e3e": "base", "#223a2e": "far", "#71643c": "belly", "#3b4a33": "base"},
        "new": {"base": "#35604a", "hi": "#4b7d62", "lo": "#25443a", "scale": "#2d5240", "far": "#244436",
                "belly": "#7d6f44", "bellyhi": "#8d7f50", "bellylo": "#65593a", "rib": "#756839"},
        "scale": True, "ribs": True, "soft": True, "flatthigh": True,
    },
    "comp": {
        "dir": "compsognathus", "files": ["compsognathus-rig.json", "compsognathus-clips.json"],
        "map": {"#ccae02": "base", "#ae9402": "base", "#baa949": "base", "#372d25": "dark", "#251e19": "far", "#524137": "dark", "#524237": "dark", "#6d5749": "dark",
                "#0364b2": "tail", "#0490fc": "tailhi", "#15538f": "tail", "#cec280": "belly", "#c6b86a": "belly", "#c2b35f": "belly"},
        "new": {"base": "#d4b30c", "hi": "#ecd24a", "lo": "#a68a05", "scale": "#bd9f08", "dark": "#3b3028", "darkhi": "#55463a", "darklo": "#271f19", "far": "#251e19",
                "belly": "#d9cd92", "bellyhi": "#ebe2b4", "bellylo": "#b3a66c", "rib": "#c5b87c",
                "tail": "#0766b4", "tailhi": "#2a9af0", "taillo": "#0a4a86"},
        "scale": True, "ribs": True,
    },
    "plhy": {
        "dir": "platyhystrix", "files": ["platyhystrix-rig.json", "platyhystrix-clips.json"],
        "map": {"#00b684": "base", "#00986e": "base", "#008963": "far", "#007a58": "belly", "#005c42": "belly", "#006b4d": "belly",
                "#8cb600": "sailA", "#e7b600": "sailB", "#1a0b51": "mark"},
        "new": {"base": "#0fb386", "hi": "#3fd3a3", "lo": "#07805f", "scale": "#0da97d", "far": "#08785a",
                "belly": "#2b9478", "bellyhi": "#37a587", "bellylo": "#1d6f58", "rib": "#2f9c80",
                "mark": "#1f1058", "markhi": "#3a2a80", "marklo": "#140a3a",
                "sailA": "#94bd10", "sailAhi": "#b4d83a", "sailAlo": "#6b9206",
                "sailB": "#eab80e", "sailBhi": "#f7d44c", "sailBlo": "#bc8d08"},
        "scale": True, "ribs": True,
    },
}

def shade(grid, name, sp):
    h, w = len(grid), len(grid[0]); g = lambda x, y: grid[y][x] if 0 <= x < w and 0 <= y < h else None
    out = [row[:] for row in grid]
    limb = any(k in name for k in ("THIGH", "LEG", "FOREARM", "UPARM", "UP.ARM"))
    head, jaw, tail, neck = "HEAD" in name, "JAW" in name, "TAIL" in name, "NECK" in name
    for y in range(h):
        for x in range(w):
            c = grid[y][x]
            if not isinstance(c, str) or c == "far": continue
            up, dn, lf, rt = g(x, y - 1), g(x, y + 1), g(x - 1, y), g(x + 1, y); n = c
            if sp.get("soft"):                                                 # soft: no seams where parts meet, nothing on the jaw, the tail tip or a one-pixel run
                if jaw or "TAIL_END" in name or (up is None and dn is None): continue
            fam = {"sailA": "sailA", "sailB": "sailB", "mark": "mark", "band": "band", "dark": "dark", "tail": "tail", "tailhi": "tailhi"}.get(c)
            if c in ("sailA", "sailB"):                                        # the sail: a lit upper left rim, a shaded lower right one
                if up is None or lf is None: n = c + "hi"
                elif dn is None or rt is None: n = c + "lo"
            elif c in ("mark", "band", "dark"):                                # markings: lighter on top, darker underneath, never on a joint edge
                if up is None or (up != c and up in ("base", "belly")): n = c + "hi"
                elif dn is None or (dn != c and dn in ("base", "belly")): n = c + "lo"
            elif c == "base":
                if limb:
                    if sp.get("soft") and ("THIGH" not in name or sp.get("flatthigh")): pass   # a lit edge on a thin limb reads as a line down the leg
                    elif lf is None: n = "hi"
                    elif (rt is None or dn is None) and not sp.get("soft"): n = "lo"
                elif jaw: n = "lo" if dn is None else "hi" if up is None else c
                elif up is None: n = "hi"
                elif sp.get("soft") and head: n = c
                elif dn is None or (head and (rt is None or dn == "belly")): n = "lo"
                elif sp["scale"] and not head and y % 3 == 1 and ((x + 2 * (y // 3)) % 4) < 2 and up not in ("mark", "band", "dark") and dn not in ("mark", "band", "dark"): n = "scale"
            elif c == "belly":
                if dn is None: n = "bellylo"
                elif up in ("base", "mark", "band", "dark", None) and not head: n = "bellyhi"
                elif sp["ribs"] and x % 3 == 1 and not head and not tail and not neck and not limb and dn == "belly": n = "rib"
            if n != c: out[y][x] = n
    return out

def run(key):
    sp = SPECIES[key]; rev = {H(k): v for k, v in sp["map"].items()}
    # a role that has no shade of its own in NEW (e.g. "hi" on a species without one) falls back to the base color
    new = {k: H(v) for k, v in sp["new"].items()}
    for k, v in new.items():                                                      # its own colors read back to their role, so a second run gives the same result
        base = {"hi": "base", "lo": "base", "scale": "base", "bellyhi": "belly", "bellylo": "belly", "rib": "belly"}.get(k, k)
        for suf in ("hi", "lo"):
            if base.endswith(suf) and base[:-len(suf)] in new: base = base[:-len(suf)]
        rev.setdefault(v, base)
    for f in sp["files"]:
        path = os.path.join(HERE, "rigger", sp["dir"], f)
        proj = json.load(open(path)); done = set()
        for n in proj["nodes"]:
            nm, a = n["name"].upper(), n["asset"]
            if a in done: continue
            done.add(a)
            im = Image.open(io.BytesIO(base64.b64decode(proj["assets"][a].split(",", 1)[1]))).convert("RGBA")
            grid = [[None] * im.width for _ in range(im.height)]
            for y in range(im.height):
                for x in range(im.width):
                    r, gg, b, al = im.getpixel((x, y))
                    if al: k = rev.get((r, gg, b)); grid[y][x] = k if k else (r, gg, b)     # eyes, claws and unknown colors stay
            if "FOOT" in nm or "FAR" in nm: res = grid                                # feet and far limbs stay flat (far keeps its own color)
            else: res = shade(grid, nm, sp)
            out = Image.new("RGBA", im.size, (0, 0, 0, 0))
            for y in range(im.height):
                for x in range(im.width):
                    c = res[y][x]
                    if c is None: continue
                    out.putpixel((x, y), (new[c] if isinstance(c, str) else c) + (255,))
            for y in range(im.height):
                for x in range(im.width): assert out.getpixel((x, y))[3] == im.getpixel((x, y))[3], "the shape changed"
            buf = io.BytesIO(); out.save(buf, "PNG"); proj["assets"][a] = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
        proj["shaded"] = "pixelretex4_rig"
        json.dump(proj, open(path, "w"), separators=(",", ":"))
        print(f"{key}: {f} done, {len(done)} parts")

if __name__ == "__main__":
    for k in (sys.argv[1:] or list(SPECIES)): run(k)
