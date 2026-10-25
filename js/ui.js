/* =====================================================================
   SCREEN
   The top bar, the side panel, and pop-up messages.
   ===================================================================== */

const panelEl = $("#panel"), aside = $("#aside");
// The panel only shows while something is picked or the Park Office is open. The ✕, Esc and a pick on empty ground close it.
// menuPaused holds the speed the Main Menu paused, so closing the panel picks it back up.
let officeOpen = false, menuPaused = 0;
function closePanel(){
  officeOpen = false; select(null);
  if(menuPaused && !speed) setSpeed(menuPaused);
  menuPaused = 0;
}
// Placeholder weather icons for the HUD until the pixel ones are drawn
const WX_ICON = {
  fair:'<circle cx="12" cy="12" r="5" fill="#F4CE3C"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" stroke="#F4CE3C" stroke-width="2" stroke-linecap="round"/>',
  hot:'<circle cx="12" cy="12" r="6" fill="#F08A3C"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3M4 4l2 2M18 18l2 2M4 20l2-2M18 6l2-2" stroke="#F08A3C" stroke-width="2" stroke-linecap="round"/>',
  cold:'<path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7" stroke="#A9D8F5" stroke-width="2" stroke-linecap="round"/>',
  storm:'<path d="M6 15a4 4 0 0 1 1-8 5 5 0 0 1 9.5 1.5A3.5 3.5 0 0 1 17 15z" fill="#B9C2C8"/><path d="M12 14l-2 4h3l-2 4" fill="none" stroke="#F4CE3C" stroke-width="1.8" stroke-linejoin="round"/>',
};

const ui = {
  hudCache: {},

  // Update the numbers in the top bar. Cheap enough to call every frame.
  hud(force){
    const set = (id, v) => { if(force || this.hudCache[id] !== v){ this.hudCache[id] = v; $("#" + id).textContent = v; } };
    set("money", money(state.money));
    $("#roMoney").classList.toggle("neg", state.money < 0);
    set("inpark", guestCount().toLocaleString());
    const gt = `${guestCount().toLocaleString()} in the park now, ${state.today.guests.toLocaleString()} came today.`;
    if(force || this.hudCache.gt !== gt){ this.hudCache.gt = gt; $("#roGuests").title = gt; }
    set("clock", fmtClock(clockMin()));
    $("#closedTag").hidden = !state.parkClosed;
    const dk = nightDark(); if(force || this.hudCache.dark !== dk){ this.hudCache.dark = dk; $("#nightWash").style.opacity = dk; drawLights(); }
    set("dayLabel", fmtDate(state.day));
    set("wxLabel", weatherNow().label);
    const wk = state.weather ? state.weather.today : "fair";
    if(force || this.hudCache.wx !== wk){ this.hudCache.wx = wk; $("#wxIcon").dataset.kind = wk; $("#wxIcon").innerHTML = `<svg viewBox="0 0 24 24">${WX_ICON[wk] || WX_ICON.fair}</svg>`; }
    const fc = `Today: ${weatherNow().label}. Tomorrow: ${weatherNext().label}.`;
    if(force || this.hudCache.forecast !== fc){ this.hudCache.forecast = fc; $("#roWeather").title = fc; }
    $("#dayFill").style.width = (state.minute / DAY_MIN * 100).toFixed(1) + "%";
    const r = Math.round(state.rating * 2) / 2;
    if(force || this.hudCache.rating !== r){ this.hudCache.rating = r; $("#rating").innerHTML = starsSvg(state.rating, 28); $("#rating").setAttribute("aria-label", `${r} stars`); }
  },

  panel(){
    if(document.querySelector(".app.focus")) return;
    const it = selItem();
    if(sel && !it) sel = null;
    const open = !!sel || officeOpen;
    aside.classList.toggle("open", open);
    document.querySelectorAll("#rtools [data-dept]").forEach(b => b.setAttribute("aria-pressed", !!(sel && sel.kind === "building" && it && it.type === b.dataset.dept)));
    $("#officeBtn").setAttribute("aria-pressed", !sel && officeOpen);
    if(!open) return;
    let h;
    if(!sel) h = overviewHtml();
    else if(sel.kind === "exhibit") h = exhibitHtml(it);
    else if(sel.kind === "building") h = buildingHtml(it);
    else if(sel.kind === "zone") h = zoneHtml(it);
    else if(sel.kind === "fence") h = fenceLineHtml(it);
    else if(sel.kind === "guest") h = guestHtml(it);
    else if(sel.kind === "staff") h = staffHtml(it);
    else if(sel.kind === "animal") h = animalHtml(it);
    else if(sel.kind === "crate") h = crateHtml(it);
    else h = pathHtml(it);
    // keep the scroll spot and the typing cursor when the panel redraws
    const sc = panelEl.scrollTop, focusId = document.activeElement && panelEl.contains(document.activeElement) ? document.activeElement.id : null;
    panelEl.innerHTML = h;
    panelEl.scrollTop = sc;
    if(focusId){ const f = document.getElementById(focusId); if(f) f.focus(); }
    if(sel && sel.kind === "guest") guestLive(true);
    if(sel && sel.kind === "staff") staffLive(true);
    if(sel && sel.kind === "animal") animalLive(true);
    { const nm = $("#sheetName"), rename = !!it && (sel.kind === "exhibit" || sel.kind === "zone");   // an exhibit or zone is renamed right in the top bar
      $("#sheetToggle").hidden = rename; nm.hidden = !rename; if(rename && document.activeElement !== nm) nm.value = it.name; }
    $("#sheetToggle").textContent = it ? (it.name || BUILDINGS[it.type]?.label || (sel.kind === "fence" ? (BARRIERS[it.barrier] || BARRIERS.wood).label : "Path")) : officeTab === "menu" ? "Main menu" : "Park office";
  },

  toast(text, kind, html){
    const el = document.createElement("div");
    el.className = "toast " + (kind || "");
    if(html) el.innerHTML = html; else el.textContent = text;
    const box = $("#toasts");
    // a modal dialog sits above the page, so show toasts inside it while one is open
    const dlg = document.querySelector("dialog:modal"), home = ui.toastHome || (ui.toastHome = box.parentNode);
    (dlg || home).appendChild(box);
    box.appendChild(el);
    while(box.children.length > 4) box.firstChild.remove();
    setTimeout(() => el.remove(), kind === "day" ? 9000 : 6000);
  }
};

function starsSvg(rating, size){
  let s = `<span class="stars">`;
  for(let i = 0; i < 5; i++){
    const f = clamp(rating - i, 0, 1), id = "st" + Math.random().toString(36).slice(2, 7);
    s += `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="${id}"><stop offset="${f}" stop-color="var(--money)"/><stop offset="${f}" stop-color="rgba(243,239,217,.22)"/></linearGradient></defs><path d="M12 2l3 6.5 7 .8-5.2 4.8 1.5 7L12 17.6 5.7 21.1l1.5-7L2 9.3l7-.8z" fill="url(#${id})"/></svg>`;
  }
  return s + `</span>`;
}

function meter(v, color){ return `<div class="meter"><i style="width:${clamp(v,0,100).toFixed(0)}%;background:${color}"></i></div>`; }

/* ---------- nothing selected: the park office ---------- */
let officeTab = "office";   // which tab the park office shows
function grantsHtml(goal){
  const n = state.goalsDone.length;
  let h = goal
    ? `<div class="card goal"><div class="step">Grant ${activeGoals().indexOf(goal) + 1} of ${activeGoals().length}</div><b>${esc(goal.text)}</b><div class="reward">Grant ${grantPrize(goal)}</div></div>`
    : `<div class="card goal"><div class="step">All grants awarded</div></div>`;
  h += `<section><h3>Grants <span class="num">${activeGoals().filter(g => state.goalsDone.includes(g.id)).length} of ${activeGoals().length}</span></h3><ul class="checklist">${activeGoals().map(g => { const done = state.goalsDone.includes(g.id), now = goal && g.id === goal.id; return `<li><span>${done ? "✓" : now ? "›" : ""}</span><span class="${done ? "done" : now ? "now" : ""}">${esc(g.text)}</span><span class="r">${esc(grantPrize(g))}</span></li>`; }).join("")}</ul></section>`;
  return h;
}
// A crate's panel: who is inside, and Move (carry it), Open (into the exhibit it stands in, when it fits) and Sell
function crateHtml(c){
  const s = SPECIES_BY_ID[c.sp], e = state.exhibits.find(x => inPoly(c.x, c.y, x.points)), fits = !!e && !crateProblem(c, e);
  let h = `<div class="meta">${esc(s.name)} · ${esc(s.period)}${c.cl ? " · clone" : ""} · ${c.q ?? 90}% DNA${c.sex ? ` · <b title="${esc(c.sex)}">${esc(sexMark(c))}</b> ${esc(c.sex)}` : ""}</div>`;
  h += `<div class="row" style="margin-top:6px"><span class="status ok">In a crate.</span><button class="btn sell" data-action="crateTool" data-id="${esc(c.id)}">Move</button>${fits ? `<button class="btn sell" data-action="crateOpen" data-id="${esc(c.id)}">Open in ${esc(e.name)}</button>` : ""}<button class="btn sell" data-action="crateSell" data-id="${esc(c.id)}">Sell +${money(Math.round(s.price * COST.animalResale))}</button></div>`;
  return h;
}
function officeTabs(){
  return tabBar("otab2", [{key:"office", label:"Park", color:"#4B3A8C"}, {key:"money", label:"Finances", color:"#B8860B"}, {key:"science", label:"Science", color:"#1F6F73"}, {key:"guests", label:"Guests", color:"#C2563A"}, {key:"staff", label:"Staff", color:"#2E6B3A"}, {key:"grants", label:"Grants", color:"#8C6A2E"}], officeTab);
}
const GAME_VERSION = "v0.9";   // shown at the foot of the Main Menu; five quick taps on it flip dev mode (main.js)
function mainMenuHtml(){
  return `<h2>Main Menu</h2>
    <p class="meta" style="margin-bottom:10px">Park biome: ${esc(BIOMES[parkBiome()].label)}</p>
    <label class="field" style="margin:10px 0"><span><input type="checkbox" id="sandboxToggle"${state.sandbox ? " checked" : ""}> Sandbox mode</span></label>
    <p id="saveInfo" class="meta">${esc(saveMsg || "Saved in this browser.")}</p>
    <div class="row"><button class="btn" data-action="howTo">How to play</button><button class="btn danger" data-action="restart">Restart</button></div>
    <small id="verLabel" class="verlabel" title="Version">${GAME_VERSION}</small>`;
}
function overviewHtml(){
  const d = derived, t = state.today, goal = currentGoal();
  if(officeTab === "menu") return mainMenuHtml();
  let h = `<h2 id="officeTitle">${esc(state.name)}</h2>`;
  h += officeTabs();
  if(officeTab === "staff") return h + staffTabHtml();
  if(officeTab === "grants") return h + grantsHtml(goal);

  if(officeTab === "money"){
  const c = dailyCosts();
  h += `<section><h3>Today so far</h3><dl class="kv">
    <dt>Guests</dt><dd>${t.guests.toLocaleString()}</dd>
    <dt>Tickets</dt><dd>${money(t.tickets)}</dd>
    <dt>Food and gifts</dt><dd>${money(t.food + t.shop)}</dd>
    <dt>Built and bought</dt><dd>${t.built + t.animals ? "−" + money(t.built + t.animals) : money(0)}</dd>
    ${t.science ? `<dt>Research and expeditions</dt><dd>−${money(t.science)}</dd>` : ""}
    ${t.supplies ? `<dt>Food and gift stock</dt><dd>−${money(t.supplies)}</dd>` : ""}
    <dt class="sum">Bills at ${fmtClock(ROLLOVER_CLOCK)}</dt><dd class="sum">−${money(c.feed + c.wages + c.upkeep + c.research + cleaningBill())}</dd>
  </dl><div class="meta" style="margin-top:4px">Animal food ${money(c.feed)}, staff ${money(c.wages)}, upkeep ${money(c.upkeep)}${c.research ? `, research ${money(c.research)}` : ""}${cleaningBill() ? `, night cleaning ${money(cleaningBill())} so far` : ""}.</div></section>`;

  h += logiOverviewHtml();
  const expected = Math.round(d.demand);
  h += `<section><h3>Ticket price</h3><div class="ticket"><button data-action="ticket" data-d="-1" aria-label="Lower the price">−</button><output id="ticketOut">${money(state.ticket)}</output><button data-action="ticket" data-d="1" aria-label="Raise the price">+</button></div>
    <dl class="kv" style="margin-top:6px"><dt>Fair price</dt><dd>${money(Math.round(d.fair))}</dd><dt>Guests a day</dt><dd>${expected.toLocaleString()}</dd></dl></section>`;

    return h;
  }
  if(officeTab === "science"){
  // science at a glance
  const sc = state.science;
  if(["oracle", "ghost", "tar", "ceres"].some(hasDept)){
    const line = (type, text) => { const b = state.buildings.find(x => x.type === type); return b ? `<li><button class="btn" data-action="gotoDept" data-t="${type}" style="padding:3px 9px">${BUILDINGS[type].label}</button><span>${text}</span></li>` : ""; };
    const next = list => list.length ? Math.min(...list.map(j => j.end)) : 0;
    h += `<section><h3>Science</h3><ul class="deptlist">
      ${line("oracle", sc.projects.length ? `${sc.projects.length} project${sc.projects.length === 1 ? "" : "s"} running. Next done in ${leftText(next(sc.projects))}. ${Math.floor(sc.points)} points.` : `${Math.floor(sc.points)} research points. ${sc.unlocked.length} animal${sc.unlocked.length === 1 ? "" : "s"} discovered.`)}
      ${line("ghost", sc.trips.length ? `${sc.trips.length} of ${sc.drones} drone${sc.drones === 1 ? "" : "s"} out. Next back in ${leftText(next(sc.trips))}.${sc.reports.length ? ` ${sc.reports.length} report${sc.reports.length === 1 ? "" : "s"} to read.` : ""}` : `${sc.drones} drone${sc.drones === 1 ? "" : "s"} home and ready.${sc.reports.length ? ` ${sc.reports.length} report${sc.reports.length === 1 ? "" : "s"} to read.` : ""}`)}
      ${line("tar", sc.clones.some(c => c.failed) ? `${sc.clones.filter(c => c.failed).length} failed clone${sc.clones.filter(c => c.failed).length === 1 ? "" : "s"} to discard.` : sc.clones.length ? `${sc.clones.length} clone${sc.clones.length === 1 ? "" : "s"} growing. Next ready in ${leftText(next(sc.clones))}.` : specimens().length ? `${specimens().length} specimen${specimens().length === 1 ? "" : "s"} waiting for delivery.` : "Incubators empty.")}
      ${line("ceres", state.ceres.beds.length ? `${state.ceres.beds.length} batch${state.ceres.beds.length === 1 ? "" : "es"} growing. Next ready in ${leftText(next(state.ceres.beds))}.` : "Beds empty.")}
    </ul></section>`;
  }

    if(!["oracle", "ghost", "tar", "ceres"].some(hasDept)) h += `<section><h3>Science</h3><div class="meta">No science buildings.</div></section>`;
    return h;
  }
  if(officeTab === "guests"){
  h += guestsOverviewHtml();
    return h;
  }

  h += `<section><h3>Gate</h3><div class="row"><button class="btn${state.parkClosed ? " primary" : ""}" data-action="toggleClosed">${state.parkClosed ? "Open the park" : "Close park"}</button></div></section>`;
  h += `<section><h3>Park name</h3><label class="field"><span>Name</span><input id="officeName" maxlength="40" value="${esc(state.name)}"></label></section>`;
  h += `<section><h3>Rating ${starsSvg(state.rating, 15)} <span class="num">${starTxt(state.rating)}</span></h3>`;
  if(!d.parts.length) h += `<div class="meta">No animals.</div>`;
  for(const p of d.parts){
    const pct = p.score * 100, col = pct >= 95 ? "var(--good)" : pct >= 60 ? "var(--gold)" : "var(--warn)";
    h += `<div class="factor"><span>${p.label}</span>${meter(pct, col)}<span>${(p.score * p.max).toFixed(2)}/${p.max}</span></div>`;
  }
  if(d.pricey) h += `<div class="meta" style="color:var(--bad)">Tickets too expensive: −0.3★</div>`;
  const dir = d.ratingTarget - state.rating;
  h += `<div class="meta" style="margin-top:8px">${Math.abs(dir) < .1 ? "Steady" : `${dir > 0 ? "Rising" : "Falling"} toward ${d.ratingTarget.toFixed(1)}★`}</div></section>`;

  if(state.history.length){
    const rows = state.history.slice(-7).reverse();
    h += `<section><h3>Recent days</h3><table class="hist"><thead><tr><th>Date</th><th>Guests</th><th>Earned</th><th>Profit</th></tr></thead><tbody>${rows.map(r => `<tr><td>${fmtDate(r.day)}</td><td>${r.guests.toLocaleString()}</td><td>${money(r.income)}</td><td class="${r.net >= 0 ? "pos" : "neg"}">${r.net >= 0 ? "+" : ""}${money(r.net)}</td></tr>`).join("")}</tbody></table></section>`;
  }

  h += `<div class="row" style="margin-top:12px"><button class="btn" data-action="otab2" data-k="menu">Main Menu</button></div>`;
  h += themesOverview();
  return h;
}

