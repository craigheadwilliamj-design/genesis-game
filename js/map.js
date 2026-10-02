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
let tool = "select";
let sel = null;                     // what's picked: {kind:"exhibit"|"path"|"building", id}
let draw = null;                    // shape being drawn: {kind, pts, snaps, hover}
let ghost = null;                   // building being placed: {pts, x, y, angle, ok, why}
let landGhost = null;               // pond or rock being placed: {key, x, y, ok, why}
let doomed = null;                  // thing about to be bulldozed: {kind, id}
let hoverItem = null;               // thing under the mouse while bulldozing
let snapMark = null;

const isBuildTool = t => !!BUILDINGS[t];
// Menu groups whose tools share a choice bar above the map (vivarium sizes, food stalls, hotels...)
const FAMILIES = {
  viv:  {tools:["vivS", "vivM", "vivL"], labels:["Small", "Medium", "Large"]},
  eat:  {tools:["kiosk", "food", "restaurant"], labels:["Kiosk", "Stand", "Restaurant"]},
  gifts:{tools:["cart", "shop", "megastore"], labels:["Cart", "Shop", "Megastore"]},
  lodging:{tools:["campground", "lodge", "resort"], labels:["Campground", "Safari Lodge", "Resort Hotel"]},
  props:{tools:["bin", "bench", "picnic", "lamp", "sign"], labels:["Trash bin", "Bench", "Picnic area", "Lamp post", "Info sign"]},
};
const familyOf = t => Object.keys(FAMILIES).find(f => FAMILIES[f].tools.includes(t)) || null;
let fenceSel = "wood";             // fence type the next exhibit is built with
const GRID_STEP = 1;               // meters between grid-snap points
let gridSnap = false;
try{ gridSnap = localStorage.getItem("genesis-grid-snap") === "1"; }catch{}
const isDrawTool = t => t === "exhibit" || t === "path" || t === "service" || t === "zone";
// Exhibits and zones are closed shapes. Paths are open lines.
const isPoly = k => k === "exhibit" || k === "zone";
let supplyOn = false;
let mvCorner = null;                // exhibit corner picked with the Move tool: {id, i}
let zedit = null;                   // zone being reshaped: {id, orig, sel, done}               // show supply lines on the map
const halfWidth = p => isService(p) ? SERVICE_ROAD.halfWidth : PATH_HALF_WIDTH;

