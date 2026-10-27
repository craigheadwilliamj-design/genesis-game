/* =====================================================================
   PALEO-MEDICINE
   Animals fall ill (faster when hungry, dirty, or frail) and territorial
   animals hurt each other. Mild illness is hidden until a vet's routine
   check-up finds it. Vets walk out from the Paleo-Medicine Center (PMC),
   treat minor illnesses on the spot, and dart serious cases; keepers carry
   those in, and the PMC treats them with medicine from the Botany Lab once the Research Lab has
   researched it for their era.
   Vets also dart escaped animals, and keepers carry those home.
   ===================================================================== */

let vcrew = [];   // vets walking around right now (positions aren't saved)

function freshHealth(){ return {from:HEALTH.startDay, ward:[]}; }
const healthActive = () => state.day >= state.health.from;
const medTechFor = s => MED_TECH[ERA_OF[s.period]];
// An era's medicine only cures a period's animals once it has been refined for that period
const canTreat = s => hasTech(medTechFor(s)) && hasTech("ref-" + s.period);
const anyMedTech = () => Object.values(MED_TECH).some(hasTech);
const eraOf = s => ERA_OF[s.period];
const eraMedName = s => `${ERA_LABEL[eraOf(s)]} medicine`;
// Which medicine a treatment uses: the era's own if it's been researched and there's some on hand, otherwise contemporary
function pickMed(s, n){
  if(canTreat(s) && medOnHand(medGoodOf(s)) >= n) return "era";
  if(dept("pmc") && pmcStock(CMED) >= n) return "modern";
  return null;
}
const medGoodOf = s => MED_GOOD[eraOf(s)];
function takeMed(kind, n, s){ if(kind === "era") useMeds(n, medGoodOf(s)); else useMeds(n, CMED); }
// Contemporary medicine only gets a case down to the era's floor, and the animal stays chronically ill
function ease(a){
  const fl = MODERN.floor[eraOf(SPECIES_BY_ID[a.sp])];
  a.sick = {kind:a.sick.kind, sev:Math.min(a.sick.sev, fl), chronic:true};
}
const pmcs = () => state.buildings.filter(b => b.type === "pmc" && kGraph && kGraph.anchors[b.id]);
const pmcBuilding = () => state.buildings.find(b => b.type === "pmc") || null;
// Vets handle escapes whenever there's a vet and a connected PMC for them to work from
const vetsOnDuty = () => state.staff.vets.length > 0 && pmcs().length > 0;

/* ---------- Botany Lab medicine ---------- */
// The Botany Lab grows medicine in batches (see growBatch in science.js)
function medCap(){ return MEDICINE.capacity; }
const feedDoses = e => Math.ceil(e.animals.length / MEDICINE.feedPer);

/* ---------- trash thrown into exhibits (the throwing is in services.js) ---------- */

// Chance a day that an animal in e eats some of the trash thrown in today
const trashEaten = e => e.trash && e.animals.length ? Math.min(THROWN.eatMax, THROWN.eat * e.trash / e.animals.length) : 0;

/* ---------- genome therapy ---------- */
// An exhibit with e.geneTherapy on has each vet check-up lift its clones' DNA quality (a.q) toward what the lab's genome for their species (sc.dna) would give a clone today, which the Time Travel Lab raises by finding more of it.
const labQuality = sp => cloneQuality(sp);
const geneGain = a => hasTech("genetherapy") ? Math.min(GENE.step, labQuality(a.sp) - (a.q ?? 90)) : 0;
const geneCost = gain => GENE.base + Math.round(gain * GENE.perPoint);
const geneTargets = e => e.geneTherapy && hasTech("genetherapy") ? e.animals.filter(a => !a.darted && geneGain(a) >= GENE.minGain) : [];
// Why it can't be switched on, or null
function geneProblem(){
  if(!hasTech("genetherapy")) return "Research Genome therapy at the Research Lab first.";
  if(!dept("pmc")) return "Genome therapy needs a connected Paleo-Medicine Center.";
  if(!state.staff.vets.length) return "Hire a vet at the Paleo-Medicine Center.";
  return null;
}
// How long a vet's check-up of an exhibit takes, with the genome therapy it will do
const checkWork = e => HEALTH.checkMinutes + GENE.minutes * geneTargets(e).length;
// Done in the check-up: each clone the lab can improve gets a procedure while the money lasts
function geneTherapy(e, who){
  let n = 0, short = false;
  for(const a of geneTargets(e)){
    const gain = geneGain(a), cost = geneCost(gain);
    if(!canAfford(cost)){ short = true; break; }
    spend(cost, "medicine"); a.q = (a.q ?? 90) + gain; n++;
  }
  if(n) events.toast(`${who} gave genome therapy to ${n} clone${n === 1 ? "" : "s"} in ${e.name}.`, "good");
  if(short) events.toast(`${who} couldn't afford genome therapy for every clone in ${e.name}.`, "bad");
  return n;
}

/* ---------- conditions ---------- */

