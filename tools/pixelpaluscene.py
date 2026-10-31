# Draws the paludarium floors in the park style like the vivarium scenes (tools/pixelvivscene.py, whose edges it borrows): each vivarium scene's floor (tools/pixelvivscene.py) with its front half
# flooded, as a vivarium laid out as a paludarium has it (PALU.water in js/data.js). Seen from above like the rest of the floor: the bank at the back keeps the
# scene's ground, then a dark wet strip and a row of lit stones along the shore, then open water, shallow and light at the shore and darker toward the front
# glass in stepped bands, with staggered rows of ripple dashes and, in the wet and warm biomes, lily pads. The water takes a little of the biome's ground color.
#   <scene>-<S|M|L>-palu.png   the floor of that scene's paludarium (used in place of <scene>-<size>-floor.png)
# Usage: python3 -I tools/pixelpaluscene.py [outdir] [--sheet sheet.png]   (default sprites/vivscene; the sheet is a x4 view of a few)
import sys, os, zlib, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from pixelvivscene import SIZES, dims, mix, ramp, shade, edge, ell, floor, palette, scenes, BIOMES, WATER, U

WET = .5   # PALU.water: the share of the floor, from the front, under water
PADS = {"wetland":.5, "tropical":.35, "temperate":.15}   # lily pads: how likely each grid cell of open water has one
LEAF = ramp((70, 120, 52))

def palu(era, biome, size):
    c = floor(era, biome, size); W, _, F = dims(size); P = palette(era, biome); G = P["ground"]
    rng = random.Random(zlib.crc32(f"{era}-{biome}-{size}-palu".encode()))
    y0 = round(F * (1 - WET))   # the first row of water
    R = ramp(mix(WATER["mid"], BIOMES[biome]["ground"], .25))
    for y in range(y0 - 3 * U, F):
        for x in range(W):
            if y < y0 - U: c.put(x, y, G["deep"] if (x + y // 2 * 3) % 7 == 0 else G["lo"])   # wet ground just above the waterline
            elif y < y0 + U: c.put(x, y, R["deep"])   # dark water between the shore stones
            else:   # open water in stepped bands, lighter at the shore, with staggered rows of ripple dashes
                t = min(3, (y - y0) * 4 // max(1, F - y0)); base = [R["hi"], R["mid"], R["mid"], R["lo"]][t]
                dash = (y - y0) % 6 == 4 and (x + ((y - y0) // 6) * 7) % 16 < 5
                c.put(x, y, mix(base, (255, 255, 255), .3) if dash and t < 2 else R["hi"] if dash else base)
    S = P["stone"]
    for x in range(0, W, round(1.6 * U)):   # the shore: a row of stones, lit on top, each with its edge
        m = ell(x + U * .8, y0, U * rng.uniform(.7, 1), U * .75); edge(c, m, S["edge"]); shade(c, m, S, False)
    p = PADS.get(biome, 0)
    if p:
        for gy in range(y0 + 2 * U, F - 2 * U, 5 * U):
            for gx in range(0, W - 4 * U, 8 * U):
                if rng.random() < p:
                    x, y = gx + rng.randrange(U, 5 * U), gy + rng.randrange(0, 2 * U)
                    pad = ell(x, y, 2.4 * U, 1.3 * U) - {(x + k, y + j) for k in range(0, 3 * U) for j in range(-abs(k) // 3, abs(k) // 3 + 1)}   # a pad with its notch cut in
                    edge(c, pad, LEAF["edge"]); shade(c, pad, LEAF, False)
                    for k in range(1, 2 * U): c.put(x - k, y, LEAF["lo"])   # a vein
                    if rng.random() < .25: fl = ell(x - U, y - U, U * .7, U * .5); edge(c, fl, (150, 80, 110)); [c.put(a, b_, (240, 196, 218)) for a, b_ in fl]; c.put(x - U, y - U, (250, 230, 120))   # a flower
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
            im.convert("RGB").convert("P", palette=Image.ADAPTIVE, colors=48).save(os.path.join(out, f"{era}-{biome}-{size}-palu.png"), optimize=True)
            if size == "M" and biome in ("wetland", "tropical", "desert", "tundra"): picks.append(im)
    if sheet:
        Z, pad = 2, 4 * U; w, h = picks[0].size
        im = Image.new("RGBA", ((w + pad) * 4 * Z + pad * Z, ((h + pad) * ((len(picks) + 3) // 4)) * Z + pad * Z), (40, 44, 48, 255))
        for i, p in enumerate(picks):
            im.alpha_composite(p.resize((w * Z, h * Z), Image.NEAREST), ((pad + (i % 4) * (w + pad)) * Z, (pad + (i // 4) * (h + pad)) * Z))
        im.save(sheet)
    print(len(scenes()) * len(SIZES), "paludarium floors")
