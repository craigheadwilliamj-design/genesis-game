# Finishing the biome art: instructions

Wetland is done and is the model: ground, rocks and boulders, all 27 landscape plants, the six Park Plants, and textured water with a pixel shoreline. Scrubland has ground, rocks and boulders, and six plants (Permian and Triassic). Everything else is still in the older vector or shaded style.

This is a brief for whoever does the work (a person or a fresh Claude session). Read `CLAUDE.md` first (the **Art direction (locked)** section is the law), then this. Work one biome at a time and ship each as its own change.

## What is left

| Biome | Ground | Rocks / boulders | Landscape plants | Park Plants | Water |
|---|---|---|---|---|---|
| wetland | done | done | 27/27 | 6/6 | done |
| scrubland | done | done | 6/24 (Permian, Triassic done) | none exist | to do |
| desert | to do | to do | 0/27 | 0/4 | to do |
| tropical | to do | to do | 0/27 | 0/6 | to do |
| temperate | to do | to do | 0/27 | 0/7 | to do |
| boreal | to do | to do | 0/18 (Permian on) | 0/2 | to do |
| grassland | to do | to do | 0/6 (Neogene, Quaternary) | 0/1 | to do |
| tundra | to do | to do | 0/6 (Neogene, Quaternary) | 0/1 | to do |

That is 129 landscape plants and 21 Park Plants in total, plus 6 grounds, 6 rock sets and 7 water tiles. A biome that didn't exist in a period has no plants for it (`PLANT_TABLE` in `js/data.js` is the source of truth; boreal starts in the Permian, grassland and tundra in the Neogene).

Suggested order, easiest and most visible first: **grassland, tundra** (6 plants each, almost nothing else), then **scrubland** (finish its 18), **boreal**, **desert**, **temperate**, **tropical** last (most plants, the most to get wrong).

## Per biome checklist

Do these in order. Each step has a preview, see "Check your work".

1. **Ground tile.** `sprites/ground/<biome>.png`.
2. **Rocks and boulders.** `sprites/rocks/{boulder,rock}-<biome>-<n>.png`.
3. **Landscape plants.** `sprites/plants/<period3>-<biome>-<size>.png`, three sizes per period.
4. **Park Plants.** `sprites/plants/q-<name>.png`.
5. **Water.** `sprites/water/<biome>.png` plus the small code change below.
6. Common names for the modern periods (see "Names").
7. Update the status lines in `CLAUDE.md`, run the smoke test, commit.

### 1. Ground

Model: `wetland_tile` and `tile` in `tools/pixelground_flat.py`.

- Tile is 144 px = 18 m (0.125 m a pixel), seamless, wraps over the edges. Add a function for your biome and one `im.save` line at the bottom of the file.
- **Hide the repeat with small, low-contrast detail, not large shapes.** The first wetland tile had big mud blobs and looked like camouflage with a visible repeat. What worked: a faint two-scale noise wash applied in 2x2 blocks (only the extremes of the noise, so patches are small), roughly 500 scattered 1 to 3 px flecks, short dashes, tiny glints, a few small features. Nothing may be longer than about 10 px or distinctive enough to spot twice.
- Only features that belong to every era the biome covers. No grass, flowers or modern plants on a Devonian-to-today floor. Pebbles, silt, hardpan, sand ripples, moss crust, frost cracks are fine.
- Set `BIOMES[<biome>].color` and `.park` in `js/data.js` to the same value, equal to the tile's base color (this is what scrubland and wetland did, so one tile serves both the exhibits and the park). This changes how that biome's park looks, so say so in the change description. Keep the color in the same family as today's so the biome stays recognisable.
- Register it in `index.html`: replace both `<pattern id="b-<biome>">` and `<pattern id="p-<biome>">` with
  `<pattern id="b-<biome>" width="18" height="18" patternUnits="userSpaceOnUse"><image href="sprites/ground/<biome>.png" width="18" height="18" style="image-rendering:pixelated"/></pattern>`.
- Plants must stay readable on it. If the plants vanish, lower the ground's contrast.

### 2. Rocks and boulders

Model: `render()` and `shapes()` in `tools/pixelrocks_flat.py`. Add palette ramps (`ramp((r, g, b))`) and shape specs, no new rendering code needed.

