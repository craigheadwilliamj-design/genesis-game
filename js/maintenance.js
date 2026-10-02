/* =====================================================================
   MAINTENANCE
   Fences wear down from weather and from animals attacking them.
   Mechanics walk out from a Workshop to inspect and repair them.
   The condition the player sees is what the last inspection found.
   ===================================================================== */

let mcrew = [];   // mechanics walking around right now (positions aren't saved)
let repairsHaltedDay = -1;   // the day we last warned that repairs stopped for lack of money

const isAttacker = s => !!s.predator || SMART.includes(s.id);
function condOf(e){ return e.cond ?? 100; }
// What the player knows: the last inspection
function knownCond(e){ return e.inspected ? e.inspected.cond : condOf(e); }
function daysSinceInspect(e){ return e.inspected ? state.day - e.inspected.day : 99; }

// A worn fence holds less. A broken one holds nothing.
function effectiveStrength(e){
  const c = condOf(e);
  return c <= 0 ? 0 : baseStrength(e) * (.4 + .6 * c / 100);
}

// Condition lost per day: weather, plus every animal that attacks the fence
function wearPerDay(e){
  const b = barrierOf(e);
  let w = b.wear;
  if(!e.moat) for(const a of e.animals){
    const s = SPECIES_BY_ID[a.sp];
    if(isAttacker(s) && !isFlyer(s)) w += MAINT.attackWear * Math.min(2, escapeStrength(s) / b.strength);
  }
  // storms batter fences
  return w * weatherNow().wear;
}

function wearTick(dtMin){
  for(const e of state.exhibits){
    if(e.viv) continue;
    e.cond = Math.max(0, condOf(e) - wearPerDay(e) * dtMin / (CLOSE_MIN - OPEN_MIN));
  }
  // generators wear too; one that drops below the cut-out point stops making power
  for(const b of generators()){
    const was = genOnline(b);
    b.cond = Math.max(0, condOf(b) - POWER.genWear * dtMin / (CLOSE_MIN - OPEN_MIN));
    if(was && !genOnline(b)){ events.toast("A generator has broken down. Electrified fences may lose power until a mechanic repairs it.", "bad"); updatePower(); }
  }
  // vehicle depots wear; a worn-out depot grounds its ATVs
  for(const b of depots()){
    const was = condOf(b) >= VEHICLES.offlineBelow;
    b.cond = Math.max(0, condOf(b) - VEHICLES.wear * dtMin / (CLOSE_MIN - OPEN_MIN));
    if(was && condOf(b) < VEHICLES.offlineBelow) events.toast("A vehicle depot has broken down. Its ATVs are grounded until a mechanic repairs it.", "bad");
  }
}

// Things mechanics look after: exhibit fences, generators, and vehicle depots
function findTarget(id){ return state.exhibits.find(x => x.id === id) || state.buildings.find(x => x.id === id); }
const isMachine = o => o.type === "generator" || o.type === "depot";
const isPropB = o => !!(o.type && BUILDINGS[o.type] && BUILDINGS[o.type].prop);
const anchorFor = o => kGraph.anchors[isMachine(o) || isPropB(o) ? o.id : "fix:" + o.id];
const targetName = o => o.type === "generator" ? "a generator" : o.type === "depot" ? "a vehicle depot" : isPropB(o) ? BUILDINGS[o.type].one : o.name;
// broken = needs urgent work: a fence with a hole in it, or a generator that has cut out
const isDown = o => o.type === "generator" ? !genOnline(o) : o.type === "depot" ? condOf(o) < VEHICLES.offlineBelow : condOf(o) <= 0;
function repairCost(o, gain){
  if(o.type === "generator") return POWER.repairPerPercent * gain;
  if(o.type === "depot") return VEHICLES.repairPerPercent * gain;
  if(isPropB(o)) return BUILDINGS[o.type].price * VANDAL.repairShare * gain;
  return perimeter(o.points) * barrierOf(o).repair * gain / 100;
}

/* ---------- mechanics ---------- */

function workshops(){ return state.buildings.filter(b => b.type === "workshop" && kGraph && kGraph.anchors[b.id]); }

function syncMechanics(){
  const ids = new Set(state.staff.mechanics.map(m => m.id));
  mcrew = mcrew.filter(c => ids.has(c.id));
  for(const m of state.staff.mechanics) if(!mcrew.some(c => c.id === m.id)) mcrew.push({id:m.id, at:null, route:[], t:0, job:"idle", wait:0, target:null, work:0});
}

// The most urgent fence nobody else is working on: broken first, then overdue inspections, then worn ones
function pickFence(c){
  const taken = new Set(mcrew.filter(x => x !== c && x.target).map(x => x.target));
  const mz = (state.staff.mechanics.find(m => m.id === c.id) || {}).zone;   // a mechanic in a zone only looks after that zone
  let best = null;
  for(const e of state.exhibits.filter(x => !x.viv).concat(generators(), depots())){
    if(taken.has(e.id) || !anchorFor(e) || (mz && e.zone !== mz)) continue;
    const k = knownCond(e), overdue = daysSinceInspect(e) >= MAINT.inspectEvery;
    let score = 0;
    if(isDown(e)) score = 1000;                               // broken fences and dead generators are obvious
    else if(k < MAINT.repairBelow) score = 500 + (100 - k);
    else if(overdue) score = 100 + daysSinceInspect(e);
    if(score && (!best || score > best.score)) best = {e, score};
  }
  // vandalized benches, bins, picnic areas, and lamps: obvious, so no inspection round, and after fences
  for(const b of state.buildings){
    if(!isPropB(b) || propCond(b) >= 60 || taken.has(b.id) || !anchorFor(b) || (mz && b.zone !== mz)) continue;
    const score = 300 + (100 - propCond(b));
    if(!best || score > best.score) best = {e:b, score};
  }
  return best && best.e;
}

