/* ---------- path tiles on the map: drawing them and the tools that lay and lift them ----------
   The data and the lines derived from it are in tiles.js. This file loads after map.js. map.js calls tilesSvg() from render(), tileOverlaySvg() from renderOverlay(),
   and the tile* pointer functions from its pointer handlers. */

const PATH_TOOL_KIND = {path:"foot", wide:"wide", service:"service", tram:"tram", bridge:"bridge"};
const isPathTool = t => !!PATH_TOOL_KIND[t];
let tdrag = null;    // a drag laying or lifting tiles: {a, b, k, lift, swept:Set of keys}
let thover = null;   // the cell the pointer is over while a path tool or Bulldoze is picked

const cellAt = (cx, cy) => { const w = toWorld(cx, cy); return [Math.floor(w.x / TILE), Math.floor(w.y / TILE)]; };

/* ---------- which theme and what it costs ---------- */
// The theme a new tile gets: its zone's, else the brush's, if it's unlocked (footpaths and promenades only; null for Genesis)
function tileTheme(cx, cy, k){
  if(k !== "foot" && k !== "wide") return null;
  const [x, y] = tileCenter(cx, cy), z = (zones() || []).find(z => z.theme && THEMES[z.theme] && inPoly(x, y, z.points));
  const key = z ? z.theme : state.themes && state.themes.brush;
  return key && key !== "genesis" && THEMES[key] && themeHave(key) ? key : null;
}
const tileFee = (k, theme) => theme ? Math.round(tileCost(k) * THEMES[theme].fee) : 0;

