/* =====================================================================
   PATHS AS CELLS
   A path is a set of 1 m grid cells in state.pathCells, keyed "x,y" (the square from x,y to x+1,y+1) with a
   kind: g guest path, s staff path, b wooden bridge. Every path is PATH_CELLS.width (5) m wide; lay two side by
   side and they merge into one wide path. A drag lays a 5 m swath along a straight or 45 degree run
   (pathSwath, planPath, layPath), like the fence tool. Tram track is not cells: it stays in state.paths as lines.
   state.pathFixed holds the cells of the entrance walk, which can't be bulldozed.

   Compatibility layer (until the connectivity and navigation rework): the rest of the game still reads
   state.paths as lines, so syncPathStrips() derives strip polylines from the cells (flagged d:1, 5 m wide through
   hw: 2.5, never saved) and keeps them in state.paths. A strip is a straight run along the "core" of the cells
   (cells whose whole 2.5 m surroundings are path), so a 5 m swath is its center line.
   ===================================================================== */

let pathVer = 0;   // bumped whenever the cells change, so the derived strips know to rebuild
const cellKey = (x, y) => x + "," + y;
const pathCells = () => state.pathCells || (state.pathCells = {});
const pathFixedCells = () => state.pathFixed || (state.pathFixed = {});
const pathKind = (x, y) => pathCells()[cellKey(x, y)] || null;
const pathAt = (wx, wy) => pathKind(Math.floor(wx), Math.floor(wy));
const pathCellCost = k => PATH_CELLS.kinds[k].perMeter / PATH_CELLS.width;
const pathCellUpkeep = k => PATH_CELLS.kinds[k].upkeepPerMeter / PATH_CELLS.width;
const cellXY = k => k.split(",").map(Number);
const cellRect = (x, y) => [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]];

/* ---------- the run a drag lays ---------- */
// Cells a drag from cell a toward cell b covers: a 5 m swath along the nearest straight or diagonal run
function pathSwath(a, b){
  const dx = b[0] - a[0], dy = b[1] - a[1];
  if(!dx && !dy) return {end:a, cells:[]};
  const o = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)), sx = Math.round(Math.cos(o * Math.PI / 4)), sy = Math.round(Math.sin(o * Math.PI / 4));
  const diag = sx && sy, n = diag ? Math.round((Math.abs(dx) + Math.abs(dy)) / 2) : sx ? Math.abs(dx) : Math.abs(dy), cells = [];
  const half = PATH_CELLS.width >> 1;
  if(!diag){
    const px = -sy, py = sx;
    for(let i = 0; i <= n; i++) for(let p = -half; p <= half; p++) cells.push([a[0] + sx * i + px * p, a[1] + sy * i + py * p]);
  } else {
    // cells whose center is within 2.5 m of the center line, between the two end caps (7 across a row, about 5 m square on)
    const x0 = Math.min(0, n * sx) - 3, x1 = Math.max(0, n * sx) + 3, y0 = Math.min(0, n * sy) - 3, y1 = Math.max(0, n * sy) + 3;
    for(let u = x0; u <= x1; u++) for(let v = y0; v <= y1; v++){
      const t = u * sx + v * sy, q = -sy * u + sx * v;
      if(t >= 0 && t <= 2 * n && Math.abs(q) <= 3) cells.push([a[0] + u, a[1] + v]);
    }
  }
  return {end:[a[0] + sx * n, a[1] + sy * n], cells};
}

