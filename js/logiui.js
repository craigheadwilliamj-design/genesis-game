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
  let h = deptHead(b) + `<div class="meta">${esc(BUILDINGS.dock.blurb)}</div>` + zoneRow("building", b);
  const auto = b.auto !== false, orders = dockOrders(b);
  h += `<section><h3>Stock</h3>${stockRows(b)}${spoilLine(b)}</section>`;
  h += `<section><h3>Overnight orders</h3><div class="row"><button class="btn" data-action="dockAuto">${auto ? "Auto-ordering is on" : "Ordering by hand"}</button></div>`;
  h += `<div class="meta" style="margin-top:6px">${auto ? `It tops up to ${LOGI.autoDays} days of the park's food each night, less what your farms already make.` : "Set how much of each food the dock should hold after tonight's delivery."}</div>`;
  let cost = 0;
  h += `<ul class="shop" style="margin-top:6px">${FEED_GOODS.map(t => {
    const stock = stockOf(b, t), want = orders[t], n = Math.max(0, Math.min(Math.floor(want - stock), Math.floor(storeRoom(b, t)))), price = freeFeeding() ? 0 : unitPrice(t);
    cost += n * price;
    return `<li><span class="nm">${goodName(t)}</span>${auto ? `<span class="status ok">${want} wanted</span>` : `<span class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn sell" data-action="dockOrd" data-t="${t}" data-d="-25">−25</button><b>${want}</b><button class="btn sell" data-action="dockOrd" data-t="${t}" data-d="25">+25</button></span>`}
      <button class="buy" data-action="rush" data-t="${t}"${canAfford(Math.round(LOGI.rushLot * unitPrice(t) * LOGI.rushMarkup)) ? "" : " disabled"} title="Delivered now">Rush ${LOGI.rushLot}, ${money(Math.round(LOGI.rushLot * unitPrice(t) * LOGI.rushMarkup))}</button>
      <span class="need">${money(Math.round(unitPrice(t)))} a unit. Tonight: ${n} units${n && price ? ` (${money(Math.round(n * price))})` : ""}.</span></li>`;
  }).join("")}</ul>`;
  h += `<div class="meta" style="margin-top:6px">${freeFeeding() ? `Partner parks pay for deliveries until day ${state.staff.feedFrom}.` : `Tonight's delivery costs about ${money(Math.round(cost))}.`} Farms and ranches make food cheaper once you have researched food production.</div></section>`;
  return h;
}

function warehouseHtml(b){
  const d = storeOf(b), made = BUILDINGS[b.type].makes;
  let h = deptHead(b) + `<div class="meta">${esc(BUILDINGS[b.type].blurb)}</div>` + zoneRow("building", b);
  h += `<section><h3>${made ? "Output" : "Stock"}</h3>${stockRows(b)}${spoilLine(b)}`;
  if(made){
    const full = storeTotal(b) >= storeCap(b) - .5;
    h += `<div class="meta" style="margin-top:6px">${Object.entries(made).map(([t, n]) => `Makes ${n} ${goodName(t).toLowerCase()} a day.`).join(" ")} ${full ? "<b style='color:var(--bad)'>It's full, so production has stopped.</b>" : ""} Keepers carry it to stores and stations. Spare output keeps spoiling until someone does.</div>`;
  } else {
    h += `<div class="meta" style="margin-top:6px">${d.holds.filter(t => t !== "meds").map(t => `The park eats ${Math.round(parkDemand(t))} ${goodName(t).toLowerCase()} a day.`).join(" ")} Keepers fill it from docks and farms and take from it to restock stations.</div>`;
  }
  return h + `</section>`;
}

/* ---------- zones ---------- */

