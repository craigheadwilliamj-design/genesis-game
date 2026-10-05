/* =====================================================================
   SIMULATION
   The rules of the game: time passing, guests arriving and spending,
   animal happiness, daily costs, star rating, and goals.
   Nothing in this file draws anything on screen.
   ===================================================================== */

const SPECIES_BY_ID = Object.fromEntries(SPECIES.map(s => [s.id, s]));
const uid = p => p + Math.random().toString(36).slice(2, 9);

// The park plot: a 420 × 305 m rectangle, every corner on the 5 m grid
const PARK_PLOT = [[0,0],[420,0],[420,305],[0,305]];
const OLD_PLOT = [[0,18],[150,0],[410,8],[420,300],[-6,306]];

/* ---------- land for sale ---------- */
// Parcel (i, j) is the cell between PARCELS.xs[i..i+1] and ys[j..j+1]. The home plot's cells are always owned.
const parcelRect = (i, j) => [PARCELS.xs[i], PARCELS.ys[j], PARCELS.xs[i+1], PARCELS.ys[j+1]];
const parcelId = (i, j) => i + "," + j;
const PARCEL_CELLS = (() => { const out = []; for(let i = 0; i < PARCELS.xs.length - 1; i++) for(let j = 0; j < PARCELS.ys.length - 1; j++) out.push([i, j]); return out; })();
function parcelHome(i, j){ const [x0, y0, x1, y1] = parcelRect(i, j), h = PARCELS.home; return x0 >= h[0] && x1 <= h[2] && y0 >= h[1] && y1 <= h[3]; }
const ownsParcel = (i, j) => parcelHome(i, j) || (state.parcels || []).includes(parcelId(i, j));
const parcelArea = (i, j) => { const [x0, y0, x1, y1] = parcelRect(i, j); return (x1 - x0) * (y1 - y0); };
// How many cells out from the home plot: 1 touches it
function parcelRing(i, j){
  let best = 9;
  for(const [a, b] of PARCEL_CELLS) if(parcelHome(a, b)) best = Math.min(best, Math.max(Math.abs(a - i), Math.abs(b - j)));
  return best;
}
const parcelPrice = (i, j) => Math.round(parcelArea(i, j) * (PARCELS.rates[Math.min(parcelRing(i, j), PARCELS.rates.length - 1)]) / 100) * 100;
const parcelTouches = (i, j) => [[1,0], [-1,0], [0,1], [0,-1]].some(([a, b]) => i + a >= 0 && j + b >= 0 && i + a < PARCELS.xs.length - 1 && j + b < PARCELS.ys.length - 1 && ownsParcel(i + a, j + b));
function parcelProblem(i, j){
  if(ownsParcel(i, j)) return "You already own this land.";
  if(!parcelTouches(i, j)) return "Not for sale yet. Buy the land next to it first.";
  const cost = parcelPrice(i, j);
  if(!canAfford(cost)) return `Costs ${money(cost)}. You have ${money(state.money)}.`;
  return null;
}
function buyParcel(i, j){
  if(parcelProblem(i, j)) return false;
  spend(parcelPrice(i, j), "built"); state.parcels.push(parcelId(i, j)); return true;
}
// Rectangles of everything owned, merged by row so a long strip is one rect. Cached until a parcel is bought.
let ownedCache = null;
function ownedRects(){
  const key = state.parcels.join("|");
  if(ownedCache && ownedCache.state === state && ownedCache.key === key) return ownedCache.rects;
  const rects = [];
  for(let j = 0; j < PARCELS.ys.length - 1; j++){
    let run = null;
    for(let i = 0; i < PARCELS.xs.length - 1; i++){
      if(ownsParcel(i, j)){ const r = parcelRect(i, j); if(run) run[2] = r[2]; else run = r.slice(); }
      else if(run){ rects.push(run); run = null; }
    }
    if(run) rects.push(run);
  }
  ownedCache = {state, key, rects}; return rects;
}
const inOwned = (x, y, tol = .5) => ownedRects().some(r => x >= r[0] - tol && x <= r[2] + tol && y >= r[1] - tol && y <= r[3] + tol);
// The park's outer fence line as segments [[x,y],[x,y]]: cell edges with no owned land on the far side
function ownedEdges(){
  const out = [], has = (a, c) => a >= 0 && c >= 0 && a < PARCELS.xs.length - 1 && c < PARCELS.ys.length - 1 && ownsParcel(a, c);
  for(const [i, j] of PARCEL_CELLS){
    if(!ownsParcel(i, j)) continue;
    const [x0, y0, x1, y1] = parcelRect(i, j);
    if(!has(i, j-1)) out.push([[x0, y0], [x1, y0]]);
    if(!has(i, j+1)) out.push([[x0, y1], [x1, y1]]);
    if(!has(i-1, j)) out.push([[x0, y0], [x0, y1]]);
    if(!has(i+1, j)) out.push([[x1, y0], [x1, y1]]);
  }
  return out;
}
function ownedBox(){ const r = ownedRects(); return {x0:Math.min(...r.map(a => a[0])), y0:Math.min(...r.map(a => a[1])), x1:Math.max(...r.map(a => a[2])), y1:Math.max(...r.map(a => a[3]))}; }

