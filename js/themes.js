/* Themes: colors for paths, buildings and exhibits, matched areas, species fit, and unlocks. Data is THEMES in data.js. */
const themeKey = it => THEMES[it.theme] ? it.theme : "genesis";
const themeOf = it => THEMES[themeKey(it)];
function mixHex(a, b, t){
  if(!/^#[0-9a-f]{6}$/i.test(a) || !/^#[0-9a-f]{6}$/i.test(b)) return a;
  const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), x = p(a), y = p(b);
  return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("");
}
// a building's fill: its own color, blended toward the theme
const themeFill = (it, base) => { const T = themeOf(it); return T.mix ? mixHex(base, T.bld, T.mix) : base; };

const themeHave = key => !state.themes || state.themes.have.includes(key);
const themeBase = (kind, it) => kind === "path" ? pathCost(it.points, it.type) : kind === "exhibit" ? (it.viv ? VIVARIUMS[it.viv].price : exhibitCost(it.points, it.barrier)) : BUILDINGS[it.type].price;
const themeFee = (kind, it, key) => Math.round(themeBase(kind, it) * THEMES[key].fee);
function themeProblem(kind, it, key){
  if(!THEMES[key]) return "Unknown theme.";
  if(!themeHave(key)) return `${THEMES[key].label} is locked. ${THEMES[key].unlock.hint}`;
  if(themeKey(it) === key) return "It already has that theme.";
  if(!canAfford(themeFee(kind, it, key))) return "Not enough money.";
  return null;
}
// A themed zone (z.theme) styles what is built inside it: the zone's theme beats the brush
const itemSpot = it => { const n = it.points.length; return [it.points.reduce((a, p) => a + p[0], 0) / n, it.points.reduce((a, p) => a + p[1], 0) / n]; };
function themedZoneAt(it){
  if(!it.points || !it.points.length) return null;
  const [x, y] = itemSpot(it);
  return zones().find(z => z.theme && THEMES[z.theme] && inPoly(x, y, z.points)) || null;
}
// The theme a new thing gets: its zone's, else the brush's, if it's unlocked and you can afford the extra (null for Genesis)
function themeFor(kind, it){
  const z = themedZoneAt(it), key = z ? z.theme : state.themes && state.themes.brush;
  if(!key || key === "genesis" || !THEMES[key] || !themeHave(key) || !canAfford(themeFee(kind, it, key))) return null;
  return key;
}
// New things are built in that theme, and pay the extra
function themeNew(kind, it){
  const key = themeFor(kind, it);
  if(!key) return;
  spend(themeFee(kind, it, key), "built"); it.theme = key;
}
// Everything whose middle is inside the zone that isn't already in a theme: guest paths, buildings and exhibits
function zoneThemePlan(z, key){
  const out = [], inside = it => it.points && it.points.length && inPoly(...itemSpot(it), z.points);
  for(const p of state.paths) if(!isService(p) && inside(p) && themeKey(p) !== key) out.push(["path", p]);
  for(const b of state.buildings) if(inside(b) && themeKey(b) !== key) out.push(["building", b]);
  for(const e of state.exhibits) if(inside(e) && themeKey(e) !== key) out.push(["exhibit", e]);
  return out;
}
const zoneThemeFee = (z, key) => zoneThemePlan(z, key).reduce((s, [k, it]) => s + themeFee(k, it, key), 0);
function zoneThemeProblem(z, key){
  if(!THEMES[key]) return "Unknown theme.";
  if(!themeHave(key)) return `${THEMES[key].label} is locked. ${THEMES[key].unlock.hint}`;
  if(!zoneThemePlan(z, key).length) return "Everything inside already has that theme.";
  if(!canAfford(zoneThemeFee(z, key))) return "Not enough money.";
  return null;
}
function restyleZone(z, key){
  const plan = zoneThemePlan(z, key), fee = zoneThemeFee(z, key);
  spend(fee, "built");
  for(const [, it] of plan) if(key === "genesis") delete it.theme; else it.theme = key;
  return {n:plan.length, fee};
}

