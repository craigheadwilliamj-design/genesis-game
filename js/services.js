/* =====================================================================
   GUEST SERVICES
   What food stands and gift shops sell (each one is an empty shell until
   you give it a menu), benches and picnic areas, trash bins and litter,
   restroom dirt, and the night cleaning crew who tidy up after closing.
   ===================================================================== */

let litterPts = new Map();   // litter square -> spots along the footpaths inside it, for drawing specks
let binSpots = [];           // bins guests can reach, with where they stand: [{b, x, y}]

const isVendor = b => !!BUILDINGS[b.type].kind;
const menuOf = b => b.menu || [];
const menuItem = (b, id) => menuOf(b).find(m => m.id === id) || null;

// Is there stock for n of this item? Before stock is physical, suppliers keep every shelf full.

const inStock = (b, id, n = 1) => guestGoodsFree() || stockOf(b, MENU[id].good) >= MENU[id].cost * n;
const onSale = b => menuOf(b).filter(m => inStock(b, m.id));

// The needs a building takes care of. A stand's come from what it has in stock; a gift shop with anything to sell serves shoppers.
function servesOf(b){
  const t = BUILDINGS[b.type];
  if(isBroken(b)) return [];
  if(!t.kind) return t.serves || [];
  const out = new Set();
  if(t.kind === "merch"){ if(onSale(b).length) out.add("shop"); }
  else for(const m of onSale(b)) for(const k of Object.keys(MENU[m.id].fills || {})) out.add(k);
  if(t.seats) out.add("energy");
  return [...out];
}

/* ---------- menus ---------- */

// The menu a stand or shop from before menus existed gets
const OLD_MENUS = {food:["burger", "soda"], shop:["plush", "tshirt", "map"]};
function addToMenu(b, id){
  const t = BUILDINGS[b.type], m = MENU[id];
  if(!t.kind || !m || m.kind !== t.kind || (m.only && m.only !== b.type)) return "That isn't sold here.";
  if(menuItem(b, id)) return "It's already on the menu.";
  if(menuOf(b).length >= t.menuSlots) return `${t.label}s have room for ${t.menuSlots} item${t.menuSlots === 1 ? "" : "s"}. Take one off first.`;
  b.menu = menuOf(b).concat([{id, price:m.price}]);
  return null;
}
function dropFromMenu(b, id){ b.menu = menuOf(b).filter(m => m.id !== id); }
function setMenuPrice(b, id, price){ const m = menuItem(b, id); if(m) m.price = clamp(Math.round(price), 1, MENU[id].price * 4); }
// Share of guests who'll pay this price: everyone at the usual price or less, nobody at double
// (a party can be touchier about price: family parties are)
const willPay = (id, price, p) => clamp(1 - PRICE_SENSE * (p ? pm(p, "price") : 1) * (price - MENU[id].price) / MENU[id].price, 0, 1);

/* ---------- being served ---------- */

