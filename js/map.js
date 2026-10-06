/* =====================================================================
   MAP
   Drawing the park, moving around it, and the build tools.
   Animals and guests wander around here too.
   ===================================================================== */

const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const svg = $("#map"), cam = $("#cam"), world = $("#world"), animalLayer = $("#animalLayer"), guestLayer = $("#guestLayer"), overlay = $("#overlay");
const mapwrap = $("#mapwrap");

const KMIN = 0.4, KMAX = 14;       // zoom limits, in screen pixels per meter
let view = {k:2, tx:0, ty:0};
// 3/4 view (prototype): the ground is squashed by TILT top to bottom, so it reads as seen at an angle
const TILT = .7;
let tilt = (() => { try { return localStorage.getItem("gp-tilt") !== "0"; } catch(e){ return true; } })();
function tf(){ return tilt ? TILT : 1; }
function ky(){ return view.k * tf(); }   // screen pixels per meter, top to bottom
function upright(){ return tilt ? ` scale(1 ${(1/TILT).toFixed(4)})` : ""; }   // added to a sprite's transform so it isn't squashed
let tool = "select";
let sel = null;                     // what's picked: {kind:"exhibit"|"path"|"building", id}
let draw = null;                    // shape being drawn: {kind, pts, snaps, hover}
let ghost = null;                   // building being placed: {pts, x, y, angle, ok, why}
let rockBiome = null;               // biome tab a rock was picked from, so it's placed in that stone color (null: the exhibit's biome)
let landGhost = null;               // rock, grove or shelter being placed: {key, x, y, ok, why}
let doomed = null;                  // thing about to be bulldozed: {kind, id}
let hoverItem = null;               // thing under the mouse while bulldozing
let snapMark = null;
let parcelSel = null;               // plot picked with the Buy Land tool: [i, j]

const isBuildTool = t => !!BUILDINGS[t];
// Menu groups whose tools share a choice bar above the map (vivarium sizes, food stalls, hotels...)
const FAMILIES = {
  viv:  {tools:["vivS", "vivM", "vivL"], labels:["Small", "Medium", "Large"]},
  eat:  {tools:["kiosk", "food", "restaurant"], labels:["Cart", "Stand", "Restaurant"]},
  gifts:{tools:["cart", "shop", "megastore"], labels:["Cart", "Stand", "Shop"]},
  lodging:{tools:["campground", "lodge", "resort"], labels:["Campground", "Safari Lodge", "Resort Hotel"]},
  props:{tools:["bin", "bench", "picnic", "lamp", "camera", "sign", "nofeed"], labels:["Bin", "Bench", "Picnic", "Lamp", "Camera", "Info sign", "No-feed"]},
};
const familyOf = t => Object.keys(FAMILIES).find(f => FAMILIES[f].tools.includes(t)) || null;
let fenceSel = "wood";             // fence type the next exhibit is built with
const SNAP_REACH = 6;              // meters past a path's edge where a new building still snaps to it
const GRID_STEP = 1;               // meters between grid-snap points
let gridSnap = false;
try{ gridSnap = localStorage.getItem("genesis-grid-snap") === "1"; }catch{}
const isDrawTool = t => t === "exhibit" || t === "path" || t === "service" || t === "wide" || t === "tram" || t === "bridge" || t === "zone" || t === "water";
// Exhibits, zones and water are closed shapes. Paths are open lines.
const isPoly = k => k === "exhibit" || k === "zone" || k === "water";
let supplyOn = false;
let rot = 0;                        // 45° steps a building is rotated by while placing it
let lastPtr = null;                 // where the pointer last was while placing, so Rotate can redraw the ghost
let mvSel = null;                   // building picked with the Move tool, the one Rotate turns
let mvCorner = null;                // exhibit or water corner picked with the Move tool: {id, i}
let zedit = null;                   // zone being reshaped: {id, orig, sel, done}               // show supply lines on the map
const halfWidth = p => isService(p) ? SERVICE_ROAD.halfWidth : isWide(p) ? WIDE_PATH.halfWidth : isTram(p) ? TRAM.halfWidth : isBridge(p) ? BRIDGE.halfWidth : PATH_HALF_WIDTH;
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
function listFor(kind){ return kind === "exhibit" ? state.exhibits : kind === "path" ? state.paths : kind === "building" ? state.buildings : kind === "zone" ? state.zones : kind === "fence" ? state.fences
  : kind === "land" ? state.exhibits.flatMap(landOf).concat(decorOf()) : kind === "water" ? state.exhibits.flatMap(waterOf).concat(parkWater()) : null; }
