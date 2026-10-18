/* =====================================================================
   PATHS AS CHUNKS
   A path is a 5 m x 5 m chunk. Chunk (cx, cy) is the square from (5cx, 5cy) to (5cx+5, 5cy+5); state.pathChunks holds them keyed "cx,cy"
   with a kind: g guest path, s staff path, b wooden bridge. Lay two side by side and they merge into one wide path. A drag lays whole chunks
   along a straight or 45 degree run (pathRun, planPath, layPath), like the fence tool; a diagonal run adds a connecting chunk at each step so
   the chunks stay edge to edge. Everything snaps to the chunk grid. Tram track is not chunks: it stays in state.paths as lines.
   state.pathFixed holds the one chunk at the gate, which can't be bulldozed (the rest of the entrance walk can).
   pathSquares() lists the chunks as squares for the renderer.

   Compatibility layer (until the navigation rework): the rest of the game still reads state.paths as lines, so syncPathStrips() derives
   strip polylines from the chunks (flagged d:1, 5 m wide through hw: 2.5, never saved). The chunks are expanded to 1 m cells for that, and a
   strip is a straight run along the "core" of the cells (cells whose whole 2.5 m surroundings are path), so a 5 m run's core is its center line.
   ===================================================================== */

let pathVer = 0;   // bumped whenever the chunks change, so the derived strips and reach know to rebuild
const CHUNK = 5;   // meters a chunk is across
const chunkKey = (cx, cy) => cx + "," + cy;
const pathChunks = () => state.pathChunks || (state.pathChunks = {});
const pathFixedChunks = () => state.pathFixed || (state.pathFixed = {});
const chunkXY = k => k.split(",").map(Number);
const chunkAt = (wx, wy) => [Math.floor(wx / CHUNK), Math.floor(wy / CHUNK)];
const gateChunk = (gate = state.gate) => chunkAt(gate[0], gate[1] - .5);   // the chunk just north of the gate, the one that can't be bulldozed
const pathKind = (cx, cy) => pathChunks()[chunkKey(cx, cy)] || null;
const pathAt = (wx, wy) => pathKind(Math.floor(wx / CHUNK), Math.floor(wy / CHUNK));
const pathChunkCost = k => PATH_CELLS.kinds[k].perMeter * CHUNK;   // a chunk is 5 m of path
const pathChunkUpkeep = k => PATH_CELLS.kinds[k].upkeepPerMeter * CHUNK;
const chunkRect = (cx, cy) => [[cx * CHUNK, cy * CHUNK], [cx * CHUNK + CHUNK, cy * CHUNK], [cx * CHUNK + CHUNK, cy * CHUNK + CHUNK], [cx * CHUNK, cy * CHUNK + CHUNK]];
// Every chunk as a square, for drawing: {cx, cy, x, y, w, h, kind, fixed}
function pathSquares(){
  const C = pathChunks(), F = pathFixedChunks(), out = [];
  for(const k in C){ const [cx, cy] = chunkXY(k); out.push({cx, cy, x:cx * CHUNK, y:cy * CHUNK, w:CHUNK, h:CHUNK, kind:C[k], fixed:!!F[k]}); }
  return out;
}

/* ---------- the run a drag lays ---------- */
// The chunks a drag from chunk a toward chunk b covers: the nearest straight or 45 degree run, and on a diagonal the chunk beside each step that keeps it edge to edge
function pathRun(a, b){
  const dx = b[0] - a[0], dy = b[1] - a[1];
  if(!dx && !dy) return {end:a, chunks:[a.slice()]};
  const o = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)), sx = Math.round(Math.cos(o * Math.PI / 4)), sy = Math.round(Math.sin(o * Math.PI / 4));
  const diag = sx && sy, n = diag ? Math.round((Math.abs(dx) + Math.abs(dy)) / 2) : sx ? Math.abs(dx) : Math.abs(dy), chunks = [];
  for(let i = 0; i <= n; i++){
    const x = a[0] + sx * i, y = a[1] + sy * i;
    chunks.push([x, y]);
    if(diag && i < n) chunks.push([x + sx, y]);
  }
  return {end:[a[0] + sx * n, a[1] + sy * n], chunks};
}