// Tiktaalik lives on land in the game but falls ill like a fish
const aquatic = s => !!(s.aqua || s.pool) || s.id === "tikt";
// What a body is, for who can get which condition (CONDITIONS' who and not)
function bodyTags(s){
  const c = CLADE_OF[s.id], wet = aquatic(s), t = new Set(["any", c]);
  if(c !== "invert") t.add("vert");
  if(c !== "invert" && c !== "fish") t.add("tetrapod");
  if(c !== "invert" && !wet) t.add("landvert");
  if(c === "fish" && wet) t.add("aqfish");
  if(c === "invert") t.add(wet ? "aqinvert" : "landbug");
  if(SHELLED.includes(s.id)) t.add("shelled");
  if(!["fish", "invert", "marine", "seamammal"].includes(c) && !LIMBLESS.includes(s.id)) t.add("legs");
  if(!["fish", "invert"].includes(c) && !TOOTHLESS.includes(s.id)) t.add("teeth");
  return t;
}
const BODIES = new Map();
const bodyOf = s => { if(!BODIES.has(s.id)) BODIES.set(s.id, bodyTags(s)); return BODIES.get(s.id); };
const canGet = (s, c) => c.who.some(w => bodyOf(s).has(w)) && !(c.not || []).some(w => bodyOf(s).has(w));
// A condition of these kinds that one of these causes brings on; with none that fits, any its body can get (but not one only its own cause brings). null if its body gets none.
function pickCondition(s, kinds, causes){
  const all = Object.keys(CONDITIONS).filter(id => kinds.includes(CONDITIONS[id].kind) && canGet(s, CONDITIONS[id]));
  const fit = all.filter(id => CONDITIONS[id].from.some(f => causes.includes(f))), list = fit.length ? fit : all.filter(id => !CONDITIONS[id].only);
  return list.length ? list[Math.floor(Math.random() * list.length)] : null;
}
const sickName = a => (CONDITIONS[a.sick.name] || {}).name || SICK_KIND[a.sick.kind].label;
// Where it came from, in words, or ""
const CAUSE_TEXT = {shelter:"From lack of shelter.", lamp:"From no heat lamp.", dirt:"From a dirty exhibit.", water:"From foul water.", biome:"From the wrong biome.",
                    hunger:"From hunger.", stress:"From stress.", crowd:"From crowding.", trash:"Ate trash.", plants:"Ate plants it can't digest."};
function sickCause(a){
  const sk = a.sick, hit = sk.hit;
  if(hit) return hit.how === "fight" ? `From a fight with a ${hit.by}.` : sk.name === "gore" ? `Gored by a ${hit.by}.` : `Bitten by a ${hit.by}.`;
  return CAUSE_TEXT[sk.cause] || "";
}
// How bad it is: its SICK_BAND entry
const sickBand = a => a.sick ? SICK_BAND.reduce((b, x) => a.sick.sev >= x.from ? x : b, SICK_BAND[0]) : null;
// A weighted pick among the causes raising a chance ({cause: weight}), or null
function pickCause(w){
  let t = 0; for(const k in w) t += w[k];
  let r = Math.random() * t; for(const k in w){ r -= w[k]; if(r <= 0) return k; }
  return null;
}

/* ---------- who gets sick ---------- */

// Old plant-eaters eating plants they never evolved for (see grassShare), 0 to 1
const grassSick = (e, s) => GRASS_INTOLERANT.includes(s.period) ? grassShare(e, s) : 0;
const hungerShare = e => clamp((e.hungryMin || 0) / DAY_MIN, 0, 1);
const medicated = (e, s) => !!e.medFedOk && canTreat(s);
const crowded = e => { const rep = derived && derived.reports[e.id]; return rep && rep.need ? rep.area / rep.need : 1; };

