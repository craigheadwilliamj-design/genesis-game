/* =====================================================================
   GUEST SCREENS
   The Guests section of the park office, and the panels for food stands
   and gift shops (with their menus), restrooms, bins, and seats.
   ===================================================================== */

// The park office: who's here, how they feel, and what they're saying
function guestsOverviewHtml(){
  const n = guestCount(), now = moodNow(), L = state.guestLog, t = state.today;
  const left = t.moodN ? t.moodSum / t.moodN : null;
  let h = `<section><h3>Guests</h3><dl class="kv">
    <dt>In the park now</dt><dd>${n.toLocaleString()}${parties.length ? ` in ${parties.length.toLocaleString()} part${parties.length === 1 ? "y" : "ies"}` : ""}</dd>
    ${now != null ? `<dt>Mood right now</dt><dd>${Math.round(now)}%</dd>` : ""}
    ${left != null ? `<dt>Left happy today</dt><dd>${Math.round(left)}%</dd>` : ""}
    ${L.mood != null ? `<dt>Left happy yesterday</dt><dd>${Math.round(L.mood)}%</dd>` : ""}
    ${litterTotal() >= 1 ? `<dt>Litter on the paths</dt><dd>${Math.round(litterTotal())} pieces</dd>` : ""}
    ${t.eduN ? `<dt>Learned today</dt><dd>${Math.round(t.eduSum / t.eduN)} on average</dd>` : L.edu != null ? `<dt>Learned yesterday</dt><dd>${Math.round(L.edu)} on average</dd>` : ""}
    ${hotels().length ? `<dt>Hotel guests today</dt><dd>${parties.filter(p => p.hotel).reduce((s, p) => s + p.n, 0)} in the park, ${state.lodging.last.guests} stayed last night</dd>` : ""}
    ${t.donations + t.edfees >= 1 ? `<dt>Donations and Education Center</dt><dd>${money(Math.round(t.donations + t.edfees))}</dd>` : ""}
    ${t.fares >= 1 ? `<dt>Tram fares today</dt><dd>${money(Math.round(t.fares))}</dd>` : ""}
    ${vandalLog().acts ? `<dt>Vandalism today</dt><dd>${vandalLog().acts} act${vandalLog().acts === 1 ? "" : "s"}, ${vandalLog().caught} caught</dd>` : ""}
  </dl>`;
  if(derived.wom !== 1) h += `<div class="meta" style="margin-top:4px">Word of mouth is ${derived.wom > 1 ? "bringing in" : "costing you"} about ${Math.round(Math.abs(derived.wom - 1) * 100)}% ${derived.wom > 1 ? "more" : "of your"} guests.</div>`;
  const th = topThoughts(5);
  if(th.length) h += `<ul class="issues" style="margin-top:8px">${th.map(x => `<li class="${x.good ? "" : "bad"}"><span>"${esc(x.text)}" <span class="meta">${Math.round(x.share * 100)}%</span></span></li>`).join("")}</ul>`;
  else h += `<div class="meta" style="margin-top:4px">Guests haven't said much yet.</div>`;
  h += `<div class="row" style="margin-top:8px"><button class="btn" data-action="moodColors">${moodColors ? "Show guests' shirts" : "Color guests by mood"}</button></div></section>`;
  return h;
}

