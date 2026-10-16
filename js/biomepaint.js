/* Biome paint: decoration for the park ground outside exhibits.
   state.biomePaint is a list of patches {id, biome, r:[x0,y0,x1,y1]} on the 1 m grid, drawn in list order (later paints over earlier).
   It only changes how the ground looks (the park's own biome, state.biome, stays locked). Painting keeps the list short: a patch that is
   fully covered is deleted, a partly covered one is trimmed when what is left is still one rectangle, and touching patches of the same
   biome merge when nothing painted above them is in the way. Drawing is clipped to the owned land (#plotClip) and cached. */
const PAINT = {max:400};
let paintVer = 0, paintCache = null;   // paintVer bumps on every change so the drawn string is rebuilt only then
const paintList = () => state.biomePaint || (state.biomePaint = []);
const paintTouch = () => { paintVer++; };
const rectOverlap = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
const rectCovers = (a, b) => a[0] <= b[0] && a[1] <= b[1] && a[2] >= b[2] && a[3] >= b[3];
const rectArea = r => (r[2] - r[0]) * (r[3] - r[1]);
// Paint and water go down in whole 5 m chunks, like paths. The box between two chunks (cx, cy), both included, as [x0, y0, x1, y1] in meters
const paintBox = (a, b) => [Math.min(a[0], b[0]) * CHUNK, Math.min(a[1], b[1]) * CHUNK, (Math.max(a[0], b[0]) + 1) * CHUNK, (Math.max(a[1], b[1]) + 1) * CHUNK];
// the same from two world points (every chunk the box touches)
const paintBoxW = (a, b) => paintBox(chunkAt(a[0], a[1]), chunkAt(b[0], b[1]));
// the part of a box over land the player owns, or null
function paintClip(r){
  const b = ownedBox(), c = [Math.max(r[0], b.x0), Math.max(r[1], b.y0), Math.min(r[2], b.x1), Math.min(r[3], b.y1)];
  if(c[2] - c[0] < GRID_STEP || c[3] - c[1] < GRID_STEP) return null;
  return ownedRects().some(o => rectOverlap(c, o)) ? c : null;
}
// A rectangle of the same biome that, joined with r, is still one rectangle (same span and touching), or null
function paintUnion(a, b){
  if(a[0] === b[0] && a[2] === b[2] && a[1] <= b[3] && b[1] <= a[3]) return [a[0], Math.min(a[1], b[1]), a[2], Math.max(a[3], b[3])];
  if(a[1] === b[1] && a[3] === b[3] && a[0] <= b[2] && b[0] <= a[2]) return [Math.min(a[0], b[0]), a[1], Math.max(a[2], b[2]), a[3]];
  return null;
}
// Paint a box. Returns {removed, merged} or a string saying why not.
function paintRect(biome, box){
  if(!BIOMES[biome]) return "Pick a biome to paint.";
  const r = paintClip(box); if(!r) return "Paint on land you own.";
  const list = paintList();
  // already that biome on top of everything here: nothing to do
  for(let i = list.length - 1; i >= 0; i--){
    if(!rectOverlap(list[i].r, r)) continue;
    if(list[i].biome === biome && rectCovers(list[i].r, r)) return {removed:0, merged:0, same:true};
    break;
  }
  let out = [], removed = 0, merged = 0;
  for(const o of list){
    if(rectCovers(r, o.r)){ removed++; continue; }
    const q = o.r;
    if(rectOverlap(r, q)){
      // cut the covered strip off when r spans the patch's whole width or height
      if(r[0] <= q[0] && r[2] >= q[2]){ if(r[1] <= q[1]) o.r = [q[0], r[3], q[2], q[3]]; else if(r[3] >= q[3]) o.r = [q[0], q[1], q[2], r[1]]; }
      else if(r[1] <= q[1] && r[3] >= q[3]){ if(r[0] <= q[0]) o.r = [r[2], q[1], q[2], q[3]]; else if(r[2] >= q[2]) o.r = [q[0], q[1], r[0], q[3]]; }
    }
    out.push(o);
  }
  // join same-biome neighbours into r, only when nothing painted above the neighbour overlaps it (so it can move to the top unseen)
  for(let again = true; again;){
    again = false;
    for(let i = out.length - 1; i >= 0; i--){
      const o = out[i]; if(o.biome !== biome) continue;
      const u = paintUnion(o.r, r); if(!u) continue;
      if(out.slice(i + 1).some(p => rectOverlap(p.r, o.r))) continue;
      out.splice(i, 1); r.splice(0, 4, ...u); merged++; removed++; again = true; break;
    }
  }
  if(out.length >= PAINT.max) return "Too many painted patches. Paint over some of them first.";
  out.push({id:uid("pt"), biome, r});
  state.biomePaint = out; paintTouch();
  return {removed, merged};
}
// Take a box off the paint: patches inside go, patches it cuts are split into what is left. Returns how many patches it touched.
function eraseRect(box){
  const r = paintClip(box); if(!r) return 0;
  const out = []; let n = 0;
  for(const o of paintList()){
    const q = o.r;
    if(!rectOverlap(r, q)){ out.push(o); continue; }
    n++;
    const pieces = [[q[0], q[1], q[2], Math.max(q[1], r[1])], [q[0], Math.min(q[3], r[3]), q[2], q[3]],
      [q[0], Math.max(q[1], r[1]), Math.max(q[0], r[0]), Math.min(q[3], r[3])], [Math.min(q[2], r[2]), Math.max(q[1], r[1]), q[2], Math.min(q[3], r[3])]];
    let first = true;
    for(const p of pieces) if(p[2] - p[0] > 0 && p[3] - p[1] > 0){ out.push(first ? (o.r = p, first = false, o) : {id:uid("pt"), biome:o.biome, r:p}); }
  }
  if(n){ state.biomePaint = out; paintTouch(); }
  return n;
}
// the top patch under a point, or null
function paintAt(x, y){
  const list = paintList();
  for(let i = list.length - 1; i >= 0; i--){ const r = list[i].r; if(x >= r[0] && x < r[2] && y >= r[1] && y < r[3]) return list[i]; }
  return null;
}
// Change the biome of a patch that hasn't been painted over (the whole patch, as it is now)
function repickPaint(id, biome){
  const o = paintList().find(p => p.id === id);
  if(!o || !BIOMES[biome] || o.biome === biome) return false;
  o.biome = biome; paintTouch(); return true;
}
function erasePaintAt(x, y){
  const o = paintAt(x, y); if(!o) return false;
  state.biomePaint = paintList().filter(p => p !== o); paintTouch(); return true;
}
// The drawn patches: the biome's color with its texture, as the park ground is. Cached until the paint or the save changes.
function paintSvg(){
  const list = paintList();
  if(!list.length) return "";
  if(paintCache && paintCache.state === state && paintCache.ver === paintVer && paintCache.n === list.length) return paintCache.s;
  const s = `<g clip-path="url(#plotClip)" pointer-events="none">` + list.map(o => {
    const r = o.r, a = `x="${r[0]}" y="${r[1]}" width="${r[2] - r[0]}" height="${r[3] - r[1]}"`;
    return `<rect ${a} fill="${BIOMES[o.biome].park}"/><rect ${a} fill="url(#p-${o.biome})"/><rect ${a} fill="var(--ground-shade)"/>`;
  }).join("") + `</g>`;
  paintCache = {state, ver:paintVer, n:list.length, s}; return s;
}

