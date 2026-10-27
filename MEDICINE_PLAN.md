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
- New: the Health tab shows what's raising the illness and injury chance (worked out by `healthReport` today but never shown), so the player can tell an exhibit is likely hiding something.

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
  3. Admission takes a bed. The course's doses (2) come out of the PMC's stock up front; if the PMC is short, the animal is admitted anyway and its timer waits until the doses arrive (a darted or admitted animal never worsens). Treatment is a park-minute timer with a progress bar, like cloning, never tied to the day counter or 4 AM. Length = severity x a per-kind rate (start at 12 park minutes a point: 50 is about 600 min, 90 about 1,080), sped up by the era booster (section 5). It pauses while the PMC has no vet on staff.
  4. When the timer ends the animal is recovered and waits at the PMC like a finished clone.
  5. It's queued home automatically, delivered through the specimen delivery system (keeper, custodian or vet; Move sends it elsewhere with the usual fit check). The bed frees when the animal leaves the PMC.
- Beds are a PMC upgrade bought like Time Travel Lab drones: 2 to start, 6 at most, rising price (first guess $4,000 then x1.5 each).
- Ward full: band 2+ animals wait in their exhibit, still worsening; worst go first when a bed frees.

## 5. Medicine (locked)
- Dock medicine ("Contemporary medicine", same good, dock ordering and haul to the PMC as now) treats everything: on the spot, ward courses and medicated feed.
- Era medicine is a booster for ward time only:

| Era | Ward time, dock medicine | Ward time, era medicine |
|---|---|---|
| Cenozoic | x1 | x0.75 |
| Mesozoic | x1.5 | x0.75 |
| Paleozoic | x2 | x0.75 |

- The three era research projects stay at their current points and plant DNA needs. The per-period refinements go.
- The Botany Lab grows era medicine in batches as now ("keep stocked", hauled to the PMC). Names stay as they are in game.
- The PMC uses the animal's era medicine when it has some, otherwise dock medicine. The player never picks.
- On-the-spot treatment cures outright with either; era medicine has no other perk.
- Medicated feed is prevention only: [infection] chance x0.35, 1 dose a day per 5 animals from whatever the PMC holds. Nothing for injuries or poisoning.
- Storage unchanged: PMC store 150, Botany Lab 60 per era.

## 6. Vets (locked)
- Each time a vet looks for work, the first that applies:
  1. Dart an escaped animal.
  2. A player call.
  3. Poisoning, worst first.
  4. Other sick animals, worst first: band 3, band 2 (only with a free bed), band 1.
  5. Overdue check-ups, most overdue first.
  6. Genome therapy, a trip of its own (about 10 min per animal, same cost as now) to exhibits that have it switched on.
  7. Deliveries (specimens and recovered patients), dead last.
  8. Otherwise walk back to the PMC.
- A vet darts a band 2+ animal even when the PMC is out of doses (see section 4, step 3).
- Zones stay as they are. No per-vet patient cap: beds are the only ward limit.
- Hiring unchanged: $3,000, $200 a day, same pace and ATVs.

## 7. The PMC (locked)
- Building unchanged: unique, $6,000, $100 upkeep, 20 x 15 m, no power.
- Beds per section 4 (2 to start, 6 at most). Each bought bed adds $20 a day upkeep.
- It needs a path or service road for vets to get out and keepers to bring patients in or take them home. Ward timers keep running while a vet is on staff, connected or not.
- No PMC: no vets can be hired; band 1 injuries healing on their own is the only recovery.
- Bulldozed: recovered patients go straight home; patients mid-treatment go home with severity cut by their progress (a 60 at 50% goes home a 30) and worsen again from there; darted animals waiting for pickup wake and worsen again; bought beds are lost, no refund. The bulldoze confirm always asks first (8b, 26).

