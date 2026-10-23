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
// The night dimming layer over park ground (dark mode). A biome with ground tiles skips it, so it matches the exhibit floors, which are never dimmed.
const groundShade = (biome, tag, attrs) => GROUND_TILES[biome] ? "" : `<${tag} ${attrs} fill="var(--ground-shade)"/>`;
// The drawn patches: the biome's color with its texture, as the park ground is. Cached until the paint or the save changes.
function paintSvg(){
  const list = paintList();
  if(!list.length) return "";
  if(paintCache && paintCache.state === state && paintCache.ver === paintVer && paintCache.n === list.length) return paintCache.s;
  const s = `<g clip-path="url(#plotClip)" pointer-events="none">` + list.map(o => {
    const r = o.r, a = `x="${r[0]}" y="${r[1]}" width="${r[2] - r[0]}" height="${r[3] - r[1]}"`;
    return `<rect ${a} fill="${BIOMES[o.biome].park}"/><rect ${a} fill="${tileFill("p", o.biome)}"/>` + groundShade(o.biome, "rect", a);
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
    return `<rect ${a} fill="${BIOMES[o.biome].color}" fill-opacity=".8"/><rect ${a} fill="${tileFill("b", o.biome)}"/>`;
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

/* ---- ground tiles ----
   A biome in GROUND_TILES has its #p-<biome> (park) and #b-<biome> (exhibit floor) patterns rebuilt from its 1 m tiles: a GROUND_SPAN m square, one tile in each 1 m cell.
   Each 5 m chunk takes about `share` of its cells (the ones with the lowest hash, so a fixed pick) for the detail tiles, and the rest get plain tiles. Every cell is also
   turned a quarter-turn 0 to 3 times and mirrored at random, except tiles listed in `still`. All picks are hashes of the cell, so nothing changes between draws or reloads. The pattern repeats every GROUND_SPAN m. */
const GROUND_SPAN = 100, GROUND_TILE_PX = 8;
const cellHash = (x, y) => { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; };
// which tile (0-based) each cell of the GROUND_SPAN square shows, as a flat array
function groundPicks(plain, detail, share, salt = 0){
  const out = new Array(GROUND_SPAN * GROUND_SPAN).fill(0);
  for(let cx = 0; cx < GROUND_SPAN; cx += CHUNK) for(let cy = 0; cy < GROUND_SPAN; cy += CHUNK){
    const cells = []; for(let x = cx; x < cx + CHUNK; x++) for(let y = cy; y < cy + CHUNK; y++) cells.push([cellHash(x + 31 + salt, y + 57), x, y]);
    cells.sort((a, b) => a[0] - b[0]);
    const want = CHUNK * CHUNK * share, k = Math.floor(want) + (cellHash(cx + 5 + salt, cy + 9) % 1000 / 1000 < want % 1 ? 1 : 0);
    cells.forEach(([h, x, y], i) => { out[x * GROUND_SPAN + y] = i < k ? plain + cellHash(x + 11 + salt, y + 13) % detail : cellHash(x + 17 + salt, y + 19) % plain; });
  }
  return out;
}
// A tile pattern's fill: `kind` is "p" (park ground), "b" (exhibit floor) or "w" (water). The first time a biome's pattern is drawn its tiles are queued to build (buildTiles);
// until then, and while it builds, the pattern shows the single tile index.html gives it. Every place that fills with a tile pattern goes through this.
const tileAsked = {};
function tileFill(kind, biome){
  const water = kind === "w", key = (water ? "w-" : "g-") + biome;
  if(!tileAsked[key]){ tileAsked[key] = 1; const T = (water ? WATER_TILES : GROUND_TILES)[biome]; if(T) buildTiles(biome, T, water); }
  return `url(#${kind}-${biome})`;
}
// Frames are drawn one at a time in idle time (every biome's first frame before anyone's later ones) and saved with toBlob, which encodes off the main thread, so building never stalls a load or a draw.
const tileQueue = {first:[], rest:[]}; let tilePumping = false;
const tileIdle = fn => window.requestIdleCallback ? requestIdleCallback(fn, {timeout:400}) : setTimeout(fn, 30);
function tilePump(){
  const job = tileQueue.first.shift() || tileQueue.rest.shift(); if(!job){ tilePumping = false; return; }
  job(); tileIdle(tilePump);
}
function tileQueueAdd(job, first){ tileQueue[first ? "first" : "rest"].push(job); if(!tilePumping){ tilePumping = true; tileIdle(tilePump); } }
// builds one biome's ground (#p-<biome> and #b-<biome>) or water (#w-<biome>, from sprites/water/ with its own salt, so marks in the water don't land on the ground's)
function buildTiles(biome, T, water){
  const imgs = document.querySelectorAll(water ? `#w-${biome} image` : `#p-${biome} image, #b-${biome} image`); if(!imgs.length) return;
  const dir = water ? "water" : "ground", salt = water ? 4000 : 0;
  const gl = T.glint || 0, n = T.plain + T.detail + gl; let left = n; const tiles = [];
  for(let i = 0; i < n; i++){
    const t = new Image(); tiles.push(t);
    t.onload = () => {
      if(--left) return;
      const px = GROUND_SPAN * GROUND_TILE_PX, pick = groundPicks(T.plain, T.detail, T.share, salt), urls = [];
      // glint tiles (after the detail ones) play as the first `glint` of `frames` frames on every plain cell, each cell starting at its own frame, or by its diagonal (x + y) when `wave` is set, which makes a band of glints sweep down and right; the other frames show its plain tile
      const lcm = (a, b) => { let x = a, y = b; while(y) [x, y] = [y, x % y]; return a * b / x; }, F = !gl ? 1 : T.waves ? T.waves.reduce((n, w) => lcm(n, w[0]), 1) : T.frames;
      let done = 0, dead = false;
      const show = u => imgs.forEach(img => { img.setAttribute("href", u); [img, img.parentNode].forEach(el => { el.setAttribute("width", GROUND_SPAN); el.setAttribute("height", GROUND_SPAN); }); });
      const frame = f => {
        if(dead) return;
        const c = document.createElement("canvas"); c.width = c.height = px;
        const g = c.getContext("2d"); g.imageSmoothingEnabled = false;
        for(let x = 0; x < GROUND_SPAN; x++) for(let y = 0; y < GROUND_SPAN; y++){
          let t = pick[x * GROUND_SPAN + y], o = T.still && T.still.includes(t + 1) ? 0 : cellHash(x + 7919 + salt, y + 104729) % (T.turn === false ? 2 : 8);
          if(gl && t < T.plain){ let k = gl;
            if(T.waves){ const j = cellHash(x + 9001 + salt, y + 31337) & 1; for(const [P, W] of T.waves){ const q = (f + P - Math.floor((x + y) % W * P / W) + j) % P; if(q < gl){ k = q; break; } } }
            else k = (f + cellHash(x + 9001 + salt, y + 31337)) % T.frames;
            if(k < gl){ t = T.plain + T.detail + k; o = 0; } }   // a glint is never turned or mirrored, so it always travels the same way
          const h = GROUND_TILE_PX / 2, a = (o >> 1) * Math.PI / 2, m = o & 1 ? -1 : 1;
          g.setTransform(Math.cos(a) * m, Math.sin(a) * m, -Math.sin(a), Math.cos(a), x * GROUND_TILE_PX + h, y * GROUND_TILE_PX + h);
          g.drawImage(tiles[t], -h, -h);
        }
        try { c.toBlob(b => {
          if(!b){ dead = true; return; }
          urls[f] = URL.createObjectURL(b);
          if(f === 0) show(urls[0]);
          if(++done === F && F > 1){ let fr = 0; setInterval(() => show(urls[fr = (fr + 1) % F]), 1000 / T.fps); }
        }); } catch(e){ dead = true; }   // a tainted canvas: keep the single tile
      };
      for(let f = 0; f < F; f++) tileQueueAdd(() => frame(f), f === 0);
    };
    t.src = spriteUrl(`sprites/${dir}/${biome}-${i + 1}.png`);
  }
}
