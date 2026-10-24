"""Draft the GHOST timeline maps from the PALEOMAP PaleoDEMs.

Usage: python3 tools/timeline/genmaps.py <paleodem dir>
Needs numpy, h5py and Pillow. The DEMs are Scotese & Wright 2018, "PALEOMAP Paleodigital Elevation Models
(PaleoDEMS) for the Phanerozoic", https://zenodo.org/records/5460860 (CC BY 4.0): unzip the 1x1 degree netCDF set
and pass its folder.

Each map is 260 x 130 px, a Mollweide ellipse with a 2 px navy rim, in one flat palette: deep ocean, shallow sea (shelf above -200 m), land (bare grey-tan rock before land plants), mountains (the top 8% of each map's land,
at least 900 m), desert (land in the dry belts: 3 px from the sea at 20 to 30 degrees, needing more distance the further out of that band,
so deserts swell in continental interiors) and ice (by hand-set rules
per map below, since the DEMs carry none). These are drafts: tidy them in the pixel editor.
"""
import glob, math, os, sys
from collections import deque
import h5py
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "maps")                                       # the prototype's copy
GAME = os.path.join(HERE, "..", "..", "sprites", "timeline")           # the game's (run tools/packsprites.py after)
W, H = 260, 130
S = W / 130   # distances below are tuned in 130 px map pixels
PAL = {
    "rim": (0x1A, 0x2B, 0x4C), "deep": (0x1B, 0x60, 0xB8), "shallow": (0x4C, 0x8F, 0xD8), "land": (0x03, 0xA7, 0x22),
    "barren": (0xA8, 0x94, 0x78), "moss": (0x7F, 0x9A, 0x52), "mountain": (0x8B, 0x6B, 0x43), "desert": (0xD9, 0xC2, 0x7A), "ice": (0xEA, 0xF2, 0xF8),
}

# Ice rules: (lat, lon, px from the sea) -> True where land is under ice. Paleo coordinates, as the DEM for that age
# has them. Ice reaches further from the pole inland, so sheet edges aren't straight lines of latitude.
inland = lambda d: min(d / S, 6) * 2 - 4
south = lambda lim: lambda la, lo, d: la < lim + inland(d)
def lgm(la, lo, d):   # last glacial maximum, modern coordinates
    return (la < -60 or (la > 60 and -75 < lo < -10)                                     # Antarctica, Greenland
            or (-140 < lo < -52 and la > 40 - inland(d) + max(0, -lo - 110) * .5)       # Laurentide and Cordilleran (Alaska clear)
            or (-11 < lo < 70 and la > 52 - inland(d) + max(0, lo - 25) * .5))          # Scandinavian and British, thinning east
def today(la, lo, d):
    return la < -60 or (la > 60 and -75 < lo < -10)

# Maps from before land plants: the land is bare rock (PAL "barren"), not green.
BARREN = {"cambrian", "ordovician", "silurian"}
MOSS = {"silurian": 5}   # the first plants hugged the shore: barren land within this many px of the sea is moss, easing into the Devonian's green

# name: (age in Ma of the DEM, sea level shift in m, ice rule or None)
MAPS = {
    "cambrian": (510, 0, None),
    "ordovician": (450, 0, south(-65)),
    "silurian": (430, 0, None),
    "devonian": (375, 0, None),
    "carboniferous": (310, 0, south(-50)),
    "permian": (270, 0, south(-75)),
    "triassic": (220, 0, None),
    "jurassic-early": (190, 0, None),
    "jurassic": (170, 0, None),
    "jurassic-late": (150, 0, None),
    "cretaceous-early": (125, 0, None),
    "cretaceous-late": (75, 0, None),
    "paleogene": (50, 0, None),
    "neogene": (15, 0, south(-65)),
    "pleistocene": (0, -120, lgm),
    "holocene": (0, 0, today),
}

def dem(folder, age):
    for f in glob.glob(os.path.join(folder, "**", "*.nc"), recursive=True):
        tail = os.path.basename(f).rsplit("_", 1)[-1]
        if tail == f"{age}Ma.nc":
            with h5py.File(f) as h:
                return h["lat"][:], h["lon"][:], h["z"][:]
    sys.exit(f"No PaleoDEM for {age} Ma in {folder}")

