/* =====================================================================
   FENCES ON THE GRID
   Fence goes down a piece at a time on the 5 m grid (FENCE_GRID.step, the same grid as path chunks), Zoo Tycoon
   style: dragging lays a straight or diagonal run, one piece a grid step. A piece runs along one grid edge (5 m)
   or corner to corner across one square (about 7.1 m). They live in state.fenceGrid, keyed "x,y,d" in meters with
   x,y on the grid and d one of h (east from x,y), v (south from x,y), d (x,y to x+S,y+S) or a (x+S,y to x,y+S),
   each {b: barrier}.
   Any loop of pieces closes off a region. A region of at least FENCE_GRID.minArea becomes an exhibit
   with e.grid set, and its e.points are the loop, so everything that reads an exhibit's shape still works.
   When a grid exhibit's loop is broken it keeps its last shape with e.open set: the fence has a gap
   and the animals can walk out until it's closed again. Its pieces are then drawn as loose fence.
   ===================================================================== */

const fencePieces = () => state.fenceGrid || (state.fenceGrid = {});
const FS = FENCE_GRID.step;
const fenceSnap = v => Math.round(v / FS) * FS;
const pieceKey = (x, y, d) => `${x},${y},${d}`;
const pieceType = p => (p && p.b) || "wood";
// A piece can carry a different fence on each side, for a wall two pens share: b is the side an exhibit sees when its loop runs the piece
// from its first end to its second (fwd), b2 the other side. No b2 means one fence for both sides.
const pieceSplit = p => !!p && p.b2 !== undefined;
const pieceKind = (p, fwd) => fwd || !pieceSplit(p) ? pieceType(p) : p.b2;
const pieceKinds = p => pieceSplit(p) ? [pieceType(p), p.b2] : [pieceType(p)];
const mkPiece = (a, b2) => { const p = a === "wood" ? {} : {b:a}; if(b2 !== undefined && b2 !== a) p.b2 = b2; return p; };
// What laying a piece costs or sells back for: every fence standing on it
const pieceWorth = (k, p) => pieceKinds(p).reduce((s, t) => s + pieceCost(k, t), 0);
function pieceEnds(k){
  const [xs, ys, d] = k.split(","), x = +xs, y = +ys;
  return d === "h" ? [[x, y], [x + FS, y]] : d === "v" ? [[x, y], [x, y + FS]] : d === "d" ? [[x, y], [x + FS, y + FS]] : [[x + FS, y], [x, y + FS]];
}
const pieceLen = k => /[hv]$/.test(k) ? FS : FS * Math.SQRT2;
const pieceCost = (k, barrier) => pieceLen(k) * fenceRate(barrier || "wood");
// The piece joining two neighboring grid points
function pieceBetween(a, b){
  const dx = b[0] - a[0], dy = b[1] - a[1];
  if(Math.abs(dx) > FS || Math.abs(dy) > FS || (!dx && !dy)) return null;
  const x = Math.min(a[0], b[0]), y = Math.min(a[1], b[1]);
  return !dy ? pieceKey(x, a[1], "h") : !dx ? pieceKey(a[0], y, "v") : dx === dy ? pieceKey(x, y, "d") : pieceKey(x, y, "a");
}
// The run a drag from grid point a toward b lays: straight or diagonal, whichever is nearest the pointer
function pieceLine(a, b){
  const dx = b[0] - a[0], dy = b[1] - a[1];
  if(!dx && !dy) return {end:a, keys:[]};
  const o = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)), sx = Math.round(Math.cos(o * Math.PI / 4)), sy = Math.round(Math.sin(o * Math.PI / 4));
  const n = Math.round((sx && sy ? (Math.abs(dx) + Math.abs(dy)) / 2 : sx ? Math.abs(dx) : Math.abs(dy)) / FS);
  const keys = []; let p = a;
  for(let i = 0; i < n; i++){ const q = [p[0] + sx * FS, p[1] + sy * FS]; keys.push(pieceBetween(p, q)); p = q; }
  return {end:p, keys};
}
// The pieces around a loop of grid points (each side straight or diagonal)
function loopPieces(pts){
  const out = [];
  for(let i = 0; i < pts.length; i++){
    const a = pts[i], b = pts[(i + 1) % pts.length], sx = Math.sign(b[0] - a[0]) * FS, sy = Math.sign(b[1] - a[1]) * FS, n = Math.round(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) / FS);
    for(let k = 0; k < n; k++) out.push(pieceBetween([a[0] + sx * k, a[1] + sy * k], [a[0] + sx * (k + 1), a[1] + sy * (k + 1)]));
  }
  return out;
}
// Is walking from grid point a to its neighbor b along the piece's first-end-to-second direction?
const stepFwd = (k, a) => { const [e] = pieceEnds(k); return e[0] === a[0] && e[1] === a[1]; };
// The pieces around a loop with the way the loop runs each one: [{k, fwd}]
function loopSteps(pts){
  const out = [];
  for(let i = 0; i < pts.length; i++){
    const a = pts[i], b = pts[(i + 1) % pts.length], sx = Math.sign(b[0] - a[0]) * FS, sy = Math.sign(b[1] - a[1]) * FS, n = Math.round(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) / FS);
    for(let j = 0; j < n; j++){ const p = [a[0] + sx * j, a[1] + sy * j], k = pieceBetween(p, [p[0] + sx, p[1] + sy]); out.push({k, fwd:stepFwd(k, p)}); }
  }
  return out;
}
// Which way each piece is walked by the closed regions around it: k -> 1 (fwd) | 2 (back), both bits when two pens share it
function faceDirs(pieces = fencePieces()){
  const m = new Map();
  for(const f of fenceFaces(pieces)) if(f.simple && !f.nested) for(const s of loopSteps(f.raw)) m.set(s.k, (m.get(s.k) || 0) | (s.fwd ? 1 : 2));
  return m;
}

