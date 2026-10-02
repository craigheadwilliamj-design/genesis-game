/* =====================================================================
   MAIN
   Starts the game, runs the clock, and saves your park.
   ===================================================================== */

const SAVE_KEY = "genesis-park-game-v1";
let speed = 1, lastSpeed = 1;
let db = null, playerId = null;

/* ---------- speed ---------- */
function setSpeed(s){
  if(state.over) s = 0;
  if(s) lastSpeed = s;
  speed = s;
  document.querySelectorAll("[data-speed]").forEach(b => b.setAttribute("aria-pressed", +b.dataset.speed === s));
  $("#pausedTag").classList.toggle("on", s === 0);
}
document.querySelectorAll("[data-speed]").forEach(b => b.onclick = () => setSpeed(+b.dataset.speed));

/* ---------- what the simulation tells the screen ---------- */
events.toast = (t, kind) => ui.toast(t, kind);
events.dayEnded = r => {
  const L = r.ledger, row = (a, b) => `<tr><td>${a}</td><td>${b}</td></tr>`;
  const stars = r.rating - r.ratingBefore;
  ui.toast("", "day", `<h4>Day ${r.day} closed. ${r.guests.toLocaleString()} guest${r.guests === 1 ? "" : "s"}</h4><table>
    ${row("Tickets", money(L.tickets))}
    ${L.food + L.shop ? row("Food and gifts", money(L.food + L.shop)) : ""}
    ${L.rewards ? row("Goal rewards", money(L.rewards)) : ""}
    ${L.sold ? row("Sold and refunds", money(L.sold)) : ""}
    ${row("Animal food", "−" + money(L.feed))}
    ${row("Keepers and upkeep", "−" + money(L.wages + L.upkeep))}
    ${L.supplies ? row("Food and gift stock", "−" + money(L.supplies)) : ""}
    ${L.cleaning ? row("Night cleaning", "−" + money(L.cleaning)) : ""}
    ${L.medicine ? row("Medicine", "−" + money(L.medicine)) : ""}
    ${L.science ? row("Research and expeditions", "−" + money(L.science)) : ""}
    ${L.fines ? row("Lawsuits", "−" + money(L.fines)) : ""}
    ${L.repairs ? row("Fence repairs", "−" + money(L.repairs)) : ""}
    ${L.built + L.animals ? row("Building and animals", "−" + money(L.built + L.animals)) : ""}
    <tr class="tot"><td>Profit</td><td>${r.net >= 0 ? "+" : ""}${money(r.net)}</td></tr>
  </table>${L.moodN ? `<div class="meta" style="margin-top:4px">Guests left ${Math.round(L.moodSum / L.moodN)}% happy on average.</div>` : ""}${Math.abs(stars) >= .05 ? `<div class="meta" style="margin-top:4px">Rating ${stars > 0 ? "up" : "down"} to ${r.rating.toFixed(1)} stars.</div>` : ""}`);
  render(); ui.panel(); ui.hud(true);
  saveNow();
};
events.gameOver = () => {
  setSpeed(0);
  if(state.over === "shutdown"){
    $("#dlgOver h2").textContent = "The park has been shut down";
    $("#overText").textContent = `After ${state.safety.deaths} guest deaths from escaped animals, the authorities closed ${state.name} on day ${state.day}. Stronger barriers, moats, and enough keepers with dart guns keep animals where they belong.`;
  } else {
    $("#dlgOver h2").textContent = "The park went bankrupt";
    $("#overText").textContent = `You ran out of money on day ${state.day - 1}, with ${money(state.money)} in the bank. Try building fewer things before the guests arrive, and keep an eye on the bills at closing.`;
  }
  $("#dlgOver").showModal();
};

/* ---------- the clock ---------- */
let lastT = performance.now(), sinceDraw = 0, sincePanel = 0;
let frameErrors = 0;
function frame(now){
  // schedule the next frame first so one exception can't freeze the game for good
  requestAnimationFrame(frame);
  try{ step(now); }
  catch(err){
    console.error(err);
    if(frameErrors++ === 0) ui.toast("Something went wrong in the park simulation. Check the console if it keeps happening.", "bad");
  }
}
function step(now){
  const dt = Math.min(.1, (now - lastT) / 1000); lastT = now;
  if(speed && !state.over){
    tick(dt * speed * MINUTES_PER_SECOND);
    animateAnimals(dt * Math.min(speed, 2));
  }
  drawParties();
  drawKeepers();
  drawLoose();
  ui.hud();
  sinceDraw += dt; sincePanel += dt;
  if(speed && sinceDraw > 1 && !drag && !pinch){ sinceDraw = 0; render(); }
  // refresh the side panel now and then, but not while the mouse is over it (so buttons don't jump)
  if(sincePanel > 1.5 && !document.querySelector("dialog[open]") && !aside.matches(":hover") && !aside.contains(document.activeElement) && !panelEl.querySelector("[data-armed='1']")){ sincePanel = 0; ui.panel(); }
}

