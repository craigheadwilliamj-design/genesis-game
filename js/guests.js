/* =====================================================================
   GUESTS
   Guests come in parties of one to four. A party walks the footpaths to
   see the animals, gets hungry, thirsty, and needs the restroom, and heads
   for whatever fixes its worst need. Parties pay where they're served,
   and how happy they are when they leave sets the guest comfort score.
   Parties aren't saved: a reload starts the day's crowd over.
   ===================================================================== */

let parties = [];          // parties in the park right now
let gGraph = null;         // the guests' walking map: {nodes, anchors:{id -> node}, gate}
let gFieldsWalk = new Map();   // the same, for guests who can't ride the tram
let gFields = new Map();   // stop id -> quickest way there from every node, worked out when first needed
let svcQ = new Map();      // building id -> {queue:[party], busy:[party]}
let moodColors = false;    // color guests on the map by how happy they are
let nextSize = 1;          // how many are in the next party through the gate

const guestCount = () => parties.reduce((s, p) => s + p.n, 0);
const guestBuilding = b => !!(BUILDINGS[b.type].serves || BUILDINGS[b.type].kind);
const NO_THOUGHT = {hunger:"noFood", thirst:"noDrink", bladder:"noRestroom", energy:"noSeat"};
function freshGuestLog(){ return {thoughts:{}, guests:0, mood:null, edu:null, vandal:freshVandalLog(), last:{thoughts:{}, guests:0}}; }

/* ---------- the guests' map of footpaths ---------- */

