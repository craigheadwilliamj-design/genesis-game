/* =====================================================================
   LANDSCAPE
   Ponds and rocks inside open exhibits (e.land). Animals like some of
   each, and water lovers get unhappy and sickly without a pond.
   Placing and drawing them lives in map.js, next to the other tools.
   ===================================================================== */

const landKey = t => typeof t === "string" && t.startsWith("land-") ? t.slice(5) : null;
const landOf = e => e.land || [];
const circlePts = (x, y, r, n = 14) => Array.from({length:n}, (_, i) => [x + r * Math.cos(i * 2 * Math.PI / n), y + r * Math.sin(i * 2 * Math.PI / n)]);
const landRefund = e => Math.round(landOf(e).reduce((n, f) => n + (LAND[f.type] ? LAND[f.type].price : 0), 0) * COST.refundShare);

// How much of the exhibit is water and rock: 0 to 1 each, where 1 satisfies the animals that like it
function habitatOf(e){
  const a = area(e.points) || 1, land = landOf(e).filter(f => LAND[f.type]);
  const pond = land.reduce((n, f) => n + (LAND[f.type].water ? Math.PI * LAND[f.type].r ** 2 : 0), 0);
  const cover = land.reduce((n, f) => n + (LAND[f.type].cover || 0), 0);
  return {pond, pondShare:pond / a, wet:clamp(pond / a / HAB.waterFull, 0, 1), rock:clamp(cover / (a / HAB.rockEvery), 0, 1)};
}
// A water lover with no pond to drink from or wade in
const thirsty = (e, s) => !e.viv && likesOf(s).water >= HAB.wantsWater && habitatOf(e).wet === 0;

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
  return out;
}

// Why a pond or rock can't go at (x, y) in this exhibit, or null
function landProblem(e, key, x, y){
  const t = LAND[key];
  if(!deepInside(x, y, e.points, t.r)) return "Keep it inside the fence.";
  if(landOf(e).some(f => Math.hypot(f.x - x, f.y - y) < t.r + LAND[f.type].r)) return "It overlaps another pond or rock.";
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
  spend(LAND[key].price, "built");
  (e.land = e.land || []).push({id:uid("l-"), type:key, x, y});
}

// SVG for one exhibit's ponds and rocks. When bulldozing they can be picked out one by one.
function landSvg(e, pick, isDead){
  let s = "";
  for(const f of landOf(e)){
    const t = LAND[f.type]; if(!t) continue;
    const dead = pick && isDead(f.id), at = pick ? ` data-kind="land" data-id="${esc(f.id)}" style="cursor:pointer"` : ` pointer-events="none"`;
    const edge = dead ? "var(--bad)" : t.water ? "#2F6F9F" : "#4E524C";
    s += `<g${at}><circle cx="${f.x}" cy="${f.y}" r="${t.r}" fill="${t.water ? "#4C93C9" : t.color}" fill-opacity="${t.water ? .8 : .95}" stroke="${edge}" stroke-width="${dead ? 3 : 1.5}" vector-effect="non-scaling-stroke"/>`;
    s += t.water ? `<circle cx="${f.x - t.r * .2}" cy="${f.y - t.r * .2}" r="${t.r * .5}" fill="#7DB6DD" fill-opacity=".5"/>`
      : `<circle cx="${f.x - t.r * .3}" cy="${f.y - t.r * .25}" r="${t.r * .45}" fill="#B7BBB2" fill-opacity=".6"/><circle cx="${f.x + t.r * .35}" cy="${f.y + t.r * .3}" r="${t.r * .35}" fill="#5F635D" fill-opacity=".6"/>`;
    s += `</g>`;
  }
  return s;
}
