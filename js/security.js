/* =====================================================================
   SECURITY
   Some guests are rowdy, and when they're unhappy they break things:
   benches and bins, graffiti on buildings, a kick at an exhibit fence.
   Security guards patrol the paths from a Security Office. Vandalism near
   a guard is rare, and any vandal a guard gets close to is thrown out.
   With cameras researched, each office watches the paths around it and
   sends the nearest guard straight to trouble.
   ===================================================================== */

let gcrew = [];   // guards walking around right now (positions aren't saved)

const offices = () => state.buildings.filter(b => b.type === "security" && kGraph && kGraph.anchors[b.id]);
const guardRec = c => state.staff.guards.find(x => x.id === c.id) || null;
const propCond = b => b.cond ?? 100;
const isBroken = b => !!BUILDINGS[b.type].prop && propCond(b) < VANDAL.brokenBelow;
function freshVandalLog(){ return {acts:0, caught:0, spots:[]}; }
const vandalLog = () => state.guestLog.vandal || (state.guestLog.vandal = freshVandalLog());

/* ---------- vandalism ---------- */

// Is a guard close enough to put troublemakers off at this spot?
const guardNear = (x, y) => gcrew.some(c => c.at && Math.hypot(keeperPos(c)[0] - x, keeperPos(c)[1] - y) < SECURITY.deterRadius);
// How likely trouble is at a spot: guards and lamps put vandals off, heavy litter eggs them on
function deterrence(x, y){
  let f = 1;
  if(guardNear(x, y)) f *= SECURITY.deterCut;
  if(state.buildings.some(b => b.type === "lamp" && !isBroken(b) && Math.hypot(centroid(b.points)[0] - x, centroid(b.points)[1] - y) < VANDAL.lampReach)) f *= VANDAL.lampCut;
  if(litterAt(x, y) >= 6) f *= VANDAL.litterBoost;
  return f;
}
// Is this spot watched by a Security Office's cameras?
function onCamera(x, y){
  if(!hasTech("cameras")) return false;
  const near = (b, r) => { const [cx, cy] = centroid(b.points); return Math.hypot(cx - x, cy - y) < r; };
  return offices().some(b => near(b, SECURITY.cameraRadius)) || state.buildings.some(b => b.type === "camera" && !isBroken(b) && near(b, SECURITY.postRadius));
}
// Each minute, an unhappy rowdy party out on the paths might break something
function vandalTick(p, dt){
  if(!p.rowdy || p.home || p.in || !p.at || p.mood >= VANDAL.moodBelow) return;
  const grumpy = Math.min(2.5, (VANDAL.moodBelow - p.mood) / 30);
  // guests who've learned about the place are less likely to wreck it
  const calm = 1 - EDU.vandalCut * (p.edu || 0) / 100;
  const chance = 1 - Math.pow(1 - Math.min(.5, VANDAL.rate * grumpy * calm * deterrence(p.at.x, p.at.y)), dt);
  if(Math.random() < chance) vandalize(p);
}
// Pick something nearby and damage it. Returns what was hit, or null if there's nothing to hit.
function vandalize(p){
  const x = p.at.x, y = p.at.y, opts = [];
  for(const b of state.buildings){
    const [bx, by] = centroid(b.points), t = BUILDINGS[b.type];
    if(Math.hypot(bx - x, by - y) > VANDAL.reach + Math.max(t.w, t.d) / 2) continue;
    if(t.prop){ if(propCond(b) > 0) opts.push({kind:"prop", b}); }
    else if((b.graffiti || 0) < 100) opts.push({kind:"graffiti", b});
  }
  for(const e of state.exhibits) if(!e.viv && distToEdge(x, y, e.points) <= VANDAL.reach) opts.push({kind:"fence", e});
  if(!opts.length) return null;
  const o = opts[Math.floor(Math.random() * opts.length)];
  if(o.kind === "prop") o.b.cond = Math.max(0, propCond(o.b) - VANDAL.propHit);
  else if(o.kind === "graffiti") o.b.graffiti = Math.min(100, (o.b.graffiti || 0) + VANDAL.graffiti);
  else o.e.cond = Math.max(0, condOf(o.e) - VANDAL.fenceHit);
  p.vandal = true;
  const L = vandalLog();
  L.acts++; L.spots.push([x, y]); if(L.spots.length > 12) L.spots.shift();
  // caught on camera: the nearest guard comes running
  if(onCamera(x, y)){ p.wanted = true; dispatchGuard(p); }
  return o;
}

/* ---------- guards ---------- */