/* ---------- themes ---------- */
function themeOptions(kind, it){
  const cur = it ? themeKey(it) : state.themes.brush;
  return Object.entries(THEMES).map(([k, T]) => {
    const locked = !themeHave(k), fee = it && k !== cur ? themeFee(kind, it, k) : 0;
    return `<option value="${k}"${k === cur ? " selected" : ""}${locked ? " disabled" : ""}>${T.label}${locked ? ` (${T.unlock.hint})` : k === cur ? " (current)" : it ? (fee ? `, ${money(fee)}` : ", free") : T.fee ? `, +${Math.round(T.fee * 100)}% to build` : ""}</option>`;
  }).join("");
}
function themeHtml(kind, it){
  if(!devMode()) return "";
  const T = themeOf(it);
  let h = `<section><h3>Theme</h3><label class="field"><span>Style</span><select id="themeSel">${themeOptions(kind, it)}</select></label>`;
  if(kind !== "exhibit") h += `<div class="meta" style="margin-top:4px">${esc(T.blurb)} Changing it has no refund.</div>`;
  const z = false;
  if(z){
    h += `<div class="meta" style="margin-top:4px">${z.key === "genesis" ? "Pick a theme and match the paths, shops and restrooms beside this exhibit for an appeal bonus."
      : z.ok ? `Matched area: all ${z.total} paths and buildings nearby are ${esc(T.label)}. Guests find this exhibit ${Math.round(THEME.appeal * 100)}% more appealing.`
      : z.total < THEME.minNear ? `Needs at least ${THEME.minNear} paths or buildings within ${THEME.radius} m to count as a themed area (${z.total} now).`
      : `Mixed area: ${z.same} of ${z.total} paths and buildings within ${THEME.radius} m are ${esc(T.label)}. Match them all for an appeal bonus.`}</div>`;
    if(T.fits.length) h += `<div class="meta" style="margin-top:4px">Suits ${T.fits.map(id => esc(SPECIES_BY_ID[id].name)).join(", ")}.</div>`;
  }
  return h + `</section>`;
}
function themesOverview(){
  if(!devMode()) return "";
  let h = `<section><h3>Themes</h3><label class="field"><span>Build new things as</span><select id="brushSel">${themeOptions("", null)}</select></label>`;
  h += `<ul class="issues" style="margin-top:6px">${Object.entries(THEMES).map(([k, T]) => `<li class="${themeHave(k) ? "" : "bad"}">${esc(T.label)}: ${themeHave(k) ? "unlocked." : esc(T.unlock.hint)}${T.fits.length ? ` Suits ${T.fits.map(id => esc(SPECIES_BY_ID[id].name)).join(", ")}.` : ""}</li>`).join("")}</ul>`;
  return h + `<div class="meta" style="margin-top:4px">Match an exhibit with the paths, shops and restrooms near it for an appeal bonus. Animals that suit a theme are happier. Tap any path, building or exhibit to change its theme.</div></section>`;
}
panelEl.addEventListener("change", ev => {
  if(ev.target.id === "brushSel"){ if(themeHave(ev.target.value)){ state.themes.brush = ev.target.value; saveSoon(); } ui.panel(); return; }
  if(ev.target.id !== "themeSel") return;
  const it = selItem(), key = ev.target.value; if(!it) return;
  const kind = sel.kind, why = themeProblem(kind, it, key);
  if(why){ ui.toast(why, "bad"); ui.panel(); return; }
  const fee = themeFee(kind, it, key);
  spend(fee, "built"); if(key === "genesis") delete it.theme; else it.theme = key;
  ui.toast(`Now ${THEMES[key].label}${fee ? ` (${money(fee)})` : ""}.`, "good");
  afterChange(); render();
});

/* ---------- an exhibit ---------- */
const exTabs = {ex:null, tab:"main", period:null};   // which tab the exhibit panel shows
// The exhibit panel's tabs, in order. A vivarium has no fence, and its Landscaping and Habitat Items are its scene and fittings.
const exTabList = e => [{key:"main", label:"Overview", color:"#4E7F2E"}].concat(e.viv ? [] : [{key:"barrier", label:"Barrier", color:"#6E737A"}],
  [{key:"land", label:lagoonWalled(e) ? "Aquascape" : "Landscaping", color:"#7A6A58"}, {key:"props", label:"Habitat Items", color:"#8C6A2E"}, {key:"animals", label:"Animals", color:"#4E7F2E"},
   {key:"health", label:"Health", color:"#B3261E"}, {key:"clone", label:"Cloning", color:"#1F6F73"}, {key:"behave", label:"Behavior", color:"#6A4C93"}, {key:"guests", label:"Guests", color:"#B8860B"}]);
function exhibitHtml(e){
  const rep = derived.reports[e.id] || exhibitReport(e), reach = isReachable(e), n = e.animals.length;
  if(exTabs.ex !== e.id){ exTabs.ex = e.id; exTabs.tab = "main"; }
  const tabs = exTabList(e);
  if(!tabs.some(t => t.key === exTabs.tab)) exTabs.tab = "main";
  // the header shows on every tab: name, and the few things worth seeing at a glance
  let h = ``;
  h += `<div class="row exhead"><span class="status ${reach ? "ok" : "no"}">${reach ? "Guests can see it" : "No path reaches it"}</span>`;
  if(n) h += `<span class="status ${e.happy >= 60 ? "ok" : e.happy >= 35 ? "" : "no"}">${Math.round(e.happy)}% happy</span>`;
  h += `<span class="meta">${n ? `${n} animal${n === 1 ? "" : "s"}, ` : ""}${e.viv ? caseOf(e).label + ", " : ""}${fmtArea(rep.area)}</span></div>`;
  h += `<div class="extabs">${tabBar("extab", tabs, exTabs.tab)}</div>`;
  const body = {main:exOverviewHtml, barrier:exBarrierHtml, land:x => lagoonWalled(x) ? aquascapeHtml(x) : x.aqua ? aquaSceneHtml(x) : x.viv ? vivSceneHtml(x) : landHtml(x), props:x => x.viv ? vivToysHtml(x) : propsHtml(x),
    animals:animalsTabHtml, health:exHealthHtml, clone:x => cloneHtml(x, rep), behave:behaviorHtml, guests:exGuestsHtml}[exTabs.tab](e, rep);
  h += body;
  return h + `<div class="row"><button class="btn" data-action="center">Center on map</button>${exTabs.tab === "main" ? `<button class="btn danger" data-action="demolish">Bulldoze exhibit</button>` : ""}</div>`;
}
// A link in the Overview that opens another tab
const exJump = (k, label, level, text) => `<li class="${level}"><button class="exjump" data-action="extab" data-k="${k}"><b>${label}</b><span>${text}</span><span class="meta">›</span></button></li>`;
function exOverviewHtml(e, rep){
  const n = e.animals.length;
  let h = "";
  if(n){
    const trend = rep.target - e.happy;
    h += `<section><h3>Happiness</h3><div class="factor" style="grid-template-columns:1fr 48px"><span>${meter(e.happy, happyColor(e.happy))}</span><span>${Math.round(e.happy)}%</span></div>
      <div class="meta" style="margin-top:4px">${Math.abs(trend) < 2 ? "Steady" : `${trend > 0 ? "Rising" : "Falling"} toward ${Math.round(rep.target)}%`}</div>`;
    if(rep.issues.length) h += `<ul class="issues" style="margin-top:8px">${rep.issues.map(i => `<li class="${i.bad ? "bad" : ""}">${esc(i.text)}</li>`).join("")}</ul>`;
    h += `</section>`;
    h += `<section><h3>Animals here</h3><ul class="herd">${[...rep.counts].map(([sp, c]) => { const s = SPECIES_BY_ID[sp]; return `<li><span class="dot" style="background:${PERIOD_COLOR[s.period]}"></span><span>${esc(s.name)} × ${c}${sexSplit(e, sp)}</span></li>`; }).join("")}</ul>
      <div style="margin-top:6px;font-size:14px;color:var(--ink)">${rep.need || !rep.wetNeed ? `Room used: ${fmtArea(rep.need)} of ${fmtArea(rep.area)}.` : ""}${rep.wetNeed ? `${rep.need ? " " : ""}Water used: ${fmtArea(rep.wetNeed)} of ${fmtArea(rep.wet)}.` : ""}</div></section>`;
  } else {
    h += `<section><h3>Empty</h3><div class="meta">${e.viv ? `Fits ${SPECIES.filter(s => fitsHabitat(s, e)).map(s => esc(s.name)).join(", ")}.` : "No animals."}</div>
      <div class="row" style="margin-top:6px"><button class="btn" data-action="extab" data-k="clone">Add animals</button></div></section>`;
  }

  // one line per other tab that needs a look
  const rows = [];
  if(!e.viv){
    const kc = knownCond(e), since = daysSinceInspect(e), broke = e.open || isBreached(e);
    rows.push(exJump("barrier", "Barrier", broke || kc < 30 ? "bad" : kc < 60 || since >= MAINT.inspectEvery ? "warn" : "", esc(e.open ? "Gap in the fence." : broke ? "Broken." : `${Math.round(kc)}% condition${since >= 99 ? ", never inspected" : ""}.`)));
  }
  if(wetCase(e) && aquaLoad(e) > 0){
    const w = wqOf(e), why = filterText(e);
    rows.push(exJump("props", "Water", w < AQUA.foul ? "bad" : w < AQUA.murky || why ? "warn" : "", esc(`${Math.round(w)}% clean${why ? ". " + why : ""}`)));
  }
  if(n){
    const hr = healthReport(e), worst = hr.sick.length ? Math.max(...hr.sick.map(a => a.sick.sev)) : 0, dirt = e.dirt || 0;
    rows.push(exJump("health", "Health", worst >= 40 || dirt >= 60 ? "bad" : hr.sick.length || dirt >= CLEAN.dirtyAt ? "warn" : "", esc(`${hr.sick.length ? `${hr.sick.length} sick or injured` : "Healthy"}${e.aqua ? "" : `, ${Math.round(100 - dirt)}% ${lagoonWalled(e) ? "water quality" : "clean"}`}`)));
    const X = exLog(e);
    rows.push(exJump("guests", "Guests", isReachable(e) ? "" : "bad", esc(isReachable(e) ? `${Math.round(X.views)} visitor${Math.round(X.views) === 1 ? "" : "s"} today, ${money(Math.round(X.gifts))} donated` : "No path")));
  }
  if(rows.length) h += `<section><h3>At a glance</h3><ul class="issues exglance">${rows.join("")}</ul></section>`;

  // food and keeper access
  const g = gateCheck(e), need = dailyNeed(e);
  h += `<section><h3>Keepers and food</h3><div class="row"><span class="status ${g.ok ? "ok" : "no"}">${g.ok ? "Keepers can get in" : esc(g.text)}</span></div>${dishText(e) ? `<div class="row" style="margin-top:4px"><span class="status no">${esc(dishText(e))}</span></div>` : ""}`;
  if(!e.viv) h += `<div class="row" style="margin-top:6px"><button class="btn" data-action="gateTool">${e.gate ? "Move the gate" : "Place a gate"}</button></div>`;
  h += zoneRow("exhibit", e);
  h += callRow(e, aquaEx(e) ? "aqua" : "keeper");
  if(n){
    h += `<div style="margin-top:8px">${Object.keys(need).map(t => { const st = stockFor(e, t), mx = e.viv ? Math.round(trayFood(e, t) + trayShare(e, t)) : storeMax(e, t), hay = t === "paleoflora" && ((e.stock || {}).paleoflora || 0) < st - .01; return `<div class="factor" style="grid-template-columns:70px 1fr 74px"><span style="text-transform:capitalize" title="${hay ? "Partly grass hay standing in for Paleoflora" : ""}">${t}${hay ? "*" : ""}</span>${meter(st / Math.max(1, mx) * 100, FOOD_COLOR[t])}<span>${Math.round(st)}/${mx}</span></div>`; }).join("")}</div>`;
    h += `<div class="meta" style="margin-top:4px">${Object.entries(need).map(([t, u]) => `${u} ${t}`).join(", ")} a day</div>`;
  }
  return h + `</section>`;
}
// Call a keeper, vet or mechanic to this exhibit, or cancel the call
function callRow(e, kind){
  const K = CALLS[kind], why = callProblem(e, kind), called = state.staff.calls.find(x => x.ex === e.id && callKind(x) === kind), w = called && called.keeper && K.staff().find(x => x.id === called.keeper);
  return `<div class="row" style="margin-top:6px">${called ? `<span class="status ok">${w ? esc(w.name) + " is on the way" : "Waiting for a free " + K.word}</span><button class="btn" data-action="cancelCall" data-kind="${kind}">Cancel</button>` : `<button class="btn" data-action="callKeeper" data-kind="${kind}"${why ? ` disabled title="${esc(why)}"` : ""}>Call ${K.word}</button>${why ? `<span class="meta">${esc(why)}</span>` : ""}`}</div>`;
}
// Barrier tab: the fence's state, the mechanic, and moats and netting
function exBarrierHtml(e){
  const kc = knownCond(e), since = daysSinceInspect(e);
  let h = `<section><h3>Fence</h3><div class="factor" style="grid-template-columns:80px 1fr 44px"><span>Condition</span>${meter(kc, kc >= 60 ? "var(--good)" : kc >= 30 ? "var(--warn)" : "var(--bad)")}<span>${Math.round(kc)}%</span></div>`;
  const notes = [];
  if(e.open) notes.push(["bad", "Gap in the fence."]);
  else if(isBreached(e)) notes.push(["bad", "Broken."]);
  notes.push(since >= 99 ? ["bad", "Never inspected."] : [since >= MAINT.inspectEvery * 2 ? "bad" : since >= MAINT.inspectEvery ? "warn" : "good", since === 0 ? "Inspected today." : `Last inspected ${since} day${since === 1 ? "" : "s"} ago.`]);
  h += `<ul class="issues" style="margin-top:6px">${notes.map(([k, t]) => `<li class="${k}" style="color:var(--${k === "bad" ? "bad" : k === "warn" ? "warn" : "good"})">${esc(t)}</li>`).join("")}</ul>`;
  h += callRow(e, "mech") + `</section>`;
  const sec = (name, st, body) => `<div class="sec-item ${st}"><span class="sec-name">${name}</span><span class="sec-act">${body}</span></div>`, lock = `<span class="status">Locked</span>`;
  h += `<section><h3>Extra security</h3><div class="sec-list">`;
  h += sec("Moat", e.moat ? "on" : hasTech("moat") ? "" : "locked", e.moat ? `<span class="status ok">Dug</span>` : hasTech("moat") ? `<button class="btn" data-action="moat"${canAfford(moatCost(e)) ? "" : " disabled"}>Dig a moat, ${money(moatCost(e))}</button>` : lock);
  h += sec("Aviary netting", e.aviary ? "on" : hasTech("aviary") ? "" : "locked", e.aviary ? `<button class="btn" data-action="aviaryOff">Remove aviary netting</button>` : hasTech("aviary") ? `<button class="btn" data-action="aviary"${canAfford(aviaryCost(e)) ? "" : " disabled"}>Add aviary netting, ${money(aviaryCost(e))}</button>` : lock);
  h += sec("Catch netting", e.net ? "on" : hasTech("catchnet") ? "" : "locked", e.net ? `<button class="btn" data-action="netOff">Remove catch netting</button>` : hasTech("catchnet") ? `<button class="btn" data-action="net"${canAfford(netCost(e)) ? "" : " disabled"}>Add catch netting, ${money(netCost(e))}</button>` : lock);
  return h + `</div></section>`;
}
// Health tab: sanitation, the animals' health, and the vet
function exHealthHtml(e){
  const h = dirtHtml(e) + healthHtml(e);
  return (h || `<section><h3>Health</h3><div class="meta">No animals.</div></section>`) + `<section><h3>Vet</h3>${callRow(e, "vet")}</section>`;
}
// 1st, 2nd, 3rd, 4th...
const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th");
// Guests tab: how much guests want to see it, how many came, what they gave and what they thought
function exGuestsHtml(e){
  const X = exLog(e), a = exhibitAppeal(e), ranked = state.exhibits.filter(x => x.animals.length).map(x => [x, exhibitAppeal(x)]).sort((p, q) => q[1] - p[1]);
  const rank = ranked.findIndex(([x]) => x === e) + 1, view = Math.round(viewFactor(e, derived.reach) * 100);
  let h = `<section><h3>Guest appeal</h3>`;
  h += e.animals.length ? `<div class="meta">Draw rank: ${ordinal(rank)} of ${ranked.length}</div>` : "";
  if(!e.viv) h += `<div class="factor" style="grid-template-columns:80px 1fr 48px;margin-top:8px"><span>View</span>${meter(Math.min(100, view), view >= 100 ? "var(--good)" : view >= 60 ? "var(--warn)" : "var(--bad)")}<span>${view}%</span></div>`;
  const plats = e.viv ? 0 : state.buildings.filter(b => b.type === "platform" && b.exhibitId === e.id).length;
  if(!e.viv && (plats || hasTech("platform"))) h += `<div class="row" style="margin-top:6px"><span class="meta">Viewing platforms: ${plats}</span>${hasTech("platform") ? `<button class="btn" data-action="platformTool">Add a viewing platform</button>` : ""}</div>`;
  const gals = state.buildings.filter(b => b.type === "gallery" && b.exhibitId === e.id).length;
  if(isPool(e) && (gals || !buildingHidden("gallery"))) h += `<div class="row" style="margin-top:6px"><span class="meta">Viewing galleries: ${gals}</span>${buildingHidden("gallery") ? "" : `<button class="btn" data-action="galleryTool">Add a viewing gallery</button>`}</div>`;
  h += `<ul class="issues" style="margin-top:8px"><li class="${hasSign(e) ? "" : "warn"}">${hasSign(e) ? "Info sign" : "No info sign"}</li></ul></section>`;
  const day = (v, w) => `<div class="factor exday"><span>${v}</span>${w}</div>`;
  h += `<section><h3>Visitors</h3>${day("", `<span class="meta">Today</span><span class="meta">Yesterday</span>`)}`;
  h += day("Stopped to watch", `<span>${Math.round(X.views)}</span><span>${Math.round(X.last.views)}</span>`);
  h += day("Donations", `<span>${money(Math.round(X.gifts))}</span><span>${money(Math.round(X.last.gifts))}</span>`);
  h += `</section>`;
  const th = exThoughts(e, 8);
  h += `<section><h3>Guest thoughts</h3>`;
  h += th.length ? `<ul class="issues">${th.map(t => `<li class="${t.good ? "" : "bad"}"><span>"${esc(t.text)}" <span class="meta">${Math.max(1, Math.round(t.share * 100))}%</span></span></li>`).join("")}</ul>`
    : `<div class="meta">None yet.</div>`;
  return h + `</section>`;
}

