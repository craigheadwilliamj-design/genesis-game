/* =====================================================================
   KEEPERS
   Staff who carry food from Keeper Stations to exhibits.
   Keepers walk any path or service road, but ATVs only drive on service
   roads. They go into an exhibit through its gate, which can open onto
   either kind of path. Vivariums need no gate.
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
function ceresRate(){ return dept("ceres") && hasTech("paleoflora") && anyPlantDna() ? PALEOFLORA.perDay + greenhouses().length * PALEOFLORA.greenhouse : 0; }
function ceresCap(){ return Math.max(PALEOFLORA.perDay, ceresRate()) * PALEOFLORA.storeDays; }
function ceresTick(dtMin){ const c = state.ceres; c.stock = Math.min(ceresCap(), c.stock + ceresRate() * dtMin / (CLOSE_MIN - OPEN_MIN)); }
// Keepers only go for Paleoflora when CERES has some to give
const paleofloraReady = () => ceresOpen() && hasTech("paleoflora") && anyPlantDna() && state.ceres.stock >= 1;
// Where keepers pick up a food: Paleoflora at CERES, everything else from a store that has some.
// A keeper in a zone uses that zone's stores first.
function sourcesFor(t, k){
  if(t === "paleoflora") return cereses();
  const have = stores().filter(b => stockOf(b, t) >= 1), kz = k && k.zone, mine = kz ? have.filter(b => b.zone === kz) : [];
  return mine.length ? mine : have;
}
// Food an exhibit has for a need. Without Paleoflora, plain plant food (grass hay) stands in.
function stockFor(e, t){ const s = e.stock || {}; return (s[t] || 0) + trayFood(e, t) + (t === "paleoflora" ? (s.plants || 0) * (dailyNeed(e).plants ? 0 : 1) : 0); }
// Food trays: units each holds, what's in them, and the room left. A tray holds one kind of food at a time (any kind, once it's empty).
const trays = e => landOf(e).filter(f => LAND[f.type] && LAND[f.type].tray);
const trayCap = f => LAND[f.type].tray;
const trayHas = f => Object.values(f.food || {}).reduce((n, v) => n + v, 0);
const trayKind = f => Object.keys(f.food || {}).find(t => f.food[t] > .001) || null;
// room left in a tray, for food t (none if it holds another food); with no t, whatever's free
const trayRoomOf = (f, t) => { const k = trayKind(f); return t && ((k && k !== t) || (f.set && f.set !== t)) ? 0 : Math.max(0, trayCap(f) - trayHas(f)); };
const trayFood = (e, t) => trays(e).reduce((n, f) => n + ((f.food || {})[t] || 0), 0);
const trayRoom = e => trays(e).reduce((n, f) => n + trayRoomOf(f), 0);
// Tray room a food can count on: trays set to it or already holding it, plus unset empty trays split by how much of each the herd eats
function trayShare(e, t){
  const need = dailyNeed(e), all = Object.values(need).reduce((n, v) => n + v, 0), part = all > 0 ? (need[t] || 0) / all : 0;
  return trays(e).reduce((n, f) => n + (f.set ? (f.set === t ? trayRoomOf(f, t) : 0) : trayKind(f) === t ? trayRoomOf(f) : trayKind(f) ? 0 : trayCap(f) * part), 0);
}
// Animals eat from the trays before the gate stock. Returns what's still to eat.
function eatFromTrays(e, t, eat){
  for(const f of trays(e)){ const v = (f.food || {})[t] || 0; if(eat <= 0) break; if(v <= 0) continue; const take = Math.min(v, eat); f.food[t] = v - take; if(f.food[t] <= 0.001) delete f.food[t]; eat -= take; }
  return eat;
}
// Room an exhibit has for a delivery
function roomFor(e, t){
  const need = dailyNeed(e), s = e.stock || {};
  if(t === "plants" && need.paleoflora && !need.plants) return Math.max(0, storeMax(e, "paleoflora") - (s.paleoflora || 0) - (s.plants || 0));
  return Math.max(0, storeMax(e, t) - (s[t] || 0));
}
const unitsPerDay = s => Math.max(1, Math.round(s.food / FOOD_UNIT_COST));

let kGraph = null;     // {nodes: Map(key -> node), anchors: {id -> node}}
let crew = [];         // keepers walking around right now (positions aren't saved)

function freshStaff(){ return {keepers:[], mechanics:[], vets:[], custodians:[], guards:[], transfers:[], calls:[], atvs:[], upgrades:[], feedFrom:7}; }

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
  if(!e.gate) return {ok:false, text:"No gate. Use Gates (Exhibit Tools) on a fence that touches a service road."};
  const near = (p, list) => list.some(q => q.points.some((v, i) => i > 0 && segProj(e.gate[0], e.gate[1], q.points[i-1], v).d <= GATE_REACH));
  if(!near(e.gate, state.paths.filter(p => !isTram(p)))) return {ok:false, text:"The gate doesn't touch a path or service road."};
  return {ok:true, text:"Gate opens onto a path."};
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
  for(const b of state.buildings) if((["station", "breakroom", "workshop", "generator", "ceres", "depot", "pmc", "closet", "security"].includes(b.type) || BUILDINGS[b.type].tram || storeOf(b) || guestBuilding(b) || BUILDINGS[b.type].prop) && isReachable(b)){
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
    else if(e.gate && gateCheck(e).ok) attach(e.id, e.gate[0], e.gate[1], GATE_REACH, false);
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
    for(const n of all){ const r = segProj(n.x, n.y, c.pts[i-1], c.pts[i]); if(r.d >= 1.5) continue; if(r.t > .01 && r.t < .99){ link(n, node(c.pts[i-1]), isService(c.p)); link(n, node(c.pts[i]), isService(c.p)); } else link(n, node(c.pts[r.t <= .01 ? i-1 : i]), isService(c.p)); }
  kGraph = {nodes, anchors};
  // point everyone at the new map (the old one is thrown away)
  for(const k of crew){ k.at = k.at ? (nodes.get(k.at.k) || null) : null; k.route = []; k.t = 0; rebaseAtv(k); if(k.job !== "resting" && k.job !== "sedating") k.job = "idle"; }
  for(const m of mcrew){ m.at = m.at ? (nodes.get(m.at.k) || null) : null; m.route = []; m.t = 0; rebaseAtv(m); if(m.job === "toFence" || m.job === "home" || m.job === "toCall"){ m.job = "idle"; m.target = null; } }
  for(const c of gcrew){ c.at = c.at ? (nodes.get(c.at.k) || null) : null; c.route = []; c.t = 0; rebaseAtv(c); c.job = "idle"; }
  for(const c of ccrew){ c.at = c.at ? (nodes.get(c.at.k) || null) : null; c.route = []; c.t = 0; rebaseAtv(c); if(c.job.startsWith("to") || c.job === "home"){ c.job = "idle"; c.target = null; if(!c.carry) c.haul = null; } }
  for(const v of vcrew){ v.at = v.at ? (nodes.get(v.at.k) || null) : null; v.route = []; v.t = 0; rebaseAtv(v); if(!["darting", "treating", "checking"].includes(v.job)){ v.job = "idle"; if(v.loose) v.loose.vet = null; v.loose = null; v.patient = null; v.check = null; } }
}

// Quickest way from one stop to every other. ATVs are shared and sit where the last driver left them.
// Staff can only ride service roads, and only an ATV they have walked to, so a gap in the service roads
// means walking it and leaving the ATV parked there for whoever needs it next. One ride per trip.
// Layers: 0 = on foot, an ATV is free at one of `mounts`, 1 = riding, 2 = on foot with no ATV left to use.
// Pass a crew member as `c` (or nothing to plan a plain walk); `mounts` overrides which stops have a free ATV.
function walkFrom(start, c, mounts, skip){
  const speed = typeof VEHICLES !== "undefined" ? VEHICLES.speedMult : 5;
  if(!mounts) mounts = c ? freeAtvNodes(c) : new Set();
  const l0 = c && c.riding ? 1 : mounts.size ? 0 : 2;
  const dist = [new Map(), new Map(), new Map()], prev = [new Map(), new Map(), new Map()], done = [new Set(), new Set(), new Set()];
  dist[l0].set(start, 0);
  // binary min-heap of [distance, node, layer]
  const heap = [[0, start, l0]];
  const push = item => { heap.push(item); let i = heap.length - 1; while(i > 0){ const p = (i - 1) >> 1; if(heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if(heap.length){ heap[0] = last; let i = 0; for(;;){ const l = 2*i + 1, r = l + 1; let m = i;
      if(l < heap.length && heap[l][0] < heap[m][0]) m = l; if(r < heap.length && heap[r][0] < heap[m][0]) m = r;
      if(m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } }
    return top;
  };
  const relax = (nd, m, l, from) => { if(nd < (dist[l].has(m) ? dist[l].get(m) : Infinity)){ dist[l].set(m, nd); prev[l].set(m, from); push([nd, m, l]); } };
  while(heap.length){
    const [, n, l] = pop(); if(done[l].has(n)) continue; done[l].add(n);
    const d0 = dist[l].get(n);
    if(l === 0 && mounts.has(n)) relax(d0, n, 1, [n, 0]);   // climb on at a parked ATV
    if(l === 1) relax(d0, n, 2, [n, 1]);                  // get off anywhere; it stays here
    for(const [m, d] of n.adj){
      if(skip && skip(n, m)) continue;   // guests who can't ride leave out the tram
      if(l === 1){ if(n.svc.has(m)) relax(d0 + d / speed, m, 1, [n, 1]); }
      else relax(d0 + d, m, l, [n, l]);
    }
  }
  // best way to each stop: straight on foot, or ride part of it then walk
  const best = new Map(), tot = new Map();
  for(const n of dist[0].keys()){ best.set(n, 0); tot.set(n, dist[0].get(n)); }
  for(const [n, d] of dist[2]) if(!tot.has(n) || d < tot.get(n)){ best.set(n, 2); tot.set(n, d); }
  return {dist:tot, best, layers:{dist, prev}};
}
// The stops to pass through. The result also says where to climb on (.mount) and get off (.park), if at all.
function routeTo(w, target){
  const {prev} = w.layers, steps = [];
  for(let cur = [target, w.best.get(target)]; cur; cur = prev[cur[1]].get(cur[0])) steps.unshift(cur);
  const r = []; let mount = null, park = null;
  steps.forEach(([n, l], i) => {
    if(i && steps[i-1][1] === 0 && l === 1) mount = n;
    if(i && steps[i-1][1] === 1 && l === 2) park = n;
    if(!r.length || r[r.length-1] !== n) r.push(n);
  });
  r.mount = mount; r.park = park;
  return r;
}
// Follow a planned route: climb on or get off the ATV when we reach the stop where that happens
function atNode(c){
  if(c.mountAt && c.mountAt === c.at){ c.riding = true; c.mountAt = null; }
  if(c.parkAt && c.parkAt === c.at){ dismount(c, c.at); c.parkAt = null; }
}
// Plan a trip. If it starts with a walk to an ATV, set that ATV aside so nobody else takes it.
function setRoute(c, w, n){
  const r = routeTo(w, n);
  if(r.mount){ const a = usableAtvs().find(a => !a.by && atvNode(a) === r.mount); if(a){ a.by = c.id; c.atvId = a.id; } else r.mount = null; }
  c.route = r.slice(1); c.mountAt = r.mount; c.parkAt = r.park; atNode(c);
}
// Get off: the ATV stays at this stop until someone else (or this person) walks back to it
function dismount(c, node){
  const a = atvs().find(x => x.id === c.atvId);
  if(a){ a.at = node ? node.k : null; a.by = null; }
  c.atvId = null; c.riding = false;
}
// An ATV set aside for a walk that never finished goes back to being free
function releaseAtv(c){
  if(c.riding || !c.atvId) return;
  const a = atvs().find(x => x.id === c.atvId); if(a) a.by = null;
  c.atvId = null;
}
// The map was rebuilt: a rider parks where they stand, and everyone re-plans on the new stops
function rebaseAtv(c){ c.mountAt = c.parkAt = null; if(c.riding) dismount(c, c.at); else releaseAtv(c); }
// A new day: nobody is mid-ride
function resetAtv(c){ c.riding = false; c.atvId = null; c.mountAt = c.parkAt = null; }

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
// Hand back anything a keeper is holding: Paleoflora returns to CERES, other goods go back into a store
function returnCarry(c){
  const h = c.carry;
  if(h && h.amount > 0){
    if(h.type === "paleoflora") state.ceres.stock = Math.min(ceresCap(), state.ceres.stock + h.amount);
    else if(h.type === "meds" && !stashGood("meds", h.amount, null) && cereses().length) state.ceres.meds = Math.min(medCap(), (state.ceres.meds || 0) + h.amount);
    else if(h.type !== "meds") stashGood(h.type, h.amount, buildingById(c.haul ? c.haul.src : c.plan && c.plan.src));
  }
  c.haul = null;
  setCarry(c, null);
}

// How much of each food each exhibit is short, minus what other keepers are already bringing
// (pass the asking keeper as `self` so its own load doesn't count as already on its way)
function shortages(k, self){
  const out = [];
  for(const e of state.exhibits){
    if(!e.animals.length || !kGraph.anchors[e.id]) continue;
    if(k && k.zone && e.zone !== k.zone) continue;   // keepers in a zone only feed that zone
    const need = dailyNeed(e); e.stock = e.stock || {};
    for(const need_t of Object.keys(need)){
      // with no CERES, keepers bring plain plant food in place of Paleoflora
      const t = need_t === "paleoflora" && !paleofloraReady() ? "plants" : need_t;
      if(t === "plants" && need_t === "paleoflora" && need.plants) continue;   // the exhibit's own plant order covers it
      const coming = crew.reduce((s, c) => s + (c !== self && c.plan && c.plan.exhibitId === e.id && c.carry && c.carry.type === t ? c.carry.amount : 0), 0);
      const have = stockFor(e, need_t), full = storeMax(e, need_t) + trayFood(e, need_t) + trayShare(e, need_t), short = full - have - coming;
      if(short > 0.5) out.push({e, t, short, ratio:have / Math.max(1, full)});
    }
  }
  return out.sort((a, b) => a.ratio - b.ratio);
}

function nearestOf(c, list){
  const w = walkFrom(c.at, c); let best = null;
  for(const b of list){ const n = kGraph.anchors[b.id]; if(w.dist.has(n) && (!best || w.dist.get(n) < best.d)) best = {b, n, d:w.dist.get(n), w}; }
  return best;
}
function goTo(c, n, job){ const w = walkFrom(c.at, c); if(!w.dist.has(n)){ c.job = "idle"; c.wait = 10; return false; } setRoute(c, w, n); c.job = job; return true; }

/* ---------- catching escaped animals ---------- */

