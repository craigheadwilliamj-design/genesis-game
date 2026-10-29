/* =====================================================================
   LOGISTICS PANELS
   Stores, the dock, work zones, and the supply summary in the park office.
   ===================================================================== */

const goodName = t => (GOODS[t] || {label:t}).label;
const bar3 = (label, v, color, right) => `<div class="factor" style="grid-template-columns:70px 1fr 84px"><span>${label}</span>${meter(v, color)}<span>${right}</span></div>`;

// A drop-down that moves a keeper, exhibit, or building into a zone. Only shows once a zone exists.
function zoneSelect(kind, id, cur){
  if(!zones().length) return "";
  return `<select class="zsel" data-assign="${kind}:${esc(id)}" aria-label="Zone" style="max-width:112px;font-size:12px"><option value="">No zone</option>${zones().map(z => `<option value="${esc(z.id)}"${z.id === cur ? " selected" : ""}>${esc(z.name)}</option>`).join("")}</select>`;
}

/* ---------- stores ---------- */

function stockRows(b){
  const d = storeOf(b), cap = storeCap(b), tot = storeTotal(b);
  let h = bar3("Stored", tot / cap * 100, "var(--gold)", `${Math.floor(tot)}/${cap}`);
  for(const t of d.holds){
    const tgt = storeTarget(b, t), have = stockOf(b, t);
    h += bar3(goodName(t), have / cap * 100, GOOD_COLOR[t], `${Math.floor(have)}${tgt ? ` / ${tgt} wanted` : ""}`);
  }
  return h;
}
function spoilLine(b){
  const d = storeOf(b);
  const parts = d.holds.map(t => `${goodName(t).toLowerCase()} ${(spoilRate(b, t) * 100).toFixed(1).replace(/\.0$/, "")}%`);
  const cold = d.cold ? (b.powered === false ? " <b style='color:var(--bad)'>No power: it spoils like a plain store.</b>" : " Powered.") : "";
  return `<div class="meta" style="margin-top:6px">Spoils a night: ${parts.join(", ")}.${cold}</div>`;
}
function zoneRow(kind, b){
  return zones().length ? `<div class="row" style="margin-top:6px"><span class="meta">Zone</span>${zoneSelect(kind, b.id, b.zone)}</div>` : "";
}

function dockHtml(b){
  let h = deptHead(b) + zoneRow("building", b);
  h += `<section><h3>Stock</h3>${stockRows(b)}${spoilLine(b)}</section>`;
  return h + `<div class="row"><button class="btn" data-action="gotoLogi">Standing orders</button></div>`;
}

function warehouseHtml(b){
  const d = storeOf(b), made = BUILDINGS[b.type].makes;
  let h = deptHead(b) + zoneRow("building", b);
  h += `<section><h3>${made ? "Output" : "Stock"}</h3>${stockRows(b)}${spoilLine(b)}`;
  if(made){
    const full = storeTotal(b) >= storeCap(b) - .5;
    h += `<div class="meta" style="margin-top:6px">${Object.entries(made).map(([t, n]) => `${n} ${goodName(t).toLowerCase()} a day`).join(", ")}${full ? " <b style='color:var(--bad)'>Full, stopped.</b>" : ""}</div>`;
  } else {
    h += `<div class="meta" style="margin-top:6px">Park use: ${d.holds.filter(t => !MED_GOODS.includes(t)).map(t => `${Math.round(demandOf(t))} ${goodName(t).toLowerCase()}`).join(", ")} a day</div>`;
  }
  return h + `</section>`;
}

/* ---------- zones ---------- */

