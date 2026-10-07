/* =====================================================================
   GUEST PERSONALITIES
   Each party has a primary and a secondary personality (PERSONALITIES in
   data.js). They steer which exhibits a party heads for, how it reacts to
   what it sees, what it spends and how much it puts up with. Hooligans
   also sneak in, tease the animals, and have to be caught by security.
   A player can call security on any party (ejectGuest): ordinary guests
   wait where they are for a guard and are walked to the gate, hooligans
   keep running around until a guard catches them.
   ===================================================================== */

const SURNAMES = ["Abbott","Baker","Chen","Diaz","Evans","Fox","Garcia","Hughes","Ito","Jones","Khan","Lopez","Moore","Nguyen","Okafor","Patel","Quinn","Reyes","Singh","Tran","Usher","Vega","Wong","Young","Zhang"];

// The personalities of a party, each with its pull: the primary in full, the secondary partly
const persOf = p => (p.pers || []).map((k, i) => [PERSONALITIES[k], i ? PERS.second : 1]);
// Blend one multiplier (fx key) across a party's personalities. 1 means no effect.
// (worked out once per party and kept, since this runs for every party every tick)
function pm(p, key){
  const c = p.fxc || (p.fxc = {});
  if(key in c) return c[key];
  let v = 1; for(const [x, w] of persOf(p)){ const f = x.fx[key]; if(f !== undefined) v += (f - 1) * w; }
  return c[key] = v;
}
// The same for how fast a need builds
function pneed(p, k){
  const c = p.fxc || (p.fxc = {}), key = "need:" + k;
  if(key in c) return c[key];
  let v = 1; for(const [x, w] of persOf(p)){ const f = x.fx.need && x.fx.need[k]; if(f !== undefined) v += (f - 1) * w; }
  return c[key] = v;
}
const isHooligan = p => !!p.pers && p.pers[0] === "hooligan";
const hasPers = (p, k) => !!p.pers && p.pers.includes(k);

// Pick a primary and a secondary, by weight
function rollPers(){
  const pick = skip => {
    const ks = Object.keys(PERSONALITIES).filter(k => k !== skip);
    let r = Math.random() * ks.reduce((s, k) => s + PERSONALITIES[k].weight, 0);
    for(const k of ks){ r -= PERSONALITIES[k].weight; if(r <= 0) return k; }
    return ks[ks.length - 1];
  };
  const a = pick(null);
  return [a, pick(a)];
}
// About what share of parties have a hooligan in them
function hooliganShare(){
  const w = PERSONALITIES.hooligan.weight;
  let s = w;
  for(const [k, x] of Object.entries(PERSONALITIES)) if(k !== "hooligan") s += x.weight * w / (1 - x.weight);
  return s;
}

/* ---------- what an exhibit looks like to a party ---------- */

const sightCache = new Map();
// What guests can see in an exhibit right now. Cached for a park minute.
function exhibitTraits(e){
  const c = sightCache.get(e.id), stamp = Math.floor(state.minute);
  if(c && c.stamp === stamp && c.n === e.animals.length) return c;
  const n = Math.max(1, e.animals.length), spp = [...speciesCounts(e).keys()].map(id => SPECIES_BY_ID[id]).filter(Boolean);
  const share = f => e.animals.filter(a => f(a, SPECIES_BY_ID[a.sp])).length / n;
  const t = {
    stamp, n:e.animals.length, spp,
    danger:share((a, s) => s && isDangerous(s)),
    kids:share((a, s) => s && !isDangerous(s) && s.diet.length === 1 && s.diet[0] === "herbivore"),
    active:share(a => PERS.activeActs.includes(a.act)),
    hunting:share(a => a.act === "hunt"),
    quality:e.animals.reduce((s, a) => s + (a.q ?? 90), 0) / n,
    rare:spp.some(s => s.price >= PERS.rarePrice),
    platform:state.buildings.some(b => b.type === "platform" && b.exhibitId === e.id),
  };
  sightCache.set(e.id, t);
  return t;
}
// Species and eras a party has seen so far (not saved)
const seenSpecies = p => p.sp || (p.sp = new Set());
const seenEras = p => p.eras || (p.eras = new Set());