function zoneHtml(z){
  const m = zoneMembers(z);
  let h = `<button class="back" data-action="deselect">‹ Park office</button><label class="field"><span>Zone name</span><input id="zName" data-field="name" value="${esc(z.name)}" maxlength="40"></label>`;
  h += `<div class="row"><span class="status ok" style="background:${z.color};color:#fff">${m.keepers.length} keeper${m.keepers.length === 1 ? "" : "s"}</span><span class="meta">${m.exhibits.length} exhibit${m.exhibits.length === 1 ? "" : "s"}, ${m.stores.length} building${m.stores.length === 1 ? "" : "s"}, ${fmtArea(area(z.points))}</span></div>`;
  h += `<div class="meta" style="margin-top:6px">Keepers in a zone feed, clean, and restock only what's in it. They use the zone's own stores first.</div>`;

  const issues = [];
  if(m.exhibits.some(e => e.animals.length) && !m.keepers.length) issues.push(state.staff.keepers.some(k => !k.zone) ? "No keeper is assigned here. Unassigned keepers will cover it." : "No keeper is assigned here, so nobody feeds these animals.");
  if(m.exhibits.some(e => e.animals.length) && !m.stores.some(b => storeOf(b) && storeOf(b).holds.some(t => FEED_GOODS.includes(t)))) issues.push("No station or store in this zone. Keepers fetch food from elsewhere.");
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
  h += `<section><h3>Keepers</h3>`;
  h += m.keepers.length ? `<ul class="herd">${m.keepers.map(k => row("keeper", k, k.name, esc(keeperStatus(k)))).join("")}</ul>` : `<div class="meta">None assigned.</div>`;
  const freeK = state.staff.keepers.filter(k => !k.zone), otherK = state.staff.keepers.filter(k => k.zone && k.zone !== z.id);
  h += `<div class="meta" style="margin-top:6px">${freeK.length ? `${freeK.length} unassigned keeper${freeK.length === 1 ? "" : "s"} work anywhere.` : "Every keeper belongs to a zone."}</div>`;
  h += addRow(z, [...freeK.map(k => ["keeper", k.id, k.name]), ...otherK.map(k => ["keeper", k.id, `${k.name} (${zoneName(k.zone)})`])], "Add a keeper…");
  h += `</section>`;

  h += `<section><h3>Exhibits</h3>`;
  h += m.exhibits.length ? `<ul class="herd">${m.exhibits.map(e => row("exhibit", e, e.name, `${e.animals.length} animal${e.animals.length === 1 ? "" : "s"}`)).join("")}</ul>` : `<div class="meta">None.</div>`;
  h += addRow(z, state.exhibits.filter(e => e.zone !== z.id).map(e => ["exhibit", e.id, e.zone ? `${e.name} (${zoneName(e.zone)})` : e.name]), "Add an exhibit…");
  h += `</section><section><h3>Buildings</h3>`;
  const zb = b => storeOf(b) || ["station", "breakroom"].includes(b.type);
  h += m.stores.length ? `<ul class="herd">${m.stores.map(b => row("building", b, BUILDINGS[b.type].label)).join("")}</ul>` : `<div class="meta">None.</div>`;
  h += addRow(z, state.buildings.filter(b => zb(b) && b.zone !== z.id).map(b => ["building", b.id, b.zone ? `${BUILDINGS[b.type].label} (${zoneName(b.zone)})` : BUILDINGS[b.type].label]), "Add a building…");
  h += `<div class="row" style="margin-top:8px"><button class="btn" data-action="claimZone">Claim everything inside</button></div></section>`;
  h += `<div class="row"><button class="btn" data-action="center">Center on map</button><button class="btn danger" data-action="demolish">Remove zone</button></div>`;
  return h;
}
function addRow(z, items, label){
  if(!items.length) return "";
  return `<div class="row" style="margin-top:6px"><select data-addzone="${esc(z.id)}" aria-label="${esc(label)}" style="font-size:13px"><option value="">${esc(label)}</option>${items.map(([kind, id, name]) => `<option value="${kind}:${esc(id)}">${esc(name)}</option>`).join("")}</select></div>`;
}

/* ---------- the park office ---------- */

