/* ---------- paths as tiles, like Zoo Tycoon ----------
   The park's paths are a set of 5 m squares on the 5 m grid: state.tiles {"cx,cy": {k, t, fixed}} (cell cx,cy covers x from cx*5 to cx*5+5).
   k is the kind (foot, wide, service, tram, bridge), t an optional theme. Tiles join up with their four neighbours; there are no free-form lines.
   The rest of the game still thinks in lines (guest and staff graphs, reach, buildings facing a path), so syncPaths() derives state.paths from the tiles:
   one line through the tile centers for each straight-or-bending chain, ending at the tile edge, so every line is a plain {id, type, theme, points} the old code reads.
   Never edit state.paths for building: change state.tiles (layTiles / liftTiles) and the lines follow. Loads after sim.js. */

const TILE = 5;
const TILE_KINDS = {
  foot:    {name:"Path",         type:undefined},
  wide:    {name:"Wide path",    type:"wide"},
  service: {name:"Service road", type:"service"},
  tram:    {name:"Tram track",   type:"tram"},
  bridge:  {name:"Wooden bridge", type:"bridge"}
};
const tileKey = (cx, cy) => cx + "," + cy;
const tileXY = key => key.split(",").map(Number);
const tileAt = (x, y) => [Math.floor(x / TILE), Math.floor(y / TILE)];
const tileCenter = (cx, cy) => [cx * TILE + TILE / 2, cy * TILE + TILE / 2];
const tileRect = (cx, cy, inset = 0) => [[cx*TILE + inset, cy*TILE + inset], [(cx+1)*TILE - inset, cy*TILE + inset], [(cx+1)*TILE - inset, (cy+1)*TILE - inset], [cx*TILE + inset, (cy+1)*TILE - inset]];
const tileList = () => Object.keys(state.tiles || {});
const tileCost = k => Math.round(TILE * (k === "service" ? SERVICE_ROAD.perMeter : k === "wide" ? WIDE_PATH.perMeter : k === "tram" ? TRAM.perMeter : k === "bridge" ? BRIDGE.perMeter : COST.pathPerMeter));
// What the tiles of one line cost to build (and so refund): by count, not by the line's length
const tilesCost = p => (p.tiles || []).reduce((n, key) => n + tileCost((state.tiles[key] || {k:"foot"}).k), 0);
// Tram track only joins tram track. Everything else walkable (footpaths, wide paths, service roads, bridges) joins its neighbours, whatever the kind or theme.
const tilesLink = (a, b) => (a.k === "tram") === (b.k === "tram");
const tileClass = t => t.k + "|" + (t.t || "") + (t.fixed ? "|fixed" : "");   // the fixed main walk is a line of its own, so a path joined to it selects and lifts by itself
let tilePath = {};   // tile key -> id of the line it belongs to (not saved, rebuilt by syncPaths)

