/* =====================================================================
   ESCAPES
   Barriers, breakouts, loose animals, and guest safety.
   Vivariums are acrylic and escape-proof, so none of this applies to them.
   ===================================================================== */

const isFlyer = s => FLYERS.includes(s.id);
// How hard an animal pushes on its barrier: bigger animals and predators push harder
const escapeStrength = s => Math.round(Math.sqrt(s.space) * 1.2 + (s.predator ? 25 : 0));
// Predators and big herbivores can kill guests when loose
const isDangerous = s => !!s.predator || s.space >= ESCAPE.bigHerbivore;
const hasTech = id => state.science.tech.includes(id);
const nowAbs = () => state.day * 1440 + state.minute;

function freshSafety(){ return {deaths:0, escapesFrom:1, loose:[]}; }

function barrierOf(e){ return BARRIERS[e.barrier || "wood"]; }
function isBreached(e){ return !e.viv && condOf(e) <= 0; }

// The weakest barrier the animal needs, for advice
function barrierNeeded(s){
  if(isFlyer(s)) return "aviary netting";
  const ok = Object.values(BARRIERS).filter(b => b.strength >= escapeStrength(s)).sort((a, b) => a.strength - b.strength)[0];
  return ok ? ok.label.toLowerCase() : "a moat";
}

// Can this animal get out of this exhibit? Returns why, or null if it's held.
function escapeRisk(e, s){
  if(e.viv) return null;
  if(isFlyer(s)) return e.aviary ? null : `${s.name} can fly out. It needs aviary netting.`;
  if(e.moat) return null;
  const b = barrierOf(e), str = escapeStrength(s);
  if(str > b.strength) return `${s.name} can break through ${b.label.toLowerCase()} (strength ${b.strength}, it needs ${str}). Use ${barrierNeeded(s)} or a moat.`;
  if(str > effectiveStrength(e) && e.barrier === "electric" && e.powered === false) return `The electric fence has no power, so it's just wire. ${s.name} can push through. Build or repair generators.`;
  if(str > effectiveStrength(e)) return isBreached(e) ? `The fence is broken. ${s.name} can walk right out until a mechanic repairs it.` : `The fence is worn. ${s.name} can push through it until a mechanic repairs it.`;
  return null;
}

// How well guests can see into an exhibit. Viewing platforms give an aerial view over any wall.
function viewFactor(e, reach){
  if(e.viv) return 1;
  let f = barrierOf(e).view;
  const n = state.buildings.filter(b => b.type === "platform" && b.exhibitId === e.id && reach[b.id]).length;
  if(n) f = Math.max(f, 1) * Math.min(1.7, 1.4 + .15 * (n - 1));
  return f;
}

function upgradeCost(e, key){ return Math.round(perimeter(e.points) * BARRIERS[key].perMeter); }
function moatCost(e){ return Math.round(perimeter(e.points) * MOAT_PER_METER); }
function aviaryCost(e){ return Math.round(area(e.points) * AVIARY_PER_SQM); }

/* ---------- breakouts ---------- */

function escapesTick(dtMin){
  const sf = state.safety;
  if(state.day < sf.escapesFrom || !kGraph) return;
  for(const e of state.exhibits){
    if(e.viv || !e.animals.length) continue;
    // the animal most likely to get out decides how risky this exhibit is
    let worst = null, excess = 0;
    for(const a of e.animals){
      const s = SPECIES_BY_ID[a.sp];
      if(!escapeRisk(e, s)) continue;
      const x = isFlyer(s) ? 999 : escapeStrength(s) - effectiveStrength(e);
      if(x > excess){ excess = x; worst = a; }
    }
    if(!worst) continue;
    const p = Math.min(.05, excess / 100 * .003) * (1.6 - e.happy / 100) * (isBreached(e) ? 3 : 1);
    if(Math.random() < 1 - Math.pow(1 - p, dtMin)) breakOut(e, worst);
  }
  moveLoose(dtMin);
  harmGuests(dtMin);
}

function nearestNode(x, y){
  let best = null, bd = Infinity;
  for(const n of kGraph.nodes.values()){ const d = Math.hypot(n.x - x, n.y - y); if(d < bd){ bd = d; best = n; } }
  return best;
}

function breakOut(e, a){
  const s = SPECIES_BY_ID[a.sp], [cx, cy] = centroid(e.points);
  e.animals.splice(e.animals.indexOf(a), 1);
  e.cond = 0; e.inspected = {day:state.day, cond:0};   // a breakout leaves the fence broken until a mechanic fixes it
  const n = nearestNode(cx, cy);
  state.safety.loose.push({id:a.id, sp:a.sp, q:a.q, cl:a.cl, sick:a.sick, from:e.id, at:n ? n.k : null, x:cx, y:cy, next:null, t:0, status:"loose"});
  state.rating = Math.max(0, state.rating - .05);
  events.toast(`ESCAPE! A ${s.name} broke out of ${e.name}.${isDangerous(s) ? " It's dangerous. Guests are at risk." : ""} ${vetsOnDuty() ? "Vets with dart guns are on the way." : "Keepers with dart guns are on the way."}`, "bad");
  events.changed();
}

