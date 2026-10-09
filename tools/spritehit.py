"""Measures every plant and rock picture in sprites/plants and sprites/rocks and writes SPRITE_HIT into js/data.js (between the SPRITE_HIT markers).
Each entry is [width px, height px, base half-width px, whole half-width px, bands], where the base is the bottom quarter of the opaque pixels and bands is
the silhouette in 4 px rows ("x0-x1" per row, empty where a row is clear). The game uses it for the footprint a plant or rock takes up and for the shape you tap.
Run: python3 -I tools/spritehit.py"""
import glob, os, re
from PIL import Image
B = 4
out = []
for d, pre in (("plants", ""), ("rocks", "")):
    for f in sorted(glob.glob(f"sprites/{d}/*.png")):
        im = Image.open(f).convert("RGBA"); a = im.split()[3].load(); w, h = im.size
        rows = [[x for x in range(w) if a[x, y] > 20] for y in range(h)]
        ys = [y for y in range(h) if rows[y]]
        if not ys: continue
        y0, y1 = ys[0], ys[-1] + 1
        xs = [x for r in rows for x in r]
        base = [x for y in range(max(y0, y1 - max(2, (y1 - y0) // 4)), y1) for x in rows[y]]
        bands = []
        for by in range(0, h, B):
            bx = [x for y in range(by, min(h, by + B)) for x in rows[y]]
            bands.append(f"{min(bx)}-{max(bx)}" if bx else "")
        while bands and not bands[-1]: bands.pop()
        name = os.path.basename(f)[:-4]
        out.append(f'  "{name}":[{w},{h},{(max(base) - min(base) + 1) / 2:g},{(max(xs) - min(xs) + 1) / 2:g},"{",".join(bands)}"],')
blk = "// SPRITE_HIT:start (made by tools/spritehit.py, don't edit)\nconst SPRITE_HIT = {\n" + "\n".join(out) + "\n};\n// SPRITE_HIT:end"
s = open("js/data.js").read()
if "// SPRITE_HIT:start" in s: s = re.sub(r"// SPRITE_HIT:start.*?// SPRITE_HIT:end", lambda m: blk, s, flags=re.S)
else: s = s.replace("const plantMix = ", blk + "\nconst plantMix = ", 1)
open("js/data.js", "w").write(s)
print(len(out), "sprites")
