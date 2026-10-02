/* =====================================================================
   SCIENCE
   ORACLE researches (animals, fences, buildings, plants, medicine, TAR
   upgrades), GHOST fills genomes, TAR clones animals, and CERES grows
   plants and medicine. All of it takes time: projects, trips, clones and
   batches carry start/end stamps in park minutes (see nowMin), so they
   finish mid-day rather than at closing.
   ===================================================================== */

/* ---------- time ---------- */

// Park minutes since day 1 opened. Closing on one day and opening the next are the same instant.
const nowMin = () => (state.day - 1) * DAY_MIN + (state.minute - OPEN_MIN);
const minAt = (day, minute) => (day - 1) * DAY_MIN + (minute - OPEN_MIN);
function whenText(m){
  const r = m % DAY_MIN;
  return r < 1 && m > 0 ? `closing on day ${Math.round(m / DAY_MIN)}` : `day ${Math.floor(m / DAY_MIN) + 1}, ${fmtClock(OPEN_MIN + r)}`;
}
// A length of time in open days and hours: "1 day 3h", "5h 20m"
function spanText(min){
  min = Math.max(0, Math.round(min));
  if(min < 1) return "a moment";
  const d = Math.floor(min / DAY_MIN), h = Math.floor(min % DAY_MIN / 60), m = min % 60;
  return d ? `${d} day${d === 1 ? "" : "s"}${h ? ` ${h}h` : ""}` : h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`;
}
const leftText = end => spanText(end - nowMin());
const doneShare = j => clamp((nowMin() - j.start) / Math.max(1, j.end - j.start), 0, 1) * 100;

/* ---------- ORACLE: research ---------- */

const labSlots = () => dept("oracle") ? state.science.crew.paleo : 0;
const researching = (kind, id) => state.science.projects.some(p => p.kind === kind && p.id === id);
const speciesToUnlock = () => SPECIES.filter(s => !isStarter(s));
const isUnlocked = id => state.science.unlocked.includes(id);

// What unlocking an animal's genome costs in research points: its period's base plus a share of its price
function unlockPoints(s){ return Math.max(5, Math.round(PERIOD_BY_ID[s.period].research * .2 + s.price * UNLOCK_PER_PRICE)); }

// A project is {kind, id}: "tech" (anything in TECH), "refine" (an era's medicine, for one period) or "species" (an animal's genome)
function projectInfo(kind, id){
  if(kind === "tech"){ const t = TECH.find(x => x.id === id); return t ? {label:t.label, points:t.points, needs:t.needs, done:hasTech(id)} : null; }
  if(kind === "refine"){ const era = ERA_OF[id]; return era ? {label:`${id} medicine`, points:REFINE_POINTS[era], needs:MED_TECH[era], done:hasTech("ref-" + id)} : null; }
  if(kind === "species"){ const s = SPECIES_BY_ID[id]; return s && !isStarter(s) ? {label:s.name, points:unlockPoints(s), done:isUnlocked(id)} : null; }
  return null;
}
const projectMinutes = points => Math.round(points * RESEARCH_MIN_PER_POINT);

function projectProblem(kind, id){
  const sc = state.science, info = projectInfo(kind, id);
  if(!info) return "That can't be researched.";
  if(info.done) return kind === "species" ? "Already unlocked." : "Already researched.";
  if(researching(kind, id)) return "Already being researched.";
  const blocker = deptProblem("oracle"); if(blocker) return blocker;
  if(info.needs && !hasTech(info.needs)) return `Research ${TECH.find(x => x.id === info.needs).label} first.`;
  if(!sc.crew.paleo) return "Hire a paleontologist to run research.";
  if(sc.projects.length >= sc.crew.paleo) return `${sc.crew.paleo === 1 ? "Your paleontologist is" : `All ${sc.crew.paleo} paleontologists are`} busy. Hire more to run projects side by side.`;
  if(sc.points + 1e-9 < info.points) return `Needs ${info.points} research points. You have ${Math.floor(sc.points)}.`;
  return null;
}
function startProject(kind, id){
  const why = projectProblem(kind, id); if(why) return why;
  const sc = state.science, info = projectInfo(kind, id), now = nowMin();
  sc.points -= info.points;
  sc.projects.push({kind, id, start:now, end:now + projectMinutes(info.points)});
  events.toast(`ORACLE started ${kind === "species" ? `unlocking the ${info.label}` : `researching ${info.label.toLowerCase()}`}. It takes about ${spanText(projectMinutes(info.points))}.`);
  return null;
}
function finishProject(p){
  const sc = state.science, info = projectInfo(p.kind, p.id);
  if(p.kind === "species"){ if(!isUnlocked(p.id)) sc.unlocked.push(p.id); const s = SPECIES_BY_ID[p.id]; events.toast(`ORACLE unlocked the ${s.name}. GHOST can look for its DNA now.`, "good"); return; }
  const tech = p.kind === "refine" ? "ref-" + p.id : p.id;
  if(!hasTech(tech)) sc.tech.push(tech);
  events.toast(`ORACLE finished researching ${info ? info.label.toLowerCase() : p.id}.`, "good");
}

/* ---------- GHOST: expeditions ---------- */

// Animals and plants both have genomes: sc.dna[id] = {genome: 0-100, quality}
function genomeInfo(id){
  const s = SPECIES_BY_ID[id]; if(s) return {id, name:s.name, space:s.space, animal:s};
  const f = PLANT_DNA_BY_ID[id]; if(f) return {id, name:f.name, space:f.space, plant:f};
  return null;
}
const genomeDone = id => { const d = state.science.dna[id]; return !!d && d.genome >= 100; };
const plantDnaDone = era => !!PLANT_DNA[era] && genomeDone(PLANT_DNA[era].id);
const anyPlantDna = () => Object.values(PLANT_DNA).some(f => genomeDone(f.id));
// Can GHOST go looking for this yet? Animals need ORACLE to have unlocked them, plants need their flora type.
function genomeOpen(id){
  const g = genomeInfo(id); if(!g) return false;
  return g.animal ? isUnlocked(id) : hasTech(FLORA[g.plant.era].tech);
}
// The periods GHOST can look in for a genome
const genomePeriods = id => { const g = genomeInfo(id); return g.animal ? [g.animal.period] : g.plant.periods; };

const sizeT = space => clamp(Math.log(space / TRIP_SIZE[0]) / Math.log(TRIP_SIZE[1] / TRIP_SIZE[0]), 0, 1);
const lerpT = ([a, b], t) => a + (b - a) * t;
// What a trip for this genome in this period is like: the chance of coming back empty-handed, the genome % a find adds on average,
// the trips a whole genome takes on average, and the price
function tripOdds(id, periodId){
  const g = genomeInfo(id), p = PERIOD_BY_ID[periodId], t = sizeT(g.space);
  const fail = clamp(lerpT(TRIP.fail, t) + p.risk, 0, .8), trips = lerpT(TRIP.trips, t);
  // a genome ends on a find that overshoots 100% by about half a find's worth, hence the .5
  return {fail, trips, gain:100 / Math.max(.6, trips * (1 - fail) - .5), cost:Math.round(p.trip * lerpT(TRIP.costMul, t) / 50) * 50};
}

function tripProblem(id, periodId){
  const sc = state.science, g = genomeInfo(id);
  if(!g || !PERIOD_BY_ID[periodId] || !genomePeriods(id).includes(periodId)) return "GHOST can't find that there.";
  return deptProblem("ghost") ||
    (!genomeOpen(id) ? (g.animal ? `Unlock the ${g.name} at ORACLE first.` : `Research ${g.name} at ORACLE first.`) : null) ||
    (!sc.crew.temporal ? "Hire a Temporal Researcher at GHOST to lead expeditions." : null) ||
    (sc.trips.length >= sc.crew.temporal ? `All ${sc.crew.temporal} expedition team${sc.crew.temporal === 1 ? " is" : "s are"} in the field. Hire more Temporal Researchers at GHOST to send more at once.` : null) ||
    (!canAfford(tripOdds(id, periodId).cost) ? `A trip costs ${money(tripOdds(id, periodId).cost)}. You have ${money(state.money)}.` : null);
}
function launchTrip(id, periodId){
  if(tripProblem(id, periodId)) return false;
  const p = PERIOD_BY_ID[periodId], now = nowMin();
  spend(tripOdds(id, periodId).cost, "science");
  const end = now + Math.round(p.days * DAY_MIN);
  state.science.trips.push({period:periodId, sp:id, start:now, end});
  events.toast(`GHOST left for the ${periodId} to find ${genomeInfo(id).name}. Back in about ${spanText(end - now)}.`);
  return true;
}

// Add a DNA sample to the genome library. Returns how much the genome grew.
function addSample(sp, gain, q){
  const dna = state.science.dna;
  const d = dna[sp] || (dna[sp] = {genome:0, quality:0});
  if(d.genome >= 100){ const before = d.quality; if(q > d.quality) d.quality = Math.round(d.quality + (q - d.quality) * .5); return {gain:0, better:d.quality - before}; }
  const g = Math.min(gain, 100 - d.genome);
  d.quality = Math.round((d.quality * d.genome + q * g) / (d.genome + g));
  d.genome = Math.min(100, Math.round(d.genome + g));
  return {gain:g, better:0};
}

function tripReturns(t){
  const sc = state.science, p = PERIOD_BY_ID[t.period], g = genomeInfo(t.sp), odds = tripOdds(t.sp, t.period);
  if(Math.random() < odds.fail){
    const msg = `GHOST came back from the ${t.period} empty-handed. The ${g.name} trail went cold.`;
    logScience(msg, false); events.toast(msg, "bad"); return;
  }
  const q = Math.round(rand(p.quality[0], p.quality[1]));
  const r = addSample(t.sp, odds.gain * rand(1 - TRIP.spread, 1 + TRIP.spread), q);
  const d = sc.dna[t.sp];
  let msg = r.gain ? `GHOST brought back ${g.name} DNA (${q}% quality). Genome ${d.genome}% complete.`
                   : `GHOST brought back more ${g.name} DNA. ${r.better > 0 ? `Quality improved to ${d.quality}%.` : "It wasn't better than what the lab already has."}`;
  // Sometimes the team turns up traces of another animal ORACLE has unlocked
  const others = SPECIES.filter(x => x.period === t.period && x.id !== t.sp && isUnlocked(x.id) && !genomeDone(x.id));
  if(others.length && Math.random() < TRIP.bonus.chance){
    const o = others[Math.floor(Math.random() * others.length)];
    const r2 = addSample(o.id, rand(TRIP.bonus.gain[0], TRIP.bonus.gain[1]), Math.round(rand(p.quality[0], p.quality[1])));
    if(r2.gain) msg += ` They also found ${o.name} traces (+${Math.round(r2.gain)}%).`;
  }
  logScience(msg, true); events.toast(msg, "good");
}

/* ---------- TAR: cloning ---------- */

const incubatorsPer = () => 1 + (hasTech("incub1") ? TAR_UPGRADE.incubators : 0) + (hasTech("incub2") ? TAR_UPGRADE.incubators : 0);
const cloneSpeed = () => hasTech("fast2") ? TAR_UPGRADE.speed ** 2 : hasTech("fast1") ? TAR_UPGRADE.speed : 1;
// Incubators in the lab. An empty lab still queues one so an order isn't lost.
const incubators = () => Math.max(1, state.science.crew.gene * incubatorsPer());
// How long a clone takes: 1 open day plus 1 more for every CLONE_DAYS_PER_SPACE m², less with faster incubators
function cloneMinutes(sp){ return Math.round((1 + SPECIES_BY_ID[sp].space / CLONE_DAYS_PER_SPACE) * DAY_MIN * cloneSpeed()); }
const tarWorking = () => !!dept("tar") && state.science.crew.gene > 0;

function cloneProblem(sp){
  const s = SPECIES_BY_ID[sp], d = state.science.dna[sp];
  return deptProblem("tar") ||
    (!state.science.crew.gene ? "Hire a Geneticist at TAR to run the incubators." : null) ||
    (!d || d.genome < 100 ? `${s.name}'s genome is ${d ? d.genome : 0}% complete. It needs 100%.` : null) ||
    (state.rating + 1e-9 < s.stars ? `Needs a ${s.stars}-star park. You have ${starTxt(state.rating)}.` : null) ||
    (!canAfford(s.price) ? `Cloning costs ${money(s.price)}. You have ${money(state.money)}.` : null);
}
// A job queue per lane (incubator, growing bed): the next job starts when the lane's last one ends. Picks the lane that frees up first.
function freeLane(jobs, lanes){
  const now = nowMin();
  let best = {lane:0, start:Infinity};
  for(let l = 0; l < lanes; l++){
    const mine = jobs.filter(c => (c.lane || 0) === l);
    const start = mine.length ? Math.max(now, ...mine.map(c => c.end)) : now;
    if(start < best.start) best = {lane:l, start};
  }
  return best;
}
const cloneReadyMin = sp => freeLane(state.science.clones, incubators()).start + cloneMinutes(sp);
function orderClone(sp, exhibitId){
  if(cloneProblem(sp)) return false;
  const s = SPECIES_BY_ID[sp], d = state.science.dna[sp];
  spend(s.price, "animals");
  const {lane, start} = freeLane(state.science.clones, incubators()), end = start + cloneMinutes(sp);
  state.science.clones.push({id:uid("a-"), sp, exhibitId:exhibitId || null, q:clamp(Math.round(d.quality + rand(-5, 5)), 5, 100), lane, start, end});
  events.toast(`TAR started a ${s.name} clone. Ready ${whenText(end)}.`);
  return true;
}
function putAnimal(e, a){
  if(!e.animals.length) e.happy = 70;
  e.animals.push({id:a.id, sp:a.sp, cl:true, q:a.q});
}
function hireScientist(kind){
  const k = SCIENTISTS[kind];
  if(!hasDept(k.dept)) return `Build ${BUILDINGS[k.dept].label} first.`;
  if(!canAfford(k.hireCost)) return `Hiring costs ${money(k.hireCost)}.`;
  spend(k.hireCost, "science"); state.science.crew[kind]++;
  return null;
}
function placeReady(id, exhibitId){
  const sc = state.science, i = sc.ready.findIndex(r => r.id === id), e = state.exhibits.find(x => x.id === exhibitId);
  if(i < 0 || !e) return false;
  putAnimal(e, sc.ready[i]); sc.ready.splice(i, 1);
  return true;
}
function finishClone(c){
  const sc = state.science, s = SPECIES_BY_ID[c.sp], e = state.exhibits.find(x => x.id === c.exhibitId);
  const health = c.q >= 70 ? "healthy" : c.q >= 50 ? "a little sickly" : "frail";
  if(e){ putAnimal(e, c); events.toast(`TAR finished a ${s.name} clone (${health}, ${c.q}% DNA quality). It moved into ${e.name}.`, "good"); }
  else { sc.ready.push({id:c.id, sp:c.sp, q:c.q}); events.toast(`TAR finished a ${s.name} clone. Tap an exhibit to move it in.`, "good"); }
}