def lat_lon(px, py):
    """Pixel position (can be fractional) to latitude and longitude in degrees, or None outside the ellipse (Mollweide)."""
    x = (px / W * 2 - 1) * 2 * math.sqrt(2)
    y = (1 - py / H * 2) * math.sqrt(2)
    if abs(y) >= math.sqrt(2): return None
    t = math.asin(y / math.sqrt(2))
    lam = math.pi * x / (2 * math.sqrt(2) * math.cos(t))
    if abs(lam) > math.pi: return None
    phi = math.asin((2 * t + math.sin(2 * t)) / math.pi)
    return math.degrees(phi), math.degrees(lam)

def build(name, age, sea, ice, mask, folder):
    lats, lons, z = dem(folder, age)
    land_z = z[z > sea]
    mtn = max(900, float(np.percentile(land_z, 92)))
    N = 4   # supersamples a side
    kind, elev, where = {}, {}, {}
    for py in range(H):
        for px in range(W):
            if mask[py][px] != "in": continue
            zs, ll = [], []
            for i in range(N):
                for j in range(N):
                    p = lat_lon(px + (i + .5) / N, py + (j + .5) / N)
                    if p: zs.append(z[int(round(p[0])) + 90, int(round(p[1])) + 180]); ll.append(p)
            if not zs: p = lat_lon(px + .5, py + .5) or (0, 0); zs = [z[int(round(p[0])) + 90, int(round(p[1])) + 180]]; ll = [p]
            zs = np.array(zs)
            nl, ns = (zs > sea).sum(), ((zs > sea - 200) & (zs <= sea)).sum()
            nd = len(zs) - nl - ns
            # land needs a majority of the samples, so narrow seaways (the Western Interior Seaway) stay open
            kind[px, py] = "land" if nl > len(zs) / 2 else "shallow" if ns >= nd or ns + nl > len(zs) / 2 else "deep"
            elev[px, py] = float(zs[zs > sea].mean()) if nl else 0
            where[px, py] = (float(np.mean([a for a, b in ll])), ll[len(ll) // 2][1])
    # distance from the sea, in pixels, for deserts
    dist = {k: (0 if v != "land" else None) for k, v in kind.items()}
    q = deque(k for k, v in dist.items() if v == 0)
    while q:
        x, y = q.popleft()
        for n in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if n in dist and dist[n] is None: dist[n] = dist[x, y] + 1; q.append(n)
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for py in range(H):
        for px in range(W):
            m = mask[py][px]
            if m == "rim": img.putpixel((px, py), PAL["rim"] + (255,)); continue
            if m != "in": continue
            k = kind[px, py]
            if k == "land":
                la, lo = where[px, py]
                if ice and ice(la, lo, dist[px, py] or 0): k = "ice"
                elif elev[px, py] > mtn: k = "mountain"
                elif (dist[px, py] or 0) >= (3 + max(0, abs(abs(la) - 25) - 5) / 2.5) * S: k = "desert"
            if k == "land" and name in BARREN: k = "moss" if (dist[px, py] or 0) <= MOSS.get(name, 0) else "barren"
            img.putpixel((px, py), PAL[k] + (255,))
    img.save(os.path.join(OUT, name + ".png"))
    os.makedirs(GAME, exist_ok=True)
    img.save(os.path.join(GAME, name + ".png"))
    print(f"{name:18} {age:3} Ma  mountains above {mtn:.0f} m")

def main():
    if len(sys.argv) < 2: sys.exit(__doc__)
    inside = lambda x, y: ((x + .5) / W * 2 - 1) ** 2 + ((y + .5) / H * 2 - 1) ** 2 <= 1
    near_out = lambda x, y: any(not inside(x + i, y + j) for i in range(-2, 3) for j in range(-2, 3) if abs(i) + abs(j) <= 2)
    mask = [["out" if not inside(x, y) else "rim" if near_out(x, y) else "in" for x in range(W)] for y in range(H)]
    for name, (age, sea, ice) in MAPS.items():
        build(name, age, sea, ice, mask, sys.argv[1])

if __name__ == "__main__":
    main()