// Footpaths joined to the entrance, with stops spliced in where an exhibit or guest building meets a path
function buildGuestGraph(){
  const live = state.paths.filter(p => derived.joined.has(p.id));
  const copies = live.map(p => ({pts:p.points, adds:[], mult:isWide(p) ? WIDE_PATH.crowdMult : 1}));
  const nearest = (x, y, maxD) => {
    let best = null;
    for(const c of copies) for(let i = 1; i < c.pts.length; i++){
      const r = segProj(x, y, c.pts[i-1], c.pts[i]);
      if(r.d <= maxD && (!best || r.d < best.r.d)) best = {c, i, r};
    }
    return best;
  };
  const stop = (id, best) => { if(best) best.c.adds.push({i:best.i, t:best.r.t, pt:[best.r.x, best.r.y], id}); };
  for(const b of state.buildings) if(guestBuilding(b) && isReachable(b)){
    const t = BUILDINGS[b.type], [cx, cy] = centroid(b.points);
    stop(b.id, nearest(cx, cy, Math.hypot(t.w, t.d) / 2 + REACH));
  }
  // guests look in from a spot beside the fence, as near the middle of the exhibit as the paths go
  for(const e of state.exhibits){
    if(!isReachable(e)) continue;
    const [cx, cy] = centroid(e.points);
    let best = null, bd = Infinity;
    for(let i = 0; i < e.points.length; i++){
      const a = e.points[i], b = e.points[(i+1) % e.points.length], L = dist(a, b) || 1;
      for(let s = 0; s <= L; s += 4){
        const r = nearest(a[0] + (b[0]-a[0]) * s / L, a[1] + (b[1]-a[1]) * s / L, REACH + 1); if(!r) continue;
        const d = Math.hypot(r.r.x - cx, r.r.y - cy); if(d < bd){ bd = d; best = r; }
      }
    }
    stop(e.id, best);
  }
  // tram stations: one stop on the footpath beside it, one on the track beside it
  const tc = state.paths.filter(isTram).map(p => ({pts:p.points, adds:[]})), stations = [];
  if(tc.length) for(const b of state.buildings){
    const t = BUILDINGS[b.type]; if(!t.tram || !isReachable(b) || condOf(b) < TRAM.offlineBelow) continue;
    const [cx, cy] = centroid(b.points), foot = nearest(cx, cy, Math.hypot(t.w, t.d) / 2 + REACH);
    let rail = null;
    for(const c of tc) for(let i = 1; i < c.pts.length; i++){
      const r = segProj(cx, cy, c.pts[i-1], c.pts[i]);
      if(r.d <= Math.max(t.w, t.d) / 2 + TRAM.reach && (!rail || r.d < rail.r.d)) rail = {c, i, r};
    }
    if(!foot || !rail) continue;
    stop(b.id + ":foot", foot);
    rail.c.adds.push({i:rail.i, t:rail.r.t, pt:[rail.r.x, rail.r.y], id:b.id + ":rail"});
    stations.push(b.id);
  }
  const nodes = new Map(), anchors = {};
  const node = p => { const k = nodeKey(p); if(!nodes.has(k)) nodes.set(k, {k, x:p[0], y:p[1], adj:new Map()}); return nodes.get(k); };
  const link = (a, b, mult = 1) => { if(a === b) return; const d = Math.hypot(a.x-b.x, a.y-b.y); a.adj.set(b, d); b.adj.set(a, d); if(mult > 1){ (a.room = a.room || new Map()).set(b, mult); (b.room = b.room || new Map()).set(a, mult); } };
  for(const c of copies){
    const seq = [];
    c.pts.forEach((v, i) => {
      if(i > 0) c.adds.filter(a => a.i === i).sort((a, b) => a.t - b.t).forEach(a => { const n = node(a.pt); anchors[a.id] = n; seq.push(n); });
      seq.push(node(v));
    });
    for(let i = 1; i < seq.length; i++) link(seq[i-1], seq[i], c.mult);
  }
  // a corner of one path sitting on the middle of another joins them
  const all = [...nodes.values()];
  for(const c of copies) for(let i = 1; i < c.pts.length; i++)
    for(const n of all){ const r = segProj(n.x, n.y, c.pts[i-1], c.pts[i]); if(r.d >= 1.5) continue; if(r.t > .01 && r.t < .99){ link(n, node(c.pts[i-1]), c.mult); link(n, node(c.pts[i]), c.mult); } else link(n, node(c.pts[r.t <= .01 ? i-1 : i]), c.mult); }
  // a plain stretch that runs inside a wide path's body (one drawn over another) has the wide path's room too
  const wides = copies.filter(c => c.mult > 1), onWide = (x, y) => wides.find(c => c.pts.some((v, i) => i > 0 && segProj(x, y, c.pts[i-1], v).d <= WIDE_PATH.halfWidth));
  if(wides.length) for(const n of nodes.values()) for(const m of n.adj.keys()){
    if(m.k < n.k || (n.room && n.room.get(m))) continue;
    const c = onWide(n.x, n.y); if(!c || onWide(m.x, m.y) !== c || !onWide((n.x + m.x) / 2, (n.y + m.y) / 2)) continue;
    (n.room = n.room || new Map()).set(m, c.mult); (m.room = m.room || new Map()).set(n, c.mult);
  }
  // the track: riders only get on and off at stations, so no joins in the middle. A ride costs its length over the tram's speed,
  // and each platform link costs a wait on top. Both are roomier than a plain path.
  if(stations.length){
    const rnode = p => { const k = "T" + nodeKey(p); if(!nodes.has(k)) nodes.set(k, {k, x:p[0], y:p[1], adj:new Map(), rail:true}); return nodes.get(k); };
    const both = (a, b, d, map) => { a.adj.set(b, d); b.adj.set(a, d); for(const [x, y] of [[a, b], [b, a]]){ if(map) (x[map] = x[map] || new Map()).set(y, true); (x.room = x.room || new Map()).set(y, TRAM.room); } };
    for(const c of tc){
      const seq = [];
      c.pts.forEach((v, i) => {
        if(i > 0) c.adds.filter(a => a.i === i).sort((a, b) => a.t - b.t).forEach(a => { const n = rnode(a.pt); anchors[a.id] = n; seq.push(n); });
        seq.push(rnode(v));
      });
      for(let i = 1; i < seq.length; i++) if(seq[i-1] !== seq[i]) both(seq[i-1], seq[i], Math.hypot(seq[i].x - seq[i-1].x, seq[i].y - seq[i-1].y) / TRAM.speedMult, "ride");
    }
    for(const id of stations){
      const f = anchors[id + ":foot"], r = anchors[id + ":rail"];
      if(f && r) both(f, r, Math.hypot(f.x - r.x, f.y - r.y) + TRAM.wait);
    }
  }
  let gate = null, gd = 3;
  for(const n of nodes.values()){ if(n.rail) continue; const d = Math.hypot(n.x - state.gate[0], n.y - state.gate[1]); if(d < gd){ gd = d; gate = n; } }
  if(gate) anchors.gate = gate;
  // which exhibits guests can see from each stretch of path
  const boxes = state.exhibits.filter(isReachable).map(e => { const bb = bbox(e.points); return {e, x0:bb.x0 - REACH, y0:bb.y0 - REACH, x1:bb.x1 + REACH, y1:bb.y1 + REACH}; });
  for(const n of nodes.values()) for(const m of n.adj.keys()){
    if(m.k < n.k) continue;
    const ids = boxes.filter(o => Math.max(n.x, m.x) >= o.x0 && Math.min(n.x, m.x) <= o.x1 && Math.max(n.y, m.y) >= o.y0 && Math.min(n.y, m.y) <= o.y1 &&
      lineShapeDist([[n.x, n.y], [m.x, m.y]], o.e.points) <= REACH).map(o => o.e.id);
    if(ids.length){ (n.sees = n.sees || new Map()).set(m, ids); (m.sees = m.sees || new Map()).set(n, ids); }
  }
  gGraph = {nodes, anchors, gate};
  gFields = new Map(); gFieldsWalk = new Map();
  indexLitterSpots(nodes);
  indexDecor(nodes);
  // everyone carries on from the same spot on the new map
  for(const p of parties){
    const x = p.at ? p.at.x : null, y = p.at ? p.at.y : null;
    p.at = p.at ? (nodes.get(p.at.k) || nearestGuestNode(x, y)) : null;
    p.to = null; p.t = 0; p.prev = null;
    if(p.dest && !anchors[p.dest]){ p.dest = null; p.why = null; }
  }
}
function nearestGuestNode(x, y){
  let best = null, bd = Infinity;
  for(const n of gGraph.nodes.values()){ const d = Math.hypot(n.x - x, n.y - y); if(d < bd){ bd = d; best = n; } }
  return best;
}
// How far along a stretch of tram track each working station sits ({cum} is the distance at each corner)
function tramStops(p){
  const cum = [0], stops = [];
  for(let i = 1; i < p.points.length; i++) cum.push(cum[i-1] + dist(p.points[i-1], p.points[i]));
  if(!gGraph) return {cum, stops};
  for(const b of state.buildings){
    const a = BUILDINGS[b.type].tram && gGraph.anchors[b.id + ":rail"]; if(!a) continue;
    for(let i = 1; i < p.points.length; i++){ const r = segProj(a.x, a.y, p.points[i-1], p.points[i]); if(r.d < .5){ stops.push(cum[i-1] + r.t * (cum[i] - cum[i-1])); break; } }
  }
  return {cum, stops};
}
// The quickest way to a stop from everywhere: distance, and which node is the next step
function guestField(id, walkOnly){
  const cache = walkOnly ? gFieldsWalk : gFields;
  if(cache.has(id)) return cache.get(id);
  const a = gGraph && gGraph.anchors[id];
  const f = a ? (w => ({dist:w.dist, prev:w.layers.prev[2]}))(walkFrom(a, null, new Set(), walkOnly ? (n, m) => n.rail || m.rail : null)) : null;
  cache.set(id, f);
  return f;
}
// Can this party use the tram right now? It needs the fare, and to think the fare is fair. A rider already aboard keeps riding.
const canRide = p => !!p.at && (!!p.at.rail || !!p.onTram || (p.cash >= tramFare() * p.n && p.tramRoll < tramWill()));
// The quickest-way map this party plans with: the tram, if they can use it
const fieldFor = (p, id) => guestField(id, !canRide(p));
const nextHop = (f, n) => { const s = f.prev.get(n); return s ? s[0] : null; };