function zoneHtml(z){
  const m = zoneMembers(z);
  let h = "";
  h += `<div class="row"><span class="status ok" style="background:${z.color};color:#fff">${m.keepers.length + m.aquarists.length + m.mechanics.length + m.vets.length + m.custodians.length + m.guards.length} staff</span><span class="meta">${m.exhibits.length} exhibit${m.exhibits.length === 1 ? "" : "s"}, ${m.stores.length} building${m.stores.length === 1 ? "" : "s"}, ${fmtArea(area(z.points))}</span></div>`;

  const issues = [];
  if(m.exhibits.some(e => e.animals.length && !aquaEx(e)) && !m.keepers.length) issues.push(state.staff.keepers.some(k => !isAqua(k) && !k.zone) ? "No keeper assigned (unassigned keepers cover it)." : "No keeper assigned.");
  if(m.exhibits.some(e => e.animals.length && aquaEx(e)) && !m.aquarists.length) issues.push(state.staff.keepers.some(k => isAqua(k) && !k.zone) ? "No aquarist assigned (unassigned aquarists cover it)." : "No aquarist assigned.");
  if(m.exhibits.some(e => e.animals.length) && !m.stores.some(b => storeOf(b) && storeOf(b).holds.some(t => FEED_GOODS.includes(t)))) issues.push("No food store in this zone.");
  for(const e of m.exhibits) if(e.animals.length && !gateCheck(e).ok) issues.push(`${e.name}: keepers can't get in.`);
  if(issues.length) h += `<ul class="issues" style="margin-top:6px">${issues.map(i => `<li class="bad">${esc(i)}</li>`).join("")}</ul>`;

  // food this zone eats against what its stores hold
  const rows = FEED_GOODS.filter(t => zoneDemand(z.id, t) > 0);
  if(rows.length){
    h += `<section><h3>Food</h3>`;
    for(const t of rows){
      const have = m.stores.reduce((s, b) => s + stockOf(b, t), 0), need = zoneDemand(z.id, t);
      h += bar3(goodName(t), Math.min(100, have / Math.max(1, need * LOGI.hubDays) * 100), GOOD_COLOR[t], `${Math.floor(have)} / ${need} a day`);
    }
    h += `</section>`;
  }

  const row = (kind, it, label, extra) => `<li><span class="dot" style="background:${z.color}"></span><span><b>${esc(label)}</b>${extra ? ` <span class="meta">${extra}</span>` : ""}</span>${zoneSelect(kind, it.id, it.zone)}</li>`;
  const staffSection = (title, kind, list, inZone, statusFn) => {
    let t = `<section><h3>${title}</h3>`;
    t += inZone.length ? `<ul class="herd">${inZone.map(k => row(kind, k, k.name, esc(statusFn(k)))).join("")}</ul>` : `<div class="meta">None assigned.</div>`;
    const free = list.filter(k => !k.zone), other = list.filter(k => k.zone && k.zone !== z.id);
    t += addRow(z, [...free.map(k => [kind, k.id, k.name]), ...other.map(k => [kind, k.id, `${k.name} (${zoneName(k.zone)})`])], `Add ${kind === "vet" ? "a vet" : kind === "custodian" ? "a custodian" : kind === "guard" ? "a guard" : "a mechanic"}…`);
    return t + `</section>`;
  };
  h += `<section><h3>Keepers</h3>`;
  h += m.keepers.length ? `<ul class="herd">${m.keepers.map(k => row("keeper", k, k.name, esc(keeperStatus(k)))).join("")}</ul>` : `<div class="meta">None assigned.</div>`;
  const freeK = state.staff.keepers.filter(k => !isAqua(k) && !k.zone), otherK = state.staff.keepers.filter(k => !isAqua(k) && k.zone && k.zone !== z.id);
  h += `<div class="meta" style="margin-top:6px">${freeK.length ? `${freeK.length} unassigned keeper${freeK.length === 1 ? "" : "s"}` : "No unassigned keepers"}</div>`;
  h += addRow(z, [...freeK.map(k => ["keeper", k.id, k.name]), ...otherK.map(k => ["keeper", k.id, `${k.name} (${zoneName(k.zone)})`])], "Add a keeper…");
  h += `</section>`;
  const aq = state.staff.keepers.filter(isAqua);
  if(aq.length || m.aquarists.length){
    h += `<section><h3>Aquarists</h3>`;
    h += m.aquarists.length ? `<ul class="herd">${m.aquarists.map(k => row("keeper", k, k.name, esc(keeperStatus(k)))).join("")}</ul>` : `<div class="meta">None assigned.</div>`;
    const freeA = aq.filter(k => !k.zone), otherA = aq.filter(k => k.zone && k.zone !== z.id);
    h += addRow(z, [...freeA.map(k => ["keeper", k.id, k.name]), ...otherA.map(k => ["keeper", k.id, `${k.name} (${zoneName(k.zone)})`])], "Add an aquarist…");
    h += `</section>`;
  }
  if(state.staff.mechanics.length || m.mechanics.length) h += staffSection("Mechanics", "mechanic", state.staff.mechanics, m.mechanics, mechanicStatus);
  if(state.staff.vets.length || m.vets.length) h += staffSection("Vets", "vet", state.staff.vets, m.vets, vetStatus);
  if(state.staff.custodians.length || m.custodians.length) h += staffSection("Custodians", "custodian", state.staff.custodians, m.custodians, custodianStatus);
  if(state.staff.guards.length || m.guards.length) h += staffSection("Security guards", "guard", state.staff.guards, m.guards, guardStatus);

  h += `<section><h3>Exhibits</h3>`;
  h += m.exhibits.length ? `<ul class="herd">${m.exhibits.map(e => row("exhibit", e, e.name, `${e.animals.length} animal${e.animals.length === 1 ? "" : "s"}`)).join("")}</ul>` : `<div class="meta">None.</div>`;
  h += addRow(z, state.exhibits.filter(e => e.zone !== z.id).map(e => ["exhibit", e.id, e.zone ? `${e.name} (${zoneName(e.zone)})` : e.name]), "Add an exhibit…");
  h += `</section><section><h3>Buildings</h3>`;
  const zb = b => storeOf(b) || (["station", "diveshack", "breakroom", "workshop", "depot"].includes(b.type) || isStation(b));
  h += m.stores.length ? `<ul class="herd">${m.stores.map(b => row("building", b, BUILDINGS[b.type].label)).join("")}</ul>` : `<div class="meta">None.</div>`;
  h += addRow(z, state.buildings.filter(b => zb(b) && b.zone !== z.id).map(b => ["building", b.id, b.zone ? `${BUILDINGS[b.type].label} (${zoneName(b.zone)})` : BUILDINGS[b.type].label]), "Add a building…");
  h += `<div class="row" style="margin-top:8px"><button class="btn" data-action="claimZone">Claim everything inside</button></div></section>`;
  h += zoneThemeHtml(z);
  h += `<div class="row"><button class="btn" data-action="zoneEdit">Reshape zone</button></div>`;
  h += `<div class="row"><button class="btn" data-action="center">Center on map</button><button class="btn danger" data-action="demolish">Remove zone</button></div>`;
  return h;
}
function addRow(z, items, label){
  if(!items.length) return "";
  return `<div class="row" style="margin-top:6px"><select data-addzone="${esc(z.id)}" aria-label="${esc(label)}" style="font-size:13px"><option value="">${esc(label)}</option>${items.map(([kind, id, name]) => `<option value="${kind}:${esc(id)}">${esc(name)}</option>`).join("")}</select></div>`;
}