/* ---------- checking a run ---------- */
// What is in the way of cells, gathered once for a whole run
function pathCtx(){
  const box = pts => { const b = bbox(pts); return {pts, x0:b.x0 - 1, y0:b.y0 - 1, x1:b.x1 + 1, y1:b.y1 + 1}; };
  const diag = new Set();
  for(const k of Object.keys(fencePieces())){ const [x, y, d] = k.split(","); if(d === "d" || d === "a") diag.add(x + "," + y); }
  return {
    ex: state.exhibits.map(e => ({...box(e.points), name:e.name})),
    bl: state.buildings.filter(b => !BUILDINGS[b.type].onPath).map(b => box(b.points)),
    water: parkWater().map(w => box(w.points)),
    decor: decorOf().filter(f => LAND[f.type]).map(f => ({x:f.x, y:f.y, r:footR(LAND[f.type]) * .5})),
    lines: (state.fences || []).map(l => l.points),
    diag
  };
}
const hitsBox = (o, x, y) => x + 1 > o.x0 && x < o.x1 && y + 1 > o.y0 && y < o.y1;
// Why one cell can't be a path of this kind, or null
function pathCellProblem(x, y, kind, ctx){
  const e = .02;
  for(const [px, py] of [[x + e, y + e], [x + 1 - e, y + e], [x + 1 - e, y + 1 - e], [x + e, y + 1 - e]]) if(!inOwned(px, py, 0)) return "Keep it inside the park boundary.";
  const r = cellRect(x, y);
  for(const o of ctx.ex) if(hitsBox(o, x, y) && shapesOverlap(r, o.pts)) return "Paths can't go through an exhibit.";
  for(const o of ctx.bl) if(hitsBox(o, x, y) && shapesOverlap(r, o.pts)) return "Paths can't go through a building.";
  if(kind !== "b") for(const o of ctx.water) if(hitsBox(o, x, y) && (shapesOverlap(r, o.pts) || shapesOverlap(o.pts, r))) return "Paths can't cross water. Lay a wooden bridge over it.";
  for(const f of ctx.decor) if(f.x > x - f.r && f.x < x + 1 + f.r && f.y > y - f.r && f.y < y + 1 + f.r && Math.hypot(f.x - clamp(f.x, x, x + 1), f.y - clamp(f.y, y, y + 1)) < f.r) return "It runs into a plant, rock or statue. Bulldoze it first.";
  if(ctx.diag.has(x + "," + y)) return "It runs into a fence.";
  for(const l of ctx.lines) if(lineEntersShape(l, r)) return "It runs into a fence.";
  return null;
}
// Is there a straight fence piece on the edge between two neighboring cells?
function fenceBetween(x, y, nx, ny){
  const P = fencePieces();
  return nx !== x ? !!P[pieceKey(Math.max(x, nx), y, "v")] : !!P[pieceKey(x, Math.max(y, ny), "h")];
}
// What laying a swath from cell a to cell b would do: {cells (every cell of the run), todo (the ones that change), bad (cell key to reason), cost, why}
function planPath(a, b, kind){
  const C = pathCells(), sw = pathSwath(a, b), out = {cells:sw.cells.map(c => cellKey(c[0], c[1])), todo:[], bad:new Map(), cost:0, why:"", end:sw.end, kind};
  if(!sw.cells.length) return out;
  out.todo = out.cells.filter(k => C[k] !== kind && !(kind === "s" && C[k]));   // a staff path never takes over a guest path or bridge
  if(!out.todo.length){ out.why = "That path is already there."; return out; }
  const ctx = pathCtx(), run = new Set(out.cells);
  for(const k of out.todo){
    const [x, y] = cellXY(k);
    let why = pathCellProblem(x, y, kind, ctx);
    if(!why) for(const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]){
      const n = cellKey(x + dx, y + dy);
      if((run.has(n) || C[n]) && fenceBetween(x, y, x + dx, y + dy)){ why = "It runs into a fence."; break; }
    }
    if(why) out.bad.set(k, why);
  }
  out.cost = Math.round(out.todo.reduce((s, k) => s + pathCellCost(kind), 0));
  if(out.bad.size) out.why = out.bad.values().next().value;
  else if(!canAfford(out.cost)) out.why = `Costs ${money(out.cost)}. You have ${money(state.money)}.`;
  return out;
}
// Lay a swath; returns {n, cost} or null if it can't go there
function layPath(a, b, kind){
  const plan = planPath(a, b, kind);
  if(plan.why || !plan.todo.length) return null;
  spend(plan.cost, "built");
  const C = pathCells();
  for(const k of plan.todo) C[k] = kind;
  pathVer++;
  return {n:plan.todo.length, cost:plan.cost};
}
// Take cells away (not the entrance walk); gives back the refund share of what each cost
function removeCells(keys){
  const C = pathCells(), F = pathFixedCells();
  let n = 0, back = 0, kept = 0;
  for(const k of keys){
    if(!C[k]) continue;
    if(F[k]){ kept++; continue; }
    back += pathCellCost(C[k]) * COST.refundShare; delete C[k]; n++;
  }
  if(n){ pathVer++; back = Math.round(back); earn(back, "sold"); }
  return {n, back, kept};
}
const cellsInBox = (a, b) => {
  const x0 = Math.floor(Math.min(a[0], b[0])), x1 = Math.floor(Math.max(a[0], b[0])), y0 = Math.floor(Math.min(a[1], b[1])), y1 = Math.floor(Math.max(a[1], b[1])), C = pathCells(), out = [];
  if(a[0] === b[0] && a[1] === b[1]) return C[cellKey(x0, y0)] ? [cellKey(x0, y0)] : [];
  for(let x = x0; x <= x1; x++) for(let y = y0; y <= y1; y++){ const k = cellKey(x, y); if(C[k] && x + .5 >= Math.min(a[0], b[0]) && x + .5 <= Math.max(a[0], b[0]) && y + .5 >= Math.min(a[1], b[1]) && y + .5 <= Math.max(a[1], b[1])) out.push(k); }
  return out;
};

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
// Turn the line paths of a save into cells (tram track stays a line). Land that isn't owned is left out.
function migratePaths(s){
  s.pathCells = s.pathCells || {}; s.pathFixed = s.pathFixed || {};
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
      const key = cellKey(x, y), old = s.pathCells[key];
      if(!old || rank[k] >= rank[old]) s.pathCells[key] = k;
      if(p.fixed) s.pathFixed[key] = 1;
    }
  }
  s.paths = s.paths.filter(p => p.type === "tram");
  pathVer++;
}
// The entrance walk of a new park: 5 m wide from the gate north to the first bend
function mainWalkCells(gate){
  const C = {}, F = {}, x0 = Math.floor(gate[0]) - 2;
  for(let x = x0; x < x0 + 5; x++) for(let y = 235; y < gate[1]; y++){ C[cellKey(x, y)] = "g"; F[cellKey(x, y)] = 1; }
  return {C, F};
}

