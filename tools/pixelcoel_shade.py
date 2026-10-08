# Adds shading to the coded pixel Coelophysis (PIXEL_ART.coel in js/pixelart.js) without touching its shape or color scheme (same idea as tools/pixeldime_shade.py, kept sleek like the Prionosuchus).
# Every pixel keeps its place; only fills inside the shapes change, to a lighter or darker shade of the same hue (light from the top left): a lit edge along the back, the head and the legs' left sides,
# shadow under the body and down the right edges. The thin tail, the yellow belly line, the far legs, the eye and the pupil are left as they are.
# It reads shaded colors back to their base colors first, so running it twice gives the same result. Usage: python3 -I tools/pixelcoel_shade.py [pixelart.js]
import re, sys

def mix(a, b, t): return tuple(round(x * (1 - t) + y * t) for x, y in zip(a, b))
BASE = {"body": (135, 39, 10), "belly": (189, 180, 48), "stripe": (170, 60, 0), "far": (107, 31, 8), "black": (0, 0, 0), "eye": (230, 165, 0)}
SHADE = {"bodyhi": mix(BASE["body"], (255, 255, 255), .2), "bodylo": mix(BASE["body"], (0, 0, 0), .3), "bellylo": mix(BASE["belly"], (0, 0, 0), .25), "stripehi": mix(BASE["stripe"], (255, 255, 255), .2)}
ROOT = {"bodyhi": "body", "bodylo": "body", "bellylo": "belly", "stripehi": "stripe"}

def shade(grid):
    h, w = len(grid), len(grid[0]); g = lambda x, y: grid[y][x] if 0 <= x < w and 0 <= y < h else None
    out = [row[:] for row in grid]; changed = 0
    for y in range(h):
        for x in range(w):
            c = grid[y][x]; up, dn, lf, rt = g(x, y - 1), g(x, y + 1), g(x - 1, y), g(x + 1, y); n = c
            if c == "body":
                if up is None and dn is None: pass                                      # the thin tail stays as it is
                elif up is None: n = "bodyhi"                                           # a clean lit edge along the back and the top of the head
                elif dn in (None, "belly") or rt is None: n = "bodylo"                  # one band of shade under the body and down the right edge
                elif lf is None and dn == "body": n = "bodyhi"                          # a lit left side on the legs and the chest
            elif c == "stripe":
                if up is None: n = "stripehi"                                           # the stripes' lit tops
            elif c == "belly":
                if dn is None and up == "belly": n = "bellylo"                          # the jaw's lower row (the belly line is one row, so it stays bright)
            if n != c: out[y][x] = n; changed += 1
    return out, changed

def main(path):
    src = open(path).read(); a = src.index("// Coded pixel Coelophysis"); b = src.index("// Coded pixel Dimetrodon"); blk = src[a:b]
    head, body = blk.split("  frames: [", 1); pal = dict(re.findall(r'(\w):"(#[0-9a-fA-F]{6})"', head)); rgb = {k: tuple(int(v[i:i+2], 16) for i in (1, 3, 5)) for k, v in pal.items()}
    allc = {**BASE, **SHADE}; cls = {}
    for k, c in rgb.items():
        m = [n for n, v in allc.items() if v == c]; assert m, (k, c); cls[k] = ROOT.get(m[0], m[0])   # read any earlier shading back to the base color
    rows_all = re.findall(r'"([^"]+)"', body); nfr = body.count("    [\n"); hh = len(rows_all) // nfr; frames = [rows_all[i * hh:(i + 1) * hh] for i in range(nfr)]
    grids = [[[None if ch == "." else cls[ch] for ch in r] for r in fr] for fr in frames]
    res = [shade(gr) for gr in grids]; tot = sum(sum(1 for c in row if c) for gr in grids for row in gr); chg = sum(c for _, c in res)
    for gr, (g2, _) in zip(grids, res): assert [[c is None for c in r] for r in gr] == [[c is None for c in r] for r in g2], "the shape changed"
    names = list(BASE) + list(SHADE); letter = {n: "abcdefghijklmnop"[i] for i, n in enumerate(names)}; colors = {**BASE, **SHADE}; used = []
    for g, _ in res:
        for row in g:
            for c in row:
                if c and c not in used: used.append(c)
    outrows = [["".join("." if c is None else letter[c] for c in row) for row in g] for g, _ in res]
    block = ("// Coded pixel Coelophysis, built by tools/pixelcoel.py and shaded by tools/pixelcoel_shade.py: PIXEL_ART.coel = {pal, frames: [stand, walk1 to walk6]}, one letter per pixel ('.' is clear).\nconst PIXEL_ART = {coel: {\n  pal: {"
             + ", ".join(f'{letter[n]}:"#%02x%02x%02x"' % colors[n] for n in names if n in used) + "},\n  frames: [\n"
             + ",\n".join("    [\n" + ",\n".join(f'      "{r}"' for r in fr) + "\n    ]" for fr in outrows) + "\n  ]\n}};\n")
    print(f"{len(used)} colors; {chg} of {tot} pixels shaded across {nfr} frames ({100 * chg / tot:.0f}%)")
    open(path, "w").write(src[:a] + block + src[b:])

main(sys.argv[1] if len(sys.argv) > 1 else "js/pixelart.js")