function syncPaths(s = state){
  const T = s.tiles || {}, byClass = {}, out = [];
  if(s === state) tilePath = {};
  for(const key of Object.keys(T)) (byClass[tileClass(T[key])] ||= []).push(key);
  const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]], H = TILE / 2;
  for(const cls of Object.keys(byClass)){
    const keys = byClass[cls], inC = new Set(keys), t0 = T[keys[0]], adj = new Map(), pos = new Map();
    const node = (id, p) => { if(!adj.has(id)){ adj.set(id, []); pos.set(id, p); } return id; };
    const edge = (a, b) => { adj.get(a).push(b); adj.get(b).push(a); };
    for(const key of keys){
      const [cx, cy] = tileXY(key), c = tileCenter(cx, cy); node(key, c);
      for(const [dx, dy] of DIRS){
        const nk = tileKey(cx + dx, cy + dy), nt = T[nk]; if(!nt) continue;
        if(inC.has(nk)){ if(dx > 0 || dy > 0){ node(nk, tileCenter(cx + dx, cy + dy)); edge(key, nk); } }
        else if(tilesLink(t0, nt)){ const mid = [c[0] + dx * H, c[1] + dy * H]; edge(key, node("m" + mid[0] + "," + mid[1], mid)); }   // meets another kind of tile: both lines end at the shared edge
      }
    }
    for(const key of keys){   // a loose end runs on to the far edge of its tile, so the line covers the whole tile
      const ns = adj.get(key), c = pos.get(key);
      if(ns.length === 0){ edge(key, node("e" + key + "a", [c[0] - H, c[1]])); edge(key, node("e" + key + "b", [c[0] + H, c[1]])); }
      else if(ns.length === 1){ const q = pos.get(ns[0]), dx = Math.sign(q[0] - c[0]), dy = Math.sign(q[1] - c[1]); edge(key, node("e" + key, [c[0] - dx * H, c[1] - dy * H])); }
    }
    const seen = new Set(), ek = (a, b) => a < b ? a + "|" + b : b + "|" + a;
    const walk = (start, next) => {
      const ids = [start, next]; seen.add(ek(start, next));
      let prev = start, cur = next;
      while(adj.get(cur).length === 2 && cur !== start){
        const [x, y] = adj.get(cur), nx = x === prev ? y : x;
        if(seen.has(ek(cur, nx))) break;
        seen.add(ek(cur, nx)); ids.push(nx); prev = cur; cur = nx;
      }
      return ids;
    };
    const emit = ids => {
      const tiles = ids.filter(id => T[id] && inC.has(id)), id = "pt:" + cls + ":" + ids[0] + ">" + ids[1];
      const p = {id, name:TILE_KINDS[t0.k].name, points:ids.map(i => pos.get(i).slice()), tiles};
      if(TILE_KINDS[t0.k].type) p.type = TILE_KINDS[t0.k].type;
      if(t0.t) p.theme = t0.t;
      if(tiles.some(k => T[k].fixed)) p.fixed = true;
      out.push(p);
      if(s === state) for(const k of tiles) if(!tilePath[k]) tilePath[k] = id;
    };
    for(const [id, ns] of adj) if(ns.length !== 2) for(const n of ns) if(!seen.has(ek(id, n))) emit(walk(id, n));
    for(const [id, ns] of adj) for(const n of ns) if(!seen.has(ek(id, n))) emit(walk(id, n));   // closed loops
  }
  s.paths = out;
}

// Old saves drew paths as lines. Turn each into the tiles it passes over, with a tile added at any diagonal step so the run stays joined.
function tilesFromPaths(paths){
  const T = {}, rank = {foot:3, wide:3, bridge:4, tram:2, service:1};
  const put = (cx, cy, k, p) => {
    const key = tileKey(cx, cy), old = T[key];
    if(old && rank[old.k] >= rank[k]) return;
    T[key] = {k}; if(p.theme) T[key].t = p.theme; if(p.fixed) T[key].fixed = true;
  };
  for(const p of paths){
    const k = p.type === "wide" ? "wide" : p.type || "foot", hw = p.type === "wide" ? 2.5 : 0;
    let last = null;
    for(let i = 1; i < p.points.length; i++){
      const a = p.points[i-1], b = p.points[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / .5)), nx = L ? -(b[1] - a[1]) / L : 0, ny = L ? (b[0] - a[0]) / L : 0;
      for(let j = 0; j <= n; j++){
        const x = a[0] + (b[0] - a[0]) * j / n, y = a[1] + (b[1] - a[1]) * j / n;
        const [cx, cy] = tileAt(x + (b[0] - a[0]) * 1e-6, y + (b[1] - a[1]) * 1e-6);
        if(last && last[0] !== cx && last[1] !== cy) put(cx, last[1], k, p);   // a diagonal step: add the cell beside it
        put(cx, cy, k, p); last = [cx, cy];
        if(hw){ for(const sg of [-1, 1]){ const [wx, wy] = tileAt(x + nx * hw * sg, y + ny * hw * sg); put(wx, wy, k, p); } }
      }
    }
  }
  return T;
}

