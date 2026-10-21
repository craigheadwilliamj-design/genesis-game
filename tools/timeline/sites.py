"""GHOST timeline sites: real fossil localities (or, for the recently extinct, historical ranges).

id: (name, where, modern lat, modern lon, from Ma, to Ma, [species ids from js/data.js])
Coordinates are approximate (to a degree or so, plenty for a 260 px world map). Windows are when the site's animals
lived there, rounded; for the Holocene they are in Ma too (0.000362 is 362 years ago).
"""
SITES = {
    # Devonian
    "fram":        ("Fram Formation", "Ellesmere Island, Canada", 77.2, -86.0, 378, 372, ["tikt"]),
    "britta":      ("Britta Dal Formation", "East Greenland", 72.9, -23.6, 367, 360, ["icht"]),
    # Carboniferous
    "ekirkton":    ("East Kirkton", "West Lothian, Scotland", 55.9, -3.6, 336, 334, ["pulm"]),
    "joggins":     ("Joggins Fossil Cliffs", "Nova Scotia, Canada", 45.7, -64.4, 315, 312, ["hylo", "arth"]),
    "nyrany":      ("Nýřany", "Bohemia, Czechia", 49.7, 13.2, 308, 306, ["mibr"]),
    "commentry":   ("Commentry", "Allier, France", 46.3, 2.7, 302, 300, ["mega"]),
    "pennredbeds": ("Late Pennsylvanian red beds", "Texas and New Mexico, USA", 34.5, -104.0, 304, 299.5, ["dcau", "eryo"]),
    # Permian
    "elcobre":     ("El Cobre Canyon", "New Mexico, USA", 36.2, -106.6, 298, 293, ["plhy"]),
    "texasred":    ("Texas Red Beds", "Texas, USA", 33.6, -99.3, 290, 275, ["dime", "seym"]),
    "hennessey":   ("Hennessey Formation", "Oklahoma, USA", 35.4, -97.5, 276, 272, ["coty"]),
    "pedrafogo":   ("Pedra de Fogo Formation", "Maranhão, Brazil", -7.0, -46.0, 280, 272, ["prio"]),
    "ocher":       ("Ocher", "Perm Krai, Russia", 57.9, 54.7, 268, 265, ["este"]),
    "karootapino": ("Karoo, Tapinocephalus Zone", "Western Cape, South Africa", -32.3, 22.6, 265, 260, ["mosc", "ante"]),
    "karoolate":   ("Karoo, Daptocephalus Zone", "Eastern Cape, South Africa", -32.2, 24.5, 256, 252.2, ["diic", "lyst"]),
    "dvina":       ("Sokolki, Northern Dvina", "Arkhangelsk, Russia", 62.0, 45.0, 255, 253, ["scut", "inos"]),
    # Triassic
    "burgersdorp": ("Burgersdorp Formation", "Eastern Cape, South Africa", -31.0, 26.3, 247.5, 247, ["eryt"]),
    "madygen":     ("Madygen Formation", "Batken, Kyrgyzstan", 39.9, 69.7, 236, 232, ["shar", "long", "gigt"]),
    "ischigualasto": ("Ischigualasto Formation", "San Juan, Argentina", -30.0, -67.9, 231, 226, ["herr"]),
    "krasiejow":   ("Krasiejów", "Opole, Poland", 50.7, 18.3, 230, 225, ["sile"]),
    "chinle":      ("Chinle Formation", "Petrified Forest, Arizona, USA", 34.9, -109.8, 225, 208, ["post", "desm"]),
    "trossingen":  ("Trossingen", "Baden-Württemberg, Germany", 48.1, 8.6, 214, 208, ["plat"]),
    "ghostranch":  ("Ghost Ranch", "New Mexico, USA", 36.3, -106.5, 212, 206, ["coel"]),
    "lisowice":    ("Lisowice", "Silesia, Poland", 50.8, 18.9, 208, 202, ["liso"]),
    # Jurassic
    "dorset":      ("Dorset Coast", "Lyme Regis, England", 50.7, -2.9, 199, 190, ["dimo", "scel"]),
    "elliot":      ("Elliot Formation", "Eastern Cape, South Africa", -30.7, 27.8, 200, 190, ["hete"]),
    "kayenta":     ("Kayenta Formation", "Arizona, USA", 36.5, -111.3, 196, 183, ["dilo"]),
    "hanson":      ("Hanson Formation", "Mount Kirkpatrick, Antarctica", -84.4, 165.0, 194, 188, ["cryo"]),
    "stonesfield": ("Stonesfield Slate", "Oxfordshire, England", 51.9, -1.4, 168, 166, ["mgal"]),
    "daohugou":    ("Daohugou and Tiaojishan", "Liaoning and Hebei, China", 41.3, 119.2, 165, 158, ["anch", "yiqi", "scan"]),
    "morrison":    ("Morrison Formation", "Wyoming, Colorado and Utah, USA", 41.9, -106.2, 156, 147, ["allo", "steg", "cera", "torv", "orni", "dryo", "cama", "apat", "dipl", "brac"]),
    "tendaguru":   ("Tendaguru", "Lindi, Tanzania", -9.7, 39.2, 155, 150, ["kent", "dryo"]),
    "solnhofen":   ("Solnhofen Limestone", "Bavaria, Germany", 48.9, 11.0, 151, 150, ["arch", "comp"]),
    # Cretaceous
    "cedarmtn":    ("Cedar Mountain Formation", "Utah, USA", 39.0, -110.2, 135, 125, ["utah"]),
    "wealden":     ("Wealden Group", "Isle of Wight, England", 50.6, -1.4, 130, 125, ["hyps", "igua", "bary"]),
    "lashoyas":    ("Las Hoyas", "Cuenca, Spain", 40.2, -2.0, 127, 125, ["conc"]),
    "yixian":      ("Yixian Formation", "Liaoning, China", 41.6, 120.8, 125, 120, ["micr", "yutt", "psit"]),
    "victoria":    ("Strzelecki and Bungil Formations", "Victoria and Queensland, Australia", -38.6, 145.7, 125, 110, ["kool", "minm"]),
    "elrhaz":      ("Elrhaz Formation", "Gadoufaoua, Niger", 17.5, 8.9, 115, 110, ["nige"]),
    "cerrobarcino": ("Cerro Barcino Formation", "Chubut, Argentina", -43.5, -69.0, 102, 101, ["pata"]),
    "kemkem":      ("Kem Kem Beds", "Morocco", 31.0, -4.0, 100, 94, ["spin", "carc"]),
    "niobrara":    ("Niobrara Chalk", "Kansas, USA", 38.9, -100.8, 87, 82, ["pter"]),
    "aguja":       ("Aguja Formation", "Big Bend, Texas, USA", 29.3, -103.3, 80, 75, ["dsuc"]),
    "dinopark":    ("Dinosaur Park Formation", "Alberta, Canada", 50.8, -111.5, 77, 75, ["styr", "para"]),
    "djadokhta":   ("Djadokhta Formation", "Gobi Desert, Mongolia", 44.2, 103.7, 75, 71, ["velo", "prot", "ovir", "mcer"]),
    "lacolonia":   ("La Colonia Formation", "Chubut, Argentina", -43.6, -68.4, 72, 69, ["cnot"]),
    "nemegt":      ("Nemegt Formation", "Gobi Desert, Mongolia", 43.5, 101.0, 70, 68, ["gall", "ther", "dche", "mono"]),
    "maevarano":   ("Maevarano Formation", "Mahajanga, Madagascar", -15.9, 46.6, 70, 66.1, ["beel", "simo"]),
    "javelina":    ("Javelina Formation", "Big Bend, Texas, USA", 29.2, -103.5, 69, 66.1, ["quet"]),
    "hellcreek":   ("Hell Creek Formation", "Montana, USA", 47.6, -106.6, 67, 66.1, ["trex", "tric", "anky", "pach", "ornm"]),
    # Paleogene
    "waipara":     ("Waipara Greensand", "Canterbury, New Zealand", -43.0, 172.8, 62, 60, ["waim"]),
    "fortunion":   ("Fort Union Formation", "Montana, USA", 46.0, -104.5, 62, 57, ["ptil", "ples"]),
    "cerrejon":    ("Cerrejón Formation", "La Guajira, Colombia", 11.1, -72.6, 60, 58, ["tita"]),
    "bighorn":     ("Bighorn Basin", "Wyoming, USA", 44.5, -108.0, 56, 54, ["sifr", "miac"]),
    "kuldana":     ("Kuldana Formation", "Kohat, Pakistan", 33.5, 71.4, 50, 47, ["paki", "ambu"]),
    "bridger":     ("Bridger and Uinta Basins", "Wyoming and Utah, USA", 41.3, -110.3, 50, 44, ["uint"]),
    "messel":      ("Messel Pit", "Hesse, Germany", 49.9, 8.8, 48, 47, ["lept", "tmyr"]),
    "irdinmanha":  ("Irdin Manha Formation", "Inner Mongolia, China", 43.6, 112.0, 45, 40, ["andr"]),
    "venezuela":   ("Parángula Formation", "Barinas, Venezuela", 8.6, -70.2, 45, 36, ["bari"]),
    "fayum":       ("Fayum Depression", "Egypt", 29.5, 30.6, 37, 30, ["arsi"]),
    "whiteriver":  ("White River Badlands", "South Dakota, USA", 43.8, -102.3, 34, 30, ["hyae"]),
    "bugti":       ("Dera Bugti", "Balochistan, Pakistan", 29.0, 69.1, 28, 23.1, ["pcer"]),
    # Neogene
    "agate":       ("Nebraska Miocene beds", "Agate Fossil Beds, Nebraska, USA", 42.4, -103.8, 22, 15, ["daeo", "aepy", "amph"]),
    "rusinga":     ("Rusinga Island", "Lake Victoria, Kenya", -0.4, 34.2, 18, 17, ["proc"]),
    "patagonia":   ("Santa Cruz and Collón Curá Formations", "Patagonia, Argentina", -45.0, -69.5, 18, 14, ["psil", "kele"]),
    "tunggur":     ("Tunggur Formation", "Inner Mongolia, China", 42.4, 112.9, 13, 11, ["plty", "chal"]),
    "epecuen":     ("Epecuén Formation", "La Pampa, Argentina", -37.1, -62.8, 9, 6, ["arge"]),
    "alcoota":     ("Alcoota", "Northern Territory, Australia", -22.9, 134.4, 8, 7, ["drom"]),
    "gargano":     ("Gargano", "Apulia, Italy", 41.8, 15.9, 7, 5.4, ["dgal", "hopl"]),
    "menorca":     ("Menorca", "Balearic Islands, Spain", 40.0, 4.1, 5, 3, ["nura"]),
    "siwaliks":    ("Siwalik Hills", "India and Pakistan", 32.9, 73.0, 5, 2.6, ["siva", "mchl"]),
    "cradle":      ("Cradle of Humankind", "Gauteng, South Africa", -25.9, 27.7, 3.0, 2.6, ["dino"]),
    # Pleistocene
    "guangxi":     ("Guangxi caves", "Guangxi, China", 24.0, 109.0, 2.0, 0.3, ["gpit"]),
    "pampas":      ("The Pampas", "Buenos Aires, Argentina", -35.0, -60.0, 0.5, 0.012, ["mgth", "doed", "macr", "smil"]),
    "naracoorte":  ("Naracoorte Caves", "South Australia", -37.0, 140.8, 0.5, 0.04, ["thyl", "mlan"]),
    "sicily":      ("Sicily", "Italy", 37.5, 14.0, 0.5, 0.2, ["sdel"]),
    "steppe":      ("Mammoth Steppe", "Northern Eurasia", 55.0, 60.0, 0.3, 0.012, ["mamm", "elas", "mglo"]),
    "cuba":        ("Cuba", "Caribbean", 22.0, -79.5, 0.1, 0.012, ["ornw"]),
    "labrea":      ("Rancho La Brea", "Los Angeles, California, USA", 34.1, -118.4, 0.05, 0.012, ["smil", "dire", "arct", "colm", "mast"]),
    # Holocene
    "madagascar":  ("Central Highlands", "Madagascar", -19.0, 47.0, 0.008, 0.002, ["aind"]),
    "mauritius":   ("Mauritius", "Indian Ocean, 1600s", -20.3, 57.6, 0.001, 0.000362, ["dodo"]),
    "eastna":      ("Eastern North America", "1800s", 40.0, -80.0, 0.0003, 0.000112, ["ppig"]),
    "plains":      ("Great Plains", "1870s", 41.0, -100.0, 0.0002, 0.000124, ["rmlo"]),
    "monteverde":  ("Monteverde Cloud Forest", "Costa Rica, 1980s", 10.3, -84.8, 0.0001, 0.000037, ["gtod"]),
}

# Museum events (MUSEUM_EVENTS in js/data.js) that sit on the map: id: (event id, name, where, lat, lon, from Ma, to Ma).
# They need no scouting; an expedition records them. The two older than the slider get no marker: GHOST lists them under
# Deep Time.
EVENTS = {
    "chengjiang": ("ev-cambrian", "Chengjiang", "Yunnan, China", 24.7, 102.9, 520, 515),
    "miguasha":   ("ev-tetrapods", "Miguasha", "Quebec, Canada", 48.1, -66.4, 381, 379),
    "traps":      ("ev-dying", "Siberian Traps", "Norilsk, Russia", 69.3, 88.2, 252.5, 251.9),
    "chicxulub":  ("ev-kpg", "Chicxulub", "Yucatán, Mexico", 21.4, -89.5, 66.1, 66.0),
    "hadean":     ("ev-hadean", "The young Earth", "Everywhere", 0, 0, 4500, 4400),
    "hamersley":  ("ev-oxygen", "Hamersley Basin", "Western Australia", -22.5, 118.0, 2450, 2300),
}
