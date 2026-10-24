/* =====================================================================
   SIMULATION
   The rules of the game: time passing, guests arriving and spending,
   animal happiness, daily costs, star rating, and goals.
   Nothing in this file draws anything on screen.
   ===================================================================== */

const SPECIES_BY_ID = Object.fromEntries(SPECIES.map(s => [s.id, s]));
// How hard a species pulls guests in. Appeal is stretched so showstoppers dominate: at the pivot it counts as is, a Plateosaurus (8) counts about 4, a starter (3) under 1.
const speciesDraw = s => GUEST.drawPivot * Math.pow(s.appeal / GUEST.drawPivot, GUEST.drawPower);
const uid = p => p + Math.random().toString(36).slice(2, 9);

// The park plot: a 420 × 305 m rectangle, every corner on the 5 m grid
const PARK_PLOT = [[0,0],[420,0],[420,305],[0,305]];
const OLD_PLOT = [[0,18],[150,0],[410,8],[420,300],[-6,306]];

/* ---------- land for sale ---------- */
// Parcel (i, j) is the cell between PARCELS.xs[i..i+1] and ys[j..j+1]. The home plot's cells are always owned.
const PARCEL_YS = PARCELS.ys.concat(LEGACY_SOUTH_YS);
const ENTRANCE_X = 207.5;   // the middle of chunk column 41 (x 205 to 210), so the entrance building and its walk sit on one 5 m chunk
const SOUTH_LINE = PARCELS.ys[PARCELS.ys.length - 1];   // the entrance line: the park's hard southern edge
const parcelRect = (i, j) => [PARCELS.xs[i], PARCEL_YS[j], PARCELS.xs[i+1], PARCEL_YS[j+1]];
const parcelSouth = (i, j) => PARCEL_YS[j+1] > SOUTH_LINE;   // south of the entrance: never for sale
const parcelId = (i, j) => i + "," + j;
const PARCEL_CELLS = (() => { const out = []; for(let i = 0; i < PARCELS.xs.length - 1; i++) for(let j = 0; j < PARCEL_YS.length - 1; j++) out.push([i, j]); return out; })();
// Cells that can ever be offered: everything but the legacy rows south of the entrance
const SALE_CELLS = PARCEL_CELLS.filter(([i, j]) => !parcelSouth(i, j));
function parcelHome(i, j){ const [x0, y0, x1, y1] = parcelRect(i, j), h = PARCELS.home; return x0 >= h[0] && x1 <= h[2] && y0 >= h[1] && y1 <= h[3]; }
const ownsParcel = (i, j) => parcelHome(i, j) || (state.parcels || []).includes(parcelId(i, j));
const parcelArea = (i, j) => { const [x0, y0, x1, y1] = parcelRect(i, j); return (x1 - x0) * (y1 - y0); };
// How many cells out from the home plot: 1 touches it
function parcelRing(i, j){
  let best = 9;
  for(const [a, b] of PARCEL_CELLS) if(parcelHome(a, b)) best = Math.min(best, Math.max(Math.abs(a - i), Math.abs(b - j)));
  return best;
}
const parcelPrice = (i, j) => Math.round(parcelArea(i, j) * (PARCELS.rates[Math.min(parcelRing(i, j), PARCELS.rates.length - 1)]) * (1 + PARCELS.growth * parcelsBought()) / 100) * 100;
const parcelTouches = (i, j) => !parcelSouth(i, j) && [[1,0], [-1,0], [0,1], [0,-1]].some(([a, b]) => i + a >= 0 && j + b >= 0 && i + a < PARCELS.xs.length - 1 && j + b < PARCEL_YS.length - 1 && ownsParcel(i + a, j + b));
const parcelsBought = () => (state?.parcels || []).length;
function parcelProblem(i, j){
  if(ownsParcel(i, j)) return "You already own this land.";
  if(parcelSouth(i, j)) return "No land is for sale south of the entrance.";
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
  for(let j = 0; j < PARCEL_YS.length - 1; j++){
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
  const out = [], has = (a, c) => a >= 0 && c >= 0 && a < PARCELS.xs.length - 1 && c < PARCEL_YS.length - 1 && ownsParcel(a, c);
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
const events = { toast(){}, dayEnded(){}, changed(){}, gameOver(){}, died(){}, fx(){} };

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
const starsNeed = s => isStarter(s) || state.sandbox ? 0 : s.stars;
// A new animal's default name: its species tag and a 3-digit counter per species (never reused)
// Random but roughly balanced: usually the sex its species has fewer of across the park
function pickSex(sp, st){
  const s = st || state, n = {male:0, female:0};
  for(const a of [...s.exhibits.flatMap(e => e.animals), ...((s.science && s.science.ready) || [])]) if(a.sp === sp && n[a.sex] !== undefined) n[a.sex]++;
  if(n.male !== n.female && Math.random() < SEX.balance) return n.male < n.female ? "male" : "female";
  return Math.random() < .5 ? "male" : "female";
}
const sexMark = a => a.sex === "male" ? "M" : a.sex === "female" ? "F" : "";
// " (2 M, 1 F)" for one species in an exhibit's animal list
function sexSplit(e, sp){
  const l = e.animals.filter(a => a.sp === sp && a.sex), m = l.filter(a => a.sex === "male").length;
  return l.length ? ` <span class="meta">(${m} M, ${l.length - m} F)</span>` : "";
}
// Status in the pecking order, 0 (alpha) to 1: luck, DNA quality and being male
const pickRank = a => 1 - (Math.random() * SOCIAL.rank.rand + (a.q ?? 90) / 100 * SOCIAL.rank.q + (a.sex === "male" ? SOCIAL.rank.male : 0)) / (SOCIAL.rank.rand + SOCIAL.rank.q + SOCIAL.rank.male);
function nameAnimal(a, st){
  if(!a.sex) a.sex = pickSex(a.sp, st);
  if(a.rank == null) a.rank = pickRank(a);
  if(!a.face) a.face = Math.random() < .5 ? -1 : 1;   // which way its picture faces to start (1 right, -1 left), kept on the animal
  if(a.name) return a;
  const seq = (st || state).animalSeq || ((st || state).animalSeq = {}), n = (seq[a.sp] || 0) + 1;
  seq[a.sp] = n; a.name = `${a.sp.toUpperCase()}-${String(n).padStart(3, "0")}`;
  return a;
}
function freshLedger(){ return {guests:0, tickets:0, food:0, shop:0, feed:0, wages:0, upkeep:0, built:0, animals:0, science:0, sold:0, rewards:0, fines:0, repairs:0, servedFood:0, servedShop:0, moodSum:0, moodN:0, eduSum:0, eduN:0, donations:0, edfees:0, rooms:0, fares:0, supplies:0, cleaning:0, medicine:0}; }

function freshScience(){
  return {
    points:0,          // unspent points
    crew:{paleo:0, gene:0, botanist:0},  // science staff hired at each department
    tech:["bars"],           // everything the Research Lab has researched (TECH ids, plus "ref-<Period>" for refined medicine)
    projects:[],       // The Research Lab's research in progress: {kind, id, start, end}. Times are park minutes, see nowMin().
    unlocked:[],       // animals discovered (the Time Travel Lab's scouting turned them up), so drones can go back for their DNA
    dna:{},            // species, plant DNA or museum event id -> {genome: 0-100}
    drones:1,          // The Time Travel Lab's drones, one trip each at a time (the Time Travel Lab comes with one; buy more there)
    seen:{},           // site id (TIME_SITES) -> the animals scouting has turned up there; a site in here has been scouted
    trips:[],          // drones out: {kind: "scout" or "dig", site, sp (a dig's genome), bay (the drone), cost, start, end}
    reports:[],        // post-mission reports waiting at the Time Travel Lab, newest first: {id, site, kind, drone, day, lines: [[text, headline?]]}
    clones:[],         // The Genetics Lab's incubator bays: {id, sp, exhibitId, q, bay, start, end}. Projects, trips and Botany Lab beds carry a `bay` too, see science.js.
    ready:[],          // finished clones waiting for an exhibit: {id, sp, q}
    log:[]             // recent expedition results, newest first
  };
}

// The Botany Lab: Paleoflora fodder (stock), medicine on hand, landscape plants by period, growing beds, and which medicines it keeps stocked
function freshCeres(){ return {stock:0, meds:{medpal:0, medmes:0, medcen:0}, pots:{}, beds:[], auto:{cenozoic:false, mesozoic:false, paleozoic:false}}; }

// Themes: the one new builds use, and which are unlocked
function freshThemes(){ return {brush:"genesis", have:["genesis"]}; }

function newPark(){
  return {
    animalSeq:{},
    version:1, name:"New Park", biome:DEFAULT_PARK_BIOME, sandbox:false,
    money:START.money, ticket:START.ticket, tramFare:TRAM.fare, rating:START.rating,
    day:1, minute:60 / CLOCK_SCALE, clockV:3, vivDish:1, vivLay:1, vivScene:1, discoV:1, parkClosed:false,
    boundary:PARK_PLOT.map(p => p.slice()), parcels:[],
    gate:[ENTRANCE_X,305],
    exhibits:[], decor:[], water:[], waterGrid5:true, fences:[], fenceGrid:{}, fenceGrid5:true,
    paths:[], ...(() => { const m = mainWalkChunks([ENTRANCE_X,305]); return {pathChunks:m.C, pathFixed:m.F}; })(),
    buildings:[],
    science:freshScience(), staff:freshStaff(), safety:freshSafety(), ceres:freshCeres(), health:freshHealth(), zones:[], biomePaint:[], logi:freshLogi(), starters:pickStarters(), guestLog:freshGuestLog(), litter:{}, lodging:freshLodging(), weather:freshWeather(), themes:freshThemes(),
    today:freshLedger(), history:[], goalsDone:[], over:false
  };
}

// Bring older saves up to date with anything added since
// A save made while paths were tiles (that build was reverted) keeps its paths only as `tiles` {"cx,cy": {k, t, fixed}}, 5 m squares. Turn them back into lines: one through each pair of
// neighbouring tile centers, and a loose end runs on to the edge of its tile.
function linesFromTiles(T){
  const out = [], xy = k => k.split(",").map(Number), ctr = ([x, y]) => [x * 5 + 2.5, y * 5 + 2.5];
  const line = (key, id, a, b) => { const t = T[key], p = {id:"pt-" + id, name:t.fixed ? "Main walk" : "Path", points:[a, b]}; if(t.k === "wide" || t.k === "service" || t.k === "tram" || t.k === "bridge") p.type = t.k; if(t.t) p.theme = t.t; if(t.fixed) p.fixed = true; out.push(p); };
  for(const key of Object.keys(T)){
    const [x, y] = xy(key), c = ctr([x, y]), has = (dx, dy) => !!T[(x + dx) + "," + (y + dy)], n = [[1, 0], [0, 1], [-1, 0], [0, -1]].filter(([dx, dy]) => has(dx, dy));
    for(const [dx, dy] of [[1, 0], [0, 1]]) if(has(dx, dy)) line(key, key + ">" + dx + dy, c, ctr([x + dx, y + dy]));
    if(n.length === 0) line(key, key, [c[0] - 2.5, c[1]], [c[0] + 2.5, c[1]]);
    else if(n.length === 1) line(key, key + "e", c, [c[0] - n[0][0] * 2.5, c[1] - n[0][1] * 2.5]);
  }
  return out;
}

function upgradeSave(s){
  // minute is park minutes since the rollover. Saves from before the clock existed counted from opening at 8, so shift by that to keep every science stamp exact.
  if(s.clockV === 2) s.clockV = 3;   // the clock became 6 AM to 11 PM: same park minutes, so every stamp stays exact
  if(s.clockV !== 3){ s.minute = clamp((s.minute === undefined ? 480 : s.minute) - 480, 0, DAY_MIN - 1e-6); s.clockV = 3; }
  if(s.parkClosed === undefined) s.parkClosed = false;
  // vivariums feed from dishes now: every case already standing gets a free one, once (food it held loose becomes the dish's)
  if(s.vivDish !== 1){
    for(const e of s.exhibits || []) if(e.viv){
      const loose = e.stock || {}; e.stock = {};
      const cap = VIV_DISH.cap[e.viv], f = {id:uid("l-"), type:"vdish", x:0, y:0, cap, food:{}};
      const [x, y] = vivSlot(e); f.x = x; f.y = y;
      for(const [t, v] of Object.entries(loose)) if(v > 0.01 && !Object.keys(f.food).length) f.food[t] = Math.min(v, cap);   // a dish holds one food
      (e.land = e.land || []).push(f);
    }
    s.vivDish = 1;
  }
  // fittings used to fill the back-left first: lay each case out again from the front middle, once
  if(s.vivLay !== 1){ for(const e of s.exhibits || []) if(e.viv) relayViv(e); s.vivLay = 1; }
  // vivariums took plants one by one; a case that had any gets the scene of its biome and its animals' era (else the plants' own), and the plants go
  if(s.vivScene !== 1){
    for(const e of s.exhibits || []) if(e.viv){
      const flora = (e.land || []).filter(f => LAND[f.type] && LAND[f.type].flora);
      if(flora.length && !e.vivScene){
        const eras = (e.animals || []).map(a => SPECIES_BY_ID[a.sp] && ERA_OF[SPECIES_BY_ID[a.sp].period]).filter(Boolean);
        if(!eras.length) eras.push(...flora.map(f => LAND[f.type].flora).filter(x => VIV_SCENE.eras.includes(x)));
        const era = VIV_SCENE.eras.map(x => [x, eras.filter(y => y === x).length]).sort((a, b) => b[1] - a[1])[0][0];
        e.vivScene = {era, biome:BIOMES[e.biome] ? e.biome : DEFAULT_BIOME};
      }
      e.land = (e.land || []).filter(f => !flora.includes(f));
    }
    s.vivScene = 1;
  }
  for(const e of s.exhibits || []) if(e.viv && e.vivScene === undefined) e.vivScene = null;
  if(s.tiles && (!s.paths || !s.paths.length)) s.paths = linesFromTiles(s.tiles);
  // paths became sets of 1 m cells: line paths are rasterized once (the tram track stays a line); derived strips are never saved
  s.paths = (s.paths || []).filter(p => !p.d);
  if(!s.pathChunks){
    if(s.pathCells) s.pathChunks = chunksFromCells(s.pathCells);   // from the 1 m cell build: a chunk is path where most of its area was
    else migratePaths(s);
    delete s.pathCells; delete s.crossingsV;
  }
  if(!s.pathFixed) s.pathFixed = {};
  // the entrance sits in the middle of a 5 m chunk column, and the entrance walk is that one chunk wide (nothing the player built moves)
  if(!s.gate || s.gate[0] !== ENTRANCE_X){
    s.gate = [ENTRANCE_X, s.gate ? s.gate[1] : 305];
    const m = mainWalkChunks(s.gate);
    s.pathFixed = m.F;
    for(const k in m.C) s.pathChunks[k] = "g";
  } else if(!Object.keys(s.pathFixed).length){   // a save that never had a walk gets one; a walk the player bulldozed stays gone
    const m = mainWalkChunks(s.gate); s.pathFixed = m.F;
    for(const k in m.C) s.pathChunks[k] = "g";
  } else {
    const m = mainWalkChunks(s.gate); s.pathFixed = m.F;
    for(const k in m.F) s.pathChunks[k] = s.pathChunks[k] || "g";
  }
  // the old slanted plot became a rectangle on the 5 m grid; the entrance stays where it was
  if(JSON.stringify(s.boundary) === JSON.stringify(OLD_PLOT)) s.boundary = PARK_PLOT.map(p => p.slice());
  if(!s.parcels) s.parcels = [];
  if(!s.parcelRows4){ s.parcelRows4 = true; s.parcels = s.parcels.map(id => { const [i, j] = id.split(",").map(Number); return i + "," + (j + 2); }); }   // two more rows of land north: plot row numbers moved down by 2
  if(s.sandbox === undefined) s.sandbox = false;
  if(s.over === "shutdown") s.over = false;   // the deaths shutdown is gone
  if(s.debtWarned === undefined) s.debtWarned = false;
  if(!s.fenceGrid) s.fenceGrid = {};
  if(!s.fenceGrid5){ snapFencesToGrid5(s); s.fenceGrid5 = true; }   // fence pieces are 5 m now (older fence went down a meter a piece)
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
  if(!s.staff.calls) s.staff.calls = [];
  if(!s.staff.vets) s.staff.vets = [];
  if(!s.staff.custodians) s.staff.custodians = [];
  if(!s.staff.guards) s.staff.guards = [];
  if(!s.staff.atvs) s.staff.atvs = [];
  for(const k of ["keepers", "mechanics", "vets", "custodians", "guards"]) for(const w of s.staff[k]){ if(w.stamina === undefined) w.stamina = 100; if(w.morale === undefined) w.morale = STAFF.startMorale; }
  // Paleoflora became research: parks already using it keep what they had
  if(!s.ceres){
    s.ceres = {stock:0};
    const give = id => { if(!s.science.tech.includes(id)) s.science.tech.push(id); };
    if(s.buildings.some(b => b.type === "ceres")){ give("paleoflora"); s.ceres.stock = PALEOFLORA.perDay; }
  }
  for(const e of s.exhibits) if(!e.viv && e.cond === undefined){ e.cond = 100; e.inspected = {day:s.day, cond:100}; }
  // landscaping: rocks, groves and shelters (e.land) and drawn water (e.water) inside open exhibits.
  // Round ponds became drawn water: each one turns into a shape of the same size where it was.
  for(const e of s.exhibits){
    if(e.viv) continue;
    if(e.land === undefined) e.land = [];
    if(e.water === undefined) e.water = [];
    for(const f of e.land.filter(f => f.type === "pond")) e.water.push({id:f.id, points:circlePts(f.x, f.y, WATER.oldPondR, 12)});
    e.land = e.land.filter(f => LAND[f.type]);   // ponds, and the old generic plants, are gone
  }
  if(!s.themes) s.themes = freshThemes();
  // park landscaping: plants, rocks and statues (decor), water and open fences out in the park, and the ground the park is set in
  if(!BIOMES[s.biome]) s.biome = DEFAULT_PARK_BIOME;
  for(const k of ["decor", "water", "fences"]) if(!Array.isArray(s[k])) s[k] = [];
  // water sits on the 5 m chunk grid (older water was drawn corner by corner, or moved in 1 m steps)
  if(!s.waterGrid5){ snapWaterToGrid(s); s.waterGrid5 = true; }
  // the day each building went up (older themed buildings weather more); ones from before this count as old
  for(const b of s.buildings) if(b.day === undefined) b.day = 0;
  for(const b of s.buildings) if(BUILDINGS[b.type] && BUILDINGS[b.type].prop && b.rot === undefined) b.rot = 0;   // path objects: 45° turns the player gave them (see propart.js)
  // things only face north, south, east or west now: a path object left on a diagonal turns about its middle to the nearest of them
  for(const b of s.buildings){
    const t = BUILDINGS[b.type]; if(!t || !t.prop || !b.points || b.points.length !== 4) continue;
    const v = [b.points[3][0] - b.points[0][0], b.points[3][1] - b.points[0][1]], a = Math.atan2(-v[0], v[1]), q = Math.round(a / (Math.PI/2)) * Math.PI/2;
    if(Math.abs(a - q) < 1e-6) continue;
    const [cx, cy] = centroid(b.points); b.points = rectPts(cx, cy, t.w, t.d, q).map(p => [Math.round(p[0] * 1e6) / 1e6, Math.round(p[1] * 1e6) / 1e6]);
    b.rot = (Math.round((b.rot || 0) / 2) * 2) % 8;
  }
  // which way a building's door looks: older ones get the side facing their nearest path chunk (south when there is none)
  const chunkPts = Object.keys(s.pathChunks).map(k => k.split(",").map(Number));
  for(const b of s.buildings) if(BUILDINGS[b.type] && !BUILDINGS[b.type].prop && b.face === undefined && b.points && b.points.length >= 3){
    let best = 2, bd = Infinity;
    for(const f of [2, 1, 3, 0]){
      const [mx, my] = doorPoint({points:b.points, face:f});
      for(const [cx, cy] of chunkPts){ const d = Math.hypot(Math.max(cx * CHUNK - mx, 0, mx - (cx + 1) * CHUNK), Math.max(cy * CHUNK - my, 0, my - (cy + 1) * CHUNK)); if(d < bd - 1e-9){ bd = d; best = f; } }
    }
    b.face = best;
  }
  // food and gift carts shrank to fit their picture: keep the door wall where it is (so the path still reaches it) and pull the sides and back in. Ones placed at the new size before the door wall snapped to the grid slide onto it (doorOnGrid, map.js), up to half a meter.
  for(const b of s.buildings) if((b.type === "kiosk" || b.type === "cart") && b.points && b.points.length === 4){
    const t = BUILDINGS[b.type], P = b.points, i = faceEdge(P, b.face === undefined ? 2 : b.face), a = P[i], c = P[(i + 1) % 4], L = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
    if(Math.abs(L - t.w) < 1e-3 && Math.abs(Math.hypot(P[(i + 2) % 4][0] - c[0], P[(i + 2) % 4][1] - c[1]) - t.d) < 1e-3){ b.points = doorOnGrid(P, b.face === undefined ? 2 : b.face, b.type); continue; }
    const ux = (c[0] - a[0]) / L, uy = (c[1] - a[1]) / L, [cx, cy] = centroid(P), mx = (a[0] + c[0]) / 2, my = (a[1] + c[1]) / 2, out = -uy * (mx - cx) + ux * (my - cy) < 0 ? -1 : 1;
    b.points = rectPts(mx + uy * out * t.d / 2, my - ux * out * t.d / 2, t.w, t.d, Math.atan2(uy, ux)).map(p => [Math.round(p[0] * 1e6) / 1e6, Math.round(p[1] * 1e6) / 1e6]);
  }
  // a north-facing food or gift cart backing onto a path sits with backOver (map.js) of its box over the path: ones saved further on or off it slide there, once (gift carts got their picture after food carts, so their own flag)
  for(const [flag, type] of [["cardBack2", "kiosk"], ["cartBack", "cart"]]) if(!s[flag]){
    const over = BLD_PICS[type].backOver;
    for(const b of s.buildings) if(b.type === type && b.face === 0 && b.points){
      const bb = bbox(b.points), Y = Math.round((bb.y0 + over) / CHUNK) * CHUNK, cx = Math.floor((bb.x0 + bb.x1) / 2 / CHUNK), k = s.pathChunks[`${cx},${Y / CHUNK - 1}`];
      if(Math.abs(bb.y0 + over - Y) > 2.5 || Math.abs(bb.y0 + over - Y) < 1e-6 || !(k === "g" || k === "b") || s.pathChunks[`${cx},${Y / CHUNK}`]) continue;
      const P = b.points.map(([x, y]) => [x, Math.round((y + Y - bb.y0 - over) * 1e6) / 1e6]);
      if(!s.buildings.some(o => o !== b && shapesOverlap(P, o.points)) && !s.exhibits.some(e => shapesOverlap(P, e.points))) b.points = P;
    }
    s[flag] = true;
  }
  for(const b of s.buildings) if(b.type === "edcenter" && !b.shows) b.shows = [];
  if(s.science && s.science.hatchDay === undefined) s.science.hatchDay = -1;
  for(const b of s.buildings) if(b.type === "edcenter" && !b.mods) b.mods = [];   // modules and focus, see services.js   // museum attractions, see services.js
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
  if(s.ceres.meds === undefined) s.ceres.meds = {medpal:0, medmes:0, medcen:0};
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
  const hasT = id => sc.tech.includes(id), giveDna = era => { for(const f of Object.values(PLANT_DNA)) if(f.era === era && !sc.dna[f.id]) sc.dna[f.id] = {genome:100}; };
  if(hasT("mesoplant")) giveDna("mesozoic");
  if(hasT("paleoplant")) giveDna("paleozoic");
  if(hasT("paleoflora") && !Object.values(PLANT_DNA).some(f => sc.dna[f.id] && sc.dna[f.id].genome >= 100)) giveDna("mesozoic");
  if(!s.ceres.pots) s.ceres.pots = {};
  if(!s.ceres.beds) s.ceres.beds = [];
  // science jobs moved into bays, one per scientist. Running jobs keep a bay; queued ones and extra incubators are cancelled and paid back.
  let back = 0;
  for(const k of ["projects", "trips", "clones", "log"]) if(!sc[k]) sc[k] = [];
  // genome quality is gone (clone health follows how complete the genome is): drop it, and pay back Time Travel Lab quality upgrades
  for(const d of Object.values(sc.dna)) delete d.quality;
  for(const [id, pts] of [["ghostq1", 40], ["ghostq2", 90]]){
    if(sc.tech.includes(id)){ sc.tech = sc.tech.filter(t => t !== id); sc.points = (sc.points || 0) + pts; }
    const live = sc.projects.filter(p => p.kind === "tech" && p.id === id);
    for(const p of live){ sc.points = (sc.points || 0) + (p.cost || pts); sc.projects.splice(sc.projects.indexOf(p), 1); }
  }
  for(const [kind, jobs] of Object.entries({paleo:sc.projects, temporal:sc.trips, gene:sc.clones, botanist:s.ceres.beds})){
    const n = sc.crew[kind] || 0, taken = new Set(jobs.filter(j => j.bay !== undefined).map(j => j.bay));
    for(const j of jobs.filter(x => x.bay === undefined).sort((a, c) => a.start - c.start)){
      let i = j.lane !== undefined && j.lane < n && !taken.has(j.lane) ? j.lane : -1;
      for(let k = 0; i < 0 && k < n; k++) if(!taken.has(k)) i = k;
      delete j.lane;
      if(i < 0){ jobs.splice(jobs.indexOf(j), 1); const r = jobRefund(kind, j); sc.points += r.points || 0; s.money += r.money || 0; back++; continue; }
      j.bay = i; taken.add(i);
    }
  }
  if(back) sc.log.unshift({day:s.day, text:`Science now runs one job per scientist. ${back} queued job${back === 1 ? " was" : "s were"} cancelled and paid back.`, ok:true});
  // plant DNA, and the plants the Botany Lab grows, became per period (and exhibit planting stock went away): split what an era had across its periods
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
  for(const p of s.health.ward) if(p.med === undefined){ p.med = p.dosed ? "era" : null; delete p.dosed; }
  // before logistics: food was unlimited at stations. Parks already past partner feeding get two more days to build a dock,
  // and any medicine waiting at the Botany Lab moves to the PMC
  if(!s.starters) s.starters = ["arth", "lyst", "hyps"];   // the old fixed set
  if(!s.zones) s.zones = [];
  if(!Array.isArray(s.biomePaint)) s.biomePaint = [];   // ground paint (js/biomepaint.js)
  if(!s.guestLog) s.guestLog = freshGuestLog();
  if(!s.guestLog.vandal) s.guestLog.vandal = freshVandalLog();
  if(s.guestLog.edu === undefined) s.guestLog.edu = null;
  for(const e of s.exhibits || []) if(!e.glog) e.glog = freshExLog();   // per-exhibit guest log (guests.js)
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
  // contemporary medicine used to be a counter the suppliers refilled; now it is stock in the PMC
  if(s.health.cmeds !== undefined){ const pmc = s.buildings.find(b => b.type === "pmc"); if(pmc && s.health.cmeds > 0){ pmc.store = pmc.store || {}; pmc.store[CMED] = (pmc.store[CMED] || 0) + s.health.cmeds; } delete s.health.cmeds; }
  // medicine used to be one good. Split what's on hand across the eras the Research Lab has researched (else Cenozoic), so nothing is lost.
  {
    const eras = Object.keys(MED_TECH).filter(e => s.science.tech.includes(MED_TECH[e])), into = (eras.length ? eras : ["cenozoic"]).map(e => MED_GOOD[e]);
    const split = (n, put) => { const each = Math.floor(n / into.length); into.forEach((g, i) => put(g, i === 0 ? n - each * (into.length - 1) : each)); };
    for(const b of s.buildings) if(b.store && b.store.meds !== undefined){ const n = b.store.meds; delete b.store.meds; split(n, (g, v) => { b.store[g] = (b.store[g] || 0) + v; }); }
    if(typeof s.ceres.meds !== "object" || s.ceres.meds === null){ const n = s.ceres.meds || 0; s.ceres.meds = {medpal:0, medmes:0, medcen:0}; split(n, (g, v) => { s.ceres.meds[g] += v; }); }
    for(const g of MED_GOODS) if(s.ceres.meds[g] === undefined) s.ceres.meds[g] = 0;
    for(const r of s.staff.keepers.concat(s.staff.custodians || [])) if(r.carry && r.carry.type === "meds") r.carry.type = into[0];
  }
  // stock for stands and shops became physical: older parks get a few more days of direct deliveries
  if(s.logi.trucks === undefined) s.logi.trucks = Math.max(0, Math.floor(s.minute / LOGI.truckMin));
  if(s.logi.guestFrom === undefined){ s.logi.guestFrom = Math.max(GUEST_GOODS_FROM, s.day + 3); s.logi.used = {}; s.logi.usedLast = {}; if(s.buildings.some(b => BUILDINGS[b.type].kind)) s.logi.guestNotice = true; }
  for(const e of s.exhibits) if(e.zone && !s.zones.some(z => z.id === e.zone)) delete e.zone;
  for(const b of s.buildings) if(b.zone && !s.zones.some(z => z.id === b.zone)) delete b.zone;
  // a dart that was mid-flight when the park was saved never landed
  for(const l of s.safety.loose) if(l.status === "darting"){ l.status = "loose"; l.vet = null; }
  // discovery moved to the Time Travel Lab's sites and drones. Temporal Researchers become drones (their wages stop), every site holding an
  // animal already unlocked starts scouted with those animals seen, Research Lab species projects are paid back, and trips still out
  // are given a site so they land as expeditions.
  if(s.discoV !== 1){
    sc.drones = clamp(Math.max(sc.crew.temporal || 0, sc.trips.length, 1), 1, DRONES.max);
    delete sc.crew.temporal;
    sc.seen = sc.seen || {}; sc.reports = sc.reports || [];
    for(const site of TIME_SITES){ const got = (site.fauna || []).filter(f => sc.unlocked.includes(f)); if(got.length) sc.seen[site.id] = got; }
    for(const p of sc.projects.filter(p => p.kind === "species")){ sc.points += p.cost || 0; sc.projects.splice(sc.projects.indexOf(p), 1); }
    const used = new Set();
    for(const t of sc.trips){
      if(t.kind) continue;
      const inPeriod = TIME_SITES.filter(x => !x.event && epochOf(x.from).period === t.period);
      const site = MUSEUM_BY_ID[t.sp] ? TIME_SITES.find(x => x.event === t.sp)
        : PLANT_DNA_BY_ID[t.sp] ? inPeriod.find(x => sc.seen[x.id]) || inPeriod[0]
        : sitesOf(t.sp).find(x => sc.seen[x.id]) || sitesOf(t.sp)[0];
      if(site && !MUSEUM_BY_ID[t.sp] && !sc.seen[site.id]) sc.seen[site.id] = [];
      Object.assign(t, {kind:"dig", site:site ? site.id : t.period, cost:0}); delete t.period;
      if(t.bay === undefined || t.bay >= sc.drones || used.has(t.bay)){ let k = 0; while(used.has(k)) k++; t.bay = k; }
      used.add(t.bay);
    }
    s.discoV = 1;
  }
  if(!s.science.tech.includes("bars")) s.science.tech.push("bars");   // metal bars are free in every park
  for(const k of Object.keys(freshScience())) if(s.science[k] === undefined) s.science[k] = freshScience()[k];
  for(const k of Object.keys(freshLedger())) if(s.today[k] === undefined) s.today[k] = 0;
  // animals from before behavior get a fresh set of needs (behavior.js)
  for(const e of s.exhibits) for(const a of e.animals){ if(!a.need) a.need = freshNeeds(); delete a.inside; delete a.gene; }   // who is indoors isn't saved: the shelters fill up again as the day goes
  // every animal gets a name (COTY-001); the counter per species is kept so numbers are never reused
  if(!s.animalSeq) s.animalSeq = {};
  { const all = [...s.exhibits.flatMap(e => e.animals), ...((s.science && s.science.ready) || []), ...((s.safety && s.safety.loose) || []), ...(((s.health && s.health.ward) || []).map(p => p.a)), ...(((s.staff && s.staff.transfers) || []).map(t => t.cargo).filter(Boolean))];
    for(const a of all) if(a.name) { const m = /^(.*)-(\d+)$/.exec(a.name); if(m && m[1] === a.sp.toUpperCase()) s.animalSeq[a.sp] = Math.max(s.animalSeq[a.sp] || 0, +m[2]); }
    for(const a of all) if(!a.name) nameAnimal(a, s); }
  // every animal gets a sex (balanced per species), including ones in holding, loose, in the ward, on a transfer or still cloning
  { const all = [...s.exhibits.flatMap(e => e.animals), ...((s.science && s.science.ready) || []), ...((s.safety && s.safety.loose) || []), ...(((s.health && s.health.ward) || []).map(p => p.a)), ...(((s.staff && s.staff.transfers) || []).map(t => t.cargo).filter(Boolean)), ...((s.science && s.science.clones) || [])];
    for(const a of all) if(!a.sex) a.sex = pickSex(a.sp, s);
    for(const a of all) if(a.rank == null) a.rank = pickRank(a); }
  snapFootprints(s);   // plants and rocks take whole-cell squares (landscape.js)
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
const isBridge = p => p.type === "bridge";   // a wooden footpath, the only one that crosses water
// What a ride costs a guest now, and the share of guests who'll pay it (everyone at the usual fare, nobody at double)
const tramFare = () => state.tramFare ?? TRAM.fare;
const tramWill = () => clamp(1 - PRICE_SENSE * (tramFare() - TRAM.fare) / TRAM.fare, 0, 1);
const tramNear = pts => state.paths.some(p => isTram(p) && lineShapeDist(p.points, pts) <= TRAM.reach);
const vivRank = size => ({S:1, M:2, L:3})[size] || 0;
// A diet can be written as one word or a list; treat it as a list everywhere
for(const s of SPECIES) if(!Array.isArray(s.diet)) s.diet = [s.diet];
const eats = (s, d) => s.diet.includes(d);
const dietText = s => s.diet.map(d => DIETS[d] || d).join(" and ") + (s.predator ? ", predator" : "") + (s.semi ? ", semi-aquatic" : "") + (s.bug ? ", bug" : "");

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
  // path cells: the derived strips are joined by a flood fill over the cells; any loose line paths join the old way
  const strips = state.paths.filter(p => p.d), joined = new Set(joinedStrips(guestsOnly)), queue = strips.filter(p => joined.has(p.id));
  const usable = state.paths.filter(p => !p.d && !isTram(p) && !(guestsOnly && isService(p)));
  if(!usable.length) return joined;
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
    const kinds = [...counts.keys()].map(sp => SPECIES_BY_ID[sp]);
    // Cenozoic animals are at home on the grass underfoot; older ones need plants from their own period (in the exhibit's biome)
    const away = kinds.filter(s => ERA_OF[s.period] !== "cenozoic" && !(haveOf(e, s).plants > 0));
    if(!away.length){ target += FLORA_HAPPY.home; issues.push({bad:false, text:`At home among ${kinds.every(s => ERA_OF[s.period] === "cenozoic") ? FLORA.cenozoic.plants : "plants from their own time"}.`}); }
    else { target += FLORA_HAPPY.away; issues.push({bad:true, text:`${away.map(s => s.name).join(", ")} ${away.length === 1 ? "lives" : "live"} among plants from another era. Plants from ${away.length === 1 ? "its" : "their"} own period would suit ${away.length === 1 ? "it" : "them"}.`}); }
    // old plant-eaters get sick on plants they never evolved for: Cenozoic planting, a grassland biome, or grass hay standing in for Paleoflora
    const grazers = kinds.filter(s => foodType(s) === "paleoflora");
    const sick = grazers.filter(s => grassSick(e, s) > 0), picky = grazers.filter(s => s.period === "Cretaceous" && grassShare(e, s) > 0);
    const cure = e.grassFed ? "Feed them Paleoflora from the Botany Lab" : biomeOf(e) === "grassland" ? "Regrade the exhibit to a biome from their own time" : "Pull out the Cenozoic plants, or plant groves from their own era";
    if(sick.length){ target += GRASS_HIT.intolerant * Math.max(...sick.map(s => grassSick(e, s))); issues.push({bad:true, text:`Eating plants it never evolved for. ${sick.map(s => s.name).join(", ")} can't digest grass. ${cure}.`}); }
    else if(picky.length){ target += GRASS_HIT.cretaceous * Math.max(...picky.map(s => grassShare(e, s))); issues.push({bad:true, text:`${picky.map(s => s.name).join(", ")} would rather not eat grass. ${cure}.`}); }
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
    if(empty.length){ target -= 40; issues.push({bad:true, text:`Hungry. They're out of ${empty.join(" and ")}. ${dishText(e) || (gateCheck(e).ok ? "Keepers need to bring more." : gateCheck(e).text)}`}); }
    else if(low.length) issues.push({bad:true, text:`Running low on ${low.join(" and ")}.`});
    if(!empty.length && dishText(e)){ target -= 12 * (1 - vivServed(e)); issues.push({bad:true, text:`Some can't reach a dish. ${dishText(e)}`}); }
  }
  // Any pair of species that can't live together causes trouble (counted once per exhibit)
  const kinds = [...counts.keys()].map(sp => SPECIES_BY_ID[sp]);
  let fight = null;
  for(let i = 0; i < kinds.length && !fight; i++) for(let j = i + 1; j < kinds.length && !fight; j++) fight = conflict(kinds[i], kinds[j]);
  if(fight){ target -= 45; issues.push({bad:true, text:`Fighting. ${fight}`}); }
  // Water, rocks, groves and shelter: animals feel at home among what they like, and water lovers need water
  const hab = habitatScore(e); target += hab.delta; issues.push(...hab.issues);
  // Behavior: stressed and bored animals are unhappy, and pacing and hiding show it
  const beh = behaviorScore(e); target += beh.delta; issues.push(...beh.issues);
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
  if(chronic) issues.push({bad:true, text:`${chronic} with a chronic illness. Only their era's medicine from the Botany Lab cures it fully.`});
  else if(sick) issues.push({bad:true, text:"Some of the animals seem off. A vet's check-up would find out why."});
  return {area:a, need, target:clamp(target, 0, 100), issues, counts, exhibit:e};
}

// Rebuild all the worked-out numbers. Called whenever the park changes.
function recompute(){
  syncPathStrips();
  updatePower();
  const joined = connectedPathIds(true), joinedAll = connectedPathIds(false);
  const loose = p => !p.d && !isTram(p);   // loose lines (tests push them) still count the old way; cells are done by nearCells
  const guestPaths = state.paths.filter(p => joined.has(p.id) && loose(p)), anyPaths = state.paths.filter(p => joinedAll.has(p.id) && loose(p));
  // path cells: a shape is on the path when it is within REACH of a path's middle, which is REACH - 2.5 m (half the width) from its edge
  const nearG = shape => nearCells(shape, REACH - PATH_HALF_WIDTH, true), nearA = shape => nearCells(shape, REACH - PATH_HALF_WIDTH, false);
  const near = (shape, list, staff) => (staff ? nearA : nearG)(shape) || list.some(p => lineShapeDist(p.points, shape) <= REACH);
  const reach = {}, reports = {}, themes = {};
  // Guests reach exhibits and shops by footpath. Staff reach backstage buildings by footpath or service road.
  for(const e of state.exhibits){ reach[e.id] = near(e.points, guestPaths, false); reports[e.id] = exhibitReport(e); themes[e.id] = themeZone(e); }
  for(const b of state.buildings){ const staff = !!BUILDINGS[b.type].dept; reach[b.id] = (!BUILDINGS[b.type].prop && doorNear(b, !staff)) || near(b.points, staff ? anyPaths : guestPaths, staff); }   // the door side first, then any side

  // How much guests want to visit
  let appeal = 0, animals = 0, happySum = 0;
  const shown = new Set();
  for(const e of state.exhibits){
    const n = e.animals.length; if(!n) continue;
    animals += n; happySum += e.happy * n;
    if(!reach[e.id]) continue;
    for(const [sp, c] of reports[e.id].counts){
      appeal += speciesDraw(SPECIES_BY_ID[sp]) * Math.sqrt(c) * (0.4 + 0.6 * e.happy / 100) * viewFactor(e, reach) * (1 + themeAppeal(e, themes[e.id])) * liveliness(e);
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
  const cap = need => state.buildings.filter(b => reach[b.id] && servesOf(b).includes(need)).reduce((s, b) => s + BUILDINGS[b.type].slots * DAY_MIN / BUILDINGS[b.type].serveMin * 2.5, 0);
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

// Sandbox mode (state.sandbox, toggled in the park office): everything is free and money never drops
const SANDBOX_MONEY = 999999999, SANDBOX_POINTS = 999999;
function canAfford(cost){ return state.sandbox || state.money >= cost; }
function spend(cost, kind){ if(!state.sandbox) state.money -= cost; state.today[kind] += cost; checkBankrupt(); }
function earn(amount, kind){ if(!state.sandbox) state.money += amount; state.today[kind] += amount; }
// Bankruptcy is the only game over: debt past BANKRUPT. One warning at half of it.
function checkBankrupt(){
  if(state.sandbox || state.over) return;
  if(state.money <= -BANKRUPT){ state.over = true; events.gameOver(); return; }
  if(state.money > -BANKRUPT / 2) state.debtWarned = false;
  else if(!state.debtWarned){
    state.debtWarned = true;
    events.toast(`Careful: you're ${money(-state.money)} in debt. The park goes bankrupt at ${money(BANKRUPT)}.`, "bad");
  }
}

function exhibitCost(pts, barrier){ return Math.round(perimeter(pts) * fenceRate(barrier || "wood") + area(pts) * COST.landPerSqM); }
function pathCost(pts, type){ return Math.round(lineLength(pts) * (type === "service" ? SERVICE_ROAD.perMeter : type === "wide" ? WIDE_PATH.perMeter : type === "tram" ? TRAM.perMeter : type === "bridge" ? BRIDGE.perMeter : COST.pathPerMeter)); }
// An open fence line: the fence alone, by the meter
const fenceLineCost = (pts, barrier) => Math.round(lineLength(pts) * fenceRate(barrier || "wood"));
function refundFor(kind, item){
  if(kind === "exhibit" && item.grid) return Math.round((area(item.points) * COST.landPerSqM + ownPieceCost(item)) * COST.refundShare) + landRefund(item);
  if(kind === "exhibit") return Math.round((item.viv ? VIVARIUMS[item.viv].price : exhibitCost(item.points, item.barrier)) * COST.refundShare) + landRefund(item);
  if(kind === "land") return Math.round(LAND[item.type].price * COST.refundShare);
  if(kind === "water") return Math.round(waterCost(item.points) * COST.refundShare);
  if(kind === "path") return Math.round(pathCost(item.points, item.type) * COST.refundShare);
  if(kind === "fence") return Math.round(fenceLineCost(item.points, item.barrier) * COST.refundShare);
  if(kind === "building") return Math.round(BUILDINGS[item.type].price * COST.refundShare);
  return 0;
}

/* ---------- time passing ---------- */

let sinceRecompute = 0;

// Move the park forward by dtMin park minutes. A big step is cut at the daily rollover (the rest carries into the next day, not lost)
// and at the next science job's end, so every job finishes at the minute its `end` passes, however long the step is.
function tick(dtMin){
  if(state.over) return;
  if(!(dtMin > 0)) return tickStep(dtMin);
  let left = dtMin;
  for(let guard = 0; left > 1e-9 && !state.over && guard < 5000; guard++){
    let st = Math.min(left, DAY_MIN - state.minute);
    const next = scienceNext();
    if(next > 1e-6 && next < st) st = next;
    tickStep(st); left -= st;
  }
}
function tickStep(dtMin){
  const m0 = state.minute, m1 = Math.min(DAY_MIN, m0 + dtMin);
  state.minute = m1;

  sinceRecompute += m1 - m0;
  if(sinceRecompute >= 20 || !derived){ recompute(); sinceRecompute = 0; }

  // Animals eat, keepers walk
  scienceTick(m1 - m0);
  ceresTick(m1 - m0);
  logiTick(m1 - m0);
  eatTick(m1 - m0);
  behaviorTick(m1 - m0);
  dirtTick(m1 - m0);
  keepersTick(m1 - m0);
  wearTick(m1 - m0);
  mechanicsTick(m1 - m0);
  vetsTick(m1 - m0);
  custodiansTick(m1 - m0);
  guardsTick(m1 - m0);
  staffTick(m1 - m0);
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

  if(m1 >= DAY_MIN) endDay();
}

function dailyCosts(){
  // partner parks bill for feeding while they do it; after that animal food is bought at the dock or made on site
  let feed = 0, wages = 0, upkeep = 0;
  for(const e of state.exhibits){
    if(freeFeeding()) for(const a of e.animals) feed += SPECIES_BY_ID[a.sp].food;
    upkeep += e.viv ? VIVARIUMS[e.viv].upkeep + landOf(e).reduce((n, f) => n + ((LAND[f.type] || {}).upkeep || 0), 0) : area(e.points) * UPKEEP.exhibitPerSqM;   // a vivarium's lamps run on the bill
  }
  for(const k of Object.values(pathChunks())) upkeep += pathChunkUpkeep(k);
  for(const p of state.paths) if(!p.d) upkeep += lineLength(p.points) * (isService(p) ? SERVICE_ROAD.upkeepPerMeter : isWide(p) ? WIDE_PATH.upkeepPerMeter : isTram(p) ? TRAM.upkeepPerMeter : isBridge(p) ? BRIDGE.upkeepPerMeter : UPKEEP.pathPerMeter);
  for(const b of state.buildings) upkeep += BUILDINGS[b.type].upkeep + eduUpkeep(b);
  for(const [i, j] of PARCEL_CELLS) if(!parcelHome(i, j) && ownsParcel(i, j)) upkeep += parcelArea(i, j) * UPKEEP.landPerSqM;
  for(const p of state.health.ward) feed += SPECIES_BY_ID[p.a.sp].food;
  wages += state.staff.keepers.length * KEEPER.wage + state.staff.mechanics.length * MAINT.wage + state.staff.vets.length * VET.wage + state.staff.custodians.length * CUSTODIAN.wage + state.staff.guards.length * SECURITY.wage;
  // science staff are paid as research costs
  let research = 0;
  for(const [k, n] of Object.entries(state.science.crew)) research += n * SCIENTISTS[k].wage;
  return {feed:Math.round(feed), wages:Math.round(wages), upkeep:Math.round(upkeep), research};
}

/* ---------- science: Research Lab, the Time Travel Lab, the Genetics Lab, and the Botany Lab (the rest is in science.js) ---------- */

const PERIOD_BY_ID = Object.fromEntries(TIME_PERIODS.map(p => [p.id, p]));
const rand = (a, b) => a + Math.random() * (b - a);

// A department only works when it's built and staff can reach it
function dept(type){ const b = state.buildings.find(x => x.type === type); return b && isReachable(b) ? b : null; }
function hasDept(type){ return state.buildings.some(x => x.type === type); }
function deptProblem(type){
  if(!hasDept(type)) return `Build ${BUILDINGS[type].one} first.`;
  if(!dept(type)) return `${BUILDINGS[type].one.replace(/^the/, "The")} isn't connected. Run a path or service road from the entrance to it.`;
  return null;
}
function logScience(text, ok){ state.science.log.unshift({day:state.day, text, ok}); state.science.log.length = Math.min(state.science.log.length, 8); }

function endDay(){
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
  staffNight();
  healthNight();
  vetsNight();
  behaviorNight();
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
  state.minute = 0;
  shiftStamps(DAY_MIN);
  state.today = freshLedger();
  checkGoals();

  checkBankrupt();
  recompute();
  events.dayEnded(report);
  events.changed();
}

/* ---------- goals ---------- */

function currentGoal(){ return activeGoals().find(g => !state.goalsDone.includes(g.id)) || null; }
function checkGoals(){
  if(!derived) recompute();
  checkThemes();
  for(const g of activeGoals()){
    if(state.goalsDone.includes(g.id)) continue;
    if(g.check(goalApi)){
      state.goalsDone.push(g.id);
      if(g.reward) earn(g.reward, "rewards");
      events.toast(`Grant awarded: ${g.text}. ${g.theme ? `You unlocked the ${THEMES[g.theme].label} theme.` : `You earned ${money(g.reward)}.`}${grantStatue(g) ? ` You can now place the ${LAND["st-" + g.statue].label.replace(/ Statue$/, "")} statue from Landscaping.` : ""}`, "good");
    }
  }
  checkThemes();   // a grant can unlock a theme
}

/* ---------- formatting shared by the screen ---------- */

// Hidden dev-mode switch. Lives in localStorage only, never in `state`, so a shared save can't carry it.
// devFlag holds it for this visit when the page can't keep storage (it is still never saved in `state`).
let devFlag = null;
function devMode(){ if(devFlag !== null) return devFlag; try{ return localStorage.getItem("genesis-dev") === "1"; }catch{ return false; } }
function money(n){ const s = "$" + Math.abs(Math.round(n)).toLocaleString(); return n < 0 ? "−" + s : s; }
function fmtArea(m2){ return `${Math.round(m2).toLocaleString()} m²`; }
// state.day to a calendar date: {d, m (1 based), y}, and "3 Mar Y2" for the HUD and logs. Days before 1 count as day 1.
function dateOf(day){
  const n = Math.max(0, Math.floor(day) - 1), dpm = CALENDAR.daysPerMonth, mpy = CALENDAR.months.length;
  return {d:n % dpm + 1, m:Math.floor(n / dpm) % mpy + 1, y:CALENDAR.startYear + Math.floor(n / (dpm * mpy))};
}
function fmtDate(day){ const t = dateOf(day); return `${t.d} ${CALENDAR.months[t.m - 1]} Y${t.y}`; }
// The 24 h clock, in clock minutes of the day, for a state.minute (park minutes since the rollover), and back
const clockMin = (m = state.minute) => (ROLLOVER_CLOCK + m * CLOCK_SCALE) % 1440;
const minuteAtClock = c => (((c - ROLLOVER_CLOCK) % 1440) + 1440) % 1440 / CLOCK_SCALE;
// How dark it is, 0 (day) to NIGHT.dark (night), in steps so the map overlay only changes now and then. Dusk and dawn each fade over NIGHT.fade clock hours.
function nightDark(c = clockMin()){
  const h = c / 60, f = NIGHT.fade, d = Math.max(0, Math.min(1, h < DAWN_CLOCK / 60 + NIGHT.dawnFade ? (DAWN_CLOCK / 60 + NIGHT.dawnFade - h) / NIGHT.dawnFade : h >= DUSK_CLOCK / 60 - f ? (h - (DUSK_CLOCK / 60 - f)) / f : 0));
  return Math.round(d * NIGHT.dark * 40) / 40;
}
function fmtClock(min){
  const h = Math.floor(min / 60), m = Math.floor(min % 60);
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

// Rating text rounded down, so "4.5" is never shown while 4.46 fails a 4.5 star gate.
function starTxt(r){ return (Math.floor(r * 10 + 1e-9) / 10).toFixed(1); }