// Themes are earned: each unlocks once and stays unlocked
function checkThemes(){
  if(!state.themes) return;
  for(const [k, T] of Object.entries(THEMES)){
    if(state.themes.have.includes(k) || !T.unlock.check()) continue;
    state.themes.have.push(k);
    events.toast(`New theme unlocked: ${T.label}. Pick it in the park office or on any path, building or exhibit.`, "good");
  }
}

// How much of an exhibit's species look right in its theme (0 to 1)
function themeFitShare(e){
  const fits = themeOf(e).fits; let n = 0, fit = 0;
  for(const a of e.animals){ n++; if(fits.includes(a.sp)) fit++; }
  return n ? fit / n : 0;
}
// The themed area around an exhibit: guest paths and shops/restrooms nearby. Consistent when they all match the exhibit.
function themeZone(e){
  const key = themeKey(e), near = [];
  for(const p of state.paths) if(!isService(p) && lineShapeDist(p.points, e.points) <= THEME.radius) near.push(p);
  for(const b of state.buildings){
    const t = BUILDINGS[b.type];
    if(t.dept || t.prop || !(t.serves || []).length || b.exhibitId) continue;
    if(lineShapeDist([...b.points, b.points[0]], e.points) <= THEME.radius) near.push(b);
  }
  const same = near.filter(x => themeKey(x) === key).length;
  return {key, total:near.length, same, ok:key !== "genesis" && near.length >= THEME.minNear && same === near.length};
}
// Extra appeal for an exhibit from its matched area and its animals' fit
function themeAppeal(e, z){ return (z && z.ok ? THEME.appeal : 0) + THEME.fitAppeal * themeFitShare(e); }

