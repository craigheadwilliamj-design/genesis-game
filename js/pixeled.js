// Pixel editor (dev mode, HUD "Pixels"): draw and animate any sprite in SPRITE_PACK, try it in the park, send it to the repo.
// A picture is a strip of same-size frames side by side, as the game draws them, made of layers shared by every frame (px.frames[frame][layer]). Work is kept as a localStorage draft per path
// until "Send to repo" writes the PNG to the db collection `pixeled`, where tools/pixeledpull.py picks it up (docs/art.md: Pixel editor).

const PX_PARK = [[18,34,19],[63,124,69],[48,94,50],[43,84,45],[28,26,16],[33,26,14],[106,100,77],[227,221,195],[198,188,147],
  [44,35,19],[66,53,29],[165,125,74],[143,109,64],[110,85,49],[132,101,59],[231,231,231],[189,72,58],[222,182,72],[29,43,34,100]];   // PAL in tools/genesis_style.py
const PX_TOOLS = [["pencil", "Pencil", "B"], ["eraser", "Eraser", "E"], ["bucket", "Fill (Shift: every pixel of that color)", "G"], ["line", "Line", "L"],
  ["rect", "Rectangle (Shift: filled)", "R"], ["ellipse", "Ellipse (Shift: filled)", "O"], ["select", "Select a box and move it", "M"], ["lasso", "Lasso: draw around pixels to select them (the line snaps to pixels)", "Q"], ["shade", "Shade: left lightens, right darkens", "U"], ["picker", "Pick a color", "I"], ["pan", "Pan: drag to move the view (or hold Space)", "H"]];
const PX_ICONS = {pencil:"M3 17l10-10 2 2-10 10H3zM14 6l2-2 2 2-2 2z", eraser:"M4 14l7-7 6 6-5 5H7zM9 18h9", bucket:"M5 9l6-6 6 6-6 6zM17 12c1 2 2 3 2 4a2 2 0 01-4 0c0-1 1-2 2-4z",
  line:"M4 17L17 4", rect:"M4 5h13v11H4z", ellipse:"M10.5 4.5c4 0 6.5 2.7 6.5 6s-2.5 6-6.5 6S4 13.8 4 10.5s2.5-6 6.5-6z", select:"M4 4h13v13H4z",
  shade:"M10.5 3a7.5 7.5 0 000 15zM10.5 3a7.5 7.5 0 010 15", picker:"M14 3l4 4-2 2-1-1-7 7H6v-2l7-7-1-1z",
  lasso:"M10.5 3.5c4.4 0 7.5 2.2 7.5 5s-3.1 5-7.5 5S3 11.3 3 8.5s3.1-5 7.5-5zM5.5 12.5c-1.2 1.6-.6 3.6 1.4 4.1 1.3.3 1.8 1.5 1.2 2.6",
  pan:"M7 11V5.5a1.5 1.5 0 013 0V10M10 9.5V4a1.5 1.5 0 013 0v6M13 9.5V5.5a1.5 1.5 0 013 0V12c0 3.6-2.2 6-5.5 6C7.3 18 6 16.4 4.9 14.4L3 11a1.4 1.4 0 012.4-1.4L7 12"};
// New-picture sizes the game expects ({id} a species, {name} anything); animals are 100 x 75 with the feet on the bottom rows, facing right
const PX_DASH = {select:' stroke-dasharray="3.2 2.6" stroke-linecap="butt"', lasso:' stroke-dasharray="3.2 2.2" stroke-linecap="butt"'};   // icons drawn dashed (a marquee)
const PX_TEMPLATES = {animal:["Animal, standing", 100, 75, 1, "sprites/{id}.png"], walk:["Animal walk strip", 100, 75, 4, "sprites/{id}-walk.png"], idle:["Animal idle strip", 100, 75, 8, "sprites/{id}-idle.png"],
  person:["Keeper or guest strip", 16, 32, 4, "sprites/human/{name}-walk.png"], plant:["Plant, large", 64, 92, 1, "sprites/plants/{name}.png"], plantM:["Plant, medium", 64, 58, 1, "sprites/plants/{name}.png"],
  plantS:["Plant, small", 44, 40, 1, "sprites/plants/{name}.png"], rock:["Rock or boulder shape", 24, 18, 1, "sprites/rocks/{name}.png"],
  prop:["Prop, one view (a bin is 14 x 21)", 14, 21, 1, "sprites/bld/{name}-{view}.png"], bld:["Building, one view", 80, 80, 1, "sprites/bld/{name}-{view}.png"], custom:["Any size", 32, 32, 1, "sprites/{name}.png"]};
const PX_VIEWS = ["front", "back", "left", "right"];
const PX_SKIP_BLD = ["vivS", "vivM", "vivL", "platform", "tramstop", "campground"];   // drawn with what's inside them or from parts, not one picture
const PX_KEY = "genesis-pixel-", PX_UNDO = 200;
const px = {path:"", fw:16, fh:16, frames:[], layers:[], lay:0, cur:0, fps:6, zoom:12, tool:"pencil", c1:[29,43,34,255], c2:[0,0,0,0], grid:true, onion:true, mirror:false,
  pal:"image", ref:"", refCv:null, refUrl:"", refAlpha:.3, refShow:true, refFront:false, guide:null, tab:"all", sel:null, clip:null, undo:[], redo:[], stroke:null, hover:null, built:false, dime:null, db:null, queue:[], sub:null, anim:0};

/* ---------- pixels ---------- */
const pxBlank = (w, h) => new Uint8ClampedArray(w * h * 4);
const pxAt = (x, y) => (y * px.fw + x) * 4;
const pxIn = (x, y) => x >= 0 && y >= 0 && x < px.fw && y < px.fh;
const pxGet = (f, x, y) => { const i = pxAt(x, y); return [f[i], f[i + 1], f[i + 2], f[i + 3]]; };
const pxSame = (a, b) => a[3] === 0 && b[3] === 0 || a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
function pxPut(f, x, y, c){ if(!pxIn(x, y)) return; const i = pxAt(x, y); f[i] = c[0]; f[i + 1] = c[1]; f[i + 2] = c[2]; f[i + 3] = c[3]; }
// A drawing tool's dab: the pencil and eraser size, and its mirror image when Mirror is on
function pxBrush(f, x, y, c){
  const s = px.tool === "pencil" || px.tool === "eraser" ? px.size || 1 : 1, o = Math.floor((s - 1) / 2);
  for(let dy = 0; dy < s; dy++) for(let dx = 0; dx < s; dx++){ pxPut(f, x - o + dx, y - o + dy, c); if(px.mirror) pxPut(f, px.fw - 1 - (x - o + dx), y - o + dy, c); }
}
const pxHex = c => "#" + c.slice(0, 3).map(v => v.toString(16).padStart(2, "0")).join("");
const pxCss = c => `rgba(${c[0]},${c[1]},${c[2]},${(c[3] / 255).toFixed(3)})`;
const pxRgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
function pxHsl([r, g, b]){
  r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if(!d) return [0, 0, l];
  const h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, d / (1 - Math.abs(2 * l - 1)), l];
}
function pxFromHsl(h, s, l){
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2, k = Math.floor(h / 60) % 6;
  const [r, g, b] = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][k];
  return [r, g, b].map(v => Math.round((v + m) * 255));
}
function pxLine(x0, y0, x1, y1, fn){
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy;
  for(;;){ fn(x0, y0); if(x0 === x1 && y0 === y1) return; const e2 = 2 * e; if(e2 >= dy){ e += dy; x0 += sx; } if(e2 <= dx){ e += dx; y0 += sy; } }
}
// Pixels inside the box's ellipse; the outline is those with a side neighbour outside, so it's always one pixel thick and symmetric
function pxEllipse(x0, y0, x1, y1, fill, fn){
  const ax = Math.min(x0, x1), ay = Math.min(y0, y1), bx = Math.max(x0, x1), by = Math.max(y0, y1), cx = (ax + bx + 1) / 2, cy = (ay + by + 1) / 2, rx = (bx - ax + 1) / 2, ry = (by - ay + 1) / 2;
  const inn = (x, y) => x >= ax && x <= bx && y >= ay && y <= by && ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1.0001;
  for(let y = ay; y <= by; y++) for(let x = ax; x <= bx; x++) if(inn(x, y) && (fill || !inn(x - 1, y) || !inn(x + 1, y) || !inn(x, y - 1) || !inn(x, y + 1))) fn(x, y);
}
function pxRect(x0, y0, x1, y1, fill, fn){
  const ax = Math.min(x0, x1), ay = Math.min(y0, y1), bx = Math.max(x0, x1), by = Math.max(y0, y1);
  for(let y = ay; y <= by; y++) for(let x = ax; x <= bx; x++) if(fill || x === ax || x === bx || y === ay || y === by) fn(x, y);
}
function pxFill(f, x, y, c, all){
  const t = pxGet(f, x, y); if(pxSame(t, c)) return;
  if(all){ for(let yy = 0; yy < px.fh; yy++) for(let xx = 0; xx < px.fw; xx++) if(pxSame(pxGet(f, xx, yy), t)) pxPut(f, xx, yy, c); return; }
  const seen = new Uint8Array(px.fw * px.fh), st = [[x, y]], hit = [];
  while(st.length){
    const [a, b] = st.pop(); if(!pxIn(a, b) || seen[b * px.fw + a] || !pxSame(pxGet(f, a, b), t)) continue;
    seen[b * px.fw + a] = 1; hit.push([a, b]); st.push([a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]);
  }
  hit.forEach(([a, b]) => pxPut(f, a, b, c));
}
// Every color the picture uses, by hue then lightness (greys first)
function pxUsed(){
  const seen = new Map();
  for(const f of px.frames.flat()) for(let i = 0; i < f.length; i += 4) if(f[i + 3]){ const k = f[i] << 24 | f[i + 1] << 16 | f[i + 2] << 8 | f[i + 3]; if(!seen.has(k)){ seen.set(k, [f[i], f[i + 1], f[i + 2], f[i + 3]]); if(seen.size > 255) break; } }
  return [...seen.values()].sort((a, b) => { const [ha, sa, la] = pxHsl(a), [hb, sb, lb] = pxHsl(b); return (sa < .08) - (sb < .08) || (sa < .08 ? 0 : Math.round(ha / 20) - Math.round(hb / 20)) || la - lb; });
}
const pxSwatches = () => px.pal === "park" ? PX_PARK.map(c => c.length === 4 ? c : [...c, 255]) : px.pal === "dime" ? px.dime || [] : pxUsed();
// A small lightness nudge, so repeated strokes lighten or darken gently
const PX_SHADE_STEP = .03;
function pxShade(c, up){
  if(!c[3]) return c;
  const [h, s, l] = pxHsl(c);
  return [...pxFromHsl(h, s, Math.min(1, Math.max(0, l + (up ? PX_SHADE_STEP : -PX_SHADE_STEP)))), c[3]];
}

