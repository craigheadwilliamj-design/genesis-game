/* =====================================================================
   LANDSCAPE
   Ponds, rocks and groves inside open exhibits (e.land). Animals like
   some of each, and water lovers get unhappy and sickly without a pond.
   Groves from an animal's own era make it happier and feed part of its
   diet, and older groves (grown from CERES planting stock) keep old
   plant-eaters off the grass. Shelters (and groves, for shade) cover
   animals from the weather, which is rolled here each night.
   Placing and drawing them lives in map.js, next to the other tools.
   ===================================================================== */

const landKey = t => typeof t === "string" && t.startsWith("land-") ? t.slice(5) : null;
const landOf = e => e.land || [];
const circlePts = (x, y, r, n = 14) => Array.from({length:n}, (_, i) => [x + r * Math.cos(i * 2 * Math.PI / n), y + r * Math.sin(i * 2 * Math.PI / n)]);
const landRefund = e => Math.round(landOf(e).reduce((n, f) => n + (LAND[f.type] ? LAND[f.type].price : 0), 0) * COST.refundShare);

const landM2 = f => Math.PI * LAND[f.type].r ** 2;
// How much of the exhibit is water, rock, and groves from each era: 0 to 1 each, where 1 satisfies the animals that like it
// The exhibit's biome, and how well it suits one species: "home", "near", "away", or null for animals that don't mind
const biomeOf = e => BIOMES[e.biome] ? e.biome : DEFAULT_BIOME;
function biomeFit(s, b){ const l = biomesOf(s); return !l ? null : l[0] === b ? "home" : l.includes(b) ? "near" : "away"; }
const regradeCost = (e, b) => Math.round(area(e.points) * BIOMES[b].perSqM);
function regradeProblem(e, b){
  if(e.viv) return "Vivariums have no biome.";
  if(!BIOMES[b]) return "Unknown biome.";
  if(biomeOf(e) === b) return `${e.name} is already ${BIOMES[b].label.toLowerCase()}.`;
  return canAfford(regradeCost(e, b)) ? null : `Costs ${money(regradeCost(e, b))}.`;
}
function habitatOf(e){
  const a = area(e.points) || 1, land = landOf(e).filter(f => LAND[f.type]);
  const pond = land.reduce((n, f) => n + (LAND[f.type].water ? landM2(f) : 0), 0);
  const cover = land.reduce((n, f) => n + (LAND[f.type].cover || 0), 0);
  const grove = {}, groveM2 = {};
  for(const era of Object.keys(FLORA)){
    groveM2[era] = land.reduce((n, f) => n + (LAND[f.type].flora === era ? landM2(f) : 0), 0);
    grove[era] = clamp(groveM2[era] / a / HAB.groveFull, 0, 1);
  }
  const old = clamp((groveM2.mesozoic + groveM2.paleozoic) / a / HAB.groveFull, 0, 1);
  return {pond, pondShare:pond / a, wet:clamp(pond / a / HAB.waterFull + (BIOMES[biomeOf(e)].wet || 0), 0, 1), rock:clamp(cover / (a / HAB.rockEvery), 0, 1), grove, groveM2, old};
}
// Grass underfoot: a Cenozoic planting, unless enough older groves give the grazers something else to eat
const grassyFloor = e => (e.flora || "cenozoic") === "cenozoic" && habitatOf(e).old < 1;
// Food units a day the animals browse off groves, for one food type. Older groves give Paleoflora, Cenozoic trees give plants.
function browseRate(e, t){
  if(t !== "plants" && t !== "paleoflora") return 0;
  return landOf(e).reduce((n, f) => { const L = LAND[f.type]; return n + (L && L.browse && (t === "plants") === (L.flora === "cenozoic") ? L.browse : 0); }, 0);
}
// How much of today's eating the groves cover, capped so keepers still bring the rest
const browseShare = (e, t, need) => need > 0 ? Math.min(HAB.browseMax, browseRate(e, t) / need) : 0;
// A water lover with no pond to drink from or wade in
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
function coverOf(e){
  const wk = state.weather ? state.weather.today : "fair", w = WEATHER.kinds[wk];
  let need = 0, shelter = 0, shade = 0;
  for(const a of e.animals){ const s = SPECIES_BY_ID[a.sp]; if(!(wk === "cold" && COLD_HARDY.includes(s.id))) need += coverSlots(s); }
  for(const f of landOf(e)){ const L = LAND[f.type]; if(!L) continue; shelter += L.slots || 0; shade += (L.shade || 0) * w.grove; }
  return {need, shelter, shade, have:shelter + shade};
}
// Share of the herd out in today's weather with no cover: 0 to 1
function exposure(e){
  if(e.viv || !e.animals.length || !weatherNow().happy) return 0;
  const c = coverOf(e);
  return c.need ? clamp(1 - c.have / c.need, 0, 1) : 0;
}
const WEATHER_TEXT = {hot:"no shade. Shelters and groves give shade", cold:"nowhere warm. Shelters keep them warm", storm:"nowhere to shelter. Shelters help most, and groves a little"};