/* ---------- finding the loops ---------- */
// Every region the pieces fence off: [{pts, raw, area, key, simple, nested}]. pts drops corners where the
// fence runs straight on in the same barrier, so each side of the shape is one kind of fence.
// simple is false when the loop touches itself (a pen hanging inside another by one fence line), and
// nested when another loop of fence floats inside it without touching. Neither can become an exhibit.
function fenceFaces(pieces = fencePieces()){
  const vk = p => p[0] + "," + p[1], adj = new Map();
  const link = (a, b) => { let v = adj.get(vk(a)); if(!v) adj.set(vk(a), v = {p:a, n:[]}); v.n.push(b); };
  for(const k in pieces){ const [a, b] = pieceEnds(k); link(a, b); link(b, a); }
  // dead ends can't be part of a loop: trim them back
  const stack = [...adj.keys()].filter(k => adj.get(k).n.length < 2);
  while(stack.length){
    const k = stack.pop(), v = adj.get(k); if(!v) continue;
    adj.delete(k);
    for(const q of v.n){ const w = adj.get(vk(q)); if(!w) continue; w.n = w.n.filter(r => vk(r) !== k); if(w.n.length < 2) stack.push(vk(q)); }
  }
  for(const v of adj.values()) v.n.sort((a, b) => Math.atan2(a[1] - v.p[1], a[0] - v.p[0]) - Math.atan2(b[1] - v.p[1], b[0] - v.p[0]));
  // walk each side of each piece; every walk goes round one region (or round the outside of a cluster)
  const seen = new Set(), faces = [];
  for(const v of adj.values()) for(const w of v.n){
    let a = v.p, b = w;
    if(seen.has(vk(a) + ">" + vk(b))) continue;
    const raw = [];
    while(!seen.has(vk(a) + ">" + vk(b))){
      seen.add(vk(a) + ">" + vk(b)); raw.push(a);
      const B = adj.get(vk(b)), i = B.n.findIndex(q => q[0] === a[0] && q[1] === a[1]);
      a = b; b = B.n[(i + B.n.length - 1) % B.n.length];
    }
    // the outside of a cluster winds the other way round
    let s = 0; for(let i = 0; i < raw.length; i++){ const p = raw[i], q = raw[(i + 1) % raw.length]; s += p[0] * q[1] - q[0] * p[1]; }
    if(s <= 0) continue;
    const at = raw.reduce((m, p, i) => p[0] < raw[m][0] || (p[0] === raw[m][0] && p[1] < raw[m][1]) ? i : m, 0), loop = raw.slice(at).concat(raw.slice(0, at));
    faces.push({raw:loop, key:loop.map(vk).join(";"), area:s / 2, simple:new Set(loop.map(vk)).size === loop.length});
  }
  for(const f of faces){
    const on = new Set(f.raw.map(vk)), bb = bbox(f.raw);
    f.nested = [...adj.values()].some(v => !on.has(vk(v.p)) && v.p[0] > bb.x0 && v.p[0] < bb.x1 && v.p[1] > bb.y0 && v.p[1] < bb.y1 && inPoly(v.p[0], v.p[1], f.raw));
    f.pts = straighten(f.raw, pieces);
  }
  return faces;
}
// Drop the corners where a loop runs straight on in the same kind of fence
function straighten(raw, pieces){
  const n = raw.length, type = i => { const a = raw[i], k = pieceBetween(a, raw[(i + 1) % n]), p = pieces[k]; return pieceKind(p, stepFwd(k, a)) + (pieceSplit(p) ? "*" : ""); };   // a side is one kind, and all shared or all not
  const keep = raw.filter((p, i) => {
    const a = raw[(i + n - 1) % n], b = raw[(i + 1) % n];
    return (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]) !== 0 || (p[0] - a[0]) * (b[0] - p[0]) + (p[1] - a[1]) * (b[1] - p[1]) < 0 || type((i + n - 1) % n) !== type(i);
  });
  return keep.map(p => p.slice());
}
// Sample points in a region, four a square, placed so no grid line or diagonal passes through them (each is a quarter m²)
const FACE_SAMPLES = [[.2, .6], [.6, .8], [.4, .2], [.8, .4]];
function faceSamples(pts){
  const b = bbox(pts), out = [];
  for(let x = Math.floor(b.x0); x < b.x1; x++) for(let y = Math.floor(b.y0); y < b.y1; y++)
    for(const [u, v] of FACE_SAMPLES) if(inPoly(x + u, y + v, pts)) out.push([x + u, y + v]);
  return out;
}
const gridExhibits = () => state.exhibits.filter(e => e.grid);
const boxesMeet = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
// The weakest fence around a loop, on the loop's own side of each piece: that's what holds the animals in
function weakestOf(pts){
  const P = fencePieces(); let w = null;
  for(const {k, fwd} of loopSteps(pts)){ const t = P[k] ? pieceKind(P[k], fwd) : null; if(t && (!w || BARRIERS[t].strength < BARRIERS[w].strength)) w = t; }
  return w || "wood";
}
// Is an open exhibit closed in by lagoon wall all round, on its own side of every piece? Only that holds sea water and pool animals.
function lagoonWalled(e){
  if(!e || e.viv || e.open) return false;
  if(!e.grid) return e.barrier === "lagoon";
  const P = fencePieces(); return loopSteps(e.points).every(({k, fwd}) => P[k] && pieceKind(P[k], fwd) === "lagoon");
}
// The sea water in a grid exhibit would end up behind other fence if these pieces changed (next: piece key -> new piece): why not, or null
function seaWallProblem(next){
  const P = fencePieces();
  for(const e of gridExhibits()){
    if(e.open || !waterOf(e).some(w => SEA_WATER[w.kind])) continue;
    if(loopSteps(e.points).some(({k, fwd}) => k in next && pieceKind(next[k], fwd) !== "lagoon" && P[k] && pieceKind(P[k], fwd) === "lagoon")) return `The sea water in ${e.name} needs its lagoon wall.`;
  }
  return null;
}
// The first step of each side of a closed grid exhibit's loop: [{k, fwd}] a side
const sideStart = (e, i) => { const P = e.points, a = P[i], b = P[(i + 1) % P.length], k = pieceBetween(a, [a[0] + Math.sign(b[0] - a[0]) * FS, a[1] + Math.sign(b[1] - a[1]) * FS]); return {k, fwd:stepFwd(k, a)}; };
// The kind of fence along each side of a closed grid exhibit, on the exhibit's own side of the wall
const sideKinds = e => e.points.map((p, i) => { const s = sideStart(e, i); return pieceKind(fencePieces()[s.k], s.fwd); });
// How far a side is nudged into its exhibit where it stands against another pen's fence on the same line, so the two walls are both seen: [dx, dy] a side
const sideOffsets = e => e.points.map((p, i) => {
  const s = sideStart(e, i); if(!pieceSplit(fencePieces()[s.k])) return null;
  const q = e.points[(i + 1) % e.points.length], dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy) || 1;
  return [-dy / L * FENCE_GRID.sideGap, dx / L * FENCE_GRID.sideGap];   // loops run clockwise on screen, so the inside is to the right of the way they go
});
// Pieces that are part of a closed grid exhibit's loop (the rest are drawn as loose fence)
function claimedPieces(){ const s = new Set(); for(const e of gridExhibits()) if(!e.open) for(const k of loopPieces(e.points)) s.add(k); return s; }
// The same by side: "k|1" is a piece's fwd side held by a closed exhibit, "k|0" its other side
function claimedSides(){ const s = new Set(); for(const e of gridExhibits()) if(!e.open) for(const t of loopSteps(e.points)) s.add(t.k + "|" + (t.fwd ? 1 : 0)); return s; }
// What bulldozing a grid exhibit takes with it: the pieces no other closed exhibit shares
function ownPieces(e){
  const others = new Set(); for(const x of gridExhibits()) if(x !== e && !x.open) for(const k of loopPieces(x.points)) others.add(k);
  return e.open ? [] : loopPieces(e.points).filter(k => fencePieces()[k] && !others.has(k));
}
// A shared wall with a different fence each side: the pieces of it on this exhibit's side
const ownSides = e => { if(e.open) return []; const own = new Set(ownPieces(e)); return loopSteps(e.points).filter(s => pieceSplit(fencePieces()[s.k]) && !own.has(s.k)); };
const ownPieceCost = e => ownPieces(e).reduce((s, k) => s + pieceWorth(k, fencePieces()[k]), 0) + ownSides(e).reduce((s, t) => s + pieceCost(t.k, pieceKind(fencePieces()[t.k], t.fwd)), 0);
// An exhibit goes and takes its side of every shared wall with it: the other side's fence is left alone
function releaseSides(e){ for(const t of ownSides(e)){ const p = fencePieces()[t.k]; fencePieces()[t.k] = mkPiece(pieceKind(p, !t.fwd)); } }