/* ---------- the park office ---------- */

/* ---------- the park office Logistics tab ---------- */

// Goods worth a row: anything ordered, used, needed or held, and contemporary medicine once there's a PMC
function orderGoods(){
  return ORDER_GOODS.filter(t => orderOf(t) || usedAvg(t) || orderNeed(t) || parkStock(t) >= 1 || (t === CMED && hasDept("pmc")));
}
const goodUse = t => Math.max(usedAvg(t), orderNeed(t));
// The price and night's cost of a standing order of n units
function orderCost(t, n){
  const free = freeFeeding() && FEED_GOODS.includes(t), off = bulkOff(n), p = basePrice(t) * (1 - off);
  const each = t === CMED || p >= 10 ? money(Math.round(p)) : `$${p.toFixed(2)}`;
  return free ? "Free from the partner parks." : `${each} a unit${off ? ` (${Math.round(off * 100)}% off)` : ""}. ${money(Math.round(n * p))} a night.`;
}
function orderChip(t){
  const use = goodUse(t), have = parkStock(t), make = FEED_GOODS.includes(t) ? parkProduction(t) : 0;
  if(!use) return orderOf(t) ? `<span class="status">Not used.</span>` : "";
  if(have < use) return `<span class="status no">Low.</span>`;
  if(orderOf(t) + make < use * .9) return `<span class="status no">Below use.</span>`;
  if(have > use * 6 && orderOf(t)) return `<span class="status">Piling up.</span>`;
  return `<span class="status ok">OK</span>`;
}
function logisticsHtml(){
  seedOrders();
  const L = state.logi, auto = forecasting(), ds = state.buildings.filter(b => b.type === "dock");
  let h = `<section><h3>Standing orders</h3>`;
  const warns = (ds.length ? [] : ["No delivery dock."]).concat(ds.length && !docks().length ? ["Trucks can't reach the docks."] : [], logiWarnings());
  if(warns.length) h += `<ul class="issues">${warns.map(w => `<li class="bad">${esc(w)}</li>`).join("")}</ul>`;
  if(hasTech("forecast")) h += `<div class="row" style="margin-top:6px"><button class="btn" data-action="forecast" aria-pressed="${auto}">Supply forecasting</button></div>`;
  h += `<ul class="shop" style="margin-top:6px">${orderGoods().map(t => {
    const n = orderOf(t), use = goodUse(t), have = parkStock(t), yday = (L.usedLast || {})[t] || 0, make = FEED_GOODS.includes(t) ? parkProduction(t) : 0;
    const days = use ? have / use : 0;
    return `<li><span class="nm">${goodName(t)}</span>${orderChip(t)}
      <span class="need" style="grid-column:1/-1;display:flex;gap:8px;align-items:center"><input type="range" data-order="${t}" min="0" max="${orderMax(t)}" step="${orderStep(t)}" value="${n}" aria-label="${goodName(t)} a night"${auto ? " disabled" : ""} style="flex:1"><b id="ordN-${t}" style="min-width:84px;text-align:right">${n} a night</b></span>
      <span class="need" style="grid-column:1/-1">Used ${Math.round(yday)} yesterday, ${Math.round(usedAvg(t))} a night this week${make ? `. Farms ${make}` : ""}. ${Math.floor(have)} on hand${use ? `, ${days >= 10 ? "10+" : days.toFixed(1)} days` : ""}.</span>
      <span class="need" id="ordC-${t}" style="grid-column:1/-1">${orderCost(t, n)}</span>
      <span class="need" style="grid-column:1/-1"><button class="buy" data-action="rush" data-t="${t}"${canAfford(rushPrice(t)) ? "" : " disabled"} title="Delivered now">Rush ${rushLot(t)}, ${money(rushPrice(t))}</button></span></li>`;
  }).join("")}</ul>`;
  const room = docks().reduce((s, b) => s + storeRoom(b, ORDER_GOODS[0]), 0);
  h += `<dl class="kv" style="margin-top:6px"><dt>Delivery at ${fmtClock(LOGI.truckClock)}</dt><dd>${money(Math.round(nightBill()))}</dd><dt>Dock space</dt><dd>${Math.floor(room)} free of ${dockCap()}</dd></dl>`;
  if(L.noRoom >= 1 || L.noCash >= 1) h += `<div class="meta" style="margin-top:4px;color:var(--bad)">Last delivery: ${[L.noRoom >= 1 ? `${Math.round(L.noRoom)} units didn't fit` : "", L.noCash >= 1 ? `${Math.round(L.noCash)} weren't paid for` : ""].filter(Boolean).join(", ")}.</div>`;
  if(L.lostDay === state.day - 1 && L.lost >= 1) h += `<div class="meta" style="margin-top:4px">Spoiled last night: ${Math.round(L.lost)} units, ${money(Math.round(L.lostCost))}</div>`;
  h += `</section>`;
  return h + madeHereHtml();
}
// What the park makes itself: Paleoflora and each era's medicine from the Botany Lab
function madeHereHtml(){
  const sum = stockSummary();
  let h = "";
  if(sum.paleoflora.need && hasDept("ceres")) h += bar3("Paleoflora", sum.paleoflora.have / Math.max(1, ceresCap()) * 100, FOOD_COLOR.paleoflora, `${sum.paleoflora.have} at the Botany Lab`);
  if(hasDept("pmc") || hasDept("ceres")) for(const t of MED_GOODS){
    const x = sum[t], era = Object.keys(MED_GOOD).find(k => MED_GOOD[k] === t);
    if(!x.have && !x.ceres && !hasTech(MED_TECH[era])) continue;
    h += bar3(goodName(t), x.have / Math.max(1, medCap()) * 100, GOOD_COLOR[t], `${Math.floor(x.have)} stored`);
    h += `<div class="meta fnote">PMC ${Math.floor(x.pmc)}, Botany Lab ${x.ceres}${hasTech(MED_TECH[era]) ? "" : " · locked"}</div>`;
  }
  return h ? `<section><h3>Made in the park</h3>${h}</section>` : "";
}

