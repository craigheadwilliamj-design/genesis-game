/* =====================================================================
   CUSTODIANS
   Staff who keep the guest side of the park running. They carry stock
   from the dock and stores out to food stands and gift shops, scrub
   restrooms, empty bins, and sweep litter. They start at a Custodial
   Closet and walk any path or service road, like the other staff.
   ===================================================================== */

let ccrew = [];   // custodians walking around right now (positions aren't saved)

const closets = () => state.buildings.filter(b => b.type === "closet" && kGraph && kGraph.anchors[b.id]);
const custRec = c => state.staff.custodians.find(x => x.id === c.id) || null;
const custCarry = () => CUSTODIAN.carry * (hasUpgrade("jcart") ? 2 : 1);
const sweepRate = () => CUSTODIAN.sweepPerMin * (hasUpgrade("picker") ? 2 : 1);
const scrubRate = () => CUSTODIAN.scrubPerMin * (hasUpgrade("washer") ? 2 : 1);

// Make the walking crew match the hired custodians. What they're carrying lives on the saved record too.
function syncCustodians(){
  const ids = new Set(state.staff.custodians.map(m => m.id));
  ccrew = ccrew.filter(c => ids.has(c.id));
  for(const m of state.staff.custodians) if(!ccrew.some(c => c.id === m.id))
    ccrew.push({id:m.id, at:null, route:[], t:0, job:"idle", wait:0, target:null, work:0, carry:m.carry || null, haul:null});
}
function setCustCarry(c, v){ c.carry = v; const r = custRec(c); if(r) r.carry = v; }
// Put back whatever a custodian is holding: into the store it came from, or anywhere it fits
function returnCustCarry(c){
  const h = c.carry;
  if(h && h.amount > 0) stashGood(h.type, h.amount, buildingById(c.haul ? c.haul.src : null));
  c.haul = null; setCustCarry(c, null);
}

/* ---------- choosing work ---------- */

// A custodian in a zone only looks after that zone's buildings, and litter inside the zone's outline
const custZoneOk = (r, b) => !r.zone || b.zone === r.zone;
function litterZoneOk(r, x, y){ if(!r.zone) return true; const z = zoneById(r.zone); return !z || inPoly(x, y, z.points); }
const litterCenter = k => { const [gx, gy] = k.split(":").map(Number); return [(gx + .5) * LITTER.cell, (gy + .5) * LITTER.cell]; };

// The most pressing cleaning job nobody else has taken: the worst mess, not too far away
function pickChore(c, r, w){
  const taken = new Set(ccrew.filter(x => x !== c && x.target).map(x => x.target));
  let best = null;
  const consider = (job, target, node, score) => {
    if(!node || taken.has(target) || !w.dist.has(node)) return;
    const s = score - w.dist.get(node) / 50;
    if(!best || s > best.s) best = {job, target, node, s};
  };
  for(const b of state.buildings){
    const n = kGraph.anchors[b.id]; if(!n || !custZoneOk(r, b)) continue;
    if(b.type === "restroom" && (b.dirt || 0) >= CUSTODIAN.restroomAt) consider("toScrub", b.id, n, 50 + b.dirt);
    if((b.graffiti || 0) >= VANDAL.grossAt) consider("toGraffiti", "G" + b.id, n, 35 + b.graffiti / 2);
    if(b.type === "bin" && (b.fill || 0) >= LITTER.binCap * CUSTODIAN.binAt) consider("toBin", b.id, n, 40 + b.fill);
  }
  for(const [k, v] of Object.entries(state.litter)){
    if(v < CUSTODIAN.litterAt) continue;
    const [x, y] = litterCenter(k); if(!litterZoneOk(r, x, y)) continue;
    const n = nearestNode(x, y);
    if(n && Math.hypot(n.x - x, n.y - y) <= CUSTODIAN.reach) consider("toSweep", "L" + k, n, 30 + v * 2);
  }
  return best;
}
function custGo(c, w, n, job){
  if(!n || !w.dist.has(n)){ c.job = "idle"; c.wait = 10; c.target = null; return false; }
  setRoute(c, w, n); c.job = job; return true;
}
function custDecide(c, r){
  const w = walkFrom(c.at, c);
  const near = list => { let best = null; for(const b of list){ const n = kGraph.anchors[b.id]; if(n && w.dist.has(n) && (!best || w.dist.get(n) < best.d)) best = {b, n, d:w.dist.get(n)}; } return best; };
  // stock in hand: finish the delivery
  if(c.carry && c.carry.amount > 0 && c.carry.dst){
    const d = buildingById(c.carry.dst);
    if(d && custGo(c, w, kGraph.anchors[d.id], "toHaulDst")){ c.haul = c.haul || {t:c.carry.type, src:null, dst:d.id, amount:c.carry.amount}; return; }
    returnCustCarry(c);
  }
  const haul = pickHaul(r, near, GUEST_GOODS, custCarry());
  const restock = () => { c.haul = {t:haul.t, src:haul.src.id, dst:haul.d.id, amount:haul.amount}; if(!custGo(c, w, kGraph.anchors[haul.src.id], "toHaulSrc")) c.haul = null; };
  // a stand or shop about to run dry comes first, then cleaning, then routine restocking.
  // After a delivery, one waiting chore gets done before the next haul, so the cleaning never stops completely.
  const ch = pickChore(c, r, w);
  if(haul && haul.ratio < LOGI.urgentBelow && !(c.hauled && ch)){ restock(); if(c.haul){ c.hauled = true; return; } }
  if(ch){ c.target = ch.target; c.hauled = false; if(custGo(c, w, ch.node, ch.job)) return; }
  if(haul){ restock(); if(c.haul){ c.hauled = true; return; } }
  c.job = "idle"; c.wait = 15;
  const home = near(closets()); if(home && home.d > 1) custGo(c, w, home.n, "home");
}