/* ---------- checking a run ---------- */
// Is this piece on a path chunk? Pieces lie on chunk edges, so running along the edge of a path is fine; across a chunk, or along an edge two path chunks share, is not.
function pieceOnPath(k){
  const [xs, ys, d] = k.split(","), C = pathChunks(), has = (cx, cy) => !!C[chunkKey(cx, cy)], cx = Math.floor(+xs / CHUNK), cy = Math.floor(+ys / CHUNK);
  return d === "d" || d === "a" ? has(cx, cy) : d === "h" ? has(cx, cy - 1) && has(cx, cy) : has(cx - 1, cy) && has(cx, cy);
}
// Why one piece can't go here, or null. with: other pieces going down at the same time.
function pieceSpotProblem(k, with_ = new Set()){
  const seg = pieceEnds(k), [x, y, d] = k.split(",");
  if(!insidePlot(seg)) return "Keep it inside the park boundary.";
  const other = pieceKey(x, y, d === "d" ? "a" : "d");
  if((d === "d" || d === "a") && (fencePieces()[other] || with_.has(other))) return "Two diagonal fences can't cross.";
  for(const e of state.exhibits){
    if(!e.grid){ if(lineEntersShape(seg, e.points) || (e.viv && lineShapeDist(seg, e.points) < .1)) return `It runs into ${e.name}.`; continue; }
    if(waterOf(e).some(w => lineThroughShape(seg, w.points))) return `It runs into the water in ${e.name}.`;
    if(landOf(e).some(f => LAND[f.type] && rectsHitLine(footRects(f, e), seg))) return `It runs into something in ${e.name}. Bulldoze it first.`;
  }
  if(state.buildings.some(b => parkGround(b) && (lineEntersShape(seg, b.points) || lineShapeDist(seg, b.points) < .3))) return "It runs into a building.";
  if(state.paths.some(p => !p.d && (linesCross(seg, p.points) || lineLineDist(seg, p.points) < halfWidth(p) - .3)) || pieceOnPath(k)) return "It runs into a path.";
  if(parkWater().some(w => lineThroughShape(seg, w.points))) return "It runs into water.";
  if(decorOf().some(f => LAND[f.type] && rectsHitLine(footRects(f, null), seg))) return "It runs into a plant, rock or statue.";
  if(fenceLines().some(l => linesCross(l.points, seg))) return "It runs into a fence.";
  if(lineDist(state.gate[0], state.gate[1], seg) < 8.5) return "Keep clear of the entrance.";
  return null;
}
// Points that lie inside a body of water: its middle and each corner pulled a little toward it (a bent shore can put the middle outside, so only points really in the water count)
function waterProbe(pts){ const c = centroid(pts); return [c, ...pts.map(p => [p[0] + (c[0] - p[0]) * .1, p[1] + (c[1] - p[1]) * .1])].filter(p => inPoly(p[0], p[1], pts)); }
// Park water, plants, rocks and statues a fence closes around become the exhibit's own: its water and land
function absorbPark(e){
  const inside = p => inPoly(p[0], p[1], e.points);
  for(const w of parkWater().slice()) if(waterProbe(w.points).some(inside)){ state.water.splice(state.water.indexOf(w), 1); (e.water = e.water || []).push(w); }
  for(const f of decorOf().slice()) if(inside([f.x, f.y])){ state.decor.splice(state.decor.indexOf(f), 1); (e.land = e.land || []).push(f); }
}
// Why a region can't be fenced off, or null
function faceProblem(f){
  if(!f.simple || f.nested) return "A pen inside another one has to share a wall with it.";
  const P = f.raw, inside = p => inPoly(p[0], p[1], P);
  if(state.paths.some(p => !p.d && p.points.some(inside)) || Object.keys(pathChunks()).some(k => { const [cx, cy] = chunkXY(k); return inside([(cx + .5) * CHUNK, (cy + .5) * CHUNK]); })) return "That would fence in a path.";
  if(state.buildings.some(b => parkGround(b) && inside(centroid(b.points)))) return "That would fence in a building.";
  if(state.exhibits.some(e => !e.grid && inside(e.points[0]))) return "That would fence in another exhibit.";
  if(fenceLines().some(l => l.points.some(inside))) return "That would fence in another fence.";
  if(inside(state.gate)) return "That would fence in the entrance.";
  return null;
}
// Ground a set of regions adds to the park's exhibits: the part of each one big enough to be an exhibit that no grid exhibit already has
function newGround(faces){
  const old = gridExhibits().map(e => ({pts:e.points, bb:bbox(e.points)}));
  let n = 0;
  for(const f of faces){
    if(f.area < FENCE_GRID.minArea) continue;
    const bb = bbox(f.pts), near = old.filter(o => boxesMeet(o.bb, bb));
    n += faceSamples(f.pts).filter(([x, y]) => !near.some(o => inPoly(x, y, o.pts))).length;
  }
  return n * .25;
}
// What laying a run would do: {todo (the pieces that change), next (what each becomes), cost, why, note}. Pieces already there in this fence are skipped; another kind is replaced.
// o.meet: leave other fence where it stands and lay only on the free edges, so the new fence meets the old.
// o.dir and o.side: which way the run goes, and which side of it the pointer is on (1 / -1 / 0 near the line). On a wall two pens share, the fence goes on the pointer's side only; with the pointer on the wall (0), both sides change.
function planPieces(keys, barrier, o = {}){
  const B = BARRIERS[barrier], P = fencePieces(), out = {todo:[], next:{}, cost:0, why:null, note:""};
  if(B.tech && !hasTech(B.tech)) return {...out, why:`Research ${TECH.find(x => x.id === B.tech).label.toLowerCase()} at the Research Lab first.`};
  if(B.pool && !poolsOn()) return {...out, why:"Lagoon walls aren't open yet."};
  const dirs = o.dir && o.side && !o.meet ? faceDirs(P) : null;
  let kept = 0, swapped = 0, sided = 0;
  for(const k of keys){
    const old = P[k];
    if(!old){ out.next[k] = mkPiece(barrier); out.todo.push(k); continue; }
    if(pieceKinds(old).every(t => t === barrier)) continue;   // already there
    if(o.meet){ kept += pieceLen(k); continue; }
    let nx = mkPiece(barrier);
    if(dirs && (dirs.get(k) === 3 || pieceSplit(old))){
      const [e0, e1] = pieceEnds(k), fwd = (e1[0] - e0[0]) * o.dir[0] + (e1[1] - e0[1]) * o.dir[1] > 0, onA = (o.side > 0) === fwd;
      nx = onA ? mkPiece(barrier, pieceKind(old, false)) : mkPiece(pieceType(old), barrier);
      sided++;
    }
    if(pieceKind(nx, true) === pieceKind(old, true) && pieceKind(nx, false) === pieceKind(old, false)) continue;
    out.next[k] = nx; out.todo.push(k); swapped += pieceLen(k);
  }
  const todo = out.todo;
  if(!todo.length) return {...out, why:kept ? "Other fence is in the way. Switch the bar to Replace to change it." : keys.length ? "That fence is already there." : ""};
  const all = new Set(todo);
  for(const k of todo){ const why = pieceSpotProblem(k, all); if(why) return {...out, why}; }
  { const why = seaWallProblem(out.next); if(why) return {...out, why}; }
  const trial = {...P}; for(const k of todo) trial[k] = out.next[k];
  // the regions it closes off must be clear; and any loop it leaves floating inside another (which leaves the outer one's shape alone) is refused too
  const was = new Set(fenceFaces(P).map(f => f.key)), after = fenceFaces(trial), made = after.filter(f => !was.has(f.key) || f.nested || !f.simple);
  for(const f of made){ const why = faceProblem(f); if(why) return {...out, why}; }
  out.cost = Math.round(todo.reduce((s, k) => s + pieceCost(k, barrier), 0));   // the ground is paid for when a gate makes the pen an exhibit
  const notes = [];
  if(swapped) notes.push(sided ? `Changes the fence on the side your pointer is on for ${Math.round(swapped)} m of shared wall. Keep the pointer on the wall to change both sides.` : `Replaces ${Math.round(swapped)} m of other fence.`);
  if(kept) notes.push(`Meets ${Math.round(kept)} m of fence that is already there.`);
  out.note = notes.join(" ");
  if(!canAfford(out.cost)) out.why = `Costs ${money(out.cost)}. You have ${money(state.money)}.`;
  return out;
}

