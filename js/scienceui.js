/* =====================================================================
   SCIENCE SCREENS
   The panels for ORACLE, GHOST, TAR and CERES, and their buttons.
   ===================================================================== */

const PERIOD_ORDER = ["Devonian", "Carboniferous", "Permian", "Triassic", "Jurassic", "Cretaceous", "Paleogene", "Neogene", "Quaternary"];
const ERA_ORDER = ["cenozoic", "mesozoic", "paleozoic"];
const ERA_COLOR = {cenozoic:"#F2D32A", mesozoic:"#34B2C9", paleozoic:"#F04028"};
const LOCK_SVG = `<svg width="10" height="11" viewBox="0 0 10 11" aria-label="locked"><rect x="1" y="5" width="8" height="6" rx="1" fill="currentColor"/><path d="M3 5V3.5a2 2 0 0 1 4 0V5" stroke="currentColor" stroke-width="1.4" fill="none"/></svg>`;

// Which tab is open in each department's panel
const MANAGE_TABS = [{key:"barrier", label:"Fences", title:"Fences and barriers", color:"#4B3A8C"}, {key:"build", label:"Buildings", title:"Buildings and systems", color:"#4B3A8C"}, {key:"tar", label:"TAR", title:"TAR upgrades", color:"#4B3A8C"}];
let oracleMain = "manage", oracleManage = "barrier", oracleTab = null, oracleEra = "mesozoic", ghostTab = null, cerePeriod = "Jurassic";

const tabBar = (action, items, cur) => `<div class="ptabs" role="tablist">${items.map(t =>
  `<button role="tab" class="ptab" data-action="${action}" data-k="${t.key}" aria-selected="${t.key === cur}" style="--pc:${t.color}">${t.lock ? LOCK_SVG : ""}${esc(t.label)}</button>`).join("")}</div>`;
// A department's bays, one per scientist, in a fixed order so the lists below never move. Hiring is the only thing that adds one.
function baysHtml(title, kind, cardOf, emptyText){
  const n = bayCount(kind);
  let h = `<section><h3>${title} (${BAY_JOBS[kind]().length} of ${n} bay${n === 1 ? "" : "s"} busy)</h3>`;
  if(!n) return h + `<div class="meta">No bays yet. Each ${SCIENTISTS[kind].label.toLowerCase()} you hire opens one.</div></section>`;
  for(let i = 0; i < n; i++){
    const j = bayJob(kind, i);
    h += j ? cardOf(j, i) : `<div class="card bay empty"><span class="bn">Bay ${i + 1}</span><span class="meta">${emptyText}</span></div>`;
  }
  return h + `</section>`;
}
const progressCard = (title, sub, j, bay) =>
  `<div class="card bay"><div class="bn">${bay === undefined ? "" : `Bay ${bay + 1}`}</div><b>${title}</b>${sub ? ` <span class="meta">${sub}</span>` : ""}<div style="margin-top:6px">${meter(doneShare(j), "var(--gold)")}</div><div class="meta" style="margin-top:4px">${leftText(j.end)} left. Ready ${whenText(j.end)}.</div></div>`;

/* ---------- ORACLE ---------- */

// Why nothing new can start at ORACLE right now, if that's so
function labBlocker(){
  const sc = state.science;
  return deptProblem("oracle") || (!sc.crew.paleo ? "Hire a paleontologist to run research." : null);
}

// One research item: its name, a button (or its progress), and what it does
function projectRow(kind, id, label, text){
  const info = projectInfo(kind, id), sc = state.science, run = sc.projects.find(p => p.kind === kind && p.id === id);
  const prereq = info.needs && !hasTech(info.needs), why = info.done || run ? null : projectProblem(kind, id);
  let right;
  if(info.done) right = `<span class="status ok">${kind === "species" ? "Unlocked" : "Researched"}</span>`;
  else if(run) right = `<span class="meta">${leftText(run.end)} left</span>`;
  else right = `<button class="buy" data-action="research" data-kind="${kind}" data-id="${esc(id)}"${why ? ` disabled title="${esc(why)}"` : ""}>${info.points} pts, ${spanText(projectMinutes(info.points))}</button>`;
  const need = prereq && !info.done ? ` Needs ${esc(projectInfo("tech", info.needs).label)} first.` : "";
  return `<li class="${prereq && !info.done ? "locked" : ""}"><span class="nm">${label}</span>${right}<span class="need">${text}${need}${run ? `<span style="display:block;margin-top:4px">${meter(doneShare(run), "var(--gold)")}</span>` : ""}</span></li>`;
}
const techRows = group => TECH.filter(t => t.group === group).map(t => projectRow("tech", t.id, esc(t.label), esc(t.text))).join("");

