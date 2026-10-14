/* ---------- one animal: name, mood, needs and what's bothering it ---------- */
let animalSelName = "", animalLiveAt = 0;
const ANIMAL_NAME_MAX = 24;
const animalHome = id => state.exhibits.find(e => e.animals.some(a => a.id === id)) || null;
// How an animal is doing overall, 0 to 100: the exhibit's happiness, pulled down by its own unmet needs
function animalMood(a, e){
  const n = needsOf(a), worry = (n.hunger + n.thirst + n.discomfort + n.lonely + n.bored + n.stress) / NEED_KEYS.length;
  return clamp(((e.happy ?? 70) * 2 + (100 - worry)) / 3, 0, 100);
}
// What's bothering it: its stress sources plus unmet needs and the exhibit's own bad points
function animalStressors(a, e, s){
  const out = [], n = needsOf(a);
  stressTarget(e, a, s, behaviorCtx(e), out);
  if(n.hunger >= 60) out.push("it's hungry");
  if(n.thirst >= 60) out.push("it's thirsty");
  if(n.lonely >= 60) out.push("it's lonely");
  if(n.bored >= 60) out.push("it's bored");
  if(a.sick) out.push("it's sick or hurt");
  const ex = exposure(e); if(ex >= .4 && !out.some(t => /weather/.test(t))) out.push("it's out in the weather");
  const rep = derived.reports && derived.reports[e.id];
  if(rep) for(const i of rep.issues) if(i.bad) out.push(i.text.replace(/\.$/, ""));
  return [...new Set(out)];
}
function animalHtml(a){
  const e = animalHome(a.id), s = SPECIES_BY_ID[a.sp];
  let h = `<button class="back" data-action="deselect">‹ ${esc(e ? e.name : "Park office")}</button>`;
  h += `<label class="field"><span>Name</span><input id="aName" data-field="aname" value="${esc(a.name || "")}" maxlength="${ANIMAL_NAME_MAX}"></label>`;
  h += `<div class="meta">${esc(s.name)} · ${esc(s.period)}${e ? " · in " + esc(e.name) : ""}${a.cl ? " · clone" : ""} · ${a.q ?? 90}% DNA${a.sex ? ` · <b title="${a.sex}">${sexMark(a)}</b> ${a.sex}` : ""}</div>`;
  const rp = e ? rankPos(e, a) : null;
  if(rp) h += `<div class="meta">${rp.pack ? (rp.i < 2 ? "Alpha pair" : "Subordinate, rank " + (rp.i + 1)) : rp.i === 0 ? "Alpha" : "Rank " + (rp.i + 1)} of ${rp.n} in the ${traitsOf(s).social}</div>`;
  h += `<div class="row" style="margin-top:6px"><span class="status ok" id="anStatus"></span></div>`;
  h += `<section><h3>Happiness <span class="num" id="anMoodN"></span></h3><div class="meter"><i id="anMoodBar"></i></div></section>`;
  h += `<section><h3>Needs</h3>${NEED_KEYS.map(k => `<div class="need-row"><span>${NEED_TEXT[k]}</span><span id="anN-${k}"></span></div><div class="meter"><i id="anB-${k}"></i></div>`).join("")}</section>`;
  h += `<section><h3>Wants</h3><ul class="issues" id="anWants"></ul></section>`;
  h += `<section><h3>What's bothering it</h3><ul class="issues" id="anStress"></ul></section>`;
  return h;
}
// Keep the open animal's panel fresh without redrawing it (so the name field keeps its cursor)
function animalLive(force){
  const now = performance.now();
  if(!force && now - animalLiveAt < 250) return;
  animalLiveAt = now;
  const a = selItem(), e = a && animalHome(a.id);
  if(!a || !e){ const n = animalSelName; select(null); if(n) ui.toast(`${n} is no longer in the park.`); return; }
  const bar = document.getElementById("anMoodBar"); if(!bar) return;
  const s = SPECIES_BY_ID[a.sp], n = needsOf(a), mood = animalMood(a, e);
  const set = (id, v) => { const el = document.getElementById(id); if(el && el.dataset.v !== String(v)){ el.dataset.v = v; el.textContent = v; } };
  bar.style.width = mood.toFixed(0) + "%"; bar.style.background = moodColor(mood);
  set("anMoodN", `${moodWord(mood)}, ${Math.round(mood)}%`);
  set("anStatus", actLabel(a) + (a.act === "pace" && a.why ? ` (${whyText[a.why] || a.why})` : "") + (a.sick ? ", unwell" : ""));
  for(const k of NEED_KEYS){
    const v = n[k], b = document.getElementById("anB-" + k);
    set("anN-" + k, v >= 75 ? "Desperate" : v >= 50 ? "Needs attention" : v >= 25 ? "Getting there" : "Fine");
    if(b){ b.style.width = Math.round(v) + "%"; b.style.background = v >= 75 ? "#D9483B" : v >= 50 ? "#E3B23C" : "#3E9B4F"; }
  }
  const fill = (id, list, none, bad) => {
    const ul = document.getElementById(id), key = list.join("|");
    if(ul && ul.dataset.v !== key){ ul.dataset.v = key; ul.innerHTML = list.length ? list.map(t => `<li class="${bad ? "bad" : ""}"><span>${esc(t)}</span></li>`).join("") : `<li><span class="meta">${none}</span></li>`; }
  };
  const T = traitsOf(s), w = [];
  const first = k => ({hunger:"food from the keepers", thirst:"water to drink", discomfort:"cover from the weather and a clean exhibit", lonely:`company: ${T.social === "solitary" ? "it'd rather be alone" : "others of its kind"}`, bored:"something to do: enrichment, plants and room", stress:"peace and quiet"})[k];
  for(const k of NEED_KEYS) if(n[k] >= 50) w.push(first(k));
  fill("anWants", w, "It wants for nothing right now.", false);
  fill("anStress", animalStressors(a, e, s), "Nothing, it seems.", true);
}
// Where an animal's picture is, in the upright frame at its spot (meters; screen pixels are these times view.k): the box's center above the spot and its half sizes.
// Mirrors spriteSvg / rigSvg (and animalUp's lift in the 3/4 view); a dot is a circle of radius r on its spot.
function animalBox(h){
  const r = h.r || 1, S = SPRITES[h.sp], lift = tilt ? -r * (h.spr ? .5 : .85) : 0;
  if(!h.spr || !S) return {oy: lift, hw: r, hh: r};
  const R = !h.viv && rigOf(h.sp), w = r * (h.viv ? 4 : 2.5) * (S.size || 1), ht = R ? w * R.h / R.w : w / S.ratio;
  return {oy: lift + r * .5 - ht / 2, hw: w / 2, hh: ht / 2};
}
// A ring around the animal whose panel is open
const animalRing = document.createElementNS("http://www.w3.org/2000/svg", "g");
animalRing.setAttribute("pointer-events", "none"); animalRing.style.display = "none";
animalRing.innerHTML = `<circle r="8" fill="none" stroke="#fff" stroke-width="3" vector-effect="non-scaling-stroke"/><circle r="8" fill="none" stroke="#1D2B22" stroke-width="1.2" vector-effect="non-scaling-stroke"/>`;
guestLayer.appendChild(animalRing);
function drawAnimalRing(){
  const h = sel && sel.kind === "animal" ? herd.get(sel.id) : null;
  if(h && !hidden34(h.x, h.y)){
    const b = animalBox(h);
    animalRing.style.display = ""; animalRing.setAttribute("transform", `translate(${h.x.toFixed(2)} ${h.y.toFixed(2)})${upright()} translate(0 ${b.oy.toFixed(2)})`);
    const r = Math.max(8 / view.k, Math.max(b.hw, b.hh) * 1.1); for(const c of animalRing.children) c.setAttribute("r", r.toFixed(2));
  } else animalRing.style.display = "none";
}
// The animal under a tap: the picture's box on screen (at least a finger wide), the nearest center wins when they overlap
function animalAt(cx, cy){
  const w = toWorld(cx, cy);
  let best = null, bd = Infinity;
  for(const [id, h] of herd){
    if(!h.placed || hidden34(h.x, h.y)) continue;
    const b = animalBox(h), dx = (w.x - h.x) * view.k, dy = (w.y - h.y) * ky() - b.oy * view.k;
    const rx = Math.max(12, b.hw * view.k), ry = Math.max(12, b.hh * view.k), n = Math.hypot(dx / rx, dy / ry);
    if(n > 1.15) continue;   // the box's corners count a little
    const d = Math.hypot(dx, dy);
    if(d < bd){ bd = d; best = id; }
  }
  return best ? animalById(best) : null;
}
function animalById(id){ for(const e of state.exhibits) for(const a of e.animals) if(a.id === id) return a; return null; }
// Rename: tidy and keep it short; a blank name keeps the old one
function renameAnimal(a, v){
  v = String(v).replace(/\s+/g, " ").slice(0, ANIMAL_NAME_MAX).trim();
  if(v) a.name = v;
  return a.name;
}
panelEl.addEventListener("input", ev => {
  if(ev.target.dataset.field !== "aname" || !sel || sel.kind !== "animal") return;
  const a = selItem(); if(!a) return;
  const v = ev.target.value.slice(0, ANIMAL_NAME_MAX); if(v.trim()){ a.name = v; animalSelName = v; saveSoon(); }
});
panelEl.addEventListener("change", ev => {
  if(ev.target.dataset.field !== "aname" || !sel || sel.kind !== "animal") return;
  const a = selItem(); if(!a) return;
  ev.target.value = animalSelName = renameAnimal(a, ev.target.value); saveSoon();
});