// Loose animals wander the paths
function moveLoose(dtMin){
  for(const l of state.safety.loose){
    if(l.status !== "loose") continue;
    // with no paths at all it stays where it got out; it starts wandering once there are paths again
    let at = kGraph.nodes.get(l.at); if(!at){ at = nearestNode(l.x ?? 0, l.y ?? 0); if(!at) continue; l.at = at.k; }
    let left = ESCAPE.looseSpeed * dtMin;
    for(let i = 0; i < 20 && left > 0; i++){
      let nx = l.next && kGraph.nodes.get(l.next);
      if(!nx){ const opts = [...at.adj.keys()]; if(!opts.length) break; nx = opts[Math.floor(Math.random() * opts.length)]; l.next = nx.k; l.t = 0; }
      const d = Math.hypot(nx.x - at.x, nx.y - at.y) || 1, rem = d * (1 - l.t);
      if(left < rem){ l.t += left / d; left = 0; }
      else { left -= rem; at = nx; l.at = nx.k; l.next = null; l.t = 0; }
    }
  }
}
function loosePos(l){
  const a = kGraph && kGraph.nodes.get(l.at), b = l.next && kGraph.nodes.get(l.next);
  if(!a) return l.x !== undefined ? [l.x, l.y] : null;
  return b ? [a.x + (b.x - a.x) * l.t, a.y + (b.y - a.y) * l.t] : [a.x, a.y];
}

// Dangerous animals on the loose can kill guests
function harmGuests(dtMin){
  const sf = state.safety;
  for(const l of sf.loose){
    if(l.status !== "loose" || !isDangerous(SPECIES_BY_ID[l.sp]) || !parties.length) continue;
    const p = .01 * Math.min(1, guestCount() / 100);
    if(Math.random() < 1 - Math.pow(1 - p, dtMin)){
      // the victim comes from the party closest to the animal
      const at = loosePos(l);
      let v = parties[0], vd = Infinity;
      if(at) for(const q of parties){ const d = q.at ? Math.hypot(q.at.x - at[0], q.at.y - at[1]) : Infinity; if(d < vd){ vd = d; v = q; } }
      if(--v.n <= 0){ leaveQueue(v); v.gone = true; parties = parties.filter(q => q !== v); }
      else { thinks(v, "scared"); goHome(v); }
      sf.deaths++;
      spend(ESCAPE.lawsuit, "fines");
      state.rating = Math.max(0, state.rating - .3);
      events.toast(`A guest was killed by the escaped ${SPECIES_BY_ID[l.sp].name}. The family is suing for ${money(ESCAPE.lawsuit)}. ${sf.deaths} of ${ESCAPE.shutdownDeaths} deaths before the park is shut down.`, "bad");
      if(sf.deaths >= ESCAPE.shutdownDeaths){ state.over = "shutdown"; events.gameOver(); return; }
    }
  }
}

// Guests stay away while animals are loose
function fearFactor(){
  const l = state.safety ? state.safety.loose.filter(x => x.status === "loose") : [];
  if(!l.length) return 1;
  return l.some(x => isDangerous(SPECIES_BY_ID[x.sp])) ? .3 : .7;
}

// Put a recovered animal back: into its exhibit if keepers can still reach it, otherwise to TAR's holding pens
function returnAnimal(l, e){
  state.safety.loose = state.safety.loose.filter(x => x !== l);
  const s = SPECIES_BY_ID[l.sp];
  if(e){ e.animals.push({id:l.id, sp:l.sp, cl:l.cl, q:l.q, ...(l.sick ? {sick:l.sick} : {})}); events.toast(`Keepers returned the ${s.name} to ${e.name}.`, "good"); }
  else { state.science.ready.push({id:l.id, sp:l.sp, q:l.q ?? 90}); events.toast(`Keepers put the ${s.name} in holding. Tap an exhibit to move it in.`, "good"); }
  events.changed();
}

// At night, anything sedated is put away; loose animals stay loose
function escapesNight(){
  for(const l of [...state.safety.loose]){
    l.keeper = null; l.vet = null;
    if(l.status === "sedated" || l.status === "carried" || l.status === "darting"){ const e = state.exhibits.find(x => x.id === l.from); returnAnimal(l, e && kGraph.anchors[e.id] ? e : null); }
  }
}
