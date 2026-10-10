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
  ys:[-200,-100,0,100,200,305,405,505],
  home:[0,0,420,305],
  rates:[0, 0.8, 1.4],  // dollars per m² by ring (1 touches the home plot, 2 is the next one out)
};

const START = {
  money: 150000,
  ticket: 25,          // ticket price in dollars
  rating: 1,           // starting star rating (0 to 5)
};

// How fast time passes. At 1x speed, one real second is this many park minutes.
// The park is open 8:00 AM to 8:00 PM (720 minutes), so 12 means a day lasts 60 seconds.
const MINUTES_PER_SECOND = 12;

// How fast people walk on screen at 1x speed, in meters per real second. Guests, keepers, and mechanics all use it.
const WALK_SPEED = 40;
// The same speed in meters per park minute, which is what the simulation counts in
const WALK_PER_MIN = WALK_SPEED / MINUTES_PER_SECOND;
const OPEN_MIN = 8 * 60, CLOSE_MIN = 20 * 60;
const DAY_MIN = CLOSE_MIN - OPEN_MIN;   // park minutes in one open day. Research, trips, and growing are counted in these.

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
//   price    what one costs to buy, or to clone at TAR
//   food     feed cost per animal per day
//   space    square meters each animal needs
//   group    [fewest, most] of this species that are happy living together
//   appeal   how much guests want to see it
//   stars    park rating needed before you can buy or clone it
//   diet     a list of one or more: herbivore, omnivore, insectivore, piscivore, carnivore
//   predator true means it attacks any other species, so it can only live with its own kind
//   bug      true for insects, arachnids, and other arthropods
//
//   Who can share an exhibit (size means how much room each animal needs):
//     predators share with no other species
//     carnivores hunt any species smaller than themselves
//     insectivores and omnivores eat bugs smaller than themselves
//     herbivores and piscivores don't bother land animals
//   shop     true means partner parks sell it, so you can buy it without cloning
//   viv      "S", "M", or "L" means it lives in a vivarium at least that size, not an open exhibit
const DIETS = {herbivore:"Herbivore", omnivore:"Omnivore", insectivore:"Insectivore", piscivore:"Piscivore", carnivore:"Carnivore"};

const SPECIES = [
  // Devonian
  {id:"icht", name:"Ichthyostega",   period:"Devonian", diet:["piscivore"], price:4000, food:10, space:8, group:[2,6], appeal:4, stars:0.5, viv:"M"},
  {id:"tikt", name:"Tiktaalik",      period:"Devonian", diet:["piscivore"], price:4500, food:12, space:10, group:[2,6], appeal:5, stars:0.5, viv:"M"},
  // Carboniferous
  {id:"mibr", name:"Microbrachis",   period:"Carboniferous", diet:["insectivore"], price:2500, food:4, space:4, group:[3,10], appeal:3, stars:0, viv:"S"},
  {id:"hylo", name:"Hylonomus",      period:"Carboniferous", diet:["insectivore"], price:2800, food:4, space:5, group:[2,8], appeal:3, stars:0, viv:"S"},
  {id:"dcau", name:"Diplocaulus",    period:"Carboniferous", diet:["piscivore"], price:4000,  food:12,  space:10,   group:[2,6],  appeal:4,  stars:0.5, viv:"M"},
  {id:"arth", name:"Arthropleura",   period:"Carboniferous", diet:["herbivore"], bug:true, price:5000,  food:20,  space:25,   group:[1,6],  appeal:4,  stars:0,   viv:"L"},
  {id:"pulm", name:"Pulmonoscorpius", period:"Carboniferous", diet:["insectivore","carnivore"], bug:true, price:3000,  food:8,   space:6,    group:[1,3],  appeal:4,  stars:0,   viv:"S"},
  {id:"mega", name:"Meganeura",      period:"Carboniferous", diet:["insectivore"], bug:true, price:5000,  food:8,   space:20,   group:[4,12], appeal:4,  stars:0.5, viv:"L"},
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
  {id:"prio", name:"Prionosuchus",   period:"Permian", diet:["piscivore"], price:18000, food:170, space:900,  group:[1,3],  appeal:10, stars:2.5},
  // Triassic
  {id:"sile", name:"Silesaurus",     period:"Triassic", diet:["omnivore"], price:3500, food:25, space:100, group:[3,10], appeal:3, stars:0},
  {id:"shar", name:"Sharovipteryx",  period:"Triassic", diet:["insectivore"], price:3800, food:4, space:5, group:[2,8], appeal:5, stars:0.5, viv:"S"},
  {id:"long", name:"Longisquama",    period:"Triassic", diet:["insectivore"], price:4000, food:5, space:6, group:[2,8], appeal:5, stars:0.5, viv:"S"},
  {id:"gigt", name:"Gigatitan",      period:"Triassic", diet:["insectivore"], bug:true, price:4500, food:6, space:14, group:[3,8], appeal:5, stars:0.5, viv:"M"},
  {id:"coel", name:"Coelophysis",    period:"Triassic", diet:["carnivore"], predator:true, price:6000,  food:60,  space:200,  group:[3,8],  appeal:4,  stars:0.5},
  {id:"herr", name:"Herrerasaurus",  period:"Triassic", diet:["carnivore"], predator:true, price:8000, food:70, space:300, group:[2,5], appeal:6, stars:1},
  {id:"desm", name:"Desmatosuchus",  period:"Triassic", diet:["herbivore"], price:9000, food:110, space:500, group:[2,6], appeal:6, stars:1},
  {id:"plat", name:"Plateosaurus",   period:"Triassic", diet:["herbivore"], price:12000, food:160, space:900,  group:[3,8],  appeal:8,  stars:1.5},
  {id:"post", name:"Postosuchus",    period:"Triassic", diet:["carnivore"], predator:true, price:14000, food:130, space:700,  group:[1,3],  appeal:9,  stars:2},
  {id:"eryt", name:"Erythrosuchus",  period:"Triassic", diet:["carnivore"], predator:true, price:14000, food:140, space:800, group:[1,3], appeal:9, stars:2},
  {id:"liso", name:"Lisowicia",      period:"Triassic", diet:["herbivore"], price:16000, food:220, space:1300, group:[1,4], appeal:10, stars:2},
  // Jurassic
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
  // Cretaceous
  {id:"hyps", name:"Hypsilophodon",  period:"Cretaceous", diet:["herbivore"], price:4000,  food:40,  space:150,  group:[3,8],  appeal:3,  stars:0,   },
  {id:"beel", name:"Beelzebufo",     period:"Cretaceous", diet:["carnivore"], price:4000, food:8, space:8, group:[1,4], appeal:5, stars:0.5, viv:"M"},
  {id:"mono", name:"Mononykus",      period:"Cretaceous", diet:["insectivore"], price:4500, food:5, space:6, group:[2,8], appeal:4, stars:0.5, viv:"S"},
  {id:"mcer", name:"Microceratus",   period:"Cretaceous", diet:["herbivore"], price:4500, food:6, space:8, group:[3,10], appeal:4, stars:0.5, viv:"S"},
  {id:"scan", name:"Scansoriopteryx", period:"Cretaceous", diet:["insectivore"], price:4500, food:4, space:5, group:[2,8], appeal:5, stars:0.5, viv:"S"},
  {id:"micr", name:"Microraptor",    period:"Cretaceous", diet:["carnivore","piscivore"], price:6000,  food:10,  space:12,   group:[2,6],  appeal:6,  stars:1,   viv:"M"},
  {id:"psit", name:"Psittacosaurus", period:"Cretaceous", diet:["herbivore"], price:6000,  food:50,  space:200,  group:[3,10], appeal:4,  stars:0.5},
  {id:"prot", name:"Protoceratops",  period:"Cretaceous", diet:["herbivore"], price:7000,  food:70,  space:250,  group:[2,8],  appeal:5,  stars:1.5},
  {id:"ornm", name:"Ornithomimus",   period:"Cretaceous", diet:["herbivore","insectivore"], price:7000, food:60, space:250, group:[3,10], appeal:5, stars:1},
  {id:"kool", name:"Koolasuchus",    period:"Cretaceous", diet:["piscivore"], price:7000, food:30, space:30, group:[1,3], appeal:6, stars:1, viv:"L"},
  {id:"simo", name:"Simosuchus",     period:"Cretaceous", diet:["herbivore"], price:5500, food:14, space:14, group:[2,5], appeal:3, stars:0.5, viv:"M"},
  {id:"ovir", name:"Oviraptor",      period:"Cretaceous", diet:["omnivore"], price:8000,  food:60,  space:250,  group:[2,8],  appeal:5,  stars:1},
  {id:"minm", name:"Minmi",          period:"Cretaceous", diet:["herbivore"], price:8000, food:70, space:300, group:[2,8], appeal:5, stars:1},
  {id:"gall", name:"Gallimimus",     period:"Cretaceous", diet:["omnivore"], price:9000, food:90, space:400, group:[3,10], appeal:6, stars:1.5},
  {id:"para", name:"Parasaurolophus", period:"Cretaceous", diet:["herbivore"], price:14000, food:180, space:900,  group:[3,10], appeal:8,  stars:2},
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
  {id:"spin", name:"Spinosaurus",    period:"Cretaceous", diet:["piscivore","carnivore"], price:55000, food:600, space:3500, group:[1,2],  appeal:20, stars:4},
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
  {id:"proc", name:"Proconsul",      period:"Paleogene", diet:["herbivore"], price:6000, food:50, space:150, group:[4,12], appeal:5, stars:1},
  {id:"hyae", name:"Hyaenodon",      period:"Paleogene", diet:["carnivore"], predator:true, price:9000,  food:80,  space:500,  group:[3,8],  appeal:7,  stars:1.5},
  {id:"ambu", name:"Ambulocetus",    period:"Paleogene", diet:["piscivore","carnivore"], price:12000, food:110, space:700,  group:[1,3],  appeal:8,  stars:2},
  {id:"uint", name:"Uintatherium",   period:"Paleogene", diet:["herbivore"], price:17000, food:200, space:1100, group:[2,5], appeal:10, stars:2},
  {id:"andr", name:"Andrewsarchus",  period:"Paleogene", diet:["carnivore","omnivore"], predator:true, price:20000, food:200, space:1200, group:[1,2],  appeal:11, stars:2.5},
  {id:"bari", name:"Barinasuchus",   period:"Paleogene", diet:["carnivore"], predator:true, price:20000, food:180, space:1100, group:[1,2],  appeal:10, stars:2.5},
  {id:"arge", name:"Argentavis",     period:"Paleogene", diet:["carnivore"], price:22000, food:150, space:800, group:[1,3], appeal:13, stars:3},
  {id:"arsi", name:"Arsinoitherium", period:"Paleogene", diet:["herbivore"], price:24000, food:280, space:1800, group:[1,4], appeal:12, stars:3},
  {id:"tita", name:"Titanoboa",      period:"Paleogene", diet:["carnivore","piscivore"], predator:true, price:30000, food:250, space:1500, group:[1,2],  appeal:16, stars:3},
  // Neogene
  {id:"dino", name:"Dinopithecus",   period:"Neogene", diet:["omnivore"], price:7000, food:70, space:250, group:[4,12], appeal:6, stars:1},
  {id:"daeo", name:"Daeodon",        period:"Neogene", diet:["omnivore"], predator:true, price:11000, food:120, space:700,  group:[2,5],  appeal:8,  stars:1.5},
  {id:"aepy", name:"Aepycamelus",    period:"Neogene", diet:["herbivore"], price:12000, food:130, space:800, group:[2,6], appeal:7, stars:1.5},
  {id:"kele", name:"Kelenken",       period:"Neogene", diet:["carnivore"], predator:true, price:14000, food:100, space:700,  group:[1,3],  appeal:10, stars:2},
  {id:"thyl", name:"Thylacoleo",     period:"Neogene", diet:["carnivore"], predator:true, price:14000, food:110, space:500, group:[1,3], appeal:10, stars:2},
  {id:"mchl", name:"Megalochelys",   period:"Neogene", diet:["herbivore"], price:14000, food:120, space:900, group:[1,4], appeal:9, stars:2},
  {id:"chal", name:"Chalicotherium", period:"Neogene", diet:["herbivore"], price:15000, food:180, space:1000, group:[2,5], appeal:8, stars:2},
  {id:"aind", name:"Archaeoindris",  period:"Neogene", diet:["herbivore"], price:16000, food:180, space:900, group:[1,4], appeal:9, stars:2},
  {id:"drom", name:"Dromornis",      period:"Neogene", diet:["carnivore"], predator:true, price:18000, food:150, space:1000, group:[1,3], appeal:10, stars:2.5},
  {id:"plty", name:"Platybelodon",   period:"Neogene", diet:["herbivore"], price:20000, food:250, space:1500, group:[2,6],  appeal:10, stars:2.5},
  {id:"amph", name:"Amphicyon",      period:"Neogene", diet:["carnivore"], predator:true, price:20000, food:200, space:1100, group:[1,3], appeal:12, stars:2.5},
  {id:"gpit", name:"Gigantopithecus", period:"Neogene", diet:["herbivore"], price:22000, food:260, space:1400, group:[1,4], appeal:12, stars:2.5},
  {id:"siva", name:"Sivatherium",    period:"Neogene", diet:["herbivore"], price:25000, food:300, space:2000, group:[1,4], appeal:12, stars:3},
  {id:"pcer", name:"Paraceratherium", period:"Neogene", diet:["herbivore"], price:40000, food:550, space:4000, group:[1,4],  appeal:17, stars:3.5},
  {id:"dgal", name:"Deinogalerix",   period:"Neogene", diet:["insectivore","carnivore"], price:5500, food:10, space:12, group:[1,4], appeal:3, stars:0.5, viv:"M"},
  {id:"nura", name:"Nuralagus rex",  period:"Neogene", diet:["herbivore"], price:9000, food:16, space:20, group:[2,6], appeal:4, stars:1, viv:"L"},
  {id:"hopl", name:"Hoplitomeryx",   period:"Neogene", diet:["herbivore"], price:11000, food:22, space:26, group:[2,5], appeal:5, stars:1, viv:"L"},
  {id:"psil", name:"Psilopterus",    period:"Neogene", diet:["carnivore"], price:10000, food:20, space:26, group:[1,3], appeal:4, stars:1, viv:"L"},
  // Quaternary
  {id:"ornw", name:"Ornimegalonyx",  period:"Quaternary", diet:["carnivore"], price:6000, food:25, space:14, group:[1,3], appeal:7, stars:1, viv:"M"},
  {id:"dodo", name:"Dodo",           period:"Quaternary", diet:["herbivore"], price:14000, food:24, space:30, group:[2,5], appeal:6, stars:1.5, viv:"L"},
  {id:"ppig", name:"Passenger Pigeon", period:"Quaternary", diet:["herbivore"], price:2600, food:3, space:4, group:[3,10], appeal:2, stars:0, viv:"S"},
  {id:"gtod", name:"Golden Toad",    period:"Quaternary", diet:["insectivore"], price:2800, food:3, space:4, group:[3,10], appeal:2, stars:0, viv:"S"},
  {id:"rmlo", name:"Rocky Mountain Locust", period:"Quaternary", diet:["herbivore"], bug:true, price:2400, food:3, space:4, group:[4,12], appeal:2, stars:0, viv:"S"},
  {id:"sdel", name:"Sicilian Dwarf Elephant", period:"Quaternary", diet:["herbivore"], price:15000, food:28, space:40, group:[1,3], appeal:6, stars:1.5, viv:"L"},
  {id:"dire", name:"Dire wolf",      period:"Quaternary", diet:["carnivore"], predator:true, price:11000, food:90,  space:500,  group:[3,8],  appeal:8,  stars:2},
  {id:"macr", name:"Macrauchenia",   period:"Quaternary", diet:["herbivore"], price:13000, food:150, space:900, group:[2,6], appeal:8, stars:2},
  {id:"arct", name:"Arctodus",       period:"Quaternary", diet:["omnivore","carnivore"], predator:true, price:17000, food:160, space:1000, group:[1,2],  appeal:11, stars:2.5},
  {id:"doed", name:"Doedicurus",     period:"Quaternary", diet:["herbivore"], price:18000, food:200, space:1100, group:[1,4], appeal:10, stars:2.5},
  {id:"mgth", name:"Megatherium",    period:"Quaternary", diet:["herbivore"], price:20000, food:260, space:1500, group:[1,4],  appeal:11, stars:2.5},
  {id:"mlan", name:"Megalania",      period:"Quaternary", diet:["carnivore"], predator:true, price:22000, food:180, space:1200, group:[1,2],  appeal:12, stars:2.5},
  {id:"smil", name:"Smilodon",       period:"Quaternary", diet:["carnivore"], predator:true, price:18000, food:150, space:900,  group:[2,5],  appeal:11, stars:3},
  {id:"mast", name:"American mastodon", period:"Quaternary", diet:["herbivore"], price:24000, food:300, space:1900, group:[2,8],  appeal:12, stars:3},
  {id:"elas", name:"Elasmotherium",  period:"Quaternary", diet:["herbivore"], price:22000, food:280, space:1800, group:[1,4],  appeal:12, stars:3},
  {id:"mamm", name:"Woolly mammoth", period:"Quaternary", diet:["herbivore"], price:26000, food:320, space:2000, group:[2,8],  appeal:13, stars:3},
  {id:"colm", name:"Columbian mammoth", period:"Quaternary", diet:["herbivore"], price:30000, food:380, space:2400, group:[2,6], appeal:14, stars:3.5},
];