// Chance a day this animal gets an infection (or a poisoning from dirt or foul water), and what's raising it: why lists the causes, w weighs them
function illChance(e, a){
  const s = SPECIES_BY_ID[a.sp], wet = aquatic(s), why = [], w = {};
  let p = HEALTH.illChance;
  const raise = (m, cause) => { if(!(m > 1)) return; p *= m; if(!w[cause]) why.push(cause); w[cause] = (w[cause] || 0) + m - 1; };
  const hg = hungerShare(e); if(hg > .02) raise(1 + HEALTH.hungerMult * hg, "hunger");
  const d = e.dirt || 0; if(d > CLEAN.penaltyFrom) raise(1 + (d - CLEAN.penaltyFrom) / HEALTH.dirtPer, wet ? "water" : "dirt");
  const q = a.q ?? 90; if(q < 50) p *= HEALTH.frail.below50; else if(q < 70) p *= HEALTH.frail.below70;
  if(thirsty(e, s)) raise(HAB.dryIll, "thirst");
  if((e.aqua || e.palu && paluSwims(s)) && wqOf(e) < AQUA.foul) raise(1 + (AQUA.ill - 1) * (1 - wqOf(e) / AQUA.foul), "water");
  if(e.viv && !e.aqua && wantsHeat(s)){   // a basking lamp keeps the cold-blooded well; without one a cold snap makes them ill
    const hs = heatShare(e);
    if(hs > 0) p *= 1 + (VIV_LAMP.ill - 1) * hs;
    if(hs < 1){ if(!w.lamp) why.push("lamp"); w.lamp = (w.lamp || 0) + (1 - VIV_LAMP.ill) * (1 - hs); }
    if(hs < 1 && state.weather && state.weather.today === "cold") raise(1 + (VIV_LAMP.cold - 1) * (1 - hs), "lamp");
  }
  const wx = weatherNow(), x = exposure(e);
  if(wx.ill && x > 0 && !(state.weather.today === "cold" && COLD_HARDY.includes(s.id))) raise(1 + wx.ill * x, "shelter");
  if(a.need && a.need.stress > 60) raise(BEHAVIOR.stressIll, "stress");
  if(crowded(e) < 1) raise(HEALTH.crowdIll, "crowd");
  if(medicated(e, s)) p *= MEDICINE.feedCut;
  return {p, why, w};
}
// Chance a day this animal is hurt by rivals, a species that preys on it, the weather or the ground
function injuryChance(e, a){
  const s = SPECIES_BY_ID[a.sp], counts = speciesCounts(e), why = [], w = {};
  let p = 0;
  const add = (v, cause) => { if(!(v > 0)) return; p += v; if(!w[cause]) why.push(cause); w[cause] = (w[cause] || 0) + v; };
  const n = counts.get(s.id) || 0;
  if(TERRITORIAL.includes(s.id) && n > 1){ const r = crowded(e); add(HEALTH.territorial * (n - 1) * (r < 1 ? 3 : r < 1.5 ? 1.5 : 1), "fight"); }
  for(const sp of counts.keys()) if(sp !== s.id && attackReason(SPECIES_BY_ID[sp], s)){ add(HEALTH.attacked, "attack"); break; }
  // storms hurt animals caught out in them
  const wx = weatherNow(), x = wx.hurt ? exposure(e) : 0;
  if(x > 0) add(wx.hurt * x, "shelter");
  // Bumblefoot: sore feet from dirty ground or the wrong ground
  if(canGet(s, CONDITIONS.bumblefoot)){
    if((e.dirt || 0) > CLEAN.penaltyFrom) add(HEALTH.ground, "dirt");
    if(biomeFit(s, biomeOf(e)) === "away") add(HEALTH.ground, "biome");
  }
  return {p, why, w};
}
// The causes behind an injury: a fight with (or attack by) a species with horns or tusks can gore
function injuryCauses(e, s, cause){
  if(cause === "fight" && GORES.includes(s.id)) return ["fight", "gore"];
  if(cause === "attack" && [...speciesCounts(e).keys()].some(sp => GORES.includes(sp) && attackReason(SPECIES_BY_ID[sp], s))) return ["attack", "gore"];
  return [cause];
}

// Everything the exhibit panel says about health
// Sick animals the player (and the vets) know about. Mild illness stays hidden until a check-up.
const noticed = a => !!a.sick && !a.sick.hidden;
// An animal's health as the player sees it, 0 to 100: full unless it's known to be sick or hurt, then less as it gets worse
const animalHp = a => noticed(a) ? clamp(100 - a.sick.sev, 0, 100) : 100;
const hpColor = hp => hp >= 100 ? "var(--good)" : hp > 60 ? "var(--warn)" : "var(--bad)";
const daysSinceCheck = e => e.vetCheck == null ? 99 : state.day - e.vetCheck;
function healthReport(e){
  const sick = e.animals.filter(noticed), hidden = e.animals.filter(a => a.sick && a.sick.hidden).length;
  let ill = 0, hurt = 0; const why = new Set();
  for(const a of e.animals){ if(a.sick) continue; const i = illChance(e, a), j = injuryChance(e, a); ill += i.p; hurt += j.p; i.why.concat(j.why).forEach(w => why.add(w)); }
  const well = e.animals.length - sick.length;
  return {sick, hidden, ill:well ? ill / well : 0, hurt:well ? hurt / well : 0, why:[...why]};   // why: the causes raising either
}

// Low hunger, water and sanitation for some of an exhibit's animals, as health list items [level, text]. Only what is low shows.
function basicsLow(e, list){
  const out = [], one = list.length === 1, low = k => list.filter(a => a.need && a.need[k] >= 50), who = k => { const n = low(k).length; return n ? (one ? "It's" : `${n} of ${list.length} are`) : ""; };
  const worst = k => Math.max(0, ...list.map(a => a.need ? a.need[k] : 0)), lvl = k => worst(k) >= 75 ? "bad" : "warn";
  if(!freeFeeding()){
    const need = dailyNeed(e), empty = Object.keys(need).filter(t => stockFor(e, t) <= .01), thin = Object.keys(need).filter(t => !empty.includes(t) && stockFor(e, t) < storeMax(e, t) * .25);
    if(empty.length) out.push(["bad", `Out of ${empty.join(" and ")}.`]);
    else if(thin.length) out.push(["warn", `Running low on ${thin.join(" and ")}.`]);
  }
  if(who("hunger")) out.push([lvl("hunger"), `${who("hunger")} hungry.`]);
  const noWater = list.some(a => thirsty(e, SPECIES_BY_ID[a.sp]));
  if(noWater) out.push(["bad", e.viv ? "No pool for the animals that need one." : "No water for the animals that need it."]);
  if(who("thirst")) out.push([lvl("thirst"), `${who("thirst")} thirsty.`]);
  const dirt = e.dirt || 0;
  if(dirt >= CLEAN.dirtyAt) out.push([dirt >= 60 ? "bad" : "warn", `${lagoonWalled(e) ? "Water quality" : "Sanitation"} is low (${Math.round(100 - dirt)}%).`]);
  return out;
}