/* ---------- looking things up ---------- */
function listFor(kind){ return kind === "exhibit" ? state.exhibits : kind === "path" ? state.paths : kind === "building" ? state.buildings : kind === "zone" ? state.zones : kind === "land" ? state.exhibits.flatMap(landOf) : null; }
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
  const b = bbox(state.boundary);
  let s = `<rect x="${b.x0-3000}" y="${b.y0-3000}" width="${b.x1-b.x0+6000}" height="${b.y1-b.y0+6000}" fill="url(#contours)"/>`;
  $("#plotClipPoly").setAttribute("points", polyStr(state.boundary));
  s += `<polygon points="${polyStr(state.boundary)}" fill="var(--grass)"/>`;

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
  s += `<polygon points="${polyStr(state.boundary)}" fill="none" stroke="var(--boundary)" stroke-width="2" stroke-dasharray="10 5" vector-effect="non-scaling-stroke" pointer-events="none"/>`;

  const isDoomed = (kind, id) => (doomed && doomed.kind === kind && doomed.id === id) || (tool === "bulldoze" && hoverItem && hoverItem.kind === kind && hoverItem.id === id);
  const isSel = (kind, id) => sel && sel.kind === kind && sel.id === id;

  // work zones: a tinted wash and a dashed edge, under everything else
  for(const z of state.zones){
    const on = isSel("zone", z.id), dead = isDoomed("zone", z.id);
    s += `<polygon points="${polyStr(z.points)}" fill="${z.color}" fill-opacity="${on ? .22 : .1}" stroke="${dead ? "var(--bad)" : z.color}" stroke-width="${on || dead ? 3 : 1.6}" stroke-dasharray="9 6" stroke-linejoin="round" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
  }

  // exhibits
  for(const e of state.exhibits){
    const c = exhibitColor(e), reach = isReachable(e), pts = polyStr(e.points);
    const on = isSel("exhibit", e.id), dead = isDoomed("exhibit", e.id);
    s += `<g data-kind="exhibit" data-id="${esc(e.id)}" style="cursor:pointer">`;
    if(e.viv){
      // a glass box: pale blue-green fill, dark frame, and a lighter inner pane
      s += `<polygon points="${pts}" fill="#A9D3DA" fill-opacity=".85" stroke="${dead ? "var(--bad)" : on ? "var(--sel)" : "#24414A"}" stroke-width="${on || dead ? 3.5 : 2.2}" ${reach ? "" : `stroke-dasharray="4 3"`} stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
      if(c) s += `<polygon points="${polyStr(insetRect(e.points, .9))}" fill="${c}" fill-opacity=".35" pointer-events="none"/>`;
      const bb = bbox(e.points), [vx, vy] = centroid(e.points);
      if(Math.min(bb.x1-bb.x0, bb.y1-bb.y0) * k < 50) s += `<text class="glyph" x="${vx}" y="${vy}" font-size="${Math.min(VIVARIUMS[e.viv].d * .5, 13*inv)}" style="fill:#24414A">V${e.viv}</text>`;
    } else {
      const bar = barrierOf(e), bw = {wood:2, bars:2.5, electric:2.5, acrylic:3, concrete:4.5}[e.barrier || "wood"];
      // a moat is a band of water around the outside of the fence
      if(e.moat) s += `<polygon points="${pts}" fill="none" stroke="#3A7FB2" stroke-opacity=".85" stroke-width="7" stroke-linejoin="round" pointer-events="none"/>`;
      // the floor shows the biome: its color, with its texture over it
      s += `<polygon points="${pts}" fill="${BIOMES[biomeOf(e)].color}" fill-opacity=".8" pointer-events="none"/><polygon points="${pts}" fill="url(#b-${biomeOf(e)})" pointer-events="none"/>`;
      s += `<polygon points="${pts}" fill="transparent" stroke="${dead ? "var(--bad)" : on ? "var(--sel)" : bar.color}" stroke-width="${on || dead ? 3.5 : bw}" ${reach ? "" : `stroke-dasharray="6 4"`} stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
      // a live electric fence has a dark zigzag over yellow; with no power it goes dull gray
      if(e.barrier === "electric" && e.powered === false && !on && !dead) s += `<polygon points="${pts}" fill="none" stroke="#8A8F95" stroke-width="2.5" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
      else if(e.barrier === "electric" && !on && !dead) s += `<polygon points="${pts}" fill="none" stroke="#1D2B22" stroke-width="1" stroke-dasharray="3 5" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
      if(e.barrier === "bars" && !on && !dead) s += `<polygon points="${pts}" fill="none" stroke="#C9CCD1" stroke-width="1" stroke-dasharray="1 3" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
      if(e.aviary) s += `<polygon points="${pts}" fill="url(#mesh)" pointer-events="none"/>`;
      if(isBreached(e)) s += `<polygon points="${pts}" fill="none" stroke="var(--bad)" stroke-width="4" stroke-dasharray="10 6" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
      // worn fences (as of the last inspection) show cracks: orange when worn, red when badly worn
      else if(knownCond(e) < 60) s += `<polygon points="${pts}" fill="none" stroke="${knownCond(e) < 30 ? "#E5484D" : "#E08A2E"}" stroke-width="2" stroke-dasharray="2 5" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
    }
    if(!e.viv) s += landSvg(e, tool === "bulldoze", id => isDoomed("land", id));
    if(dead) s += `<polygon points="${pts}" fill="url(#hatch)" pointer-events="none"/>`;
    // muck builds up visibly once an exhibit is getting dirty
    if((e.dirt || 0) > 25) s += `<polygon points="${pts}" fill="url(#muck)" fill-opacity="${Math.min(1, (e.dirt - 25) / 50).toFixed(2)}" pointer-events="none"/>`;
    if(e.gate){
      const ok = gateCheck(e).ok, gr = Math.max(1.6, 5*inv);
      s += `<rect x="${e.gate[0]-gr}" y="${e.gate[1]-gr}" width="${gr*2}" height="${gr*2}" rx="${gr*.3}" fill="${ok ? "#D8B04A" : "var(--bad)"}" stroke="#1D2B22" stroke-width="1.5" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
    }
    s += `</g>`;
  }

  // paths: dark edges drawn first under every path, so joins look like one surface
  const joined = derived ? derived.joined : new Set(), joinedAll = derived ? derived.joinedAll : new Set();
  let under = "", over = "";
  // staff roads go first, so a guest path always lays over them where they meet
  for(const p of [...state.paths].sort((a, b) => isService(b) - isService(a))){
    const svc = isService(p);
    const pts = polyStr(p.points), w = Math.max(2*halfWidth(p), (svc ? 2.5 : 3)*inv);
    const on = isSel("path", p.id), dead = isDoomed("path", p.id), live = (svc ? joinedAll : joined).has(p.id);
    const lj = `stroke-linejoin="round" stroke-linecap="round" fill="none"`;
    if(on || dead) under += `<polyline points="${pts}" stroke="${dead ? "var(--bad)" : "var(--sel)"}" stroke-width="${w + 5*inv}" ${lj}/>`;
    under += `<polyline points="${pts}" stroke="${svc ? "#4B4F55" : "#8F7B52"}" stroke-width="${w + 1.6*inv}" ${lj}/>`;
    over += `<g data-kind="path" data-id="${esc(p.id)}" style="cursor:pointer"><polyline points="${pts}" stroke="${svc ? (live ? "#8A8F95" : "#A5A8AC") : live ? "#EADFC4" : "#C9BFA6"}" stroke-width="${w}" ${lj}/>`;
    if(svc) over += `<polyline points="${pts}" stroke="#E6E2D6" stroke-width="${.6*inv}" stroke-dasharray="${5*inv} ${5*inv}" ${lj}/>`;
    if(!live) over += `<polyline points="${pts}" stroke="#8F7B52" stroke-width="${1.2*inv}" stroke-dasharray="${4*inv} ${4*inv}" ${lj}/>`;
    over += `<polyline points="${pts}" stroke="transparent" stroke-width="${Math.max(w, 14*inv)}" ${lj}/></g>`;
  }
  s += under + over;

  // entrance gate
  const [gx, gy] = state.gate;
  s += `<g pointer-events="none"><rect x="${gx-9}" y="${gy-3}" width="18" height="6" rx="1" fill="#1F3A2B"/><rect x="${gx-9}" y="${gy-3}" width="3" height="6" fill="#D8B04A"/><rect x="${gx+6}" y="${gy-3}" width="3" height="6" fill="#D8B04A"/>`;
  s += `<text class="lbl" x="${gx}" y="${gy + 3 + 9*inv}" font-size="${12*inv}" stroke-width="${3*inv}">Entrance</text></g>`;

  // litter on the paths
  const specks = litterSpecks();
  if(specks.length){
    // small square flecks in dull paper and cardboard colors, so they don't look like guests
    const cols = ["#FFFFFF", "#6F6A5C", "#7A5A2E"], d = cols.map(() => []), w = Math.max(.6, 3.2*inv);
    for(const [x, y, c] of specks) d[c].push(`M${x.toFixed(2)} ${y.toFixed(2)}h${w.toFixed(2)}`);
    s += `<g pointer-events="none">${cols.map((c, i) => d[i].length ? `<path d="${d[i].join("")}" stroke="${c}" stroke-width="${w}" stroke-linecap="square" fill="none"/>` : "").join("")}</g>`;
  }

  // guest buildings
  for(const bl of state.buildings){
    const t = BUILDINGS[bl.type], on = isSel("building", bl.id), dead = isDoomed("building", bl.id), reach = isReachable(bl);
    const [cx, cy] = centroid(bl.points), fs = Math.min(t.w, t.d) * .55;
    // bins, benches and picnic areas: small, but always big enough to see and tap
    if(t.prop){
      const r = Math.max(Math.max(t.w, t.d) / 2, 4.5*inv), edge = dead ? "var(--bad)" : on ? "var(--sel)" : "#1D2B22", full = bl.type === "bin" && (bl.fill || 0) >= LITTER.binCap;
      s += `<g data-kind="building" data-id="${esc(bl.id)}" style="cursor:pointer"><circle cx="${cx}" cy="${cy}" r="${r * 1.3}" fill="transparent"/>`;
      // a vandalized prop goes dark red; a broken one gets a cross through it
      const fill = isBroken(bl) ? "#6E2A26" : full ? "var(--bad)" : t.color, sw = on || dead ? 2.5 : 1.2;
      if(bl.type === "bin" || bl.type === "lamp") s += `<circle cx="${cx}" cy="${cy}" r="${r * .75}" fill="${fill}" stroke="${edge}" stroke-width="${sw}" vector-effect="non-scaling-stroke"/>`;
      else s += `<polygon points="${polyStr(insetRect(bl.points, Math.max(1, r * 2 / Math.max(t.w, t.d))))}" fill="${fill}" stroke="${edge}" stroke-width="${sw}" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
      if(bl.type === "lamp" && !isBroken(bl)) s += `<circle cx="${cx}" cy="${cy}" r="${r * .3}" fill="#FFF6C8" pointer-events="none"/>`;
      if(bl.type === "sign" && !isBroken(bl)) s += `<text class="glyph" x="${cx}" y="${cy}" font-size="${r * .9}" pointer-events="none">i</text>`;
      if(isBroken(bl)) s += `<path d="M${cx - r*.6} ${cy - r*.6}L${cx + r*.6} ${cy + r*.6}M${cx + r*.6} ${cy - r*.6}L${cx - r*.6} ${cy + r*.6}" stroke="#fff" stroke-width="1.5" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
      s += `</g>`;
      continue;
    }
    s += `<g data-kind="building" data-id="${esc(bl.id)}" style="cursor:pointer">`;
    s += `<polygon points="${polyStr(bl.points)}" fill="${t.color}" stroke="${dead ? "var(--bad)" : on ? "var(--sel)" : reach ? "#1D2B22" : "var(--bad)"}" stroke-width="${on || dead ? 3.5 : 1.5}" ${reach ? "" : `stroke-dasharray="4 3"`} stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
    // departments show their name once there's room for it; smaller buildings show a letter
    if(t.dept && t.d * k >= 26) s += `<text class="glyph" x="${cx}" y="${cy}" font-size="${Math.min(t.d * .42, 15*inv)}" letter-spacing=".04em">${t.tag || t.label}</text>`;
    else s += `<text class="glyph" x="${cx}" y="${cy}" font-size="${fs}">${t.glyph}</text>`;
    // graffiti: a purple scribble across the front
    if((bl.graffiti || 0) >= VANDAL.grossAt){
      const w = Math.min(t.w, t.d) * .35;
      s += `<path d="M${cx - w} ${cy + w*.4}q${w*.25} ${-w*.8} ${w*.5} 0t${w*.5} 0t${w*.5} 0t${w*.5} 0" fill="none" stroke="#C04BD8" stroke-width="${Math.max(.6, 2.2*inv)}" stroke-linecap="round" pointer-events="none"/>`;
    }
    s += `</g>`;
  }
  // with cameras researched, a selected Security Office shows what every office watches
  const selB = sel && sel.kind === "building" && findItem("building", sel.id);
  if(selB && selB.type === "security" && hasTech("cameras")) for(const o of state.buildings.filter(x => x.type === "security")){
    const [ox, oy] = centroid(o.points);
    s += `<circle cx="${ox}" cy="${oy}" r="${SECURITY.cameraRadius}" fill="#2B3F6B" fill-opacity=".08" stroke="#2B3F6B" stroke-width="1.5" stroke-dasharray="6 4" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
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

  world.innerHTML = s;
  renderOverlay();
  syncAnimals();
  applyTransform();
}

