/* =====================================================================
   SCREEN
   The top bar, the side panel, and pop-up messages.
   ===================================================================== */

const panelEl = $("#panel"), aside = $("#aside");

const ui = {
  hudCache: {},

  // Update the numbers in the top bar. Cheap enough to call every frame.
  hud(force){
    const set = (id, v) => { if(force || this.hudCache[id] !== v){ this.hudCache[id] = v; $("#" + id).textContent = v; } };
    set("money", money(state.money));
    $("#roMoney").classList.toggle("neg", state.money < 0);
    set("guests", state.today.guests.toLocaleString());
    set("inpark", guestCount().toLocaleString());
    set("clock", fmtClock(clockMin()));
    $("#closedTag").hidden = !state.parkClosed;
    const dk = nightDark(); if(force || this.hudCache.dark !== dk){ this.hudCache.dark = dk; $("#nightWash").style.opacity = dk; drawLights(); }
    set("dayLabel", `${fmtDate(state.day)} · ${weatherNow().label}`);
    set("parkName", state.name);
    const fc = `Today: ${weatherNow().label}. Tomorrow: ${weatherNext().label}.`;
    if(force || this.hudCache.forecast !== fc){ this.hudCache.forecast = fc; $("#dayLabel").title = fc; }
    $("#dayFill").style.width = (state.minute / DAY_MIN * 100).toFixed(1) + "%";
    const r = Math.round(state.rating * 2) / 2;
    if(force || this.hudCache.rating !== r){ this.hudCache.rating = r; $("#rating").innerHTML = starsSvg(state.rating, 16); $("#rating").setAttribute("aria-label", `${r} stars`); }
  },

  panel(){
    if(document.querySelector(".app.focus")) return;
    const it = selItem();
    if(sel && !it) sel = null;
    let h;
    if(!sel) h = overviewHtml();
    else if(sel.kind === "exhibit") h = exhibitHtml(it);
    else if(sel.kind === "building") h = buildingHtml(it);
    else if(sel.kind === "zone") h = zoneHtml(it);
    else if(sel.kind === "fence") h = fenceLineHtml(it);
    else if(sel.kind === "guest") h = guestHtml(it);
    else if(sel.kind === "staff") h = staffHtml(it);
    else if(sel.kind === "animal") h = animalHtml(it);
    else h = pathHtml(it);
    // keep the scroll spot and the typing cursor when the panel redraws
    const sc = aside.scrollTop, focusId = document.activeElement && panelEl.contains(document.activeElement) ? document.activeElement.id : null;
    panelEl.innerHTML = h;
    aside.scrollTop = sc;
    if(focusId){ const f = document.getElementById(focusId); if(f) f.focus(); }
    if(sel && sel.kind === "guest") guestLive(true);
    if(sel && sel.kind === "staff") staffLive(true);
    if(sel && sel.kind === "animal") animalLive(true);
    $("#sheetToggle").textContent = it ? (it.name || BUILDINGS[it.type]?.label || (sel.kind === "fence" ? (BARRIERS[it.barrier] || BARRIERS.wood).label : "Path")) : "Park office";
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
    ? `<div class="card goal"><div class="step">Grant ${activeGoals().indexOf(goal) + 1} of ${activeGoals().length}</div><b>${esc(goal.text)}</b><div class="meta">${esc(goal.hint)}</div><div class="reward">Grant ${grantPrize(goal)}</div></div>`
    : `<div class="card goal"><div class="step">All grants awarded</div><b>Keep growing your park</b><div class="meta">Try for 5 stars, or see how many guests you can bring in.</div></div>`;
  h += `<section><h3>Grants <span class="num">${activeGoals().filter(g => state.goalsDone.includes(g.id)).length} of ${activeGoals().length}</span></h3><ul class="checklist">${activeGoals().map(g => { const done = state.goalsDone.includes(g.id), now = goal && g.id === goal.id; return `<li><span>${done ? "✓" : now ? "›" : ""}</span><span class="${done ? "done" : now ? "now" : ""}">${esc(g.text)}</span><span class="r">${esc(grantPrize(g))}</span></li>`; }).join("")}</ul></section>`;
  return h;
}
function officeTabs(){
  return tabBar("otab2", [{key:"office", label:"Park", color:"#4B3A8C"}, {key:"money", label:"Money", color:"#B8860B"}, {key:"science", label:"Science", color:"#1F6F73"}, {key:"guests", label:"Guests", color:"#C2563A"}, {key:"staff", label:"Staff", color:"#2E6B3A"}, {key:"grants", label:"Grants", color:"#8C6A2E"}], officeTab);
}
function mainMenuHtml(){
  return `<button class="back" data-action="otab2" data-k="office">‹ Park office</button><h2>Main Menu</h2>
    <p class="meta" style="margin-bottom:10px">Park biome: ${esc(BIOMES[parkBiome()].label)}. It was set when the park opened and can't be changed.</p>
    <label class="field" style="margin:10px 0"><span><input type="checkbox" id="sandboxToggle"${state.sandbox ? " checked" : ""}> Sandbox mode: unlimited money and research points, instant research, cloning, growing and GHOST trips</span></label>
    <p id="saveInfo" class="meta">${esc(saveMsg || "Saved in this browser.")} Your park saves by itself as you play.</p>
    <div class="row"><button class="btn" data-action="howTo">How to play</button><button class="btn danger" data-action="restart">Restart</button></div>`;
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
    <div class="meta" style="margin-top:6px">Guests think about ${money(Math.round(d.fair))} is fair at your rating. ${state.ticket > d.fair * 1.3 ? "At this price fewer come, and the ones who do complain." : state.ticket < d.fair * .7 ? "Cheap tickets bring more guests but less money each." : ""} Right now you can expect about <b>${expected.toLocaleString()}</b> guests a day.</div></section>`;

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
      ${line("tar", sc.clones.some(c => c.failed) ? `${sc.clones.filter(c => c.failed).length} failed clone${sc.clones.filter(c => c.failed).length === 1 ? "" : "s"} to discard.` : sc.clones.length ? `${sc.clones.length} clone${sc.clones.length === 1 ? "" : "s"} growing. Next ready in ${leftText(next(sc.clones))}.` : sc.ready.length ? `${sc.ready.length} clone${sc.ready.length === 1 ? "" : "s"} waiting for an exhibit.` : "Incubators empty.")}
      ${line("ceres", state.ceres.beds.length ? `${state.ceres.beds.length} batch${state.ceres.beds.length === 1 ? "" : "es"} growing. Next ready in ${leftText(next(state.ceres.beds))}.` : "Beds empty.")}
    </ul></section>`;
  }

    if(!["oracle", "ghost", "tar", "ceres"].some(hasDept)) h += `<section><h3>Science</h3><div class="meta">Build a science department to start research.</div></section>`;
    return h;
  }
  if(officeTab === "guests"){
  h += guestsOverviewHtml();
    return h;
  }

  h += `<section><h3>Gate</h3><div class="row"><button class="btn${state.parkClosed ? " primary" : ""}" data-action="toggleClosed">${state.parkClosed ? "Open the park" : "Close park"}</button></div>
    <div class="meta" style="margin-top:6px">${state.parkClosed ? "The park is closed: no new guests, no tickets, and everyone inside is heading for the exit. Wages and upkeep still run." : "The park is open round the clock, busiest by day, with a thin trickle of guests at night. Close it to send everyone home."}</div></section>`;
  h += `<section><h3>Park name</h3><label class="field"><span>Name</span><input id="officeName" maxlength="40" value="${esc(state.name)}"></label></section>`;
  h += `<section><h3>Rating ${starsSvg(state.rating, 15)} <span class="num">${starTxt(state.rating)}</span></h3>`;
  if(!d.parts.length) h += `<div class="meta">Your park needs animals before it can earn stars.</div>`;
  for(const p of d.parts){
    const pct = p.score * 100, col = pct >= 95 ? "var(--good)" : pct >= 60 ? "var(--gold)" : "var(--warn)";
    h += `<div class="factor"><span>${p.label}</span>${meter(pct, col)}<span>${(p.score * p.max).toFixed(2)}/${p.max}</span></div><div class="meta fnote">${esc(p.note)}</div>`;
  }
  if(d.pricey) h += `<div class="meta" style="color:var(--bad)">Tickets are too expensive: −0.3 stars.</div>`;
  const dir = d.ratingTarget - state.rating;
  h += `<div class="meta" style="margin-top:8px">${Math.abs(dir) < .1 ? "Your rating is steady." : dir > 0 ? `Your rating will rise toward ${d.ratingTarget.toFixed(1)} stars.` : `Your rating will fall toward ${d.ratingTarget.toFixed(1)} stars.`} It changes a little each night.</div></section>`;

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
function exhibitHtml(e){
  const rep = derived.reports[e.id] || exhibitReport(e), reach = isReachable(e);
  let h = `<button class="back" data-action="deselect">‹ Park office</button>`;
  h += `<label class="field"><span>Exhibit name</span><input id="exName" data-field="name" value="${esc(e.name)}" maxlength="40"></label>`;
  h += `<div class="row"><span class="status ${reach ? "ok" : "no"}">${reach ? "Guests can see it" : "No path reaches it"}</span><span class="meta">${e.viv ? VIVARIUMS[e.viv].label + ", " : ""}${fmtArea(rep.area)}</span></div>`;
  if(e.viv) h += `<div class="meta">Fits ${SPECIES.filter(s => fitsHabitat(s, e)).map(s => esc(s.name)).join(", ")}.</div>`;
  if(!reach) h += `<div class="meta">Draw a path from the entrance (or another connected path) up to this exhibit's fence.</div>`;
  if(exTabs.ex !== e.id){ exTabs.ex = e.id; exTabs.tab = "main"; }
  h += `<div style="margin:8px 0">${tabBar("extab", [{key:"main", label:"Exhibit", color:"#4E7F2E"}].concat(e.viv ? [] : [{key:"land", label:"Landscape Needs", color:"#7A6A58"}, {key:"props", label:"Habitat Props", color:"#8C6A2E"}], [{key:"behave", label:"Behavior", color:"#6A4C93"}, {key:"clone", label:"Cloning", color:"#1F6F73"}, {key:"animals", label:"Animals", color:"#4E7F2E"}, {key:"health", label:"Health", color:"#B3261E"}]), exTabs.tab)}</div>`;
  if((exTabs.tab === "land" || exTabs.tab === "props") && e.viv) exTabs.tab = "main";
  if(exTabs.tab === "land") return h + `${landHtml(e)}<div class="row"><button class="btn" data-action="center">Center on map</button></div>`;
  if(exTabs.tab === "props") return h + `${propsHtml(e)}<div class="row"><button class="btn" data-action="center">Center on map</button></div>`;
  if(exTabs.tab === "behave") return h + `${behaviorHtml(e)}<div class="row"><button class="btn" data-action="center">Center on map</button></div>`;
  if(exTabs.tab === "animals") return h + `${animalsTabHtml(e)}<div class="row"><button class="btn" data-action="center">Center on map</button></div>`;
  if(exTabs.tab === "clone") return h + `${cloneHtml(e, rep)}<div class="row"><button class="btn" data-action="center">Center on map</button></div>`;
  if(exTabs.tab === "health") return h + `${dirtHtml(e)}${healthHtml(e)}<div class="row"><button class="btn" data-action="center">Center on map</button></div>`;

  const n = e.animals.length;
  if(n){
    const trend = rep.target - e.happy;
    h += `<section><h3>Happiness</h3><div class="factor" style="grid-template-columns:1fr 48px"><span>${meter(e.happy, happyColor(e.happy))}</span><span>${Math.round(e.happy)}%</span></div>
      <div class="meta" style="margin-top:4px">${Math.abs(trend) < 2 ? "Holding steady." : trend > 0 ? `Rising toward ${Math.round(rep.target)}%.` : `Falling toward ${Math.round(rep.target)}%.`}</div>`;
    if(rep.issues.length) h += `<ul class="issues" style="margin-top:8px">${rep.issues.map(i => `<li class="${i.bad ? "bad" : ""}">${esc(i.text)}</li>`).join("")}</ul>`;
    h += `</section>`;
    h += `<section><h3>Animals here</h3><ul class="herd">${[...rep.counts].map(([sp, c]) => { const s = SPECIES_BY_ID[sp]; return `<li><span class="dot" style="background:${PERIOD_COLOR[s.period]}"></span><span>${esc(s.name)} × ${c}${sexSplit(e, sp)}</span></li>`; }).join("")}</ul>
      <div class="meta" style="margin-top:4px">Room used: ${fmtArea(rep.need)} of ${fmtArea(rep.area)}.</div>
      <div class="meta" style="margin-top:4px">${hasSign(e) ? "" : `No info sign. Put one beside the path within ${EDU.signReach} m of the fence and guests will learn far more here.`}</div></section>`;
  }

  // barriers, moats, and aviary netting
  if(!e.viv){
    h += `<section><h3>Barrier</h3>`;
    const kc = knownCond(e), since = daysSinceInspect(e);
    h += `<div class="factor" style="grid-template-columns:80px 1fr 44px;margin-top:8px"><span>Condition</span>${meter(kc, kc >= 60 ? "var(--good)" : kc >= 30 ? "var(--warn)" : "var(--bad)")}<span>${Math.round(kc)}%</span></div>`;
    const notes = [];
    if(e.open) notes.push(["bad", "There's a gap in the fence. Animals can walk out until you close it."]);
    else if(isBreached(e)) notes.push(["bad", "Broken. Animals can walk out until a mechanic repairs it."]);
    notes.push(since >= 99 ? ["bad", "Never inspected."] : [since >= MAINT.inspectEvery * 2 ? "bad" : since >= MAINT.inspectEvery ? "warn" : "good", since === 0 ? "Inspected today." : `Last inspected ${since} day${since === 1 ? "" : "s"} ago.`]);
    h += `<ul class="issues" style="margin-top:6px">${notes.map(([k, t]) => `<li class="${k}" style="color:var(--${k === "bad" ? "bad" : k === "warn" ? "warn" : "good"})">${esc(t)}</li>`).join("")}</ul>`;
    h += `<div class="meta" style="margin-top:6px">Guest appeal: ${Math.round(viewFactor(e, derived.reach) * 100)}%</div>`;
    h += `<div class="row" style="margin-top:8px">`;
    h += e.moat ? `<span class="status ok">Moat: nothing gets out</span>` : hasTech("moat") ? `<button class="btn" data-action="moat"${canAfford(moatCost(e)) ? "" : " disabled"}>Dig a moat, ${money(moatCost(e))}</button>` : `<span class="meta">Moats: research at ORACLE</span>`;
    h += e.aviary ? `<button class="btn" data-action="aviaryOff">Remove aviary netting</button>` : hasTech("aviary") ? `<button class="btn" data-action="aviary"${canAfford(aviaryCost(e)) ? "" : " disabled"}>Add aviary netting, ${money(aviaryCost(e))}</button>` : `<span class="meta">Aviary netting: research at ORACLE</span>`;
    h += e.net ? `<button class="btn" data-action="netOff">Remove catch netting</button>` : hasTech("catchnet") ? `<button class="btn" data-action="net"${canAfford(netCost(e)) ? "" : " disabled"}>Add catch netting, ${money(netCost(e))}</button>` : `<span class="meta">Catch netting: research at ORACLE</span>`;
    h += `</div>`;
    const plats = state.buildings.filter(b => b.type === "platform" && b.exhibitId === e.id).length;
    h += `<div class="meta" style="margin-top:6px">${plats ? `${plats} viewing platform${plats === 1 ? "" : "s"}. ` : ""}${hasTech("platform") ? ` <button class="btn" data-action="platformTool" style="padding:3px 9px">Add a viewing platform</button>` : ""}</div>`;
    h += `</section>`;
  }

  if(e.viv) h += vivSceneHtml(e) + vivToysHtml(e);

  h += themeHtml("exhibit", e);


  // food and keeper access
  const g = gateCheck(e), need = dailyNeed(e);
  h += `<section><h3>Keepers and food</h3><div class="row"><span class="status ${g.ok ? "ok" : "no"}">${g.ok ? (e.viv ? "Keepers can reach it" : "Keeper gate works") : "Keepers can't get in"}</span></div><div class="meta" style="margin-top:4px">${esc(g.text)}</div>${dishText(e) ? `<div class="row" style="margin-top:4px"><span class="status no">${esc(dishText(e))}</span></div>` : ""}`;
  if(!e.viv) h += `<div class="row" style="margin-top:6px"><button class="btn" data-action="gateTool">${e.gate ? "Move the gate" : "Place a gate"}</button></div>`;
  h += zoneRow("exhibit", e);
  for(const kind of e.viv ? ["keeper", "vet"] : ["keeper", "vet", "mech"]){
    const K = CALLS[kind], why = callProblem(e, kind), called = state.staff.calls.find(x => x.ex === e.id && callKind(x) === kind), w = called && called.keeper && K.staff().find(x => x.id === called.keeper);
    h += `<div class="row" style="margin-top:6px">${called ? `<span class="status ok">${w ? esc(w.name) + " is on the way" : "Waiting for a free " + K.word}</span><button class="btn" data-action="cancelCall" data-kind="${kind}">Cancel</button>` : `<button class="btn" data-action="callKeeper" data-kind="${kind}"${why ? ` disabled title="${esc(why)}"` : ""}>Call ${K.word}</button><span class="meta">${why ? esc(why) : kind === "keeper" ? "Nearest keeper drops what they're doing to check here." : kind === "vet" ? "A vet checks the animals and sees to the sick ones first." : "A mechanic inspects and repairs the fence now."}</span>`}</div>`;
  }
  if(n){
    h += `<div style="margin-top:8px">${Object.keys(need).map(t => { const st = stockFor(e, t), mx = e.viv ? Math.round(trayFood(e, t) + trayShare(e, t)) : storeMax(e, t), hay = t === "paleoflora" && ((e.stock || {}).paleoflora || 0) < st - .01; return `<div class="factor" style="grid-template-columns:70px 1fr 74px"><span style="text-transform:capitalize" title="${hay ? "Partly grass hay standing in for Paleoflora" : ""}">${t}${hay ? "*" : ""}</span>${meter(st / Math.max(1, mx) * 100, FOOD_COLOR[t])}<span>${Math.round(st)}/${mx}</span></div>`; }).join("")}</div>`;
    h += `<div class="meta" style="margin-top:4px">They eat ${Object.entries(need).map(([t, u]) => `${u} ${t}`).join(" and ")} a day.${freeFeeding() ? ` Partner parks feed them until ${fmtDate(state.staff.feedFrom)}.` : ""}</div>`;
  }
  h += `</section>`;

  h += `<div class="row"><button class="btn" data-action="center">Center on map</button><button class="btn danger" data-action="demolish">Bulldoze exhibit</button></div>`;
  return h;
}

