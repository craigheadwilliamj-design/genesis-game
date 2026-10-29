/* =====================================================================
   LOGISTICS
   Food and medicine are goods. The dock buys them, farms and the Botany Lab make them,
   stores hold them (and let them spoil), and keepers carry them where they're needed.
   Work zones decide which keepers look after which exhibits and stores.
   Nobody draws supply lines. They appear from what keepers actually haul.
   ===================================================================== */

function freshLogi(){ return {flow:{}, last:{}, lost:0, lostCost:0, lostDay:0, notice:false, used:{}, usedLast:{}, hist:[], orders:{}, auto:false, truckDay:0, guestFrom:GUEST_GOODS_FROM}; }
// Keepers carry food from stations to exhibits; custodians stock every store (animal food, medicine, stand and shop goods)
const KEEPER_GOODS = FEED_GOODS.concat(MED_GOODS, [CMED]);
const isGuestGood = t => GUEST_GOODS.includes(t);
// Until this day, suppliers deliver straight to stands and shops, so they never run out
const guestGoodsFree = () => state.day < (state.logi.guestFrom || 0);

/* ---------- stores ---------- */

const storeOf = b => BUILDINGS[b.type].store || null;
const storesBuilt = () => state.buildings.filter(storeOf);
// Stores keepers can actually walk to
const stores = () => storesBuilt().filter(b => kGraph && kGraph.anchors[b.id]);
const buildingById = id => state.buildings.find(b => b.id === id) || null;
const storeCap = b => Math.round(storeOf(b).cap * (hasUpgrade("crates") ? LOGI.crateBoost : 1));
const stockOf = (b, t) => (b.store && b.store[t]) || 0;
const storeTotal = b => b.store ? Object.values(b.store).reduce((s, n) => s + n, 0) : 0;
function storeRoom(b, t){ const d = storeOf(b); return d && d.holds.includes(t) ? Math.max(0, Math.min(storeCap(b) - storeTotal(b), b.type === "pmc" ? pmcShare(b) - stockOf(b, t) : Infinity)) : 0; }
// The PMC's shelves are split evenly and for good between contemporary medicine and each era's, so no one medicine can crowd out the rest
const pmcShare = b => Math.floor(storeCap(b) / (MED_GOODS.length + 1));
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
// The Botany Lab keeps its own stock of medicine (and Paleoflora), which keepers collect
const cereses = () => state.buildings.filter(b => b.type === "ceres" && kGraph && kGraph.anchors[b.id]);
function supplyOf(b, t){
  if(b.type === "ceres") return MED_GOODS.includes(t) ? Math.floor(cerMeds()[t] || 0) : 0;
  return Math.floor(stockOf(b, t));
}
function takeSupply(b, t, n){
  if(b.type === "ceres"){ const m = cerMeds(), r = Math.min(n, Math.floor(m[t] || 0)); m[t] -= r; return r; }
  return takeGood(b, t, n);
}
// Put goods somewhere: a building to try first, then anything that holds them. Anything that fits nowhere is lost.
function stashGood(t, n, first){
  let left = n;
  const order = (first ? [first] : []).concat(storesBuilt().filter(b => b !== first).sort((a, b) => storeRoom(b, t) - storeRoom(a, t)));
  for(const b of order){ if(left <= 0.01) break; left -= addGood(b, t, left); }
  return n - Math.max(0, left);
}
// Medicine a worker is left holding goes to the PMC first, then a cold store, then a dock; what still doesn't fit is wasted
const isMedGood = t => t === CMED || MED_GOODS.includes(t);
function stashMed(t, n){
  let left = n;
  const order = [...storesBuilt().filter(b => b.type === "pmc"), ...storesBuilt().filter(b => storeOf(b).cold), ...storesBuilt().filter(b => storeOf(b).dock)];
  for(const b of order){ if(left <= .01) break; left -= addGood(b, t, left); }
  if(left > .01) state.today.wasted = (state.today.wasted || 0) + left * (t === CMED ? MODERN.cost : MED_UNIT_VALUE);   // what it was worth, for the end-of-day report
  return n - Math.max(0, left);
}
// The Botany Lab keeps a stock per medicine (state.ceres.meds is {medpal, medmes, medcen})
function cerMeds(){ const c = state.ceres; if(!c.meds || typeof c.meds !== "object") c.meds = {medpal:0, medmes:0, medcen:0}; return c.meds; }
const cerMedTotal = () => MED_GOODS.reduce((s, t) => s + (cerMeds()[t] || 0), 0);
// a good's number for the PMC (all three together when none is named)
const pmcStock = g => { const p = pmcBuilding(); return p ? (g ? stockOf(p, g) : MED_GOODS.reduce((s, t) => s + stockOf(p, t), 0)) : 0; };   // no good named: the era medicines together
const medOnHand = pmcStock;
function useMeds(n, g){ const p = pmcBuilding(); if(p) noteUse(g, takeGood(p, g, n)); }
// the eras whose medicine the Research Lab has researched, so the PMC only reserves room for those
const medGoodsWanted = () => MED_GOODS.filter(g => hasTech(MED_TECH[Object.keys(MED_GOOD).find(k => MED_GOOD[k] === g)]));

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
const STAFF_LISTS = {keeper:"keepers", mechanic:"mechanics", vet:"vets", custodian:"custodians", guard:"guards"};
function zoneMembers(z){
  const mine = list => state.staff[list].filter(k => k.zone === z.id);
  return {exhibits:state.exhibits.filter(e => e.zone === z.id), stores:state.buildings.filter(b => b.zone === z.id), keepers:mine("keepers").filter(k => !isAqua(k)), aquarists:mine("keepers").filter(isAqua), mechanics:mine("mechanics"), vets:mine("vets"), custodians:mine("custodians"), guards:mine("guards")};
}
// Zones go: everything in them goes back to working anywhere
function dropZone(id){
  for(const e of state.exhibits) if(e.zone === id) delete e.zone;
  for(const b of state.buildings) if(b.zone === id) delete b.zone;
  for(const list of Object.values(STAFF_LISTS)) for(const k of state.staff[list]) if(k.zone === id) delete k.zone;
}
function setZone(kind, id, zid){
  const it = STAFF_LISTS[kind] ? state.staff[STAFF_LISTS[kind]].find(k => k.id === id) : findItem(kind, id);
  if(!it) return;
  if(zid && zoneById(zid)) it.zone = zid; else delete it.zone;
}

