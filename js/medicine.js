/* =====================================================================
   PALEO-MEDICINE
   Animals fall ill (faster when hungry, dirty, or frail) and territorial
   animals hurt each other. Mild illness is hidden until a vet's routine
   check-up finds it. Vets walk out from the Paleo-Medicine Center (PMC),
   treat minor illnesses on the spot, and dart serious cases; keepers carry
   those in, and the PMC treats them with CERES medicine once ORACLE has
   researched it for their era.
   Vets also dart escaped animals, and keepers carry those home.
   ===================================================================== */

let vcrew = [];   // vets walking around right now (positions aren't saved)

function freshHealth(){ return {from:HEALTH.startDay, ward:[], cmeds:0}; }
const healthActive = () => state.day >= state.health.from;
const medTechFor = s => MED_TECH[ERA_OF[s.period]];
// An era's medicine only cures a period's animals once it has been refined for that period
const canTreat = s => hasTech(medTechFor(s)) && hasTech("ref-" + s.period);
const anyMedTech = () => Object.values(MED_TECH).some(hasTech);
const eraOf = s => ERA_OF[s.period];
const eraMedName = s => `${ERA_LABEL[eraOf(s)]} medicine`;
// Which medicine a treatment uses: the era's own if it's been researched and there's some on hand, otherwise contemporary
function pickMed(s, n){
  if(canTreat(s) && medOnHand() >= n) return "era";
  if(dept("pmc") && (state.health.cmeds || 0) >= n) return "modern";
  return null;
}
function takeMed(kind, n){ if(kind === "era") useMeds(n); else state.health.cmeds -= n; }
// Contemporary medicine only gets a case down to the era's floor, and the animal stays chronically ill
function ease(a){
  const fl = MODERN.floor[eraOf(SPECIES_BY_ID[a.sp])];
  a.sick = {kind:a.sick.kind, sev:Math.min(a.sick.sev, fl), chronic:true};
}
// Overnight, suppliers top the PMC up with contemporary medicine
function modernMedsNight(){
  const h = state.health;
  if(!dept("pmc")) return;
  const n = Math.min(MODERN.stock - (h.cmeds || 0), Math.floor(Math.max(0, state.money) / MODERN.cost));
  if(n > 0){ h.cmeds = (h.cmeds || 0) + n; spend(n * MODERN.cost, "medicine"); }
}
const pmcs = () => state.buildings.filter(b => b.type === "pmc" && kGraph && kGraph.anchors[b.id]);
const pmcBuilding = () => state.buildings.find(b => b.type === "pmc") || null;
// Vets handle escapes whenever there's a vet and a connected PMC for them to work from
const vetsOnDuty = () => state.staff.vets.length > 0 && pmcs().length > 0;

/* ---------- CERES medicine ---------- */
// CERES grows medicine in batches (see growBatch in science.js)
function medCap(){ return MEDICINE.capacity; }
const feedDoses = e => Math.ceil(e.animals.length / MEDICINE.feedPer);

/* ---------- trash thrown into exhibits ---------- */