// A new case of a condition (a CONDITIONS id). A mild infection stays hidden until it gets bad or a vet checks.
function fallSick(a, id, cause, sev){
  const c = CONDITIONS[id], k = SICK_KIND[c.kind];
  a.sick = {kind:c.kind, name:id, sev:sev ?? k.start};
  if(cause) a.sick.cause = cause;
  if(k.hidden && a.sick.sev < HEALTH.obviousAt) a.sick.hidden = true;
  return a.sick;
}
// Can a vet cure this one where it stands?
// A chronic case only comes back for a real cure, with the era's own medicine.
function fieldTreatable(a){
  if(!noticed(a) || a.darted) return false;
  // a chronic case (illness or injury) is already eased, so only the era's own medicine matters
  const k = SICK_KIND[a.sick.kind];
  if(a.sick.chronic) return pickMed(SPECIES_BY_ID[a.sp], k.fieldDose) === "era";
  if(a.sick.sev >= k.field) return false;   // poisonings are treated on the spot however bad
  return !!pickMed(SPECIES_BY_ID[a.sp], k.fieldDose);
}

// What's happening to one sick animal, in words
function sickStatus(e, a){
  const s = SPECIES_BY_ID[a.sp];
  if(a.sick.chronic && !fieldTreatable(a)) return canTreat(s) ? `Chronic. A vet will cure it once the Botany Lab has ${eraMedName(s).toLowerCase()} on hand.` : `Chronic. Contemporary medicine eased it, but only ${eraMedName(s).toLowerCase()} from the Botany Lab can cure it fully.`;
  if(a.darted){ const t = state.staff.transfers.find(x => x.animalId === a.id); return t && t.keeper ? "Darted. A keeper is coming to carry it to the PMC." : "Darted. Waiting for a keeper to carry it to the PMC."; }
  if(!hasDept("pmc")) return "Build a Paleo-Medicine Center and hire a vet to treat it.";
  if(!state.staff.vets.length) return "Hire a vet at the Paleo-Medicine Center.";
  if(!dept("pmc")) return "The PMC isn't connected. Run a path or service road to it.";
  if(!kGraph || !kGraph.anchors[e.id]) return "Vets can't get in.";
  const mine = vcrew.find(c => c.patient && c.patient.a === a.id);
  if(mine) return mine.patient.field ? (mine.job === "treating" ? "A vet is treating it here." : "A vet is on the way to treat it here.") : "A vet is on the way to dart it.";
  if(a.sick.sev < SICK_KIND[a.sick.kind].field && !fieldTreatable(a) && bedsFree() > 0) return "Minor, but the PMC is out of medicine, so it goes to the PMC. Waiting for a free vet.";
  if(fieldTreatable(a)) return a.sick.cause === "trash" ? "Ate trash. A vet can flush it out here. Waiting for a free vet." : "Minor. A vet can treat it here. Waiting for a free vet.";
  if(bedsFree() <= 0) return "The PMC is full. It waits for a free bed.";
  return "Waiting for a free vet.";
}
function patientStatus(p){
  const s = SPECIES_BY_ID[p.a.sp];
  if(p.cured){
    const t = state.staff.transfers.find(x => x.animalId === p.a.id), done = p.a.sick && p.a.sick.chronic ? "As well as contemporary medicine can make it." : "Recovered.";
    return `${done} ${t && t.keeper ? "A keeper is taking it home." : "Waiting for a keeper to take it home."}`;
  }
  if(!state.staff.vets.length) return "Stable. Hire a vet to treat it.";
  if(p.med === "modern") return `Being treated with contemporary medicine. It won't fully recover without ${eraMedName(s).toLowerCase()}.`;
  if(p.med === "era") return "Being treated.";
  return "Stable. Waiting for medicine. Suppliers restock the PMC every night.";
}

/* ---------- the ward ---------- */

function bedsFree(){
  const h = state.health, pmc = pmcBuilding(); if(!pmc) return 0;
  const coming = state.staff.transfers.filter(t => t.to === pmc.id).length;
  const darting = vcrew.filter(c => c.patient && !c.patient.field).length;
  return HEALTH.beds - h.ward.length - coming - darting;
}
// A keeper brings an animal in
function admit(a, t){
  delete a.darted;
  state.health.ward.push({a, home:t.from, med:null, since:state.day});
  events.toast(`A sick ${SPECIES_BY_ID[a.sp].name} was admitted to the PMC.`);
  events.changed();
}
// A keeper takes a recovered animal out
function discharge(id){
  const h = state.health, i = h.ward.findIndex(p => p.a.id === id);
  if(i < 0) return null;
  return h.ward.splice(i, 1)[0].a;
}
// Send an animal back to an exhibit (or holding) without a keeper
function sendHome(a, homeId){
  delete a.darted;
  const e = state.exhibits.find(x => x.id === homeId);
  if(e){ if(!e.animals.length) e.happy = 70; e.animals.push(a); }
  else { const pmc = pmcBuilding(), [x, y] = pmc ? centroid(pmc.points) : labSpot(); dropCrate(a, x, y); }
}
// The PMC was bulldozed: patients go home as they are, and nobody is carried there any more
function pmcRemoved(b){
  const h = state.health;
  for(const p of h.ward) sendHome(p.a, p.home);
  h.ward = [];
  state.staff.transfers = state.staff.transfers.filter(t => t.to !== b.id && t.from !== b.id);
  for(const e of state.exhibits) for(const a of e.animals) delete a.darted;
  for(const c of vcrew){ if(c.patient && !c.patient.field){ c.patient = null; c.job = "idle"; c.route = []; } }
}