/* ---------- document ---------- */
const pxSnap = () => ({frames:px.frames.map(f => f.map(l => l.slice())), layers:px.layers.map(l => ({...l})), lay:px.lay, fw:px.fw, fh:px.fh, cur:px.cur});
function pxPush(){ pxDrop(); px.undo.push(pxSnap()); if(px.undo.length > PX_UNDO) px.undo.shift(); px.redo = []; }
function pxRestore(s){ px.frames = s.frames; px.layers = s.layers; px.lay = Math.min(s.lay, s.layers.length - 1); px.fw = s.fw; px.fh = s.fh; px.cur = Math.min(s.cur, s.frames.length - 1); px.sel = null; pxFit(); }
function pxUndo(redo){ const [a, b] = redo ? [px.redo, px.undo] : [px.undo, px.redo]; if(!a.length) return; pxDrop(); b.push(pxSnap()); pxRestore(a.pop()); pxChanged(); }
const pxFrame = () => px.frames[px.cur][px.lay];   // what the tools draw on: this frame's current layer
const pxLayerNew = n => ({name:"Layer " + n, show:true, alpha:1});
// A frame as it shows: its visible layers bottom to top, each at its own opacity
function pxComp(i){
  const cv = document.createElement("canvas"); cv.width = px.fw; cv.height = px.fh; const ctx = cv.getContext("2d");
  px.layers.forEach((L, l) => { if(L.show) pxLayer(ctx, px.frames[i][l], 0, 0, 1, L.alpha); });
  return cv;
}
const pxCompData = i => pxComp(i).getContext("2d").getImageData(0, 0, px.fw, px.fh).data;
const pxInked = d => d.some((v, j) => j % 4 === 3 && v);   // any pixel not fully see-through
// Why the open picture would go out blank ("" if it wouldn't): nothing shows in any frame, naming hidden layers that hold pixels, the usual cause
function pxEmptyWhy(){
  if(px.frames.some((_, i) => pxInked(pxCompData(i)))) return "";
  const hid = px.layers.filter((L, l) => !L.show && px.frames.some(f => pxInked(f[l]))).map(L => L.name);
  return hid.length ? `${px.path} is blank: everything is on hidden layers (${hid.join(", ")}). Show them first.` : `${px.path} is blank.`;
}
async function pxPngInked(url){ const im = await pxImg(url), cv = document.createElement("canvas"); cv.width = im.width; cv.height = im.height; const c = cv.getContext("2d"); c.drawImage(im, 0, 0); return pxInked(c.getImageData(0, 0, im.width, im.height).data); }
function pxStrip(l){   // the whole strip, or one layer's strip (for drafts)
  const cv = document.createElement("canvas"); cv.width = px.fw * px.frames.length; cv.height = px.fh; const ctx = cv.getContext("2d");
  px.frames.forEach((f, i) => l == null ? ctx.drawImage(pxComp(i), i * px.fw, 0) : ctx.putImageData(new ImageData(f[l].slice(), px.fw, px.fh), i * px.fw, 0));
  return cv;
}
const pxPng = () => pxStrip().toDataURL("image/png");
const pxImg = src => new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = src; });
// A strip cut into n frames' pixels (an image or a canvas)
function pxCuts(im, n){
  const cv = document.createElement("canvas"); cv.width = im.width; cv.height = im.height; const ctx = cv.getContext("2d"); ctx.drawImage(im, 0, 0);
  const fw = im.width / n; return Array.from({length:n}, (_, i) => new Uint8ClampedArray(ctx.getImageData(i * fw, 0, fw, im.height).data));
}
function pxSlice(im, n){   // a flat picture: one layer
  px.fw = im.width / n; px.fh = im.height; px.frames = pxCuts(im, n).map(b => [b]); px.layers = [pxLayerNew(1)]; px.lay = 0;
}
// A strip's frame count: an animal's strips are frames the size of its standing picture, people 16 px wide, the rest one frame
function pxGuess(path, w, h){
  const m = path.match(/^(sprites\/(?:[^/]+\/)*)([a-z0-9]+)-[a-z0-9-]+\.png$/i), base = m && SPRITE_PACK[`${m[1]}${m[2]}.png`];
  if(/^sprites\/human\//.test(path) && w % 16 === 0) return w / 16;
  if(base){ const bw = pxPngSize(base); if(bw && bw[1] === h && w % bw[0] === 0) return w / bw[0]; }
  return 1;
}
function pxPngSize(uri){ try{ const b = atob(uri.slice(22, 22 + 44)); const n = i => (b.charCodeAt(i) << 24 | b.charCodeAt(i + 1) << 16 | b.charCodeAt(i + 2) << 8 | b.charCodeAt(i + 3)) >>> 0; return [n(16), n(20)]; }catch{ return null; } }
const pxStore = (k, v) => { try{ v === undefined ? localStorage.removeItem(PX_KEY + k) : localStorage.setItem(PX_KEY + k, JSON.stringify(v)); }catch{} };
const pxStored = k => { try{ return JSON.parse(localStorage.getItem(PX_KEY + k)); }catch{ return null; } };
// The open picture's building or prop type: its footprint (BUILDINGS w x d, meters) can be changed here. pxFootOrig keeps each type's footprint as the game had it.
const pxFootOrig = {};
const pxFootType = () => { const m = px.path && px.path.match(/^sprites\/bld\/([a-zA-Z0-9]+)-(?:front|back|left|right)/); return m && BUILDINGS[m[1]] ? m[1] : null; };
function pxSetFoot(k, w, d){ const t = BUILDINGS[k]; pxFootOrig[k] = pxFootOrig[k] || {w:t.w, d:t.d}; t.w = w; t.d = d; }
// The guide's end ticks are handles: dragging one sets the footprint's width in this view (the depth on a side view), kept centered
// The base row (where the footprint's front edge meets the picture): a building's BLD_PICS base (sideBase on the sides), a prop view's 4th PROP_PICS number. pxBaseOrig keeps each path's row as the game had it.
const pxBaseOrig = {};
function pxSetBase(row){
  const k = pxFootType(); if(!k) return; const v = px.path.match(/-(front|back|left|right)/)[1], side = v === "left" || v === "right";
  if(!(px.path in pxBaseOrig)) pxBaseOrig[px.path] = px.guide; px.guide = row;
  const B = BLD_PICS[k], P = PROP_PICS[k];
  if(BUILDINGS[k].prop){ if(P && P[v]) P[v][3] = row; }
  else if(B){ if(side && !B.tried) B.sideBase = row; else B.base = row; }
}
const pxBaseDiff = () => px.path in pxBaseOrig && px.guide !== pxBaseOrig[px.path] ? px.guide : null;
function pxFootEnds(){ const gw = Math.round(Math.min(px.fw, px.guideW || px.fw)), x0 = Math.round((px.fw - gw) / 2); return [x0, x0 + gw]; }
function pxFootHit(e){   // "w" on an end handle, "row" on the line between them; only with Adjust footprint on
  if(!px.footEdit || px.guide == null || !px.guideW || !pxFootType()) return false;
  const r = pxCv.getBoundingClientRect(), z = r.width / px.fw, mx = e.clientX - r.left, my = e.clientY - r.top, gy = px.guide * z, [x0, x1] = pxFootEnds();
  if(my > gy - 4 * z - 6 && my < gy + 6 && [x0, x1].some(x => Math.abs(mx - x * z) < Math.max(6, z))) return "w";
  return Math.abs(my - gy) < Math.max(6, z / 2) && mx > x0 * z && mx < x1 * z ? "row" : false;
}
function pxFootDrag(e, how){
  if(how === "row"){ const r = pxCv.getBoundingClientRect(), row = Math.max(1, Math.min(px.fh, Math.round((e.clientY - r.top) / r.height * px.fh))); if(row !== px.guide) pxSetBase(row); return pxDraw(); }
  const r = pxCv.getBoundingClientRect(), half = Math.abs((e.clientX - r.left) / r.width * px.fw - px.fw / 2), k = pxFootType(), t = BUILDINGS[k];
  const m = Math.max(.5, Math.round(Math.min(px.fw, Math.round(half * 2)) * ROCK_MPP * 10) / 10), side = /-(left|right)/.test(px.path);
  if(m !== (side ? t.d : t.w)){ pxSetFoot(k, side ? t.w : m, side ? m : t.d); px.guide = pxGuideFor(px.path); }
  pxDraw();
}
function pxFootDiff(){ const k = pxFootType(), o = k && pxFootOrig[k], t = k && BUILDINGS[k]; return o && (o.w !== t.w || o.d !== t.d) ? {k, w:t.w, d:t.d} : null; }
const pxDrafts = () => pxStored("drafts") || {};
let pxSaveT = 0;
function pxChanged(){
  pxDraw(); pxSync();
  clearTimeout(pxSaveT); pxSaveT = setTimeout(pxSaveDraft, 600);
}
function pxSaveNow(){   // the Save button: the draft saves itself anyway, this does it now and says so
  if(!px.path) return; pxSaveDraft(); pxSync();
  const why = pxEmptyWhy(); ui.toast(why ? "Saved, but " + why[0].toLowerCase() + why.slice(1) : `Saved ${px.path}.`, why ? "bad" : "good");
}
function pxSaveDraft(){
  clearTimeout(pxSaveT); if(!px.path) return;
  const d = pxDrafts(); d[px.path] = Date.now(); pxStore("drafts", d); pxStore("last", px.path);
  pxStore("d:" + px.path, pxDraft());
}
// A draft keeps every layer as its own strip, so they come back as layers
const pxDraft = () => ({foot:pxFootDiff(), base:pxBaseDiff(), n:px.frames.length, fps:px.fps, lay:px.lay, ref:{path:px.ref, url:px.ref === "upload" ? px.refUrl : "", alpha:px.refAlpha, show:px.refShow, front:px.refFront}, layers:px.layers.map((L, l) => ({...L, png:pxStrip(l).toDataURL("image/png")}))});
async function pxLoadDraft(dr){
  const ims = await Promise.all(dr.layers.map(L => pxImg(L.png))), n = dr.n;
  px.fw = ims[0].width / n; px.fh = ims[0].height;
  const cuts = ims.map(im => pxCuts(im, n));
  px.frames = Array.from({length:n}, (_, i) => cuts.map(c => c[i]));
  px.layers = dr.layers.map(({name, show, alpha}) => ({name, show, alpha})); px.lay = Math.min(dr.lay || 0, px.layers.length - 1);
}
async function pxOpen(path, fresh){
  pxDrop(); const dr = !fresh && pxStored("d:" + path), src = dr ? dr.png || dr.layers && dr.layers[0].png : SPRITE_PACK[path];
  if(!src) return ui.toast("There's no picture at " + path + ".", "bad");
  try{
    const im = await pxImg(src); px.path = path; px.ref = ""; px.refCv = null; px.fps = dr && dr.fps || 6; px.cur = 0; px.undo = []; px.redo = []; px.sel = null;
    if(dr && dr.layers) await pxLoadDraft(dr); else pxSlice(im, dr ? dr.n : pxGuess(path, im.width, im.height));
    pxStore("last", path);
    { const k = pxFootType(), o = k && pxFootOrig[k]; if(dr && dr.foot) pxSetFoot(dr.foot.k, dr.foot.w, dr.foot.d); else if(o) pxSetFoot(k, o.w, o.d); }   // a draft brings its footprint; Revert goes back to the game's
    px.guide = pxGuideFor(path);
    if(path in pxBaseOrig) pxSetBase(pxBaseOrig[path]);   // back to the game's row, then the draft's
    if(dr && dr.base != null) pxSetBase(dr.base);
    if(dr && dr.ref && dr.ref.path){ const R = dr.ref; Object.assign(px, {refUrl:R.url || "", refAlpha:R.alpha ?? .3, refShow:R.show !== false, refFront:!!R.front}); await pxSetRef(R.path); }
    pxFit(); pxDraw(); pxSync();
    if(dr) ui.toast("Picked up your draft of " + path + ". Revert goes back to the game's copy.");
  }catch{ ui.toast("That picture didn't load.", "bad"); }
}
function pxNew(path, w, h, n){
  pxDrop(); px.path = path; px.fw = w; px.fh = h; px.guide = pxGuideFor(path); px.frames = Array.from({length:n}, () => [pxBlank(w, h)]); px.layers = [pxLayerNew(1)]; px.lay = 0; px.cur = 0; px.undo = []; px.redo = []; px.sel = null;
  pxFit(); pxChanged();
}

/* ---------- selection ---------- */
function pxDrop(){   // stamp a floating selection down where it is
  const s = px.sel; if(!s || !s.buf || !px.frames.length) return;
  const f = pxFrame();
  for(let y = 0; y < s.h; y++) for(let x = 0; x < s.w; x++){ const i = (y * s.w + x) * 4; if(s.buf[i + 3]) pxPut(f, s.x + x, s.y + y, [s.buf[i], s.buf[i + 1], s.buf[i + 2], s.buf[i + 3]]); }
  s.buf = null;
}
// A selection is a box {x, y, w, h}, with a mask (1 a pixel) when the lasso drew it, and buf once its pixels are lifted to move
const pxSelTool = t => t === "select" || t === "lasso";
const pxInSel = (s, x, y) => x >= s.x && y >= s.y && x < s.x + s.w && y < s.y + s.h && (!s.mask || !!s.mask[(y - s.y) * s.w + x - s.x]);
function pxCut(s, clear){
  const f = pxFrame(), b = pxBlank(s.w, s.h);
  for(let y = 0; y < s.h; y++) for(let x = 0; x < s.w; x++) if(pxIn(s.x + x, s.y + y) && (!s.mask || s.mask[y * s.w + x])){ const i = pxAt(s.x + x, s.y + y), j = (y * s.w + x) * 4; for(let k = 0; k < 4; k++){ b[j + k] = f[i + k]; if(clear) f[i + k] = 0; } }
  return b;
}
// A picture's fingerprint: its size and which pixels show in roughly what color (PNG round trips can nudge see-through pixels)
function pxSig(w, h, buf){ let a = 0x811c9dc5; for(let i = 0; i < buf.length; i += 4){ const v = buf[i + 3] ? 1 + (buf[i] >> 3 << 10 | buf[i + 1] >> 3 << 5 | buf[i + 2] >> 3) : 0; a = Math.imul(a ^ v, 16777619); } return w + "x" + h + ":" + (a >>> 0); }
// Copy keeps the pixels for pasting anywhere (another frame, layer or picture), and puts a PNG on the system clipboard where the page may
function pxCopy(cut){
  const s = px.sel; if(!s) return ui.toast("Select something first: the box (M) or the lasso (Q).");
  px.clip = {w:s.w, h:s.h, buf:s.buf ? s.buf.slice() : pxCut(s, false), mask:s.mask ? s.mask.slice() : null};
  (px.mine = px.mine || []).push(pxSig(s.w, s.h, px.clip.buf)); if(px.mine.length > 30) px.mine.shift();   // what this editor put on the system clipboard
  try{ const cv = document.createElement("canvas"); cv.width = s.w; cv.height = s.h; cv.getContext("2d").putImageData(new ImageData(px.clip.buf.slice(), s.w, s.h), 0, 0);
    cv.toBlob(b => { try{ navigator.clipboard.write([new ClipboardItem({"image/png":b})]).catch(() => {}); }catch{} }); }catch{}
  if(cut){ pxPush(); if(s.buf){ s.buf = null; } else pxCut(s, true); px.sel = null; pxChanged(); }
  else ui.toast(`Copied ${s.w}×${s.h}. Paste with Ctrl+V or Paste, here or in another frame, layer or picture.`);
}
// Paste floats the pixels at the cursor (or the top left) to be moved, nudged or dropped with Enter or a click outside
function pxPaste(c = px.clip){
  if(!c) return ui.toast("Nothing copied yet. Select something and Copy, or copy a picture in another app.");
  pxPush();
  px.sel = {x:Math.max(0, Math.min(px.fw - c.w, px.hover ? px.hover[0] : 0)), y:Math.max(0, Math.min(px.fh - c.h, px.hover ? px.hover[1] : 0)), w:c.w, h:c.h, buf:c.buf.slice(), mask:c.mask ? c.mask.slice() : null};
  if(!pxSelTool(px.tool)) pxTool("select"); pxChanged();
}
// A picture from the system clipboard (copied in another app) becomes what pastes
async function pxPasteImage(blob){
  try{
    const im = await pxImg(URL.createObjectURL(blob)), cv = document.createElement("canvas"); cv.width = im.width; cv.height = im.height; const ctx = cv.getContext("2d"); ctx.drawImage(im, 0, 0);
    const buf = new Uint8ClampedArray(ctx.getImageData(0, 0, im.width, im.height).data), c = px.clip;
    if(c && (px.mine || []).includes(pxSig(im.width, im.height, buf))) return pxPaste();   // one of our own copies coming back: the newest copy made here wins, with its lasso shape
    px.clip = {w:im.width, h:im.height, buf, mask:null}; pxPaste();
    if(im.width > px.fw || im.height > px.fh) ui.toast(`The pasted picture is ${im.width}×${im.height}, bigger than the canvas; what's outside is cut off when you drop it.`);
  }catch{ ui.toast("That clipboard picture didn't load.", "bad"); }
}
async function pxPasteButton(){
  if(px.clip) return pxPaste();
  try{ for(const it of await navigator.clipboard.read()){ const t = it.types.find(t => t.startsWith("image/")); if(t) return pxPasteImage(await it.getType(t)); } }catch{}
  pxPaste(null);
}
// The lasso: the drawn path is pixels from the start (each move joined by a pixel line), closed back to its first pixel; the selection
// is that ring and every pixel whose middle is inside it, so its edge always runs along pixel edges
function pxLassoSel(pts){
  const ring = [], all = pts.concat([pts[0]]);
  for(let i = 0; i < all.length - 1; i++) pxLine(all[i][0], all[i][1], all[i + 1][0], all[i + 1][1], (a, b) => ring.push([a, b]));
  const xs = ring.map(p => p[0]), ys = ring.map(p => p[1]), x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(...xs) - x0 + 1, h = Math.max(...ys) - y0 + 1;
  if(new Set(ring.map(p => p + "")).size < 2) return null;   // a click, not a lasso
  const mask = new Uint8Array(w * h); ring.forEach(([a, b]) => { mask[(b - y0) * w + a - x0] = 1; });
  for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
    const cx = x0 + x + .5, cy = y0 + y + .5; let inside = false;
    for(let i = 0, j = pts.length - 1; i < pts.length; j = i++){ const [xi, yi] = [pts[i][0] + .5, pts[i][1] + .5], [xj, yj] = [pts[j][0] + .5, pts[j][1] + .5]; if((yi > cy) !== (yj > cy) && cx < (xj - xi) * (cy - yi) / (yj - yi) + xi) inside = !inside; }
    if(inside) mask[y * w + x] = 1;
  }
  return {x:x0, y:y0, w, h, mask, buf:null};
}
// The outline of a lasso selection, along its pixels' outer edges
function pxMaskPath(s, z){
  const p = new Path2D(), on = (x, y) => x >= 0 && y >= 0 && x < s.w && y < s.h && s.mask[y * s.w + x];
  for(let y = 0; y < s.h; y++) for(let x = 0; x < s.w; x++) if(on(x, y)){
    const X = (s.x + x) * z, Y = (s.y + y) * z;
    if(!on(x, y - 1)){ p.moveTo(X, Y + .5); p.lineTo(X + z, Y + .5); }
    if(!on(x, y + 1)){ p.moveTo(X, Y + z - .5); p.lineTo(X + z, Y + z - .5); }
    if(!on(x - 1, y)){ p.moveTo(X + .5, Y); p.lineTo(X + .5, Y + z); }
    if(!on(x + 1, y)){ p.moveTo(X + z - .5, Y); p.lineTo(X + z - .5, Y + z); }
  }
  return p;
}
function pxClear(){ const s = px.sel; if(!s) return; if(s.buf){ s.buf = null; px.sel = null; } else { pxPush(); pxCut(s, true); } pxChanged(); }