// Vivariums: ready-made glass enclosures for small animals. Placed like buildings.
// w and d are the size in meters; the inside space is w × d.
const VIVARIUMS = {
  S: {label:"Small vivarium",  w:6,  d:4,  price:3000,  upkeep:30},
  M: {label:"Medium vivarium", w:10, d:6,  price:7000,  upkeep:60},
  L: {label:"Large vivarium",  w:16, d:10, price:15000, upkeep:120},
};

/* ---------------------------------------------------------------------
   SCIENCE: ORACLE, GHOST, and TAR
   --------------------------------------------------------------------- */

// Time periods GHOST can travel to.
//   research   base ORACLE research points to unlock an animal from here (bigger and pricier animals cost more)
//   trip       what one expedition costs for a mid-size animal
//   days       how long an expedition takes, in open days
//   risk       extra chance an expedition comes back with nothing. Big animals add more (see TRIP).
//   quality    [worst, best] DNA quality a sample can have. Deeper time gives worse DNA.
const TIME_PERIODS = [
  {id:"Quaternary",    ago:"2.6 million years ago to today", research:20,  trip:3000,  days:1.5, risk:.05, quality:[70,100]},
  {id:"Neogene",       ago:"23–2.6 million years ago", research:30,  trip:3500,  days:1.5, risk:.07, quality:[65,98]},
  {id:"Paleogene",     ago:"66–23 million years ago",  research:40,  trip:4500,  days:1.5, risk:.10, quality:[60,96]},
  {id:"Cretaceous",    ago:"145–66 million years ago",  research:60,  trip:7500,  days:2.5, risk:.15, quality:[55,95]},
  {id:"Jurassic",      ago:"201–145 million years ago", research:70,  trip:7000,  days:2.5, risk:.15, quality:[50,90]},
  {id:"Triassic",      ago:"252–201 million years ago", research:50,  trip:5000,  days:2.5, risk:.12, quality:[45,88]},
  {id:"Permian",       ago:"299–252 million years ago", research:40,  trip:4500,  days:1.5, risk:.12, quality:[40,85]},
  {id:"Carboniferous", ago:"359–299 million years ago", research:30,  trip:4000,  days:1.5, risk:.10, quality:[35,80]},
  {id:"Devonian",      ago:"419–359 million years ago", research:25,  trip:3500,  days:1.5, risk:.10, quality:[30,75]},
];

// Science staff, hired at their department's building
//   dept       the building they work in
//   hireCost   one-time cost to hire
//   wage       pay per day
const SCIENTISTS = {
  paleo:    {label:"Researcher",         plural:"Researchers",         dept:"oracle", hireCost:3000, wage:250,
             text:"Each one runs one research bay. Left on general research, a researcher earns 4 research points a day. Put them on a project and they stop earning until it is done."},
  temporal: {label:"Temporal Researcher", plural:"Temporal Researchers", dept:"ghost",  hireCost:4000, wage:400,
             text:"Each one runs an expedition bay with one team. More researchers means more trips at the same time."},
  gene:     {label:"Geneticist",          plural:"Geneticists",          dept:"tar",    hireCost:3500, wage:350,
             text:"Each one runs an incubator bay, so TAR can grow that many clones at the same time."},
  botanist: {label:"Botanist",            plural:"Botanists",            dept:"ceres",  hireCost:3000, wage:300,
             text:"Each one tends a growing bed, so CERES can grow that many batches at the same time."},
};
const RESEARCH_PER_PALEO = 4;   // research points each researcher earns per open day while they're on general research (no project)
const RESEARCH_GUEST = .03;     // research points a guest adds on leaving, times how much they learned (0 to 1). Educated crowds fund science.
// How long research takes, in park minutes per point. A 60-point project is 2 open days.
const RESEARCH_MIN_PER_POINT = DAY_MIN / 30;
// What unlocking one animal's genome costs at ORACLE: its period's base plus this much for every $ of its price
const UNLOCK_PER_PRICE = 1 / 1000;
// Each animal already unlocked makes the next one this much dearer, so points never pile up late in the game
const UNLOCK_GROWTH = .04;

// Expeditions. A trip either finds something or comes back empty-handed, and a find fills part of a genome.
// Bigger animals are harder to find, and a genome takes about 2 trips for the smallest and 8 for the largest.
//   fail     chance of nothing, before the period's own risk: [smallest animal, largest animal]
//   trips    trips a genome takes on average: [smallest, largest]
//   spread   a find is worth between this share less and this share more than average
//   costMul  trip price multiplier: [smallest, largest]
//   bonus    chance a trip also turns up traces of another unlocked animal from that period, and what they add
const TRIP = {fail:[.1, .35], trips:[2, 8], spread:.35, costMul:[.35, 1.3], bonus:{chance:.12, gain:[4, 8]}};
// Size scale for TRIP: m² of room an animal needs at or below the first, and at or above the second
const TRIP_SIZE = [10, 5000];

// Plant genomes, one per Mesozoic or Paleozoic period. GHOST collects each from its own period, once ORACLE has researched that era's flora.
// CERES needs a period's genome complete before it grows that period's plants (and any complete one lets it grow Paleoflora food).
//   space   how hard it is to find, like an animal's room (see TRIP_SIZE)
const PLANT_DNA = {};
for(const [period, era, space] of [["Devonian", "paleozoic", 900], ["Carboniferous", "paleozoic", 900], ["Permian", "paleozoic", 900],
                                   ["Triassic", "mesozoic", 300], ["Jurassic", "mesozoic", 300], ["Cretaceous", "mesozoic", 300]])
  PLANT_DNA[period] = {id:"flora-" + period, era, period, name:period + " flora", space};
const PLANT_DNA_BY_ID = Object.fromEntries(Object.values(PLANT_DNA).map(p => [p.id, p]));

// Events from deep time. GHOST records each one on trips (like a genome: sc.dna[id]), and a finished record unlocks a museum
// attraction for the Education Center. A trip's place is the event itself, so it carries what a TIME_PERIODS entry does.
//   ago/trip/days/risk/quality/space   as for a period and a genome (space is how hard it is to record, see TRIP_SIZE)
//   price/upkeep   installing it in an Education Center, and its cost a day
//   learn   extra learning a visit gives (0 to 100 per guest), scaled by the record's quality
//   joy     mood it adds or takes away. appeal: how much keener guests are to visit the center for it
const MUSEUM_EVENTS = [
  {id:"ev-oxygen",    name:"Great Oxygenation Event", ago:"2.4 billion years ago",  trip:6500,  days:3,   risk:.20, quality:[30,75], space:600,  price:6000,  upkeep:60,  learn:6,  joy:1, appeal:4,
   text:"Walk through a glowing blue-green sea as the first oxygen-makers poison the old air and the iron rusts red."},
  {id:"ev-hadean",    name:"Hadean Earth",            ago:"4.5 billion years ago",  trip:9000,  days:3.5, risk:.25, quality:[25,70], space:1500, price:9000,  upkeep:90,  learn:7,  joy:3, appeal:9,
   text:"A hall of lava seas, a sky full of rocks, and the Moon hanging huge and close. Nothing lives here yet."},
  {id:"ev-cambrian",  name:"Cambrian Explosion",      ago:"539 million years ago",  trip:7000,  days:2.5, risk:.15, quality:[35,80], space:800,  price:8000,  upkeep:80,  learn:8,  joy:3, appeal:8,
   text:"A reef tank of trilobites, spined worms and Anomalocaris, when nearly every kind of body suddenly appeared."},
  {id:"ev-tetrapods", name:"Evolution of Tetrapods",  ago:"375 million years ago",  trip:5500,  days:2,   risk:.12, quality:[35,80], space:700,  price:7000,  upkeep:70,  learn:7,  joy:2, appeal:6,
   text:"Follow a Tiktaalik-like fish from the shallows up onto the mud, as fins turn into legs."},
  {id:"ev-dying",     name:"The Great Dying",         ago:"252 million years ago",  trip:7500,  days:2.5, risk:.18, quality:[40,85], space:1000, price:9000,  upkeep:90,  learn:10, joy:-3, appeal:7,
   text:"The worst mass extinction there ever was, told in a dim hall of volcanoes and a dying sea. Sobering."},
  {id:"ev-kpg",       name:"K-Pg Impact",             ago:"66 million years ago",   trip:8000,  days:2.5, risk:.15, quality:[45,90], space:1200, price:10000, upkeep:100, learn:9,  joy:1, appeal:12,
   text:"A shaking floor, a fireball overhead, and the end of the dinosaurs. A crowd favorite."},
];
const MUSEUM_BY_ID = Object.fromEntries(MUSEUM_EVENTS.map(e => [e.id, e]));
const MUSEUM = {
  slots:3,             // attractions one Education Center can show at once
  minQuality:.6,       // an attraction built on the worst record teaches this share of its learning (the best teaches all of it)
  needTech:"education",// GHOST can start recording events once ORACLE has researched this
};

// What an Education Center is for. A center with a focus gets its effect every visit, times its strength:
// 1 plus the boost each installed module gives that focus. Pick it in the center's panel.
//   donate   dollars a guest drops in the box per visit. appeal: keenness to visit. joy/learn: mood and learning per visit.
//   science  ORACLE research points a guest's visit adds
const EDU_FOCUS = {
  conservation:{label:"Conservation", donate:2.5, text:"Guests give to the cause. Donations on every visit."},
  spectacle:   {label:"Spectacle",    appeal:12,  text:"A show worth walking across the park for. Guests are keener to come."},
  family:      {label:"Family",       joy:5, learn:4, text:"Made for kids and parents. Guests leave happier and know more."},
  research:    {label:"Research",     science:.06, text:"Visitors help real science. Every visit earns ORACLE research points."},
};
// Modules added to a center (ORACLE tech `tech`, which needs education programs). Each also teaches on its own.
//   boost    adds to the strength of those focuses
//   slots    more guests that can sit through a visit at once
//   perSpecies  learning grows with the animals ORACLE has unlocked
//   live     the module shows real work, so its effects scale with how busy that is (`modLive` in services.js): "lab", "nursery", "botany", "sim", "biomes" or "touch"
//   dept     science buildings it needs (any one of them) before it can be installed
const EDU_MODULES = {
  theater:   {label:"Theater",          tech:"edtheater",   price:12000, upkeep:110, learn:3, joy:2, appeal:5, boost:{spectacle:.6, family:.3},
              text:"A stage for puppet shows and animal talks. Crowds love it."},
  fossils:   {label:"Fossil Displays",  tech:"edfossils",   price:10000, upkeep:80,  learn:6, perSpecies:true, boost:{research:.5, conservation:.25},
              text:"Real casts and bones. It teaches more as ORACLE unlocks more animals."},
  auditorium:{label:"Education Auditorium", tech:"edauditorium", price:16000, upkeep:130, learn:5, slots:8, boost:{conservation:.5, research:.3},
              text:"Tiered seating for lectures. More guests can sit through a talk at once."},
  labwindow: {label:"Live Lab Window",  tech:"edlabwindow", price:14000, upkeep:120, learn:5, joy:1, appeal:4, live:"lab", dept:["oracle", "ghost", "tar", "ceres"], boost:{research:.6, conservation:.3, family:.2},
              text:"A gallery over the working labs. It's only as good as what's going on: ORACLE, GHOST, TAR and CERES all busy makes the best show."},
  nursery:   {label:"Nursery Window",   tech:"ednursery",   price:11000, upkeep:100, learn:3, joy:4, appeal:6, live:"nursery", dept:["tar"], boost:{family:.7, conservation:.3, spectacle:.2},
              text:"Watch clones in the incubators, and the day one hatches. Needs TAR, and the best shows are while clones are growing."},
  botanical: {label:"Botanical Hall",   tech:"edbotanical", price:13000, upkeep:110, learn:5, joy:3, appeal:3, live:"botany", dept:["ceres"], boost:{conservation:.6, family:.4, research:.2},
              text:"A glasshouse of living prehistoric plants from CERES. It grows richer as more plant DNA is finished and while beds are growing."},
  simroom:   {label:"Simulation Room",  tech:"edsimroom",   price:18000, upkeep:150, learn:7, joy:3, appeal:8, live:"sim", dept:["ghost"], boost:{spectacle:.5, research:.5, family:.2},
              text:"A VR walk through deep time, built from GHOST's records. Every finished event record adds a place to visit."},
  diorama:   {label:"Ecosystem Diorama", tech:"ediorama",   price:12000, upkeep:100, learn:6, joy:2, appeal:5, live:"biomes", boost:{conservation:.5, family:.4, spectacle:.2},
              text:"A walk-around model of how living things fit together. It gets richer with every kind of habitat you keep animals in."},
  touch:     {label:"Touch Gallery",    tech:"edtouch",     price:9000,  upkeep:70,  learn:4, joy:5, appeal:3, live:"touch", boost:{family:.6, conservation:.3, research:.2},
              text:"Egg shells, casts, teeth and bones to hold. The shelves fill up as GHOST finishes more genomes."},
};
const EDU_LIVE = {idle:.3, nurseryIdle:.25, hatchBonus:.5, cap:1.5, simIdle:.2, simPlaces:4, biomes:4, genomes:8};   // a live module with nothing going on still works at this share
const EDU_CENTER = {moduleSlots:3};   // modules one Education Center can hold

// What one animal clone takes at TAR, in open days: 1 plus 1 more for every this many m² the species needs
const CLONE_DAYS_PER_SPACE = 1000;
// TAR upgrades, researched at ORACLE: each level of speed cuts clone time
const TAR_UPGRADE = {speed:.75};
// GHOST upgrades, researched at ORACLE: trip price and time multipliers per level, and quality points added to every sample
const GHOST_UPGRADE = {cost:[1, .8, .65], speed:[1, .75, .5], quality:[0, 8, 16]};

// What CERES grows in its beds. Works like TAR's incubators, but with plants.
//   days    how long one batch takes, in open days
//   cost    what one batch costs
//   doses   (medicine) doses one batch makes
const CERES_GROW = {
  medicine: {cenozoic:{days:.75, cost:900, doses:20}, mesozoic:{days:1.25, cost:1500, doses:20}, paleozoic:{days:1.75, cost:2200, doses:20}},
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
  Devonian:"#C28A4D", Carboniferous:"#67A599", Permian:"#F04028", Triassic:"#812B92", Jurassic:"#34B2C9",
  Cretaceous:"#7FC64E", Paleogene:"#FD9A52", Neogene:"#F2D32A", Quaternary:"#E8E27A"
};

// Species drawn with a picture instead of a dot: sprites/<id>.png standing, side-on and facing right, with the width over the height.
// walk is how many frames sprites/<id>-walk.png has, side by side, each the same size as the standing picture.
// idle is how many frames sprites/<id>-idle.png has (same strip format) and ms how long each shows. A picture with both walks on the walk strip and plays idle while it holds still;
// with only idle (no walk strip) the idle strip plays all the time in an open exhibit, and a vivarium animal plays it on its spot.
const SPRITES = {coty:{ratio:100/75, walk:4, step:.25, idle:8, ms:500}, coel:{ratio:100/75, walk:6, step:.15, size:1.4}, plat:{ratio:100/75, walk:6, step:.15, rig:1}, dime:{ratio:100/75, walk:4, step:.25}, tikt:{ratio:100/75, idle:2, ms:600}, lyst:{ratio:100/75, walk:4, step:.25, size:.7, idle:8, ms:520, rest:7, restMs:260, holdMs:1400}, prio:{ratio:100/75, walk:4, step:.25, idle:5, ms:500, swim:6, swimMs:180, rig:1, rstep:.04}};

