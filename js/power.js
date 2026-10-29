/* =====================================================================
   POWER
   Power stations make power. Underground cables join stations and
   transformers into networks (state.cables, each {id, a, b} between two
   building ids), and every station and transformer feeds what lies within
   its reach. Buildings, electrified fences, aquarium filters and cold
   stores draw from the network that reaches them. When a network runs
   short, fences holding the strongest animals get power first, then
   filters, cold stores, the labs and the PMC, guest buildings, and last
   the backstage. A building with no power shuts; an unpowered electric
   fence is barely a fence.
   Guests mind the sight of power plants (and a little, transformers).
   Green stations don't bother anyone, and conservationists love them.
   ===================================================================== */

let powerShortNotified = -1;   // the day we last warned about a shortage
let gridInfo = {nets:[], netOf:new Map(), feeds:new Map()};   // the last updatePower: networks, which network each power building is on, what feeds each user
let gridStale = false, tramDark = "";   // tram stations that lost or got power need the guest map rebuilt

const isStation = b => !!(b && b.type && BUILDINGS[b.type] && BUILDINGS[b.type].power);
const isGridNode = b => isStation(b) || !!(b && b.type && BUILDINGS[b.type] && BUILDINGS[b.type].grid);
const generators = () => state.buildings.filter(isStation);
const gridMachines = () => state.buildings.filter(isGridNode);   // what wears: stations and transformers (cables never do)
const genOnline = b => condOf(b) >= POWER.offlineBelow;
const cablesOf = () => state.cables || (state.cables = []);
// Buildings that draw power: everything but path props, decks and galleries, and the grid itself
const needsPower = b => { const t = BUILDINGS[b.type]; return !!t && !t.prop && !t.power && !t.grid && b.exhibitId === undefined; };
const kwOf = b => { const t = BUILDINGS[b.type]; return t.kw ?? Math.round(t.w * t.d * POWER.perSqM); };
// Off: a building that should have power and hasn't
const unpowered = b => b.powered === false;
// Older parks get a few days of free power to wire themselves up
const powerFree = () => !!state.powerFree && state.day < state.powerFree;

// The share of its power a station makes right now: solar follows daylight and the sky, wind the weather
function stationShare(b){
  if(!genOnline(b)) return 0;
  const t = BUILDINGS[b.type], w = wxNow();
  if(t.sun) return (1 - darkLevel()) * (POWER.sun[w.ev || w.sky] ?? 1);
  if(t.wind) return POWER.wind[w.ev] ?? 1;
  return 1;
}
const stationOutput = b => BUILDINGS[b.type].power * stationShare(b);
function powerSupply(){ return generators().reduce((s, b) => s + stationOutput(b), 0); }
function fenceDraw(e){ return e.barrier === "electric" && !e.viv ? perimeter(e.points) * POWER.perMeter : 0; }
const coldStores = () => state.buildings.filter(b => storeOf(b) && storeOf(b).cold);
function powerDemand(){ return state.exhibits.reduce((s, e) => s + fenceDraw(e) + filterKw(e), 0) + state.buildings.filter(needsPower).reduce((s, b) => s + kwOf(b), 0); }

// Does a station or transformer reach this shape? An exhibit only needs one stretch of its fence in reach.
function reaches(n, pts){
  const [x, y] = centroid(n.points);
  return inPoly(x, y, pts) || distToEdge(x, y, pts) <= BUILDINGS[n.type].reach;
}
// The networks: power buildings joined by cable, each with what it makes now and could make at best.
// A broken-down transformer carries nothing, so it can split a network in two; a broken station still passes power along.
function gridNets(){
  const nodes = state.buildings.filter(b => isStation(b) || (isGridNode(b) && genOnline(b))), up = new Map(nodes.map(b => [b.id, b.id]));
  const find = k => { while(up.get(k) !== k){ up.set(k, up.get(up.get(k))); k = up.get(k); } return k; };
  for(const c of cablesOf()) if(up.has(c.a) && up.has(c.b)) up.set(find(c.a), find(c.b));
  const nets = new Map();
  for(const b of nodes){
    const r = find(b.id);
    if(!nets.has(r)) nets.set(r, {nodes:[], supply:0, cap:0, load:0, want:0, short:0});
    const n = nets.get(r); n.nodes.push(b);
    if(isStation(b)){ n.supply += stationOutput(b); n.cap += BUILDINGS[b.type].power; }
  }
  return [...nets.values()];
}

