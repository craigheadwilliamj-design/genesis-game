# Adds shading and texture to the coded pixel Dimetrodon (sprites/dime.png and dime-walk.png) without touching its shape or color scheme.
# Every pixel keeps its place; only fills inside the shapes change, to a lighter or darker shade of the same hue (light from the top left): a lit edge along the back,
# the top of the head and the sail's rim, shadow under the body and down the sail's right side and bases, grooves beside each sail rib, scale flecks on the hide,
# and scutes on the belly. It reads the shaded colors back to their base colors first, so a second run only changes the four pixels beside the eye (the brow rule). Usage: python3 -I tools/pixeldime_shade.py [dir]
import sys
from PIL import Image
W = 100

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

def main(d, files):
    allc = {**BASE, **SHADE}; rev = {v: k for k, v in allc.items()}; assert len(rev) == len(allc), "a shade landed on another color"
    for f in files:
        path = f"{d}/{f}.png"; im = Image.open(path).convert("RGBA"); n = im.width // W; out = Image.new("RGBA", im.size, (0, 0, 0, 0)); chg = tot = 0
        for i in range(n):
            fr = im.crop((i * W, 0, (i + 1) * W, im.height)); px = fr.load(); grid = [[None] * fr.width for _ in range(fr.height)]
            for y in range(fr.height):
                for x in range(fr.width):
                    r, g_, b, a = px[x, y]
                    if a: k = rev.get((r, g_, b)); assert k, (path, x, y, (r, g_, b)); grid[y][x] = ROOT.get(k, k)   # read any earlier shading back to the base color
            res, c = shade(grid); chg += c
            for y in range(fr.height):
                for x in range(fr.width):
                    if res[y][x]: tot += 1; out.putpixel((i * W + x, y), allc[res[y][x]] + (255,))
        for y in range(im.height):   # the shape must be exactly where it was
            for x in range(im.width): assert out.getpixel((x, y))[3] == im.getpixel((x, y))[3], "the shape changed"
        out.save(path); print(path, f"{chg} of {tot} pixels shaded ({100 * chg // max(tot, 1)}%)")

if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "sprites", ("dime", "dime-walk"))