/* ---------- what the park needs ---------- */

// Units a day an exhibit wants of a store-held food. Plain hay stands in for Paleoflora when the Botany Lab has none.
function foodDemand(e, t){
  const need = dailyNeed(e);
  return (need[t] || 0) + (t === "plants" && !need.plants && !paleofloraReady() ? need.paleoflora || 0 : 0);
}
const zoneDemand = (zid, t) => state.exhibits.reduce((s, e) => s + ((e.zone || null) === zid ? foodDemand(e, t) : 0), 0);
const parkDemand = t => state.exhibits.reduce((s, e) => s + foodDemand(e, t), 0);
// Guest goods the park gets through in a day: yesterday's sales, but never less than the crowd would buy.
// Sales alone undercount: shelves that ran dry sold less, and ordering only that much kept them dry.
function guestDemand(t){
  const last = (state.logi.usedLast || {})[t] || 0;
  const sold = state.buildings.some(b => isVendor(b) && menuOf(b).some(m => MENU[m.id].good === t));
  return Math.max(last, sold ? Math.ceil((derived ? derived.demand : 0) * GUEST_USE[t]) : 0);
}
const demandOf = t => isGuestGood(t) ? guestDemand(t) : parkDemand(t);
const parkProduction = t => state.buildings.reduce((s, b) => s + (isReachable(b) && BUILDINGS[b.type].makes ? BUILDINGS[b.type].makes[t] || 0 : 0), 0);
const sameHolders = (b, t) => storesBuilt().filter(x => x.type === b.type && (x.zone || null) === (b.zone || null) && storeOf(x).holds.includes(t) && kGraph && kGraph.anchors[x.id]);