/* ---------- arriving and leaving ---------- */

function newParty(n){
  const needs = {};
  for(const [k, d] of Object.entries(NEEDS)) needs[k] = Math.random() * d.start;
  const pers = rollPers();
  const p = {id:uid("g"), n, name:SURNAMES[Math.floor(Math.random() * SURNAMES.length)] + " party", pers, cash:n * rand(...GUEST.cash), mood:GUEST.startMood + 4 * state.rating, needs, seen:new Set(), thought:new Set(), cool:{},
             until:state.minute + rand(...GUEST.stay) / GUEST.pace, at:gGraph ? gGraph.gate : null, to:null, t:0, prev:null, dest:null, why:null, home:false,
             spd:rand(...GUEST.speed) * GUEST.pace, off:(Math.random()*2-1) * 1.4, tramRoll:Math.random(), in:null, rowdy:pers.includes("hooligan")};
  p.sneaked = sneaksIn(p);   // hooligans may slip in without a ticket
  if(!p.sneaked && state.ticket > fairTicket() * 1.3 * pm(p, "ticket")){ thinks(p, "pricey"); p.mood -= 8; }
  return p;
}
function guestsArrive(n){
  state.today.guests += n;
  if(parties.length < GUEST.maxParties){ const p = newParty(n); if(!p.sneaked) earn(state.ticket * n, "tickets"); parties.push(p); return; }
  earn(state.ticket * n, "tickets");
  // the map is full: these guests tag along with a party that just got here
  const p = parties[parties.length - 1 - Math.floor(Math.random() * Math.min(50, parties.length))];
  p.n += n; p.cash += n * rand(...GUEST.cash);
}
function thinks(p, k){ p.thought.add(k); }
// A party learns something. Learning is per guest, 0 to 100, and cheers them up as it comes.
function learn(p, n){ const g = clamp(n * pm(p, "learn"), 0, 100 - (p.edu || 0)); p.edu = (p.edu || 0) + g; p.mood += g * EDU.joy; }
// A party walks out of the gate. How it feels now counts toward the day's guest comfort.
function partyLeaves(p){
  if(p.gone) return;
  p.gone = true;
  leaveQueue(p);
  // going home still hungry, thirsty, or needing the restroom spoils the day
  for(const [k, d] of Object.entries(NEEDS)){ const o = p.needs[k] - d.seek; if(o > 0) p.mood -= GUEST.leftWanting * o / (100 - d.seek); }
  const t = state.today, L = state.guestLog, edu = p.edu || 0;
  personaLeaves(p);
  t.moodSum += clamp(p.mood, 0, 100) * p.n; t.moodN += p.n;
  t.eduSum += edu * p.n; t.eduN += p.n;
  if(edu >= EDU.learned) thinks(p, "learned");
  // guests who learned something drop a little in the donation box
  if(edu > 0) earn(p.n * EDU.donate * edu / 100 * pm(p, "donate"), "donations");
  // and educated guests fund science
  if(edu > 0 && dept("oracle")) state.science.points += p.n * RESEARCH_GUEST * edu / 100;
  L.guests += p.n;
  for(const k of p.thought) L.thoughts[k] = (L.thoughts[k] || 0) + p.n;
}
function goHome(p){
  if(p.home) return;
  leaveQueue(p);
  p.home = true; p.dest = null; p.why = null;
}
function leaveQueue(p){
  if(!p.in) return;
  const q = svcQ.get(p.in);
  if(q){ q.queue = q.queue.filter(x => x !== p); q.busy = q.busy.filter(x => x !== p); }
  p.in = null;
}