// Cloning tab: finished clones waiting for a home, and species with a complete genome, by period
function cloneHtml(e, rep){
  const sc = state.science;
  let h = "";
  if(sc.ready.length){
    h += `<section><h3>Waiting at TAR</h3><ul class="herd">${sc.ready.map(r => { const s = SPECIES_BY_ID[r.sp]; return `<li><span class="dot" style="background:${PERIOD_COLOR[s.period]}"></span><span>${esc(s.name)} <span class="meta">${sexMark(r)} ${r.q}% DNA</span></span><button class="btn sell" data-action="place" data-id="${r.id}">Move in here</button></li>`; }).join("")}</ul></section>`;
  }
  const ready = SPECIES.filter(s => speciesAvailable(s.id) && cloneOpen(s.id) && fitsHabitat(s, e));
  const forSale = SPECIES.filter(s => speciesAvailable(s.id) && isStarter(s) && fitsHabitat(s, e));
  const coming = sc.clones.filter(c => c.exhibitId === e.id);
  h += `<section><h3>Add animals</h3>`;
  if(coming.length) h += `<div style="margin-bottom:8px">${coming.map(c => cloneCard(c)).join("")}</div>`;
  if(!ready.length && !forSale.length){
    h += `<div class="meta">${!hasDept("oracle") ? "Most animals come from the past. Build ORACLE to research time periods, GHOST to collect DNA, and TAR to clone."
      : `No complete genomes for ${e.viv ? "vivarium animals that fit here" : "open-habitat animals"} yet. Discover animals by scouting sites with GHOST, then send expeditions until a genome reaches 100%.`} Partner parks don't sell anything that fits ${e.viv ? "this vivarium" : "an open habitat"}.</div>`;
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
    return biomeFit(s, b) === "home" ? `<div class="need-line ok">${n} is happy with its biome.</div>` : `<div class="need-line no">${n} prefers ${esc(biomeNames(s))}.</div>`; }).join("");
  // open exhibits are painted with the Paint Ground tool; the biome with the most ground wins
  const sh = paintShare(e), parts = Object.entries(sh.counts).sort((x, y) => y[1] - x[1]).map(([k, n]) => `${esc(BIOMES[k].label)} ${Math.round(n / sh.n * 100)}%`).join(", ");
  return `<section><h3>Biome</h3><div class="need-line ok"><b>${esc(BIOMES[b].label)}</b>: ${esc(BIOMES[b].ground)}${parts && Object.keys(sh.counts).length > 1 ? ` (${parts})` : ""}.</div><button class="btn" data-action="paintTool" style="padding:3px 9px">Paint ground</button><p class="meta">The biome with the most ground in the exhibit is the one the animals and plants count.</p>${fits()}</section>`;
}
// A vivarium's scene: an era and a biome painted on the back wall and floor, set from two selects for a flat price, and how well it suits each species
function vivSceneHtml(e){
  const sc = e.vivScene, kinds = [...new Set(e.animals.map(a => a.sp))].map(sp => SPECIES_BY_ID[sp]);
  const era0 = sc ? sc.era : (kinds.length ? ERA_OF[kinds[0].period] : ""), bio0 = sc ? sc.biome : biomeOf(e);
  let h = `<section><h3>Scene</h3><div class="meta">A painted back wall and floor. Animals settle in best with a scene from their own era and biome. Any change costs ${money(VIV_SCENE.price)}.</div>`;
  h += `<div class="need-line ${sc ? "ok" : "no"}">${sc ? `<b>${esc(ERA_LABEL[sc.era])} ${esc(BIOMES[sc.biome].label.toLowerCase())}</b>.` : "No scene yet."}</div>`;
  const sel = `style="flex:1;min-width:0;padding:6px;border:1px solid var(--line);border-radius:8px;background:var(--field)"`;
  h += `<div class="row" style="margin-top:6px;flex-wrap:nowrap"><select id="vivEraSel" ${sel}><option value="">No scene</option>${VIV_SCENE.eras.map(x => `<option value="${x}"${x === era0 ? " selected" : ""}>${esc(ERA_LABEL[x])}</option>`).join("")}</select>`;
  h += `<select id="vivBiomeSel" ${sel}>${Object.entries(BIOMES).map(([k, x]) => `<option value="${k}"${k === bio0 ? " selected" : ""}>${esc(x.label)}</option>`).join("")}</select>`;
  h += `<button class="btn" data-action="vivScene">Set, ${money(VIV_SCENE.price)}</button></div>`;
  for(const s of kinds){
    const era = sc && ERA_OF[s.period] === sc.era, bio = sc && biomeFit(s, sc.biome) !== "away";
    h += `<div class="need-line ${era && bio ? "ok" : era || bio ? "mid" : "no"}">${esc(s.name)}: ${esc(ERA_LABEL[ERA_OF[s.period]])}, at home in ${esc(biomesOf(s) ? biomeNames(s) : "any biome")}.${sc ? ` ${era ? "Right era" : "Wrong era"}, ${bio ? "right biome" : "wrong biome"}.` : ""}</div>`;
  }
  return h + `</section>`;
}
// Vivarium fittings and enrichment: pick one from a list and it's set in the glass wherever there's room
const VIV_TOYS = Object.keys(LAND).filter(k => LAND[k].vivToy && !LAND[k].fit), VIV_FITS = Object.keys(LAND).filter(k => LAND[k].vivToy && LAND[k].fit);
const vivSelect = (id, keys, e, note) => `<div class="row" style="margin-top:6px;flex-wrap:nowrap"><select id="${id}" style="flex:1;min-width:0;padding:6px;border:1px solid var(--line);border-radius:8px;background:var(--field)">${keys.map(k => { const t = LAND[k], why = vivToyProblem(e, k); return `<option value="${k}"${why ? " disabled" : ""}>${esc(t.label)}, ${money(t.price)} (${note(t)})${why ? ` - ${esc(why)}` : ""}</option>`; }).join("")}</select><button class="btn" data-action="${id === "vivFitSel" ? "vivFit" : "vivToy"}">Add</button></div>`;
const vivHere = (e, fit) => { const here = landOf(e).filter(f => LAND[f.type] && LAND[f.type].vivToy && !!LAND[f.type].fit === fit); return here.length ? `<div class="meta" style="margin-top:6px">In the glass:</div><ul class="herd">${here.map(f => { const t = LAND[f.type]; return `<li><span class="dot" style="background:${t.color}"></span><span>${esc(t.label)}${t.tray ? ` (${Math.round(trayHas(f))}/${trayCap(f)}${trayKind(f) ? " " + esc(trayKind(f)) : ""})` : ""}</span><button class="btn sell" data-action="vivPlantOff" data-id="${esc(f.id)}">Remove +${money(Math.round(t.price * COST.refundShare))}</button></li>`; }).join("")}</ul>` : ""; };
function vivToysHtml(e){
  const n = e.animals.length, heat = heatCount(e), lovers = e.animals.filter(a => likesOf(SPECIES_BY_ID[a.sp]).water >= HAB.wantsWater).length;
  let h = `<section><h3>Fittings</h3><div class="meta">A food dish keepers fill (one for every ${VIV_DISH.perDish} animals, one food each), a basking lamp for the cold-blooded (one warms ${VIV_LAMP.per}) and a pool for water lovers.</div>`;
  if(n){
    const need = dishesNeeded(e), have = trays(e).length;
    h += `<div class="row" style="margin-top:6px"><span class="status ${have >= need ? "ok" : "no"}">${have >= need ? `Food dishes ${have} of ${need}` : esc(dishText(e))}</span></div>`;
    if(heat) h += `<div class="row"><span class="status ${heatShare(e) >= 1 ? "ok" : "no"}">${vivFit(e, "lamp").length ? `Lamps warm ${Math.min(heat, vivFit(e, "lamp").length * VIV_LAMP.per)} of ${heat} that want heat` : `${heat} want a basking lamp`}</span></div>`;
    if(lovers) h += `<div class="row"><span class="status ${vivPoolM2(e) > 0 ? "ok" : "no"}">${vivPoolM2(e) > 0 ? "Pool to wade in" : `${lovers} want a pool`}</span></div>`;
  }
  h += vivSelect("vivFitSel", VIV_FITS, e, t => t.tray ? `holds ${VIV_DISH.cap[e.viv] || t.tray} units` : t.lamp ? `warms ${VIV_LAMP.per}, ${money(t.upkeep)} a day` : "water to wade in") + vivHere(e, true) + `</section>`;
  const need = enrichNeed(e), have = toyPoints(e);
  h += `<section><h3>Enrichment</h3><div class="meta">Things to hide under, climb, dig in and hunt from. Bored animals with nothing to do pace.</div>`;
  if(e.animals.length && have < need) h += `<div class="row"><span class="status no">Add enrichment: hides, branches, a dig box and the like.</span></div>`;
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
      if(have < want) bad.push(`${n} would prefer more ${what} in ${ex}.`);
      if(extra) bad.push(extra);
      if(home && want > 0) bad.push(`${n} prefers ${what} from ${esc(home)}.`);
      return bad;
    };
    const pl = fine("plants", f.h.plants, f.w.plants, f.h.plants < f.w.plants && all.plants > f.h.plants ? `${n} prefers plants from the ${esc(s.period)} Period.` : "");
    const rk = fine("rocks", f.h.rock, f.w.rock, "");
    // water: under half of what it wants is red; over double is yellow, over triple is red
    const wh = f.h.water, ww = f.w.water, r = ww > 0 ? wh / ww : 1;
    const wl = ww <= 0 ? (wh > 0 ? "ok" : "ok") : r < .5 ? "no" : r < 1 - HAB.waterBand ? "mid" : r <= 2 ? "ok" : r < 3 ? "mid" : "no";
    const wt = wl === "ok" ? `${n} is very happy with the water in ${ex}.` : r < 1 ? `${n} would prefer more water in ${ex}.` : `${n} would prefer less water in ${ex}.`;
    return `<div class="need-sp">${kinds.length > 1 ? `<div class="need-name">${n}</div>` : ""}${row("Plant Cover", f.h.plants, f.w.plants, pl.length ? "no" : "ok")}${pl.length ? pl.map(t => li("no", t)).join("") : li("ok", `${n} is very happy with the plant cover in ${ex}.`)}${row("Rock Coverage", f.h.rock, f.w.rock, rk.length ? "no" : "ok")}${rk.length ? rk.map(t => li("no", t)).join("") : li("ok", `${n} is very happy with the rock coverage in ${ex}.`)}${row("Water", pc(wh), pc(ww), wl)}${li(wl, wt)}</div>`;
  }).join("");
  return `<div style="margin-top:6px">${body}</div>`;
}