// Shrink a shape toward its middle (used for a vivarium's inner glass pane)
function insetRect(pts, f){ const [cx, cy] = centroid(pts); return pts.map(([x, y]) => [cx + (x - cx)*f, cy + (y - cy)*f]); }

function renderOverlay(){
  const inv = 1/view.k;
  let s = "";
  if(draw){
    const poly = isPoly(draw.kind);
    let all = draw.hover ? draw.pts.concat([draw.hover]) : draw.pts;
    if(draw.kind === "exhibit") all = closeAlong(all);
    const err = draw.error;
    const col = err ? "var(--bad)" : "var(--sel)";
    if(poly && all.length >= 3) s += `<polygon points="${polyStr(all)}" fill="${col}" fill-opacity=".18" stroke="none"/>`;
    if(!poly && all.length >= 2) s += `<polyline points="${polyStr(all)}" stroke="${col}" stroke-opacity=".35" stroke-width="${2*PATH_HALF_WIDTH}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
    if(all.length >= 2) s += `<polyline points="${polyStr(all)}" fill="none" stroke="${col}" stroke-width="2.5" vector-effect="non-scaling-stroke"/>`;
    if(poly && all.length >= 3) s += `<line x1="${all[all.length-1][0]}" y1="${all[all.length-1][1]}" x2="${all[0][0]}" y2="${all[0][1]}" stroke="${col}" stroke-width="1.5" stroke-dasharray="5 4" vector-effect="non-scaling-stroke"/>`;
    draw.pts.forEach((p, i) => {
      const first = poly && i === 0 && draw.pts.length >= 3;
      s += `<circle cx="${p[0]}" cy="${p[1]}" r="${(first ? 7 : 4.5)*inv}" fill="${first ? "var(--sel)" : "#fff"}" stroke="var(--sel)" stroke-width="2" vector-effect="non-scaling-stroke"/>`;
    });
  }
  if(landGhost && landKey(tool)){
    const t = LAND[landGhost.key];
    s += `<circle cx="${landGhost.x}" cy="${landGhost.y}" r="${t.r}" fill="${t.color}" fill-opacity=".55" stroke="${landGhost.ok ? "var(--sel)" : "var(--bad)"}" stroke-width="2.5" stroke-dasharray="5 3" vector-effect="non-scaling-stroke"/>`;
  }
  if(ghost){
    const col = ghost.ok ? "var(--sel)" : "var(--bad)", t = BUILDINGS[tool];
    s += `<polygon points="${polyStr(ghost.pts)}" fill="${t.color}" fill-opacity=".55" stroke="${col}" stroke-width="2.5" stroke-dasharray="5 3" vector-effect="non-scaling-stroke"/>`;
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
    for(const e of state.exhibits){
      if(e.viv) continue;
      e.points.forEach((p, i) => {
        const q = e.points[(i + 1) % e.points.length], mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
        s += `<circle cx="${mx}" cy="${my}" r="${5*inv}" fill="var(--sel)" fill-opacity=".85" stroke="#fff" stroke-width="1.5" vector-effect="non-scaling-stroke" pointer-events="none"/><path d="M${mx - 2.5*inv} ${my}h${5*inv}M${mx} ${my - 2.5*inv}v${5*inv}" stroke="#fff" stroke-width="1.5" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
      });
      e.points.forEach((p, i) => { const on = mvCorner && mvCorner.id === e.id && mvCorner.i === i; s += `<circle cx="${p[0]}" cy="${p[1]}" r="${(on ? 8 : 6.5)*inv}" fill="${on ? "var(--sel)" : "#fff"}" stroke="var(--sel)" stroke-width="2.5" vector-effect="non-scaling-stroke" pointer-events="none"/>`; });
    }
  }
  if(snapMark) s += `<circle cx="${snapMark[0]}" cy="${snapMark[1]}" r="${10*inv}" fill="none" stroke="var(--sel)" stroke-width="2" vector-effect="non-scaling-stroke"/>`;
  overlay.innerHTML = s;
}

function applyTransform(){ cam.setAttribute("transform", `translate(${view.tx} ${view.ty}) scale(${view.k})`); }

/* ---------- animals wandering in their exhibits ---------- */
const herd = new Map();   // animal id -> {el, x, y, tx, ty, wait, spd, exhibitId}

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
        h = {el, x, y, tx:x, ty:y, wait:Math.random()*3, spd:.6 + Math.random()*.8, exhibitId:e.id, sp:a.sp};
        herd.set(a.id, h);
        animalLayer.appendChild(el);
      }
      // vivarium animals stay small enough to fit inside the glass
      const s = SPECIES_BY_ID[a.sp], r = e.viv ? Math.min(VIVARIUMS[e.viv].d / 7, Math.max(.4, 3*inv)) : Math.max(animalRadius(a.sp), 4*inv);
      const showLetter = r * view.k >= 8;
      // sick animals get a red ring
      h.el.innerHTML = (noticed(a) ? `<circle r="${r * 1.45}" fill="none" stroke="#E5484D" stroke-width="2" stroke-dasharray="${a.darted ? "2 2" : "none"}" vector-effect="non-scaling-stroke"/>` : "") +
        `<circle r="${r}" fill="${PERIOD_COLOR[s.period]}" stroke="#1D2B22" stroke-width="1.5" vector-effect="non-scaling-stroke"/>` +
        (showLetter ? `<text class="glyph" font-size="${r*1.1}" fill="#1D2B22" style="fill:#1D2B22">${s.name[0]}</text>` : "");
      h.el.setAttribute("transform", `translate(${h.x.toFixed(2)} ${h.y.toFixed(2)})`);
    }
  }
  for(const [id, h] of herd) if(!seen.has(id)){ h.el.remove(); herd.delete(id); }
}

