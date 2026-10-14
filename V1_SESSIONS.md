# v1.0 session breakdown

Each session below is standalone: paste its prompt into a fresh session (CLAUDE.md is read automatically). One session = one commit/branch, run `node tests/smoke.js` before finishing. Size: S = quick, M = moderate, L = big (consider splitting or running it on its own). "Needs" lists sessions that must be done first. Anything with no "Needs" can run any time, in any order.

Launch roster (56): Pools A/B/C ids `arth mega pulm dcau comp lyst dryo hyps ovir psit coel sile orni hete mosc scut este desm scel plat gall para macr aepy mglo pach` plus `tric trex dipl apat mamm smil kele icht eryo inos diic plhy long eryt kent cryo allo beel simo igua velo pter paki ambu andr chal dgal dodo elas`.

---

## Track 1: Launch gate (cheap, do first)

**S1 (S): Dev-mode flag**
> Add a hidden dev-mode. `devMode()` helper in js/sim.js reading localStorage key `genesis-dev` (try/catch). Toggle it by clicking the version label in the HUD 5 times in a row (add a small version label if none exists), with a toast saying on/off. Not saved in `state`. Add a smoke-test check that it defaults to off. Update CLAUDE.md with one line on `devMode()`.

**S2 (M): Launch roster filter** Needs S1
> Add `LAUNCH_ROSTER` (ids listed in V1_SESSIONS.md) to js/data.js and `speciesAvailable(id)` (true if dev-mode or in the roster). Apply it to: starter pool picks (`STARTER_POOLS` use in sim.js `newPark`), `speciesToUnlock` in science.js, ORACLE and GHOST species lists in scienceui.js, the exhibit buy lists in ui.js, and the catalog in ui.js (~line 895). Species outside the roster must not appear for a non-dev player, but saves that already own them must keep working. Also filter the animal statues in `STATUES`/menu.js to the roster. Add smoke checks.

**S3 (S): Gate themes and enrichment** Needs S1
> With `devMode()` off: force the Genesis theme for paths and buildings and hide the theme pickers (`themeHtml`, `themesOverview` in ui.js, `zoneThemeHtml` in logiui.js, brush in themes.js). Make animal enrichment always 100% (`enrichment()` in behavior.js) and hide the toy props from Habitat Props. Existing saves with themed items should still load and draw.

**S4 (S): Gate hotels, education centers, trams** Needs S1
> With `devMode()` off, hide hotels/resorts, Education Centers and tram stations/track from the build menu (js/menu.js) and block placing them (map.js). Existing placed ones keep working. Check ORACLE tech entries for `education`/`ed*`/`transit` so they don't show as researchable.

**S5 (S): Fence-delete warning**
> Before bulldozing an exhibit's fence (a drag/tap on fence in Bulldoze, and bulldozing an exhibit that lifts its fence), show the existing `askConfirm` dialog ("Remove this fence? Animals can escape.") Cancel must leave everything untouched. Add a smoke check if feasible.

**S6 (S): Remove death game-over, tighten bankruptcy**
> Delete the guest-death shutdown (`ESCAPE.shutdownDeaths`, js/escapes.js ~line 133, text in js/main.js `events.gameOver`). Deaths keep lawsuits and rating hits. Move the -25000 bankruptcy threshold in js/sim.js `endDay` to a `BANKRUPT` constant in data.js, check it whenever money drops (not only at day end), warn once at half the limit, and update the game-over text to say bankruptcy.

---

## Track 2: Small features

**S7 (M): Donation boxes**
> Add a donation box (small building or path prop, pick whichever fits `BUILDINGS`/path props best). Guests who have learned something, or pass it, may drop money; use `earn(..., "donations")` like js/guests.js ~line 201. Add to the build menu, the money report, and a smoke check.

**S8 (M): Individual animals: names and panel**
> Give every animal a `name` defaulting to `<SPRITES key uppercased>-00X` (e.g. COTY-001, counter per species per park; add defaults in `upgradeSave`). Add an animal panel (`sel = {kind:"animal"}`) opened by tapping an animal on the map, modelled on `guestHtml`/`guestLive` (guestui.js) and `staffHtml`/`staffLive` (staffui.js). Show happiness, wants, needs (`a.need`), stressors, and a rename field (`esc()` all user text). Reuse `exhibitReport` and behavior.js data.

**S9 (S): Weather overlay**
> Draw simple weather over the map from `state.weather.today`: heat shimmer/warm tint, cold tint with a few snow flecks, storm rain streaks with a dark wash. SVG or canvas in map.js, cheap per frame, no sim changes.

**S10 (S): Dust cloud on attacks**
> Add a short animated dust puff in map.js where an animal attacks a guest or another animal (find the hooks in escapes.js and behavior.js).

---

## Track 3: Time and sim rework (do in this order, one at a time)

**S11 (M): Calendar Day:Month:Year**
> Add a date display (Day:Month:Year) derived from `state.day` with a month length constant in data.js, shown in the HUD, with save defaults in `upgradeSave`. Check "Day N" strings in the UI and logs.