function oracleHtml(b){
  const sc = state.science, n = sc.crew.paleo;
  let h = deptHead(b);
  h += `<section><h3>Research</h3><div class="card"><b class="num" style="font:600 26px/1 'Barlow Condensed',sans-serif">${Math.floor(sc.points)}</b> <span class="meta">research points. ${n ? `+${n * RESEARCH_PER_PALEO} a day from your paleontologist${n === 1 ? "" : "s"}.` : "Hire a paleontologist to earn them."} Research takes time: ${spanText(projectMinutes(20))} for every 20 points.</span></div></section>`;
  h += sciStaffHtml("paleo");
  h += baysHtml("Research bays", "paleo", (p, i) => progressCard(esc(projectInfo(p.kind, p.id).label), p.kind === "species" ? "genome" : "", p, i), "Empty. Pick a project below.");
  const block = labBlocker();
  if(block) h = h.replace(/<\/section>$/, `<div class="meta" style="color:var(--bad);margin-top:6px">${esc(block)}</div></section>`);

  h += `<section>${tabBar("omain", [{key:"manage", label:"Park management", color:"#4B3A8C"}, {key:"animals", label:"Animals", color:"#1F6F73"}, {key:"flora", label:"Paleo-Flora", color:"#4E7F2E"}, {key:"medicine", label:"Paleo-Medicine", color:"#B5483A"}], oracleMain)}<div class="ptab-body">`;
  if(oracleMain === "manage"){
    const secs = MANAGE_TABS.find(t => t.key === oracleManage) || MANAGE_TABS[0];
    h += tabBar("omanage", MANAGE_TABS, secs.key);
    h += `<h3 style="margin-top:8px">${secs.title}</h3><ul class="shop">${techRows(secs.key)}</ul>`;
  } else if(oracleMain === "animals"){
    if(!oracleTab) oracleTab = PERIOD_ORDER.find(id => speciesToUnlock().some(s => s.period === id && isUnlocked(s.id))) || "Quaternary";
    h += `<div class="meta" style="margin-bottom:8px">ORACLE unlocks an animal so GHOST can go looking for its DNA. Genome progress is at GHOST.</div>`;
    h += tabBar("otab", PERIOD_ORDER.map(id => ({key:id, label:id, color:PERIOD_COLOR[id], lock:!speciesToUnlock().some(s => s.period === id && isUnlocked(s.id))})), oracleTab);
    const p = PERIOD_BY_ID[oracleTab], list = speciesToUnlock().filter(s => s.period === p.id);
    h += `<div class="meta" style="margin:8px 0">${p.ago}.</div><ul class="shop">`;
    for(const s of list) h += projectRow("species", s.id, `<span class="dot" style="background:${PERIOD_COLOR[p.id]}"></span>${speciesName(s)}`,
      `${s.space.toLocaleString()} m² each. ${starsNeed(s) ? `Needs ${starsNeed(s)}★ to clone. ` : ""}${isUnlocked(s.id) ? "GHOST can look for it." : ""}`);
    h += `</ul>`;
  } else if(oracleMain === "flora"){
    h += `<div class="meta" style="margin-bottom:8px">Plants are grown at CERES. Mesozoic and Paleozoic plants need DNA from GHOST first.</div>`;
    h += `<h3>Plants</h3><ul class="shop">${techRows("flora")}</ul>`;
    for(const era of ["mesozoic", "paleozoic"]) if(hasTech(FLORA[era].tech))
      h += `<div class="meta" style="margin-top:6px">${ERA_LABEL[era]} plant DNA, which GHOST collects from each period: ${Object.values(PLANT_DNA).filter(f => f.era === era).map(f => `${f.period} ${(sc.dna[f.id] || {genome:0}).genome}%`).join(", ")}.</div>`;
  } else {
    h += `<div class="meta" style="margin-bottom:8px">Medicine is grown at CERES.</div>`;
    h += tabBar("oera", ERA_ORDER.map(era => ({key:era, label:ERA_LABEL[era], color:ERA_COLOR[era], lock:!hasTech(MED_TECH[era])})), oracleEra);
    h += `<ul class="shop" style="margin-top:8px">${projectRow("tech", MED_TECH[oracleEra], esc(TECH.find(t => t.id === MED_TECH[oracleEra]).label), esc(TECH.find(t => t.id === MED_TECH[oracleEra]).text))}</ul>`;
    h += `<div class="meta" style="margin:10px 0 6px">${hasTech(MED_TECH[oracleEra]) ? `Refine the medicine for each period. Only refined medicine cures that period's animals fully.` : `Unlock ${ERA_LABEL[oracleEra]} medicine first, then refine it for each period.`}</div>`;
    h += `<ul class="shop">${TIME_PERIODS.filter(p => ERA_OF[p.id] === oracleEra).map(p => projectRow("refine", p.id, `<span class="dot" style="background:${PERIOD_COLOR[p.id]}"></span>${p.id}`, `${p.ago}.`)).join("")}</ul>`;
    h += `<h3 style="margin-top:12px">Genome therapy</h3><ul class="shop">${techRows("gene")}</ul>`;
  }
  h += `</div></section>`;
  return h;
}