function animateAnimals(dt){
  for(const h of herd.values()){
    const e = state.exhibits.find(x => x.id === h.exhibitId); if(!e) continue;
    if(h.wait > 0){ h.wait -= dt; continue; }
    const dx = h.tx - h.x, dy = h.ty - h.y, d = Math.hypot(dx, dy);
    if(d < .3){ h.wait = 1 + Math.random()*4; [h.tx, h.ty] = randomInside(e.points); continue; }
    const step = Math.min(d, h.spd * 3 * dt);
    h.x += dx/d * step; h.y += dy/d * step;
    h.el.setAttribute("transform", `translate(${h.x.toFixed(2)} ${h.y.toFixed(2)})`);
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
    const m = `M${x.toFixed(2)} ${y.toFixed(2)}h0.001`;
    d[moodColors ? (p.mood >= 60 ? 0 : p.mood >= 35 ? 1 : 2) : p.shirt].push(m); all.push(m);
  }
  shirtPaths.forEach((el, i) => { el.setAttribute("stroke", cols[i] || SHIRTS[i]); el.setAttribute("d", d[i].join("")); });
  outline.setAttribute("d", all.join(""));
}

/* ---------- snapping new corners to things nearby ---------- */
function toWorld(cx, cy){ const r = svg.getBoundingClientRect(); return {x:(cx - r.left - view.tx)/view.k, y:(cy - r.top - view.ty)/view.k}; }

function snapAt(clientX, clientY, ev){
  const p = toWorld(clientX, clientY);
  if(ev && ev.altKey) return {x:p.x, y:p.y, info:null};
  const R = 12 / view.k;
  let best = null, bd = R;
  const tryV = (v, kind, id) => { const d = Math.hypot(p.x - v[0], p.y - v[1]); if(d < bd){ bd = d; best = {x:v[0], y:v[1], info:{type:"vertex", kind, id}}; } };
  tryV(state.gate, "gate", "gate");
  for(const q of state.paths) q.points.forEach(v => tryV(v, "path", q.id));
  for(const q of state.exhibits) q.points.forEach(v => tryV(v, "exhibit", q.id));
  state.boundary.forEach(v => tryV(v, "boundary", "boundary"));
  if(best) return best;
  // with grid snap on, land on the nearest grid point (and still join a path if that point sits on one)
  if(gridSnap){
    const g = [Math.round(p.x / GRID_STEP) * GRID_STEP, Math.round(p.y / GRID_STEP) * GRID_STEP];
    let info = {type:"grid"};
    for(const q of state.paths) for(let i = 1; i < q.points.length; i++)
      if(segProj(g[0], g[1], q.points[i-1], q.points[i]).d < .05) info = {type:"seg", kind:"path", id:q.id};
    return {x:g[0], y:g[1], info};
  }
  bd = R * .8;
  const tryS = (pts, closed, kind, id) => {
    const n = pts.length, segs = closed ? n : n-1;
    for(let i = 0; i < segs; i++){ const r = segProj(p.x, p.y, pts[i], pts[(i+1) % n]); if(r.d < bd){ bd = r.d; best = {x:r.x, y:r.y, info:{type:"seg", kind, id}}; } }
  };
  for(const q of state.paths) tryS(q.points, false, "path", q.id);
  for(const q of state.exhibits) tryS(q.points, true, "exhibit", q.id);
  tryS(state.boundary, true, "boundary", "boundary");
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
function insidePlot(pts){ return pts.every(p => inPoly(p[0], p[1], state.boundary) || distToEdge(p[0], p[1], state.boundary) < .5); }

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
  if(!insidePlot(pts)) return "Keep it inside the park boundary.";
  if(area(pts) < 60) return "Too small. Exhibits need at least 60 m².";
  if(state.exhibits.some(e => shapesOverlap(pts, e.points))) return "It overlaps another exhibit.";
  if(state.buildings.some(b => shapesOverlap(pts, b.points))) return "It overlaps a building.";
  if(state.paths.some(p => lineEntersShape(p.points, pts))) return "A path runs through it.";
  const fence = BARRIERS[fenceSel];
  if(fence.tech && !hasTech(fence.tech)) return `Research ${TECH.find(x => x.id === fence.tech).label.toLowerCase()} at ORACLE first.`;
  const cost = exhibitCost(pts, fenceSel);
  if(!canAfford(cost)) return `Costs ${money(cost)}. You have ${money(state.money)}.`;
  return null;
}

