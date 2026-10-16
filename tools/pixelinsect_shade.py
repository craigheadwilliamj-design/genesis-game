# Adds shading and texture to the Arthropleura (sprites/arth.png, arth-idle.png) and the Meganeura (sprites/mega.png, mega-idle.png) without touching their shape or base colors.
# Light is from the top left: a lit back and left edges, shade on the underside and right, structured texture (plate dashes and a lit edge after each groove on the Arthropleura, ring shadows
# and veins on the Meganeura's body and wings). Only fills change, to a lighter or darker shade of the same hue. It reads shaded colors back to their base first, so a second run gives the same result.
# arth.png and mega.png are cut from frame 0 of their idle strips. Usage: python3 -I tools/pixelinsect_shade.py [dir]
import sys
from PIL import Image
W = 100

ARTH = {"base": {"dors": (55, 34, 27), "groove": (25, 16, 12), "head": (45, 28, 22), "black": (15, 9, 7), "black2": (5, 3, 2), "pure": (0, 0, 0), "red": (100, 35, 29), "reddk": (76, 27, 23),
                 "org": (139, 57, 35), "orgdk": (103, 42, 26), "org2": (137, 66, 36), "orglt": (173, 84, 45), "leg": (27, 17, 12), "leg2": (16, 10, 7)},
        "shade": {"dorshi": (76, 49, 38), "dorslo": (40, 25, 20), "headhi": (62, 39, 31), "redhi": (124, 45, 36), "redlo": (62, 22, 19), "orghi": (158, 70, 40), "orglo": (88, 35, 22), "orgbr": (193, 102, 58)},
        "root": {"dorshi": "dors", "dorslo": "dors", "headhi": "head", "redhi": "red", "redlo": "red", "orghi": "org", "orglo": "org", "orgbr": "orglt"}}
MEGA = {"base": {"body": (96, 137, 8), "band": (131, 137, 8), "wing": (127, 152, 71), "eye": (54, 171, 6), "eyehi": (64, 201, 8), "eyedk": (82, 85, 16), "leg": (53, 55, 7), "under": (56, 79, 4)},
        "shade": {"bodyhi": (118, 160, 12), "bodylo": (74, 108, 6), "bandhi": (150, 156, 22), "bandlo": (104, 108, 8), "wingvein": (98, 122, 48), "winghi": (160, 180, 108), "leghi": (74, 77, 12), "underlo": (40, 58, 3)},
        "root": {"bodyhi": "body", "bodylo": "body", "bandhi": "band", "bandlo": "band", "wingvein": "wing", "winghi": "wing", "leghi": "leg", "underlo": "under"}}
H = lambda x, y, m: (x * 7 + y * 13 + (x * y) % 5) % m   # a fixed scatter by position, so the texture sits still from frame to frame

def helpers(grid):
    h, w = len(grid), len(grid[0]); g = lambda x, y: grid[y][x] if 0 <= x < w and 0 <= y < h else None
    def run_up(x, y):
        n = 0
        while g(x, y - 1 - n) is not None: n += 1
        return n
    return g, run_up

def shade_arth(grid):
    g, run_up = helpers(grid); out = [r[:] for r in grid]; D = ("dors", "dorshi", "dorslo")
    for y in range(len(grid)):
        for x in range(len(grid[0])):
            c = grid[y][x]
            if c is None: continue
            up, dn, lf, rt = g(x, y - 1), g(x, y + 1), g(x - 1, y), g(x + 1, y); t = run_up(x, y); n = c
            if c == "dors":
                if up is None and H(x, y, 5) != 0: n = "dorshi"                                   # the back catches the light
                elif t == 1 and (x + y) % 2 == 0: n = "dorshi"                                    # a dithered fall-off under it
                elif lf == "groove" and t <= 4: n = "dorshi"                                      # each plate is lit on its left edge after a groove
                elif rt == "groove": n = "dorslo"                                                 # and shaded on the right before the next
                elif dn not in D and dn != "groove" and (x + y) % 2 == 0: n = "dorslo"            # where the back turns under the flank
                elif y % 3 == 0 and (x % 5) in (1, 2) and rt == "dors": n = "dorslo"              # rows of short dashes across each plate
                elif y % 3 == 1 and (x % 5) == 2 and lf == "dors" and t > 1: n = "dorshi"
            elif c == "head":
                if up is None or (lf is None and H(x, y, 2) == 0): n = "headhi"
            elif c == "red":
                if up in D + ("head",) and (x + y) % 2 == 0: n = "redhi"                          # a lit stripe edge under the back
                elif dn in ("org", "orgdk", "org2", "orglt") and (x % 3) == 0: n = "redlo"
            elif c in ("org", "orgdk", "org2"):
                if up in ("red", "reddk") and (x + y) % 3 != 0: n = "orghi"                       # the belly plate rolls out lit
                elif dn is None and (x + y) % 2 == 0: n = "orglo"                                 # shadow along the underside
                elif rt is None and H(x, y, 2) == 0: n = "orglo"
                elif c == "org" and y % 3 == 0 and (x % 4) == 1 and rt == "org": n = "orghi"       # belly scutes: short lit dashes in rows
            elif c == "orglt":
                if lf is None or (up in ("red", "reddk", "org", "orgdk") and H(x, y, 3) == 0): n = "orgbr"
            elif c == "leg" and (up is None or up in ("org", "orgdk", "org2", "orglt")): pass
            if n != c: out[y][x] = n
    return out

