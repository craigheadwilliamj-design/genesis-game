/* =====================================================================
   GAME DATA
   This is the easiest file to tinker with. Change a price, add an
   animal, or make the game harder or easier here. Everything else reads
   from these lists.
   ===================================================================== */

// How the park starts
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
  // Quaternary
  {id:"ornw", name:"Ornimegalonyx",  period:"Quaternary", diet:["carnivore"], price:6000, food:25, space:14, group:[1,3], appeal:7, stars:1, viv:"M"},
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
  paleo:    {label:"Paleontologist",     plural:"Paleontologists",     dept:"oracle", hireCost:3000, wage:250,
             text:"Each one earns 5 research points a day and runs one research project at a time."},
  temporal: {label:"Temporal Researcher", plural:"Temporal Researchers", dept:"ghost",  hireCost:4000, wage:400,
             text:"Each one runs an expedition team. More researchers means more trips at the same time."},
  gene:     {label:"Geneticist",          plural:"Geneticists",          dept:"tar",    hireCost:3500, wage:350,
             text:"Each one runs an incubator, so TAR can grow that many clones at the same time."},
  botanist: {label:"Botanist",            plural:"Botanists",            dept:"ceres",  hireCost:3000, wage:300,
             text:"Each one tends a growing bed, so CERES can grow that many batches at the same time."},
};
const RESEARCH_PER_PALEO = 5;   // research points each paleontologist earns per open day
// How long research takes, in park minutes per point. A 60-point project is 3 open days.
const RESEARCH_MIN_PER_POINT = DAY_MIN / 20;
// What unlocking one animal's genome costs at ORACLE: its period's base plus this much for every $ of its price
const UNLOCK_PER_PRICE = 1 / 2000;

// Expeditions. A trip either finds something or comes back empty-handed, and a find fills part of a genome.
// Bigger animals are harder to find, and a genome takes about 3 trips for the smallest and 8 for the largest.
//   fail     chance of nothing, before the period's own risk: [smallest animal, largest animal]
//   trips    trips a genome takes on average: [smallest, largest]
//   spread   a find is worth between this share less and this share more than average
//   costMul  trip price multiplier: [smallest, largest]
//   bonus    chance a trip also turns up traces of another unlocked animal from that period, and what they add
const TRIP = {fail:[.2, .35], trips:[3, 8], spread:.35, costMul:[.7, 1.3], bonus:{chance:.12, gain:[4, 8]}};
// Size scale for TRIP: m² of room an animal needs at or below the first, and at or above the second
const TRIP_SIZE = [10, 5000];

// Paleoflora genomes. GHOST collects plant DNA from any period of the era; CERES needs it complete before it grows anything.
//   space   how hard it is to find, like an animal's room (see TRIP_SIZE)
const PLANT_DNA = {
  mesozoic:  {id:"flora-mesozoic",  era:"mesozoic",  name:"Mesozoic flora",  space:300,  periods:["Triassic", "Jurassic", "Cretaceous"]},
  paleozoic: {id:"flora-paleozoic", era:"paleozoic", name:"Paleozoic flora", space:900,  periods:["Devonian", "Carboniferous", "Permian"]},
};
const PLANT_DNA_BY_ID = Object.fromEntries(Object.values(PLANT_DNA).map(p => [p.id, p]));

// What one animal clone takes at TAR, in open days: 1 plus 1 more for every this many m² the species needs
const CLONE_DAYS_PER_SPACE = 1000;
// TAR upgrades, researched at ORACLE: each level of incubators adds one more per geneticist, each level of speed cuts clone time
const TAR_UPGRADE = {incubators:1, speed:.75};

// What CERES grows in its beds. Works like TAR's incubators, but with plants.
//   days    how long one batch takes, in open days
//   cost    what one batch costs
//   doses   (medicine) doses one batch makes
const CERES_GROW = {
  flora:    {mesozoic:{days:1.5, cost:1500}, paleozoic:{days:2, cost:2200}},
  medicine: {cenozoic:{days:.75, cost:900, doses:20}, mesozoic:{days:1.25, cost:1500, doses:20}, paleozoic:{days:1.75, cost:2200, doses:20}},
};
const FLORA_BATCH_M2 = 1200;   // one batch of planting stock covers this many m² of an exhibit