// What the landscaping does to an exhibit's happiness, for exhibitReport
function habitatScore(e){
  const out = {delta:0, issues:[]};
  if(e.viv || !e.animals.length) return out;
  const h = habitatOf(e), dry = [];
  let sat = 0, n = 0;
  for(const [sp, c] of speciesCounts(e)){
    const s = SPECIES_BY_ID[sp], l = likesOf(s);
    sat += c * (l.water * h.wet + l.rock * h.rock) / (l.water + l.rock); n += c;
    if(thirsty(e, s)) dry.push(s.name);
  }
  sat /= n || 1;
  if(dry.length){ out.delta -= HAB.dry; out.issues.push({bad:true, text:`Dry. ${dry.join(", ")} ${dry.length === 1 ? "needs" : "need"} water. Add a pond.`}); }
  if(sat > 0){
    out.delta += HAB.bonus * sat;
    out.issues.push({bad:false, text:sat >= .6 ? "Ponds and rocks make it feel like home." : "Some ponds and rocks. More would make them feel more at home."});
  }
  // the biome: each animal's home ground, the one it gets by in, or neither
  const b = biomeOf(e), fit = {home:[], near:[], away:[]};
  for(const [sp, c] of speciesCounts(e)){ const s = SPECIES_BY_ID[sp], f = biomeFit(s, b); if(f){ out.delta += BIOME_HAPPY[f] * c / n; fit[f].push(s); } }
  const names = l => l.map(s => s.name).join(", "), homes = l => [...new Set(l.map(s => BIOMES[biomesOf(s)[0]].label.toLowerCase()))].join(" or ");
  if(fit.away.length) out.issues.push({bad:true, text:`Wrong biome. ${names(fit.away)} ${fit.away.length === 1 ? "doesn't" : "don't"} belong in ${BIOMES[b].label.toLowerCase()}. ${[...new Set(fit.away.map(s => BIOMES[biomesOf(s)[0]].label))].join(" or ")} would suit ${fit.away.length === 1 ? "it" : "them"}.`});
  if(fit.near.length) out.issues.push({bad:false, text:`${names(fit.near)} ${fit.near.length === 1 ? "gets" : "get"} by in ${BIOMES[b].label.toLowerCase()}, but would rather live in ${homes(fit.near)}.`});
  if(fit.home.length && !fit.away.length && !fit.near.length) out.issues.push({bad:false, text:`At home in the ${BIOMES[b].ground}.`});
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

// Why a pond or rock can't go at (x, y) in this exhibit, or null
function landProblem(e, key, x, y){
  const t = LAND[key];
  if(t.tech && !hasTech(t.tech)) return `Research ${FLORA[t.flora].label} flora at ORACLE first.`;
  if(t.stock && (state.ceres.plants[t.flora] || 0) < t.stock) return `Needs a batch of ${FLORA[t.flora].label} planting stock from CERES, which has ${+(state.ceres.plants[t.flora] || 0).toFixed(2)}.`;
  if(!deepInside(x, y, e.points, t.r)) return "Keep it inside the fence.";
  if(landOf(e).some(f => Math.hypot(f.x - x, f.y - y) < t.r + LAND[f.type].r)) return "It overlaps something already there.";
  const pts = circlePts(x, y, t.r);
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
function placeLand(e, key, x, y){
  const t = LAND[key];
  spend(t.price, "built");
  if(t.stock) state.ceres.plants[t.flora] -= t.stock;
  (e.land = e.land || []).push({id:uid("l-"), type:key, x, y});
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

// SVG for one exhibit's ponds and rocks. When bulldozing they can be picked out one by one.
function landSvg(e, pick, isDead){
  let s = "";
  for(const f of landOf(e)){
    const t = LAND[f.type]; if(!t) continue;
    const dead = pick && isDead(f.id), at = pick ? ` data-kind="land" data-id="${esc(f.id)}" style="cursor:pointer"` : ` pointer-events="none"`;
    const edge = dead ? "var(--bad)" : t.water ? "#2F6F9F" : t.flora ? "#1F3A2B" : t.slots ? "#3B3226" : "#4E524C";
    s += `<g${at}>`;
    if(t.slots){
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
    } else if(!t.water){
      // a lumpy rock with a light and a dark face
      const sd = seedOf(f);
      s += `<path d="${blobPath(f.x, f.y, t.r, sd, true)}" fill="${t.color}" fill-opacity=".95" stroke="${edge}" stroke-width="${dead ? 3 : 1.5}" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
      s += `<path d="${blobPath(f.x - t.r * .3, f.y - t.r * .25, t.r * .45, sd + 3, true)}" fill="#B7BBB2" fill-opacity=".6"/><path d="${blobPath(f.x + t.r * .35, f.y + t.r * .3, t.r * .35, sd + 5, true)}" fill="#5F635D" fill-opacity=".6"/>`;
    } else {
      s += `<circle cx="${f.x}" cy="${f.y}" r="${t.r}" fill="#4C93C9" fill-opacity=".8" stroke="${edge}" stroke-width="${dead ? 3 : 1.5}" vector-effect="non-scaling-stroke"/>`;
      s += `<circle cx="${f.x - t.r * .2}" cy="${f.y - t.r * .2}" r="${t.r * .5}" fill="#7DB6DD" fill-opacity=".5"/>`;
    }
    s += `</g>`;
  }
  return s;
}
