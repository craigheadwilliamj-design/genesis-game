"""Place GHOST timeline sites on the maps by plate reconstruction.

Usage: python3 tools/timeline/placesites.py <paleodem dir>
Needs pygplates (on PyPI) and the PALEOMAP plate model from "PALEOMAP PaleoAtlas for GPlates",
https://zenodo.org/records/10596610 (CC BY 4.0): unzip PALEOMAP_PlateModel.rot and PALEOMAP_PlatePolygons.gpml from it
anywhere under the folder passed in. Each site's modern latitude and longitude is assigned to its plate, rotated back
to the age of every map its time window touches (the same age genmaps.py drew that map at), and projected to that
map's pixel. Prints the `at` entries to paste into SITES in index.html.
"""
import glob, math, os, sys
import pygplates
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from genmaps import MAPS, W, H

# Epochs (name, from Ma, to Ma, period) and which map each shows, as index.html's EPOCHS and mapOf.
EPOCHS = [("Early Devonian", 419.6, 393.3, "Devonian"), ("Middle Devonian", 393.3, 382.7, "Devonian"), ("Late Devonian", 382.7, 358.9, "Devonian")]
MAP_OF = {"Devonian": "devonian"}

# id: (modern lat, modern lon, from Ma, to Ma)
SITES = {
    "fram": (77.2, -86.0, 378, 372),        # Fram Formation, Ellesmere Island
    "britta": (72.9, -23.6, 367, 360),      # Britta Dal Formation, East Greenland
}

def pixel(lat, lon):
    """Latitude and longitude in degrees to a pixel on the 130 x 65 Mollweide map."""
    phi, lam = math.radians(lat), math.radians(lon)
    t = phi
    for _ in range(50):
        if abs(math.cos(t)) < 1e-9: break
        t -= (2 * t + math.sin(2 * t) - math.pi * math.sin(phi)) / (2 + 2 * math.cos(2 * t))
    x = 2 * math.sqrt(2) / math.pi * lam * math.cos(t)
    y = math.sqrt(2) * math.sin(t)
    return int((x / (2 * math.sqrt(2)) + 1) / 2 * W), int((1 - y / math.sqrt(2)) / 2 * H)

def main():
    if len(sys.argv) < 2: sys.exit(__doc__)
    find = lambda pat: glob.glob(os.path.join(sys.argv[1], "**", pat), recursive=True)[0]
    rot = pygplates.RotationModel(find("PALEOMAP_PlateModel.rot"))
    plates = pygplates.FeatureCollection(find("PALEOMAP_PlatePolygons.gpml"))
    for sid, (lat, lon, frm, to) in SITES.items():
        feat = pygplates.Feature()
        feat.set_geometry(pygplates.PointOnSphere(lat, lon))
        feat = pygplates.partition_into_plates(plates, rot, [feat])[0]
        at = {}
        for name, a, b, period in EPOCHS:
            if not (frm > b and to < a): continue
            m = MAP_OF.get(name) or MAP_OF.get(period)
            age = MAPS[m][0]
            rec = []
            pygplates.reconstruct(feat, rot, rec, age)
            plat, plon = rec[0].get_reconstructed_geometry().to_lat_lon()
            at[m] = list(pixel(plat, plon))
        print(f'{sid}: plate {feat.get_reconstruction_plate_id()}, at:{at}')

if __name__ == "__main__":
    main()
