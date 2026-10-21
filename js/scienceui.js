/* =====================================================================
   SCIENCE SCREENS
   The panels for ORACLE, GHOST, TAR and CERES, and their buttons.
   ===================================================================== */

const PERIOD_ORDER = ["Devonian", "Carboniferous", "Permian", "Triassic", "Jurassic", "Cretaceous", "Paleogene", "Neogene", "Quaternary"];
const ERA_ORDER = ["cenozoic", "mesozoic", "paleozoic"];
const ERA_COLOR = {cenozoic:"#F2D32A", mesozoic:"#34B2C9", paleozoic:"#F04028"};
const LOCK_SVG = `<svg width="10" height="11" viewBox="0 0 10 11" aria-label="locked"><rect x="1" y="5" width="8" height="6" rx="1" fill="currentColor"/><path d="M3 5V3.5a2 2 0 0 1 4 0V5" stroke="currentColor" stroke-width="1.4" fill="none"/></svg>`;

// Which tab is open in each department's panel
const MANAGE_TABS = [{key:"barrier", label:"Fences", title:"Fences and barriers", color:"#4B3A8C"}, {key:"build", label:"Buildings", title:"Buildings and systems", color:"#4B3A8C"}, {key:"tar", label:"TAR", title:"TAR upgrades", color:"#4B3A8C"}, {key:"ghost", label:"GHOST", title:"GHOST upgrades", color:"#4B3A8C"}];
let oracleMain = "manage", oracleManage = "barrier", oracleEra = "mesozoic", cerePeriod = "Jurassic";

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

// A clone in an incubator: a progress bar that keeps moving (cloneLive), or, once it has died, a red CLONE FAILED overlay over the card with the bar
// stopped where it failed and a button to discard the specimen. `bay` is the bay number, left out in an exhibit's Cloning tab.
function cloneCard(c, bay){
  const s = SPECIES_BY_ID[c.sp], e = state.exhibits.find(x => x.id === c.exhibitId), pct = Math.round(cloneProgress(c));
  const bar = `<div style="margin-top:6px;position:relative;z-index:2"><div class="meter" data-cbar="${c.id}"><i style="width:${pct}%;background:${c.failed ? "#d94b4b" : "var(--gold)"}"></i></div></div>`;
  const txt = c.failed ? `Stopped at ${pct}%.` : `${pct}%. ${leftText(c.end)} left. Ready ${whenText(c.end)}.`;
  const head = `<div class="bn">${bay === undefined ? "" : `Bay ${bay + 1}`}</div><b>${esc(s.name)}</b> <span class="meta">${sexMark(c)} for ${e ? esc(e.name) : "no exhibit yet"}</span>`;
  const ov = c.failed ? `<div style="position:absolute;inset:0;z-index:1;border-radius:10px;background:rgba(140,18,18,.88);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding-top:8px;text-align:center;gap:3px"><div style="font:800 19px/1.1 system-ui,sans-serif;letter-spacing:.12em">CLONE FAILED</div><div style="font-size:11px;opacity:.95;padding:0 10px">${esc(c.why || "Culture failure")}. Specimen lost at ${pct}%.</div><button class="btn" data-action="discardClone" data-id="${c.id}" style="margin-top:2px;padding:2px 10px">Discard specimen</button></div>` : "";
  return `<div class="card bay" style="position:relative${c.failed ? ";min-height:112px" : ""}">${head}${c.failed ? "<div style=\"height:46px\"></div>" : ""}${bar}<div class="meta" style="margin-top:4px;position:relative;z-index:2${c.failed ? ";color:#fff" : ""}" data-ctxt="${c.id}">${txt}</div>${ov}</div>`;
}
// Moves the clone bars while the panel stays as it is (the panel is not rebuilt while the mouse is over it)
function cloneLive(){
  for(const el of document.querySelectorAll("[data-cbar]")){
    const c = state.science.clones.find(x => x.id === el.dataset.cbar); if(!c || c.failed) continue;
    const pct = Math.round(cloneProgress(c)), i = el.firstElementChild;
    if(i) i.style.width = pct + "%";
    const t = document.querySelector(`[data-ctxt="${c.id}"]`); if(t) t.textContent = `${pct}%. ${leftText(c.end)} left. Ready ${whenText(c.end)}.`;
  }
}