/* ---------- CERES: growing plants and medicine ---------- */

const beds = () => dept("ceres") ? Math.max(0, state.science.crew.botanist) : 0;
const growing = (kind, era, size) => state.ceres.beds.filter(b => b.kind === kind && b.era === era && (b.size || null) === (size || null)).length;
const batchesFor = e => Math.max(1, Math.ceil(area(e.points) / FLORA_BATCH_M2));
const growInfo = (kind, era, size) => kind === "plant" ? (CERES_GROW.plant[era] || {})[size] : CERES_GROW[kind === "flora" ? "flora" : "medicine"][era];
const growMinutes = (kind, era, size) => Math.round(growInfo(kind, era, size).days * DAY_MIN);
// What a batch is called, for toasts and bed cards
const growName = (kind, era, size) => kind === "plant" ? `${ERA_LABEL[era]} ${size} plants` : kind === "flora" ? `${ERA_LABEL[era]} planting stock` : `${ERA_LABEL[era]} medicine`;

function growProblem(kind, era, size){
  const sc = state.science, c = state.ceres;
  if(!growInfo(kind, era, size)) return "CERES can't grow that.";
  const blocker = deptProblem("ceres"); if(blocker) return blocker;
  if(!sc.crew.botanist) return "Hire a botanist at CERES to tend a growing bed.";
  if(kind !== "med" && !hasTech(FLORA[era].tech)) return `Research ${FLORA[era].label} flora at ORACLE first.`;
  if(kind === "med" && !hasTech(MED_TECH[era])) return `Research ${ERA_LABEL[era]} medicine at ORACLE first.`;
  if(era !== "cenozoic" && !plantDnaDone(era)) return `GHOST has to collect ${ERA_LABEL[era]} plant DNA first (${(sc.dna[PLANT_DNA[era].id] || {genome:0}).genome}% so far).`;
  if(c.beds.length >= sc.crew.botanist * 3) return "Every bed has a full queue. Hire more botanists.";
  if(!canAfford(growInfo(kind, era, size).cost)) return `A batch costs ${money(growInfo(kind, era, size).cost)}. You have ${money(state.money)}.`;
  return null;
}
function growBatch(kind, era, size){
  if(growProblem(kind, era, size)) return false;
  const gi = growInfo(kind, era, size), {lane, start} = freeLane(state.ceres.beds, Math.max(1, state.science.crew.botanist));
  spend(gi.cost, "science");
  state.ceres.beds.push({id:uid("g-"), kind, era, ...(size ? {size} : {}), lane, start, end:start + growMinutes(kind, era, size)});
  events.toast(`CERES started a batch of ${growName(kind, era, size)}. Ready ${whenText(start + growMinutes(kind, era, size))}.`);
  return true;
}
function finishBatch(b){
  const c = state.ceres;
  if(b.kind === "plant"){ const k = b.era + "-" + b.size; c.pots[k] = (c.pots[k] || 0) + growInfo("plant", b.era, b.size).count; events.toast(`CERES finished a batch of ${growName("plant", b.era, b.size)}.`, "good"); }
  else if(b.kind === "flora"){ c.plants[b.era] = (c.plants[b.era] || 0) + 1; events.toast(`CERES finished a batch of ${ERA_LABEL[b.era]} planting stock.`, "good"); }
  else { c.meds = Math.min(medCap(), (c.meds || 0) + growInfo("med", b.era).doses); events.toast(`CERES finished a batch of ${ERA_LABEL[b.era]} medicine.`, "good"); }
}
// Doses already growing, so automatic ordering doesn't overfill the store
const pendingDoses = () => state.ceres.beds.filter(b => b.kind === "med").reduce((s, b) => s + growInfo("med", b.era).doses, 0);