- Make 3 or 4 boulders and 5 or 6 rocks. Vary the silhouettes (round, tall, two stones together, low slab), not just the color. Keep a few different palettes per biome (stone, a stained variant, a mossy or sandy variant).
- `ROCK_STONE[<biome>]` already gives the biome's stone color; use it as the base of the main ramp so the old SVG fallback and the sprites agree.
- The script prints each picture's size. Register them in `ROCK_SPRITES` in `js/data.js` as `[width, height]`, in the same order, under `<biome>:{boulder:[...], rock:[...]}`. A wrong size squashes the rock in game.
- Biome ideas: desert sandstone strata with red and cream bands; tundra frost-shattered grey slabs with lichen-colored caps; boreal dark wet granite with moss; tropical dark volcanic and mossy river stone; temperate grey with moss and leaf-litter caps; grassland rounded grey fieldstone and a pale limestone.

### 3. Landscape plants

Model: `tools/pixelplants_wetland.py`, which has all the helpers (`Sprite`, `frond`, `lens`, `stem`, `blade`, `fork`, `whorl`, `spray`, `scale_shoot`, `scars`, `disc`). Copy the helper block into a new `tools/pixelplants_<biome>.py` (scripts run with `python3 -I`, which blocks imports from sibling files, so each plant file carries its own copy; this is deliberate). Do not make it import.

