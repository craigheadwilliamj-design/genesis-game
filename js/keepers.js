/* =====================================================================
   KEEPERS
   Staff who carry food from Keeper Stations to exhibits.
   Keepers walk any path or service road. They only go into an exhibit
   through a gate on a service road (never one that opens onto a guest
   path). Vivariums need no gate.
   ===================================================================== */

const FOOD_OF_DIET = {herbivore:"plants", omnivore:"plants", carnivore:"meat", piscivore:"fish", insectivore:"insects"};
// Plant-eaters from before the Cenozoic eat Paleoflora from CERES
function foodType(s){
  const base = FOOD_OF_DIET[s.diet[0]] || "plants";
  return base === "plants" && ERA_OF[s.period] !== "cenozoic" ? "paleoflora" : base;
}
const ceresOpen = () => state.buildings.some(b => b.type === "ceres" && kGraph && kGraph.anchors[b.id]);

/* ---------- CERES growing Paleoflora ---------- */
const greenhouses = () => state.buildings.filter(b => b.type === "greenhouse" && isReachable(b));
function ceresRate(){ return dept("ceres") && hasTech("paleoflora") ? PALEOFLORA.perDay + greenhouses().length * PALEOFLORA.greenhouse : 0; }
function ceresCap(){ return Math.max(PALEOFLORA.perDay, ceresRate()) * PALEOFLORA.storeDays; }
function ceresTick(dtMin){ const c = state.ceres; c.stock = Math.min(ceresCap(), c.stock + ceresRate() * dtMin / (CLOSE_MIN - OPEN_MIN)); }
// Keepers only go for Paleoflora when CERES has some to give
const paleofloraReady = () => ceresOpen() && hasTech("paleoflora") && state.ceres.stock >= 1;
// Where keepers pick up a food: Paleoflora at CERES, everything else at a Keeper Station
function sourcesFor(t){ return t === "paleoflora" ? state.buildings.filter(b => b.type === "ceres" && kGraph && kGraph.anchors[b.id]) : stations(); }
// Food an exhibit has for a need. Without Paleoflora, plain plant food (grass hay) stands in.
function stockFor(e, t){ const s = e.stock || {}; return (s[t] || 0) + (t === "paleoflora" ? (s.plants || 0) * (dailyNeed(e).plants ? 0 : 1) : 0); }
// Room an exhibit has for a delivery
function roomFor(e, t){
  const need = dailyNeed(e), s = e.stock || {};
  if(t === "plants" && need.paleoflora && !need.plants) return Math.max(0, storeMax(e, "paleoflora") - (s.paleoflora || 0) - (s.plants || 0));
  return Math.max(0, storeMax(e, t) - (s[t] || 0));
}
const unitsPerDay = s => Math.max(1, Math.round(s.food / FOOD_UNIT_COST));

let kGraph = null;     // {nodes: Map(key -> node), anchors: {id -> node}}
let crew = [];         // keepers walking around right now (positions aren't saved)

function freshStaff(){ return {keepers:[], mechanics:[], transfers:[], upgrades:[], feedFrom:5}; }

/* ---------- what each exhibit needs ---------- */

// Food each type the exhibit eats per day
// Cached per exhibit and keyed on its herd, since keepers ask this many times a frame
const needCache = new WeakMap();
function dailyNeed(e){
  const key = e.animals.map(a => a.sp).join(","), hit = needCache.get(e);
  if(hit && hit.key === key) return hit.need;
  const need = {};
  for(const a of e.animals){ const s = SPECIES_BY_ID[a.sp], t = foodType(s); need[t] = (need[t] || 0) + unitsPerDay(s); }
  needCache.set(e, {key, need});
  return need;
}
function storeMax(e, t){ return Math.ceil((dailyNeed(e)[t] || 0) * STORE_DAYS); }
function freeFeeding(){ return state.day < state.staff.feedFrom; }

// Where keepers get into an exhibit: its gate, or for a vivarium the path beside it
function gateCheck(e){
  if(e.viv) return {ok:true, text:"Vivariums are always open to keepers."};
  if(!e.gate) return {ok:false, text:"No gate. Use the Gate tool on a fence that touches a service road."};
  const near = (p, list) => list.some(q => q.points.some((v, i) => i > 0 && segProj(e.gate[0], e.gate[1], q.points[i-1], v).d <= GATE_REACH));
  const guest = state.paths.filter(p => !isService(p)), svc = state.paths.filter(isService);
  if(near(e.gate, guest)) return {ok:false, text:"The gate opens onto a guest path. Keepers won't use it. Move it to a service road."};
  if(!near(e.gate, svc)) return {ok:false, text:"The gate doesn't touch a service road."};
  return {ok:true, text:"Gate opens onto a service road."};
}

