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
let guestSegs = [];   // [a, b, half width] of each guest path stretch: guests stand and step only on these, never on grass or staff paths
let moodColors = false;    // color guests on the map by how happy they are
let nextSize = 1;          // how many are in the next party through the gate

const guestCount = () => parties.reduce((s, p) => s + p.n, 0);
const guestBuilding = b => !!(BUILDINGS[b.type].serves || BUILDINGS[b.type].kind);
const NO_THOUGHT = {hunger:"noFood", thirst:"noDrink", bladder:"noRestroom", energy:"noSeat"};
function freshGuestLog(){ return {thoughts:{}, guests:0, mood:null, edu:null, vandal:freshVandalLog(), last:{thoughts:{}, guests:0}}; }
// One exhibit's guest day: visitors who stopped to watch, donations from what they learned here, and what it made them think
function freshExLog(){ return {views:0, gifts:0, thoughts:{}, last:{views:0, gifts:0, thoughts:{}}}; }
const exLog = e => e.glog || (e.glog = freshExLog());
let seeingEx = null;   // the exhibit a party is looking at while seeExhibit runs, so its thoughts are filed under it

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
    const t = BUILDINGS[b.type], [cx, cy] = centroid(b.points), [dx, dy] = doorPoint(b), range = Math.hypot(t.w, t.d) / 2 + REACH;
    stop(b.id, nearest(dx, dy, range) || nearest(cx, cy, range));   // guests walk to the path point nearest the door; if the door side has none in range, to the one nearest the middle
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
    const t = BUILDINGS[b.type]; if(!t.tram || !isReachable(b) || condOf(b) < TRAM.offlineBelow || unpowered(b)) continue;
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
  const segs = (ps, hw) => ps.flatMap(p => p.points.slice(1).map((v, i) => [p.points[i], v, hw(p)]));
  guestSegs = segs(live, p => isWide(p) ? WIDE_PATH.halfWidth : isBridge(p) ? BRIDGE.halfWidth : PATH_HALF_WIDTH);
  gFields = new Map(); gFieldsWalk = new Map();
  indexLitterSpots(nodes);
  indexDecor(nodes);
  indexGrid(nodes);
  indexLight(nodes);
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
             spd:rand(...GUEST.speed) * GUEST.pace, off:(Math.random()*2-1) * 1.4, tramRoll:Math.random(), in:null, rowdy:pers.includes("hooligan"), lane:Math.random()*2-1, sj:[Math.random()*2-1, Math.random()*2-1]};
  p.sneaked = sneaksIn(p);   // hooligans may slip in without a ticket
  if(!p.sneaked && state.ticket > fairTicket() * 1.3 * pm(p, "ticket")){ thinks(p, "pricey"); p.mood -= 8; }
  return p;
}
function guestsArrive(n){
  if(state.parkClosed) return;   // the gate is shut: nobody comes in and no tickets are sold
  state.today.guests += n;
  if(parties.length < GUEST.maxParties){ const p = newParty(n); if(!p.sneaked) earn(state.ticket * n, "tickets"); parties.push(p); return; }
  earn(state.ticket * n, "tickets");
  // the map is full: these guests tag along with a party that just got here
  const p = parties[parties.length - 1 - Math.floor(Math.random() * Math.min(50, parties.length))];
  p.n += n; p.cash += n * rand(...GUEST.cash);
}
// The weather now as guests feel it (GUEST_WX): mood a minute from the heat or cold, and from today's event as it falls now, and how much thirstier the heat makes them
function guestWeather(){
  const w = wxNow(), G = GUEST_WX, t = w.temp;
  const heat = t > G.hotFrom ? Math.min(G.max, G.hot + G.hotPer * (t - G.hotFrom)) : 0, cold = t < G.coldBelow ? Math.min(G.max, G.cold + G.coldPer * (G.coldBelow - t)) : 0;
  const indoor = heat || cold || G.ev[w.ev] ? new Set(state.buildings.filter(b => BUILDINGS[b.type] && BUILDINGS[b.type].indoor).map(b => b.id).concat(state.exhibits.filter(e => e.viv).map(e => e.id))) : null;   // vivariums are indoors too
  return {heat, cold, ev:w.ev, evHurt:G.ev[w.ev] || 0, thirst:1 + G.thirst * heat / G.max, indoor};
}
const WX_THOUGHT = {rain:"wxRain", snow:"wxSnow", storm:"wxStorm", sandstorm:"wxSand", wind:"wxWind"};
// Mood a party loses a minute to the weather: nothing in line at or inside an indoor building, or watching a vivarium; umbrellas keep off rain and storms, jackets the cold and snow
function weatherMood(p, wg){
  if(!wg.heat && !wg.cold && !wg.evHurt) return 0;
  if((p.in && wg.indoor.has(p.in)) || (p.watch && wg.indoor.has(p.watch.id))) return 0;
  const G = GUEST_WX, has = k => Math.min(1, (p[k] || 0) / p.n), umb = 1 - (1 - G.umbrella) * has("umbrella"), jak = 1 - (1 - G.jacket) * has("jacket");
  const ev = wg.evHurt * (wg.ev === "rain" || wg.ev === "storm" ? umb : wg.ev === "snow" ? jak : 1), cold = wg.cold * jak;
  const hurt = (wg.heat + cold + ev) * pm(p, "weather");
  if(wg.heat >= G.thought) thinks(p, "wxHot");
  if(cold >= G.thought) thinks(p, "wxCold");
  if(ev >= G.thought) thinks(p, WX_THOUGHT[wg.ev]);
  return hurt;
}
function thinks(p, k){
  p.thought.add(k);
  if(seeingEx && !seeingEx.th.has(k)){ seeingEx.th.add(k); const L = exLog(seeingEx.e); L.thoughts[k] = (L.thoughts[k] || 0) + p.n; }
}
// A party learns something. Learning is per guest, 0 to 100, and cheers them up as it comes. Learning at an exhibit is remembered for its donations.
function learn(p, n, e){
  const g = clamp(n * pm(p, "learn"), 0, 100 - (p.edu || 0)); p.edu = (p.edu || 0) + g; p.mood += g * EDU.joy;
  if(e && g > 0) (p.learnAt || (p.learnAt = {}))[e.id] = (p.learnAt[e.id] || 0) + g;
}
// Share a party's donation among the exhibits it learned at, by how much it learned at each
function creditGifts(p, g){
  const at = p.learnAt, tot = at ? Object.values(at).reduce((s, v) => s + v, 0) : 0;
  if(!tot) return;
  for(const [id, v] of Object.entries(at)){ const e = state.exhibits.find(x => x.id === id); if(e) exLog(e).gifts += g * v / tot; }
}
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
  if(edu > 0){ const g = p.n * EDU.donate * edu / 100 * pm(p, "donate"); earn(g, "donations"); creditGifts(p, g); }
  // and educated guests fund science
  if(edu > 0 && dept("oracle")) state.science.points += p.n * RESEARCH_GUEST * edu / 100;
  L.guests += p.n;
  for(const k of p.thought) L.thoughts[k] = (L.thoughts[k] || 0) + p.n;
}
function goHome(p){
  if(p.home) return;
  leaveQueue(p);
  p.home = true; p.dest = null; p.why = null; p.linger = 0; p.stroll = 0; p.watch = null;
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
    const whim = p.whim || (p.whim = {});
    if(whim[x.id] === undefined) whim[x.id] = rand(...SIGHT.whim);   // each party likes its own mix, so they don't all file to the same star
    const w = (appeal + 1) / (1 + d / SIGHT.distPull) * taste * whim[x.id] * (state.exhibits.includes(x) ? darkPull(x.id) : 1);
    opts.push([x, w]); tot += w;
  };
  for(const e of state.exhibits) if(!p.seen.has(e.id) && e.animals.length && gGraph.anchors[e.id]) add(e, exhibitAppeal(e), tasteOf(p, e));
  // the Education Center, once, if there's time left for the walk and the visit (and they didn't just give up on its line)
  if(!p.learnt && (p.cool.see || 0) <= state.minute)
    for(const b of state.buildings){
      if(b.type !== "edcenter" || !gGraph.anchors[b.id] || unpowered(b)) continue;
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
    if(!s){ thinks(p, NO_THOUGHT[need]); if(need === "energy" && state.buildings.some(b => BUILDINGS[b.type].seats && isBroken(b))) thinks(p, "broken"); if(state.buildings.some(b => unpowered(b) && guestBuilding(b))) thinks(p, "noPower"); p.cool[need] = state.minute + 60; }
    else if(s.b.id !== p.dest){ p.dest = s.b.id; p.why = need; if(s.d > GUEST.farWalk && !p.map) thinks(p, "far"); return; }
  }
  if(p.dest) return;
  // on impulse: a stand or restroom close by when a need is creeping up, or a gift shop that catches the eye
  const I = SIGHT.impulse;
  for(const [k, d] of Object.entries(NEEDS)){
    const ck = "i" + k;
    if(p.needs[k] < d.seek * I.frac || (p.cool[ck] || 0) > state.minute || (p.cool[k] || 0) > state.minute) continue;
    p.cool[ck] = state.minute + I.gap / GUEST.pace;
    const s = bestStop(p, k);
    if(s && s.d <= I.near && Math.random() < I.chance){ p.dest = s.b.id; p.why = k; return; }
  }
  if((p.cool.ishop || 0) <= state.minute && p.mood >= 45 && p.cash >= 5){
    p.cool.ishop = state.minute + I.gap / GUEST.pace;
    const s = bestStop(p, "shop");
    if(s && s.d <= I.shopNear && Math.random() < I.shop){ p.dest = s.b.id; p.why = "shop"; return; }
  }
  // sometimes they just wander the paths for a bit before choosing the next exhibit
  if(p.stroll > 0) return;
  if(Math.random() < SIGHT.strollChance && !p.done){ p.stroll = Math.round(rand(...SIGHT.strollLen)); return; }
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
  p.stand = null;
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
  // and lean toward stretches they haven't walked yet
  const opts = [...p.at.adj.keys()].filter(n => n !== p.prev && !(p.at.ride && p.at.ride.has(n)));
  if(opts.length){
    const trail = p.trail || (p.trail = new Map()), ws = opts.map(n => 1 / (1 + (trail.get(n.k) || 0)) ** 2), tot = ws.reduce((a, b) => a + b, 0);
    let r = Math.random() * tot, i = 0;
    while(i < opts.length - 1 && (r -= ws[i]) > 0) i++;
    p.to = opts[i];
  } else p.to = p.prev;
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
  standNear(p, b.points, null, b);
}
// Where a party wants to be beside its path node or stretch: across the whole width of the path while walking, at its spot when watching or waiting
function partyOff(p){
  if(p.stand) return [p.stand.dx, p.stand.dy];
  if(p.to){
    const dx = p.to.x - p.at.x, dy = p.to.y - p.at.y, L = Math.hypot(dx, dy) || 1, room = (p.at.room && p.at.room.get(p.to)) || 1;
    const w = (room > 1 ? WIDE_PATH.halfWidth : PATH_HALF_WIDTH) - .6, lat = (p.lane || 0) * w;
    return [-dy/L*lat, dx/L*lat];
  }
  const a = p.off * 4.4;
  return [Math.cos(a) * Math.abs(p.off) * 1.5, Math.sin(a) * Math.abs(p.off) * 1.5];
}
// They walk to their spot at their own pace, not slide there (the drawing reads p.ox/p.oy)
function stepOff(p, meters){
  if(!p.at) return;
  let o = partyOff(p);
  // standing about at a node (or at a spot): pull in toward the path line until it's off any staff road
  // (walking, the lane must stay off one at both ends of the stretch)
  {
    const k = o[0].toFixed(2) + "," + o[1].toFixed(2) + "@" + p.at.k + (p.to ? ">" + p.to.k : "");
    if(p.deckB && !p.stand && Math.hypot(p.ox || 0, p.oy || 0) < .3) p.deckB = null;   // back down on the path
    if(p.offK !== k){
      p.offK = k;
      const bad = f => offPath(p.at.x + o[0] * f, p.at.y + o[1] * f) || (p.to && offPath(p.to.x + o[0] * f, p.to.y + o[1] * f));
      let f = 1; while(!(p.stand && p.stand.deck) && f > .05 && bad(f)) f *= .6;
      p.offT = f > .05 ? [o[0] * f, o[1] * f] : [0, 0];
    }
    o = p.offT;
  }
  if(p.ox === undefined){ p.ox = o[0]; p.oy = o[1]; return; }
  const dx = o[0] - p.ox, dy = o[1] - p.oy, d = Math.hypot(dx, dy);
  if(d <= meters){ p.ox = o[0]; p.oy = o[1]; } else { p.ox += dx / d * meters; p.oy += dy / d * meters; }
}
// What a party at an exhibit notices, a thing at a time, while it stands there
function observe(p, e){
  const note = (text, d, good) => { (p.notes = p.notes || []).push({text, good:!!good}); if(p.notes.length > 12) p.notes.shift(); if(d) p.mood = clamp(p.mood + d, 0, 100); };
  const seen = e.animals.filter(a => !a.inside);
  if(!seen.length){ note("There's nothing out to see right now.", -1); return; }
  if(Math.random() < OBS.chance.exhibit){
    const sp = SPECIES_BY_ID[seen[0].sp];
    if(e.happy < 35){ note("They don't look happy in there.", -1); return; }
    if(!hasSign(e)){ note(`I'd love to know more about the ${sp.name}.`, 0); return; }
    if(e.happy >= 75){ note("They look really well looked after.", 1, true); return; }
  }
  const a = seen[Math.floor(Math.random() * seen.length)], sp = SPECIES_BY_ID[a.sp], n = sp.name;
  const band = sickBand(a);   // guests notice a seriously sick animal
  if(band && band !== SICK_BAND[0]){ const crit = band === SICK_BAND[2]; note(`${a.name} the ${n} looks unwell.`, crit ? -3 : -2); thinks(p, crit ? "critical" : "sickly"); return; }
  learn(p, EDU.see * OBS.learn * (hasSign(e) ? 1 + EDU.sign : 1));
  switch(a.act){
    case "eat": note(`The ${n} is tucking into a meal.`, 1, true); thinks(p, "feeding"); break;
    case "drink": note(`A ${n} stops for a drink.`, .5, true); break;
    case "rest": note(`That ${n} is having a lie down.`, 0); break;
    case "hunt": note(`The ${n} is stalking something...`, 1, true); break;
    case "forage": note(`A ${n} is rooting around for food.`, .5, true); break;
    case "social": note(`The ${n}s are sticking close together.`, 1, true); break;
    case "play": note(`Look, a ${n} is playing!`, 2, true); thinks(p, "playful"); break;
    case "hide": note(`The ${n} is keeping out of sight.`, -1); break;
    case "pace": note(`The ${n} keeps pacing the fence.`, -2); thinks(p, "pacing"); break;
    case "patrol": note(`The ${n} is prowling along the fence.`, .5, true); break;
    default: note(`The ${n} is just standing there.`, 0);
  }
}
function observeTick(p, now){
  const w = p.watch;
  if(!w || p.linger <= now){ p.watch = null; return; }
  if(p.stand && Math.hypot((p.ox || 0) - p.stand.dx, (p.oy || 0) - p.stand.dy) > .4) return;   // still walking over
  if(w.next === undefined){ w.next = now + rand(...OBS.gap) * .4 / GUEST.pace; return; }
  if(now < w.next) return;
  const e = state.exhibits.find(x => x.id === w.id);
  if(e) observe(p, e);
  w.next = now + rand(...OBS.gap) / GUEST.pace;
}
// Is this spot off the guest paths (on grass, a staff path, anything that isn't paving guests may use)? A little in from the edge so feet stay on it.
const offPath = (x, y) => !guestSegs.some(([a, b, hw]) => segProj(x, y, a, b).d < hw - .35);
// Can a guest walk straight from (x0, y0) to (x1, y1) off the path? Not through a fence, over a staff road, into water or through a building (skip is the one they're heading for)
function standOk(x0, y0, x1, y1, skip){
  const A = [x0, y0], B = [x1, y1], cross = pts => { for(let i = 1; i < pts.length; i++) if(segCross(A, B, pts[i-1], pts[i])) return true; return false; };
  for(const e of state.exhibits){ if(cross(e.points.concat([e.points[0]]))) return false; if(inPoly(x1, y1, e.points)) return false; }
  for(const l of parkFences()) if(cross(l.points)) return false;
  // only on guest paving the whole way (up to the last meter or so for a platform's steps or a gallery's door, which stand just off the path)
  const L = Math.hypot(x1 - x0, y1 - y0), end = skip && (skip.type === "platform" || skip.type === "gallery") ? L - 1.5 : L;
  for(let t = 0; t <= end; t += .5){ const k = L ? t / L : 0; if(offPath(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k)) return false; }
  if(end === L && offPath(x1, y1)) return false;
  for(const w of parkWater()) if(inPoly(x1, y1, w.points) || cross(w.points.concat([w.points[0]]))) return false;
  for(const b of state.buildings){
    if(b === skip || BUILDINGS[b.type].prop) continue;
    if(inPoly(x1, y1, b.points) || cross(b.points.concat([b.points[0]]))) return false;
  }
  return true;
}
// Where a party stands to watch or wait: a spot along a fence or wall (or on a viewing platform), as an offset from its path node.
// Drawing only; it never changes where the party is on the map. Spots are picked along the whole stretch of fence in range, the nearer the likelier, so a crowd spreads out.
function standNear(p, pts, e, bld){
  const n = p.at;
  if(!n || !pts) return;
  // a viewing platform or gallery on this exhibit within a short stroll: most would rather watch from there
  if(e && Math.random() < SIGHT.deckShare){
    let best = null, bd = SIGHT.deckReach;
    for(const b of state.buildings){
      if((b.type !== "platform" && b.type !== "gallery") || b.exhibitId !== e.id || !(derived.reach && derived.reach[b.id])) continue;
      const [cx, cy] = centroid(b.points), d = Math.hypot(cx - n.x, cy - n.y);
      if(d < bd){ bd = d; best = b; }
    }
    if(best){
      const P = best.points, u = .12 + Math.random() * .76, v = .12 + Math.random() * .76;
      const x = P[0][0] + (P[1][0] - P[0][0]) * u + (P[3][0] - P[0][0]) * v, y = P[0][1] + (P[1][1] - P[0][1]) * u + (P[3][1] - P[0][1]) * v;
      // up the steps: the ground part of the walk, to where it meets the deck, must be clear
      let t = 0;
      while(t < 1 && !inPoly(n.x + (x - n.x) * t, n.y + (y - n.y) * t, P)) t += .02;
      if(standOk(n.x, n.y, n.x + (x - n.x) * t, n.y + (y - n.y) * t, best)) p.stand = {dx:P[0][0] + (P[1][0] - P[0][0]) * u + (P[3][0] - P[0][0]) * v - n.x, dy:P[0][1] + (P[1][1] - P[0][1]) * u + (P[3][1] - P[0][1]) * v - n.y};
      if(p.stand){
        p.stand.deck = p.deckB = best;   // drawn up on the deck (map.js deckLift)
        if(p.linger > state.minute) p.linger += Math.hypot(p.stand.dx - (p.ox || 0), p.stand.dy - (p.oy || 0)) / (WALK_PER_MIN * p.spd);   // the walk over doesn't eat into the watching
        return;
      }
    }
  }
  const cand = [];
  for(let i = 0; i < pts.length; i++){
    const a = pts[i], b = pts[(i + 1) % pts.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    // acrylic is for looking through: guests come from farther along the path and crowd it, so a run of it makes a viewing gallery
    const glass = e && pts === e.points && (e.grid ? sideKinds(e)[i] : e.barrier) === "acrylic", reach = glass ? SIGHT.glassReach : SIGHT.standReach, pull = glass ? SIGHT.glassPull : SIGHT.standPull, wt = glass ? SIGHT.glassWeight : 1;
    for(let t = 0; t <= L; t += 1){
      const x = a[0] + (b[0] - a[0]) * t / L, y = a[1] + (b[1] - a[1]) * t / L, d = Math.hypot(x - n.x, y - n.y);
      if(d > reach) continue;
      // one step out from the fence, on the side that isn't inside
      let nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L;
      if(inPoly(x + nx * .8, y + ny * .8, pts)){ nx = -nx; ny = -ny; }
      if(inPoly(x + nx * .8, y + ny * .8, pts)) continue;
      // as close to the fence as the paving goes: step out until on a guest path (grass between path and fence stays empty)
      for(let g = .6; g <= SIGHT.standGap; g += .4){
        const X = x + nx * g, Y = y + ny * g;
        if(offPath(X, Y)) continue;
        if(Math.hypot(X - n.x, Y - n.y) <= reach) cand.push([X, Y, wt / (1 + d / pull)]);
        break;
      }
    }
  }
  // pick by weight, and drop any spot they couldn't walk to without crossing a fence, a staff road or a building
  let c = null;
  for(let tries = 0; tries < 10 && cand.length && !c; tries++){
    let r = Math.random() * cand.reduce((s, k) => s + k[2], 0), i = cand.length - 1;
    for(let j = 0; j < cand.length; j++){ r -= cand[j][2]; if(r <= 0){ i = j; break; } }
    if(standOk(n.x, n.y, cand[i][0], cand[i][1], bld)) c = cand[i]; else cand.splice(i, 1);
  }
  if(!c) return;
  p.stand = {dx:c[0] - n.x, dy:c[1] - n.y};
  if(p.linger > state.minute) p.linger += Math.hypot(p.stand.dx - (p.ox || 0), p.stand.dy - (p.oy || 0)) / (WALK_PER_MIN * p.spd);
}
// Does this exhibit have any acrylic fence on show?
const hasGlass = e => !e.viv && (e.grid ? sideKinds(e).includes("acrylic") : e.barrier === "acrylic");
function seeExhibit(p, e, quick){
  if(p.dest === e.id && p.why === "see"){ p.dest = null; p.why = null; }
  if(p.seen.has(e.id)) return;
  p.seen.add(e.id);
  if(!e.animals.length) return;
  exLog(e).views += p.n;
  seeingEx = {e, th:new Set()};
  try { lookAt(p, e, quick); } finally { seeingEx = null; }
}
function lookAt(p, e, quick){
  const a = exhibitAppeal(e), bother = hideBother(p, e);   // animals that are all indoors let a visit down (educated guests, paleo-nerds and conservationists forgive it)
  // stop and watch for a while: longer for a bigger draw
  if(!quick){ p.lingerAt = e.id; p.watch = {id:e.id}; }
  if(!quick) p.linger = state.minute + (SIGHT.dwell[0] + (SIGHT.dwell[1] - SIGHT.dwell[0]) * a / (a + 15)) * rand(.8, 1.2) / GUEST.pace;
  p.mood += GUEST.seeGain * a / (a + 15) * (1 - HIDING.appeal * bother) - HIDING.mood * bother;
  if(bother >= HIDING.thought) thinks(p, "hiding");
  if(e.happy < 35){ thinks(p, "sadAnimals"); p.mood -= 4; }
  personaSee(p, e);
  if(a >= 30) thinks(p, "wow");
  // what the animals were doing when they looked
  const n = e.animals.length, pace = e.animals.filter(x => x.act === "pace").length, play = e.animals.filter(x => x.act === "play").length;
  if(pace / n >= .5){ thinks(p, "pacing"); p.mood -= 2; }
  else if(play / n >= .3){ thinks(p, "playful"); p.mood += 2; }
  // what they learn: a little from looking, a lot more with an info sign to read, and more again with a field guide
  const sign = hasSign(e);
  learn(p, (EDU.see + (sign ? EDU.sign * (1 + speciesCounts(e).size * .25) : 0)) * (p.guide ? EDU.guideBoost : 1), e);
  if(!sign && (p.noSign = (p.noSign || 0) + 1) >= EDU.noInfo) thinks(p, "noInfo");
}
// Is there a working info sign by this exhibit's fence?
// hook: propFront(b) says which way a sign faces; today any sign near the fence counts from every side
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
    if(p.linger > state.minute){   // standing and watching, up against the fence
      if(!p.stand){ const e = state.exhibits.find(x => x.id === p.lingerAt); if(e) standNear(p, e.points, e); }
      return;
    }
    // done watching or being served: walk back to the path the way they came before setting off along it
    if(p.stand && !p.to){ p.stand = null; }
    if(!p.to && Math.hypot(p.ox || 0, p.oy || 0) > 2.5) return;
    if(!p.to){ if(!headOut(p)) return; board(p); }
    const L = p.at.adj.get(p.to) || .01, rem = L * (1 - p.t);   // how far the edge feels: a ride is shorter than it looks, a platform wait longer
    if(left < rem){ p.t += left / L; return; }
    left -= rem;
    const ids = p.at.sees && p.at.sees.get(p.to);
    if(ids) for(const id of ids){
      const e = state.exhibits.find(x => x.id === id);
      if(!e || p.seen.has(id)) continue;
      if(p.home){ seeExhibit(p, e, true); continue; }   // on the way out they only glance
      // walking past an exhibit they haven't seen: stop for it, or keep going
      const g = p.glance || (p.glance = new Set());
      if(g.has(id) || !e.animals.length) continue;
      g.add(id);
      const a = exhibitAppeal(e), onTrip = p.why in NEEDS;
      if(Math.random() < clamp(SIGHT.glance * a / (a + SIGHT.glanceAppeal) * tasteOf(p, e) * (onTrip ? .3 : 1) * (hasGlass(e) ? SIGHT.glassGlance : 1), 0, .95)) seeExhibit(p, e);
    }
    p.prev = p.at; p.at = p.to; p.to = null; p.t = 0; p.stand = null; p.deckB = null; p.lane = Math.random() * 2 - 1;
    if(p.stroll > 0) p.stroll--;
    if(p.trail) p.trail.set(p.at.k, (p.trail.get(p.at.k) || 0) + 1);
    if(!p.at.rail){ trashCheck(p); boxCheck(p); }
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
  trashCheck(p); boxCheck(p);
}