/* ---------- the compatibility layer: strips for code that still reads state.paths ---------- */
const STRIP_OFF = (() => { const o = []; for(let dx = -2; dx <= 2; dx++) for(let dy = -2; dy <= 2; dy++) if((dx || dy) && dx * dx + dy * dy <= 6.25) o.push([dx, dy]); return o; })();
const STRIP_DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];
const pnum = (x, y) => (x + 2048) * 8192 + (y + 2048);
const punum = n => [Math.floor(n / 8192) - 2048, n % 8192 - 2048];
let stripCache = null;   // {state, paths, cells, ver, size, reachG, reachA}

// Cells joined to the entrance: guests walk guest and bridge cells, staff use every kind
function floodCells(kindAt, gate, guestsOnly){
  const seen = new Set(), queue = [];
  for(const [n, k] of kindAt){
    if(guestsOnly && k === "s") continue;
    const [x, y] = punum(n);
    if(Math.hypot(x + .5 - gate[0], y + .5 - gate[1]) <= 3){ seen.add(n); queue.push(n); }
  }
  while(queue.length){
    const n = queue.pop(), [x, y] = punum(n);
    for(const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]){
      const m = pnum(x + dx, y + dy);
      if(seen.has(m) || !kindAt.has(m) || (guestsOnly && kindAt.get(m) === "s")) continue;
      seen.add(m); queue.push(m);
    }
  }
  return seen;
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
  const strip = (cellsIn, pts, type, fe) => {
    const bridge = cellsIn.filter(n => kindAt.get(n) === "b").length * 2 >= cellsIn.length;
    const t = type || (cls(cellsIn[0]) === "s" ? "service" : bridge ? "bridge" : null);
    const p = {id:"pc" + (id++), d:1, name:"Path", points:pts, hw:PATH_HALF_WIDTH, pk:cellsIn[0]};
    if(t) p.type = t;
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
      if(core.has(m)) return cls(m) === cls(end) ? {to:pt(nx, ny)} : {link:[pt(x, y), pt(nx, ny)], from:end, other:m};
    }
    return {to:pt(x + d[0] * 2, y + d[1] * 2)};
  };
  const close = (run, d) => {
    if(run.length < 2) return;
    const [fx, fy] = punum(run[0]), [lx, ly] = punum(run[run.length - 1]);
    let a = pt(fx, fy), b = pt(lx, ly);
    const e1 = reach(run, run[run.length - 1], d), e0 = reach(run, run[0], [-d[0], -d[1]]);
    if(e1 && e1.to) b = e1.to; else if(e1 && e1.link) strip([e1.from, e1.other], e1.link, "service");
    if(e0 && e0.to) a = e0.to; else if(e0 && e0.link) strip([e0.from, e0.other], e0.link, "service");
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
        strip([run[run.length - 1], m], [pt(cx, cy), pt(nx, ny)], "service");   // staff and guest paths meet: only staff cross
        run = [m];
      } else run.push(m);
      cx = nx; cy = ny;
    }
    close(run, d);
  }
  for(const n of core) if(!touched.has(n)){ const [x, y] = punum(n); strip([n], [[x, y + .5], [x + 1, y + .5]]); }
  // a free end that stops short of a path beside it (round a corner, or at the end of a swath that meets another) is tied to it, if there is path all the way
  const solid = (a, b) => { for(let i = 0; i <= 6; i++) if(!kindAt.has(pnum(Math.floor(a[0] + (b[0] - a[0]) * i / 6), Math.floor(a[1] + (b[1] - a[1]) * i / 6)))) return false; return true; };
  for(const p of out.slice()) if(p.fe) p.fe.forEach((free, i) => {
    if(!free) return;
    const e = i ? p.points[p.points.length - 1] : p.points[0];
    let best = null;
    for(const q of out) if(q !== p && !q.link) for(let j = 1; j < q.points.length; j++){ const r = segProj(e[0], e[1], q.points[j-1], q.points[j]); if(!best || r.d < best.d) best = {...r, q}; }
    if(!best || best.d < 1.2 || best.d > 4.5 || !solid(e, [best.x, best.y])) return;
    const same = (best.q.type === "service") === (p.type === "service"), l = {id:"pc" + (id++), d:1, name:"Path", points:[e.slice(), [best.x, best.y]], hw:PATH_HALF_WIDTH, pk:p.pk, link:1};
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
  const C = pathCells(), size = Object.keys(C).length, c = stripCache;
  if(c && c.state === state && c.paths === state.paths && c.cells === C && c.ver === pathVer && c.size === size && state.paths.some(p => p.d) === (c.count > 0)) return;
  const L = state.paths;
  for(let i = L.length - 1; i >= 0; i--) if(L[i].d) L.splice(i, 1);
  const {strips, kindAt} = buildStrips(C);
  L.push(...strips);
  stripCache = {state, paths:L, cells:C, ver:pathVer, size, count:strips.length, reachG:floodCells(kindAt, state.gate, true), reachA:floodCells(kindAt, state.gate, false)};
}
// Which derived strips are joined to the entrance (guestsOnly: just the ones guests walk)
function joinedStrips(guestsOnly){
  syncPathStrips();
  const out = [], set = guestsOnly ? stripCache.reachG : stripCache.reachA;
  for(const p of state.paths) if(p.d && !(guestsOnly && isService(p)) && set.has(p.pk)) out.push(p.id);
  return out;
}
// Did these cells just join the entrance? (guests: guest and bridge cells only)
function cellsJoined(keys, guests){
  syncPathStrips();
  const set = guests ? stripCache.reachG : stripCache.reachA;
  return keys.some(k => { const [x, y] = cellXY(k); return set.has(pnum(x, y)); });
}