/* ---------- deciding where to go ---------- */

// The need that's worst right now, if any is bad enough to act on
function urgentNeed(p){
  let worst = null, over = 0;
  for(const [k, d] of Object.entries(NEEDS)){
    const o = p.needs[k] - d.seek;
    if(o >= 0 && (p.cool[k] || 0) <= state.minute && o >= over){ worst = k; over = o; }
  }
  return worst;
}
// The best place to fix a need: close, and without a long queue. A filthy restroom only gets the desperate.
function bestStop(p, need){
  let best = null;
  for(const b of state.buildings){
    if(!gGraph.anchors[b.id] || !servesOf(b).includes(need)) continue;
    if(b.type === "restroom" && (b.dirt || 0) >= RESTROOM.avoid && p.needs.bladder < GUEST.desperate) continue;
    const f = fieldFor(p, b.id), d = f && f.dist.get(p.at);
    if(d === undefined) continue;
    const q = svcQ.get(b.id), score = d + (q ? q.queue.length : 0) * GUEST.queueMeters;
    if(!best || score < best.score) best = {b, d, score};
  }
  return best;
}
// How good an exhibit looks to guests right now (the same sum that brings them in)
function exhibitAppeal(e){
  if(!e.animals.length) return 0;
  let a = 0;
  for(const [sp, c] of speciesCounts(e)) a += speciesDraw(SPECIES_BY_ID[sp]) * Math.sqrt(c) * (0.4 + 0.6 * e.happy / 100);
  return a * viewFactor(e, derived.reach);
}
// Pick an exhibit not seen yet, or the Education Center if it hasn't been: popular ones, and close ones, are likelier
function pickSight(p){
  let tot = 0;
  const opts = [];
  const add = (x, appeal, taste) => {
    const f = fieldFor(p, x.id), d = f && f.dist.get(p.at);
    if(d === undefined) return;
    const w = (appeal + 1) / (1 + d / 60) * taste;
    opts.push([x, w]); tot += w;
  };
  for(const e of state.exhibits) if(!p.seen.has(e.id) && e.animals.length && gGraph.anchors[e.id]) add(e, exhibitAppeal(e), tasteOf(p, e));
  // the Education Center, once, if there's time left for the walk and the visit (and they didn't just give up on its line)
  if(!p.learnt && (p.cool.see || 0) <= state.minute)
    for(const b of state.buildings){
      if(b.type !== "edcenter" || !gGraph.anchors[b.id]) continue;
      const home = (fieldFor(p, "gate").dist.get(gGraph.anchors[b.id]) ?? Infinity) / (WALK_PER_MIN * p.spd);
      if(state.minute + walkMins(p, b.id) + BUILDINGS.edcenter.serveMin + home + 15 < p.until) add(b, EDU.centerAppeal + eduAppeal(b), centerTaste(p, b));
    }
  let r = Math.random() * tot;
  for(const [e, w] of opts){ r -= w; if(r <= 0) return e; }
  return null;
}
// Work out where to head next. Called each time a party reaches a corner.
function planParty(p){
  if(p.home){
    if(p.why !== "home" && p.dest) return;
    // one last stop for food or the restroom, if there's one close by
    const need = !p.lastStop && urgentNeed(p), s = need && bestStop(p, need);
    if(s && s.d < GUEST.lastStop){ p.lastStop = true; p.dest = s.b.id; p.why = need; return; }
    if(!p.shopped){
      p.shopped = true;
      const s = p.mood >= 50 && p.cash >= 5 && Math.random() < GUEST.shopChance && bestStop(p, "shop");
      if(s && s.d < GUEST.farWalk){ p.dest = s.b.id; p.why = "shop"; return; }
    }
    p.dest = "gate"; p.why = "home";
    return;
  }
  // once on the way to fix one need, only a desperate one changes the plan (a food stand fixes hunger and thirst both)
  const need = urgentNeed(p), onTrip = p.why in NEEDS;
  if(need && p.why !== need && (!onTrip || (p.needs[need] >= GUEST.desperate && p.needs[p.why] < GUEST.desperate))){
    const s = bestStop(p, need);
    if(!s){ thinks(p, NO_THOUGHT[need]); if(need === "energy" && state.buildings.some(b => BUILDINGS[b.type].seats && isBroken(b))) thinks(p, "broken"); p.cool[need] = state.minute + 60; }
    else if(s.b.id !== p.dest){ p.dest = s.b.id; p.why = need; if(s.d > GUEST.farWalk && !p.map) thinks(p, "far"); return; }
  }
  if(p.dest) return;
  const e = pickSight(p);
  if(e){ p.dest = e.id; p.why = "see"; return; }
  // nothing new to see: a party that saw nothing at all is bored, and everyone starts thinking about home
  if(!p.done){
    p.done = true;
    if(![...p.seen].some(id => { const x = state.exhibits.find(e => e.id === id); return x && x.animals.length; })){ thinks(p, "bored"); p.mood -= 15; }
    p.until = Math.min(p.until, state.minute + 45);
  }
}
// Pick the next node to walk to. False means the party isn't walking anywhere for now.
function headOut(p){
  planParty(p);
  // too broke to ride, and the tram would have saved them a good walk
  if(p.dest && !p.noTram && p.cash < tramFare() * p.n && !canRide(p)){
    const by = guestField(p.dest), on = guestField(p.dest, true), a = by && by.dist.get(p.at), w = on && on.dist.get(p.at);
    if(a !== undefined && w !== undefined && a < w * .7){ p.noTram = true; thinks(p, "noTram"); }
  }
  if(p.dest){
    const goal = gGraph.anchors[p.dest];
    if(goal === p.at){ reachDest(p); return false; }
    const f = goal && fieldFor(p, p.dest), step = f && nextHop(f, p.at);
    if(step){ p.to = step; return true; }
    p.dest = null; p.why = null;
    if(p.home){ partyLeaves(p); return false; }
  }
  // wander: any way but back the way we came
  const opts = [...p.at.adj.keys()].filter(n => n !== p.prev && !(p.at.ride && p.at.ride.has(n)));
  p.to = opts.length ? opts[Math.floor(Math.random() * opts.length)] : p.prev;
  return !!p.to;
}
// Got where we were going
function reachDest(p){
  const id = p.dest;
  if(id === "gate"){ partyLeaves(p); return; }
  const e = state.exhibits.find(x => x.id === id);
  if(e){ seeExhibit(p, e); p.dest = null; p.why = null; return; }
  const b = buildingById(id);
  if(!b || !guestBuilding(b)){ p.dest = null; p.why = null; return; }
  if(!svcQ.has(id)) svcQ.set(id, {queue:[], busy:[]});
  svcQ.get(id).queue.push(p); p.in = id; p.waited = 0;
}
function seeExhibit(p, e){
  if(p.dest === e.id && p.why === "see"){ p.dest = null; p.why = null; }
  if(p.seen.has(e.id)) return;
  p.seen.add(e.id);
  if(!e.animals.length) return;
  const a = exhibitAppeal(e);
  p.mood += GUEST.seeGain * a / (a + 15);
  if(e.happy < 35){ thinks(p, "sadAnimals"); p.mood -= 4; }
  personaSee(p, e);
  if(a >= 30) thinks(p, "wow");
  // what the animals were doing when they looked
  const n = e.animals.length, pace = e.animals.filter(x => x.act === "pace").length, play = e.animals.filter(x => x.act === "play").length;
  if(pace / n >= .5){ thinks(p, "pacing"); p.mood -= 2; }
  else if(play / n >= .3){ thinks(p, "playful"); p.mood += 2; }
  // what they learn: a little from looking, a lot more with an info sign to read, and more again with a field guide
  const sign = hasSign(e);
  learn(p, (EDU.see + (sign ? EDU.sign * (1 + speciesCounts(e).size * .25) : 0)) * (p.guide ? EDU.guideBoost : 1));
  if(!sign && (p.noSign = (p.noSign || 0) + 1) >= EDU.noInfo) thinks(p, "noInfo");
}
// Is there a working info sign by this exhibit's fence?
const hasSign = e => state.buildings.some(b => b.type === "sign" && !isBroken(b) && distToEdge(...centroid(b.points), e.points) <= EDU.signReach);
// Minutes this party needs to walk to a stop from where it is
function walkMins(p, id){
  const f = p.at && fieldFor(p, id), d = f && f.dist.get(p.at);
  return d === undefined || !f ? 0 : d / (WALK_PER_MIN * p.spd);
}
// Stepping onto the tram: each guest pays the fare once per ride, and it's remembered as a good thing
function board(p){
  const ride = !!(p.at.ride && p.at.ride.has(p.to));
  if(!ride){ p.onTram = false; return; }
  if(p.onTram) return;
  p.onTram = true;
  const fare = tramFare() * p.n;
  p.cash -= fare; earn(fare, "fares"); thinks(p, "tram");
}
function walkParty(p, left){
  for(let i = 0; i < 40 && left > 0 && !p.gone && !p.in; i++){
    if(!p.to){ if(!headOut(p)) return; board(p); }
    const L = p.at.adj.get(p.to) || .01, rem = L * (1 - p.t);   // how far the edge feels: a ride is shorter than it looks, a platform wait longer
    if(left < rem){ p.t += left / L; return; }
    left -= rem;
    const ids = p.at.sees && p.at.sees.get(p.to);
    if(ids) for(const id of ids){ const e = state.exhibits.find(x => x.id === id); if(e) seeExhibit(p, e); }
    p.prev = p.at; p.at = p.to; p.to = null; p.t = 0;
    if(!p.at.rail) trashCheck(p);
  }
}

