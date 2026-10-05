/* =====================================================================
   BEHAVIOR
   Every animal carries six needs (a.need), from 0 (met) to 100
   (desperate): hunger, thirst, discomfort, lonely, bored and stress.
   Every few park minutes it picks what to do (a.act, ACTS in data.js)
   from whichever need is most urgent, shaped by its species' traits:
   when it's awake (diurnal, nocturnal, crepuscular), the company it
   wants (solitary, pair, herd, pack) and its temper (skittish, curious,
   aggressive). An animal that can't meet a need paces (a.why says why),
   and a frightened one hides: those are the player's tells.
   Needs feed happiness (behaviorScore, in exhibitReport), illness and
   escapes; what the herd is up to feeds guest appeal (liveliness).
   map.js walks each animal to wherever its act takes it.
   ===================================================================== */

const NEED_KEYS = ["hunger", "thirst", "discomfort", "lonely", "bored", "stress"];
const NEED_TEXT = {hunger:"Hunger", thirst:"Thirst", discomfort:"Discomfort", lonely:"Loneliness", bored:"Boredom", stress:"Stress"};
const freshNeeds = () => ({hunger:20, thirst:15, discomfort:20, lonely:10, bored:20, stress:15});
const needsOf = a => a.need || (a.need = freshNeeds());

// Species traits: listed ones from TRAITS, the rest worked out from diet, group size and body size
const traitCache = new Map();
function traitsOf(s){
  let t = traitCache.get(s.id);
  if(t) return t;
  const pick = (table, def) => Object.keys(table).find(k => table[k].includes(s.id)) || def;
  const [lo, hi] = s.group, hunter = !!s.predator || s.diet[0] === "carnivore";
  const social = lo >= 3 ? (hunter ? "pack" : "herd") : lo === 1 ? "solitary" : hi <= 2 ? "pair" : hunter ? (hi >= 4 ? "pack" : "pair") : (hi >= 5 ? "herd" : "pair");
  const temper = hunter || TERRITORIAL.includes(s.id) ? "aggressive" : s.space < 300 ? "skittish" : "curious";
  t = {active:pick(TRAITS.active, "diurnal"), social:pick(TRAITS.social, social), temper:pick(TRAITS.temper, temper)};
  traitCache.set(s.id, t);
  return t;
}
const traitText = s => { const t = traitsOf(s); return `${TRAIT_TEXT[t.active]}, ${TRAIT_TEXT[t.social]}, ${TRAIT_TEXT[t.temper]}`; };
// How many others of its kind an animal wants around: none for loners, one for pairs, the low end of its group otherwise
const matesWanted = s => { const t = traitsOf(s); return t.social === "solitary" ? 0 : t.social === "pair" ? 1 : Math.max(1, s.group[0] - 1); };
// How awake it is at this time of day, 0 to 1
function awake(s, min = state.minute){
  const h = min / 60, a = traitsOf(s).active;
  if(a === "nocturnal") return h < 9 || h >= 18.5 ? .7 : .2;
  if(a === "crepuscular") return h < 10 || h >= 18 ? 1 : .45;
  // diurnal: a nap in the heat of a hot afternoon
  return state.weather && state.weather.today === "hot" && h >= 12 && h < 15 ? .55 : 1;
}
// Meat, fish and bug eaters hunt their food; plant eaters forage
const isHunter = s => ["meat", "fish", "insects"].includes(foodType(s));