// Why a tile of this kind can't go here, or null
function tileProblem(cx, cy, k){
  if(k === "tram" && !hasTech("transit")) return `Research ${TECH.find(x => x.id === "transit").label.toLowerCase()} at ORACLE first.`;
  const sq = tileRect(cx, cy), inner = tileRect(cx, cy, .3);
  if(!insidePlot(sq, true)) return "Keep it inside the park boundary.";
  if(state.exhibits.some(e => shapesOverlap(inner, e.points) || shapesOverlap(e.points, inner))) return "Paths can't go through an exhibit.";
  if(state.buildings.some(b => !BUILDINGS[b.type].onPath && (shapesOverlap(inner, b.points) || shapesOverlap(b.points, inner)))) return "Paths can't go through a building.";
  if(k !== "bridge" && parkWater().some(w => shapesOverlap(inner, w.points) || shapesOverlap(w.points, inner))) return "Paths can't cross water. Lay a wooden bridge over it.";
  if(decorOf().some(f => LAND[f.type] && (inPoly(f.x, f.y, sq) || distToEdge(f.x, f.y, sq) < footR(LAND[f.type]) * .5))) return "It runs into a plant, rock or statue. Bulldoze it first.";
  if(parkFences().some(l => lineEntersShape(l.points, inner))) return "A fence runs through it.";
  return null;
}
// Does a shape sit on any path tile (for buildings, plants and fence that must keep off them)? A shape of an `onPath` thing is fine.
function tilesHit(pts){
  const T = state.tiles; if(!T) return false;
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  for(let cx = Math.floor(Math.min(...xs) / TILE); cx <= Math.floor(Math.max(...xs) / TILE); cx++)
    for(let cy = Math.floor(Math.min(...ys) / TILE); cy <= Math.floor(Math.max(...ys) / TILE); cy++)
      if(T[tileKey(cx, cy)]){ const sq = tileRect(cx, cy, .05); if(shapesOverlap(pts, sq) || shapesOverlap(sq, pts)) return true; }
  return false;
}

// Is the point inside a path tile (not just on its edge)? And does a fence piece from a to b run through one?
function tileUnder(x, y){
  const T = state.tiles; if(!T) return false;
  const [cx, cy] = tileAt(x, y); if(!T[tileKey(cx, cy)]) return false;
  const fx = x - cx * TILE, fy = y - cy * TILE;
  return fx > .05 && fx < TILE - .05 && fy > .05 && fy < TILE - .05;
}
const tilesHitSeg = (a, b) => tileUnder(a[0], a[1]) || tileUnder(b[0], b[1]) || tileUnder((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
// Is any tile's center inside this polygon (a pen that would fence a path in)?
const tilesInside = P => Object.keys(state.tiles || {}).some(k => { const [cx, cy] = tileXY(k), c = tileCenter(cx, cy); return inPoly(c[0], c[1], P); });

// The cells a drag from cell a to cell b lays: straight, or a staircase at 45°, like fence runs
function tileLine(a, b){
  const dx = b[0] - a[0], dy = b[1] - a[1];
  if(!dx && !dy) return [a];
  const o = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)), sx = Math.round(Math.cos(o * Math.PI / 4)), sy = Math.round(Math.sin(o * Math.PI / 4));
  const n = sx && sy ? Math.round((Math.abs(dx) + Math.abs(dy)) / 2) : sx ? Math.abs(dx) : Math.abs(dy);
  const cells = [a]; let [x, y] = a;
  for(let i = 0; i < n; i++){ x += sx; if(sx && sy) cells.push([x, y]); y += sy; cells.push([x, y]); }
  return cells;
}

// Lay tiles (already checked). Tiles that are already this kind and theme cost nothing. Returns what was built.
function layTiles(cells, k, theme){   // cells are [cx, cy] or [cx, cy, theme]
  state.tiles ||= {};
  const built = [];
  for(const c of cells){
    const [cx, cy] = c, th = c[2] === undefined ? theme : c[2], key = tileKey(cx, cy), old = state.tiles[key];
    if(old && old.k === k && (old.t || "") === (th || "")) continue;
    if(old && old.fixed) continue;
    const t = {k}; if(th) t.t = th;
    state.tiles[key] = t; built.push(key);
  }
  syncPaths();
  return built;
}
function liftTiles(keys){
  let n = 0, back = 0;
  for(const key of keys){ const t = state.tiles[key]; if(!t || t.fixed) continue; back += Math.round(tileCost(t.k) * COST.refundShare); delete state.tiles[key]; n++; }
  syncPaths();
  return {n, back};
}

// A line's theme (set from its panel, or by restyling a zone) goes back onto its tiles, and the lines are made again
function pushThemesToTiles(){
  for(const p of state.paths){
    if(!p.tiles) continue;
    for(const k of p.tiles){ const t = state.tiles[k]; if(!t) continue; if(p.theme) t.t = p.theme; else delete t.t; }
  }
  syncPaths();
}