/* ---------- being served ---------- */

function serviceTick(dt, now){
  for(const [id, q] of svcQ){
    const b = buildingById(id);
    if(!b || !gGraph.anchors[id]){ for(const p of q.queue.concat(q.busy)){ p.in = null; p.dest = null; p.why = null; } svcQ.delete(id); continue; }
    const t = BUILDINGS[b.type];
    // finish whoever's done, and start the next in line in the free spot
    q.busy.sort((a, c) => a.readyAt - c.readyAt);
    while(q.busy.length && q.busy[0].readyAt <= now){
      const p = q.busy.shift(), at = p.readyAt;
      serveParty(p, b);
      if(q.queue.length){ const n = q.queue.shift(); n.readyAt = at + t.serveMin; q.busy.push(n); q.busy.sort((a, c) => a.readyAt - c.readyAt); }
    }
    while(q.busy.length < slotsOf(b) && q.queue.length){ const n = q.queue.shift(); n.readyAt = now + t.serveMin; q.busy.push(n); }
    for(const p of [...q.queue]){
      p.waited += dt;
      if(p.waited > (t.patience ?? GUEST.patience) * pm(p, "patience")){ leaveQueue(p); thinks(p, "queue"); p.mood -= 8; p.cool[p.why] = now + 45; p.dest = null; p.why = null; }
    }
  }
}
function serveParty(p, b){
  const why = p.why;
  p.in = null; p.dest = null; p.why = null;
  serveAt(p, b, why);
  trashCheck(p);
}