/* ---------- saving ---------- */
let saveTimer = null;
function saveSoon(){ clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 2000); }
async function saveNow(){
  clearTimeout(saveTimer);
  state.savedAt = Date.now();
  const json = JSON.stringify(state);
  try{ localStorage.setItem(SAVE_KEY, json); }catch{}
  if(db && playerId){
    try{ await db.doc(`data/users/${playerId}/game`).set({json, savedAt:state.savedAt}); saveInfo("Saved to your account."); }
    catch{ saveInfo("Couldn't save to your account. Saved in this browser."); }
  } else saveInfo("Saved in this browser.");
}
let saveMsg = "";
function saveInfo(t){ saveMsg = t; const el = $("#saveInfo"); if(el) el.textContent = `${t} Your park saves by itself as you play.`; }

function loadLocal(){
  try{ const s = JSON.parse(localStorage.getItem(SAVE_KEY) || "null"); if(s && s.version === 1 && Array.isArray(s.exhibits)) return s; }catch{}
  return null;
}

function startWith(s, fresh){
  state = upgradeSave(s);
  resetParties(); powerShortNotified = -1; repairsHaltedDay = -1;
  herd.forEach(h => h.el.remove()); herd.clear();
  sel = null; if(draw) endDraw(); setTool("select");
  crew = []; mcrew = []; vcrew = []; keeperEls.forEach(el => el.remove()); keeperEls.clear();
  recompute(); buildGuestGraph(); buildKeeperGraph();
  fit(); ui.panel(); ui.hud(true);
  setSpeed(state.over ? 0 : 1);
  if(fresh){ setSpeed(0); $("#dlgIntro").showModal(); }
}

/* ---------- dialogs ---------- */
$("#introGo").onclick = () => { $("#dlgIntro").close(); setSpeed(1); };
$("#dlgIntro").addEventListener("close", () => { if(!speed && !state.over) setSpeed(1); });
$("#menuBtn").onclick = () => { $("#nameInput").value = state.name; saveInfo(saveMsg || "Saved in this browser."); $("#dlgMenu").showModal(); };
$("#closeMenu").onclick = () => $("#dlgMenu").close();
$("#nameInput").addEventListener("input", e => { state.name = e.target.value.slice(0, 40) || "Genesis Park"; ui.hud(true); if(!sel) ui.panel(); saveSoon(); });
$("#howBtn").onclick = () => { $("#dlgMenu").close(); $("#dlgIntro").showModal(); };
$("#newGame").onclick = () => {
  const b = $("#newGame");
  if(b.dataset.armed !== "1"){ b.dataset.armed = "1"; b.textContent = "Tap again. This erases your park"; setTimeout(() => { b.dataset.armed = ""; b.textContent = "Start a new park"; }, 3500); return; }
  b.dataset.armed = ""; b.textContent = "Start a new park";
  $("#dlgMenu").close();
  startWith(newPark(), true); saveNow();
};
$("#overNew").onclick = () => { $("#dlgOver").close(); startWith(newPark(), true); saveNow(); };

document.addEventListener("visibilitychange", () => { if(document.hidden) saveNow(); });
window.addEventListener("resize", () => { if(state) render(); });

/* ---------- start ---------- */
const saved = loadLocal();
startWith(saved || newPark(), !saved);
requestAnimationFrame(frame);

// If this page is running on claude.ai, also keep the save in your account so it follows you between devices
(async () => {
  try{
    if(!window.claude || typeof window.claude.use !== "function") return;
    const [d, u] = await Promise.all([window.claude.use("db"), window.claude.use("user")]);
    if(!d || !u) return;
    const id = await u.id();
    if(!id) return;
    db = d; playerId = id;
    const snap = await db.doc(`data/users/${playerId}/game`).get();
    const data = snap.exists ? snap.data() : null;
    if(data && typeof data.json === "string"){
      const remote = JSON.parse(data.json);
      if(remote && remote.version === 1 && (remote.savedAt || 0) > (state.savedAt || 0) + 5000){
        const wasIntro = $("#dlgIntro").open; if(wasIntro) $("#dlgIntro").close();
        startWith(remote, false);
        ui.toast(`Welcome back to ${remote.name}.`, "good");
        return;
      }
    }
    saveNow();
  }catch{}
})();