/* ---------- checking a run ---------- */
// What is in the way of chunks, gathered once for a whole run
function pathCtx(){
  const box = pts => { const b = bbox(pts); return {pts, x0:b.x0, y0:b.y0, x1:b.x1, y1:b.y1}; };
  const diag = new Set();
  for(const k of Object.keys(fencePieces())){ const [x, y, d] = k.split(","); if(d === "d" || d === "a") diag.add(x + "," + y); }
  return {
    ex: state.exhibits.map(e => ({...box(e.points), name:e.name})),
    bl: state.buildings.filter(b => !BUILDINGS[b.type].onPath).map(b => box(b.points)),
    water: parkWater().map(w => box(w.points)),
    decor: decorOf().filter(f => LAND[f.type]).flatMap(f => footRects(f, null)),
    lines: (state.fences || []).map(l => l.points),
    diag
  };
}
const hitsBox = (o, x, y) => x + CHUNK > o.x0 && x < o.x1 && y + CHUNK > o.y0 && y < o.y1;
// Why one chunk can't be a path of this kind, or null
function pathChunkProblem(cx, cy, kind, ctx){
  const x = cx * CHUNK, y = cy * CHUNK, e = .02, S = CHUNK;
  for(const [px, py] of [[x + e, y + e], [x + S - e, y + e], [x + S - e, y + S - e], [x + e, y + S - e]]) if(!inOwned(px, py, 0)) return "Keep it inside the park boundary.";
  const r = chunkRect(cx, cy);
  for(const o of ctx.ex) if(hitsBox(o, x, y) && shapesOverlap(r, o.pts)) return "Paths can't go through an exhibit.";
  for(const o of ctx.bl) if(hitsBox(o, x, y) && shapesOverlap(r, o.pts)) return "Paths can't go through a building.";
  if(kind !== "b") for(const o of ctx.water) if(hitsBox(o, x, y) && (shapesOverlap(r, o.pts) || shapesOverlap(o.pts, r))) return "Paths can't cross water. Lay a wooden bridge over it.";
  for(const b of ctx.decor) if(boxesHit(b, [x, y, x + S, y + S])) return "It runs into a plant, rock or statue. Bulldoze it first.";
  if(ctx.diag.size) for(let i = 0; i < S; i++) for(let j = 0; j < S; j++) if(ctx.diag.has((x + i) + "," + (y + j))) return "It runs into a fence.";
  for(const l of ctx.lines) if(lineEntersShape(l, r)) return "It runs into a fence.";
  return null;
}
// Is there a straight fence piece across the chunk, or on the edge it shares with the chunk next to it (at cx+dx, cy+dy)?
function fenceInChunk(cx, cy){
  const P = fencePieces(), x = cx * CHUNK, y = cy * CHUNK;
  for(let i = 0; i < CHUNK; i++) for(let j = 1; j < CHUNK; j++) if(P[pieceKey(x + j, y + i, "v")] || P[pieceKey(x + i, y + j, "h")]) return true;
  return false;
}
function fenceOnChunkEdge(cx, cy, nx, ny){
  const P = fencePieces();
  for(let i = 0; i < CHUNK; i++){
    if(nx !== cx){ if(P[pieceKey(Math.max(cx, nx) * CHUNK, cy * CHUNK + i, "v")]) return true; }
    else if(P[pieceKey(cx * CHUNK + i, Math.max(cy, ny) * CHUNK, "h")]) return true;
  }
  return false;
}
// What laying a run from chunk a to chunk b would do: {chunks (keys of the whole run), todo (the ones that change), bad (key to reason), cost, why, end, kind}
function planPath(a, b, kind){
  const C = pathChunks(), F = pathFixedChunks(), run = pathRun(a, b), out = {chunks:run.chunks.map(c => chunkKey(c[0], c[1])), todo:[], bad:new Map(), cost:0, why:"", end:run.end, kind};
  out.todo = out.chunks.filter(k => C[k] !== kind && !F[k] && !(kind === "s" && C[k]));   // a staff path never takes over a guest path or bridge
  if(!out.todo.length){ out.why = "That path is already there."; return out; }
  const ctx = pathCtx(), inRun = new Set(out.chunks);
  for(const k of out.todo){
    const [cx, cy] = chunkXY(k);
    let why = pathChunkProblem(cx, cy, kind, ctx);
    if(!why && fenceInChunk(cx, cy)) why = "It runs into a fence.";
    if(!why) for(const [dx, dy] of CHUNK_DIRS){
      const n = chunkKey(cx + dx, cy + dy);
      if((inRun.has(n) || C[n]) && fenceOnChunkEdge(cx, cy, cx + dx, cy + dy)){ why = "It runs into a fence."; break; }
    }
    if(why) out.bad.set(k, why);
  }
  out.cost = Math.round(out.todo.length * pathChunkCost(kind));
  if(out.bad.size) out.why = out.bad.values().next().value;
  else if(!canAfford(out.cost)) out.why = `Costs ${money(out.cost)}. You have ${money(state.money)}.`;
  return out;
}
// Lay a run; returns {n, cost} or null if it can't go there
function layPath(a, b, kind){
  const plan = planPath(a, b, kind);
  if(plan.why || !plan.todo.length) return null;
  spend(plan.cost, "built");
  const C = pathChunks();
  for(const k of plan.todo) C[k] = kind;
  pathVer++;
  return {n:plan.todo.length, cost:plan.cost};
}
// Take chunks away (not the chunk at the gate); gives back the refund share of what each cost. One refund for the lot.
function removeChunks(keys){
  const C = pathChunks(), F = pathFixedChunks();
  let n = 0, back = 0, kept = 0;
  for(const k of keys){
    if(!C[k]) continue;
    if(F[k]){ kept++; continue; }
    back += pathChunkCost(C[k]) * COST.refundShare; delete C[k]; n++;
  }
  if(n){ pathVer++; back = Math.round(back); earn(back, "sold"); }
  return {n, back, kept};
}
// The chunks a bulldoze box takes: every chunk the box overlaps (a tap, a box with no size, takes the one chunk under it). a and b are world points.
function chunksInBox(a, b){
  const C = pathChunks(), x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]), out = [];
  if(x0 === x1 && y0 === y1){ const [cx, cy] = chunkAt(x0, y0), k = chunkKey(cx, cy); return C[k] ? [k] : []; }
  for(let cx = Math.floor(x0 / CHUNK); cx * CHUNK < x1; cx++) for(let cy = Math.floor(y0 / CHUNK); cy * CHUNK < y1; cy++){
    const k = chunkKey(cx, cy);
    if(C[k] && cx * CHUNK + CHUNK > x0 && cy * CHUNK + CHUNK > y0) out.push(k);
  }
  return out;
}

