"""Place the GHOST timeline sites on the maps by plate reconstruction and write them into index.html.

Usage: python3 tools/timeline/placesites.py <paleodem dir>
Needs pygplates (on PyPI) and the PALEOMAP plate model from "PALEOMAP PaleoAtlas for GPlates",
https://zenodo.org/records/10596610 (CC BY 4.0): unzip PALEOMAP_PlateModel.rot and PALEOMAP_PlatePolygons.gpml from it
anywhere under the folder passed in.

Sites come from sites.py. Each site's modern latitude and longitude is assigned to its plate, rotated back to the age of
every map its time window touches (the age genmaps.py drew that map at) and projected to that map's pixel. Epochs and
which map each shows are read from index.html (PERIODS, MAPS); species names, sizes and stars and each period's trip
cost, days and risk from js/data.js. The SITES block between the SITES:BEGIN and SITES:END lines of index.html is
rewritten. It stops if a species is missing from every site or a site holds a species from another period.
"""
import glob, math, os, re, sys
import pygplates
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from genmaps import MAPS as MAP_AGES, W, H
from sites import SITES
PAGE = os.path.join(HERE, "index.html")
DATA = os.path.join(HERE, "..", "..", "js", "data.js")

def page_tables(html):
    """Epochs as (name, from Ma, to Ma, period) and the epoch-or-period -> map table, from index.html."""
    periods = re.findall(r'\{id:"(\w+)", color:"#\w+", epochs:\[(.*?)\]\}', html)
    flat = [(name, float(start) / 1e6, pid) for pid, body in periods for name, start in re.findall(r'\["([^"]+)",([\d.e]+)\]', body)]
    epochs = [(n, a, flat[i + 1][1] if i + 1 < len(flat) else 0, p) for i, (n, a, p) in enumerate(flat)]
    block = re.search(r"const MAPS = \{(.*?)\};", html, re.S).group(1)
    maps = dict((k.strip('"'), v) for k, v in re.findall(r'("[^"]+"|\w+):"([\w-]+)"', block))
    return epochs, maps

def game_tables():
    js = open(DATA).read()
    species = {}
    for line in js[js.index("const SPECIES = ["):].split("\n"):
        m = re.search(r'\{id:"(\w+)", name:"([^"]+)", *period:"(\w+)".*?space:([\d.]+).*?stars:([\d.]+)', line)
        if m: species[m[1]] = {"name": m[2], "period": m[3], "space": float(m[4]), "stars": float(m[5])}
        if line.startswith("];"): break
    trips = {m[1]: (int(m[2]), float(m[3]), float(m[4])) for m in re.finditer(r'\{id:"(\w+)",.*?trip:(\d+),\s*days:([\d.]+),\s*risk:([\d.]+)\}', js)}
    return species, trips

def pixel(lat, lon):
    """Latitude and longitude in degrees to a pixel on the Mollweide map."""
    phi, lam = math.radians(lat), math.radians(lon)
    t = phi
    for _ in range(50):
        if abs(math.cos(t)) < 1e-9: break
        t -= (2 * t + math.sin(2 * t) - math.pi * math.sin(phi)) / (2 + 2 * math.cos(2 * t))
    x = 2 * math.sqrt(2) / math.pi * lam * math.cos(t)
    y = math.sqrt(2) * math.sin(t)
    return min(W - 1, int((x / (2 * math.sqrt(2)) + 1) / 2 * W)), min(H - 1, int((1 - y / math.sqrt(2)) / 2 * H))

def years(ma):
    y = round(ma * 1e6)
    return f"{y / 1e6:g}e6" if y >= 1e5 else str(y)

def num(x):
    return f"{x:g}".replace("0.", ".", 1) if 0 < x < 1 else f"{x:g}"

def main():
    if len(sys.argv) < 2: sys.exit(__doc__)
    find = lambda pat: glob.glob(os.path.join(sys.argv[1], "**", pat), recursive=True)[0]
    rot = pygplates.RotationModel(find("PALEOMAP_PlateModel.rot"))
    plates = pygplates.FeatureCollection(find("PALEOMAP_PlatePolygons.gpml"))
    html = open(PAGE).read()
    epochs, map_of = page_tables(html)
    species, trips = game_tables()
    problems, used, rows = [], set(), []
    for sid, (name, where, lat, lon, frm, to, fauna) in SITES.items():
        touched = [e for e in epochs if frm > e[2] and to < e[1]]
        period = next(e for e in epochs if e[1] >= frm > e[2])[3]
        for f in fauna:
            if f not in species: problems.append(f"{sid}: no species {f}"); continue
            used.add(f)
            if species[f]["period"] != period: problems.append(f"{sid}: {species[f]['name']} is {species[f]['period']}, the site is {period}")
        feat = pygplates.Feature()
        feat.set_geometry(pygplates.PointOnSphere(lat, lon))
        feat = pygplates.partition_into_plates(plates, rot, [feat])[0]
        at = {}
        for ename, a, b, p in touched:
            m = map_of.get(ename) or map_of.get(p)
            if not m or m in at: continue
            rec = []
            pygplates.reconstruct(feat, rot, rec, MAP_AGES[m][0])
            at[m] = pixel(*rec[0].get_reconstructed_geometry().to_lat_lon())
        trip, days, risk = trips[period]
        animals = ", ".join(f'{{name:"{species[f]["name"]}", space:{num(species[f]["space"])}, stars:{num(species[f]["stars"])}}}' for f in fauna if f in species)
        spots = ", ".join(f'"{k}":[{x}, {y}]' if "-" in k else f"{k}:[{x}, {y}]" for k, (x, y) in at.items())
        rows.append(f'  {{id:"{sid}", name:"{name}", where:"{where}", from:{years(frm)}, to:{years(to)}, at:{{{spots}}}, '
                    f'fauna:[{animals}], trip:{trip}, days:{num(days)}, risk:{num(risk)}}},')
    problems += [f"{species[f]['name']} ({f}) is at no site" for f in species if f not in used]
    if problems: sys.exit("\n".join(problems))
    block = "// SITES:BEGIN written by placesites.py from sites.py; edit those, not this.\nconst SITES = [\n" + "\n".join(rows) + "\n];\n// SITES:END"
    html = re.sub(r"// SITES:BEGIN.*?// SITES:END", lambda _: block, html, flags=re.S)
    open(PAGE, "w").write(html)
    print(f"{len(rows)} sites, {len(used)} species")

if __name__ == "__main__":
    main()
