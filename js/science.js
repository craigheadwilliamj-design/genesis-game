/* =====================================================================
   SCIENCE
   The Research Lab researches (fences, buildings, plants, medicine, the Genetics Lab and GHOST
   upgrades), GHOST's drones discover animals at real sites in deep time
   and fill their genomes, the Genetics Lab clones animals, and the Botany Lab grows plants and
   medicine. All of it takes time: projects, trips, clones and
   batches carry start/end stamps in park minutes (see nowMin), so they
   finish at any hour rather than at the daily rollover.
   ===================================================================== */

/* ---------- time ---------- */

// Park minutes since day 1 began. The rollover hour ending one day and starting the next are the same instant.
const nowMin = () => (state.day - 1) * DAY_MIN + state.minute;
const minAt = (day, minute) => (day - 1) * DAY_MIN + minute;
function whenText(m){
  const r = m % DAY_MIN;
  return `${fmtDate(Math.floor(m / DAY_MIN) + 1)}, ${fmtClock(clockMin(r))}`;
}
// A length of time in days and hours: "1 day 3h", "5h 20m"
function spanText(min){
  min = Math.max(0, Math.round(min));
  if(min < 1) return "a moment";
  const c = min * CLOCK_SCALE, d = Math.floor(c / 1440), h = Math.floor(c % 1440 / 60), m = Math.floor(c % 60);   // park minutes shown as clock time
  return d ? `${d} day${d === 1 ? "" : "s"}${h ? ` ${h}h` : ""}` : h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`;
}
const leftText = end => spanText(end - nowMin());
// How far a clone got, 0 to 100. A failed one stops where it died.
const cloneProgress = c => c.failed ? c.stop : doneShare(c);
const doneShare = j => clamp((nowMin() - j.start) / Math.max(1, j.end - j.start), 0, 1) * 100;

/* ---------- bays: one per scientist ---------- */

// Every scientist runs one bay. A bay holds one job (a research project, a clone or a growing batch) or nothing.
// Jobs carry the `bay` they run in. The only way to get more bays is to hire more scientists.
// GHOST works the same way with drones instead of staff: a trip's `bay` is its drone, and buying a drone is the only way to get more.
const BAY_JOBS = {paleo:() => state.science.projects, temporal:() => state.science.trips, gene:() => state.science.clones, botanist:() => state.ceres.beds};
const bayCount = kind => kind === "temporal" ? (dept("ghost") ? state.science.drones : 0) : state.science.crew[kind] || 0;
const bayJob = (kind, i) => BAY_JOBS[kind]().find(j => j.bay === i) || null;
// The first empty bay, or -1 when they're all busy
function freeBay(kind){ for(let i = 0; i < bayCount(kind); i++) if(!bayJob(kind, i)) return i; return -1; }
const bayFull = (kind, who) => `${bayCount(kind) === 1 ? "The only bay is" : "Every bay is"} busy. Hire another ${who} to open a new bay.`;

// What a job cost, so cancelling it can give it back: {points} of research or {money}
function jobRefund(kind, j){
  if(kind === "paleo") return {points:j.cost !== undefined ? j.cost : j.kind === "tech" ? (TECH.find(x => x.id === j.id) || {}).points || 0 : j.kind === "refine" ? REFINE_POINTS[ERA_OF[j.id]] || 0 : 0};
  if(kind === "temporal") return {money:j.cost || 0};
  if(kind === "gene") return {money:j.failed ? 0 : SPECIES_BY_ID[j.sp].price};
  return {money:growInfo(j.kind, j.era, j.size).cost};
}
// Let one scientist go. Their bay closes, and so does the job in the highest bay if it was busy (the cost comes back).
function fireScientist(kind){
  const sc = state.science; if(!sc.crew[kind]) return;
  sc.crew[kind]--;
  const jobs = BAY_JOBS[kind]();
  for(const j of jobs.filter(x => x.bay >= sc.crew[kind])){
    jobs.splice(jobs.indexOf(j), 1);
    const r = jobRefund(kind, j); sc.points += r.points || 0; if(!state.sandbox) state.money += r.money || 0;
    events.toast("Closing that bay stopped the job in it. The cost came back.");
  }
}

/* ---------- Research Lab: research ---------- */

const labSlots = () => dept("oracle") ? state.science.crew.paleo : 0;
const researching = (kind, id) => state.science.projects.some(p => p.kind === kind && p.id === id);
// Discovered: GHOST's scouting turned it up (or, in old saves, the Research Lab unlocked it)
const isUnlocked = id => state.science.unlocked.includes(id);

// A project is {kind, id}: "tech" (anything in TECH) or "refine" (an era's medicine, for one period)
function projectInfo(kind, id){
  if(kind === "tech"){ const t = TECH.find(x => x.id === id); return t ? {label:t.label, points:t.points, needs:t.needs, done:hasTech(id)} : null; }
  if(kind === "refine"){ const era = ERA_OF[id]; return era ? {label:`${id} medicine`, points:REFINE_POINTS[era], needs:MED_TECH[era], done:hasTech("ref-" + id)} : null; }
  return null;
}
const projectMinutes = points => Math.round(points * RESEARCH_MIN_PER_POINT);

function projectProblem(kind, id){
  const sc = state.science, info = projectInfo(kind, id);
  if(!info) return "That can't be researched.";
  if(info.done) return "Already researched.";
  if(researching(kind, id)) return "Already being researched.";
  const blocker = deptProblem("oracle"); if(blocker) return blocker;
  if(info.needs && !hasTech(info.needs)) return `Research ${TECH.find(x => x.id === info.needs).label} first.`;
  if(!sc.crew.paleo) return "Hire a researcher to run research.";
  if(freeBay("paleo") < 0) return bayFull("paleo", "researcher");
  if(!state.sandbox && sc.points + 1e-9 < info.points) return `Needs ${info.points} research points. You have ${Math.floor(sc.points)}.`;
  return null;
}
function startProject(kind, id){
  if(kind === "tech" && techHidden(id)) return "That research isn't available yet.";
  const why = projectProblem(kind, id); if(why) return why;
  const sc = state.science, info = projectInfo(kind, id), now = nowMin();
  sc.points -= info.points;
  sc.projects.push({kind, id, bay:freeBay("paleo"), cost:info.points, start:now, end:now + projectMinutes(info.points)});
  events.toast(`The Research Lab started researching ${info.label.toLowerCase()}. It takes about ${spanText(projectMinutes(info.points))}.`);
  return null;
}
// Take a researcher off a project and back to general research. The points come back.
function stopProject(p){
  const sc = state.science, i = sc.projects.indexOf(p); if(i < 0) return;
  sc.projects.splice(i, 1); sc.points += jobRefund("paleo", p).points || 0;
  events.toast("That researcher is back on general research. The points came back.");
}
function finishProject(p){
  const sc = state.science, info = projectInfo(p.kind, p.id);
  const tech = p.kind === "refine" ? "ref-" + p.id : p.id;
  if(!hasTech(tech)) sc.tech.push(tech);
  events.toast(`The Research Lab finished researching ${info ? info.label.toLowerCase() : p.id}.`, "good");
}

/* ---------- GHOST: the timeline, sites and drones ---------- */

// GHOST's slider runs over TIMELINE: one equal bar a period, split equally into its epochs, a log scale inside each epoch.
// Epochs flattened oldest first: {name, from, to (years ago), period, pi (period index), ej (epoch index in its period)}.
const EPOCHS = [];
TIMELINE.forEach((p, i) => p.epochs.forEach(([name, from], j) => {
  const to = p.epochs[j + 1] ? p.epochs[j + 1][1] : TIMELINE[i + 1] ? TIMELINE[i + 1].epochs[0][1] : TIMELINE_FLOOR;
  EPOCHS.push({name, from, to, period:p.id, pi:i, ej:j});
}));
const epochOf = years => EPOCHS.find(e => years <= e.from && years > e.to) || EPOCHS[EPOCHS.length - 1];
// Slider position u (0 the oldest, 1 today) to years ago, and back
function yearsAt(u){
  u = clamp(u, 0, 1 - 1e-9);
  const n = TIMELINE.length, pi = Math.floor(u * n), k = TIMELINE[pi].epochs.length, f = (u * n - pi) * k, ej = Math.floor(f);
  const e = EPOCHS.find(x => x.pi === pi && x.ej === ej);
  return {years:e.from * Math.pow(e.to / e.from, f - ej), epoch:e};
}
function uAt(years){
  const e = epochOf(years), t = Math.log(years / e.from) / Math.log(e.to / e.from);
  return (e.pi + (e.ej + t) / TIMELINE[e.pi].epochs.length) / TIMELINE.length;
}
// "375 million years ago", "12,000 years ago": two significant figures under a million years, then millions
function fmtYearsAgo(y){
  if(y >= 1e7) return `${Math.round(y / 1e6)} million years ago`;
  if(y >= 1e6) return `${+(y / 1e6).toFixed(1)} million years ago`;
  const step = Math.pow(10, Math.max(1, Math.floor(Math.log10(y)) - 1)), r = Math.round(y / step) * step;
  return r >= 1e6 ? "1 million years ago" : `${r.toLocaleString("en-US")} years ago`;
}
const fmtMa = y => y >= 1e6 ? `${+(y / 1e6).toFixed(1)} million` : y.toLocaleString("en-US");
const epochMap = e => TIMELINE_MAPS[e.name] || TIMELINE_MAPS[e.period];

// Sites. A site belongs to the period it starts in, which sets its trip (TIME_PERIODS); an event site's trip is its event's.
const SITE_BY_ID = Object.fromEntries(TIME_SITES.map(s => [s.id, s]));
const sitePeriod = s => epochOf(s.from).period;
const siteFauna = s => (s.fauna || []).filter(speciesAvailable);
const siteShown = s => s.event ? !techHidden(MUSEUM.needTech) : siteFauna(s).length > 0;
const sitesIn = e => TIME_SITES.filter(s => siteShown(s) && s.from > e.to && s.to < e.from);
const sitesOf = sp => TIME_SITES.filter(s => (s.fauna || []).includes(sp));
const isScouted = id => !!state.science.seen[id];
// The animals scouting has turned up at a site
const siteSeen = s => siteFauna(s).filter(f => (state.science.seen[s.id] || []).includes(f));
const siteComplete = s => !s.event && isScouted(s.id) && siteSeen(s).length === siteFauna(s).length;
// A lit site shows its name and can take expeditions: scouted, or an event site once the Research Lab has education programs
const siteLit = s => s.event ? hasTech(MUSEUM.needTech) : isScouted(s.id);
// What an expedition to a lit site can bring back: its event, or the animals seen there plus its period's plant DNA once
// The Research Lab has that flora
function siteTargets(s){
  if(s.event) return [s.event];
  const f = PLANT_DNA[sitePeriod(s)];
  return [...siteSeen(s), ...(f && hasTech(FLORA[f.era].tech) ? [f.id] : [])];
}
// The site a trip went to can be one from an old save: placeOf takes a site, a period or an event
const placeOf = id => { const s = SITE_BY_ID[id]; return s ? (s.event ? MUSEUM_BY_ID[s.event] : PERIOD_BY_ID[sitePeriod(s)]) : PERIOD_BY_ID[id] || MUSEUM_BY_ID[id]; };
const placeName = id => SITE_BY_ID[id] ? (siteLit(SITE_BY_ID[id]) ? SITE_BY_ID[id].name : "an unscouted site") : MUSEUM_BY_ID[id] ? MUSEUM_BY_ID[id].name : `the ${id}`;

// Animals, plants and events all have genomes (an event's is its record): sc.dna[id] = {genome: 0-100}
function genomeInfo(id){
  const s = SPECIES_BY_ID[id]; if(s) return {id, name:s.name, space:s.space, animal:s};
  const f = PLANT_DNA_BY_ID[id]; if(f) return {id, name:f.name, space:f.space, plant:f};
  const ev = MUSEUM_BY_ID[id]; if(ev) return {id, name:ev.name, space:ev.space, event:ev};
  return null;
}
const genomeDone = id => { const d = state.science.dna[id]; return !!d && d.genome >= 100; };
const plantDnaDone = period => !!PLANT_DNA[period] && genomeDone(PLANT_DNA[period].id);
// Has GHOST finished plant DNA from any period of this era?
const eraDnaDone = era => Object.values(PLANT_DNA).some(f => f.era === era && genomeDone(f.id));
const anyPlantDna = () => Object.values(PLANT_DNA).some(f => genomeDone(f.id));
// Can GHOST go after this yet? Animals need discovering, plants their flora research, events education programs.
function genomeOpen(id){
  const g = genomeInfo(id); if(!g) return false;
  return g.animal ? isUnlocked(id) : g.event ? hasTech(MUSEUM.needTech) : hasTech(FLORA[g.plant.era].tech);
}

// GHOST upgrade multiplier for "cost" or "speed"
const ghostLevel = kind => GHOST_UPGRADE[kind][hasTech("ghost" + kind + "2") ? 2 : hasTech("ghost" + kind + "1") ? 1 : 0];
// The drones' mark (index into GHOST_MK) and the share of empty-handed trips it takes away
const droneMk = () => GHOST_MK.reduce((k, m, i) => m.tech && hasTech(m.tech) ? i : k, 0);
const droneCut = () => GHOST_MK[droneMk()].cut;
const sizeT = space => clamp(Math.log(space / TRIP_SIZE[0]) / Math.log(TRIP_SIZE[1] / TRIP_SIZE[0]), 0, 1);
const lerpT = ([a, b], t) => a + (b - a) * t;
// What an expedition after this genome at this site is like: the chance of coming back empty-handed, the genome % a find adds
// on average, the trips a whole genome takes on average, and the price
function tripOdds(id, siteId){
  const g = genomeInfo(id), p = placeOf(siteId), t = sizeT(g.space);
  const fail = state.sandbox ? 0 : clamp(lerpT(TRIP.fail, t) + p.risk, 0, .8) * (1 - droneCut()), trips = lerpT(TRIP.trips, t);
  // a genome ends on a find that overshoots 100% by about half a find's worth, hence the .5
  return {fail, trips, gain:100 / Math.max(.6, trips * (1 - fail) - .5), cost:Math.round(p.trip * lerpT(TRIP.costMul, t) * ghostLevel("cost") / 50) * 50};
}
// A scouting trip costs a mid-size expedition there; each unseen animal turns up with this chance
const scoutCost = siteId => Math.round(placeOf(siteId).trip * ghostLevel("cost") / 50) * 50;
const scoutChance = sp => state.sandbox ? 1 : 1 - (1 - lerpT(SCOUT.find, sizeT(SPECIES_BY_ID[sp].space))) * (1 - droneCut());
const tripMinutes = siteId => Math.round(placeOf(siteId).days * DAY_MIN * ghostLevel("speed"));

// Drones: GHOST comes with one, and buying more is the only way to fly more trips at once
const dronePrice = () => Math.round(DRONES.price * Math.pow(DRONES.growth, state.science.drones - 1) / 500) * 500;
function droneProblem(){
  return deptProblem("ghost") || (state.science.drones >= DRONES.max ? `GHOST's hangar holds ${DRONES.max} drones.` : null) ||
    (!canAfford(dronePrice()) ? `A drone costs ${money(dronePrice())}. You have ${money(state.money)}.` : null);
}
function buyDrone(){
  const why = droneProblem(); if(why) return why;
  spend(dronePrice(), "science"); state.science.drones++;
  events.toast(`GHOST has ${state.science.drones} drones now.`, "good");
  return null;
}
const outTo = (siteId, kind, sp) => state.science.trips.some(t => t.site === siteId && t.kind === kind && (sp === undefined || t.sp === sp));
const ghostProblem = () => deptProblem("ghost") || (freeBay("temporal") < 0 ? `Every drone is out.${state.science.drones < DRONES.max ? " Buy another at GHOST to fly more at once." : ""}` : null);