- Canvases that worked: **small about 40 to 54 wide by 28 to 46 tall, medium about 60 to 72 by 40 to 56, large about 64 to 72 by 92**. Base of the plant at the bottom middle.
- Register each in `PLANT_SPRITES` (`js/data.js`): `{ratio: w/h, size: ...}`. `size` scales the drawn width (2 x the plant's radius times size). Use these rates so every biome matches: **size = width_px x 0.0288 for small, x 0.0164 for medium, x 0.0115 for large**, rounded to 2 places. Add an entry per file; a plant with no entry falls back to the old SVG.
- The key is `<first 3 letters of period lowercased>-<biome>-<small|medium|large>`, e.g. `jur-boreal-large`. The three names per period, small to large, are in `PLANT_TABLE`.
- Draw the real plant form where it is distinctive (this is most of the effort). Examples from the table: Lepidodendron and Sigillaria are scaly unbranched trunks under a tuft of strap leaves (`scars`, `blade`); Psaronius is a tree-fern trunk; Glossopteris has tongue-shaped leaves in whorls; Gangamopteris and Noeggerathiopsis are broad single blades; Ginkgo-types have fan leaves; Welwitschia is a flat low rosette of two strap leaves; cycads (Nilssonia, Zamites, Williamsonia, Cycadeoidea) are a short thick trunk with a crown of stiff pinnate fronds; Cooksonia, Zosterophyllum, Rhynia are leafless forked stems with sporangia (`fork`); Prototaxites is an unbranched pillar of fungus-like tissue; Tempskya a tall false trunk of fibrous roots. Look the genus up if unsure, and keep it recognisable at about 40 px.
- Neogene and Quaternary entries are modern plants: draw what a person would recognise (an oak, a maple, a spruce, an agave).
- Distinguish neighbours. Wetland's Pecopteris and Cladophlebis are close to each other, and that is a weakness; give sizes within a period different silhouettes.
- Style: flat fills, no outline, olive-green family pulled toward the biome (`PLANT_SHADE[<biome>]` gives the old small, medium, large leaf colors; use them as the starting hue, then fit to the flat ramp). A lit top-left edge, shadow underneath and on the right, rhythmic texture (dashes, ribs, grooves). `Sprite.shade()` does the edge pass for `leaf`, `stem` and `seed`, so use those three color keys for anything you want shaded. Extra colors (a flower) go in `sp.C` and are not auto-shaded; shade them by hand.
- Thin 1 px lines look wispy and faint. `line(..., r)` with `r=0` is 1 px, `r=1` is a plus shape. Use `r=1` for stems that matter and `lens()` with width about .8 or more for needles and narrow leaves.
- Cypress-style trunks that run up through the middle of a crown show a dotted stripe; add front sprays (a "curtain") to hide it (see `q_bald_cypress`).

### 4. Park Plants

These are the named modern plants in `PARK_PLANTS` (`js/data.js`). They are drawn today by `plantSvg` (a vector fake). Give each a sprite:

- File `sprites/plants/q-<name>.png`, where the key is `"q-" + name.toLowerCase()` with every run of non-letters replaced by `-` (so "Water Lily" is `q-water-lily`, "Joshua tree" would be `q-joshua-tree`). Check `Object.keys(LAND).filter(k => k.startsWith("q-"))` in the browser console if unsure.
- Put them in the same biome file as the landscape plants, and add `PLANT_SPRITES` entries by the same size rates (the size class is the section of `PARK_PLANTS` the name sits in: large, medium, small).
- Wet and aquatic plants (water lily, cattails, mangrove) are drawn upright like everything else. They still get placed in water by the existing rules; no code change.
- Make them look different from the landscape plants of the same biome: the Weeping Willow is deliberately fuller than wetland's Quaternary "Willow". The park plants are the pretty gardening versions (blossoms, autumn color), so use a touch of the `look`/`accent` color in `PARK_PLANTS`.
- Scrubland has no Park Plants at all. Adding some is a design choice, not part of this brief.

The Park Plants and Quaternary plants lists in the build menu already show each other's plants (`parkPlantKeys` in `js/menu.js`); new sprites show up there with no menu change.

### 5. Water

Wetland shows the whole pattern. For a new biome:

- Generate `sprites/water/<biome>.png` with `tools/pixelwater_flat.py` (add a function and a save line; the wetland one is the model). 144 px, opaque, same 2x2 wash of two tones plus ripple dashes, glints and flecks. Pick the base color to read as that biome's water, darker than the ground but not black so animals stay readable.
- Add `<pattern id="w-<biome>" ...>` next to the others in `index.html`, same form as `w-wetland`.
- **The one code change:** `waterSvg` in `js/landscape.js` has the wetland bank colors hard-coded (`#6A8358` damp outer ring, `#566648` mud band, `#7FAA9C` lit rim, `#4A7872` dark rim). Change `WATER_TEX` from `{wetland:1}` to an object of per-biome colors, for example `{wetland:{damp:"#6A8358", mud:"#566648", lit:"#7FAA9C", dark:"#4A7872"}, ...}`, and have `waterSvg` read the biome's entry for those four colors. Keep the `waterMask` logic as it is. Re-test wetland after (nothing should change).
- Biome ideas: desert, a clear turquoise oasis with pale sandy banks and a very faint algae speck; tropical, clear blue-green with bright glints and dark leaf-litter mud; grassland, a murky brown-green river with silt; temperate, a blue-green pond; boreal, cold dark blue with moss banks; tundra, pale glacial blue-grey with an ice-white rim instead of mud and a little snow-dust on the bank; scrubland, a flat tan-grey brackish pool with a crusty salt-pale bank.
- Also do the shoreline fully on the grid. The mud bank adds about 3 px of ground-colored margin around every pond (a small visual enlargement; accepted).

## Names

Plants from the Paleogene on use **common names** where an ordinary person has one; older periods keep the scientific names. Wetland already has this (Mosquito Fern / Floating Fern / Bald Cypress in the Paleogene, Cattail / Common Reed / Tupelo in the Neogene, Peat Moss / Sedge / Willow in the Quaternary). The Cretaceous is left scientific on purpose. Edit the strings in `PLANT_TABLE` (`js/data.js`); they are labels only, nothing else reads them.

Biome notes for the common-name pass (a suggestion, adjust as you see fit): desert Paleogene Tamarisk / Saltbush / Mesquite, Neogene Prickly Pear / Agave / Saguaro, Quaternary Creosote Bush / Barrel Cactus / Joshua Tree; tropical Paleogene Climbing Fern / Nipa Palm / (Dipterocarpoxylon: use Dipterocarp Tree), Neogene Heliconia / Banana / Kapok, Quaternary Philodendron / Palm / Mahogany; temperate Paleogene Zelkova / Oak / Dawn Redwood, Neogene Anemone / Maple / Beech, Quaternary Trillium / Hazel / Linden; boreal Paleogene Royal Fern / Birch / Larch, Neogene Blueberry / Alder / Spruce, Quaternary Reindeer Lichen / Labrador Tea / Pine; tundra Neogene Cottongrass / Crowberry / Arctic Willow, Quaternary Saxifrage / Mountain Avens / Dwarf Birch; grassland Neogene Bluegrass / Kangaroo Grass / Pampas Grass, Quaternary Fescue / Grama / Bluestem; scrubland Paleogene Hopbush / Acacia / Eucalyptus, Neogene Sagebrush / Saltbush / Juniper, Quaternary Sage / Chamise / Manzanita. Avoid reusing a Park Plant's exact label in the same list (the wetland names were chosen to avoid "Cattails", "Bald Cypress", "Weeping Willow" clashes only loosely; a near duplicate is fine, an exact duplicate in one list is confusing).

## Rules that apply to every asset

- Light from the top left. Flat fills. No outlines. 0.13 m a pixel (the scripts use `ROCK_MPP = .13` for rocks and plants and .125 for the 144 px tiles; stay with what the model scripts do).
- Do not touch the old SVG code for biomes you aren't doing; each biome keeps its current look until its sprites are registered.
- Keep tools deterministic (fixed seeds) so re-running a script gives the same pictures.
- Do not hand-edit PNGs. Change the script and re-run it. Commit the script and the PNGs together.
- Never copy generated art over a different biome's files, and never overwrite `scrubland` or `wetland` files while working on another biome.

## Check your work

1. **Contact sheet first, before wiring.** Render the new PNGs side by side on the biome's ground color at 3 to 5x with nearest-neighbour scaling and look at them: a small Python/PIL script that pastes each sprite bottom-aligned on a green background is enough.
2. **Then in the game.** Playwright with the pre-installed Chromium works headless (`executablePath: "/opt/pw-browsers/chromium"`; `require("/opt/node22/lib/node_modules/playwright")`). Click `#introGo`, `setSpeed(0)`, set `state.biome`, replace `state.exhibits` with one open exhibit (`biome`, `land:[]`, `water:[]`), push `{id, type, x, y}` items straight into `e.land` (this skips cost and CERES stock), set `state.water` for park water, call `render()`, set `view = {k, tx, ty}` and call `render()` again, then `page.screenshot`. The camera: world x maps to screen `k * x + tx`; world y maps to about `k * 0.7 * y + ty + 60` (the 3/4 view squashes y by `TILT = .7` and the map starts about 60 px below the top). Aim wrong and you will stare at the middle of a pond or a field.
3. **Look at three zoom levels**: whole exhibit (k about 4), a close look (k about 6 to 9), and pixel-level (k about 30) for edges. At k=4 the ground must show no repeat and the plants must stand out from it.
4. **Water only:** time `waterMask` on a huge pond (`[[0,0],[300,10],[320,250],[150,300],[10,200]]` took about 27 ms once and is cached), check bulldoze mode still picks water, and compare a different-biome exhibit to confirm its water is unchanged.
5. `node tests/smoke.js` must end with `All checks passed.` Run it after every change.

## Shipping each biome

1. Branch from `main`; merge `origin/main` in before publishing.
2. Update the **Status** line in `CLAUDE.md` and the file notes for ground, rocks, plants and water (name the generator scripts).
3. Publish per the **Publish** section in `CLAUDE.md`: `file_path: index.html`, the artifact `url`, and `files` listing every changed `js/*.js` and every new PNG. The tool will refuse the first publish until you have read the live files (`action: "read"` with `paths`); diff the live `js/data.js` and `js/landscape.js` against `main` and port any live-only hunks into git before overwriting (the Lystrosaurus rest fields were one such hunk). Never copy the wrapped live `index.html` back into git.
4. Open a PR to `main`, merge, and re-check the live game.

## Known loose ends (not part of the brief, but you will notice them)

- Wetland's Pecopteris and Cladophlebis are very similar; the Weeping Willow and Salix are close cousins on purpose.
- The textured water's colors are fixed in `waterSvg` until the `WATER_TEX` change above.
- Lystrosaurus `rest:7, restMs:260, holdMs:1400` is in `SPRITES` but there is no matching code in git; it lives in the published game. Someone should find where that work went.