/* ---------- canvas ---------- */
let pxCv, pxCtx, pxStage, pxPrev, pxTmp;
function pxFit(){
  if(!pxStage) return;
  const r = pxStage.getBoundingClientRect(), z = Math.floor(Math.min((r.width - 40) / px.fw, (r.height - 40) / px.fh));
  px.zoom = Math.max(1, Math.min(48, z || 12)); pxDraw();
}
function pxLayer(ctx, f, x, y, z, a){
  pxTmp.width = px.fw; pxTmp.height = px.fh; pxTmp.getContext("2d").putImageData(new ImageData(f.slice(), px.fw, px.fh), 0, 0);
  ctx.globalAlpha = a; ctx.drawImage(pxTmp, x, y, px.fw * z, px.fh * z); ctx.globalAlpha = 1;
}
function pxDraw(){
  if(!pxCv || !px.frames.length) return;
  const z = px.zoom, W = px.fw * z, H = px.fh * z, ctx = pxCtx;
  pxCv.width = W; pxCv.height = H; ctx.imageSmoothingEnabled = false;
  const ck = Math.max(4, Math.min(16, z)); for(let y = 0; y < H; y += ck) for(let x = 0; x < W; x += ck){ ctx.fillStyle = (x / ck + y / ck) % 2 ? "#e4e7df" : "#f5f6f2"; ctx.fillRect(x, y, ck, ck); }   // soft, so the pixels and the cursor stand out
  if(!px.refFront) pxDrawRef(ctx, z);
  if(px.onion && px.frames.length > 1){ ctx.globalAlpha = .28; ctx.drawImage(pxComp((px.cur + px.frames.length - 1) % px.frames.length), 0, 0, W, H); ctx.globalAlpha = 1; }
  const s = px.sel;
  px.layers.forEach((L, l) => { if(L.show) pxLayer(ctx, px.frames[px.cur][l], 0, 0, z, L.alpha); });
  if(px.refFront) pxDrawRef(ctx, z);
  if(s && s.buf){ pxTmp.width = s.w; pxTmp.height = s.h; pxTmp.getContext("2d").putImageData(new ImageData(s.buf.slice(), s.w, s.h), 0, 0); ctx.drawImage(pxTmp, s.x * z, s.y * z, s.w * z, s.h * z); }
  if(px.grid && z >= 6){
    ctx.fillStyle = "rgba(29,43,34,.13)";
    for(let x = 1; x < px.fw; x++) ctx.fillRect(x * z, 0, 1, H);
    for(let y = 1; y < px.fh; y++) ctx.fillRect(0, y * z, W, 1);
  }
  if(px.mirror){ ctx.fillStyle = "rgba(184,145,47,.7)"; ctx.fillRect(W / 2 - 1, 0, 2, H); }
  if(px.guide != null){   // over the footprint's width for this view, centered, with ticks at its ends
    const gw = Math.min(px.fw, px.guideW || px.fw), x0 = Math.round((px.fw - gw) / 2) * z, x1 = x0 + Math.round(gw) * z;
    ctx.fillStyle = "rgba(184,145,47,.9)"; for(let x = x0; x < x1; x += 8) ctx.fillRect(x, px.guide * z - 1, Math.min(5, x1 - x), 2);
    if(px.guideW){
      const hw = Math.max(4, Math.min(8, z)); ctx.fillRect(x0 - hw / 2, px.guide * z - 4 * z, hw, 4 * z + 2); ctx.fillRect(x1 - hw / 2, px.guide * z - 4 * z, hw, 4 * z + 2);   // the handles
    }
  }   // the base row: its bottom stands on the footprint's front edge
  if(s){
    const box = c => s.mask ? ctx.stroke(pxMaskPath(s, z)) : ctx.strokeRect(s.x * z + .5, s.y * z + .5, s.w * z - 1, s.h * z - 1);
    ctx.lineWidth = 1; ctx.setLineDash([4, 3]); ctx.strokeStyle = "#111"; box(); ctx.strokeStyle = "#fff"; ctx.lineDashOffset = 3.5; box(); ctx.setLineDash([]); ctx.lineDashOffset = 0;
  }
  const ls = px.stroke && px.stroke.lasso;
  if(ls){   // the lasso so far, as the pixels it will select along; the dashes close it back to the start
    const pix = []; for(let i = 0; i < ls.length - 1 || i === 0 && ls.length === 1; i++){ const a = ls[i], b = ls[i + 1] || a; pxLine(a[0], a[1], b[0], b[1], (x, y) => pix.push([x, y])); }
    ctx.fillStyle = "rgba(255,255,255,.6)"; ctx.strokeStyle = "#111"; ctx.lineWidth = 1;
    pix.forEach(([x, y]) => { ctx.fillRect(x * z, y * z, z, z); if(z >= 4) ctx.strokeRect(x * z + .5, y * z + .5, z - 1, z - 1); });
    const a = ls[ls.length - 1], b = ls[0]; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo((a[0] + .5) * z, (a[1] + .5) * z); ctx.lineTo((b[0] + .5) * z, (b[1] + .5) * z); ctx.stroke(); ctx.setLineDash([]);
  }
  const h = px.hover;
  if(h && pxIn(h[0], h[1]) && !pxSelTool(px.tool)){   // the pixel under the cursor: a white ring inside a dark one, readable on any color
    const n = px.tool === "pencil" || px.tool === "eraser" ? px.size || 1 : 1, o = Math.floor((n - 1) / 2), x = (h[0] - o) * z, y = (h[1] - o) * z, w = n * z;
    ctx.lineWidth = 3; ctx.strokeStyle = "#fff"; ctx.strokeRect(x - 1.5, y - 1.5, w + 3, w + 3);   // drawn just outside the pixel, so the pixel's own color stays in view
    ctx.lineWidth = 1.5; ctx.strokeStyle = "#111"; ctx.strokeRect(x - .75, y - .75, w + 1.5, w + 1.5);
  }
  const pos = document.getElementById("pxPos"); if(pos) pos.textContent = h && pxIn(h[0], h[1]) ? `${h[0]}, ${h[1]}` : "";
}
function pxPreview(t){
  if(!document.getElementById("dlgPixel")?.open){ px.anim = 0; return; }
  px.anim = requestAnimationFrame(pxPreview);
  if(!pxPrev || !px.frames.length) return;
  const n = px.frames.length, i = n > 1 ? Math.floor(t / 1000 * px.fps) % n : 0, s = Math.max(1, Math.min(4, Math.floor(120 / Math.max(px.fw, px.fh))));
  const ctx = pxPrev.getContext("2d"); if(pxPrev.width !== px.fw * s + px.fw + 12 || pxPrev.height !== px.fh * s){ pxPrev.width = px.fw * s + px.fw + 12; pxPrev.height = px.fh * s; }
  ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, pxPrev.width, pxPrev.height);
  const c = pxComp(i); ctx.drawImage(c, 0, 0, px.fw * s, px.fh * s); ctx.drawImage(c, px.fw * s + 12, px.fh * s - px.fh);
}
const pxXY = e => { const r = pxCv.getBoundingClientRect(); return [Math.floor((e.clientX - r.left) / r.width * px.fw), Math.floor((e.clientY - r.top) / r.height * px.fh)]; };
function pxDown(e){
  if(pxPans(e)) return;   // the stage pans (pxPanStart)
  if(e.button > 2 || !px.frames.length) return;
  e.preventDefault(); pxCv.setPointerCapture(e.pointerId);
  { const h = !e.button && pxFootHit(e); if(h){ px.stroke = {foot:h}; return; } }
  const [x, y] = pxXY(e), alt = e.button === 2, c = alt ? px.c2 : px.c1, f = pxFrame();
  if(px.tool === "picker" || e.altKey){ if(pxIn(x, y)){ const p = pxGet(pxCompData(px.cur), x, y); if(alt) px.c2 = p; else px.c1 = p; pxSync(); } return; }   // the color as it shows, whatever layer it's on
  if(!px.layers[px.lay].show) return ui.toast("This layer is hidden. Show it to draw on it.");
  if(pxSelTool(px.tool)){   // inside the selection a drag moves it; outside, a new box or lasso starts
    const s = px.sel;
    if(s && pxInSel(s, x, y)){
      if(!s.buf){ pxPush(); s.buf = pxCut(s, true); }
      px.stroke = {move:[x - s.x, y - s.y]};
    } else { pxDrop(); px.sel = null; px.stroke = px.tool === "lasso" ? {lasso:[[Math.max(0, Math.min(px.fw - 1, x)), Math.max(0, Math.min(px.fh - 1, y))]]} : {a:[x, y]}; }
    return pxDraw();
  }
  pxPush();
  const ink = px.tool === "eraser" ? [0, 0, 0, 0] : c;
  px.stroke = {a:[x, y], last:[x, y], ink, base:f.slice(), shift:e.shiftKey, up:!alt, done:new Set()};
  if(px.tool === "bucket"){ if(pxIn(x, y)) pxFill(f, x, y, ink, e.shiftKey); px.stroke = null; return pxChanged(); }
  pxMoveTo(x, y, e);
}
function pxMoveTo(x, y, e){
  const st = px.stroke, f = pxFrame(), t = px.tool;
  if(t === "pencil" || t === "eraser"){ pxLine(st.last[0], st.last[1], x, y, (a, b) => pxBrush(f, a, b, st.ink)); st.last = [x, y]; }
  else if(t === "shade"){   // each pixel steps once a stroke, however often the stroke crosses it
    pxLine(st.last[0], st.last[1], x, y, (a, b) => { if(!pxIn(a, b) || st.done.has(a + b * px.fw)) return; st.done.add(a + b * px.fw); pxPut(f, a, b, pxShade(pxGet(f, a, b), st.up)); });
    st.last = [x, y];
  } else {
    f.set(st.base); const fill = e.shiftKey, plot = (a, b) => pxBrush(f, a, b, st.ink);
    if(t === "line") pxLine(st.a[0], st.a[1], x, y, plot);
    else if(t === "rect") pxRect(st.a[0], st.a[1], x, y, fill, plot);
    else if(t === "ellipse") pxEllipse(st.a[0], st.a[1], x, y, fill, plot);
  }
  pxDraw();
}
function pxMove(e){
  if(px.pan) return;
  const [x, y] = pxXY(e); px.hover = [x, y];
  const st = px.stroke;
  if(st && st.foot) return pxFootDrag(e, st.foot);
  const fh = !st && pxFootHit(e); if(fh !== (px.footHover || false)){ px.footHover = fh; pxCv.style.cursor = fh === "w" ? "ew-resize" : fh === "row" ? "ns-resize" : pxCursor(px.tool); }
  if(!st) return pxDraw();
  if(pxSelTool(px.tool)){
    const s = px.sel;
    if(st.lasso){ const p = [Math.max(0, Math.min(px.fw - 1, x)), Math.max(0, Math.min(px.fh - 1, y))], l = st.lasso[st.lasso.length - 1]; if(p[0] !== l[0] || p[1] !== l[1]) st.lasso.push(p); }
    else if(st.move){ s.x = x - st.move[0]; s.y = y - st.move[1]; }
    else { const ax = Math.max(0, Math.min(st.a[0], x)), ay = Math.max(0, Math.min(st.a[1], y)), bx = Math.min(px.fw - 1, Math.max(st.a[0], x)), by = Math.min(px.fh - 1, Math.max(st.a[1], y)); px.sel = {x:ax, y:ay, w:bx - ax + 1, h:by - ay + 1, buf:null}; }
    return pxDraw();
  }
  pxMoveTo(x, y, e);
}
function pxUp(){
  if(px.pan) return;
  const st = px.stroke; px.stroke = null; if(!st) return;
  if(st.foot) return pxChanged();   // saves the footprint with the draft
  if(st.lasso){ px.sel = pxLassoSel(st.lasso); return pxDraw(); }
  if(pxSelTool(px.tool)){ if(st.move) pxChanged(); return; }
  pxChanged();
}
function pxWheel(e){
  e.preventDefault();
  const r = pxCv.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
  const z = Math.max(1, Math.min(64, px.zoom + (e.deltaY < 0 ? 1 : -1) * Math.max(1, Math.round(px.zoom / 6)))); if(z === px.zoom) return;
  px.zoom = z; pxDraw(); pxSync();
  const n = pxCv.getBoundingClientRect(); pxStage.scrollLeft += n.left + fx * n.width - e.clientX; pxStage.scrollTop += n.top + fy * n.height - e.clientY;
}