// An escape nobody is chasing yet gets this keeper. Escapes come before feeding and breaks.
// With vets on duty, vets do the darting and keepers only carry darted animals home.
const needsKeeper = l => !l.keeper && (vetsOnDuty() && !l.noVet ? l.status === "sedated" : l.status === "loose");   // noVet: no vet could get to it
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
    if(vetsOnDuty() && !l.noVet){ l.keeper = null; return false; }
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

/* ---------- calling staff to an exhibit ---------- */

// The Call keeper / vet / mechanic buttons: the nearest worker of that kind who isn't mid-emergency drops their job and
// goes to check the exhibit. If nobody can go yet, the next free one takes it. Escapes still come first.
// state.staff.calls: {ex: exhibit id, keeper: worker id or null (any kind), kind: "keeper" (default), "vet" or "mech"}
const CALLS = {
  keeper:{word:"keeper",   staff:() => state.staff.keepers,   crew:() => crew,  anchor:e => kGraph.anchors[e.id], busy:c => callBusy(c),  take:(c, call) => takeCall(c, call)},
  vet:   {word:"vet",      staff:() => state.staff.vets,      crew:() => vcrew, anchor:e => kGraph.anchors[e.id], busy:c => vetBusy(c),   take:(c, call) => takeVetCall(c, call)},
  mech:  {word:"mechanic", staff:() => state.staff.mechanics, crew:() => mcrew, anchor:e => anchorFor(e),         busy:c => mechBusy(c), take:(c, call) => takeMechCall(c, call)},
};
const callKind = x => x.kind || "keeper";
const callFor = c => state.staff.calls.find(x => x.keeper === c.id) || null;
const callBusy = c => c.cargo || c.hunt || c.job === "filling" || c.job === "sedating" || c.job === "hunting" || c.job === "toSedated" || c.job === "returning"
  || (state.safety && state.safety.loose.some(l => l.keeper === c.id));