/* ---------- enrichment ---------- */
// Toy points (Rubbing Posts, Log Piles, balls, treats and the like; bark hides, branches and so on in a vivarium) an exhibit's animals want: more for bigger herds and bigger animals
const enrichNeedOf = (e, s, c) => ENRICH.per * Math.sqrt(c) * (e.viv ? clamp(Math.sqrt(s.space) / ENRICH.vivScale, 1, 3) : clamp(Math.sqrt(s.space) / 30, .3, 2));
function enrichNeed(e){
  let n = 0;
  for(const [sp, c] of speciesCounts(e)) n += enrichNeedOf(e, SPECIES_BY_ID[sp], c);
  return n;
}
// What one toy is worth to a species (its best diet counts), or its most to anyone with no species
const toyFor = (t, s) => !t ? 0 : !t.toyFor ? t.toy || 0 : s ? Math.max(0, ...s.diet.map(d => t.toyFor[d] || 0)) : Math.max(...Object.values(t.toyFor));
const toyPoints = (e, s) => landOf(e).reduce((n, f) => n + toyFor(LAND[f.type], s), 0);
// How well the toys cover what every species here wants, 0 to 1
function toyFit(e){
  let fit = 0, n = 0;
  for(const [sp, c] of speciesCounts(e)){ const s = SPECIES_BY_ID[sp]; fit += c * clamp(toyPoints(e, s) / (enrichNeedOf(e, s, c) || 1), 0, 1); n += c; }
  return n ? fit / n : 0;
}
// How much there is to do, 0 to 1: toys, the landscaping they like (just plants, in a vivarium), and room to roam
function enrichment(e){
  if(!e.animals.length) return 0;
  let sat = 0, n = 0;
  for(const [sp, c] of speciesCounts(e)){ const f = speciesFit(e, SPECIES_BY_ID[sp]); sat += c * (e.viv ? f.plants : f.sat); n += c; }
  sat /= n || 1;
  let need = 0; for(const [sp, c] of speciesCounts(e)) need += SPECIES_BY_ID[sp].space * c;
  const ratio = need ? area(e.points) / need : 2, room = ratio >= 1.5 ? 1 : ratio >= 1 ? .5 + (ratio - 1) : ratio * .5;
  return clamp(ENRICH.toys * toyFit(e) + ENRICH.habitat * sat + ENRICH.room * room, 0, 1);
}

/* ---------- what the exhibit puts on its animals ---------- */
function behaviorCtx(e){
  const counts = speciesCounts(e), kinds = [...counts.keys()].map(sp => SPECIES_BY_ID[sp]);
  let need = 0; for(const s of kinds) need += s.space * counts.get(s.id);
  let fight = false;
  for(let i = 0; i < kinds.length && !fight; i++) for(let j = i + 1; j < kinds.length && !fight; j++) fight = !!conflict(kinds[i], kinds[j]);
  const land = landOf(e).map(f => LAND[f.type]).filter(Boolean);
  return {
    counts, fight, ratio:need ? area(e.points) / need : 9,
    cover:!!e.viv || land.some(t => t.slots || t.cover || t.flora),
    water:!!e.viv || waterOf(e).length > 0 || (BIOMES[biomeOf(e)].wet || 0) > 0,
    browse:!e.viv && browseRate(e, "plants") + browseRate(e, "paleoflora") > 0,
    seen:isReachable(e) && typeof parties !== "undefined" ? clamp(parties.length / BEHAVIOR.busyAt, 0, 1) : 0,
    enrich:enrichment(e), x:exposure(e), dirt:e.dirt || 0, free:freeFeeding(), comfort:new Map(),
  };
}
const foodOk = (e, s, ctx) => ctx.free || stockFor(e, foodType(s)) > .01;
// The lowest thirst it can drink down to: water lovers can't make do with the keepers' trough
const thirstFloor = (s, ctx) => !ctx.water && likesOf(s).water >= HAB.wantsWater ? BEHAVIOR.troughFloor : 0;

// How comfortable a species is here, 0 to 1: the landscaping it likes, its biome, the weather and the dirt
function comfortOf(e, s, ctx){
  if(ctx.comfort.has(s.id)) return ctx.comfort.get(s.id);
  const f = speciesFit(e, s), b = biomeFit(s, biomeOf(e));
  let c = .5 * (e.viv ? f.plants : f.sat) + .5 * (b === "home" ? 1 : b === "near" ? .6 : b === "away" ? .2 : 1) - .5 * ctx.x;
  if(ctx.dirt > CLEAN.penaltyFrom) c -= (ctx.dirt - CLEAN.penaltyFrom) / 100;
  c = clamp(c, 0, 1); ctx.comfort.set(s.id, c);
  return c;
}