// Cloning tab: species with a complete genome, by period
function cloneHtml(e, rep){
  const sc = state.science;
  let h = "";
  const ready = SPECIES.filter(s => speciesAvailable(s.id) && cloneOpen(s.id) && fitsHabitat(s, e));
  const forSale = SPECIES.filter(s => speciesAvailable(s.id) && isStarter(s) && fitsHabitat(s, e));
  const coming = sc.clones.filter(c => c.exhibitId === e.id);
  h += `<section><h3>Add animals</h3>`;
  if(coming.length) h += `<div style="margin-bottom:8px">${coming.map(c => cloneCard(c)).join("")}</div>`;
  if(!ready.length && !forSale.length){
    h += `<div class="meta">Nothing available that fits here.</div>`;
  } else {
    const has = id => ready.some(s => s.period === id) || forSale.some(s => s.period === id);
    if(!has(exTabs.period)) exTabs.period = PERIOD_ORDER.find(has);
    h += tabBar("expd", PERIOD_ORDER.map(id => ({key:id, label:id, color:PERIOD_COLOR[id], lock:!has(id)})), exTabs.period);
    h += `<ul class="shop" style="margin-top:8px">${ready.filter(s => s.period === exTabs.period).map(s => animalCard(s, rep, "clone")).join("")}${forSale.filter(s => s.period === exTabs.period).map(s => animalCard(s, rep, "buy")).join("")}</ul>`;
  }
  h += `</section>`;
  return h;
}

// An open exhibit's biome (painted ground) and how each animal feels about it; a vivarium's biome is its scene's (vivSceneHtml)
function biomeHtml(e){
  const b = biomeOf(e), kinds = [...new Set(e.animals.map(a => a.sp))].map(sp => SPECIES_BY_ID[sp]).filter(biomesOf);
  const fits = () => kinds.map(s => { const n = esc(s.name);
    return biomeFit(s, b) === "home" ? `<div class="need-line ok">${n}: right biome.</div>` : `<div class="need-line no">${n}: wants ${esc(biomeNames(s))}.</div>`; }).join("");
  // open exhibits are painted with the Paint Ground tool; the biome with the most ground wins
  const sh = paintShare(e), parts = Object.entries(sh.counts).sort((x, y) => y[1] - x[1]).map(([k, n]) => `${esc(BIOMES[k].label)} ${Math.round(n / sh.n * 100)}%`).join(", ");
  return `<section><h3>Biome</h3><div class="need-line ok"><b>${esc(BIOMES[b].label)}</b>: ${esc(BIOMES[b].ground)}${parts && Object.keys(sh.counts).length > 1 ? ` (${parts})` : ""}.</div><button class="btn" data-action="paintTool" style="padding:3px 9px">Paint ground</button>${fits()}</section>`;
}
// A vivarium's scene: an era and a biome painted on the back wall and floor, set from two selects for a flat price, and how well it suits each species
// An aquarium's backdrop: one list of seas, and whether each animal is from that time
// A lagoon's Aquascape tab: the water it holds. Rocks, corals and the like come later.
function aquascapeHtml(e){
  const cur = (waterOf(e)[0] || {}).kind, m2 = area(e.points);
  return `<section><h3>Water</h3><div class="need-line ${cur ? "ok" : "no"}">${cur ? `<b>${esc(SEA_WATER[cur] ? waterLabel(cur) : waterLabel(cur) + " fresh water")}</b>.` : "No water."}</div><div class="row" style="margin-top:6px">${lagoonWaters().map(k => `<button class="btn" data-action="aquaWater" data-k="${k}" style="padding:3px 9px"${k === cur ? " disabled" : ""}>${esc(SEA_WATER[k] ? waterLabel(k) : waterLabel(k) + " fresh")}, ${money(m2 * waterRate(k))}</button>`).join("")}</div></section>`;
}
function aquaSceneHtml(e){
  const sc = e.vivScene, kinds = [...new Set(e.animals.map(a => a.sp))].map(sp => SPECIES_BY_ID[sp]), pick0 = sc ? sc.sea : kinds.length ? seaSceneOf(kinds[0]) : "";
  let h = `<section><h3>Backdrop</h3><div class="need-line ${sc ? "ok" : "no"}">${sc ? `<b>${esc(AQUA_SCENES[sc.sea].label)}</b>.` : "No backdrop yet."}</div>`;
  h += `<div class="row" style="margin-top:6px;flex-wrap:nowrap"><select id="aquaSceneSel" style="flex:1;min-width:0;padding:6px;border:1px solid var(--line);border-radius:8px;background:var(--field)"><option value="">No backdrop</option>${Object.entries(AQUA_SCENES).map(([k, x]) => `<option value="${k}"${k === pick0 ? " selected" : ""}>${esc(x.label)}</option>`).join("")}</select>`;
  h += `<button class="btn" data-action="aquaScene">Set, ${money(VIV_SCENE.price)}</button></div>`;
  for(const s of kinds){ const ok = sc && sceneFit(e, s) > 0, home = seaSceneOf(s); h += `<div class="need-line ${ok ? "ok" : "no"}">${esc(s.name)}: ${esc(home ? AQUA_SCENES[home].label : s.period)}</div>`; }
  return h + `</section>`;
}
function vivSceneHtml(e){
  const sc = e.vivScene, kinds = [...new Set(e.animals.map(a => a.sp))].map(sp => SPECIES_BY_ID[sp]);
  const era0 = sc ? sc.era : (kinds.length ? ERA_OF[kinds[0].period] : ""), bio0 = sc ? sc.biome : biomeOf(e);
  let h = "";
  if(devMode() || e.palu){   // dry, or flooded at the front as a paludarium (dev mode only for now)
    h += `<section><h3>Layout</h3><div class="row"><span class="status ${e.palu ? "ok" : ""}">${e.palu ? "Paludarium" : "Dry"}</span>`;
    h += e.palu ? `<button class="btn sell" data-action="palu" data-on="0">Drain it +${money(Math.round(PALU.price * COST.refundShare))}</button>` : `<button class="btn" data-action="palu" data-on="1">Paludarium, ${money(PALU.price)}</button>`;
    h += `</div></section>`;
  }
  h += `<section><h3>Scene</h3>`;
  h += `<div class="need-line ${sc ? "ok" : "no"}">${sc ? `<b>${esc(ERA_LABEL[sc.era])} ${esc(BIOMES[sc.biome].label.toLowerCase())}</b>.` : "No scene yet."}</div>`;
  const sel = `style="flex:1;min-width:0;padding:6px;border:1px solid var(--line);border-radius:8px;background:var(--field)"`;
  h += `<div class="row" style="margin-top:6px;flex-wrap:nowrap"><select id="vivEraSel" ${sel}><option value="">No scene</option>${VIV_SCENE.eras.map(x => `<option value="${x}"${x === era0 ? " selected" : ""}>${esc(ERA_LABEL[x])}</option>`).join("")}</select>`;
  h += `<select id="vivBiomeSel" ${sel}>${Object.entries(BIOMES).map(([k, x]) => `<option value="${k}"${k === bio0 ? " selected" : ""}>${esc(x.label)}</option>`).join("")}</select>`;
  h += `<button class="btn" data-action="vivScene">Set, ${money(VIV_SCENE.price)}</button></div>`;
  for(const s of kinds){
    const era = sc && ERA_OF[s.period] === sc.era, bio = sc && biomeFit(s, sc.biome) !== "away";
    h += `<div class="need-line ${era && bio ? "ok" : era || bio ? "mid" : "no"}">${esc(s.name)}: ${esc(ERA_LABEL[ERA_OF[s.period]])}, ${esc(biomesOf(s) ? biomeNames(s) : "any biome")}</div>`;
  }
  return h + `</section>`;
}
// An aquarium's water: how clean it is, and what the filters clean against what the animals foul
function aquaWaterHtml(e){
  const w = wqOf(e), aim = wqAim(e), load = aquaLoad(e), clean = filters(e).reduce((n, f) => n + LAND[f.type].clean, 0), why = filterText(e);
  let h = `<section><h3>Water</h3><div class="factor" style="grid-template-columns:80px 1fr 48px"><span>Clean</span>${meter(w, w >= AQUA.murky ? "var(--good)" : w >= AQUA.foul ? "var(--warn)" : "var(--bad)")}<span>${Math.round(w)}%</span></div>`;
  if(Math.abs(aim - w) >= 1) h += `<div class="meta" style="margin-top:4px">${aim > w ? "Clearing" : "Clouding"} toward ${Math.round(aim)}%</div>`;
  h += `<div class="factor" style="grid-template-columns:80px 1fr 64px;margin-top:6px" title="Filtering a day against what the animals foul a day"><span>Filtering</span>${meter(load ? Math.min(100, clean / load * 100) : 100, clean >= load ? "var(--good)" : "var(--bad)")}<span>${clean} of ${load}</span></div>`;
  h += `<div class="row" style="margin-top:6px"><span class="status ${why ? "no" : "ok"}">${esc(why || (filters(e).length ? `Filters on, ${filterKw(e)} kW` : "No filter"))}</span></div>`;
  return h + `</section>`;
}
// Vivarium fittings and enrichment: pick one from a list and it's set in the glass wherever there's room
const VIV_TOYS = Object.keys(LAND).filter(k => LAND[k].vivToy && !LAND[k].fit), VIV_FITS = Object.keys(LAND).filter(k => LAND[k].vivToy && LAND[k].fit);
const vivSelect = (id, keys, e, note) => `<div class="row" style="margin-top:6px;flex-wrap:nowrap"><select id="${id}" style="flex:1;min-width:0;padding:6px;border:1px solid var(--line);border-radius:8px;background:var(--field)">${keys.filter(k => caseTakes(e, k)).map(k => { const t = LAND[k], why = vivToyProblem(e, k); return `<option value="${k}"${why ? " disabled" : ""}>${esc(t.label)}, ${money(t.price)} (${note(t)})${why ? ` - ${esc(why)}` : ""}</option>`; }).join("")}</select><button class="btn" data-action="${id === "vivFitSel" ? "vivFit" : "vivToy"}">Add</button></div>`;
const vivHere = (e, fit) => { const here = landOf(e).filter(f => LAND[f.type] && LAND[f.type].vivToy && !!LAND[f.type].fit === fit); return here.length ? `<div class="meta" style="margin-top:6px">In the glass:</div><ul class="herd">${here.map(f => { const t = LAND[f.type]; return `<li><span class="dot" style="background:${t.color}"></span><span>${esc(t.label)}${t.tray ? ` (${Math.round(trayHas(f))}/${trayCap(f)}${trayKind(f) ? " " + esc(trayKind(f)) : ""})` : ""}</span><button class="btn sell" data-action="vivPlantOff" data-id="${esc(f.id)}">Remove +${money(Math.round(t.price * COST.refundShare))}</button></li>`; }).join("")}</ul>` : ""; };
function vivToysHtml(e){
  const n = e.animals.length, heat = e.aqua ? 0 : heatCount(e), lovers = e.aqua ? 0 : e.animals.filter(a => likesOf(SPECIES_BY_ID[a.sp]).water >= HAB.wantsWater).length;
  let h = wetCase(e) ? aquaWaterHtml(e) : "";
  h += `<section><h3>Fittings</h3>`;
  if(n){
    const need = dishesNeeded(e), have = trays(e).length;
    h += `<div class="row" style="margin-top:6px"><span class="status ${have >= need ? "ok" : "no"}">${have >= need ? `Food dishes ${have} of ${need}` : esc(dishText(e))}</span></div>`;
    if(heat) h += `<div class="row"><span class="status ${heatShare(e) >= 1 ? "ok" : "no"}">${vivFit(e, "lamp").length ? `Lamps warm ${Math.min(heat, vivFit(e, "lamp").length * VIV_LAMP.per)} of ${heat} that want heat` : `${heat} want a basking lamp`}</span></div>`;
    if(lovers && !e.palu) h += `<div class="row"><span class="status ${vivPoolM2(e) > 0 ? "ok" : "no"}">${vivPoolM2(e) > 0 ? "Pool to wade in" : `${lovers} want a pool`}</span></div>`;
  }
  h += vivSelect("vivFitSel", VIV_FITS, e, t => t.tray ? `holds ${VIV_DISH.cap[e.viv] || t.tray} units` : t.filter ? `cleans ${t.clean} a day, ${t.kw} kW, ${money(t.upkeep)} a day` : t.lamp ? `warms ${VIV_LAMP.per}, ${money(t.upkeep)} a day` : "water to wade in") + vivHere(e, true) + `</section>`;
  const need = enrichNeed(e), have = toyPoints(e);
  h += `<section><h3>Enrichment</h3>`;
  if(e.animals.length) h += `<div class="factor" style="grid-template-columns:80px 1fr 64px;margin-top:8px"><span>Toys</span>${meter(Math.min(100, have / (need || 1) * 100), have >= need ? "var(--good)" : have >= need / 2 ? "var(--warn)" : "var(--bad)")}<span>${have} of ${Math.ceil(need)}</span></div>`;
  h += vivSelect("vivToySel", VIV_TOYS, e, t => `${t.toy} toy point${t.toy === 1 ? "" : "s"}`) + vivHere(e, false);
  return h + `</section>`;
}
// Plant cover and rock coverage per species: "X/Y" (what it has / what it wants), then red lines for what's wrong or one green line when it's right
function needsHtml(e){
  if(!e.animals.length) return "";
  const b = biomeOf(e), all = haveOf(e), kinds = [...new Set(e.animals.map(a => a.sp))].map(sp => SPECIES_BY_ID[sp]);
  const row = (label, x, y, lv) => `<div class="need-row ${lv}"><b>${label}</b><span>${x}/${y}</span></div>`;
  const li = (lv, t) => `<div class="need-line ${lv}">${t}</div>`;
  const pc = x => `${Math.round(x * 1000) / 10}%`;
  const body = kinds.map(s => {
    const f = speciesFit(e, s), n = esc(s.name), ex = esc(e.name), home = biomesOf(s) && biomeFit(s, b) !== "home" ? biomeNames(s) : "";
    const fine = (what, have, want, extra) => {
      const bad = [];
      if(have < want) bad.push(`Wants more ${what}.`);
      if(extra) bad.push(extra);
      if(home && want > 0) bad.push(`Wants ${what} from ${esc(home)}.`);
      return bad;
    };
    const pl = fine("plants", f.h.plants, f.w.plants, f.h.plants < f.w.plants && all.plants > f.h.plants ? `Wants ${esc(s.period)} plants.` : "");
    const rk = fine("rocks", f.h.rock, f.w.rock, "");
    // water: under half of what it wants is red; over double is yellow, over triple is red
    const wh = f.h.water, ww = f.w.water, r = ww > 0 ? wh / ww : 1;
    const wl = ww <= 0 ? (wh > 0 ? "ok" : "ok") : r < .5 ? "no" : r < 1 - HAB.waterBand ? "mid" : r <= 2 ? "ok" : r < 3 ? "mid" : "no";
    const wt = r < 1 ? "Wants more water." : "Wants less water.";
    return `<div class="need-sp">${kinds.length > 1 ? `<div class="need-name">${n}</div>` : ""}${row("Plant Cover", f.h.plants, f.w.plants, pl.length ? "no" : "ok")}${pl.map(t => li("no", t)).join("")}${row("Rock Coverage", f.h.rock, f.w.rock, rk.length ? "no" : "ok")}${rk.map(t => li("no", t)).join("")}${row("Water", pc(wh), pc(ww), wl)}${wl === "ok" ? "" : li(wl, wt)}</div>`;
  }).join("");
  return `<div style="margin-top:6px">${body}</div>`;
}

