# Paleo-Park Tycoon v2.0: how the game works

A draft for discussion. It covers the systems and how they talk to each other; `V2_PLAN.md` has the build order and the art pipeline.

## The big loop
The player paints tiles. Closed fences become exhibits, and the player sets each exhibit's biome. Animals read their exhibit and their needs, and when something runs low (food, water, a broken fence) it becomes a job on the job board. Staff take jobs. Guests walk the paths, watch the animals they can see, spend money and leave a rating. The rating brings more guests, and money pays for more animals.

```
player commands ──> grid ──> exhibits (derived) ──> animals (needs, behavior)
                                    │                     │
                                    v                     v
                              viewing spots          job board ──> staff
                                    │
                                    v
                guests (needs, wants) ──> money, rating ──> more guests
```
Escapes cut across all of it: an animal outside its exhibit scares guests and posts a recapture job.

## 1. The grid
- The map is W x H tiles of 16 px. Each tile holds a few layers, each stored as a flat typed array (fast to read, small to save):
  - **water:** none, shallow or deep. The only ground the player paints.
  - **structure:** nothing, path, staff path, a fence (type, HP, flags for gate and window) or part of a building.
  - **object:** a plant, a rock, a shelter or a prop, with its variant.
- The map is flat for v2.0. There is no ground paint: outside the exhibits is park grass, and inside, the ground comes from the exhibit's biome.
- Every edit goes through a command (`paint`, `place`, `remove`) and fires `tilesChanged(area)`. Nothing else writes to the grid.
- **Derived layers** are rebuilt only for the area that changed, never saved:
  - **regions:** flood fill of the tiles that aren't fence. A region that doesn't reach the map edge or an open gate is an exhibit.
  - **who can stand where**, one mask per kind of mover: guests (paths), staff (paths, staff paths, and inside exhibits through a keeper gate), walkers (land inside their region), swimmers (water), amphibians (both).
  - **path network:** connected path areas, used by guests and staff for routing.

## 2. Exhibits
- An exhibit is a region record, rebuilt when its tiles change. It keeps its id across edits by matching the most overlap with its old tiles, so its name and animals stay put.
- It has one **biome**, set by the player after it closes (bare dirt until then). Merging two exhibits keeps the bigger one's biome; splitting one keeps it on both halves. Changing it later costs money and is instant.
- It tallies: tile count, shallow and deep water, plant tags (food by group and height, cover), shelters, keeper gates, feeders, and **viewing spots** (path tiles next to a fence a guest can see through, with how well, by fence type).
- It never decides anything. Species read it.

## 3. Species and animals
- **A species file:** real size (for display, diet and danger), biomes it likes (preferred first, then acceptable), water wants (%, depth), space per animal (in tiles), group size min and max, social style (solo, herd, pack), diet (plant tags and browse height, or prey size), temperament (shy, calm, aggressive), strength (how hard it tests fences), movement kind, active hours, period, price and appeal.
- **Habitat score:** the species compares its wants with the exhibit and gets one meter per need, plus an overall score. That's the panel. Biome: full marks if preferred, part if acceptable, poor otherwise.
- **An animal:** needs (hunger, thirst, rest, social, comfort from the habitat score) that drain over time, plus health and stress.
- **Behavior is a utility picker:** every few seconds each animal scores its possible actions by how much they'd fix its most urgent need, and does the best one: eat (a feeder, or browse a plant at its height), drink, rest (cover or a shelter), stay near its group, wander, show off. The same list serves every species; data switches extras on (herds flee together, packs move together, carnivores pace the fence).
- **Happiness** comes from the needs and the habitat score. It drives appeal to guests, health, breeding later, and stress.
- **Escapes:** a stressed, strong animal tests the fence tile in front of it and wears its HP down. Electric fences hurt while powered. A broken tile opens the region, the exhibit stops being closed, and an animal that walks out becomes escaped.

## 4. The job board and staff
- Systems never order staff around. They **post jobs**: "feed exhibit 3", "refill water", "repair fence at (40,12)", "pick up trash at (8,30)", "recapture animal 12". Each job has a role, a place, a priority and how long it takes.
- **Staff claim jobs:** an idle staff member of the matching role takes the job with the best priority for its distance, walks there, does it, and frees it. If they can't reach it, it goes back on the board with a reason ("No keeper gate.").
- **Roles:** keeper (food, water, cleaning pens), mechanic (fences, power), custodian (trash, restrooms), ranger (escapes). The slice needs only keepers.
- Keepers enter pens only through keeper gates. Food in v2.0: a keeper collects it at a food shed and the cost comes out of money. No supply chain.
- Staff energy and morale come later.

## 5. Guests
- **Arrivals:** guests come in at the entrance, in small groups. How many depends on rating, ticket price and the roster's appeal.
- **Needs:** hunger, thirst, bladder, energy, fun. Money in pocket.
- **Wants:** a short list of species they came to see, weighted by appeal (the headline animals).
- **Behavior is the same utility picker:** a pressing need sends them to the nearest service. Otherwise they head to the most appealing viewing spot they haven't used yet, and they leave when they're tired, broke or done.
- **Watching:** a guest at a viewing spot gains fun from what's actually visible (animals close to that edge, how happy they are, appeal, the fence's visibility). That's what makes where you put glass matter.
- **Money:** ticket at the gate, spending at shops. Litter becomes custodian jobs.
- **Rating:** satisfaction on the way out feeds the park rating, and the rating feeds arrivals.
- **Fear:** an escaped animal nearby makes guests run for the exit and drops the rating.
- **Thoughts:** short lines for the guest panel ("This T. rex is amazing.", "Too expensive.").

## 6. Shared machinery
- **The sim tick:** a fixed step in game time. Faster speeds run more steps per frame. The day clock runs on the same tick, with an end-of-day pass for the books and the day report.
- **Events:** `tilesChanged`, `exhibitChanged`, `animalEscaped`, `jobPosted`, `guestLeft`, `dayEnded`. Systems listen to these instead of calling each other.
- **Pathfinding:** A* over the right mask for each kind of mover, cached and thrown away on `tilesChanged`. Guests and staff route on the path network; animals wander inside their region with short hops.
- **"Who's near":** a coarse bucket grid (say 8 x 8 tiles), so checks like "guests near an escaped animal" stay cheap.
- **Commands:** the UI never edits the sim directly. It sends commands (paint, place, hire, set price), and the smoke test drives the game with the same commands.
- **Saving:** the tile layers, the entity lists (animals, staff, guests, jobs) and the clock, with a version number. Derived data is rebuilt on load.
- **Drawing:** the renderer only reads the sim. Each biome's ground is a base tile plus clumps of detail (dirt, tufts, pebbles, litter) picked from the tile's coordinates, so it looks varied but never changes between loads. Water is one tile set (shallow, deep, edges) recolored per biome by swapping its color ramp onto that biome's water ramp, done once at load; it's never a tint, so colors stay on the palette. Paths and fences are autotiled from the tile layers; then objects, buildings, animals and people are drawn sorted by their bottom edge.

## Open questions
- Food: keepers fetching from a food shed (as above), or a real supply chain like v1?
- Keeper safety: can keepers walk into a pen with an awake carnivore? Feeding hatches?
- Breeding and aging in v2.0, or later?
- Guests in groups or one by one?
- How long a day is, and how fast the needs drain.