// The work zones section, shown in the park office Staff tab
function zonesSectionHtml(){
  let h = `<section id="zonesSection">`;
  h += `<h3>Work zones</h3>`;
  if(zones().length) h += `<ul class="deptlist">${zones().map(z => { const m = zoneMembers(z); return `<li><button class="btn" data-action="gotoZone" data-id="${esc(z.id)}" style="padding:3px 9px;border-left:6px solid ${z.color}">${esc(z.name)}</button><span>${m.keepers.length + m.aquarists.length + m.mechanics.length + m.vets.length + m.custodians.length + m.guards.length} staff, ${m.exhibits.length} exhibit${m.exhibits.length === 1 ? "" : "s"}, ${m.stores.length} building${m.stores.length === 1 ? "" : "s"}</span></li>`; }).join("")}</ul>`;
  else h += `<div class="meta">No zones.</div>`;
  h += `<div class="row" style="margin-top:8px"><button class="btn" data-action="zoneTool">Draw a zone</button><button class="btn" data-action="supplyToggle">${supplyOn ? "Hide" : "Show"} supply lines</button></div></section>`;
  return h;
}

/* ---------- clicks ---------- */

panelEl.addEventListener("click", ev => {
  const b = ev.target.closest("[data-action]"); if(!b) return;
  const a = b.dataset.action, it = selItem(), done = () => { afterChange(); render(); };
  if(a === "zoneTool"){ setTool("zone"); return; }
  if(a === "supplyToggle"){ $("#supplyBtn").click(); ui.panel(); return; }
  if(a === "zoneEdit" && it && sel.kind === "zone"){ startZoneEdit(it.id); return; }
  if(a === "zoneRestyle" && it && sel.kind === "zone"){
    const key = THEMES[it.theme] ? it.theme : "genesis", why = zoneThemeProblem(it, key);
    if(why){ ui.toast(why, "bad"); return; }
    const r = restyleZone(it, key); ui.toast(`Restyled ${r.n} thing${r.n === 1 ? "" : "s"} as ${THEMES[key].label}${r.fee ? ` (${money(r.fee)})` : ""}.`, "good");
    done(); return;
  }
  if(a === "gotoZone"){ select("zone", b.dataset.id); return; }
  if(a === "claimZone" && it && sel.kind === "zone"){
    for(const e of state.exhibits) if(!e.zone && inPoly(...centroid(e.points), it.points)) e.zone = it.id;
    for(const x of state.buildings) if(!x.zone && !x.exhibitId && inPoly(...centroid(x.points), it.points)) x.zone = it.id;
    done(); return;
  }
  if(a === "gotoLogi"){ openParkOffice("logi"); return; }
  if(a === "forecast"){ state.logi.auto = !state.logi.auto; if(forecasting()) for(const t of ORDER_GOODS) state.logi.orders[t] = forecastOrder(t); done(); return; }
  if(a === "rush"){ const t = b.dataset.t, why = rushOrder(t); if(why) ui.toast(why, "bad"); else ui.toast(`Rush delivery of ${rushLot(t)} ${goodName(t).toLowerCase()} arrived at the dock.`); done(); return; }
});

