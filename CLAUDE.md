# Genesis Park Tycoon

Browser park-builder game (Jurassic Park style). Plain JS, no build step, no modules: every file is a classic `<script>` sharing one global scope. Published as a claude.ai Artifact.

## Files (script load order, from index.html)
- `js/data.js`: all tuning constants and content (`SPECIES`, `BUILDINGS`, `BARRIERS`, `TECH`, `GOALS`, `KEEPER`, `MAINT`, `POWER`, `ESCAPE`, `HEALTH`, `MEDICINE`, `VET`, ...). Balance changes go here.
- `js/geometry.js`: pure shape math (`area`, `perimeter`, `inPoly`, `segProj`, `shapesOverlap`, ...).
- `js/sim.js`: the core loop `tick(dtMin)` → `endDay()`, plus guest demand, money (`spend`/`earn`/`canAfford`), happiness (`exhibitReport`), rating, science (ORACLE/GHOST/TAR), goals, and save migration (`newPark`, `upgradeSave`).
- `js/keepers.js`: keepers, food (`dailyNeed`, `shortages`), cleaning, animal transfers, ATVs, and the staff path graph (`buildKeeperGraph`, `walkFrom` Dijkstra).
- `js/escapes.js`: barrier strength, breakouts, loose animals, guest deaths, viewing platforms, `researchTech`.
- `js/power.js`: generators and electric-fence power allocation (`updatePower`).
- `js/maintenance.js`: fence/generator/depot wear, plus mechanics who inspect and repair.
- `js/medicine.js`: sickness and injuries (`illChance`, `injuryChance`, `healthNight`), the PMC ward (`admit`, `discharge`, `pmcRemoved`), vets who dart sick and escaped animals (`vetsTick`), and CERES medicine (`medTick`).
- `js/logistics.js`: food and medicine as goods. Stores (`b.store`, `storeOf`, `addGood`/`takeGood`), spoilage, dock orders, farms, work zones (`state.zones`, `e.zone`/`b.zone`/`k.zone`), and restock hauls (`pickHaul`, `supplyLines`).
- `js/guests.js`: guest parties. Their needs (`NEEDS`), the guest path graph (`buildGuestGraph`, `guestField` per stop), deciding where to go (`planParty`), queues and service at food stands, shops and restrooms (`svcQ`, `serveParty`), mood, thoughts (`THOUGHTS`, `topThoughts`), and the nightly `guestsNight`.
- `js/services.js`: guest services. Menus on food and gift shells (`b.menu`, `MENU`, `servesOf`, `serveAt`, `willPay`), benches and picnic areas, trash bins and litter (`state.litter` grid, `trashCheck`), restroom dirt, and the night cleaning crew (`servicesNight`, `cleaningBill`).
- `js/custodians.js`: custodians (`ccrew`, `state.staff.custodians`) who restock food stands and gift shops with guest goods (`pickHaul` with `GUEST_GOODS`), scrub restrooms, empty bins, and sweep litter, working from a Custodial Closet.
- `js/security.js`: vandalism by rowdy, unhappy guests (`vandalTick`, `vandalize`, `deterrence`, broken props via `propCond`/`isBroken`, `b.graffiti`) and security guards (`gcrew`, `state.staff.guards`) who patrol, deter, catch vandals, and answer cameras from a Security Office.
- `js/map.js`: SVG rendering, camera, build tools, and drawing guests (`drawParties`). Also defines `$`, `esc` and `nodeKey`.
- `js/ui.js`: HUD, side panel (`ui.panel()`), toasts, catalog and dialogs, and panel click actions.
- `js/logiui.js`: panels for stores, the dock, zones, and the park-office supply summary, plus their click/change handlers.
- `js/guestui.js`: the park office's Guests section and the panels for food and gift shells (menu picker and prices), restrooms, bins, and seats.
- `js/main.js`: the rAF loop (`frame` → `step`), saving (localStorage plus the claude.ai `db` capability), and `startWith`.

## Key globals
- `state`: the whole saved game (JSON-serialized). **Anything that must survive a reload lives in `state`.**
- `derived`: computed from `state` by `recompute()` (reach, reports, demand, rating parts). Call `recompute()` after layout changes.
- `state.zones` / `state.logi`: work zones and logistics bookkeeping. Food is physical: it lives in `b.store` of stations, docks, warehouses, cold stores, and farms, and the PMC holds medicine. Exhibits only get what keepers carry. Stands and shops sell from their own `b.store` of guest goods (snacks, drinks, merch) once `state.logi.guestFrom` has passed; custodians carry it to them.
- `kGraph`: the staff walking graph. Rebuild it with `buildKeeperGraph()` after paths, buildings or gates change.
- `crew` / `mcrew` / `vcrew` / `ccrew` / `gcrew`: live keeper, mechanic, vet, custodian, and guard walkers. These are NOT saved, so mirror anything persistent onto `state.staff.*` (see `setCarry`, `transfer.cargo`).
- `parties` / `gGraph`: live guest parties and their footpath graph (rebuild with `buildGuestGraph()` alongside `buildKeeperGraph()`). Parties are NOT saved. Guests pay where they're served, and their mood when they leave goes into `state.today.moodSum`/`moodN` and `state.guestLog`, which set guest comfort and word of mouth.
- `events`: hooks the sim calls (`toast`, `changed`, `dayEnded`, `gameOver`), wired in main.js.
- Time: `state.minute` runs from `OPEN_MIN` to `CLOSE_MIN`, and `*Night()` functions run in `endDay()`.

## Rules
- Escape user text with `esc()` before putting it in HTML. Toasts take plain text (textContent) unless the third `html` arg is used.
- Match the existing style: terse one-liners, plain-English comments, user-facing text in short full sentences.
- When adding save fields, add a default in `upgradeSave` (sim.js).

## Test
`node tests/smoke.js` runs headless Chromium on index.html: a multi-day sim plus regression checks. It prints `PASS`/`FAIL` per check. Run it after any change.

## Publish
Artifact: https://claude.ai/artifact/WrtBukrdr1fijyDGdFRbM9 (capabilities `db`, `user`, carried forward automatically).
- `index.html` is stored WITHOUT the publish wrapper (it starts with `<title>`, with no `<!doctype>`/`<head>`). Never commit a wrapped copy back, because it would get double-wrapped.
- Publish with `file_path: index.html`, `url` set to the link above, and `files` listing only the changed `js/*.js` (unchanged files are kept).
- Artifact reads of the live page return the wrapped HTML, so don't save that over `index.html`.
