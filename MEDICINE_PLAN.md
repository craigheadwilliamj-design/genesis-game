# Paleo-Medicine rework plan

A top to bottom rework of `js/medicine.js` and the medicine parts of science, logistics and the UI. This file holds the decisions as they're made; nothing here is built yet.

**Rule for this rework:** no player-facing names or text (kinds, bands, flavor names, toasts, statuses, buttons) goes in without the owner signing off on the exact wording. Labels below in brackets are placeholders.

## 1. Illnesses (locked)
- Three kinds, each one row of data (start severity, worsen rate, starts hidden or not, cure threshold) instead of special cases in code:

| Kind | Caused by | Shows | Worsens | Prevented by |
|---|---|---|---|---|
| [injury] | rival fights, predator attacks, storms | at once | slowly | space, splitting rivals and prey, shelters |
| [infection] | dirt, foul water, hunger, thirst, stress, weather, poor DNA | hidden until bad | medium | cleaning, feeding, medicated feed, check-ups |
| [poisoning] | thrown trash, plants the animal never evolved for | at once | fast | bins, signs, guards, the right plants |

- Flavor names picked from the cause (e.g. a cold snap infection vs. a foul water one), shown in panels only, no mechanics. Names to be approved.
- No contagion. A sick animal is just sick.
- No era-specific diseases. Era only affects how well treatment works.

## 2. Severity and death (locked)
- 0 to 100, death at 100. The rating hit on a death stays at -0.05.
- Worsens through the day (about hourly), not once at night. Per-day totals:

| Kind | Starts | Per day | Untreated, dies in |
|---|---|---|---|
| [injury] | 25 | 6 | ~12 days |
| [infection] | 20 | 8 | ~10 days |
| [poisoning] | 50 | 25 | ~2 days |

- Modifiers kept: hungry x1.5, dirty x1.3, medicated feed slows it.
- No instant death from eating trash.
- Three bands (names to be approved):
  - Band 1, under 40: health bar only. Treatable where it stands.
  - Band 2, 40 to 74: rests and naps more, slower gait, stress need rises, guests notice (mood hit, thought line to be drafted). Needs the ward.
  - Band 3, 75 to 99: lies down most of the time, barely eats, bigger guest hit, one warning toast (to be drafted).
- Exhibit happiness hit scales by band instead of a flat amount per sick animal.
- Natural recovery: band 1 injuries only, about 2 a day, only while the exhibit is fed, watered and clean and the animal's stress is under 60. Otherwise it worsens as normal. Infection and poisoning never heal on their own.

## 3. Detection (locked)
- Hidden means a band 1 [infection] only. The hidden line and the band 2 line are the same number (40). Injuries and poisoning always show.
- A check-up treats the band 1 cases it finds on the spot, if there's medicine, so the vet doesn't walk away and come back.
- Check-ups are one flat job per exhibit, the same length however many animals it holds. An exhibit is overdue after 3 days, with no per-exhibit schedule; Call vet covers "check this one now".
- Only vets find hidden cases. Keepers never spot them.
- Hidden really is hidden: full health bar, no tell on the map. The exhibit shows days since its last check-up and a chip when it's overdue (wording to be drafted).
- The Health tab's illness-risk factors stay, so the player can tell an exhibit is likely hiding something.

## 4. Treatment (locked)
- On the spot, per kind (cutoff, time, doses are data):

| Kind | On the spot up to | Time | Doses |
|---|---|---|---|
| [injury] | 40 | 12 min | 1 |
| [infection] | 40 | 12 min | 1 |
| [poisoning] | any | 20 min | 2 |

  It cures outright. Check-ups do the same for what they find.
- Above the cutoff, the PMC trip:
  1. A vet darts it (8 min) only when a bed is free. Once darted it stops worsening and is off display.
  2. A keeper carries it to the PMC.
  3. Admission takes a bed and uses the course's doses up front (2). Treatment is a park-minute timer with a progress bar, like cloning, never tied to the day counter or 4 AM. Length = severity x a per-kind rate (start at 12 park minutes a point: 50 is about 600 min, 90 about 1,080), sped up by the era booster (section 5). It pauses while the PMC has no vet on staff.
  4. When the timer ends the animal is recovered and waits at the PMC like a finished clone.
  5. It's queued home automatically, delivered through the specimen delivery system (keeper, custodian or vet; Move sends it elsewhere with the usual fit check). The bed frees when the animal leaves the PMC.
- Beds are a PMC upgrade bought like Time Travel Lab drones: 2 to start, 6 at most, rising price (first guess $4,000 then x1.5 each).
- Ward full: band 2+ animals wait in their exhibit, still worsening; worst go first when a bed frees.

## Earlier picks (to confirm in their sections)
- Medicine: dock medicine treats everything. Era research and Botany Lab doses are a booster (faster, better), never a gate. Per-period refinements go.
- Medicated feed: prevention only (cuts illness chance, costs doses daily). No healing.
- Genome therapy: its own vet job with the same toggle and cost, no longer part of check-ups.
- No chronic state.
- Trash throwing moves out of medicine.js.

## To do
5. Medicine. 6. Vets. 7. The PMC. 8. UI (all text drafted for approval). 9. Old saves.