/* ---------- vets ---------- */

function syncVets(){
  const ids = new Set(state.staff.vets.map(v => v.id));
  // a vet who was let go drops whatever they were chasing
  for(const c of vcrew) if(!ids.has(c.id) && c.loose){ c.loose.vet = null; if(c.loose.status === "darting") c.loose.status = "loose"; }
  vcrew = vcrew.filter(c => ids.has(c.id));
  for(const v of state.staff.vets) if(!vcrew.some(c => c.id === v.id)) vcrew.push({id:v.id, at:null, route:[], t:0, job:"idle", wait:0, work:0, loose:null, patient:null, check:null});
}

function vetGo(c, n, job){
  const w = walkFrom(c.at, c);
  if(!n || !w.dist.has(n)) return false;
  setRoute(c, w, n); c.job = job;
  return true;
}

// An escaped animal nobody else is darting
function vetHuntJob(c){
  const loose = state.safety.loose;
  return loose.find(l => l.status === "loose" && l.vet === c.id) || loose.find(l => l.status === "loose" && !l.vet) || null;
}
// The worst known sick animal vets can reach: minor ones are treated where they stand,
// the rest need a free PMC bed
const vetZone = c => (state.staff.vets.find(v => v.id === c.id) || {}).zone;   // a vet in a zone only treats that zone's exhibits
function pickPatient(c, only){
  if(!dept("pmc")) return null;
  const vz = vetZone(c);
  const taken = new Set(vcrew.filter(x => x !== c && x.patient).map(x => x.patient.a)), beds = bedsFree() > 0;
  let best = null;
  for(const e of state.exhibits){
    if(!kGraph.anchors[e.id] || (vz && e.zone !== vz) || (only && e.id !== only)) continue;
    for(const a of e.animals){
      if(!noticed(a) || a.darted || taken.has(a.id)) continue;
      const field = fieldTreatable(a);
      if(a.sick.chronic && !field) continue;
      const urgent = a.sick.kind === "poison" ? 1000 : 0;
      if((field || beds) && (!best || a.sick.sev + urgent > best.score)) best = {e, a, field, score:a.sick.sev + urgent};
    }
  }
  return best;
}
// The exhibit most overdue for a check-up that no other vet is heading to
function pickCheck(c){
  if(!healthActive()) return null;
  const taken = new Set(vcrew.filter(x => x !== c && x.check).map(x => x.check)), vz = vetZone(c);
  let best = null;
  for(const e of state.exhibits){
    if(!e.animals.length || !kGraph.anchors[e.id] || taken.has(e.id) || (vz && e.zone !== vz) || daysSinceCheck(e) < HEALTH.checkEvery) continue;
    if(!best || daysSinceCheck(e) > daysSinceCheck(best)) best = e;
  }
  return best;
}

function vetDecide(c){
  const l = vetHuntJob(c);
  if(l){
    l.vet = c.id; c.loose = l;
    if(vetGo(c, kGraph.nodes.get(l.next || l.at), "hunting")){ delete l.noVet; return; }
    l.vet = null; c.loose = null; l.noVet = true;   // keepers can try it with a dart gun
  }
  // a vet the player called looks at that exhibit's sick animals first
  const call = callJob(c, "vet");
  if(call){ if(vetGo(c, kGraph.anchors[call.ex], "toCall")) return; call.keeper = null; }
  // a finished specimen from the Genetics Lab goes to its exhibit before patients and check-ups
  const dv = deliveryJob(c, walkFrom(c.at, c));
  if(dv){
    if(dv.cargo && !c.cargo){ c.cargo = dv.cargo; c.crate = true; }
    c.move = dv;
    if(vetGo(c, kGraph.anchors[c.cargo ? dv.to : dv.from], c.cargo ? "toDropoff" : "toPickup")) return;
    dv.keeper = null; c.move = null;
  }
  const fx = c.focusEx; c.focusEx = null;
  const p = pickPatient(c, fx) || pickPatient(c);
  if(p){ c.patient = {e:p.e.id, a:p.a.id, field:p.field}; if(vetGo(c, kGraph.anchors[p.e.id], "toPatient")) return; c.patient = null; }
  const ex = pickCheck(c);
  if(ex){ c.check = ex.id; if(vetGo(c, kGraph.anchors[ex.id], "toCheck")) return; c.check = null; }
  c.wait = 15;
  const home = pmcs()[0];
  if(home && kGraph.anchors[home.id] !== c.at) vetGo(c, kGraph.anchors[home.id], "home");
}

