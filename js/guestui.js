/* =====================================================================
   GUEST SCREENS
   The Guests section of the park office, and the panels for food stands,
   gift shops, and restrooms.
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
  </dl>`;
  if(derived.wom !== 1) h += `<div class="meta" style="margin-top:4px">Word of mouth is ${derived.wom > 1 ? "bringing in" : "costing you"} about ${Math.round(Math.abs(derived.wom - 1) * 100)}% ${derived.wom > 1 ? "more" : "of your"} guests.</div>`;
  const th = topThoughts(5);
  if(th.length) h += `<ul class="issues" style="margin-top:8px">${th.map(x => `<li class="${x.good ? "" : "bad"}"><span>"${esc(x.text)}" <span class="meta">${Math.round(x.share * 100)}%</span></span></li>`).join("")}</ul>`;
  else h += `<div class="meta" style="margin-top:4px">Guests haven't said much yet.</div>`;
  h += `<div class="row" style="margin-top:8px"><button class="btn" data-action="moodColors">${moodColors ? "Show guests' shirts" : "Color guests by mood"}</button></div></section>`;
  return h;
}

// A food stand, gift shop, or restroom
function guestBuildingHtml(b){
  const t = BUILDINGS[b.type], reach = isReachable(b), q = queueAt(b);
  const served = b.served && b.served.day === state.day ? b.served : {n:0, money:0};
  let h = `<button class="back" data-action="deselect">‹ Park office</button><h2>${t.label}</h2>`;
  h += `<div class="row"><span class="status ${reach ? "ok" : "no"}">${reach ? "Open to guests" : "No path from the entrance"}</span></div>`;
  h += `<dl class="kv"><dt>Serving now</dt><dd>${q.busy} of ${t.slots} parties</dd><dt>Waiting in line</dt><dd>${q.waiting} part${q.waiting === 1 ? "y" : "ies"}</dd>`;
  h += `<dt>${b.type === "shop" ? "Bought something today" : "Served today"}</dt><dd>${served.n.toLocaleString()} guest${served.n === 1 ? "" : "s"}</dd>`;
  if(t.perGuest) h += `<dt>Takings today</dt><dd>${money(served.money)}</dd>`;
  if(b.type === "food") h += `<dt>Prices</dt><dd>Meal ${money(t.perGuest)}, drink ${money(t.drink)}</dd>`;
  if(b.type === "shop") h += `<dt>Souvenirs</dt><dd>${money(t.perGuest)} each</dd>`;
  h += `<dt>Running cost</dt><dd>${money(t.upkeep)} a day</dd></dl>`;
  const text = {
    food:"Hungry and thirsty guests walk to the nearest stand without a long line. Guests who can't find food get grumpy.",
    shop:"Happy guests stop for a souvenir on their way out. Grumpy ones walk straight past.",
    restroom:"Free to use. Guests who can't find one in time go home upset.",
  }[b.type];
  if(text) h += `<div class="meta">${text}</div>`;
  if(q.waiting >= t.slots * 2) h += `<div class="meta" style="color:var(--bad)">The line is getting long. Another ${t.label.toLowerCase()} nearby would help.</div>`;
  return h;
}

panelEl.addEventListener("click", ev => {
  const b = ev.target.closest("[data-action]"); if(!b) return;
  if(b.dataset.action === "moodColors"){ moodColors = !moodColors; drawParties(); ui.panel(); }
});
