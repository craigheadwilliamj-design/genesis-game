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
    set("inpark", inPark.length.toLocaleString());
    set("clock", fmtClock(state.minute));
    set("dayLabel", `Day ${state.day}`);
    set("parkName", state.name);
    $("#dayFill").style.width = ((state.minute - OPEN_MIN) / (CLOSE_MIN - OPEN_MIN) * 100).toFixed(1) + "%";
    const r = Math.round(state.rating * 2) / 2;
    if(force || this.hudCache.rating !== r){ this.hudCache.rating = r; $("#rating").innerHTML = starsSvg(state.rating, 16); $("#rating").setAttribute("aria-label", `${r} stars`); }
  },

  panel(){
    const it = selItem();
    if(sel && !it) sel = null;
    let h;
    if(!sel) h = overviewHtml();
    else if(sel.kind === "exhibit") h = exhibitHtml(it);
    else if(sel.kind === "building") h = buildingHtml(it);
    else h = pathHtml(it);
    // keep the scroll spot and the typing cursor when the panel redraws
    const sc = aside.scrollTop, focusId = document.activeElement && panelEl.contains(document.activeElement) ? document.activeElement.id : null;
    panelEl.innerHTML = h;
    aside.scrollTop = sc;
    if(focusId){ const f = document.getElementById(focusId); if(f) f.focus(); }
    $("#sheetToggle").textContent = it ? (it.name || BUILDINGS[it.type]?.label || "Path") : "Park office";
  },

  toast(text, kind, html){
    const el = document.createElement("div");
    el.className = "toast " + (kind || "");
    if(html) el.innerHTML = html; else el.textContent = text;
    const box = $("#toasts");
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
function overviewHtml(){
  const d = derived, t = state.today, goal = currentGoal();
  const idx = goal ? GOALS.indexOf(goal) + 1 : GOALS.length;
  let h = `<h2>${esc(state.name)}</h2>`;

  if(goal){
    h += `<div class="card goal"><div class="step">Goal ${idx} of ${GOALS.length}</div><b>${esc(goal.text)}</b><div class="meta">${esc(goal.hint)}</div><div class="reward">Reward ${money(goal.reward)}</div></div>`;
  } else {
    h += `<div class="card goal"><div class="step">All goals done</div><b>Keep growing your park</b><div class="meta">Try for 5 stars, or see how many guests you can bring in.</div></div>`;
  }

  const c = dailyCosts();
  const inc = t.tickets + t.food + t.shop;
  h += `<section><h3>Today so far</h3><dl class="kv">
    <dt>Guests</dt><dd>${t.guests.toLocaleString()}</dd>
    <dt>Tickets</dt><dd>${money(t.tickets)}</dd>
    <dt>Food and gifts</dt><dd>${money(t.food + t.shop)}</dd>
    <dt>Built and bought</dt><dd>${t.built + t.animals ? "−" + money(t.built + t.animals) : money(0)}</dd>
    ${t.science ? `<dt>Expeditions</dt><dd>−${money(t.science)}</dd>` : ""}
    <dt class="sum">Bills at closing</dt><dd class="sum">−${money(c.feed + c.wages + c.upkeep + c.research)}</dd>
  </dl><div class="meta" style="margin-top:4px">Animal food ${money(c.feed)}, keepers ${money(c.wages)}, upkeep ${money(c.upkeep)}${c.research ? `, research ${money(c.research)}` : ""}.</div></section>`;

  // science at a glance
  const sc = state.science;
  if(["oracle", "ghost", "tar"].some(hasDept)){
    const line = (type, text) => { const b = state.buildings.find(x => x.type === type); return b ? `<li><button class="btn" data-action="gotoDept" data-t="${type}" style="padding:3px 9px">${BUILDINGS[type].label}</button><span>${text}</span></li>` : ""; };
    h += `<section><h3>Science</h3><ul class="deptlist">
      ${line("oracle", `${sc.points} research points. ${sc.unlocked.length} of ${TIME_PERIODS.length} periods unlocked.`)}
      ${line("ghost", sc.trips.length ? `${sc.trips.length} of ${sc.crew.temporal} teams out. Next back day ${Math.min(...sc.trips.map(t => t.back))}.` : `${sc.crew.temporal} team${sc.crew.temporal === 1 ? "" : "s"} home and ready.`)}
      ${line("tar", sc.clones.length ? `${sc.clones.length} clone${sc.clones.length === 1 ? "" : "s"} growing. Next ready day ${sc.clones[0].done}.` : sc.ready.length ? `${sc.ready.length} clone${sc.ready.length === 1 ? "" : "s"} waiting for an exhibit.` : "Incubators empty.")}
    </ul></section>`;
  }

  const expected = Math.round(d.demand);
  h += `<section><h3>Ticket price</h3><div class="ticket"><button data-action="ticket" data-d="-1" aria-label="Lower the price">−</button><output id="ticketOut">${money(state.ticket)}</output><button data-action="ticket" data-d="1" aria-label="Raise the price">+</button></div>
    <div class="meta" style="margin-top:6px">Guests think about ${money(Math.round(d.fair))} is fair at your rating. ${state.ticket > d.fair * 1.3 ? "At this price fewer come, and the ones who do complain." : state.ticket < d.fair * .7 ? "Cheap tickets bring more guests but less money each." : ""} Right now you can expect about <b>${expected.toLocaleString()}</b> guests a day.</div></section>`;

  h += `<section><h3>Rating ${starsSvg(state.rating, 15)} <span class="num">${state.rating.toFixed(1)}</span></h3>`;
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
    h += `<section><h3>Recent days</h3><table class="hist"><thead><tr><th>Day</th><th>Guests</th><th>Earned</th><th>Profit</th></tr></thead><tbody>${rows.map(r => `<tr><td>${r.day}</td><td>${r.guests.toLocaleString()}</td><td>${money(r.income)}</td><td class="${r.net >= 0 ? "pos" : "neg"}">${r.net >= 0 ? "+" : ""}${money(r.net)}</td></tr>`).join("")}</tbody></table></section>`;
  }

  h += `<section><h3>Goals</h3><ul class="checklist">${GOALS.map(g => { const done = state.goalsDone.includes(g.id), now = goal && g.id === goal.id; return `<li><span>${done ? "✓" : now ? "›" : ""}</span><span class="${done ? "done" : now ? "now" : ""}">${esc(g.text)}</span><span class="r">${money(g.reward)}</span></li>`; }).join("")}</ul></section>`;
  return h;
}

