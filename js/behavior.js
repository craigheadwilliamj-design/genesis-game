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
// How ready an awake animal is for a nap: 0 outside midday, up to 1 halfway through the nap hours, more in a heat wave
function napLull(s, min = state.minute){
  const h = min / 60, N = BEHAVIOR.nap;
  if(awake(s, min) <= .7 || h < N.from || h >= N.to) return 0;
  return Math.min(1, Math.sin(Math.PI * (h - N.from) / (N.to - N.from)) * (state.weather && state.weather.today === "hot" ? N.hot : 1));
}
// a steady 0 to 1 for an animal at this step, so the same park gives the same naps (and tests don't wobble)
function napRoll(a, k, daily){
  let x = 0; for(const c of String(a.id) + "|" + state.day + "|" + (daily ? "" : state.minute) + "|" + k) x = (x * 31 + c.charCodeAt(0)) >>> 0;
  x ^= x >>> 15; x = Math.imul(x, 0x2c1b3c6d) >>> 0; x ^= x >>> 12;
  return (x >>> 0) / 4294967296;
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
// Toy props are dev-only: players don't see them (Paleoflora bales stay, they are feed), but toys already placed keep working
const HIDDEN_TOYS = ["post", "logs", "wallow", "ball", "icefish", "icefruit", "shank", "buglog", "hay"];
const toyHidden = k => !devMode() && (HIDDEN_TOYS.includes(k) || !!(LAND[k] && LAND[k].vivToy));
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
  if(!devMode()) return 1;
  let sat = 0, n = 0;
  for(const [sp, c] of speciesCounts(e)){ const f = speciesFit(e, SPECIES_BY_ID[sp]); sat += c * (e.viv ? f.plants : f.sat); n += c; }
  sat /= n || 1;
  let need = 0; for(const [sp, c] of speciesCounts(e)) need += SPECIES_BY_ID[sp].space * c;
  const ratio = need ? area(e.points) / need : 2, room = ratio >= 1.5 ? 1 : ratio >= 1 ? .5 + (ratio - 1) : ratio * .5;
  return clamp(ENRICH.toys * toyFit(e) + ENRICH.habitat * sat + ENRICH.room * room, 0, 1);
}

/* ---------- what the exhibit puts on its animals ---------- */
// Males of aggressive species fight more (multiplies the chance of a generic fight in attackStep)
const fightBias = a => a && a.sex === "male" && traitsOf(SPECIES_BY_ID[a.sp]).temper === "aggressive" ? SEX.maleFight : 1;