/* ---------- frames and picture ---------- */
function pxFrameOp(op, i = px.cur){
  pxPush(); const n = px.frames.length;
  if(op === "add"){ px.frames.splice(i + 1, 0, px.layers.map(() => pxBlank(px.fw, px.fh))); px.cur = i + 1; }
  if(op === "dup"){ px.frames.splice(i + 1, 0, px.frames[i].map(l => l.slice())); px.cur = i + 1; }
  if(op === "del" && n > 1){ px.frames.splice(i, 1); px.cur = Math.min(i, n - 2); }
  if((op === "left" && i > 0) || (op === "right" && i < n - 1)){ const j = op === "left" ? i - 1 : i + 1; [px.frames[i], px.frames[j]] = [px.frames[j], px.frames[i]]; px.cur = j; }
  pxChanged();
}
function pxFlip(dir, every){   // the whole picture: every layer
  pxPush();
  for(const f of (every ? px.frames : [px.frames[px.cur]]).flat()){
    const o = f.slice();
    for(let y = 0; y < px.fh; y++) for(let x = 0; x < px.fw; x++){ const s = dir === "h" ? pxAt(px.fw - 1 - x, y) : pxAt(x, px.fh - 1 - y), d = pxAt(x, y); for(let k = 0; k < 4; k++) f[d + k] = o[s + k]; }
  }
  pxChanged();
}
function pxNudge(dx, dy, every){   // the current layer only, so a layer can be lined up against the rest
  pxPush();
  for(const f of every ? px.frames.map(fr => fr[px.lay]) : [pxFrame()]){ const o = f.slice(); f.fill(0); for(let y = 0; y < px.fh; y++) for(let x = 0; x < px.fw; x++) if(pxIn(x + dx, y + dy)){ const s = pxAt(x, y), d = pxAt(x + dx, y + dy); for(let k = 0; k < 4; k++) f[d + k] = o[s + k]; } }
  pxChanged();
}
// New canvas size, the old picture held at the anchor (sprites stand on their bottom middle, so that's the default)
function pxResize(w, h, anchor){
  if(!(w > 0 && h > 0 && w <= 512 && h <= 512)) return ui.toast("Pick a size from 1 to 512 pixels.", "bad");
  pxPush(); const ox = anchor[1] === "l" ? 0 : anchor[1] === "r" ? w - px.fw : Math.floor((w - px.fw) / 2), oy = anchor[0] === "t" ? 0 : anchor[0] === "b" ? h - px.fh : Math.floor((h - px.fh) / 2);
  px.frames = px.frames.map(fr => fr.map(f => { const n = pxBlank(w, h); for(let y = 0; y < px.fh; y++) for(let x = 0; x < px.fw; x++){ const X = x + ox, Y = y + oy; if(X < 0 || Y < 0 || X >= w || Y >= h) continue; const s = pxAt(x, y), d = (Y * w + X) * 4; for(let k = 0; k < 4; k++) n[d + k] = f[s + k]; } return n; }));
  px.fw = w; px.fh = h; pxFit(); pxChanged();
}
async function pxReslice(n){
  const total = px.fw * px.frames.length;
  if(!(n >= 1) || total % n) return ui.toast(`The strip is ${total} px wide, so it splits into a whole number of frames only for counts that divide ${total}.`, "bad");
  pxPush(); const cuts = px.layers.map((_, l) => pxCuts(pxStrip(l), n));   // each layer's strip, cut again
  px.fw = total / n; px.frames = Array.from({length:n}, (_, i) => cuts.map(c => c[i])); px.cur = 0; pxFit(); pxChanged();
}
function pxRecolor(from, to){
  pxPush(); for(const f of px.frames.flat()) for(let i = 0; i < f.length; i += 4) if(pxSame([f[i], f[i + 1], f[i + 2], f[i + 3]], from)){ f[i] = to[0]; f[i + 1] = to[1]; f[i + 2] = to[2]; f[i + 3] = to[3]; }
  pxChanged();
}