/* ---------- ORACLE ---------- */

// Why nothing new can start at ORACLE right now, if that's so
function labBlocker(){
  const sc = state.science;
  return deptProblem("oracle") || (!sc.crew.paleo ? "Hire a researcher to run research." : null);
}

// One research item: its name, a button (or its progress), and what it does
function projectRow(kind, id, label, text){
  const info = projectInfo(kind, id), sc = state.science, run = sc.projects.find(p => p.kind === kind && p.id === id);
  const prereq = info.needs && !hasTech(info.needs), why = info.done || run ? null : projectProblem(kind, id);
  let right;
  if(info.done) right = `<span class="status ok">Researched</span>`;
  else if(run) right = `<span class="meta">${leftText(run.end)} left</span>`;
  else right = `<button class="buy" data-action="research" data-kind="${kind}" data-id="${esc(id)}"${why ? ` disabled title="${esc(why)}"` : ""}>${info.points} pts, ${spanText(projectMinutes(info.points))}</button>`;
  const need = prereq && !info.done ? ` Needs ${esc(projectInfo("tech", info.needs).label)} first.` : "";
  return `<li class="${prereq && !info.done ? "locked" : ""}"><span class="nm">${label}</span>${right}<span class="need">${text}${need}${run ? `<span style="display:block;margin-top:4px">${meter(doneShare(run), "var(--gold)")}</span>` : ""}</span></li>`;
}
const techRows = group => TECH.filter(t => t.group === group && !techHidden(t.id)).map(t => projectRow("tech", t.id, esc(t.label), esc(t.text))).join("");