function findItem(kind, id){ const l = listFor(kind); return l ? l.find(x => x.id === id) : null; }
function selItem(){ return sel ? findItem(sel.kind, sel.id) : null; }

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
  s += `<path d="${rd}" fill="${BIOMES[pb].park}"/><path d="${rd}" fill="url(#p-${pb})"/><path d="${rd}" fill="var(--ground-shade)"/>`;

  // grid: 10 m squares, darker every 50 m. With grid snap on and room to see them, 5 m squares.
  if(k > 1.2 || gridSnap){
    const st = gridSnap && k > 7 ? GRID_STEP : gridSnap && k > 2.5 ? 5 : 10;
    let dMin = "", dMaj = "";
    // zoomed in on the 1 m grid, every 5 m line is the darker one
    const maj = st === 1 ? 5 : 50;
    for(let x = Math.floor(b.x0/st)*st; x <= b.x1; x += st){ const d = `M${x} ${b.y0}V${b.y1}`; if(x % maj === 0) dMaj += d; else dMin += d; }
    for(let y = Math.floor(b.y0/st)*st; y <= b.y1; y += st){ const d = `M${b.x0} ${y}H${b.x1}`; if(y % maj === 0) dMaj += d; else dMin += d; }
    s += `<g clip-path="url(#plotClip)" pointer-events="none"><path d="${dMin}" stroke="var(--grid)" stroke-width="1" fill="none" vector-effect="non-scaling-stroke"/><path d="${dMaj}" stroke="var(--grid-major)" stroke-width="1" fill="none" vector-effect="non-scaling-stroke"/></g>`;
  }
  const bd = ownedEdges().map(([p, q]) => `M${p[0]} ${p[1]}L${q[0]} ${q[1]}`).join("");
  s += `<path d="${bd}" fill="none" stroke="var(--boundary)" stroke-width="2" stroke-dasharray="10 5" vector-effect="non-scaling-stroke" pointer-events="none"/>`;

  const isDoomed = (kind, id) => (doomed && doomed.kind === kind && doomed.id === id) || (tool === "bulldoze" && hoverItem && hoverItem.kind === kind && hoverItem.id === id);
  const isSel = (kind, id) => sel && sel.kind === kind && sel.id === id;

  // work zones: a tinted wash and a dashed edge, under everything else
  for(const z of state.zones){
    const on = isSel("zone", z.id), dead = isDoomed("zone", z.id);
    const ZT = z.theme && THEMES[z.theme] && THEMES[z.theme].ground ? THEMES[z.theme] : null;
    if(ZT) s += `<polygon points="${polyStr(z.points)}" fill="${ZT.ground}" fill-opacity=".6" stroke="none" pointer-events="none"/>` + (groundTex(ZT) ? `<polygon points="${polyStr(z.points)}" fill="url(#t-${groundTex(ZT)})" fill-opacity="${ZT.gtex ? .75 : .45}" stroke="none" pointer-events="none"/>` : "");
    s += `<polygon points="${polyStr(z.points)}" fill="${z.color}" fill-opacity="${on ? .22 : ZT ? .04 : .1}" stroke="${dead ? "var(--bad)" : z.color}" stroke-width="${on || dead ? 3 : 1.6}" stroke-dasharray="9 6" stroke-linejoin="round" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
  }

  // ponds and lakes out in the park, under everything built
  s += parkWaterSvg(tool === "bulldoze", isDoomed);

  // exhibits; in the 3/4 view a vivarium is a standing glass tank, so it waits for the building pass after the paths
  const tanks = [];
  for(const e of state.exhibits){
    const c = exhibitColor(e), reach = isReachable(e), pts = polyStr(e.points), mark = s.length;
    const on = isSel("exhibit", e.id), dead = isDoomed("exhibit", e.id);
    s += `<g data-kind="exhibit" data-id="${esc(e.id)}" style="cursor:pointer">`;
    if(e.viv){
      // a glass box: pale blue-green fill, dark frame, and a lighter inner pane
      s += `<polygon points="${pts}" fill="#A9D3DA" fill-opacity=".85" stroke="${dead ? "var(--bad)" : on ? "var(--sel)" : themeKey(e) !== "genesis" ? themeOf(e).edge : "#24414A"}" stroke-width="${on || dead ? 3.5 : 2.2}" ${reach ? "" : `stroke-dasharray="4 3"`} stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
      if(c) s += `<polygon points="${polyStr(insetRect(e.points, .9))}" fill="${c}" fill-opacity=".35" pointer-events="none"/>`;
      // the biome shows through the glass
      s += `<polygon points="${polyStr(insetRect(e.points, .9))}" fill="${BIOMES[biomeOf(e)].color}" fill-opacity=".35" pointer-events="none"/><polygon points="${polyStr(insetRect(e.points, .9))}" fill="url(#b-${biomeOf(e)})" pointer-events="none"/>`;
      const bb = bbox(e.points), [vx, vy] = centroid(e.points);
      if(Math.min(bb.x1-bb.x0, bb.y1-bb.y0) * k < 50) s += `<text class="glyph" x="${vx}" y="${vy}" font-size="${Math.min(VIVARIUMS[e.viv].d * .5, 13*inv)}" style="fill:#24414A">V${e.viv}</text>`;
    } else {
      const bar = barrierOf(e), bw = {wood:2, hedge:2, bars:2.5, electric:2.5, acrylic:3, concrete:4.5}[e.barrier || "wood"], hedge = !!bar.hedge;
      // a moat is a band of water around the outside of the fence
      if(e.moat) s += `<polygon points="${pts}" fill="none" stroke="#3A7FB2" stroke-opacity=".85" stroke-width="7" stroke-linejoin="round" pointer-events="none"/>`;
      // the floor shows the biome: its color, with its texture over it
      s += `<polygon points="${pts}" fill="${BIOMES[biomeOf(e)].color}" fill-opacity=".8" pointer-events="none"/><polygon points="${pts}" fill="url(#b-${biomeOf(e)})" pointer-events="none"/>`;
      // a hedge row is drawn as a real hedge, as wide as it is
      if(hedge && !tilt) s += hedgeSvg("polygon", pts);
      s += `<polygon points="${pts}" fill="transparent" stroke="${dead ? "var(--bad)" : on ? "var(--sel)" : hedge ? (reach ? "none" : "#24461F") : themeKey(e) === "genesis" ? "#26402F" : bar.color}" stroke-width="${on || dead ? 3.5 : bw}" ${reach ? "" : `stroke-dasharray="6 4"`} stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
      // a live electric fence has a dark zigzag over yellow; with no power it goes dull gray
      if(themeKey(e) === "genesis"){}   // Genesis shows power as amber lights on the posts, drawn below
      else if(e.barrier === "electric" && e.powered === false && !on && !dead) s += `<polygon points="${pts}" fill="none" stroke="#8A8F95" stroke-width="2.5" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
      else if(e.barrier === "electric" && !on && !dead) s += `<polygon points="${pts}" fill="none" stroke="#1D2B22" stroke-width="1" stroke-dasharray="3 5" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
      if(e.barrier === "bars" && !on && !dead && themeKey(e) !== "genesis") s += `<polygon points="${pts}" fill="none" stroke="#C9CCD1" stroke-width="1" stroke-dasharray="1 3" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
      if(e.aviary) s += `<polygon points="${pts}" fill="url(#mesh)" pointer-events="none"/>`;
      if(isBreached(e)) s += `<polygon points="${pts}" fill="none" stroke="var(--bad)" stroke-width="4" stroke-dasharray="10 6" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
      // worn fences (as of the last inspection) show cracks: orange when worn, red when badly worn
      else if(knownCond(e) < 60) s += `<polygon points="${pts}" fill="none" stroke="${knownCond(e) < 30 ? "#E5484D" : "#E08A2E"}" stroke-width="2" stroke-dasharray="2 5" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
    }
    // a themed exhibit gets a trim line just inside its fence
    if((!e.viv || themeKey(e) !== "genesis") && e.barrier !== "hedge") s += themeRailSvg(polyStr(insetRect(e.points, e.viv ? .93 : .96)), themeOf(e), inv, e.viv ? 2 : 4, !e.viv && e.animals.some(a => isDangerous(SPECIES_BY_ID[a.sp])), e.viv ? null : e.barrier || "wood");
    // Genesis electric fence: a small amber light at each post, glowing while powered and dark when the power fails
    // in the 3/4 view the fence stands up: its far sides here, behind what's inside, and its near sides after
    const hi34 = dead ? "var(--bad)" : on ? "var(--sel)" : null, fo34 = {hi:hi34, lights:e.barrier === "electric" && themeKey(e) === "genesis", powered:e.powered};
    if(tilt) s += e.viv ? viv34(e, "back", hi34) : fence34(e.points, true, e.barrier || "wood", "back", fo34);
    if(e.barrier === "electric" && !e.viv && themeKey(e) === "genesis" && !tilt){
      const pp = polyStr(insetRect(e.points, .96)), ns = `fill="none" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" pointer-events="none"`;
      if(e.powered === false) s += `<polygon points="${pp}" stroke="#2A2E2B" stroke-width="3" stroke-dasharray="0 34" ${ns}/>`;
      else s += `<polygon points="${pp}" stroke="#FFB547" stroke-opacity=".35" stroke-width="9" stroke-dasharray="0 34" ${ns}/><polygon points="${pp}" stroke="#FFC25E" stroke-width="3.6" stroke-dasharray="0 34" ${ns}/><polygon points="${pp}" stroke="#FFF1CC" stroke-width="1.4" stroke-dasharray="0 34" ${ns}/>`;
    }
    // catch netting hangs just inside the fence rail: stroke the inset outline twice as wide and clip it to itself, so only the inner half shows
    if(e.net && !e.viv && !e.aviary){ const np = polyStr(insetRect(e.points, .96)), nid = `nc-${esc(e.id)}`; s += `<clipPath id="${nid}"><polygon points="${np}"/></clipPath><polygon points="${np}" fill="none" stroke="url(#netx)" stroke-width="2" stroke-linejoin="round" clip-path="url(#${nid})" pointer-events="none"/>`; }
    if(tilt && (e.dirt || 0) > 25) s += `<polygon points="${pts}" fill="url(#muck)" fill-opacity="${Math.min(1, (e.dirt - 25) / 50).toFixed(2)}" pointer-events="none"/>`;   // under the animals in the 3/4 view
    s += landSvg(e, tool === "bulldoze", isDoomed);
    if(tilt) s += e.viv ? viv34(e, "front", hi34) : fence34(e.points, true, e.barrier || "wood", "front", fo34);
    if(dead) s += `<polygon points="${pts}" fill="url(#hatch)" pointer-events="none"/>`;
    // muck builds up visibly once an exhibit is getting dirty
    if(!tilt && (e.dirt || 0) > 25) s += `<polygon points="${pts}" fill="url(#muck)" fill-opacity="${Math.min(1, (e.dirt - 25) / 50).toFixed(2)}" pointer-events="none"/>`;
    if(e.gate){
      const ok = gateCheck(e).ok, gr = Math.max(1.6, 5*inv);
      s += `<rect x="${e.gate[0]-gr}" y="${e.gate[1]-gr}" width="${gr*2}" height="${gr*2}" rx="${gr*.3}" fill="${ok ? "#D8B04A" : "var(--bad)"}" stroke="#1D2B22" stroke-width="1.5" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
    }
    s += `</g>`;
    if(tilt && e.viv){ tanks.push({y:centroid(e.points)[1], svg:s.slice(mark)}); s = s.slice(0, mark); }
  }

  // open fences and hedge rows
  for(const l of fenceLines()) s += fenceLineSvg(l, isSel("fence", l.id), isDoomed("fence", l.id));

  // paths: dark edges drawn first under every path, so joins look like one surface
  const joined = derived ? derived.joined : new Set(), joinedAll = derived ? derived.joinedAll : new Set();
  let under = "", over = "", clipDefs = "", wjN = 0;
  // staff roads go first, so a guest path always lays over them where they meet
  // tram track goes under everything, then staff roads
  const pathRank = p => isTram(p) ? 2 : isService(p) ? 1 : 0;
  for(const p of [...state.paths].sort((a, b) => pathRank(b) - pathRank(a))){
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
  // Genesis buildings get a narrow pale gravel strip so they stand off the grass; all strips go in one pass under the paths and every roof, so none paints over a neighbor
  for(const bl of state.buildings){
    if(BUILDINGS[bl.type].prop || themeKey(bl) !== "genesis") continue;
    s += `<polygon points="${polyStr(bl.points)}" fill="#CBC5B4" stroke="#CBC5B4" stroke-width="3" stroke-linejoin="round" pointer-events="none"/><polygon points="${polyStr(bl.points)}" fill="none" stroke="url(#t-genesis)" stroke-width="3" stroke-linejoin="round" pointer-events="none"/>`;
  }
  s += clipDefs + under + over;
  // plants, rocks and statues out in the park stand over the path edges
  s += decorSvg(tool === "bulldoze", isDoomed);

  // entrance gate
  const [gx, gy] = state.gate;
  s += `<g pointer-events="none"><rect x="${gx-9}" y="${gy-3}" width="18" height="6" rx="1" fill="#1F3A2B"/><rect x="${gx-9}" y="${gy-3}" width="3" height="6" fill="#D8B04A"/><rect x="${gx+6}" y="${gy-3}" width="3" height="6" fill="#D8B04A"/>`;
  s += emblemSvg(gx, gy - 9, 3.6);
  s += `<text class="lbl" x="${gx}" y="${gy + 3 + 9*inv}" font-size="${12*inv}" stroke-width="${3*inv}">Entrance</text></g>`;

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
    while(tanks.length && tanks[0].y <= cy) s += tanks.shift().svg;
    // bins, benches and picnic areas: small, but always big enough to see and tap
    if(t.prop){
      const r = Math.max(Math.max(t.w, t.d) / 2, 4.5*inv), edge = dead ? "var(--bad)" : on ? "var(--sel)" : themeOf(bl).edge, full = bl.type === "bin" && (bl.fill || 0) >= LITTER.binCap;
      s += `<g data-kind="building" data-id="${esc(bl.id)}" style="cursor:pointer"><circle cx="${cx}" cy="${cy}" r="${r * 1.3}" fill="transparent"/>`;
      // a vandalized prop goes dark red; a broken one gets a cross through it
      const fill = isBroken(bl) ? "#6E2A26" : full ? "var(--bad)" : themeFill(bl, t.color), sw = on || dead ? 2.5 : 1.2;
      if(tilt){ s += prop34(bl, t, r, fill, edge, sw) + (isBroken(bl) ? `<path d="M${cx - r*.6} ${cy - r*.6}L${cx + r*.6} ${cy + r*.6}M${cx + r*.6} ${cy - r*.6}L${cx - r*.6} ${cy + r*.6}" stroke="#fff" stroke-width="1.5" vector-effect="non-scaling-stroke" pointer-events="none"/>` : "") + `</g>`; continue; }
      if(bl.type === "bin" || bl.type === "lamp" || bl.type === "camera") s += `<circle cx="${cx}" cy="${cy}" r="${r * .75}" fill="${fill}" stroke="${edge}" stroke-width="${sw}" vector-effect="non-scaling-stroke"/>`;
      else s += `<polygon points="${polyStr(insetRect(bl.points, Math.max(1, r * 2 / Math.max(t.w, t.d))))}" fill="${fill}" stroke="${edge}" stroke-width="${sw}" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
      if(!isBroken(bl) && !full) s += bl.type === "bin" || bl.type === "lamp" || bl.type === "camera" ? themeProp(bl, {round:true, cx, cy, r:r * .75}) : themeProp(bl, {pts:polyStr(insetRect(bl.points, Math.max(1, r * 2 / Math.max(t.w, t.d)))), trim:polyStr(insetRect(bl.points, Math.max(1, r * 2 / Math.max(t.w, t.d)) * .7))});
      if(bl.type === "lamp" && !isBroken(bl)) s += `<circle cx="${cx}" cy="${cy}" r="${r * .3}" fill="#FFF6C8" pointer-events="none"/>`;
      if(bl.type === "camera" && !isBroken(bl)) s += `<circle cx="${cx}" cy="${cy}" r="${r * .3}" fill="#E8F0FF" pointer-events="none"/>`;
      if(bl.type === "sign" && !isBroken(bl)) s += `<text class="glyph" x="${cx}" y="${cy}" font-size="${r * .9}" pointer-events="none">i</text>`;
      if(bl.type === "nofeed" && !isBroken(bl)) s += `<text class="glyph" x="${cx}" y="${cy}" font-size="${r * .9}" pointer-events="none">⊘</text>`;
      if(isBroken(bl)) s += `<path d="M${cx - r*.6} ${cy - r*.6}L${cx + r*.6} ${cy + r*.6}M${cx + r*.6} ${cy - r*.6}L${cx - r*.6} ${cy + r*.6}" stroke="#fff" stroke-width="1.5" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
      s += `</g>`;
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
  // with cameras researched, a selected Security Office shows what every office watches
  const selB = sel && sel.kind === "building" && findItem("building", sel.id);
  if(selB && (selB.type === "security" || selB.type === "camera") && hasTech("cameras")) for(const o of state.buildings.filter(x => x.type === "security" || x.type === "camera")){
    const [ox, oy] = centroid(o.points);
    s += `<circle cx="${ox}" cy="${oy}" r="${o.type === "camera" ? SECURITY.postRadius : SECURITY.cameraRadius}" fill="#2B3F6B" fill-opacity=".08" stroke="#2B3F6B" stroke-width="1.5" stroke-dasharray="6 4" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
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
  world.innerHTML = s;
  renderOverlay();
  syncAnimals();
  applyTransform();
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
  farm:      {wall:4,   rise:5, front:"barn", gable:"ns", wallCol:"#9A3B2E", roofCol:"#6B6B66"},
  // the rest of the guest side
  edcenter:  {wall:5,   rise:2.6, front:"glass", sign:"EDUCATION"},
  tramstop:  {wall:.9,  canopy:3.4, front:"tram"},
  platform:  {wall:3,   canopy:4.1, front:"deck"},
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
  wood:    {h:1.6, step:3,   col:"#7A5A38", rails:[.6, 1.35]},
  bars:    {h:2.6, step:2.5, col:"#7E858C", rails:[.25, 2.5], bars:.5},
  electric:{h:3.2, step:4,   col:"#5A6068", rails:[.6, 1.2, 1.8, 2.4, 3], wire:true},
  acrylic: {h:2.2, col:"#9FCFE0", solid:.4},
  concrete:{h:3.6, col:"#B8B1A2", solid:1},
  hedge:   {h:1.8, hedge:true},
};
function fence34(P, closed, kind, which, o = {}){
  const F = FENCE34[kind] || FENCE34.wood, H = F.h, n = closed ? P.length : P.length - 1, hi = o.hi, n2 = v => v.toFixed(2);
  const segs = [];
  for(let i = 0; i < n; i++){ const a = P[i], b = P[(i+1) % P.length], ny = closed ? norm34(P, i)[1] : 0;
    if(which === "back" && ny > .05 || which === "front" && ny <= .05) continue; segs.push({a, b, ny, y:(a[1] + b[1]) / 2}); }
  segs.sort((p, q) => p.y - q.y);
  const up = h => lift34(h), M = ([x, y]) => `M${n2(x)} ${n2(y)}`, Lto = ([x, y]) => `L${n2(x)} ${n2(y)}`, at = (a, b, f) => [a[0] + (b[0] - a[0])*f, a[1] + (b[1] - a[1])*f];
  let s = "";
  for(const {a, b, ny} of segs){
    const q = [a, b, up(H)(b), up(H)(a)], front = which === "front";
    if(F.hedge){
      s += `<polygon points="${polyStr(q)}" fill="#3F7A32" stroke="#24461F" stroke-width="1" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>` + shade34(q, lit34(closed ? norm34(P, P.indexOf(a)) : [0, 1]) * .5);
      s += `<path d="${M(up(H)(a))}${Lto(up(H)(b))}" stroke="#6BA851" stroke-width="1.1" stroke-linecap="round" fill="none"/>`;
      if(hi) s += `<path d="${M(up(H)(a))}${Lto(up(H)(b))}" stroke="${hi}" stroke-width="3" vector-effect="non-scaling-stroke" fill="none"/>`;
      continue;
    }
    if(F.solid){
      const op = F.solid * (front ? .55 : 1);
      s += `<polygon points="${polyStr(q)}" fill="${F.col}" fill-opacity="${op.toFixed(2)}" stroke="#3A3A34" stroke-opacity=".5" stroke-width="1" vector-effect="non-scaling-stroke"/>` + (F.solid === 1 && !front ? shade34(q, lit34(closed ? norm34(P, P.indexOf(a)) : [0, 1]) * .4) : "");
      s += `<path d="${M(up(H)(a))}${Lto(up(H)(b))}" stroke="${hi || (kind === "concrete" ? "#8E8778" : "#D8EEF5")}" stroke-width="${hi ? 3 : 2}" stroke-linecap="round" vector-effect="non-scaling-stroke" fill="none"/>`;
      continue;
    }
    // posts, then rails (and bars or wires) between them
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), np = Math.max(1, Math.round(L / F.step));
    let posts = "", rails = "", thin = "";
    for(let k = 0; k <= np; k++){ const p = at(a, b, k / np); posts += M(p) + Lto(up(H + (F.wire ? .2 : 0))(p)); }
    for(const h of F.rails) (F.wire ? (thin += M(up(h)(a)) + Lto(up(h)(b))) : (rails += M(up(h)(a)) + Lto(up(h)(b))));
    if(F.bars){ const nb = Math.round(L / F.bars); for(let k = 1; k < nb; k++){ const p = at(a, b, k / nb); thin += M(up(.25)(p)) + Lto(up(2.5)(p)); } }
    s += `<path d="${thin}" stroke="${F.col}" stroke-width="${F.wire ? .8 : 1}" stroke-opacity="${F.wire ? .8 : .9}" vector-effect="non-scaling-stroke" fill="none"/>`;
    s += `<path d="${rails}" stroke="${F.col}" stroke-width="2" vector-effect="non-scaling-stroke" fill="none"/><path d="${posts}" stroke="${F.col}" stroke-width="2.6" stroke-linecap="round" vector-effect="non-scaling-stroke" fill="none"/>`;
    if(hi) s += `<path d="${M(up(F.rails[F.rails.length - 1])(a))}${Lto(up(F.rails[F.rails.length - 1])(b))}" stroke="${hi}" stroke-width="3" vector-effect="non-scaling-stroke" fill="none"/>`;
    // the Genesis electric fence's amber post lights, dark when the power is out
    if(F.wire && o.lights){ let d = ""; for(let k = 0; k <= np; k++) d += M(up(H + .2)(at(a, b, k / np))) + "h0.001";
      s += o.powered === false ? `<path d="${d}" stroke="#2A2E2B" stroke-width="3.5" stroke-linecap="round" vector-effect="non-scaling-stroke" fill="none"/>` : `<path d="${d}" stroke="#FFB547" stroke-opacity=".35" stroke-width="9" stroke-linecap="round" vector-effect="non-scaling-stroke" fill="none"/><path d="${d}" stroke="#FFC25E" stroke-width="3.6" stroke-linecap="round" vector-effect="non-scaling-stroke" fill="none"/>`; }
  }
  return `<g pointer-events="none">${s}</g>`;
}
// A vivarium in the 3/4 view: a glass tank in a steel frame. "back" draws the far panes (before what's inside),
// "front" the near panes, the frame, the glass lid and its heat lamp, all see-through.
function viv34(e, which, hi){
  const P = e.points, V = VIVARIUMS[e.viv], H = V.d * .45, frame = hi || "#24414A", n2 = v => v.toFixed(2), up = lift34(H);
  const fr = w => `stroke="${frame}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" fill="none"`;
  let s = "", d = "";
  for(let i = 0; i < P.length; i++){
    const a = P[i], b = P[(i+1) % P.length], ny = norm34(P, i)[1];
    if(which === "back" ? ny > .05 : ny <= .05) continue;
    const q = [a, b, up(b), up(a)];
    s += `<polygon points="${polyStr(q)}" fill="#A9D3DA" fill-opacity="${which === "back" ? .38 : .16}"/>`;
    if(which === "front"){
      // the substrate shows through the bottom of the glass, then a soft glare streak across the pane
      const sub = [a, b, lift34(H * .18)(b), lift34(H * .18)(a)];
      s += `<polygon points="${polyStr(sub)}" fill="#6B4F33" fill-opacity=".75"/><path d="M${n2(sub[3][0])} ${n2(sub[3][1])}L${n2(sub[2][0])} ${n2(sub[2][1])}" stroke="#8A6B47" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`;
      const g = f => [a[0] + (b[0] - a[0])*f, a[1] + (b[1] - a[1])*f];
      s += `<polygon points="${polyStr([g(.12), g(.2), lift34(H)(g(.32)), lift34(H)(g(.24))])}" fill="#fff" fill-opacity=".22"/>`;
      d += `M${n2(a[0])} ${n2(a[1])}L${n2(b[0])} ${n2(b[1])}`;
    }
    d += `M${n2(up(a)[0])} ${n2(up(a)[1])}L${n2(up(b)[0])} ${n2(up(b)[1])}`;
  }
  // corner posts: the back ones behind, the front ones in front
  const [, cy] = centroid(P);
  for(const p of P) if(which === "back" ? p[1] <= cy : p[1] > cy) d += `M${n2(p[0])} ${n2(p[1])}L${n2(up(p)[0])} ${n2(up(p)[1])}`;
  s += `<path d="${d}" ${fr(hi ? 3 : 2)}/>`;
  if(which === "front"){
    const L = P.map(up), [lx, ly] = centroid(L), r = Math.min(V.w, V.d) * .09;
    s += `<polygon points="${polyStr(L)}" fill="#DDEFF2" fill-opacity=".12" ${fr(hi ? 3 : 1.5)}/>`;
    s += `<circle cx="${n2(lx)}" cy="${n2(ly)}" r="${n2(r * 2.2)}" fill="#FFC25E" fill-opacity=".18"/><rect x="${n2(lx - r)}" y="${n2(ly - r * .6)}" width="${n2(r * 2)}" height="${n2(r * 1.2)}" rx="${n2(r * .3)}" fill="#3A3A34"/><circle cx="${n2(lx)}" cy="${n2(ly)}" r="${n2(r * .4)}" fill="#FFE2A0"/>`;
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
  const gc = S.glassCol || "#9FCFC0", w = walls34(P, 0, W, S.glass ? gc : wallCol, line), main = w.main;
  let s = w.s;
  for(const i of [...Array(P.length).keys()].filter(j => norm34(P, j)[1] > .05)){
    const L = edgeLen34(P, i);
    if(S.glass){
      // CERES: a concrete plinth under glass walls with frames every 2 meters
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
    if(i !== main) continue;
    // the way in: glass doors under a canopy, and the name on the band above
    const dw = Math.min(1.6, L * .08) / L;
    if(!S.doors){
    s += quad34(P, i, .5 - dw, .5 + dw, 0, 2.6, S.front === "resort" ? "#2B2418" : "#22313A");
    const cv = [onEdge34(P, i, .5 - dw*1.6, 3), onEdge34(P, i, .5 + dw*1.6, 3), onEdge34(P, i, .5 + dw*1.6, 3, 1.8), onEdge34(P, i, .5 - dw*1.6, 3, 1.8)];
    s += `<polygon points="${polyStr(cv)}" fill="${S.front === "resort" ? col : wallCol}" ${thin}/>` + shade34(cv, .4);
    }
    if(S.top === "cross"){ const h = W - 2.6, cw = .35 / L; s += quad34(P, i, .5 - cw, .5 + cw, h - 1.3, h + .3, "#D9363E") + quad34(P, i, .5 - cw * 3.4, .5 + cw * 3.4, h - .75, h - .25, "#D9363E"); }
    s += sign34(P, i, W - .62, esc(S.front === "resort" ? "RESORT" : (t.tag || t.label)), Math.min(.6, L * .04));
    if((bl.graffiti || 0) >= VANDAL.grossAt){ const [x0, y0] = onEdge34(P, i, .3, 1.1), [x1] = onEdge34(P, i, .7, 1.1), g = (x1 - x0)/4;
      s += `<path d="M${x0} ${y0}q${g/2} ${-g*.8} ${g} 0t${g} 0t${g} 0t${g} 0" fill="none" stroke="#C04BD8" stroke-width="${Math.max(.6, 2.2*inv)}" stroke-linecap="round" pointer-events="none"/>`; }
  }
  // the roof: the same art as the flat map (rooftop units, the campus emblem), just lifted
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

function building34(bl, t, on, dead, reach, inv){
  const S = STAND34[bl.type], P = bl.points, col = themeFill(bl, t.color), T = themeOf(bl), H = roofOf(T, bl), tex = H >= 0 ? pickFor(bl, T.roofs.btex[H]) : bldTex(T);
  const edge = dead ? "var(--bad)" : on ? "var(--sel)" : reach ? T.edge : "var(--bad)";
  const line = `stroke="${edge}" stroke-width="${on || dead ? 3.5 : 1.2}" ${reach ? "" : `stroke-dasharray="4 3"`} stroke-linejoin="round" vector-effect="non-scaling-stroke"`;
  const top = S.canopy || S.wall + S.rise, sh = top * .22;
  let s = `<polygon points="${polyStr(P.map(([x, y]) => [x + sh, y + sh*.8]))}" fill="#1D2B22" fill-opacity=".22" pointer-events="none"/><polygon points="${polyStr(P)}" fill="#8E8778"/>`;
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
  if(S.front === "deck"){
    // a wooden deck on stilts with a rail all round, looking out over the animals (no shadow pad: it juts over the exhibit)
    s = `<polygon points="${polyStr(P.map(([x, y]) => [x + .8, y + .7]))}" fill="#1D2B22" fill-opacity=".18" pointer-events="none"/>`;
    const D = P.map(lift34(S.wall)), rail = P.map(lift34(S.wall + 1.1)), post = `stroke="#5A4128" stroke-width="2.5" vector-effect="non-scaling-stroke" pointer-events="none"`;
    s += insetRect(P, .9).map(p => { const a = lift34(0)(p), b = lift34(S.wall)(p); return `<path d="M${a[0].toFixed(2)} ${a[1].toFixed(2)}L${b[0].toFixed(2)} ${b[1].toFixed(2)}" ${post}/>`; }).join("");
    s += walls34(P, S.wall - .35, S.wall, col, line).s + `<polygon points="${polyStr(D)}" fill="${col}" ${line}/>` + shade34(D, .3);
    for(let k = 1; k < 7; k++){ const f = k / 7, a = [D[0][0] + (D[1][0] - D[0][0])*f, D[0][1] + (D[1][1] - D[0][1])*f], b = [D[3][0] + (D[2][0] - D[3][0])*f, D[3][1] + (D[2][1] - D[3][1])*f]; s += `<path d="M${a[0].toFixed(2)} ${a[1].toFixed(2)}L${b[0].toFixed(2)} ${b[1].toFixed(2)}" stroke="#5A4128" stroke-opacity=".35" stroke-width="1" vector-effect="non-scaling-stroke" pointer-events="none"/>`; }
    s += P.map((p, j) => { const a = D[j], b = rail[j]; return `<path d="M${a[0].toFixed(2)} ${a[1].toFixed(2)}L${b[0].toFixed(2)} ${b[1].toFixed(2)}" ${post}/>`; }).join("");
    return s + `<polygon points="${polyStr(rail)}" fill="none" stroke="#5A4128" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
  }
  if(S.front === "camp") return s.replace(/fill="#8E8778"/, `fill="#C9B98E"`) + camp34(bl, P, col, line);
  if(S.front === "lab" || S.front === "resort") return s + block34(bl, t, S, P, col, line, inv);
  const w = walls34(P, 0, S.wall, S.wallCol || WALL34, line), i = w.main;
  s += w.s;
  if(i >= 0){
    const L = edgeLen34(P, i);
    if(S.front === "wc"){
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
    if((bl.graffiti || 0) >= VANDAL.grossAt){ const [x0, y0] = onEdge34(P, i, .3, 1.1), [x1] = onEdge34(P, i, .7, 1.1), g = (x1 - x0)/4;
      s += `<path d="M${x0} ${y0}q${g/2} ${-g*.8} ${g} 0t${g} 0t${g} 0t${g} 0" fill="none" stroke="#C04BD8" stroke-width="${Math.max(.6, 2.2*inv)}" stroke-linecap="round" pointer-events="none"/>`; }
  }
  return s + (S.roofCol ? hipRoof34(P, S.wall, S.rise, S.roofCol, null, line, S.gable, S.gable === "ns" && (S.wallCol || WALL34)) : hipRoof34(P, S.wall, S.rise, col, tex, line, S.gable, S.gable === "ns" && (S.wallCol || WALL34)));
}

// Path props standing up in the 3/4 view: bins, lamps, cameras, signs, benches and picnic tables.
// r is the prop's drawn radius, which never shrinks below a tappable size.
function prop34(bl, t, r, fill, edge, sw){
  const [cx, cy] = centroid(bl.points), up = h => cy - h / TILT, ln = `stroke="${edge}" stroke-width="${sw}" vector-effect="non-scaling-stroke"`;
  const shadow = (rx, h) => `<ellipse cx="${(cx + h*.22).toFixed(2)}" cy="${(cy + h*.18).toFixed(2)}" rx="${rx.toFixed(2)}" ry="${(rx*.7).toFixed(2)}" fill="#1D2B22" fill-opacity=".22" pointer-events="none"/>`;
  const pole = (h, w) => `<rect x="${(cx - w/2).toFixed(2)}" y="${up(h).toFixed(2)}" width="${w.toFixed(2)}" height="${(h / TILT).toFixed(2)}" fill="#3A3A34" pointer-events="none"/>`;
  const R = r * .75;
  if(bl.type === "bin"){ const h = R * 1.6;
    return shadow(R, h) + `<rect x="${(cx - R).toFixed(2)}" y="${up(h).toFixed(2)}" width="${(2*R).toFixed(2)}" height="${(h / TILT).toFixed(2)}" fill="${fill}" ${ln}/><ellipse cx="${cx}" cy="${cy.toFixed(2)}" rx="${R.toFixed(2)}" ry="${(R*TILT).toFixed(2)}" fill="${fill}" ${ln}/><ellipse cx="${cx}" cy="${up(h).toFixed(2)}" rx="${R.toFixed(2)}" ry="${(R*TILT).toFixed(2)}" fill="#1D2B22" ${ln}/>`; }
  if(bl.type === "lamp" || bl.type === "camera"){ const h = R * 5, w = Math.max(.15, R*.25);
    return shadow(R*.7, h*.3) + pole(h, w) + (bl.type === "lamp" ? `<ellipse cx="${cx}" cy="${up(h).toFixed(2)}" rx="${(R*.8).toFixed(2)}" ry="${(R*.8 / TILT).toFixed(2)}" fill="${fill}" ${ln}/>${isBroken(bl) ? "" : `<ellipse cx="${cx}" cy="${up(h).toFixed(2)}" rx="${(R*.4).toFixed(2)}" ry="${(R*.4 / TILT).toFixed(2)}" fill="#FFF6C8" pointer-events="none"/>`}`
      : `<rect x="${(cx - R*.9).toFixed(2)}" y="${up(h + R*.4).toFixed(2)}" width="${(R*1.8).toFixed(2)}" height="${(R*.9 / TILT).toFixed(2)}" rx="${(R*.2).toFixed(2)}" fill="${fill}" ${ln}/>${isBroken(bl) ? "" : `<ellipse cx="${(cx + R*.9).toFixed(2)}" cy="${up(h).toFixed(2)}" rx="${(R*.25).toFixed(2)}" ry="${(R*.25 / TILT).toFixed(2)}" fill="#E8F0FF" pointer-events="none"/>`}`); }
  if(bl.type === "sign" || bl.type === "nofeed"){ const h = R * 3, w = Math.max(.12, R*.2), bw = R * 1.6, bh = R * 1.3;
    return shadow(R*.6, h*.3) + pole(h, w) + `<rect x="${(cx - bw/2).toFixed(2)}" y="${up(h + bh*.5).toFixed(2)}" width="${bw.toFixed(2)}" height="${(bh / TILT).toFixed(2)}" rx="${(R*.15).toFixed(2)}" fill="${fill}" ${ln}/>` +
      (isBroken(bl) ? "" : `<text class="glyph" x="${cx}" y="${up(h).toFixed(2)}" font-size="${(bh*.85).toFixed(2)}" pointer-events="none">${bl.type === "sign" ? "i" : "⊘"}</text>`); }
  // benches and picnic tables: slats on thin legs, drawn back to front
  const P = insetRect(bl.points, Math.max(1, r * 2 / Math.max(t.w, t.d))), line = `${ln} stroke-linejoin="round"`, dark = "#3A3A34";
  const [px, py] = centroid(P), U = [(P[1][0] - P[0][0])/2, (P[1][1] - P[0][1])/2], V = [(P[3][0] - P[0][0])/2, (P[3][1] - P[0][1])/2];
  const [L, W] = Math.hypot(...U) >= Math.hypot(...V) ? [U, V] : [V, U], north = W[1] <= 0 ? 1 : -1;   // which way along the short axis is north
  const box = (sl, sw, dw) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [px + L[0]*a*sl + W[0]*(b*sw + dw), py + L[1]*a*sl + W[1]*(b*sw + dw)]);
  const slab = (Q, h0, h1) => walls34(Q, h0, h1, fill, line).s + `<polygon points="${polyStr(Q.map(lift34(h1)))}" fill="${fill}" ${line}/>` + shade34(Q.map(lift34(h1)), .5);
  let out = `<polygon points="${polyStr(P.map(([x, y]) => [x + .25, y + .2]))}" fill="#1D2B22" fill-opacity=".22" pointer-events="none"/>`;
  const leg = (f, d, h) => { const x = px + L[0]*f + W[0]*d, y = py + L[1]*f + W[1]*d; return `<path d="M${x.toFixed(2)} ${y.toFixed(2)}V${(y - h / TILT).toFixed(2)}" stroke="${dark}" stroke-width="1.5" vector-effect="non-scaling-stroke" pointer-events="none"/>`; };
  if(bl.type === "bench"){
    // the backrest goes on the far side, so the seat faces the viewer
    out += leg(-.85, 0, .42) + leg(.85, 0, .42) + slab(box(1, .38, north*.62), .5, .95) + slab(box(1, .55, -north*.2), .42, .5);
    return out;
  }
  // picnic table: a bench each side and the top in between
  out += slab(box(.9, .17, north*.78), .4, .47);
  out += leg(-.8, 0, .72) + leg(.8, 0, .72) + slab(box(1, .42, 0), .72, .8);
  return out + slab(box(.9, .17, -north*.78), .4, .47);
}

function insetRect(pts, f){ const [cx, cy] = centroid(pts); return pts.map(([x, y]) => [cx + (x - cx)*f, cy + (y - cy)*f]); }

function parcelOverlay(){
  const inv = 1/view.k; let s = "";
  for(const [i, j] of PARCEL_CELLS){
    if(ownsParcel(i, j)) continue;
    const [x0, y0, x1, y1] = parcelRect(i, j), open = parcelTouches(i, j), on = parcelSel && parcelSel[0] === i && parcelSel[1] === j;
    s += `<rect x="${x0}" y="${y0}" width="${x1-x0}" height="${y1-y0}" fill="${on ? "var(--sel)" : open ? "var(--good)" : "var(--ink)"}" fill-opacity="${on ? .3 : open ? .16 : .1}" stroke="${on ? "var(--sel)" : "var(--boundary)"}" stroke-width="${on ? 3 : 1}" stroke-dasharray="${open ? "none" : "6 4"}" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
    const fs = Math.min(15*inv, (x1-x0)/7), cx = (x0+x1)/2, cy = (y0+y1)/2;
    s += `<text x="${cx}" y="${cy - (open ? fs*.2 : 0)}" font-size="${fs}" text-anchor="middle" font-weight="700" fill="var(--ink)" pointer-events="none">${open ? money(parcelPrice(i, j)) : "Locked"}</text>`;
    if(open) s += `<text x="${cx}" y="${cy + fs*1.1}" font-size="${fs*.75}" text-anchor="middle" fill="var(--ink)" opacity=".75" pointer-events="none">${fmtArea(parcelArea(i, j))}</text>`;
  }
  return s;
}
function renderOverlay(){
  const inv = 1/view.k;
  let s = tool === "parcels" ? parcelOverlay() : "";
  if(draw){
    const poly = isPoly(draw.kind);
    let all = draw.hover ? draw.pts.concat([draw.hover]) : draw.pts;
    if(draw.kind === "exhibit") all = closeAlong(all);
    const err = draw.error;
    const col = err ? "var(--bad)" : "var(--sel)";
    if(poly && all.length >= 3) s += `<polygon points="${polyStr(all)}" fill="${col}" fill-opacity=".18" stroke="none"/>`;
    // the band is as wide as the path will be (same width and end caps as a built one)
    if(!poly && all.length >= 2){ const ty = drawType(), pw = Math.max(2*halfWidth({type:ty}), (ty === "service" ? 2.5 : 3)*inv); s += `<polyline points="${polyStr(all)}" stroke="${col}" stroke-opacity=".35" stroke-width="${pw}" stroke-linecap="${ty === "wide" ? "butt" : "round"}" stroke-linejoin="round" fill="none"/>`; }
    // a preview in the theme the thing will be built in (zone or brush)
    const pk = all.length >= 2 && !err && (draw.kind === "exhibit" ? all.length >= 3 : (draw.kind === "path" || draw.kind === "wide")) ? themeFor(draw.kind === "exhibit" ? "exhibit" : "path", {points:all, type:drawType(), barrier:fenceSel}) : null;
    if(pk){
      const pt = {theme:pk}, T = THEMES[pk];
      if(poly) s += `<g opacity=".75">${themeRailSvg(polyStr(insetRect(all, .96)), T, inv, 4, false, draw.kind === "exhibit" ? fenceSel : null)}</g>`;
      else { const ty = drawType(), pw = Math.max(2*halfWidth({type:ty}), 3*inv), pl = polyStr(all), lj = `stroke-linecap="${ty === "wide" ? "butt" : "round"}" stroke-linejoin="round" fill="none"`;
        s += `<g opacity=".8"><polyline points="${pl}" stroke="${T.path.edge}" stroke-width="${pw + 1.6*inv}" ${lj}/><polyline points="${pl}" stroke="${T.path.live}" stroke-width="${pw}" ${lj}/>${texFill(pt) ? `<polyline points="${pl}" stroke="${texFill(pt)}" stroke-width="${pw}" ${lj}/>` : ""}</g>`; }
    }
    if(all.length >= 2) s += `<polyline points="${polyStr(all)}" fill="none" stroke="${col}" stroke-width="2.5" vector-effect="non-scaling-stroke"/>`;
    if(poly && all.length >= 3) s += `<line x1="${all[all.length-1][0]}" y1="${all[all.length-1][1]}" x2="${all[0][0]}" y2="${all[0][1]}" stroke="${col}" stroke-width="1.5" stroke-dasharray="5 4" vector-effect="non-scaling-stroke"/>`;
    draw.pts.forEach((p, i) => {
      const first = poly && i === 0 && draw.pts.length >= 3;
      s += `<circle cx="${p[0]}" cy="${p[1]}" r="${(first ? 7 : 4.5)*inv}" fill="${first ? "var(--sel)" : "#fff"}" stroke="var(--sel)" stroke-width="2" vector-effect="non-scaling-stroke"/>`;
    });
  }
  if(landGhost && landKey(tool)){
    const t = LAND[landGhost.key], gfill = t.flora || t.slots || t.tray || t.statue ? t.color : rockTone(rockBiome || (landGhost.e ? biomeOf(landGhost.e) : parkBiome()), landGhost.key).fill;
    s += `<circle cx="${landGhost.x}" cy="${landGhost.y}" r="${t.r}" fill="${gfill}" fill-opacity=".55" stroke="${landGhost.ok ? "var(--sel)" : "var(--bad)"}" stroke-width="2.5" stroke-dasharray="5 3" vector-effect="non-scaling-stroke"/>`;
  }
  const mb = tool === "move" && mvSel && findItem("building", mvSel);
  if(mb) s += `<polygon points="${polyStr(mb.points)}" fill="none" stroke="var(--sel)" stroke-width="3" stroke-dasharray="5 3" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
  if(ghost){
    const col = ghost.ok ? "var(--sel)" : "var(--bad)", t = BUILDINGS[tool];
    const gk = themeFor("building", {type:tool, points:ghost.pts}), gb = gk ? {theme:gk} : null;
    if(gb) s += `<g opacity=".8"><polygon points="${polyStr(ghost.pts)}" fill="${themeFill(gb, t.color)}"/>${themeBuildSvg(gb, polyStr(ghost.pts), polyStr(insetRect(ghost.pts, .86)))}</g>`;
    s += `<polygon points="${polyStr(ghost.pts)}" fill="${gb ? "none" : t.color}" fill-opacity=".55" stroke="${col}" stroke-width="2.5" stroke-dasharray="5 3" vector-effect="non-scaling-stroke"/>`;
    s += `<text class="glyph" x="${ghost.x}" y="${ghost.y}" font-size="${Math.min(t.w, t.d)*.55}">${t.glyph}</text>`;
  }
  if(gateGhost){
    const gr = Math.max(1.6, 5*inv);
    s += `<rect x="${gateGhost.x-gr}" y="${gateGhost.y-gr}" width="${gr*2}" height="${gr*2}" fill="${gateGhost.ok ? "#D8B04A" : "var(--bad)"}" fill-opacity=".8" stroke="var(--sel)" stroke-width="2" vector-effect="non-scaling-stroke"/>`;
  }
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
  if(snapMark) s += `<circle cx="${snapMark[0]}" cy="${snapMark[1]}" r="${10*inv}" fill="none" stroke="var(--sel)" stroke-width="2" vector-effect="non-scaling-stroke"/>`;
  overlay.innerHTML = s;
}

function applyTransform(){ cam.setAttribute("transform", `translate(${view.tx} ${view.ty}) scale(${view.k} ${ky()})`); }

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
  let lo = 0, hi = z.ys.length; while(lo < hi){ const m = (lo + hi) >> 1; if(z.ys[m] <= h.y) lo = m + 1; else hi = m; }
  if(h.el.parentNode === z.g && h.slot === lo) return;
  h.slot = lo; z.g.insertBefore(h.el, z.kids[lo] || null);
}

// an animal's dot stands on its spot in the 3/4 view instead of sinking halfway into the ground
function animalUp(h){ return tilt ? `${upright()} translate(0 ${(-(h.r || 0) * .85).toFixed(2)})` : ""; }

function animalRadius(sp){ return clamp(Math.sqrt(SPECIES_BY_ID[sp].space) / 9, 1.2, 6); }

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
        h = {el, x, y, path:null, wait:Math.random()*3, spd:.6 + Math.random()*.8, exhibitId:e.id, sp:a.sp};
        herd.set(a.id, h);
        animalLayer.appendChild(el);
      }
      h.a = a;
      // vivarium animals stay small enough to fit inside the glass
      const s = SPECIES_BY_ID[a.sp], r = e.viv ? Math.min(VIVARIUMS[e.viv].d / 7, Math.max(.4, 3*inv)) : Math.max(animalRadius(a.sp), 4*inv);
      const showLetter = r * view.k >= 8;
      h.r = r;
      // sick animals get a red ring, pacing ones an amber one, and hiding ones fade into their cover
      h.el.setAttribute("opacity", a.act === "hide" ? .45 : a.act === "rest" ? .85 : 1);
      h.el.innerHTML = (noticed(a) ? `<circle r="${r * 1.45}" fill="none" stroke="#E5484D" stroke-width="2" stroke-dasharray="${a.darted ? "2 2" : "none"}" vector-effect="non-scaling-stroke"/>` : "") +
        (a.act === "pace" ? `<circle r="${r * (noticed(a) ? 1.8 : 1.45)}" fill="none" stroke="#E0A030" stroke-width="2" stroke-dasharray="3 2" vector-effect="non-scaling-stroke"/>` : "") +
        `<circle r="${r}" fill="${PERIOD_COLOR[s.period]}" stroke="#1D2B22" stroke-width="1.5" vector-effect="non-scaling-stroke"/>` +
        (showLetter ? `<text class="glyph" font-size="${r*1.1}" fill="#1D2B22" style="fill:#1D2B22">${s.name[0]}</text>` : "");
      h.el.setAttribute("transform", `translate(${h.x.toFixed(2)} ${h.y.toFixed(2)})${animalUp(h)}`);
    }
  }
  for(const [id, h] of herd) if(!seen.has(id)){ h.el.remove(); herd.delete(id); }
  indexDepth34(); for(const h of herd.values()) place34(h);
}