/* ---------- an exhibit ---------- */
function exhibitHtml(e){
  const rep = derived.reports[e.id] || exhibitReport(e), reach = isReachable(e);
  let h = `<button class="back" data-action="deselect">‹ Park office</button>`;
  h += `<label class="field"><span>Exhibit name</span><input id="exName" data-field="name" value="${esc(e.name)}" maxlength="40"></label>`;
  h += `<div class="row"><span class="status ${reach ? "ok" : "no"}">${reach ? "Guests can see it" : "No path reaches it"}</span><span class="meta">${e.viv ? VIVARIUMS[e.viv].label + ", " : ""}${fmtArea(rep.area)}</span></div>`;
  if(e.viv) h += `<div class="meta">Fits ${SPECIES.filter(s => fitsHabitat(s, e)).map(s => esc(s.name)).join(", ")}.</div>`;
  if(!reach) h += `<div class="meta">Draw a path from the entrance (or another connected path) up to this exhibit's fence.</div>`;

  const n = e.animals.length;
  if(n){
    const trend = rep.target - e.happy;
    h += `<section><h3>Happiness</h3><div class="factor" style="grid-template-columns:1fr 48px"><span>${meter(e.happy, happyColor(e.happy))}</span><span>${Math.round(e.happy)}%</span></div>
      <div class="meta" style="margin-top:4px">${Math.abs(trend) < 2 ? "Holding steady." : trend > 0 ? `Rising toward ${Math.round(rep.target)}%.` : `Falling toward ${Math.round(rep.target)}%.`}</div>`;
    if(rep.issues.length) h += `<ul class="issues" style="margin-top:8px">${rep.issues.map(i => `<li class="${i.bad ? "bad" : ""}">${esc(i.text)}</li>`).join("")}</ul>`;
    h += `</section>`;
    h += `<section><h3>Animals here</h3><ul class="herd">${[...rep.counts].map(([sp, c]) => { const s = SPECIES_BY_ID[sp]; return `<li><span class="dot" style="background:${PERIOD_COLOR[s.period]}"></span><span>${esc(s.name)} × ${c}</span><span class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn sell" data-action="moveDlg" data-sp="${sp}">Move</button><button class="btn sell" data-action="sell" data-sp="${sp}">Sell +${money(s.price * COST.animalResale)}</button></span></li>`; }).join("")}</ul>
      ${movesHtml(e)}
      <div class="meta" style="margin-top:6px">Room used: ${fmtArea(rep.need)} of ${fmtArea(rep.area)}.</div></section>`;
  }

  // barriers, moats, and aviary netting
  if(!e.viv){
    const cur = e.barrier || "wood";
    h += `<section><h3>Barrier</h3><label class="field"><span>Wall type</span><select id="barrierSel" data-action-change="barrier">${Object.entries(BARRIERS).map(([key, b]) => {
      const locked = b.tech && !hasTech(b.tech), cost = key === cur ? 0 : upgradeCost(e, key);
      return `<option value="${key}"${key === cur ? " selected" : ""}${locked ? " disabled" : ""}>${b.label}, strength ${b.strength}${locked ? " (research at ORACLE)" : key === cur ? " (current)" : cost ? `, ${money(cost)}` : ", free"}</option>`;
    }).join("")}</select></label>`;
    if(cur === "electric") h += `<div class="row" style="margin-top:6px"><span class="status ${e.powered === false ? "no" : "ok"}">${e.powered === false ? "No power" : "Powered"}</span><span class="meta">Draws ${Math.round(fenceDraw(e))} kW. Park supply ${Math.round(powerSupply())} of ${Math.round(powerDemand())} kW needed.${generators().length ? "" : " Build a generator."}</span></div>`;
    const kc = knownCond(e), since = daysSinceInspect(e);
    h += `<div class="factor" style="grid-template-columns:80px 1fr 44px;margin-top:8px"><span>Condition</span>${meter(kc, kc >= 60 ? "var(--good)" : kc >= 30 ? "var(--warn)" : "var(--bad)")}<span>${Math.round(kc)}%</span></div>`;
    h += `<div class="meta">${isBreached(e) ? "<b style='color:var(--bad)'>Broken.</b> Animals can walk out until a mechanic repairs it. " : ""}${since >= 99 ? "Never inspected." : since === 0 ? "Inspected today." : `Last inspected ${since} day${since === 1 ? "" : "s"} ago${since >= MAINT.inspectEvery ? ", overdue" : ""}.`} Wears about ${wearPerDay(e).toFixed(1)}% a day${wearPerDay(e) > barrierOf(e).wear + .01 ? ", partly from animals attacking it" : ""}.</div>`;
    h += `<div class="meta" style="margin-top:4px">${cur === "concrete" ? "Concrete hides the animals, so guests enjoy this exhibit much less. A viewing platform fixes that." : cur === "acrylic" ? "Guests love seeing through acrylic." : ""} Changing walls has no refund.</div>`;
    h += `<div class="row" style="margin-top:8px">`;
    h += e.moat ? `<span class="status ok">Moat: nothing gets out</span>` : hasTech("moat") ? `<button class="btn" data-action="moat"${canAfford(moatCost(e)) ? "" : " disabled"}>Dig a moat, ${money(moatCost(e))}</button>` : `<span class="meta">Moats: research at ORACLE</span>`;
    h += e.aviary ? `<button class="btn" data-action="aviaryOff">Remove aviary netting</button>` : hasTech("aviary") ? `<button class="btn" data-action="aviary"${canAfford(aviaryCost(e)) ? "" : " disabled"}>Add aviary netting, ${money(aviaryCost(e))}</button>` : `<span class="meta">Aviary netting: research at ORACLE</span>`;
    h += `</div>`;
    const plats = state.buildings.filter(b => b.type === "platform" && b.exhibitId === e.id).length;
    h += `<div class="meta" style="margin-top:6px">${plats ? `${plats} viewing platform${plats === 1 ? "" : "s"}. ` : ""}Guests see in at ${Math.round(viewFactor(e, derived.reach) * 100)}%.${hasTech("platform") ? ` <button class="btn" data-action="platformTool" style="padding:3px 9px">Add a viewing platform</button>` : ""}</div>`;
    h += `</section>`;
  }

  // what the exhibit is planted with
  {
    const fl = e.flora || "cenozoic", hasCeres = hasDept("ceres"), a = e.viv ? area(e.points) : rep.area;
    const eras = [...new Set(e.animals.map(x => ERA_OF[SPECIES_BY_ID[x.sp].period]))];
    h += `<section><h3>Plants</h3><label class="field"><span>Flora</span><select id="floraSel">${Object.entries(FLORA).map(([k, f]) => {
      const noTech = f.tech && !hasTech(f.tech), locked = k !== "cenozoic" && (!hasCeres || noTech), cost = k === fl ? 0 : Math.round(a * f.perSqM);
      return `<option value="${k}"${k === fl ? " selected" : ""}${locked ? " disabled" : ""}>${f.label}: ${f.plants}${k === fl ? " (current)" : noTech ? " (research at ORACLE)" : locked ? " (needs CERES)" : cost ? `, ${money(cost)}` : ", free"}</option>`;
    }).join("")}</select></label>`;
    h += `<div class="meta" style="margin-top:4px">${eras.length ? `Animals here come from the ${eras.map(x => FLORA[x].label).join(" and ")}. ` : ""}${hasCeres ? "CERES grows the plants once ORACLE has researched them. Replanting has no refund." : "Build CERES and research the plantings at ORACLE to plant Mesozoic or Paleozoic flora."}</div></section>`;
  }

  // food and keeper access
  const g = gateCheck(e), need = dailyNeed(e);
  h += `<section><h3>Keepers and food</h3><div class="row"><span class="status ${g.ok ? "ok" : "no"}">${g.ok ? (e.viv ? "Keepers can reach it" : "Keeper gate works") : "Keepers can't get in"}</span></div><div class="meta" style="margin-top:4px">${esc(g.text)}</div>`;
  if(!e.viv) h += `<div class="row" style="margin-top:6px"><button class="btn" data-action="gateTool">${e.gate ? "Move the gate" : "Place a gate"}</button></div>`;
  if(n){
    const dirt = e.dirt || 0;
    h += `<div class="factor" style="grid-template-columns:70px 1fr 74px;margin-top:8px"><span>Dirt</span>${meter(dirt, dirt < CLEAN.dirtyAt ? "var(--good)" : dirt < 60 ? "var(--warn)" : "var(--bad)")}<span>${Math.round(dirt)}%</span></div>`;
    h += `<div class="meta">Gets about ${dirtPerDay(e).toFixed(0)}% dirtier a day. ${!hasUpgrade("shovels") ? "<b style='color:var(--bad)'>Keepers need shovels from the Tool Shed to clean.</b>" : `Keepers clean it at ${CLEAN.dirtyAt}%, taking about ${Math.round(60 / cleanRate(e))} minutes per 60% of dirt${hasUpgrade("hoses") ? " with hoses" : " by hand"}.`}</div>`;
    h += `<div style="margin-top:8px">${Object.keys(need).map(t => { const st = stockFor(e, t), mx = storeMax(e, t), hay = t === "paleoflora" && ((e.stock || {}).paleoflora || 0) < st - .01; return `<div class="factor" style="grid-template-columns:70px 1fr 74px"><span style="text-transform:capitalize" title="${hay ? "Partly grass hay standing in for Paleoflora" : ""}">${t}${hay ? "*" : ""}</span>${meter(st / Math.max(1, mx) * 100, FOOD_COLOR[t])}<span>${Math.round(st)}/${mx}</span></div>`; }).join("")}</div>`;
    h += `<div class="meta" style="margin-top:4px">They eat ${Object.entries(need).map(([t, u]) => `${u} ${t}`).join(" and ")} a day.${freeFeeding() ? ` Partner parks feed them until day ${state.staff.feedFrom}.` : ""}</div>`;
  }
  h += `</section>`;

  const sc = state.science;

  // finished clones waiting for a home
  if(sc.ready.length){
    h += `<section><h3>Waiting at TAR</h3><ul class="herd">${sc.ready.map(r => { const s = SPECIES_BY_ID[r.sp]; return `<li><span class="dot" style="background:${PERIOD_COLOR[s.period]}"></span><span>${esc(s.name)} <span class="meta">${r.q}% DNA</span></span><button class="btn sell" data-action="place" data-id="${r.id}">Move in here</button></li>`; }).join("")}</ul></section>`;
  }

  // cloning: species with a complete genome
  const ready = SPECIES.filter(s => sc.dna[s.id] && sc.dna[s.id].genome >= 100 && fitsHabitat(s, e));
  const coming = sc.clones.filter(c => c.exhibitId === e.id);
  h += `<section><h3>Clone at TAR</h3>`;
  if(coming.length) h += `<div class="meta" style="margin-bottom:8px">Growing for this exhibit: ${coming.map(c => `${esc(SPECIES_BY_ID[c.sp].name)} (day ${c.done})`).join(", ")}.</div>`;
  if(!ready.length){
    h += `<div class="meta">${!hasDept("oracle") ? "Most animals come from the past. Build ORACLE to research time periods, GHOST to collect DNA, and TAR to clone."
      : `No complete genomes for ${e.viv ? "vivarium animals that fit here" : "open-habitat animals"} yet. Send GHOST on expeditions from ORACLE's panel until a species reaches 100%.`}</div>`;
  } else {
    h += `<ul class="shop">${ready.map(s => animalCard(s, rep, "clone")).join("")}</ul>`;
  }
  h += `</section>`;

  // starter animals from partner parks
  const forSale = SPECIES.filter(s => s.shop && fitsHabitat(s, e));
  h += `<section><h3>Buy from partner parks</h3>${forSale.length ? `<ul class="shop">${forSale.map(s => animalCard(s, rep, "buy")).join("")}</ul>` : `<div class="meta">Partner parks don't sell anything that fits ${e.viv ? "this vivarium" : "an open habitat"}. ${e.viv ? "Arthropleura needs a large vivarium." : ""}</div>`}</section>`;
  h += `<div class="row"><button class="btn" data-action="center">Center on map</button><button class="btn danger" data-action="demolish">Bulldoze exhibit</button></div>`;
  return h;
}

// Moves waiting on keepers, into or out of this exhibit
function movesHtml(e){
  const ts = state.staff.transfers.filter(t => t.from === e.id || t.to === e.id);
  if(!ts.length) return "";
  const name = id => (state.exhibits.find(x => x.id === id) || {name:"a removed exhibit"}).name;
  return `<div class="meta" style="margin-top:6px">Waiting for keepers: ${ts.map(t => `${esc(SPECIES_BY_ID[t.sp].name)} ${t.from === e.id ? `to ${esc(name(t.to))}` : `from ${esc(name(t.from))}`}${t.keeper ? " (on the way)" : ""}`).join(", ")}. <button class="btn" data-action="cancelMoves" style="padding:2px 8px">Cancel waiting moves</button></div>`;
}

// The move dialog: where to, and how many
function openMoveDialog(e, sp){
  const s = SPECIES_BY_ID[sp], have = e.animals.filter(a => a.sp === sp).length;
  const dests = state.exhibits.filter(x => x !== e && fitsHabitat(s, x));
  $("#moveTitle").textContent = `Move ${s.name}`;
  if(!dests.length){ $("#moveBody").innerHTML = `<p>No other exhibit can hold a ${esc(s.name)}. ${s.viv ? `It needs a ${VIVARIUMS[s.viv].label.toLowerCase()} or bigger.` : "Build another exhibit first."}</p>`; $("#moveGo").hidden = true; $("#dlgMove").showModal(); return; }
  const fromWhy = moveProblem(e);
  $("#moveBody").innerHTML = `<label class="field"><span>To</span><select id="moveTo">${dests.map(x => { const why = moveProblem(x); return `<option value="${x.id}">${esc(x.name)}${why ? " (keepers can't get in)" : ""}${isFlyer(s) && !x.viv && !x.aviary ? " (no aviary netting)" : ""}</option>`; }).join("")}</select></label>
    <label class="field" style="margin-top:10px"><span>How many (you have ${have})</span><input id="moveCount" type="number" min="1" max="${have}" value="${have}"></label>
    <p style="margin-top:10px">A keeper collects each one through this exhibit's gate and carries it to the new one. Both need a working keeper gate, or be a vivarium.</p>
    ${fromWhy ? `<p style="color:var(--bad)">Keepers can't get into ${esc(e.name)} yet: ${esc(fromWhy)}</p>` : ""}`;
  $("#moveGo").hidden = false;
  $("#moveGo").onclick = () => {
    const to = state.exhibits.find(x => x.id === $("#moveTo").value), n = clamp(parseInt($("#moveCount").value, 10) || 1, 1, have);
    const go = () => { $("#dlgMove").close(); const made = requestMove(e, sp, to, n); ui.toast(`${made} ${s.name} will be moved to ${to.name} by the next free keeper.${state.staff.keepers.length ? "" : " Hire a keeper first."}`); ui.panel(); saveSoon(); };
    if(isFlyer(s) && !to.viv && !to.aviary){ $("#dlgMove").close(); askConfirm(`${s.name} can fly`, `${to.name} has no aviary netting, so the ${s.name} will fly out almost right away. Move it there anyway?`, "Yes, move it", go); }
    else go();
  };
  $("#dlgMove").showModal();
}
$("#moveCancel").onclick = () => $("#dlgMove").close();

// A species name with its [V] tag if it lives in a vivarium
function speciesName(s){ return esc(s.name) + (s.viv ? ` <span class="vtag" title="Lives in a ${VIVARIUMS[s.viv].label.toLowerCase()} or bigger">V</span>` : ""); }
const habitatText = s => s.viv ? `Lives in a ${VIVARIUMS[s.viv].label.toLowerCase()} or bigger. ` : "";

// One animal in a buy or clone list, with warnings about fit and fighting
function animalCard(s, rep, mode){
  const free = rep.area - rep.need;
  const locked = state.rating + 1e-9 < s.stars;
  let warn = "";
  for(const sp of rep.counts.keys()){ const w = conflict(s, SPECIES_BY_ID[sp]); if(w){ warn = w; break; } }
  const have = rep.counts.get(s.id) || 0, fits = Math.floor(free / s.space);
  const fitText = fits > 0 ? `Room for ${fits} more.` : "";
  const fitLine = warn ? `<span class="warn">${esc(warn)}</span>` : fits <= 0 ? `<span class="warn">No room left for one of these.</span>`
    : have === 0 && s.group[0] > 1 ? `<span class="need">${fitText} Get at least ${s.group[0]} so they aren't lonely.</span>` : `<span class="fit">${fitText}</span>`;
  let h = `<li class="${locked ? "locked" : ""}"><span class="nm"><span class="dot" style="background:${PERIOD_COLOR[s.period]}"></span>${speciesName(s)} <span class="per">${s.period}</span></span>`;
  if(locked) h += `<span class="meta">Needs ${s.stars}★ (you have ${state.rating.toFixed(1)})</span>`;
  else if(mode === "clone"){
    const why = cloneProblem(s.id);
    h += `<button class="buy" data-action="clone" data-sp="${s.id}"${why ? ` disabled title="${esc(why)}"` : ""}>Clone ${money(s.price)}</button>`;
  } else h += `<button class="buy" data-action="buy" data-sp="${s.id}"${canAfford(s.price) ? "" : " disabled"}>${money(s.price)}</button>`;
  h += `<span class="need">${habitatText(s)}${s.space.toLocaleString()} m² each, groups of ${s.group[0]}–${s.group[1]}, ${money(s.food)} a day to feed. ${dietText(s)}.`;
  if(mode === "clone") h += ` DNA quality ${state.science.dna[s.id].quality}%. Ready day ${cloneReadyDay(s.id)}.`;
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

// Hiring science staff at a department: count, pay, and hire/let go buttons
function sciStaffHtml(kind){
  const k = SCIENTISTS[kind], n = state.science.crew[kind];
  return `<section><h3>${k.plural} (${n})</h3><div class="meta">${esc(k.text)} ${money(k.wage)} a day each.</div>
    <div class="row" style="margin-top:8px"><button class="btn" data-action="hireSci" data-k="${kind}"${canAfford(k.hireCost) ? "" : " disabled"}>Hire a ${k.label.toLowerCase()}, ${money(k.hireCost)}</button>${n ? `<button class="btn" data-action="fireSci" data-k="${kind}">Let one go</button>` : ""}</div></section>`;
}

let oracleTab = null;   // which period's tab is open in ORACLE
const PERIOD_ORDER = ["Carboniferous", "Permian", "Triassic", "Jurassic", "Cretaceous", "Paleogene", "Neogene", "Quaternary"];

function oracleHtml(b){
  const sc = state.science;
  let h = deptHead(b);
  h += `<section><h3>Research</h3><div class="card"><b class="num" style="font:600 26px/1 'Barlow Condensed',sans-serif">${sc.points}</b> <span class="meta">research points. +${sc.crew.paleo * RESEARCH_PER_PALEO} each night from your paleontologists.</span></div></section>`;
  h += sciStaffHtml("paleo");

  // barriers and facilities
  h += `<section><h3>Barriers and facilities</h3><ul class="shop">${TECH.map(t => {
    const own = hasTech(t.id), short = sc.points < t.points, prereq = t.needs && !hasTech(t.needs);
    return `<li class="${prereq ? "locked" : ""}"><span class="nm">${esc(t.label)}</span>${own ? `<span class="status ok">Researched</span>` : `<button class="buy" data-action="research" data-id="${t.id}"${short || prereq || deptProblem("oracle") ? " disabled" : ""}>${t.points} points</button>`}<span class="need">${esc(t.text)}${prereq ? ` Needs ${esc(TECH.find(x => x.id === t.needs).label)} first.` : ""}</span></li>`;
  }).join("")}</ul></section>`;

  // one tab per period; locked ones show a lock
  if(!oracleTab) oracleTab = PERIOD_ORDER.find(id => sc.unlocked.includes(id)) || "Quaternary";
  h += `<section><h3>Time periods</h3><div class="ptabs" role="tablist">${PERIOD_ORDER.map(id => {
    const open = sc.unlocked.includes(id);
    return `<button role="tab" class="ptab" data-action="ptab" data-p="${id}" aria-selected="${id === oracleTab}" style="--pc:${PERIOD_COLOR[id]}">${open ? "" : `<svg width="10" height="11" viewBox="0 0 10 11" aria-label="locked"><rect x="1" y="5" width="8" height="6" rx="1" fill="currentColor"/><path d="M3 5V3.5a2 2 0 0 1 4 0V5" stroke="currentColor" stroke-width="1.4" fill="none"/></svg>`}${id}</button>`;
  }).join("")}</div>`;

  const p = PERIOD_BY_ID[oracleTab], open = sc.unlocked.includes(p.id), list = SPECIES.filter(s => s.period === p.id && !s.shop);
  h += `<div class="ptab-body"><div class="meta">${p.ago}. Trips cost ${money(p.trip)}, take ${p.days} days, fail ${Math.round(p.risk*100)}% of the time, and bring back DNA of ${p.quality[0]}–${p.quality[1]}% quality.</div>`;
  if(!open){
    const why = unlockProblem(p.id);
    h += `<div class="row" style="margin:10px 0"><button class="buy" data-action="unlock" data-p="${p.id}"${why ? " disabled" : ""}>Unlock the ${p.id}: ${p.research} points</button></div>`;
    if(why) h += `<div class="meta" style="color:var(--bad)">${esc(why)}</div>`;
  } else {
    const why = tripProblem(p.id);
    if(why) h += `<div class="meta" style="color:var(--bad);margin-top:8px">${esc(why)}</div>`;
  }
  h += `<ul class="shop" style="margin-top:10px">`;
  for(const s of list){
    const d = sc.dna[s.id], out = sc.trips.filter(t => t.sp === s.id).length;
    h += `<li><span class="nm"><span class="dot" style="background:${PERIOD_COLOR[p.id]}"></span>${speciesName(s)}</span>`;
    h += open ? `<button class="buy" data-action="trip" data-p="${p.id}" data-sp="${s.id}"${tripProblem(p.id) ? " disabled" : ""}>Send GHOST</button>` : `<span class="meta">Locked</span>`;
    h += `<span class="need" style="grid-column:1/-1">${dnaBar(d)}${d ? `Quality ${d.quality}%.${d.genome >= 100 ? " Complete. More trips can raise quality." : ""}` : "No DNA yet."}${out ? ` <b>${out} team${out === 1 ? "" : "s"} out looking for it.</b>` : ""} ${s.stars ? `Needs ${s.stars}★ to clone.` : ""}</span></li>`;
  }
  h += `</ul></div></section>`;
  if(sc.log.length) h += `<section><h3>Recent expeditions</h3><ul class="issues">${sc.log.map(l => `<li class="${l.ok ? "" : "bad"}">Day ${l.day}. ${esc(l.text)}</li>`).join("")}</ul></section>`;
  return h;
}

function ghostHtml(b){
  const sc = state.science;
  let h = deptHead(b);
  h += `<div class="meta">${esc(BUILDINGS.ghost.blurb)} Expeditions are requested from ORACLE.</div>`;
  h += sciStaffHtml("temporal");
  h += `<section><h3>In the field (${sc.trips.length} of ${sc.crew.temporal} teams)</h3>`;
  if(sc.trips.length) h += sc.trips.map(t => {
    const p = PERIOD_BY_ID[t.period], left = t.back - state.day;
    return `<div class="card" style="margin-bottom:6px"><b>${t.period}</b>, looking for ${esc(SPECIES_BY_ID[t.sp].name)}.<div style="margin-top:6px">${meter((p.days - left - (state.minute - OPEN_MIN)/(CLOSE_MIN - OPEN_MIN)) / p.days * 100, "var(--gold)")}</div><div class="meta" style="margin-top:4px">Back after closing on day ${t.back}.</div></div>`;
  }).join("");
  else h += `<div class="meta">Every team is home.</div>`;
  h += `</section>`;
  if(hasDept("oracle")) h += `<div class="row"><button class="btn" data-action="gotoDept" data-t="oracle">Open ORACLE</button></div>`;
  if(sc.log.length) h += `<section><h3>Recent expeditions</h3><ul class="issues">${sc.log.map(l => `<li class="${l.ok ? "" : "bad"}">Day ${l.day}. ${esc(l.text)}</li>`).join("")}</ul></section>`;
  return h;
}

function tarHtml(b){
  const sc = state.science;
  let h = deptHead(b);
  h += `<div class="meta">A complete genome can be cloned as many times as you like. Clone quality follows the DNA quality: under 70% makes sickly animals, under 50% frail ones.</div>`;
  h += sciStaffHtml("gene");
  h += `<section><h3>Incubators (${sc.crew.gene})</h3>`;
  if(sc.clones.length) h += `<ul class="herd">${[...sc.clones].sort((a, b) => a.done - b.done).map(c => { const s = SPECIES_BY_ID[c.sp], e = state.exhibits.find(x => x.id === c.exhibitId); return `<li><span class="dot" style="background:${PERIOD_COLOR[s.period]}"></span><span>${esc(s.name)} <span class="meta">for ${e ? esc(e.name) : "no exhibit yet"}</span></span><span class="meta">Day ${c.done}</span></li>`; }).join("")}</ul><div class="meta" style="margin-top:6px">Each geneticist grows one clone at a time.</div>`;
  else h += `<div class="meta">Empty. Order clones here or from an exhibit's panel.</div>`;
  h += `</section>`;
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
      h += `<span class="need" style="grid-column:1/-1">${dnaBar(d)}Quality ${d.quality}%. ${d.genome >= 100 ? `Takes ${cloneDays(s.id)} day${cloneDays(s.id) === 1 ? "" : "s"}.` : ""}${d.genome >= 100 && state.rating + 1e-9 < s.stars ? ` Needs ${s.stars}★.` : ""}</span></li>`;
    }
    h += `</ul>`;
  }
  h += `</section>`;
  return h;
}

