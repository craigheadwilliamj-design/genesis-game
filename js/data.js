/* =====================================================================
   GAME DATA
   This is the easiest file to tinker with. Change a price, add an
   animal, or make the game harder or easier here. Everything else reads
   from these lists.
   ===================================================================== */

// How the park starts
// Land for sale: a grid of parcels around the home plot (0,0 to 420,305). Grid lines on the home plot's edges keep it whole.
// A parcel costs its area times the rate for its ring, and can be bought once it touches land you own.
const PARCELS = {
  xs:[-280,-140,0,140,280,420,560,700],
  ys:[-400,-300,-200,-100,0,100,200,305],  // 305 is the entrance line (state.gate): nothing is for sale south of it
  home:[0,0,420,305],
  growth:0.12,  // every plot already bought adds this much to the price of the next (0.12 = +12% of the base price each)
  rates:[0, 0.8, 1.4],  // dollars per m² by ring (1 touches the home plot, 2 is the next one out)
};

// Rows south of the entrance line. Never for sale; only here so old saves that bought them keep their land.
const LEGACY_SOUTH_YS = [405, 505];

const START = {
  money: 150000,
  ticket: 25,          // ticket price in dollars
  rating: 1,           // starting star rating (0 to 5)
};

// How fast time passes. At 1x speed, one real second is this many park minutes.
// The park is open 8:00 AM to 8:00 PM (720 minutes), so 3 means a day lasts 240 seconds.
const MINUTES_PER_SECOND = 3;

// How fast full-pace walkers go on screen at 1x speed, in meters per real second at the OLD 6 minutes a second (half that now, with 3). Guests, keepers, and mechanics all use it.
const WALK_SPEED = 20;
// The same speed in meters per park minute, which is what the simulation counts in
const WALK_PER_MIN = WALK_SPEED / 6;   // fixed at the old 6 minutes a second, so a longer day doesn't change how far anyone gets in a park minute (on screen that halves WALK_SPEED)
// Staff (keepers, vets, mechanics, custodians, guards) walk at this share of WALK_PER_MIN (1 = the old sim speed; the longer day is what slows them on screen)
const STAFF_PACE = 1;
// The calendar: state.day stays the counter, the date is only how it is shown (fmtDate in sim.js). Day 1 is the 1st of the first month of startYear.
const CALENDAR = {daysPerMonth:30, startYear:1, months:["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]};
// The park day runs on a clock from ROLLOVER_HOUR (6 AM) to 11 PM, then jumps back. The sim counts in PARK minutes (DAY_MIN of them make one day, MINUTES_PER_SECOND a second on screen, so a day is still 240 s);
// the 24 h clock is only how a park minute is shown: CLOCK_SCALE clock minutes each. state.minute is park minutes since the daily rollover,
// which happens at ROLLOVER_HOUR on the clock (endDay and every *Night function run then). clockMin/minuteAtClock (sim.js) convert.
const DAY_MIN = 720;                    // park minutes in one day. Research, trips, and growing are counted in these.
const DAY_CLOCK = 17 * 60;              // clock minutes the day shows: 6 AM to 11 PM
const CLOCK_SCALE = DAY_CLOCK / DAY_MIN;     // clock minutes in a park minute
const ROLLOVER_HOUR = 6;                // the hour the day starts and turns over: weather rolls, bills are paid, staff reset
const ROLLOVER_CLOCK = ROLLOVER_HOUR * 60;
// Daylight on the clock (animals' awake schedules, the night wash on the map). Park-minute versions DAWN_MIN/DUSK_MIN are state.minute values.
const DAWN_CLOCK = 5 * 60, DUSK_CLOCK = 21 * 60;   // light from the first minute of the day until 9 PM
const DAWN_MIN = Math.max(0, (DAWN_CLOCK - ROLLOVER_CLOCK) / CLOCK_SCALE), DUSK_MIN = (DUSK_CLOCK - ROLLOVER_CLOCK) / CLOCK_SCALE;

// Building costs
const COST = {
  fencePerMeter: 25,     // exhibit fence, charged around the edge
  landPerSqM: 1,        // clearing and landscaping the inside of an exhibit
  pathPerMeter: 15,
  refundShare: 0.25,     // how much money you get back when you bulldoze something
  animalResale: 0.5,     // how much you get back when you sell an animal
};

// Daily running costs, charged when the park closes each night
const UPKEEP = {
  landPerSqM: 0.005,    // property tax a day on each bought parcel
  exhibitPerSqM: 0.02,
  pathPerMeter: 0.2,
};

// Animals.
//   price    what one costs to buy, or to clone at the Genetics Lab
//   food     feed cost per animal per day
//   space    square meters each animal needs
//   group    [fewest, most] of this species that are happy living together
//   appeal   how much guests want to see it
//   stars    park rating needed before you can buy or clone it
//   diet     a list of one or more: herbivore, omnivore, insectivore, piscivore, carnivore, frugivore, molluscovore
//            the first one sets its food and how it behaves with other species; frugivore and molluscovore go second (after herbivore, piscivore or carnivore) and are for labels and toys
//   predator true means it attacks any other species, so it can only live with its own kind
//   bug      true for insects, arachnids, and other arthropods
//   semi     true for the semi-aquatic tag, shown after the diet; they want more water in the exhibit and wade and swim in it
//
//   Who can share an exhibit (size means how much room each animal needs):
//     predators share with no other species
//     carnivores hunt any species smaller than themselves
//     insectivores and omnivores eat bugs smaller than themselves
//     herbivores and piscivores don't bother land animals
//   shop     true means partner parks sell it, so you can buy it without cloning
//   viv      "S", "M", or "L" means it lives in a vivarium at least that size, not an open exhibit
//   aqua     true for sea animals: viv is then the aquarium size it needs, and it lives only in an aquarium
//   floor    a sea animal that crawls the bottom of its aquarium instead of swimming
//   palu     a semi-aquatic vivarium animal that needs its vivarium laid out as a paludarium (PALU)
//   wade     a vivarium animal that swims in a paludarium's water and is happier for it, but does fine in a dry case (semi ones swim there too)
//   pool     a big sea animal: it lives in an open exhibit flooded with sea water (a pool, POOL), swims only in that water and never leaves it
//   deep     a pool animal that needs deep sea water for POOL.deepNeed of its pool
//   fresh    a pool animal from rivers and estuaries: any water counts for its pool, not just sea water
//   breach   a pool animal that now and then leaps clear of the water as it surfaces
const DIETS = {herbivore:"Herbivore", omnivore:"Omnivore", insectivore:"Insectivore", piscivore:"Piscivore", carnivore:"Carnivore", frugivore:"Frugivore", molluscovore:"Molluscovore"};

const SPECIES = [
  // Cambrian
  {id:"anom", name:"Anomalocaris",   period:"Cambrian", diet:["carnivore"], price:7000, food:12, space:15, group:[1,3], appeal:7, stars:1, viv:"M", aqua:true},
  {id:"opab", name:"Opabinia",       period:"Cambrian", diet:["carnivore"], price:3500, food:2, space:2, group:[3,8], appeal:5, stars:0.5, viv:"S", aqua:true},
  {id:"olen", name:"Olenoides",      period:"Cambrian", diet:["carnivore"], bug:true, price:2000, food:2, space:2, group:[4,12], appeal:3, stars:0, viv:"S", aqua:true, floor:true},
  // Ordovician
  {id:"saca", name:"Sacabambaspis",  period:"Ordovician", diet:["herbivore"], price:3000, food:3, space:3, group:[4,12], appeal:6, stars:0.5, viv:"S", aqua:true},
  {id:"came", name:"Cameroceras",    period:"Ordovician", diet:["carnivore"], price:14000, food:60, space:400, group:[1,3], appeal:9, stars:1.5, pool:true},
  // Silurian
  {id:"ptry", name:"Pterygotus",     period:"Silurian", diet:["carnivore"], bug:true, price:12000, food:30, space:60, group:[1,2], appeal:8, stars:1.5, viv:"L", aqua:true},
  // Devonian
  {id:"icht", name:"Ichthyostega",   period:"Devonian", diet:["piscivore"], price:4000, food:10, space:8, group:[2,6], appeal:4, stars:0.5, viv:"M", wade:true},
  {id:"tikt", name:"Tiktaalik",      period:"Devonian", diet:["piscivore"], price:4500, food:12, space:10, group:[2,6], appeal:5, stars:0.5, viv:"M", wade:true},
  {id:"both", name:"Bothriolepis",   period:"Devonian", diet:["herbivore"], price:3000, food:4, space:4, group:[3,10], appeal:3, stars:0.5, viv:"S", aqua:true, floor:true},
  {id:"dunk", name:"Dunkleosteus",   period:"Devonian", diet:["carnivore"], predator:true, price:26000, food:150, space:900, group:[1,2], appeal:13, stars:2.5, pool:true, deep:true},
  // Carboniferous
  {id:"stet", name:"Stethacanthus",  period:"Carboniferous", diet:["piscivore"], price:6000, food:15, space:20, group:[2,5], appeal:5, stars:1, viv:"M", aqua:true},
  {id:"rhiz", name:"Rhizodus",       period:"Carboniferous", diet:["carnivore","piscivore"], predator:true, price:18000, food:100, space:600, group:[1,2], appeal:9, stars:2, pool:true, fresh:true},
  {id:"mibr", name:"Microbrachis",   period:"Carboniferous", diet:["insectivore"], price:2500, food:4, space:4, group:[3,10], appeal:3, stars:0, viv:"S", wade:true},
  {id:"hylo", name:"Hylonomus",      period:"Carboniferous", diet:["insectivore"], price:2800, food:4, space:5, group:[2,8], appeal:3, stars:0, viv:"S"},
  {id:"arth", name:"Arthropleura",   period:"Carboniferous", diet:["herbivore"], bug:true, price:5000,  food:20,  space:25,   group:[1,6],  appeal:4,  stars:0,   viv:"L"},
  {id:"pulm", name:"Pulmonoscorpius", period:"Carboniferous", diet:["insectivore","carnivore"], bug:true, price:3000,  food:8,   space:6,    group:[1,3],  appeal:4,  stars:0,   viv:"S"},
  {id:"mega", name:"Meganeura",      period:"Carboniferous", diet:["insectivore"], bug:true, price:5000,  food:8,   space:20,   group:[4,12], appeal:4,  stars:0.5, viv:"M"},
  {id:"dcau", name:"Diplocaulus",    period:"Carboniferous", diet:["piscivore"], price:4000,  food:12,  space:10,   group:[2,6],  appeal:4,  stars:0.5, viv:"M", wade:true},
  {id:"eryo", name:"Eryops",         period:"Carboniferous", diet:["carnivore","piscivore"], price:5000, food:40, space:100, group:[2,5], appeal:4, stars:0.5},
  // Permian
  {id:"diic", name:"Diictodon",      period:"Permian", diet:["herbivore"], price:3000, food:6, space:6, group:[3,10], appeal:4, stars:0, viv:"S"},
  {id:"lyst", name:"Lystrosaurus",   period:"Permian", diet:["herbivore"], price:3500,  food:30,  space:120,  group:[3,10], appeal:2,  stars:0,   },
  {id:"seym", name:"Seymouria",      period:"Permian", diet:["insectivore","carnivore"], price:4000, food:8, space:8, group:[2,6], appeal:4, stars:0.5, viv:"M"},
  {id:"plhy", name:"Platyhystrix",   period:"Permian", diet:["carnivore"], price:4500, food:10, space:10, group:[2,5], appeal:5, stars:0.5, viv:"M"},
  {id:"mosc", name:"Moschops",       period:"Permian", diet:["herbivore"], price:8000, food:90, space:450, group:[2,6], appeal:6, stars:1},
  {id:"dime", name:"Dimetrodon",     period:"Permian", diet:["carnivore"], predator:true, price:9000,  food:90,  space:400,  group:[1,4],  appeal:6,  stars:1},
  {id:"scut", name:"Scutosaurus",    period:"Permian", diet:["herbivore"], price:8000,  food:90,  space:500,  group:[2,6],  appeal:6,  stars:1},
  {id:"este", name:"Estemmenosuchus", period:"Permian", diet:["herbivore"], price:9000, food:100, space:450, group:[2,5], appeal:7, stars:1},
  {id:"coty", name:"Cotylorhynchus", period:"Permian", diet:["herbivore"], price:13000, food:180, space:900, group:[2,5], appeal:8, stars:1.5},
  {id:"ante", name:"Anteosaurus",    period:"Permian", diet:["carnivore"], predator:true, price:15000, food:150, space:800, group:[1,3], appeal:9, stars:2},
  {id:"inos", name:"Inostrancevia",  period:"Permian", diet:["carnivore"], predator:true, price:16000, food:150, space:800,  group:[1,3],  appeal:10, stars:2.5},
  {id:"prio", name:"Prionosuchus",   period:"Permian", diet:["piscivore"], semi:true, price:18000, food:170, space:900,  group:[1,3],  appeal:10, stars:2.5},
  {id:"heli", name:"Helicoprion",    period:"Permian", diet:["carnivore","molluscovore"], price:22000, food:110, space:700, group:[1,3], appeal:12, stars:2.5, pool:true, deep:true},
  // Triassic
  {id:"sile", name:"Silesaurus",     period:"Triassic", diet:["omnivore"], price:3500, food:25, space:100, group:[3,10], appeal:3, stars:0},
  {id:"shar", name:"Sharovipteryx",  period:"Triassic", diet:["insectivore"], price:3800, food:4, space:5, group:[2,8], appeal:5, stars:0.5, viv:"S"},
  {id:"long", name:"Longisquama",    period:"Triassic", diet:["insectivore"], price:4000, food:5, space:6, group:[2,8], appeal:5, stars:0.5, viv:"S"},
  {id:"gigt", name:"Gigatitan",      period:"Triassic", diet:["insectivore"], bug:true, price:4500, food:6, space:14, group:[3,8], appeal:5, stars:0.5, viv:"M"},
  {id:"coel", name:"Coelophysis",    period:"Triassic", diet:["carnivore"], predator:true, price:6000,  food:60,  space:200,  group:[3,8],  appeal:4,  stars:0.5},
  {id:"herr", name:"Herrerasaurus",  period:"Triassic", diet:["carnivore"], predator:true, price:8000, food:70, space:300, group:[2,5], appeal:6, stars:1},
  {id:"desm", name:"Desmatosuchus",  period:"Triassic", diet:["herbivore"], price:9000, food:110, space:500, group:[2,6], appeal:6, stars:1},
  {id:"plat", name:"Plateosaurus",   period:"Triassic", diet:["herbivore"], price:12000, food:160, space:900,  group:[3,8],  appeal:8,  stars:1.5},
  {id:"noth", name:"Nothosaurus",    period:"Triassic", diet:["piscivore"], price:9000, food:40, space:150, group:[2,6], appeal:7, stars:1, pool:true},
  {id:"shon", name:"Shonisaurus",    period:"Triassic", diet:["piscivore","molluscovore"], price:48000, food:400, space:3000, group:[1,3], appeal:18, stars:3.5, pool:true, breach:true, deep:true},
  {id:"post", name:"Postosuchus",    period:"Triassic", diet:["carnivore"], predator:true, price:14000, food:130, space:700,  group:[1,3],  appeal:9,  stars:2},
  {id:"eryt", name:"Erythrosuchus",  period:"Triassic", diet:["carnivore"], predator:true, price:14000, food:140, space:800, group:[1,3], appeal:9, stars:2},
  {id:"liso", name:"Lisowicia",      period:"Triassic", diet:["herbivore"], price:16000, food:220, space:1300, group:[1,4], appeal:10, stars:2},
  // Jurassic
  {id:"prom", name:"Promicroceras",  period:"Jurassic", diet:["carnivore"], price:2500, food:3, space:3, group:[4,12], appeal:3, stars:0, viv:"S", aqua:true},
  {id:"ichy", name:"Ichthyosaurus",  period:"Jurassic", diet:["piscivore","molluscovore"], price:10000, food:30, space:120, group:[3,8], appeal:8, stars:1.5, pool:true, breach:true},
  {id:"hete", name:"Heterodontosaurus", period:"Jurassic", diet:["herbivore"], price:3500, food:25, space:80, group:[3,10], appeal:3, stars:0},
  {id:"anch", name:"Anchiornis",     period:"Jurassic", diet:["insectivore","carnivore"], price:4500, food:5, space:6, group:[2,8], appeal:5, stars:0.5, viv:"S"},
  {id:"comp", name:"Compsognathus",  period:"Jurassic", diet:["carnivore"], price:5000,  food:12,  space:12,   group:[4,12], appeal:4,  stars:0.5, viv:"M"},
  {id:"orni", name:"Ornitholestes",  period:"Jurassic", diet:["carnivore"], price:5000, food:40, space:100, group:[2,6], appeal:4, stars:0},
  {id:"yiqi", name:"Yi qi",          period:"Jurassic", diet:["insectivore"], price:5500,  food:8,   space:10,   group:[2,6],  appeal:5,  stars:1,   viv:"M"},
  {id:"arch", name:"Archaeopteryx",  period:"Jurassic", diet:["insectivore","carnivore"], price:6000,  food:10,  space:12,   group:[2,6],  appeal:6,  stars:1,   viv:"M"},
  {id:"dryo", name:"Dryosaurus",     period:"Jurassic", diet:["herbivore"], price:9000,  food:90,  space:400,  group:[3,10], appeal:6,  stars:1},
  {id:"dimo", name:"Dimorphodon",    period:"Jurassic", diet:["insectivore","carnivore"], price:7000,  food:50,  space:200,  group:[3,10], appeal:6,  stars:1},
  {id:"scel", name:"Scelidosaurus",  period:"Jurassic", diet:["herbivore"], price:9000, food:90, space:450, group:[2,8], appeal:6, stars:1},
  {id:"dilo", name:"Dilophosaurus",  period:"Jurassic", diet:["carnivore"], predator:true, price:16000, food:140, space:700,  group:[2,4],  appeal:12, stars:2.5},
  {id:"kent", name:"Kentrosaurus",   period:"Jurassic", diet:["herbivore"], price:16000, food:190, space:1000, group:[2,6], appeal:10, stars:2},
  {id:"steg", name:"Stegosaurus",    period:"Jurassic", diet:["herbivore"], price:22000, food:260, space:1500, group:[2,6],  appeal:12, stars:2.5},
  {id:"cryo", name:"Cryolophosaurus", period:"Jurassic", diet:["carnivore"], predator:true, price:22000, food:220, space:1300, group:[1,3], appeal:13, stars:3},
  {id:"cera", name:"Ceratosaurus",   period:"Jurassic", diet:["carnivore"], predator:true, price:30000, food:350, space:2000, group:[1,3], appeal:14, stars:3},
  {id:"mgal", name:"Megalosaurus",   period:"Jurassic", diet:["carnivore"], predator:true, price:33000, food:380, space:2500, group:[1,2], appeal:15, stars:3.5},
  {id:"allo", name:"Allosaurus",     period:"Jurassic", diet:["carnivore"], predator:true, price:40000, food:500, space:3000, group:[1,3],  appeal:17, stars:3.5},
  {id:"cama", name:"Camarasaurus",   period:"Jurassic", diet:["herbivore"], price:45000, food:600, space:4500, group:[2,6],  appeal:17, stars:3.5},
  {id:"torv", name:"Torvosaurus",    period:"Jurassic", diet:["carnivore"], predator:true, price:42000, food:450, space:3000, group:[1,2],  appeal:17, stars:4},
  {id:"apat", name:"Apatosaurus",    period:"Jurassic", diet:["herbivore"], price:47000, food:620, space:4700, group:[2,6], appeal:18, stars:4},
  {id:"dipl", name:"Diplodocus",     period:"Jurassic", diet:["herbivore"], price:50000, food:650, space:5000, group:[2,6],  appeal:19, stars:4},
  {id:"brac", name:"Brachiosaurus",  period:"Jurassic", diet:["herbivore"], price:52000, food:680, space:5200, group:[2,5], appeal:20, stars:4},
  {id:"scan", name:"Scansoriopteryx", period:"Jurassic", diet:["insectivore"], price:4500, food:4, space:5, group:[2,8], appeal:5, stars:0.5, viv:"S"},
  // Cretaceous
  {id:"hyps", name:"Hypsilophodon",  period:"Cretaceous", diet:["herbivore"], price:4000,  food:40,  space:150,  group:[3,8],  appeal:3,  stars:0,   },
  {id:"beel", name:"Beelzebufo",     period:"Cretaceous", diet:["carnivore"], price:4000, food:8, space:8, group:[1,4], appeal:5, stars:0.5, viv:"M", wade:true},
  {id:"mono", name:"Mononykus",      period:"Cretaceous", diet:["insectivore"], price:4500, food:5, space:6, group:[2,8], appeal:4, stars:0.5, viv:"S"},
  {id:"mcer", name:"Microceratus",   period:"Cretaceous", diet:["herbivore"], price:4500, food:6, space:8, group:[3,10], appeal:4, stars:0.5, viv:"S"},
  {id:"micr", name:"Microraptor",    period:"Cretaceous", diet:["carnivore","piscivore"], price:6000,  food:10,  space:12,   group:[2,6],  appeal:6,  stars:1,   viv:"M"},
  {id:"psit", name:"Psittacosaurus", period:"Cretaceous", diet:["herbivore"], price:6000,  food:50,  space:200,  group:[3,10], appeal:4,  stars:0.5},
  {id:"prot", name:"Protoceratops",  period:"Cretaceous", diet:["herbivore"], price:7000,  food:70,  space:250,  group:[2,8],  appeal:5,  stars:1.5},
  {id:"ornm", name:"Ornithomimus",   period:"Cretaceous", diet:["herbivore","insectivore"], price:7000, food:60, space:250, group:[3,10], appeal:5, stars:1},
  {id:"kool", name:"Koolasuchus",    period:"Cretaceous", diet:["piscivore"], price:7000, food:30, space:30, group:[1,3], appeal:6, stars:1, viv:"L", wade:true},
  {id:"simo", name:"Simosuchus",     period:"Cretaceous", diet:["herbivore"], price:5500, food:14, space:14, group:[2,5], appeal:3, stars:0.5, viv:"M"},
  {id:"ovir", name:"Oviraptor",      period:"Cretaceous", diet:["omnivore"], price:8000,  food:60,  space:250,  group:[2,8],  appeal:5,  stars:1},
  {id:"minm", name:"Minmi",          period:"Cretaceous", diet:["herbivore"], price:8000, food:70, space:300, group:[2,8], appeal:5, stars:1},
  {id:"gall", name:"Gallimimus",     period:"Cretaceous", diet:["omnivore"], price:9000, food:90, space:400, group:[3,10], appeal:6, stars:1.5},
  {id:"para", name:"Parasaurolophus", period:"Cretaceous", diet:["herbivore"], price:14000, food:180, space:900,  group:[3,10], appeal:8,  stars:2},
  {id:"pach", name:"Pachycephalosaurus", period:"Cretaceous", diet:["herbivore"], price:11000, food:100, space:450, group:[2,6], appeal:7, stars:1.5},
  {id:"igua", name:"Iguanodon",      period:"Cretaceous", diet:["herbivore"], price:18000, food:240, space:1200, group:[3,10], appeal:10, stars:2},
  {id:"velo", name:"Velociraptor",   period:"Cretaceous", diet:["carnivore"], predator:true, price:15000, food:120, space:500,  group:[3,6],  appeal:11, stars:2.5},
  {id:"pter", name:"Pteranodon",     period:"Cretaceous", diet:["piscivore"], price:16000, food:120, space:800,  group:[3,10], appeal:11, stars:2.5},
  {id:"conc", name:"Concavenator",   period:"Cretaceous", diet:["carnivore"], predator:true, price:18000, food:170, space:900, group:[1,3], appeal:11, stars:2.5},
  {id:"nige", name:"Nigersaurus",    period:"Cretaceous", diet:["herbivore"], price:20000, food:260, space:1500, group:[3,8],  appeal:10, stars:2.5},
  {id:"utah", name:"Utahraptor",     period:"Cretaceous", diet:["carnivore"], predator:true, price:24000, food:220, space:1200, group:[2,5],  appeal:14, stars:3},
  {id:"styr", name:"Styracosaurus",  period:"Cretaceous", diet:["herbivore"], price:26000, food:300, space:1800, group:[2,6],  appeal:13, stars:3},
  {id:"bary", name:"Baryonyx",       period:"Cretaceous", diet:["piscivore","carnivore"], price:30000, food:300, space:1800, group:[1,3],  appeal:14, stars:3},
  {id:"ther", name:"Therizinosaurus", period:"Cretaceous", diet:["herbivore"], price:30000, food:330, space:2000, group:[1,3], appeal:17, stars:3.5},
  {id:"dsuc", name:"Deinosuchus",    period:"Cretaceous", diet:["carnivore","piscivore"], predator:true, price:32000, food:350, space:2000, group:[1,3],  appeal:15, stars:3.5},
  {id:"yutt", name:"Yutyrannus",     period:"Cretaceous", diet:["carnivore"], predator:true, price:33000, food:350, space:2200, group:[1,3], appeal:16, stars:3.5},
  {id:"anky", name:"Ankylosaurus",   period:"Cretaceous", diet:["herbivore"], price:34000, food:380, space:2200, group:[1,4],  appeal:15, stars:3.5},
  {id:"tric", name:"Triceratops",    period:"Cretaceous", diet:["herbivore"], price:35000, food:400, space:2500, group:[1,5],  appeal:16, stars:3.5},
  {id:"cnot", name:"Carnotaurus",    period:"Cretaceous", diet:["carnivore"], predator:true, price:36000, food:380, space:2200, group:[1,2],  appeal:16, stars:3.5},
  {id:"dche", name:"Deinocheirus",   period:"Cretaceous", diet:["omnivore","piscivore"], price:38000, food:420, space:2500, group:[1,3],  appeal:16, stars:3.5},
  {id:"quet", name:"Quetzalcoatlus", period:"Cretaceous", diet:["carnivore"], price:45000, food:400, space:3000, group:[1,4],  appeal:19, stars:4},
  {id:"spin", name:"Spinosaurus",    period:"Cretaceous", diet:["piscivore","carnivore"], semi:true, price:55000, food:600, space:3500, group:[1,2],  appeal:20, stars:4},
  {id:"elsm", name:"Elasmosaurus",   period:"Cretaceous", diet:["piscivore"], price:38000, food:220, space:1800, group:[1,3], appeal:16, stars:3, pool:true, deep:true},
  {id:"mosa", name:"Mosasaurus",     period:"Cretaceous", diet:["carnivore"], predator:true, price:70000, food:600, space:3500, group:[1,2], appeal:22, stars:4.5, pool:true, breach:true, deep:true},
  {id:"pata", name:"Patagotitan",    period:"Cretaceous", diet:["herbivore"], price:60000, food:800, space:5500, group:[2,5], appeal:21, stars:4.5},
  {id:"carc", name:"Carcharodontosaurus", period:"Cretaceous", diet:["carnivore"], predator:true, price:70000, food:750, space:4000, group:[1,2],  appeal:22, stars:4.5},
  {id:"trex", name:"Tyrannosaurus rex", period:"Cretaceous", diet:["carnivore"], predator:true, price:80000, food:800, space:4000, group:[1,2],  appeal:25, stars:4.5},
  // Paleogene
  {id:"ples", name:"Plesiadapis",    period:"Paleogene", diet:["herbivore"], price:3500, food:6, space:6, group:[3,10], appeal:4, stars:0, viv:"S"},
  {id:"paki", name:"Pakicetus",      period:"Paleogene", diet:["piscivore"], price:5000, food:15, space:12, group:[2,6], appeal:5, stars:0.5, viv:"M"},
  {id:"lept", name:"Leptictidium",   period:"Paleogene", diet:["omnivore"], price:3200, food:5, space:5, group:[2,8], appeal:3, stars:0, viv:"S"},
  {id:"sifr", name:"Sifrhippus",     period:"Paleogene", diet:["herbivore"], price:4500, food:8, space:9, group:[3,8], appeal:4, stars:0.5, viv:"M"},
  {id:"ptil", name:"Ptilodus",       period:"Paleogene", diet:["omnivore"], price:3800, food:6, space:8, group:[3,8], appeal:3, stars:0.5, viv:"M"},
  {id:"miac", name:"Miacis",         period:"Paleogene", diet:["carnivore"], price:5500, food:10, space:12, group:[2,5], appeal:4, stars:0.5, viv:"M"},
  {id:"waim", name:"Waimanu",        period:"Paleogene", diet:["piscivore"], price:9000, food:20, space:22, group:[2,6], appeal:5, stars:1, viv:"L"},
  {id:"tmyr", name:"Titanomyrma",    period:"Paleogene", diet:["insectivore"], bug:true, price:2200, food:4, space:6, group:[1,4], appeal:1, stars:0, viv:"S"},
  {id:"hyae", name:"Hyaenodon",      period:"Paleogene", diet:["carnivore"], predator:true, price:9000,  food:80,  space:500,  group:[3,8],  appeal:7,  stars:1.5},
  {id:"ambu", name:"Ambulocetus",    period:"Paleogene", diet:["piscivore","carnivore"], price:12000, food:110, space:700,  group:[1,3],  appeal:8,  stars:2},
  {id:"uint", name:"Uintatherium",   period:"Paleogene", diet:["herbivore"], price:17000, food:200, space:1100, group:[2,5], appeal:10, stars:2},
  {id:"andr", name:"Andrewsarchus",  period:"Paleogene", diet:["carnivore","omnivore"], predator:true, price:20000, food:200, space:1200, group:[1,2],  appeal:11, stars:2.5},
  {id:"bari", name:"Barinasuchus",   period:"Paleogene", diet:["carnivore"], predator:true, price:20000, food:180, space:1100, group:[1,2],  appeal:10, stars:2.5},
  {id:"arsi", name:"Arsinoitherium", period:"Paleogene", diet:["herbivore"], price:24000, food:280, space:1800, group:[1,4], appeal:12, stars:3},
  {id:"tita", name:"Titanoboa",      period:"Paleogene", diet:["carnivore","piscivore"], predator:true, price:30000, food:250, space:1500, group:[1,2],  appeal:16, stars:3},
  {id:"basi", name:"Basilosaurus",   period:"Paleogene", diet:["carnivore"], predator:true, price:50000, food:500, space:3000, group:[1,2], appeal:17, stars:3.5, pool:true, breach:true, deep:true},
  {id:"pcer", name:"Paraceratherium", period:"Paleogene", diet:["herbivore"], price:40000, food:550, space:4000, group:[1,4],  appeal:17, stars:3.5},
  // Neogene
  {id:"enal", name:"Enaliarctos",    period:"Neogene", diet:["piscivore"], semi:true, price:11000, food:30, space:50, group:[2,4], appeal:7, stars:1.5, viv:"L", palu:true},
  {id:"kntr", name:"Kentriodon",     period:"Neogene", diet:["piscivore"], price:12000, food:30, space:60, group:[2,4], appeal:8, stars:1.5, viv:"L", aqua:true},
  {id:"mgdn", name:"Megalodon",      period:"Neogene", diet:["carnivore"], predator:true, price:85000, food:700, space:4000, group:[1,2], appeal:24, stars:4.5, pool:true, breach:true, deep:true},
  {id:"dino", name:"Dinopithecus",   period:"Neogene", diet:["omnivore"], price:7000, food:70, space:250, group:[4,12], appeal:6, stars:1},
  {id:"daeo", name:"Daeodon",        period:"Neogene", diet:["omnivore"], predator:true, price:11000, food:120, space:700,  group:[2,5],  appeal:8,  stars:1.5},
  {id:"aepy", name:"Aepycamelus",    period:"Neogene", diet:["herbivore"], price:12000, food:130, space:800, group:[2,6], appeal:7, stars:1.5},
  {id:"kele", name:"Kelenken",       period:"Neogene", diet:["carnivore"], predator:true, price:14000, food:100, space:700,  group:[1,3],  appeal:10, stars:2},
  {id:"mchl", name:"Megalochelys",   period:"Neogene", diet:["herbivore"], price:14000, food:120, space:900, group:[1,4], appeal:9, stars:2},
  {id:"chal", name:"Chalicotherium", period:"Neogene", diet:["herbivore"], price:15000, food:180, space:1000, group:[2,5], appeal:8, stars:2},
  {id:"drom", name:"Dromornis",      period:"Neogene", diet:["carnivore"], predator:true, price:18000, food:150, space:1000, group:[1,3], appeal:10, stars:2.5},
  {id:"plty", name:"Platybelodon",   period:"Neogene", diet:["herbivore"], price:20000, food:250, space:1500, group:[2,6],  appeal:10, stars:2.5},
  {id:"amph", name:"Amphicyon",      period:"Neogene", diet:["carnivore"], predator:true, price:20000, food:200, space:1100, group:[1,3], appeal:12, stars:2.5},
  {id:"siva", name:"Sivatherium",    period:"Neogene", diet:["herbivore"], price:25000, food:300, space:2000, group:[1,4], appeal:12, stars:3},
  {id:"dgal", name:"Deinogalerix",   period:"Neogene", diet:["insectivore","carnivore"], price:5500, food:10, space:12, group:[1,4], appeal:3, stars:0.5, viv:"M"},
  {id:"nura", name:"Nuralagus rex",  period:"Neogene", diet:["herbivore"], price:9000, food:16, space:20, group:[2,6], appeal:4, stars:1, viv:"L"},
  {id:"hopl", name:"Hoplitomeryx",   period:"Neogene", diet:["herbivore"], price:11000, food:22, space:26, group:[2,5], appeal:5, stars:1, viv:"L"},
  {id:"psil", name:"Psilopterus",    period:"Neogene", diet:["carnivore"], price:10000, food:20, space:26, group:[1,3], appeal:4, stars:1, viv:"L"},
  {id:"proc", name:"Proconsul",      period:"Neogene", diet:["herbivore","frugivore"], price:6000, food:50, space:150, group:[4,12], appeal:5, stars:1},
  {id:"arge", name:"Argentavis",     period:"Neogene", diet:["carnivore"], price:22000, food:150, space:800, group:[1,3], appeal:13, stars:3},
  // Quaternary
  {id:"ornw", name:"Ornimegalonyx",  period:"Quaternary", diet:["carnivore"], price:6000, food:25, space:14, group:[1,3], appeal:7, stars:1, viv:"M"},
  {id:"dodo", name:"Dodo",           period:"Quaternary", diet:["herbivore","frugivore"], price:14000, food:24, space:30, group:[2,5], appeal:6, stars:1.5, viv:"L"},
  {id:"ppig", name:"Passenger Pigeon", period:"Quaternary", diet:["herbivore","frugivore"], price:2600, food:3, space:4, group:[3,10], appeal:2, stars:0, viv:"S"},
  {id:"gtod", name:"Golden Toad",    period:"Quaternary", diet:["insectivore"], price:2800, food:3, space:4, group:[3,10], appeal:2, stars:0, viv:"S"},
  {id:"rmlo", name:"Rocky Mountain Locust", period:"Quaternary", diet:["herbivore"], bug:true, price:2400, food:3, space:4, group:[4,12], appeal:2, stars:0, viv:"S"},
  {id:"sdel", name:"Sicilian Dwarf Elephant", period:"Quaternary", diet:["herbivore"], price:15000, food:28, space:40, group:[1,3], appeal:6, stars:1.5, viv:"L"},
  {id:"dire", name:"Dire wolf",      period:"Quaternary", diet:["carnivore"], predator:true, price:11000, food:90,  space:500,  group:[3,8],  appeal:8,  stars:2},
  {id:"macr", name:"Macrauchenia",   period:"Quaternary", diet:["herbivore"], price:13000, food:150, space:900, group:[2,6], appeal:8, stars:2},
  {id:"mglo", name:"Megaloceros",    period:"Quaternary", diet:["herbivore"], price:13000, food:140, space:850, group:[2,6], appeal:8, stars:2},
  {id:"arct", name:"Arctodus",       period:"Quaternary", diet:["omnivore","carnivore"], predator:true, price:17000, food:160, space:1000, group:[1,2],  appeal:11, stars:2.5},
  {id:"doed", name:"Doedicurus",     period:"Quaternary", diet:["herbivore"], price:18000, food:200, space:1100, group:[1,4], appeal:10, stars:2.5},
  {id:"mgth", name:"Megatherium",    period:"Quaternary", diet:["herbivore"], price:20000, food:260, space:1500, group:[1,4],  appeal:11, stars:2.5},
  {id:"mlan", name:"Megalania",      period:"Quaternary", diet:["carnivore"], predator:true, price:22000, food:180, space:1200, group:[1,2],  appeal:12, stars:2.5},
  {id:"smil", name:"Smilodon",       period:"Quaternary", diet:["carnivore"], predator:true, price:18000, food:150, space:900,  group:[2,5],  appeal:11, stars:3},
  {id:"mast", name:"American mastodon", period:"Quaternary", diet:["herbivore"], price:24000, food:300, space:1900, group:[2,8],  appeal:12, stars:3},
  {id:"elas", name:"Elasmotherium",  period:"Quaternary", diet:["herbivore"], price:22000, food:280, space:1800, group:[1,4],  appeal:12, stars:3},
  {id:"mamm", name:"Woolly mammoth", period:"Quaternary", diet:["herbivore"], price:26000, food:320, space:2000, group:[2,8],  appeal:13, stars:3},
  {id:"colm", name:"Columbian mammoth", period:"Quaternary", diet:["herbivore"], price:30000, food:380, space:2400, group:[2,6], appeal:14, stars:3.5},
  {id:"thyl", name:"Thylacoleo",     period:"Quaternary", diet:["carnivore"], predator:true, price:14000, food:110, space:500, group:[1,3], appeal:10, stars:2},
  {id:"aind", name:"Archaeoindris",  period:"Quaternary", diet:["herbivore"], price:16000, food:180, space:900, group:[1,4], appeal:9, stars:2},
  {id:"gpit", name:"Gigantopithecus", period:"Quaternary", diet:["herbivore"], price:22000, food:260, space:1400, group:[1,4], appeal:12, stars:2.5},
  {id:"stel", name:"Steller's sea cow", period:"Quaternary", diet:["herbivore"], price:26000, food:250, space:1200, group:[2,6], appeal:12, stars:2.5, pool:true},
];

// Vivariums: ready-made glass enclosures for small animals. Placed like buildings.
// w and d are the size in meters; the inside space is w × d.
const VIVARIUMS = {
  S: {label:"Small vivarium",  w:10, d:5,  price:3000,  upkeep:30},
  M: {label:"Medium vivarium", w:15, d:10,  price:7000,  upkeep:60},
  L: {label:"Large vivarium",  w:25, d:15, price:15000, upkeep:120},
};
// Aquariums: vivariums full of sea water for the `aqua` species, the same sizes (so VIVARIUMS[size] gives their shape too). They need filters (AQUA).
const AQUARIUMS = {
  S: {label:"Small aquarium",  w:10, d:5,  price:5000,  upkeep:45},
  M: {label:"Medium aquarium", w:15, d:10,  price:11000, upkeep:90},
  L: {label:"Large aquarium",  w:25, d:15, price:24000, upkeep:180},
};

// Pools: an open exhibit flooded with sea water is home to the `pool` species. Sea water is two water types the water tool lays (SEA_WATER).
const POOL = {
  need:.75,        // share of the floor a pool animal wants under sea water (any water for a `fresh` one); a 0.5 m bank stays dry inside the fence
  deepNeed:.5,     // share of that water a `deep` animal wants deep
  happy:8,         // happiness a pool with enough water (deep enough) gives
  lack:45,         // happiness lost with no pool at all, less as the water nears what they want
};
// Crates: a boxed animal is a crate standing in the park until it's moved (science.js). It's drawn crate.png (14 x 17 px) scaled to the animal's size:
// the animal's radius over perRadius, from min to max times the picture; half is the crate's half-width in meters at 1x; gap: room kept between two crates and from the entrance
const CRATE = {min:1, max:4, perRadius:1.5, half:.95, gap:.4, entrance:9};
const poolsOn = () => devMode();   // pools, sea water, their animals and the Viewing Gallery: dev mode only until the animals have art
// Sea water: price is times WATER.perSqM. Pool animals swim in it; to land animals it is just water.
const SEA_WATER = {
  sea: {label:"Shallow sea", price:1.5},
  deep:{label:"Deep sea",    price:3},
};

/* ---------------------------------------------------------------------
   SCIENCE: The Research Lab, the Time Travel Lab, and the Genetics Lab
   --------------------------------------------------------------------- */

// Time periods. Every site in a period (TIME_SITES) shares its trip:
//   trip       what one expedition costs for a mid-size animal (a scouting trip costs the same)
//   days       how long a trip takes, in open days
//   risk       extra chance an expedition comes back with nothing. Big animals add more (see TRIP).
const TIME_PERIODS = [
  {id:"Quaternary",    ago:"2.6 million years ago to today", trip:3000,  days:1.5, risk:.05},
  {id:"Neogene",       ago:"23–2.6 million years ago", trip:3500,  days:1.5, risk:.07},
  {id:"Paleogene",     ago:"66–23 million years ago",  trip:4500,  days:1.5, risk:.10},
  {id:"Cretaceous",    ago:"145–66 million years ago",  trip:7500,  days:2.5, risk:.15},
  {id:"Jurassic",      ago:"201–145 million years ago", trip:7000,  days:2.5, risk:.15},
  {id:"Triassic",      ago:"252–201 million years ago", trip:5000,  days:2.5, risk:.12},
  {id:"Permian",       ago:"299–252 million years ago", trip:4500,  days:1.5, risk:.12},
  {id:"Carboniferous", ago:"359–299 million years ago", trip:4000,  days:1.5, risk:.10},
  {id:"Devonian",      ago:"419–359 million years ago", trip:3500,  days:1.5, risk:.10},
  {id:"Silurian",      ago:"443–419 million years ago", trip:3200,  days:1.5, risk:.10},
  {id:"Ordovician",    ago:"485–443 million years ago", trip:3100,  days:1.5, risk:.10},
  {id:"Cambrian",      ago:"539–485 million years ago", trip:3000,  days:1.5, risk:.10},
];

// The Time Travel Lab's timeline: every period gets one equal bar on the slider, split equally into its epochs. Each epoch is
// [name, years ago it began]; it ends where the next begins (the Holocene at TIMELINE_FLOOR, as a log scale can't reach 0).
// Epochs are only for the slider and its labels: `period` stays the unit of every mechanic.
const TIMELINE = [
  {id:"Cambrian", epochs:[["Early Cambrian",538.8e6],["Middle Cambrian",506.5e6],["Late Cambrian",497e6]]},
  {id:"Ordovician", epochs:[["Early Ordovician",485.4e6],["Middle Ordovician",471.3e6],["Late Ordovician",458.2e6]]},
  {id:"Silurian", epochs:[["Early Silurian",443.1e6],["Late Silurian",426.7e6]]},
  {id:"Devonian", epochs:[["Early Devonian",419.6e6],["Middle Devonian",393.3e6],["Late Devonian",382.7e6]]},
  {id:"Carboniferous", epochs:[["Mississippian",358.9e6],["Pennsylvanian",323.4e6]]},
  {id:"Permian", epochs:[["Cisuralian",298.9e6],["Guadalupian",273.0e6],["Lopingian",259.5e6]]},
  {id:"Triassic", epochs:[["Early Triassic",251.9e6],["Middle Triassic",246.7e6],["Late Triassic",237e6]]},
  {id:"Jurassic", epochs:[["Early Jurassic",201.4e6],["Middle Jurassic",174.7e6],["Late Jurassic",161.5e6]]},
  {id:"Cretaceous", epochs:[["Early Cretaceous",143.1e6],["Late Cretaceous",100.5e6]]},
  {id:"Paleogene", epochs:[["Paleocene",66.0e6],["Eocene",56.0e6],["Oligocene",33.9e6]]},
  {id:"Neogene", epochs:[["Miocene",23.03e6],["Pliocene",5.333e6]]},
  {id:"Quaternary", epochs:[["Pleistocene",2.58e6],["Holocene",11700]]},
];
const TIMELINE_FLOOR = 10;
// The map the Time Travel Lab shows for an epoch (by its name) or else its period: sprites/timeline/<name>.png, 260 x 130 Mollweide,
// drafted by tools/timeline/genmaps.py from the PALEOMAP PaleoDEMs (Scotese & Wright 2018, CC BY 4.0).
const TIMELINE_MAPS = {
  Cambrian:"cambrian", Ordovician:"ordovician", Silurian:"silurian", Devonian:"devonian", Carboniferous:"carboniferous",
  Permian:"permian", Triassic:"triassic", Jurassic:"jurassic", "Early Jurassic":"jurassic-early", "Late Jurassic":"jurassic-late",
  "Early Cretaceous":"cretaceous-early", "Late Cretaceous":"cretaceous-late", Paleogene:"paleogene", Neogene:"neogene",
  Pleistocene:"pleistocene", Holocene:"holocene",
};
const TIMELINE_MAP_SIZE = [260, 130];

// Sites the Time Travel Lab's drones visit: real fossil localities (or historical ranges for the recently extinct), plus museum events.
//   from/to   years ago the site's animals lived there; it shows for the whole of any epoch that window touches
//   at        its marker's pixel on each map it shows on (rotated back by plate reconstruction, nudged so markers never touch)
//   fauna     species found there (only the ones speciesAvailable shows); event: a MUSEUM_EVENTS id the Time Travel Lab records there
// TIME_SITES:BEGIN written by tools/timeline/placesites.py from sites.py; edit those, not this.
const TIME_SITES = [
  {id:"burgess", name:"Burgess Shale", where:"British Columbia, Canada", from:507e6, to:505e6, at:{cambrian:[68, 66]}, fauna:["anom", "opab", "olen"]},
  {id:"anzaldo", name:"Anzaldo Formation", where:"Sacabamba, Cochabamba, Bolivia", from:467e6, to:460e6, at:{ordovician:[32, 86]}, fauna:["saca"]},
  {id:"trenton", name:"Trenton Group", where:"Mohawk Valley, New York, USA", from:453e6, to:450e6, at:{ordovician:[95, 87]}, fauna:["came"]},
  {id:"lesmahagow", name:"Lesmahagow Inlier", where:"South Lanarkshire, Scotland", from:430e6, to:427e6, at:{silurian:[118, 86]}, fauna:["ptry"]},
  {id:"fram", name:"Fram Formation", where:"Ellesmere Island, Canada", from:378e6, to:372e6, at:{devonian:[117, 65]}, fauna:["tikt"]},
  {id:"britta", name:"Britta Dal Formation", where:"East Greenland", from:367e6, to:360e6, at:{devonian:[127, 71]}, fauna:["icht", "both"]},
  {id:"cleveland", name:"Cleveland Shale", where:"Cleveland, Ohio, USA", from:362e6, to:359e6, at:{devonian:[110, 94]}, fauna:["dunk"]},
  {id:"ekirkton", name:"East Kirkton", where:"West Lothian, Scotland", from:336e6, to:334e6, at:{carboniferous:[136, 61]}, fauna:["pulm"]},
  {id:"burdiehouse", name:"Burdiehouse Limestone", where:"Edinburgh, Scotland", from:340e6, to:337e6, at:{carboniferous:[129, 61]}, fauna:["rhiz"]},
  {id:"joggins", name:"Joggins Fossil Cliffs", where:"Nova Scotia, Canada", from:315e6, to:312e6, at:{carboniferous:[126, 70]}, fauna:["hylo", "arth"]},
  {id:"beargulch", name:"Bear Gulch Limestone", where:"Montana, USA", from:324e6, to:318e6, at:{carboniferous:[105, 58]}, fauna:["stet"]},
  {id:"nyrany", name:"Nýřany", where:"Bohemia, Czechia", from:308e6, to:306e6, at:{carboniferous:[144, 63]}, fauna:["mibr"]},
  {id:"commentry", name:"Commentry", where:"Allier, France", from:302e6, to:300e6, at:{carboniferous:[140, 70]}, fauna:["mega"]},
  {id:"pennredbeds", name:"Late Pennsylvanian red beds", where:"Texas and New Mexico, USA", from:304e6, to:299.5e6, at:{carboniferous:[103, 67]}, fauna:["dcau", "eryo"]},
  {id:"phosphoria", name:"Phosphoria Formation", where:"Southeastern Idaho, USA", from:279e6, to:272e6, at:{permian:[106, 47]}, fauna:["heli"]},
  {id:"elcobre", name:"El Cobre Canyon", where:"New Mexico, USA", from:298e6, to:293e6, at:{permian:[104, 54]}, fauna:["plhy"]},
  {id:"texasred", name:"Texas Red Beds", where:"Texas, USA", from:290e6, to:275e6, at:{permian:[106, 61]}, fauna:["dime", "seym"]},
  {id:"hennessey", name:"Hennessey Formation", where:"Oklahoma, USA", from:276e6, to:272e6, at:{permian:[114, 60]}, fauna:["coty"]},
  {id:"pedrafogo", name:"Pedra de Fogo Formation", where:"Maranhão, Brazil", from:280e6, to:272e6, at:{permian:[121, 87]}, fauna:["prio"]},
  {id:"ocher", name:"Ocher", where:"Perm Krai, Russia", from:268e6, to:265e6, at:{permian:[161, 37]}, fauna:["este"]},
  {id:"karootapino", name:"Karoo, Tapinocephalus Zone", where:"Western Cape, South Africa", from:265e6, to:260e6, at:{permian:[109, 113]}, fauna:["mosc", "ante"]},
  {id:"karoolate", name:"Karoo, Daptocephalus Zone", where:"Eastern Cape, South Africa", from:256e6, to:252.2e6, at:{permian:[116, 114]}, fauna:["diic", "lyst"]},
  {id:"dvina", name:"Sokolki, Northern Dvina", where:"Arkhangelsk, Russia", from:255e6, to:253e6, at:{permian:[153, 37]}, fauna:["scut", "inos"]},
  {id:"muschelkalk", name:"Upper Muschelkalk", where:"Franconia, Germany", from:242e6, to:238e6, at:{triassic:[129, 37]}, fauna:["noth"]},
  {id:"luning", name:"Luning Formation", where:"Berlin-Ichthyosaur State Park, Nevada, USA", from:229e6, to:225e6, at:{triassic:[90, 47]}, fauna:["shon"]},
  {id:"burgersdorp", name:"Burgersdorp Formation", where:"Eastern Cape, South Africa", from:247.5e6, to:247e6, at:{triassic:[128, 108]}, fauna:["eryt"]},
  {id:"madygen", name:"Madygen Formation", where:"Batken, Kyrgyzstan", from:236e6, to:232e6, at:{triassic:[165, 25]}, fauna:["shar", "long", "gigt"]},
  {id:"ischigualasto", name:"Ischigualasto Formation", where:"San Juan, Argentina", from:231e6, to:226e6, at:{triassic:[110, 99]}, fauna:["herr"]},
  {id:"krasiejow", name:"Krasiejów", where:"Opole, Poland", from:230e6, to:225e6, at:{triassic:[136, 33]}, fauna:["sile"]},
  {id:"chinle", name:"Chinle Formation", where:"Petrified Forest, Arizona, USA", from:225e6, to:208e6, at:{triassic:[89, 55]}, fauna:["post", "desm"]},
  {id:"trossingen", name:"Trossingen", where:"Baden-Württemberg, Germany", from:214e6, to:208e6, at:{triassic:[136, 40]}, fauna:["plat"]},
  {id:"ghostranch", name:"Ghost Ranch", where:"New Mexico, USA", from:212e6, to:206e6, at:{triassic:[97, 55]}, fauna:["coel"]},
  {id:"lisowice", name:"Lisowice", where:"Silesia, Poland", from:208e6, to:202e6, at:{triassic:[143, 32]}, fauna:["liso"]},
  {id:"dorset", name:"Dorset Coast", where:"Lyme Regis, England", from:199e6, to:190e6, at:{"jurassic-early":[133, 32]}, fauna:["dimo", "scel", "prom", "ichy"]},
  {id:"elliot", name:"Elliot Formation", where:"Eastern Cape, South Africa", from:200e6, to:190e6, at:{"jurassic-early":[127, 101]}, fauna:["hete"]},
  {id:"kayenta", name:"Kayenta Formation", where:"Arizona, USA", from:196e6, to:183e6, at:{"jurassic-early":[92, 46]}, fauna:["dilo"]},
  {id:"hanson", name:"Hanson Formation", where:"Mount Kirkpatrick, Antarctica", from:194e6, to:188e6, at:{"jurassic-early":[146, 113]}, fauna:["cryo"]},
  {id:"stonesfield", name:"Stonesfield Slate", where:"Oxfordshire, England", from:168e6, to:166e6, at:{jurassic:[135, 29]}, fauna:["mgal"]},
  {id:"daohugou", name:"Daohugou and Tiaojishan", where:"Liaoning and Hebei, China", from:165e6, to:158e6, at:{jurassic:[202, 26], "jurassic-late":[203, 28]}, fauna:["anch", "yiqi", "scan"]},
  {id:"morrison", name:"Morrison Formation", where:"Wyoming, Colorado and Utah, USA", from:156e6, to:147e6, at:{"jurassic-late":[96, 32]}, fauna:["allo", "steg", "cera", "torv", "orni", "dryo", "cama", "apat", "dipl", "brac"]},
  {id:"tendaguru", name:"Tendaguru", where:"Lindi, Tanzania", from:155e6, to:150e6, at:{"jurassic-late":[141, 91]}, fauna:["kent", "dryo"]},
  {id:"solnhofen", name:"Solnhofen Limestone", where:"Bavaria, Germany", from:151e6, to:150e6, at:{"jurassic-late":[141, 29]}, fauna:["arch", "comp"]},
  {id:"pierre", name:"Pierre Shale", where:"Wallace County, Kansas, USA", from:80.5e6, to:79.5e6, at:{"cretaceous-late":[84, 25]}, fauna:["elsm"]},
  {id:"maastricht", name:"Maastricht Formation", where:"Limburg, Netherlands", from:68e6, to:66.1e6, at:{"cretaceous-late":[135, 28]}, fauna:["mosa"]},
  {id:"cedarmtn", name:"Cedar Mountain Formation", where:"Utah, USA", from:135e6, to:125e6, at:{"cretaceous-early":[90, 30]}, fauna:["utah"]},
  {id:"wealden", name:"Wealden Group", where:"Isle of Wight, England", from:130e6, to:125e6, at:{"cretaceous-early":[136, 29]}, fauna:["hyps", "igua", "bary"]},
  {id:"lashoyas", name:"Las Hoyas", where:"Cuenca, Spain", from:127e6, to:125e6, at:{"cretaceous-early":[135, 38]}, fauna:["conc"]},
  {id:"yixian", name:"Yixian Formation", where:"Liaoning, China", from:125e6, to:120e6, at:{"cretaceous-early":[202, 27]}, fauna:["micr", "yutt", "psit"]},
  {id:"victoria", name:"Strzelecki and Bungil Formations", where:"Victoria and Queensland, Australia", from:125e6, to:110e6, at:{"cretaceous-early":[154, 126]}, fauna:["kool", "minm"]},
  {id:"elrhaz", name:"Elrhaz Formation", where:"Gadoufaoua, Niger", from:115e6, to:110e6, at:{"cretaceous-early":[133, 60]}, fauna:["nige"]},
  {id:"cerrobarcino", name:"Cerro Barcino Formation", where:"Chubut, Argentina", from:102e6, to:101e6, at:{"cretaceous-early":[109, 101]}, fauna:["pata"]},
  {id:"kemkem", name:"Kem Kem Beds", where:"Morocco", from:100e6, to:94e6, at:{"cretaceous-late":[128, 45]}, fauna:["spin", "carc"]},
  {id:"niobrara", name:"Niobrara Chalk", where:"Kansas, USA", from:87e6, to:82e6, at:{"cretaceous-late":[91, 27]}, fauna:["pter"]},
  {id:"aguja", name:"Aguja Formation", where:"Big Bend, Texas, USA", from:80e6, to:75e6, at:{"cretaceous-late":[76, 32]}, fauna:["dsuc"]},
  {id:"dinopark", name:"Dinosaur Park Formation", where:"Alberta, Canada", from:77e6, to:75e6, at:{"cretaceous-late":[93, 12]}, fauna:["styr", "para"]},
  {id:"djadokhta", name:"Djadokhta Formation", where:"Gobi Desert, Mongolia", from:75e6, to:71e6, at:{"cretaceous-late":[190, 30]}, fauna:["velo", "prot", "ovir", "mcer"]},
  {id:"lacolonia", name:"La Colonia Formation", where:"Chubut, Argentina", from:72e6, to:69e6, at:{"cretaceous-late":[98, 103]}, fauna:["cnot"]},
  {id:"nemegt", name:"Nemegt Formation", where:"Gobi Desert, Mongolia", from:70e6, to:68e6, at:{"cretaceous-late":[183, 31]}, fauna:["gall", "ther", "dche", "mono"]},
  {id:"maevarano", name:"Maevarano Formation", where:"Mahajanga, Madagascar", from:70e6, to:66.1e6, at:{"cretaceous-late":[154, 93]}, fauna:["beel", "simo"]},
  {id:"javelina", name:"Javelina Formation", where:"Big Bend, Texas, USA", from:69e6, to:66.1e6, at:{"cretaceous-late":[84, 32]}, fauna:["quet"]},
  {id:"hellcreek", name:"Hell Creek Formation", where:"Montana, USA", from:67e6, to:66.1e6, at:{"cretaceous-late":[92, 19]}, fauna:["trex", "tric", "anky", "pach", "ornm"]},
  {id:"wadihitan", name:"Wadi Al-Hitan", where:"Faiyum, Egypt", from:40e6, to:37e6, at:{paleogene:[154, 47]}, fauna:["basi"]},
  {id:"waipara", name:"Waipara Greensand", where:"Canterbury, New Zealand", from:62e6, to:60e6, at:{paleogene:[43, 108]}, fauna:["waim"]},
  {id:"fortunion", name:"Fort Union Formation", where:"Montana, USA", from:62e6, to:57e6, at:{paleogene:[84, 19]}, fauna:["ptil", "ples"]},
  {id:"cerrejon", name:"Cerrejón Formation", where:"La Guajira, Colombia", from:60e6, to:58e6, at:{paleogene:[82, 57]}, fauna:["tita"]},
  {id:"bighorn", name:"Bighorn Basin", where:"Wyoming, USA", from:56e6, to:54e6, at:{paleogene:[76, 23]}, fauna:["sifr", "miac"]},
  {id:"kuldana", name:"Kuldana Formation", where:"Kohat, Pakistan", from:50e6, to:47e6, at:{paleogene:[177, 54]}, fauna:["paki", "ambu"]},
  {id:"bridger", name:"Bridger and Uinta Basins", where:"Wyoming and Utah, USA", from:50e6, to:44e6, at:{paleogene:[69, 25]}, fauna:["uint"]},
  {id:"messel", name:"Messel Pit", where:"Hesse, Germany", from:48e6, to:47e6, at:{paleogene:[133, 25]}, fauna:["lept", "tmyr"]},
  {id:"irdinmanha", name:"Irdin Manha Formation", where:"Inner Mongolia, China", from:45e6, to:40e6, at:{paleogene:[190, 26]}, fauna:["andr"]},
  {id:"venezuela", name:"Parángula Formation", where:"Barinas, Venezuela", from:45e6, to:36e6, at:{paleogene:[90, 59]}, fauna:["bari"]},
  {id:"fayum", name:"Fayum Depression", where:"Egypt", from:37e6, to:30e6, at:{paleogene:[147, 47]}, fauna:["arsi"]},
  {id:"whiteriver", name:"White River Badlands", where:"South Dakota, USA", from:34e6, to:30e6, at:{paleogene:[84, 27]}, fauna:["hyae"]},
  {id:"bugti", name:"Dera Bugti", where:"Balochistan, Pakistan", from:28e6, to:23.1e6, at:{paleogene:[175, 61]}, fauna:["pcer"]},
  {id:"pyramid", name:"Pyramid Hill", where:"Kern County, California, USA", from:23e6, to:22e6, at:{neogene:[61, 34]}, fauna:["enal"]},
  {id:"calvert", name:"Calvert Cliffs", where:"Chesapeake Bay, Maryland, USA", from:16e6, to:14e6, at:{neogene:[86, 31]}, fauna:["kntr", "mgdn"]},
  {id:"agate", name:"Nebraska Miocene beds", where:"Agate Fossil Beds, Nebraska, USA", from:22e6, to:15e6, at:{neogene:[70, 28]}, fauna:["daeo", "aepy", "amph"]},
  {id:"rusinga", name:"Rusinga Island", where:"Lake Victoria, Kenya", from:18e6, to:17e6, at:{neogene:[153, 66]}, fauna:["proc"]},
  {id:"patagonia", name:"Santa Cruz and Collón Curá Formations", where:"Patagonia, Argentina", from:18e6, to:14e6, at:{neogene:[92, 104]}, fauna:["psil", "kele"]},
  {id:"tunggur", name:"Tunggur Formation", where:"Inner Mongolia, China", from:13e6, to:11e6, at:{neogene:[196, 28]}, fauna:["plty", "chal"]},
  {id:"epecuen", name:"Epecuén Formation", where:"La Pampa, Argentina", from:9e6, to:6e6, at:{neogene:[93, 96]}, fauna:["arge"]},
  {id:"alcoota", name:"Alcoota", where:"Northern Territory, Australia", from:8e6, to:7e6, at:{neogene:[215, 93]}, fauna:["drom"]},
  {id:"gargano", name:"Gargano", where:"Apulia, Italy", from:7e6, to:5.4e6, at:{neogene:[139, 29]}, fauna:["dgal", "hopl"]},
  {id:"menorca", name:"Menorca", where:"Balearic Islands, Spain", from:5e6, to:3e6, at:{neogene:[131, 29]}, fauna:["nura"]},
  {id:"siwaliks", name:"Siwalik Hills", where:"India and Pakistan", from:5e6, to:2.6e6, at:{neogene:[179, 40]}, fauna:["siva", "mchl"]},
  {id:"cradle", name:"Cradle of Humankind", where:"Gauteng, South Africa", from:3e6, to:2.6e6, at:{neogene:[147, 88]}, fauna:["dino"]},
  {id:"guangxi", name:"Guangxi caves", where:"Guangxi, China", from:2e6, to:0.3e6, at:{pleistocene:[204, 43]}, fauna:["gpit"]},
  {id:"pampas", name:"The Pampas", where:"Buenos Aires, Argentina", from:0.5e6, to:12000, at:{pleistocene:[91, 95]}, fauna:["mgth", "doed", "macr", "smil"]},
  {id:"naracoorte", name:"Naracoorte Caves", where:"South Australia", from:0.5e6, to:40000, at:{pleistocene:[218, 97]}, fauna:["thyl", "mlan"]},
  {id:"sicily", name:"Sicily", where:"Italy", from:0.5e6, to:0.2e6, at:{pleistocene:[138, 32]}, fauna:["sdel"]},
  {id:"steppe", name:"Mammoth Steppe", where:"Northern Eurasia", from:0.3e6, to:12000, at:{pleistocene:[160, 18]}, fauna:["mamm", "elas", "mglo"]},
  {id:"cuba", name:"Cuba", where:"Caribbean", from:0.1e6, to:12000, at:{pleistocene:[75, 45]}, fauna:["ornw"]},
  {id:"labrea", name:"Rancho La Brea", where:"Los Angeles, California, USA", from:50000, to:12000, at:{pleistocene:[53, 35]}, fauna:["smil", "dire", "arct", "colm", "mast"]},
  {id:"commander", name:"Commander Islands", where:"Bering Sea, 1740s", from:283, to:256, at:{holocene:[214, 18]}, fauna:["stel"]},
  {id:"madagascar", name:"Central Highlands", where:"Madagascar", from:8000, to:2000, at:{holocene:[162, 81]}, fauna:["aind"]},
  {id:"mauritius", name:"Mauritius", where:"Indian Ocean, 1600s", from:1000, to:362, at:{holocene:[169, 82]}, fauna:["dodo"]},
  {id:"eastna", name:"Eastern North America", where:"1800s", from:300, to:112, at:{holocene:[81, 30]}, fauna:["ppig"]},
  {id:"plains", name:"Great Plains", where:"1870s", from:200, to:124, at:{holocene:[69, 29]}, fauna:["rmlo"]},
  {id:"monteverde", name:"Monteverde Cloud Forest", where:"Costa Rica, 1980s", from:100, to:37, at:{holocene:[69, 55]}, fauna:["gtod"]},
  {id:"chengjiang", name:"Chengjiang", where:"Yunnan, China", from:520e6, to:515e6, at:{cambrian:[232, 35]}, event:"ev-cambrian"},
  {id:"miguasha", name:"Miguasha", where:"Quebec, Canada", from:381e6, to:379e6, at:{devonian:[119, 90]}, event:"ev-tetrapods"},
  {id:"traps", name:"Siberian Traps", where:"Norilsk, Russia", from:252.5e6, to:251.9e6, at:{permian:[153, 23]}, event:"ev-dying"},
  {id:"chicxulub", name:"Chicxulub", where:"Yucatán, Mexico", from:66.1e6, to:66e6, at:{"cretaceous-late":[86, 41]}, event:"ev-kpg"},
  {id:"hadean", name:"The young Earth", where:"Everywhere", from:4500e6, to:4400e6, at:{}, event:"ev-hadean"},
  {id:"hamersley", name:"Hamersley Basin", where:"Western Australia", from:2450e6, to:2300e6, at:{}, event:"ev-oxygen"},
];
// TIME_SITES:END

// Science staff, hired at their department's building
//   dept       the building they work in
//   hireCost   one-time cost to hire
//   wage       pay per day
const SCIENTISTS = {
  paleo:    {label:"Researcher",         plural:"Researchers",         dept:"oracle", hireCost:3000, wage:250,
             text:"Each one runs one research bay. Left on general research, a researcher earns 4 research points a day. Put them on a project and they stop earning until it is done."},
  gene:     {label:"Geneticist",          plural:"Geneticists",          dept:"tar",    hireCost:3500, wage:350,
             text:"Each one runs an incubator bay, so the Genetics Lab can grow that many clones at the same time."},
  botanist: {label:"Botanist",            plural:"Botanists",            dept:"ceres",  hireCost:3000, wage:300,
             text:"Each one tends a growing bed, so the Botany Lab can grow that many batches at the same time."},
};
const RESEARCH_PER_PALEO = 4;   // research points each researcher earns per open day while they're on general research (no project)
const RESEARCH_GUEST = .03;     // research points a guest adds on leaving, times how much they learned (0 to 1). Educated crowds fund science.
// How long research takes, in park minutes per point. A 60-point project is 2 open days.
const RESEARCH_MIN_PER_POINT = DAY_MIN / 30;

// Expeditions. A trip either finds something or comes back empty-handed, and a find fills part of a genome.
// Bigger animals are harder to find, and a genome takes about 2 trips for the smallest and 8 for the largest.
//   fail     chance of nothing, before the period's own risk: [smallest animal, largest animal]
//   trips    trips a genome takes on average: [smallest, largest]
//   spread   a find is worth between this share less and this share more than average
//   costMul  trip price multiplier: [smallest, largest]
//   bonus    chance a trip also turns up traces of another discovered animal at the same site, and what they add
const TRIP = {fail:[.1, .35], trips:[2, 8], spread:.35, costMul:[.35, 1.3], bonus:{chance:.12, gain:[4, 8]}};
// Scouting trips. The first to a site always lights it (its name and trip). Each animal not yet seen there turns up with its own
// chance, `find` [smallest animal, largest] (big ones are easier to spot), at most `max` a trip. An animal turning up is
// what discovers it (state.science.unlocked).
const SCOUT = {find:[.35, .65], max:2};
// The Time Travel Lab's drones replace expedition teams: each flies one trip at a time. The Time Travel Lab comes with one; the next costs `price`, and each
// one after that `growth` times the last, up to `max`. They aren't staff (no wage).
const DRONES = {max:5, price:15000, growth:1.5};
// Drone marks: every park starts with Mk. I; the Research Lab researches the rest in order (TECH ghostmk2-5). `cut` is the share of the
// chance a trip comes back empty handed that the mark takes away, scouting and expeditions alike.
const GHOST_MK = [{name:"Mk. I", cut:0}, {name:"Mk. II", tech:"ghostmk2", cut:.15}, {name:"Mk. III", tech:"ghostmk3", cut:.3},
                  {name:"Mk. IV", tech:"ghostmk4", cut:.4}, {name:"Mk. V", tech:"ghostmk5", cut:.5}];
// Size scale for TRIP: m² of room an animal needs at or below the first, and at or above the second
const TRIP_SIZE = [10, 5000];

// Plant genomes, one per Mesozoic or Paleozoic period. The Time Travel Lab collects each from its own period, once the Research Lab has researched that era's flora.
// The Botany Lab needs a period's genome complete before it grows that period's plants (and any complete one lets it grow Paleoflora food).
//   space   how hard it is to find, like an animal's room (see TRIP_SIZE)
const PLANT_DNA = {};
for(const [period, era, space] of [["Devonian", "paleozoic", 900], ["Carboniferous", "paleozoic", 900], ["Permian", "paleozoic", 900],
                                   ["Triassic", "mesozoic", 300], ["Jurassic", "mesozoic", 300], ["Cretaceous", "mesozoic", 300]])
  PLANT_DNA[period] = {id:"flora-" + period, era, period, name:period + " flora", space};
const PLANT_DNA_BY_ID = Object.fromEntries(Object.values(PLANT_DNA).map(p => [p.id, p]));

// Events from deep time. The Time Travel Lab records each one on trips (like a genome: sc.dna[id]), and a finished record unlocks a museum
// attraction for the Education Center. A trip's place is the event itself, so it carries what a TIME_PERIODS entry does.
//   ago/trip/days/risk/space   as for a period and a genome (space is how hard it is to record, see TRIP_SIZE)
//   price/upkeep   installing it in an Education Center, and its cost a day
//   learn   extra learning a visit gives (0 to 100 per guest)
//   joy     mood it adds or takes away. appeal: how much keener guests are to visit the center for it
const MUSEUM_EVENTS = [
  {id:"ev-oxygen",    name:"Great Oxygenation Event", ago:"2.4 billion years ago",  trip:6500,  days:3,   risk:.20, space:600,  price:6000,  upkeep:60,  learn:6,  joy:1, appeal:4,
   text:"Walk through a glowing blue-green sea as the first oxygen-makers poison the old air and the iron rusts red."},
  {id:"ev-hadean",    name:"Hadean Earth",            ago:"4.5 billion years ago",  trip:9000,  days:3.5, risk:.25, space:1500, price:9000,  upkeep:90,  learn:7,  joy:3, appeal:9,
   text:"A hall of lava seas, a sky full of rocks, and the Moon hanging huge and close. Nothing lives here yet."},
  {id:"ev-cambrian",  name:"Cambrian Explosion",      ago:"539 million years ago",  trip:7000,  days:2.5, risk:.15, space:800,  price:8000,  upkeep:80,  learn:8,  joy:3, appeal:8,
   text:"A reef tank of trilobites, spined worms and Anomalocaris, when nearly every kind of body suddenly appeared."},
  {id:"ev-tetrapods", name:"Evolution of Tetrapods",  ago:"375 million years ago",  trip:5500,  days:2,   risk:.12, space:700,  price:7000,  upkeep:70,  learn:7,  joy:2, appeal:6,
   text:"Follow a Tiktaalik-like fish from the shallows up onto the mud, as fins turn into legs."},
  {id:"ev-dying",     name:"The Great Dying",         ago:"252 million years ago",  trip:7500,  days:2.5, risk:.18, space:1000, price:9000,  upkeep:90,  learn:10, joy:-3, appeal:7,
   text:"The worst mass extinction there ever was, told in a dim hall of volcanoes and a dying sea. Sobering."},
  {id:"ev-kpg",       name:"K-Pg Impact",             ago:"66 million years ago",   trip:8000,  days:2.5, risk:.15, space:1200, price:10000, upkeep:100, learn:9,  joy:1, appeal:12,
   text:"A shaking floor, a fireball overhead, and the end of the dinosaurs. A crowd favorite."},
];
const MUSEUM_BY_ID = Object.fromEntries(MUSEUM_EVENTS.map(e => [e.id, e]));
const MUSEUM = {
  slots:3,             // attractions one Education Center can show at once
  needTech:"education",// The Time Travel Lab can start recording events once the Research Lab has researched this
};

// What an Education Center is for. A center with a focus gets its effect every visit, times its strength:
// 1 plus the boost each installed module gives that focus. Pick it in the center's panel.
//   donate   dollars a guest drops in the box per visit. appeal: keenness to visit. joy/learn: mood and learning per visit.
//   science  research points a guest's visit adds
const EDU_FOCUS = {
  conservation:{label:"Conservation", donate:2.5, text:"Guests give to the cause. Donations on every visit."},
  spectacle:   {label:"Spectacle",    appeal:12,  text:"A show worth walking across the park for. Guests are keener to come."},
  family:      {label:"Family",       joy:5, learn:4, text:"Made for kids and parents. Guests leave happier and know more."},
  research:    {label:"Research",     science:.06, text:"Visitors help real science. Every visit earns research points."},
};
// Modules added to a center (Research Lab tech `tech`, which needs education programs). Each also teaches on its own.
//   boost    adds to the strength of those focuses
//   slots    more guests that can sit through a visit at once
//   perSpecies  learning grows with the animals the Time Travel Lab has discovered
//   live     the module shows real work, so its effects scale with how busy that is (`modLive` in services.js): "lab", "nursery", "botany", "sim", "biomes" or "touch"
//   dept     science buildings it needs (any one of them) before it can be installed
const EDU_MODULES = {
  theater:   {label:"Theater",          tech:"edtheater",   price:12000, upkeep:110, learn:3, joy:2, appeal:5, boost:{spectacle:.6, family:.3},
              text:"A stage for puppet shows and animal talks. Crowds love it."},
  fossils:   {label:"Fossil Displays",  tech:"edfossils",   price:10000, upkeep:80,  learn:6, perSpecies:true, boost:{research:.5, conservation:.25},
              text:"Real casts and bones. It teaches more as the Time Travel Lab discovers more animals."},
  auditorium:{label:"Education Auditorium", tech:"edauditorium", price:16000, upkeep:130, learn:5, slots:8, boost:{conservation:.5, research:.3},
              text:"Tiered seating for lectures. More guests can sit through a talk at once."},
  labwindow: {label:"Live Lab Window",  tech:"edlabwindow", price:14000, upkeep:120, learn:5, joy:1, appeal:4, live:"lab", dept:["oracle", "ghost", "tar", "ceres"], boost:{research:.6, conservation:.3, family:.2},
              text:"A gallery over the working labs. It's only as good as what's going on: the Research Lab, the Time Travel Lab, the Genetics Lab and the Botany Lab all busy makes the best show."},
  nursery:   {label:"Nursery Window",   tech:"ednursery",   price:11000, upkeep:100, learn:3, joy:4, appeal:6, live:"nursery", dept:["tar"], boost:{family:.7, conservation:.3, spectacle:.2},
              text:"Watch clones in the incubators, and the day one hatches. Needs the Genetics Lab, and the best shows are while clones are growing."},
  botanical: {label:"Botanical Hall",   tech:"edbotanical", price:13000, upkeep:110, learn:5, joy:3, appeal:3, live:"botany", dept:["ceres"], boost:{conservation:.6, family:.4, research:.2},
              text:"A glasshouse of living prehistoric plants from the Botany Lab. It grows richer as more plant DNA is finished and while beds are growing."},
  simroom:   {label:"Simulation Room",  tech:"edsimroom",   price:18000, upkeep:150, learn:7, joy:3, appeal:8, live:"sim", dept:["ghost"], boost:{spectacle:.5, research:.5, family:.2},
              text:"A VR walk through deep time, built from the Time Travel Lab's records. Every finished event record adds a place to visit."},
  diorama:   {label:"Ecosystem Diorama", tech:"ediorama",   price:12000, upkeep:100, learn:6, joy:2, appeal:5, live:"biomes", boost:{conservation:.5, family:.4, spectacle:.2},
              text:"A walk-around model of how living things fit together. It gets richer with every kind of habitat you keep animals in."},
  touch:     {label:"Touch Gallery",    tech:"edtouch",     price:9000,  upkeep:70,  learn:4, joy:5, appeal:3, live:"touch", boost:{family:.6, conservation:.3, research:.2},
              text:"Egg shells, casts, teeth and bones to hold. The shelves fill up as the Time Travel Lab finishes more genomes."},
};
const EDU_LIVE = {idle:.3, nurseryIdle:.25, hatchBonus:.5, cap:1.5, simIdle:.2, simPlaces:4, biomes:4, genomes:8};   // a live module with nothing going on still works at this share
const EDU_CENTER = {moduleSlots:3};   // modules one Education Center can hold

// What one animal clone takes at the Genetics Lab, in open days: 1 plus 1 more for every this many m² the species needs
const CLONE_DAYS_PER_SPACE = 1000;
// Genetics Lab upgrades, researched at the Research Lab: each level of speed cuts clone time
const TAR_UPGRADE = {speed:.75};
// The Time Travel Lab upgrades, researched at the Research Lab: trip price and time multipliers per level
const GHOST_UPGRADE = {cost:[1, .8, .65], speed:[1, .75, .5]};
// Cloning from a partial genome: The Genetics Lab clones at `min` % complete or more. The closer to 100%, the healthier the clone: its DNA quality (a.q)
// runs from `q0` at the minimum to 100 when complete (sickly under 70, frail under 50, see HEALTH)
const CLONE_GENOME = {min:60, q0:40, failMax:.35};
// Clones from a partial genome can die in the incubator: `failMax` chance at the minimum, none once the genome is whole. A failed clone stops
// partway (between `failFrom` and `failTo` of its time), keeps its bay and fee, and sits there until the player discards it.
const CLONE_FAIL = {from:.2, to:.9, causes:[
  "Embryonic cell cascade failure",
  "Developmental gene sequence missing from the genome",
  "Chromosome mismatch in the gap regions",
  "Zygotic genome activation failed",
  "Telomere collapse during cell division",
  "Culture rejected: incomplete regulatory code",
  "Organ-field patterning arrested",
]};

// What the Botany Lab grows in its beds. Works like the Genetics Lab's incubators, but with plants.
//   days    how long one batch takes, in open days
//   cost    what one batch costs
//   doses   (medicine) doses one batch makes
const CERES_GROW = {
  medicine: {cenozoic:{days:.75, cost:900, doses:20}, mesozoic:{days:1.25, cost:1500, doses:20}, paleozoic:{days:1.75, cost:2200, doses:20}},
  food: {days:.5, cost:500, amount:60},   // Paleoflora food: one batch adds `amount` to the Botany Lab's stock, on top of what it grows on its own
};
// Plants for the landscape come in three sizes (LAND size), grown in batches that make several plants each. Prices and times follow the era; each period's plants need that period's DNA.
//   count   plants one batch makes
const PLANT_SIZES = ["small", "medium", "large"];
CERES_GROW.plant = {
  mesozoic:  {small:{days:.5,  cost:600,  count:6}, medium:{days:.75, cost:900,  count:3}, large:{days:1,   cost:1200, count:2}},
  paleozoic: {small:{days:.75, cost:900,  count:6}, medium:{days:1,   cost:1300, count:3}, large:{days:1.5, cost:1800, count:2}},
};

// Period colors, the same ones the planning map uses
const PERIOD_COLOR = {
  Cambrian:"#7FA056", Ordovician:"#009270", Silurian:"#B3E1B6", Devonian:"#C28A4D", Carboniferous:"#67A599", Permian:"#F04028", Triassic:"#812B92", Jurassic:"#34B2C9",
  Cretaceous:"#7FC64E", Paleogene:"#FD9A52", Neogene:"#F2D32A", Quaternary:"#E8E27A"
};

// Species drawn with a picture instead of a dot: sprites/<id>.png standing, side-on and facing right, with the width over the height.
// walk is how many frames sprites/<id>-walk.png has, side by side, each the same size as the standing picture.
// idle is how many frames sprites/<id>-idle.png has (same strip format) and ms how long each shows. A picture with both walks on the walk strip and plays idle while it holds still;
// with only idle (no walk strip) the idle strip plays all the time in an open exhibit, and a vivarium animal plays it on its spot.
// People drawn as pixel figures: each strip is `n` frames of 16 x 32 px side by side, facing right (flipped to face left). `walk` plays while moving (a frame every `step` meters), `work` while standing at a job in `jobs` (a frame every `ms`), and `wait` plays while standing with nothing to do (a frame every `ms`). `h` is how tall the 32 px cell is in meters (about 1.9 m of person; a bit larger than true pixel size so they read).
const HUMAN_SPRITES = {keeper:{walk:{src:"sprites/human/keeper-walk.png", n:4}, work:{src:"sprites/human/keeper-work.png", n:4, ms:180, jobs:["mucking", "filling"]}, wait:{src:"sprites/human/keeper-wait.png", n:4, ms:450}, carry:{src:"sprites/human/keeper-carry.png", n:4}}, vet:{walk:{src:"sprites/human/vet-walk.png", n:4}, work:{src:"sprites/human/vet-work.png", n:4, ms:180, jobs:["checking", "treating", "darting"]}, wait:{src:"sprites/human/vet-wait.png", n:4, ms:450}, carry:{src:"sprites/human/vet-carry.png", n:4}}, mechanic:{walk:{src:"sprites/human/mechanic-walk.png", n:4}, work:{src:"sprites/human/mechanic-work.png", n:4, ms:180, jobs:["repairing", "inspecting"]}, wait:{src:"sprites/human/mechanic-wait.png", n:4, ms:450}, carry:{src:"sprites/human/mechanic-carry.png", n:4}}, guard:{walk:{src:"sprites/human/guard-walk.png", n:4}, work:{src:"sprites/human/guard-escort.png", n:4, ms:180, jobs:["escorting"]}, wait:{src:"sprites/human/guard-wait.png", n:4, ms:450}}, custodian:{walk:{src:"sprites/human/custodian-walk.png", n:4}, work:{src:"sprites/human/custodian-work.png", n:4, ms:180, jobs:["scrubbing", "emptying", "sweeping"]}, wait:{src:"sprites/human/custodian-wait.png", n:4, ms:450}, carry:{src:"sprites/human/custodian-carry.png", n:4}}, guest:{walk:{src:"sprites/human/guest-walk.png", n:4}, wait:{src:"sprites/human/guest-wait.png", n:4, ms:450}}, guest2:{walk:{src:"sprites/human/guest2-walk.png", n:4}, wait:{src:"sprites/human/guest2-wait.png", n:4, ms:450}}, guest3:{walk:{src:"sprites/human/guest3-walk.png", n:4}, wait:{src:"sprites/human/guest3-wait.png", n:4, ms:450}}, guest4:{walk:{src:"sprites/human/guest4-walk.png", n:4}, wait:{src:"sprites/human/guest4-wait.png", n:4, ms:450}}, guest5:{walk:{src:"sprites/human/guest5-walk.png", n:4}, wait:{src:"sprites/human/guest5-wait.png", n:4, ms:450}}, w:16, ht:32, h:3.6, step:.8, feet:30};
const SPRITES = {saca:{ratio:100/75, size:.55, rig:1, rstep:.11}, anom:{ratio:100/75, size:.65, rig:1, rstep:.1}, trex:{ratio:100/75, rig:1, rstep:.073, pace:1.6}, allo:{ratio:100/75, rig:1, rstep:.07, pace:1.6}, chal:{ratio:100/75, rig:1, rstep:.0426, pace:.8}, comp:{ratio:100/75, foot:.92, idle:52, ms:125, base:10, dyn:[[10,14],[24,13],[37,15]], dynMs:125, dynGap:[3,8], rig:1, rdyn:.4}, dryo:{ratio:100/75, rig:1, rstep:.07}, scut:{ratio:100/75, rig:1, rstep:.0354}, coty:{ratio:100/75, walk:4, step:.25, idle:8, ms:500, rig:1, rstep:.032}, coel:{ratio:100/75, walk:8, step:.073, size:1.4, rig:1, rstep:.073}, plat:{ratio:100/75, walk:6, step:.15, rig:1}, dime:{ratio:100/75, walk:4, step:.25, rig:1, rstep:.0496, rsize:1.6}, plhy:{ratio:100/75, rig:1, rdyn:.1, foot:.92, idle:32, ms:125, base:7, dyn:[[7,6],[13,19]], dynMs:110, dynGap:[5,12]}, icht:{ratio:100/75, rig:1, foot:.96, rdyn:.25}, tikt:{ratio:100/75, rig:1, rdyn:.25, foot:.57, idle:20, ms:600, base:4, dyn:[[4,8],[12,8]], dynMs:130, dynGap:[6,14]}, lyst:{ratio:100/75, walk:4, step:.25, size:.7, idle:8, ms:520, rest:7, restMs:260, holdMs:1400, rig:1, rstep:.09, rsize:1.1}, prio:{ratio:100/75, walk:4, step:.25, idle:5, ms:500, swim:6, swimMs:180, rig:1, rstep:.04, rswim:.07}, carc:{ratio:100/75, rig:1, rstep:.07}, spin:{ratio:100/75, rig:1, rstep:.15, rswim:.09}, mega:{ratio:100/75, size:.67, idle:4, ms:50}, arth:{ratio:100/75, foot:.63, idle:6, ms:167}};

// Partner parks sell a few starter species. Each new park gets one from pool A, two from pool B and one mid-tier anchor from pool C
// (appeal 6 to 8, so one herd actually draws a crowd while the rest of the starters barely do).
const STARTER_POOLS = {
  a:{pick:1, ids:["arth", "mega", "pulm", "dcau", "comp"]},
  b:{pick:2, ids:["lyst", "dryo", "hyps", "ovir", "psit", "coel", "sile", "orni", "hete"]},
  c:{pick:1, ids:["mosc", "scut", "este", "desm", "scel", "plat", "gall", "para", "macr", "aepy", "mglo", "pach"]},
};

// Guest buildings. w and d are width and depth in meters.
//   kind       "food" or "merch": an empty shell that sells whatever you put on its menu (up to menuSlots items)
//   serves     the guest needs it takes care of, for buildings without a menu
//   seats      guests can sit down and rest here
//   slots      parties served at once, each taking serveMin minutes
//   patience   minutes a party will wait for a free spot (default GUEST.patience)
//   minRating  stars the park needs before you can build it
const BUILDINGS = {
  // Dining and retail come in the same three tiers and sizes: cart (1 item), stand (3 items), and a large restaurant or shop (5 items)
  // every building's footprint sides are multiples of 5 m (path props like bins and benches are exempt)
  kiosk:     {label:"Food cart",   one:"a food cart",   glyph:"K", color:"#3F86A8", price:3000,  upkeep:30,  w:5, d:5, kind:"food",  menuSlots:1, slots:2,  serveMin:3},
  food:      {label:"Food stand",  one:"a food stand",  glyph:"D", color:"#2F6E8F", price:6000,  upkeep:60,  w:10, d:10,  kind:"food",  menuSlots:3, slots:4,  serveMin:4},
  restaurant:{label:"Restaurant",  one:"a restaurant",  glyph:"F", color:"#1F5470", price:20000, upkeep:220, w:20, d:15, kind:"food",  menuSlots:5, slots:10, serveMin:12, seats:true, minRating:2, confirm:true},
  cart:      {label:"Gift cart",   one:"a gift cart",   glyph:"C", color:"#A06A93", price:3000,  upkeep:30,  w:5, d:5, kind:"merch", menuSlots:1, slots:2,  serveMin:3},
  shop:      {label:"Gift stand",  one:"a gift stand",  glyph:"S", color:"#8C4F7D", price:6000,  upkeep:60,  w:10, d:10,  kind:"merch", menuSlots:3, slots:4,  serveMin:4},
  megastore: {label:"Gift shop",   one:"a gift shop",   glyph:"M", color:"#6E3661", price:20000, upkeep:220, w:20, d:15, kind:"merch", menuSlots:5, slots:10, serveMin:6, minRating:2},
  restroom:  {label:"Restrooms",   one:"restrooms",     glyph:"R", color:"#56708A", price:4000,  upkeep:40,  w:10,  d:5,  serves:["bladder"], slots:4, serveMin:3},
  // small things beside the path
  bin:       {label:"Trash bin",   one:"a trash bin",   glyph:"",  color:"#3C4A3F", price:150,   upkeep:1,   w:1.6, d:1.6, prop:true, onPath:true},
  bench:     {label:"Bench",       one:"a bench",       glyph:"",  color:"#8A6238", price:400,   upkeep:2,   w:3,  d:1.4, prop:true, onPath:true, serves:["energy"], seats:true, slots:2, serveMin:12, patience:2},
  picnic:    {label:"Picnic area", one:"a picnic area", glyph:"",  color:"#9C7A48", price:1500,  upkeep:6,   w:6,  d:5,  prop:true, serves:["energy"], seats:true, slots:5, serveMin:15, patience:3},
  lamp:      {label:"Lamp post",   one:"a lamp post",   glyph:"",  color:"#E3C04A", price:300,   upkeep:3,   w:0.7, d:1.2, prop:true, onPath:true},
  camera:    {label:"Security camera", one:"a security camera", glyph:"", color:"#2B3F6B", price:900, upkeep:4, tech:"cameras", w:1.2, d:1.2, prop:true, onPath:true},
  donate:    {label:"Donation box", one:"a donation box", glyph:"", color:"#2F6B4A", price:350, upkeep:2, w:1.4, d:1.4, prop:true, onPath:true},
  sign:      {label:"Info sign",   one:"an info sign",  glyph:"",  color:"#3B6FB6", price:250,   upkeep:1,   w:1.6, d:1,  prop:true, onPath:true},
  nofeed:    {label:"Do Not Feed sign", one:"a Do Not Feed sign", glyph:"", color:"#B5382E", price:200, upkeep:1, w:1.6, d:1, prop:true, onPath:true},
  quiet:     {label:"Quiet sign",  one:"a quiet sign",  glyph:"",  color:"#3E7C8C", price:200,   upkeep:1,   w:1.6, d:1,  prop:true, onPath:true},
  // hotels: guests stay the night and spend the next day in the park
  lodge:     {label:"Safari Lodge", one:"a safari lodge", glyph:"L", color:"#7B5B3A", price:30000, upkeep:200, tech:"hotels", w:20, d:15, serves:["sleep"], rooms:20, roomPrice:120, minRating:3, minGuests:300, confirm:true},
  resort:    {label:"Resort Hotel", one:"a resort hotel", glyph:"H", color:"#A0473F", price:120000, upkeep:900, tech:"hotels", w:30, d:20, serves:["sleep"], rooms:80, roomPrice:180, minRating:4, minGuests:700, confirm:true},
  campground:{label:"Campground",   one:"a campground",   glyph:"G", color:"#4F7A3A", price:8000, upkeep:70, tech:"hotels", w:15, d:10, serves:["sleep"], rooms:10, roomPrice:60, minRating:2, minGuests:100, confirm:true},
  // guests learn about prehistoric life here
  edcenter:  {label:"Education Center", one:"an Education Center", glyph:"E", color:"#2F7A5A", price:12000, upkeep:90, w:15, d:10, serves:["learn"], slots:16, serveMin:20, patience:40, minRating:2, tech:"education", confirm:true},
  // guests ride the tram between these; each sits beside a footpath and a tram track
  tramstop:  {label:"Tram station", one:"a tram station", glyph:"T", color:"#B5533C", price:6000, upkeep:60, w:10, d:5, tram:true, tech:"transit"},

  // Backstage science departments. You can have one of each. They must touch a path or service road.
  oracle:   {label:"Research Lab", tag:"RESEARCH", one:"the Research Lab", glyph:"R", color:"#4B3A8C", price:9000, upkeep:120, w:25, d:15, dept:true,
             blurb:"The research hub. Unlocks animals, plants, medicine, fences, buildings, and Genetics Lab upgrades. Research takes time."},
  ghost:    {label:"Time Travel Lab", tag:"TIME", one:"the Time Travel Lab", glyph:"T", color:"#1F6F73", price:15000, upkeep:200, w:30, d:20, dept:true,
             blurb:"The time travel unit. Its drones scout real fossil sites across deep time to discover animals, then go back for their DNA."},
  tar:      {label:"Genetics Lab", tag:"GENETICS", one:"the Genetics Lab", glyph:"G", color:"#8E2F3A", price:12000, upkeep:160, w:25, d:20, dept:true,
             blurb:"The cloning lab. Turns complete genomes into living animals."},
};

/* ---------------------------------------------------------------------
   GUESTS
   Guests come in parties. Needs run from 0 (fine) to 100 (desperate).
   --------------------------------------------------------------------- */
// The night wash over the map: strongest opacity of the dark-blue layer, and clock hours dusk and dawn take to fade in and out
const NIGHT = {dark:.35, fade:2, dawnFade:1};
const GUEST = {
  drawPivot:25,        // species appeal is stretched around this: speciesDraw = pivot * (appeal / pivot) ^ drawPower, so a T. rex counts in full and cheap animals count for little
  drawPower:1.6,
  arriveFrom:6, arriveTo:21,   // clock hours the day's crowd arrives in (a hump, busiest at 1 PM)
  trickle:6,           // guests a day who keep arriving round the clock, even at night, at a 5-star park (a few stay the night); fewer at fewer stars
  trickleLow:.3,       // the share of that trickle a 0-star park still gets
  maxParties:1200,     // parties on the map at once; past this, newcomers join a party already there
  sizes:[1, 2, 2, 2, 3, 3, 4, 4],   // party sizes, picked at random
  stay:[180, 360],     // minutes a party plans to spend before heading home, before dividing by pace (slower guests stay longer, so they see the same amount)
  cash:[20, 45],       // money each guest brings to spend inside
  speed:[1.02, 1.38],  // each party's own pace, times pace, times WALK_PER_MIN (about 20% over the old .85 to 1.15, so guests walk a bit quicker without changing their needs)
  pace:.5,             // guests live at this share of staff pace: they walk, get hungry and tired, and tire of crowds this much slower, so you can click one before it's gone but a trip still feels the same
  startMood:62,        // mood on arrival, plus 4 for each star
  quitBelow:20,        // a party this unhappy heads home early
  tire:.03,            // mood lost each minute just from being on their feet
  seeGain:14,          // mood from seeing a really good exhibit for the first time
  needHurt:.2,         // mood lost each minute by a desperate need
  leftWanting:15,      // mood lost on the way out for each need left desperate (less for one just past bad)
  desperate:88,        // a need this bad makes a party drop what it's doing
  patience:25,         // minutes a party will wait in a queue before giving up
  queueMeters:10,      // each party already queuing makes a place feel this many meters further away
  farWalk:180,         // a walk longer than this to fix a need gets a complaint
  lastStop:80,         // on the way out, a party will still pop into a restroom or stand this close
  crowd:8,             // parties per 10 m of path before it feels packed
  crowdHurt:.04,       // mood lost each minute on a packed path
  fleeRange:60,        // guests within this many meters of a loose dangerous animal run for the gate
  shopChance:.7,       // chance a happy party stops at a gift shop on the way out
  wordOfMouth:.25,     // yesterday's mood moves today's crowd by up to this share
  goodMood:75,         // an average leaving mood this high gets full marks for guest comfort
  badMood:30,          // and this low gets none
};
// How guests spend time on the paths: stopping at exhibits, strolling, and acting on impulse. Times are guest minutes (divided by GUEST.pace in the park clock).
// What a party notices while it stands watching an exhibit: one thing every so often (guest minutes between), each with its own small effect on mood
const OBS = {gap:[2.5, 6], learn:.35, chance:{exhibit:.2}};
const SIGHT = {
  dwell:[10, 26],       // minutes a party stands watching an exhibit: the short end for a dull one, the long end for a showstopper
  glance:.9,           // top chance of stopping for an unseen exhibit they walk past (scaled by its appeal and their taste)
  glanceAppeal:12,     // appeal at which that chance is half of the top
  whim:[.35, 1.65],    // each party's own random liking for each exhibit when choosing where to head
  distPull:45,         // meters at which an exhibit's pull is halved when choosing (smaller means they stick closer to where they are)
  strollChance:.4,     // chance, when they have nothing planned, of drifting along the paths instead of picking an exhibit
  strollLen:[3, 9],    // corners a stroll lasts
  standReach:12,       // meters of fence either side of the path a party might pick to stand at
  standGap:7,          // meters out from a fence a party will look for paving to stand on
  standPull:6,         // meters at which a fence spot's chance is halved, so the crowd spreads out but favors what's close
  glassReach:30,       // the same for acrylic fence, which draws a crowd from farther along the path
  glassPull:12,        // and spreads it wider
  glassGlance:2.5,     // how many times likelier a passing party stops for an exhibit with acrylic fence
  glassWeight:6,       // how many times likelier a spot at acrylic is than the same spot at any other fence
  deckShare:.8,        // chance a party stands on a viewing platform for the exhibit when there's one close
  deckReach:16,        // meters from the path stop to the platform's middle
  impulse:{frac:.55, near:55, chance:.6, shop:.2, shopNear:45, gap:40},   // a need over this share of its seek line, and a stop this close: chance of going; chance of popping into a shop; minutes between tries
};
/* ---------------------------------------------------------------------
   GUEST PERSONALITIES
   Every party has a primary and a secondary personality. The primary pulls in full and the
   secondary PERS.second as hard. Each personality has:
     weight  odds of being picked (primary, then secondary from what's left)
     fx      multipliers on how the party behaves (1 is neutral; read through pm() in personas.js):
             food, shop, museum (will buy), donate, learn, infra (mood lost to needs, litter, crowds),
             ticket (how dear a ticket can be before they grumble), price (price sensitivity), patience,
             walk (mood lost to being on their feet), decor, broken, toilet (filthy restrooms), litter,
             flee / fleeHurt (how they take a loose predator), need {energy, bladder} (how fast they build),
             hideTol (how well they take animals hiding indoors: it divides the let-down, so higher is more forgiving)
     n       numbers its exhibit tastes and reactions use (see personas.js)
   --------------------------------------------------------------------- */
const PERS = {
  second:.5,           // the secondary personality counts for this share of the primary's pull
  ejectWait:240,       // minutes a call to security waits before the party carries on
  ejectMood:25,        // mood a party loses when security walks it to the gate
  escortRadius:30,     // a guard this close to a waiting party can take it to the gate
  activeActs:["hunt", "patrol", "pace", "play"],   // what animals do that counts as visibly active
  rarePrice:9000,      // a species this dear counts as rare
  hooligan:{sneak:.35, tease:.03, stress:8},   // chance a hooligan party skips the ticket; chance each minute at a fence of banging on the glass; stress it gives the animals (animals inside a shelter feel none; privacy screens cut both the chance and the stress)
};
const PERSONALITIES = {
  thrill:{label:"Thrill Seeker", color:"#E5484D", weight:.16,
    text:"Wants big predators and animals that look dangerous. Bored by calm herbivores and long walks. Spends on viewing, little on food and gifts.",
    fx:{food:.7, shop:.6, walk:1.4, flee:.5, fleeHurt:.3, patience:.9},
    n:{danger:7, active:4, platform:3, tame:3, slow:2, tasteDanger:1.5, tasteActive:.5, tasteTame:.5, center:1, spectacle:1.6}},
  conserv:{label:"Conservationist", color:"#3E9B4F", weight:.12,
    text:"Cares how the animals are treated: roomy, well-kept exhibits, rare species, research and education. Gives to conservation. Hates a park that feels like pure entertainment.",
    fx:{donate:3, learn:1.3, shop:.9, hideTol:2},
    n:{well:5, poor:8, rare:5, stress:4, showy:6, showyBelow:15, tasteWelfare:.8, tasteRare:.5, center:1.8}},
  paleo:{label:"Paleo-Nerd", color:"#8A5CC2", weight:.14,
    text:"Wants variety and accuracy: many species across the eras, complete genomes, signs and museum shows. Bored by repeats and by low-genome clones.",
    fx:{learn:1.4, museum:1.4, food:.9, hideTol:2.5},
    n:{species:2.5, era:4, repeat:2.5, accurate:3, guess:5, nosign:2, collection:10, tasteNew:1.8, tasteOld:.6, center:1.5}},
  family:{label:"Family Focused", color:"#2F86C8", weight:.26,
    text:"Wants a safe, easy day: gentle herbivores, short walks, clean restrooms, benches, cheap food and a fair ticket. Punishes bad infrastructure harder than anyone.",
    fx:{dark:1.6, infra:1.6, ticket:.85, price:1.4, patience:.8, walk:1.3, food:1.15, shop:1.1, toilet:2, hideTol:.7, need:{energy:1.25, bladder:1.15}},
    n:{kids:5, scary:5, gory:4, tasteKids:1, tasteScary:.5, center:1.3}},
  fun:{label:"Fun Lover", color:"#E3B23C", weight:.26,
    text:"Here for a good time with no strong preferences. Likes good food and a nice atmosphere. Hates boredom, lines and anything broken.",
    fx:{patience:.8, decor:1.3, food:1.2, shop:1.1, broken:1.5},
    n:{variety:2}},
  hooligan:{label:"Hooligan", color:"#E0509B", weight:.06,
    text:"Here to cause trouble. May sneak in without paying, drops litter, vandalizes, throws trash at the animals and bangs on the glass. Security has to catch them.",
    fx:{dark:.3, food:.8, shop:.5, learn:.5, litter:3},
    n:{}},
};
const NEEDS = {
  hunger: {rate:.2,  seek:55, start:30},
  thirst: {rate:.25, seek:55, start:30},
  bladder:{rate:.22, seek:60, start:25},
  energy: {rate:.24, seek:60, start:20},   // tiredness: a sit-down fixes it
};
// What food stands and gift shops can sell. price is the usual price; cost is what each one costs you to stock,
// and it uses that many units of its good (a $2 burger uses 2 units of snacks).
//   fills   how much each need drops (food)        joy     mood a souvenir adds (merch)
//   litter  leaves a wrapper or cup to throw away
//   only    the one building type that can sell it (restaurant dishes)
const MENU = {
  burger:  {label:"Burgers",     kind:"food", good:"snacks",  price:8,  cost:2,   fills:{hunger:70},             litter:true},
  hotdog:  {label:"Hot dogs",    kind:"food", good:"snacks",  price:6,  cost:1.5, fills:{hunger:55},             litter:true},
  pizza:   {label:"Pizza",       kind:"food", good:"snacks",  price:9,  cost:2.2, fills:{hunger:65},             litter:true},
  fries:   {label:"Fries",       kind:"food", good:"snacks",  price:4,  cost:.8,  fills:{hunger:35},             litter:true},
  popcorn: {label:"Popcorn",     kind:"food", good:"snacks",  price:3,  cost:.5,  fills:{hunger:25},             litter:true},
  icecream:{label:"Ice cream",   kind:"food", good:"snacks",  price:4,  cost:.9,  fills:{hunger:15, thirst:25},  joy:3},
  soda:    {label:"Soda",        kind:"food", good:"drinks",  price:3,  cost:.5,  fills:{thirst:70},             litter:true},
  water:   {label:"Water",       kind:"food", good:"drinks",  price:2,  cost:.3,  fills:{thirst:60},             litter:true},
  coffee:  {label:"Coffee",      kind:"food", good:"drinks",  price:4,  cost:.8,  fills:{thirst:30, energy:35},  litter:true},
  smoothie:{label:"Smoothies",   kind:"food", good:"drinks",  price:6,  cost:1.4, fills:{thirst:55, hunger:15},  litter:true},
  shake:   {label:"Milkshakes",  kind:"food", good:"drinks",  price:7,  cost:1.7, fills:{thirst:40, hunger:30},  litter:true},
  turkey:  {label:"Turkey legs", kind:"food", good:"snacks",  price:11, cost:3,   fills:{hunger:80},             litter:true},
  candy:   {label:"Cotton candy",kind:"food", good:"snacks",  price:4,  cost:.6,  fills:{hunger:15},             litter:true, joy:4},
  nachos:  {label:"Nachos",      kind:"food", good:"snacks",  price:7,  cost:1.7, fills:{hunger:50},             litter:true},
  veggie:  {label:"Veggie burgers", kind:"food", good:"snacks", price:8, cost:2,   fills:{hunger:65},             litter:true},
  salad:   {label:"Salad",       kind:"food", good:"snacks",  price:10, cost:2.6, fills:{hunger:45, thirst:10},  only:"restaurant"},
  pasta:   {label:"Pasta",       kind:"food", good:"snacks",  price:14, cost:3.6, fills:{hunger:75},             only:"restaurant"},
  soup:    {label:"Soup",        kind:"food", good:"snacks",  price:9,  cost:2.2, fills:{hunger:50, thirst:15},  only:"restaurant"},
  steak:   {label:"Steak",       kind:"food", good:"snacks",  price:26, cost:8,   fills:{hunger:100},            only:"restaurant", joy:3},
  lobster: {label:"Lobster",     kind:"food", good:"snacks",  price:38, cost:12,  fills:{hunger:100},            only:"restaurant", joy:6},
  plush:   {label:"Dino plushes",  kind:"merch", good:"merch", price:14, cost:4,  joy:8},
  tshirt:  {label:"T-shirts",      kind:"merch", good:"merch", price:20, cost:6,  joy:6},
  toy:     {label:"Toy dinosaurs", kind:"merch", good:"merch", price:10, cost:3,  joy:7},
  map:     {label:"Park maps",     kind:"merch", good:"merch", price:3,  cost:.4, joy:2, text:"Guests with a map don't mind long walks."},
  guide:   {label:"Field guides",  kind:"merch", good:"merch", price:12, cost:3.5, joy:5},
  umbrella:{label:"Umbrellas",     kind:"merch", good:"merch", price:12, cost:3.5, joy:4, text:"Sells far better when it rains."},
  iceplush:{label:"Ice Age plushies", kind:"merch", good:"merch", price:15, cost:4.5, joy:8},
  fossilkit:{label:"Fossil finder kits", kind:"merch", good:"merch", price:18, cost:5.5, joy:7},
  tribag:  {label:"Triceratops backpacks", kind:"merch", good:"merch", price:35, cost:11, joy:9},
  sabhat:  {label:"Sabertooth hats", kind:"merch", good:"merch", price:16, cost:4.5, joy:6},
  dimebag: {label:"Dimetrodon backpacks", kind:"merch", good:"merch", price:35, cost:11, joy:9},
  permshirt:{label:"Permian T-shirts", kind:"merch", good:"merch", price:20, cost:6, joy:6},
  arthplush:{label:"Arthropleura plushies", kind:"merch", good:"merch", price:14, cost:4, joy:8},
  tikshirt:{label:"Tiktaalik T-shirts", kind:"merch", good:"merch", price:20, cost:6, joy:6},
  trexhat: {label:"T-Rex hats",    kind:"merch", good:"merch", price:16, cost:4.5, joy:6},
  paleobook:{label:"Paleontology books", kind:"merch", good:"merch", price:24, cost:7, joy:6, text:"Guests who read one learn more, and learn more at every exhibit after."},
  jacket:  {label:"Branded jackets", kind:"merch", good:"merch", price:55, cost:18, joy:10},
};
// How guests take prices: at the usual price everyone buys, at double nobody does
const PRICE_SENSE = 1;     // share of buyers lost for each 100% over the usual price
// Litter lies on the paths in squares this many meters across
const DONATE = {
  reach:12,            // guests passing a working box this close may give
  chance:.14,          // chance a party gives at a box it passes; learning raises it
  amount:1.2,          // dollars a guest gives, more if they learned something
  eduBoost:1.5,        // a guest who learned everything gives this much more, and is more likely to
};
const LITTER = {
  cell:8,              // size of a litter square
  binReach:20,         // guests use a bin this close
  binCap:100,          // pieces a bin holds
  holdMin:12,          // minutes a guest carries trash looking for a bin
  drop:.5,             // chance they drop it then, rather than keep looking
  dirtyDrop:.04,       // extra chance for each piece already lying there
  heavy:12,            // pieces in one square that make guests really unhappy
  hurt:.12,            // mood lost each minute among heavy litter
  nightCost:2,         // the night cleaning crew charges this per piece picked up
  binNightCost:.5,     // and this per piece emptied from bins
};
const RESTROOM = {
  dirtPerGuest:.35,    // dirt each visitor adds (0 to 100)
  gross:45,            // dirtier than this and guests complain
  avoid:80,            // dirtier than this and only desperate guests use it
  nightCost:1.5,       // the night cleaning crew charges this per point of dirt
};
// What guests think. good ones are compliments.
const THOUGHTS = {
  noFood:     {text:"I'm hungry and there's nowhere to eat."},
  noDrink:    {text:"I'm thirsty and there's nothing to drink."},
  noRestroom: {text:"I can't find a restroom."},
  accident:   {text:"I couldn't find a restroom in time."},
  queue:      {text:"The queue was so long I gave up."},
  far:        {text:"Everything is such a long walk."},
  broke:      {text:"I can't afford anything here."},
  crowded:    {text:"The paths are packed."},
  bored:      {text:"There isn't much to see."},
  sadAnimals: {text:"The animals looked miserable."},
  pacing:     {text:"The animals just paced back and forth."},
  playful:    {text:"We watched the animals play!", good:true},
  scared:     {text:"An animal got loose. We're getting out of here!"},
  pricey:     {text:"The ticket cost far too much."},
  dark:       {text:"The paths were too dark at night."},
  noSeat:     {text:"My feet hurt and there's nowhere to sit."},
  litter:     {text:"There's trash all over the paths."},
  grossLoo:   {text:"The restrooms were disgusting."},
  priceyFood: {text:"The food here costs too much."},
  priceyGift: {text:"The souvenirs are overpriced."},
  rested:     {text:"It was nice to sit down for a bit.", good:true},
  pretty:     {text:"The gardens here are lovely.", good:true},
  tram:       {text:"The tram saved my feet.", good:true},
  noTram:     {text:"I couldn't afford the tram."},
  soldOut:    {text:"They'd sold out of what I wanted."},
  graffiti:   {text:"Someone has spray-painted everything."},
  broken:     {text:"The benches here are all broken."},
  safe:       {text:"Seeing guards around made me feel safe.", good:true},
  noInfo:     {text:"I wish there were signs telling us about the animals."},
  priceyEdu:  {text:"The Education Center costs too much to get in."},
  learned:    {text:"I learned so much about prehistoric life!", good:true},
  wow:        {text:"The animals were amazing!", good:true},
  fed:        {text:"That hit the spot.", good:true},
  rush:       {text:"Being that close to a predator was a rush!", good:true},
  tame:       {text:"Where are the scary ones? These just stand around."},
  welfare:    {text:"The animals all looked well cared for.", good:true},
  poorCare:   {text:"Those animals deserve better care than this."},
  rare:       {text:"I'm glad to see rare species being looked after.", good:true},
  showy:      {text:"This felt like a theme park, not a conservation effort."},
  variety:    {text:"So many different species and eras!", good:true},
  repeats:    {text:"I've already seen that animal."},
  accurate:   {text:"Those clones are impressively complete.", good:true},
  lowGenome:  {text:"Those animals are mostly guesswork. The genomes are too incomplete."},
  collection: {text:"I saw nearly everything this park has!", good:true},
  cuddly:     {text:"The kids loved the gentle animals!", good:true},
  scary:      {text:"That was far too scary for the kids."},
  gory:       {text:"We watched an animal hunting. Not for kids."},
  ejected:    {text:"Security threw us out!"},
  hiding:     {text:"Where are the animals? They're all hiding."},
  feeding:    {text:"It was great watching them eat.", good:true},
  sickly:     {text:"That animal looked sick."},
  critical:   {text:"That poor animal could barely stand."},
};

// Each vivarium size is also a building you can place
for(const [size, v] of Object.entries(VIVARIUMS))
  BUILDINGS["viv" + size] = {label:v.label, one:"a " + v.label.toLowerCase(), glyph:"V" + size, color:"#5E9AA6", price:v.price, upkeep:v.upkeep, w:v.w, d:v.d, viv:size};
for(const [size, v] of Object.entries(AQUARIUMS))
  BUILDINGS["aqua" + size] = {label:v.label, one:"a " + v.label.toLowerCase(), glyph:"A" + size, color:"#3E86A8", price:v.price, upkeep:v.upkeep, w:v.w, d:v.d, viv:size, aqua:true};

/* ---------------------------------------------------------------------
   KEEPERS
   --------------------------------------------------------------------- */
const KEEPER = {
  hireCost:2000,       // one-time cost to hire a keeper
  wage:120,            // each keeper's pay per day
  carry:40,            // food units a keeper can carry by hand
  speed:WALK_PER_MIN * STAFF_PACE,  // keepers walk at STAFF_PACE of full walking speed
  tirePerMeter:.03,    // stamina lost per meter walked
  tirePerDelivery:2,   // stamina lost loading or unloading
  restBelow:25,        // keepers take a break when stamina drops under this
  topUpBelow:.6,       // keepers only set out to feed an exhibit once its food drops under this share of a full store
  restPerMin:2,        // stamina regained per minute in a break room (a quarter of that resting at a station)
};
// Aquarists do keepers' work (same Keeper Station, same gear) but only for lagoons and aquariums; keepers leave those alone
const AQUARIST = {hireCost:KEEPER.hireCost, wage:KEEPER.wage};
// Staff overview: energy and morale for every hired worker (keepers tire by walking, so theirs lives in KEEPER)
const STAFF = {
  workDrain:.16,       // energy a mechanic, vet, custodian or guard loses per minute on a task
  idleDrain:.03,       // and per minute waiting around
  restBelow:25,        // they take a break when energy drops under this
  restPerMin:2,        // energy regained per minute in a break room (a quarter of that resting at their own building)
  moraleStep:200,      // morale closes the gap to what the job gives them over about this many minutes
  startMorale:70,
  worked:[.35, .85],   // a share of the day spent working that feels like a good day (less is boring, more is a grind)
  minSample:60,        // minutes on the clock before work-share thoughts count
};
const FOOD_UNIT_COST = 20;   // one food unit per $20 of an animal's daily food cost
const STORE_DAYS = 1.5;      // exhibits hold this many days of food
const GATE_COST = 1500;
const GATE_REACH = 4;        // a gate counts as on a road within this many meters

const FOOD_COLOR = {plants:"#6BAA3A", paleoflora:"#1F8A70", meat:"#B23A2E", fish:"#3A7FB2", insects:"#B28A2E", fruit:"#C8466E", shellfish:"#8A7FB8"};

// Staff buildings. They go beside a path or service road.
BUILDINGS.station   = {label:"Keeper Station", tag:"KEEPERS", one:"a keeper station", glyph:"K", color:"#3F6B2E", price:4000, upkeep:80, w:15, d:10, dept:true,
                       full:"Food storage and keeper lockers", blurb:"Keepers start here, load food here, and swap food types here."};
BUILDINGS.breakroom = {label:"Break Room", tag:"BREAK", one:"a break room", glyph:"B", color:"#7A5A2E", price:2500, upkeep:40, w:10, d:10, dept:true,
                       full:"Break room and locker room", blurb:"Tired keepers rest here four times faster than at a station."};
BUILDINGS.toolshed  = {label:"Tool Shed", tag:"SHED", one:"a tool shed", glyph:"S", color:"#5B6470", price:2000, upkeep:30, w:10, d:10, dept:true, unique:true,
                       full:"Equipment for staff", blurb:"Buy upgrades that make keepers' and custodians' work easier."};
for(const t of ["oracle", "ghost", "tar"]) BUILDINGS[t].unique = true;

// Upgrades bought at the Tool Shed
const UPGRADES = [
  {id:"shovels",     label:"Shovels",      price:1500, text:"Keepers clean exhibits 2.5 times faster than with bare hands."},
  {id:"hoses",       label:"Hoses",        price:5000, text:"Keepers clean exhibits another 2.5 times faster.", needs:"shovels"},
  {id:"wheelbarrow", label:"Wheelbarrows", price:6000, text:"Keepers carry 2.5 times as much food per trip."},
  {id:"boots",       label:"Work boots",   price:3000, text:"Keepers tire 40% more slowly while walking."},
  {id:"crates",      label:"Stacking crates", price:4000, text:"Every store holds 30% more."},
  {id:"coolers",     label:"Cooler boxes",    price:7000, text:"Food spoils 40% more slowly in every store."},
  {id:"forklift",    label:"Pallet forklift", price:10000, text:"Custodians restocking stores carry 3 times as much per trip.", needs:"wheelbarrow"},
  {id:"picker",      label:"Litter pickers",  price:2000, text:"Custodians sweep litter twice as fast."},
  {id:"jcart",       label:"Janitor carts",   price:4000, text:"Custodians carry twice as much stock per trip."},
  {id:"washer",      label:"Pressure washers", price:3000, text:"Custodians scrub restrooms twice as fast."},
];

// Custodians restock food stands and gift shops, scrub restrooms, empty bins, and sweep litter
const CUSTODIAN = {
  hireCost:1500,
  wage:100,
  speed:WALK_PER_MIN * STAFF_PACE,  // custodians walk at STAFF_PACE of full walking speed
  carry:100,           // units of stock they carry per trip
  scrubPerMin:4,       // restroom dirt cleaned each minute
  sweepPerMin:2,       // pieces of litter picked up each minute
  emptyMin:3,          // minutes to empty a bin
  restroomAt:25,       // they scrub a restroom this dirty
  binAt:.6,            // they empty a bin this full
  litterAt:3,          // they sweep a square with this much litter
  reach:30,            // they sweep litter this close to where they stand
};
// Lamp posts light the paths at night (dusk to dawn, following the map's night wash)
const LAMP = {
  radius:14,           // meters of ground a working lamp lights
  lean:1.5,            // the pool leans this far toward the way the lamp faces
  litAt:.25,           // a path corner this lit counts as lit (0 to 1)
  visRadius:8,         // meters of pool drawn round a lamp (the gameplay radius above is wider)
  steps:[[1, .62], [.66, .36], [.33, .16]],   // [share of visRadius, share of night left] per step, outer to inner
  px:.26,              // meters a pixel of the light pools and head glow (two art pixels), so their edges stair-step
  glow:"#FFC96B",      // warm light
  tint:.07,            // opacity of the warm tint over the pool
  headH:3.0,           // meters up the glow hangs: just under the lamp head, so the head itself stays visible
  headR:.8,            // meters across the glow under the lamp head
  fear:.05,            // mood lost a minute on an unlit stretch in full dark (times how much the guest minds)
  pull:.5,             // share of an exhibit's pull lost at night when no lit path sees it
  nightCut:.35,        // a lamp nearby multiplies vandalism by this at night (VANDAL.lampCut by day)
  darkBoost:1.3,       // unlit spots at night make vandalism this much likelier
  darkCam:.5,          // chance a camera sees a spot no lamp lights, at night
};
// Rowdy guests break things when they're unhappy
const VANDAL = {
  moodBelow:80,        // a rowdy party under this mood might cause trouble
  rate:.006,           // chance each minute that it does something, 30 points under that; more the unhappier it gets
  reach:15,            // what it damages is this close
  propHit:35,          // condition a bench, bin, picnic area, or lamp loses
  brokenBelow:30,      // a prop in worse shape than this doesn't work
  graffiti:40,         // graffiti added to a building
  fenceHit:3,          // condition an exhibit fence loses to a kick
  grossAt:30,          // graffiti this bad upsets guests
  litterBoost:1.5,     // heavy litter around makes vandalism this much likelier
  lampCut:.5,          // a working lamp nearby multiplies it by this
  lampReach:15,
  repairShare:.005,    // mechanics' parts cost this share of a prop's price for each point repaired
};
// Guests throw trash into exhibits. Rowdy ones do it most. Animals that eat it fall ill or die.
const THROWN = {
  reach:10,            // a guest this close to an open exhibit's fence might throw trash in
  rowdy:.02,           // chance each minute for a rowdy party (more the unhappier it is)
  normal:.0015,        // chance each minute for any other party that's carrying trash
  binCut:.4,           // a working bin with room nearby multiplies it by this
  signCut:.5,          // so does a Do Not Feed sign by the exhibit's fence
  netCatch:.98,        // share of throws catch netting (or aviary netting) stops with the fence in perfect shape; it falls with the fence condition
  signReach:20,        // a sign this close to a fence counts for the exhibit
  dayDecay:.5,         // each throw already made into an exhibit today cuts the chance of the next by this share (crowds don't pile it up)
  pieces:1,            // pieces of trash one throw adds
  eat:.12,             // chance a day an animal eats trash and gets Foreign Object Ingestion, for each piece per animal in the exhibit (capped at eatMax)
  eatMax:.6,
};
// Guests learn about the animals from info signs, field guides, and the Education Center
const EDU = {
  see:2,               // learning from seeing an exhibit (0 to 100 per guest)
  sign:8,              // more if an info sign stands by its fence, plus a quarter more for each species inside
  signReach:20,        // a sign this close to an exhibit's fence tells guests about it
  guide:10,            // learning from buying a field guide
  book:16,             // learning from buying a paleontology book (it works like a field guide too)
  guideBoost:1.5,      // and guests with one learn this much more at every exhibit after
  center:35,           // learning from a visit to the Education Center
  centerJoy:12,        // and the mood it adds
  centerAppeal:25,     // how keen guests are to visit it, next to an exhibit's appeal
  centerFee:5,         // usual entry price: everyone pays this, nobody pays double
  joy:.08,             // mood gained for each point learned
  litterCut:.4,        // at 100 learning, guests drop litter this much less
  vandalCut:.6,        // and vandalize this much less
  shopBoost:.3,        // and are this much keener in gift shops (double for dino plushes, field guides and paleontology books)
  donate:4,            // a guest who learned everything drops this in the donation box on the way out
  full:40,             // average learning that gets full marks in the rating
  learned:40,          // guests who learned this much say so
  noInfo:3,            // exhibits seen without a sign before guests complain
};
// Hotels fill overnight from the day's guests. Next morning their guests start the day at the hotel, with no ticket to buy.
const LODGING = {
  stayShare:.15,       // share of the day's guests who'd stay the night at a 5-star park (fewer at fewer stars)
  perRoom:2,           // guests in each room
  toiletries:2,        // units of merchandise each booked room uses (soap, towels, little shampoos)
  dirtPerNight:60,     // a hotel this full gets this dirty overnight (0 to 100), and custodians clean it in the day
  dirtyCut:.6,         // a filthy hotel books this much less
  cleanAt:20,          // custodians clean a hotel this dirty
  cashBoost:1.3,       // hotel guests bring more money
  outAt:(8 * 60 - ROLLOVER_CLOCK) / CLOCK_SCALE,   // hotel guests come out at 8 AM (a state.minute)
  stayBoost:120,       // and stay this many minutes longer
};
// Security guards patrol the paths, put vandals off, and throw out the ones they catch
const SECURITY = {
  hireCost:2000,
  wage:140,
  speed:WALK_PER_MIN * STAFF_PACE,  // guards walk at STAFF_PACE of full walking speed
  deterRadius:25,      // vandalism near a guard is much rarer
  deterCut:.3,
  catchRadius:15,      // a guard catches a vandal this close
  cameraRadius:60,     // with cameras, each Security Office watches this far
  postRadius:30,       // and each working camera post on a path watches this far
  evacRadius:50,       // during an escape, guards send guests this close toward the gate
  patrolWait:8,        // minutes a guard stands at each stop
};
BUILDINGS.security = {label:"Security Office", tag:"SECURITY", one:"a security office", glyph:"P", color:"#2B3F6B", price:4000, upkeep:60, tech:"security", w:10, d:10, dept:true,
                      full:"Park security", blurb:"Guards start here. They patrol the paths, put rowdy guests off, throw out vandals, and steer guests to the gate during escapes."};
BUILDINGS.closet = {label:"Custodial Closet", tag:"JANITOR", one:"a custodial closet", glyph:"J", color:"#2E8B8B", price:2000, upkeep:30, w:10, d:10, dept:true,
                    full:"Custodians' base", blurb:"Custodians start here. They restock food stands and gift shops, scrub restrooms, empty bins, and sweep litter."};

// Dirty exhibits
const CLEAN = {
  messRate:.3,         // how fast animals make a mess (bigger animals make more)
  dietMess:{carnivore:1.3, piscivore:1.2, omnivore:1.1, herbivore:1, insectivore:.6},   // meat scraps are the worst
  dirtyAt:35,          // keepers go clean an exhibit this dirty before routine feeding
  tidyAbove:15,        // a keeper with nothing else to do cleans any exhibit dirtier than this (a smaller mess is not worth the walk)
  penaltyFrom:40,      // animals start getting unhappy above this much dirt
  penaltyPer:.6,       // happiness lost per point of dirt above that
  handRate:1.2,        // cleaning speed with shovels (slower in bigger exhibits)
  bareFactor:.4,       // keepers without shovels clean at this share of that speed
  hoseBoost:2.5,       // hoses make cleaning this much faster
  tirePerMin:.3,       // keeper stamina lost per minute of mucking
};

/* ---------------------------------------------------------------------
   BARRIERS AND ESCAPES
   --------------------------------------------------------------------- */

// Exhibit barriers. An animal escapes if its strength is more than the barrier's.
//   perMeter   cost to upgrade, per meter of fence
//   view       how well guests can see in (concrete hides the animals)
//   tech       what the Research Lab has to research first
//   deco       decoration (hedge, rope): guests like it, and it holds animals like any other wall
const BARRIERS = {
  wood:     {label:"Wooden fence",      strength:25,  perMeter:0,   view:1.0,  tech:null,       color:"#3B3226"},
  hedge:    {label:"Hedge row",         strength:12,  perMeter:5,   view:.85,  tech:null,       color:"#3F6B35", hedge:true, deco:true},
  bars:     {label:"Metal bars",        strength:45,  perMeter:40,  view:.95,  tech:"bars",     color:"#4A4F57"},
  electric: {label:"Electrified fence", strength:65,  perMeter:60,  view:.95,  tech:"electric", color:"#D8B04A"},
  acrylic:  {label:"Acrylic wall",      strength:85,  perMeter:150, view:1.1,  tech:"acrylic",  color:"#8CCBDA"},
  concrete: {label:"Concrete wall",     strength:140, perMeter:90,  view:.45,  tech:"concrete", color:"#9A958C"},
  brick:    {label:"Brick wall",        strength:100, perMeter:55,  view:.8,   tech:"masonry",  color:"#AC5234"},
  stone:    {label:"Stone wall",        strength:115, perMeter:75,  view:.75,  tech:"masonry",  color:"#9C9488"},
  bamboo:   {label:"Bamboo fence",      strength:20,  perMeter:3,   view:.95,  tech:null,       color:"#7E9234"},
  palisade: {label:"Log palisade",      strength:60,  perMeter:30,  view:.5,   tech:null,       color:"#8C603A"},
  iron:     {label:"Wrought-iron fence", strength:55, perMeter:70,  view:1.0,  tech:"bars",     color:"#323840"},
  drystone: {label:"Dry-stone wall",    strength:35,  perMeter:20,  view:.95,  tech:"masonry",  color:"#98927F"},
  adobe:    {label:"Adobe wall",        strength:80,  perMeter:40,  view:.5,   tech:"masonry",  color:"#CC9862"},
  stake:    {label:"Stake fence",       strength:40,  perMeter:10,  view:.9,   tech:null,       color:"#B8925C"},
  rope:     {label:"Rope fence",        strength:8,   perMeter:2,   view:1.2,  tech:null,       color:"#B8905A", deco:true},
  bone:     {label:"Bone fence",        strength:65,  perMeter:35,  view:.8,   tech:null,       color:"#E2D4B0"},
  lagoon:   {label:"Lagoon wall",       strength:120, perMeter:110, view:1.0,  tech:null,       color:"#3A92A0", pool:true},   // pool: the only fence that holds sea water and pool animals (lagoonWalled); shown with poolsOn()
};

// Fence laid piece by piece on the 1 m grid (js/fences.js)
//   minArea     smallest fenced-off region that becomes an exhibit (m²)
//   keepShare   an exhibit keeps a region holding at least this share of its old ground
const FENCE_GRID = {step:5, minArea:60, keepShare:.25, sideGap:.18, sideDead:.2};   // step: m a fence piece runs (the 5 m path chunk grid); sideGap: m each wall of a shared pair is nudged into its own pen so both show; sideDead: m the pointer can stray from a wall and still change both sides of it

// What a new fence costs to build, per meter: the base fence plus the barrier's own cost
const fenceRate = key => COST.fencePerMeter + BARRIERS[key].perMeter;

// How each barrier wears.
//   wear     condition lost per day from weather and age (percent)
//   repair   materials to fix a whole fence, per meter, from broken to 100%
Object.assign(BARRIERS.wood,     {wear:3.0, repair:6});
Object.assign(BARRIERS.hedge,    {wear:1.0, repair:4});   // a hedge grows back, so it barely wears
Object.assign(BARRIERS.bars,     {wear:2.0, repair:10});
Object.assign(BARRIERS.electric, {wear:2.5, repair:14});
Object.assign(BARRIERS.acrylic,  {wear:1.5, repair:25});
Object.assign(BARRIERS.concrete, {wear:1.0, repair:12});
Object.assign(BARRIERS.brick,    {wear:1.2, repair:14});   // brick and stone are tough and moderately tall: between acrylic and concrete, and a good look
Object.assign(BARRIERS.stone,    {wear:.8,  repair:16});
Object.assign(BARRIERS.bamboo,   {wear:3.5, repair:5});    // cheap and weak, and it wears fast
Object.assign(BARRIERS.palisade, {wear:2.2, repair:9});
Object.assign(BARRIERS.iron,     {wear:1.8, repair:18});   // rusts slowly
Object.assign(BARRIERS.drystone, {wear:1.0, repair:8});    // low, mortarless and long-lived
Object.assign(BARRIERS.adobe,    {wear:2.0, repair:10});   // mud erodes in the rain
Object.assign(BARRIERS.stake,    {wear:2.5, repair:6});
Object.assign(BARRIERS.bone,     {wear:1.8, repair:12});
Object.assign(BARRIERS.rope,     {wear:3.0, repair:3});
Object.assign(BARRIERS.lagoon,   {wear:1.4, repair:15});   // salt spray and algae    // decoration only (deco): a keep-out line for guests that frays; it never holds animals

// Fences drawn from pictures in the 3/4 view (sprites/fence/<kind>-<pristine|degrading|broken>.png, made by tools/pixelfence_bars.py pixelfence_wood.py, pixelfence_electric.py, pixelfence_acrylic.py, pixelfence_hedge.py, pixelfence_concrete.py, pixelfence_masonry.py, pixelfence_more.py, pixelfence_themed.py, pixelfence_rope.py and pixelfence_lagoon.py). `gate` means the kind also has a keeper gate picture, <kind>-gate.png (one picture: gates never wear).
// One picture is a 3 m section (w by h pixels of ROCK_MPP); sections are laid end to end along a side. Every kind of fence has pictures now: bars, wood, electric, acrylic, hedge, concrete, brick, stone, bamboo, palisade, iron, drystone, adobe, stake, bone, rope and lagoon. `leafy` is a post-less kind (hedge): its sections tile by matching top outlines, and seen edge-on it is a wide leafy column. `power` means each state also has an `-off` twin (<kind>-pristine-off, <kind>-degrading-off, <kind>-gate-off, and its swing frames) shown while the exhibit's `powered` is false; `wires` (pixels above the ground) are drawn as thin lines between post columns when the side is seen edge-on.
//   worn     below this condition (percent) the fence shows its rusted picture; at 0 it is broken, trampled flat
//   minRun   a side that runs mostly north-south is seen edge-on, so it is drawn as a column when less than this share of its length runs across the screen
//   edge     how many pixels wide that column is
const FENCE_SPRITES = {bars:{w:23, h:20, gate:true}, wood:{w:23, h:12, gate:true}, acrylic:{w:23, h:17, gate:true}, hedge:{w:23, h:14, gate:true, leafy:true}, concrete:{w:23, h:28, gate:true}, brick:{w:23, h:17, gate:true}, stone:{w:23, h:20, gate:true}, bamboo:{w:23, h:15, gate:true}, palisade:{w:23, h:22, gate:true}, iron:{w:23, h:17, gate:true}, drystone:{w:23, h:11, gate:true}, adobe:{w:23, h:16, gate:true}, stake:{w:23, h:12, gate:true}, bone:{w:23, h:18, gate:true}, rope:{w:23, h:10, gate:true}, lagoon:{w:23, h:18, gate:true, gateW:38, gateH:51, gateDeep:27}, electric:{w:23, h:27, gate:true, power:true, wires:[5, 9, 14, 18, 23]}};
// A kind with gateW/gateH/gateDeep (lagoon) has a catwalk for a gate: its picture size in px (gateDeep: how far a picture whose deck comes forward of the wall stands below the wall line), one picture a way the exhibit lies (-s, -e, -w), and it never swings.
// A keeper gate swings open when a keeper, vet or mechanic is within `reach` meters: `speed` is how much of its swing (0 shut, 1 open) it covers a second, shown in `frames` pictures (<kind>-gate.png, then -1, -2, -3).
const GATE_OPEN = {reach:3, speed:3, frames:4};
const GATE_GHOST = {w:3, d:.6, h:1.5};   // the Gates tool's ghost: m along the fence (the gate picture is 23 px at 0.13 m), across it, and the least it stands up
const FENCE_LOOK = {worn:60, minRun:.5, edge:3};

// Clever animals that test and attack their fences, like predators do
const SMART = ["velo", "utah", "dire", "arct", "andr", "kele", "hyae"];

const MAINT = {
  attackWear:4,        // condition lost per day by each attacking animal (more if it's much stronger than the fence)
  inspectEvery:2,      // days between inspections before a fence is overdue
  repairBelow:85,      // mechanics fix fences under this condition
  inspectMinutes:5,    // time to inspect a fence
  repairPerMinute:4,   // condition restored per minute of work
  speed:WALK_PER_MIN * STAFF_PACE,  // mechanics walk at STAFF_PACE of full walking speed
  hireCost:2000,
  wage:150,
};
BUILDINGS.workshop = {label:"Workshop", tag:"SHOP", one:"a workshop", glyph:"W", color:"#B8642A", price:3500, upkeep:50, w:10, d:10, dept:true,
                      full:"Maintenance workshop", blurb:"Mechanics are based here. They inspect and repair exhibit barriers."};

/* ---------------------------------------------------------------------
   PALEOFLORA AND THE BOTANY LAB
   --------------------------------------------------------------------- */

// Which era each period belongs to
const ERA_OF = {Cambrian:"paleozoic", Ordovician:"paleozoic", Silurian:"paleozoic", Devonian:"paleozoic", Carboniferous:"paleozoic", Permian:"paleozoic", Triassic:"mesozoic", Jurassic:"mesozoic", Cretaceous:"mesozoic",
                Paleogene:"cenozoic", Neogene:"cenozoic", Quaternary:"cenozoic"};

// What an exhibit is planted with. Every exhibit starts with Cenozoic plants (grass).
//   tech     what the Research Lab has to research first
const FLORA = {
  cenozoic:  {label:"Cenozoic",  plants:"grasses and flowering plants",              tech:null},
  mesozoic:  {label:"Mesozoic",  plants:"cycads, conifers, ginkgos, and ferns",      tech:"mesoplant"},
  paleozoic: {label:"Paleozoic", plants:"lycopod trees, horsetails, and seed ferns", tech:"paleoplant"},
};
// The Botany Lab makes Paleoflora food at a steady rate and keeps a stock of it
const PALEOFLORA = {
  perDay:60,          // units the Botany Lab grows each day on its own
  greenhouse:40,      // extra units per day from each greenhouse
  storeDays:2,        // The Botany Lab holds this many days of production
};
const FLORA_HAPPY = {home:6, away:-4};     // happiness for living among plants from the animal's own era, or another one
// Herbivores from these periods never evolved to eat grass, and get sick on it (Cenozoic plants, a grassland biome or grass hay)
const GRASS_INTOLERANT = ["Cambrian", "Ordovician", "Silurian", "Devonian", "Carboniferous", "Permian", "Triassic", "Jurassic"];
const GRASS_HIT = {intolerant:-15, cretaceous:-5};   // happiness hit at full grass share

BUILDINGS.ceres = {label:"Botany Lab", tag:"BOTANY", one:"the Botany Lab", glyph:"B", color:"#4E7F2E", price:10000, upkeep:120, w:25, d:20, dept:true, unique:true,
                   blurb:"The greenhouse lab. Grows Paleoflora food for prehistoric plant-eaters, plants for exhibits, and medicine for the PMC, once the Research Lab has researched them and the Time Travel Lab has found the plant DNA. Keepers collect Paleoflora here."};
// Greenhouses speed up Paleoflora. They need the research and a Botany Lab in the park.
BUILDINGS.greenhouse = {label:"Greenhouse", tag:"GROW", one:"a greenhouse", glyph:"G", color:"#6FA34A", price:6000, upkeep:60, w:10, d:10, dept:true,
                        tech:"greenhouse", needsDept:"ceres",
                        full:"Paleoflora greenhouse", blurb:"Adds 40 units of Paleoflora a day to the Botany Lab."};

// Power for electrified fences
const POWER = {
  perMeter:.5,            // kW each meter of electrified fence draws
  unpoweredStrength:20,   // an electric fence with no power is just wire
  genWear:4,              // generator condition lost per day
  offlineBelow:25,        // generators cut out below this condition
  repairPerPercent:60,    // materials to restore 1% of a generator's condition
};
BUILDINGS.generator = {label:"Generator", tag:"POWER", one:"a generator", glyph:"P", color:"#A88A1E", price:7500, upkeep:150, tech:"generator", w:10, d:10, dept:true, power:600,
                       full:"Diesel generator", blurb:"Powers every electrified fence in the park. Mechanics keep it running."};

// Staff vehicles. ATVs only drive on service roads; on guest paths staff get off and walk, and the ATV stays parked where they got off for the next person.
const VEHICLES = {
  perDepot:3,             // ATVs each depot brings to the park, shared by all staff
  speedMult:5,            // how much faster than walking an ATV goes
  wear:3,                 // depot condition lost per day
  offlineBelow:25,        // a depot this worn grounds its ATVs
  repairPerPercent:50,    // materials to restore 1% of a depot's condition
};
BUILDINGS.depot = {label:"Vehicle Depot", tag:"ATV", one:"a vehicle depot", glyph:"A", color:"#4F6273", price:12500, upkeep:300, w:15, d:10, dept:true,
                   tech:"vehicles", serviceOnly:true,
                   full:"Staff vehicle depot", blurb:"Adds 3 ATVs for staff to share. They drive five times faster than walking, but only on service roads, and an ATV stays where it was left. Mechanics keep it running."};


/* ---------------------------------------------------------------------
   LOGISTICS
   Food and medicine are real goods. They are bought at a Delivery Dock or made on site,
   sit in stores where they can spoil, and keepers carry them to where they're needed.
   --------------------------------------------------------------------- */
// Goods stored in buildings. Exhibits eat plants, meat, fish, insects, fruit, and shellfish. Paleoflora lives at the Botany Lab.
//   spoil   share of a store's stock lost to rot each night
const GOODS = {
  plants: {label:"Hay",      spoil:.04},
  meat:   {label:"Meat",     spoil:.15},
  fish:   {label:"Fish",     spoil:.20},
  insects:{label:"Insects",  spoil:.10},
  fruit:  {label:"Fruit",    spoil:.18},
  shellfish:{label:"Shellfish", spoil:.20},
  medpal: {label:"Paleozoic medicine", spoil:.02},
  medmes: {label:"Mesozoic medicine",  spoil:.02},
  medcen: {label:"Cenozoic medicine",  spoil:.02},
  medmod: {label:"Contemporary medicine", spoil:.02},   // bought at the dock, never grown
  // what food stands and gift shops sell from: a unit is $1 of wholesale stock
  snacks: {label:"Snacks",      spoil:.08},
  drinks: {label:"Drinks",      spoil:.01},
  merch:  {label:"Merchandise", spoil:0},
};
const FEED_GOODS = ["plants", "meat", "fish", "insects", "fruit", "shellfish"];
const GUEST_GOODS = ["snacks", "drinks", "merch"];
const CMED = "medmod";   // contemporary medicine: bought at the dock
const ORDER_GOODS = FEED_GOODS.concat(GUEST_GOODS, [CMED]);   // what the dock buys
// Botany Lab medicine is kept per era. Contemporary medicine (CMED) is a good of its own: the dock orders it, custodians carry it to the PMC
const MED_GOOD = {paleozoic:"medpal", mesozoic:"medmes", cenozoic:"medcen"};
const MED_GOODS = ["medpal", "medmes", "medcen"];
const GOOD_COLOR = {...FOOD_COLOR, medpal:"#7A2E5C", medmes:"#B0384F", medcen:"#D9674A", medmod:"#8C8C96", snacks:"#D98A3A", drinks:"#4FA3C7", merch:"#9A5A8C"};
// Units of guest goods a day each guest gets through when the shelves stay full. Ordering never plans for less,
// because a day of empty shelves sells little and would otherwise shrink the next order.
const GUEST_USE = {snacks:1, drinks:.7, merch:1.5};
const GUEST_GOODS_FROM = 7;   // new parks: suppliers deliver straight to stands and shops until this day
const LOGI = {
  hubDays:1.5,         // a station keeps this many days of its zone's food on hand
  bulkDays:2.5,        // warehouses and cold stores keep this many days of the whole park's food
  crateBoost:1.3,      // stacking crates multiply store sizes
  coolerCut:.6,        // cooler boxes multiply spoilage
  forklift:3,          // a forklift multiplies a restock trip's load
  urgentBelow:.35,     // a hub under this share of its target gets restocked before routine cleaning
  pmcDoses:150,        // doses the PMC keeps on hand
  dockMarkup:1.25,     // the dock charges this much over a food unit's base cost
  rushMarkup:1.75,     // a rush order costs this much
  rushLot:50,          // units in a rush order
  autoDays:2,          // auto-ordering keeps the dock stocked with this many days of the park's food
  truckMin:120,        // while the park is open, a supply truck tops up each dock this often
  coldPower:25,        // kW a cold store draws
  coldSpoil:.2,        // a powered cold store multiplies spoilage by this
};
const DOCK_PRICE = {plants:1, meat:1, fish:1, insects:1, fruit:1, shellfish:1};   // multiplied by the markup and FOOD_UNIT_COST
const GUEST_GOOD_PRICE = 1;   // a unit of snacks, drinks, or merchandise, before the dock's markup

// Stores. cap is total units, holds says which goods fit, spoil multiplies the rot rate.
BUILDINGS.station.store   = {cap:80,  holds:FEED_GOODS, spoil:1};
BUILDINGS.station.blurb   = "Keepers start here and hold a small stock of food. Zone hubs: custodians restock them from bigger stores.";
// The aquarists' own station: the same building and store, for lagoons and aquariums
BUILDINGS.diveshack = {...BUILDINGS.station, label:"Dive Shack", tag:"AQUARISTS", one:"a dive shack", glyph:"D", color:"#1F6F9F", full:"Food storage and aquarist lockers",
  blurb:"Aquarists start here and hold a small stock of food. Zone hubs: custodians restock them from bigger stores."};
BUILDINGS.warehouse = {label:"Warehouse", tag:"STORE", one:"a warehouse", glyph:"W", color:"#6B5B3E", price:6750, upkeep:50, w:15, d:10, dept:true,
                       store:{cap:600, holds:["plants", "insects", "drinks", "merch"], spoil:.7, bulk:true},
                       full:"Dry goods warehouse", blurb:"Stores hay, insect feed, drinks, and merchandise, and keeps them better than a station does. Custodians restock stations, stands and shops from here."};
BUILDINGS.coldstore = {label:"Cold Store", tag:"COLD", one:"a cold store", glyph:"❄", color:"#4A7FA0", price:12000, upkeep:120, tech:"coldstore", w:15, d:10, dept:true,
                       store:{cap:600, holds:["meat", "fish", "fruit", "shellfish", ...MED_GOODS, CMED, "snacks"], spoil:1, cold:true, bulk:true},
                       full:"Refrigerated store", blurb:"Keeps meat, fish, fruit, shellfish, medicine, and snacks from rotting, as long as it has power from a generator."};
BUILDINGS.dock = {label:"Delivery Dock", tag:"DOCK", one:"a delivery dock", glyph:"D", color:"#3E5C7A", price:4500, upkeep:50, w:15, d:10, dept:true, serviceOnly:true,
                  store:{cap:1500, holds:ORDER_GOODS, spoil:1, bulk:true, dock:true},
                  full:"Supplier deliveries", blurb:"Order animal food and stock for your stands and shops. Trucks come overnight and every two hours while the park is open. They need a service road to the entrance. Keepers and custodians carry it from here."};
// Hotels keep toiletries, which custodians bring from the dock or a warehouse
for(const t of ["campground", "lodge", "resort"]) BUILDINGS[t].store = {cap:BUILDINGS[t].rooms * LODGING.toiletries * 2, holds:["merch"], spoil:1, vendor:true};
// Food stands and gift shops keep their own stock
for(const [t, cap] of Object.entries({kiosk:60, food:150, restaurant:400, cart:60, shop:150, megastore:400}))
  BUILDINGS[t].store = {cap, holds:BUILDINGS[t].kind === "food" ? ["snacks", "drinks"] : ["merch"], spoil:1, vendor:true};
// Production. Needs the food production research. Output goes into the building's own store.
//   makes   units a day
BUILDINGS.farm      = {label:"Hay Farm",   tag:"FARM", one:"a hay farm",   glyph:"F", color:"#7A9A36", price:13500, upkeep:260, w:20, d:15, dept:true, tech:"foodprod",
                       store:{cap:150, holds:["plants"], spoil:1, source:true}, makes:{plants:60},
                       full:"Hay and forage farm", blurb:"Grows 60 units of hay a day."};
BUILDINGS.ranch     = {label:"Livestock Ranch", tag:"RANCH", one:"a livestock ranch", glyph:"L", color:"#9A4A3A", price:16500, upkeep:380, w:20, d:15, dept:true, tech:"foodprod",
                       store:{cap:150, holds:["meat"], spoil:1, source:true}, makes:{meat:40},
                       full:"Feed livestock ranch", blurb:"Raises 40 units of meat a day. Meat spoils fast, so keep a cold store nearby."};
BUILDINGS.hatchery  = {label:"Fish Hatchery", tag:"FISH", one:"a fish hatchery", glyph:"H", color:"#3A7FA8", price:16500, upkeep:380, w:20, d:15, dept:true, tech:"foodprod",
                       store:{cap:150, holds:["fish"], spoil:1, source:true}, makes:{fish:40},
                       full:"Fish hatchery", blurb:"Breeds 40 units of fish a day. It spoils fastest of all."};
BUILDINGS.insectary = {label:"Insectary", tag:"BUGS", one:"an insectary", glyph:"I", color:"#A8832E", price:12000, upkeep:220, w:15, d:10, dept:true, tech:"foodprod",
                       store:{cap:150, holds:["insects"], spoil:1, source:true}, makes:{insects:30},
                       full:"Insect farm", blurb:"Breeds 30 units of insects a day."};
BUILDINGS.orchard   = {label:"Fruit Orchard", tag:"FRUIT", one:"a fruit orchard", glyph:"O", color:"#B8486A", price:13500, upkeep:260, w:20, d:15, dept:true, tech:"foodprod",
                       store:{cap:150, holds:["fruit"], spoil:1, source:true}, makes:{fruit:40},
                       full:"Fruit orchard", blurb:"Grows 40 units of fruit a day. It spoils fast, so keep a cold store nearby."};
BUILDINGS.shellfarm = {label:"Shellfish Farm", tag:"SHELL", one:"a shellfish farm", glyph:"S", color:"#6F78A8", price:15000, upkeep:320, w:20, d:15, dept:true, tech:"foodprod",
                       store:{cap:150, holds:["shellfish"], spoil:1, source:true}, makes:{shellfish:30},
                       full:"Shellfish farm", blurb:"Raises 30 units of shellfish a day. It spoils fast, so keep a cold store nearby."};

// Work zones: groups of keepers, exhibits, and stores. Keepers in a zone look after that zone's exhibits.
const ZONE_COLORS = ["#E0A030", "#4F9BD9", "#C25B8E", "#52B788", "#9B7BE0", "#E07A5F"];
const ZONE_MIN_AREA = 200;

// Things the Research Lab can research besides animals. Each one takes time (see RESEARCH_MIN_PER_POINT).
//   group   which Research Lab tab it sits on: "barrier" and "build" under Park Management, "tar" for Genetics Lab upgrades,
//           "flora" and "med" under Paleo-Flora
//   needs   another project that has to finish first
//   era     (flora, med) the era it belongs to
const TECH = [
  {id:"bars",     group:"barrier", label:"Metal bars",        points:15, text:"Strength 45. Holds mid-size herbivores."},
  {id:"electric", group:"barrier", label:"Electrified fence", points:18, text:"Strength 65 while powered. Holds most herbivores and smaller predators. Needs generators."},
  {id:"concrete", group:"barrier", label:"Concrete walls",    points:20, text:"Strength 140. Holds anything, but guests can barely see in."},
  {id:"masonry",  group:"barrier", label:"Masonry walls",     points:12, text:"Brick (strength 100) and stone (strength 115) walls. Tough, only moderately tall, and guests can still see over them. Mostly a good look."},
  {id:"acrylic",  group:"barrier", label:"Acrylic walls",     points:40, text:"Strength 85. Clear walls that guests love looking through."},
  {id:"aviary",   group:"barrier", label:"Aviary netting",    points:35, text:"Carbon fiber and steel mesh over an exhibit, so flying animals can't escape."},
  {id:"catchnet", group:"barrier", label:"Catch netting",     points:25, text:"Netting along an exhibit's fence that catches 95% of the trash guests throw in. It catches less as the fence wears."},
  {id:"moat",     group:"barrier", label:"Moats",             points:60, text:"Stops every escape from an exhibit, whatever its walls."},
  {id:"platform", group:"barrier", label:"Viewing platforms", points:30, text:"Raised decks on an exhibit's edge. Guests enjoy the exhibit far more."},
  {id:"education", group:"build", label:"Education programs", points:12, text:"Build an Education Center, where guests learn about prehistoric life. Educated guests are happier, tidier, and more generous."},
  {id:"edtheater", group:"build", label:"Education theater", points:40, needs:"education", text:"Add a Theater module to an Education Center for shows that draw crowds."},
  {id:"edfossils", group:"build", label:"Fossil displays", points:40, needs:"education", text:"Add Fossil Displays to an Education Center. They teach more as you unlock more animals."},
  {id:"edauditorium", group:"build", label:"Education auditorium", points:55, needs:"education", text:"Add an Auditorium to an Education Center so more guests can sit through a talk at once."},
  {id:"edlabwindow", group:"build", label:"Live lab window", points:50, needs:"education", text:"Add a Live Lab Window to an Education Center. Guests watch the labs at work, so it shines when they're busy."},
  {id:"ednursery", group:"build", label:"Nursery window", points:50, needs:"education", text:"Add a Nursery Window to an Education Center. Guests watch the Genetics Lab's clones grow, and love a hatching."},
  {id:"edbotanical", group:"build", label:"Botanical hall", points:50, needs:"paleoflora", text:"Add a Botanical Hall to an Education Center. It grows richer as the Botany Lab finishes plant DNA and keeps beds growing."},
  {id:"edsimroom", group:"build", label:"Simulation room", points:65, needs:"education", text:"Add a Simulation Room to an Education Center. Guests walk through deep time using the event records the Time Travel Lab has finished."},
  {id:"ediorama", group:"build", label:"Ecosystem diorama", points:50, needs:"education", text:"Add an Ecosystem Diorama to an Education Center. It gets richer with every kind of habitat you keep animals in."},
  {id:"edtouch", group:"build", label:"Touch gallery", points:40, needs:"education", text:"Add a Touch Gallery to an Education Center. Hands-on casts and bones, and the shelves fill as the Time Travel Lab finishes genomes."},
  {id:"modern", group:"build", label:"Modern design", points:50, text:"Unlocks the Modern theme: polished stone, metal and glass for paths, buildings and exhibits."},
  {id:"hotels",  group:"build", label:"Hotels",           points:35, text:"Build campgrounds, safari lodges, and resort hotels. Guests stay the night and spend the next day in the park."},
  {id:"coldstore", group:"build", label:"Cold stores",      points:15, text:"Refrigerated stores that keep meat, fish, medicine, and snacks from rotting. Needs power."},
  {id:"security", group:"build", label:"Security offices",  points:15, text:"Build a Security Office and hire guards to patrol, deter vandals, and steer guests out during escapes."},
  {id:"generator", group:"build", label:"Power generators", points:15, text:"Diesel generators that power electrified fences and cold stores."},
  {id:"cameras",  group:"build", label:"Security cameras",  points:25, text:"Each Security Office watches the paths around it, and you can put camera posts on paths to watch more. Guards are sent straight to vandals the cameras see."},
  {id:"vehicles",   group:"build", label:"Staff vehicles",   points:70, text:"Vehicle depots with ATVs. Staff drive five times faster, but only on service roads."},
  {id:"transit",   group:"build", label:"Guest tram",       points:60, text:"Draw tram track and build tram stations beside it. Guests ride between stations instead of walking, and pay a fare."},
  {id:"foodprod",  group:"build", label:"Food production",  points:18, text:"Build farms, ranches, hatcheries, and insectaries to make animal food. Cheaper than the dock, but it spoils if nobody collects it."},
  // Genetics Lab upgrades
  {id:"fast1",    group:"tar", label:"Faster incubators",   points:35, text:"Clones finish in three quarters of the time."},
  {id:"fast2",    group:"tar", label:"Much faster incubators", points:80, needs:"fast1", text:"Clones finish in about half the time."},
  // The Time Travel Lab upgrades
  {id:"ghostcost1", group:"ghost", label:"Leaner expeditions",   points:35, text:"Trips cost about a fifth less."},
  {id:"ghostcost2", group:"ghost", label:"Lean expeditions",     points:80, needs:"ghostcost1", text:"Trips cost about a third less."},
  {id:"ghostspeed1", group:"ghost", label:"Faster time engines", points:35, text:"Expeditions take three quarters of the time."},
  {id:"ghostspeed2", group:"ghost", label:"Much faster time engines", points:80, needs:"ghostspeed1", text:"Expeditions take about half the time."},
  {id:"ghostmk2", group:"ghost", label:"Mk. II drones", points:40, text:"Drones come back empty handed 15% less often, scouting and on expeditions."},
  {id:"ghostmk3", group:"ghost", label:"Mk. III drones", points:80, needs:"ghostmk2", text:"Drones come back empty handed 30% less often."},
  {id:"ghostmk4", group:"ghost", label:"Mk. IV drones", points:140, needs:"ghostmk3", text:"Drones come back empty handed 40% less often."},
  {id:"ghostmk5", group:"ghost", label:"Mk. V drones", points:220, needs:"ghostmk4", text:"Drones come back empty handed half as often."},
  // Genetics
  {id:"genetherapy", group:"gene", label:"Genome therapy", points:70, text:"Vets can rewrite a sickly clone's DNA to match the lab's best genome for its species, making it healthier. Needs a Paleo-Medicine Center, and only goes as far as the lab's own DNA quality, so send expeditions for better samples to raise it."},
  // Paleo-Flora: plants and medicine, grown at the Botany Lab
  {id:"paleoflora", group:"flora", label:"Paleoflora cultivation", points:30, text:"The Botany Lab starts growing Paleoflora, the food prehistoric plant-eaters need instead of grass. It needs plant DNA from the Time Travel Lab first."},
  {id:"mesoplant",  group:"flora", era:"mesozoic",  label:"Mesozoic flora",  points:50, needs:"paleoflora", text:"Cycads, conifers, ginkgos, and ferns. Once researched, the Time Travel Lab can collect each period's plant DNA, then the Botany Lab grows its plants for exhibits."},
  {id:"paleoplant", group:"flora", era:"paleozoic", label:"Paleozoic flora", points:65, needs:"paleoflora", text:"Lycopod trees, horsetails, and seed ferns. Once researched, the Time Travel Lab can collect each period's plant DNA, then the Botany Lab grows its plants for exhibits."},
  {id:"sterile",    group:"flora", label:"Sterile prehistoric plants", points:30, needs:"paleoflora", text:"Seedless de-extinct plants that can't spread, so plants from any period can grow out in the park, along paths and in gardens. Mesozoic and Paleozoic ones still come from the Botany Lab."},
  {id:"greenhouse", group:"flora", label:"Greenhouses",      points:30, needs:"paleoflora", text:"Build greenhouses near the Botany Lab to grow Paleoflora faster."},
  {id:"medceno",    group:"med", era:"cenozoic",  label:"Cenozoic medicine",  points:12, text:"The Botany Lab grows medicine for Paleogene, Neogene, and Quaternary animals. Refine it for each period to cure them fully."},
  {id:"medmeso",    group:"med", era:"mesozoic",  label:"Mesozoic medicine",  points:45, text:"The Botany Lab grows medicine for Triassic, Jurassic, and Cretaceous animals. Needs Mesozoic plant DNA. Refine it for each period to cure them fully."},
  {id:"medpaleo",   group:"med", era:"paleozoic", label:"Paleozoic medicine", points:60, text:"The Botany Lab grows medicine for Paleozoic animals, from the Cambrian to the Permian. Needs Paleozoic plant DNA. Refine it for each period to cure them fully."},
];
// Refining an era's medicine for one period: a cure for that period's animals. Costs by era.
const REFINE_POINTS = {cenozoic:8, mesozoic:14, paleozoic:20};
const MOAT_PER_METER = 150;
const AVIARY_PER_SQM = 4;
const NET_PER_METER = 25;   // catch netting along the fence

// Flying animals. Outside an aviary or vivarium they escape almost at once.
const FLYERS = ["quet", "pter", "dimo", "mega", "arch", "micr", "yiqi", "arge", "ppig", "rmlo"];

const BANKRUPT = 25000;   // the park goes bankrupt (the only game over) when debt passes this; a warning comes at half

const ESCAPE = {
  lawsuit:75000,       // cost of each guest killed
  sedateMinutes:10,    // how long a vet (or a keeper, if there are no vets) takes to dart and sedate an escaped animal
  looseSpeed:WALK_PER_MIN * .75,   // escaped animals wander a bit slower than people walk
  bigHerbivore:1500,   // herbivores needing this much room or more are dangerous when loose
};

/* ---------------------------------------------------------------------
   PALEO-MEDICINE
   --------------------------------------------------------------------- */

// Animals fall ill or get hurt. Vets from the Paleo-Medicine Center (PMC) dart them,
// keepers carry them in, and the PMC treats them with medicine from the Botany Lab.
const HEALTH = {
  startDay:18,         // new parks: nobody gets sick before this day
  step:60,             // park minutes between health steps: new cases are rolled and sick animals get worse this often, through the day
  illChance:.003,      // chance a day a well-kept animal falls ill; dirt is what mostly raises it
  hungerMult:4,        // a whole day without food makes illness this much more likely (on top of 1)
  dirtPer:12,          // every this many points of dirt above the unhappy line adds 1x more risk
  crowdIll:1.5,        // a cramped exhibit (less room than its animals need) makes illness this much more likely
  frail:{below50:2, below70:1.4},   // clones from poor DNA get sick more
  grassSick:.004,      // chance a day an old plant-eater eating only plants it never evolved for is poisoned by them (less for a share of it)
  territorial:.04,     // chance a day a territorial animal is hurt by each rival of its own kind
  attacked:.15,        // chance a day an animal is hurt by a species that preys on it
  ground:.01,          // chance a day an animal that can get Bumblefoot gets it on dirty ground or in the wrong biome
  sickHappy:8,         // happiness lost per sick animal, as a share of the herd (times its band's happy)
  dartMinutes:8,       // how long a vet takes to dart a sick animal
  obviousAt:40,        // a hidden case shows once it gets this bad
  checkEvery:3,        // days between vet check-ups before an exhibit is overdue
  checkMinutes:5,      // time a vet spends looking over an exhibit's animals
  heal:2,              // a day a mild injury heals on its own, while the exhibit is fed, watered and clean and the animal is calm
  healStress:60,       // calm: stress under this
  beds:6,              // patients the PMC holds at once
  healPerNight:45,     // severity a treated patient recovers each night
  dose:2,              // medicine doses one patient's treatment uses
};
// Every condition is one of three kinds, and shares its kind's numbers:
//   start, worsen   severity a new case starts at, and how much worse it gets a day untreated (100 kills)
//   hidden          a mild case stays hidden until a vet's check-up (or until it reaches HEALTH.obviousAt)
//   field, fieldMin, fieldDose   a vet treats it where it stands up to this severity, taking this long and this many doses
const SICK_KIND = {
  injury:    {label:"Injury",    adj:"Injured",  start:25, worsen:6,  field:40,  fieldMin:12, fieldDose:1},
  infection: {label:"Infection", adj:"Infected", start:20, worsen:8,  field:40,  fieldMin:12, fieldDose:1, hidden:true},
  poison:    {label:"Poisoning", adj:"Poisoned", start:50, worsen:25, field:100, fieldMin:20, fieldDose:2},
};
// What being this sick does, from `from` severity up. rest is added to the rest score, act multiplies playing and wandering,
// eat how fast it eats, gait how fast it walks, stress what it adds to stress, happy how much of a sick animal it counts as for its exhibit
const SICK_BAND = [
  {label:"Mild",     from:0,  rest:0,  act:1,  eat:1,   gait:1,  stress:6,  happy:.5},
  {label:"Serious",  from:40, rest:30, act:.6, eat:1,   gait:.7, stress:14, happy:1},
  {label:"Critical", from:75, rest:90, act:.2, eat:.35, gait:.5, stress:24, happy:1.5},
];
// The conditions. A new case picks one at random among those its body can get (who, not) and its cause brings on (from);
// with no cause that fits, any its body can get.
//   who   body tags (bodyTags in medicine.js): a CLADE name, or any, vert (vertebrates), landvert, tetrapod (vertebrates but fish),
//         aqfish and aqinvert (fish and invertebrates that live in water), landbug (land invertebrates), shelled, legs, teeth, or a species id
//   from  dirt, water (foul water, the dirt of tanks and pools), biome (the wrong one), shelter (weather with nowhere to shelter),
//         lamp (no heat lamp), stress, crowd, hunger, thirst, trash, plants (ones it never evolved for), fight, attack, gore
//   only  only its own cause brings it on, never as a stand-in
const CONDITIONS = {
  concussion:  {name:"Concussion",          kind:"injury", who:["any"], not:["aqfish"], from:["fight", "shelter"]},
  fracture:    {name:"Fracture",            kind:"injury", who:["tetrapod"], from:["fight", "attack", "shelter"]},
  laceration:  {name:"Laceration",          kind:"injury", who:["any"], from:["fight", "attack", "shelter"]},
  sprain:      {name:"Sprain",              kind:"injury", who:["legs"], from:["fight", "shelter"]},
  bite:        {name:"Bite Wound",          kind:"injury", who:["any"], from:["fight", "attack"]},
  gore:        {name:"Goring Injury",       kind:"injury", who:["any"], from:["gore"], only:true},
  dislocation: {name:"Joint Dislocation",   kind:"injury", who:["legs"], from:["fight"]},
  claw:        {name:"Torn Claw/Hoof/Nail", kind:"injury", who:["legs"], from:["fight"]},
  tooth:       {name:"Chipped Tooth",       kind:"injury", who:["teeth"], from:["fight"]},
  bumblefoot:  {name:"Bumblefoot",          kind:"injury", who:["bird", "theropod", "reptile"], from:["dirt", "biome"]},
  fintear:     {name:"Fin Tear",            kind:"injury", who:["aqfish"], from:["fight", "attack", "shelter"]},
  pneumonia:   {name:"Pneumonia",           kind:"infection", who:["tetrapod"], from:["dirt", "shelter", "lamp"]},
  tb:          {name:"Tuberculosis",        kind:"infection", who:["landvert", "seamammal"], from:["dirt", "crowd", "stress"]},
  gastro:      {name:"Gastroenteritis",     kind:"infection", who:["vert"], from:["dirt", "water"]},
  avianflu:    {name:"Avian Influenza",     kind:"infection", who:["bird", "theropod", "sauropod"], from:["dirt", "stress", "shelter"]},
  aspergillosis:{name:"Aspergillosis",      kind:"infection", who:["bird", "reptile"], from:["dirt", "shelter"]},
  nematodes:   {name:"Nematodes",           kind:"infection", who:["vert"], from:["dirt", "hunger"]},
  ticks:       {name:"Ticks",               kind:"infection", who:["reptile", "ornithischian", "sauropod", "theropod", "pterosaur", "bird", "synapsid", "mammal", "hooved"], from:["dirt"]},
  lice:        {name:"Lice",                kind:"infection", who:["mammal", "hooved"], from:["dirt"]},
  fmd:         {name:"Foot and Mouth Disease", kind:"infection", who:["hooved"], from:["dirt", "crowd"]},
  bluetongue:  {name:"Bluetongue Virus",    kind:"infection", who:["hooved"], from:["dirt", "shelter"]},
  tetanus:     {name:"Tetanus",             kind:"infection", who:["landvert"], from:["dirt"]},
  whitespot:   {name:"White Spot Disease",  kind:"infection", who:["aqfish", "anom", "opab"], from:["water", "stress", "shelter"]},
  flukes:      {name:"Flukes",              kind:"infection", who:["aqfish"], from:["water"]},
  saprolegniasis:{name:"Saprolegniasis",    kind:"infection", who:["aqfish"], from:["water", "shelter"]},
  chitino:     {name:"Chitinoclastic Bacteria", kind:"infection", who:["shelled", "anom", "opab"], from:["water"]},
  cordyceps:   {name:"Cordyceps",           kind:"infection", who:["landbug"], from:["dirt", "shelter"]},
  foreign:     {name:"Foreign Object Ingestion", kind:"poison", who:["any"], from:["trash"], only:true},
  modernplant: {name:"Modern Plant Poisoning", kind:"poison", who:["any"], from:["plants"], only:true},
  botulism:    {name:"Botulism",            kind:"poison", who:["landvert"], from:["dirt"]},
  nitrate:     {name:"Nitrate Toxicity",    kind:"poison", who:["aqfish", "aqinvert"], from:["water"]},
  gasbubble:   {name:"Gas Bubble Disease",  kind:"poison", who:["aqfish", "aqinvert"], from:["water"]},
};
// Genome therapy (Research Lab tech "genetherapy"): an exhibit with it switched on has its vet check-ups lift each clone's DNA quality toward the lab's genome for its species
const GENE = {
  minutes:10,          // extra time a check-up takes for each animal treated
  step:20,             // most DNA quality points one procedure adds
  minGain:5,           // the lab's genome has to beat the animal by this much to be worth it
  base:500,            // fixed price of a procedure
  perPoint:60,         // plus this for each quality point gained
};
// Territorial species fight rivals of their own kind, more so when cramped
const TERRITORIAL = ["trex", "carc", "torv", "allo", "cnot", "spin", "bary", "dime", "inos", "post", "dsuc", "tita", "bari", "mlan", "andr", "arct", "kele",
                     "tric", "styr", "anky", "elas", "pcer", "prio", "dche"];
// The Botany Lab grows medicine in batches (see CERES_GROW) once the Research Lab has unlocked its type
const MEDICINE = {
  capacity:60,         // doses the Botany Lab holds of each era's medicine
  feedPer:5,           // medicated feed uses 1 dose a day for every this many animals
  feedCut:.35,         // medicated feed multiplies the chance of an infection by this
};
// The medicine each era's animals need
const MED_TECH = {paleozoic:"medpaleo", mesozoic:"medmeso", cenozoic:"medceno"};
// Contemporary medicine: suppliers restock the PMC every night. It treats any animal,
// but can't cure prehistoric illness for good: the animal goes home with a chronic case.
const MODERN = {
  stock:30,            // doses the dock keeps on order (auto-ordering)
  cost:25,             // price of each dose at the dock
  heal:{cenozoic:.9, mesozoic:.7, paleozoic:.5},     // how well it works, as a share of the era's own medicine
  floor:{cenozoic:5, mesozoic:10, paleozoic:15},    // how sick it leaves an animal, at best
  chronicHappy:.25,     // a chronic case counts as this much of a sick animal for happiness
};
const ERA_LABEL = {paleozoic:"Paleozoic", mesozoic:"Mesozoic", cenozoic:"Cenozoic"};
const VET = {
  hireCost:3000,
  wage:200,
  speed:WALK_PER_MIN * STAFF_PACE,  // vets walk at STAFF_PACE of full walking speed
  patients:3,          // patients each vet can treat each night
};
BUILDINGS.pmc = {label:"Paleo-Medicine Center", tag:"PMC", one:"a Paleo-Medicine Center", glyph:"+", color:"#B0384F", price:6000, upkeep:100, w:20, d:15, dept:true, unique:true,
                 full:"Veterinary hospital and dart team", blurb:"Vets are based here. They give exhibits routine check-ups, treat minor illnesses on the spot, dart serious cases and escaped animals, and treat patients with medicine from the Botany Lab."};

BUILDINGS.pmc.store = {cap:LOGI.pmcDoses, holds:MED_GOODS.concat(CMED), spoil:1, sink:true};

// Viewing platforms snap onto an exhibit's fence
BUILDINGS.platform = {label:"Viewing Platform", tag:"VIEW", one:"a viewing platform", glyph:"V", color:"#B08654", price:20000, upkeep:80, tech:"platform", w:15, d:5};
// Viewing Galleries stand against a pool's fence, outside it: guests go in and watch the pool animals through glass under water. They stand on park ground (parkGround), not over the exhibit.
BUILDINGS.gallery = {label:"Viewing Gallery", tag:"GALLERY", one:"a viewing gallery", glyph:"W", color:"#2E6E8E", price:30000, upkeep:150, w:15, d:10, gallery:true};
const GALLERY = {
  view:1.8,        // what one gallery multiplies how well guests see into the pool by (a viewing platform gives 1.4), each more adds `more`, up to `most`
  more:.15,
  most:2.1,
  gap:.4,          // meters between the fence and the gallery's back wall
};
// a building standing on the park's own ground: everything but a viewing platform, whose deck juts over its exhibit
const parkGround = b => !b.exhibitId || !!BUILDINGS[b.type].gallery;

// Water is drawn inside an open exhibit like the exhibit itself (e.water: shapes with corners), and priced by area
const WATER = {
  perSqM:20,       // cost per square meter
  minArea:12,      // smallest body of water, in square meters
  margin:.5,       // gap kept between the water and the fence, in meters: room for the muddy bank, so the fence stands clear of the water
  oldPondR:6,      // radius of the round ponds older saves had; they become drawn water
};

// Landscaping: rocks, groves and shelters placed inside an open exhibit (e.land). Animals feel at home among what they like.
//   r      radius in meters. Groves come small (r 2), medium (r 3.5) and large (r 5).
//   cover  rock cover it adds (see HAB.rockEvery)
//   flora  a grove of plants from this era (see FLORA). Animals from that era feel at home in it and browse it.
//   slots  shelter slots it gives (see coverSlots). only: species ids that can use it, whatever their size (a burrow). fits: the biggest animal (in coverSlots) it takes, 19 is a sauropod. look: how it's drawn (burrow, cave, canopy; none is a barn). noCold: canopies give no cover in a cold snap.
//   tech   research needed first
//   size   small, medium or large. Mesozoic and Paleozoic plants (tech) use up one plant of that era and size, grown at the Botany Lab.
//   browse food units a day the animals nibble off it (Paleoflora for older groves, plants for Cenozoic ones)
//   period, biome   plants made from PLANT_TABLE: one of each size per period and biome, any exhibit can have them, but animals only count plants from the exhibit's own biome and dislike the rest
const LAND = {
  rock:   {label:"Rock",          one:"a rock",          price:600,  r:2, color:"#8E9188", cover:1},
  boulder:{label:"Boulder",       one:"a boulder",       price:2200, r:4, color:"#767A74", cover:3},
  shelter:{label:"Small Barn",     one:"a small barn",     price:2500, r:4, color:"#9A7B55", slots:10, fits:8},
  barn:   {label:"Large Barn",     one:"a large barn",      price:7000, r:7, color:"#7E6142", slots:36, fits:19},
  burrow: {label:"Burrow",         one:"a burrow",          price:900,  r:2, color:"#8A6B47", slots:4, only:["lyst", "hete", "hyps", "hyae", "dire"], look:"burrow"},
  cavesm: {label:"Small Cave",     one:"a small cave",      price:3200, r:4, color:"#6F6A62", slots:14, fits:6, look:"cave"},
  cavelg: {label:"Large Cave",     one:"a large cave",      price:8500, r:6, color:"#5B5750", slots:40, fits:12, look:"cave"},
  canopysm:{label:"Small Canopy",  one:"a small canopy",    price:1400, r:3, color:"#B9A77E", slots:8, fits:8,  look:"canopy", noCold:true},
  canopylg:{label:"Large Canopy",  one:"a large canopy",    price:4200, r:5, color:"#A8946A", slots:24, fits:19, look:"canopy", noCold:true},
  // a privacy screen (screen): a reed panel near the fence that shields up to SCREEN.holds animals from the path's view. It calms shy animals without hiding them from guests.
  screen: {label:"Privacy Screen", one:"a privacy screen", price:900, r:1.8, color:"#8C9A4B", screen:true},
  traysm: {label:"Small Food Tray",  one:"a small food tray",  price:400,  r:1.2, color:"#8A8F96", tray:12},
  traymd: {label:"Medium Food Tray", one:"a medium food tray", price:1000, r:2,   color:"#8A8F96", tray:30},
  traylg: {label:"Large Food Tray",  one:"a large food tray",  price:2500, r:3,   color:"#8A8F96", tray:80},
  // enrichment (toy: points of play it gives, see ENRICH): something to rub on, climb over and wallow in
  post:   {label:"Rubbing Post",   one:"a rubbing post",    price:600,  r:1.2, color:"#8A6A48", toy:1, look:"post"},
  logs:   {label:"Log Pile",       one:"a log pile",        price:1800, r:3,   color:"#7A5A3A", toy:3, look:"logs"},
  wallow: {label:"Mud Wallow",     one:"a mud wallow",      price:3500, r:5,   color:"#6B5236", toy:6, look:"wallow"},
  // toyFor: points by diet, so a toy can mean a lot to one animal and nothing to another (an animal takes its best diet). lasts: days before it's used up.
  // hay: plant food a day herbivores eat off it, like a grove (only those that eat plain plants; older ones need Paleoflora)
  ball:   {label:"Enrichment Ball", one:"an enrichment ball", price:800,  r:1.5, color:"#C8452B", toy:2, look:"ball"},
  icefish:{label:"Frozen Fish",     one:"a frozen fish block", price:250, r:1.2, color:"#E07A3A", toyFor:{piscivore:4, carnivore:2, omnivore:2}, lasts:3, look:"ice"},
  icefruit:{label:"Frozen Fruit",   one:"a frozen fruit block", price:200, r:1.2, color:"#C83A5A", toyFor:{herbivore:3, omnivore:4, frugivore:4}, lasts:3, look:"ice"},
  iceshell:{label:"Frozen Shellfish", one:"a frozen shellfish block", price:300, r:1.2, color:"#6FA3B8", toyFor:{molluscovore:4, piscivore:2, carnivore:2, omnivore:2}, lasts:3, look:"ice"},
  shank:  {label:"Frozen Shank",    one:"a frozen whole shank", price:400, r:1.4, color:"#8A3A2A", toyFor:{carnivore:4, omnivore:2}, lasts:3, look:"ice"},
  buglog: {label:"Insect Log",      one:"an insect log",      price:1200, r:2.2, color:"#6E5034", toyFor:{insectivore:4, omnivore:3}, look:"buglog"},
  hay:    {label:"Hay Bale",        one:"a hay bale",         price:300,  r:1.8, color:"#D9B95A", toyFor:{carnivore:3, piscivore:2, herbivore:1, omnivore:1}, lasts:4, hay:40, look:"hay"},
  // paleo: Paleoflora a day the older plant eaters eat off it; ceres: Paleoflora it takes from the Botany Lab to bale
  pbale:  {label:"Paleoflora Bale", one:"a Paleoflora bale",  price:500,  r:1.8, color:"#6E9A4A", ring:"#3E5F2A", toyFor:{carnivore:3, piscivore:2, herbivore:1, omnivore:1}, lasts:4, paleo:25, ceres:100, tech:"paleoflora", look:"hay"},
  // vivarium enrichment (vivToy instead of toy): picked from the vivarium's Enrichment list and set in the glass, never out in an open exhibit
  vbark:  {label:"Cork Bark Hide",     one:"a cork bark hide",     price:300,  r:.7, color:"#7A5A3A", toy:1, vivToy:true, hide:true, look:"vbark"},
  vbranch:{label:"Climbing Branches",  one:"climbing branches",    price:500,  r:.9, color:"#8A6A48", toy:2, vivToy:true, look:"vbranch"},
  vdig:   {label:"Dig Box",            one:"a dig box",            price:700,  r:.8, color:"#6B5236", toy:2, vivToy:true, look:"vdig"},
  vfeed:  {label:"Live-Feed Dispenser",one:"a live-feed dispenser",price:900,  r:.6, color:"#8A8F96", toy:3, vivToy:true, look:"vfeed"},
  vmist:  {label:"Misters",             one:"misters",              price:1200, r:.9, color:"#3E86A8", toy:3, vivToy:true, look:"vmist"},
  // vivarium fittings (vivToy, but not enrichment): the food dish keepers fill (tray: its base size, VIV_DISH.cap sets it by case), a basking lamp (lamp) and a pool (pool, poolM2 of water; flat: drawn on the floor under the animals)
  vdish:  {label:"Food Dish",           one:"a food dish",          price:250,  r:.8, color:"#8A8F96", vivToy:true, tray:6, fit:true, look:"vdish"},
  vlamp:  {label:"Basking Lamp",        one:"a basking lamp",       price:900,  r:.7, color:"#B87034", vivToy:true, lamp:true, fit:true, upkeep:6, look:"vlamp"},
  vpool:  {label:"Pool",                one:"a pool",               price:1800, r:1.3, color:"#3E86A8", vivToy:true, pool:true, poolM2:2.5, fit:true, flat:true, look:"vpool"},
  // aquarium fittings and enrichment (aqua: aquariums only; the dish goes in both): filters clean `clean` load a day (AQUA) and draw `kw` of power
  afilter:{label:"Canister Filter",     one:"a canister filter",    price:1500, r:.6, color:"#5E7E8A", vivToy:true, aqua:true, fit:true, filter:true, clean:30, kw:10, upkeep:8, look:"afilter"},
  asump:  {label:"Sump Filter",         one:"a sump filter",        price:5000, r:1, color:"#46606A", vivToy:true, aqua:true, fit:true, filter:true, clean:120, kw:30, upkeep:25, look:"asump"},
  arock:  {label:"Rock Arch",           one:"a rock arch",          price:600,  r:1, color:"#80796C", toy:2, vivToy:true, aqua:true, hide:true, look:"arock"},
  aweed:  {label:"Seaweed Bed",         one:"a seaweed bed",        price:500,  r:.9, color:"#4E7A3A", toy:2, vivToy:true, aqua:true, look:"aweed"},
  aboulder:{label:"Boulder Pile",       one:"a boulder pile",       price:400,  r:1, color:"#80796C", toy:1, vivToy:true, aqua:true, hide:true, look:"aboulder"},
  abrain: {label:"Brain Coral",         one:"a brain coral",        price:700,  r:.8, color:"#C0AC64", toy:2, vivToy:true, aqua:true, look:"abrain"},
  acoral: {label:"Branching Coral",     one:"a branching coral",    price:800,  r:.8, color:"#E48446", toy:2, vivToy:true, aqua:true, look:"acoral"},
  afan:   {label:"Sea Fan",             one:"a sea fan",            price:700,  r:.8, color:"#9C5492", toy:2, vivToy:true, aqua:true, look:"afan"},
  asponge:{label:"Sponge Cluster",      one:"a sponge cluster",     price:600,  r:.7, color:"#B8905C", toy:2, vivToy:true, aqua:true, look:"asponge"},
  akelp:  {label:"Kelp Stand",          one:"a kelp stand",         price:900,  r:.6, color:"#968434", toy:3, vivToy:true, aqua:true, look:"akelp"},
  ashell: {label:"Giant Ammonite Shell",one:"a giant ammonite shell",price:1500, r:1.1, color:"#C4A878", toy:3, vivToy:true, aqua:true, hide:true, look:"ashell"},
  abubble:{label:"Bubble Curtain",      one:"a bubble curtain",     price:1100, r:.8, color:"#9FCFE0", toy:3, vivToy:true, aqua:true, look:"abubble"},
};
// Vivarium prop pictures (sprites/viv/<key>.png, made by tools/pixelviv.py): size in pixels at ROCK_MPP a pixel. Upright ones stand on their spot, flat ones lie on the floor.
// Shelter pictures (sprites/shelter/<key>.png, made by tools/pixelshelter.py): size in pixels at ROCK_MPP a pixel, and `b`, the picture's base (its bottom row) in radii below the spot.
const SHELTER_SPRITES = {shelter:{w:48, h:40, b:.78}, barn:{w:84, h:62, b:.78}, burrow:{w:26, h:14, b:.85}, cavesm:{w:62, h:34, b:.85}, cavelg:{w:92, h:50, b:.85}, canopysm:{w:42, h:34, b:.6}, canopylg:{w:70, h:52, b:.6}};
// Food tray pictures (sprites/tray/<key>.png): flat dishes centered on the spot; `well` is [cx, cy, rx, ry] in pixels, the hollow the food is drawn into.
const TRAY_SPRITES = {traysm:{w:18, h:9, well:[9, 4.5, 6.5, 2.6]}, traymd:{w:30, h:14, well:[15, 7, 11.5, 4.6]}, traylg:{w:46, h:20, well:[23, 10, 18, 7.4]}};
const VIV_SPRITES = {aboulder:{w:18, h:10}, abrain:{w:16, h:10}, acoral:{w:16, h:16}, afan:{w:16, h:18}, asponge:{w:14, h:14}, akelp:{w:12, h:30}, ashell:{w:20, h:17}, afilter:{w:10, h:16}, asump:{w:18, h:14}, arock:{w:20, h:12}, aweed:{w:14, h:22}, abubble:{w:12, h:24}, vbark:{w:16, h:10}, vbranch:{w:16, h:20}, vdig:{w:16, h:11}, vfeed:{w:10, h:15}, vmist:{w:14, h:17}, vdish:{w:12, h:6, flat:true}, vlamp:{w:10, h:19}, vpool:{w:20, h:11, flat:true}};
// Vivarium food: animals eat from dishes (LAND.vdish), and keepers can only deliver into dishes, so a case with none can't be fed. A dish holds one food at a time, up to cap units
// by case size, and serves perDish animals; more animals than dishes go hungry. A dish costs nothing to run.
const VIV_DISH = {cap:{S:6, M:10, L:16}, perDish:4};
// Basking lamp: reptiles, amphibians and bugs want heat (not the feathered ones, WARM_BLOODED). One lamp warms `per` animals, and they gather within `radius` meters of it.
// With heat: happy more, discomfort down, illness x`ill`; without it: happy less, and a cold snap makes them ill x`cold`.
const VIV_LAMP = {per:4, radius:4.4, happy:6, lack:5, ill:.6, cold:1.5, comfort:.25};
const WARM_BLOODED = ["anch", "yiqi", "arch", "micr", "scan", "mono", "comp", "long"];
// Pool: a pool counts as water for water lovers (their water want in haveOf, and thirst), up to `bonus` happiness for a full fit; none and they're dry
const VIV_POOL = {bonus:5};
// Aquarium water: the animals foul it by their food a day (their load) and filters clean it (LAND `clean`, only while powered). Quality (0 to 100) heads for
// 100 x cleaning / load at `rate` points a day. Under `murky` the animals are unhappy (up to `lack`), under `foul` they fall ill (x`ill` at 0); clean water is worth `happy`.
const AQUA = {rate:40, murky:60, foul:30, happy:6, lack:14, ill:3};
// A vivarium can be laid out as a paludarium from its Landscaping tab: the front `water` share of its floor flooded `depth` of the glass deep, a bank behind, for
// `price` (draining it refunds COST.refundShare). Its water fouls like an aquarium's (AQUA, and it takes the aquarium filters), but only the animals that swim in it
// count, at `load` of their food. Water lovers swim and get `happy` there, and need no pool. Species with `palu` live only in one.
const PALU = {price:2500, water:.5, depth:.4, load:.5, happy:6};
// Food trays (LAND items with `tray`, food units they hold). Each holds one kind of food at a time (any kind). Keepers walk inside the fence to fill them,
// and the animals eat from them first, so an exhibit with trays holds more food and needs fewer trips.
const TRAY = {
  color:"#6E737A",   // rim
};
// Groves give shade too: this many shelter slots each, scaled by how much the weather lets trees help (WEATHER grove)
for(const t of Object.values(LAND)) if(t.flora && !t.shade) t.shade = 8;
// Vivariums take plants too, shrunk to fit the glass: radius scale, and happiness for a full planting of what the animals want
const VIV_PLANT = {scale:.5, bonus:6, shift:.26, apart:3};   // bonus: happiness for a scene that fully suits the animals (VIV_SCENE); shift: how far toward the front (m, 2 px) a case's first fitting sits; apart: the gap (m) fittings are spread to before they just pack in
// A vivarium's scene: a painted back wall and floor for an era and a biome (pictures from tools/pixelvivscene.py, sprites/vivscene/<key>-<size>-<wall|floor>.png).
//   price    what setting or changing the scene costs, whatever it is; clearing it refunds COST.refundShare of it
// A period can have its own scene for a biome: list "<period>-<biome>" in VIV_SCENE_PERIODS and draw its pictures, and a scene saved with that period uses them in place of its era's.
const VIV_SCENE = {price:500, eras:["paleozoic", "mesozoic", "cenozoic"]};
const VIV_SCENE_PERIODS = {};
// An aquarium's backdrop: a stretch of sea floor from one part of the past (pictures from tools/pixelaquascene.py, sprites/vivscene/sea-<key>-<size>-<wall|floor>.png),
// set like a vivarium's scene for VIV_SCENE.price. A sea animal is at home with the backdrop of its own period, worth the full VIV_PLANT.bonus.
const AQUA_SCENES = {
  cambrian:  {label:"Cambrian sea",  periods:["Cambrian"]},
  paleozoic: {label:"Paleozoic sea", periods:["Ordovician", "Silurian", "Devonian", "Carboniferous", "Permian"]},
  mesozoic:  {label:"Mesozoic sea",  periods:["Triassic", "Jurassic", "Cretaceous"]},
  cenozoic:  {label:"Cenozoic sea",  periods:["Paleogene", "Neogene", "Quaternary"]},
};
const seaSceneOf = s => Object.keys(AQUA_SCENES).find(k => AQUA_SCENES[k].periods.includes(s.period)) || null;
const HAB = {
  waterFull:.03,   // share of the exhibit's floor under water that fully satisfies water lovers
  rockEvery:500,   // square meters of exhibit that one point of rock cover looks after
  bonus:8,         // happiness an exhibit with everything its animals like gains
  wantsWater:.8,   // a species this keen on water is unhappy and sickly without any
  dry:8,           // happiness lost when water lovers have no water
  dryIll:1.5,      // illness chance multiplier for them
  groveFull:.06,   // share of the floor in groves from an animal's own era that fully satisfies it
  wrongPlants:8,   // happiness lost when plants from another biome fill as much floor as a full grove would
  groveBonus:6,    // happiness for animals with plenty of groves from their era
  waterDry:.05,    // share of the floor under water that animals from scrubland or desert want
  waterBase:.08,   // ...that everyone else wants
  waterSemi:.25,   // ...that semi-aquatic species want
  waterBand:.2,    // no penalty within this share either side of what an animal wants
  rockBase:1,      // rocks a 500 m² exhibit of grassland wants for an animal with middling taste (likes .4); scaled by biome and by how much it likes rocks
  offEra:1/3,      // other periods' plants of the right biome can fill this share of the plant cover an animal wants
  plantWeight:.4,  // how much plants weigh against water and rocks when an animal is satisfied
  meatPlants:.5,   // meat eaters want this share of the plants that plant eaters do
  browseMax:.75,   // groves can supply at most this share of an exhibit's daily food; keepers bring the rest
};
// Weather. Each night rolls the day after tomorrow, so the top bar always has tomorrow's forecast.
// Animals with no cover in bad weather are unhappy, fall ill more, and in storms get hurt.
//   odds    chance of this weather on any day
//   happy   happiness an exhibit loses if none of its animals have cover
//   ill     extra illness for animals without cover (1 means twice as likely)
//   hurt    chance a day an animal without cover is hurt
//   wear    fence wear multiplier
//   guests  share of the usual guests who come
//   grove   how much groves count as cover (shade on hot days, a little on stormy ones, none in the cold)
const WEATHER = {
  umbrella:2.5,     // umbrellas sell this many times as well on a wet day
  startDay:4,       // new parks get fair weather until this day
  kinds:{
    fair: {label:"Fair",      odds:.55, happy:0,  ill:0,   hurt:0,   wear:1,   guests:1,   grove:0},
    hot:  {label:"Heat wave", odds:.17, happy:10, ill:.8,  hurt:0,   wear:1,   guests:.85, grove:1},
    cold: {label:"Cold snap", odds:.15, happy:12, ill:1.5, hurt:0,   wear:1,   guests:.8,  grove:0},
    storm:{label:"Storm",     wet:true, odds:.13, happy:15, ill:.6,  hurt:.03, wear:2.5, guests:.55, grove:.5},
  },
};
// Ice age animals shrug off the cold
const COLD_HARDY = ["mamm", "colm", "elas", "arct", "dire", "smil", "mast", "mglo"];
// Shelter slots one animal takes: bigger animals need more room
const coverSlots = s => Math.max(1, Math.round(Math.sqrt(s.space) / 4));

// How much each species likes water and rocks (0 to 1). Fish eaters want water. Anything not listed likes both a little.
const LIKES_ROCK = {water:.2, rock:.9};
const HABITAT_LIKES = {diic:LIKES_ROCK, lyst:LIKES_ROCK, seym:LIKES_ROCK, dime:LIKES_ROCK, plhy:LIKES_ROCK, mlan:LIKES_ROCK, mono:LIKES_ROCK, beel:{water:.6, rock:.6}};
const likesOf = s => HABITAT_LIKES[s.id] || (s.pool ? {water:1, rock:0} : s.semi ? {water:.9, rock:.1} : {water:.4, rock:.4});

// Animal behavior (behavior.js). Each animal has six needs, from 0 (met) to 100 (desperate):
//   hunger, thirst, discomfort (habitat, weather, dirt), lonely, bored, stress
// and every few minutes does whatever its most urgent need calls for (ACTS). Pacing and hiding are the tells that something's wrong.
// Rates are per park minute.
const BEHAVIOR = {
  step:5,              // park minutes between decisions
  minAct:15,           // an animal sticks with what it's doing at least this long, unless the need is met
  stick:8,             // and favors carrying on by this much
  hunger:.22, thirst:.28, bored:.22, lonely:.25,   // how fast each need grows while awake
  eat:3, browse:1.2, drink:5, social:2, play:2.5, patrol:.15, forage:.6, graze:.15, pace:.15,   // how fast each act meets its need (forage among groves, graze on bare ground)
  troughFloor:45,      // water lovers can't drink their thirst below this from the gate trough alone
  hotThirst:1.6,       // heat waves make them thirstier
  stressDrift:90,      // minutes for stress to close most of the gap to what the exhibit puts on it
  comfortDrift:60,
  hideCalm:.5,         // stress shed a minute hiding in cover (a third of it with no cover)
  huntMin:20,          // meat eaters stalk this long before they eat
  teaseMemory:240,     // park minutes the Behavior tab still blames guests banging on the glass (the spike drains slowly)
  shyGuests:35,       // stress skittish animals take from a busy path, halved with cover to retreat to
  busyAt:150,          // guests in the park for "busy"
  happy:{calm:4, stress:.12, bored:.06, pace:8},   // happiness: up to +calm, less stress and boredom, less the share pacing
  stressIll:1.35,      // illness chance multiplier for an animal over 60 stress
  escape:1.5,          // a stressed aggressive animal tries the fence up to this much more
  nap:{from:10, to:16, share:.7, chance:.1, hot:1.5, min:60, max:120},   // a midday nap (a park minute is 2 clock minutes, so this is 2 to 4 hours): the clock hours it can start (peaking halfway), the share of animals that nap on a given day, each step's chance of starting once they do (at the peak), hot days' boost, and how long they stay down (minutes)
  lively:[.85, 1.1],   // guest appeal from a sleeping, hiding herd to a busy, playful one
};
// Going inside (behavior.js, "going inside"). Animals walk into a shelter with room (LAND slots; a shelter holds animals up to its slots, each taking coverSlots) to hide, sleep or wait out bad weather, and aren't drawn or seen while in.
const SHELTER = {
  sleepBelow:.5,       // an animal this drowsy (awake() at or under it) that is resting goes in to sleep; so does a napper
  needLine:70,         // hunger or thirst over this and a weather-sheltering animal comes out to eat or drink
  giveUp:90,           // park minutes of walking before an animal that can't find its way to its shelter just goes in
  weather:{storm:1, cold:.85, hot:.7},   // share of animals that seek shelter on a day of that weather (picked per animal per day)
  hideCalm:4,          // hiding behind walls sheds stress this many times as fast as hiding in the open
  restCalm:.8,         // stress shed a minute resting or sleeping inside (in the open it's .1)
  stressLine:55,       // a stressed animal (any temper) heads straight for a shelter over this much stress, and stays in until it is down to calmLine
  calmLine:25,
  hurry:2.2,           // how fast it walks there, as a multiple of its usual pace
  text:{hide:"Hiding inside", sleep:"Sleeping inside", weather:{storm:"Sheltering from the storm", hot:"Sheltering from the heat", cold:"Sheltering from the cold"}},
};
// Guests who come to see animals that are all indoors are let down (seeExhibit in guests.js; hideBother in behavior.js)
const HIDING = {
  window:120,          // park minutes the share of animals in view is averaged over, so a quick scramble doesn't count
  from:.4,             // guests only mind when more than this share of the animals are out of sight (averaged)
  mood:10,             // mood a visit loses when nearly every animal is out of sight, at full bother
  appeal:.5,           // and how much of the visit's pleasure in the exhibit goes
  thought:.2,          // bother at which they say so
  weights:{hide:1, sleep:.5, weather:.25, screen:.2},   // how far out of sight each kind counts: hiding fully, sleeping inside by day half (none at night), sheltering from weather a quarter, an outside animal behind a screen a fifth
  eduCut:.8,           // a guest who has learned a lot (p.edu of eduFull or more) feels this much less of it
  eduFull:40,
};
// Privacy screens (LAND `screen`): each shields this many animals from the path's view. It cuts the guest stress they take (ctx.seen) by `cut` for that share of the herd, and hooligan teasing by `teaseCut`.
const SCREEN = {holds:8, cut:.85, teaseCut:.8, fenceReach:7};   // teaseCut: how much of a hooligan's banging (the chance and the stress) a fully screened herd is spared
// Quiet signs (BUILDINGS.quiet): guests within `hear` of a working one, which stands within `reach` of an exhibit's fence, count `cut` less toward the crowd the exhibit's animals feel (rowdy parties only `rowdy` as much).
const QUIET = {reach:20, hear:14, cut:.6, rowdy:.3};
// Animal-on-animal attacks (behavior.js, "attacks"). Hurt animals get an injury (a.sick, kind "injury") that vets treat; a bad enough one kills.
//   Loose predators strike animals in an exhibit they can get into (a breach, or a fence weaker than they are) from the fence line.
//   A predator housed with prey stalks it (the hunt act) and strikes once it is close. Stressed aggressive (or crowded) animals fight each other.
const ATTACK = {
  reach:8,             // meters from the fence a loose predator can strike at
  looseRate:.05,       // chance a park minute that a loose predator in reach attacks
  gap:25,              // park minutes between one attacker's attacks
  bite:[25, 60],       // severity a predator's attack adds (0 to 100; 100 kills)
  kill:.12,            // chance a predator's attack kills outright
  scare:25,            // stress the victim takes
  stalk:10,            // minutes a predator has been hunting before it can strike
  strike:5,            // meters from its prey (plus its own size) it must close to strike
  huntChance:.5,       // chance each behavior step it strikes once in range (a third if positions are unknown)
  hungry:55,           // a predator only goes after prey when its hunger is this high, or its stress or boredom is over the lines below
  huntStress:60, huntBored:75,
  drive:40,            // pull of the hunt act with prey in the exhibit, plus half its hunger
  fightStress:60,      // an aggressive animal over this stress picks fights (a crowded one of any kind, 15 higher)
  fightRate:.006,      // chance each behavior step at the top of that range
  crowded:2,           // fights are this many times likelier in a cramped exhibit
  fightHurt:[8, 22],   // severity a fight adds
};
// Sex (a.sex, "male" or "female"). No breeding in v1.0; these are light effects. Tunable.
const SEX = {
  balance:.8,          // chance a new animal takes the sex its species has fewer of in the park (else a coin flip)
  maleFight:1.3,       // males of aggressive species pick fights this much likelier (see fightBias in behavior.js)
};
// Social life in open exhibits (behavior.js, "social"; vivariums ignore all of it). Driven by traitsOf(s).social.
//   a.rank is a saved status number, 0 for the alpha up to 1 for the bottom of the pecking order (sorted ascending = alpha first).
//   Herds: all-male (bachelor) and all-female (matriarchal) groups are stable and happy; one male with females is stable;
//   two or more males with females fight, more with more males and less room. Solitary species dislike company (same sex most).
//   Pairs: one male and one female is ideal. Stress numbers are 0 to 100 added to the animal's stress target.
const SOCIAL = {
  rank:{rand:.6, q:.25, male:.15},   // what sets status: luck, DNA quality (a.q), and being male
  bachelor:3, matriarch:3,           // happiness bonus for a stable all-male / all-female herd or pack
  soloSame:30, soloOpp:8, soloCap:60,// a loner's stress per same-sex / opposite-sex animal sharing the pen, and the most
  soloHappy:.25,                     // happiness lost per point of that stress (averaged over the loners)
  relief:{room:.4, rock:.2, cover:.25}, max:.75, roomFull:3,   // what eases it: space per animal (full at this many times the room it needs), hiding rocks, shelter cover; never more than max
  pairBonus:2, pairMild:3, pairStress:12,   // pairs: happiness for a male and a female, lost when animals are left over, and their stress
  rivalStress:14, rivalCap:3,        // males in a mixed group: stress per extra rival (up to this many)...
  rivalHappy:3,                      // ...and happiness lost per rival
  spaceRef:1.5,                      // room per animal (1 is just enough) at which rivalry is as it is; cramped is worse, roomy better
  fightRate:.01, upset:.2,           // chance each behavior step per extra male that rivals fight; chance the lower rank wins
  hurt:[6, 16], lowHurt:.8,          // injury a fight adds, up to this much more to the lowest rank
  loseStress:20,                     // extra stress on the loser, more the lower its rank
};
// Packs (traitsOf(s).social === "pack": group predators) are family units, not herds, and skip the herd rules above (open exhibits only; vivariums ignore all of it).
//   The two best-ranked animals are the alpha pair (ideally one male and one female: the alpha plus the best-ranked of the other sex); the rest are subordinates.
//   A pack under its species' group[0] is stressed and lonely, one alone worst. The alpha pair eats first (keepers.js eatTick), so shortages hit subordinates first.
//   Pack mates hunt together (more strike chance with more hunters). Rank challenges are rare and only happen under stress (hungry subordinates, a crowded pen, no alpha pair).
const PACK = {
  settled:2, smallHappy:6, aloneMult:2, noPairHappy:3,   // happiness: a full pack with an alpha pair; lost per missing animal share (alone doubled); lost with no alpha pair
  smallStress:30, aloneStress:55, noPairStress:12,       // stress: pack under its minimum (scaled by how short it is), a pack animal alone, subordinates with no alpha pair
  lonelyExtra:1.5,                                       // extra loneliness a minute (times the base rate) in a too-small pack, doubled when alone
  pile:.5,                                               // food on hand under this share of a day's need counts as a shortage; the alphas eat first
  lackHunger:1.2, lackBlock:.6,                          // a hungry rank gains hunger this many times faster, and eating helps this much less (both times its share of the shortage)
  huntJoin:25, huntBonus:.5, huntMax:.95,                // pull to join a hunt per hunting mate; strike chance gain per extra hunter; the most
  challengeRate:.004, hungerLine:60, stressLine:55,      // chance each behavior step per driver (hungry subordinates, crowding, no alpha pair); subordinates count as hungry or stressed over these
  upset:.3, hurt:[4, 12], loseStress:15,                 // chance the challenger wins (then they swap ranks); injury a clash adds; stress on the loser
};
// What animals can be doing. idle marks what they fall back on with nothing pressing.
const ACTS = {
  eat:   {label:"Eating"},
  drink: {label:"Drinking"},
  rest:  {label:"Resting"},
  patrol:{label:"Patrolling"},
  hunt:  {label:"Hunting"},
  forage:{label:"Foraging"},
  social:{label:"Socializing"},
  play:  {label:"Playing"},
  hide:  {label:"Hiding", tell:true},
  pace:  {label:"Pacing", tell:true},
};
// Enrichment: toy points a species wants, scaled by its herd and size (see enrichNeed), and how much each part counts
const ENRICH = {per:1, toys:.35, habitat:.35, room:.3, vivScale:3, melt:2, vivBase:.2};   // melt: days a frozen treat loses in a heat wave   // vivScale: small vivarium animals are measured on this scale, so they still want a few toys
// What each species is, for illnesses that only some bodies get. Every species has one.
//   invert, fish, amphibian, reptile (land), marine (marine reptile), pterosaur, ornithischian, sauropod (and early sauropodomorphs),
//   theropod, bird (Archaeopteryx onward), synapsid (not yet mammals), mammal, hooved (hooved mammals), seamammal (whales, dolphins, seals, sea cows)
const CLADE = {
  invert:["anom", "opab", "olen", "came", "ptry", "arth", "pulm", "mega", "gigt", "prom", "tmyr", "rmlo"],
  fish:["saca", "both", "dunk", "stet", "rhiz", "heli", "tikt", "mgdn"],
  amphibian:["icht", "mibr", "dcau", "eryo", "seym", "plhy", "prio", "beel", "kool", "gtod"],
  reptile:["hylo", "scut", "sile", "shar", "long", "desm", "post", "eryt", "simo", "dsuc", "bari", "tita", "mchl", "mlan"],
  marine:["noth", "shon", "ichy", "elsm", "mosa"],
  pterosaur:["dimo", "pter", "quet"],
  ornithischian:["hete", "dryo", "scel", "kent", "steg", "hyps", "mcer", "psit", "prot", "minm", "para", "pach", "igua", "styr", "anky", "tric"],
  sauropod:["plat", "cama", "apat", "dipl", "brac", "nige", "pata"],
  theropod:["coel", "herr", "comp", "orni", "anch", "yiqi", "scan", "dilo", "cryo", "cera", "mgal", "allo", "torv", "mono", "micr", "ornm", "ovir",
            "gall", "velo", "conc", "utah", "bary", "ther", "yutt", "cnot", "dche", "spin", "carc", "trex"],
  bird:["arch", "waim", "kele", "drom", "psil", "arge", "ornw", "dodo", "ppig"],
  synapsid:["diic", "lyst", "mosc", "dime", "este", "coty", "ante", "inos", "liso"],
  mammal:["ples", "lept", "ptil", "miac", "hyae", "paki", "ambu", "dino", "dgal", "nura", "proc", "amph", "chal", "plty", "sdel", "dire", "arct",
          "doed", "mgth", "smil", "mast", "mamm", "colm", "thyl", "aind", "gpit"],
  hooved:["sifr", "uint", "andr", "arsi", "pcer", "daeo", "aepy", "siva", "hopl", "macr", "mglo", "elas"],
  seamammal:["basi", "enal", "kntr", "stel"],
};
const CLADE_OF = Object.fromEntries(Object.entries(CLADE).flatMap(([c, ids]) => ids.map(id => [id, c])));
// Bodies some injuries and illnesses need. Fish, invertebrates and swimmers already have no legs to sprain; these are the rest.
const GORES = ["tric", "styr", "cnot", "este", "arsi", "elas", "mglo", "siva", "hopl", "uint", "sdel", "mast", "mamm", "colm", "plty", "steg", "kent"];   // horns, tusks, antlers or spikes: what it hurts is gored
const LIMBLESS = ["tita"];
const TOOTHLESS = ["ornm", "gall", "dche", "ovir", "waim", "kele", "drom", "psil", "arge", "ornw", "dodo", "ppig", "mchl", "pter", "quet", "liso", "stel"];
const SHELLED = ["olen", "ptry", "came", "prom"];   // shelled aquatic invertebrates
// Species traits. Anything not listed is worked out from its data (traitsOf in behavior.js):
//   active   diurnal (up all day), nocturnal (sleeps through most of opening hours), crepuscular (busy at dawn and dusk)
//   social   solitary (wants no company), pair, herd, pack (pack and herd animals left alone pace or hide)
//   temper   skittish (stressed by guests, hides), curious (bores fast, plays, likes watching people), aggressive (stressed by crowding, paces, tests the fence)
const TRAITS = {
  active:{
    nocturnal:["lept", "ptil", "dgal", "ornw", "thyl", "pulm", "beel", "gtod", "tita", "mono", "arth"],
    crepuscular:["velo", "utah", "dire", "smil", "amph", "hyae", "coel", "dilo", "dsuc", "prio", "bari", "kool", "dcau", "icht", "tikt", "eryo", "arct", "conc", "andr", "daeo", "micr", "anch", "comp", "orni"],
  },
  social:{pair:["arge", "ornw", "kele", "aind"], herd:["tric", "mast"], pack:["daeo"]},
  temper:{
    curious:["proc", "gpit", "aind", "ples", "ornm", "gall", "ovir", "dodo", "sdel", "arch", "micr", "comp"],
    skittish:["para", "macr", "mglo", "aepy", "hyps", "dryo", "hete", "igua", "sifr", "hopl"],
    aggressive:["pach", "dino", "daeo", "arsi", "doed", "arct"],
  },
};
const TRAIT_TEXT = {diurnal:"Diurnal", nocturnal:"Nocturnal", crepuscular:"Crepuscular", solitary:"solitary", pair:"lives in pairs", herd:"herd animal", pack:"pack animal", skittish:"skittish", curious:"curious", aggressive:"aggressive"};

// Biomes: the ground an open exhibit is laid out as. Each animal has two biomes it is equally at home in.
//   color    floor color on the map (the pattern id is "b-" + the key)
//   perSqM   cost to paint a square meter of ground this biome
//   wet      counts as this share of the water that fully satisfies water lovers
//   rock     how many rocks animals want here, next to grassland's 1 (see HAB.rockEvery)
//   plants   share of the floor animals want planted here (see HAB.plantMax)
//   park     the open ground between the exhibits when the park is set in this biome (the pattern id is "p-" + the key)
const BIOMES = {
  desert:   {label:"Desert",    ground:"sand and bare rock",          color:"#D7C48C", park:"#D7C48C", perSqM:.5, rock:1.6, plants:0.01},
  tropical: {label:"Tropical",  ground:"humid forest floor",          color:"#155310", park:"#155310", perSqM:1, rock:0.6, plants:0.12},
  grassland:{label:"Grassland", ground:"open plains",                 color:"#C3CC76", park:"#C3CC76", perSqM:.3, rock:0.6, plants:0.03},
  fern:     {label:"Fern Prairie", ground:"open fern, horsetail and cycad ground", color:"#976937", park:"#976937", perSqM:.3, rock:0.7, plants:0.04},   // placeholder look: scrubland's
  scrubland:{label:"Scrubland", ground:"dry brush and hardpan",       color:"#976937", park:"#976937", perSqM:.4, rock:1.3, plants:0.03},
  wetland:  {label:"Wetland",   ground:"marsh, mud and shallow water", color:"#6F9A7A", park:"#6F9A7A", perSqM:1.2, wet:.5, rock:0.4, plants:0.06},
  temperate:{label:"Seasonal Forest", ground:"broadleaf woodland and meadow", color:"#40813F", park:"#40813F", perSqM:.6, rock:0.8, plants:0.08},
  boreal:   {label:"Coniferous Forest", ground:"conifer forest, needle litter and moss", color:"#587260", park:"#587260", perSqM:.8, rock:1, plants:0.08},
  tundra:   {label:"Tundra",    ground:"frozen moss and lichen",      color:"#C3CDD4", park:"#C3CDD4", perSqM:.6, rock:1.4, plants:0.02},
};
const DEFAULT_PARK_BIOME = "grassland";   // older parks keep the plain grass they had
// (The Permian fern plants are placeholders named for their period until the real list.)
// Landscape plants, one small, medium and large of each for every biome that existed in a period (names "small|medium|large").
// A biome missing from a period has no plants there (no grassland before the Neogene). They go in LAND below as keys like "jur-tropical-small".
const PLANT_TABLE = {
  Devonian:{tropical:"Cooksonia|Asteroxylon|Wattieza", wetland:"Rhynia|Aglaophyton|Pseudosporochnus", desert:"Zosterophyllum|Psilophyton|Prototaxites",
    scrubland:"Sciadophyton|Sawdonia|Drepanophycus", temperate:"Gosslingia|Barinophyton|Archaeopteris"},
  Carboniferous:{tropical:"Sphenophyllum|Calamites|Lepidodendron", wetland:"Asterophyllites|Medullosa|Sigillaria",
    temperate:"Neuropteris|Alethopteris|Cordaites", desert:"Sphenopteris|Callipteris|Walchia"},
  Permian:{fern:"Permian Fern|Permian Horsetail|Permian Tree Fern", desert:"Supaia|Ullmannia|Pseudovoltzia", tropical:"Taeniopteris|Gigantopteris|Psaronius", wetland:"Annularia|Pecopteris|Arthropitys",
    scrubland:"Peltaspermum|Comia|Callistophyton", temperate:"Sphenobaiera|Rufloria|Ginkgophyllum", boreal:"Gangamopteris|Noeggerathiopsis|Glossopteris"},
  Triassic:{fern:"Clathropteris|Schizoneura|Asterotheca", desert:"Dicroidium|Pleuromeia|Voltzia", tropical:"Neocalamites|Zamites|Araucarioxylon", scrubland:"Lepidopteris|Scytophyllum|Pagiophyllum",
    wetland:"Equisetites|Cladophlebis|Heidiphyllum", temperate:"Baiera|Podozamites|Elatocladus"},
  Jurassic:{fern:"Hausmannia|Equisetum|Osmundacaulis", tropical:"Nilssonia|Williamsonia|Cycadeoidea", wetland:"Coniopteris|Todites|Matonidium", scrubland:"Otozamites|Ptilophyllum|Brachyphyllum",
    temperate:"Ginkgoites|Czekanowskia|Araucarites", desert:"Pachypteris|Hirmeriella|Cupressinocladus", boreal:"Phoenicopsis|Pityophyllum|Elatides"},
  Cretaceous:{fern:"Gleichenites|Equisetum burejense|Dicksonia", tropical:"Nilssoniopteris|Sabalites|Sapindopsis", wetland:"Archaefructus|Nelumbites|Glyptostrobus", scrubland:"Ruffordia|Pseudofrenelopsis|Eucalyptophyllum",
    temperate:"Ficophyllum|Credneria|Sequoia", desert:"Ephedra|Welwitschiophyllum|Tempskya", boreal:"Birisia|Heilungia|Parataxodium"},
  Paleogene:{fern:"Onoclea|Equisetum parlatorii|Cyathea", tropical:"Climbing Fern|Nipa Palm|Dipterocarp Tree", wetland:"Mosquito Fern|Floating Fern|Bald Cypress", temperate:"Zelkova|Quercus|Metasequoia",
    boreal:"Royal Fern|Birch|Larch", scrubland:"Hopbush|Acacia|Eucalyptus", desert:"Tamarisk|Saxaul|Honey Mesquite"},
  Neogene:{grassland:"Bluegrass|Kangaroo Grass|Pampas Grass", tropical:"Heliconia|Banana|Kapok", wetland:"Cattail|Common Reed|Tupelo", scrubland:"Sagebrush|Saltbush|Juniper",
    temperate:"Anemone|Acer|Fagus", boreal:"Blueberry|Alder|Spruce", desert:"Cholla|Century Plant|Saguaro", tundra:"Cottongrass|Crowberry|Arctic Willow"},
  Quaternary:{grassland:"Fescue|Grama|Bluestem", tropical:"Philodendron|Palm|Big-leaf Mahogany", wetland:"Peat Moss|Sedge|Willow", scrubland:"Sage|Chamise|Manzanita",
    temperate:"Trillium|Corylus|Tilia", boreal:"Reindeer Lichen|Marsh Rosemary|Pine", desert:"Creosote Bush|Barrel Cactus|Joshua Tree", tundra:"Saxifrage|Mountain Avens|Dwarf Birch"},
};
// Leaf colors by biome, small to large
const PLANT_SHADE = {desert:["#B8A559", "#9A9048", "#7C7A3E"], tropical:["#4DBA6B", "#2F9A55", "#1F7A45"], grassland:["#B8D26A", "#9CBE55", "#7FA847"],
  scrubland:["#A8AE62", "#8E9654", "#747E48"], wetland:["#5FB8A2", "#3E9C88", "#2B7F6F"], temperate:["#8CC46E", "#6BAA55", "#4E8F42"], boreal:["#6E9C86", "#4F8068", "#386650"],
  tundra:["#A9B48A", "#8C9A70", "#6F7F5A"], fern:["#8FB86A", "#6FA05A", "#4F8648"]};
// Landscape plants drawn with a picture instead of code: sprites/plants/<LAND key>.png, 3/4 view with the base at the bottom middle.
// ratio is width over height; size scales the width (2 x the plant's radius) so a tall plant isn't drawn too wide. Plants not listed keep their SVG.
const PLANT_SPRITES = {
  "per-scrubland-small":  {ratio:44/46, size:1.15},
  "per-scrubland-medium": {ratio:64/46, size:1.1},
  "per-scrubland-large":  {ratio:72/96, size:.85},
  "tri-scrubland-small":  {ratio:54/40, size:1.42},
  "tri-scrubland-medium": {ratio:76/52, size:1.3},
  "tri-scrubland-large":  {ratio:64/92, size:.75},
  "dev-scrubland-small":{ratio:17/11, size:0.49},
  "dev-scrubland-medium": {ratio:64/46, size:1.05},
  "dev-scrubland-large":  {ratio:64/92, size:0.74},
  "jur-scrubland-small":  {ratio:48/38, size:1.38},
  "jur-scrubland-medium": {ratio:72/54, size:1.18},
  "jur-scrubland-large":  {ratio:64/92, size:0.74},
  "cre-scrubland-small":  {ratio:54/34, size:1.56},
  "cre-scrubland-medium": {ratio:66/52, size:1.08},
  "cre-scrubland-large":  {ratio:72/92, size:0.83},
  "pal-scrubland-small":  {ratio:46/40, size:1.32},
  "pal-scrubland-medium": {ratio:72/56, size:1.18},
  "pal-scrubland-large":  {ratio:72/92, size:0.83},
  "neo-scrubland-small":  {ratio:48/34, size:1.38},
  "neo-scrubland-medium": {ratio:66/48, size:1.08},
  "neo-scrubland-large":  {ratio:64/92, size:0.74},
  "qua-scrubland-small":  {ratio:48/44, size:1.38},
  "qua-scrubland-medium": {ratio:68/54, size:1.12},
  "qua-scrubland-large":  {ratio:70/92, size:0.8},
  "per-wetland-small":    {ratio:40/46, size:1.0},
  "per-wetland-medium":   {ratio:64/50, size:1.1},
  "per-wetland-large":    {ratio:64/92, size:.8},
  "tri-wetland-small":    {ratio:44/44, size:1.2},
  "tri-wetland-medium":   {ratio:72/50, size:1.3},
  "tri-wetland-large":    {ratio:64/92, size:.78},
  "dev-wetland-small":  {ratio:22/16, size:0.63},
  "dev-wetland-medium":     {ratio:64/40, size:1.05},
  "dev-wetland-large":      {ratio:64/92, size:0.74},
  "car-wetland-small":      {ratio:40/46, size:1.15},
  "car-wetland-medium":     {ratio:64/50, size:1.05},
  "car-wetland-large":      {ratio:64/92, size:0.74},
  "jur-wetland-small":      {ratio:54/40, size:1.56},
  "jur-wetland-medium":     {ratio:70/50, size:1.15},
  "jur-wetland-large":      {ratio:70/92, size:0.8},
  "cre-wetland-small":      {ratio:44/44, size:1.27},
  "cre-wetland-medium":     {ratio:64/50, size:1.05},
  "cre-wetland-large":      {ratio:64/92, size:0.74},
  "pal-wetland-small":      {ratio:44/20, size:1.27},
  "pal-wetland-medium":     {ratio:60/28, size:0.98},
  "pal-wetland-large":      {ratio:64/92, size:0.74},
  "neo-wetland-small":      {ratio:44/46, size:1.27},
  "neo-wetland-medium":     {ratio:64/56, size:1.05},
  "neo-wetland-large":      {ratio:64/92, size:0.74},
  "qua-wetland-small":      {ratio:44/28, size:1.27},
  "qua-wetland-medium":     {ratio:64/50, size:1.05},
  "qua-wetland-large":      {ratio:72/92, size:0.83},
  "dev-desert-small":   {ratio:26/22, size:0.75},
  "dev-desert-medium":     {ratio:62/54, size:1.02},
  "dev-desert-large":      {ratio:64/92, size:0.74},
  "car-desert-small":      {ratio:44/38, size:1.27},
  "car-desert-medium":     {ratio:64/58, size:1.05},
  "car-desert-large":      {ratio:64/92, size:0.74},
  "per-desert-small":      {ratio:44/36, size:1.27},
  "per-desert-medium":     {ratio:66/54, size:1.08},
  "per-desert-large":      {ratio:72/92, size:0.83},
  "tri-desert-small":      {ratio:44/38, size:1.27},
  "tri-desert-medium":     {ratio:62/56, size:1.02},
  "tri-desert-large":      {ratio:64/92, size:0.74},
  "jur-desert-small":      {ratio:44/36, size:1.27},
  "jur-desert-medium":     {ratio:66/54, size:1.08},
  "jur-desert-large":      {ratio:64/92, size:0.74},
  "cre-desert-small":      {ratio:44/38, size:1.27},
  "cre-desert-medium":     {ratio:64/46, size:1.05},
  "cre-desert-large":      {ratio:64/92, size:0.74},
  "pal-desert-small":      {ratio:44/40, size:1.27},
  "pal-desert-medium":     {ratio:64/56, size:1.05},
  "pal-desert-large":      {ratio:72/90, size:0.83},
  "neo-desert-small":      {ratio:44/40, size:1.27},
  "neo-desert-medium":     {ratio:64/50, size:1.05},
  "neo-desert-large":      {ratio:64/92, size:0.74},
  "qua-desert-small":      {ratio:44/40, size:1.27},
  "qua-desert-medium":     {ratio:56/52, size:0.92},
  "qua-desert-large":      {ratio:72/92, size:0.83},
  "dev-temperate-small":{ratio:14/23, size:0.4},
  "dev-temperate-medium":   {ratio:64/56, size:1.05},
  "dev-temperate-large":    {ratio:64/92, size:0.74},
  "car-temperate-small":    {ratio:44/38, size:1.27},
  "car-temperate-medium":   {ratio:64/58, size:1.05},
  "car-temperate-large":    {ratio:64/92, size:0.74},
  "per-temperate-small":    {ratio:44/36, size:1.27},
  "per-temperate-medium":   {ratio:66/54, size:1.08},
  "per-temperate-large":    {ratio:72/92, size:0.83},
  "dev-tropical-small":   {ratio:20/14, size:0.65},
  "dev-tropical-medium":  {ratio:64/54, size:1.05},
  "dev-tropical-large":   {ratio:64/92, size:0.74},
  "car-tropical-small":   {ratio:44/38, size:1.27},
  "car-tropical-medium":  {ratio:64/54, size:1.05},
  "car-tropical-large":   {ratio:72/92, size:0.83},
  "per-tropical-small":   {ratio:44/38, size:1.27},
  "per-tropical-medium":  {ratio:64/54, size:1.05},
  "per-tropical-large":   {ratio:72/92, size:0.83},
  "tri-tropical-small":   {ratio:44/38, size:1.27},
  "tri-tropical-medium":  {ratio:64/54, size:1.05},
  "tri-tropical-large":   {ratio:72/92, size:0.83},
  "jur-tropical-small":   {ratio:44/38, size:1.27},
  "jur-tropical-medium":  {ratio:64/54, size:1.05},
  "jur-tropical-large":   {ratio:72/92, size:0.83},
  "cre-tropical-small":   {ratio:44/38, size:1.27},
  "cre-tropical-medium":  {ratio:64/54, size:1.05},
  "cre-tropical-large":   {ratio:72/92, size:0.83},
  "pal-tropical-small":   {ratio:44/38, size:1.27},
  "pal-tropical-medium":  {ratio:64/54, size:1.05},
  "pal-tropical-large":   {ratio:72/92, size:0.83},
  "neo-tropical-small":   {ratio:44/38, size:1.27},
  "neo-tropical-medium":  {ratio:64/54, size:1.05},
  "neo-tropical-large":   {ratio:72/92, size:0.83},
  "qua-tropical-small":   {ratio:44/38, size:1.27},
  "qua-tropical-medium":  {ratio:64/54, size:1.05},
  "qua-tropical-large":   {ratio:72/92, size:0.83},
  "tri-temperate-small":    {ratio:44/38, size:1.27},
  "tri-temperate-medium":   {ratio:64/56, size:1.05},
  "tri-temperate-large":    {ratio:72/92, size:0.83},
  "jur-temperate-small":    {ratio:44/38, size:1.27},
  "jur-temperate-medium":   {ratio:64/54, size:1.05},
  "jur-temperate-large":    {ratio:72/92, size:0.83},
  "cre-temperate-small":    {ratio:44/38, size:1.27},
  "cre-temperate-medium":   {ratio:64/56, size:1.05},
  "cre-temperate-large":    {ratio:72/92, size:0.83},
  "pal-temperate-small":    {ratio:44/38, size:1.27},
  "pal-temperate-medium":   {ratio:64/54, size:1.05},
  "pal-temperate-large":    {ratio:72/92, size:0.83},
  "neo-temperate-small":    {ratio:44/38, size:1.27},
  "neo-temperate-medium":   {ratio:64/54, size:1.05},
  "neo-temperate-large":    {ratio:72/92, size:0.83},
  "qua-temperate-small":{ratio:24/20, size:0.69},
  "qua-temperate-medium":   {ratio:64/52, size:1.05},
  "qua-temperate-large":    {ratio:72/92, size:0.83},
  "neo-grassland-small":    {ratio:44/38, size:1.27},
  "neo-grassland-medium":   {ratio:64/52, size:1.05},
  "neo-grassland-large":    {ratio:72/92, size:0.83},
  "qua-grassland-small":    {ratio:44/32, size:1.27},
  "qua-grassland-medium":   {ratio:64/48, size:1.05},
  "qua-grassland-large":    {ratio:72/92, size:0.83},
  "q-prairie-wildflowers": {ratio:48/40, size:1.38},
  "neo-tundra-small":       {ratio:44/38, size:1.27},
  "neo-tundra-medium":      {ratio:64/52, size:1.05},
  "neo-tundra-large":       {ratio:72/92, size:0.83},
  "qua-tundra-small":       {ratio:44/32, size:1.27},
  "qua-tundra-medium":      {ratio:64/48, size:1.05},
  "qua-tundra-large":       {ratio:72/92, size:0.83},
  "q-labrador-tea":         {ratio:48/40, size:1.38},
  "per-boreal-small":       {ratio:44/38, size:1.27},
  "per-boreal-medium":      {ratio:64/54, size:1.05},
  "per-boreal-large":       {ratio:72/92, size:0.83},
  "jur-boreal-small":       {ratio:44/38, size:1.27},
  "jur-boreal-medium":      {ratio:64/54, size:1.05},
  "jur-boreal-large":       {ratio:72/92, size:0.83},
  "cre-boreal-small":       {ratio:44/38, size:1.27},
  "cre-boreal-medium":      {ratio:64/54, size:1.05},
  "cre-boreal-large":       {ratio:72/92, size:0.83},
  "pal-boreal-small":       {ratio:44/38, size:1.27},
  "pal-boreal-medium":      {ratio:64/54, size:1.05},
  "pal-boreal-large":       {ratio:72/92, size:0.83},
  "neo-boreal-small":       {ratio:44/38, size:1.27},
  "neo-boreal-medium":      {ratio:64/52, size:1.05},
  "neo-boreal-large":       {ratio:72/92, size:0.83},
  "qua-boreal-small":       {ratio:44/30, size:1.27},
  "qua-boreal-medium":      {ratio:64/46, size:1.05},
  "qua-boreal-large":       {ratio:72/92, size:0.83},
  "q-black-spruce":         {ratio:56/92, size:0.64},
  "q-quaking-aspen":        {ratio:64/92, size:0.74},
  "q-white-oak":           {ratio:72/92, size:0.83},
  "q-sugar-maple":         {ratio:64/92, size:0.74},
  "q-dawn-redwood":        {ratio:64/92, size:0.74},
  "q-japanese-cherry":     {ratio:64/50, size:1.05},
  "q-rose-bush":           {ratio:56/44, size:0.92},
  "q-ginkgo":              {ratio:64/52, size:1.05},
  "q-lilac":               {ratio:56/50, size:0.92},
  "q-mesquite":            {ratio:64/52, size:1.05},
  "q-sagebrush":        {ratio:11/12, size:0.32},
  "q-prickly-pear":     {ratio:22/27, size:0.63},
  "q-agave":            {ratio:30/29, size:0.87},
  "q-strangler-fig":       {ratio:72/92, size:0.83},
  "q-mahogany":            {ratio:72/92, size:0.83},
  "q-bamboo":              {ratio:60/56, size:0.98},
  "q-banana":              {ratio:64/52, size:1.05},
  "q-giant-tree-fern":     {ratio:64/56, size:1.05},
  "q-hibiscus":            {ratio:48/40, size:1.38},
  "q-bald-cypress":         {ratio:64/92, size:0.74},
  "q-weeping-willow":       {ratio:72/92, size:0.83},
  "q-mangrove":             {ratio:64/56, size:1.05},
  "q-cattails":             {ratio:44/46, size:1.27},
  "q-water-lily":           {ratio:48/26, size:1.38},
  "q-cypress-knees":        {ratio:40/34, size:1.15},
};
// Rocks and boulders drawn with pictures: sprites/rocks/<type>-<biome>-<n>.png, one entry per picture as [width, height] in pixels. A rock takes one at random by its id,
// and a biome with no entry keeps the code-drawn rock. ROCK_MPP is meters per pixel.
const ROCK_MPP = .13;
// Park ground made of 1 m tiles: sprites/ground/<biome>-<n>.png, 8 x 8 px each. Tile 1..plain are plain ground, the next `detail` tiles carry a mark (a twig, a stone).
// js/biomepaint.js lays them out on the 1 m grid (a fixed pick per cell, turned and mirrored at random) and uses the result as the #p-<biome> and #b-<biome> patterns,
// with `share` of the cells in each 5 m chunk (rounded at random) taking a detail tile. Tiles listed in `still` are never turned or mirrored (a stone is lit from the top left). A biome not listed keeps its sprites/ground/<biome>.png tile.
const GROUND_TILES = {grassland:{plain:1, detail:2, share:.1, still:[2]}, boreal:{plain:1, detail:2, share:.1, still:[3]}, wetland:{plain:1, detail:2, share:.1, still:[1, 2, 3]}, scrubland:{plain:1, detail:2, share:.1, still:[1, 2, 3]}, fern:{plain:1, detail:2, share:.1, still:[1, 2, 3]}, desert:{plain:1, detail:2, share:.1, still:[1, 2, 3]}, temperate:{plain:1, detail:2, share:.1, still:[1, 2, 3]}, tundra:{plain:1, detail:2, share:.1, still:[1, 2]}, tropical:{plain:1, detail:2, share:.1, still:[1, 2, 3]}};
// Water made of 1 m tiles, laid out like GROUND_TILES (same builder, in biomepaint.js): sprites/water/<biome>-<n>.png, 8 x 8 px each, the pattern behind that biome's water (#w-<biome>).
// `plain` tiles are one solid color, the next `detail` tiles carry a mark; `share` of the cells in each 5 m chunk take a detail tile. `turn: false` means mirrored only, never turned.
// `glint` more tiles after the detail ones are an animation: they play as the first `glint` of `frames` frames on every plain cell (each at its own random start, or with `waves`, a list of [period in frames, wavelength in cells] (each wavelength must divide GROUND_SPAN) that makes bands sweep down and right by the cell's x + y; the loop is the least common multiple of the periods, so waves of different periods drift in and out of step; `fps` frames a second), the other frames are the plain tile. `sub` splits each frame into that many smaller steps (same speed, `sub` times the frames and frame rate).
// A biome not listed keeps its sprites/water/<biome>.png tile.
const WATER_TILES = {
  wetland:{plain:1, detail:1, share:.075, turn:false, glint:3, frames:8, fps:4, sub:2, waves:[[12, 10], [24, 25]]},
  fern:{plain:1, detail:1, share:.075, turn:false, glint:2, frames:8, fps:4, sub:2, waves:[[12, 10], [24, 25]]},
  scrubland:{plain:1, detail:0, share:0, turn:false, glint:3, frames:8, fps:4, sub:2, waves:[[12, 10], [24, 25]]},
  desert:{plain:1, detail:0, share:0, turn:false, glint:3, frames:8, fps:4, sub:2, waves:[[12, 10], [24, 25]]},
  grassland:{plain:1, detail:0, share:0, turn:false, glint:3, frames:8, fps:4, sub:2, waves:[[12, 10], [24, 25]]},
  tropical:{plain:1, detail:0, share:0, turn:false, glint:3, frames:8, fps:4, sub:2, waves:[[12, 10], [24, 25]]},
  boreal:{plain:1, detail:0, share:0, turn:false, glint:3, frames:8, fps:4, sub:2, waves:[[12, 10], [24, 25]]},
  tundra:{plain:1, detail:1, share:.075, turn:false, glint:3, frames:8, fps:4, sub:2, waves:[[12, 10], [24, 25]]},
  temperate:{plain:1, detail:0, share:0, turn:false, glint:3, frames:8, fps:4, sub:2, waves:[[12, 10], [24, 25]]},
  // the sea water types for pools (SEA_WATER), from tools/pixelseawater.py: sand ripples in the shallows, dark troughs in the deep
  sea:{plain:1, detail:1, share:.1, glint:3, frames:8, fps:4, sub:2, waves:[[12, 10], [24, 25]]},
  deep:{plain:1, detail:1, share:.1, glint:3, frames:8, fps:4, sub:2, waves:[[12, 10], [24, 25]]}};
const ROCK_SPRITES = {
  desert:{
    boulder:[[72, 61], [36, 60], [76, 63], [53, 64]],
    rock:[[43, 31], [33, 32], [32, 39], [31, 29], [34, 32], [40, 29]],
  },
  scrubland:{
    boulder:[[68, 66], [37, 59], [74, 62], [57, 63]],
    rock:[[44, 30], [33, 31], [31, 38], [29, 29], [33, 31], [38, 38]],
  },
  fern:{
    boulder:[[68, 66], [37, 59], [74, 62], [57, 63]],
    rock:[[44, 30], [33, 31], [31, 38], [29, 29], [33, 31], [38, 38]],
  },
  wetland:{
    boulder:[[60, 54], [76, 53], [55, 46]],
    rock:[[43, 31], [30, 30], [39, 31], [29, 28], [41, 29]],
  },
  temperate:{
    boulder:[[59, 54], [73, 52], [33, 52], [56, 49]],
    rock:[[42, 30], [35, 29], [36, 31], [30, 27], [41, 29]],
  },
  grassland:{
    boulder:[[60, 57], [69, 49], [37, 46], [50, 44]],
    rock:[[40, 29], [29, 29], [35, 32], [29, 28], [39, 27], [35, 25]],
  },
  boreal:{
    boulder:[[61, 56], [74, 49], [36, 52], [60, 41]],
    rock:[[40, 30], [29, 30], [33, 31], [29, 27], [39, 27], [37, 26]],
  },
  tundra:{
    boulder:[[68, 50], [73, 47], [37, 51], [56, 40]],
    rock:[[37, 29], [28, 29], [35, 24], [25, 27], [36, 28], [34, 26]],
  },
  tropical:{
    boulder:[[68, 46], [32, 57], [73, 49], [62, 37]],
    rock:[[38, 25], [23, 29], [42, 20], [28, 18], [39, 27], [36, 26]],
  },
};
// SPRITE_HIT:start (made by tools/spritehit.py, don't edit)
const SPRITE_HIT = {
  "car-desert-large":[64,92,28.5,28.5,"30-34,30-34,31-33,29-35,24-40,24-40,20-44,20-44,17-47,16-48,16-48,12-52,12-52,10-54,9-55,9-55,6-58,6-58,5-59,4-60,4-60,30-34,26-38"],
  "car-desert-medium":[64,58,7.5,16.5,",31-33,27-37,25-39,24-40,16-48,16-48,17-47,19-45,20-44,22-42,24-40,26-38,31-33,29-35"],
  "car-desert-small":[44,38,6.5,19.5,"22-22,12-32,11-33,11-33,4-40,3-41,9-35,15-29,17-27,19-25"],
  "car-temperate-large":[64,92,6.5,32,"16-56,7-57,7-50,14-61,2-63,0-58,5-59,5-63,0-63,0-53,11-45,19-34,30-34,30-34,30-34,30-34,30-34,29-35,29-35,29-35,29-35,29-35,26-38"],
  "car-temperate-medium":[64,58,6.5,27.5,",31-34,25-39,17-47,14-50,12-52,11-53,7-57,5-59,30-34,30-34,30-34,29-35,29-35,26-38"],
  "car-temperate-small":[44,38,3.5,22,"20-24,12-32,9-35,4-40,0-43,2-42,2-42,7-37,20-24,19-25"],
  "car-tropical-large":[72,92,18.5,36,",,14-58,7-65,5-67,0-71,0-71,0-71,20-52,30-42,33-39,33-39,33-39,33-39,33-39,33-39,33-39,33-39,33-39,33-39,33-39,29-43,18-54"],
  "car-tropical-medium":[64,54,28.5,30,"26-44,20-44,12-44,12-56,12-56,6-62,4-63,7-61,5-63,8-59,6-62,15-53,16-51,12-54"],
  "car-tropical-small":[44,38,7.5,12.5,"12-26,10-28,10-31,16-34,15-34,11-27,10-28,10-28,20-23,15-29"],
  "car-wetland-large":[64,92,6.5,22.5,"24-40,17-47,11-53,10-54,13-51,18-46,26-38,30-34,30-34,30-34,30-34,30-34,30-34,30-34,30-34,30-34,30-34,30-34,30-34,29-35,29-35,29-35,26-38"],
  "car-wetland-medium":[64,50,2.5,29.5,",,,,22-43,15-53,10-55,9-56,4-61,3-59,30-34,30-34,30-34"],
  "car-wetland-small":[40,46,8.5,12.5,"16-24,15-25,13-27,13-27,11-29,12-28,9-31,11-29,8-32,15-25,19-21,19-21"],
  "cre-boreal-large":[72,92,10.5,36,",,,26-46,21-55,14-60,10-67,5-68,5-68,2-71,0-71,0-71,0-71,0-70,2-58,33-39,33-39,33-39,33-39,33-39,33-39,33-39,26-46"],
  "cre-boreal-medium":[64,54,24.5,24.5,",,,,21-43,20-44,12-49,12-52,14-50,11-53,8-56,8-56,29-35,24-40"],
  "cre-boreal-small":[44,38,7,19.5,",18-26,8-36,3-41,3-39,11-32,13-31,15-29,16-28,16-28"],
  "cre-desert-large":[64,92,12.5,28.5,"23-41,21-43,13-51,10-54,7-57,7-57,8-56,5-59,4-60,25-39,25-39,25-39,25-39,24-40,25-39,24-40,24-40,24-40,23-41,22-42,22-42,22-42,20-44"],
  "cre-desert-medium":[64,46,31.5,31.5,",,,,,,31-33,12-52,7-57,4-60,2-62,1-63"],
  "cre-desert-small":[44,38,5.5,13,",21-25,13-31,13-31,10-34,10-35,13-31,15-29,18-26,18-26"],
  "cre-scrubland-large":[72,92,6.5,27.5,",,,,,31-36,29-46,21-49,18-57,13-59,11-61,10-63,10-64,13-64,33-61,33-37,33-37,33-37,33-37,33-38,34-38,34-38,30-42"],
  "cre-scrubland-medium":[66,52,5.5,20.5,",32-34,21-45,21-45,13-53,13-53,14-52,18-48,14-52,18-48,25-41,31-35,31-35"],
  "cre-scrubland-small":[54,34,13,24.5,",,26-28,18-36,10-44,8-47,3-51,13-38,26-28"],
  "cre-temperate-large":[72,92,25.5,27.5,"34-38,34-38,35-37,34-38,30-42,27-45,25-47,21-51,20-52,17-55,16-56,15-57,13-59,14-58,10-62,13-59,9-63,14-58,11-61,15-57,14-58,33-40,27-45"],
  "cre-temperate-medium":[64,56,6.5,30.5,",,11-57,4-61,2-62,2-62,2-61,5-56,26-36,29-34,30-34,30-34,29-35,26-38"],
  "cre-temperate-small":[44,38,19.5,22,"21-23,19-25,0-43,1-43,2-42,3-41,0-43,1-43,18-26,18-26"],
  "cre-tropical-large":[72,92,9.5,33.5,",30-42,27-45,23-50,20-53,19-54,21-52,5-67,3-69,4-68,4-68,3-69,6-66,6-66,31-40,32-39,33-39,33-39,33-39,33-39,33-39,33-39,27-45"],
  "cre-tropical-medium":[64,54,6.5,31.5,",29-35,24-40,5-59,2-62,1-63,3-61,1-63,30-35,31-35,31-35,30-35,30-34,26-38"],
  "cre-tropical-small":[44,38,10,17.5,"27-27,15-27,7-36,7-36,9-34,5-39,6-37,10-33,16-28,17-27"],
  "cre-wetland-large":[64,92,22.5,22.5,",,,,,,25-39,24-40,22-42,21-43,21-43,19-45,18-46,17-47,15-49,14-50,13-51,12-52,11-53,10-54,14-50,19-46,19-46"],
  "cre-wetland-medium":[64,50,16.5,32,"23-39,21-50,14-51,12-50,15-57,6-63,0-63,0-52,12-49,15-49,18-48,21-48,24-48"],
  "cre-wetland-small":[44,44,11.5,20.5,"19-35,10-35,10-34,10-43,3-40,4-39,6-37,9-35,10-34,14-30,17-26"],
  "dev-desert-large":[64,92,20,20,",29-37,28-38,28-38,27-39,27-39,27-39,27-49,27-50,19-51,18-51,18-51,19-50,18-51,18-52,18-51,18-51,18-51,18-52,17-52,18-52,18-51,15-54"],
  "dev-desert-medium":[62,54,6.5,22,",,,,18-43,12-46,10-48,8-48,13-50,11-51,9-37,10-35,27-34,25-37"],
  "dev-desert-small":[26,22,6.5,13,"5-18,0-25,3-24,5-22,7-20,8-19"],
  "dev-scrubland-large":[64,92,14.5,20.5,",,34-36,30-41,29-40,29-41,29-47,16-51,11-51,11-50,12-49,14-50,13-49,14-47,16-48,16-47,17-45,18-46,18-45,19-43,20-44,20-43,18-46"],
  "dev-scrubland-medium":[64,46,32,32,"11-52,3-59,3-58,6-63,0-63,0-63,0-63,0-63,0-63,0-63,18-46,24-40"],
  "dev-scrubland-small":[17,11,5,8.5,"0-16,1-15,3-13"],
  "dev-temperate-large":[64,92,7.5,27.5,"28-36,28-36,17-47,17-47,12-52,12-52,12-52,7-57,7-57,6-58,5-59,5-59,5-59,5-59,7-57,6-58,30-34,30-34,29-35,29-35,29-35,29-35,25-39"],
  "dev-temperate-medium":[64,56,17.5,23.5,"31-34,22-42,22-42,16-48,17-47,11-53,12-52,9-55,10-54,12-52,13-51,16-48,31-33,26-38"],
  "dev-temperate-small":[14,23,6,7,"5-12,4-11,6-12,0-9,2-12,4-13"],
  "dev-tropical-large":[64,92,8.5,31.5,",,,28-36,21-43,16-48,12-52,9-55,7-57,6-58,5-59,2-62,1-63,6-58,3-61,2-62,6-58,29-35,29-35,29-35,29-35,29-35,24-40"],
  "dev-tropical-medium":[64,54,27.5,29.5,"27-30,26-41,17-42,16-54,16-53,6-53,6-63,6-62,5-62,6-61,6-60,7-59,10-58,6-58"],
  "dev-tropical-small":[20,14,6.5,10,"0-19,0-18,1-15,4-14"],
  "dev-wetland-large":[64,92,4.5,32,"18-48,13-53,8-58,7-59,4-62,4-62,1-63,1-63,1-63,0-63,0-63,2-63,1-34,31-33,31-33,31-33,30-34,30-34,30-34,30-34,30-34,30-34,28-36"],
  "dev-wetland-medium":[64,40,32,32,"28-47,16-52,9-54,9-61,5-61,1-62,2-63,9-54,0-63,0-63"],
  "dev-wetland-small":[22,16,7,11,"1-21,0-21,1-19,4-17"],
  "jur-boreal-large":[72,92,30,30,"35-37,33-39,31-41,26-46,25-45,25-47,22-50,20-51,20-52,18-53,18-53,18-53,14-58,13-57,12-59,12-59,12-59,7-65,6-64,6-65,6-64,6-64,6-60"],
  "jur-boreal-medium":[64,54,13,24.5,",26-37,25-39,21-45,17-47,16-50,12-52,12-51,9-55,8-56,9-54,30-34,30-34,27-37"],
  "jur-boreal-small":[44,38,15,22,",18-26,10-31,5-40,2-40,0-43,3-43,1-43,15-29,16-28"],
  "jur-desert-large":[64,92,19.5,19.5,"30-34,30-34,27-37,25-39,24-40,21-43,21-43,18-46,18-46,16-48,16-48,14-50,14-50,13-51,13-51,13-51,13-51,13-51,15-49,15-49,29-35,29-35,26-38"],
  "jur-desert-medium":[66,54,6.5,28,"37-38,22-38,22-52,10-52,8-61,9-61,6-61,7-60,9-59,31-36,31-35,31-35,31-35,27-39"],
  "jur-desert-small":[44,36,16.5,16.5,",,,20-24,12-32,7-37,6-38,6-38,6-38"],
  "jur-scrubland-large":[64,92,19.5,23,",,,,31-33,31-34,30-39,23-41,23-40,24-45,18-45,18-45,18-44,30-49,14-50,13-39,19-53,12-55,10-55,10-35,29-35,29-35,26-38"],
  "jur-scrubland-medium":[72,54,3.5,33.5,",,,,31-42,20-53,20-52,9-64,12-60,6-68,3-69,33-39,33-39,33-39"],
  "jur-scrubland-small":[48,38,14.5,20.5,",,18-30,17-37,10-38,11-37,4-44,6-42,11-35,22-26"],
  "jur-temperate-large":[72,92,7.5,29.5,"33-39,24-48,24-48,18-54,13-59,13-59,10-62,10-62,11-61,7-65,9-63,7-65,8-64,9-63,11-61,13-59,34-38,33-39,33-39,33-39,33-39,33-39,29-43"],
  "jur-temperate-medium":[64,54,23,32,"24-30,17-41,15-48,8-53,11-57,7-56,0-61,3-63,14-54,14-50,10-55,30-34,30-34,28-36"],
  "jur-temperate-small":[44,38,8.5,22,"19-25,9-35,7-37,9-35,1-43,0-43,0-43,14-30,15-29,17-27"],
  "jur-tropical-large":[72,92,10.5,30.5,",,,,,,,23-49,12-60,12-60,9-63,6-66,14-58,10-62,8-64,26-46,26-46,25-47,26-46,26-46,26-46,27-45,29-43"],
  "jur-tropical-medium":[64,54,6.5,22.5,",,,22-42,22-42,13-51,11-53,16-48,11-53,10-54,29-33,29-35,29-35,26-38"],
  "jur-tropical-small":[44,38,17.5,20.5,",,11-33,11-33,8-36,2-42,6-38,11-33,6-38,5-39"],
  "jur-wetland-large":[70,92,6.5,32.5,",,,,21-50,11-60,9-62,6-64,5-67,3-67,3-37,33-37,33-37,33-37,33-37,33-37,33-37,33-37,33-37,33-37,33-37,33-37,29-41"],
  "jur-wetland-medium":[70,50,3.5,31.5,",,,,22-49,15-59,11-60,12-61,5-66,4-66,27-43,34-36,33-37"],
  "jur-wetland-small":[54,40,17.5,23.5,",,,21-33,21-42,12-42,15-38,6-50,4-50,23-31"],
  "neo-boreal-large":[72,92,21.5,21.5,"35-37,33-39,33-39,30-42,29-43,28-44,28-44,26-46,25-47,25-47,24-48,23-49,22-50,21-51,21-51,20-52,19-53,18-54,17-55,18-55,16-56,15-57,30-42"],
  "neo-boreal-medium":[64,52,9.5,30,",26-39,15-48,13-52,7-59,4-59,4-61,2-61,5-60,8-57,23-41,24-40,24-40"],
  "neo-boreal-small":[44,38,9.5,20.5,"10-27,9-31,3-38,3-40,1-41,2-40,3-34,10-30,13-28,16-28"],
  "neo-desert-large":[64,92,8.5,19,",,27-37,15-38,14-38,14-38,14-38,14-49,14-51,14-51,14-51,14-51,14-51,26-51,26-51,26-38,26-38,26-38,26-38,26-38,26-38,26-38,24-40"],
  "neo-desert-medium":[64,50,25.5,26.5,",,32-33,20-44,20-44,10-54,12-52,14-50,6-58,7-57,12-52,8-56,7-57"],
  "neo-desert-small":[44,40,8.5,17,",10-12,7-37,6-39,8-38,8-37,9-36,13-31,14-30,18-26"],
  "neo-grassland-large":[72,92,31.5,32.5,",35-35,34-38,23-39,22-50,21-51,11-52,10-60,9-63,9-64,9-64,17-64,19-55,14-56,14-63,6-63,6-68,4-67,4-65,7-63,10-59,16-54,24-48"],
  "neo-grassland-medium":[64,52,24.5,26.5,"23-38,21-47,14-48,12-55,12-56,15-57,21-57,15-49,6-58,6-58,8-55,13-51,18-46"],
  "neo-grassland-small":[44,38,15,16,"18-22,11-30,8-35,8-38,10-38,12-36,10-37,7-37,8-33,14-30"],
  "neo-scrubland-large":[64,92,18.5,31.5,",,29-35,25-39,24-40,14-50,9-55,8-56,9-55,8-56,2-62,1-63,2-62,6-58,5-59,6-58,11-53,10-54,14-50,30-35,30-36,29-36,27-37"],
  "neo-scrubland-medium":[66,48,9.5,29.5,"19-47,14-53,10-57,6-58,5-62,8-63,16-59,19-47,21-45,24-42,26-40,29-37"],
  "neo-scrubland-small":[48,34,8.5,23,"24-32,12-35,10-41,4-44,3-43,2-47,4-45,17-30,20-28"],
  "neo-temperate-large":[72,92,35.5,35.5,",32-40,28-44,21-51,19-53,20-52,21-51,12-60,10-62,9-63,11-61,5-67,3-69,2-70,4-68,8-64,3-69,2-70,2-70,1-71,5-67,33-39,25-47"],
  "neo-temperate-medium":[64,54,5.5,25.5,"27-37,18-45,15-48,11-53,8-56,7-57,8-56,16-53,14-54,14-44,30-34,30-34,30-34,27-37"],
  "neo-temperate-small":[44,38,20.5,20.5,",25-32,10-33,10-29,15-28,12-32,3-41,2-42,4-40,16-28"],
  "neo-tropical-large":[72,92,14.5,36,",21-52,19-54,20-53,7-65,0-71,0-71,0-71,0-71,8-64,4-68,32-40,33-39,32-40,33-39,32-40,33-39,31-41,30-42,28-44,26-46,24-48,22-50"],
  "neo-tropical-medium":[64,54,17.5,32,",,28-36,28-52,12-53,11-53,6-62,0-63,0-63,15-49,15-49,15-49,15-49,15-49"],
  "neo-tropical-small":[44,38,9.5,17.5,",,11-33,12-33,5-39,5-39,7-37,10-34,15-29,17-27"],
  "neo-tundra-large":[72,92,18.5,30.5,",39-46,37-46,34-55,33-56,30-63,29-64,29-64,27-65,28-65,28-66,27-61,25-55,24-65,24-66,25-66,7-64,6-50,6-39,20-29,21-28,22-29,18-34"],
  "neo-tundra-medium":[64,52,26.5,30.5,",,,,,18-42,12-50,6-55,4-59,1-60,1-61,6-58,7-57"],
  "neo-tundra-small":[44,38,14.5,16.5,"18-23,8-30,9-32,8-38,13-39,15-34,10-37,7-36,9-33,14-30"],
  "neo-wetland-large":[64,92,7.5,30.5,",16-48,14-50,15-49,8-56,4-60,3-61,6-58,5-59,3-61,2-62,4-60,14-50,29-33,29-34,29-35,29-35,29-35,29-35,29-35,29-35,29-35,25-39"],
  "neo-wetland-medium":[64,56,17,24.5,"26-37,19-44,19-44,12-51,12-51,13-49,15-48,8-56,8-54,12-52,15-48,17-45,21-42,25-39"],
  "neo-wetland-small":[44,46,9.5,14.5,"18-20,18-27,13-30,13-30,8-36,8-36,9-35,11-33,12-32,14-30,16-28,19-25"],
  "pal-boreal-large":[72,92,29.5,29.5,"34-38,32-40,31-42,25-47,23-48,23-50,22-50,20-51,20-52,20-54,18-53,16-54,17-57,15-57,13-57,13-59,14-61,11-60,9-59,11-64,9-64,6-62,7-62"],
  "pal-boreal-medium":[64,54,8.5,25.5,"23-45,19-47,14-52,10-54,9-56,7-57,8-55,22-52,23-38,23-38,23-38,24-37,24-37,24-40"],
  "pal-boreal-small":[44,38,10.5,18.5,"19-23,12-32,10-34,5-39,4-40,6-38,9-35,12-32,16-28,17-27"],
  "pal-desert-large":[72,90,7.5,36,",,,,18-46,6-59,8-62,0-70,0-71,0-71,0-71,0-71,0-71,10-65,11-41,34-41,32-40,31-39,31-38,31-38,32-39,32-39,29-43"],
  "pal-desert-medium":[64,56,9,25,",,,,24-50,12-54,7-55,6-55,6-53,9-49,15-49,18-44,26-34,26-38"],
  "pal-desert-small":[44,40,19,22,",,21-23,8-36,6-38,4-40,2-41,0-43,0-37,18-26"],
  "pal-scrubland-large":[72,92,6.5,28,",,,40-40,27-43,24-50,19-52,17-54,15-57,13-60,11-62,9-63,8-57,14-38,34-38,34-38,34-38,34-38,34-38,34-38,34-38,34-38,30-42"],
  "pal-scrubland-medium":[72,56,3,35,",27-45,13-62,12-61,7-69,2-71,4-66,27-40,33-37,33-37,33-37,33-38,33-38,34-38"],
  "pal-scrubland-small":[46,40,10.5,17.5,",17-29,13-29,11-35,9-39,6-40,8-38,10-36,13-33,16-30"],
  "pal-temperate-large":[72,92,24.5,24.5,",34-38,34-38,34-38,35-37,30-42,25-47,25-47,23-49,22-50,21-51,20-52,19-53,18-54,17-55,15-57,15-57,14-58,12-60,12-60,15-57,33-39,26-46"],
  "pal-temperate-medium":[64,54,7.5,32,",23-45,13-53,10-54,4-58,2-62,0-63,0-63,2-61,22-43,29-36,29-36,29-36,25-39"],
  "pal-temperate-small":[44,38,6.5,20.5,"6-38,1-40,3-40,9-40,10-41,9-38,9-31,12-29,17-27,17-27"],
  "pal-tropical-large":[72,92,11.5,35.5,",23-50,22-51,8-64,1-71,2-70,2-70,6-66,14-62,34-38,33-39,33-39,33-39,33-39,33-39,33-39,33-39,33-39,32-40,31-41,29-43,27-45,25-47"],
  "pal-tropical-medium":[64,54,17.5,21.5,",,,,,24-40,13-50,13-48,18-44,13-51,11-53,17-47,15-49,21-42"],
  "pal-tropical-small":[44,38,12,19.5,"10-19,8-27,8-35,5-36,4-41,9-42,6-42,9-35,16-35,13-34"],
  "pal-wetland-large":[64,92,24.5,24.5,",,29-35,30-34,26-38,22-42,21-43,20-44,19-45,18-46,16-48,16-48,14-50,13-51,12-52,11-53,10-54,9-55,8-56,18-46,18-43,14-48,14-48"],
  "pal-wetland-medium":[60,28,21.5,28.5,",30-30,5-54,2-58,3-57,9-51"],
  "pal-wetland-small":[44,20,14.5,20.5,",8-36,2-42,3-41,11-33"],
  "per-boreal-large":[72,92,9.5,35.5,"34-38,28-44,27-64,8-65,4-71,2-71,1-71,1-71,10-66,4-68,4-69,3-69,3-56,18-52,22-49,26-45,31-40,33-39,33-39,33-39,33-39,33-39,27-45"],
  "per-boreal-medium":[64,54,12.5,31,",,,,10-24,10-53,4-53,2-58,1-60,1-61,1-61,20-62,21-43,23-41"],
  "per-boreal-small":[44,38,19.5,19.5,",,,11-32,10-33,5-39,4-40,3-41,3-41,16-28"],
  "per-desert-large":[72,92,7.5,32.5,"21-51,18-54,21-51,11-61,12-60,14-58,6-66,7-65,8-64,4-68,5-67,6-66,27-45,34-38,34-38,34-38,33-39,33-39,33-39,33-39,33-39,33-39,29-43"],
  "per-desert-medium":[66,54,6.5,31.5,",21-43,15-49,11-53,5-59,3-61,6-58,1-63,2-62,30-35,31-35,31-35,31-35,27-39"],
  "per-desert-small":[44,36,19.5,19.5,",15-29,11-33,7-37,4-40,3-41,3-41,3-41,3-41"],
  "per-scrubland-large":[72,96,15,31,"45-51,41-53,41-48,41-60,42-65,43-66,17-44,14-43,12-42,37-58,35-63,34-65,16-38,11-38,9-39,34-58,33-62,31-64,9-34,6-32,5-30,27-30,28-31,26-34"],
  "per-scrubland-medium":[64,46,1.5,30.5,",,,,,14-52,13-55,6-59,3-61,2-62,31-33,31-33"],
  "per-scrubland-small":[44,46,21.5,21.5,",7-19,8-38,14-37,16-30,10-34,4-35,2-41,1-42,1-43,5-41,19-25"],
  "per-temperate-large":[72,92,7.5,35,"27-54,28-54,17-56,15-57,16-59,7-59,5-67,6-69,2-69,3-71,8-66,25-49,30-45,35-40,34-39,34-39,33-39,33-39,33-39,33-39,33-39,33-39,29-43"],
  "per-temperate-medium":[66,54,6.5,26.5,"26-40,16-50,15-51,12-54,8-58,8-58,8-58,7-59,28-38,31-35,31-35,31-35,31-35,27-39"],
  "per-temperate-small":[44,36,11.5,21.5,",13-31,6-38,6-38,1-43,2-42,6-38,9-35,16-28"],
  "per-tropical-large":[72,92,11.5,30.5,",,,,,,24-48,23-49,14-58,9-63,8-64,15-57,12-60,7-65,6-66,32-40,31-41,30-42,29-43,28-44,27-45,26-46,25-47"],
  "per-tropical-medium":[64,54,16,26,"28-49,17-49,13-34,12-33,19-51,31-57,24-58,21-55,11-34,7-32,7-31,29-32,30-33,24-40"],
  "per-tropical-small":[44,38,15.5,18.5,",,10-34,10-34,10-34,4-40,5-39,8-36,8-36,7-37"],
  "per-wetland-large":[64,92,14,28.5,",,26-40,20-41,19-50,20-51,14-50,13-47,14-55,17-56,8-55,7-51,8-46,12-59,18-60,5-59,4-54,5-48,10-34,16-34,30-34,30-34,27-37"],
  "per-wetland-medium":[64,50,2.5,30.5,",,,,25-48,16-49,7-58,7-57,3-61,2-62,30-34,30-34,30-34"],
  "per-wetland-small":[40,46,12.5,14.5,",15-25,13-27,13-27,10-30,12-28,8-32,11-29,6-34,10-30,8-32,19-21"],
  "q-agave":[30,29,14,15,"13-17,8-22,9-25,4-25,1-28,0-29,2-27,10-19"],
  "q-bald-cypress":[64,92,26.5,26.5,",,29-35,29-35,30-34,24-39,21-43,21-47,19-45,19-45,14-48,16-48,14-50,14-50,11-53,11-53,9-55,9-55,6-58,6-58,16-44,13-49,13-49"],
  "q-bamboo":[60,56,15.5,29,"29-33,18-38,13-46,12-50,13-48,8-56,3-59,2-58,3-47,14-46,15-45,15-45,16-44,16-44"],
  "q-banana":[64,52,10,24.5,",18-41,18-41,6-54,6-54,13-47,10-50,6-54,6-54,26-38,26-42,26-42,23-37"],
  "q-black-spruce":[56,92,7.5,15.5,"25-31,26-30,24-32,23-33,21-35,19-37,19-37,17-39,17-39,15-41,15-41,14-42,14-42,13-43,21-34,22-33,20-34,26-35,26-37,26-30,26-30,26-30,23-33"],
  "q-cattails":[44,46,11,16,"16-21,16-25,15-32,11-34,7-38,7-38,8-37,10-36,12-34,13-31,16-29,18-27"],
  "q-cypress-knees":[40,34,18.5,18.5,",19-21,19-21,13-22,11-28,5-34,4-36,3-37,2-38"],
  "q-dawn-redwood":[64,92,25.5,25.5,"30-34,30-34,30-34,26-38,24-40,24-40,22-42,21-43,20-44,19-45,18-46,17-47,15-48,14-50,14-50,12-52,11-53,10-54,9-55,8-56,7-57,8-56,25-39"],
  "q-giant-tree-fern":[64,56,7.5,25.5,",,,20-44,13-51,10-54,14-50,10-54,7-57,28-35,28-34,28-35,28-35,25-39"],
  "q-ginkgo":[64,52,5.5,27,"25-39,18-47,14-51,11-55,7-56,6-58,5-58,9-54,20-45,30-34,30-34,30-34,27-37"],
  "q-hibiscus":[48,40,19.5,20.5,",20-28,14-34,11-37,11-37,9-42,6-42,4-44,5-43,13-35"],
  "q-japanese-cherry":[64,50,6.5,31,"25-39,14-51,11-54,5-59,3-61,2-63,3-62,20-45,26-37,29-34,30-35,30-36,26-38"],
  "q-labrador-tea":[48,40,13.5,20.5,"19-33,13-36,9-39,3-41,3-43,3-42,6-41,8-38,11-35,12-34"],
  "q-lilac":[56,50,20.5,22.5,",31-31,21-32,20-39,14-41,12-42,11-45,8-47,7-49,6-50,8-48,16-41,20-35"],
  "q-mahogany":[72,92,11.5,26.5,"29-43,26-46,24-48,16-56,15-57,14-58,11-61,10-62,12-60,11-61,12-60,10-62,33-39,33-39,33-39,33-39,33-39,33-39,33-39,31-41,30-42,27-45,25-47"],
  "q-mangrove":[64,56,25.5,27.5,",24-41,14-51,13-52,7-57,5-59,6-58,8-56,17-47,14-50,11-53,9-55,8-56,7-57"],
  "q-mesquite":[64,52,6.5,32,",23-41,11-53,8-56,3-61,0-63,1-63,2-62,23-41,29-35,29-34,29-34,26-38"],
  "q-prairie-wildflowers":[48,40,19,22,"29-30,3-44,2-45,6-41,6-40,11-36,7-44,4-44,5-42,12-36"],
  "q-prickly-pear":[22,27,9,11,"11-18,8-20,5-20,3-21,0-20,1-19,5-16"],
  "q-quaking-aspen":[64,92,6.5,24,",28-38,17-43,13-48,13-53,11-54,10-54,9-56,9-55,12-53,11-51,16-50,18-46,25-36,30-34,30-34,30-34,30-34,30-34,30-34,30-34,29-35,26-38"],
  "q-rose-bush":[56,44,18.5,24.5,",,,26-28,19-43,10-46,5-51,4-52,5-51,8-48,15-42"],
  "q-sagebrush":[11,12,2.5,5.5,"1-8,0-10,1-7"],
  "q-strangler-fig":[72,92,13.5,36,"27-45,21-52,15-58,14-59,15-58,3-69,0-71,0-71,2-70,0-71,0-71,1-71,4-68,27-45,25-47,23-49,22-50,23-49,23-49,25-47,25-47,24-48,23-49"],
  "q-sugar-maple":[64,92,7.5,25.5,",26-38,22-42,15-49,11-53,10-54,8-56,7-57,8-56,7-57,8-56,10-54,27-37,28-36,30-34,30-34,30-34,29-35,29-35,29-35,29-35,29-35,25-39"],
  "q-water-lily":[48,26,22,23,",,18-40,16-39,3-45,2-47,17-47"],
  "q-weeping-willow":[72,92,7.5,29,",,,,,24-48,21-51,14-58,11-61,8-63,7-64,7-64,7-64,7-64,7-64,7-64,11-60,15-56,23-51,32-38,32-39,33-39,29-43"],
  "q-white-oak":[72,92,9.5,36,",36-36,26-46,24-48,19-54,17-56,16-57,4-68,1-71,0-71,3-69,1-71,0-71,2-70,6-66,31-40,32-39,32-39,33-39,33-39,33-39,33-39,27-45"],
  "qua-boreal-large":[72,92,7.5,36,"25-49,20-55,21-61,15-62,11-61,10-67,10-70,5-70,3-70,3-71,1-71,0-70,2-50,23-39,35-39,35-39,35-39,35-39,35-39,34-39,33-39,33-39,29-43"],
  "qua-boreal-medium":[64,46,22.5,25,",32-38,21-45,21-50,11-54,11-59,12-59,14-51,11-53,10-54,10-54,11-52"],
  "qua-boreal-small":[44,30,19.5,19.5,",12-25,12-34,7-36,5-38,3-41,3-41,8-36"],
  "qua-desert-large":[72,92,8.5,36,"26-34,20-40,17-56,14-66,4-65,5-69,1-63,7-66,2-71,0-71,0-71,0-70,2-63,10-57,16-50,32-40,32-39,33-40,33-40,33-39,33-40,33-40,28-44"],
  "qua-desert-medium":[56,52,12.5,14.5,",,,19-37,17-39,15-41,14-42,14-42,14-42,14-42,15-41,17-39,20-36"],
  "qua-desert-small":[44,40,12,20.5,"25-25,13-27,4-37,3-38,5-37,1-41,2-41,5-38,12-32,16-25"],
  "qua-grassland-large":[72,92,28.5,29.5,"26-47,18-48,17-57,22-58,9-56,8-65,11-66,13-64,15-61,15-60,16-59,17-58,18-57,18-57,19-56,15-57,10-62,8-62,8-64,10-64,13-62,17-57,25-49"],
  "qua-grassland-medium":[64,48,23.5,26.5,",41-44,28-48,19-55,13-56,13-48,16-40,17-44,4-49,4-52,8-52,16-46"],
  "qua-grassland-small":[44,32,14.5,17.5,"14-27,13-36,14-35,15-33,7-37,5-39,8-36,13-31"],
  "qua-scrubland-large":[70,92,11,32.5,",23-43,16-53,15-55,9-57,5-63,4-67,7-68,7-65,6-63,7-64,10-62,10-53,10-64,14-64,18-61,22-56,26-51,28-48,29-45,30-43,32-40,29-41"],
  "qua-scrubland-medium":[68,54,13.5,28.5,",29-39,18-50,12-56,9-59,7-61,6-62,7-61,8-60,11-57,17-51,23-47,26-43,29-39"],
  "qua-scrubland-small":[48,44,12.5,15,"22-24,16-32,15-32,15-32,15-32,15-32,16-34,10-39,12-37,15-34,20-29"],
  "qua-temperate-large":[72,92,7.5,34.5,"23-49,19-53,15-57,9-63,8-64,7-65,5-67,3-69,2-70,4-68,2-70,3-69,10-62,34-38,34-38,34-38,33-39,33-39,33-39,33-39,33-39,33-39,29-43"],
  "qua-temperate-medium":[64,52,22,29.5,"32-32,18-46,12-52,11-53,6-58,4-60,3-61,3-61,4-60,11-54,11-54,21-43,22-42"],
  "qua-temperate-small":[24,20,8.5,12,"1-21,0-23,0-23,4-20,5-18"],
  "qua-tropical-large":[72,92,14.5,36,",29-43,26-46,19-54,17-56,16-57,7-65,0-71,0-71,1-71,0-71,0-71,1-71,4-68,14-57,15-57,14-57,33-39,30-42,29-43,26-46,24-48,22-50"],
  "qua-tropical-medium":[64,54,15.5,31.5,"25-39,20-44,19-45,10-48,5-54,4-59,1-60,1-63,17-63,17-47,18-46,18-46,18-46,16-46"],
  "qua-tropical-small":[44,38,17.5,18.5,",17-27,17-27,13-30,9-35,8-36,5-39,4-40,11-33,13-31"],
  "qua-tundra-large":[72,92,12.5,31,"42-42,41-47,24-51,7-58,6-66,6-65,10-63,5-66,5-63,8-63,9-65,11-65,13-60,15-57,15-54,21-51,22-50,24-48,25-47,26-46,27-45,29-43,27-45"],
  "qua-tundra-medium":[64,48,27,27.5,",,,33-41,16-42,14-45,12-44,11-53,14-52,5-56,7-59,15-53"],
  "qua-tundra-small":[44,32,18.5,19.5,",,,10-34,5-39,4-40,3-41,5-39"],
  "qua-wetland-large":[72,92,6.5,26.5,",,,,,27-45,23-49,16-57,12-61,12-62,11-63,11-63,11-63,11-63,11-63,11-63,17-58,24-51,32-43,32-38,32-39,33-39,30-42"],
  "qua-wetland-medium":[64,50,15.5,28.5,",26-33,23-41,15-49,18-48,21-46,8-56,15-49,4-60,11-53,18-46,23-41,27-37"],
  "qua-wetland-small":[44,28,19.5,20.5,",,9-35,4-40,3-41,2-42,4-40"],
  "tri-desert-large":[64,92,9.5,27.5,"27-37,22-42,19-45,18-46,15-49,12-52,14-50,9-55,11-53,7-57,9-55,8-56,5-59,8-56,5-59,7-57,16-48,19-36,30-34,30-34,30-34,30-34,26-38"],
  "tri-desert-medium":[62,56,6.5,18.5,",31-31,25-37,19-43,21-42,17-45,13-49,29-33,28-34,28-34,28-34,28-34,28-34,25-37"],
  "tri-desert-small":[44,38,3.5,17.5,",,14-30,5-39,6-38,11-33,13-31,17-27,19-25,19-25"],
  "tri-scrubland-large":[64,92,16.5,25,",,,,,,32-34,32-34,32-41,24-46,19-46,18-45,18-50,15-52,12-50,12-53,19-53,13-58,9-51,14-41,24-34,30-34,27-37"],
  "tri-scrubland-medium":[76,52,36.5,38,",,,,,21-56,14-69,7-69,7-69,0-75,1-75,2-74,2-39"],
  "tri-scrubland-small":[54,40,17.5,22.5,",,33-33,21-33,12-42,13-41,13-49,5-49,9-45,15-39"],
  "tri-temperate-large":[72,92,28.5,29.5,"33-39,33-39,35-37,35-37,30-42,24-48,27-45,18-54,18-54,16-56,13-59,22-50,10-62,10-62,13-59,7-65,21-51,8-64,8-64,34-38,33-39,33-39,30-42"],
  "tri-temperate-medium":[64,56,5.5,27.5,",,,21-43,20-44,13-51,8-56,9-55,5-59,5-59,5-59,30-34,30-34,27-37"],
  "tri-temperate-small":[44,38,6.5,20.5,",12-32,10-34,4-40,2-42,4-40,14-30,16-28,17-27,18-26"],
  "tri-tropical-large":[72,92,31.5,31.5,",35-37,33-39,28-44,27-45,24-48,22-50,19-53,17-55,17-55,15-57,13-59,19-53,10-62,9-63,21-51,7-65,5-67,33-39,33-39,33-39,33-39,28-44"],
  "tri-tropical-medium":[64,54,7.5,24.5,",,,,,19-45,21-43,9-55,8-56,14-50,9-55,8-56,29-35,25-39"],
  "tri-tropical-small":[44,38,13.5,20.5,"25-26,11-31,11-39,13-37,3-38,4-43,6-42,11-38,12-37,11-33"],
  "tri-wetland-large":[64,92,26.5,32,",,,,31-35,22-40,19-49,16-52,13-54,10-57,8-59,6-61,4-61,3-63,2-63,0-62,0-63,3-63,1-58,0-47,0-34,30-34,28-36"],
  "tri-wetland-medium":[72,50,4.5,34.5,",,,,28-46,18-55,9-65,8-65,5-69,2-70,13-54,35-37,35-37"],
  "tri-wetland-small":[44,44,12,21.5,"31-31,29-33,11-33,12-43,1-43,2-41,4-39,7-37,9-34,12-32,15-29"],
  "boulder-boreal-1":[61,56,25.5,26.5,",22-43,16-49,12-53,9-55,8-55,6-55,6-56,5-56,4-56,4-55,4-54,12-45"],
  "boulder-boreal-2":[74,49,31.5,33,",39-61,34-65,32-67,10-68,7-68,5-69,4-69,4-68,4-65,7-57,16-21"],
  "boulder-boreal-3":[36,52,14,14,",12-25,10-28,8-29,7-30,6-31,6-31,4-31,4-31,4-31,4-31,6-30"],
  "boulder-boreal-4":[60,41,25.5,26,",17-45,10-51,7-53,5-55,4-55,4-55,5-55,7-51,21-35"],
  "boulder-desert-1":[72,61,31,32,",25-55,16-59,10-61,10-62,8-63,6-64,5-64,4-65,4-66,4-67,6-67,8-67,10-56,28-46"],
  "boulder-desert-2":[36,60,13.5,14,",18-29,14-30,12-31,10-31,8-31,7-31,7-31,6-31,5-31,4-30,4-30,4-29,8-26"],
  "boulder-desert-3":[76,63,33,34,",42-63,37-66,34-69,31-70,15-70,10-71,7-71,6-71,5-71,4-71,4-70,4-66,4-52,11-29"],
  "boulder-desert-4":[53,64,21,22.5,",12-38,7-42,7-44,5-47,5-47,4-48,4-48,4-48,4-48,4-48,5-48,6-46,7-42,21-39"],
  "boulder-fern-1":[68,66,30,30.5,",21-51,14-57,11-60,10-60,9-61,9-62,8-62,7-63,5-63,5-63,3-63,3-62,3-60,7-55,23-41"],
  "boulder-fern-2":[37,59,14.5,15,",16-29,13-30,10-31,9-31,8-31,6-32,6-32,6-31,5-31,3-31,3-31,4-31,7-26"],
  "boulder-fern-3":[74,62,33,33,",38-64,34-66,32-67,32-68,15-68,9-69,8-69,6-69,5-69,5-69,4-69,4-65,7-57,12-34"],
  "boulder-fern-4":[57,63,23.5,24.5,",21-36,12-45,10-47,7-51,7-51,5-52,5-52,4-52,4-52,4-52,4-52,5-47,5-43,6-39"],
  "boulder-grassland-1":[60,57,25.5,26,",21-43,14-48,10-52,8-53,5-54,4-54,4-54,4-55,4-55,4-55,6-54,11-49,22-40"],
  "boulder-grassland-2":[69,49,30.5,30.5,",34-56,31-60,28-62,11-63,7-64,5-64,4-64,4-64,4-64,7-54,16-24"],
  "boulder-grassland-3":[37,46,14.5,14.5,",12-27,9-30,7-31,5-32,4-32,4-32,4-32,4-32,5-32,10-27"],
  "boulder-grassland-4":[50,44,21,21,",12-38,8-42,6-43,4-44,4-44,4-45,4-45,4-44,10-39"],
  "boulder-scrubland-1":[68,66,30,30.5,",21-51,14-57,11-60,10-60,9-61,9-62,8-62,7-63,5-63,5-63,3-63,3-62,3-60,7-55,23-41"],
  "boulder-scrubland-2":[37,59,14.5,15,",16-29,13-30,10-31,9-31,8-31,6-32,6-32,6-31,5-31,3-31,3-31,4-31,7-26"],
  "boulder-scrubland-3":[74,62,33,33,",38-64,34-66,32-67,32-68,15-68,9-69,8-69,6-69,5-69,5-69,4-69,4-65,7-57,12-34"],
  "boulder-scrubland-4":[57,63,23.5,24.5,",21-36,12-45,10-47,7-51,7-51,5-52,5-52,4-52,4-52,4-52,4-52,5-47,5-43,6-39"],
  "boulder-temperate-1":[59,54,24,25.5,",15-42,12-50,10-53,7-53,6-54,5-54,4-54,4-54,4-53,5-51,6-48,19-35"],
  "boulder-temperate-2":[73,52,31.5,33,",38-61,34-63,32-66,30-67,9-68,7-68,5-68,3-68,3-67,3-63,9-33"],
  "boulder-temperate-3":[33,52,13,13,",15-25,11-27,9-28,7-28,6-28,4-28,4-28,3-28,3-28,5-27,6-26"],
  "boulder-temperate-4":[56,49,22,24,",13-36,8-46,7-49,6-51,5-51,5-51,4-51,4-49,4-46,10-42,19-25"],
  "boulder-tropical-1":[68,46,29.5,33,"14-43,7-50,2-56,1-61,1-63,1-65,1-65,3-66,7-66,11-65,24-64,41-54"],
  "boulder-tropical-2":[32,57,15,15,"13-25,9-27,7-29,5-29,3-30,2-30,1-30,1-30,1-30,1-30,1-30,2-30,6-30,10-28"],
  "boulder-tropical-3":[73,49,33,35.5,"36-57,30-65,26-69,12-71,6-71,3-71,1-71,1-71,1-71,1-67,1-63,6-29"],
  "boulder-tropical-4":[62,37,22,30,"14-44,3-55,1-60,1-60,2-60,2-60,9-57,12-55,16-52"],
  "boulder-tundra-1":[68,50,28.5,30,",13-42,10-50,5-57,5-59,5-59,4-63,4-63,5-63,7-63,9-53,10-45"],
  "boulder-tundra-2":[73,47,30,33,",39-54,31-62,26-65,9-68,5-68,5-68,3-68,3-64,4-59,7-29"],
  "boulder-tundra-3":[37,51,14,14.5,",11-25,8-26,8-29,7-29,4-29,4-32,5-32,4-32,4-31,5-30,9-28"],
  "boulder-tundra-4":[56,40,24,24,",10-39,6-46,6-48,4-51,4-51,4-51,4-51,4-43"],
  "boulder-wetland-1":[60,54,26,26,",16-47,11-50,9-51,8-53,6-53,5-54,4-54,4-55,4-55,4-55,9-47,14-42"],
  "boulder-wetland-2":[76,53,32.5,34,",40-59,33-65,31-68,31-70,9-70,8-70,6-71,5-71,4-69,4-66,4-56,16-22"],
  "boulder-wetland-3":[55,46,22.5,23.5,",15-42,12-46,7-49,7-49,5-50,4-50,4-50,4-50,8-46,13-42"],
  "rock-boreal-1":[40,30,13.5,16,",10-32,5-34,4-35,4-35,5-33,11-26"],
  "rock-boreal-2":[29,30,9.5,10.5,",6-22,5-24,4-24,4-24,5-23,10-18"],
  "rock-boreal-3":[33,31,12,12.5,",7-26,5-28,4-28,4-28,4-28,7-27"],
  "rock-boreal-4":[29,27,10.5,10.5,",6-21,5-23,4-24,4-24,5-22"],
  "rock-boreal-5":[39,27,15.5,15.5,",19-31,8-34,5-34,4-34,6-34"],
  "rock-boreal-6":[37,26,14,14.5,",9-27,5-32,4-32,4-32,7-27"],
  "rock-desert-1":[43,31,16.5,17.5,",7-31,6-36,5-38,4-38,4-37,10-35"],
  "rock-desert-2":[33,32,11.5,12.5,",7-24,5-26,4-28,4-28,4-28,4-25"],
  "rock-desert-3":[32,39,11.5,12,",10-22,7-25,5-26,5-26,4-27,4-27,4-26,7-24"],
  "rock-desert-4":[31,29,11,11.5,",7-22,5-25,4-26,4-26,5-26,12-19"],
  "rock-desert-5":[34,32,13,13,",7-24,4-27,4-28,4-29,4-29,7-25"],
  "rock-desert-6":[40,29,15,16,",18-32,4-34,4-35,4-35,4-33,9-23"],
  "rock-fern-1":[44,30,17,18,",5-38,4-39,4-39,4-39,5-38,14-29"],
  "rock-fern-2":[33,31,10.5,12.5,",8-25,5-27,4-28,4-28,5-28,7-23"],
  "rock-fern-3":[31,38,11.5,11.5,",10-22,7-25,5-25,5-26,4-26,4-26,5-25,8-24"],
  "rock-fern-4":[29,29,10,10.5,",8-23,5-24,4-24,4-24,4-23,10-16"],
  "rock-fern-5":[33,31,11,12.5,",8-26,6-28,4-28,4-28,4-28,9-28"],
  "rock-fern-6":[38,38,14.5,15,",9-22,8-23,8-30,4-33,4-33,4-33,5-31,10-28"],
  "rock-grassland-1":[40,29,16,16,",10-29,6-33,4-35,4-35,4-35,13-28"],
  "rock-grassland-2":[29,29,10.5,10.5,",7-21,5-23,4-24,4-24,4-24,10-19"],
  "rock-grassland-3":[35,32,12.5,13.5,",9-26,6-28,4-30,4-30,4-30,6-28"],
  "rock-grassland-4":[29,28,10.5,10.5,",8-21,5-23,4-23,4-24,5-24"],
  "rock-grassland-5":[39,27,14.5,15.5,",18-32,8-33,4-34,4-34,6-31"],
  "rock-grassland-6":[35,25,13,13.5,",8-28,4-30,4-30,4-29,10-22"],
  "rock-scrubland-1":[44,30,17,18,",5-38,4-39,4-39,4-39,5-38,14-29"],
  "rock-scrubland-2":[33,31,10.5,12.5,",8-25,5-27,4-28,4-28,5-28,7-23"],
  "rock-scrubland-3":[31,38,11.5,11.5,",10-22,7-25,5-25,5-26,4-26,4-26,5-25,8-24"],
  "rock-scrubland-4":[29,29,10,10.5,",8-23,5-24,4-24,4-24,4-23,10-16"],
  "rock-scrubland-5":[33,31,11,12.5,",8-26,6-28,4-28,4-28,4-28,9-28"],
  "rock-scrubland-6":[38,38,14.5,15,",9-22,8-23,8-30,4-33,4-33,4-33,5-31,10-28"],
  "rock-temperate-1":[42,30,15,17,",8-32,6-36,4-37,4-37,4-35,13-33"],
  "rock-temperate-2":[35,29,14,14,",9-26,6-29,3-30,3-30,3-30,10-22"],
  "rock-temperate-3":[36,31,13,14,",9-27,5-30,4-31,4-31,4-31,8-27"],
  "rock-temperate-4":[30,27,9.5,11,",7-22,5-25,4-25,4-25,6-23"],
  "rock-temperate-5":[41,29,16,17,",17-33,8-35,5-36,3-36,3-34,10-27"],
  "rock-tropical-1":[38,25,14,18,"14-31,5-35,1-36,1-36,1-34,3-28"],
  "rock-tropical-2":[23,29,9.5,10.5,"4-15,1-19,1-21,1-21,1-21,1-21,6-21"],
  "rock-tropical-3":[42,20,19.5,20,"7-29,2-38,1-40,1-40,1-37"],
  "rock-tropical-4":[28,18,11.5,13,"4-24,1-25,1-26,1-25,2-21"],
  "rock-tropical-5":[39,27,12.5,18.5,"7-17,2-32,1-36,1-37,1-37,7-31,15-23"],
  "rock-tropical-6":[36,26,17,17,"8-30,4-32,2-33,1-34,1-34,1-34,8-29"],
  "rock-tundra-1":[37,29,13.5,14.5,",10-30,6-31,4-32,4-32,6-32,13-19"],
  "rock-tundra-2":[28,29,9.5,10,",6-19,4-23,4-23,4-23,4-22,12-19"],
  "rock-tundra-3":[35,24,11,13.5,",6-27,4-30,4-30,5-30"],
  "rock-tundra-4":[25,27,8,8.5,",6-17,5-20,4-20,4-20,4-19"],
  "rock-tundra-5":[36,28,13.5,14,",16-28,6-31,5-31,4-31,4-30"],
  "rock-tundra-6":[34,26,10.5,13,",6-23,5-28,4-29,4-29,8-24"],
  "rock-wetland-1":[43,31,15.5,17.5,",6-34,4-36,4-38,4-38,4-37,10-33"],
  "rock-wetland-2":[30,30,11,11,",6-22,5-25,4-25,4-25,4-25,8-24"],
  "rock-wetland-3":[39,31,14,16,",9-29,5-33,3-34,3-34,3-34,9-30"],
  "rock-wetland-4":[29,28,8,10.5,",8-21,5-23,4-24,4-24,6-21"],
  "rock-wetland-5":[41,29,16,17,",18-33,7-35,4-36,3-36,3-34,11-15"],
  "barn":[84,62,42,42,"31-52,26-57,21-62,16-67,11-72,6-77,1-82,0-83,0-83,0-83,0-83,0-83,0-83,0-83,0-83,0-83"],
  "burrow":[26,14,13,13,"3-22,1-24,0-25,0-25"],
  "canopylg":[70,52,25,35,"19-50,12-57,8-61,5-64,3-66,1-68,0-69,0-69,0-69,10-59,10-59,10-59,10-59"],
  "canopysm":[42,34,15,21,"9-32,5-36,2-39,1-40,0-41,0-41,6-35,6-35,6-35"],
  "cavelg":[92,50,46,46,"24-67,18-73,14-77,11-80,8-83,6-85,4-87,3-88,2-89,1-90,0-91,0-91,0-91"],
  "cavesm":[62,34,31,31,"14-47,10-51,6-55,4-57,2-59,1-60,0-61,0-61,0-61"],
  "shelter":[48,40,24,24,"17-30,12-35,7-40,2-45,0-47,0-47,0-47,0-47,0-47,0-47"],
  "traylg":[46,20,19,23,"6-39,1-44,0-45,1-44,6-39"],
  "traymd":[30,14,11,15,"2-27,0-29,0-29,6-23"],
  "traysm":[18,9,7,9,"0-17,0-17,5-12"],
};
// SPRITE_HIT:end
// Ground footprint of a plant, rock or boulder (landscape.js footBox, footRects). A plant takes a square of whole 1 m cells, or in FOOT.rect a base width by a share of it deep; a pictured rock or boulder takes a few
// whole-cell rects cut from its silhouette (SPRITE_HIT, ROCK_FOOT in landscape.js). All stand on the picture's base and run back up the map. A plant's side comes from its own sprite, rounded to whole meters and held to its kind's range.
// side: key -> meters, to override one picture by hand with a square.
const FOOT = {
  range:{small:[1, 2], medium:[2, 4], large:[3, 3]},
  plain:{small:2, medium:3, large:3, rock:3, boulder:7},   // no picture to measure: the middle of the range
  crown:.5,    // the old square side of a plant is its base width, or this share of its crown width if that is more (kept for old saves)
  depth:.5,    // a plant in `rect` has a box its base width (to the half meter, held to the range) by this share of it deep, from the base back up the map
  rect:["dev-tropical-small"],   // add a plant's key here when its picture is redrawn with a real base; the rest keep their square
  rockCover:.5,   // a rock's ground cell is taken when its silhouette covers at least this share of it
  rockWide:.9,    // a rock's footprint is this share of its silhouette's width, to whole meters
  side:{}
};
const plantMix = (a, b, t) => "#" + [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, "0")).join("");
// Rocks and boulders are the same in every biome, just a natural stone color that fits it. Boulders run a shade darker.
const ROCK_STONE = {desert:"#B98F68", tropical:"#6F7468", grassland:"#8E9188", scrubland:"#A39A83", fern:"#A39A83", wetland:"#6B7B76", temperate:"#868A8C", boreal:"#5F6A73", tundra:"#7F8780"};
const rockTone = (biome, type) => { const base = plantMix(ROCK_STONE[biome] || ROCK_STONE[DEFAULT_BIOME], "#000000", type === "boulder" ? .16 : 0);
  return {fill:base, light:plantMix(base, "#ffffff", .35), dark:plantMix(base, "#000000", .3)}; };
// Per size: price by era, radius, daily browse, label style
const PLANT_SIZE = {small:{r:2, browse:1, shade:2, a:"a patch of"}, medium:{r:3.5, browse:2, shade:4, a:"a stand of"}, large:{r:5, browse:4, shade:8, a:"a grove of"}};
const PLANT_PRICE = {cenozoic:[300, 600, 1200], mesozoic:[380, 750, 1500], paleozoic:[450, 900, 1800]};
const PLANTS_OF = {};   // period -> biome -> the three LAND keys, small to large
for(const [period, biomes] of Object.entries(PLANT_TABLE)){
  const era = ERA_OF[period], tech = FLORA[era].tech;
  PLANTS_OF[period] = {};
  for(const [biome, names] of Object.entries(biomes)){
    PLANTS_OF[period][biome] = names.split("|").map((name, i) => {
      const size = PLANT_SIZES[i], z = PLANT_SIZE[size], key = period.slice(0, 3).toLowerCase() + "-" + biome + "-" + size;
      LAND[key] = {label:name, one:`${z.a} ${name}`, price:PLANT_PRICE[era][i], r:z.r, color:plantMix(PLANT_SHADE[biome][i], PERIOD_COLOR[period], .22), flora:era, size, browse:z.browse, shade:z.shade, period, biome};
      if(tech) LAND[key].tech = tech;
      return key;
    });
  }
}
// Park plants: named modern plants for gardens along the paths and for exhibits alike (LAND keys "q-<name>").
// In an exhibit of their biome they count as Quaternary plants. Out in the park, guests enjoy them (DECOR).
//   look    how it's drawn: conifer, willow, palm, bamboo, cactus, rosette, reeds, lily, knees (none: a leafy clump)
//   accent  blossom, berry or fall color dotted over the leaves
//   wet     it can stand in water as well as on land; aquatic: only in water
const PARK_PLANTS = {
  large:{
    "Black Spruce":  {biome:"boreal",    color:"#2E5A45", look:"conifer"},
    "Quaking Aspen": {biome:"boreal",    color:"#9CC25A", accent:"#E8D45A"},
    "White Oak":     {biome:"temperate", color:"#4E8A3A"},
    "Sugar Maple":   {biome:"temperate", color:"#D2602A", accent:"#F0A030"},
    "Dawn Redwood":  {biome:"temperate", color:"#5E8F4A", look:"conifer"},
    "Bald Cypress":  {biome:"wetland",   color:"#6E9A5A", look:"conifer"},
    "Weeping Willow":{biome:"wetland",   color:"#9DBA5E", look:"willow"},
    "Strangler Fig": {biome:"tropical",  color:"#2F7A3E"},
    "Mahogany":      {biome:"tropical",  color:"#3B6E36", accent:"#8A4A2A"},
  },
  medium:{
    "Japanese Cherry":{biome:"temperate", color:"#E9A3C0", accent:"#FBDDE8"},
    "Rose Bush":      {biome:"temperate", color:"#4F7F3A", accent:"#D8334A"},
    "Ginkgo":         {biome:"temperate", color:"#8DB84A", accent:"#E9D35A"},
    "Lilac":          {biome:"temperate", color:"#6E9A4E", accent:"#B28AD6"},
    "Mesquite":       {biome:"desert",    color:"#8A9A4E"},
    "Mangrove":       {biome:"wetland",   color:"#3E7A4A", wet:true},
    "Bamboo":         {biome:"tropical",  color:"#7DBA4A", look:"bamboo"},
    "Banana":         {biome:"tropical",  color:"#6DBE4A", look:"palm"},
    "Giant Tree Fern":{biome:"tropical",  color:"#3E9A4E", look:"palm"},
  },
  small:{
    "Labrador Tea":       {biome:"tundra",    color:"#7E9A6A", accent:"#F4F2E8"},
    "Sagebrush":          {biome:"desert",    color:"#A7B39A"},
    "Prairie Wildflowers":{biome:"grassland", color:"#A8C46A", accent:"#E8B83A"},
    "Prickly Pear":       {biome:"desert",    color:"#6E9A5A", look:"cactus", accent:"#E0507A"},
    "Agave":              {biome:"desert",    color:"#7FA7A0", look:"rosette"},
    "Hibiscus":           {biome:"tropical",  color:"#3E8A4A", accent:"#E8344A"},
    "Cattails":           {biome:"wetland",   color:"#6E8A3A", look:"reeds", wet:true},
    "Water Lily":         {biome:"wetland",   color:"#4E9A5A", look:"lily", accent:"#F4C6DA", aquatic:true},
    "Cypress Knees":      {biome:"wetland",   color:"#7A5A3E", look:"knees", wet:true},
  },
};
const PARK_PLANTS_OF = {};   // biome -> its park plant keys, large first
for(const [size, list] of Object.entries(PARK_PLANTS)) for(const [name, p] of Object.entries(list)){
  const z = PLANT_SIZE[size], key = "q-" + name.toLowerCase().replace(/[^a-z]+/g, "-");
  LAND[key] = {label:name, one:(/^[AEIOU]/.test(name) ? "an " : "a ") + name, price:PLANT_PRICE.cenozoic[PLANT_SIZES.indexOf(size)], r:z.r, color:p.color, accent:p.accent, look:p.look, wet:p.wet || p.aquatic, aquatic:p.aquatic,
    flora:"cenozoic", size, browse:z.browse, shade:z.shade, period:"Quaternary", biome:p.biome, park:true};
  (PARK_PLANTS_OF[p.biome] = PARK_PLANTS_OF[p.biome] || []).push(key);
}

// Statues: bronze on a stone plinth, placed anywhere outside the exhibits. The plinth takes the paving color of the theme it stands in.
//   sp       an animal: a bronze disc the size of the animal's dot on the map, with its letter
//   initials a person: staff-sized, and guests learn a lot from the plaque (DECOR.personLearn)
//   free     open from the start; the rest come with grants (GOALS `statue`)
const STATUES = {
  dodo:{sp:"dodo", free:true}, igua:{sp:"igua", free:true}, mgal:{sp:"mgal", free:true},
  dime:{sp:"dime"}, lyst:{sp:"lyst"}, coel:{sp:"coel"}, herr:{sp:"herr"}, orni:{sp:"orni"}, prot:{sp:"prot"}, proc:{sp:"proc"}, kele:{sp:"kele"},
  owen:  {label:"Richard Owen", initials:"RO", free:true, text:"Named the dinosaurs in 1842."},
  anning:{label:"Mary Anning",  initials:"MA", text:"Found the first ichthyosaur and plesiosaurs on the cliffs at Lyme Regis."},
  brown: {label:"Barnum Brown", initials:"BB", text:"Dug up the first Tyrannosaurus rex."},
  marsh: {label:"O.C. Marsh",   initials:"OCM", text:"Named Stegosaurus, Triceratops and Apatosaurus in the Bone Wars."},
  cope:  {label:"E.D. Cope",    initials:"EDC", text:"Named over a thousand species, Dimetrodon among them, in the Bone Wars."},
};
// Species a non-dev player can see and get; everything else in SPECIES is hidden (saves that already own one keep it)
const LAUNCH_ROSTER = ["arth","mega","pulm","dcau","comp","lyst","dryo","hyps","ovir","psit","coel","sile","orni","hete","mosc","scut","este","desm","scel","plat","gall","para","macr","aepy","mglo","pach","tric","trex","dipl","apat","mamm","smil","kele","icht","eryo","inos","diic","plhy","long","eryt","kent","cryo","allo","beel","simo","igua","velo","pter","paki","ambu","andr","chal","dgal","dodo","elas","prio","carc","spin","coty","dime","tikt"];
const speciesAvailable = id => devMode() || LAUNCH_ROSTER.includes(id);
const STATUE_PRICE = {animal:4000, person:7500};
for(const [id, st] of Object.entries(STATUES)){
  const sp = st.sp && SPECIES.find(s => s.id === st.sp), name = sp ? sp.name : st.label;
  const r = sp ? Math.min(6, Math.max(1.2, Math.sqrt(sp.space) / 9)) + .9 : 1.4;   // the plinth: the animal's dot plus a stone rim
  LAND["st-" + id] = {label:sp ? `${name} Statue` : name, one:`a statue of ${sp ? (/^[AEIOU]/.test(name) ? "an " : "a ") + name : name}`, price:STATUE_PRICE[sp ? "animal" : "person"], r, color:"#9C6B33",
    statue:id, sp:st.sp, initials:st.initials, text:st.text, free:!!st.free};
}

// Decorations out in the park cheer up the guests walking past: plants, rocks, water, statues and hedge rows
const DECOR = {
  reach:25,            // guests enjoy decorations this close to the path they're on
  full:14,             // points within reach that make a stretch fully pretty
  joy:.035,            // mood gained a minute on a fully pretty stretch (being on their feet costs .03)
  pretty:.5,           // a stretch this pretty gets guests talking about the gardens
  pts:{small:1, medium:2, large:3, rock:1, boulder:2, statue:4, person:3},
  waterPer:60,         // a point for each this many square meters of water
  hedgePer:12,         // and for each this many meters of hedge row
  statueReach:15,      // guests read a statue's plaque from this close
  personLearn:12,      // learning from a person's statue (once each)
  animalLearn:2,       // and from an animal's
  statueJoy:3,         // mood from a statue the first time they pass it
};
// Wooden bridges are the only paths that cross water
const BRIDGE = {perMeter:45, upkeepPerMeter:.3, halfWidth:2.5};

const BIOME_HAPPY = {home:8, away:-6};   // happiness in either of an animal's two biomes, or in any other
const DEFAULT_BIOME = "grassland";              // new exhibits start out as plain ground
// Each animal's two biomes, equally at home in either (the order means nothing). Vivarium animals count too: a vivarium is laid out as a biome like any exhibit.
const SPECIES_BIOMES = Object.fromEntries(Object.entries({
  eryo:"wetland tropical",    lyst:"fern scrubland",     mosc:"fern scrubland",     dime:"scrubland wetland",
  scut:"desert scrubland",    este:"temperate wetland",    coty:"scrubland desert",     ante:"wetland fern",
  inos:"scrubland fern", prio:"wetland tropical",     sile:"fern scrubland",     coel:"desert scrubland",
  herr:"fern scrubland", desm:"scrubland desert",     plat:"fern temperate",  post:"scrubland fern",
  eryt:"desert scrubland",    liso:"fern scrubland",  hete:"desert scrubland",     orni:"temperate scrubland",
  dryo:"fern temperate", dimo:"tropical wetland",     scel:"temperate wetland",    dilo:"tropical scrubland",
  kent:"scrubland tropical",  steg:"fern scrubland",  cryo:"boreal temperate",     cera:"scrubland fern",
  mgal:"boreal wetland",   allo:"fern scrubland",  cama:"fern boreal",  torv:"scrubland fern",
  apat:"fern wetland",   dipl:"fern scrubland",  brac:"tropical fern",   hyps:"fern temperate",
  psit:"temperate boreal", prot:"desert scrubland",     ornm:"temperate fern",  ovir:"desert scrubland",
  minm:"fern scrubland", gall:"desert fern",     para:"wetland temperate",    igua:"fern wetland",
  velo:"desert scrubland",    pter:"wetland tropical",     conc:"wetland tropical",     nige:"fern wetland",
  utah:"temperate scrubland", styr:"fern temperate",  bary:"wetland temperate",    ther:"wetland temperate",
  dsuc:"wetland tropical",    yutt:"boreal temperate",     anky:"temperate fern",  tric:"fern temperate",
  cnot:"fern scrubland", dche:"wetland temperate",    quet:"fern scrubland",  spin:"wetland tropical",
  pata:"fern boreal", carc:"desert scrubland",     trex:"temperate fern",  proc:"tropical temperate",
  hyae:"fern scrubland", ambu:"wetland tropical",     uint:"boreal wetland",    andr:"scrubland fern",
  bari:"tropical wetland",    arge:"fern scrubland",  arsi:"wetland tropical",     tita:"tropical wetland",
  dino:"grassland scrubland", daeo:"grassland scrubland",  aepy:"grassland scrubland",  kele:"grassland scrubland",
  thyl:"scrubland temperate", mchl:"scrubland tropical",   chal:"temperate tropical",   aind:"tropical temperate",
  drom:"scrubland grassland", plty:"wetland grassland",    amph:"temperate grassland",  gpit:"tropical temperate",
  siva:"grassland scrubland", pcer:"scrubland desert",     dire:"grassland boreal",     macr:"grassland scrubland",
  arct:"boreal temperate",    doed:"grassland scrubland",  mgth:"temperate scrubland",  mlan:"scrubland desert",
  smil:"grassland temperate", mast:"boreal temperate",     elas:"grassland boreal",     mamm:"tundra boreal",
  colm:"grassland temperate",  mglo:"grassland boreal",  pach:"boreal scrubland",
  enal:"temperate wetland",   icht:"wetland tropical",    tikt:"wetland tropical",     mibr:"wetland tropical",     hylo:"tropical temperate",
  dcau:"wetland tropical",    arth:"tropical wetland",     pulm:"tropical scrubland",   mega:"tropical wetland",
  diic:"scrubland desert",    seym:"scrubland wetland",    plhy:"scrubland desert",     shar:"temperate wetland",
  long:"temperate wetland",   gigt:"scrubland tropical",   anch:"temperate boreal",   comp:"scrubland temperate",
  yiqi:"temperate boreal",    arch:"scrubland temperate",  beel:"scrubland tropical",   mono:"desert scrubland",
  mcer:"temperate fern", scan:"temperate boreal",     micr:"temperate boreal",     kool:"boreal wetland",
  simo:"tropical wetland",    ples:"temperate boreal",   paki:"wetland tropical",     lept:"temperate tropical",
  sifr:"temperate fern", ptil:"temperate fern",  miac:"temperate boreal",    waim:"temperate wetland",
  tmyr:"tropical temperate",  dgal:"scrubland temperate",  nura:"scrubland temperate",  hopl:"scrubland temperate",
  psil:"grassland scrubland", ornw:"scrubland temperate",  dodo:"tropical scrubland",    ppig:"temperate grassland",
  gtod:"tropical temperate",  rmlo:"grassland scrubland",  sdel:"scrubland temperate",
}).map(([id, b]) => [id, b.split(" ")]));
const biomesOf = s => SPECIES_BIOMES[s.id] || null;
const biomeNames = s => biomesOf(s).map(b => BIOMES[b].label.toLowerCase()).join(" or ");   // "fern prairie or scrubland"

// Paleopedia write-ups, by species id: sci = scientific name, ft = body length in feet, desc = the text on its card. A species with no entry shows blanks.
const SPECIES_INFO = {
  came:{sci:"Cameroceras trentonense", ft:20, desc:"A giant nautiloid, a squid relative living in a long straight cone of a shell, from the shallow Ordovician seas that covered New York about 450 million years ago. The shell was chambered and filled with gas so it could hover, and big ones may have been six meters long or more, which made it one of the biggest hunters of its time. It grabbed prey with a ring of tentacles round a horny beak."},
  dunk:{sci:"Dunkleosteus terrelli", ft:20, desc:"A huge armored fish from the Late Devonian seas over Ohio, about 360 million years ago. It had no real teeth: the edges of its bony jaw plates were sharpened into self-honing blades, and its jaws snapped open so fast they sucked prey in. Only its armored head and shoulders turn up as fossils, in the Cleveland Shale, so how long its body was is still argued over."},
  rhiz:{sci:"Rhizodus hibberti", ft:20, desc:"The biggest lobe-finned fish ever found, a cousin of the fish that crawled onto land, from the rivers and lagoons of Carboniferous Scotland about 340 million years ago. It was a long ambush hunter with fangs up to 22 centimeters long at the front of its jaws, big enough to take the early four-legged animals that lived along the banks."},
  heli:{sci:"Helicoprion bessonowi", ft:20, desc:"A shark relative from Permian seas about 275 million years ago, known almost only from its teeth, which grew in a spiral like a circular saw blade. For a century nobody knew where the whorl went. CT scans of a fossil from Idaho finally showed it sat in the middle of the lower jaw and sliced soft prey like squid as the mouth closed. It was a relative of today's ratfish, not a true shark."},
  noth:{sci:"Nothosaurus mirabilis", ft:13, desc:"A long-necked sea reptile from the warm shallow seas that covered Germany in the Middle Triassic, about 240 million years ago. It had a slim body, webbed paddle feet and a long jaw full of needle teeth for snapping fish. It probably hauled out on the shore to rest like a seal. Its later relatives became the plesiosaurs."},
  shon:{sci:"Shonisaurus popularis", ft:50, desc:"A giant ichthyosaur from the Late Triassic seas over Nevada, about 225 million years ago, about the size of a sperm whale. It had a deep round body, long narrow flippers and no teeth as an adult. Dozens of skeletons were found lying together in Berlin-Ichthyosaur State Park, and it is Nevada's state fossil."},
  ichy:{sci:"Ichthyosaurus communis", ft:8, desc:"A dolphin-shaped sea reptile from Early Jurassic seas, about 195 million years ago. It had big eyes for hunting in dim water, a long toothy snout, a tall fin on its back and a shark-like tail, and it gave birth to live young at sea. Mary Anning and her brother found the first skeleton to be recognized, at Lyme Regis in 1811."},
  elsm:{sci:"Elasmosaurus platyurus", ft:34, desc:"A plesiosaur from the Late Cretaceous inland sea that split North America, about 80 million years ago. More than half its length was neck, with 72 vertebrae, but the neck was stiffer than it looks and it couldn't hold its head up like a swan. It rowed with four big flippers and swept its small head through schools of fish. Edward Drinker Cope famously put its skull on the end of the tail."},
  mosa:{sci:"Mosasaurus hoffmannii", ft:50, desc:"One of the biggest sea reptiles ever, from the last few million years of the Cretaceous, about 68 million years ago. Mosasaurs were giant swimming lizards related to monitors and snakes, with flippers, a shark-like tail fin and a second row of teeth on the roof of the mouth to hold struggling prey. The first skull came out of a chalk quarry near Maastricht in the Netherlands in the 1700s."},
  basi:{sci:"Basilosaurus isis", ft:55, desc:"An early whale from the warm Eocene seas over Egypt, about 38 million years ago. It was long and eel-like, with a big head full of saw-edged teeth, and it still had tiny hind legs with knees and toes. It hunted other whales: bite marks from it are found on the skulls of young Dorudon. Hundreds of skeletons lie in the desert at Wadi Al-Hitan, the Valley of the Whales. Its name means king lizard, because its first finder took it for a sea reptile."},
  mgdn:{sci:"Otodus megalodon", ft:55, desc:"The biggest shark that ever lived, from about 23 to 3.6 million years ago in warm seas all over the world. Its triangular teeth are as big as a hand, and its bite was strong enough to crunch through whale bone. It hunted whales and seals, and it may have been warm-bodied like a great white. Almost all we have of it is teeth and a few backbones, and its teeth wash out of Calvert Cliffs on Chesapeake Bay."},
  stel:{sci:"Hydrodamalis gigas", ft:28, desc:"A giant relative of the manatee that grazed kelp in the cold shallows around the Commander Islands in the Bering Sea. It was eight meters long, weighed about ten tons, and had no teeth, only horny plates to chew with. The naturalist Georg Steller described it in 1741 after his ship wrecked there. Hunters killed the last of them for meat within 27 years."},
  icht:{sci:"Ichthyostega stensioei", ft:5, desc:"One of the first animals with four limbs. It lived in the swamps of Late Devonian Greenland, and it had seven toes on each hind foot. It probably dragged itself over mud banks more than it walked, and still breathed through gills in the water. It sits near the line between fish and land animals."},
  tikt:{sci:"Tiktaalik roseae", ft:9, desc:"A fish with a neck. Tiktaalik lived in shallow Late Devonian streams about 375 million years ago, and its fossils were found on Ellesmere Island in the Canadian Arctic in 2004. It still had gills and fins, but it also had a flat head with eyes on top, a neck that could turn, and strong fin bones that could prop it up like arms. Its name comes from an Inuktitut word for a big freshwater fish."},
  enal:{sci:"Enaliarctos mealsi", ft:5, desc:"The dawn sea lion, one of the first seals, from the coast of California about 23 million years ago. It had flippers on all four limbs, but its body still looked a lot like a bear's or an otter's, and it probably spent as much time on rocky shores as in the water. Every seal, sea lion and walrus alive today comes from animals like it."},
  kntr:{sci:"Kentriodon pernix", ft:6.5, desc:"An early dolphin from the warm Miocene seas off Maryland, about 15 million years ago, a little smaller than a bottlenose. It already had the dolphin's long beak full of small pointed teeth, and a skull shaped to hold the fatty melon that today's dolphins use to send out clicks, so it could probably find fish by echo. Its fossils weather out of Calvert Cliffs on Chesapeake Bay."},
  saca:{sci:"Sacabambaspis janvieri", ft:.8, desc:"One of the oldest fish known well, from Ordovician seas about 465 million years ago, and one of the goofiest-looking animals ever found: its two little eyes sat right at the front of its head like headlights, above a small jawless mouth fixed open in a permanent look of surprise. It had no fins except its tail, a body armored in bony plates, and it probably sucked food off the sea floor. It's named after Sacabamba in Bolivia, where it was found."},
  ptry:{sci:"Pterygotus lanarkensis", ft:5.2, desc:"A sea scorpion, and the biggest of its kind grew as long as a person is tall, among the largest arthropods that ever lived. It hunted the shallow seas of the Silurian and Devonian with a pair of long, toothed claws held out in front of its head, steered with a flat tail fin and spotted prey with big forward-facing eyes. Sea scorpions are distant relatives of today's scorpions and horseshoe crabs."},
  anom:{sci:"Anomalocaris canadensis", ft:1.6, desc:"The biggest hunter of the Cambrian seas, about two feet long, at a time when most animals were the size of a finger. It swam by rippling the flaps along its sides, grabbed prey with two spiny arms in front of its face, and had a round mouth of plates. Its pieces were found separately at first and named as a shrimp, a jellyfish and a sponge before anyone saw they were one animal."},
  opab:{sci:"Opabinia regalis", ft:.25, desc:"One of the oddest animals ever found: five stalked eyes on its head and a long flexible nozzle with a claw on the end, which it used to pass food back to its mouth. When it was first shown at a scientific meeting in 1972, the audience laughed. It lived on the sea floor of the Cambrian and is known only from the Burgess Shale."},
  olen:{sci:"Olenoides serratus", ft:.3, desc:"A trilobite, one of the hard-shelled sea arthropods that crawled the ocean floor for nearly 300 million years. Olenoides is one of the few whose legs and antennae are preserved, in the Burgess Shale, so we know it walked on spiny legs and had a pair of feelers at the tail end too. It hunted and scavenged small animals in the mud."},
  both:{sci:"Bothriolepis canadensis", ft:1, desc:"A small armored fish from the Late Devonian, its front half boxed in bony plates like a little tank. Instead of front fins it had two jointed, armored arms, and its eyes sat close together on top of its head. It grazed on the bottom of lakes and coastal waters, and its fossils have been found on every continent."},
  stet:{sci:"Stethacanthus altonensis", ft:2.5, desc:"A small early shark with a strange crest on its back, flat-topped like an ironing board and covered in tiny tooth-like scales, with more of them on top of its head. Only the males had it, so it was probably for showing off. It swam in the shallow seas of the Carboniferous."},
  prom:{sci:"Promicroceras planicosta", ft:.1, desc:"A small ammonite, a relative of squid and octopus that lived in a coiled shell, swimming by squirting water and staying afloat with gas in the shell's chambers. Its shells, packed together in limestone, are the famous \"Marston Marble\" of Somerset, and they turn up on the beaches of Lyme Regis."},
  mibr:{sci:"Microbrachis pelikani", ft:.5, desc:"A tiny, snake-shaped amphibian with a long body, a small head and four little legs, no longer than a hand. Thousands of its fossils have been found in the coal swamps of what is now the Czech Republic, many of them showing feathery gills, so it lived its life in the water. It hunted tiny animals in the pools of the Carboniferous forest."},
  hylo:{sci:"Hylonomus lyelli", ft:.7, desc:"One of the oldest known reptiles, from about 312 million years ago. Its fossils were found inside the hollow stumps of giant club moss trees at Joggins, Nova Scotia, where it and other small animals fell in and could not climb out. It looked like a small lizard and ate millipedes and insects. As an early reptile it could lay eggs on dry land, so it was free of the water."},
  arth:{sci:"Arthropleura armata", ft:8, desc:"The biggest land invertebrate that ever lived: a millipede relative up to about 8 feet long. It crawled over the forest floor of Carboniferous Europe and North America, and its trackways are still preserved in stone. It probably ate rotting plants and fallen debris. Scientists think the high oxygen in the air then let bugs grow this big."},
  pulm:{sci:"Pulmonoscorpius kirktonensis", ft:2.3, desc:"A scorpion about as long as a person's arm, among the largest ever found. Its fossils come from East Kirkton in Scotland, around 330 million years ago, where volcanic hot springs were surrounded by forest. It stalked insects and small animals on the ground and stung them with its tail."},
  mega:{sci:"Meganeura monyi", ft:1, desc:"A giant relative of dragonflies with a wingspan of around two feet, one of the largest flying insects ever. Its fossils come from Commentry in France. It was not a true dragonfly but an older cousin, and it probably snatched other insects out of the air the way dragonflies do today. Few things could hunt it, since there were no flying birds or bats yet."},
  dcau:{sci:"Diplocaulus magnicornis", ft:3, desc:"An amphibian with a head shaped like a boomerang. Its flat body was about three feet long, and the horns on its skull grew wider as it got older. It lived on the bottom of streams and pools, and the wing-shaped head may have helped it steer in the current or made it hard for predators to swallow. Its fossils are common in Texas and Oklahoma."},
  eryo:{sci:"Eryops megacephalus", ft:6.5, desc:"A heavy, short-legged amphibian with a huge head, among the biggest land predators of its time. Its strong backbone and stout limbs could carry its weight on land, but it stayed close to rivers and swamps. It ate fish and other amphibians, and its fossils turn up across Texas, Oklahoma and New Mexico."},
  diic:{sci:"Diictodon feliceps", ft:1.5, desc:"A small, stout plant-eater that dug. Diictodon lived in Late Permian South Africa and tunneled into the ground in corkscrew shapes, and fossil skeletons have been found curled up inside those burrows, sometimes in pairs. Males had a pair of short tusks. It was a dicynodont, part of a group of beaked, tusked plant-eaters that were common in the Permian."},
  lyst:{sci:"Lystrosaurus murrayi", ft:3, desc:"A pig-sized, tusked plant-eater with a beak, and one of the great survivors. It lived through the end-Permian extinction, the worst mass extinction ever, and spread across the world in the time after it. Its fossils turn up in South Africa, India and Antarctica, which helped show that those lands were once joined together."},
  seym:{sci:"Seymouria baylorensis", ft:2, desc:"A land-living animal that mixed amphibian and reptile features. Its skeleton looked so much like a reptile's that it was once thought to be an early one, but it was an amphibian relative that spent its life near the water. It is named for Seymour, Texas, where it was first found in Early Permian rock."},
  plhy:{sci:"Platyhystrix rugosus", ft:3, desc:"A heavy amphibian with a low sail down its back, held up by tall spines. Its name means flat porcupine. Nobody is sure what the sail was for: it could have warmed or cooled the body, or it could have been for show. Its fossils come from Texas and New Mexico."},
  mosc:{sci:"Moschops capensis", ft:9, desc:"A big, barrel-bodied plant-eater from Middle Permian South Africa, with a skull roof thicker than any other animal of its time. Some scientists think it butted heads with rivals, though others are not sure. Its name means calf face. Moschops was a therapsid, so it was a distant relative of mammals."},
  scut:{sci:"Scutosaurus karpinskii", ft:8, desc:"A heavily built plant-eater covered in bony plates and spikes, with knobs and horns on its skull. Scutosaurus was a pareiasaur, a group of armored reptiles of the Late Permian, and its fossils come from Russia. Its name means shield lizard. Inostrancevia lived alongside it and is thought to have hunted it."},
  este:{sci:"Estemmenosuchus uralensis", ft:13, desc:"A big dinocephalian, a group of strange early relatives of mammals, from Middle Permian Russia. Its skull bore bony horns and knobs, and its mouth held both sharp front teeth and tusk-like canines. It lived near water, and scientists have long argued over whether it ate plants, meat or both. Its name means crowned crocodile."},
  coty:{sci:"Cotylorhynchus romeri", ft:15, desc:"A huge, barrel-chested plant-eater with a tiny head and a heavy body full of gut for digesting leaves. It was a caseid, an odd group of early relatives of mammals, and the largest land animals of the Early Permian. Its fossils come from Oklahoma and Texas. The biggest species of its kind grew longer than a pickup truck."},
  ante:{sci:"Anteosaurus magnificus", ft:16, desc:"The top predator of Middle Permian South Africa, a dinocephalian with a long skull, big canines and thick bone over its brow. It was one of the largest meat-eaters of its time, perhaps weighing as much as a ton. Anteosaurus was a therapsid, so it was a distant relative of mammals, not a dinosaur."},
  inos:{sci:"Inostrancevia alexandri", ft:11, desc:"A gorgonopsian, a saber-toothed relative of mammals, and the biggest of its kind. Its canines were about six inches long. Inostrancevia hunted in Late Permian Russia, where its fossils are found alongside those of the armored Scutosaurus, and it ruled the land just before the end-Permian extinction wiped out its whole group."},
  prio:{sci:"Prionosuchus plummeri", ft:30, desc:"A giant amphibian shaped like a gharial, with a long, narrow snout full of small teeth, for catching fish. Estimates put it near 30 feet long, which would make it one of the biggest amphibians ever, though only parts of its skeleton are known. It lived in rivers of Early Permian Brazil."},
  sile:{sci:"Silesaurus opolensis", ft:6.5, desc:"A slim, long-legged animal that was a close cousin of the dinosaurs rather than a true dinosaur. It had a toothless beak at the tip of its jaw and probably ate plants, insects and small animals. Its fossils come from Late Triassic Poland, and show that animals close to the dinosaurs were already running around before they took over."},
  shar:{sci:"Sharovipteryx mirabilis", ft:.7, desc:"A tiny glider with a strange wing: a skin membrane stretched between its long hind legs, with its front legs left free. It lived in Triassic Kyrgyzstan around lakes full of insects. It is named for the Russian scientist Alexander Sharov, who studied Triassic insects and flying reptiles."},
  long:{sci:"Longisquama insignis", ft:.5, desc:"A small lizard-like animal with a row of long, stiff plumes rising from its back. They were not feathers but long, stretched scales. Scientists still argue about whether they were used for display, for gliding, or for something else. Its best fossil comes from Triassic Kyrgyzstan."},
  gigt:{sci:"Gigatitan vulgaris", ft:1, desc:"A huge insect from Triassic Central Asia, related to crickets and grasshoppers, and one of the largest bugs of its time. It had strong jaws and probably hunted other insects. Few fossils of it survive, mostly just wings."},
  herr:{sci:"Herrerasaurus ischigualastensis", ft:13, desc:"One of the earliest known dinosaurs, a fast two-legged hunter with sharp curved teeth and a long tail. It lived in Late Triassic Argentina about 231 million years ago, in a valley full of early dinosaurs. It is named for Victorino Herrera, the goat herder who found its first fossils in 1959."},
  desm:{sci:"Desmatosuchus spurensis", ft:15, desc:"An aetosaur, an armored crocodile relative, with long spikes jutting from its shoulders. It had a snout shaped like a shovel for rooting in the ground for roots and plants. Its fossils come from Late Triassic Texas. The plates down its back and sides would have made it a hard meal for any hunter."},
  post:{sci:"Postosuchus kirkpatricki", ft:13, desc:"A big hunter of Late Triassic North America, and a relative of crocodiles rather than of dinosaurs. It had a deep skull with sharp, curved teeth. Postosuchus was a top predator before the dinosaurs took over. Its fossils come from Texas and North Carolina."},
  eryt:{sci:"Erythrosuchus africanus", ft:15, desc:"A huge, heavy hunter from the Early Triassic of South Africa, with a head about three feet long, one of the largest of any land hunter of its time. It lived in the recovery after the end-Permian extinction. Its name means red crocodile, though it was not a true crocodile."},
  liso:{sci:"Lisowicia bojani", ft:15, desc:"A giant plant-eater from Late Triassic Poland, the largest known land animal of the whole Mesozoic that was not a dinosaur. It was a dicynodont, but it stood with straight, upright legs like an elephant's, and it may have weighed several tons. It was only described in 2018, from fossils found in a clay pit near Lisowice."},
  dime:{sci:"Dimetrodon grandis", ft:11, desc:"Not a dinosaur, and older than the first dinosaurs by about 40 million years. Dimetrodon was a synapsid, so it is a closer relative of mammals than of any reptile. Its tall sail may have helped it warm up in the morning sun or show off to mates. It was the top predator of Early Permian Texas."},
  coel:{sci:"Coelophysis bauri", ft:10, desc:"A light, fast hunter of Late Triassic North America. A New Mexico quarry holds hundreds of them, probably caught together by a flash flood. It ran on two legs, had a long neck and tail, and ate small animals and fish. It was among the earliest dinosaurs."},
  plat:{sci:"Plateosaurus engelhardti", ft:26, desc:"A big plant-eater of Late Triassic Europe, and one of the first dinosaurs to grow so large. Its long neck reached high leaves, and it could probably rear up on its hind legs to get at more. Over a hundred skeletons are known, many from the German site of Trossingen."},
  hete:{sci:"Heterodontosaurus tucki", ft:4, desc:"A small, fast plant-eater from Early Jurassic South Africa with three kinds of teeth, including a pair of tusk-like canines in its jaws. Its name means different-toothed lizard. The tusks may have been used for display or for fighting rivals. It could run on two legs, and it may have had a coat of simple, bristle-like feathers."},
  anch:{sci:"Anchiornis huxleyi", ft:1, desc:"A crow-sized feathered dinosaur with long feathers on both its arms and its legs, so it looked like it had four wings. It lived in Late Jurassic China, and its fossils are so well preserved that scientists could work out its colors: a gray body, white wings tipped with black, and a red-brown crest on its head. It is one of the oldest known feathered dinosaurs."},
  comp:{sci:"Compsognathus longipes", ft:3, desc:"A tiny hunter about the size of a turkey, from Late Jurassic Germany and France. One fossil has the bones of a small lizard inside its ribs, which shows what it ate. For a long time it was among the smallest dinosaurs known. It ran fast on two long legs and snapped up lizards and insects."},
  orni:{sci:"Ornitholestes hermanni", ft:6.5, desc:"A light, long-tailed hunter from Late Jurassic North America. Its name means bird robber, because its first describer thought it caught early birds with its long fingers, but it more likely ate lizards and small mammals. It lived in the same forests and floodplains as Allosaurus and the giant plant-eaters."},
  yiqi:{sci:"Yi qi", ft:2, desc:"A small feathered dinosaur with a bat-like wing: a skin membrane stretched between its long fingers and a rod-shaped bone on its wrist. Its name means strange wing in Mandarin. It lived in Late Jurassic China and probably climbed and glided among the trees, which means dinosaurs tried flying in more than one way."},
  arch:{sci:"Archaeopteryx lithographica", ft:1.5, desc:"The famous first bird, or very nearly: it had feathered wings like a bird, but also teeth, clawed fingers and a long bony tail like a small dinosaur. Its first skeleton was found in the fine limestone of Solnhofen, Germany, in 1861, just two years after Darwin published his book on evolution. It lived about 150 million years ago."},
  dryo:{sci:"Dryosaurus altus", ft:10, desc:"A slim, long-legged plant-eater built for running away. Dryosaurus lived in Late Jurassic North America and East Africa, and it could sprint on two legs to escape Allosaurus. It chewed tough plants with a beak and cheek teeth. Its name means oak lizard."},
  dimo:{sci:"Dimorphodon macronyx", ft:3.5, desc:"An early pterosaur with a big head, like a puffin's, and two kinds of teeth, which is where its name comes from. It lived in Early Jurassic England, and the first skeleton was found by Mary Anning at Lyme Regis in 1828. It had a wingspan of about four and a half feet, and it may have been a weak flier."},
  scel:{sci:"Scelidosaurus harrisonii", ft:13, desc:"One of the earliest armored dinosaurs, from Early Jurassic England. Rows of bony studs ran along its back, sides and tail, and it walked on four legs eating low plants. It was an early relative of both stegosaurs and ankylosaurs. A nearly whole skeleton was dug out of the cliffs at Charmouth, Dorset."},
  dilo:{sci:"Dilophosaurus wetherilli", ft:20, desc:"A big hunter of Early Jurassic Arizona with two thin crests on top of its skull, which gives it its name, two-crested lizard. The crests were too thin to fight with, so they were probably for show. The neck frill and the spitting venom it had in the movies were invented for them, and no fossil shows either one."},
  kent:{sci:"Kentrosaurus aethiopicus", ft:15, desc:"A stegosaur from Late Jurassic Tanzania. Narrow plates ran along its neck and back, which turned into long spikes over its hips and tail, and it had a spike sticking out from each shoulder. Its name means prickly lizard. German expeditions dug up more than a thousand of its bones at Tendaguru between 1909 and 1913."},
  steg:{sci:"Stegosaurus stenops", ft:30, desc:"The best-known plated dinosaur, from Late Jurassic North America. The big plates on its back may have been for show and for controlling its body heat. Four spikes on its tail, nicknamed the thagomizer, were a weapon against Allosaurus. Despite its size, its brain was small, about the size of a lime."},
  cryo:{sci:"Cryolophosaurus ellioti", ft:21, desc:"A hunter from Early Jurassic Antarctica, found in 1990 high in the Transantarctic Mountains, when the continent was still warm and forested. It had a ridged crest across its forehead, shaped something like a fan or a quiff, and has been nicknamed Elvisaurus. Its name means cold crested lizard."},
  cera:{sci:"Ceratosaurus nasicornis", ft:20, desc:"A hunter from Late Jurassic North America with a horn on its nose, smaller ridges over its eyes, and a row of bony plates down its back. It had very large teeth for its size. Ceratosaurus lived alongside Allosaurus and Stegosaurus, and it may have hunted fish and other animals around the water."},
  mgal:{sci:"Megalosaurus bucklandii", ft:22, desc:"The first dinosaur ever given a scientific name, in 1824 by William Buckland, from bones found in the slate quarries of Oxfordshire, England. It was a big, heavy hunter from the Middle Jurassic. The word dinosaur did not exist yet, and its bones were first thought to belong to giants or to some huge lizard."},
  allo:{sci:"Allosaurus fragilis", ft:28, desc:"The top predator of Late Jurassic North America, with a big skull, serrated teeth and strong clawed hands. It lived in the same landscape as Stegosaurus and the giant sauropods. At the Cleveland-Lloyd quarry in Utah, the bones of more than 45 of them were found together. Its name means different lizard."},
  cama:{sci:"Camarasaurus lentus", ft:50, desc:"The most common big sauropod in Late Jurassic North America. Compared with other sauropods, Camarasaurus had a short, blunt head and spoon-shaped teeth that could crop tough plants. Its name means chambered lizard, after the hollow spaces inside its backbones that kept its huge frame lighter."},
  torv:{sci:"Torvosaurus tanneri", ft:33, desc:"One of the biggest meat-eating dinosaurs of the Jurassic, with a heavy skull, strong arms with large claws, and teeth up to a hand's length. Its fossils come from Late Jurassic Colorado, Utah and Portugal. Its name means savage lizard. It probably hunted the big plant-eaters of its time."},
  apat:{sci:"Apatosaurus ajax", ft:75, desc:"A huge, heavily built sauropod from Late Jurassic North America. Its name means deceptive lizard. It was once called Brontosaurus, which was dropped as a duplicate, and for decades museums put the wrong skull on its skeleton. Scientists now think Brontosaurus may be a separate kind after all."},
  dipl:{sci:"Diplodocus carnegii", ft:85, desc:"One of the longest dinosaurs, with a whip-like tail and a long, slim neck, from Late Jurassic North America. It combed leaves off plants with its pencil-like teeth. In the early 1900s, the steel magnate Andrew Carnegie paid for plaster casts of its skeleton to be sent to museums across the world."},
  brac:{sci:"Brachiosaurus altithorax", ft:72, desc:"A giraffe-shaped sauropod from Late Jurassic North America, with front legs longer than its back legs, so it stood with its neck high. It could feed from the tops of tall trees. Its name means arm lizard. It lived alongside Diplodocus, but fed higher up."},
  scan:{sci:"Scansoriopteryx heilmanni", ft:1, desc:"A tiny, feathered dinosaur about the size of a sparrow, from the Jurassic of China. It had a very long third finger, which it may have used to probe for grubs under bark, and it probably lived in trees. Its name means climbing wing."},
  hyps:{sci:"Hypsilophodon foxii", ft:6, desc:"A small, quick plant-eater, from Early Cretaceous England. It was once pictured living in trees, but its feet were built for running on the ground, and it probably dashed away from hunters in herds. Hundreds of its bones were found on the Isle of Wight."},
  beel:{sci:"Beelzebufo ampinga", ft:1.3, desc:"A giant frog from Late Cretaceous Madagascar, as big as a beach ball, with a huge mouth and bony armor on its back. Its name means devil toad. It was an ambush hunter that probably swallowed insects, lizards and anything else small enough to fit."},
  mono:{sci:"Mononykus olecranus", ft:3, desc:"A strange, slender, long-legged dinosaur from Late Cretaceous Mongolia with very short arms that each ended in one big, thick claw. Its name means one claw. The claws were probably used to rip open insect nests and logs. It was probably a fast runner and ate ants and termites."},
  mcer:{sci:"Microceratus gobiensis", ft:2, desc:"One of the smallest horned dinosaurs, a plant-eater about the size of a cat, from Late Cretaceous Mongolia. It had a small frill and no horns, and it could run on its hind legs. Triceratops and its giant kin came from tiny ancestors like this one."},
  micr:{sci:"Microraptor gui", ft:3, desc:"A small feathered hunter from Early Cretaceous China with long feathers on its arms and on its legs, giving it four wings. It could probably glide from tree to tree. Its feathers shone with a blue-black gloss, like a crow's, and one fossil has a fish in its stomach."},
  psit:{sci:"Psittacosaurus mongoliensis", ft:6.5, desc:"A plant-eater with a beak like a parrot's, which gives it its name, parrot lizard. It lived in Early Cretaceous Asia. One fossil shows an adult with about 30 young, and some have bristles on the tail. It was one of the earliest horned dinosaurs, but it had no horns."},
  prot:{sci:"Protoceratops andrewsi", ft:6, desc:"A sheep-sized relative of Triceratops from Late Cretaceous Mongolia. It had a beak and a bony frill, but no horns. Its skeleton was found locked in battle with a Velociraptor in 1971, in the Fighting Dinosaurs fossil. Hundreds of skeletons of every age show how it grew up."},
  ornm:{sci:"Ornithomimus edmontonicus", ft:11, desc:"An ostrich-like dinosaur from Late Cretaceous North America, with long legs, a toothless beak and a light body. It was probably one of the fastest dinosaurs. Its name means bird mimic. Some fossils show it had feathers on its arms."},
  kool:{sci:"Koolasuchus cleelandi", ft:10, desc:"A giant amphibian from Early Cretaceous Australia, which was then inside the polar circle. It was the last of its kind, long after other big amphibians had disappeared. It probably survived because its icy rivers were too cold for crocodiles. It is named for Lesley Kool, who helped dig up its fossils."},
  simo:{sci:"Simosuchus clarki", ft:2.5, desc:"A short, stubby crocodile relative from Late Cretaceous Madagascar with a pug nose, leaf-shaped teeth and armor on its back. Unlike most crocodiles it probably ate plants. Its name means snub-nosed crocodile."},
  ovir:{sci:"Oviraptor philoceratops", ft:5, desc:"A beaked, feathered dinosaur from Late Cretaceous Mongolia. Its name means egg thief, because the first skeleton was found on a nest of eggs that were thought to be someone else's. Later finds showed the eggs were its own, and that it was sitting on them to keep them warm, like a bird."},
  minm:{sci:"Minmi paravertebra", ft:10, desc:"A small, armored dinosaur from Early Cretaceous Australia, and one of the few armored dinosaurs known from the Southern Hemisphere. Bony studs covered its back and sides, and extra bony struts ran along its backbone. It is named for Minmi Crossing in Queensland, where it was found."},
  gall:{sci:"Gallimimus bullatus", ft:20, desc:"The biggest of the ostrich-like dinosaurs, from Late Cretaceous Mongolia. It ran on long, powerful legs, and its toothless beak fed on plants, small animals and eggs. Its name means chicken mimic. A herd of them stampeded in a famous movie."},
  para:{sci:"Parasaurolophus walkeri", ft:31, desc:"A duck-billed dinosaur from Late Cretaceous North America with a long, curved, hollow crest sweeping back from its head. Air passed through tubes in the crest, so it could make deep, loud calls like a trombone. The herd could use them to call to each other over long distances."},
  pach:{sci:"Pachycephalosaurus wyomingensis", ft:15, desc:"A plant-eater with a thick dome of bone on its skull, up to about 10 inches thick, ringed with small knobs. Its name means thick-headed lizard. It lived in Late Cretaceous North America. Scientists still argue about whether it used its head to butt rivals or just to show off."},
  igua:{sci:"Iguanodon bernissartensis", ft:33, desc:"A big plant-eater from Early Cretaceous Europe with a spike on each thumb. It was one of the first dinosaurs ever described, and its teeth were found in England in the 1820s. At first the spike was put on its nose. In 1878, miners in Bernissart, Belgium, dug up the skeletons of dozens of them."},
  velo:{sci:"Velociraptor mongoliensis", ft:6, desc:"A fast hunter from Late Cretaceous Mongolia with a big curved claw on each foot. It was only the size of a turkey, much smaller than in the movies, and it was covered in feathers. Its fossil was found locked in combat with a Protoceratops, in the Fighting Dinosaurs fossil."},
  pter:{sci:"Pteranodon longiceps", desc:"A big flying reptile with a wingspan of around 18 feet and a long crest on the back of its head. It had no teeth and snatched fish from the sea. It lived in Late Cretaceous North America, over the inland sea that then split the continent in two. It was a pterosaur, not a dinosaur."},
  conc:{sci:"Concavenator corcovatus", ft:20, desc:"A hunter from Early Cretaceous Spain with a tall hump on its back. Its forearm bones also had a row of little bumps that look like attachment points for feathers or quills, which is odd for such a big animal. Its name means Cuenca hunchback."},
  nige:{sci:"Nigersaurus taqueti", ft:30, desc:"A sauropod from Early Cretaceous Niger with a wide, square mouth holding about 500 teeth, which worked like a lawn mower for low plants. It held its head down near the ground. Its teeth wore out so quickly that they were probably replaced every few weeks."},
  utah:{sci:"Utahraptor ostrommaysorum", ft:20, desc:"The biggest of the raptors, a feathered hunter from Early Cretaceous Utah. Its sickle claw on each foot was about 9 inches long. It was bigger and heavier than a lion, and probably hunted the plant-eaters of its time, perhaps in packs. Its name means Utah thief."},
  styr:{sci:"Styracosaurus albertensis", ft:18, desc:"A horned dinosaur from Late Cretaceous Alberta, with a big horn on its nose and a frill ringed with six long spikes. Its name means spiked lizard. The frill and horns may have helped it recognize its own kind and fight rivals, as well as scare off hunters."},
  bary:{sci:"Baryonyx walkeri", ft:30, desc:"A fish-eating dinosaur with a long, narrow snout like a crocodile's and a huge claw on each thumb. Its name means heavy claw. It was found in a clay pit in Surrey, England, in 1983, with fish scales in its stomach. It lived in Early Cretaceous Europe."},
  ther:{sci:"Therizinosaurus cheloniformis", ft:30, desc:"A strange plant-eater from Late Cretaceous Mongolia with enormous claws on its hands, up to about three feet long. They were probably used to pull down branches, not to kill. Its first claws were found alone, and it was mistaken for a giant turtle. Its name means scythe lizard."},
  dsuc:{sci:"Deinosuchus riograndensis", ft:33, desc:"A giant alligator relative from Late Cretaceous North America, as long as a bus. Its name means terrible crocodile. It lay in wait at the water's edge, and bite marks on dinosaur bones show it attacked them. It lived about 80 million years ago, long before today's alligators."},
  yutt:{sci:"Yutyrannus huali", ft:30, desc:"A feathered tyrant. This big relative of T. rex from Early Cretaceous China was covered in long, shaggy feathers up to about six inches long, which probably kept it warm in a cool climate. Its name means beautiful feathered tyrant."},
  anky:{sci:"Ankylosaurus magniventris", ft:20, desc:"A tank of a dinosaur, with bony plates over its back, spikes along its sides and a heavy club of bone on the end of its tail. The club could probably break the bones of a hunter. It lived in Late Cretaceous North America, among the last dinosaurs. Its name means fused lizard."},
  tric:{sci:"Triceratops horridus", ft:30, desc:"The three-horned giant of Late Cretaceous North America, with a skull up to about eight feet long, one of the largest of any land animal. It had a horn over each eye and one on its nose, behind a solid bony frill. It lived alongside Tyrannosaurus rex, among the very last dinosaurs."},
  cnot:{sci:"Carnotaurus sastrei", ft:25, desc:"A hunter from Late Cretaceous Argentina with two thick horns over its eyes, and arms so tiny they were almost useless. Its name means meat-eating bull. It had a short, deep skull and was probably built for speed, with long, strong legs."},
  dche:{sci:"Deinocheirus mirificus", ft:36, desc:"A giant, humpbacked dinosaur from Late Cretaceous Mongolia with a duck-like bill and long arms. For about 50 years, only its arms and shoulders were known. The whole skeleton turned up in 2013 and showed it ate fish as well as plants. Its name means horrible hand."},
  quet:{sci:"Quetzalcoatlus northropi", desc:"One of the largest flying animals ever, a pterosaur with a wingspan of about 35 feet, as wide as a small airplane. It stood as tall as a giraffe on the ground. It lived in Late Cretaceous Texas, and probably stalked small animals on land. It is named for Quetzalcoatl, the feathered serpent god of the Aztecs."},
  pata:{sci:"Patagotitan mayorum", ft:122, desc:"One of the largest animals that ever walked on land, a sauropod from Late Cretaceous Argentina about as long as three buses and as heavy as a dozen elephants. Its bones were found in Patagonia and described in 2017. It is named for Patagonia and for the Titans of Greek myth."},
  carc:{sci:"Carcharodontosaurus saharicus", ft:40, desc:"A giant hunter from Late Cretaceous North Africa, with a long skull and blade-like teeth that look like a great white shark's, which gives it its name, shark-toothed lizard. It lived in the same area as Spinosaurus, and as one of the biggest meat-eaters of all time, it competed with it."},
  trex:{sci:"Tyrannosaurus rex", ft:40, desc:"The best-known meat-eater of all, from Late Cretaceous North America, about 68 to 66 million years ago. Its bite was among the strongest of any land animal. It had huge, banana-sized teeth, a big sense of smell, and tiny two-fingered arms. Its name means tyrant lizard king."},
  spin:{sci:"Spinosaurus aegyptiacus", ft:46, desc:"The longest meat-eating dinosaur known, with a tall sail on its back and a long, crocodile-like snout. It lived in Late Cretaceous North Africa, hunting fish in rivers, and had a paddle-shaped tail for swimming. Its first skeleton was destroyed in the bombing of Munich in 1944."},
  ples:{sci:"Plesiadapis tricuspidens", ft:2, desc:"A squirrel-like relative of the primates, from Paleocene North America and Europe. It had claws instead of the flat nails of true primates, eyes on the sides of its head, and big front teeth like a rodent's. It lived in forests soon after the dinosaurs died out, and shows what our early cousins looked like."},
  paki:{sci:"Pakicetus attocki", ft:6, desc:"One of the first whales, and it lived on land. About 50 million years ago, in what is now Pakistan, Pakicetus waded in streams hunting fish. It looked like a long-legged, wolf-sized animal with a long snout, but the bones of its ear are shaped like a whale's, which is what tied it to them."},
  lept:{sci:"Leptictidium auderiense", ft:3, desc:"A small insect-eater of Eocene Germany that ran on its hind legs, balancing with a long tail, like a tiny kangaroo. Its fossils come from the Messel Pit, where animals were preserved so well that the outlines of their fur and their last meals can still be seen. It had a long, pointed snout."},
  sifr:{sci:"Sifrhippus sandrae", ft:2, desc:"One of the earliest horses, about the size of a small dog, with four toes on its front feet and three on its back feet. It lived in Eocene Wyoming. During a brief period of global warming, it shrank by about a third, which is one of the best examples we have of animals changing size with the climate."},
  ptil:{sci:"Ptilodus montanus", ft:1.3, desc:"A squirrel-like mammal from Paleocene North America with a long tail that could grasp branches and sharp, ridged back teeth for gnawing and crushing. It was a multituberculate, a group of rodent-like mammals that lived alongside the dinosaurs and outlasted them by millions of years."},
  miac:{sci:"Miacis parvivorus", ft:1.5, desc:"A slim, tree-climbing hunter like a marten, from Eocene North America. It was one of the first members of the group that would split into dogs, cats, bears and seals. It had a long body, short legs and the shearing back teeth of a meat-eater."},
  waim:{sci:"Waimanu manneringi", ft:3, desc:"One of the oldest known penguins, from Paleocene New Zealand, about 60 million years ago, just a few million years after the dinosaurs died out. It could not fly. It swam with its wings, but it still had a long beak and legs, and it was not as upright as modern penguins. Its name means waterbird in Maori."},
  tmyr:{sci:"Titanomyrma gigantea", ft:.2, desc:"A giant ant, whose queens were about two inches long and had a wingspan of around six inches, as big as a small hummingbird. It lived in the warm forests of Eocene North America and Europe, and its fossils come from places like Wyoming and Germany. It is one of the largest ants ever found."},
  hyae:{sci:"Hyaenodon horridus", ft:5, desc:"A meat-eating mammal with a big head and powerful jaws that lived for millions of years across the Northern Hemisphere. Despite its name, it was not a hyena or related to one. It chased down prey and crushed bones with its back teeth. Its fossils are common in the badlands of North America."},
  ambu:{sci:"Ambulocetus natans", ft:10, desc:"A walking whale, about 49 million years ago in what is now Pakistan. It had short legs with big paws and a long, crocodile-like body, and it ambushed prey from the water and the shore. It was found in 1994, and its name means walking, swimming whale."},
  uint:{sci:"Uintatherium anceps", ft:11, desc:"A rhino-sized plant-eater from Eocene North America with six bony knobs on its skull and a pair of long saber-like canines. For all its size, its brain was tiny. It was not related to rhinos, and it died out as the climate cooled. It is named for the Uinta Mountains of Utah."},
  andr:{sci:"Andrewsarchus mongoliensis", ft:12, desc:"A huge predator or scavenger of Eocene Mongolia, known from one skull about three feet long, found in 1923 on an expedition led by Roy Chapman Andrews. Its body has never been found, so its size is a guess. It was not related to the dogs or bears it resembles, but to hoofed animals and whales."},
  bari:{sci:"Barinasuchus arveloi", ft:20, desc:"A huge land-living crocodile relative from what is now Venezuela. Unlike crocodiles that lie in wait in water, it had a deep, narrow skull with blade-like teeth for slicing, and it probably hunted on dry land. It was one of the largest meat-eaters in its part of the world."},
  arsi:{sci:"Arsinoitherium zitteli", ft:11, desc:"A rhino-like plant-eater from Egypt with two huge bony horns on its nose, side by side, and a pair of small ones above its eyes. It was not related to rhinos but to elephants and hyraxes. It lived in the forests and swamps of Eocene and Oligocene Africa. Its name honors the Egyptian queen Arsinoe."},
  tita:{sci:"Titanoboa cerrejonensis", ft:42, desc:"The biggest snake known, a boa about 40 feet long, from Paleocene Colombia, roughly 60 million years ago. Its fossils were found in a coal mine in 2009. A snake this size needed a hot climate, so it shows how warm the tropics were then. It hunted large fish and crocodile relatives."},
  pcer:{sci:"Paraceratherium transouralicum", ft:24, desc:"The biggest land mammal ever known, a hornless relative of rhinos from Oligocene Asia. It stood about 16 feet at the shoulder and may have weighed as much as 15 tons. It browsed the leaves of tall trees. It is also known by the older name Baluchitherium."},
  dino:{sci:"Dinopithecus ingens", ft:4, desc:"A giant baboon-like monkey from South Africa, much bigger than any baboon alive today, about as large as a big dog, with a long, heavy muzzle. Its name means terrible ape. It lived on the ground in open country and ate a mix of plants and small animals."},
  daeo:{sci:"Daeodon shoshonensis", ft:11, desc:"A giant, pig-like omnivore from Miocene North America, nicknamed the hell pig. It stood about as tall as a person at the shoulder, had a huge head with bony knobs on its cheeks, and crushing teeth. It ate nearly anything, plants and meat alike. It was an entelodont, a cousin of pigs and hippos."},
  aepy:{sci:"Aepycamelus major", ft:8, desc:"A giraffe-like camel from Miocene North America that stood around ten feet tall, with very long legs and a long neck for browsing high leaves, like a giraffe does today. It lived on the plains of North America."},
  chal:{sci:"Chalicotherium goldfussi", ft:8, desc:"A strange, horse-headed plant-eater with long, hooked claws on its front feet instead of hooves, and front legs longer than its back legs, so it had a sloping back like a gorilla. It probably walked on its knuckles. It used the claws to pull down branches to eat leaves. It lived in Miocene Europe and Asia."},
  kele:{sci:"Kelenken guillermoi", ft:10, desc:"A giant flightless terror bird from Miocene Argentina. It stood about ten feet tall and had the largest bird skull ever found, over two feet long, ending in a hooked beak. It ran down prey on long, fast legs."},
  mchl:{sci:"Megalochelys atlas", ft:8, desc:"The biggest tortoise known, with a shell about eight feet long, from the Siwalik Hills of Miocene to Pleistocene India. It may have weighed a ton. It grazed on plants and had few enemies. It was the same kind of animal as a Galapagos tortoise, but many times larger."},
  drom:{sci:"Dromornis stirtoni", ft:10, desc:"A giant, flightless bird of Late Miocene Australia, about ten feet tall. It was a relative of ducks and geese, not of ostriches. Scientists still argue about whether it ate plants or meat. Its fossils come from Alcoota, in central Australia, where the climate was wetter then."},
  plty:{sci:"Platybelodon grangeri", ft:12, desc:"An elephant relative with a pair of flat lower tusks that formed a shovel, which gives it its name, flat spear. It scooped up plants and stripped bark with them. It lived in Miocene Asia and Africa, in the woods near rivers and wetlands."},
  amph:{sci:"Amphicyon major", ft:8, desc:"A big bear-dog from Miocene Europe. It had a long body, a thick tail and a heavy head with strong teeth, and was neither a bear nor a dog but an early relative of both. It was a powerful predator and scavenger, and it was about as big and heavy as a lion."},
  siva:{sci:"Sivatherium giganteum", ft:11, desc:"A giant relative of the giraffe, as heavy as a rhino, with a thick neck, short legs and two pairs of horns on its head, one pair a broad antler-like set on top. It lived in Miocene and Pleistocene India and Africa, and is the largest giraffe relative known."},
  dgal:{sci:"Deinogalerix koenigswaldi", ft:2, desc:"A giant hedgehog-like animal from Miocene Italy, with a skull around eight inches long. It lived on islands, where animals often grow into odd shapes. It had a long snout and sharp teeth, and ate insects and small animals. Its name means terrible hedgehog."},
  nura:{sci:"Nuralagus rex", ft:3, desc:"A giant rabbit, about 12 kilograms, from Pliocene Menorca, around three times the size of a rabbit today. On its island, it had few enemies and little to run from, so it had small ears, small eyes and a stiff back, and probably could not hop. Its name means king of the rabbits."},
  hopl:{sci:"Hoplitomeryx matthei", ft:4, desc:"A small deer-like animal from Miocene Italy with five horns: one on its nose and two pairs above its eyes. It also had big upper canines. It lived on an island, cut off from its relatives, where animals evolved in odd ways."},
  psil:{sci:"Psilopterus lemoinei", ft:3, desc:"A small terror bird about two and a half feet tall, from Miocene Argentina. It could not fly, but it was quick on its long legs and hunted small animals. It was among the smallest of the terror birds, a group that included killers ten feet tall."},
  proc:{sci:"Proconsul africanus", ft:3, desc:"An early ape from Miocene Kenya, around 20 million years ago. It walked on all fours along tree branches, like a monkey, but had no tail. It ate fruit in the forests. It was named in 1933, after a chimpanzee called Consul that performed in London."},
  arge:{sci:"Argentavis magnificens", desc:"One of the biggest flying birds that ever lived, with a wingspan of about 20 feet, and a relative of vultures from Miocene Argentina. It was too heavy to flap for long, so it soared on rising warm air. It probably ate carcasses and perhaps hunted small animals."},
  ornw:{sci:"Ornimegalonyx oteroi", ft:3.5, desc:"A giant owl from Cuba, standing about three and a half feet tall, with long legs and small wings that probably could not fly. It lived in the last ice age and ran down its prey on the ground, such as the rodents called hutias. It was among the largest owls ever."},
  dodo:{sci:"Raphus cucullatus", ft:3.3, desc:"A flightless bird of Mauritius, a relative of pigeons, standing about three feet tall with a big hooked beak. It had no enemies on its island until sailors arrived in the late 1500s, bringing hunting, rats and pigs. Within about a century, it was gone. The word dodo has meant extinct ever since."},
  ppig:{sci:"Ectopistes migratorius", ft:1.3, desc:"A pigeon that once lived in flocks of billions across eastern North America, so thick they could darken the sky for hours. Hunting and the loss of forests wiped it out in only a few decades. The last one, a female named Martha, died at the Cincinnati Zoo on September 1, 1914."},
  gtod:{sci:"Incilius periglenes", ft:.2, desc:"A small toad, the males a vivid golden orange, that lived in a tiny patch of cloud forest in Monteverde, Costa Rica. It was last seen in 1989. Its fall was probably linked to a warming, drying climate and a skin disease, and it was one of the first amphibians whose loss was tied to climate change."},
  rmlo:{sci:"Melanoplus spretus", ft:.1, desc:"A locust that once swarmed over the American West in numbers that are hard to imagine. One swarm in 1875 was probably over 1,000 miles long. Within about 30 years of its peak, it was extinct, the last live ones seen in 1902. Farming probably wiped out the river valleys where it laid its eggs."},
  sdel:{sci:"Palaeoloxodon falconeri", ft:4, desc:"A dwarf elephant of Sicily and Malta, only about three feet tall at the shoulder as an adult, about the size of a large dog, and a descendant of much bigger straight-tusked elephants. Animals cut off on islands often shrink. Its skull has one big hole in the middle, which may have inspired the legend of the one-eyed Cyclops."},
  dire:{sci:"Aenocyon dirus", ft:5, desc:"A big wolf-like hunter of Ice Age North and South America, stockier than a gray wolf. Thousands of them have been found in the La Brea Tar Pits in Los Angeles, where they were trapped while going after other trapped animals. It died out around 10,000 years ago, along with much of its prey."},
  macr:{sci:"Macrauchenia patachonica", ft:10, desc:"A strange South American hoofed animal with a long neck, three toes on each foot and a body like a camel's. Its nostrils sat high on its skull, so it may have had a short trunk. Charles Darwin found its bones in Patagonia in 1834. It is not related to camels, and it died out about 10,000 years ago."},
  mglo:{sci:"Megaloceros giganteus", ft:8, desc:"The giant deer, sometimes called the Irish elk, though it was neither a true elk nor only from Ireland. A male's antlers could span about 12 feet, the biggest of any deer, and were grown anew each year. It lived across Ice Age Europe and Asia, and died out around 7,000 years ago."},
  arct:{sci:"Arctodus simus", ft:9, desc:"The giant short-faced bear of Ice Age North America, among the biggest meat-eating land mammals ever, standing over ten feet tall on its hind legs. Its long legs made it a fast runner for a bear. It lived about 800,000 to 12,000 years ago, and it probably competed with smaller predators for carcasses."},
  doed:{sci:"Doedicurus clavicaudatus", ft:13, desc:"A giant, armored relative of armadillos, as big as a small car, covered in a bony dome-shaped shell. Its tail ended in a club covered in spikes, which it could swing at predators or rivals. It lived on the grasslands of Ice Age South America, and died out about 10,000 years ago."},
  mgth:{sci:"Megatherium americanum", ft:20, desc:"A giant ground sloth about as big as an elephant, which could rear up on its hind legs and tail to eat leaves from trees, using its long claws to pull down branches. It lived in Ice Age South America. Charles Darwin saw its bones there on the voyage of the Beagle."},
  mlan:{sci:"Varanus priscus", ft:15, desc:"The giant monitor lizard of Ice Age Australia, often called Megalania, the biggest land lizard of the last few million years. It may have reached more than 15 feet long. It hunted large animals, such as the giant marsupials of its time, and died out about 40,000 years ago."},
  smil:{sci:"Smilodon fatalis", ft:6.5, desc:"The saber-toothed cat of Ice Age North and South America, with canines up to about a foot long. It was built stockier than a lion, with powerful front legs to pin down its prey before biting. More than a thousand of them have been found in the La Brea Tar Pits in Los Angeles."},
  mast:{sci:"Mammut americanum", ft:15, desc:"The American mastodon, a stocky, long-haired elephant relative with a low, long body and straight tusks. It browsed on twigs and leaves in the spruce woods of Ice Age North America, where mammoths grazed on grass in the open. Its name means nipple tooth, after the bumps on its molars."},
  colm:{sci:"Mammuthus columbi", ft:16, desc:"The Columbian mammoth, larger than the woolly mammoth, about 13 feet tall at the shoulder with long, curved tusks. It lived in the warmer south of Ice Age North America, grazing in open country, and it had little hair. It died out around 10,000 years ago, and it is the state fossil of South Carolina."},
  elas:{sci:"Elasmotherium sibiricum", ft:15, desc:"A giant rhinoceros of the Ice Age Eurasian steppe, with a single huge horn on its forehead, which may have been very long, so it is called the Siberian unicorn. It grazed on tough grass with huge flat teeth. It was one of the last giant rhinos, and it died out around 40,000 years ago."},
  mamm:{sci:"Mammuthus primigenius", ft:13, desc:"The woolly mammoth, a shaggy, long-tusked elephant built for the Ice Age cold, with long hair, a layer of fat and small ears. It grazed on the northern steppes, and cave artists painted it. Some survived on Wrangel Island, in the Arctic Ocean, until about 4,000 years ago."},
  thyl:{sci:"Thylacoleo carnifex", ft:5, desc:"The marsupial lion of Ice Age Australia, a pouched hunter about the size of a leopard, with a bite among the strongest for its size of any mammal. Its back teeth were blade-like, for slicing. It also had a big, sharp thumb claw. It died out around 40,000 years ago."},
  aind:{sci:"Archaeoindris fontoynontii", ft:5, desc:"A giant lemur from Madagascar, about as big as a gorilla, the largest primate ever known on that island. It was probably slow-moving, and ate leaves. It lived until about 2,000 years ago, and its disappearance came soon after humans arrived and changed the island's forests."},
  gpit:{sci:"Gigantopithecus blacki", ft:9, desc:"The largest ape that ever lived, perhaps close to 10 feet tall and weighing as much as 600 pounds, from Ice Age southern China. We know it only from teeth and jaws, first spotted in a Hong Kong drugstore in 1935, where they were sold as dragon teeth. It died out around 300,000 years ago."},
};
// Share of an exhibit's floor a species wants under water: fish eaters most, animals whose two biomes are both scrubland or desert least
const waterWant = s => s.pool ? POOL.need : s.semi ? HAB.waterSemi : (biomesOf(s) || []).length && biomesOf(s).every(b => ["scrubland", "desert"].includes(b)) ? HAB.waterDry : HAB.waterBase;

// Themes: the look of paths, buildings and exhibits. Each item has an optional `theme` (none means Genesis).
//   path     live and dead surface colors, the edge line, `kerb`: a dashed second color along the edge ({c, dash} in px), and `ruts`: two worn wheel tracks down the path ({c, o: opacity}), and `center`: a thin painted dashed center line ({c, w, dash, o})
//   bld      color a building's own color is blended toward (by `mix`), and its outline
//   accent   the trim color
//   rot      optional decay pattern laid over buildings, stronger on some than others (with `age`, it grows over that many days from when each was built)
//   corners  optional {c, c2}: a small round cap at each corner of a big rectangular roof (upturned eaves seen from above)
//   moss     optional {c: [colors], r}: moss patches in a building's corners, growing with its decay
//   snow     optional {of(type def, type id) -> 0, 1 or 2, tex: [a pattern per level], at: scale}: snow laid over the roof, inset so the eaves still show
//   sod.shade  optional list of gradients (`#g-<id>`) shading small roofs (each building keeps one)
//   ridge    a line's `c` can be a list (each building keeps one)
//   eave     optional {c, w}: a dark band around a building's edge, so its shape reads under a busy roof
//   ridge    optional line(s) {c, w} along a building's ridge (the middle of its long side), drawn in order
//   roofs    optional {of(type def, type id) -> class 0, 1, 2..., btex: [a roof pattern, or a list (each building keeps one), per class], trim: [a list of trim lines per class],
//            brace: {of: [classes], min: square meters, lines: [...]}}: roof and trim by building class, instead of btex/sod and bord.trim. A brace is an X across big rectangular buildings.
//            A trim line's `at` draws it on the outline scaled by that much (1 is the building's edge) instead of the usual inner trim
//            glass: [a skylight spec per class, or null]: {at, n, gap, min}, a block of glass panes (`at` scales it down from the roof, `n` splits it along the long side with `gap` between, `min` is the smallest building area in m²)
//   tier     optional {min, next, at: [scales], light, shadow, drop}: rectangular buildings over `min` square meters get stepped upper stories (one per scale; each more needs `next` times the area)
//   sod      optional {tex, max}: buildings up to `max` square meters get this roof pattern instead of `btex` (a list of patterns: each building keeps one)
//   ptex/btex  optional patterns for paths / buildings and props instead of `tex`
//   tex      the texture pattern (`#t-<id>` in index.html) laid over paths, buildings, the border band and the zone ground
//   gtex     optional pattern for the zone ground instead of `tex`
//   bord     the border drawn just inside an exhibit's fence and around buildings:
//            band (the strip's color under the texture; none means no strip), c/w/dash/cap (main line, px; none means no main line), c2/w2/dash2/cap2 (second line), glow (soft halo)
//            more (extra lines on top, each {c, w, dash, cap, zig: [amp, step] px for a zigzag, knots: dots at the zigzag's corners instead of rails}), trim ({c, w, dash, cap}, or a list drawn in order: the building and prop trim instead of c2), base ({c, w, c2, dash2}: a wider footing under the rail when the exhibit holds a dangerous animal), strong (a whole other border drawn instead for dangerous animals), by ({barrier id: a whole other border} for that fence type)
//   fee      share of an item's price to build it in this theme, or to change an existing one to it
//   fits     species that look right here
//   unlock   how it's earned, and what to tell the player until then (check() runs in checkThemes)
// How warm a building runs, for snow on cold-theme roofs: 0 unheated storage and sheds (buried), 1 most buildings (patchy), 2 heated labs, kitchens, hotels and restrooms (melted)
const SNOW_HEAT = (t, type) => ["oracle", "ghost", "tar", "ceres", "pmc", "generator", "edcenter", "restroom", "breakroom", "greenhouse", "hatchery", "shellfarm"].includes(type) || t.kind === "food" || t.rooms ? 2
  : ["warehouse", "coldstore", "toolshed", "dock", "depot", "closet", "farm", "ranch", "orchard", "station", "diveshack"].includes(type) ? 0 : 1;
const THEMES = {
  genesis: {label:"Default", tex:"genesis", ptex:"genesis-concrete", btex:"genesis-seam",
    blurb:"A conservation campus: forest green metal roofs, pale lab membranes, poured concrete and matte gold trim. Practical, never ornate.",
    // warm gray concrete between dark green curbs
    path:{live:"#D9D4C7", dead:"#BDB8AC", edge:"#1F3D2B"},
    bld:"#1F3D2B", mix:0, edge:"#14281C", accent:"#C9A24B", fee:0, fits:[],
    // roofs by what a building does: 0 public (green standing seam, slim gold ridge cap), 1 labs (pale flat membrane, dark green parapet, rooftop units), 2 utilities and power (dark slate)
    // every roof gets a thin matte gold edge line. Gold is only ever a line or a dot.
    roofs:{of:(t, type) => ["oracle", "ghost", "tar", "ceres", "pmc"].includes(type) ? 1
        : ["generator", "depot", "workshop", "toolshed", "warehouse", "coldstore", "dock", "closet", "security", "farm", "ranch", "hatchery", "insectary", "orchard", "shellfarm"].includes(type) ? 2 : 0,
      btex:["genesis-seam", "genesis-lab", "genesis-slate"],
      trim:[[{c:"#C9A24B", w:.9, at:.94}],
        [{c:"#1F3D2B", w:5, at:.985}, {c:"#C9A24B", w:.9, at:.92}],
        [{c:"#C9A24B", w:.8, at:.94}]],
      ridge:[[{c:"#10261A", w:3.6}, {c:"#C9A24B", w:1.5}], null, null],
      units:[null, {c:"#B3AEA1", c2:"#6F6B61", n:3, min:150}, null]},
    eave:{c:"#14281C", w:1.8},
    // dark green steel rail: two rails with a small gold cap on each post. Dangerous animals get a tall steel panel wall on a concrete base with a gold band along the top.
    bord:{c:"#1F3D2B", w:5, trim:[{c:"#C9A24B", w:1}],
      more:[{c:"#CBC5B4", w:1.5}, {c:"#14281C", w:6.5, dash:"0 34", cap:"round"}, {c:"#C9A24B", w:3, dash:"0 34", cap:"round"}],
      by:{
        bars:{c:"#1F3D2B", w:5,
          more:[{c:"#CBC5B4", w:1.5}, {c:"#3F6B52", w:1, dash:"1 3"}, {c:"#14281C", w:6.5, dash:"0 34", cap:"round"}, {c:"#C9A24B", w:3, dash:"0 34", cap:"round"}]},
        acrylic:{c:"#1F3D2B", w:5,
          more:[{c:"#D5ECE6", w:2.2}, {c:"#14281C", w:6.5, dash:"0 34", cap:"round"}, {c:"#C9A24B", w:3, dash:"0 34", cap:"round"}]}},
      strong:{base:{c:"#A8A396", w:13, c2:"#7D7869", dash2:"3 5"}, c:"#2E3A36", w:7,
        more:[{c:"#1F3D2B", w:5}, {c:"#10261A", w:7, dash:".8 15"}, {c:"#C9A24B", w:1.7, dash:"11 4"}]}},
    unlock:{hint:"Where you start.", check:() => true}},
  gilded: {label:"Gilded Age", ground:"#7FA36A", tex:"gilded", ptex:"gilded-cobble", btex:"gilded-roof", gtex:"gilded-lawn", blurb:"Cobblestones, slate roofs, wrought iron and brass. 1800s paleontology, retro paleoart.",
    path:{live:"#D2B98A", dead:"#B8A97F", edge:"#5E3226", kerb:{c:"#C9A24B", dash:"2 7"}}, bld:"#6E2430", mix:.82, edge:"#2B2B30", accent:"#C9A24B", fee:.15, fits:["mgal", "igua", "steg", "apat"],
    // wrought iron: a black rail with pointed finials, thicker posts with brass caps, and a stone footing for dangerous animals
    bord:{c:"#1F1F24", w:2.2, c2:"#1F1F24", w2:3.6, dash2:"0 4.5", cap2:"round",
      more:[{c:"#1F1F24", w:6.5, dash:"0 36", cap:"round"}, {c:"#C9A24B", w:3, dash:"0 36", cap:"round"}],
      trim:{c:"#C9A24B", w:1.2}, base:{c:"#9A9486", w:7, c2:"#6F6A5C", dash2:"3 5"}},
    unlock:{hint:"Earn the $1,000,000 grant.", check:() => state.goalsDone.includes("cash1m") || hasTech("gilded")}},
  bayou: {label:"Bayou", ground:"#3E4A2E", tex:"bayou", gtex:"bayou-ground", ptex:"bayou-walk", btex:"bayou-planks", rot:"bayou-rot", age:40, blurb:"Weathered boardwalks, tin roofs, cypress posts and still water.",
    path:{live:"#8F7F66", dead:"#6E6250", edge:"#2A2118", kerb:{c:"#5F7A3A", dash:"9 6"}}, bld:"#7E7362", mix:.82, edge:"#2A2118", accent:"#6FA39A", fee:.1, fits:["dsuc", "bari", "kool", "simo", "prio"],
    // roofs: weathered gray-brown planks with gaps, or rust-streaked corrugated tin (each building keeps one); a dark water-stained edge with faded teal paint peeling off it
    roofs:{of:() => 0, btex:[["bayou-planks", "bayou-tin"]],
      trim:[[{c:"#2A2118", w:3.2}, {c:"#6FA39A", w:1.6, dash:"9 3 4 7 13 2 6 9"}, {c:"#C9C2AE", w:1.4, dash:"0 11 3 17 2 26"}]]},
    // moss creeps in from the corners as buildings age (decay grows over `age` days, so new ones are clean)
    moss:{c:["#3E5A28", "#5F7A3A", "#7A9448"], r:2.2},
    bord:{band:"#3E4A2C", c:"#B49A6A", w:1.3, c2:"#4A3824", w2:6.5, dash2:"0 20", cap2:"round", trim:{c:"#2A2118", w:1.4},
      // rusted chain-link for dangerous animals: a rust mesh band on leaning weathered posts, with vines and leaves creeping over it
      strong:{band:"#3E4A2C", c:"#4A2E1A", w:5.4,
        more:[{c:"#A8683A", w:4.4, dash:"1 1.1 .7 1.4"}, {c:"#D08A50", w:1.2, dash:".6 1.9 1 2.6", cap:"round"},
          {c:"#2A2118", w:8, dash:"0 24 0 27", cap:"round"}, {c:"#7E7362", w:5, dash:"0 24 0 27", cap:"round"},
          {c:"#3E5A26", w:3.2, dash:"9 14 4 22 13 30 6 25", cap:"round"}, {c:"#6E8A3A", w:3.4, dash:"0 6 0 4 0 27 0 9 0 36", cap:"round"}]}},
    unlock:{hint:"Keep your first water-loving animal.", check:() => state.exhibits.some(e => e.animals.some(a => likesOf(SPECIES_BY_ID[a.sp]).water >= .9))}},
  volcanic: {label:"Volcanic", ground:"#1E1B1D", tex:"volcanic-rock", gtex:"volcanic-ground", ptex:"volcanic-flow", btex:"volcanic-basalt-dim", blurb:"Black basalt, steel and ash, with heat glowing through the cracks.",
    path:{live:"#4A1E14", dead:"#3A3436", edge:"#141113"}, bld:"#1A1719", mix:.92, edge:"#8A8488", accent:"#FF5A1F", fee:.25, fits:["cnot", "velo", "utah", "dilo", "carc"],
    // roofs by how hot a building runs: 0 storage and shops (dark basalt), 1 kitchens, hotels and work buildings (basalt with glowing seams), 2 labs, medicine and generators (steel plating, ember strips and vents)
    roofs:{of:(t, type) => ["oracle", "ghost", "tar", "ceres", "pmc", "generator", "edcenter"].includes(type) ? 2
        : t.kind === "food" || t.rooms || ["breakroom", "workshop", "security", "insectary", "depot", "greenhouse", "hatchery", "station", "diveshack", "toolshed"].includes(type) ? 1 : 0,
      btex:["volcanic-basalt-dim", "volcanic-basalt", "volcanic-plate"],
      trim:[[{c:"#5C7A8C", w:1}],
        [{c:"#141113", w:3, dash:"1 1.6 1 1.6 1 1.6 1 18"}, {c:"#E0561C", w:1, dash:"6 24"}],
        [{c:"#5A1A0E", w:4}, {c:"#FF7A2F", w:1.6}, {c:"#141113", w:3.6, dash:"1 1.4 1 1.4 1 1.4 1 22"}]]},
    // black basalt wall: chunky dark columns with a faint, broken ember line along the top
    bord:{band:"#2B2326", c:"#141113", w:7, trim:{c:"#8A8488", w:1},
      more:[{c:"#0E0C0D", w:8, dash:"0 5.2 0 6 0 4.6 0 5.6", cap:"round"}, {c:"#363134", w:6.4, dash:"0 5.2 0 6 0 4.6 0 5.6", cap:"round"},
        {c:"#4E484C", w:2.2, dash:"0 5.2 0 6 0 4.6 0 5.6", cap:"round"}, {c:"#FF5A1F", w:.9, dash:"18 7 30 12 9 14"}],
      // heavy dark steel bars set into a stone base, with orange warning lights
      strong:{band:"#2B2326", base:{c:"#3A3538", w:14, c2:"#1E1B1D", dash2:"6 2 4 2"}, c:"#2A2E34", w:4,
        more:[{c:"#5C7A8C", w:1}, {c:"#101214", w:7, dash:"2.4 4"}, {c:"#3E444C", w:4.4, dash:"2.4 4"},
          {c:"#5A1A0E", w:8, dash:"0 31", cap:"round"}, {c:"#FF5A1F", w:4.6, dash:"0 31", cap:"round"}, {c:"#FFD27A", w:1.8, dash:"0 31", cap:"round"}]}},
    unlock:{hint:"Reach a 4-star rating.", check:() => state.rating >= 4}},
  stone: {label:"Stone Age", ground:"#857D71", tex:"stone", gtex:"stone-tundra", ptex:"stone-flag", btex:"stone-slab", blurb:"Frozen tundra, flagstones, stacked stone and lashed timber, thatch and hide. Cold and rough, with no paint anywhere.",
    path:{live:"#4E463D", dead:"#6E675E", edge:"#2B2D30"}, bld:"#4C5157", mix:.9, edge:"#2B2D30", accent:"#B8995A", fee:.2, fits:["smil", "mgth", "doed", "elas", "macr"],
    // small buildings: thatch or stitched hide, shaped as a domed mound or a lean-to; bigger ones: heavy slab roofs with moss in the cracks
    eave:{c:"#2B2D30", w:2.4}, sod:{tex:["stone-thatch", "stone-hide"], max:100, shade:["dome", "lean"]},
    // snow load: storage and sheds stay buried, heated buildings melt off to bare thatch or dark wet stone
    snow:{of:SNOW_HEAT, tex:["snow-deep", "snow-patchy", "snow-melt"], at:.92},
    // stacked-stone wall: a thick bumpy gray band of dry-laid stones, two courses of uneven size
    bord:{band:"#3E4248", c:"#2B2D30", w:6,
      more:[{c:"#2B2D30", w:8.4, dash:"0 6.5 0 5.2 0 7.4 0 4.8", cap:"round"}, {c:"#7E838A", w:6.4, dash:"0 6.5 0 5.2 0 7.4 0 4.8", cap:"round"},
        {c:"#2B2D30", w:5, dash:"0 3.1 0 8.7 0 5.6 0 6.5", cap:"round"}, {c:"#9A9EA2", w:3.4, dash:"0 3.1 0 8.7 0 5.6 0 6.5", cap:"round"},
        {c:"#EEF1F1", w:1.6, dash:"0 17 0 23 0 11", cap:"round"}],
      // the building's base: a ring of stacked stones with the odd bone or antler
      trim:[{c:"#2B2D30", w:4.4, dash:"0 4.6 0 6 0 5.2", cap:"round"}, {c:"#8A8F94", w:3, dash:"0 4.6 0 6 0 5.2", cap:"round"}, {c:"#E8E2D2", w:1.3, dash:"0 9.8 3 20", cap:"round"},
        // rough log ends poking out unevenly from the roof edge, with the odd antler tine
        {c:"#2A2017", w:4.2, dash:"0 7 0 13 0 5 0 17", cap:"round", at:1}, {c:"#8A6E4E", w:2.6, dash:"0 7 0 13 0 5 0 17", cap:"round", at:1}, {c:"#E8E2D2", w:1.2, dash:"0 31 2.2 40", cap:"round", at:1}],
      // timber palisade for dangerous animals: a row of sharpened log tops, lashed with straw rope
      strong:{band:"#3E4248", c:"#2A2017", w:6.5,
        more:[{c:"#2A2017", w:7.6, dash:"0 5.2", cap:"round"}, {c:"#6B5440", w:5.8, dash:"0 5.2", cap:"round"}, {c:"#A88A62", w:2.2, dash:"0 5.2", cap:"round"},
          {c:"#B8995A", w:1, dash:"1.6 9.8"}]}},
    unlock:{hint:"Earn the grant for cloning a Quaternary animal.", check:() => state.goalsDone.includes("cloneq")}},
  lodge: {label:"Nordic", ground:"#DDE6EC", tex:"lodge-snow", gtex:"lodge-snow", ptex:"lodge-path", btex:"lodge-shingle", blurb:"Longhouses and stave churches in the snow: dark shingle roofs under blue-white drifts, turf-roofed huts, carved ridge tips, deep red trim and split-log rails. Warm, tidy and finished.",
    path:{live:"#E4E8E8", dead:"#B9C0C4", edge:"#4F5C66", kerb:{c:"#8A6A44", dash:"5 1.6"}}, bld:"#3B2E26", mix:.85, edge:"#1F1E1D", accent:"#9E2A2B", fee:.15, fits:["arct", "dire", "mamm", "mast", "cryo"],
    // roofs: 0 storage, sheds and shops (dark shingle), 1 landmarks and heated halls (shingle with a stacked stave-church upper roof, red knotwork band, carved ridge tips); sod on small buildings
    roofs:{of:(t, type) => ["oracle", "ghost", "tar", "ceres", "edcenter", "resort", "lodge", "restaurant", "megastore"].includes(type) ? 1 : 0, btex:[["lodge-shingle", "lodge-shingle", "lodge-metal"], ["lodge-shingle"]],
      // thick round log ends in warm tan along the eaves; landmarks add a chunky deep red diamond band just inside
      trim:[[{c:"#3A2A1E", w:5.6, dash:"0 7.5", cap:"round", at:.98}, {c:"#C9A36A", w:4.2, dash:"0 7.5", cap:"round", at:.98}, {c:"#8A6A44", w:1.3, dash:"0 7.5", cap:"round", at:.98}],
        [{c:"#3A2A1E", w:5.6, dash:"0 7.5", cap:"round", at:.98}, {c:"#C9A36A", w:4.2, dash:"0 7.5", cap:"round", at:.98}, {c:"#8A6A44", w:1.3, dash:"0 7.5", cap:"round", at:.98},
          {c:"#6B1F20", w:2.6, dash:"3 3", at:.9}, {c:"#C9A36A", w:.7, dash:"0 6", cap:"round", at:.9}]]},
    eave:{c:"#1F1E1D", w:2.6}, ridge:[{c:"#1F1E1D", w:4}, {c:["#9E2A2B", "#2F5A3A"], w:1.8}], sod:{tex:"lodge-sod", max:80},
    // carved ridge tips: a small crossed bronze tip at each end of the ridge on big buildings
    tips:{c:"#2A1E16", c2:"#A8793C", min:140},
    // stave-church look: landmark buildings get a smaller stacked upper roof
    tier:{min:170, next:2.2, at:[.6, .32], light:"#E4EDF2", shadow:"#2A2C30", drop:.4},
    // snow depth by how warm a building runs: sheds buried, labs and restrooms melted to wet dark shingles
    snow:{of:SNOW_HEAT, tex:["snow-deep", "snow-patchy", "snow-melt"], at:.9},
    // split-log rail: a rough log with its split seam, thick posts with snow caps, and snow lying along the rail
    bord:{band:"#CAD6DD", c:"#8A6A44", w:5, c2:"#4A3524", w2:1,
      more:[{c:"#F4F7F8", w:2, dash:"4 14 7 11"}, {c:"#3A2A1E", w:9, dash:"0 44", cap:"round"}, {c:"#E4EDF2", w:5, dash:"0 44", cap:"round"}],
      trim:[{c:"#C9A36A", w:4.4, dash:"0 6", cap:"round"}, {c:"#7A5A36", w:1.2, dash:"0 6", cap:"round"}],
      // tall timber palisade for dangerous animals: peeled logs on a stone footing, pointed carved post tops, a dark steel band across them, and snow on top
      strong:{band:"#CAD6DD", c:"#3A2A1E", w:6.5,
        base:{c:"#8E9196", w:13, c2:"#5E6268", dash2:"4 2 6 2"},
        more:[{c:"#3A2A1E", w:7.4, dash:"0 5", cap:"round"}, {c:"#C9A36A", w:5.6, dash:"0 5", cap:"round"}, {c:"#8A6A44", w:1.4, dash:"0 5", cap:"round"},
          {c:"#2A2C30", w:1.6}, {c:"#F4F7F8", w:2.6, dash:"6 9 3 13 9 8"},
          {c:"#3A2A1E", w:8.6, dash:"0 30", cap:"round"}, {c:"#A8793C", w:4.8, dash:"0 30", cap:"round"}]}},
    unlock:{hint:"Build a hotel.", check:() => state.buildings.some(b => isHotel(b))}},
  mesa: {label:"Mesa", ground:"#D6A26E", tex:"mesa", gtex:"mesa-sand", ptex:"mesa-flag", btex:"mesa-sand-roof", blurb:"Pueblo adobe, sandstone, cactus and turquoise in the Southwest desert.",
    path:{live:"#E3CBA4", dead:"#C9AE88", edge:"#9A5A3A"}, bld:"#C4683F", mix:.85, edge:"#7A3E26", accent:"#3FA7A0", fee:.15, fits:["coel", "dilo", "prot", "ovir", "velo"],
    // flat adobe roofs: 0 work buildings (terracotta or deep clay), 1 guest buildings (sand or cream), 2 labs (cream). Guest buildings and labs get a turquoise door.
    // A pale parapet runs round the top, with dark viga log ends poking out along the edge
    roofs:{of:(t, type) => ["oracle", "ghost", "tar", "ceres", "pmc", "generator", "greenhouse"].includes(type) ? 2
        : t.kind === "food" || t.kind === "merch" || t.rooms || ["edcenter", "campground", "platform"].includes(type) ? 1 : 0,
      btex:[["mesa-terra", "mesa-clay"], ["mesa-sand-roof", "mesa-cream"], "mesa-cream"],
      trim:[[{c:"#E8A882", w:4, at:.97}, {c:"#7A3E26", w:.8, at:.93}, {c:"#3E2A1C", w:3.4, dash:"0 15", cap:"round", at:1}],
        [{c:"#F6E8CE", w:4, at:.97}, {c:"#A8784E", w:.8, at:.93}, {c:"#3E2A1C", w:3.4, dash:"0 15", cap:"round", at:1}, {c:"#3FA7A0", w:2.4, dash:"8 9999", at:.97}],
        [{c:"#FBF3E2", w:4, at:.97}, {c:"#A8784E", w:.8, at:.93}, {c:"#3E2A1C", w:3.4, dash:"0 15", cap:"round", at:1}, {c:"#3FA7A0", w:2.4, dash:"8 9999", at:.97}]]},
    // stepped pueblo blocks on big buildings: a lighter upper story with a shadow, and a third on the biggest
    tier:{min:150, next:2.4, at:[.62, .34], light:"#FFF2DC", shadow:"#5A2E1C", drop:.4},
    // low adobe wall: a thick terracotta band with a rounded, sunlit top
    bord:{band:"#D6A26E", c:"#8A4A2E", w:8, trim:{c:"#5A3A26", w:1.6},
      more:[{c:"#D08A5E", w:6.4}, {c:"#EDB98E", w:2.4}, {c:"#F6D8B6", w:.8, dash:"14 6 22 9"}],
      // wooden fences become a latilla fence: rows of thin peeled sticks, lashed every so often
      by:{wood:{band:"#D6A26E", c:"#4A3220", w:1.2,
        more:[{c:"#4A3220", w:6.4, dash:"1.3 1"}, {c:"#C8A47A", w:5.6, dash:"1 1.3"}, {c:"#3E2A1C", w:1.4}, {c:"#6E4A2E", w:7, dash:"1.6 18"}]}},
      // tall adobe wall on a wide footing, capped with a rusted steel rail on posts
      strong:{band:"#D6A26E", base:{c:"#7A4028", w:14, c2:"#5A2E1C", dash2:"2 6"}, c:"#8A4A2E", w:9,
        more:[{c:"#C97E52", w:7.4}, {c:"#E8B48A", w:3}, {c:"#5A2A14", w:4.4, dash:"0 22", cap:"round"}, {c:"#7A3A1C", w:1.8}, {c:"#B8643A", w:.7, dash:"5 4 9 3"}]}},
    unlock:{hint:"Reach a 3-star rating.", check:() => state.rating >= 3}},
  modern: {label:"Modern", ground:"#86AB70", tex:"modern", gtex:"modern-lawn", ptex:"modern-aggregate", btex:"modern-slat", blurb:"Cool and light: green roofs, gray metal and glass skylights on pale concrete and mown grass, with dark wood for warmth and glass panel fences.",
    path:{live:"#DCD8D0", dead:"#BDB9B1", edge:"#8E8A82"}, bld:"#8A9A94", mix:.85, edge:"#1A1411", accent:"#B5552D", fee:.25, fits:["dodo", "nura", "sdel", "hopl", "gtod"],
    // roofs: 0 shops and food (green roof, louvered wood band), 1 restrooms and camping (green roof), 2 labs and backstage (standing-seam metal, cool and plain), 3 visitor buildings (off-white roof under big glazing, louvered band).
    // Charred cedar edge on all of them. Skylights break up the big roofs, and a short corten door mark sits on 0 and 3.
    roofs:{of:(t, type) => ["restaurant", "edcenter", "greenhouse"].includes(type) || t.rooms ? 3
        : t.kind === "food" || t.kind === "merch" ? 0 : ["restroom", "campground", "platform"].includes(type) ? 1 : 2,
      btex:["modern-sedum", "modern-sedum", "modern-seam", "modern-membrane"],
      trim:[[{c:"#4B3121", w:6, at:.985}, {c:"#2B1D14", w:5, at:.94}, {c:"#54392A", w:5, dash:"1 2.4", at:.94}, {c:"#B5552D", w:2.4, dash:"6 9999", at:.985}],
        [{c:"#4B3121", w:6, at:.985}, {c:"#6B4A32", w:.8, at:.93}],
        [{c:"#C9D0D4", w:1, at:.97}],
        [{c:"#4B3121", w:6, at:.985}, {c:"#2B1D14", w:5, at:.94}, {c:"#54392A", w:5, dash:"1 2.4", at:.94}, {c:"#B5552D", w:2.4, dash:"6 9999", at:.985}]],
      // skylights: pale glass in a thin dark frame, `at` scales the pane block, `n` splits it along the long side
      glass:[{at:.3, n:1, min:100}, null, {at:.5, n:2, min:150}, {at:.72, n:3, gap:.1}]},
    eave:{c:"#1A1411", w:2.2},
    // glass panel: a walnut frame holding pale blue-green glass with a bright glint, on espresso posts
    bord:{band:"#CFCBC3", c:"#4B3121", w:7,
      more:[{c:"#A9D8D3", w:4.6}, {c:"#F2FFFD", w:1.1, dash:"11 7 3 9"}, {c:"#2B1D14", w:9, dash:"0 40", cap:"round"}, {c:"#6B4A32", w:5, dash:"0 40", cap:"round"}],
      trim:[{c:"#4B3121", w:3}, {c:"#A9D8D3", w:1.2}],
      by:{
        // privacy: dark vertical slats, a fine ticked line from above
        wood:{band:"#CFCBC3", c:"#2B1D14", w:6,
          more:[{c:"#5A3E2A", w:5, dash:"1 2.2"}, {c:"#2B1D14", w:8, dash:"0 44", cap:"square"}]},
        // dry-stack stone: a low gray wall of uneven courses
        concrete:{band:"#CFCBC3", c:"#4E5458", w:7.4,
          more:[{c:"#A3A9AC", w:5.8}, {c:"#8A9094", w:5.8, dash:"7 3 11 4 5 3"}, {c:"#454B4F", w:5.8, dash:".8 9"}, {c:"#D2D6D8", w:1, dash:"4 6 8 5"}]},
        // steel bars: charcoal rail with fine upright bars and a rust-brown post now and then
        bars:{band:"#CFCBC3", c:"#2A3036", w:6,
          more:[{c:"#9AA3A9", w:4, dash:"1 3.2"}, {c:"#B5552D", w:5, dash:"0 52", cap:"round"}]},
        electric:{band:"#CFCBC3", c:"#2A3036", w:6,
          more:[{c:"#9AA3A9", w:4, dash:"1 3.2"}, {c:"#B5552D", w:5, dash:"0 52", cap:"round"}]}},
      // taller glass in a heavy timber-and-steel frame on a concrete footing
      strong:{band:"#CFCBC3", c:"#1E2226", w:8,
        base:{c:"#9A9EA0", w:14, c2:"#6C7276", dash2:"2 7"},
        more:[{c:"#A9D8D3", w:5.4}, {c:"#F2FFFD", w:1.2, dash:"11 7 3 9"}, {c:"#4B3121", w:1.8},
          {c:"#1E2226", w:11, dash:"0 30", cap:"square"}, {c:"#8E979D", w:5, dash:"0 30", cap:"square"}, {c:"#B5552D", w:2, dash:"0 120", cap:"square"}]}},
    unlock:{hint:"Research Modern design at the Research Lab.", check:() => hasTech("modern")}},
  japanese: {label:"Japanese Garden", ground:"#7FA68F", tex:"japanese", gtex:"japanese-moss", ptex:"japanese-plank", btex:"japanese-tile", blurb:"Calm and precise: curved tile roofs, golden thatch, dark timber walkways with pebble edges, bamboo lattice and plaster walls, clipped moss and raked gravel. Red is kept for lanterns.",
    path:{live:"#6A5240", dead:"#54402F", edge:"#2E2118", kerb:{c:"#CFCBBE", dash:"2.4 1.6"}}, bld:"#3C4146", mix:.85, edge:"#1F1A16", accent:"#C8442E", fee:.2, fits:["tric", "steg", "dipl", "para", "anky"],
    // roofs by building: 0 labs and medicine (charcoal tile), 1 work and storage (weathered green-gray tile), 2 guest buildings (charcoal tile with ochre accents).
    // Small buildings (restrooms, shops, keeper huts) get rounded golden thatch instead. Every roof has a dark timber edge round a pale plaster band, and a raised ridge cap down the middle.
    roofs:{of:(t, type) => ["oracle", "ghost", "tar", "ceres", "pmc", "generator", "greenhouse"].includes(type) ? 0
        : ["warehouse", "coldstore", "toolshed", "dock", "depot", "closet", "farm", "ranch", "station", "diveshack", "workshop", "breakroom", "security", "insectary", "hatchery", "orchard", "shellfarm"].includes(type) ? 1 : 2,
      btex:["japanese-tile", "japanese-tile-green", "japanese-tile"],
      trim:[[{c:"#2A1E16", w:3.2, at:1}, {c:"#E6E0CE", w:1.6, at:.94}, {c:"#2A1E16", w:.6, at:.9}],
        [{c:"#33281E", w:3.2, at:1}, {c:"#CFC9B4", w:1.6, at:.94}, {c:"#33281E", w:.6, at:.9}],
        [{c:"#2A1E16", w:3.2, at:1}, {c:"#EDE7D4", w:1.6, at:.94}, {c:"#2A1E16", w:.6, at:.9}, {c:"#C9A24B", w:.8, dash:"7 5", at:.86}]]},
    eave:{c:"#1F1A16", w:2.2}, sod:{tex:["japanese-thatch"], max:70, shade:["dome"]},
    ridge:[{c:"#15171A", w:5, cap:"round"}, {c:"#59606A", w:2.2, cap:"round"}, {c:"#C9A24B", w:.7, dash:"2 4"}],
    // upturned corners, and moss creeping along the roof edges as buildings age
    corners:{c:"#1F2226", c2:"#C9C5B4"}, moss:{c:["#4A6B3A", "#6A8A48", "#86A558"], r:1.4}, age:90,
    // bamboo lattice: a thin pale pole with crossing poles in a neat grid, lashed at the crossings with dark cord
    bord:{band:"#D4D1C4", c:"#6B5A3A", w:4.2, trim:[{c:"#2A1E16", w:2.4}, {c:"#C9A24B", w:.8}],
      more:[{c:"#F0E2B6", w:2.8}, {c:"#7A6840", w:6.6, dash:"1.1 5.3"}, {c:"#DCCB98", w:5.2, dash:"1.1 5.3"}, {c:"#2B2118", w:2.6, dash:"0.05 6.35", cap:"round"}],
      by:{
        // metal bars: dark timber slats on a rail
        bars:{band:"#D4D1C4", c:"#2A1E16", w:5,
          more:[{c:"#5A4332", w:4, dash:"1 3.2"}, {c:"#C9A24B", w:.9}, {c:"#1A120C", w:7, dash:"0 36", cap:"square"}]},
        // electric: the lattice with a thin wire, small white insulators and paper lanterns, the one place the red shows
        electric:{band:"#D4D1C4", c:"#6B5A3A", w:4.2,
          more:[{c:"#F0E2B6", w:2.8}, {c:"#7A6840", w:6.6, dash:"1.1 5.3"}, {c:"#DCCB98", w:5.2, dash:"1.1 5.3"}, {c:"#2B2118", w:2.6, dash:"0.05 6.35", cap:"round"},
            {c:"#9AA3A9", w:.8}, {c:"#F4F4F0", w:2.6, dash:"0 6.4", cap:"round"},
            {c:"#6E1F12", w:8.4, dash:"0 64", cap:"round"}, {c:"#D84A2E", w:6.4, dash:"0 64", cap:"round"}, {c:"#FFC98A", w:2.4, dash:"0 64", cap:"round"}]},
        // acrylic: a shoji screen, pale paper panels in a dark lattice
        acrylic:{band:"#D4D1C4", c:"#2A1E16", w:7,
          more:[{c:"#F3EEDD", w:5}, {c:"#4A3626", w:5.4, dash:".9 9"}, {c:"#4A3626", w:.9}]},
        // concrete: a low plaster wall under a charcoal tile cap, with a plaster edge showing either side
        concrete:{band:"#D4D1C4", c:"#E6E0CE", w:9, trim:[{c:"#2A1E16", w:2.4}, {c:"#E6E0CE", w:1}],
          more:[{c:"#A9A392", w:.8, dash:"9 5 14 4"}, {c:"#14161A", w:5.8}, {c:"#454B52", w:3.8, dash:"2.4 .6"}, {c:"#8E959C", w:.7}]}},
      // tall dark timber posts with steel mesh behind a plaster wall, on a pebble footing
      strong:{band:"#D4D1C4", base:{c:"#9A968A", w:15, c2:"#6F6B60", dash2:"3 5"}, c:"#E6E0CE", w:8,
        more:[{c:"#A9A392", w:.8, dash:"9 5 14 4"}, {c:"#8E959C", w:3.4, dash:"1 1.1 .7 1.4"}, {c:"#C9D0D4", w:.8},
          {c:"#15110D", w:9, dash:"0 24", cap:"round"}, {c:"#4A3626", w:6.4, dash:"0 24", cap:"round"}, {c:"#7A6244", w:1.8, dash:"0 24", cap:"round"}]}},
    unlock:{hint:"Build 3 exhibits.", check:() => state.exhibits.length >= 3}},
  tropical: {label:"Tropical", ground:"#3F9A4A", tex:"tropical", gtex:"tropical-ground", ptex:"tropical-stones", btex:"tropical-bamboo", rot:"tropical-bloom", blurb:"Lush and bright: thatch huts, bamboo and teak, pale stepping stones, big leaves and bursts of flowers. Tidy and cared for, unlike the Bayou.",
    path:{live:"#F4D6BE", dead:"#D6B49C", edge:"#256B35", kerb:{c:"#8BCB5A", dash:"7 4"}}, bld:"#A8742E", mix:.85, edge:"#4A2E14", accent:"#1FA7A0", fee:.15, fits:["arch", "micr", "dimo", "psit", "quet"],
    // small buildings: round thatch huts, fresh gold to sun-faded gray (each keeps one); bigger ones: split bamboo, or dark teak planks on the labs.
    // Trim is a lashed bamboo edge with a shell band, and a bright teal, coral or yellow stripe along the ridge. Dark brown eaves keep roofs readable on green.
    eave:{c:"#4A2E14", w:2.6}, sod:{tex:["tropical-thatch-gold", "tropical-thatch-tan", "tropical-thatch-faded"], max:90, shade:["dome"]},
    roofs:{of:(t, type) => ["oracle", "ghost", "tar", "ceres", "pmc", "generator", "greenhouse"].includes(type) ? 1 : 0,
      btex:[["tropical-bamboo", "tropical-bamboo", "tropical-bamboo-dry"], "tropical-teak"],
      trim:[[{c:"#4A2E14", w:3.4, at:.97}, {c:"#E0B65A", w:2.2, dash:"0 6", cap:"round", at:.97}, {c:"#FFF3DC", w:1, dash:"1 8", at:.9}],
        [{c:"#2A140A", w:3.4, at:.97}, {c:"#C9803A", w:1.6, dash:"6 3", at:.97}, {c:"#1FA7A0", w:1.2, dash:"10 5", at:.9}]]},
    ridge:[{c:"#3A2412", w:4.2}, {c:["#1FA7A0", "#F0644C", "#F2C230"], w:1.9}],
    // bamboo fence: a row of small round poles with darker lashing across them
    bord:{band:"#2F7A3E", trim:[{c:"#4A2E14", w:3}, {c:"#E0B65A", w:2, dash:"0 5", cap:"round"}],
      more:[{c:"#3E2A14", w:7.4, dash:"0 5.2", cap:"round"}, {c:"#C8B84A", w:5.6, dash:"0 5.2", cap:"round"}, {c:"#EDE49A", w:2, dash:"0 5.2", cap:"round"},
        {c:"#5A3A1A", w:1.1}, {c:"#5A3A1A", w:7.8, dash:"1.3 14.3"}],
      // concrete (high privacy) becomes carved timber posts with woven panels between them
      by:{concrete:{band:"#2F7A3E",
        more:[{c:"#3A2412", w:6.6}, {c:"#C99A56", w:4.8, dash:"2 1.2"}, {c:"#8A5A2A", w:4.8, dash:"1 3.2"},
          {c:"#2A170B", w:9.4, dash:"0 24", cap:"round"}, {c:"#6A3A1E", w:6.8, dash:"0 24", cap:"round"}, {c:"#E0A04A", w:2, dash:"0 24", cap:"round"}, {c:"#F0644C", w:1.6, dash:"0 24", cap:"round"}]}},
      // heavy teak posts with steel cable and mesh for dangerous animals, vines trained over them and the odd hibiscus
      strong:{band:"#2F7A3E", c:"#3A1F10", w:5,
        more:[{c:"#9AA6A8", w:4.2, dash:"1 1.1 .7 1.4"}, {c:"#C9D2D4", w:.9},
          {c:"#24120A", w:9.4, dash:"0 22", cap:"round"}, {c:"#7A3E22", w:6.8, dash:"0 22", cap:"round"}, {c:"#B0643A", w:2, dash:"0 22", cap:"round"},
          {c:"#2F7A3E", w:3, dash:"9 11 4 18 12 24", cap:"round"}, {c:"#6FC04A", w:3.2, dash:"0 6 0 4 0 25 0 9 0 30", cap:"round"}, {c:"#D8333A", w:2.6, dash:"0 61 0 97", cap:"round"}]}},
    unlock:{hint:"Keep an animal in a tropical exhibit.", check:() => state.exhibits.some(e => e.animals.length && biomeOf(e) === "tropical")}},
  roadside: {label:"Retro", ground:"#86AB5E", tex:"roadside", gtex:"roadside-lawn", ptex:"roadside-asphalt", btex:"roadside-cream", blurb:"1960s highway attraction: cream and turquoise roofs with bold stripes, chrome trim, painted asphalt and pastel pipe rails, like a diner and a motor lodge that decided to have dinosaurs.",
    // asphalt with a thin, faded dashed center line; a cream curb dash at the edge
    path:{live:"#53565D", dead:"#43464C", edge:"#2B2D31", kerb:{c:"#E9E2CE", dash:"12 8"}, center:{c:"#E8C547", w:1, dash:"7 6", o:.65}}, bld:"#F2E8D0", mix:.85, edge:"#2A2D33", accent:"#E8334A", fee:.25, fits:["trex", "velo", "spin", "tric", "pter"],
    // roofs by building type: 0 food (cream, cherry stripe), 1 shops (pale turquoise, white stripe), 2 restrooms (cream, mustard stripe), 3 visitor buildings and hotels (starburst, red stripe, checker band), 4 labs and backstage (plain turquoise-gray).
    // Every roof gets a thick stripe round the border and a thin chrome outline with a bright inner edge; 0, 1 and 3 carry a glowing rooftop sign.
    roofs:{of:(t, type) => ["edcenter", "restaurant"].includes(type) || t.rooms ? 3
        : t.kind === "food" ? 0 : t.kind === "merch" ? 1 : type === "restroom" ? 2 : 4,
      btex:["roadside-roof-cream", "roadside-roof-turq", "roadside-roof-cream", "roadside-roof-burst", "roadside-roof-gray"],
      trim:[[{c:"#D8333A", w:4.4, at:.9}, {c:"#F4EFE2", w:.9, at:.94}, {c:"#EDF2F4", w:1.3, at:1}, {c:"#8E979E", w:.6, at:.985}, {c:"#FF4FA3", w:8, dash:"11 9999", at:.97}, {c:"#FFE9F3", w:3.4, dash:"11 9999", at:.97}],
        [{c:"#F4F7F7", w:4.4, at:.9}, {c:"#2F8F8A", w:.9, at:.94}, {c:"#EDF2F4", w:1.3, at:1}, {c:"#8E979E", w:.6, at:.985}, {c:"#2EE6D6", w:8, dash:"11 9999", at:.97}, {c:"#E6FFFC", w:3.4, dash:"11 9999", at:.97}],
        [{c:"#E7B93A", w:4.4, at:.9}, {c:"#FFF6DA", w:.9, at:.94}, {c:"#EDF2F4", w:1.3, at:1}, {c:"#8E979E", w:.6, at:.985}],
        [{c:"#D8333A", w:4.4, at:.9}, {c:"#141517", w:3, at:.8}, {c:"#F6F4EC", w:3, dash:"3 3", at:.8}, {c:"#EDF2F4", w:1.3, at:1}, {c:"#8E979E", w:.6, at:.985}, {c:"#46A8FF", w:8, dash:"13 9999", at:.97}, {c:"#E8F4FF", w:3.4, dash:"13 9999", at:.97}],
        [{c:"#5FB4AE", w:2.4, at:.94}, {c:"#EDF2F4", w:1.1, at:1}]]},
    // pastel pipe rail: a turquoise pipe with a bright highlight, on round posts
    bord:{c:"#3FA39B", w:4.4, c2:"#D2F6F0", w2:1.3, trim:{c:"#3FA39B", w:1.6},
      more:[{c:"#2C7F78", w:7.6, dash:"0 38", cap:"round"}, {c:"#8FE3D8", w:4.6, dash:"0 38", cap:"round"}],
      by:{
        // wooden fences become a pink pipe rail
        wood:{c:"#E8749E", w:4.4, c2:"#FFE1EC", w2:1.3, more:[{c:"#B84C74", w:7.6, dash:"0 38", cap:"round"}, {c:"#FFB3CD", w:4.6, dash:"0 38", cap:"round"}]},
        // chrome guardrail: a bright silver rail with a shadowed edge, post dots
        bars:{c:"#7C858C", w:4.8, c2:"#F4F8FA", w2:1.6, more:[{c:"#5A6269", w:6.4, dash:"0 24", cap:"round"}, {c:"#DCE3E7", w:3.6, dash:"0 24", cap:"round"}]},
        // with a pink neon tube along the top
        electric:{glow:"#FF4FA3", c:"#7C858C", w:4.8, c2:"#F4F8FA", w2:1.6, more:[{c:"#FF4FA3", w:1.4}, {c:"#5A6269", w:6.4, dash:"0 24", cap:"round"}, {c:"#DCE3E7", w:3.6, dash:"0 24", cap:"round"}]},
        // red and white striped concrete
        concrete:{c:"#C9CDD0", w:8, more:[{c:"#D8333A", w:7, dash:"8 8"}, {c:"#F4F2EA", w:1.2}]}},
      // heavy red and white striped concrete barrier on a footing, with a neon tube along the top
      strong:{glow:"#2EE6D6", base:{c:"#9A9EA2", w:14, c2:"#6C7276", dash2:"3 6"}, c:"#F4F2EA", w:8,
        more:[{c:"#D8333A", w:8, dash:"9 9"}, {c:"#4A4F55", w:1.2}, {c:"#2EE6D6", w:1.6}, {c:"#E6FFFC", w:.6}]}},
    unlock:{hint:"Get 250 guests in a day.", check:() => lastGuests() >= 250}},
  homestead: {label:"Homestead", ground:"#CDB06A", tex:"homestead", gtex:"homestead-prairie", ptex:"homestead-road", btex:"homestead-plank", blurb:"Wyoming ranch country: wind-combed prairie, dirt roads, rusty tin barns and split-rail fences.",
    path:{live:"#C4A574", dead:"#A88E66", edge:"#7A5E3C", ruts:{c:"#8A6A42", o:.45}}, bld:"#8E8B84", mix:.85, edge:"#3E352C", accent:"#A9C8DA", fee:.15, fits:["tric", "para", "gall", "ornm", "styr"],
    // roofs: 0 barns and sheds (rusty corrugated tin in barn red, weathered gray or rust, each building keeps one), 1 guest buildings (ranch-house wood shake), 2 labs (newer, clean tin)
    roofs:{of:(t, type) => ["oracle", "ghost", "tar", "ceres", "pmc", "generator", "greenhouse"].includes(type) ? 2
        : t.kind === "food" || t.kind === "merch" || t.rooms || ["edcenter", "campground", "platform"].includes(type) ? 1 : 0,
      btex:[["homestead-tin-red", "homestead-tin-gray", "homestead-tin-rust"], "homestead-shake", "homestead-tin-clean"],
      trim:[[{c:"#3E352C", w:2.6}, {c:"#7A6A56", w:.8, dash:"9 2 5 2"}],
        [{c:"#EDE6D6", w:1.8}],
        [{c:"#F2F0EA", w:1.3}, {c:"#A9C8DA", w:.8, dash:"14 6"}]],
      // a whitewashed barn X on big barns
      brace:{of:[0], min:140, lines:[{c:"#3E352C", w:3.2}, {c:"#EDE6D6", w:1.6}]}},
    // split-rail fence: weathered gray rails laid in a zigzag, stacked where they cross
    bord:{band:"#C9AE6A", trim:{c:"#3E352C", w:2},
      more:[{c:"#3E352C", w:5.4, zig:[6, 18]}, {c:"#9C9186", w:3.6, zig:[6, 18]}, {c:"#CFC7B8", w:1, dash:"9 6 14 5", zig:[6, 18]},
        {c:"#3E352C", w:6.4, zig:[6, 18], knots:true}, {c:"#7A6E60", w:4.2, zig:[6, 18], knots:true}],
      // heavy timber posts strung with taut barbed wire for dangerous animals
      strong:{band:"#C9AE6A",
        more:[{c:"#2E241A", w:8, dash:"0 26", cap:"square"}, {c:"#6E5A42", w:5.6, dash:"0 26", cap:"square"}, {c:"#8E7A5E", w:2, dash:"0 26", cap:"square"},
          {c:"#3A3C40", w:1.8}, {c:"#3A3C40", w:4, dash:".8 5"}, {c:"#C9CCD0", w:.8}]}},
    unlock:{hint:"Keep an animal in a grassland exhibit.", check:() => state.exhibits.some(e => e.animals.length && biomeOf(e) === "grassland")}},
};
// A matched area (an exhibit, plus the guest paths and the shops and restrooms near it) in one non-Genesis theme draws more guests.
// An animal that suits its exhibit's theme is happier and draws a little more too.
THEMES.genesis.bord.by.concrete = THEMES.genesis.bord.strong;   // a plain concrete wall gets the same tall steel panel look
const THEME = {radius:45, minNear:2, appeal:.08, fitHappy:6, fitAppeal:.05};

// Service roads are for staff. Guests don't walk on them, but they connect backstage buildings.
const SERVICE_ROAD = {perMeter:10, upkeepPerMeter:0.1, halfWidth:1.5};
// Paths are 5 m x 5 m chunks (js/pathcells.js). A chunk is 5 m of path, so it costs perMeter times 5.
const PATH_CELLS = {width:5, kinds:{
  g:{label:"Guest path",     perMeter:COST.pathPerMeter,   upkeepPerMeter:UPKEEP.pathPerMeter,         color:"#C6BC93"},
  s:{label:"Staff path",     perMeter:SERVICE_ROAD.perMeter, upkeepPerMeter:SERVICE_ROAD.upkeepPerMeter, color:"#5A5F64"},
  b:{label:"Wooden bridge",  perMeter:BRIDGE.perMeter,     upkeepPerMeter:BRIDGE.upkeepPerMeter,      color:"#A9825A"}
}};
const WIDE_PATH = {perMeter:30, upkeepPerMeter:0.4, halfWidth:5, crowdMult:2};   // a 10 m promenade: twice the walkers before it feels packed
// Tram track is drawn like a path, but guests only get on and off at a tram station. The tram runs speedMult times faster than walking.
const TRAM = {
  perMeter:25, upkeepPerMeter:0.3, halfWidth:1.5,
  reach:5,             // track this close to a station's edge counts as alongside it
  speedMult:6,         // how much faster than walking a ride is
  wait:30,             // each platform link feels this many meters longer, for the wait for the next tram
  fare:3,              // the usual fare, paid by each guest when they board (the player can change it)
  maxFare:9,           // the most you can charge; guests lose interest as it climbs past the usual fare
  wear:3,              // condition a station loses each day
  trackWear:.5,        // and this much more for each 100 m of track it sits on
  offlineBelow:25,     // a station this worn stops taking riders until a mechanic repairs it
  repairPerPercent:40, // cost of each percent of repair
  room:3,              // a platform or tram holds this many times the crowd of a plain path before it feels packed
  headway:6,           // minutes between trams, for drawing the cars
};

// Grants give new players something to aim for, and pay out when met (ids stay "goal" ids so old saves carry over).
// Each check() looks at the park and returns true when the grant is met. A grant pays `reward` in cash, or unlocks a `theme` instead.
// Some also unlock a `statue` (STATUES) to place in the park.
const eraUnlocked = era => g => g.state.science.unlocked.some(id => SPECIES_BY_ID[id] && ERA_OF[SPECIES_BY_ID[id].period] === era);
const GOALS = [
  {id:"exhibit",  text:"Draw your first exhibit",            hint:"Open Build, then Exhibit Tools, pick a fence type, then tap corners on the map. Tap the first corner again to close it.", reward:2000,  check:g=>g.state.exhibits.length>0},
  {id:"connect",  text:"Connect an exhibit to the path",     hint:"Guests only see exhibits that touch a path from the entrance. Use Guest Paths under Path Tools to reach it.", reward:2000,  check:g=>g.state.exhibits.some(e=>g.isReachable(e))},
  {id:"animals",  text:"Buy animals for an exhibit",         hint:"Tap an exhibit, then buy starter animals from partner parks in the side panel.", reward:5000,  check:g=>g.state.exhibits.some(e=>e.animals.length>0)},
  {id:"food",     text:"Build a Food Cart",                  hint:"Pick Food, then Cart, and tap next to a path. Tap the cart and choose what it sells. Hungry guests rate the park lower.", reward:3500,  check:g=>g.state.buildings.some(b=>b.type==="kiosk" && (b.menu||[]).length)},
  {id:"restroom", text:"Build Restrooms",                    hint:"Guests need restrooms too. Place them next to a path.", reward:5000,  check:g=>g.state.buildings.some(b=>b.type==="restroom")},
  {id:"keeper",   text:"Hire a Keeper",                      hint:"Partner parks feed your animals until day 5. Before then, build a Keeper Station beside a path or service road, tap it, and hire a keeper.", reward:6000, check:g=>g.state.staff.keepers.some(k=>k.role!=="aqua")},
  {id:"dock",     text:"Build a Delivery Dock",              hint:"Animal food has to be bought now. Build a Delivery Dock beside a service road. It orders overnight, custodians stock a station from it, and keepers carry the food out to the exhibits. Partner parks cover the first deliveries.", reward:5500, check:g=>g.state.buildings.some(b=>b.type==="dock")},
  {id:"custodian",text:"Hire a Custodian",                   hint:"Stands and shops sell from their own stock, and someone has to carry it from the dock. Build a Custodial Closet beside a path or service road and hire a custodian. They also clean restrooms and sweep litter.", reward:3500, check:g=>(g.state.staff.custodians || []).length>0},
  {id:"guard",    text:"Hire a Security Guard",              hint:"Unhappy, rowdy guests break benches and spray graffiti. Research Security offices at the Research Lab, build one beside a path, and hire a guard to patrol. Lamp posts help too.", reward:4000, check:g=>(g.state.staff.guards || []).length>0},
  {id:"gate",     text:"Give an exhibit a Keeper Gate",      hint:"Run a path or service road to an exhibit's fence, then use Gates under Exhibit Tools on that fence.", reward:3000, check:g=>g.state.exhibits.some(e=>!e.viv && e.gate && gateCheck(e).ok)},
  {id:"mechanic", text:"Hire a Mechanic",                    hint:"Fences wear down, and predators attack them. Build a Workshop beside a path or service road and hire a mechanic to inspect and repair them.", reward:4500, check:g=>(g.state.staff.mechanics || []).length>0},
  {id:"vet",      text:"Hire a Vet",                         hint:"Animals get sick, and some get hurt fighting. Build a Paleo-Medicine Center beside a path or service road and hire a vet. Vets also dart escaped animals.", reward:14000, check:g=>(g.state.staff.vets || []).length>0},
  {id:"zone",     text:"Draw a Work Zone",                   hint:"Zones split the park into areas with their own keepers and stores. Pick the Zone tool, draw around some exhibits and a station, then assign keepers to it from its panel.", reward:3000, check:g=>(g.state.zones||[]).length>0},
  {id:"g100",     text:"Get 100 Guests in one day",          hint:"More animals and happier animals bring more guests.", reward:5000,  statue:"lyst", check:g=>g.state.history.some(h=>h.guests>=100)},
  {id:"g1000",    text:"Get 1000 Guests in one day",         hint:"Keep adding animals, food, restrooms and room on the paths. Happy guests tell their friends.", reward:10000,  statue:"kele", check:g=>g.state.history.some(h=>h.guests>=1000)},
  {id:"oracle",   text:"Build the Research Lab",                       hint:"The Research Lab researches everything from fences to the Time Travel Lab's drones. Place it beside a path or service road.", reward:12000, statue:"anning", check:g=>g.state.buildings.some(b=>b.type==="oracle")},
  {id:"cenozoic", text:"Discover a Cenozoic Animal",          hint:"Build the Time Travel Lab, slide its timeline to the Paleogene, Neogene or Quaternary, tap a site on the map and send a drone to scout it.", reward:6000, statue:"proc", check:eraUnlocked("cenozoic")},
  {id:"mesozoic", text:"Discover a Mesozoic Animal",          hint:"Scout a Triassic, Jurassic or Cretaceous site with a drone.", reward:8000, statue:"coel", check:eraUnlocked("mesozoic")},
  {id:"paleozoic",text:"Discover a Paleozoic Animal",         hint:"Scout a Paleozoic site, from the Cambrian to the Permian, with a drone.", reward:10000, statue:"dime", check:eraUnlocked("paleozoic")},
  {id:"cloneq",   text:"Clone a Quaternary Animal",          hint:"Discover a Quaternary animal, collect its genome with the Time Travel Lab's expeditions, then clone it at the Genetics Lab.", theme:"stone", check:g=>g.state.exhibits.some(e=>e.animals.some(a=>a.cl && SPECIES_BY_ID[a.sp].period==="Quaternary"))},
  {id:"ghost",    text:"Bring back DNA with the Time Travel Lab",          hint:"Once a scouting trip has discovered an animal, pick it as the target on its site's card at the Time Travel Lab and send an expedition.", reward:30000, statue:"brown", check:g=>Object.keys(g.state.science.dna).length>0},
  {id:"genome",   text:"Complete a genome",                  hint:"Each sample fills part of a genome. Keep sending trips for the same species until it reaches 100%.", reward:10000, statue:"herr", check:g=>Object.values(g.state.science.dna).some(d=>d.genome>=100)},
  {id:"clone",    text:"Build the Genetics Lab and clone an animal",      hint:"The Genetics Lab turns a complete genome into an animal. Hire a Geneticist at the Genetics Lab, then order clones from the Genetics Lab or from an exhibit's panel.", reward:22000, statue:"orni", check:g=>g.state.exhibits.some(e=>e.animals.some(a=>a.cl))},
  {id:"ceres",    text:"Build the Botany Lab",                        hint:"Medicine for prehistoric animals is grown at the Botany Lab, once the Research Lab has researched it. Place it beside a path or service road and hire a botanist.", reward:15000, check:g=>g.state.buildings.some(b=>b.type==="ceres")},
  {id:"sp4",      text:"Display 4 different species",        hint:"Variety raises your rating. Herbivores can share an exhibit.", reward:8000,  statue:"prot", check:g=>g.speciesShown()>=4},
  {id:"star3",    text:"Reach a 3-star rating",              hint:"Keep animals happy, give guests food and restrooms, and add variety.", reward:15000, statue:"marsh", check:g=>g.state.rating>=3},
  {id:"cash1m",   text:"Have $1,000,000 in the bank",        hint:"Earn more than you spend. Check the day report each morning.", theme:"gilded", check:g=>g.state.money>=1000000},
  {id:"trex",     text:"Bring in a Tyrannosaurus rex",       hint:"Reach 4.5 stars, discover the Tyrannosaurus at Hell Creek with the Time Travel Lab, collect its genome, and clone it. It needs a lot of room.", reward:60000, statue:"cope", check:g=>g.state.exhibits.some(e=>e.animals.some(a=>a.sp==="trex"))},
  {id:"camp",     text:"Build a Campground",                 hint:"Research Hotels at the Research Lab. Once your park has 2 stars and 100 guests a day, build a Campground beside a path. Guests stay the night and spend tomorrow in the park.", reward:10000, check:g=>g.state.buildings.some(b=>b.type==="campground")},
  {id:"hotel",    text:"Build a Safari Lodge",               hint:"Once your park has 3 stars and 300 guests a day, build a Safari Lodge beside a path.", reward:40000, check:g=>g.state.buildings.some(b=>b.type==="lodge")},
  {id:"resort",   text:"Build a Resort Hotel",               hint:"Once your park has 4 stars and 700 guests a day, build a Resort Hotel beside a path.", reward:150000, check:g=>g.state.buildings.some(b=>b.type==="resort")},
];
// Held back from the v1.0 game (shown only in dev-mode): hotels, Education Centers and their modules, the tram, aquariums. Placed ones in old saves keep working.
const DEV_BUILDINGS = ["campground", "lodge", "resort", "edcenter", "tramstop", "depot", "aquaS", "aquaM", "aquaL", "gallery"];
const DEV_TECH = ["vehicles", "hotels", "transit", "education", "edtheater", "edfossils", "edauditorium", "edlabwindow", "ednursery", "edbotanical", "edsimroom", "ediorama", "edtouch"];
const DEV_GOALS = ["camp", "hotel", "resort"];
const devHidden = (list, id) => !devMode() && list.includes(id);
const buildingHidden = type => devHidden(DEV_BUILDINGS, type);
const techHidden = id => devHidden(DEV_TECH, id);
// Statues are dev-mode only for v1.0: no buying, no grant rewards. Placed ones in old saves keep drawing and working.
const statuesOn = () => devMode();
const grantStatue = g => statuesOn() ? g.statue || null : null;
const activeGoals = () => GOALS.filter(g => !devHidden(DEV_GOALS, g.id));
// What a grant pays: cash, or a theme
const grantPrize = g => (g.theme ? `${THEMES[g.theme].label} theme` : money(g.reward)) + (grantStatue(g) ? ` and ${LAND["st-" + g.statue].label.replace(/ Statue$/, "")} statue` : "");