// How much of a good a store should hold. Docks and farms are where goods come from, so they aren't restocked.
function storeTarget(b, t){
  const d = storeOf(b);
  if(!d || d.source || d.dock || !d.holds.includes(t)) return 0;
  const cap = storeCap(b);
  if(b.type === "pmc") return medGoodsWanted().concat(CMED).includes(t) ? Math.ceil(pmcShare(b) * .8) : 0;
  if(t === CMED) return d.bulk && hasDept("pmc") ? Math.min(Math.round(cap * .1), 60) : 0;   // a cold store keeps a buffer for the PMC
  if(MED_GOODS.includes(t)) return d.bulk && cereses().length && medGoodsWanted().includes(t) ? Math.min(Math.round(cap * .1), 60) : 0;
  if(BUILDINGS[b.type].rooms) return t === "merch" ? Math.round(cap * .8) : 0;
  // a stand or shop keeps most of its shelves full of what its menu uses, split between its goods
  if(d.vendor){
    const uses = menuOf(b).map(m => MENU[m.id].good), mine = uses.filter(g => g === t).length;
    return mine ? Math.round(cap * .8 * mine / uses.length) : 0;
  }
  if(d.bulk) return Math.min(Math.round(cap * .6), Math.ceil(demandOf(t) * LOGI.bulkDays / Math.max(1, storesBuilt().filter(x => x.type === b.type).length)));
  // a station: its zone's food for a day or so, shared with the zone's other stations
  const share = sameHolders(b, t).length || 1;
  return Math.min(Math.round(cap * .7), Math.ceil(zoneDemand(b.zone || null, t) * LOGI.hubDays / share));
}

/* ---------- restock hauls ---------- */

const inbound = (id, t) => crew.concat(ccrew).reduce((s, c) => s + (c.haul && c.haul.dst === id && c.haul.t === t ? (c.carry && c.carry.dst === id ? c.carry.amount : c.haul.amount) : 0), 0);
// Sources a restock can draw on. Stations and PMCs pull from bulk stores, docks, farms, and the Botany Lab. Bulk stores pull from docks and farms.
function haulSources(j){
  const out = [];
  for(const b of stores()){
    const d = storeOf(b); if(b === j.d || supplyOf(b, j.t) < 1) continue;
    if(j.cls <= 1 ? (d.bulk || d.source) : (d.dock || d.source)) out.push(b);
  }
  if(MED_GOODS.includes(j.t)) for(const b of cereses()) if(supplyOf(b, j.t) >= 1) out.push(b);
  return out;
}
// The least worth a trip: food moves in lots of 5, but medicine is used a dose or two at a time and the PMC only holds a few, so it can't wait for 5 to be missing
const restockLot = t => MED_GOODS.includes(t) || t === CMED ? HEALTH.dose : 5;
// The most run-down store this worker can restock, with the nearest place to get what it needs. `near` finds the closest of a list.
// Only custodians restock stores: they pass the goods and a carry limit of their own. `only` is a building a custodian was called to: fill it to its target.
// Stands, shops and hotels are filled in the evening restock; through the day they're only topped up once they drop under LOGI.lowMark.
function pickHaul(k, near, goods, most, only){
  const kz = k && k.zone, cands = [], eve = restockEvening();
  for(const d of only ? [only] : stores()){
    const dd = storeOf(d); if(!dd || dd.source || dd.dock) continue;
    if(!only && kz && d.zone && d.zone !== kz) continue;
    const gate = only ? 1 : dd.vendor ? (eve ? .9 : LOGI.lowMark) : .6;
    for(const t of dd.holds){
      if(!goods.includes(t)) continue;
      const tgt = storeTarget(d, t); if(tgt <= 0) continue;
      // a store only takes what fits: every good shares its room
      const have = stockOf(d, t) + inbound(d.id, t), room = storeRoom(d, t) - dd.holds.reduce((s, x) => s + inbound(d.id, x), 0);
      const need = Math.min(tgt - have, room);
      if(have >= tgt * gate || need < (only ? 1 : Math.min(restockLot(t), tgt))) continue;
      cands.push({d, t, need, cls:eve && dd.vendor ? 0 : dd.bulk ? 2 : 1, ratio:have / tgt});
    }
  }
  cands.sort((a, b) => a.cls - b.cls || a.ratio - b.ratio);
  for(const j of cands){
    const src = near(haulSources(j));
    if(src) return {...j, src:src.b, amount:Math.max(1, Math.min(most, Math.ceil(j.need), supplyOf(src.b, j.t)))};
  }
  return null;
}
function noteFlow(srcId, dstId, n){
  if(!srcId || n <= 0) return;
  const f = state.logi.flow, key = srcId + ">" + dstId;
  f[key] = (f[key] || 0) + n;
}
// Lines on the map: what keepers hauled today and yesterday, from a store to a building or an exhibit
function supplyLines(){
  const out = [], seen = {};
  for(const f of [state.logi.last, state.logi.flow]) for(const [key, n] of Object.entries(f)) seen[key] = (seen[key] || 0) + n;
  for(const [key, n] of Object.entries(seen)){
    const [from, to] = key.split(">"), a = buildingById(from), b = buildingById(to) || state.exhibits.find(e => e.id === to); if(!a || !b) continue;
    out.push({a:centroid(a.points), b:centroid(b.points), n, exhibit:!!b.animals});
  }
  return out;
}