function oracleHtml(b){
  const sc = state.science, n = sc.crew.paleo, idle = Math.max(0, n - sc.projects.length);
  let h = deptHead(b);
  h += `<section><h3>Research</h3><div class="card"><b class="num" style="font:600 26px/1 'Barlow Condensed',sans-serif">${Math.floor(sc.points)}</b> <span class="meta">research points. ${n ? `+${idle * RESEARCH_PER_PALEO} a day from ${idle} researcher${idle === 1 ? "" : "s"} on general research${idle < n ? ` (${n - idle} busy on projects)` : ""}.` : "Hire a researcher to earn them."} Educated guests add more when they leave. Research takes time: ${spanText(projectMinutes(30))} for every 30 points.</span></div></section>`;
  h += sciStaffHtml("paleo");
  h += baysHtml("Research bays", "paleo", (p, i) => progressCard(esc(projectInfo(p.kind, p.id).label), "", p, i).replace(/<\/div>$/, `<button class="buy" data-action="stopResearch" data-i="${sc.projects.indexOf(p)}" style="margin-top:6px" title="The points come back.">Back to general research</button></div>`), `On general research: +${RESEARCH_PER_PALEO} points a day. Pick a project below to assign them.`);
  const block = labBlocker();
  if(block) h = h.replace(/<\/section>$/, `<div class="meta" style="color:var(--bad);margin-top:6px">${esc(block)}</div></section>`);

  h += `<section>${tabBar("omain", [{key:"manage", label:"Park management", color:"#4B3A8C"}, {key:"flora", label:"Paleo-Flora", color:"#4E7F2E"}, {key:"medicine", label:"Paleo-Medicine", color:"#B5483A"}], oracleMain)}<div class="ptab-body">`;
  if(oracleMain === "manage"){
    const secs = MANAGE_TABS.find(t => t.key === oracleManage) || MANAGE_TABS[0];
    h += tabBar("omanage", MANAGE_TABS, secs.key);
    h += `<h3 style="margin-top:8px">${secs.title}</h3><ul class="shop">${techRows(secs.key)}</ul>`;
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

// The timeline's place (0 the oldest, 1 today), the open site, and the expedition target picked on its card. Not saved.
let ghostU = null, ghostSite = null, ghostPick = null;
const GT_EVENT = "#E9C766", GT_LIT = "#D9FF00", GT_MARK = "#454646";
const tripWhen = siteId => spanText(tripMinutes(siteId));
// Where the slider opens: on the newest scouted site, else in the Pleistocene
function ghostStart(){
  const s = TIME_SITES.filter(x => isScouted(x.id) && Object.keys(x.at).length).pop();
  return uAt(s ? Math.sqrt(s.from * s.to) : 30000);
}
// "378 to 372 million years ago", "1,000 to 362 years ago"
const siteWindow = s => s.to >= 1e6 ? `${+(s.from / 1e6).toFixed(1)} to ${+(s.to / 1e6).toFixed(1)} million years ago` : `${fmtYearsAgo(s.from).replace(" ago", "")} to ${fmtYearsAgo(s.to)}`;

function ghostHeadHtml(now){
  const e = now.epoch;
  return `<b class="gt-epoch">${esc(e.name)}</b><div class="gt-ago">${fmtYearsAgo(now.years)}</div>` +
    `<div class="meta gt-period"><span class="dot" style="background:${PERIOD_COLOR[e.period]}"></span>${e.period}</div>`;
}
function ghostMapHtml(now){
  const e = now.epoch, m = epochMap(e), [W, H] = TIMELINE_MAP_SIZE;
  let h = `<svg class="gt-map" viewBox="0 0 ${W} ${H}" role="img" aria-label="Map of the Earth, ${esc(e.name)}"><image href="${spriteUrl(`sprites/timeline/${m}.png`)}" x="0" y="0" width="${W}" height="${H}"/>`;
  for(const s of sitesIn(e)){
    const at = s.at[m]; if(!at) continue;
    const [x, y] = at, c = s.event ? (siteLit(s) ? GT_EVENT : GT_MARK) : isScouted(s.id) ? GT_LIT : GT_MARK;
    h += `<g class="gt-site${ghostSite === s.id ? " on" : ""}" data-site="${s.id}"><rect class="gt-frame" x="${x - 2}" y="${y - 2}" width="6" height="6"/><rect x="${x}" y="${y}" width="2" height="2" fill="${c}"/></g>`;
  }
  return h + `</svg>`;
}
function ghostTrackHtml(){
  return `<div class="gt-track" role="slider" tabindex="0" aria-label="Time" aria-valuemin="0" aria-valuemax="1000"><div class="gt-bars">${TIMELINE.map(p =>
    `<div class="gt-bar" title="${p.id}">${p.epochs.map((e, j) => `<i style="background:${j % 2 ? `color-mix(in srgb, ${PERIOD_COLOR[p.id]} 80%, black)` : PERIOD_COLOR[p.id]}"></i>`).join("")}</div>`).join("")}</div><div class="gt-thumb" style="left:${ghostU * 100}%"></div></div>` +
    `<div class="gt-labels">${TIMELINE.map(p => `<span>${p.id.slice(0, 3)}</span>`).join("")}</div>`;
}
const siteLabel = s => siteLit(s) ? s.name : `Unscouted site, ${fmtMa(s.from)} years ago`;
function ghostChipsHtml(now){
  return sitesIn(now.epoch).filter(s => Object.keys(s.at).length).map(s =>
    `<button class="gt-chip" data-action="gsite" data-site="${s.id}" aria-pressed="${ghostSite === s.id}"><i style="background:${s.event ? (siteLit(s) ? GT_EVENT : GT_MARK) : isScouted(s.id) ? GT_LIT : GT_MARK}"></i>${esc(siteLabel(s))}${siteComplete(s) ? ` <span class="gt-done">Site Complete</span>` : ""}</button>`).join("");
}
function reportHtml(r){
  const s = SITE_BY_ID[r.site];
  return `<div class="gt-report" role="status"><div class="gt-rh">${r.kind === "scout" ? "Scouting" : "Expedition"} report · ${esc(s ? placeName(s.id) : r.site)} · Drone ${r.drone + 1}</div><ul>${r.lines.map(([t, big]) => `<li${big ? ` class="big"` : ""}>${esc(t)}</li>`).join("")}</ul><button class="btn" data-action="greport" data-id="${r.id}" style="padding:3px 10px">Done</button></div>`;
}
// One expedition target on a site card: pick it, its genome so far, and its chance of a find
function targetRow(s, id){
  const g = genomeInfo(id), d = state.science.dna[id], o = tripOdds(id, s.id);
  const lock = g.animal && state.rating + 1e-9 < starsNeed(g.animal), done = genomeDone(id);
  const label = g.animal ? speciesName(g.animal) : g.plant ? `${esc(g.plant.period)} flora <span class="per">plants</span>` : esc(g.name);
  return `<tr class="${lock || done ? "locked" : ""}"><td><label><input type="radio" name="gpick" data-action="gpick" data-sp="${id}"${ghostPick === id ? " checked" : ""}${lock || done ? " disabled" : ""}> ${label}${lock ? ` <span class="gt-tag">Needs ${starsNeed(g.animal)}★</span>` : ""}</label></td><td>${d ? d.genome : 0}%</td><td>${Math.round((1 - o.fail) * 100)}%</td></tr>`;
}
function ghostCardHtml(){
  const s = SITE_BY_ID[ghostSite];
  if(!s || !siteShown(s)) return `<div class="meta">Pick a site on the map to see what's there.</div>`;
  const lit = siteLit(s), rep = state.science.reports.find(r => r.site === s.id), btn = (action, label, why) => `<button class="buy" data-action="${action}"${why ? ` disabled title="${esc(why)}"` : ""}>${label}</button>`;
  const note = why => why ? `<div class="meta" style="color:var(--bad);margin-top:4px">${esc(why)}</div>` : "";
  if(s.event){
    const ev = MUSEUM_BY_ID[s.event], why = lit ? expeditionProblem(s.id, s.event) : "Research education programs at ORACLE first.";
    return `<b class="gt-name">${esc(ev.name)}</b><div class="meta">${esc(s.name)}, ${esc(s.where)}</div>` +
      `<dl class="kv" style="margin-top:6px"><dt>When</dt><dd>${esc(ev.ago)}</dd><dt>Trip</dt><dd>${money(tripOdds(s.event, s.id).cost)} · ${tripWhen(s.id)}</dd></dl>` +
      `<div class="meta" style="margin:6px 0">A moment from deep time. Each trip records more of it; a finished record becomes an Education Center attraction.</div>` +
      (lit ? `<table class="gt-targets"><thead><tr><th>Record</th><th>Done</th><th>Survey Success</th></tr></thead><tbody>${targetRow(s, s.event)}</tbody></table>` : "") +
      (rep ? reportHtml(rep) : "") + `<div class="row" style="margin-top:8px">${btn("gdig", "Send expedition", why)}</div>${note(why)}`;
  }
  const trip = `${money(scoutCost(s.id))} · ${tripWhen(s.id)}`, swhy = scoutProblem(s.id);
  if(!lit) return `<b class="gt-name">Unscouted site</b><div class="meta">Somewhere in the ${esc(epochOf(s.from).name)}</div>` +
    `<dl class="kv" style="margin-top:6px"><dt>When</dt><dd>${siteWindow(s)}</dd><dt>Animals</dt><dd>Scout Site First</dd><dt>Trip</dt><dd>${trip}</dd></dl>` +
    (rep ? reportHtml(rep) : "") + `<div class="row" style="margin-top:8px">${btn("gscout", "Send scouting trip", swhy)}</div>${note(swhy)}`;
  const targets = siteTargets(s), hidden = siteFauna(s).length - siteSeen(s).length;
  if(ghostPick && !targets.includes(ghostPick)) ghostPick = null;
  const dwhy = ghostPick ? expeditionProblem(s.id, ghostPick) : "Pick a target first.";
  return `<b class="gt-name">${esc(s.name)}${!hidden ? ` <span class="gt-badge">Site Complete</span>` : ""}</b><div class="meta">${esc(s.where)}</div>` +
    `<dl class="kv" style="margin-top:6px"><dt>When</dt><dd>${siteWindow(s)}</dd><dt>Trip</dt><dd>${trip}</dd></dl>` +
    `<table class="gt-targets"><thead><tr><th>Target</th><th>Genome</th><th>Survey Success</th></tr></thead><tbody>${targets.map(id => targetRow(s, id)).join("")}` +
    `${Array.from({length:hidden}, () => `<tr class="locked"><td>Undiscovered species</td><td>?</td><td>?</td></tr>`).join("")}</tbody></table>` +
    (rep ? reportHtml(rep) : "") +
    `<div class="row" style="margin-top:8px">${btn("gdig", ghostPick ? `Send expedition ${money(tripOdds(ghostPick, s.id).cost)}` : "Send expedition", dwhy)}${hidden ? btn("gscout", "Send scouting trip", swhy) : ""}</div>` +
    note(ghostPick ? dwhy : hidden ? swhy : null);
}
function droneCard(i){
  const sc = state.science, t = sc.trips.find(x => x.bay === i), mk = GHOST_MK[droneMk()].name;
  if(!t) return `<div class="card bay gt-drone"><div class="bn">Drone ${i + 1} · ${mk}</div><span class="meta">At GHOST, ready.</span></div>`;
  const s = SITE_BY_ID[t.site], what = t.kind === "scout" ? "Scouting for animals" : MUSEUM_BY_ID[t.sp] ? `Recording the ${esc(genomeInfo(t.sp).name)}` : `Looking for ${esc(genomeInfo(t.sp).name)}`;
  return `<div class="card bay gt-drone"><div class="bn">Drone ${i + 1} · ${mk}</div><b>${esc(placeName(t.site))}</b>${s && s.from <= EPOCHS[0].from ? ` <span class="meta">${esc(epochOf(s.from).name)}</span>` : ""}<div class="meta">${what}</div>` +
    `<div style="margin-top:6px" data-dbar="${i}">${meter(doneShare(t), "var(--gold)")}</div><div class="meta" style="margin-top:4px" data-deta="${i}">Back in ${leftText(t.end)}.</div></div>`;
}
// Moves the drone bars while the panel stays as it is
function ghostLive(){
  for(const el of document.querySelectorAll("[data-dbar]")){
    const t = state.science.trips.find(x => x.bay === +el.dataset.dbar); if(!t) continue;
    const i = el.querySelector(".meter i"); if(i) i.style.width = doneShare(t).toFixed(0) + "%";
    const e = document.querySelector(`[data-deta="${el.dataset.dbar}"]`); if(e) e.textContent = `Back in ${leftText(t.end)}.`;
  }
}

function ghostHtml(b){
  const sc = state.science;
  if(ghostU === null) ghostU = ghostStart();
  let h = deptHead(b);
  h += `<div class="meta">${esc(BUILDINGS.ghost.blurb)}</div>`;
  if(deptProblem("ghost")) h += `<div class="meta" style="color:var(--bad)">${esc(deptProblem("ghost"))}</div>`;
  // the drones: where each one is, what it's after and when it's back
  const dwhy = droneProblem();
  h += `<section class="gt-drones"><h3>Drones <span class="meta">${sc.drones} of ${DRONES.max}</span></h3>${Array.from({length:sc.drones}, (_, i) => droneCard(i)).join("")}`;
  h += `<div class="row">${sc.drones < DRONES.max ? `<button class="buy" data-action="gbuy"${dwhy ? ` disabled title="${esc(dwhy)}"` : ""}>Buy a drone ${money(dronePrice())}</button>` : `<span class="meta">GHOST's hangar is full.</span>`}</div>`;
  h += `<div class="meta" style="margin-top:4px">Every drone is GHOST ${GHOST_MK[droneMk()].name}.${droneMk() < GHOST_MK.length - 1 ? ` ORACLE can research better ones under Park management, GHOST.` : ""}</div></section>`;
  if(sc.reports.length) h += `<section><h3>Reports</h3>${sc.reports.map(reportHtml).join("")}</section>`;
  // the timeline: slide through deep time, tap a site
  const now = yearsAt(ghostU);
  h += `<section class="gt"><h3>Timeline</h3><div id="gtHead">${ghostHeadHtml(now)}</div><div id="gtMap">${ghostMapHtml(now)}</div>${ghostTrackHtml()}`;
  h += `<div id="gtChips" class="gt-chips">${ghostChipsHtml(now)}</div><div id="gtCard" class="card">${ghostCardHtml()}</div>`;
  h += `<div class="meta" style="margin-top:6px">Maps from the PALEOMAP PaleoDEMs: Scotese and Wright (2018), CC BY 4.0.</div></section>`;
  // events older than the slider
  const deep = TIME_SITES.filter(s => s.event && !Object.keys(s.at).length && siteShown(s));
  if(deep.length) h += `<section><h3>Deep time</h3><ul class="shop">${deep.map(s => {
    const ev = MUSEUM_BY_ID[s.event], d = sc.dna[s.event], why = siteLit(s) ? expeditionProblem(s.id, s.event) : "Research education programs at ORACLE first.";
    return `<li class="${siteLit(s) ? "" : "locked"}"><span class="nm">${esc(ev.name)} <span class="per">${esc(ev.ago)}</span></span><button class="buy" data-action="gdeep" data-site="${s.id}"${why ? ` disabled title="${esc(why)}"` : ""}>Record ${money(tripOdds(s.event, s.id).cost)}</button><span class="need" style="grid-column:1/-1">${dnaBar(d)}${esc(s.name)}, ${esc(s.where)}. Survey Success ${Math.round((1 - tripOdds(s.event, s.id).fail) * 100)}%.</span></li>`; }).join("")}</ul></section>`;
  if(hasDept("oracle")) h += `<div class="row"><button class="btn" data-action="gotoDept" data-t="oracle">Open ORACLE</button></div>`;
  if(sc.log.length) h += `<section><h3>Recent trips</h3><ul class="issues">${sc.log.map(l => `<li class="${l.ok ? "" : "bad"}">${fmtDate(l.day)}. ${esc(l.text)}</li>`).join("")}</ul></section>`;
  return h;
}
// Redraw the timeline's parts in place (dragging the slider or picking a site), so the slider keeps hold of the pointer
function ghostRefresh(){
  const now = yearsAt(ghostU), $el = id => document.getElementById(id);
  if(ghostSite && !sitesIn(now.epoch).some(s => s.id === ghostSite)){ ghostSite = null; ghostPick = null; }
  if($el("gtHead")) $el("gtHead").innerHTML = ghostHeadHtml(now);
  if($el("gtMap")) $el("gtMap").innerHTML = ghostMapHtml(now);
  if($el("gtChips")) $el("gtChips").innerHTML = ghostChipsHtml(now);
  if($el("gtCard")) $el("gtCard").innerHTML = ghostCardHtml();
  const tr = document.querySelector(".gt-track");
  if(tr){ tr.querySelector(".gt-thumb").style.left = (ghostU * 100) + "%"; tr.setAttribute("aria-valuenow", Math.round(ghostU * 1000)); tr.setAttribute("aria-valuetext", `${now.epoch.name}, ${fmtYearsAgo(now.years)}`); }
}
// Dragging the slider, its keys, and taps on the map (the nearest marker within 14 map pixels)
panelEl.addEventListener("pointerdown", ev => {
  const tr = ev.target.closest(".gt-track"); if(!tr) return;
  const go = x => { const r = tr.getBoundingClientRect(); ghostU = clamp((x - r.left) / r.width, 0, 1); ghostRefresh(); };
  tr.setPointerCapture(ev.pointerId); tr.focus(); go(ev.clientX);
  const mv = e => go(e.clientX), up = () => { tr.removeEventListener("pointermove", mv); tr.removeEventListener("pointerup", up); tr.removeEventListener("pointercancel", up); };
  tr.addEventListener("pointermove", mv); tr.addEventListener("pointerup", up); tr.addEventListener("pointercancel", up);
});
panelEl.addEventListener("keydown", ev => {
  const tr = ev.target.closest(".gt-track"); if(!tr) return;
  const e = yearsAt(ghostU).epoch, i = EPOCHS.indexOf(e), slice = 1 / TIMELINE.length / TIMELINE[e.pi].epochs.length;
  const jump = k => { const t = EPOCHS[clamp(i + k, 0, EPOCHS.length - 1)]; return (t.pi + (t.ej + .5) / TIMELINE[t.pi].epochs.length) / TIMELINE.length; };
  const to = {ArrowLeft:ghostU - slice / 20, ArrowDown:ghostU - slice / 20, ArrowRight:ghostU + slice / 20, ArrowUp:ghostU + slice / 20, PageDown:jump(-1), PageUp:jump(1), Home:0, End:1}[ev.key];
  if(to === undefined) return;
  ev.preventDefault(); ghostU = clamp(to, 0, 1); ghostRefresh();
});
panelEl.addEventListener("click", ev => {
  const svg = ev.target.closest(".gt-map"); if(!svg) return;
  const pt = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(svg.getScreenCTM().inverse());
  let best = null, bd = 14;
  for(const g of svg.querySelectorAll(".gt-site")){ const r = g.querySelector(".gt-frame"), d = Math.hypot(+r.getAttribute("x") + 3 - pt.x, +r.getAttribute("y") + 3 - pt.y); if(d < bd){ bd = d; best = g; } }
  if(best){ if(best.dataset.site !== ghostSite) ghostPick = null; ghostSite = best.dataset.site; ghostRefresh(); }
});

/* ---------- TAR ---------- */

function tarHtml(b){
  const sc = state.science;
  let h = deptHead(b);
  h += `<div class="meta">A genome that is ${CLONE_GENOME.min}% complete or more can be cloned as many times as you like. Clone quality follows how complete it is: under 70% makes sickly animals, under 50% frail ones.</div>`;
  h += sciStaffHtml("gene");
  const speed = Math.round(cloneSpeed() * 100);
  h += baysHtml("Incubator bays", "gene", (c, i) => cloneCard(c, i), "Empty. Order a clone below or from an exhibit's panel.");
  h = h.replace(/<\/section>$/, `<div class="meta">Clones take ${speed === 100 ? "their usual time" : `${speed}% of the usual time`}. ${hasTech("fast2") ? "" : "Research faster incubators at ORACLE, under Park management."}</div></section>`);
  if(sc.ready.length) h += `<section><h3>Waiting for an exhibit</h3><ul class="herd">${sc.ready.map(r => `<li><span class="dot" style="background:${PERIOD_COLOR[SPECIES_BY_ID[r.sp].period]}"></span><span>${esc(SPECIES_BY_ID[r.sp].name)}</span><span class="meta">${sexMark(r)} ${r.q}% DNA</span></li>`).join("")}</ul><div class="meta" style="margin-top:6px">Tap an exhibit and choose "Move in here".</div></section>`;
  const lib = SPECIES.filter(s => sc.dna[s.id]);
  h += `<section><h3>Genome library</h3>`;
  if(!lib.length) h += `<div class="meta">No DNA yet. GHOST's expeditions fill this up.</div>`;
  else {
    h += `<ul class="shop">`;
    for(const s of lib){
      const d = sc.dna[s.id], open = cloneOpen(s.id), why = open ? cloneProblem(s.id) : `Needs ${CLONE_GENOME.min}% genome.`;
      h += `<li><span class="nm"><span class="dot" style="background:${PERIOD_COLOR[s.period]}"></span>${speciesName(s)}</span>`;
      h += open ? `<button class="buy" data-action="clone" data-sex="male" data-sp="${s.id}"${why ? ` disabled title="${esc(why)}"` : ""}>Clone M ${money(s.price)}</button><button class="buy" data-action="clone" data-sex="female" data-sp="${s.id}"${why ? ` disabled title="${esc(why)}"` : ""}>Clone F ${money(s.price)}</button>` : `<span class="meta">${d.genome}%</span>`;
      h += `<span class="need" style="grid-column:1/-1">${dnaBar(d)}${open ? `Clones are ${cloneQuality(s.id)}% DNA quality${cloneFailChance(s.id) > 0 ? `, ${Math.round(cloneFailChance(s.id) * 100)}% chance of failing` : ""}. Takes ${spanText(cloneMinutes(s.id))}.` : ""}</span></li>`;
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
  else if(!anyPlantDna()) h += `<div class="meta" style="color:var(--bad)">CERES needs plant DNA first. Research Mesozoic or Paleozoic flora at ORACLE, then send GHOST expeditions to a scouted site of that period to collect it. Until then, keepers feed prehistoric plant-eaters grass hay.</div>`;
  else {
    const st = c.stock, cap = ceresCap(), need = state.exhibits.reduce((s, e) => s + (dailyNeed(e).paleoflora || 0), 0);
    h += `<div class="factor" style="grid-template-columns:70px 1fr 74px"><span>In stock</span>${meter(st / cap * 100, FOOD_COLOR.paleoflora)}<span>${Math.floor(st)}/${Math.round(cap)}</span></div>`;
    h += `<dl class="kv" style="margin-top:6px"><dt>Grows</dt><dd>${ceresRate()} a day</dd><dt>Greenhouses</dt><dd>${greenhouses().length} (+${PALEOFLORA.greenhouse} a day each)</dd><dt>Your animals eat</dt><dd style="color:${need > ceresRate() ? "var(--bad)" : "inherit"}">${need} a day</dd></dl>`;
    if(need > ceresRate()) h += `<div class="meta" style="color:var(--bad)">CERES can't keep up. ${hasTech("greenhouse") ? "Build greenhouses." : "Research greenhouses at ORACLE."} When it runs dry, keepers bring grass hay instead.</div>`;
    const fg = CERES_GROW.food, fwhy = growProblem("food"), fq = growing("food");
    h += `<ul class="shop" style="margin-top:8px"><li><span class="nm">Extra Paleoflora food</span><button class="buy" data-action="grow" data-kind="food" data-era="food"${fwhy ? ` disabled title="${esc(fwhy)}"` : ""}>Grow ${money(fg.cost)}</button><span class="need">A batch takes ${spanText(growMinutes("food"))} and adds ${fg.amount} to the stock.${fq ? ` <b>${fq} growing.</b>` : ""}</span>`;
    h += `<span class="need" style="grid-column:1/-1"><button class="btn" data-action="autoGrow" data-era="food" aria-pressed="${!!c.auto.food}" style="padding:3px 9px">${c.auto.food ? "Keeping it stocked" : "Keep it stocked"}</button> <span class="meta">${c.auto.food ? "A free bed starts a batch whenever there's room for more." : "Starts batches by itself when there's room."}</span></span></li></ul>`;
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
  h += `<div class="meta">CERES holds up to ${medCap()} doses of each era's medicine.</div>`;
  h += MED_GOODS.map(t => `<div class="factor" style="grid-template-columns:110px 1fr 74px"><span>${goodName(t).replace(" medicine", "")}</span>${meter((cerMeds()[t] || 0) / medCap() * 100, GOOD_COLOR[t])}<span>${Math.floor(cerMeds()[t] || 0)}/${medCap()}</span></div>`).join("");
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
  if(a === "oera"){ oracleEra = b.dataset.k; ui.panel(); return; }
  if(a === "cperiod"){ cerePeriod = b.dataset.k; ui.panel(); return; }
  if(a === "gsite"){ if(b.dataset.site !== ghostSite) ghostPick = null; ghostSite = b.dataset.site; ghostRefresh(); return; }
  if(a === "gpick"){ ghostPick = b.dataset.sp; ghostRefresh(); return; }
  if(a === "gscout"){ if(sendDrone("scout", ghostSite)) done(); else ui.toast(scoutProblem(ghostSite) || "GHOST can't go there.", "bad"); return; }
  if(a === "gdig"){ const s = SITE_BY_ID[ghostSite], id = s && s.event ? s.event : ghostPick; if(sendDrone("dig", ghostSite, id)){ ghostPick = null; done(); } else ui.toast(expeditionProblem(ghostSite, id) || "Pick a target first.", "bad"); return; }
  if(a === "gdeep"){ const s = SITE_BY_ID[b.dataset.site]; if(s && sendDrone("dig", s.id, s.event)) done(); return; }
  if(a === "gbuy"){ const why = buyDrone(); if(why) ui.toast(why, "bad"); done(); return; }
  if(a === "greport"){ dismissReport(+b.dataset.id); done(); return; }
  if(a === "research"){ const why = startProject(b.dataset.kind, b.dataset.id); if(why) ui.toast(why, "bad"); done(); return; }
  if(a === "stopResearch"){ const p = state.science.projects[+b.dataset.i]; if(p) stopProject(p); done(); return; }
  if(a === "discardClone"){ if(discardClone(b.dataset.id)) done(); return; }
  if(a === "grow"){ if(growBatch(b.dataset.kind, b.dataset.era, b.dataset.size)) done(); else ui.toast(growProblem(b.dataset.kind, b.dataset.era, b.dataset.size) || "CERES can't grow that.", "bad"); return; }
  if(a === "autoGrow"){ state.ceres.auto[b.dataset.era] = !state.ceres.auto[b.dataset.era]; done(); return; }
});
