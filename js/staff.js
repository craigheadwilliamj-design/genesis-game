/* =====================================================================
   STAFF
   Every hired worker in one place: the types, hiring and firing, energy,
   morale and what they're thinking. The Staff tab and the tap-a-worker
   panel are in staffui.js.
   ===================================================================== */

// One entry per kind of walking staff. `list` is the saved records; `crew` the live walkers (not saved).
const STAFF_TYPES = {
  keeper:   {label:"Keeper",    plural:"Keepers",    color:"#2E6B3A", list:() => state.staff.keepers.filter(k => !isAqua(k)), store:() => state.staff.keepers, crew:() => crew.filter(c => !aquaCrew(c)),  hire:() => hireKeeper(),    cost:() => KEEPER.hireCost,    wage:() => KEEPER.wage,    status:k => keeperStatus(k),    zone:"keeper",    sync:() => syncCrew(),       ok:() => state.buildings.some(b => b.type === "station"),  need:"Needs a Keeper Station."},
  aquarist: {label:"Aquarist",  plural:"Aquarists",  color:"#1F6F9F", list:() => state.staff.keepers.filter(isAqua),          store:() => state.staff.keepers, crew:() => crew.filter(aquaCrew),            hire:() => hireKeeper("aqua"), cost:() => AQUARIST.hireCost, wage:() => AQUARIST.wage, status:k => keeperStatus(k),    zone:"keeper",    sync:() => syncCrew(),       ok:() => state.buildings.some(b => b.type === "diveshack"),  need:"Needs a Dive Shack."},
  vet:      {label:"Vet",       plural:"Vets",       color:"#B0384F", list:() => state.staff.vets,       crew:() => vcrew, hire:() => hireVet(),       cost:() => VET.hireCost,       wage:() => VET.wage,       status:v => vetStatus(v),       zone:"vet",       sync:() => syncVets(),       ok:() => hasDept("pmc"),                                     need:"Needs a Paleo-Medicine Center."},
  mechanic: {label:"Mechanic",  plural:"Mechanics",  color:"#C8642A", list:() => state.staff.mechanics,  crew:() => mcrew, hire:() => hireMechanic(),  cost:() => MAINT.hireCost,     wage:() => MAINT.wage,     status:m => mechanicStatus(m),  zone:"mechanic",  sync:() => syncMechanics(),  ok:() => state.buildings.some(b => b.type === "workshop"), need:"Needs a Workshop."},
  custodian:{label:"Custodian", plural:"Custodians", color:"#2E8B8B", list:() => state.staff.custodians, crew:() => ccrew, hire:() => hireCustodian(), cost:() => CUSTODIAN.hireCost, wage:() => CUSTODIAN.wage, status:m => custodianStatus(m), zone:"custodian", sync:() => syncCustodians(), ok:() => state.buildings.some(b => b.type === "closet"),   need:"Needs a Custodial Closet."},
  guard:    {label:"Guard",     plural:"Guards",     color:"#2B3F6B", list:() => state.staff.guards,     crew:() => gcrew, hire:() => hireGuard(),     cost:() => SECURITY.hireCost,  wage:() => SECURITY.wage,  status:m => guardStatus(m),     zone:"guard",     sync:() => syncGuards(),     ok:() => state.buildings.some(b => b.type === "security"), need:"Needs a Security Office."},
};
const STAFF_ORDER = ["keeper", "aquarist", "vet", "mechanic", "custodian", "guard"];

// Every worker with their type key, sorted by type then name
function staffRoster(){
  const out = [];
  for(const t of STAFF_ORDER) out.push(...STAFF_TYPES[t].list().map(s => ({s, t})).sort((a, b) => a.s.name.localeCompare(b.s.name)));
  return out;
}
function staffById(id){ for(const t of STAFF_ORDER){ const s = STAFF_TYPES[t].list().find(x => x.id === id); if(s) return {s, t}; } return null; }
const staffCrew = (s, t) => STAFF_TYPES[t].crew().find(c => c.id === s.id) || null;
const energyOf = s => s.stamina === undefined ? 100 : s.stamina;
const moraleOf = s => s.morale === undefined ? STAFF.startMorale : s.morale;
const staffWage = t => STAFF_TYPES[t].wage();
// Where a worker is drawn, for picking them with a tap
function staffPos(c){ const f = fillPos(c); return f || (c.at ? keeperPos(c) : null); }

/* ---------- hiring and firing ---------- */