/* ---------- through the day ---------- */

// Arrivals follow a hump: few at first light, busiest early afternoon, none late at night (the hump is as wide in park minutes as the old open day).
const ARRIVE_START = minuteAtClock(GUEST.arriveFrom * 60), ARRIVE_END = minuteAtClock(GUEST.arriveTo * 60);
function arrivalShare(m0, m1){
  const f = m => { const t = clamp((m - ARRIVE_START) / (ARRIVE_END - ARRIVE_START), 0, 1); return (1 - Math.cos(Math.PI * t)) / 2; };
  return f(m1) - f(m0);
}
// The thin round-the-clock trickle, in guests a day, scaled by rating. It keeps the park from ever going quiet on its own.
const trickleRate = () => GUEST.trickle * (GUEST.trickleLow + (1 - GUEST.trickleLow) * state.rating / 5);

function guestsTick(m0, m1){
  const dt = m1 - m0, gdt = dt * GUEST.pace;   // guests live in slow motion: gdt is their own time
  if(state.guestLog.notice){ state.guestLog.notice = false; events.toast("Guests now get tired and drop litter. Put trash bins and benches along your paths (Path Tools). Tap a food stand or gift shop to change what it sells and its prices.", "bad"); }
  if(state.parkClosed){ for(const p of parties) if(!p.home) goHome(p); }   // closed: everyone still inside heads for the exit
  else{
    hotelGuestsArrive();
    const tr = trickleRate();   // the trickle is part of the day's demand, not on top of it (a park with no draw still gets it)
    arrivalCarry += Math.max(0, derived.demand - tr) * arrivalShare(m0, m1) + tr * dt / DAY_MIN;
  }
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

  const wg = guestWeather();
  for(const p of parties){
    const riding = !!(p.at && p.to && p.at.ride && p.at.ride.has(p.to));
    for(const k of Object.keys(NEEDS)) p.needs[k] = Math.min(100, p.needs[k] + (riding && k === "energy" ? 0 : NEEDS[k].rate * pneed(p, k) * (k === "thirst" ? wg.thirst : 1) * gdt));
    const inf = pm(p, "infra");   // family parties take bad infrastructure harder
    let hurt = riding ? 0 : GUEST.tire * pm(p, "walk");   // sitting on the tram, feet up
    for(const [k, d] of Object.entries(NEEDS)){ const o = p.needs[k] - d.seek; if(o > 0) hurt += GUEST.needHurt * inf * o / (100 - d.seek); }
    if(p.at && p.to){
      if(near(pos.get(p)) > GUEST.crowd * ((p.at.room && p.at.room.get(p.to)) || 1)){ hurt += GUEST.crowdHurt * inf; thinks(p, "crowded"); }
    }
    // walking through litter
    const mess = p.at && !p.at.rail ? litterAt(p.at.x, p.at.y) : 0;
    if(mess >= 3){ hurt += LITTER.hurt * inf * Math.min(1, mess / LITTER.heavy); if(mess >= 6) thinks(p, "litter"); }
    // after dark, a stretch no lamp lights is a bit frightening
    const dk = darkLevel();
    if(dk > 0 && p.at && !p.at.rail && (p.at.lit || 0) < LAMP.litAt){ hurt += LAMP.fear * dk * pm(p, "dark") * (1 - (p.at.lit || 0) / LAMP.litAt); if(dk >= .5) thinks(p, "dark"); }
    // gardens, water and statues along the way cheer them up, and they stop to read each statue's plaque
    if(p.at && p.at.decor){ hurt -= DECOR.joy * pm(p, "decor") * p.at.decor; if(p.at.decor >= DECOR.pretty) thinks(p, "pretty"); }
    if(p.at && p.at.statues) for(const id of p.at.statues) statueSeen(p, id);
    hurt += gridMood(p);   // power plants in view (and green power, for conservationists)
    hurt += weatherMood(p, wg);   // heat, cold, rain, snow, wind, storms
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
    if(p.watch) observeTick(p, m1);
    walkParty(p, WALK_PER_MIN * p.spd * dt);
    stepOff(p, WALK_PER_MIN * p.spd * dt);
  }
  serviceTick(dt, m1);
  parties = parties.filter(p => !p.gone);
}

