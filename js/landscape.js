/* =====================================================================
   LANDSCAPE
   Water, rocks, groves and shelters inside open exhibits. Water is
   drawn corner by corner like an exhibit (e.water); the rest are placed
   with a tap (e.land). Animals like some of each, and water lovers get
   unhappy and sickly without any water.
   Groves from an animal's own era make it happier and feed part of its
   diet, and older groves (plants grown at CERES) keep old
   plant-eaters off the grass. Shelters (and groves, for shade) cover
   animals from the weather, which is rolled here each night.
   Placing, drawing and reshaping them lives in map.js, next to the other tools.
   ===================================================================== */

const landKey = t => typeof t === "string" && t.startsWith("land-") ? t.slice(5) : null;
const landOf = e => e.land || [];
const waterOf = e => e.water || [];
const circlePts = (x, y, r, n = 14) => Array.from({length:n}, (_, i) => [x + r * Math.cos(i * 2 * Math.PI / n), y + r * Math.sin(i * 2 * Math.PI / n)]);
const waterCost = pts => Math.round(area(pts) * WATER.perSqM);
// What bulldozing gets back for everything inside an exhibit
const landRefund = e => Math.round((landOf(e).reduce((n, f) => n + (LAND[f.type] ? LAND[f.type].price : 0), 0) + waterOf(e).reduce((n, w) => n + waterCost(w.points), 0)) * COST.refundShare);

// Mesozoic and Paleozoic plants each use up one plant of their period and size from CERES
const potKey = t => t.tech && t.size ? (t.period || t.flora) + "-" + t.size : null;
const potsHave = t => potKey(t) ? (state.ceres.pots[potKey(t)] || 0) : Infinity;
const potName = t => `${t.period || ERA_LABEL[t.flora]} ${t.size} plants`;

