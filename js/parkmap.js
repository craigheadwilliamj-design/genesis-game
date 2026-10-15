/* Park Map: a small top-down pixel map of the whole park in a dialog (HUD button or M).
   Drawn straight from state to a canvas, independent of the main renderer and the 3/4 view. Draws on open and a few times a second while open. */
const PMAP = {px:3, maxW:760, maxH:480, refreshMs:400, dim:"#6B6A5C", path:"#CBC5B4", wide:"#E0DACA", service:"#8A8478", bridge:"#8B6B3E", tram:"#5A5A66", water:"#4A90B8", wall:"#2E2E28", lab:"#E6E9F0", view:"#FFFFFF"};
let pmapTimer = null, pmapGeo = null;

// your land plus a margin (more to the south, so the wall and entrance show), never past the whole buyable area
function pmapBounds(){ const o = ownedBox(), m = 50; return {x0:Math.max(PARCELS.xs[0], o.x0 - m), y0:Math.max(PARCELS.ys[0], o.y0 - m), x1:Math.min(PARCELS.xs[PARCELS.xs.length - 1], o.x1 + m), y1:SOUTH_LINE + 25}; }

function pmapPoly(g, pts){ g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); }
function pmapLine(g, pts, w, col){ g.strokeStyle = col; g.lineWidth = w; g.lineJoin = "round"; g.lineCap = "round"; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); }

function drawParkMap(cv){
  const b = pmapBounds(), W = b.x1 - b.x0, H = b.y1 - b.y0, S = Math.min(PMAP.px, PMAP.maxW / W, PMAP.maxH / H);
  const cw = Math.round(W * S), ch = Math.round(H * S);
  if(cv.width !== cw || cv.height !== ch){ cv.width = cw; cv.height = ch; }
  pmapGeo = {b, S};
  const g = cv.getContext("2d"); g.imageSmoothingEnabled = false;
  g.setTransform(S, 0, 0, S, -b.x0 * S, -b.y0 * S);
  g.fillStyle = PMAP.dim; g.fillRect(b.x0, b.y0, W, H);
  const park = BIOMES[parkBiome()].park;
  for(const r of ownedRects()){ g.fillStyle = park; g.fillRect(r[0], r[1], r[2] - r[0], r[3] - r[1]); }
  // water (park and exhibit)
  const wcol = w => (WATER_TEX[w] && WATER_TEX[w].lit) || PMAP.water;
  for(const w of parkWater()){ g.fillStyle = wcol(parkBiome()); pmapPoly(g, w.points); g.fill(); }
  // exhibits: biome ground, then their water
  for(const e of state.exhibits){
    if(!e.points || e.points.length < 3) continue;
    g.fillStyle = e.viv ? "#B9B39A" : (BIOMES[biomeOf(e)] || BIOMES[DEFAULT_BIOME]).color; pmapPoly(g, e.points); g.fill();
    for(const w of waterOf(e)){ g.fillStyle = wcol(biomeOf(e)); pmapPoly(g, w.points); g.fill(); }
  }
  // paths
  for(const kind of ["s", "g", "b"]){
    g.fillStyle = kind === "s" ? PMAP.service : kind === "b" ? PMAP.bridge : PMAP.path;
    for(const q of pathSquares()) if(q.kind === kind) g.fillRect(q.x, q.y, q.w, q.h);
  }
  for(const p of state.paths){
    if(p.d || !p.points || p.points.length < 2) continue;
    const w = Math.max(2 * halfWidth(p), 1 / S * 1.5), col = isService(p) ? PMAP.service : isWide(p) ? PMAP.wide : isBridge(p) ? PMAP.bridge : isTram(p) ? PMAP.tram : PMAP.path;
    pmapLine(g, p.points, w, col);
  }
  // fences: exhibit outlines in the barrier color, loose grid fence pieces, old fence lines
  for(const e of state.exhibits){
    if(!e.points || e.points.length < 3 || e.open) continue;
    g.strokeStyle = (BARRIERS[e.barrier] || BARRIERS.wood).color; g.lineWidth = 1.2 / S * 1.2; g.lineJoin = "miter"; pmapPoly(g, e.points); g.stroke();
  }
  for(const [k, v] of Object.entries(state.fenceGrid || {})){
    const [a, c] = pieceEnds(k); pmapLine(g, [a, c], 1 / S * 1.2, (BARRIERS[v && v.b] || BARRIERS.wood).color);
  }
  for(const f of state.fences || []) if(f.points) pmapLine(g, f.points, 1 / S * 1.2, (BARRIERS[f.barrier] || BARRIERS.wood).color);
  // buildings: a block each, light from the top left so a dark edge falls bottom right; science buildings are pale with a colored core
  for(const bl of state.buildings){
    if(!bl.points) continue;
    const t = BUILDINGS[bl.type] || {}, lab = t.dept || ["oracle", "ghost", "tar", "ceres", "pmc"].includes(bl.type), col = t.color || "#888";
    g.save(); g.translate(.8 / S * 1.2, .8 / S * 1.2); g.fillStyle = "rgba(0,0,0,.35)"; pmapPoly(g, bl.points); g.fill(); g.restore();
    g.fillStyle = lab ? PMAP.lab : col; pmapPoly(g, bl.points); g.fill();
    if(lab){ const c = centroid(bl.points), r = Math.max(2, 3 / S); g.fillStyle = col; g.fillRect(c[0] - r, c[1] - r, 2 * r, 2 * r); }
  }
  // the south wall and the entrance gap
  const gx = state.gate[0], gap = 6, y = SOUTH_LINE - .8 / S;
  g.fillStyle = PMAP.wall; const wx0 = ownedBox().x0, wx1 = ownedBox().x1;
  g.fillRect(wx0, y, gx - gap - wx0, 1.6 / S); g.fillRect(gx + gap, y, wx1 - gx - gap, 1.6 / S);
  g.fillStyle = "#D8B04A"; g.fillRect(gx - gap - 1 / S, y - 1 / S, 2 / S * 1.5, 3 / S); g.fillRect(gx + gap - 1 / S, y - 1 / S, 2 / S * 1.5, 3 / S);
  // guests (their personality color) and staff (white)
  const dot = 1.4 / S * 1.6;
  for(const p of parties){ if(!p.at) continue; const [x, yy] = partyPos(p); g.fillStyle = "#F2C94C"; g.fillRect(x - dot / 2, yy - dot / 2, dot, dot); }
  g.fillStyle = "#FFFFFF";
  for(const list of [crew, mcrew, vcrew, ccrew, gcrew]) for(const c of list){ if(c.at) g.fillRect(c.at.x - dot / 2, c.at.y - dot / 2, dot, dot); }
  // where the main view is looking now
  const {w, h} = svgSize(), x0 = (0 - view.tx) / view.k, x1 = (w - view.tx) / view.k, y0 = (0 - view.ty) / ky(), y1 = (h - view.ty) / ky();
  g.strokeStyle = PMAP.view; g.lineWidth = 1.5 / S * 1.3; g.setLineDash([]); g.strokeRect(x0, y0, x1 - x0, y1 - y0);
}