// The day turns over at the rollover hour while guests are still walking about, so their timers (all in state.minute) move back a day with it
function shiftStamps(d){
  for(const p of parties){
    p.until -= d;
    if(p.linger) p.linger -= d;
    for(const k of Object.keys(p.cool)) p.cool[k] -= d;
    if(p.readyAt !== undefined) p.readyAt -= d;
    if(p.watch && p.watch.next !== undefined) p.watch.next -= d;
    for(const k of ["trashAt", "ejectAt", "ejectTry"]) if(p[k] !== undefined) p[k] -= d;
  }
}
// Remember how today's guests felt, for tomorrow's crowd and the rating
function guestsNight(){
  const t = state.today, L = state.guestLog;
  if(t.moodN) L.mood = t.moodSum / t.moodN;
  if(t.eduN) L.edu = t.eduSum / t.eduN;
  L.last = {thoughts:L.thoughts, guests:L.guests, vandal:L.vandal};
  L.thoughts = {}; L.guests = 0; L.vandal = freshVandalLog();
  for(const e of state.exhibits){ const X = exLog(e); X.last = {views:X.views, gifts:X.gifts, thoughts:X.thoughts}; X.views = 0; X.gifts = 0; X.thoughts = {}; }
}
// What visitors thought of one exhibit, most common first, as a share of its visitors. Falls back to yesterday before anyone has looked today.
function exThoughts(e, n){
  const X = exLog(e), use = X.views ? X : X.last;
  return Object.entries(use.thoughts).filter(([k]) => THOUGHTS[k]).map(([k, v]) => ({k, share:Math.min(1, v / Math.max(1, use.views)), ...THOUGHTS[k]}))
    .sort((a, b) => b.share - a.share).slice(0, n);
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