/* ---------- through the day and night ---------- */

// Farms and ranches fill their own stores through the day. A full store stops production.
// The supply trucks come at 7 PM, as the evening restock starts.
function logiTick(dtMin){
  if(state.logi.truckDay !== state.day && state.minute >= minuteAtClock(LOGI.truckClock)){ state.logi.truckDay = state.day; dockDelivery(); }
  if(state.logi.notice){ state.logi.notice = false; events.toast("Food is now a real supply. Build a Delivery Dock, a station and a Custodial Closet. Custodians stock the station, and keepers carry the food to the animals.", "bad"); }
  if(state.logi.guestNotice){ state.logi.guestNotice = false; events.toast(`Stands and shops will soon sell from their own stock. Suppliers deliver straight to them until ${fmtDate(state.logi.guestFrom)}. Before then, build a Delivery Dock and a Custodial Closet, and hire custodians to carry stock out.`, "bad"); }
  const share = dtMin / DAY_MIN;
  for(const b of state.buildings){
    const make = BUILDINGS[b.type].makes; if(!make || !isReachable(b) || unpowered(b)) continue;
    for(const [t, n] of Object.entries(make)) addGood(b, t, n * share);
  }
}

/* ---------- standing orders ---------- */

// What the park got through today, kept per good for the Logistics tab and Supply forecasting
function noteUse(t, n){ if(n > 0) state.logi.used[t] = (state.logi.used[t] || 0) + n; }
// A good's average use a night over the last LOGI.histDays nights
function usedAvg(t){
  const h = state.logi.hist || [];
  return h.length ? h.reduce((s, d) => s + (d[t] || 0), 0) / h.length : (state.logi.usedLast || {})[t] || 0;
}
const parkStock = t => storesBuilt().reduce((s, b) => s + stockOf(b, t), 0);
const orderStep = t => t === CMED ? 1 : 5;
const roundOrder = (t, n) => Math.max(0, Math.ceil(n / orderStep(t)) * orderStep(t));
const docks = () => state.buildings.filter(b => b.type === "dock" && isReachable(b));
const dockCap = () => docks().reduce((s, b) => s + storeCap(b), 0);
const bulkOff = n => (LOGI.bulk.find(([min]) => n >= min) || [0, 0])[1];
const basePrice = t => t === CMED ? MODERN.cost : LOGI.dockMarkup * (isGuestGood(t) ? GUEST_GOOD_PRICE : FOOD_UNIT_COST * (DOCK_PRICE[t] || 1));
// A unit on the standing order: big orders come cheaper. Partner parks pay for animal food while they're still feeding.
const orderPrice = t => freeFeeding() && FEED_GOODS.includes(t) ? 0 : basePrice(t) * (1 - bulkOff(orderOf(t)));
const unitPrice = t => basePrice(t) * (1 - bulkOff(orderOf(t)));
const orderOf = t => (state.logi.orders || {})[t] || 0;
const nightBill = () => docks().length ? ORDER_GOODS.reduce((s, t) => s + orderOf(t) * orderPrice(t), 0) : 0;
// What a good needs a day from outside the park: animal food less what farms make, the crowd's guest goods, and contemporary medicine as used
function orderNeed(t){
  if(t === CMED) return usedAvg(t);
  if(isGuestGood(t)) return guestDemand(t);
  return Math.max(0, parkDemand(t) - parkProduction(t));
}
// A good nobody has ordered yet starts at what the park needs of it, the first time it needs any
function seedOrders(){
  const o = state.logi.orders;
  for(const t of ORDER_GOODS){
    if(o[t] !== undefined) continue;
    const n = t === CMED ? (hasDept("pmc") ? LOGI.cmedSeed : 0) : isGuestGood(t) && state.day + 1 < (state.logi.guestFrom || 0) ? 0 : orderNeed(t);
    if(n > 0) o[t] = roundOrder(t, n);
  }
}
// Supply forecasting: a night's use, plus half of what's missing from LOGI.autoDays of stock (less half of any extra)
function forecastOrder(t){
  const need = Math.max(orderNeed(t), t === CMED ? 0 : usedAvg(t) - (FEED_GOODS.includes(t) ? parkProduction(t) : 0));
  const want = t === CMED ? (hasDept("pmc") ? MODERN.stock : 0) : need * LOGI.autoDays;
  return roundOrder(t, need + (want - parkStock(t)) / 2);
}
const forecasting = () => hasTech("forecast") && state.logi.auto;
function setOrder(t, n){ if(ORDER_GOODS.includes(t)) state.logi.orders[t] = roundOrder(t, clamp(+n || 0, 0, orderMax(t))); }
const orderMax = t => t === CMED ? 60 : Math.max(500, Math.ceil(dockCap() / 50) * 50);