function hireStaff(t){
  const T = STAFF_TYPES[t], why = T.hire();
  if(why) return why;
  const s = T.list()[T.list().length - 1];
  s.stamina = 100; s.morale = STAFF.startMorale;
  T.sync();
  return null;
}
function fireStaff(id){
  const f = staffById(id); if(!f) return;
  const T = STAFF_TYPES[f.t], c = staffCrew(f.s, f.t);
  for(const tr of [...state.staff.transfers]) if(tr.keeper === id){ if(tr.cargo) dropOff(tr, tr.cargo); else tr.keeper = null; }   // a delivery in hand is finished off, one only claimed goes back up
  if(f.t === "keeper" || f.t === "aquarist"){
    // whatever the keeper was chasing goes back
    for(const l of state.safety.loose) if(l.keeper === id) l.keeper = null;
    if(c) returnCarry(c);
  }
  else if(f.t === "custodian" && c) returnCustCarry(c);
  if(c) resetAtv(c);
  const list = (T.store || T.list)(), i = list.indexOf(f.s); if(i >= 0) list.splice(i, 1);
  T.sync(); syncAtvs();
}
function staffFireDialog(id){
  const f = staffById(id); if(!f) return;
  askConfirm("Are you sure?", `Fire ${f.s.name}, your ${STAFF_TYPES[f.t].label.toLowerCase()}? They stop work right away and the ${money(STAFF_TYPES[f.t].cost())} hiring fee isn't refunded.`, "Fire", () => { fireStaff(id); afterChange(); render(); });
}
function sciFireDialog(kind){
  const k = SCIENTISTS[kind];
  askConfirm("Are you sure?", `Let one ${k.label.toLowerCase()} go? Their bay closes, and any job running in it stops and is refunded.`, "Fire", () => { fireScientist(kind); afterChange(); render(); });
}

/* ---------- energy, morale and thoughts ---------- */

// Why a worker feels the way they do: {good, text, w} where w moves their morale target
function moraleFactors(s, t){
  const out = [], e = energyOf(s), c = staffCrew(s, t), onClock = (s.workMin || 0) + (s.idleMin || 0), share = onClock ? (s.workMin || 0) / onClock : .5;
  const add = (good, text, w) => out.push({good, text, w});
  if(e < KEEPER.restBelow) add(false, "I'm exhausted.", -18);
  else if(e < 50) add(false, "My feet are killing me.", -6);
  else if(e >= 75) add(true, "I'm feeling fresh.", 8);
  if(onClock >= STAFF.minSample){
    if(share < STAFF.worked[0]) add(false, "There's hardly anything to do.", -8);
    else if(share > STAFF.worked[1]) add(false, "I haven't had a minute to myself.", -8);
    else add(true, "A good day's work.", 10);
  }
  if(state.buildings.some(b => b.type === "breakroom" && !unpowered(b))) add(true, "Nice to have a break room.", 5);
  else add(false, "Where are we meant to take a break?", -6);
  if(state.buildings.some(b => BUILDINGS[b.type].dept && unpowered(b))) add(false, "We're working in the dark back here.", -6);
  if(s.zone) add(true, "I know my patch.", 3);
  if(state.rating >= 4) add(true, "Proud to work at a park like this.", 8);
  else if(state.rating < 2) add(false, "I'm a bit embarrassed to work here.", -8);
  if(c && c.riding) add(true, "Love the ATV.", 3);
  return out;
}
const moraleTarget = (s, t) => clamp(52 + moraleFactors(s, t).reduce((a, f) => a + f.w, 0), 0, 100);

// Breaks for vets, mechanics, custodians and guards (keepers run their own in keepers.js).
// `homes` is the worker's own building type's list, where they rest slowly when there's no break room.
function staffMaybeRest(c, homes){
  const f = staffById(c.id);
  if(!f || c.cargo || energyOf(f.s) >= STAFF.restBelow) return false;
  const rooms = state.buildings.filter(b => b.type === "breakroom" && kGraph.anchors[b.id] && !unpowered(b));
  const r = nearestOf(c, rooms.length ? rooms : homes);
  if(!r) return false;
  if(r.n === c.at){ c.job = "resting"; c.route = []; return true; }
  setRoute(c, r.w, r.n); c.job = "toRest"; return true;
}
// A minute-by-minute rest; returns the time left over (none: a break fills what's given)
function staffRestStep(c, left){
  const f = staffById(c.id); if(!f){ c.job = "idle"; return 0; }
  const fast = state.buildings.some(b => b.type === "breakroom" && kGraph.anchors[b.id] === c.at);
  f.s.stamina = Math.min(100, energyOf(f.s) + left * (fast ? STAFF.restPerMin : STAFF.restPerMin / 4));
  if(f.s.stamina >= 95){ c.job = "idle"; c.wait = 0; }
  return 0;
}

// Called every tick: non-keepers tire, everyone's day is logged and their morale drifts toward what the job gives them
function staffTick(dtMin){
  for(const {s, t} of staffRoster()){
    const c = staffCrew(s, t);
    if(!c || !c.at) continue;
    const busy = !["idle", "home", "resting", "toRest"].includes(c.job) || (c.route && c.route.length > 0);
    if(busy) s.workMin = (s.workMin || 0) + dtMin; else s.idleMin = (s.idleMin || 0) + dtMin;
    if(t !== "keeper" && t !== "aquarist") s.stamina = clamp(energyOf(s) - dtMin * (busy ? STAFF.workDrain : STAFF.idleDrain), 0, 100);
    const m = moraleOf(s);
    s.morale = clamp(m + (moraleTarget(s, t) - m) * Math.min(1, dtMin / STAFF.moraleStep), 0, 100);
  }
}
function staffNight(){
  for(const {s} of staffRoster()){ s.stamina = 100; s.workMin = 0; s.idleMin = 0; }
}