let state = null;     // the saved game
let derived = null;   // numbers worked out from the saved game, rebuilt when it changes
let arrivalCarry = 0; // fractions of a guest carried between frames

// Hooks other files fill in, so the simulation can tell the screen what happened
const events = { toast(){}, dayEnded(){}, changed(){}, gameOver(){}, died(){} };

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
// stars the park needs for an animal: none for the starting pool
const starsNeed = s => isStarter(s) ? 0 : s.stars;
function freshLedger(){ return {guests:0, tickets:0, food:0, shop:0, feed:0, wages:0, upkeep:0, built:0, animals:0, science:0, sold:0, rewards:0, fines:0, repairs:0, servedFood:0, servedShop:0, moodSum:0, moodN:0, eduSum:0, eduN:0, donations:0, edfees:0, rooms:0, fares:0, supplies:0, cleaning:0, medicine:0}; }

function freshScience(){
  return {
    points:0,          // unspent ORACLE research points
    crew:{paleo:0, temporal:0, gene:0, botanist:0},  // science staff hired at each department
    tech:["bars"],           // everything ORACLE has researched (TECH ids, plus "ref-<Period>" for refined medicine)
    projects:[],       // ORACLE's research in progress: {kind, id, start, end}. Times are park minutes, see nowMin().
    unlocked:[],       // animals ORACLE has unlocked, so GHOST can look for their DNA
    dna:{},            // species id (or plant DNA id) -> {genome: 0-100, quality: 0-100}
    trips:[],          // expeditions in the field: {period, sp, start, end}
    clones:[],         // TAR's incubators: {id, sp, exhibitId, q, lane, start, end}
    ready:[],          // finished clones waiting for an exhibit: {id, sp, q}
    log:[]             // recent expedition results, newest first
  };
}

// CERES: Paleoflora fodder (stock), medicine on hand, landscape plants by period, growing beds, and which medicines it keeps stocked
function freshCeres(){ return {stock:0, meds:0, pots:{}, beds:[], auto:{cenozoic:false, mesozoic:false, paleozoic:false}}; }

// Themes: the one new builds use, and which are unlocked
function freshThemes(){ return {brush:"genesis", have:["genesis"]}; }

function newPark(){
  return {
    version:1, name:"Genesis Park",
    money:START.money, ticket:START.ticket, tramFare:TRAM.fare, rating:START.rating,
    day:1, minute:OPEN_MIN,
    boundary:PARK_PLOT.map(p => p.slice()), parcels:[],
    gate:[205,305],
    exhibits:[],
    paths:[{id:"p-main", name:"Main walk", points:[[205,305],[205,235]], fixed:true}],
    buildings:[],
    science:freshScience(), staff:freshStaff(), safety:freshSafety(), ceres:freshCeres(), health:freshHealth(), zones:[], logi:freshLogi(), starters:pickStarters(), guestLog:freshGuestLog(), litter:{}, lodging:freshLodging(), weather:freshWeather(), themes:freshThemes(),
    today:freshLedger(), history:[], goalsDone:[], over:false
  };
}