// The evening delivery: every standing order, spread over the docks with the most room. Animal food and medicine unload first,
// then stands and shops share whatever room is left. What doesn't fit or can't be paid for isn't delivered or charged.
function dockDelivery(){
  const L = state.logi, ds = docks();
  L.noRoom = 0; L.noCash = 0;
  if(!ds.length) return;
  seedOrders();
  if(forecasting()) for(const t of ORDER_GOODS) L.orders[t] = forecastOrder(t);
  let spent = 0, units = 0;
  const room = () => ds.reduce((s, b) => s + storeRoom(b, ORDER_GOODS[0]), 0);
  const buy = (t, n) => {
    const price = orderPrice(t), want = n;
    if(price) n = Math.min(n, Math.floor(Math.max(0, state.money) / price));
    L.noCash += want - n;
    let got = 0;
    for(const b of ds.slice().sort((x, y) => storeRoom(y, t) - storeRoom(x, t))){ if(got >= n) break; got += addGood(b, t, Math.floor(n - got)); }
    L.noRoom += n - got; units += got;
    if(got && price){ spend(Math.round(got * price), isGuestGood(t) ? "supplies" : t === CMED ? "medicine" : "feed"); spent += got * price; }
  };
  for(const t of FEED_GOODS.concat(CMED)) buy(t, orderOf(t));
  const total = GUEST_GOODS.reduce((s, t) => s + orderOf(t), 0), fit = total > 0 ? Math.min(1, room() / total) : 1;
  for(const t of GUEST_GOODS){ L.noRoom += orderOf(t) - Math.floor(orderOf(t) * fit); buy(t, Math.floor(orderOf(t) * fit)); }
  if(units) events.toast(`The docks took in ${units} units${spent ? ` for ${money(Math.round(spent))}` : ", on the partner parks"}.`);
  if(L.noRoom >= 1) events.toast(`${Math.round(L.noRoom)} units didn't fit at the docks.`, "bad");
  if(L.noCash >= 1) events.toast(`${Math.round(L.noCash)} units weren't delivered. Not enough money.`, "bad");
}
// A rush delivery lands now, at the dock with the most room, for a steep markup
const rushLot = t => t === CMED ? LOGI.rushDoses : LOGI.rushLot;
const rushPrice = t => Math.round(rushLot(t) * basePrice(t) * (hasTech("express") ? LOGI.expressMarkup : LOGI.rushMarkup));
function rushOrder(t){
  const b = docks().sort((x, y) => storeRoom(y, t) - storeRoom(x, t))[0], price = rushPrice(t);
  if(!state.buildings.some(x => x.type === "dock")) return "No delivery dock.";
  if(!b) return "Trucks can't reach the docks.";
  if(!canAfford(price)) return `A rush delivery costs ${money(price)}.`;
  const n = Math.min(rushLot(t), Math.floor(storeRoom(b, t)));
  if(n < 1) return "The docks are full.";
  spend(Math.round(price * n / rushLot(t)), isGuestGood(t) ? "supplies" : t === CMED ? "medicine" : "feed"); addGood(b, t, n);
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
      L.lost += lose; L.lostCost += lose * (MED_GOODS.includes(t) || t === CMED ? MED_UNIT_VALUE : isGuestGood(t) ? GUEST_GOOD_PRICE : FOOD_UNIT_COST);
    }
  }
  const cm = cerMeds(); for(const t of MED_GOODS) if(cm[t]) cm[t] = Math.max(0, cm[t] - cm[t] * GOODS[t].spoil);
  L.lostDay = state.day;
  if(L.lost >= 10) events.toast(`${Math.round(L.lost)} units of food spoiled overnight, worth about ${money(Math.round(L.lostCost))}.`, "bad");
}
const MED_UNIT_VALUE = 60;

