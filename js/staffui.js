/* =====================================================================
   STAFF SCREENS
   The Staff tab in the park office (everyone, hiring, firing) and the
   panel for one tapped worker. Logic is in staff.js.
   ===================================================================== */

const energyColor = e => e > 50 ? "var(--good)" : e > 25 ? "var(--warn)" : "var(--bad)";
const atvTag = () => ' <span class="vtag" style="background:#4F6273;color:#fff;border-color:#4F6273">ATV</span>';

// On a department's panel: how many it has, and a way over to the Staff tab where they're hired
function staffNote(t, extra){
  const T = STAFF_TYPES[t];
  return `<section><h3>${T.plural} (${T.list().length})</h3><div class="meta">${money(T.wage())} a day each. ${extra ? esc(extra) + " " : ""}Hire and fire from the Staff tab in the park office.</div>
    <div class="row" style="margin-top:8px"><button class="btn" data-action="gotoStaff">Open Staff tab</button></div></section>`;
}

// One worker in the Staff tab's list
function staffRowHtml(s, t){
  const T = STAFF_TYPES[t], e = energyOf(s), c = staffCrew(s, t);
  return `<li><span class="dot" style="background:${T.color}"></span><span><b class="staffname" data-action="selStaff" data-id="${s.id}">${esc(s.name)}</b>${c && c.riding ? atvTag() : ""} <span class="meta">${esc(T.status(s))}</span><span class="meta" style="display:block">Energy ${Math.round(e)}%</span>${meter(e, energyColor(e))}</span>` +
    `<span style="display:flex;gap:6px;align-items:center">${zoneSelect(T.zone, s.id, s.zone)}<button class="btn sell" data-action="fireStaff" data-id="${s.id}">Fire</button></span></li>`;
}
function staffTabHtml(){
  const roster = staffRoster(), sci = Object.values(state.science.crew).reduce((a, n) => a + n, 0);
  const wages = roster.reduce((a, r) => a + staffWage(r.t), 0) + Object.entries(state.science.crew).reduce((a, [k, n]) => a + n * SCIENTISTS[k].wage, 0);
  let h = `<div class="meta">${roster.length + sci} staff on the payroll, ${money(wages)} a day. Tap a name to see how they're doing.</div>`;
  for(const t of STAFF_ORDER){
    const T = STAFF_TYPES[t], list = roster.filter(r => r.t === t), ok = T.ok(), cost = T.cost();
    h += `<section><h3>${T.plural} (${list.length})</h3>`;
    h += list.length ? `<ul class="herd">${list.map(r => staffRowHtml(r.s, t)).join("")}</ul>` : `<div class="meta">No ${T.plural.toLowerCase()} yet.</div>`;
    h += `<div class="row" style="margin-top:8px"><button class="btn" data-action="hireStaff" data-t="${t}"${ok && canAfford(cost) ? "" : " disabled"}>Hire a ${T.label.toLowerCase()}, ${money(cost)}</button><span class="meta">${ok ? `${money(T.wage())} a day each` : esc(T.need)}</span></div></section>`;
  }
  h += `<section><h3>Scientists (${sci})</h3><ul class="herd">`;
  for(const [kind, k] of Object.entries(SCIENTISTS)){
    const n = state.science.crew[kind], ok = hasDept(k.dept);
    h += `<li><span class="dot" style="background:#4B3A8C"></span><span><b>${esc(k.plural)}</b> <span class="meta">${n} · ${money(k.wage)} a day each</span>${ok ? "" : `<span class="meta" style="display:block">Build ${esc(BUILDINGS[k.dept].label)} first.</span>`}</span>` +
      `<span style="display:flex;gap:6px;align-items:center"><button class="btn sell" data-action="hireSciTab" data-k="${kind}"${ok && canAfford(k.hireCost) ? "" : " disabled"}>Hire, ${money(k.hireCost)}</button>${n ? `<button class="btn sell" data-action="fireSciAsk" data-k="${kind}">Fire</button>` : ""}</span></li>`;
  }
  return h + `</ul></section>`;
}

