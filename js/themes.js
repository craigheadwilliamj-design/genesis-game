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
// New things are built in the theme picked in the park office, if it's unlocked and you can afford the extra
function themeNew(kind, it){
  const key = state.themes && state.themes.brush;
  if(!key || key === "genesis" || !themeHave(key)) return;
  const fee = themeFee(kind, it, key);
  if(!canAfford(fee)) return;
  spend(fee, "built"); it.theme = key;
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