// Period colors, the same ones the planning map uses
const PERIOD_COLOR = {
  Devonian:"#C28A4D", Carboniferous:"#67A599", Permian:"#F04028", Triassic:"#812B92", Jurassic:"#34B2C9",
  Cretaceous:"#7FC64E", Paleogene:"#FD9A52", Neogene:"#F2D32A", Quaternary:"#E8E27A"
};

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
  kiosk:     {label:"Food kiosk",  one:"a food kiosk",  glyph:"K", color:"#3F86A8", price:3000,  upkeep:30,  w:6,  d:5,  kind:"food",  menuSlots:1, slots:2,  serveMin:3},
  food:      {label:"Food stand",  one:"a food stand",  glyph:"D", color:"#2F6E8F", price:6000,  upkeep:60,  w:10, d:8,  kind:"food",  menuSlots:2, slots:4,  serveMin:4},
  restaurant:{label:"Restaurant",  one:"a restaurant",  glyph:"F", color:"#1F5470", price:20000, upkeep:220, w:18, d:14, kind:"food",  menuSlots:4, slots:10, serveMin:12, seats:true, minRating:2},
  cart:      {label:"Gift cart",   one:"a gift cart",   glyph:"C", color:"#A06A93", price:3000,  upkeep:25,  w:5,  d:4,  kind:"merch", menuSlots:1, slots:2,  serveMin:3},
  shop:      {label:"Gift shop",   one:"a gift shop",   glyph:"S", color:"#8C4F7D", price:8000,  upkeep:80,  w:12, d:10, kind:"merch", menuSlots:3, slots:3,  serveMin:5},
  megastore: {label:"Megastore",   one:"a megastore",   glyph:"M", color:"#6E3661", price:25000, upkeep:250, w:20, d:14, kind:"merch", menuSlots:5, slots:8,  serveMin:6, minRating:3},
  restroom:  {label:"Restrooms",   one:"restrooms",     glyph:"R", color:"#56708A", price:4000,  upkeep:40,  w:8,  d:6,  serves:["bladder"], slots:4, serveMin:3},
  // small things beside the path
  bin:       {label:"Trash bin",   one:"a trash bin",   glyph:"",  color:"#3C4A3F", price:150,   upkeep:1,   w:1.6, d:1.6, prop:true, onPath:true},
  bench:     {label:"Bench",       one:"a bench",       glyph:"",  color:"#8A6238", price:400,   upkeep:2,   w:3,  d:1.4, prop:true, onPath:true, serves:["energy"], seats:true, slots:2, serveMin:12, patience:2},
  picnic:    {label:"Picnic area", one:"a picnic area", glyph:"",  color:"#9C7A48", price:1500,  upkeep:6,   w:6,  d:5,  prop:true, serves:["energy"], seats:true, slots:5, serveMin:15, patience:3},
  lamp:      {label:"Lamp post",   one:"a lamp post",   glyph:"",  color:"#E3C04A", price:300,   upkeep:3,   w:1.2, d:1.2, prop:true, onPath:true},
  sign:      {label:"Info sign",   one:"an info sign",  glyph:"",  color:"#3B6FB6", price:250,   upkeep:1,   w:1.6, d:1,  prop:true, onPath:true},
  // hotels: guests stay the night and spend the next day in the park
  lodge:     {label:"Safari Lodge", one:"a safari lodge", glyph:"L", color:"#7B5B3A", price:30000, upkeep:200, tech:"hotels", w:18, d:14, serves:["sleep"], rooms:20, roomPrice:120, minRating:3, minGuests:300},
  resort:    {label:"Resort Hotel", one:"a resort hotel", glyph:"H", color:"#A0473F", price:120000, upkeep:900, tech:"hotels", w:30, d:20, serves:["sleep"], rooms:80, roomPrice:180, minRating:4, minGuests:700},
  campground:{label:"Campground",   one:"a campground",   glyph:"G", color:"#4F7A3A", price:8000, upkeep:70, tech:"hotels", w:16, d:12, serves:["sleep"], rooms:10, roomPrice:60, minRating:2, minGuests:100},
  // guests learn about prehistoric life here
  edcenter:  {label:"Education Center", one:"an Education Center", glyph:"E", color:"#2F7A5A", price:12000, upkeep:90, w:16, d:12, serves:["learn"], slots:16, serveMin:20, patience:40, minRating:2, tech:"education"},

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
  maxParties:1200,     // parties on the map at once; past this, newcomers join a party already there
  sizes:[1, 2, 2, 2, 3, 3, 4, 4],   // party sizes, picked at random
  stay:[180, 360],     // minutes a party plans to spend before heading home
  cash:[20, 45],       // money each guest brings to spend inside
  speed:[.85, 1.15],   // each party's own pace, times WALK_PER_MIN
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
  plush:   {label:"Dino plushes",  kind:"merch", good:"merch", price:14, cost:4,  joy:8},
  tshirt:  {label:"T-shirts",      kind:"merch", good:"merch", price:20, cost:6,  joy:6},
  toy:     {label:"Toy dinosaurs", kind:"merch", good:"merch", price:10, cost:3,  joy:7},
  map:     {label:"Park maps",     kind:"merch", good:"merch", price:3,  cost:.4, joy:2, text:"Guests with a map don't mind long walks."},
  guide:   {label:"Field guides",  kind:"merch", good:"merch", price:12, cost:3.5, joy:5},
};
// How guests take prices: at the usual price everyone buys, at double nobody does
const PRICE_SENSE = 1;     // share of buyers lost for each 100% over the usual price
// Litter lies on the paths in squares this many meters across
const LITTER = {
  cell:8,              // size of a litter square
  binReach:12,         // guests use a bin this close
  binCap:40,           // pieces a bin holds
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
  scared:     {text:"An animal got loose. We're getting out of here!"},
  pricey:     {text:"The ticket cost far too much."},
  noSeat:     {text:"My feet hurt and there's nowhere to sit."},
  litter:     {text:"There's trash all over the paths."},
  grossLoo:   {text:"The restrooms were disgusting."},
  priceyFood: {text:"The food here costs too much."},
  priceyGift: {text:"The souvenirs are overpriced."},
  rested:     {text:"It was nice to sit down for a bit.", good:true},
  soldOut:    {text:"They'd sold out of what I wanted."},
  graffiti:   {text:"Someone has spray-painted everything."},
  broken:     {text:"The benches here are all broken."},
  safe:       {text:"Seeing guards around made me feel safe.", good:true},
  noInfo:     {text:"I wish there were signs telling us about the animals."},
  priceyEdu:  {text:"The Education Center costs too much to get in."},
  learned:    {text:"I learned so much about prehistoric life!", good:true},
  wow:        {text:"The animals were amazing!", good:true},
  fed:        {text:"That hit the spot.", good:true},
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
  rowdyShare:.12,      // share of parties that are rowdy
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
// Guests learn about the animals from info signs, field guides, and the Education Center
const EDU = {
  see:2,               // learning from seeing an exhibit (0 to 100 per guest)
  sign:8,              // more if an info sign stands by its fence, plus a quarter more for each species inside
  signReach:20,        // a sign this close to an exhibit's fence tells guests about it
  guide:10,            // learning from buying a field guide
  guideBoost:1.5,      // and guests with one learn this much more at every exhibit after
  center:35,           // learning from a visit to the Education Center
  centerJoy:12,        // and the mood it adds
  centerAppeal:25,     // how keen guests are to visit it, next to an exhibit's appeal
  centerFee:5,         // usual entry price: everyone pays this, nobody pays double
  joy:.08,             // mood gained for each point learned
  litterCut:.4,        // at 100 learning, guests drop litter this much less
  vandalCut:.6,        // and vandalize this much less
  shopBoost:.3,        // and are this much keener in gift shops (double for plushes and field guides)
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
//   perSqM   cost to replant, per square meter (needs CERES for anything but Cenozoic)
//   tech     what ORACLE has to research first
const FLORA = {
  cenozoic:  {label:"Cenozoic",  plants:"grasses and flowering plants",              perSqM:0,   tech:null},
  mesozoic:  {label:"Mesozoic",  plants:"cycads, conifers, ginkgos, and ferns",      perSqM:1.5, tech:"mesoplant"},
  paleozoic: {label:"Paleozoic", plants:"lycopod trees, horsetails, and seed ferns", perSqM:1.5, tech:"paleoplant"},
};
// CERES makes Paleoflora food at a steady rate and keeps a stock of it
const PALEOFLORA = {
  perDay:60,          // units CERES grows each day on its own
  greenhouse:40,      // extra units per day from each greenhouse
  storeDays:2,        // CERES holds this many days of production
};
const FLORA_HAPPY = {home:6, away:-4};     // happiness for living among plants from the animal's own era, or another one
// Herbivores from these periods never evolved to eat grass, and get sick on it
const GRASS_INTOLERANT = ["Devonian", "Carboniferous", "Permian", "Triassic", "Jurassic"];
const GRASS_HIT = {intolerant:-15, cretaceous:-5};

BUILDINGS.ceres = {label:"CERES", tag:"CERES", one:"CERES", glyph:"C", color:"#4E7F2E", price:10000, upkeep:120, w:26, d:18, dept:true, unique:true,
                   full:"Cultivated Ecosystem Rations & Environmental Synthesis",
                   blurb:"The greenhouse lab. Grows Paleoflora food for prehistoric plant-eaters, planting stock for exhibits, and medicine for the PMC, once ORACLE has unlocked them and GHOST has found the plant DNA. Keepers collect Paleoflora here."};
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
// Units of guest goods a day each guest gets through, for ordering before there's a day of sales to go on
const GUEST_USE = {snacks:2.5, drinks:.8, merch:2};
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
                  store:{cap:600, holds:ORDER_GOODS, spoil:1, bulk:true, dock:true},
                  full:"Supplier deliveries", blurb:"Order animal food and stock for your stands and shops overnight. Trucks need a service road to the entrance. Keepers and custodians carry it from here."};
// Hotels keep toiletries, which custodians bring from the dock or a warehouse
for(const t of ["campground", "lodge", "resort"]) BUILDINGS[t].store = {cap:BUILDINGS[t].rooms * LODGING.toiletries * 2, holds:["merch"], spoil:1, vendor:true};
// Food stands and gift shops keep their own stock
for(const [t, cap] of Object.entries({kiosk:60, food:150, restaurant:400, cart:60, shop:200, megastore:500}))
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
  {id:"electric", group:"barrier", label:"Electrified fence", points:30, text:"Strength 65 while powered. Holds most herbivores and smaller predators. Needs generators."},
  {id:"concrete", group:"barrier", label:"Concrete walls",    points:35, text:"Strength 140. Holds anything, but guests can barely see in."},
  {id:"acrylic",  group:"barrier", label:"Acrylic walls",     points:50, text:"Strength 85. Clear walls that guests love looking through."},
  {id:"aviary",   group:"barrier", label:"Aviary netting",    points:45, text:"Carbon fiber and steel mesh over an exhibit, so flying animals can't escape."},
  {id:"moat",     group:"barrier", label:"Moats",             points:60, text:"Stops every escape from an exhibit, whatever its walls."},
  {id:"platform", group:"barrier", label:"Viewing platforms", points:40, text:"Raised decks on an exhibit's edge. Guests enjoy the exhibit far more."},
  {id:"education", group:"build", label:"Education programs", points:25, text:"Build an Education Center, where guests learn about prehistoric life. Educated guests are happier, tidier, and more generous."},
  {id:"hotels",  group:"build", label:"Hotels",           points:35, text:"Build campgrounds, safari lodges, and resort hotels. Guests stay the night and spend the next day in the park."},
  {id:"coldstore", group:"build", label:"Cold stores",      points:25, text:"Refrigerated stores that keep meat, fish, medicine, and snacks from rotting. Needs power."},
  {id:"security", group:"build", label:"Security offices",  points:25, text:"Build a Security Office and hire guards to patrol, deter vandals, and steer guests out during escapes."},
  {id:"generator", group:"build", label:"Power generators", points:30, text:"Diesel generators that power electrified fences and cold stores."},
  {id:"cameras",  group:"build", label:"Security cameras",  points:30, text:"Each Security Office watches the paths around it. Guards are sent straight to vandals the cameras see."},
  {id:"vehicles",   group:"build", label:"Staff vehicles",   points:50, text:"Vehicle depots with ATVs. Staff drive five times faster, but only on service roads."},
  {id:"foodprod",  group:"build", label:"Food production",  points:30, text:"Build farms, ranches, hatcheries, and insectaries to make animal food. Cheaper than the dock, but it spoils if nobody collects it."},
  // TAR upgrades
  {id:"incub1",   group:"tar", label:"More incubators",     points:30, text:"Every geneticist runs 2 incubators instead of 1."},
  {id:"incub2",   group:"tar", label:"Even more incubators", points:50, needs:"incub1", text:"Every geneticist runs 3 incubators."},
  {id:"fast1",    group:"tar", label:"Faster incubators",   points:30, text:"Clones finish in three quarters of the time."},
  {id:"fast2",    group:"tar", label:"Much faster incubators", points:50, needs:"fast1", text:"Clones finish in about half the time."},
  // Paleo-Flora: plants and medicine, grown at CERES
  {id:"paleoflora", group:"flora", label:"Paleoflora cultivation", points:40, text:"CERES starts growing Paleoflora, the food prehistoric plant-eaters need instead of grass. It needs plant DNA from GHOST first."},
  {id:"mesoplant",  group:"flora", era:"mesozoic",  label:"Mesozoic flora",  points:35, needs:"paleoflora", text:"Cycads, conifers, ginkgos, and ferns. GHOST collects their DNA, then CERES grows planting stock for exhibits."},
  {id:"paleoplant", group:"flora", era:"paleozoic", label:"Paleozoic flora", points:45, needs:"paleoflora", text:"Lycopod trees, horsetails, and seed ferns. GHOST collects their DNA, then CERES grows planting stock for exhibits."},
  {id:"greenhouse", group:"flora", label:"Greenhouses",      points:30, needs:"paleoflora", text:"Build greenhouses near CERES to grow Paleoflora faster."},
  {id:"medceno",    group:"med", era:"cenozoic",  label:"Cenozoic medicine",  points:25, text:"CERES grows medicine for Paleogene, Neogene, and Quaternary animals. Refine it for each period to cure them fully."},
  {id:"medmeso",    group:"med", era:"mesozoic",  label:"Mesozoic medicine",  points:35, text:"CERES grows medicine for Triassic, Jurassic, and Cretaceous animals. Needs Mesozoic plant DNA. Refine it for each period to cure them fully."},
  {id:"medpaleo",   group:"med", era:"paleozoic", label:"Paleozoic medicine", points:40, text:"CERES grows medicine for Devonian, Carboniferous and Permian animals. Needs Paleozoic plant DNA. Refine it for each period to cure them fully."},
];
// Refining an era's medicine for one period: a cure for that period's animals. Costs by era.
const REFINE_POINTS = {cenozoic:6, mesozoic:9, paleozoic:12};
const MOAT_PER_METER = 150;
const AVIARY_PER_SQM = 4;