/* ---------- laying and lifting ---------- */
// Lay a run; returns what happened to the exhibits, for a toast
function layPieces(keys, barrier, o){
  const plan = planPieces(keys, barrier, o);
  if(plan.why) return null;
  spend(plan.cost, "built");
  for(const k of plan.todo) fencePieces()[k] = plan.next[k];
  const before = new Set(penFaces().map(f => f.key)), notes = syncFenceExhibits();
  const made = penFaces().filter(f => !before.has(f.key));
  if(made.length) notes.push(`Closed off ${fmtArea(made[0].area)}. Put a gate on its fence to make it an exhibit.`);
  return {cost:plan.cost, n:plan.todo.length, notes};
}
function liftPieces(keys){
  const P = fencePieces(), gone = keys.filter(k => P[k]);
  let back = 0;
  for(const k of gone){ back += pieceWorth(k, P[k]) * COST.refundShare; delete P[k]; }
  back = Math.round(back); earn(back, "sold");
  return {n:gone.length, back, notes:syncFenceExhibits()};
}

/* ---------- loops into exhibits ---------- */
// Match the fenced regions to the grid exhibits after the fence changed: an exhibit takes the region that
// holds the most of its old ground (at least FENCE_GRID.keepShare of it). A region nobody takes stays a plain pen
// until a gate goes on it (penFaces, adoptPen); an exhibit whose ground went to another merges into it; one with
// no region left is open, and stays an exhibit until its gate is removed.
// Returns plain-text notes on what changed.
function syncFenceExhibits(){
  const faces = fenceFaces().filter(f => f.simple && !f.nested), grid = gridExhibits(), notes = [];
  const S = faces.map(f => faceSamples(f.pts)), size = new Map(grid.map(e => [e, Math.max(1, area(e.points) * 4)]));
  const pairs = [];
  const eb = new Map(grid.map(e => [e, bbox(e.points)]));
  faces.forEach((f, i) => { const fb = bbox(f.pts); for(const e of grid){ if(!boxesMeet(fb, eb.get(e))) continue; const o = S[i].filter(([x, y]) => inPoly(x, y, e.points)).length; if(o) pairs.push({i, e, o}); } });
  pairs.sort((a, b) => b.o - a.o);
  const faceEx = new Map(), exFace = new Map();
  for(const {i, e, o} of pairs) if(!faceEx.has(i) && !exFace.has(e) && o >= size.get(e) * FENCE_GRID.keepShare){ faceEx.set(i, e); exFace.set(e, i); }
  // exhibits that lost their region
  for(const e of grid){
    if(exFace.has(e)) continue;
    const into = pairs.find(p => p.e === e && faceEx.has(p.i) && p.o >= size.get(e) * FENCE_GRID.keepShare);
    if(into){ const to = faceEx.get(into.i); mergeExhibit(e, to); notes.push(`${e.name} joined ${to.name}.`); }
    else if(!e.open){ e.open = true; notes.push(`${e.name}'s fence has a gap. Its animals can walk out.`); }
  }
  faces.forEach((f, i) => {
    let e = faceEx.get(i);
    if(e){
      if(e.open){ delete e.open; notes.push(`${e.name}'s fence is closed again.`); }
      e.points = f.pts;
    } else return;   // a closed pen with no exhibit waits for a gate (penFaces)
    const bar = weakestOf(e.points);
    if(bar === "wood") delete e.barrier; else e.barrier = bar;
  });
  for(const e of gridExhibits()) if(!e.open) absorbPark(e);   // a fence moved out around something in the park takes it in
  rehomeContents(notes);
  return notes;
}
// Closed regions big enough to be an exhibit that no grid exhibit holds yet: a gate on one makes it an exhibit
function penFaces(){
  const grid = gridExhibits();
  return fenceFaces().filter(f => {
    if(!f.simple || f.nested || f.area < FENCE_GRID.minArea) return false;
    const [q] = faceSamples(f.pts);
    return q && !grid.some(e => inPoly(q[0], q[1], e.points));
  });
}
// A gate on a pen turns it into an exhibit
function adoptPen(f, gate){
  const e = newGridExhibit(f.pts); e.gate = gate; absorbPark(e);
  const bar = weakestOf(e.points); if(bar !== "wood") e.barrier = bar;
  return e;
}
function newGridExhibit(pts){
  const used = new Set(state.exhibits.map(x => x.name));
  let n = 1; while(used.has(`Exhibit ${n}`)) n++;
  const e = {id:uid("e-"), name:`Exhibit ${n}`, points:pts, grid:true, animals:[], happy:70, cond:100, inspected:{day:state.day, cond:100}};
  if(parkBiome() !== DEFAULT_BIOME) e.biome = parkBiome();   // new exhibits start out as the park's own ground
  autoZone(e);
  themeNew("exhibit", e);
  state.exhibits.push(e);
  return e;
}
// Two exhibits became one: the animals, plants, rocks, water and viewing platforms move over
function mergeExhibit(from, to){
  to.animals.push(...from.animals);
  if(landOf(from).length) to.land = landOf(to).concat(landOf(from));
  if(waterOf(from).length) to.water = waterOf(to).concat(waterOf(from));
  for(const b of state.buildings) if(b.exhibitId === from.id) b.exhibitId = to.id;
  state.exhibits.splice(state.exhibits.indexOf(from), 1);
  if(typeof sel !== "undefined" && sel && sel.kind === "exhibit" && sel.id === from.id) sel.id = to.id;
}
// Plants, rocks and water left outside their exhibit's new fence move to the exhibit they're now in, or are sold back
function rehomeContents(notes){
  const closed = gridExhibits().filter(e => !e.open), home = (x, y) => closed.find(e => inPoly(x, y, e.points));
  let sold = 0;
  for(const e of closed){
    for(const f of landOf(e).slice()){
      if(inPoly(f.x, f.y, e.points)) continue;
      const to = home(f.x, f.y); e.land.splice(e.land.indexOf(f), 1);
      if(to) (to.land = to.land || []).push(f); else { earn(Math.round((LAND[f.type] ? LAND[f.type].price : 0) * COST.refundShare), "sold"); sold++; }
    }
    for(const w of waterOf(e).slice()){
      const [x, y] = centroid(w.points); if(inPoly(x, y, e.points)) continue;
      const to = home(x, y); e.water.splice(e.water.indexOf(w), 1);
      if(to) (to.water = to.water || []).push(w); else { earn(Math.round(waterCost(w.points, w.kind) * COST.refundShare), "sold"); sold++; }
    }
  }
  if(sold) notes.push(`${sold} thing${sold === 1 ? "" : "s"} left outside the fence ${sold === 1 ? "was" : "were"} sold back.`);
}
// Change every piece around a grid exhibit to one kind of fence (the panel's wall picker). A wall it shares with another pen changes on its own side only.
function refenceExhibit(e, barrier){
  const P = fencePieces(), dirs = faceDirs();
  for(const {k, fwd} of loopSteps(e.points)){
    const old = P[k];
    if(old && (pieceSplit(old) || dirs.get(k) === 3)) P[k] = fwd ? mkPiece(barrier, pieceKind(old, false)) : mkPiece(pieceType(old), barrier);
    else P[k] = mkPiece(barrier);
  }
  syncFenceExhibits();
}