// Water, rocks and groves in one exhibit, and buttons to add more (barns are in the Habitat Items tab)
const ROCKS = ["rock", "boulder"];
const landLock = t => t.tech && !hasTech(t.tech) ? "Research at the Research Lab first." : potKey(t) && potsHave(t) < 1 ? `Needs ${potName(t)} from the Botany Lab.` : t.ceres && state.ceres.stock < t.ceres ? `Takes ${t.ceres} Paleoflora from the Botany Lab.` : "";
const landTabs = {ex:null, biome:null, period:null, sub:"plants"};   // which biome and period tab the plant list shows
function landHtml(e){
  const here = biomeOf(e), biomes = Object.keys(BIOMES).filter(b => Object.values(PLANTS_OF).some(p => p[b]));
  if(landTabs.ex !== e.id){ landTabs.ex = e.id; landTabs.biome = here; landTabs.period = null; }
  if(!biomes.includes(landTabs.biome)) landTabs.biome = biomes[0];
  const lb = landTabs.biome, periods = Object.keys(PLANTS_OF).filter(p => PLANTS_OF[p][lb]);
  if(!periods.includes(landTabs.period)) landTabs.period = periods[0];
  const lp = landTabs.period;
  // each rock kind: its place button, then a Random button and one thumbnail per picture of this biome's stone (the same pickers as the build menu)
  const rockBtns = ROCKS.map(k => { const t = LAND[k], why = landLock(t), list = (ROCK_SPRITES[lb] || {})[k] || [], sel = rockPicOf(k, lb);
    const shapes = list.length ? `<div class="shapes" style="padding:4px 0 0"><button class="shape rnd" data-action="rockShape" data-type="${k}" data-pic="" aria-pressed="${sel == null}" title="Random shape">?</button>${list.map((_, i) => `<button class="shape" data-action="rockShape" data-type="${k}" data-pic="${i}" aria-pressed="${sel === i}" title="Shape ${i + 1}"><img src="${spriteUrl(`sprites/rocks/${k}-${lb}-${i + 1}.png`)}" alt="Shape ${i + 1}"></button>`).join("")}</div>` : "";
    return `<div style="width:100%;margin-bottom:6px"><button class="btn" data-action="landTool" data-key="${k}" data-biome="${lb}" style="padding:3px 9px"${why ? ` disabled title="${esc(why)}"` : ""}>${esc(t.label)}, ${money(t.price)}</button>${shapes}</div>`; }).join("");
  const plantBtns = PLANTS_OF[lp][lb].concat(lp === "Quaternary" ? PARK_PLANTS_OF[lb] || [] : []).map(k => { const t = LAND[k], why = landLock(t); return `<button class="btn" data-action="landTool" data-key="${k}" style="padding:3px 9px"${why ? ` disabled title="${esc(why)}"` : ""}>${PLANT_SPRITES[k] ? `<img src="${spriteUrl(`sprites/plants/${k}.png`)}" alt="" style="height:22px;vertical-align:middle;margin-right:4px;image-rendering:pixelated">` : ""}<b>${esc(t.size)}</b> ${esc(t.label)}, ${money(t.price)}${potKey(t) ? " + plant" : ""}</button>`; }).join("");
  const sub = ["plants", "rocks", "water"].includes(landTabs.sub) ? landTabs.sub : "plants";
  const biomeTabs = `<div style="margin-top:8px">${tabBar("lbiome", biomes.map(x => ({key:x, label:BIOMES[x].label + (x === here ? " (here)" : ""), color:BIOMES[x].color})), lb)}</div>`;
  const body = sub === "plants" ? `${biomeTabs}<div style="margin-top:6px">${tabBar("lperiod", periods.map(x => ({key:x, label:x, color:PERIOD_COLOR[x]})), lp)}</div><div class="row" style="margin-top:6px">${plantBtns}</div>`
    : sub === "rocks" ? `${biomeTabs}<div class="row" style="margin-top:6px">${rockBtns}</div>`
    : `<div class="row" style="margin-top:8px"><button class="btn" data-action="waterTool" style="padding:3px 9px">Draw water, ${money(WATER.perSqM)}/m²</button></div>`;
  return `${biomeHtml(e)}<section><h3>Landscape needs</h3>${needsHtml(e)}</section><section><h3>Landscaping</h3>${tabBar("lsub", [{key:"plants", label:"Plants", color:"#4E7F2E"}, {key:"rocks", label:"Rocks", color:"#7A6A58"}, {key:"water", label:"Water", color:"#2F6FA8"}], sub)}${body}</section>`;
}

