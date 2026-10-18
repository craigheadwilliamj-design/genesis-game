# Finishing the biome art: instructions

Wetland is done and is the model: ground, rocks and boulders, all 27 landscape plants, the six Park Plants, and textured water with a pixel shoreline. Scrubland has ground, rocks and boulders, all 24 plants and water (it has no Park Plants). Everything else is still in the older vector or shaded style.

This is a brief for whoever does the work (a person or a fresh Claude session). Read `CLAUDE.md` and `docs/art.md` first (the **Art direction (locked)** section is the law), then this. Work one biome at a time and ship each as its own change.

## What is left

| Biome | Ground | Rocks / boulders | Landscape plants | Park Plants | Water |
|---|---|---|---|---|---|
| wetland | done | done | 27/27 | 6/6 | done |
| scrubland | done | done | 24/24 | none exist | done |
| desert | done | done | 27/27 | 4/4 | done |
| tropical | done | done | 27/27 | 6/6 | done |
| temperate | done | done | 27/27 | 7/7 | done |
| boreal | done | done | 18/18 | 2/2 | done |
| grassland | done | done | 6/6 | 1/1 | done |
| tundra | done | done | 6/6 | 1/1 | done |
| fern (Fern Prairie) | placeholder (scrubland's) | placeholder (scrubland's) | 0/15, Permian names are placeholders | none exist | done (`fern-1..4`, 1 px shore) |