// How keen a party is to go and see an exhibit: 1 is no preference
const PERS_TASTE = {
  thrill:(p, e, t, n) => (1 + n.tasteDanger * t.danger) * (1 + n.tasteActive * t.active) * (t.danger ? 1 : n.tasteTame),
  conserv:(p, e, t, n) => (.6 + n.tasteWelfare * e.happy / 100) * (t.rare ? 1 + n.tasteRare : 1),
  paleo:(p, e, t, n) => t.spp.some(s => !seenSpecies(p).has(s.id)) ? n.tasteNew : n.tasteOld,
  family:(p, e, t, n) => (1 + n.tasteKids * t.kids) * (t.danger > .5 ? n.tasteScary : 1),
};
function tasteOf(p, e){
  if(!p.pers || !e.animals.length) return 1;
  const t = exhibitTraits(e);
  let m = 1;
  persOf(p).forEach(([x, w], i) => { const f = PERS_TASTE[p.pers[i]]; if(f) m += (f(p, e, t, x.n) - 1) * w; });
  return Math.max(.2, m);
}
// And the Education Center: conservationists and paleo-nerds love it, thrill seekers want it flashy
function centerTaste(p, b){
  let m = 1;
  for(const [x, w] of persOf(p)){
    let f = x.n.center ?? 1;
    if(x.n.spectacle) f = b.focus === "spectacle" ? x.n.spectacle : f;
    m += (f - 1) * w;
  }
  return Math.max(.2, m);
}

// What a party makes of an exhibit it has just looked at
const PERS_SEE = {
  thrill(p, e, t, n, w){
    if(t.danger){
      moodAdd(p, n.danger * t.danger * w);
      if(t.active >= .3){ moodAdd(p, n.active * w); }
      if(t.platform) moodAdd(p, n.platform * w);
      if(w === 1 || t.danger >= .5) thinks(p, "rush");
    } else { moodAdd(p, -n.tame * w); if(w === 1) thinks(p, "tame"); }
    if(t.active < .15) moodAdd(p, -n.slow * w);
  },
  conserv(p, e, t, n, w){
    if(e.happy >= 70){ moodAdd(p, n.well * w); thinks(p, "welfare"); }
    else if(e.happy < 50){ moodAdd(p, -n.poor * w); thinks(p, "poorCare"); }
    if(t.rare){ moodAdd(p, n.rare * w); thinks(p, "rare"); }
    if(e.animals.filter(a => a.act === "pace").length / t.n >= .5) moodAdd(p, -n.stress * w);
  },
  paleo(p, e, t, n, w){
    const seen = seenSpecies(p), eras = seenEras(p);
    for(const s of t.spp){
      if(seen.has(s.id)){ moodAdd(p, -n.repeat * w); thinks(p, "repeats"); }
      else { moodAdd(p, n.species * w); }
      if(!eras.has(s.period)){ eras.add(s.period); moodAdd(p, n.era * w); }
      seen.add(s.id);
    }
    if(eras.size >= 4 || seen.size >= 8) thinks(p, "variety");
    if(t.quality >= 85){ moodAdd(p, n.accurate * w); thinks(p, "accurate"); }
    else if(t.quality < 65){ moodAdd(p, -n.guess * w); thinks(p, "lowGenome"); }
    if(!hasSign(e)){ moodAdd(p, -n.nosign * w); thinks(p, "noInfo"); }
  },
  family(p, e, t, n, w){
    if(t.kids >= .5){ moodAdd(p, n.kids * w); thinks(p, "cuddly"); }
    if(t.danger){ moodAdd(p, -n.scary * t.danger * w); thinks(p, "scary"); }
    if(t.hunting){ moodAdd(p, -n.gory * w); thinks(p, "gory"); }
  },
};
const moodAdd = (p, d) => { p.mood = clamp(p.mood + d, 0, 100); };
// Called from seeExhibit for each exhibit with animals
function personaSee(p, e){
  if(!p.pers) return;
  const t = exhibitTraits(e);
  persOf(p).forEach(([x, w], i) => { const f = PERS_SEE[p.pers[i]]; if(f) f(p, e, t, x.n, w); });
  // everyone, whatever they like, keeps track of what they've seen
  for(const s of t.spp){ seenSpecies(p).add(s.id); seenEras(p).add(s.period); }
  // fun lovers like a bit of everything: a new kind of sight each time
  if(hasPers(p, "fun")) moodAdd(p, PERSONALITIES.fun.n.variety * (p.pers[0] === "fun" ? 1 : PERS.second));
}
// On the way out: conservationists sniff out a park that is all show, and paleo-nerds judge the collection
function personaLeaves(p){
  if(!p.pers) return;
  persOf(p).forEach(([x, w], i) => {
    const k = p.pers[i];
    if(k === "conserv" && (p.edu || 0) < x.n.showyBelow){ moodAdd(p, -x.n.showy * w); thinks(p, "showy"); }
    if(k === "paleo"){
      const all = new Set(state.exhibits.flatMap(e => e.animals.map(a => a.sp))).size, share = all ? Math.min(1, seenSpecies(p).size / all) : 0;
      moodAdd(p, x.n.collection * share * w);
      if(share >= .7 && all >= 3) thinks(p, "collection");
    }
  });
}