function scoutProblem(siteId){
  const s = SITE_BY_ID[siteId];
  if(!s || !siteShown(s) || s.event) return "There's nothing to scout there.";
  if(siteComplete(s)) return "Every animal there has been found.";
  if(outTo(siteId, "scout")) return "A drone is already scouting there.";
  return ghostProblem() || (!canAfford(scoutCost(siteId)) ? `A scouting trip costs ${money(scoutCost(siteId))}. You have ${money(state.money)}.` : null);
}
function expeditionProblem(siteId, id){
  const s = SITE_BY_ID[siteId], g = genomeInfo(id);
  if(!s || !g || !siteShown(s) || !siteTargets(s).includes(id)) return s && !s.event && !siteLit(s) ? "Scout the site first." : "GHOST can't find that there.";
  if(genomeDone(id)) return g.event ? "That record is complete." : "That genome is complete.";
  if(g.animal && state.rating + 1e-9 < starsNeed(g.animal)) return `Needs a ${starsNeed(g.animal)}-star park. You have ${starTxt(state.rating)}.`;
  if(outTo(siteId, "dig", id)) return `A drone is already after ${g.name} there.`;
  return ghostProblem() || (!canAfford(tripOdds(id, siteId).cost) ? `An expedition costs ${money(tripOdds(id, siteId).cost)}. You have ${money(state.money)}.` : null);
}
// Send a drone: a scouting trip (kind "scout") or an expedition after one genome (kind "dig", sp the genome)
function sendDrone(kind, siteId, id){
  if(kind === "scout" ? scoutProblem(siteId) : expeditionProblem(siteId, id)) return false;
  const cost = kind === "scout" ? scoutCost(siteId) : tripOdds(id, siteId).cost, now = nowMin(), end = now + tripMinutes(siteId), bay = freeBay("temporal");
  spend(cost, "science");
  state.science.trips.push({kind, site:siteId, ...(kind === "dig" ? {sp:id} : {}), bay, cost, start:now, end});
  events.toast(`Drone ${bay + 1} left for ${placeName(siteId)} to ${kind === "scout" ? "scout for animals" : MUSEUM_BY_ID[id] ? `record the ${genomeInfo(id).name}` : `find ${genomeInfo(id).name}`}. Back in about ${spanText(end - now)}.`);
  return true;
}