/* ---------- drawing: texture and borders (SVG strings used by map.js) ---------- */
// paths use `ptex`, buildings and props `btex`, the zone ground `gtex`, and the border band `tex`
const texFill = it => { const T = themeOf(it), x = T.ptex || T.tex; return x ? `url(#t-${x})` : null; };
const bldTex = T => T.btex || T.tex;
const groundTex = T => T.gtex || T.tex;
// one stroked outline (polygon or polyline)
const strokeSvg = (tag, pts, L, ns) => `<${tag} points="${pts}" stroke="${L.c}" stroke-width="${L.w}"${L.dash ? ` stroke-dasharray="${L.dash}"` : ""} stroke-linecap="${L.cap || "butt"}" ${ns}/>`;
// a zigzag along a closed outline: every `step` it swings `amp` to one side then the other (world units), restarting at each corner
function zigPts(pts, amp, step){
  const out = [];
  for(let i = 0; i < pts.length; i++){
    const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length], len = Math.hypot(bx - ax, by - ay), n = Math.min(400, Math.max(2, Math.round(len / step / 2) * 2));
    const nx = -(by - ay) / (len || 1), ny = (bx - ax) / (len || 1);
    for(let k = 0; k < n; k++){ const t = k / n, o = k % 2 ? amp : -amp * (k ? 1 : 0); out.push([ax + (bx - ax) * t + nx * o, ay + (by - ay) * t + ny * o]); }
  }
  return out;
}
// one rail line: a straight outline, or with `zig: [amp, step]` (px) a zigzag, drawn as rails or, with `knots`, as round dots where the rails cross
function railLine(pts, L, inv, ns){
  if(!L.zig) return strokeSvg("polygon", pts, L, ns);
  const raw = pts.split(" ").map(p => p.split(",").map(Number)), z = zigPts(raw, L.zig[0] * inv, L.zig[1] * inv);
  if(L.knots) return `<path d="${z.map(([x, y]) => `M${x.toFixed(2)} ${y.toFixed(2)}h0`).join("")}" stroke="${L.c}" stroke-width="${L.w}" stroke-linecap="round" ${ns}/>`;
  return strokeSvg("polygon", polyStr(z), L, ns);
}
// a themed exhibit's border: a textured band just inside the fence, then the theme's own rail lines (px, so they stay thin when zoomed out)
// `strong`: the exhibit holds a dangerous animal, so a theme with a `base` lays a footing under the rail (over the band)
// and a theme whose border has its own `strong` rail draws that instead. `barrier` picks a border from `by` (a lighter look for wooden fences, say)
function themeRailSvg(pts, T, inv, bw = 4, strong = false, barrier = null){
  const B = strong && T.bord && T.bord.strong || barrier && T.bord && T.bord.by && T.bord.by[barrier] || T.bord, ns = `fill="none" stroke-linejoin="round" vector-effect="non-scaling-stroke" pointer-events="none"`;
  if(!B) return "";
  let s = "";
  if(T.tex && B.band) s += `<polygon points="${pts}" fill="none" stroke="${B.band}" stroke-width="${Math.max(bw * .75, bw*inv)}" stroke-linejoin="round" pointer-events="none"/><polygon points="${pts}" fill="none" stroke="url(#t-${T.tex})" stroke-width="${Math.max(bw * .75, bw*inv)}" stroke-linejoin="round" pointer-events="none"/>`;
  if(strong && B.base) s += `<polygon points="${pts}" stroke="${B.base.c}" stroke-width="${B.base.w}" ${ns}/>` + (B.base.c2 ? `<polygon points="${pts}" stroke="${B.base.c2}" stroke-width="1" stroke-dasharray="${B.base.dash2 || "3 5"}" ${ns}/>` : "");
  if(B.glow) s += `<polygon points="${pts}" stroke="${B.glow}" stroke-opacity=".3" stroke-width="${B.w + 7}" ${ns}/>`;
  if(B.c) s += `<polygon points="${pts}" stroke="${B.c}" stroke-width="${B.w}"${B.dash ? ` stroke-dasharray="${B.dash}"` : ""} stroke-linecap="${B.cap || "butt"}" ${ns}/>`;
  if(B.c2) s += `<polygon points="${pts}" stroke="${B.c2}" stroke-width="${B.w2}"${B.dash2 ? ` stroke-dasharray="${B.dash2}"` : ""} stroke-linecap="${B.cap2 || "butt"}" ${ns}/>`;
  for(const m of B.more || []) s += railLine(pts, m, inv, ns);
  return s;
}
// the inner trim lines on buildings (px): the border's own `trim` (one line or a list), else its second line, thinner
const themeTrim = B => !B ? [] : B.trim ? [].concat(B.trim) : B.c2 ? [{c:B.c2, w:Math.max(1, B.w2 * .45), dash:B.dash2 && B.dash2.split(" ").map(n => Math.max(1, +n * .6)).join(" "), cap:B.cap2}] : [];
// how rotten an item looks under the theme's `rot` overlay, fixed per item so each building keeps its look
const rotLevel = it => { let h = 7; for(const ch of String(it.id || "")) h = (h * 31 + ch.charCodeAt(0)) % 997; return .2 + .8 * h / 996; };
// how decayed a building looks (0 to 1): with the theme's `age` it grows from when it was built (newer is cleaner), else it's fixed per item
const decayOf = (T, it) => T.age ? Math.min(1, Math.max(0, (state.day - (it.day ?? state.day)) / T.age)) * (.55 + .45 * (rotLevel(it) - .2) / .8) : rotLevel(it);
// one of a list, fixed per item (a single value is just returned)
const pickFor = (it, x) => Array.isArray(x) ? x[Math.floor((rotLevel(it) - .2) / .8 * x.length * .999)] : x;
// a building's ridge: the line joining the middles of its two short sides (rectangles only)
function ridgeLine(pts){
  if(pts.length !== 4) return null;
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  return len(pts[0], pts[1]) < len(pts[1], pts[2]) ? [mid(pts[0], pts[1]), mid(pts[2], pts[3])] : [mid(pts[1], pts[2]), mid(pts[3], pts[0])];
}
// a building's roof class under a theme with `roofs` (0, 1, 2...), or -1
const roofOf = (T, bl) => T.roofs && BUILDINGS[bl.type] ? T.roofs.of(BUILDINGS[bl.type], bl.type) : -1;
// skylights: a block of glass panes (one rectangle split into `n` along its long side), each in a dark frame with a bright inner edge and a mullion down the middle
function glassSvg(pts, g, ns){
  const R = insetRect(pts, g.at), n = g.n || 1, gap = g.gap || 0, lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]), along = dist(R[0], R[1]) >= dist(R[1], R[2]);
  const [a, b, c, d] = along ? [R[0], R[1], R[2], R[3]] : [R[1], R[2], R[3], R[0]];   // a to b is the long side, d to c the one across from it
  let s = "";
  for(let i = 0; i < n; i++){
    const t0 = (i + gap / 2) / n, t1 = (i + 1 - gap / 2) / n, q = [lerp(a, b, t0), lerp(a, b, t1), lerp(d, c, t1), lerp(d, c, t0)];
    s += `<polygon points="${polyStr(q)}" fill="url(#t-modern-glass)" stroke="#1F2D33" stroke-width="1.6" stroke-linejoin="round" vector-effect="non-scaling-stroke" pointer-events="none"/>`
      + `<polygon points="${polyStr(insetRect(q, .93))}" stroke="#EAFBF9" stroke-width=".7" stroke-opacity=".8" ${ns}/>`
      + `<polyline points="${polyStr([lerp(q[0], q[1], .5), lerp(q[3], q[2], .5)])}" stroke="#1F2D33" stroke-width="1" stroke-opacity=".7" ${ns}/>`;
  }
  return s;
}
// a themed building: its roof texture (sod on small ones, else by roof class), any decay overlay, the eave band, the ridge, inner trim lines, and a cross brace on big ones
function themeBuildSvg(bl, pts, trimPts){
  const T = themeOf(bl), ns = `fill="none" stroke-linejoin="round" vector-effect="non-scaling-stroke" pointer-events="none"`, H = roofOf(T, bl);
  const small = T.sod && bl.points && area(bl.points) <= T.sod.max, tex = small ? pickFor(bl, T.sod.tex) : H >= 0 ? pickFor(bl, T.roofs.btex[H]) : bldTex(T); let s = "";
  if(tex) s += `<polygon points="${pts}" fill="url(#t-${tex})" pointer-events="none"/>`;
  if(small && T.sod.shade) s += `<polygon points="${pts}" fill="url(#g-${pickFor(bl, T.sod.shade)})" pointer-events="none"/>`;
  const rot = decayOf(T, bl);
  if(T.rot && rot > .01) s += `<polygon points="${pts}" fill="url(#t-${T.rot})" fill-opacity="${rot.toFixed(2)}" pointer-events="none"/>`;
  // moss in some of the corners, bigger as the building decays, kept inside the roof
  if(T.moss && rot > .05 && bl.points){
    const [cx, cy] = centroid(bl.points), h = Math.round(rotLevel(bl) * 996), big = T.moss.r * rot * Math.sqrt(area(bl.points)) / 6;
    bl.points.forEach(([x, y], i) => { if(!(h >> i & 1) && i) return;
      const reach = Math.hypot(cx - x, cy - y);
      for(let k = 0; k < 3; k++){ const f = .14 + k * .09 + (h >> (k + i) & 1) * .04, r = Math.min(big * (1 - k * .25), reach * f * .85), j = (k - 1) * r * .6; s += `<circle cx="${(x + (cx - x) * f + j * (cy - y) / reach).toFixed(2)}" cy="${(y + (cy - y) * f - j * (cx - x) / reach).toFixed(2)}" r="${r.toFixed(2)}" fill="${T.moss.c[k % T.moss.c.length]}" fill-opacity=".85" pointer-events="none"/>`; } });
  }
  // snow load by how warm the building runs, inset so the dark eaves still show
  const sn = T.snow && BUILDINGS[bl.type] && bl.points && T.snow.tex[T.snow.of(BUILDINGS[bl.type], bl.type)];
  if(sn) s += `<polygon points="${polyStr(insetRect(bl.points, T.snow.at))}" fill="url(#t-${sn})" stroke-linejoin="round" pointer-events="none"/>`;
  const G = H >= 0 && T.roofs.glass && T.roofs.glass[H];
  if(G && bl.points && bl.points.length === 4 && area(bl.points) >= (G.min || 0)) s += glassSvg(bl.points, G, ns);
  if(T.eave) s += `<polygon points="${pts}" stroke="${T.eave.c}" stroke-width="${T.eave.w}" ${ns}/>`;
  const rg = T.ridge && !small && bl.points && ridgeLine(bl.points);
  if(rg) for(const L of T.ridge) s += strokeSvg("polyline", polyStr(rg), {...L, c:pickFor(bl, L.c)}, ns);
  const trims = H >= 0 ? T.roofs.trim[H] : themeTrim(T.bord), along = (L, P) => strokeSvg("polygon", L.at || P !== bl.points ? polyStr(insetRect(P, L.at || .86)) : trimPts, L, ns);
  for(const L of trims) s += bl.points ? along(L, bl.points) : strokeSvg("polygon", trimPts, L, ns);
  const X = H >= 0 && T.roofs.brace, tp = trimPts.split(" ");
  if(X && X.of.includes(H) && tp.length === 4 && area(bl.points) >= X.min) for(const L of X.lines) s += strokeSvg("polyline", `${tp[0]} ${tp[2]}`, L, ns) + strokeSvg("polyline", `${tp[1]} ${tp[3]}`, L, ns);
  // stepped blocks: big buildings get a smaller upper story pushed toward the back corner, with a shadow cast down and to the right, and its own trim
  const TI = T.tier;
  if(TI && bl.points && bl.points.length === 4) for(const [i, f] of TI.at.entries()){
    if(area(bl.points) < TI.min * (i ? TI.next : 1)) break;
    const [cx, cy] = centroid(bl.points), bk = bl.points.reduce((a, p) => p[0] + p[1] < a[0] + a[1] ? p : a), ax = (cx + bk[0]) / 2, ay = (cy + bk[1]) / 2;
    const up = bl.points.map(([x, y]) => [ax + (x - ax) * f, ay + (y - ay) * f]), d = TI.drop * Math.sqrt(area(bl.points)) / 10;
    s += `<polygon points="${polyStr(up.map(([x, y]) => [x + d, y + d]))}" fill="${TI.shadow}" fill-opacity=".3" pointer-events="none"/>`;
    if(tex) s += `<polygon points="${polyStr(up)}" fill="url(#t-${tex})" pointer-events="none"/>`;
    s += `<polygon points="${polyStr(up)}" fill="${TI.light}" fill-opacity=".3" pointer-events="none"/>`;
    for(const L of trims) s += along(L, up);
  }
  return s;
}
// a themed prop (bin, bench, lamp, sign...): texture over its fill, then a ring or outline in the theme's border colors. `round` means a circle at (cx, cy) of radius r, else the polygon `pts`.
function themeProp(it, shape){
  const T = themeOf(it), B = T.bord; if(!B || T === THEMES.genesis) return "";
  // a list of trims is drawn as one plain ring in its first color, kept thin on small props
  const R = Array.isArray(B.trim) ? {c:B.trim[0].c, w:Math.min(B.trim[0].w, 2)} : B.trim || {c:B.c2 || B.c, w:Math.max(1, (B.c2 ? B.w2 : B.w) * .5)};
  const tex = bldTex(T) ? `fill="url(#t-${bldTex(T)})"` : `fill="none"`, ring = (c, w) => `stroke="${c}" stroke-width="${w}" stroke-linecap="butt" fill="none" vector-effect="non-scaling-stroke"`;
  if(shape.round){
    const {cx, cy, r} = shape;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" ${tex} pointer-events="none"/><circle cx="${cx}" cy="${cy}" r="${r * 1.12}" ${ring(R.c, R.w)} pointer-events="none"/>`;
  }
  return `<polygon points="${shape.pts}" ${tex} pointer-events="none"/><polygon points="${shape.trim}" stroke-linejoin="round" ${ring(R.c, R.w)} pointer-events="none"/>`;
}