function mechanicGo(c, n, job){
  const w = walkFrom(c.at, c);
  if(!w.dist.has(n)){ c.job = "idle"; c.wait = 15; c.target = null; return; }
  setRoute(c, w, n); c.job = job;
}

function mechanicArrive(c){
  const e = findTarget(c.target);
  if(c.job === "toFence" && e){ c.job = "inspecting"; c.work = MAINT.inspectMinutes; return; }
  c.job = "idle"; c.target = null;
}

function mechanicsTick(dtMin){
  if(!kGraph) return;
  syncMechanics();
  syncAtvs();
  for(const c of mcrew){
    if(!c.at){ const w = workshops()[0]; if(!w) continue; c.at = kGraph.anchors[w.id]; }
    let left = dtMin, steps = 0;
    while(left > 0 && steps++ < 40){
      const e = c.target && findTarget(c.target);
      if(c.job === "inspecting"){
        const w = Math.min(c.work, left); c.work -= w; left -= w;
        if(c.work <= 0){
          if(!e){ c.job = "idle"; c.target = null; continue; }
          e.inspected = {day:state.day, cond:Math.round(condOf(e))};
          if(condOf(e) < MAINT.repairBelow) c.job = "repairing"; else { c.job = "idle"; c.target = null; }
        }
        continue;
      }
      if(c.job === "repairing"){
        if(!e){ c.job = "idle"; c.target = null; continue; }
        // no repairs on credit: a broke park can't buy parts
        if(state.money <= 0){
          c.job = "idle"; c.target = null; c.wait = 60;
          if(repairsHaltedDay !== state.day){ repairsHaltedDay = state.day; events.toast("Mechanics stopped repairs. The park can't pay for parts until it's back in the black.", "bad"); }
          continue;
        }
        const need = 100 - condOf(e), mins = Math.min(left, need / MAINT.repairPerMinute);
        const gain = mins * MAINT.repairPerMinute;
        spend(repairCost(e, gain), "repairs");
        e.cond = Math.min(100, condOf(e) + gain); left -= mins;
        if(condOf(e) >= 99.9){ e.cond = 100; e.inspected = {day:state.day, cond:100}; c.job = "idle"; c.target = null; if(e.type === "generator") updatePower(); events.changed(); }
        continue;
      }
      if(c.route.length){
        const nx = c.route[0], d = Math.hypot(nx.x - c.at.x, nx.y - c.at.y), sp = MAINT.speed * (onAtv(c) ? VEHICLES.speedMult : 1), go = sp * left, rem = d * (1 - c.t);
        if(go < rem){ c.t += go / (d || 1); left = 0; }
        else { left -= rem / sp; c.at = nx; c.route.shift(); c.t = 0; atNode(c); if(!c.route.length) mechanicArrive(c); }
        continue;
      }
      if(c.job !== "idle"){ mechanicArrive(c); continue; }
      if(c.wait > 0){ const w = Math.min(c.wait, left); c.wait -= w; left -= w; continue; }
      const f = pickFence(c);
      if(f){ c.target = f.id; mechanicGo(c, anchorFor(f), "toFence"); }
      else { c.wait = 20; const w = workshops()[0]; if(w && kGraph.anchors[w.id] !== c.at) mechanicGo(c, kGraph.anchors[w.id], "home"); }
    }
  }
}

function mechanicsNight(){ for(const c of mcrew){ resetAtv(c); c.at = null; c.route = []; c.job = "idle"; c.target = null; } }

function hireMechanic(){
  if(!state.buildings.some(b => b.type === "workshop")) return "Build a Workshop first.";
  if(!canAfford(MAINT.hireCost)) return `Hiring costs ${money(MAINT.hireCost)}.`;
  spend(MAINT.hireCost, "built");
  const used = new Set(state.staff.keepers.concat(state.staff.mechanics).map(k => k.name));
  const name = ["Rae","Bo","Dot","Hank","Ivy","Jojo","Kit","Lou","Mags","Ned","Ozzie","Pip","Roxy","Stan","Tia"].find(n => !used.has(n)) || "Mechanic " + (state.staff.mechanics.length + 1);
  state.staff.mechanics.push({id:uid("m-"), name});
  return null;
}
function mechanicStatus(m){
  const c = mcrew.find(x => x.id === m.id); if(!c) return "Clocking in";
  const e = c.target && findTarget(c.target), n = e ? targetName(e) : "a fence";
  return {toFence:`Walking to ${n}`, inspecting:`Inspecting ${n}`, repairing:`Repairing ${n}`, home:"Heading back to the workshop"}[c.job] || "Waiting for work";
}