/* ---------- GHOST ---------- */

function ghostBlocker(){
  const sc = state.science;
  return deptProblem("ghost") || (!sc.crew.temporal ? "Hire a Temporal Researcher to lead expeditions." : null);
}
// One genome GHOST can chase: progress, odds, and a button
function tripRow(id, periodId, label){
  const sc = state.science, d = sc.dna[id], open = genomeOpen(id), g = genomeInfo(id), out = sc.trips.filter(t => t.sp === id).length;
  const o = tripOdds(id, periodId), why = open ? tripProblem(id, periodId) : "locked";
  let h = `<li class="${open ? "" : "locked"}"><span class="nm">${label}</span>`;
  h += open ? `<button class="buy" data-action="trip" data-p="${periodId}" data-sp="${id}"${why ? ` disabled title="${esc(why)}"` : ""}>Send GHOST ${money(o.cost)}</button>` : `<span class="meta">Locked</span>`;
  h += `<span class="need" style="grid-column:1/-1">${dnaBar(d)}`;
  if(!open) h += g.animal ? "Unlock it at ORACLE to start collecting its DNA." : `Research ${esc(g.name)} at ORACLE first.`;
  else {
    h += `${d ? `Quality ${d.quality}%.${d.genome >= 100 ? " Complete. More trips can raise quality." : ""}` : "No DNA yet."}`;
    if(!d || d.genome < 100) h += ` About ${Math.round(o.trips)} trips for a whole genome, and ${Math.round(o.fail * 100)}% of trips find nothing.`;
    if(out) h += ` <b>${out} team${out === 1 ? "" : "s"} out looking for it.</b>`;
    if(g.animal && g.animal.stars) h += ` Needs ${g.animal.stars}★ to clone.`;
  }
  return h + `</span></li>`;
}