// Can an animal walk straight from a to b without touching the fence? Samples the line, since L and U shaped exhibits cut corners.
function walkClear(a, b, pts){
  for(let i = 0; i < pts.length; i++) if(segCross(a, b, pts[i], pts[(i+1) % pts.length])) return false;
  const n = Math.max(2, Math.ceil(dist(a, b) / 1.5));
  for(let i = 0; i <= n; i++){ const t = i/n; if(!inPoly(a[0] + (b[0]-a[0])*t, a[1] + (b[1]-a[1])*t, pts)) return false; }
  return true;
}

// Every corner nudged a little way inward, so a route can bend around the inside corners of an irregular exhibit
const walkNodeCache = new Map();
function walkNodes(pts){
  const key = JSON.stringify(pts); let nodes = walkNodeCache.get(key);
  if(nodes) return nodes;
  nodes = [];
  const n = pts.length, c = centroid(pts);
  for(let i = 0; i < n; i++){
    const p = pts[i], a = pts[(i+n-1) % n], b = pts[(i+1) % n];
    const u = [(a[0]-p[0])/(dist(a,p)||1), (a[1]-p[1])/(dist(a,p)||1)], v = [(b[0]-p[0])/(dist(b,p)||1), (b[1]-p[1])/(dist(b,p)||1)];
    let bx = u[0] + v[0], by = u[1] + v[1], L = Math.hypot(bx, by);
    if(L < 1e-6){ bx = -u[1]; by = u[0]; L = 1; }
    bx /= L; by /= L;
    for(const m of [1, 2.5]){   // bisector of the two edges, flipped if it points outside
      let q = [p[0] + bx*m, p[1] + by*m];
      if(!inPoly(q[0], q[1], pts)) q = [p[0] - bx*m, p[1] - by*m];
      if(inPoly(q[0], q[1], pts) && distToEdge(q[0], q[1], pts) > .3){ nodes.push(q); break; }
    }
  }
  if(walkNodeCache.size > 60) walkNodeCache.clear();
  walkNodeCache.set(key, nodes);
  return nodes;
}

