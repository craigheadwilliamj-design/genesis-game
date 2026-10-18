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
// Every fence out in the park that isn't an exhibit's: the old fence lines plus loose grid fence (js/fences.js), as {points, barrier}
const parkFences = () => fenceLines().concat(looseRuns().map(r => ({points:r.pts, barrier:r.b})));
const parkBiome = () => BIOMES[state.biome] ? state.biome : DEFAULT_PARK_BIOME;
// Distance from a point to an open line, and whether two open lines cross or how close they come
const lineDist = (x, y, line) => { let m = Infinity; for(let i = 1; i < line.length; i++) m = Math.min(m, segProj(x, y, line[i-1], line[i]).d); return line.length === 1 ? Math.hypot(x - line[0][0], y - line[0][1]) : m; };
const linesCross = (a, b) => { for(let i = 1; i < a.length; i++) for(let j = 1; j < b.length; j++) if(segCross(a[i-1], a[i], b[j-1], b[j])) return true; return false; };
const lineLineDist = (a, b) => { let m = Infinity; for(let i = 1; i < a.length; i++) for(let j = 1; j < b.length; j++) m = Math.min(m, segSegDist(a[i-1], a[i], b[j-1], b[j])); return m; };
// Statues: a few are open from the start, the rest come with grants
const statueGrant = key => !statuesOn() ? null : GOALS.find(g => g.statue && "st-" + g.statue === key) || null;
const statueOpen = key => { const t = LAND[key]; if(!t || !t.statue) return true; if(!statuesOn()) return false; if(t.free) return true; const g = statueGrant(key); return !!g && state.goalsDone.includes(g.id); };
const statueHint = key => { const g = statueGrant(key); return g ? `Earn it with the grant "${g.text}".` : ""; };
const circlePts = (x, y, r, n = 14) => Array.from({length:n}, (_, i) => [x + r * Math.cos(i * 2 * Math.PI / n), y + r * Math.sin(i * 2 * Math.PI / n)]);
const waterCost = pts => Math.round(area(pts) * WATER.perSqM);
// What bulldozing gets back for everything inside an exhibit
const landRefund = e => Math.round((landOf(e).reduce((n, f) => n + (LAND[f.type] ? LAND[f.type].price : 0), 0) + waterOf(e).reduce((n, w) => n + waterCost(w.points), 0)) * COST.refundShare);

// Mesozoic and Paleozoic plants each use up one plant of their period and size from CERES
const potKey = t => t.tech && t.size ? (t.period || t.flora) + "-" + t.size : null;
const potsHave = t => potKey(t) ? (state.ceres.pots[potKey(t)] || 0) : Infinity;
const potName = t => `${t.period || ERA_LABEL[t.flora]} ${t.size} plants`;