/* ---- paint inside exhibits (not vivariums) ----
   An open exhibit's biome is the one with the most ground in it: its base biome (e.biome) wherever it isn't painted, the patch's biome where it is.
   Sampled on a grid and cached per exhibit until the paint, the save or the exhibit's shape changes. A tie keeps the base. */
const exShareCache = new WeakMap();
const ptsSig = pts => pts.length + ":" + pts.reduce((n, p) => n + p[0] * 31 + p[1], 0);
function paintShare(e){
  const base = BIOMES[e.biome] ? e.biome : DEFAULT_BIOME, sig = ptsSig(e.points), c = exShareCache.get(e);
  if(c && c.state === state && c.ver === paintVer && c.sig === sig && c.base === base) return c;
  const bb = bbox(e.points), list = paintList().filter(p => rectOverlap(p.r, [bb.x0, bb.y0, bb.x1, bb.y1]));
  const counts = {}; let n = 0, best = base;
  if(list.length){
    const step = Math.max(1, Math.ceil(Math.sqrt((bb.x1 - bb.x0) * (bb.y1 - bb.y0) / 900)));
    for(let x = bb.x0 + step / 2; x < bb.x1; x += step) for(let y = bb.y0 + step / 2; y < bb.y1; y += step){
      if(!inPoly(x, y, e.points)) continue;
      let b = base; for(let i = list.length - 1; i >= 0; i--){ const r = list[i].r; if(x >= r[0] && x < r[2] && y >= r[1] && y < r[3]){ b = list[i].biome; break; } }
      counts[b] = (counts[b] || 0) + 1; n++;
    }
    for(const b in counts) if(counts[b] > (counts[best] || 0)) best = b;
  }
  const r = {state, ver:paintVer, sig, base, counts, n, biome:best};
  exShareCache.set(e, r); return r;
}
const paintedBiome = e => e.points && !e.viv && state && state.biomePaint && state.biomePaint.length ? paintShare(e).biome : e.biome;
// The patches over an open exhibit's floor, drawn clipped to its shape
function exhibitPaintSvg(e){
  const bb = bbox(e.points), list = paintList().filter(p => rectOverlap(p.r, [bb.x0, bb.y0, bb.x1, bb.y1]));
  if(!list.length) return "";
  const id = "pc-" + esc(e.id);
  return `<clipPath id="${id}"><polygon points="${polyStr(e.points)}"/></clipPath><g clip-path="url(#${id})" pointer-events="none">` + list.map(o => {
    const r = o.r, a = `x="${r[0]}" y="${r[1]}" width="${r[2] - r[0]}" height="${r[3] - r[1]}"`;
    return `<rect ${a} fill="${BIOMES[o.biome].color}" fill-opacity=".8"/><rect ${a} fill="url(#b-${o.biome})"/>`;
  }).join("") + `</g>`;
}
// What painting a box in this biome costs: the biome's grading price for each square meter inside an exhibit that isn't already that biome
function exhibitPaintCost(box, biome){
  const r = paintClip(box); if(!r) return 0;
  let n = 0;
  for(const e of state.exhibits){
    if(e.viv) continue;
    const bb = bbox(e.points), x0 = Math.max(r[0], Math.floor(bb.x0)), x1 = Math.min(r[2], Math.ceil(bb.x1)), y0 = Math.max(r[1], Math.floor(bb.y0)), y1 = Math.min(r[3], Math.ceil(bb.y1));
    if(x0 >= x1 || y0 >= y1) continue;
    const base = BIOMES[e.biome] ? e.biome : DEFAULT_BIOME;
    for(let x = x0; x < x1; x++) for(let y = y0; y < y1; y++){
      if(!inPoly(x + .5, y + .5, e.points)) continue;
      const cur = paintAt(x + .5, y + .5);
      if((cur ? cur.biome : base) !== biome) n++;
    }
  }
  return Math.round(n * BIOMES[biome].perSqM);
}
