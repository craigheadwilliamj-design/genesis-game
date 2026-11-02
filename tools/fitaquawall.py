# Fits the hand-painted Cambrian and Paleozoic aquarium walls (sprites/vivscene/src/sea-<scene>-wall.jpg) to each case size, at the painting's own pixel density.
# The whole painting always shows, never cropped: a wall a little narrower than the painting (M, L) is squeezed sideways to fit;
# a wider one (S) keeps the painting's proportions and has its two sides continued by mirroring the painting's edges.
# Usage: python3 -I tools/fitaquawall.py [outdir]   (default sprites/vivscene); then run tools/packsprites.py
import sys, os
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixelvivscene import SIZES
HERE = os.path.dirname(os.path.abspath(__file__))
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", "sprites", "vivscene")
for sc in ("cambrian", "paleozoic"):
    src = Image.open(os.path.join(HERE, "..", "sprites", "vivscene", "src", f"sea-{sc}-wall.jpg")).convert("RGB")
    sw, sh = src.size
    for size, (w, d, sill) in SIZES.items():
        tw = round(sh * w / (d * .45 - sill))   # the wall's width at the painting's height
        if tw <= sw: im = src.resize((tw, sh), Image.LANCZOS)
        else:
            im = Image.new("RGB", (tw, sh)); x0 = (tw - sw) // 2; im.paste(src, (x0, 0))
            for x in range(x0):   # mirror the painting outward on each side
                im.paste(src.crop((min(x, sw - 1), 0, min(x, sw - 1) + 1, sh)), (x0 - 1 - x, 0))
                im.paste(src.crop((sw - 1 - min(x, sw - 1), 0, sw - min(x, sw - 1), sh)), (x0 + sw + x, 0))
        im.save(os.path.join(out, f"sea-{sc}-{size}-wall.png"), optimize=True)
        print(sc, size, im.size)