// A party gets to the front of the line. Returns what it spent.
function serveAt(p, b, why){
  const t = BUILDINGS[b.type], n = p.n;
  let bill = 0, served = n, short = false;
  if((b.graffiti || 0) >= VANDAL.grossAt){ thinks(p, "graffiti"); p.mood -= 4 * pm(p, "broken"); }
  if(t.kind === "food"){
    // each need that's bad enough gets the best thing on the menu for it, if the price is right
    for(const need of ["hunger", "thirst", "energy"]){
      if(p.needs[need] < 25 && need !== why) continue;
      let best = null, gone = false;
      for(const m of menuOf(b)){
        const f = (MENU[m.id].fills || {})[need]; if(!f) continue;
        if(!inStock(b, m.id, n)){ gone = true; continue; }
        const score = f * willPay(m.id, m.price, p);
        if(!best || score > best.score) best = {m, f, score, will:willPay(m.id, m.price, p)};
      }
      if(!best){ if(gone && need === why) thinks(p, "soldOut"); continue; }
      if(best.will < .6) thinks(p, "priceyFood");
      if(Math.random() > Math.min(1, best.will * pm(p, "food"))) continue;
      if(p.cash - bill < best.m.price * n){ short = true; continue; }
      buy(p, b, best.m, n); bill += best.m.price * n;
    }
    if(bill && !p.needs.hunger) thinks(p, "fed");
    if(!bill && short){ thinks(p, "broke"); p.mood -= 6; p.cool.hunger = p.cool.thirst = state.minute + 120; }
    served = bill ? n : 0;
  } else if(t.kind === "merch"){
    // each guest might pick something: happier guests buy more
    served = 0;
    // and guests who've learned about the animals want something to remember them by
    const keen = clamp((p.mood - 30) / 60, .15, .9), edu = (p.edu || 0) / 100;
    for(let i = 0; i < n; i++){
      const menu = onSale(b); if(!menu.length){ if(!served) thinks(p, "soldOut"); break; }
      const m = menu[Math.floor(Math.random() * menu.length)], will = willPay(m.id, m.price, p);
      const boost = (1 + EDU.shopBoost * edu * (["guide", "plush", "paleobook"].includes(m.id) ? 2 : 1)) * (m.id === "umbrella" && weatherNow().wet ? WEATHER.umbrella : 1);
      if(will < .6) thinks(p, "priceyGift");
      if(Math.random() < Math.min(.95, keen * boost * pm(p, "shop")) * will && p.cash - bill >= m.price){ buy(p, b, m, 1); bill += m.price; served++; }
    }
  } else if(b.type === "edcenter"){
    // the entry fee, if there is one: too steep and they turn around
    const fee = b.fee || 0, will = clamp((1 - PRICE_SENSE * (fee - EDU.centerFee) / EDU.centerFee) * pm(p, "museum"), 0, 1);
    served = 0; p.learnt = true;
    if(fee && Math.random() > will){ thinks(p, "priceyEdu"); p.mood -= 3; }
    else if(p.cash < fee * n) thinks(p, "broke");
    else {
      if(fee){ p.cash -= fee * n; earn(fee * n, "edfees"); bill = fee * n; }
      // they sit through a talk and use the restrooms while they're in there
      learn(p, EDU.center + eduLearn(b)); p.mood += EDU.centerJoy + eduJoy(b);
      const fx = EDU_FOCUS[b.focus];
      if(fx && fx.donate) earn(n * fx.donate * focusPower(b), "donations");
      if(fx && fx.science && dept("oracle")) state.science.points += n * fx.science * focusPower(b); p.needs.energy = 0; p.needs.bladder = 0; served = n;
    }
  } else if(b.type === "restroom"){
    p.needs.bladder = 0;
    if((b.dirt || 0) >= RESTROOM.gross){ thinks(p, "grossLoo"); p.mood -= 6 * pm(p, "toilet"); }
    b.dirt = Math.min(100, (b.dirt || 0) + RESTROOM.dirtPerGuest * n);
  }
  if(t.seats && (why === "energy" || t.kind)){ p.needs.energy = 0; if(why === "energy") thinks(p, "rested"); }

  if(!b.served || b.served.day !== state.day) b.served = {day:state.day, n:0, money:0, items:{}};
  b.served.n += served; if(b.type === "edcenter") b.served.money += bill;
  return bill;
}
// Hand over one item to each of n guests: they pay, it comes off the shelf, and they may be left holding a wrapper.
// While suppliers still deliver straight to the stand, an empty shelf just costs the item's price to stock.
function buy(p, b, m, n){
  const it = MENU[m.id], units = it.cost * n;
  p.cash -= m.price * n;
  earn(m.price * n, it.kind === "food" ? "food" : "shop");
  if(stockOf(b, it.good) >= units) takeGood(b, it.good, units); else spend(units, "supplies");
  state.logi.used[it.good] = (state.logi.used[it.good] || 0) + units;
  for(const [k, v] of Object.entries(it.fills || {})) p.needs[k] = Math.max(0, p.needs[k] - v);
  if(it.joy) p.mood += it.joy;
  if(m.id === "map") p.map = true;
  if(m.id === "guide"){ if(!p.guide) learn(p, EDU.guide); p.guide = true; }
  if(m.id === "paleobook"){ if(!p.guide) learn(p, EDU.book); p.guide = true; }
  if(it.litter){ p.trash = (p.trash || 0) + n; p.trashAt = state.minute; }
  if(it.kind === "food") state.today.servedFood += n; else state.today.servedShop += n;
  if(!b.served || b.served.day !== state.day) b.served = {day:state.day, n:0, money:0, items:{}};
  b.served.money += m.price * n;
  b.served.items[m.id] = (b.served.items[m.id] || 0) + n;
}