// A food stand, gift shop, restroom, Education Center, or anything beside the path
function guestBuildingHtml(b){
  const t = BUILDINGS[b.type], reach = isReachable(b), q = queueAt(b);
  const served = b.served && b.served.day === state.day ? b.served : {n:0, money:0, items:{}};
  let h = `<button class="back" data-action="deselect">‹ Park office</button><h2>${t.label}</h2>`;
  h += `<div class="row"><span class="status ${reach ? "ok" : "no"}">${reach ? "Open to guests" : "No path from the entrance"}</span></div>`;
  if(t.rooms) return h + hotelHtml(b);
  if(t.kind) h += menuHtml(b, served) + vendorStockHtml(b);
  if(t.prop){
    const c = propCond(b), broke = isBroken(b);
    h += `<section><h3>Condition</h3><div class="factor" style="grid-template-columns:1fr 48px"><span>${meter(c, broke ? "var(--bad)" : c < 60 ? "var(--warn)" : "var(--good)")}</span><span>${Math.round(c)}%</span></div>`;
    h += `<div class="meta" style="margin-top:4px">${broke ? "Broken by vandals. It doesn't work until a mechanic repairs it." : c < 60 ? "Damaged by vandals. A mechanic will fix it." : "In good shape."}${b.type === "lamp" ? ` Lamps make vandalism within ${VANDAL.lampReach} m half as likely.` : ""}</div></section>`;
  }
  if(b.type === "sign"){
    h += `<dl class="kv"><dt>Running cost</dt><dd>${money(t.upkeep)} a day</dd></dl>`;
    const [x, y] = centroid(b.points), near = state.exhibits.filter(e => distToEdge(x, y, e.points) <= EDU.signReach);
    h += `<section><h3>Tells guests about</h3>${near.length ? `<ul class="issues">${near.map(e => `<li>${esc(e.name)}${e.animals.length ? "" : ' <span class="meta">empty</span>'}</li>`).join("")}</ul>` : `<div class="meta">No exhibit within ${EDU.signReach} m. Move it closer to a fence.</div>`}`;
    h += `<div class="meta" style="margin-top:6px">Guests who stop at an exhibit with a sign learn about its animals, more so with several species inside. Learning makes guests happier, tidier, and more generous.</div></section>`;
    return h;
  }
  if(b.type === "edcenter") h += eduCenterHtml(b, served);
  if((b.graffiti || 0) >= VANDAL.grossAt) h += `<div class="meta" style="color:var(--bad)">Covered in graffiti. Guests here are put off. ${state.staff.custodians.length ? "A custodian will scrub it off." : "Hire a custodian to scrub it off."}</div>`;
  if(b.type === "camera"){
    h += `<dl class="kv"><dt>Running cost</dt><dd>${money(t.upkeep)} a day</dd><dt>Watches</dt><dd>${SECURITY.postRadius} m around it</dd></dl>`;
    h += `<div class="meta" style="margin-top:6px">${hasTech("cameras") ? "Any vandal it sees sends the nearest guard running." : "Research security cameras at ORACLE or it does nothing."} ${offices().length ? "" : "Build a Security Office with guards, or nobody will answer."}</div>`;
    return h;
  }
  if(b.type === "nofeed"){
    h += `<dl class="kv"><dt>Running cost</dt><dd>${money(t.upkeep)} a day</dd></dl>`;
    const [x, y] = centroid(b.points), near = state.exhibits.filter(e => !e.viv && distToEdge(x, y, e.points) <= THROWN.signReach);
    h += `<section><h3>Protects</h3>${near.length ? `<ul class="issues">${near.map(e => `<li>${esc(e.name)}</li>`).join("")}</ul>` : `<div class="meta">No open exhibit within ${THROWN.signReach} m. Move it closer to a fence.</div>`}`;
    h += `<div class="meta" style="margin-top:6px">Guests are ${Math.round((1 - THROWN.signCut) * 100)}% less likely to throw trash into these exhibits. Trash makes animals ill, and some die. Bins and guards nearby help too.</div></section>`;
    return h;
  }
  if(b.type === "bin"){
    const fill = b.fill || 0, full = fill >= LITTER.binCap;
    h += `<section><h3>Trash</h3><div class="factor" style="grid-template-columns:1fr 70px"><span>${meter(fill / LITTER.binCap * 100, full ? "var(--bad)" : "var(--good)")}</span><span>${Math.round(fill)} of ${LITTER.binCap}</span></div>`;
    h += `<div class="meta" style="margin-top:4px">Guests with a wrapper or cup throw it in a bin within ${LITTER.binReach} m. ${full ? "This one is full, so trash spills onto the path. " : ""}The night crew empties bins after closing.</div></section>`;
  } else if(!t.slots) h += `<dl class="kv"><dt>Running cost</dt><dd>${money(t.upkeep)} a day</dd></dl>`;
  else {
    h += `<dl class="kv"><dt>${t.seats && !t.kind ? "Sitting here now" : "Serving now"}</dt><dd>${q.busy} of ${t.slots} parties</dd>`;
    if(!t.prop) h += `<dt>Waiting in line</dt><dd>${q.waiting} part${q.waiting === 1 ? "y" : "ies"}</dd>`;
    h += `<dt>${t.kind === "merch" ? "Bought something today" : b.type === "edcenter" ? "Visited today" : t.seats && !t.kind ? "Sat down today" : "Served today"}</dt><dd>${served.n.toLocaleString()} guest${served.n === 1 ? "" : "s"}</dd>`;
    if(t.kind || b.type === "edcenter") h += `<dt>Takings today</dt><dd>${money(served.money)}</dd>`;
    h += `<dt>Running cost</dt><dd>${money(t.upkeep)} a day</dd></dl>`;
  }
  if(b.type === "restroom"){
    const dirt = b.dirt || 0;
    h += `<section><h3>Cleanliness</h3><div class="factor" style="grid-template-columns:1fr 48px"><span>${meter(100 - dirt, dirt >= RESTROOM.avoid ? "var(--bad)" : dirt >= RESTROOM.gross ? "var(--warn)" : "var(--good)")}</span><span>${Math.round(100 - dirt)}%</span></div>`;
    h += `<div class="meta" style="margin-top:4px">${dirt >= RESTROOM.avoid ? "Filthy. Only desperate guests will use it." : dirt >= RESTROOM.gross ? "Getting grubby. Guests complain." : "Clean."} It gets dirtier with every visitor, and the night crew scrubs it after closing. More restrooms means each one stays cleaner.</div></section>`;
  }
  const text = {
    restroom:"Free to use. Guests who can't find one in time go home upset.",
    bench:"Tired guests sit down for a rest. It doesn't take bookings: if it's full, they move on.",
    picnic:"Seats a few parties at once. Tired guests sit down for a rest.",
  }[b.type];
  if(text) h += `<div class="meta">${text}</div>`;
  if(!t.prop && q.waiting >= t.slots * 2) h += `<div class="meta" style="color:var(--bad)">The line is getting long. Another ${t.label.toLowerCase()} nearby would help.</div>`;
  return h;
}