// Add a DNA sample to the genome library. Returns how much the genome grew.
function addSample(sp, gain){
  const dna = state.science.dna;
  const d = dna[sp] || (dna[sp] = {genome:0});
  const g = Math.min(gain, 100 - d.genome);
  d.genome = Math.min(100, Math.round(d.genome + g));
  return {gain:g};
}

// A drone is back. Its post-mission report waits at GHOST (sc.reports) until dismissed: lines of [text, headline?].
function tripReturns(t){
  const sc = state.science, s = SITE_BY_ID[t.site], lines = [];
  if(t.kind === "scout"){
    const have = siteSeen(s);
    const hits = siteFauna(s).filter(f => !have.includes(f) && Math.random() < scoutChance(f)).sort(() => Math.random() - .5).slice(0, SCOUT.max);
    sc.seen[s.id] = [...(sc.seen[s.id] || []), ...hits];
    for(const f of hits){
      const name = SPECIES_BY_ID[f].name;
      if(isUnlocked(f)) lines.push([`${name} also found here`]);
      else { sc.unlocked.push(f); lines.push([`${name} Discovered`, true]); }
    }
    if(hits.length && siteComplete(s)) lines.push(["Site Complete", true]);
  } else {
    const g = genomeInfo(t.sp), odds = tripOdds(t.sp, t.site);
    if(Math.random() >= odds.fail){
      const was = (sc.dna[t.sp] || {genome:0}).genome; addSample(t.sp, odds.gain * rand(1 - TRIP.spread, 1 + TRIP.spread));
      const d = sc.dna[t.sp];
      lines.push([g.event ? `${g.name} Recording Made` : `${g.name} Sample Found`, true]);
      if(d.genome >= 100 && was < 100) lines.push([g.event ? `${g.name} Record Complete` : `${g.name} Genome Complete`, true]);
      else if(g.animal && was < CLONE_GENOME.min && d.genome >= CLONE_GENOME.min) lines.push(["The Genetics Lab can clone it now, though the clones will be frail until the genome is more complete."]);
      // sometimes the drone also turns up traces of another animal seen at the same site
      const others = g.event ? [] : siteSeen(s).filter(x => x !== t.sp && !genomeDone(x));
      if(others.length && Math.random() < TRIP.bonus.chance){
        const o = others[Math.floor(Math.random() * others.length)], r2 = addSample(o, rand(TRIP.bonus.gain[0], TRIP.bonus.gain[1]));
        if(r2.gain) lines.push([`${SPECIES_BY_ID[o].name} traces found (+${Math.round(r2.gain)}%)`]);
      }
    }
  }
  const ok = lines.length > 0;
  if(!ok) lines.push(["Came back empty handed"]);
  sc.reports.unshift({id:(sc.reports.reduce((m, r) => Math.max(m, r.id), 0)) + 1, site:t.site, kind:t.kind, drone:t.bay, day:state.day, lines});
  sc.reports.length = Math.min(sc.reports.length, 12);
  const msg = `Drone ${t.bay + 1} is back from ${placeName(t.site)}${t.kind === "scout" ? " (scouting)" : ""}: ${lines.map(l => l[0]).join(". ")}.`;
  logScience(msg, ok); events.toast(msg, ok ? "good" : "bad");
}
function dismissReport(id){ const sc = state.science; sc.reports = sc.reports.filter(r => r.id !== id); }