function pathProblem(pts, type){
  if(pts.length < 2) return "Needs at least 2 points.";
  if(lineLength(pts) < 2) return "Too short.";
  if(!insidePlot(pts)) return "Keep it inside the park boundary.";
  if(state.exhibits.some(e => lineEntersShape(pts, e.points))) return "Paths can't go through an exhibit.";
  if(state.buildings.some(b => !BUILDINGS[b.type].onPath && lineEntersShape(pts, b.points))) return "Paths can't go through a building.";
  const cost = pathCost(pts, type);
  if(!canAfford(cost)) return `Costs ${money(cost)}. You have ${money(state.money)}.`;
  return null;
}

/* ---------- drawing exhibits and paths ---------- */
const DRAW_TEXT = {
  exhibit:["New exhibit", "Tap to drop fence corners. Tap the first corner to close it, or start and end on a neighbor's fence and tap the last corner again to share its wall."],
  path:["New path", "Tap to add points. Start on the entrance or another path. Tap the last point again to finish."],
  zone:["New work zone", "Tap to drop corners around the exhibits and stores you want to group. Tap the first corner again to close it. Things inside join the zone."],
  service:["New service road", "Staff only. Guests won't walk it. Start on any path, then tap the last point again to finish."]
};
const drawType = () => draw && draw.kind === "service" ? "service" : undefined;

