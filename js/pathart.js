/* Path rendering (P4 of the paths rework): ONE ground layer for every path square, textured and cut to the pixel grid.
   Reads only pathSquares() (pathcells.js), never state.pathChunks, so the chunk model can change underneath it.
   The layer is built once per change (pathVer, the square count and the chunks object, like chunksSvg used to) and drawn first in render's path pass,
   under fences, exhibits, props, plants, buildings, animals and people (all of which render later). */
// The tile for each kind: sprites/path/<tile>.png behind the #pt-<kind> pattern in index.html (12.48 m = 96 px at ROCK_MPP), and the edge colors
const PATH_TEX = {
  g:{lit:"#E4DDCB", dark:"#8C8470"},   // plain warm concrete
  s:{lit:"#7C8187", dark:"#34383C", seam:"#4A4F54"},   // dark asphalt
  b:{lit:"#D0A67A", dark:"#5E4429"},   // planks
};
const PATH_CAST = .16;   // opacity of the one-pixel shadow a path throws on the ground below and to its right
// The squares' union at the pixel grid: per kind, the body plus its lit (top and left) and dark (bottom and right) edge rows, and the shadow on bare ground.
// Edges are cut against the SAME kind only, so where a guest and a staff path (or a bridge) touch, each shows its own edge: a clear two pixel seam.
// Square edges are rounded to pixels the same way for neighbours, so side-by-side squares share their pixels with no gap.
function pathMask(squares){
  const P = ROCK_MPP, rows = {}, all = new Map();
  const join = runs => { runs.sort((p, q) => p[0] - q[0]); const out = []; for(const s of runs){ const t = out[out.length - 1]; if(t && s[0] <= t[1]) t[1] = Math.max(t[1], s[1]); else out.push([...s]); } return out; };
  const raw = {};
  for(const q of squares){
    const x0 = Math.round(q.x / P), x1 = Math.round((q.x + q.w) / P), r0 = Math.round(q.y / P), r1 = Math.round((q.y + q.h) / P), m = raw[q.kind] || (raw[q.kind] = new Map());
    for(let r = r0; r < r1; r++){ if(!m.has(r)) m.set(r, []); m.get(r).push([x0, x1]); }
  }
  const allRaw = new Map();
  for(const k in raw){ rows[k] = new Map(); for(const [r, runs] of raw[k]){ rows[k].set(r, join(runs)); if(!allRaw.has(r)) allRaw.set(r, []); for(const s of rows[k].get(r)) allRaw.get(r).push([...s]); } }
  for(const [r, runs] of allRaw) all.set(r, join(runs));
  const minus = (run, others) => { let out = [run]; for(const [oa, ob] of others) out = out.flatMap(([a, b]) => oa >= b || ob <= a ? [[a, b]] : [[a, Math.min(b, oa)], [Math.max(a, ob), b]].filter(([x, y]) => y > x)); return out; };
  // rects from rows of runs; a run identical to the one above it just makes the rect taller, so a big flat path is a few rects, not one a pixel row
  const paint = map => {
    let d = "", open = new Map();   // "a,b" -> {r0, r1} still growing
    const rs = [...map.keys()].sort((p, q) => p - q), flush = (r, keep) => { for(const [key, o] of open) if(!keep || !keep.has(key)){ const [a, b] = key.split(",").map(Number); d += `M${(a * P).toFixed(2)} ${(o.r0 * P).toFixed(2)}h${((b - a) * P).toFixed(2)}v${((o.r1 - o.r0) * P).toFixed(2)}h${(-(b - a) * P).toFixed(2)}z`; open.delete(key); } };
    let prev = null;
    for(const r of rs){
      if(prev !== null && r !== prev + 1) flush(r);
      const cur = new Set(map.get(r).map(([a, b]) => a + "," + b));
      flush(r, cur);
      for(const key of cur){ const o = open.get(key); if(o) o.r1 = r + 1; else open.set(key, {r0:r, r1:r + 1}); }
      prev = r;
    }
    flush(0);
    return d;
  };
  const by = {};
  for(const k in rows){
    const m = rows[k], lit = new Map(), dark = new Map(), add = (map, r, a, b) => { if(!map.has(r)) map.set(r, []); map.get(r).push([a, b]); };
    for(const [r, runs] of m) for(const [a, b] of runs){
      for(const [x, y] of minus([a, b], m.get(r - 1) || [])) add(lit, r, x, y);   // top edge, where this kind has nothing above
      for(const [x, y] of minus([a, b], m.get(r + 1) || [])) add(dark, r, x, y);  // bottom edge, likewise
      add(lit, r, a, a + 1); add(dark, r, b - 1, b);                              // left and right ends of every run
    }
    const clean = map => { const o = new Map(); for(const [r, runs] of map) o.set(r, join(runs)); return o; };
    // a pixel that is both lit and dark (a corner) stays dark, painted after
    by[k] = {body:paint(m), lit:paint(clean(lit)), dark:paint(clean(dark))};
  }
  // asphalt pour seams: a dashed dark line along every border between two staff chunks, so the pattern sits inside each 5 m chunk
  if(by.s){
    const have = new Set(squares.filter(q => q.kind === "s").map(q => q.cx + "," + q.cy)), seam = new Map(), put = (r, a) => { if(!seam.has(r)) seam.set(r, []); seam.get(r).push([a, a + 1]); };
    for(const q of squares){
      if(q.kind !== "s") continue;
      const x0 = Math.round(q.x / P), x1 = Math.round((q.x + q.w) / P), r0 = Math.round(q.y / P), r1 = Math.round((q.y + q.h) / P);
      if(have.has((q.cx + 1) + "," + q.cy)) for(let r = r0; r < r1; r++) if((r - r0) % 8 < 6) put(r, x1 - 1);
      if(have.has(q.cx + "," + (q.cy + 1))) for(let x = x0; x < x1; x++) if((x - x0) % 8 < 6) put(r1 - 1, x);
    }
    by.s.seam = paint(new Map([...seam].map(([r, runs]) => [r, join(runs)])));
  }
  // shadow on bare ground: the row below each bottom edge (shifted a pixel right) and the column beside each right end
  const cast = new Map(), addc = (r, a, b) => { if(b <= a) return; if(!cast.has(r)) cast.set(r, []); cast.get(r).push([a, b]); };
  for(const [r, runs] of all) for(const [a, b] of runs){
    for(const [x, y] of minus([a + 1, b + 1], all.get(r + 1) || [])) addc(r + 1, x, y);
    addc(r, b, b + 1);
  }
  const castRows = new Map(); for(const [r, runs] of cast){ const j = join(runs), free = j.flatMap(s => minus(s, all.get(r) || [])); if(free.length) castRows.set(r, free); }
  return {kinds:Object.keys(rows), by, cast:paint(castRows)};
}
let pathLayer = null;
// The whole path layer as SVG, rebuilt only when the squares change
function pathLayerSvg(){
  const C = pathChunks(), size = Object.keys(C).length;
  if(pathLayer && pathLayer.chunks === C && pathLayer.ver === pathVer && pathLayer.size === size) return pathLayer.svg;
  const m = pathMask(pathSquares()), order = ["s", "g", "b"].filter(k => m.by[k]);
  let svg = `<g id="pathLayer" pointer-events="none" shape-rendering="crispEdges">`;
  if(m.cast) svg += `<path d="${m.cast}" fill="#000" fill-opacity="${PATH_CAST}"/>`;
  for(const k of order) svg += `<path d="${m.by[k].body}" fill="${PATH_CELLS.kinds[k].color}"/><path d="${m.by[k].body}" fill="url(#pt-${k})"/>${m.by[k].seam ? `<path d="${m.by[k].seam}" fill="${PATH_TEX[k].seam}"/>` : ""}<path d="${m.by[k].lit}" fill="${PATH_TEX[k].lit}"/><path d="${m.by[k].dark}" fill="${PATH_TEX[k].dark}"/>`;
  svg += `</g>`;
  pathLayer = {chunks:C, ver:pathVer, size, svg, builds:(pathLayer ? pathLayer.builds : 0) + 1};
  return svg;
}