/* ---------- hooligans ---------- */

// A hooligan at an exhibit's fence bangs on the glass and rattles the animals
function teaseTick(p, dt){
  if(!hasPers(p, "hooligan") || p.home || p.in || !p.at || p.at.rail) return;
  const x = p.at.x, y = p.at.y, H = PERS.hooligan;
  for(const e of state.exhibits){
    if(e.viv || !e.animals.length || distToEdge(x, y, e.points) > THROWN.reach * .7) continue;
    const chance = H.tease * (isHooligan(p) ? 1 : PERS.second) * deterrence(x, y);
    if(Math.random() < 1 - Math.pow(1 - Math.min(.5, chance), dt)){
      for(const a of e.animals) if(a.need) a.need.stress = Math.min(100, a.need.stress + H.stress);
      p.vandal = true;
      if(onCamera(x, y)){ p.wanted = true; dispatchGuard(p); }
      state.today.teased = (state.today.teased || 0) + 1;
      if(state.today.teased === 1) events.toast(`A guest is banging on the glass at ${e.name}. It stresses the animals. Guards nearby put them off and throw them out.`, "bad");
    }
    return;
  }
}
// Does this party sneak in without paying?
const sneaksIn = p => isHooligan(p) && Math.random() < PERS.hooligan.sneak;

/* ---------- calling security ---------- */

function ejectProblem(p){
  if(p.gone) return "They've already left.";
  if(p.ejecting === "escort" || (p.home && p.why === "home")) return "They're already on their way out.";
  if(p.ejecting) return "Security is already on the way.";
  if(!state.staff.guards.length) return "Hire a security guard first. Guards start at a Security Office.";
  if(!gcrew.some(c => c.at)) return "No guard is on duty right now.";
  return null;
}
// Call security. Ordinary guests stop and wait where they are; hooligans ignore the wait.
function ejectGuest(p){
  const why = ejectProblem(p); if(why) return why;
  p.ejecting = true; p.ejectAt = state.minute; p.ejectTry = -99; p.wanted = true;
  if(!isHooligan(p)){ leaveQueue(p); p.hold = true; p.dest = null; p.why = null; }
  dispatchGuard(p);
  return null;
}
// Each tick of a party that security has been called on
function ejectTick(p){
  if(p.ejecting !== true) return;
  if(state.minute - p.ejectAt > PERS.ejectWait){
    p.ejecting = false; p.hold = false; p.wanted = false;
    events.toast(`Security never reached the ${p.name}. They carry on.`, "bad");
    return;
  }
  if(state.minute - p.ejectTry >= 2 && !gcrew.some(c => c.chase === p)){ p.ejectTry = state.minute; dispatchGuard(p); }
}
// A guard has reached a waiting party: walk it to the gate, unhappy
function escortOut(p, c){
  p.hold = false; p.ejecting = "escort"; p.wanted = false;
  leaveQueue(p); p.home = true; p.dest = null; p.why = null; p.lastStop = p.shopped = true;
  moodAdd(p, -PERS.ejectMood); thinks(p, "ejected");
  if(c.chase === p){ c.chase = null; c.route = []; c.job = "idle"; c.wait = 0; }
  events.toast(`${(guardRec(c) || {}).name || "A guard"} walked the ${p.name} to the gate.`, "good");
}

/* ---------- what a party is doing, for its panel ---------- */
function partyStatus(p){
  if(p.gone) return "Left the park";
  if(p.ejecting === "escort") return "Being walked to the gate by security";
  if(p.hold) return "Waiting for security";
  if(p.ejecting) return "Security is after them";
  if(p.in){ const q = svcQ.get(p.in), b = buildingById(p.in), t = b && BUILDINGS[b.type], name = t ? t.label : "a stop"; return q && q.busy.includes(p) ? `Being served at the ${name.toLowerCase()}` : `Waiting in line at the ${name.toLowerCase()}`; }
  if(p.home) return p.dest === "gate" || p.why === "home" ? "Heading for the exit" : "Making a last stop on the way out";
  if(p.onTram) return "Riding the tram";
  const d = p.dest && (state.exhibits.find(x => x.id === p.dest) || buildingById(p.dest));
  const label = d ? (d.name || (BUILDINGS[d.type] || {}).label || "somewhere") : null;
  if(label) return p.why === "see" ? `Heading to see ${label}` : `Heading to ${label.toLowerCase()}`;
  return "Wandering the paths";
}