function vetArrive(c){
  if(c.job === "toPickup"){ labPickup(c, (n, job) => vetGo(c, n, job)); return; }
  if(c.job === "toDropoff"){ labDrop(c); return; }
  if(c.job === "hunting"){
    const l = c.loose, lp = l && loosePos(l);
    if(!l || l.status !== "loose" || !state.safety.loose.includes(l)){ c.loose = null; c.job = "idle"; return; }
    const [x, y] = keeperPos(c);
    if(lp && Math.hypot(lp[0] - x, lp[1] - y) < 10){ l.status = "darting"; c.job = "darting"; c.work = ESCAPE.sedateMinutes; return; }
    c.job = "idle"; c.wait = 1; return;   // it moved; chase it again (the wait keeps a vet already at the stop from re-planning forever)
  }
  if(c.job === "toCall"){
    const call = callFor(c), e = call && state.exhibits.find(x => x.id === call.ex);
    if(call) state.staff.calls = state.staff.calls.filter(x => x !== call);
    if(e && kGraph.anchors[e.id] === c.at){ c.check = e.id; c.focusEx = e.id; c.job = "checking"; c.work = checkWork(e); return; }
    c.job = "idle"; return;
  }
  if(c.job === "toPatient"){
    const e = c.patient && state.exhibits.find(x => x.id === c.patient.e), a = e && e.animals.find(x => x.id === c.patient.a);
    if(a && noticed(a) && !a.darted && kGraph.anchors[e.id] === c.at){
      // things may have changed on the way: treat it here if we still can, otherwise dart it if there's a bed
      if(fieldTreatable(a)){ c.patient.field = true; c.job = "treating"; c.work = SICK_KIND[a.sick.kind].fieldMin; return; }
      c.patient.field = false;   // now this vet is holding a bed, so there has to be one
      if(bedsFree() >= 0){ c.job = "darting"; c.work = HEALTH.dartMinutes; return; }
    }
    c.patient = null; c.job = "idle"; return;
  }
  if(c.job === "toCheck"){
    const e = state.exhibits.find(x => x.id === c.check);
    if(e && kGraph.anchors[e.id] === c.at){ c.job = "checking"; c.work = checkWork(e); return; }
    c.check = null; c.job = "idle"; return;
  }
  c.job = "idle";
}

// A check-up turns up any hidden illness
function checkDone(c){
  const e = state.exhibits.find(x => x.id === c.check), v = state.staff.vets.find(x => x.id === c.id);
  c.check = null; c.job = "idle"; c.wait = 0;
  if(!e) return;
  e.vetCheck = state.day;
  if(geneTherapy(e, v ? v.name : "A vet")) events.changed();
  const found = e.animals.filter(a => a.sick && a.sick.hidden);
  for(const a of found) delete a.sick.hidden;
  if(found.length){ events.toast(`${v ? v.name : "A vet"} found ${found.length === 1 ? `an early illness in a ${SPECIES_BY_ID[found[0].sp].name}` : `${found.length} animals with early illness`} in ${e.name}.`); events.changed(); }
}
// A minor illness treated where the animal stands: no dart, no trip to the PMC
function treatDone(c){
  const e = c.patient && state.exhibits.find(x => x.id === c.patient.e), a = e && e.animals.find(x => x.id === c.patient.a), v = state.staff.vets.find(x => x.id === c.id);
  c.patient = null; c.job = "idle"; c.wait = 0;
  if(!a || !a.sick) return;
  const s = SPECIES_BY_ID[a.sp], dose = SICK_KIND[a.sick.kind].fieldDose, k = pickMed(s, dose);
  if(!k || (a.sick.chronic && k !== "era")){ events.toast(`${v ? v.name : "A vet"} ran out of medicine before treating a ${s.name} in ${e.name}.`, "bad"); return; }
  takeMed(k, dose, s);
  if(k === "era"){ delete a.sick; events.toast(`${v ? v.name : "A vet"} treated a ${s.name} in ${e.name} on the spot.`, "good"); }
  else { ease(a); events.toast(`${v ? v.name : "A vet"} treated a ${s.name} in ${e.name} with contemporary medicine. It won't fully recover without ${eraMedName(s).toLowerCase()}.`); }
  events.changed();
}

// The dart takes hold
function dartDone(c){
  const v = state.staff.vets.find(x => x.id === c.id), who = v ? v.name : "A vet";
  if(c.loose){
    const l = c.loose; c.loose = null;
    if(state.safety.loose.includes(l) && l.status === "darting"){ l.status = "sedated"; l.byVet = true; l.vet = null; events.toast(`${who} darted the escaped ${SPECIES_BY_ID[l.sp].name}. A keeper needs to carry it back.`, "good"); events.changed(); }
  } else if(c.patient){
    const e = state.exhibits.find(x => x.id === c.patient.e), a = e && e.animals.find(x => x.id === c.patient.a), pmc = pmcBuilding();
    c.patient = null;
    if(a && pmc){
      a.darted = true;
      state.staff.transfers.push({id:uid("tr-"), animalId:a.id, sp:a.sp, from:e.id, to:pmc.id, med:true});
      events.toast(`${who} darted a sick ${SPECIES_BY_ID[a.sp].name} in ${e.name}. A keeper will carry it to the PMC.`);
      events.changed();
    }
  }
  c.job = "idle"; c.wait = 0;
}