// Partner parks sell a few starter species. Each new park gets one from pool A and two from pool B.
const STARTER_POOLS = {
  a:{pick:1, ids:["arth", "mega", "pulm", "dcau", "comp"]},
  b:{pick:2, ids:["lyst", "dryo", "hyps", "ovir", "psit", "coel", "sile", "orni", "hete"]},
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
  kiosk:     {label:"Food cart",   one:"a food cart",   glyph:"K", color:"#3F86A8", price:3000,  upkeep:30,  w:5,  d:4,  kind:"food",  menuSlots:1, slots:2,  serveMin:3},
  food:      {label:"Food stand",  one:"a food stand",  glyph:"D", color:"#2F6E8F", price:6000,  upkeep:60,  w:10, d:8,  kind:"food",  menuSlots:3, slots:4,  serveMin:4},
  restaurant:{label:"Restaurant",  one:"a restaurant",  glyph:"F", color:"#1F5470", price:20000, upkeep:220, w:18, d:14, kind:"food",  menuSlots:5, slots:10, serveMin:12, seats:true, minRating:2},
  cart:      {label:"Gift cart",   one:"a gift cart",   glyph:"C", color:"#A06A93", price:3000,  upkeep:30,  w:5,  d:4,  kind:"merch", menuSlots:1, slots:2,  serveMin:3},
  shop:      {label:"Gift stand",  one:"a gift stand",  glyph:"S", color:"#8C4F7D", price:6000,  upkeep:60,  w:10, d:8,  kind:"merch", menuSlots:3, slots:4,  serveMin:4},
  megastore: {label:"Gift shop",   one:"a gift shop",   glyph:"M", color:"#6E3661", price:20000, upkeep:220, w:18, d:14, kind:"merch", menuSlots:5, slots:10, serveMin:6, minRating:2},
  restroom:  {label:"Restrooms",   one:"restrooms",     glyph:"R", color:"#56708A", price:4000,  upkeep:40,  w:8,  d:6,  serves:["bladder"], slots:4, serveMin:3},
  // small things beside the path
  bin:       {label:"Trash bin",   one:"a trash bin",   glyph:"",  color:"#3C4A3F", price:150,   upkeep:1,   w:1.6, d:1.6, prop:true, onPath:true},
  bench:     {label:"Bench",       one:"a bench",       glyph:"",  color:"#8A6238", price:400,   upkeep:2,   w:3,  d:1.4, prop:true, onPath:true, serves:["energy"], seats:true, slots:2, serveMin:12, patience:2},
  picnic:    {label:"Picnic area", one:"a picnic area", glyph:"",  color:"#9C7A48", price:1500,  upkeep:6,   w:6,  d:5,  prop:true, serves:["energy"], seats:true, slots:5, serveMin:15, patience:3},
  lamp:      {label:"Lamp post",   one:"a lamp post",   glyph:"",  color:"#E3C04A", price:300,   upkeep:3,   w:1.2, d:1.2, prop:true, onPath:true},
  camera:    {label:"Security camera", one:"a security camera", glyph:"", color:"#2B3F6B", price:900, upkeep:4, tech:"cameras", w:1.2, d:1.2, prop:true, onPath:true},
  sign:      {label:"Info sign",   one:"an info sign",  glyph:"",  color:"#3B6FB6", price:250,   upkeep:1,   w:1.6, d:1,  prop:true, onPath:true},
  nofeed:    {label:"Do Not Feed sign", one:"a Do Not Feed sign", glyph:"", color:"#B5382E", price:200, upkeep:1, w:1.6, d:1, prop:true, onPath:true},
  // hotels: guests stay the night and spend the next day in the park
  lodge:     {label:"Safari Lodge", one:"a safari lodge", glyph:"L", color:"#7B5B3A", price:30000, upkeep:200, tech:"hotels", w:18, d:14, serves:["sleep"], rooms:20, roomPrice:120, minRating:3, minGuests:300},
  resort:    {label:"Resort Hotel", one:"a resort hotel", glyph:"H", color:"#A0473F", price:120000, upkeep:900, tech:"hotels", w:30, d:20, serves:["sleep"], rooms:80, roomPrice:180, minRating:4, minGuests:700},
  campground:{label:"Campground",   one:"a campground",   glyph:"G", color:"#4F7A3A", price:8000, upkeep:70, tech:"hotels", w:16, d:12, serves:["sleep"], rooms:10, roomPrice:60, minRating:2, minGuests:100},
  // guests learn about prehistoric life here
  edcenter:  {label:"Education Center", one:"an Education Center", glyph:"E", color:"#2F7A5A", price:12000, upkeep:90, w:16, d:12, serves:["learn"], slots:16, serveMin:20, patience:40, minRating:2, tech:"education"},
  // guests ride the tram between these; each sits beside a footpath and a tram track
  tramstop:  {label:"Tram station", one:"a tram station", glyph:"T", color:"#B5533C", price:6000, upkeep:60, w:10, d:5, tram:true, tech:"transit"},

  // Backstage science departments. You can have one of each. They must touch a path or service road.
  oracle:   {label:"ORACLE", one:"ORACLE", glyph:"O", color:"#4B3A8C", price:9000, upkeep:120, w:24, d:16, dept:true,
             full:"Operational Requests for Ancestral & Chronological Life Evidence",
             blurb:"The research hub. Unlocks animals, plants, medicine, fences, buildings, and TAR upgrades. Research takes time."},
  ghost:    {label:"GHOST",  one:"GHOST",  glyph:"G", color:"#1F6F73", price:15000, upkeep:200, w:28, d:20, dept:true,
             full:"Genetic Harvesting of Organic Specimens through Time",
             blurb:"The time travel unit. Sends teams to the periods of animals ORACLE has unlocked, and fills their genomes with DNA."},
  tar:      {label:"TAR",    one:"TAR",    glyph:"T", color:"#8E2F3A", price:12000, upkeep:160, w:26, d:18, dept:true,
             full:"Terrestrial Animal Reconstruction",
             blurb:"The cloning lab. Turns complete genomes into living animals."},
};

/* ---------------------------------------------------------------------
   GUESTS
   Guests come in parties. Needs run from 0 (fine) to 100 (desperate).
   --------------------------------------------------------------------- */