const vetBusy = c => c.loose || ["darting", "treating", "checking", "splicing", "hunting"].includes(c.job);
const mechBusy = c => c.job === "inspecting" || c.job === "repairing";
function callProblem(e, kind = "keeper"){
  const K = CALLS[kind];
  if(!K.staff().length) return `Hire a ${K.word} first.`;
  if(kind === "mech"){ if(e.viv) return "Vivariums have no fence to inspect."; return anchorFor(e) ? null : "Mechanics can't reach the fence."; }
  if(keeperMoveProblem(e)) return keeperMoveProblem(e);
  if(kind === "vet" && !e.animals.length) return "No animals here to check.";
  return null;
}
function callKeeper(e, kind = "keeper"){
  const why = callProblem(e, kind); if(why) return why;
  const K = CALLS[kind], calls = state.staff.calls;
  if(calls.some(x => x.ex === e.id && callKind(x) === kind)) return null;
  const call = {ex:e.id, keeper:null, kind};
  let best = null; const n = K.anchor(e);
  for(const c of K.crew()){
    if(!c.at || callFor(c) || K.busy(c)) continue;
    const w = walkFrom(c.at, c); if(!w.dist.has(n)) continue;
    const d = w.dist.get(n) + (c.route.length ? 1 : 0);
    if(!best || d < best.d) best = {c, d};
  }
  if(best) call.keeper = best.c.id;
  calls.push(call);
  const k = best && K.staff().find(x => x.id === best.c.id);
  events.toast(k ? `${k.name} is on the way to ${e.name}.` : `Every ${K.word} is tied up. The next one free will go to ${e.name}.`, k ? "good" : "");
  return null;
}
function cancelCall(e, kind = "keeper"){ state.staff.calls = state.staff.calls.filter(x => !(x.ex === e.id && callKind(x) === kind)); }
// A called keeper stops what they were doing (releasing any move or muck job they'd claimed) and heads over
function takeCall(c, call){
  const t = c.move; if(t && !t.cargo){ t.keeper = null; c.move = null; }
  c.cleanId = null; c.plan = null; c.haul = c.carry && c.carry.dst ? c.haul : null;
  c.job = "idle"; c.route = []; c.t = 0; c.wait = 0;
  if(!goTo(c, kGraph.anchors[call.ex], "toCall")) call.keeper = null;
}
// A called vet drops a trip to a patient or check-up and goes to look the exhibit over
function takeVetCall(c, call){
  c.patient = null; c.gene = null; c.check = null;
  c.job = "idle"; c.route = []; c.t = 0; c.wait = 0;
  if(!vetGo(c, kGraph.anchors[call.ex], "toCall")) call.keeper = null;
}
// A called mechanic walks over and inspects the fence now, and repairs it if it needs it
function takeMechCall(c, call){
  const e = state.exhibits.find(x => x.id === call.ex);
  c.target = null; c.job = "idle"; c.route = []; c.t = 0; c.wait = 0;
  const w = walkFrom(c.at, c), n = e && anchorFor(e);
  if(!n || !w.dist.has(n)){ call.keeper = null; return; }
  setRoute(c, w, n); c.job = "toCall";
}
// Hand unclaimed calls of this kind to a free worker
function callJob(c, kind = "keeper"){
  const mine = callFor(c);
  if(mine) return mine;
  const w = walkFrom(c.at, c), K = CALLS[kind];
  const free = state.staff.calls.find(x => !x.keeper && callKind(x) === kind && K.anchor({id:x.ex}) && w.dist.has(K.anchor({id:x.ex})));
  if(free){ free.keeper = c.id; return free; }
  return null;
}
function callsTidy(){
  state.staff.calls = state.staff.calls.filter(x => state.exhibits.some(e => e.id === x.ex) && CALLS[callKind(x)].anchor({id:x.ex}));
  for(const x of state.staff.calls) if(x.keeper && !CALLS[callKind(x)].crew().some(c => c.id === x.keeper)) x.keeper = null;
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
function keeperMoveProblem(e){ return kGraph && kGraph.anchors[e.id] ? null : gateCheck(e).text; }

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
function cleanRate(e){ return CLEAN.handRate * (hasUpgrade("shovels") ? 1 : CLEAN.bareFactor) * (hasUpgrade("hoses") ? CLEAN.hoseBoost : 1) / Math.sqrt(Math.max(area(e.points), 20) / 1000); }
function dirtTick(dtMin){
  for(const e of state.exhibits) if(e.animals.length) e.dirt = Math.min(100, (e.dirt || 0) + dirtPerDay(e) * dtMin / (CLOSE_MIN - OPEN_MIN));
}
// The dirtiest exhibit keepers can reach that nobody is already cleaning
function cleanJob(c, k, min = CLEAN.dirtyAt){
  const taken = new Set(crew.filter(x => x !== c && x.cleanId).map(x => x.cleanId));
  return state.exhibits.filter(e => (e.dirt || 0) >= min && kGraph.anchors[e.id] && !taken.has(e.id) && !(k && k.zone && e.zone !== k.zone)).sort((a, b) => b.dirt - a.dirt)[0] || null;
}

// Leftover food goes into the exhibit's trays: the keeper walks in from the gate, visits the nearest trays with room, and walks back out
function startFilling(c, e){
  if(!e.gate || !c.carry) return false;
  const g = [e.gate[0], e.gate[1]]; let pos = g, left = c.carry.amount, pool = trays(e).filter(f => trayRoomOf(f, c.carry.type) > .01);
  const pts = [g], ids = [];
  while(pool.length && left > .01){
    pool.sort((a, b) => dist(pos, [a.x, a.y]) - dist(pos, [b.x, b.y]));
    const f = pool.shift(); pts.push([f.x, f.y]); ids.push(f.id); pos = [f.x, f.y]; left -= trayRoomOf(f, c.carry.type);
  }
  if(!ids.length) return false;
  pts.push(g);
  c.fill = {e:e.id, pts, ids, i:0, pos:g.slice()};
  c.job = "filling";
  return true;
}
// Where a keeper filling trays is standing, inside the fence
const fillPos = c => c.job === "filling" && c.fill ? c.fill.pos : null;
// Walk the next stretch of the round; returns the park minutes left over
function fillStep(c, k, left){
  const f = c.fill, e = f && state.exhibits.find(x => x.id === f.e);
  if(!e || !c.carry){ c.fill = null; c.job = "idle"; c.wait = 0; return left; }
  const to = f.pts[f.i + 1], d = dist(f.pos, to), go = Math.min(left, d / KEEPER.speed);
  if(d > 0){ f.pos = [f.pos[0] + (to[0] - f.pos[0]) * go * KEEPER.speed / d, f.pos[1] + (to[1] - f.pos[1]) * go * KEEPER.speed / d]; }
  k.stamina -= go * KEEPER.speed * tireRate();
  left -= go;
  if(go * KEEPER.speed < d - 1e-6) return left;
  f.pos = to.slice(); f.i++;
  const tray = f.ids[f.i - 1] && landOf(e).find(x => x.id === f.ids[f.i - 1]);
  if(tray && f.i - 1 < f.ids.length){
    tray.food = tray.food || {};
    const give = Math.min(trayRoomOf(tray, c.carry.type), c.carry.amount);
    tray.food[c.carry.type] = (tray.food[c.carry.type] || 0) + give; c.carry.amount -= give;
    noteFlow(null, e.id, give);
    k.stamina -= KEEPER.tirePerDelivery;
    if(c.carry.amount <= 0.01){ setCarry(c, null); f.pts = f.pts.slice(0, f.i + 1).concat([f.pts[f.pts.length - 1]]); f.ids = f.ids.slice(0, f.i); }
  }
  if(f.i >= f.pts.length - 1){ c.fill = null; c.job = "idle"; c.wait = 0; }
  return left;
}

function decide(c, k){
  const l = huntJob(c);
  if(l && chase(c, l)) return;
  // can't chase it from here (no dart gun to fetch, no route): let another keeper try
  if(l && l.status === "loose" && l.keeper === c.id) l.keeper = null;
  const call = callJob(c, "keeper");
  if(call && goTo(c, kGraph.anchors[call.ex], "toCall")) return;
  if(call){ call.keeper = null; c.job = "idle"; c.wait = 10; }
  const mv = moveJob(c);
  if(mv && mv.cargo && !c.cargo) c.cargo = mv.cargo;   // picked up before a reload
  if(mv && doMove(c, mv)){ c.move = mv; return; }
  if(mv && !c.cargo){ mv.keeper = null; }
  // goods in hand for a store: finish the delivery (before any break, so food doesn't ride along to the break room)
  if(c.carry && c.carry.amount > 0 && c.carry.dst){
    const d = buildingById(c.carry.dst), n = d && kGraph.anchors[d.id];
    if(n && goTo(c, n, "toHaulDst")){ c.haul = c.haul || {t:c.carry.type, src:null, dst:d.id, amount:c.carry.amount}; return; }
    returnCarry(c);
  }
  if(c.carry && c.carry.amount > 0 && c.carry.amount < 1) returnCarry(c);   // a scrap isn't worth another trip
  if(c.carry && c.carry.amount > 0){
    const jobs = shortages(k, c).filter(j => j.t === c.carry.type);
    const w = walkFrom(c.at, c); const j = jobs.filter(j => w.dist.has(kGraph.anchors[j.e.id])).sort((a, b) => w.dist.get(kGraph.anchors[a.e.id]) - w.dist.get(kGraph.anchors[b.e.id]))[0];
    if(j){ c.plan = {exhibitId:j.e.id}; goTo(c, kGraph.anchors[j.e.id], "toExhibit"); return; }
  }
  if(k.stamina < KEEPER.restBelow){ const r = nearestOf(c, restSpots()); if(r){ goTo(c, r.n, "toRest"); return; } }
  // one map of the walk from here serves every choice below
  const w = walkFrom(c.at, c);
  const near = list => { let best = null; for(const b of list){ const n = kGraph.anchors[b.id]; if(n && w.dist.has(n) && (!best || w.dist.get(n) < best.d)) best = {b, n, d:w.dist.get(n)}; } return best; };
  // the neediest exhibit that a store can actually supply
  let job = null, st = null;
  const feed = () => { c.plan = {exhibitId:job.e.id, type:job.t, src:st.b.id}; goTo(c, st.n, "toStation"); };
  // an exhibit the player just called a keeper to gets fed before anything else
  if(c.focusEx){
    for(const j of shortages(k)){ if(j.e.id !== c.focusEx) continue; const s = near(sourcesFor(j.t, k)); if(s){ job = j; st = s; break; } }
    if(job){ feed(); return; }
    c.focusEx = null;
  }
  for(const j of shortages(k)){ if(j.ratio >= KEEPER.topUpBelow) continue; const s = near(sourcesFor(j.t, k)); if(s){ job = j; st = s; break; } }
  if(job && job.ratio < .3){ feed(); return; }
  // cleaning comes before routine feeding, but not before food that's running out
  const dirty = cleanJob(c, k);
  if(dirty){ c.cleanId = dirty.id; c.cleanLow = false; if(goTo(c, kGraph.anchors[dirty.id], "toClean")) return; c.cleanId = null; }
  if(job){ feed(); return; }
  // nothing else to do: tidy up whatever is dirtiest, however little muck there is
  const tidy = cleanJob(c, k, CLEAN.tidyAbove + .01);
  if(tidy){ c.cleanId = tidy.id; c.cleanLow = true; if(goTo(c, kGraph.anchors[tidy.id], "toClean")) return; c.cleanId = null; }
  c.job = "idle"; c.wait = 15; c.plan = null;
  const home = near(stations()); if(home && home.d > 1) goTo(c, home.n, "home");
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
  if(c.job === "toCall"){
    const call = callFor(c), e = call && state.exhibits.find(x => x.id === call.ex);
    if(call) state.staff.calls = state.staff.calls.filter(x => x !== call);
    c.job = "idle"; c.wait = 0;
    if(!e) return;
    k.stamina -= KEEPER.tirePerDelivery;
    c.focusEx = e.id;
    // hand over whatever food they're carrying that the exhibit is short of
    if(c.carry && c.carry.amount > 0 && !c.carry.dst){
      e.stock = e.stock || {};
      const give = Math.min(roomFor(e, c.carry.type), c.carry.amount);
      e.stock[c.carry.type] = (e.stock[c.carry.type] || 0) + give; c.carry.amount -= give;
      noteFlow(null, e.id, give);
      if(c.carry.amount <= 0.01) setCarry(c, null);
      if(c.carry && startFilling(c, e)){ events.toast(`${k.name} checked ${e.name}.`, "good"); return; }
    }
    events.toast(`${k.name} checked ${e.name}.`, "good");
    if((e.dirt || 0) > 2){ c.cleanId = e.id; c.cleanLow = false; c.job = "mucking"; }
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
    c.job = "idle"; c.wait = 1; return;   // it moved; decide() chases it again (the wait stops a keeper at the stop re-planning forever)
  }
  if(c.job === "returning"){
    const l = c.hunt, e = l && state.exhibits.find(x => x.id === l.from);
    if(l) returnAnimal(l, e && kGraph.anchors[e.id] === c.at ? e : null);
    c.hunt = null; c.job = "idle"; c.wait = 0; return;
  }
  if(c.job === "toStation"){
    // drop off whatever's left, pick up a full load of the food that's needed most
    returnCarry(c);
    const t = c.plan && c.plan.type || (shortages(k)[0] || {}).t;
    if(!t){ c.job = "idle"; c.wait = 10; return; }
    const want = shortages(k).filter(j => j.t === t).reduce((s, j) => s + j.short, 0);
    let amount = Math.min(carryMax(), Math.max(1, Math.ceil(want)));
    // CERES can only hand out what it has grown, and stores only what's on their shelves
    const src = buildingById(c.plan && c.plan.src);
    if(t === "paleoflora"){ amount = Math.min(amount, Math.floor(state.ceres.stock)); if(amount < 1){ c.job = "idle"; c.wait = 10; return; } state.ceres.stock -= amount; }
    else { amount = Math.min(amount, src ? Math.floor(stockOf(src, t)) : 0); if(amount < 1){ c.job = "idle"; c.wait = 10; return; } takeGood(src, t, amount); }
    setCarry(c, {type:t, amount});
    k.stamina -= KEEPER.tirePerDelivery;
    const j = shortages(k, c).find(j => j.t === t);
    if(j){ c.plan = {exhibitId:j.e.id}; goTo(c, kGraph.anchors[j.e.id], "toExhibit"); } else c.job = "idle";
    return;
  }
  if(c.job === "toHaulSrc"){
    const h = c.haul, src = h && buildingById(h.src), dst = h && buildingById(h.dst);
    returnCarry(c); c.haul = h;
    // hand over what's there, up to the load asked for and the room the other end still has
    const amount = src && dst ? Math.min(h.amount, supplyOf(src, h.t), Math.floor(storeRoom(dst, h.t))) : 0;
    if(amount < 1){ c.haul = null; c.job = "idle"; c.wait = 5; return; }
    takeSupply(src, h.t, amount);
    setCarry(c, {type:h.t, amount, dst:h.dst});
    k.stamina -= KEEPER.tirePerDelivery;
    if(!goTo(c, kGraph.anchors[h.dst] || c.at, "toHaulDst")) c.job = "toHaulDst";
    return;
  }
  if(c.job === "toHaulDst"){
    const d = buildingById(c.carry && c.carry.dst);
    if(d && c.carry){
      const give = addGood(d, c.carry.type, c.carry.amount);
      c.carry.amount -= give; noteFlow(c.haul && c.haul.src, d.id, give);
      k.stamina -= KEEPER.tirePerDelivery;
    }
    returnCarry(c);
    c.job = "idle"; c.wait = 0;
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
      noteFlow(c.plan && c.plan.src, e.id, give);
      k.stamina -= KEEPER.tirePerDelivery;
      if(c.carry.amount <= 0.01) setCarry(c, null);
      if(c.carry && startFilling(c, e)){ c.plan = null; return; }
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
  syncAtvs();
  callsTidy();
  for(const c of crew){
    const k = state.staff.keepers.find(x => x.id === c.id);
    if(!c.at){ const s = stations()[0]; if(!s) continue; c.at = kGraph.anchors[s.id]; c.job = "idle"; }
    let left = dtMin, steps = 0;
    while(left > 0 && steps++ < 60){
      // a call comes before anything but an escape: drop the job as soon as the keeper is standing on a node
      const call = c.job !== "toCall" ? callFor(c) : null;
      if(call && !callBusy(c) && c.t === 0){ takeCall(c, call); if(c.job === "toCall") continue; }
      if(c.job === "mucking"){
        const e = state.exhibits.find(x => x.id === c.cleanId);
        if(!e){ c.job = "idle"; c.cleanId = null; continue; }
        // stop when it's clean, when the keeper is worn out, or when an escape needs everyone
        const need = Math.max(0, (e.dirt || 0) - 2) / cleanRate(e), w = Math.min(left, need);
        e.dirt = Math.max(0, (e.dirt || 0) - cleanRate(e) * w); k.stamina -= CLEAN.tirePerMin * w; left -= w;
        // light tidying gives way to real work: food that a store can supply
        const busy = c.cleanLow && shortages(k).some(j => j.ratio < KEEPER.topUpBelow && sourcesFor(j.t, k).length);   // same bar as decide(), or a tidy-up is dropped the moment it starts
        if(e.dirt <= 2 || busy || k.stamina < KEEPER.restBelow || state.safety.loose.some(needsKeeper)){ c.job = "idle"; c.cleanId = null; c.wait = 0; }
        continue;
      }
      if(c.job === "filling"){ left = fillStep(c, k, left); continue; }
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
        else { left -= remaining / sp; if(!drive) k.stamina -= remaining * tireRate(); c.at = nx; c.route.shift(); c.t = 0; atNode(c); if(!c.route.length) arrive(c, k); }
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
      // groves in the exhibit feed part of it; keepers bring the rest
      let eat = need[t] * dtMin / (CLOSE_MIN - OPEN_MIN) * (1 - browseShare(e, t, need[t]));
      eat = eatFromTrays(e, t, eat);
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
  for(const a of atvs()){ a.at = null; a.by = null; }   // every ATV goes back to its depot overnight
  // food in hand stays with the keeper for tomorrow (a long trip isn't undone overnight); Paleoflora goes back to CERES
  for(const k of state.staff.keepers) k.stamina = 100; for(const c of crew){ if(c.carry && c.carry.type === "paleoflora") returnCarry(c); resetAtv(c); c.at = null; c.route = []; c.job = "idle"; c.plan = null; c.gun = false; c.hunt = null; c.cleanId = null; c.haul = null; c.fill = null; c.focusEx = null; } state.staff.calls = []; }

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
  const hb = c.haul && buildingById(c.haul.dst), hs = c.haul && c.haul.src && buildingById(c.haul.src);
  const hv = c.carry && c.carry.dst ? buildingById(c.carry.dst) : hb;
  const src = c.plan && c.plan.src && buildingById(c.plan.src);
  return {toStation:`Heading to ${c.plan && c.plan.type === "paleoflora" ? "CERES" : src ? "the " + BUILDINGS[src.type].label.toLowerCase() : "a store"}` + (e ? ` for ${e.name}` : ""),
          toHaulSrc:`Heading to the ${hs ? BUILDINGS[hs.type].label.toLowerCase() : "store"} to restock the ${hb ? BUILDINGS[hb.type].label.toLowerCase() : "store"}`,
          toHaulDst:`Restocking the ${hv ? BUILDINGS[hv.type].label.toLowerCase() : "store"}${carry}`, toExhibit:`Taking food to ${e ? e.name : "an exhibit"}${carry}`, filling:`Filling food trays in ${(state.exhibits.find(x => x.id === (c.fill && c.fill.e)) || {}).name || "an exhibit"}${carry}`,
          toClean:`Heading to muck out ${(state.exhibits.find(x => x.id === c.cleanId) || {}).name || "an exhibit"}`, mucking:`Mucking out ${(state.exhibits.find(x => x.id === c.cleanId) || {}).name || "an exhibit"}`,
          toCall:`Called to ${((state.exhibits.find(x => x.id === (callFor(c) || {}).ex)) || {name:"an exhibit"}).name}`, toRest:"Going on break", resting:"On break", home:"Walking back to a station",
          toGun:"Fetching a dart gun", hunting:`Tracking the escaped ${c.hunt ? SPECIES_BY_ID[c.hunt.sp].name : "animal"}`,
          sedating:"Sedating an escaped animal", returning:"Bringing a sedated animal back", toSedated:`Collecting a darted ${c.hunt ? SPECIES_BY_ID[c.hunt.sp].name : "animal"}`,
          toPickup:`Collecting a ${c.move ? SPECIES_BY_ID[c.move.sp].name : "animal"} ${c.move && c.move.med ? (pmcBuilding() && c.move.to === pmcBuilding().id ? "for the PMC" : "from the PMC") : "to move"}`,
          toDropoff:`${c.move && c.move.med && pmcBuilding() && c.move.to === pmcBuilding().id ? "Carrying a sick" : "Moving a"} ${c.cargo ? SPECIES_BY_ID[c.cargo.sp].name : "animal"}`}[c.job] || (carry ? `Waiting${carry}` : "Waiting for work");
}

/* ---------- staff vehicles ---------- */

// Every depot comes with its own set of ATVs. They are shared: anyone can take a free one, and it stays
// wherever the last driver got off. state.staff.atvs: {id, depot, at: stop key or null (in its depot), by: staff id or null}
const depots = () => state.buildings.filter(b => b.type === "depot");
const depotWorking = b => isReachable(b) && condOf(b) >= VEHICLES.offlineBelow;
const atvs = () => state.staff.atvs;
const allStaffList = () => state.staff.keepers.concat(state.staff.mechanics, state.staff.vets, state.staff.custodians || [], state.staff.guards || []);
// A broken depot grounds its own ATVs wherever they are parked
function usableAtvs(){
  if(!hasTech("vehicles")) return [];
  const ok = new Set(depots().filter(depotWorking).map(b => b.id));
  return atvs().filter(a => ok.has(a.depot));
}
function atvNode(a){ return (a.at && kGraph.nodes.get(a.at)) || kGraph.anchors[a.depot] || null; }
// Stops where an ATV is free to take (the person's own set-aside one is released first)
function freeAtvNodes(c){
  releaseAtv(c);
  const out = new Set();
  for(const a of usableAtvs()) if(!a.by){ const n = atvNode(a); if(n) out.add(n); }
  return out;
}
// Each depot holds its set of ATVs; demolishing one takes them with it
function syncAtvs(){
  const list = atvs(), ids = new Set(depots().map(b => b.id));
  for(let i = list.length - 1; i >= 0; i--) if(!ids.has(list[i].depot)) list.splice(i, 1);
  for(const b of depots()){ let n = list.filter(a => a.depot === b.id).length; while(n++ < VEHICLES.perDepot) list.push({id:uid("a-"), depot:b.id, at:null, by:null}); }
  const have = new Set(list.map(a => a.id)), held = new Set();
  for(const c of [...crew, ...mcrew, ...vcrew]){
    if(c.atvId && !have.has(c.atvId)){ c.atvId = null; c.riding = false; c.mountAt = c.parkAt = null; }
    if(c.atvId) held.add(c.atvId);
  }
  for(const a of list) if(a.by && !held.has(a.id)) a.by = null;
}
// Is this person driving right now? Only while on an ATV, and only on a service road.
function onAtv(c){ const nx = c.route && c.route[0]; return !!(c.riding && nx && c.at && c.at.svc && c.at.svc.has(nx)); }