/* ---------- doing it ---------- */

function custArrive(c){
  if(c.job === "toHaulSrc"){
    const h = c.haul, src = h && buildingById(h.src), dst = h && buildingById(h.dst);
    const amount = src && dst ? Math.min(h.amount, supplyOf(src, h.t), Math.floor(storeRoom(dst, h.t))) : 0;
    if(amount < 1){ c.haul = null; c.job = "idle"; c.wait = 5; return; }
    takeSupply(src, h.t, amount);
    setCustCarry(c, {type:h.t, amount, dst:h.dst});
    const w = walkFrom(c.at, c);
    if(!custGo(c, w, kGraph.anchors[h.dst], "toHaulDst")) returnCustCarry(c);
    return;
  }
  if(c.job === "toHaulDst"){
    const d = buildingById(c.carry && c.carry.dst);
    if(d && c.carry){ const give = addGood(d, c.carry.type, c.carry.amount); c.carry.amount -= give; noteFlow(c.haul && c.haul.src, d.id, give); }
    returnCustCarry(c); c.job = "idle"; c.wait = 0;
    return;
  }
  if(c.job === "toScrub"){ c.job = "scrubbing"; return; }
  if(c.job === "toGraffiti"){ c.job = "degraffiti"; return; }
  if(c.job === "toBin"){ c.job = "emptying"; c.work = CUSTODIAN.emptyMin; return; }
  if(c.job === "toSweep"){ c.job = "sweeping"; return; }
  c.job = "idle"; c.target = null;
}
// Time spent on the job itself. Returns the minutes used.
function custWork(c, left){
  if(c.job === "scrubbing"){
    const b = buildingById(c.target);
    if(!b){ c.job = "idle"; c.target = null; return 0; }
    const w = Math.min(left, Math.max(0, (b.dirt || 0) - 1) / scrubRate());
    b.dirt = Math.max(0, (b.dirt || 0) - scrubRate() * w);
    if(b.dirt <= 1){ b.dirt = 0; c.job = "idle"; c.target = null; }
    return w;
  }
  if(c.job === "degraffiti"){
    const b = buildingById(c.target && c.target.slice(1));
    if(!b){ c.job = "idle"; c.target = null; return 0; }
    const w = Math.min(left, Math.max(0, (b.graffiti || 0) - 1) / scrubRate());
    b.graffiti = Math.max(0, (b.graffiti || 0) - scrubRate() * w);
    if(b.graffiti <= 1){ b.graffiti = 0; c.job = "idle"; c.target = null; }
    return w;
  }
  if(c.job === "emptying"){
    const w = Math.min(left, c.work); c.work -= w;
    if(c.work <= 0){ const b = buildingById(c.target); if(b) b.fill = 0; c.job = "idle"; c.target = null; }
    return w;
  }
  if(c.job === "sweeping"){
    const k = c.target ? c.target.slice(1) : null, have = k ? state.litter[k] || 0 : 0;
    const w = Math.min(left, have / sweepRate());
    if(k && have) state.litter[k] = have - sweepRate() * w;
    if(!k || state.litter[k] <= .01){ if(k) delete state.litter[k]; c.job = "idle"; c.target = null; }
    return w;
  }
  return 0;
}