function openParkMap(){
  const d = $("#dlgParkMap"); if(!d.open) d.showModal();
  drawParkMap($("#parkMapCv"));
  clearInterval(pmapTimer); pmapTimer = setInterval(() => { if(d.open) drawParkMap($("#parkMapCv")); else clearInterval(pmapTimer); }, PMAP.refreshMs);
}
function closeParkMap(){ clearInterval(pmapTimer); const d = $("#dlgParkMap"); if(d.open) d.close(); }

$("#mapBtn").onclick = () => $("#dlgParkMap").open ? closeParkMap() : openParkMap();
$("#closeParkMap").onclick = closeParkMap;
$("#dlgParkMap").addEventListener("close", () => clearInterval(pmapTimer));
// a click outside the box (on the backdrop) closes it
$("#dlgParkMap").addEventListener("click", e => { if(e.target === $("#dlgParkMap")) closeParkMap(); });
// a click on the map recenters the main view there and closes the dialog
$("#parkMapCv").addEventListener("click", e => {
  if(!pmapGeo) return;
  const cv = e.currentTarget, r = cv.getBoundingClientRect(), {b, S} = pmapGeo;
  const x = b.x0 + (e.clientX - r.left) / r.width * cv.width / S, y = b.y0 + (e.clientY - r.top) / r.height * cv.height / S;
  const {w, h} = svgSize();
  view.tx = w / 2 - x * view.k; view.ty = h / 2 - y * ky(); clampView(); applyTransform(); render();
  closeParkMap();
});
document.addEventListener("keydown", e => {
  if(e.key.toLowerCase() !== "m" || e.ctrlKey || e.metaKey || e.altKey) return;
  if(/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "")) return;
  const open = $("#dlgParkMap").open;
  if(!open && document.querySelector("dialog[open]")) return;
  open ? closeParkMap() : openParkMap();
});