// Is there a working Do Not Feed sign by this exhibit's fence?
const hasNoFeed = e => state.buildings.some(b => b.type === "nofeed" && !isBroken(b) && distToEdge(...centroid(b.points), e.points) <= THROWN.signReach);
// Chance a minute that a party at (x, y) throws trash into exhibit e: bins, guards and the sign cut it
function throwChance(p, e, x, y){
  let c = p.rowdy ? THROWN.rowdy * (1 + Math.min(2.5, Math.max(0, VANDAL.moodBelow - p.mood) / 30)) : p.trash ? THROWN.normal : 0;
  if(!c) return 0;
  if(nearBin(x, y)) c *= THROWN.binCut;
  if(hasNoFeed(e)) c *= THROWN.signCut;
  if(guardNear(x, y)) c *= SECURITY.deterCut;
  return c * (1 - EDU.vandalCut * (p.edu || 0) / 100);
}
// Each minute, a party out on the paths beside an open exhibit might throw trash over the fence
function throwTick(p, dt){
  if(p.home || p.in || !p.at || p.at.rail) return;
  const x = p.at.x, y = p.at.y;
  for(const e of state.exhibits){
    if(e.viv || !e.animals.length || distToEdge(x, y, e.points) > THROWN.reach) continue;
    if(Math.random() < 1 - Math.pow(1 - Math.min(.5, throwChance(p, e, x, y)), dt)){
      e.trash = (e.trash || 0) + THROWN.pieces; p.trash = 0;
      if(p.rowdy){ p.vandal = true; if(onCamera(x, y)){ p.wanted = true; dispatchGuard(p); } }
      state.today.thrown = (state.today.thrown || 0) + 1;
      if(state.today.thrown === 1) events.toast(`A guest threw trash into ${e.name}. Animals that eat it fall ill. Bins, guards and Do Not Feed signs by the fence cut down on it.`, "bad");
    }
    return;
  }
}
// Chance a night that an animal in e eats some of the trash thrown in today
const trashEaten = e => e.trash && e.animals.length ? Math.min(THROWN.eatMax, THROWN.eat * e.trash / e.animals.length) : 0;
// Run each night: animals that ate trash fall ill or die, then the keepers clear the rest
function trashNight(out){
  for(const e of state.exhibits){
    const p = trashEaten(e);
    if(p && healthActive()) for(const a of [...e.animals]){
      if(Math.random() >= p) continue;
      if(Math.random() < THROWN.deadly){ a.sick = {kind:"illness", sev:100, cause:"trash"}; animalDies(e, a); out.poisoned++; continue; }
      if(a.sick){ a.sick.sev = Math.min(99, a.sick.sev + THROWN.sev); continue; }
      fallSick(a, "illness", THROWN.sev); a.sick.cause = "trash"; out.fed++;
    }
    e.trash = 0;
  }
}

/* ---------- genome therapy ---------- */
// A vet lifts a clone's DNA quality (a.q) toward the lab's genome for its species (sc.dna), which GHOST can improve.
// The player queues animals (a.gene), and a free vet does them one by one.
const labQuality = sp => genomeDone(sp) ? state.science.dna[sp].quality : 0;
const geneGain = a => hasTech("genetherapy") ? Math.min(GENE.step, labQuality(a.sp) - (a.q ?? 90)) : 0;
const geneCost = gain => GENE.base + Math.round(gain * GENE.perPoint);
function geneProblem(a){
  const s = SPECIES_BY_ID[a.sp], gain = geneGain(a);
  if(!hasTech("genetherapy")) return "Research Genome therapy at ORACLE first.";
  if(!dept("pmc")) return "Genome therapy needs a connected Paleo-Medicine Center.";
  if(!state.staff.vets.length) return "Hire a vet at the Paleo-Medicine Center.";
  if(!genomeDone(a.sp)) return `The lab needs a complete ${s.name} genome first.`;
  if(gain < GENE.minGain) return `The lab's ${s.name} genome is only ${labQuality(a.sp)}% quality. Send GHOST for better samples to raise it.`;
  if(!canAfford(geneCost(gain))) return `The procedure costs ${money(geneCost(gain))}. You have ${money(state.money)}.`;
  return null;
}
// The next queued animal a vet can reach that no other vet has taken
function pickGene(c){
  if(!hasTech("genetherapy") || !dept("pmc")) return null;
  const vz = vetZone(c), taken = new Set(vcrew.filter(x => x !== c && x.gene).map(x => x.gene.a));
  for(const e of state.exhibits){
    if(!kGraph.anchors[e.id] || (vz && e.zone !== vz)) continue;
    for(const a of e.animals) if(a.gene && !a.sick && !a.darted && !taken.has(a.id) && geneGain(a) >= GENE.minGain) return {e, a};
  }
  return null;
}
function geneDone(c){
  const e = c.gene && state.exhibits.find(x => x.id === c.gene.e), a = e && e.animals.find(x => x.id === c.gene.a), v = state.staff.vets.find(x => x.id === c.id), who = v ? v.name : "A vet";
  c.gene = null; c.job = "idle"; c.wait = 0;
  if(!a) return;
  delete a.gene;
  const s = SPECIES_BY_ID[a.sp], gain = geneGain(a), cost = geneCost(gain);
  if(gain < GENE.minGain){ events.toast(`${who} called off the genome therapy on a ${s.name} in ${e.name}. The lab has no better genome to give it.`, "bad"); events.changed(); return; }
  if(!canAfford(cost)){ events.toast(`${who} couldn't afford genome therapy on a ${s.name} in ${e.name} (${money(cost)}).`, "bad"); events.changed(); return; }
  spend(cost, "medicine");
  a.q = (a.q ?? 90) + gain;
  events.toast(`${who} improved a ${s.name}'s genome in ${e.name} to ${a.q}% DNA quality.`, "good");
  events.changed();
}