function custodiansTick(dtMin){
  if(!kGraph) return;
  syncCustodians();
  for(const c of ccrew){
    const r = custRec(c); if(!r) continue;
    if(!c.at){ const h = closets()[0]; if(!h) continue; c.at = kGraph.anchors[h.id]; c.job = "idle"; }
    let left = dtMin, steps = 0;
    while(left > 0 && steps++ < 40){
      if(["scrubbing", "degraffiti", "emptying", "sweeping"].includes(c.job)){ const used = custWork(c, left); left -= used; if(!used && c.job !== "idle") left = 0; continue; }
      if(c.route.length){
        const nx = c.route[0], d = Math.hypot(nx.x - c.at.x, nx.y - c.at.y), sp = CUSTODIAN.speed * (onAtv(c) ? VEHICLES.speedMult : 1), go = sp * left, rem = d * (1 - c.t);
        if(go < rem){ c.t += go / (d || 1); left = 0; }
        else { left -= rem / sp; c.at = nx; c.route.shift(); c.t = 0; atNode(c); if(!c.route.length) custArrive(c); }
        continue;
      }
      if(c.job !== "idle"){ custArrive(c); continue; }
      if(c.wait > 0){ const w = Math.min(c.wait, left); c.wait -= w; left -= w; continue; }
      custDecide(c, r);
      if(c.job === "idle" && !c.route.length && c.wait <= 0) c.wait = 5;
    }
  }
}
// Each night custodians finish any delivery in hand, then go home
function custodiansNight(){
  for(const c of ccrew){
    const d = c.carry && buildingById(c.carry.dst);
    if(d && c.carry.amount > 0) c.carry.amount -= addGood(d, c.carry.type, c.carry.amount);
    returnCustCarry(c);
    resetAtv(c); c.at = null; c.route = []; c.job = "idle"; c.target = null; c.wait = 0;
  }
}

/* ---------- hiring ---------- */

function hireCustodian(){
  if(!state.buildings.some(b => b.type === "closet")) return "Build a Custodial Closet first.";
  if(!canAfford(CUSTODIAN.hireCost)) return `Hiring costs ${money(CUSTODIAN.hireCost)}.`;
  spend(CUSTODIAN.hireCost, "built");
  const used = new Set(allStaffList().map(k => k.name));
  const name = ["Mop","Gil","Rita","Benny","Cass","Dina","Earl","Flo","Gus","Hal","Inez","Joy","Lyle","Mae","Otis"].find(n => !used.has(n)) || "Custodian " + (state.staff.custodians.length + 1);
  state.staff.custodians.push({id:uid("c-"), name});
  return null;
}
function custodianStatus(m){
  const c = ccrew.find(x => x.id === m.id); if(!c) return "Clocking in";
  const tgt = c.target && !/^[LG]/.test(c.target) ? buildingById(c.target) : null, n = tgt ? BUILDINGS[tgt.type].label.toLowerCase() : "";
  const dst = c.haul && buildingById(c.haul.dst), src = c.haul && buildingById(c.haul.src);
  return {
    toHaulSrc:`Fetching ${goodName(c.haul ? c.haul.t : "").toLowerCase()} from the ${src ? BUILDINGS[src.type].label.toLowerCase() : "store"}`,
    toHaulDst:`Restocking the ${dst ? BUILDINGS[dst.type].label.toLowerCase() : "stand"}${c.carry ? ` (${Math.round(c.carry.amount)} ${goodName(c.carry.type).toLowerCase()})` : ""}`,
    toScrub:`Walking to the ${n}`, scrubbing:`Scrubbing the ${n}`, toGraffiti:"Walking to some graffiti", degraffiti:"Scrubbing off graffiti", toBin:"Walking to a full bin", emptying:"Emptying a bin",
    toSweep:"Walking to some litter", sweeping:"Sweeping up litter", home:"Heading back to the closet",
  }[c.job] || "Waiting for work";
}