## 8a. UI layout (locked; wording in 8b)
- Exhibit At a glance: Health row as now (sick count, cleanliness).
- Exhibit Health tab, top to bottom: status chips (sick count colored by worst band, check-up age and overdue, medicated today, trash today, low food/water/sanitation); the risk line (only when something raises it); At the PMC (this exhibit's patients with progress bars or recovered and heading home); every animal worst first (name, species, condition flavor name, health bar, one-line status, tap to open); buttons: Call vet (here and in Keepers), medicated feed toggle with doses a day, genome therapy toggle with how many it would improve.
- Animal panel Health section: health bar, condition flavor name and cause, one-line status, Accuracy and Genome Quality, a diagnosed genetic disorder (yellow, top of the list), basics lines, medicated today, last check-up.
- PMC panel: header and vets; Ward (n of m beds) with Buy bed (price and upkeep, until 6) and each patient with home exhibit, progress bar and status; Medicine (stock meters for Contemporary and each researched era; no multipliers shown); Sick in exhibits, worst first; Check-ups, most overdue first.
- Bulldoze confirm: always asks (see 8b, 26).
- Toasts: found at a check-up, hurt or showing illness, treated on the spot, darted, admitted, recovered, band 3 warning, died (death dialog), trash thrown in (first of the day), PMC short on doses (once a day). Coaching toasts that tell the player what to build or do are dropped.

## 8c. Mockups (approved)
Canvas: https://claude.ai/artifact/9x8XCGk9JsJXcFcqe4yNqL (exhibit Health tab, animal panel, PMC panel, toasts, demolish confirm).
- The exhibit's animal list shows a diagnosed disorder as a small yellow "`<Disorder>` (Genetic)" line under that animal's row.
- Animal rows: "`<sp>` · `<Name>`, `<band>` · `<n>`%", health bar, status line.
- Ward rows: "`<sp>` · `<Name>` · from `<ex>`", progress bar, ward status.
- Sick in exhibits: "`<sp>` in `<ex>`: `<Name>`, `<band>`. `<status>`"
- Empty beds show only in the "n of m beds" count.
- The animal page's summary line drops "% DNA"; Accuracy and Genome Quality sit in the Health section as two number rows.
- Toast colors: new cases, critical and out of medicine red; treated, recovered and cured green; the rest plain.
- Demolish confirm title: still to pick.

## 8b. Wording (locked)
All items approved. `<vet>` vet's name, `<sp>` species, `<name>` the animal's own name, `<ex>` exhibit, `<n>` a number.

### Names and rules (ok)
- Kinds: Injury, Infection, Poisoning (in lists: Injured, Infected, Poisoned). Bands: Mild, Serious, Critical. Stats: Accuracy, Genome Quality.
- Injuries: Concussion, Fracture, Laceration, Sprain, Bite Wound, Goring Injury, Joint Dislocation, Torn Claw/Hoof/Nail, Chipped Tooth, Bumblefoot, Fin Tear (aquatic fish).
- Infections: Pneumonia, Tuberculosis, Gastroenteritis, Avian Influenza (birds, theropods, sauropods), Aspergillosis (birds, reptiles), Nematodes, Ticks, Lice (mammals, hooved), Foot and Mouth Disease (hooved), Bluetongue Virus (hooved), Tetanus (land), White Spot Disease, Flukes, Saprolegniasis (aquatic fish), Chitinoclastic Bacteria (`SHELLED`), Cordyceps (land arthropods).
- Poisonings: Foreign Object Ingestion (thrown trash), Modern Plant Poisoning (plants the animal never evolved for), Botulism (land, dirt), Nitrate Toxicity and Gas Bubble Disease (aquatic fish and invertebrates, foul water).
- Genetic: Osteoporosis, Cardiac Problems, Neurological Disorder, Weakened Immune System, Muscle Fatigue.
- Aquatic means the species' `aqua` or `pool` flag. Tiktaalik counts as an aquatic fish for illness (fish batch and Fin Tear). The aquatic batch is for fish and invertebrates only; marine reptiles get Gastroenteritis, Nematodes and Pneumonia, sea mammals those plus Tuberculosis.
- Body rules (lists in data.js): Goring Injury only from a `GORES` attacker; Sprain, Joint Dislocation and Torn Claw/Hoof/Nail need legs (no fish, invertebrates, marine reptiles, sea mammals or `LIMBLESS`); Chipped Tooth needs teeth (no `TOOTHLESS`, fish or invertebrates); Chitinoclastic Bacteria only for `SHELLED` (Anomalocaris and Opabinia are out). Tetanus has no link to injuries.
- Dirt is the main cause (foul water is the dirt of tanks and pools). Other causes add their names to the pool when present. A name is picked at random among those that fit the cause and the body; if none fit the cause, any that fits the body. Every name in a kind shares the kind's numbers.
- Weather is one cause, "lack of shelter": heat waves, cold snaps and storms only count against an exhibit's exposure, and the player sees "lack of shelter" for all three. A vivarium's missing basking lamp is its own cause, "no heat lamp" (Pneumonia).

| Cause | Draft names |
|---|---|
| Dirt | Tetanus, Botulism, Gastroenteritis, Nematodes, Ticks, Lice, Tuberculosis, Aspergillosis, Avian Influenza, Foot and Mouth, Bluetongue, Pneumonia, Cordyceps; Bumblefoot (injury) |
| Foul water | Gastroenteritis, White Spot, Flukes, Saprolegniasis, Gas Bubble, Nitrate Toxicity, Chitinoclastic |
| Wrong biome | Bumblefoot |
| Lack of shelter | Pneumonia, Aspergillosis, Avian Influenza, Bluetongue, Cordyceps, White Spot, Saprolegniasis; Concussion, Fracture, Laceration, Sprain (injuries) |
| Stress | Tuberculosis, Avian Influenza, White Spot |
| Crowding | Tuberculosis, Foot and Mouth |
| Hunger | Nematodes |
| Rival fight | Concussion, Laceration, Bite Wound, Sprain, Joint Dislocation, Torn Claw/Hoof/Nail, Chipped Tooth, Fracture, Goring Injury (gorers) |
| Predator attack | Bite Wound, Laceration, Fracture |
| Aquatic fish, any injury cause | Fin Tear, Laceration, Bite Wound |

### UI text (drafts unless marked ok)
9. In the exhibit: Waiting for a vet. / Vet on the way. / Being treated. / Healing on its own. / Waiting for a bed. / Darted. Waiting for a keeper. / Being carried to the PMC.
10. Problems: No vets. / No PMC. / PMC not connected. / Vets can't get in. / Out of medicine.
11. In the ward: Treating, `<n>`h left. / Waiting for doses. / Paused. No vets. / Recovered. Waiting for pickup. / Recovered. On the way home.
12. Health tab chips: Healthy. / `<n>` sick or injured. / Vet check: today. / Vet check: `<n>` days ago. / Vet check: `<n>` days ago, overdue. / Never checked by a vet. / Medicated today. / Not medicated today. / `<n>` pieces of trash thrown in today. / Illness starts `<date>`.
13. Risk line: "Risk: dirt, hunger, rivals." Words: dirt, foul water, wrong biome, lack of shelter, no heat lamp, hunger, thirst, stress, crowding, rivals, predators.
14. Heading: At the PMC.
15. Buttons: Call vet; Give/Stop medicated feed, "`<n>` doses a day"; Give/Stop genome therapy, "`<n>` to treat".
16. Genetic line, yellow, top of the list: "`<Disorder>` (Genetic)" (ok).
17. A sickness: "`<Name>`, `<band>`." e.g. "Laceration, Serious."
18. Cause lines: From a fight with a `<sp>`. / Gored by a `<sp>`. / Bitten by a `<sp>`. / From lack of shelter. / From no heat lamp. / From a dirty exhibit. / From foul water. / From the wrong biome. / From hunger. / From stress. / From crowding. / Ate trash. / Ate plants it can't digest.
19. Well: Looks healthy.
20. Stats rows: "Accuracy: `<n>`%", "Genome Quality: `<n>`%".
21. Check-up line as now.
22. PMC ward heading: Ward (`<n>` of `<m>` beds).
23. Bed button: Buy bed ($`<price>`, +$20 a day); hidden at 6.
24. No ward-time multipliers shown anywhere (ok). The Medicine section shows stock meters only.
25. PMC sections: Sick in exhibits, Check-ups, as now.
26. Bulldoze confirm, every time (ok, the building keeps its name): "Are you sure you want to demolish the Paleo-Medicine Center? All animals will be returned to their exhibits." Buttons Yes / No.
27. Guest thought, Serious: That animal looked sick.
28. Guest thought, Critical: That poor animal could barely stand.
29. Check-up finds: `<vet>` found and treated `<Name>` in a `<sp>` in `<ex>`. / `<vet>` found and treated `<n>` cases in `<ex>`. / `<vet>` found `<Name>` in a `<sp>` in `<ex>`.
30. Genetic diagnosis: `<vet>` diagnosed `<name>` (`<sp>`) with `<Disorder>`.
31. New visible case: A `<sp>` in `<ex>` has `<Name>`. / A `<sp>` in `<ex>` is showing signs of `<Name>`.
32. Treated: `<vet>` treated a `<sp>` in `<ex>`.
33. Darted: `<vet>` darted a sick `<sp>` in `<ex>`.
34. Admitted: A `<sp>` was admitted to the PMC.
35. Recovered: A `<sp>` recovered at the PMC.
36. Critical, once per case: A `<sp>` in `<ex>` is critical.
37. Trash, first of the day: A guest threw trash into `<ex>`.
38. Out of doses, once a day: The PMC is out of medicine.
39. Day before illness starts: Animals can start falling ill tomorrow.
40. Genome therapy: `<vet>` cured `<name>`'s `<Disorder>` with genome therapy. / Not enough money for genome therapy on `<name>`.
41. Death cause: the condition's name, or "Killed by a `<sp>`".
42. Era medicine research text: "The Botany Lab grows medicine for Paleogene, Neogene, and Quaternary animals. They recover faster at the PMC." (and the same for the other eras, keeping their plant DNA line).
43. Genome therapy research text: "Vets cure a clone's genetic disorder by bringing its genome up to the lab's best for its species. Only works once the lab's genome is ahead of the animal's."

## Genetic disorders (locked)
- A trait, not an illness: no severity or bands, never fatal on its own, and an animal can be sick and have one. At most one per animal.
- Names: Osteoporosis, Cardiac Problems, Neurological Disorder, Weakened Immune System, Muscle Fatigue.
- Rolled when a clone is made (see the roll below).
- It works on the animal from the start, but stays hidden until the animal's first vet check-up diagnoses it. From then it's listed in the animal's menu for good, until genome therapy cures it.
- Effects: Osteoporosis, injuries 1.5x as likely and more often Fractures; Cardiac Problems, illness and injury worsen 1.3x as fast; Neurological Disorder, paces more; Weakened Immune System, illness 2x as likely; Muscle Fatigue, slower, rests more, plays less.
- These replace the flat frail-clone illness multiplier.
- Medicine does nothing for it.
- Every place that copies an animal (crates, specimens, the PMC, escapes) carries it, like names.
- Neurological Disorder also takes stressors much harder (first guess x1.75).
- Old saves: only new clones roll one.
- Shown in the animal's Health list once diagnosed: yellow text, always at the top, with "(Genetic)" after the name, e.g. "Osteoporosis (Genetic)". Curing it takes it off the list.
- Genome therapy cures it whenever the lab's genome is more complete than the animal's. It does not change the animal's Accuracy (the genome % at its cloning).
- Two numbers on every animal, both shown on its page:
  - Accuracy: the genome % at its cloning (60 to 100), fixed for life. Replaces DNA quality (`a.q`). Bought animals are 100%. Rank, the quality-minded guests and the disorder roll read it.
  - Genome Quality: starts equal to Accuracy. Genome therapy raises it to the lab's current genome % and cures the disorder. Therapy is possible only while the lab's genome is ahead of the animal's Genome Quality.
- Disorder roll, refit to Accuracy: 60% x ((95 - Accuracy) / 35)^1.5 (60%: 60, 70%: 36, 80%: 17, 85%: 9, 90%: 3, 95%+: none).
- The exhibit's therapy toggle only treats animals with a diagnosed disorder. One procedure goes all the way, priced per Genome Quality point gained as now; the 20-point cap goes.

## Earlier picks (to confirm in their sections)
- No chronic state.
- Trash throwing moves out of medicine.js.

## To do
9. Old saves.
