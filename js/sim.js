/* =====================================================================
   SIMULATION
   The rules of the game: time passing, guests arriving and spending,
   animal happiness, daily costs, star rating, and goals.
   Nothing in this file draws anything on screen.
   ===================================================================== */

const SPECIES_BY_ID = Object.fromEntries(SPECIES.map(s => [s.id, s]));
const uid = p => p + Math.random().toString(36).slice(2, 9);

let state = null;     // the saved game
let derived = null;   // numbers worked out from the saved game, rebuilt when it changes
let inPark = [];      // departure time (in park minutes) for each guest in the park right now
let arrivalCarry = 0; // fractions of a guest carried between frames

// Hooks other files fill in, so the simulation can tell the screen what happened
const events = { guestArrived(){}, guestLeft(){}, toast(){}, dayEnded(){}, changed(){}, gameOver(){} };

// Starter species partner parks sell in this park: random picks from each pool
function pickStarters(){
  const out = [];
  for(const {pick, ids} of Object.values(STARTER_POOLS)){
    const pool = ids.slice();
    for(let i = 0; i < pick && pool.length; i++) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return out;
}
const isStarter = s => !!(state && state.starters && state.starters.includes(s.id));
function freshLedger(){ return {guests:0, tickets:0, food:0, shop:0, feed:0, wages:0, upkeep:0, built:0, animals:0, science:0, sold:0, rewards:0, fines:0, repairs:0, servedFood:0, servedShop:0}; }

function freshScience(){
  return {
    points:0,          // unspent ORACLE research points
    crew:{paleo:0, temporal:0, gene:0},  // science staff hired at each department
    tech:[],           // barriers and facilities ORACLE has researched
    unlocked:[],       // time periods GHOST can travel to
    dna:{},            // species id -> {genome: 0-100, quality: 0-100}
    trips:[],          // expeditions in the field: {period, sp, back: day it returns}
    clones:[],         // TAR's incubators: {id, sp, exhibitId, q, lane, done: day it's ready}
    ready:[],          // finished clones waiting for an exhibit: {id, sp, q}
    log:[]             // recent expedition results, newest first
  };
}

function newPark(){
  return {
    version:1, name:"Genesis Park",
    money:START.money, ticket:START.ticket, rating:START.rating,
    day:1, minute:OPEN_MIN,
    boundary:[[0,18],[150,0],[410,8],[420,300],[-6,306]],
    gate:[205,303],
    exhibits:[],
    paths:[{id:"p-main", name:"Main walk", points:[[205,303],[205,235]], fixed:true}],
    buildings:[],
    science:freshScience(), staff:freshStaff(), safety:freshSafety(), ceres:{stock:0, meds:0}, health:freshHealth(), zones:[], logi:freshLogi(), starters:pickStarters(),
    today:freshLedger(), history:[], goalsDone:[], over:false
  };
}

// Bring older saves up to date with anything added since
function upgradeSave(s){
  // parks from before keepers existed get 3 days of free feeding to build backstage
  if(!s.staff){ s.staff = freshStaff(); s.staff.feedFrom = Math.max(5, s.day + 3); }
  if(!s.science) s.science = freshScience();
  // before science staff existed: one free specialist for each department already built, one trip slot
  if(!s.science.crew){
    const has = t => s.buildings.some(b => b.type === t);
    s.science.crew = {paleo:has("oracle") ? 1 : 0, temporal:has("ghost") ? 1 : 0, gene:has("tar") ? 1 : 0};
  }
  if(s.science.trip !== undefined){ s.science.trips = s.science.trip ? [s.science.trip] : []; delete s.science.trip; }
  delete s.science.budget;
  if(!s.science.tech) s.science.tech = [];
  if(!s.staff.mechanics) s.staff.mechanics = [];
  if(!s.staff.transfers) s.staff.transfers = [];
  if(!s.staff.vets) s.staff.vets = [];
  if(!s.staff.atvs) s.staff.atvs = [];
  // Paleoflora became research: parks already using it keep what they had
  if(!s.ceres){
    s.ceres = {stock:0};
    const give = id => { if(!s.science.tech.includes(id)) s.science.tech.push(id); };
    if(s.buildings.some(b => b.type === "ceres")){ give("paleoflora"); s.ceres.stock = PALEOFLORA.perDay; }
    if(s.exhibits.some(e => e.flora === "mesozoic")){ give("paleoflora"); give("mesoplant"); }
    if(s.exhibits.some(e => e.flora === "paleozoic")){ give("paleoflora"); give("paleoplant"); }
  }
  for(const e of s.exhibits) if(!e.viv && e.cond === undefined){ e.cond = 100; e.inspected = {day:s.day, cond:100}; }
  // viewing platforms used to stick out over the path; flip any old ones so they jut into their exhibit
  for(const b of s.buildings){
    if(b.type !== "platform" || b.inward) continue;
    const e = s.exhibits.find(x => x.id === b.exhibitId);
    if(e){
      const [px, py] = centroid(b.points);
      if(!inPoly(px, py, e.points)){
        let best = null;
        for(let i = 0; i < e.points.length; i++){ const a = e.points[i], c = e.points[(i+1) % e.points.length], r = segProj(px, py, a, c); if(!best || r.d < best.r.d) best = {a, c, r}; }
        const {a, c} = best, dx = c[0]-a[0], dy = c[1]-a[1], L2 = dx*dx + dy*dy || 1;
        b.points = b.points.map(([x, y]) => { const t = ((x-a[0])*dx + (y-a[1])*dy) / L2, fx = a[0] + t*dx, fy = a[1] + t*dy; return [2*fx - x, 2*fy - y]; });
      }
    }
    b.inward = true;
  }
  // parks from before escapes existed get 3 days to upgrade their barriers
  if(!s.safety){ s.safety = freshSafety(); s.safety.escapesFrom = s.day + 3; }
  // parks from before medicine existed get 5 days before animals start falling ill
  if(!s.health){ s.health = freshHealth(); s.health.from = Math.max(HEALTH.startDay, s.day + 5); }
  if(s.ceres.meds === undefined) s.ceres.meds = 0;
  // before logistics: food was unlimited at stations. Parks already past partner feeding get two more days to build a dock,
  // and any medicine waiting at CERES moves to the PMC
  if(!s.starters) s.starters = ["arth", "lyst", "hyps"];   // the old fixed set
  if(!s.zones) s.zones = [];
  if(!s.logi){
    s.logi = freshLogi();
    if(s.staff.keepers.length || s.buildings.some(b => b.type === "station")){ s.staff.feedFrom = Math.max(s.staff.feedFrom, s.day + 2); s.logi.notice = true; }
    const pmc = s.buildings.find(b => b.type === "pmc");
    if(pmc && s.ceres.meds){ const n = Math.min(s.ceres.meds, BUILDINGS.pmc.store.cap); pmc.store = {meds:n}; s.ceres.meds -= n; }
  }
  for(const e of s.exhibits) if(e.zone && !s.zones.some(z => z.id === e.zone)) delete e.zone;
  for(const b of s.buildings) if(b.zone && !s.zones.some(z => z.id === b.zone)) delete b.zone;
  // a dart that was mid-flight when the park was saved never landed
  for(const l of s.safety.loose) if(l.status === "darting"){ l.status = "loose"; l.vet = null; }
  for(const k of Object.keys(freshScience())) if(s.science[k] === undefined) s.science[k] = freshScience()[k];
  for(const k of Object.keys(freshLedger())) if(s.today[k] === undefined) s.today[k] = 0;
  return s;
}

/* ---------- things the rest of the game asks about ---------- */

const PATH_HALF_WIDTH = 2;   // footpaths are 4 m wide
const REACH = 6;             // an exhibit or building within this many meters of a path counts as "on the path"

function speciesCounts(e){
  const m = new Map();
  for(const a of e.animals) m.set(a.sp, (m.get(a.sp)||0) + 1);
  return m;
}

const isService = p => p.type === "service";
const vivRank = size => ({S:1, M:2, L:3})[size] || 0;
// A diet can be written as one word or a list; treat it as a list everywhere
for(const s of SPECIES) if(!Array.isArray(s.diet)) s.diet = [s.diet];
const eats = (s, d) => s.diet.includes(d);
const dietText = s => s.diet.map(d => DIETS[d] || d).join(" and ") + (s.predator ? ", predator" : "") + (s.bug ? ", bug" : "");

// Does species x go after species y? Returns how, or null if it leaves it alone.
// The rules are explained next to SPECIES in data.js.
function attackReason(x, y){
  if(x.id === y.id) return null;
  if(x.predator) return `${x.name} is a predator and will attack the ${y.name}.`;
  if(eats(x, "carnivore") && y.space < x.space) return `${x.name} will hunt the smaller ${y.name}.`;
  if((eats(x, "insectivore") || eats(x, "omnivore")) && y.bug && y.space <= x.space) return `${x.name} will eat the ${y.name}.`;
  return null;
}
// Can two different species share an exhibit? Returns why not, or null if they get along.
function conflict(a, b){ return attackReason(a, b) || attackReason(b, a); }

// Can this species live in this exhibit (a vivarium of some size, or an open habitat)?
function fitsHabitat(s, e){ return e.viv ? !!s.viv && vivRank(e.viv) >= vivRank(s.viv) : !s.viv; }

// Which paths are joined up to the entrance? With guestsOnly, service roads don't count,
// because guests won't walk on them.
function connectedPathIds(guestsOnly){
  const usable = state.paths.filter(p => !(guestsOnly && isService(p)));
  const joined = new Set(), queue = [];
  for(const p of usable) if(p.points.some(v => dist(v, state.gate) < 2)){ joined.add(p.id); queue.push(p); }
  const touches = (p, q) => p.points.some(v => q.points.some((w,i) => i>0 && segProj(v[0], v[1], q.points[i-1], w).d < 1.5));
  while(queue.length){
    const p = queue.shift();
    for(const q of usable){
      if(joined.has(q.id)) continue;
      if(touches(p, q) || touches(q, p)){ joined.add(q.id); queue.push(q); }
    }
  }
  return joined;
}

// Everything worth knowing about one exhibit: how happy it should be and why
function exhibitReport(e){
  const counts = speciesCounts(e), a = area(e.points);
  let need = 0;
  for(const [sp, n] of counts) need += SPECIES_BY_ID[sp].space * n;
  const issues = [];
  // A perfect exhibit (lots of room, right group sizes, home-era plants, fed, clean, no fighting) reaches 95%
  let target = 72;
  if(need > 0){
    const ratio = a / need;
    if(ratio < 1){ target -= (1 - ratio) * 70; issues.push({bad:true, text:`Cramped. The animals need ${fmtArea(need)} and have ${fmtArea(a)}.`}); }
    else if(ratio >= 1.5){ target += 12; issues.push({bad:false, text:"Plenty of room to roam."}); }
    else { target += 4; issues.push({bad:false, text:`Enough room. Half again as much (${fmtArea(need * 1.5)}) would make them happier.`}); }
  }
  let groupsOk = counts.size > 0;
  for(const [sp, n] of counts){
    const s = SPECIES_BY_ID[sp], [lo, hi] = s.group;
    if(n < lo){ groupsOk = false; target -= 22 * (lo - n) / lo; issues.push({bad:true, text:`Lonely. ${s.name} likes groups of ${lo} to ${hi}.`}); }
    if(n > hi){ groupsOk = false; target -= 12; issues.push({bad:true, text:`Too many ${s.name}. They get along in groups of ${lo} to ${hi}.`}); }
  }
  if(groupsOk){ target += 5; issues.push({bad:false, text:"Every species is in a group size it likes."}); }
  // Vivarium animals need a vivarium big enough, and big animals don't fit in one
  for(const sp of counts.keys()){
    const s = SPECIES_BY_ID[sp];
    if(e.viv && !s.viv){ target -= 40; issues.push({bad:true, text:`${s.name} is far too big for a vivarium.`}); }
    else if(e.viv && vivRank(e.viv) < vivRank(s.viv)){ target -= 25; issues.push({bad:true, text:`${s.name} needs a ${VIVARIUMS[s.viv].label.toLowerCase()} or bigger.`}); }
    else if(!e.viv && s.viv){ target -= 20; issues.push({bad:true, text:`${s.name} belongs in a vivarium. It gets lost and stressed in an open habitat.`}); }
  }
  // Clones made from poor DNA are sickly. Animals from partner parks count as healthy.
  if(e.animals.length){
    const avgQ = e.animals.reduce((s, x) => s + (x.q ?? 90), 0) / e.animals.length;
    if(avgQ < 50){ target -= 12; issues.push({bad:true, text:`Frail clones. Their DNA quality averages ${Math.round(avgQ)}%. Better samples make healthier clones.`}); }
    else if(avgQ < 70){ target -= 5; issues.push({bad:true, text:`Some clones are sickly. DNA quality averages ${Math.round(avgQ)}%.`}); }
  }
  // Plants: animals like living among plants from their own era. Older plant-eaters get sick on grass.
  if(counts.size){
    const flora = e.flora || "cenozoic", kinds = [...counts.keys()].map(sp => SPECIES_BY_ID[sp]);
    const away = kinds.filter(s => ERA_OF[s.period] !== flora);
    if(!away.length){ target += FLORA_HAPPY.home; issues.push({bad:false, text:`At home among ${FLORA[flora].plants}.`}); }
    else { target += FLORA_HAPPY.away; issues.push({bad:true, text:`${away.map(s => s.name).join(", ")} ${away.length === 1 ? "lives" : "live"} among plants from another era. ${[...new Set(away.map(s => FLORA[ERA_OF[s.period]].label))].join(" or ")} plants would suit ${away.length === 1 ? "it" : "them"}.`}); }
    // grass comes from a Cenozoic planting, or from plain plant food standing in for Paleoflora
    const grassy = flora === "cenozoic" || e.grassFed;
    const grazers = kinds.filter(s => foodType(s) === "paleoflora");
    const sick = grazers.filter(s => GRASS_INTOLERANT.includes(s.period)), picky = grazers.filter(s => s.period === "Cretaceous");
    if(grassy && sick.length){ target += GRASS_HIT.intolerant; issues.push({bad:true, text:`Sick from eating grass. ${sick.map(s => s.name).join(", ")} never evolved to digest it. ${flora === "cenozoic" ? "Replant with older flora from CERES" : "Feed them Paleoflora from CERES"}.`}); }
    else if(grassy && picky.length){ target += GRASS_HIT.cretaceous; issues.push({bad:true, text:`${picky.map(s => s.name).join(", ")} would rather not eat grass. Older flora or Paleoflora suits them better.`}); }
  }
  // Dirt: a filthy exhibit makes animals miserable fast
  if(e.animals.length && (e.dirt || 0) > CLEAN.penaltyFrom){
    target -= (e.dirt - CLEAN.penaltyFrom) * CLEAN.penaltyPer;
    issues.push({bad:true, text:`Dirty (${Math.round(e.dirt)}%). ${hasUpgrade("shovels") ? (state.staff.keepers.length ? "Keepers will muck it out when they're free." : "Hire keepers to clean it.") : "Keepers need shovels from the Tool Shed to clean it."}`});
  }
  // Barriers: say which animals could get out
  if(!e.viv && state.safety){
    for(const sp of counts.keys()){ const r = escapeRisk(e, SPECIES_BY_ID[sp]); if(r) issues.push({bad:true, text:`Escape risk. ${r}`}); }
    if(isBreached(e)) issues.push({bad:true, text:"The barrier is broken. A mechanic from a Workshop needs to repair it."});
  }
  // Food: an empty store for any food type means hungry animals
  if(e.animals.length && state.staff && !freeFeeding()){
    const need = dailyNeed(e), stock = e.stock || {};
    const empty = Object.keys(need).filter(t => stockFor(e, t) <= 0.01);
    const low = Object.keys(need).filter(t => !empty.includes(t) && stockFor(e, t) < storeMax(e, t) * .25);
    if(empty.length){ target -= 40; issues.push({bad:true, text:`Hungry. They're out of ${empty.join(" and ")}. ${gateCheck(e).ok ? "Keepers need to bring more." : gateCheck(e).text}`}); }
    else if(low.length) issues.push({bad:true, text:`Running low on ${low.join(" and ")}.`});
  }
  // Any pair of species that can't live together causes trouble (counted once per exhibit)
  const kinds = [...counts.keys()].map(sp => SPECIES_BY_ID[sp]);
  let fight = null;
  for(let i = 0; i < kinds.length && !fight; i++) for(let j = i + 1; j < kinds.length && !fight; j++) fight = conflict(kinds[i], kinds[j]);
  if(fight){ target -= 45; issues.push({bad:true, text:`Fighting. ${fight}`}); }
  // Sick and hurt animals drag the whole herd down
  // (mild illness nobody has spotted yet still hurts, but only shows as a vague hint)
  const sick = e.animals.filter(a => a.sick).length, known = e.animals.filter(noticed).length;
  if(sick) target -= Math.min(30, HEALTH.sickHappy * sick * Math.max(1, 4 / e.animals.length));
  if(known) issues.push({bad:true, text:`${known} sick or hurt. ${known === 1 ? "It needs" : "They need"} a vet. See Health below.`});
  else if(sick) issues.push({bad:true, text:"Some of the animals seem off. A vet's check-up would find out why."});
  return {area:a, need, target:clamp(target, 0, 100), issues, counts, exhibit:e};
}

// Rebuild all the worked-out numbers. Called whenever the park changes.
function recompute(){
  updatePower();
  const joined = connectedPathIds(true), joinedAll = connectedPathIds(false);
  const guestPaths = state.paths.filter(p => joined.has(p.id)), anyPaths = state.paths.filter(p => joinedAll.has(p.id));
  const near = (shape, list) => list.some(p => lineShapeDist(p.points, shape) <= REACH);
  const reach = {}, reports = {};
  // Guests reach exhibits and shops by footpath. Staff reach backstage buildings by footpath or service road.
  for(const e of state.exhibits){ reach[e.id] = near(e.points, guestPaths); reports[e.id] = exhibitReport(e); }
  for(const b of state.buildings) reach[b.id] = near(b.points, BUILDINGS[b.type].dept ? anyPaths : guestPaths);

  // How much guests want to visit
  let appeal = 0, animals = 0, happySum = 0;
  const shown = new Set();
  for(const e of state.exhibits){
    const n = e.animals.length; if(!n) continue;
    animals += n; happySum += e.happy * n;
    if(!reach[e.id]) continue;
    for(const [sp, c] of reports[e.id].counts){
      appeal += SPECIES_BY_ID[sp].appeal * Math.sqrt(c) * (0.4 + 0.6 * e.happy / 100) * viewFactor(e, reach);
      shown.add(sp);
    }
  }
  const fair = fairTicket();
  const priceF = clamp(1 - 1.2 * (state.ticket - fair) / fair, 0.05, 1.3);
  const demand = appeal * (1 + 0.06 * shown.size) * 9 * (0.6 + 0.16 * state.rating) * priceF * fearFactor();

  // How well the park looks after its guests
  const cap = t => state.buildings.filter(b => b.type === t && reach[b.id]).length * BUILDINGS[t].capacity;
  const last = state.history.length ? state.history[state.history.length-1].guests : 0;
  const ref = Math.max(last, demand);
  const cover = c => ref > 0 ? Math.min(1, c / ref) : (c > 0 ? 1 : 0);
  const foodCover = cover(cap("food")), restCover = cover(cap("restroom"));
  const satisfaction = 0.3 + 0.35 * foodCover + 0.35 * restCover;
  const avgHappy = animals ? happySum / animals : 0;
  // Stars come from four things: happy animals, looked-after guests, variety, and how much there is to see.
  // Each part is scored 0 to 1. Animals count as fully happy at 90% or more.
  const welfare = clamp((avgHappy - 30) / 60, 0, 1);
  const variety = Math.min(1, shown.size / 10), size = Math.min(1, appeal / 150);
  const parts = animals ? [
    {label:"Animal happiness", score:welfare,              max:1.25, note:`${Math.round(avgHappy)}% average. 90% counts as full marks.`},
    {label:"Guest comfort",    score:(satisfaction-.3)/.7, max:.75,  note:`Food ${Math.round(foodCover*100)}%, restrooms ${Math.round(restCover*100)}% of what your guests need.`},
    {label:"Variety",          score:variety,              max:1.5,  note:shown.size >= 10 ? `${shown.size} species on show. Full marks.` : `${shown.size} species on show. 10 gets full marks.`},
    {label:"Things to see",    score:size,                 max:1.5,  note:"Bigger, happier groups of popular animals."},
  ] : [];
  let ratingTarget = parts.reduce((s, p) => s + p.score * p.max, 0);
  const pricey = state.ticket > fair * 1.3;
  if(pricey) ratingTarget -= 0.3;

  derived = {joined, joinedAll, reach, reports, demand, fair, priceF, shown:shown.size, animals, appeal, variety, size, welfare, avgHappy, foodCover, restCover,
             satisfaction, parts, pricey, ratingTarget:clamp(ratingTarget, 0, 5), capFood:cap("food"), capShop:cap("shop")};
  return derived;
}

function fairTicket(){ return 15 + state.rating * 6; }
function isReachable(item){ return !!(derived && derived.reach[item.id]); }
function speciesShown(){ return derived ? derived.shown : 0; }
const goalApi = { get state(){ return state; }, isReachable, speciesShown };

/* ---------- money ---------- */

function canAfford(cost){ return state.money >= cost; }
function spend(cost, kind){ state.money -= cost; state.today[kind] += cost; }
function earn(amount, kind){ state.money += amount; state.today[kind] += amount; }

function exhibitCost(pts){ return Math.round(perimeter(pts) * COST.fencePerMeter + area(pts) * COST.landPerSqM); }
function pathCost(pts, type){ return Math.round(lineLength(pts) * (type === "service" ? SERVICE_ROAD.perMeter : COST.pathPerMeter)); }
function refundFor(kind, item){
  if(kind === "exhibit") return Math.round((item.viv ? VIVARIUMS[item.viv].price : exhibitCost(item.points)) * COST.refundShare);
  if(kind === "path") return Math.round(pathCost(item.points, item.type) * COST.refundShare);
  if(kind === "building") return Math.round(BUILDINGS[item.type].price * COST.refundShare);
  return 0;
}

/* ---------- time passing ---------- */

// Arrivals follow a hump: few at opening, busiest late morning, none after 4 PM.
const ARRIVE_START = OPEN_MIN, ARRIVE_END = 16 * 60;
function arrivalShare(m0, m1){
  const f = m => { const t = clamp((m - ARRIVE_START) / (ARRIVE_END - ARRIVE_START), 0, 1); return (1 - Math.cos(Math.PI * t)) / 2; };
  return f(m1) - f(m0);
}

let sinceRecompute = 0;

// Move the park forward by dtMin park minutes
function tick(dtMin){
  if(state.over) return;
  const m0 = state.minute, m1 = Math.min(CLOSE_MIN, m0 + dtMin);
  state.minute = m1;

  sinceRecompute += m1 - m0;
  if(sinceRecompute >= 20 || !derived){ recompute(); sinceRecompute = 0; }

  // Animals eat, keepers walk
  ceresTick(m1 - m0);
  logiTick(m1 - m0);
  medTick(m1 - m0);
  eatTick(m1 - m0);
  dirtTick(m1 - m0);
  keepersTick(m1 - m0);
  wearTick(m1 - m0);
  mechanicsTick(m1 - m0);
  vetsTick(m1 - m0);
  escapesTick(m1 - m0);
  if(state.over) return;

  // Animal happiness drifts toward what the exhibit gives them
  for(const e of state.exhibits){
    if(!e.animals.length) continue;
    const target = derived.reports[e.id].target;
    e.happy += (target - e.happy) * Math.min(1, (m1 - m0) / 240);
  }

  // Guests arrive
  arrivalCarry += derived.demand * arrivalShare(m0, m1);
  while(arrivalCarry >= 1){
    arrivalCarry -= 1;
    inPark.push(m1 + 120 + Math.random() * 150);
    state.today.guests++;
    earn(state.ticket, "tickets");
    events.guestArrived();
  }

  // Guests leave, spending money on the way out
  for(let i = inPark.length - 1; i >= 0; i--) if(inPark[i] <= m1){ inPark.splice(i, 1); guestLeaves(); }

  if(m1 >= CLOSE_MIN) endDay();
}

function guestLeaves(){
  const t = state.today;
  if(t.servedFood < derived.capFood){ t.servedFood++; earn(BUILDINGS.food.perGuest, "food"); }
  if(t.servedShop < derived.capShop){ t.servedShop++; earn(BUILDINGS.shop.perGuest, "shop"); }
  events.guestLeft();
}

function dailyCosts(){
  // partner parks bill for feeding while they do it; after that animal food is bought at the dock or made on site
  let feed = 0, wages = 0, upkeep = 0;
  for(const e of state.exhibits){
    if(freeFeeding()) for(const a of e.animals) feed += SPECIES_BY_ID[a.sp].food;
    upkeep += e.viv ? VIVARIUMS[e.viv].upkeep : area(e.points) * UPKEEP.exhibitPerSqM;
  }
  for(const p of state.paths) upkeep += lineLength(p.points) * (isService(p) ? SERVICE_ROAD.upkeepPerMeter : UPKEEP.pathPerMeter);
  for(const b of state.buildings) upkeep += BUILDINGS[b.type].upkeep;
  for(const p of state.health.ward) feed += SPECIES_BY_ID[p.a.sp].food;
  wages += state.staff.keepers.length * KEEPER.wage + state.staff.mechanics.length * MAINT.wage + state.staff.vets.length * VET.wage;
  // science staff are paid as research costs
  let research = 0;
  for(const [k, n] of Object.entries(state.science.crew)) research += n * SCIENTISTS[k].wage;
  return {feed:Math.round(feed), wages:Math.round(wages), upkeep:Math.round(upkeep), research};
}

/* ---------- science: ORACLE, GHOST, and TAR ---------- */

const PERIOD_BY_ID = Object.fromEntries(TIME_PERIODS.map(p => [p.id, p]));
const rand = (a, b) => a + Math.random() * (b - a);

// A department only works when it's built and staff can reach it
function dept(type){ const b = state.buildings.find(x => x.type === type); return b && isReachable(b) ? b : null; }
function hasDept(type){ return state.buildings.some(x => x.type === type); }
function deptProblem(type){
  if(!hasDept(type)) return `Build ${BUILDINGS[type].label} first.`;
  if(!dept(type)) return `${BUILDINGS[type].label} isn't connected. Run a path or service road from the entrance to it.`;
  return null;
}
function logScience(text, ok){ state.science.log.unshift({day:state.day, text, ok}); state.science.log.length = Math.min(state.science.log.length, 8); }

function unlockProblem(id){
  const p = PERIOD_BY_ID[id], sc = state.science;
  return deptProblem("oracle") || (sc.unlocked.includes(id) ? "Already unlocked." : sc.points < p.research ? `Needs ${p.research} research points. You have ${sc.points}.` : null);
}
function unlockPeriod(id){
  if(unlockProblem(id)) return false;
  const sc = state.science;
  sc.points -= PERIOD_BY_ID[id].research;
  sc.unlocked.push(id);
  events.toast(`ORACLE unlocked the ${id}. GHOST can travel there now.`, "good");
  return true;
}

function tripProblem(periodId){
  const p = PERIOD_BY_ID[periodId], sc = state.science;
  return deptProblem("oracle") || deptProblem("ghost") ||
    (!sc.unlocked.includes(periodId) ? `Unlock the ${periodId} with ORACLE first.` : null) ||
    (!sc.crew.temporal ? "Hire a Temporal Researcher at GHOST to lead expeditions." : null) ||
    (sc.trips.length >= sc.crew.temporal ? `All ${sc.crew.temporal} expedition team${sc.crew.temporal === 1 ? " is" : "s are"} in the field. Hire more Temporal Researchers at GHOST to send more at once.` : null) ||
    (!canAfford(p.trip) ? `A trip costs ${money(p.trip)}. You have ${money(state.money)}.` : null);
}
function launchTrip(periodId, sp){
  if(tripProblem(periodId)) return false;
  const p = PERIOD_BY_ID[periodId];
  spend(p.trip, "science");
  state.science.trips.push({period:periodId, sp, back:state.day + p.days - 1});
  events.toast(`GHOST left for the ${periodId} to find ${SPECIES_BY_ID[sp].name}. Back after closing on day ${state.day + p.days - 1}.`);
  return true;
}

// Add a DNA sample to the genome library. Returns how much the genome grew.
function addSample(sp, gain, q){
  const dna = state.science.dna;
  const d = dna[sp] || (dna[sp] = {genome:0, quality:0});
  if(d.genome >= 100){ const before = d.quality; if(q > d.quality) d.quality = Math.round(d.quality + (q - d.quality) * .5); return {gain:0, better:d.quality - before}; }
  const g = Math.min(gain, 100 - d.genome);
  d.quality = Math.round((d.quality * d.genome + q * g) / (d.genome + g));
  d.genome = Math.min(100, Math.round(d.genome + g));
  return {gain:g, better:0};
}

function tripReturns(t){
  const sc = state.science, p = PERIOD_BY_ID[t.period], s = SPECIES_BY_ID[t.sp];
  if(Math.random() < p.risk){
    const msg = `GHOST came back from the ${t.period} empty-handed. The ${s.name} trail went cold.`;
    logScience(msg, false); events.toast(msg, "bad"); return;
  }
  const q = Math.round(rand(p.quality[0], p.quality[1]));
  const r = addSample(t.sp, rand(SAMPLE_GAIN[0], SAMPLE_GAIN[1]), q);
  const d = sc.dna[t.sp];
  let msg = r.gain ? `GHOST brought back ${s.name} DNA (${q}% quality). Genome ${d.genome}% complete.`
                   : `GHOST brought back more ${s.name} DNA. ${r.better > 0 ? `Quality improved to ${d.quality}%.` : "It wasn't better than what TAR already has."}`;
  // Sometimes the team finds something else along the way
  const others = SPECIES.filter(x => x.period === t.period && x.id !== t.sp && !isStarter(x));
  if(others.length && Math.random() < .3){
    const o = others[Math.floor(Math.random() * others.length)];
    const r2 = addSample(o.id, rand(5, 12), Math.round(rand(p.quality[0], p.quality[1])));
    if(r2.gain) msg += ` They also found ${o.name} traces (+${Math.round(r2.gain)}%).`;
  }
  logScience(msg, true); events.toast(msg, "good");
}

function cloneDays(sp){ return 1 + Math.floor(SPECIES_BY_ID[sp].space / CLONE_DAYS_PER_SPACE); }
function cloneProblem(sp){
  const s = SPECIES_BY_ID[sp], d = state.science.dna[sp];
  return deptProblem("tar") ||
    (!state.science.crew.gene ? "Hire a Geneticist at TAR to run the incubators." : null) ||
    (!d || d.genome < 100 ? `${s.name}'s genome is ${d ? d.genome : 0}% complete. It needs 100%.` : null) ||
    (state.rating + 1e-9 < s.stars ? `Needs a ${s.stars}-star park. You have ${state.rating.toFixed(1)}.` : null) ||
    (!canAfford(s.price) ? `Cloning costs ${money(s.price)}. You have ${money(state.money)}.` : null);
}
// Each geneticist runs one incubator. A new clone goes in whichever incubator frees up first.
function freeLane(){
  const lanes = Math.max(1, state.science.crew.gene);
  let best = {lane:0, start:Infinity};
  for(let l = 0; l < lanes; l++){
    const mine = state.science.clones.filter(c => (c.lane || 0) === l);
    const start = mine.length ? Math.max(...mine.map(c => c.done)) + 1 : state.day;
    if(start < best.start) best = {lane:l, start};
  }
  return best;
}
function cloneReadyDay(sp){ return freeLane().start + cloneDays(sp) - 1; }
function orderClone(sp, exhibitId){
  if(cloneProblem(sp)) return false;
  const s = SPECIES_BY_ID[sp], d = state.science.dna[sp];
  spend(s.price, "animals");
  const {lane, start} = freeLane(), done = start + cloneDays(sp) - 1;
  state.science.clones.push({id:uid("a-"), sp, exhibitId:exhibitId || null, q:clamp(Math.round(d.quality + rand(-5, 5)), 5, 100), lane, done});
  events.toast(`TAR started a ${s.name} clone. Ready after closing on day ${done}.`);
  return true;
}
function putAnimal(e, a){
  if(!e.animals.length) e.happy = 70;
  e.animals.push({id:a.id, sp:a.sp, cl:true, q:a.q});
}
function hireScientist(kind){
  const k = SCIENTISTS[kind];
  if(!hasDept(k.dept)) return `Build ${BUILDINGS[k.dept].label} first.`;
  if(!canAfford(k.hireCost)) return `Hiring costs ${money(k.hireCost)}.`;
  spend(k.hireCost, "science"); state.science.crew[kind]++;
  return null;
}
function placeReady(id, exhibitId){
  const sc = state.science, i = sc.ready.findIndex(r => r.id === id), e = state.exhibits.find(x => x.id === exhibitId);
  if(i < 0 || !e) return false;
  putAnimal(e, sc.ready[i]); sc.ready.splice(i, 1);
  return true;
}

// Run each night: research, expeditions, and cloning
function scienceNight(){
  const sc = state.science;
  if(dept("oracle")) sc.points += sc.crew.paleo * RESEARCH_PER_PALEO;
  const back = sc.trips.filter(t => t.back <= state.day);
  sc.trips = sc.trips.filter(t => t.back > state.day);
  back.forEach(tripReturns);
  // with TAR closed or nobody to run it, every clone waits a day
  if(!dept("tar") || !sc.crew.gene){ for(const c of sc.clones) c.done++; return; }
  const finished = sc.clones.filter(c => c.done <= state.day);
  sc.clones = sc.clones.filter(c => c.done > state.day);
  for(const c of finished){
    const s = SPECIES_BY_ID[c.sp], e = state.exhibits.find(x => x.id === c.exhibitId);
    const health = c.q >= 70 ? "healthy" : c.q >= 50 ? "a little sickly" : "frail";
    if(e){ putAnimal(e, c); events.toast(`TAR finished a ${s.name} clone (${health}, ${c.q}% DNA quality). It moved into ${e.name}.`, "good"); }
    else { sc.ready.push({id:c.id, sp:c.sp, q:c.q}); events.toast(`TAR finished a ${s.name} clone. Tap an exhibit to move it in.`, "good"); }
  }
}

function endDay(){
  while(inPark.length){ inPark.pop(); guestLeaves(); }
  arrivalCarry = 0;
  recompute();

  const c = dailyCosts();
  spend(c.feed, "feed"); spend(c.wages, "wages"); spend(c.upkeep, "upkeep"); spend(c.research, "science");
  scienceNight();
  keepersNight();
  logiNight();
  escapesNight();
  mechanicsNight();
  healthNight();
  vetsNight();
  if(state.day + 1 === state.safety.escapesFrom) events.toast("Animals can start escaping tomorrow. Check each exhibit's barrier.", "bad");
  if(state.day + 1 === state.staff.feedFrom) events.toast("Partner parks stop feeding your animals tomorrow. Keepers need to take over.", "bad");

  const before = state.rating;
  // Move a third of the way to the target each night, but at least 0.1 stars, so it actually gets there
  const gap = derived.ratingTarget - state.rating;
  const step = Math.sign(gap) * Math.min(Math.abs(gap), Math.max(0.1, Math.abs(gap) * 0.35));
  state.rating = clamp(state.rating + step, 0, 5);

  const t = state.today;
  const income = t.tickets + t.food + t.shop + t.sold + t.rewards;
  const costs = t.feed + t.wages + t.upkeep + t.built + t.animals + t.science + t.fines + t.repairs;
  const report = {day:state.day, guests:t.guests, income, costs, net:income - costs, rating:state.rating, ratingBefore:before, ledger:{...t}};
  state.history.push({day:state.day, guests:t.guests, income, costs, net:income - costs, rating:+state.rating.toFixed(2)});
  if(state.history.length > 60) state.history.shift();

  // Warn about unhappy animals
  for(const e of state.exhibits) if(e.animals.length && e.happy < 30) events.toast(`${e.name}: the animals are unhappy. Tap the exhibit to see why.`, "bad");

  state.day++;
  state.minute = OPEN_MIN;
  state.today = freshLedger();
  checkGoals();

  if(state.money < -25000){ state.over = true; events.gameOver(); }
  recompute();
  events.dayEnded(report);
  events.changed();
}

/* ---------- goals ---------- */

function currentGoal(){ return GOALS.find(g => !state.goalsDone.includes(g.id)) || null; }
function checkGoals(){
  if(!derived) recompute();
  for(const g of GOALS){
    if(state.goalsDone.includes(g.id)) continue;
    if(g.check(goalApi)){
      state.goalsDone.push(g.id);
      earn(g.reward, "rewards");
      events.toast(`Goal complete: ${g.text}. You earned ${money(g.reward)}.`, "good");
    }
  }
}

/* ---------- formatting shared by the screen ---------- */

function money(n){ const s = "$" + Math.abs(Math.round(n)).toLocaleString(); return n < 0 ? "−" + s : s; }
function fmtArea(m2){ return `${Math.round(m2).toLocaleString()} m²`; }
function fmtClock(min){
  const h = Math.floor(min / 60), m = Math.floor(min % 60);
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