function ghostHtml(b){
  const sc = state.science;
  let h = deptHead(b);
  h += `<div class="meta">${esc(BUILDINGS.ghost.blurb)}</div>`;
  h += sciStaffHtml("temporal");
  h += baysHtml("Expedition bays", "temporal", (t, i) => progressCard(esc(t.period), `looking for ${esc(genomeInfo(t.sp).name)}`, t, i), "Team is home. Send it from a period below.");

  // one tab per period; animals ORACLE hasn't unlocked are greyed out
  const inPeriod = id => speciesToUnlock().filter(s => s.period === id), plantsIn = id => Object.values(PLANT_DNA).filter(f => f.period === id);
  const openIn = id => inPeriod(id).some(s => isUnlocked(s.id)) || plantsIn(id).some(f => genomeOpen(f.id));
  if(!ghostTab) ghostTab = PERIOD_ORDER.find(openIn) || "Quaternary";
  h += `<section><h3>Genomes by period</h3>${tabBar("gtab", PERIOD_ORDER.map(id => ({key:id, label:id, color:PERIOD_COLOR[id], lock:!openIn(id)})), ghostTab)}`;
  const p = PERIOD_BY_ID[ghostTab], block = ghostBlocker();
  h += `<div class="ptab-body"><div class="meta">${p.ago}. Trips here take ${spanText(Math.round(p.days * DAY_MIN))} and bring back DNA of ${p.quality[0]}–${p.quality[1]}% quality. Bigger animals take more trips.</div>`;
  if(block) h += `<div class="meta" style="color:var(--bad);margin-top:6px">${esc(block)}</div>`;
  h += `<ul class="shop" style="margin-top:10px">`;
  for(const s of inPeriod(p.id)) h += tripRow(s.id, p.id, `<span class="dot" style="background:${PERIOD_COLOR[p.id]}"></span>${speciesName(s)}`);
  for(const f of plantsIn(p.id)) h += tripRow(f.id, p.id, `<span class="dot" style="background:${PERIOD_COLOR[p.id]}"></span>${esc(f.name)} <span class="per">plants</span>`);
  h += `</ul></div></section>`;
  if(hasDept("oracle")) h += `<div class="row"><button class="btn" data-action="gotoDept" data-t="oracle">Open ORACLE</button></div>`;
  if(sc.log.length) h += `<section><h3>Recent expeditions</h3><ul class="issues">${sc.log.map(l => `<li class="${l.ok ? "" : "bad"}">Day ${l.day}. ${esc(l.text)}</li>`).join("")}</ul></section>`;
  return h;
}

/* ---------- TAR ---------- */

function tarHtml(b){
  const sc = state.science;
  let h = deptHead(b);
  h += `<div class="meta">A complete genome can be cloned as many times as you like. Clone quality follows the DNA quality: under 70% makes sickly animals, under 50% frail ones.</div>`;
  h += sciStaffHtml("gene");
  const speed = Math.round(cloneSpeed() * 100);
  h += baysHtml("Incubator bays", "gene", (c, i) => { const s = SPECIES_BY_ID[c.sp], e = state.exhibits.find(x => x.id === c.exhibitId); return progressCard(esc(s.name), `for ${e ? esc(e.name) : "no exhibit yet"}`, c, i); }, "Empty. Order a clone below or from an exhibit's panel.");
  h = h.replace(/<\/section>$/, `<div class="meta">Clones take ${speed === 100 ? "their usual time" : `${speed}% of the usual time`}. ${hasTech("fast2") ? "" : "Research faster incubators at ORACLE, under Park management."}</div></section>`);
  if(sc.ready.length) h += `<section><h3>Waiting for an exhibit</h3><ul class="herd">${sc.ready.map(r => `<li><span class="dot" style="background:${PERIOD_COLOR[SPECIES_BY_ID[r.sp].period]}"></span><span>${esc(SPECIES_BY_ID[r.sp].name)}</span><span class="meta">${r.q}% DNA</span></li>`).join("")}</ul><div class="meta" style="margin-top:6px">Tap an exhibit and choose "Move in here".</div></section>`;
  const lib = SPECIES.filter(s => sc.dna[s.id]);
  h += `<section><h3>Genome library</h3>`;
  if(!lib.length) h += `<div class="meta">No DNA yet. GHOST's expeditions fill this up.</div>`;
  else {
    h += `<ul class="shop">`;
    for(const s of lib){
      const d = sc.dna[s.id], why = d.genome >= 100 ? cloneProblem(s.id) : "Genome incomplete.";
      h += `<li><span class="nm"><span class="dot" style="background:${PERIOD_COLOR[s.period]}"></span>${speciesName(s)}</span>`;
      h += d.genome >= 100 ? `<button class="buy" data-action="clone" data-sp="${s.id}"${why ? ` disabled title="${esc(why)}"` : ""}>Clone ${money(s.price)}</button>` : `<span class="meta">${d.genome}%</span>`;
      h += `<span class="need" style="grid-column:1/-1">${dnaBar(d)}Quality ${d.quality}%. ${d.genome >= 100 ? `Takes ${spanText(cloneMinutes(s.id))}.` : ""}${d.genome >= 100 && state.rating + 1e-9 < starsNeed(s) ? ` Needs ${starsNeed(s)}★.` : ""}</span></li>`;
    }
    h += `</ul>`;
  }
  h += `</section>`;
  return h;
}

/* ---------- CERES ---------- */

