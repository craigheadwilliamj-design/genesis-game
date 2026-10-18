# PALEO-PARK TYCOON (repo: Genesis Park Tycoon)

Browser park-builder game (Jurassic Park style). Plain JS, no build step, no modules: every file is a classic `<script>` sharing one global scope. Published as a claude.ai Artifact.

## Keep context small
- This file is an index. Detailed notes live in `docs/`; read only the doc for the area you're working on.
- Never read `js/spritepack.js` (767 KB of generated data URIs). `js/data.js` and `js/map.js` are ~250 KB each: grep for the name you need and read that range, never the whole file.
- When you change a system, update its `docs/` file, not this one. Add here only rules that apply to every change. Don't write changelogs ("used to be #ABC") anywhere; that's what commit messages are for.

## Docs (read the one you need)
- `docs/core.md`: data.js, calendar, sim.js (loop, money, demand, rating, parcels/land, save migration), dev mode, science (ORACLE/GHOST/TAR/CERES, genomes, cloning), key globals in full, time and clock.
- `docs/animals.md`: keepers and food, vivarium dishes and trays, calls, escapes, power, maintenance, medicine and genome therapy, thrown trash, behavior (needs, acts, naps, attacks, shelters, hiding), animal sex and social ranks/packs, animal naming.
- `docs/landscape.md`: water, rocks, plants, biomes, weather, vivarium fittings, park decor and statues, themes, biome ground paint.
- `docs/fences.md`: grid fences, pens to exhibits, shared walls with two sides, fences bordering paths and water.
- `docs/paths.md`: path layer drawing, 5 m path chunks, connectivity, the strip compatibility layer, tram.
- `docs/guests.md`: logistics and goods, guests, personalities, services, museum and Education Center, custodians, security and lamps, hotels, staff and morale.
- `docs/ui.md`: build menu, park map, map.js rendering and tools, ui.js panels, science/logi/guest UIs, main.js.
- `docs/art.md`: human and animal sprites, footprints, landscape sprites, flat buildings, fence pictures, full art direction and its status list, sprite pack.
- `docs/rigs.md`: rigged animals (js/rigs.js, per-species notes) and the sprite rigger tool.
- `tools/BIOME_ART.md`: how to finish a biome's art. `PATHS_PLAN.md`: the paths rework plan.

## Files (script load order is in index.html)
`spritepack.js` (generated, loads first), `data.js` (all tuning and content; balance changes go here), `geometry.js`, `sim.js`, `science.js`, `keepers.js`, `escapes.js`, `power.js`, `maintenance.js`, `medicine.js`, `landscape.js`, `fences.js`, `pathcells.js`, `themes.js`, `behavior.js`, `logistics.js`, `guests.js`, `personas.js`, `services.js`, `custodians.js`, `security.js`, `lodging.js`, `staff.js`, `staffui.js`, `animalui.js`, `pathart.js`, `biomepaint.js`, `menu.js`, `rigs.js`, `map.js` (rendering, camera, build tools; also defines `$`, `esc`, `nodeKey`), `propart.js`, `ui.js`, `scienceui.js`, `logiui.js`, `guestui.js`, `parkmap.js`, `main.js` (loop, saving).

## Key globals (details in docs/core.md)
- `state`: the whole saved game. **Anything that must survive a reload lives in `state`**, with a default in `upgradeSave` (sim.js).
- `derived`: computed by `recompute()`; call it after layout changes. `kGraph`/`gGraph`: staff and guest walking graphs; rebuild with `buildKeeperGraph()` and `buildGuestGraph()` after paths, buildings or gates change.
- `crew`/`mcrew`/`vcrew`/`ccrew`/`gcrew` and `parties` are live walkers, NOT saved: mirror anything persistent onto `state`.
- Time: `DAY_MIN` (720) park minutes a day, rollover at 4 AM runs `endDay()` and every `*Night()`. Any new guest timestamp must be added to `shiftStamps` (guests.js).
- Player-facing dates go through `fmtDate(day)`. Dev mode is `devMode()` (localStorage, never in `state`).

## Art direction (locked; full version in docs/art.md)
Flat, simple, cartoony pixel art, with the Dimetrodon as reference: flat fills, no outlines, stair-stepped silhouettes, ~8 base colors each with a lighter and darker shade, structured texture (never noise or dithering), light from the top left, 0.13 m a pixel everywhere. Exhibits are 2D with upright side-on sprites; buildings are 3/4 front-facing, snapped by `flatSnap34`. Don't render animals from 3D models. Check pixels at game zoom and zoomed in.

## Rules
- Escape user text with `esc()` before putting it in HTML. Toasts take plain text (textContent) unless the third `html` arg is used.
- Match the existing style: terse one-liners, plain-English comments, user-facing text in short full sentences.
- When adding save fields, add a default in `upgradeSave` (sim.js).
- A file's helpers aren't always where you'd guess. Search for `function name` or `const name =` across `js/` before adding one.

## Test
`node tests/smoke.js` runs headless Chromium on index.html: a multi-day sim plus regression checks. It prints only failures and a count (`-v` lists every check). Run it after any change.

## Where the code lives (read this before every change)
- **`main` is the source of truth.** Start from it, and get changes merged into it before or right after publishing.
- Publish only from a branch that has `origin/main` merged in. If you publish from a stale branch, you overwrite other people's fixes in the live game.
- Never copy the live artifact's files back into git wholesale. If the live game seems to have something git doesn't, diff each file against `main` and port only the missing hunks. A wholesale copy once undid a fix (the animal Move dialog).

## Sprite pack (read before adding any sprite)
The ~480 PNGs are packed into `js/spritepack.js` by `tools/packsprites.py` (the artifact holds at most 511 files). **After adding or changing any PNG, run `python3 tools/packsprites.py`, commit the new `js/spritepack.js`, and publish it.** Code that puts a sprite path in an `<image href>` or `<img src>` must wrap it in `spriteUrl(...)`. Merge conflicts in `js/spritepack.js`: take either side and re-run the tool.

## Publish
Artifact: https://claude.ai/artifact/WrtBukrdr1fijyDGdFRbM9 (capabilities `db`, `user`, carried forward automatically).
- `index.html` is stored WITHOUT the publish wrapper (it starts with `<title>`, with no `<!doctype>`/`<head>`). Never commit a wrapped copy back, because it would get double-wrapped.
- Publish with `file_path: index.html`, `url` set to the link above, and `files` listing only the changed `js/*.js` (unchanged files are kept). Sprites ride in `js/spritepack.js`, so never list PNGs in `files` (the file cap is 511).
- Artifact reads of the live page return the wrapped HTML, so don't save that over `index.html`.
- The sprite rigger (`tools/rigger/index.html`) is a separate artifact; see docs/rigs.md.