const landM2 = f => Math.PI * (LAND[f.type].r * (f.k || 1)) ** 2;   // f.k shrinks a vivarium's plants
// The exhibit's biome (vivariums too), and how well it suits one species: "home", "near", "away", or null for animals with no biome
const biomeOf = e => BIOMES[e.biome] ? e.biome : DEFAULT_BIOME;
function biomeFit(s, b){ const l = biomesOf(s); return !l ? null : l[0] === b ? "home" : l.includes(b) ? "near" : "away"; }
const regradeCost = (e, b) => Math.round(area(e.points) * BIOMES[b].perSqM);
function regradeProblem(e, b){
  if(!BIOMES[b]) return "Unknown biome.";
  if(biomeOf(e) === b) return `${e.name} is already ${BIOMES[b].label.toLowerCase()}.`;
  return canAfford(regradeCost(e, b)) ? null : `Costs ${money(regradeCost(e, b))}.`;
}
// How much of the exhibit is water, rock, and groves from each era: 0 to 1 each, where 1 satisfies the animals that like it
function habitatOf(e){
  const a = area(e.points) || 1, land = landOf(e).filter(f => LAND[f.type]);
  const wet = waterOf(e).reduce((n, w) => n + area(w.points), 0);
  const cover = land.reduce((n, f) => n + (LAND[f.type].cover || 0), 0);
  const grove = {}, groveM2 = {};
  for(const era of Object.keys(FLORA)){
    groveM2[era] = land.reduce((n, f) => n + (LAND[f.type].flora === era && plantHere(LAND[f.type], e) ? landM2(f) : 0), 0);
    grove[era] = clamp(groveM2[era] / a / HAB.groveFull, 0, 1);
  }
  const old = clamp((groveM2.mesozoic + groveM2.paleozoic) / a / HAB.groveFull, 0, 1);
  return {waterM2:wet, waterShare:wet / a, wet:clamp(wet / a / HAB.waterFull + (BIOMES[biomeOf(e)].wet || 0), 0, 1), rock:clamp(cover / (a / HAB.rockEvery), 0, 1), grove, groveM2, old};
}
// Grass underfoot: a Cenozoic planting, unless enough older groves give the grazers something else to eat
// What one species wants from an exhibit, given its size and biome: water as a share of the floor, rock cover points, and square meters of plants
function wantsOf(e, s){
  const a = area(e.points) || 1, l = likesOf(s), B = BIOMES[biomeOf(e)];
  const meat = !s.diet.some(d => d === "herbivore" || d === "omnivore");
  // no plants at all if its period had none in this biome (nothing to plant)
  const none = !(PLANTS_OF[s.period] && PLANTS_OF[s.period][biomeOf(e)]);
  return {water:l.water * HAB.waterMax, rock:Math.max(1, Math.ceil(a / HAB.rockEvery * HAB.rockBase * B.rock * l.rock / .4)), plants:none ? 0 : Math.round(a * B.plants * (meat ? HAB.meatPlants : 1))};
}
// A plant counts for a species when it's from the animal's own period
// Plants from another biome don't count for anything and make animals unhappy
const plantHere = (t, e) => t.biome === biomeOf(e);
const plantSuits = (t, s) => t.period === s.period;
// What the exhibit has to give: water share (wetland counts for some), rock cover, plant square meters. With a species, only plants from its own period count.
function haveOf(e, s){
  const a = area(e.points) || 1, land = landOf(e).filter(f => LAND[f.type]);
  return {water:waterOf(e).reduce((n, w) => n + area(w.points), 0) / a + (BIOMES[biomeOf(e)].wet || 0) * HAB.waterFull,
    rock:land.reduce((n, f) => n + (LAND[f.type].cover || 0), 0), plants:Math.round(land.reduce((n, f) => n + (LAND[f.type].flora && plantHere(LAND[f.type], e) && (!s || plantSuits(LAND[f.type], s)) ? landM2(f) : 0), 0))};
}
// How well it's met, 0 to 1. Water can be too much as well as too little; rocks and plants only fall short.
function waterFit(have, want){
  if(want <= 0) return 1;
  const d = have - want, band = want * HAB.waterBand;
  if(Math.abs(d) <= band) return 1;
  return d < 0 ? clamp(have / (want - band), 0, 1) : clamp(1 - (d - band) / (want * 2), 0, 1);
}
const fitOf = (have, want) => want > 0 ? clamp(have / want, 0, 1) : 1;
function speciesFit(e, s){
  const w = wantsOf(e, s), h = haveOf(e, s), l = likesOf(s), pw = HAB.plantWeight;
  const water = waterFit(h.water, w.water), rock = fitOf(h.rock, w.rock), plants = fitOf(h.plants, w.plants);
  return {w, h, water, rock, plants, sat:(l.water * water + l.rock * rock + pw * plants) / (l.water + l.rock + pw)};
}
const grassyFloor = e => habitatOf(e).old < 1;
// Food units a day the animals browse off groves, for one food type. Older groves give Paleoflora, Cenozoic plants give plants.
function browseRate(e, t){
  if(t !== "plants" && t !== "paleoflora") return 0;
  return landOf(e).reduce((n, f) => { const L = LAND[f.type]; return n + (L && L.browse && (t === "plants") === (L.flora === "cenozoic") ? L.browse : 0); }, 0);
}
// How much of today's eating the groves cover, capped so keepers still bring the rest
const browseShare = (e, t, need) => need > 0 ? Math.min(HAB.browseMax, browseRate(e, t) / need) : 0;
// A water lover with no water to drink from or wade in
const thirsty = (e, s) => !e.viv && likesOf(s).water >= HAB.wantsWater && habitatOf(e).wet === 0;