/* ---------- Genetics Lab: cloning ---------- */

const cloneSpeed = () => hasTech("fast2") ? TAR_UPGRADE.speed ** 2 : hasTech("fast1") ? TAR_UPGRADE.speed : 1;
// How long a clone takes: 1 open day plus 1 more for every CLONE_DAYS_PER_SPACE m², less with faster incubators
function cloneMinutes(sp){ return Math.round((1 + SPECIES_BY_ID[sp].space / CLONE_DAYS_PER_SPACE) * DAY_MIN * cloneSpeed()); }
const tarWorking = () => !!dept("tar") && state.science.crew.gene > 0;

// The Genetics Lab can clone from CLONE_GENOME.min % of a genome. A clone's DNA quality (a.q) follows how complete the genome is: q0 at the minimum, 100 when whole.
const cloneOpen = sp => { const d = state.science.dna[sp]; return !!d && d.genome >= CLONE_GENOME.min; };
const cloneQuality = sp => { const d = state.science.dna[sp], C = CLONE_GENOME; return !d || d.genome < C.min ? 0 : Math.round(C.q0 + (100 - C.q0) * (Math.min(100, d.genome) - C.min) / (100 - C.min)); };
// The chance a clone dies in the incubator: CLONE_GENOME.failMax at the minimum genome, nothing at 100%
const cloneFailChance = sp => { const d = state.science.dna[sp], C = CLONE_GENOME; return !d || d.genome >= 100 ? 0 : C.failMax * clamp((100 - d.genome) / (100 - C.min), 0, 1); };
function failClone(j){
  j.failed = true; j.stop = clamp((j.fail - j.start) / Math.max(1, j.end - j.start) * 100, 0, 100);
  events.toast(`The ${SPECIES_BY_ID[j.sp].name} clone at the Genetics Lab failed at ${Math.round(j.stop)}%. ${j.why}. Discard the specimen to free the incubator.`, "bad");
  events.changed();
}
function discardClone(id){
  const sc = state.science, i = sc.clones.findIndex(c => c.id === id && c.failed); if(i < 0) return false;
  sc.clones.splice(i, 1); events.toast("Specimen discarded. The incubator bay is clear.");
  return true;
}
function cloneProblem(sp){
  const s = SPECIES_BY_ID[sp], d = state.science.dna[sp];
  return deptProblem("tar") ||
    (!state.science.crew.gene ? "Hire a Geneticist at the Genetics Lab to run the incubators." : null) ||
    (freeBay("gene") < 0 ? bayFull("gene", "Geneticist") : null) ||
    (!cloneOpen(sp) ? `${s.name}'s genome is ${d ? d.genome : 0}% complete. The Genetics Lab needs ${CLONE_GENOME.min}% to clone it.` : null) ||
    (!canAfford(s.price) ? `Cloning costs ${money(s.price)}. You have ${money(state.money)}.` : null);
}
const cloneReadyMin = sp => nowMin() + cloneMinutes(sp);
function orderClone(sp, exhibitId, sex){
  if(cloneProblem(sp)) return false;
  if(sex !== "male" && sex !== "female") sex = pickSex(sp);
  const s = SPECIES_BY_ID[sp], cq = cloneQuality(sp);
  spend(s.price, "animals");
  const start = nowMin(), end = start + cloneMinutes(sp);
  const job = {id:uid("a-"), sp, sex, exhibitId:exhibitId || null, q:cq >= 100 ? 100 : clamp(Math.round(cq + rand(-3, 3)), 5, 100), bay:freeBay("gene"), start, end};
  // a partial genome can fail partway (never in sandbox)
  if(!state.sandbox && Math.random() < cloneFailChance(sp)){ job.fail = start + rand(CLONE_FAIL.from, CLONE_FAIL.to) * (end - start); job.why = CLONE_FAIL.causes[Math.floor(Math.random() * CLONE_FAIL.causes.length)]; }
  state.science.clones.push(job);
  events.toast(`The Genetics Lab started a ${sex} ${s.name} clone. Ready ${whenText(end)}.`);
  return true;
}
function putAnimal(e, a){
  if(!e.animals.length) e.happy = 70;
  e.animals.push(nameAnimal({id:a.id, name:a.name, sex:a.sex, rank:a.rank, face:a.face, sp:a.sp, cl:true, q:a.q}));
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
  if(e){ putAnimal(e, c); events.toast(`The Genetics Lab finished a ${s.name} clone (${health}, ${c.q}% DNA quality). It moved into ${e.name}.`, "good"); }
  else { sc.ready.push(nameAnimal({id:c.id, sex:c.sex, rank:c.rank, sp:c.sp, q:c.q})); events.toast(`The Genetics Lab finished a ${s.name} clone. Tap an exhibit to move it in.`, "good"); }
}