/* ---------- older saves ---------- */
// Fence from before pieces were 5 m long was laid a meter a piece. Each old piece's ends snap to the nearest 5 m grid point,
// so a run stays joined up (a piece that shrinks to nothing goes). Each grid exhibit takes the new loop that holds most of
// its old ground, and its gate moves onto that fence. Works on the save s itself, before it becomes state.
function snapFencesToGrid5(s){
  const old = s.fenceGrid || {}, P = {}, str = t => BARRIERS[t] ? BARRIERS[t].strength : 0;
  const oldEnds = k => { const [x, y, d] = k.split(",").map((v, i) => i < 2 ? +v : v); return d === "h" ? [[x, y], [x + 1, y]] : d === "v" ? [[x, y], [x, y + 1]] : d === "d" ? [[x, y], [x + 1, y + 1]] : [[x + 1, y], [x, y + 1]]; };
  for(const k in old){
    const [a, b] = oldEnds(k).map(p => p.map(fenceSnap)), nk = pieceBetween(a, b); if(!nk) continue;
    const [x, y, d] = nk.split(","), cross = pieceKey(x, y, d === "d" ? "a" : "d"); if((d === "d" || d === "a") && P[cross]) continue;   // diagonals can't cross
    const p = old[k], fwd = stepFwd(nk, a), nx = mkPiece(pieceKind(p, fwd), pieceSplit(p) ? pieceKind(p, !fwd) : undefined), was = P[nk];
    if(!was || Math.min(...pieceKinds(nx).map(str)) > Math.min(...pieceKinds(was).map(str))) P[nk] = nx;   // two old runs on one new piece: the stronger fence stays
  }
  s.fenceGrid = P;
  const faces = fenceFaces(P).filter(f => f.simple && !f.nested), taken = new Set();
  for(const e of s.exhibits.filter(e => e.grid)){
    const S = faceSamples(e.points);
    let best = null, bo = 0;
    faces.forEach((f, i) => { if(taken.has(i)) return; const o = S.filter(([x, y]) => inPoly(x, y, f.pts)).length; if(o > bo && o >= S.length * FENCE_GRID.keepShare){ bo = o; best = i; } });
    if(best !== null){ taken.add(best); e.points = faces[best].pts; delete e.open; }
    else { e.points = e.points.map(p => p.map(fenceSnap)).filter((p, i, a) => p[0] !== a[(i + a.length - 1) % a.length][0] || p[1] !== a[(i + a.length - 1) % a.length][1]); e.open = true; }
    if(e.gate && e.points.length > 1){
      let g = null;
      for(let i = 0; i < e.points.length; i++){ const r = segProj(e.gate[0], e.gate[1], e.points[i], e.points[(i + 1) % e.points.length]); if(!g || r.d < g.d) g = r; }
      e.gate = [g.x, g.y];
    }
  }
}