function setTool(t){
  if(tool === "zoneedit" && zedit){ const z = zoneById(zedit.id); if(z && !zedit.done) z.points = zedit.orig; zedit = null; }
  if(draw) endDraw();
  ghost = null; doomed = null; hoverItem = null; snapMark = null; gateGhost = null; landGhost = null;
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
  else if(landKey(t)) showBar(`Place ${LAND[landKey(t)].one}`, "Tap inside an open exhibit. Animals feel at home among ponds and rocks, and some can't do without water.", `${money(LAND[landKey(t)].price)} each`, {undo:false, finish:false, cancel:"Done"});
  else if(isBuildTool(t)){
    const b = BUILDINGS[t];
    const fits = b.viv ? SPECIES.filter(s => s.viv && vivRank(s.viv) <= vivRank(b.viv)).map(s => s.name) : [];
    showBar(`Place ${b.one}`, b.dept ? `Backstage building${b.unique ? ", one per park" : ""}. Point beside a ${b.serviceOnly ? "service road" : "path or service road"} and tap.`
      : b.viv ? `${VIVARIUMS[b.viv].w} × ${VIVARIUMS[b.viv].d} m. Tap beside a path. Fits ${fits.join(", ")}.`
      : b.kind ? `Point beside a path and tap, then tap it to choose what it sells. Room for ${b.menuSlots} item${b.menuSlots === 1 ? "" : "s"}.`
      : b.onPath ? "Point at a path and tap. It sits on the edge you point at."
      : b.prop ? "Point beside a path and tap."
      : "Point beside a path and tap. It turns to face the path by itself.",
      `${money(b.price)}${b.dept ? "" : " each"}, ${money(b.upkeep)} a day to run`, {undo:false, finish:false, cancel:"Done"});
  }
  else if(t === "zoneedit" && zedit){
    showBar("Reshape zone", "Drag a corner to move it. Drag a + on an edge to add a corner. Tap a corner, then Delete corner to remove it.", "", {undo:true, finish:true, cancel:"Cancel", undoText:"Delete corner", finishText:"Done"});
    updateZoneEditBar();
  }
  else if(t === "gate") showBar("Place a keeper gate", "Tap an exhibit's fence where a path or service road meets it. One gate per exhibit; tapping again moves it.", `${money(GATE_COST)} each`, {undo:false, finish:false, cancel:"Done"});
  else if(t === "move"){
    mvCorner = null;
    showBar("Move", "Drag a building, exhibit or path to a new spot. Drag an exhibit's corner to reshape it, or a + on its fence to add a corner. Tap a corner, then Delete corner.", "", {undo:true, finish:false, cancel:"Done", undoText:"Delete corner"});
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
  showBar(kind === "exhibit" ? `New exhibit: ${BARRIERS[fenceSel].label.toLowerCase()}` : t, hint, "", {undo:true, finish:true, cancel:"Cancel"});
  updateDrawbar();
  const fence = BARRIERS[fenceSel];
  if(kind === "exhibit" && fence.tech && !hasTech(fence.tech)) setStat(`Research ${TECH.find(x => x.id === fence.tech).label.toLowerCase()} at ORACLE first.`, true);
}

function drawPoints(){ return draw.hover ? draw.pts.concat([draw.hover]) : draw.pts; }

function updateDrawbar(){
  if(!draw) return;
  const all = drawPoints();
  let stat = "", err = null;
  if(draw.kind === "exhibit"){
    const shape = closeAlong(all);
    if(shape.length >= 3){ stat = `${fmtArea(area(shape))}, ${Math.round(perimeter(shape))} m of ${BARRIERS[fenceSel].label.toLowerCase()}. ${money(exhibitCost(shape, fenceSel))}`; err = exhibitProblem(shape); }
  } else if(draw.kind === "zone"){
    if(all.length >= 3){ stat = `${fmtArea(area(all))}. Free`; err = zoneProblem(all); }
  } else if(all.length >= 2){
    stat = `${Math.round(lineLength(all))} m. ${money(pathCost(all, drawType()))}`; err = pathProblem(all, drawType());
  }
  draw.error = err;
  setStat(err || stat, !!err);
  $("#dUndo").disabled = !draw.pts.length;
  const ready = draw.kind === "zone" ? !zoneProblem(draw.pts) : draw.kind === "exhibit" ? closeAlong(draw.pts).length >= 3 && !exhibitProblem(closeAlong(draw.pts)) : draw.pts.length >= 2 && !pathProblem(draw.pts, drawType());
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
function cancelTool(){ setTool("select"); }
function undoDrawPoint(){ if(tool === "zoneedit"){ deleteZoneCorner(); return; } if(tool === "move"){ deleteMoveCorner(); return; } if(!draw || !draw.pts.length) return; draw.pts.pop(); draw.snaps.pop(); updateDrawbar(); renderOverlay(); }

function finishDraw(){
  if(tool === "zoneedit"){ finishZoneEdit(); return; }
  if(!draw) return;
  const d = draw, type = drawType();
  const pts = (d.kind === "exhibit" ? closeAlong(d.pts) : d.pts).map(p => [p[0], p[1]]);
  const problem = d.kind === "zone" ? zoneProblem(pts) : d.kind === "exhibit" ? exhibitProblem(pts) : pathProblem(pts, type);
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
  if(d.kind === "exhibit"){
    const cost = exhibitCost(pts, fenceSel);
    spend(cost, "built");
    const used = new Set(state.exhibits.map(x => x.name));
    let n = 1; while(used.has(`Exhibit ${n}`)) n++;
    const e = {id:uid("e-"), name:`Exhibit ${n}`, points:pts, animals:[], happy:70, cond:100, inspected:{day:state.day, cond:100}};
    if(fenceSel !== "wood") e.barrier = fenceSel;
    autoZone(e);
    state.exhibits.push(e);
    afterChange();
    toolDone({kind:"exhibit", id:e.id});
    ui.toast(`Built ${e.name} for ${money(cost)}.`);
  } else {
    d.snaps.forEach((sn, i) => { if(sn && sn.kind === "path" && sn.type === "seg") insertJunction(sn.id, pts[i][0], pts[i][1]); });
    const cost = pathCost(pts, type);
    spend(cost, "built");
    const p = {id:uid("p-"), name:type ? "Service road" : "Path", points:pts};
    if(type) p.type = type;
    state.paths.push(p);
    afterChange();
    // keep the tool going so you can draw the next one
    startDraw(d.kind);
    render();
    const joinedNow = (type ? derived.joinedAll : derived.joined).has(p.id);
    const what = type ? "service road" : "path";
    ui.toast(joinedNow ? `Built ${Math.round(lineLength(pts))} m of ${what} for ${money(cost)}.` : `Built a ${what}, but it doesn't reach the entrance yet.`, joinedNow ? "" : "bad");
  }
}

function toolDone(newSel){
  setTool("select");
  if(newSel) select(newSel.kind, newSel.id);
}

function drawTap(e){
  const sn = snapAt(e.clientX, e.clientY, e), k = view.k;
  const near = q => q && Math.hypot(q[0] - sn.x, q[1] - sn.y) * k < 14;
  if(isPoly(draw.kind) && draw.pts.length >= 3 && near(draw.pts[0])){ finishDraw(); return; }
  // tapping the last corner again finishes an open shape that ends on a neighbor's fence
  if(draw.kind === "exhibit" && draw.pts.length >= 2 && near(draw.pts[draw.pts.length-1])){ finishDraw(); return; }
  if(!isPoly(draw.kind) && draw.pts.length && near(draw.pts[draw.pts.length-1])){ finishDraw(); return; }
  draw.pts.push([sn.x, sn.y]); draw.snaps.push(sn.info);
  snapMark = null; updateDrawbar(); renderOverlay();
}

/* ---------- placing guest buildings ---------- */
function placeGhost(clientX, clientY){
  const t = BUILDINGS[tool];
  const p = toWorld(clientX, clientY);
  let best = null;
  // guest buildings face footpaths; backstage departments can face service roads too
  for(const q of state.paths){
    if(isService(q) && !t.dept) continue;
    if(t.serviceOnly && !isService(q)) continue;   // depots go on service roads, where ATVs can drive
    for(let i = 1; i < q.points.length; i++){
      const r = segProj(p.x, p.y, q.points[i-1], q.points[i]);
      if(r.d < 30 + t.d/2 && (!best || r.d < best.d)) best = {...r, a:q.points[i-1], b:q.points[i], hw:halfWidth(q)};
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
    // a sign goes on the edge of the path that faces the closest exhibit fence; everything else on the side you point at
    let fx = p.x, fy = p.y;
    if(tool === "sign"){ let sd = EDU.signReach + best.hw; for(const e of state.exhibits) for(let i = 0; i < e.points.length; i++){ const r = segProj(best.x, best.y, e.points[i], e.points[(i+1) % e.points.length]); if(r.d < sd){ sd = r.d; fx = r.x; fy = r.y; } } }
    const side = ((fx - best.x)*nx + (fy - best.y)*ny) >= 0 ? 1 : -1;
    let off = t.onPath ? Math.max(0, best.hw - t.d/2 - .1) : t.d/2 + best.hw + .5;   // props sit on the path, hugging the edge on the side you point at
    // a fence right at the path edge (older, narrower paths): slide in until the prop clears it
    if(t.onPath) while(off > 0 && state.exhibits.some(e => shapesOverlap(rectPts(best.x + nx*side*off, best.y + ny*side*off, t.w, t.d, Math.atan2(dy, dx)), e.points))) off = Math.max(0, off - .1);
    x = best.x + nx*side*off; y = best.y + ny*side*off;
    angle = Math.atan2(dy, dx);
  } else why = why || (t.serviceOnly ? "Move it next to a service road. ATVs can't use guest paths." : t.dept ? "Move it next to a path or service road." : "Move it next to a path.");
  const pts = rectPts(x, y, t.w, t.d, angle);
  if(!why && !insidePlot(pts)) why = "Keep it inside the park boundary.";
  if(!why && state.exhibits.some(e => shapesOverlap(pts, e.points))) why = "It overlaps an exhibit.";
  if(!why && state.buildings.some(b => shapesOverlap(pts, b.points))) why = "It overlaps another building.";
  if(!why && !t.onPath && state.paths.some(q => lineEntersShape(q.points, pts))) why = "It sits on a path.";
  if(!why && !canAfford(t.price)) why = `Costs ${money(t.price)}. You have ${money(state.money)}.`;
  ghost = {pts, x, y, angle, ok:!why, why};
  setStat(why || `${money(t.price)}. Tap to build.`, !!why);
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
    state.exhibits.push(e);
    afterChange(); render();
    ui.toast(isReachable(e) ? `Built ${t.one} for ${money(t.price)}. Tap it to add animals.` : `Built ${t.one}, but its path doesn't reach the entrance yet.`, isReachable(e) ? "" : "bad");
    return;
  }
  const b = {id:uid("b-"), type:tool, points:ghost.pts};
  autoZone(b);
  state.buildings.push(b);
  afterChange();
  render();
  ui.toast(isReachable(b) ? `Built ${t.one} for ${money(t.price)}.` : `Built ${t.one}, but its path doesn't reach the entrance yet.`, isReachable(b) ? "" : "bad");
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
function drawKeepers(){
  const layer = $("#keeperLayer"), inv = 1/view.k, seen = new Set();
  for(const c of crew){
    if(!c.at) continue;
    seen.add(c.id);
    let el = keeperEls.get(c.id);
    if(!el){ el = document.createElementNS("http://www.w3.org/2000/svg", "g"); el.setAttribute("pointer-events", "none"); layer.appendChild(el); keeperEls.set(c.id, el); }
    const nx = c.route[0];
    const x = nx ? c.at.x + (nx.x - c.at.x) * c.t : c.at.x, y = nx ? c.at.y + (nx.y - c.at.y) * c.t : c.at.y;
    const r = Math.max(1.3, 5*inv), food = c.carry ? FOOD_COLOR[c.carry.type] : null, cargo = c.cargo ? PERIOD_COLOR[SPECIES_BY_ID[c.cargo.sp].period] : null;
    const drive = onAtv(c), key = `${r.toFixed(3)}|${food}|${cargo}|${drive}`;
    if(el.dataset.key !== key){
      el.dataset.key = key;
      // an animal being moved rides along beside its keeper; on a service road with an ATV, they ride it
      el.innerHTML = atvSvg(r, drive) + (cargo ? `<circle cx="${-r*1.6}" cy="${-r*.6}" r="${r*1.1}" fill="${cargo}" stroke="#1D2B22" stroke-width="1.5" vector-effect="non-scaling-stroke"/>` : "") +
        `<circle r="${r}" fill="#2E6B3A" stroke="#fff" stroke-width="2" vector-effect="non-scaling-stroke"/>` +
        (food ? `<rect x="${r*.4}" y="${-r*1.5}" width="${r*1.1}" height="${r*1.1}" fill="${food}" stroke="#1D2B22" stroke-width="1" vector-effect="non-scaling-stroke"/>` : "");
    }
    el.setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
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
    el.setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
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
    el.setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
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
    el.setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
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
    el.setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
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
    el.setAttribute("transform", `translate(${n.x.toFixed(2)} ${n.y.toFixed(2)})`);
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
    s += `<g transform="translate(${p[0].toFixed(2)} ${p[1].toFixed(2)})">`;
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
  const b = {id:uid("b-"), type:"platform", exhibitId:g.e.id, points:g.pts, inward:true};
  state.buildings.push(b);
  afterChange(); render();
  ui.toast(isReachable(b) ? `Built a viewing platform on ${g.e.name}. Guests will love it.` : "Built a viewing platform, but no guest path reaches it yet.", isReachable(b) ? "good" : "bad");
}

/* ---------- ponds and rocks ---------- */
function landPoint(ev){
  const p = toWorld(ev.clientX, ev.clientY);
  return gridSnap && !ev.altKey ? {x:Math.round(p.x / GRID_STEP) * GRID_STEP, y:Math.round(p.y / GRID_STEP) * GRID_STEP} : p;
}
function landHover(ev){
  const key = landKey(tool), p = landPoint(ev);
  landGhost = {...landSpot(p.x, p.y, key), key};
  setStat(landGhost.why || `${money(LAND[key].price)}. It goes in ${landGhost.e.name}.`, !landGhost.ok);
  renderOverlay();
}
function landTap(ev){
  const key = landKey(tool), p = landPoint(ev), g = landSpot(p.x, p.y, key);
  if(!g.ok){ setStat(g.why, true); return; }
  placeLand(g.e, key, g.x, g.y);
  afterChange(); render();
  ui.toast(`Added ${LAND[key].one} to ${g.e.name}.`, "good");
}

/* ---------- bulldozing ---------- */
function bulldozeTap(kind, id){
  if(!kind){ doomed = null; setStat(""); render(); return; }
  const it = findItem(kind, id);
  if(!it) return;
  if(it.fixed){ setStat("The main walk from the entrance can't be removed.", true); return; }
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

function removeItem(kind, it){
  const refund = refundFor(kind, it);
  earn(refund, "sold");
  if(kind === "exhibit") for(const a of it.animals) earn(Math.round(SPECIES_BY_ID[a.sp].price * COST.animalResale), "sold");
  if(kind === "land"){ const o = state.exhibits.find(x => landOf(x).includes(it)); if(o) o.land.splice(o.land.indexOf(it), 1); }
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
// What can be dragged: buildings (not platforms, which ride with their exhibit), exhibits, and paths (not the entrance walk)
function moveTarget(hit){
  if(!hit.kind) return null;
  const it = findItem(hit.kind, hit.id);
  if(!it || !["exhibit", "path", "building"].includes(hit.kind)) return null;
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
  } else if(kind === "building"){
    if(state.exhibits.some(e => shapesOverlap(pts, e.points))) return "It overlaps an exhibit.";
    if(state.buildings.some(b => b !== it && shapesOverlap(pts, b.points))) return "It overlaps another building.";
    if(BUILDINGS[it.type].onPath){ if(!state.paths.some(p => !isService(p) && lineShapeDist(p.points, pts) <= PATH_HALF_WIDTH)) return "Keep it on a path."; }
    else if(state.paths.some(p => lineEntersShape(p.points, pts))) return "It sits on a path.";
  } else {
    if(state.exhibits.some(e => lineEntersShape(pts, e.points))) return "Paths can't go through an exhibit.";
    if(state.buildings.some(b => !BUILDINGS[b.type].onPath && lineEntersShape(pts, b.points))) return "Paths can't go through a building.";
  }
  return null;
}
// Everything that moves with the item: its own points, an exhibit's gate and platforms, and the animals wandering inside
function moveBy(m, dx, dy){
  const it = m.it;
  it.points = shiftPts(m.orig, dx, dy);
  if(m.gate) it.gate = [m.gate[0] + dx, m.gate[1] + dy];
  for(const pl of m.plats) pl.b.points = shiftPts(pl.pts, dx, dy);
  for(const l of m.land){ l.f.x = l.x + dx; l.f.y = l.y + dy; }
  m.dx = dx; m.dy = dy;
}
function startMove(it, kind, e){
  const w = toWorld(e.clientX, e.clientY);
  return {it, kind, wx:w.x, wy:w.y, dx:0, dy:0, orig:it.points.map(p => p.slice()), gate:it.gate ? it.gate.slice() : null,
    plats:kind === "exhibit" ? state.buildings.filter(b => b.exhibitId === it.id).map(b => ({b, pts:b.points.map(p => p.slice())})) : [],
    land:kind === "exhibit" ? landOf(it).map(f => ({f, x:f.x, y:f.y})) : []};
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
    for(const h of herd.values()) if(h.exhibitId === m.it.id){ h.x += m.dx; h.y += m.dy; h.tx += m.dx; h.ty += m.dy; }
  }
  afterChange(); render();
  const it = m.it, reach = m.kind === "path" ? (isService(it) ? derived.joinedAll : derived.joined).has(it.id) : isReachable(it);
  ui.toast(reach ? "Moved." : "Moved, but it doesn't reach the entrance from there.", reach ? "" : "bad");
  setStat("");
}

// Reshaping an exhibit: drag a corner, drag a + to add one, tap a corner and delete it
function cornerAt(clientX, clientY){
  const p = toWorld(clientX, clientY), R = 14 / view.k;
  for(const e of state.exhibits){
    if(e.viv) continue;
    for(let i = 0; i < e.points.length; i++) if(Math.hypot(p.x - e.points[i][0], p.y - e.points[i][1]) < R) return {e, i, type:"v"};
  }
  for(const e of state.exhibits){
    if(e.viv) continue;
    for(let i = 0; i < e.points.length; i++){ const a = e.points[i], b = e.points[(i + 1) % e.points.length]; if(Math.hypot(p.x - (a[0] + b[0]) / 2, p.y - (a[1] + b[1]) / 2) < R) return {e, i, type:"m"}; }
  }
  return null;
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
  if(state.buildings.some(b => b.exhibitId === e.id)) return "Take down its viewing platforms first.";
  if(landOf(e).some(f => !deepInside(f.x, f.y, pts, LAND[f.type].r))) return "A pond or rock would end up outside the fence. Bulldoze it first.";
  const diff = reshapeCost(e, orig);
  if(diff > 0 && !canAfford(diff)) return `The new fence costs ${money(diff)} more. You have ${money(state.money)}.`;
  return null;
}
function updateMoveBar(){ if(tool === "move") $("#dUndo").disabled = !mvCorner; }
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
  const e = mvCorner && findItem("exhibit", mvCorner.id); if(!e) return;
  if(e.points.length <= 3){ setStat("An exhibit needs at least 3 corners.", true); return; }
  const orig = e.points.map(p => p.slice()); e.points.splice(mvCorner.i, 1);
  const why = reshapeProblem(e, orig);
  if(why){ e.points = orig; setStat(why, true); return; }
  mvCorner = null; updateMoveBar(); commitReshape(e, orig);
}

/* ---------- moving the view ---------- */
function svgSize(){ const r = svg.getBoundingClientRect(); return {w:r.width, h:r.height}; }
function fit(){
  const {w, h} = svgSize(); if(!w || !h) return;
  const b = bbox(state.boundary), pad = 40;
  view.k = clamp(Math.min((w - pad*2)/(b.x1 - b.x0), (h - pad*2)/(b.y1 - b.y0)), KMIN, KMAX);
  view.tx = (w - (b.x1 - b.x0)*view.k)/2 - b.x0*view.k;
  view.ty = (h - (b.y1 - b.y0)*view.k)/2 - b.y0*view.k;
  render();
}
function zoomAt(mx, my, f){
  const k = clamp(view.k * f, KMIN, KMAX), wx = (mx - view.tx)/view.k, wy = (my - view.ty)/view.k;
  view.k = k; view.tx = mx - wx*k; view.ty = my - wy*k; queueRender();
}
function centerOn(it){
  if(!it) return;
  const {w, h} = svgSize(), b = bbox(it.points);
  const cx = (b.x0 + b.x1)/2, cy = (b.y0 + b.y1)/2 + (window.matchMedia("(max-width:760px)").matches ? h*.2/view.k : 0);
  view.tx = w/2 - cx*view.k; view.ty = h/2 - cy*view.k; render();
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
    pinch = {d:Math.hypot(a.x-b.x, a.y-b.y) || 1, k:view.k, tx:view.tx, ty:view.ty, mx:(a.x+b.x)/2, my:(a.y+b.y)/2};
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
      const orig = c.e.points.map(p => p.slice());
      if(c.type === "m"){ const a = orig[c.i], b = orig[(c.i + 1) % orig.length]; c.e.points.splice(c.i + 1, 0, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]); c.i++; }
      drag = {rv:{e:c.e, i:c.i, orig, added:c.type === "m"}, sx:e.clientX, sy:e.clientY, moved:false, hit:{kind:null, id:null}};
      return;
    }
    const hit = itemAt(e.target), it = moveTarget(hit);
    if(it){ drag = {mv:startMove(it, hit.kind, e), sx:e.clientX, sy:e.clientY, moved:false, hit}; return; }
  }
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
    const wx = (pinch.mx - r.left - pinch.tx)/pinch.k, wy = (pinch.my - r.top - pinch.ty)/pinch.k;
    const mx = (a.x+b.x)/2 - r.left, my = (a.y+b.y)/2 - r.top;
    view.k = k; view.tx = mx - wx*k; view.ty = my - wy*k; queueRender(); return;
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
    r.e.points[r.i] = g ? [Math.round(w.x / g) * g, Math.round(w.y / g) * g] : [w.x, w.y];
    const why = reshapeProblem(r.e, r.orig), diff = reshapeCost(r.e, r.orig);
    setStat(why || `${fmtArea(area(r.e.points))}. ${diff > 0 ? "Extra fence " + money(diff) : diff < 0 ? "Fence refund " + money(Math.round(-diff * COST.refundShare)) : "No change in fence"}`, !!why);
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
      if(r.added) r.e.points = r.orig; else mvCorner = mvCorner && mvCorner.id === r.e.id && mvCorner.i === r.i ? null : {id:r.e.id, i:r.i};
      updateMoveBar(); render(); return;
    }
    const why = reshapeProblem(r.e, r.orig);
    if(why){ r.e.points = r.orig; ui.toast(`Couldn't reshape it. ${why}`, "bad"); setStat(""); render(); return; }
    mvCorner = {id:r.e.id, i:r.i}; updateMoveBar(); setStat(""); commitReshape(r.e, r.orig); return;
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
