/* =====================================================================
   LOGISTICS
   Food and medicine are goods. The dock buys them, farms and CERES make them,
   stores hold them (and let them spoil), and keepers carry them where they're needed.
   Work zones decide which keepers look after which exhibits and stores.
   Nobody draws supply lines. They appear from what keepers actually haul.
   ===================================================================== */

function freshLogi(){ return {flow:{}, last:{}, lost:0, lostCost:0, lostDay:0, notice:false}; }

/* ---------- stores ---------- */

const storeOf = b => BUILDINGS[b.type].store || null;
const storesBuilt = () => state.buildings.filter(storeOf);
// Stores keepers can actually walk to
const stores = () => storesBuilt().filter(b => kGraph && kGraph.anchors[b.id]);
const buildingById = id => state.buildings.find(b => b.id === id) || null;
const storeCap = b => Math.round(storeOf(b).cap * (hasUpgrade("crates") ? LOGI.crateBoost : 1));
const stockOf = (b, t) => (b.store && b.store[t]) || 0;
const storeTotal = b => b.store ? Object.values(b.store).reduce((s, n) => s + n, 0) : 0;
function storeRoom(b, t){ const d = storeOf(b); return d && d.holds.includes(t) ? Math.max(0, storeCap(b) - storeTotal(b)) : 0; }
function addGood(b, t, n){
  const r = Math.min(n, storeRoom(b, t));
  if(r > 0){ b.store = b.store || {}; b.store[t] = (b.store[t] || 0) + r; }
  return Math.max(0, r);
}
function takeGood(b, t, n){
  const r = Math.min(n, stockOf(b, t));
  if(r > 0) b.store[t] -= r;
  return Math.max(0, r);
}
// CERES keeps its own stock of medicine (and Paleoflora), which keepers collect
const cereses = () => state.buildings.filter(b => b.type === "ceres" && kGraph && kGraph.anchors[b.id]);
function supplyOf(b, t){
  if(b.type === "ceres") return t === "meds" ? Math.floor(state.ceres.meds || 0) : 0;
  return Math.floor(stockOf(b, t));
}
function takeSupply(b, t, n){
  if(b.type === "ceres"){ const r = Math.min(n, Math.floor(state.ceres.meds || 0)); state.ceres.meds -= r; return r; }
  return takeGood(b, t, n);
}
// Put goods somewhere: a building to try first, then anything that holds them. Anything that fits nowhere is lost.
function stashGood(t, n, first){
  let left = n;
  const order = (first ? [first] : []).concat(storesBuilt().filter(b => b !== first).sort((a, b) => storeRoom(b, t) - storeRoom(a, t)));
  for(const b of order){ if(left <= 0.01) break; left -= addGood(b, t, left); }
  return n - Math.max(0, left);
}
const haulMax = () => carryMax() * (hasUpgrade("forklift") ? LOGI.forklift : 1);
const pmcStock = () => { const p = pmcBuilding(); return p ? stockOf(p, "meds") : 0; };
const medOnHand = pmcStock;
function useMeds(n){ const p = pmcBuilding(); if(p) takeGood(p, "meds", n); }

/* ---------- zones ---------- */

const zones = () => state.zones || [];
const zoneById = id => zones().find(z => z.id === id) || null;
const zoneName = id => (zoneById(id) || {}).name || "No zone";
const keeperRec = c => state.staff.keepers.find(k => k.id === c.id) || null;
// A new exhibit or building sitting inside a zone joins it
function autoZone(item){
  if(item.zone || !item.points) return;
  const [x, y] = centroid(item.points), z = zones().find(z => inPoly(x, y, z.points));
  if(z) item.zone = z.id;
}
function zoneProblem(pts){
  if(pts.length < 3) return "A zone needs at least 3 corners.";
  if(selfCrosses(pts)) return "The zone crosses itself.";
  if(!insidePlot(pts)) return "Keep it inside the park boundary.";
  if(area(pts) < ZONE_MIN_AREA) return "That zone is too small.";
  return null;
}
function zoneMembers(z){
  return {exhibits:state.exhibits.filter(e => e.zone === z.id), stores:state.buildings.filter(b => b.zone === z.id), keepers:state.staff.keepers.filter(k => k.zone === z.id)};
}
// Zones go: everything in them goes back to working anywhere
function dropZone(id){
  for(const e of state.exhibits) if(e.zone === id) delete e.zone;
  for(const b of state.buildings) if(b.zone === id) delete b.zone;
  for(const k of state.staff.keepers) if(k.zone === id) delete k.zone;
}
function setZone(kind, id, zid){
  const it = kind === "keeper" ? state.staff.keepers.find(k => k.id === id) : findItem(kind, id);
  if(!it) return;
  if(zid && zoneById(zid)) it.zone = zid; else delete it.zone;
}

/* ---------- what the park needs ---------- */