/* ---------- the keepers' map of paths ---------- */

// Build a walking map from every connected path and service road, with stops added
// where stations, break rooms, gates, and vivariums meet a path
function buildKeeperGraph(){
  const live = state.paths.filter(p => derived.joinedAll.has(p.id));
  const copies = live.map(p => ({p, pts:p.points.map(v => v.slice()), adds:[]}));
  const anchors = {};
  const attach = (id, x, y, maxD, svcOnly) => {
    let best = null;
    for(const c of copies){
      if(svcOnly && !isService(c.p)) continue;
      for(let i = 1; i < c.pts.length; i++){
        const r = segProj(x, y, c.pts[i-1], c.pts[i]);
        if(r.d <= maxD && (!best || r.d < best.r.d)) best = {c, i, r};
      }
    }
    if(best){ best.c.adds.push({i:best.i, t:best.r.t, pt:[best.r.x, best.r.y], id}); }
  };
  for(const b of state.buildings) if(["station", "breakroom", "workshop", "generator", "ceres", "depot", "pmc"].includes(b.type) && isReachable(b)){
    const [cx, cy] = centroid(b.points); attach(b.id, cx, cy, BUILDINGS[b.type].d/2 + 6, false);
  }
  // mechanics reach each fence from the closest path or road
  for(const e of state.exhibits){
    if(e.viv) continue;
    let best = null;
    for(let i = 0; i < e.points.length; i++){
      const a = e.points[i], b = e.points[(i+1) % e.points.length], L = dist(a, b);
      for(let s = 0; s <= L; s += 5){ const p = [a[0] + (b[0]-a[0]) * s / (L || 1), a[1] + (b[1]-a[1]) * s / (L || 1)];
        for(const c of copies) for(let j = 1; j < c.pts.length; j++){ const r = segProj(p[0], p[1], c.pts[j-1], c.pts[j]); if(r.d <= 8 && (!best || r.d < best.r.d)) best = {c, i:j, r}; } }
    }
    if(best) best.c.adds.push({i:best.i, t:best.r.t, pt:[best.r.x, best.r.y], id:"fix:" + e.id});
  }
  for(const e of state.exhibits){
    if(e.viv){ const [cx, cy] = centroid(e.points); attach(e.id, cx, cy, VIVARIUMS[e.viv].d/2 + 6, false); }
    else if(e.gate && gateCheck(e).ok) attach(e.id, e.gate[0], e.gate[1], GATE_REACH, true);
  }
  // splice the stops into each path, then link everything up
  const nodes = new Map();
  const node = p => { const k = nodeKey(p); if(!nodes.has(k)) nodes.set(k, {k, x:p[0], y:p[1], adj:new Map(), svc:new Set()}); return nodes.get(k); };
  // svc marks a stretch of service road, the only place ATVs can drive
  const link = (a, b, svc) => { if(a === b) return; const d = Math.hypot(a.x-b.x, a.y-b.y); a.adj.set(b, d); b.adj.set(a, d); if(svc){ a.svc.add(b); b.svc.add(a); } };
  for(const c of copies){
    const seq = [];
    c.pts.forEach((v, i) => {
      if(i > 0) c.adds.filter(a => a.i === i).sort((a, b) => a.t - b.t).forEach(a => { const n = node(a.pt); anchors[a.id] = n; seq.push(n); });
      seq.push(node(v));
    });
    for(let i = 1; i < seq.length; i++) link(seq[i-1], seq[i], isService(c.p));
  }
  // a corner of one path sitting on the middle of another joins them
  const all = [...nodes.values()];
  for(const c of copies) for(let i = 1; i < c.pts.length; i++)
    for(const n of all){ const r = segProj(n.x, n.y, c.pts[i-1], c.pts[i]); if(r.d < 1.5 && r.t > .01 && r.t < .99){ link(n, node(c.pts[i-1]), isService(c.p)); link(n, node(c.pts[i]), isService(c.p)); } }
  kGraph = {nodes, anchors};
  // point everyone at the new map (the old one is thrown away)
  for(const k of crew){ k.at = k.at ? (nodes.get(k.at.k) || null) : null; k.route = []; k.t = 0; if(k.job !== "resting" && k.job !== "sedating") k.job = "idle"; }
  for(const m of mcrew){ m.at = m.at ? (nodes.get(m.at.k) || null) : null; m.route = []; m.t = 0; if(m.job === "toFence" || m.job === "home"){ m.job = "idle"; m.target = null; } }
  for(const v of vcrew){ v.at = v.at ? (nodes.get(v.at.k) || null) : null; v.route = []; v.t = 0; if(!["darting", "treating", "checking"].includes(v.job)){ v.job = "idle"; if(v.loose) v.loose.vet = null; v.loose = null; v.patient = null; v.check = null; } }
}