function stationHtml(b){
  let h = deptHead(b);
  h += `<div class="meta">${esc(BUILDINGS.station.blurb)} Keepers carry ${Math.round(carryMax())} food units of one type at a time.</div>`;
  const ks = state.staff.keepers;
  h += `<section><h3>Keepers (${ks.length})</h3>`;
  if(ks.length) h += `<ul class="herd">${ks.map(k => `<li><span class="dot" style="background:#2E6B3A"></span><span><b>${esc(k.name)}</b>${(crew.find(c => c.id === k.id) || {}).atv ? ' <span class="vtag" style="background:#4F6273;color:#fff;border-color:#4F6273">ATV</span>' : ""} <span class="meta">${esc(keeperStatus(k))}</span>${meter(k.stamina, k.stamina > 50 ? "var(--good)" : k.stamina > 25 ? "var(--warn)" : "var(--bad)")}</span><button class="btn sell" data-action="fire" data-id="${k.id}">Let go</button></li>`).join("")}</ul>`;
  else h += `<div class="meta">No keepers yet.</div>`;
  h += `<div class="row" style="margin-top:8px"><button class="btn" data-action="hire"${canAfford(KEEPER.hireCost) ? "" : " disabled"}>Hire a keeper, ${money(KEEPER.hireCost)}</button><span class="meta">${money(KEEPER.wage)} a day each</span></div></section>`;
  h += `<section><h3>Feeding</h3><div class="meta">${freeFeeding() ? `Partner parks are feeding your animals until day ${state.staff.feedFrom}.` : "Your keepers are feeding the animals."} Exhibits need a gate on a service road. Vivariums don't.</div>`;
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
  const ms = state.staff.mechanics;
  h += `<section><h3>Mechanics (${ms.length})</h3>`;
  h += ms.length ? `<ul class="herd">${ms.map(m => `<li><span class="dot" style="background:#C8642A"></span><span><b>${esc(m.name)}</b>${(mcrew.find(c => c.id === m.id) || {}).atv ? ' <span class="vtag" style="background:#4F6273;color:#fff;border-color:#4F6273">ATV</span>' : ""} <span class="meta">${esc(mechanicStatus(m))}</span></span><button class="btn sell" data-action="fireMech" data-id="${m.id}">Let go</button></li>`).join("")}</ul>` : `<div class="meta">No mechanics yet.</div>`;
  h += `<div class="row" style="margin-top:8px"><button class="btn" data-action="hireMech"${canAfford(MAINT.hireCost) ? "" : " disabled"}>Hire a mechanic, ${money(MAINT.hireCost)}</button><span class="meta">${money(MAINT.wage)} a day each</span></div></section>`;
  // every fence, worst first, as of its last inspection
  const fences = state.exhibits.filter(e => !e.viv).sort((a, b) => knownCond(a) - knownCond(b));
  if(fences.length){
    h += `<section><h3>Fences</h3>${fences.map(e => { const k = knownCond(e), d = daysSinceInspect(e); return `<div class="factor" style="grid-template-columns:1fr 70px 44px"><span>${esc(e.name)} <span class="meta">${isBreached(e) ? "broken" : d >= MAINT.inspectEvery ? `inspected ${d} days ago` : ""}</span></span>${meter(k, k >= 60 ? "var(--good)" : k >= 30 ? "var(--warn)" : "var(--bad)")}<span>${Math.round(k)}%</span></div>`; }).join("")}</section>`;
  }
  return h;
}