// Flying animals. Outside an aviary or vivarium they escape almost at once.
const FLYERS = ["quet", "pter", "dimo", "mega", "arch", "micr", "yiqi", "arge"];

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
  grassSick:2,         // old plant-eaters eating grass get sick this much more
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

// Landscaping: ponds and rocks placed inside an open exhibit (e.land). Animals feel at home among what they like.
//   r      radius in meters
//   water  counts toward the exhibit's water
//   cover  rock cover it adds (see HAB.rockEvery)
//   flora  a grove of plants from this era (see FLORA). Animals from that era feel at home in it and browse it.
//   tech   research needed first
//   stock  batches of CERES planting stock it uses up
//   browse food units a day the animals nibble off it (Paleoflora for older groves, plants for Cenozoic trees)
const LAND = {
  pond:   {label:"Pond",          one:"a pond",          price:3000, r:6, color:"#3A7FB2", water:true},
  rock:   {label:"Rock pile",     one:"a rock pile",     price:600,  r:2, color:"#8E9188", cover:1},
  boulder:{label:"Boulder field", one:"a boulder field", price:2200, r:4, color:"#767A74", cover:3},
  trees:  {label:"Tree grove",    one:"a tree grove",    price:1200, r:5, color:"#5E9B4A", flora:"cenozoic", browse:4},
  cycads: {label:"Cycad grove",   one:"a cycad grove",   price:1500, r:5, color:"#3F7D3A", flora:"mesozoic",  tech:"mesoplant",  stock:1, browse:4},
  lycopods:{label:"Lycopod stand", one:"a lycopod stand", price:1800, r:5, color:"#2E6B55", flora:"paleozoic", tech:"paleoplant", stock:1, browse:4},
  shelter:{label:"Shelter",       one:"a shelter",       price:2500, r:4, color:"#9A7B55", slots:10},
  barn:   {label:"Large shelter", one:"a large shelter", price:7000, r:7, color:"#7E6142", slots:36},
};
// Groves give shade too: this many shelter slots each, scaled by how much the weather lets trees help (WEATHER grove)
for(const t of Object.values(LAND)) if(t.flora) t.shade = 8;
const HAB = {
  waterFull:.03,   // share of the exhibit's floor in ponds that fully satisfies water lovers
  rockEvery:500,   // square meters of exhibit that one point of rock cover looks after
  bonus:8,         // happiness an exhibit with everything its animals like gains
  wantsWater:.8,   // a species this keen on water is unhappy and sickly without a pond
  dry:8,           // happiness lost when water lovers have no pond
  dryIll:1.5,      // illness chance multiplier for them
  groveFull:.06,   // share of the floor in groves from an animal's own era that fully satisfies it
  groveBonus:6,    // happiness for animals with plenty of groves from their era
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
  startDay:4,       // new parks get fair weather until this day
  kinds:{
    fair: {label:"Fair",      odds:.55, happy:0,  ill:0,   hurt:0,   wear:1,   guests:1,   grove:0},
    hot:  {label:"Heat wave", odds:.17, happy:10, ill:.8,  hurt:0,   wear:1,   guests:.85, grove:1},
    cold: {label:"Cold snap", odds:.15, happy:12, ill:1.5, hurt:0,   wear:1,   guests:.8,  grove:0},
    storm:{label:"Storm",     odds:.13, happy:15, ill:.6,  hurt:.03, wear:2.5, guests:.55, grove:.5},
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

// Service roads are for staff. Guests don't walk on them, but they connect backstage buildings.
const SERVICE_ROAD = {perMeter:10, upkeepPerMeter:0.1, halfWidth:1.5};

// Goals give new players something to aim for, and pay a reward.
// Each check() looks at the park and returns true when the goal is met.
const GOALS = [
  {id:"exhibit",  text:"Draw your first exhibit",            hint:"Open Build, then Exhibit Tools, pick a fence type, then tap corners on the map. Tap the first corner again to close it.", reward:2000,  check:g=>g.state.exhibits.length>0},
  {id:"connect",  text:"Connect an exhibit to the path",     hint:"Guests only see exhibits that touch a path from the entrance. Use Guest Paths under Path Tools to reach it.", reward:2000,  check:g=>g.state.exhibits.some(e=>g.isReachable(e))},
  {id:"animals",  text:"Buy animals for an exhibit",         hint:"Tap an exhibit, then buy starter animals from partner parks in the side panel.", reward:3000,  check:g=>g.state.exhibits.some(e=>e.animals.length>0)},
  {id:"food",     text:"Build a food stand",                 hint:"Pick Food and tap next to a path, then tap the stand and choose what it sells. Hungry guests rate the park lower.", reward:2000,  check:g=>g.state.buildings.some(b=>BUILDINGS[b.type].kind==="food" && (b.menu||[]).length)},
  {id:"restroom", text:"Build restrooms",                    hint:"Guests need restrooms too. Place them next to a path.", reward:2000,  check:g=>g.state.buildings.some(b=>b.type==="restroom")},
  {id:"keeper",   text:"Hire a keeper",                      hint:"Partner parks feed your animals until day 5. Before then, build a Keeper Station beside a path or service road, tap it, and hire a keeper.", reward:3000, check:g=>g.state.staff.keepers.length>0},
  {id:"dock",     text:"Build a Delivery Dock",              hint:"Animal food has to be bought now. Build a Delivery Dock beside a service road. It orders overnight, custodians stock a station from it, and keepers carry the food out to the exhibits. Partner parks cover the first deliveries.", reward:2500, check:g=>g.state.buildings.some(b=>b.type==="dock")},
  {id:"custodian",text:"Hire a custodian",                   hint:"Stands and shops sell from their own stock, and someone has to carry it from the dock. Build a Custodial Closet beside a path or service road and hire a custodian. They also clean restrooms and sweep litter.", reward:3000, check:g=>(g.state.staff.custodians || []).length>0},
  {id:"guard",    text:"Hire a security guard",              hint:"Unhappy, rowdy guests break benches and spray graffiti. Research Security offices at ORACLE, build one beside a path, and hire a guard to patrol. Lamp posts help too.", reward:3000, check:g=>(g.state.staff.guards || []).length>0},
  {id:"gate",     text:"Give an exhibit a keeper gate",      hint:"Run a service road to an exhibit's fence, then use Gates under Exhibit Tools on that fence. Keepers won't use a gate that opens onto a guest path.", reward:3000, check:g=>g.state.exhibits.some(e=>!e.viv && e.gate && gateCheck(e).ok)},
  {id:"mechanic", text:"Hire a mechanic",                    hint:"Fences wear down, and predators attack them. Build a Workshop beside a path or service road and hire a mechanic to inspect and repair them.", reward:3000, check:g=>(g.state.staff.mechanics || []).length>0},
  {id:"vet",      text:"Hire a vet",                         hint:"Animals get sick, and some get hurt fighting. Build a Paleo-Medicine Center beside a path or service road and hire a vet. Vets also dart escaped animals.", reward:14000, check:g=>(g.state.staff.vets || []).length>0},
  {id:"zone",     text:"Draw a work zone",                   hint:"Zones split the park into areas with their own keepers and stores. Pick the Zone tool, draw around some exhibits and a station, then assign keepers to it from its panel.", reward:3000, check:g=>(g.state.zones||[]).length>0},
  {id:"g100",    text:"Get 100 guests in one day",          hint:"More animals and happier animals bring more guests.", reward:5000,  check:g=>g.state.history.some(h=>h.guests>=100)},
  {id:"oracle",   text:"Build ORACLE",                       hint:"Every other animal comes from the past. ORACLE researches time periods. Place it beside a path or service road.", reward:20000, check:g=>g.state.buildings.some(b=>b.type==="oracle")},
  {id:"period",   text:"Unlock an animal's genome",           hint:"Tap ORACLE and hire a paleontologist. They earn research points as the day goes on. Open a period's tab and start unlocking an animal. It takes a while.", reward:10000, check:g=>g.state.science.unlocked.length>0},
  {id:"ghost",    text:"Build GHOST and send an expedition", hint:"GHOST travels to the periods of animals you've unlocked. Hire a Temporal Researcher at GHOST, then pick the animal under its period's tab and send GHOST.", reward:30000, check:g=>Object.keys(g.state.science.dna).length>0},
  {id:"genome",   text:"Complete a genome",                  hint:"Each sample fills part of a genome. Keep sending trips for the same species until it reaches 100%.", reward:10000, check:g=>Object.values(g.state.science.dna).some(d=>d.genome>=100)},
  {id:"clone",    text:"Build TAR and clone an animal",      hint:"TAR turns a complete genome into an animal. Hire a Geneticist at TAR, then order clones from TAR or from an exhibit's panel.", reward:22000, check:g=>g.state.exhibits.some(e=>e.animals.some(a=>a.cl))},
  {id:"ceres",    text:"Build CERES",                       hint:"Medicine for prehistoric animals is grown at CERES, once ORACLE has researched it. Place it beside a path or service road and hire a botanist.", reward:20000, check:g=>g.state.buildings.some(b=>b.type==="ceres")},
  {id:"sp4",      text:"Show 4 different species",           hint:"Variety raises your rating. Herbivores can share an exhibit.", reward:8000,  check:g=>g.speciesShown()>=4},
  {id:"star3",    text:"Reach a 3-star rating",              hint:"Keep animals happy, give guests food and restrooms, and add variety.", reward:15000, check:g=>g.state.rating>=3},
  {id:"cash150",  text:"Have $250,000 in the bank",          hint:"Earn more than you spend. Check the day report after closing.", reward:10000, check:g=>g.state.money>=250000},
  {id:"trex",     text:"Bring in a Tyrannosaurus rex",       hint:"Unlock the Tyrannosaurus at ORACLE, collect a full T. rex genome with GHOST, and reach 4.5 stars. It needs a lot of room.", reward:25000, check:g=>g.state.exhibits.some(e=>e.animals.some(a=>a.sp==="trex"))},
  {id:"hotel",    text:"Build a hotel",                      hint:"Research Hotels at ORACLE. Once your park has 3 stars and 300 guests a day, build a Safari Lodge beside a path. Guests stay the night and spend tomorrow in the park.", reward:10000, check:g=>g.state.buildings.some(b=>BUILDINGS[b.type].rooms)},
];