const GUEST = {
  drawPivot:25,        // species appeal is stretched around this: speciesDraw = pivot * (appeal / pivot) ^ drawPower, so a T. rex counts in full and cheap animals count for little
  drawPower:1.6,
  maxParties:1200,     // parties on the map at once; past this, newcomers join a party already there
  sizes:[1, 2, 2, 2, 3, 3, 4, 4],   // party sizes, picked at random
  stay:[180, 360],     // minutes a party plans to spend before heading home, before dividing by pace (slower guests stay longer, so they see the same amount)
  cash:[20, 45],       // money each guest brings to spend inside
  speed:[.85, 1.15],   // each party's own pace, times pace, times WALK_PER_MIN
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
/* ---------------------------------------------------------------------
   GUEST PERSONALITIES
   Every party has a primary and a secondary personality. The primary pulls in full and the
   secondary PERS.second as hard. Each personality has:
     weight  odds of being picked (primary, then secondary from what's left)
     fx      multipliers on how the party behaves (1 is neutral; read through pm() in personas.js):
             food, shop, museum (will buy), donate, learn, infra (mood lost to needs, litter, crowds),
             ticket (how dear a ticket can be before they grumble), price (price sensitivity), patience,
             walk (mood lost to being on their feet), decor, broken, toilet (filthy restrooms), litter,
             flee / fleeHurt (how they take a loose predator), need {energy, bladder} (how fast they build)
     n       numbers its exhibit tastes and reactions use (see personas.js)
   --------------------------------------------------------------------- */
const PERS = {
  second:.5,           // the secondary personality counts for this share of the primary's pull
  ejectWait:240,       // minutes a call to security waits before the party carries on
  ejectMood:25,        // mood a party loses when security walks it to the gate
  escortRadius:30,     // a guard this close to a waiting party can take it to the gate
  activeActs:["hunt", "patrol", "pace", "play"],   // what animals do that counts as visibly active
  rarePrice:9000,      // a species this dear counts as rare
  hooligan:{sneak:.35, tease:.03, stress:18},   // chance a hooligan party skips the ticket; chance each minute at a fence of banging on the glass; stress it gives the animals
};
const PERSONALITIES = {
  thrill:{label:"Thrill Seeker", color:"#E5484D", weight:.16,
    text:"Wants big predators and animals that look dangerous. Bored by calm herbivores and long walks. Spends on viewing, little on food and gifts.",
    fx:{food:.7, shop:.6, walk:1.4, flee:.5, fleeHurt:.3, patience:.9},
    n:{danger:7, active:4, platform:3, tame:3, slow:2, tasteDanger:1.5, tasteActive:.5, tasteTame:.5, center:1, spectacle:1.6}},
  conserv:{label:"Conservationist", color:"#3E9B4F", weight:.12,
    text:"Cares how the animals are treated: roomy, well-kept exhibits, rare species, research and education. Gives to conservation. Hates a park that feels like pure entertainment.",
    fx:{donate:3, learn:1.3, shop:.9},
    n:{well:5, poor:8, rare:5, stress:4, showy:6, showyBelow:15, tasteWelfare:.8, tasteRare:.5, center:1.8}},
  paleo:{label:"Paleo-Nerd", color:"#8A5CC2", weight:.14,
    text:"Wants variety and accuracy: many species across the eras, complete genomes, signs and museum shows. Bored by repeats and by low-genome clones.",
    fx:{learn:1.4, museum:1.4, food:.9},
    n:{species:2.5, era:4, repeat:2.5, accurate:3, guess:5, nosign:2, collection:10, tasteNew:1.8, tasteOld:.6, center:1.5}},
  family:{label:"Family Focused", color:"#2F86C8", weight:.26,
    text:"Wants a safe, easy day: gentle herbivores, short walks, clean restrooms, benches, cheap food and a fair ticket. Punishes bad infrastructure harder than anyone.",
    fx:{infra:1.6, ticket:.85, price:1.4, patience:.8, walk:1.3, food:1.15, shop:1.1, toilet:2, need:{energy:1.25, bladder:1.15}},
    n:{kids:5, scary:5, gory:4, tasteKids:1, tasteScary:.5, center:1.3}},
  fun:{label:"Fun Lover", color:"#E3B23C", weight:.26,
    text:"Here for a good time with no strong preferences. Likes good food and a nice atmosphere. Hates boredom, lines and anything broken.",
    fx:{patience:.8, decor:1.3, food:1.2, shop:1.1, broken:1.5},
    n:{variety:2}},
  hooligan:{label:"Hooligan", color:"#E0509B", weight:.06,
    text:"Here to cause trouble. May sneak in without paying, drops litter, vandalizes, throws trash at the animals and bangs on the glass. Security has to catch them.",
    fx:{food:.8, shop:.5, learn:.5, litter:3},
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
};

// Each vivarium size is also a building you can place
for(const [size, v] of Object.entries(VIVARIUMS))
  BUILDINGS["viv" + size] = {label:v.label, one:"a " + v.label.toLowerCase(), glyph:"V" + size, color:"#5E9AA6", price:v.price, upkeep:v.upkeep, w:v.w, d:v.d, viv:size};

/* ---------------------------------------------------------------------
   KEEPERS
   --------------------------------------------------------------------- */
const KEEPER = {
  hireCost:2000,       // one-time cost to hire a keeper
  wage:120,            // each keeper's pay per day
  carry:40,            // food units a keeper can carry by hand
  speed:WALK_PER_MIN,  // keepers walk at the same pace as guests
  tirePerMeter:.03,    // stamina lost per meter walked
  tirePerDelivery:2,   // stamina lost loading or unloading
  restBelow:25,        // keepers take a break when stamina drops under this
  topUpBelow:.6,       // keepers only set out to feed an exhibit once its food drops under this share of a full store
  restPerMin:2,        // stamina regained per minute in a break room (a quarter of that resting at a station)
};
// Staff overview: energy and morale for every hired worker (keepers tire by walking, so theirs lives in KEEPER)
const STAFF = {
  workDrain:.1,        // energy a mechanic, vet, custodian or guard loses per minute on a task
  idleDrain:.03,       // and per minute waiting around
  moraleStep:200,      // morale closes the gap to what the job gives them over about this many minutes
  startMorale:70,
  worked:[.35, .85],   // a share of the day spent working that feels like a good day (less is boring, more is a grind)
  minSample:60,        // minutes on the clock before work-share thoughts count
};
const FOOD_UNIT_COST = 20;   // one food unit per $20 of an animal's daily food cost
const STORE_DAYS = 1.5;      // exhibits hold this many days of food
const GATE_COST = 1500;
const GATE_REACH = 4;        // a gate counts as on a road within this many meters

const FOOD_COLOR = {plants:"#6BAA3A", paleoflora:"#1F8A70", meat:"#B23A2E", fish:"#3A7FB2", insects:"#B28A2E"};

// Staff buildings. They go beside a path or service road.
BUILDINGS.station   = {label:"Keeper Station", tag:"KEEPERS", one:"a keeper station", glyph:"K", color:"#3F6B2E", price:4000, upkeep:80, w:14, d:10, dept:true,
                       full:"Food storage and keeper lockers", blurb:"Keepers start here, load food here, and swap food types here."};
BUILDINGS.breakroom = {label:"Break Room", tag:"BREAK", one:"a break room", glyph:"B", color:"#7A5A2E", price:2500, upkeep:40, w:10, d:8, dept:true,
                       full:"Break room and locker room", blurb:"Tired keepers rest here four times faster than at a station."};
BUILDINGS.toolshed  = {label:"Tool Shed", tag:"SHED", one:"a tool shed", glyph:"S", color:"#5B6470", price:2000, upkeep:30, w:10, d:8, dept:true, unique:true,
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
  speed:WALK_PER_MIN,  // custodians walk at the same pace as guests
  carry:100,           // units of stock they carry per trip
  scrubPerMin:4,       // restroom dirt cleaned each minute
  sweepPerMin:2,       // pieces of litter picked up each minute
  emptyMin:3,          // minutes to empty a bin
  restroomAt:25,       // they scrub a restroom this dirty
  binAt:.6,            // they empty a bin this full
  litterAt:3,          // they sweep a square with this much litter
  reach:30,            // they sweep litter this close to where they stand
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
  eat:.12,             // chance a night an animal eats trash, for each piece per animal in the exhibit (capped at eatMax)
  eatMax:.6,
  deadly:.02,          // share of animals that eat trash and die at once, rather than falling ill
  sev:50,              // how bad the illness starts when one eats trash (0 to 100)
  worsen:25,           // and how much worse it gets each night untreated: dead in two nights
  sevCap:70,           // an animal already sick gets worse from trash, but not past this, so a vet still has a night
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
  stayBoost:120,       // and stay this many minutes longer
};
// Security guards patrol the paths, put vandals off, and throw out the ones they catch
const SECURITY = {
  hireCost:2000,
  wage:140,
  speed:WALK_PER_MIN,  // guards walk at the same pace as guests
  deterRadius:25,      // vandalism near a guard is much rarer
  deterCut:.3,
  catchRadius:15,      // a guard catches a vandal this close
  cameraRadius:60,     // with cameras, each Security Office watches this far
  postRadius:30,       // and each working camera post on a path watches this far
  evacRadius:50,       // during an escape, guards send guests this close toward the gate
  patrolWait:8,        // minutes a guard stands at each stop
};
BUILDINGS.security = {label:"Security Office", tag:"SECURITY", one:"a security office", glyph:"P", color:"#2B3F6B", price:4000, upkeep:60, tech:"security", w:12, d:9, dept:true,
                      full:"Park security", blurb:"Guards start here. They patrol the paths, put rowdy guests off, throw out vandals, and steer guests to the gate during escapes."};
BUILDINGS.closet = {label:"Custodial Closet", tag:"JANITOR", one:"a custodial closet", glyph:"J", color:"#2E8B8B", price:2000, upkeep:30, w:10, d:8, dept:true,
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
//   tech       what ORACLE has to research first
const BARRIERS = {
  wood:     {label:"Wooden fence",      strength:25,  perMeter:0,   view:1.0,  tech:null,       color:"#3B3226"},
  hedge:    {label:"Hedge row",         strength:12,  perMeter:5,   view:.85,  tech:null,       color:"#3F6B35", hedge:true},
  bars:     {label:"Metal bars",        strength:45,  perMeter:40,  view:.95,  tech:"bars",     color:"#4A4F57"},
  electric: {label:"Electrified fence", strength:65,  perMeter:60,  view:.95,  tech:"electric", color:"#D8B04A"},
  acrylic:  {label:"Acrylic wall",      strength:85,  perMeter:150, view:1.1,  tech:"acrylic",  color:"#8CCBDA"},
  concrete: {label:"Concrete wall",     strength:140, perMeter:90,  view:.45,  tech:"concrete", color:"#9A958C"},
};

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

// Clever animals that test and attack their fences, like predators do
const SMART = ["velo", "utah", "dire", "arct", "andr", "kele", "hyae"];

const MAINT = {
  attackWear:4,        // condition lost per day by each attacking animal (more if it's much stronger than the fence)
  inspectEvery:2,      // days between inspections before a fence is overdue
  repairBelow:85,      // mechanics fix fences under this condition
  inspectMinutes:5,    // time to inspect a fence
  repairPerMinute:4,   // condition restored per minute of work
  speed:WALK_PER_MIN,  // mechanics walk at the same pace as guests
  hireCost:2000,
  wage:150,
};
BUILDINGS.workshop = {label:"Workshop", tag:"SHOP", one:"a workshop", glyph:"W", color:"#B8642A", price:3500, upkeep:50, w:12, d:10, dept:true,
                      full:"Maintenance workshop", blurb:"Mechanics are based here. They inspect and repair exhibit barriers."};

/* ---------------------------------------------------------------------
   PALEOFLORA AND CERES
   --------------------------------------------------------------------- */

// Which era each period belongs to
const ERA_OF = {Devonian:"paleozoic", Carboniferous:"paleozoic", Permian:"paleozoic", Triassic:"mesozoic", Jurassic:"mesozoic", Cretaceous:"mesozoic",
                Paleogene:"cenozoic", Neogene:"cenozoic", Quaternary:"cenozoic"};

// What an exhibit is planted with. Every exhibit starts with Cenozoic plants (grass).
//   tech     what ORACLE has to research first
const FLORA = {
  cenozoic:  {label:"Cenozoic",  plants:"grasses and flowering plants",              tech:null},
  mesozoic:  {label:"Mesozoic",  plants:"cycads, conifers, ginkgos, and ferns",      tech:"mesoplant"},
  paleozoic: {label:"Paleozoic", plants:"lycopod trees, horsetails, and seed ferns", tech:"paleoplant"},
};
// CERES makes Paleoflora food at a steady rate and keeps a stock of it
const PALEOFLORA = {
  perDay:60,          // units CERES grows each day on its own
  greenhouse:40,      // extra units per day from each greenhouse
  storeDays:2,        // CERES holds this many days of production
};
const FLORA_HAPPY = {home:6, away:-4};     // happiness for living among plants from the animal's own era, or another one
// Herbivores from these periods never evolved to eat grass, and get sick on it (Cenozoic plants, a grassland biome or grass hay)
const GRASS_INTOLERANT = ["Devonian", "Carboniferous", "Permian", "Triassic", "Jurassic"];
const GRASS_HIT = {intolerant:-15, cretaceous:-5};   // happiness hit at full grass share

BUILDINGS.ceres = {label:"CERES", tag:"CERES", one:"CERES", glyph:"C", color:"#4E7F2E", price:10000, upkeep:120, w:26, d:18, dept:true, unique:true,
                   full:"Cultivated Ecosystem Rations & Environmental Synthesis",
                   blurb:"The greenhouse lab. Grows Paleoflora food for prehistoric plant-eaters, plants for exhibits, and medicine for the PMC, once ORACLE has unlocked them and GHOST has found the plant DNA. Keepers collect Paleoflora here."};
// Greenhouses speed up Paleoflora. They need the research and a CERES in the park.
BUILDINGS.greenhouse = {label:"Greenhouse", tag:"GROW", one:"a greenhouse", glyph:"G", color:"#6FA34A", price:6000, upkeep:60, w:12, d:8, dept:true,
                        tech:"greenhouse", needsDept:"ceres",
                        full:"Paleoflora greenhouse", blurb:"Adds 40 units of Paleoflora a day to CERES."};

// Power for electrified fences
const POWER = {
  perMeter:.5,            // kW each meter of electrified fence draws
  unpoweredStrength:20,   // an electric fence with no power is just wire
  genWear:4,              // generator condition lost per day
  offlineBelow:25,        // generators cut out below this condition
  repairPerPercent:60,    // materials to restore 1% of a generator's condition
};
BUILDINGS.generator = {label:"Generator", tag:"POWER", one:"a generator", glyph:"P", color:"#A88A1E", price:7500, upkeep:150, tech:"generator", w:12, d:10, dept:true, power:600,
                       full:"Diesel generator", blurb:"Powers every electrified fence in the park. Mechanics keep it running."};

// Staff vehicles. ATVs only drive on service roads; on guest paths staff get off and walk, and the ATV stays parked where they got off for the next person.
const VEHICLES = {
  perDepot:3,             // ATVs each depot brings to the park, shared by all staff
  speedMult:5,            // how much faster than walking an ATV goes
  wear:3,                 // depot condition lost per day
  offlineBelow:25,        // a depot this worn grounds its ATVs
  repairPerPercent:50,    // materials to restore 1% of a depot's condition
};
BUILDINGS.depot = {label:"Vehicle Depot", tag:"ATV", one:"a vehicle depot", glyph:"A", color:"#4F6273", price:12500, upkeep:300, w:16, d:12, dept:true,
                   tech:"vehicles", serviceOnly:true,
                   full:"Staff vehicle depot", blurb:"Adds 3 ATVs for staff to share. They drive five times faster than walking, but only on service roads, and an ATV stays where it was left. Mechanics keep it running."};


/* ---------------------------------------------------------------------
   LOGISTICS
   Food and medicine are real goods. They are bought at a Delivery Dock or made on site,
   sit in stores where they can spoil, and keepers carry them to where they're needed.
   --------------------------------------------------------------------- */
// Goods stored in buildings. Exhibits eat plants, meat, fish, and insects. Paleoflora lives at CERES.
//   spoil   share of a store's stock lost to rot each night
const GOODS = {
  plants: {label:"Hay",      spoil:.04},
  meat:   {label:"Meat",     spoil:.15},
  fish:   {label:"Fish",     spoil:.20},
  insects:{label:"Insects",  spoil:.10},
  meds:   {label:"Medicine", spoil:.02},
  // what food stands and gift shops sell from: a unit is $1 of wholesale stock
  snacks: {label:"Snacks",      spoil:.08},
  drinks: {label:"Drinks",      spoil:.01},
  merch:  {label:"Merchandise", spoil:0},
};
const FEED_GOODS = ["plants", "meat", "fish", "insects"];
const GUEST_GOODS = ["snacks", "drinks", "merch"];
const ORDER_GOODS = FEED_GOODS.concat(GUEST_GOODS);   // what the dock buys
const GOOD_COLOR = {...FOOD_COLOR, meds:"#B0384F", snacks:"#D98A3A", drinks:"#4FA3C7", merch:"#9A5A8C"};
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
  pmcDoses:20,         // doses the PMC keeps on hand
  dockMarkup:1.25,     // the dock charges this much over a food unit's base cost
  rushMarkup:1.75,     // a rush order costs this much
  rushLot:50,          // units in a rush order
  autoDays:2,          // auto-ordering keeps the dock stocked with this many days of the park's food
  truckMin:120,        // while the park is open, a supply truck tops up each dock this often
  coldPower:25,        // kW a cold store draws
  coldSpoil:.2,        // a powered cold store multiplies spoilage by this
};
const DOCK_PRICE = {plants:1, meat:1, fish:1, insects:1};   // multiplied by the markup and FOOD_UNIT_COST
const GUEST_GOOD_PRICE = 1;   // a unit of snacks, drinks, or merchandise, before the dock's markup

// Stores. cap is total units, holds says which goods fit, spoil multiplies the rot rate.
BUILDINGS.station.store   = {cap:80,  holds:FEED_GOODS, spoil:1};
BUILDINGS.station.blurb   = "Keepers start here and hold a small stock of food. Zone hubs: custodians restock them from bigger stores.";
BUILDINGS.warehouse = {label:"Warehouse", tag:"STORE", one:"a warehouse", glyph:"W", color:"#6B5B3E", price:6750, upkeep:50, w:16, d:12, dept:true,
                       store:{cap:600, holds:["plants", "insects", "drinks", "merch"], spoil:.7, bulk:true},
                       full:"Dry goods warehouse", blurb:"Stores hay, insect feed, drinks, and merchandise, and keeps them better than a station does. Custodians restock stations, stands and shops from here."};
BUILDINGS.coldstore = {label:"Cold Store", tag:"COLD", one:"a cold store", glyph:"❄", color:"#4A7FA0", price:12000, upkeep:120, tech:"coldstore", w:14, d:10, dept:true,
                       store:{cap:400, holds:["meat", "fish", "meds", "snacks"], spoil:1, cold:true, bulk:true},
                       full:"Refrigerated store", blurb:"Keeps meat, fish, medicine, and snacks from rotting, as long as it has power from a generator."};
BUILDINGS.dock = {label:"Delivery Dock", tag:"DOCK", one:"a delivery dock", glyph:"D", color:"#3E5C7A", price:4500, upkeep:50, w:16, d:10, dept:true, serviceOnly:true,
                  store:{cap:1500, holds:ORDER_GOODS, spoil:1, bulk:true, dock:true},
                  full:"Supplier deliveries", blurb:"Order animal food and stock for your stands and shops. Trucks come overnight and every two hours while the park is open. They need a service road to the entrance. Keepers and custodians carry it from here."};
// Hotels keep toiletries, which custodians bring from the dock or a warehouse
for(const t of ["campground", "lodge", "resort"]) BUILDINGS[t].store = {cap:BUILDINGS[t].rooms * LODGING.toiletries * 2, holds:["merch"], spoil:1, vendor:true};
// Food stands and gift shops keep their own stock
for(const [t, cap] of Object.entries({kiosk:60, food:150, restaurant:400, cart:60, shop:150, megastore:400}))
  BUILDINGS[t].store = {cap, holds:BUILDINGS[t].kind === "food" ? ["snacks", "drinks"] : ["merch"], spoil:1, vendor:true};
// Production. Needs the food production research. Output goes into the building's own store.
//   makes   units a day
BUILDINGS.farm      = {label:"Hay Farm",   tag:"FARM", one:"a hay farm",   glyph:"F", color:"#7A9A36", price:13500, upkeep:260, w:20, d:14, dept:true, tech:"foodprod",
                       store:{cap:150, holds:["plants"], spoil:1, source:true}, makes:{plants:60},
                       full:"Hay and forage farm", blurb:"Grows 60 units of hay a day."};
BUILDINGS.ranch     = {label:"Livestock Ranch", tag:"RANCH", one:"a livestock ranch", glyph:"L", color:"#9A4A3A", price:16500, upkeep:380, w:20, d:14, dept:true, tech:"foodprod",
                       store:{cap:150, holds:["meat"], spoil:1, source:true}, makes:{meat:40},
                       full:"Feed livestock ranch", blurb:"Raises 40 units of meat a day. Meat spoils fast, so keep a cold store nearby."};
BUILDINGS.hatchery  = {label:"Fish Hatchery", tag:"FISH", one:"a fish hatchery", glyph:"H", color:"#3A7FA8", price:16500, upkeep:380, w:18, d:14, dept:true, tech:"foodprod",
                       store:{cap:150, holds:["fish"], spoil:1, source:true}, makes:{fish:40},
                       full:"Fish hatchery", blurb:"Breeds 40 units of fish a day. It spoils fastest of all."};
BUILDINGS.insectary = {label:"Insectary", tag:"BUGS", one:"an insectary", glyph:"I", color:"#A8832E", price:12000, upkeep:220, w:14, d:10, dept:true, tech:"foodprod",
                       store:{cap:150, holds:["insects"], spoil:1, source:true}, makes:{insects:30},
                       full:"Insect farm", blurb:"Breeds 30 units of insects a day."};

// Work zones: groups of keepers, exhibits, and stores. Keepers in a zone look after that zone's exhibits.
const ZONE_COLORS = ["#E0A030", "#4F9BD9", "#C25B8E", "#52B788", "#9B7BE0", "#E07A5F"];
const ZONE_MIN_AREA = 200;

// Things ORACLE can research besides animals. Each one takes time (see RESEARCH_MIN_PER_POINT).
//   group   which ORACLE tab it sits on: "barrier" and "build" under Park Management, "tar" for TAR upgrades,
//           "flora" and "med" under Paleo-Flora
//   needs   another project that has to finish first
//   era     (flora, med) the era it belongs to
const TECH = [
  {id:"bars",     group:"barrier", label:"Metal bars",        points:15, text:"Strength 45. Holds mid-size herbivores."},
  {id:"electric", group:"barrier", label:"Electrified fence", points:18, text:"Strength 65 while powered. Holds most herbivores and smaller predators. Needs generators."},
  {id:"concrete", group:"barrier", label:"Concrete walls",    points:20, text:"Strength 140. Holds anything, but guests can barely see in."},
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
  {id:"ednursery", group:"build", label:"Nursery window", points:50, needs:"education", text:"Add a Nursery Window to an Education Center. Guests watch TAR's clones grow, and love a hatching."},
  {id:"edbotanical", group:"build", label:"Botanical hall", points:50, needs:"paleoflora", text:"Add a Botanical Hall to an Education Center. It grows richer as CERES finishes plant DNA and keeps beds growing."},
  {id:"edsimroom", group:"build", label:"Simulation room", points:65, needs:"education", text:"Add a Simulation Room to an Education Center. Guests walk through deep time using the event records GHOST has finished."},
  {id:"ediorama", group:"build", label:"Ecosystem diorama", points:50, needs:"education", text:"Add an Ecosystem Diorama to an Education Center. It gets richer with every kind of habitat you keep animals in."},
  {id:"edtouch", group:"build", label:"Touch gallery", points:40, needs:"education", text:"Add a Touch Gallery to an Education Center. Hands-on casts and bones, and the shelves fill as GHOST finishes genomes."},
  {id:"modern", group:"build", label:"Modern design", points:50, text:"Unlocks the Modern theme: polished stone, metal and glass for paths, buildings and exhibits."},
  {id:"hotels",  group:"build", label:"Hotels",           points:35, text:"Build campgrounds, safari lodges, and resort hotels. Guests stay the night and spend the next day in the park."},
  {id:"coldstore", group:"build", label:"Cold stores",      points:15, text:"Refrigerated stores that keep meat, fish, medicine, and snacks from rotting. Needs power."},
  {id:"security", group:"build", label:"Security offices",  points:15, text:"Build a Security Office and hire guards to patrol, deter vandals, and steer guests out during escapes."},
  {id:"generator", group:"build", label:"Power generators", points:15, text:"Diesel generators that power electrified fences and cold stores."},
  {id:"cameras",  group:"build", label:"Security cameras",  points:25, text:"Each Security Office watches the paths around it, and you can put camera posts on paths to watch more. Guards are sent straight to vandals the cameras see."},
  {id:"vehicles",   group:"build", label:"Staff vehicles",   points:70, text:"Vehicle depots with ATVs. Staff drive five times faster, but only on service roads."},
  {id:"transit",   group:"build", label:"Guest tram",       points:60, text:"Draw tram track and build tram stations beside it. Guests ride between stations instead of walking, and pay a fare."},
  {id:"foodprod",  group:"build", label:"Food production",  points:18, text:"Build farms, ranches, hatcheries, and insectaries to make animal food. Cheaper than the dock, but it spoils if nobody collects it."},
  // TAR upgrades
  {id:"fast1",    group:"tar", label:"Faster incubators",   points:35, text:"Clones finish in three quarters of the time."},
  {id:"fast2",    group:"tar", label:"Much faster incubators", points:80, needs:"fast1", text:"Clones finish in about half the time."},
  // GHOST upgrades
  {id:"ghostcost1", group:"ghost", label:"Leaner expeditions",   points:35, text:"Trips cost about a fifth less."},
  {id:"ghostcost2", group:"ghost", label:"Lean expeditions",     points:80, needs:"ghostcost1", text:"Trips cost about a third less."},
  {id:"ghostspeed1", group:"ghost", label:"Faster time engines", points:35, text:"Expeditions take three quarters of the time."},
  {id:"ghostspeed2", group:"ghost", label:"Much faster time engines", points:80, needs:"ghostspeed1", text:"Expeditions take about half the time."},
  {id:"ghostq1",   group:"ghost", label:"Careful sampling",     points:40, text:"Every DNA sample comes back 8 points better in quality."},
  {id:"ghostq2",   group:"ghost", label:"Cryo-preserved samples", points:90, needs:"ghostq1", text:"Every DNA sample comes back 16 points better in quality."},
  // Genetics
  {id:"genetherapy", group:"gene", label:"Genome therapy", points:70, text:"Vets can rewrite a sickly clone's DNA to match the lab's best genome for its species, making it healthier. Needs a Paleo-Medicine Center, and only goes as far as the lab's own DNA quality, so send GHOST for better samples to raise it."},
  // Paleo-Flora: plants and medicine, grown at CERES
  {id:"paleoflora", group:"flora", label:"Paleoflora cultivation", points:30, text:"CERES starts growing Paleoflora, the food prehistoric plant-eaters need instead of grass. It needs plant DNA from GHOST first."},
  {id:"mesoplant",  group:"flora", era:"mesozoic",  label:"Mesozoic flora",  points:50, needs:"paleoflora", text:"Cycads, conifers, ginkgos, and ferns. Once researched, GHOST can collect each period's plant DNA, then CERES grows its plants for exhibits."},
  {id:"paleoplant", group:"flora", era:"paleozoic", label:"Paleozoic flora", points:65, needs:"paleoflora", text:"Lycopod trees, horsetails, and seed ferns. Once researched, GHOST can collect each period's plant DNA, then CERES grows its plants for exhibits."},
  {id:"sterile",    group:"flora", label:"Sterile prehistoric plants", points:30, needs:"paleoflora", text:"Seedless de-extinct plants that can't spread, so plants from any period can grow out in the park, along paths and in gardens. Mesozoic and Paleozoic ones still come from CERES."},
  {id:"greenhouse", group:"flora", label:"Greenhouses",      points:30, needs:"paleoflora", text:"Build greenhouses near CERES to grow Paleoflora faster."},
  {id:"medceno",    group:"med", era:"cenozoic",  label:"Cenozoic medicine",  points:12, text:"CERES grows medicine for Paleogene, Neogene, and Quaternary animals. Refine it for each period to cure them fully."},
  {id:"medmeso",    group:"med", era:"mesozoic",  label:"Mesozoic medicine",  points:45, text:"CERES grows medicine for Triassic, Jurassic, and Cretaceous animals. Needs Mesozoic plant DNA. Refine it for each period to cure them fully."},
  {id:"medpaleo",   group:"med", era:"paleozoic", label:"Paleozoic medicine", points:60, text:"CERES grows medicine for Devonian, Carboniferous and Permian animals. Needs Paleozoic plant DNA. Refine it for each period to cure them fully."},
];
// Refining an era's medicine for one period: a cure for that period's animals. Costs by era.
const REFINE_POINTS = {cenozoic:8, mesozoic:14, paleozoic:20};
const MOAT_PER_METER = 150;
const AVIARY_PER_SQM = 4;
const NET_PER_METER = 25;   // catch netting along the fence

// Flying animals. Outside an aviary or vivarium they escape almost at once.
const FLYERS = ["quet", "pter", "dimo", "mega", "arch", "micr", "yiqi", "arge", "ppig", "rmlo"];

const ESCAPE = {
  lawsuit:75000,       // cost of each guest killed
  shutdownDeaths:5,    // this many deaths and the park is shut down
  sedateMinutes:10,    // how long a vet (or a keeper, if there are no vets) takes to dart and sedate an escaped animal
  looseSpeed:WALK_PER_MIN * .75,   // escaped animals wander a bit slower than people walk
  bigHerbivore:1500,   // herbivores needing this much room or more are dangerous when loose
};

/* ---------------------------------------------------------------------
   PALEO-MEDICINE
   --------------------------------------------------------------------- */

// Animals fall ill or get hurt. Vets from the Paleo-Medicine Center (PMC) dart them,
// keepers carry them in, and the PMC treats them with medicine from CERES.
const HEALTH = {
  startDay:18,         // new parks: nobody gets sick before this day
  illChance:.005,      // chance a well-kept animal falls ill each day
  hungerMult:4,        // a whole day without food makes illness this much more likely (on top of 1)
  dirtPer:25,          // every this many points of dirt above the unhappy line adds 1× more risk
  frail:{below50:2, below70:1.4},   // clones from poor DNA get sick more
  grassSick:2,         // old plant-eaters eating only plants they never evolved for get sick this much more (less for a share of it)
  territorial:.04,     // chance a day a territorial animal is hurt by each rival of its own kind
  attacked:.15,        // chance a day an animal is hurt by a species that preys on it
  illStart:20, injuryStart:25,       // how bad a new case starts (0 to 100)
  illWorsen:8, injuryWorsen:6,       // how much worse it gets each day untreated; 100 kills
  sickHappy:8,         // happiness lost per sick animal, as a share of the herd
  dartMinutes:8,       // how long a vet takes to dart a sick animal
  obviousAt:40,        // an illness this bad shows; milder ones stay hidden until a vet checks the exhibit (0 shows everything)
  checkEvery:3,        // days between vet check-ups before an exhibit is overdue
  checkMinutes:5,      // time a vet spends looking over an exhibit's animals
  minorBelow:40,       // illnesses under this are minor: a vet treats them on the spot, and medicated feed clears them up
  fieldMinutes:12,     // time a vet takes to treat a minor illness on the spot
  fieldDose:1,         // medicine doses an on-the-spot treatment uses
  beds:6,              // patients the PMC holds at once
  healPerNight:45,     // severity a treated patient recovers each night
  dose:2,              // medicine doses one patient's treatment uses
};
// Genome therapy (ORACLE tech "genetherapy"): a vet lifts a clone's DNA quality toward the lab's genome for its species
const GENE = {
  minutes:30,          // time a vet spends on one procedure
  step:20,             // most DNA quality points one procedure adds
  minGain:5,           // the lab's genome has to beat the animal by this much to be worth it
  base:500,            // fixed price of a procedure
  perPoint:60,         // plus this for each quality point gained
};
// Territorial species fight rivals of their own kind, more so when cramped
const TERRITORIAL = ["trex", "carc", "torv", "allo", "cnot", "spin", "bary", "dime", "inos", "post", "dsuc", "tita", "bari", "mlan", "andr", "arct", "kele",
                     "tric", "styr", "anky", "elas", "pcer", "prio", "dche"];
// CERES grows medicine in batches (see CERES_GROW) once ORACLE has unlocked its type
const MEDICINE = {
  capacity:60,         // doses CERES holds
  feedPer:5,           // medicated feed uses 1 dose a day for every this many animals
  feedCut:.35,         // medicated feed multiplies the chance of falling ill by this
  feedHeal:10,         // and heals minor cases (under HEALTH.minorBelow) this much a day in the exhibit
};
// The medicine each era's animals need
const MED_TECH = {paleozoic:"medpaleo", mesozoic:"medmeso", cenozoic:"medceno"};
// Contemporary medicine: suppliers restock the PMC every night. It treats any animal,
// but can't cure prehistoric illness for good: the animal goes home with a chronic case.
const MODERN = {
  stock:30,            // doses the PMC keeps on hand
  cost:25,             // price of each dose
  heal:{cenozoic:.9, mesozoic:.7, paleozoic:.5},     // how well it works, as a share of the era's own medicine
  floor:{cenozoic:5, mesozoic:10, paleozoic:15},    // how sick it leaves an animal, at best
  chronicHappy:.25,     // a chronic case counts as this much of a sick animal for happiness
};
const ERA_LABEL = {paleozoic:"Paleozoic", mesozoic:"Mesozoic", cenozoic:"Cenozoic"};
const VET = {
  hireCost:3000,
  wage:200,
  speed:WALK_PER_MIN,  // vets walk at the same pace as guests
  patients:3,          // patients each vet can treat each night
};
BUILDINGS.pmc = {label:"Paleo-Medicine Center", tag:"PMC", one:"a Paleo-Medicine Center", glyph:"+", color:"#B0384F", price:6000, upkeep:100, w:20, d:14, dept:true, unique:true,
                 full:"Veterinary hospital and dart team", blurb:"Vets are based here. They give exhibits routine check-ups, treat minor illnesses on the spot, dart serious cases and escaped animals, and treat patients with medicine from CERES."};

BUILDINGS.pmc.store = {cap:LOGI.pmcDoses, holds:["meds"], spoil:1, sink:true};

// Viewing platforms snap onto an exhibit's fence
BUILDINGS.platform = {label:"Viewing Platform", tag:"VIEW", one:"a viewing platform", glyph:"V", color:"#B08654", price:20000, upkeep:80, tech:"platform", w:14, d:7};

// Water is drawn inside an open exhibit like the exhibit itself (e.water: shapes with corners), and priced by area
const WATER = {
  perSqM:20,       // cost per square meter
  minArea:12,      // smallest body of water, in square meters
  margin:.5,       // gap kept between the water and the fence, in meters
  oldPondR:6,      // radius of the round ponds older saves had; they become drawn water
};

// Landscaping: rocks, groves and shelters placed inside an open exhibit (e.land). Animals feel at home among what they like.
//   r      radius in meters. Groves come small (r 2), medium (r 3.5) and large (r 5).
//   cover  rock cover it adds (see HAB.rockEvery)
//   flora  a grove of plants from this era (see FLORA). Animals from that era feel at home in it and browse it.
//   slots  shelter slots it gives (see coverSlots). only: species ids that can use it, whatever their size (a burrow). fits: the biggest animal (in coverSlots) it takes, 19 is a sauropod. look: how it's drawn (burrow, cave, canopy; none is a barn). noCold: canopies give no cover in a cold snap.
//   tech   research needed first
//   size   small, medium or large. Mesozoic and Paleozoic plants (tech) use up one plant of that era and size, grown at CERES.
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
  icefruit:{label:"Frozen Fruit",   one:"a frozen fruit block", price:200, r:1.2, color:"#C83A5A", toyFor:{herbivore:3, omnivore:4}, lasts:3, look:"ice"},
  shank:  {label:"Frozen Shank",    one:"a frozen whole shank", price:400, r:1.4, color:"#8A3A2A", toyFor:{carnivore:4, omnivore:2}, lasts:3, look:"ice"},
  buglog: {label:"Insect Log",      one:"an insect log",      price:1200, r:2.2, color:"#6E5034", toyFor:{insectivore:4, omnivore:3}, look:"buglog"},
  hay:    {label:"Hay Bale",        one:"a hay bale",         price:300,  r:1.8, color:"#D9B95A", toyFor:{carnivore:3, piscivore:2, herbivore:1, omnivore:1}, lasts:4, hay:40, look:"hay"},
  // paleo: Paleoflora a day the older plant eaters eat off it; ceres: Paleoflora it takes from CERES to bale
  pbale:  {label:"Paleoflora Bale", one:"a Paleoflora bale",  price:500,  r:1.8, color:"#6E9A4A", ring:"#3E5F2A", toyFor:{carnivore:3, piscivore:2, herbivore:1, omnivore:1}, lasts:4, paleo:25, ceres:100, tech:"paleoflora", look:"hay"},
  // vivarium enrichment (vivToy instead of toy): picked from the vivarium's Enrichment list and set in the glass, never out in an open exhibit
  vbark:  {label:"Cork Bark Hide",     one:"a cork bark hide",     price:300,  r:.7, color:"#7A5A3A", toy:1, vivToy:true, hide:true, look:"vbark"},
  vbranch:{label:"Climbing Branches",  one:"climbing branches",    price:500,  r:.9, color:"#8A6A48", toy:2, vivToy:true, look:"vbranch"},
  vdig:   {label:"Dig Box",            one:"a dig box",            price:700,  r:.8, color:"#6B5236", toy:2, vivToy:true, look:"vdig"},
  vfeed:  {label:"Live-Feed Dispenser",one:"a live-feed dispenser",price:900,  r:.6, color:"#8A8F96", toy:3, vivToy:true, look:"vfeed"},
  vmist:  {label:"Misting Pool",       one:"a misting pool",       price:1200, r:.9, color:"#3E86A8", toy:3, vivToy:true, look:"vmist"},
};
// Food trays (LAND items with `tray`, food units they hold). Each holds one kind of food at a time (any kind). Keepers walk inside the fence to fill them,
// and the animals eat from them first, so an exhibit with trays holds more food and needs fewer trips.
const TRAY = {
  color:"#6E737A",   // rim
};
// Groves give shade too: this many shelter slots each, scaled by how much the weather lets trees help (WEATHER grove)
for(const t of Object.values(LAND)) if(t.flora && !t.shade) t.shade = 8;
// Vivariums take plants too, shrunk to fit the glass: radius scale, and happiness for a full planting of what the animals want
const VIV_PLANT = {scale:.5, bonus:6};
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
  waterMax:.1,     // share of the floor an animal that loves water (likes 1) wants under water; less keen animals want proportionally less
  waterBand:.2,    // no penalty within this share either side of what an animal wants
  rockBase:1,      // rocks a 500 m² exhibit of grassland wants for an animal with middling taste (likes .4); scaled by biome and by how much it likes rocks
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
const COLD_HARDY = ["mamm", "colm", "elas", "arct", "dire", "smil", "mast"];
// Shelter slots one animal takes: bigger animals need more room
const coverSlots = s => Math.max(1, Math.round(Math.sqrt(s.space) / 4));

// How much each species likes water and rocks (0 to 1). Fish eaters want water. Anything not listed likes both a little.
const LIKES_ROCK = {water:.2, rock:.9};
const HABITAT_LIKES = {diic:LIKES_ROCK, lyst:LIKES_ROCK, seym:LIKES_ROCK, dime:LIKES_ROCK, plhy:LIKES_ROCK, mlan:LIKES_ROCK, mono:LIKES_ROCK, beel:{water:.6, rock:.6}};
const likesOf = s => HABITAT_LIKES[s.id] || (s.diet.includes("piscivore") ? {water:.9, rock:.1} : {water:.4, rock:.4});

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
  shyGuests:35,        // stress skittish animals take from a busy path, halved with cover to retreat to
  busyAt:150,          // guests in the park for "busy"
  happy:{calm:4, stress:.12, bored:.06, pace:8},   // happiness: up to +calm, less stress and boredom, less the share pacing
  stressIll:1.35,      // illness chance multiplier for an animal over 60 stress
  escape:1.5,          // a stressed aggressive animal tries the fence up to this much more
  nap:{from:10, to:16, share:.7, chance:.1, hot:1.5, min:150, max:270},   // a midday nap (park time runs 12 minutes a second, so this is 12 to 22 seconds): the hours it can start (peaking halfway), the share of animals that nap on a given day, each step's chance of starting once they do (at the peak), hot days' boost, and how long they stay down (minutes)
  lively:[.85, 1.1],   // guest appeal from a sleeping, hiding herd to a busy, playful one
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
const ENRICH = {per:1, toys:.35, habitat:.35, room:.3, vivScale:3, melt:2};   // melt: days a frozen treat loses in a heat wave   // vivScale: small vivarium animals are measured on this scale, so they still want a few toys
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
    skittish:["para", "macr", "aepy", "hyps", "dryo", "hete", "igua", "sifr", "hopl"],
    aggressive:["dino", "daeo", "arsi", "doed", "arct"],
  },
};
const TRAIT_TEXT = {diurnal:"Diurnal", nocturnal:"Nocturnal", crepuscular:"Crepuscular", solitary:"solitary", pair:"lives in pairs", herd:"herd animal", pack:"pack animal", skittish:"skittish", curious:"curious", aggressive:"aggressive"};