/* ---------- planning a drag ---------- */
function tilePlan(a, b, k){
  const ok = [], bad = []; let cost = 0, why = null, have = 0;
  for(const [cx, cy] of tileLine(a, b)){
    const theme = tileTheme(cx, cy, k), old = state.tiles[tileKey(cx, cy)];
    if(old && old.k === k && (old.t || "") === (theme || "")){ have++; continue; }
    if(old && old.fixed){ bad.push([cx, cy]); why = why || "The main walk can't be changed."; continue; }
    const p = tileProblem(cx, cy, k);
    if(p){ bad.push([cx, cy]); why = why || p; } else { ok.push([cx, cy, theme]); cost += tileCost(k) + tileFee(k, theme); }
  }
  if(cost > state.money && !why) why = `Costs ${money(cost)}. You have ${money(state.money)}.`;
  return {ok, bad, cost, why, have};
}
function tileBar(stat){
  const k = PATH_TOOL_KIND[tool], K = TILE_KINDS[k];
  const text = {foot:"Drag to lay path tiles, straight or at 45°. Each tile is 5 m and joins its neighbours. Start on the entrance or another path.",
    wide:"Drag to lay promenade tiles: roomy paving that holds twice the crowd before guests feel packed. It joins paths and other promenade tiles.",
    service:"Drag to lay service road. Staff only: guests won't walk it. It joins any path.",
    tram:"Drag to lay tram track. Guests ride it between tram stations. Lay it beside your paths, then build a Tram station beside the track and a path.",
    bridge:"Drag to lay wooden bridge. It is the only tile that can go over water. Start on a path or the bank."}[k];
  showBar(`Lay ${K.name.toLowerCase()}`, text + " Lift tiles with Bulldoze.", "", {undo:false, finish:false, cancel:"Done"});
  setStat(k === "tram" && !hasTech("transit") ? `Research ${TECH.find(x => x.id === "transit").label.toLowerCase()} at ORACLE first.` : stat || `${money(tileCost(k))} a tile.`, k === "tram" && !hasTech("transit"));
}
function tileDragStat(){
  if(!tdrag) return;
  if(tdrag.lift){
    const keys = [...tdrag.swept].filter(key => state.tiles[key] && !state.tiles[key].fixed), back = keys.reduce((n, key) => n + Math.round(tileCost(state.tiles[key].k) * COST.refundShare), 0);
    setStat(keys.length ? `Lift ${keys.length} tile${keys.length === 1 ? "" : "s"} for ${money(back)} back.` : "Nothing to lift here.", !keys.length); return;
  }
  const plan = tilePlan(tdrag.a, tdrag.b, tdrag.k);
  setStat(plan.ok.length ? `${plan.ok.length} tile${plan.ok.length === 1 ? "" : "s"}, ${money(plan.cost)}.${plan.bad.length ? ` ${plan.bad.length} can't go: ${plan.why}` : ""}` : plan.why || (plan.have ? "Already there." : ""), !plan.ok.length && !!plan.why);
}

/* ---------- pointer handlers (called from map.js) ---------- */
function tileDragStart(e){
  const c = cellAt(e.clientX, e.clientY);
  if(tool === "bulldoze") tdrag = {a:c, b:c, lift:true, swept:new Set([tileKey(...c)]), last:toWorld(e.clientX, e.clientY)};
  else tdrag = {a:c, b:c, k:PATH_TOOL_KIND[tool], lift:false, swept:new Set()};
  thover = null; tileDragStat(); renderOverlay();
}
function tileDragMove(e){
  const c = cellAt(e.clientX, e.clientY);
  if(tdrag.lift){
    const w = toWorld(e.clientX, e.clientY), l = tdrag.last, before = tdrag.swept.size, n = Math.max(1, Math.ceil(Math.hypot(w.x - l.x, w.y - l.y) / 1));
    for(let i = 1; i <= n; i++){ const x = l.x + (w.x - l.x) * i / n, y = l.y + (w.y - l.y) * i / n, key = tileKey(Math.floor(x / TILE), Math.floor(y / TILE)); if(state.tiles[key]) tdrag.swept.add(key); }
    tdrag.last = w;
    if(tdrag.swept.size !== before){ tileDragStat(); renderOverlay(); }
    return;
  }
  if(c[0] !== tdrag.b[0] || c[1] !== tdrag.b[1]){ tdrag.b = c; tileDragStat(); renderOverlay(); }
}
function tileDragEnd(){
  const d = tdrag; tdrag = null;
  if(d.lift){
    const keys = [...d.swept].filter(key => state.tiles[key]);
    if(!keys.length){ renderOverlay(); return; }
    const r = liftTiles(keys);
    if(!r.n){ setStat("The main walk can't be lifted.", true); renderOverlay(); return; }
    earn(r.back, "sold"); sel = null;
    afterChange(); render(); ui.panel();
    ui.toast(`Lifted ${r.n} tile${r.n === 1 ? "" : "s"} for ${money(r.back)} back.`, "good");
    return;
  }
  const plan = tilePlan(d.a, d.b, d.k);
  if(!plan.ok.length){ if(plan.why) setStat(plan.why, true); renderOverlay(); return; }
  if(plan.cost > state.money){ setStat(plan.why, true); renderOverlay(); return; }
  spend(plan.cost, "built");
  const byTheme = {}; for(const c of plan.ok) (byTheme[c[2] || ""] ||= []).push(c);
  for(const t of Object.keys(byTheme)) layTiles(byTheme[t], d.k, t || null);
  afterChange(); render(); tileBar();
  const first = tileKey(plan.ok[0][0], plan.ok[0][1]), id = tilePath[first], p = state.paths.find(q => q.id === id);
  const joinedNow = d.k === "tram" || (d.k === "service" ? derived.joinedAll : derived.joined).has(id);
  ui.toast(`Laid ${plan.ok.length} tile${plan.ok.length === 1 ? "" : "s"} of ${TILE_KINDS[d.k].name.toLowerCase()} for ${money(plan.cost)}.${joinedNow ? "" : " It doesn't reach the entrance yet."}${plan.bad.length ? ` ${plan.bad.length} couldn't go.` : ""}`, joinedNow ? "good" : "bad");
}
function tileHover(e){
  const c = cellAt(e.clientX, e.clientY);
  if(!thover || thover[0] !== c[0] || thover[1] !== c[1]){
    thover = c;
    if(isPathTool(tool)){ const plan = tilePlan(c, c, PATH_TOOL_KIND[tool]); setStat(plan.ok.length ? `${money(plan.cost)}. Drag to lay more.` : plan.why || "Already there.", !plan.ok.length && !!plan.why); }
    renderOverlay();
  }
}

/* ---------- the ghost while laying or lifting ---------- */
function tileOverlaySvg(inv){
  let s = "";
  const cell = (cx, cy, c, o) => `<rect x="${cx*TILE}" y="${cy*TILE}" width="${TILE}" height="${TILE}" fill="${c}" fill-opacity="${o}" stroke="${c}" stroke-width="1.4" stroke-dasharray="${5*inv} ${3*inv}" vector-effect="non-scaling-stroke"/>`;
  const GREEN = "#4CD964", RED = "#E5484D";
  if(tdrag && tdrag.lift){ for(const key of tdrag.swept){ const [cx, cy] = tileXY(key); s += cell(cx, cy, RED, .35); } }
  else if(tdrag){ const plan = tilePlan(tdrag.a, tdrag.b, tdrag.k); for(const [cx, cy] of plan.ok) s += cell(cx, cy, GREEN, .3); for(const [cx, cy] of plan.bad) s += cell(cx, cy, RED, .3); }
  else if(thover && isPathTool(tool)){ const bad = !!tileProblem(thover[0], thover[1], PATH_TOOL_KIND[tool]); s += cell(thover[0], thover[1], bad ? RED : GREEN, .3); }
  else if(thover && tool === "bulldoze" && state.tiles[tileKey(...thover)]) s += cell(thover[0], thover[1], RED, .35);
  return s ? `<g pointer-events="none">${s}</g>` : "";
}

/* ---------- drawing the tiles ---------- */
const TILE_DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];   // north, east, south, west
// Does tile t carry on into neighbour n with no kerb between (the same surface, or a footpath meeting a service road or bridge)? Tram only meets tram; two themes keep a kerb between them.
function tileOpen(t, n){
  if(!n) return false;
  if((t.k === "tram") !== (n.k === "tram")) return false;
  const guest = x => x.k === "foot" || x.k === "wide";
  return !(guest(t) && guest(n) && (t.t || "") !== (n.t || ""));
}
// The edges of the tiles in `keys` that nothing carries on from: [x0, y0, x1, y1, outward normal index, low-end neighbour open, high-end neighbour open], low to high along the edge
function tileEdges(keys, T){
  const out = [];
  for(const key of keys){
    const [cx, cy] = tileXY(key), t = T[key]; if(!t) continue;
    TILE_DIRS.forEach(([dx, dy], d) => {
      if(tileOpen(t, T[tileKey(cx + dx, cy + dy)])) return;
      const x0 = cx * TILE, y0 = cy * TILE, x1 = x0 + TILE, y1 = y0 + TILE, horiz = dy !== 0;
      const lo = horiz ? T[tileKey(cx - 1, cy)] : T[tileKey(cx, cy - 1)], hi = horiz ? T[tileKey(cx + 1, cy)] : T[tileKey(cx, cy + 1)];
      const ey = dy < 0 ? y0 : y1, ex = dx < 0 ? x0 : x1;
      out.push(horiz ? {a:[x0, ey], b:[x1, ey], d, lo:tileOpen(t, lo), hi:tileOpen(t, hi)} : {a:[ex, y0], b:[ex, y1], d, lo:tileOpen(t, lo), hi:tileOpen(t, hi)});
    });
  }
  return out;
}
const edgePath = edges => edges.map(g => `M${g.a[0]} ${g.a[1]}L${g.b[0]} ${g.b[1]}`).join("");
// The Genesis kerb: a strip K m wide outside each exposed edge (stretched past a convex corner to fill it), a lit 1 px line offset top-left and a shaded one bottom-right,
// the green face, then a 1 px dark joint and a lit pixel every `step` m, kept in step across tiles by the world position
function kerbStrips(edges, K){
  const o = ROCK_MPP, lines = edges.map(g => {
    const [nx, ny] = TILE_DIRS[g.d], horiz = ny !== 0, k = K.w;
    let ax = g.a[0] + nx * k / 2, ay = g.a[1] + ny * k / 2, bx = g.b[0] + nx * k / 2, by = g.b[1] + ny * k / 2;
    if(!g.lo){ if(horiz) ax -= k; else ay -= k; }
    if(!g.hi){ if(horiz) bx += k; else by += k; }
    return {ax, ay, bx, by, from:horiz ? ax : ay};
  });
  const L = (c, ex = "") => `<g stroke="${c}" stroke-width="${K.w}" stroke-linecap="butt" fill="none"${ex}>` + lines.map(l => `<line x1="${l.ax}" y1="${l.ay}" x2="${l.bx}" y2="${l.by}"/>`).join("") + "</g>";
  const J = (c, off) => `<g stroke="${c}" stroke-width="${K.w}" stroke-linecap="butt" fill="none">` + lines.map(l => `<line x1="${l.ax}" y1="${l.ay}" x2="${l.bx}" y2="${l.by}" stroke-dasharray="${o} ${K.step - o}" stroke-dashoffset="${(((l.from % K.step) + K.step) % K.step) + off}"/>`).join("") + "</g>";
  return L(K.lit, ` transform="translate(${-o} ${-o})"`) + L(K.shade, ` transform="translate(${o} ${o})"`) + L(K.c) + J(K.joint, 0) + J(K.chip, -o);
}

function tilesSvg(joined, joinedAll, isSel, isDoomed){
  // lines with no tiles behind them (a save from a mod, or a test that lays lines by hand) are drawn as the tiles they would be
  const loose = state.paths.filter(p => !p.tiles), T = loose.length ? {...state.tiles, ...tilesFromPaths(loose)} : state.tiles || {}, inv = 1 / view.k, lj = `stroke-linejoin="miter" stroke-linecap="butt" fill="none"`;
  let tram = "", road = "", surf = "", kerbs = "", edges = "", defsel = "";
  // tram track, service roads and bridges: lines through the tile centers (the old drawing), the tiles just say where they are
  for(const p of state.paths){
    if(!p.type || p.type === "wide") continue;
    const pts = polyStr(p.points), w = 2*halfWidth(p), on = isSel("path", p.id), dead = isDoomed("path", p.id);
    const hit = `<polyline points="${pts}" stroke="transparent" stroke-width="${Math.max(w, 14*inv)}" ${lj}/>`;
    if(isTram(p)){
      if(on || dead) tram += `<polyline points="${pts}" stroke="${dead ? "var(--bad)" : "var(--sel)"}" stroke-width="${w + 5*inv}" ${lj}/>`;
      tram += `<polyline points="${pts}" stroke="#4A4742" stroke-width="${w + 1.2*inv}" ${lj}/>`;
      let body = `<polyline points="${pts}" stroke="#8C877D" stroke-width="${w}" ${lj}/><polyline points="${pts}" stroke="#5E4B38" stroke-width="${w}" stroke-dasharray=".7 1.6" ${lj}/>`;
      body += `<polyline points="${pts}" stroke="#2E2C29" stroke-width="${w * .72}" ${lj}/><polyline points="${pts}" stroke="#8C877D" stroke-width="${w * .46}" ${lj}/>${hit}`;
      tram += `<g data-kind="path" data-id="${esc(p.id)}" style="cursor:pointer">${body}</g>`;
    } else if(isBridge(p)){
      const live = joined.has(p.id);
      if(on || dead) road += `<polyline points="${pts}" stroke="${dead ? "var(--bad)" : "var(--sel)"}" stroke-width="${w + 5*inv}" ${lj}/>`;
      let body = `<polyline points="${pts}" stroke="#4A3220" stroke-width="${w + .9}" ${lj}/><polyline points="${pts}" stroke="#7A5634" stroke-width="${w + .3}" ${lj}/>`;
      body += `<polyline points="${pts}" stroke="${live ? "#B48A5A" : "#9C8468"}" stroke-width="${w - .5}" ${lj}/><polyline points="${pts}" stroke="#6E4E30" stroke-opacity=".7" stroke-width="${w - .5}" stroke-dasharray=".12 .88" ${lj}/>`;
      if(!live) body += `<polyline points="${pts}" stroke="#4A3220" stroke-width="${1.2*inv}" stroke-dasharray="${4*inv} ${4*inv}" ${lj}/>`;
      road += `<g data-kind="path" data-id="${esc(p.id)}" style="cursor:pointer">${body}${hit}</g>`;
    } else {   // service road
      const live = joinedAll.has(p.id);
      if(on || dead) road += `<polyline points="${pts}" stroke="${dead ? "var(--bad)" : "var(--sel)"}" stroke-width="${w + 5*inv}" ${lj}/>`;
      road += `<polyline points="${pts}" stroke="#26292C" stroke-width="${w + 1.6*inv}" ${lj}/>`;
      let body = `<polyline points="${pts}" stroke="${live ? "#3A3E42" : "#5B5F63"}" stroke-width="${w}" ${lj}/><polyline points="${pts}" stroke="#E6E2D6" stroke-opacity=".5" stroke-width="${.7*inv}" stroke-dasharray="${5*inv} ${5*inv}" ${lj}/>`;
      if(!live) body += `<polyline points="${pts}" stroke="#26292C" stroke-width="${1.2*inv}" stroke-dasharray="${4*inv} ${4*inv}" ${lj}/>`;
      road += `<g data-kind="path" data-id="${esc(p.id)}" style="cursor:pointer">${body}${hit}</g>`;
    }
  }
  // footpaths and promenades: the tiles themselves
  const byTheme = {};
  for(const p of state.paths){
    if(p.type && p.type !== "wide") continue;
    const key = themeKey(p), PT = THEMES[key].path, live = joined.has(p.id), wide = p.type === "wide";
    const tiles = p.tiles || Object.keys(tilesFromPaths([p]));
    const rects = tiles.map(k => { const [cx, cy] = tileXY(k); return `M${cx*TILE} ${cy*TILE}h${TILE}v${TILE}h${-TILE}z`; }).join("");
    const tex = wide && PT.wideTex ? `url(#t-${PT.wideTex})` : texFill(p);
    surf += `<g data-kind="path" data-id="${esc(p.id)}" style="cursor:pointer"><path d="${rects}" fill="${live ? PT.live : PT.dead}"/>${tex ? `<path d="${rects}" fill="${tex}"/>` : ""}</g>`;
    const eg = tileEdges(tiles, T);
    if(isSel("path", p.id)) edges += `<path d="${edgePath(eg)}" stroke="var(--sel)" stroke-width="${5*inv}" ${lj}/>`;
    (byTheme[key] ||= []).push(...eg);
    if(!live) edges += `<path d="${edgePath(eg)}" stroke="${PT.edge}" stroke-width="${1.2*inv}" stroke-dasharray="${4*inv} ${4*inv}" ${lj}/>`;
  }
  for(const [key, eg] of Object.entries(byTheme)){
    const PT = THEMES[key].path;
    if(PT.kerbPix) kerbs += kerbStrips(eg, PT.kerbPix);
    else {
      kerbs += `<path d="${edgePath(eg)}" stroke="${PT.edge}" stroke-width="${1.6*inv}" ${lj}/>`;
      if(PT.kerb) kerbs += `<path d="${edgePath(eg)}" stroke="${PT.kerb.c}" stroke-width="${1.6*inv}" stroke-dasharray="${PT.kerb.dash.split(" ").map(n => n*inv).join(" ")}" ${lj}/>`;
    }
  }
  return tram + road + kerbs + surf + edges;
}
