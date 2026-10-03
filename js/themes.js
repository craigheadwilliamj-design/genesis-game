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
// a themed exhibit's border: a textured band just inside the fence, then the theme's own rail lines (px, so they stay thin when zoomed out)
// `strong`: the exhibit holds a dangerous animal, so a theme with a `base` lays a footing under the rail
function themeRailSvg(pts, T, inv, bw = 4, strong = false){
  const B = T.bord, ns = `fill="none" stroke-linejoin="round" vector-effect="non-scaling-stroke" pointer-events="none"`;
  if(!B) return "";
  let s = "";
  if(strong && B.base) s += `<polygon points="${pts}" stroke="${B.base.c}" stroke-width="${B.base.w}" ${ns}/>` + (B.base.c2 ? `<polygon points="${pts}" stroke="${B.base.c2}" stroke-width="1" stroke-dasharray="${B.base.dash2 || "3 5"}" ${ns}/>` : "");
  if(T.tex && B.band) s += `<polygon points="${pts}" fill="none" stroke="${B.band}" stroke-width="${Math.max(bw * .75, bw*inv)}" stroke-linejoin="round" pointer-events="none"/><polygon points="${pts}" fill="none" stroke="url(#t-${T.tex})" stroke-width="${Math.max(bw * .75, bw*inv)}" stroke-linejoin="round" pointer-events="none"/>`;
  if(B.glow) s += `<polygon points="${pts}" stroke="${B.glow}" stroke-opacity=".3" stroke-width="${B.w + 7}" ${ns}/>`;
  s += `<polygon points="${pts}" stroke="${B.c}" stroke-width="${B.w}"${B.dash ? ` stroke-dasharray="${B.dash}"` : ""} stroke-linecap="${B.cap || "butt"}" ${ns}/>`;
  if(B.c2) s += `<polygon points="${pts}" stroke="${B.c2}" stroke-width="${B.w2}"${B.dash2 ? ` stroke-dasharray="${B.dash2}"` : ""} stroke-linecap="${B.cap2 || "butt"}" ${ns}/>`;
  for(const m of B.more || []) s += `<polygon points="${pts}" stroke="${m.c}" stroke-width="${m.w}"${m.dash ? ` stroke-dasharray="${m.dash}"` : ""} stroke-linecap="${m.cap || "butt"}" ${ns}/>`;
  return s;
}
// the inner trim lines on buildings (px): the border's own `trim` (one line or a list), else its second line, thinner
const themeTrim = B => !B ? [] : B.trim ? [].concat(B.trim) : B.c2 ? [{c:B.c2, w:Math.max(1, B.w2 * .45), dash:B.dash2 && B.dash2.split(" ").map(n => Math.max(1, +n * .6)).join(" "), cap:B.cap2}] : [];
// how rotten an item looks under the theme's `rot` overlay, fixed per item so each building keeps its look
const rotLevel = it => { let h = 7; for(const ch of String(it.id || "")) h = (h * 31 + ch.charCodeAt(0)) % 997; return .2 + .8 * h / 996; };
// a building's ridge: the line joining the middles of its two short sides (rectangles only)
function ridgeLine(pts){
  if(pts.length !== 4) return null;
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  return len(pts[0], pts[1]) < len(pts[1], pts[2]) ? [mid(pts[0], pts[1]), mid(pts[2], pts[3])] : [mid(pts[1], pts[2]), mid(pts[3], pts[0])];
}
const lineSvg = (pts, L, ns) => `<polyline points="${pts}" stroke="${L.c}" stroke-width="${L.w}"${L.dash ? ` stroke-dasharray="${L.dash}"` : ""} stroke-linecap="${L.cap || "butt"}" ${ns}/>`;
// a themed building: its roof texture (sod on small ones), any decay overlay, the eave band, the ridge, and inner trim lines
function themeBuildSvg(bl, pts, trimPts){
  const T = themeOf(bl), ns = `fill="none" stroke-linejoin="round" vector-effect="non-scaling-stroke" pointer-events="none"`;
  const tex = T.sod && bl.points && area(bl.points) <= T.sod.max ? T.sod.tex : bldTex(T); let s = "";
  if(tex) s += `<polygon points="${pts}" fill="url(#t-${tex})" pointer-events="none"/>`;
  if(T.rot) s += `<polygon points="${pts}" fill="url(#t-${T.rot})" fill-opacity="${rotLevel(bl).toFixed(2)}" pointer-events="none"/>`;
  if(T.eave) s += `<polygon points="${pts}" stroke="${T.eave.c}" stroke-width="${T.eave.w}" ${ns}/>`;
  const rg = T.ridge && tex !== (T.sod && T.sod.tex) && bl.points && ridgeLine(bl.points);
  if(rg) for(const L of T.ridge) s += lineSvg(polyStr(rg), L, ns);
  for(const L of themeTrim(T.bord)) s += `<polygon points="${trimPts}" stroke="${L.c}" stroke-width="${L.w}"${L.dash ? ` stroke-dasharray="${L.dash}"` : ""} stroke-linecap="${L.cap || "butt"}" ${ns}/>`;
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