/* ---------- through the day ---------- */

// Arrivals follow a hump: few at opening, busiest late morning, none after 4 PM.
const ARRIVE_START = OPEN_MIN, ARRIVE_END = 16 * 60;
function arrivalShare(m0, m1){
  const f = m => { const t = clamp((m - ARRIVE_START) / (ARRIVE_END - ARRIVE_START), 0, 1); return (1 - Math.cos(Math.PI * t)) / 2; };
  return f(m1) - f(m0);
}

function guestsTick(m0, m1){
  const dt = m1 - m0, gdt = dt * GUEST.pace;   // guests live in slow motion: gdt is their own time
  if(state.guestLog.notice){ state.guestLog.notice = false; events.toast("Guests now get tired and drop litter. Put trash bins and benches along your paths (Path Tools). Tap a food stand or gift shop to change what it sells and its prices.", "bad"); }
  hotelGuestsArrive();
  arrivalCarry += derived.demand * arrivalShare(m0, m1);
  while(arrivalCarry >= nextSize){ arrivalCarry -= nextSize; guestsArrive(nextSize); nextSize = GUEST.sizes[Math.floor(Math.random() * GUEST.sizes.length)]; }
  // guests near a dangerous animal on the loose run for the gate
  const danger = state.safety.loose.filter(l => l.status === "loose" && isDangerous(SPECIES_BY_ID[l.sp])).map(loosePos).filter(Boolean);
  // how packed the path is around each walker: parties within 5 m either way, so short stretches at joins don't read as packed
  const busy = new Map(), cell = (x, y) => Math.floor(x / 10) + ":" + Math.floor(y / 10), pos = new Map();
  for(const p of parties) if(p.at && p.to){
    const x = p.at.x + (p.to.x - p.at.x) * p.t, y = p.at.y + (p.to.y - p.at.y) * p.t, k = cell(x, y);
    pos.set(p, [x, y]); if(!busy.has(k)) busy.set(k, []); busy.get(k).push([x, y]);
  }
  const near = ([x, y]) => { let n = 0; for(let i = -1; i <= 1; i++) for(let j = -1; j <= 1; j++) for(const [a, b] of busy.get(cell(x + i*10, y + j*10)) || []) if((a-x)*(a-x) + (b-y)*(b-y) <= 25) n++; return n; };

  for(const p of parties){
    const riding = !!(p.at && p.to && p.at.ride && p.at.ride.has(p.to));
    for(const k of Object.keys(NEEDS)) p.needs[k] = Math.min(100, p.needs[k] + (riding && k === "energy" ? 0 : NEEDS[k].rate * pneed(p, k) * gdt));
    const inf = pm(p, "infra");   // family parties take bad infrastructure harder
    let hurt = riding ? 0 : GUEST.tire * pm(p, "walk");   // sitting on the tram, feet up
    for(const [k, d] of Object.entries(NEEDS)){ const o = p.needs[k] - d.seek; if(o > 0) hurt += GUEST.needHurt * inf * o / (100 - d.seek); }
    if(p.at && p.to){
      if(near(pos.get(p)) > GUEST.crowd * ((p.at.room && p.at.room.get(p.to)) || 1)){ hurt += GUEST.crowdHurt * inf; thinks(p, "crowded"); }
    }
    // walking through litter
    const mess = p.at && !p.at.rail ? litterAt(p.at.x, p.at.y) : 0;
    if(mess >= 3){ hurt += LITTER.hurt * inf * Math.min(1, mess / LITTER.heavy); if(mess >= 6) thinks(p, "litter"); }
    // gardens, water and statues along the way cheer them up, and they stop to read each statue's plaque
    if(p.at && p.at.decor){ hurt -= DECOR.joy * pm(p, "decor") * p.at.decor; if(p.at.decor >= DECOR.pretty) thinks(p, "pretty"); }
    if(p.at && p.at.statues) for(const id of p.at.statues) statueSeen(p, id);
    p.mood = clamp(p.mood - hurt * gdt, 0, 100);
    if(p.needs.bladder >= 100){ thinks(p, "accident"); p.mood = Math.max(0, p.mood - 30); p.needs.bladder = 0; goHome(p); }
    if(!p.fled && p.at && danger.some(([x, y]) => Math.hypot(p.at.x - x, p.at.y - y) < GUEST.fleeRange * pm(p, "flee"))){ p.fled = true; thinks(p, "scared"); p.mood -= 15 * pm(p, "fleeHurt"); goHome(p); }
    // set off for the gate in time to be out by the time they planned to leave
    if(!p.home && !p.hold && (m1 + walkMins(p, "gate") >= p.until || p.mood < GUEST.quitBelow)) goHome(p);
    if(p.ejecting) ejectTick(p);
    if(p.hold) continue;   // standing where they are until security comes
    vandalTick(p, gdt);
    throwTick(p, gdt);
    teaseTick(p, gdt);
    if(!p.at){ if(p.home) partyLeaves(p); continue; }
    walkParty(p, WALK_PER_MIN * p.spd * dt);
  }
  serviceTick(dt, m1);
  parties = parties.filter(p => !p.gone);
}