// Shortest walk from one stop to every other (distances and the way back)
// Quickest way from one stop to every other. With an ATV, service roads count as faster.
function walkFrom(start, fast){
  const dist = new Map([[start, 0]]), prev = new Map(), done = new Set();
  // binary min-heap of [distance, node]
  const heap = [[0, start]];
  const push = item => { heap.push(item); let i = heap.length - 1; while(i > 0){ const p = (i - 1) >> 1; if(heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if(heap.length){ heap[0] = last; let i = 0; for(;;){ const l = 2*i + 1, r = l + 1; let m = i;
      if(l < heap.length && heap[l][0] < heap[m][0]) m = l; if(r < heap.length && heap[r][0] < heap[m][0]) m = r;
      if(m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } }
    return top;
  };
  while(heap.length){
    const [, n] = pop(); if(done.has(n)) continue; done.add(n);
    for(const [m, d] of n.adj){ const nd = dist.get(n) + (fast && n.svc.has(m) ? d / VEHICLES.speedMult : d); if(nd < (dist.has(m) ? dist.get(m) : Infinity)){ dist.set(m, nd); prev.set(m, n); push([nd, m]); } }
  }
  return {dist, prev};
}
function routeTo(w, target){ const r = []; for(let n = target; n; n = w.prev.get(n)) r.unshift(n); return r; }

/* ---------- running the crew ---------- */

const hasUpgrade = id => state.staff.upgrades.includes(id);
const carryMax = () => KEEPER.carry * (hasUpgrade("wheelbarrow") ? 2.5 : 1);
const tireRate = () => KEEPER.tirePerMeter * (hasUpgrade("boots") ? .6 : 1);

function stations(){ return state.buildings.filter(b => b.type === "station" && kGraph && kGraph.anchors[b.id]); }
function restSpots(){ const r = state.buildings.filter(b => b.type === "breakroom" && kGraph && kGraph.anchors[b.id]); return r.length ? r : stations(); }

// Make the walking crew match the hired keepers
function syncCrew(){
  const ids = new Set(state.staff.keepers.map(k => k.id));
  crew = crew.filter(c => ids.has(c.id));
  // carry lives on the saved keeper too, so food in hand survives a reload
  for(const k of state.staff.keepers) if(!crew.some(c => c.id === k.id)) crew.push({id:k.id, at:null, route:[], t:0, job:"idle", carry:k.carry || null, wait:0, plan:null});
}
function setCarry(c, v){ c.carry = v; const k = state.staff.keepers.find(x => x.id === c.id); if(k) k.carry = v; }
// Hand back anything a keeper is holding: Paleoflora returns to CERES, station food is unlimited
function returnCarry(c){
  if(c.carry && c.carry.type === "paleoflora" && c.carry.amount > 0) state.ceres.stock = Math.min(ceresCap(), state.ceres.stock + c.carry.amount);
  setCarry(c, null);
}

// How much of each food each exhibit is short, minus what keepers are already bringing
function shortages(){
  const out = [];
  for(const e of state.exhibits){
    if(!e.animals.length || !kGraph.anchors[e.id]) continue;
    const need = dailyNeed(e); e.stock = e.stock || {};
    for(const need_t of Object.keys(need)){
      // with no CERES, keepers bring plain plant food in place of Paleoflora
      const t = need_t === "paleoflora" && !paleofloraReady() ? "plants" : need_t;
      if(t === "plants" && need_t === "paleoflora" && need.plants) continue;   // the exhibit's own plant order covers it
      const coming = crew.reduce((s, c) => s + (c.plan && c.plan.exhibitId === e.id && c.carry && c.carry.type === t ? c.carry.amount : 0), 0);
      const have = stockFor(e, need_t), short = storeMax(e, need_t) - have - coming;
      if(short > 0.5) out.push({e, t, short, ratio:have / Math.max(1, storeMax(e, need_t))});
    }
  }
  return out.sort((a, b) => a.ratio - b.ratio);
}

function nearestOf(c, list){
  const w = walkFrom(c.at, c.atv); let best = null;
  for(const b of list){ const n = kGraph.anchors[b.id]; if(w.dist.has(n) && (!best || w.dist.get(n) < best.d)) best = {b, n, d:w.dist.get(n), w}; }
  return best;
}
function goTo(c, n, job){ const w = walkFrom(c.at, c.atv); if(!w.dist.has(n)){ c.job = "idle"; c.wait = 10; return false; } c.route = routeTo(w, n).slice(1); c.job = job; return true; }

/* ---------- catching escaped animals ---------- */

// An escape nobody is chasing yet gets this keeper. Escapes come before feeding and breaks.
// With vets on duty, vets do the darting and keepers only carry darted animals home.
const needsKeeper = l => !l.keeper && (vetsOnDuty() ? l.status === "sedated" : l.status === "loose");
function huntJob(c){
  if(!state.safety) return null;
  const mine = state.safety.loose.find(l => l.keeper === c.id);
  if(mine) return mine;
  const free = state.safety.loose.find(needsKeeper);
  if(free){ free.keeper = c.id; return free; }
  return null;
}
function keeperPos(c){ const nx = c.route[0]; return nx ? [c.at.x + (nx.x - c.at.x) * c.t, c.at.y + (nx.y - c.at.y) * c.t] : [c.at.x, c.at.y]; }

function chase(c, l){
  // a vet already darted it: walk over and pick it up
  if(l.status === "sedated" && l.byVet){ const n = kGraph.nodes.get(l.at); if(n && goTo(c, n, "toSedated")){ c.hunt = l; return true; } return false; }
  if(l.status === "loose"){
    if(vetsOnDuty()){ l.keeper = null; return false; }
    if(!c.gun){ const st = nearestOf(c, stations()); if(st){ goTo(c, st.n, "toGun"); return true; } return false; }
    const n = kGraph.nodes.get(l.next || l.at); if(n){ c.hunt = l; if(!goTo(c, n, "hunting")){ l.keeper = null; return false; } if(!c.route.length) arrive(c, null); return true; }
  }
  if(l.status === "carried"){
    const e = state.exhibits.find(x => x.id === l.from), n = e && kGraph.anchors[e.id];
    if(n && goTo(c, n, "returning")){ c.hunt = l; return true; }
    const st = nearestOf(c, stations()); if(st){ c.hunt = l; goTo(c, st.n, "returning"); return true; }
  }
  return false;
}

/* ---------- moving animals between exhibits ---------- */

// Ask a keeper to move one animal: {id, animalId, sp, from, to}
function requestMove(from, sp, to, count){
  let n = 0;
  const queued = new Set(state.staff.transfers.map(t => t.animalId));
  for(const a of from.animals){
    if(n >= count) break;
    if(a.sp !== sp || queued.has(a.id)) continue;
    state.staff.transfers.push({id:uid("tr-"), animalId:a.id, sp, from:from.id, to:to.id}); n++;
  }
  return n;
}
function moveProblem(e){ return kGraph && kGraph.anchors[e.id] ? null : gateCheck(e).text; }

// A move nobody has picked up yet, where keepers can reach both ends
function moveJob(c){
  const ts = state.staff.transfers;
  const mine = ts.find(t => t.keeper === c.id);
  if(mine) return mine;
  const open = t => !t.keeper && kGraph.anchors[t.from] && kGraph.anchors[t.to];
  const free = ts.find(t => t.med && open(t)) || ts.find(open);
  if(free){ free.keeper = c.id; return free; }
  return null;
}
function doMove(c, t){
  if(c.cargo){ goTo(c, kGraph.anchors[t.to], "toDropoff"); return c.route.length || c.job === "toDropoff"; }
  return goTo(c, kGraph.anchors[t.from], "toPickup");
}
// Take the animal out of wherever it's waiting: an exhibit, or the PMC ward
function pickUp(t){
  const e = state.exhibits.find(x => x.id === t.from);
  if(!e) return discharge(t.animalId);
  const a = e.animals.find(x => x.id === t.animalId);
  if(a) e.animals.splice(e.animals.indexOf(a), 1);
  return a || null;
}
// Finish a move: the animal goes into its new home, or holding if that's gone
function dropOff(t, a){
  state.staff.transfers = state.staff.transfers.filter(x => x !== t);
  const pmc = pmcBuilding();
  if(pmc && t.to === pmc.id){ admit(a, t); return; }
  // a sick animal whose PMC is gone goes back where it came from
  if(t.med && !state.exhibits.some(x => x.id === t.to) && state.exhibits.some(x => x.id === t.from)){ sendHome(a, t.from); events.changed(); return; }
  delete a.darted;
  const e = state.exhibits.find(x => x.id === t.to), s = SPECIES_BY_ID[a.sp];
  if(e){ if(!e.animals.length) e.happy = 70; e.animals.push(a); events.toast(`Keepers moved a ${s.name} into ${e.name}.`, "good"); }
  else { state.science.ready.push({id:a.id, sp:a.sp, q:a.q ?? 90}); events.toast(`The ${s.name}'s new exhibit is gone, so keepers put it in holding.`, "bad"); }
  events.changed();
}

/* ---------- mucking out ---------- */

// Dirt added per day: bigger animals and meat-eaters are messier; more room spreads it out
function dirtPerDay(e){
  let m = 0;
  for(const a of e.animals){ const s = SPECIES_BY_ID[a.sp]; m += Math.sqrt(s.space) * (CLEAN.dietMess[s.diet[0]] || 1); }
  return m * CLEAN.messRate / Math.sqrt(Math.max(area(e.points), 20) / 1000);
}
// Dirt removed per minute of work
function cleanRate(e){ return CLEAN.handRate * (hasUpgrade("hoses") ? CLEAN.hoseBoost : 1) / Math.sqrt(Math.max(area(e.points), 20) / 1000); }
function dirtTick(dtMin){
  for(const e of state.exhibits) if(e.animals.length) e.dirt = Math.min(100, (e.dirt || 0) + dirtPerDay(e) * dtMin / (CLOSE_MIN - OPEN_MIN));
}
// The dirtiest exhibit keepers can reach that nobody is already cleaning
function cleanJob(c){
  if(!hasUpgrade("shovels")) return null;
  const taken = new Set(crew.filter(x => x !== c && x.cleanId).map(x => x.cleanId));
  return state.exhibits.filter(e => (e.dirt || 0) >= CLEAN.dirtyAt && kGraph.anchors[e.id] && !taken.has(e.id)).sort((a, b) => b.dirt - a.dirt)[0] || null;
}

function decide(c, k){
  const l = huntJob(c);
  if(l && chase(c, l)) return;
  // can't chase it from here (no dart gun to fetch, no route): let another keeper try
  if(l && l.status === "loose" && l.keeper === c.id) l.keeper = null;
  const mv = moveJob(c);
  if(mv && mv.cargo && !c.cargo) c.cargo = mv.cargo;   // picked up before a reload
  if(mv && doMove(c, mv)){ c.move = mv; return; }
  if(mv && !c.cargo){ mv.keeper = null; }
  if(k.stamina < KEEPER.restBelow){ const r = nearestOf(c, restSpots()); if(r){ goTo(c, r.n, "toRest"); return; } }
  if(c.carry && c.carry.amount > 0){
    const jobs = shortages().filter(j => j.t === c.carry.type);
    const w = walkFrom(c.at, c.atv); const j = jobs.filter(j => w.dist.has(kGraph.anchors[j.e.id])).sort((a, b) => w.dist.get(kGraph.anchors[a.e.id]) - w.dist.get(kGraph.anchors[b.e.id]))[0];
    if(j){ c.plan = {exhibitId:j.e.id}; goTo(c, kGraph.anchors[j.e.id], "toExhibit"); return; }
  }
  const job = shortages()[0];
  // cleaning comes before routine feeding, but not before food that's running out
  if(!job || job.ratio >= .3){
    const dirty = cleanJob(c);
    if(dirty){ c.cleanId = dirty.id; if(goTo(c, kGraph.anchors[dirty.id], "toClean")) return; c.cleanId = null; }
  }
  const st = job ? nearestOf(c, sourcesFor(job.t)) : nearestOf(c, stations());
  if(!job || !st){ c.job = "idle"; c.wait = 15; c.plan = null; const home = nearestOf(c, stations()); if(home && home.d > 1) goTo(c, home.n, "home"); return; }
  c.plan = {exhibitId:job.e.id, type:job.t};
  goTo(c, st.n, "toStation");
}

function arrive(c, k){
  if(c.job === "toRest"){ c.job = "resting"; return; }
  if(c.job === "toPickup"){
    const t = c.move, a = t && pickUp(t);
    if(!t || !a){ if(t) state.staff.transfers = state.staff.transfers.filter(x => x !== t); c.move = null; c.job = "idle"; return; }
    c.cargo = a; t.cargo = a;   // kept on the transfer too, so a save mid-move doesn't lose the animal
    k.stamina -= KEEPER.tirePerDelivery; events.changed();
    if(!goTo(c, kGraph.anchors[t.to] || c.at, "toDropoff")) c.job = "toDropoff";
    return;
  }
  if(c.job === "toDropoff"){
    const t = c.move;
    if(t && c.cargo) dropOff(t, c.cargo);
    c.cargo = null; c.move = null; c.job = "idle"; c.wait = 0;
    return;
  }
  if(c.job === "toClean"){ c.job = state.exhibits.some(x => x.id === c.cleanId) ? "mucking" : "idle"; return; }
  if(c.job === "toGun"){ c.gun = true; c.job = "idle"; c.wait = 0; return; }
  if(c.job === "toSedated"){
    const l = c.hunt;
    if(l && l.status === "sedated" && state.safety.loose.includes(l)){ l.status = "carried"; if(!chase(c, l)){ c.job = "idle"; c.wait = 5; } return; }
    c.hunt = null; c.job = "idle"; c.wait = 0; return;
  }
  if(c.job === "hunting"){
    const l = c.hunt, lp = l && loosePos(l);
    if(!l || l.status !== "loose"){ c.job = "idle"; return; }
    const [kx, ky] = keeperPos(c);
    if(lp && Math.hypot(lp[0] - kx, lp[1] - ky) < 10){ c.job = "sedating"; c.sedate = ESCAPE.sedateMinutes; l.status = "sedated"; return; }
    c.job = "idle"; c.wait = 0; return;   // it moved; decide() chases it again
  }
  if(c.job === "returning"){
    const l = c.hunt, e = l && state.exhibits.find(x => x.id === l.from);
    if(l) returnAnimal(l, e && kGraph.anchors[e.id] === c.at ? e : null);
    c.hunt = null; c.job = "idle"; c.wait = 0; return;
  }
  if(c.job === "toStation"){
    // drop off whatever's left, pick up a full load of the food that's needed most
    returnCarry(c);
    const t = c.plan && c.plan.type || (shortages()[0] || {}).t;
    if(!t){ c.job = "idle"; c.wait = 10; return; }
    const want = shortages().filter(j => j.t === t).reduce((s, j) => s + j.short, 0);
    let amount = Math.min(carryMax(), Math.max(1, Math.ceil(want)));
    // CERES can only hand out what it has grown
    if(t === "paleoflora"){ amount = Math.min(amount, Math.floor(state.ceres.stock)); if(amount < 1){ c.job = "idle"; c.wait = 10; return; } state.ceres.stock -= amount; }
    setCarry(c, {type:t, amount});
    k.stamina -= KEEPER.tirePerDelivery;
    const j = shortages().find(j => j.t === t);
    if(j){ c.plan = {exhibitId:j.e.id}; goTo(c, kGraph.anchors[j.e.id], "toExhibit"); } else c.job = "idle";
    return;
  }
  if(c.job === "toExhibit"){
    const e = state.exhibits.find(x => x.id === (c.plan && c.plan.exhibitId));
    if(e && c.carry){
      e.stock = e.stock || {};
      // real Paleoflora replaces any grass hay that was standing in for it
      if(c.carry.type === "paleoflora" && !dailyNeed(e).plants) e.stock.plants = 0;
      const room = roomFor(e, c.carry.type);
      const give = Math.min(room, c.carry.amount);
      e.stock[c.carry.type] = (e.stock[c.carry.type] || 0) + give; c.carry.amount -= give;
      k.stamina -= KEEPER.tirePerDelivery;
      if(c.carry.amount <= 0.01) setCarry(c, null);
    }
    c.plan = null; c.job = "idle"; c.wait = 0;
    return;
  }
  c.job = "idle"; c.wait = 10;
}

// Move the crew forward by dtMin park minutes
function keepersTick(dtMin){
  if(!kGraph) return;
  syncCrew();
  assignVehicles();
  for(const c of crew){
    const k = state.staff.keepers.find(x => x.id === c.id);
    if(!c.at){ const s = stations()[0]; if(!s) continue; c.at = kGraph.anchors[s.id]; c.job = "idle"; }
    let left = dtMin, steps = 0;
    while(left > 0 && steps++ < 60){
      if(c.job === "mucking"){
        const e = state.exhibits.find(x => x.id === c.cleanId);
        if(!e){ c.job = "idle"; c.cleanId = null; continue; }
        // stop when it's clean, when the keeper is worn out, or when an escape needs everyone
        const need = Math.max(0, (e.dirt || 0) - 2) / cleanRate(e), w = Math.min(left, need);
        e.dirt = Math.max(0, (e.dirt || 0) - cleanRate(e) * w); k.stamina -= CLEAN.tirePerMin * w; left -= w;
        if(e.dirt <= 2 || k.stamina < KEEPER.restBelow || state.safety.loose.some(needsKeeper)){ c.job = "idle"; c.cleanId = null; c.wait = 0; }
        continue;
      }
      if(c.job === "sedating"){
        const w = Math.min(c.sedate, left); c.sedate -= w; left -= w;
        if(c.sedate <= 0 && c.hunt){ c.hunt.status = "carried"; c.job = "idle"; chase(c, c.hunt); }
        continue;
      }
      if(c.job === "resting"){
        const fast = state.buildings.some(b => b.type === "breakroom" && kGraph.anchors[b.id] === c.at);
        k.stamina = Math.min(100, k.stamina + left * (fast ? KEEPER.restPerMin : KEEPER.restPerMin / 4));
        if(k.stamina >= 95) c.job = "idle";
        left = 0; break;
      }
      if(c.route.length){
        const nx = c.route[0], d = Math.hypot(nx.x - c.at.x, nx.y - c.at.y), drive = onAtv(c), sp = KEEPER.speed * (drive ? VEHICLES.speedMult : 1), go = sp * left;
        const remaining = d * (1 - c.t);
        if(go < remaining){ c.t += go / (d || 1); if(!drive) k.stamina -= go * tireRate(); left = 0; }
        else { left -= remaining / sp; if(!drive) k.stamina -= remaining * tireRate(); c.at = nx; c.route.shift(); c.t = 0; if(!c.route.length) arrive(c, k); }
        continue;
      }
      if(c.job !== "idle"){ arrive(c, k); continue; }
      if(c.wait > 0){ const w = Math.min(c.wait, left); c.wait -= w; left -= w; continue; }
      decide(c, k);
      if(c.job === "idle" && !c.route.length && c.wait <= 0) c.wait = 5;
    }
    k.stamina = clamp(k.stamina, 0, 100);
  }
}

// Animals eat through the day
function eatTick(dtMin){
  const free = freeFeeding();
  for(const e of state.exhibits){
    if(!e.animals.length) continue;
    e.stock = e.stock || {};
    const need = dailyNeed(e);
    e.grassFed = false;
    // time spent with some food run out makes animals more likely to fall ill
    if(!free && Object.keys(need).some(t => stockFor(e, t) <= 0.01)) e.hungryMin = (e.hungryMin || 0) + dtMin;
    for(const t of Object.keys(need)){
      if(free){ e.stock[t] = storeMax(e, t); continue; }
      let eat = need[t] * dtMin / (CLOSE_MIN - OPEN_MIN);
      const has = e.stock[t] || 0;
      e.stock[t] = Math.max(0, has - eat); eat -= Math.min(has, eat);
      // out of Paleoflora: they eat the grass hay instead
      if(t === "paleoflora" && eat > 0 && (e.stock.plants || 0) > 0 && !need.plants){ e.stock.plants = Math.max(0, e.stock.plants - eat); e.grassFed = true; }
      else if(t === "paleoflora" && (e.stock.paleoflora || 0) <= 0 && (e.stock.plants || 0) > 0) e.grassFed = true;
    }
  }
}

// Each night keepers go home and come back rested
function keepersNight(){
  // anything being carried is finished off before the keepers go home
  for(const t of [...state.staff.transfers]) if(t.cargo) dropOff(t, t.cargo);
  for(const c of crew){ c.cargo = null; c.move = null; }
  for(const t of state.staff.transfers) t.keeper = null;
  for(const k of state.staff.keepers) k.stamina = 100; for(const c of crew){ returnCarry(c); c.at = null; c.route = []; c.job = "idle"; c.plan = null; c.gun = false; c.hunt = null; c.cleanId = null; } }

const FIRST_NAMES = ["Ana","Ben","Cleo","Dev","Eli","Faye","Gus","Hana","Ivo","Jun","Kai","Lena","Milo","Nia","Omar","Pia","Quinn","Rosa","Sam","Tess","Uma","Vic","Wren","Yara","Zed"];
function hireKeeper(){
  if(!state.buildings.some(b => b.type === "station")) return "Build a Keeper Station first.";
  if(!canAfford(KEEPER.hireCost)) return `Hiring costs ${money(KEEPER.hireCost)}.`;
  spend(KEEPER.hireCost, "built");
  const used = new Set(state.staff.keepers.map(k => k.name));
  const name = FIRST_NAMES.find(n => !used.has(n)) || "Keeper " + (state.staff.keepers.length + 1);
  state.staff.keepers.push({id:uid("k-"), name, stamina:100});
  return null;
}
function keeperStatus(k){
  const c = crew.find(x => x.id === k.id); if(!c) return "Clocking in";
  const e = c.plan && state.exhibits.find(x => x.id === c.plan.exhibitId);
  const carry = c.carry ? ` with ${Math.ceil(c.carry.amount)} ${c.carry.type}` : "";
  return {toStation:(c.plan && c.plan.type === "paleoflora" ? "Heading to CERES" : "Heading to a station") + (e ? ` for ${e.name}` : ""), toExhibit:`Taking food to ${e ? e.name : "an exhibit"}${carry}`,
          toClean:`Heading to muck out ${(state.exhibits.find(x => x.id === c.cleanId) || {}).name || "an exhibit"}`, mucking:`Mucking out ${(state.exhibits.find(x => x.id === c.cleanId) || {}).name || "an exhibit"}`,
          toRest:"Going on break", resting:"On break", home:"Walking back to a station",
          toGun:"Fetching a dart gun", hunting:`Tracking the escaped ${c.hunt ? SPECIES_BY_ID[c.hunt.sp].name : "animal"}`,
          sedating:"Sedating an escaped animal", returning:"Bringing a sedated animal back", toSedated:`Collecting a darted ${c.hunt ? SPECIES_BY_ID[c.hunt.sp].name : "animal"}`,
          toPickup:`Collecting a ${c.move ? SPECIES_BY_ID[c.move.sp].name : "animal"} ${c.move && c.move.med ? (pmcBuilding() && c.move.to === pmcBuilding().id ? "for the PMC" : "from the PMC") : "to move"}`,
          toDropoff:`${c.move && c.move.med && pmcBuilding() && c.move.to === pmcBuilding().id ? "Carrying a sick" : "Moving a"} ${c.cargo ? SPECIES_BY_ID[c.cargo.sp].name : "animal"}`}[c.job] || (carry ? `Waiting${carry}` : "Waiting for work");
}

/* ---------- staff vehicles ---------- */

const depots = () => state.buildings.filter(b => b.type === "depot");
const depotWorking = b => isReachable(b) && condOf(b) >= VEHICLES.offlineBelow;
function vehicleSlots(){ return hasTech("vehicles") ? depots().filter(depotWorking).length * VEHICLES.perDepot : 0; }
// Hand out ATVs: keepers first, then mechanics, then vets, as many as the working depots hold
const allStaff = () => state.staff.keepers.concat(state.staff.mechanics, state.staff.vets);
function assignVehicles(){
  const lucky = new Set(allStaff().slice(0, vehicleSlots()).map(s => s.id));
  for(const c of crew) c.atv = lucky.has(c.id);
  for(const c of mcrew) c.atv = lucky.has(c.id);
  for(const c of vcrew) c.atv = lucky.has(c.id);
}
// Is this person driving right now? Only with an ATV, and only on a service road.
function onAtv(c){ const nx = c.route && c.route[0]; return !!(c.atv && nx && c.at && c.at.svc && c.at.svc.has(nx)); }