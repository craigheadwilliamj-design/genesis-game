# Draws the paludarium floors in the flat pixel style (see CLAUDE.md, Art direction): each vivarium scene's floor (tools/pixelvivscene.py) with its front half
# flooded, as a vivarium laid out as a paludarium has it (PALU.water in js/data.js). Seen from above like the rest of the floor: the bank at the back keeps the
# scene's ground, then a dark wet strip and a row of lit stones along the shore, then open water, shallow and light at the shore and darker toward the front
# glass in stepped bands, with staggered rows of ripple dashes and, in the wet and warm biomes, lily pads. The water takes a little of the biome's ground color.
#   <scene>-<S|M|L>-palu.png   the floor of that scene's paludarium (used in place of <scene>-<size>-floor.png)
# Usage: python3 -I tools/pixelpaluscene.py [outdir] [--sheet sheet.png]   (default sprites/vivscene; the sheet is a x4 view of a few)
import sys, os, zlib, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from pixelvivscene import SIZES, dims, mix, ramp, shade, ell, floor, palette, scenes, BIOMES, WATER

WET = .5   # PALU.water: the share of the floor, from the front, under water
PADS = {"wetland":.5, "tropical":.35, "temperate":.15}   # lily pads: how likely each grid cell of open water has one
LEAF = ramp((70, 120, 52))

def palu(era, biome, size):
    c = floor(era, biome, size); W, _, F = dims(size); P = palette(era, biome); G = P["ground"]
    rng = random.Random(zlib.crc32(f"{era}-{biome}-{size}-palu".encode()))
    y0 = round(F * (1 - WET))   # the first row of water
    R = ramp(mix(WATER["mid"], BIOMES[biome]["ground"], .25))
    for y in range(y0 - 3, F):
        for x in range(W):
            if y < y0 - 1: c.put(x, y, G["lo"] if (x + y) % 4 else G["deep"])   # wet ground just above the waterline
            elif y < y0 + 1:   # the shore: a row of stones, lit on top, with dark water between
                k = (x + (y - y0) * 3) % 5
                c.put(x, y, P["stone"]["hi"] if k == 0 and y == y0 - 1 else P["stone"]["mid"] if k < 3 else R["deep"])
            else:   # open water in stepped bands, lighter at the shore, with rows of ripple dashes
                t = min(3, (y - y0) * 4 // max(1, F - y0)); base = [R["hi"], R["mid"], R["mid"], R["lo"]][t]
                dash = (y - y0) % 3 == 2 and (x + (y // 3) * 5) % 9 < 3
                c.put(x, y, mix(base, (255, 255, 255), .3) if dash and t < 2 else R["hi"] if dash else base)
    p = PADS.get(biome, 0)
    if p:
        for gy in range(y0 + 2, F - 2, 5):
            for gx in range(0, W - 4, 8):
                if rng.random() < p:
                    x, y = gx + rng.randrange(1, 5), gy + rng.randrange(0, 2)
                    pad = ell(x, y, 2.4, 1.3); shade(c, pad, LEAF, False)
                    c.put(x + 1, y, R["mid"]); c.put(x + 2, y, R["mid"])   # the notch
                    if rng.random() < .25: c.put(x - 1, y - 1, (240, 196, 218))   # a flower
    return c

if __name__ == "__main__":
    args = sys.argv[1:]
    sheet = args[args.index("--sheet") + 1] if "--sheet" in args else None
    if sheet: del args[args.index("--sheet"):args.index("--sheet") + 2]
    out = args[0] if args else "sprites/vivscene"
    os.makedirs(out, exist_ok=True)
    picks = []
    for era, biome in scenes():
        for size in SIZES:
            im = palu(era, biome, size).img()
            im.convert("RGB").convert("P", palette=Image.ADAPTIVE, colors=32).save(os.path.join(out, f"{era}-{biome}-{size}-palu.png"), optimize=True)
            if size == "M" and biome in ("wetland", "tropical", "desert", "tundra"): picks.append(im)
    if sheet:
        Z, pad = 4, 4; w, h = picks[0].size
        im = Image.new("RGBA", ((w + pad) * 4 * Z + pad * Z, ((h + pad) * ((len(picks) + 3) // 4)) * Z + pad * Z), (40, 44, 48, 255))
        for i, p in enumerate(picks):
            im.alpha_composite(p.resize((w * Z, h * Z), Image.NEAREST), ((pad + (i % 4) * (w + pad)) * Z, (pad + (i // 4) * (h + pad)) * Z))
        im.save(sheet)
    print(len(scenes()) * len(SIZES), "paludarium floors")