/* ---------- who gets sick ---------- */

// Old plant-eaters eating grass, from a Cenozoic planting (without older groves to browse instead) or grass hay
function grassSick(e, s){ return foodType(s) === "paleoflora" && GRASS_INTOLERANT.includes(s.period) && (grassyFloor(e) || e.grassFed); }
const hungerShare = e => clamp((e.hungryMin || 0) / (CLOSE_MIN - OPEN_MIN), 0, 1);
const medicated = (e, s) => !!e.medFedOk && canTreat(s);

// Chance a day this animal falls ill, and what's raising it
function illChance(e, a){
  const s = SPECIES_BY_ID[a.sp], why = [];
  let p = HEALTH.illChance;
  const hg = hungerShare(e); if(hg > .02){ p *= 1 + HEALTH.hungerMult * hg; why.push("hunger"); }
  const d = e.dirt || 0; if(d > CLEAN.penaltyFrom){ p *= 1 + (d - CLEAN.penaltyFrom) / HEALTH.dirtPer; why.push("dirt"); }
  const q = a.q ?? 90; if(q < 50){ p *= HEALTH.frail.below50; why.push("frail clones"); } else if(q < 70){ p *= HEALTH.frail.below70; why.push("sickly clones"); }
  if(grassSick(e, s)){ p *= HEALTH.grassSick; why.push("eating grass"); }
  if(thirsty(e, s)){ p *= HAB.dryIll; why.push("no water"); }
  const wx = weatherNow(), x = exposure(e);
  if(wx.ill && x > 0 && !(state.weather.today === "cold" && COLD_HARDY.includes(s.id))){ p *= 1 + wx.ill * x; why.push("weather"); }
  if(medicated(e, s)) p *= MEDICINE.feedCut;
  return {p, why};
}
// Chance a day this animal is hurt by rivals or by a species that preys on it
function injuryChance(e, a){
  const s = SPECIES_BY_ID[a.sp], counts = speciesCounts(e), why = [];
  let p = 0;
  const n = counts.get(s.id) || 0;
  if(TERRITORIAL.includes(s.id) && n > 1){
    const rep = derived && derived.reports[e.id], ratio = rep && rep.need ? rep.area / rep.need : 1;
    p += HEALTH.territorial * (n - 1) * (ratio < 1 ? 3 : ratio < 1.5 ? 1.5 : 1); why.push("rivals");
  }
  for(const sp of counts.keys()) if(sp !== s.id && attackReason(SPECIES_BY_ID[sp], s)){ p += HEALTH.attacked; why.push("attacks"); break; }
  // storms hurt animals caught out in them
  const wx = weatherNow(), x = wx.hurt ? exposure(e) : 0;
  if(x > 0){ p += wx.hurt * x; why.push("weather"); }
  return {p, why};
}

// Everything the exhibit panel says about health
// Sick animals the player (and the vets) know about. Mild illness stays hidden until a check-up.
const noticed = a => !!a.sick && !a.sick.hidden;
const daysSinceCheck = e => e.vetCheck == null ? 99 : state.day - e.vetCheck;
function healthReport(e){
  const sick = e.animals.filter(noticed), hidden = e.animals.filter(a => a.sick && a.sick.hidden).length;
  let ill = 0, hurt = 0; const why = new Set();
  for(const a of e.animals){ if(a.sick) continue; const i = illChance(e, a), j = injuryChance(e, a); ill += i.p; hurt += j.p; i.why.concat(j.why).forEach(w => why.add(w)); }
  const well = e.animals.length - sick.length;
  return {sick, hidden, ill:well ? ill / well : 0, hurt:well ? hurt / well : 0, why:[...why]};
}

// Injuries are obvious at once; illness shows only once it's bad
function fallSick(a, kind, sev){ a.sick = {kind, sev}; if(kind === "illness" && sev < HEALTH.obviousAt) a.sick.hidden = true; }
// Can a vet cure this one where it stands?
// A chronic case only comes back for a real cure, with the era's own medicine.
function fieldTreatable(a){
  if(!noticed(a) || a.darted || a.sick.kind !== "illness" || a.sick.sev >= HEALTH.minorBelow) return false;
  const k = pickMed(SPECIES_BY_ID[a.sp], HEALTH.fieldDose);
  return a.sick.chronic ? k === "era" : !!k;
}