/* ---------- weather and shelter ---------- */
function freshWeather(){ return {today:"fair", next:"fair", from:WEATHER.startDay}; }
const weatherNow = () => WEATHER.kinds[state.weather ? state.weather.today : "fair"];
const weatherNext = () => WEATHER.kinds[state.weather ? state.weather.next : "fair"];
function pickWeather(){
  let r = Math.random();
  for(const [k, w] of Object.entries(WEATHER.kinds)){ r -= w.odds; if(r < 0) return k; }
  return "fair";
}
// At night: tomorrow's forecast comes true, and a new one is made for the day after
function rollWeather(){
  const w = state.weather;
  w.today = w.next;
  w.next = state.day + 2 >= w.from ? pickWeather() : "fair";
}
// Shelter slots an exhibit's animals need today, and what it has. Ice age animals don't need cover from the cold.
// A shelter only takes animals up to its `fits` size (coverSlots), so a pile of small shelters never houses a T. rex. A burrow ignores size and takes only the species in its `only` list.
// Biggest animals go first, into the snuggest shelter they fit. `shelter` is what animals actually get, `idle` is room nobody here can use.
function coverOf(e){
  const wk = state.weather ? state.weather.today : "fair", w = WEATHER.kinds[wk];
  let need = 0, shade = 0;
  const sizes = [], pools = [];
  for(const a of e.animals){ const s = SPECIES_BY_ID[a.sp]; if(!(wk === "cold" && COLD_HARDY.includes(s.id))){ const n = coverSlots(s); need += n; sizes.push([n, s.id]); } }
  for(const f of landOf(e)){ const L = LAND[f.type]; if(!L) continue; if(L.slots && !(wk === "cold" && L.noCold)) pools.push({left:L.slots, fits:L.fits || 99, only:L.only}); shade += (L.shade || 0) * w.grove; }
  pools.sort((x, y) => x.fits - y.fits);
  let shelter = 0;
  for(const [n, id] of sizes.sort((x, y) => y[0] - x[0])){
    let want = n;
    for(const p of pools){ if(want <= 0) break; if(p.only ? !p.only.includes(id) : p.fits < n) continue; if(p.left <= 0) continue; const t = Math.min(want, p.left); p.left -= t; want -= t; shelter += t; }
  }
  const idle = pools.reduce((s, p) => s + p.left, 0);
  return {need, shelter, shade, idle, have:shelter + shade};
}
// Share of the herd out in today's weather with no cover: 0 to 1
function exposure(e){
  if(e.viv || !e.animals.length || !weatherNow().happy) return 0;
  const c = coverOf(e);
  return c.need ? clamp(1 - c.have / c.need, 0, 1) : 0;
}
const WEATHER_TEXT = {hot:"no shade. Shelters and groves give shade", cold:"nowhere warm. Shelters keep them warm", storm:"nowhere to shelter. Shelters help most, and groves a little"};

