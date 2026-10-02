/* =====================================================================
   LANDSCAPE
   Water, rocks, groves and shelters inside open exhibits. Water is
   drawn corner by corner like an exhibit (e.water); the rest are placed
   with a tap (e.land). Animals like some of each, and water lovers get
   unhappy and sickly without any water.
   Groves from an animal's own era make it happier and feed part of its
   diet, and older groves (grown from CERES planting stock) keep old
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

const landM2 = f => Math.PI * LAND[f.type].r ** 2;
// How much of the exhibit is water, rock, and groves from each era: 0 to 1 each, where 1 satisfies the animals that like it
function habitatOf(e){
  const a = area(e.points) || 1, land = landOf(e).filter(f => LAND[f.type]);
  const wet = waterOf(e).reduce((n, w) => n + area(w.points), 0);
  const cover = land.reduce((n, f) => n + (LAND[f.type].cover || 0), 0);
  const grove = {}, groveM2 = {};
  for(const era of Object.keys(FLORA)){
    groveM2[era] = land.reduce((n, f) => n + (LAND[f.type].flora === era ? landM2(f) : 0), 0);
    grove[era] = clamp(groveM2[era] / a / HAB.groveFull, 0, 1);
  }
  const old = clamp((groveM2.mesozoic + groveM2.paleozoic) / a / HAB.groveFull, 0, 1);
  return {waterM2:wet, waterShare:wet / a, wet:clamp(wet / a / HAB.waterFull, 0, 1), rock:clamp(cover / (a / HAB.rockEvery), 0, 1), grove, groveM2, old};
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
  if(dry.length){ out.delta -= HAB.dry; out.issues.push({bad:true, text:`Dry. ${dry.join(", ")} ${dry.length === 1 ? "needs" : "need"} water. Draw some in the exhibit.`}); }
  if(sat > 0){
    out.delta += HAB.bonus * sat;
    out.issues.push({bad:false, text:sat >= .6 ? "Water and rocks make it feel like home." : "Some water and rocks. More would make them feel more at home."});
  }
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

/* ---------- rocks, groves and shelters ---------- */
// Why a rock, grove or shelter can't go at (x, y) in this exhibit, or null
function landProblem(e, key, x, y){
  const t = LAND[key];
  if(t.tech && !hasTech(t.tech)) return `Research ${FLORA[t.flora].label} flora at ORACLE first.`;
  if(t.stock && (state.ceres.plants[t.flora] || 0) < t.stock) return `Needs a batch of ${FLORA[t.flora].label} planting stock from CERES, which has ${state.ceres.plants[t.flora] || 0}.`;
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
function placeLand(e, key, x, y){
  const t = LAND[key];
  spend(t.price, "built");
  if(t.stock) state.ceres.plants[t.flora] -= t.stock;
  (e.land = e.land || []).push({id:uid("l-"), type:key, x, y});
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
    const t = LAND[f.type]; if(!t) continue;
    const dead = pick && isDead("land", f.id);
    const edge = dead ? "var(--bad)" : t.flora ? "#1F3A2B" : t.slots ? "#3B3226" : "#4E524C";
    s += `<g${at("land", f.id)}>`;
    if(t.slots){
      // a square roof with a ridge
      const h = t.r * .78;
      s += `<rect x="${f.x - h}" y="${f.y - h}" width="${h * 2}" height="${h * 2}" rx="${h * .12}" fill="${t.color}" stroke="${edge}" stroke-width="${dead ? 3 : 1.5}" vector-effect="non-scaling-stroke"/>`;
      s += `<path d="M${f.x - h} ${f.y}H${f.x + h}" stroke="#3B3226" stroke-opacity=".6" stroke-width="1" vector-effect="non-scaling-stroke"/>`;
    } else if(t.flora){
      // a clump of canopies
      for(const [dx, dy, k] of [[-.35, -.2, .6], [.35, -.25, .55], [0, .3, .6]]) s += `<circle cx="${f.x + dx * t.r}" cy="${f.y + dy * t.r}" r="${t.r * k}" fill="${t.color}" fill-opacity=".9" stroke="${edge}" stroke-width="${dead ? 3 : 1}" vector-effect="non-scaling-stroke"/>`;
      s += `<circle cx="${f.x - t.r * .15}" cy="${f.y - t.r * .1}" r="${t.r * .2}" fill="#fff" fill-opacity=".18"/>`;
    } else {
      s += `<circle cx="${f.x}" cy="${f.y}" r="${t.r}" fill="${t.color}" fill-opacity=".95" stroke="${edge}" stroke-width="${dead ? 3 : 1.5}" vector-effect="non-scaling-stroke"/>`;
      s += `<circle cx="${f.x - t.r * .3}" cy="${f.y - t.r * .25}" r="${t.r * .45}" fill="#B7BBB2" fill-opacity=".6"/><circle cx="${f.x + t.r * .35}" cy="${f.y + t.r * .3}" r="${t.r * .35}" fill="#5F635D" fill-opacity=".6"/>`;
    }
    s += `</g>`;
  }
  return s;
}