// Water, rocks and groves in one exhibit, and buttons to add more (barns are in the Habitat Props tab)
const ROCKS = ["rock", "boulder"];
const landLock = t => t.tech && !hasTech(t.tech) ? "Research at ORACLE first." : potKey(t) && potsHave(t) < 1 ? `Needs ${potName(t)} from CERES.` : t.ceres && state.ceres.stock < t.ceres ? `Takes ${t.ceres} Paleoflora from CERES.` : "";
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
  const biomeTabs = `<div class="meta" style="margin-top:8px">You can place any of these anywhere, but animals only count the ones from the exhibit's own biome (${esc(BIOMES[here].label.toLowerCase())}), and ones from another biome make them unhappy.</div><div style="margin-top:6px">${tabBar("lbiome", biomes.map(x => ({key:x, label:BIOMES[x].label + (x === here ? " (here)" : ""), color:BIOMES[x].color})), lb)}</div>`;
  const body = sub === "plants" ? `${biomeTabs}<div class="meta" style="margin-top:8px"><b>${esc(BIOMES[lb].label)} plants</b></div><div style="margin-top:6px">${tabBar("lperiod", periods.map(x => ({key:x, label:x, color:PERIOD_COLOR[x]})), lp)}</div><div class="row" style="margin-top:6px">${plantBtns}</div>`
    : sub === "rocks" ? `${biomeTabs}<div class="meta" style="margin-top:8px"><b>${esc(BIOMES[lb].label)} rocks</b></div><div class="row" style="margin-top:4px">${rockBtns}</div>`
    : `<div class="row" style="margin-top:8px"><button class="btn" data-action="waterTool" style="padding:3px 9px">Draw water, ${money(WATER.perSqM)}/m²</button></div><div class="meta" style="margin-top:4px">Drag a box to lay it in 5 m chunks, like a path. It stops short of the fence. Paint ground over it to take it away.</div>`;
  return `${biomeHtml(e)}<section><h3>Landscape needs</h3>${needsHtml(e)}</section><section><h3>Landscaping</h3>${tabBar("lsub", [{key:"plants", label:"Plants", color:"#4E7F2E"}, {key:"rocks", label:"Rocks", color:"#7A6A58"}, {key:"water", label:"Water", color:"#2F6FA8"}], sub)}${body}</section>`;
}