function growRow(kind, era, size){
  const gi = growInfo(kind, era, size), unlocked = kind === "plant" ? hasTech(FLORA[ERA_OF[era]].tech) : hasTech(MED_TECH[era]);
  const why = unlocked ? growProblem(kind, era, size) : "locked", q = growing(kind, era, size), c = state.ceres;
  const name = growName(kind, era, size), sz = size ? ` data-size="${size}"` : "";
  let h = `<li class="${unlocked ? "" : "locked"}"><span class="nm">${name}</span>`;
  h += unlocked ? `<button class="buy" data-action="grow" data-kind="${kind}" data-era="${era}"${sz}${why ? ` disabled title="${esc(why)}"` : ""}>Grow ${money(gi.cost)}</button>` : `<span class="meta">Locked</span>`;
  h += `<span class="need">`;
  if(!unlocked) h += `Research ${kind === "plant" ? `${FLORA[ERA_OF[era]].label} flora` : `${ERA_LABEL[era]} medicine`} at ORACLE first.`;
  else {
    const have = size ? c.pots[era + "-" + size] || 0 : 0;
    h += `A batch takes ${spanText(growMinutes(kind, era, size))}. ${kind === "plant" ? `It makes ${gi.count} plants for any ${era} biome. ${have} ready.` : `It makes ${gi.doses} doses.`}${q ? ` <b>${q} growing.</b>` : ""}`;
    if(why && kind === "plant" && !plantDnaDone(era)) h += ` <span style="color:var(--bad)">${esc(why)}</span>`;
  }
  h += `</span>`;
  if(unlocked && kind === "med") h += `<span class="need" style="grid-column:1/-1"><button class="btn" data-action="autoGrow" data-era="${era}" aria-pressed="${!!c.auto[era]}" style="padding:3px 9px">${c.auto[era] ? "Keeping it stocked" : "Keep it stocked"}</button> <span class="meta">${c.auto[era] ? "A free bed starts a batch whenever there's room for more." : "Starts batches by itself when there's room."}</span></span>`;
  return h + `</li>`;
}