// Closing time: everyone still here goes home
function flushParties(){
  for(const p of parties) partyLeaves(p);
  parties = []; svcQ.clear(); arrivalCarry = 0;
}
// Remember how today's guests felt, for tomorrow's crowd and the rating
function guestsNight(){
  const t = state.today, L = state.guestLog;
  if(t.moodN) L.mood = t.moodSum / t.moodN;
  if(t.eduN) L.edu = t.eduSum / t.eduN;
  L.last = {thoughts:L.thoughts, guests:L.guests, vandal:L.vandal};
  L.thoughts = {}; L.guests = 0; L.vandal = freshVandalLog();
}
function resetParties(){ parties = []; svcQ = new Map(); arrivalCarry = 0; }

// What guests are thinking: today's leavers plus everyone still here. Falls back to yesterday before anyone has left.
function topThoughts(n){
  const L = state.guestLog, c = {...L.thoughts};
  let tot = L.guests;
  for(const p of parties){ tot += p.n; for(const k of p.thought) c[k] = (c[k] || 0) + p.n; }
  const use = tot ? {c, tot} : {c:L.last.thoughts, tot:L.last.guests};
  return Object.entries(use.c).filter(([k]) => THOUGHTS[k]).map(([k, v]) => ({k, share:v / Math.max(1, use.tot), ...THOUGHTS[k]})).filter(x => x.share >= .005)
    .sort((a, b) => b.share - a.share).slice(0, n);
}
// Average mood of everyone in the park right now
function moodNow(){ let s = 0, n = 0; for(const p of parties){ s += p.mood * p.n; n += p.n; } return n ? s / n : null; }
// Parties waiting at a guest building, and how many it's serving
function queueAt(b){ const q = svcQ.get(b.id); return q ? {waiting:q.queue.length, busy:q.busy.length} : {waiting:0, busy:0}; }