// Replanting an exhibit uses up planting stock from CERES
function replantProblem(e, key){
  if(key === "cenozoic") return null;
  const f = FLORA[key], need = batchesFor(e), have = state.ceres.plants[key] || 0, cost = Math.round(area(e.points) * f.perSqM);
  return (f.tech && !hasTech(f.tech) ? `Research ${f.label} flora at ORACLE first.` : null) ||
    (!hasDept("ceres") ? "Build CERES first." : null) ||
    (have < need ? `${f.label} planting stock: needs ${need} batch${need === 1 ? "" : "es"} from CERES, which has ${have}.` : null) ||
    (!canAfford(cost) ? `That costs ${money(cost)}.` : null);
}

/* ---------- time passing ---------- */

// Called every tick. Research points trickle in, and every project, trip, clone and batch checks its own clock.
function scienceTick(dtMin){
  const sc = state.science, c = state.ceres;
  if(dept("oracle")) sc.points += sc.crew.paleo * RESEARCH_PER_PALEO * dtMin / DAY_MIN;
  const now = nowMin();
  if(sc.projects.length && sc.projects.some(p => p.end <= now)){
    const done = sc.projects.filter(p => p.end <= now);
    sc.projects = sc.projects.filter(p => p.end > now);
    done.forEach(finishProject);
  }
  if(sc.trips.length && sc.trips.some(t => t.end <= now)){
    const back = sc.trips.filter(t => t.end <= now);
    sc.trips = sc.trips.filter(t => t.end > now);
    back.forEach(tripReturns);
  }
  // with TAR closed or nobody to run it, every clone waits
  if(sc.clones.length){
    if(!tarWorking()) for(const j of sc.clones){ j.start += dtMin; j.end += dtMin; }
    else if(sc.clones.some(j => j.end <= now)){
      const done = sc.clones.filter(j => j.end <= now);
      sc.clones = sc.clones.filter(j => j.end > now);
      done.forEach(finishClone);
    }
  }
  // the same goes for the growing beds
  if(c.beds.length){
    if(!beds()) for(const j of c.beds){ j.start += dtMin; j.end += dtMin; }
    else if(c.beds.some(j => j.end <= now)){
      const done = c.beds.filter(j => j.end <= now);
      c.beds = c.beds.filter(j => j.end > now);
      done.forEach(finishBatch);
    }
  }
  // CERES keeps medicine stocked for the types set to "keep stocked"
  if(beds() && c.beds.length < beds()){
    for(const era of Object.keys(c.auto)){
      if(!c.auto[era] || (c.meds || 0) + pendingDoses() + growInfo("med", era).doses > medCap()) continue;
      if(growBatch("med", era)) break;
    }
  }
}