function vetsTick(dtMin){
  if(!kGraph) return;
  syncVets();
  for(const c of vcrew){
    if(!c.at){ const p = pmcs()[0]; if(!p) continue; c.at = kGraph.anchors[p.id]; }
    let left = dtMin, steps = 0;
    while(left > 0 && steps++ < 40){
      const call = c.job !== "toCall" ? callFor(c) : null;
      if(call && !vetBusy(c) && c.t === 0){ takeVetCall(c, call); if(c.job === "toCall") continue; }
      if(c.job === "darting" || c.job === "treating" || c.job === "checking"){
        const w = Math.min(c.work, left); c.work -= w; left -= w;
        if(c.work <= 0) ({darting:dartDone, treating:treatDone, checking:checkDone})[c.job](c);
        continue;
      }
      if(c.route.length){
        const nx = c.route[0], d = Math.hypot(nx.x - c.at.x, nx.y - c.at.y), sp = VET.speed * (onAtv(c) ? VEHICLES.speedMult : 1), go = sp * left, rem = d * (1 - c.t);
        if(go < rem){ c.t += go / (d || 1); left = 0; }
        else { left -= rem / sp; c.at = nx; c.route.shift(); c.t = 0; atNode(c); if(!c.route.length) vetArrive(c); }
        continue;
      }
      if(c.job !== "idle"){ vetArrive(c); continue; }
      if(c.wait > 0){ const w = Math.min(c.wait, left); c.wait -= w; left -= w; continue; }
      vetDecide(c);
      if(c.job === "idle" && !c.route.length && c.wait <= 0) c.wait = 5;
    }
  }
}

function vetsNight(){ for(const c of vcrew){ resetAtv(c); c.at = null; c.route = []; c.job = "idle"; c.loose = null; c.patient = null; c.check = null; c.focusEx = null; } }

function hireVet(){
  if(!hasDept("pmc")) return "Build a Paleo-Medicine Center first.";
  if(!canAfford(VET.hireCost)) return `Hiring costs ${money(VET.hireCost)}.`;
  spend(VET.hireCost, "built");
  const used = new Set(state.staff.keepers.concat(state.staff.mechanics, state.staff.vets).map(k => k.name));
  const name = ["Dr. Alvarez","Dr. Bakker","Dr. Chen","Dr. Dahl","Dr. Ekwueme","Dr. Fox","Dr. Grant","Dr. Horner","Dr. Ito","Dr. Joshi","Dr. Kaur","Dr. Lund"].find(n => !used.has(n)) || "Vet " + (state.staff.vets.length + 1);
  state.staff.vets.push({id:uid("v-"), name});
  return null;
}
function vetStatus(v){
  const c = vcrew.find(x => x.id === v.id); if(!c) return "Clocking in";
  const e = state.exhibits.find(x => x.id === (c.patient ? c.patient.e : c.check)), n = e ? e.name : "an exhibit";
  const sp = c.loose ? SPECIES_BY_ID[c.loose.sp].name : "";
  return {hunting:`Tracking the escaped ${sp}`, toPatient:`Heading to a sick animal in ${n}`, treating:`Treating a sick animal in ${n}`,
          toCall:`Called to ${(state.exhibits.find(x => x.id === (callFor(c) || {}).ex) || {name:"an exhibit"}).name}`, toCheck:`Heading to check on ${n}`, checking:`Checking the animals in ${n}`,
          darting:c.loose ? `Darting the escaped ${sp}` : `Darting a sick animal in ${e ? e.name : "an exhibit"}`, home:"Heading back to the PMC",
          toPickup:`Collecting a ${c.move ? SPECIES_BY_ID[c.move.sp].name : "specimen"} from the Genetics Lab`, toDropoff:`Delivering a ${c.cargo ? SPECIES_BY_ID[c.cargo.sp].name : "specimen"}`}[c.job] || "Waiting for work";
}

/* ---------- through the day ---------- */

let healthAcc = 0;
function healthTick(dtMin){
  healthAcc += dtMin;
  while(healthAcc >= HEALTH.step){ healthAcc -= HEALTH.step; healthStep(HEALTH.step / DAY_MIN); }
}
// A sick animal whose case the player can see: one toast
const caseToast = (e, a, text, kind) => events.toast(`A ${SPECIES_BY_ID[a.sp].name} in ${e.name} ${text}`, kind ?? "bad");
// A new case in an exhibit
function newCase(e, a, id, cause){
  if(!id) return;
  const sk = fallSick(a, id, cause);
  if(!sk.hidden) caseToast(e, a, `has ${sickName(a)}.`);
  if((cause === "fight" || cause === "attack") && typeof herd !== "undefined" && herd.has(a.id)) events.fx("dust", herd.get(a.id).x, herd.get(a.id).y);
  events.changed();
}
// One health step, a share f of a day: sick animals get worse (or a mild injury heals), and the well ones may fall ill or get hurt
function healthStep(f){
  const roll = p => p > 0 && Math.random() < 1 - Math.pow(1 - Math.min(1, p), f);
  for(const e of state.exhibits){
    const dirty = (e.dirt || 0) > CLEAN.penaltyFrom, hungry = hungerShare(e) > .5, te = trashEaten(e);
    for(const a of [...e.animals]){
      const s = SPECIES_BY_ID[a.sp];
      if(a.sick){ sickStep(e, a, s, f, dirty, hungry); continue; }
      if(!healthActive()) continue;
      if(roll(te)){ newCase(e, a, "foreign", "trash"); continue; }
      const j = injuryChance(e, a);
      if(roll(j.p)){
        const c = pickCause(j.w); newCase(e, a, pickCondition(s, ["injury"], injuryCauses(e, s, c)), c);
        const by = c === "fight" ? s : c === "attack" ? [...speciesCounts(e).keys()].map(sp => SPECIES_BY_ID[sp]).find(o => attackReason(o, s)) : null;
        if(by && a.sick) a.sick.hit = {by:by.name, how:c === "fight" ? "fight" : "hunt"};
        continue;
      }
      const gs = grassSick(e, s);
      if(roll(HEALTH.grassSick * gs)){ newCase(e, a, "modernplant", "plants"); continue; }
      const i = illChance(e, a);
      if(roll(i.p)){ const c = pickCause(i.w); newCase(e, a, c ? pickCondition(s, ["infection", "poison"], [c]) : pickCondition(s, ["infection"], []), c); }
    }
  }
}
// A sick animal for part of a day: worse, or a mild injury mending on its own when it's well looked after
function sickStep(e, a, s, f, dirty, hungry){
  if(a.darted || a.sick.chronic) return;   // darted: stable until it reaches the PMC; chronic: eased, holding steady
  const k = SICK_KIND[a.sick.kind], n = a.need || {};
  if(a.sick.kind === "injury" && a.sick.sev < SICK_BAND[1].from && !dirty && hungerShare(e) < .1 && !thirsty(e, s) && (n.stress || 0) < HEALTH.healStress){
    a.sick.sev -= HEALTH.heal * f;
    if(a.sick.sev <= 0){ delete a.sick; events.changed(); }
    return;
  }
  a.sick.sev += k.worsen * f * (hungry ? 1.5 : 1) * (dirty ? 1.3 : 1) * (medicated(e, s) ? .5 : 1);
  if(a.sick.sev >= 100){ animalDies(e, a); return; }
  if(a.sick.hidden && a.sick.sev >= HEALTH.obviousAt){ delete a.sick.hidden; caseToast(e, a, `is showing signs of ${sickName(a)}.`); events.changed(); }
  if(!a.sick.warned && a.sick.sev >= SICK_BAND[2].from){ a.sick.warned = true; caseToast(e, a, "is critical."); }
}