// What the exhibit's biome does to happiness: each animal's home ground, the one it gets by in, or neither
function biomeScore(e, out, n){
  const b = biomeOf(e), fit = {home:[], near:[], away:[]};
  for(const [sp, c] of speciesCounts(e)){ const s = SPECIES_BY_ID[sp], f = biomeFit(s, b); if(f){ out.delta += BIOME_HAPPY[f] * c / n; fit[f].push(s); } }
  const names = l => l.map(s => s.name).join(", "), homes = l => [...new Set(l.map(s => BIOMES[biomesOf(s)[0]].label.toLowerCase()))].join(" or ");
  if(fit.away.length) out.issues.push({bad:true, text:`Wrong biome. ${names(fit.away)} ${fit.away.length === 1 ? "doesn't" : "don't"} belong in ${BIOMES[b].label.toLowerCase()}. ${[...new Set(fit.away.map(s => BIOMES[biomesOf(s)[0]].label))].join(" or ")} would suit ${fit.away.length === 1 ? "it" : "them"}.`});
  if(fit.near.length) out.issues.push({bad:false, text:`${names(fit.near)} ${fit.near.length === 1 ? "gets" : "get"} by in ${BIOMES[b].label.toLowerCase()}, but would rather live in ${homes(fit.near)}.`});
  if(fit.home.length && !fit.away.length && !fit.near.length) out.issues.push({bad:false, text:`At home in the ${BIOMES[b].ground}.`});
  return out;
}
// What the landscaping does to an exhibit's happiness, for exhibitReport
function habitatScore(e){
  const out = {delta:0, issues:[]};
  if(!e.animals.length) return out;
  if(e.viv){   // a vivarium has its biome and plants: no water or rocks
    biomeScore(e, out, e.animals.length);
    let sat = 0, n = 0, want = 0;
    for(const [sp, c] of speciesCounts(e)){ const f = speciesFit(e, SPECIES_BY_ID[sp]); if(f.w.plants > 0){ sat += c * f.plants; n += c; want++; } }
    if(want){
      sat /= n;
      out.delta += VIV_PLANT.bonus * sat;
      out.issues.push({bad:false, text:sat >= .99 ? "Plants from their own period fill it out." : sat > 0 ? "Some plants from their own period. More would suit them." : "Bare. Plants from their own period and biome would make it feel like home."});
    }
    return out;
  }
  const h = habitatOf(e), dry = [], lack = {water:[], rock:[], plants:[]};
  let sat = 0, n = 0;
  for(const [sp, c] of speciesCounts(e)){
    const s = SPECIES_BY_ID[sp], f = speciesFit(e, s);
    sat += c * f.sat; n += c;
    if(thirsty(e, s)) dry.push(s.name);
    else for(const k of ["water", "rock", "plants"]) if(f[k] < .6) lack[k].push(s.name);
  }
  sat /= n || 1;
  if(dry.length){ out.delta -= HAB.dry; out.issues.push({bad:true, text:`Dry. ${dry.join(", ")} ${dry.length === 1 ? "needs" : "need"} water. Draw some in the exhibit.`}); }
  if(sat > 0){
    out.delta += HAB.bonus * sat;
    out.issues.push({bad:false, text:sat >= .6 ? "Water, rocks and plants make it feel like home." : "Some water, rocks and plants. More of what they want would make them feel more at home."});
  }
  const what = {water:"the right amount of water", rock:"enough rocks", plants:"enough plants from their own period"}, uniq = l => [...new Set(l)].join(", ");
  for(const k of ["water", "rock", "plants"]) if(lack[k].length) out.issues.push({bad:false, text:`${uniq(lack[k])} ${lack[k].length === 1 ? "wants" : "want"} ${what[k]}. See Landscaping.`});
  const wrongM2 = landOf(e).reduce((m, f) => { const t = LAND[f.type]; return m + (t && t.flora && !plantHere(t, e) ? landM2(f) : 0); }, 0);
  if(wrongM2 > 0){
    out.delta -= HAB.wrongPlants * clamp(wrongM2 / (area(e.points) || 1) / HAB.groveFull, 0, 1);
    out.issues.push({bad:true, text:`Wrong plants. ${Math.round(wrongM2)} m² of plants here belong in another biome and don't suit ${BIOMES[biomeOf(e)].label.toLowerCase()}. Bulldoze them or regrade the exhibit.`});
  }
  biomeScore(e, out, n);
  // groves from the animals' own era
  let home = 0;
  for(const [sp, c] of speciesCounts(e)) home += c * h.grove[ERA_OF[SPECIES_BY_ID[sp].period]];
  home /= n || 1;
  if(home > 0){
    out.delta += HAB.groveBonus * home;
    out.issues.push({bad:false, text:home >= .6 ? "Groves from their own era to browse and shelter in." : "A few groves from their era. More would suit them."});
  }
  // today's weather
  const w = weatherNow(), x = exposure(e);
  if(w.happy && x > 0){ out.delta -= w.happy * x; out.issues.push({bad:true, text:`${w.label}. ${x >= .99 ? "The animals have" : `${Math.round(x * 100)}% of the herd has`} ${WEATHER_TEXT[state.weather.today]}.`}); }
  else if(w.happy && coverOf(e).need) out.issues.push({bad:false, text:`Sheltered from the ${w.label.toLowerCase()}.`});
  return out;
}

/* ---------- water ---------- */
// Every corner, and points along every shore, sit inside the fence with room to spare, and no fence corner pokes into the water
function insideFence(pts, fence, m){
  for(let i = 0; i < pts.length; i++){
    const a = pts[i], b = pts[(i + 1) % pts.length];
    for(let k = 0; k < 8; k++){ const x = a[0] + (b[0] - a[0]) * k / 8, y = a[1] + (b[1] - a[1]) * k / 8; if(!deepInside(x, y, fence, m)) return false; }
  }
  return !fence.some(p => inPoly(p[0], p[1], pts));
}
// The open exhibit a new body of water starts in
const waterHost = pts => pts.length ? state.exhibits.find(e => !e.viv && inPoly(pts[0][0], pts[0][1], e.points)) || null : null;
// Why this water shape won't work in exhibit e, or null. skip is the water being reshaped; cost is what it would cost now.
function waterProblem(pts, e, skip, cost){
  if(pts.length < 3) return "Needs at least 3 corners.";
  if(!e) return "Start it inside an open exhibit.";
  if(selfCrosses(pts)) return "The shore crosses itself.";
  if(!insideFence(pts, e.points, WATER.margin)) return "Keep it inside the fence.";
  if(area(pts) < WATER.minArea) return `Too small. Water needs at least ${WATER.minArea} m².`;
  if(waterOf(e).some(w => w !== skip && (shapesOverlap(pts, w.points) || shapesOverlap(w.points, pts)))) return "It overlaps other water.";
  if(landOf(e).some(f => LAND[f.type] && shapesOverlap(circlePts(f.x, f.y, LAND[f.type].r), pts))) return "It overlaps a rock, grove or shelter.";
  if(state.buildings.some(b => b.exhibitId === e.id && shapesOverlap(pts, b.points))) return "It overlaps a viewing platform.";
  if(e.gate && (inPoly(e.gate[0], e.gate[1], pts) || distToEdge(e.gate[0], e.gate[1], pts) < 3)) return "Keep clear of the gate.";
  if(cost > 0 && !canAfford(cost)) return `Costs ${money(cost)}. You have ${money(state.money)}.`;
  return null;
}
function addWater(e, pts){
  spend(waterCost(pts), "built");
  (e.water = e.water || []).push({id:uid("w-"), points:pts});
}
const waterById = id => { for(const e of state.exhibits) for(const w of waterOf(e)) if(w.id === id) return {e, w}; return null; };