function logiNight(){
  spoilNight();
  state.logi.last = state.logi.flow; state.logi.flow = {};
  state.logi.usedLast = state.logi.used || {}; state.logi.used = {};
  state.logi.hist = (state.logi.hist || []).concat([state.logi.usedLast]).slice(-LOGI.histDays);
}

/* ---------- the evening restock ---------- */

// From 7 PM to the end of the day, custodians fill every stand, shop and hotel before their other chores
const restockEvening = () => state.minute >= minuteAtClock(LOGI.truckClock);
const restocked = b => !!(storeOf(b) && storeOf(b).vendor);   // stands, shops and hotels
// Goods a stand, shop or hotel is short of: under `share` of its target
const shortGoods = (b, share = 1) => guestGoodsFree() || !restocked(b) ? [] : storeOf(b).holds.filter(t => { const g = storeTarget(b, t); return g > 0 && stockOf(b, t) < g * share - (share === 1 ? 1 : 0); });
const lowStock = b => shortGoods(b, LOGI.lowMark).length > 0;
// Something to restock it from: a dock, warehouse, cold store or farm holding the good
const inStorage = t => stores().some(b => { const d = storeOf(b); return (d.bulk || d.source) && supplyOf(b, t) >= 1; });
// When the day ends, any stand, shop or hotel left short missed its restock. Short because storage ran dry, or because nobody got there.
function restockCheck(){
  const missed = [], dry = new Set();
  for(const b of state.buildings){
    if(!restocked(b)) continue;
    const short = shortGoods(b, LOGI.restockedAt);
    b.missed = short.length > 0;
    if(!b.missed) continue;
    const out = short.filter(t => !inStorage(t));
    out.forEach(t => dry.add(t));
    if(out.length < short.length) missed.push(b);
  }
  if(dry.size) events.toast(`Storage ran out of ${[...dry].map(t => goodName(t).toLowerCase()).join(" and ")} during the restock.`, "bad");
  if(missed.length) events.toast(`${missed.length} stand${missed.length === 1 ? "" : "s"}, shop${missed.length === 1 ? "" : "s"} or hotel${missed.length === 1 ? "" : "s"} weren't restocked by ${fmtClock(ROLLOVER_CLOCK + DAY_CLOCK)}.`, "bad");
}