/* ---------- each night ---------- */

function healthNight(){
  const h = state.health;
  // medicated feed: Botany Lab doses go out to exhibits that asked for it and were fed
  for(const e of state.exhibits){
    e.medFedOk = false;
    if(!e.medFeed || !e.animals.length || !anyMedTech()) continue;
    const need = feedDoses(e);
    // the feed is mixed from the era medicines of the animals it can help; take it from whichever the PMC holds
    const goods = [...new Set(e.animals.map(a => SPECIES_BY_ID[a.sp]).filter(canTreat).map(medGoodOf))];
    if(hungerShare(e) < .5 && goods.reduce((s, g) => s + pmcStock(g), 0) >= need){
      let left = need; for(const g of goods){ const t = Math.min(left, pmcStock(g)); useMeds(t, g); left -= t; }
      e.medFedOk = true;
    }
  }
  // the keepers clear out the day's trash
  for(const e of state.exhibits) e.trash = 0;
  // the ward: patients don't get worse here, and vets treat as many as they can
  const pmc = dept("pmc");
  let cap = pmc ? state.staff.vets.length * VET.patients : 0;
  for(const p of [...h.ward].sort((x, y) => (y.a.sick ? y.a.sick.sev : 0) - (x.a.sick ? x.a.sick.sev : 0))){
    if(p.cured || cap <= 0) continue;
    const s = SPECIES_BY_ID[p.a.sp];
    // start a course of medicine, or switch to the era's own once it's available
    if(p.med !== "era"){ const k = pickMed(s, HEALTH.dose); if(k && (k === "era" || !p.med)){ takeMed(k, HEALTH.dose, s); p.med = k; } }
    if(!p.med) continue;
    cap--;
    const era = eraOf(s), fl = MODERN.floor[era];
    if(p.med === "modern"){
      if(p.a.sick.sev - HEALTH.healPerNight * MODERN.heal[era] > fl){ p.a.sick.sev -= HEALTH.healPerNight * MODERN.heal[era]; continue; }
      ease(p.a);
    } else p.a.sick.sev -= HEALTH.healPerNight;
    if(p.a.sick.chronic || p.a.sick.sev <= 0){
      const chronic = !!p.a.sick.chronic;
      if(!chronic) delete p.a.sick;
      p.cured = true;
      const home = state.exhibits.find(x => x.id === p.home);
      if(home) state.staff.transfers.push({id:uid("tr-"), animalId:p.a.id, sp:p.a.sp, from:pmcBuilding().id, to:home.id, med:true});
      else { discharge(p.a.id); const [x, y] = centroid(pmcBuilding().points); dropCrate(p.a, x, y); }
      events.toast(`${chronic ? `Contemporary medicine got a ${s.name} as well as it can. It still has a chronic illness only ${eraMedName(s).toLowerCase()} can cure.` : `The PMC cured a ${s.name}.`}${home ? ` A keeper will take it back to ${home.name}.` : " Its exhibit is gone, so it waits in a crate."}`, chronic ? "" : "good");
    }
  }
  for(const e of state.exhibits) e.hungryMin = 0;
  if(state.day + 1 === h.from) events.toast("Animals can start falling ill tomorrow.", "bad");
}

function animalDies(e, a){
  e.animals.splice(e.animals.indexOf(a), 1);
  state.staff.transfers = state.staff.transfers.filter(t => t.animalId !== a.id);
  state.rating = Math.max(0, state.rating - .05);
  const hit = a.sick.hit, cause = a.sick.killed && hit ? `Killed by a ${hit.by}` : sickName(a);
  events.died({animal:SPECIES_BY_ID[a.sp].name, exhibit:e.name, cause});
}