// What's happening to one sick animal, in words
function sickStatus(e, a){
  const s = SPECIES_BY_ID[a.sp];
  if(a.sick.chronic && !fieldTreatable(a)) return canTreat(s) ? `Chronic. A vet will cure it once CERES has ${eraMedName(s).toLowerCase()} on hand.` : `Chronic. Contemporary medicine eased it, but only ${eraMedName(s).toLowerCase()} from CERES can cure it fully.`;
  if(a.darted){ const t = state.staff.transfers.find(x => x.animalId === a.id); return t && t.keeper ? "Darted. A keeper is coming to carry it to the PMC." : "Darted. Waiting for a keeper to carry it to the PMC."; }
  if(!hasDept("pmc")) return "Build a Paleo-Medicine Center and hire a vet to treat it.";
  if(!state.staff.vets.length) return "Hire a vet at the Paleo-Medicine Center.";
  if(!dept("pmc")) return "The PMC isn't connected. Run a path or service road to it.";
  if(!kGraph || !kGraph.anchors[e.id]) return `Vets can't get in. ${gateCheck(e).text}`;
  const mine = vcrew.find(c => c.patient && c.patient.a === a.id);
  if(mine) return mine.patient.field ? (mine.job === "treating" ? "A vet is treating it here." : "A vet is on the way to treat it here.") : "A vet is on the way to dart it.";
  if(a.sick.kind === "illness" && a.sick.sev < HEALTH.minorBelow && !fieldTreatable(a) && bedsFree() > 0) return "Minor, but the PMC is out of medicine, so it goes to the PMC. Waiting for a free vet.";
  if(fieldTreatable(a)) return "Minor. A vet can treat it here. Waiting for a free vet.";
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
  else state.science.ready.push({id:a.id, sp:a.sp, q:a.q ?? 90});
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
  for(const v of state.staff.vets) if(!vcrew.some(c => c.id === v.id)) vcrew.push({id:v.id, at:null, route:[], t:0, job:"idle", wait:0, work:0, loose:null, patient:null, check:null, gene:null});
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
function pickPatient(c){
  if(!dept("pmc")) return null;
  const vz = vetZone(c);
  const taken = new Set(vcrew.filter(x => x !== c && x.patient).map(x => x.patient.a)), beds = bedsFree() > 0;
  let best = null;
  for(const e of state.exhibits){
    if(!kGraph.anchors[e.id] || (vz && e.zone !== vz)) continue;
    for(const a of e.animals){
      if(!noticed(a) || a.darted || taken.has(a.id)) continue;
      const field = fieldTreatable(a);
      if(a.sick.chronic && !field) continue;
      if((field || beds) && (!best || a.sick.sev > best.a.sick.sev)) best = {e, a, field};
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
  const p = pickPatient(c);
  if(p){ c.patient = {e:p.e.id, a:p.a.id, field:p.field}; if(vetGo(c, kGraph.anchors[p.e.id], "toPatient")) return; c.patient = null; }
  const g = pickGene(c);
  if(g){ c.gene = {e:g.e.id, a:g.a.id}; if(vetGo(c, kGraph.anchors[g.e.id], "toGene")) return; c.gene = null; }
  const ex = pickCheck(c);
  if(ex){ c.check = ex.id; if(vetGo(c, kGraph.anchors[ex.id], "toCheck")) return; c.check = null; }
  c.wait = 15;
  const home = pmcs()[0];
  if(home && kGraph.anchors[home.id] !== c.at) vetGo(c, kGraph.anchors[home.id], "home");
}

function vetArrive(c){
  if(c.job === "hunting"){
    const l = c.loose, lp = l && loosePos(l);
    if(!l || l.status !== "loose" || !state.safety.loose.includes(l)){ c.loose = null; c.job = "idle"; return; }
    const [x, y] = keeperPos(c);
    if(lp && Math.hypot(lp[0] - x, lp[1] - y) < 10){ l.status = "darting"; c.job = "darting"; c.work = ESCAPE.sedateMinutes; return; }
    c.job = "idle"; c.wait = 1; return;   // it moved; chase it again (the wait keeps a vet already at the stop from re-planning forever)
  }
  if(c.job === "toPatient"){
    const e = c.patient && state.exhibits.find(x => x.id === c.patient.e), a = e && e.animals.find(x => x.id === c.patient.a);
    if(a && noticed(a) && !a.darted && kGraph.anchors[e.id] === c.at){
      // things may have changed on the way: treat it here if we still can, otherwise dart it if there's a bed
      if(fieldTreatable(a)){ c.patient.field = true; c.job = "treating"; c.work = HEALTH.fieldMinutes; return; }
      c.patient.field = false;   // now this vet is holding a bed, so there has to be one
      if(bedsFree() >= 0){ c.job = "darting"; c.work = HEALTH.dartMinutes; return; }
    }
    c.patient = null; c.job = "idle"; return;
  }
  if(c.job === "toGene"){
    const e = c.gene && state.exhibits.find(x => x.id === c.gene.e), a = e && e.animals.find(x => x.id === c.gene.a);
    if(a && a.gene && !a.sick && !a.darted && kGraph.anchors[e.id] === c.at){ c.job = "splicing"; c.work = GENE.minutes; return; }
    c.gene = null; c.job = "idle"; return;
  }
  if(c.job === "toCheck"){
    const e = state.exhibits.find(x => x.id === c.check);
    if(e && kGraph.anchors[e.id] === c.at){ c.job = "checking"; c.work = HEALTH.checkMinutes; return; }
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
  const found = e.animals.filter(a => a.sick && a.sick.hidden);
  for(const a of found) delete a.sick.hidden;
  if(found.length){ events.toast(`${v ? v.name : "A vet"} found ${found.length === 1 ? `an early illness in a ${SPECIES_BY_ID[found[0].sp].name}` : `${found.length} animals with early illness`} in ${e.name}.`); events.changed(); }
}
// A minor illness treated where the animal stands: no dart, no trip to the PMC
function treatDone(c){
  const e = c.patient && state.exhibits.find(x => x.id === c.patient.e), a = e && e.animals.find(x => x.id === c.patient.a), v = state.staff.vets.find(x => x.id === c.id);
  c.patient = null; c.job = "idle"; c.wait = 0;
  if(!a || !a.sick) return;
  const s = SPECIES_BY_ID[a.sp], k = pickMed(s, HEALTH.fieldDose);
  if(!k || (a.sick.chronic && k !== "era")){ events.toast(`${v ? v.name : "A vet"} ran out of medicine before treating a ${s.name} in ${e.name}.`, "bad"); return; }
  takeMed(k, HEALTH.fieldDose);
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
      if(c.job === "darting" || c.job === "treating" || c.job === "checking" || c.job === "splicing"){
        const w = Math.min(c.work, left); c.work -= w; left -= w;
        if(c.work <= 0) ({darting:dartDone, treating:treatDone, checking:checkDone, splicing:geneDone})[c.job](c);
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

function vetsNight(){ for(const c of vcrew){ resetAtv(c); c.at = null; c.route = []; c.job = "idle"; c.loose = null; c.patient = null; c.check = null; c.gene = null; } }

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
  const e = state.exhibits.find(x => x.id === (c.patient ? c.patient.e : c.gene ? c.gene.e : c.check)), n = e ? e.name : "an exhibit";
  const sp = c.loose ? SPECIES_BY_ID[c.loose.sp].name : "";
  return {hunting:`Tracking the escaped ${sp}`, toPatient:`Heading to a sick animal in ${n}`, treating:`Treating a sick animal in ${n}`,
          toGene:`Heading to give genome therapy in ${n}`, splicing:`Giving genome therapy in ${n}`, toCheck:`Heading to check on ${n}`, checking:`Checking the animals in ${n}`,
          darting:c.loose ? `Darting the escaped ${sp}` : `Darting a sick animal in ${e ? e.name : "an exhibit"}`, home:"Heading back to the PMC"}[c.job] || "Waiting for work";
}

/* ---------- each night ---------- */

function healthNight(){
  const h = state.health, out = {ill:0, hurt:0, healed:0, showing:[], fed:0, poisoned:0};
  modernMedsNight();
  // medicated feed: CERES doses go out to exhibits that asked for it and were fed
  for(const e of state.exhibits){
    e.medFedOk = false;
    if(!e.medFeed || !e.animals.length || !anyMedTech()) continue;
    const need = feedDoses(e);
    if(hungerShare(e) < .5 && medOnHand() >= need){ useMeds(need); e.medFedOk = true; }
  }
  if(healthActive()){
    for(const e of state.exhibits){
      const dirty = (e.dirt || 0) > CLEAN.penaltyFrom, hungry = hungerShare(e) > .5;
      for(const a of [...e.animals]){
        const s = SPECIES_BY_ID[a.sp];
        if(a.sick){
          // a chronic case holds steady, and medicated feed with the era's own medicine slowly clears it up
          if(a.sick.chronic){ if(medicated(e, s)){ a.sick.sev -= MEDICINE.feedHeal; if(a.sick.sev <= 0){ delete a.sick; out.healed++; } } continue; }
          // mild cases clear up on medicated feed; everything else gets worse
          if(medicated(e, s) && a.sick.kind === "illness" && a.sick.sev < HEALTH.minorBelow && !a.darted){
            a.sick.sev -= MEDICINE.feedHeal;
            if(a.sick.sev <= 0){ delete a.sick; out.healed++; }
            continue;
          }
          let w = a.sick.kind === "injury" ? HEALTH.injuryWorsen : HEALTH.illWorsen;
          w *= (hungry ? 1.5 : 1) * (dirty ? 1.3 : 1) * (medicated(e, s) ? .5 : 1);
          a.sick.sev += w;
          if(a.sick.sev >= 100){ animalDies(e, a); continue; }
          if(a.sick.hidden && a.sick.sev >= HEALTH.obviousAt){ delete a.sick.hidden; out.showing.push({e, a}); }
          continue;
        }
        if(Math.random() < injuryChance(e, a).p){ fallSick(a, "injury", HEALTH.injuryStart); out.hurt++; }
        else if(Math.random() < illChance(e, a).p){ fallSick(a, "illness", HEALTH.illStart); if(!a.sick.hidden) out.ill++; }
      }
    }
  }
  trashNight(out);
  // the ward: patients don't get worse here, and vets treat as many as they can
  const pmc = dept("pmc");
  let cap = pmc ? state.staff.vets.length * VET.patients : 0;
  for(const p of [...h.ward].sort((x, y) => (y.a.sick ? y.a.sick.sev : 0) - (x.a.sick ? x.a.sick.sev : 0))){
    if(p.cured || cap <= 0) continue;
    const s = SPECIES_BY_ID[p.a.sp];
    // start a course of medicine, or switch to the era's own once it's available
    if(p.med !== "era"){ const k = pickMed(s, HEALTH.dose); if(k && (k === "era" || !p.med)){ takeMed(k, HEALTH.dose); p.med = k; } }
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
      else { discharge(p.a.id); state.science.ready.push({id:p.a.id, sp:p.a.sp, q:p.a.q ?? 90}); }
      events.toast(`${chronic ? `Contemporary medicine got a ${s.name} as well as it can. It still has a chronic illness only ${eraMedName(s).toLowerCase()} can cure.` : `The PMC cured a ${s.name}.`}${home ? ` A keeper will take it back to ${home.name}.` : " Its exhibit is gone, so it waits in holding."}`, chronic ? "" : "good");
    }
  }
  for(const e of state.exhibits) e.hungryMin = 0;
  // mild illness starts out hidden, so only injuries and cases that now show get a warning
  const ill = out.ill + out.showing.length;
  if(ill || out.hurt || out.fed){
    const bits = [ill && `${ill} animal${ill === 1 ? " is" : "s are"} showing signs of illness`, out.fed && `${out.fed} ate trash thrown in by guests`, out.hurt && `${out.hurt} ${out.hurt === 1 ? "was" : "were"} hurt fighting`].filter(Boolean);
    events.toast(`Overnight, ${bits.join(" and ")}. ${state.staff.vets.length ? "Vets will see to them." : "Build a Paleo-Medicine Center and hire vets to treat them."}`, "bad");
  }
  if(state.day + 1 === h.from) events.toast("Animals can start falling ill tomorrow. Keep them fed and clean, and build a Paleo-Medicine Center.", "bad");
}

function animalDies(e, a){
  e.animals.splice(e.animals.indexOf(a), 1);
  state.staff.transfers = state.staff.transfers.filter(t => t.animalId !== a.id);
  state.rating = Math.max(0, state.rating - .05);
  const cause = a.sick.cause === "trash" ? "Ate trash thrown in by guests" : a.sick.kind === "injury" ? "Injuries" : "Illness";
  events.died({animal:SPECIES_BY_ID[a.sp].name, exhibit:e.name, cause});
}