// Standing order sliders: the number and price follow the drag, and the order is set when it's let go
panelEl.addEventListener("input", ev => {
  const t = ev.target.dataset && ev.target.dataset.order; if(!t) return;
  const n = +ev.target.value, a = $("#ordN-" + t), c = $("#ordC-" + t);
  if(a) a.textContent = `${n} a night`; if(c) c.textContent = orderCost(t, n);
});
panelEl.addEventListener("change", ev => {
  const t = ev.target;
  if(t.dataset.order){ setOrder(t.dataset.order, t.value); afterChange(); render(); return; }
  if(t.id === "zoneThemeSel"){
    const it = selItem(); if(!it || sel.kind !== "zone") return;
    if(!themeHave(t.value)){ ui.toast("That theme is locked.", "bad"); ui.panel(); return; }
    if(t.value === "genesis") delete it.theme; else it.theme = t.value;
    afterChange(); render(); return;
  }
  if(t.dataset.assign){
    const [kind, id] = t.dataset.assign.split(":");
    setZone(kind, id, t.value); afterChange(); render(); return;
  }
  if(t.dataset.addzone && t.value){
    const [kind, id] = t.value.split(":");
    setZone(kind, id, t.dataset.addzone); afterChange(); render();
  }
});

// A zone's theme tints the ground and styles what gets built inside it; the button restyles what is already there
function zoneThemeHtml(z){
  if(!devMode()) return "";
  const key = THEMES[z.theme] ? z.theme : "genesis", T = THEMES[key], plan = zoneThemePlan(z, key);
  let h = `<section><h3>Theme</h3><label class="field"><span>Zone style</span><select id="zoneThemeSel">${Object.entries(THEMES).map(([k, X]) => `<option value="${k}"${k === key ? " selected" : ""}${themeHave(k) ? "" : " disabled"}>${esc(X.label)}${themeHave(k) ? "" : ` (${esc(X.unlock.hint)})`}</option>`).join("")}</select></label>`;
  h += `<div class="meta" style="margin-top:4px">${key === "genesis" ? "Pick a theme to tint this part of the map and style new paths, buildings and exhibits built here." : `${esc(T.blurb)} New builds inside this zone use it.`}</div>`;
  if(plan.length) h += `<div class="row" style="margin-top:6px"><button class="btn" data-action="zoneRestyle">Restyle ${plan.length} thing${plan.length === 1 ? "" : "s"} inside (${money(zoneThemeFee(z, key))})</button></div>`;
  return h + `</section>`;
}
