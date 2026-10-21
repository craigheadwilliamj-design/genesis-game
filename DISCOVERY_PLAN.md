# Discovery rework plan: GHOST timeline, sites and drones

Status: built into the game (science.js, scienceui.js, data.js `TIMELINE`/`TIME_SITES`/`DRONES`/`GHOST_MK`, save migration in sim.js). The maps are still drafts that want a tidy in the pixel editor (`sprites/timeline/`, then `tools/packsprites.py`).

Replaces "ORACLE unlocks a species, then GHOST trips to a period fill its genome" with a map of the past: a time slider, real fossil sites, scouting trips that discover animals, and expeditions that collect their DNA, flown by drones bought at GHOST. The working prototype is `tools/timeline/` (published at https://claude.ai/artifact/FdPrbE8fSzhZFmAjVLmbJr; notes in docs/ui.md). Port its behaviour, not its page.

## Decided

### The slider
- 12 equal bars, one per period (Cambrian to Quaternary), each split into equal epoch slices; years run on a log scale inside a slice, the Holocene's floor at 10 years. Past on the left.
- Epochs: plain Early/Middle/Late names, except the Carboniferous (Mississippian, Pennsylvanian), Permian (Cisuralian, Guadalupian, Lopingian) and Cenozoic (Paleocene to Holocene) epochs, which use their real names. The Silurian is Early/Late only. Bounds from the ICS chart (the prototype's `PERIODS`).
- Label: epoch name, then rounded years ago (two significant figures under a million, then millions, `fmtYearsAgo`).
- Epochs are display only. `period` stays the unit of every mechanic (research cost, medicine `ref-<Period>`, plants, biomes, colours).

### Maps
- 260 x 130 Mollweide maps, one per period plus epoch overrides (Early/Middle/Late Jurassic, Early/Late Cretaceous, Pleistocene/Holocene): 16 in all.
- Drafted by `tools/timeline/genmaps.py` from the PALEOMAP PaleoDEMs (Scotese & Wright 2018, CC BY 4.0: credit it in the game). Palette: navy rim, deep ocean, shallow sea, land, mountains, desert, ice. The Late Cretaceous is at 75 Ma so the Western Interior Seaway shows.
- They want a tidy in the pixel editor before shipping. In the game they are sprites: `sprites/timeline/<name>.png`, packed by `tools/packsprites.py`, drawn through `spriteUrl`.
- No caption under the map. Every site has its own marker: placesites.py nudges markers on a map apart until no two 6 px frames touch (up to about 5 px off). A tap goes to the nearest marker; the selected one's frame turns white.

### Sites
- 83 real localities (historical ranges for the recently extinct) in `tools/timeline/sites.py`, every species at one or more sites of its own period. `placesites.py` rotates them back with the PALEOMAP plate model and checks coverage. For the game it writes a `SITES` table into js/data.js (between marker lines) instead of the prototype page.
- A site shows for the whole of any epoch its window touches, dim until scouted.
- Trip cost, days and risk come from the site's period (`TIME_PERIODS`) for now.

### Scouting and expeditions
- Scouting trip: the first one always lights the site (name, place, cost). Each animal not yet seen there turns up with its own chance (35% small to 65% big, `SCOUT.find`), at most 2 a trip; can come back empty handed. Discovering an animal is what unlocks it (`state.science.unlocked`). Unseen animals show as "Undiscovered species" rows with a count. A site with every animal found shows Site Complete (badge, chip tag, report line) and loses its scouting button.
- Expedition: pick one discovered animal at a lit site as the target. Each row shows Genome % then Survey Success % (the old `tripOdds`: size from `TRIP.fail` plus the site risk, cut by drones). A find adds the old genome gain.
- Post-mission reports, waiting in GHOST until dismissed: "<Animal> Discovered" (first time anywhere; "also found here" otherwise), "Site Complete", "<Animal> Sample Found", "<Animal> Genome Complete", "Came back empty handed".
- One scouting trip per site at a time, one expedition per target at a time.

### Star lock
- An animal can't be targeted by an expedition until the park rating reaches its `stars`. Scouting is never locked. Progress is never taken back if the rating drops. Starters stay exempt. The clone check at TAR goes away (it can't be reached without the expedition one).

### Drones (GHOST)
- Drones replace Temporal Researchers entirely. They are not staff: no wage, no staff screen. Bought and managed only at GHOST.
- 1 to 5 drones. The first comes with GHOST; then $15,000, $22,500, $34,000, $50,500 (`DRONE_PRICE` base 15,000, growth 1.5).
- Each drone flies one mission at a time. GHOST's menu lists every drone: where it is (site, epoch), what it's doing (scouting, or looking for an animal), a progress bar and when it's back.
- All drones share the park's Mk.: GHOST Mk. I (standard) to Mk. V.

### ORACLE
- Species unlock projects go away; ORACLE is the tech tree.
- New techs in the `ghost` group: GHOST Mk. II to V (40, 80, 140, 220 points; each needs the one before), cutting the empty-handed chance of scouting and expeditions by 15%, 30%, 40%, 50% of itself.
- The existing cheaper and faster trip techs (`ghostcost1/2`, `ghostspeed1/2`) stay; speed applies to scouting trips too.

### Species data
- Done: Scansoriopteryx is Jurassic, Paraceratherium Paleogene, Proconsul and Argentavis Neogene, Thylacoleo, Archaeoindris and Gigantopithecus Quaternary. Diplocaulus and Eryops stay Carboniferous.

### Plant DNA, events and bonus finds
- Plant DNA: once ORACLE has the era's flora research, every scouted site of a Paleozoic or Mesozoic period has a "<Period> flora" expedition target beside its animals, filling that period's `PLANT_DNA` genome with the same odds and gain as now. CERES is unchanged.
- Museum events become map sites with their own marker: Cambrian Explosion (Chengjiang, Yunnan, about 520 Ma), Evolution of Tetrapods (Miguasha, Quebec, about 380 Ma), The Great Dying (Siberian Traps, about 252 Ma), K-Pg Impact (Chicxulub, Yucatán, 66 Ma). They need no scouting: an expedition records them, as trips do now. Hadean Earth and the Great Oxygenation Event are older than the slider, so they sit in a small Deep Time list under it.
- Bonus finds stay, limited to the same site: an expedition sometimes adds `TRIP.bonus.gain` to another discovered animal there.

## Old saves
Each hired Temporal Researcher became a drone (up to 5) and their wages stopped; every site holding an animal already unlocked starts scouted with those animals seen; trips out land as expeditions to a site; ORACLE species projects in progress were refunded.

## Build order
1. Data: `SITES` into data.js via placesites.py, drone and scouting constants, Mk. techs, drop the `temporal` staff kind. Default fields in `upgradeSave`.
2. Logic (science.js): sites, scouting and expedition missions on drones (timed in park minutes like today's trips, landing in `scienceTick`), reports, star lock, drone purchase, save migration.
3. GHOST panel (scienceui.js): slider, map, chips, site card, drone menu, reports. ORACLE loses the species tabs.
4. Maps into sprites, packed.
5. Goals, hints and tests: goal texts that mention unlocking at ORACLE, `tests/smoke.js` checks for species projects, trips and temporal staff; new checks for scouting, expeditions, drones, the star lock and the migration.
6. Docs: docs/core.md science section, docs/ui.md GHOST panel; retire the prototype notes once the game has it.
