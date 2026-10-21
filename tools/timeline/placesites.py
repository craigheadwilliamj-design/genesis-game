"""Place the GHOST timeline sites on the maps by plate reconstruction and write them into index.html.

Usage: python3 tools/timeline/placesites.py <paleodem dir>
Needs pygplates (on PyPI) and the PALEOMAP plate model from "PALEOMAP PaleoAtlas for GPlates",
https://zenodo.org/records/10596610 (CC BY 4.0): unzip PALEOMAP_PlateModel.rot and PALEOMAP_PlatePolygons.gpml from it
anywhere under the folder passed in.

Sites and event sites come from sites.py. Each one's modern latitude and longitude is assigned to its plate, rotated back
to the age of every map its time window touches (the age genmaps.py drew that map at) and projected to that map's pixel;
markers sharing a map are then nudged apart so none touch. Epochs and which map each shows are read from js/data.js
(TIMELINE, TIMELINE_MAPS), as are species names, sizes and stars and each period's trip cost, days and risk.
It rewrites the TIME_SITES table in js/data.js (between TIME_SITES:BEGIN and TIME_SITES:END) for the game, and the SITES
block of index.html for the prototype (animal sites only). It stops if a species is at no site or a site holds a species
from another period.
"""
import glob, math, os, re, sys
import pygplates
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from genmaps import MAPS as MAP_AGES, W, H
from sites import SITES, EVENTS
PAGE = os.path.join(HERE, "index.html")
DATA = os.path.join(HERE, "..", "..", "js", "data.js")

def timeline_tables(js):
    """Epochs as (name, from Ma, to Ma, period) and the epoch-or-period -> map table, from data.js."""
    js = js[js.index("const TIMELINE = ["):]
    periods = re.findall(r'\{id:"(\w+)", epochs:\[(.*?)\]\}', js[:js.index("];")])
    flat = [(name, float(start) / 1e6, pid) for pid, body in periods for name, start in re.findall(r'\["([^"]+)",([\d.e]+)\]', body)]
    epochs = [(n, a, flat[i + 1][1] if i + 1 < len(flat) else 0, p) for i, (n, a, p) in enumerate(flat)]
    block = re.search(r"const TIMELINE_MAPS = \{(.*?)\};", js, re.S).group(1)
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

SEP = 7   # marker frames are 6 px, so centres this far apart (on either axis) leave a 1 px gap

def inside(x, y):
    """Clear of the 2 px rim, with room for the 6 px frame."""
    return ((x + 1 - W / 2) / (W / 2 - 6)) ** 2 + ((y + 1 - H / 2) / (H / 2 - 6)) ** 2 <= 1

def spread(spots):
    """Nudge markers on one map apart until no two frames touch. spots: {site id: [x, y]}, changed in place.
    Accuracy takes a small hit for legibility; returns the furthest any marker moved, in px."""
    start = {k: tuple(v) for k, v in spots.items()}
    ids = sorted(spots)
    for _ in range(500):
        moved = False
        for i, a in enumerate(ids):
            for b in ids[i + 1:]:
                (ax, ay), (bx, by) = spots[a], spots[b]
                dx, dy = bx - ax, by - ay
                if max(abs(dx), abs(dy)) >= SEP: continue
                # push apart along the axis they're already further apart on (x on a tie), a pixel each
                if abs(dx) >= abs(dy):
                    s = 1 if dx > 0 or (dx == 0 and a < b) else -1
                    for k, d in ((a, -s), (b, s)):
                        if inside(spots[k][0] + d, spots[k][1]): spots[k][0] += d
                else:
                    s = 1 if dy > 0 else -1
                    for k, d in ((a, -s), (b, s)):
                        if inside(spots[k][0], spots[k][1] + d): spots[k][1] += d
                moved = True
        if not moved: break
    else:
        sys.exit("Couldn't spread the markers apart")
    return max((math.hypot(spots[k][0] - x, spots[k][1] - y) for k, (x, y) in start.items()), default=0)

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
    html, js = open(PAGE).read(), open(DATA).read()
    epochs, map_of = timeline_tables(js)
    species, trips = game_tables()
    problems, used, placed = [], set(), []
    sites = {**{k: v + (None,) for k, v in SITES.items()}, **{k: (n, w, la, lo, f, t, [], ev) for k, (ev, n, w, la, lo, f, t) in EVENTS.items()}}
    for sid, (name, where, lat, lon, frm, to, fauna, event) in sites.items():
        touched = [e for e in epochs if frm > e[2] and to < e[1]]
        period = next((e[3] for e in epochs if e[1] >= frm > e[2]), None)   # None: older than the slider (Deep Time events)
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
            at[m] = list(pixel(*rec[0].get_reconstructed_geometry().to_lat_lon()))
        placed.append((sid, name, where, frm, to, fauna, period, at, event))
    # sites sharing a map are spread so their markers never touch
    for m in sorted({m for p in placed for m in p[7]}):
        spots = {p[0]: p[7][m] for p in placed if m in p[7]}
        far = spread(spots)
        if far: print(f"{m:18} {len(spots):2} sites, moved up to {far:.0f} px")
    rows, game = [], []
    for sid, name, where, frm, to, fauna, period, at, event in placed:
        spots = ", ".join(f'"{k}":[{x}, {y}]' if "-" in k else f"{k}:[{x}, {y}]" for k, (x, y) in at.items())
        game.append(f'  {{id:"{sid}", name:"{name}", where:"{where}", from:{years(frm)}, to:{years(to)}, at:{{{spots}}}, '
                    + (f'event:"{event}"}},' if event else f'fauna:[{", ".join(chr(34) + f + chr(34) for f in fauna)}]}},'))
        if event: continue
        trip, days, risk = trips[period]
        animals = ", ".join(f'{{name:"{species[f]["name"]}", space:{num(species[f]["space"])}, stars:{num(species[f]["stars"])}}}' for f in fauna if f in species)
        rows.append(f'  {{id:"{sid}", name:"{name}", where:"{where}", from:{years(frm)}, to:{years(to)}, at:{{{spots}}}, '
                    f'fauna:[{animals}], trip:{trip}, days:{num(days)}, risk:{num(risk)}}},')
    problems += [f"{species[f]['name']} ({f}) is at no site" for f in species if f not in used]
    if problems: sys.exit("\n".join(problems))
    block = "// SITES:BEGIN written by placesites.py from sites.py; edit those, not this.\nconst SITES = [\n" + "\n".join(rows) + "\n];\n// SITES:END"
    html = re.sub(r"// SITES:BEGIN.*?// SITES:END", lambda _: block, html, flags=re.S)
    open(PAGE, "w").write(html)
    table = "// TIME_SITES:BEGIN written by tools/timeline/placesites.py from sites.py; edit those, not this.\nconst TIME_SITES = [\n" + "\n".join(game) + "\n];\n// TIME_SITES:END"
    js = re.sub(r"// TIME_SITES:BEGIN.*?// TIME_SITES:END", lambda _: table, js, flags=re.S)
    open(DATA, "w").write(js)
    print(f"{len(rows)} sites, {len(game) - len(rows)} event sites, {len(used)} species")

if __name__ == "__main__":
    main()