// Habitat props tab: Shelters (barns, caves, canopies) and Food Trays, each with its own sub-tab
const propsTabs = {sub:"shelters"};
const TRAY_FOODS = ["plants", "paleoflora", "meat", "fish", "insects"];
function propsHtml(e){
  const sub = ["trays", "toys"].includes(propsTabs.sub) ? propsTabs.sub : "shelters", isTray = k => !!LAND[k].tray, isToy = k => !LAND[k].vivToy && !!(LAND[k].toy || LAND[k].toyFor);
  const thumb = k => SHELTER_SPRITES[k] ? `sprites/shelter/${k}.png` : TRAY_SPRITES[k] ? `sprites/tray/${k}.png` : "";
  const btnsFor = (list, tip, extra) => list.map(k => { const t = LAND[k], why = landLock(t), img = thumb(k), more = extra ? extra(t) : t.tray ? `${t.tray} units` : "", title = why || (tip ? tip(k) : "");
    return `<button class="btn" data-action="landTool" data-key="${k}" style="padding:4px 9px;display:inline-flex;align-items:center;gap:6px"${title ? ` title="${esc(title)}"` : ""}${why ? " disabled" : ""}>${img ? `<img src="${spriteUrl(img)}" alt="" style="height:30px;max-width:64px;object-fit:contain;image-rendering:pixelated">` : ""}<span>${esc(t.label)}<br><small>${money(t.price)}${more ? ` · ${more}` : ""}</small></span></button>`; }).join("");
  const haveText = list => { const have = list.map(k => [LAND[k], landOf(e).filter(f => f.type === k).length]).filter(([, c]) => c); return have.length ? `Here: ${have.map(([t, c]) => `${c} ${esc(t.label.toLowerCase())}${c === 1 ? "" : "s"}`).join(", ")}.` : "None here yet."; };
  let h = `<section><h3>Habitat props</h3>${tabBar("psub", [{key:"shelters", label:"Shelters", color:"#8C6A2E"}, {key:"trays", label:"Food Trays", color:"#6E737A"}, {key:"toys", label:"Enrichment", color:"#7A5A3A"}], sub)}`;
  if(sub === "toys"){
    const list = HABITAT_PROPS.filter(k => isToy(k) && !toyHidden(k)), counts = devMode() ? speciesCounts(e) : [];
    h += `<div class="meta" style="margin-top:6px">${haveText(list)} Toys keep animals busy so they don't pace. Hover a button for what it does.</div>`;
    for(const [sp, c] of counts){ const s = SPECIES_BY_ID[sp], need = enrichNeedOf(e, s, c), have = toyPoints(e, s);
      h += `<div class="factor" style="grid-template-columns:110px 1fr 64px;margin-top:6px"><span>${esc(s.name)}</span>${meter(Math.min(100, have / (need || 1) * 100), have >= need ? "var(--good)" : have >= need / 2 ? "var(--warn)" : "var(--bad)")}<span>${have} of ${Math.ceil(need)}</span></div>`; }
    const tip = k => { const t = LAND[k]; return `${t.toyFor ? Object.entries(t.toyFor).map(([d, p]) => `${DIETS[d].toLowerCase()}s ${p}`).join(", ") : `Everyone ${t.toy}`}${t.lasts ? `, lasts ${t.lasts} days` : ""}${t.hay ? `, feeds plant eaters ${t.hay} food a day` : ""}${t.paleo ? `, feeds older plant eaters ${t.paleo} Paleoflora a day, and takes ${t.ceres} from CERES` : ""}.`; };
    return h + `<div class="row" style="margin-top:8px">${btnsFor(list, tip, () => "")}</div></section>`;
  }
  if(sub === "shelters"){
    const list = HABITAT_PROPS.filter(k => !isTray(k) && !isToy(k) && !toyHidden(k));
    h += `<div class="meta" style="margin-top:6px">${haveText(list)} Shelters keep animals out of heat, cold and storms, and out of sight while they're inside. Hover a button for details.</div>`;
    if(e.animals.length){ const c = coverOf(e), have = Math.round(c.shelter + (c.shade || 0)), r = c.need ? have / c.need : 1, lv = r >= 1 ? "ok" : r >= .5 ? "mid" : "no";
      h += `<div class="need-row ${lv}" style="margin-top:6px" title="Animals' shelter slots covered, in today's weather (${esc(weatherNow().label.toLowerCase())}).${c.idle ? ` ${c.idle} slots of room can't be used by these animals.` : ""}"><b>Shelter cover</b><span>${have}/${c.need}</span></div>`; }
    const tip = k => k === "screen" ? `Hides ${SCREEN.holds} animals from the path, within ${SCREEN.fenceReach} m of the fence. Shy animals stress less and hooligans bang on the glass far less, and the animals stay in sight.` : `Bigger animals take more room, and a shelter only takes animals up to its size.${LAND[k].only ? " Burrows only take burrowing species: Lystrosaurus, Heterodontosaurus, Hypsilophodon, Hyaenodon and the dire wolf." : ""}${LAND[k].noCold ? " Doesn't help in the cold." : ""}`;
    return h + `<div class="row" style="margin-top:8px">${btnsFor(list, tip, t => t.slots ? `${t.slots} slots` : "")}</div></section>`;
  }
  const list = HABITAT_PROPS.filter(isTray), tr = trays(e), eaten = Object.keys(dailyNeed(e)), foods = eaten.length ? eaten : TRAY_FOODS;
  h += `<div class="meta" style="margin-top:6px">${haveText(list)} Keepers fill trays through the gate${e.gate ? "" : ", so this exhibit needs a gate"}.</div>`;
  if(tr.length){
    const cap = tr.reduce((n, f) => n + trayCap(f), 0), has = tr.reduce((n, f) => n + trayHas(f), 0);
    h += `<div class="meta" style="margin-top:6px">Trays hold ${Math.round(has)} of ${cap} units.</div>`;
    h += tr.map((f, i) => { const k = trayKind(f), opts = [...new Set([...foods, ...(f.set ? [f.set] : [])])];
      return `<label class="field" style="margin-top:6px"><span>${esc(LAND[f.type].label)} ${i + 1}: ${Math.round(trayHas(f))}/${trayCap(f)}${k ? " " + esc(k) : ""}</span><select data-tray="${esc(f.id)}"><option value=""${f.set ? "" : " selected"}>Any food</option>${opts.map(t => `<option value="${t}"${f.set === t ? " selected" : ""}>${esc(t)} only</option>`).join("")}</select></label>`; }).join("");
    h += `<div class="meta" style="margin-top:4px">Changing a tray's food empties it.</div>`;
  }
  return h + `<div class="row" style="margin-top:8px">${btnsFor(list)}</div></section>`;
}

// Behavior tab: what the animals are doing, how each species' needs stand, and what's stressing them
const ACTIVE_TEXT = {diurnal:"Up all day, asleep at night.", nocturnal:"Sleeps through the day. Up all night.", crepuscular:"Busiest at dawn and dusk, and drowsy in between."};
const SOCIAL_TEXT = {solitary:"Wants no company, and rivals need room to keep apart.", pair:"Wants a partner of its own kind.", herd:"Feels safe in a herd, and nervous with too few.", pack:"Lives in a pack. Left alone it paces."};
const TEMPER_TEXT = {skittish:"Busy paths stress it. Cover to retreat to helps.", curious:"Bores fast, loves to play, and likes watching people.", aggressive:"Crowding stresses it, and a stressed one tests the fence."};
function behaviorHtml(e){
  if(!e.animals.length) return `<section><h3>Behavior</h3><div class="meta">No animals here yet.</div></section>`;
  const ctx = behaviorCtx(e), en = Math.round(ctx.enrich * 100), col = v => v < 35 ? "var(--good)" : v < 65 ? "var(--warn)" : "var(--bad)";
  let h = `<section><h3>Behavior</h3><div class="meta">Right now: ${esc(actsSummary(e.animals))}.</div>`;
  h += `<div class="factor" style="grid-template-columns:90px 1fr 44px;margin-top:8px"><span>Enrichment</span>${meter(en, en >= 60 ? "var(--good)" : en >= 30 ? "var(--warn)" : "var(--bad)")}<span>${en}%</span></div>`;
  h += `<div class="meta">How much there is to do: ${e.viv ? "enrichment in the glass (Exhibit tab), plants from their own period" : "enrichment props (Habitat Props), the rocks, plants and water they like"}, and room to roam.</div></section>`;
  if(!e.viv){
    const vis = Math.round(hideAvgOf(e) * 100), gone = 1 - hideAvgOf(e), shy = e.animals.filter(a => traitsOf(SPECIES_BY_ID[a.sp]).temper === "skittish").length;
    h += `<section><h3>In view</h3><div class="factor" style="grid-template-columns:90px 1fr 44px"><span>Guests see</span>${meter(vis, vis >= 80 ? "var(--good)" : vis >= 60 ? "var(--warn)" : "var(--bad)")}<span>${vis}%</span></div>`;
    h += `<div class="meta" style="margin-top:4px;color:${gone > HIDING.from ? "var(--bad)" : "inherit"}">${gone > HIDING.from ? `${gone >= .5 ? "Most" : "Many"} animals are hiding. Add quiet signs or give shy animals more places to hide. Guests who see an empty exhibit are let down, though well-informed ones forgive it.` : "Most of the animals are out where guests can see them."}</div>`;
    h += `<div class="meta" style="margin-top:4px">Crowd the animals feel: ${Math.round(ctx.seen * 100)}%${quietSigns(e).length ? `, with ${quietSigns(e).length} quiet sign${quietSigns(e).length === 1 ? "" : "s"} by the fence` : ""}${screenShare(e) ? `, ${Math.round(screenShare(e) * 100)}% of the herd behind a privacy screen` : ""}. ${shy ? "Shy animals feel it most. " : ""}Animals inside a shelter are out of sight, sleeping at night doesn't count against you, and weather shelter only a little.</div></section>`;
  }
  const soc = [...ctx.soc.values()];
  if(soc.length) h += `<section><h3>Social</h3>${soc.map(i => `<div class="meta" style="color:${i.bad ? "var(--bad)" : "var(--good)"}">${esc(i.text)}</div>`).join("")}</section>`;
  for(const [sp, c] of speciesCounts(e)){
    const s = SPECIES_BY_ID[sp], t = traitsOf(s), list = e.animals.filter(a => a.sp === sp), aw = awake(s);
    h += `<section><h3><span class="dot" style="background:${PERIOD_COLOR[s.period]};display:inline-block;margin-right:6px"></span>${esc(s.name)} × ${c}</h3>`;
    h += `<div class="meta">${esc(traitText(s))}. ${aw >= .9 ? "Wide awake now." : aw >= .5 ? "A little drowsy now." : "Mostly asleep now."}</div>`;
    if((t.social === "herd" || t.social === "pack") && !e.viv && list.length > 1) h += `<div class="meta" style="margin-top:2px">Alpha: ${esc(list.slice().sort(byRank)[0].name || "?")}.</div>`;
    h += `<div class="meta" style="margin-top:2px">${ACTIVE_TEXT[t.active]} ${SOCIAL_TEXT[t.social]} ${TEMPER_TEXT[t.temper]}</div>`;
    h += `<div style="margin-top:6px">${NEED_KEYS.map(k => { const v = list.reduce((n, a) => n + needsOf(a)[k], 0) / list.length; return `<div class="factor" style="grid-template-columns:90px 1fr 44px"><span>${NEED_TEXT[k]}</span>${meter(v, col(v))}<span>${Math.round(v)}%</span></div>`; }).join("")}</div>`;
    h += `<div class="meta" style="margin-top:4px">${esc(actsSummary(list))}.</div>`;
    const worst = list.reduce((m, a) => needsOf(a).stress > needsOf(m).stress ? a : m, list[0]), why = [];
    stressTarget(e, worst, s, ctx, why);
    const reasons = [...new Set(why)], stressed = needsOf(worst).stress >= 30;
    const pacing = list.filter(a => a.act === "pace");
    if(pacing.length){
      const pw = pacing[0].why || "bored";
      h += `<div class="meta" style="margin-top:4px;color:var(--bad)">Pacing because ${pacing.length === 1 ? "it's" : "they're"} ${whyText[pw]}.${pw === "stressed" ? "" : " " + esc(WHY_FIX[pw])}</div>`;
    }
    if(stressed) h += `<div class="meta" style="margin-top:4px;color:var(--bad)">${reasons.length ? `Stressed because ${esc(reasons.join(", "))}.` : "Stress is still draining from something earlier (a fight, a scare or a sick herd mate) and nothing in the exhibit is adding to it now. It should ease on its own."}</div>`;
    h += `</section>`;
  }
  return h;
}

// Sick animals, illness risk, and medicated feed for one exhibit
// Exhibit sanitation: 100 is spotless, and it falls as dirt builds
function dirtHtml(e){
  if(!e.animals.length) return "";
  const dirt = e.dirt || 0;
  let h = `<section><h3>Sanitation</h3>`;
    h += `<div class="factor" style="grid-template-columns:70px 1fr 74px;margin-top:8px"><span>Sanitation</span>${meter(100 - dirt, dirt < CLEAN.dirtyAt ? "var(--good)" : dirt < 60 ? "var(--warn)" : "var(--bad)")}<span>${Math.round(100 - dirt)}%</span></div>`;
  return h + `</section>`;
}
// One bulleted health check: level is "ok" (green), "warn" (yellow) or "bad" (red)
const hli = (level, text) => `<li class="hl ${level}">${text}</li>`;
function healthHtml(e){
  const away = state.health.ward.filter(p => p.home === e.id);
  if(!e.animals.length && !away.length) return "";
  const hr = healthReport(e), items = [];
  let h = `<section><h3>Health</h3>`;
  if(!healthActive()) items.push(hli("ok", `Animals start falling ill on ${fmtDate(state.health.from)}.`));
  if(hr.sick.length){
    const worst = Math.max(...hr.sick.map(a => a.sick.sev));
    items.push(hli(worst >= 40 ? "bad" : "warn", `${hr.sick.length} sick or injured.`));
  } else if(e.animals.length) items.push(hli("ok", "Everyone looks healthy."));
  if(e.animals.length){
    const d = daysSinceCheck(e), late = d >= HEALTH.checkEvery;
    items.push(hli(d === 0 ? "ok" : late ? "bad" : "warn", `${d >= 99 ? "No vet check-up yet." : d === 0 ? "Vet checked them today." : `Last vet check-up ${d} day${d === 1 ? "" : "s"} ago${late ? ", overdue" : ""}.`}`));
  }
  if(away.length) items.push(hli("warn", `At the PMC: ${away.map(p => `${esc(SPECIES_BY_ID[p.a.sp].name)} (${esc(patientStatus(p).replace(/\..*$/, "").toLowerCase())})`).join(", ")}.`));
  if(e.animals.length && !e.viv){
    const te = trashEaten(e);
    items.push(hli(!e.trash ? "ok" : te >= .25 ? "bad" : "warn", `${e.trash ? `Guests have thrown ${e.trash} piece${e.trash === 1 ? "" : "s"} of trash in today. Tonight each animal has a ${Math.round(te * 100)}% chance of eating some, and ${Math.round(THROWN.deadly * 100)}% of those die.` : "No trash thrown in today."} ${e.net || e.aviary ? `Netting catches ${Math.round(netCatch(e) * 100)}% of it, less as the fence wears. ` : ""}`));
  }
  if(e.animals.length) for(const [l, t] of basicsLow(e, e.animals)) items.push(hli(l, esc(t)));
  if(!(e.animals.length && hasTech("genetherapy")) && hasDept("oracle") && e.animals.some(a => (a.q ?? 90) < 70)) items.push(hli("warn", "Some animals here have sickly DNA. Research Genome therapy at ORACLE to improve them."));
  if(!anyMedTech()) items.push(hli("warn", "Research medicine at ORACLE so the PMC can treat animals and CERES can make medicated feed."));
  else if(e.animals.length) items.push(e.medFeed ? hli(e.medFedOk ? "ok" : "bad", e.medFedOk ? "Medicated today." : "Not medicated today. It needs CERES medicine and fed animals.") : hli("warn", "No medicated feed."));
  if(items.length) h += `<ul class="issues hl-list">${items.join("")}</ul>`;
  // every animal's health, the worst first; tap one to open it
  if(e.animals.length) h += `<ul class="herd" style="margin-top:8px">${[...e.animals].sort((a, b) => animalHp(a) - animalHp(b) || byName(a, b)).map(a => { const s = SPECIES_BY_ID[a.sp], v = Math.round(animalHp(a)), sk = noticed(a) && a.sick; return `<li class="animal-row" data-action="animalOpen" data-id="${esc(a.id)}" style="cursor:pointer"><span class="dot" style="background:${PERIOD_COLOR[s.period]}"></span><span><b>${esc(a.name || s.name)}</b> <span class="meta">${esc(s.name)} · ${sk ? (sk.kind === "injury" ? "Injured" : "Ill") : "Healthy"}, ${v}% health</span>${meter(v, hpColor(v))}${sk ? `<span class="meta">${esc(sickStatus(e, a))}</span>` : ""}</span></li>`; }).join("")}</ul>`;
  // genome therapy: vets lift clones' DNA at each check-up
  if(e.animals.length && hasTech("genetherapy")){
    const low = e.animals.filter(a => geneGain(a) >= GENE.minGain).length;
    h += `<div class="row" style="margin-top:8px"><button class="btn" data-action="gene">${e.geneTherapy ? "Stop genome therapy" : "Give genome therapy"}</button><span class="meta">${low} below the lab's quality</span></div>`;
  }
  // medicated feed from CERES
  if(anyMedTech()){
    const treatable = e.animals.filter(a => canTreat(SPECIES_BY_ID[a.sp])).length;
    h += `<div class="row" style="margin-top:8px"><button class="btn" data-action="medFeed">${e.medFeed ? "Stop medicated feed" : "Give medicated feed"}</button><span class="meta">${feedDoses(e)} CERES dose${feedDoses(e) === 1 ? "" : "s"} a day</span></div>`;
    const note = (e.medFeed ? (e.medFedOk ? "Medicated today. " : "Not medicated today. It needs CERES medicine and fed animals. ") : "") + (treatable < e.animals.length ? `Only ${treatable} of ${e.animals.length} animals here have their era's medicine researched at ORACLE.` : "");
    if(note) h += `<div class="meta">${note.trim()}</div>`;
  }
  return h + `</section>`;
}

// Moves waiting on keepers, into or out of this exhibit
function movesHtml(e){
  // trips to and from the PMC show under Health instead
  const ts = state.staff.transfers.filter(t => !t.med && (t.from === e.id || t.to === e.id));
  if(!ts.length) return "";
  const name = id => (state.exhibits.find(x => x.id === id) || {name:"a removed exhibit"}).name;
  return `<div class="meta" style="margin-top:6px">Waiting for keepers: ${ts.map(t => `${esc(SPECIES_BY_ID[t.sp].name)} ${t.from === e.id ? `to ${esc(name(t.to))}` : `from ${esc(name(t.from))}`}${t.keeper ? " (on the way)" : ""}`).join(", ")}. <button class="btn" data-action="cancelMoves" style="padding:2px 8px">Cancel waiting moves</button></div>`;
}

// The move dialog: where to, and how many (with id, just that one animal)
function openMoveDialog(e, sp, id){
  const s = SPECIES_BY_ID[sp], have = e.animals.filter(a => a.sp === sp).length, one = id && e.animals.find(a => a.id === id);
  const dests = state.exhibits.filter(x => x !== e && fitsHabitat(s, x));
  $("#moveTitle").textContent = `Move ${one ? one.name || s.name : s.name}`;
  if(!dests.length){ $("#moveBody").innerHTML = `<p>No other exhibit can hold a ${esc(s.name)}. ${s.viv ? `It needs a ${VIVARIUMS[s.viv].label.toLowerCase()} or bigger.` : "Build another exhibit first."}</p>`; $("#moveGo").hidden = true; $("#dlgMove").showModal(); return; }
  const fromWhy = keeperMoveProblem(e);
  $("#moveBody").innerHTML = `<label class="field"><span>To</span><select id="moveTo">${dests.map(x => { const why = keeperMoveProblem(x); return `<option value="${x.id}">${esc(x.name)}${why ? " (keepers can't get in)" : ""}${isFlyer(s) && !x.viv && !x.aviary ? " (no aviary netting)" : ""}</option>`; }).join("")}</select></label>
    ${one ? "" : `<label class="field" style="margin-top:10px"><span>How many (you have ${have})</span><input id="moveCount" type="number" min="1" max="${have}" value="${have}"></label>`}
    <p style="margin-top:10px">A keeper collects each one through this exhibit's gate and carries it to the new one. Both need a working keeper gate, or be a vivarium.</p>
    ${fromWhy ? `<p style="color:var(--bad)">Keepers can't get into ${esc(e.name)} yet: ${esc(fromWhy)}</p>` : ""}`;
  $("#moveGo").hidden = false;
  $("#moveGo").onclick = () => {
    const to = state.exhibits.find(x => x.id === $("#moveTo").value), n = one ? 1 : clamp(parseInt($("#moveCount").value, 10) || 1, 1, have);
    const go = () => { $("#dlgMove").close(); const made = requestMove(e, sp, to, n, one && one.id); ui.toast(`${one ? one.name || s.name : `${made} ${s.name}`} will be moved to ${to.name} by the next free keeper.${state.staff.keepers.length ? "" : " Hire a keeper first."}`); ui.panel(); saveSoon(); };
    const mix = mixWarning(s, to);
    if(mix){ $("#dlgMove").close(); askConfirm("Predator and prey", mix, "Yes, move it", go); return; }
    if(isFlyer(s) && !to.viv && !to.aviary){ $("#dlgMove").close(); askConfirm(`${s.name} can fly`, `${to.name} has no aviary netting, so the ${s.name} will fly out almost right away. Move it there anyway?`, "Yes, move it", go); }
    else go();
  };
  $("#dlgMove").showModal();
}
$("#moveCancel").onclick = () => $("#dlgMove").close();

// A species name with its [V] tag if it lives in a vivarium
function speciesName(s){ return esc(s.name) + (s.viv ? ` <span class="vtag" title="Lives in a ${VIVARIUMS[s.viv].label.toLowerCase()} or bigger">V</span>` : ""); }
const habitatText = s => (s.viv ? `Lives in a ${VIVARIUMS[s.viv].label.toLowerCase()} or bigger. ` : "") + (biomesOf(s) ? `At home in ${biomeNames(s)}. ` : "") + traitText(s) + ". ";

// One animal in a buy or clone list, with warnings about fit and fighting
function animalCard(s, rep, mode){
  const free = rep.area - rep.need;
  const locked = state.rating + 1e-9 < starsNeed(s);
  let warn = "";
  for(const sp of rep.counts.keys()){ const w = conflict(s, SPECIES_BY_ID[sp]); if(w){ warn = w; break; } }
  const have = rep.counts.get(s.id) || 0, fits = Math.floor(free / s.space);
  const fitText = fits > 0 ? `Room for ${fits} more.` : "";
  const fitLine = warn ? `<span class="warn">${esc(warn)}</span>` : fits <= 0 ? `<span class="warn">No room left for one of these.</span>`
    : have === 0 && s.group[0] > 1 ? `<span class="need">${fitText} Get at least ${s.group[0]} so they aren't lonely.</span>` : `<span class="fit">${fitText}</span>`;
  let h = `<li class="${locked ? "locked" : ""}"><span class="nm"><span class="dot" style="background:${PERIOD_COLOR[s.period]}"></span>${speciesName(s)} <span class="per">${s.period}</span></span>`;
  if(locked) h += `<span class="meta">Needs ${starsNeed(s)}★ (you have ${starTxt(state.rating)})</span>`;
  else if(mode === "clone"){
    const why = cloneProblem(s.id);
    h += `<button class="buy" data-action="clone" data-sex="male" data-sp="${s.id}"${why ? ` disabled title="${esc(why)}"` : ""}>Clone M ${money(s.price)}</button><button class="buy" data-action="clone" data-sex="female" data-sp="${s.id}"${why ? ` disabled title="${esc(why)}"` : ""}>Clone F ${money(s.price)}</button>`;
  } else { const off = canAfford(s.price) ? "" : " disabled"; h += `<button class="buy" data-action="buy" data-sex="male" data-sp="${s.id}"${off}>Buy M ${money(s.price)}</button><button class="buy" data-action="buy" data-sex="female" data-sp="${s.id}"${off}>Buy F ${money(s.price)}</button>`; }
  h += `<span class="need">${habitatText(s)}${s.space.toLocaleString()} m² each, groups of ${s.group[0]}–${s.group[1]}, ${money(s.food)} a day to feed. ${dietText(s)}.`;
  if(mode === "clone") h += ` Genome ${state.science.dna[s.id].genome}% complete, clones ${cloneQuality(s.id)}% DNA quality${cloneFailChance(s.id) > 0 ? `, ${Math.round(cloneFailChance(s.id) * 100)}% failure risk` : ""}. ${freeBay("gene") >= 0 ? ` Ready ${whenText(cloneReadyMin(s.id))}.` : ""}`;
  h += `</span>`;
  if(mode === "clone" && !hasDept("tar")) h += `<span class="warn">Build TAR to clone it.</span>`;
  else if(mode === "clone" && !dept("tar")) h += `<span class="warn">TAR isn't connected to a path or service road.</span>`;
  else if(!locked) h += fitLine;
  if(!locked && rep.exhibit && !rep.exhibit.viv){ const risk = escapeRisk(rep.exhibit, s); if(risk) h += `<span class="warn">${esc(risk)}</span>`; }
  return h + `</li>`;
}

function deptHead(b){
  const t = BUILDINGS[b.type], ok = isReachable(b);
  let h = `<button class="back" data-action="deselect">‹ Park office</button><div><h2>${t.label}</h2><div class="meta">${esc(t.full)}</div></div>`;
  h += `<div class="row"><span class="status ${ok ? "ok" : "no"}">${ok ? "Staffed and running" : "Not connected"}</span><span class="meta">${money(t.upkeep)} a day to run</span></div>`;
  if(!ok) h += `<div class="meta" style="color:var(--bad)">Staff can't get here. Run a path or service road from the entrance to it. Until then it does nothing.</div>`;
  return h;
}
const dnaBar = d => `<div class="factor" style="grid-template-columns:1fr 44px"><span>${meter(d ? d.genome : 0, d && d.genome >= 100 ? "var(--good)" : "var(--gold)")}</span><span>${d ? d.genome : 0}%</span></div>`;

// Science staff are hired from the Staff tab; the department just says how many it has
function sciStaffHtml(kind){
  const k = SCIENTISTS[kind], n = state.science.crew[kind];
  return `<section><h3>${k.plural} (${n})</h3><div class="meta">${esc(k.text)} ${money(k.wage)} a day each. Hire and fire from the Staff tab in the park office.</div>
    <div class="row" style="margin-top:8px"><button class="btn" data-action="gotoStaff">Open Staff tab</button></div></section>`;
}

function stationHtml(b){
  let h = deptHead(b);
  h += `<div class="meta">${esc(BUILDINGS.station.blurb)} Keepers carry ${Math.round(carryMax())} food units of one type at a time.</div>` + zoneRow("building", b);
  h += `<section><h3>Stock</h3>${stockRows(b)}${spoilLine(b)}</section>`;
  h += staffNote("keeper");
  h += `<section><h3>Feeding</h3><div class="meta">${freeFeeding() ? `Partner parks are feeding your animals until ${fmtDate(state.staff.feedFrom)}.` : "Your keepers are feeding the animals."} Food comes from the Delivery Dock or your own farms, and sits in stores until a keeper carries it out. Exhibits need a gate on a service road. Vivariums don't.</div>`;
  const cut = state.exhibits.filter(e => e.animals.length && !gateCheck(e).ok);
  if(cut.length) h += `<div class="meta" style="color:var(--bad);margin-top:6px">Keepers can't get into: ${cut.map(e => esc(e.name)).join(", ")}.</div>`;
  h += `</section>`;
  return h;
}
function breakroomHtml(b){
  let h = deptHead(b);
  h += `<div class="meta">${esc(BUILDINGS.breakroom.blurb)} Keepers take a break when their stamina drops below ${KEEPER.restBelow}.</div>`;
  const resting = crew.filter(c => c.job === "resting" && kGraph && kGraph.anchors[b.id] === c.at);
  h += `<div class="meta">${resting.length ? `${resting.length} on break now.` : "Nobody on break right now."}</div>`;
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
  h += `<div class="meta">${esc(BUILDINGS.workshop.blurb)} They check every fence every ${MAINT.inspectEvery} days and fix anything under ${MAINT.repairBelow}%, broken fences first.</div>`;
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
  h += `<div class="meta">${esc(BUILDINGS.generator.blurb)}</div>`;
  h += `<div class="row"><span class="status ${online ? "ok" : "no"}">${online ? `Running, ${BUILDINGS.generator.power} kW` : "Broken down"}</span></div>`;
  h += `<div class="factor" style="grid-template-columns:80px 1fr 44px;margin-top:8px"><span>Condition</span>${meter(k, k >= 60 ? "var(--good)" : k >= 30 ? "var(--warn)" : "var(--bad)")}<span>${Math.round(k)}%</span></div>`;
  h += `<div class="meta">Cuts out below ${POWER.offlineBelow}%. Wears about ${POWER.genWear}% a day. ${state.staff.mechanics.length ? "Mechanics service it." : "Hire a mechanic at a Workshop to keep it running."}</div>`;
  h += `<section><h3>Park power</h3><dl class="kv"><dt>Generators running</dt><dd>${generators().filter(genOnline).length} of ${generators().length}</dd><dt>Supply</dt><dd>${Math.round(sup)} kW</dd><dt>Electric fences need</dt><dd>${Math.round(dem)} kW</dd><dt class="sum">${sup >= dem ? "Spare" : "Short by"}</dt><dd class="sum" style="color:${sup >= dem ? "var(--good)" : "var(--bad)"}">${Math.round(Math.abs(sup - dem))} kW</dd></dl></section>`;
  const fences = state.exhibits.filter(e => fenceDraw(e) > 0);
  if(fences.length) h += `<section><h3>Electrified fences</h3><ul class="issues">${fences.map(e => `<li class="${e.powered === false ? "bad" : ""}">${esc(e.name)}: ${Math.round(fenceDraw(e))} kW, ${e.powered === false ? "no power" : "powered"}</li>`).join("")}</ul><div class="meta" style="margin-top:6px">When power runs short, fences holding the strongest animals get it first.</div></section>`;
  return h;
}

function pmcHtml(b){
  let h = deptHead(b) + `<div class="meta">${esc(BUILDINGS.pmc.blurb)}</div>`;
  const ward = state.health.ward;
  h += staffNote("vet", `Each treats ${VET.patients} PMC patients a night. Until you hire one, keepers dart escaped animals themselves and sick animals go untreated.`);
  h += `<section><h3>Ward (${ward.length} of ${HEALTH.beds} beds)</h3>`;
  h += ward.length ? `<ul class="herd">${ward.map(p => { const s = SPECIES_BY_ID[p.a.sp], home = state.exhibits.find(x => x.id === p.home), sev = p.a.sick ? p.a.sick.sev : 0; return `<li><span class="dot" style="background:${PERIOD_COLOR[s.period]}"></span><span><b>${esc(s.name)}</b> <span class="meta">from ${home ? esc(home.name) : "a removed exhibit"}</span>${meter(sev, sev < 40 ? "var(--warn)" : "var(--bad)")}<span class="meta">${esc(patientStatus(p))}</span></span></li>`; }).join("")}</ul>` : `<div class="meta">No patients.</div>`;
  h += `<div class="meta" style="margin-top:6px">Patients don't get worse here. Each treatment uses ${HEALTH.dose} doses.</div></section>`;
  const cm = Math.floor(pmcStock(CMED));
  h += `<section><h3>Medicine</h3><div class="factor" style="grid-template-columns:110px 1fr 54px"><span>Contemporary</span>${meter(cm / Math.max(1, storeTarget(b, CMED)) * 100, GOOD_COLOR[CMED])}<span>${cm}/${storeTarget(b, CMED)}</span></div>`;
  h += `<div class="meta" style="margin-top:4px">Order it at a Delivery Dock, ${money(MODERN.cost)} a dose, and custodians carry it here. It eases any illness but never cures it fully: animals go home with a chronic case. It works best on Cenozoic animals and worst on Paleozoic ones.</div>`;
  h += `<ul class="issues" style="margin-top:8px">${Object.entries(MED_TECH).map(([era, id]) => `<li class="${hasTech(id) ? "" : "bad"}">${FLORA[era].label} animals: ${hasTech(id) ? "fully curable once ORACLE refines the medicine for their period" : `contemporary medicine gets them to ${100 - MODERN.floor[era]}% at best. Research ${ERA_LABEL[era]} medicine at ORACLE, and refine it for each period, for a full cure`}</li>`).join("")}</ul>`;
  h += `<div class="meta" style="margin-top:6px">${!hasDept("ceres") ? "Build CERES to make medicine." : !anyMedTech() ? "CERES can grow medicine once ORACLE researches any of it." : `The PMC holds ${Math.floor(pmcStock())} of ${storeCap(b)} doses. CERES has ${Math.floor(cerMedTotal())}, up to ${medCap()} of each era's. Grow more in its beds. Keepers carry them over.`}</div>${hasDept("ceres") && anyMedTech() ? `${MED_GOODS.map(t => `<div class="factor" style="grid-template-columns:110px 1fr 54px;margin-top:4px"><span>${goodName(t).replace(" medicine", "")}</span>${meter(pmcStock(t) / storeCap(b) * 100, GOOD_COLOR[t])}<span>${Math.floor(pmcStock(t))}/${medGoodsWanted().includes(t) ? storeTarget(b, t) : 0}</span></div>`).join("")}` : ""}</section>`;
  const sick = state.exhibits.flatMap(e => e.animals.filter(noticed).map(a => ({e, a})));
  // every exhibit's check-up, most overdue first
  const herds = state.exhibits.filter(e => e.animals.length).sort((a, b) => daysSinceCheck(b) - daysSinceCheck(a));
  if(herds.length) h += `<section><h3>Check-ups</h3><div class="meta">Vets check every exhibit every ${HEALTH.checkEvery} days. Mild illness doesn't show until it gets worse, so check-ups catch it while it can still be treated on the spot.</div><ul class="issues" style="margin-top:6px">${herds.map(e => { const d = daysSinceCheck(e); return `<li class="${d >= HEALTH.checkEvery ? "bad" : ""}">${esc(e.name)}: ${d >= 99 ? "never checked" : d === 0 ? "checked today" : `checked ${d} day${d === 1 ? "" : "s"} ago`}</li>`; }).join("")}</ul></section>`;
  if(sick.length) h += `<section><h3>Sick in exhibits</h3><ul class="issues">${sick.map(({e, a}) => `<li class="bad">${esc(SPECIES_BY_ID[a.sp].name)} in ${esc(e.name)}, ${Math.round(a.sick.sev)}%: ${esc(sickStatus(e, a))}</li>`).join("")}</ul></section>`;
  return h;
}

function greenhouseHtml(b){
  let h = deptHead(b) + `<div class="meta">${esc(BUILDINGS.greenhouse.blurb)}</div>`;
  h += `<div class="meta" style="margin-top:6px">${hasDept("ceres") ? `CERES grows ${ceresRate()} Paleoflora a day with ${greenhouses().length} greenhouse${greenhouses().length === 1 ? "" : "s"}.` : "There's no CERES, so this greenhouse has nothing to supply."}</div>`;
  return h;
}

function depotHtml(b){
  if(!devMode()){
    const k = knownCond(b);
    return deptHead(b) + zoneRow("building", b) + `<div class="factor" style="grid-template-columns:80px 1fr 44px;margin-top:8px"><span>Condition</span>${meter(k, k >= 60 ? "var(--good)" : k >= 30 ? "var(--warn)" : "var(--bad)")}<span>${Math.round(k)}%</span></div><div class="meta">Wears about ${VEHICLES.wear}% a day. A mechanic keeps it up.</div>`;
  }
  let h = deptHead(b) + `<div class="meta">${esc(BUILDINGS.depot.blurb)}</div>` + zoneRow("building", b);
  const working = depotWorking(b), k = knownCond(b);
  h += `<div class="row" style="margin-top:6px"><span class="status ${working ? "ok" : "no"}">${!hasTech("vehicles") ? "Needs research" : working ? `${VEHICLES.perDepot} ATVs on site` : "ATVs grounded"}</span></div>`;
  h += `<div class="factor" style="grid-template-columns:80px 1fr 44px;margin-top:8px"><span>Condition</span>${meter(k, k >= 60 ? "var(--good)" : k >= 30 ? "var(--warn)" : "var(--bad)")}<span>${Math.round(k)}%</span></div>`;
  h += `<div class="meta">Grounds its ATVs below ${VEHICLES.offlineBelow}%. Wears about ${VEHICLES.wear}% a day.</div>`;
  const mine = atvs().filter(a => a.depot === b.id), nameOf = id => (allStaffList().find(x => x.id === id) || {}).name || "someone";
  h += `<section><h3>ATVs</h3><div class="meta">${VEHICLES.perDepot} ATVs come with each depot. Any keeper, mechanic or vet can take a free one. It stays wherever they get off until somebody walks back to it, and they all return here overnight.</div>`;
  if(mine.length) h += `<ul class="issues" style="margin-top:6px">${mine.map((a, i) => { const c = [...crew, ...mcrew, ...vcrew].find(x => x.atvId === a.id);
    return `<li class="${working ? "" : "bad"}">ATV ${i + 1}: ${!working ? "grounded" : a.by ? `${esc(nameOf(a.by))} ${c && c.riding ? "is driving it" : "is on the way to it"}` : a.at ? "parked out on the roads" : "in the depot"}</li>`; }).join("")}</ul>`;
  h += `<div class="meta" style="margin-top:6px">ATVs never go on guest paths. Staff park where the service road ends and walk, so connected service roads keep them on wheels.</div></section>`;
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
  if(storeOf(b) && !isVendor(b) && !isHotel(b) && !["station", "pmc"].includes(b.type)) return warehouseHtml(b) + demolishRow(b);
  if(b.type === "depot") return depotHtml(b) + demolishRow(b);
  if(b.type === "pmc") return pmcHtml(b) + demolishRow(b);
  if(b.type === "greenhouse") return greenhouseHtml(b) + demolishRow(b);
  if(b.type === "ceres") return ceresHtml(b) + demolishRow(b);
  if(b.type === "generator") return generatorHtml(b) + demolishRow(b);
  if(b.type === "workshop") return workshopHtml(b) + demolishRow(b);
  if(b.type === "station") return stationHtml(b) + demolishRow(b);
  if(b.type === "breakroom") return breakroomHtml(b) + demolishRow(b);
  if(b.type === "toolshed") return toolshedHtml(b) + demolishRow(b);
  if(b.type === "oracle") return oracleHtml(b) + demolishRow(b);
  if(b.type === "ghost") return ghostHtml(b) + demolishRow(b);
  if(b.type === "tar") return tarHtml(b) + demolishRow(b);
  if(BUILDINGS[b.type].tram) return tramStopHtml(b) + demolishRow(b);
  if(guestBuilding(b) || BUILDINGS[b.type].prop) return guestBuildingHtml(b) + demolishRow(b);
  const t = BUILDINGS[b.type], reach = isReachable(b);
  let h = `<button class="back" data-action="deselect">‹ Park office</button><h2>${t.label}</h2>`;
  h += `<div class="row"><span class="status ${reach ? "ok" : "no"}">${reach ? "Open to guests" : "No path from the entrance"}</span></div>`;
  h += `<dl class="kv"><dt>Running cost</dt><dd>${money(t.upkeep)} a day</dd></dl>`;
  return h + demolishRow(b);
}
function demolishRow(b){ return `<div class="row"><button class="btn danger" data-action="demolish">Bulldoze for +${money(refundFor("building", b))}</button></div>`; }

// The fare control, shared by the station and track panels
function tramFareHtml(){
  const f = tramFare();
  return `<section><h3>Fare</h3><div class="ticket"><button data-action="tramFare" data-d="-1" aria-label="Lower the fare">−</button><output>${money(f)}</output><button data-action="tramFare" data-d="1" aria-label="Raise the fare">+</button></div>
    <div class="meta" style="margin-top:6px">${f === TRAM.fare ? `Everyone pays the usual ${money(TRAM.fare)}.` : `About ${Math.round(tramWill() * 100)}% of guests will pay this much.`} Guests who can't afford it walk. One fare covers the whole tram.</div></section>`;
}
// Tram station: is it joined to a footpath and to track, does it still work, and what does a ride cost
function tramStopHtml(b){
  const t = BUILDINGS[b.type], foot = !!(gGraph && gGraph.anchors[b.id + ":foot"]), rail = !!(gGraph && gGraph.anchors[b.id + ":rail"]), worn = !tramWorking(b), k = knownCond(b);
  const ok = foot && rail && !worn, why = !isReachable(b) ? "No path from the entrance." : worn ? "Out of order." : !foot ? "No footpath beside it." : !rail ? "No tram track beside it." : "";
  let h = `<button class="back" data-action="deselect">‹ Park office</button><h2>${t.label}</h2>`;
  h += `<div class="row"><span class="status ${ok ? "ok" : "no"}">${ok ? "Open to riders" : why}</span></div>`;
  h += `<div class="factor" style="grid-template-columns:80px 1fr 44px;margin-top:8px"><span>Condition</span>${meter(k, k >= 60 ? "var(--good)" : k >= 30 ? "var(--warn)" : "var(--bad)")}<span>${Math.round(k)}%</span></div>`;
  h += `<div class="meta">Stops taking riders below ${TRAM.offlineBelow}%. Wears about ${Math.round(tramWear(b) * 10) / 10}% a day, more with more track. ${state.staff.mechanics.length ? "Mechanics repair it." : "Hire a mechanic at a Workshop to keep it running."}</div>`;
  h += tramFareHtml();
  h += `<dl class="kv"><dt>Fares today</dt><dd>${money(Math.round(state.today.fares))}</dd><dt>Running cost</dt><dd>${money(t.upkeep)} a day</dd></dl>`;
  if(!ok && !worn) h += `<div class="meta">Guests walk to it from the footpath and board from the track. It needs both beside it, and another station on the same track to ride to.</div>`;
  return h;
}
// Tram track: how many working stations it serves, and what it costs
function tramTrackHtml(p){
  const stops = tramStops(p).stops.length;
  let h = `<button class="back" data-action="deselect">‹ Park office</button><h2>Tram track</h2>`;
  h += `<div class="row"><span class="status ${stops >= 2 ? "ok" : "no"}">${stops >= 2 ? `Runs between ${stops} stations` : "Needs two connected stations"}</span><span class="meta">${Math.round(lineLength(p.points))} m</span></div>`;
  h += `<div class="meta">Guests ride between stations at ${TRAM.speedMult} times walking pace. Build a Tram station beside a footpath and this track. It costs ${money(TRAM.upkeepPerMeter)} a meter a day to run, and stations wear faster with more track.</div>`;
  h += tramFareHtml();
  h += `<div class="row"><button class="btn danger" data-action="demolish">Bulldoze for +${money(refundFor("path", p))}</button></div>`;
  return h;
}
function pathHtml(p){
  if(isTram(p)) return tramTrackHtml(p);
  const svc = isService(p), live = (svc ? derived.joinedAll : derived.joined).has(p.id);
  let h = `<button class="back" data-action="deselect">‹ Park office</button><h2>${p.fixed ? esc(p.name) : svc ? "Service road" : isWide(p) ? "Wide path" : isBridge(p) ? "Wooden bridge" : "Footpath"}</h2>`;
  h += `<div class="row"><span class="status ${live ? "ok" : "no"}">${live ? "Connected to the entrance" : "Not connected to the entrance"}</span><span class="meta">${Math.round(lineLength(p.points))} m</span></div>`;
  if(svc) h += `<div class="meta">Staff only. Guests won't walk here, and exhibits beside it can't be seen. Backstage buildings like ORACLE, GHOST, and TAR can use it.</div>`;
  if(isWide(p)) h += `<div class="meta">10 m wide. Holds twice the crowd before guests feel packed.</div>`;
  if(!live) h += `<div class="meta">Nobody can reach this ${svc ? "road" : "path"}. Join it to the main walk or another connected path.</div>`;
  if(isBridge(p)) h += `<div class="meta">A timber footpath, the only path that crosses water.</div>`;
  if(!svc && !isBridge(p)) h += themeHtml("path", p);
  h += `<div class="row"><button class="btn danger" data-action="demolish">Bulldoze for +${money(refundFor("path", p))}</button></div>`;
  return h;
}

// An open fence: a hedge row or a wall that isn't closed into an exhibit
function fenceLineHtml(l){
  const B = BARRIERS[l.barrier] || BARRIERS.wood;
  let h = `<button class="back" data-action="deselect">‹ Park office</button><h2>${esc(B.label)}</h2>`;
  h += `<div class="meta">${Math.round(lineLength(l.points))} m of open fence. ${B.hedge ? "Guests enjoy hedge rows along the paths." : "It marks off part of the park."} To make an exhibit, draw a fence that closes on its first corner.</div>`;
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
    ui.toast(state.parkClosed ? "Park closed. Guests are heading for the exit." : "Park open again.", state.parkClosed ? "bad" : "good");
    ui.hud(); ui.panel(); saveSoon(); return;
  }
  if(a === "ticket"){
    state.ticket = clamp(state.ticket + (+b.dataset.d), 1, 150);
    recompute(); ui.panel(); saveSoon(); return;
  }
  // science buttons
  const sc = state.science, done = () => { afterChange(); render(); };
  // putting a flying animal somewhere it can fly out of needs a yes first
  if((a === "buy" || a === "clone" || a === "place") && it && sel.kind === "exhibit" && !it.viv && !it.aviary && b.dataset.sure !== "1"){
    const sp = a === "place" ? (sc.ready.find(r => r.id === b.dataset.id) || {}).sp : b.dataset.sp, s = SPECIES_BY_ID[sp];
    if(s && isFlyer(s)){
      askConfirm(`${s.name} can fly`, `${it.name} has no aviary netting, so the ${s.name} will fly out almost right away and get loose in the park. Put it here anyway?`, "Yes, put it here", () => { b.dataset.sure = "1"; b.click(); });
      return;
    }
  }
  // putting a predator in with its prey (or prey in with one) needs a yes first
  if((a === "buy" || a === "clone" || a === "place") && it && sel.kind === "exhibit" && b.dataset.sureMix !== "1"){
    const sp = a === "place" ? (sc.ready.find(r => r.id === b.dataset.id) || {}).sp : b.dataset.sp, s = SPECIES_BY_ID[sp], w = s && mixWarning(s, it);
    if(w){ askConfirm(`Predator and prey`, w, "Yes, mix them", () => { b.dataset.sureMix = "1"; b.click(); }); return; }
  }
  if(a === "moat"){ const c = moatCost(it); if(canAfford(c)){ spend(c, "built"); it.moat = true; done(); } return; }
  if(a === "aviary"){ const c = aviaryCost(it); if(canAfford(c)){ spend(c, "built"); it.aviary = true; done(); } return; }
  if(a === "net"){ const c = netCost(it); if(canAfford(c)){ spend(c, "built"); it.net = true; done(); } return; }
  if(a === "netOff"){ it.net = false; done(); return; }
  if(a === "aviaryOff"){ it.aviary = false; done(); return; }
  if(a === "platformTool"){ setTool("platform"); return; }
  if(a === "paintTool"){ setTool("paint"); return; }
  if(a === "landTool"){ setTool("land-" + b.dataset.key); rockBiome = b.dataset.biome || null; return; }
  if(a === "rockShape"){ rockPick[b.dataset.type] = b.dataset.pic === "" ? null : +b.dataset.pic; setTool("land-" + b.dataset.type); rockBiome = landTabs.biome; ui.panel(); return; }
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
  if(a === "extab"){ exTabs.tab = b.dataset.k; ui.panel(); return; }
  if(a === "lbiome"){ landTabs.biome = b.dataset.k; ui.panel(); return; }
  if(a === "lperiod"){ landTabs.period = b.dataset.k; ui.panel(); return; }
  if(a === "waterTool"){ setTool("water"); return; }
  if(a === "hireSci"){ const why = hireScientist(b.dataset.k); if(why) ui.toast(why, "bad"); done(); return; }
  if(a === "clone"){ if(orderClone(b.dataset.sp, sel && sel.kind === "exhibit" ? sel.id : null, b.dataset.sex)) done(); return; }
  if(a === "place"){ if(placeReady(b.dataset.id, sel.id)) done(); return; }
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
panelEl.addEventListener("input", e => {
  const it = selItem();
  if(e.target.dataset.field === "name" && it){ it.name = e.target.value.slice(0, 40) || (sel.kind === "zone" ? "Zone" : "Exhibit"); render(); $("#sheetToggle").textContent = it.name; saveSoon(); }
});
$("#sheetToggle").onclick = () => aside.classList.toggle("open");

// Setting what a food tray holds: changing it empties the tray
panelEl.addEventListener("change", ev => {
  const id = ev.target.dataset && ev.target.dataset.tray; if(!id) return;
  const e = selItem(), f = e && landOf(e).find(x => x.id === id); if(!f) return;
  f.set = ev.target.value || null; f.food = {};
  ui.panel();
});

// A yes/no question inside the page
function askConfirm(title, text, yes, onYes, no = "Cancel"){
  const d = $("#dlgConfirm");
  $("#confirmTitle").textContent = title; $("#confirmText").textContent = text; $("#confirmYes").textContent = yes; $("#confirmNo").textContent = no;
  $("#confirmYes").onclick = () => { d.close(); onYes(); };
  $("#confirmNo").onclick = () => d.close();
  d.showModal();
}

/* ---------- Paleopedia ---------- */

// Where a species stands: can you get it now, is it on its way, or not started yet?
function speciesStatus(s){
  const sc = state.science, d = sc.dna[s.id];
  const lock = state.rating + 1e-9 < starsNeed(s) ? `Needs ${starsNeed(s)}★. You have ${starTxt(state.rating)}.` : "";
  if(isStarter(s)) return {group:lock ? "progress" : "now", cls:"ok", how:`Sold by partner parks for ${money(s.price)}.`, lock};
  if(cloneOpen(s.id)) return {group:lock ? "progress" : "now", cls:"ok", how:`Genome ${d.genome}% complete. Clone at TAR for ${money(s.price)}${d.genome < 100 ? `, though clones are only ${cloneQuality(s.id)}% DNA quality until it is whole` : ""}.`, lock};
  if(sc.trips.some(t => t.sp === s.id)) return {group:"progress", cls:"wait", how:`A GHOST drone is out finding it now. Genome ${d ? d.genome : 0}%.`, lock};
  if(d) return {group:"progress", cls:"wait", how:`Genome ${d.genome}% complete. TAR needs ${CLONE_GENOME.min}% to clone it. Send a GHOST expedition for more.`, lock};
  const where = sitesOf(s.id).filter(siteShown).map(x => isScouted(x.id) ? x.name : `an unscouted ${sitePeriod(x)} site`);
  if(isUnlocked(s.id)) return {group:"progress", cls:"wait", how:`Discovered. Send a GHOST expedition to ${where[0] || "its site"} to collect its DNA.`, lock};
  return {group:"locked", cls:"no", how:`Not discovered yet. GHOST's drones can scout for it ${where.length > 1 ? `at ${where.length} sites` : "at one site"} in the ${s.period}.`, lock};
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
    + row("Period", `${s.period} (${per.ago})`) + row("Diet", dietText(s)) + row("Biome", biomesOf(s) ? biomeNames(s) : "any")
    + row("Size", I.ft ? `${I.ft} ft long` : "?") + row("Activity", TRAIT_TEXT[t.active]) + row("Space", `${s.space.toLocaleString()} m²`)
    + row("Social", TRAIT_TEXT[t.social]) + row("Personality", TRAIT_TEXT[t.temper]) + row("Group size", s.group[0] === s.group[1] ? s.group[0] : `${s.group[0]}–${s.group[1]}`)
    + row("Appeal", `<span title="Appeal ${s.appeal}">${"★".repeat(stars)}${"☆".repeat(5 - stars)}</span>`)
    + `</dl></div><div class="pp-right"><h3>${esc(s.name)}</h3><i class="pp-sci">${esc(I.sci || "")}</i>`
    + `<p class="pp-desc">${I.desc ? esc(I.desc) : "No notes on this animal yet."}</p></div>`
    + `<div class="pp-acq"><span class="how ${st.cls}">${esc(st.how)}</span>${st.lock ? ` <span class="lock">${esc(st.lock)}</span>` : ""}${n ? ` <span class="have">${n} in your park.</span>` : ""}</div></div>`;
}

function catalogHtml(){
  const order = ["Devonian", "Carboniferous", "Permian", "Triassic", "Jurassic", "Cretaceous", "Paleogene", "Neogene", "Quaternary"];
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
