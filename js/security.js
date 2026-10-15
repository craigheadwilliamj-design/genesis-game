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
  const dk = darkLevel();
  if(dk > 0){   // at night the lamps' light is what counts: a lit spot is safer, a dark one is a gift
    const lit = lightAt(x, y) >= LAMP.litAt;
    f *= lit ? 1 - dk * (1 - LAMP.nightCut) : 1 + dk * (LAMP.darkBoost - 1);
    if(!lit && state.buildings.some(b => b.type === "lamp" && !isBroken(b) && Math.hypot(centroid(b.points)[0] - x, centroid(b.points)[1] - y) < VANDAL.lampReach)) f *= VANDAL.lampCut;
  } else if(state.buildings.some(b => b.type === "lamp" && !isBroken(b) && Math.hypot(centroid(b.points)[0] - x, centroid(b.points)[1] - y) < VANDAL.lampReach)) f *= VANDAL.lampCut;
  if(litterAt(x, y) >= 6) f *= VANDAL.litterBoost;
  return f;
}
// hook: a camera could watch a cone out of its lens (propFront(b)); today it watches the whole circle
// Is this spot watched by a Security Office's cameras?
function onCamera(x, y){
  if(!hasTech("cameras")) return false;
  const near = (b, r) => { const [cx, cy] = centroid(b.points); return Math.hypot(cx - x, cy - y) < r; };
  const seen = offices().some(b => near(b, SECURITY.cameraRadius)) || state.buildings.some(b => b.type === "camera" && !isBroken(b) && near(b, SECURITY.postRadius));
  // at night a camera needs light: unlit spots are only seen some of the time
  if(seen && darkLevel() > 0 && lightAt(x, y) < LAMP.litAt) return Math.random() < 1 - darkLevel() * (1 - LAMP.darkCam);
  return seen;
}

/* ---------- lamp light ---------- */

// 0 (day) to 1 (full night): the night wash, normalised
const darkLevel = () => nightDark() / NIGHT.dark;
// Where each working lamp's pool is centred, and its radius. The pool leans toward the way the lamp faces.
function lampSpots(){
  return state.buildings.filter(b => b.type === "lamp" && !isBroken(b)).map(b => {
    const [cx, cy] = centroid(b.points), f = propFront(b);
    return {id:b.id, x:cx + f[0] * LAMP.lean, y:cy + f[1] * LAMP.lean, r:LAMP.radius};
  });
}
// How lit a spot is by the lamps (0 to 1, regardless of the hour)
function lightAt(x, y, spots = lampSpots()){
  let v = 0;
  for(const s of spots){ const d = Math.hypot(s.x - x, s.y - y); if(d < s.r) v = Math.max(v, 1 - d / s.r); }
  return v;
}
// Mark each guest-path corner with how lit the walk from there is (n.lit, 0 to 1), count the dark stretches, and note which exhibits a lit path sees
let darkStretches = 0;
function indexLight(nodes){
  const spots = lampSpots();
  for(const n of nodes.values()){
    n.lit = 0;
    if(n.rail) continue;
    n.lit = lightAt(n.x, n.y, spots);
    for(const m of n.adj.keys()) if(!m.rail) n.lit = Math.max(n.lit, lightAt((n.x + m.x) / 2, (n.y + m.y) / 2, spots) * .999);
  }
  // a dark stretch is a run of connected unlit corners
  darkStretches = 0; const seen = new Set();
  for(const n of nodes.values()){
    if(n.rail || seen.has(n) || n.lit >= LAMP.litAt) continue;
    darkStretches++; const q = [n]; seen.add(n);
    while(q.length){ const c = q.pop(); for(const m of c.adj.keys()) if(!m.rail && !seen.has(m) && m.lit < LAMP.litAt){ seen.add(m); q.push(m); } }
  }
  const lit = new Set();
  for(const n of nodes.values()) if(n.sees && n.lit >= LAMP.litAt) for(const ids of n.sees.values()) for(const id of ids) lit.add(id);
  litExhibits = lit;
}
let litExhibits = new Set();
// At night, how much a party shuns an exhibit nobody can see from a lit path (1 is no change)
const darkPull = id => litExhibits.has(id) ? 1 : 1 - LAMP.pull * darkLevel();
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
    if(!c.at || c.chase || c.escort) continue;
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
      // a party the player called security on, waiting where it stands: the guard walks it to the gate
      const free = !c.escort && p.ejecting !== "escort";   // a guard walking someone out, or a party already being walked, is left alone
      if(free && p.hold && !p.vandal && d < PERS.escortRadius){ escortOut(p, c); continue; }
      if(free && (p.vandal || p.ejecting === true) && d < SECURITY.catchRadius){
        // caught: the guard walks them to the gate, no longer a vandal
        const wasVandal = p.vandal;
        p.vandal = false; p.ejected = true; escortOut(p, c, true);
        if(c.chase === p){ c.chase = null; c.route = []; c.job = "idle"; c.wait = 0; }
        if(!wasVandal) events.toast(`${(guardRec(c) || {}).name || "A guard"} caught the ${p.name} and threw them out.`, "good");
        else {
          L.caught++;
          if(L.caught === 1 || L.caught % 5 === 0) events.toast(`${(guardRec(c) || {}).name || "A guard"} threw out a party of vandals. ${L.caught} caught today.`, "good");
        }
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
    // walking a party to the gate: the guard stays beside them until they're out
    if(c.escort){
      const p = c.escort;
      if(!p.gone && p.at){ c.job = "escorting"; c.route = []; c.t = 0; continue; }
      c.escort = null; c.job = "idle"; c.wait = 0; if(p.at) c.at = p.at;
    }
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
function guardsNight(){ for(const c of gcrew){ resetAtv(c); c.at = null; c.route = []; c.job = "idle"; c.chase = null; c.escort = null; c.wait = 0; } }

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
