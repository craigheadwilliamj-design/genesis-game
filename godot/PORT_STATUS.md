# Godot port: status and handoff

Read this first in a new session, then `CLAUDE.md` (the Godot section) for the layout. Branch: `ccr-05e3607a-padha0`.
The JS game in `js/` is the reference and the source of truth for rules and numbers. Port, don't redesign.

## Done (all with headless tests in `godot/tests/smoke.gd`)
- `data/data.json` generated from `js/data.js` (`node tools/export_data.js`), read through `scripts/data.gd`.
- `geometry.gd`: full port of `geometry.js`, checked against 3,157 cases from the real JS (`node tools/geometry_cases.js`).
- `sim.gd`: clock, money, day end (costs, history, report), save/load, paths (3 types), buildings (placement rules, locks, vivariums as exhibits), exhibits (fence, cost, checks), animals (starter species only, buy/sell), ticket price.
- `guests.gd`: stage one. Reach, guest path graph, demand, arrivals, tickets, walking, seeing exhibits, leaving, mood remembered.
- `main.gd`: map camera, grid, tool bar (Pan/Path/Wide/Service/Exhibit, Buildings and fence dropdowns), snapping, selection and side panel, HUD. `animals_view.gd`, `guests_view.gd` draw the dots.

## Not done yet, in the order I'd do it
1. `exhibitReport` (happiness) and the rating calc (`recompute` in sim.js). Animals sit at 70% and the rating at 1 star until this lands.
2. Guest needs and services: food stands, shops, restrooms, queues, benches, bins, litter (guests.js `NEEDS`, `serveParty`; services.js).
3. Keepers, food and feeding (keepers.js, logistics.js). After day 7 animals aren't fed yet.
4. Science: ORACLE, GHOST, TAR, CERES (science.js). Only the 3 starter species exist until then.
5. Landscape, biomes, weather, escapes, medicine, maintenance, security, lodging, tram, themes, goals, land parcels.
6. Real UI: save/load menu, start screen, park office, settings. Then art (sprites exist in `sprites/`), sound, itch.io export, Steam.

## How to run
- Tests, from the repo root (quiet; add `-- --verbose` to list passes):
  `Godot_v4.7.2-stable_win64_console.exe --headless --path godot --script res://tests/smoke.gd`
- The user is on Windows with Godot 4.7.2, uses GitHub Desktop (Fetch origin, Pull origin) and runs everything. Claude's cloud session CANNOT run Godot, so code is written blind: keep it simple and read errors the user pastes back.

## GDScript gotchas hit so far
- `:=` can't infer a type when the value comes from an untyped variable's method (e.g. `sim.find_exhibit(...)` where `sim` is untyped). Write `var x: Dictionary = ...`.
- Lambdas that capture `self` and are connected to the object's own signal leak. Connect a method instead.
- JSON numbers load as floats: wrap in `int()` where a whole number matters.
- Preload scripts with `const X = preload(...)` instead of `class_name` (the class cache needs an editor import).
- Keep sim code free of nodes and drawing, and keep `state` the same JSON shape as the JS one.

## Working style that saves tokens
- One system per session, ending with its tests green, then a new session.
- Paste only FAIL lines and errors, not full test output.
- Ask for the next item from the list above by name, e.g. "port exhibitReport and the rating".