function syncGuards(){
  const ids = new Set(state.staff.guards.map(m => m.id));
  gcrew = gcrew.filter(c => ids.has(c.id));
  for(const m of state.staff.guards) if(!gcrew.some(c => c.id === m.id)) gcrew.push({id:m.id, at:null, route:[], t:0, job:"idle", wait:0, chase:null});
}
function guardGo(c, n, job){
  const w = walkFrom(c.at, c);
  if(!n || !w.dist.has(n)){ c.job = "idle"; c.wait = 10; return false; }
  setRoute(c, w, n); c.job = job; return true;
}
// Send the nearest guard who isn't already chasing someone
function dispatchGuard(p){
  let best = null, bd = Infinity;
  for(const c of gcrew){
    if(!c.at || c.chase) continue;
    const [gx, gy] = keeperPos(c), d = Math.hypot(gx - p.at.x, gy - p.at.y);
    if(d < bd){ bd = d; best = c; }
  }
  if(best){ best.chase = p; best.route = []; best.job = "idle"; best.wait = 0; }
}
// A guard in a zone only patrols inside the zone's outline
function inGuardZone(r, x, y){ if(!r.zone) return true; const z = zoneById(r.zone); return !z || inPoly(x, y, z.points); }
// Where to patrol next: a spot where there was trouble lately, or wherever the crowds are
function patrolStop(c, r){
  const L = vandalLog(), spots = L.spots.filter(([x, y]) => inGuardZone(r, x, y));
  let x, y;
  if(spots.length && Math.random() < .5) [x, y] = spots[Math.floor(Math.random() * spots.length)];
  else {
    const here = parties.filter(p => p.at && inGuardZone(r, p.at.x, p.at.y));
    if(!here.length) return null;
    const p = here[Math.floor(Math.random() * here.length)]; x = p.at.x; y = p.at.y;
  }
  return nearestNode(x, y);
}
function guardDecide(c, r){
  const p = c.chase;
  if(p && !p.gone && p.at){ guardGo(c, nearestNode(p.at.x, p.at.y), "chasing"); if(c.job === "chasing") return; }
  c.chase = null;
  const n = patrolStop(c, r);
  if(n && n !== c.at && guardGo(c, n, "patrolling")) return;
  c.job = "idle"; c.wait = SECURITY.patrolWait;
}
// Throw out every vandal close to a guard, steer guests out during an escape, and reassure everyone nearby
function guardWatch(){
  const danger = state.safety.loose.some(l => l.status === "loose" && isDangerous(SPECIES_BY_ID[l.sp]));
  const L = vandalLog();
  for(const c of gcrew){
    if(!c.at) continue;
    const [gx, gy] = keeperPos(c);
    for(const p of parties){
      if(p.gone || !p.at) continue;
      const d = Math.hypot(p.at.x - gx, p.at.y - gy);
      if(p.vandal && d < SECURITY.catchRadius){
        leaveQueue(p); p.gone = true; p.ejected = true; L.caught++;
        if(c.chase === p){ c.chase = null; c.route = []; c.job = "idle"; c.wait = 0; }
        if(L.caught === 1 || L.caught % 5 === 0) events.toast(`${(guardRec(c) || {}).name || "A guard"} threw out a party of vandals. ${L.caught} caught today.`, "good");
        continue;
      }
      if(d < SECURITY.deterRadius && !p.rowdy) thinks(p, "safe");
      if(danger && d < SECURITY.evacRadius && !p.home){ thinks(p, "scared"); goHome(p); }
    }
  }
}

function guardsTick(dtMin){
  if(!kGraph) return;
  syncGuards();
  for(const c of gcrew){
    const r = guardRec(c); if(!r) continue;
    if(!c.at){ const o = offices()[0]; if(!o) continue; c.at = kGraph.anchors[o.id]; c.job = "idle"; }
    let left = dtMin, steps = 0;
    while(left > 0 && steps++ < 40){
      if(c.route.length){
        const nx = c.route[0], d = Math.hypot(nx.x - c.at.x, nx.y - c.at.y), sp = SECURITY.speed * (onAtv(c) ? VEHICLES.speedMult : 1), go = sp * left, rem = d * (1 - c.t);
        if(go < rem){ c.t += go / (d || 1); left = 0; }
        else { left -= rem / sp; c.at = nx; c.route.shift(); c.t = 0; atNode(c); if(!c.route.length){ c.job = "idle"; c.wait = c.chase ? 0 : SECURITY.patrolWait; } }
        continue;
      }
      if(c.wait > 0){ const w = Math.min(c.wait, left); c.wait -= w; left -= w; continue; }
      guardDecide(c, r);
      if(!c.route.length && c.wait <= 0) c.wait = 5;
    }
  }
  guardWatch();
}
function guardsNight(){ for(const c of gcrew){ resetAtv(c); c.at = null; c.route = []; c.job = "idle"; c.chase = null; c.wait = 0; } }

function hireGuard(){
  if(!state.buildings.some(b => b.type === "security")) return "Build a Security Office first.";
  if(!canAfford(SECURITY.hireCost)) return `Hiring costs ${money(SECURITY.hireCost)}.`;
  spend(SECURITY.hireCost, "built");
  const used = new Set(allStaffList().map(k => k.name));
  const name = ["Brock","Dana","Frank","Greer","Hunt","Ira","Jax","Kane","Lux","Mercer","Nash","Opal","Price","Reyes","Shaw"].find(n => !used.has(n)) || "Guard " + (state.staff.guards.length + 1);
  state.staff.guards.push({id:uid("s-"), name});
  return null;
}
function guardStatus(m){
  const c = gcrew.find(x => x.id === m.id); if(!c) return "Clocking in";
  if(c.chase) return "Chasing a vandal caught on camera";
  return {patrolling:"On patrol"}[c.job] || (c.at ? "Keeping watch" : "Clocking in");
}