/* ---------- Botany Lab: growing plants and medicine ---------- */

const beds = () => dept("ceres") ? Math.max(0, state.science.crew.botanist) : 0;
const growing = (kind, era, size) => state.ceres.beds.filter(b => b.kind === kind && b.era === era && (b.size || null) === (size || null)).length;
// For plants `era` is the period they're from (a bed's `era` field too); for medicine it's the era
const growInfo = (kind, era, size) => kind === "plant" ? (CERES_GROW.plant[ERA_OF[era]] || {})[size] : kind === "food" ? CERES_GROW.food : CERES_GROW.medicine[era];
const growMinutes = (kind, era, size) => Math.round(growInfo(kind, era, size).days * DAY_MIN);
// What a batch is called, for toasts and bed cards
const growName = (kind, era, size) => kind === "plant" ? `${era} ${size} plants` : kind === "food" ? "Paleoflora food" : `${ERA_LABEL[era]} medicine`;

function growProblem(kind, era, size){
  const sc = state.science, c = state.ceres;
  if(!growInfo(kind, era, size)) return "The Botany Lab can't grow that.";
  const blocker = deptProblem("ceres"); if(blocker) return blocker;
  if(!sc.crew.botanist) return "Hire a botanist at the Botany Lab to tend a growing bed.";
  if(kind === "plant"){
    const f = FLORA[ERA_OF[era]];
    if(f.tech && !hasTech(f.tech)) return `Research ${f.label} flora at the Research Lab first.`;
    if(PLANT_DNA[era] && !plantDnaDone(era)) return `GHOST has to collect ${era} plant DNA first (${(sc.dna[PLANT_DNA[era].id] || {genome:0}).genome}% so far).`;
  } else if(kind === "food"){
    if(!hasTech("paleoflora")) return "Research Paleoflora cultivation at the Research Lab first.";
    if(!anyPlantDna()) return "The Botany Lab needs plant DNA first.";
  } else {
    if(!hasTech(MED_TECH[era])) return `Research ${ERA_LABEL[era]} medicine at the Research Lab first.`;
    if(era !== "cenozoic" && !eraDnaDone(era)) return `GHOST has to collect ${ERA_LABEL[era]} plant DNA first.`;
  }
  if(freeBay("botanist") < 0) return bayFull("botanist", "botanist");
  if(!canAfford(growInfo(kind, era, size).cost)) return `A batch costs ${money(growInfo(kind, era, size).cost)}. You have ${money(state.money)}.`;
  return null;
}
function growBatch(kind, era, size){
  if(growProblem(kind, era, size)) return false;
  const gi = growInfo(kind, era, size), start = nowMin();
  spend(gi.cost, "science");
  state.ceres.beds.push({id:uid("g-"), kind, era, ...(size ? {size} : {}), bay:freeBay("botanist"), start, end:start + growMinutes(kind, era, size)});
  events.toast(`The Botany Lab started a batch of ${growName(kind, era, size)}. Ready ${whenText(start + growMinutes(kind, era, size))}.`);
  return true;
}
function finishBatch(b){
  const c = state.ceres;
  if(b.kind === "plant"){ const k = b.era + "-" + b.size; c.pots[k] = (c.pots[k] || 0) + growInfo("plant", b.era, b.size).count; events.toast(`The Botany Lab finished a batch of ${growName("plant", b.era, b.size)}.`, "good"); }
  else if(b.kind === "food"){ c.stock = Math.min(ceresCap(), c.stock + CERES_GROW.food.amount); events.toast("The Botany Lab finished a batch of Paleoflora food.", "good"); }
  else { const g = MED_GOOD[b.era]; cerMeds()[g] = Math.min(medCap(), (cerMeds()[g] || 0) + growInfo("med", b.era).doses); events.toast(`The Botany Lab finished a batch of ${ERA_LABEL[b.era]} medicine.`, "good"); }
}
// Doses already growing, so automatic ordering doesn't overfill the store
const pendingFood = () => growing("food") * CERES_GROW.food.amount;
const pendingDoses = era => state.ceres.beds.filter(b => b.kind === "med" && b.era === era).reduce((s, b) => s + growInfo("med", b.era).doses, 0);