// Waypoints from a to b that stay inside the exhibit, or null if there's no way
function walkRoute(a, b, pts){
  if(walkClear(a, b, pts)) return [b];
  const nodes = walkNodes(pts), pos = [a, ...nodes, b], N = pos.length, d = new Array(N).fill(Infinity), prev = new Array(N).fill(-1), done = new Array(N).fill(false);
  d[0] = 0;
  for(;;){
    let u = -1; for(let i = 0; i < N; i++) if(!done[i] && d[i] < Infinity && (u < 0 || d[i] < d[u])) u = i;
    if(u < 0) return null;
    if(u === N-1) break;
    done[u] = true;
    for(let v = 1; v < N; v++){
      if(done[v]) continue;
      const w = dist(pos[u], pos[v]); if(d[u] + w >= d[v] || !walkClear(pos[u], pos[v], pts)) continue;
      d[v] = d[u] + w; prev[v] = u;
    }
  }
  const out = []; for(let i = N-1; i > 0; i = prev[i]) out.unshift(pos[i]);
  return out;
}

// Pick a new spot to walk to and the route there; an animal that finds none just stays put
function animalWander(h, e){
  h.key = JSON.stringify(e.points); h.path = [];
  if(!inPoly(h.x, h.y, e.points)){ [h.x, h.y] = randomInside(e.points); }
  for(let i = 0; i < 6; i++){
    const [x, y] = randomInside(e.points);
    if(distToEdge(x, y, e.points) < .5) continue;
    const r = walkRoute([h.x, h.y], [x, y], e.points);
    if(r){ h.path = r; return; }
  }
}