// The stress an exhibit puts on one animal, 0 to 100. With a why list, says what's behind it.
function stressTarget(e, a, s, ctx, why){
  const n = needsOf(a), T = traitsOf(s), agg = T.temper === "aggressive", c = ctx.counts.get(s.id) || 1, [lo, hi] = s.group;
  let t = 8;
  const add = (v, text) => { if(v <= 0) return; t += v; if(why && v >= 5) why.push(text); };
  if(ctx.ratio < 1) add((1 - ctx.ratio) * 60 * (agg ? 1.5 : 1), "it's cramped");
  if(ctx.fight) add(35, "another species here is a threat");
  if(c > hi) add(agg ? 22 : 15, `there are too many ${s.name}`);
  if(T.social === "solitary" && c > 1 && ctx.ratio < 2) add(12, "it wants more room away from its rivals");
  if(T.social === "herd") { if(c >= lo) t -= 5; else add(15, "its herd is too small to feel safe"); }
  if(T.social === "pack" && c < lo) add(10, "its pack is too small");
  add(ctx.x * 25, "it's out in the weather");
  if(ctx.dirt > CLEAN.penaltyFrom) add((ctx.dirt - CLEAN.penaltyFrom) * .5, "the exhibit is dirty");
  if(a.sick && !a.sick.chronic) add(12, "it's sick or hurt");
  if(T.temper === "skittish") add(BEHAVIOR.shyGuests * ctx.seen * (ctx.cover ? .5 : 1), ctx.cover ? "guests crowd the fence" : "guests crowd the fence and there's no cover to retreat to");
  if(n.hunger > 70) add((n.hunger - 70) * .6, "it's hungry");
  if(n.thirst > 70) add((n.thirst - 70) * .6, "it's thirsty");
  if(n.lonely > 60) add((n.lonely - 60) * .3, "it's lonely");
  if(agg && n.bored > 70) add((n.bored - 70) * .4, "it's bored");
  return clamp(t, 0, 100);
}

// What it does now: the most urgent need wins, and nothing to fix one means pacing
function pickAct(e, a, s, ctx){
  const n = needsOf(a), T = traitsOf(s), B = BEHAVIOR, aw = awake(s), food = foodOk(e, s, ctx);
  const mates = (ctx.counts.get(s.id) || 1) - 1, want = matesWanted(s), floor = thirstFloor(s, ctx), cur = a.act, since = a.actFor || 0;
  // finish what it started, unless the need is met
  const met = {eat:n.hunger < 8, forage:n.hunger < 8, hunt:false, drink:n.thirst <= floor + 3, social:n.lonely < 8, play:n.bored < 8, hide:n.stress < 20, rest:aw > .7};
  if(cur && since < B.minAct && !met[cur] && cur !== "pace") return cur;
  const sc = {};
  if(food){
    const key = !isHunter(s) ? (ctx.browse ? "forage" : "eat") : cur === "eat" || (cur === "hunt" && since >= B.huntMin) ? "eat" : "hunt";
    sc[key] = n.hunger * 1.1;
  }
  if(n.thirst > floor + 5) sc.drink = n.thirst * 1.15;
  sc.rest = (1 - aw) * 80 + n.discomfort * .25;
  if(n.stress > 30) sc.hide = (n.stress - 15) * {skittish:1.4, curious:.8, aggressive:.5}[T.temper] * (ctx.cover ? 1 : .7);
  if(mates > 0 && want > 0) sc.social = n.lonely;
  if(ctx.enrich >= .15) sc.play = n.bored * (T.temper === "curious" ? 1.25 : 1) * (.5 + ctx.enrich) * aw;
  const idle = s.predator || T.temper === "aggressive" || T.social === "pack" ? "patrol" : "forage";
  sc[idle] = Math.max(sc[idle] || 0, 22 * aw);
  // stuck: a need nothing here can fix
  const stuck = [
    ["bored", n.bored * (ctx.enrich < .15 ? 1.1 : .55)],
    ["stressed", n.stress * (T.temper === "aggressive" ? 1.15 : .75)],
    ["lonely", mates < want ? n.lonely * (T.social === "pack" ? 1 : .7) : 0],
    ["hungry", food ? 0 : n.hunger],
    ["thirsty", floor ? n.thirst : 0],
  ].sort((x, y) => y[1] - x[1])[0];
  if(stuck[1] > 40) sc.pace = (stuck[1] - 20) * (.4 + .6 * aw);
  if(sc[cur] != null) sc[cur] += B.stick;
  let best = idle; for(const k in sc) if(sc[k] > sc[best]) best = k;
  a.why = best === "pace" ? stuck[0] : null;
  return best;
}