function generatorHtml(b){
  let h = deptHead(b);
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

function ceresHtml(b){
  let h = deptHead(b) + `<div class="meta">${esc(BUILDINGS.ceres.blurb)}</div>`;
  const pe = state.exhibits.filter(e => e.animals.some(a => foodType(SPECIES_BY_ID[a.sp]) === "paleoflora"));
  h += `<section><h3>Paleoflora</h3>`;
  if(!hasTech("paleoflora")) h += `<div class="meta" style="color:var(--bad)">Research Paleoflora at ORACLE before CERES can grow it. Until then, keepers feed prehistoric plant-eaters grass hay.</div>`;
  else {
    const st = state.ceres.stock, cap = ceresCap(), need = state.exhibits.reduce((s, e) => s + (dailyNeed(e).paleoflora || 0), 0);
    h += `<div class="factor" style="grid-template-columns:70px 1fr 74px"><span>In stock</span>${meter(st / cap * 100, FOOD_COLOR.paleoflora)}<span>${Math.floor(st)}/${Math.round(cap)}</span></div>`;
    h += `<dl class="kv" style="margin-top:6px"><dt>Grows</dt><dd>${ceresRate()} a day</dd><dt>Greenhouses</dt><dd>${greenhouses().length} (+${PALEOFLORA.greenhouse} a day each)</dd><dt>Your animals eat</dt><dd style="color:${need > ceresRate() ? "var(--bad)" : "inherit"}">${need} a day</dd></dl>`;
    if(need > ceresRate()) h += `<div class="meta" style="color:var(--bad)">CERES can't keep up. ${hasTech("greenhouse") ? "Build greenhouses." : "Research greenhouses at ORACLE."} When it runs dry, keepers bring grass hay instead.</div>`;
  }
  h += `<div class="meta" style="margin-top:6px">${isReachable(b) ? "" : "Connect CERES to a path or service road so keepers can collect Paleoflora. "}${pe.length} exhibit${pe.length === 1 ? "" : "s"} eat Paleoflora.</div></section>`;
  // exhibits whose plants don't suit their animals
  const mismatched = state.exhibits.filter(e => e.animals.length && e.animals.some(a => ERA_OF[SPECIES_BY_ID[a.sp].period] !== (e.flora || "cenozoic")));
  h += `<section><h3>Exhibits to replant</h3>${mismatched.length ? `<ul class="issues">${mismatched.map(e => { const eras = [...new Set(e.animals.map(a => FLORA[ERA_OF[SPECIES_BY_ID[a.sp].period]].label))]; return `<li class="bad">${esc(e.name)}: planted ${FLORA[e.flora || "cenozoic"].label}, animals want ${eras.join(" or ")}</li>`; }).join("")}</ul><div class="meta" style="margin-top:6px">Tap an exhibit and change its flora in the Plants section.</div>` : `<div class="meta">Every exhibit's plants suit its animals.</div>`}</section>`;
  return h;
}

function greenhouseHtml(b){
  let h = deptHead(b) + `<div class="meta">${esc(BUILDINGS.greenhouse.blurb)}</div>`;
  h += `<div class="meta" style="margin-top:6px">${hasDept("ceres") ? `CERES grows ${ceresRate()} Paleoflora a day with ${greenhouses().length} greenhouse${greenhouses().length === 1 ? "" : "s"}.` : "There's no CERES, so this greenhouse has nothing to supply."}</div>`;
  return h;
}

function depotHtml(b){
  let h = deptHead(b) + `<div class="meta">${esc(BUILDINGS.depot.blurb)}</div>`;
  const working = depotWorking(b), k = knownCond(b);
  h += `<div class="row" style="margin-top:6px"><span class="status ${working ? "ok" : "no"}">${!hasTech("vehicles") ? "Needs research" : working ? `${VEHICLES.perDepot} ATVs ready` : "ATVs grounded"}</span></div>`;
  h += `<div class="factor" style="grid-template-columns:80px 1fr 44px;margin-top:8px"><span>Condition</span>${meter(k, k >= 60 ? "var(--good)" : k >= 30 ? "var(--warn)" : "var(--bad)")}<span>${Math.round(k)}%</span></div>`;
  h += `<div class="meta">Grounds its ATVs below ${VEHICLES.offlineBelow}%. Wears about ${VEHICLES.wear}% a day.</div>`;
  const staff = state.staff.keepers.concat(state.staff.mechanics), slots = vehicleSlots();
  h += `<section><h3>Who drives</h3><div class="meta">${slots} ATV${slots === 1 ? "" : "s"} across ${depots().filter(depotWorking).length} working depot${depots().filter(depotWorking).length === 1 ? "" : "s"} for ${staff.length} staff. Keepers get them first, then mechanics.${staff.length > slots ? ` ${staff.length - slots} still walk everywhere. Build more depots to put them on wheels.` : ""}</div>`;
  if(staff.length) h += `<ul class="issues" style="margin-top:6px">${staff.map((s, i) => `<li class="${i < slots ? "" : "bad"}">${esc(s.name)}: ${i < slots ? "has an ATV" : "walking"}</li>`).join("")}</ul>`;
  h += `<div class="meta" style="margin-top:6px">ATVs never go on guest paths. Staff park and walk those stretches, so a connected service road network makes them much faster.</div></section>`;
  return h;
}

function buildingHtml(b){
  if(b.type === "depot") return depotHtml(b) + demolishRow(b);
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
  const t = BUILDINGS[b.type], reach = isReachable(b);
  let h = `<button class="back" data-action="deselect">‹ Park office</button><h2>${t.label}</h2>`;
  h += `<div class="row"><span class="status ${reach ? "ok" : "no"}">${reach ? "Open to guests" : "No path from the entrance"}</span></div>`;
  const same = state.buildings.filter(x => x.type === b.type && isReachable(x)).length || 1;
  const served = b.type === "food" ? state.today.servedFood : b.type === "shop" ? state.today.servedShop : null;
  h += `<dl class="kv"><dt>Serves up to</dt><dd>${t.capacity} guests a day</dd>`;
  if(t.perGuest) h += `<dt>Each guest spends</dt><dd>${money(t.perGuest)}</dd>`;
  if(served != null) h += `<dt>Served today (all ${t.label.toLowerCase()}s)</dt><dd>${served.toLocaleString()} of ${(t.capacity * same).toLocaleString()}</dd>`;
  h += `<dt>Running cost</dt><dd>${money(t.upkeep)} a day</dd></dl>`;
  if(b.type === "restroom") h += `<div class="meta">Restrooms don't earn money, but guests rate the park higher when there are enough of them.</div>`;
  if(served != null && served >= t.capacity * same) h += `<div class="meta" style="color:var(--bad)">Sold out today. Build another to serve more guests.</div>`;
  return h + demolishRow(b);
}
function demolishRow(b){ return `<div class="row"><button class="btn danger" data-action="demolish">Bulldoze for +${money(refundFor("building", b))}</button></div>`; }

function pathHtml(p){
  const svc = isService(p), live = (svc ? derived.joinedAll : derived.joined).has(p.id);
  let h = `<button class="back" data-action="deselect">‹ Park office</button><h2>${p.fixed ? esc(p.name) : svc ? "Service road" : "Footpath"}</h2>`;
  h += `<div class="row"><span class="status ${live ? "ok" : "no"}">${live ? "Connected to the entrance" : "Not connected to the entrance"}</span><span class="meta">${Math.round(lineLength(p.points))} m</span></div>`;
  if(svc) h += `<div class="meta">Staff only. Guests won't walk here, and exhibits beside it can't be seen. Backstage buildings like ORACLE, GHOST, and TAR can use it.</div>`;
  if(!live) h += `<div class="meta">Nobody can reach this ${svc ? "road" : "path"}. Join it to the main walk or another connected path.</div>`;
  if(!p.fixed) h += `<div class="row"><button class="btn danger" data-action="demolish">Bulldoze for +${money(refundFor("path", p))}</button></div>`;
  else h += `<div class="meta">This is where guests come in. It can't be removed.</div>`;
  return h;
}

/* ---------- panel buttons ---------- */
panelEl.addEventListener("click", e => {
  const b = e.target.closest("[data-action]"); if(!b) return;
  const a = b.dataset.action, it = selItem();
  if(a === "deselect"){ select(null); return; }
  if(a === "ticket"){
    state.ticket = clamp(state.ticket + (+b.dataset.d), 1, 150);
    recompute(); ui.panel(); saveSoon(); return;
  }
  // science buttons
  const sc = state.science, done = () => { afterChange(); render(); };
  if(a === "research"){ const why = researchTech(b.dataset.id); if(why) ui.toast(why, "bad"); done(); return; }
  // putting a flying animal somewhere it can fly out of needs a yes first
  if((a === "buy" || a === "clone" || a === "place") && it && sel.kind === "exhibit" && !it.viv && !it.aviary && b.dataset.sure !== "1"){
    const sp = a === "place" ? (sc.ready.find(r => r.id === b.dataset.id) || {}).sp : b.dataset.sp, s = SPECIES_BY_ID[sp];
    if(s && isFlyer(s)){
      askConfirm(`${s.name} can fly`, `${it.name} has no aviary netting, so the ${s.name} will fly out almost right away and get loose in the park. Put it here anyway?`, "Yes, put it here", () => { b.dataset.sure = "1"; b.click(); });
      return;
    }
  }
  if(a === "moat"){ const c = moatCost(it); if(canAfford(c)){ spend(c, "built"); it.moat = true; done(); } return; }
  if(a === "aviary"){ const c = aviaryCost(it); if(canAfford(c)){ spend(c, "built"); it.aviary = true; done(); } return; }
  if(a === "aviaryOff"){ it.aviary = false; done(); return; }
  if(a === "platformTool"){ setTool("platform"); return; }
  if(a === "ptab"){ oracleTab = b.dataset.p; ui.panel(); return; }
  if(a === "hireSci"){ const why = hireScientist(b.dataset.k); if(why) ui.toast(why, "bad"); done(); return; }
  if(a === "fireSci"){ if(sc.crew[b.dataset.k] > 0) sc.crew[b.dataset.k]--; done(); return; }
  if(a === "unlock"){ if(unlockPeriod(b.dataset.p)) done(); return; }
  if(a === "trip"){ if(launchTrip(b.dataset.p, b.dataset.sp)) done(); return; }
  if(a === "clone"){ if(orderClone(b.dataset.sp, sel && sel.kind === "exhibit" ? sel.id : null)) done(); return; }
  if(a === "place"){ if(placeReady(b.dataset.id, sel.id)) done(); return; }
  if(a === "moveDlg" && it){ openMoveDialog(it, b.dataset.sp); return; }
  if(a === "cancelMoves" && it){ state.staff.transfers = state.staff.transfers.filter(t => t.keeper || (t.from !== it.id && t.to !== it.id)); done(); return; }
  if(a === "hireMech"){ const why = hireMechanic(); if(why) ui.toast(why, "bad"); done(); return; }
  if(a === "fireMech"){ state.staff.mechanics = state.staff.mechanics.filter(m => m.id !== b.dataset.id); done(); return; }
  if(a === "hire"){ const why = hireKeeper(); if(why) ui.toast(why, "bad"); done(); return; }
  if(a === "fire"){ state.staff.keepers = state.staff.keepers.filter(k => k.id !== b.dataset.id); done(); return; }
  if(a === "upgrade"){ const u = UPGRADES.find(x => x.id === b.dataset.id); if(u && canAfford(u.price) && !hasUpgrade(u.id) && !(u.needs && !hasUpgrade(u.needs))){ spend(u.price, "built"); state.staff.upgrades.push(u.id); ui.toast(`Bought ${u.label.toLowerCase()}. ${u.text}`, "good"); done(); } return; }
  if(a === "gateTool"){ setTool("gate"); return; }
  if(a === "gotoDept"){ const d = state.buildings.find(x => x.type === b.dataset.t); if(d) select("building", d.id); return; }
  if(!it) return;
  if(a === "center") centerOn(it);
  if(a === "buy"){
    const s = SPECIES_BY_ID[b.dataset.sp];
    if(!canAfford(s.price) || state.rating + 1e-9 < s.stars) return;
    spend(s.price, "animals");
    if(!it.animals.length) it.happy = 70;
    it.animals.push({id:uid("a-"), sp:s.id});
    afterChange(); render();
  }
  if(a === "sell"){
    const i = it.animals.map(x => x.sp).lastIndexOf(b.dataset.sp); if(i < 0) return;
    earn(Math.round(SPECIES_BY_ID[b.dataset.sp].price * COST.animalResale), "sold");
    it.animals.splice(i, 1);
    afterChange(); render();
  }
  if(a === "demolish"){
    if(b.dataset.armed !== "1"){
      b.dataset.armed = "1"; const orig = b.textContent; b.textContent = "Tap again to bulldoze";
      setTimeout(() => { if(b.isConnected){ b.dataset.armed = ""; b.textContent = orig; } }, 3000);
      return;
    }
    removeItem(sel.kind, it);
  }
});
panelEl.addEventListener("input", e => {
  const it = selItem();
  if(e.target.dataset.field === "name" && it){ it.name = e.target.value.slice(0, 40) || "Exhibit"; render(); $("#sheetToggle").textContent = it.name; saveSoon(); }
});
$("#sheetToggle").onclick = () => aside.classList.toggle("open");

// Replanting an exhibit
panelEl.addEventListener("change", ev => {
  if(ev.target.id !== "floraSel") return;
  const e = selItem(), key = ev.target.value; if(!e) return;
  const cost = Math.round(area(e.points) * FLORA[key].perSqM);
  const noTech = FLORA[key].tech && !hasTech(FLORA[key].tech);
  if((key !== "cenozoic" && (!hasDept("ceres") || noTech)) || !canAfford(cost)){ ui.toast(!canAfford(cost) ? `That costs ${money(cost)}.` : noTech ? "Research that planting at ORACLE first." : "Build CERES first.", "bad"); ui.panel(); return; }
  spend(cost, "built"); e.flora = key;
  ui.toast(`${e.name} is now planted with ${FLORA[key].plants}${cost ? ` (${money(cost)})` : ""}.`, "good");
  afterChange(); render();
});

// Changing an exhibit's wall type
panelEl.addEventListener("change", ev => {
  if(ev.target.id !== "barrierSel") return;
  const e = selItem(), key = ev.target.value; if(!e) return;
  const b = BARRIERS[key], cost = upgradeCost(e, key);
  if((b.tech && !hasTech(b.tech)) || !canAfford(cost)){ ui.toast(!canAfford(cost) ? `That costs ${money(cost)}.` : "Research it at ORACLE first.", "bad"); ui.panel(); return; }
  spend(cost, "built"); e.barrier = key;
  ui.toast(`${e.name} now has ${b.label.toLowerCase()}${cost ? ` (${money(cost)})` : ""}.`);
  afterChange(); render();
});

// A yes/no question inside the page
function askConfirm(title, text, yes, onYes){
  const d = $("#dlgConfirm");
  $("#confirmTitle").textContent = title; $("#confirmText").textContent = text; $("#confirmYes").textContent = yes;
  $("#confirmYes").onclick = () => { d.close(); onYes(); };
  $("#confirmNo").onclick = () => d.close();
  d.showModal();
}

/* ---------- animal catalog ---------- */
let catFilter = "all";

// Where a species stands: can you get it now, is it on its way, or not started yet?
function speciesStatus(s){
  const sc = state.science, d = sc.dna[s.id], p = PERIOD_BY_ID[s.period];
  const lock = state.rating + 1e-9 < s.stars ? `Needs ${s.stars}★. You have ${state.rating.toFixed(1)}.` : "";
  if(s.shop) return {group:lock ? "progress" : "now", cls:"ok", how:`Sold by partner parks for ${money(s.price)}.`, lock};
  if(d && d.genome >= 100) return {group:lock ? "progress" : "now", cls:"ok", how:`Genome complete. Clone at TAR for ${money(s.price)}. DNA quality ${d.quality}%.`, lock};
  if(sc.trips.some(t => t.sp === s.id)) return {group:"progress", cls:"wait", how:`GHOST is out finding it now. Genome ${d ? d.genome : 0}%.`, lock};
  if(d) return {group:"progress", cls:"wait", how:`Genome ${d.genome}% complete, quality ${d.quality}%. Send GHOST for more.`, lock};
  if(sc.unlocked.includes(s.period)) return {group:"progress", cls:"wait", how:`${s.period} unlocked. Send GHOST from ORACLE to collect DNA.`, lock};
  return {group:"locked", cls:"no", how:`Unlock the ${s.period} at ORACLE (${p.research} research points), then send GHOST.`, lock};
}

function catalogHtml(){
  const owned = new Map();
  for(const e of state.exhibits) for(const a of e.animals) owned.set(a.sp, (owned.get(a.sp) || 0) + 1);
  const order = ["Carboniferous", "Permian", "Triassic", "Jurassic", "Cretaceous", "Paleogene", "Neogene", "Quaternary"];
  let h = "", shown = 0;
  for(const per of order){
    const list = SPECIES.filter(s => s.period === per).map(s => ({s, st:speciesStatus(s)})).filter(x => catFilter === "all" || x.st.group === catFilter);
    if(!list.length) continue;
    shown += list.length;
    const p = PERIOD_BY_ID[per], open = state.science.unlocked.includes(per);
    h += `<section class="cat-period"><h3><span class="dot" style="background:${PERIOD_COLOR[per]}"></span>${per} <span class="meta">${p.ago}${open ? ", unlocked" : ""}</span></h3><div class="cat-grid">`;
    for(const {s, st} of list){
      const n = owned.get(s.id) || 0;
      h += `<div class="cat-card"><span class="nm">${speciesName(s)}</span>
        <span class="stats">${dietText(s)}. ${habitatText(s)}${s.space.toLocaleString()} m² each, groups of ${s.group[0]}–${s.group[1]}. ${money(s.food)}/day food. Appeal ${s.appeal}.</span>
        <span class="how ${st.cls}">${esc(st.how)}</span>
        ${st.lock ? `<span class="lock">${esc(st.lock)}</span>` : ""}
        ${n ? `<span class="have">${n} in your park</span>` : ""}</div>`;
    }
    h += `</div></section>`;
  }
  if(!shown) h = `<div class="meta">Nothing here yet.</div>`;
  return h;
}

function openCatalog(){ $("#catalogBody").innerHTML = catalogHtml(); if(!$("#dlgAnimals").open) $("#dlgAnimals").showModal(); }
$("#animalsBtn").onclick = openCatalog;
$("#closeAnimals").onclick = () => $("#dlgAnimals").close();
document.querySelectorAll("[data-filter]").forEach(b => b.onclick = () => {
  catFilter = b.dataset.filter;
  document.querySelectorAll("[data-filter]").forEach(x => x.setAttribute("aria-pressed", x === b));
  $("#catalogBody").innerHTML = catalogHtml();
});