// Biomes: the ground an open exhibit is laid out as. Each animal has a home biome and one it gets by in.
//   color    floor color on the map (the pattern id is "b-" + the key)
//   perSqM   cost to regrade an exhibit to this biome
//   wet      counts as this share of the water that fully satisfies water lovers
//   rock     how many rocks animals want here, next to grassland's 1 (see HAB.rockEvery)
//   plants   share of the floor animals want planted here (see HAB.plantMax)
//   park     the open ground between the exhibits when the park is set in this biome (the pattern id is "p-" + the key)
const BIOMES = {
  desert:   {label:"Desert",    ground:"sand and bare rock",          color:"#DFC48A", park:"#DFC48A", perSqM:.5, rock:1.6, plants:0.01},
  tropical: {label:"Tropical",  ground:"humid forest floor",          color:"#3F9A5C", park:"#79AE6C", perSqM:1, rock:0.6, plants:0.12},
  grassland:{label:"Grassland", ground:"open plains",                 color:"#A9C76A", park:"#B7C995", perSqM:.3, rock:0.6, plants:0.03},
  scrubland:{label:"Scrubland", ground:"dry brush and hardpan",       color:"#BFA96C", park:"#BFA96C", perSqM:.4, rock:1.3, plants:0.03},
  wetland:  {label:"Wetland",   ground:"marsh, mud and shallow water", color:"#6F9A7A", park:"#6F9A7A", perSqM:1.2, wet:.5, rock:0.4, plants:0.06},
  temperate:{label:"Temperate", ground:"woodland and meadow",         color:"#7DAA68", park:"#7DAA68", perSqM:.6, rock:0.8, plants:0.08},
  boreal:   {label:"Boreal",    ground:"cold conifer forest",         color:"#5E8070", park:"#8FA694", perSqM:.8, rock:1, plants:0.08},
  tundra:   {label:"Tundra",    ground:"frozen moss and lichen",      color:"#AEB9A2", park:"#CBD2C2", perSqM:.6, rock:1.4, plants:0.02},
};
const DEFAULT_PARK_BIOME = "grassland";   // older parks keep the plain grass they had
// Landscape plants, one small, medium and large of each for every biome that existed in a period (names "small|medium|large").
// A biome missing from a period has no plants there (no grassland before the Neogene). They go in LAND below as keys like "jur-tropical-small".
const PLANT_TABLE = {
  Devonian:{tropical:"Cooksonia|Asteroxylon|Wattieza", wetland:"Rhynia|Aglaophyton|Pseudosporochnus", desert:"Zosterophyllum|Psilophyton|Prototaxites",
    scrubland:"Hostinella|Sawdonia|Drepanophycus", temperate:"Gosslingia|Barinophyton|Archaeopteris"},
  Carboniferous:{tropical:"Sphenophyllum|Calamites|Lepidodendron", wetland:"Asterophyllites|Medullosa|Sigillaria",
    temperate:"Neuropteris|Alethopteris|Cordaites", desert:"Sphenopteris|Callipteris|Walchia"},
  Permian:{desert:"Supaia|Ullmannia|Pseudovoltzia", tropical:"Taeniopteris|Gigantopteris|Psaronius", wetland:"Annularia|Pecopteris|Arthropitys",
    scrubland:"Peltaspermum|Comia|Callistophyton", temperate:"Sphenobaiera|Rufloria|Ginkgophyllum", boreal:"Gangamopteris|Noeggerathiopsis|Glossopteris"},
  Triassic:{desert:"Dicroidium|Pleuromeia|Voltzia", tropical:"Neocalamites|Zamites|Araucarioxylon", scrubland:"Lepidopteris|Scytophyllum|Pagiophyllum",
    wetland:"Equisetites|Cladophlebis|Heidiphyllum", temperate:"Baiera|Podozamites|Elatocladus"},
  Jurassic:{tropical:"Nilssonia|Williamsonia|Cycadeoidea", wetland:"Coniopteris|Todites|Matonidium", scrubland:"Otozamites|Ptilophyllum|Brachyphyllum",
    temperate:"Ginkgoites|Czekanowskia|Araucarites", desert:"Pachypteris|Hirmeriella|Cupressinocladus", boreal:"Phoenicopsis|Pityophyllum|Elatides"},
  Cretaceous:{tropical:"Nilssoniopteris|Sabalites|Sapindopsis", wetland:"Archaefructus|Nelumbites|Glyptostrobus", scrubland:"Ruffordia|Pseudofrenelopsis|Eucalyptophyllum",
    temperate:"Ficophyllum|Credneria|Sequoia", desert:"Ephedra|Welwitschiophyllum|Tempskya", boreal:"Birisia|Heilungia|Parataxodium"},
  Paleogene:{tropical:"Lygodium|Nypa|Dipterocarpoxylon", wetland:"Mosquito Fern|Floating Fern|Bald Cypress", temperate:"Zelkova|Quercus|Metasequoia",
    boreal:"Osmunda|Betula|Larix", scrubland:"Hopbush|Acacia|Eucalyptus", desert:"Tamarisk|Saxaul|Honey Mesquite"},
  Neogene:{grassland:"Poa|Themeda|Cortaderia", tropical:"Heliconia|Musa|Ceiba", wetland:"Cattail|Common Reed|Tupelo", scrubland:"Sagebrush|Saltbush|Juniper",
    temperate:"Anemone|Acer|Fagus", boreal:"Vaccinium|Alnus|Picea", desert:"Cholla|Century Plant|Saguaro", tundra:"Eriophorum|Empetrum|Salix arctica"},
  Quaternary:{grassland:"Festuca|Bouteloua|Andropogon", tropical:"Philodendron|Euterpe|Swietenia", wetland:"Peat Moss|Sedge|Willow", scrubland:"Sage|Chamise|Manzanita",
    temperate:"Trillium|Corylus|Tilia", boreal:"Cladonia|Ledum|Pinus", desert:"Creosote Bush|Barrel Cactus|Joshua Tree", tundra:"Saxifraga|Dryas|Betula nana"},
};
// Leaf colors by biome, small to large
const PLANT_SHADE = {desert:["#B8A559", "#9A9048", "#7C7A3E"], tropical:["#4DBA6B", "#2F9A55", "#1F7A45"], grassland:["#B8D26A", "#9CBE55", "#7FA847"],
  scrubland:["#A8AE62", "#8E9654", "#747E48"], wetland:["#5FB8A2", "#3E9C88", "#2B7F6F"], temperate:["#8CC46E", "#6BAA55", "#4E8F42"], boreal:["#6E9C86", "#4F8068", "#386650"],
  tundra:["#A9B48A", "#8C9A70", "#6F7F5A"]};