// One step of the needs: they grow, the act meets one, and stress and comfort drift toward what the exhibit gives
function needsStep(e, a, s, ctx, dt){
  const n = needsOf(a), T = traitsOf(s), B = BEHAVIOR, aw = awake(s), food = foodOk(e, s, ctx), floor = thirstFloor(s, ctx);
  const mates = (ctx.counts.get(s.id) || 1) - 1, want = matesWanted(s);
  n.hunger += B.hunger * dt * (.5 + .5 * aw);
  n.thirst += B.thirst * dt * (.5 + .5 * aw) * (state.weather && state.weather.today === "hot" ? B.hotThirst : 1);
  const temper = {curious:1.4, skittish:.8, aggressive:1.1}[T.temper] * (T.temper === "curious" ? 1 - .3 * ctx.seen : 1);   // curious ones like watching the guests
  n.bored += B.bored * dt * aw * temper * (1.4 - ctx.enrich);
  if(want) n.lonely += B.lonely * dt * (mates >= want ? .5 : 1); else n.lonely -= B.social * dt;
  switch(a.act){
    case "eat": if(food) n.hunger -= B.eat * dt; break;
    case "hunt": n.bored -= B.forage * dt; break;   // the stalk is the best part
    case "forage": n.bored -= (ctx.browse ? B.forage : B.graze) * dt; if(ctx.browse && !isHunter(s)) n.hunger -= B.browse * dt; break;
    case "drink": if(n.thirst > floor) n.thirst = Math.max(floor, n.thirst - B.drink * dt); break;
    case "social": if(mates) n.lonely -= B.social * dt; n.stress -= .2 * dt; break;
    case "play": n.bored -= B.play * dt * (.4 + ctx.enrich); n.stress -= .1 * dt; break;
    case "patrol": n.bored -= B.patrol * dt; break;
    case "pace": n.bored -= B.pace * dt; n.stress += .05 * dt; break;
    case "rest": n.discomfort -= .1 * dt; n.stress -= .1 * dt; break;
    case "hide": n.stress -= B.hideCalm * dt * (ctx.cover ? 1 : .33); break;
  }
  n.stress += (stressTarget(e, a, s, ctx) - n.stress) * Math.min(1, dt / B.stressDrift);
  n.discomfort += (100 * (1 - comfortOf(e, s, ctx)) * .8 - n.discomfort) * Math.min(1, dt / B.comfortDrift);
  for(const k of NEED_KEYS) n[k] = clamp(n[k], 0, 100);
}

let behaveAcc = 0;
function behaviorTick(dtMin){
  behaveAcc += dtMin;
  while(behaveAcc >= BEHAVIOR.step){
    behaveAcc -= BEHAVIOR.step;
    for(const e of state.exhibits){
      if(!e.animals.length) continue;
      const ctx = behaviorCtx(e);
      for(const a of e.animals){
        const s = SPECIES_BY_ID[a.sp]; if(!s) continue;
        needsStep(e, a, s, ctx, BEHAVIOR.step);
        const next = pickAct(e, a, s, ctx);
        if(next !== a.act){ a.act = next; a.actFor = 0; } else a.actFor = (a.actFor || 0) + BEHAVIOR.step;
      }
    }
  }
}

// Treats and hay bales get used up: a day each night, faster for frozen ones in a heat wave
function treatsNight(){
  const hot = state.weather && state.weather.today === "hot";
  for(const e of state.exhibits){
    const gone = [];
    e.land = landOf(e).filter(f => {
      const t = LAND[f.type]; if(!t || !t.lasts) return true;
      f.left = (f.left ?? t.lasts) - (hot && t.look === "ice" ? ENRICH.melt : 1);
      if(f.left > 0) return true;
      gone.push(t.label.toLowerCase()); return false;
    });
    if(gone.length && e.animals.length) events.toast(`${e.name}: the ${[...new Set(gone)].join(" and ")} ${gone.length === 1 ? "is" : "are"} all used up. Put out more in Habitat Props.`, "bad");
  }
}
// Overnight they eat what's left, drink, sleep it off and wake up fresh
function behaviorNight(){
  behaveAcc = 0;
  treatsNight();
  for(const e of state.exhibits){
    if(!e.animals.length) continue;
    const ctx = behaviorCtx(e);
    for(const a of e.animals){
      const s = SPECIES_BY_ID[a.sp]; if(!s) continue;
      const n = needsOf(a);
      n.hunger = foodOk(e, s, ctx) ? 20 : Math.min(100, n.hunger + 25);
      n.thirst = Math.max(15, thirstFloor(s, ctx));
      n.bored = 20; n.stress *= .5; n.discomfort *= .7;
      for(const k of NEED_KEYS) n[k] = Math.round(n[k]);
      a.act = "rest"; a.actFor = 0; a.why = null;
    }
  }
}