/* ---------- litter and bins ---------- */

const litterKey = (x, y) => Math.floor(x / LITTER.cell) + ":" + Math.floor(y / LITTER.cell);
const litterAt = (x, y) => state.litter[litterKey(x, y)] || 0;
function addLitter(x, y, n){ const k = litterKey(x, y); state.litter[k] = (state.litter[k] || 0) + n; }
// The nearest working bin with room left. Guests walk past a full one and keep looking.
function nearBin(x, y){
  let best = null, bd = LITTER.binReach;
  for(const s of binSpots){ if(isBroken(s.b) || (s.b.fill || 0) >= LITTER.binCap) continue; const d = Math.hypot(s.x - x, s.y - y); if(d < bd){ bd = d; best = s.b; } }
  return best;
}
// At each corner a party holding trash looks for a bin. After a while some give up and drop it.
function trashCheck(p){
  if(!p.trash || !p.at) return;
  const b = nearBin(p.at.x, p.at.y);
  if(b){
    const room = Math.max(0, LITTER.binCap - (b.fill || 0)), put = Math.min(room, p.trash);
    b.fill = (b.fill || 0) + put;
    // whatever doesn't fit in a nearly full bin spills beside it
    if(p.trash > put){ const [bx, by] = centroid(b.points); addLitter(bx, by, p.trash - put); }
    p.trash = 0; return;
  }
  if(state.minute - p.trashAt < LITTER.holdMin) return;
  if(Math.random() < (LITTER.drop + LITTER.dirtyDrop * litterAt(p.at.x, p.at.y)) * (1 - EDU.litterCut * (p.edu || 0) / 100) * pm(p, "litter")){ addLitter(p.at.x, p.at.y, p.trash); p.trash = 0; }
  else p.trashAt = state.minute;
}
// Where along the footpaths each litter square's specks go. Called when the guest map is rebuilt.
function indexLitterSpots(nodes){
  binSpots = state.buildings.filter(b => b.type === "bin" && isReachable(b)).map(b => { const [x, y] = centroid(b.points); return {b, x, y}; });
  litterPts = new Map();
  for(const n of nodes.values()) for(const m of n.adj.keys()){
    if(m.k < n.k || (n.ride && n.ride.has(m))) continue;   // no litter on the tram track
    const L = Math.hypot(m.x - n.x, m.y - n.y);
    for(let s = 1; s < L; s += 1.5){
      const x = n.x + (m.x - n.x) * s / L, y = n.y + (m.y - n.y) * s / L, k = litterKey(x, y);
      if(!litterPts.has(k)) litterPts.set(k, []);
      litterPts.get(k).push([x, y, (m.y - n.y) / L, -(m.x - n.x) / L]);
    }
  }
}
// Specks to draw: a few spots in each square with litter, picked the same way every time so they don't jump around
function litterSpecks(){
  const out = [];
  for(const [k, n] of Object.entries(state.litter)){
    const pts = litterPts.get(k); if(!pts || n < 1) continue;
    let h = 0; for(const c of k) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    for(let i = 0; i < Math.min(14, Math.ceil(n)); i++){
      h = (h * 1103515245 + 12345) >>> 0;
      const [x, y, nx, ny] = pts[h % pts.length], side = ((h >> 8) % 300) / 100 - 1.5;
      out.push([x + nx * side, y + ny * side, h % 3]);
    }
  }
  return out;
}
const litterTotal = () => Object.values(state.litter).reduce((s, n) => s + n, 0);

/* ---------- the night cleaning crew ---------- */

