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
- Bulldozed: recovered patients go straight home; patients mid-treatment go home with severity cut by their progress (a 60 at 50% goes home a 30) and worsen again from there; darted animals waiting for pickup wake and worsen again; bought beds are lost, no refund. The bulldoze confirm warns when the ward has patients (text to be drafted).

## 8a. UI layout (locked; wording in 8b)
- Exhibit At a glance: Health row as now (sick count, cleanliness).
- Exhibit Health tab, top to bottom: status chips (sick count colored by worst band, check-up age and overdue, medicated today, trash today, low food/water/sanitation); the risk line (only when something raises it); At the PMC (this exhibit's patients with progress bars or recovered and heading home); every animal worst first (name, species, condition flavor name, health bar, one-line status, tap to open); buttons: Call vet (here and in Keepers), medicated feed toggle with doses a day, genome therapy toggle with how many it would improve.
- Animal panel Health section: health bar, condition flavor name and cause, one-line status, DNA and frail note, basics lines, medicated today, last check-up.
- PMC panel: header and vets; Ward (n of m beds) with Buy bed (price and upkeep, until 6) and each patient with home exhibit, progress bar and status; Medicine (stock meters for Contemporary and each researched era, ward-time multipliers as plain numbers); Sick in exhibits, worst first; Check-ups, most overdue first.
- Bulldoze confirm: a line when the ward has patients.
- Toasts: found at a check-up, hurt or showing illness, treated on the spot, darted, admitted, recovered, band 3 warning, died (death dialog), trash thrown in (first of the day), PMC short on doses (once a day). Coaching toasts that tell the player what to build or do are dropped.

## 8b. Wording (in progress)
- Rolls for new cases happen through the day, not at night.
- 1 (kinds: Injury, Infection, Poisoning; Injured, Infected, Poisoned) and 2 (bands: Mild, Serious, Critical) approved.
- Injury names: Concussion, Fracture, Laceration, Sprain, Bite Wound, Goring Injury, Joint Dislocation, Torn Claw/Hoof/Nail, Chipped Tooth, Bumblefoot.
- Illness names: Pneumonia, Tuberculosis, Gastroenteritis, Avian Influenza (avian, theropod and sauropod dinosaurs only), Aspergillosis (birds and reptiles only), Nematodes, Ticks, Lice (mammals only), Foot and Mouth Disease (hooved mammals only), Bluetongue Virus.
- Also for land animals: Tetanus, Botulism, both from dirty exhibits.
- Aquatic names: White Spot Disease, Flukes, Saprolegniasis, Gas Bubble Disease (aquatic fish and invertebrates only), Nitrate Toxicity (aquatic fish and invertebrates only), Chitinoclastic Bacteria (shelled aquatic invertebrates), Cordyceps (land arthropods). Aquatic means the species' existing `aqua` or `pool` flag, so Tiktaalik counts as a land animal; land arthropods are the land invertebrates.
- Fin Tear: an injury for aquatic fish.
- The aquatic batch (White Spot, Flukes, Saprolegniasis, Gas Bubble, Nitrate Toxicity, Chitinoclastic) is for fish and invertebrates only. Marine reptiles and sea mammals get the basic illnesses instead.
- Tiktaalik counts as an aquatic fish for illnesses (fish batch and Fin Tear), though it lives on land in the game.
- Nitrate Toxicity, Gas Bubble Disease and Botulism are the Poisoning kind.
- Body rules (lists in data.js): Goring Injury only from a `GORES` attacker; Sprain, Joint Dislocation and Torn Claw/Hoof/Nail need legs (no fish, invertebrates, marine reptiles, sea mammals or `LIMBLESS`); Chipped Tooth needs teeth (no `TOOTHLESS`, fish or invertebrates); Chitinoclastic Bacteria only for `SHELLED` (Anomalocaris and Opabinia are out).
- Tetanus has no link to injuries: it's a plain dirt illness.
- Dirt is the main cause: most names come from a dirty exhibit (foul water is the dirt of tanks and pools). Other factors (cold, heat, stress, crowding, hunger) add their own names to the pool when they're present.
- Genetic disorder names (the kind itself is open, see below): Osteoporosis, Cardiac Problems, Neurological Disorder, Weakened Immune System, Muscle Fatigue.
- Each name gets a row: its causes and who can get it (`CLADE` in data.js, done). Names are picked at random among those that fit. Each name's causes still to be mapped.
- Open: genetic disorders (flavor of infection, a kind cured only by genome therapy, or no illness at all); fish and invertebrate names (owner to supply); whether every name in a kind shares the kind's numbers; whether Trash poisoning and Plant poisoning stand; items 6 to 35.

## Genetic disorders (in progress)
- A trait, not an illness: no severity or bands, never fatal on its own, and an animal can be sick and have one. At most one per animal.
- Names: Osteoporosis, Cardiac Problems, Neurological Disorder, Weakened Immune System, Muscle Fatigue.
- Rolled when a clone is made: chance = 60% x ((95 - DNA) / 45)^1.5, capped at 60% (50%: 60, 70%: 25, 85%: 6, 90%: 2, 95%+: none).
- It works on the animal from the start, but stays hidden until the animal's first vet check-up diagnoses it. From then it's listed in the animal's menu for good, until genome therapy cures it.
- Draft effects: Osteoporosis, injuries 1.5x as likely and more often Fractures; Cardiac Problems, illness and injury worsen 1.3x as fast; Neurological Disorder, paces more; Weakened Immune System, illness 2x as likely; Muscle Fatigue, slower, rests more, plays less.
- These replace the flat frail-clone illness multiplier.
- Medicine does nothing for it.
- Every place that copies an animal (crates, specimens, the PMC, escapes) carries it, like names.
- Neurological Disorder also takes stressors much harder (first guess x1.75).
- Old saves: only new clones roll one.
- Shown in the animal's Health list once diagnosed: yellow text, always at the top, with "(Genetic)" after the name, e.g. "Osteoporosis (Genetic)". Curing it takes it off the list.
- Genome therapy cures it whenever the lab's genome is more complete than the animal's. It does not change the animal's Accuracy (the genome % at its cloning).
- Open: what therapy raises on the animal, and what rank and guests read (see chat).

## Earlier picks (to confirm in their sections)
- No chronic state.
- Trash throwing moves out of medicine.js.

## To do
8b. UI wording. 9. Old saves.
