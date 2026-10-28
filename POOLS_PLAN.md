# Pools: big marine animals (sessions S1 to S6)

Decisions: a pool is a drawn exhibit, not a building. You fence a pen with lagoon wall (the only fence that holds sea water and pool animals) and flood it with sea water using the water tool. Sea water is two water types with their own textures: Shallow sea (`sea`) and Deep sea (`deep`). Aquariums stay for the small sea animals; pools are for the big ones. Viewing Galleries are a building. Feeding shows come later (S6). Everything ships dev-only (`poolsOn()`, `DEV_BUILDINGS`, and the species are off `LAUNCH_ROSTER`) until the animals have art.

Roster, one or two per period:

| Period | Species | id | Water |
|---|---|---|---|
| Ordovician | Cameroceras | `came` | shallow |
| Devonian | Dunkleosteus | `dunk` | deep, predator |
| Carboniferous | Rhizodus | `rhiz` | any water (`fresh`), predator |
| Permian | Helicoprion | `heli` | deep |
| Triassic | Nothosaurus | `noth` | shallow |
| Triassic | Shonisaurus | `shon` | deep, breaches |
| Jurassic | Ichthyosaurus | `ichy` | shallow, breaches |
| Cretaceous | Elasmosaurus | `elsm` | deep |
| Cretaceous | Mosasaurus | `mosa` | deep, predator, breaches |
| Paleogene | Basilosaurus | `basi` | deep, predator, breaches |
| Neogene | Megalodon | `mgdn` | deep, predator, breaches |
| Quaternary | Steller's sea cow | `stel` | shallow |

## S1: Pool core (done)
- Sea water: `SEA_WATER` in data.js (label, price times `WATER.perSqM`), `WATER_TEX.sea`/`deep` (sand shore lines) and `WATER_TILES.sea`/`deep` (tiles from `tools/pixelseawater.py`: sand ripples in the shallows, dark troughs in the deep). Every water price goes through `waterRate(kind)`. Refunds pay what the water cost (`cutWater` returns `worth`).
- Species: the twelve above with `pool`, `deep`, `fresh` and `breach`. Sites in `tools/timeline/sites.py` (new localities, plus Ichthyosaurus at the Dorset Coast and Megalodon at Calvert Cliffs). Info entries in `SPECIES_INFO`.
- Rules (`POOL`): a pool animal wants `POOL.need` of the floor under its water (sea water; any water for `fresh`), and `deep` ones want `POOL.deepNeed` of that deep (`poolFit`). Room is water m², not floor (`exhibitReport` `wet`/`wetNeed`). They want no plants or rocks, never get thirsty, need no shelter from weather, and can't escape.
- Movement: `poolSwim` (map.js) steers like `aquaSwim` but top-down, inside the water (`poolSpot`, `poolClear`). `h.dive` fades them into the water, and `breach` species leap now and then. Underwater look (`poolBodySvg`): a color filter pulls the animal toward the water's blue, more the deeper it dives, and the water's current frame lies over it, see-through and lined up with the water around it, so the surface ripples pass over it. `poolWetPlace` draws that as a sibling layer after the animal's group, in map coordinates, with plain `<image>`s of the water frame on the pattern's grid, masked by a `<use>` of the animal's body (a rect filled with the big water pattern, or anything inside the animal's moving group, redraws the whole pattern every frame and starves the water's own animation). Both drop away mid-leap. `poolSpot` keeps the whole picture inside the water, not just its middle.

## S2: Viewing Gallery (done, v1)
`BUILDINGS.gallery` stands outside a pool's fence (`findGallerySpot`, `GALLERY.gap`), with its door facing away from the water. It multiplies the pool's view by `GALLERY.view` (a platform gives 1.4). Guests who stop to watch walk in and are hidden under its roof (`standNear`, `drawParties`). It stands on park ground (`parkGround`), so fences and other buildings keep clear of it. Next: a picture in the park style (four views, the restroom template), an entry fee and a capacity like the Education Center, and an inside view in its panel (a side-on cutaway of the pool with its animals swimming).

## S3: Art
A swim rig per species, on the Sacabambaspis/Anomalocaris model (docs/rigs.md), drawn top-down-friendly: the sprite stays side-on and upright (the art direction), dived animals fade, surfaced ones show their back and fins above a ripple. Start with Mosasaurus, Megalodon and Ichthyosaurus. A breach clip for the `breach` species, and a splash. Menu thumbnails for sea water are the tiles already.

## S4: Water quality for pools
Carry `aquaLoad`/`aquaClean`/`e.wq` over to pools: a poolside Filtration Plant building (powered, `kw`) cleans a pool's water, murky water costs happiness and raises illness like an aquarium's. Tint the sea tiles toward green as it fouls.

## S5: Pool keeping
Keepers feed at the gate as now; add a feeding platform on the fence that pool animals swim to for `eat`. Vets: darting from the bank, or a medical pool. Rescue: what happens when a pool is drained under its animals (stranded: big happiness hit and health damage until there is water again). Nothosaurus and Steller's sea cow could haul out on a dry bank or beach.

## S6: Feeding shows
A Show Stadium (a building against a pool, like the gallery but with seating): shows on a schedule, a crowd that gathers, a splash zone, a ticket price. The predator grabs a hanging carcass with a breach. Big appeal and income.