// A hotel: tonight's room rate, last night's bookings, how clean it is, and its toiletries
function hotelHtml(b){
  const t = BUILDINGS[b.type], rate = roomRate(b), will = roomWill(b), dirt = b.dirt || 0, bk = b.booked;
  let h = `<section><h3>Room rate</h3><div class="row" style="gap:4px;flex-wrap:nowrap;align-items:center"><button class="btn" data-action="roomRate" data-d="-10" aria-label="Lower the rate" style="padding:2px 9px">−</button><b class="num" style="min-width:56px;text-align:center">${money(rate)}</b><button class="btn" data-action="roomRate" data-d="10" aria-label="Raise the rate" style="padding:2px 9px">+</button><span class="meta">a night</span></div>`;
  h += `<div class="meta" style="margin-top:4px">${will >= 1 ? "Everyone who wants a room will pay this." : will <= 0 ? "Nobody will pay this much." : `About ${Math.round(will * 100)}% of guests will pay this much.`} The usual rate is ${money(t.roomPrice)}.</div></section>`;
  h += `<dl class="kv"><dt>Rooms</dt><dd>${t.rooms}, for ${LODGING.perRoom} guests each</dd><dt>Booked last night</dt><dd>${bk ? `${bk.rooms} room${bk.rooms === 1 ? "" : "s"}, ${money(bk.money || 0)}` : "Not open a night yet"}</dd><dt>Running cost</dt><dd>${money(t.upkeep)} a day</dd></dl>`;
  h += `<section><h3>Cleanliness</h3><div class="factor" style="grid-template-columns:1fr 48px"><span>${meter(100 - dirt, dirt >= 50 ? "var(--bad)" : dirt >= LODGING.cleanAt ? "var(--warn)" : "var(--good)")}</span><span>${Math.round(100 - dirt)}%</span></div>`;
  h += `<div class="meta" style="margin-top:4px">Rooms get dirty every night they're used, and a dirty hotel books fewer rooms. ${state.staff.custodians.length ? "Custodians clean it during the day." : "Hire a custodian to clean it."}</div></section>`;
  h += `<section><h3>Toiletries</h3>${stockRows(b)}<div class="meta" style="margin-top:6px">Each booked room uses ${LODGING.toiletries} units of merchandise. ${guestGoodsFree() ? `Suppliers bring them until day ${state.logi.guestFrom}.` : roomsStocked(b) < t.rooms ? "Running low: custodians restock it from the dock or a warehouse." : "Custodians keep it stocked."}</div></section>`;
  h += `<div class="meta">Each night, some of the day's guests book a room, more at a higher-rated park. Next morning they start the day here, with no ticket to buy and more to spend.</div>`;
  return h;
}
// The Education Center: its entry fee, and what guests get from it
function eduCenterHtml(b){
  const fee = b.fee || 0, will = clamp(1 - PRICE_SENSE * (fee - EDU.centerFee) / EDU.centerFee, 0, 1);
  let h = `<section><h3>Entry fee</h3><div class="row" style="gap:4px;flex-wrap:nowrap;align-items:center"><button class="btn" data-action="eduFee" data-d="-1" aria-label="Lower the fee" style="padding:2px 9px">−</button><b class="num" style="min-width:46px;text-align:center">${fee ? money(fee) : "Free"}</b><button class="btn" data-action="eduFee" data-d="1" aria-label="Raise the fee" style="padding:2px 9px">+</button></div>`;
  h += `<div class="meta" style="margin-top:4px">${fee <= EDU.centerFee ? "Everyone will pay this." : will <= 0 ? "Nobody will pay this much." : `About ${Math.round(will * 100)}% of guests will pay this much.`} The usual price is ${money(EDU.centerFee)}.</div></section>`;
  h += `<div class="meta">Guests spend ${BUILDINGS.edcenter.serveMin} minutes here, sitting through a talk and using the restrooms, and come out knowing far more about prehistoric life. Learning makes them happier, tidier, and more generous, and counts toward your rating.</div>`;
  return h;
}
const cents = n => Number.isInteger(n) ? money(n) : "$" + n.toFixed(2);
// What's on the shelves, and who fills them
function vendorStockHtml(b){
  let h = `<section><h3>Stock</h3>${stockRows(b)}`;
  if(guestGoodsFree()) h += `<div class="meta" style="margin-top:6px">Suppliers deliver straight to your stands and shops until day ${state.logi.guestFrom}. After that, they sell only what's on the shelves: the Delivery Dock orders stock, and custodians carry it here.</div>`;
  else h += `<div class="meta" style="margin-top:6px">${state.staff.custodians.length ? "Custodians restock it from the dock, a warehouse, or a cold store." : "Nobody is restocking it. Build a Custodial Closet and hire a custodian."} Each item uses as many units as it costs you in dollars.</div>`;
  return h + `</section>`;
}
// The Security Office: its guards, and today's trouble
function securityHtml(b){
  let h = deptHead(b) + `<div class="meta">${esc(BUILDINGS.security.blurb)}</div>` + zoneRow("building", b);
  const gs = state.staff.guards, L = vandalLog(), Y = state.guestLog.last.vandal;
  h += `<section><h3>Guards (${gs.length})</h3>`;
  h += gs.length ? `<ul class="herd">${gs.map(m => `<li><span class="dot" style="background:#2B3F6B"></span><span><b>${esc(m.name)}</b>${(gcrew.find(c => c.id === m.id) || {}).riding ? ' <span class="vtag" style="background:#4F6273;color:#fff;border-color:#4F6273">ATV</span>' : ""} <span class="meta">${esc(guardStatus(m))}</span></span>${zoneSelect("guard", m.id, m.zone)}<button class="btn sell" data-action="fireGuard" data-id="${m.id}">Let go</button></li>`).join("")}</ul>` : `<div class="meta">No guards yet.</div>`;
  h += `<div class="row" style="margin-top:8px"><button class="btn" data-action="hireGuard"${canAfford(SECURITY.hireCost) ? "" : " disabled"}>Hire a guard, ${money(SECURITY.hireCost)}</button><span class="meta">${money(SECURITY.wage)} a day each.</span></div></section>`;
  const broken = state.buildings.filter(isBroken).length, tagged = state.buildings.filter(x => (x.graffiti || 0) >= VANDAL.grossAt).length;
  h += `<section><h3>Vandalism</h3><dl class="kv"><dt>Today</dt><dd>${L.acts} act${L.acts === 1 ? "" : "s"}, ${L.caught} caught</dd>${Y ? `<dt>Yesterday</dt><dd>${Y.acts} act${Y.acts === 1 ? "" : "s"}, ${Y.caught} caught</dd>` : ""}<dt>Broken props</dt><dd>${broken}</dd><dt>Buildings with graffiti</dt><dd>${tagged}</dd></dl>`;
  h += `<div class="meta" style="margin-top:6px">About 1 party in ${Math.round(1 / VANDAL.rowdyShare)} is rowdy, and unhappy rowdy guests break things. Vandalism near a guard is ${Math.round((1 - SECURITY.deterCut) * 100)}% rarer, and a guard throws out any vandal within ${SECURITY.catchRadius} m. Lamp posts help, and heavy litter makes it worse. Mechanics fix broken props and custodians scrub off graffiti.</div>`;
  h += `<div class="meta" style="margin-top:6px">${hasTech("cameras") ? `Cameras watch ${SECURITY.cameraRadius} m around each office, and send the nearest guard straight to any vandal they see.` : "Research security cameras at ORACLE so each office watches the paths around it."}</div></section>`;
  return h;
}
// The Custodial Closet: its staff, and what they've been up to
function closetHtml(b){
  let h = deptHead(b) + `<div class="meta">${esc(BUILDINGS.closet.blurb)}</div>` + zoneRow("building", b);
  const cs = state.staff.custodians;
  h += `<section><h3>Custodians (${cs.length})</h3>`;
  h += cs.length ? `<ul class="herd">${cs.map(m => `<li><span class="dot" style="background:#2E8B8B"></span><span><b>${esc(m.name)}</b>${(ccrew.find(c => c.id === m.id) || {}).riding ? ' <span class="vtag" style="background:#4F6273;color:#fff;border-color:#4F6273">ATV</span>' : ""} <span class="meta">${esc(custodianStatus(m))}</span></span>${zoneSelect("custodian", m.id, m.zone)}<button class="btn sell" data-action="fireCust" data-id="${m.id}">Let go</button></li>`).join("")}</ul>` : `<div class="meta">No custodians yet.</div>`;
  h += `<div class="row" style="margin-top:8px"><button class="btn" data-action="hireCust"${canAfford(CUSTODIAN.hireCost) ? "" : " disabled"}>Hire a custodian, ${money(CUSTODIAN.hireCost)}</button><span class="meta">${money(CUSTODIAN.wage)} a day each. Carries ${custCarry()} units of stock a trip.</span></div></section>`;
  const dirty = state.buildings.filter(x => x.type === "restroom" && (x.dirt || 0) >= CUSTODIAN.restroomAt).length;
  const full = state.buildings.filter(x => x.type === "bin" && (x.fill || 0) >= LITTER.binCap * CUSTODIAN.binAt).length;
  const low = state.buildings.filter(x => isVendor(x) && storeOf(x).holds.some(t => storeTarget(x, t) && stockOf(x, t) < storeTarget(x, t) * .35)).length;
  h += `<section><h3>Right now</h3><ul class="issues">
    <li class="${low ? "bad" : ""}">${low ? `${low} stand${low === 1 ? "" : "s"} or shop${low === 1 ? "" : "s"} running low` : "Stands and shops are stocked"}</li>
    <li class="${dirty ? "bad" : ""}">${dirty ? `${dirty} restroom${dirty === 1 ? "" : "s"} need scrubbing` : "Restrooms are clean"}</li>
    <li class="${full ? "bad" : ""}">${full ? `${full} bin${full === 1 ? "" : "s"} need emptying` : "Bins have room"}</li>
    <li class="${litterTotal() >= 10 ? "bad" : ""}">${Math.round(litterTotal())} pieces of litter on the paths</li>
    ${state.buildings.some(x => (x.graffiti || 0) >= VANDAL.grossAt) ? `<li class="bad">${state.buildings.filter(x => (x.graffiti || 0) >= VANDAL.grossAt).length} buildings with graffiti</li>` : ""}</ul>`;
  h += `<div class="meta" style="margin-top:6px">They restock stations, stands, and shops, anything about to run out first, then clean, then top up the rest. Whatever they miss, the night crew cleans up for a fee. The Tool Shed sells litter pickers, janitor carts, and pressure washers for them.</div></section>`;
  return h;
}
// What a stand or shop sells, at what price, and what else it could sell
function menuHtml(b, served){
  const t = BUILDINGS[b.type], menu = menuOf(b);
  let h = `<section><h3>On the menu <span class="meta" style="text-transform:none;letter-spacing:0">${menu.length} of ${t.menuSlots}</span></h3>`;
  if(!menu.length) h += `<div class="card"><b>Nothing for sale yet.</b><div class="meta">Pick what this ${t.label.toLowerCase()} sells below. Guests walk right past an empty one.</div></div>`;
  else h += `<ul class="shop">${menu.map(m => {
    const it = MENU[m.id], will = willPay(m.id, m.price), sold = served.items[m.id] || 0;
    const what = it.fills ? Object.keys(it.fills).map(k => ({hunger:"hunger", thirst:"thirst", energy:"tiredness"}[k])).join(" and ") : null;
    return `<li><span class="nm">${esc(it.label)}<span class="per">${sold} sold today</span></span>
      <span class="row" style="gap:4px;flex-wrap:nowrap;align-items:center"><button class="btn" data-action="menuPrice" data-id="${m.id}" data-d="-1" aria-label="Lower the price" style="padding:2px 9px">−</button><b class="num" style="min-width:46px;text-align:center">${money(m.price)}</b><button class="btn" data-action="menuPrice" data-id="${m.id}" data-d="1" aria-label="Raise the price" style="padding:2px 9px">+</button></span>
      <span class="need">${what ? `Fixes ${what}. ` : ""}Costs you ${cents(it.cost)} each. Usual price ${money(it.price)}.${it.text ? " " + esc(it.text) : ""}</span>
      ${will < 1 ? `<span class="${will < .6 ? "warn" : "need"}">${will <= 0 ? "Nobody will pay this much." : `About ${Math.round(will * 100)}% of guests will pay this much.`}</span>` : ""}
      <span class="need"><button class="btn" data-action="menuDrop" data-id="${m.id}" style="padding:2px 9px">Take off the menu</button></span></li>`;
  }).join("")}</ul>`;
  const more = Object.keys(MENU).filter(id => MENU[id].kind === t.kind && (!MENU[id].only || MENU[id].only === b.type) && !menuItem(b, id));
  if(menu.length < t.menuSlots && more.length) h += `<div class="meta" style="margin:8px 0 4px">Add to the menu:</div><div class="row">${more.map(id => `<button class="btn" data-action="menuAdd" data-id="${id}" style="padding:4px 10px">${esc(MENU[id].label)}</button>`).join("")}</div>`;
  else if(menu.length >= t.menuSlots) h += `<div class="meta" style="margin-top:6px">The menu is full. Take something off to sell something else.</div>`;
  return h + `</section>`;
}