Boreal is done (`tools/pixelplants_boreal.py`; its Quaternary Labrador Tea is called Marsh Rosemary, to keep tundra's Park Plant name unique). A biome that didn't exist in a period has no plants for it (`PLANT_TABLE` in `js/data.js` is the source of truth; boreal starts in the Permian, grassland and tundra in the Neogene).

Fern Prairie (key `fern`) is the open ground before grass, Permian through Paleogene (5 periods, 3 plants each). Its ground, water and rocks are copies of scrubland's (`sprites/ground/fern*.png`, `sprites/water/fern.png`, `sprites/rocks/*-fern-*.png`): overwrite those files with real art, then run `python3 tools/packsprites.py`. Triassic through Paleogene have real names in `PLANT_TABLE`; Permian is still the placeholder "Permian Fern|Horsetail|Tree Fern". Pick the Permian names, then draw the sprites.

Suggested order, easiest and most visible first: **grassland, tundra** (6 plants each, almost nothing else), then **boreal**, **desert**, **temperate**, **tropical** last (most plants, the most to get wrong).

## Per biome checklist

Do these in order. Each step has a preview, see "Check your work".

1. **Ground tile.** `sprites/ground/<biome>.png`, or 1 m tiles (see 1b).
2. **Rocks and boulders.** `sprites/rocks/{boulder,rock}-<biome>-<n>.png`.
3. **Landscape plants.** `sprites/plants/<period3>-<biome>-<size>.png`, three sizes per period.
4. **Park Plants.** `sprites/plants/q-<name>.png`.
5. **Water.** `sprites/water/<biome>.png` plus the small code change below.
6. Common names for the modern periods (see "Names").
7. Update the status lines in `docs/art.md`, run the smoke test, commit.

### 1. Ground

Model: `wetland_tile` and `tile` in `tools/pixelground_flat.py`.

- Tile is 144 px = 18 m (0.125 m a pixel), seamless, wraps over the edges. Add a function for your biome and one `im.save` line at the bottom of the file.
- **Hide the repeat with small, low-contrast detail, not large shapes.** The first wetland tile had big mud blobs and looked like camouflage with a visible repeat. What worked: a faint two-scale noise wash applied in 2x2 blocks (only the extremes of the noise, so patches are small), roughly 500 scattered 1 to 3 px flecks, short dashes, tiny glints, a few small features. Nothing may be longer than about 10 px or distinctive enough to spot twice.
- Only features that belong to every era the biome covers. No grass, flowers or modern plants on a Devonian-to-today floor. Pebbles, silt, hardpan, sand ripples, moss crust, frost cracks are fine.
- Set `BIOMES[<biome>].color` and `.park` in `js/data.js` to the same value, equal to the tile's base color (this is what scrubland and wetland did, so one tile serves both the exhibits and the park). This changes how that biome's park looks, so say so in the change description. Keep the color in the same family as today's so the biome stays recognisable.
- Register it in `index.html`: replace both `<pattern id="b-<biome>">` and `<pattern id="p-<biome>">` with
  `<pattern id="b-<biome>" width="18" height="18" patternUnits="userSpaceOnUse"><image href="sprites/ground/<biome>.png" width="18" height="18" style="image-rendering:pixelated"/></pattern>`.
- Plants must stay readable on it. If the plants vanish, lower the ground's contrast.

### 1b. Ground from 1 m tiles (boreal does this; use it for a biome when you want per-cell variety)

Instead of one 18 m tile, a biome can be built from several 8 x 8 px tiles, each exactly 1 m (0.125 m a pixel). `buildGroundTiles` (end of `js/biomepaint.js`) lays them on the 1 m grid at random, so the 18 m repeat never shows. It replaces both the `#p-<biome>` (park ground and paint) and `#b-<biome>` (exhibit floor) patterns, so keep the old `sprites/ground/<biome>.png` and its `index.html` patterns in place as the fallback.

**Files.** `sprites/ground/<biome>-1.png`, `-2.png`, ... 8 x 8 px, opaque. The first `plain` tiles are plain ground, the next `detail` tiles carry one small mark (a twig, a stone). Light is from the top left. Draw each tile so nothing runs off its edge, because tiles are placed, turned and mirrored at random.

**Config.** One entry in `GROUND_TILES` (`js/data.js`): `{plain, detail, share, still}`.
- `plain`: how many plain tiles (`-1` .. `-plain`). `detail`: how many marked tiles after them.
- `share`: the fraction of cells in each 5 m chunk that take a detail tile. `.1` gives 2 or 3 of 25. Everything else is plain.
- `still`: tile numbers that are never turned or mirrored, like a stone with a lit side. Leave it out if every tile can turn.
- The boreal entry is `boreal:{plain:1, detail:2, share:.1, still:[3]}`.

**Releasing or replacing PNGs.**
1. Save them over `sprites/ground/<biome>-<n>.png` (same names to replace, new numbers to add). Delete any numbered tile you no longer use, so the pack stays small.
2. If the count changed, update `plain` and `detail` in `GROUND_TILES`. Tiles are numbered from 1 with no gaps, plain ones first.
3. Run `python3 tools/packsprites.py` and commit `js/spritepack.js`. Nothing else needs touching for a plain recolour or redraw.
4. Look at it before wiring anything else: paint the biome over park ground and look at three zooms (see "Check your work"), in light mode and in dark mode, and compare the painted ground with an exhibit floor. They should be the same colour. A biome listed in `GROUND_TILES` skips the dark-mode dimming layer (`groundShade`, `js/biomepaint.js`) so park and exhibit match.
5. Run `node tests/smoke.js`, commit, and publish. Publishing: list only the changed `js/*.js` plus `js/spritepack.js`. Never list PNGs.

**What reads well.** At game zoom the ground should be calm: a flat base with a mark in about one cell in ten. Many small high-contrast specks turn into a visible lattice, and large clumps repeat noticeably. Keep marks to a few pixels and the contrast low.

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

Water has two art styles. **Wetland uses the tile style** (the model); the other biomes still use the older textured tile, and moving one over is the steps below.

**Tile style** (wetland). Water is drawn as 1 m cells (8 x 8 px, 0.125 m a pixel), the same way `GROUND_TILES` does ground:

- `sprites/water/<biome>-1.png` is the plain tile, one solid color. Then the `detail` tiles (a mark like a reed clump), then the `glint` tiles of the shimmer. File numbers run in that order: wetland is `-1` plain, `-2` clump, `-3` to `-5` glints (a sparkle that moves left to right, never mirrored).
- Add the biome to `WATER_TILES` in `js/data.js`: `{plain, detail, share, turn, glint, frames, fps, waves}`. `share` is the part of each 5 m chunk's cells that take a detail tile (wetland .075, so 1 or 2 per chunk). `turn:false` mirrors but never turns. `waves` is a list of `[period in frames, wavelength in cells]`; each wavelength must divide 100, and the loop is the least common multiple of the periods (wetland 24 frames). Leave `waves` out for glints at random starts. The comment above `WATER_TILES` explains each field.
- In `index.html` change the biome's `<pattern id="w-<biome>">` to `width="1" height="1"` and its image to `sprites/water/<biome>-1.png` at 1 x 1 (the code resizes it to the 100 m pattern at load).
- In `WATER_TEX` (`js/landscape.js`) give the biome `{shore:"#hex", shoreW:2, lit:..., dark:...}` and no `damp` or `mud`. `shore` is the bank line's color, `shoreW` its width in px; `lit` and `dark` are still used by animals' waterlines and the park map. `softenShore` then stair-steps the edge and rounds the corners with no extra work (tune `SHORE_NOISE`, `SHORE_ERODE`, `SHORE_CHIP`). The irregular coast is opt-in: only a biome with `shore` gets it (the older textured biomes keep straight lit and dark rims until moved over). It is drawing only and only removes water pixels, never adds any, by 0 to 2 px; keep it at 2 so a shore can't get near the 0.5 m margin water keeps from fences. `SHORE_NOISE`, `SHORE_ERODE` and `SHORE_CHIP` are shared by every biome, so a different wobble for one biome needs a per-biome override in its `WATER_TEX` entry.
- Delete the old `sprites/water/<biome>.png` and its entry in `tools/pixelwater_flat.py`. Run `python3 tools/packsprites.py` and commit `js/spritepack.js`.
- Check it with Playwright: lay water boxes with `watersSvg([{kind:"<biome>", points:[...]}], "<biome>")` into a page, look at a few frames and at a join with another kind (no gap), and run `node tests/smoke.js`.

**Older textured style** (every other biome today). `sprites/water/<biome>.png` is a 144 px opaque tile from `tools/pixelwater_flat.py` (a function or `PAL` entry plus a save line). The `<pattern id="w-<biome>" ...>` in `index.html` is 18 x 18, and the biome has a `WATER_TEX` entry with `damp`, `mud`, `lit` and `dark` bank colors (the mud bank adds about 3 px of ground-colored margin around every pond; accepted). Pick a base color that reads as the biome's water, darker than the ground but not black so animals stay readable.

Biome ideas: desert, a clear turquoise oasis with pale sandy banks; tropical, clear blue-green with bright glints and dark leaf-litter mud; grassland, a murky brown-green river with silt; temperate, a blue-green pond; boreal, cold dark blue with moss banks; tundra, pale glacial blue-grey with an ice-white rim and a little snow-dust on the bank (tundra's floes would be its detail tiles); scrubland, a flat tan-grey brackish pool with a crusty salt-pale bank.

## Names

Plants from the Paleogene on use **common names** where an ordinary person has one; older periods keep the scientific names. Wetland already has this (Mosquito Fern / Floating Fern / Bald Cypress in the Paleogene, Cattail / Common Reed / Tupelo in the Neogene, Peat Moss / Sedge / Willow in the Quaternary). The Cretaceous is left scientific on purpose. Edit the strings in `PLANT_TABLE` (`js/data.js`); they are labels only, nothing else reads them.

Biome notes for the common-name pass (a suggestion, adjust as you see fit): desert Paleogene Tamarisk / Saltbush / Mesquite, Neogene Prickly Pear / Agave / Saguaro, Quaternary Creosote Bush / Barrel Cactus / Joshua Tree; tropical Paleogene Climbing Fern / Nipa Palm / (Dipterocarpoxylon: use Dipterocarp Tree), Neogene Heliconia / Banana / Kapok, Quaternary Philodendron / Palm / Mahogany; temperate Paleogene Zelkova / Oak / Dawn Redwood, Neogene Anemone / Maple / Beech, Quaternary Trillium / Hazel / Linden; boreal Paleogene Royal Fern / Birch / Larch, Neogene Blueberry / Alder / Spruce, Quaternary Reindeer Lichen / Marsh Rosemary / Pine; tundra Neogene Cottongrass / Crowberry / Arctic Willow, Quaternary Saxifrage / Mountain Avens / Dwarf Birch; grassland Neogene Bluegrass / Kangaroo Grass / Pampas Grass, Quaternary Fescue / Grama / Bluestem; scrubland Paleogene Hopbush / Acacia / Eucalyptus, Neogene Sagebrush / Saltbush / Juniper, Quaternary Sage / Chamise / Manzanita. Avoid reusing a Park Plant's exact label in the same list (the wetland names were chosen to avoid "Cattails", "Bald Cypress", "Weeping Willow" clashes only loosely; a near duplicate is fine, an exact duplicate in one list is confusing).

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
2. Update the **Status** line in `docs/art.md` and the file notes for ground, rocks, plants and water (name the generator scripts).
3. Publish per the **Publish** section in `CLAUDE.md`: `file_path: index.html`, the artifact `url`, and `files` listing every changed `js/*.js` and every new PNG. The tool will refuse the first publish until you have read the live files (`action: "read"` with `paths`); diff the live `js/data.js` and `js/landscape.js` against `main` and port any live-only hunks into git before overwriting (the Lystrosaurus rest fields were one such hunk). Never copy the wrapped live `index.html` back into git.
4. Open a PR to `main`, merge, and re-check the live game.

## Known loose ends (not part of the brief, but you will notice them)

- Wetland's Pecopteris and Cladophlebis are very similar; the Weeping Willow and Salix are close cousins on purpose.
- `WATER_TEX` has an entry for every biome in `js/landscape.js`; wetland is on the tile style (`WATER_TILES`), the rest on the older textured tile (a new one adds a `PAL` entry in `tools/pixelwater_flat.py`).
- Lystrosaurus `rest:7, restMs:260, holdMs:1400` is in `SPRITES` but there is no matching code in git; it lives in the published game. Someone should find where that work went.
