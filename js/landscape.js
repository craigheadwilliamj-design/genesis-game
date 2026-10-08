/* =====================================================================
   LANDSCAPE
   Water, rocks, groves and shelters inside open exhibits. Water is
   drawn corner by corner like an exhibit (e.water); the rest are placed
   with a tap (e.land). Animals like some of each, and water lovers get
   unhappy and sickly without any water.
   Out in the park the same tools landscape the grounds: plants, rocks and
   statues (state.decor), water (state.water) and open fences such as
   hedge rows (state.fences). Guests walking past them cheer up.
   Groves from an animal's own era make it happier and feed part of its
   diet, and older groves (plants grown at CERES) keep old
   plant-eaters off the grass. Shelters (and groves, for shade) cover
   animals from the weather, which is rolled here each night.
   Placing, drawing and reshaping them lives in map.js, next to the other tools.
   ===================================================================== */

const landKey = t => typeof t === "string" && t.startsWith("land-") ? t.slice(5) : null;
const landOf = e => e.land || [];
const waterOf = e => e.water || [];
// Out in the park: plants, rocks and statues, water, and open fence lines
const decorOf = () => state.decor || [];
const parkWater = () => state.water || [];
const fenceLines = () => state.fences || [];
const parkBiome = () => BIOMES[state.biome] ? state.biome : DEFAULT_PARK_BIOME;
// Distance from a point to an open line, and whether two open lines cross or how close they come
const lineDist = (x, y, line) => { let m = Infinity; for(let i = 1; i < line.length; i++) m = Math.min(m, segProj(x, y, line[i-1], line[i]).d); return line.length === 1 ? Math.hypot(x - line[0][0], y - line[0][1]) : m; };
const linesCross = (a, b) => { for(let i = 1; i < a.length; i++) for(let j = 1; j < b.length; j++) if(segCross(a[i-1], a[i], b[j-1], b[j])) return true; return false; };
const lineLineDist = (a, b) => { let m = Infinity; for(let i = 1; i < a.length; i++) for(let j = 1; j < b.length; j++) m = Math.min(m, segSegDist(a[i-1], a[i], b[j-1], b[j])); return m; };
// Statues: a few are open from the start, the rest come with grants
const statueGrant = key => GOALS.find(g => g.statue && "st-" + g.statue === key) || null;
const statueOpen = key => { const t = LAND[key]; if(!t || !t.statue) return true; if(t.free) return true; const g = statueGrant(key); return !!g && state.goalsDone.includes(g.id); };
const statueHint = key => { const g = statueGrant(key); return g ? `Earn it with the grant "${g.text}".` : ""; };
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
// How much of what an old plant-eater nibbles is grass it never evolved for, 0 to 1: Cenozoic plants in the exhibit (their share of all its plants, building up as they cover the floor), a grassland biome, or grass hay in place of Paleoflora
function grassShare(e, s){
  if(e.viv || foodType(s) !== "paleoflora") return 0;
  if(e.grassFed || biomeOf(e) === "grassland") return 1;
  const g = habitatOf(e).groveM2, wrong = g.cenozoic || 0, own = (g.mesozoic || 0) + (g.paleozoic || 0);
  return wrong > 0 ? wrong / (wrong + own) * clamp(wrong / (area(e.points) || 1) / HAB.groveFull, 0, 1) : 0;
}
// Food units a day the animals browse off groves, for one food type. Older groves give Paleoflora, Cenozoic plants give plants.
function browseRate(e, t){
  if(t !== "plants" && t !== "paleoflora") return 0;
  return landOf(e).reduce((n, f) => { const L = LAND[f.type]; return n + (L && L.browse && (t === "plants") === (L.flora === "cenozoic") ? L.browse : 0) + (L && L.hay && t === "plants" ? L.hay : 0) + (L && L.paleo && t === "paleoflora" ? L.paleo : 0); }, 0);
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
// The open exhibit a new body of water starts in (null: out in the park)
const waterHost = pts => pts.length ? state.exhibits.find(e => !e.viv && inPoly(pts[0][0], pts[0][1], e.points)) || null : null;
// Why this water shape won't work in exhibit e (or out in the park, with no e), or null. skip is the water being reshaped; cost is what it would cost now.
function waterProblem(pts, e, skip, cost){
  if(pts.length < 3) return "Needs at least 3 corners.";
  if(!e) return parkWaterProblem(pts, skip, cost);
  if(selfCrosses(pts)) return "The shore crosses itself.";
  if(!insideFence(pts, e.points, WATER.margin)) return "Keep it inside the fence.";
  if(area(pts) < WATER.minArea) return `Too small. Water needs at least ${WATER.minArea} m².`;
  if(waterOf(e).some(w => w !== skip && (shapesOverlap(pts, w.points) || shapesOverlap(w.points, pts)))) return "It overlaps other water.";
  if(landOf(e).some(f => LAND[f.type] && !LAND[f.type].wet && shapesOverlap(circlePts(f.x, f.y, LAND[f.type].r), pts))) return "It overlaps a rock, grove or shelter.";
  if(state.buildings.some(b => b.exhibitId === e.id && shapesOverlap(pts, b.points))) return "It overlaps a viewing platform.";
  if(e.gate && (inPoly(e.gate[0], e.gate[1], pts) || distToEdge(e.gate[0], e.gate[1], pts) < 3)) return "Keep clear of the gate.";
  if(cost > 0 && !canAfford(cost)) return `Costs ${money(cost)}. You have ${money(state.money)}.`;
  return null;
}
// Water out in the park: clear of exhibits, buildings and paths (a wooden bridge can cross it), and of plants that don't like their feet wet
function parkWaterProblem(pts, skip, cost){
  if(selfCrosses(pts)) return "The shore crosses itself.";
  if(!insidePlot(pts, true)) return "Keep it inside the park boundary.";
  if(area(pts) < WATER.minArea) return `Too small. Water needs at least ${WATER.minArea} m².`;
  if(state.exhibits.some(e => shapesOverlap(pts, e.points) || shapesOverlap(e.points, pts))) return "It runs into an exhibit. Draw water for the animals inside the fence.";
  if(state.buildings.some(b => shapesOverlap(pts, b.points) || shapesOverlap(b.points, pts))) return "It runs into a building.";
  if(state.paths.some(p => !isBridge(p) && lineShapeDist(p.points, pts) < halfWidth(p))) return "It runs into a path. Only a wooden bridge can cross water.";
  if(parkWater().some(w => w !== skip && (shapesOverlap(pts, w.points) || shapesOverlap(w.points, pts)))) return "It overlaps other water.";
  if(fenceLines().some(l => lineEntersShape(l.points, pts))) return "A fence runs through it.";
  if(decorOf().some(f => LAND[f.type] && !LAND[f.type].wet && (inPoly(f.x, f.y, pts) || distToEdge(f.x, f.y, pts) < LAND[f.type].r * .6))) return "It runs into a plant, rock or statue. Bulldoze it first.";
  if(inPoly(state.gate[0], state.gate[1], pts) || distToEdge(state.gate[0], state.gate[1], pts) < 9) return "Keep clear of the entrance.";
  if(cost > 0 && !canAfford(cost)) return `Costs ${money(cost)}. You have ${money(state.money)}.`;
  return null;
}
function addWater(e, pts){
  spend(waterCost(pts), "built");
  const w = {id:uid("w-"), points:pts};
  if(e) (e.water = e.water || []).push(w); else (state.water = state.water || []).push(w);
  return w;
}
const waterById = id => { for(const e of state.exhibits) for(const w of waterOf(e)) if(w.id === id) return {e, w}; const w = parkWater().find(x => x.id === id); return w ? {e:null, w} : null; };

/* ---------- the park's grounds: what new paths, buildings and exhibits must keep clear of ---------- */
// For an exhibit or building outline: water, plants, rocks and statues, and open fences
function shapeHitsLandscape(pts){
  if(parkWater().some(w => shapesOverlap(pts, w.points) || shapesOverlap(w.points, pts))) return "It's in the water.";
  if(decorOf().some(f => LAND[f.type] && (inPoly(f.x, f.y, pts) || distToEdge(f.x, f.y, pts) < LAND[f.type].r * .8))) return "It runs into a plant, rock or statue. Bulldoze it first.";
  if(fenceLines().some(l => lineEntersShape(l.points, pts))) return "A fence runs through it.";
  return null;
}
// For a path hw meters either side of its line. Only a bridge crosses water.
function lineHitsLandscape(pts, hw, bridge){
  if(!bridge && parkWater().some(w => lineShapeDist(pts, w.points) < hw)) return "Paths can't cross water. Draw a wooden bridge over it.";
  if(decorOf().some(f => LAND[f.type] && lineDist(f.x, f.y, pts) < hw + LAND[f.type].r * .5)) return "It runs into a plant, rock or statue. Bulldoze it first.";
  if(fenceLines().some(l => linesCross(l.points, pts) || lineLineDist(l.points, pts) < hw - .3)) return "It runs into a fence.";
  return null;
}

/* ---------- open fences ---------- */
// A fence line that isn't closed into an exhibit: a hedge row along a path, a wall around a garden. Why it can't go here, or null.
// With free, cost and research aren't checked (moving one that's already built).
function fenceProblem(pts, barrier, free){
  const B = BARRIERS[barrier] || BARRIERS.wood;
  if(pts.length < 2) return "Needs at least 2 corners.";
  if(lineLength(pts) < 2) return "Too short.";
  if(!free && B.tech && !hasTech(B.tech)) return `Research ${TECH.find(x => x.id === B.tech).label.toLowerCase()} at ORACLE first.`;
  if(!insidePlot(pts)) return "Keep it inside the park boundary.";
  if(state.exhibits.some(e => lineEntersShape(pts, e.points))) return "It runs into an exhibit.";
  if(state.buildings.some(b => lineEntersShape(pts, b.points) || lineShapeDist(pts, b.points) < .3)) return "It runs into a building.";
  if(state.paths.some(p => linesCross(pts, p.points) || lineLineDist(pts, p.points) < halfWidth(p) - .3)) return "It runs into a path.";
  if(parkWater().some(w => lineShapeDist(pts, w.points) < .3)) return "It runs into water.";
  if(decorOf().some(f => LAND[f.type] && lineDist(f.x, f.y, pts) < LAND[f.type].r * .8)) return "It runs into a plant, rock or statue.";
  const cost = fenceLineCost(pts, barrier);
  if(!free && !canAfford(cost)) return `Costs ${money(cost)}. You have ${money(state.money)}.`;
  return null;
}
function addFenceLine(pts, barrier){
  spend(fenceLineCost(pts, barrier), "built");
  const l = {id:uid("f-"), points:pts};
  if(barrier && barrier !== "wood") l.barrier = barrier;
  (state.fences = state.fences || []).push(l);
  return l;
}

/* ---------- decorations and guests ---------- */
// What one thing out in the park adds to the view (DECOR.pts)
function decorPts(f){
  const t = LAND[f.type]; if(!t) return 0;
  return t.statue ? (t.initials ? DECOR.pts.person : DECOR.pts.statue) : t.flora ? DECOR.pts[t.size] : DECOR.pts[f.type] || 1;
}
// Mark each corner of the guest paths with how pretty the walk on from there is (n.decor, 0 to 1), and the statues guests can read there (n.statues)
function indexDecor(nodes){
  const items = decorOf().filter(f => LAND[f.type]).map(f => ({x:f.x, y:f.y, r:0, v:decorPts(f), st:LAND[f.type].statue ? f.id : null}));
  for(const w of parkWater()){ const [x, y] = centroid(w.points), a = area(w.points); items.push({x, y, r:Math.sqrt(a / Math.PI), v:a / DECOR.waterPer}); }
  for(const l of fenceLines()){
    if(!(BARRIERS[l.barrier] || {}).hedge) continue;
    for(let i = 1; i < l.points.length; i++){
      const a = l.points[i-1], b = l.points[i], n = Math.max(1, Math.round(dist(a, b) / 10));
      for(let k = 0; k < n; k++) items.push({x:a[0] + (b[0] - a[0]) * (k + .5) / n, y:a[1] + (b[1] - a[1]) * (k + .5) / n, r:0, v:dist(a, b) / n / DECOR.hedgePer});
    }
  }
  for(const n of nodes.values()){
    n.decor = 0; n.statues = null;
    if(n.rail || !items.length) continue;
    // the stretch from this corner to halfway along each path leaving it
    const segs = [...n.adj.keys()].filter(m => !m.rail).map(m => [[n.x, n.y], [(n.x + m.x) / 2, (n.y + m.y) / 2]]);
    if(!segs.length) segs.push([[n.x, n.y], [n.x, n.y]]);
    let v = 0;
    for(const it of items){
      const d = Math.min(...segs.map(([a, b]) => segProj(it.x, it.y, a, b).d)) - it.r;
      if(d > DECOR.reach) continue;
      v += it.v;
      if(it.st && d <= DECOR.statueReach) (n.statues = n.statues || []).push(it.st);
    }
    n.decor = clamp(v / DECOR.full, 0, 1);
  }
}
// A party walking past a statue reads its plaque, once
function statueSeen(p, id){
  if((p.statues = p.statues || new Set()).has(id)) return;
  p.statues.add(id);
  const f = decorOf().find(x => x.id === id), t = f && LAND[f.type]; if(!t) return;
  learn(p, t.initials ? DECOR.personLearn : DECOR.animalLearn);
  p.mood += DECOR.statueJoy;
}

/* ---------- vivarium plants ---------- */
// A plant goes at the first free spot inside the glass. Plants are shrunk (f.k) to fit, and only ones from the vivarium's biome go in.
function vivPlantSpot(e, key){
  const r = LAND[key].r * (LAND[key].vivToy ? 1 : VIV_PLANT.scale), bb = bbox(e.points);
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

// Vivarium enrichment goes in the same way, full size
function vivToyProblem(e, key){
  const t = LAND[key];
  if(!e.viv || !t || !t.vivToy) return "Only vivarium enrichment goes here.";
  if(!vivPlantSpot(e, key)) return "No room left for one that size.";
  if(!canAfford(t.price)) return `Costs ${money(t.price)}.`;
  return null;
}
function addVivToy(e, key){
  const [x, y] = vivPlantSpot(e, key);
  spend(LAND[key].price, "built");
  (e.land = e.land || []).push({id:uid("l-"), type:key, x, y});
}

/* ---------- rocks, groves and shelters ---------- */
// Why a rock, grove or shelter can't go at (x, y) in this exhibit, or null
function landProblem(e, key, x, y){
  const t = LAND[key];
  if(t.statue) return "Statues go out in the park, where guests can see them. Place it outside the exhibits.";
  if(t.vivToy) return `${t.label} only goes in a vivarium.`;
  if(t.tech && !hasTech(t.tech)) return t.flora ? `Research ${FLORA[t.flora].label} flora at ORACLE first.` : `Research ${(TECH.find(x => x.id === t.tech) || {label:"it"}).label} at ORACLE first.`;
  if(potKey(t) && potsHave(t) < 1) return `Needs ${potName(t)} from CERES, which has none.`;
  if(t.ceres && state.ceres.stock < t.ceres) return `Takes ${t.ceres} Paleoflora from CERES, which has ${Math.floor(state.ceres.stock)}.`;
  if(!deepInside(x, y, e.points, t.r)) return "Keep it inside the fence.";
  if(landOf(e).some(f => Math.hypot(f.x - x, f.y - y) < t.r + LAND[f.type].r)) return "It overlaps something already there.";
  const pts = circlePts(x, y, t.r);
  if(!t.wet && waterOf(e).some(w => shapesOverlap(pts, w.points) || shapesOverlap(w.points, pts))) return "It's in the water.";
  if(t.aquatic && !waterOf(e).some(w => inPoly(x, y, w.points))) return `${t.label} only grows in water. Place it in the exhibit's water.`;
  if(state.buildings.some(b => b.exhibitId === e.id && shapesOverlap(pts, b.points))) return "It overlaps a viewing platform.";
  if(e.gate && Math.hypot(e.gate[0] - x, e.gate[1] - y) < t.r + 3) return "Keep clear of the gate.";
  if(!canAfford(t.price)) return `Costs ${money(t.price)}. You have ${money(state.money)}.`;
  return null;
}
// What's under the pointer: the open exhibit it's in (null out in the park), and whether the feature fits there
function landSpot(x, y, key){
  if(state.exhibits.some(o => o.viv && inPoly(x, y, o.points))) return {e:null, x, y, ok:false, why:"Plant a vivarium from its own panel."};
  const e = state.exhibits.find(o => !o.viv && inPoly(x, y, o.points));
  const why = e ? landProblem(e, key, x, y) : decorProblem(key, x, y);
  return {e, x, y, ok:!why, why};
}
// Why a plant, rock or statue can't go at (x, y) out in the park, or null
function decorProblem(key, x, y){
  const t = LAND[key];
  if(t.vivToy) return `${t.label} only goes in a vivarium.`;
  if(t.slots || t.tray || t.toy || t.toyFor) return "Habitat props go inside an open exhibit.";
  if(t.statue && !statueOpen(key)) return `${t.label} is locked. ${statueHint(key)}`;
  if(t.flora && t.period !== "Quaternary" && !hasTech("sterile")) return "Only modern plants grow outside the exhibits. Research sterile prehistoric plants at ORACLE to plant this one out here.";
  if(t.tech && !hasTech(t.tech)) return `Research ${FLORA[t.flora].label} flora at ORACLE first.`;
  if(potKey(t) && potsHave(t) < 1) return `Needs ${potName(t)} from CERES, which has none.`;
  const r = t.r;
  if(!insidePlot(circlePts(x, y, r), true)) return "Keep it inside the park boundary.";
  if(state.exhibits.some(o => distToEdge(x, y, o.points) < r)) return "Keep it clear of exhibit fences.";
  if(state.buildings.some(b => inPoly(x, y, b.points) || distToEdge(x, y, b.points) < r * .8)) return "It overlaps a building.";
  if(state.paths.some(p => lineDist(x, y, p.points) < halfWidth(p) + r * .5)) return "It's on a path.";
  if(Math.hypot(x - state.gate[0], y - state.gate[1]) < r + 9) return "Keep clear of the entrance.";
  if(fenceLines().some(l => lineDist(x, y, l.points) < r * .8)) return "It's on a fence.";
  if(decorOf().some(f => LAND[f.type] && Math.hypot(f.x - x, f.y - y) < r + LAND[f.type].r)) return "It overlaps something already there.";
  const wet = parkWater().find(w => inPoly(x, y, w.points) || distToEdge(x, y, w.points) < r * .6);
  if(t.aquatic && !parkWater().some(w => inPoly(x, y, w.points))) return `${t.label} only grows in water. Draw a pond first, then place it in the water.`;
  if(wet && !t.wet) return "It's in the water.";
  if(!canAfford(t.price)) return `Costs ${money(t.price)}. You have ${money(state.money)}.`;
  return null;
}
function placeLand(e, key, x, y, biome){
  const t = LAND[key];
  spend(t.price, "built");
  if(potKey(t)) state.ceres.pots[potKey(t)] -= 1;
  if(t.ceres) state.ceres.stock = Math.max(0, state.ceres.stock - t.ceres);
  const f = {id:uid("l-"), type:key, x, y};
  if(biome && !t.flora && !t.slots && !t.tray && !t.statue) f.biome = biome;   // a rock keeps the stone color of the biome it was bought under
  if(e){ (e.land = e.land || []).push(f); return f; }
  // a statue's plinth is paved in the theme where it stands (its zone's, or the brush)
  if(t.statue){ const z = themedZoneAt({points:[[x, y]]}), k = z ? z.theme : state.themes && state.themes.brush; if(k && k !== "genesis" && THEMES[k] && themeHave(k)) f.theme = k; }
  (state.decor = state.decor || []).push(f);
  return f;
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

// Hit area for bulldozing: each piece can be picked out one by one
const pickAt = (pick, kind, id) => pick ? ` data-kind="${kind}" data-id="${esc(id)}" style="cursor:pointer"` : ` pointer-events="none"`;
// One body of water, in an exhibit or out in the park
function waterSvg(w, pick, isDead){
  const dead = pick && isDead("water", w.id), pts = w.points.map(p => p[0].toFixed(2) + "," + p[1].toFixed(2)).join(" ");
  return `<g${pickAt(pick, "water", w.id)}><polygon points="${pts}" fill="#4C93C9" fill-opacity=".85" stroke="${dead ? "var(--bad)" : "#2F6F9F"}" stroke-width="${dead ? 3 : 1.5}" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`
    + `<polygon points="${pts}" fill="none" stroke="#7DB6DD" stroke-opacity=".7" stroke-width="2.5" stroke-linejoin="round" transform="translate(${centroid(w.points).map(c => c * .12).join(" ")}) scale(.88)"/></g>`;
}
// A plant seen from above, by its look (LAND[x].look): a leafy clump unless it says otherwise, dotted with its blossoms or fall color
function plantSvg(f, t, edge, sw){
  const sd = seedOf(f), rnd = rngOf(sd ^ 0x9E37), r = t.r, x = f.x, y = f.y, ns = `vector-effect="non-scaling-stroke"`, n2 = v => v.toFixed(2);
  const dark = plantMix(t.color, "#000000", .3), light = plantMix(t.color, "#ffffff", .3);
  const dots = (n, c, k, spread = .7) => { let o = ""; for(let i = 0; i < n; i++){ const a = rnd() * 6.283, d = Math.sqrt(rnd()) * r * spread; o += `<circle cx="${n2(x + d * Math.cos(a))}" cy="${n2(y + d * Math.sin(a))}" r="${n2(r * k)}" fill="${c}"/>`; } return o; };
  let s = "";
  if(t.look === "conifer"){
    // a pointed star of branches, darker toward the trunk
    const n = 9, a0 = rnd() * 6.283, pts = [];
    for(let i = 0; i < n * 2; i++){ const a = a0 + i * Math.PI / n, k = i % 2 ? r * .55 : r; pts.push(n2(x + k * Math.cos(a)) + "," + n2(y + k * Math.sin(a))); }
    s += `<polygon points="${pts.join(" ")}" fill="${t.color}" stroke="${edge}" stroke-width="${sw}" stroke-linejoin="round" ${ns}/><circle cx="${x}" cy="${y}" r="${n2(r * .3)}" fill="${dark}"/><circle cx="${n2(x - r * .12)}" cy="${n2(y - r * .12)}" r="${n2(r * .12)}" fill="${light}" fill-opacity=".6"/>`;
  } else if(t.look === "willow"){
    // a soft dome with strands hanging out to the edge
    s += `<path d="${blobPath(x, y, r, sd)}" fill="${t.color}" fill-opacity=".9" stroke="${edge}" stroke-width="${sw}" ${ns}/>`;
    let d = "";
    for(let i = 0; i < 16; i++){ const a = i * 6.283 / 16 + rnd() * .3, k0 = r * (.15 + rnd() * .2), k1 = r * (.75 + rnd() * .2); d += `M${n2(x + k0 * Math.cos(a))} ${n2(y + k0 * Math.sin(a))}L${n2(x + k1 * Math.cos(a))} ${n2(y + k1 * Math.sin(a))}`; }
    s += `<path d="${d}" stroke="${light}" stroke-width="${n2(r * .07)}" stroke-linecap="round" fill="none"/>`;
  } else if(t.look === "palm"){
    // broad fronds fanning out from the crown
    const n = 6 + Math.floor(rnd() * 2), a0 = rnd() * 6.283;
    for(let i = 0; i < n; i++){
      const a = a0 + i * 6.283 / n, cx = x + r * .5 * Math.cos(a), cy = y + r * .5 * Math.sin(a), deg = (a * 180 / Math.PI).toFixed(1);
      s += `<ellipse cx="${n2(cx)}" cy="${n2(cy)}" rx="${n2(r * .5)}" ry="${n2(r * .2)}" transform="rotate(${deg} ${n2(cx)} ${n2(cy)})" fill="${i % 2 ? t.color : plantMix(t.color, "#ffffff", .12)}" stroke="${edge}" stroke-width="${sw}" ${ns}/>`;
      s += `<path d="M${x} ${y}L${n2(x + r * .95 * Math.cos(a))} ${n2(y + r * .95 * Math.sin(a))}" stroke="${dark}" stroke-width="${n2(r * .04)}"/>`;
    }
    s += `<circle cx="${x}" cy="${y}" r="${n2(r * .14)}" fill="${dark}"/>`;
  } else if(t.look === "bamboo"){
    // a thicket of canes under a haze of leaves
    s += `<path d="${blobPath(x, y, r, sd)}" fill="${t.color}" fill-opacity=".55" stroke="${edge}" stroke-width="${sw}" ${ns}/>`;
    for(let i = 0; i < 9; i++){ const a = rnd() * 6.283, d = Math.sqrt(rnd()) * r * .65; s += `<circle cx="${n2(x + d * Math.cos(a))}" cy="${n2(y + d * Math.sin(a))}" r="${n2(r * .13)}" fill="#C9D86A" stroke="${dark}" stroke-width="1" ${ns}/>`; }
  } else if(t.look === "cactus"){
    // flat pads with fruit along the rims
    for(let i = 0; i < 4; i++){ const a = rnd() * 6.283, d = r * (.15 + rnd() * .3), cx = x + d * Math.cos(a), cy = y + d * Math.sin(a); s += `<ellipse cx="${n2(cx)}" cy="${n2(cy)}" rx="${n2(r * .4)}" ry="${n2(r * .27)}" transform="rotate(${(rnd() * 180).toFixed(0)} ${n2(cx)} ${n2(cy)})" fill="${i % 2 ? t.color : light}" stroke="${edge}" stroke-width="${sw}" ${ns}/>`; }
    if(t.accent) s += dots(5, t.accent, .09, .8);
  } else if(t.look === "rosette"){
    // stiff pointed leaves from the middle
    const n = 9, a0 = rnd() * 6.283;
    for(let i = 0; i < n; i++){ const a = a0 + i * 6.283 / n, w = .22; s += `<path d="M${x} ${y}L${n2(x + r * .5 * Math.cos(a - w))} ${n2(y + r * .5 * Math.sin(a - w))}L${n2(x + r * Math.cos(a))} ${n2(y + r * Math.sin(a))}L${n2(x + r * .5 * Math.cos(a + w))} ${n2(y + r * .5 * Math.sin(a + w))}Z" fill="${i % 2 ? t.color : light}" stroke="${edge}" stroke-width="${sw}" stroke-linejoin="round" ${ns}/>`; }
  } else if(t.look === "reeds"){
    // stems with brown seed heads
    let d = "", heads = "";
    for(let i = 0; i < 11; i++){ const px = x + (rnd() - .5) * r * 1.4, py = y + (rnd() - .5) * r * 1.2, qx = px + (rnd() - .5) * r * .3, qy = py - r * .4; d += `M${n2(px)} ${n2(py)}L${n2(qx)} ${n2(qy)}`; heads += `<ellipse cx="${n2(qx)}" cy="${n2(qy)}" rx="${n2(r * .07)}" ry="${n2(r * .16)}" fill="#6B4423"/>`; }
    s += `<path d="${d}" stroke="${t.color}" stroke-width="${n2(r * .08)}" stroke-linecap="round" fill="none"/>${heads}`;
  } else if(t.look === "lily"){
    // round pads, each with a notch, and a flower or two
    for(let i = 0; i < 4; i++){
      const a = rnd() * 6.283, d = r * (.1 + rnd() * .45), cx = x + d * Math.cos(a), cy = y + d * Math.sin(a), pr = r * (.3 + rnd() * .12), b = rnd() * 6.283;
      s += `<path d="M${n2(cx)} ${n2(cy)}L${n2(cx + pr * Math.cos(b))} ${n2(cy + pr * Math.sin(b))}A${n2(pr)} ${n2(pr)} 0 1 1 ${n2(cx + pr * Math.cos(b + .5))} ${n2(cy + pr * Math.sin(b + .5))}Z" fill="${i % 2 ? t.color : light}" stroke="${edge}" stroke-width="${sw}" ${ns}/>`;
    }
    if(t.accent) s += dots(2, t.accent, .14, .5);
  } else if(t.look === "knees"){
    // knobbly stumps poking up
    for(let i = 0; i < 7; i++){ const a = rnd() * 6.283, d = Math.sqrt(rnd()) * r * .75, cx = x + d * Math.cos(a), cy = y + d * Math.sin(a), k = r * (.12 + rnd() * .08); s += `<circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(k)}" fill="${t.color}" stroke="${edge}" stroke-width="1" ${ns}/><circle cx="${n2(cx - k * .25)}" cy="${n2(cy - k * .25)}" r="${n2(k * .4)}" fill="#A88560"/>`; }
  } else {
    // a clump of lumpy canopies
    const clump = [[-.35, -.2, .6], [.35, -.25, .55], [0, .3, .6]];
    if(t.r > 3) clump.push([(rnd() - .5) * .9, (rnd() - .5) * .9, .4]);
    clump.forEach(([dx, dy, k], i) => s += `<path d="${blobPath(x + (dx + (rnd() - .5) * .2) * r, y + (dy + (rnd() - .5) * .2) * r, r * k, sd + i * 101)}" fill="${t.color}" fill-opacity=".9" stroke="${edge}" stroke-width="${sw}" ${ns}/>`);
    s += `<path d="${blobPath(x - r * .15, y - r * .1, r * .2, sd + 7)}" fill="#fff" fill-opacity=".18"/>`;
    if(t.accent) s += dots(t.size === "small" ? 5 : 8, t.accent, t.size === "small" ? .11 : .08);
  }
  return s;
}
// A plant drawn from its picture (PLANT_SPRITES): a soft shadow, then the sprite standing on the spot, flipped by its seed so a grove isn't copies
function plantSpriteSvg(f, t, S, dead){
  const w = t.r * 2 * (S.size || 1), ht = w / S.ratio, flip = seedOf(f) & 1 ? -1 : 1, up = tilted(), x = f.x - w / 2, y = up ? f.y - ht + ht * .05 : f.y - ht / 2, n2 = v => v.toFixed(2);
  return (up ? `<ellipse cx="${n2(f.x + w * .06)}" cy="${n2(f.y)}" rx="${n2(w * .38)}" ry="${n2(w * .12)}" fill="#1D2B22" fill-opacity=".2"/>` : "")
    + `<g transform="translate(${n2(f.x)} 0) scale(${flip} 1) translate(${n2(-f.x)} 0)"><image href="sprites/plants/${t.key}.png" style="image-rendering:pixelated" x="${n2(x)}" y="${n2(y)}" width="${n2(w)}" height="${n2(ht)}"/></g>`
    + (dead ? `<rect x="${n2(x)}" y="${n2(y)}" width="${n2(w)}" height="${n2(ht)}" fill="none" stroke="var(--bad)" stroke-width="3" vector-effect="non-scaling-stroke"/>` : "");
}
// A statue: a stone plinth paved like its theme's paths, and a bronze disc with the animal's letter (the size of its dot on the map) or the person's initials
function statueSvg(f, t, edge, dead){
  const T = themeOf(f), base = T.path.live, rim = dead ? edge : T.path.edge, x = f.x, y = f.y, r = t.r, p = r * .92, ns = `vector-effect="non-scaling-stroke"`;
  let s = `<rect x="${x - p}" y="${y - p}" width="${p * 2}" height="${p * 2}" rx="${p * .18}" fill="${base}" stroke="${rim}" stroke-width="${dead ? 3 : 1.2}" ${ns}/>`;
  s += `<rect x="${x - p * .8}" y="${y - p * .8}" width="${p * 1.6}" height="${p * 1.6}" rx="${p * .12}" fill="${mixHex(base, "#ffffff", .18)}" stroke="${mixHex(base, "#000000", .25)}" stroke-width=".8" ${ns}/>`;
  const br = t.initials ? r * .62 : r - .9, txt = t.initials || (SPECIES_BY_ID[t.sp] ? SPECIES_BY_ID[t.sp].name[0] : "?");
  s += `<circle cx="${x}" cy="${y}" r="${br}" fill="#9C6B33" stroke="#4E3115" stroke-width="1.2" ${ns}/><circle cx="${x - br * .28}" cy="${y - br * .3}" r="${br * .5}" fill="#D9A766" fill-opacity=".45"/>`;
  s += `<text class="glyph" x="${x}" y="${y}" font-size="${br * (txt.length > 2 ? .62 : txt.length > 1 ? .82 : 1.1)}" style="fill:#F6E7C1;stroke:#3A2410">${esc(txt)}</text>`;
  return s;
}
// The 3/4 view (map.js `tilt`, prototype): trees stand on trunks and rocks get height. A height of h meters is drawn h/TILT up the map.
const tilted = () => typeof tilt !== "undefined" && tilt;
// how high a plant's canopy sits, in meters; 0 keeps it on the ground (low plants, reeds, lilies, cactus pads)
function treeLift(t){
  const k = t.size === "small" ? .45 : t.size === "large" ? 1.15 : .85;
  return t.look === "palm" ? t.r * 1.7 * k : t.look === "willow" ? t.r * .9 * k : t.look ? 0 : t.r * k;
}
// a plant standing up: a shadow, a trunk, and its canopy lifted; conifers become a stack of cones
function tree34(f, t, edge, sw){
  const x = f.x, y = f.y, r = t.r, n2 = v => v.toFixed(2), ns = `vector-effect="non-scaling-stroke"`;
  if(t.look === "conifer"){
    const dark = plantMix(t.color, "#000000", .3), light = plantMix(t.color, "#ffffff", .2), H = r * 2.6;
    let s = `<ellipse cx="${n2(x + r*.5)}" cy="${n2(y + r*.35)}" rx="${n2(r*.75)}" ry="${n2(r*.5)}" fill="#1D2B22" fill-opacity=".2"/>`;
    s += `<rect x="${n2(x - r*.08)}" y="${n2(y - r*.6 / TILT)}" width="${n2(r*.16)}" height="${n2(r*.6 / TILT)}" fill="#5A4128"/>`;
    for(let k = 0; k < 3; k++){ const b = r * (.35 + k * .7), top = b + r * 1.25, w = r * (1 - k * .24), yb = y - b / TILT, yt = y - top / TILT;
      s += `<path d="M${n2(x - w)} ${n2(yb)}L${n2(x)} ${n2(yt)}L${n2(x + w)} ${n2(yb)}Q${n2(x)} ${n2(yb + w * .35)} ${n2(x - w)} ${n2(yb)}Z" fill="${k % 2 ? light : t.color}" stroke="${edge}" stroke-width="${sw}" stroke-linejoin="round" ${ns}/>`
        + `<path d="M${n2(x)} ${n2(yt)}L${n2(x + w)} ${n2(yb)}Q${n2(x + w*.5)} ${n2(yb + w * .2)} ${n2(x)} ${n2(yb + w * .18)}Z" fill="${dark}" fill-opacity=".45"/>`; }
    return s;
  }
  const h = treeLift(t), H = h / TILT, tw = r * (t.look === "palm" ? .09 : .13);
  return `<ellipse cx="${n2(x + h*.3)}" cy="${n2(y + h*.22)}" rx="${n2(r*.8)}" ry="${n2(r*.55)}" fill="#1D2B22" fill-opacity=".2"/>`
    + `<rect x="${n2(x - tw/2)}" y="${n2(y - H)}" width="${n2(tw)}" height="${n2(H)}" rx="${n2(tw*.3)}" fill="#5A4128"/>`
    + `<g transform="translate(0 ${n2(-H)})">${plantSvg(f, t, edge, sw)}</g>`;
}
// a rock or a cave given height: the same lumpy outline stacked up from a dark base to the lit top
function rock34(f, t, tone, edge, sw, cave){
  const sd = seedOf(f), r = t.r, h = r * (cave ? .85 : .7), H = h / TILT, n = 10, ns = `vector-effect="non-scaling-stroke"`;
  let s = `<path d="${blobPath(f.x + h*.3, f.y + h*.2, r, sd, true)}" fill="#1D2B22" fill-opacity=".2"/>`;
  for(let k = 0; k < n; k++) s += `<path d="${blobPath(f.x, f.y - H * k / n, r, sd, true)}" fill="${mixHex(tone.dark, tone.fill, k / n)}" ${k ? "" : `stroke="${edge}" stroke-width="${sw}" stroke-linejoin="round" ${ns}`}/>`;
  s += `<path d="${blobPath(f.x, f.y - H, r, sd, true)}" fill="${tone.fill}" stroke="${edge}" stroke-width="${sw}" stroke-linejoin="round" ${ns}/>`;
  s += `<path d="${blobPath(f.x - r * .3, f.y - H - r * .25, r * .45, sd + 3, true)}" fill="${tone.light}" fill-opacity=".6"/>`;
  if(cave){ const w = r * .4, mh = Math.min(H * .85, r * .9); s += `<path d="M${f.x - w} ${f.y + r * .7}A${w} ${mh} 0 0 1 ${f.x + w} ${f.y + r * .7}Z" fill="#1E1B17"/>`; }
  return s;
}
// a barn shelter: wooden walls with a dark open front under a gable roof turned to the viewer
function shelter34(f, t, edge, sw){
  const h = t.r * .78, x = f.x, y = f.y, P = [[x - h, y - h], [x + h, y - h], [x + h, y + h], [x - h, y + h]], wall = t.r * .5;
  const line = `stroke="${edge}" stroke-width="${sw}" stroke-linejoin="round" vector-effect="non-scaling-stroke"`, w = walls34(P, 0, wall, t.color, line);
  return `<polygon points="${polyStr(P.map(([a, b]) => [a + wall*.3, b + wall*.25]))}" fill="#1D2B22" fill-opacity=".2"/>` + w.s
    + (w.main >= 0 ? quad34(P, w.main, .18, .82, 0, wall * .85, "#2A211A") : "") + hipRoof34(P, wall, t.r * .45, "#6B5A44", null, line, "ns", t.color);
}
// a canopy: a round shade cloth on poles, peaked in the middle
function canopy34(f, t, edge, sw){
  const r = t.r * .9, x = f.x, y = f.y, H = t.r * .55, top = y - H / TILT, peak = y - (H + t.r * .22) / TILT, n2 = v => v.toFixed(2), ns = `vector-effect="non-scaling-stroke"`;
  const rim = Array.from({length:12}, (_, i) => { const a = i * Math.PI / 6; return [x + r * Math.cos(a), top + r * Math.sin(a)]; });
  let s = `<ellipse cx="${n2(x + H*.3)}" cy="${n2(y + H*.2)}" rx="${n2(r)}" ry="${n2(r*.9)}" fill="#1D2B22" fill-opacity=".18"/>`;
  s += rim.filter((_, i) => i % 2 === 0 && Math.sin(i * Math.PI / 6) > -.1).map(([px, py]) => `<path d="M${n2(px)} ${n2(py + H / TILT)}L${n2(px)} ${n2(py)}" stroke="#3B3226" stroke-width="1.5" ${ns}/>`).join("");
  // each wedge from the rim to the peak, lighter toward the viewer
  rim.forEach(([px, py], i) => { const [qx, qy] = rim[(i + 1) % 12], l = Math.sin((i + .5) * Math.PI / 6) * .5 - Math.cos((i + .5) * Math.PI / 6) * .2;
    s += `<polygon points="${n2(px)},${n2(py)} ${n2(qx)},${n2(qy)} ${n2(x)},${n2(peak)}" fill="${mixHex(t.color, l > 0 ? "#ffffff" : "#000000", Math.abs(l) * .35)}" stroke="${edge}" stroke-width="${i % 2 ? 0 : sw * .6}" stroke-linejoin="round" ${ns}/>`; });
  return s;
}
// a statue standing up: the plinth as a block, and the bronze medallion upright on top
function statue34(f, t, edge, dead){
  const T = themeOf(f), base = T.path.live, rim = dead ? edge : T.path.edge, x = f.x, y = f.y, r = t.r, p = r * .92, ph = p * .7, ns = `vector-effect="non-scaling-stroke"`;
  const P = [[x - p, y - p], [x + p, y - p], [x + p, y + p], [x - p, y + p]], line = `stroke="${rim}" stroke-width="${dead ? 3 : 1.2}" stroke-linejoin="round" ${ns}`;
  let s = `<polygon points="${polyStr(P.map(([a, b]) => [a + ph*.3, b + ph*.25]))}" fill="#1D2B22" fill-opacity=".2"/>` + walls34(P, 0, ph, base, line).s + `<polygon points="${polyStr(P.map(lift34(ph)))}" fill="${mixHex(base, "#ffffff", .18)}" ${line}/>`;
  const br = t.initials ? r * .62 : r - .9, cy = y - (ph + br * 1.15) / TILT, txt = t.initials || (SPECIES_BY_ID[t.sp] ? SPECIES_BY_ID[t.sp].name[0] : "?");
  s += `<rect x="${x - br*.15}" y="${cy}" width="${br*.3}" height="${(br * 1.15) / TILT}" fill="#4E3115"/>`;
  s += `<ellipse cx="${x}" cy="${cy}" rx="${br}" ry="${br / TILT}" fill="#9C6B33" stroke="#4E3115" stroke-width="1.2" ${ns}/><ellipse cx="${x - br * .28}" cy="${cy - br * .3 / TILT}" rx="${br * .5}" ry="${br * .5 / TILT}" fill="#D9A766" fill-opacity=".45"/>`;
  s += `<text class="glyph" x="${x}" y="${cy}" font-size="${br * (txt.length > 2 ? .62 : txt.length > 1 ? .82 : 1.1)}" style="fill:#F6E7C1;stroke:#3A2410">${esc(txt)}</text>`;
  return s;
}
// One rock, plant, shelter, tray or statue. biome is the ground it stands on (rocks take their stone color from it).
function featSvg(f, biome, pick, isDead){
  let t = LAND[f.type]; if(!t) return "";
  if(f.k) t = {...t, r:t.r * f.k};   // a vivarium's plants are drawn shrunk
  const dead = pick && isDead("land", f.id);
  const edge = dead ? "var(--bad)" : t.flora ? "#1F3A2B" : t.slots ? "#3B3226" : t.tray ? TRAY.color : "#4E524C";
  let s = `<g${pickAt(pick, "land", f.id)}${tilted() ? ` data-y="${f.y}"` : ""}>`;
  const up = tilted() && !f.k;
  if(t.statue) s += up ? statue34(f, t, edge, dead) : statueSvg(f, t, edge, dead);
  else if(up && t.look === "burrow") s += rock34(f, {...t, r:t.r * .8}, {fill:t.color, light:mixHex(t.color, "#ffffff", .2), dark:mixHex(t.color, "#000000", .3)}, edge, dead ? 3 : 1.5, true);
  else if(up && t.look === "canopy") s += canopy34(f, t, edge, dead ? 3 : 1.5);
  else if(up && t.slots && !t.look) s += shelter34(f, t, edge, dead ? 3 : 1.5);
  else if(t.tray){
    // a round steel tray, filled to the level of the food in it
    const fill = t.tray ? clamp(trayHas(f) / t.tray, 0, 1) : 0, main = Object.entries(f.food || {}).sort((a, b) => b[1] - a[1])[0];
    s += `<circle cx="${f.x}" cy="${f.y}" r="${t.r}" fill="${t.color}" stroke="${edge}" stroke-width="${dead ? 3 : 1.5}" vector-effect="non-scaling-stroke"/>`;
    s += `<circle cx="${f.x}" cy="${f.y}" r="${t.r * .78}" fill="#4B4F55"/>`;
    if(fill > 0) s += `<circle cx="${f.x}" cy="${f.y}" r="${t.r * .78 * Math.sqrt(fill)}" fill="${FOOD_COLOR[main[0]] || "#999"}"/>`;
  } else if(t.look === "burrow"){
    // a dirt mound with a dark hole
    s += `<path d="${blobPath(f.x, f.y, t.r, seedOf(f), false)}" fill="${t.color}" stroke="${edge}" stroke-width="${dead ? 3 : 1.5}" vector-effect="non-scaling-stroke"/>`;
    s += `<ellipse cx="${f.x}" cy="${f.y + t.r * .1}" rx="${t.r * .4}" ry="${t.r * .28}" fill="#2A211A"/>`;
  } else if(t.look === "cave" && tilted() && !f.k) s += rock34(f, t, {fill:t.color, light:mixHex(t.color, "#ffffff", .25), dark:mixHex(t.color, "#000000", .35)}, edge, dead ? 3 : 1.5, true);
  else if(t.look === "cave"){
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
  } else if(t.look === "post"){
    // a stout post worn smooth on one side
    s += `<circle cx="${f.x}" cy="${f.y}" r="${t.r * .55}" fill="${t.color}" stroke="${edge}" stroke-width="${dead ? 3 : 1.5}" vector-effect="non-scaling-stroke"/><circle cx="${f.x - t.r * .15}" cy="${f.y - t.r * .15}" r="${t.r * .2}" fill="#B08E66"/>`;
  } else if(t.look === "logs"){
    // three logs in a heap, end grain showing
    for(const [ox, oy, a] of [[-.35, .3, 8], [.3, .25, -12], [0, -.3, 25]]){
      const cx = f.x + ox * t.r, cy = f.y + oy * t.r, L = t.r * .95, w = t.r * .34;
      s += `<g transform="rotate(${a} ${cx} ${cy})"><rect x="${cx - L / 2}" y="${cy - w / 2}" width="${L}" height="${w}" rx="${w / 2}" fill="${t.color}" stroke="${edge}" stroke-width="${dead ? 3 : 1}" vector-effect="non-scaling-stroke"/><circle cx="${cx + L / 2 - w / 2}" cy="${cy}" r="${w * .38}" fill="#B08E66"/></g>`;
    }
  } else if(t.look === "wallow"){
    // a muddy hollow with a wet shine
    const sd = seedOf(f);
    s += `<path d="${blobPath(f.x, f.y, t.r, sd, false)}" fill="${t.color}" stroke="${edge}" stroke-width="${dead ? 3 : 1}" vector-effect="non-scaling-stroke"/>`;
    s += `<path d="${blobPath(f.x + t.r * .1, f.y + t.r * .05, t.r * .55, sd + 2, false)}" fill="#4E3B26" fill-opacity=".8"/><ellipse cx="${f.x - t.r * .2}" cy="${f.y - t.r * .15}" rx="${t.r * .22}" ry="${t.r * .1}" fill="#A08A6A" fill-opacity=".5"/>`;
  } else if(t.look === "ball"){
    // a big rubber ball with a stripe
    s += `<circle cx="${f.x}" cy="${f.y}" r="${t.r}" fill="${t.color}" stroke="${edge}" stroke-width="${dead ? 3 : 1.5}" vector-effect="non-scaling-stroke"/><path d="M${f.x - t.r} ${f.y}Q${f.x} ${f.y - t.r * .55} ${f.x + t.r} ${f.y}" fill="none" stroke="#F4F1E8" stroke-width="${t.r * .22}"/><circle cx="${f.x - t.r * .35}" cy="${f.y - t.r * .4}" r="${t.r * .18}" fill="#fff" fill-opacity=".5"/>`;
  } else if(t.look === "ice" || t.look === "hay"){
    // a block of ice with the treat frozen inside, or a round bale; both shrink as they're used up
    const k = t.lasts ? .55 + .45 * clamp((f.left ?? t.lasts) / t.lasts, 0, 1) : 1, r = t.r * k;
    if(t.look === "ice") s += `<rect x="${f.x - r}" y="${f.y - r}" width="${r * 2}" height="${r * 2}" rx="${r * .3}" fill="#CFE8F2" fill-opacity=".9" stroke="${edge}" stroke-width="${dead ? 3 : 1}" vector-effect="non-scaling-stroke"/><ellipse cx="${f.x}" cy="${f.y}" rx="${r * .55}" ry="${r * .32}" fill="${t.color}"/><path d="M${f.x - r * .7} ${f.y - r * .6}l${r * .4} 0" stroke="#fff" stroke-width="${r * .12}" stroke-linecap="round"/>`;
    else s += `<circle cx="${f.x}" cy="${f.y}" r="${r}" fill="${t.color}" stroke="${edge}" stroke-width="${dead ? 3 : 1}" vector-effect="non-scaling-stroke"/><circle cx="${f.x}" cy="${f.y}" r="${r * .62}" fill="none" stroke="${t.ring || "#A8893A"}" stroke-width="${r * .12}"/><circle cx="${f.x}" cy="${f.y}" r="${r * .28}" fill="none" stroke="${t.ring || "#A8893A"}" stroke-width="${r * .1}"/>`;
  } else if(t.look === "buglog"){
    // a hollow log riddled with holes
    s += `<rect x="${f.x - t.r}" y="${f.y - t.r * .4}" width="${t.r * 2}" height="${t.r * .8}" rx="${t.r * .4}" fill="${t.color}" stroke="${edge}" stroke-width="${dead ? 3 : 1.5}" vector-effect="non-scaling-stroke"/>`;
    for(const [ox, oy] of [[-.5, -.1], [-.1, .15], [.3, -.12], [.6, .1]]) s += `<circle cx="${f.x + ox * t.r}" cy="${f.y + oy * t.r}" r="${t.r * .09}" fill="#2A211A"/>`;
    s += `<ellipse cx="${f.x + t.r * .85}" cy="${f.y}" rx="${t.r * .15}" ry="${t.r * .34}" fill="#B08E66"/>`;
  } else if(t.look === "vbark"){
    // a curl of bark to hide under
    s += `<path d="M${f.x - t.r} ${f.y + t.r * .3}A${t.r} ${t.r * .8} 0 0 1 ${f.x + t.r} ${f.y + t.r * .3}" fill="${t.color}" stroke="${edge}" stroke-width="${dead ? 3 : 1}" vector-effect="non-scaling-stroke"/>`;
  } else if(t.look === "vbranch"){
    // forked branches
    s += `<path d="M${f.x - t.r} ${f.y + t.r * .6}L${f.x + t.r * .8} ${f.y - t.r * .7}M${f.x - t.r * .1} ${f.y - t.r * .05}L${f.x + t.r * .5} ${f.y + t.r * .7}M${f.x + t.r * .3} ${f.y - t.r * .3}L${f.x - t.r * .4} ${f.y - t.r * .8}" stroke="${t.color}" stroke-width="${t.r * .25}" stroke-linecap="round" fill="none"/>`;
  } else if(t.look === "vdig"){
    // a box of deep, loose earth
    s += `<rect x="${f.x - t.r}" y="${f.y - t.r * .7}" width="${t.r * 2}" height="${t.r * 1.4}" rx="${t.r * .15}" fill="${t.color}" stroke="${edge}" stroke-width="${dead ? 3 : 1}" vector-effect="non-scaling-stroke"/><circle cx="${f.x - t.r * .3}" cy="${f.y}" r="${t.r * .25}" fill="#4E3B26"/>`;
  } else if(t.look === "vfeed"){
    // a little hopper with a hatch
    s += `<circle cx="${f.x}" cy="${f.y}" r="${t.r}" fill="${t.color}" stroke="${edge}" stroke-width="${dead ? 3 : 1}" vector-effect="non-scaling-stroke"/><circle cx="${f.x}" cy="${f.y}" r="${t.r * .35}" fill="#4B4F55"/>`;
  } else if(t.look === "vmist"){
    // a shallow pool under the mister
    s += `<ellipse cx="${f.x}" cy="${f.y}" rx="${t.r}" ry="${t.r * .75}" fill="${t.color}" fill-opacity=".85" stroke="${edge}" stroke-width="${dead ? 3 : 1}" vector-effect="non-scaling-stroke"/><ellipse cx="${f.x - t.r * .3}" cy="${f.y - t.r * .2}" rx="${t.r * .3}" ry="${t.r * .12}" fill="#BFE0EE" fill-opacity=".7"/>`;
  } else if(t.flora && !f.k && PLANT_SPRITES[f.type]) s += plantSpriteSvg(f, {...t, key:f.type}, PLANT_SPRITES[f.type], dead);
  else if(t.flora) s += tilted() && !f.k && (t.look === "conifer" || treeLift(t)) ? tree34(f, t, edge, dead ? 3 : 1) : plantSvg(f, t, edge, dead ? 3 : 1);
  else if(tilted() && !f.k) s += rock34(f, t, rockTone(BIOMES[f.biome] ? f.biome : biome, f.type), edge, dead ? 3 : 1.5);
  else {
    // a lumpy rock with a light and a dark face
    const sd = seedOf(f), tone = rockTone(BIOMES[f.biome] ? f.biome : biome, f.type);
    s += `<path d="${blobPath(f.x, f.y, t.r, sd, true)}" fill="${tone.fill}" fill-opacity=".95" stroke="${edge}" stroke-width="${dead ? 3 : 1.5}" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
    s += `<path d="${blobPath(f.x - t.r * .3, f.y - t.r * .25, t.r * .45, sd + 3, true)}" fill="${tone.light}" fill-opacity=".6"/><path d="${blobPath(f.x + t.r * .35, f.y + t.r * .3, t.r * .35, sd + 5, true)}" fill="${tone.dark}" fill-opacity=".6"/>`;
  }
  return s + `</g>`;
}
// in the 3/4 view things further north draw first, so a tree in front covers the one behind
const byDepth = list => tilted() ? [...list].sort((a, b) => a.y - b.y) : list;
// SVG for one exhibit's water, rocks, groves and shelters. When bulldozing they can be picked out one by one.
function landSvg(e, pick, isDead){
  const feats = byDepth(landOf(e)).map(f => featSvg(f, biomeOf(e), pick, isDead)).join("");
  // in the 3/4 view the features go in their own group, where map.js slots the animals in among them by depth (place34)
  return waterOf(e).map(w => waterSvg(w, pick, isDead)).join("") + (tilted() ? `<g data-z34="${esc(e.id)}">${feats}</g>` : feats);
}
// Out in the park: water goes under everything, plants, rocks and statues over the paths
const parkWaterSvg = (pick, isDead) => parkWater().map(w => waterSvg(w, pick, isDead)).join("");
const decorSvg = (pick, isDead) => byDepth(decorOf()).map(f => featSvg(f, parkBiome(), pick, isDead)).join("");
// A hedge: a dark base, the leafy body, and lighter clumps along the top (in meters, so it's as wide as a real hedge)
const hedgeSvg = (tag, pts) => { const lj = `fill="none" stroke-linejoin="round" stroke-linecap="round" pointer-events="none"`; return `<${tag} points="${pts}" stroke="#24461F" stroke-width="2.6" ${lj}/><${tag} points="${pts}" stroke="#4E8A3E" stroke-width="2" ${lj}/><${tag} points="${pts}" stroke="#6BA851" stroke-width="1.2" stroke-dasharray="0 1.6" ${lj}/>`; };
// An open fence line: a hedge, or a rail with posts in the fence's color
function fenceLineSvg(l, on, dead){
  const pts = polyStr(l.points), B = BARRIERS[l.barrier] || BARRIERS.wood, ns = `fill="none" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"`;
  let s = `<g data-kind="fence" data-id="${esc(l.id)}" style="cursor:pointer">`;
  if(on || dead) s += `<polyline points="${pts}" stroke="${dead ? "var(--bad)" : "var(--sel)"}" stroke-width="${B.hedge ? 3.6 : 1.6}" fill="none" stroke-linejoin="round" stroke-linecap="round"/>`;
  if(tilted()) s += fence34(l.points, false, B.hedge ? "hedge" : l.barrier || "wood", "all", {hi:dead ? "var(--bad)" : on ? "var(--sel)" : null});
  else if(B.hedge) s += hedgeSvg("polyline", pts);
  else s += `<polyline points="${pts}" stroke="${B.color}" stroke-width="2.2" ${ns}/><polyline points="${pts}" stroke="${B.color}" stroke-width="5" stroke-dasharray="0 16" ${ns}/>`;
  return s + `<polyline points="${pts}" stroke="transparent" stroke-width="4" fill="none"/></g>`;
}