// What tonight's cleaning will cost: litter on the paths, full bins, and dirty restrooms
function cleaningBill(){
  let bill = litterTotal() * LITTER.nightCost;
  for(const b of state.buildings){
    if(b.type === "bin") bill += (b.fill || 0) * LITTER.binNightCost;
    if(b.type === "restroom") bill += (b.dirt || 0) * RESTROOM.nightCost;
  }
  return Math.round(bill);
}
// After closing, contract cleaners pick up the litter, empty the bins, and scrub the restrooms
function servicesNight(){
  const bill = cleaningBill();
  if(bill) spend(bill, "cleaning");
  state.litter = {};
  for(const b of state.buildings){ if(b.type === "bin") b.fill = 0; if(b.type === "restroom") b.dirt = 0; }
}

/* ---------- Museum attractions in the Education Center ---------- */

// Each one is an event GHOST has fully recorded (MUSEUM_EVENTS). b.shows lists the ids on show.
const showsOf = b => (b.shows || []).filter(id => MUSEUM_BY_ID[id]);
// A better record makes a better show
const showPower = id => { const d = state.science.dna[id]; return MUSEUM.minQuality + (1 - MUSEUM.minQuality) * clamp((d ? d.quality : 0) / 100, 0, 1); };
const showsLearn = b => showsOf(b).reduce((n, id) => n + MUSEUM_BY_ID[id].learn * showPower(id), 0);
const showsJoy = b => showsOf(b).reduce((n, id) => n + MUSEUM_BY_ID[id].joy * showPower(id), 0);
const showsAppeal = b => showsOf(b).reduce((n, id) => n + MUSEUM_BY_ID[id].appeal, 0);
const showsUpkeep = b => b.type === "edcenter" ? showsOf(b).reduce((n, id) => n + MUSEUM_BY_ID[id].upkeep, 0) : 0;
// Events GHOST has finished recording that this center isn't showing yet
const showsReady = b => MUSEUM_EVENTS.filter(ev => genomeDone(ev.id) && !showsOf(b).includes(ev.id));
function showProblem(b, id){
  const ev = MUSEUM_BY_ID[id];
  return !ev || !genomeDone(id) ? "GHOST hasn't finished recording that yet."
    : showsOf(b).includes(id) ? "It's already on show here."
    : showsOf(b).length >= MUSEUM.slots ? `An Education Center has room for ${MUSEUM.slots} attractions. Take one down first.`
    : !canAfford(ev.price) ? `Installing it costs ${money(ev.price)}. You have ${money(state.money)}.` : null;
}
function addShow(b, id){
  const why = showProblem(b, id); if(why) return why;
  spend(MUSEUM_BY_ID[id].price, "built"); (b.shows || (b.shows = [])).push(id);
  return null;
}
function dropShow(b, id){ b.shows = (b.shows || []).filter(x => x !== id); }

/* ---------- Education Center focus and modules ---------- */