// Bring older saves up to date with anything added since
function upgradeSave(s){
  // the old slanted plot became a rectangle on the 5 m grid; the entrance stays where it was
  if(JSON.stringify(s.boundary) === JSON.stringify(OLD_PLOT)) s.boundary = PARK_PLOT.map(p => p.slice());
  if(!s.parcels) s.parcels = [];
  if(s.tramFare === undefined) s.tramFare = TRAM.fare;
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
  // hotels, cold stores, security, generators and viewing platforms became research: parks already using them keep them
  for(const [type, id] of [["campground","hotels"], ["lodge","hotels"], ["resort","hotels"], ["coldstore","coldstore"], ["security","security"], ["generator","generator"], ["platform","platform"]])
    if(s.buildings.some(b => b.type === type) && !s.science.tech.includes(id)) s.science.tech.push(id);
  if(!s.staff.mechanics) s.staff.mechanics = [];
  if(!s.staff.transfers) s.staff.transfers = [];
  if(!s.staff.vets) s.staff.vets = [];
  if(!s.staff.custodians) s.staff.custodians = [];
  if(!s.staff.guards) s.staff.guards = [];
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
  // landscaping: rocks, groves and shelters (e.land) and drawn water (e.water) inside open exhibits.
  // Round ponds became drawn water: each one turns into a shape of the same size where it was.
  for(const e of s.exhibits){
    if(e.viv) continue;
    if(e.land === undefined) e.land = [];
    if(e.water === undefined) e.water = [];
    for(const f of e.land.filter(f => f.type === "pond")) e.water.push({id:f.id, points:circlePts(f.x, f.y, WATER.oldPondR, 12)});
    e.land = e.land.filter(f => f.type !== "pond");
  }
  if(!s.themes) s.themes = freshThemes();
  // the day each building went up (older themed buildings weather more); ones from before this count as old
  for(const b of s.buildings) if(b.day === undefined) b.day = 0;
  // renamed themes: Range is now Homestead, Western is now Mesa, Classic is now Japanese Garden
  const renamed = {range:"homestead", western:"mesa", classic:"japanese"}, rn = k => renamed[k] || k;
  for(const it of [...s.paths, ...s.buildings, ...s.exhibits, ...(s.zones || [])]) if(renamed[it.theme]) it.theme = rn(it.theme);
  s.themes.have = s.themes.have.map(rn);
  s.themes.brush = rn(s.themes.brush);
  // parks from before weather get 3 fair days to build shelters
  if(!s.weather){ s.weather = freshWeather(); s.weather.from = s.day + 3; }
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
  // science became timed and per animal. Time periods already unlocked become their animals, and trips and clones keep their finish time.
  const sc = s.science;
  if(!sc.projects){
    sc.projects = [];
    const was = sc.unlocked, keep = was.filter(id => SPECIES_BY_ID[id]);
    for(const sp of SPECIES) if(!keep.includes(sp.id) && !(s.starters || []).includes(sp.id) && (was.includes(sp.period) || (sc.dna || {})[sp.id])) keep.push(sp.id);
    sc.unlocked = keep;
    for(const t of sc.trips) if(t.back !== undefined){ t.end = t.back * DAY_MIN; t.start = t.end - PERIOD_BY_ID[t.period].days * DAY_MIN; delete t.back; }
    for(const c of sc.clones) if(c.done !== undefined){ c.end = c.done * DAY_MIN; c.start = c.end - (1 + SPECIES_BY_ID[c.sp].space / CLONE_DAYS_PER_SPACE) * DAY_MIN; delete c.done; }
  }
  if(sc.crew.botanist === undefined) sc.crew.botanist = s.buildings.some(b => b.type === "ceres") ? 1 : 0;
  // plant DNA and medicine refinement became things to collect and research: parks already using them have them
  if(!sc.dna) sc.dna = {};
  const hasT = id => sc.tech.includes(id), giveDna = era => { for(const f of Object.values(PLANT_DNA)) if(f.era === era && !sc.dna[f.id]) sc.dna[f.id] = {genome:100, quality:90}; };
  if(hasT("mesoplant")) giveDna("mesozoic");
  if(hasT("paleoplant")) giveDna("paleozoic");
  if(hasT("paleoflora") && !Object.values(PLANT_DNA).some(f => sc.dna[f.id] && sc.dna[f.id].genome >= 100)) giveDna("mesozoic");
  if(!s.ceres.pots) s.ceres.pots = {};
  if(!s.ceres.beds) s.ceres.beds = [];
  // plant DNA, and the plants CERES grows, became per period (and exhibit planting stock went away): split what an era had across its periods
  const periodsOf = era => Object.values(PLANT_DNA).filter(f => f.era === era);
  for(const era of ["mesozoic", "paleozoic"]){
    const old = sc.dna["flora-" + era];
    if(old){ for(const f of periodsOf(era)) if(!sc.dna[f.id]) sc.dna[f.id] = {...old}; delete sc.dna["flora-" + era]; }
    for(const t of sc.trips) if(t.sp === "flora-" + era) t.sp = "flora-" + t.period;
    for(const size of PLANT_SIZES){
      const n = s.ceres.pots[era + "-" + size]; if(n === undefined) continue;
      periodsOf(era).forEach((f, i) => { s.ceres.pots[f.period + "-" + size] = (s.ceres.pots[f.period + "-" + size] || 0) + Math.floor(n / 3) + (i < n % 3 ? 1 : 0); });
      delete s.ceres.pots[era + "-" + size];
    }
  }
  for(const j of s.ceres.beds) if(j.kind === "plant" && !PLANT_DNA[j.era]) j.era = j.era === "paleozoic" ? "Carboniferous" : "Jurassic";
  if(s.ceres.beds.some(j => j.kind === "flora")){ for(const j of s.ceres.beds) if(j.kind === "flora") s.money += ({mesozoic:1500, paleozoic:2200})[j.era] || 0; s.ceres.beds = s.ceres.beds.filter(j => j.kind !== "flora"); }
  delete s.ceres.plants;
  if(!s.ceres.auto){
    s.ceres.auto = {cenozoic:false, mesozoic:false, paleozoic:false};
    for(const [era, id] of Object.entries(MED_TECH)) if(hasT(id)){
      s.ceres.auto[era] = true;
      for(const p of TIME_PERIODS) if(ERA_OF[p.id] === era && !hasT("ref-" + p.id)) sc.tech.push("ref-" + p.id);
    }
  }
  // contemporary medicine: the PMC starts empty and suppliers fill it overnight; patients already dosed were on the era's own medicine
  if(s.health.cmeds === undefined) s.health.cmeds = 0;
  for(const p of s.health.ward) if(p.med === undefined){ p.med = p.dosed ? "era" : null; delete p.dosed; }
  // before logistics: food was unlimited at stations. Parks already past partner feeding get two more days to build a dock,
  // and any medicine waiting at CERES moves to the PMC
  if(!s.starters) s.starters = ["arth", "lyst", "hyps"];   // the old fixed set
  if(!s.zones) s.zones = [];
  if(!s.guestLog) s.guestLog = freshGuestLog();
  if(!s.guestLog.vandal) s.guestLog.vandal = freshVandalLog();
  if(s.guestLog.edu === undefined) s.guestLog.edu = null;
  if(!s.lodging) s.lodging = freshLodging();
  // parks from before litter and seats get told what changed
  if(!s.litter){ s.litter = {}; if(s.buildings.some(b => OLD_MENUS[b.type] || b.type === "restroom")) s.guestLog.notice = true; }
  // food stands and gift shops from before menus keep selling what they used to
  for(const b of s.buildings) if(OLD_MENUS[b.type] && !b.menu) b.menu = OLD_MENUS[b.type].map(id => ({id, price:MENU[id].price}));
  if(!s.logi){
    s.logi = freshLogi();
    if(s.staff.keepers.length || s.buildings.some(b => b.type === "station")){ s.staff.feedFrom = Math.max(s.staff.feedFrom, s.day + 2); s.logi.notice = true; }
    const pmc = s.buildings.find(b => b.type === "pmc");
    if(pmc && s.ceres.meds){ const n = Math.min(s.ceres.meds, BUILDINGS.pmc.store.cap); pmc.store = {meds:n}; s.ceres.meds -= n; }
  }
  // stock for stands and shops became physical: older parks get a few more days of direct deliveries
  if(s.logi.trucks === undefined) s.logi.trucks = Math.max(0, Math.floor((s.minute - OPEN_MIN) / LOGI.truckMin));
  if(s.logi.guestFrom === undefined){ s.logi.guestFrom = Math.max(GUEST_GOODS_FROM, s.day + 3); s.logi.used = {}; s.logi.usedLast = {}; if(s.buildings.some(b => BUILDINGS[b.type].kind)) s.logi.guestNotice = true; }
  for(const e of s.exhibits) if(e.zone && !s.zones.some(z => z.id === e.zone)) delete e.zone;
  for(const b of s.buildings) if(b.zone && !s.zones.some(z => z.id === b.zone)) delete b.zone;
  // a dart that was mid-flight when the park was saved never landed
  for(const l of s.safety.loose) if(l.status === "darting"){ l.status = "loose"; l.vet = null; }
  if(!s.science.tech.includes("bars")) s.science.tech.push("bars");   // metal bars are free in every park
  for(const k of Object.keys(freshScience())) if(s.science[k] === undefined) s.science[k] = freshScience()[k];
  for(const k of Object.keys(freshLedger())) if(s.today[k] === undefined) s.today[k] = 0;
  return s;
}