// Habitat props tab: Shelters (barns, caves, canopies) and Food Trays, each with its own sub-tab
const propsTabs = {sub:"shelters"};
const TRAY_FOODS = ["plants", "paleoflora", "meat", "fish", "insects", "fruit", "shellfish"];
function propsHtml(e){
  const sub = ["trays", "toys"].includes(propsTabs.sub) ? propsTabs.sub : "shelters", isTray = k => !!LAND[k].tray, isToy = k => !LAND[k].vivToy && !!(LAND[k].toy || LAND[k].toyFor);
  const thumb = k => SHELTER_SPRITES[k] ? `sprites/shelter/${k}.png` : TRAY_SPRITES[k] ? `sprites/tray/${k}.png` : "";
  const btnsFor = (list, tip, extra) => list.map(k => { const t = LAND[k], why = landLock(t), img = thumb(k), more = extra ? extra(t) : t.tray ? `${t.tray} units` : "", title = why || (tip ? tip(k) : "");
    return `<button class="btn" data-action="landTool" data-key="${k}" style="padding:4px 9px;display:inline-flex;align-items:center;gap:6px"${title ? ` title="${esc(title)}"` : ""}${why ? " disabled" : ""}>${img ? `<img src="${spriteUrl(img)}" alt="" style="height:30px;max-width:64px;object-fit:contain;image-rendering:pixelated">` : ""}<span>${esc(t.label)}<br><small>${money(t.price)}${more ? ` · ${more}` : ""}</small></span></button>`; }).join("");
  const haveText = list => { const have = list.map(k => [LAND[k], landOf(e).filter(f => f.type === k).length]).filter(([, c]) => c); return have.length ? `Here: ${have.map(([t, c]) => `${c} ${esc(t.label.toLowerCase())}${c === 1 ? "" : "s"}`).join(", ")}` : "None."; };
  let h = `<section><h3>Habitat items</h3>${tabBar("psub", [{key:"shelters", label:"Shelters", color:"#8C6A2E"}, {key:"trays", label:"Food Trays", color:"#6E737A"}, {key:"toys", label:"Enrichment", color:"#7A5A3A"}], sub)}`;
  if(sub === "toys"){
    const list = HABITAT_PROPS.filter(k => isToy(k) && !toyHidden(k)), counts = devMode() ? speciesCounts(e) : [];
    h += `<div class="meta" style="margin-top:6px">${haveText(list)}</div>`;
    for(const [sp, c] of counts){ const s = SPECIES_BY_ID[sp], need = enrichNeedOf(e, s, c), have = toyPoints(e, s);
      h += `<div class="factor" style="grid-template-columns:110px 1fr 64px;margin-top:6px"><span>${esc(s.name)}</span>${meter(Math.min(100, have / (need || 1) * 100), have >= need ? "var(--good)" : have >= need / 2 ? "var(--warn)" : "var(--bad)")}<span>${have} of ${Math.ceil(need)}</span></div>`; }
    const tip = k => { const t = LAND[k]; return `${t.toyFor ? Object.entries(t.toyFor).map(([d, p]) => `${DIETS[d].toLowerCase()}s ${p}`).join(", ") : `Everyone ${t.toy}`}${t.lasts ? `, lasts ${t.lasts} days` : ""}${t.hay ? `, feeds plant eaters ${t.hay} food a day` : ""}${t.paleo ? `, feeds older plant eaters ${t.paleo} Paleoflora a day, and takes ${t.ceres} from the Botany Lab` : ""}.`; };
    return h + `<div class="row" style="margin-top:8px">${btnsFor(list, tip, () => "")}</div></section>`;
  }
  if(sub === "shelters"){
    const list = HABITAT_PROPS.filter(k => !isTray(k) && !isToy(k) && !toyHidden(k));
    h += `<div class="meta" style="margin-top:6px">${haveText(list)}</div>`;
    if(e.animals.length){ const c = coverOf(e), have = Math.round(c.shelter + (c.shade || 0)), r = c.need ? have / c.need : 1, lv = r >= 1 ? "ok" : r >= .5 ? "mid" : "no";
      h += `<div class="need-row ${lv}" style="margin-top:6px" title="Animals' shelter slots covered, in today's weather (${esc(weatherNow().label.toLowerCase())}).${c.idle ? ` ${c.idle} slots of room can't be used by these animals.` : ""}"><b>Shelter cover</b><span>${have}/${c.need}</span></div>`; }
    const tip = k => k === "screen" ? `Hides ${SCREEN.holds} animals from the path, within ${SCREEN.fenceReach} m of the fence. Shy animals stress less and hooligans bang on the glass far less, and the animals stay in sight.` : `Bigger animals take more room, and a shelter only takes animals up to its size.${LAND[k].only ? " Burrows only take burrowing species: Lystrosaurus, Heterodontosaurus, Hypsilophodon, Hyaenodon and the dire wolf." : ""}${LAND[k].noCold ? " Doesn't help in the cold." : ""}`;
    return h + `<div class="row" style="margin-top:8px">${btnsFor(list, tip, t => t.slots ? `${t.slots} slots` : "")}</div></section>`;
  }
  const list = HABITAT_PROPS.filter(isTray), tr = trays(e), eaten = Object.keys(dailyNeed(e)), foods = eaten.length ? eaten : TRAY_FOODS;
  h += `<div class="meta" style="margin-top:6px">${haveText(list)}</div>`;
  if(tr.length){
    const cap = tr.reduce((n, f) => n + trayCap(f), 0), has = tr.reduce((n, f) => n + trayHas(f), 0);
    h += `<div class="meta" style="margin-top:6px">${Math.round(has)}/${cap} units</div>`;
    h += tr.map((f, i) => { const k = trayKind(f), opts = [...new Set([...foods, ...(f.set ? [f.set] : [])])];
      return `<label class="field" style="margin-top:6px"><span>${esc(LAND[f.type].label)} ${i + 1}: ${Math.round(trayHas(f))}/${trayCap(f)}${k ? " " + esc(k) : ""}</span><select data-tray="${esc(f.id)}"><option value=""${f.set ? "" : " selected"}>Any food</option>${opts.map(t => `<option value="${t}"${f.set === t ? " selected" : ""}>${esc(t)} only</option>`).join("")}</select></label>`; }).join("");
  }
  return h + `<div class="row" style="margin-top:8px">${btnsFor(list)}</div></section>`;
}

// Behavior tab: what the animals are doing, how each species' needs stand, and what's stressing them
function behaviorHtml(e){
  if(!e.animals.length) return `<section><h3>Behavior</h3><div class="meta">No animals.</div></section>`;
  const ctx = behaviorCtx(e), en = Math.round(ctx.enrich * 100), col = v => v < 35 ? "var(--good)" : v < 65 ? "var(--warn)" : "var(--bad)";
  let h = `<section><h3>Behavior</h3><div class="meta">${esc(actsSummary(e.animals))}</div>`;
  h += `<div class="factor" style="grid-template-columns:90px 1fr 44px;margin-top:8px"><span>Enrichment</span>${meter(en, en >= 60 ? "var(--good)" : en >= 30 ? "var(--warn)" : "var(--bad)")}<span>${en}%</span></div>`;
  h += `</section>`;
  if(!e.viv){
    const vis = Math.round(hideAvgOf(e) * 100), gone = 1 - hideAvgOf(e), shy = e.animals.filter(a => traitsOf(SPECIES_BY_ID[a.sp]).temper === "skittish").length;
    h += `<section><h3>In view</h3><div class="factor" style="grid-template-columns:90px 1fr 44px"><span>Guests see</span>${meter(vis, vis >= 80 ? "var(--good)" : vis >= 60 ? "var(--warn)" : "var(--bad)")}<span>${vis}%</span></div>`;
    const qs = quietSigns(e).length, ss = screenShare(e), extra = [qs ? `${qs} quiet sign${qs === 1 ? "" : "s"} by the fence` : "", ss ? `${Math.round(ss * 100)}% of the herd behind a privacy screen` : ""].filter(Boolean);
    h += `<div class="factor" style="grid-template-columns:90px 1fr 44px"><span>Crowding</span>${meter(Math.round(ctx.seen * 100), col(ctx.seen * 100))}<span>${Math.round(ctx.seen * 100)}%</span></div>`;
    if(extra.length) h += `<div class="meta" style="margin-top:2px">${extra.join(", ")}</div>`;
    h += `</section>`;
  }
  const soc = [...ctx.soc.values()];
  if(soc.length) h += `<section><h3>Social</h3>${soc.map(i => `<div class="meta" style="color:${i.bad ? "var(--bad)" : "var(--good)"}">${esc(i.text)}</div>`).join("")}</section>`;
  for(const [sp, c] of speciesCounts(e)){
    const s = SPECIES_BY_ID[sp], t = traitsOf(s), list = e.animals.filter(a => a.sp === sp), aw = awake(s);
    h += `<section><h3><span class="dot" style="background:${PERIOD_COLOR[s.period]};display:inline-block;margin-right:6px"></span>${esc(s.name)} × ${c}</h3>`;
    h += `<div class="meta">${esc(traitText(s))} · ${aw >= .9 ? "awake" : aw >= .5 ? "drowsy" : "asleep"}</div>`;
    if((t.social === "herd" || t.social === "pack") && !e.viv && list.length > 1) h += `<div class="meta" style="margin-top:2px">Alpha: ${esc(list.slice().sort(byRank)[0].name || "?")}</div>`;
    h += `<div style="margin-top:6px">${NEED_KEYS.map(k => { const v = list.reduce((n, a) => n + needsOf(a)[k], 0) / list.length; return `<div class="factor" style="grid-template-columns:90px 1fr 44px"><span>${NEED_TEXT[k]}</span>${meter(v, col(v))}<span>${Math.round(v)}%</span></div>`; }).join("")}</div>`;
    if(speciesCounts(e).size > 1) h += `<div class="meta" style="margin-top:4px">${esc(actsSummary(list))}</div>`;
    const worst = list.reduce((m, a) => needsOf(a).stress > needsOf(m).stress ? a : m, list[0]), why = [];
    stressTarget(e, worst, s, ctx, why);
    const reasons = [...new Set(why)], stressed = needsOf(worst).stress >= 30;
    const pacing = list.filter(a => a.act === "pace");
    if(pacing.length){
      const pw = pacing[0].why || "bored";
      h += `<div class="meta" style="margin-top:4px;color:var(--bad)">Pacing: ${whyText[pw]}</div>`;
    }
    if(stressed) h += `<div class="meta" style="margin-top:4px;color:var(--bad)">${reasons.length ? `Stressed: ${esc(reasons.join(", "))}` : "Stress easing"}</div>`;
    h += `</section>`;
  }
  return h;
}

// Sick animals, illness risk, and medicated feed for one exhibit
// Exhibit sanitation: 100 is spotless, and it falls as dirt builds
function dirtHtml(e){
  if(!e.animals.length) return "";
  const dirt = e.dirt || 0;
  let h = `<section><h3>${lagoonWalled(e) ? "Water Quality" : "Sanitation"}</h3>`;
    h += `<div class="factor" style="grid-template-columns:70px 1fr 74px;margin-top:8px"><span>${lagoonWalled(e) ? "Water Quality" : "Sanitation"}</span>${meter(100 - dirt, dirt < CLEAN.dirtyAt ? "var(--good)" : dirt < 60 ? "var(--warn)" : "var(--bad)")}<span>${Math.round(100 - dirt)}%</span></div>`;
  return h + `</section>`;
}
// One bulleted health check: level is "ok" (green), "warn" (yellow) or "bad" (red)
const hli = (level, text) => `<li class="hl ${level}">${text}</li>`;
function healthHtml(e){
  const away = state.health.ward.filter(p => p.home === e.id);
  if(!e.animals.length && !away.length) return "";
  const hr = healthReport(e), items = [];
  let h = `<section><h3>Health</h3>`;
  if(!healthActive()) items.push(hli("ok", `Illness starts ${fmtDate(state.health.from)}.`));
  if(hr.sick.length){
    const worst = Math.max(...hr.sick.map(a => a.sick.sev));
    items.push(hli(worst >= 40 ? "bad" : "warn", `${hr.sick.length} sick or injured.`));
  } else if(e.animals.length) items.push(hli("ok", "Healthy."));
  if(e.animals.length){
    const d = daysSinceCheck(e), late = d >= HEALTH.checkEvery;
    items.push(hli(d === 0 ? "ok" : late ? "bad" : "warn", `${d >= 99 ? "Never checked by a vet." : d === 0 ? "Vet check: today." : `Vet check: ${d} day${d === 1 ? "" : "s"} ago${late ? ", overdue" : ""}.`}`));
  }
  if(away.length) items.push(hli("warn", `At the PMC: ${away.map(p => `${esc(SPECIES_BY_ID[p.a.sp].name)} (${esc(patientStatus(p).replace(/\..*$/, "").toLowerCase())})`).join(", ")}.`));
  if(e.animals.length && !e.viv){
    const te = trashEaten(e);
    if(e.trash) items.push(hli(te >= .25 ? "bad" : "warn", `${e.trash} piece${e.trash === 1 ? "" : "s"} of trash thrown in today.`));
  }
  if(e.animals.length) for(const [l, t] of basicsLow(e, e.animals)) items.push(hli(l, esc(t)));
  if(anyMedTech() && e.medFeed) items.push(hli(e.medFedOk ? "ok" : "bad", e.medFedOk ? "Medicated today." : "Not medicated today."));
  if(items.length) h += `<ul class="issues hl-list">${items.join("")}</ul>`;
  // every animal's health, the worst first; tap one to open it
  if(e.animals.length) h += `<ul class="herd" style="margin-top:8px">${[...e.animals].sort((a, b) => animalHp(a) - animalHp(b) || byName(a, b)).map(a => { const s = SPECIES_BY_ID[a.sp], v = Math.round(animalHp(a)), sk = noticed(a) && a.sick; return `<li class="animal-row" data-action="animalOpen" data-id="${esc(a.id)}" style="cursor:pointer"><span class="dot" style="background:${PERIOD_COLOR[s.period]}"></span><span><b>${esc(a.name || s.name)}</b> <span class="meta">${esc(s.name)} · ${sk ? (sk.kind === "injury" ? "Injured" : "Ill") : "Healthy"}, ${v}% health</span>${meter(v, hpColor(v))}${sk ? `<span class="meta">${esc(sickStatus(e, a))}</span>` : ""}</span></li>`; }).join("")}</ul>`;
  // genome therapy: vets lift clones' DNA at each check-up
  if(e.animals.length && hasTech("genetherapy")){
    const low = e.animals.filter(a => geneGain(a) >= GENE.minGain).length;
    h += `<div class="row" style="margin-top:8px"><button class="btn" data-action="gene">${e.geneTherapy ? "Stop genome therapy" : "Give genome therapy"}</button><span class="meta">${low} to improve</span></div>`;
  }
  // medicated feed from the Botany Lab
  if(anyMedTech()){
    const treatable = e.animals.filter(a => canTreat(SPECIES_BY_ID[a.sp])).length;
    h += `<div class="row" style="margin-top:8px"><button class="btn" data-action="medFeed">${e.medFeed ? "Stop medicated feed" : "Give medicated feed"}</button><span class="meta">${feedDoses(e)} dose${feedDoses(e) === 1 ? "" : "s"} a day${treatable < e.animals.length ? `, treats ${treatable} of ${e.animals.length}` : ""}</span></div>`;
  }
  return h + `</section>`;
}

// Moves waiting on keepers, into or out of this exhibit
function movesHtml(e){
  // trips to and from the PMC show under Health instead
  const ts = state.staff.transfers.filter(t => !t.med && (t.from === e.id || t.to === e.id));
  if(!ts.length) return "";
  const name = id => (state.exhibits.find(x => x.id === id) || {name:"a removed exhibit"}).name;
  return `<div class="meta" style="margin-top:6px">Moving: ${ts.map(t => `${esc(SPECIES_BY_ID[t.sp].name)} ${t.from === e.id ? `to ${esc(name(t.to))}` : `from ${esc(name(t.from))}`}${t.keeper ? " (on the way)" : ""}`).join(", ")}. <button class="btn" data-action="cancelMoves" style="padding:2px 8px">Cancel</button></div>`;
}

// The move dialog: where to, and how many (with id, just that one animal)
function openMoveDialog(e, sp, id){
  const s = SPECIES_BY_ID[sp], have = e.animals.filter(a => a.sp === sp).length, one = id && e.animals.find(a => a.id === id);
  const dests = state.exhibits.filter(x => x !== e && fitsHabitat(s, x));
  $("#moveTitle").textContent = `Move ${one ? one.name || s.name : s.name}`;
  if(!dests.length){ $("#moveBody").innerHTML = `<p>No other exhibit can hold a ${esc(s.name)}. ${s.viv ? `It needs a ${(s.aqua ? AQUARIUMS : VIVARIUMS)[s.viv].label.toLowerCase()} or bigger.` : "Build another exhibit first."}</p>`; $("#moveGo").hidden = true; $("#dlgMove").showModal(); return; }
  const fromWhy = keeperMoveProblem(e);
  $("#moveBody").innerHTML = `<label class="field"><span>To</span><select id="moveTo">${dests.map(x => { const why = keeperMoveProblem(x); return `<option value="${x.id}">${esc(x.name)}${why ? " (keepers can't get in)" : ""}${isFlyer(s) && !x.viv && !x.aviary ? " (no aviary netting)" : ""}</option>`; }).join("")}</select></label>
    ${one ? "" : `<label class="field" style="margin-top:10px"><span>How many (you have ${have})</span><input id="moveCount" type="number" min="1" max="${have}" value="${have}"></label>`}
    <p style="margin-top:10px">A keeper collects each one through this exhibit's gate and carries it to the new one. Both need a working keeper gate, or be a vivarium.</p>
    ${fromWhy ? `<p style="color:var(--bad)">Keepers can't get into ${esc(e.name)} yet: ${esc(fromWhy)}</p>` : ""}`;
  $("#moveGo").hidden = false;
  $("#moveGo").onclick = () => {
    const to = state.exhibits.find(x => x.id === $("#moveTo").value), n = one ? 1 : clamp(parseInt($("#moveCount").value, 10) || 1, 1, have);
    const go = () => { $("#dlgMove").close(); const made = requestMove(e, sp, to, n, one && one.id); ui.toast(`${one ? one.name || s.name : `${made} ${s.name}`} will be moved to ${to.name} by the next free ${aquaEx(to) ? "aquarist" : "keeper"}.${state.staff.keepers.some(k => tends(k, to)) ? "" : ` Hire ${aquaEx(to) ? "an aquarist" : "a keeper"} first.`}`); ui.panel(); saveSoon(); };
    const mix = mixWarning(s, to);
    if(mix){ $("#dlgMove").close(); askConfirm("Predator and prey", mix, "Yes, move it", go); return; }
    if(isFlyer(s) && !to.viv && !to.aviary){ $("#dlgMove").close(); askConfirm(`${s.name} can fly`, `${to.name} has no aviary netting, so the ${s.name} will fly out almost right away. Move it there anyway?`, "Yes, move it", go); }
    else go();
  };
  $("#dlgMove").showModal();
}
// Queue a finished specimen's delivery to an exhibit, after a yes to the predator/prey or flyer warning
function sendSpecimen(r, to){
  const s = SPECIES_BY_ID[r.sp];
  const go = () => { const why = deliverSpecimen(r.id, to.id); if(why) ui.toast(why, "bad"); else ui.toast(`${r.name || s.name} will be delivered to ${to.name} by the next free worker.${state.staff.keepers.length + state.staff.vets.length + state.staff.custodians.length ? "" : " Hire staff first."}`); ui.panel(); saveSoon(); };
  const mix = mixWarning(s, to);
  if(mix){ askConfirm("Predator and prey", mix, "Yes, send it", go); return; }
  if(isFlyer(s) && !to.viv && !to.aviary){ askConfirm(`${s.name} can fly`, `${to.name} has no aviary netting, so the ${s.name} will fly out almost right away. Send it there anyway?`, "Yes, send it", go); return; }
  go();
}
$("#moveCancel").onclick = () => $("#dlgMove").close();

// A species name with its [V] tag if it lives in a vivarium
function speciesName(s){ return esc(s.name) + (s.viv ? ` <span class="vtag" title="Lives in a ${(s.aqua ? AQUARIUMS : VIVARIUMS)[s.viv].label.toLowerCase()} or bigger">${s.aqua ? "A" : "V"}</span>` : ""); }

// One animal in a buy or clone list, with warnings about fit and fighting
function animalCard(s, rep, mode){
  const free = s.pool && !rep.exhibit.viv ? poolM2(rep.exhibit, s) - (rep.wetNeed || 0) : rep.area - rep.need;   // a pool animal's room is its water
  const locked = state.rating + 1e-9 < starsNeed(s);
  let warn = "";
  for(const sp of rep.counts.keys()){ const w = conflict(s, SPECIES_BY_ID[sp]); if(w){ warn = w; break; } }
  const have = rep.counts.get(s.id) || 0, fits = Math.floor(free / s.space);
  const fitLine = warn ? `<span class="warn">${esc(warn)}</span>` : fits <= 0 ? `<span class="warn">No room.</span>` : "";
  let h = `<li class="${locked ? "locked" : ""}"><span class="nm"><span class="dot" style="background:${PERIOD_COLOR[s.period]}"></span>${speciesName(s)} <span class="per">${s.period}</span></span>`;
  if(locked) h += `<span class="meta">Needs ${starsNeed(s)}★</span>`;
  else if(mode === "clone"){
    const why = cloneProblem(s.id);
    h += `<button class="buy" data-action="clone" data-sex="male" data-sp="${s.id}"${why ? ` disabled title="${esc(why)}"` : ""}>Clone M ${money(s.price)}</button><button class="buy" data-action="clone" data-sex="female" data-sp="${s.id}"${why ? ` disabled title="${esc(why)}"` : ""}>Clone F ${money(s.price)}</button>`;
  } else { const off = canAfford(s.price) ? "" : " disabled"; h += `<button class="buy" data-action="buy" data-sex="male" data-sp="${s.id}"${off}>Buy M ${money(s.price)}</button><button class="buy" data-action="buy" data-sex="female" data-sp="${s.id}"${off}>Buy F ${money(s.price)}</button>`; }
  if(mode === "clone"){
    // how long a clone takes, as a bar against the slowest species, with when it would be ready and the chance it fails
    const fail = cloneFailChance(s.id), risk = fail > 0 ? `${Math.round(fail * 100)}% failure risk` : "";
    if(freeBay("gene") >= 0){
      const slow = Math.max(...SPECIES.map(x => cloneMinutes(x.id))), pct = Math.max(4, Math.round(cloneMinutes(s.id) / slow * 100));
      h += `<span class="need" style="grid-column:1/-1"><span class="meter" style="display:block;margin-bottom:4px"><i style="display:block;width:${pct}%;background:var(--gold)"></i></span>Ready ${whenText(cloneReadyMin(s.id))}${risk ? ` · ${risk}` : ""}</span>`;
    } else if(risk) h += `<span class="need" style="grid-column:1/-1">${risk}</span>`;
  }
  if(mode === "clone" && !hasDept("tar")) h += `<span class="warn">No Genetics Lab.</span>`;
  else if(mode === "clone" && !dept("tar")) h += `<span class="warn">Genetics Lab not connected.</span>`;
  else if(!locked) h += fitLine;
  if(!locked && rep.exhibit && !rep.exhibit.viv){ const risk = escapeRisk(rep.exhibit, s); if(risk) h += `<span class="warn">${esc(risk)}</span>`; }
  return h + `</li>`;
}

function deptHead(b){
  const t = BUILDINGS[b.type], ok = isReachable(b);
  let h = `<div><h2>${t.label}</h2></div>`;
  return h + `<div class="row"><span class="status ${ok ? "ok" : "no"}">${ok ? "Running" : "Not connected"}</span><span class="meta">${money(t.upkeep)} a day</span></div>`;
}
const dnaBar = d => `<div class="factor" style="grid-template-columns:1fr 44px"><span>${meter(d ? d.genome : 0, d && d.genome >= 100 ? "var(--good)" : "var(--gold)")}</span><span>${d ? d.genome : 0}%</span></div>`;

// Science staff are hired from the Staff tab; the department just says how many it has
function sciStaffHtml(kind){
  const k = SCIENTISTS[kind], n = state.science.crew[kind];
  return `<section><h3>${k.plural} (${n})</h3><div class="row"><span class="meta">${money(k.wage)} a day each</span><button class="btn" data-action="gotoStaff">Staff</button></div></section>`;
}

function stationHtml(b){
  let h = deptHead(b);
  h += zoneRow("building", b);
  h += `<section><h3>Stock</h3>${stockRows(b)}${spoilLine(b)}</section>`;
  const aq = b.type === "diveshack";
  h += staffNote(aq ? "aquarist" : "keeper");
  const cut = state.exhibits.filter(e => e.animals.length && aquaEx(e) === aq && !gateCheck(e).ok);
  if(cut.length) h += `<section><h3>No ${aq ? "aquarist" : "keeper"} access</h3><ul class="issues">${cut.map(e => `<li class="bad">${esc(e.name)}</li>`).join("")}</ul></section>`;
  return h;
}
function breakroomHtml(b){
  let h = deptHead(b);
  const resting = [crew, vcrew, mcrew, ccrew, gcrew].flat().filter(c => c.job === "resting" && kGraph && kGraph.anchors[b.id] === c.at);
  h += `<div class="meta">${resting.length ? `${resting.length} on break` : "Nobody on break"}</div>`;
  return h;
}
function toolshedHtml(b){
  let h = deptHead(b) + `<section><h3>Upgrades</h3><ul class="shop">`;
  for(const u of UPGRADES){
    const own = hasUpgrade(u.id), prereq = u.needs && !hasUpgrade(u.needs);
    h += `<li class="${prereq ? "locked" : ""}"><span class="nm">${esc(u.label)}</span>${own ? `<span class="status ok">Owned</span>` : `<button class="buy" data-action="upgrade" data-id="${u.id}"${canAfford(u.price) && !prereq ? "" : " disabled"}>${money(u.price)}</button>`}<span class="need">${esc(u.text)}${prereq ? ` Needs ${esc(UPGRADES.find(x => x.id === u.needs).label.toLowerCase())} first.` : ""}</span></li>`;
  }
  return h + `</ul></section>`;
}

function workshopHtml(b){
  let h = deptHead(b);
  h += staffNote("mechanic");
  // every fence, worst first, as of its last inspection
  const fences = state.exhibits.filter(e => !e.viv).sort((a, b) => knownCond(a) - knownCond(b));
  if(fences.length){
    h += `<section><h3>Fences</h3>${fences.map(e => { const k = knownCond(e), d = daysSinceInspect(e); return `<div class="factor" style="grid-template-columns:1fr 70px 44px"><span>${esc(e.name)} <span class="meta">${isBreached(e) ? "broken" : d >= MAINT.inspectEvery ? `inspected ${d} days ago` : ""}</span></span>${meter(k, k >= 60 ? "var(--good)" : k >= 30 ? "var(--warn)" : "var(--bad)")}<span>${Math.round(k)}%</span></div>`; }).join("")}</section>`;
  }
  return h;
}

function generatorHtml(b){
  let h = deptHead(b) + zoneRow("building", b);
  const sup = powerSupply(), dem = powerDemand(), online = genOnline(b), k = knownCond(b);
  h += `<div class="row"><span class="status ${online ? "ok" : "no"}">${online ? `Running, ${BUILDINGS.generator.power} kW` : "Broken down"}</span></div>`;
  h += `<div class="factor" style="grid-template-columns:80px 1fr 44px;margin-top:8px"><span>Condition</span>${meter(k, k >= 60 ? "var(--good)" : k >= 30 ? "var(--warn)" : "var(--bad)")}<span>${Math.round(k)}%</span></div>`;
  h += `<section><h3>Park power</h3><dl class="kv"><dt>Generators running</dt><dd>${generators().filter(genOnline).length} of ${generators().length}</dd><dt>Supply</dt><dd>${Math.round(sup)} kW</dd><dt>Electric fences need</dt><dd>${Math.round(dem)} kW</dd><dt class="sum">${sup >= dem ? "Spare" : "Short by"}</dt><dd class="sum" style="color:${sup >= dem ? "var(--good)" : "var(--bad)"}">${Math.round(Math.abs(sup - dem))} kW</dd></dl></section>`;
  const fences = state.exhibits.filter(e => fenceDraw(e) > 0);
  if(fences.length) h += `<section><h3>Electrified fences</h3><ul class="issues">${fences.map(e => `<li class="${e.powered === false ? "bad" : ""}">${esc(e.name)}: ${Math.round(fenceDraw(e))} kW, ${e.powered === false ? "no power" : "powered"}</li>`).join("")}</ul></section>`;
  return h;
}

function pmcHtml(b){
  let h = deptHead(b);
  const ward = state.health.ward;
  h += staffNote("vet");
  h += `<section><h3>Ward (${ward.length} of ${HEALTH.beds} beds)</h3>`;
  h += ward.length ? `<ul class="herd">${ward.map(p => { const s = SPECIES_BY_ID[p.a.sp], home = state.exhibits.find(x => x.id === p.home), sev = p.a.sick ? p.a.sick.sev : 0; return `<li><span class="dot" style="background:${PERIOD_COLOR[s.period]}"></span><span><b>${esc(s.name)}</b> <span class="meta">from ${home ? esc(home.name) : "a removed exhibit"}</span>${meter(sev, sev < 40 ? "var(--warn)" : "var(--bad)")}<span class="meta">${esc(patientStatus(p))}</span></span></li>`; }).join("")}</ul>` : `<div class="meta">No patients.</div>`;
  h += `</section>`;
  const cm = Math.floor(pmcStock(CMED));
  h += `<section><h3>Medicine</h3><div class="factor" style="grid-template-columns:110px 1fr 54px"><span>Contemporary</span>${meter(cm / Math.max(1, storeTarget(b, CMED)) * 100, GOOD_COLOR[CMED])}<span>${cm}/${storeTarget(b, CMED)}</span></div>`;
  h += `<ul class="issues" style="margin-top:8px">${Object.entries(MED_TECH).map(([era, id]) => `<li class="${hasTech(id) ? "" : "bad"}">${FLORA[era].label}: ${hasTech(id) ? "curable" : `best ${100 - MODERN.floor[era]}%`}</li>`).join("")}</ul>`;
  h += `${hasDept("ceres") && anyMedTech() ? `${MED_GOODS.map(t => `<div class="factor" style="grid-template-columns:110px 1fr 54px;margin-top:4px"><span>${goodName(t).replace(" medicine", "")}</span>${meter(pmcStock(t) / storeCap(b) * 100, GOOD_COLOR[t])}<span>${Math.floor(pmcStock(t))}/${medGoodsWanted().includes(t) ? storeTarget(b, t) : 0}</span></div>`).join("")}` : ""}</section>`;
  const sick = state.exhibits.flatMap(e => e.animals.filter(noticed).map(a => ({e, a})));
  // every exhibit's check-up, most overdue first
  const herds = state.exhibits.filter(e => e.animals.length).sort((a, b) => daysSinceCheck(b) - daysSinceCheck(a));
  if(herds.length) h += `<section><h3>Check-ups</h3><ul class="issues">${herds.map(e => { const d = daysSinceCheck(e); return `<li class="${d >= HEALTH.checkEvery ? "bad" : ""}">${esc(e.name)}: ${d >= 99 ? "never checked" : d === 0 ? "checked today" : `checked ${d} day${d === 1 ? "" : "s"} ago`}</li>`; }).join("")}</ul></section>`;
  if(sick.length) h += `<section><h3>Sick in exhibits</h3><ul class="issues">${sick.map(({e, a}) => `<li class="bad">${esc(SPECIES_BY_ID[a.sp].name)} in ${esc(e.name)}, ${Math.round(a.sick.sev)}%: ${esc(sickStatus(e, a))}</li>`).join("")}</ul></section>`;
  return h;
}

function greenhouseHtml(b){
  let h = deptHead(b);
  h += `<div class="meta" style="margin-top:6px">${hasDept("ceres") ? `Botany Lab: ${ceresRate()} Paleoflora a day from ${greenhouses().length} greenhouse${greenhouses().length === 1 ? "" : "s"}` : "No Botany Lab"}</div>`;
  return h;
}

function depotHtml(b){
  if(!devMode()){
    const k = knownCond(b);
    return deptHead(b) + zoneRow("building", b) + `<div class="factor" style="grid-template-columns:80px 1fr 44px;margin-top:8px"><span>Condition</span>${meter(k, k >= 60 ? "var(--good)" : k >= 30 ? "var(--warn)" : "var(--bad)")}<span>${Math.round(k)}%</span></div>`;
  }
  let h = deptHead(b) + zoneRow("building", b);
  const working = depotWorking(b), k = knownCond(b);
  h += `<div class="row" style="margin-top:6px"><span class="status ${working ? "ok" : "no"}">${!hasTech("vehicles") ? "Needs research" : working ? `${VEHICLES.perDepot} ATVs on site` : "ATVs grounded"}</span></div>`;
  h += `<div class="factor" style="grid-template-columns:80px 1fr 44px;margin-top:8px"><span>Condition</span>${meter(k, k >= 60 ? "var(--good)" : k >= 30 ? "var(--warn)" : "var(--bad)")}<span>${Math.round(k)}%</span></div>`;
  const mine = atvs().filter(a => a.depot === b.id), nameOf = id => (allStaffList().find(x => x.id === id) || {}).name || "someone";
  h += `<section><h3>ATVs</h3>`;
  if(mine.length) h += `<ul class="issues" style="margin-top:6px">${mine.map((a, i) => { const c = [...crew, ...mcrew, ...vcrew].find(x => x.atvId === a.id);
    return `<li class="${working ? "" : "bad"}">ATV ${i + 1}: ${!working ? "grounded" : a.by ? `${esc(nameOf(a.by))} ${c && c.riding ? "is driving it" : "is on the way to it"}` : a.at ? "parked out on the roads" : "in the depot"}</li>`; }).join("")}</ul>`;
  h += `</section>`;
  return h;
}

// every building panel gets a theme picker just above its bulldoze button
function buildingHtml(b){
  const h = buildingBody(b), mark = `<div class="row"><button class="btn danger" data-action="demolish"`, i = h.lastIndexOf(mark);
  return i < 0 ? h : h.slice(0, i) + themeHtml("building", b) + h.slice(i);
}
function buildingBody(b){
  if(b.type === "dock") return dockHtml(b) + demolishRow(b);
  if(b.type === "closet") return closetHtml(b) + demolishRow(b);
  if(b.type === "security") return securityHtml(b) + demolishRow(b);
  if(storeOf(b) && !isVendor(b) && !isHotel(b) && !["station", "diveshack", "pmc"].includes(b.type)) return warehouseHtml(b) + demolishRow(b);
  if(b.type === "depot") return depotHtml(b) + demolishRow(b);
  if(b.type === "pmc") return pmcHtml(b) + demolishRow(b);
  if(b.type === "greenhouse") return greenhouseHtml(b) + demolishRow(b);
  if(b.type === "ceres") return ceresHtml(b) + demolishRow(b);
  if(b.type === "generator") return generatorHtml(b) + demolishRow(b);
  if(b.type === "workshop") return workshopHtml(b) + demolishRow(b);
  if(b.type === "station" || b.type === "diveshack") return stationHtml(b) + demolishRow(b);
  if(b.type === "breakroom") return breakroomHtml(b) + demolishRow(b);
  if(b.type === "toolshed") return toolshedHtml(b) + demolishRow(b);
  if(b.type === "oracle") return oracleHtml(b) + demolishRow(b);
  if(b.type === "ghost") return ghostHtml(b) + demolishRow(b);
  if(b.type === "tar") return tarHtml(b) + demolishRow(b);
  if(BUILDINGS[b.type].tram) return tramStopHtml(b) + demolishRow(b);
  if(guestBuilding(b) || BUILDINGS[b.type].prop) return guestBuildingHtml(b) + demolishRow(b);
  const t = BUILDINGS[b.type], reach = isReachable(b);
  let h = `<h2>${t.label}</h2>`;
  h += `<div class="row"><span class="status ${reach ? "ok" : "no"}">${reach ? "Open to guests" : "No path from the entrance"}</span></div>`;
  h += `<dl class="kv"><dt>Running cost</dt><dd>${money(t.upkeep)} a day</dd></dl>`;
  return h + demolishRow(b);
}
function demolishRow(b){ return `<div class="row"><button class="btn danger" data-action="demolish">Bulldoze for +${money(refundFor("building", b))}</button></div>`; }

// The fare control, shared by the station and track panels
function tramFareHtml(){
  const f = tramFare();
  return `<section><h3>Fare</h3><div class="ticket"><button data-action="tramFare" data-d="-1" aria-label="Lower the fare">−</button><output>${money(f)}</output><button data-action="tramFare" data-d="1" aria-label="Raise the fare">+</button></div>
    <div class="meta" style="margin-top:6px">${Math.round(tramWill() * 100)}% will pay</div></section>`;
}
// Tram station: is it joined to a footpath and to track, does it still work, and what does a ride cost
function tramStopHtml(b){
  const t = BUILDINGS[b.type], foot = !!(gGraph && gGraph.anchors[b.id + ":foot"]), rail = !!(gGraph && gGraph.anchors[b.id + ":rail"]), worn = !tramWorking(b), k = knownCond(b);
  const ok = foot && rail && !worn, why = !isReachable(b) ? "No path from the entrance." : worn ? "Out of order." : !foot ? "No footpath beside it." : !rail ? "No tram track beside it." : "";
  let h = `<h2>${t.label}</h2>`;
  h += `<div class="row"><span class="status ${ok ? "ok" : "no"}">${ok ? "Open to riders" : why}</span></div>`;
  h += `<div class="factor" style="grid-template-columns:80px 1fr 44px;margin-top:8px"><span>Condition</span>${meter(k, k >= 60 ? "var(--good)" : k >= 30 ? "var(--warn)" : "var(--bad)")}<span>${Math.round(k)}%</span></div>`;
  h += tramFareHtml();
  h += `<dl class="kv"><dt>Fares today</dt><dd>${money(Math.round(state.today.fares))}</dd><dt>Running cost</dt><dd>${money(t.upkeep)} a day</dd></dl>`;
  return h;
}
// Tram track: how many working stations it serves, and what it costs
function tramTrackHtml(p){
  const stops = tramStops(p).stops.length;
  let h = `<h2>Tram track</h2>`;
  h += `<div class="row"><span class="status ${stops >= 2 ? "ok" : "no"}">${stops >= 2 ? `Runs between ${stops} stations` : "Needs two connected stations"}</span><span class="meta">${Math.round(lineLength(p.points))} m</span></div>`;
  h += `<dl class="kv"><dt>Running cost</dt><dd>${money(Math.round(TRAM.upkeepPerMeter * lineLength(p.points)))} a day</dd></dl>`;
  h += tramFareHtml();
  h += `<div class="row"><button class="btn danger" data-action="demolish">Bulldoze for +${money(refundFor("path", p))}</button></div>`;
  return h;
}
function pathHtml(p){
  if(isTram(p)) return tramTrackHtml(p);
  const svc = isService(p), live = (svc ? derived.joinedAll : derived.joined).has(p.id);
  let h = `<h2>${p.fixed ? esc(p.name) : svc ? "Service road" : isWide(p) ? "Wide path" : isBridge(p) ? "Wooden bridge" : "Footpath"}</h2>`;
  h += `<div class="row"><span class="status ${live ? "ok" : "no"}">${live ? "Connected" : "Not connected"}</span><span class="meta">${Math.round(lineLength(p.points))} m</span></div>`;
  if(!svc && !isBridge(p)) h += themeHtml("path", p);
  h += `<div class="row"><button class="btn danger" data-action="demolish">Bulldoze for +${money(refundFor("path", p))}</button></div>`;
  return h;
}

// An open fence: a hedge row or a wall that isn't closed into an exhibit
function fenceLineHtml(l){
  const B = BARRIERS[l.barrier] || BARRIERS.wood;
  let h = `<h2>${esc(B.label)}</h2>`;
  h += `<div class="meta">${Math.round(lineLength(l.points))} m</div>`;
  h += `<div class="row"><button class="btn danger" data-action="demolish">Bulldoze for +${money(refundFor("fence", l))}</button></div>`;
  return h;
}

/* ---------- panel buttons ---------- */
panelEl.addEventListener("click", e => {
  const b = e.target.closest("[data-action]"); if(!b) return;
  const a = b.dataset.action, it = selItem();
  if(a === "deselect"){ select(null); return; }
  if(a === "tramFare"){
    state.tramFare = clamp(tramFare() + (+b.dataset.d), 1, TRAM.maxFare);
    recompute(); ui.panel(); saveSoon(); return;
  }
  if(a === "toggleClosed"){
    state.parkClosed = !state.parkClosed;
    ui.toast(state.parkClosed ? "Park closed." : "Park open.", state.parkClosed ? "bad" : "good");
    ui.hud(); ui.panel(); saveSoon(); return;
  }
  if(a === "ticket"){
    state.ticket = clamp(state.ticket + (+b.dataset.d), 1, 150);
    recompute(); ui.panel(); saveSoon(); return;
  }
  // science buttons
  const sc = state.science, done = () => { afterChange(); render(); };
  // putting a flying animal somewhere it can fly out of needs a yes first
  if((a === "buy" || a === "clone") && it && sel.kind === "exhibit" && !it.viv && !it.aviary && b.dataset.sure !== "1"){
    const s = SPECIES_BY_ID[b.dataset.sp];
    if(s && isFlyer(s)){
      askConfirm(`${s.name} can fly`, `${it.name} has no aviary netting, so the ${s.name} will fly out almost right away and get loose in the park. Put it here anyway?`, "Yes, put it here", () => { b.dataset.sure = "1"; b.click(); });
      return;
    }
  }
  // putting a predator in with its prey (or prey in with one) needs a yes first
  if((a === "buy" || a === "clone") && it && sel.kind === "exhibit" && b.dataset.sureMix !== "1"){
    const s = SPECIES_BY_ID[b.dataset.sp], w = s && mixWarning(s, it);
    if(w){ askConfirm(`Predator and prey`, w, "Yes, mix them", () => { b.dataset.sureMix = "1"; b.click(); }); return; }
  }
  if(a === "moat"){ const c = moatCost(it); if(canAfford(c)){ spend(c, "built"); it.moat = true; done(); } return; }
  if(a === "aviary"){ const c = aviaryCost(it); if(canAfford(c)){ spend(c, "built"); it.aviary = true; done(); } return; }
  if(a === "net"){ const c = netCost(it); if(canAfford(c)){ spend(c, "built"); it.net = true; done(); } return; }
  if(a === "netOff"){ it.net = false; done(); return; }
  if(a === "aviaryOff"){ it.aviary = false; done(); return; }
  if(a === "platformTool"){ setTool("platform"); return; }
  if(a === "galleryTool"){ setTool("gallery"); return; }
  if(a === "paintTool"){ openLandList("paint"); return; }
  if(a === "landTool"){ setTool("land-" + b.dataset.key); rockBiome = b.dataset.biome || null; showRockPicker(); return; }
  if(a === "rockShape"){ rockPick[b.dataset.type] = b.dataset.pic === "" ? null : +b.dataset.pic; setTool("land-" + b.dataset.type); rockBiome = landTabs.biome; showRockPicker(); ui.panel(); return; }
  if(a === "palu"){ const on = b.dataset.on === "1", why = paluProblem(it, on); if(why){ ui.toast(why, "bad"); return; } setPalu(it, on); afterChange(); render(); return; }
  if(a === "aquaScene"){ const k = ($("#aquaSceneSel") || {}).value, sc = k ? {sea:k} : null, why = vivSceneProblem(it, sc); if(why){ ui.toast(why, "bad"); return; } setVivScene(it, sc); afterChange(); render(); return; }
  if(a === "vivScene"){ const era = ($("#vivEraSel") || {}).value, sc = era ? {era, biome:($("#vivBiomeSel") || {}).value} : null, why = vivSceneProblem(it, sc); if(why){ ui.toast(why, "bad"); return; } setVivScene(it, sc); afterChange(); render(); return; }
  if(a === "vivFit"){ const k = ($("#vivFitSel") || {}).value, why = k ? vivToyProblem(it, k) : "Pick one first."; if(why){ ui.toast(why, "bad"); return; } addVivToy(it, k); afterChange(); render(); return; }
  if(a === "vivToy"){ const k = ($("#vivToySel") || {}).value, why = k ? vivToyProblem(it, k) : "Pick one first."; if(why){ ui.toast(why, "bad"); return; } addVivToy(it, k); afterChange(); render(); return; }
  if(a === "vivPlantOff"){ const f = landOf(it).find(x => x.id === b.dataset.id); if(f){ earn(Math.round(LAND[f.type].price * COST.refundShare), "sold"); it.land.splice(it.land.indexOf(f), 1); regatherViv(it); afterChange(); render(); } return; }
  if(a === "psub"){ propsTabs.sub = b.dataset.k; ui.panel(); return; }
  if(a === "lsub"){ landTabs.sub = b.dataset.k; ui.panel(); return; }
  if(a === "expd"){ exTabs.period = b.dataset.k; ui.panel(); return; }
  if(a === "animalOpen"){ const an = animalById(b.dataset.id); if(an){ animalSelName = an.name; select("animal", an.id); } return; }
  if(a === "animalBack"){ select("exhibit", b.dataset.id); return; }
  if(a === "animalSell"){ sellAnimalAsk(b.dataset.id); return; }
  if(a === "animalCrate"){ crateAnimalNow(b.dataset.id); return; }
  if(a === "crateTool"){ startUncrate(b.dataset.id); return; }
  if(a === "crateOpen"){ const c = crates().find(x => x.id === b.dataset.id), e = c && state.exhibits.find(x => inPoly(c.x, c.y, x.points)); if(c && e){ const why = uncrate(c.id, e); if(why) ui.toast(why, "bad"); else { select(null); afterChange(); render(); ui.toast(`${c.name || SPECIES_BY_ID[c.sp].name} is out of its crate in ${e.name}.`, "good"); } } return; }
  if(a === "crateSell"){ const r = crates().find(x => x.id === b.dataset.id); if(r) askConfirm("Sell animal?", `Sell ${r.name || SPECIES_BY_ID[r.sp].name} for ${money(Math.round(SPECIES_BY_ID[r.sp].price * COST.animalResale))}?`, "Sell", () => { sellCrate(r.id); if(sel && sel.kind === "crate" && sel.id === r.id) sel = null; afterChange(); render(); }); return; }
  if(a === "extab"){ exTabs.tab = b.dataset.k; ui.panel(); return; }
  if(a === "lbiome"){ landTabs.biome = b.dataset.k; ui.panel(); return; }
  if(a === "lperiod"){ landTabs.period = b.dataset.k; ui.panel(); return; }
  if(a === "waterTool"){ openLandList("water"); return; }
  if(a === "aquaWater"){ if(it && it.points && lagoonWalled(it)) fillLagoon(it, b.dataset.k); return; }
  if(a === "hireSci"){ const why = hireScientist(b.dataset.k); if(why) ui.toast(why, "bad"); done(); return; }
  if(a === "clone"){ if(orderClone(b.dataset.sp, sel && sel.kind === "exhibit" ? sel.id : null, b.dataset.sex)) done(); return; }
  if(a === "moveDlg" && it){ openMoveDialog(it, b.dataset.sp, b.dataset.id); return; }
  if(a === "callKeeper" && it){ const why = callKeeper(it, b.dataset.kind || "keeper"); if(why) ui.toast(why, "bad"); done(); return; }
  if(a === "cancelCall" && it){ cancelCall(it, b.dataset.kind || "keeper"); done(); return; }
  if(a === "cancelMoves" && it){ state.staff.transfers = state.staff.transfers.filter(t => t.keeper || t.med || (t.from !== it.id && t.to !== it.id)); done(); return; }
  if(a === "gene" && it){
    if(it.geneTherapy) it.geneTherapy = false; else { const why = geneProblem(); if(why) ui.toast(why, "bad"); else it.geneTherapy = true; }
    done(); return;
  }
  if(a === "medFeed" && it){ it.medFeed = !it.medFeed; done(); return; }
  if(a === "upgrade"){ const u = UPGRADES.find(x => x.id === b.dataset.id); if(u && canAfford(u.price) && !hasUpgrade(u.id) && !(u.needs && !hasUpgrade(u.needs))){ spend(u.price, "built"); state.staff.upgrades.push(u.id); ui.toast(`Bought ${u.label.toLowerCase()}. ${u.text}`, "good"); done(); } return; }
  if(a === "gateTool"){ setTool("gate"); return; }
  if(a === "otab2"){ officeTab = b.dataset.k; ui.panel(); return; }
  if(a === "tartab"){ tarTab = b.dataset.k; ui.panel(); return; }
  if(a === "specMove"){ startDeliver(b.dataset.id); return; }
  if(a === "specCancel"){ cancelDelivery(b.dataset.id); ui.panel(); saveSoon(); return; }
  if(a === "howTo"){ $("#dlgIntro").showModal(); return; }
  if(a === "restart"){ askConfirm("Restart?", "This leaves the park you're in and returns to the start screen. Anything not saved is lost, and a new park replaces your save when you start it.", "Restart", () => { setSpeed(0); showStart(); }); return; }
  if(a === "gotoDept"){ const d = state.buildings.find(x => x.type === b.dataset.t); if(d) select("building", d.id); return; }
  if(!it) return;
  if(a === "center") centerOn(it);
  if(a === "buy"){
    const s = SPECIES_BY_ID[b.dataset.sp];
    if(!canAfford(s.price) || state.rating + 1e-9 < starsNeed(s)) return;
    spend(s.price, "animals");
    if(!it.animals.length) it.happy = 70;
    const sex = b.dataset.sex === "male" || b.dataset.sex === "female" ? b.dataset.sex : undefined;
    it.animals.push(nameAnimal({id:uid("a-"), sp:s.id, ...(sex ? {sex} : {})}));
    afterChange(); render();
  }
  if(a === "demolish"){
    bulldozeItem(sel.kind, it);
  }
});
$("#sheetName").addEventListener("input", e => {
  const it = selItem(); if(!it || !(sel.kind === "exhibit" || sel.kind === "zone")) return;
  it.name = e.target.value.slice(0, 40) || (sel.kind === "zone" ? "Zone" : "Exhibit"); render(); $("#sheetToggle").textContent = it.name; saveSoon();
});
$("#sheetName").addEventListener("change", e => { const it = selItem(); if(it) e.target.value = it.name; });
$("#sheetName").addEventListener("keydown", e => { if(e.key === "Enter") e.target.blur(); });
$("#panelClose").onclick = closePanel;

/* ---------- moving and resizing the panel like a window ---------- */
// Where it sits is a per-browser convenience (localStorage), never saved in the game. null is the default spot by the right column.
const PANEL_MIN = {w:300, h:200}, PANEL_KEY = "genesis-panel";
const panelNarrow = () => matchMedia("(max-width:760px)").matches;   // phones: a fixed bottom sheet
let panelBox = null;   // {x, y, w, h} in px inside <main>
try { const b = JSON.parse(localStorage.getItem(PANEL_KEY)); if(b && [b.x, b.y, b.w, b.h].every(Number.isFinite)) panelBox = b; } catch {}
function placePanel(){
  const s = aside.style;
  if(!panelBox || panelNarrow()){ s.left = s.top = s.width = s.height = s.right = s.maxWidth = s.maxHeight = ""; return; }
  const m = aside.parentElement.getBoundingClientRect(), b = panelBox;
  b.w = Math.min(Math.max(b.w, PANEL_MIN.w), m.width); b.h = Math.min(Math.max(b.h, PANEL_MIN.h), m.height);
  b.x = clamp(b.x, 0, m.width - b.w); b.y = clamp(b.y, 0, m.height - b.h);
  Object.assign(s, {left:b.x + "px", top:b.y + "px", width:b.w + "px", height:b.h + "px", right:"auto", maxWidth:"none", maxHeight:"none"});
}
function savePanelBox(){ try { if(panelBox) localStorage.setItem(PANEL_KEY, JSON.stringify(panelBox)); else localStorage.removeItem(PANEL_KEY); } catch {} }
aside.addEventListener("pointerdown", e => {
  if(panelNarrow() || e.button) return;
  const grip = e.target.closest("[data-rsz]"), head = !grip && e.target.closest(".sheet-head") && !e.target.closest("button, input");
  if(!grip && !head) return;
  e.preventDefault();
  const m = aside.parentElement.getBoundingClientRect(), r = aside.getBoundingClientRect(), dir = grip ? grip.dataset.rsz : "";
  const st = {x:r.left - m.left, y:r.top - m.top, w:r.width, h:r.height}, cx = e.clientX, cy = e.clientY;
  aside.classList.add(grip ? "resizing" : "dragging");
  const move = ev => {
    const dx = ev.clientX - cx, dy = ev.clientY - cy, b = {...st};
    if(!dir){ b.x += dx; b.y += dy; }
    if(dir.includes("e")) b.w = st.w + dx;
    if(dir.includes("s")) b.h = st.h + dy;
    // pulling the left or top edge keeps the opposite edge where it is
    if(dir.includes("w")){ b.x = clamp(st.x + dx, 0, st.x + st.w - PANEL_MIN.w); b.w = st.x + st.w - b.x; }
    if(dir.includes("n")){ b.y = clamp(st.y + dy, 0, st.y + st.h - PANEL_MIN.h); b.h = st.y + st.h - b.y; }
    panelBox = b; placePanel();
  };
  const up = () => { removeEventListener("pointermove", move); removeEventListener("pointerup", up); removeEventListener("pointercancel", up); aside.classList.remove("dragging", "resizing"); savePanelBox(); };
  addEventListener("pointermove", move); addEventListener("pointerup", up); addEventListener("pointercancel", up);
});
// Double-click the top bar to put the panel back by the right column
aside.querySelector(".sheet-head").addEventListener("dblclick", e => { if(e.target.closest("button, input") || panelNarrow()) return; panelBox = null; placePanel(); savePanelBox(); });
addEventListener("resize", placePanel);
placePanel();

// Setting what a food tray holds: changing it empties the tray
panelEl.addEventListener("change", ev => {
  const id = ev.target.dataset && ev.target.dataset.tray; if(!id) return;
  const e = selItem(), f = e && landOf(e).find(x => x.id === id); if(!f) return;
  f.set = ev.target.value || null; f.food = {};
  ui.panel();
});

// A yes/no question inside the page
function askConfirm(title, text, yes, onYes, no = "Cancel", onNo = null){
  const d = $("#dlgConfirm");
  $("#confirmTitle").textContent = title; $("#confirmText").textContent = text; $("#confirmYes").textContent = yes; $("#confirmNo").textContent = no;
  $("#confirmYes").onclick = () => { d.close(); onYes(); };
  $("#confirmNo").onclick = () => { d.close(); if(onNo) onNo(); };
  d.oncancel = onNo ? ev => ev.preventDefault() : null;   // a two-way choice can't be escaped out of
  d.showModal();
}

/* ---------- Paleopedia ---------- */

// Where a species stands: can you get it now, is it on its way, or not started yet?
function speciesStatus(s){
  const sc = state.science, d = sc.dna[s.id];
  const lock = state.rating + 1e-9 < starsNeed(s) ? `Needs ${starsNeed(s)}★. You have ${starTxt(state.rating)}.` : "";
  if(isStarter(s)) return {group:lock ? "progress" : "now", cls:"ok", how:`Sold by partner parks for ${money(s.price)}.`, lock};
  if(cloneOpen(s.id)) return {group:lock ? "progress" : "now", cls:"ok", how:`Genome ${d.genome}% complete. Clone at the Genetics Lab for ${money(s.price)}${d.genome < 100 ? `, though clones are only ${cloneQuality(s.id)}% DNA quality until it is whole` : ""}.`, lock};
  if(sc.trips.some(t => t.sp === s.id)) return {group:"progress", cls:"wait", how:`A drone is out finding it now. Genome ${d ? d.genome : 0}%.`, lock};
  if(d) return {group:"progress", cls:"wait", how:`Genome ${d.genome}% complete. The Genetics Lab needs ${CLONE_GENOME.min}% to clone it. Send an expedition for more.`, lock};
  const where = sitesOf(s.id).filter(siteShown).map(x => isScouted(x.id) ? x.name : `an unscouted ${sitePeriod(x)} site`);
  if(isUnlocked(s.id)) return {group:"progress", cls:"wait", how:`Discovered. Send an expedition to ${where[0] || "its site"} to collect its DNA.`, lock};
  return {group:"locked", cls:"no", how:`Not discovered yet. The Time Travel Lab's drones can scout for it ${where.length > 1 ? `at ${where.length} sites` : "at one site"} in the ${s.period}.`, lock};
}

// Known to the Paleopedia: a starter, a discovered species, or one with DNA already collected
const ppKnown = s => isStarter(s) || isUnlocked(s.id) || !!state.science.dna[s.id];
let ppPick = null;   // species id open on the card
let ppPeriod = null; // period tab open, or null for none
// A species' sprite box: a patch of its first biome's ground, laid from the same 1 m tiles as the map (biomepaint.js)
const ppGround = {};   // biome -> data URL of the patch (null while its tiles load)
const PP_SCALE = 2, PP_CELLS = [24, 14];
function ppGroundUrl(biome){
  const T = GROUND_TILES[biome];
  if(!T) return spriteUrl(`sprites/ground/${biome}.png`);
  if(biome in ppGround) return ppGround[biome];
  ppGround[biome] = null;
  const n = T.plain + T.detail, tiles = [], pick = groundPicks(T.plain, T.detail, T.share); let left = n;
  for(let i = 0; i < n; i++){
    const t = new Image(); tiles.push(t);
    t.onload = () => {
      if(--left) return;
      const [W, H] = PP_CELLS, px = GROUND_TILE_PX, c = document.createElement("canvas"); c.width = W * px; c.height = H * px;
      const g = c.getContext("2d"); g.imageSmoothingEnabled = false;
      for(let x = 0; x < W; x++) for(let y = 0; y < H; y++){
        const k = pick[x * GROUND_SPAN + y], o = T.still && T.still.includes(k + 1) ? 0 : cellHash(x + 7919, y + 104729) % (T.turn === false ? 2 : 8), h = px / 2, a = (o >> 1) * Math.PI / 2, m = o & 1 ? -1 : 1;
        g.setTransform(Math.cos(a) * m, Math.sin(a) * m, -Math.sin(a), Math.cos(a), x * px + h, y * px + h);
        g.drawImage(tiles[k], -h, -h);
      }
      try { ppGround[biome] = c.toDataURL(); } catch(e){ return; }
      document.querySelectorAll(`.pp-pic[data-biome="${biome}"]`).forEach(el => el.style.background = ppBg({id:"", biome}));
    };
    t.src = spriteUrl(`sprites/ground/${biome}-${i + 1}.png`);
  }
  return null;
}
const ppBiome = s => s.biome || (biomesOf(s) || [])[0];
const ppBg = s => { const b = ppBiome(s); if(!b) return "var(--chrome-2)"; const u = ppGroundUrl(b); return u ? `${BIOMES[b].color} url('${u}') 0 0/${PP_CELLS[0] * GROUND_TILE_PX * PP_SCALE}px ${PP_CELLS[1] * GROUND_TILE_PX * PP_SCALE}px` : BIOMES[b].color; };
const ppImg = s => SPRITES[s.id] ? `<img src="${spriteUrl(`sprites/${s.id}.png`)}" alt="${esc(s.name)}">` : `<span class="pp-noart">No picture yet</span>`;

function ppCard(s){
  const I = SPECIES_INFO[s.id] || {}, t = traitsOf(s), st = speciesStatus(s), per = PERIOD_BY_ID[s.period];
  let n = 0; for(const e of state.exhibits) for(const a of e.animals) if(a.sp === s.id) n++;
  const stars = Math.min(5, Math.max(1, Math.ceil(s.appeal / 5))), row = (k, v) => `<dt>${k}</dt><dd>${v}</dd>`;
  return `<div class="pp-card"><div class="pp-left"><div class="pp-pic" data-biome="${ppBiome(s) || ""}" style="background:${ppBg(s)};image-rendering:pixelated">${ppImg(s)}</div><dl class="pp-stats">`
    + row("Period", `${s.period} (${per.ago})`) + row("Diet", dietText(s)) + row("Biome", s.aqua ? "the sea" : biomesOf(s) ? biomeNames(s) : "any")
    + row("Size", I.ft ? `${I.ft} ft long` : "?") + row("Activity", TRAIT_TEXT[t.active]) + row("Space", `${s.space.toLocaleString()} m²`)
    + row("Social", TRAIT_TEXT[t.social]) + row("Personality", TRAIT_TEXT[t.temper]) + row("Group size", s.group[0] === s.group[1] ? s.group[0] : `${s.group[0]}–${s.group[1]}`)
    + row("Appeal", `<span title="Appeal ${s.appeal}">${"★".repeat(stars)}${"☆".repeat(5 - stars)}</span>`)
    + `</dl></div><div class="pp-right"><h3>${esc(s.name)}</h3><i class="pp-sci">${esc(I.sci || "")}</i>`
    + `<p class="pp-desc">${I.desc ? esc(I.desc) : "No notes on this animal yet."}</p></div>`
    + `<div class="pp-acq"><span class="how ${st.cls}">${esc(st.how)}</span>${st.lock ? ` <span class="lock">${esc(st.lock)}</span>` : ""}${n ? ` <span class="have">${n} in your park.</span>` : ""}</div></div>`;
}

function catalogHtml(){
  const order = ["Cambrian", "Ordovician", "Silurian", "Devonian", "Carboniferous", "Permian", "Triassic", "Jurassic", "Cretaceous", "Paleogene", "Neogene", "Quaternary"];
  const all = SPECIES.filter(s => speciesAvailable(s.id)), pers = order.filter(per => all.some(s => s.period === per));
  if(!pers.includes(ppPeriod)) ppPeriod = null;
  const tabs = pers.map(per => `<button class="pp-tab" data-per="${per}" aria-pressed="${per === ppPeriod}">${per}</button>`).join("");
  if(!ppPeriod) return `<div class="pp-tabs">${tabs}</div><div class="pp-body"><div class="meta">Pick a period.</div></div>`;
  const here = all.filter(s => s.period === ppPeriod), got = here.filter(ppKnown), p = PERIOD_BY_ID[ppPeriod];
  if(!got.some(s => s.id === ppPick)) ppPick = got.length ? got[0].id : null;
  const list = `<h3 class="pp-ph"><span class="dot" style="background:${PERIOD_COLOR[ppPeriod]}"></span>${ppPeriod} <span class="meta">${got.length} of ${here.length} discovered</span></h3><div class="pp-grid">`
    + got.map(s => `<button class="pp-tile" data-sp="${s.id}" aria-pressed="${s.id === ppPick}">${esc(s.name)}</button>`).join("")
    + `<span class="pp-tile blank" title="Not discovered yet"></span>`.repeat(here.length - got.length) + `</div>`;
  const view = ppPick ? ppCard(SPECIES_BY_ID[ppPick]) : `<div class="meta">Nothing discovered in this period yet.</div>`;
  return `<div class="pp-tabs">${tabs}</div><div class="pp-body"><div class="pp"><div class="pp-list">${list}</div><div class="pp-view">${view}</div></div></div>`;
}

function openCatalog(){ $("#catalogBody").innerHTML = catalogHtml(); if(!$("#dlgAnimals").open) $("#dlgAnimals").showModal(); }
$("#animalsBtn").onclick = openCatalog;
$("#closeAnimals").onclick = () => $("#dlgAnimals").close();
$("#catalogBody").onclick = e => {
  const t = e.target.closest("[data-per]"), b = e.target.closest("[data-sp]");
  if(t){ ppPeriod = ppPeriod === t.dataset.per ? null : t.dataset.per; $("#catalogBody").innerHTML = catalogHtml(); }
  else if(b){ ppPick = b.dataset.sp; $("#catalogBody").innerHTML = catalogHtml(); }
};