/* ---------- time passing ---------- */

// Park minutes until the next job that will complete (a waiting clone or bed doesn't count: its clock is held). Infinity if none.
function scienceNext(){
  if(state.sandbox) return Infinity;
  const sc = state.science, c = state.ceres;
  let m = Infinity;
  for(const j of sc.projects) m = Math.min(m, j.end);
  for(const j of sc.trips) m = Math.min(m, j.end);
  if(sc.clones.length && tarWorking()) for(const j of sc.clones) if(!j.failed) m = Math.min(m, j.fail !== undefined ? j.fail : j.end);
  if(c.beds.length && beds()) for(const j of c.beds) m = Math.min(m, j.end);
  return m - nowMin();
}

// Called every tick. Research points trickle in, and every project, trip, clone and batch checks its own clock.
function scienceTick(dtMin){
  const sc = state.science, c = state.ceres;
  // sandbox: unlimited money and points, and every job finishes the moment it starts
  if(state.sandbox){ state.money = SANDBOX_MONEY; sc.points = SANDBOX_POINTS; }
  // researchers with no project are on general research and earn points. Ones running a project don't.
  if(dept("oracle")) sc.points += Math.max(0, sc.crew.paleo - sc.projects.length) * RESEARCH_PER_PALEO * dtMin / DAY_MIN;
  // a hair of slack: nowMin() is rebuilt from the day and minute, so a step that lands on `end` can read a rounding error short
  const now = state.sandbox ? Infinity : nowMin() + 1e-6;
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
  // with the Genetics Lab closed or nobody to run it, every clone waits
  if(sc.clones.length){
    if(!tarWorking()) for(const j of sc.clones){ if(j.failed) continue; j.start += dtMin; j.end += dtMin; if(j.fail !== undefined) j.fail += dtMin; }
    else {
      // a clone that was going to die stops here, and stays in its bay until the player discards it
      for(const j of sc.clones) if(!j.failed && j.fail !== undefined && j.fail <= now) failClone(j);
      if(sc.clones.some(j => !j.failed && j.end <= now)){
        const done = sc.clones.filter(j => !j.failed && j.end <= now);
        sc.clones = sc.clones.filter(j => j.failed || j.end > now);
        done.forEach(finishClone); sc.hatchDay = state.day;
      }
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
  // The Botany Lab keeps medicine stocked for the types set to "keep stocked"
  if(beds() && freeBay("botanist") >= 0){
    if(c.auto.food && c.stock + pendingFood() + CERES_GROW.food.amount <= ceresCap() && growBatch("food")) return;
    // each era's medicine has its own room, and the one running lowest goes first
    const low = era => (cerMeds()[MED_GOOD[era]] || 0) + pmcStock(MED_GOOD[era]) + pendingDoses(era);
    for(const era of Object.keys(c.auto).filter(k => k !== "food" && c.auto[k]).sort((x, y) => low(x) - low(y))){
      if((cerMeds()[MED_GOOD[era]] || 0) + pendingDoses(era) + growInfo("med", era).doses > medCap()) continue;
      if(growBatch("med", era)) break;
    }
  }
}