// Units a day an exhibit wants of a store-held food. Plain hay stands in for Paleoflora when CERES has none.
function foodDemand(e, t){
  const need = dailyNeed(e);
  return (need[t] || 0) + (t === "plants" && !need.plants && !paleofloraReady() ? need.paleoflora || 0 : 0);
}
const zoneDemand = (zid, t) => state.exhibits.reduce((s, e) => s + ((e.zone || null) === zid ? foodDemand(e, t) : 0), 0);
const parkDemand = t => state.exhibits.reduce((s, e) => s + foodDemand(e, t), 0);
const parkProduction = t => state.buildings.reduce((s, b) => s + (isReachable(b) && BUILDINGS[b.type].makes ? BUILDINGS[b.type].makes[t] || 0 : 0), 0);
const sameHolders = (b, t) => storesBuilt().filter(x => x.type === b.type && (x.zone || null) === (b.zone || null) && storeOf(x).holds.includes(t) && kGraph && kGraph.anchors[x.id]);

// How much of a good a store should hold. Docks and farms are where goods come from, so they aren't restocked.
function storeTarget(b, t){
  const d = storeOf(b);
  if(!d || d.source || d.dock || !d.holds.includes(t)) return 0;
  const cap = storeCap(b);
  if(b.type === "pmc") return Math.ceil(cap * .8);
  if(t === "meds") return d.bulk && cereses().length ? Math.min(Math.round(cap * .05), 20) : 0;
  if(d.bulk) return Math.min(Math.round(cap * .6), Math.ceil(parkDemand(t) * LOGI.bulkDays / Math.max(1, storesBuilt().filter(x => x.type === b.type).length)));
  // a station: its zone's food for a day or so, shared with the zone's other stations
  const share = sameHolders(b, t).length || 1;
  return Math.min(Math.round(cap * .7), Math.ceil(zoneDemand(b.zone || null, t) * LOGI.hubDays / share));
}

/* ---------- restock hauls ---------- */

const inbound = (id, t) => crew.reduce((s, c) => s + (c.haul && c.haul.dst === id && c.haul.t === t ? (c.carry && c.carry.dst === id ? c.carry.amount : c.haul.amount) : 0), 0);
// Sources a restock can draw on. Stations and PMCs pull from bulk stores, docks, farms, and CERES. Bulk stores pull from docks and farms.
function haulSources(j){
  const out = [];
  for(const b of stores()){
    const d = storeOf(b); if(b === j.d || supplyOf(b, j.t) < 1) continue;
    if(j.cls === 1 ? (d.bulk || d.source) : (d.dock || d.source)) out.push(b);
  }
  if(j.t === "meds") for(const b of cereses()) if(supplyOf(b, "meds") >= 1) out.push(b);
  return out;
}
// The most run-down store this keeper can restock, with the nearest place to get what it needs. `near` finds the closest of a list.
function pickHaul(k, near){
  const kz = k && k.zone, cands = [];
  for(const d of stores()){
    const dd = storeOf(d); if(dd.source || dd.dock) continue;
    if(kz && d.zone && d.zone !== kz) continue;
    for(const t of dd.holds){
      const tgt = storeTarget(d, t); if(tgt <= 0) continue;
      const have = stockOf(d, t) + inbound(d.id, t), need = tgt - have;
      if(have >= tgt * .6 || need < Math.min(5, tgt)) continue;
      cands.push({d, t, need, cls:dd.bulk ? 2 : 1, ratio:have / tgt});
    }
  }
  cands.sort((a, b) => a.cls - b.cls || a.ratio - b.ratio);
  for(const j of cands){
    const src = near(haulSources(j));
    if(src) return {...j, src:src.b, amount:Math.max(1, Math.min(haulMax(), Math.ceil(j.need), supplyOf(src.b, j.t)))};
  }
  return null;
}
function noteFlow(srcId, dstId, n){
  if(!srcId || n <= 0) return;
  const f = state.logi.flow, key = srcId + ">" + dstId;
  f[key] = (f[key] || 0) + n;
}
// Lines on the map: what keepers hauled today and yesterday, from one building to another
function supplyLines(){
  const out = [], seen = {};
  for(const f of [state.logi.last, state.logi.flow]) for(const [key, n] of Object.entries(f)) seen[key] = (seen[key] || 0) + n;
  for(const [key, n] of Object.entries(seen)){
    const [a, b] = key.split(">").map(buildingById); if(!a || !b) continue;
    out.push({a:centroid(a.points), b:centroid(b.points), n});
  }
  return out;
}

/* ---------- through the day and night ---------- */

// Farms and ranches fill their own stores through the day. A full store stops production.
function logiTick(dtMin){
  if(state.logi.notice){ state.logi.notice = false; events.toast("Food is now a real supply. Build a Delivery Dock, a station, and keepers will carry it to the animals.", "bad"); }
  const share = dtMin / (CLOSE_MIN - OPEN_MIN);
  for(const b of state.buildings){
    const make = BUILDINGS[b.type].makes; if(!make || !isReachable(b)) continue;
    for(const [t, n] of Object.entries(make)) addGood(b, t, n * share);
  }
}