**S12 (M): Research and GHOST timing bug**
> Find why ORACLE research and GHOST trips don't fire when expected. Reproduce first (log `scienceTick` in js/science.js against job `start`/`end` and `nowMin()`), look at jobs crossing the close/open boundary and `DAY_MIN` use. Fix the root cause and add a regression check.

**S13 (L): 24-hour park, never empty, Closed toggle** Needs S11, S12
> Remove the hard `OPEN_MIN`/`CLOSE_MIN` window (26 references). Time runs around the clock, with a thin trickle of guests overnight. Add a "Close park" toggle in the park office Park Management tab that stops entry and lets guests leave. Check guest arrival/departure, staff stamina, `*Night()` timing and animal awake schedules. This is the largest sim change. Split further if needed (clock first, then guest trickle, then Closed toggle).

**S14 (M): Slow guests and retune guest AI** Needs S13
> Lower `GUEST.pace` and retune `stay`, needs and mood drain so a visit still feels the same under the new time system.

---

## Track 4: Biome art (one biome per session)

**S15 (M): Grassland art**   **S16 (M): Tundra art**   **S17 (L): Boreal art**
> Follow tools/BIOME_ART.md exactly for <biome>: ground tile, rocks and boulders, landscape plants, Park Plants, water, names, CLAUDE.md status lines. Check at game zoom and zoomed in.

**S18 (M): Paintable biome texture**
> Add a paint tool for park biome ground, modelled on the work zones (`state.zones`) without the management side. Free painting over/replacing, editable until painted over, and delete layers that are fully covered. Save defaults in `upgradeSave`, smoke check.

---

## Track 5: Buildings and paths

**S19 (M): Path and prop overlap/clipping fixes**
> Reproduce overlap/clipping between paths and props (ask the user for screenshots if needed), then fix in `pathProblem`, `shapeHitsLandscape`, `lineHitsLandscape`, `footR` footprints and y-sorting in map.js.

**S20 (L): Four-sided buildings with a front face**
> Add a saved rotation to buildings and a front face (door/sign) that moves when the building rotates; give each of the 4 sides a distinct look in `building34`. Start with the Genesis restroom (already flat style), then the rest in S21.

**S21 (L, repeat): Genesis theme in pixel style** Needs S20
> Convert Genesis paths and buildings to the flat pixel style, a few buildings per session.

---

## Track 6: Sprites

**S22 (S): Human statue + bronze script**
> Add one extremely simple human statue sprite and a script that bronze-tints animal PNGs for statues. Only roster animals get statues.

**S23 (M): Pixel shelters and feed troughs**
> Redraw the `LAND` items with `slots` and `tray` in the flat pixel style.

**S24 (M): Staff and guest sprites**
> One simple sprite per staff type (keeper, vet, mechanic, custodian, guard) and three guest sprites, drawn in `drawParties` and the staff draw code.

**S25+ (L total, many sessions): Animal sprites**
> 51 animals still need sprites (only coel, plat, lyst, prio have them). Run 3 to 4 animals per session, grouped by body plan/period (e.g. small theropods: comp, orni, velo, ovir, gall; ceratopsians/ornithopods; sauropods; synapsids; amphibians; mammals). Follow CLAUDE.md "Sprite rigger" workflow and the art direction.

---

## Track 7: UI and launch

**S26 (L, own plan first): UI pixel-art reorganization**
> Needs its own design pass before any code. Do a read-only planning session first.

**S27 (M): Economy and research balance**
> Playtest multi-day sims, tune `START`, prices, `RESEARCH_*`, `UNLOCK_GROWTH`.

**S28 (S): Zip build**
> Make a zip of `index.html`, `js/`, `sprites/` (no `tools/`, `tests/`), and verify it opens from disk with dev-mode off.

**S29 (M): Start-up screen, PALEO-TYCOON rename, biome lock**
> Rename the game to "PALEO-TYCOON" (index.html `<title>`, the intro dialog "Welcome to Genesis Park" in `#dlgIntro`, HUD and any other user-facing "Genesis Park Tycoon" text; keep the in-game default park name and the Genesis theme as they are unless the user says otherwise). Build a proper start-up screen shown before a park begins: game title, New Park (name + biome pick, reusing `biomeCards` in js/main.js and `#introBiomes`), and Continue if a save exists. Choosing a biome locks the park's background biome (`state.biome`, `parkBiome()` in sim.js) for the life of that park: remove the biome picker from the park office dialog (`#menuBiomes` in main.js ~line 163) so it can't be changed, and only a new park (via the start screen) can pick another. Old saves keep their current biome. Add smoke checks that the biome can't be changed mid-park and that a new park can. Update CLAUDE.md where it mentions picking the biome in the park office.

---

## Suggested order
S1, S6, S5 (quick wins), S29, S2, S3, S4, S7, S8, S9, S10, S11, S12, S13, S14, S15, S16, S19, S18, S20, S22, S23, S24, S17, S21, sprites, S27, S26, S28.