/* ---------- drawing ---------- */
// Loose pieces (not part of a closed exhibit) gathered into straight runs of one kind: [{pts, b, off}].
// A wall two pens share with a different fence each side that has only one side held by an exhibit is drawn once for the side that is still loose, nudged (off) to its own side.
function looseRuns(){
  const P = fencePieces(), held = claimedSides(), step = {h:[FS, 0], v:[0, FS], d:[FS, FS], a:[-FS, FS]}, runs = [];
  // the kind of fence loose on a piece: side 0 is a piece with one fence for both sides, 1 and -1 the fwd and other side of a piece with two
  const loose = (k, sgn) => {
    const p = P[k]; if(!p) return null;
    if(!pieceSplit(p)) return sgn || held.has(k + "|1") || held.has(k + "|0") ? null : pieceType(p);
    return sgn && !held.has(k + "|" + (sgn > 0 ? 1 : 0)) ? pieceKind(p, sgn > 0) : null;
  };
  for(const k in P) for(const sgn of pieceSplit(P[k]) ? [1, -1] : [0]){
    const kind = loose(k, sgn); if(!kind) continue;
    const [x, y, d] = k.split(","), [sx, sy] = step[d], prev = pieceKey(+x - sx, +y - sy, d);
    if(loose(prev, sgn) === kind) continue;   // not the start of its run
    let n = 1; while(loose(pieceKey(+x + sx * n, +y + sy * n, d), sgn) === kind) n++;
    const [a] = pieceEnds(k), [, z] = pieceEnds(pieceKey(+x + sx * (n - 1), +y + sy * (n - 1), d)), L = Math.hypot(sx, sy);
    runs.push({pts:[a, z], b:kind, off:sgn ? [-sy / L * sgn * FENCE_GRID.sideGap, sx / L * sgn * FENCE_GRID.sideGap] : null});
  }
  return runs;
}
// One open run of fence, flat or standing up in the 3/4 view
function fenceRunSvg(pts, b, themed){
  const B = BARRIERS[b] || BARRIERS.wood, p = polyStr(pts), ns = `fill="none" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" pointer-events="none"`;
  if(tilted()) return fence34(pts, false, B.hedge ? "hedge" : b, "all");
  if(B.hedge) return hedgeSvg("polyline", p);
  const col = themed ? B.color : "#26402F", w = {wood:2, bars:2.5, electric:2.5, acrylic:3, brick:3.5, stone:3.5, bamboo:2, palisade:3.5, iron:2.5, drystone:3, adobe:3.5, stake:2, bone:2.5, rope:1.5, concrete:4.5, lagoon:3.5}[b] || 2;
  let s = `<polyline points="${p}" stroke="${col}" stroke-width="${w}" ${ns}/><polyline points="${p}" stroke="${B.color}" stroke-width="${w + 2.5}" stroke-dasharray="0 16" ${ns}/>`;
  if(b === "electric") s += `<polyline points="${p}" stroke="#1D2B22" stroke-width="1" stroke-dasharray="3 5" ${ns}/>`;
  if(b === "bars") s += `<polyline points="${p}" stroke="#C9CCD1" stroke-width="1" stroke-dasharray="1 3" ${ns}/>`;
  return s;
}
// Makes connections readable at a glance: a dark footing line under every piece, a post cap where pieces meet, and an amber ring on each loose end that joins nothing (a gap or an unfinished pen). The rings only show while the build menu is open or the fence tool is active, so a lone wall can be scenery.
function fenceJointsSvg(inv){
  const P = fencePieces(), keys = Object.keys(P); if(!keys.length) return "";
  const claimed = claimedPieces(), deg = new Map(), dirs = new Map(), at = new Map(), n2 = v => v.toFixed(2), fencing = tool === "exhibit" || sideCat === "exhibits";
  let foot = "", s = "";
  for(const k of keys){
    const [a, b] = pieceEnds(k), loose = !claimed.has(k);
    foot += `M${a[0]} ${a[1]}L${b[0]} ${b[1]}`;
    for(const p of [a, b]){ const id = p[0] + "," + p[1], v = deg.get(id) || 0; deg.set(id, v + 1); (dirs.get(id) || dirs.set(id, new Set()).get(id)).add(k.split(",")[2]); if(loose) at.set(id, p); else if(!at.has(id)) at.set(id, null); }
  }
  s += `<path d="${foot}" fill="none" stroke="#1D2B22" stroke-opacity=".38" stroke-width="2.5" stroke-linecap="round" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
  const r = Math.max(.28, 3.5 * inv);
  for(const [id, n] of deg){
    const [x, y] = id.split(",").map(Number), open = n === 1 && at.get(id) && fencing;
    if(open) s += `<circle cx="${x}" cy="${y}" r="${n2(r * 1.5)}" fill="#E08A2E" fill-opacity=".28" stroke="#E08A2E" stroke-width="2" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
    else if(n > 2 || dirs.get(id).size > 1) s += `<rect x="${n2(x - r * .6)}" y="${n2(y - r * .6)}" width="${n2(r * 1.2)}" height="${n2(r * 1.2)}" fill="#1D2B22" fill-opacity=".7" pointer-events="none"/>`;
  }
  return s;
}
// A closed grid exhibit's fence, side by side in each side's own kind
function gridFenceSvg(e){
  const kinds = sideKinds(e), n = e.points.length, themed = themeKey(e) !== "genesis";
  let s = "";
  for(let i = 0; i < n; i++) s += fenceRunSvg([e.points[i], e.points[(i + 1) % n]], kinds[i], themed);
  return s;
}
// The nearest piece to a world point within r meters, or null
function pieceNear(x, y, r){
  let best = null, bd = r;
  for(let gx = Math.floor((x - r) / FS) * FS - FS; gx <= x + r; gx += FS) for(let gy = Math.floor((y - r) / FS) * FS - FS; gy <= y + r; gy += FS)
    for(const d of ["h", "v", "d", "a"]){ const k = pieceKey(gx, gy, d); if(!fencePieces()[k]) continue; const [a, b] = pieceEnds(k), q = segProj(x, y, a, b); if(q.d < bd){ bd = q.d; best = k; } }
  return best;
}