// Hand out power. Called whenever the park's numbers are reworked (every 20 park minutes, and on every change).
function updatePower(){
  const nets = gridNets(), netOf = new Map(), feeds = new Map(), free = powerFree();
  for(const n of nets){ n.left = n.supply; for(const b of n.nodes) netOf.set(b.id, n); }
  // who draws what, most important first: fences holding the strongest animals, filters with the biggest loads, cold stores, the labs and the PMC, guests, backstage
  const pull = e => Math.max(0, ...e.animals.map(a => escapeStrength(SPECIES_BY_ID[a.sp])));
  const users = [];
  for(const e of state.exhibits.filter(e => fenceDraw(e) > 0).sort((a, b) => pull(b) - pull(a))) users.push({o:e, kw:fenceDraw(e), set:v => { e.powered = v; }});
  for(const e of state.exhibits) if(e.barrier !== "electric" || e.viv) delete e.powered;
  for(const e of state.exhibits.filter(e => wetCase(e) && filterKw(e) > 0).sort((a, b) => aquaLoad(b) - aquaLoad(a))) users.push({o:e, kw:filterKw(e), wet:true, set:v => { e.filterPowered = v; }});
  for(const e of state.exhibits) if(wetCase(e) && filterKw(e) <= 0) delete e.filterPowered;
  const rank = b => { const t = BUILDINGS[b.type]; return storeOf(b) && storeOf(b).cold ? 0 : t.kw ? 1 : guestBuilding(b) || t.tram || t.rooms ? 2 : 3; };
  for(const b of state.buildings.filter(needsPower).sort((a, b) => rank(a) - rank(b))) users.push({o:b, kw:kwOf(b), set:v => { b.powered = v; }});
  for(const b of state.buildings) if(!needsPower(b)) delete b.powered;
  let cut = 0, dry = 0, dark = 0;
  for(const u of users){
    const by = nets.filter(n => n.nodes.some(x => reaches(x, u.o.points)));
    for(const n of by) n.want += u.kw;
    const n = by.sort((a, b) => b.left - a.left)[0];
    const on = free || (!!n && n.left >= u.kw);
    if(n){ feeds.set(u.o.id, n); if(on){ n.left -= u.kw; n.load += u.kw; } else n.short += u.kw; }
    u.set(on);
    if(!on && n){ if(u.wet){ if(u.o.animals.length) dry++; } else if(u.o.animals) cut++; else dark++; }
    else if(!on && u.o.animals && !u.wet) cut++;   // an electric fence nothing reaches is a shortage too
  }
  gridInfo = {nets, netOf, feeds};
  // tram stations that lost or got power change the guest map
  const td = tramStations().filter(unpowered).map(b => b.id).join();
  if(td !== tramDark){ tramDark = td; gridStale = true; }
  if((cut || dry || dark) && state.minute > 0 && powerShortNotified !== state.day){
    powerShortNotified = state.day;
    const pl = (n, one, many) => n ? `${n} ${n === 1 ? one : many}` : "";
    const what = [pl(cut, "electrified fence", "electrified fences"), pl(dry, "aquarium's filters", "aquariums' filters"), pl(dark, "building", "buildings")].filter(Boolean).join(", ");
    events.toast(`Power shortage: ${what} without power.`, "bad");
  }
}
// Once a step: the guest map follows tram stations' power
function powerTick(){
  if(state.powerNotice){ state.powerNotice = false; events.toast(`Every building now needs power. Join power stations and transformers with cable (Power in the build menu). Power is free until ${fmtDate(state.powerFree)}.`, "bad"); }
  if(gridStale && gGraph){ gridStale = false; buildGuestGraph(); }
}

// The fence's full strength right now, before wear: electric fences without power are weak
function baseStrength(e){
  return e.barrier === "electric" && e.powered === false ? POWER.unpoweredStrength : barrierOf(e).strength;
}