const modsOf = b => (b.mods || []).filter(id => EDU_MODULES[id]);
const focusOf = b => EDU_FOCUS[b.focus] ? b.focus : null;
// How strongly the center's focus works: 1 plus each module's boost to it (0 with no focus)
const focusPower = b => { const f = focusOf(b); return f ? 1 + modsOf(b).reduce((n, id) => n + (EDU_MODULES[id].boost[f] || 0) * modLive(id), 0) : 0; };
const focusFx = (b, k) => focusOf(b) ? (EDU_FOCUS[b.focus][k] || 0) * focusPower(b) : 0;
// How busy the thing a live module shows is: 1 for an ordinary module. Labs count the science departments with work in them; the nursery, clones growing, and a hatching today.
function modLive(id){
  const m = EDU_MODULES[id], sc = state.science; if(!m.live) return 1;
  if(m.live === "lab"){
    const busy = [dept("oracle") && sc.projects.length, dept("ghost") && sc.trips.length, dept("tar") && sc.clones.length, dept("ceres") && state.ceres.beds.length].filter(Boolean).length;
    return EDU_LIVE.idle + (1 - EDU_LIVE.idle) * busy / 4;
  }
  if(m.live === "botany"){
    // plant DNA CERES has finished (6 periods, 4 is plenty), and beds growing now
    const dna = Object.values(PLANT_DNA).filter(f => genomeDone(f.id)).length;
    return dept("ceres") ? EDU_LIVE.idle + (1 - EDU_LIVE.idle) * (.7 * Math.min(1, dna / 4) + (state.ceres.beds.length ? .3 : 0)) : 0;
  }
  if(m.live === "biomes"){
    // different habitats with animals living in them
    const n = new Set(state.exhibits.filter(e => !e.viv && e.animals.length).map(biomeOf)).size;
    return EDU_LIVE.idle + (1 - EDU_LIVE.idle) * Math.min(1, n / EDU_LIVE.biomes);
  }
  if(m.live === "touch"){
    // animal genomes GHOST has finished: more to hold
    const n = SPECIES.filter(s => genomeDone(s.id)).length;
    return EDU_LIVE.idle + (1 - EDU_LIVE.idle) * Math.min(1, n / EDU_LIVE.genomes);
  }
  if(m.live === "sim"){
    // one place to visit for each finished event record
    const places = MUSEUM_EVENTS.filter(ev => genomeDone(ev.id)).length;
    return dept("ghost") ? EDU_LIVE.simIdle + (1 - EDU_LIVE.simIdle) * Math.min(1, places / EDU_LIVE.simPlaces) : 0;
  }
  if(!dept("tar")) return 0;
  return Math.min(EDU_LIVE.cap, EDU_LIVE.nurseryIdle + (1 - EDU_LIVE.nurseryIdle) * Math.min(1, sc.clones.length / 2) + (sc.hatchDay === state.day ? EDU_LIVE.hatchBonus : 0));
}
const modLearn = id => { const m = EDU_MODULES[id]; return m.learn * modLive(id) * (m.perSpecies ? clamp(.4 + state.science.unlocked.length / 15, .4, 1.4) : 1); };
const slotsOf = b => BUILDINGS[b.type].slots + (b.type === "edcenter" ? modsOf(b).reduce((n, id) => n + (EDU_MODULES[id].slots || 0), 0) : 0);
// Everything a center adds to one visit: museum attractions, modules, and the focus
const eduLearn = b => showsLearn(b) + modsOf(b).reduce((n, id) => n + modLearn(id), 0) + focusFx(b, "learn");
const eduJoy = b => showsJoy(b) + modsOf(b).reduce((n, id) => n + (EDU_MODULES[id].joy || 0) * modLive(id), 0) + focusFx(b, "joy");
const eduAppeal = b => showsAppeal(b) + modsOf(b).reduce((n, id) => n + (EDU_MODULES[id].appeal || 0) * modLive(id), 0) + focusFx(b, "appeal");
const eduUpkeep = b => showsUpkeep(b) + (b.type === "edcenter" ? modsOf(b).reduce((n, id) => n + EDU_MODULES[id].upkeep, 0) : 0);
const modsReady = b => Object.keys(EDU_MODULES).filter(id => hasTech(EDU_MODULES[id].tech) && !modsOf(b).includes(id));
function modProblem(b, id){
  const m = EDU_MODULES[id];
  return !m ? "No such module." : !hasTech(m.tech) ? "Research it at ORACLE first."
    : m.dept && !m.dept.some(hasDept) ? `Build ${m.dept.length > 1 ? "a science building" : "TAR"} first.`
    : modsOf(b).includes(id) ? "It's already installed."
    : modsOf(b).length >= EDU_CENTER.moduleSlots ? `An Education Center has room for ${EDU_CENTER.moduleSlots} modules. Remove one first.`
    : !canAfford(m.price) ? `Installing it costs ${money(m.price)}. You have ${money(state.money)}.` : null;
}
function addMod(b, id){ const why = modProblem(b, id); if(why) return why; spend(EDU_MODULES[id].price, "built"); (b.mods || (b.mods = [])).push(id); return null; }
function dropMod(b, id){ b.mods = (b.mods || []).filter(x => x !== id); }