/* ---------- vivarium plants ---------- */
// A plant goes at the first free spot inside the glass. Plants are shrunk (f.k) to fit, and only ones from the vivarium's biome go in.
function vivPlantSpot(e, key){
  const r = LAND[key].r * VIV_PLANT.scale, bb = bbox(e.points);
  for(let y = bb.y0 + r; y <= bb.y1 - r; y += .5) for(let x = bb.x0 + r; x <= bb.x1 - r; x += .5)
    if(deepInside(x, y, e.points, r + .3) && !landOf(e).some(f => Math.hypot(f.x - x, f.y - y) < r + LAND[f.type].r * (f.k || 1))) return [x, y];
  return null;
}
function vivPlantProblem(e, key){
  const t = LAND[key];
  if(!e.viv || !t || !t.flora) return "Only plants go in a vivarium.";
  if(!plantHere(t, e)) return `${t.label} doesn't grow in ${BIOMES[biomeOf(e)].label.toLowerCase()}.`;
  if(t.tech && !hasTech(t.tech)) return `Research ${FLORA[t.flora].label} flora at ORACLE first.`;
  if(potKey(t) && potsHave(t) < 1) return `Needs ${potName(t)} from CERES, which has none.`;
  if(!vivPlantSpot(e, key)) return "No room left for one that size.";
  if(!canAfford(t.price)) return `Costs ${money(t.price)}.`;
  return null;
}
function addVivPlant(e, key){
  const t = LAND[key], [x, y] = vivPlantSpot(e, key);
  spend(t.price, "built");
  if(potKey(t)) state.ceres.pots[potKey(t)] -= 1;
  (e.land = e.land || []).push({id:uid("l-"), type:key, x, y, k:VIV_PLANT.scale});
}

/* ---------- rocks, groves and shelters ---------- */
// Why a rock, grove or shelter can't go at (x, y) in this exhibit, or null
function landProblem(e, key, x, y){
  const t = LAND[key];
  if(t.tech && !hasTech(t.tech)) return `Research ${FLORA[t.flora].label} flora at ORACLE first.`;
  if(potKey(t) && potsHave(t) < 1) return `Needs ${potName(t)} from CERES, which has none.`;
  if(!deepInside(x, y, e.points, t.r)) return "Keep it inside the fence.";
  if(landOf(e).some(f => Math.hypot(f.x - x, f.y - y) < t.r + LAND[f.type].r)) return "It overlaps something already there.";
  const pts = circlePts(x, y, t.r);
  if(waterOf(e).some(w => shapesOverlap(pts, w.points) || shapesOverlap(w.points, pts))) return "It's in the water.";
  if(state.buildings.some(b => b.exhibitId === e.id && shapesOverlap(pts, b.points))) return "It overlaps a viewing platform.";
  if(e.gate && Math.hypot(e.gate[0] - x, e.gate[1] - y) < t.r + 3) return "Keep clear of the gate.";
  if(!canAfford(t.price)) return `Costs ${money(t.price)}. You have ${money(state.money)}.`;
  return null;
}
// What's under the pointer: the open exhibit it's in, and whether the feature fits there
function landSpot(x, y, key){
  const e = state.exhibits.find(o => !o.viv && inPoly(x, y, o.points));
  if(!e) return {e:null, x, y, ok:false, why:"Point inside an open exhibit."};
  const why = landProblem(e, key, x, y);
  return {e, x, y, ok:!why, why};
}
function placeLand(e, key, x, y, biome){
  const t = LAND[key];
  spend(t.price, "built");
  if(potKey(t)) state.ceres.pots[potKey(t)] -= 1;
  const f = {id:uid("l-"), type:key, x, y};
  if(biome && !t.flora && !t.slots && !t.tray) f.biome = biome;   // a rock keeps the stone color of the biome it was bought under
  (e.land = e.land || []).push(f);
}

