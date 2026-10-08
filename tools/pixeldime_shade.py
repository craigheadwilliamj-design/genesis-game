# Adds shading and texture to the coded pixel Dimetrodon (PIXEL_ART.dime in js/pixelart.js) without touching its shape or color scheme.
# Every pixel keeps its place; only fills inside the shapes change, to a lighter or darker shade of the same hue (light from the top left): a lit edge along the back,
# the top of the head and the sail's rim, shadow under the body and down the sail's right side and bases, grooves beside each sail rib, scale flecks on the hide,
# and scutes on the belly. It reads the shaded colors back to their base colors first, so running it twice gives the same result. Usage: python3 -I tools/pixeldime_shade.py [pixelart.js]
import re, sys

BASE = {"body": (97, 111, 34), "dark": (67, 75, 22), "belly": (178, 165, 66), "sail": (178, 78, 0), "rib": (180, 108, 51), "eye": (218, 162, 0), "tooth": (229, 223, 150), "black": (0, 0, 0)}
SHADE = {"bodyhi": (123, 139, 48), "bodylo": (80, 92, 28), "bellyhi": (201, 190, 90), "bellylo": (143, 132, 50), "sailhi": (200, 98, 14), "saillo": (140, 60, 0)}
ROOT = {"bodyhi": "body", "bodylo": "body", "bellyhi": "belly", "bellylo": "belly", "sailhi": "sail", "saillo": "sail"}
H = lambda x, y, m: (x * 7 + y * 13 + (x * y) % 5) % m   # a fixed scatter by position, so the texture sits still from frame to frame

def shade(grid):
    h, w = len(grid), len(grid[0]); g = lambda x, y: grid[y][x] if 0 <= x < w and 0 <= y < h else None
    out = [row[:] for row in grid]; changed = 0
    for y in range(h):
        for x in range(w):
            c = grid[y][x]; up, dn, lf, rt = g(x, y - 1), g(x, y + 1), g(x - 1, y), g(x + 1, y); n = c
            if c == "body":
                if up in (None, "sail", "rib") and H(x, y, 4) != 0: n = "bodyhi"                      # a lit edge along the back and the top of the head, broken up
                elif dn in ("belly", None) and (x + y) % 2 == 0: n = "bodylo"                          # shadow where the body turns under, dithered
                elif lf in ("sail", "rib") and up == "body" and H(x, y, 3) == 0: n = "bodylo"          # a bit of shadow against the sail's foot
                elif y % 3 == 0 and (x + (y // 3) * 3) % 7 in (0, 1) and up == "body" and dn == "body": n = "bodylo"      # scale rows: short dark dashes, staggered
                elif y % 3 == 1 and (x + (y // 3) * 3 + 3) % 7 == 0 and up in ("body", "bodylo") and dn == "body": n = "bodyhi"   # and a light fleck between the rows
                if g(x, y + 1) == "eye" or g(x + 1, y) == "eye" or g(x, y - 1) == "eye": n = "dark" if H(x, y, 3) else n   # a shadowed brow and cheek at the eye
            elif c == "dark":
                if up is None and H(x, y, 2) == 0: n = "body"                                          # a lit top on the legs
            elif c == "belly":
                if dn is None: n = "bellylo"                                                           # the underside is in shadow
                elif x % 4 == 1 and up in ("body", "bodylo", "bodyhi"): n = "bellyhi"                  # belly scutes: short light dashes
                elif up is None and x % 3 == 0: n = "bellyhi"
            elif c == "sail":
                if up is None and (x + y) % 3 != 0: n = "sailhi"                                       # the rim catches the light
                elif lf is None and y % 2 == 0: n = "sailhi"
                elif rt is None or (rt in ("sail", "rib", "saillo", "sailhi") and g(x + 2, y) is None and y % 2 == 0): n = "saillo"   # the right side is in shade
                elif lf == "rib" and y % 2 == 0: n = "saillo"                                          # a groove beside each rib
                elif dn in ("body", "bodylo", "bodyhi") or g(x, y + 2) in ("body", "bodylo", "bodyhi") and (x + y) % 2 == 0: n = "saillo"   # darker where it meets the back
            elif c == "rib":
                if up is None: n = "sailhi" if (x + y) % 2 == 0 else c
            if n != c: out[y][x] = n; changed += 1
    return out, changed

def main(path):
    src = open(path).read(); a = src.index("// Coded pixel Dimetrodon"); b = src.index("// Coded pixel Tiktaalik"); blk = src[a:b]
    head, body = blk.split("  frames: [", 1); pal = dict(re.findall(r'(\w):"(#[0-9a-fA-F]{6})"', head)); rgb = {k: tuple(int(v[i:i+2], 16) for i in (1, 3, 5)) for k, v in pal.items()}
    allc = {**BASE, **SHADE}; cls = {}
    for k, c in rgb.items():
        m = [n for n, v in allc.items() if v == c]; assert m, (k, c); cls[k] = ROOT.get(m[0], m[0])   # read any earlier shading back to the base color
    frames = [[ch for ch in re.findall(r'"([^"]+)"', fr)] for fr in re.split(r"\n    \],?\n", body.split("\n  ]\n};")[0])[:-1] or []]
    rows_all = re.findall(r'"([^"]+)"', body); hgt = int(re.search(r"(\d+) frames", blk).group(1)) if False else None
    nfr = body.count("    [\n"); hh = len(rows_all) // nfr; frames = [rows_all[i * hh:(i + 1) * hh] for i in range(nfr)]
    grids = [[[None if ch == "." else cls[ch] for ch in r] for r in fr] for fr in frames]
    res = [shade(gr) for gr in grids]; tot = sum(sum(1 for c in row if c) for gr in grids for row in gr); chg = sum(c for _, c in res)
    names = list(BASE) + list(SHADE); keys = "abcdefghijklmnopqrstuvwxyz"; letter = {n: keys[i] for i, n in enumerate(names)}
    colors = {**BASE, **SHADE}; used = []
    for g, _ in res:
        for row in g:
            for c in row:
                if c and c not in used: used.append(c)
    outrows = [["".join("." if c is None else letter[c] for c in row) for row in g] for g, _ in res]
    block = ("// Coded pixel Dimetrodon, built by tools/pixeldime.py and shaded by tools/pixeldime_shade.py: PIXEL_ART.dime = {pal, frames: [stand, walk1, pass, walk2, pass]}.\nPIXEL_ART.dime = {\n  pal: {"
             + ", ".join(f'{letter[n]}:"#%02x%02x%02x"' % colors[n] for n in names if n in used) + "},\n  frames: [\n"
             + ",\n".join("    [\n" + ",\n".join(f'      "{r}"' for r in fr) + "\n    ]" for fr in outrows) + "\n  ]\n};\n")
    print(f"{len(used)} colors; {chg} of {tot} pixels shaded across {nfr} frames ({100 * chg / tot:.0f}%)")
    open(path, "w").write(src[:a] + block + src[b:])

main(sys.argv[1] if len(sys.argv) > 1 else "js/pixelart.js")