/* ---------- old saves ---------- */
// The cells a line path covers, to its half width: cell centers within hw of the line (a tie goes to the left side, so a 5 m path on a whole meter is 5 cells wide)
function rasterPath(pts, hw){
  const out = [], b = bbox(pts);
  for(let x = Math.floor(b.x0 - hw); x <= Math.ceil(b.x1 + hw); x++) for(let y = Math.floor(b.y0 - hw); y <= Math.ceil(b.y1 + hw); y++){
    const cx = x + .5, cy = y + .5;
    let best = null;
    for(let i = 1; i < pts.length; i++){ const r = segProj(cx, cy, pts[i-1], pts[i]); if(!best || r.d < best.d) best = {...r, i}; }
    if(!best) continue;
    if(best.d < hw - 1e-6) out.push([x, y]);
    else if(best.d <= hw + 1e-6){
      const A = pts[best.i - 1], B = pts[best.i];
      if((B[0] - A[0]) * (cy - A[1]) - (B[1] - A[1]) * (cx - A[0]) > 0) out.push([x, y]);
    }
  }
  return out;
}
// Chunks from 1 m cells {"x,y": kind}: a chunk exists if most of its area was path (more than half of its 25 cells) or at least a fifth of it was staff path
// (staff roads used to be 3 m wide, so they get the benefit of the doubt), and takes the kind most of those cells had (a crossing cell counts as staff path)
function chunksFromCells(cells){
  const tally = {}, out = {};
  for(const k in cells){
    const [x, y] = chunkXY(k), ck = chunkKey(Math.floor(x / CHUNK), Math.floor(y / CHUNK)), kind = cells[k] === "x" ? "s" : cells[k];
    const t = tally[ck] || (tally[ck] = {n:0, g:0, s:0, b:0});
    t.n++; t[kind]++;
  }
  for(const ck in tally){
    const t = tally[ck];
    if(t.n * 2 <= CHUNK * CHUNK && t.s * 5 < CHUNK * CHUNK) continue;
    out[ck] = t.g + t.b >= t.s ? (t.b > t.g ? "b" : "g") : "s";
  }
  return out;
}
// Turn the line paths of a save into chunks (tram track stays a line): rasterize each to 1 m cells, then keep the chunks that were mostly path
function migratePaths(s){
  const cells = {}, fixed = {};
  const owned = [];
  for(const [i, j] of PARCEL_CELLS) if(parcelHome(i, j) || (s.parcels || []).includes(parcelId(i, j))) owned.push(parcelRect(i, j));
  const mine = (x, y) => owned.some(r => x >= r[0] && x + 1 <= r[2] && y >= r[1] && y + 1 <= r[3]);
  const kindOf = p => p.type === "service" ? "s" : p.type === "bridge" ? "b" : "g";
  const hwOf = p => p.type === "service" ? SERVICE_ROAD.halfWidth : p.type === "wide" ? WIDE_PATH.halfWidth : p.type === "bridge" ? BRIDGE.halfWidth : PATH_HALF_WIDTH;
  const rank = { g:2, b:2, s:1 };   // a guest path lies over a staff road where they cross
  for(const p of s.paths){
    if(p.type === "tram" || p.d || !p.points || p.points.length < 2) continue;
    const k = kindOf(p);
    for(const [x, y] of rasterPath(p.points, hwOf(p))){
      if(!mine(x, y)) continue;
      const key = x + "," + y, old = cells[key];
      if(!old || rank[k] >= rank[old]) cells[key] = k;
    }
  }
  s.pathChunks = chunksFromCells(cells); s.pathFixed = s.pathFixed || fixed;
  s.paths = s.paths.filter(p => p.type === "tram");
  pathVer++;
}
// The entrance walk of a new park (only its chunk at the gate is fixed): one chunk wide, from the chunk row by the gate (the gate is the middle of its chunk column) north to y 235
function mainWalkChunks(gate){
  const C = {}, F = {}, cx = Math.floor(gate[0] / CHUNK);
  for(let cy = Math.floor(235 / CHUNK); cy * CHUNK < gate[1]; cy++) C[chunkKey(cx, cy)] = "g";
  F[chunkKey(...gateChunk(gate))] = 1;
  return {C, F};
}

