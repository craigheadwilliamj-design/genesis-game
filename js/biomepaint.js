/* Biome paint: decoration for the park ground outside exhibits.
   state.biomePaint is a list of patches {id, biome, v, r:[x0,y0,x1,y1]} on the 1 m grid (v is one of the biome's GROUND_KINDS, left out for its own floor), drawn in list order (later paints over earlier).
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
// A biome's ground kinds (GROUND_KINDS in data.js): the kind if the biome has it, else "" (its own floor); its pattern name ("wetland-mud") and its base color
const groundKindOf = (b, v) => v && (GROUND_KINDS[b] || []).some(k => k[0] === v) ? v : "";
const paintTex = (b, v) => groundKindOf(b, v) ? b + "-" + v : b;
const groundColor = (b, v) => { const k = groundKindOf(b, v) && GROUND_KINDS[b].find(x => x[0] === v); return k ? k[2] : BIOMES[b].park; };
const sameGround = (o, b, v) => o.biome === b && (o.v || "") === v;
// Paint a box. Returns {removed, merged} or a string saying why not.
function paintRect(biome, box, v){
  if(!BIOMES[biome]) return "Pick a biome to paint.";
  v = groundKindOf(biome, v);
  const r = paintClip(box); if(!r) return "Paint on land you own.";
  const list = paintList();
  // already that biome on top of everything here: nothing to do
  for(let i = list.length - 1; i >= 0; i--){
    if(!rectOverlap(list[i].r, r)) continue;
    if(sameGround(list[i], biome, v) && rectCovers(list[i].r, r)) return {removed:0, merged:0, same:true};
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
      const o = out[i]; if(!sameGround(o, biome, v)) continue;
      const u = paintUnion(o.r, r); if(!u) continue;
      if(out.slice(i + 1).some(p => rectOverlap(p.r, o.r))) continue;
      out.splice(i, 1); r.splice(0, 4, ...u); merged++; removed++; again = true; break;
    }
  }
  if(out.length >= PAINT.max) return "Too many painted patches. Paint over some of them first.";
  out.push(v ? {id:uid("pt"), biome, v, r} : {id:uid("pt"), biome, r});
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
    for(const p of pieces) if(p[2] - p[0] > 0 && p[3] - p[1] > 0){ out.push(first ? (o.r = p, first = false, o) : Object.assign({id:uid("pt"), biome:o.biome, r:p}, o.v ? {v:o.v} : {})); }
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
// Change the biome (and ground kind) of a patch that hasn't been painted over (the whole patch, as it is now)
function repickPaint(id, biome, v){
  const o = paintList().find(p => p.id === id);
  v = groundKindOf(biome, v);
  if(!o || !BIOMES[biome] || sameGround(o, biome, v)) return false;
  o.biome = biome; if(v) o.v = v; else delete o.v; paintTouch(); return true;
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
    return `<rect ${a} fill="${groundColor(o.biome, o.v)}"/><rect ${a} fill="${tileFill("p", paintTex(o.biome, o.v))}"/>`;
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
    return `<rect ${a} fill="${groundColor(o.biome, o.v)}" fill-opacity=".8"/><rect ${a} fill="${tileFill("b", paintTex(o.biome, o.v))}"/>`;
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
// Water repeats every WATER_SPAN m instead: its frames are a quarter the size, so its animation builds four times faster (each `waves` wavelength must divide it)
const WATER_SPAN = 50;
const cellHash = (x, y) => { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; };
// which tile (0-based) each cell of a span x span square (GROUND_SPAN unless given) shows, as a flat array
function groundPicks(plain, detail, share, salt = 0, span = GROUND_SPAN){
  const out = new Array(span * span).fill(0);
  for(let cx = 0; cx < span; cx += CHUNK) for(let cy = 0; cy < span; cy += CHUNK){
    const cells = []; for(let x = cx; x < cx + CHUNK; x++) for(let y = cy; y < cy + CHUNK; y++) cells.push([cellHash(x + 31 + salt, y + 57), x, y]);
    cells.sort((a, b) => a[0] - b[0]);
    const want = CHUNK * CHUNK * share, k = Math.floor(want) + (cellHash(cx + 5 + salt, cy + 9) % 1000 / 1000 < want % 1 ? 1 : 0);
    cells.forEach(([h, x, y], i) => { out[x * span + y] = i < k ? plain + cellHash(x + 11 + salt, y + 13) % detail : cellHash(x + 17 + salt, y + 19) % plain; });
  }
  return out;
}
// A tile pattern's fill: `kind` is "p" (park ground), "b" (exhibit floor), "w" (water) or "r" (a water's ripples alone: its marks on clear ground, from the
// same frames, for drawing over what swims under it; only the kinds index.html gives an #r- pattern). The first time a biome's pattern is drawn its tiles are queued to build (buildTiles);
// until then, and while it builds, the pattern shows the single tile index.html gives it. Every place that fills with a tile pattern goes through this.
const tileAsked = {};
function tileFill(kind, biome){
  const water = kind === "w" || kind === "r", key = (water ? "w-" : "g-") + biome;
  if(!tileAsked[key]){ tileAsked[key] = 1; const T = (water ? WATER_TILES : GROUND_TILES)[biome]; if(T) buildTiles(biome, T, water); }
  return `url(#${kind}-${biome})`;
}
// Frames are drawn one at a time in idle time (every biome's first frame before anyone's later ones) and saved with toBlob, which encodes off the main thread, so building never stalls a load or a draw.
// `rest` holds one list of later frames per build, taken in turns, so every biome's water fills in together
const tileQueue = {first:[], rest:[]}; let tilePumping = false;
// A page that never goes idle (a busy park) still gets a job every TILE_WAIT ms, so animated water never sits on its first frame.
const TILE_WAIT = 120;
const tileIdle = fn => window.requestIdleCallback ? requestIdleCallback(fn, {timeout:TILE_WAIT}) : setTimeout(fn, 30);
// Each turn runs jobs until its time is used: the idle time left, or TILE_BUSY ms when the page never went idle (so a busy park still builds several frames a turn).
const TILE_BUSY = 10;
function tilePump(d){
  const t0 = performance.now(), more = () => d && !d.didTimeout ? d.timeRemaining() > 4 : performance.now() - t0 < TILE_BUSY;
  const next = () => { if(tileQueue.first.length) return tileQueue.first.shift(); const q = tileQueue.rest.shift(); if(!q) return null; const job = q.shift(); if(q.length) tileQueue.rest.push(q); return job; };
  do { const job = next(); if(!job){ tilePumping = false; return; } job(); }
  while(more());
  tileIdle(tilePump);
}
// a job, or with `first` false a list of them (one build's later frames)
function tileQueueAdd(job, first){ if(first) tileQueue.first.push(job); else if(job.length) tileQueue.rest.push(job); if(!tilePumping){ tilePumping = true; tileIdle(tilePump); } }
// builds one biome's ground (#p-<biome> and #b-<biome>) or water (#w-<biome>, from sprites/water/ with its own salt, so marks in the water don't land on the ground's)
function buildTiles(biome, T, water){
  const imgs = document.querySelectorAll(water ? `#w-${biome} image` : `#p-${biome} image, #b-${biome} image`); if(!imgs.length) return;
  const rimgs = water ? document.querySelectorAll(`#r-${biome} image`) : [];   // ripples alone: tile 1 is the plain water, its one color is keyed out of every tile
  const dir = water ? "water" : "ground", salt = water ? 4000 : 0, N = water ? WATER_SPAN : GROUND_SPAN;
  const gl = T.glint || 0, n = T.plain + T.detail + gl; let left = n; const tiles = [];
  for(let i = 0; i < n; i++){
    const t = new Image(); tiles.push(t);
    t.onload = () => {
      if(--left) return;
      const px = N * GROUND_TILE_PX, pick = groundPicks(T.plain, T.detail, T.share, salt, N), urls = [];
      // glint tiles (after the detail ones) play as the first `glint` of `frames` frames on every plain cell, each cell starting at its own frame, or by its diagonal (x + y) when `wave` is set, which makes a band of glints sweep down and right; the other frames show its plain tile
      // `sub` splits every frame into that many steps (fps and periods times `sub`, each glint tile held `sub` steps), so a band moves in smaller steps at the same speed
      const S = T.sub || 1, lcm = (a, b) => { let x = a, y = b; while(y) [x, y] = [y, x % y]; return a * b / x; }, F = !gl ? 1 : T.waves ? T.waves.reduce((n, w) => lcm(n, w[0] * S), 1) : T.frames * S;
      let dead = false;
      const show = (u, list = imgs) => list.forEach(img => { img.setAttribute("href", u); [img, img.parentNode].forEach(el => { el.setAttribute("width", N); el.setAttribute("height", N); }); });
      let base = null, keyed = tiles;
      if(rimgs.length){
        const c0 = document.createElement("canvas"); c0.width = c0.height = GROUND_TILE_PX; const g0 = c0.getContext("2d"); g0.drawImage(tiles[0], 0, 0);
        try {
          const b = g0.getImageData(0, 0, 1, 1).data; base = `rgb(${b[0]},${b[1]},${b[2]})`;
          keyed = tiles.map(t => { const c = document.createElement("canvas"); c.width = c.height = GROUND_TILE_PX; const g = c.getContext("2d"); g.drawImage(t, 0, 0);
            const d = g.getImageData(0, 0, c.width, c.height); for(let i = 0; i < d.data.length; i += 4) if(d.data[i] === b[0] && d.data[i + 1] === b[1] && d.data[i + 2] === b[2]) d.data[i + 3] = 0;
            g.putImageData(d, 0, 0); return c; });
        } catch(e){ base = null; keyed = tiles; }   // a tainted canvas: no ripple layer
      }
      const rurls = [], h = GROUND_TILE_PX / 2;
      // the cells as they are with no glint, drawn once; every frame copies it and redraws only the cells glinting in that frame
      let still = null;
      const stillLayer = () => {
        const c = document.createElement("canvas"); c.width = c.height = px; const g = c.getContext("2d"); g.imageSmoothingEnabled = false;
        for(let x = 0; x < N; x++) for(let y = 0; y < N; y++){
          const t = pick[x * N + y], o = T.still && T.still.includes(t + 1) ? 0 : cellHash(x + 7919 + salt, y + 104729) % (T.turn === false ? 2 : 8), a = (o >> 1) * Math.PI / 2, m = o & 1 ? -1 : 1;
          g.setTransform(Math.cos(a) * m, Math.sin(a) * m, -Math.sin(a), Math.cos(a), x * GROUND_TILE_PX + h, y * GROUND_TILE_PX + h);
          g.drawImage(keyed[t], -h, -h);
        }
        return c;
      };
      // the still layer's pixels and each glint tile's, so a frame is a buffer copy plus 64 pixels a glinting cell (null on a tainted canvas: draw instead)
      let stillPx = null, glintPx = null;
      const pixels = () => { try {
        stillPx = still.getContext("2d").getImageData(0, 0, px, px).data;
        glintPx = keyed.slice(T.plain + T.detail).map(t => { const c = document.createElement("canvas"); c.width = c.height = GROUND_TILE_PX; c.getContext("2d").drawImage(t, 0, 0);
          return new Uint32Array(c.getContext("2d").getImageData(0, 0, GROUND_TILE_PX, GROUND_TILE_PX).data.buffer); });
      } catch(e){ stillPx = glintPx = null; } };
      const frame = f => {
        if(dead) return;
        if(!still){ still = stillLayer(); if(F > 1) pixels(); }
        if(F === 1){ frameDone(f, still); return; }
        const c = document.createElement("canvas"); c.width = c.height = px;
        const g = c.getContext("2d"); g.imageSmoothingEnabled = false;
        const img = stillPx && new ImageData(new Uint8ClampedArray(stillPx), px, px), u = img && new Uint32Array(img.data.buffer);
        if(!img) g.drawImage(still, 0, 0);
        if(gl) for(let x = 0; x < N; x++) for(let y = 0; y < N; y++){
          if(pick[x * N + y] >= T.plain) continue;
          let k = gl;
          if(T.waves){ const j = cellHash(x + 9001 + salt, y + 31337) & 1; for(const [P, W] of T.waves){ const PS = P * S, q = (f + PS - Math.floor((x + y) % W * PS / W) + j * S) % PS; if(q < gl * S){ k = Math.floor(q / S); break; } } }
          else k = Math.floor((f + cellHash(x + 9001 + salt, y + 31337) * S) % (T.frames * S) / S);
          if(k >= gl) continue;
          const X = x * GROUND_TILE_PX, Y = y * GROUND_TILE_PX;   // a glint is never turned or mirrored, so it always travels the same way
          if(u){ const t = glintPx[k]; for(let r = 0; r < GROUND_TILE_PX; r++) u.set(t.subarray(r * GROUND_TILE_PX, (r + 1) * GROUND_TILE_PX), (Y + r) * px + X); }
          else { g.clearRect(X, Y, GROUND_TILE_PX, GROUND_TILE_PX); g.drawImage(keyed[T.plain + T.detail + k], X, Y); }
        }
        if(img) g.putImageData(img, 0, 0);
        frameDone(f, c);
      };
      const frameDone = (f, c) => {
        // with ripples: the canvas so far is the marks alone; the water is its base color with them on top
        const rc = base && c; let wc = c;
        if(rc){ wc = document.createElement("canvas"); wc.width = wc.height = px; const w = wc.getContext("2d"); w.fillStyle = base; w.fillRect(0, 0, px, px); w.drawImage(rc, 0, 0); }
        let need = rc ? 2 : 1;
        const ready = () => {
          if(--need) return;
          if(f === 0){ show(urls[0]); if(rc) show(rurls[0], rimgs); }
          // play from the first frame on, holding on any frame not built yet (they build about as fast as they play, so the water moves almost at once)
          if(f === 0 && F > 1){ let fr = 0; setInterval(() => { const nx = (fr + 1) % F; if(!urls[nx] || (rc && !rurls[nx])) return; fr = nx; show(urls[fr]); if(rc) show(rurls[fr], rimgs); }, 1000 / (T.fps * S)); }
        };
        try {
          wc.toBlob(b => { if(!b){ dead = true; return; } urls[f] = URL.createObjectURL(b); ready(); });
          if(rc) rc.toBlob(b => { if(!b){ dead = true; return; } rurls[f] = URL.createObjectURL(b); ready(); });
        } catch(e){ dead = true; }   // a tainted canvas: keep the single tile
      };
      tileQueueAdd(() => frame(0), true); tileQueueAdd(Array.from({length:F - 1}, (_, i) => () => frame(i + 1)), false);
    };
    t.src = spriteUrl(`sprites/${dir}/${biome}-${i + 1}.png`);
  }
}