panelEl.addEventListener("click", ev => {
  const b = ev.target.closest("[data-action]"); if(!b) return;
  const a = b.dataset.action, it = selItem();
  if(a === "moodColors"){ moodColors = !moodColors; drawParties(); ui.panel(); return; }
  if(a === "hireGuard"){ const why = hireGuard(); if(why) ui.toast(why, "bad"); afterChange(); return; }
  if(a === "fireGuard"){ state.staff.guards = state.staff.guards.filter(m => m.id !== b.dataset.id); syncGuards(); afterChange(); return; }
  if(a === "hireCust"){ const why = hireCustodian(); if(why) ui.toast(why, "bad"); afterChange(); return; }
  if(a === "fireCust"){ state.staff.custodians = state.staff.custodians.filter(m => m.id !== b.dataset.id); syncCustodians(); afterChange(); return; }
  if(a === "roomRate" && it && isHotel(it)){ it.rate = clamp(roomRate(it) + (+b.dataset.d), 10, BUILDINGS[it.type].roomPrice * 3); ui.panel(); saveSoon(); return; }
  if(a === "eduFee" && it && it.type === "edcenter"){ it.fee = clamp((it.fee || 0) + (+b.dataset.d), 0, EDU.centerFee * 4); ui.panel(); saveSoon(); return; }
  if(!it || sel.kind !== "building" || !isVendor(it)) return;
  if(a === "menuAdd"){ const why = addToMenu(it, b.dataset.id); if(why) ui.toast(why, "bad"); }
  else if(a === "menuDrop") dropFromMenu(it, b.dataset.id);
  else if(a === "menuPrice"){ const m = menuItem(it, b.dataset.id); if(m) setMenuPrice(it, m.id, m.price + (+b.dataset.d)); }
  else return;
  recompute(); ui.panel(); saveSoon();
});