function logiOverviewHtml(){
  const any = state.exhibits.some(e => e.animals.length), hasStores = storesBuilt().length;
  if(!any && !hasStores && !zones().length) return "";
  const sum = stockSummary();
  let h = `<section><h3>Supplies</h3>`;
  const warns = logiWarnings();
  if(warns.length) h += `<ul class="issues">${warns.map(w => `<li class="bad">${esc(w)}</li>`).join("")}</ul>`;
  const rows = FEED_GOODS.filter(t => sum[t].need > 0 || sum[t].have > 0);
  for(const t of rows){
    const x = sum[t], days = x.need ? x.have / x.need : 99;
    h += bar3(goodName(t), x.cap ? x.have / x.cap * 100 : 0, GOOD_COLOR[t], `${Math.floor(x.have)} stored`);
    h += `<div class="meta fnote">Eats ${Math.round(x.need)} a day${x.make ? `, farms make ${x.make}` : ""}. ${x.need ? (days < 1 ? `<b style="color:var(--bad)">Under a day in stores.</b>` : `${days >= 10 ? "10+" : days.toFixed(1)} days in stores.`) : ""}</div>`;
  }
  if(sum.paleoflora.need && hasDept("ceres")) h += bar3("Paleoflora", sum.paleoflora.have / Math.max(1, ceresCap()) * 100, FOOD_COLOR.paleoflora, `${sum.paleoflora.have} at CERES`);
  const L = state.logi;
  if(L.lostDay === state.day - 1 && L.lost >= 1) h += `<div class="meta" style="margin-top:6px">Last night ${Math.round(L.lost)} units spoiled, about ${money(Math.round(L.lostCost))}. Cold stores, cooler boxes, and short supply chains cut that.</div>`;
  h += `<h3 style="margin-top:12px">Work zones</h3>`;
  if(zones().length) h += `<ul class="deptlist">${zones().map(z => { const m = zoneMembers(z); return `<li><button class="btn" data-action="gotoZone" data-id="${esc(z.id)}" style="padding:3px 9px;border-left:6px solid ${z.color}">${esc(z.name)}</button><span>${m.keepers.length} keeper${m.keepers.length === 1 ? "" : "s"}, ${m.exhibits.length} exhibit${m.exhibits.length === 1 ? "" : "s"}, ${m.stores.length} building${m.stores.length === 1 ? "" : "s"}</span></li>`; }).join("")}</ul>`;
  else h += `<div class="meta">Zones group keepers with the exhibits and stores around them. Draw one to split the park into work areas.</div>`;
  h += `<div class="row" style="margin-top:8px"><button class="btn" data-action="zoneTool">Draw a zone</button><button class="btn" data-action="supplyToggle">${supplyOn ? "Hide" : "Show"} supply lines</button></div></section>`;
  return h;
}

/* ---------- clicks ---------- */

panelEl.addEventListener("click", ev => {
  const b = ev.target.closest("[data-action]"); if(!b) return;
  const a = b.dataset.action, it = selItem(), done = () => { afterChange(); render(); };
  if(a === "zoneTool"){ setTool("zone"); return; }
  if(a === "supplyToggle"){ $("#supplyBtn").click(); ui.panel(); return; }
  if(a === "gotoZone"){ select("zone", b.dataset.id); return; }
  if(a === "claimZone" && it && sel.kind === "zone"){
    for(const e of state.exhibits) if(!e.zone && inPoly(...centroid(e.points), it.points)) e.zone = it.id;
    for(const x of state.buildings) if(!x.zone && !x.exhibitId && inPoly(...centroid(x.points), it.points)) x.zone = it.id;
    done(); return;
  }
  if(!it || sel.kind !== "building" || it.type !== "dock") return;
  if(a === "dockAuto"){
    if(it.auto === false) it.auto = true;
    else { it.orders = dockOrders(it); it.auto = false; }
    done(); return;
  }
  if(a === "dockOrd"){ it.orders = it.orders || dockOrders(it); it.orders[b.dataset.t] = clamp((it.orders[b.dataset.t] || 0) + (+b.dataset.d), 0, storeCap(it)); done(); return; }
  if(a === "rush"){ const why = rushOrder(it, b.dataset.t); if(why) ui.toast(why, "bad"); else ui.toast(`Rush delivery of ${LOGI.rushLot} ${goodName(b.dataset.t).toLowerCase()} arrived at the dock.`); done(); return; }
});

panelEl.addEventListener("change", ev => {
  const t = ev.target;
  if(t.dataset.assign){
    const [kind, id] = t.dataset.assign.split(":");
    setZone(kind, id, t.value); afterChange(); render(); return;
  }
  if(t.dataset.addzone && t.value){
    const [kind, id] = t.value.split(":");
    setZone(kind, id, t.dataset.addzone); afterChange(); render();
  }
});