// Landscape plants drawn with a picture instead of code: sprites/plants/<LAND key>.png, 3/4 view with the base at the bottom middle.
// ratio is width over height; size scales the width (2 x the plant's radius) so a tall plant isn't drawn too wide. Plants not listed keep their SVG.
const PLANT_SPRITES = {
  "per-scrubland-small":  {ratio:44/46, size:1.15},
  "per-scrubland-medium": {ratio:64/46, size:1.1},
  "per-scrubland-large":  {ratio:72/96, size:.85},
  "tri-scrubland-small":  {ratio:54/40, size:1.42},
  "tri-scrubland-medium": {ratio:76/52, size:1.3},
  "tri-scrubland-large":  {ratio:64/92, size:.75},
  "dev-scrubland-small":  {ratio:44/38, size:1.27},
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
  "dev-wetland-small":      {ratio:40/44, size:1.15},
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
  "dev-desert-small":      {ratio:44/38, size:1.27},
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
  "dev-temperate-small":    {ratio:40/44, size:1.15},
  "dev-temperate-medium":   {ratio:64/56, size:1.05},
  "dev-temperate-large":    {ratio:64/92, size:0.74},
  "car-temperate-small":    {ratio:44/38, size:1.27},
  "car-temperate-medium":   {ratio:64/58, size:1.05},
  "car-temperate-large":    {ratio:64/92, size:0.74},
  "per-temperate-small":    {ratio:44/36, size:1.27},
  "per-temperate-medium":   {ratio:66/54, size:1.08},
  "per-temperate-large":    {ratio:72/92, size:0.83},
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
  "qua-temperate-small":    {ratio:44/40, size:1.27},
  "qua-temperate-medium":   {ratio:64/52, size:1.05},
  "qua-temperate-large":    {ratio:72/92, size:0.83},
  "q-white-oak":           {ratio:72/92, size:0.83},
  "q-sugar-maple":         {ratio:64/92, size:0.74},
  "q-dawn-redwood":        {ratio:64/92, size:0.74},
  "q-japanese-cherry":     {ratio:64/50, size:1.05},
  "q-rose-bush":           {ratio:56/44, size:0.92},
  "q-ginkgo":              {ratio:64/52, size:1.05},
  "q-lilac":               {ratio:56/50, size:0.92},
  "q-mesquite":            {ratio:64/52, size:1.05},
  "q-sagebrush":           {ratio:48/40, size:1.38},
  "q-prickly-pear":        {ratio:48/44, size:1.38},
  "q-agave":               {ratio:44/40, size:1.27},
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
const ROCK_SPRITES = {
  desert:{
    boulder:[[72, 61], [36, 60], [76, 63], [53, 64]],
    rock:[[43, 31], [33, 32], [32, 39], [31, 29], [34, 32], [40, 29]],
  },
  scrubland:{
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
};
// SPRITE_HIT:start (made by tools/spritehit.py, don't edit)
const SPRITE_HIT = {
  "car-desert-large":[64,92,28.5,28.5,"30-34,30-34,31-33,29-35,24-40,24-40,20-44,20-44,17-47,16-48,16-48,12-52,12-52,10-54,9-55,9-55,6-58,6-58,5-59,4-60,4-60,30-34,26-38"],
  "car-desert-medium":[64,58,7.5,16.5,",31-33,27-37,25-39,24-40,16-48,16-48,17-47,19-45,20-44,22-42,24-40,26-38,31-33,29-35"],
  "car-desert-small":[44,38,6.5,19.5,"22-22,12-32,11-33,11-33,4-40,3-41,9-35,15-29,17-27,19-25"],
  "car-temperate-large":[64,92,6.5,32,"16-56,7-57,7-50,14-61,2-63,0-58,5-59,5-63,0-63,0-53,11-45,19-34,30-34,30-34,30-34,30-34,30-34,29-35,29-35,29-35,29-35,29-35,26-38"],
  "car-temperate-medium":[64,58,6.5,27.5,",31-34,25-39,17-47,14-50,12-52,11-53,7-57,5-59,30-34,30-34,30-34,29-35,29-35,26-38"],
  "car-temperate-small":[44,38,3.5,22,"20-24,12-32,9-35,4-40,0-43,2-42,2-42,7-37,20-24,19-25"],
  "car-wetland-large":[64,92,6.5,22.5,"24-40,17-47,11-53,10-54,13-51,18-46,26-38,30-34,30-34,30-34,30-34,30-34,30-34,30-34,30-34,30-34,30-34,30-34,30-34,29-35,29-35,29-35,26-38"],
  "car-wetland-medium":[64,50,2.5,29.5,",,,,22-43,15-53,10-55,9-56,4-61,3-59,30-34,30-34,30-34"],
  "car-wetland-small":[40,46,8.5,12.5,"16-24,15-25,13-27,13-27,11-29,12-28,9-31,11-29,8-32,15-25,19-21,19-21"],
  "cre-desert-large":[64,92,12.5,28.5,"23-41,21-43,13-51,10-54,7-57,7-57,8-56,5-59,4-60,25-39,25-39,25-39,25-39,24-40,25-39,24-40,24-40,24-40,23-41,22-42,22-42,22-42,20-44"],
  "cre-desert-medium":[64,46,31.5,31.5,",,,,,,31-33,12-52,7-57,4-60,2-62,1-63"],
  "cre-desert-small":[44,38,5.5,13,",21-25,13-31,13-31,10-34,10-35,13-31,15-29,18-26,18-26"],
  "cre-scrubland-large":[72,92,6.5,27.5,",,,,,31-36,29-46,21-49,18-57,13-59,11-61,10-63,10-64,13-64,33-61,33-37,33-37,33-37,33-37,33-38,34-38,34-38,30-42"],
  "cre-scrubland-medium":[66,52,5.5,20.5,",32-34,21-45,21-45,13-53,13-53,14-52,18-48,14-52,18-48,25-41,31-35,31-35"],
  "cre-scrubland-small":[54,34,13,24.5,",,26-28,18-36,10-44,8-47,3-51,13-38,26-28"],
  "cre-temperate-large":[72,92,25.5,27.5,"34-38,34-38,35-37,34-38,30-42,27-45,25-47,21-51,20-52,17-55,16-56,15-57,13-59,14-58,10-62,13-59,9-63,14-58,11-61,15-57,14-58,33-40,27-45"],
  "cre-temperate-medium":[64,56,6.5,30.5,",,11-57,4-61,2-62,2-62,2-61,5-56,26-36,29-34,30-34,30-34,29-35,26-38"],
  "cre-temperate-small":[44,38,19.5,22,"21-23,19-25,0-43,1-43,2-42,3-41,0-43,1-43,18-26,18-26"],
  "cre-wetland-large":[64,92,22.5,22.5,",,,,,,25-39,24-40,22-42,21-43,21-43,19-45,18-46,17-47,15-49,14-50,13-51,12-52,11-53,10-54,14-50,19-46,19-46"],
  "cre-wetland-medium":[64,50,16.5,32,"23-39,21-50,14-51,12-50,15-57,6-63,0-63,0-52,12-49,15-49,18-48,21-48,24-48"],
  "cre-wetland-small":[44,44,11.5,20.5,"19-35,10-35,10-34,10-43,3-40,4-39,6-37,9-35,10-34,14-30,17-26"],
  "dev-desert-large":[64,92,20,20,",29-37,28-38,28-38,27-39,27-39,27-39,27-49,27-50,19-51,18-51,18-51,19-50,18-51,18-52,18-51,18-51,18-51,18-52,17-52,18-52,18-51,15-54"],
  "dev-desert-medium":[62,54,6.5,22,",,,,18-43,12-46,10-48,8-48,13-50,11-51,9-37,10-35,27-34,25-37"],
  "dev-desert-small":[44,38,19.5,19.5,",19-22,15-26,15-31,3-39,3-38,4-37,5-36,4-41,3-40"],
  "dev-scrubland-large":[64,92,14.5,20.5,",,34-36,30-41,29-40,29-41,29-47,16-51,11-51,11-50,12-49,14-50,13-49,14-47,16-48,16-47,17-45,18-46,18-45,19-43,20-44,20-43,18-46"],
  "dev-scrubland-medium":[64,46,32,32,"11-52,3-59,3-58,6-63,0-63,0-63,0-63,0-63,0-63,0-63,18-46,24-40"],
  "dev-scrubland-small":[44,38,22,22,"7-37,2-40,2-43,0-43,0-43,0-43,0-43,0-43,0-32,15-28"],
  "dev-temperate-large":[64,92,7.5,27.5,"28-36,28-36,17-47,17-47,12-52,12-52,12-52,7-57,7-57,6-58,5-59,5-59,5-59,5-59,7-57,6-58,30-34,30-34,29-35,29-35,29-35,29-35,25-39"],
  "dev-temperate-medium":[64,56,17.5,23.5,"31-34,22-42,22-42,16-48,17-47,11-53,12-52,9-55,10-54,12-52,13-51,16-48,31-33,26-38"],
  "dev-temperate-small":[40,44,11.5,18,",,19-21,18-21,19-37,2-37,3-36,5-35,7-32,9-31,11-28"],
  "dev-wetland-large":[64,92,4.5,32,"18-48,13-53,8-58,7-59,4-62,4-62,1-63,1-63,1-63,0-63,0-63,2-63,1-34,31-33,31-33,31-33,30-34,30-34,30-34,30-34,30-34,30-34,28-36"],
  "dev-wetland-medium":[64,40,32,32,"28-47,16-52,9-54,9-61,5-61,1-62,2-63,9-54,0-63,0-63"],
  "dev-wetland-small":[40,44,6,19,"11-24,4-32,4-35,6-39,2-39,2-33,8-30,11-27,14-26,15-25,16-24"],
  "jur-desert-large":[64,92,19.5,19.5,"30-34,30-34,27-37,25-39,24-40,21-43,21-43,18-46,18-46,16-48,16-48,14-50,14-50,13-51,13-51,13-51,13-51,13-51,15-49,15-49,29-35,29-35,26-38"],
  "jur-desert-medium":[66,54,6.5,28,"37-38,22-38,22-52,10-52,8-61,9-61,6-61,7-60,9-59,31-36,31-35,31-35,31-35,27-39"],
  "jur-desert-small":[44,36,16.5,16.5,",,,20-24,12-32,7-37,6-38,6-38,6-38"],
  "jur-scrubland-large":[64,92,19.5,23,",,,,31-33,31-34,30-39,23-41,23-40,24-45,18-45,18-45,18-44,30-49,14-50,13-39,19-53,12-55,10-55,10-35,29-35,29-35,26-38"],
  "jur-scrubland-medium":[72,54,3.5,33.5,",,,,31-42,20-53,20-52,9-64,12-60,6-68,3-69,33-39,33-39,33-39"],
  "jur-scrubland-small":[48,38,14.5,20.5,",,18-30,17-37,10-38,11-37,4-44,6-42,11-35,22-26"],
  "jur-temperate-large":[72,92,7.5,29.5,"33-39,24-48,24-48,18-54,13-59,13-59,10-62,10-62,11-61,7-65,9-63,7-65,8-64,9-63,11-61,13-59,34-38,33-39,33-39,33-39,33-39,33-39,29-43"],
  "jur-temperate-medium":[64,54,23,32,"24-30,17-41,15-48,8-53,11-57,7-56,0-61,3-63,14-54,14-50,10-55,30-34,30-34,28-36"],
  "jur-temperate-small":[44,38,8.5,22,"19-25,9-35,7-37,9-35,1-43,0-43,0-43,14-30,15-29,17-27"],
  "jur-wetland-large":[70,92,6.5,32.5,",,,,21-50,11-60,9-62,6-64,5-67,3-67,3-37,33-37,33-37,33-37,33-37,33-37,33-37,33-37,33-37,33-37,33-37,33-37,29-41"],
  "jur-wetland-medium":[70,50,3.5,31.5,",,,,22-49,15-59,11-60,12-61,5-66,4-66,27-43,34-36,33-37"],
  "jur-wetland-small":[54,40,17.5,23.5,",,,21-33,21-42,12-42,15-38,6-50,4-50,23-31"],
  "neo-desert-large":[64,92,8.5,19,",,27-37,15-38,14-38,14-38,14-38,14-49,14-51,14-51,14-51,14-51,14-51,26-51,26-51,26-38,26-38,26-38,26-38,26-38,26-38,26-38,24-40"],
  "neo-desert-medium":[64,50,25.5,26.5,",,32-33,20-44,20-44,10-54,12-52,14-50,6-58,7-57,12-52,8-56,7-57"],
  "neo-desert-small":[44,40,8.5,17,",10-12,7-37,6-39,8-38,8-37,9-36,13-31,14-30,18-26"],
  "neo-scrubland-large":[64,92,18.5,31.5,",,29-35,25-39,24-40,14-50,9-55,8-56,9-55,8-56,2-62,1-63,2-62,6-58,5-59,6-58,11-53,10-54,14-50,30-35,30-36,29-36,27-37"],
  "neo-scrubland-medium":[66,48,9.5,29.5,"19-47,14-53,10-57,6-58,5-62,8-63,16-59,19-47,21-45,24-42,26-40,29-37"],
  "neo-scrubland-small":[48,34,8.5,23,"24-32,12-35,10-41,4-44,3-43,2-47,4-45,17-30,20-28"],
  "neo-temperate-large":[72,92,35.5,35.5,",32-40,28-44,21-51,19-53,20-52,21-51,12-60,10-62,9-63,11-61,5-67,3-69,2-70,4-68,8-64,3-69,2-70,2-70,1-71,5-67,33-39,25-47"],
  "neo-temperate-medium":[64,54,5.5,25.5,"27-37,18-45,15-48,11-53,8-56,7-57,8-56,16-53,14-54,14-44,30-34,30-34,30-34,27-37"],
  "neo-temperate-small":[44,38,20.5,20.5,",25-32,10-33,10-29,15-28,12-32,3-41,2-42,4-40,16-28"],
  "neo-wetland-large":[64,92,7.5,30.5,",16-48,14-50,15-49,8-56,4-60,3-61,6-58,5-59,3-61,2-62,4-60,14-50,29-33,29-34,29-35,29-35,29-35,29-35,29-35,29-35,29-35,25-39"],
  "neo-wetland-medium":[64,56,17,24.5,"26-37,19-44,19-44,12-51,12-51,13-49,15-48,8-56,8-54,12-52,15-48,17-45,21-42,25-39"],
  "neo-wetland-small":[44,46,9.5,14.5,"18-20,18-27,13-30,13-30,8-36,8-36,9-35,11-33,12-32,14-30,16-28,19-25"],
  "pal-desert-large":[72,90,7.5,36,",,,,18-46,6-59,8-62,0-70,0-71,0-71,0-71,0-71,0-71,10-65,11-41,34-41,32-40,31-39,31-38,31-38,32-39,32-39,29-43"],
  "pal-desert-medium":[64,56,9,25,",,,,24-50,12-54,7-55,6-55,6-53,9-49,15-49,18-44,26-34,26-38"],
  "pal-desert-small":[44,40,19,22,",,21-23,8-36,6-38,4-40,2-41,0-43,0-37,18-26"],
  "pal-scrubland-large":[72,92,6.5,28,",,,40-40,27-43,24-50,19-52,17-54,15-57,13-60,11-62,9-63,8-57,14-38,34-38,34-38,34-38,34-38,34-38,34-38,34-38,34-38,30-42"],
  "pal-scrubland-medium":[72,56,3,35,",27-45,13-62,12-61,7-69,2-71,4-66,27-40,33-37,33-37,33-37,33-38,33-38,34-38"],
  "pal-scrubland-small":[46,40,10.5,17.5,",17-29,13-29,11-35,9-39,6-40,8-38,10-36,13-33,16-30"],
  "pal-temperate-large":[72,92,24.5,24.5,",34-38,34-38,34-38,35-37,30-42,25-47,25-47,23-49,22-50,21-51,20-52,19-53,18-54,17-55,15-57,15-57,14-58,12-60,12-60,15-57,33-39,26-46"],
  "pal-temperate-medium":[64,54,7.5,32,",23-45,13-53,10-54,4-58,2-62,0-63,0-63,2-61,22-43,29-36,29-36,29-36,25-39"],
  "pal-temperate-small":[44,38,6.5,20.5,"6-38,1-40,3-40,9-40,10-41,9-38,9-31,12-29,17-27,17-27"],
  "pal-wetland-large":[64,92,24.5,24.5,",,29-35,30-34,26-38,22-42,21-43,20-44,19-45,18-46,16-48,16-48,14-50,13-51,12-52,11-53,10-54,9-55,8-56,18-46,18-43,14-48,14-48"],
  "pal-wetland-medium":[60,28,21.5,28.5,",30-30,5-54,2-58,3-57,9-51"],
  "pal-wetland-small":[44,20,14.5,20.5,",8-36,2-42,3-41,11-33"],
  "per-desert-large":[72,92,7.5,32.5,"21-51,18-54,21-51,11-61,12-60,14-58,6-66,7-65,8-64,4-68,5-67,6-66,27-45,34-38,34-38,34-38,33-39,33-39,33-39,33-39,33-39,33-39,29-43"],
  "per-desert-medium":[66,54,6.5,31.5,",21-43,15-49,11-53,5-59,3-61,6-58,1-63,2-62,30-35,31-35,31-35,31-35,27-39"],
  "per-desert-small":[44,36,19.5,19.5,",15-29,11-33,7-37,4-40,3-41,3-41,3-41,3-41"],
  "per-scrubland-large":[72,96,15,31,"45-51,41-53,41-48,41-60,42-65,43-66,17-44,14-43,12-42,37-58,35-63,34-65,16-38,11-38,9-39,34-58,33-62,31-64,9-34,6-32,5-30,27-30,28-31,26-34"],
  "per-scrubland-medium":[64,46,1.5,30.5,",,,,,14-52,13-55,6-59,3-61,2-62,31-33,31-33"],
  "per-scrubland-small":[44,46,21.5,21.5,",7-19,8-38,14-37,16-30,10-34,4-35,2-41,1-42,1-43,5-41,19-25"],
  "per-temperate-large":[72,92,7.5,35,"27-54,28-54,17-56,15-57,16-59,7-59,5-67,6-69,2-69,3-71,8-66,25-49,30-45,35-40,34-39,34-39,33-39,33-39,33-39,33-39,33-39,33-39,29-43"],
  "per-temperate-medium":[66,54,6.5,26.5,"26-40,16-50,15-51,12-54,8-58,8-58,8-58,7-59,28-38,31-35,31-35,31-35,31-35,27-39"],
  "per-temperate-small":[44,36,11.5,21.5,",13-31,6-38,6-38,1-43,2-42,6-38,9-35,16-28"],
  "per-wetland-large":[64,92,14,28.5,",,26-40,20-41,19-50,20-51,14-50,13-47,14-55,17-56,8-55,7-51,8-46,12-59,18-60,5-59,4-54,5-48,10-34,16-34,30-34,30-34,27-37"],
  "per-wetland-medium":[64,50,2.5,30.5,",,,,25-48,16-49,7-58,7-57,3-61,2-62,30-34,30-34,30-34"],
  "per-wetland-small":[40,46,12.5,14.5,",15-25,13-27,13-27,10-30,12-28,8-32,11-29,6-34,10-30,8-32,19-21"],
  "q-agave":[44,40,17.5,19.5,",22-23,15-29,7-37,8-36,3-41,4-40,7-37,7-37,5-39"],
  "q-bald-cypress":[64,92,26.5,26.5,",,29-35,29-35,30-34,24-39,21-43,21-47,19-45,19-45,14-48,16-48,14-50,14-50,11-53,11-53,9-55,9-55,6-58,6-58,16-44,13-49,13-49"],
  "q-cattails":[44,46,11,16,"16-21,16-25,15-32,11-34,7-38,7-38,8-37,10-36,12-34,13-31,16-29,18-27"],
  "q-cypress-knees":[40,34,18.5,18.5,",19-21,19-21,13-22,11-28,5-34,4-36,3-37,2-38"],
  "q-dawn-redwood":[64,92,25.5,25.5,"30-34,30-34,30-34,26-38,24-40,24-40,22-42,21-43,20-44,19-45,18-46,17-47,15-48,14-50,14-50,12-52,11-53,10-54,9-55,8-56,7-57,8-56,25-39"],
  "q-ginkgo":[64,52,5.5,27,"25-39,18-47,14-51,11-55,7-56,6-58,5-58,9-54,20-45,30-34,30-34,30-34,27-37"],
  "q-japanese-cherry":[64,50,6.5,31,"25-39,14-51,11-54,5-59,3-61,2-63,3-62,20-45,26-37,29-34,30-35,30-36,26-38"],
  "q-lilac":[56,50,20.5,22.5,",31-31,21-32,20-39,14-41,12-42,11-45,8-47,7-49,6-50,8-48,16-41,20-35"],
  "q-mangrove":[64,56,25.5,27.5,",24-41,14-51,13-52,7-57,5-59,6-58,8-56,17-47,14-50,11-53,9-55,8-56,7-57"],
  "q-mesquite":[64,52,6.5,32,",23-41,11-53,8-56,3-61,0-63,1-63,2-62,23-41,29-35,29-34,29-34,26-38"],
  "q-prickly-pear":[48,44,12.5,20,",19-25,12-29,8-39,5-43,5-44,6-43,10-40,11-37,12-36,16-32"],
  "q-rose-bush":[56,44,18.5,24.5,",,,26-28,19-43,10-46,5-51,4-52,5-51,8-48,15-42"],
  "q-sagebrush":[48,40,16,21.5,",,20-30,13-33,7-41,4-44,3-45,5-43,8-39,10-38"],
  "q-sugar-maple":[64,92,7.5,25.5,",26-38,22-42,15-49,11-53,10-54,8-56,7-57,8-56,7-57,8-56,10-54,27-37,28-36,30-34,30-34,30-34,29-35,29-35,29-35,29-35,29-35,25-39"],
  "q-water-lily":[48,26,22,23,",,18-40,16-39,3-45,2-47,17-47"],
  "q-weeping-willow":[72,92,7.5,29,",,,,,24-48,21-51,14-58,11-61,8-63,7-64,7-64,7-64,7-64,7-64,7-64,11-60,15-56,23-51,32-38,32-39,33-39,29-43"],
  "q-white-oak":[72,92,9.5,36,",36-36,26-46,24-48,19-54,17-56,16-57,4-68,1-71,0-71,3-69,1-71,0-71,2-70,6-66,31-40,32-39,32-39,33-39,33-39,33-39,33-39,27-45"],
  "qua-desert-large":[72,92,8.5,36,"26-34,20-40,17-56,14-66,4-65,5-69,1-63,7-66,2-71,0-71,0-71,0-70,2-63,10-57,16-50,32-40,32-39,33-40,33-40,33-39,33-40,33-40,28-44"],
  "qua-desert-medium":[56,52,12.5,14.5,",,,19-37,17-39,15-41,14-42,14-42,14-42,14-42,15-41,17-39,20-36"],
  "qua-desert-small":[44,40,12,20.5,"25-25,13-27,4-37,3-38,5-37,1-41,2-41,5-38,12-32,16-25"],
  "qua-scrubland-large":[70,92,11,32.5,",23-43,16-53,15-55,9-57,5-63,4-67,7-68,7-65,6-63,7-64,10-62,10-53,10-64,14-64,18-61,22-56,26-51,28-48,29-45,30-43,32-40,29-41"],
  "qua-scrubland-medium":[68,54,13.5,28.5,",29-39,18-50,12-56,9-59,7-61,6-62,7-61,8-60,11-57,17-51,23-47,26-43,29-39"],
  "qua-scrubland-small":[48,44,12.5,15,"22-24,16-32,15-32,15-32,15-32,15-32,16-34,10-39,12-37,15-34,20-29"],
  "qua-temperate-large":[72,92,7.5,34.5,"23-49,19-53,15-57,9-63,8-64,7-65,5-67,3-69,2-70,4-68,2-70,3-69,10-62,34-38,34-38,34-38,33-39,33-39,33-39,33-39,33-39,33-39,29-43"],
  "qua-temperate-medium":[64,52,22,29.5,"32-32,18-46,12-52,11-53,6-58,4-60,3-61,3-61,4-60,11-54,11-54,21-43,22-42"],
  "qua-temperate-small":[44,40,7.5,21.5,"20-24,19-24,13-31,14-30,7-37,2-42,1-43,5-39,15-29,21-23"],
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
  "tri-wetland-large":[64,92,26.5,32,",,,,31-35,22-40,19-49,16-52,13-54,10-57,8-59,6-61,4-61,3-63,2-63,0-62,0-63,3-63,1-58,0-47,0-34,30-34,28-36"],
  "tri-wetland-medium":[72,50,4.5,34.5,",,,,28-46,18-55,9-65,8-65,5-69,2-70,13-54,35-37,35-37"],
  "tri-wetland-small":[44,44,12,21.5,"31-31,29-33,11-33,12-43,1-43,2-41,4-39,7-37,9-34,12-32,15-29"],
  "boulder-desert-1":[72,61,31,32,",25-55,16-59,10-61,10-62,8-63,6-64,5-64,4-65,4-66,4-67,6-67,8-67,10-56,28-46"],
  "boulder-desert-2":[36,60,13.5,14,",18-29,14-30,12-31,10-31,8-31,7-31,7-31,6-31,5-31,4-30,4-30,4-29,8-26"],
  "boulder-desert-3":[76,63,33,34,",42-63,37-66,34-69,31-70,15-70,10-71,7-71,6-71,5-71,4-71,4-70,4-66,4-52,11-29"],
  "boulder-desert-4":[53,64,21,22.5,",12-38,7-42,7-44,5-47,5-47,4-48,4-48,4-48,4-48,4-48,5-48,6-46,7-42,21-39"],
  "boulder-scrubland-1":[68,66,30,30.5,",21-51,14-57,11-60,10-60,9-61,9-62,8-62,7-63,5-63,5-63,3-63,3-62,3-60,7-55,23-41"],
  "boulder-scrubland-2":[37,59,14.5,15,",16-29,13-30,10-31,9-31,8-31,6-32,6-32,6-31,5-31,3-31,3-31,4-31,7-26"],
  "boulder-scrubland-3":[74,62,33,33,",38-64,34-66,32-67,32-68,15-68,9-69,8-69,6-69,5-69,5-69,4-69,4-65,7-57,12-34"],
  "boulder-scrubland-4":[57,63,23.5,24.5,",21-36,12-45,10-47,7-51,7-51,5-52,5-52,4-52,4-52,4-52,4-52,5-47,5-43,6-39"],
  "boulder-temperate-1":[59,54,24,25.5,",15-42,12-50,10-53,7-53,6-54,5-54,4-54,4-54,4-53,5-51,6-48,19-35"],
  "boulder-temperate-2":[73,52,31.5,33,",38-61,34-63,32-66,30-67,9-68,7-68,5-68,3-68,3-67,3-63,9-33"],
  "boulder-temperate-3":[33,52,13,13,",15-25,11-27,9-28,7-28,6-28,4-28,4-28,3-28,3-28,5-27,6-26"],
  "boulder-temperate-4":[56,49,22,24,",13-36,8-46,7-49,6-51,5-51,5-51,4-51,4-49,4-46,10-42,19-25"],
  "boulder-wetland-1":[60,54,26,26,",16-47,11-50,9-51,8-53,6-53,5-54,4-54,4-55,4-55,4-55,9-47,14-42"],
  "boulder-wetland-2":[76,53,32.5,34,",40-59,33-65,31-68,31-70,9-70,8-70,6-71,5-71,4-69,4-66,4-56,16-22"],
  "boulder-wetland-3":[55,46,22.5,23.5,",15-42,12-46,7-49,7-49,5-50,4-50,4-50,4-50,8-46,13-42"],
  "rock-desert-1":[43,31,16.5,17.5,",7-31,6-36,5-38,4-38,4-37,10-35"],
  "rock-desert-2":[33,32,11.5,12.5,",7-24,5-26,4-28,4-28,4-28,4-25"],
  "rock-desert-3":[32,39,11.5,12,",10-22,7-25,5-26,5-26,4-27,4-27,4-26,7-24"],
  "rock-desert-4":[31,29,11,11.5,",7-22,5-25,4-26,4-26,5-26,12-19"],
  "rock-desert-5":[34,32,13,13,",7-24,4-27,4-28,4-29,4-29,7-25"],
  "rock-desert-6":[40,29,15,16,",18-32,4-34,4-35,4-35,4-33,9-23"],
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
  "rock-wetland-1":[43,31,15.5,17.5,",6-34,4-36,4-38,4-38,4-37,10-33"],
  "rock-wetland-2":[30,30,11,11,",6-22,5-25,4-25,4-25,4-25,8-24"],
  "rock-wetland-3":[39,31,14,16,",9-29,5-33,3-34,3-34,3-34,9-30"],
  "rock-wetland-4":[29,28,8,10.5,",8-21,5-23,4-24,4-24,6-21"],
  "rock-wetland-5":[41,29,16,17,",18-33,7-35,4-36,3-36,3-34,11-15"],
};
// SPRITE_HIT:end
const plantMix = (a, b, t) => "#" + [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, "0")).join("");
// Rocks and boulders are the same in every biome, just a natural stone color that fits it. Boulders run a shade darker.
const ROCK_STONE = {desert:"#B98F68", tropical:"#6F7468", grassland:"#8E9188", scrubland:"#A39A83", wetland:"#6B7B76", temperate:"#868A8C", boreal:"#5F6A73", tundra:"#7F8780"};
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

const BIOME_HAPPY = {home:8, near:3, away:-6};   // happiness in an animal's home biome, its second one, or any other
const DEFAULT_BIOME = "grassland";              // new exhibits start out as plain ground
// Each animal's home biome, then the one it gets by in. Vivarium animals count too: a vivarium is laid out as a biome like any exhibit.
const SPECIES_BIOMES = Object.fromEntries(Object.entries({
  eryo:"wetland tropical",    lyst:"scrubland desert",     mosc:"scrubland desert",     dime:"scrubland wetland",
  scut:"desert scrubland",    este:"temperate wetland",    coty:"scrubland desert",     ante:"wetland temperate",
  inos:"scrubland temperate", prio:"wetland tropical",     sile:"scrubland desert",     coel:"desert scrubland",
  herr:"scrubland temperate", desm:"scrubland desert",     plat:"temperate scrubland",  post:"scrubland tropical",
  eryt:"desert scrubland",    liso:"scrubland temperate",  hete:"desert scrubland",     orni:"temperate scrubland",
  dryo:"grassland temperate", dimo:"tropical wetland",     scel:"temperate wetland",    dilo:"tropical scrubland",
  kent:"scrubland tropical",  steg:"grassland scrubland",  cryo:"boreal temperate",     cera:"scrubland grassland",
  mgal:"temperate wetland",   allo:"grassland scrubland",  cama:"grassland temperate",  torv:"scrubland grassland",
  apat:"grassland wetland",   dipl:"grassland scrubland",  brac:"tropical grassland",   hyps:"temperate wetland",
  psit:"temperate scrubland", prot:"desert scrubland",     ornm:"temperate grassland",  ovir:"desert scrubland",
  minm:"temperate scrubland", gall:"desert grassland",     para:"wetland temperate",    igua:"temperate wetland",
  velo:"desert scrubland",    pter:"wetland tropical",     conc:"wetland tropical",     nige:"tropical wetland",
  utah:"temperate scrubland", styr:"grassland temperate",  bary:"wetland temperate",    ther:"wetland temperate",
  dsuc:"wetland tropical",    yutt:"boreal temperate",     anky:"temperate grassland",  tric:"grassland temperate",
  cnot:"grassland scrubland", dche:"wetland temperate",    quet:"grassland scrubland",  spin:"wetland tropical",
  pata:"grassland temperate", carc:"desert scrubland",     trex:"temperate grassland",  proc:"tropical temperate",
  hyae:"temperate scrubland", ambu:"wetland tropical",     uint:"temperate wetland",    andr:"scrubland grassland",
  bari:"tropical wetland",    arge:"grassland scrubland",  arsi:"wetland tropical",     tita:"tropical wetland",
  dino:"grassland scrubland", daeo:"grassland scrubland",  aepy:"grassland scrubland",  kele:"grassland scrubland",
  thyl:"scrubland temperate", mchl:"scrubland tropical",   chal:"temperate tropical",   aind:"tropical temperate",
  drom:"scrubland grassland", plty:"wetland grassland",    amph:"temperate grassland",  gpit:"tropical temperate",
  siva:"grassland scrubland", pcer:"scrubland desert",     dire:"grassland boreal",     macr:"grassland scrubland",
  arct:"boreal temperate",    doed:"grassland scrubland",  mgth:"temperate scrubland",  mlan:"scrubland desert",
  smil:"grassland temperate", mast:"boreal temperate",     elas:"grassland boreal",     mamm:"tundra boreal",
  colm:"grassland temperate",
  icht:"wetland tropical",    tikt:"wetland tropical",     mibr:"wetland tropical",     hylo:"tropical temperate",
  dcau:"wetland tropical",    arth:"tropical wetland",     pulm:"tropical scrubland",   mega:"tropical wetland",
  diic:"scrubland desert",    seym:"scrubland wetland",    plhy:"scrubland desert",     shar:"temperate wetland",
  long:"temperate wetland",   gigt:"scrubland tropical",   anch:"temperate tropical",   comp:"scrubland temperate",
  yiqi:"temperate boreal",    arch:"scrubland temperate",  beel:"scrubland tropical",   mono:"desert scrubland",
  mcer:"temperate grassland", scan:"temperate boreal",     micr:"temperate wetland",     kool:"boreal wetland",
  simo:"tropical wetland",    ples:"temperate tropical",   paki:"wetland tropical",     lept:"temperate tropical",
  sifr:"temperate grassland", ptil:"temperate grassland",  miac:"temperate tropical",    waim:"temperate wetland",
  tmyr:"tropical temperate",  dgal:"scrubland temperate",  nura:"scrubland temperate",  hopl:"scrubland temperate",
  psil:"grassland scrubland", ornw:"scrubland temperate",  dodo:"tropical scrubland",    ppig:"temperate grassland",
  gtod:"tropical temperate",  rmlo:"grassland scrubland",  sdel:"scrubland temperate",
}).map(([id, b]) => [id, b.split(" ")]));
const biomesOf = s => SPECIES_BIOMES[s.id] || null;

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
const SNOW_HEAT = (t, type) => ["oracle", "ghost", "tar", "ceres", "pmc", "generator", "edcenter", "restroom", "breakroom", "greenhouse", "hatchery"].includes(type) || t.kind === "food" || t.rooms ? 2
  : ["warehouse", "coldstore", "toolshed", "dock", "depot", "closet", "farm", "ranch", "station"].includes(type) ? 0 : 1;
const THEMES = {
  genesis: {label:"Genesis", tex:"genesis", ptex:"genesis-concrete", btex:"genesis-seam",
    blurb:"A conservation campus: forest green metal roofs, pale lab membranes, poured concrete and matte gold trim. Practical, never ornate.",
    // warm gray concrete between dark green curbs
    path:{live:"#D9D4C7", dead:"#BDB8AC", edge:"#1F3D2B"},
    bld:"#1F3D2B", mix:0, edge:"#14281C", accent:"#C9A24B", fee:0, fits:[],
    // roofs by what a building does: 0 public (green standing seam, slim gold ridge cap), 1 labs (pale flat membrane, dark green parapet, rooftop units), 2 utilities and power (dark slate)
    // every roof gets a thin matte gold edge line. Gold is only ever a line or a dot.
    roofs:{of:(t, type) => ["oracle", "ghost", "tar", "ceres", "pmc"].includes(type) ? 1
        : ["generator", "depot", "workshop", "toolshed", "warehouse", "coldstore", "dock", "closet", "security", "farm", "ranch", "hatchery", "insectary"].includes(type) ? 2 : 0,
      btex:["genesis-seam", "genesis-lab", "genesis-slate"],
      trim:[[{c:"#C9A24B", w:.9, at:.94}],
        [{c:"#1F3D2B", w:5, at:.985}, {c:"#C9A24B", w:.9, at:.92}],
        [{c:"#C9A24B", w:.8, at:.94}]],
      ridge:[[{c:"#10261A", w:3.6}, {c:"#C9A24B", w:1.5}], null, null],
      units:[null, {c:"#B3AEA1", c2:"#6F6B61", n:3, min:150}, null]},
    eave:{c:"#14281C", w:1.8},
    emblem:["oracle", "ghost", "tar", "ceres"],
    // dark green steel rail: two rails with a small gold cap on each post. Dangerous animals get a tall steel panel wall on a concrete base with a gold band along the top.
    bord:{band:"#CBC5B4", c:"#1F3D2B", w:5, trim:[{c:"#C9A24B", w:1}],
      more:[{c:"#CBC5B4", w:1.5}, {c:"#14281C", w:6.5, dash:"0 34", cap:"round"}, {c:"#C9A24B", w:3, dash:"0 34", cap:"round"}],
      by:{
        bars:{band:"#CBC5B4", c:"#1F3D2B", w:5,
          more:[{c:"#CBC5B4", w:1.5}, {c:"#3F6B52", w:1, dash:"1 3"}, {c:"#14281C", w:6.5, dash:"0 34", cap:"round"}, {c:"#C9A24B", w:3, dash:"0 34", cap:"round"}]},
        acrylic:{band:"#CBC5B4", c:"#1F3D2B", w:5,
          more:[{c:"#D5ECE6", w:2.2}, {c:"#14281C", w:6.5, dash:"0 34", cap:"round"}, {c:"#C9A24B", w:3, dash:"0 34", cap:"round"}]}},
      strong:{band:"#CBC5B4", base:{c:"#A8A396", w:13, c2:"#7D7869", dash2:"3 5"}, c:"#2E3A36", w:7,
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
        : t.kind === "food" || t.rooms || ["breakroom", "workshop", "security", "insectary", "depot", "greenhouse", "hatchery", "station", "toolshed"].includes(type) ? 1 : 0,
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
    unlock:{hint:"Research Modern design at ORACLE.", check:() => hasTech("modern")}},
  japanese: {label:"Japanese Garden", ground:"#7FA68F", tex:"japanese", gtex:"japanese-moss", ptex:"japanese-plank", btex:"japanese-tile", blurb:"Calm and precise: curved tile roofs, golden thatch, dark timber walkways with pebble edges, bamboo lattice and plaster walls, clipped moss and raked gravel. Red is kept for lanterns.",
    path:{live:"#6A5240", dead:"#54402F", edge:"#2E2118", kerb:{c:"#CFCBBE", dash:"2.4 1.6"}}, bld:"#3C4146", mix:.85, edge:"#1F1A16", accent:"#C8442E", fee:.2, fits:["tric", "steg", "dipl", "para", "anky"],
    // roofs by building: 0 labs and medicine (charcoal tile), 1 work and storage (weathered green-gray tile), 2 guest buildings (charcoal tile with ochre accents).
    // Small buildings (restrooms, shops, keeper huts) get rounded golden thatch instead. Every roof has a dark timber edge round a pale plaster band, and a raised ridge cap down the middle.
    roofs:{of:(t, type) => ["oracle", "ghost", "tar", "ceres", "pmc", "generator", "greenhouse"].includes(type) ? 0
        : ["warehouse", "coldstore", "toolshed", "dock", "depot", "closet", "farm", "ranch", "station", "workshop", "breakroom", "security", "insectary", "hatchery"].includes(type) ? 1 : 2,
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
  {id:"keeper",   text:"Hire a Keeper",                      hint:"Partner parks feed your animals until day 5. Before then, build a Keeper Station beside a path or service road, tap it, and hire a keeper.", reward:6000, check:g=>g.state.staff.keepers.length>0},
  {id:"dock",     text:"Build a Delivery Dock",              hint:"Animal food has to be bought now. Build a Delivery Dock beside a service road. It orders overnight, custodians stock a station from it, and keepers carry the food out to the exhibits. Partner parks cover the first deliveries.", reward:5500, check:g=>g.state.buildings.some(b=>b.type==="dock")},
  {id:"custodian",text:"Hire a Custodian",                   hint:"Stands and shops sell from their own stock, and someone has to carry it from the dock. Build a Custodial Closet beside a path or service road and hire a custodian. They also clean restrooms and sweep litter.", reward:3500, check:g=>(g.state.staff.custodians || []).length>0},
  {id:"guard",    text:"Hire a Security Guard",              hint:"Unhappy, rowdy guests break benches and spray graffiti. Research Security offices at ORACLE, build one beside a path, and hire a guard to patrol. Lamp posts help too.", reward:4000, check:g=>(g.state.staff.guards || []).length>0},
  {id:"gate",     text:"Give an exhibit a Keeper Gate",      hint:"Run a path or service road to an exhibit's fence, then use Gates under Exhibit Tools on that fence.", reward:3000, check:g=>g.state.exhibits.some(e=>!e.viv && e.gate && gateCheck(e).ok)},
  {id:"mechanic", text:"Hire a Mechanic",                    hint:"Fences wear down, and predators attack them. Build a Workshop beside a path or service road and hire a mechanic to inspect and repair them.", reward:4500, check:g=>(g.state.staff.mechanics || []).length>0},
  {id:"vet",      text:"Hire a Vet",                         hint:"Animals get sick, and some get hurt fighting. Build a Paleo-Medicine Center beside a path or service road and hire a vet. Vets also dart escaped animals.", reward:14000, check:g=>(g.state.staff.vets || []).length>0},
  {id:"zone",     text:"Draw a Work Zone",                   hint:"Zones split the park into areas with their own keepers and stores. Pick the Zone tool, draw around some exhibits and a station, then assign keepers to it from its panel.", reward:3000, check:g=>(g.state.zones||[]).length>0},
  {id:"g100",     text:"Get 100 Guests in one day",          hint:"More animals and happier animals bring more guests.", reward:5000,  statue:"lyst", check:g=>g.state.history.some(h=>h.guests>=100)},
  {id:"g1000",    text:"Get 1000 Guests in one day",         hint:"Keep adding animals, food, restrooms and room on the paths. Happy guests tell their friends.", reward:10000,  statue:"kele", check:g=>g.state.history.some(h=>h.guests>=1000)},
  {id:"oracle",   text:"Build ORACLE",                       hint:"Every other animal comes from the past. ORACLE researches time periods. Place it beside a path or service road.", reward:12000, statue:"anning", check:g=>g.state.buildings.some(b=>b.type==="oracle")},
  {id:"cenozoic", text:"Unlock a Cenozoic Animal's genome",  hint:"Tap ORACLE and hire a researcher. Idle researchers earn research points as the day goes on. Open the Cenozoic tab (Paleogene, Neogene, Quaternary) and start unlocking an animal.", reward:6000, statue:"proc", check:eraUnlocked("cenozoic")},
  {id:"mesozoic", text:"Unlock a Mesozoic Animal's genome",  hint:"Open the Mesozoic tab (Triassic, Jurassic, Cretaceous) at ORACLE and start unlocking an animal.", reward:8000, statue:"coel", check:eraUnlocked("mesozoic")},
  {id:"paleozoic",text:"Unlock a Paleozoic Animal's genome", hint:"Open the Paleozoic tab (Devonian, Carboniferous, Permian) at ORACLE and start unlocking an animal.", reward:10000, statue:"dime", check:eraUnlocked("paleozoic")},
  {id:"cloneq",   text:"Clone a Quaternary Animal",          hint:"Unlock and complete the genome of a Quaternary animal, then clone it at TAR.", theme:"stone", check:g=>g.state.exhibits.some(e=>e.animals.some(a=>a.cl && SPECIES_BY_ID[a.sp].period==="Quaternary"))},
  {id:"ghost",    text:"Build GHOST and send an expedition", hint:"GHOST travels to the periods of animals you've unlocked. Hire a Temporal Researcher at GHOST, then pick the animal under its period's tab and send GHOST.", reward:30000, statue:"brown", check:g=>Object.keys(g.state.science.dna).length>0},
  {id:"genome",   text:"Complete a genome",                  hint:"Each sample fills part of a genome. Keep sending trips for the same species until it reaches 100%.", reward:10000, statue:"herr", check:g=>Object.values(g.state.science.dna).some(d=>d.genome>=100)},
  {id:"clone",    text:"Build TAR and clone an animal",      hint:"TAR turns a complete genome into an animal. Hire a Geneticist at TAR, then order clones from TAR or from an exhibit's panel.", reward:22000, statue:"orni", check:g=>g.state.exhibits.some(e=>e.animals.some(a=>a.cl))},
  {id:"ceres",    text:"Build CERES",                        hint:"Medicine for prehistoric animals is grown at CERES, once ORACLE has researched it. Place it beside a path or service road and hire a botanist.", reward:15000, check:g=>g.state.buildings.some(b=>b.type==="ceres")},
  {id:"sp4",      text:"Display 4 different species",        hint:"Variety raises your rating. Herbivores can share an exhibit.", reward:8000,  statue:"prot", check:g=>g.speciesShown()>=4},
  {id:"star3",    text:"Reach a 3-star rating",              hint:"Keep animals happy, give guests food and restrooms, and add variety.", reward:15000, statue:"marsh", check:g=>g.state.rating>=3},
  {id:"cash1m",   text:"Have $1,000,000 in the bank",        hint:"Earn more than you spend. Check the day report after closing.", theme:"gilded", check:g=>g.state.money>=1000000},
  {id:"trex",     text:"Bring in a Tyrannosaurus rex",       hint:"Unlock the Tyrannosaurus at ORACLE, collect a full T. rex genome with GHOST, and reach 4.5 stars. It needs a lot of room.", reward:60000, statue:"cope", check:g=>g.state.exhibits.some(e=>e.animals.some(a=>a.sp==="trex"))},
  {id:"camp",     text:"Build a Campground",                 hint:"Research Hotels at ORACLE. Once your park has 2 stars and 100 guests a day, build a Campground beside a path. Guests stay the night and spend tomorrow in the park.", reward:10000, check:g=>g.state.buildings.some(b=>b.type==="campground")},
  {id:"hotel",    text:"Build a Safari Lodge",               hint:"Once your park has 3 stars and 300 guests a day, build a Safari Lodge beside a path.", reward:40000, check:g=>g.state.buildings.some(b=>b.type==="lodge")},
  {id:"resort",   text:"Build a Resort Hotel",               hint:"Once your park has 4 stars and 700 guests a day, build a Resort Hotel beside a path.", reward:150000, check:g=>g.state.buildings.some(b=>b.type==="resort")},
];
// What a grant pays: cash, or a theme
const grantPrize = g => (g.theme ? `${THEMES[g.theme].label} theme` : money(g.reward)) + (g.statue ? ` and ${LAND["st-" + g.statue].label.replace(/ Statue$/, "")} statue` : "");