/* ---------- things the rest of the game asks about ---------- */

const PATH_HALF_WIDTH = 2.5;   // footpaths are 5 m wide
const REACH = 6;             // an exhibit or building within this many meters of a path counts as "on the path"

function speciesCounts(e){
  const m = new Map();
  for(const a of e.animals) m.set(a.sp, (m.get(a.sp)||0) + 1);
  return m;
}

const isService = p => p.type === "service";
const isWide = p => p.type === "wide";
const isTram = p => p.type === "tram";   // track: nobody walks it, guests ride it between stations
// What a ride costs a guest now, and the share of guests who'll pay it (everyone at the usual fare, nobody at double)
const tramFare = () => state.tramFare ?? TRAM.fare;
const tramWill = () => clamp(1 - PRICE_SENSE * (tramFare() - TRAM.fare) / TRAM.fare, 0, 1);
const tramNear = pts => state.paths.some(p => isTram(p) && lineShapeDist(p.points, pts) <= TRAM.reach);
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
  const usable = state.paths.filter(p => !isTram(p) && !(guestsOnly && isService(p)));
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
    // planted landscape plants from the animal's own period (in the exhibit's biome) make it at home too
    const away = kinds.filter(s => ERA_OF[s.period] !== flora && !(!e.viv && haveOf(e, s).plants > 0));
    if(!away.length){ target += FLORA_HAPPY.home; issues.push({bad:false, text:`At home among ${kinds.every(s => ERA_OF[s.period] === flora) ? FLORA[flora].plants : "plants from their own time"}.`}); }
    else { target += FLORA_HAPPY.away; issues.push({bad:true, text:`${away.map(s => s.name).join(", ")} ${away.length === 1 ? "lives" : "live"} among plants from another era. ${[...new Set(away.map(s => FLORA[ERA_OF[s.period]].label))].join(" or ")} plants would suit ${away.length === 1 ? "it" : "them"}.`}); }
    // grass comes from a Cenozoic planting (unless older groves give them something else), or from plain plant food standing in for Paleoflora
    const grassy = grassyFloor(e) || e.grassFed;
    const grazers = kinds.filter(s => foodType(s) === "paleoflora");
    const sick = grazers.filter(s => GRASS_INTOLERANT.includes(s.period)), picky = grazers.filter(s => s.period === "Cretaceous");
    if(grassy && sick.length){ target += GRASS_HIT.intolerant; issues.push({bad:true, text:`Sick from eating grass. ${sick.map(s => s.name).join(", ")} never evolved to digest it. ${grassyFloor(e) ? "Replant with older flora from CERES, or plant cycad or lycopod groves" : "Feed them Paleoflora from CERES"}.`}); }
    else if(grassy && picky.length){ target += GRASS_HIT.cretaceous; issues.push({bad:true, text:`${picky.map(s => s.name).join(", ")} would rather not eat grass. Older flora or Paleoflora suits them better.`}); }
  }
  // Dirt: a filthy exhibit makes animals miserable fast
  if(e.animals.length && (e.dirt || 0) > CLEAN.penaltyFrom){
    target -= (e.dirt - CLEAN.penaltyFrom) * CLEAN.penaltyPer;
    issues.push({bad:true, text:`Dirty (${Math.round(e.dirt)}%). ${state.staff.keepers.length ? "Keepers will muck it out when they're free." + (hasUpgrade("shovels") ? "" : " Shovels from the Tool Shed make it much faster.") : "Hire keepers to clean it."}`});
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
  // Water, rocks, groves and shelter: animals feel at home among what they like, and water lovers need water
  const hab = habitatScore(e); target += hab.delta; issues.push(...hab.issues);
  // Theme: animals that look right in the exhibit's theme are happier
  if(e.animals.length && themeOf(e).fits.length){
    const sh = themeFitShare(e);
    if(sh > 0){ target += THEME.fitHappy * sh; issues.push({bad:false, text:`${themeOf(e).label} suits ${sh === 1 ? "these animals" : "some of these animals"}.`}); }
  }
  // Sick and hurt animals drag the whole herd down
  // (mild illness nobody has spotted yet still hurts, but only shows as a vague hint)
  // (a chronic case, eased by contemporary medicine, counts for less)
  const sick = e.animals.reduce((n, a) => n + (a.sick ? (a.sick.chronic ? MODERN.chronicHappy : 1) : 0), 0);
  const chronic = e.animals.filter(a => a.sick && a.sick.chronic).length, known = e.animals.filter(noticed).length - chronic;
  if(sick) target -= Math.min(30, HEALTH.sickHappy * sick * Math.max(1, 4 / e.animals.length));
  if(known) issues.push({bad:true, text:`${known} sick or hurt. ${known === 1 ? "It needs" : "They need"} a vet. See Health below.`});
  if(chronic) issues.push({bad:true, text:`${chronic} with a chronic illness. Only their era's medicine from CERES cures it fully.`});
  else if(sick) issues.push({bad:true, text:"Some of the animals seem off. A vet's check-up would find out why."});
  return {area:a, need, target:clamp(target, 0, 100), issues, counts, exhibit:e};
}

