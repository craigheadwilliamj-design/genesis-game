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
let gFields = new Map();   // stop id -> quickest way there from every node, worked out when first needed
let svcQ = new Map();      // building id -> {queue:[party], busy:[party]}
let moodColors = false;    // color guests on the map by how happy they are
let nextSize = 1;          // how many are in the next party through the gate

const guestCount = () => parties.reduce((s, p) => s + p.n, 0);
const guestBuilding = b => !!BUILDINGS[b.type].serves;
const NO_THOUGHT = {hunger:"noFood", thirst:"noDrink", bladder:"noRestroom"};
function freshGuestLog(){ return {thoughts:{}, guests:0, mood:null, last:{thoughts:{}, guests:0}}; }

/* ---------- the guests' map of footpaths ---------- */

// Footpaths joined to the entrance, with stops spliced in where an exhibit or guest building meets a path
function buildGuestGraph(){
  const live = state.paths.filter(p => derived.joined.has(p.id));
  const copies = live.map(p => ({pts:p.points, adds:[]}));
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
  const nodes = new Map(), anchors = {};
  const node = p => { const k = nodeKey(p); if(!nodes.has(k)) nodes.set(k, {k, x:p[0], y:p[1], adj:new Map()}); return nodes.get(k); };
  const link = (a, b) => { if(a === b) return; const d = Math.hypot(a.x-b.x, a.y-b.y); a.adj.set(b, d); b.adj.set(a, d); };
  for(const c of copies){
    const seq = [];
    c.pts.forEach((v, i) => {
      if(i > 0) c.adds.filter(a => a.i === i).sort((a, b) => a.t - b.t).forEach(a => { const n = node(a.pt); anchors[a.id] = n; seq.push(n); });
      seq.push(node(v));
    });
    for(let i = 1; i < seq.length; i++) link(seq[i-1], seq[i]);
  }
  // a corner of one path sitting on the middle of another joins them
  const all = [...nodes.values()];
  for(const c of copies) for(let i = 1; i < c.pts.length; i++)
    for(const n of all){ const r = segProj(n.x, n.y, c.pts[i-1], c.pts[i]); if(r.d < 1.5 && r.t > .01 && r.t < .99){ link(n, node(c.pts[i-1])); link(n, node(c.pts[i])); } }
  let gate = null, gd = 3;
  for(const n of nodes.values()){ const d = Math.hypot(n.x - state.gate[0], n.y - state.gate[1]); if(d < gd){ gd = d; gate = n; } }
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
  gFields = new Map();
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
// The quickest way to a stop from everywhere: distance, and which node is the next step
function guestField(id){
  if(gFields.has(id)) return gFields.get(id);
  const a = gGraph && gGraph.anchors[id];
  const f = a ? (w => ({dist:w.dist, prev:w.layers.prev[2]}))(walkFrom(a, null, new Set())) : null;
  gFields.set(id, f);
  return f;
}
const nextHop = (f, n) => { const s = f.prev.get(n); return s ? s[0] : null; };

/* ---------- arriving and leaving ---------- */

function newParty(n){
  const needs = {};
  for(const [k, d] of Object.entries(NEEDS)) needs[k] = Math.random() * d.start;
  const p = {id:uid("g"), n, cash:n * rand(...GUEST.cash), mood:GUEST.startMood + 4 * state.rating, needs, seen:new Set(), thought:new Set(), cool:{},
             until:state.minute + rand(...GUEST.stay), at:gGraph ? gGraph.gate : null, to:null, t:0, prev:null, dest:null, why:null, home:false,
             spd:rand(...GUEST.speed), off:(Math.random()*2-1) * 1.4, shirt:Math.floor(Math.random() * 4), in:null};
  if(state.ticket > fairTicket() * 1.3){ thinks(p, "pricey"); p.mood -= 8; }
  return p;
}
function guestsArrive(n){
  state.today.guests += n;
  earn(state.ticket * n, "tickets");
  if(parties.length < GUEST.maxParties){ parties.push(newParty(n)); return; }
  // the map is full: these guests tag along with a party that just got here
  const p = parties[parties.length - 1 - Math.floor(Math.random() * Math.min(50, parties.length))];
  p.n += n; p.cash += n * rand(...GUEST.cash);
}
function thinks(p, k){ p.thought.add(k); }
// A party walks out of the gate. How it feels now counts toward the day's guest comfort.
function partyLeaves(p){
  if(p.gone) return;
  p.gone = true;
  leaveQueue(p);
  // going home still hungry, thirsty, or needing the restroom spoils the day
  for(const [k, d] of Object.entries(NEEDS)){ const o = p.needs[k] - d.seek; if(o > 0) p.mood -= GUEST.leftWanting * o / (100 - d.seek); }
  const t = state.today, L = state.guestLog;
  t.moodSum += clamp(p.mood, 0, 100) * p.n; t.moodN += p.n;
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
// The best place to fix a need: close, and without a long queue
function bestStop(p, need){
  let best = null;
  for(const b of state.buildings){
    const t = BUILDINGS[b.type];
    if(!t.serves || !t.serves.includes(need) || !gGraph.anchors[b.id]) continue;
    const f = guestField(b.id), d = f && f.dist.get(p.at);
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
  for(const [sp, c] of speciesCounts(e)) a += SPECIES_BY_ID[sp].appeal * Math.sqrt(c) * (0.4 + 0.6 * e.happy / 100);
  return a * viewFactor(e, derived.reach);
}
// Pick an exhibit not seen yet: popular ones, and close ones, are likelier
function pickSight(p){
  let tot = 0;
  const opts = [];
  for(const e of state.exhibits){
    if(p.seen.has(e.id) || !e.animals.length || !gGraph.anchors[e.id]) continue;
    const f = guestField(e.id), d = f && f.dist.get(p.at);
    if(d === undefined) continue;
    const w = (exhibitAppeal(e) + 1) / (1 + d / 60);
    opts.push([e, w]); tot += w;
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
      const s = p.mood >= 50 && p.cash >= BUILDINGS.shop.perGuest && Math.random() < GUEST.shopChance && bestStop(p, "shop");
      if(s && s.d < GUEST.farWalk){ p.dest = s.b.id; p.why = "shop"; return; }
    }
    p.dest = "gate"; p.why = "home";
    return;
  }
  // once on the way to fix one need, only a desperate one changes the plan (a food stand fixes hunger and thirst both)
  const need = urgentNeed(p), onTrip = p.why in NEEDS;
  if(need && p.why !== need && (!onTrip || (p.needs[need] >= GUEST.desperate && p.needs[p.why] < GUEST.desperate))){
    const s = bestStop(p, need);
    if(!s){ thinks(p, NO_THOUGHT[need]); p.cool[need] = state.minute + 60; }
    else if(s.b.id !== p.dest){ p.dest = s.b.id; p.why = need; if(s.d > GUEST.farWalk) thinks(p, "far"); return; }
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
  if(p.dest){
    const goal = gGraph.anchors[p.dest];
    if(goal === p.at){ reachDest(p); return false; }
    const f = goal && guestField(p.dest), step = f && nextHop(f, p.at);
    if(step){ p.to = step; return true; }
    p.dest = null; p.why = null;
    if(p.home){ partyLeaves(p); return false; }
  }
  // wander: any way but back the way we came
  const opts = [...p.at.adj.keys()].filter(n => n !== p.prev);
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
  if(a >= 30) thinks(p, "wow");
}
// Minutes this party needs to walk to a stop from where it is
function walkMins(p, id){
  const f = p.at && guestField(id), d = f && f.dist.get(p.at);
  return d === undefined || !f ? 0 : d / (WALK_PER_MIN * p.spd);
}
function walkParty(p, left){
  for(let i = 0; i < 40 && left > 0 && !p.gone && !p.in; i++){
    if(!p.to && !headOut(p)) return;
    const L = Math.hypot(p.to.x - p.at.x, p.to.y - p.at.y) || .01, rem = L * (1 - p.t);
    if(left < rem){ p.t += left / L; return; }
    left -= rem;
    const ids = p.at.sees && p.at.sees.get(p.to);
    if(ids) for(const id of ids){ const e = state.exhibits.find(x => x.id === id); if(e) seeExhibit(p, e); }
    p.prev = p.at; p.at = p.to; p.to = null; p.t = 0;
  }
}

/* ---------- being served ---------- */

function serviceTick(dt, now){
  for(const [id, q] of svcQ){
    const b = buildingById(id);
    if(!b || !gGraph.anchors[id]){ for(const p of q.queue.concat(q.busy)){ p.in = null; p.dest = null; p.why = null; } svcQ.delete(id); continue; }
    const t = BUILDINGS[b.type];
    // finish whoever's done, and start the next in line in the free spot
    q.busy.sort((a, c) => a.done - c.done);
    while(q.busy.length && q.busy[0].done <= now){
      const p = q.busy.shift(), at = p.done;
      serveParty(p, b);
      if(q.queue.length){ const n = q.queue.shift(); n.done = at + t.serveMin; q.busy.push(n); q.busy.sort((a, c) => a.done - c.done); }
    }
    while(q.busy.length < t.slots && q.queue.length){ const n = q.queue.shift(); n.done = now + t.serveMin; q.busy.push(n); }
    for(const p of [...q.queue]){
      p.waited += dt;
      if(p.waited > GUEST.patience){ leaveQueue(p); thinks(p, "queue"); p.mood -= 8; p.cool[p.why] = now + 45; p.dest = null; p.why = null; }
    }
  }
}
function serveParty(p, b){
  const t = BUILDINGS[b.type], n = p.n, why = p.why;
  p.in = null; p.dest = null; p.why = null;
  let bill = 0, served = n;
  if(b.type === "food"){
    const meal = p.needs.hunger >= 25, drink = p.needs.thirst >= 25 || !meal;
    if(meal && p.cash >= t.perGuest * n){ bill += t.perGuest * n; p.needs.hunger = 0; }
    if(drink && p.cash - bill >= t.drink * n){ bill += t.drink * n; p.needs.thirst = 0; }
    if(bill){ earn(bill, "food"); state.today.servedFood += n; if(meal && !p.needs.hunger) thinks(p, "fed"); }
  } else if(b.type === "shop"){
    let buyers = 0;
    const chance = clamp((p.mood - 30) / 60, .15, .9);
    for(let i = 0; i < n; i++) if(Math.random() < chance && p.cash - bill >= t.perGuest){ bill += t.perGuest; buyers++; }
    if(bill){ earn(bill, "shop"); state.today.servedShop += buyers; }
    served = buyers;
  } else {
    for(const k of t.serves) if(p.needs[k] !== undefined) p.needs[k] = 0;
  }
  if(t.perGuest && !bill && why !== "shop"){ thinks(p, "broke"); p.mood -= 6; p.cool.hunger = p.cool.thirst = state.minute + 120; }
  p.cash -= bill;
  if(!b.served || b.served.day !== state.day) b.served = {day:state.day, n:0, money:0};
  b.served.n += served; b.served.money += bill;
}

/* ---------- through the day ---------- */

// Arrivals follow a hump: few at opening, busiest late morning, none after 4 PM.
const ARRIVE_START = OPEN_MIN, ARRIVE_END = 16 * 60;
function arrivalShare(m0, m1){
  const f = m => { const t = clamp((m - ARRIVE_START) / (ARRIVE_END - ARRIVE_START), 0, 1); return (1 - Math.cos(Math.PI * t)) / 2; };
  return f(m1) - f(m0);
}

function guestsTick(m0, m1){
  const dt = m1 - m0;
  arrivalCarry += derived.demand * arrivalShare(m0, m1);
  while(arrivalCarry >= nextSize){ arrivalCarry -= nextSize; guestsArrive(nextSize); nextSize = GUEST.sizes[Math.floor(Math.random() * GUEST.sizes.length)]; }
  // guests near a dangerous animal on the loose run for the gate
  const danger = state.safety.loose.filter(l => l.status === "loose" && isDangerous(SPECIES_BY_ID[l.sp])).map(loosePos).filter(Boolean);
  // how packed each stretch of path is
  const busy = new Map(), edge = p => p.at.k < p.to.k ? p.at.k + "|" + p.to.k : p.to.k + "|" + p.at.k;
  for(const p of parties) if(p.at && p.to){ const k = edge(p); busy.set(k, (busy.get(k) || 0) + 1); }

  for(const p of parties){
    for(const k of Object.keys(NEEDS)) p.needs[k] = Math.min(100, p.needs[k] + NEEDS[k].rate * dt);
    let hurt = GUEST.tire;
    for(const [k, d] of Object.entries(NEEDS)){ const o = p.needs[k] - d.seek; if(o > 0) hurt += GUEST.needHurt * o / (100 - d.seek); }
    if(p.at && p.to){
      const L = Math.hypot(p.to.x - p.at.x, p.to.y - p.at.y) || 1;
      if(busy.get(edge(p)) * 10 / L > GUEST.crowd){ hurt += GUEST.crowdHurt; thinks(p, "crowded"); }
    }
    p.mood = clamp(p.mood - hurt * dt, 0, 100);
    if(p.needs.bladder >= 100){ thinks(p, "accident"); p.mood = Math.max(0, p.mood - 30); p.needs.bladder = 0; goHome(p); }
    if(!p.fled && p.at && danger.some(([x, y]) => Math.hypot(p.at.x - x, p.at.y - y) < GUEST.fleeRange)){ p.fled = true; thinks(p, "scared"); p.mood -= 15; goHome(p); }
    // set off for the gate in time to be out by the time they planned to leave
    if(!p.home && (m1 + walkMins(p, "gate") >= p.until || p.mood < GUEST.quitBelow)) goHome(p);
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
  L.last = {thoughts:L.thoughts, guests:L.guests};
  L.thoughts = {}; L.guests = 0;
}
function resetParties(){ parties = []; svcQ = new Map(); arrivalCarry = 0; }

// What guests are thinking: today's leavers plus everyone still here. Falls back to yesterday before anyone has left.
function topThoughts(n){
  const L = state.guestLog, c = {...L.thoughts};
  let tot = L.guests;
  for(const p of parties){ tot += p.n; for(const k of p.thought) c[k] = (c[k] || 0) + p.n; }
  const use = tot ? {c, tot} : {c:L.last.thoughts, tot:L.last.guests};
  return Object.entries(use.c).filter(([k]) => THOUGHTS[k]).map(([k, v]) => ({k, share:v / Math.max(1, use.tot), ...THOUGHTS[k]}))
    .sort((a, b) => b.share - a.share).slice(0, n);
}
// Average mood of everyone in the park right now
function moodNow(){ let s = 0, n = 0; for(const p of parties){ s += p.mood * p.n; n += p.n; } return n ? s / n : null; }
// Parties waiting at a guest building, and how many it's serving
function queueAt(b){ const q = svcQ.get(b.id); return q ? {waiting:q.queue.length, busy:q.busy.length} : {waiting:0, busy:0}; }
