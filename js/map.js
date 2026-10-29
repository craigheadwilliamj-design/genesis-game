/* =====================================================================
   MAP
   Drawing the park, moving around it, and the build tools.
   Animals and guests wander around here too.
   ===================================================================== */

const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const svg = $("#map"), cam = $("#cam"), world = $("#world"), animalLayer = $("#animalLayer"), guestLayer = $("#guestLayer"), overlay = $("#overlay");
const mapwrap = $("#mapwrap");

const KMIN = 0.4, KMAX = 27.3;      // zoom limits, in screen pixels per meter
let view = {k:2, tx:0, ty:0};
// 3/4 view (the only main view): the ground is squashed by TILT top to bottom, so it reads as seen at an angle.
// The `!tilt` branches below are the old flat top-down drawing; they are dead code now and can be removed piece by piece.
const TILT = .7;
const tilt = true;
function tf(){ return tilt ? TILT : 1; }
function ky(){ return view.k * tf(); }   // screen pixels per meter, top to bottom
function upright(){ return tilt ? ` scale(1 ${(1/TILT).toFixed(4)})` : ""; }   // added to a sprite's transform so it isn't squashed
let tool = "select";
let sel = null;                     // what's picked: {kind:"exhibit"|"path"|"building"|"guest", id}
let draw = null;                    // shape being drawn: {kind, pts, snaps, hover}
let ghost = null;                   // building being placed: {pts, x, y, angle, ok, why}
let rockBiome = null;               // biome tab a rock was picked from, so it's placed in that stone color (null: the exhibit's biome)
let landGhost = null;               // rock, grove or shelter being placed: {key, x, y, ok, why}
let hoverItem = null;               // thing under the mouse while bulldozing
let snapMark = null;
let wdrag = null;                   // water box being dragged: {a, b} (chunks, like paint)
let waterPick = "auto";             // what the water tool lays: a WATER_TEX key (a water type), or "auto" for the biome's own water
let pdrag = null;                   // biome paint box being dragged: {a, b} (grid points, js/biomepaint.js)
let paintPick = null;               // what the paint tool does: a biome id, or "erase"
let fdrag = null;                   // fence being laid or lifted: {a, b, lift, first} (grid points, js/fences.js)
let cdrag = null;                   // path run being laid: {a, b, kind, plan} (chunks, js/pathcells.js)
let chover = null;                  // path tool or bulldoze: the chunk [cx, cy] under the pointer
let fhover = null;                  // bulldoze: the fence piece under the pointer
let parcelSel = null;               // plot picked with the Buy Land tool: [i, j]

const isBuildTool = t => !!BUILDINGS[t];
// Menu groups whose tools share a choice bar above the map (vivarium sizes, food stalls, hotels...)
const FAMILIES = {
  viv:  {tools:["vivS", "vivM", "vivL"], labels:["Small", "Medium", "Large"]},
  aqua: {tools:["aquaS", "aquaM", "aquaL"], labels:["Small", "Medium", "Large"]},
  eat:  {tools:["kiosk", "food", "restaurant"], labels:["Cart", "Stand", "Restaurant"]},
  gifts:{tools:["cart", "shop", "megastore"], labels:["Cart", "Stand", "Shop"]},
  lodging:{tools:["campground", "lodge", "resort"], labels:["Campground", "Safari Lodge", "Resort Hotel"]},
  props:{tools:["bin", "bench", "picnic", "lamp", "camera", "donate", "sign", "nofeed", "quiet"], labels:["Bin", "Bench", "Picnic", "Lamp", "Camera", "Donations", "Info sign", "No-feed", "Quiet"]},
};
const familyOf = t => Object.keys(FAMILIES).find(f => FAMILIES[f].tools.includes(t)) || null;
let fenceSel = "wood";             // fence type the next exhibit is built with
let fenceMeet = false;             // the fence tool keeps other fence where it stands and lays against it, instead of replacing it
const GRID_STEP = 1;               // meters between grid-snap points
const isDrawTool = t => t === "tram" || t === "zone";
const PATH_TOOLS = {path:"g", service:"s", bridge:"b"};   // drag-and-drop path tools and the chunk kind each lays (js/pathcells.js)
const isPathTool = t => !!PATH_TOOLS[t];
// Exhibits, zones and water are closed shapes. Paths are open lines.
const isPoly = k => k === "exhibit" || k === "zone" || k === "water";
let supplyOn = false;
let rot = 0;                        // 45° steps a building is rotated by while placing it; Rotate moves it a quarter turn (2) at a time
let lastPtr = null;                 // where the pointer last was while placing, so Rotate can redraw the ghost
let mvSel = null;                   // building picked with the Move tool, the one Rotate turns
let mvCorner = null;                // exhibit or water corner picked with the Move tool: {id, i}
let zedit = null;                   // zone being reshaped: {id, orig, sel, done}               // show supply lines on the map
const halfWidth = p => p.hw !== undefined ? p.hw : isService(p) ? SERVICE_ROAD.halfWidth : isWide(p) ? WIDE_PATH.halfWidth : isTram(p) ? TRAM.halfWidth : isBridge(p) ? BRIDGE.halfWidth : PATH_HALF_WIDTH;
// Where a wide path's flat end meets another guest path, run it through to that path's far edge and cut it flush there,
// so the join is a clean T instead of a slanted notch. Returns the points to draw and a half-plane clip for each joined end.
function wideJoin(p){
  const pts = p.points.map(q => q.slice()), clips = [], tapers = [];
  for(const end of [0, 1]){
    const i = end ? pts.length - 1 : 0, prev = pts[end ? i - 1 : 1], E = pts[i];
    let best = null;
    for(const o of state.paths){
      if(o === p || isService(o) || isTram(o)) continue;
      for(let j = 1; j < o.points.length; j++){
        const r = segProj(E[0], E[1], o.points[j-1], o.points[j]), hw = halfWidth(o);
        if(r.d < 1.5 && (!best || r.d < best.d)) best = {...r, a:o.points[j-1], b:o.points[j], hw};   // joined, by the same 1.5 m rule the game uses
      }
    }
    if(!best) continue;
    const ux = best.b[0] - best.a[0], uy = best.b[1] - best.a[1], L = Math.hypot(ux, uy) || 1, tx = ux/L, ty = uy/L;
    let mx = -ty, my = tx;                                          // normal pointing to the wide path's side
    if((prev[0] - best.x)*mx + (prev[1] - best.y)*my < 0){ mx = -mx; my = -my; }
    const dx = E[0] - prev[0], dy = E[1] - prev[1], dl = Math.hypot(dx, dy) || 1, dn = (dx*mx + dy*my) / dl;
    if(Math.abs(dn) < .2){                                          // running along it, not into it: a narrower path carrying on in line gets a taper
      const ox = dx/dl, oy = dy/dl;
      const ahead = Math.max((best.a[0] - E[0])*ox + (best.a[1] - E[1])*oy, (best.b[0] - E[0])*ox + (best.b[1] - E[1])*oy);
      if(best.hw < WIDE_PATH.halfWidth && ahead > 1){
        const T = Math.min(2*(WIDE_PATH.halfWidth - best.hw), ahead), W = WIDE_PATH.halfWidth, nx = -oy, ny = ox;
        const cx = E[0] + ox*T + nx*((best.x - E[0])*nx + (best.y - E[1])*ny), cy = E[1] + oy*T + ny*((best.x - E[0])*nx + (best.y - E[1])*ny);
        tapers.push([[E[0] + nx*W, E[1] + ny*W], [cx + nx*best.hw, cy + ny*best.hw], [cx - nx*best.hw, cy - ny*best.hw], [E[0] - nx*W, E[1] - ny*W]]);
      }
      continue;
    }
    // how far past the end to run it to reach the far edge
    const gap = (E[0] - best.x)*mx + (E[1] - best.y)*my + best.hw;
    const t = -gap / dn;
    if(t > 0) pts[i] = [E[0] + dx/dl*Math.min(t, 40), E[1] + dy/dl*Math.min(t, 40)];
    clips.push({bx:best.x - mx*best.hw, by:best.y - my*best.hw, tx, ty, mx, my});
  }
  return {pts, clips, tapers};
}

/* ---------- looking things up ---------- */
function listFor(kind){ return kind === "exhibit" ? state.exhibits : kind === "path" ? state.paths : kind === "building" ? state.buildings : kind === "zone" ? state.zones : kind === "crate" ? state.crates : kind === "fence" ? state.fences
  : kind === "land" ? state.exhibits.flatMap(landOf).concat(decorOf()) : kind === "water" ? state.exhibits.flatMap(waterOf).concat(parkWater()) : null; }
function findItem(kind, id){ const l = listFor(kind); return l ? l.find(x => x.id === id) : null; }
function selItem(){ return !sel ? null : sel.kind === "guest" ? parties.find(p => p.id === sel.id) || null : sel.kind === "staff" ? (staffById(sel.id) || {}).s || null : sel.kind === "animal" ? animalById(sel.id) : findItem(sel.kind, sel.id); }

function exhibitColor(e){
  const counts = speciesCounts(e); let best = null, bn = 0;
  for(const [sp, n] of counts) if(n > bn){ bn = n; best = sp; }
  return best ? PERIOD_COLOR[SPECIES_BY_ID[best].period] : null;
}
function happyColor(h){ return h >= 65 ? "var(--good)" : h >= 40 ? "var(--warn)" : "var(--bad)"; }

/* ---------- drawing the park ---------- */
let rq = 0;
function queueRender(){ if(!rq) rq = requestAnimationFrame(() => { rq = 0; render(); }); }

function polyStr(pts){ return pts.map(p => p[0].toFixed(2) + "," + p[1].toFixed(2)).join(" "); }

function render(){
  const k = view.k, inv = 1/k;
  const b = ownedBox(), rd = ownedRects().map(r => `M${r[0]} ${r[1]}H${r[2]}V${r[3]}H${r[0]}Z`).join("");
  let s = `<rect x="${PARCELS.xs[0]-3000}" y="${PARCELS.ys[0]-3000}" width="${PARCELS.xs[PARCELS.xs.length-1]-PARCELS.xs[0]+6000}" height="${PARCELS.ys[PARCELS.ys.length-1]-PARCELS.ys[0]+6000}" fill="url(#contours)"/>`;
  $("#plotClipPoly").setAttribute("d", rd);
  // the park's own ground: its biome's color and texture, dimmed a little at night (dark mode)
  const pb = parkBiome();
  s += `<path d="${rd}" fill="${BIOMES[pb].park}"/><path d="${rd}" fill="${tileFill("p", pb)}"/>` + groundShade(pb, "path", `d="${rd}"`);

  // painted biome ground, over the park ground and under paths, buildings and exhibits
  s += paintSvg();

  const bd = ownedEdges().map(([p, q]) => `M${p[0]} ${p[1]}L${q[0]} ${q[1]}`).join("");
  // the southern edge (the entrance line) is a hard wall, open only at the entrance; the other edges stay a dashed property line
  const wall = [];
  const bd2 = ownedEdges().filter(([p, q]) => { if(p[1] === SOUTH_LINE && q[1] === SOUTH_LINE){ wall.push([Math.min(p[0], q[0]), Math.max(p[0], q[0])]); return false; } return true; }).map(([p, q]) => `M${p[0]} ${p[1]}L${q[0]} ${q[1]}`).join("");
  s += `<path d="${bd2}" fill="none" stroke="var(--boundary)" stroke-width="2" stroke-dasharray="10 5" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
  if(wall.length){
    const gx = state.gate[0], gap = 6, cuts = [];
    for(const [a, c] of wall){ if(gx - gap > a && gx + gap < c){ cuts.push([a, gx - gap], [gx + gap, c]); } else cuts.push([a, c]); }
    const wd = cuts.map(([a, c]) => `M${a} ${SOUTH_LINE}H${c}`).join("");
    s += `<path d="${wd}" fill="none" stroke="#4A4A42" stroke-width="1.3" stroke-linecap="butt" pointer-events="none"/><path d="${wd}" fill="none" stroke="#8C8C80" stroke-width=".5" transform="translate(0 -.4)" pointer-events="none"/><path d="${wd}" fill="none" stroke="#2E2E28" stroke-width=".4" stroke-dasharray="1.3 1.3" transform="translate(0 .4)" pointer-events="none"/>`;
  }

  const isDoomed = (kind, id) => tool === "bulldoze" && hoverItem && hoverItem.kind === kind && hoverItem.id === id;
  const isSel = (kind, id) => sel && sel.kind === kind && sel.id === id;

  // work zones: a tinted wash and a dashed edge, under everything else
  for(const z of state.zones){
    const on = isSel("zone", z.id), dead = isDoomed("zone", z.id);
    const ZT = devMode() && z.theme && THEMES[z.theme] && THEMES[z.theme].ground ? THEMES[z.theme] : null;
    if(ZT) s += `<polygon points="${polyStr(z.points)}" fill="${ZT.ground}" fill-opacity=".6" stroke="none" pointer-events="none"/>` + (groundTex(ZT) ? `<polygon points="${polyStr(z.points)}" fill="url(#t-${groundTex(ZT)})" fill-opacity="${ZT.gtex ? .75 : .45}" stroke="none" pointer-events="none"/>` : "");
    s += `<polygon points="${polyStr(z.points)}" fill="${z.color}" fill-opacity="${on ? .22 : ZT ? .04 : .1}" stroke="${dead ? "var(--bad)" : z.color}" stroke-width="${on || dead ? 3 : 1.6}" stroke-dasharray="9 6" stroke-linejoin="round" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
  }

  // ponds and lakes out in the park, under everything built
  s += parkWaterSvg();

  // paths and path chunks lie flat on the ground, so they go under every fence, exhibit and building (the 3/4 view stands those up)
  // paths: dark edges drawn first under every path, so joins look like one surface
  const joined = derived ? derived.joined : new Set(), joinedAll = derived ? derived.joinedAll : new Set();
  let under = "", over = "", clipDefs = "", wjN = 0;
  // staff roads go first, so a guest path always lays over them where they meet
  // tram track goes under everything, then staff roads
  const pathRank = p => isTram(p) ? 2 : isService(p) ? 1 : 0;
  for(const p of [...state.paths].sort((a, b) => pathRank(b) - pathRank(a))){
    if(p.d) continue;   // derived strips stand in for the cells in the sim; the cells are drawn below
    if(isTram(p)){
      const pts = polyStr(p.points), w = Math.max(2*halfWidth(p), 3*inv), lj = `stroke-linejoin="round" stroke-linecap="butt" fill="none"`, on = isSel("path", p.id), dead = isDoomed("path", p.id);
      if(on || dead) under += `<polyline points="${pts}" stroke="${dead ? "var(--bad)" : "var(--sel)"}" stroke-width="${w + 5*inv}" ${lj}/>`;
      // gravel bed, then the ties as short dashes across it, then two rails: a dark band with a bed-colored band laid back over it
      under += `<polyline points="${pts}" stroke="#4A4742" stroke-width="${w + 1.2*inv}" ${lj}/>`;
      let body = `<polyline points="${pts}" stroke="#8C877D" stroke-width="${w}" ${lj}/>`;
      body += `<polyline points="${pts}" stroke="#5E4B38" stroke-width="${w}" stroke-dasharray="${.7} ${1.6}" ${lj}/>`;
      body += `<polyline points="${pts}" stroke="#2E2C29" stroke-width="${w * .72}" ${lj}/><polyline points="${pts}" stroke="#8C877D" stroke-width="${w * .46}" ${lj}/>`;
      body += `<polyline points="${pts}" stroke="transparent" stroke-width="${Math.max(w, 14*inv)}" ${lj}/>`;
      over += `<g data-kind="path" data-id="${esc(p.id)}" style="cursor:pointer">${body}</g>`;
      continue;
    }
    if(isBridge(p)){
      const pts = polyStr(p.points), w = Math.max(2*halfWidth(p), 3*inv), lj = `stroke-linejoin="round" stroke-linecap="butt" fill="none"`, on = isSel("path", p.id), dead = isDoomed("path", p.id), live = joined.has(p.id);
      if(on || dead) under += `<polyline points="${pts}" stroke="${dead ? "var(--bad)" : "var(--sel)"}" stroke-width="${w + 5*inv}" ${lj}/>`;
      // dark timber rails along both sides, then the deck, then the gaps between the planks as thin dashes across it
      let body = `<polyline points="${pts}" stroke="#4A3220" stroke-width="${w + .9}" ${lj}/><polyline points="${pts}" stroke="#7A5634" stroke-width="${w + .3}" ${lj}/>`;
      body += `<polyline points="${pts}" stroke="${live ? "#B48A5A" : "#9C8468"}" stroke-width="${w - .5}" ${lj}/><polyline points="${pts}" stroke="#6E4E30" stroke-opacity=".7" stroke-width="${w - .5}" stroke-dasharray=".12 .88" ${lj}/>`;
      if(!live) body += `<polyline points="${pts}" stroke="#4A3220" stroke-width="${1.2*inv}" stroke-dasharray="${4*inv} ${4*inv}" ${lj}/>`;
      body += `<polyline points="${pts}" stroke="transparent" stroke-width="${Math.max(w, 14*inv)}" ${lj}/>`;
      over += `<g data-kind="path" data-id="${esc(p.id)}" style="cursor:pointer">${body}</g>`;
      continue;
    }
    const svc = isService(p), PT = themeOf(p).path;
    const wj = isWide(p) ? wideJoin(p) : null, pts = polyStr(wj ? wj.pts : p.points), w = Math.max(2*halfWidth(p), (svc ? 2.5 : 3)*inv);
    const cut = str => { if(!wj) return str; for(const c of wj.clips){ const id = `wj${wjN++}`, B = 1e4; clipDefs += `<clipPath id="${id}"><polygon points="${[[-1,0],[1,0],[1,1],[-1,1]].map(([a, b]) => `${c.bx + c.tx*B*a + c.mx*B*b},${c.by + c.ty*B*a + c.my*B*b}`).join(" ")}"/></clipPath>`; str = `<g clip-path="url(#${id})">${str}</g>`; } return str; };
    const on = isSel("path", p.id), dead = isDoomed("path", p.id), live = (svc ? joinedAll : joined).has(p.id);
    const lj = `stroke-linejoin="round" stroke-linecap="${isWide(p) ? "butt" : "round"}" fill="none"`;   // wide paths end flat so they don't bulge past a join
    if(on || dead) under += cut(`<polyline points="${pts}" stroke="${dead ? "var(--bad)" : "var(--sel)"}" stroke-width="${w + 5*inv}" ${lj}/>`);
    under += cut(`<polyline points="${pts}" stroke="${svc ? "#26292C" : PT.edge}" stroke-width="${w + 1.6*inv}" ${lj}/>`);
    if(!svc && PT.kerb) under += cut(`<polyline points="${pts}" stroke="${PT.kerb.c}" stroke-width="${w + 1.6*inv}" stroke-dasharray="${PT.kerb.dash.split(" ").map(n => n*inv).join(" ")}" ${lj.replace('stroke-linecap="round"', 'stroke-linecap="butt"')}/>`);
    let body = `<polyline points="${pts}" stroke="${svc ? (live ? "#3A3E42" : "#5B5F63") : live ? PT.live : PT.dead}" stroke-width="${w}" ${lj}/>`;
    if(!svc && texFill(p)) body += `<polyline points="${pts}" stroke="${texFill(p)}" stroke-width="${w}" ${lj}/>`;
    // wheel ruts: a darker band, then the crown down the middle laid back over it, leaving two worn tracks
    if(!svc && PT.ruts) body += `<polyline points="${pts}" stroke="${PT.ruts.c}" stroke-opacity="${PT.ruts.o}" stroke-width="${w * .66}" ${lj}/><polyline points="${pts}" stroke="${live ? PT.live : PT.dead}" stroke-width="${w * .4}" ${lj}/>` + (texFill(p) ? `<polyline points="${pts}" stroke="${texFill(p)}" stroke-width="${w * .4}" ${lj}/>` : "");
    // painted center line (thin and faded so paths don't read as a parking lot)
    if(!svc && PT.center) body += `<polyline points="${pts}" stroke="${PT.center.c}" stroke-opacity="${PT.center.o}" stroke-width="${PT.center.w*inv}" stroke-dasharray="${PT.center.dash.split(" ").map(n => n*inv).join(" ")}" ${lj.replace('stroke-linecap="round"', 'stroke-linecap="butt"')}/>`;
    if(svc) body += `<polyline points="${pts}" stroke="#E6E2D6" stroke-opacity=".5" stroke-width="${.7*inv}" stroke-dasharray="${5*inv} ${5*inv}" ${lj}/>`;
    if(!live) body += `<polyline points="${pts}" stroke="${PT.edge}" stroke-width="${1.2*inv}" stroke-dasharray="${4*inv} ${4*inv}" ${lj}/>`;
    body += `<polyline points="${pts}" stroke="transparent" stroke-width="${Math.max(w, 14*inv)}" ${lj}/>`;
    // a taper where the path steps down to a narrower one: edge below, surface above
    let tp = "";
    for(const t of wj ? wj.tapers : []){
      under += `<polygon points="${polyStr(t)}" fill="${PT.edge}" stroke="${PT.edge}" stroke-width="${1.6*inv}" stroke-linejoin="round"/>`;
      tp += `<polygon points="${polyStr(t)}" fill="${live ? PT.live : PT.dead}"/>` + (!svc && texFill(p) ? `<polygon points="${polyStr(t)}" fill="${texFill(p)}"/>` : "");
    }
    over += `<g data-kind="path" data-id="${esc(p.id)}" style="cursor:pointer">${cut(body)}${tp}</g>`;
  }
  // path surface doesn't show under a viewing platform's deck: mask the footprints out of the paths
  const decks = state.buildings.filter(b => b.type === "platform");
  if(decks.length) s += `<mask id="deckcut" maskUnits="userSpaceOnUse" x="-100000" y="-100000" width="200000" height="200000"><rect x="-100000" y="-100000" width="200000" height="200000" fill="#fff"/>${decks.map(b => `<polygon points="${polyStr(b.points)}" fill="#000"/>`).join("")}</mask>`;
  under = pathLayerSvg() + under;
  s += clipDefs + (decks.length ? `<g mask="url(#deckcut)">${under}${over}</g>` : under + over);

  // loose fence cut into 3 m pieces of depth; the ones along an open exhibit go in its own depth group (landSvg), the rest sort with the park decor below
  const looseLeft = []; openFence34 = new Map();
  for(const r of looseRuns()){
    const P = r.off ? r.pts.map(p => [p[0] + r.off[0], p[1] + r.off[1]]) : r.pts, [a, z] = P, n = Math.max(1, Math.ceil(Math.abs(z[1] - a[1]) / 3));   // a run running up the screen is cut so what stands beside it sorts against each part
    for(let i = 0; i < n; i++){
      const u = i / n, v = (i + 1) / n, q = [[a[0] + (z[0] - a[0]) * u, a[1] + (z[1] - a[1]) * u], [a[0] + (z[0] - a[0]) * v, a[1] + (z[1] - a[1]) * v]], mx = (q[0][0] + q[1][0]) / 2, my = (q[0][1] + q[1][1]) / 2;
      const it = {y:my, o:0, svg:fenceRunSvg(q, r.b, false)}, host = tilt ? state.exhibits.find(e => e.open && !e.viv && (inPoly(mx, my, e.points) || distToEdge(mx, my, e.points) < 1.5)) : null;
      if(host) (openFence34.get(host.id) || openFence34.set(host.id, []).get(host.id)).push(it); else looseLeft.push(it);
    }
  }

  // exhibits; in the 3/4 view a vivarium is a standing glass tank, so it waits for the building pass after the paths
  const tanks = [];
  for(const e of state.exhibits){
    const c = exhibitColor(e), reach = isReachable(e), pts = polyStr(e.points), mark = s.length;
    const on = isSel("exhibit", e.id), dead = isDoomed("exhibit", e.id);
    s += `<g data-kind="exhibit" data-id="${esc(e.id)}" style="cursor:pointer">`;
    if(e.viv){
      if(tilt) s += vivFloor34(e, c, dead, on, reach);   // the 3/4 view: a flat substrate floor; the case itself is viv34
      else {
      // (flat view) a glass box: pale blue-green fill, dark frame, and a lighter inner pane
      s += `<polygon points="${pts}" fill="#A9D3DA" fill-opacity=".85" stroke="${dead ? "var(--bad)" : on ? "var(--sel)" : themeKey(e) !== "genesis" ? themeOf(e).edge : "#24414A"}" stroke-width="${on || dead ? 3.5 : 2.2}" ${reach ? "" : `stroke-dasharray="4 3"`} stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
      if(c) s += `<polygon points="${polyStr(insetRect(e.points, .9))}" fill="${c}" fill-opacity=".35" pointer-events="none"/>`;
      // the biome shows through the glass
      s += `<polygon points="${polyStr(insetRect(e.points, .9))}" fill="${BIOMES[biomeOf(e)].color}" fill-opacity=".35" pointer-events="none"/><polygon points="${polyStr(insetRect(e.points, .9))}" fill="${tileFill("b", biomeOf(e))}" pointer-events="none"/>`;
      }
      const bb = bbox(e.points), [vx, vy] = centroid(e.points);
      if(Math.min(bb.x1-bb.x0, bb.y1-bb.y0) * k < 50) s += `<text class="glyph" x="${vx}" y="${vy}" font-size="${Math.min(VIVARIUMS[e.viv].d * .5, 13*inv)}" style="fill:#24414A">${e.aqua ? "A" : "V"}${e.viv}</text>`;
    } else {
      const bar = barrierOf(e), bw = {wood:2, hedge:2, bars:2.5, electric:2.5, acrylic:3, brick:3.5, stone:3.5, bamboo:2, palisade:3.5, iron:2.5, drystone:3, adobe:3.5, stake:2, bone:2.5, rope:1.5, concrete:4.5, lagoon:3.5}[e.barrier || "wood"], hedge = !!bar.hedge;
      // a moat is a band of water around the outside of the fence
      if(e.moat) s += `<polygon points="${pts}" fill="none" stroke="#3A7FB2" stroke-opacity=".85" stroke-width="7" stroke-linejoin="round" pointer-events="none"/>`;
      // the floor shows the biome: its color, with its texture over it
      const fb = BIOMES[e.biome] ? e.biome : DEFAULT_BIOME;   // the unpainted floor; paint over it can tip the exhibit's biome (biomeOf)
      s += `<polygon points="${pts}" fill="${BIOMES[fb].color}" fill-opacity=".8" pointer-events="none"/><polygon points="${pts}" fill="${tileFill("b", fb)}" pointer-events="none"/>` + exhibitPaintSvg(e);
      // water lies on the floor, under the fence, so posts and rails stand over the bank
      s += watersSvg(waterOf(e), biomeOf(e), lagoonWalled(e));
      // a hedge row is drawn as a real hedge, as wide as it is
      if(hedge && !tilt && !e.grid) s += hedgeSvg("polygon", pts);
      // a grid exhibit's fence is its pieces, each side in its own kind (a gap shows as loose fence, drawn later)
      if(e.grid){
        s += `<polygon points="${pts}" fill="transparent" stroke="${dead ? "var(--bad)" : on ? "var(--sel)" : "none"}" stroke-width="3.5" ${reach ? "" : `stroke-dasharray="6 4"`} stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
        if(!e.open && !tilt) s += gridFenceSvg(e);
      } else {
      s += `<polygon points="${pts}" fill="transparent" stroke="${dead ? "var(--bad)" : on ? "var(--sel)" : hedge ? (reach ? "none" : "#24461F") : themeKey(e) === "genesis" ? "#26402F" : bar.color}" stroke-width="${on || dead ? 3.5 : bw}" ${reach ? "" : `stroke-dasharray="6 4"`} stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
      // a live electric fence has a dark zigzag over yellow; with no power it goes dull gray
      if(themeKey(e) === "genesis"){}   // Genesis shows power as amber lights on the posts, drawn below
      else if(e.barrier === "electric" && e.powered === false && !on && !dead) s += `<polygon points="${pts}" fill="none" stroke="#8A8F95" stroke-width="2.5" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
      else if(e.barrier === "electric" && !on && !dead) s += `<polygon points="${pts}" fill="none" stroke="#1D2B22" stroke-width="1" stroke-dasharray="3 5" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
      if(e.barrier === "bars" && !on && !dead && themeKey(e) !== "genesis") s += `<polygon points="${pts}" fill="none" stroke="#C9CCD1" stroke-width="1" stroke-dasharray="1 3" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
      }
      if(e.aviary) s += `<polygon points="${pts}" fill="url(#mesh)" pointer-events="none"/>`;
      if(isBreached(e)) s += `<polygon points="${pts}" fill="none" stroke="var(--bad)" stroke-width="4" stroke-dasharray="10 6" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
      // worn fences (as of the last inspection) show cracks: orange when worn, red when badly worn
      else if(knownCond(e) < 60) s += `<polygon points="${pts}" fill="none" stroke="${knownCond(e) < 30 ? "#E5484D" : "#E08A2E"}" stroke-width="2" stroke-dasharray="2 5" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
    }
    // a themed exhibit gets a trim line just inside its fence (flat view only: in 3/4 the fence stands up and draws itself)
    if(!tilt && (!e.viv || themeKey(e) !== "genesis") && e.barrier !== "hedge" && !e.open) s += themeRailSvg(polyStr(insetRect(e.points, e.viv ? .93 : .96)), themeOf(e), inv, e.viv ? 2 : 4, !e.viv && e.animals.some(a => isDangerous(SPECIES_BY_ID[a.sp])), e.viv ? null : e.barrier || "wood");
    // Genesis electric fence: a small amber light at each post, glowing while powered and dark when the power fails
    // in the 3/4 view the fence stands up: its far sides here, behind what's inside, and its near sides after
    const hi34 = dead ? "var(--bad)" : on ? "var(--sel)" : null, fo34 = {hi:hi34, cond:knownCond(e), lights:e.barrier === "electric" && themeKey(e) === "genesis", powered:e.powered, off:e.grid && !e.open ? sideOffsets(e) : null};
    const kinds34 = e.grid ? sideKinds(e).map(b => BARRIERS[b].hedge ? "hedge" : b) : e.barrier || "wood";
    const gi = tilt ? gateSide34(e, kinds34) : -1;
    if(gi >= 0) fo34.gate = {i:gi, p:e.gate, id:e.id, f:gateFrameOf(e.id)};
    if(tilt && !e.open) s += e.viv ? viv34(e, "back", hi34) + vivScene34(e, "wall") : fence34(e.points, true, kinds34, "back", fo34);
    if(e.barrier === "electric" && !e.viv && !e.open && themeKey(e) === "genesis" && !tilt){
      const pp = polyStr(insetRect(e.points, .96)), ns = `fill="none" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" pointer-events="none"`;
      if(e.powered === false) s += `<polygon points="${pp}" stroke="#2A2E2B" stroke-width="3" stroke-dasharray="0 34" ${ns}/>`;
      else s += `<polygon points="${pp}" stroke="#FFB547" stroke-opacity=".35" stroke-width="9" stroke-dasharray="0 34" ${ns}/><polygon points="${pp}" stroke="#FFC25E" stroke-width="3.6" stroke-dasharray="0 34" ${ns}/><polygon points="${pp}" stroke="#FFF1CC" stroke-width="1.4" stroke-dasharray="0 34" ${ns}/>`;
    }
    // catch netting hangs just inside the fence rail: stroke the inset outline twice as wide and clip it to itself, so only the inner half shows
    if(e.net && !e.viv && !e.aviary){ const np = polyStr(insetRect(e.points, .96)), nid = `nc-${esc(e.id)}`; s += `<clipPath id="${nid}"><polygon points="${np}"/></clipPath><polygon points="${np}" fill="none" stroke="url(#netx)" stroke-width="2" stroke-linejoin="round" clip-path="url(#${nid})" pointer-events="none"/>`; }
    if(tilt && (e.dirt || 0) > 25) s += `<polygon points="${pts}" fill="url(#muck)" fill-opacity="${Math.min(1, (e.dirt - 25) / 50).toFixed(2)}" pointer-events="none"/>`;   // under the animals in the 3/4 view
    s += landSvg(e, tool === "bulldoze" || tool === "move", isDoomed);
    if(tilt && !e.open) s += e.viv ? viv34(e, "front", hi34) : fence34(e.points, true, kinds34, "front", fo34);
    if(dead) s += `<polygon points="${pts}" fill="url(#hatch)" pointer-events="none"/>`;
    // muck builds up visibly once an exhibit is getting dirty
    if(!tilt && (e.dirt || 0) > 25) s += `<polygon points="${pts}" fill="url(#muck)" fill-opacity="${Math.min(1, (e.dirt - 25) / 50).toFixed(2)}" pointer-events="none"/>`;
    if(e.gate && gi < 0){   // a gate with no picture of its own shows the standard gate
      let bs = null;
      e.points.forEach((v, i) => { const q = e.points[(i + 1) % e.points.length], r = segProj(e.gate[0], e.gate[1], v, q); if(!bs || r.d < bs.d) bs = {d:r.d, a:v, b:q}; });
      const L = Math.hypot(bs.b[0] - bs.a[0], bs.b[1] - bs.a[1]) || 1, hw = Math.min(L, GATE_GHOST.w) / 2, ux = (bs.b[0] - bs.a[0]) / L, uy = (bs.b[1] - bs.a[1]) / L;
      s += gateGlyphSvg([e.gate[0] - ux * hw, e.gate[1] - uy * hw], [e.gate[0] + ux * hw, e.gate[1] + uy * hw], GATE_GHOST.h / tf(), "#D8B04A");
    }
    s += `</g>`;
    if(tilt && e.viv){ tanks.push({y:centroid(e.points)[1], svg:s.slice(mark)}); s = s.slice(0, mark); }
  }

  // open fences and hedge rows
  for(const l of fenceLines()) s += fenceLineSvg(l, isSel("fence", l.id), isDoomed("fence", l.id));
  s += fenceJointsSvg(inv);

  // plants, rocks and statues out in the park stand over the path edges
  // plants, rocks and statues out in the park and loose fence runs stand on the ground, so they sort by depth together: a tree north of a fence is behind it, one south of it is in front
  const standing = decorOf().map(f => ({y:f.y, o:1, svg:featSvg(f, parkBiome(), tool === "bulldoze" || tool === "move", isDoomed)}));
  for(const q of looseLeft) standing.push(q);
  for(const c of state.crates) if(c.x != null) standing.push({y:c.y, o:1, svg:crateSvg(c, isSel("crate", c.id), inv)});
  standing.push({y:state.gate[1], o:2, svg:entrance34(inv)});   // the entrance building stands on the south edge, so it sorts in too
  standing.sort((p, q) => p.y - q.y || p.o - q.o);
  if(!tilt) while(standing.length) s += standing.shift().svg;   // the flat view has no depth: all of it goes under the buildings

  // litter on the paths
  const specks = litterSpecks();
  if(specks.length){
    // small square flecks in dull paper and cardboard colors, so they don't look like guests
    const cols = ["#FFFFFF", "#6F6A5C", "#7A5A2E"], d = cols.map(() => []), w = Math.max(.6, 3.2*inv);
    for(const [x, y, c] of specks) d[c].push(`M${x.toFixed(2)} ${y.toFixed(2)}h${w.toFixed(2)}`);
    s += `<g pointer-events="none">${cols.map((c, i) => d[i].length ? `<path d="${d[i].join("")}" stroke="${c}" stroke-width="${w}" stroke-linecap="square" fill="none"/>` : "").join("")}</g>`;
  }

  // guest buildings, back to front in the 3/4 view so taller ones in front cover the ones behind
  tanks.sort((a, b) => a.y - b.y);
  for(const bl of tilt ? [...state.buildings].sort((a, b) => centroid(a.points)[1] - centroid(b.points)[1]) : state.buildings){
    const t = BUILDINGS[bl.type], on = isSel("building", bl.id), dead = isDoomed("building", bl.id), reach = isReachable(bl);
    const [cx, cy] = centroid(bl.points), fs = Math.min(t.w, t.d) * .55;
    while(standing.length && standing[0].y <= cy) s += standing.shift().svg;   // trees, rocks, loose fence behind this building draw first
    while(tanks.length && tanks[0].y <= cy) s += tanks.shift().svg;
    // bins, benches and picnic areas: small, but always big enough to see and tap
    if(t.prop){
      const r = Math.max(Math.max(t.w, t.d) / 2, 4.5*inv), edge = dead ? "var(--bad)" : on ? "var(--sel)" : themeOf(bl).edge, full = bl.type === "bin" && (bl.fill || 0) >= LITTER.binCap;
      s += `<g data-kind="building" data-id="${esc(bl.id)}" style="cursor:pointer"><circle cx="${cx}" cy="${cy}" r="${r * 1.3}" fill="transparent"/>`;
      // a vandalized prop goes dark red; a broken one gets a cross through it
      const fill = isBroken(bl) ? "#6E2A26" : full ? "var(--bad)" : themeFill(bl, t.color), sw = on || dead ? 2.5 : 1.2;
      if(tilt){ s += propArt(bl, inv, on, dead) + `</g>`; continue; }
      if(bl.type === "bin" || bl.type === "lamp" || bl.type === "camera" || bl.type === "donate") s += `<circle cx="${cx}" cy="${cy}" r="${r * .75}" fill="${fill}" stroke="${edge}" stroke-width="${sw}" vector-effect="non-scaling-stroke"/>`;
      else s += `<polygon points="${polyStr(insetRect(bl.points, Math.max(1, r * 2 / Math.max(t.w, t.d))))}" fill="${fill}" stroke="${edge}" stroke-width="${sw}" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
      if(!isBroken(bl) && !full) s += bl.type === "bin" || bl.type === "lamp" || bl.type === "camera" || bl.type === "donate" ? themeProp(bl, {round:true, cx, cy, r:r * .75}) : themeProp(bl, {pts:polyStr(insetRect(bl.points, Math.max(1, r * 2 / Math.max(t.w, t.d)))), trim:polyStr(insetRect(bl.points, Math.max(1, r * 2 / Math.max(t.w, t.d)) * .7))});
      if(bl.type === "lamp" && !isBroken(bl)) s += `<circle cx="${cx}" cy="${cy}" r="${r * .3}" fill="#FFF6C8" pointer-events="none"/>`;
      if(bl.type === "camera" && !isBroken(bl)) s += `<circle cx="${cx}" cy="${cy}" r="${r * .3}" fill="#E8F0FF" pointer-events="none"/>`;
      if(bl.type === "sign" && !isBroken(bl)) s += `<text class="glyph" x="${cx}" y="${cy}" font-size="${r * .9}" pointer-events="none">i</text>`;
      if(bl.type === "nofeed" && !isBroken(bl)) s += `<text class="glyph" x="${cx}" y="${cy}" font-size="${r * .9}" pointer-events="none">⊘</text>`;
      if(bl.type === "quiet" && !isBroken(bl)) s += `<text class="glyph" x="${cx}" y="${cy}" font-size="${r * .9}" pointer-events="none">~</text>`;
      if(isBroken(bl)) s += `<path d="M${cx - r*.6} ${cy - r*.6}L${cx + r*.6} ${cy + r*.6}M${cx + r*.6} ${cy - r*.6}L${cx - r*.6} ${cy + r*.6}" stroke="#fff" stroke-width="1.5" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
      s += propFrontMark(bl, r) + `</g>`;
      continue;
    }
    const down = t.tram && !tramWorking(bl);   // a worn-out tram station goes dark red with a cross
    s += `<g data-kind="building" data-id="${esc(bl.id)}" style="cursor:pointer">`;
    if(tilt && STAND34[bl.type]){ s += building34(bl, t, on, dead, reach, inv) + `</g>`; continue; }
    s += `<polygon points="${polyStr(bl.points)}" fill="${down ? "#6E2A26" : themeFill(bl, t.color)}" stroke="${dead ? "var(--bad)" : on ? "var(--sel)" : reach ? themeOf(bl).edge : "var(--bad)"}" stroke-width="${on || dead ? 3.5 : 1.5}" ${reach ? "" : `stroke-dasharray="4 3"`} stroke-linejoin="round" vector-effect="non-scaling-stroke"/>` + themeBuildSvg(bl, polyStr(bl.points), polyStr(insetRect(bl.points, .86)));
    // departments show their name once there's room for it; smaller buildings show a letter
    if(t.dept && t.d * k >= 26) s += `<text class="glyph" x="${cx}" y="${cy}" font-size="${Math.min(t.d * .42, 15*inv)}" letter-spacing=".04em">${t.tag || t.label}</text>`;
    else s += `<text class="glyph" x="${cx}" y="${cy}" font-size="${fs}">${t.glyph}</text>`;
    if(down){ const r = Math.min(t.w, t.d) * .3; s += `<path d="M${cx - r} ${cy - r}L${cx + r} ${cy + r}M${cx + r} ${cy - r}L${cx - r} ${cy + r}" stroke="#fff" stroke-width="1.5" vector-effect="non-scaling-stroke" pointer-events="none"/>`; }
    // graffiti: a purple scribble across the front
    if((bl.graffiti || 0) >= VANDAL.grossAt){
      const w = Math.min(t.w, t.d) * .35;
      s += `<path d="M${cx - w} ${cy + w*.4}q${w*.25} ${-w*.8} ${w*.5} 0t${w*.5} 0t${w*.5} 0t${w*.5} 0" fill="none" stroke="#C04BD8" stroke-width="${Math.max(.6, 2.2*inv)}" stroke-linecap="round" pointer-events="none"/>`;
    }
    s += `</g>`;
  }
  for(const tk of tanks) s += tk.svg;
  for(const it of standing) s += it.svg;
  // with cameras researched, a selected Security Office shows what every office watches
  const selB = sel && sel.kind === "building" && findItem("building", sel.id);
  if(selB && (selB.type === "security" || selB.type === "camera") && hasTech("cameras")) for(const o of state.buildings.filter(x => x.type === "security" || x.type === "camera")){
    const [ox, oy] = centroid(o.points);
    s += `<circle cx="${ox}" cy="${oy}" r="${o.type === "camera" ? SECURITY.postRadius : SECURITY.cameraRadius}" fill="#2B3F6B" fill-opacity=".08" stroke="#2B3F6B" stroke-width="1.5" stroke-dasharray="6 4" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
  }

  // a red "!" over a stand, shop or hotel running low
  for(const bl of state.buildings){
    if(!restocked(bl) || !lowStock(bl)) continue;
    const S = tilt && STAND34[bl.type], [mx, cy0] = centroid(bl.points), top = Math.min(...bl.points.map(p => p[1]));
    const y = S ? top - (S.canopy || S.wall + S.rise) / TILT + 2*inv : cy0 - BUILDINGS[bl.type].d * .7 - 12*inv;   // over the roof's top edge, or over a flat sprite
    s += `<g class="lowmark" pointer-events="none" transform="translate(${mx.toFixed(2)} ${y.toFixed(2)})${upright()}"><circle r="${10*inv}" fill="#E5484D" stroke="#fff" stroke-width="2" vector-effect="non-scaling-stroke"/><text class="glyph" font-size="${15*inv}" style="fill:#fff">!</text></g>`;
  }

  // exhibit names and happiness
  for(const e of state.exhibits){
    const bb = bbox(e.points), dim = Math.min(bb.x1-bb.x0, bb.y1-bb.y0) * k;
    if(dim < 50 && !isSel("exhibit", e.id)) continue;
    const [cx, cy] = centroid(e.points);
    s += `<text class="lbl" x="${cx}" y="${cy - 8*inv}" font-size="${14*inv}" stroke-width="${3.5*inv}">${esc(e.name)}</text>`;
    let sub = "", col = "var(--ink-2)";
    if(!isReachable(e)) { sub = "No path to it"; col = "var(--bad)"; }
    else if(e.animals.length){ sub = `${Math.round(e.happy)}% happy`; col = happyColor(e.happy); }
    else sub = "Empty";
    s += `<text class="sublbl" x="${cx}" y="${cy + 8*inv}" font-size="${11.5*inv}" stroke-width="${3*inv}" fill="${col}">${sub}</text>`;
  }

  // supply lines: what keepers have hauled lately. Nobody draws these, they come from the zones and stores.
  const showLines = supplyOn || tool === "zone" || (sel && (sel.kind === "zone" || (sel.kind === "building" && storeOf(findItem("building", sel.id) || {type:"food"}))));
  if(showLines) for(const l of supplyLines()){
    const w = Math.min(5, 1.5 + l.n / 40);
    s += `<g pointer-events="none"><line x1="${l.a[0]}" y1="${l.a[1]}" x2="${l.b[0]}" y2="${l.b[1]}" stroke="#E0A030" stroke-opacity=".85" stroke-width="${w}" stroke-dasharray="${7*inv} ${5*inv}" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`
      + `<circle cx="${l.b[0]}" cy="${l.b[1]}" r="${4*inv}" fill="#E0A030"/></g>`;
  }
  // with supply lines on: ring the stores and farms, and the exhibits keepers have been feeding
  if(supplyOn){
    const ring = (it, col) => { const [x, y] = centroid(it.points), bb = bbox(it.points), r = Math.max(bb.x1 - bb.x0, bb.y1 - bb.y0) / 2 + 3; return `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r}" fill="none" stroke="${col}" stroke-width="2.5" stroke-dasharray="${6*inv} ${4*inv}" vector-effect="non-scaling-stroke" pointer-events="none"/>`; };
    for(const b of state.buildings){ const t = BUILDINGS[b.type]; if(t.makes) s += ring(b, "#5BAA3C"); else if(storeOf(b) && !t.kind && !t.rooms) s += ring(b, "#4A8FC4"); }
    const fed = new Set(supplyLines().filter(l => l.exhibit).map(l => l.b.join()));
    for(const e of state.exhibits) if(fed.has(centroid(e.points).join())) s += ring(e, "#E0A030");
  }
  for(const z of state.zones){
    const [zx, zy] = centroid(z.points), on = isSel("zone", z.id), fs = 11*inv;
    s += `<g data-kind="zone" data-id="${esc(z.id)}" style="cursor:pointer"><rect x="${zx - 34*inv}" y="${zy - 9*inv}" width="${68*inv}" height="${18*inv}" rx="${4*inv}" fill="${z.color}" fill-opacity="${on ? 1 : .85}" stroke="${on ? "var(--sel)" : "none"}" stroke-width="2" vector-effect="non-scaling-stroke"/><text class="glyph" x="${zx}" y="${zy}" font-size="${fs}" style="fill:#fff">${esc(z.name.slice(0, 12))}</text></g>`;
  }

  occ34 = tilt ? occluders34() : [];
  wall34 = tilt ? wallStrips34() : [];
  world.innerHTML = s;
  renderOverlay();
  syncAnimals();
  applyTransform();
  drawLights();
}

// Shrink a shape toward its middle (used for a vivarium's inner glass pane)
// Guest buildings standing up in the 3/4 view (prototype): front walls, a roof, and a shopfront.
// A height of h meters is drawn h/TILT up the map, because the camera squashes north-south.
const STAND34 = {
  restroom:  {wall:3.4, rise:1.6, front:"wc"},
  food:      {wall:3,   rise:1.3, front:"window", sign:"FOOD"},
  shop:      {wall:3,   rise:1.3, front:"window", sign:"GIFTS"},
  restaurant:{wall:4.2, rise:2.4, front:"glass",  sign:"RESTAURANT"},
  megastore: {wall:4.2, rise:2.4, front:"glass",  sign:"GIFT SHOP"},
  kiosk:     {wall:1.1, canopy:2.6, front:"cart"},
  cart:      {wall:1.1, canopy:2.6, front:"cart"},
  // labs: flat roofed blocks with ribbon windows, each with its own rooftop kit
  oracle:    {wall:7,   rise:0, front:"lab"},
  ghost:     {wall:8,   rise:0, front:"lab", top:"dome"},
  tar:       {wall:7,   rise:0, front:"lab", top:"stacks"},
  ceres:     {wall:5,   rise:0, front:"lab", glass:true},
  pmc:       {wall:6,   rise:0, front:"lab", top:"cross"},
  // hotels
  lodge:     {wall:3.4, rise:3.2, front:"lodge", wallCol:"#8A6A48", roofCol:"#B08A4E"},
  resort:    {wall:15,  rise:0, front:"resort", wallCol:"#EFE6D6"},
  campground:{wall:0,   rise:1.8, front:"camp"},
  // backstage: offices, garages, stores, sheds and barns
  station:   {wall:4.5, rise:0, front:"lab"},
  diveshack: {wall:4.5, rise:0, front:"lab"},
  security:  {wall:4.5, rise:0, front:"lab", top:"antenna"},
  breakroom: {wall:3.2, rise:1.4, front:"plain"},
  closet:    {wall:3,   rise:1.2, front:"plain"},
  toolshed:  {wall:3,   rise:1.6, front:"plain", gable:"ns"},
  workshop:  {wall:5,   rise:0, front:"lab", doors:2, top:"stacks"},
  generator: {wall:4.5, rise:0, front:"lab", doors:1, top:"stacks"},
  depot:     {wall:5,   rise:0, front:"lab", doors:3},
  warehouse: {wall:7,   rise:0, front:"lab", doors:2},
  coldstore: {wall:5.5, rise:0, front:"lab", doors:1},
  dock:      {wall:5.5, rise:0, front:"lab", doors:3, dock:true},
  greenhouse:{wall:3.5, rise:0, front:"lab", glass:true},
  insectary: {wall:4,   rise:0, front:"lab", glass:true, glassCol:"#C6D3A8"},
  hatchery:  {wall:3.5, rise:0, front:"lab", top:"tanks"},
  shellfarm: {wall:3.5, rise:0, front:"lab", top:"tanks"},
  orchard:   {wall:4,   rise:0, front:"lab", glass:true, glassCol:"#E3B5C0"},
  farm:      {wall:4,   rise:5, front:"barn", gable:"ns", wallCol:"#9A3B2E", roofCol:"#6B6B66"},
  // the rest of the guest side
  edcenter:  {wall:5,   rise:2.6, front:"glass", sign:"EDUCATION"},
  tramstop:  {wall:.9,  canopy:3.4, front:"tram"},
  platform:  {wall:3,   canopy:4.1, front:"deck"},
  gallery:   {wall:4.2, rise:1.2, front:"glass", sign:"GALLERY"},
  ranch:     {wall:4,   rise:5, front:"barn", gable:"ns", wallCol:"#7A4A32", roofCol:"#6B6B66"},
};
const WALL34 = "#D9CFBB", DARK34 = "#2E3A33", AWNING34 = "#F4F1E8";
function lift34(h){ return ([x, y]) => [x, y - h / TILT]; }
// light from the upper left: positive is lit, negative in shadow
function lit34([nx, ny]){ return nx*-.55 + ny*-.83; }
function shade34(pts, l){ return l > 0 ? `<polygon points="${polyStr(pts)}" fill="#fff" fill-opacity="${(l*.22).toFixed(2)}" pointer-events="none"/>` : `<polygon points="${polyStr(pts)}" fill="#000" fill-opacity="${(-l*.3).toFixed(2)}" pointer-events="none"/>`; }
// outward normal of footprint edge i
function norm34(P, i){
  const n = P.length, [cx, cy] = centroid(P), [ax, ay] = P[i], [bx, by] = P[(i+1) % n], L = Math.hypot(bx - ax, by - ay) || 1;
  let nx = (by - ay)/L, ny = -(bx - ax)/L; if(nx*((ax+bx)/2 - cx) + ny*((ay+by)/2 - cy) < 0){ nx = -nx; ny = -ny; } return [nx, ny];
}
function edgeLen34(P, i){ const b = P[(i+1) % P.length]; return Math.hypot(b[0] - P[i][0], b[1] - P[i][1]); }
// the walls facing the viewer, from h0 up to h1; returns the svg and the widest front edge
function walls34(P, h0, h1, fill, line, extra = ""){
  const front = [...Array(P.length).keys()].filter(i => norm34(P, i)[1] > .05);
  let s = "";
  for(const i of front){ const a = P[i], b = P[(i+1) % P.length], q = [lift34(h0)(a), lift34(h0)(b), lift34(h1)(b), lift34(h1)(a)];
    s += `<polygon points="${polyStr(q)}" fill="${fill}" ${line} ${extra}/>` + shade34(q, lit34(norm34(P, i)) * .6); }
  return {s, main:front.reduce((m, i) => m < 0 || edgeLen34(P, i) > edgeLen34(P, m) ? i : m, -1)};
}
// a point on footprint edge i, f of the way along, pushed out by `out` meters and lifted h
function onEdge34(P, i, f, h, out = 0){ const a = P[i], b = P[(i+1) % P.length], [nx, ny] = norm34(P, i); return lift34(h)([a[0] + (b[0] - a[0])*f + nx*out, a[1] + (b[1] - a[1])*f + ny*out]); }
function quad34(P, i, f0, f1, h0, h1, fill, more = ""){ return `<polygon points="${polyStr([onEdge34(P, i, f0, h0), onEdge34(P, i, f1, h0), onEdge34(P, i, f1, h1), onEdge34(P, i, f0, h1)])}" fill="${fill}" pointer-events="none" ${more}/>`; }
// hip roof: the ridge runs along the long side, with 45 degree ends
// gable: ends go straight up instead of sloping; "ns" also turns the ridge north-south so a gable end faces the viewer, filled with endFill
function hipRoof34(P, wall, rise, fill, tex, line, gable, endFill){
  const [cx, cy] = centroid(P), eave = P.map(lift34(wall)), n = P.length;
  const e0 = edgeLen34(P, 0), e1 = edgeLen34(P, 1);
  const a0 = [(P[1][0] - P[0][0])/e0, (P[1][1] - P[0][1])/e0], a1 = [(P[2][0] - P[1][0])/e1, (P[2][1] - P[1][1])/e1];
  const first = gable === "ns" ? Math.abs(a0[1]) >= Math.abs(a1[1]) : e0 >= e1, [ux, uy] = first ? a0 : a1;
  const half = gable ? (first ? e0 : e1) / 2 : Math.max(.4, (Math.max(e0, e1) - Math.min(e0, e1)) / 2), up = lift34(wall + rise);
  const ridge = [up([cx - ux*half, cy - uy*half]), up([cx + ux*half, cy + uy*half])];
  const near = p => (p[0] - cx)*ux + (p[1] - cy)*uy < 0 ? ridge[0] : ridge[1];
  const faces = [...Array(n).keys()].map(i => { const a = eave[i], b = eave[(i+1) % n], ra = near(P[i]), rb = near(P[(i+1) % n]);
    return {i, pts:ra === rb ? [a, b, ra] : [a, b, rb, ra], y:(P[i][1] + P[(i+1) % n][1]) / 2}; }).sort((f, g) => f.y - g.y);
  let s = "";
  for(const f of faces) s += `<polygon points="${polyStr(f.pts)}" fill="${endFill && f.pts.length === 3 ? endFill : fill}" ${line}/>` + (tex && !(endFill && f.pts.length === 3) ? `<polygon points="${polyStr(f.pts)}" fill="url(#t-${tex})" pointer-events="none"/>` : "") + shade34(f.pts, lit34(norm34(P, f.i)));
  return s + `<path d="M${ridge[0].map(v => v.toFixed(2)).join(" ")}L${ridge[1].map(v => v.toFixed(2)).join(" ")}" stroke="#1D2B22" stroke-opacity=".5" stroke-width="1.2" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
}
// a striped canopy over a 4 cornered footprint, stripes running front to back
function stripes34(C, n, c1, c2, line){
  const lerp = (a, b, f) => [a[0] + (b[0] - a[0])*f, a[1] + (b[1] - a[1])*f];
  let s = `<polygon points="${polyStr(C)}" fill="${c2}" ${line}/>`;
  for(let i = 0; i < n; i += 2) s += `<polygon points="${polyStr([lerp(C[0], C[1], i/n), lerp(C[0], C[1], (i+1)/n), lerp(C[3], C[2], (i+1)/n), lerp(C[3], C[2], i/n)])}" fill="${c1}" pointer-events="none"/>`;
  return s;
}
function sign34(P, i, h, text, fs){ const [x, y] = onEdge34(P, i, .5, h); return `<text class="glyph" x="${x.toFixed(2)}" y="${y.toFixed(2)}" font-size="${fs.toFixed(2)}" letter-spacing=".06em" pointer-events="none">${text}</text>`; }

// Fences standing up in the 3/4 view: posts and rails, bars, wires, glass, concrete or a hedge, by barrier.
// which: "back" draws the far sides of an exhibit (before what's inside), "front" the near sides (after it), "all" an open fence line.
// Solid walls on the near side are see-through, so they don't hide the animals.
const FENCE34 = {
  wood:    {h:1.6, step:3,   col:"#7A5A38", rails:[.6, 1.35], sprite:"wood"},
  bars:    {h:2.6, step:2.5, col:"#7E858C", rails:[.25, 2.5], bars:.5, sprite:"bars"},
  electric:{h:3.2, step:4,   col:"#5A6068", rails:[.6, 1.2, 1.8, 2.4, 3], wire:true, sprite:"electric"},
  acrylic: {h:2.2, col:"#9FCFE0", solid:.4, sprite:"acrylic"},
  concrete:{h:3.6, col:"#B8B1A2", solid:1, sprite:"concrete"},
  brick:   {h:2.2, col:"#AC5234", solid:1, sprite:"brick"},
  stone:   {h:2.6, col:"#9C9488", solid:1, sprite:"stone"},
  bamboo:  {h:1.9, col:"#7E9234", sprite:"bamboo"},
  palisade:{h:2.8, col:"#8C603A", solid:1, sprite:"palisade"},
  iron:    {h:2.2, col:"#323840", sprite:"iron"},
  drystone:{h:1.4, col:"#98927F", solid:1, sprite:"drystone"},
  adobe:   {h:2.1, col:"#CC9862", solid:1, sprite:"adobe"},
  stake:   {h:1.5, col:"#B8925C", sprite:"stake"},
  bone:    {h:2.4, col:"#E2D4B0", sprite:"bone"},
  rope:    {h:1.3, col:"#B8905A", sprite:"rope"},
  lagoon:  {h:2.3, col:"#D6D0C0", solid:1, sprite:"lagoon"},
  hedge:   {h:1.8, hedge:true, sprite:"hedge"},
};
// Which picture a fence shows: broken at 0, rusted below FENCE_LOOK.worn, else pristine. No condition (loose fence) is pristine.
const fenceState = c => c == null ? "pristine" : c <= 0 ? "broken" : c < FENCE_LOOK.worn ? "degrading" : "pristine";
// One side of a fence drawn from its pictures (FENCE_SPRITES): 3 m sections laid along the side, the last one cut short, then a post at the far end.
// Each is stood up the way fence34 stands a wall (a pixel is ROCK_MPP across and ROCK_MPP / TILT up the map, so it is square on screen), turned along the side as a shear.
// Returns null for a side running mostly north-south, which is seen edge-on: the caller draws fenceEdgeSvg for it instead.
// gate: the keeper gate on this side, if it has one ({p: its point, id: the exhibit, f: how far open, a frame number}): a gate picture (a section wide) is set into the fence there.
function fenceSpriteSvg(kind, a, b, cond, gate, powered){
  const S = FENCE_SPRITES[kind], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if(L < .05 || Math.abs(b[0] - a[0]) / L < FENCE_LOOK.minRun) return null;
  if(b[0] < a[0]) [a, b] = [b, a];   // always read left to right, so the pictures are never mirrored
  const dx = (b[0] - a[0]) / L, dy = (b[1] - a[1]) / L, n3 = v => v.toFixed(3), st0 = fenceState(cond), off = !!FENCE_SPRITES[kind].power && powered === false, st = off && st0 !== "broken" ? st0 + "-off" : st0, Lp = L / ROCK_MPP;
  // w pixels of the picture, starting `at` pixels along the side; a nested svg crops it
  const put = (at, w, pic = st, attr = "", ph = S.h, iw = S.w, drop = 0) => `<g transform="matrix(${n3(dx * ROCK_MPP)} ${n3(dy * ROCK_MPP)} 0 ${n3(ROCK_MPP / TILT)} ${n3(a[0] + dx * at * ROCK_MPP)} ${n3(a[1] + dy * at * ROCK_MPP + (drop - ph) * ROCK_MPP / TILT)})"><svg width="${w}" height="${ph}" viewBox="0 0 ${w} ${ph}"><image ${attr}href="${spriteUrl(`sprites/fence/${kind}-${pic}.png`)}" width="${iw}" height="${ph}" style="image-rendering:pixelated"/></svg></g>`;
  let s = "";
  if(gate){
    // the fence runs up to the gate's left post and starts again under its right one; the gate goes on top
    const GW = S.gateW || S.w, gw = Math.min(GW, Math.floor(Lp)), g0 = Math.max(0, Math.min(Lp - gw, Math.round(((gate.p[0] - a[0]) * dx + (gate.p[1] - a[1]) * dy) / ROCK_MPP - gw / 2)));
    if(S.gateW) for(let at = 0; at < Lp - .5; at += S.w) s += put(at, Math.min(S.w, Math.round(Lp - at)));   // a catwalk stands over a whole wall
    else {
      for(let at = 0; at < g0 + 2.5; at += S.w) s += put(at, Math.min(S.w, Math.round(g0 + 3 - at)));
      for(let at = g0 + gw - 3; at < Lp - .5; at += S.w) s += put(at, Math.min(S.w, Math.round(Lp - at)));
    }
    if(S.gateW){   // a catwalk: the deck is on the exhibit's side of the wall, the ladder on the outside
      const ex = state.exhibits.find(x => x.id === gate.id), south = !!ex && inPoly(gate.p[0] - dy * 1.5, gate.p[1] + dx * 1.5, ex.points);
      return s + put(Lp - 3, 3) + put(g0, gw, south ? "gate-s" : "gate", `data-gate="${esc(gate.id)}" data-pic="${kind}" data-fixed="1" `, S.gateH, GW, south ? S.gateDeep : 0);
    }
    return s + put(Lp - 3, 3) + put(g0, gw, "gate" + (off ? "-off" : "") + (gate.f ? "-" + gate.f : ""), `data-gate="${esc(gate.id)}" data-pic="${kind}" ${off ? 'data-off="1" ' : ""}data-f="${gate.f}" `, S.gateH || S.h, GW, S.gateDrop || 0);
  }
  for(let at = 0; at < Lp - .5; at += S.w) s += put(at, Math.min(S.w, Math.round(Lp - at)));
  return s + put(Lp - 3, 3);   // the post at the far end (the picture's first three columns)
}
// A bar fence side seen edge-on (running mostly north-south) is a thin slab, so it is drawn as a column FENCE_LOOK.edge pixels wide and as tall as the fence, in the pictures' colors:
// lit left, base middle, shaded right, with a cap across it and a footing at every post (3 m apart, the pictures' spacing). Rust blocks when degrading; a low trampled heap with post stubs when broken.
// steel is the kind's own material and rust its worn look (silvered wood for the wood fence); the pictures' colors
const FENCE_LAMP = {on:"#FFC25E", dim:"#A5732A", off:"#2A2E2B"};   // an electric fence post lamp: lit, worn, or with no power
const FENCE_EDGE = {
  bars:{steel:{hi:"#A2A7AC", mid:"#7E858C", lo:"#60656A", deep:"#494D51"}, rust:{hi:"#C88047", mid:"#B24E00", lo:"#873B00", deep:"#5E2800"}},
  electric:{steel:{hi:"#8A929B", mid:"#5A6068", lo:"#41464C", deep:"#2E3236"}, rust:{hi:"#C88047", mid:"#B24E00", lo:"#873B00", deep:"#5E2800"}},
  acrylic:{steel:{hi:"#EBF8FCD7", mid:"#9FCFE099", lo:"#62A0B8A0", deep:"#52666E"}, rust:{hi:"#F0EDCC", mid:"#D6D0A0B4", lo:"#B8B07A", deep:"#80784C"}, frame:{hi:"#C5CCD3", mid:"#A8B0B8", lo:"#7E858C", deep:"#60666C"}},   // a see-through pane (alpha in the colors) with an aluminium frame at the posts
  hedge:{steel:{hi:"#6BA851", mid:"#4E8A3E", lo:"#3A6C2E", deep:"#24461F"}, rust:{hi:"#BAB85C", mid:"#929642", lo:"#707034", deep:"#4A4226"}},   // leaves; rust is dry, browning leaves
  concrete:{steel:{hi:"#D6D0C2", mid:"#B8B1A2", lo:"#8E8778", deep:"#6A6458"}, rust:{hi:"#C88047", mid:"#B24E00", lo:"#873B00", deep:"#5E2800"}},   // rust is rebar showing through
  brick:{steel:{hi:"#C77A62", mid:"#AC5234", lo:"#7F3D27", deep:"#5C2A1B"}, rust:{hi:"#C7C0A8", mid:"#8E8A5A", lo:"#616138", deep:"#42421F"}},   // rust is moss and crumbling mortar
  stone:{steel:{hi:"#B5AEA2", mid:"#9C9488", lo:"#736C61", deep:"#4A453D"}, rust:{hi:"#A4B060", mid:"#616F22", lo:"#46501A", deep:"#2E3410"}},   // rust is moss
  bamboo:{steel:{hi:"#9AB45E", mid:"#7E9234", lo:"#5C6C24", deep:"#3E4A18"}, rust:{hi:"#D6C27C", mid:"#BEA450", lo:"#8A7634", deep:"#5E4E1E"}},   // rust is yellowed, dry cane
  palisade:{steel:{hi:"#B08058", mid:"#8C603A", lo:"#664429", deep:"#43301D"}, rust:{hi:"#A8A292", mid:"#868074", lo:"#625E54", deep:"#443F34"}},   // rust is weathered grey
  iron:{steel:{hi:"#6A727C", mid:"#323840", lo:"#252A30", deep:"#171A1E"}, rust:{hi:"#C88047", mid:"#B24E00", lo:"#873B00", deep:"#5E2800"}},
  drystone:{steel:{hi:"#B5AFA0", mid:"#98927F", lo:"#706B5D", deep:"#4A463B"}, rust:{hi:"#A4B060", mid:"#616F22", lo:"#46501A", deep:"#2E3410"}},   // rust is moss
  adobe:{steel:{hi:"#E0B88E", mid:"#CC9862", lo:"#95703F", deep:"#6A4E2C"}, rust:{hi:"#C78A56", mid:"#B06C3C", lo:"#84502C", deep:"#5C381E"}},   // rust is bare brick
  stake:{steel:{hi:"#D6B684", mid:"#B8925C", lo:"#8A6C44", deep:"#5E482C"}, rust:{hi:"#B3B0A2", mid:"#8C867A", lo:"#665F56", deep:"#46413A"}},   // rust is weathered grey
  rope:{steel:{hi:"#D2AE7C", mid:"#B8905A", lo:"#8A6A40", deep:"#5E482C"}, rust:{hi:"#B3B0A2", mid:"#8C867A", lo:"#665F56", deep:"#46413A"}},   // rust is frayed grey rope
  bone:{steel:{hi:"#F2E8CC", mid:"#E2D4B0", lo:"#B4A584", deep:"#867A5E"}, rust:{hi:"#DCC884", mid:"#C4AC70", lo:"#9A8450", deep:"#6E5C34"}},   // rust is yellowed bone
  wood:{steel:{hi:"#A58A6E", mid:"#7A5A38", lo:"#5C4329", deep:"#463220"}, rust:{hi:"#B3A58F", mid:"#8E8272", lo:"#6C6256", deep:"#52493F"}},
  lagoon:{steel:{hi:"#E2DED3", mid:"#D6D0C0", lo:"#9E9A8E", deep:"#73706A"}, rust:{hi:"#9AB57F", mid:"#587C42", lo:"#415C31", deep:"#2F4323"}},   // rust is algae
};
// gate: the keeper gate on this side, if it has one (as for fenceSpriteSvg): a section of it gets a post at each end with gold finials and a latch (it never wears, so it stands even when the fence is down).
const GATE_GOLD = {hi:"#E3C67D", mid:"#D8B04A", lo:"#A48638"};   // the keeper gate's latch and finials: the gate marker's gold
function fenceEdgeSvg(kind, a, b, cond, hi, gate, powered){
  const S = FENCE_SPRITES[kind], look = fenceState(cond), px = ROCK_MPP, py = px / TILT, C = FENCE_EDGE[kind].steel, R = FENCE_EDGE[kind].rust, FR = FENCE_EDGE[kind].frame || C, n2 = v => v.toFixed(2);
  const x0 = Math.round(((a[0] + b[0]) / 2 - FENCE_LOOK.edge * px / 2) / px) * px, ya = Math.min(a[1], b[1]), yb = Math.max(a[1], b[1]);
  const rect = (x, y, w, h, fill) => `<rect x="${n2(x)}" y="${n2(y)}" width="${n2(w)}" height="${n2(h)}" fill="${fill}" shape-rendering="crispEdges"/>`;
  const posts = []; for(let y = ya; y < yb + .01; y += S.w * px) posts.push(y);
  if(yb - posts[posts.length - 1] > .05) posts.push(yb);   // and a post at the near end
  let s = "";
  if(S.leafy){
    // a hedge seen end-on is a leafy column five pixels wide and as tall as the hedge: dry colors and a lower top when worn, a low heap of litter when broken
    const P = look === "degrading" || look === "broken" ? R : C, xl = x0 - px, hh = look === "broken" ? 3 : S.h - (look === "degrading" ? 1 : 0), yt = ya - hh * py;
    s += rect(xl, yt, 5 * px, yb - yt, P.mid) + rect(xl, yt, px, yb - yt, P.hi) + rect(xl + 4 * px, yt, px, yb - yt, P.lo) + rect(xl, yt, 5 * px, py, P.hi) + rect(xl, yb - 2 * py, 5 * px, py, P.lo) + rect(xl, yb - py, 5 * px, py, P.deep);
    for(let y = yt + 2 * py, k = 0; y < yb - 3 * py; y += 3 * py, k++) s += rect(xl + (k * 2 % 3 + 1) * px, y, px, py, P.hi) + rect(xl + ((k * 2 + 1) % 3 + 1) * px, y + 1.5 * py, px, py, P.lo);
  } else if(look === "broken"){
    // the heap is three pixels high all along; each post is a snapped stub, rusted at the top
    s += rect(x0, ya - 3 * py, 3 * px, yb - ya + 3 * py, C.lo) + rect(x0, ya - 3 * py, px, yb - ya + 3 * py, C.mid) + rect(x0 + 2 * px, ya - 3 * py, px, yb - ya + 3 * py, C.deep);
    posts.forEach((y, i) => { const h = (7 + i % 3 * 2) * py; s += rect(x0, y - h, px, h, C.hi) + rect(x0 + px, y - h, px, h, C.lo) + rect(x0, y - h, 2 * px, py, R.mid) + rect(x0 + px, y - h * .5, px, 2 * py, R.lo); });
    for(let y = ya + 1.1; y < yb; y += 2.3) s += rect(x0 + (Math.round(y) % 2) * px, y - 3 * py, px, 2 * py, R.mid);
  } else {
    const top = ya - FENCE_SPRITES[kind].h * py, wires = FENCE_SPRITES[kind].wires;
    if(wires){
      // wire fence seen end-on: each wire is a thin line down the middle (shifted up by its height), with a post column and its lamp at every post
      for(const w of wires) s += rect(x0 + px, ya - w * py, px, yb - ya + py, powered === false ? C.mid : C.hi);
      const lamp = powered === false ? FENCE_LAMP.off : look === "degrading" ? FENCE_LAMP.dim : FENCE_LAMP.on;
      for(const y of posts) s += rect(x0, y - (S.h - 2) * py, 3 * px, (S.h - 2) * py, C.mid) + rect(x0, y - (S.h - 2) * py, px, (S.h - 2) * py, C.hi) + rect(x0 + 2 * px, y - (S.h - 2) * py, px, (S.h - 2) * py, C.lo) + rect(x0 + px * .5, y - S.h * py, 2 * px, 2 * py, lamp);
    } else s += rect(x0, top, px, yb - top, C.hi) + rect(x0 + px, top, px, yb - top, C.mid) + rect(x0 + 2 * px, top, px, yb - top, C.lo);
    for(const y of posts) s += (wires ? "" : rect(x0, y - S.h * py, 3 * px, py, FR.hi)) + rect(x0, y - 2 * py, 3 * px, py, FR.mid) + rect(x0, y - py, 3 * px, py, FR.deep);
    if(look === "degrading") posts.forEach((y, i) => { for(const [d, col] of [[.9, 0], [1.7, 2], [2.6, 1], [3.5, 0]]){ const yy = y - FENCE_SPRITES[kind].h * py + (d + i % 2 * .35) / TILT * 1; if(yy < yb) s += rect(x0 + ((col + i) % 3) * px, yy, px, 2 * py, i % 2 ? R.lo : R.mid); } s += rect(x0, y - 6 * py, 2 * px, 3 * py, R.mid) + rect(x0, y - 3 * py, px, py, R.hi); });
  }
  if(gate){
    const GW = (S.gateW || S.w) * px, y1 = Math.min(yb, Math.max(ya, gate.p[1] - GW / 2) + GW), y0 = Math.max(ya, y1 - GW), au = GATE_GOLD, h = S.h * py, ym = (y0 + y1) / 2;
    for(const y of [y0, y1]) s += rect(x0, y - h, 3 * px, py, C.hi) + rect(x0 + px, y - h - py, px, py, au.hi) + rect(x0 + px, y - h, px, py, au.mid) + rect(x0, y - 2 * py, 3 * px, py, C.mid) + rect(x0, y - py, 3 * px, py, C.deep);
    // shut: a latch on the split. Open (drawGates swaps them): a leaf swung out from each post.
    const swung = gate.f >= 2 && kind !== "lagoon", latch = rect(x0 + px, ym - h * .5, px, 3 * py, au.mid) + rect(x0 + px, ym - h * .5, px, py, au.hi) + rect(x0 + px, ym - h * .5 + 2 * py, px, py, au.lo);
    const leaves = [y0, y1].map(y => rect(x0 + 3 * px, y - h * .7, 4 * px, h * .5, C.mid) + rect(x0 + 3 * px, y - h * .7, 4 * px, py, C.hi) + rect(x0 + 6 * px, y - h * .7, px, h * .5, C.lo)).join("");
    if(kind === "lagoon"){   // a catwalk seen end on: the deck juts out to the exhibit's side, the ladder hangs on the outside
      const ex = state.exhibits.find(x => x.id === gate.id), east = !ex || inPoly(gate.p[0] + 1.5, gate.p[1], ex.points), iw = (S.gateW + 3) * px, ih = S.gateH * py;
      s += `<image href="${spriteUrl(`sprites/fence/lagoon-gate-${east ? "e" : "w"}.png`)}" x="${n2(east ? x0 - 3 * px : x0 + 3 * px - S.gateW * px)}" y="${n2(y1 - ih)}" width="${n2(iw)}" height="${n2(ih)}" style="image-rendering:pixelated"/>`;
    }
    else s += `<g data-gate="${esc(gate.id)}" data-edge="1" data-f="${gate.f}"><g data-gc ${swung ? 'display="none"' : ""}>${latch}</g><g data-go ${swung ? "" : 'display="none"'}>${leaves}</g></g>`;
  }
  if(hi) s += `<rect x="${n2(x0)}" y="${n2(ya - S.h * py)}" width="${n2(3 * px)}" height="${n2(yb - ya + S.h * py)}" fill="none" stroke="${hi}" stroke-width="3" vector-effect="non-scaling-stroke"/>`;
  return s;
}
// The side of a closed exhibit its keeper gate sits on, if that side's fence has a gate picture (else -1: the gate stays a gold marker)
// How far each keeper gate is swung (exhibit id: 0 shut to 1 open). Not saved: a gate with nobody at it is shut.
const gateOpen = {};
let gateT = 0;
const gateFrameOf = id => Math.round((gateOpen[id] || 0) * (GATE_OPEN.frames - 1));
// Weather over the map (visual only): one low-res canvas stretched with pixelated scaling, a small fixed pool of square flecks.
const WX_SCALE = 3, WX_N = {cold:36, storm:60};
const WX_TINT = {hot:"rgba(255,140,30,.17)", cold:"rgba(90,140,255,.14)", storm:"rgba(10,15,40,.30)"};
const wxCan = $("#wxfx"), wxCtx = wxCan.getContext("2d"), wxPool = [];
let wxKind = "fair", wxFlash = 0, wxNext = 0;
function drawWeather(now){
  const k = state.weather ? state.weather.today : "fair";
  if(k !== wxKind){ wxKind = k; wxCan.dataset.kind = k; wxFlash = 0; wxCtx.clearRect(0, 0, wxCan.width, wxCan.height); }
  if(k === "fair") return;
  const w = Math.max(1, Math.round(wxCan.clientWidth / WX_SCALE)), h = Math.max(1, Math.round(wxCan.clientHeight / WX_SCALE));
  if(wxCan.width !== w || wxCan.height !== h){ wxCan.width = w; wxCan.height = h; }
  const c = wxCtx, dt = Math.min(.1, (now - (wxCan.t || now)) / 1000); wxCan.t = now;
  c.clearRect(0, 0, w, h);
  c.fillStyle = WX_TINT[k]; c.fillRect(0, 0, w, h);
  if(k === "hot"){   // gentle shimmer: faint pale rows, each broken into short dashes of different lengths that drift sideways at their own pace
    c.fillStyle = "rgba(255,230,160,.07)";
    for(let i = 0; i < 9; i++){
      const y = Math.floor((now / 40 * (.7 + i % 3 * .25) + i * h / 9) % h), sp = (i % 2 ? 1 : -1) * (.012 + i % 4 * .006);
      for(let j = 0, x = (i * 37) % 23; x < w + 40; j++){
        const len = 8 + (i * 13 + j * 29) % 31, gap = 10 + (i * 7 + j * 19) % 41;
        const xx = ((x + now * sp + Math.sin(now / 700 + i + j) * 3) % (w + 40) + w + 40) % (w + 40) - 20;
        c.fillRect(Math.floor(xx), y, len, 1);
        x += len + gap;
      }
    }
    return;
  }
  const n = WX_N[k];
  while(wxPool.length < n) wxPool.push({x:Math.random() * 400, y:Math.random() * 300, z:.6 + Math.random() * .6});
  for(let i = 0; i < n; i++){
    const p = wxPool[i];
    if(k === "storm"){ p.x -= 90 * p.z * dt; p.y += 260 * p.z * dt; }
    else { p.x += Math.sin(now / 900 + i) * 8 * dt; p.y += 14 * p.z * dt; }
    if(p.y > h){ p.y = -4; p.x = Math.random() * (w + 40); }
    if(p.x < -6) p.x = w + Math.random() * 20; else if(p.x > w + 6) p.x = 0;
    if(k === "storm"){ c.fillStyle = "rgba(190,210,255,.55)"; const x = Math.floor(p.x), y = Math.floor(p.y); c.fillRect(x, y, 1, 2); c.fillRect(x - 1, y + 2, 1, 2); }
    else { c.fillStyle = "rgba(255,255,255,.85)"; c.fillRect(Math.floor(p.x), Math.floor(p.y), 1, 1); }
  }
  if(k === "storm"){
    if(now > wxNext){ wxFlash = .35; wxNext = now + 4000 + Math.random() * 9000; }
    if(wxFlash > 0){ c.fillStyle = `rgba(255,255,255,${wxFlash.toFixed(2)})`; c.fillRect(0, 0, w, h); wxFlash -= dt * 2.5; }
  }
}
// Every frame: swing each gate on screen toward open if a keeper, vet or mechanic is at it, else toward shut, and show the matching picture.
function drawGates(now){
  const dt = Math.max(0, Math.min(.1, (now - gateT) / 1000)); gateT = now;
  const els = document.querySelectorAll("[data-gate]"); if(!els.length) return;
  const who = [];
  for(const c of [...crew, ...vcrew, ...mcrew]){ const p = c.at && staffPos(c); if(p) who.push(p); }
  const moved = new Set();
  for(const el of els){
    const id = el.dataset.gate, e = state.exhibits.find(x => x.id === id); if(!e || !e.gate) continue;
    if(!moved.has(id)){
      moved.add(id);
      const goal = who.some(p => Math.hypot(p[0] - e.gate[0], p[1] - e.gate[1]) <= GATE_OPEN.reach) ? 1 : 0, v = gateOpen[id] || 0;
      gateOpen[id] = goal > v ? Math.min(1, v + GATE_OPEN.speed * dt) : Math.max(0, v - GATE_OPEN.speed * dt);
    }
    if(el.dataset.fixed) continue;
    const f = gateFrameOf(id);
    if(el.dataset.f === String(f)) continue;
    el.dataset.f = f;
    if(el.dataset.edge){ el.querySelector("[data-gc]").setAttribute("display", f >= 2 ? "none" : ""); el.querySelector("[data-go]").setAttribute("display", f >= 2 ? "" : "none"); }
    else el.setAttribute("href", spriteUrl(`sprites/fence/${el.dataset.pic}-gate${el.dataset.off ? "-off" : ""}${f ? "-" + f : ""}.png`));
  }
}
function gateSide34(e, kinds){
  if(!e.gate || e.open || e.viv) return -1;
  const P = e.points; let best = -1, bd = Infinity;
  for(let i = 0; i < P.length; i++){ const d = segProj(e.gate[0], e.gate[1], P[i], P[(i + 1) % P.length]).d; if(d < bd){ bd = d; best = i; } }
  const F = FENCE34[Array.isArray(kinds) ? kinds[best] : kinds];
  return F && F.sprite && FENCE_SPRITES[F.sprite].gate ? best : -1;
}
// kind is one fence for every side, or a list with one kind a side (a grid exhibit's pieces)
// o: hi (outline color), cond (the exhibit's condition, which picks a bar fence's picture), gate ({i: side, p: point, id: exhibit id, f: open frame}), lights/powered (electric posts)
function fence34(P, closed, kinds, which, o = {}){
  const n = closed ? P.length : P.length - 1, hi = o.hi, n2 = v => v.toFixed(2);
  const segs = [];
  for(let i = 0; i < n; i++){ let a = P[i], b = P[(i+1) % P.length]; const ny = closed ? norm34(P, i)[1] : 0, off = o.off && o.off[i];
    if(which === "back" && ny > .05 || which === "front" && ny <= .05) continue;
    if(off){ a = [a[0] + off[0], a[1] + off[1]]; b = [b[0] + off[0], b[1] + off[1]]; }   // a wall shared with another pen's fence stands a little inside, so both show
    segs.push({i, a, b, ny, y:(a[1] + b[1]) / 2, kind:Array.isArray(kinds) ? kinds[i] : kinds}); }
  segs.sort((p, q) => p.y - q.y);
  const up = h => lift34(h), M = ([x, y]) => `M${n2(x)} ${n2(y)}`, Lto = ([x, y]) => `L${n2(x)} ${n2(y)}`, at = (a, b, f) => [a[0] + (b[0] - a[0])*f, a[1] + (b[1] - a[1])*f];
  let s = "";
  for(const {i, a, b, ny, kind} of segs){
    const F = FENCE34[kind] || FENCE34.wood, H = F.h, q = [a, b, up(H)(b), up(H)(a)], front = which === "front";
    if(F.hedge && !F.sprite){
      s += `<polygon points="${polyStr(q)}" fill="#3F7A32" stroke="#24461F" stroke-width="1" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>` + shade34(q, lit34(closed ? norm34(P, i) : [0, 1]) * .5);
      s += `<path d="${M(up(H)(a))}${Lto(up(H)(b))}" stroke="#6BA851" stroke-width="1.1" stroke-linecap="round" fill="none"/>`;
      if(hi) s += `<path d="${M(up(H)(a))}${Lto(up(H)(b))}" stroke="${hi}" stroke-width="3" vector-effect="non-scaling-stroke" fill="none"/>`;
      continue;
    }
    if(F.solid && !F.sprite){
      const op = F.solid * (front ? .55 : 1);
      s += `<polygon points="${polyStr(q)}" fill="${F.col}" fill-opacity="${op.toFixed(2)}" stroke="#3A3A34" stroke-opacity=".5" stroke-width="1" vector-effect="non-scaling-stroke"/>` + (F.solid === 1 && !front ? shade34(q, lit34(closed ? norm34(P, i) : [0, 1]) * .4) : "");
      s += `<path d="${M(up(H)(a))}${Lto(up(H)(b))}" stroke="${hi || (kind === "concrete" ? "#8E8778" : "#D8EEF5")}" stroke-width="${hi ? 3 : 2}" stroke-linecap="round" vector-effect="non-scaling-stroke" fill="none"/>`;
      continue;
    }
    // a fence with pictures (bars, wood) stands as them, by the exhibit's condition; a side seen edge-on is a column instead
    if(F.sprite){
      const gp = o.gate && o.gate.i === i ? o.gate : null;
      s += fenceSpriteSvg(F.sprite, a, b, o.cond, gp, o.powered) || fenceEdgeSvg(F.sprite, a, b, o.cond, hi, gp, o.powered);
      if(hi) s += `<path d="${M(up(H)(a))}${Lto(up(H)(b))}" stroke="${hi}" stroke-width="3" vector-effect="non-scaling-stroke" fill="none"/>`;
      continue;
    }
    // posts, then rails (and bars or wires) between them
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), np = Math.max(1, Math.round(L / F.step)), col = F.col;
    let posts = "", rails = "", thin = "";
    for(let k = 0; k <= np; k++){ const p = at(a, b, k / np); posts += M(p) + Lto(up(H + (F.wire ? .2 : 0))(p)); }
    for(const h of F.rails) (F.wire ? (thin += M(up(h)(a)) + Lto(up(h)(b))) : (rails += M(up(h)(a)) + Lto(up(h)(b))));
    if(F.bars){ const nb = Math.round(L / F.bars); for(let k = 1; k < nb; k++){ const p = at(a, b, k / nb); thin += M(up(.25)(p)) + Lto(up(2.5)(p)); } }
    s += `<path d="${thin}" stroke="${col}" stroke-width="${F.wire ? .8 : 1}" stroke-opacity="${F.wire ? .8 : .9}" vector-effect="non-scaling-stroke" fill="none"/>`;
    s += `<path d="${rails}" stroke="${col}" stroke-width="2" vector-effect="non-scaling-stroke" fill="none"/><path d="${posts}" stroke="${col}" stroke-width="2.6" stroke-linecap="round" vector-effect="non-scaling-stroke" fill="none"/>`;
    if(hi) s += `<path d="${M(up(F.rails[F.rails.length - 1])(a))}${Lto(up(F.rails[F.rails.length - 1])(b))}" stroke="${hi}" stroke-width="3" vector-effect="non-scaling-stroke" fill="none"/>`;
    // the Genesis electric fence's amber post lights, dark when the power is out
    if(F.wire && o.lights){ let d = ""; for(let k = 0; k <= np; k++) d += M(up(H + .2)(at(a, b, k / np))) + "h0.001";
      s += o.powered === false ? `<path d="${d}" stroke="#2A2E2B" stroke-width="3.5" stroke-linecap="round" vector-effect="non-scaling-stroke" fill="none"/>` : `<path d="${d}" stroke="#FFB547" stroke-opacity=".35" stroke-width="9" stroke-linecap="round" vector-effect="non-scaling-stroke" fill="none"/><path d="${d}" stroke="#FFC25E" stroke-width="3.6" stroke-linecap="round" vector-effect="non-scaling-stroke" fill="none"/>`; }
  }
  return `<g pointer-events="none">${s}</g>`;
}
// A vivarium in the flat pixel style (3/4 view): a glass case in a frame, one flat tone a face (left lightest, front base, right darkest), snapped to the 0.13 m pixel.
// S is a light aluminium case, M a dark wood one, L a dark aluminium case with a middle post and two lamp bars. Each size has its own label plate.
const VIV34 = {
  S:{frame:["#DDE2E5", "#B4BCC1", "#89939A"], top:"#EEF1F3", sill:.35, post:.22, lamps:1, label:"S"},
  M:{frame:["#7A5638", "#5E402A", "#432D1E"], top:"#94694A", sill:.45, post:.28, lamps:1, label:"M"},
  L:{frame:["#6F7980", "#4F575D", "#363C41"], top:"#8793A0", sill:.55, post:.34, lamps:2, mullion:true, label:"L"}};
const VIV_GLASS34 = ["#CFEAEE", "#A9D3DA", "#86B6C0"];
// An aquarium's water: its colour clean and foul (mixed by water quality), how thick it looks clean and foul, and how much of that its top surface takes
const AQUA34 = {clean:"#1E6FA8", foul:"#56652A", alpha:[.38, .8], surface:.35, sand:"#C9B486"};
// The waterline's height in meters: a little under the lid
const aquaLine = e => VIVARIUMS[e.viv].d * .45 - .6;
// A paludarium's water: its depth in meters, and the flooded part of the floor (the front of the case, from paluY)
const paluLine = e => VIVARIUMS[e.viv].d * .45 * PALU.depth;
const paluPoly = e => { const b = bbox(e.points), y = paluY(e); return [[b.x0, y], [b.x1, y], [b.x1, b.y1], [b.x0, b.y1]]; };
function vivMix34(a, b, t){
  const h = c => /^#[0-9a-f]{6}$/i.test(c) ? [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)) : null, x = h(a), y = h(b);
  return x && y ? "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("") : a;
}
const vivFace34 = nx => nx < -.3 ? 0 : nx > .3 ? 2 : 1;
const vivSubCache = {};
// the floor of a vivarium: the biome's substrate, flat, with rows of darker and lighter dashes and a lit strip along the far sides
function vivFloor34(e, c, dead, on, reach){
  const P = e.points, bio = BIOMES[biomeOf(e)].color, sub = e.aqua ? AQUA34.sand : vivMix34(bio, "#5A4630", .4), key = e.viv + "|" + sub + "|" + polyStr(P);
  let det = vivSubCache[key];
  if(!det){
    const bb = bbox(P), inner = insetRect(P, .9), dark = vivMix34(sub, "#000000", .2), light = vivMix34(sub, "#FFFFFF", .18);
    let dk = "", lt = "";
    for(let r = 0, y = bb.y0 + .45; y < bb.y1; r++, y += .52){
      for(let x = bb.x0 + ((r * 7) % 5) * .35 + .3; x < bb.x1; x += 1.7){
        if(!inPoly(x + .26, y, inner)) continue;
        const a = flatSnap34([x, y]), b = flatSnap34([x + .52, y + .13]), d = `M${a[0].toFixed(2)} ${a[1].toFixed(2)}H${b[0].toFixed(2)}V${b[1].toFixed(2)}H${a[0].toFixed(2)}z`;
        if(r % 3 === 2) lt += d; else dk += d;
      }
    }
    const [cx, cy] = centroid(P); let strips = "";
    for(let i = 0; i < P.length; i++){   // a lit strip just inside each far side
      const n = norm34(P, i); if(n[1] > -.05) continue;
      const a = P[i], b = P[(i + 1) % P.length], w = .26;
      strips += flatPoly34([a, b, [b[0] - n[0]*w, b[1] - n[1]*w], [a[0] - n[0]*w, a[1] - n[1]*w]], light, "", true);
    }
    det = vivSubCache[key] = `${strips}<path d="${dk}" fill="${dark}" shape-rendering="crispEdges" pointer-events="none"/><path d="${lt}" fill="${light}" shape-rendering="crispEdges" pointer-events="none"/>`;
  }
  const stroke = dead || on || !reach ? `stroke="${dead ? "var(--bad)" : on ? "var(--sel)" : "#24414A"}" stroke-width="${on || dead ? 3.5 : 2}" ${reach ? "" : `stroke-dasharray="4 3"`} stroke-linejoin="round" vector-effect="non-scaling-stroke"` : "";
  const scene = vivScene34(e, "floor");   // a scene's floor takes the place of the plain substrate; the outline goes back over it
  if(scene) return flatPoly34(P, sub) + scene + (stroke ? flatPoly34(P, "none", stroke, true) : "") + (c ? flatPoly34(P, c, `fill-opacity=".2"`, true) : "");
  return flatPoly34(P, sub, stroke) + (c ? flatPoly34(P, c, `fill-opacity=".2"`, true) : "") + det + (e.palu ? paluWater34(e) : "");
}
// A paludarium with no scene: its front flooded in flat water, a row of stones along the shore, rows of ripple dashes
function paluWater34(e){
  const W = paluPoly(e), bb = bbox(W), col = AQUA34.clean, lt = vivMix34(col, "#FFFFFF", .35), dk = vivMix34(col, "#000000", .25);
  let s = flatPoly34(W, col, "", true) + flatPoly34([[bb.x0, bb.y0], [bb.x1, bb.y0], [bb.x1, bb.y0 + .25], [bb.x0, bb.y0 + .25]], "#8A8478", "", true), d = "";
  for(let r = 0, y = bb.y0 + .7; y < bb.y1 - .2; r++, y += .45) for(let x = bb.x0 + (r * 1.3) % 2 + .3; x < bb.x1 - .5; x += 2.2){ const a = flatSnap34([x, y]), b = flatSnap34([x + .45, y + .13]); d += `M${a[0].toFixed(2)} ${a[1].toFixed(2)}H${b[0].toFixed(2)}V${b[1].toFixed(2)}H${a[0].toFixed(2)}z`; }
  return s + flatPoly34([[bb.x0, bb.y1 - .5], [bb.x1, bb.y1 - .5], [bb.x1, bb.y1], [bb.x0, bb.y1]], dk, "", true) + `<path d="${d}" fill="${lt}" shape-rendering="crispEdges" pointer-events="none"/>`;
}
// A vivarium's scene (tools/pixelvivscene.py): "floor" lies over the whole floor (a paludarium's floor, flooded at the front, from tools/pixelpaluscene.py); "wall" fills the back pane from the top of the sill to the top of the glass
function vivScene34(e, layer){
  if(!e.vivScene || !VIVARIUMS[e.viv]) return "";
  if(layer === "floor" && e.palu && !e.vivScene.sea) layer = "palu";
  const bb = bbox(e.points), K = VIV34[e.viv] || VIV34.M, H = VIVARIUMS[e.viv].d * .45, n2 = v => v.toFixed(2);
  const [a, b] = layer === "wall" ? [flatSnap34([bb.x0, bb.y0 - H / TILT]), flatSnap34([bb.x1, bb.y0 - K.sill / TILT])] : [flatSnap34([bb.x0, bb.y0]), flatSnap34([bb.x1, bb.y1])];
  return `<image href="${spriteUrl(`sprites/vivscene/${vivSceneKey(e.vivScene)}-${e.viv}-${layer}.png`)}" x="${n2(a[0])}" y="${n2(a[1])}" width="${n2(b[0] - a[0])}" height="${n2(b[1] - a[1])}" preserveAspectRatio="none" style="image-rendering:pixelated" pointer-events="none"/>`;
}
// A glass box on a solid base: "back" draws the far panes and sill (before what's inside), "front" the near panes, sill and the lid glass. All glass but the base, with a thin see-through light blue border: no posts, beams or lamp bars
function viv34(e, which, hi){
  const P = e.points, V = VIVARIUMS[e.viv], K = VIV34[e.viv] || VIV34.M, H = V.d * .45, up = lift34(H), back = which === "back", n2 = v => v.toFixed(2);
  const [cx, cy] = centroid(P), fr = K.frame, rim = .25, op = a => `fill-opacity="${a}"`;
  const wallQ = (i, f0, f1, h0, h1, fill, a) => flatPoly34([onEdge34(P, i, f0, h0), onEdge34(P, i, f1, h0), onEdge34(P, i, f1, h1), onEdge34(P, i, f0, h1)], fill, a ? op(a) : "", true);
  let s = "";
  if(e.aqua || e.palu && !back){   // the water: an aquarium's far faces behind the animals, then the near faces and a thinner surface over them (a paludarium's only over its flooded front); clear blue when clean, thicker and greener as it fouls
    const w = wqOf(e) / 100, col = vivMix34(AQUA34.foul, AQUA34.clean, w), a = AQUA34.alpha[0] + (AQUA34.alpha[1] - AQUA34.alpha[0]) * (1 - w), wl = e.palu ? paluLine(e) : aquaLine(e), WP = e.palu ? paluPoly(e) : P;
    for(let i = 0; i < P.length; i++) if(back ? norm34(P, i)[1] <= .05 : norm34(P, i)[1] > .05) s += wallQ(i, 0, 1, back ? 0 : K.sill, wl, back || e.palu ? vivMix34(col, "#000000", e.palu ? .3 : .15) : col, a.toFixed(2));   // a paludarium's front band darker, as deep water seen through the glass
    if(!back && e.palu){   // a paludarium's water is drawn on its floor: here only a film of murk on it as it fouls, and the waterline on the front glass
      if(w < 1) s += flatPoly34(WP, AQUA34.foul, op(((1 - w) * .6).toFixed(2)), true);
      for(let i = 0; i < P.length; i++) if(norm34(P, i)[1] > .05){ const p = onEdge34(P, i, 0, wl), q = onEdge34(P, i, 1, wl); s += `<path d="M${n2(p[0])} ${n2(p[1])}L${n2(q[0])} ${n2(q[1])}" stroke="${vivMix34(col, "#FFFFFF", .6)}" stroke-opacity=".8" stroke-width="${FLAT34.px}" fill="none" shape-rendering="crispEdges"/>`; }
    }
    else if(!back){
      s += flatPoly34(WP.map(lift34(wl)), vivMix34(col, "#FFFFFF", .15), op((a * AQUA34.surface).toFixed(2)), true);
      for(let i = 0; i < WP.length; i++){ const p = lift34(wl)(WP[i]), q = lift34(wl)(WP[(i + 1) % WP.length]); s += `<path d="M${n2(p[0])} ${n2(p[1])}L${n2(q[0])} ${n2(q[1])}" stroke="${vivMix34(col, "#FFFFFF", .6)}" stroke-opacity=".7" stroke-width="${FLAT34.px}" fill="none" shape-rendering="crispEdges"/>`; }
    }
  }
  for(let i = 0; i < P.length; i++){
    const n = norm34(P, i); if(back ? n[1] > .05 : n[1] <= .05) continue;
    const f = vivFace34(n[0]), ft = back ? 2 - f : f;   // the far panes are seen from inside, so their light is turned around
    s += wallQ(i, 0, 1, 0, H, VIV_GLASS34[f], back ? .42 : .17);
    if(back) s += wallQ(i, 0, 1, 0, K.sill, fr[ft]);
    else {
      const pt = (fr_, h_) => onEdge34(P, i, fr_, h_), lo = K.sill + .15, hi_ = H - rim - .1;
      s += flatPoly34([pt(.12, lo), pt(.2, lo), pt(.34, hi_), pt(.26, hi_)], "#FFFFFF", op(.3), true) + flatPoly34([pt(.4, lo), pt(.43, lo), pt(.51, hi_), pt(.48, hi_)], "#FFFFFF", op(.2), true);
      s += wallQ(i, 0, 1, 0, K.sill, fr[f]) + wallQ(i, 0, 1, K.sill - .13, K.sill, fr[Math.max(0, f - 1)]);
    }
  }
  // a one-pixel light blue, see-through border: the floor's edges behind the animals, the lid's in front, and the corner edges from the foot of the base up
  const ln = (a, b) => `<path d="M${n2(a[0])} ${n2(a[1])}L${n2(b[0])} ${n2(b[1])}" stroke="#BFE6F5" stroke-opacity=".6" stroke-width="${FLAT34.px}" fill="none" shape-rendering="crispEdges"/>`;
  for(let i = 0; i < P.length; i++){
    const a = P[i], b = P[(i + 1) % P.length];
    s += back ? ln(a, b) : ln(up(a), up(b));
    if(back ? a[1] <= cy : a[1] > cy) s += ln(a, up(a));
  }
  if(!back){
    // the lid: clear glass
    s += flatPoly34(P.map(up), "#DDEFF2", op(.16), true);
    if(hi) s += `<polygon points="${polyStr(P)}" fill="none" stroke="${hi}" stroke-width="3" stroke-linejoin="round" vector-effect="non-scaling-stroke"/><polygon points="${polyStr(P.map(up))}" fill="none" stroke="${hi}" stroke-width="3" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
  }
  return `<g pointer-events="none">${s}</g>`;
}
// an upright cylinder standing at (x, y): stacks, bins
function cyl34(x, y, r, h, fill, ln){
  const top = y - h / TILT;
  return `<rect x="${(x - r).toFixed(2)}" y="${top.toFixed(2)}" width="${(2*r).toFixed(2)}" height="${(h / TILT).toFixed(2)}" fill="${fill}" ${ln}/><ellipse cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" rx="${r.toFixed(2)}" ry="${(r*TILT).toFixed(2)}" fill="${fill}" ${ln}/><ellipse cx="${x.toFixed(2)}" cy="${top.toFixed(2)}" rx="${r.toFixed(2)}" ry="${(r*TILT).toFixed(2)}" fill="#3A3A34" ${ln}/>`;
}
// labs and the resort: a flat roofed block, windows floor by floor, the theme's roof art on top
function block34(bl, t, S, P, col, line, inv){
  const W = S.wall, wallCol = S.wallCol || WALL34, glass = "#3B5566", thin = `stroke="#1D2B22" stroke-width="1" vector-effect="non-scaling-stroke"`;
  const gc = S.glassCol || "#9FCFC0", w = walls34(P, 0, W, S.glass ? gc : wallCol, line), fe = faceEdge(P, bl.face === undefined ? 2 : bl.face), main = norm34(P, fe)[1] > .05 ? fe : -1, graf = main >= 0 ? main : w.main;   // the door wall, unless the camera can't see it
  let s = w.s;
  for(const i of [...Array(P.length).keys()].filter(j => norm34(P, j)[1] > .05)){
    const L = edgeLen34(P, i);
    if(S.glass){
      // The Botany Lab: a concrete plinth under glass walls with frames every 2 meters
      s += quad34(P, i, 0, 1, 0, 1.2, wallCol);
      for(let k = 1; k < Math.round(L / 2); k++){ const a = onEdge34(P, i, k * 2 / L, 1.2), b = onEdge34(P, i, k * 2 / L, W); s += `<path d="M${a[0].toFixed(2)} ${a[1].toFixed(2)}L${b[0].toFixed(2)} ${b[1].toFixed(2)}" stroke="#E8F0EC" stroke-width="1" vector-effect="non-scaling-stroke" pointer-events="none"/>`; }
    } else if(S.front === "resort"){
      // a balcony and a row of windows on every floor
      for(let f = 0; f * 3.4 + 3 < W; f++){ const b = f * 3.4;
        s += quad34(P, i, .04, .96, b + 1, b + 2.6, glass) + quad34(P, i, .04, .96, b + 2.2, b + 2.6, "#fff", `fill-opacity=".14"`);
        if(f) s += `<polygon points="${polyStr([onEdge34(P, i, .03, b + .9), onEdge34(P, i, .97, b + .9), onEdge34(P, i, .97, b + .9, 1), onEdge34(P, i, .03, b + .9, 1)])}" fill="#fff" ${thin}/>`;
        for(let k = 1; k < Math.round(L / 3.5); k++) s += quad34(P, i, k * 3.5 / L - .08 / L, k * 3.5 / L + .08 / L, b + 1, b + 2.6, wallCol); }
      s += quad34(P, i, 0, 1, W - 1, W - .2, col);
    } else if(S.doors){
      // garages and stores: high windows, and on the front roll-up doors (raised to truck height at a dock)
      s += quad34(P, i, .08, .92, W - 2.3, W - 1.5, glass) + quad34(P, i, 0, 1, W - 1, W - .25, col);
      if(i === main){
        const n = S.doors, dw = Math.min(3.4, L * .8 / n) / L, b = S.dock ? 1.2 : 0, top = Math.min(W - 1.3, b + 3.6);
        for(let k = 0; k < n; k++){ const f = (k + .5) / n;
          s += quad34(P, i, f - dw/2, f + dw/2, b, top, "#7C848A", thin);
          for(let j = 1; j < 4; j++){ const h = b + (top - b) * j / 4, a = onEdge34(P, i, f - dw/2, h), c = onEdge34(P, i, f + dw/2, h); s += `<path d="M${a[0].toFixed(2)} ${a[1].toFixed(2)}L${c[0].toFixed(2)} ${c[1].toFixed(2)}" stroke="#5E666C" stroke-width="1" vector-effect="non-scaling-stroke" pointer-events="none"/>`; } }
        if(S.dock){ const ledge = [onEdge34(P, i, .03, 1.2), onEdge34(P, i, .97, 1.2), onEdge34(P, i, .97, 1.2, 1.6), onEdge34(P, i, .03, 1.2, 1.6)], face = [onEdge34(P, i, .03, 0, 1.6), onEdge34(P, i, .97, 0, 1.6), onEdge34(P, i, .97, 1.2, 1.6), onEdge34(P, i, .03, 1.2, 1.6)];
          s += `<polygon points="${polyStr(ledge)}" fill="#B8B1A2" ${thin}/><polygon points="${polyStr(face)}" fill="#8E8778" ${thin}/>`; }
      }
    } else {
      // ribbon windows, one band a floor, under the department's color band
      for(let b = 0; b + 3 < W; b += 3.3) s += quad34(P, i, .05, .95, b + 1.1, b + 2.3, glass) + quad34(P, i, .05, .55, b + 1.9, b + 2.3, "#fff", `fill-opacity=".12"`);
      s += quad34(P, i, 0, 1, W - 1, W - .25, col);
    }
    if(i === main){
      // the way in: glass doors under a canopy, and the name on the band above
      const dw = Math.min(1.6, L * .08) / L;
      if(!S.doors){
      s += quad34(P, i, .5 - dw, .5 + dw, 0, 2.6, S.front === "resort" ? "#2B2418" : "#22313A");
      const cv = [onEdge34(P, i, .5 - dw*1.6, 3), onEdge34(P, i, .5 + dw*1.6, 3), onEdge34(P, i, .5 + dw*1.6, 3, 1.8), onEdge34(P, i, .5 - dw*1.6, 3, 1.8)];
      s += `<polygon points="${polyStr(cv)}" fill="${S.front === "resort" ? col : wallCol}" ${thin}/>` + shade34(cv, .4);
      }
      if(S.top === "cross"){ const h = W - 2.6, cw = .35 / L; s += quad34(P, i, .5 - cw, .5 + cw, h - 1.3, h + .3, "#D9363E") + quad34(P, i, .5 - cw * 3.4, .5 + cw * 3.4, h - .75, h - .25, "#D9363E"); }
      s += sign34(P, i, W - .62, esc(S.front === "resort" ? "RESORT" : (t.tag || t.label)), Math.min(.6, L * .04));
    }
    if(i === graf && (bl.graffiti || 0) >= VANDAL.grossAt){ const [x0, y0] = onEdge34(P, i, .3, 1.1), [x1] = onEdge34(P, i, .7, 1.1), g = (x1 - x0)/4;
      s += `<path d="M${x0} ${y0}q${g/2} ${-g*.8} ${g} 0t${g} 0t${g} 0t${g} 0" fill="none" stroke="#C04BD8" stroke-width="${Math.max(.6, 2.2*inv)}" stroke-linecap="round" pointer-events="none"/>`; }
  }
  // the roof: the same art as the flat map (rooftop units), just lifted
  const R = P.map(lift34(W)), [rx, ry] = centroid(R), k = 1/inv;
  if(S.glass){
    s += `<polygon points="${polyStr(R)}" fill="${S.glassCol || "#BFE3D9"}" fill-opacity=".92" ${line}/>`;
    const L0 = edgeLen34(P, 0); for(let j = 1; j < Math.round(L0 / 2); j++){ const f = j * 2 / L0, a = [R[0][0] + (R[1][0] - R[0][0])*f, R[0][1] + (R[1][1] - R[0][1])*f], b = [R[3][0] + (R[2][0] - R[3][0])*f, R[3][1] + (R[2][1] - R[3][1])*f]; s += `<path d="M${a[0].toFixed(2)} ${a[1].toFixed(2)}L${b[0].toFixed(2)} ${b[1].toFixed(2)}" stroke="#E8F0EC" stroke-width="1" vector-effect="non-scaling-stroke" pointer-events="none"/>`; }
    s += shade34(insetRect(R, .5), .6);
  } else {
    s += `<polygon points="${polyStr(R)}" fill="${col}" ${line}/>` + themeBuildSvg({...bl, points:R}, polyStr(R), polyStr(insetRect(R, .86)));
    s += `<polygon points="${polyStr(insetRect(R, .96))}" fill="none" stroke="#1D2B22" stroke-opacity=".35" stroke-width="1" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
  }
  if(S.front === "resort"){ const pool = insetRect(R, .42).map(([x, y]) => [x + (R[1][0] - rx)*.3, y + (R[1][1] - ry)*.3]); s += `<polygon points="${polyStr(pool)}" fill="#5FB7D6" stroke="#fff" stroke-width="2" vector-effect="non-scaling-stroke" pointer-events="none"/>`; }
  const spot = f => [rx + (R[1][0] - rx)*f, ry + (R[1][1] - ry)*f], ln = `stroke="#1D2B22" stroke-width="1" vector-effect="non-scaling-stroke" pointer-events="none"`;
  if(S.top === "dome"){ const [x, y] = spot(.5), r = Math.min(t.w, t.d) * .2;
    s += `<path d="M${(x - r).toFixed(2)} ${y.toFixed(2)}A${r.toFixed(2)} ${(r / TILT).toFixed(2)} 0 0 1 ${(x + r).toFixed(2)} ${y.toFixed(2)}A${r.toFixed(2)} ${(r*TILT).toFixed(2)} 0 0 1 ${(x - r).toFixed(2)} ${y.toFixed(2)}Z" fill="#DDE3E8" ${ln}/>`;
    s += `<path d="M${(x - r*.55).toFixed(2)} ${(y - r*.5 / TILT).toFixed(2)}A${(r*.7).toFixed(2)} ${(r*.7 / TILT).toFixed(2)} 0 0 1 ${(x + r*.1).toFixed(2)} ${(y - r*.95 / TILT).toFixed(2)}" fill="none" stroke="#fff" stroke-width="2" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
    s += `<path d="M${x.toFixed(2)} ${(y - r / TILT).toFixed(2)}v${(-r*.5 / TILT).toFixed(2)}" stroke="#3A3A34" stroke-width="1.5" vector-effect="non-scaling-stroke" pointer-events="none"/>`; }
  if(S.top === "antenna"){ const [x, y] = spot(.5), h = 5 / TILT; s += `<path d="M${x.toFixed(2)} ${y.toFixed(2)}v${(-h).toFixed(2)}M${(x - .9).toFixed(2)} ${(y - h*.6).toFixed(2)}h1.8M${(x - .6).toFixed(2)} ${(y - h*.85).toFixed(2)}h1.2" stroke="#3A3A34" stroke-width="1.5" vector-effect="non-scaling-stroke" pointer-events="none"/><circle cx="${x.toFixed(2)}" cy="${(y - h).toFixed(2)}" r=".35" fill="#E5484D" pointer-events="none"/>`; }
  if(S.top === "tanks") for(const f of [.15, .5, .85]){ const [x, y] = [rx + (R[1][0] - R[0][0])*(f - .5)*.8, ry + (R[2][1] - R[1][1])*.1]; s += cyl34(x, y, 1.5, 1.6, "#6E9BB5", ln); }
  if(S.top === "stacks") for(const f of [.45, .7]){ const [x, y] = spot(f); s += cyl34(x, y, .9, 3.5, "#B9B4A8", ln); }
  if(S.top === "cross"){ const [x, y] = spot(.55), a = 1.6, b = .5; s += `<path d="M${x - b} ${y - a}h${2*b}v${a - b}h${a - b}v${2*b}h${b - a}v${a - b}h${-2*b}v${b - a}h${b - a}v${-2*b}h${a - b}Z" fill="#D9363E" stroke="#fff" stroke-width="1.5" vector-effect="non-scaling-stroke" pointer-events="none"/>`; }
  // the name on the roof once there's room for it, like the flat map
  if(t.d * k >= 26 && S.front !== "resort") s += `<text class="glyph" x="${rx.toFixed(2)}" y="${ry.toFixed(2)}" font-size="${Math.min(t.d * .42, 15*inv)}" letter-spacing=".04em">${t.tag || t.label}</text>`;
  if(main < 0) s += faceMark34(P, fe, W, graf, esc(S.front === "resort" ? "RESORT" : (t.tag || t.label)));
  return s;
}
// the dark flap on a tent's front gable
function tentDoor34(Q){
  const i = [...Array(4).keys()].reduce((m, j) => norm34(Q, j)[1] > norm34(Q, m)[1] ? j : m, 0);
  return `<polygon points="${polyStr([onEdge34(Q, i, .3, 0), onEdge34(Q, i, .7, 0), onEdge34(Q, i, .5, 1.3)])}" fill="#2B2418" fill-opacity=".8" pointer-events="none"/>`;
}
// the campground: tents around a fire, on a dirt pitch
function camp34(bl, P, col, line){
  const [cx, cy] = centroid(P), U = [(P[1][0] - P[0][0])/2, (P[1][1] - P[0][1])/2], V = [(P[3][0] - P[0][0])/2, (P[3][1] - P[0][1])/2];
  const at = (u, v) => [cx + U[0]*u + V[0]*v, cy + U[1]*u + V[1]*v], cols = [col, "#D9822B", "#3F7FB5", "#C9A24B", "#8C4F7D"], h = Math.round(rotLevel(bl) * 997);
  const lu = Math.hypot(...U), lv = Math.hypot(...V), tl = 2.6, tw = 3.4;   // narrow across, long front to back, so the door faces the viewer
  const tents = [[-.62, -.55], [0, -.6], [.62, -.55], [-.62, .5], [.62, .5]].map(([u, v], j) => {
    const [x, y] = at(u, v), du = [U[0]/lu, U[1]/lu], dv = [V[0]/lv, V[1]/lv];
    return {y, pts:[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [x + du[0]*a*tl/2 + dv[0]*b*tw/2, y + du[1]*a*tl/2 + dv[1]*b*tw/2]), c:cols[(j + h) % cols.length]};
  }).sort((a, b) => a.y - b.y);
  let s = `<polygon points="${polyStr(insetRect(P, .97))}" fill="none" ${line}/>`;
  const [fx, fy] = at(0, .25);
  s += `<circle cx="${fx.toFixed(2)}" cy="${fy.toFixed(2)}" r="1" fill="#6E6A60"/><circle cx="${fx.toFixed(2)}" cy="${fy.toFixed(2)}" r=".6" fill="#E8742A"/><circle cx="${fx.toFixed(2)}" cy="${(fy - .2).toFixed(2)}" r=".3" fill="#FFD27A"/>`;
  for(const tn of tents) s += `<polygon points="${polyStr(tn.pts.map(([x, y]) => [x + .35, y + .3]))}" fill="#1D2B22" fill-opacity=".2" pointer-events="none"/>` + hipRoof34(tn.pts, 0, 1.8, tn.c, null, line, true) + tentDoor34(tn.pts);
  return s;
}

// Solid fence sides on the far edge of an exhibit stand over the path behind them, so they cover a guest's legs there (guests are drawn above the whole world).
// Each strip is {a, b, up}: a left to right along its base, up the map y it stands (a fence's height, or a barn shelter's body to its roof). See-through fences (wood, bars, glass, ...) and open canopies are left out.
let wall34 = [];
function wallStrips34(){
  const out = [];
  for(const e of state.exhibits){
    if(e.viv || e.open) continue;
    const P = e.points, kinds = e.grid ? sideKinds(e).map(b => BARRIERS[b].hedge ? "hedge" : b) : null, off = e.grid ? sideOffsets(e) : null;
    for(let i = 0; i < P.length; i++){
      if(norm34(P, i)[1] > .05) continue;
      const F = FENCE34[kinds ? kinds[i] : e.barrier || "wood"];
      if(!F || !(F.solid === 1 || F.hedge)) continue;
      let a = P[i], b = P[(i + 1) % P.length]; const o = off && off[i];
      if(o){ a = [a[0] + o[0], a[1] + o[1]]; b = [b[0] + o[0], b[1] + o[1]]; }
      if(a[0] > b[0]) [a, b] = [b, a];
      if(b[0] - a[0] > .01) out.push({a, b, x0:a[0], x1:b[0], up:F.h / TILT});
    }
    for(const f of landOf(e)){   // a barn, cave or burrow, from its front edge up to its far eave and a bit of the ridge
      const t = LAND[f.type];
      if(!t || !t.slots || f.k || t.look === "canopy") continue;
      const S = SHELTER_SPRITES[f.type];
      if(S){   // a pictured one covers what its picture covers: a barn its whole rectangle, a cave or burrow its dome
        const w = S.w * ROCK_MPP / 2, h = S.h * ROCK_MPP, yb = f.y + t.r * S.b;
        if(t.look === "cave" || t.look === "burrow") out.push({x0:f.x - w, x1:f.x + w, P:Array.from({length:13}, (_, i) => { const q = i * Math.PI / 12; return [f.x + w * Math.cos(q), yb - Math.min(h, h * 1.04 * Math.sin(q))]; }), up:0});
        else out.push({x0:f.x - w, x1:f.x + w, a:[f.x - w, yb], b:[f.x + w, yb], up:h});
        continue;
      }
      if(t.look === "cave" || t.look === "burrow"){   // the lumpy outline rock34 draws, swept up by the mound's height
        const r = t.look === "burrow" ? t.r * .8 : t.r, P = blobPts(f.x, f.y, r, seedOf(f), true);
        out.push({x0:Math.min(...P.map(q => q[0])), x1:Math.max(...P.map(q => q[0])), P, up:r * .85 / TILT});
        continue;
      }
      const h = t.r * .78;
      out.push({x0:f.x - h, x1:f.x + h, a:[f.x - h, f.y + h], b:[f.x + h, f.y + h], up:2 * h + (t.r * .5 + t.r * .45 * .5) / TILT});
    }
  }
  return out;
}
// How far up from a ground spot a far fence covers things standing there, as a y on the map (the fence's top edge), or null if nothing covers it
function wallCut34(x, y){
  let cut = null;
  for(const w of wall34){
    if(x < w.x0 || x > w.x1) continue;
    let yt, yb;
    if(w.P){   // a mound: its outline's highest and lowest y at this x
      yt = Infinity; yb = -Infinity;
      for(let i = 0, n = w.P.length; i < n; i++){
        const p = w.P[i], q = w.P[(i + 1) % n];
        if((p[0] <= x) === (q[0] <= x)) continue;
        const yy = p[1] + (q[1] - p[1]) * (x - p[0]) / (q[0] - p[0]);
        if(yy < yt) yt = yy;
        if(yy > yb) yb = yy;
      }
      if(yt === Infinity) continue;
      yt -= w.up;
    }
    else{ yb = w.a[1] + (w.b[1] - w.a[1]) * (x - w.a[0]) / (w.b[0] - w.a[0]); yt = yb - w.up; }
    if(y < yb && y > yt && (cut === null || yt < cut)) cut = yt;
  }
  return cut;
}

// Standing buildings hide the guests and staff walking behind them: each one's footprint swept up to its roof line.
// Vivarium tanks count too. Open canopies, decks and camps are left out, since people stand under or on them.
let occ34 = [];
function occluders34(){
  const out = [];
  for(const bl of state.buildings){
    const S = STAND34[bl.type];
    if(!S || S.canopy || S.front === "deck" || S.front === "camp" || BUILDINGS[bl.type].prop) continue;
    const P = bl.points, Q = P.map(lift34(S.wall + S.rise)), all = P.concat(Q);
    out.push({P, Q, x0:Math.min(...all.map(p => p[0])), x1:Math.max(...all.map(p => p[0])), y0:Math.min(...all.map(p => p[1])), y1:Math.max(...all.map(p => p[1]))});
  }
  // vivarium tanks too
  for(const e of state.exhibits){
    if(!e.viv) continue;
    const P = e.points, Q = P.map(lift34(VIVARIUMS[e.viv].d * .45)), all = P.concat(Q);
    out.push({P, Q, x0:Math.min(...all.map(p => p[0])), x1:Math.max(...all.map(p => p[0])), y0:Math.min(...all.map(p => p[1])), y1:Math.max(...all.map(p => p[1]))});
  }
  return out;
}
// is this ground spot behind (or inside) a standing building in the 3/4 view
function hidden34(x, y){
  for(const o of occ34){
    if(x < o.x0 || x > o.x1 || y < o.y0 || y > o.y1) continue;
    if(inPoly(x, y, o.P) || inPoly(x, y, o.Q)) return true;
    for(let i = 0, n = o.P.length; i < n; i++){ const j = (i+1) % n; if(inPoly(x, y, [o.P[i], o.P[j], o.Q[j], o.Q[i]])) return true; }
  }
  return false;
}

// Flat pixel style (the art direction: flat fills, a small palette, no outlines, shapes snapped to a pixel grid), tried first on the Genesis restroom.
// Light is from the left, so left-facing walls and roof faces are the lightest and right-facing the darkest; the front is the base tone.
const FLAT34 = {px:ROCK_MPP, wall:["#E6DECB", "#D9CFBB", "#BDB29B"], plinth:"#A39A86", eave:"#8E8778", door:"#2E3A33", doorEdge:"#46584E",
  roof:["#2F5C42", "#254A35", "#1B3526"], seam:"#14281C", ridge:"#10261A", gold:"#C9A24B", vent:"#6F6B61", ventHi:"#B3AEA1"};
const flatSnap34 = ([x, y]) => [Math.round(x / FLAT34.px + 1e-4) * FLAT34.px, Math.round(y * TILT / FLAT34.px + 1e-4) * FLAT34.px / TILT];   // a pixel is square on screen after the squash; the 1e-4 breaks exact half-pixel ties the same way every time, so no column is dropped or doubled
const flatPts34 = pts => pts.map(flatSnap34).map(p => p[0].toFixed(2) + "," + p[1].toFixed(2)).join(" ");
const flatPoly34 = (pts, fill, ln = "", decor = false) => `<polygon points="${flatPts34(pts)}" fill="${fill}" shape-rendering="crispEdges" ${ln}${decor ? ` pointer-events="none"` : ""}/>`;
const flatLine34 = (a, b, c, w) => `<path d="M${flatSnap34(a).map(v => v.toFixed(2)).join(" ")}L${flatSnap34(b).map(v => v.toFixed(2)).join(" ")}" stroke="${c}" stroke-width="${w}" fill="none" shape-rendering="crispEdges" pointer-events="none"/>`;
// a quad on the wall of footprint edge i, from f0 to f1 along it and h0 to h1 up
const flatQuad34 = (P, i, f0, f1, h0, h1, fill) => flatPoly34([onEdge34(P, i, f0, h0), onEdge34(P, i, f1, h0), onEdge34(P, i, f1, h1), onEdge34(P, i, f0, h1)], fill, "", true);
function flatWalls34(P, h1, ln){
  const front = [...Array(P.length).keys()].filter(i => norm34(P, i)[1] > .05); let s = "";
  for(const i of front){ const a = P[i], b = P[(i+1) % P.length], nx = norm34(P, i)[0];
    s += flatPoly34([lift34(0)(a), lift34(0)(b), lift34(h1)(b), lift34(h1)(a)], FLAT34.wall[nx < -.3 ? 0 : nx > .3 ? 2 : 1], ln);
    s += flatQuad34(P, i, 0, 1, 0, .5, FLAT34.plinth) + flatQuad34(P, i, 0, 1, h1 - .24, h1, FLAT34.eave); }   // a plinth, and the shade under the eave
  return {s, main:front.reduce((m, i) => m < 0 || edgeLen34(P, i) > edgeLen34(P, m) ? i : m, -1)};
}
// letters painted on a wall, one wall pixel at a time (a tiny 5 row font)
const FLAT_FONT34 = {R:["##.", "#.#", "##.", "#.#", "#.#"], E:["###", "#..", "##.", "#..", "###"], S:["###", "#..", "###", "..#", "###"], T:["###", ".#.", ".#.", ".#.", ".#."],
  O:["###", "#.#", "#.#", "#.#", "###"], V:["#.#", "#.#", "#.#", "#.#", ".#."], I:["###", ".#.", ".#.", ".#.", "###"], W:["#...#", "#...#", "#.#.#", "##.##", "#...#"], M:["#...#", "##.##", "#.#.#", "#...#", "#...#"],
  L:["#..", "#..", "#..", "#..", "###"], N:["#.#", "###", "###", "#.#", "#.#"], A:[".#.", "#.#", "###", "#.#", "#.#"], C:["###", "#..", "#..", "#..", "###"]};
// door pictograms, 5 wide and 8 tall: a man and a woman
const FLAT_ICON34 = {man:[".XXX.", ".XXX.", "XXXXX", "XXXXX", ".XXX.", ".X.X.", ".X.X.", ".X.X."], woman:["..X..", ".XXX.", "..X..", ".XXX.", "XXXXX", "XXXXX", ".X.X.", ".X.X."]};
function flatText34(Q, L, f, h, str, fill){
  const px = FLAT34.px / L, cols = [...str].reduce((n, ch) => n + FLAT_FONT34[ch][0].length + 1, -1); let c0 = f - cols * px / 2, s = "";
  for(const ch of str){ const g = FLAT_FONT34[ch]; g.forEach((row, r) => [...row].forEach((v, c) => { if(v === "#") s += Q(c0 + c * px, c0 + (c + 1) * px, h + (4 - r) * FLAT34.px, h + (5 - r) * FLAT34.px, fill); })); c0 += (g[0].length + 1) * px; }
  return s;
}
function flatWc34(P, i, S, col){
  const L = edgeLen34(P, i), dw = Math.min(1.1, L * .12) / L, e = FLAT34.px / L, fl = P[(i+1) % P.length][0] < P[i][0]; let s = "";   // fl: the edge runs right to left on screen, so mirror along it
  const Q = (f0, f1, h0, h1, fill) => flatQuad34(P, i, fl ? 1 - f0 : f0, fl ? 1 - f1 : f1, h0, h1, fill);
  s += Q(.05, .95, S.wall - 1.2, S.wall - .3, col) + flatText34(Q, L, .5, S.wall - 1.1, "RESTROOMS", FLAT34.wall[0]);   // the type-colored band with the name on it
  for(const [f, right, icon] of [[.3, true, "man"], [.7, false, "woman"]]){   // two doors with a lit left edge, a pictogram, and a gold handle on the inner side
    const fh = right ? f + dw / 2 - 2.5 * e : f - dw / 2 + 1.5 * e;
    s += Q(f - dw / 2, f + dw / 2, 0, 2.1, FLAT34.door) + Q(f - dw / 2, f - dw / 2 + e, 0, 2.1, FLAT34.doorEdge) + Q(fh, fh + e, .45, .85, FLAT34.gold);
    FLAT_ICON34[icon].forEach((row, r) => [...row].forEach((v, c) => { if(v === "X") s += Q(f + (c - 2.5) * e, f + (c - 1.5) * e, 1.0 + (7 - r) * FLAT34.px, 1.0 + (8 - r) * FLAT34.px, FLAT34.wall[0]); })); }
  s += Q(.5 - 1.6 * e, .5 + 1.6 * e, 1.25, 2.05, FLAT34.door);   // a louvred vent between them
  for(const h of [1.45, 1.7, 1.95]) s += Q(.5 - 1.6 * e, .5 + 1.6 * e, h, h + FLAT34.px * .9, FLAT34.wall[1]);
  return s;
}
function flatRoof34(P, wall, rise, ln){
  const [cx, cy] = centroid(P), eave = P.map(lift34(wall)), n = P.length, e0 = edgeLen34(P, 0), e1 = edgeLen34(P, 1);
  const a0 = [(P[1][0] - P[0][0])/e0, (P[1][1] - P[0][1])/e0], a1 = [(P[2][0] - P[1][0])/e1, (P[2][1] - P[1][1])/e1];
  const [ux, uy] = e0 >= e1 ? a0 : a1, half = Math.max(.4, (Math.max(e0, e1) - Math.min(e0, e1)) / 2), up = lift34(wall + rise);
  const ridge = [up([cx - ux*half, cy - uy*half]), up([cx + ux*half, cy + uy*half])], near = p => (p[0] - cx)*ux + (p[1] - cy)*uy < 0 ? ridge[0] : ridge[1];
  const faces = [...Array(n).keys()].map(i => { const a = eave[i], b = eave[(i+1) % n], ra = near(P[i]), rb = near(P[(i+1) % n]);
    return {i, a, b, ra, rb, pts:ra === rb ? [a, b, ra] : [a, b, rb, ra], y:(P[i][1] + P[(i+1) % n][1]) / 2}; }).sort((f, g) => f.y - g.y);
  const lerp = (p, q, t) => [p[0] + (q[0] - p[0])*t, p[1] + (q[1] - p[1])*t]; let s = "";
  for(const f of faces){ const nx = norm34(P, f.i)[0], tone = FLAT34.roof[nx < -.3 ? 0 : nx > .3 ? 2 : 1];
    s += flatPoly34(f.pts, tone, ln);
    const len = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]), k = Math.max(2, Math.round(len / .75));   // standing seams, eave to ridge
    for(let j = 1; j < k; j++){ const t = j / k; s += flatLine34(lerp(f.a, f.b, t), lerp(f.ra, f.rb, t), FLAT34.seam, FLAT34.px); }
    if(norm34(P, f.i)[1] > .05) s += flatLine34(f.a, f.b, FLAT34.gold, FLAT34.px); }   // a thin gold line along the front eave
  s += flatLine34(ridge[0], ridge[1], FLAT34.ridge, FLAT34.px * 3) + flatLine34(ridge[0], ridge[1], FLAT34.gold, FLAT34.px);   // a dark ridge cap with a gold line on it
  const [vx, vy] = lerp(ridge[0], ridge[1], .32), vh = .95 / TILT;   // a plumbing vent on the ridge
  return s + flatPoly34([[vx - FLAT34.px, vy], [vx + FLAT34.px, vy], [vx + FLAT34.px, vy - vh], [vx - FLAT34.px, vy - vh]], FLAT34.vent, "", true) + flatPoly34([[vx - FLAT34.px * 2, vy - vh], [vx + FLAT34.px * 2, vy - vh], [vx + FLAT34.px * 2, vy - vh - FLAT34.px / TILT], [vx - FLAT34.px * 2, vy - vh - FLAT34.px / TILT]], FLAT34.ventHi, "", true);
}
// The park entrance: two ticket pillars under a lintel with the name on it, the path running through. Front-facing like the other flat buildings; the flat view gets a top-down version.
const ENTRANCE = {half:7, gap:4.6, depth:1.1, pillar:5, beam:3.3};   // meters: half the width, half the opening, half the depth, pillar height, where the lintel starts
function entrance34(inv){
  const [gx, gy] = state.gate, E = ENTRANCE, hit = `<g data-kind="entrance" data-id="gate" style="cursor:pointer">`;
  const W = FLAT34.wall, R = FLAT34.roof, up = h => lift34(h);
  const rect = (x0, x1, y0, y1, h) => [[gx + x0, gy + y0], [gx + x1, gy + y0], [gx + x1, gy + y1], [gx + x0, gy + y1]].map(up(h));   // a horizontal slab at height h
  const face = (x0, x1, h0, h1, y, fill) => flatPoly34([[gx + x0, gy + y], [gx + x1, gy + y], [gx + x1, gy + y], [gx + x0, gy + y]].map((p, i) => up(i < 2 ? h0 : h1)(p)), fill, "", true);
  if(!tilt){   // top-down: two green capped pillars and the lintel across, no side faces
    let f = `<rect x="${gx - E.half - 1}" y="${gy - E.depth - 1}" width="${2 * E.half + 2}" height="${2 * E.depth + 2}" fill="transparent"/>`;
    for(const [x0, x1] of [[-E.half, -E.gap], [E.gap, E.half]]) f += flatPoly34(rect(x0, x1, -E.depth, E.depth, 0), R[1], "", true) + flatPoly34(rect(x0 + .26, x1 - .26, -E.depth + .26, E.depth - .26, 0), R[0], "", true);
    f += flatPoly34(rect(-E.half, E.half, -E.depth * .45, E.depth * .45, 0), R[1], "", true) + flatPoly34(rect(-E.half, E.half, -.13, .13, 0), FLAT34.gold, "", true);
    return hit + f + `<text class="lbl" x="${gx}" y="${gy + E.depth + 9*inv}" font-size="${12*inv}" stroke-width="${3*inv}" pointer-events="none">Entrance</text></g>`;
  }
  let s = hit + `<rect x="${gx - E.half - 1}" y="${gy - E.depth - (E.pillar + 3) / TILT}" width="${2 * E.half + 2}" height="${2 * E.depth + (E.pillar + 3) / TILT + 1}" fill="transparent"/>`;
  s += flatPoly34(rect(-E.half - .7, E.half + .7, -E.depth + .4, E.depth + .8, 0), "#1D2B22", "", true).replace('fill="#1D2B22"', 'fill="#1D2B22" fill-opacity=".22"');   // the shadow the whole thing throws
  s += flatPoly34(rect(-E.gap, E.gap, -E.depth, E.depth, 0), "#1D2B22", "", true).replace('fill="#1D2B22"', 'fill="#1D2B22" fill-opacity=".3"');   // and the darker shade under the lintel
  const px = FLAT34.px;
  for(const [x0, x1, sgn] of [[-E.half, -E.gap, 1], [E.gap, E.half, -1]]){   // a pillar: plinth, front, lit and shaded edge columns, a gold band, a ticket window, a green cap
    const mid = (x0 + x1) / 2, ww = 1.5;
    s += face(x0, x1, 0, E.pillar, E.depth, W[1]) + face(x0, x0 + .26, 0, E.pillar, E.depth, W[0]) + face(x1 - .26, x1, 0, E.pillar, E.depth, W[2]);
    s += face(x0, x1, 0, .5, E.depth, FLAT34.plinth) + face(x0, x1, .9, .9 + px * 2, E.depth, FLAT34.gold);
    s += face(mid - ww / 2, mid + ww / 2, 1.4, 3, E.depth, FLAT34.door) + face(mid - ww / 2, mid - ww / 2 + px, 1.4, 3, E.depth, FLAT34.doorEdge) + face(mid - ww / 2 - .2, mid + ww / 2 + .2, 1.3, 1.3 + px * 2, E.depth, FLAT34.eave);
    s += face(x0 - .3, x1 + .3, E.pillar - .3, E.pillar, E.depth + .3, FLAT34.eave) + flatPoly34(rect(x0 - .3, x1 + .3, -E.depth - .3, E.depth + .3, E.pillar), R[1], "", true);   // the cap's shade, then its roof
    s += flatPoly34(rect(x0 - .3, x1 + .3 - (x1 - x0 + .6) * .5, -E.depth - .3, E.depth + .3, E.pillar), R[0], "", true) + flatPoly34(rect(mid - px, mid + px, -E.depth + .5, E.depth - .5, E.pillar + px), FLAT34.gold, "", true);
  }
  // the lintel across the top of the opening: shade under it, the front in the type color with the name, a green slab on top
  s += face(-E.gap, E.gap, E.beam - .3, E.beam, E.depth, "#14281C") + face(-E.half, E.half, E.beam, E.pillar, E.depth, W[1]);
  s += face(-E.half + .3, E.half - .3, E.beam + .25, E.pillar - .25, E.depth, R[1]) + face(-E.half + .3, E.half - .3, E.pillar - .25 - px, E.pillar - .25, E.depth, FLAT34.gold);
  const Q = (f0, f1, h0, h1, fill) => face(f0, f1, h0, h1, E.depth, fill);
  s += flatText34((f0, f1, h0, h1, fill) => Q(f0, f1, E.beam + .3 + (h0 - 0), E.beam + .3 + (h1 - 0), fill), 1, 0, 0, "ENTRANCE", W[0]);
  s += flatPoly34(rect(-E.half - .3, E.half + .3, -E.depth - .3, E.depth + .3, E.pillar + .3), R[1], "", true) + flatPoly34(rect(-E.half - .3, 0, -E.depth - .3, E.depth + .3, E.pillar + .3), R[0], "", true);
  s += face(-E.half - .3, E.half + .3, E.pillar, E.pillar + .3, E.depth + .3, FLAT34.eave) + flatLine34(up(E.pillar + .3)([gx - E.half - .3, gy + E.depth + .3]), up(E.pillar + .3)([gx + E.half + .3, gy + E.depth + .3]), FLAT34.gold, px);
  return s + `</g>`;
}
// A door on a wall the camera can't see. North: the name plaque stands on the roof's far edge with a door tab hanging under it. East or west: the wall is edge-on, so the door is a column on that edge, and the name goes on the front wall's top band (m, the widest visible wall).
function faceMark34(P, i, wall, m, text){
  const L = edgeLen34(P, i), [nx, ny] = norm34(P, i), px = FLAT34.px, F = FLAT34, name = (Q, h) => `<text class="glyph" x="${Q[0].toFixed(2)}" y="${Q[1].toFixed(2)}" font-size="${h}" style="fill:#2E3A33;stroke:none" pointer-events="none">${text}</text>`;
  let s = "";
  if(ny < -.05){
    const dw = Math.min(.75, L * .1) / L, e = px / L;
    s += flatQuad34(P, i, .18, .82, wall + .05, wall + 1.15, F.wall[0]) + flatQuad34(P, i, .18, .82, wall + .05, wall + .05 + px, F.wall[2]) + name(onEdge34(P, i, .5, wall + .45), Math.min(.5, L * .05).toFixed(2));
    s += flatQuad34(P, i, .5 - dw, .5 + dw, wall - 1.5, wall, F.door) + flatQuad34(P, i, .5 - dw, .5 - dw + e, wall - 1.5, wall, F.doorEdge) + flatQuad34(P, i, .5 + dw - 2 * e, .5 + dw - e, wall - .9, wall - .9 + px, F.gold);
  } else {
    const sx = nx > 0 ? 1 : -1, [mx, my] = [(P[i][0] + P[(i + 1) % P.length][0]) / 2, (P[i][1] + P[(i + 1) % P.length][1]) / 2], up = h => lift34(h), x1 = mx + sx * px * 5;
    s += flatPoly34([up(0)([mx, my]), up(0)([x1, my]), up(2.1)([x1, my]), up(2.1)([mx, my])], F.door, "", true) + flatPoly34([up(0)([mx, my]), up(0)([mx + sx * px, my]), up(2.1)([mx + sx * px, my]), up(2.1)([mx, my])], F.doorEdge, "", true);
    s += flatPoly34([up(.55)([x1 - sx * px, my]), up(.55)([x1, my]), up(.55 + px)([x1, my]), up(.55 + px)([x1 - sx * px, my])], F.gold, "", true);
    if(m >= 0) s += flatQuad34(P, m, .15, .85, wall - 1.05, wall - .15, F.wall[0]) + name(onEdge34(P, m, .5, wall - .75), Math.min(.5, edgeLen34(P, m) * .05).toFixed(2));
  }
  return s;
}
// Genesis buildings drawn as one picture per view (sprites/bld/<name>-<front|back|left|right>.png at ROCK_MPP), picked by where the door looks: down the screen front, up back, left or right the side with the door at that end. w x h is the picture in px, base the row under its base slab (the shadow rows below it hang past the footprint's front edge; sideBase for the left and right pictures, when it differs). A pixel is square on screen after the squash. views lists the pictures drawn so far when some are missing; the rest fall back to the front. frames: an animation, <name>-<view>-2.png etc., cycling at 3 a second, one shown at a time.
// Restroom: the front and back walls are 61 px (the 8 m door wall), the side pictures' 46 px (the turned 6 m front), the roof overhangs. Food and gift carts: the vendor shifting behind the counter; its side pictures sit two rows lower in the frame (sideBase), the right one the left mirrored.
// card: the pictures are flat, with no roof depth drawn. backOver: meters of the box's back (north) side that may lie over a path (pathSolid, pathcells.js), so a cart can back a little onto one; the back view is drawn that much higher in its box to meet it, and facing north the cart snaps its base line to the grid, not its door wall (doorOnGrid). hit: the picture's opaque box per view [x0, y0, x1, y1] in px, tappable on top of the footprint.
const BLD_PICS = {restroom:{w:80, h:80, base:71}, kiosk:{w:40, h:40, base:36, sideBase:38, frames:2, card:true, backOver:.6,
  hit:{front:[2, 1, 37, 36], back:[2, 1, 37, 36], left:[6, 0, 33, 38], right:[7, 0, 34, 38]}}};
BLD_PICS.cart = BLD_PICS.kiosk;   // the gift cart is the food cart in pink with a GIFT sign
function bldSprite34(bl, P, on, dead, reach, line){
  const B = BLD_PICS[bl.type], px = FLAT34.px, [cx] = centroid(P);
  const [nx, ny] = norm34(P, faceEdge(P, bl.face === undefined ? 2 : bl.face)), v = Math.abs(ny) >= Math.abs(nx) ? (ny < 0 ? "back" : "front") : nx < 0 ? "left" : "right", view = !B.views || B.views.includes(v) ? v : "front";
  const by = Math.max(...P.map(p => p[1])) - (view === "back" && B.backOver || 0), base = view === "left" || view === "right" ? B.sideBase || B.base : B.base, [x, y] = flatSnap34([cx - B.w / 2 * px, by - base * px / TILT]);
  const img = (f, a) => `<image href="${spriteUrl(`sprites/bld/${bl.type}-${view}${f > 1 ? "-" + f : ""}.png`)}" x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${(B.w * px).toFixed(2)}" height="${(B.h * px / TILT).toFixed(2)}" preserveAspectRatio="none" style="image-rendering:pixelated${a}" pointer-events="none"/>`;
  const n = B.frames || 1, dur = n / 3, ph = (performance.now() / 1000 + [...String(bl.id)].reduce((a, c) => a + c.charCodeAt(0), 0) / 3) % dur;   // one frame shown at a time (the pictures have see-through bits, so stacking them ghosts), kept in step across redraws, each building a beat apart
  const h = B.hit && B.hit[view];
  let s = `<polygon points="${polyStr(P)}" fill="transparent" ${on || dead || !reach ? line : ""}/>` + (h ? `<rect x="${(x + h[0] * px).toFixed(2)}" y="${(y + h[1] * px / TILT).toFixed(2)}" width="${((h[2] - h[0]) * px).toFixed(2)}" height="${((h[3] - h[1]) * px / TILT).toFixed(2)}" fill="transparent"/>` : "");
  for(let f = 1; f <= n; f++) s += img(f, n < 2 ? "" : `;visibility:${f > 1 ? "hidden" : "visible"};animation:frame${f}of${n} ${dur.toFixed(3)}s step-end infinite;animation-delay:-${ph.toFixed(3)}s`);
  return s;
}
function building34(bl, t, on, dead, reach, inv){
  const S = STAND34[bl.type], P = bl.points, col = themeFill(bl, t.color), T = themeOf(bl), H = roofOf(T, bl), tex = H >= 0 ? pickFor(bl, T.roofs.btex[H]) : bldTex(T);
  const edge = dead ? "var(--bad)" : on ? "var(--sel)" : reach ? T.edge : "var(--bad)";
  const line = `stroke="${edge}" stroke-width="${on || dead ? 3.5 : 1.2}" ${reach ? "" : `stroke-dasharray="4 3"`} stroke-linejoin="round" vector-effect="non-scaling-stroke"`;
  const top = S.canopy || S.wall + S.rise, sh = top * .22;
  let s = `<polygon points="${polyStr(P.map(([x, y]) => [x + sh, y + sh*.8]))}" fill="#1D2B22" fill-opacity=".22" pointer-events="none"/><polygon points="${polyStr(P)}" fill="#8E8778"/>`;
  if(BLD_PICS[bl.type] && T === THEMES.genesis) return bldSprite34(bl, P, on, dead, reach, line);   // the front, back or side picture by facing
  if(S.front === "cart"){
    // a cart: a colored counter under a striped canopy on four poles, on two wheels
    const w = walls34(P, 0, S.wall, col, line), i = w.main, C = insetRect(P, 1.12).map(lift34(S.canopy));
    s += w.s + `<polygon points="${polyStr(P.map(lift34(S.wall)))}" fill="${AWNING34}" ${line}/>`;
    s += P.map((p, j) => { const a = lift34(S.wall)(p), b = C[j]; return `<path d="M${a[0].toFixed(2)} ${a[1].toFixed(2)}L${b[0].toFixed(2)} ${b[1].toFixed(2)}" stroke="#3A3A34" stroke-width="1.5" vector-effect="non-scaling-stroke" pointer-events="none"/>`; }).join("");
    if(i >= 0) for(const f of [.22, .78]){ const [x, y] = onEdge34(P, i, f, .1); s += `<ellipse cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" rx=".42" ry="${(.42 / TILT).toFixed(2)}" fill="${DARK34}" pointer-events="none"/>`; }
    return s + stripes34(C, 7, col, AWNING34, line);
  }
  if(S.front === "tram"){
    // a raised platform under a flat canopy on posts, the name hung under the front edge; a worn out one goes dark red with a cross
    const down = !tramWorking(bl), roof = down ? "#6E2A26" : col, w = walls34(P, 0, S.wall, "#B8B1A2", line), C = insetRect(P, 1.06).map(lift34(S.canopy)), i = w.main;
    s += w.s + `<polygon points="${polyStr(P.map(lift34(S.wall)))}" fill="#CFC8B8" ${line}/>`;
    s += P.map((p, j) => { const a = lift34(S.wall)(p), b = C[j]; return `<path d="M${a[0].toFixed(2)} ${a[1].toFixed(2)}L${b[0].toFixed(2)} ${b[1].toFixed(2)}" stroke="#3A3A34" stroke-width="2" vector-effect="non-scaling-stroke" pointer-events="none"/>`; }).join("");
    s += `<polygon points="${polyStr(C)}" fill="${roof}" ${line}/>` + shade34(C, .35);
    if(i >= 0) s += quad34(P, i, .3, .7, S.canopy - .7, S.canopy - .1, "#F1E6C8") + sign34(P, i, S.canopy - .4, "TRAM", .45).replace('class="glyph"', 'class="glyph" style="fill:#3A2A1A;stroke:none"');
    if(down){ const [x, y] = centroid(C), r = Math.min(t.w, t.d) * .3; s += `<path d="M${x - r} ${y - r}L${x + r} ${y + r}M${x + r} ${y - r}L${x - r} ${y + r}" stroke="#fff" stroke-width="1.5" vector-effect="non-scaling-stroke" pointer-events="none"/>`; }
    return s;
  }
  if(S.front === "deck") return deckArt(bl, inv, on, dead, reach);   // flat pixel style, propart.js
  if(S.front === "camp") return s.replace(/fill="#8E8778"/, `fill="#C9B98E"`) + camp34(bl, P, col, line);
  if(S.front === "lab" || S.front === "resort") return s + block34(bl, t, S, P, col, line, inv);
  const flat = S.front === "wc" && T === THEMES.genesis, ln = on || dead || !reach ? line : "";   // the flat pixel style, for now just the Genesis restroom
  const w = flat ? flatWalls34(P, S.wall, ln) : walls34(P, 0, S.wall, S.wallCol || WALL34, line), fe = faceEdge(P, bl.face === undefined ? 2 : bl.face), i = norm34(P, fe)[1] > .05 ? fe : -1;   // the door wall, unless the camera can't see it
  s += w.s;
  if(i >= 0){
    const L = edgeLen34(P, i);
    if(flat) s += flatWc34(P, i, S, col);
    else if(S.front === "wc"){
      const dw = Math.min(1.1, L*.12) / L;
      for(const f of [.3, .7]) s += quad34(P, i, f - dw/2, f + dw/2, 0, 2.1, DARK34);
      s += quad34(P, i, .05, .95, S.wall - .45, S.wall - .15, col);
      const [x, y] = onEdge34(P, i, .5, 1.6); s += `<text class="glyph" x="${x.toFixed(2)}" y="${y.toFixed(2)}" font-size="${Math.min(1.3, L*.15).toFixed(2)}" style="fill:#2E3A33;stroke:none" pointer-events="none">WC</text>`;
    } else if(S.front === "window"){
      // a serving window with a counter, under a striped awning
      s += quad34(P, i, .18, .82, 1, 2.2, DARK34) + quad34(P, i, .16, .84, .92, 1.05, "#B9AE97");
      const aw = [onEdge34(P, i, .14, 2.6), onEdge34(P, i, .86, 2.6), onEdge34(P, i, .86, 2.05, 1.2), onEdge34(P, i, .14, 2.05, 1.2)];
      s += stripes34(aw, 9, col, AWNING34, `stroke="#1D2B22" stroke-opacity=".4" stroke-width="1" vector-effect="non-scaling-stroke"`);
      s += quad34(P, i, .1, .9, S.wall - .05, S.wall - .55, col) + sign34(P, i, S.wall - .3, S.sign, .5);
    } else if(S.front === "plain"){
      // a door between two windows, and the name on the band above
      s += quad34(P, i, .5 - .55/L, .5 + .55/L, 0, 2.1, DARK34);
      for(const f of [.2, .8]) s += quad34(P, i, f - .6/L, f + .6/L, 1.1, 2.1, "#3B5566");
      s += quad34(P, i, .06, .94, S.wall - .55, S.wall - .1, col) + sign34(P, i, S.wall - .32, esc(t.tag || t.label), .38);
    } else if(S.front === "barn"){
      // big double doors with white cross braces and a sign board over them
      const dw = Math.min(2.4, L * .15) / L, b = `stroke="#F1E6C8" stroke-width="1.5" vector-effect="non-scaling-stroke" pointer-events="none"`, pt = (f, h) => onEdge34(P, i, f, h).map(v => v.toFixed(2)).join(" ");
      s += quad34(P, i, .5 - dw, .5 + dw, 0, 3.2, "#5A2A20");
      s += `<path d="M${pt(.5 - dw, 0)}L${pt(.5, 3.2)}M${pt(.5, 0)}L${pt(.5 - dw, 3.2)}M${pt(.5, 0)}L${pt(.5 + dw, 3.2)}M${pt(.5 + dw, 0)}L${pt(.5, 3.2)}M${pt(.5, 0)}L${pt(.5, 3.2)}" fill="none" ${b}/>`;
      s += quad34(P, i, .5 - dw, .5 + dw, 0, 3.2, "none", b);
      s += quad34(P, i, .5 - dw*.9, .5 + dw*.9, 3.35, 3.9, "#F1E6C8") + `<text class="glyph" x="${onEdge34(P, i, .5, 3.62)[0].toFixed(2)}" y="${onEdge34(P, i, .5, 3.62)[1].toFixed(2)}" font-size=".42" style="fill:#5A2A20;stroke:none" pointer-events="none">${esc(t.tag || t.label)}</text>`;
    } else if(S.front === "lodge"){
      // shuttered windows, a wide door, and a verandah on posts under a lean-to roof
      for(const f of [.18, .34, .66, .82]){ const dw = .9 / L; s += quad34(P, i, f - dw, f + dw, 1, 2.3, "#2B2418") + quad34(P, i, f - dw*1.9, f - dw, 1, 2.3, col) + quad34(P, i, f + dw, f + dw*1.9, 1, 2.3, col); }
      s += quad34(P, i, .5 - 1.2/L, .5 + 1.2/L, 0, 2.5, "#2B2418");
      for(const f of [.04, .27, .5, .73, .96]){ const a = onEdge34(P, i, f, 0, 2.2), b = onEdge34(P, i, f, 2.7, 2.2); s += `<path d="M${a[0].toFixed(2)} ${a[1].toFixed(2)}L${b[0].toFixed(2)} ${b[1].toFixed(2)}" stroke="#5A4128" stroke-width="2" vector-effect="non-scaling-stroke" pointer-events="none"/>`; }
      const v = [onEdge34(P, i, 0, 3.3), onEdge34(P, i, 1, 3.3), onEdge34(P, i, 1, 2.7, 2.4), onEdge34(P, i, 0, 2.7, 2.4)];
      s += `<polygon points="${polyStr(v)}" fill="${S.roofCol || col}" ${line}/>` + shade34(v, .3);
    } else if(S.front === "glass"){
      // a glazed front with mullions and a double door, and the name on the fascia
      s += quad34(P, i, .06, .94, .5, 3, "#3B5566");
      const n = Math.max(3, Math.round(L / 2.6));
      for(let k = 1; k < n; k++){ const a = onEdge34(P, i, .06 + .88*k/n, .5), b = onEdge34(P, i, .06 + .88*k/n, 3); s += `<path d="M${a[0].toFixed(2)} ${a[1].toFixed(2)}L${b[0].toFixed(2)} ${b[1].toFixed(2)}" stroke="${WALL34}" stroke-width="1.2" vector-effect="non-scaling-stroke" pointer-events="none"/>`; }
      s += quad34(P, i, .06, .5, 2.2, 3, "#fff", `fill-opacity=".12"`);
      const dw = 2.2 / L; s += quad34(P, i, .5 - dw/2, .5 + dw/2, 0, 2.5, DARK34);
      s += quad34(P, i, .04, .96, S.wall - .1, S.wall - .9, col) + sign34(P, i, S.wall - .5, S.sign, .7);
    }
  }
  { const gi = i >= 0 ? i : w.main; if(gi >= 0 && (bl.graffiti || 0) >= VANDAL.grossAt){ const [x0, y0] = onEdge34(P, gi, .3, 1.1), [x1] = onEdge34(P, gi, .7, 1.1), g = (x1 - x0)/4;
      s += `<path d="M${x0} ${y0}q${g/2} ${-g*.8} ${g} 0t${g} 0t${g} 0t${g} 0" fill="none" stroke="#C04BD8" stroke-width="${Math.max(.6, 2.2*inv)}" stroke-linecap="round" pointer-events="none"/>`; } }
  const mark = i < 0 ? faceMark34(P, fe, S.wall, w.main, esc(S.sign || t.tag || t.label)) : "";   // the door is on a wall we can't see: the plaque and door tab go over the roof edge
  if(flat) return s + flatRoof34(P, S.wall, S.rise, ln) + mark;
  return s + (S.roofCol ? hipRoof34(P, S.wall, S.rise, S.roofCol, null, line, S.gable, S.gable === "ns" && (S.wallCol || WALL34)) : hipRoof34(P, S.wall, S.rise, col, tex, line, S.gable, S.gable === "ns" && (S.wallCol || WALL34))) + mark;
}

function insetRect(pts, f){ const [cx, cy] = centroid(pts); return pts.map(([x, y]) => [cx + (x - cx)*f, cy + (y - cy)*f]); }

function parcelOverlay(){
  const inv = 1/view.k; let s = "";
  for(const [i, j] of SALE_CELLS){
    if(ownsParcel(i, j)) continue;
    const [x0, y0, x1, y1] = parcelRect(i, j), open = parcelTouches(i, j), on = parcelSel && parcelSel[0] === i && parcelSel[1] === j;
    s += `<rect x="${x0}" y="${y0}" width="${x1-x0}" height="${y1-y0}" fill="${on ? "var(--sel)" : open ? "var(--good)" : "var(--ink)"}" fill-opacity="${on ? .3 : open ? .16 : .1}" stroke="${on ? "var(--sel)" : "var(--boundary)"}" stroke-width="${on ? 3 : 1}" stroke-dasharray="${open ? "none" : "6 4"}" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
    const fs = Math.min(15*inv, (x1-x0)/7), cx = (x0+x1)/2, cy = (y0+y1)/2;
    s += `<text x="${cx}" y="${cy - (open ? fs*.2 : 0)}" font-size="${fs}" text-anchor="middle" font-weight="700" fill="var(--ink)" pointer-events="none">${open ? money(parcelPrice(i, j)) : "Locked"}</text>`;
    if(open) s += `<text x="${cx}" y="${cy + fs*1.1}" font-size="${fs*.75}" text-anchor="middle" fill="var(--ink)" opacity=".75" pointer-events="none">${fmtArea(parcelArea(i, j))}</text>`;
  }
  return s;
}
// The construction ghost of fence being laid (or lifted): in 3/4 a translucent wall as tall as the fence will stand, with a post line at every piece; flat, a wide band. Green when it can go down, red when it can't.
function fenceGhostSvg(keys, kind, bad, inv, shift){
  if(!keys.length) return "";
  const c = bad ? "#E5484D" : "#4CD964", n2 = v => v.toFixed(2), H = (FENCE34[kind] || FENCE34.wood).h;
  const dash = `stroke-dasharray="${5*inv} ${3*inv}"`, ln = `stroke="${c}" stroke-width="1.4" ${dash} vector-effect="non-scaling-stroke"`;
  let s = `<g pointer-events="none" stroke-linejoin="round">`;
  for(const k of keys){
    let [a, b] = pieceEnds(k); const sh = shift && shift[k]; if(sh){ a = [a[0] + sh[0], a[1] + sh[1]]; b = [b[0] + sh[0], b[1] + sh[1]]; }
    if(tilt){
      const ta = lift34(H)(a), tb = lift34(H)(b);
      s += `<polygon points="${polyStr([a, b, tb, ta])}" fill="${c}" fill-opacity=".3" ${ln}/>`;
      s += `<line x1="${n2(a[0])}" y1="${n2(a[1])}" x2="${n2(ta[0])}" y2="${n2(ta[1])}" stroke="${c}" stroke-width="1.4" vector-effect="non-scaling-stroke"/>`;
    } else s += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${c}" stroke-opacity=".35" stroke-width="${Math.max(10, 1.2 * view.k)}" stroke-linecap="butt" vector-effect="non-scaling-stroke"/>`;
  }
  let last = pieceEnds(keys[keys.length - 1])[1]; const shl = shift && shift[keys[keys.length - 1]]; if(shl) last = [last[0] + shl[0], last[1] + shl[1]];
  if(tilt){ const tl = lift34(H)(last); s += `<line x1="${n2(last[0])}" y1="${n2(last[1])}" x2="${n2(tl[0])}" y2="${n2(tl[1])}" stroke="${c}" stroke-width="1.4" vector-effect="non-scaling-stroke"/>`; }
  return s + `</g>`;
}
// An arrow out of a building's door wall, for the ghost and the Move selection
function doorArrowSvg(pts, face, col, inv){
  const i = faceEdge(pts, face), a = pts[i], c = pts[(i + 1) % pts.length], L = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1, [cx, cy] = centroid(pts);
  let nx = (c[1] - a[1]) / L, ny = -(c[0] - a[0]) / L; const mx = (a[0] + c[0]) / 2, my = (a[1] + c[1]) / 2;
  if(nx * (mx - cx) + ny * (my - cy) < 0){ nx = -nx; ny = -ny; }
  const len = Math.min(2.2, Math.max(1.2, L * .25)), hx = mx + nx * len, hy = my + ny * len, w = Math.max(.35, 5 * inv);
  return `<path d="M${mx.toFixed(2)} ${my.toFixed(2)}L${hx.toFixed(2)} ${hy.toFixed(2)}M${(hx - nx * w + ny * w).toFixed(2)} ${(hy - ny * w - nx * w).toFixed(2)}L${hx.toFixed(2)} ${hy.toFixed(2)}L${(hx - nx * w - ny * w).toFixed(2)} ${(hy - ny * w + nx * w).toFixed(2)}" fill="none" stroke="${col}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
}
function renderOverlay(){
  const inv = 1/view.k;
  let s = tool === "parcels" ? parcelOverlay() : "";
  if(draw){
    const poly = isPoly(draw.kind);
    let all = draw.hover ? draw.pts.concat([draw.hover]) : draw.pts;
    const err = draw.error;
    const col = err ? "var(--bad)" : "var(--sel)";
    if(poly && all.length >= 3) s += `<polygon points="${polyStr(all)}" fill="${col}" fill-opacity=".18" stroke="none"/>`;
    // the band is as wide as the path will be (same width and end caps as a built one)
    if(!poly && all.length >= 2){ const ty = drawType(), pw = Math.max(2*halfWidth({type:ty}), (ty === "service" ? 2.5 : 3)*inv); s += `<polyline points="${polyStr(all)}" stroke="${col}" stroke-opacity=".35" stroke-width="${pw}" stroke-linecap="${ty === "wide" ? "butt" : "round"}" stroke-linejoin="round" fill="none"/>`; }
    // a preview in the theme the thing will be built in (zone or brush)
    const pk = all.length >= 2 && !err && (draw.kind === "path" || draw.kind === "wide") ? themeFor("path", {points:all, type:drawType()}) : null;
    if(pk){
      const pt = {theme:pk}, T = THEMES[pk];
      { const ty = drawType(), pw = Math.max(2*halfWidth({type:ty}), 3*inv), pl = polyStr(all), lj = `stroke-linecap="${ty === "wide" ? "butt" : "round"}" stroke-linejoin="round" fill="none"`;
        s += `<g opacity=".8"><polyline points="${pl}" stroke="${T.path.edge}" stroke-width="${pw + 1.6*inv}" ${lj}/><polyline points="${pl}" stroke="${T.path.live}" stroke-width="${pw}" ${lj}/>${texFill(pt) ? `<polyline points="${pl}" stroke="${texFill(pt)}" stroke-width="${pw}" ${lj}/>` : ""}</g>`; }
    }
    if(all.length >= 2) s += `<polyline points="${polyStr(all)}" fill="none" stroke="${col}" stroke-width="2.5" vector-effect="non-scaling-stroke"/>`;
    if(poly && all.length >= 3) s += `<line x1="${all[all.length-1][0]}" y1="${all[all.length-1][1]}" x2="${all[0][0]}" y2="${all[0][1]}" stroke="${col}" stroke-width="1.5" stroke-dasharray="5 4" vector-effect="non-scaling-stroke"/>`;
    draw.pts.forEach((p, i) => {
      const first = poly && i === 0 && draw.pts.length >= 3;
      s += `<circle cx="${p[0]}" cy="${p[1]}" r="${(first ? 7 : 4.5)*inv}" fill="${first ? "var(--sel)" : "#fff"}" stroke="var(--sel)" stroke-width="2" vector-effect="non-scaling-stroke"/>`;
    });
  }
  if(cdrag && cdrag.plan) s += pathGhostSvg(cdrag.plan, inv);
  else if(chover) s += `<rect x="${chover[0] * CHUNK}" y="${chover[1] * CHUNK}" width="${CHUNK}" height="${CHUNK}" fill="${tool === "bulldoze" ? "var(--bad)" : "var(--sel)"}" fill-opacity=".35" stroke="${tool === "bulldoze" ? "var(--bad)" : "var(--sel)"}" stroke-width="1.5" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
  if(fdrag && fdrag.box){   // the path chunks a bulldoze box will take, lit as the box grows
    let d = "";
    for(const k of bulldozeChunkKeys(fdrag)){ const [cx, cy] = chunkXY(k); d += `M${cx * CHUNK} ${cy * CHUNK}h${CHUNK}v${CHUNK}h-${CHUNK}z`; }
    if(d) s += `<path d="${d}" fill="var(--bad)" fill-opacity=".45" stroke="var(--bad)" stroke-width="1.5" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
  }
  if(fdrag){
    const bad = fdrag.lift || fdrag.why, col = bad ? "var(--bad)" : "var(--sel)";
    const keys = !fdrag.lift && fdrag.todo ? fdrag.todo : fenceDragKeys(), sh = fdrag.lift ? null : fdrag.shift;
    s += fenceGhostSvg(keys, fdrag.lift ? (fencePieces()[keys[0]] ? pieceType(fencePieces()[keys[0]]) : "wood") : fenceSel, bad, inv, sh);
    for(const k of keys){ const [a, b] = pieceEnds(k), o = sh && sh[k] || [0, 0]; s += `<line x1="${a[0] + o[0]}" y1="${a[1] + o[1]}" x2="${b[0] + o[0]}" y2="${b[1] + o[1]}" stroke="${col}" stroke-width="4" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`; }
    if(fdrag.box) s += `<rect x="${Math.min(fdrag.a[0], fdrag.b[0])}" y="${Math.min(fdrag.a[1], fdrag.b[1])}" width="${Math.abs(fdrag.b[0] - fdrag.a[0])}" height="${Math.abs(fdrag.b[1] - fdrag.a[1])}" fill="var(--bad)" fill-opacity=".12" stroke="var(--bad)" stroke-width="1.5" stroke-dasharray="${5*inv} ${3*inv}" vector-effect="non-scaling-stroke"/>`;
    else s += `<circle cx="${fdrag.a[0]}" cy="${fdrag.a[1]}" r="${4.5*inv}" fill="#fff" stroke="${col}" stroke-width="2" vector-effect="non-scaling-stroke"/>`;
  }
  if(pdrag){
    const r = paintBox(pdrag.a, pdrag.b), er = paintPick === "erase", c = er ? "var(--bad)" : "var(--sel)";
    s += `<rect x="${r[0]}" y="${r[1]}" width="${r[2] - r[0]}" height="${r[3] - r[1]}" fill="${er ? c : BIOMES[paintPick].park}" fill-opacity="${er ? .15 : .7}" stroke="${c}" stroke-width="1.5" stroke-dasharray="${5*inv} ${3*inv}" vector-effect="non-scaling-stroke"/>`;
  }
  if(wdrag){
    const b = waterBox(), c = b.err ? "var(--bad)" : "var(--sel)";
    for(const q of b.parts.length ? b.parts : [b.r]) s += `<rect x="${q[0]}" y="${q[1]}" width="${q[2] - q[0]}" height="${q[3] - q[1]}" fill="${b.err ? c : WATER_TEX[b.look] ? tileFill("w", b.look) : "#3F7FBF"}" fill-opacity="${b.err ? .2 : .75}" stroke="${c}" stroke-width="1.5" stroke-dasharray="${5*inv} ${3*inv}" vector-effect="non-scaling-stroke"/>`;
  }
  if(fhover && !fdrag && fencePieces()[fhover]){ const [a, b] = pieceEnds(fhover); s += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="var(--bad)" stroke-width="4" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`; }
  if(landGhost && landKey(tool)){
    const t = LAND[landGhost.key], gfill = t.flora || t.slots || t.tray || t.statue ? t.color : rockTone(rockBiome || (landGhost.e ? biomeOf(landGhost.e) : parkBiome()), landGhost.key).fill;
    // a picture plant or rock shows as itself with its footprint ringed on the ground; the rest stay a plain circle
    const gb = rockBiome || (landGhost.e ? biomeOf(landGhost.e) : parkBiome()), pic = t.flora ? PLANT_SPRITES[landGhost.key] : rockSprites({type:landGhost.key}, gb), gp = t.flora ? null : landGhost.pic != null ? landGhost.pic : rockPicOf(landGhost.key, gb), ring = `stroke="${landGhost.ok ? "var(--sel)" : "var(--bad)"}" stroke-width="2.5" stroke-dasharray="5 3" vector-effect="non-scaling-stroke"`;
    if(pic) s += `<g opacity="${landGhost.ok ? .7 : .45}" pointer-events="none">${featSvg({id:"ghost", type:landGhost.key, x:landGhost.x, y:landGhost.y, biome:t.flora ? undefined : gb, pic:gp != null ? gp : undefined}, gb, false)}</g>${footGhostSvg(landGhost, gb, ring)}`;
    else s += `<circle cx="${landGhost.x}" cy="${landGhost.y}" r="${t.r}" fill="${gfill}" fill-opacity=".55" ${ring}/>${footSquare(landGhost.key) ? footGhostSvg(landGhost, gb, ring) : ""}`;
  }
  const lm = tool === "move" && drag && drag.mv && drag.mv.kind === "land" && drag.mv.spot;
  if(lm){   // the item rides along live; this shows the footprint it will take, red when it won't fit
    const f = drag.mv.it, gb = BIOMES[f.biome] ? f.biome : lm.e ? biomeOf(lm.e) : drag.mv.from ? biomeOf(drag.mv.from) : parkBiome();
    s += footGhostSvg({key:f.type, x:lm.x, y:lm.y, pic:lm.pic, ok:lm.ok}, gb, `stroke="${lm.ok ? "var(--sel)" : "var(--bad)"}" stroke-width="2.5" stroke-dasharray="5 3" vector-effect="non-scaling-stroke" pointer-events="none"`);
  }
  const mb = tool === "move" && mvSel && findItem("building", mvSel);
  if(mb) s += `<polygon points="${polyStr(mb.points)}" fill="none" stroke="var(--sel)" stroke-width="3" stroke-dasharray="5 3" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
  if(mb && !BUILDINGS[mb.type].prop) s += doorArrowSvg(mb.points, mb.face === undefined ? 2 : mb.face, "var(--sel)", inv);
  if(ghost){
    const col = ghost.ok ? "var(--sel)" : "var(--bad)", t = BUILDINGS[tool];
    const gk = themeFor("building", {type:tool, points:ghost.pts}), gb = gk ? {theme:gk} : null;
    if(gb) s += `<g opacity=".8"><polygon points="${polyStr(ghost.pts)}" fill="${themeFill(gb, t.color)}"/>${themeBuildSvg(gb, polyStr(ghost.pts), polyStr(insetRect(ghost.pts, .86)))}</g>`;
    if(t.prop && tilt){
      // a path object: the pixel picture with its footprint dashed round it and an arrow out of its front
      const gi = {id:"ghost", type:tool, points:ghost.pts, theme:gk}, [fx, fy] = propFront(gi), [gx, gy] = centroid(ghost.pts), fr = Math.max(t.w, t.d) / 2 + .5;
      s += `<g opacity=".85" pointer-events="none">${propArt(gi, inv, false, false)}</g><polygon points="${polyStr(ghost.pts)}" fill="none" stroke="${col}" stroke-width="2.5" stroke-dasharray="5 3" vector-effect="non-scaling-stroke"/>`;
      s += `<path d="M${gx} ${gy}L${gx + fx*fr} ${gy + fy*fr}" stroke="${col}" stroke-width="2.5" stroke-linecap="round" vector-effect="non-scaling-stroke"/><circle cx="${gx + fx*fr}" cy="${gy + fy*fr}" r="${Math.max(.3, 4*inv)}" fill="${col}"/>`;
    } else {
      s += `<polygon points="${polyStr(ghost.pts)}" fill="${gb ? "none" : t.color}" fill-opacity=".55" stroke="${col}" stroke-width="2.5" stroke-dasharray="5 3" vector-effect="non-scaling-stroke"/>`;
      s += `<text class="glyph" x="${ghost.x}" y="${ghost.y}" font-size="${Math.min(t.w, t.d)*.55}">${t.glyph}</text>`;
      if(t.prop) s += propFrontMark({points:ghost.pts}, Math.max(t.w, t.d) / 2);
      else s += doorArrowSvg(ghost.pts, ghost.face, col, inv);
    }
  }
  if(gateGhost) s += gateGhostSvg(gateGhost, inv);   // red on fence that isn't closed yet, too
  if(tool === "zoneedit" && zedit){
    const z = zoneById(zedit.id);
    if(z){
      z.points.forEach((p, i) => {
        const q = z.points[(i + 1) % z.points.length];
        s += `<circle cx="${(p[0] + q[0]) / 2}" cy="${(p[1] + q[1]) / 2}" r="${5*inv}" fill="${z.color}" fill-opacity=".9" stroke="#fff" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`;
        s += `<path d="M${(p[0] + q[0]) / 2 - 2.5*inv} ${(p[1] + q[1]) / 2}h${5*inv}M${(p[0] + q[0]) / 2} ${(p[1] + q[1]) / 2 - 2.5*inv}v${5*inv}" stroke="#fff" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`;
      });
      z.points.forEach((p, i) => { s += `<circle cx="${p[0]}" cy="${p[1]}" r="${(zedit.sel === i ? 8 : 6.5)*inv}" fill="${zedit.sel === i ? "var(--sel)" : "#fff"}" stroke="var(--sel)" stroke-width="2.5" vector-effect="non-scaling-stroke"/>`; });
    }
  }
  if(tool === "move"){
    // fence corners in gold, water corners in blue
    for(const {t, w} of reshapeables()){
      const col = w ? "#2F6F9F" : "var(--sel)";
      t.points.forEach((p, i) => {
        const q = t.points[(i + 1) % t.points.length], mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
        s += `<circle cx="${mx}" cy="${my}" r="${5*inv}" fill="${col}" fill-opacity=".85" stroke="#fff" stroke-width="1.5" vector-effect="non-scaling-stroke" pointer-events="none"/><path d="M${mx - 2.5*inv} ${my}h${5*inv}M${mx} ${my - 2.5*inv}v${5*inv}" stroke="#fff" stroke-width="1.5" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
      });
      t.points.forEach((p, i) => { const on = mvCorner && mvCorner.id === t.id && mvCorner.i === i; s += `<circle cx="${p[0]}" cy="${p[1]}" r="${(on ? 8 : 6.5)*inv}" fill="${on ? col : "#fff"}" stroke="${col}" stroke-width="2.5" vector-effect="non-scaling-stroke" pointer-events="none"/>`; });
    }
  }
  if(tool === "uncrate" && crateGhost) s += crateGhostSvg(crateGhost);
  if(snapMark) s += `<circle cx="${snapMark[0]}" cy="${snapMark[1]}" r="${10*inv}" fill="none" stroke="var(--sel)" stroke-width="2" vector-effect="non-scaling-stroke"/>`;
  overlay.innerHTML = s;
}

function applyTransform(){ const t = `translate(${view.tx} ${view.ty}) scale(${view.k} ${ky()})`; cam.setAttribute("transform", t); const lc = $("#lightCam"); if(lc) lc.setAttribute("transform", t); const wc = $("#washCam"); if(wc) wc.setAttribute("transform", t); }
// Lamp light: the night wash gets stepped holes cut in it round each working lamp (the ground shows at its day color), a faint warm tint
// over the pool, and a small glow at the lamp head. Each step is one group at a single opacity, so overlapping pools never add up. Redrawn only when the lamp set changes.
let lightKey = "";
// A disc as stair-stepped pixels on the world pixel grid (one path of row runs, so overlapping discs in a group union cleanly)
function pixDisc(cx, cy, r, px){
  let d = "";
  const j0 = Math.floor((cy - r) / px), j1 = Math.ceil((cy + r) / px);
  for(let j = j0; j < j1; j++){
    const dy = (j + .5) * px - cy, w2 = r * r - dy * dy; if(w2 <= 0) continue;
    const w = Math.sqrt(w2), i0 = Math.ceil((cx - w) / px - .5), i1 = Math.floor((cx + w) / px - .5);
    if(i1 >= i0) d += `M${+(i0 * px).toFixed(3)} ${+(j * px).toFixed(3)}h${+((i1 - i0 + 1) * px).toFixed(3)}v${px}h${-+((i1 - i0 + 1) * px).toFixed(3)}z`;
  }
  return d;
}
function drawLights(){
  const g = $("#lightPools"), h = $("#washHoles"); if(!g || !h) return;
  const spots = lampSpots(), key = spots.map(s => `${s.id}:${s.x.toFixed(1)},${s.y.toFixed(1)}`).join("|");
  if(key !== lightKey){
    lightKey = key;
    const R = LAMP.visRadius, px = LAMP.px, c = (s, r, fill) => `<path d="${pixDisc(s.x, s.y, r, px)}" fill="${fill}" shape-rendering="crispEdges"/>`;
    let left = 1, holes = "";   // the share of night left in each step; a step's group opacity cuts it from what the step before left
    LAMP.steps.forEach(([share, wash]) => { holes += `<g opacity="${(1 - wash / left).toFixed(3)}">${spots.map(s => c(s, R * share, "#000")).join("")}</g>`; left = wash; });
    h.innerHTML = holes;
    const head = s => `<path d="${pixDisc(s.hx, s.hy - LAMP.headH / TILT, LAMP.headR, px)}" fill="${LAMP.glow}" shape-rendering="crispEdges"/>`;
    g.innerHTML = `<g opacity="${LAMP.tint}">${spots.map(s => c(s, R, LAMP.glow)).join("")}</g><g opacity=".4">${spots.map(head).join("")}</g>`;
  }
  const o = darkLevel().toFixed(2); if(g.getAttribute("opacity") !== o) g.setAttribute("opacity", o);
}

/* ---------- animals wandering in their exhibits ---------- */
const herd = new Map();   // animal id -> {el, x, y, path, key, wait, spd, exhibitId}

// In the 3/4 view each animal sits among its exhibit's trees, rocks and shelters by depth, so what stands in front of it covers it,
// and the near fence or glass (drawn after) covers them all. landscape.js puts the features in a data-z34 group, sorted north to south, each with its data-y.
const depth34 = new Map();   // exhibit id -> {g, kids, ys}, rebuilt after every render
function indexDepth34(){
  depth34.clear(); if(!tilt) return;
  for(const g of world.querySelectorAll("[data-z34]")){ const kids = [...g.children].filter(c => c.dataset.y !== undefined); depth34.set(g.dataset.z34, {g, kids, ys:kids.map(c => +c.dataset.y)}); }
}
function place34(h){
  const z = tilt && depth34.get(h.exhibitId);
  if(!z){ if(h.el.parentNode !== animalLayer) animalLayer.appendChild(h.el); h.slot = -1; return; }
  // in a vivarium the animals stand over every fitting, among themselves north to south
  if(h.viv){
    let next = null;
    for(const o of herd.values()) if(o !== h && o.exhibitId === h.exhibitId && o.el.parentNode === z.g && o.y > h.y && (!next || o.y < next.y)) next = o;
    h.slot = -1; z.g.insertBefore(h.el, next ? next.el : null); return;
  }
  let lo = 0, hi = z.ys.length; while(lo < hi){ const m = (lo + hi) >> 1; if(z.ys[m] <= h.y) lo = m + 1; else hi = m; }
  if(h.el.parentNode === z.g && h.slot === lo) return;
  h.slot = lo; z.g.insertBefore(h.el, z.kids[lo] || null);
}

// an animal stands on its spot in the 3/4 view: a dot on its lower edge, a picture on its feet (spriteSvg puts them half a dot down)
function animalUp(h){ const up = (h.lift || 0) + (h.bob || 0); return tilt ? `${up ? ` translate(0 ${(-up).toFixed(2)})` : ""}${upright()} translate(0 ${(-(h.r || 0) * (h.spr ? .5 : .85)).toFixed(2)})` : ""; }
// In an aquarium the animals drift like fish: each steers toward a spot in the glass at some depth (h.lift, how far up the picture it is drawn) with some
// momentum (h.vel: across, back, up), so it curves and eases in, hangs there a moment (h.hover), then picks another; a slow bob keeps it from ever sitting dead still.
// Floor crawlers (`floor` in SPECIES) wander the sand instead. Resting ones drift slowly near the bottom. The highest it goes keeps its picture under the waterline.
// In a paludarium the swimmers (h.swimmer) do the same, heading for the water `palu` of the time and otherwise climbing out to walk the bank at `crawl`.
// A rig strokes its walk clip (its swim stroke) above stroke[1] speed and hovers on its stand loop below stroke[0]; a turn round takes `turn` seconds; pitch is
// how much of its climb angle it noses up (a share, then the most in degrees).
const AQUA_SWIM = {speed:.7, crawl:.25, rest:.15, accel:.9, near:1.2, hover:[.5, 3], bob:.06, bobRate:1.6, palu:.6, stroke:[.08, .15], turn:.3, pitch:[.6, 20]};
// the middle of an animal's picture, up from its spot (spriteSvg and rigSvg sit the picture on the same box), to turn it about
function sprMid(h){ const S = SPRITES[h.sp] || {}, R = rigOf(h.sp), w = h.r * (h.viv ? 4 : 2.5) * ((R && S.rsize) || S.size || 1), ht = R ? w * R.h / R.w : w / (S.ratio || 1); return h.r * .5 - ht * (S.foot || 1) + ht / 2; }
const paluTop = () => 0;   // a paludarium is shallow: its swimmers paddle at the surface, cut at the waterline (drawAnimal)
function aquaTop(h, e){ const S = SPRITES[h.sp], ht = h.spr && S ? h.r * 4 * (S.size || 1) / S.ratio : h.r * 2; return Math.max(0, aquaLine(e) / TILT - ht - .3); }
function aquaSwim(h, e, dt){
  const s = SPECIES_BY_ID[h.sp] || {}, rest = h.act === "rest", wet = !e.palu || paluWet(e, h.x, h.y), crawl = !!s.floor || !wet, A = AQUA_SWIM;
  const top = crawl ? 0 : e.palu ? paluTop(h, e) : aquaTop(h, e);
  const v = h.vel || (h.vel = [0, 0, 0]), lift = h.lift || 0;
  if(h.hover > 0) h.hover -= dt;
  else if(!h.goal || !vivSpot(h, e, h.goal)){
    let p = null;
    const swim = !e.palu || Math.random() < A.palu;   // a paludarium swimmer picks the water or the bank
    for(let i = 0; i < 20 && !p; i++){ const q = randomInside(e.points); if(vivSpot(h, e, q) && (!e.palu || paluWet(e, q[0], q[1]) === swim)) p = q; }
    const deep = e.palu ? (swim ? paluTop(h, e) : 0) : top;
    h.goal = p || [h.x, h.y]; h.liftTo = s.floor ? 0 : rest ? Math.random() * deep * .2 : Math.random() * deep;
  }
  // steer: the velocity it wants points at the goal, slowing inside `near`; the one it has turns toward that at `accel` a second
  const g = h.hover > 0 || !h.goal ? [h.x, h.y, lift] : [h.goal[0], h.goal[1], h.liftTo || 0], dx = g[0] - h.x, dy = g[1] - h.y, dl = g[2] - lift, d = Math.hypot(dx, dy, dl);
  const sp = (rest ? A.rest : crawl ? A.crawl : A.speed) * Math.min(1, d / A.near), want = d > .01 ? [dx / d * sp, dy / d * sp, dl / d * sp] : [0, 0, 0];
  const ax = want[0] - v[0], ay = want[1] - v[1], al = want[2] - v[2], am = Math.hypot(ax, ay, al), k = am > 0 ? Math.min(1, A.accel * dt / am) : 0;
  v[0] += ax * k; v[1] += ay * k; v[2] += al * k;
  const nx = h.x + v[0] * dt, ny = h.y + v[1] * dt;
  if(vivSpot(h, e, [nx, ny])){ h.x = nx; h.y = ny; } else { v[0] = v[1] = 0; h.goal = null; }
  h.lift = clamp(lift + v[2] * dt, 0, top);
  if(e.palu && paluWet(e, h.x, h.y) !== !!h.sub) drawAnimal(h, e, h.a);   // into or out of the water: cut at the waterline or whole again
  if(h.goal && !(h.hover > 0) && d < .15){ h.goal = null; h.hover = A.hover[0] + Math.random() * (A.hover[1] - A.hover[0]) * (rest ? 2 : 1); }
  h.bobT = (h.bobT ?? Math.random() * 7) + dt;
  h.bob = crawl || !wet ? 0 : Math.sin(h.bobT * A.bobRate) * A.bob * Math.min(1, h.lift / A.bob);   // no bobbing into the sand
  const spd = Math.hypot(v[0], v[1], v[2]); h.stride = (h.stride || 0) + spd * dt; h.stroke = spd > A.stroke[h.stroke ? 0 : 1];   // a rig strokes its walk (swim) clip by distance above this speed, hovers below
  if(Math.abs(v[0]) > .08){ const face = v[0] > 0 ? 1 : -1; if(face !== (h.face || 1)){ h.face = face; h.turn = 0; } }
  // turning round it narrows through head-on (never quite to nothing) instead of flipping, and a swimmer noses up as it rises and down as it dives
  h.turn = Math.min(1, (h.turn ?? 1) + dt / A.turn);
  const pt = crawl ? 0 : clamp(-Math.atan2(v[2], Math.hypot(v[0], v[1]) + .1) * 180 / Math.PI * A.pitch[0], -A.pitch[1], A.pitch[1]);
  h.pitch = (h.pitch || 0) + (pt - (h.pitch || 0)) * Math.min(1, dt * 4);
  const S = SPRITES[h.sp], el = h.spr && h.el.querySelector(".spr");
  if(el){
    const c = Math.cos(Math.PI * h.turn), sx = (h.face || 1) * (h.turn < .5 ? -1 : 1) * Math.max(.2, Math.abs(c));
    el.setAttribute("transform", h.sprTf = `scale(${sx.toFixed(3)} 1)${Math.abs(h.pitch) > .3 ? ` rotate(${h.pitch.toFixed(1)} 0 ${sprMid(h).toFixed(2)})` : ""}`);
  }
  if(h.spr && rigOf(h.sp)) rigStep(h, h.stroke && !crawl ? "walk" : rest ? "rest" : "idle"); else if(h.spr && S && S.idle) setPose(h, idleFrame(h, S));
  h.el.setAttribute("transform", `translate(${h.x.toFixed(2)} ${h.y.toFixed(2)})${animalUp(h)}`);
  if(tilt) place34(h);
}

// In a pool (an open exhibit flooded with sea water, POOL) a pool animal swims like a fish in an aquarium seen from above: it steers with momentum toward a spot in
// its water (poolSpot: in the water with room for its body, and reached in a straight line through water), hangs there a moment, then picks another.
// h.dive (0 at the surface, 1 as deep as it goes) fades it into the water; shallow sea only lets it go halfway down. It comes up now and then, rings the
// surface with a ripple, and a `breach` species sometimes leaps clear as it does (h.lift, an arc over `breach` seconds). Resting ones idle near the surface.
const POOL_SWIM = {speed:1.1, rest:.25, accel:.8, near:2, hover:[.5, 2.5], dive:.6, fade:.6, shallow:.5, surface:.3, breach:[.06, 1.4, .9], turn:.35};
// is p in the animal's water with room for its body (a third of its dot) to the north, south, east and west?
function poolSpot(h, e, p){
  const W = poolWater(e, SPECIES_BY_ID[h.sp]), r = h.r || 1, S = SPRITES[h.sp] || {}, mx = r * Math.max(.35, 1.25 * (S.rsize || S.size || 1) * .72), wet = (x, y) => W.some(w => inPoly(x, y, w.points));
  // the whole picture stays in the water: its width each side, a little above and well below the middle
  return [[0, 0], [-mx, 0], [mx, 0], [-mx, r * .55], [mx, r * .55], [0, r * .55], [-mx, -r * .1], [mx, -r * .1], [0, -r * .1]].every(([ox, oy]) => wet(p[0] + ox, p[1] + oy));
}
// can it swim straight from a to b without crossing dry ground?
function poolClear(h, e, a, b){ const n = Math.ceil(dist(a, b)); for(let i = 1; i <= n; i++){ const t = i / n; if(!poolSpot(h, e, [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])) return false; } return true; }
// Looking down through water: the picture's colors pulled toward the water's blue (outlines go navy, not black), more the deeper it is, and the water's own
// tile pattern laid over it, see-through and lined up with the water around it (masked to the animal's shape), so the surface ripples pass over it. None mid-leap.
function poolTintValues(dive){
  const keep = 1 - (.4 + .35 * dive), o = [.07, .2, .46].map(w => (w * (1 - keep)).toFixed(3));   // blend toward the sea's blue
  return `${keep.toFixed(2)} 0 0 0 ${o[0]}  0 ${(keep * 1.05).toFixed(2)} 0 0 ${o[1]}  0 0 ${(keep * 1.1).toFixed(2)} 0 ${o[2]}  0 0 0 .92 0`;
}
function poolTint(h, leap){
  const cm = h.el.querySelector(".ptint"); if(cm) cm.setAttribute("values", poolTintValues(h.dive || 0));
  return leap ? "none" : `url(#ptf${h.a ? h.a.id : 0})`;
}
// the water look under a pool animal (a WATER_TEX key), or null where the water is plain blue
function poolLook(h, e){
  const w = e && waterOf(e).find(w => inPoly(h.x, h.y, w.points)), k = w && w.kind || (e && biomeOf(e));
  return WATER_TEX[k] ? k : null;
}
// The water over a pool animal is a sibling right after its group, in the map's own coordinates like the water itself (inside the animal's moving group,
// the water pattern would be redrawn whole every frame): the water's pictures over the picture's box, masked by a <use> of the animal's body
// placed with the animal's own transform. Removing the animal empties the mask, and syncAnimals clears layers left behind.
// the picture's box on the map's ground ([x, y, w, h]): rigSvg draws it 2.5r wide from 1.875r above the dot's foot row (r * .5) down to it, raised by animalUp
function poolWetBox(h){
  const r = h.r || 1, up = (h.lift || 0) + (h.bob || 0), k = tilt ? 1 / TILT : 1, foot = tilt ? h.y - up : h.y;
  return [h.x - r * 1.3, foot - r * 1.9 * k, r * 2.6, r * 2 * k];
}
const poolWetOp = (dive, leap) => leap ? 0 : .35 + .3 * dive;
function poolWetPlace(h, e){
  const look = h.spr ? poolLook(h, e) : null, id = h.a ? h.a.id : 0;
  if(!look){ if(h.wetEl){ h.wetEl.remove(); h.wetEl = null; } return; }
  if(!h.wetEl){
    h.wetEl = document.createElementNS("http://www.w3.org/2000/svg", "g"); h.wetEl.dataset.wet = id; h.wetEl.setAttribute("pointer-events", "none");
    h.wetEl.innerHTML = `<defs><mask id="pwm${id}" maskUnits="userSpaceOnUse" style="mask-type:alpha"><use href="#pwb${id}"/></mask></defs><g mask="url(#pwm${id})">`
      + `<rect shape-rendering="crispEdges"/>${"<image style=\"image-rendering:pixelated\"/>".repeat(4)}</g>`;
  }
  if(h.el.nextSibling !== h.wetEl) h.el.after(h.wetEl);
  const m = h.wetEl.firstChild.firstChild, g = h.wetEl.lastChild, q = g.firstChild, b = poolWetBox(h);
  [["x", b[0]], ["y", b[1]], ["width", b[2]], ["height", b[3]]].forEach(([k, v]) => { m.setAttribute(k, v.toFixed(2)); q.setAttribute(k, v.toFixed(2)); });
  m.firstChild.setAttribute("transform", h.el.getAttribute("transform") || "");
  h.wetEl.setAttribute("opacity", poolWetOp(h.dive || 0, h.breachT).toFixed(2));
  // the water's current frame, drawn as plain pictures on the pattern's own grid (a rect filled with the big pattern costs a full redraw of it every frame);
  // until the tiles are built the pattern is one small tile, cheap to fill a rect with
  const fill = tileFill("w", look), pat = document.getElementById(`w-${look}`), img = pat && pat.querySelector("image"), span = pat ? +pat.getAttribute("width") : 0, big = span > 4 && img;
  q.setAttribute("fill", big ? "none" : fill);
  const href = big ? img.getAttribute("href") : "", tx = Math.floor(b[0] / span) * span, ty = Math.floor(b[1] / span) * span;
  [...g.querySelectorAll("image")].forEach((im, i) => {
    if(!big){ im.style.display = "none"; return; }
    im.style.display = ""; if(im.getAttribute("href") !== href) im.setAttribute("href", href);
    im.setAttribute("x", tx + (i & 1) * span); im.setAttribute("y", ty + (i >> 1) * span); im.setAttribute("width", span); im.setAttribute("height", span);
  });
}
// how deep it can dive where it is: all the way in deep sea, halfway elsewhere
const poolDepth = (e, x, y) => waterOf(e).some(w => w.kind === "deep" && inPoly(x, y, w.points)) ? 1 : POOL_SWIM.shallow;
function poolSwim(h, e, dt){
  const s = SPECIES_BY_ID[h.sp] || {}, rest = h.act === "rest", A = POOL_SWIM, v = h.vel || (h.vel = [0, 0]);
  if(h.hover > 0) h.hover -= dt;
  else if(!h.goal){
    let p = null;
    for(let i = 0; i < 16 && !p; i++){ const q = randomInside(e.points); if(poolSpot(h, e, q) && poolClear(h, e, [h.x, h.y], q)) p = q; }
    h.goal = p || [h.x, h.y]; h.diveTo = rest || Math.random() < A.surface ? 0 : .3 + Math.random() * .7;
  }
  const g = h.hover > 0 || !h.goal ? [h.x, h.y] : h.goal, dx = g[0] - h.x, dy = g[1] - h.y, d = Math.hypot(dx, dy);
  const sp = (rest ? A.rest : A.speed) * Math.min(1, d / A.near) * Math.sqrt(h.r || 1), want = d > .01 ? [dx / d * sp, dy / d * sp] : [0, 0];
  const ax = want[0] - v[0], ay = want[1] - v[1], am = Math.hypot(ax, ay), k = am > 0 ? Math.min(1, A.accel * Math.sqrt(h.r || 1) * dt / am) : 0;
  v[0] += ax * k; v[1] += ay * k;
  const nx = h.x + v[0] * dt, ny = h.y + v[1] * dt;
  if(poolSpot(h, e, [nx, ny]) || !poolSpot(h, e, [h.x, h.y])){ h.x = nx; h.y = ny; } else { v[0] = v[1] = 0; h.goal = null; }
  if(h.goal && !(h.hover > 0) && d < .3){ h.goal = null; h.hover = A.hover[0] + Math.random() * (A.hover[1] - A.hover[0]) * (rest ? 2 : 1); }
  // diving and surfacing, and now and then a leap clear of the water
  const was = h.dive ?? 0, to = Math.min(h.diveTo ?? 0, poolDepth(e, h.x, h.y));
  h.dive = clamp(was + Math.sign(to - was) * Math.min(Math.abs(to - was), A.dive * dt), 0, 1);
  if(s.breach && !h.breachT && was > .2 && h.dive <= .2 && to === 0 && Math.random() < A.breach[0]) h.breachT = 1e-6;
  if(h.breachT){ h.breachT += dt / A.breach[1]; if(h.breachT >= 1){ h.breachT = 0; h.lift = 0; } else h.lift = Math.sin(Math.PI * h.breachT) * (h.r || 1) * A.breach[2]; }
  const dv = h.el.querySelector(".dive");
  if(dv){ dv.setAttribute("opacity", (1 - A.fade * (h.breachT ? 0 : h.dive)).toFixed(2)); dv.style.filter = poolTint(h, h.breachT); }
  if(Math.abs(v[0]) > .08){ const face = v[0] > 0 ? 1 : -1; if(face !== (h.face || 1)){ h.face = face; h.turn = 0; } }
  h.turn = Math.min(1, (h.turn ?? 1) + dt / A.turn);
  const S = SPRITES[h.sp], el = h.spr && h.el.querySelector(".spr");
  if(el){ const c = Math.cos(Math.PI * h.turn), sx = (h.face || 1) * (h.turn < .5 ? -1 : 1) * Math.max(.2, Math.abs(c)); el.setAttribute("transform", h.sprTf = `scale(${sx.toFixed(3)} 1)`); }
  const spd = Math.hypot(v[0], v[1]); h.stride = (h.stride || 0) + spd * dt;
  if(h.spr && rigOf(h.sp)) rigStep(h, spd > .15 ? "walk" : rest ? "rest" : "idle"); else if(h.spr && S && S.idle) setPose(h, idleFrame(h, S));
  h.el.setAttribute("transform", `translate(${h.x.toFixed(2)} ${h.y.toFixed(2)})${animalUp(h)}`);
  if(tilt) place34(h);
  poolWetPlace(h, e);
}

// A species picture, about as wide as two and a half dots, its feet a little below the dot's middle; face -1 turns it to the left.
// The walk strip sits in a window one frame wide, hidden while it stands; setPose shows a frame.
// the picture's flip, or a swimmer's squash through a turn and its pitch as aquaSwim and poolSwim last set them, so a redraw (render, once a second) doesn't pop it flat for a frame
const sprTf = h => h.sprTf || `scale(${h.face || 1} 1)`;
function spriteSvg(sp, h){
  if(rigOf(sp) && !(h.swim && SPRITES[sp].swim && !rigSwims(sp))) return rigSvg(sp, h);   // drawn from parts, not a strip (rigs.js), a vivarium too; a swimmer in a pond keeps its swim strip unless its rig has a swim clip
  const S = SPRITES[sp], swm = !h.viv && h.swim && S.swim, idl = !swm && (h.viv || (!S.walk && S.idle)), n = swm ? S.swim : idl ? S.idle : S.walk, kind = swm ? "swim" : idl ? "idle" : "walk", r = h.r, w = r * (h.viv ? 4 : 2.5) * (S.size || 1), ht = w / S.ratio, box = `x="${(-w/2).toFixed(2)}" y="${(r*.5 - ht * (S.foot || 1)).toFixed(2)}" width="${w.toFixed(2)}" height="${ht.toFixed(2)}"`, f = h.pose ?? -1;
  return `<g class="spr" transform="${sprTf(h)}"><image class="st" href="${spriteUrl(`sprites/${sp}.png`)}" style="image-rendering:pixelated" ${box}${(f >= 0 || f <= -2) && n ? ` display="none"` : ""}/>`
    + (n ? `<svg class="wk" ${box} viewBox="${Math.max(f, 0)} 0 1 ${(1/S.ratio).toFixed(4)}" preserveAspectRatio="none"${f < 0 ? ` display="none"` : ""}><image href="${spriteUrl(`sprites/${sp}-${kind}.png`)}" style="image-rendering:pixelated" width="${n}" height="${(1/S.ratio).toFixed(4)}" preserveAspectRatio="none"/></svg>` : "")
    + (!idl && !swm && S.walk && S.idle ? `<svg class="id" ${box} viewBox="${Math.max(-2 - f, 0)} 0 1 ${(1/S.ratio).toFixed(4)}" preserveAspectRatio="none"${f > -2 || f <= -100 ? ` display="none"` : ""}><image href="${spriteUrl(`sprites/${sp}-idle.png`)}" style="image-rendering:pixelated" width="${S.idle}" height="${(1/S.ratio).toFixed(4)}" preserveAspectRatio="none"/></svg>` : "")
    + (!idl && !swm && S.walk && S.rest ? `<svg class="rs" ${box} viewBox="${Math.max(-100 - f, 0)} 0 1 ${(1/S.ratio).toFixed(4)}" preserveAspectRatio="none"${f > -100 ? ` display="none"` : ""}><image href="${spriteUrl(`sprites/${sp}-rest.png`)}" style="image-rendering:pixelated" width="${S.rest}" height="${(1/S.ratio).toFixed(4)}" preserveAspectRatio="none"/></svg>` : "") + `</g>`;
}
// A picture's idle frame in a vivarium (or an idle-only picture): its idle strip loops at `ms`. With `dyn` (a list of [first frame, count]), only the first `base` frames loop,
// and every `dynGap` seconds (min, max) one of the dyn clips plays once at `dynMs` a frame, a small movement (the Tiktaalik's look-around and push-up), then it settles back.
function idleFrame(h, S){
  const now = performance.now(), nb = S.base || S.idle; h.phase ??= Math.random() * nb;
  if(S.dyn){
    const gap = () => now + 1000 * (S.dynGap[0] + Math.random() * (S.dynGap[1] - S.dynGap[0]));
    h.dynAt ??= gap();
    if(h.dynClip){ const [s, n] = S.dyn[h.dynClip - 1], k = Math.floor((now - h.dynT) / (S.dynMs || 150)); if(k < n) return s + k; h.dynClip = 0; h.dynAt = gap(); }
    else if(now >= h.dynAt){ h.dynClip = (h.dynLast = ((h.dynLast ?? Math.floor(Math.random() * S.dyn.length)) + 1) % S.dyn.length) + 1; h.dynT = now; return S.dyn[h.dynClip - 1][0]; }   // the clips take turns
  }
  return Math.floor(now / (S.ms || 250) + h.phase) % nb;
}
// -1 stands, 0 and up is a walk frame
// -1 stands, 0 and up is a walk frame, -2 and down is an idle frame (-2 - n), for pictures that have both strips
function setPose(h, f){
  if(f === h.pose) return;
  h.pose = f;
  const st = h.el.querySelector(".st"), wk = h.el.querySelector(".wk"), id = h.el.querySelector(".id"), rs = h.el.querySelector(".rs"); if(!st) return;
  if(id || rs){
    if(id) id.setAttribute("display", "none");   // a walk-and-idle picture: the walk strip, the idle strip, the resting strip or the standing picture, one at a time
    if(rs) rs.setAttribute("display", "none");
    if(wk) wk.setAttribute("display", "none");
    st.setAttribute("display", "none");
    if(f <= -100 && rs){ const vb = rs.getAttribute("viewBox").split(" "); vb[0] = -100 - f; rs.setAttribute("viewBox", vb.join(" ")); rs.removeAttribute("display"); }
    else if(f <= -2 && id){ const vb = id.getAttribute("viewBox").split(" "); vb[0] = -2 - f; id.setAttribute("viewBox", vb.join(" ")); id.removeAttribute("display"); }
    else if(f >= 0 && wk){ const vb = wk.getAttribute("viewBox").split(" "); vb[0] = f; wk.setAttribute("viewBox", vb.join(" ")); wk.removeAttribute("display"); }
    else st.removeAttribute("display");
    return;
  }
  if(!wk) return;
  if(f < 0){ st.removeAttribute("display"); wk.setAttribute("display", "none"); return; }
  st.setAttribute("display", "none"); wk.removeAttribute("display");
  const vb = wk.getAttribute("viewBox").split(" "); vb[0] = f; wk.setAttribute("viewBox", vb.join(" "));
}
// a swimmer in a pond keeps paddling, moving or not
const swimmingPic = h => !!(h.swim && h.spr && SPRITES[h.sp] && SPRITES[h.sp].swim && !rigSwims(h.sp));
function swimFrame(h, S){ h.phase ??= Math.random() * S.swim; return Math.floor(performance.now() / (S.swimMs || 200) + h.phase) % S.swim; }
// what a picture shows while it holds still: its idle strip if it has one beside a walk strip, else the standing picture
// A picture with a resting strip (-100 and down is a resting frame, -100 - n) lies down while the animal rests: the first frames play once (a crouch, lying down, the eyes closing),
// then the last two alternate slowly (a breath), from the moment it settles until its act changes (the stamp is cleared in animateAnimals).
function restPose(h, S){
  if(S && S.walk && S.rest && h.act === "rest"){
    h.restAt ??= performance.now();
    const ms = S.restMs || 300, k = S.rest - 2, t = performance.now() - h.restAt;
    return -100 - (t < k * ms ? Math.floor(t / ms) : k + Math.floor((t - k * ms) / (S.holdMs || 1200)) % 2);
  }
  if(!(S && S.walk && S.idle)) return -1;
  h.phase ??= Math.random() * S.idle;
  return -2 - Math.floor(performance.now() / (S.ms || 250) + h.phase) % S.idle;
}

// Can a vivarium animal stand at p with its picture wholly inside the case? Its width clears the side walls and posts, and its feet stay behind the sill (the front glass's frame covers the bottom of the floor).
function vivSpot(h, e, p){
  const K = VIV34[e.viv] || VIV34.M, S = SPRITES[h.sp], hw = (S ? 2 * (S.size || 1) : 1) * (h.r || 1) + K.post, m = K.sill / TILT + .15, P = e.points;
  if(e.palu && !h.swimmer && p[1] > paluY(e) - .2) return false;   // only the swimmers go in a paludarium's water
  return inPoly(p[0], p[1], P) && inPoly(p[0] - hw, p[1], P) && inPoly(p[0] + hw, p[1], P) && inPoly(p[0], p[1] + m, P) && inPoly(p[0] - hw, p[1] + m, P) && inPoly(p[0] + hw, p[1] + m, P);
}
// The room a vivarium animal's picture takes: half its width, and half the height of its body (a fraction of the picture's box) in the case's depth
function vivBody(h){
  const S = SPRITES[h.sp], w = S ? 2 * (S.size || 1) * (h.r || 1) : (h.r || 1), ht = S ? 4 * (S.size || 1) * (h.r || 1) / S.ratio : (h.r || 1) * 2;
  return {hw:w, hh:ht * .15 / TILT};
}
// Would the animal at p overlap another in its case (picture against picture), or stand behind a fitting's base (it's drawn over the fittings, so it would hover over the base)?
function vivCrowd(h, p){
  const a = vivBody(h), e = state.exhibits.find(x => x.id === h.exhibitId);
  if(e) for(const f of landOf(e)){ const t = LAND[f.type]; if(t && !t.flat && !t.tray && p[1] < f.y - .1 && Math.abs(f.x - p[0]) < a.hw + t.r * (f.k || 1)) return true; }
  for(const o of herd.values()){
    if(o === h || o.exhibitId !== h.exhibitId || !o.placed) continue;
    const b = vivBody(o);
    if(Math.abs(o.x - p[0]) < a.hw + b.hw && Math.abs(o.y - p[1]) < a.hh + b.hh) return true;
  }
  return false;
}
// The spot nearest p where the animal fits the glass and overlaps no other (p itself if it has no room anywhere: the case is full)
function vivClear(h, e, p){
  if(!vivCrowd(h, p)) return p;
  const bb = bbox(e.points); let best = null, bd = Infinity;
  for(let y = bb.y0; y <= bb.y1; y += .5) for(let x = bb.x0; x <= bb.x1; x += .5){
    const d = Math.hypot(x - p[0], (y - p[1]) * 2); if(d >= bd) continue;
    const q = [x, y]; if(vivSpot(h, e, q) && !vivCrowd(h, q)){ bd = d; best = q; }
  }
  return best || p;
}
// A spot for a vivarium animal in the middle third of the case's depth (fits the glass, out of pools), the one furthest from the other animals and the fittings so they spread out and none hides behind another, or null
function vivMidSpot(h, e){
  const bb = bbox(e.points), d = bb.y1 - bb.y0, land = landOf(e).filter(f => LAND[f.type]); let best = null, bs = -1;
  for(let t = 0; t < 120; t++){
    const p = randomInside(e.points);
    if(p[1] < bb.y0 + d / 3 || p[1] > bb.y0 + d * 2 / 3 || !vivSpot(h, e, p) || vivCrowd(h, p) || vivPoolAt(e, p[0], p[1])) continue;
    let g = Infinity;
    for(const o of herd.values()) if(o !== h && o.exhibitId === h.exhibitId && o.placed) g = Math.min(g, Math.hypot(o.x - p[0], o.y - p[1]));
    for(const f of land) g = Math.min(g, Math.hypot(f.x - p[0], f.y - p[1]) * 1.5);
    if(g > bs){ bs = g; best = p; }
  }
  return best;
}
// A spot in a lamp's glow or a pool for a vivarium animal (a home from vivHomes): a few huddle together, and one too near a wall for its picture is nudged toward the middle of the case
function vivHomeSpot(h, e, hm){
  const [cx, cy] = centroid(e.points);
  for(let t = 0; t < 20; t++){
    const p = [hm.x + (Math.random() * 2 - 1) * hm.rx, hm.y + (Math.random() * 2 - 1) * hm.ry];
    for(let f = 1; f >= .5; f -= .1){
      const q = [cx + (p[0] - cx) * f, cy + (p[1] - cy) * f];
      if(!vivSpot(h, e, q) || vivCrowd(h, q)) continue;
      if(hm.pool ? vivPoolAt(e, q[0], q[1]) : Math.hypot(q[0] - hm.x, (q[1] - hm.y) * 2) <= hm.rx + 2.2) return q;
      break;
    }
  }
  return null;
}

function animalRadius(sp){ return clamp(Math.sqrt(SPECIES_BY_ID[sp].space) / 9, 1.2, 6); }

// An animal's picture (or dot), its sick and pacing rings, and the waterline cut when it's in water; drawn by syncAnimals, and again when a swimmer crosses a shore
function drawAnimal(h, e, a){
  const s = SPECIES_BY_ID[a.sp], r = h.r, sprite = h.spr, showLetter = r * view.k >= 8;
  // sick animals get a red ring, pacing ones an amber one, and hiding ones fade into their cover
  h.el.setAttribute("opacity", a.act === "hide" ? .45 : a.act === "rest" ? .85 : 1);
  // in a vivarium pool or a paludarium's water: the body is cut at the waterline, with a ripple over the cut
  const pool = e.viv && (vivPoolAt(e, h.x, h.y) || h.swimmer && paluWet(e, h.x, h.y)), body = sprite ? spriteSvg(a.sp, h) : `<circle r="${r}" fill="${PERIOD_COLOR[s.period]}" stroke="#1D2B22" stroke-width="1.5" vector-effect="non-scaling-stroke"/>` + (showLetter ? `<text class="glyph" font-size="${r*1.1}" fill="#1D2B22" style="fill:#1D2B22">${s.name[0]}</text>` : "");
  h.sub = !!pool;
  const subSvg = () => { const S = SPRITES[a.sp], w = sprite ? r * 4 * (S.size || 1) : r * 2, ht = sprite ? w / S.ratio : r * 2, wl = sprite ? r * .5 - ht * .09 : r * .1, cut = wl + (sprite && e.viv ? ht * (1 - (S.foot || 1)) * .7 : 0), cid = "vc-" + esc(a.id);
    return `<clipPath id="${cid}"><rect x="${(-w).toFixed(2)}" y="${(-ht * 3).toFixed(2)}" width="${(2 * w).toFixed(2)}" height="${(ht * 3 + cut).toFixed(2)}"/></clipPath><g clip-path="url(#${cid})">${body}</g>`
      + `<g fill="none" stroke="#CFE9F2" stroke-width="${(ROCK_MPP * 1.2).toFixed(2)}" pointer-events="none"><path d="M${(-w * .3).toFixed(2)} ${wl.toFixed(2)}h${(w * .6).toFixed(2)}"/></g><ellipse cx="0" cy="${(wl + r * .12).toFixed(2)}" rx="${(w * .34).toFixed(2)}" ry="${(r * .2).toFixed(2)}" fill="#3E86A8" fill-opacity=".6" pointer-events="none"/>`; };
  h.el.innerHTML = (noticed(a) ? `<circle r="${r * 1.45}" fill="none" stroke="#E5484D" stroke-width="2" stroke-dasharray="${a.darted ? "2 2" : "none"}" vector-effect="non-scaling-stroke"/>` : "") +
    (a.act === "pace" ? `<circle r="${r * (noticed(a) ? 1.8 : 1.45)}" fill="none" stroke="#E0A030" stroke-width="2" stroke-dasharray="3 2" vector-effect="non-scaling-stroke"/>` : "") +
    (pool ? subSvg() : h.pool ? poolBodySvg(h, body) : body);
  h.el.setAttribute("transform", `translate(${h.x.toFixed(2)} ${h.y.toFixed(2)})${animalUp(h)}`);
  if(h.pool) poolWetPlace(h, e);
}
// A pool animal: its body in a group poolSwim fades and tints as it dives; the water laid over it is its own layer (poolWetPlace)
function poolBodySvg(h, body){
  const id = h.a ? h.a.id : 0, op = (1 - POOL_SWIM.fade * (h.dive || 0)).toFixed(2);
  return `<defs><filter id="ptf${id}" color-interpolation-filters="sRGB"><feColorMatrix class="ptint" type="matrix" values="${poolTintValues(h.dive || 0)}"/></filter></defs>`
    + `<g class="dive" opacity="${op}" style="filter:${poolTint(h, h.breachT)}"><g id="pwb${id}">${body}</g></g>`;
}
function syncAnimals(){
  const seen = new Set(), inv = 1/view.k;
  for(const e of state.exhibits){
    for(const a of e.animals){
      seen.add(a.id);
      let h = herd.get(a.id);
      if(!h || h.exhibitId !== e.id){
        if(h) h.el.remove();
        const [x, y] = randomInside(e.points);
        const el = document.createElementNS("http://www.w3.org/2000/svg", "g");
        el.setAttribute("pointer-events", "none");
        h = {el, x, y, path:null, wait:Math.random()*3, spd:.6 + Math.random()*.8, exhibitId:e.id, sp:a.sp, face:a.face || 1};
        herd.set(a.id, h);
        animalLayer.appendChild(el);
      }
      h.a = a;
      // vivarium animals stay small enough to fit inside the glass, sized by the smallest case their species fits (not the case they're in)
      const s = SPECIES_BY_ID[a.sp], vd = e.viv ? VIVARIUMS[VIVARIUMS[s.viv] ? s.viv : e.viv].d / 7 : 0, r = e.viv ? (SPRITES[a.sp] ? vd : Math.min(vd, Math.max(.4, 3*inv))) : Math.max(animalRadius(a.sp), 4*inv);
      const showLetter = r * view.k >= 8, sprite = SPRITES[a.sp] && r * view.k >= (e.viv ? 2 : 6);   // tank animals are small, so their picture shows sooner and a bit larger
      h.r = r; h.spr = sprite; h.viv = !!e.viv; h.swimmer = !!e.palu && paluSwims(s); h.pool = !e.viv && !!s.pool;
      if(e.viv && h.placed && !vivSpot(h, e, [h.x, h.y])) h.placed = false;
      if(h.pool && h.placed && !poolSpot(h, e, [h.x, h.y]) && poolWater(e, s).length){ h.placed = false; h.goal = null; }   // its water was moved or taken away: back into what's left   // the case was moved or resized, or the picture grew: find it a spot again
      if(!h.placed){ h.placed = true; const A = walkArea(h, e), homes = e.viv ? vivHomes(e, s) : []; let ok = false;
        for(let i = 0; i < homes.length * 4 && !ok; i++){ const p = vivHomeSpot(h, e, homes[i % homes.length]); if(p){ [h.x, h.y] = p; ok = true; } }
        if(e.viv && !ok){ const p = vivMidSpot(h, e); if(p){ [h.x, h.y] = p; ok = true; } }
        for(let i = 0; i < (e.viv ? 80 : h.pool ? 60 : 20) && !ok; i++){ const p = randomInside(e.points); if(e.viv ? vivSpot(h, e, p) && !vivCrowd(h, p) && !vivPoolAt(e, p[0], p[1]) : h.pool ? poolSpot(h, e, p) : standable(p, A)){ [h.x, h.y] = p; ok = true; } }   // a pool animal starts in its water   // a new animal starts somewhere it fits; in a vivarium, under its lamp or in its pool if it likes one (and out of the pool if it doesn't)
        if(!ok && e.viv){ const [cx, cy] = centroid(e.points); for(let f = 1; f >= 0 && !ok; f -= .1){ const p = [cx + (h.x - cx) * f, cy + (h.y - cy) * f]; if(vivSpot(h, e, p)){ [h.x, h.y] = p; ok = true; } } if(!ok){ const [cx2, cy2] = centroid(e.points); [h.x, h.y] = [cx2, cy2]; } } }
      drawAnimal(h, e, a);
    }
  }
  for(const [id, h] of herd) if(!seen.has(id)){ h.el.remove(); herd.delete(id); }
  indexDepth34(); for(const h of herd.values()){ place34(h); if(h.pool) poolWetPlace(h, state.exhibits.find(x => x.id === h.exhibitId)); }
  for(const w of document.querySelectorAll("[data-wet]")){ const h = herd.get(w.dataset.wet); if(!h || h.wetEl !== w || !h.el.isConnected) w.remove(); }
}

// What an animal walks around: its fence, kept half a body's length off so it doesn't poke through, and the rocks, trees, caves and barns
// standing in the exhibit (each a circle it keeps its feet out of)
function walkArea(h, e){
  const pts = e.points, c = centroid(pts), body = (h.r || 1) * .5;
  const m = Math.min((h.r || 1) * 1.3, inPoly(c[0], c[1], pts) ? distToEdge(c[0], c[1], pts) * .5 : 1);
  const obs = [];
  for(const f of landOf(e)){
    const t = LAND[f.type]; if(!t) continue;
    const r = t.r * (f.k || 1);
    // obstacles are rounded boxes: the box [x - hx, x + hx] x [y - hy, y + hy] grown by c (hx = hy = 0 is a circle)
    if(t.flora){   // a tree's trunk, a fifth of its square; low plants are walked through
      if(t.look === "conifer" || treeLift(t)){
        if(t.footW){ const b = footBox(f, e); obs.push({x:(b[0] + b[2]) / 2, y:(b[1] + b[3]) / 2, hx:(b[2] - b[0]) / 2, hy:(b[3] - b[1]) / 2, c:body}); }   // a pictured tree's base
        else { const h = Math.max(.5, footBox(f, e)[2] - f.x) * .36; obs.push({x:f.x, y:f.y, hx:h, hy:h, c:body}); } }
    } else if(ROCK_TYPES.includes(f.type)){ for(const b of footRects(f, e)) obs.push({x:(b[0] + b[2]) / 2, y:(b[1] + b[3]) / 2, hx:(b[2] - b[0]) / 2, hy:(b[3] - b[1]) / 2, c:body}); }   // a rock keeps off each rect of its footprint
    else {
      const R = t.look === "cave" || t.look === "burrow" ? r * .85 : t.slots ? (t.look ? 0 : r) : t.tray || t.toy || t.toyFor || t.statue ? 0 : footR(t) * (f.k || 1) * .9;
      if(R) obs.push({x:f.x, y:f.y, hx:0, hy:0, c:R + body});
    }
  }
  // land animals keep out of the exhibit's water; swimmers and flyers ignore it
  const sp = SPECIES_BY_ID[h.sp], wat = sp && !swims(sp) && !isFlyer(sp) ? waterOf(e).map(w => w.points) : [];
  return {pts, obs, m, wat, wm:body};
}
// Semi-aquatic animals wade in and swim; the rest stay on the bank
const swims = s => !isFlyer(s) && (!!s.semi || likesOf(s).water >= .6);
// Would a land animal standing at (x, y) be in the exhibit's water, or hanging over its edge?
function landWet(h, e, x, y){
  const sp = SPECIES_BY_ID[h.sp]; if(!sp || swims(sp) || isFlyer(sp)) return false;
  const m = (h.r || 1) * .5;
  return waterOf(e).some(w => inPoly(x, y, w.points) || distToEdge(x, y, w.points) < m);
}
// in the water, or with its body hanging over the edge (wm is half a body)
const inWater = (p, A) => A.wat.some(w => inPoly(p[0], p[1], w) || distToEdge(p[0], p[1], w) < A.wm);
const obsDist = (o, x, y) => Math.hypot(Math.max(Math.abs(x - o.x) - o.hx, 0), Math.max(Math.abs(y - o.y) - o.hy, 0));
const inObstacle = (p, A) => A.obs.some(o => obsDist(o, p[0], p[1]) < o.c) || inWater(p, A);
// Is p somewhere an animal can stand: inside, off the fence, out of the rocks and trees?
const standable = (p, A) => inPoly(p[0], p[1], A.pts) && distToEdge(p[0], p[1], A.pts) >= A.m && !inObstacle(p, A);
// A spot by the fence moved in toward the middle until the animal fits there; solid also steps it out of any rock or tree it's in
function offFence(p, A, solid){
  const c = centroid(A.pts);
  for(let k = 0, q = p; k < 12; k++, q = [q[0] + (c[0] - q[0]) * .15, q[1] + (c[1] - q[1]) * .15]){
    if(!inPoly(q[0], q[1], A.pts)) break;
    if(distToEdge(q[0], q[1], A.pts) >= A.m){ p = q; break; }
  }
  if(solid && inObstacle(p, A)) for(let r = 1; r <= 8; r++) for(let k = 0; k < 8; k++){ const q = [p[0] + Math.cos(k * Math.PI / 4) * r, p[1] + Math.sin(k * Math.PI / 4) * r]; if(standable(q, A)) return q; }
  return p;
}

// Can an animal walk straight from a to b? Not across the fence or too close along it, and not through a rock or tree
// (one it's standing in, or heading into, doesn't count). Checks a few points are inside too, in case it only touches a corner.
function walkClear(a, b, A){
  const pts = A.pts, need = Math.min(A.m, distToEdge(a[0], a[1], pts), distToEdge(b[0], b[1], pts)) * .9;
  for(let i = 0; i < pts.length; i++) if(segSegDist(a, b, pts[i], pts[(i+1) % pts.length]) < need || segCross(a, b, pts[i], pts[(i+1) % pts.length])) return false;
  for(const o of A.obs){
    if(obsDist(o, a[0], a[1]) < o.c || obsDist(o, b[0], b[1]) < o.c) continue;
    if(segBoxDist(a, b, [o.x - o.hx, o.y - o.hy, o.x + o.hx, o.y + o.hy]) < o.c) return false;
  }
  // not into or across a pond (one it's standing in doesn't count, so it can wade out)
  if(A.wat.length && !inWater(a, A) && inWater(b, A)) return false;
  if(A.wat.length && !inWater(a, A) && !inWater(b, A)) for(const w of A.wat) for(let i = 0; i < w.length; i++) if(segCross(a, b, w[i], w[(i + 1) % w.length]) || segSegDist(a, b, w[i], w[(i + 1) % w.length]) < A.wm) return false;
  for(const t of [.25, .5, .75]) if(!inPoly(a[0] + (b[0]-a[0])*t, a[1] + (b[1]-a[1])*t, pts)) return false;
  return true;
}

// Every corner nudged inward past the animal's margin, so a route can bend around the inside corners of an irregular exhibit
const walkNodeCache = new Map();
function cornerNodes(pts, m = 0){
  const key = JSON.stringify(pts) + m.toFixed(1); let nodes = walkNodeCache.get(key);
  if(nodes) return nodes;
  nodes = [];
  const n = pts.length;
  for(let i = 0; i < n; i++){
    const p = pts[i], a = pts[(i+n-1) % n], b = pts[(i+1) % n];
    const u = [(a[0]-p[0])/(dist(a,p)||1), (a[1]-p[1])/(dist(a,p)||1)], v = [(b[0]-p[0])/(dist(b,p)||1), (b[1]-p[1])/(dist(b,p)||1)];
    let bx = u[0] + v[0], by = u[1] + v[1], L = Math.hypot(bx, by);
    if(L < 1e-6){ bx = -u[1]; by = u[0]; L = 1; }
    bx /= L; by /= L;
    for(const k of [1, 2.5, 4]){   // bisector of the two edges, flipped if it points outside
      const d = m * 1.5 + k;
      let q = [p[0] + bx*d, p[1] + by*d];
      if(!inPoly(q[0], q[1], pts)) q = [p[0] - bx*d, p[1] - by*d];
      if(inPoly(q[0], q[1], pts) && distToEdge(q[0], q[1], pts) > Math.max(.3, m)){ nodes.push(q); break; }
    }
  }
  if(walkNodeCache.size > 60) walkNodeCache.clear();
  walkNodeCache.set(key, nodes);
  return nodes;
}
// The corners, plus a ring of spots around each rock and tree to walk round it by
function walkNodes(A){
  const out = cornerNodes(A.pts, A.m).filter(p => !inObstacle(p, A));
  for(const o of A.obs) for(let k = 0; k < 8; k++){ const a = k * Math.PI / 4 + .3, ca = Math.cos(a), sa = Math.sin(a), p = [o.x + clamp(ca * 1e3, -o.hx, o.hx) + ca * (o.c + .4), o.y + clamp(sa * 1e3, -o.hy, o.hy) + sa * (o.c + .4)]; if(standable(p, A)) out.push(p); }
  for(const w of A.wat){   // spots just off each pond corner, pushed away from the middle
    const c = centroid(w);
    for(const q of w){ const d = dist(q, c) || 1; for(const k of [1, 2.5]){ const r = A.m + k, p = [q[0] + (q[0] - c[0]) / d * r, q[1] + (q[1] - c[1]) / d * r]; if(standable(p, A)){ out.push(p); break; } } }
  }
  return out;
}

// Which waypoints see each other, worked out once per exhibit layout and body size, since every animal of a kind shares it
const walkGraphCache = new Map();
function walkGraph(A){
  const key = JSON.stringify([A.pts, A.obs, A.m, A.wat]); let g = walkGraphCache.get(key);
  if(g) return g;
  const nodes = walkNodes(A), adj = nodes.map(() => []);
  for(let i = 0; i < nodes.length; i++) for(let j = i + 1; j < nodes.length; j++) if(walkClear(nodes[i], nodes[j], A)){ const w = dist(nodes[i], nodes[j]); adj[i].push([j, w]); adj[j].push([i, w]); }
  if(walkGraphCache.size > 40) walkGraphCache.clear();
  walkGraphCache.set(key, g = {nodes, adj});
  return g;
}
// Waypoints from a to b that stay inside the exhibit and around what stands in it, or null if there's no way
function walkRoute(a, b, A){
  if(walkClear(a, b, A)) return [b];
  const {nodes, adj} = walkGraph(A), N = nodes.length, done = new Array(N).fill(false), prev = new Array(N).fill(-1);
  const d = nodes.map(n => walkClear(a, n, A) ? dist(a, n) : Infinity);
  let best = Infinity, last = -1;
  for(;;){
    let u = -1; for(let i = 0; i < N; i++) if(!done[i] && d[i] < Infinity && (u < 0 || d[i] < d[u])) u = i;
    if(u < 0 || d[u] >= best) break;
    done[u] = true;
    const tail = dist(nodes[u], b); if(d[u] + tail < best && walkClear(nodes[u], b, A)){ best = d[u] + tail; last = u; }
    for(const [v, w] of adj[u]) if(!done[v] && d[u] + w < d[v]){ d[v] = d[u] + w; prev[v] = u; }
  }
  if(last < 0) return null;
  const out = [b]; for(let i = last; i >= 0; i = prev[i]) out.unshift(nodes[i]);
  return out;
}

// A land animal caught in a pond (one drawn over it, or a spawn with no dry spot) heads for the nearest dry ground, or hops there if no route exists
function wadeOut(h, e){
  const A = walkArea(h, e); if(!inWater([h.x, h.y], A)) return false;
  let best = null, bd = Infinity;
  for(let i = 0; i < 80; i++){ const p = randomInside(e.points); if(!standable(p, A)) continue; const d = Math.hypot(p[0] - h.x, p[1] - h.y); if(d < bd){ bd = d; best = p; } }
  if(!best) return false;
  const r = walkRoute([h.x, h.y], best, A);
  if(r) h.path = r; else { h.x = best[0]; h.y = best[1]; h.path = []; }   // no way out on foot: it's put on the bank, never walked across the pond
  return true;
}

// Pick a new spot to walk to and the route there; an animal that finds none just stays put
function animalWander(h, e){
  h.key = JSON.stringify(e.points); h.path = [];
  if(!inPoly(h.x, h.y, e.points)){ [h.x, h.y] = randomInside(e.points); }
  if(!e.viv && wadeOut(h, e)) return;
  const A = walkArea(h, e), ws = swims(SPECIES_BY_ID[h.sp]) ? waterOf(e) : [];
  const toWater = h.swim ? .15 : .5;   // swimmers spend about half their time in the water, but one already in it mostly heads out (else a big pond by the fence traps it)
  for(let i = 0; i < 8; i++){
    const p = ws.length && Math.random() < toWater ? randomInside(pickOne(ws).points) : randomInside(e.points);
    if(!standable(p, A)) continue;
    const r = walkRoute([h.x, h.y], p, A);
    if(r){ h.path = r; return; }
  }
}

/* What each act looks like (behavior.js picks the act): where the animal heads, how fast, and whether it stays once there */
const ACT_GAIT = {pace:1.6, play:1.8, patrol:.9, hunt:.55, social:1.1, hide:SHELTER.hurry};
const ACT_STAYS = new Set(["eat", "drink", "rest", "hide"]);
// The edge of a land feature nearest the animal, or its middle for shelters it can walk into
function featSpot(h, f, into){
  const t = LAND[f.type];
  if(into && (t.look === "cave" || t.look === "burrow")) return [f.x, f.y + t.r * .85 + (h.r || 1) * .6];   // at the mouth, which faces the viewer
  const r = into ? 0 : t.r + (h.r || 1), dx = h.x - f.x, dy = h.y - f.y, d = Math.hypot(dx, dy) || 1;
  return [f.x + dx / d * r, f.y + dy / d * r];
}
const nearestTo = (h, list, at = x => x) => { let b = null, bd = Infinity; for(const x of list){ const p = at(x), d = Math.hypot(p[0] - h.x, p[1] - h.y); if(d < bd){ bd = d; b = x; } } return b; };
const pickOne = list => list.length ? list[Math.floor(Math.random() * list.length)] : null;
// Just inside the keeper gate, where the trough and the food drop are
function gateSpot(e){
  if(!e.gate) return null;
  const c = centroid(e.points), d = dist(e.gate, c) || 1, m = Math.min(3, d / 2);
  const p = [e.gate[0] + (c[0] - e.gate[0]) / d * m, e.gate[1] + (c[1] - e.gate[1]) / d * m];
  return inPoly(p[0], p[1], e.points) ? p : null;
}
// A spot as far from the guest paths as the exhibit allows
function quietSpot(e){
  if(e.viv){ const bb = bbox(e.points); return [(bb.x0 + bb.x1) / 2, (bb.y0 + bb.y1) / 2]; }   // behind glass, paths don't matter: the middle of the case
  const far = p => state.paths.reduce((m, q) => Math.min(m, lineDist(p[0], p[1], q.points)), 60);
  let best = null, bd = -1;
  for(const p of cornerNodes(e.points).concat([centroid(e.points)])) if(inPoly(p[0], p[1], e.points)){ const d = far(p); if(d > bd){ bd = d; best = p; } }
  return best;
}
// A swimmer in a pond: the bank just past its nearest edge, to get out and dry off (null if it's not in one)
function bankSpot(h, e){
  const w = waterOf(e).find(w => inPoly(h.x, h.y, w.points)); if(!w) return null;
  const c = centroid(w.points); let q = null;
  for(let i = 0; i < w.points.length; i++){ const r = segProj(h.x, h.y, w.points[i], w.points[(i + 1) % w.points.length]); if(!q || r.d < q.d) q = r; }
  const d = Math.hypot(q.x - c[0], q.y - c[1]) || 1, out = (h.r || 1) * 1.5 + 1;
  return [q.x + (q.x - c[0]) / d * out, q.y + (q.y - c[1]) / d * out];
}
// Where the act takes it, or null to stay where it is
function actGoal(h, e, a){
  const land = landOf(e).filter(f => LAND[f.type]), of = k => land.filter(f => LAND[f.type][k]);
  const sr = shelterRun.get(a.id); if(sr && !sr.in && land.includes(sr.f)) return featSpot(h, sr.f, true);   // on its way into the shelter it was given a place in
  switch(a.act){
    case "eat": {
      const t = trays(e).filter(f => trayHas(f) > 0);
      return t.length ? featSpot(h, nearestTo(h, t, f => [f.x, f.y])) : gateSpot(e);
    }
    case "drink": {
      const ws = waterOf(e);
      if(!ws.length) return gateSpot(e);
      const w = nearestTo(h, ws, w => centroid(w.points)), v = nearestTo(h, w.points), c = centroid(w.points);
      if(!swims(SPECIES_BY_ID[a.sp])){   // land animals drink from the bank: the nearest edge, one body back toward them
        let q = null; for(let i = 0; i < w.points.length; i++){ const r = segProj(h.x, h.y, w.points[i], w.points[(i + 1) % w.points.length]); if(!q || r.d < q.d) q = r; }
        const d = Math.hypot(h.x - q.x, h.y - q.y) || 1, back = (h.r || 1) + .6;
        return [q.x + (h.x - q.x) / d * back, q.y + (h.y - q.y) / d * back];
      }
      return [v[0] + (c[0] - v[0]) * .25, v[1] + (c[1] - v[1]) * .25];   // a step into the shallows
    }
    case "rest": {
      const f = nearestTo(h, of("slots").concat(of("flora")), f => [f.x, f.y]);
      return f ? featSpot(h, f, !!LAND[f.type].slots) : bankSpot(h, e);   // with no shelter it rests on the bank, not afloat
    }
    case "hide": {
      const cover = of("hide").length ? of("hide") : of("slots").length ? of("slots") : of("flora").length ? of("flora") : of("cover");
      if(!cover.length) return quietSpot(e);
      const far = f => state.paths.reduce((m, q) => Math.min(m, lineDist(f.x, f.y, q.points)), 60);
      const f = cover.slice().sort((x, y) => far(y) - far(x))[0];
      return featSpot(h, f, !!LAND[f.type].slots);
    }
    case "forage": {
      // plant eaters browse groves and hay; bug eaters work the insect logs
      const s = SPECIES_BY_ID[a.sp], f = pickOne(of("flora").concat(eats(s, "herbivore") ? of(foodType(s) === "paleoflora" ? "paleo" : "hay") : [], land.filter(f => f.type === "buglog" && toyFor(LAND[f.type], s) > 0)));
      return f ? featSpot(h, f) : null;
    }
    case "hunt": {
      // prey in the exhibit: stalk the nearest one, stopping a body short
      const s = SPECIES_BY_ID[a.sp]; let prey = null, bd = Infinity;
      for(const o of herd.values()) if(o !== h && o.exhibitId === h.exhibitId && o.placed && huntDriven(a) && attackReason(s, SPECIES_BY_ID[o.sp])){ const d = Math.hypot(o.x - h.x, o.y - h.y); if(d < bd){ bd = d; prey = o; } }
      if(prey){ const r = (h.r || 1) + (prey.r || 1), dx = h.x - prey.x, dy = h.y - prey.y, d = Math.hypot(dx, dy) || 1; return d <= r ? null : [prey.x + dx / d * r, prey.y + dy / d * r]; }
      const f = pickOne(land.filter(f => LAND[f.type].look === "ice" && toyFor(LAND[f.type], s) > 0)); return f && Math.random() < .5 ? featSpot(h, f) : null;
    }
    case "play": { const s = SPECIES_BY_ID[a.sp], ws = waterOf(e); if(swims(s) && ws.length && Math.random() < .6) return centroid(pickOne(ws).points); const f = pickOne(land.filter(f => toyFor(LAND[f.type], s) > 0).concat(of("cover"))); return f && Math.random() < .7 ? featSpot(h, f) : null; }
    case "social": {
      let mate = null, bd = Infinity;
      for(const o of herd.values()) if(o !== h && o.exhibitId === h.exhibitId && o.sp === h.sp){ const d = Math.hypot(o.x - h.x, o.y - h.y); if(d < bd){ bd = d; mate = o; } }
      if(!mate) return null;
      const r = (h.r || 1) * 2.5, dx = h.x - mate.x, dy = h.y - mate.y, d = Math.hypot(dx, dy) || 1;
      return [mate.x + dx / d * r, mate.y + dy / d * r];
    }
  }
  return null;
}
// Pacing: back and forth along a short beat just inside the nearest stretch of fence
function paceRoute(h, e){
  const pts = e.points, A = walkArea(h, e), inset = e.viv ? .4 : (h.r || 1) + 1.5;
  let best = null;
  for(let i = 0; i < pts.length; i++){ const a = pts[i], b = pts[(i + 1) % pts.length], q = segProj(h.x, h.y, a, b); if(!best || q.d < best.q.d) best = {a, b, q}; }
  const {a, b, q} = best, L = dist(a, b) || 1, ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L;
  let nx = -uy, ny = ux;
  if(!inPoly(q.x + nx * inset, q.y + ny * inset, pts)){ nx = -nx; ny = -ny; }
  const beat = Math.min(clamp(L * .4, e.viv ? 1 : 3, 14), Math.max(0, L - inset * 2)), t0 = clamp(q.t * L - beat / 2, inset, Math.max(inset, L - beat - inset));
  const p1 = [a[0] + ux * t0 + nx * inset, a[1] + uy * t0 + ny * inset], p2 = [p1[0] + ux * beat, p1[1] + uy * beat];
  if(!inPoly(p1[0], p1[1], pts) || inObstacle(p1, A) || inObstacle(p2, A) || !walkClear(p1, p2, A)) return null;
  const to = walkRoute([h.x, h.y], p1, A);
  return to ? to.concat([p2, p1, p2, p1, p2, p1]) : null;
}
// Patrolling: a lap of the fence line, from the nearest corner
function patrolRoute(h, e){
  const A = walkArea(h, e), nodes = cornerNodes(e.points, A.m).filter(p => !inObstacle(p, A)); if(nodes.length < 3) return null;
  // a lap carries on from the corner it last reached (patrols get cut short by the next act, and always starting at the nearest corner would keep it round one end)
  const w = h.wp ? nodes.findIndex(n => Math.hypot(n[0] - h.wp[0], n[1] - h.wp[1]) < .5) : -1, i0 = w >= 0 ? (w + 1) % nodes.length : nodes.indexOf(nearestTo(h, nodes)), out = [];
  let at = [h.x, h.y];
  for(let k = 0; k <= nodes.length; k++){ const n = nodes[(i0 + k) % nodes.length], r = walkRoute(at, n, A); if(!r) break; out.push(...r); at = n; }
  return out.length ? out : null;
}
function animalPlan(h, e){
  const a = h.a;
  if(!a || !a.act){ animalWander(h, e); return; }
  h.key = JSON.stringify(e.points); h.path = [];
  if(!inPoly(h.x, h.y, e.points)){ [h.x, h.y] = randomInside(e.points); }
  if(!e.viv && wadeOut(h, e)) return;
  if(a.act === "pace"){ const r = paceRoute(h, e); if(r){ h.path = r; return; } }
  if(a.act === "patrol"){ const r = patrolRoute(h, e); if(r){ h.path = r; return; } }
  // only a barn is walked into (featSpot sends it to the middle); every other spot steps clear of rocks and trees
  const A = walkArea(h, e), aim = actGoal(h, e, a), barn = aim && landOf(e).some(f => LAND[f.type] && LAND[f.type].slots && !LAND[f.type].look && dist(aim, [f.x, f.y]) < .01);
  const goal = aim && offFence(aim, A, !barn);
  if(goal){
    if(Math.hypot(goal[0] - h.x, goal[1] - h.y) < .5) return;
    const r = inPoly(goal[0], goal[1], e.points) && walkRoute([h.x, h.y], goal, A);
    if(r){ h.path = r; return; }
  }
  // nothing to head for: settle where it is, or mill about
  if(!ACT_STAYS.has(a.act)) animalWander(h, e);
}

// A vivarium animal doesn't walk: on a new act it jumps to the spot that act uses (its dish, the water, a hide or plant), or back to its home spot if the act has none
function vivJump(h, e){
  if(!h.a) return;
  if(!h.home) h.home = [h.x, h.y];   // the spot it first appeared at
  if(!vivSpot(h, e, h.home)) h.home = vivMidSpot(h, e) || vivPull(h, e, h.home) || centroid(e.points);
  const g = actGoal(h, e, h.a), spot = g && vivSpot(h, e, g) ? g : g && vivPull(h, e, g);
  [h.x, h.y] = vivClear(h, e, spot || h.home);   // and not on top of another animal
  h.el.setAttribute("transform", `translate(${h.x.toFixed(2)} ${h.y.toFixed(2)})${animalUp(h)}`);
  place34(h);
}
// p moved toward the middle of the case until the animal's picture fits there, or null
function vivPull(h, e, p){
  const [cx, cy] = centroid(e.points);
  for(let f = 1; f >= 0; f -= .1){ const q = [cx + (p[0] - cx) * f, cy + (p[1] - cy) * f]; if(vivSpot(h, e, q)) return q; }
  return null;
}

// swimmers in a pond get a `swimming` flag and class, for a swim picture to hook onto (a species with a swim strip draws it in place of its walk picture or rig)
function swimCheck(h, e){
  if(h.swim === undefined && !swims(SPECIES_BY_ID[h.sp])) return;
  const sw = waterOf(e).some(w => inPoly(h.x, h.y, w.points));
  if(sw === !!h.swim) return;
  h.swim = sw; h.el.classList.toggle("swimming", sw);
  const g = h.el.querySelector(".spr");
  if(g && ((SPRITES[h.sp] && SPRITES[h.sp].swim) || rigSwims(h.sp))){ h.pose = null; g.outerHTML = spriteSvg(h.sp, h); }
}

function animateAnimals(dt){
  for(const h of herd.values()){
    const e = state.exhibits.find(x => x.id === h.exhibitId); if(!e) continue;
    // an animal heading for a shelter goes in the moment it gets there; one inside isn't drawn or moved, and walks back out when it comes out
    const run = h.a && shelterRun.get(h.a.id); if(run && !run.in) shelterArrive(h.a, run);
    const ins = !!(h.a && h.a.inside);
    if(ins !== !!h.ins){ h.ins = ins; h.el.style.display = ins ? "none" : ""; if(!ins){ h.path = null; h.wait = 0; } }
    if(ins) continue;
    if(!e.viv && !h.pool) swimCheck(h, e);   // in a pond or not, even if it never moves (it may be napping where it spawned)
    // a clip that has started (the idle one, lying down) finishes first, whatever the animal's AI now wants, then it carries on
    if(h.rg && h.rg.lock){ if(h.spr && rigOf(h.sp) && h.el.querySelector(".rig")){ rigStep(h, h.rg.mode); continue; } h.rg.lock = false; }
    const act = h.a && h.a.act;
    // a new act: drop what it was doing and head off at once
    if(act !== h.act){ h.act = act; h.path = null; h.restAt = null; h.wait = Math.min(h.wait, Math.random() * .6); if(e.viv && !e.aqua && !h.swimmer) vivJump(h, e); }
    // vivarium animals don't walk: they jump on a new act (vivJump) and play their rig, or cycle an idle strip if their picture has one (else the standing picture or dot)
    if(e.aqua || h.swimmer){ aquaSwim(h, e, dt); continue; }
    if(h.pool){ poolSwim(h, e, dt); continue; }
    if(e.viv){
      const S = SPRITES[h.sp];
      if(h.spr && rigOf(h.sp)) rigStep(h, act === "rest" ? "rest" : "idle");   // a rig plays its stand loop and idle clips here like in the park
      else if(h.spr && S && S.idle) setPose(h, idleFrame(h, S));
      continue;
    }
    // an open-exhibit picture with an idle strip but no walk strip cycles the idle strip all the time, still or moving
    const S = SPRITES[h.sp], idleOnly = h.spr && S && !S.walk && S.idle && !rigOf(h.sp), idleOnlyFrame = () => setPose(h, idleFrame(h, S));
    if(h.wait > 0){ h.wait -= dt; if(swimmingPic(h)) setPose(h, swimFrame(h, S)); else if(idleOnly) idleOnlyFrame(); else if(h.spr && rigOf(h.sp)) rigStep(h, act === "rest" ? "rest" : "idle"); else setPose(h, restPose(h, S)); continue; }
    if(!h.path || h.key !== JSON.stringify(e.points)) animalPlan(h, e);   // new animal, new act, or the exhibit was reshaped
    // once there, eating, drinking, resting and hiding animals stay put until the act changes; the rest look around, then move on
    const stay = ACT_STAYS.has(act), idle = act === "pace" ? 0 : act === "play" ? .3 + Math.random() * .8 : act === "social" ? 1.5 + Math.random() * 2 : 1 + Math.random() * 3;
    if(!h.path.length){ h.wait = stay ? 4 + Math.random() * 4 : idle; if(!stay) h.path = null; continue; }
    const [tx, ty] = h.path[0], dx = tx - h.x, dy = ty - h.y, d = Math.hypot(dx, dy);
    if(d < .3){ h.wp = h.path.shift(); if(!h.path.length){ h.wait = stay ? 4 + Math.random() * 4 : idle; if(!stay) h.path = null; } continue; }
    const step = Math.min(d, h.spd * 3 * (ACT_GAIT[act] || 1) * ((SPRITES[h.sp] || {}).pace || 1) * (h.a && h.a.sick ? sickBand(h.a).gait : 1) * disFx(h.a, "gait") * dt);
    const px = h.x, py = h.y;
    h.x += dx/d * step; h.y += dy/d * step;
    // last line of defence: a land animal never takes a step into the water (one already in it may keep wading out)
    if(landWet(h, e, h.x, h.y) && !landWet(h, e, px, py)){ h.x = px; h.y = py; h.path = null; h.wait = .5; continue; }
    swimCheck(h, e);
    // pictures face the way they walk, and step a frame every half a body's width, so the feet keep pace with the ground
    if(swimmingPic(h)){ h.stride = (h.stride || 0) + step; setPose(h, Math.floor(h.stride / (h.r * (S.step || .5))) % S.swim); }
    else if(idleOnly) idleOnlyFrame();
    else if(h.spr && rigOf(h.sp)){ h.stride = (h.stride || 0) + step; rigStep(h, "walk"); }
    else if(S && S.walk){ h.stride = (h.stride || 0) + step; setPose(h, Math.floor(h.stride / (h.r * (S.step || .5))) % S.walk); }
    if(Math.abs(dx) > .05){ const face = dx > 0 ? 1 : -1; if(face !== h.face){ h.face = face; const g = h.el.querySelector(".spr"); if(g) g.setAttribute("transform", `scale(${face} 1)`); } }
    h.el.setAttribute("transform", `translate(${h.x.toFixed(2)} ${h.y.toFixed(2)})${animalUp(h)}`);
    if(tilt) place34(h);
  }
}

/* ---------- guests walking the paths ---------- */
// A party is a dot in its primary personality's color (or its mood's, when that's switched on)
const PERS_KEYS = Object.keys(PERSONALITIES), PERS_INDEX = Object.fromEntries(PERS_KEYS.map((k, i) => [k, i]));
const SHIRTS = PERS_KEYS.map(k => PERSONALITIES[k].color);
const MOOD_SHIRTS = ["#3E9B4F", "#E3B23C", "#D9483B"];   // happy, so-so, unhappy
const shirtPaths = SHIRTS.map(c => {
  const el = document.createElementNS("http://www.w3.org/2000/svg", "path");
  el.setAttribute("stroke", c); el.setAttribute("stroke-width", "6.5"); el.setAttribute("stroke-linecap", "round");
  el.setAttribute("vector-effect", "non-scaling-stroke"); el.setAttribute("fill", "none");
  guestLayer.appendChild(el); return el;
});
const outline = document.createElementNS("http://www.w3.org/2000/svg", "path");
outline.setAttribute("stroke", "#1D2B22"); outline.setAttribute("stroke-width", "8.5"); outline.setAttribute("stroke-linecap", "round");
outline.setAttribute("vector-effect", "non-scaling-stroke"); outline.setAttribute("fill", "none"); outline.setAttribute("stroke-opacity", ".55");
guestLayer.insertBefore(outline, guestLayer.firstChild);

// A ring around the party whose panel is open
const guestRing = document.createElementNS("http://www.w3.org/2000/svg", "g");
guestRing.setAttribute("pointer-events", "none"); guestRing.style.display = "none";
guestRing.innerHTML = `<circle r="8" fill="none" stroke="#fff" stroke-width="3" vector-effect="non-scaling-stroke"/><circle r="8" fill="none" stroke="#1D2B22" stroke-width="1.2" vector-effect="non-scaling-stroke"/>`;
guestLayer.appendChild(guestRing);

const nodeKey = p => Math.round(p[0]*4) + ":" + Math.round(p[1]*4);

// Parties walk off to one side of the path. Ones standing in a queue bunch up around the spot.
function partyPos(p){
  if(p.to){
    const dx = p.to.x - p.at.x, dy = p.to.y - p.at.y, L = Math.hypot(dx, dy) || 1;
    return [p.at.x + dx*p.t + (p.ox || 0), p.at.y + dy*p.t + (p.oy || 0)];
  }
  return [p.at.x + (p.ox || 0), p.at.y + (p.oy || 0)];
}
// Zoomed in (a guest at least GUEST_SPRITE_PX tall on screen) each party is a pixel guest from HUMAN_SPRITES.guest, with a pip under its feet in the dot's color; zoomed out it's a dot
const GUEST_SPRITE_PX = 10, GUEST_KINDS = ["guest", "guest2", "guest3", "guest4", "guest5"], guestKind = p => GUEST_KINDS[[...String(p.id)].reduce((h, c) => h + c.charCodeAt(0), 0) % GUEST_KINDS.length], guestEls = new Map();
let guestClipN = 0;
// A party up on a viewing platform is drawn at deck height, rising up the steps (the deck is outside its footprint by the steps' run)
function deckLift(p, x, y){
  const b = p.deckB;
  if(!b || !b.points || b.type === "gallery") return 0;
  if(inPoly(x, y, b.points)) return DECK.h;
  return DECK.h * clamp(1 - distToEdge(x, y, b.points) / (DECK.step * DECK.steps), 0, 1);
}
function drawParties(){
  const cols = moodColors ? MOOD_SHIRTS : SHIRTS, d = SHIRTS.map(() => []), all = [];
  const spr = HUMAN_SPRITES.h * view.k >= GUEST_SPRITE_PX, seen = new Set(), hm = HUMAN_SPRITES.h;
  for(const p of parties){
    if(!p.at) continue;
    const [x, y] = partyPos(p);
    if(hidden34(x, y)) continue;
    if(p.deckB && p.deckB.type === "gallery" && inPoly(x, y, p.deckB.points)) continue;   // inside a viewing gallery, under its roof
    const ci = moodColors ? (p.mood >= 60 ? 0 : p.mood >= 35 ? 1 : 2) : PERS_INDEX[p.pers[0]] || 0;
    if(spr){
      let el = guestEls.get(p.id);
      if(!el){
        el = document.createElementNS("http://www.w3.org/2000/svg", "g"); el.setAttribute("pointer-events", "none");
        el.innerHTML = `<ellipse class="gpip" rx="1" ry=".45" fill="#fff" opacity=".8"/>` + humanSvg(guestKind(p), hm, null);
        el._cid = "gcl" + guestEls.size + "-" + (guestClipN++);
        el.insertAdjacentHTML("beforeend", `<clipPath id="${el._cid}"><rect x="-9" width="18"/></clipPath>`);
        guestLayer.insertBefore(el, guestRing); guestEls.set(p.id, el);
      }
      // behind a solid far fence: only what's above the fence's top edge shows
      const cut = wallCut34(x, y);
      if(cut === null){ if(el._cut != null) el.removeAttribute("clip-path"); el._cut = null; }
      else{
        const lc = (cut - y + deckLift(p, x, y) / TILT) * TILT;   // the cut's height on the guest, feet at 0 and up negative
        if(el._cut !== lc){
          el._cut = lc; const r = el.querySelector("clipPath rect"); r.setAttribute("y", -hm * 2); r.setAttribute("height", Math.max(0, lc + hm * 2));
          el.setAttribute("clip-path", `url(#${el._cid})`);
        }
      }
      const col = cols[ci] || SHIRTS[ci];
      if(el._gc !== col){ el._gc = col; el.firstChild.setAttribute("fill", col); }
      humanStep(el, guestKind(p), {}, x, y); walker34(el, x, y - deckLift(p, x, y) / TILT); seen.add(p.id);
      continue;
    }
    const m = `M${x.toFixed(2)} ${y.toFixed(2)}h0.001`;
    d[ci].push(m); all.push(m);
  }
  for(const [id, el] of guestEls) if(!seen.has(id)){ el.remove(); guestEls.delete(id); }
  shirtPaths.forEach((el, i) => { el.setAttribute("stroke", cols[i] || SHIRTS[i]); el.setAttribute("d", d[i].join("")); });
  outline.setAttribute("d", all.join(""));
  const sp = sel && sel.kind === "guest" ? parties.find(q => q.id === sel.id) : null, at = sp && sp.at ? partyPos(sp) : null;
  if(at && !hidden34(at[0], at[1])){ guestRing.style.display = ""; guestRing.setAttribute("transform", `translate(${at[0].toFixed(2)} ${(at[1] - deckLift(sp, at[0], at[1]) / TILT).toFixed(2)})${upright()}`); }
  else guestRing.style.display = "none";
}
// The party under a tap or click, if there is one (they're drawn as dots, so this is by distance on screen)
function guestAt(cx, cy){
  const w = toWorld(cx, cy);
  let best = null, bd = 14;
  for(const p of parties){
    if(!p.at) continue;
    const [x, y] = partyPos(p), d = Math.hypot((x - w.x) * view.k, (y - deckLift(p, x, y) / TILT - w.y) * ky());
    if(d < bd && !hidden34(x, y)){ bd = d; best = p; }
  }
  return best;
}

/* ---------- trams: one car shuttles between the end stations of each stretch of track ---------- */
const tramEls = new Map();
function drawTrams(){
  const layer = $("#tramLayer"), seen = new Set();
  for(const p of state.paths){
    if(!isTram(p) || !gGraph) continue;
    const {cum, stops} = tramStops(p);
    if(stops.length < 2) continue;
    const a = Math.min(...stops), z = Math.max(...stops), v = WALK_PER_MIN * TRAM.speedMult, run = (z - a) / v, dwell = 1.5, T = 2 * (run + dwell);
    const ph = state.minute % T, s = ph < run ? a + v * ph : ph < run + dwell ? z : ph < 2 * run + dwell ? z - v * (ph - run - dwell) : a;
    let i = 1; while(i < cum.length - 1 && cum[i] < s) i++;
    const f = (s - cum[i-1]) / ((cum[i] - cum[i-1]) || 1), A = p.points[i-1], B = p.points[i];
    const x = A[0] + (B[0] - A[0]) * f, y = A[1] + (B[1] - A[1]) * f, ang = Math.atan2(B[1] - A[1], B[0] - A[0]) * 180 / Math.PI;
    let el = tramEls.get(p.id);
    if(!el){
      el = document.createElementNS("http://www.w3.org/2000/svg", "g"); el.setAttribute("pointer-events", "none");
      el.innerHTML = `<rect x="-4" y="-1.3" width="8" height="2.6" rx=".8" fill="#B5533C" stroke="#1D2B22" stroke-width=".35"/><rect x="-3.2" y="-.8" width="6.4" height="1.6" rx=".4" fill="#F1E6C8"/><rect x="2.4" y="-1" width="1.2" height="2" rx=".3" fill="#2F4A5C"/>`;
      layer.appendChild(el); tramEls.set(p.id, el);
    }
    el.setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${ang.toFixed(1)})`);
    seen.add(p.id);
  }
  for(const [id, el] of tramEls) if(!seen.has(id)){ el.remove(); tramEls.delete(id); }
}

/* ---------- snapping new corners to things nearby ---------- */
function toWorld(cx, cy){ const r = svg.getBoundingClientRect(); return {x:(cx - r.left - view.tx)/view.k, y:(cy - r.top - view.ty)/ky()}; }

function snapAt(clientX, clientY, ev){
  const p = toWorld(clientX, clientY);
  // water stays clear of fences and paths, so it only snaps to the grid
  const R = 12 / view.k;
  // drawing a path: anywhere on another path's body snaps onto its centerline, so the two actually join
  // tram track only ever joins other tram track, and nothing else snaps to it
  const snapPaths = state.paths.filter(q => isTram(q) === !!(draw && draw.kind === "tram"));
  if(draw && ["path", "wide", "service", "tram", "bridge"].includes(draw.kind)){
    let hit = null;
    for(const q of snapPaths) for(let i = 1; i < q.points.length; i++){
      const r = segProj(p.x, p.y, q.points[i-1], q.points[i]);
      if(r.d <= Math.max(halfWidth(q), R * .8) && !snapPaths.some(o => o.points.some(v => Math.hypot(p.x - v[0], p.y - v[1]) < R)) && (!hit || r.d < hit.d)) hit = {x:r.x, y:r.y, d:r.d, id:q.id};
    }
    if(hit) return {x:hit.x, y:hit.y, info:{type:"seg", kind:"path", id:hit.id}};
  }
  let best = null, bd = R;
  const tryV = (v, kind, id) => { const d = Math.hypot(p.x - v[0], p.y - v[1]); if(d < bd){ bd = d; best = {x:v[0], y:v[1], info:{type:"vertex", kind, id}}; } };
  tryV(state.gate, "gate", "gate");
  const edges = ownedEdges();
  for(const [a, c] of edges){ tryV(a, "boundary", "boundary"); tryV(c, "boundary", "boundary"); }
  for(const q of snapPaths) q.points.forEach(v => tryV(v, "path", q.id));
  for(const q of state.exhibits) q.points.forEach(v => tryV(v, "exhibit", q.id));
  if(best) return best;
  // otherwise land on the nearest grid point (and still join a path if that point sits on one)
  const g = [Math.round(p.x / GRID_STEP) * GRID_STEP, Math.round(p.y / GRID_STEP) * GRID_STEP];
  let info = {type:"grid"};
  for(const q of snapPaths) for(let i = 1; i < q.points.length; i++)
    if(segProj(g[0], g[1], q.points[i-1], q.points[i]).d < .05) info = {type:"seg", kind:"path", id:q.id};
  return {x:g[0], y:g[1], info};
}

// When a new path lands in the middle of another path, add a shared corner there so they really join
function insertJunction(pathId, x, y){
  const q = findItem("path", pathId); if(!q) return;
  if(q.points.some(v => Math.hypot(v[0]-x, v[1]-y) < .05)) return;
  for(let i = 0; i < q.points.length - 1; i++){
    if(segProj(x, y, q.points[i], q.points[i+1]).d < .05){ q.points.splice(i+1, 0, [x, y]); return; }
  }
}

/* ---------- checking whether something can be built ---------- */
// Everything must sit on land you own, edges included (a shape can't cut across a plot you haven't bought)
function insidePlot(pts, closed){
  if(!pts.every(p => inOwned(p[0], p[1]))) return false;
  const n = pts.length;
  for(let i = 0; i < (closed ? n : n - 1); i++){
    const a = pts[i], c = pts[(i+1) % n], steps = Math.ceil(Math.hypot(c[0]-a[0], c[1]-a[1]) / 2);
    for(let k = 1; k < steps; k++) if(!inOwned(a[0] + (c[0]-a[0])*k/steps, a[1] + (c[1]-a[1])*k/steps)) return false;
  }
  return true;
}

function pathProblem(pts, type){
  if(type === "tram" && !devMode()) return "That isn't available yet.";
  if(type === "tram" && !hasTech("transit")) return `Research ${TECH.find(x => x.id === "transit").label.toLowerCase()} at the Research Lab first.`;
  if(pts.length < 2) return "Needs at least 2 points.";
  if(lineLength(pts) < 2) return "Too short.";
  if(!insidePlot(pts)) return "Keep it inside the park boundary.";
  if(state.exhibits.some(e => lineEntersShape(pts, e.points))) return "Paths can't go through an exhibit.";
  if(state.buildings.some(b => !BUILDINGS[b.type].onPath && lineEntersShape(pts, b.points))) return "Paths can't go through a building.";
  const hit = lineHitsLandscape(pts, halfWidth({type}), type === "bridge"); if(hit) return hit;
  const cost = pathCost(pts, type);
  if(!canAfford(cost)) return `Costs ${money(cost)}. You have ${money(state.money)}.`;
  return null;
}

/* ---------- drawing exhibits and paths ---------- */
const DRAW_TEXT = {
  zone:["New work zone", "Tap to drop corners around the exhibits and stores you want to group. Tap the first corner again to close it. Things inside join the zone."],
  tram:["New tram track", "Guests ride it between tram stations. Draw it alongside your footpaths, then build a Tram station beside the track and a footpath at each stop. Tap the last point again to finish."],
};
const drawType = () => draw && draw.kind === "tram" ? draw.kind : undefined;

function setTool(t){
  if(tool === "zoneedit" && zedit){ const z = zoneById(zedit.id); if(z && !zedit.done) z.points = zedit.orig; zedit = null; }
  if(draw) endDraw();
  ghost = null; hoverItem = null; snapMark = null; pdrag = null; wdrag = null; fdrag = null; cdrag = null; chover = null; fhover = null; gateGhost = null; landGhost = null; crateGhost = null; rockBiome = null; rot = 0; lastPtr = null; mvSel = null;
  tool = t;
  const fam = familyOf(t);
  document.querySelectorAll("[data-tool]").forEach(b => b.setAttribute("aria-pressed", b.dataset.tool === t || b.dataset.tool === fam));
  document.querySelectorAll("[data-fence]").forEach(b => b.setAttribute("aria-pressed", t === "exhibit" && b.dataset.fence === fenceSel));
  $("#dSizes").hidden = !fam;
  if(fam){
    $("#dSizes").innerHTML = FAMILIES[fam].tools.map((x, i) => `<button data-pick="${x}" aria-pressed="${x === t}">${FAMILIES[fam].labels[i]}</button>`).join("");
  }
  if(t === "paint"){ paintBar(); }
  if(t === "water"){ waterBar(); }
  pressPicks();
  const nSz = $("#dSizes").children.length;   // long lists (biomes) go in an even grid of at most 5 columns
  $("#dSizes").classList.toggle("grid", nSz > 5); $("#dSizes").style.setProperty("--cols", Math.ceil(nSz / Math.ceil(nSz / 5)));
  mapwrap.className = "mapwrap tool-" + t;
  if(isDrawTool(t)) startDraw(t);
  else if(t === "exhibit") fenceBar();
  else if(isPathTool(t)) pathBar();
  else if(t === "platform") showBar("Place a viewing platform", "Tap an exhibit's fence beside a guest path. The deck snaps to the edge and juts out over the animals.", `${money(BUILDINGS.platform.price)} each, ${money(BUILDINGS.platform.upkeep)} a day`, {undo:false, finish:false, cancel:"Done"});
  else if(t === "gallery") showBar("Place a viewing gallery", "Tap a pool's fence beside a guest path. The gallery stands outside it, its glass against the water.", `${money(BUILDINGS.gallery.price)} each, ${money(BUILDINGS.gallery.upkeep)} a day`, {undo:false, finish:false, cancel:"Done"});
  else if(t === "uncrate" && (crateMode === "deliver" || crateMode === "ward" || crateMode === "move")){ const r = crateRecord(); showBar(r ? `${crateMode === "move" ? "Move" : "Deliver"} the ${SPECIES_BY_ID[r.sp].name}` : "Deliver a specimen", "Tap the exhibit it goes to.", r ? esc(r.name || "") : "", {undo:false, finish:false, cancel:"Cancel"}); }
  else if(t === "uncrate"){ const r = crates().find(x => x.id === crateSel); showBar(r ? `Place the ${SPECIES_BY_ID[r.sp].name}` : "Place a crate", "Tap an exhibit to open the crate there, or open ground to set it down.", r ? esc(r.name || "") : "", {undo:false, finish:false, cancel:"Cancel"}); }
  else if(landKey(t)){
    const L = LAND[landKey(t)];
    showBar(`Place ${L.one}`, L.statue ? `Tap anywhere out in the park, clear of paths and fences. Guests stop to look${L.initials ? ", and learn a lot from the plaque" : ""}.${L.text ? " " + L.text : ""}`
      : L.slots || L.tray ? "Tap inside an open exhibit, clear of any water. Barns, caves and canopies shelter the animals from bad weather."
      : "Tap inside an open exhibit for the animals, or out in the park beside a path to cheer up the guests walking past. Animals feel at home among water, rocks and plants from their own period and biome.",
      `${money(L.price)} each`, {undo:false, finish:false, cancel:"Done"});
  }
  else if(isBuildTool(t)){
    const b = BUILDINGS[t];
    const fits = b.viv ? SPECIES.filter(s => s.viv && !!s.aqua === !!b.aqua && vivRank(s.viv) <= vivRank(b.viv) && speciesAvailable(s.id)).map(s => s.name) : [];
    const free = " Place it anywhere clear of paths, but it only works once a path reaches it.", spin = " Rotate turns it 90° (R).";
    showBar(`Place ${b.one}`, b.dept ? `Backstage building${b.unique ? ", one per park" : ""}. Tap beside a ${b.serviceOnly ? "service road" : "path or service road"}. It snaps to the 1 m grid.${free}${spin}`
      : b.viv ? `${VIVARIUMS[b.viv].w} × ${VIVARIUMS[b.viv].d} m.${b.aqua ? " Needs a filter, which runs on power." : ""} Fits ${fits.join(", ")}.${free}${spin}`
      : b.tram ? `Tap beside a footpath, with tram track running alongside the far side. Guests walk to it from the path and ride from here.${spin}`
      : b.kind ? `Tap it after placing to choose what it sells. Room for ${b.menuSlots} item${b.menuSlots === 1 ? "" : "s"}.${free}${spin}`
      : b.type === "lamp" ? `Tap anywhere on a path. After dark it lights about ${LAMP.radius} m around it: guests feel safe on lit paths, and vandals and cameras notice it.${spin}`
      : b.onPath ? `Tap anywhere on a path. It faces the nearest fence or path edge.${spin}`
      : `Tap beside a path. It snaps to the 1 m grid.${free}${spin}`,
      `${money(b.price)}${b.dept ? "" : " each"}, ${money(b.upkeep)} a day to run`, {undo:true, finish:false, cancel:"Done", undoText:"Rotate"});
  }
  else if(t === "zoneedit" && zedit){
    showBar("Reshape zone", "Drag a corner to move it. Drag a + on an edge to add a corner. Tap a corner, then Delete corner to remove it.", "", {undo:true, finish:true, cancel:"Cancel", undoText:"Delete corner", finishText:"Done"});
    updateZoneEditBar();
  }
  else if(t === "paint" || t === "water"){}
  else if(t === "parcels"){ parcelSel = null; fit(); updateParcelBar(); }
  else if(t === "gate") showBar("Place a keeper gate", "Tap a closed pen's fence to make it an exhibit, or an exhibit's fence where a path or service road meets it. One gate per exhibit; tapping again moves it.", `${money(GATE_COST)} each`, {undo:false, finish:false, cancel:"Done"});
  else if(t === "move"){
    mvCorner = null;
    showBar("Move", "", "", {undo:true, finish:true, cancel:"Done", undoText:"Delete corner", finishText:"Rotate"});
    updateMoveBar();
  }
  else if(t === "bulldoze") showBar("Bulldoze", "", "", {undo:false, finish:false, cancel:"Done"});
  else hideBar();
  render();
}

function showBar(title, hint, stat, o){
  $("#dTitle").textContent = title; $("#dHint").textContent = hint; setStat(stat);
  $("#dUndo").textContent = o.undoText || "Undo point"; $("#dFinish").textContent = o.finishText || "Build";
  $("#dUndo").hidden = !o.undo; $("#dFinish").hidden = !o.finish; $("#dCancel").textContent = o.cancel || "Cancel";
  $("#drawbar").classList.add("on");
}
function hideBar(){ $("#drawbar").classList.remove("on"); }
function setStat(t, err){ const el = $("#dStat"); el.textContent = t; el.classList.toggle("err", !!err); }

function startDraw(kind){
  draw = {kind, pts:[], snaps:[], hover:null, error:null};
  sel = null; ui.panel();
  const [t, hint] = DRAW_TEXT[kind];
  showBar(t, hint, "", {undo:true, finish:true, cancel:"Cancel"});
  updateDrawbar();
  if(kind === "tram" && !devMode()) setStat("That isn't available yet.", true);
  else if(kind === "tram" && !hasTech("transit")) setStat(`Research ${TECH.find(x => x.id === "transit").label.toLowerCase()} at the Research Lab first.`, true);
}

function drawPoints(){ return draw.hover ? draw.pts.concat([draw.hover]) : draw.pts; }

function updateDrawbar(){
  if(!draw) return;
  const all = drawPoints();
  let stat = "", err = null;
  if(draw.kind === "zone"){
    if(all.length >= 3){ stat = `${fmtArea(area(all))}. Free`; err = zoneProblem(all); }
  } else if(all.length >= 2){
    stat = `${Math.round(lineLength(all))} m. ${money(pathCost(all, drawType()))}`; err = pathProblem(all, drawType());
  }
  draw.error = err;
  setStat(err || stat, !!err);
  $("#dUndo").disabled = !draw.pts.length;
  const ready = draw.kind === "zone" ? !zoneProblem(draw.pts) : draw.pts.length >= 2 && !pathProblem(draw.pts, drawType());
  $("#dFinish").disabled = !ready;
}

function endDraw(){ draw = null; snapMark = null; hideBar(); }
// Zone reshaping: corners are dragged, and a + on each edge adds a corner
function zoneHandleAt(clientX, clientY){
  const z = zedit && zoneById(zedit.id); if(!z) return null;
  const p = toWorld(clientX, clientY), R = 14 / view.k;
  for(let i = 0; i < z.points.length; i++) if(Math.hypot(p.x - z.points[i][0], p.y - z.points[i][1]) < R) return {type:"v", i};
  for(let i = 0; i < z.points.length; i++){ const a = z.points[i], b = z.points[(i + 1) % z.points.length]; if(Math.hypot(p.x - (a[0] + b[0]) / 2, p.y - (a[1] + b[1]) / 2) < R) return {type:"m", i}; }
  return null;
}
function updateZoneEditBar(){
  const z = zedit && zoneById(zedit.id); if(!z) return;
  $("#dUndo").disabled = zedit.sel == null || z.points.length <= 3; $("#dFinish").disabled = false;
  setStat(`${z.name}: ${fmtArea(area(z.points))}, ${z.points.length} corners`);
  renderOverlay();
}
function deleteZoneCorner(){
  const z = zedit && zoneById(zedit.id); if(!z || zedit.sel == null || z.points.length <= 3) return;
  const keep = z.points.map(p => p.slice()); z.points.splice(zedit.sel, 1);
  const why = zoneProblem(z.points);
  if(why){ z.points = keep; setStat(why, true); return; }
  zedit.sel = null; updateZoneEditBar(); render();
}
function finishZoneEdit(){
  const z = zedit && zoneById(zedit.id); if(!z) return;
  const why = zoneProblem(z.points); if(why){ setStat(why, true); return; }
  // anything unassigned that now sits inside joins the zone
  let joined = 0;
  for(const e of state.exhibits) if(!e.zone && inPoly(...centroid(e.points), z.points)){ e.zone = z.id; joined++; }
  for(const b of state.buildings) if(!b.zone && !b.exhibitId && inPoly(...centroid(b.points), z.points)){ b.zone = z.id; joined++; }
  zedit.done = true; const id = z.id;
  afterChange(); toolDone({kind:"zone", id});
  ui.toast(joined ? `${z.name} reshaped. ${joined} more thing${joined === 1 ? "" : "s"} joined it.` : `${z.name} reshaped.`);
}
function startZoneEdit(id){ const z = zoneById(id); if(!z) return; zedit = {id, orig:z.points.map(p => p.slice()), sel:null, done:false}; setTool("zoneedit"); }
function updateParcelBar(){
  if(!parcelSel){ showBar("Buy land", "Tap a green plot to see its price. Plots only go on sale next to land you own.", `${parcelsBought()} plots bought. ${fmtArea(PARCEL_CELLS.filter(([i, j]) => ownsParcel(i, j)).reduce((a, [i, j]) => a + parcelArea(i, j), 0))} owned`, {undo:false, finish:false, cancel:"Done"}); return; }
  const [i, j] = parcelSel, why = parcelProblem(i, j);
  showBar("Buy this plot", `Plot ${parcelsBought() + 1}. ${fmtArea(parcelArea(i, j))} for ${money(parcelPrice(i, j))}. Costs ${money(Math.round(parcelArea(i, j) * UPKEEP.landPerSqM))} a day in property tax.`, why || "", {undo:false, finish:true, cancel:"Done", finishText:"Buy"});
  $("#dFinish").disabled = !!why; setStat(why || "", !!why);
}
function parcelTap(e){
  const p = toWorld(e.clientX, e.clientY);
  const c = SALE_CELLS.find(([i, j]) => { const r = parcelRect(i, j); return p.x >= r[0] && p.x < r[2] && p.y >= r[1] && p.y < r[3]; });
  parcelSel = c && !ownsParcel(c[0], c[1]) ? c : null;
  updateParcelBar(); renderOverlay();
}
function buyLand(){
  if(!parcelSel) return;
  const [i, j] = parcelSel, price = parcelPrice(i, j);
  if(!buyParcel(i, j)){ updateParcelBar(); return; }
  parcelSel = null; recompute(); events.changed(); render(); updateParcelBar();
  ui.toast(`Bought ${fmtArea(parcelArea(i, j))} of land for ${money(price)}.`, "good");
}
function cancelTool(){ setTool("select"); }
function undoDrawPoint(){ if(isBuildTool(tool)){ rotateTool(); return; } if(tool === "exhibit"){ fenceMeet = !fenceMeet; fenceBar(); return; } if(tool === "zoneedit"){ deleteZoneCorner(); return; } if(tool === "move"){ deleteMoveCorner(); return; } if(!draw || !draw.pts.length) return; draw.pts.pop(); draw.snaps.pop(); updateDrawbar(); renderOverlay(); }

function finishDraw(){
  if(tool === "parcels"){ buyLand(); return; }
  if(tool === "zoneedit"){ finishZoneEdit(); return; }
  if(tool === "move"){ rotateMoved(); return; }
  if(!draw) return;
  const d = draw, type = drawType();
  const pts = d.pts.map(p => [p[0], p[1]]);
  const problem = d.kind === "zone" ? zoneProblem(pts) : pathProblem(pts, type);
  if(problem){ setStat(problem, true); return; }
  if(d.kind === "zone"){
    const used = new Set(state.zones.map(x => x.name));
    let n = 1; while(used.has(`Zone ${n}`)) n++;
    const z = {id:uid("z-"), name:`Zone ${n}`, color:ZONE_COLORS[(n - 1) % ZONE_COLORS.length], points:pts};
    state.zones.push(z);
    for(const e of state.exhibits) if(!e.zone && inPoly(...centroid(e.points), pts)) e.zone = z.id;
    for(const b of state.buildings) if(!b.zone && !b.exhibitId && inPoly(...centroid(b.points), pts)) b.zone = z.id;
    afterChange();
    toolDone({kind:"zone", id:z.id});
    const m = zoneMembers(z);
    ui.toast(`${z.name}: ${m.exhibits.length} exhibit${m.exhibits.length === 1 ? "" : "s"} and ${m.stores.length} building${m.stores.length === 1 ? "" : "s"} inside. Assign keepers to it from its panel.`);
    return;
  }
  d.snaps.forEach((sn, i) => { if(sn && sn.kind === "path" && sn.type === "seg") insertJunction(sn.id, pts[i][0], pts[i][1]); });
  const cost = pathCost(pts, type);
  spend(cost, "built");
  const p = {id:uid("p-"), name:type === "service" ? "Service road" : type === "wide" ? "Wide path" : type === "tram" ? "Tram track" : type === "bridge" ? "Wooden bridge" : "Path", points:pts};
  if(type) p.type = type;
  if(type !== "service" && type !== "tram" && type !== "bridge") themeNew("path", p);
  state.paths.push(p);
  afterChange();
  // keep the tool going so you can draw the next one
  startDraw(d.kind);
  render();
  const joinedNow = type === "tram" || (type === "service" ? derived.joinedAll : derived.joined).has(p.id);
  const what = type === "service" ? "service road" : type === "wide" ? "wide path" : type === "tram" ? "tram track" : type === "bridge" ? "wooden bridge" : "path";
  ui.toast(joinedNow ? `Built ${Math.round(lineLength(pts))} m of ${what} for ${money(cost)}.` : `Built a ${what}, but it doesn't reach the entrance yet.`, joinedNow ? "" : "bad");
}

/* ---------- painting ground (js/biomepaint.js) ---------- */
function paintBar(){
  if(!paintPick) paintPick = Object.keys(BIOMES).find(b => b !== parkBiome()) || parkBiome();
  showBar(paintPick === "erase" ? "Erase ground paint" : `Paint ${BIOMES[paintPick].label.toLowerCase()} ground`, "Drag a box to paint it in 5 m chunks, like a path. A tap paints one chunk. New paint covers old paint. Pick Erase and drag or tap to take paint off. Paint ground over water to remove it. Free out in the park. Inside an exhibit (not vivariums) it costs the biome's grading price a m², and the biome with the most ground there becomes the exhibit's biome.", "", {undo:false, finish:false, cancel:"Done"});
}
// The Water and Paint Ground lists in the Landscaping tray show the picked type pressed while that tool is on
function pressPicks(){
  document.querySelectorAll("#sideMenu [data-water]").forEach(b => b.setAttribute("aria-pressed", tool === "water" && b.dataset.water === waterPick));
  document.querySelectorAll("#sideMenu [data-paint]").forEach(b => b.setAttribute("aria-pressed", tool === "paint" && b.dataset.paint === paintPick));
}
function paintDragStat(){
  if(!pdrag) return;
  const r = paintBox(pdrag.a, pdrag.b), w = r[2] - r[0], h = r[3] - r[1];
  const cost = w && h && paintPick !== "erase" ? exhibitPaintCost(r, paintPick) : 0;
  const wet = w && h ? waterCut(r) : {m2:0};
  setStat(w && h ? `${w} × ${h} m, ${fmtArea(w * h)}.${cost ? ` ${money(cost)} for the ground inside exhibits.` : ""}${wet.m2 ? ` Removes ${fmtArea(wet.m2)} of water, ${money(waterCutRefund(wet.worth))} back.` : ""}` : "", cost > 0 && !canAfford(cost));
}
function endPaintDrag(){
  const d = pdrag; pdrag = null; renderOverlay();
  const r = paintBox(d.a, d.b);
  const wetToast = c => c.m2 ? ui.toast(`Removed ${fmtArea(c.m2)} of water. ${money(c.refund)} back.`, "good") : 0;
  if(paintPick === "erase"){
    const n = eraseRect(r), cut = cutWaterAll(r);
    if(!n && !cut.m2){ setStat("No paint there."); return; }
    setStat(""); afterChange(); render(); wetToast(cut); return;
  }
  const c = exhibitPaintCost(r, paintPick);
  if(!canAfford(c)){ const why = `Costs ${money(c)}. You have ${money(state.money)}.`; setStat(why, true); ui.toast(why, "bad"); return; }
  const res = paintRect(paintPick, r);
  if(typeof res === "string"){ setStat(res, true); ui.toast(res, "bad"); return; }
  if(c) spend(c, "built");
  const cut = cutWaterAll(r);
  setStat(""); afterChange(); render(); wetToast(cut);
}
// Bulldoze on empty ground: a tap takes the patch under it, a box takes the paint in it. Returns true if paint went.
function bulldozePaint(d){
  const tap = d.a[0] === d.b[0] && d.a[1] === d.b[1];
  const hit = tap ? erasePaintAt(d.a[0], d.a[1]) : eraseRect(paintBoxW(d.a, d.b)) > 0;
  if(hit){ setStat(""); afterChange(); render(); }
  return hit;
}

/* ---------- laying water in chunks ---------- */
// The water types to pick from: one for each biome with a water texture, plus the biome's own
const waterTypes = () => Object.keys(WATER_TEX).filter(k => BIOMES[k]);   // sea water is not paintable: a lagoon fills when its gate goes on (fillLagoon)
const waterLabel = k => SEA_WATER[k] ? SEA_WATER[k].label : BIOMES[k].label;
function waterBar(){
  if(waterPick !== "auto" && !waterTypes().includes(waterPick)) waterPick = "auto";
  showBar(waterPick === "auto" ? "Lay water" : SEA_WATER[waterPick] ? `Lay ${waterLabel(waterPick).toLowerCase()}` : `Lay ${waterLabel(waterPick).toLowerCase()} water`, "Drag a box to lay water in 5 m chunks, like a path. A tap lays one chunk. New water covers old water, so lay another type over a pond to change it. Touching water shares one shore. Only wooden bridges cross water. Paint ground over water to remove it.", "", {undo:false, finish:false, cancel:"Done"});
}
// the kind (water type) a new box is laid with: undefined means the biome of where it goes
const waterKindPick = () => waterPick !== "auto" && WATER_TEX[waterPick] ? waterPick : undefined;
// the box being dragged: its meters, the exhibit it's in (null: out in the park), the parts of it the fence leaves room for, price and why not
function waterBox(){
  const r = paintBox(wdrag.a, wdrag.b), host = waterHost([[(r[0] + r[2]) / 2, (r[1] + r[3]) / 2]]), kind = waterKindPick();
  const parts = waterClip(host, r), ptsOf = parts.map(rectPtsOf);
  const cost = ptsOf.reduce((n, p) => n + waterNetCost(host, p, kind), 0), same = parts.length > 0 && ptsOf.every(p => waterCovered(host, p, kind));
  // the look of the ghost: the picked type, else the biome it would sit in
  const look = kind || (host ? biomeOf(host) : parkBiome());
  let err = same ? "That water is already there." : null;
  if(!err && !parts.length) err = "Keep it inside the fence.";
  if(!err && (SEA_WATER[kind] || lagoonWalled(host))) err = "A lagoon fills with water when its gate goes on.";
  for(let i = 0; !err && i < ptsOf.length; i++) err = waterProblem(ptsOf[i], host, null, cost, true, kind);
  return {r, parts, ptsOf, host, kind, cost, same, look, m2:parts.reduce((n, q) => n + (q[2] - q[0]) * (q[3] - q[1]), 0), err};
}
function waterDragStat(){
  if(!wdrag) return;
  const b = waterBox();
  setStat(b.err || `${fmtArea(b.m2)} of water ${b.host ? "in " + b.host.name : "out in the park"}. ${money(b.cost)}`, !!b.err);
}
function endWaterDrag(){
  const b = waterBox(); wdrag = null; renderOverlay();
  if(b.err){ setStat(b.err, true); if(!b.same) ui.toast(b.err, "bad"); return; }
  for(const p of b.ptsOf) layWater(b.host, p, b.kind);
  setStat(""); afterChange(); render();
  ui.toast(`Laid ${fmtArea(b.m2)} of water in ${b.host ? b.host.name : "the park"} for ${money(b.cost)}.`, "good");
}

/* ---------- laying fence on the grid (js/fences.js) ---------- */
const gridAt = ev => { const w = toWorld(ev.clientX, ev.clientY); return [fenceSnap(w.x), fenceSnap(w.y)]; };   // the fence grid point under the pointer
function fenceBar(stat){
  const B = BARRIERS[fenceSel];
  showBar(`Lay ${B.label.toLowerCase()}`, "", "", {undo:true, finish:false, cancel:"Done", undoText:fenceMeet ? "Over fence: keep it" : "Over fence: replace it"});
  $("#dUndo").disabled = false;
  setStat(B.tech && !hasTech(B.tech) ? `Research ${TECH.find(x => x.id === B.tech).label.toLowerCase()} at the Research Lab first.` : stat || `${money(fenceRate(fenceSel) * FENCE_GRID.step)} a piece.`, !!(B.tech && !hasTech(B.tech)));
}
// The pieces the current drag covers
function fenceDragKeys(){
  if(!fdrag) return [];
  const keys = fdrag.lift ? [] : pieceLine(fdrag.a, fdrag.b).keys;
  return fdrag.lift ? [...fdrag.swept].filter(k => fencePieces()[k]) : keys;
}
// Does the segment p-q touch the box with corners a and b? (Liang-Barsky clip)
function segHitsRect(p, q, a, b){
  const lo = [Math.min(a[0], b[0]), Math.min(a[1], b[1])], hi = [Math.max(a[0], b[0]), Math.max(a[1], b[1])];
  let t0 = 0, t1 = 1;
  for(let i = 0; i < 2; i++){
    const d = q[i] - p[i];
    for(const [pp, qq] of [[-d, p[i] - lo[i]], [d, hi[i] - p[i]]]){
      if(pp === 0){ if(qq < 0) return false; continue; }
      const r = qq / pp;
      if(pp < 0){ if(r > t1) return false; if(r > t0) t0 = r; } else { if(r < t0) return false; if(r < t1) t1 = r; }
    }
  }
  return true;
}
function fenceDragStat(){
  const keys = fenceDragKeys();
  if(fdrag.lift){
    const back = Math.round(keys.reduce((n, k) => n + pieceWorth(k, fencePieces()[k]) * COST.refundShare, 0)), ch = fdrag.box ? bulldozeChunkKeys(fdrag) : [];
    const chBack = Math.round(ch.reduce((n, k) => n + pathChunkCost(pathChunks()[k]) * COST.refundShare, 0));
    const parts = [];
    if(ch.length) parts.push(`${ch.length} path chunk${ch.length === 1 ? "" : "s"}`);
    if(keys.length || !ch.length) parts.push(`${keys.length} piece${keys.length === 1 ? "" : "s"} of fence`);
    setStat(`Remove ${parts.join(" and ")} for ${money(back + chBack)} back.`);
    return;
  }
  const opts = fenceOpts(), plan = planPieces(keys, fenceSel, opts), m = Math.round(plan.todo.reduce((n, k) => n + pieceLen(k), 0));
  fdrag.why = plan.why; fdrag.todo = plan.todo; fdrag.side = opts.side; fdrag.shift = {};
  // a shared wall that changes on one side only is shown nudged to that side
  for(const k of plan.todo){
    const old = fencePieces()[k], nx = plan.next[k]; if(!old || !pieceSplit(nx)) continue;
    const a = pieceKind(nx, true) !== pieceKind(old, true), b = pieceKind(nx, false) !== pieceKind(old, false); if(a === b) continue;
    const [e0, e1] = pieceEnds(k), L = Math.hypot(e1[0] - e0[0], e1[1] - e0[1]), sg = a ? 1 : -1;
    fdrag.shift[k] = [-(e1[1] - e0[1]) / L * sg * FENCE_GRID.sideGap, (e1[0] - e0[0]) / L * sg * FENCE_GRID.sideGap];
  }
  setStat(plan.why || `${m} m, ${money(plan.cost)}.${plan.note ? " " + plan.note : ""}`, !!plan.why);
}
// How the drag is laid: which way it runs, which side of it the pointer is on (for a wall two pens share), and whether to leave other fence alone
function fenceOpts(){
  const L = pieceLine(fdrag.a, fdrag.b), dx = Math.sign(L.end[0] - fdrag.a[0]), dy = Math.sign(L.end[1] - fdrag.a[1]);
  let side = 0;
  if((dx || dy) && fdrag.w){ const d = (-(fdrag.w.x - fdrag.a[0]) * dy + (fdrag.w.y - fdrag.a[1]) * dx) / Math.hypot(dx, dy); side = Math.abs(d) < FENCE_GRID.sideDead ? 0 : Math.sign(d); }
  return {dir:[dx, dy], side, meet:fenceMeet};
}
function endFenceDrag(){
  const keys = fenceDragKeys(), lift = fdrag.lift, box = fdrag.box && fdrag, opts = lift ? null : fenceOpts(); fdrag = null;
  const tookPath = box ? bulldozeChunks(box) : false;   // the chunks lit in the box go at once, with one refund and one toast
  if(!keys.length){ if(box && !tookPath) bulldozePaint(box); renderOverlay(); return; }
  if(lift){
    // only a lift that opens a gap in a closed exhibit asks first
    const lifted = new Set(keys.filter(k => fencePieces()[k]));
    const hit = gridExhibits().filter(e => !e.open && loopPieces(e.points).some(k => lifted.has(k)));
    if(!hit.length){ finishFenceDrag(keys, true); return; }
    const names = hit.map(e => e.name), who = names.length > 1 ? names.slice(0, -1).join(", ") + " and " + names[names.length - 1] : names[0];
    askConfirm(`Open a gap in ${who}?`, `Lifting this fence leaves a gap in ${who}. Animals inside can walk out until it's closed again.`, "Lift it", () => { if(keys.every(k => fencePieces()[k])) finishFenceDrag(keys, true); else renderOverlay(); });
    renderOverlay(); return;
  }
  finishFenceDrag(keys, false, opts);
}
function finishFenceDrag(keys, lift, opts){
  const r = lift ? liftPieces(keys) : layPieces(keys, fenceSel, opts);
  if(!r){ renderOverlay(); return; }   // the stat line already says why
  afterChange(); render();
  if(lift) setStat(""); else fenceBar();
  const what = lift ? `Lifted ${r.n} piece${r.n === 1 ? "" : "s"} of fence for ${money(r.back)} back.` : `Laid ${r.n} piece${r.n === 1 ? "" : "s"} of fence for ${money(r.cost)}.`;
  ui.toast([what].concat(r.notes).join(" "), r.notes.some(n => /gap/.test(n)) ? "bad" : "good");
}

/* ---------- laying paths on the chunk grid (js/pathcells.js) ---------- */
const chunkAtEv = ev => { const w = toWorld(ev.clientX, ev.clientY); return chunkAt(w.x, w.y); };
const PATH_HINT = {
  g:"Drag to lay 5 m path chunks, straight or diagonal. Start on the entrance walk or another path. Lay paths side by side for a wider walk. Bulldoze takes chunks away.",
  s:"Staff only: guests won't walk it. Drag to lay staff chunks from any path; one that touches a guest path or the entrance walk is joined to it for staff. Bulldoze takes chunks away.",
  b:"The only path that crosses water. Drag it over the water, from one bank to the other. Bulldoze takes chunks away."
};
function pathBar(){
  const k = PATH_TOOLS[tool], K = PATH_CELLS.kinds[k];
  showBar(`Lay ${K.label.toLowerCase()}`, PATH_HINT[k], "", {undo:false, finish:false, cancel:"Done"});
  setStat(`${money(pathChunkCost(k))} a 5 m chunk, ${money(K.perMeter)} a meter of path.`);
}
function pathDragStat(){
  const d = cdrag, K = PATH_CELLS.kinds[d.kind], plan = d.plan = planPath(d.a, d.b, d.kind);
  setStat(plan.why || `${plan.todo.length} chunk${plan.todo.length === 1 ? "" : "s"}, ${money(plan.cost)}.`, !!plan.why);
}
// The chunks a drag will lay at their true size: green where it can go, red where it can't, grey where it's already there
function pathGhostSvg(plan, inv){
  const d = {ok:"", bad:"", has:""}, C = pathChunks();
  for(const k of plan.chunks){
    const [cx, cy] = chunkXY(k), seg = `M${cx * CHUNK} ${cy * CHUNK}h${CHUNK}v${CHUNK}h-${CHUNK}z`;
    if(plan.bad.has(k)) d.bad += seg; else if(C[k] === plan.kind || !plan.todo.includes(k)) d.has += seg; else d.ok += seg;
  }
  const f = (c, op, path) => path ? `<path d="${path}" fill="${c}" fill-opacity="${op}" stroke="${c}" stroke-opacity=".6" stroke-width="1" vector-effect="non-scaling-stroke"/>` : "";
  return `<g pointer-events="none">${f("#8A8F96", .25, d.has)}${f("#4CD964", .4, d.ok)}${f("#E5484D", .5, d.bad)}</g>`;
}
function endPathDrag(){
  const d = cdrag; cdrag = null;
  if(!d.plan || !d.plan.chunks.length){ renderOverlay(); return; }
  const K = PATH_CELLS.kinds[d.kind], r = layPath(d.a, d.b, d.kind);
  if(!r){ renderOverlay(); if(d.plan.why) ui.toast(d.plan.why, "bad"); return; }
  afterChange(); render(); pathBar();
  const joined = chunksJoined(d.plan.todo, d.kind !== "s");
  ui.toast(joined ? `Laid ${r.n} chunk${r.n === 1 ? "" : "s"} of ${K.label.toLowerCase()} for ${money(r.cost)}.` : `Laid ${K.label.toLowerCase()}, but it doesn't reach the entrance yet.`, joined ? "good" : "bad");
}
// The chunks a bulldoze box (or tap) takes: the lit ones, never the chunk at the gate
function bulldozeChunkKeys(box){ const F = pathFixedChunks(); return chunksInBox(box.a, box.b).filter(k => !F[k]); }
// Bulldoze on bare ground: a tap takes the chunk under it, a box takes every chunk it touches. Returns true if it dealt with path.
function bulldozeChunks(box){
  const all = chunksInBox(box.a, box.b);
  if(!all.length) return false;
  const r = removeChunks(all);
  if(!r.n){ setStat("The path at the entrance stays.", true); return true; }
  afterChange(); render();
  setStat("");
  ui.toast(`Removed ${r.n} path chunk${r.n === 1 ? "" : "s"}, refunded ${money(r.back)}.${r.kept ? " The path at the entrance stays." : ""}`, "good");
  return true;
}
function toolDone(newSel){
  setTool("select");
  if(newSel) select(newSel.kind, newSel.id);
}

function drawTap(e){
  const sn = snapAt(e.clientX, e.clientY, e), k = view.k;
  const near = q => q && Math.hypot(q[0] - sn.x, q[1] - sn.y) * k < 14;
  if(isPoly(draw.kind) && draw.pts.length >= 3 && near(draw.pts[0])){ finishDraw(); return; }
  if(!isPoly(draw.kind) && draw.pts.length && near(draw.pts[draw.pts.length-1])){ finishDraw(); return; }
  draw.pts.push([sn.x, sn.y]); draw.snaps.push(sn.info);
  snapMark = null; updateDrawbar(); renderOverlay();
}

/* ---------- placing guest buildings ---------- */
// The way a path prop faces by default, a unit vector due north, south, east or west: toward the nearer of the closest exhibit fence and the closest path edge (a fence wins a tie). South when neither is near.
function propFacing(x, y, type){
  let best = null;
  const reach = type === "sign" || type === "nofeed" || type === "quiet" ? EDU.signReach : 8;
  for(const e of state.exhibits) for(let i = 0; i < e.points.length; i++){
    const r = segProj(x, y, e.points[i], e.points[(i+1) % e.points.length]);
    if(r.d <= reach && r.d > 0 && (!best || r.d < best.d)) best = {d:r.d, dx:r.x - x, dy:r.y - y};
  }
  const o = best ? (Math.round(Math.atan2(best.dy, best.dx) / (Math.PI/2)) * 2 + 8) % 8 : null;
  let edge = null;
  for(let k = 0; k < 8; k += 2){
    const dx = Math.round(Math.cos(k * Math.PI/4) * 1e6) / 1e6, dy = Math.round(Math.sin(k * Math.PI/4) * 1e6) / 1e6;
    let s = .25; while(s <= 12 && guestCell(pathAt(x + dx*s, y + dy*s))) s += .25;   // guestCell is false for no chunk
    if(s <= 12 && (!edge || s < edge.d)) edge = {d:s, k};
  }
  const k = best && (!edge || best.d <= edge.d) ? o : edge ? edge.k : 2;
  return [Math.round(Math.cos(k * Math.PI/4) * 1e6) / 1e6, Math.round(Math.sin(k * Math.PI/4) * 1e6) / 1e6];
}
// Slide a building so the wall with its door lies on the grid, so it can stand flush against a path (whose edges are on whole meters) whatever its depth. 0-3 = N/E/S/W. A picture card facing north snaps its base line (south edge) instead, the line that meets the path it backs onto.
function doorOnGrid(pts, face, type){
  if(face === 0 && BLD_PICS[type] && BLD_PICS[type].card) face = 2;
  const b = bbox(pts), e = [b.y0, b.x1, b.y1, b.x0][face], d = Math.round(e / GRID_STEP) * GRID_STEP - e, ax = face % 2;
  return pts.map(([x, y]) => [Math.round((x + (ax ? d : 0)) * 1e6) / 1e6, Math.round((y + (ax ? 0 : d)) * 1e6) / 1e6]);
}
// Slide a building so its box lies on the 5 m grid (the path chunks), so it never straddles a path. Props and cases keep the 1 m grid.
const snapsToChunks = t => !t.prop && !t.viv && !t.gallery && t !== BUILDINGS.platform;
function onChunkGrid(pts){
  const b = bbox(pts), dx = Math.round(b.x0 / CHUNK) * CHUNK - b.x0, dy = Math.round(b.y0 / CHUNK) * CHUNK - b.y0;
  return pts.map(([x, y]) => [Math.round((x + dx) * 1e6) / 1e6, Math.round((y + dy) * 1e6) / 1e6]);
}
function placeGhost(clientX, clientY){
  lastPtr = {x:clientX, y:clientY};
  const t = BUILDINGS[tool];
  const p = toWorld(clientX, clientY);
  let why = null;
  if(t.unique && hasDept(tool)) why = `You already have ${t.label}. There's one per park.`;
  if(!why && buildingHidden(tool)) why = "That isn't available yet.";
  if(!why && t.tech && !hasTech(t.tech)) why = `Research ${TECH.find(x => x.id === t.tech).label.toLowerCase()} at the Research Lab first.`;
  if(!why && t.needsDept && !hasDept(t.needsDept)) why = `Build ${BUILDINGS[t.needsDept].label} first.`;
  if(!why && !state.sandbox && t.minRating && state.rating < t.minRating) why = `Your park needs ${t.minRating} stars first.`;
  if(!why && t.rooms) why = hotelLocked(tool);
  let x, y, angle = rot * Math.PI/4;
  if(t.onPath){
    // path props go on the 1 m grid at the pointer, anywhere they sit fully on a path; the front defaults to the nearest exhibit or path edge, and Rotate turns it 90° from there
    x = Math.round(p.x / GRID_STEP) * GRID_STEP; y = Math.round(p.y / GRID_STEP) * GRID_STEP;
    const fv = propFacing(x, y, tool);
    angle = Math.atan2(fv[1], fv[0]) - Math.PI/2 + rot*Math.PI/4;
    // a fence right at the path edge (older, narrower paths): slide away from what it faces until the prop clears it
    const x0 = x, y0 = y;
    for(let s = .1; s <= PATH_HALF_WIDTH && state.exhibits.some(e => shapesOverlap(rectPts(x, y, t.w, t.d, angle), e.points)); s += .1){ x = x0 - fv[0]*s; y = y0 - fv[1]*s; }
  } else {
    // everything else goes on the 1 m grid at the pointer, square to the map
    x = Math.round(p.x / GRID_STEP) * GRID_STEP; y = Math.round(p.y / GRID_STEP) * GRID_STEP;
  }
  const face = t.prop ? undefined : (2 + rot / 2) % 4;   // a fresh building looks south; each quarter turn swings its door with it
  let pts = rectPts(x, y, t.w, t.d, angle).map(v => [Math.round(v[0] * 1e6) / 1e6, Math.round(v[1] * 1e6) / 1e6]);   // clean float dust off the quarter turns
  if(snapsToChunks(t)){ pts = onChunkGrid(pts); [x, y] = centroid(pts); }
  else if(!t.prop && !t.viv) pts = doorOnGrid(pts, face, tool);
  if(!why && !insidePlot(pts)) why = "Keep it inside the park boundary.";
  if(!why && state.exhibits.some(e => shapesOverlap(pts, e.points))) why = "It overlaps an exhibit.";
  if(!why && state.buildings.some(b => shapesOverlap(pts, b.points))) why = "It overlaps another building.";
  if(!why && t.onPath && !shapeOnGuestPath(pts)) why = "Keep it on a path.";
  if(!why && !t.onPath && bldOnPath(tool, pts)) why = "It sits on a path.";
  if(!why) why = shapeHitsLandscape(pts);
  if(!why && !canAfford(t.price)) why = `Costs ${money(t.price)}. You have ${money(state.money)}.`;
  ghost = {pts, x, y, angle, ok:!why, why, face};
  // does it work where it stands? Same reach test as recompute: guests walk to it by footpath, staff by any path (depots by staff path)
  const reached = t.onPath ? nearCells(pts, 0, true) : nearCells(pts, REACH - PATH_HALF_WIDTH, !t.dept) && (!t.serviceOnly || nearCells(pts, REACH - PATH_HALF_WIDTH, false, false, "s"));
  const doorAway = !t.onPath && reached && !doorNear({points:pts, face}, !t.dept) ? " Its door faces away from the path." : "";
  const noTrack = t.tram && !why && !tramNear(pts) ? " No tram track beside it yet, so it won't work until one runs alongside." : "";
  setStat(why || `${money(t.price)}. Tap to build.${reached ? doorAway : " No path nearby, so it won't work until one reaches it."}${noTrack}`, !!why);
}

// Turn the building being placed a quarter turn, and redraw the ghost where the pointer is. Everything faces north, south, east or west.
function rotateTool(){
  rot = (rot + 2) % 8;
  if(lastPtr){ placeGhost(lastPtr.x, lastPtr.y); renderOverlay(); }
  else setStat("Turned 90°. Tap to place it.");
}
// Turn the building picked with the Move tool about its middle, if it fits there
function rotateMoved(){
  const it = mvSel && findItem("building", mvSel);
  if(!it){ setStat("Tap a building first, then Rotate.", true); return; }
  const orig = it.points, [cx, cy] = centroid(orig), a = Math.PI/2, c = Math.cos(a), s = Math.sin(a);
  const prop = BUILDINGS[it.type].prop, face0 = it.face, face = prop ? face0 : ((face0 === undefined ? 2 : face0) + 1) % 4;   // the door turns with the walls
  it.points = orig.map(([x, y]) => [Math.round((cx + (x - cx)*c - (y - cy)*s) * 1e6) / 1e6, Math.round((cy + (x - cx)*s + (y - cy)*c) * 1e6) / 1e6]);
  if(!prop){ it.points = snapsToChunks(BUILDINGS[it.type]) ? onChunkGrid(it.points) : doorOnGrid(it.points, face, it.type); it.face = face; }
  const why = moveProblem("building", it);
  if(why){ it.points = orig; it.face = face0; setStat(`Can't turn it here. ${why}`, true); return; }
  if(prop) it.rot = ((it.rot || 0) + 2) % 8;
  afterChange(); render(); updateMoveBar();
  const reach = isReachable(it);
  setStat(reach ? "Turned." : "Turned, but it has no path to the entrance, so it won't work.", !reach);
}

function placeBuilding(e){
  placeGhost(e.clientX, e.clientY);
  if(!ghost.ok){ renderOverlay(); return; }
  const t = BUILDINGS[tool];
  spend(t.price, "built");
  if(t.viv){
    // a vivarium (or an aquarium) is an exhibit, just one that comes pre-built
    const used = new Set(state.exhibits.map(x => x.name));
    let n = 1; while(used.has(`${t.label} ${n}`)) n++;
    const e = {id:uid("e-"), name:`${t.label} ${n}`, points:ghost.pts, animals:[], happy:70, viv:t.viv, vivScene:null, ...(t.aqua ? {aqua:true, wq:100} : {})};
    autoZone(e);
    themeNew("exhibit", e);
    state.exhibits.push(e);
    afterChange(); render();
    ui.toast(isReachable(e) ? `Built ${t.one} for ${money(t.price)}. Tap it to add animals.` : `Built ${t.one}, but it has no path to the entrance yet, so it won't work.`, isReachable(e) ? "" : "bad");
    return;
  }
  const b = {id:uid("b-"), type:tool, points:ghost.pts, day:state.day};
  if(t.prop) b.rot = rot;   // how many 45° turns the player gave it (always even now); its front is read off the points (propFront)
  else b.face = ghost.face;   // which wall has the door and sign: 0-3 = N/E/S/W
  autoZone(b);
  themeNew("building", b);
  state.buildings.push(b);
  afterChange();
  render();
  ui.toast(isReachable(b) ? `Built ${t.one} for ${money(t.price)}.` : `Built ${t.one}, but it has no path to the entrance yet, so it won't work.`, isReachable(b) ? "" : "bad");
  if(t.dept || t.kind){ toolDone({kind:"building", id:b.id}); }
}

/* ---------- keeper gates ---------- */
let gateGhost = null;
// Find the exhibit fence (or the fence of a closed pen with no exhibit yet) nearest the pointer, and whether a gate there would work
function findGateSpot(clientX, clientY){
  const p = toWorld(clientX, clientY); let best = null;
  const near = (host, pts) => { for(let i = 0; i < pts.length; i++){
    const r = segProj(p.x, p.y, pts[i], pts[(i+1) % pts.length]);
    if(r.d * view.k < 16 && (!best || r.d < best.d)) best = {...host, x:r.x, y:r.y, d:r.d, a:pts[i], b:pts[(i+1) % pts.length]};
  } };
  for(const e of state.exhibits) if(!e.viv) near({e}, e.points);
  for(const f of penFaces()) near({pen:f}, f.pts);
  if(!best){
    // loose fence that doesn't close a loop: say so
    const k = pieceNear(p.x, p.y, Math.max(.6, 10 / view.k));
    if(!k || claimedPieces().has(k)) return null;
    const [a, b] = pieceEnds(k), r = segProj(p.x, p.y, a, b);
    return {loose:true, ok:false, x:r.x, y:r.y, a, b, why:"This fence isn't closed yet. Close the loop to make a pen, then put a gate on it."};
  }
  const host = best.e || {points:best.pen.pts}, old = host.gate; host.gate = [best.x, best.y];
  const chk = gateCheck(host); host.gate = best.e ? old : undefined;
  return {...best, ok:chk.ok, why:chk.text};
}
// The gate ghost: the standard gate (posts, rails, panel) the gate's width in line with the fence side, as tall as that fence; green where a gate works, red where it doesn't
function gateGhostSvg(g, inv){
  const [a, b] = [g.a, g.b], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L;
  const k = pieceType(fencePieces()[pieceNear(g.x, g.y, .5)]), F = FENCE_SPRITES[BARRIERS[k] && BARRIERS[k].hedge ? "hedge" : k], gw = F && F.gateW ? F.gateW * ROCK_MPP : GATE_GHOST.w;
  const w = Math.min(L, gw), t = clamp((g.x - a[0]) * ux + (g.y - a[1]) * uy, w / 2, L - w / 2);
  let v0 = -GATE_GHOST.d / 2, v1 = GATE_GHOST.d / 2;
  if(F && F.gateW){   // a catwalk: the deck lies inside the fence, gw deep from the wall line
    const poly = g.e ? g.e.points : g.pen ? g.pen.pts : null, mx = a[0] + ux * t, my = a[1] + uy * t, sgn = poly && inPoly(mx + uy * -1.5, my + ux * 1.5, poly) ? 1 : -1;
    [v0, v1] = sgn > 0 ? [0, gw] : [-gw, 0];
  }
  const foot = [[-w / 2, v0], [w / 2, v0], [w / 2, v1], [-w / 2, v1]].map(([u, v]) => [a[0] + ux * (t + u) - uy * v, a[1] + uy * (t + u) + ux * v]);
  const h = Math.max(GATE_GHOST.h, F ? F.h * ROCK_MPP : 0) / tf();   // the fence's height, stood back up against the squashed camera
  const mid = (v0 + v1) / 2, p0 = [a[0] + ux * (t - w / 2) - uy * mid, a[1] + uy * (t - w / 2) + ux * mid], p1 = [a[0] + ux * (t + w / 2) - uy * mid, a[1] + uy * (t + w / 2) + ux * mid];
  return gateGlyphSvg(p0, p1, h, g.ok ? "var(--good)" : "var(--bad)");
}
// The standard gate picture: two posts, a top and a middle rail and a faint panel between, from foot point p0 to p1 and h tall
function gateGlyphSvg(p0, p1, h, col){
  const up = p => [p[0], p[1] - h], q0 = up(p0), q1 = up(p1), m0 = [p0[0], p0[1] - h * .45], m1 = [p1[0], p1[1] - h * .45];
  const ln = (u, v, wd) => `<line x1="${u[0]}" y1="${u[1]}" x2="${v[0]}" y2="${v[1]}" stroke-width="${wd}" vector-effect="non-scaling-stroke"/>`;
  return `<g stroke="${col}" stroke-linecap="round" pointer-events="none"><polygon points="${polyStr([p0, p1, q1, q0])}" fill="${col}" fill-opacity=".25" stroke="none"/>${ln(p0, q0, 3)}${ln(p1, q1, 3)}${ln(q0, q1, 2)}${ln(m0, m1, 2)}${ln(p0, p1, 1.5)}</g>`;
}
// A gate on a pen also buys the ground it fences in
const penCost = f => GATE_COST + Math.round(newGround([f]) * COST.landPerSqM);
// A grid exhibit's gate under the pointer (bulldoze takes it out, and the exhibit with it)
function gateNear(cx, cy){
  const w = toWorld(cx, cy);
  return state.exhibits.find(e => e.grid && e.gate && Math.hypot(e.gate[0] - w.x, e.gate[1] - w.y) * view.k < 14) || null;
}
function gateHover(e){
  gateGhost = findGateSpot(e.clientX, e.clientY);
  setStat(gateGhost ? (gateGhost.ok ? `${money(gateGhost.pen ? penCost(gateGhost.pen) : GATE_COST)}. ${gateGhost.why}` : gateGhost.why) : "Point at an exhibit's fence, or a closed pen.", gateGhost && !gateGhost.ok);
  renderOverlay();
}
function gateTap(e){
  const g = findGateSpot(e.clientX, e.clientY);
  if(!g){ setStat("Tap right on an exhibit's fence, or a closed pen.", true); return; }
  if(g.loose){ setStat(g.why, true); return; }
  const cost = g.pen ? penCost(g.pen) : g.e.gate ? 0 : GATE_COST;
  if(!canAfford(cost)){ setStat(`That costs ${money(cost)}.`, true); return; }
  spend(cost, "built");
  const ex = g.pen ? adoptPen(g.pen, [g.x, g.y]) : g.e;
  if(!g.pen) ex.gate = [g.x, g.y];
  afterChange(); render();
  if(lagoonWalled(ex) && !waterOf(ex).length) askLagoonWater(ex);
  ui.toast(`${g.pen ? `Made ${ex.name}, ${fmtArea(area(ex.points))}, with a gate` : `${cost ? "Built" : "Moved"} the gate on ${ex.name}`}. ${g.why}`, g.ok ? "" : "bad");
}

/* ---------- keepers on the map ---------- */
const keeperEls = new Map();
function walker34(el, x, y){ el.setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)})${upright()}`); el.style.display = hidden34(x, y) ? "none" : ""; }
// A person drawn from strips (HUMAN_SPRITES): the walk frame follows distance walked, the work strip plays on the clock while standing at a job, and it faces the way it last moved
// The feed crate held out in front of the carrying pose (sprite pixels, right of the body, at hand height; drawn in every pose while the keeper has food, so it looks the same walking, working and standing)
function carryBox(col){
  return `<g class="hcb"><rect x="11" y="18" width="5" height="5" fill="${col}"/><rect x="11" y="18" width="5" height="1" fill="#fff" opacity=".35"/><rect x="11" y="18" width="1" height="5" fill="#fff" opacity=".2"/><rect x="11" y="22" width="5" height="1" fill="#000" opacity=".3"/><rect x="15" y="18" width="1" height="5" fill="#000" opacity=".25"/></g>`;
}
// A finished specimen's crate in the hands instead: crate.png squeezed into the same box
const carryCrate = () => `<image class="hcb" href="${spriteUrl("sprites/crate.png")}" x="10.5" y="17.5" width="5.5" height="6.5" preserveAspectRatio="none" style="image-rendering:pixelated"/>`;
function humanSvg(kind, hm, food, crate){
  const H = HUMAN_SPRITES, k = hm / H.ht, w = H.w * k, V = H[kind];
  const im = (cls, a) => `<image class="${cls}" href="${spriteUrl(a.src)}" width="${H.w * a.n}" height="${H.ht}" style="image-rendering:pixelated"/>`;
  return `<g class="hf"><svg x="${-w/2}" y="${-H.feet * k}" width="${w}" height="${hm}" viewBox="0 0 ${H.w} ${H.ht}" overflow="hidden">${im("hw", V.walk)}${V.work ? im("hk", V.work) : ""}${V.wait ? im("hs", V.wait) : ""}${V.carry ? im("hc", V.carry) : ""}${V.carry && crate ? carryCrate() : V.carry && food ? carryBox(food) : ""}</svg></g>`;
}
function humanStep(el, kind, c, x, y){
  const H = HUMAN_SPRITES, V = H[kind], dx = x - (el._hx ?? x), dy = y - (el._hy ?? y), d = Math.hypot(dx, dy), now = performance.now();
  el._hx = x; el._hy = y;
  if(d > 1e-4){ el._hd = (el._hd || 0) + d; el._hmove = now; if(Math.abs(dx) > 1e-4) el._hface = dx < 0 ? -1 : 1; }
  const moving = now - (el._hmove || 0) < 250, mode = moving ? (V.carry && (c.carry || c.crate) ? "hc" : "hw") : V.work && V.work.jobs.includes(c.job) ? "hk" : V.wait ? "hs" : "hw";
  const A = {hw:V.walk, hk:V.work, hs:V.wait, hc:V.carry}[mode], g = el.querySelector(".hf"); if(!g) return;
  const f = moving ? Math.floor((el._hd || 0) / H.step) % A.n : mode === "hw" ? 0 : Math.floor(now / A.ms) % A.n;
  if(el._hf !== el._hface){ el._hf = el._hface; g.setAttribute("transform", el._hface < 0 ? "scale(-1 1)" : ""); }
  if(el._hm !== mode){ el._hm = mode; for(const m of ["hw", "hk", "hs", "hc"]){ const im = el.querySelector("." + m); if(im) im.style.display = m === mode ? "" : "none"; } el._hfr = -1; }
  if(el._hfr !== f){ el._hfr = f; el.querySelector("." + mode).setAttribute("x", -f * H.w); }
}
function drawKeepers(){
  const layer = $("#keeperLayer"), inv = 1/view.k, seen = new Set();
  for(const c of crew){
    if(!c.at) continue;
    seen.add(c.id);
    let el = keeperEls.get(c.id);
    if(!el){ el = document.createElementNS("http://www.w3.org/2000/svg", "g"); el.setAttribute("pointer-events", "none"); layer.appendChild(el); keeperEls.set(c.id, el); }
    const nx = c.route[0];
    const fp = fillPos(c);   // filling trays: inside the fence
    const x = fp ? fp[0] : nx ? c.at.x + (nx.x - c.at.x) * c.t : c.at.x, y = fp ? fp[1] : nx ? c.at.y + (nx.y - c.at.y) * c.t : c.at.y;
    const r = Math.max(1.3, 5*inv), food = c.carry ? FOOD_COLOR[c.carry.type] : null, cargo = c.cargo && !c.crate ? PERIOD_COLOR[SPECIES_BY_ID[c.cargo.sp].period] : null;
    const drive = onAtv(c), hm = Math.max(HUMAN_SPRITES.h, 24*inv), key = `${r.toFixed(3)}|${food}|${cargo}|${!!c.crate}|${drive}|${hm.toFixed(3)}`;
    if(el.dataset.key !== key){
      el.dataset.key = key; el._hf = el._hfr = el._hm = undefined;
      // an animal being moved rides along beside its keeper; on a service road with an ATV, they ride it
      el.innerHTML = atvSvg(r, drive) + (cargo ? `<circle cx="${-r*1.6}" cy="${-r*.6}" r="${r*1.1}" fill="${cargo}" stroke="#1D2B22" stroke-width="1.5" vector-effect="non-scaling-stroke"/>` : "") +
        humanSvg("keeper", hm, food, c.crate);
    }
    humanStep(el, "keeper", c, x, y);
    walker34(el, x, y);
  }
  // mechanics: pixel people in orange coveralls, ringed while inspecting or repairing
  for(const c of mcrew){
    if(!c.at) continue;
    seen.add(c.id);
    let el = keeperEls.get(c.id);
    if(!el){ el = document.createElementNS("http://www.w3.org/2000/svg", "g"); el.setAttribute("pointer-events", "none"); layer.appendChild(el); keeperEls.set(c.id, el); }
    const [x, y] = keeperPos(c), r = Math.max(1.3, 5*inv), working = c.job === "repairing" || c.job === "inspecting", drive = onAtv(c), hm = Math.max(HUMAN_SPRITES.h, 24*inv), key = `m${r.toFixed(3)}|${working}|${drive}|${hm.toFixed(3)}`;
    if(el.dataset.key !== key){
      el.dataset.key = key; el._hf = el._hfr = el._hm = undefined;
      el.innerHTML = atvSvg(r, drive) + humanSvg("mechanic", hm, null) +
        (working ? `<circle r="${r*1.7}" fill="none" stroke="#C8642A" stroke-width="1.5" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/>` : "");
    }
    humanStep(el, "mechanic", c, x, y);
    walker34(el, x, y);
  }
  // vets: pixel people in green scrubs, ringed while darting
  for(const c of vcrew){
    if(!c.at) continue;
    seen.add(c.id);
    let el = keeperEls.get(c.id);
    if(!el){ el = document.createElementNS("http://www.w3.org/2000/svg", "g"); el.setAttribute("pointer-events", "none"); layer.appendChild(el); keeperEls.set(c.id, el); }
    const [x, y] = keeperPos(c), r = Math.max(1.3, 5*inv), working = c.job === "darting", drive = onAtv(c), hm = Math.max(HUMAN_SPRITES.h, 24*inv), key = `v${r.toFixed(3)}|${working}|${!!c.crate}|${drive}|${hm.toFixed(3)}`;
    if(el.dataset.key !== key){
      el.dataset.key = key; el._hf = el._hfr = el._hm = undefined;
      el.innerHTML = atvSvg(r, drive) + humanSvg("vet", hm, null, c.crate) +
        (working ? `<circle r="${r*1.7}" fill="none" stroke="#B0384F" stroke-width="1.5" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/>` : "");
    }
    humanStep(el, "vet", c, x, y);
    walker34(el, x, y);
  }
  // custodians: pixel people; the crate in their hands is whatever stock they carry
  for(const c of ccrew){
    if(!c.at) continue;
    seen.add(c.id);
    let el = keeperEls.get(c.id);
    if(!el){ el = document.createElementNS("http://www.w3.org/2000/svg", "g"); el.setAttribute("pointer-events", "none"); layer.appendChild(el); keeperEls.set(c.id, el); }
    const [x, y] = keeperPos(c), r = Math.max(1.3, 5*inv), good = c.carry ? GOOD_COLOR[c.carry.type] : null, busy = ["scrubbing", "emptying", "sweeping"].includes(c.job), drive = onAtv(c), hm = Math.max(HUMAN_SPRITES.h, 24*inv), key = `c${r.toFixed(3)}|${good}|${!!c.crate}|${busy}|${drive}|${hm.toFixed(3)}`;
    if(el.dataset.key !== key){
      el.dataset.key = key; el._hf = el._hfr = el._hm = undefined;
      el.innerHTML = atvSvg(r, drive) + humanSvg("custodian", hm, good, c.crate) +
        (busy ? `<circle r="${r*1.7}" fill="none" stroke="#2E8B8B" stroke-width="1.5" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/>` : "");
    }
    humanStep(el, "custodian", c, x, y);
    walker34(el, x, y);
  }
  // security guards: pixel people in navy, ringed while chasing; the escort strip plays while walking a party out
  for(const c of gcrew){
    if(!c.at) continue;
    seen.add(c.id);
    let el = keeperEls.get(c.id);
    if(!el){ el = document.createElementNS("http://www.w3.org/2000/svg", "g"); el.setAttribute("pointer-events", "none"); layer.appendChild(el); keeperEls.set(c.id, el); }
    const [x, y] = keeperPos(c), r = Math.max(1.3, 5*inv), chasing = !!c.chase, drive = onAtv(c), hm = Math.max(HUMAN_SPRITES.h, 24*inv), key = `g${r.toFixed(3)}|${chasing}|${drive}|${hm.toFixed(3)}`;
    if(el.dataset.key !== key){
      el.dataset.key = key; el._hf = el._hfr = el._hm = undefined;
      el.innerHTML = atvSvg(r, drive) + humanSvg("guard", hm, null) +
        (chasing ? `<circle r="${r*1.7}" fill="none" stroke="#E5484D" stroke-width="1.5" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/>` : "");
    }
    humanStep(el, "guard", c, x, y);
    walker34(el, x, y);
  }
  // ATVs parked out on the roads, waiting for someone to come back to them
  for(const a of usableAtvs()){
    if(a.by || !a.at) continue;
    const n = atvNode(a); if(!n) continue;
    const id = "atv:" + a.id; seen.add(id);
    let el = keeperEls.get(id);
    if(!el){ el = document.createElementNS("http://www.w3.org/2000/svg", "g"); el.setAttribute("pointer-events", "none"); layer.appendChild(el); keeperEls.set(id, el); }
    const r = Math.max(1.3, 5*inv), key = r.toFixed(3);
    if(el.dataset.key !== key){ el.dataset.key = key; el.innerHTML = atvSvg(r, true); }
    walker34(el, n.x, n.y);
  }
  for(const [id, el] of keeperEls) if(!seen.has(id)){ el.remove(); keeperEls.delete(id); }
}

// A little ATV: under a staff member who is driving, or parked on its own
function atvSvg(r, on){ return on ? `<rect x="${-r*1.9}" y="${-r*1.2}" width="${r*3.8}" height="${r*2.4}" rx="${r*.6}" fill="#4F6273" stroke="#fff" stroke-width="1.5" vector-effect="non-scaling-stroke"/>` : ""; }

/* ---------- escaped animals on the map ---------- */
// Dust puffs where an attack lands: a few flat square pixels that spread and fade (about 0.6 s). Not saved, never clickable.
const FX_DUST = {life: 600, n: 6, cols: ["#C9B089", "#A8946F", "#B7B0A2", "#8F8A7E"]};
const fxList = [];
function fxAdd(kind, x, y){ if(fxList.length < 24) fxList.push({kind, x, y, t0: performance.now(), seed: Math.random() * 6.28}); }
function drawFx(now){
  const layer = $("#fxLayer"); if(!layer) return;
  for(let i = fxList.length - 1; i >= 0; i--) if(now - fxList[i].t0 >= FX_DUST.life) fxList.splice(i, 1);
  if(!fxList.length){ if(layer.childElementCount) layer.innerHTML = ""; return; }
  const inv = 1 / view.k, px = Math.max(ROCK_MPP * 2, 2.5 * inv);   // squares stay a few screen pixels at any zoom
  let s = "";
  for(const f of fxList){
    const t = (now - f.t0) / FX_DUST.life, spread = (.8 + 5 * t) * px, sz = px * (1 + t), snap = v => Math.round(v / px) * px;
    for(let i = 0; i < FX_DUST.n; i++){
      const a = f.seed + i * 6.28 / FX_DUST.n, x = f.x + snap(Math.cos(a) * spread) - sz / 2, y = f.y + snap(Math.sin(a) * spread * .7) - sz / 2 - t * px;
      s += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${sz.toFixed(2)}" height="${sz.toFixed(2)}" fill="${FX_DUST.cols[i % FX_DUST.cols.length]}" fill-opacity="${(1 - t).toFixed(2)}"/>`;
    }
  }
  layer.innerHTML = s;
}
// Escaped animals outside an exhibit: a species with a picture is drawn like it is in its pen (walk strip or rig, facing the way it goes, idle when it stops),
// with the red ring and the ! / z marker over it; otherwise (or zoomed far out) the old dot. Each loose animal keeps one element group (looseEls), so the rig and strip can animate.
const looseEls = new Map();
function drawLoose(){
  const layer = $("#looseLayer"), inv = 1/view.k;
  if(!state.safety || !state.safety.loose.length || !kGraph){ if(layer.childElementCount) layer.innerHTML = ""; looseEls.clear(); return; }
  const seen = new Set(), pulse = 1 + .25 * Math.sin(performance.now() / 180);
  for(const l of state.safety.loose){
    let p = loosePos(l);
    if(l.status === "carried"){ const c = crew.find(x => x.hunt === l); if(c && c.at) p = keeperPos(c); }
    if(!p) continue;
    seen.add(l);
    const sp = SPECIES_BY_ID[l.sp], S = SPRITES[l.sp];
    let h = looseEls.get(l);
    if(!h){
      const wrap = document.createElementNS("http://www.w3.org/2000/svg", "g"), art = document.createElementNS("http://www.w3.org/2000/svg", "g"), mark = document.createElementNS("http://www.w3.org/2000/svg", "g");
      wrap.setAttribute("pointer-events", "none"); wrap.append(art, mark); layer.appendChild(wrap);
      h = {wrap, el:art, mark, sp:l.sp, x:p[0], y:p[1], face:1, stride:0, pose:null, spr:null, viv:false, key:""};
      looseEls.set(l, h);
    }
    const dx = p[0] - h.x, dy = p[1] - h.y, step = Math.hypot(dx, dy);
    h.x = p[0]; h.y = p[1];
    const carried = l.status === "carried", spr = !carried && !!S && animalRadius(l.sp) * view.k >= 6, r = spr ? animalRadius(l.sp) : carried ? Math.max(.3, 4*inv) : Math.max(2.5, 7*inv), moving = step > .002 && l.status === "loose";
    h.r = r; const sed = l.status === "sedated"; h.act = sed ? "rest" : null; if(!sed) h.restAt = null;   // a sedated animal lies down (its rest clip) until a keeper picks it up
    if(spr !== h.spr || (spr && Math.abs(r - h.rr) > 1e-6)){   // picture appears, vanishes or resizes with zoom: draw it again
      h.spr = spr; h.rr = r; h.pose = null; h.rg = null;
      h.el.innerHTML = spr ? spriteSvg(l.sp, h) : "";
    }
    if(spr){
      if(moving && Math.abs(dx) > .0005){ const face = dx > 0 ? 1 : -1; if(face !== h.face){ h.face = face; const g = h.el.querySelector(".spr"); if(g) g.setAttribute("transform", `scale(${face} 1)`); } }
      if(moving){
        h.stride += step;
        if(rigOf(l.sp)) rigStep(h, "walk"); else if(S.walk) setPose(h, Math.floor(h.stride / (r * (S.step || .5))) % S.walk);
      }else if(rigOf(l.sp)) rigStep(h, sed ? "rest" : "idle"); else setPose(h, restPose(h, S));
    }
    h.wrap.setAttribute("transform", `translate(${p[0].toFixed(2)} ${p[1].toFixed(2)})${spr ? animalUp(h) : upright()}${carried ? " translate(0 -1.1)" : ""}`);   // carried: a lettered dot about a food crate's size, held at the keeper's hands
    let m = "";
    const rr = Math.max(r, 2.5);
    if(l.status === "loose") m += `<circle r="${(rr * 1.8 * pulse).toFixed(2)}" fill="none" stroke="#E5484D" stroke-width="2.5" vector-effect="non-scaling-stroke"/>`;
    if(!spr){
      m += `<circle r="${r}" fill="${PERIOD_COLOR[sp.period]}" stroke="${l.status === "loose" ? "#E5484D" : "#fff"}" stroke-width="${carried ? 1.5 : 2.5}" vector-effect="non-scaling-stroke"/>`
        + `<text class="glyph" font-size="${r*1.1}" style="fill:#1D2B22">${l.status === "loose" ? "!" : carried ? esc(sp.name[0]) : "z"}</text>`;
    }else m += `<text class="glyph" y="${(-r * 1.9).toFixed(2)}" font-size="${(r*1.1).toFixed(2)}" style="fill:${l.status === "loose" ? "#E5484D" : "#fff"}">${l.status === "loose" ? "!" : "z"}</text>`;
    if(m !== h.key){ h.key = m; h.mark.innerHTML = m; }
  }
  for(const [l, h] of looseEls) if(!seen.has(l)){ h.wrap.remove(); looseEls.delete(l); }
}

/* ---------- viewing platforms ---------- */
let platGhost = null;
function findPlatformSpot(clientX, clientY){
  const t = BUILDINGS.platform, p = toWorld(clientX, clientY); let best = null;
  for(const e of state.exhibits){
    if(e.viv) continue;
    for(let i = 0; i < e.points.length; i++){
      const a = e.points[i], b = e.points[(i+1) % e.points.length], r = segProj(p.x, p.y, a, b);
      if(r.d * view.k < 30 && (!best || r.d < best.d)) best = {e, r, a, b, d:r.d};
    }
  }
  if(!best) return null;
  const {e, r, a, b} = best, [cx, cy] = centroid(e.points);
  const L = Math.hypot(b[0]-a[0], b[1]-a[1]) || 1, ang = Math.atan2(b[1]-a[1], b[0]-a[0]);
  let nx = -(b[1]-a[1])/L, ny = (b[0]-a[0])/L;
  if((cx - r.x)*nx + (cy - r.y)*ny < 0){ nx = -nx; ny = -ny; }   // point the deck into the exhibit
  let x = r.x, y = r.y;
  const g = segProj(Math.round(x/GRID_STEP)*GRID_STEP, Math.round(y/GRID_STEP)*GRID_STEP, a, b); x = g.x; y = g.y;
  const off = t.d/2 - 1.5, pts = rectPts(x + nx*off, y + ny*off, t.w, t.d, ang);
  let why = null;
  if(!hasTech("platform")) why = "Research viewing platforms at the Research Lab first.";
  else if(!insidePlot(pts)) why = "Keep it inside the park boundary.";
  else if(state.exhibits.some(o => o !== e && shapesOverlap(pts, o.points))) why = "It overlaps another exhibit.";
  else if(state.buildings.some(o => shapesOverlap(pts, o.points))) why = "It overlaps a building.";
  else if(shapeHitsLandscape(pts)) why = shapeHitsLandscape(pts);
  else if(!canAfford(t.price)) why = `Costs ${money(t.price)}. You have ${money(state.money)}.`;
  return {e, pts, x:x + nx*off, y:y + ny*off, ok:!why, why};
}
function platformHover(ev){
  platGhost = findPlatformSpot(ev.clientX, ev.clientY);
  ghost = platGhost ? {pts:platGhost.pts, x:platGhost.x, y:platGhost.y, ok:platGhost.ok} : null;
  setStat(platGhost ? (platGhost.why || `${money(BUILDINGS.platform.price)}. Snaps to ${platGhost.e.name}'s edge. Guests reach it from a path.`) : "Point at an exhibit's fence.", platGhost && !platGhost.ok);
  renderOverlay();
}
function platformTap(ev){
  const g = findPlatformSpot(ev.clientX, ev.clientY);
  if(!g){ setStat("Tap an exhibit's fence.", true); return; }
  if(!g.ok){ setStat(g.why, true); return; }
  spend(BUILDINGS.platform.price, "built");
  const b = {id:uid("b-"), type:"platform", exhibitId:g.e.id, points:g.pts, inward:true, day:state.day};
  state.buildings.push(b);
  afterChange(); render();
  ui.toast(isReachable(b) ? `Built a viewing platform on ${g.e.name}. Guests will love it.` : "Built a viewing platform, but no guest path reaches it yet.", isReachable(b) ? "good" : "bad");
}

/* ---------- viewing galleries ---------- */
// A pool: an open exhibit with sea water in it, or pool animals
const isPool = e => !e.viv && (waterOf(e).some(w => SEA_WATER[w.kind]) || poolKinds(e).length > 0);
// The fence side of a pool nearest the pointer, and a gallery standing outside it, its long back wall GALLERY.gap off the fence; its door (face) points away from the pool
function findGallerySpot(clientX, clientY){
  const t = BUILDINGS.gallery, p = toWorld(clientX, clientY); let best = null;
  for(const e of state.exhibits){
    if(!isPool(e)) continue;
    for(let i = 0; i < e.points.length; i++){
      const a = e.points[i], b = e.points[(i+1) % e.points.length], r = segProj(p.x, p.y, a, b);
      if(r.d * view.k < 30 && (!best || r.d < best.d)) best = {e, r, a, b, d:r.d};
    }
  }
  if(!best) return null;
  const {e, r, a, b} = best, [cx, cy] = centroid(e.points);
  const L = Math.hypot(b[0]-a[0], b[1]-a[1]) || 1, ang = Math.atan2(b[1]-a[1], b[0]-a[0]);
  let nx = -(b[1]-a[1])/L, ny = (b[0]-a[0])/L;
  if((cx - r.x)*nx + (cy - r.y)*ny > 0){ nx = -nx; ny = -ny; }   // point it out of the pool
  const g = segProj(Math.round(r.x/GRID_STEP)*GRID_STEP, Math.round(r.y/GRID_STEP)*GRID_STEP, a, b), off = t.d/2 + GALLERY.gap;
  const x = g.x + nx*off, y = g.y + ny*off, pts = rectPts(x, y, t.w, t.d, ang);
  const face = FACE_DIR.reduce((k, d, j) => d[0]*nx + d[1]*ny > FACE_DIR[k][0]*nx + FACE_DIR[k][1]*ny ? j : k, 0);
  let why = null;
  if(!insidePlot(pts)) why = "Keep it inside the park boundary.";
  else if(state.exhibits.some(o => shapesOverlap(pts, o.points) || shapesOverlap(o.points, pts))) why = "It overlaps an exhibit.";
  else if(state.buildings.some(o => shapesOverlap(pts, o.points))) why = "It overlaps a building.";
  else if(bldOnPath("gallery", pts)) why = "It sits on a path.";
  else if(shapeHitsLandscape(pts)) why = shapeHitsLandscape(pts);
  else if(!canAfford(t.price)) why = `Costs ${money(t.price)}. You have ${money(state.money)}.`;
  return {e, pts, face, x, y, ok:!why, why};
}
let galGhost = null;
function galleryHover(ev){
  galGhost = findGallerySpot(ev.clientX, ev.clientY);
  ghost = galGhost ? {pts:galGhost.pts, x:galGhost.x, y:galGhost.y, ok:galGhost.ok} : null;
  setStat(galGhost ? (galGhost.why || `${money(BUILDINGS.gallery.price)}. Stands against ${galGhost.e.name}'s fence. Guests reach it from a path.`) : "Point at a pool's fence.", galGhost && !galGhost.ok);
  renderOverlay();
}
function galleryTap(ev){
  const g = findGallerySpot(ev.clientX, ev.clientY);
  if(!g){ setStat("Tap a pool's fence.", true); return; }
  if(!g.ok){ setStat(g.why, true); return; }
  spend(BUILDINGS.gallery.price, "built");
  const b = {id:uid("b-"), type:"gallery", exhibitId:g.e.id, points:g.pts, face:g.face, day:state.day};
  state.buildings.push(b);
  afterChange(); render();
  ui.toast(isReachable(b) ? `Built a viewing gallery on ${g.e.name}.` : "Built a viewing gallery, but no guest path reaches it yet.", isReachable(b) ? "good" : "bad");
}

/* ---------- crates standing in the park, and carrying one (science.js crates) ---------- */
// The crate picture for a species at (x, y): true size scaled to the animal (crateScale), never under 16 px across on screen, standing on its base
function crateArt(sp, x, y){
  const sc = crateScale(sp), P = ROCK_MPP * sc * Math.max(1, 16 / (14 * ROCK_MPP * sc * view.k)), vs = tilt ? 1 / TILT : 1, w = 14 * P, h = 17 * P * vs;
  return {w, h, x:x - w / 2, y:y - h + 2 * P * vs};
}
function crateSvg(c, on, inv){
  const g = crateArt(c.sp, c.x, c.y);
  return `<g data-kind="crate" data-id="${esc(c.id)}" style="cursor:pointer">${on ? `<circle cx="${c.x}" cy="${c.y}" r="${(g.w * .7).toFixed(2)}" fill="none" stroke="var(--sel)" stroke-width="2.5" vector-effect="non-scaling-stroke"/>` : ""}`
    + `<image href="${spriteUrl("sprites/crate.png")}" x="${g.x.toFixed(2)}" y="${g.y.toFixed(2)}" width="${g.w.toFixed(2)}" height="${g.h.toFixed(2)}" preserveAspectRatio="none" style="image-rendering:pixelated"/></g>`;
}
let crateSel = null, crateGhost = null, crateMode = "crate";   // the crate being carried (an id in crates(), or in specimens() when crateMode is "deliver"), and the ghost under the pointer: {x, y, e, r, open, why}
function startUncrate(id){ crateSel = id; crateMode = "crate"; crateGhost = null; closePanel(); setTool("uncrate"); }
// A finished specimen's crate rides the pointer; tapping an exhibit it fits queues its delivery (sendSpecimen, ui.js)
function startDeliver(id){ crateSel = id; crateMode = "deliver"; crateGhost = null; closePanel(); setTool("uncrate"); }
function startAnimalMove(id){ crateSel = id; crateMode = "move"; crateGhost = null; closePanel(); setTool("uncrate"); }   // an animal in an exhibit: pick where it goes
// The animal record the pointer is carrying, by mode
function crateRecord(){ return (crateMode === "ward" ? state.health.ward.map(x => x.a) : crateMode === "deliver" ? specimens() : crateMode === "move" ? state.exhibits.flatMap(e => e.animals) : crates()).find(x => x.id === crateSel); }
function startWardMove(id){ crateSel = id; crateMode = "ward"; crateGhost = null; closePanel(); setTool("uncrate"); }   // a PMC patient: pick where it goes once it's well
// Over an exhibit it fits, the crate opens there; anywhere else it's set down if the spot is free
function crateSpot(ev){
  const deliver = crateMode === "deliver" || crateMode === "ward" || crateMode === "move", p = toWorld(ev.clientX, ev.clientY), r = crateRecord();
  const e = state.exhibits.find(x => inPoly(p.x, p.y, x.points)) || null;
  if(!r) return {x:p.x, y:p.y, e, r, open:false, deliver, why:"That crate is gone."};
  if(deliver){ const why = e ? (crateMode === "move" && e === animalHome(r.id) ? "Already here." : crateProblem(r, e) || keeperMoveProblem(e)) : "Tap an exhibit."; return {x:p.x, y:p.y, e, r, open:!why, deliver, why}; }
  const open = !!e && !crateProblem(r, e);
  return {x:p.x, y:p.y, e, r, open, why:open ? null : crateSpotProblem(p.x, p.y, r.sp, r)};
}
function crateHover(ev){
  crateGhost = crateSpot(ev);
  const g = crateGhost, fight = g.r && g.open && g.e.animals.map(a => conflict(SPECIES_BY_ID[g.r.sp], SPECIES_BY_ID[a.sp])).find(x => x);
  if(g.deliver){ setStat(g.open ? (fight ? `Deliver it to ${g.e.name}. ${fight}` : `Deliver it to ${g.e.name}.`) : g.why, !g.open); renderOverlay(); return; }
  setStat(g.open ? (fight ? `Open it in ${g.e.name}. ${fight}` : `Open it in ${g.e.name}.`) : g.why || (g.e && g.r ? `${g.e.name}: ${crateProblem(g.r, g.e)} Set it down here.` : "Set it down here."), !g.open && !!g.why);
  renderOverlay();
}
// the crate at the pointer: over the exhibit it would open into (green), or red where it can't stand
function crateGhostSvg(g){
  if(!g.r) return "";
  const col = g.open ? "var(--good)" : "var(--bad)", a = crateArt(g.r.sp, g.x, g.y);
  return (g.open || (g.deliver && g.e) ? `<polygon points="${polyStr(g.e.points)}" fill="${col}" fill-opacity=".14" stroke="${col}" stroke-width="2" vector-effect="non-scaling-stroke" pointer-events="none"/>` : "")
    + `<image href="${spriteUrl("sprites/crate.png")}" x="${a.x.toFixed(2)}" y="${a.y.toFixed(2)}" width="${a.w.toFixed(2)}" height="${a.h.toFixed(2)}" preserveAspectRatio="none" opacity="${g.open || !g.why ? .95 : .55}" style="image-rendering:pixelated" pointer-events="none"/>`;
}
function crateTap(ev){
  const g = crateSpot(ev);
  if(!g.r){ setStat(g.why, true); return; }
  if(g.deliver){
    if(!g.open){ setStat(g.why, true); return; }
    const r = g.r, e = g.e, mode = crateMode; crateSel = null; crateGhost = null; setTool("select");
    if(mode === "ward") sendPatient(r, e); else if(mode === "move") sendMove(r, e); else sendSpecimen(r, e);
    return;
  }
  if(g.why){ setStat(g.why, true); return; }
  const s = SPECIES_BY_ID[g.r.sp], name = g.r.name || s.name, id = g.r.id;
  if(g.open){ uncrate(id, g.e); sel = null; }
  else { moveCrate(id, g.x, g.y); sel = {kind:"crate", id}; }
  crateSel = null; crateGhost = null; setTool("select");
  afterChange(); render();
  if(g.open) ui.toast(`${name} is out of its crate in ${g.e.name}.`, "good");
}

/* ---------- rocks, groves and shelters ---------- */
// The pointer's spot in the world; landSpot snaps it so a plant's or rock's square covers whole cells (odd sides on a cell center, even on a grid corner)
function landPoint(ev){
  const p = toWorld(ev.clientX, ev.clientY);
  return {x:p.x, y:p.y};
}
function landHover(ev){
  const key = landKey(tool), p = landPoint(ev);
  const hadBiome = rockBiomeNow();
  landGhost = {...landSpot(p.x, p.y, key), key};
  if(rockBiomeNow() !== hadBiome) refreshShapes();   // the exhibit under the cursor changed the stone biome
  setStat(landGhost.why || `${money(LAND[key].price)}. It goes ${landGhost.e ? "in " + landGhost.e.name : "out in the park"}.`, !landGhost.ok);
  renderOverlay();
}
function landTap(ev){
  const key = landKey(tool), p = landPoint(ev), g = landSpot(p.x, p.y, key);
  if(!g.ok){ setStat(g.why, true); return; }
  placeLand(g.e, key, g.x, g.y, rockBiome || (g.e ? null : parkBiome()), g.pic);
  if(rockRoll[key] !== undefined) rockRoll[key] = Math.random();
  afterChange(); render();
  ui.toast(g.e ? `Added ${LAND[key].one} to ${g.e.name}.` : `Added ${LAND[key].one} to the park.`, "good");
}

/* ---------- bulldozing ---------- */
function bulldozeTap(kind, id){
  if(!kind){ setStat(""); render(); return; }
  if(kind === "gate"){ const e = findItem("exhibit", id); if(e) confirmGateRemoval(e); return; }
  if(kind === "water" || kind === "crate") return;   // water goes by painting ground over it; a crate is sold from its panel
  const it = findItem(kind, id);
  if(!it) return;
  bulldozeItem(kind, it);
}

// Bulldozing goes at once. Exhibits, staff buildings and big guest buildings ask first.
const asksBulldoze = (kind, it) => kind === "building" && !!(BUILDINGS[it.type].dept || BUILDINGS[it.type].confirm);
function bulldozeItem(kind, it){
  if(kind === "exhibit"){ confirmExhibitRemoval(it); return; }
  const go = () => { if(!findItem(kind, it.id)) return; const r = refundFor(kind, it); removeItem(kind, it); setStat(`Bulldozed for ${money(r)} back.`); };
  if(!asksBulldoze(kind, it)){ go(); return; }
  const t = BUILDINGS[it.type];
  if(it.type === "pmc"){ askConfirm("Demolish Paleo-Medicine Center?", "Are you sure you want to demolish the Paleo-Medicine Center? All animals will be returned to their exhibits.", "Yes", go, "No"); return; }
  askConfirm(`Bulldoze ${t.label}?`, `This removes the ${t.label} from your park and gives back ${money(refundFor(kind, it))}. Are you sure?`, "Bulldoze", go);
}

// Exhibits hold animals, so bulldozing one asks first
function confirmExhibitRemoval(e){
  askConfirm(`Delete ${e.name}?`, `You are about to delete ${e.name}. Pool animals go into crates and the rest get out. This removes it from your park${e.grid ? ", fence included" : ""}. Are you sure?`, "Yes", () => {
    if(!findItem("exhibit", e.id)) return;
    removeItem("exhibit", e); setStat("");
  }, "No");
}

// Without its gate a fenced pen stops being an exhibit: the animals and contents go, the fence stays
function confirmGateRemoval(e){
  askConfirm(`Remove the gate on ${e.name}?`, `Without its gate ${e.name} is no longer an exhibit. Pool animals go into crates and the rest get out. Everything inside is sold, but the fence stays. Are you sure?`, "Yes", () => {
    if(!findItem("exhibit", e.id)) return;
    removeItem("exhibit", e, {keepFence:true}); setStat("");
  }, "No");
}

// An exhibit going takes its fence: pool animals are crated at once, everything else gets out
function releaseAnimals(e){
  let out = 0;
  for(const a of e.animals.slice()){
    if(SPECIES_BY_ID[a.sp]?.pool) crateAnimal(e, a);
    else { turnLoose(e, a); out++; }
  }
  if(out) events.toast(`${out} animal${out === 1 ? "" : "s"} got out of ${e.name}.`, "bad");
}

function removeItem(kind, it, opts = {}){
  const lift = kind === "exhibit" && it.grid && !opts.keepFence ? ownPieces(it) : [];
  if(kind === "exhibit" && it.grid && !opts.keepFence) releaseSides(it);   // its side of a wall it shares goes; the neighbor's stays
  const refund = refundFor(kind, it) - (opts.keepFence && it.grid ? Math.round(ownPieceCost(it) * COST.refundShare) : 0);
  earn(refund, "sold");
  if(kind === "land"){ const o = state.exhibits.find(x => landOf(x).includes(it)), l = o ? o.land : state.decor; l.splice(l.indexOf(it), 1); }
  else if(kind === "water"){ const o = state.exhibits.find(x => waterOf(x).includes(it)), l = o ? o.water : state.water; l.splice(l.indexOf(it), 1); if(mvCorner && mvCorner.id === it.id) mvCorner = null; }
  else { const l = listFor(kind); l.splice(l.indexOf(it), 1); }
  if(kind === "building" && it.type === "pmc") pmcRemoved(it);
  if(kind === "zone") dropZone(it.id);
  // viewing platforms and galleries go with their exhibit
  if(kind === "exhibit") state.buildings = state.buildings.filter(b => b.exhibitId !== it.id);
  if(kind === "exhibit" && it.grid) for(const k of lift) delete fencePieces()[k];
  if(kind === "exhibit") releaseAnimals(it);   // with the fence and platforms gone, crates and escapees can stand where the exhibit was
  if(sel && sel.id === it.id) sel = null;
  afterChange();
  render(); ui.panel();
}

/* ---------- moving things ---------- */
// What can be dragged: buildings (not platforms or galleries, which ride with their exhibit), exhibits, paths (not the entrance walk) and open fences
function moveTarget(hit){
  if(!hit.kind) return null;
  const it = findItem(hit.kind, hit.id);
  if(!it || !["exhibit", "path", "building", "fence", "land"].includes(hit.kind)) return null;
  if(it.exhibitId){ setStat(`A ${BUILDINGS[it.type].label.toLowerCase()} rides with its exhibit. Move the exhibit.`, true); return null; }
  if(it.grid){ setStat("A fenced exhibit stays where its fence is. Lift the fence with Bulldoze and lay it again.", true); return null; }
  return it;
}
const shiftPts = (pts, dx, dy) => pts.map(p => [p[0] + dx, p[1] + dy]);
// Why this item can't sit at its new spot, or null. Mirrors the checks for building it fresh.
function moveProblem(kind, it){
  const pts = it.points;
  if(!insidePlot(pts)) return "Keep it inside the park boundary.";
  if(kind === "exhibit"){
    if(state.exhibits.some(e => e !== it && shapesOverlap(pts, e.points))) return "It overlaps another exhibit.";
    if(state.buildings.some(b => parkGround(b) && b.exhibitId !== it.id && shapesOverlap(pts, b.points))) return "It overlaps a building.";
    if(state.paths.some(p => lineEntersShape(p.points, pts))) return "A path runs through it.";
    return shapeHitsLandscape(pts);
  } else if(kind === "building"){
    if(state.exhibits.some(e => shapesOverlap(pts, e.points))) return "It overlaps an exhibit.";
    if(state.buildings.some(b => b !== it && shapesOverlap(pts, b.points))) return "It overlaps another building.";
    if(BUILDINGS[it.type].onPath){ if(!shapeOnGuestPath(pts)) return "Keep it on a path."; }
    else if(bldOnPath(it.type, pts)) return "It sits on a path.";
    return shapeHitsLandscape(pts);
  } else if(kind === "fence"){
    const keep = state.fences; state.fences = keep.filter(l => l !== it);
    const why = fenceProblem(pts, it.barrier, true); state.fences = keep;
    return why;
  } else {
    if(state.exhibits.some(e => lineEntersShape(pts, e.points))) return "Paths can't go through an exhibit.";
    if(state.buildings.some(b => !BUILDINGS[b.type].onPath && lineEntersShape(pts, b.points))) return "Paths can't go through a building.";
    return lineHitsLandscape(pts, halfWidth(it), isBridge(it));
  }
}
// Everything that moves with the item: its own points, an exhibit's gate and platforms, and the animals wandering inside
function moveBy(m, dx, dy){
  const it = m.it;
  if(m.kind === "land"){ it.x = m.x0 + dx; it.y = m.y0 + dy; m.dx = dx; m.dy = dy; return; }
  it.points = shiftPts(m.orig, dx, dy);
  if(m.gate) it.gate = [m.gate[0] + dx, m.gate[1] + dy];
  for(const pl of m.plats) pl.b.points = shiftPts(pl.pts, dx, dy);
  for(const l of m.land){ l.f.x = l.x + dx; l.f.y = l.y + dy; }
  for(const w of m.water) w.w.points = shiftPts(w.pts, dx, dy);
  m.dx = dx; m.dy = dy;
}
function startMove(it, kind, e){
  const w = toWorld(e.clientX, e.clientY);
  if(kind === "land") return {it, kind, wx:w.x, wy:w.y, dx:0, dy:0, x0:it.x, y0:it.y, from:state.exhibits.find(o => landOf(o).includes(it)) || null, spot:null};
  return {it, kind, wx:w.x, wy:w.y, dx:0, dy:0, orig:it.points.map(p => p.slice()), gate:it.gate ? it.gate.slice() : null,
    plats:kind === "exhibit" ? state.buildings.filter(b => b.exhibitId === it.id).map(b => ({b, pts:b.points.map(p => p.slice())})) : [],
    land:kind === "exhibit" ? landOf(it).map(f => ({f, x:f.x, y:f.y})) : [],
    water:kind === "exhibit" ? waterOf(it).map(w => ({w, pts:w.points.map(p => p.slice())})) : []};
}
// An exhibit that holds water moves in whole 5 m chunks, so its water stays on the chunk grid like paths and paint
const moveStep = m => m.water.length ? CHUNK : GRID_STEP;
function dragMove(m, e){
  const w = toWorld(e.clientX, e.clientY);
  if(m.kind === "land"){
    const sp = m.spot = landMoveSpot(m, w.x, w.y);
    moveBy(m, sp.x - m.x0, sp.y - m.y0);
    setStat(sp.why || "Let go to drop it here.", !sp.ok);
    queueRender(); renderOverlay(); return;
  }
  const g = moveStep(m);
  let dx = Math.round((w.x - m.wx) / g) * g, dy = Math.round((w.y - m.wy) / g) * g;
  if(m.kind === "building" && snapsToChunks(BUILDINGS[m.it.type])){ const b = bbox(m.orig); dx = Math.round((b.x0 + w.x - m.wx) / CHUNK) * CHUNK - b.x0; dy = Math.round((b.y0 + w.y - m.wy) / CHUNK) * CHUNK - b.y0; }   // buildings land on the chunk grid even if they stood off it
  moveBy(m, dx, dy);
  const why = moveProblem(m.kind, m.it);
  m.why = why; setStat(why || "Let go to drop it here.", !!why);
  queueRender();
}
// Drop a land item: it keeps its id and moves between exhibits and the park's decor for free
function dropLand(m){
  const sp = m.spot, f = m.it, from = m.from;
  if(!sp || !sp.ok || (!m.dx && !m.dy)){ moveBy(m, 0, 0); if(sp && !sp.ok) ui.toast(`Couldn't move it. ${sp.why}`, "bad"); setStat(""); render(); return; }
  const to = sp.e;
  if(to !== from){
    const old = from ? from.land : state.decor;
    old.splice(old.indexOf(f), 1);
    if(ROCK_TYPES.includes(f.type) && !BIOMES[f.biome]) f.biome = from ? biomeOf(from) : parkBiome();   // a rock keeps the stone it had
    if(to) (to.land = to.land || []).push(f); else (state.decor = state.decor || []).push(f);
    for(const h of herd.values()) if(h.exhibitId === (from && from.id) || h.exhibitId === (to && to.id)) h.path = null;
  }
  if(sp.pic != null && ROCK_TYPES.includes(f.type) && f.pic == null) f.pic = sp.pic;   // pin the picture it was showing
  if(from && from.viv) regatherViv(from);
  afterChange(); render(); ui.toast("Moved."); setStat("");
}
function dropMove(m){
  if(m.kind === "land"){ dropLand(m); return; }
  const why = moveProblem(m.kind, m.it);
  if(why || (!m.dx && !m.dy)){ moveBy(m, 0, 0); if(why) ui.toast(`Couldn't move it. ${why}`, "bad"); setStat(""); render(); return; }
  if(m.kind === "exhibit"){
    for(const h of herd.values()) if(h.exhibitId === m.it.id){ h.x += m.dx; h.y += m.dy; h.path = null; }
  }
  afterChange(); render();
  const it = m.it, reach = m.kind === "fence" || (m.kind === "path" ? (isService(it) ? derived.joinedAll : derived.joined).has(it.id) : isReachable(it));
  ui.toast(reach ? "Moved." : "Moved, but it doesn't reach the entrance from there.", reach ? "" : "bad");
  setStat("");
}

// Reshaping an exhibit: drag a corner, drag a + to add one, tap a corner and delete it
// Every shape that can be reshaped: each open exhibit's fence. Water isn't reshaped: it is laid in 5 m chunks.
function reshapeables(){
  const out = [];
  for(const e of state.exhibits){ if(e.viv) continue; if(!e.grid) out.push({e, t:e}); }
  return out;
}
// Corners first, then the + in the middle of each edge
function cornerAt(clientX, clientY){
  const p = toWorld(clientX, clientY), R = 14 / view.k, all = reshapeables();
  for(const s of all) for(let i = 0; i < s.t.points.length; i++) if(Math.hypot(p.x - s.t.points[i][0], p.y - s.t.points[i][1]) < R) return {...s, i, type:"v"};
  for(const s of all){
    const P = s.t.points;
    for(let i = 0; i < P.length; i++){ const a = P[i], b = P[(i + 1) % P.length]; if(Math.hypot(p.x - (a[0] + b[0]) / 2, p.y - (a[1] + b[1]) / 2) < R) return {...s, i, type:"m"}; }
  }
  return null;
}
// A reshape in progress (r.t is the exhibit being changed)
const rvProblem = r => reshapeProblem(r.e, r.orig);
function rvStat(r){
  const diff = reshapeCost(r.e, r.orig);
  return `${fmtArea(area(r.e.points))}. ${diff > 0 ? "Extra fence " + money(diff) : diff < 0 ? "Fence refund " + money(Math.round(-diff * COST.refundShare)) : "No change in fence"}`;
}
const rvCommit = r => commitReshape(r.e, r.orig);
const reshapeCost = (e, orig) => exhibitCost(e.points, e.barrier) - exhibitCost(orig, e.barrier);
// Why this exhibit's new outline won't work, or null
function reshapeProblem(e, orig){
  const pts = e.points;
  if(selfCrosses(pts)) return "The fence crosses itself.";
  if(!insidePlot(pts)) return "Keep it inside the park boundary.";
  if(area(pts) < 60) return "Too small. Exhibits need at least 60 m².";
  if(state.exhibits.some(x => x !== e && shapesOverlap(pts, x.points))) return "It overlaps another exhibit.";
  if(state.buildings.some(b => parkGround(b) && b.exhibitId !== e.id && shapesOverlap(pts, b.points))) return "It overlaps a building.";
  if(state.paths.some(p => lineEntersShape(p.points, pts))) return "A path runs through it.";
  const hit = shapeHitsLandscape(pts); if(hit) return hit;
  if(state.buildings.some(b => b.exhibitId === e.id)) return "Take down its viewing platforms and galleries first.";
  if(landOf(e).some(f => LAND[f.type] && !rectsInside(footRects(f, e), pts))) return "A rock, grove or shelter would end up outside the fence. Bulldoze it first.";
  if(waterOf(e).some(w => !insideFence(w.points, pts, WATER.margin))) return "Some water would end up outside the fence. Reshape or bulldoze it first.";
  const diff = reshapeCost(e, orig);
  if(diff > 0 && !canAfford(diff)) return `The new fence costs ${money(diff)} more. You have ${money(state.money)}.`;
  return null;
}
function updateMoveBar(){ if(tool === "move"){ $("#dUndo").disabled = !mvCorner; $("#dFinish").disabled = !(mvSel && findItem("building", mvSel)); } }
// Pay or refund for the new fence, keep the gate on the wall, and rebuild the routes
function commitReshape(e, orig){
  const diff = reshapeCost(e, orig);
  if(diff > 0) spend(diff, "built"); else if(diff < 0) earn(Math.round(-diff * COST.refundShare), "sold");
  if(e.gate){
    let best = null;
    for(let i = 0; i < e.points.length; i++){ const r = segProj(e.gate[0], e.gate[1], e.points[i], e.points[(i + 1) % e.points.length]); if(!best || r.d < best.d) best = r; }
    e.gate = [best.x, best.y];
  }
  afterChange(); render();
  ui.toast(diff > 0 ? `Reshaped ${e.name}. The extra fence cost ${money(diff)}.` : diff < 0 ? `Reshaped ${e.name}. You got ${money(Math.round(-diff * COST.refundShare))} back.` : `Reshaped ${e.name}.`);
}
function deleteMoveCorner(){
  const s = mvCorner && reshapeables().find(x => x.t.id === mvCorner.id); if(!s) return;
  if(s.t.points.length <= 3){ setStat(s.w ? "Water needs at least 3 corners." : "An exhibit needs at least 3 corners.", true); return; }
  const r = {...s, orig:s.t.points.map(p => p.slice())}; s.t.points.splice(mvCorner.i, 1);
  const why = rvProblem(r);
  if(why){ s.t.points = r.orig; setStat(why, true); return; }
  mvCorner = null; updateMoveBar(); rvCommit(r);
}

/* ---------- moving the view ---------- */
function svgSize(){ const r = svg.getBoundingClientRect(); return {w:r.width, h:r.height}; }
function fit(){
  const {w, h} = svgSize(); if(!w || !h) return;
  const b = tool === "parcels" ? {x0:PARCELS.xs[0], y0:PARCELS.ys[0], x1:PARCELS.xs[PARCELS.xs.length-1], y1:SOUTH_LINE} : ownedBox(), pad = 40;
  view.k = clamp(Math.min((w - pad*2)/(b.x1 - b.x0), (h - pad*2)/((b.y1 - b.y0)*tf())), KMIN, KMAX);
  view.tx = (w - (b.x1 - b.x0)*view.k)/2 - b.x0*view.k;
  view.ty = (h - (b.y1 - b.y0)*ky())/2 - b.y0*ky();
  render();
}
// Keep the park on screen: the view can't scroll more than a margin past the land you own (a thin one to the south, where there's nothing)
function clampView(){
  const {w, h} = svgSize(); if(!w || !h) return;
  const b = tool === "parcels" ? {x0:PARCELS.xs[0], y0:PARCELS.ys[0], x1:PARCELS.xs[PARCELS.xs.length-1], y1:SOUTH_LINE} : ownedBox(), k = view.k, kk = ky(), m = 60;
  // world x/y at the screen center must stay within the box plus a margin
  const cx = (w/2 - view.tx)/k, cy = (h/2 - view.ty)/kk;
  const nx = clamp(cx, b.x0 - m, b.x1 + m), ny = clamp(cy, b.y0 - m, b.y1 + 20);
  view.tx = w/2 - nx*k; view.ty = h/2 - ny*kk;
}
function zoomAt(mx, my, f){
  const k = clamp(view.k * f, KMIN, KMAX), wx = (mx - view.tx)/view.k, wy = (my - view.ty)/ky();
  view.k = k; view.tx = mx - wx*k; view.ty = my - wy*ky(); clampView(); queueRender();
}
function centerOn(it){
  if(!it) return;
  const {w, h} = svgSize(), b = bbox(it.points);
  const cx = (b.x0 + b.x1)/2, cy = (b.y0 + b.y1)/2 + (window.matchMedia("(max-width:760px)").matches ? h*.2/ky() : 0);
  view.tx = w/2 - cx*view.k; view.ty = h/2 - cy*ky(); render();
}

/* ---------- picking things ---------- */
function select(kind, id){
  sel = kind ? {kind, id} : null;
  if(kind) officeOpen = false;
  render(); ui.panel();
  if(kind && focusMode()){ const it = selItem(); ui.toast(`Selected ${it && (it.name || BUILDINGS[it.type]?.label) || kind}. Press H to show the panel.`); return; }
}

/* ---------- pointer and touch ---------- */
let drag = null, pinch = null;
const pointers = new Map();

function itemAt(target){
  const t = target.closest && target.closest("[data-kind]");
  return t ? {kind:t.dataset.kind, id:t.dataset.id} : {kind:null, id:null};
}

svg.addEventListener("pointerdown", e => {
  if(e.button > 2) return;
  svg.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, {x:e.clientX, y:e.clientY});
  // the middle or right button always pans, whatever the tool
  if(e.button > 0){ drag = {sx:e.clientX, sy:e.clientY, tx:view.tx, ty:view.ty, moved:false, pan:true, hit:{kind:null, id:null}}; return; }
  if(pointers.size === 2){
    drag = null; if(fdrag || pdrag || cdrag || wdrag){ fdrag = null; pdrag = null; cdrag = null; wdrag = null; renderOverlay(); } const [a, b] = [...pointers.values()];
    pinch = {d:Math.hypot(a.x-b.x, a.y-b.y) || 1, k:view.k, ky:ky(), tx:view.tx, ty:view.ty, mx:(a.x+b.x)/2, my:(a.y+b.y)/2};
    return;
  }
  if(pointers.size > 2) return;
  if(tool === "zoneedit"){
    const h = zoneHandleAt(e.clientX, e.clientY), z = h && zedit && zoneById(zedit.id);
    if(h && z){
      const start = z.points.map(p => p.slice());
      let i = h.i;
      if(h.type === "m"){ const a = z.points[i], b = z.points[(i + 1) % z.points.length]; z.points.splice(i + 1, 0, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]); i++; }
      drag = {zv:i, sx:e.clientX, sy:e.clientY, moved:false, added:h.type === "m", start, hit:{kind:null, id:null}};
      return;
    }
  }
  if(tool === "move"){
    const c = cornerAt(e.clientX, e.clientY);
    if(c){
      const orig = c.t.points.map(p => p.slice());
      if(c.type === "m"){ const a = orig[c.i], b = orig[(c.i + 1) % orig.length]; c.t.points.splice(c.i + 1, 0, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]); c.i++; }
      drag = {rv:{e:c.e, t:c.t, w:c.w, i:c.i, orig, added:c.type === "m"}, sx:e.clientX, sy:e.clientY, moved:false, hit:{kind:null, id:null}};
      return;
    }
    const hit = itemAt(e.target), it = moveTarget(hit);
    if(it){ mvSel = hit.kind === "building" ? it.id : null; updateMoveBar(); drag = {mv:startMove(it, hit.kind, e), sx:e.clientX, sy:e.clientY, moved:false, hit}; render(); return; }
  }
  if(mvSel && tool === "move"){ mvSel = null; updateMoveBar(); render(); }
  if(isPathTool(tool)){
    const c = chunkAtEv(e); cdrag = {a:c, b:c, kind:PATH_TOOLS[tool]}; chover = null;
    drag = {cd:true, sx:e.clientX, sy:e.clientY, moved:false, hit:{kind:null, id:null}}; pathDragStat(); renderOverlay(); return;
  }
  if(tool === "paint"){
    const c = chunkAtEv(e);
    pdrag = {a:c, b:c}; drag = {pd:true, sx:e.clientX, sy:e.clientY, moved:false, hit:{kind:null, id:null}}; paintDragStat(); renderOverlay(); return;
  }
  if(tool === "water"){
    const c = chunkAtEv(e); wdrag = {a:c, b:c};
    drag = {wd:true, sx:e.clientX, sy:e.clientY, moved:false, hit:{kind:null, id:null}}; waterDragStat(); renderOverlay(); return;
  }
  if(tool === "exhibit" || tool === "bulldoze"){
    const gx = tool === "bulldoze" ? gateNear(e.clientX, e.clientY) : null;
    if(gx){ drag = {sx:e.clientX, sy:e.clientY, tx:view.tx, ty:view.ty, moved:false, hit:{kind:"gate", id:gx.id}}; return; }
    const w = toWorld(e.clientX, e.clientY), first = tool === "bulldoze" ? pieceNear(w.x, w.y, Math.max(.6, 10 / view.k)) : null;
    if(tool === "bulldoze" && !first && !itemAt(e.target).kind){   // empty ground: drag a box over fence to lift it
      fdrag = {a:[w.x, w.y], b:[w.x, w.y], lift:true, box:true, swept:new Set(), last:w}; fhover = null;
      drag = {fd:true, sx:e.clientX, sy:e.clientY, moved:false, hit:{kind:null, id:null}}; return;
    }
    if(tool === "exhibit" || first){ const g = gridAt(e); fdrag = {a:g, b:g, lift:!!first, first, swept:new Set(first ? [first] : []), last:w, w}; fhover = null; drag = {fd:true, sx:e.clientX, sy:e.clientY, moved:false, hit:{kind:null, id:null}}; fenceDragStat(); renderOverlay(); return; }
  }
  drag = {sx:e.clientX, sy:e.clientY, tx:view.tx, ty:view.ty, moved:false, hit:itemAt(e.target)};
});

svg.addEventListener("pointermove", e => {
  if(!pointers.has(e.pointerId)){
    // mouse hovering with no button held
    if(e.pointerType !== "mouse") return;
    if(draw){ const sn = snapAt(e.clientX, e.clientY, e); draw.hover = [sn.x, sn.y]; snapMark = sn.info ? [sn.x, sn.y] : null; updateDrawbar(); renderOverlay(); }
    else if(tool === "platform") platformHover(e);
    else if(tool === "gallery") galleryHover(e);
    else if(tool === "uncrate") crateHover(e);
    else if(landKey(tool)) landHover(e);
    else if(isBuildTool(tool)){ placeGhost(e.clientX, e.clientY); renderOverlay(); }
    else if(tool === "gate") gateHover(e);
    else if(tool === "exhibit"){ snapMark = gridAt(e); renderOverlay(); }
    else if(isPathTool(tool)){ chover = chunkAtEv(e); renderOverlay(); }
    else if(tool === "bulldoze"){
      // a fence piece under the pointer wins over the exhibit behind it
      const w = toWorld(e.clientX, e.clientY), gx = gateNear(e.clientX, e.clientY), k = gx ? null : pieceNear(w.x, w.y, Math.max(.6, 10 / view.k));
      if(gx) setStat(`Tap to take out the gate. That removes ${gx.name}, but leaves its fence.`, true);
      const h = k ? {kind:null} : itemAt(e.target), nh = h.kind ? h : null;
      const pc = !k && !nh && !gx && pathAt(w.x, w.y) && !pathFixedChunks()[chunkKey(...chunkAt(w.x, w.y))] ? chunkAt(w.x, w.y) : null;
      if(k !== fhover || String(pc) !== String(chover)){ fhover = k; chover = pc; renderOverlay(); }
      if(JSON.stringify(nh) !== JSON.stringify(hoverItem)){ hoverItem = nh; queueRender(); }
    }
    return;
  }
  pointers.set(e.pointerId, {x:e.clientX, y:e.clientY});
  if(pinch && pointers.size === 2){
    const [a, b] = [...pointers.values()], d = Math.hypot(a.x-b.x, a.y-b.y) || 1;
    const r = svg.getBoundingClientRect(), k = clamp(pinch.k * d / pinch.d, KMIN, KMAX);
    const wx = (pinch.mx - r.left - pinch.tx)/pinch.k, wy = (pinch.my - r.top - pinch.ty)/pinch.ky;
    const mx = (a.x+b.x)/2 - r.left, my = (a.y+b.y)/2 - r.top;
    view.k = k; view.tx = mx - wx*k; view.ty = my - wy*ky(); queueRender(); return;
  }
  if(drag && drag.zv !== undefined){
    const z = zedit && zoneById(zedit.id); if(!z) return;
    if(!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 4) return;
    drag.moved = true;
    const w = toWorld(e.clientX, e.clientY), g = GRID_STEP;
    z.points[drag.zv] = [Math.round(w.x / g) * g, Math.round(w.y / g) * g];
    const why = zoneProblem(z.points);
    setStat(why || `${fmtArea(area(z.points))}`, !!why);
    queueRender(); return;
  }
  if(!drag) return;
  if(drag.cd){ const c = chunkAtEv(e); drag.moved = true; if(cdrag && (c[0] !== cdrag.b[0] || c[1] !== cdrag.b[1])){ cdrag.b = c; pathDragStat(); renderOverlay(); } return; }
  if(drag.pd){ const c = chunkAtEv(e); if(pdrag && (c[0] !== pdrag.b[0] || c[1] !== pdrag.b[1])){ pdrag.b = c; paintDragStat(); renderOverlay(); } return; }
  if(drag.wd){ const c = chunkAtEv(e); if(wdrag && (c[0] !== wdrag.b[0] || c[1] !== wdrag.b[1])){ wdrag.b = c; waterDragStat(); renderOverlay(); } return; }
  if(drag.fd){
    if(fdrag.box){
      if(!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) return;
      drag.moved = true;
      const w = toWorld(e.clientX, e.clientY); fdrag.b = [w.x, w.y];
      fdrag.swept = new Set(Object.keys(fencePieces()).filter(k => { const [p, q] = pieceEnds(k); return segHitsRect(p, q, fdrag.a, fdrag.b); }));
      fenceDragStat(); renderOverlay(); return;
    }
    if(fdrag.lift){
      // sweep: every piece the pointer passes over joins the lift
      drag.moved = true;
      const w = toWorld(e.clientX, e.clientY), l = fdrag.last, r = Math.max(.6, 10 / view.k);
      const n = Math.max(1, Math.ceil(Math.hypot(w.x - l.x, w.y - l.y) / .25)), before = fdrag.swept.size;
      for(let i = 1; i <= n; i++){ const k = pieceNear(l.x + (w.x - l.x) * i / n, l.y + (w.y - l.y) * i / n, r); if(k) fdrag.swept.add(k); }
      fdrag.last = w;
      if(fdrag.swept.size !== before){ fenceDragStat(); renderOverlay(); }
      return;
    }
    const g = gridAt(e), moved = g[0] !== fdrag.b[0] || g[1] !== fdrag.b[1]; drag.moved = true; fdrag.w = toWorld(e.clientX, e.clientY); fdrag.b = g;
    if(moved || fenceOpts().side !== fdrag.side){ fenceDragStat(); renderOverlay(); }
    return;
  }
  if(drag.rv){
    if(!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 4) return;
    drag.moved = true;
    const r = drag.rv, w = toWorld(e.clientX, e.clientY), g = GRID_STEP;
    r.t.points[r.i] = [Math.round(w.x / g) * g, Math.round(w.y / g) * g];
    const why = rvProblem(r);
    setStat(why || rvStat(r), !!why);
    queueRender(); return;
  }
  if(drag.mv){
    if(!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 5) return;
    drag.moved = true; dragMove(drag.mv, e); return;
  }
  const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
  if(!drag.moved && Math.hypot(dx, dy) < 6) return;
  drag.moved = true;
  view.tx = drag.tx + dx; view.ty = drag.ty + dy; clampView(); applyTransform();
});

function endPointer(e){
  pointers.delete(e.pointerId);
  if(pinch){ if(pointers.size < 2) pinch = null; drag = null; render(); return; }
  if(!drag) return;
  const d = drag; drag = null;
  if(d.cd){ if(cdrag) endPathDrag(); return; }
  if(d.pd){ if(pdrag) endPaintDrag(); return; }
  if(d.wd){ if(wdrag) endWaterDrag(); return; }
  if(d.fd){ if(fdrag) endFenceDrag(); return; }
  if(d.pan){ if(d.moved) render(); return; }
  if(d.mv){ if(d.moved) dropMove(d.mv); return; }
  if(d.rv){
    const r = d.rv;
    if(!d.moved){
      // a tap on a corner picks it; a tap on a + that just added a corner undoes the addition
      if(r.added) r.t.points = r.orig; else mvCorner = mvCorner && mvCorner.id === r.t.id && mvCorner.i === r.i ? null : {id:r.t.id, i:r.i};
      updateMoveBar(); render(); return;
    }
    const why = rvProblem(r);
    if(why){ r.t.points = r.orig; ui.toast(`Couldn't reshape it. ${why}`, "bad"); setStat(""); render(); return; }
    mvCorner = {id:r.t.id, i:r.i}; updateMoveBar(); setStat(""); rvCommit(r); return;
  }
  if(d.zv !== undefined){
    const z = zedit && zoneById(zedit.id);
    if(z){
      if(d.moved){ const why = zoneProblem(z.points); if(why){ z.points = d.start; setStat(why, true); } else zedit.sel = d.zv; }
      else zedit.sel = zedit.sel === d.zv && !d.added ? null : d.zv;
      updateZoneEditBar();
    }
    render(); return;
  }
  if(d.moved){ render(); return; }
  if(tool === "zoneedit") return;
  // a tap
  if(draw){ drawTap(e); return; }
  if(tool === "parcels"){ parcelTap(e); return; }
  if(tool === "platform"){ platformTap(e); return; }
  if(tool === "gallery"){ galleryTap(e); return; }
  if(tool === "uncrate"){ crateTap(e); return; }
  if(landKey(tool)){ landTap(e); return; }
  if(isBuildTool(tool)){ placeBuilding(e); return; }
  if(tool === "gate"){ gateTap(e); return; }
  if(tool === "bulldoze"){ bulldozeTap(d.hit.kind, d.hit.id); return; }
  if(d.hit.kind === "entrance" && (!tool || tool === "select")){ openParkOffice(); return; }
  if(!tool || tool === "select"){ const w = staffAt(e.clientX, e.clientY); if(w){ staffSelName = w.name; select("staff", w.id); return; } const g = guestAt(e.clientX, e.clientY); if(g){ guestSelName = g.name; select("guest", g.id); return; } const an = animalAt(e.clientX, e.clientY); if(an){ animalSelName = an.name; select("animal", an.id); return; } }
  if(d.hit.kind) select(d.hit.kind, d.hit.id); else if(sel) select(null);
}
svg.addEventListener("pointerup", endPointer);
svg.addEventListener("pointercancel", endPointer);
svg.addEventListener("pointerleave", () => {
  if(draw && draw.hover){ draw.hover = null; snapMark = null; updateDrawbar(); renderOverlay(); }
  if(ghost || landGhost){ ghost = null; landGhost = null; renderOverlay(); }
  if(hoverItem){ hoverItem = null; queueRender(); }
  if(fhover || (snapMark && !draw)){ fhover = null; snapMark = null; renderOverlay(); }
});
svg.addEventListener("contextmenu", e => e.preventDefault());
svg.addEventListener("wheel", e => {
  e.preventDefault(); const r = svg.getBoundingClientRect();
  zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * .0015));
}, {passive:false});

/* ---------- toolbar and keys ---------- */
// Focus mode: hide the build menu and side panel so only the map (and the top bar) shows. Remembered per player.
const focusMode = () => document.querySelector(".app").classList.contains("focus");
function setFocus(on, keep){
  const app = document.querySelector(".app"); if(app.classList.contains("focus") === on) return;
  const before = svgSize().w;
  app.classList.toggle("focus", on);
  if(!keep){ try{ localStorage.setItem("genesis-focus", on ? "1" : "0"); }catch{} }
  const after = svgSize().w; if(before && after) view.tx += (after - before)/2;
  if(!on && state) ui.panel();
  if(state) render();
}
try{ if(localStorage.getItem("genesis-focus") === "1") setFocus(true, true); }catch{}
buildMenu();
// Open one category's tray along the bottom (a BUILD_CATS id, kept in sideCat from menu.js), or close it with false
const sideOpen = cat => {
  sideCat = cat || null;
  document.querySelectorAll("#sideMenu .tbtn[data-cat]").forEach(b => b.setAttribute("aria-expanded", b.dataset.cat === sideCat));
  document.querySelectorAll("#sideMenu .tray").forEach(t => t.classList.toggle("on", t.dataset.cat === sideCat));
  $("#sideBody").hidden = !sideCat;
  if(typeof render === "function" && state) render();   // the fence end rings show while the Exhibits tray is open
};
// One handler for the whole menu, so it keeps working when buildMenu redraws it. The trays stay open while you build;
// tapping the active tool again goes back to Select. In menu A, a button that holds a list opens it as menu B (one at a time).
// A mouse wheel over a bar scrolls it sideways
$("#sideMenu").addEventListener("wheel", e => {
  const bar = e.target.closest(".trayA, .ssub"); if(!bar || bar.scrollWidth <= bar.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
  e.preventDefault(); bar.scrollLeft += e.deltaY;
}, {passive:false});
$("#sideMenu").addEventListener("click", e => {
  const b = e.target.closest("button"); if(!b) return;
  if(b.dataset.close === "a"){ sideOpen(false); return; }
  if(b.dataset.close === "b"){ const it = b.closest(".sitem"); if(it){ it.classList.remove("open"); it.firstElementChild.setAttribute("aria-expanded", false); } return; }
  if(b.matches(".tbtn[data-cat]")){ sideOpen(sideCat === b.dataset.cat ? false : b.dataset.cat); return; }
  if(b.id === "supplyBtn"){ supplyOn = !supplyOn; b.setAttribute("aria-pressed", supplyOn); b.querySelector(".price").textContent = supplyOn ? "On" : "Off"; render(); return; }
  // picking a plain tool row closes any open sub-list (a biome's plants, say), so its own shape picker shows instead
  if(!b.matches(".srow.head") && b.closest(".trayA")) b.closest(".trayA").querySelectorAll(".sitem.open").forEach(x => { x.classList.remove("open"); x.firstElementChild.setAttribute("aria-expanded", false); });
  if(b.dataset.fence){ fenceSel = b.dataset.fence; setTool("exhibit"); return; }
  // a Water or Paint Ground row picks its type and turns the tool on; tapping the pressed one again goes back to Select
  if(b.dataset.water || b.dataset.paint){
    const t = b.dataset.water ? "water" : "paint", k = b.dataset.water || b.dataset.paint, on = tool === t && (t === "water" ? waterPick : paintPick) === k;
    if(t === "water") waterPick = k; else paintPick = k;
    setTool(on ? "select" : t); return;
  }
  if(b.dataset.tool){
    const t = b.dataset.tool, active = t === tool || (familyOf(tool) && familyOf(tool) === familyOf(t));
    setTool(active && tool !== "select" && !familyOf(t) ? "select" : t); return;
  }
  if(b.matches(".srow.head")){
    const it = b.parentElement, was = it.classList.contains("open");
    it.closest(".trayA").querySelectorAll(".sitem.open").forEach(x => { x.classList.remove("open"); x.firstElementChild.setAttribute("aria-expanded", false); });
    it.classList.toggle("open", !was); b.setAttribute("aria-expanded", !was);
  }
});
$("#dSizes").addEventListener("click", e => { const b = e.target.closest("[data-pick]"); if(b) setTool(b.dataset.pick); });
$("#zin").onclick = () => { const {w, h} = svgSize(); zoomAt(w/2, h/2, 1.4); };
$("#zout").onclick = () => { const {w, h} = svgSize(); zoomAt(w/2, h/2, 1/1.4); };
$("#zfit").onclick = fit;
svg.classList.add("tilt");
$("#dUndo").onclick = undoDrawPoint;
$("#dFinish").onclick = finishDraw;
$("#dCancel").onclick = cancelTool;

document.addEventListener("keydown", e => {
  if(/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "")) return;
  if(document.querySelector("dialog[open]")) return;
  if(draw){
    if(e.key === "Enter"){ e.preventDefault(); finishDraw(); return; }
    if(e.key === "Backspace" || e.key === "Delete"){ e.preventDefault(); undoDrawPoint(); return; }
  }
  if(e.key.toLowerCase() === "h" && !e.ctrlKey && !e.metaKey && !e.altKey){ setFocus(!focusMode()); return; }
  if(e.key === "Escape"){ if(tool !== "select") cancelTool(); else if(sideCat) sideOpen(false); else if(sel || officeOpen) closePanel(); }
  if(e.key === " "){ e.preventDefault(); setSpeed(speed ? 0 : (lastSpeed || 1)); }
  if(e.key.toLowerCase() === "r" && !e.ctrlKey && !e.metaKey){ if(isBuildTool(tool)) rotateTool(); else if(tool === "move" && mvSel) rotateMoved(); }
  if(e.key === "1") setSpeed(1);
  if(e.key === "2") setSpeed(2);
  if(e.key === "3" || e.key === "4") setSpeed(4);
});

// Call after anything in the park changes shape: rework the numbers, the walkers' routes, goals, and save
function afterChange(){
  settleCrates();
  deliveryTidy();
  crateStranded();   // pool animals left without a lagoon wall or water go into crates
  refreshMenu();
  recompute();
  buildGuestGraph();
  buildKeeperGraph();
  checkGoals();
  ui.panel(); ui.hud(true);
  saveSoon();
}