/* ---------- one worker ---------- */
let staffSelName = "", staffLiveAt = 0;
const moraleWord = m => m >= 80 ? "Loving the job" : m >= 60 ? "Content" : m >= 40 ? "Getting by" : m >= 20 ? "Fed up" : "Ready to quit";
function staffHtml(s){
  const f = staffById(s.id), T = STAFF_TYPES[f.t];
  let h = `<button class="back" data-action="deselect">‹ Park office</button><h2>${esc(s.name)}</h2>`;
  h += `<div class="meta">${T.label} · ${money(T.wage())} a day</div>`;
  h += `<div class="row" style="margin-top:6px"><span class="status ok" id="sStatus"></span></div>`;
  h += `<section><h3>Energy <span class="num" id="sEnergyN"></span></h3><div class="meter"><i id="sEnergyBar"></i></div></section>`;
  h += `<section><h3>Morale <span class="num" id="sMoraleN"></span></h3><div class="meter"><i id="sMoraleBar"></i></div><div class="meta" style="margin-top:4px">How happy they are with the job.</div></section>`;
  h += `<section><h3>Thoughts</h3><ul class="issues" id="sThoughts"></ul></section>`;
  h += `<section><h3>Work zone</h3>${zones().length ? `<div class="row">${zoneSelect(T.zone, s.id, s.zone)}</div>` : `<div class="meta">Draw a work zone to send them to one part of the park.</div>`}</section>`;
  h += `<section><div class="row"><button class="btn danger" data-action="fireStaff" data-id="${s.id}">Fire ${esc(s.name)}</button></div></section>`;
  return h;
}
// Keep the open worker's panel fresh without redrawing it (so the buttons don't jump)
function staffLive(force){
  const now = performance.now();
  if(!force && now - staffLiveAt < 250) return;
  staffLiveAt = now;
  const s = selItem();
  if(!s){ const n = staffSelName; select(null); if(n) ui.toast(`${n} is no longer on staff.`); return; }
  const f = staffById(s.id), c = staffCrew(s, f.t), e = energyOf(s), m = moraleOf(s), eb = document.getElementById("sEnergyBar");
  if(!eb) return;
  const set = (id, v) => { const el = document.getElementById(id); if(el && el.dataset.v !== String(v)){ el.dataset.v = v; el.textContent = v; } };
  eb.style.width = e.toFixed(0) + "%"; eb.style.background = energyColor(e);
  const mb = document.getElementById("sMoraleBar"); mb.style.width = m.toFixed(0) + "%"; mb.style.background = moodColor(m);
  set("sEnergyN", `${Math.round(e)}%`);
  set("sMoraleN", `${moraleWord(m)}, ${Math.round(m)}%`);
  set("sStatus", STAFF_TYPES[f.t].status(s) + (c && c.riding ? " (on an ATV)" : ""));
  const th = moraleFactors(s, f.t).slice().sort((a, b) => Math.abs(b.w) - Math.abs(a.w)).slice(0, 6), key = th.map(x => x.text).join("|"), ul = document.getElementById("sThoughts");
  if(ul && ul.dataset.v !== key){
    ul.dataset.v = key;
    ul.innerHTML = th.length ? th.map(x => `<li class="${x.good ? "" : "bad"}"><span>"${esc(x.text)}"</span></li>`).join("") : `<li><span class="meta">Nothing on their mind.</span></li>`;
  }
}

// A ring around the worker whose panel is open
const staffRing = document.createElementNS("http://www.w3.org/2000/svg", "g");
staffRing.setAttribute("pointer-events", "none"); staffRing.style.display = "none";
staffRing.innerHTML = `<circle r="8" fill="none" stroke="#fff" stroke-width="3" vector-effect="non-scaling-stroke"/><circle r="8" fill="none" stroke="#1D2B22" stroke-width="1.2" vector-effect="non-scaling-stroke"/>`;
guestLayer.appendChild(staffRing);
function drawStaffRing(){
  const s = sel && sel.kind === "staff" ? staffById(sel.id) : null, c = s && staffCrew(s.s, s.t), at = c && staffPos(c);
  if(at && !hidden34(at[0], at[1])){ staffRing.style.display = ""; staffRing.setAttribute("transform", `translate(${at[0].toFixed(2)} ${at[1].toFixed(2)})${upright()}`); }
  else staffRing.style.display = "none";
}
// The worker under a tap, if there is one (they're drawn as dots, so this is by distance on screen)
function staffAt(cx, cy){
  const w = toWorld(cx, cy);
  let best = null, bd = 14;
  for(const {s, t} of staffRoster()){
    const c = staffCrew(s, t), p = c && c.at && staffPos(c); if(!p) continue;
    const d = Math.hypot((p[0] - w.x) * view.k, (p[1] - w.y) * ky());
    if(d < bd && !hidden34(p[0], p[1])){ bd = d; best = s; }
  }
  return best;
}

panelEl.addEventListener("click", e => {
  const b = e.target.closest("[data-action]"); if(!b) return;
  const a = b.dataset.action;
  if(a === "gotoStaff"){ officeTab = "staff"; select(null); return; }
  if(a === "selStaff"){ staffSelName = (staffById(b.dataset.id) || {s:{name:""}}).s.name; select("staff", b.dataset.id); return; }
  if(a === "hireStaff"){ const why = hireStaff(b.dataset.t); if(why) ui.toast(why, "bad"); afterChange(); render(); return; }
  if(a === "fireStaff"){ staffFireDialog(b.dataset.id); return; }
  if(a === "hireSciTab"){ const why = hireScientist(b.dataset.k); if(why) ui.toast(why, "bad"); afterChange(); render(); return; }
  if(a === "fireSciAsk"){ sciFireDialog(b.dataset.k); return; }
});