def shade_mega(grid):
    g, run_up = helpers(grid); out = [r[:] for r in grid]; B = ("body", "bodyhi", "bodylo")
    for y in range(len(grid)):
        for x in range(len(grid[0])):
            c = grid[y][x]
            if c is None: continue
            up, dn, lf, rt = g(x, y - 1), g(x, y + 1), g(x - 1, y), g(x + 1, y); n = c; t = run_up(x, y)
            if c == "body":
                if (up is None or up == "wing") and H(x, y, 4) != 0: n = "bodyhi"                  # the back catches the light
                elif t == 1 and (x + y) % 2 == 0: n = "bodyhi"
                elif lf is None and H(x, y, 3) != 0: n = "bodyhi"
                elif rt == "band" and y > 28 and t > 2: n = "bodylo"                               # shade before each ring
                elif dn is None or dn in ("under", "leg"): n = "bodylo" if (x + y) % 2 == 0 else c  # shadow where the body turns under
                elif rt is None and H(x, y, 2) == 0: n = "bodylo"
            elif c == "band":
                if up is None or up == "wing": n = "bandhi"
                elif dn is None or dn == "under": n = "bandlo"
            elif c == "under":
                if dn is None and x % 2 == 0: n = "underlo"
            elif c == "leg":
                if up is None and x % 2 == 0: n = "leghi"
            elif c == "wing":
                if up is None and lf is None: n = "wingvein"                                       # the leading edge of the wing
                elif up is None or (lf is None and y % 2 == 0): n = "winghi"
                elif (x - y) % 10 == 0 and y % 2 == 0: n = "wingvein"                              # veins running down the wing
                elif rt is None or dn is None: n = "wingvein" if H(x, y, 2) == 0 else c
            if n != c: out[y][x] = n
    return out

def run(im, spec, fn, n):
    allc = {**spec["base"], **spec["shade"]}; rev = {v: k for k, v in allc.items()}; assert len(rev) == len(allc), "a shade landed on another color"
    out = Image.new("RGBA", im.size, (0, 0, 0, 0)); chg = tot = 0
    for i in range(n):
        fr = im.crop((i * W, 0, (i + 1) * W, im.height)); px = fr.load(); grid = [[None] * fr.width for _ in range(fr.height)]
        for y in range(fr.height):
            for x in range(fr.width):
                r, g_, b, a = px[x, y]
                if a: k = rev.get((r, g_, b)); assert k, (i, x, y, (r, g_, b)); grid[y][x] = spec["root"].get(k, k)   # read any earlier shading back to the base color
        res = fn(grid)
        for y in range(fr.height):
            for x in range(fr.width):
                if res[y][x]:
                    tot += 1; chg += res[y][x] != grid[y][x]; out.putpixel((i * W + x, y), allc[res[y][x]] + (255,))
    for y in range(im.height):   # the shape must be exactly where it was
        for x in range(im.width): assert out.getpixel((x, y))[3] == im.getpixel((x, y))[3], "the shape changed"
    print(f"{chg} of {tot} pixels shaded ({100 * chg // max(tot, 1)}%)")
    return out

def main(d):
    for name, spec, fn, n in (("arth", ARTH, shade_arth, 6), ("mega", MEGA, shade_mega, 4)):
        path = f"{d}/{name}-idle.png"; out = run(Image.open(path).convert("RGBA"), spec, fn, n); out.save(path)
        out.crop((0, 0, W, out.height)).save(f"{d}/{name}.png")

if __name__ == "__main__": main(sys.argv[1] if len(sys.argv) > 1 else "sprites")