// Everything the park holds right now, for the park office
function stockSummary(){
  const out = {};
  for(const t of FEED_GOODS) out[t] = {have:0, cap:0, need:parkDemand(t), make:parkProduction(t)};
  out.paleoflora = {have:Math.floor(state.ceres.stock || 0), need:state.exhibits.reduce((s, e) => s + (dailyNeed(e).paleoflora || 0), 0)};
  for(const b of storesBuilt()) for(const t of FEED_GOODS){ if(storeOf(b).holds.includes(t)) out[t].cap += storeCap(b); out[t].have += stockOf(b, t); }
  // medicine: one stock an era (PMC, cold stores and the Botany Lab), plus the supplier-restocked contemporary doses
  for(const t of MED_GOODS){
    out[t] = {have:0, cap:0, ceres:Math.floor(cerMeds()[t] || 0), pmc:pmcStock(t)};
    for(const b of storesBuilt()) out[t].have += stockOf(b, t);
  }
  out.cmed = {have:storesBuilt().reduce((s, b) => s + stockOf(b, CMED), 0), pmc:pmcStock(CMED), want:MODERN.stock};
  return out;
}
// Exhibits and stores keepers can't reach, or that no keeper is covering
function logiWarnings(){
  const w = [];
  if(!freeFeeding() || state.day + 2 >= state.staff.feedFrom){
    if(state.exhibits.some(e => e.animals.length) && !state.buildings.some(b => b.type === "dock") && !state.buildings.some(b => BUILDINGS[b.type].makes)) w.push("Nothing here buys or makes food. Build a Delivery Dock.");
  }
  const ks = state.staff.keepers.filter(k => !isAqua(k)), aqs = state.staff.keepers.filter(isAqua);
  for(const z of zones()){
    const m = zoneMembers(z);
    if(m.exhibits.some(e => e.animals.length && !aquaEx(e)) && !ks.some(k => k.zone === z.id) && ks.every(k => k.zone)) w.push(`${z.name} has animals but no keeper is assigned to it.`);
    if(m.exhibits.some(e => e.animals.length && aquaEx(e)) && !aqs.some(k => k.zone === z.id) && aqs.every(k => k.zone)) w.push(`${z.name} has lagoon or aquarium animals but no aquarist is assigned to it.`);
  }
  // with every mechanic or vet in a zone, anything outside the zones gets nobody
  const ms = state.staff.mechanics, vs = state.staff.vets;
  if(ms.length && ms.every(m => m.zone) && (state.exhibits.some(e => !e.viv && !e.zone) || state.buildings.some(b => (isGridNode(b) || b.type === "depot") && !b.zone))) w.push("Every mechanic is in a zone, so fences and machines outside the zones aren't being checked.");
  if(vs.length && vs.every(v => v.zone) && state.exhibits.some(e => e.animals.length && !e.zone)) w.push("Every vet is in a zone, so exhibits outside the zones get no check-ups.");
  if(ks.length && ks.every(k => k.zone) && state.exhibits.some(e => e.animals.length && !aquaEx(e) && !e.zone)) w.push("Every keeper is in a zone, so exhibits outside the zones aren't being fed.");
  if(aqs.length && aqs.every(k => k.zone) && state.exhibits.some(e => e.animals.length && aquaEx(e) && !e.zone)) w.push("Every aquarist is in a zone, so lagoons and aquariums outside the zones aren't being fed.");
  return w;
}