/* ---------- social life ---------- */
const cnt = (n, w) => ({1:"One", 2:"Two", 3:"Three", 4:"Four", 5:"Five"}[n] || n) + " " + w;
const byRank = (x, y) => (x.rank ?? .5) - (y.rank ?? .5) || (x.id < y.id ? -1 : 1);
// Where an animal stands in its kind's pecking order here: {i: 0 for the alpha, n: how many}. Only herds and packs have one.
function rankPos(e, a){
  const t = traitsOf(SPECIES_BY_ID[a.sp]);
  if(e.viv || (t.social !== "herd" && t.social !== "pack")) return null;
  const l = e.animals.filter(v => v.sp === a.sp).sort(byRank);
  return l.length > 1 ? {i:l.indexOf(a), n:l.length} : null;
}
// What the mix of sexes means for each species with two or more in an open exhibit: a Map of species id to
// {sp, name, kind, m, f, n, text, bad, delta, fights, low (male id -> 0 alpha to 1 bottom), spaceMult, ...}. Empty for a vivarium.
function socialInfo(e, ratio){
  const out = new Map();
  if(e.viv || e.animals.length < 2) return out;
  const by = new Map();
  for(const a of e.animals){ if(!a.sex) continue; const r = by.get(a.sp) || {m:[], f:[]}; r[a.sex === "male" ? "m" : "f"].push(a); by.set(a.sp, r); }
  if(ratio == null){ let need = 0; for(const a of e.animals) need += SPECIES_BY_ID[a.sp].space; ratio = need ? area(e.points) / need : 9; }
  const S = SOCIAL, spaceMult = clamp(S.spaceRef / Math.max(ratio, .1), .5, 2.5);
  let room, cov;
  for(const [sp, r] of by){
    const s = SPECIES_BY_ID[sp], k = traitsOf(s).social, m = r.m.length, f = r.f.length, n = m + f;
    if(n < 2) continue;
    const i = {sp, name:s.name, kind:k, m, f, n, text:"", bad:false, delta:0, fights:false, spaceMult, males:r.m, low:new Map(), relief:0};
    if(k === "solitary"){
      if(room == null){ room = clamp((ratio - 1) / (S.roomFull - 1), 0, 1); const c = coverOf(e); cov = c.need ? clamp(c.have / c.need, 0, 1) : 1; }
      const w = wantsOf(e, s), h = haveOf(e, s), rock = w.rock ? clamp(h.rock / w.rock, 0, 1) : 1;
      i.relief = Math.min(S.max, S.relief.room * room + S.relief.rock * rock + S.relief.cover * cov);
      i.soloSame = (m - 1) * S.soloSame * (1 - i.relief); i.soloOpp = f * S.soloOpp * (1 - i.relief);   // for a male; a female swaps m and f
      const same = (m > 1 || f > 1), pen = (a) => Math.min(S.soloCap, ((a.sex === "male" ? m : f) - 1) * S.soloSame * (1 - i.relief) + (a.sex === "male" ? f : m) * S.soloOpp * (1 - i.relief));
      i.pen = pen;
      const avg = (r.m.reduce((t, a) => t + pen(a), 0) + r.f.reduce((t, a) => t + pen(a), 0)) / n;
      i.delta = -avg * S.soloHappy; i.bad = true;
      i.text = same ? `${s.name} are loners, and ${m > 1 && f > 1 ? "males and females" : m > 1 ? "males" : "females"} of the same sex are sharing the pen. They'd rather be alone. More room, rocks and shelter ease it.` : `${s.name} are loners. A male and a female tolerate each other, but alone would be best.`;
    } else if(k === "pair"){
      const left = Math.abs(m - f);
      if(!left){ i.delta = S.pairBonus; i.text = n === 2 ? `A male and a female ${s.name}: a good pair.` : `${s.name} are paired off, male and female.`; }
      else { i.delta = -S.pairMild * left / n; i.bad = true; i.odd = m > f ? "male" : "female"; i.text = n === 2 ? `Two ${m ? "male" : "female"} ${s.name} would be happier as a male and a female.` : `${s.name} would be happier paired off: there's ${left === 1 ? "an extra" : left + " extra"} ${i.odd}${left === 1 ? "" : "s"}.`; }
    } else if(!f || !m){
      i.delta = f ? S.matriarch : S.bachelor;
      i.text = f ? `${s.name} form a settled all-female group.` : `${s.name} form a settled bachelor group.`;
    } else if(m === 1){
      i.text = `One male leads the ${s.name} and the females. It's settled.`;
    } else {
      i.fights = true; i.bad = true;
      const t = Math.min(m - 1, S.rivalCap);
      i.delta = -S.rivalHappy * t * spaceMult;
      r.m.slice().sort(byRank).forEach((a, x) => i.low.set(a.id, x / (m - 1)));
      i.text = `${cnt(m, "male " + s.name)} are fighting over the females. ${spaceMult > 1 ? "Cramped quarters make it worse. " : ""}Keep just one male, or split them up.`;
    }
    out.set(sp, i);
  }
  return out;
}
// The stress the social mix puts on one animal, with the reason: [stress, text]
function socialStress(a, i){
  if(!i || !a.sex) return [0, ""];
  const S = SOCIAL;
  if(i.kind === "solitary") return [i.pen(a), "it's a loner and has company"];
  if(i.kind === "pair") return [i.odd === a.sex ? S.pairStress : 0, "it has no mate of the other sex"];
  if(i.fights) return [S.rivalStress * Math.min(i.m - 1, S.rivalCap) * i.spaceMult * (a.sex === "male" ? .6 + .4 * (i.low.get(a.id) || 0) : .25), "the males are fighting"];
  return [0, ""];
}
// Rivals fight over the females now and then; the higher rank usually wins, and the loser (the lower the rank, the worse) is hurt and stressed
function rivalFight(e, i, now){
  const A = ATTACK, ms = i.males.filter(a => e.animals.includes(a) && !a.darted && !(a.sick && a.sick.kind === "injury") && now - (a.hitAt ?? -1e9) >= A.gap);
  if(ms.length < 2 || Math.random() >= SOCIAL.fightRate * (i.m - 1) * i.spaceMult) return;
  const x = Math.floor(Math.random() * ms.length); let y = Math.floor(Math.random() * (ms.length - 1)); if(y >= x) y++;
  let [w, l] = byRank(ms[x], ms[y]) <= 0 ? [ms[x], ms[y]] : [ms[y], ms[x]];
  if(Math.random() < SOCIAL.upset) [w, l] = [l, w];
  const low = i.low.get(l.id) || 0;
  w.hitAt = l.hitAt = now;
  const hurt = SOCIAL.hurt.map(v => v * (1 + low * SOCIAL.lowHurt));
  if(hurtAnimal(e, l, i.name, "fight", hurt, 0, `The males are fighting over the females in ${e.name}.`) === "hurt"){
    const n = needsOf(l); n.stress = Math.min(100, n.stress + SOCIAL.loseStress * (.5 + .5 * low));
  }
}
function behaviorCtx(e){
  const counts = speciesCounts(e), kinds = [...counts.keys()].map(sp => SPECIES_BY_ID[sp]);
  let need = 0; for(const s of kinds) need += s.space * counts.get(s.id);
  let fight = false;
  for(let i = 0; i < kinds.length && !fight; i++) for(let j = i + 1; j < kinds.length && !fight; j++) fight = !!conflict(kinds[i], kinds[j]);
  const land = landOf(e).map(f => LAND[f.type]).filter(Boolean);
  const ctx = {
    counts, fight, ratio:need ? area(e.points) / need : 9,
    cover:!!e.viv || land.some(t => t.slots || t.cover || t.flora),
    water:!!e.viv || waterOf(e).length > 0 || (BIOMES[biomeOf(e)].wet || 0) > 0,
    browse:!e.viv && browseRate(e, "plants") + browseRate(e, "paleoflora") > 0,
    seen:isReachable(e) && typeof parties !== "undefined" ? clamp(parties.length / BEHAVIOR.busyAt, 0, 1) : 0,
    enrich:enrichment(e), x:exposure(e), dirt:e.dirt || 0, free:freeFeeding(), comfort:new Map(),
  };
  ctx.soc = socialInfo(e, ctx.ratio);
  return ctx;
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
  { const [v, text] = socialStress(a, ctx.soc.get(s.id)); add(v, text); }
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
  // a midday nap, like a second idle: now and then a settled animal lies down for a spell on most days, once a day, and stays down (it heads for shelter or trees: actGoal)
  if(cur === "rest" && a.napFor){
    if(since < a.napFor && n.hunger < 92 && n.thirst < 92 && n.stress < 50) return "rest";
    a.napFor = 0;
  }
  const lull = napLull(s);
  if(lull > 0 && cur !== "rest" && a.napDay !== state.day && napRoll(a, 3, true) < B.nap.share && n.hunger < 55 && n.thirst < floor + 45 && n.stress < 35 && napRoll(a, 1) < B.nap.chance * lull){
    a.napDay = state.day; a.napFor = Math.round((B.nap.min + napRoll(a, 2) * (B.nap.max - B.nap.min)) / B.step) * B.step;
    return "rest";
  }
  // finish what it started, unless the need is met
  const met = {eat:n.hunger < 8, forage:n.hunger < 8, hunt:false, drink:n.thirst <= floor + 3, social:n.lonely < 8, play:n.bored < 8, hide:n.stress < 20, rest:aw > .7};
  if(cur && since < B.minAct && !met[cur] && cur !== "pace") return cur;
  const sc = {};
  if(food){
    const key = !isHunter(s) ? (ctx.browse ? "forage" : "eat") : cur === "eat" || (cur === "hunt" && since >= B.huntMin) ? "eat" : "hunt";
    sc[key] = n.hunger * 1.1;
  }
  if(huntDriven(a) && preyIn(e, s, ctx.counts).length && aw > .5) sc.hunt = Math.max(sc.hunt || 0, ATTACK.drive + n.hunger * .5);   // prey in the exhibit: stalk it
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
      attackStep(e, ctx);
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
  for(const i of socialInfo(e).values()){ out.delta += i.delta * i.n / list.length; out.issues.push({bad:i.bad, text:`Social. ${i.text}`}); }
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

/* ---------- attacks ---------- */
// Animal-on-animal violence (ATTACK in data.js): hunters strike their prey, stressed animals fight, loose predators raid exhibits (looseAttacks, called from escapesTick).

// The species in an exhibit that species s goes after
function preyIn(e, s, counts){
  const out = [];
  if(!counts || counts.size < 2) return out;
  for(const sp of counts.keys()) if(attackReason(s, SPECIES_BY_ID[sp])) out.push(sp);
  return out;
}
// A predator doesn't kill for sport: only a hungry, stressed or bored one goes after prey it lives with
function huntDriven(a){ const n = a.need; return !!n && (n.hunger >= ATTACK.hungry || n.stress >= ATTACK.huntStress || n.bored >= ATTACK.huntBored); }
// The warning for putting species s into exhibit e, or null if nobody there hunts anybody
function mixWarning(s, e){
  const prey = new Set(), hunters = new Set();
  for(const sp of speciesCounts(e).keys()){
    const o = SPECIES_BY_ID[sp];
    if(attackReason(s, o)){ hunters.add(s.name); prey.add(o.name); }
    if(attackReason(o, s)){ hunters.add(o.name); prey.add(s.name); }
  }
  if(!hunters.size) return null;
  return `${[...hunters].join(" and ")} will hunt ${[...prey].join(" and ")} in ${e.name}. They only attack when hungry, stressed or bored, so keep them fed, give them room and things to do. Even then, expect injuries and deaths. Mix them anyway?`;
}
const bodyPos = a => { const h = typeof herd !== "undefined" ? herd.get(a.id) : null; return h && h.placed ? h : null; };
// A puff of dust where an animal is hit, or at the middle of its exhibit when it isn't drawn
function attackFx(e, a){ const h = bodyPos(a), c = h ? [h.x, h.y] : centroid(e.points); events.fx("dust", c[0], c[1]); }

// Hurt one animal. A hit adds to an injury (or to an illness it already had); 100 kills. Returns "killed" or "hurt".
function hurtAnimal(e, v, by, how, range, killP, msg){
  const s = SPECIES_BY_ID[v.sp], sev = range[0] + Math.random() * (range[1] - range[0]);
  const hit = {by, how};
  if(v.sick){ v.sick.sev += sev; delete v.sick.hidden; v.sick.hit = hit; }
  else v.sick = {kind:"injury", sev:Math.round(sev), cause:"attack", hit};
  if(killP && Math.random() < killP) v.sick.sev = 100;
  const n = needsOf(v); n.stress = Math.min(100, n.stress + ATTACK.scare);
  attackFx(e, v);
  if(v.sick.sev >= 100){
    animalDies(e, v);
    events.toast(`${how === "fight" ? `A ${s.name} was killed in a fight` : `A ${by} killed a ${s.name}`} in ${e.name}.`, "bad");
    return "killed";
  }
  v.sick.sev = Math.round(v.sick.sev);
  if(how !== "fight") events.toast(`A ${by} attacked a ${s.name} in ${e.name}.`, "bad");
  else if(e.fightDay !== state.day){ e.fightDay = state.day; events.toast(msg || `Animals are fighting in ${e.name}. Stress and cramped quarters make them lash out.`, "bad"); }
  return "hurt";
}

// Every behavior step: predators that have stalked long enough strike their prey, and stressed animals pick fights
function attackStep(e, ctx){
  const list = e.animals, A = ATTACK;
  if(list.length < 2) return;
  const now = nowAbs();
  if(ctx.soc) for(const i of ctx.soc.values()) if(i.fights) rivalFight(e, i, now);
  for(const a of [...list]){
    if(!list.includes(a) || a.darted || now - (a.hitAt ?? -1e9) < A.gap) continue;
    const s = SPECIES_BY_ID[a.sp]; if(!s) continue;
    if(a.act === "hunt" && huntDriven(a) && (a.actFor || 0) >= A.stalk && preyIn(e, s, ctx.counts).length){
      const me = bodyPos(a);
      let prey = null, bd = Infinity;
      for(const v of list){
        if(v === a || v.darted || !attackReason(s, SPECIES_BY_ID[v.sp])) continue;
        const p = bodyPos(v), d = me && p ? Math.hypot(p.x - me.x, p.y - me.y) - (me.r || 1) - (p.r || 1) : 0;
        if(d < bd){ bd = d; prey = v; }
      }
      if(prey && bd <= A.strike && Math.random() < (me ? A.huntChance : A.huntChance * .66)){
        a.hitAt = now; hurtAnimal(e, prey, s.name, "hunt", A.bite, A.kill);
        continue;
      }
    }
    // fights: the stressed, aggressive or crowded, against anyone else in the pen
    const n = a.need; if(!n || (a.sick && a.sick.kind === "injury")) continue;
    const agg = traitsOf(s).temper === "aggressive", over = A.fightStress + (agg ? 0 : 15);
    if(n.stress < over || (!agg && ctx.ratio >= 1)) continue;
    const p = A.fightRate * fightBias(a) * clamp((n.stress - over + 10) / 40, 0, 1) * (ctx.ratio < 1 ? A.crowded : 1);
    if(Math.random() >= p) continue;
    const others = list.filter(v => v !== a && !v.darted);
    if(!others.length) continue;
    a.hitAt = now;
    hurtAnimal(e, others[Math.floor(Math.random() * others.length)], s.name, "fight", A.fightHurt, 0);
  }
}

// How far a point is from a shape's edge (0 inside)
function distToPoly(x, y, pts){
  if(inPoly(x, y, pts)) return 0;
  let d = Infinity;
  for(let i = 0; i < pts.length; i++) d = Math.min(d, segProj(x, y, pts[i], pts[(i + 1) % pts.length]).d);
  return d;
}
// Can this species get at the animals inside? A breach, or a fence weaker than it is (a moat keeps it out otherwise)
const canGetIn = (e, s) => !e.viv && !e.moat && (isBreached(e) || escapeStrength(s) > effectiveStrength(e));
// Loose predators strike animals in exhibits they've wandered up to and can get into
function looseAttacks(dtMin){
  const A = ATTACK, now = nowAbs();
  for(const l of state.safety.loose){
    if(l.status !== "loose" || now - (l.biteAt ?? -1e9) < A.gap) continue;
    const s = SPECIES_BY_ID[l.sp]; if(!s || !(s.predator || eats(s, "carnivore"))) continue;
    const at = loosePos(l); if(!at) continue;
    for(const e of state.exhibits){
      if(e.viv || e.animals.length < 1 || !canGetIn(e, s) || distToPoly(at[0], at[1], e.points) > A.reach) continue;
      const prey = e.animals.filter(v => !v.darted && attackReason(s, SPECIES_BY_ID[v.sp]));
      if(!prey.length || Math.random() >= 1 - Math.pow(1 - A.looseRate, dtMin)) continue;
      l.biteAt = now;
      hurtAnimal(e, prey[Math.floor(Math.random() * prey.length)], s.name, "loose", A.bite, A.kill);
      break;
    }
  }
}