function ceresHtml(b){
  const sc = state.science, c = state.ceres;
  let h = deptHead(b) + `<div class="meta">${esc(BUILDINGS.ceres.blurb)}</div>`;
  h += sciStaffHtml("botanist");
  const pe = state.exhibits.filter(e => e.animals.some(a => foodType(SPECIES_BY_ID[a.sp]) === "paleoflora"));
  h += `<section><h3>Paleoflora food</h3>`;
  if(!hasTech("paleoflora")) h += `<div class="meta" style="color:var(--bad)">Research Paleoflora cultivation at ORACLE before CERES can grow it. Until then, keepers feed prehistoric plant-eaters grass hay.</div>`;
  else if(!anyPlantDna()) h += `<div class="meta" style="color:var(--bad)">CERES needs plant DNA first. Research Mesozoic or Paleozoic flora at ORACLE, then send GHOST to collect it. Until then, keepers feed prehistoric plant-eaters grass hay.</div>`;
  else {
    const st = c.stock, cap = ceresCap(), need = state.exhibits.reduce((s, e) => s + (dailyNeed(e).paleoflora || 0), 0);
    h += `<div class="factor" style="grid-template-columns:70px 1fr 74px"><span>In stock</span>${meter(st / cap * 100, FOOD_COLOR.paleoflora)}<span>${Math.floor(st)}/${Math.round(cap)}</span></div>`;
    h += `<dl class="kv" style="margin-top:6px"><dt>Grows</dt><dd>${ceresRate()} a day</dd><dt>Greenhouses</dt><dd>${greenhouses().length} (+${PALEOFLORA.greenhouse} a day each)</dd><dt>Your animals eat</dt><dd style="color:${need > ceresRate() ? "var(--bad)" : "inherit"}">${need} a day</dd></dl>`;
    if(need > ceresRate()) h += `<div class="meta" style="color:var(--bad)">CERES can't keep up. ${hasTech("greenhouse") ? "Build greenhouses." : "Research greenhouses at ORACLE."} When it runs dry, keepers bring grass hay instead.</div>`;
  }
  h += `<div class="meta" style="margin-top:6px">${isReachable(b) ? "" : "Connect CERES to a path or service road so keepers can collect Paleoflora. "}${pe.length} exhibit${pe.length === 1 ? "" : "s"} eat Paleoflora.</div></section>`;

  h += baysHtml("Growing bays", "botanist", (j, i) => progressCard(growName(j.kind, j.era, j.size), "", j, i), "Empty. Grow something below.");
  h = h.replace(/<\/section>$/, `<div class="meta">Like TAR's incubators, but with plants. Each botanist tends one bed, one batch at a time.</div></section>`);

  const planted = period => state.exhibits.reduce((n, e) => n + landOf(e).filter(f => LAND[f.type] && LAND[f.type].period === period && LAND[f.type].flora !== "cenozoic").length, 0);
  h += `<section><h3>Plants for exhibits</h3><div class="meta">Small, medium and large plants for Landscaping, grown per period from the DNA GHOST collects. Each one placed in an exhibit uses up one plant.</div>`;
  h += `<div style="margin-top:8px">${tabBar("cperiod", Object.keys(PLANT_DNA).map(p => ({key:p, label:p, color:PERIOD_COLOR[p], lock:!hasTech(FLORA[PLANT_DNA[p].era].tech)})), cerePeriod)}</div>`;
  const dna = sc.dna[PLANT_DNA[cerePeriod].id];
  h += `<div class="meta" style="margin-top:4px">${cerePeriod} plant DNA: ${dna ? dna.genome : 0}%${dna && dna.genome >= 100 ? ". Complete." : hasTech(FLORA[PLANT_DNA[cerePeriod].era].tech) ? ". GHOST is still collecting it." : "."} Planted so far: ${planted(cerePeriod)}.</div>`;
  h += `<ul class="shop" style="margin-top:8px">${PLANT_SIZES.map(sz => growRow("plant", cerePeriod, sz)).join("")}</ul></section>`;

  h += `<section><h3>Medicine</h3>`;
  if(!anyMedTech()) h += `<div class="meta">Research medicine at ORACLE and CERES can grow doses for the PMC and for medicated feed.</div>`;
  const fed = state.exhibits.filter(e => e.medFeed && e.animals.length), use = fed.reduce((s, e) => s + feedDoses(e), 0);
  h += `<div class="factor" style="grid-template-columns:70px 1fr 74px"><span>At CERES</span>${meter((c.meds || 0) / medCap() * 100, "#B0384F")}<span>${Math.floor(c.meds || 0)}/${medCap()}</span></div>`;
  h += `<div class="meta">Keepers carry doses to the PMC${stores().some(s => storeOf(s).cold) ? " and cold stores" : ""}. Doses spoil slowly, and slower in a powered cold store. Medicated feed uses ${use} a day for ${fed.length} exhibit${fed.length === 1 ? "" : "s"}.</div>`;
  h += `<ul class="shop" style="margin-top:8px">${ERA_ORDER.map(era => growRow("med", era)).join("")}</ul></section>`;

  return h;
}

/* ---------- clicks ---------- */

panelEl.addEventListener("click", ev => {
  const b = ev.target.closest("[data-action]"); if(!b) return;
  const a = b.dataset.action, done = () => { afterChange(); render(); };
  if(a === "omain"){ oracleMain = b.dataset.k; ui.panel(); return; }
  if(a === "omanage"){ oracleManage = b.dataset.k; ui.panel(); return; }
  if(a === "otab"){ oracleTab = b.dataset.k; ui.panel(); return; }
  if(a === "oera"){ oracleEra = b.dataset.k; ui.panel(); return; }
  if(a === "cperiod"){ cerePeriod = b.dataset.k; ui.panel(); return; }
  if(a === "gtab"){ ghostTab = b.dataset.k; ui.panel(); return; }
  if(a === "research"){ const why = startProject(b.dataset.kind, b.dataset.id); if(why) ui.toast(why, "bad"); done(); return; }
  if(a === "trip"){ if(launchTrip(b.dataset.sp, b.dataset.p)) done(); return; }
  if(a === "grow"){ if(growBatch(b.dataset.kind, b.dataset.era, b.dataset.size)) done(); else ui.toast(growProblem(b.dataset.kind, b.dataset.era, b.dataset.size) || "CERES can't grow that.", "bad"); return; }
  if(a === "autoGrow"){ state.ceres.auto[b.dataset.era] = !state.ceres.auto[b.dataset.era]; done(); return; }
});