const unitPrice = t => FOOD_UNIT_COST * LOGI.dockMarkup * (DOCK_PRICE[t] || 1);
// What a dock should hold: the park's food for a couple of days, less what farms already make
function dockOrders(b){
  const out = {};
  for(const t of FEED_GOODS){
    out[t] = b.auto === false ? ((b.orders || {})[t] || 0)
      : Math.max(0, Math.ceil((parkDemand(t) - parkProduction(t)) * LOGI.autoDays));
  }
  return out;
}
function dockTotals(){ const o = {}; for(const b of state.buildings) if(b.type === "dock") for(const [t, n] of Object.entries(dockOrders(b))) o[t] = (o[t] || 0) + n; return o; }
// Overnight delivery: top up each dock to its order. Partner parks pay while they're still feeding.
function dockDelivery(){
  let spent = 0, units = 0;
  for(const b of state.buildings){
    if(b.type !== "dock" || !isReachable(b)) continue;
    const orders = dockOrders(b);
    for(const t of FEED_GOODS){
      const price = freeFeeding() ? 0 : unitPrice(t);
      let n = Math.min(Math.floor(orders[t] - stockOf(b, t)), Math.floor(storeRoom(b, t)));
      if(price) n = Math.min(n, Math.floor(Math.max(0, state.money) / price));
      if(n < 1) continue;
      addGood(b, t, n); units += n;
      if(price){ spend(Math.round(n * price), "feed"); spent += n * price; }
    }
  }
  if(units) events.toast(`The dock took in ${units} units of food${spent ? ` for ${money(Math.round(spent))}` : ", on the partner parks"}.`);
}
function rushOrder(b, t){
  const price = Math.round(LOGI.rushLot * unitPrice(t) * LOGI.rushMarkup);
  if(b.type !== "dock") return "Only a dock takes orders.";
  if(!isReachable(b)) return "Trucks can't reach the dock.";
  if(!canAfford(price)) return `A rush order costs ${money(price)}.`;
  const n = Math.min(LOGI.rushLot, Math.floor(storeRoom(b, t)));
  if(n < 1) return "The dock is full.";
  spend(Math.round(price * n / LOGI.rushLot), "feed"); addGood(b, t, n);
  return null;
}

// Rot: every store loses a share of what it holds. Cold stores slow it, but only while powered.
function spoilRate(b, t){
  const d = storeOf(b);
  const base = d.cold ? (b.powered === false ? 1 : LOGI.coldSpoil) : d.spoil;
  return GOODS[t].spoil * base * (hasUpgrade("coolers") ? LOGI.coolerCut : 1);
}
function spoilNight(){
  const L = state.logi; L.lost = 0; L.lostCost = 0;
  for(const b of storesBuilt()){
    if(!b.store) continue;
    for(const t of Object.keys(b.store)){
      const lose = b.store[t] * spoilRate(b, t);
      b.store[t] = Math.max(0, b.store[t] - lose);
      L.lost += lose; L.lostCost += lose * (t === "meds" ? MED_UNIT_VALUE : FOOD_UNIT_COST);
    }
  }
  const c = state.ceres; if(c.meds) c.meds = Math.max(0, c.meds - c.meds * GOODS.meds.spoil);
  L.lostDay = state.day;
  if(L.lost >= 10) events.toast(`${Math.round(L.lost)} units of food spoiled overnight, worth about ${money(Math.round(L.lostCost))}.`, "bad");
}
const MED_UNIT_VALUE = 60;

function logiNight(){
  spoilNight();
  dockDelivery();
  state.logi.last = state.logi.flow; state.logi.flow = {};
}

// Everything the park holds right now, for the park office
function stockSummary(){
  const out = {};
  for(const t of FEED_GOODS) out[t] = {have:0, cap:0, need:parkDemand(t), make:parkProduction(t)};
  out.paleoflora = {have:Math.floor(state.ceres.stock || 0), need:state.exhibits.reduce((s, e) => s + (dailyNeed(e).paleoflora || 0), 0)};
  for(const b of storesBuilt()) for(const t of FEED_GOODS){ if(storeOf(b).holds.includes(t)) out[t].cap += storeCap(b); out[t].have += stockOf(b, t); }
  return out;
}
// Exhibits and stores keepers can't reach, or that no keeper is covering
function logiWarnings(){
  const w = [];
  if(!freeFeeding() || state.day + 2 >= state.staff.feedFrom){
    if(state.exhibits.some(e => e.animals.length) && !state.buildings.some(b => b.type === "dock") && !state.buildings.some(b => BUILDINGS[b.type].makes)) w.push("Nothing here buys or makes food. Build a Delivery Dock.");
  }
  const ks = state.staff.keepers;
  for(const z of zones()){
    const m = zoneMembers(z);
    if(m.exhibits.some(e => e.animals.length) && !ks.some(k => k.zone === z.id) && ks.every(k => k.zone)) w.push(`${z.name} has animals but no keeper is assigned to it.`);
  }
  return w;
}