/* ---------- cables ---------- */

const cableLen = c => { const a = buildingById(c.a), b = buildingById(c.b); return a && b ? dist(centroid(a.points), centroid(b.points)) : 0; };
const cableCost = (a, b) => Math.round(dist(centroid(a.points), centroid(b.points)) * POWER.cablePerMeter);
const cabled = (a, b) => cablesOf().some(c => (c.a === a.id && c.b === b.id) || (c.a === b.id && c.b === a.id));
function cableProblem(a, b){
  if(!isGridNode(a) || !isGridNode(b)) return "Cables run between power stations and transformers.";
  if(a === b) return "Pick a different power building.";
  if(cabled(a, b)) return "They're already joined.";
  if(dist(centroid(a.points), centroid(b.points)) > POWER.cableMax) return `Too far. A cable runs at most ${POWER.cableMax} m.`;
  if(!canAfford(cableCost(a, b))) return `Costs ${money(cableCost(a, b))}. You have ${money(state.money)}.`;
  return null;
}
function layCable(a, b){
  const why = cableProblem(a, b); if(why) return why;
  spend(cableCost(a, b), "built");
  cablesOf().push({id:uid("c-"), a:a.id, b:b.id});
  return null;
}
function liftCable(c){
  earn(Math.round(cableLen(c) * POWER.cablePerMeter * COST.refundShare), "sold");
  state.cables = cablesOf().filter(x => x !== c);
}
// A power building going takes its cables with it
function dropCables(id){ state.cables = cablesOf().filter(c => c.a !== id && c.b !== id); }
// The cable nearest a spot, within d meters
function cableAt(x, y, d){
  let best = null, bd = d;
  for(const c of cablesOf()){
    const a = buildingById(c.a), b = buildingById(c.b); if(!a || !b) continue;
    const r = segProj(x, y, centroid(a.points), centroid(b.points));
    if(r.d < bd){ bd = r.d; best = c; }
  }
  return best;
}

/* ---------- what guests make of it ---------- */

// Mark each corner of the guest paths with how ugly the power buildings in view make it (n.eyesore, 0 to 1)
// and how much green power is in view (n.green, 0 to 1). Called from buildGuestGraph.
function indexGrid(nodes){
  const items = state.buildings.filter(b => isGridNode(b) && (BUILDINGS[b.type].eyesore || BUILDINGS[b.type].green)).map(b => {
    const t = BUILDINGS[b.type], [x, y] = centroid(b.points);
    return {x, y, r:Math.max(t.w, t.d) / 2, ugly:t.eyesore || 0, green:t.green ? 1 : 0};
  });
  for(const n of nodes.values()){
    n.eyesore = 0; n.green = 0;
    if(n.rail || !items.length) continue;
    const segs = [...n.adj.keys()].filter(m => !m.rail).map(m => [[n.x, n.y], [(n.x + m.x) / 2, (n.y + m.y) / 2]]);
    if(!segs.length) segs.push([[n.x, n.y], [n.x, n.y]]);
    let u = 0, g = 0;
    for(const it of items){
      if(Math.min(...segs.map(([a, b]) => segProj(it.x, it.y, a, b).d)) - it.r > POWER.sightReach) continue;
      u += it.ugly; g += it.green;
    }
    n.eyesore = clamp(u / POWER.eyesoreFull, 0, 1); n.green = clamp(g / POWER.greenFull, 0, 1);
  }
}
// From the guest loop: mood a party loses (or gains) walking past power buildings, a minute
function gridMood(p){
  const n = p.at; if(!n || n.rail) return 0;
  let hurt = 0;
  if(n.eyesore){ hurt += POWER.eyesoreHurt * pm(p, "eyesore") * n.eyesore; if(n.eyesore >= POWER.ugly) thinks(p, "eyesore"); }
  if(n.green && hasPers(p, "conserv")){ hurt -= POWER.greenJoy * n.green * (p.pers[0] === "conserv" ? 1 : PERS.second); thinks(p, "greenPower"); }
  return hurt;
}