/* What each act looks like (behavior.js picks the act): where the animal heads, how fast, and whether it stays once there */
const ACT_GAIT = {pace:1.6, play:1.8, patrol:.9, hunt:.55, social:1.1};
const ACT_STAYS = new Set(["eat", "drink", "rest", "hide"]);
// The edge of a land feature nearest the animal, or its middle for shelters it can walk into
function featSpot(h, f, into){
  const t = LAND[f.type], r = into ? 0 : t.r + (h.r || 1), dx = h.x - f.x, dy = h.y - f.y, d = Math.hypot(dx, dy) || 1;
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
  const far = p => state.paths.reduce((m, q) => Math.min(m, lineDist(p[0], p[1], q.points)), 60);
  let best = null, bd = -1;
  for(const p of walkNodes(e.points).concat([centroid(e.points)])) if(inPoly(p[0], p[1], e.points)){ const d = far(p); if(d > bd){ bd = d; best = p; } }
  return best;
}
// Where the act takes it, or null to stay where it is
function actGoal(h, e, a){
  const land = landOf(e).filter(f => LAND[f.type]), of = k => land.filter(f => LAND[f.type][k]);
  switch(a.act){
    case "eat": {
      const t = trays(e).filter(f => trayHas(f) > 0);
      return t.length ? featSpot(h, nearestTo(h, t, f => [f.x, f.y])) : gateSpot(e);
    }
    case "drink": {
      const ws = waterOf(e);
      if(!ws.length) return gateSpot(e);
      const w = nearestTo(h, ws, w => centroid(w.points)), v = nearestTo(h, w.points), c = centroid(w.points);
      return [v[0] + (c[0] - v[0]) * .25, v[1] + (c[1] - v[1]) * .25];   // a step into the shallows
    }
    case "rest": {
      const f = nearestTo(h, of("slots").concat(of("flora")), f => [f.x, f.y]);
      return f ? featSpot(h, f, !!LAND[f.type].slots) : null;
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
    case "hunt": { const s = SPECIES_BY_ID[a.sp], f = pickOne(land.filter(f => LAND[f.type].look === "ice" && toyFor(LAND[f.type], s) > 0)); return f && Math.random() < .5 ? featSpot(h, f) : null; }
    case "play": { const s = SPECIES_BY_ID[a.sp], f = pickOne(land.filter(f => toyFor(LAND[f.type], s) > 0).concat(of("cover"))); return f && Math.random() < .7 ? featSpot(h, f) : null; }
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
  const pts = e.points, inset = e.viv ? .4 : (h.r || 1) + 1.5;
  let best = null;
  for(let i = 0; i < pts.length; i++){ const a = pts[i], b = pts[(i + 1) % pts.length], q = segProj(h.x, h.y, a, b); if(!best || q.d < best.q.d) best = {a, b, q}; }
  const {a, b, q} = best, L = dist(a, b) || 1, ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L;
  let nx = -uy, ny = ux;
  if(!inPoly(q.x + nx * inset, q.y + ny * inset, pts)){ nx = -nx; ny = -ny; }
  const beat = clamp(L * .4, e.viv ? 1 : 3, 14), t0 = clamp(q.t * L - beat / 2, 0, Math.max(0, L - beat));
  const p1 = [a[0] + ux * t0 + nx * inset, a[1] + uy * t0 + ny * inset], p2 = [p1[0] + ux * beat, p1[1] + uy * beat];
  if(!inPoly(p1[0], p1[1], pts) || !walkClear(p1, p2, pts)) return null;
  const to = walkRoute([h.x, h.y], p1, pts);
  return to ? to.concat([p2, p1, p2, p1, p2, p1]) : null;
}
// Patrolling: a lap of the fence line, from the nearest corner
function patrolRoute(h, e){
  const nodes = walkNodes(e.points); if(nodes.length < 3) return null;
  const i0 = nodes.indexOf(nearestTo(h, nodes)), out = [];
  let at = [h.x, h.y];
  for(let k = 0; k <= nodes.length; k++){ const n = nodes[(i0 + k) % nodes.length], r = walkRoute(at, n, e.points); if(!r) break; out.push(...r); at = n; }
  return out.length ? out : null;
}
function animalPlan(h, e){
  const a = h.a;
  if(!a || !a.act){ animalWander(h, e); return; }
  h.key = JSON.stringify(e.points); h.path = [];
  if(!inPoly(h.x, h.y, e.points)){ [h.x, h.y] = randomInside(e.points); }
  if(a.act === "pace"){ const r = paceRoute(h, e); if(r){ h.path = r; return; } }
  if(a.act === "patrol"){ const r = patrolRoute(h, e); if(r){ h.path = r; return; } }
  const goal = actGoal(h, e, a);
  if(goal){
    if(Math.hypot(goal[0] - h.x, goal[1] - h.y) < .5) return;
    const r = inPoly(goal[0], goal[1], e.points) && walkRoute([h.x, h.y], goal, e.points);
    if(r){ h.path = r; return; }
  }
  // nothing to head for: settle where it is, or mill about
  if(!ACT_STAYS.has(a.act)) animalWander(h, e);
}

function animateAnimals(dt){
  for(const h of herd.values()){
    const e = state.exhibits.find(x => x.id === h.exhibitId); if(!e) continue;
    const act = h.a && h.a.act;
    // a new act: drop what it was doing and head off at once
    if(act !== h.act){ h.act = act; h.path = null; h.wait = Math.min(h.wait, Math.random() * .6); }
    if(h.wait > 0){ h.wait -= dt; continue; }
    if(!h.path || h.key !== JSON.stringify(e.points)) animalPlan(h, e);   // new animal, new act, or the exhibit was reshaped
    // once there, eating, drinking, resting and hiding animals stay put until the act changes; the rest look around, then move on
    const stay = ACT_STAYS.has(act), idle = act === "pace" ? 0 : act === "play" ? .3 + Math.random() * .8 : act === "social" ? 1.5 + Math.random() * 2 : 1 + Math.random() * 3;
    if(!h.path.length){ h.wait = stay ? 4 + Math.random() * 4 : idle; if(!stay) h.path = null; continue; }
    const [tx, ty] = h.path[0], dx = tx - h.x, dy = ty - h.y, d = Math.hypot(dx, dy);
    if(d < .3){ h.path.shift(); if(!h.path.length){ h.wait = stay ? 4 + Math.random() * 4 : idle; if(!stay) h.path = null; } continue; }
    const step = Math.min(d, h.spd * 3 * (ACT_GAIT[act] || 1) * dt);
    h.x += dx/d * step; h.y += dy/d * step;
    h.el.setAttribute("transform", `translate(${h.x.toFixed(2)} ${h.y.toFixed(2)})${animalUp(h)}`);
    if(tilt) place34(h);
  }
}

/* ---------- guests walking the paths ---------- */
const SHIRTS = ["#C8452B", "#2F6E8F", "#E3B23C", "#F4F1E8"];
const MOOD_SHIRTS = ["#3E9B4F", "#E3B23C", "#D9483B"];   // happy, so-so, unhappy
const shirtPaths = SHIRTS.map(c => {
  const el = document.createElementNS("http://www.w3.org/2000/svg", "path");
  el.setAttribute("stroke", c); el.setAttribute("stroke-width", "5"); el.setAttribute("stroke-linecap", "round");
  el.setAttribute("vector-effect", "non-scaling-stroke"); el.setAttribute("fill", "none");
  guestLayer.appendChild(el); return el;
});
const outline = document.createElementNS("http://www.w3.org/2000/svg", "path");
outline.setAttribute("stroke", "#1D2B22"); outline.setAttribute("stroke-width", "7"); outline.setAttribute("stroke-linecap", "round");
outline.setAttribute("vector-effect", "non-scaling-stroke"); outline.setAttribute("fill", "none"); outline.setAttribute("stroke-opacity", ".55");
guestLayer.insertBefore(outline, guestLayer.firstChild);

const nodeKey = p => Math.round(p[0]*4) + ":" + Math.round(p[1]*4);

// Parties walk off to one side of the path. Ones standing in a queue bunch up around the spot.
function partyPos(p){
  if(p.to){
    const dx = p.to.x - p.at.x, dy = p.to.y - p.at.y, L = Math.hypot(dx, dy) || 1;
    return [p.at.x + dx*p.t - dy/L*p.off, p.at.y + dy*p.t + dx/L*p.off];
  }
  const a = p.off * 4.4;
  return [p.at.x + Math.cos(a) * Math.abs(p.off) * 1.5, p.at.y + Math.sin(a) * Math.abs(p.off) * 1.5];
}
function drawParties(){
  const cols = moodColors ? MOOD_SHIRTS : SHIRTS, d = SHIRTS.map(() => []), all = [];
  for(const p of parties){
    if(!p.at) continue;
    const [x, y] = partyPos(p);
    if(hidden34(x, y)) continue;
    const m = `M${x.toFixed(2)} ${y.toFixed(2)}h0.001`;
    d[moodColors ? (p.mood >= 60 ? 0 : p.mood >= 35 ? 1 : 2) : p.shirt].push(m); all.push(m);
  }
  shirtPaths.forEach((el, i) => { el.setAttribute("stroke", cols[i] || SHIRTS[i]); el.setAttribute("d", d[i].join("")); });
  outline.setAttribute("d", all.join(""));
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
  if(ev && ev.altKey) return {x:p.x, y:p.y, info:null};
  // water stays clear of fences and paths, so it only snaps to the grid
  if(draw && draw.kind === "water") return gridSnap ? {x:Math.round(p.x / GRID_STEP) * GRID_STEP, y:Math.round(p.y / GRID_STEP) * GRID_STEP, info:{type:"grid"}} : {x:p.x, y:p.y, info:null};
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
  if(draw && draw.kind === "exhibit") for(const l of fenceLines()) l.points.forEach(v => tryV(v, "fence", l.id));
  if(best) return best;
  // with grid snap on, land on the nearest grid point (and still join a path if that point sits on one)
  if(gridSnap){
    const g = [Math.round(p.x / GRID_STEP) * GRID_STEP, Math.round(p.y / GRID_STEP) * GRID_STEP];
    let info = {type:"grid"};
    for(const q of snapPaths) for(let i = 1; i < q.points.length; i++)
      if(segProj(g[0], g[1], q.points[i-1], q.points[i]).d < .05) info = {type:"seg", kind:"path", id:q.id};
    return {x:g[0], y:g[1], info};
  }
  bd = R * .8;
  const tryS = (pts, closed, kind, id) => {
    const n = pts.length, segs = closed ? n : n-1;
    for(let i = 0; i < segs; i++){ const r = segProj(p.x, p.y, pts[i], pts[(i+1) % n]); if(r.d < bd){ bd = r.d; best = {x:r.x, y:r.y, info:{type:"seg", kind, id}}; } }
  };
  for(const q of snapPaths) tryS(q.points, false, "path", q.id);
  for(const q of state.exhibits) tryS(q.points, true, "exhibit", q.id);
  for(const [a, c] of edges){ const r = segProj(p.x, p.y, a, c); if(r.d < bd){ bd = r.d; best = {x:r.x, y:r.y, info:{type:"seg", kind:"boundary", id:"boundary"}}; } }
  return best || {x:p.x, y:p.y, info:null};
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

// An open shape whose two ends sit on another exhibit's fence gets closed by following that fence,
// so neighbors can share a wall even around corners. Returns the closed shape (or the points unchanged).
function closeAlong(pts){
  if(pts.length < 2) return pts;
  const first = pts[0], last = pts[pts.length - 1];
  const edgeOf = (p, poly) => { for(let i = 0; i < poly.length; i++) if(segProj(p[0], p[1], poly[i], poly[(i+1) % poly.length]).d < .1) return i; return -1; };
  for(const x of state.exhibits){
    const P = x.points, n = P.length, iL = edgeOf(last, P), iF = edgeOf(first, P);
    if(iL < 0 || iF < 0) continue;
    // walk the neighbor's fence from the last point back to the first, both ways round
    const fwd = [], back = [];
    for(let i = iL; i !== iF; i = (i + 1) % n) fwd.push(P[(i + 1) % n]);
    for(let i = iL; i !== iF; i = (i - 1 + n) % n) back.push(P[i]);
    const same = (a, b) => dist(a, b) < .1;
    const tidy = list => list.filter(v => !same(v, last) && !same(v, first)).map(v => v.slice());
    const options = [pts, pts.concat(tidy(fwd)), pts.concat(tidy(back))].filter(o => o.length >= 3);
    const fits = o => !selfCrosses(o) && area(o) > 1 && !shapesOverlap(o, P);
    const best = options.filter(fits).sort((a, b) => a.length - b.length)[0];
    if(best) return best;
  }
  return pts;
}

function exhibitProblem(pts){
  if(pts.length < 3) return "Needs at least 3 corners.";
  if(selfCrosses(pts)) return "The fence crosses itself.";
  if(!insidePlot(pts, true)) return "Keep it inside the park boundary.";
  if(area(pts) < 60) return "Too small. Exhibits need at least 60 m².";
  if(state.exhibits.some(e => shapesOverlap(pts, e.points))) return "It overlaps another exhibit.";
  if(state.buildings.some(b => shapesOverlap(pts, b.points))) return "It overlaps a building.";
  if(state.paths.some(p => lineEntersShape(p.points, pts))) return "A path runs through it.";
  const hit = shapeHitsLandscape(pts); if(hit) return hit;
  const fence = BARRIERS[fenceSel];
  if(fence.tech && !hasTech(fence.tech)) return `Research ${TECH.find(x => x.id === fence.tech).label.toLowerCase()} at ORACLE first.`;
  const cost = exhibitCost(pts, fenceSel);
  if(!canAfford(cost)) return `Costs ${money(cost)}. You have ${money(state.money)}.`;
  return null;
}

function pathProblem(pts, type){
  if(type === "tram" && !hasTech("transit")) return `Research ${TECH.find(x => x.id === "transit").label.toLowerCase()} at ORACLE first.`;
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
  exhibit:["New exhibit", "Tap to drop fence corners. Tap the first corner to close it into an exhibit (give it a keeper gate after), or start and end on a neighbor's fence to share its wall. Tap the last corner again to leave it as an open fence."],
  path:["New path", "Tap to add points. Start on the entrance or another path. Tap the last point again to finish."],
  zone:["New work zone", "Tap to drop corners around the exhibits and stores you want to group. Tap the first corner again to close it. Things inside join the zone."],
  wide:["New wide path", "A 10 m promenade for busy stretches. Twice the room before guests feel packed. Start on the entrance or another path, then tap the last point again to finish."],
  service:["New service road", "Staff only. Guests won't walk it. Start on any path, then tap the last point again to finish."],
  tram:["New tram track", "Guests ride it between tram stations. Draw it alongside your footpaths, then build a Tram station beside the track and a footpath at each stop. Tap the last point again to finish."],
  water:["New water", "Tap to drop shore corners, inside an open exhibit for the animals or out in the park for the guests. Tap the first corner again to fill it. Only wooden bridges cross water."],
  bridge:["New wooden bridge", "A footpath that can cross water. Start on a path or the entrance, run it over the water, then tap the last point again to finish."]
};
const drawType = () => draw && (draw.kind === "service" || draw.kind === "wide" || draw.kind === "tram" || draw.kind === "bridge") ? draw.kind : undefined;

function setTool(t){
  if(tool === "zoneedit" && zedit){ const z = zoneById(zedit.id); if(z && !zedit.done) z.points = zedit.orig; zedit = null; }
  if(draw) endDraw();
  ghost = null; doomed = null; hoverItem = null; snapMark = null; gateGhost = null; landGhost = null; rockBiome = null; rot = 0; lastPtr = null; mvSel = null;
  tool = t;
  const fam = familyOf(t);
  document.querySelectorAll("[data-tool]").forEach(b => b.setAttribute("aria-pressed", b.dataset.tool === t || b.dataset.tool === fam));
  document.querySelectorAll("[data-fence]").forEach(b => b.setAttribute("aria-pressed", t === "exhibit" && b.dataset.fence === fenceSel));
  $("#dSizes").hidden = !fam;
  if(fam){
    $("#dSizes").innerHTML = FAMILIES[fam].tools.map((x, i) => `<button data-pick="${x}" aria-pressed="${x === t}">${FAMILIES[fam].labels[i]}</button>`).join("");
  }
  mapwrap.className = "mapwrap tool-" + t;
  if(isDrawTool(t)) startDraw(t);
  else if(t === "platform") showBar("Place a viewing platform", "Tap an exhibit's fence beside a guest path. The deck snaps to the edge and juts out over the animals.", `${money(BUILDINGS.platform.price)} each, ${money(BUILDINGS.platform.upkeep)} a day`, {undo:false, finish:false, cancel:"Done"});
  else if(landKey(t)){
    const L = LAND[landKey(t)];
    showBar(`Place ${L.one}`, L.statue ? `Tap anywhere out in the park, clear of paths and fences. Guests stop to look${L.initials ? ", and learn a lot from the plaque" : ""}.${L.text ? " " + L.text : ""}`
      : L.slots || L.tray ? "Tap inside an open exhibit, clear of any water. Barns, caves and canopies shelter the animals from bad weather."
      : "Tap inside an open exhibit for the animals, or out in the park beside a path to cheer up the guests walking past. Animals feel at home among water, rocks and plants from their own period and biome.",
      `${money(L.price)} each`, {undo:false, finish:false, cancel:"Done"});
  }
  else if(isBuildTool(t)){
    const b = BUILDINGS[t];
    const fits = b.viv ? SPECIES.filter(s => s.viv && vivRank(s.viv) <= vivRank(b.viv)).map(s => s.name) : [];
    const free = " Place it anywhere, but it only works once a path reaches it.", spin = " Rotate turns it 45° (R).";
    showBar(`Place ${b.one}`, b.dept ? `Backstage building${b.unique ? ", one per park" : ""}. Point beside a ${b.serviceOnly ? "service road" : "path or service road"} and it snaps on.${free}${spin}`
      : b.viv ? `${VIVARIUMS[b.viv].w} × ${VIVARIUMS[b.viv].d} m. Fits ${fits.join(", ")}.${free}${spin}`
      : b.tram ? `Point beside a footpath, with tram track running alongside the far side. Guests walk to it from the path and ride from here.${spin}`
      : b.kind ? `Tap it after placing to choose what it sells. Room for ${b.menuSlots} item${b.menuSlots === 1 ? "" : "s"}.${free}${spin}`
      : b.onPath ? `Point at a path and tap. It sits on the edge you point at.${spin}`
      : b.prop ? `Point beside a path and it snaps on.${free}${spin}`
      : `Point beside a path and it turns to face it.${free}${spin}`,
      `${money(b.price)}${b.dept ? "" : " each"}, ${money(b.upkeep)} a day to run`, {undo:true, finish:false, cancel:"Done", undoText:"Rotate"});
  }
  else if(t === "zoneedit" && zedit){
    showBar("Reshape zone", "Drag a corner to move it. Drag a + on an edge to add a corner. Tap a corner, then Delete corner to remove it.", "", {undo:true, finish:true, cancel:"Cancel", undoText:"Delete corner", finishText:"Done"});
    updateZoneEditBar();
  }
  else if(t === "parcels"){ parcelSel = null; fit(); updateParcelBar(); }
  else if(t === "gate") showBar("Place a keeper gate", "Tap an exhibit's fence where a path or service road meets it. One gate per exhibit; tapping again moves it.", `${money(GATE_COST)} each`, {undo:false, finish:false, cancel:"Done"});
  else if(t === "move"){
    mvCorner = null;
    showBar("Move", "Drag a building, exhibit, path or fence to a new spot. Tap a building, then Rotate (R) to turn it 45°. Drag a corner of an exhibit or any water to reshape it, or a + on an edge to add a corner. Tap a corner, then Delete corner.", "", {undo:true, finish:true, cancel:"Done", undoText:"Delete corner", finishText:"Rotate"});
    updateMoveBar();
  }
  else if(t === "bulldoze") showBar("Bulldoze", `Tap an exhibit, path, or building to remove it. You get ${Math.round(COST.refundShare*100)}% of the build cost back.`, "", {undo:false, finish:false, cancel:"Done"});
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
  showBar(kind === "exhibit" ? `New ${BARRIERS[fenceSel].label.toLowerCase()}` : t, hint, "", {undo:true, finish:true, cancel:"Cancel", finishText:kind === "exhibit" ? "Close exhibit" : null});
  updateDrawbar();
  const fence = BARRIERS[fenceSel];
  if(kind === "exhibit" && fence.tech && !hasTech(fence.tech)) setStat(`Research ${TECH.find(x => x.id === fence.tech).label.toLowerCase()} at ORACLE first.`, true);
  if(kind === "tram" && !hasTech("transit")) setStat(`Research ${TECH.find(x => x.id === "transit").label.toLowerCase()} at ORACLE first.`, true);
}

function drawPoints(){ return draw.hover ? draw.pts.concat([draw.hover]) : draw.pts; }

function updateDrawbar(){
  if(!draw) return;
  const all = drawPoints();
  let stat = "", err = null;
  if(draw.kind === "exhibit"){
    // closed, it's an exhibit; tapping the last corner again leaves it as an open fence
    const shape = closeAlong(all), name = BARRIERS[fenceSel].label.toLowerCase();
    const openWhy = all.length >= 2 && shape === all ? fenceProblem(all, fenceSel) : "x", openText = `${Math.round(lineLength(all))} m of open ${name}, ${money(fenceLineCost(all, fenceSel))}`;
    const exWhy = shape.length >= 3 ? exhibitProblem(shape) : "x";
    if(!exWhy) stat = `Exhibit: ${fmtArea(area(shape))}, ${Math.round(perimeter(shape))} m of ${name}, ${money(exhibitCost(shape, fenceSel))}.${openWhy ? "" : ` Or tap the last corner again for ${openText}.`}`;
    else if(!openWhy) stat = `Open fence: ${openText}. Tap the last corner again to build it.${shape.length >= 3 ? " " + exWhy : " Or keep going and close it into an exhibit."}`;
    else if(all.length >= 2) err = shape.length >= 3 ? exWhy : openWhy;
  } else if(draw.kind === "zone"){
    if(all.length >= 3){ stat = `${fmtArea(area(all))}. Free`; err = zoneProblem(all); }
  } else if(draw.kind === "water"){
    if(all.length >= 3){ const h = waterHost(all); stat = `${fmtArea(area(all))} of water ${h ? "in " + h.name : "out in the park"}. ${money(waterCost(all))}`; err = waterProblem(all, h, null, waterCost(all)); }
  } else if(all.length >= 2){
    stat = `${Math.round(lineLength(all))} m. ${money(pathCost(all, drawType()))}`; err = pathProblem(all, drawType());
  }
  draw.error = err;
  setStat(err || stat, !!err);
  $("#dUndo").disabled = !draw.pts.length;
  const ready = draw.kind === "zone" ? !zoneProblem(draw.pts) : draw.kind === "water" ? !waterProblem(draw.pts, waterHost(draw.pts), null, waterCost(draw.pts)) : draw.kind === "exhibit" ? closeAlong(draw.pts).length >= 3 && !exhibitProblem(closeAlong(draw.pts)) : draw.pts.length >= 2 && !pathProblem(draw.pts, drawType());
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
  if(!parcelSel){ showBar("Buy land", "Tap a green plot to see its price. Plots only go on sale next to land you own.", `${fmtArea(ownedBox() ? PARCEL_CELLS.filter(([i, j]) => ownsParcel(i, j)).reduce((a, [i, j]) => a + parcelArea(i, j), 0) : 0)} owned`, {undo:false, finish:false, cancel:"Done"}); return; }
  const [i, j] = parcelSel, why = parcelProblem(i, j);
  showBar("Buy this plot", `${fmtArea(parcelArea(i, j))} for ${money(parcelPrice(i, j))}. Costs ${money(Math.round(parcelArea(i, j) * UPKEEP.landPerSqM))} a day in property tax.`, why || "", {undo:false, finish:true, cancel:"Done", finishText:"Buy"});
  $("#dFinish").disabled = !!why; setStat(why || "", !!why);
}
function parcelTap(e){
  const p = toWorld(e.clientX, e.clientY);
  const c = PARCEL_CELLS.find(([i, j]) => { const r = parcelRect(i, j); return p.x >= r[0] && p.x < r[2] && p.y >= r[1] && p.y < r[3]; });
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
function undoDrawPoint(){ if(isBuildTool(tool)){ rotateTool(); return; } if(tool === "zoneedit"){ deleteZoneCorner(); return; } if(tool === "move"){ deleteMoveCorner(); return; } if(!draw || !draw.pts.length) return; draw.pts.pop(); draw.snaps.pop(); updateDrawbar(); renderOverlay(); }

function finishDraw(){
  if(tool === "parcels"){ buyLand(); return; }
  if(tool === "zoneedit"){ finishZoneEdit(); return; }
  if(tool === "move"){ rotateMoved(); return; }
  if(!draw) return;
  const d = draw, type = drawType();
  const pts = (d.kind === "exhibit" ? closeAlong(d.pts) : d.pts).map(p => [p[0], p[1]]);
  const host = d.kind === "water" ? waterHost(pts) : null;
  const problem = d.kind === "zone" ? zoneProblem(pts) : d.kind === "water" ? waterProblem(pts, host, null, waterCost(pts)) : d.kind === "exhibit" ? exhibitProblem(pts) : pathProblem(pts, type);
  if(problem){ setStat(problem, true); return; }
  if(d.kind === "water"){
    const cost = waterCost(pts);
    addWater(host, pts);
    afterChange();
    // keep the tool going so you can draw the next one
    startDraw("water"); render();
    ui.toast(`Added ${fmtArea(area(pts))} of water to ${host ? host.name : "the park"} for ${money(cost)}.`, "good");
    return;
  }
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
  if(d.kind === "exhibit"){
    const cost = exhibitCost(pts, fenceSel);
    spend(cost, "built");
    const used = new Set(state.exhibits.map(x => x.name));
    let n = 1; while(used.has(`Exhibit ${n}`)) n++;
    const e = {id:uid("e-"), name:`Exhibit ${n}`, points:pts, animals:[], happy:70, cond:100, inspected:{day:state.day, cond:100}};
    if(fenceSel !== "wood") e.barrier = fenceSel;
    if(parkBiome() !== DEFAULT_BIOME) e.biome = parkBiome();   // new exhibits start out as the park's own ground
    autoZone(e);
    themeNew("exhibit", e);
    state.exhibits.push(e);
    afterChange();
    toolDone({kind:"exhibit", id:e.id});
    ui.toast(`Built ${e.name} for ${money(cost)}.${e.gate ? "" : " Give it a keeper gate where a path meets the fence."}`);
  } else {
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
}

// Tapping the last corner again leaves an exhibit's fence open: a fence line on its own, like a hedge row along a path
function finishFence(){
  if(!draw) return;
  const pts = draw.pts.map(p => [p[0], p[1]]), why = fenceProblem(pts, fenceSel);
  if(why){ setStat(why, true); return; }
  const cost = fenceLineCost(pts, fenceSel);
  addFenceLine(pts, fenceSel);
  afterChange();
  // keep the tool going so you can draw the next one
  startDraw("exhibit"); render();
  ui.toast(`Built ${Math.round(lineLength(pts))} m of ${BARRIERS[fenceSel].label.toLowerCase()} for ${money(cost)}.`, "good");
}

function toolDone(newSel){
  setTool("select");
  if(newSel) select(newSel.kind, newSel.id);
}

function drawTap(e){
  const sn = snapAt(e.clientX, e.clientY, e), k = view.k;
  const near = q => q && Math.hypot(q[0] - sn.x, q[1] - sn.y) * k < 14;
  if(isPoly(draw.kind) && draw.pts.length >= 3 && near(draw.pts[0])){ finishDraw(); return; }
  // tapping the last corner again closes a shape that ends on a neighbor's fence, or leaves the fence open
  if(draw.kind === "exhibit" && draw.pts.length >= 2 && near(draw.pts[draw.pts.length-1])){ if(closeAlong(draw.pts) !== draw.pts) finishDraw(); else finishFence(); return; }
  if(!isPoly(draw.kind) && draw.pts.length && near(draw.pts[draw.pts.length-1])){ finishDraw(); return; }
  draw.pts.push([sn.x, sn.y]); draw.snaps.push(sn.info);
  snapMark = null; updateDrawbar(); renderOverlay();
}

/* ---------- placing guest buildings ---------- */
function placeGhost(clientX, clientY){
  lastPtr = {x:clientX, y:clientY};
  const t = BUILDINGS[tool];
  const p = toWorld(clientX, clientY);
  let best = null;
  // guest buildings face footpaths; backstage departments can face service roads too
  for(const q of state.paths){
    if(isTram(q)) continue;   // buildings face footpaths, not the tram track
    if(isService(q) && !t.dept) continue;
    if(t.serviceOnly && !isService(q)) continue;   // depots go on service roads, where ATVs can drive
    for(let i = 1; i < q.points.length; i++){
      const r = segProj(p.x, p.y, q.points[i-1], q.points[i]);
      if(r.d < (t.onPath ? 30 + t.d/2 : halfWidth(q) + t.d/2 + SNAP_REACH) && (!best || r.d < best.d)) best = {...r, a:q.points[i-1], b:q.points[i], hw:halfWidth(q)};
    }
  }
  let x = p.x, y = p.y, angle = 0, why = null;
  if(t.unique && hasDept(tool)) why = `You already have ${t.label}. There's one per park.`;
  if(!why && t.tech && !hasTech(t.tech)) why = `Research ${TECH.find(x => x.id === t.tech).label.toLowerCase()} at ORACLE first.`;
  if(!why && t.needsDept && !hasDept(t.needsDept)) why = `Build ${BUILDINGS[t.needsDept].label} first.`;
  if(!why && t.minRating && state.rating < t.minRating) why = `Your park needs ${t.minRating} stars first.`;
  if(!why && t.rooms) why = hotelLocked(tool);
  if(best && gridSnap){
    // slide along the path in grid steps: round the touch point to the grid, then put it back on the path
    const r = segProj(Math.round(best.x / GRID_STEP) * GRID_STEP, Math.round(best.y / GRID_STEP) * GRID_STEP, best.a, best.b);
    best.x = r.x; best.y = r.y;
  }
  if(best){
    const dx = best.b[0] - best.a[0], dy = best.b[1] - best.a[1], L = Math.hypot(dx, dy) || 1;
    const nx = -dy/L, ny = dx/L;
    // a sign goes on the edge of the path that faces the exhibit fence closest to where you point (so you can pick either side of a path); everything else on the side you point at
    let fx = p.x, fy = p.y;
    if(tool === "sign" || tool === "nofeed"){ let sd = EDU.signReach + best.hw; for(const e of state.exhibits) for(let i = 0; i < e.points.length; i++){ const r = segProj(p.x, p.y, e.points[i], e.points[(i+1) % e.points.length]); if(r.d < sd){ sd = r.d; fx = r.x; fy = r.y; } } }
    const side = ((fx - best.x)*nx + (fy - best.y)*ny) >= 0 ? 1 : -1;
    const ra = rot*Math.PI/4, dn = Math.abs(t.w*Math.sin(ra)) + Math.abs(t.d*Math.cos(ra));   // how deep it is across the path once turned
    let off = t.onPath ? Math.max(0, best.hw - dn/2 - .1) : dn/2 + best.hw + .5;   // props sit on the path, hugging the edge on the side you point at
    // a fence right at the path edge (older, narrower paths): slide in until the prop clears it
    if(t.onPath) while(off > 0 && state.exhibits.some(e => shapesOverlap(rectPts(best.x + nx*side*off, best.y + ny*side*off, t.w, t.d, Math.atan2(dy, dx) + ra), e.points))) off = Math.max(0, off - .1);
    x = best.x + nx*side*off; y = best.y + ny*side*off;
    angle = Math.atan2(dy, dx);
  } else if(t.onPath) why = why || "Move it next to a path.";
  angle += rot * Math.PI/4;
  if(!best && gridSnap){ x = Math.round(x / GRID_STEP) * GRID_STEP; y = Math.round(y / GRID_STEP) * GRID_STEP; }
  const pts = rectPts(x, y, t.w, t.d, angle);
  if(!why && !insidePlot(pts)) why = "Keep it inside the park boundary.";
  if(!why && state.exhibits.some(e => shapesOverlap(pts, e.points))) why = "It overlaps an exhibit.";
  if(!why && state.buildings.some(b => shapesOverlap(pts, b.points))) why = "It overlaps another building.";
  if(!why && !t.onPath && state.paths.some(q => lineEntersShape(q.points, pts))) why = "It sits on a path.";
  if(!why) why = shapeHitsLandscape(pts);
  if(!why && !canAfford(t.price)) why = `Costs ${money(t.price)}. You have ${money(state.money)}.`;
  ghost = {pts, x, y, angle, ok:!why, why};
  const noTrack = t.tram && !why && !tramNear(pts) ? " No tram track beside it yet, so it won't work until one runs alongside." : "";
  setStat(why || `${money(t.price)}. Tap to build.${best ? "" : " No path nearby, so it won't work until one reaches it."}${noTrack}`, !!why);
}

// Turn the building being placed 45°, and redraw the ghost where the pointer is
function rotateTool(){
  rot = (rot + 1) % 8;
  if(lastPtr){ placeGhost(lastPtr.x, lastPtr.y); renderOverlay(); }
  else setStat(`Turned 45°. Tap to place it.`);
}
// Turn the building picked with the Move tool 45° about its middle, if it fits there
function rotateMoved(){
  const it = mvSel && findItem("building", mvSel);
  if(!it){ setStat("Tap a building first, then Rotate.", true); return; }
  const orig = it.points, [cx, cy] = centroid(orig);
  const c45 = Math.SQRT1_2;
  it.points = orig.map(([x, y]) => [cx + (x - cx)*c45 - (y - cy)*c45, cy + (x - cx)*c45 + (y - cy)*c45]);
  const turned = it.points;
  let why = moveProblem("building", it), nudged = false;
  // buildings sit right against their path, so a turn often clips it: slide to the nearest spot where the turned shape fits
  if(why){
    const offs = [];
    for(let dx = -10; dx <= 10; dx += .5) for(let dy = -10; dy <= 10; dy += .5) offs.push([dx, dy]);
    offs.sort((p, q) => Math.hypot(p[0], p[1]) - Math.hypot(q[0], q[1]));
    for(const [dx, dy] of offs){ it.points = shiftPts(turned, dx, dy); if(!moveProblem("building", it)){ why = null; nudged = true; break; } }
  }
  if(why){ it.points = orig; setStat(`Can't turn it here. ${why}`, true); return; }
  afterChange(); render(); updateMoveBar();
  const reach = isReachable(it);
  setStat(reach ? (nudged ? "Turned, and nudged to fit." : "Turned.") : "Turned, but it has no path to the entrance, so it won't work.", !reach);
}

function placeBuilding(e){
  placeGhost(e.clientX, e.clientY);
  if(!ghost.ok){ renderOverlay(); return; }
  const t = BUILDINGS[tool];
  spend(t.price, "built");
  if(t.viv){
    // a vivarium is an exhibit, just one that comes pre-built
    const used = new Set(state.exhibits.map(x => x.name));
    let n = 1; while(used.has(`${t.label} ${n}`)) n++;
    const e = {id:uid("e-"), name:`${t.label} ${n}`, points:ghost.pts, animals:[], happy:70, viv:t.viv};
    autoZone(e);
    themeNew("exhibit", e);
    state.exhibits.push(e);
    afterChange(); render();
    ui.toast(isReachable(e) ? `Built ${t.one} for ${money(t.price)}. Tap it to add animals.` : `Built ${t.one}, but it has no path to the entrance yet, so it won't work.`, isReachable(e) ? "" : "bad");
    return;
  }
  const b = {id:uid("b-"), type:tool, points:ghost.pts, day:state.day};
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
// Find the exhibit fence nearest the pointer, and whether a gate there would work
function findGateSpot(clientX, clientY){
  const p = toWorld(clientX, clientY); let best = null;
  for(const e of state.exhibits){
    if(e.viv) continue;
    for(let i = 0; i < e.points.length; i++){
      const r = segProj(p.x, p.y, e.points[i], e.points[(i+1) % e.points.length]);
      if(r.d * view.k < 16 && (!best || r.d < best.d)) best = {e, x:r.x, y:r.y, d:r.d};
    }
  }
  if(!best) return null;
  const old = best.e.gate; best.e.gate = [best.x, best.y];
  const chk = gateCheck(best.e); best.e.gate = old;
  return {...best, ok:chk.ok, why:chk.text};
}
function gateHover(e){
  gateGhost = findGateSpot(e.clientX, e.clientY);
  setStat(gateGhost ? (gateGhost.ok ? `${money(GATE_COST)}. ${gateGhost.why}` : gateGhost.why) : "Point at an exhibit's fence.", gateGhost && !gateGhost.ok);
  renderOverlay();
}
function gateTap(e){
  const g = findGateSpot(e.clientX, e.clientY);
  if(!g){ setStat("Tap right on an exhibit's fence.", true); return; }
  const cost = g.e.gate ? 0 : GATE_COST;
  if(!canAfford(cost)){ setStat(`A gate costs ${money(cost)}.`, true); return; }
  spend(cost, "built");
  g.e.gate = [g.x, g.y];
  afterChange(); render();
  ui.toast(`${cost ? "Built" : "Moved"} the gate on ${g.e.name}. ${g.why}`, g.ok ? "" : "bad");
}

/* ---------- keepers on the map ---------- */
const keeperEls = new Map();
function walker34(el, x, y){ el.setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)})${upright()}`); el.style.display = hidden34(x, y) ? "none" : ""; }
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
    const r = Math.max(1.3, 5*inv), food = c.carry ? FOOD_COLOR[c.carry.type] : null, cargo = c.cargo ? PERIOD_COLOR[SPECIES_BY_ID[c.cargo.sp].period] : null;
    const drive = onAtv(c), key = `${r.toFixed(3)}|${food}|${cargo}|${drive}`;
    if(el.dataset.key !== key){
      el.dataset.key = key;
      // an animal being moved rides along beside its keeper; on a service road with an ATV, they ride it
      el.innerHTML = atvSvg(r, drive) + (cargo ? `<circle cx="${-r*1.6}" cy="${-r*.6}" r="${r*1.1}" fill="${cargo}" stroke="#1D2B22" stroke-width="1.5" vector-effect="non-scaling-stroke"/>` : "") +
        `<circle r="${r}" fill="#2E6B3A" stroke="#fff" stroke-width="2" vector-effect="non-scaling-stroke"/>` +
        (food ? `<rect x="${r*.4}" y="${-r*1.5}" width="${r*1.1}" height="${r*1.1}" fill="${food}" stroke="#1D2B22" stroke-width="1" vector-effect="non-scaling-stroke"/>` : "");
    }
    walker34(el, x, y);
  }
  // mechanics: orange with a white wrench-dot
  for(const c of mcrew){
    if(!c.at) continue;
    seen.add(c.id);
    let el = keeperEls.get(c.id);
    if(!el){ el = document.createElementNS("http://www.w3.org/2000/svg", "g"); el.setAttribute("pointer-events", "none"); layer.appendChild(el); keeperEls.set(c.id, el); }
    const nx = c.route[0], x = nx ? c.at.x + (nx.x - c.at.x) * c.t : c.at.x, y = nx ? c.at.y + (nx.y - c.at.y) * c.t : c.at.y;
    const r = Math.max(1.3, 5*inv), working = c.job === "repairing" || c.job === "inspecting", drive = onAtv(c), key = `m${r.toFixed(3)}|${working}|${drive}`;
    if(el.dataset.key !== key){
      el.dataset.key = key;
      el.innerHTML = atvSvg(r, drive) + `<circle r="${r}" fill="#C8642A" stroke="#fff" stroke-width="2" vector-effect="non-scaling-stroke"/><circle r="${r*.35}" fill="#fff"/>` +
        (working ? `<circle r="${r*1.7}" fill="none" stroke="#C8642A" stroke-width="1.5" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/>` : "");
    }
    walker34(el, x, y);
  }
  // vets: white with a red cross
  for(const c of vcrew){
    if(!c.at) continue;
    seen.add(c.id);
    let el = keeperEls.get(c.id);
    if(!el){ el = document.createElementNS("http://www.w3.org/2000/svg", "g"); el.setAttribute("pointer-events", "none"); layer.appendChild(el); keeperEls.set(c.id, el); }
    const [x, y] = keeperPos(c), r = Math.max(1.3, 5*inv), working = c.job === "darting", drive = onAtv(c), key = `v${r.toFixed(3)}|${working}|${drive}`;
    if(el.dataset.key !== key){
      el.dataset.key = key;
      el.innerHTML = atvSvg(r, drive) + `<circle r="${r}" fill="#fff" stroke="#B0384F" stroke-width="2" vector-effect="non-scaling-stroke"/><path d="M${-r*.55} 0H${r*.55}M0 ${-r*.55}V${r*.55}" stroke="#B0384F" stroke-width="${r*.35}"/>` +
        (working ? `<circle r="${r*1.7}" fill="none" stroke="#B0384F" stroke-width="1.5" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/>` : "");
    }
    walker34(el, x, y);
  }
  // custodians: teal, with a square of whatever stock they're carrying
  for(const c of ccrew){
    if(!c.at) continue;
    seen.add(c.id);
    let el = keeperEls.get(c.id);
    if(!el){ el = document.createElementNS("http://www.w3.org/2000/svg", "g"); el.setAttribute("pointer-events", "none"); layer.appendChild(el); keeperEls.set(c.id, el); }
    const [x, y] = keeperPos(c), r = Math.max(1.3, 5*inv), good = c.carry ? GOOD_COLOR[c.carry.type] : null, busy = ["scrubbing", "emptying", "sweeping"].includes(c.job), drive = onAtv(c), key = `c${r.toFixed(3)}|${good}|${busy}|${drive}`;
    if(el.dataset.key !== key){
      el.dataset.key = key;
      el.innerHTML = atvSvg(r, drive) + `<circle r="${r}" fill="#2E8B8B" stroke="#fff" stroke-width="2" vector-effect="non-scaling-stroke"/>` +
        (good ? `<rect x="${r*.4}" y="${-r*1.5}" width="${r*1.1}" height="${r*1.1}" fill="${good}" stroke="#1D2B22" stroke-width="1" vector-effect="non-scaling-stroke"/>` : "") +
        (busy ? `<circle r="${r*1.7}" fill="none" stroke="#2E8B8B" stroke-width="1.5" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/>` : "");
    }
    walker34(el, x, y);
  }
  // security guards: navy, with a white badge; a dashed ring while chasing
  for(const c of gcrew){
    if(!c.at) continue;
    seen.add(c.id);
    let el = keeperEls.get(c.id);
    if(!el){ el = document.createElementNS("http://www.w3.org/2000/svg", "g"); el.setAttribute("pointer-events", "none"); layer.appendChild(el); keeperEls.set(c.id, el); }
    const [x, y] = keeperPos(c), r = Math.max(1.3, 5*inv), chasing = !!c.chase, drive = onAtv(c), key = `g${r.toFixed(3)}|${chasing}|${drive}`;
    if(el.dataset.key !== key){
      el.dataset.key = key;
      el.innerHTML = atvSvg(r, drive) + `<circle r="${r}" fill="#2B3F6B" stroke="#fff" stroke-width="2" vector-effect="non-scaling-stroke"/><path d="M0 ${-r*.55}l${r*.45} ${r*.2}v${r*.3}c0 ${r*.3} ${-r*.2} ${r*.5} ${-r*.45} ${r*.6}c${-r*.25} ${-r*.1} ${-r*.45} ${-r*.3} ${-r*.45} ${-r*.6}v${-r*.3}z" fill="#fff"/>` +
        (chasing ? `<circle r="${r*1.7}" fill="none" stroke="#E5484D" stroke-width="1.5" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/>` : "");
    }
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
function drawLoose(){
  const layer = $("#looseLayer"), inv = 1/view.k;
  if(!state.safety || !state.safety.loose.length || !kGraph){ if(layer.childElementCount) layer.innerHTML = ""; return; }
  let s = "";
  for(const l of state.safety.loose){
    let p = loosePos(l);
    if(l.status === "carried"){ const c = crew.find(x => x.hunt === l); if(c && c.at) p = keeperPos(c); }
    if(!p) continue;
    const sp = SPECIES_BY_ID[l.sp], r = Math.max(2.5, 7*inv), pulse = 1 + .25 * Math.sin(performance.now() / 180);
    s += `<g transform="translate(${p[0].toFixed(2)} ${p[1].toFixed(2)})${upright()}">`;
    if(l.status === "loose") s += `<circle r="${r * 1.8 * pulse}" fill="none" stroke="#E5484D" stroke-width="2.5" vector-effect="non-scaling-stroke"/>`;
    s += `<circle r="${r}" fill="${PERIOD_COLOR[sp.period]}" stroke="${l.status === "loose" ? "#E5484D" : "#fff"}" stroke-width="2.5" vector-effect="non-scaling-stroke"/>`;
    s += `<text class="glyph" font-size="${r*1.1}" style="fill:#1D2B22">${l.status === "loose" ? "!" : "z"}</text></g>`;
  }
  layer.innerHTML = s;
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
  if(gridSnap){ const g = segProj(Math.round(x/GRID_STEP)*GRID_STEP, Math.round(y/GRID_STEP)*GRID_STEP, a, b); x = g.x; y = g.y; }
  const off = t.d/2 - 1.5, pts = rectPts(x + nx*off, y + ny*off, t.w, t.d, ang);
  let why = null;
  if(!hasTech("platform")) why = "Research viewing platforms at ORACLE first.";
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

/* ---------- rocks, groves and shelters ---------- */
function landPoint(ev){
  const p = toWorld(ev.clientX, ev.clientY);
  return gridSnap && !ev.altKey ? {x:Math.round(p.x / GRID_STEP) * GRID_STEP, y:Math.round(p.y / GRID_STEP) * GRID_STEP} : p;
}
function landHover(ev){
  const key = landKey(tool), p = landPoint(ev);
  landGhost = {...landSpot(p.x, p.y, key), key};
  setStat(landGhost.why || `${money(LAND[key].price)}. It goes ${landGhost.e ? "in " + landGhost.e.name : "out in the park"}.`, !landGhost.ok);
  renderOverlay();
}
function landTap(ev){
  const key = landKey(tool), p = landPoint(ev), g = landSpot(p.x, p.y, key);
  if(!g.ok){ setStat(g.why, true); return; }
  placeLand(g.e, key, g.x, g.y, rockBiome || (g.e ? null : parkBiome()));
  afterChange(); render();
  ui.toast(g.e ? `Added ${LAND[key].one} to ${g.e.name}.` : `Added ${LAND[key].one} to the park.`, "good");
}

/* ---------- bulldozing ---------- */
function bulldozeTap(kind, id){
  if(!kind){ doomed = null; setStat(""); render(); return; }
  const it = findItem(kind, id);
  if(!it) return;
  if(it.fixed){ setStat("The main walk from the entrance can't be removed.", true); return; }
  if(kind === "exhibit"){ confirmExhibitRemoval(it); return; }
  if(!(doomed && doomed.kind === kind && doomed.id === id)){
    doomed = {kind, id};
    const refund = refundFor(kind, it);
    const extra = kind === "exhibit" && it.animals.length ? ` Its ${it.animals.length} animal${it.animals.length === 1 ? "" : "s"} will be sold for ${money(it.animals.reduce((s,a) => s + SPECIES_BY_ID[a.sp].price * COST.animalResale, 0))}.` : "";
    setStat(`Tap it again to remove it and get ${money(refund)} back.${extra}`, true);
    render(); return;
  }
  removeItem(kind, it);
  doomed = null; setStat("");
}

// Exhibits hold animals, so bulldozing one asks first
function confirmExhibitRemoval(e){
  askConfirm(`Delete ${e.name}?`, `You are about to delete ${e.name}. This will sell all animals in the exhibit and remove it from your park. Are you sure?`, "Yes", () => {
    if(!findItem("exhibit", e.id)) return;
    removeItem("exhibit", e); doomed = null; setStat("");
  }, "No");
}

function removeItem(kind, it){
  const refund = refundFor(kind, it);
  earn(refund, "sold");
  if(kind === "exhibit") for(const a of it.animals) earn(Math.round(SPECIES_BY_ID[a.sp].price * COST.animalResale), "sold");
  if(kind === "land"){ const o = state.exhibits.find(x => landOf(x).includes(it)), l = o ? o.land : state.decor; l.splice(l.indexOf(it), 1); }
  else if(kind === "water"){ const o = state.exhibits.find(x => waterOf(x).includes(it)), l = o ? o.water : state.water; l.splice(l.indexOf(it), 1); if(mvCorner && mvCorner.id === it.id) mvCorner = null; }
  else { const l = listFor(kind); l.splice(l.indexOf(it), 1); }
  if(kind === "building" && it.type === "pmc") pmcRemoved(it);
  if(kind === "zone") dropZone(it.id);
  // viewing platforms go with their exhibit
  if(kind === "exhibit") state.buildings = state.buildings.filter(b => b.exhibitId !== it.id);
  if(sel && sel.id === it.id) sel = null;
  afterChange();
  render(); ui.panel();
}

/* ---------- moving things ---------- */
// What can be dragged: buildings (not platforms, which ride with their exhibit), exhibits, paths (not the entrance walk) and open fences
function moveTarget(hit){
  if(!hit.kind) return null;
  const it = findItem(hit.kind, hit.id);
  if(!it || !["exhibit", "path", "building", "fence"].includes(hit.kind)) return null;
  if(it.fixed){ setStat("The main walk from the entrance can't be moved.", true); return null; }
  if(it.exhibitId){ setStat("A viewing platform rides with its exhibit. Move the exhibit.", true); return null; }
  return it;
}
const shiftPts = (pts, dx, dy) => pts.map(p => [p[0] + dx, p[1] + dy]);
// Why this item can't sit at its new spot, or null. Mirrors the checks for building it fresh.
function moveProblem(kind, it){
  const pts = it.points;
  if(!insidePlot(pts)) return "Keep it inside the park boundary.";
  if(kind === "exhibit"){
    if(state.exhibits.some(e => e !== it && shapesOverlap(pts, e.points))) return "It overlaps another exhibit.";
    if(state.buildings.some(b => !b.exhibitId && shapesOverlap(pts, b.points))) return "It overlaps a building.";
    if(state.paths.some(p => lineEntersShape(p.points, pts))) return "A path runs through it.";
    return shapeHitsLandscape(pts);
  } else if(kind === "building"){
    if(state.exhibits.some(e => shapesOverlap(pts, e.points))) return "It overlaps an exhibit.";
    if(state.buildings.some(b => b !== it && shapesOverlap(pts, b.points))) return "It overlaps another building.";
    if(BUILDINGS[it.type].onPath){ if(!state.paths.some(p => !isService(p) && !isTram(p) && lineShapeDist(p.points, pts) <= PATH_HALF_WIDTH)) return "Keep it on a path."; }
    else if(state.paths.some(p => lineEntersShape(p.points, pts))) return "It sits on a path.";
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
  it.points = shiftPts(m.orig, dx, dy);
  if(m.gate) it.gate = [m.gate[0] + dx, m.gate[1] + dy];
  for(const pl of m.plats) pl.b.points = shiftPts(pl.pts, dx, dy);
  for(const l of m.land){ l.f.x = l.x + dx; l.f.y = l.y + dy; }
  for(const w of m.water) w.w.points = shiftPts(w.pts, dx, dy);
  m.dx = dx; m.dy = dy;
}
function startMove(it, kind, e){
  const w = toWorld(e.clientX, e.clientY);
  return {it, kind, wx:w.x, wy:w.y, dx:0, dy:0, orig:it.points.map(p => p.slice()), gate:it.gate ? it.gate.slice() : null,
    plats:kind === "exhibit" ? state.buildings.filter(b => b.exhibitId === it.id).map(b => ({b, pts:b.points.map(p => p.slice())})) : [],
    land:kind === "exhibit" ? landOf(it).map(f => ({f, x:f.x, y:f.y})) : [],
    water:kind === "exhibit" ? waterOf(it).map(w => ({w, pts:w.points.map(p => p.slice())})) : []};
}
function dragMove(m, e){
  const w = toWorld(e.clientX, e.clientY), g = gridSnap && !e.altKey ? GRID_STEP : 0;
  let dx = w.x - m.wx, dy = w.y - m.wy;
  if(g){ dx = Math.round(dx / g) * g; dy = Math.round(dy / g) * g; }
  moveBy(m, dx, dy);
  const why = moveProblem(m.kind, m.it);
  m.why = why; setStat(why || "Let go to drop it here.", !!why);
  queueRender();
}
function dropMove(m){
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

// Reshaping an exhibit or its water: drag a corner, drag a + to add one, tap a corner and delete it
// Every shape that can be reshaped: each open exhibit's fence, and each body of water inside it
function reshapeables(){
  const out = [];
  for(const e of state.exhibits){ if(e.viv) continue; out.push({e, t:e}); for(const w of waterOf(e)) out.push({e, t:w, w}); }
  for(const w of parkWater()) out.push({e:null, t:w, w});
  return out;
}
// Corners first (fences before water), then the + in the middle of each edge
function cornerAt(clientX, clientY){
  const p = toWorld(clientX, clientY), R = 14 / view.k, all = reshapeables();
  for(const s of all) for(let i = 0; i < s.t.points.length; i++) if(Math.hypot(p.x - s.t.points[i][0], p.y - s.t.points[i][1]) < R) return {...s, i, type:"v"};
  for(const s of all){
    const P = s.t.points;
    for(let i = 0; i < P.length; i++){ const a = P[i], b = P[(i + 1) % P.length]; if(Math.hypot(p.x - (a[0] + b[0]) / 2, p.y - (a[1] + b[1]) / 2) < R) return {...s, i, type:"m"}; }
  }
  return null;
}
// Water is priced by area: growing it costs the difference, shrinking it refunds part
const waterReshapeCost = (w, orig) => waterCost(w.points) - waterCost(orig);
// A reshape in progress (r.t is the shape being changed: an exhibit, or water inside r.e)
const rvProblem = r => r.w ? waterProblem(r.w.points, r.e, r.w, waterReshapeCost(r.w, r.orig)) : reshapeProblem(r.e, r.orig);
function rvStat(r){
  if(r.w){ const diff = waterReshapeCost(r.w, r.orig); return `${fmtArea(area(r.w.points))} of water. ${diff > 0 ? "Costs " + money(diff) : diff < 0 ? "Refund " + money(Math.round(-diff * COST.refundShare)) : "No change"}`; }
  const diff = reshapeCost(r.e, r.orig);
  return `${fmtArea(area(r.e.points))}. ${diff > 0 ? "Extra fence " + money(diff) : diff < 0 ? "Fence refund " + money(Math.round(-diff * COST.refundShare)) : "No change in fence"}`;
}
const rvCommit = r => r.w ? commitWaterReshape(r.e, r.w, r.orig) : commitReshape(r.e, r.orig);
function commitWaterReshape(e, w, orig){
  const diff = waterReshapeCost(w, orig);
  if(diff > 0) spend(diff, "built"); else if(diff < 0) earn(Math.round(-diff * COST.refundShare), "sold");
  afterChange(); render();
  const where = e ? `the water in ${e.name}` : "the water";
  ui.toast(diff > 0 ? `Reshaped ${where} for ${money(diff)}.` : diff < 0 ? `Reshaped ${where}. You got ${money(Math.round(-diff * COST.refundShare))} back.` : `Reshaped ${where}.`);
}
const reshapeCost = (e, orig) => exhibitCost(e.points, e.barrier) - exhibitCost(orig, e.barrier);
// Why this exhibit's new outline won't work, or null
function reshapeProblem(e, orig){
  const pts = e.points;
  if(selfCrosses(pts)) return "The fence crosses itself.";
  if(!insidePlot(pts)) return "Keep it inside the park boundary.";
  if(area(pts) < 60) return "Too small. Exhibits need at least 60 m².";
  if(state.exhibits.some(x => x !== e && shapesOverlap(pts, x.points))) return "It overlaps another exhibit.";
  if(state.buildings.some(b => !b.exhibitId && shapesOverlap(pts, b.points))) return "It overlaps a building.";
  if(state.paths.some(p => lineEntersShape(p.points, pts))) return "A path runs through it.";
  const hit = shapeHitsLandscape(pts); if(hit) return hit;
  if(state.buildings.some(b => b.exhibitId === e.id)) return "Take down its viewing platforms first.";
  if(landOf(e).some(f => !deepInside(f.x, f.y, pts, LAND[f.type].r))) return "A rock, grove or shelter would end up outside the fence. Bulldoze it first.";
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
  const b = tool === "parcels" ? {x0:PARCELS.xs[0], y0:PARCELS.ys[0], x1:PARCELS.xs[PARCELS.xs.length-1], y1:PARCELS.ys[PARCELS.ys.length-1]} : ownedBox(), pad = 40;
  view.k = clamp(Math.min((w - pad*2)/(b.x1 - b.x0), (h - pad*2)/((b.y1 - b.y0)*tf())), KMIN, KMAX);
  view.tx = (w - (b.x1 - b.x0)*view.k)/2 - b.x0*view.k;
  view.ty = (h - (b.y1 - b.y0)*ky())/2 - b.y0*ky();
  render();
}
function zoomAt(mx, my, f){
  const k = clamp(view.k * f, KMIN, KMAX), wx = (mx - view.tx)/view.k, wy = (my - view.ty)/ky();
  view.k = k; view.tx = mx - wx*k; view.ty = my - wy*ky(); queueRender();
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
  render(); ui.panel();
  if(kind && window.matchMedia("(max-width:760px)").matches) $("#aside").classList.add("open");
}

/* ---------- pointer and touch ---------- */
let drag = null, pinch = null;
const pointers = new Map();

function itemAt(target){
  const t = target.closest && target.closest("[data-kind]");
  return t ? {kind:t.dataset.kind, id:t.dataset.id} : {kind:null, id:null};
}

svg.addEventListener("pointerdown", e => {
  if(e.button > 0) return;
  svg.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, {x:e.clientX, y:e.clientY});
  if(pointers.size === 2){
    drag = null; const [a, b] = [...pointers.values()];
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
  drag = {sx:e.clientX, sy:e.clientY, tx:view.tx, ty:view.ty, moved:false, hit:itemAt(e.target)};
});

svg.addEventListener("pointermove", e => {
  if(!pointers.has(e.pointerId)){
    // mouse hovering with no button held
    if(e.pointerType !== "mouse") return;
    if(draw){ const sn = snapAt(e.clientX, e.clientY, e); draw.hover = [sn.x, sn.y]; snapMark = sn.info ? [sn.x, sn.y] : null; updateDrawbar(); renderOverlay(); }
    else if(tool === "platform") platformHover(e);
    else if(landKey(tool)) landHover(e);
    else if(isBuildTool(tool)){ placeGhost(e.clientX, e.clientY); renderOverlay(); }
    else if(tool === "gate") gateHover(e);
    else if(tool === "bulldoze"){ const h = itemAt(e.target); const nh = h.kind ? h : null; if(JSON.stringify(nh) !== JSON.stringify(hoverItem)){ hoverItem = nh; queueRender(); } }
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
    const w = toWorld(e.clientX, e.clientY), g = gridSnap && !e.altKey ? GRID_STEP : 0;
    z.points[drag.zv] = g ? [Math.round(w.x / g) * g, Math.round(w.y / g) * g] : [w.x, w.y];
    const why = zoneProblem(z.points);
    setStat(why || `${fmtArea(area(z.points))}`, !!why);
    queueRender(); return;
  }
  if(!drag) return;
  if(drag.rv){
    if(!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 4) return;
    drag.moved = true;
    const r = drag.rv, w = toWorld(e.clientX, e.clientY), g = gridSnap && !e.altKey ? GRID_STEP : 0;
    r.t.points[r.i] = g ? [Math.round(w.x / g) * g, Math.round(w.y / g) * g] : [w.x, w.y];
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
  view.tx = drag.tx + dx; view.ty = drag.ty + dy; applyTransform();
});

function endPointer(e){
  pointers.delete(e.pointerId);
  if(pinch){ if(pointers.size < 2) pinch = null; drag = null; render(); return; }
  if(!drag) return;
  const d = drag; drag = null;
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
  if(landKey(tool)){ landTap(e); return; }
  if(isBuildTool(tool)){ placeBuilding(e); return; }
  if(tool === "gate"){ gateTap(e); return; }
  if(tool === "bulldoze"){ bulldozeTap(d.hit.kind, d.hit.id); return; }
  if(d.hit.kind) select(d.hit.kind, d.hit.id); else if(sel) select(null);
}
svg.addEventListener("pointerup", endPointer);
svg.addEventListener("pointercancel", endPointer);
svg.addEventListener("pointerleave", () => {
  if(draw && draw.hover){ draw.hover = null; snapMark = null; updateDrawbar(); renderOverlay(); }
  if(ghost || landGhost){ ghost = null; landGhost = null; renderOverlay(); }
  if(hoverItem){ hoverItem = null; queueRender(); }
});
svg.addEventListener("wheel", e => {
  e.preventDefault(); const r = svg.getBoundingClientRect();
  zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * .0015));
}, {passive:false});

/* ---------- toolbar and keys ---------- */
buildMenu();
const sideOpen = on => {
  $("#sideTab").setAttribute("aria-expanded", on); $("#sideBody").hidden = !on; mapwrap.classList.toggle("side-open", on);
  try{ localStorage.setItem("genesis-side-open", on ? "1" : "0"); }catch{}
};
// Tapping a tool picks it and tucks the menu away so the map is clear. Tapping it again goes back to Select.
document.querySelectorAll("[data-tool]").forEach(b => b.addEventListener("click", () => {
  const t = b.dataset.tool, active = t === tool || (familyOf(tool) && familyOf(tool) === familyOf(t));
  const off = active && tool !== "select" && !familyOf(t);
  setTool(off ? "select" : t);
  if(!off && t !== "select") sideOpen(false);
}));
document.querySelectorAll("[data-fence]").forEach(b => b.addEventListener("click", () => {
  fenceSel = b.dataset.fence; setTool("exhibit"); sideOpen(false);
}));
// One group open at a time; dropdowns inside a group open on their own
$("#sideTab").onclick = () => sideOpen($("#sideBody").hidden);
document.querySelectorAll(".shead").forEach(h => h.addEventListener("click", () => {
  const g = h.parentElement, was = g.classList.contains("open");
  document.querySelectorAll(".sgroup.open").forEach(x => { x.classList.remove("open"); x.firstElementChild.setAttribute("aria-expanded", false); });
  g.classList.toggle("open", !was); h.setAttribute("aria-expanded", !was);
}));
document.querySelectorAll(".srow.head").forEach(h => h.addEventListener("click", () => {
  const it = h.parentElement, was = it.classList.contains("open");
  it.classList.toggle("open", !was); h.setAttribute("aria-expanded", !was);
}));
try{ if(localStorage.getItem("genesis-side-open") === "1") sideOpen(true); }catch{}
$("#dSizes").addEventListener("click", e => { const b = e.target.closest("[data-pick]"); if(b) setTool(b.dataset.pick); });
$("#zin").onclick = () => { const {w, h} = svgSize(); zoomAt(w/2, h/2, 1.4); };
$("#zout").onclick = () => { const {w, h} = svgSize(); zoomAt(w/2, h/2, 1/1.4); };
$("#zfit").onclick = fit;
// flip the 3/4 view, keeping the middle of the screen where it is
$("#ztilt").onclick = () => {
  const {w, h} = svgSize(), wy = (h/2 - view.ty)/ky();
  tilt = !tilt; try { localStorage.setItem("gp-tilt", tilt ? "1" : "0"); } catch(e){}
  view.ty = h/2 - wy*ky(); $("#ztilt").setAttribute("aria-pressed", tilt); svg.classList.toggle("tilt", tilt); applyTransform(); render(); syncAnimals();
};
$("#ztilt").setAttribute("aria-pressed", tilt); svg.classList.toggle("tilt", tilt);
function setGridSnap(on){
  gridSnap = on;
  try{ localStorage.setItem("genesis-grid-snap", on ? "1" : "0"); }catch{}
  const b = $("#gridBtn"); b.setAttribute("aria-pressed", on); b.querySelector(".price").textContent = on ? "On, 1 m. Press G" : "Off. Press G";
  if(state) render();
}
$("#gridBtn").onclick = () => setGridSnap(!gridSnap);
$("#supplyBtn").onclick = () => { supplyOn = !supplyOn; const b = $("#supplyBtn"); b.setAttribute("aria-pressed", supplyOn); b.querySelector(".price").textContent = supplyOn ? "On. Green farms, blue stores, gold exhibits" : "Off"; render(); };
setGridSnap(gridSnap);
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
  if(e.key === "Escape"){ if(tool !== "select") cancelTool(); else if(sel) select(null); }
  if(e.key === " "){ e.preventDefault(); setSpeed(speed ? 0 : (lastSpeed || 1)); }
  if(e.key.toLowerCase() === "g" && !e.ctrlKey && !e.metaKey){ setGridSnap(!gridSnap); if(draw){ updateDrawbar(); renderOverlay(); } }
  if(e.key.toLowerCase() === "r" && !e.ctrlKey && !e.metaKey){ if(isBuildTool(tool)) rotateTool(); else if(tool === "move" && mvSel) rotateMoved(); }
  if(e.key === "1") setSpeed(1);
  if(e.key === "2") setSpeed(2);
  if(e.key === "3" || e.key === "4") setSpeed(4);
});

// Call after anything in the park changes shape: rework the numbers, the walkers' routes, goals, and save
function afterChange(){
  refreshMenu();
  recompute();
  buildGuestGraph();
  buildKeeperGraph();
  checkGoals();
  ui.panel(); ui.hud(true);
  saveSoon();
}