/* ---------- what it means for the park ---------- */
const actLabel = a => a.act && ACTS[a.act] ? ACTS[a.act].label : "Settling in";
const whyText = {bored:"bored", stressed:"stressed", lonely:"lonely", hungry:"hungry", thirsty:"thirsty"};
const WHY_FIX = {
  bored:"Enrichment props (Habitat Props, or Enrichment for a vivarium), rocks, plants and more room give them something to do.",
  stressed:"See the Behavior tab for what's bothering them.",
  lonely:"They need more of their own kind.",
  hungry:"There's no food. Keepers need to bring some.",
  thirsty:"They want water to drink and wade in. Draw some in the exhibit.",
};

// Happiness from how the herd feels, plus the tells, for exhibitReport
function behaviorScore(e){
  const out = {delta:0, issues:[]}, list = e.animals.filter(a => a.need);
  if(!list.length) return out;
  const H = BEHAVIOR.happy, avg = k => list.reduce((s, a) => s + a.need[k], 0) / list.length;
  const pacing = list.filter(a => a.act === "pace"), hiding = list.filter(a => a.act === "hide"), playing = list.filter(a => a.act === "play");
  const stress = avg("stress"), bored = avg("bored");
  out.delta = H.calm - H.stress * stress - H.bored * bored - H.pace * pacing.length / list.length;
  const names = l => [...new Set(l.map(a => SPECIES_BY_ID[a.sp].name))].join(", ");
  if(pacing.length){
    const why = {}; for(const a of pacing) why[a.why || "bored"] = (why[a.why || "bored"] || 0) + 1;
    const top = Object.keys(why).sort((x, y) => why[y] - why[x])[0];
    out.issues.push({bad:true, text:`Pacing. ${pacing.length} ${names(pacing)} ${pacing.length === 1 ? "is" : "are"} pacing, mostly because ${pacing.length === 1 ? "it's" : "they're"} ${whyText[top]}. ${WHY_FIX[top]}`});
  }
  if(hiding.length) out.issues.push({bad:true, text:`Hiding. ${hiding.length} ${names(hiding)} ${hiding.length === 1 ? "is" : "are"} hiding. Something here frightens ${hiding.length === 1 ? "it" : "them"}. See Behavior.`});
  if(stress >= 50 && !hiding.length && !pacing.length) out.issues.push({bad:true, text:`Stressed (${Math.round(stress)}%). See Behavior.`});
  if(playing.length) out.issues.push({bad:false, text:`${playing.length} ${names(playing)} ${playing.length === 1 ? "is" : "are"} playing.`});
  return out;
}
// How much there is to watch: a sleeping or hiding herd draws guests less, a busy and playful one more. Pacing counts for half.
function liveliness(e){
  if(!e.animals.length) return 1;
  let on = 0; for(const a of e.animals) on += !a.act ? .7 : a.act === "rest" || a.act === "hide" ? 0 : a.act === "pace" ? .5 : a.act === "play" ? 1.3 : 1;
  const [lo, hi] = BEHAVIOR.lively;
  return clamp(lo + (hi - lo) * on / e.animals.length, lo, hi);
}
// A stressed aggressive animal throws itself at the fence more
const stressEscape = a => a && a.need && traitsOf(SPECIES_BY_ID[a.sp]).temper === "aggressive" ? 1 + (BEHAVIOR.escape - 1) * a.need.stress / 100 : 1;
// What the exhibit's animals are up to, as "2 eating, 1 pacing"
function actsSummary(list){
  const c = {}; for(const a of list){ const k = actLabel(a).toLowerCase(); c[k] = (c[k] || 0) + 1; }
  return Object.entries(c).sort((x, y) => y[1] - x[1]).map(([k, n]) => `${n} ${k}`).join(", ");
}
