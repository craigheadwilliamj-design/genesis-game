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
    ${gGraph ? `<dt>Dark paths</dt><dd>${darkStretches} stretch${darkStretches === 1 ? "" : "es"}${darkStretches ? " no lamp lights" : ""}</dd>` : ""}
    ${vandalLog().acts ? `<dt>Vandalism today</dt><dd>${vandalLog().acts} act${vandalLog().acts === 1 ? "" : "s"}, ${vandalLog().caught} caught</dd>` : ""}
  </dl>`;
  if(derived.wom !== 1) h += `<div class="meta" style="margin-top:4px">Word of mouth: ${derived.wom > 1 ? "+" : "−"}${Math.round(Math.abs(derived.wom - 1) * 100)}% guests</div>`;
  const th = topThoughts(5);
  if(th.length) h += `<ul class="issues" style="margin-top:8px">${th.map(x => `<li class="${x.good ? "" : "bad"}"><span>"${esc(x.text)}" <span class="meta">${Math.round(x.share * 100)}%</span></span></li>`).join("")}</ul>`;
  else h += `<div class="meta" style="margin-top:4px">No thoughts yet.</div>`;
  h += `<div class="row" style="margin-top:8px"><button class="btn" data-action="moodColors">${moodColors ? "Show guests' personalities" : "Color guests by mood"}</button></div>`;
  if(!moodColors) h += `<ul class="herd" style="margin-top:8px">${PERS_KEYS.map(k => `<li><span class="dot" style="background:${PERSONALITIES[k].color}"></span><span><b>${esc(PERSONALITIES[k].label)}</b></span></li>`).join("")}</ul>`;
  h += `</section>`;
  return h;
}

/* ---------- one party ---------- */
let guestSelName = "", guestLiveAt = 0;
const NEED_LABELS = {hunger:"Hunger", thirst:"Thirst", bladder:"Restroom", energy:"Tiredness"};
const moodWord = m => m >= 80 ? "Delighted" : m >= 60 ? "Happy" : m >= 40 ? "Okay" : m >= 20 ? "Unhappy" : "Miserable";
const moodColor = m => m >= 60 ? "#3E9B4F" : m >= 35 ? "#E3B23C" : "#D9483B";
// The panel for a tapped party. The numbers inside are filled in (and kept fresh) by guestLive.
function guestHtml(p){
  let h = `<h2>${esc(p.name)}</h2>`;
  h += `<div class="meta">Party of ${p.n}${p.hotel ? " · hotel guests" : ""}${p.sneaked ? " · sneaked in" : ""}</div>`;
  h += `<div class="row" style="margin-top:6px"><span class="status ok" id="gStatus"></span></div>`;
  h += `<section><h3>Happiness <span class="num" id="gMoodN"></span></h3><div class="meter"><i id="gMoodBar"></i></div></section>`;
  h += `<section><h3>Personalities</h3><ul class="herd">${p.pers.map((k, i) => `<li><span class="dot" style="background:${PERSONALITIES[k].color};align-self:flex-start;margin-top:5px"></span><span><b>${esc(PERSONALITIES[k].label)}</b> <span class="meta">${i ? "Secondary" : "Primary"}</span></span></li>`).join("")}</ul></section>`;
  h += `<section><h3>Thoughts</h3><ul class="issues" id="gThoughts"></ul></section>`;
  h += `<section><h3>Needs</h3>${Object.keys(NEEDS).map(k => `<div class="need-row"><span>${NEED_LABELS[k]}</span><span id="gN-${k}"></span></div><div class="meter"><i id="gB-${k}"></i></div>`).join("")}</section>`;
  h += `<section><h3>Wallet</h3><dl class="kv"><dt>Cash</dt><dd id="gCash"></dd><dt>People in the group</dt><dd>${p.n}</dd><dt>Learned</dt><dd id="gEdu"></dd></dl></section>`;
  h += `<section><div class="row"><button class="btn" id="gEject" data-action="ejectGuest"></button></div><div class="meta" id="gEjectNote" style="margin-top:6px"></div></section>`;
  return h;
}
// Keep the open party's panel up to date without redrawing it (so the button doesn't jump under a finger)
function guestLive(force){
  const now = performance.now();
  if(!force && now - guestLiveAt < 250) return;
  guestLiveAt = now;
  const p = selItem();
  if(!p){ const n = guestSelName; select(null); if(n) ui.toast(`The ${n} left the park.`); return; }
  const set = (id, v) => { const el = document.getElementById(id); if(el && el.dataset.v !== String(v)){ el.dataset.v = v; el.textContent = v; } };
  const mood = clamp(p.mood, 0, 100), bar = document.getElementById("gMoodBar");
  if(!bar) return;
  bar.style.width = mood.toFixed(0) + "%"; bar.style.background = moodColor(mood);
  set("gMoodN", `${moodWord(mood)}, ${Math.round(mood)}%`);
  set("gStatus", partyStatus(p));
  for(const [k, d] of Object.entries(NEEDS)){
    const v = p.needs[k], b = document.getElementById("gB-" + k);
    set("gN-" + k, v >= GUEST.desperate ? "Desperate" : v >= d.seek ? "Needs attention" : v >= 25 ? "Getting there" : "Fine");
    if(b){ b.style.width = Math.round(v) + "%"; b.style.background = v >= GUEST.desperate ? "#D9483B" : v >= d.seek ? "#E3B23C" : "#3E9B4F"; }
  }
  set("gCash", money(p.cash));
  set("gEdu", `${Math.round(p.edu || 0)}%`);
  const th = [...(p.notes || []).slice(-4).reverse(), ...[...p.thought].reverse().slice(0, 5).filter(k => THOUGHTS[k]).map(k => THOUGHTS[k])], key = th.map(x => x.text).join("|"), ul = document.getElementById("gThoughts");
  if(ul && ul.dataset.v !== key){
    ul.dataset.v = key;
    ul.innerHTML = th.length ? th.map(x => `<li class="${x.good ? "" : "bad"}"><span>"${esc(x.text)}"</span></li>`).join("") : `<li><span class="meta">Nothing on their mind yet.</span></li>`;
  }
  const why = ejectProblem(p), btn = document.getElementById("gEject");
  const label = p.ejecting === "escort" ? "Being walked out" : p.ejecting ? "Security called" : p.home && p.why === "home" ? "Already leaving" : "Eject from park";
  if(btn){ set("gEject", label); btn.disabled = !!why; }
  set("gEjectNote", why ? (p.ejecting ? "" : why) : isHooligan(p) ? "Hooligan: a guard has to catch them." : "");
}

// A food stand, gift shop, restroom, Education Center, or anything beside the path
function guestBuildingHtml(b){
  const t = BUILDINGS[b.type], reach = isReachable(b), q = queueAt(b);
  const served = b.served && b.served.day === state.day ? b.served : {n:0, money:0, items:{}};
  let h = `<h2>${t.label}</h2>`;
  h += `<div class="row"><span class="status ${reach ? "ok" : "no"}">${reach ? "Open to guests" : "No path from the entrance"}</span></div>`;
  if(t.rooms) return h + hotelHtml(b);
  if(t.kind) h += menuHtml(b, served) + vendorStockHtml(b);
  if(t.prop){
    const c = propCond(b), broke = isBroken(b);
    h += `<section><h3>Condition</h3><div class="factor" style="grid-template-columns:1fr 48px"><span>${meter(c, broke ? "var(--bad)" : c < 60 ? "var(--warn)" : "var(--good)")}</span><span>${Math.round(c)}%</span></div>`;
    h += `<div class="meta" style="margin-top:4px">${broke ? "Broken." : c < 60 ? "Damaged." : "Good."}</div></section>`;
  }
  if(b.type === "sign"){
    h += `<dl class="kv"><dt>Running cost</dt><dd>${money(t.upkeep)} a day</dd></dl>`;
    const [x, y] = centroid(b.points), near = state.exhibits.filter(e => distToEdge(x, y, e.points) <= EDU.signReach);
    h += `<section><h3>Tells guests about</h3>${near.length ? `<ul class="issues">${near.map(e => `<li>${esc(e.name)}${e.animals.length ? "" : ' <span class="meta">empty</span>'}</li>`).join("")}</ul>` : `<div class="meta">No exhibit in range.</div>`}</section>`;
    return h;
  }
  if(b.type === "edcenter") h += eduCenterHtml(b, served);
  if((b.graffiti || 0) >= VANDAL.grossAt) h += `<div class="meta" style="color:var(--bad)">Graffiti.</div>`;
  if(b.type === "camera"){
    h += `<dl class="kv"><dt>Running cost</dt><dd>${money(t.upkeep)} a day</dd><dt>Watches</dt><dd>${SECURITY.postRadius} m around it</dd></dl>`;
    if(!hasTech("cameras") || !offices().length) h += `<div class="meta" style="margin-top:6px;color:var(--bad)">${hasTech("cameras") ? "No Security Office." : "Not researched."}</div>`;
    return h;
  }
  if(b.type === "nofeed"){
    h += `<dl class="kv"><dt>Running cost</dt><dd>${money(t.upkeep)} a day</dd></dl>`;
    const [x, y] = centroid(b.points), near = state.exhibits.filter(e => !e.viv && distToEdge(x, y, e.points) <= THROWN.signReach);
    h += `<section><h3>Protects</h3>${near.length ? `<ul class="issues">${near.map(e => `<li>${esc(e.name)}</li>`).join("")}</ul>` : `<div class="meta">No exhibit in range.</div>`}</section>`;
    return h;
  }
  if(b.type === "quiet"){
    h += `<dl class="kv"><dt>Running cost</dt><dd>${money(t.upkeep)} a day</dd></dl>`;
    const [x, y] = centroid(b.points), near = state.exhibits.filter(e => !e.viv && distToEdge(x, y, e.points) <= QUIET.reach);
    h += `<section><h3>Quiets guests for</h3>${near.length ? `<ul class="issues">${near.map(e => `<li>${esc(e.name)}</li>`).join("")}</ul>` : `<div class="meta">No exhibit in range.</div>`}</section>`;
    return h;
  }
  if(b.type === "donate"){
    h += `<section><h3>Donations</h3><dl class="kv"><dt>Given so far</dt><dd>${money(Math.round(b.gift || 0))}</dd></dl></section>`;
  } else if(b.type === "bin"){
    const fill = b.fill || 0, full = fill >= LITTER.binCap;
    h += `<section><h3>Trash</h3><div class="factor" style="grid-template-columns:1fr 70px"><span>${meter(fill / LITTER.binCap * 100, full ? "var(--bad)" : "var(--good)")}</span><span>${Math.round(fill)} of ${LITTER.binCap}</span></div>`;
    h += `${full ? `<div class="meta" style="margin-top:4px;color:var(--bad)">Full.</div>` : ""}</section>`;
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
    h += `<div class="meta" style="margin-top:4px">${dirt >= RESTROOM.avoid ? "Filthy." : dirt >= RESTROOM.gross ? "Grubby." : "Clean."}</div></section>`;
  }
  if(!t.prop && q.waiting >= t.slots * 2) h += `<div class="meta" style="color:var(--bad)">Long line.</div>`;
  return h;
}

// A hotel: tonight's room rate, last night's bookings, how clean it is, and its toiletries
function hotelHtml(b){
  const t = BUILDINGS[b.type], rate = roomRate(b), will = roomWill(b), dirt = b.dirt || 0, bk = b.booked;
  let h = `<section><h3>Room rate</h3><div class="row" style="gap:4px;flex-wrap:nowrap;align-items:center"><button class="btn" data-action="roomRate" data-d="-10" aria-label="Lower the rate" style="padding:2px 9px">−</button><b class="num" style="min-width:56px;text-align:center">${money(rate)}</b><button class="btn" data-action="roomRate" data-d="10" aria-label="Raise the rate" style="padding:2px 9px">+</button><span class="meta">a night</span></div>`;
  h += `<div class="meta" style="margin-top:4px">${Math.round(will * 100)}% will pay · usual ${money(t.roomPrice)}</div></section>`;
  h += `<dl class="kv"><dt>Rooms</dt><dd>${t.rooms}, for ${LODGING.perRoom} guests each</dd><dt>Booked last night</dt><dd>${bk ? `${bk.rooms} room${bk.rooms === 1 ? "" : "s"}, ${money(bk.money || 0)}` : "Not open a night yet"}</dd><dt>Running cost</dt><dd>${money(t.upkeep)} a day</dd></dl>`;
  h += `<section><h3>Cleanliness</h3><div class="factor" style="grid-template-columns:1fr 48px"><span>${meter(100 - dirt, dirt >= 50 ? "var(--bad)" : dirt >= LODGING.cleanAt ? "var(--warn)" : "var(--good)")}</span><span>${Math.round(100 - dirt)}%</span></div>`;
  h += `</section>`;
  h += `<section><h3>Toiletries</h3>${stockRows(b)}${restockRows(b)}</section>`;
  return h;
}
// The Education Center: its entry fee, and what guests get from it
function eduCenterHtml(b){
  const fee = b.fee || 0, will = clamp(1 - PRICE_SENSE * (fee - EDU.centerFee) / EDU.centerFee, 0, 1);
  let h = `<section><h3>Entry fee</h3><div class="row" style="gap:4px;flex-wrap:nowrap;align-items:center"><button class="btn" data-action="eduFee" data-d="-1" aria-label="Lower the fee" style="padding:2px 9px">−</button><b class="num" style="min-width:46px;text-align:center">${fee ? money(fee) : "Free"}</b><button class="btn" data-action="eduFee" data-d="1" aria-label="Raise the fee" style="padding:2px 9px">+</button></div>`;
  h += `<div class="meta" style="margin-top:4px">${Math.round(will * 100)}% will pay · usual ${money(EDU.centerFee)}</div></section>`;
  h += focusHtml(b) + modulesHtml(b) + museumHtml(b);
  return h;
}
// The center's focus: what it is for. Modules make it stronger.
function focusHtml(b){
  const cur = focusOf(b);
  let h = `<section><h3>Focus</h3><div class="row" style="gap:4px">${Object.entries(EDU_FOCUS).map(([k, f]) => `<button class="btn${cur === k ? " on" : ""}" data-action="eduFocus" data-f="${k}" aria-pressed="${cur === k}" style="padding:4px 10px">${esc(f.label)}</button>`).join("")}</div>`;
  h += `<div class="meta" style="margin-top:6px">${cur ? `Strength ${Math.round(focusPower(b) * 100)}%` : "No focus"}</div></section>`;
  return h;
}
// Modules: what's installed, and a dropdown of researched ones to add
function modulesHtml(b){
  const on = modsOf(b), ready = modsReady(b), locked = Object.values(EDU_MODULES).filter(m => !hasTech(m.tech)).length;
  const boosts = m => Object.keys(m.boost).map(k => `${EDU_FOCUS[k].label} +${Math.round(m.boost[k] * 100)}%`).join(", ");
  let h = `<section><h3>Modules <span class="meta" style="text-transform:none;letter-spacing:0">${on.length} of ${EDU_CENTER.moduleSlots}</span></h3>`;
  if(on.length) h += `<ul class="shop">${on.map(id => { const m = EDU_MODULES[id];
    return `<li><span class="nm">${esc(m.label)}</span><span class="need">${m.live ? `<b>${Math.round(modLive(id) * 100)}% live</b> · ` : ""}+${Math.round(modLearn(id))} learning${m.slots ? `, +${m.slots} seats` : ""} · ${boosts(m)} · ${money(m.upkeep)} a day</span><span class="need"><button class="btn" data-action="modDrop" data-id="${id}" style="padding:2px 9px">Remove</button></span></li>`; }).join("")}</ul>`;
  else h += `<div class="meta">None.</div>`;
  if(on.length < EDU_CENTER.moduleSlots && ready.length) h += `<div class="row" style="margin-top:8px;gap:6px;flex-wrap:nowrap"><select id="modSel" aria-label="Module to add" style="flex:1;min-width:0">${ready.map(id => `<option value="${id}">${esc(EDU_MODULES[id].label)}, ${money(EDU_MODULES[id].price)}</option>`).join("")}</select><button class="btn" data-action="modAdd">Add</button></div>`;
  return h + `</section>`;
}
// The museum: attractions on show, and a dropdown of the events the Time Travel Lab has recorded that aren't up yet
function museumHtml(b){
  const on = showsOf(b), ready = showsReady(b), dn = state.science.dna;
  let h = `<section><h3>Museum attractions <span class="meta" style="text-transform:none;letter-spacing:0">${on.length} of ${MUSEUM.slots}</span></h3>`;
  if(on.length) h += `<ul class="shop">${on.map(id => { const ev = MUSEUM_BY_ID[id];
    return `<li><span class="nm">${esc(ev.name)}<span class="per">${esc(ev.ago)}</span></span><span class="need">+${ev.learn} learning · ${money(ev.upkeep)} a day</span><span class="need"><button class="btn" data-action="showDrop" data-id="${id}" style="padding:2px 9px">Take it down</button></span></li>`; }).join("")}</ul>`;
  else h += `<div class="meta">None.</div>`;
  if(!hasTech(MUSEUM.needTech)) {}
  else if(on.length < MUSEUM.slots && ready.length) h += `<div class="row" style="margin-top:8px;gap:6px;flex-wrap:nowrap"><select id="showSel" aria-label="Attraction to add" style="flex:1;min-width:0">${ready.map(ev => `<option value="${ev.id}">${esc(ev.name)}, ${money(ev.price)}</option>`).join("")}</select><button class="btn" data-action="showAdd">Add</button></div>`;
  return h + `</section>`;
}
const cents = n => Number.isInteger(n) ? money(n) : "$" + n.toFixed(2);
// What's on the shelves, and who fills them
function vendorStockHtml(b){
  return `<section><h3>Stock</h3>${stockRows(b)}${restockRows(b)}</section>`;
}
// Under a stand, shop or hotel's stock: free supply, or how its restock went and a call button
function restockRows(b){
  if(guestGoodsFree()) return `<div class="meta" style="margin-top:6px">Free supply until ${fmtDate(state.logi.guestFrom)}</div>`;
  let h = "";
  if(lowStock(b)) h += `<span class="status no">Running low.</span> `;
  if(b.missed) h += `<span class="status no">Not restocked last night.</span>`;
  return (h ? `<div class="row" style="margin-top:6px">${h}</div>` : "") + callRow(b, "cust");
}
// The Security Office: its guards, and today's trouble
function securityHtml(b){
  let h = deptHead(b) + zoneRow("building", b);
  const L = vandalLog(), Y = state.guestLog.last.vandal;
  h += staffNote("guard");
  h += `<div class="row" style="margin-top:8px"><button class="btn" data-action="hireGuard"${canAfford(SECURITY.hireCost) ? "" : " disabled"}>Hire a guard, ${money(SECURITY.hireCost)}</button></div></section>`;
  const broken = state.buildings.filter(isBroken).length, tagged = state.buildings.filter(x => (x.graffiti || 0) >= VANDAL.grossAt).length;
  h += `<section><h3>Vandalism</h3><dl class="kv"><dt>Today</dt><dd>${L.acts} act${L.acts === 1 ? "" : "s"}, ${L.caught} caught</dd>${Y ? `<dt>Yesterday</dt><dd>${Y.acts} act${Y.acts === 1 ? "" : "s"}, ${Y.caught} caught</dd>` : ""}<dt>Broken props</dt><dd>${broken}</dd><dt>Buildings with graffiti</dt><dd>${tagged}</dd></dl>`;
  h += `</section>`;
  return h;
}
// The Custodial Closet: its staff, and what they've been up to
function closetHtml(b){
  let h = deptHead(b) + zoneRow("building", b);
  h += staffNote("custodian");
  const dirty = state.buildings.filter(x => x.type === "restroom" && (x.dirt || 0) >= CUSTODIAN.restroomAt).length;
  const full = state.buildings.filter(x => x.type === "bin" && (x.fill || 0) >= LITTER.binCap * CUSTODIAN.binAt).length;
  const low = state.buildings.filter(lowStock).length;
  h += `<section><h3>Right now</h3><ul class="issues">
    <li class="${low ? "bad" : ""}">${low ? `${low} stand${low === 1 ? "" : "s"}, shop${low === 1 ? "" : "s"} or hotel${low === 1 ? "" : "s"} running low` : "Stands, shops and hotels are stocked"}</li>
    <li class="${dirty ? "bad" : ""}">${dirty ? `${dirty} restroom${dirty === 1 ? "" : "s"} need scrubbing` : "Restrooms are clean"}</li>
    <li class="${full ? "bad" : ""}">${full ? `${full} bin${full === 1 ? "" : "s"} need emptying` : "Bins have room"}</li>
    <li class="${litterTotal() >= 10 ? "bad" : ""}">${Math.round(litterTotal())} pieces of litter on the paths</li>
    ${state.buildings.some(x => (x.graffiti || 0) >= VANDAL.grossAt) ? `<li class="bad">${state.buildings.filter(x => (x.graffiti || 0) >= VANDAL.grossAt).length} buildings with graffiti</li>` : ""}</ul>`;
  h += `</section>`;
  return h;
}
// What a stand or shop sells, at what price, and what else it could sell
function menuHtml(b, served){
  const t = BUILDINGS[b.type], menu = menuOf(b);
  let h = `<section><h3>On the menu <span class="meta" style="text-transform:none;letter-spacing:0">${menu.length} of ${t.menuSlots}</span></h3>`;
  if(!menu.length) h += `<div class="meta">Nothing for sale.</div>`;
  else h += `<ul class="shop">${menu.map(m => {
    const it = MENU[m.id], will = willPay(m.id, m.price), sold = served.items[m.id] || 0;
    return `<li><span class="nm">${esc(it.label)}<span class="per">${sold} sold today</span></span>
      <span class="row" style="gap:4px;flex-wrap:nowrap;align-items:center"><button class="btn" data-action="menuPrice" data-id="${m.id}" data-d="-1" aria-label="Lower the price" style="padding:2px 9px">−</button><b class="num" style="min-width:46px;text-align:center">${money(m.price)}</b><button class="btn" data-action="menuPrice" data-id="${m.id}" data-d="1" aria-label="Raise the price" style="padding:2px 9px">+</button></span>
      <span class="need">Cost ${cents(it.cost)} · usual ${money(it.price)}</span>
      ${will < 1 ? `<span class="${will < .6 ? "warn" : "need"}">${Math.round(will * 100)}% will pay</span>` : ""}
      <span class="need"><button class="btn" data-action="menuDrop" data-id="${m.id}" style="padding:2px 9px">Remove</button></span></li>`;
  }).join("")}</ul>`;
  const more = Object.keys(MENU).filter(id => MENU[id].kind === t.kind && (!MENU[id].only || MENU[id].only === b.type) && !menuItem(b, id));
  if(menu.length < t.menuSlots && more.length) h += `<div class="row" style="margin-top:8px">${more.map(id => `<button class="btn" data-action="menuAdd" data-id="${id}" style="padding:4px 10px">${esc(MENU[id].label)}</button>`).join("")}</div>`;
  return h + `</section>`;
}

panelEl.addEventListener("click", ev => {
  const b = ev.target.closest("[data-action]"); if(!b) return;
  const a = b.dataset.action, it = selItem();
  if(a === "moodColors"){ moodColors = !moodColors; drawParties(); ui.panel(); return; }
  if(a === "ejectGuest" && sel && sel.kind === "guest"){
    const p = selItem(); if(!p) return;
    const why = ejectGuest(p);
    ui.toast(why || (isHooligan(p) ? `Security is after the ${p.name}. Hooligans won't wait, so a guard has to catch them.` : `Security is on the way. The ${p.name} will wait here.`), why ? "bad" : "");
    guestLive(true); return;
  }
  if(a === "roomRate" && it && isHotel(it)){ it.rate = clamp(roomRate(it) + (+b.dataset.d), 10, BUILDINGS[it.type].roomPrice * 3); ui.panel(); saveSoon(); return; }
  if(a === "eduFocus" && it && it.type === "edcenter"){ it.focus = it.focus === b.dataset.f ? null : b.dataset.f; recompute(); ui.panel(); saveSoon(); return; }
  if(a === "modAdd" && it && it.type === "edcenter"){ const sel = panelEl.querySelector("#modSel"), why = sel ? addMod(it, sel.value) : null; if(why) ui.toast(why, "bad"); else recompute(); ui.panel(); saveSoon(); return; }
  if(a === "modDrop" && it && it.type === "edcenter"){ dropMod(it, b.dataset.id); recompute(); ui.panel(); saveSoon(); return; }
  if(a === "showAdd" && it && it.type === "edcenter"){ const sel = panelEl.querySelector("#showSel"), why = sel ? addShow(it, sel.value) : null; if(why) ui.toast(why, "bad"); else recompute(); ui.panel(); saveSoon(); return; }
  if(a === "showDrop" && it && it.type === "edcenter"){ dropShow(it, b.dataset.id); ui.panel(); saveSoon(); return; }
  if(a === "eduFee" && it && it.type === "edcenter"){ it.fee = clamp((it.fee || 0) + (+b.dataset.d), 0, EDU.centerFee * 4); ui.panel(); saveSoon(); return; }
  if(!it || sel.kind !== "building" || !isVendor(it)) return;
  if(a === "menuAdd"){ const why = addToMenu(it, b.dataset.id); if(why) ui.toast(why, "bad"); }
  else if(a === "menuDrop") dropFromMenu(it, b.dataset.id);
  else if(a === "menuPrice"){ const m = menuItem(it, b.dataset.id); if(m) setMenuPrice(it, m.id, m.price + (+b.dataset.d)); }
  else return;
  recompute(); ui.panel(); saveSoon();
});