// Rebuild all the worked-out numbers. Called whenever the park changes.
function recompute(){
  updatePower();
  const joined = connectedPathIds(true), joinedAll = connectedPathIds(false);
  const guestPaths = state.paths.filter(p => joined.has(p.id)), anyPaths = state.paths.filter(p => joinedAll.has(p.id));
  const near = (shape, list) => list.some(p => lineShapeDist(p.points, shape) <= REACH);
  const reach = {}, reports = {}, themes = {};
  // Guests reach exhibits and shops by footpath. Staff reach backstage buildings by footpath or service road.
  for(const e of state.exhibits){ reach[e.id] = near(e.points, guestPaths); reports[e.id] = exhibitReport(e); themes[e.id] = themeZone(e); }
  for(const b of state.buildings) reach[b.id] = near(b.points, BUILDINGS[b.type].dept ? anyPaths : guestPaths);

  // How much guests want to visit
  let appeal = 0, animals = 0, happySum = 0;
  const shown = new Set();
  for(const e of state.exhibits){
    const n = e.animals.length; if(!n) continue;
    animals += n; happySum += e.happy * n;
    if(!reach[e.id]) continue;
    for(const [sp, c] of reports[e.id].counts){
      appeal += SPECIES_BY_ID[sp].appeal * Math.sqrt(c) * (0.4 + 0.6 * e.happy / 100) * viewFactor(e, reach) * (1 + themeAppeal(e, themes[e.id]));
      shown.add(sp);
    }
  }
  const fair = fairTicket();
  const priceF = clamp(1 - 1.2 * (state.ticket - fair) / fair, 0.05, 1.3);
  // word of mouth: yesterday's guests tell their friends how it went
  const told = state.guestLog.mood;
  const wom = told == null ? 1 : clamp(1 + GUEST.wordOfMouth * (told - 60) / 40, 1 - GUEST.wordOfMouth, 1 + GUEST.wordOfMouth);
  const demand = appeal * (1 + 0.06 * shown.size) * 9 * (0.6 + 0.16 * state.rating) * priceF * fearFactor() * wom * weatherNow().guests;

  // How well the park looks after its guests: how happy they are when they leave.
  // Before anyone has left, guess from how many food stands and restrooms there are.
  const cap = need => state.buildings.filter(b => reach[b.id] && servesOf(b).includes(need)).reduce((s, b) => s + BUILDINGS[b.type].slots * (CLOSE_MIN - OPEN_MIN) / BUILDINGS[b.type].serveMin * 2.5, 0);
  const last = state.history.length ? state.history[state.history.length-1].guests : 0;
  const ref = Math.max(last, demand);
  const cover = c => ref > 0 ? Math.min(1, c / ref) : (c > 0 ? 1 : 0);
  const foodCover = cover(cap("hunger")), restCover = cover(cap("bladder"));
  const t = state.today, mood = t.moodN >= 20 ? t.moodSum / t.moodN : told;
  const comfort = mood == null ? (0.35 * foodCover + 0.35 * restCover) / .7 : clamp((mood - GUEST.badMood) / (GUEST.goodMood - GUEST.badMood), 0, 1);
  const gripe = topThoughts(3).find(x => !x.good && x.share >= .1);
  const comfortNote = mood == null ? `Food ${Math.round(foodCover*100)}%, restrooms ${Math.round(restCover*100)}% of what your guests need.`
    : `Guests leave ${Math.round(mood)}% happy. ${GUEST.goodMood}% gets full marks.${gripe ? ` ${Math.round(gripe.share * 100)}% say "${gripe.text}"` : ""}`;
  const avgHappy = animals ? happySum / animals : 0;
  // Stars come from five things: happy animals, looked-after guests, variety, how much there is to see, and what guests learn.
  // Each part is scored 0 to 1. Animals count as fully happy at 90% or more.
  const welfare = clamp((avgHappy - 30) / 60, 0, 1);
  const variety = Math.min(1, shown.size / 10), size = Math.min(1, appeal / 150);
  // what guests learned: today's leavers once enough have gone home, otherwise yesterday's
  const learnt = t.eduN >= 20 ? t.eduSum / t.eduN : state.guestLog.edu, education = learnt == null ? 0 : Math.min(1, learnt / EDU.full);
  const eduNote = learnt == null ? "Nobody has left yet. Info signs by exhibits, field guides, and an Education Center teach guests."
    : `Guests leave having learned ${Math.round(learnt)} on average. ${EDU.full} gets full marks.${learnt < EDU.full ? " Put info signs by your exhibits, sell field guides, or build an Education Center." : ""}`;
  const parts = animals ? [
    {label:"Animal happiness", score:welfare,              max:1.25, note:`${Math.round(avgHappy)}% average. 90% counts as full marks.`},
    {label:"Guest comfort",    score:comfort,              max:.75,  note:comfortNote},
    {label:"Variety",          score:variety,              max:1.25,  note:shown.size >= 10 ? `${shown.size} species on show. Full marks.` : `${shown.size} species on show. 10 gets full marks.`},
    {label:"Things to see",    score:size,                 max:1.25, note:"Bigger, happier groups of popular animals."},
    {label:"Education",        score:education,            max:.5,   note:eduNote},
  ] : [];
  let ratingTarget = parts.reduce((s, p) => s + p.score * p.max, 0);
  const pricey = state.ticket > fair * 1.3;
  if(pricey) ratingTarget -= 0.3;

  derived = {joined, joinedAll, reach, reports, themes, demand, fair, priceF, shown:shown.size, animals, appeal, variety, size, welfare, avgHappy, foodCover, restCover,
             comfort, mood, wom, learnt, parts, pricey, ratingTarget:clamp(ratingTarget, 0, 5)};
  checkThemes();   // themes unlock as soon as the park qualifies, including on load
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

function exhibitCost(pts, barrier){ return Math.round(perimeter(pts) * fenceRate(barrier || "wood") + area(pts) * COST.landPerSqM); }
function pathCost(pts, type){ return Math.round(lineLength(pts) * (type === "service" ? SERVICE_ROAD.perMeter : type === "wide" ? WIDE_PATH.perMeter : type === "tram" ? TRAM.perMeter : COST.pathPerMeter)); }
function refundFor(kind, item){
  if(kind === "exhibit") return Math.round((item.viv ? VIVARIUMS[item.viv].price : exhibitCost(item.points, item.barrier)) * COST.refundShare) + landRefund(item);
  if(kind === "land") return Math.round(LAND[item.type].price * COST.refundShare);
  if(kind === "water") return Math.round(waterCost(item.points) * COST.refundShare);
  if(kind === "path") return Math.round(pathCost(item.points, item.type) * COST.refundShare);
  if(kind === "building") return Math.round(BUILDINGS[item.type].price * COST.refundShare);
  return 0;
}

/* ---------- time passing ---------- */

let sinceRecompute = 0;

// Move the park forward by dtMin park minutes
function tick(dtMin){
  if(state.over) return;
  const m0 = state.minute, m1 = Math.min(CLOSE_MIN, m0 + dtMin);
  state.minute = m1;

  sinceRecompute += m1 - m0;
  if(sinceRecompute >= 20 || !derived){ recompute(); sinceRecompute = 0; }

  // Animals eat, keepers walk
  scienceTick(m1 - m0);
  ceresTick(m1 - m0);
  logiTick(m1 - m0);
  eatTick(m1 - m0);
  dirtTick(m1 - m0);
  keepersTick(m1 - m0);
  wearTick(m1 - m0);
  mechanicsTick(m1 - m0);
  vetsTick(m1 - m0);
  custodiansTick(m1 - m0);
  guardsTick(m1 - m0);
  escapesTick(m1 - m0);
  if(state.over) return;

  // Animal happiness drifts toward what the exhibit gives them
  for(const e of state.exhibits){
    if(!e.animals.length) continue;
    const target = derived.reports[e.id].target;
    e.happy += (target - e.happy) * Math.min(1, (m1 - m0) / 240);
  }

  // Guests arrive, walk around, eat, and go home
  guestsTick(m0, m1);

  if(m1 >= CLOSE_MIN) endDay();
}

function dailyCosts(){
  // partner parks bill for feeding while they do it; after that animal food is bought at the dock or made on site
  let feed = 0, wages = 0, upkeep = 0;
  for(const e of state.exhibits){
    if(freeFeeding()) for(const a of e.animals) feed += SPECIES_BY_ID[a.sp].food;
    upkeep += e.viv ? VIVARIUMS[e.viv].upkeep : area(e.points) * UPKEEP.exhibitPerSqM;
  }
  for(const p of state.paths) upkeep += lineLength(p.points) * (isService(p) ? SERVICE_ROAD.upkeepPerMeter : isWide(p) ? WIDE_PATH.upkeepPerMeter : isTram(p) ? TRAM.upkeepPerMeter : UPKEEP.pathPerMeter);
  for(const b of state.buildings) upkeep += BUILDINGS[b.type].upkeep;
  for(const [i, j] of PARCEL_CELLS) if(!parcelHome(i, j) && ownsParcel(i, j)) upkeep += parcelArea(i, j) * UPKEEP.landPerSqM;
  for(const p of state.health.ward) feed += SPECIES_BY_ID[p.a.sp].food;
  wages += state.staff.keepers.length * KEEPER.wage + state.staff.mechanics.length * MAINT.wage + state.staff.vets.length * VET.wage + state.staff.custodians.length * CUSTODIAN.wage + state.staff.guards.length * SECURITY.wage;
  // science staff are paid as research costs
  let research = 0;
  for(const [k, n] of Object.entries(state.science.crew)) research += n * SCIENTISTS[k].wage;
  return {feed:Math.round(feed), wages:Math.round(wages), upkeep:Math.round(upkeep), research};
}

/* ---------- science: ORACLE, GHOST, TAR, and CERES (the rest is in science.js) ---------- */

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

function endDay(){
  flushParties();
  recompute();

  const c = dailyCosts();
  spend(c.feed, "feed"); spend(c.wages, "wages"); spend(c.upkeep, "upkeep"); spend(c.research, "science");
  servicesNight();
  keepersNight();
  lodgingNight();
  logiNight();
  escapesNight();
  mechanicsNight();
  custodiansNight();
  guardsNight();
  healthNight();
  vetsNight();
  // today's weather has done its harm; tomorrow's forecast comes true
  rollWeather();
  if(weatherNow().happy) events.toast(`Tomorrow: ${weatherNow().label.toLowerCase()}. Animals without shelter will suffer${weatherNow().guests < .9 ? ", and fewer guests will come" : ""}.`, "bad");
  if(state.day + 1 === state.safety.escapesFrom) events.toast("Animals can start escaping tomorrow. Check each exhibit's barrier.", "bad");
  if(state.day + 1 === state.staff.feedFrom) events.toast("Partner parks stop feeding your animals tomorrow. Keepers need to take over.", "bad");
  if(state.day + 1 === state.logi.guestFrom) events.toast("From tomorrow, food stands and gift shops sell from their own stock. The dock orders it, and custodians carry it out. Build a Custodial Closet and hire one.", "bad");

  const before = state.rating;
  // Move a third of the way to the target each night, but at least 0.1 stars, so it actually gets there
  const gap = derived.ratingTarget - state.rating;
  const step = Math.sign(gap) * Math.min(Math.abs(gap), Math.max(0.1, Math.abs(gap) * 0.35));
  state.rating = clamp(state.rating + step, 0, 5);

  const t = state.today;
  const income = t.tickets + t.food + t.shop + t.sold + t.rewards + t.donations + t.edfees + t.rooms + t.fares;
  const costs = t.feed + t.wages + t.upkeep + t.built + t.animals + t.science + t.fines + t.repairs + t.supplies + t.cleaning + t.medicine;
  const report = {day:state.day, guests:t.guests, income, costs, net:income - costs, rating:state.rating, ratingBefore:before, ledger:{...t}};
  state.history.push({day:state.day, guests:t.guests, income, costs, net:income - costs, rating:+state.rating.toFixed(2)});
  if(state.history.length > 60) state.history.shift();
  guestsNight();

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
  checkThemes();
  for(const g of GOALS){
    if(state.goalsDone.includes(g.id)) continue;
    if(g.check(goalApi)){
      state.goalsDone.push(g.id);
      if(g.reward) earn(g.reward, "rewards");
      events.toast(`Grant awarded: ${g.text}. ${g.theme ? `You unlocked the ${THEMES[g.theme].label} theme.` : `You earned ${money(g.reward)}.`}`, "good");
    }
  }
  checkThemes();   // a grant can unlock a theme
}

/* ---------- formatting shared by the screen ---------- */

function money(n){ const s = "$" + Math.abs(Math.round(n)).toLocaleString(); return n < 0 ? "−" + s : s; }
function fmtArea(m2){ return `${Math.round(m2).toLocaleString()} m²`; }
function fmtClock(min){
  const h = Math.floor(min / 60), m = Math.floor(min % 60);
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

// Rating text rounded down, so "4.5" is never shown while 4.46 fails a 4.5 star gate.
function starTxt(r){ return (Math.floor(r * 10 + 1e-9) / 10).toFixed(1); }