/* ---------- the compatibility layer: strips for code that still reads state.paths ---------- */
const STRIP_OFF = (() => { const o = []; for(let dx = -2; dx <= 2; dx++) for(let dy = -2; dy <= 2; dy++) if((dx || dy) && dx * dx + dy * dy <= 6.25) o.push([dx, dy]); return o; })();
const STRIP_DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];
const pnum = (x, y) => (x + 2048) * 8192 + (y + 2048);
const punum = n => [Math.floor(n / 8192) - 2048, n % 8192 - 2048];
let stripCache = null;   // {state, paths, chunks, ver, size, count}
const cellKey = (x, y) => x + "," + y;
// The chunks as 1 m cells {"x,y": kind}, which is what the strip builder reads
function chunkCells(C){
  const out = {};
  for(const k in C){ const [cx, cy] = chunkXY(k); for(let i = 0; i < CHUNK; i++) for(let j = 0; j < CHUNK; j++) out[cellKey(cx * CHUNK + i, cy * CHUNK + j)] = C[k]; }
  return out;
}
const cellXY = chunkXY;

/* ---------- connectivity: a flood fill over the chunks, edge to edge ---------- */
// Guests walk guest (g) and bridge (b) chunks. Staff walk every chunk: a staff chunk that touches a guest or bridge chunk is joined to it for staff
// (guests never step on a staff chunk). Both floods start from the chunk at the gate.
const guestCell = k => k === "g" || k === "b";
const CHUNK_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
let reachCache = null;   // {state, chunks, ver, size, G, A} sets of cnum keys, rebuilt only when the chunks change
const cnum = (cx, cy) => pnum(cx, cy);
function pathReach(){
  const C = pathChunks(), size = Object.keys(C).length, c = reachCache;
  if(c && c.state === state && c.chunks === C && c.ver === pathVer && c.size === size && c.gate === state.gate[0] + "," + state.gate[1]) return c;
  const kindAt = new Map();
  for(const k in C){ const [x, y] = chunkXY(k); kindAt.set(cnum(x, y), C[k]); }
  const [gx, gy] = gateChunk();
  const flood = guests => {
    const seen = new Set(), queue = [], s = cnum(gx, gy), k0 = kindAt.get(s);
    if(k0 && (!guests || guestCell(k0))){ seen.add(s); queue.push(s); }
    while(queue.length){
      const n = queue.pop(), [x, y] = punum(n);
      for(const [dx, dy] of CHUNK_DIRS){
        const m = cnum(x + dx, y + dy), j = kindAt.get(m);
        if(!j || seen.has(m)) continue;
        if(guests && !guestCell(j)) continue;
        seen.add(m); queue.push(m);
      }
    }
    return seen;
  };
  reachCache = {state, chunks:C, ver:pathVer, size, gate:state.gate[0] + "," + state.gate[1], G:flood(true), A:flood(false)};
  return reachCache;
}
// Is this chunk joined to the entrance for guests / for staff?
const chunkReached = (cx, cy, guests) => pathReach()[guests ? "G" : "A"].has(cnum(cx, cy));
// Is a world point on a chunk joined to the entrance?
const pointReached = (x, y, guests) => { const [cx, cy] = chunkAt(x, y); return chunkReached(cx, cy, guests); };
// Is a shape within d meters of a chunk that is joined to the entrance (guests: guest and bridge chunks; staff: any)? With any: of any chunk at all, joined or not. With kind: only chunks of that kind.
function nearCells(shape, d, guests, any, kind){
  const set = any ? null : pathReach()[guests ? "G" : "A"], C = pathChunks(), b = bbox(shape);
  for(let cx = Math.floor((b.x0 - d) / CHUNK); cx * CHUNK <= b.x1 + d; cx++) for(let cy = Math.floor((b.y0 - d) / CHUNK); cy * CHUNK <= b.y1 + d; cy++){
    if(set ? !set.has(cnum(cx, cy)) : !C[chunkKey(cx, cy)]) continue;
    if(any && guests && !guestCell(C[chunkKey(cx, cy)])) continue;
    if(kind && C[chunkKey(cx, cy)] !== kind) continue;
    const r = chunkRect(cx, cy);
    if(lineShapeDist([...r, r[0]], shape) <= d || inPoly(shape[0][0], shape[0][1], r)) return true;
  }
  return false;
}
// Is the wall with a building's door within reach of a joined chunk? (the door side is tried before the other sides)
function doorNear(b, guests){
  const P = b.points, i = faceEdge(P, b.face === undefined ? 2 : b.face), a = P[i], c = P[(i + 1) % P.length], L = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
  const [cx, cy] = centroid(P); let nx = (c[1] - a[1]) / L, ny = -(c[0] - a[0]) / L;
  if(nx * ((a[0] + c[0]) / 2 - cx) + ny * ((a[1] + c[1]) / 2 - cy) < 0){ nx = -nx; ny = -ny; }
  return nearCells([a, c, [c[0] + nx * .01, c[1] + ny * .01], [a[0] + nx * .01, a[1] + ny * .01]], REACH - PATH_HALF_WIDTH, guests);
}
// Does a shape sit on any path chunk? Touching a chunk's edge doesn't count.
function shapeOnChunks(shape){
  const C = pathChunks(), b = bbox(shape);
  for(let cx = Math.floor(b.x0 / CHUNK); cx * CHUNK < b.x1; cx++) for(let cy = Math.floor(b.y0 / CHUNK); cy * CHUNK < b.y1; cy++)
    if(C[chunkKey(cx, cy)] && shapesOverlap(chunkRect(cx, cy), shape)) return true;
  return false;
}
// Is every corner of a shape on a guest or bridge chunk? (corners are pulled a hair inward so one flush with a chunk edge counts as inside) Path props use this.
function shapeOnGuestPath(shape){
  const [cx, cy] = centroid(shape);
  return shape.every(([x, y]) => { const k = pathAt(x + (cx - x) * .01, y + (cy - y) * .01); return !!k && guestCell(k); });
}
// Did these chunks (keys) just join the entrance? (guests: guest and bridge chunks only)
function chunksJoined(keys, guests){
  const set = pathReach()[guests ? "G" : "A"];
  return keys.some(k => { const [x, y] = chunkXY(k); return set.has(cnum(x, y)); });
}
function buildStrips(C){
  const kindAt = new Map(), cells = [];
  for(const k of Object.keys(C)){ const [x, y] = cellXY(k); kindAt.set(pnum(x, y), C[k]); cells.push([x, y]); }
  const out = [];
  if(!cells.length) return {strips:out, kindAt};
  // the core: cells with path all round them out to 2.5 m. Thin leftovers nothing covers become core themselves.
  const core = new Set(), has = (x, y) => kindAt.has(pnum(x, y));
  for(const [x, y] of cells) if(STRIP_OFF.every(([dx, dy]) => has(x + dx, y + dy))) core.add(pnum(x, y));
  const extra = [], SQ = [];
  for(let dx = -2; dx <= 2; dx++) for(let dy = -2; dy <= 2; dy++) SQ.push([dx, dy]);
  for(const [x, y] of cells) if(!core.has(pnum(x, y)) && !SQ.some(([dx, dy]) => core.has(pnum(x + dx, y + dy)))) extra.push(pnum(x, y));
  for(const n of extra) core.add(n);
  const cls = n => kindAt.get(n) === "s" ? "s" : "g";
  const isCore = (x, y) => core.has(pnum(x, y));
  const edgeOk = (x, y, d) => {
    const [dx, dy] = d;
    if(!isCore(x + dx, y + dy)) return false;
    return !(dx && dy) || !(isCore(x + dx, y) || isCore(x, y + dy));   // a diagonal step only where the straight ones aren't there
  };
  const deg = (x, y) => { let n = 0; for(let dx = -1; dx <= 1; dx++) for(let dy = -1; dy <= 1; dy++) if((dx || dy) && isCore(x + dx, y + dy)) n++; return n; };
  const pt = (x, y) => [x + .5, y + .5];
  let id = 0;
  const strip = (cellsIn, pts, type, fe, pk2) => {
    const bridge = cellsIn.filter(n => kindAt.get(n) === "b").length * 2 >= cellsIn.length;
    const t = type || (cls(cellsIn[0]) === "s" ? "service" : bridge ? "bridge" : null);
    const p = {id:"pc" + (id++), d:1, name:"Path", points:pts, hw:PATH_HALF_WIDTH, pk:cellsIn[0]};
    if(t) p.type = t;
    if(pk2 !== undefined) p.pk2 = pk2;   // a link between a staff and a guest network is only live when both its ends are joined
    if(fe && (fe[0] || fe[1])) p.fe = fe;
    out.push(p);
  };
  const touched = new Set();
  // a free end runs on toward whatever is ahead: a path it meets, or just out to the end of the swath
  const reach = (run, end, d) => {
    const [x, y] = punum(end);
    if(deg(x, y) > 1) return null;
    for(let s = 1; s <= 5; s++){
      const nx = x + d[0] * s, ny = y + d[1] * s, m = pnum(nx, ny);
      if(!kindAt.has(m)) return {to:pt(x + d[0] * Math.max(0, Math.min(2, s - 1)), y + d[1] * Math.max(0, Math.min(2, s - 1)))};
      if(core.has(m)){
        if(cls(m) === cls(end)) return {to:pt(nx, ny)};
        return {link:[pt(x, y), pt(nx, ny)], from:end, other:m};   // a staff and a guest path that touch are joined for staff (a service link, live only when both ends are joined)
      }
    }
    return {to:pt(x + d[0] * 2, y + d[1] * 2)};
  };
  const close = (run, d) => {
    if(run.length < 2) return;
    const [fx, fy] = punum(run[0]), [lx, ly] = punum(run[run.length - 1]);
    let a = pt(fx, fy), b = pt(lx, ly);
    const e1 = reach(run, run[run.length - 1], d), e0 = reach(run, run[0], [-d[0], -d[1]]);
    if(e1 && e1.to) b = e1.to; else if(e1 && e1.link) strip([e1.from, e1.other], e1.link, "service", null, e1.other);
    if(e0 && e0.to) a = e0.to; else if(e0 && e0.link) strip([e0.from, e0.other], e0.link, "service", null, e0.other);
    strip(run, [a, b], null, [!!(e0 && e0.to), !!(e1 && e1.to)]);
  };
  for(const d of STRIP_DIRS) for(const n of core){
    const [x, y] = punum(n);
    if(!edgeOk(x, y, d)) continue;
    if(isCore(x - d[0], y - d[1]) && edgeOk(x - d[0], y - d[1], d)) continue;   // not the start of a chain
    let run = [n], cx = x, cy = y;
    touched.add(n);
    while(edgeOk(cx, cy, d)){
      const nx = cx + d[0], ny = cy + d[1], m = pnum(nx, ny);
      touched.add(m);
      if(cls(m) !== cls(run[run.length - 1])){
        close(run, d);
        strip([run[run.length - 1], m], [pt(cx, cy), pt(nx, ny)], "service", null, m);   // staff and guest paths meet: staff cross over, guests never use the link
        run = [m];
      } else run.push(m);
      cx = nx; cy = ny;
    }
    close(run, d);
  }
  for(const n of core) if(!touched.has(n)){ const [x, y] = punum(n); strip([n], [[x, y + .5], [x + 1, y + .5]]); }
  // a free end that stops short of a path beside it (round a corner, or at the end of a swath that meets another) is tied to it, if there is path all the way
  const solid = (a, b) => { let x = false; for(let i = 0; i <= 6; i++){ const n = pnum(Math.floor(a[0] + (b[0] - a[0]) * i / 6), Math.floor(a[1] + (b[1] - a[1]) * i / 6)); if(!kindAt.has(n)) return null; } return true; };
  for(const p of out.slice()) if(p.fe) p.fe.forEach((free, i) => {
    if(!free) return;
    const e = i ? p.points[p.points.length - 1] : p.points[0];
    let best = null;
    for(const q of out) if(q !== p && !q.link) for(let j = 1; j < q.points.length; j++){ const r = segProj(e[0], e[1], q.points[j-1], q.points[j]); if(!best || r.d < best.d) best = {...r, q}; }
    const sol = best && best.d >= 1.2 && best.d <= 4.5 && solid(e, [best.x, best.y]);
    if(!sol) return;
    const same = (best.q.type === "service") === (p.type === "service");
    const l = {id:"pc" + (id++), d:1, name:"Path", points:[e.slice(), [best.x, best.y]], hw:PATH_HALF_WIDTH, pk:p.pk, link:1};
    if(!same) l.pk2 = best.q.pk;
    if(p.type && same) l.type = p.type; else if(!same) l.type = "service";
    out.push(l);
  });
  return {strips:out, kindAt};
}
// Keep state.paths holding the derived strips for the current cells (and drop them from a stale list)
function syncPathStrips(){
  if(!state) return;
  if(!Object.prototype.hasOwnProperty.call(state, "toJSON"))
    Object.defineProperty(state, "toJSON", {value(){ const o = {...this}; o.paths = this.paths.filter(p => !p.d); return o; }, enumerable:false, configurable:true, writable:true});
  const C = pathChunks(), size = Object.keys(C).length, c = stripCache;
  if(c && c.state === state && c.paths === state.paths && c.chunks === C && c.ver === pathVer && c.size === size && state.paths.some(p => p.d) === (c.count > 0)) return;
  const L = state.paths;
  for(let i = L.length - 1; i >= 0; i--) if(L[i].d) L.splice(i, 1);
  const {strips} = buildStrips(chunkCells(C));
  L.push(...strips);
  stripCache = {state, paths:L, chunks:C, ver:pathVer, size, count:strips.length};
}
// The chunk number a strip's core cell (a cell number) sits in
const stripChunk = n => { const [x, y] = punum(n); return cnum(Math.floor(x / CHUNK), Math.floor(y / CHUNK)); };
// Which derived strips are joined to the entrance (guestsOnly: just the ones guests walk)
function joinedStrips(guestsOnly){
  syncPathStrips();
  const out = [], set = pathReach()[guestsOnly ? "G" : "A"];
  for(const p of state.paths) if(p.d && !(guestsOnly && isService(p)) && set.has(stripChunk(p.pk)) && (p.pk2 === undefined || set.has(stripChunk(p.pk2)))) out.push(p.id);
  return out;
}