// Footprint: the ground a thing takes up. Plants, rocks and boulders take a SQUARE of whole 1 m cells (FOOT in data.js; footSide, footBox): the side comes from the
// picture's own size (SPRITE_HIT), rounded to meters and held to the kind's range. An odd side is centered on a cell, an even one on a grid corner, so the square always
// covers whole cells. Everything else (barns, trays, toys) keeps a box 2 * footR wide. Crowding, fences, paths, buildings, water, animals and the placement ghost use the
// box; t.r still sizes the drawing and the habitat math, and the tap shape stays the silhouette.
const footR = t => t.fr || t.r;
const ROCK_TYPES = ["rock", "boulder"];
const FOOT_EPS = 1e-4;
const ROCK_SIDE = {rock:{}, boulder:{}};   // type -> biome -> a side per picture, in ROCK_SPRITES order
for(const [k, S] of Object.entries(PLANT_SPRITES)){
  const t = LAND[k], h = SPRITE_HIT[k]; if(!t || !h) continue;
  const mpp = t.r * 2 * (S.size || 1) / h[0], range = FOOT.range[t.size];
  t.footSide = FOOT.side[k] || clamp(Math.round(Math.max(h[2] * mpp * 2, h[3] * mpp * 2 * FOOT.crown)), range[0], range[1]);   // the old whole-cell square: rocks, and where an old save's box stood
  if(FOOT.rect.includes(k)){   // a redrawn plant: its box is its base width, down to the half meter, by a share of it deep
    t.footW = FOOT.side[k] || clamp(Math.floor(h[2] * mpp * 4) / 2, .5, range[1]);
    t.footD = FOOT.side[k] || Math.max(.5, Math.round(t.footW * FOOT.depth * 2) / 2);
  }
}
for(const t of Object.values(LAND)) if(t.flora && !t.footSide) t.footSide = FOOT.plain[t.size] || 2;
for(const type of ROCK_TYPES){
  if(LAND[type]) LAND[type].footSide = FOOT.plain[type];
  for(const [biome, kinds] of Object.entries(ROCK_SPRITES)) ROCK_SIDE[type][biome] = (kinds[type] || []).map((_, i) => {
    const name = `${type}-${biome}-${i + 1}`, h = SPRITE_HIT[name], r = FOOT.range[type];
    return FOOT.side[name] || (h ? clamp(Math.round(h[3] * 2 * ROCK_MPP * FOOT.rockK), r[0], r[1]) : FOOT.plain[type]);
  });
}
// The picture a placed rock shows: its f.pic, else one picked by its id (the same pick rockSpriteSvg makes)
function rockPicIndex(f, biome){ const l = (ROCK_SPRITES[biome] || {})[f.type]; return !l ? null : f.pic != null && f.pic >= 0 && f.pic < l.length ? f.pic : seedOf(f) % l.length; }
// Side in meters of a plant or rock of this kind, given the picture index (rocks) and the biome it is drawn in; other things are 2 * footR wide
function footSideFor(key, pic, biome){
  const t = LAND[key]; if(!t) return 0;
  if(ROCK_TYPES.includes(key)){ const v = pic != null && ((ROCK_SIDE[key] || {})[biome] || [])[pic]; return v || t.footSide; }
  return t.footSide || 2 * footR(t);
}
const footSquare = key => !!LAND[key] && (!!LAND[key].footSide);
// The biome a rock in exhibit e (null: out in the park) is drawn in
const featBiome = (f, e) => BIOMES[f.biome] ? f.biome : e ? biomeOf(e) : parkBiome();
// A plant or rock drawn from a picture stands on its base (the picture's bottom edge is at f.y), so its box runs from there back up the map and the ground in front stays free
const footBased = (key, biome) => !!PLANT_SPRITES[key] || (ROCK_TYPES.includes(key) && !!(ROCK_SPRITES[biome] || {})[key]);
// Width and depth in meters of a thing's box: a pictured plant's base, else a square
const footDims = (key, pic, biome) => { const t = LAND[key]; if(t && t.footW) return [t.footW, t.footD]; const s = footSideFor(key, pic, biome); return [s, s]; };
// A placed thing's box [x0, y0, x1, y1]; e is the exhibit it stands in (null: out in the park)
function footBox(f, e){
  const t = LAND[f.type]; if(!t) return [f.x, f.y, f.x, f.y];
  const k = f.k || 1, rb = ROCK_TYPES.includes(f.type) ? featBiome(f, e) : null;
  return boxFrom(f.x, f.y, footDims(f.type, rb && rockPicIndex(f, rb), rb).map(v => v * k), footBased(f.type, rb));
}
// A box of these meters [width, depth] at (x, y): standing on its base (front edge at y), or centered
const boxFrom = (x, y, [w, d], based) => based ? [x - w / 2, y - d, x + w / 2, y] : [x - w / 2, y - d / 2, x + w / 2, y + d / 2];
// The box a new one of this kind would take at (x, y)
function footBoxAt(key, pic, biome, x, y){ return boxFrom(x, y, footDims(key, pic, biome), footBased(key, biome)); }
// Snap a point so a footprint of this kind covers whole cells: odd sides center on a cell across, even on a grid corner. Down the map the box ends at the point when it stands on a base, so that is a grid line for any side; else it is centered like across. A pictured plant's box snaps to the half meter instead (its edges, not its center). Other things keep the grid corner.
function footSnap(key, pic, biome, x, y){
  if(!footSquare(key)) return [Math.round(x), Math.round(y)];
  if(LAND[key].footW) return [Math.round((x - LAND[key].footW / 2) * 2) / 2 + LAND[key].footW / 2, Math.round(y * 2) / 2];
  const odd = Math.round(footSideFor(key, pic, biome)) % 2;
  return [odd ? Math.floor(x) + .5 : Math.round(x), odd && !footBased(key, biome) ? Math.floor(y) + .5 : Math.round(y)];
}
// The ghost's footprint: its square on the grid (plants, rocks), else a ring
function footGhostSvg(g, biome, attrs){
  if(!footSquare(g.key)) return `<circle cx="${g.x}" cy="${g.y}" r="${footR(LAND[g.key])}" fill="none" ${attrs}/>`;
  const b = footBoxAt(g.key, g.pic, biome, g.x, g.y);
  return `<rect x="${b[0]}" y="${b[1]}" width="${b[2] - b[0]}" height="${b[3] - b[1]}" fill="${g.ok ? "var(--sel)" : "var(--bad)"}" fill-opacity=".12" ${attrs}/>`;
}
const boxPts = b => [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]];
const shrinkBox = b => [b[0] + FOOT_EPS, b[1] + FOOT_EPS, b[2] - FOOT_EPS, b[3] - FOOT_EPS];
// Old saves: snap every plant and rock to its square (odd sides on a cell center, even on a grid corner), and where two squares now overlap nudge one by up to a cell,
// preferring spots still inside its fence. Nothing is ever removed, and a thing already on a square stays put, so this is safe to run on every load.
function snapFootprints(s){
  const homeBiome = e => e ? (BIOMES[e.biome] ? e.biome : DEFAULT_BIOME) : (BIOMES[s.biome] ? s.biome : DEFAULT_PARK_BIOME);
  const groups = s.exhibits.filter(e => !e.viv && e.land).map(e => [e, e.land]).concat([[null, s.decor || []]]);
  const offs = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
  for(const [e, list] of groups){
    const items = list.filter(f => LAND[f.type]);
    const rockOf = f => ROCK_TYPES.includes(f.type), biomeOfF = f => BIOMES[f.biome] ? f.biome : homeBiome(e);
    const picOf = f => rockOf(f) ? rockPicIndex(f, biomeOfF(f)) : null;
    const boxAt = (f, x, y) => footBoxAt(f.type, picOf(f), biomeOfF(f), x, y);
    // saves from before boxes stood on their base: slide each picture down to the bottom of its old box, so every box stays exactly where it was
    if(!s.footBase) for(const f of items) if(footSquare(f.type) && footBased(f.type, rockOf(f) ? biomeOfF(f) : null)) f.y += footSideFor(f.type, picOf(f), biomeOfF(f)) * (f.k || 1) / 2;
    for(const f of items) if(footSquare(f.type)){ [f.x, f.y] = footSnap(f.type, picOf(f), biomeOfF(f), f.x, f.y); }
    const placed = items.filter(f => !footSquare(f.type)).map(f => boxAt(f, f.x, f.y));
    for(const f of items.filter(f => footSquare(f.type))){
      const free = (b, inside) => !placed.some(o => boxesHit(b, o)) && (!inside || !e || boxInside(b, e.points));
      let at = null;
      for(const inside of [true, false]){ for(const [dx, dy] of offs) if(free(boxAt(f, f.x + dx, f.y + dy), inside)){ at = [f.x + dx, f.y + dy]; break; } if(at) break; }
      if(at){ f.x = at[0]; f.y = at[1]; }
      placed.push(boxAt(f, f.x, f.y));
    }
  }
  s.footBase = 1;
}
// Do two boxes share ground? Touching edges don't count.
const boxesHit = (a, b) => a[0] < b[2] - FOOT_EPS && b[0] < a[2] - FOOT_EPS && a[1] < b[3] - FOOT_EPS && b[1] < a[3] - FOOT_EPS;
function segHitsBox(a, c, b){   // Liang-Barsky: does the segment touch the closed box?
  let t0 = 0, t1 = 1; const dx = c[0] - a[0], dy = c[1] - a[1];
  for(const [p, q] of [[-dx, a[0] - b[0]], [dx, b[2] - a[0]], [-dy, a[1] - b[1]], [dy, b[3] - a[1]]]){
    if(Math.abs(p) < 1e-12){ if(q < 0) return false; continue; }
    const r = q / p;
    if(p < 0){ if(r > t1) return false; if(r > t0) t0 = r; } else { if(r < t0) return false; if(r < t1) t1 = r; }
  }
  return true;
}
const boxPointDist = (b, x, y) => Math.hypot(Math.max(b[0] - x, 0, x - b[2]), Math.max(b[1] - y, 0, y - b[3]));
function segBoxDist(a, c, b){
  if(segHitsBox(a, c, b)) return 0;
  let d = Math.min(boxPointDist(b, a[0], a[1]), boxPointDist(b, c[0], c[1]));
  for(const p of boxPts(b)) d = Math.min(d, segProj(p[0], p[1], a, c).d);
  return d;
}
// Distance from a box to an open polyline (0 when the line touches it)
function boxLineDist(b, pts){ let d = Infinity; for(let i = 1; i < pts.length; i++) d = Math.min(d, segBoxDist(pts[i-1], pts[i], b)); return d; }
// Does a line come within hw of the box? With no width, it must cross the box's inside: running along its edge is fine.
const lineHitsBox = (b, pts, hw = 0) => hw > 0 ? boxLineDist(b, pts) < hw - FOOT_EPS : boxLineDist(shrinkBox(b), pts) < 1e-9;
// Does the box share ground with the inside of a shape? Touching the outline from outside doesn't count.
function boxHitsPoly(b, pts){
  const s = shrinkBox(b);
  for(let i = 0; i < pts.length; i++) if(segHitsBox(pts[i], pts[(i + 1) % pts.length], s)) return true;
  return inPoly((b[0] + b[2]) / 2, (b[1] + b[3]) / 2, pts);
}
// Is the whole box inside the shape (its edge may run along the outline)?
function boxInside(b, pts){
  const s = shrinkBox(b);
  for(let i = 0; i < pts.length; i++) if(segHitsBox(pts[i], pts[(i + 1) % pts.length], s)) return false;
  return inPoly((b[0] + b[2]) / 2, (b[1] + b[3]) / 2, pts);
}
// Does the box cover any part of a path chunk?
function boxOnChunk(b){
  for(let cx = Math.floor(b[0] / CHUNK); cx * CHUNK < b[2]; cx++) for(let cy = Math.floor(b[1] / CHUNK); cy * CHUNK < b[3]; cy++)
    if(pathKind(cx, cy) && boxesHit(b, [cx * CHUNK, cy * CHUNK, cx * CHUNK + CHUNK, cy * CHUNK + CHUNK])) return true;
  return false;
}
// The shape you tap on a sprite: its silhouette in rows 4 px tall, as one path in the sprite's own box (x, y its top left, k meters a pixel)
const hitBands = new Map();
function spriteHitPath(name, x, y, k){
  let bands = hitBands.get(name); const h = SPRITE_HIT[name]; if(!h) return "";
  if(!bands) hitBands.set(name, bands = h[4].split(",").map(b => b ? b.split("-").map(Number) : null));
  return bands.map((b, i) => b ? `M${(x + b[0] * k).toFixed(2)} ${(y + i * 4 * k).toFixed(2)}h${((b[1] - b[0] + 1) * k).toFixed(2)}v${(4 * k).toFixed(2)}h${(-(b[1] - b[0] + 1) * k).toFixed(2)}z` : "").join("");
}
const landM2 = f => Math.PI * (LAND[f.type].r * (f.k || 1)) ** 2;   // f.k shrinks a vivarium's plants
// The exhibit's biome (vivariums too), and how well it suits one species: "home" (either of its two biomes), "away", or null for animals with no biome
const biomeOf = e => { const b = paintedBiome(e); return BIOMES[b] ? b : DEFAULT_BIOME; };   // open exhibits: the biome with the most ground, painted or not (js/biomepaint.js)
function biomeFit(s, b){ const l = biomesOf(s); return !l ? null : l.includes(b) ? "home" : "away"; }
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
  return {water:waterWant(s), rock:Math.max(1, Math.ceil(a / HAB.rockEvery * HAB.rockBase * B.rock * l.rock / .4)), plants:none ? 0 : Math.round(a * B.plants * (meat ? HAB.meatPlants : 1))};
}
// A plant counts for a species when it's from the animal's own period
// Plants from another biome don't count for anything and make animals unhappy
const plantHere = (t, e) => t.biome === biomeOf(e);
const plantSuits = (t, s) => t.period === s.period;
// What the exhibit has to give: water share (wetland counts for some), rock cover, plant square meters. With a species, its own period's plants count in full and other periods' plants of the biome fill up to HAB.offEra of what it wants.
function haveOf(e, s){
  const a = area(e.points) || 1, land = landOf(e).filter(f => LAND[f.type]);
  let own = 0, off = 0;
  for(const f of land){ const t = LAND[f.type]; if(t.flora && plantHere(t, e)) { if(!s || plantSuits(t, s)) own += landM2(f); else off += landM2(f); } }
  if(s) off = Math.min(off, wantsOf(e, s).plants * HAB.offEra);   // other periods' plants fill at most a share of what it wants
  return {water:(waterOf(e).reduce((n, w) => n + area(w.points), 0) + vivPoolM2(e)) / a + (BIOMES[biomeOf(e)].wet || 0) * HAB.waterFull,
    rock:land.reduce((n, f) => n + (LAND[f.type].cover || 0), 0), plants:Math.round(own + off)};
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
// Vivarium fittings: pools (their water), basking lamps (heat for the ones that want it), and which species want heat
const vivFit = (e, k) => e.viv ? landOf(e).filter(f => LAND[f.type] && LAND[f.type][k]) : [];
const vivPoolM2 = e => vivFit(e, "pool").reduce((n, f) => n + LAND[f.type].poolM2, 0);
const wantsHeat = s => ERA_OF[s.period] !== "cenozoic" && !WARM_BLOODED.includes(s.id);
const heatCount = e => e.animals.filter(a => SPECIES_BY_ID[a.sp] && wantsHeat(SPECIES_BY_ID[a.sp])).length;
// Share of the animals that want heat that the case's lamps cover (VIV_LAMP.per each); 1 when none want it
const heatShare = e => { const n = heatCount(e); return !n ? 1 : clamp(vivFit(e, "lamp").length * VIV_LAMP.per / n, 0, 1); };
// Where an animal in a vivarium likes to be: in the pool (water lovers) or under a lamp (heat lovers), as {x, y, rx, ry} areas in meters
function vivHomes(e, s){
  const out = [];
  if(!e.viv) return out;
  if(likesOf(s).water >= HAB.wantsWater) for(const f of vivFit(e, "pool")) out.push({x:f.x, y:f.y, rx:LAND[f.type].r * .7, ry:LAND[f.type].r * .3, pool:true});
  if(wantsHeat(s)) for(const f of vivFit(e, "lamp")) out.push({x:f.x, y:f.y + .5, rx:VIV_LAMP.radius * .8, ry:VIV_LAMP.radius * .3});
  return out;
}
// The pool an animal at (x, y) is standing in, or null (the water is the pool's inner ellipse, a bit smaller than its rim)
const vivPoolAt = (e, x, y) => vivFit(e, "pool").find(f => { const r = LAND[f.type].r; return ((x - f.x) / (r * .85)) ** 2 + ((y - f.y) / (r * .42)) ** 2 <= 1; }) || null;
// A water lover with no water to drink from or wade in (a vivarium's water is its pools)
const thirsty = (e, s) => likesOf(s).water >= HAB.wantsWater && (e.viv ? vivPoolM2(e) <= 0 : habitatOf(e).wet === 0);

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

// What the exhibit's biome does to happiness: each animal is either on one of its two biomes or not
function biomeScore(e, out, n){
  const b = biomeOf(e), fit = {home:[], away:[]};
  for(const [sp, c] of speciesCounts(e)){ const s = SPECIES_BY_ID[sp], f = biomeFit(s, b); if(f){ out.delta += BIOME_HAPPY[f] * c / n; fit[f].push(s); } }
  const names = l => l.map(s => s.name).join(", ");
  if(fit.away.length) out.issues.push({bad:true, text:`Wrong biome. ${names(fit.away)} ${fit.away.length === 1 ? "doesn't" : "don't"} belong in ${BIOMES[b].label.toLowerCase()}. ${[...new Set(fit.away.flatMap(s => biomesOf(s)).map(k => BIOMES[k].label))].join(" or ")} would suit ${fit.away.length === 1 ? "it" : "them"}.`});
  if(fit.home.length && !fit.away.length) out.issues.push({bad:false, text:`At home in the ${BIOMES[b].ground}.`});
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
    // water lovers want a pool; a basking lamp warms the ones that want heat
    const lovers = [...speciesCounts(e)].filter(([sp]) => likesOf(SPECIES_BY_ID[sp]).water >= HAB.wantsWater);
    if(lovers.length){
      const dry = lovers.filter(([sp]) => thirsty(e, SPECIES_BY_ID[sp]));
      if(dry.length){ out.delta -= HAB.dry; out.issues.push({bad:true, text:`Dry. ${dry.map(([sp]) => SPECIES_BY_ID[sp].name).join(", ")} need${dry.length === 1 ? "s" : ""} a pool to drink from and wade in.`}); }
      else { const fit = lovers.reduce((n, [sp, c]) => n + c * waterFit(haveOf(e, SPECIES_BY_ID[sp]).water, wantsOf(e, SPECIES_BY_ID[sp]).water), 0) / lovers.reduce((n, [, c]) => n + c, 0); out.delta += VIV_POOL.bonus * fit; out.issues.push({bad:fit < .6, text:fit >= .6 ? "A pool to wade in." : "A pool, but not enough water for them. Another would help."}); }
    }
    const heat = heatCount(e);
    if(heat){
      const hs = heatShare(e);
      if(hs > 0){ out.delta += VIV_LAMP.happy * hs; out.issues.push({bad:hs < 1, text:hs >= 1 ? "Warm under the basking lamp." : `Some bask under the lamp, but one lamp warms ${VIV_LAMP.per} animals. Another would help.`}); }
      if(hs < 1){ out.delta -= VIV_LAMP.lack * (1 - hs); if(hs <= 0) out.issues.push({bad:true, text:"Cold. They want a basking lamp to warm up under."}); }
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
    for(let k = 0; k < 8; k++){ const x = a[0] + (b[0] - a[0]) * k / 8, y = a[1] + (b[1] - a[1]) * k / 8; if(!(m > 0 ? inPoly(x, y, fence) && distToEdge(x, y, fence) >= m - .02 : inPoly(x, y, fence) || distToEdge(x, y, fence) < .02)) return false; }   // m 0: the shore may sit right on the fence
  }
  return !fence.some(p => inPoly(p[0], p[1], pts) && distToEdge(p[0], p[1], pts) > .02);
}
// Water drawn as chunk boxes is an axis-aligned rectangle: [x0, y0, x1, y1], else null
function rectOfPts(p){
  if(p.length !== 4) return null;
  const sq = (p[0][0] === p[1][0] && p[1][1] === p[2][1] && p[2][0] === p[3][0] && p[3][1] === p[0][1]) || (p[0][1] === p[1][1] && p[1][0] === p[2][0] && p[2][1] === p[3][1] && p[3][0] === p[0][0]);
  return sq ? [Math.min(p[0][0], p[2][0]), Math.min(p[0][1], p[2][1]), Math.max(p[0][0], p[2][0]), Math.max(p[0][1], p[2][1])] : null;
}
// Do two water shapes overlap? Two rectangles that only share an edge don't.
function waterHit(a, b){
  const ra = rectOfPts(a), rb = rectOfPts(b);
  return ra && rb ? rectOverlap(ra, rb) : shapesOverlap(a, b) || shapesOverlap(b, a);
}
// Join a new rectangle of water to a neighbouring one of the same width or height in the same place, so the shore has no seam
function mergeWater(e, w){
  const list = e ? e.water : state.water;
  for(let again = true; again;){
    again = false;
    const rw = rectOfPts(w.points); if(!rw) return w;
    for(const o of list){
      const ro = o !== w && o.kind === w.kind && rectOfPts(o.points), u = ro && paintUnion(ro, rw); if(!u) continue;
      o.points = [[u[0], u[1]], [u[2], u[1]], [u[2], u[3]], [u[0], u[3]]]; list.splice(list.indexOf(w), 1); w = o; again = true; break;
    }
  }
  return w;
}
// The open exhibit a new body of water starts in (null: out in the park)
const waterHost = pts => pts.length ? state.exhibits.find(e => !e.viv && inPoly(pts[0][0], pts[0][1], e.points)) || null : null;
// Why this water shape won't work in exhibit e (or out in the park, with no e), or null. skip is the water being reshaped; cost is what it would cost now.
// over: laying a new box of water, which may go over water already there (it covers it, like paint).
function waterProblem(pts, e, skip, cost, over){
  if(pts.length < 3) return "Needs at least 3 corners.";
  if(!e) return parkWaterProblem(pts, skip, cost, over);
  if(selfCrosses(pts)) return "The shore crosses itself.";
  if(!insideFence(pts, e.points, WATER.margin)) return "Keep it inside the fence.";
  if(area(pts) < WATER.minArea) return `Too small. Water needs at least ${WATER.minArea} m².`;
  if(!over && waterOf(e).some(w => w !== skip && waterHit(pts, w.points))) return "It overlaps other water.";
  if(landOf(e).some(f => LAND[f.type] && !LAND[f.type].wet && boxHitsPoly(footBox(f, e), pts))) return "It overlaps a rock, grove or shelter.";
  if(state.buildings.some(b => b.exhibitId === e.id && shapesOverlap(pts, b.points))) return "It overlaps a viewing platform.";
  if(e.gate && (inPoly(e.gate[0], e.gate[1], pts) || distToEdge(e.gate[0], e.gate[1], pts) < 3)) return "Keep clear of the gate.";
  if(cost > 0 && !canAfford(cost)) return `Costs ${money(cost)}. You have ${money(state.money)}.`;
  return null;
}
// Water out in the park: clear of exhibits, buildings and paths (a wooden bridge can cross it), and of plants that don't like their feet wet
function parkWaterProblem(pts, skip, cost, over){
  if(selfCrosses(pts)) return "The shore crosses itself.";
  if(!insidePlot(pts, true)) return "Keep it inside the park boundary.";
  if(area(pts) < WATER.minArea) return `Too small. Water needs at least ${WATER.minArea} m².`;
  if(state.exhibits.some(e => shapesOverlap(pts, e.points) || shapesOverlap(e.points, pts))) return "It runs into an exhibit. Draw water for the animals inside the fence.";
  if(state.buildings.some(b => shapesOverlap(pts, b.points) || shapesOverlap(b.points, pts))) return "It runs into a building.";
  if(state.paths.some(p => !isBridge(p) && lineShapeDist(p.points, pts) < halfWidth(p))) return "It runs into a path. Only a wooden bridge can cross water.";
  if(!over && parkWater().some(w => w !== skip && waterHit(pts, w.points))) return "It overlaps other water.";
  if(parkFences().some(l => lineEntersShape(l.points, pts))) return "A fence runs through it.";
  if(decorOf().some(f => LAND[f.type] && !LAND[f.type].wet && boxHitsPoly(footBox(f, null), pts))) return "It runs into a plant, rock or statue. Bulldoze it first.";
  if(inPoly(state.gate[0], state.gate[1], pts) || distToEdge(state.gate[0], state.gate[1], pts) < 9) return "Keep clear of the entrance.";
  if(cost > 0 && !canAfford(cost)) return `Costs ${money(cost)}. You have ${money(state.money)}.`;
  return null;
}
function addWater(e, pts, kind, cost){
  spend(cost === undefined ? waterCost(pts) : cost, "built");
  const w = {id:uid("w-"), points:pts};
  if(kind) w.kind = kind;   // the water's look (a WATER_TEX key); none means the biome it sits in
  if(e) (e.water = e.water || []).push(w); else (state.water = state.water || []).push(w);
  return w;
}
// Water works like ground paint: a new box covers what is under it. Older boxes are cut around it (so boxes never overlap),
// and only the area that wasn't already the same water is paid for. kind undefined = the biome's own water.
const waterList = e => e ? (e.water = e.water || []) : (state.water = state.water || []);
const rectPtsOf = r => [[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]];
function waterNetCost(e, pts, kind){
  const r = rectOfPts(pts); if(!r) return waterCost(pts);
  let same = 0;
  for(const o of waterList(e)){
    const q = rectOfPts(o.points); if(!q || o.kind !== kind) continue;
    same += Math.max(0, Math.min(r[2], q[2]) - Math.max(r[0], q[0])) * Math.max(0, Math.min(r[3], q[3]) - Math.max(r[1], q[1]));
  }
  return Math.round(Math.max(0, area(pts) - same) * WATER.perSqM);
}
// Is every part of this box already that water? (nothing to lay)
function waterCovered(e, pts, kind){ const r = rectOfPts(pts); return !!r && waterNetCost(e, pts, kind) === 0; }
// Cut a box out of the water of host (an exhibit, null: the park). Older boxes are split around it so boxes never overlap.
// Returns the m² of water that went and the pieces that were left of the boxes it touched. Old corner-drawn water is left alone.
function cutWater(host, r){
  const list = waterList(host), left = []; let m2 = 0;
  for(const o of list.slice()){
    const q = rectOfPts(o.points); if(!q || !rectOverlap(q, r)) continue;
    m2 += (Math.min(q[2], r[2]) - Math.max(q[0], r[0])) * (Math.min(q[3], r[3]) - Math.max(q[1], r[1]));
    const y0 = Math.max(q[1], r[1]), y1 = Math.min(q[3], r[3]);
    const top = [q[0], q[1], q[2], Math.max(q[1], r[1])], bottom = [q[0], Math.min(q[3], r[3]), q[2], q[3]];   // above and below the box, full width
    const pieces = [top, bottom, [q[0], y0, Math.max(q[0], r[0]), y1], [Math.min(q[2], r[2]), y0, q[2], y1]].filter(p => p[2] - p[0] > 0 && p[3] - p[1] > 0);
    const at = list.indexOf(o);
    if(!pieces.length){ list.splice(at, 1); continue; }
    o.points = rectPtsOf(pieces[0]); left.push(o);
    const more = pieces.slice(1).map(p => ({id:uid("w-"), points:rectPtsOf(p), ...(o.kind ? {kind:o.kind} : {})}));
    list.splice(at + 1, 0, ...more); left.push(...more);
  }
  return {m2, left};
}
// A chunk box cut to what an exhibit's fence leaves for water: the cells (half a meter across) that sit wholly inside the fence with WATER.margin to spare,
// joined into rectangles. A straight wall gives one box; a slanted one gives steps. Out in the park (no host) the box is kept as it is.
function waterClip(e, r){
  if(!e) return [r.slice()];
  const C = .5, m = WATER.margin - .02, ok = (x, y) => inPoly(x, y, e.points) && distToEdge(x, y, e.points) >= m;
  const nx = Math.round((r[2] - r[0]) / C), ny = Math.round((r[3] - r[1]) / C), done = [], open = new Map();   // open: "x0,x1" -> the box still growing downward
  const pts = Array.from({length:ny + 1}, (_, j) => Array.from({length:nx + 1}, (_, i) => ok(r[0] + i * C, r[1] + j * C)));
  for(let j = 0; j <= ny; j++){
    const runs = [];
    for(let i = 0; j < ny && i < nx; i++){
      if(!(pts[j][i] && pts[j][i + 1] && pts[j + 1][i] && pts[j + 1][i + 1])) continue;
      const t = runs[runs.length - 1]; if(t && t[1] === i) t[1] = i + 1; else runs.push([i, i + 1]);
    }
    const next = new Map();
    for(const [a, b] of runs){ const k = a + "," + b, o = open.get(k); if(o){ o[3] = r[1] + (j + 1) * C; next.set(k, o); open.delete(k); } else next.set(k, [r[0] + a * C, r[1] + j * C, r[0] + b * C, r[1] + (j + 1) * C]); }
    done.push(...open.values()); open.clear(); for(const [k, v] of next) open.set(k, v);
  }
  return done.filter(q => (q[2] - q[0]) * (q[3] - q[1]) >= WATER.minArea);
}
// Old saves: water drawn off the chunk grid becomes whole 5 m chunks. A chunk is kept when the body covers at least half of what the host leaves of it
// (half the chunk in the park; half of the part inside the fence in an exhibit), then cut to the fence like newly laid water. s is the save, so this works before it is loaded.
function snapWaterToGrid(s){
  const C = .5, per = CHUNK / C, joinAll = list => {
    for(let again = true; again;){
      again = false;
      for(const a of list) for(const b of list){
        const ra = a !== b && a.kind === b.kind && rectOfPts(a.points), rb = ra && rectOfPts(b.points), u = rb && paintUnion(ra, rb); if(!u) continue;
        a.points = rectPtsOf(u); list.splice(list.indexOf(b), 1); again = true; break;
      }
    }
  };
  for(const host of [null, ...s.exhibits.filter(e => !e.viv && Array.isArray(e.water))]){
    const old = host ? host.water : s.water; if(!old.length) continue;
    const chunks = new Map();
    for(const w of old){
      const xs = w.points.map(p => p[0]), ys = w.points.map(p => p[1]);
      for(let cx = Math.floor(Math.min(...xs) / CHUNK); cx * CHUNK < Math.max(...xs); cx++) for(let cy = Math.floor(Math.min(...ys) / CHUNK); cy * CHUNK < Math.max(...ys); cy++){
        let den = 0, num = 0;
        for(let i = 0; i < per; i++) for(let j = 0; j < per; j++){
          const x = cx * CHUNK + (i + .5) * C, y = cy * CHUNK + (j + .5) * C;
          if(host && !inPoly(x, y, host.points)) continue;
          den++; if(inPoly(x, y, w.points)) num++;
        }
        if(den && num * 2 >= den) chunks.set(cx + "," + cy, {cx, cy, kind:w.kind});
      }
    }
    const fresh = [];
    for(const {cx, cy, kind} of chunks.values()) for(const q of waterClip(host, [cx * CHUNK, cy * CHUNK, (cx + 1) * CHUNK, (cy + 1) * CHUNK])) fresh.push({id:uid("w-"), points:rectPtsOf(q), ...(kind ? {kind} : {})});
    joinAll(fresh);
    if(host) host.water = fresh; else s.water = fresh;
  }
}
function layWater(e, pts, kind){
  const r = rectOfPts(pts), cost = waterNetCost(e, pts, kind);
  if(r) cutWater(e, r);
  return mergeWater(e, addWater(e, pts, kind, cost));
}
// Painting ground over water takes it away, in the park and in every exhibit. The refund is the build price at refundShare.
const waterHosts = () => [null, ...state.exhibits.filter(e => waterOf(e).length)];
function waterCutM2(r){
  let m2 = 0;
  for(const h of waterHosts()) for(const o of waterOf(h || state)){ const q = rectOfPts(o.points); if(q && rectOverlap(q, r)) m2 += (Math.min(q[2], r[2]) - Math.max(q[0], r[0])) * (Math.min(q[3], r[3]) - Math.max(q[1], r[1])); }
  return m2;
}
const waterCutRefund = m2 => Math.round(m2 * WATER.perSqM * COST.refundShare);
// Cut the box out of all water, join what is left, pay the refund. Returns {m2, refund}.
function cutWaterAll(r){
  let m2 = 0;
  for(const h of waterHosts()){ const c = cutWater(h, r); m2 += c.m2; for(const w of c.left) if(waterList(h).includes(w)) mergeWater(h, w); }
  const refund = waterCutRefund(m2);
  if(refund) earn(refund, "sold");
  return {m2, refund};
}
const waterById = id => { for(const e of state.exhibits) for(const w of waterOf(e)) if(w.id === id) return {e, w}; const w = parkWater().find(x => x.id === id); return w ? {e:null, w} : null; };

/* ---------- the park's grounds: what new paths, buildings and exhibits must keep clear of ---------- */
// For an exhibit or building outline: water, plants, rocks and statues, and open fences
function shapeHitsLandscape(pts){
  if(parkWater().some(w => shapesOverlap(pts, w.points) || shapesOverlap(w.points, pts))) return "It's in the water.";
  if(decorOf().some(f => LAND[f.type] && boxHitsPoly(footBox(f, null), pts))) return "It runs into a plant, rock or statue. Bulldoze it first.";
  if(parkFences().some(l => lineEntersShape(l.points, pts))) return "A fence runs through it.";
  return null;
}
// For a path hw meters either side of its line. Only a bridge crosses water.
function lineHitsLandscape(pts, hw, bridge){
  if(!bridge && parkWater().some(w => lineShapeDist(pts, w.points) < hw)) return "Paths can't cross water. Draw a wooden bridge over it.";
  if(decorOf().some(f => LAND[f.type] && lineHitsBox(footBox(f, null), pts, hw))) return "It runs into a plant, rock or statue. Bulldoze it first.";
  if(parkFences().some(l => linesCross(l.points, pts) || lineLineDist(l.points, pts) < hw - .3)) return "It runs into a fence.";
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
  if(decorOf().some(f => LAND[f.type] && lineHitsBox(footBox(f, null), pts))) return "It runs into a plant, rock or statue.";
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
  for(const l of parkFences()){
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
// Where a case's free starter dish goes (old saves): the first free spot, else the middle
const vivSlot = e => vivPlantSpot(e, "vdish") || centroid(e.points);
function addVivToy(e, key){
  const [x, y] = vivPlantSpot(e, key), t = LAND[key];
  spend(t.price, "built");
  const f = {id:uid("l-"), type:key, x, y};
  if(t.tray) f.cap = VIV_DISH.cap[e.viv];   // a dish is sized by its case
  (e.land = e.land || []).push(f);
  regatherViv(e);
}
// A lamp or pool came or went: the animals find their spots again, so they gather where they like to be
function regatherViv(e){ if(typeof herd !== "undefined") for(const h of herd.values()) if(h.exhibitId === e.id) h.placed = false; }

/* ---------- rocks, groves and shelters ---------- */
// Why a rock, grove or shelter can't go at (x, y) in this exhibit, or null
function landProblem(e, key, x, y, pic, biome){
  const t = LAND[key];
  if(t.statue) return "Statues go out in the park, where guests can see them. Place it outside the exhibits.";
  if(t.vivToy) return `${t.label} only goes in a vivarium.`;
  if(t.tech && !hasTech(t.tech)) return t.flora ? `Research ${FLORA[t.flora].label} flora at ORACLE first.` : `Research ${(TECH.find(x => x.id === t.tech) || {label:"it"}).label} at ORACLE first.`;
  if(potKey(t) && potsHave(t) < 1) return `Needs ${potName(t)} from CERES, which has none.`;
  if(t.ceres && state.ceres.stock < t.ceres) return `Takes ${t.ceres} Paleoflora from CERES, which has ${Math.floor(state.ceres.stock)}.`;
  const why = landFit(e, key, x, y, pic, biome);
  if(why) return why;
  if(!canAfford(t.price)) return `Costs ${money(t.price)}. You have ${money(state.money)}.`;
  return null;
}
// Whether the thing fits at (x, y) in this open exhibit, ignoring price and research; `skip` is an item being moved, which doesn't block itself
function landFit(e, key, x, y, pic, biome, skip){
  const t = LAND[key];
  if(t.statue) return "Statues go out in the park, where guests can see them. Place it outside the exhibits.";
  if(t.vivToy) return `${t.label} only goes in a vivarium.`;
  const box = footBoxAt(key, pic, biome || (ROCK_TYPES.includes(key) ? biomeOf(e) : null), x, y);
  if(!boxInside(box, e.points)) return "Keep it inside the fence.";
  if(landOf(e).some(f => f !== skip && LAND[f.type] && boxesHit(box, footBox(f, e)))) return "It overlaps something already there.";
  if(!t.wet && waterOf(e).some(w => boxHitsPoly(box, w.points))) return "It's in the water.";
  if(t.aquatic && !waterOf(e).some(w => inPoly(x, y, w.points))) return `${t.label} only grows in water. Place it in the exhibit's water.`;
  if(state.buildings.some(b => b.exhibitId === e.id && boxHitsPoly(box, b.points))) return "It overlaps a viewing platform.";
  if(e.gate && boxPointDist(box, e.gate[0], e.gate[1]) < 3) return "Keep clear of the gate.";
  if(t.screen && distToEdge(x, y, e.points) > SCREEN.fenceReach) return `A privacy screen goes within ${SCREEN.fenceReach} m of the fence, between the animals and the path.`;
  return null;
}
// What's under the pointer: the open exhibit it's in (null out in the park), and whether the feature fits there
// (x, y) is the pointer's spot on the grid; it is snapped here so the footprint covers whole cells (footSnap)
function landSpot(x, y, key){
  if(state.exhibits.some(o => o.viv && inPoly(x, y, o.points))) return {e:null, x, y, ok:false, why:"Plant a vivarium from its own panel."};
  const e = state.exhibits.find(o => !o.viv && inPoly(x, y, o.points));
  const rock = ROCK_TYPES.includes(key), biome = rock ? (typeof rockBiome !== "undefined" && rockBiome) || (e ? biomeOf(e) : parkBiome()) : null;
  const pic = rock ? rockPicFor(key, biome) : null;
  [x, y] = footSnap(key, pic, biome, x, y);
  const why = e ? landProblem(e, key, x, y, pic, biome) : decorProblem(key, x, y, pic, biome);
  return {e, x, y, ok:!why, why, pic};
}
// Why a plant, rock or statue can't go at (x, y) out in the park, or null
function decorProblem(key, x, y, pic, biome){
  const t = LAND[key];
  if(t.vivToy) return `${t.label} only goes in a vivarium.`;
  if(t.slots || t.tray || t.toy || t.toyFor || t.screen) return "Habitat props go inside an open exhibit.";
  if(t.statue && !statueOpen(key)) return statuesOn() ? `${t.label} is locked. ${statueHint(key)}` : "Statues aren't available yet.";
  if(t.flora && t.period !== "Quaternary" && !hasTech("sterile")) return "Only modern plants grow outside the exhibits. Research sterile prehistoric plants at ORACLE to plant this one out here.";
  if(t.tech && !hasTech(t.tech)) return `Research ${FLORA[t.flora].label} flora at ORACLE first.`;
  if(potKey(t) && potsHave(t) < 1) return `Needs ${potName(t)} from CERES, which has none.`;
  const why = decorFit(key, x, y, pic, biome);
  if(why) return why;
  if(!canAfford(t.price)) return `Costs ${money(t.price)}. You have ${money(state.money)}.`;
  return null;
}
// Whether the thing fits at (x, y) out in the park, ignoring price and research; `skip` is an item being moved
function decorFit(key, x, y, pic, biome, skip){
  const t = LAND[key];
  if(t.vivToy) return `${t.label} only goes in a vivarium.`;
  if(t.slots || t.tray || t.toy || t.toyFor || t.screen) return "Habitat props go inside an open exhibit.";
  const box = footBoxAt(key, pic, biome || (ROCK_TYPES.includes(key) ? parkBiome() : null), x, y);
  if(!insidePlot(boxPts(box), true)) return "Keep it inside the park boundary.";
  if(state.exhibits.some(o => boxHitsPoly(box, o.points))) return "Keep it clear of exhibit fences.";
  if(state.buildings.some(b => boxHitsPoly(box, b.points))) return "It overlaps a building.";
  if(state.paths.some(p => !p.d && lineHitsBox(box, p.points, halfWidth(p))) || boxOnChunk(box)) return "It's on a path.";
  if(boxPointDist(box, state.gate[0], state.gate[1]) < 9) return "Keep clear of the entrance.";
  if(parkFences().some(l => lineHitsBox(box, l.points))) return "It's on a fence.";
  if(decorOf().some(f => f !== skip && LAND[f.type] && boxesHit(box, footBox(f, null)))) return "It overlaps something already there.";
  const wet = parkWater().find(w => boxHitsPoly(box, w.points));
  if(t.aquatic && !parkWater().some(w => inPoly(x, y, w.points))) return `${t.label} only grows in water. Draw a pond first, then place it in the water.`;
  if(wet && !t.wet) return "It's in the water.";
  return null;
}
// Moving a land item: where the pointer's (wx, wy) puts item m.it, and whether it fits there. The target is the open exhibit under the spot (null: the park);
// a vivarium fitting stays in its own case, and nothing else goes into one.
function landMoveSpot(m, wx, wy){
  const f = m.it, key = f.type, src = m.from, rock = ROCK_TYPES.includes(key);
  const x0 = m.x0 + wx - m.wx, y0 = m.y0 + wy - m.wy;
  const viv = state.exhibits.find(o => o.viv && inPoly(x0, y0, o.points));
  if(src && src.viv){
    const [x, y] = footSnap(key, null, null, x0, y0), r = LAND[key].r * (f.k || 1);
    const why = !deepInside(x, y, src.points, r + .3) ? "Keep it inside the glass." : landOf(src).some(g => g !== f && LAND[g.type] && Math.hypot(g.x - x, g.y - y) < r + LAND[g.type].r * (g.k || 1)) ? "It overlaps something already there." : null;
    return {e:src, x, y, ok:!why, why, key};
  }
  if(viv) return {e:null, x:x0, y:y0, ok:false, why:"Vivarium fittings are set from the vivarium's own panel.", key};
  const e = state.exhibits.find(o => !o.viv && inPoly(x0, y0, o.points)) || null;
  const biome = rock ? (BIOMES[f.biome] ? f.biome : src ? biomeOf(src) : parkBiome()) : null;
  const pic = rock ? rockPicIndex(f, biome) : null;
  const [x, y] = footSnap(key, pic, biome, x0, y0);
  const why = e ? landFit(e, key, x, y, pic, biome, f) : decorFit(key, x, y, pic, biome, f);
  return {e, x, y, ok:!why, why, key, pic};
}
function placeLand(e, key, x, y, biome, pic){
  const t = LAND[key];
  spend(t.price, "built");
  if(potKey(t)) state.ceres.pots[potKey(t)] -= 1;
  if(t.ceres) state.ceres.stock = Math.max(0, state.ceres.stock - t.ceres);
  const f = {id:uid("l-"), type:key, x, y};
  if(biome && !t.flora && !t.slots && !t.tray && !t.statue) f.biome = biome;   // a rock keeps the stone color of the biome it was bought under
  if(pic != null && ROCK_SPRITES[biome || (e ? biomeOf(e) : parkBiome())] && (ROCK_SPRITES[biome || (e ? biomeOf(e) : parkBiome())][key] || [])[pic]) f.pic = pic;   // a chosen rock shape; none means random by id
  if(e){ (e.land = e.land || []).push(f); return f; }
  // a statue's plinth is paved in the theme where it stands (its zone's, or the brush)
  if(t.statue && devMode()){ const z = themedZoneAt({points:[[x, y]]}), k = z ? z.theme : state.themes && state.themes.brush; if(k && k !== "genesis" && THEMES[k] && themeHave(k)) f.theme = k; }
  (state.decor = state.decor || []).push(f);
  return f;
}

// Rocks and plants are drawn as lumpy blobs, shaped from the feature's id so each keeps its look. They stay inside their radius.
const seedOf = f => { let h = 2166136261; for(const c of String(f.id || f.x + "," + f.y)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
function rngOf(seed){ return () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
// Closed outline around (x, y) within radius r. Sharp = straight edges (rock), otherwise smoothed (leaves).
// the corner points of a lumpy blob outline (blobPath draws them, and the guests' cover test reads the same ones)
function blobPts(x, y, r, seed, sharp){
  const rnd = rngOf(seed), n = sharp ? 6 + Math.floor(rnd() * 3) : 7 + Math.floor(rnd() * 3), a0 = rnd() * 6.283;
  return Array.from({length:n}, (_, i) => { const a = a0 + i * 6.283 / n + (rnd() - .5) * .5, k = r * (sharp ? .62 + rnd() * .38 : .68 + rnd() * .32); return [x + k * Math.cos(a), y + k * Math.sin(a)]; });
}
function blobPath(x, y, r, seed, sharp){
  const p = blobPts(x, y, r, seed, sharp), n = p.length;
  if(sharp) return "M" + p.map(q => q[0].toFixed(2) + " " + q[1].toFixed(2)).join("L") + "Z";
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], m0 = mid(p[n - 1], p[0]);
  let d = `M${m0[0].toFixed(2)} ${m0[1].toFixed(2)}`;
  for(let i = 0; i < n; i++){ const m = mid(p[i], p[(i + 1) % n]); d += `Q${p[i][0].toFixed(2)} ${p[i][1].toFixed(2)} ${m[0].toFixed(2)} ${m[1].toFixed(2)}`; }
  return d + "Z";
}

// Hit area for bulldozing: each piece can be picked out one by one
const pickAt = (pick, kind, id) => pick ? ` data-kind="${kind}" data-id="${esc(id)}" style="cursor:pointer"` : ` pointer-events="none"`;
// One body of water, in an exhibit or out in the park
// Biomes whose water is drawn from a pixel tile (sprites/water/<biome>.png, the #w-<biome> pattern in index.html); the rest are flat blue
// per biome, the bank colors: damp ground around the shore, the band of mud (or salt crust) next to the water, and the lit and dark shallows rims. A biome with `shore` draws that one color
// on all four edges instead of the lit and dark rims (`shoreW` px wide, default 1), and with no `damp` or `mud` has no bank
const WATER_TEX = {
  wetland:  {shore:"#827B24", shoreW:2, lit:"#7FAA9C", dark:"#4A7872"},   // shore: the 1 px line on every edge that touches land (the north, south, east and west tiles); no mud or damp bank
  scrubland:{damp:"#A8935A", mud:"#D9D0AE", lit:"#B4B8A0", dark:"#6C7358"},
  fern:     {shore:"#988B4A", shoreW:1, lit:"#B4B8A0", dark:"#6C7358"},   // a 1 px shore line, no bank
  temperate:{damp:"#6A9558", mud:"#5E563A", lit:"#7DB6B0", dark:"#3E7480"},
  desert:   {damp:"#CDB178", mud:"#B89A60", lit:"#7CCFC0", dark:"#2C7C86"},
  grassland:{damp:"#A6B364", mud:"#8A7A4C", lit:"#78B49A", dark:"#2E6A64"},
  tropical: {damp:"#0A3A14", mud:"#4A3520", lit:"#3FC2A8", dark:"#0A5A5C"},
  tundra:   {damp:"#C6CFBD", mud:"#E6EEEE", lit:"#9CD0DC", dark:"#4A8294"},
  boreal:   {damp:"#4A6A52", mud:"#3A3830", lit:"#A8C6C8", dark:"#2A4854"},
};
// A textured body of water is cut to the pixel grid (ROCK_MPP meters a pixel, the same as the tiles), so its shore is stair-stepped: one rect per run of cells whose
// centers are inside the shape, a rim of shallows one pixel wide inside it (lighter on the top and left, deeper on the bottom and right) and a wet-mud bank outside it, cached by shape.
// polys is every body of water that shares a shore (all of an exhibit's, or all of the park's): their runs are joined row by row, so shapes that touch or overlap
// become one lake with a single shoreline and no wall between them.
const waterMasks = new Map();
// items are the textured boxes {points, kind}; each kind (a WATER_TEX key) is drawn in its own texture. Boxes of one kind that touch are joined row by row,
// and the shoreline (lit and dark rims, mud and damp banks) is cut against ALL the water, so water touching water of any kind has no border between it.
// Returns {kinds, by:{kind:{body, lit, dark, mud, damp}}}.
// Soften the shore of the kinds that have `shore` (wetland, fern): the row runs are cut on the pixel grid, then the pixels next to land are eroded by 0, 1 or 2 px by smooth noise
// of the world position (so the edge stair-steps in short runs, and the same shape always gives the same edge), and the sharp convex corners are chipped twice.
// Only pixels of those kinds are removed, and only ever pixels touching land (not water of another kind), so nothing opens up inside a lake or between bodies.
const SHORE_NOISE = 5, SHORE_ERODE = [.5, .85], SHORE_CHIP = 2;   // lattice px; the share of shore at 0 and at 0 or 1 px of erosion; passes of corner chipping
// Returns {kind: rows} of the shore band for each such kind: its pixels within `shoreW` of land, which waterMask draws in the shore color.
function softenShore(rowsOf, kinds, r0, r1){
  const wob = kinds.filter(k => WATER_TEX[k] && WATER_TEX[k].shore), bands = {}; if(!wob.length) return bands;
  let c0 = Infinity, c1 = -Infinity;
  for(const k of kinds) for(const runs of rowsOf[k].values()) for(const [a, b] of runs){ c0 = Math.min(c0, a); c1 = Math.max(c1, b); }
  if(c0 > c1) return bands;
  const pad = 4, X0 = c0 - pad, Y0 = r0 - pad, w = c1 - c0 + pad * 2, h = r1 - r0 + 1 + pad * 2, at = (c, r) => (r - Y0) * w + (c - X0);
  const A = new Uint8Array(w * h), own = {};
  for(const k of kinds){ const mine = wob.includes(k); if(mine) own[k] = new Uint8Array(w * h);
    for(const [r, runs] of rowsOf[k]) for(const [a, b] of runs) for(let c = a; c < b; c++){ A[at(c, r)] = 1; if(mine) own[k][at(c, r)] = 1; } }
  const inner = G => { const o = new Uint8Array(w * h); for(let r = 1; r < h - 1; r++) for(let c = 1; c < w - 1; c++){ const i = r * w + c; o[i] = G[i] && G[i - 1] && G[i + 1] && G[i - w] && G[i + w] ? 1 : 0; } return o; };
  const mineAt = i => wob.some(k => own[k][i]), D1 = inner(A), D2 = inner(D1);
  const lat = (u, v) => (cellHash(u + 7001, v + 913) >>> 8) / 16777216;
  const noise = (c, r) => { const S = SHORE_NOISE, u = Math.floor(c / S), v = Math.floor(r / S), fx = c / S - u, fy = r / S - v, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    return (lat(u, v) * (1 - sx) + lat(u + 1, v) * sx) * (1 - sy) + (lat(u, v + 1) * (1 - sx) + lat(u + 1, v + 1) * sx) * sy; };
  const gone = new Uint8Array(w * h);
  for(let r = 1; r < h - 1; r++) for(let c = 1; c < w - 1; c++){
    const i = r * w + c; if(!A[i] || !mineAt(i)) continue;
    const depth = !D1[i] ? 0 : !D2[i] ? 1 : 2, v = noise(c + X0, r + Y0), n = v < SHORE_ERODE[0] ? 0 : v < SHORE_ERODE[1] ? 1 : 2;
    if(depth < n) gone[i] = 1;
  }
  for(let i = 0; i < A.length; i++) if(gone[i]) A[i] = 0;
  for(let pass = 0; pass < SHORE_CHIP; pass++){
    const chip = [];
    for(let r = 1; r < h - 1; r++) for(let c = 1; c < w - 1; c++){
      const i = r * w + c; if(!A[i] || !mineAt(i)) continue;
      const n = !A[i - w], s = !A[i + w], e = !A[i + 1], ww = !A[i - 1];
      if((n || s) && (e || ww)) chip.push(i);
    }
    for(const i of chip) A[i] = 0;
  }
  for(const k of wob){
    const G = own[k];
    for(let r = r0; r <= r1; r++){
      const runs = []; let a = null;
      for(let c = X0; c <= X0 + w; c++){
        const on = c < X0 + w && G[at(c, r)] && A[at(c, r)];
        if(on && a === null) a = c; else if(!on && a !== null){ runs.push([a, c]); a = null; }
      }
      rowsOf[k].set(r, runs);
    }
    const W = WATER_TEX[k].shoreW || 1; let E = A; for(let j = 0; j < W; j++) E = inner(E);
    const band = new Map();
    for(let r = r0; r <= r1; r++){
      const runs = []; let a = null;
      for(let c = X0; c <= X0 + w; c++){
        const i = c < X0 + w ? at(c, r) : 0, on = c < X0 + w && G[i] && A[i] && !E[i];
        if(on && a === null) a = c; else if(!on && a !== null){ runs.push([a, c]); a = null; }
      }
      band.set(r, runs);
    }
    bands[k] = band;
  }
  return bands;
}
function waterMask(items){
  const key = items.map(it => it.kind + ":" + it.points.map(p => p[0].toFixed(2) + "," + p[1].toFixed(2)).join(" ")).join("|"); let m = waterMasks.get(key); if(m) return m;
  const P = ROCK_MPP, ys = items.flatMap(it => it.points.map(p => p[1])), r0 = Math.floor(Math.min(...ys) / P), r1 = Math.ceil(Math.max(...ys) / P);
  const join = runs => { runs.sort((p, q) => p[0] - q[0]); const out = []; for(const s of runs){ const t = out[out.length - 1]; if(t && s[0] <= t[1]) t[1] = Math.max(t[1], s[1]); else out.push([...s]); } return out; };
  const kinds = [...new Set(items.map(it => it.kind))], rowsOf = {}, all = new Map();
  for(const k of kinds){
    const rows = new Map(), polys = items.filter(it => it.kind === k).map(it => it.points);
    for(let r = r0; r <= r1; r++){
      const cy = (r + .5) * P, runs = [];
      for(const points of polys){
        const xs = [];
        for(let i = 0; i < points.length; i++){ const [ax, ay] = points[i], [bx, by] = points[(i + 1) % points.length]; if((ay <= cy) !== (by <= cy)) xs.push(ax + (cy - ay) / (by - ay) * (bx - ax)); }
        xs.sort((p, q) => p - q);
        for(let i = 0; i + 1 < xs.length; i += 2){ const a = Math.ceil(xs[i] / P - .5), b = Math.ceil(xs[i + 1] / P - .5); if(b > a) runs.push([a, b]); }
      }
      rows.set(r, join(runs));
    }
    rowsOf[k] = rows;
  }
  const bands = softenShore(rowsOf, kinds, r0, r1);
  for(let r = r0; r <= r1; r++) all.set(r, join(kinds.flatMap(k => rowsOf[k].get(r).map(s => [...s]))));
  const covered = (r, x) => (all.get(r) || []).some(([a, b]) => x >= a && x < b);
  const minus = (run, others) => { let out = [run]; for(const [oa, ob] of others) out = out.flatMap(([a, b]) => oa >= b || ob <= a ? [[a, b]] : [[a, Math.min(b, oa)], [Math.max(a, ob), b]].filter(([x, y]) => y > x)); return out; };
  const rect = (a, b, r) => `M${(a * P).toFixed(3)} ${(r * P).toFixed(3)}h${((b - a) * P).toFixed(3)}v${P}h${(-(b - a) * P).toFixed(3)}z`;
  const dilate = (rows, d) => { const out = new Map(); for(let r = r0 - d; r <= r1 + d; r++){
    const spans = []; for(let k = r - d; k <= r + d; k++) for(const [a, b] of rows.get(k) || []) spans.push([a - d, b + d]);
    out.set(r, join(spans)); } return out; };
  const paint = map => { let s = ""; for(const [r, runs] of map) for(const [a, b] of runs) s += rect(a, b, r); return s; };
  const by = {};
  for(const k of kinds){
    const rows = rowsOf[k]; let body = "", lit = "", dark = "";
    for(const [r, runs] of rows) for(const [a, b] of runs){
      body += rect(a, b, r);
      if(bands[k]) continue;
      for(const [x, y] of minus([a, b], all.get(r - 1) || [])) lit += rect(x, y, r);    // top edge, only where no water of any kind is above
      for(const [x, y] of minus([a, b], all.get(r + 1) || [])) dark += rect(x, y, r);  // bottom edge, likewise
      if(!covered(r, a - 1)) lit += rect(a, a + 1, r);                                  // left and right ends, only against dry ground
      if(!covered(r, b)) dark += rect(b - 1, b, r);
    }
    if(bands[k]) lit = paint(bands[k]);   // a kind with a shore band draws it, in place of the lit and dark rims
    by[k] = {body, lit, dark, mud:paint(dilate(rows, 2)), damp:paint(dilate(rows, 3))};
  }
  m = {kinds, by}; waterMasks.set(key, m); if(waterMasks.size > 200) waterMasks.delete(waterMasks.keys().next().value);
  return m;
}
// All the water of one exhibit (or of the park). A box's look is its own kind (the water type picked when it was laid), else the biome it sits in.
// Textured water is drawn as ONE body: touching boxes share a shoreline. Water has no hit shape: bulldoze can't take it, painting ground over it does.
function watersSvg(list, biome){
  if(!list.length) return "";
  const items = [], flat = [];
  for(const w of list){ const k = WATER_TEX[w.kind] ? w.kind : WATER_TEX[biome] ? biome : null; if(k) items.push({w, kind:k, points:w.points}); else flat.push(w); }
  let s = flat.map(flatWaterSvg).join("");
  if(!items.length) return s;
  const m = waterMask(items), T = WATER_TEX, layer = (part, fill) => m.kinds.map(k => fill(k) ? `<path d="${m.by[k][part]}" fill="${fill(k)}"/>` : "").join("");
  s += `<g pointer-events="none" shape-rendering="crispEdges">` + layer("damp", k => T[k].damp) + layer("mud", k => T[k].mud) + layer("body", k => `url(#w-${k})`)
    + layer("lit", k => T[k].shore || T[k].lit) + layer("dark", k => T[k].shore || T[k].dark) + `</g>`;
  return s;
}
function flatWaterSvg(w){
  const pts = w.points.map(p => p[0].toFixed(2) + "," + p[1].toFixed(2)).join(" ");
  return `<g pointer-events="none"><polygon points="${pts}" fill="#4C93C9" fill-opacity=".85" stroke="#2F6F9F" stroke-width="1.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`
    + `<polygon points="${pts}" fill="none" stroke="#7DB6DD" stroke-opacity=".7" stroke-width="2.5" stroke-linejoin="round" transform="translate(${centroid(w.points).map(c => c * .12).join(" ")}) scale(.88)"/></g>`;
}
// One body of water, in an exhibit or out in the park
const waterSvg = (w, biome) => watersSvg([w], biome);
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
// The tappable silhouette over a sprite (only when bulldozing can pick it); a doomed one is outlined in red along it
const hitShape = (name, x, y, k, pick, dead) => pick || dead ? `<path d="${spriteHitPath(name, x, y, k)}" fill="${dead ? "var(--bad)" : "none"}" fill-opacity=".25" stroke="${dead ? "var(--bad)" : "none"}" stroke-width="2" vector-effect="non-scaling-stroke"${pick ? ` pointer-events="all"` : ` pointer-events="none"`}/>` : "";
// A plant drawn from its picture (PLANT_SPRITES): a soft shadow, then the sprite standing on the spot, flipped by its seed so a grove isn't copies
function plantSpriteSvg(f, t, S, dead, pick){
  const w = t.r * 2 * (S.size || 1), ht = w / S.ratio, flip = seedOf(f) & 1 ? -1 : 1, up = tilted(), x = f.x - w / 2, y = up ? f.y - ht + ht * .05 : f.y - ht / 2, n2 = v => v.toFixed(2);
  return (up ? `<ellipse cx="${n2(f.x + w * .06)}" cy="${n2(f.y)}" rx="${n2(w * .38)}" ry="${n2(w * .12)}" fill="#1D2B22" fill-opacity=".2"/>` : "")
    + `<g transform="translate(${n2(f.x)} 0) scale(${flip} 1) translate(${n2(-f.x)} 0)"><image href="${spriteUrl(`sprites/plants/${t.key}.png`)}" style="image-rendering:pixelated" pointer-events="none" x="${n2(x)}" y="${n2(y)}" width="${n2(w)}" height="${n2(ht)}"/>${hitShape(t.key, x, y, w / SPRITE_HIT[t.key][0], pick, dead)}</g>`;
}
// A rock or boulder from its picture (ROCK_SPRITES): a soft shadow, then the stone sitting on its spot, one of the biome's shapes picked and flipped by its id
const rockSprites = (f, biome) => (ROCK_SPRITES[BIOMES[f.biome] ? f.biome : biome] || {})[f.type];
// The shape the player picked in the build menu for rocks and boulders (null: random, by id). f.pic on a placed rock is its picture's index; old rocks have none and keep the id-based pick.
const rockPick = {rock:null, boulder:null};
// The biome a rock is being placed under: the biome tab it was picked from, the build menu's biome pick, the exhibit under the cursor, or the park's
let rockBiomeMenu = null;   // stone biome chosen in the build menu's Rock and Boulder pickers (null: the exhibit's, or the park's)
const rockBiomeNow = () => rockBiome || rockBiomeMenu || (landGhost && landGhost.e ? biomeOf(landGhost.e) : parkBiome());
// The picked picture's index for this kind of rock, or null when it's random or the biome has fewer pictures than that
function rockPicOf(type, biome){ const n = rockPick[type], l = (ROCK_SPRITES[biome] || {})[type]; return l && n != null && n < l.length ? n : null; }
// The picture the next rock of this kind gets: the picked one, else one rolled ahead (so the ghost shows what a tap will place, and its footprint is known). Rolled again after each placement.
const rockRoll = {rock:Math.random(), boulder:Math.random()};
function rockPicFor(type, biome){ const n = rockPicOf(type, biome), l = (ROCK_SPRITES[biome] || {})[type]; return n != null ? n : l ? Math.min(l.length - 1, Math.floor(rockRoll[type] * l.length)) : null; }
function rockSpriteSvg(f, list, biome, dead, pick){
  const sd = seedOf(f), i = f.pic != null && f.pic >= 0 && f.pic < list.length ? f.pic : sd % list.length, [pw, ph] = list[i], b = BIOMES[f.biome] ? f.biome : biome, w = pw * ROCK_MPP, ht = ph * ROCK_MPP, flip = sd >> 5 & 1 ? -1 : 1, up = tilted(), x = f.x - w / 2, y = up ? f.y - ht + 4 * ROCK_MPP : f.y - ht / 2, n2 = v => v.toFixed(2);
  return (up ? `<ellipse cx="${n2(f.x + w * .08)}" cy="${n2(f.y + .1)}" rx="${n2(w * .46)}" ry="${n2(w * .13)}" fill="#1D2B22" fill-opacity=".22"/>` : "")
    + `<g transform="translate(${n2(f.x)} 0) scale(${flip} 1) translate(${n2(-f.x)} 0)"><image href="${spriteUrl(`sprites/rocks/${f.type}-${b}-${i + 1}.png`)}" style="image-rendering:pixelated" pointer-events="none" x="${n2(x)}" y="${n2(y)}" width="${n2(w)}" height="${n2(ht)}"/>${hitShape(`${f.type}-${b}-${i + 1}`, x, y, ROCK_MPP, pick, dead)}</g>`;
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
// a privacy screen: a woven reed panel on two posts, flat pixel style (light from the top left: lit left edges, dark gaps between canes, lashings and a shadow under it)
function screen34(f, t, dead){
  const px = ROCK_MPP, q = v => Math.round(v / px + 1e-4) * px, hw = q(t.r * (f.k || 1)), hy = q(2.2 / TILT), x0 = q(f.x - hw), x1 = x0 + hw * 2, yb = q(f.y), yt = yb - hy, n2 = v => v.toFixed(2);
  const R = (a, b, c, d, fill, o) => `<rect x="${n2(a)}" y="${n2(c)}" width="${n2(b - a)}" height="${n2(d - c)}" fill="${fill}"${o ? ` fill-opacity="${o}"` : ""}/>`;
  const reed = ["#A7B461", "#8C9A4B", "#6B7838"], wood = ["#8A6538", "#6A4A2B", "#4A311B"];
  let s = R(x0 + px * 2, x1 + px * 4, yb - px, yb + px * 2, "#1D2B22", ".22");
  for(let x = x0 + px * 2; x + px * 3 <= x1 - px * 2; x += px * 3){ s += R(x, x + px * 2, yt + px * 2, yb, reed[1]) + R(x, x + px, yt + px * 2, yb, reed[0]) + R(x + px * 2, x + px * 3, yt + px * 2, yb, reed[2]); }
  for(const g of [.34, .68]) s += R(x0, x1, q(yb - hy * g), q(yb - hy * g) + px, wood[1]);
  s += R(x0, x1, yt, yt + px * 2, wood[0]) + R(x0, x1, yt + px * 2, yt + px * 3, wood[2]);
  for(const x of [x0, x1 - px * 2]) s += R(x, x + px * 2, yt - px * 2, yb, wood[1]) + R(x, x + px, yt - px * 2, yb, wood[0]) + R(x + px, x + px * 2, yb - px * 2, yb, wood[2]);
  if(dead) s += `<rect x="${n2(x0)}" y="${n2(yt - px * 2)}" width="${n2(hw * 2)}" height="${n2(hy + px * 2)}" fill="none" stroke="var(--bad)" stroke-width="3" vector-effect="non-scaling-stroke"/>`;
  return s;
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
// A vivarium prop from its picture (sprites/viv, tools/pixelviv.py): upright ones stand on their spot, flat ones lie on the floor centered on it. A dish shows what's in it.
function vivPropSvg(f, t){
  const V = VIV_SPRITES[f.type], w = V.w * ROCK_MPP, h = V.h * ROCK_MPP, x = f.x - w / 2, y = V.flat ? f.y - h / 2 : f.y + t.r * .3 - h, n2 = v => v.toFixed(2);
  let s = `<image href="${spriteUrl(`sprites/viv/${f.type}.png`)}" style="image-rendering:pixelated" pointer-events="none" x="${n2(x)}" y="${n2(y)}" width="${n2(w)}" height="${n2(h)}"/>`;
  if(t.tray){
    const cap = trayCap(f), main = Object.entries(f.food || {}).sort((a, b) => b[1] - a[1])[0], fill = main ? clamp(trayHas(f) / cap, .15, 1) : 0;
    if(fill > 0){ const rw = Math.max(2, Math.round(8 * fill)) * ROCK_MPP; s += `<rect x="${n2(f.x - rw / 2)}" y="${n2(y + 2 * ROCK_MPP)}" width="${n2(rw)}" height="${n2(ROCK_MPP * 1.5)}" fill="${FOOD_COLOR[main[0]] || "#999"}" pointer-events="none"/>`; }
  }
  return s;
}
// The warm pool of light under a basking lamp: flat on the floor, under the animals (landSvg)
const lampLightSvg = f => `<g data-y="${f.y - 1001}"><image href="${spriteUrl("sprites/viv/vlamp-pool.png")}" style="image-rendering:pixelated" pointer-events="none" x="${(f.x - 22 * ROCK_MPP).toFixed(2)}" y="${(f.y + .6 - 10 * ROCK_MPP).toFixed(2)}" width="${(44 * ROCK_MPP).toFixed(2)}" height="${(20 * ROCK_MPP).toFixed(2)}"/></g>`;
// One rock, plant, shelter, tray or statue. biome is the ground it stands on (rocks take their stone color from it).
function featSvg(f, biome, pick, isDead){
  let t = LAND[f.type]; if(!t) return "";
  if(f.k) t = {...t, r:t.r * f.k};   // a vivarium's plants are drawn shrunk
  const dead = pick && isDead("land", f.id);
  const edge = dead ? "var(--bad)" : t.flora ? "#1F3A2B" : t.slots ? "#3B3226" : t.tray ? TRAY.color : "#4E524C";
  let s = `<g${pickAt(pick, "land", f.id)}${tilted() ? ` data-y="${t.flat ? f.y - 1000 : f.y}"` : ""}>`;   // flat things (a pool) sort under everything, animals included
  const up = tilted() && !f.k;
  if(VIV_SPRITES[f.type]) s += vivPropSvg(f, t);
  else if(t.statue) s += up ? statue34(f, t, edge, dead) : statueSvg(f, t, edge, dead);
  else if(up && t.look === "burrow") s += rock34(f, {...t, r:t.r * .8}, {fill:t.color, light:mixHex(t.color, "#ffffff", .2), dark:mixHex(t.color, "#000000", .3)}, edge, dead ? 3 : 1.5, true);
  else if(up && t.look === "canopy") s += canopy34(f, t, edge, dead ? 3 : 1.5);
  else if(up && t.slots && !t.look) s += shelter34(f, t, edge, dead ? 3 : 1.5);
  else if(t.screen) s += screen34(f, t, dead);
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
  } else if(t.flora && !f.k && PLANT_SPRITES[f.type]) s += plantSpriteSvg(f, {...t, key:f.type}, PLANT_SPRITES[f.type], dead, pick);
  else if(t.flora) s += tilted() && !f.k && (t.look === "conifer" || treeLift(t)) ? tree34(f, t, edge, dead ? 3 : 1) : plantSvg(f, t, edge, dead ? 3 : 1);
  else if(!f.k && rockSprites(f, biome)) s += rockSpriteSvg(f, rockSprites(f, biome), biome, dead, pick);
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
// SVG for one exhibit's rocks, groves and shelters (its water is drawn by map.js under the fence). When bulldozing they can be picked out one by one.
let openFence34 = new Map();   // open exhibit id -> its loose fence pieces {y, o, svg}, set each render in map.js so they sort among its plants and rocks
function landSvg(e, pick, isDead){
  if(!tilted()) return byDepth(landOf(e)).map(f => featSvg(f, biomeOf(e), pick, isDead)).join("");
  // in the 3/4 view the features and the exhibit's own loose fence go in one group, sorted by depth, where map.js slots the animals in among them (place34)
  const items = landOf(e).flatMap(f => { const t = LAND[f.type]; return t && t.lamp ? [{y:f.y - 1001, o:1, svg:lampLightSvg(f)}, {y:f.y, o:1, svg:featSvg(f, biomeOf(e), pick, isDead)}] : [{y:t && t.flat ? f.y - 1000 : f.y, o:1, svg:featSvg(f, biomeOf(e), pick, isDead)}]; }).concat((openFence34.get(e.id) || []).map(q => ({y:q.y, o:0, svg:`<g data-y="${q.y}">${q.svg}</g>`})));
  items.sort((p, q) => p.y - q.y || p.o - q.o);
  return `<g data-z34="${esc(e.id)}">${items.map(it => it.svg).join("")}</g>`;
}
// Out in the park: water goes under everything, plants, rocks and statues over the paths
const parkWaterSvg = () => watersSvg(parkWater(), parkBiome());
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