// Rocks and plants are drawn as lumpy blobs, shaped from the feature's id so each keeps its look. They stay inside their radius.
const seedOf = f => { let h = 2166136261; for(const c of String(f.id || f.x + "," + f.y)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
function rngOf(seed){ return () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
// Closed outline around (x, y) within radius r. Sharp = straight edges (rock), otherwise smoothed (leaves).
function blobPath(x, y, r, seed, sharp){
  const rnd = rngOf(seed), n = sharp ? 6 + Math.floor(rnd() * 3) : 7 + Math.floor(rnd() * 3), a0 = rnd() * 6.283;
  const p = Array.from({length:n}, (_, i) => { const a = a0 + i * 6.283 / n + (rnd() - .5) * .5, k = r * (sharp ? .62 + rnd() * .38 : .68 + rnd() * .32); return [x + k * Math.cos(a), y + k * Math.sin(a)]; });
  if(sharp) return "M" + p.map(q => q[0].toFixed(2) + " " + q[1].toFixed(2)).join("L") + "Z";
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], m0 = mid(p[n - 1], p[0]);
  let d = `M${m0[0].toFixed(2)} ${m0[1].toFixed(2)}`;
  for(let i = 0; i < n; i++){ const m = mid(p[i], p[(i + 1) % n]); d += `Q${p[i][0].toFixed(2)} ${p[i][1].toFixed(2)} ${m[0].toFixed(2)} ${m[1].toFixed(2)}`; }
  return d + "Z";
}

// SVG for one exhibit's water, rocks, groves and shelters. When bulldozing they can be picked out one by one.
function landSvg(e, pick, isDead){
  let s = "";
  const at = (kind, id) => pick ? ` data-kind="${kind}" data-id="${esc(id)}" style="cursor:pointer"` : ` pointer-events="none"`;
  for(const w of waterOf(e)){
    const dead = pick && isDead("water", w.id), pts = w.points.map(p => p[0].toFixed(2) + "," + p[1].toFixed(2)).join(" ");
    s += `<g${at("water", w.id)}><polygon points="${pts}" fill="#4C93C9" fill-opacity=".85" stroke="${dead ? "var(--bad)" : "#2F6F9F"}" stroke-width="${dead ? 3 : 1.5}" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
    s += `<polygon points="${pts}" fill="none" stroke="#7DB6DD" stroke-opacity=".7" stroke-width="2.5" stroke-linejoin="round" transform="translate(${centroid(w.points).map(c => c * .12).join(" ")}) scale(.88)"/></g>`;
  }
  for(const f of landOf(e)){
    let t = LAND[f.type]; if(!t) continue;
    if(f.k) t = {...t, r:t.r * f.k};   // a vivarium's plants are drawn shrunk
    const dead = pick && isDead("land", f.id);
    const edge = dead ? "var(--bad)" : t.flora ? "#1F3A2B" : t.slots ? "#3B3226" : t.tray ? TRAY.color : "#4E524C";
    s += `<g${at("land", f.id)}>`;
    if(t.tray){
      // a round steel tray, filled to the level of the food in it
      const fill = t.tray ? clamp(trayHas(f) / t.tray, 0, 1) : 0, main = Object.entries(f.food || {}).sort((a, b) => b[1] - a[1])[0];
      s += `<circle cx="${f.x}" cy="${f.y}" r="${t.r}" fill="${t.color}" stroke="${edge}" stroke-width="${dead ? 3 : 1.5}" vector-effect="non-scaling-stroke"/>`;
      s += `<circle cx="${f.x}" cy="${f.y}" r="${t.r * .78}" fill="#4B4F55"/>`;
      if(fill > 0) s += `<circle cx="${f.x}" cy="${f.y}" r="${t.r * .78 * Math.sqrt(fill)}" fill="${FOOD_COLOR[main[0]] || "#999"}"/>`;
    } else if(t.look === "burrow"){
      // a dirt mound with a dark hole
      s += `<path d="${blobPath(f.x, f.y, t.r, seedOf(f), false)}" fill="${t.color}" stroke="${edge}" stroke-width="${dead ? 3 : 1.5}" vector-effect="non-scaling-stroke"/>`;
      s += `<ellipse cx="${f.x}" cy="${f.y + t.r * .1}" rx="${t.r * .4}" ry="${t.r * .28}" fill="#2A211A"/>`;
    } else if(t.look === "cave"){
      // a rocky hill with a dark mouth
      const sd = seedOf(f);
      s += `<path d="${blobPath(f.x, f.y, t.r, sd, true)}" fill="${t.color}" stroke="${edge}" stroke-width="${dead ? 3 : 1.5}" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
      s += `<path d="M${f.x - t.r * .38} ${f.y + t.r * .4}A${t.r * .38} ${t.r * .5} 0 0 1 ${f.x + t.r * .38} ${f.y + t.r * .4}Z" fill="#1E1B17"/>`;
    } else if(t.look === "canopy"){
      // a round awning on spokes
      const sp = Array.from({length:6}, (_, i) => { const a = i * Math.PI / 3; return `M${f.x} ${f.y}L${(f.x + t.r * .9 * Math.cos(a)).toFixed(2)} ${(f.y + t.r * .9 * Math.sin(a)).toFixed(2)}`; }).join("");
      s += `<circle cx="${f.x}" cy="${f.y}" r="${t.r * .9}" fill="${t.color}" fill-opacity=".8" stroke="${edge}" stroke-width="${dead ? 3 : 1.5}" vector-effect="non-scaling-stroke"/>`;
      s += `<path d="${sp}" stroke="#3B3226" stroke-opacity=".5" stroke-width="1" fill="none" vector-effect="non-scaling-stroke"/>`;
    } else if(t.slots){
      // a square roof with a ridge
      const h = t.r * .78;
      s += `<rect x="${f.x - h}" y="${f.y - h}" width="${h * 2}" height="${h * 2}" rx="${h * .12}" fill="${t.color}" stroke="${edge}" stroke-width="${dead ? 3 : 1.5}" vector-effect="non-scaling-stroke"/>`;
      s += `<path d="M${f.x - h} ${f.y}H${f.x + h}" stroke="#3B3226" stroke-opacity=".6" stroke-width="1" vector-effect="non-scaling-stroke"/>`;
    } else if(t.flora){
      // a clump of lumpy canopies
      const rnd = rngOf(seedOf(f) ^ 0x9E37), sd = seedOf(f), clump = [[-.35, -.2, .6], [.35, -.25, .55], [0, .3, .6]];
      if(t.r > 3) clump.push([(rnd() - .5) * .9, (rnd() - .5) * .9, .4]);
      clump.forEach(([dx, dy, k], i) => s += `<path d="${blobPath(f.x + (dx + (rnd() - .5) * .2) * t.r, f.y + (dy + (rnd() - .5) * .2) * t.r, t.r * k, sd + i * 101)}" fill="${t.color}" fill-opacity=".9" stroke="${edge}" stroke-width="${dead ? 3 : 1}" vector-effect="non-scaling-stroke"/>`);
      s += `<path d="${blobPath(f.x - t.r * .15, f.y - t.r * .1, t.r * .2, sd + 7)}" fill="#fff" fill-opacity=".18"/>`;
    } else {
      // a lumpy rock with a light and a dark face
      const sd = seedOf(f), tone = rockTone(BIOMES[f.biome] ? f.biome : biomeOf(e), f.type);
      s += `<path d="${blobPath(f.x, f.y, t.r, sd, true)}" fill="${tone.fill}" fill-opacity=".95" stroke="${edge}" stroke-width="${dead ? 3 : 1.5}" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
      s += `<path d="${blobPath(f.x - t.r * .3, f.y - t.r * .25, t.r * .45, sd + 3, true)}" fill="${tone.light}" fill-opacity=".6"/><path d="${blobPath(f.x + t.r * .35, f.y + t.r * .3, t.r * .35, sd + 5, true)}" fill="${tone.dark}" fill-opacity=".6"/>`;
    }
    s += `</g>`;
  }
  return s;
}