/* ---------- layers ---------- */
// Layers run through every frame. Add and Copy go above the current one; Merge down paints it onto the one under it at its opacity.
function pxLayerOp(op){
  const n = px.layers.length, l = px.lay;
  if(op === "del" && n < 2 || op === "up" && l >= n - 1 || (op === "down" || op === "merge") && l < 1) return;
  pxPush();
  if(op === "add"){ px.frames.forEach(f => f.splice(l + 1, 0, pxBlank(px.fw, px.fh))); px.layers.splice(l + 1, 0, pxLayerNew(n + 1)); px.lay = l + 1; }
  if(op === "dup"){ px.frames.forEach(f => f.splice(l + 1, 0, f[l].slice())); px.layers.splice(l + 1, 0, {...px.layers[l], name:(px.layers[l].name + " copy").slice(0, 32)}); px.lay = l + 1; }
  if(op === "del"){ px.frames.forEach(f => f.splice(l, 1)); px.layers.splice(l, 1); px.lay = Math.max(0, l - 1); }
  if(op === "up" || op === "down"){ const j = op === "up" ? l + 1 : l - 1; for(const a of [...px.frames, px.layers]) [a[l], a[j]] = [a[j], a[l]]; px.lay = j; }
  if(op === "merge"){
    const L = px.layers[l];
    px.frames.forEach(f => {
      const cv = document.createElement("canvas"); cv.width = px.fw; cv.height = px.fh; const ctx = cv.getContext("2d");
      ctx.putImageData(new ImageData(f[l - 1].slice(), px.fw, px.fh), 0, 0); if(L.show) pxLayer(ctx, f[l], 0, 0, 1, L.alpha);
      f[l - 1] = new Uint8ClampedArray(ctx.getImageData(0, 0, px.fw, px.fh).data); f.splice(l, 1);
    });
    px.layers.splice(l, 1); px.lay = l - 1;
  }
  pxChanged();
}
const PX_EYE = on => `<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10z"/>${on ? `<circle cx="10" cy="10" r="2.6" fill="currentColor"/>` : `<path d="M3 17L17 3"/>`}</svg>`;
// The layer list, top layer first; rebuilt only when the layers change, so a name being typed keeps its focus
function pxLayersSync(){
  const el = document.getElementById("pxLayers"); if(!px.layers.length){ el.innerHTML = ""; el.dataset.key = ""; return; }
  const key = px.layers.map(L => L.name + L.show).join("|") + px.layers.length;
  if(el.dataset.key !== key && !el.contains(document.activeElement)){
    el.dataset.key = key;
    el.innerHTML = px.layers.map((L, l) => `<div class="pxlrow" data-layer="${l}"><button class="pxeye" data-eye="${l}" title="${L.show ? "Hide" : "Show"} this layer" aria-pressed="${L.show}">${PX_EYE(L.show)}</button><canvas></canvas><input class="pxlname" data-lname="${l}" value="${esc(L.name)}" maxlength="32" aria-label="Layer name"></div>`).reverse().join("");
  }
  el.querySelectorAll(".pxlrow").forEach(r => {
    const l = +r.dataset.layer, cv = r.querySelector("canvas"), s = Math.min(Math.max(1, Math.floor(26 / Math.max(px.fw, px.fh))), 40 / px.fw, 26 / px.fh);   // whole-pixel steps when small, shrunk to fit when big
    r.setAttribute("aria-current", l === px.lay); r.classList.toggle("off", !px.layers[l].show);
    cv.width = Math.max(1, Math.round(px.fw * s)); cv.height = Math.max(1, Math.round(px.fh * s)); const ctx = cv.getContext("2d"); ctx.imageSmoothingEnabled = false; pxLayer(ctx, px.frames[px.cur][l], 0, 0, s, 1);
  });
  const a = Math.round(px.layers[px.lay].alpha * 100); document.getElementById("pxLAlpha").value = a; document.getElementById("pxLAlphaN").textContent = a + "%";
}
// The canvas cursor: a crosshair with a white halo (its hot spot is the pixel drawn on) and the tool's icon beside it, readable on any color
// Panning: the Pan tool, a held Space or the middle button drags the view, from anywhere on the stage
const pxPans = e => e.button === 1 || e.button === 0 && (px.tool === "pan" || px.space);
function pxPanStart(e){
  if(!pxPans(e)) return;
  e.preventDefault(); px.pan = [e.clientX, e.clientY, pxStage.scrollLeft, pxStage.scrollTop]; pxStage.setPointerCapture(e.pointerId); pxStage.classList.add("panning");
}
function pxPanMove(e){ if(!px.pan) return; const [cx, cy, sl, st] = px.pan; pxStage.scrollLeft = sl - (e.clientX - cx); pxStage.scrollTop = st - (e.clientY - cy); }
function pxPanEnd(){ if(!px.pan) return; px.pan = null; pxStage.classList.remove("panning"); }
function pxCursor(t){
  if(t === "pan") return "grab";
  const ch = "M8 0v6M8 10v6M0 8h6M10 8h6", ico = PX_ICONS[t] ? `<g transform="translate(12 12) scale(.9)" fill="none" stroke-linejoin="round" stroke-linecap="round"><path d="${PX_ICONS[t]}" stroke="#fff" stroke-width="5"/><path d="${PX_ICONS[t]}" stroke="#111" stroke-width="2.2"${PX_DASH[t] || ""}/></g>` : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><path d="${ch}" stroke="#fff" stroke-width="4.5"/><path d="${ch}" stroke="#111" stroke-width="2"/>${ico}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 8 8, crosshair`;
}

/* ---------- park and repo ---------- */
// Show the picture in the running park until reload (spriteUrl.swap, then every drawn copy re-pointed)
function pxTry(){
  if(!px.path || !spriteUrl.swap) return;
  spriteUrl.swap(px.path, pxPng());
  // a species with no picture yet gets a stand-in SPRITES entry, so its animals draw from this one right away
  const m = px.path.match(/^sprites\/([a-z0-9]+)(?:-(walk|idle))?\.png$/), id = m && SPECIES_BY_ID[m[1]] && m[1];
  if(id && (!SPRITES[id] || SPRITES[id].tried)){
    const S = SPRITES[id] || (SPRITES[id] = {ratio:px.fw / px.fh, tried:1}), base = `sprites/${id}.png`;
    if(m[2]){ S[m[2]] = px.frames.length; if(m[2] === "idle") S.ms = Math.round(1000 / px.fps); }
    if(m[2] && !SPRITE_PACK[base]) spriteUrl.swap(base, pxFirst());
  }
  pxTryLand(); pxTryBld();
  const u = spriteUrl(px.path);
  document.querySelectorAll("image, img").forEach(el => { const h = el.getAttribute("href") || el.getAttribute("src") || ""; if(h.endsWith("#" + px.path)) el.setAttribute(el.tagName === "IMG" ? "src" : "href", u); });
  if(typeof render === "function" && state) render();
  const el = document.getElementById("pxTryNote");
  if(el){ el.textContent = "In the park until you reload." + pxTryWhere(px.path); el.hidden = false; }
  ui.toast("It's in the park.", "good");
}
// Which in-game state shows a building or prop picture, so a Try that seems to do nothing says why
function pxTryWhere(path){
  const m = path.match(/^sprites\/bld\/([a-zA-Z0-9]+)-(front|back|left|right)(?:-(\d+|broken|full))?\.png$/), t = m && BUILDINGS[m[1]]; if(!t) return "";
  const face = {front:"facing the bottom of the screen", back:"facing the top", left:"facing left", right:"facing right"}[m[2]];
  const when = m[3] === "broken" ? "broken" : m[3] === "full" ? "full" : t.prop ? (m[1] === "bin" ? "working and not full" : "working") : "";
  return ` This one shows on ${t.one || t.label}${t.prop ? ` ${face}` : ` seen from the ${m[2]}`}${when ? `, when it is ${when}` : ""}, in the Genesis theme. Place one and turn it to match.`;
}
const pxFirst = () => pxComp(0).toDataURL("image/png");
// A plant's picture sets its ratio (a new one gets a stand-in PLANT_SPRITES entry); a rock shape is that biome's nth picture for its type
function pxTryLand(){
  const pl = px.path.match(/^sprites\/plants\/([a-z0-9-]+)\.png$/), rk = px.path.match(/^sprites\/rocks\/([a-z]+)-([a-z]+)-(\d+)\.png$/);
  if(pl || rk){ const n = px.path.slice(px.path.lastIndexOf("/") + 1, -4), hit = pxHit(); if(hit){ SPRITE_HIT[n] = hit; hitBands.delete(n); } }   // the tap shape, until spritehit.py measures it for good
  if(pl && LAND[pl[1]] && LAND[pl[1]].flora){ const S = PLANT_SPRITES[pl[1]] || (PLANT_SPRITES[pl[1]] = {size:1, tried:1}); S.ratio = px.fw / px.fh; }
  if(rk && LAND[rk[1]] && BIOMES[rk[2]]){ const B = ROCK_SPRITES[rk[2]] || (ROCK_SPRITES[rk[2]] = {}), l = B[rk[1]] || (B[rk[1]] = []), i = +rk[3] - 1; if(i >= 0 && i <= l.length) l[i] = [px.fw, px.fh]; }
}
// The picture's SPRITE_HIT entry, measured like tools/spritehit.py: [width, height, base half-width, whole half-width, 4 px silhouette bands]
function pxHit(){
  const f = pxCompData(0), w = px.fw, h = px.fh, rows = [];
  for(let y = 0; y < h; y++){ const r = []; for(let x = 0; x < w; x++) if(f[pxAt(x, y) + 3] > 20) r.push(x); rows.push(r); }
  const ys = rows.map((r, y) => r.length ? y : -1).filter(y => y >= 0); if(!ys.length) return null;
  const y0 = ys[0], y1 = ys[ys.length - 1] + 1, xs = rows.flat(), base = rows.slice(Math.max(y0, y1 - Math.max(2, Math.floor((y1 - y0) / 4))), y1).flat(), bands = [];
  for(let by = 0; by < h; by += 4){ const bx = rows.slice(by, by + 4).flat(); bands.push(bx.length ? `${Math.min(...bx)}-${Math.max(...bx)}` : ""); }
  while(bands.length && !bands[bands.length - 1]) bands.pop();
  return [w, h, (Math.max(...base) - Math.min(...base) + 1) / 2, (Math.max(...xs) - Math.min(...xs) + 1) / 2, bands.join(",")];
}
// A building's view: a stand-in BLD_PICS entry for a type with no pictures, growing a view list as views are tried; a prop
// borrows this view for the ones not drawn yet (and its broken state), since its drawing has no fallback. Genesis theme only, like the real ones.
function pxTryBld(){
  const m = px.path.match(/^sprites\/bld\/([a-zA-Z0-9]+)-(front|back|left|right)(?:-(\d+|broken))?\.png$/), t = m && BUILDINGS[m[1]]; if(!t || PX_SKIP_BLD.includes(m[1])) return;
  const k = m[1], v = m[2];
  if(m[3] === "broken"){ if(PROP_PICS[k] && PROP_PICS[k].fake) PROP_PICS[k].fake = PROP_PICS[k].fake.filter(x => x !== px.path); return; }   // a drawn broken picture stops being stood in for
  if(t.prop){
    if(PROP_PICS[k] && !PROP_PICS[k].tried) return;
    const P = PROP_PICS[k] || (PROP_PICS[k] = {tried:1}), png = pxFirst(); P[v] = [px.fw, px.fh, .5, px.guide != null ? px.guide : px.fh - 2]; (P.drawn = P.drawn || []).includes(v) || P.drawn.push(v);
    P.fake = P.fake || [];
    for(const w of PX_VIEWS){
      if(!P.drawn.includes(w)){ P[w] = [px.fw, px.fh, .5, P[v][3]]; spriteUrl.swap(`sprites/bld/${k}-${w}.png`, png); }
      const br = `sprites/bld/${k}-${w}-broken.png`; if(!SPRITE_PACK[br] || P.fake.includes(br)){ spriteUrl.swap(br, SPRITE_PACK[`sprites/bld/${k}-${w}.png`]); if(!P.fake.includes(br)) P.fake.push(br); }
    }
    return;
  }
  if(BLD_PICS[k] && !BLD_PICS[k].tried) return;
  const B = BLD_PICS[k] || (BLD_PICS[k] = {w:px.fw, h:px.fh, base:px.guide != null ? px.guide : px.fh - 9, views:[], tried:1});
  B.w = px.fw; B.h = px.fh; if(px.guide != null) B.base = px.guide; if(!B.views.includes(v)) B.views.push(v); if(m[3]) B.frames = Math.max(B.frames || 1, +m[3]);
  if(!SPRITE_PACK[`sprites/bld/${k}-front.png`]) spriteUrl.swap(`sprites/bld/${k}-front.png`, pxFirst());   // views not drawn yet fall back to the front
}
// Where a picture's base stands: a building's base row, a prop's third row from the bottom (two shadow rows under it)
function pxGuideFor(p){
  const m = p.match(/^sprites\/bld\/([a-zA-Z0-9]+)-(front|back|left|right)/), t = m && BUILDINGS[m[1]]; px.guideW = 0; if(!t) return null;
  px.guideW = (/left|right/.test(m[2]) ? t.d : t.w) / ROCK_MPP;   // sides show the turned footprint
  if(t.prop){ const P = PROP_PICS[m[1]]; return P && P[m[2]] && P[m[2]][3] != null ? P[m[2]][3] : px.fh - 2; }
  const B = BLD_PICS[m[1]]; return B && !B.tried ? (/left|right/.test(m[2]) ? B.sideBase || B.base : B.base) : B ? B.base : px.fh - 9;
}
async function pxDb(){
  if(px.db) return px.db;
  try{ if(window.claude && typeof window.claude.use === "function") px.db = await window.claude.use("db"); }catch{}
  return px.db;
}
const pxDocId = p => p.replace(/\//g, "~");
async function pxWatch(){
  if(px.sub) return; const d = await pxDb(); if(!d || px.sub) return;
  try{ px.sub = d.collection("pixeled").onSnapshot(s => { px.queue = s.docs.map(x => x.data()).filter(x => x && x.path).sort((a, b) => b.at - a.at); pxSync(); }, () => {}); }catch{}
}
async function pxSend(){
  if(!px.path) return;
  const why = pxEmptyWhy(); if(why) return ui.toast(why + " Nothing was sent.", "bad");
  const d = await pxDb(); if(!d) return ui.toast("Sending needs the game open on claude.ai and you signed in. Download it instead.", "bad");
  const png = pxPng();
  try{ await d.doc("pixeled/" + pxDocId(px.path)).set({path:px.path, png, w:px.fw * px.frames.length, h:px.fh, frames:px.frames.length, fps:px.fps, ...(pxFootDiff() ? {foot:pxFootDiff()} : {}), ...(pxBaseDiff() != null ? {base:pxBaseDiff()} : {}), at:Date.now()}); ui.toast(`Sent ${px.path}. Ask Claude to pull your pixel edits into the repo.`, "good"); pxWatch(); }
  catch(e){ ui.toast("That didn't send (" + (e && e.code || "error") + ").", "bad"); }
}
// A draft as the strip the game reads: its visible layers stacked
async function pxDraftPng(dr){
  if(!dr.layers) return dr.png;
  const ims = await Promise.all(dr.layers.map(L => pxImg(L.png))), cv = document.createElement("canvas"), ctx = cv.getContext("2d"); cv.width = ims[0].width; cv.height = ims[0].height;
  dr.layers.forEach((L, l) => { if(L.show !== false){ ctx.globalAlpha = L.alpha ?? 1; ctx.drawImage(ims[l], 0, 0); } });
  return cv.toDataURL("image/png");
}
// Drafts changed since they were last sent (a queue row newer than the draft means it went)
function pxUnsent(){
  const sent = new Map(px.queue.map(x => [x.path, x.at]));
  return Object.entries(pxDrafts()).filter(([path, t]) => !(sent.get(path) >= t)).map(([path]) => path);
}
async function pxSendAll(){
  const d = await pxDb(); if(!d) return ui.toast("Sending needs the game open on claude.ai and you signed in. Download it instead.", "bad");
  pxSaveDraft();
  const todo = pxUnsent(); if(!todo.length) return ui.toast("Nothing new to send.");
  let ok = 0; const blank = [];
  for(const path of todo){
    const dr = pxStored("d:" + path); if(!dr) continue;
    try{ const png = await pxDraftPng(dr), im = await pxImg(png); if(!await pxPngInked(png)){ blank.push(path); continue; } await d.doc("pixeled/" + pxDocId(path)).set({path, png, w:im.width, h:im.height, frames:dr.n || 1, fps:dr.fps || 6, ...(dr.foot ? {foot:dr.foot} : {}), ...(dr.base != null ? {base:dr.base} : {}), at:Date.now()}); ok++; }catch{}
  }
  const fail = todo.length - ok - blank.length, skip = blank.length ? ` Not sent, blank (a hidden layer?): ${blank.join(", ")}.` : "";
  ui.toast((ok ? `Sent ${ok} picture${ok === 1 ? "" : "s"}.${fail ? ` ${fail} didn't send.` : " Ask Claude to pull them into the repo."}` : "None of them sent.") + skip, ok && !skip ? "good" : "bad"); pxWatch();
}
async function pxUnsend(path){ const d = await pxDb(); try{ if(d) await d.doc("pixeled/" + pxDocId(path)).delete(); }catch{} }
async function pxSaveFile(blob, name){
  try{
    const dl = window.claude && await window.claude.use("downloads");
    if(dl){ await dl.save({filename:name, data:blob}); return; }
  }catch(e){ if(e && e.code !== "unavailable") return; }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function pxDownload(){
  const uri = pxPng(), b = atob(uri.split(",")[1]), u = new Uint8Array(b.length); for(let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
  pxSaveFile(new Blob([u], {type:"image/png"}), px.path.split("/").pop() || "sprite.png");
}
/* ---------- the sprite rigger (tools/rigger) ---------- */
// This frame's layers as a rigger project: a layer a part (the rigger's draw order is bottom first, like layers), each a full-cell
// picture with the part where it is drawn, its joint in the middle of its pixels. In the rigger: Load project for a new rig, or
// Update parts to give an existing rig's parts (matched by name) their new pictures and keep the animation.
function pxRigFile(){
  const name = (px.path.split("/").pop() || "critter").replace(/\.png$/, "").replace(/-(walk|idle|rest|swim)$/, ""), o = {name, cell:{w:px.fw, h:px.fh}, ground:px.fh - 1, seq:1, assets:{}, nodes:[], ref:null, clips:[{name:"walk", fps:8, frames:[{}]}], from:"pixel editor " + px.path};
  let low = -1;
  px.layers.forEach((L, l) => {
    const f = px.frames[px.cur][l]; let x0 = px.fw, y0 = px.fh, x1 = -1, y1 = -1;
    for(let y = 0; y < px.fh; y++) for(let x = 0; x < px.fw; x++) if(f[pxAt(x, y) + 3]){ x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    if(x1 < 0) return;   // an empty layer isn't a part
    low = Math.max(low, y1);
    const cv = document.createElement("canvas"); cv.width = px.fw; cv.height = px.fh; cv.getContext("2d").putImageData(new ImageData(f.slice(), px.fw, px.fh), 0, 0);
    const a = "a" + o.seq++, id = "n" + o.seq++, jx = Math.round((x0 + x1 + 1) / 2), jy = Math.round((y0 + y1 + 1) / 2);
    o.assets[a] = cv.toDataURL("image/png");
    o.nodes.push({id, name:L.name, asset:a, px:jx, py:jy, parent:null, lx:jx, ly:jy, flip:false, hidden:!L.show});
  });
  if(low >= 0) o.ground = low + 1;   // the ground line under the lowest pixel, where the feet stand
  return o;
}
function pxToRigger(){
  if(!px.frames.length) return;
  const o = pxRigFile(); if(!o.nodes.length) return ui.toast("Every layer is empty, so there are no parts to send.", "bad");
  pxSaveFile(new Blob([JSON.stringify(o)], {type:"application/json"}), o.name + "-parts.json");
  ui.toast(`Saved ${o.nodes.length} part${o.nodes.length === 1 ? "" : "s"}, a layer each. In the rigger: Load project to start a rig, or Update parts to swap them into a rig you have.`, "good");
}
// A rigger project in, its parts as layers: each drawn where it stands in the rest pose, so a rig's parts can be touched up here and sent back
async function pxFromRigger(o, file){
  if(!o || !o.cell || !Array.isArray(o.nodes) || !o.assets) throw new Error("not a rigger project");
  const w = o.cell.w, h = o.cell.h; if(!(w > 0 && h > 0 && w <= 512 && h <= 512)) throw new Error("its cell size won't fit");
  const by = Object.fromEntries(o.nodes.map(n => [n.id, n])), rest = n => { let x = 0, y = 0, g = 0; while(n && g++ < 60){ x += n.lx; y += n.ly; n = n.parent ? by[n.parent] : null; } return [x, y]; };
  pxDrop(); px.undo.push(pxSnap()); px.redo = [];
  px.fw = w; px.fh = h; px.frames = [[]]; px.layers = []; px.cur = 0; px.sel = null;
  for(const n of o.nodes){
    if(!o.assets[n.asset]) continue;
    const im = await pxImg(o.assets[n.asset]), cv = document.createElement("canvas"); cv.width = w; cv.height = h; const ctx = cv.getContext("2d"), [jx, jy] = rest(n);
    ctx.setTransform(n.flip ? -1 : 1, 0, 0, 1, jx, jy); ctx.drawImage(im, -n.px, -n.py);   // the rigger's rest pose: at its joint, mirrored about it if flipped
    px.frames[0].push(new Uint8ClampedArray(ctx.getImageData(0, 0, w, h).data));
    px.layers.push({name:String(n.name || "part").slice(0, 32), show:!n.hidden && !n.off, alpha:1});
  }
  if(!px.layers.length){ px.frames = [[pxBlank(w, h)]]; px.layers = [pxLayerNew(1)]; }
  px.lay = px.layers.length - 1;
  if(!px.path) px.path = "sprites/" + String(o.name || "critter").replace(/[^a-z0-9_-]/gi, "").toLowerCase() + ".png";
  pxFit(); pxChanged(); ui.toast(`Opened ${file}: ${px.layers.length} parts as layers. Send to rigger gives them back; Update parts there keeps the animation.`);
}
async function pxImport(file){
  if(/\.json$/i.test(file.name) || file.type === "application/json"){
    try{ return await pxFromRigger(JSON.parse(await file.text()), file.name); }catch(e){ return ui.toast("That isn't a rigger project I can read (" + e.message + ").", "bad"); }
  }
  try{
    const im = await pxImg(URL.createObjectURL(file));
    if(im.width > 2048 || im.height > 512) return ui.toast("That picture is too big for a sprite.", "bad");
    pxDrop(); px.undo.push(pxSnap()); px.redo = [];
    if(px.frames.length && im.width === px.fw * px.frames.length && im.height === px.fh){   // the same size as the strip: a new layer on top, to trace or combine
      const cuts = pxCuts(im, px.frames.length); px.frames.forEach((f, i) => f.push(cuts[i]));
      px.layers.push({...pxLayerNew(px.layers.length + 1), name:file.name.replace(/\.[a-z]+$/i, "").slice(0, 24)}); px.lay = px.layers.length - 1;
      pxChanged(); return ui.toast(`Imported ${file.name} as a new layer.`);
    }
    const n = px.path ? pxGuess(px.path, im.width, im.height) : 1;
    pxSlice(im, im.width % n ? 1 : n); px.cur = 0; px.sel = null;
    if(!px.path) px.path = "sprites/" + file.name.replace(/[^a-z0-9._-]/gi, "").toLowerCase();
    pxFit(); pxChanged(); ui.toast(`Imported ${file.name} into ${px.path}. A picture the size of the open strip comes in as a new layer instead.`);
  }catch{ ui.toast("That file isn't a picture I can read.", "bad"); }
}

/* ---------- panel ---------- */
const pxIcon = k => `<svg viewBox="0 0 21 21" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linejoin="round" stroke-linecap="round"><path d="${PX_ICONS[k]}"${PX_DASH[k] || ""}/></svg>`;
function pxBuild(){
  const D = document.getElementById("dlgPixel");
  D.innerHTML = `<div class="pxbar">
    <b class="pxname" id="pxName"></b>
    <button class="btn" data-px="open">Open</button><button class="btn" data-px="new">New</button><label class="btn">Import<input type="file" accept="image/png,image/gif,image/webp,.json,application/json" id="pxFile" hidden></label>
    <span class="pxsep"></span><button class="btn" data-px="undo" title="Undo (Ctrl+Z)">Undo</button><button class="btn" data-px="redo" title="Redo (Ctrl+Y)">Redo</button>
    <span class="pxsep"></span><button class="btn" data-px="copy" title="Copy the selection (Ctrl+C)">Copy</button><button class="btn" data-px="cut" title="Cut the selection (Ctrl+X)">Cut</button><button class="btn" data-px="paste" title="Paste (Ctrl+V): what you copied here, or a picture copied in another app">Paste</button><button class="btn" data-px="selall" title="Select the whole frame (Ctrl+A)">Select all</button>
    <span class="pxsep"></span><button class="btn" data-px="zout" title="Zoom out (-)">−</button><span class="num" id="pxZoom"></span><button class="btn" data-px="zin" title="Zoom in (+)">+</button><button class="btn" data-px="fit">Fit</button>
    <button class="btn" data-px="grid" title="Grid (#)">Grid</button><button class="btn" data-px="mirror" title="Draw mirrored left to right (Shift+M)">Mirror</button>
    <span class="pxgrow"></span><button class="btn primary" data-px="save" title="Save the draft now (Ctrl+S)">Save</button><button class="btn" data-px="revert" title="Drop the draft and reload the game's copy">Revert</button><button class="btn" data-px="close">Close</button></div>
  <div class="pxmain">
    <div class="pxtools">${PX_TOOLS.map(([k, n, key]) => `<button data-tool="${k}" title="${n} (${key})" aria-label="${n}">${pxIcon(k)}</button>`).join("")}
      <div class="pxsize" title="Pencil and eraser size"><small>Size</small>${[1, 2, 3].map(n => `<button data-size="${n}">${n}</button>`).join("")}</div></div>
    <div class="pxstage" id="pxStage"><canvas id="pxCv"></canvas></div>
    <div class="pxside">
      <section><h3>Colors</h3><div class="pxcols"><button class="pxsw big" id="pxC1" title="Left button color"></button><button class="pxsw big" id="pxC2" title="Right button color"></button><button class="btn" data-px="swap" title="Swap (X)">Swap</button>
        <input type="color" id="pxPick" hidden><input type="color" id="pxRe" hidden></div>
        <label class="pxrow"><span>Opacity</span><input type="range" min="0" max="255" id="pxAlpha"><span class="num" id="pxAlphaN"></span></label>
        <div class="pxrow"><select id="pxPal"><option value="image">This picture's colors</option><option value="park">Park style (genesis_style.py)</option><option value="dime">Dimetrodon reference</option></select><span class="meta num" id="pxCount"></span></div>
        <div class="pxpal" id="pxSw"></div><div class="meta">Left or right click to pick. Double-click a color to change it everywhere.</div></section>
      <section><h3>Layers</h3><div class="pxlayers" id="pxLayers"></div>
        <div class="pxrow"><button class="btn" data-px="ladd">Add</button><button class="btn" data-px="ldup">Copy</button><button class="btn" data-px="ldel">Delete</button><button class="btn" data-px="lup" title="Move up">▲</button><button class="btn" data-px="ldown" title="Move down">▼</button><button class="btn" data-px="lmerge" title="Paint this layer onto the one under it">Merge down</button></div>
        <label class="pxrow"><span>Layer opacity</span><input type="range" min="0" max="100" id="pxLAlpha"><span class="num" id="pxLAlphaN"></span></label>
        <div class="pxlrow pxrefrow"><button class="pxeye" data-px="refeye" id="pxRefEye" title="Show or hide the reference"></button><b>Reference</b><select id="pxRef" aria-label="Reference picture"></select><button class="btn" data-px="refup" title="A picture of your own, fitted whole to the canvas">Upload…</button><input type="file" accept="image/*" id="pxRefFile" hidden></div>
        <div class="pxrow"><span>Reference opacity</span><input type="range" min="5" max="100" id="pxRAlpha"><span class="num" id="pxRAlphaN"></span></div>
        <label class="pxrow"><input type="checkbox" id="pxRFront"> Draw the reference over the layers, to trace</label>
        <div class="meta">Every frame has the same layers. Tools draw on the highlighted one; the game gets them flattened. The reference is only a guide and never goes into the picture: an upload is scaled to fit the canvas whole and stands on the bottom middle.</div></section>
      <section><h3>Frames</h3><div class="pxframes" id="pxFrames"></div>
        <div class="pxrow"><button class="btn" data-px="fadd">Add</button><button class="btn" data-px="fdup">Copy</button><button class="btn" data-px="fdel">Delete</button><button class="btn" data-px="fleft" title="Move earlier">◀</button><button class="btn" data-px="fright" title="Move later">▶</button></div>
        <label class="pxrow"><span>Speed</span><input type="number" min="1" max="30" id="pxFps" class="pxnum"><span>a second</span><label><input type="checkbox" id="pxOnion"> Onion skin</label></label>
        <canvas id="pxPrev"></canvas><div class="meta">Preview, then at game size (1 pixel a pixel).</div></section>
      <section><h3>Picture</h3>
        <div class="pxrow"><input type="number" id="pxW" class="pxnum" min="1" max="512"><span>×</span><input type="number" id="pxH" class="pxnum" min="1" max="512"><select id="pxAnchor"><option value="bc">Keep bottom middle</option><option value="tl">Keep top left</option><option value="cc">Keep center</option></select><button class="btn" data-px="resize">Resize</button></div>
        <div class="pxrow"><span>Strip of</span><input type="number" id="pxN" class="pxnum" min="1" max="128"><span>frames</span><button class="btn" data-px="reslice">Split</button></div>
        <div class="pxrow"><button class="btn" data-px="fliph">Flip ↔</button><button class="btn" data-px="flipv">Flip ↕</button><label><input type="checkbox" id="pxAll"> All frames</label></div>
        <label class="pxrow" id="pxFootTog" hidden><input type="checkbox" id="pxFootEdit"> Adjust footprint: drag the gold line's ends for its size, the line itself for its row</label>
        <div class="meta" id="pxGuideNote" hidden>The gold dashes are the base's bottom row, as wide as the footprint in this view: it stands on the footprint's front edge. Keep it on the same row in every view. With Adjust footprint on, drag its end handles to change the footprint (the depth on a side view) or the line to move its row; the park uses them at once, and they go with the picture when you send it.</div>
        <div class="meta">Shift+arrows nudge the current layer a pixel. Light comes from the top left; 0.13 m a pixel.</div></section>
      <section><h3>Keep it</h3><div class="pxrow"><button class="btn primary" data-px="try">Try in park</button><button class="btn primary" data-px="send">Send to repo</button><button class="btn" data-px="sendall" id="pxSendAll" title="Send every picture you have changed and not sent yet">Send all drafts</button><button class="btn" data-px="download">Download</button></div>
        <div class="meta" id="pxTryNote" hidden></div>
        <div class="pxrow"><button class="btn" data-px="rigger" title="Save this frame's layers as parts for the sprite rigger">Send to rigger</button><span class="meta">A layer a part. Import a rigger project to get its parts back as layers.</span></div>
        <div id="pxQueue"></div></section>
    </div></div>
  <div class="pxover" id="pxOver" hidden></div>`;
  pxCv = document.getElementById("pxCv"); pxCtx = pxCv.getContext("2d"); pxStage = document.getElementById("pxStage"); pxPrev = document.getElementById("pxPrev"); pxTmp = document.createElement("canvas");
  pxCv.addEventListener("pointerdown", pxDown); pxCv.addEventListener("pointermove", pxMove); pxCv.addEventListener("pointerup", pxUp); pxCv.addEventListener("pointercancel", pxUp);
  pxCv.style.cursor = pxCursor(px.tool);
  pxCv.addEventListener("pointerleave", () => { px.hover = null; pxDraw(); }); pxCv.addEventListener("contextmenu", e => e.preventDefault());
  pxStage.addEventListener("wheel", pxWheel, {passive:false});
  pxStage.addEventListener("pointerdown", e => { pxPanStart(e); if(!px.pan && e.target === pxStage && pxSelTool(px.tool)){ pxDrop(); px.sel = null; pxChanged(); } });
  pxStage.addEventListener("pointermove", pxPanMove); pxStage.addEventListener("pointerup", pxPanEnd); pxStage.addEventListener("pointercancel", pxPanEnd);
  D.addEventListener("click", pxClick); D.addEventListener("dblclick", pxDbl); D.addEventListener("contextmenu", pxRight);
  D.addEventListener("input", pxInput); D.addEventListener("change", pxInput);
  document.addEventListener("keydown", e => { if(D.open) pxKey(e); });
  document.addEventListener("paste", e => {
    if(!D.open || /INPUT|TEXTAREA/.test(document.activeElement?.tagName || "")) return;
    const f = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith("image/"));
    if(f){ clearTimeout(px.pasteT); e.preventDefault(); pxPasteImage(f.getAsFile()); }
  }); document.addEventListener("keyup", e => { if(e.key === " "){ px.space = false; pxStage.classList.remove("grab"); } });
  D.addEventListener("cancel", e => { if(px.sel || !document.getElementById("pxOver").hidden){ e.preventDefault(); pxEsc(); } });
  D.addEventListener("close", () => { pxDrop(); clearTimeout(pxSaveT); if(px.path && px.frames.length){ pxStore("d:" + px.path, pxDraft()); } });
  px.built = true;
}
function pxSync(){
  if(!px.built) return; const $p = id => document.getElementById(id);
  $p("pxName").textContent = px.path ? `${px.path}  ${px.fw}×${px.fh}${px.frames.length > 1 ? `, ${px.frames.length} frames` : ""}` : "No picture open";
  $p("pxZoom").textContent = px.zoom + "×";
  document.querySelectorAll("#dlgPixel [data-tool]").forEach(b => b.setAttribute("aria-pressed", b.dataset.tool === px.tool));
  document.querySelectorAll("#dlgPixel [data-size]").forEach(b => b.setAttribute("aria-pressed", +b.dataset.size === (px.size || 1)));
  document.querySelector('#dlgPixel [data-px="grid"]').setAttribute("aria-pressed", px.grid);
  document.querySelector('#dlgPixel [data-px="mirror"]').setAttribute("aria-pressed", px.mirror);
  $p("pxC1").style.background = px.c1[3] ? pxCss(px.c1) : ""; $p("pxC1").classList.toggle("clear", !px.c1[3]);
  $p("pxC2").style.background = px.c2[3] ? pxCss(px.c2) : ""; $p("pxC2").classList.toggle("clear", !px.c2[3]);
  $p("pxAlpha").value = px.c1[3]; $p("pxAlphaN").textContent = px.c1[3];
  $p("pxPal").value = px.pal;
  const sw = pxSwatches(), used = px.pal === "image" ? sw.length : pxUsed().length;
  $p("pxCount").textContent = `${used} color${used === 1 ? "" : "s"} used`; $p("pxCount").classList.toggle("warn", used > 28);
  $p("pxSw").innerHTML = sw.map(c => `<button class="pxsw" data-c="${c.join(",")}" style="background:${pxCss(c)}" title="${pxHex(c)}${c[3] < 255 ? ` at ${c[3]}` : ""}"></button>`).join("") + `<button class="pxsw clear" data-c="0,0,0,0" title="Clear"></button>`;
  const fr = $p("pxFrames");
  if(fr.children.length !== px.frames.length) fr.innerHTML = px.frames.map((_, i) => `<button data-frame="${i}"><canvas></canvas><span>${i + 1}</span></button>`).join("");
  [...fr.children].forEach((b, i) => {
    b.setAttribute("aria-pressed", i === px.cur);
    const cv = b.querySelector("canvas"), s = Math.max(1, Math.floor(44 / Math.max(px.fw, px.fh)));
    cv.width = px.fw * s; cv.height = px.fh * s; const ctx = cv.getContext("2d"); ctx.imageSmoothingEnabled = false; ctx.drawImage(pxComp(i), 0, 0, cv.width, cv.height);
  });
  pxLayersSync();
  const refs = ["", ...(px.refUrl ? ["upload"] : []), ...Object.keys(SPRITES).filter(id => !SPRITES[id].tried && SPRITE_PACK[`sprites/${id}.png`]).map(id => `sprites/${id}.png`)];
  if($p("pxRef").options.length !== refs.length) $p("pxRef").innerHTML = refs.map(r => `<option value="${r}">${r === "upload" ? "Your picture" : r ? esc(SPECIES_BY_ID[r.slice(8, -4)]?.name || r) : "Nothing"}</option>`).join("");
  $p("pxRef").value = px.ref; $p("pxRefEye").innerHTML = PX_EYE(px.refShow); $p("pxRefEye").setAttribute("aria-pressed", px.refShow);
  $p("pxRAlpha").value = Math.round(px.refAlpha * 100); $p("pxRAlphaN").textContent = Math.round(px.refAlpha * 100) + "%"; $p("pxRFront").checked = px.refFront; $p("pxGuideNote").hidden = px.guide == null; $p("pxFootTog").hidden = px.guide == null || !pxFootType(); $p("pxFootEdit").checked = !!px.footEdit;
  $p("pxFps").value = px.fps; $p("pxOnion").checked = px.onion;
  if(document.activeElement !== $p("pxW")) $p("pxW").value = px.fw;
  if(document.activeElement !== $p("pxH")) $p("pxH").value = px.fh;
  if(document.activeElement !== $p("pxN")) $p("pxN").value = px.frames.length;
  const un = pxUnsent().length; $p("pxSendAll").textContent = un > 1 ? `Send all drafts (${un})` : "Send all drafts";
  const q = $p("pxQueue");
  q.innerHTML = !px.db ? `<div class="meta">Sending works when the game is open on claude.ai. Download works anywhere.</div>`
    : !px.queue.some(x => !x.pulled) ? `<div class="meta">Nothing waiting. Sent pictures wait here until Claude pulls them into the repo.</div>`
    : `<div class="meta">Waiting for the repo:</div><ul class="pxq">${px.queue.filter(x => !x.pulled).map(x => `<li><button class="linkish" data-openp="${esc(x.path)}">${esc(x.path)}</button><span class="meta"> ${new Date(x.at).toLocaleString([], {month:"short", day:"numeric", hour:"numeric", minute:"2-digit"})}</span><button class="btn" data-unsend="${esc(x.path)}" title="Take it off the list">×</button></li>`).join("")}</ul>`;
}
function pxSelectAll(){ pxDrop(); px.sel = {x:0, y:0, w:px.fw, h:px.fh, buf:null, mask:null}; if(!pxSelTool(px.tool)) pxTool("select"); else pxDraw(); }
function pxTool(t){ if(pxSelTool(px.tool) && !pxSelTool(t)){ pxDrop(); px.sel = null; } px.tool = t; if(pxCv) pxCv.style.cursor = pxCursor(t); pxSync(); pxDraw(); }
function pxZoom(d){ px.zoom = Math.max(1, Math.min(64, px.zoom + d * Math.max(1, Math.round(px.zoom / 6)))); pxDraw(); pxSync(); }
function pxEsc(){ const o = document.getElementById("pxOver"); if(!o.hidden){ o.hidden = true; return; } if(px.sel){ pxDrop(); px.sel = null; pxChanged(); } }
// Overlays: the picture list and the new-picture form
function pxOverlay(kind, opt){
  const o = document.getElementById("pxOver"); o.hidden = false;
  if(kind === "new"){
    const tpl = opt && opt.tpl || "animal", sp = opt && opt.sp || pxNeedArt()[0]?.id || SPECIES[0].id;
    o.innerHTML = `<div class="pxcard"><h2>New picture</h2>
      <label class="field"><span>What it is</span><select id="pxNt">${Object.entries(PX_TEMPLATES).map(([k, t]) => `<option value="${k}"${k === tpl ? " selected" : ""}>${esc(t[0])}</option>`).join("")}</select></label>
      <label class="field" id="pxNsF"><span>Species</span><select id="pxNs">${pxSpeciesOrder().map(s => `<option value="${s.id}"${s.id === sp ? " selected" : ""}>${esc(s.name)} (${esc(s.period)})${SPRITES[s.id] && !SPRITES[s.id].tried ? ", has art" : ""}</option>`).join("")}</select></label>
      <label class="field" id="pxNmF"><span>Name</span><input id="pxNm" value="${esc(opt && opt.name || "new")}" autocomplete="off"></label>
      <label class="field" id="pxNvF"><span>View</span><select id="pxNv">${PX_VIEWS.map(v => `<option${opt && opt.view === v ? " selected" : ""}>${v}</option>`).join("")}</select></label>
      <label class="field"><span>Path in the repo</span><input id="pxNp"></label>
      <div class="pxrow"><label class="field"><span>Width</span><input type="number" id="pxNw" min="1" max="512"></label><label class="field"><span>Height</span><input type="number" id="pxNh" min="1" max="512"></label><label class="field"><span>Frames</span><input type="number" id="pxNn" min="1" max="64"></label></div>
      <label class="pxrow"><input type="checkbox" id="pxNr" checked> Show another animal faintly underneath, for size</label>
      <div class="pxrow"><button class="btn" data-px="cancel">Cancel</button><button class="btn primary" data-px="create">Create</button></div></div>`;
    pxNewFill(true); if(opt && opt.w){ document.getElementById("pxNw").value = opt.w; document.getElementById("pxNh").value = opt.h; } return;
  }
  const drafts = pxDrafts(), cats = {animal:"Animals", plant:"Plants", bld:"Buildings", rock:"Rocks"};
  if(px.tab === "need") px.tab = "animal";
  const undr = !!pxStored("undrawn"), needsOf = c => c === "all" ? ["animal", "plant", "bld"].flatMap(pxNeeds) : pxNeeds(c);
  o.innerHTML = `<div class="pxcard wide"><div class="pxrow"><h2>Open a picture</h2><span class="pxgrow"></span><button class="btn" data-px="cancel">Cancel</button></div>
    <div class="pxrow pxtabs"><button class="btn" data-pxtab="all">Pictures</button>${Object.entries(cats).map(([k, l]) => `<button class="btn" data-pxtab="${k}">${l} (${pxDrawn(k).length}${k === "rock" ? "" : `, ${pxNeeds(k).length} undrawn`})</button>`).join("")}<span class="pxgrow"></span><label class="pxrow"><input type="checkbox" id="pxUndr"${undr ? " checked" : ""}> Undrawn only</label></div>
    <input id="pxQ" placeholder="${px.tab === "all" ? "Search, like dime or bld/restroom" : "Search"}" autocomplete="off"><div class="pxlist" id="pxList"></div></div>`;
  o.querySelectorAll("[data-pxtab]").forEach(b => b.setAttribute("aria-pressed", b.dataset.pxtab === px.tab));
  const q = document.getElementById("pxQ"), u = document.getElementById("pxUndr"); q.value = pxStored("q") || ""; q.focus(); q.select();
  const list = () => {
    const t = q.value.trim().toLowerCase(), only = u.checked; pxStore("q", t); pxStore("undrawn", only ? 1 : 0);
    const note = s => `<p class="meta" style="grid-column:1/-1">${s}</p>`, hit = x => !t || (x.label + " " + x.sub).toLowerCase().includes(t);
    px.needList = needsOf(px.tab).filter(hit);
    const needBtn = (x, i) => `<button data-need="${i}"><b>${esc(x.label)}</b><span>${esc(x.sub)}</span><span>${esc(x.note || "")}${drafts[x.path] ? " <i>draft</i>" : ""}</span></button>`;
    const thumb = p => SPRITE_PACK[p] ? spriteUrl(p) : (pxStored("d:" + p)?.layers || []).find(L => L.show !== false)?.png || "";
    const drawnBtn = p => `<button data-openp="${esc(p)}"><img loading="lazy" src="${thumb(p)}" alt=""><span>${esc(p.replace(/^sprites\//, ""))}${drafts[p] ? " <i>draft</i>" : ""}</span></button>`;
    const ps = only ? [] : pxDrawn(px.tab).filter(p => !t || p.toLowerCase().includes(t)).sort((a, b) => (drafts[b] || 0) - (drafts[a] || 0) || a.localeCompare(b));
    const html = px.needList.map(needBtn).join("") + ps.map(drawnBtn).join("");
    document.getElementById("pxList").innerHTML = note(`${ps.length + px.needList.length} shown${only ? ", undrawn only" : ""}.`) + (html || note("Nothing matches that."));
  };
  q.oninput = list; u.onchange = list; list();
}
// Every picture in the pack that belongs to a category (animal pictures and rig parts are named by species id)
function pxDrawn(cat){
  const ps = [...new Set([...Object.keys(SPRITE_PACK), ...Object.keys(pxDrafts())])];   // a draft of a picture the game doesn't have yet is listed too, or it could only be found by retyping its path
  if(cat === "all") return ps;
  if(cat === "plant") return ps.filter(p => p.startsWith("sprites/plants/"));
  if(cat === "bld") return ps.filter(p => p.startsWith("sprites/bld/"));
  if(cat === "rock") return ps.filter(p => p.startsWith("sprites/rocks/"));
  return ps.filter(p => SPECIES_BY_ID[p.slice(8).split(/[\/.-]/)[0]]);
}
// What still has no picture, as entries for the new-picture form: species (dots), plants, buildings and props (drawn boxes), and one more shape for each biome's rocks
function pxNeeds(cat){
  if(cat === "animal") return pxNeedArt().map(s => ({label:s.name, sub:s.period + (s.viv ? ", vivarium" : ""), note:LAUNCH_ROSTER.includes(s.id) ? "In the launch roster" : "", path:`sprites/${s.id}.png`, opt:{tpl:"animal", sp:s.id}}));
  if(cat === "plant") return Object.keys(LAND).filter(k => LAND[k].flora && (!PLANT_SPRITES[k] || PLANT_SPRITES[k].tried))
    .map(k => ({label:LAND[k].label, sub:k, note:"", path:`sprites/plants/${k}.png`, opt:{tpl:/small$/.test(k) ? "plantS" : /medium$/.test(k) ? "plantM" : "plant", name:k}}));
  if(cat === "bld") return Object.entries(BUILDINGS).filter(([k, t]) => !PX_SKIP_BLD.includes(k) && (t.prop ? !PROP_PICS[k] || PROP_PICS[k].tried : !BLD_PICS[k] || BLD_PICS[k].tried)).map(([k, t]) => {
    const c = Math.ceil(Math.max(t.w, t.d) / ROCK_MPP), w = t.prop ? c + 2 : c + 18 + c % 2, h = t.prop ? Math.round(w * 1.5) : w;
    return {label:t.label, sub:`${t.w} × ${t.d} m${t.prop ? ", a prop" : ""}`, note:"Four views: front, back, left, right", path:`sprites/bld/${k}-front.png`, opt:{tpl:t.prop ? "prop" : "bld", name:k, view:"front", w, h}};
  });
  return Object.keys(BIOMES).flatMap(b => ROCK_TYPES.filter(ty => LAND[ty]).map(ty => {
    const l = (ROCK_SPRITES[b] || {})[ty] || [], avg = i => l.length ? Math.round(l.reduce((a, d) => a + d[i], 0) / l.length) : ty === "boulder" ? [40, 30][i] : [24, 18][i], n = l.length + 1;
    return {label:`${LAND[ty].label}, ${BIOMES[b].label}`, sub:`${l.length} shape${l.length === 1 ? "" : "s"} now`, note:"Add another shape", path:`sprites/rocks/${ty}-${b}-${n}.png`, opt:{tpl:"rock", name:`${ty}-${b}-${n}`, w:avg(0), h:avg(1)}};
  }));
}
// Species still drawn as dots: the launch roster first, then by period
const pxNeedArt = () => pxSpeciesOrder().filter(s => !SPRITES[s.id] || SPRITES[s.id].tried);
const pxSpeciesOrder = () => SPECIES.slice().sort((a, b) => (!!SPRITES[a.id] && !SPRITES[a.id].tried) - (!!SPRITES[b.id] && !SPRITES[b.id].tried) || !LAUNCH_ROSTER.includes(a.id) - !LAUNCH_ROSTER.includes(b.id));
// The new-picture form: a template sets the size, frames and path; the size and path can still be typed over
function pxNewFill(sized){
  const g = id => document.getElementById(id), t = PX_TEMPLATES[g("pxNt").value], animal = t[4].includes("{id}");
  g("pxNsF").hidden = !animal; g("pxNmF").hidden = animal; g("pxNr").parentElement.hidden = !animal; g("pxNvF").hidden = !t[4].includes("{view}");
  const name = g("pxNm").value.trim().replace(/[^a-zA-Z0-9_-]+/g, "-") || "new";
  g("pxNp").value = t[4].replace("{id}", g("pxNs").value).replace("{name}", name).replace("{view}", g("pxNv").value);
  if(sized){ g("pxNw").value = t[1]; g("pxNh").value = t[2]; g("pxNn").value = t[3]; }
}
// The reference: a guide drawn faintly under the layers (or over them, to trace), never part of the picture. Either a game sprite at
// its own size (an animal with art, to match size and feet against) or a picture of your own, fitted whole to the canvas.
async function pxSetRef(path){
  px.ref = path || ""; px.refCv = null;
  const src = path === "upload" ? px.refUrl : path && SPRITE_PACK[path];
  if(src) try{ const im = await pxImg(src), cv = document.createElement("canvas"); cv.width = im.width; cv.height = im.height; cv.getContext("2d").drawImage(im, 0, 0); px.refCv = cv; }catch{}
  pxDraw(); pxSync();
}
// Where the reference sits, in sprite pixels: an upload scaled to fit inside the canvas with nothing cut off, a sprite at its own size, both on the bottom middle
function pxRefBox(){
  const r = px.refCv; if(!r) return null;
  const k = px.ref === "upload" ? Math.min(px.fw / r.width, px.fh / r.height) : 1, w = r.width * k, h = r.height * k;
  return [(px.fw - w) / 2, px.fh - h, w, h];
}
function pxDrawRef(ctx, z){
  const b = pxRefBox(); if(!b || !px.refShow) return;
  ctx.save(); ctx.globalAlpha = px.refAlpha; ctx.imageSmoothingEnabled = px.ref === "upload";   // a photo or sketch reads better smooth; a sprite stays pixel sharp
  ctx.drawImage(px.refCv, Math.round(b[0] * z), Math.round(b[1] * z), Math.round(b[2] * z), Math.round(b[3] * z)); ctx.restore();
}
// An uploaded picture, kept at most 512 px on its long side (plenty to trace from, small enough for the draft)
async function pxRefUpload(file){
  try{
    const im = await pxImg(URL.createObjectURL(file)), k = Math.min(1, 512 / Math.max(im.width, im.height)), cv = document.createElement("canvas");
    cv.width = Math.max(1, Math.round(im.width * k)); cv.height = Math.max(1, Math.round(im.height * k)); const ctx = cv.getContext("2d"); ctx.imageSmoothingQuality = "high"; ctx.drawImage(im, 0, 0, cv.width, cv.height);
    px.refUrl = cv.toDataURL("image/png"); px.refShow = true; await pxSetRef("upload"); pxChanged();
  }catch{ ui.toast("That file isn't a picture I can read.", "bad"); }
}
function pxClick(e){
  const b = e.target.closest("button"), row = e.target.closest("[data-layer]");
  if(b && e.detail) b.blur();   // a mouse-clicked button lets go of focus, so Enter, Delete and the arrows go to the canvas, not the button again
  if(b && b.dataset.eye){ const L = px.layers[+b.dataset.eye]; L.show = !L.show; return pxChanged(); }
  if(row && +row.dataset.layer !== px.lay){ pxDrop(); px.sel = null; px.lay = +row.dataset.layer; pxDraw(); pxSync(); }
  if(!b) return;
  if(b.dataset.tool) return pxTool(b.dataset.tool);
  if(b.dataset.size){ px.size = +b.dataset.size; return pxSync(); }
  if(b.dataset.frame !== undefined){ pxDrop(); px.sel = null; px.cur = +b.dataset.frame; pxDraw(); return pxSync(); }
  if(b.dataset.c){ if(e.detail < 2){ px.c1 = b.dataset.c.split(",").map(Number); pxSync(); } return; }
  if(b.dataset.openp){ document.getElementById("pxOver").hidden = true; return pxOpen(b.dataset.openp); }
  if(b.dataset.unsend) return pxUnsend(b.dataset.unsend);
  if(b.dataset.pxtab){ px.tab = b.dataset.pxtab; return pxOverlay("open"); }
  if(b.dataset.need){ const x = px.needList[+b.dataset.need]; if(pxStored("d:" + x.path)){ document.getElementById("pxOver").hidden = true; return pxOpen(x.path); } return pxOverlay("new", x.opt); }
  if(b.id === "pxC1"){ const p = document.getElementById("pxPick"); p.value = pxHex(px.c1); p.dataset.which = "c1"; return p.click(); }
  if(b.id === "pxC2"){ const p = document.getElementById("pxPick"); p.value = pxHex(px.c2); p.dataset.which = "c2"; return p.click(); }
  const a = b.dataset.px, all = document.getElementById("pxAll")?.checked;
  ({open:() => pxOverlay("open"), new:() => pxOverlay("new"), cancel:() => { document.getElementById("pxOver").hidden = true; },
    create:() => { const p = document.getElementById("pxNp").value.trim(), w = +document.getElementById("pxNw").value, h = +document.getElementById("pxNh").value, n = +document.getElementById("pxNn").value;
      if(!/^sprites\/[a-z0-9_\/-]+\.png$/i.test(p) || p.includes("..")) return ui.toast("The path should look like sprites/name.png.", "bad");
      if(!(w >= 1 && h >= 1 && w <= 512 && h <= 512 && n >= 1 && n <= 64)) return ui.toast("Pick a size from 1 to 512 pixels and 1 to 64 frames.", "bad");
      const ref = !document.getElementById("pxNsF").hidden && document.getElementById("pxNr").checked;
      document.getElementById("pxOver").hidden = true; pxNew(p, w, h, n); pxSetRef(ref && w === 100 && h === 75 ? "sprites/dime.png" : "").then(pxChanged); },
    undo:() => pxUndo(false), redo:() => pxUndo(true), zin:() => pxZoom(1), zout:() => pxZoom(-1), fit:pxFit,
    grid:() => { px.grid = !px.grid; pxDraw(); pxSync(); }, mirror:() => { px.mirror = !px.mirror; pxDraw(); pxSync(); },
    save:() => pxSaveNow(),
    revert:() => { if(!px.path || !SPRITE_PACK[px.path]) return ui.toast("This picture isn't in the game yet, so there's nothing to revert to."); const d = pxDrafts(); delete d[px.path]; pxStore("drafts", d); pxStore("d:" + px.path); pxOpen(px.path, true); },
    close:() => document.getElementById("dlgPixel").close(), swap:() => { [px.c1, px.c2] = [px.c2, px.c1]; pxSync(); },
    ladd:() => pxLayerOp("add"), ldup:() => pxLayerOp("dup"), ldel:() => pxLayerOp("del"), lup:() => pxLayerOp("up"), ldown:() => pxLayerOp("down"), lmerge:() => pxLayerOp("merge"),
    fadd:() => pxFrameOp("add"), fdup:() => pxFrameOp("dup"), fdel:() => pxFrameOp("del"), fleft:() => pxFrameOp("left"), fright:() => pxFrameOp("right"),
    resize:() => pxResize(+document.getElementById("pxW").value, +document.getElementById("pxH").value, document.getElementById("pxAnchor").value),
    reslice:() => pxReslice(+document.getElementById("pxN").value), fliph:() => pxFlip("h", all), flipv:() => pxFlip("v", all),
    refup:() => document.getElementById("pxRefFile").click(), refeye:() => { px.refShow = !px.refShow; pxChanged(); },
    copy:() => pxCopy(false), cut:() => pxCopy(true), paste:pxPasteButton, selall:pxSelectAll,
    try:pxTry, send:pxSend, sendall:pxSendAll, download:pxDownload, rigger:pxToRigger}[a] || (() => {}))();
}
function pxDbl(e){ const b = e.target.closest("[data-c]"); if(!b || b.dataset.c === "0,0,0,0") return; const r = document.getElementById("pxRe"); r.dataset.from = b.dataset.c; r.value = pxHex(b.dataset.c.split(",").map(Number)); r.click(); }
function pxRight(e){ const b = e.target.closest("[data-c]"); if(!b) return; e.preventDefault(); px.c2 = b.dataset.c.split(",").map(Number); pxSync(); }
function pxInput(e){
  const t = e.target, id = t.id;
  if(id === "pxPick"){ const c = pxRgb(t.value), w = t.dataset.which; px[w] = [...c, px[w][3] || 255]; pxSync(); }
  else if(id === "pxRe" && e.type === "change"){ const from = t.dataset.from.split(",").map(Number); pxRecolor(from, [...pxRgb(t.value), from[3]]); }
  else if(id === "pxAlpha"){ px.c1 = [...px.c1.slice(0, 3), +t.value]; pxSync(); }
  else if(id === "pxPal"){ px.pal = t.value; if(px.pal === "dime" && !px.dime) pxDime(); pxSync(); }
  else if(id === "pxFootEdit"){ px.footEdit = t.checked; px.footHover = false; pxCv.style.cursor = pxCursor(px.tool); pxDraw(); }
  else if(id === "pxFps"){ px.fps = Math.max(1, Math.min(30, +t.value || 6)); }
  else if(id === "pxNt") pxNewFill(true);
  else if(id === "pxNs" || id === "pxNm" || id === "pxNv") pxNewFill(false);
  else if(id === "pxRef"){ pxSetRef(t.value).then(pxChanged); }
  else if(id === "pxRefFile" && t.files[0]){ pxRefUpload(t.files[0]); t.value = ""; }
  else if(id === "pxRAlpha"){ px.refAlpha = +t.value / 100; document.getElementById("pxRAlphaN").textContent = t.value + "%"; pxDraw(); if(e.type === "change") pxChanged(); }
  else if(id === "pxRFront"){ px.refFront = t.checked; pxChanged(); }
  else if(id === "pxLAlpha"){ px.layers[px.lay].alpha = +t.value / 100; document.getElementById("pxLAlphaN").textContent = t.value + "%"; pxDraw(); if(e.type === "change") pxChanged(); }
  else if(t.dataset.lname && e.type === "change"){ px.layers[+t.dataset.lname].name = t.value.trim().slice(0, 32) || "Layer"; t.blur(); pxChanged(); }
  else if(id === "pxOnion"){ px.onion = t.checked; pxDraw(); }
  else if(id === "pxFile" && t.files[0]){ pxImport(t.files[0]); t.value = ""; }
}
async function pxDime(){
  try{
    const im = await pxImg(SPRITE_PACK["sprites/dime.png"]), cv = document.createElement("canvas"); cv.width = im.width; cv.height = im.height; const ctx = cv.getContext("2d"); ctx.drawImage(im, 0, 0);
    const d = ctx.getImageData(0, 0, im.width, im.height).data, seen = new Map();
    for(let i = 0; i < d.length; i += 4) if(d[i + 3]) seen.set(`${d[i]},${d[i + 1]},${d[i + 2]},${d[i + 3]}`, 1);
    px.dime = [...seen.keys()].map(k => k.split(",").map(Number)).sort((a, b) => pxHsl(a)[0] - pxHsl(b)[0] || pxHsl(a)[2] - pxHsl(b)[2]); pxSync();
  }catch{}
}
function pxKey(e){
  if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && e.target.type !== "checkbox") return;
  if(!document.getElementById("pxOver").hidden) return;
  const k = e.key, ctl = e.ctrlKey || e.metaKey;
  if(k === " "){ px.space = true; pxStage.classList.add("grab"); e.preventDefault(); return; }
  if(ctl && k.toLowerCase() === "z"){ e.preventDefault(); return pxUndo(e.shiftKey); }
  if(ctl && k.toLowerCase() === "y"){ e.preventDefault(); return pxUndo(true); }
  if(ctl && k.toLowerCase() === "c") return pxCopy(false);
  if(ctl && k.toLowerCase() === "x") return pxCopy(true);
  if(ctl && k.toLowerCase() === "v"){ px.pasteT = setTimeout(() => pxPaste(), 80); return; }   // the paste event below cancels this when the clipboard holds a picture
  if(ctl && k.toLowerCase() === "s"){ e.preventDefault(); return pxSaveNow(); }
  if(ctl && k.toLowerCase() === "a"){ e.preventDefault(); pxSelectAll(); return; }
  if(ctl) return;
  if(k === "Delete" || k === "Backspace"){ e.preventDefault(); return pxClear(); }
  if(k === "Enter"){ pxDrop(); px.sel = null; return pxChanged(); }
  const arrow = {ArrowLeft:[-1, 0], ArrowRight:[1, 0], ArrowUp:[0, -1], ArrowDown:[0, 1]}[k];
  if(arrow){
    e.preventDefault();
    if(px.sel){ if(!px.sel.buf){ pxPush(); px.sel.buf = pxCut(px.sel, true); } px.sel.x += arrow[0]; px.sel.y += arrow[1]; return pxChanged(); }
    if(e.shiftKey) return pxNudge(arrow[0], arrow[1], document.getElementById("pxAll")?.checked);
    if(arrow[1] === 0){ pxDrop(); px.sel = null; px.cur = (px.cur + arrow[0] + px.frames.length) % px.frames.length; pxDraw(); return pxSync(); }
    return;
  }
  if(k === "M" && e.shiftKey){ px.mirror = !px.mirror; pxDraw(); return pxSync(); }
  const t = PX_TOOLS.find(x => x[2].toLowerCase() === k.toLowerCase()); if(t && !e.shiftKey) return pxTool(t[0]);
  if(k === "x"){ [px.c1, px.c2] = [px.c2, px.c1]; return pxSync(); }
  if(k === "+" || k === "=") return pxZoom(1);
  if(k === "-") return pxZoom(-1);
  if(k === "#"){ px.grid = !px.grid; pxDraw(); return pxSync(); }
  if(k === "[" || k === ","){ pxDrop(); px.sel = null; px.cur = (px.cur + px.frames.length - 1) % px.frames.length; pxDraw(); return pxSync(); }
  if(k === "]" || k === "."){ pxDrop(); px.sel = null; px.cur = (px.cur + 1) % px.frames.length; pxDraw(); return pxSync(); }
}
async function openPixelEditor(path){
  if(!px.built) pxBuild();
  const D = document.getElementById("dlgPixel"); if(!D.open) D.showModal();
  pxWatch();
  if(path) await pxOpen(path);
  else if(!px.frames.length){ const last = pxStored("last"); if(last && (SPRITE_PACK[last] || pxStored("d:" + last))) await pxOpen(last); else pxOverlay("open"); }
  pxFit(); pxSync(); if(!px.anim) px.anim = requestAnimationFrame(pxPreview);
}
{ const b = document.getElementById("pixelBtn"); if(b){ b.hidden = !devMode(); b.onclick = () => openPixelEditor(); } }
