/* ---------- UI editor (dev mode only) ----------
   Live-edit the game's look from inside the game: pick any element and change its styles, drag and resize
   the HUD pieces, retune the color variables, or type free CSS. Edits are rules in one <style id="uiedLive">
   and live in localStorage (never in `state`). The Export tab gives the CSS to hand over for baking in. */
const UIED_KEY = "genesis-uiedit";
const UIED_PROPS = [
  ["Text", ["color", "font-size", "font-weight", "font-family", "line-height", "letter-spacing", "text-align"]],
  ["Box", ["background-color", "background", "padding", "margin", "gap", "border", "border-radius", "box-shadow", "opacity"]],
  ["Size", ["width", "height", "min-width", "max-width", "max-height"]],
  ["Layout", ["display", "flex-direction", "justify-content", "align-items", "position", "top", "right", "bottom", "left", "z-index", "translate"]],
];
const UIED_COLOR_PROPS = /^(color|background-color|border-color|outline-color|fill|stroke)$/;
// HUD pieces the Layout tab can drag and resize (label, selector). Missing or hidden ones are skipped.
const UIED_REGIONS = [
  ["Top bar", "header.hud"], ["Money", "#roMoney"], ["Stars", "#rating"], ["Guests", "#roGuests"], ["Weather", "#roWeather"],
  ["Clock", "header.hud .clockbox"], ["Speed", "header.hud .speed"], ["Menu button", "#menuBtn"],
  ["Tool column", ".tools"], ["Build tray", ".sidebody"], ["Right buttons", "#rtools"], ["Zoom", ".zoombar"],
  ["Draw bar", "#drawbar"], ["Paused tag", "#pausedTag"], ["Toasts", "#toasts"],
];
const UIED = {open:false, tab:"pick", mode:null, el:null, sel:"", hover:null, reg:"", store:null, stack:[], ov:new Map(), raf:0, src:null, sure:0};

function uiedLoad(){
  let s = null;
  try{ s = JSON.parse(localStorage.getItem(UIED_KEY) || "null"); }catch{}
  s = s && typeof s === "object" ? s : {};
  s.vars = s.vars || {}; s.vars.light = s.vars.light || {}; s.vars.dark = s.vars.dark || {};
  s.rules = s.rules || {}; s.css = typeof s.css === "string" ? s.css : ""; s.regions = Array.isArray(s.regions) ? s.regions : [];
  UIED.store = s;
}
function uiedSave(){ try{ localStorage.setItem(UIED_KEY, JSON.stringify(UIED.store)); }catch{} uiedApply(); }
function uiedIsDark(){
  const t = document.documentElement.dataset.theme;
  return t === "dark" || (t !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
}
const uiedRuleText = (sel, o) => `${sel}{${Object.entries(o).map(([p, v]) => `${p}:${v} !important`).join(";")}}`;
function uiedCss(forExport){
  const s = UIED.store, out = [];
  const vars = th => Object.entries(s.vars[th]).map(([k, v]) => `${k}:${v}`).join(";");
  if(forExport){
    if(vars("light")) out.push(`/* Colors, light theme (index.html :root) */\n:root{${vars("light")}}`);
    if(vars("dark")) out.push(`/* Colors, dark theme (index.html dark :root blocks) */\n:root{${vars("dark")}}`);
  } else {
    const v = vars(uiedIsDark() ? "dark" : "light");
    if(v) out.push(`:root:root:root{${v}}`);   // beats the theme blocks
  }
  const rules = Object.entries(s.rules).filter(([, o]) => Object.keys(o).length);
  if(rules.length) out.push((forExport ? "/* Element edits (forced with !important so they win over inline styles) */\n" : "") + rules.map(([sel, o]) => uiedRuleText(sel, o)).join("\n"));
  if(s.css.trim()) out.push((forExport ? "/* Free CSS */\n" : "") + s.css.trim());
  return out.join("\n\n");
}
function uiedApply(){
  let st = document.getElementById("uiedLive");
  if(!st){ st = document.createElement("style"); st.id = "uiedLive"; document.head.appendChild(st); }
  const css = devMode() && UIED.store ? uiedCss(false) : "";
  if(st.textContent !== css) st.textContent = css;
}
// Undo: states before each edit burst. A snapshot is taken when an editor input gets focus or a drag starts.
function uiedSnap(){
  const j = JSON.stringify(UIED.store);
  if(UIED.stack[UIED.stack.length - 1] !== j){ UIED.stack.push(j); if(UIED.stack.length > 80) UIED.stack.shift(); }
}
function uiedUndo(){
  const j = JSON.stringify(UIED.store);
  while(UIED.stack.length && UIED.stack[UIED.stack.length - 1] === j) UIED.stack.pop();
  if(!UIED.stack.length){ ui.toast("Nothing to undo."); return; }
  UIED.store = JSON.parse(UIED.stack.pop()); uiedSave(); uiedRender();
}
function uiedSet(sel, prop, val){
  const r = UIED.store.rules;
  val = String(val ?? "").trim();
  if(!val || val === "none" && prop === "translate"){ if(r[sel]){ delete r[sel][prop]; if(!Object.keys(r[sel]).length) delete r[sel]; } }
  else (r[sel] = r[sel] || {})[prop] = val;
  uiedSave();
}

/* ---------- selectors ---------- */
function uiedPath(el){
  const parts = [];
  for(let n = el; n && n.nodeType === 1 && n !== document.body && parts.length < 5; n = n.parentElement){
    if(n.id){ parts.unshift("#" + CSS.escape(n.id)); break; }
    let p = n.localName; const c = [...n.classList][0];
    if(c) p += "." + CSS.escape(c);
    const sib = n.parentElement ? [...n.parentElement.children].filter(x => x.localName === n.localName) : [];
    if(sib.length > 1) p += `:nth-of-type(${sib.indexOf(n) + 1})`;
    parts.unshift(p);
  }
  return parts.join(" > ");
}
function uiedCands(el){
  const list = [], cls = [...el.classList].map(c => "." + CSS.escape(c));
  if(el.id) list.push("#" + CSS.escape(el.id));
  if(cls.length > 1) list.push(cls.join(""));
  cls.slice(0, 4).forEach(c => list.push(c));
  list.push(uiedPath(el));
  return [...new Set(list)].map(s => { let n = 0; try{ n = document.querySelectorAll(s).length; }catch{} return {s, n}; });
}
const uiedCount = s => { try{ return document.querySelectorAll(s).length; }catch{ return -1; } };
function uiedSelect(el){
  UIED.el = el; if(!el){ UIED.sel = ""; uiedRender(); return; }
  const c = uiedCands(el); UIED.sel = (el.id ? c[0] : c.find(x => x.s.startsWith(".")) || c[c.length - 1]).s;
  UIED.src = null; uiedRender();
}
function uiedName(el){ return el.localName + (el.id ? "#" + el.id : "") + [...el.classList].slice(0, 2).map(c => "." + c).join(""); }

/* ---------- reading colors ---------- */
let uiedCv = null;
function uiedHex(v){   // "#rrggbb" for an opaque color string, else null
  uiedCv = uiedCv || document.createElement("canvas").getContext("2d");
  uiedCv.fillStyle = "#010203"; uiedCv.fillStyle = String(v).trim();
  const r = uiedCv.fillStyle;
  return /^#[0-9a-f]{6}$/i.test(r) && !(r === "#010203" && !/^#?010203$/.test(String(v).trim())) ? r : null;
}
function uiedVarNames(){
  const names = new Set();
  const walk = rs => { for(const r of rs){
    if(r.selectorText){ if(/:root/.test(r.selectorText)) for(const p of r.style) if(p.startsWith("--")) names.add(p); }
    else if(r.cssRules) walk(r.cssRules);
  } };
  for(const sh of document.styleSheets){ if(sh.ownerNode && sh.ownerNode.id === "uiedLive") continue; try{ walk(sh.cssRules); }catch{} }
  return [...names];
}

/* ---------- where an element comes from ---------- */
function uiedMatched(el){
  const out = [];
  const walk = (rs, media) => { for(const r of rs){
    if(r.selectorText){ try{ if(el.matches(r.selectorText)) out.push({sel:r.selectorText, body:r.style.cssText, media}); }catch{} }
    else if(r.cssRules) walk(r.cssRules, r.conditionText || media);
  } };
  for(const sh of document.styleSheets){ if(sh.ownerNode && sh.ownerNode.id === "uiedLive") continue; try{ walk(sh.cssRules, ""); }catch{} }
  return out;
}
let uiedJs = null;   // script texts, fetched once when you first look for sources
function uiedScripts(){
  uiedJs = uiedJs || Promise.all([...document.scripts].filter(s => s.src && !/spritepack|uiedit/.test(s.src)).map(async s => {
    try{ return {name:s.getAttribute("src"), lines:(await (await fetch(s.src)).text()).split("\n")}; }catch{ return null; }
  })).then(a => a.filter(Boolean));
  return uiedJs;
}
async function uiedSource(el){
  const toks = [...(el.id ? [el.id] : []), ...el.classList];
  if(!toks.length) return [];
  if(location.protocol === "file:") return null;   // the browser won't read scripts from disk
  const files = await uiedScripts();
  if(!files.length) return null;
  const hits = toks.map(t => {
    const re = new RegExp("(^|[^\\w-])" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^\\w-]|$)"), found = [];
    for(const f of files) f.lines.forEach((ln, i) => { if(re.test(ln)) found.push(`${f.name}:${i + 1}  ${ln.trim().slice(0, 110)}`); });
    return found;
  }).filter(h => h.length);
  hits.sort((a, b) => a.length - b.length);
  return hits.length ? hits[0].slice(0, 6) : [];
}

/* ---------- panel ---------- */
const uiedEl = id => document.getElementById(id);
function uiedBuild(){
  if(uiedEl("uied")) return;
  const css = document.createElement("style");
  css.textContent = `
#uied{position:fixed;left:0;top:0;width:0;height:0;z-index:100000;font:12px/1.35 system-ui,sans-serif;color:#E6EDE2}
#uied *{box-sizing:border-box}
.uied-win{position:fixed;right:12px;top:56px;width:350px;max-height:calc(100vh - 72px);display:flex;flex-direction:column;background:#17212B;border:1px solid #3B4D5E;border-radius:8px;box-shadow:0 8px 28px rgba(0,0,0,.5);overflow:hidden}
.uied-head{display:flex;align-items:center;gap:6px;padding:6px 8px;background:#223142;cursor:move;touch-action:none;user-select:none}
.uied-head b{flex:1;font-size:13px}
.uied-tabs{display:flex;gap:2px;padding:4px 6px;background:#1B2835;border-bottom:1px solid #2D3E4E}
.uied-tabs button{flex:1}
.uied-body{overflow:auto;padding:8px 10px 12px}
#uied button{font:inherit;color:#E6EDE2;background:#2C3E50;border:1px solid #46607A;border-radius:5px;padding:3px 8px;cursor:pointer}
#uied button:hover{background:#38506A}
#uied button.on,#uied button[aria-pressed=true]{background:#E9C766;color:#1D2B22;border-color:#B8912F}
#uied input,#uied select,#uied textarea{font:inherit;color:#E6EDE2;background:#0E161E;border:1px solid #3B4D5E;border-radius:4px;padding:3px 5px;min-width:0}
#uied input[type=color]{padding:0;width:26px;height:22px;flex:none;background:none}
#uied textarea{width:100%;min-height:200px;font:11px/1.4 ui-monospace,monospace;resize:vertical;white-space:pre}
#uied h4{margin:12px 0 4px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#8FA6BC}
#uied .row{display:flex;gap:6px;align-items:center;margin:3px 0}
#uied .row>label{width:92px;flex:none;color:#A9BBCB;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#uied .row>input[type=text],#uied .row>input:not([type]){flex:1}
#uied .row.chg>label{color:#E9C766}
#uied .x{padding:0 6px;color:#F2867D}
#uied .hint{color:#8FA6BC;margin:4px 0}
#uied .chips{display:flex;flex-wrap:wrap;gap:3px;margin:4px 0}
#uied .chips button{padding:1px 6px;font-size:11px}
#uied pre{margin:3px 0;padding:4px 6px;background:#0E161E;border-radius:4px;white-space:pre-wrap;word-break:break-all;font:11px/1.35 ui-monospace,monospace;color:#B9C8D6}
#uied pre.pick{cursor:pointer}#uied pre.pick:hover{outline:1px solid #E9C766}
.uied-box{position:fixed;pointer-events:none;border:2px solid #4DB6FF;background:rgba(77,182,255,.12);display:none}
.uied-box.sel{border:2px dashed #E9C766;background:none}
.uied-box i{position:absolute;left:-2px;top:-17px;background:#4DB6FF;color:#04111C;font:10px/14px system-ui;padding:0 4px;font-style:normal;white-space:nowrap}
.uied-ov{position:fixed;border:2px dashed #E9C766;background:rgba(233,199,102,.16);cursor:move;touch-action:none;display:none}
.uied-ov.cur{background:rgba(233,199,102,.32);border-style:solid}
.uied-ov i{position:absolute;left:0;top:-16px;background:#E9C766;color:#1D2B22;font:10px/14px system-ui;padding:0 4px;font-style:normal;white-space:nowrap;pointer-events:none}
.uied-ov b{position:absolute;right:-6px;bottom:-6px;width:12px;height:12px;background:#E9C766;border:1px solid #1D2B22;cursor:nwse-resize}`;
  document.head.appendChild(css);
  const root = document.createElement("div"); root.id = "uied"; root.hidden = true;
  root.innerHTML = `<div class="uied-win" id="uiedWin">
    <div class="uied-head" id="uiedHead"><b>UI editor</b><button data-a="undo" title="Undo (Ctrl+Z)">↶ Undo</button><button data-a="close" title="Close">✕</button></div>
    <div class="uied-tabs" id="uiedTabs"></div><div class="uied-body" id="uiedBody"></div></div>
    <div class="uied-box" id="uiedHover"><i></i></div><div class="uied-box sel" id="uiedSelBox"><i></i></div>`;
  document.body.appendChild(root);
  // drag the window by its header
  uiedEl("uiedHead").addEventListener("pointerdown", e => {
    if(e.target.closest("button")) return;
    const w = uiedEl("uiedWin"), r = w.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
    e.currentTarget.setPointerCapture(e.pointerId);
    const mv = m => { w.style.left = Math.max(0, Math.min(innerWidth - 80, m.clientX - dx)) + "px"; w.style.top = Math.max(0, Math.min(innerHeight - 40, m.clientY - dy)) + "px"; w.style.right = "auto"; };
    const up = () => { e.currentTarget.removeEventListener("pointermove", mv); e.currentTarget.removeEventListener("pointerup", up); };
    e.currentTarget.addEventListener("pointermove", mv); e.currentTarget.addEventListener("pointerup", up);
  });
  const win = uiedEl("uiedWin");
  win.addEventListener("keydown", e => e.stopPropagation());   // typing here is never a game hotkey
  win.addEventListener("focusin", e => { if(e.target.matches("input,textarea,select")) uiedSnap(); });
  win.addEventListener("click", uiedClick);
  win.addEventListener("input", uiedInput);
  win.addEventListener("change", uiedChange);
  win.addEventListener("keydown", uiedStep);
}
const UIED_TABS = [["pick", "Pick"], ["layout", "Layout"], ["colors", "Colors"], ["css", "CSS"], ["export", "Export"]];
function uiedRender(){
  if(!UIED.open) return;
  uiedEl("uiedTabs").innerHTML = UIED_TABS.map(([k, n]) => `<button data-a="tab" data-k="${k}" ${UIED.tab === k ? 'class="on"' : ""}>${n}</button>`).join("");
  const body = uiedEl("uiedBody"), keep = body.scrollTop;
  body.innerHTML = ({pick:uiedPickHtml, layout:uiedLayoutHtml, colors:uiedColorsHtml, css:uiedCssHtml, export:uiedExportHtml})[UIED.tab]();
  body.scrollTop = keep;
  if(UIED.tab === "pick" && UIED.el) uiedLoadSource();
}
function uiedRow(sel, p){
  const ov = (UIED.store.rules[sel] || {})[p], cs = UIED.el && UIED.el.isConnected ? getComputedStyle(UIED.el).getPropertyValue(p).trim() : "";
  const v = ov ?? cs, hex = UIED_COLOR_PROPS.test(p) ? uiedHex(v) : null;
  return `<div class="row ${ov != null ? "chg" : ""}"><label title="${esc(p)}">${esc(p)}</label>${UIED_COLOR_PROPS.test(p) ? `<input type="color" data-p="${esc(p)}" data-sw="1" value="${hex || "#000000"}">` : ""}<input data-p="${esc(p)}" value="${esc(v)}" spellcheck="false">${ov != null ? `<button class="x" data-a="unset" data-p="${esc(p)}" title="Remove this edit">×</button>` : ""}</div>`;
}
function uiedPickHtml(){
  const el = UIED.el, sel = UIED.sel;
  let h = `<div class="row"><button data-a="mode" data-m="pick" aria-pressed="${UIED.mode === "pick"}">${UIED.mode === "pick" ? "Picking… click something" : "Pick on screen"}</button><span class="hint">Esc stops picking.</span></div>`;
  if(!el){ return h + `<p class="hint">Turn picking on, then click any button, label or panel in the game. Dialogs work too. Then change its look below, and the game updates as you type. Up and down arrows nudge numbers.</p>`; }
  if(!el.isConnected) h += `<p class="hint">That element was redrawn. Pick it again, or keep editing the selector below.</p>`;
  const cands = el.isConnected ? uiedCands(el) : [{s:sel, n:uiedCount(sel)}];
  const up = []; for(let n = el.parentElement; n && n !== document.documentElement && up.length < 6; n = n.parentElement) up.unshift(n);
  UIED.chain = [...up, el]; UIED.kids = [...el.children].slice(0, 8);
  h += `<div class="chips">${UIED.chain.map((n, i) => `<button data-a="goto" data-i="${i}" ${n === el ? 'class="on"' : ""}>${esc(uiedName(n).slice(0, 26))}</button>`).join("")}</div>`;
  if(UIED.kids.length) h += `<div class="chips"><span class="hint">Inside:</span>${UIED.kids.map((n, i) => `<button data-a="kid" data-i="${i}">${esc(uiedName(n).slice(0, 22))}</button>`).join("")}</div>`;
  h += `<h4>Apply edits to</h4><div class="row"><select id="uiedCand" style="flex:1">${cands.map(c => `<option value="${esc(c.s)}" ${c.s === sel ? "selected" : ""}>${esc(c.s)}  (${c.n})</option>`).join("")}${cands.some(c => c.s === sel) ? "" : `<option selected value="${esc(sel)}">${esc(sel)}</option>`}</select></div>
    <div class="row"><input id="uiedSelIn" value="${esc(sel)}" spellcheck="false" style="flex:1"><span id="uiedCnt" class="hint">${uiedCount(sel)} match</span></div>
    <div class="hint">The number is how many things on screen this rule changes. A class changes every one of them. An id or the full path changes just this one.</div>`;
  for(const [g, ps] of UIED_PROPS) h += `<h4>${g}</h4>` + ps.map(p => uiedRow(sel, p)).join("");
  const extra = Object.keys(UIED.store.rules[sel] || {}).filter(p => !UIED_PROPS.some(([, ps]) => ps.includes(p)));
  h += `<h4>Other properties</h4>` + extra.map(p => uiedRow(sel, p)).join("") +
    `<div class="row"><input id="uiedXp" placeholder="property, e.g. gap" style="flex:1"><input id="uiedXv" placeholder="value" style="flex:1"><button data-a="addprop">Add</button></div>
    <div class="row"><button data-a="movethis">Move / resize this</button><button data-a="resetsel">Reset edits to this rule</button></div>`;
  const m = el.isConnected ? uiedMatched(el) : [];
  h += `<h4>CSS rules that style it now (click one to edit that selector)</h4>` + (m.length ? m.slice(-10).reverse().map(r => `<pre class="pick" data-a="usesel" data-s="${esc(r.sel)}">${esc((r.media ? "@media " + r.media + " " : "") + r.sel)} {${esc(r.body.slice(0, 150))}${r.body.length > 150 ? "…" : ""}}</pre>`).join("") : `<div class="hint">None found.</div>`);
  h += `<h4>Code that builds it</h4><div id="uiedSrc" class="hint">Looking…</div>`;
  return h;
}
async function uiedLoadSource(){
  const el = UIED.el, box = uiedEl("uiedSrc"); if(!box || !el) return;
  UIED.src = el;
  let r = null; try{ r = await uiedSource(el); }catch{}
  if(UIED.src !== el || !uiedEl("uiedSrc")) return;
  uiedEl("uiedSrc").innerHTML = r === null ? "Can't read the scripts here (the page is open from disk). Search the js folder for its class name instead."
    : r.length ? r.map(x => `<pre>${esc(x)}</pre>`).join("") : "No class or id to search for.";
}
function uiedRegions(){ return [...UIED_REGIONS, ...UIED.store.regions.map(s => [s, s])]; }
function uiedXY(sel){ const t = ((UIED.store.rules[sel] || {}).translate || "").match(/-?[\d.]+/g) || []; return {x:+t[0] || 0, y:+t[1] || 0}; }
function uiedLayoutHtml(){
  let h = `<div class="row"><button data-a="mode" data-m="layout" aria-pressed="${UIED.mode === "layout"}">${UIED.mode === "layout" ? "Editing layout… (Esc to stop)" : "Edit layout"}</button></div>
    <p class="hint">Gold boxes are the pieces you can move. Drag one to move it, pull its corner square to resize it, arrow keys nudge it a pixel (Shift for ten), double-click to put it back.</p><h4>Pieces</h4>`;
  for(const [n, s] of uiedRegions()){
    const r = UIED.store.rules[s] || {}, t = uiedXY(s), set = r.translate || r.width || r.height;
    h += `<div class="row ${set ? "chg" : ""}"><label style="width:auto;flex:1" title="${esc(s)}">${esc(n)}</label><span class="hint">${set ? `${t.x}, ${t.y}${r.width ? ` · ${esc(r.width)} × ${esc(r.height || "auto")}` : ""}` : ""}</span>${set ? `<button class="x" data-a="regreset" data-s="${esc(s)}">×</button>` : ""}${UIED.store.regions.includes(s) ? `<button class="x" data-a="regdel" data-s="${esc(s)}" title="Stop listing this piece">−</button>` : ""}</div>`;
  }
  return h + `<h4>Add a piece by selector</h4><div class="row"><input id="uiedRegIn" placeholder="e.g. #officeBtn" spellcheck="false" style="flex:1"><button data-a="regadd">Add</button></div>
    <div class="hint">Or pick something on the Pick tab and press "Move / resize this". Moves are saved as a <code>translate</code> and sizes as <code>width</code> and <code>height</code>. They keep their place whatever redraws.</div>
    <div class="row"><button data-a="resetlayout">${UIED.sure ? "Click again to put everything back" : "Reset all layout"}</button></div>`;
}
function uiedColorsHtml(){
  const th = uiedIsDark() ? "dark" : "light", mine = UIED.store.vars[th], cs = getComputedStyle(document.documentElement);
  let h = `<p class="hint">These are the game's color variables for the <b>${th}</b> theme you're in now. Switch the theme and edit again for the other one.</p>`;
  for(const n of uiedVarNames()){
    const v = mine[n] ?? cs.getPropertyValue(n).trim(), hex = uiedHex(v);
    h += `<div class="row ${n in mine ? "chg" : ""}"><label title="${esc(n)}">${esc(n)}</label>${hex ? `<input type="color" data-v="${esc(n)}" data-sw="1" value="${hex}">` : `<span style="width:26px;height:22px;flex:none;border:1px solid #3B4D5E;background:${esc(v)}"></span>`}<input data-v="${esc(n)}" value="${esc(v)}" spellcheck="false">${n in mine ? `<button class="x" data-a="unvar" data-v="${esc(n)}">×</button>` : ""}</div>`;
  }
  return h;
}
function uiedCssHtml(){
  return `<p class="hint">Any CSS at all. It's applied as you type and goes after the other edits.</p><textarea id="uiedFree" spellcheck="false" placeholder=".hbox { border-radius: 12px; }">${esc(UIED.store.css)}</textarea>`;
}
function uiedExportHtml(){
  const t = uiedCss(true);
  return `<p class="hint">This is every edit as plain CSS. Copy it and paste it to Claude to bake into the game, then Reset all. Edits stay in this browser until then and only show in dev mode.</p>
    <div class="row"><button data-a="copy">Copy</button><button data-a="resetall">${UIED.sure ? "Click again to delete every edit" : "Reset all"}</button></div>
    <textarea id="uiedOut" readonly spellcheck="false">${esc(t || "/* no edits yet */")}</textarea>`;
}

/* ---------- panel events ---------- */
function uiedClick(e){
  const b = e.target.closest("[data-a]"); if(!b) return;
  const a = b.dataset.a, S = UIED.store;
  if(a === "close") uiedClose();
  else if(a === "undo") uiedUndo();
  else if(a === "tab"){ UIED.tab = b.dataset.k; if(UIED.mode && UIED.mode !== UIED.tab) uiedMode(null); else uiedRender(); }
  else if(a === "mode") uiedMode(UIED.mode === b.dataset.m ? null : b.dataset.m);
  else if(a === "goto") uiedSelect(UIED.chain[+b.dataset.i]);
  else if(a === "kid") uiedSelect(UIED.kids[+b.dataset.i]);
  else if(a === "usesel"){ UIED.sel = b.dataset.s; uiedRender(); }
  else if(a === "unset"){ uiedSnap(); uiedSet(UIED.sel, b.dataset.p, ""); uiedRender(); }
  else if(a === "addprop"){
    const p = uiedEl("uiedXp").value.trim(), v = uiedEl("uiedXv").value.trim();
    if(p && v){ uiedSnap(); uiedSet(UIED.sel, p, v); uiedRender(); }
  }
  else if(a === "resetsel"){ uiedSnap(); delete S.rules[UIED.sel]; uiedSave(); uiedRender(); }
  else if(a === "movethis"){ if(UIED.sel && !uiedRegions().some(r => r[1] === UIED.sel)){ S.regions.push(UIED.sel); uiedSave(); } UIED.tab = "layout"; UIED.reg = UIED.sel; uiedMode("layout"); }
  else if(a === "regreset"){ uiedSnap(); const r = S.rules[b.dataset.s]; if(r){ delete r.translate; delete r.width; delete r.height; if(!Object.keys(r).length) delete S.rules[b.dataset.s]; } uiedSave(); uiedRender(); }
  else if(a === "regdel"){ uiedSnap(); S.regions = S.regions.filter(s => s !== b.dataset.s); uiedSave(); uiedRender(); }
  else if(a === "regadd"){ const s = uiedEl("uiedRegIn").value.trim(); if(s && uiedCount(s) > 0 && !uiedRegions().some(r => r[1] === s)){ uiedSnap(); S.regions.push(s); uiedSave(); uiedRender(); } else ui.toast(s ? "Nothing on screen matches that." : "Type a selector first.", "bad"); }
  else if(a === "resetlayout"){
    if(!UIED.sure){ UIED.sure = setTimeout(() => { UIED.sure = 0; uiedRender(); }, 3000); uiedRender(); return; }
    clearTimeout(UIED.sure); UIED.sure = 0; uiedSnap();
    for(const [, s] of uiedRegions()){ const r = S.rules[s]; if(r){ delete r.translate; delete r.width; delete r.height; if(!Object.keys(r).length) delete S.rules[s]; } }
    uiedSave(); uiedRender();
  }
  else if(a === "unvar"){ uiedSnap(); delete S.vars[uiedIsDark() ? "dark" : "light"][b.dataset.v]; uiedSave(); uiedRender(); }
  else if(a === "copy"){
    const t = uiedEl("uiedOut"); t.select();
    (navigator.clipboard ? navigator.clipboard.writeText(t.value) : Promise.reject()).catch(() => { document.execCommand("copy"); }).finally(() => ui.toast("Copied. Paste it to Claude."));
  }
  else if(a === "resetall"){
    if(!UIED.sure){ UIED.sure = setTimeout(() => { UIED.sure = 0; uiedRender(); }, 3000); uiedRender(); return; }
    clearTimeout(UIED.sure); UIED.sure = 0; uiedSnap();
    UIED.store.vars = {light:{}, dark:{}}; UIED.store.rules = {}; UIED.store.css = ""; UIED.store.regions = []; uiedSave(); uiedRender();
  }
}
function uiedInput(e){
  const t = e.target;
  if(t.id === "uiedFree"){ UIED.store.css = t.value; uiedSave(); return; }
  if(t.id === "uiedSelIn"){ UIED.sel = t.value.trim(); const c = uiedEl("uiedCnt"); if(c) c.textContent = `${Math.max(uiedCount(UIED.sel), 0)} match`; return; }
  if(t.dataset.p){
    const row = t.closest(".row"), other = row.querySelector(t.dataset.sw ? "input:not([data-sw])" : "input[data-sw]");
    if(t.dataset.sw && other) other.value = t.value;
    else if(other){ const h = uiedHex(t.value); if(h) other.value = h; }
    uiedSet(UIED.sel, t.dataset.p, t.value); row.classList.add("chg");
  }
  else if(t.dataset.v){
    const row = t.closest(".row"), other = row.querySelector(t.dataset.sw ? "input:not([data-sw])" : "input[data-sw]");
    if(t.dataset.sw && other) other.value = t.value;
    else if(other){ const h = uiedHex(t.value); if(h) other.value = h; }
    const th = uiedIsDark() ? "dark" : "light";
    if(t.value.trim()) UIED.store.vars[th][t.dataset.v] = t.value.trim(); else delete UIED.store.vars[th][t.dataset.v];
    uiedSave(); row.classList.add("chg");
  }
}
function uiedChange(e){
  if(e.target.id === "uiedCand"){ UIED.sel = e.target.value; uiedRender(); }
  else if(e.target.id === "uiedSelIn"){ uiedRender(); }
  else if(e.target.dataset.p || e.target.dataset.v) { const t = e.target; if(!t.value.trim()) uiedRender(); }
}
function uiedStep(e){   // up and down arrows nudge the number at the cursor
  const t = e.target;
  if(!(t.dataset && (t.dataset.p || t.dataset.v)) || t.type === "color" || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
  const s = t.value, pos = t.selectionStart ?? 0, nums = [...s.matchAll(/-?\d*\.?\d+/g)];
  const hit = nums.find(m => m.index <= pos && pos <= m.index + m[0].length) || nums.find(m => m.index >= pos) || nums[nums.length - 1];
  if(!hit) return;
  e.preventDefault();
  const d = (e.key === "ArrowUp" ? 1 : -1) * (e.shiftKey ? 10 : e.altKey ? .1 : 1), isF = /\./.test(hit[0]) || e.altKey;
  let n = +hit[0] + d; n = isF ? Math.round(n * 100) / 100 : Math.round(n);
  t.value = s.slice(0, hit.index) + n + s.slice(hit.index + hit[0].length);
  t.setSelectionRange(hit.index, hit.index + String(n).length);
  t.dispatchEvent(new Event("input", {bubbles:true}));
}

/* ---------- pick and layout modes ---------- */
const UIED_SWALLOW = ["pointerdown", "pointerup", "mousedown", "mouseup", "click", "dblclick", "touchstart", "touchend", "contextmenu"];
function uiedGrab(e){
  if(!UIED.open || !UIED.mode) return;
  const t = e.target;
  if(t && t.closest && t.closest("#uied, .uied-ov")) return;
  e.preventDefault(); e.stopImmediatePropagation();
  if(UIED.mode === "pick" && e.type === "pointerdown" && t.nodeType === 1 && t !== document.documentElement) uiedSelect(t);
}
function uiedMove(e){
  if(!UIED.open || UIED.mode !== "pick") return;
  const t = e.target; UIED.hover = t && t.nodeType === 1 && !t.closest("#uied") ? t : null;
}
function uiedKey(e){
  if(!UIED.open) return;
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "");
  if(e.key === "Escape" && UIED.mode){ e.preventDefault(); e.stopImmediatePropagation(); uiedMode(null); return; }
  if(typing) return;
  if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z"){ e.preventDefault(); uiedUndo(); return; }
  if(UIED.mode === "layout" && UIED.reg && e.key.startsWith("Arrow")){
    e.preventDefault(); e.stopImmediatePropagation();
    const d = e.shiftKey ? 10 : 1, t = uiedXY(UIED.reg);
    uiedSnap(); uiedTranslate(UIED.reg, t.x + (e.key === "ArrowRight" ? d : e.key === "ArrowLeft" ? -d : 0), t.y + (e.key === "ArrowDown" ? d : e.key === "ArrowUp" ? -d : 0));
  }
}
function uiedMode(m){
  UIED.mode = m; UIED.hover = null;
  if(m !== "layout"){ for(const o of UIED.ov.values()) o.remove(); UIED.ov.clear(); }
  if(m === "layout") UIED.tab = "layout";
  if(m === "pick") UIED.tab = "pick";
  uiedRender();
}
function uiedTranslate(sel, x, y){ uiedSet(sel, "translate", x || y ? `${Math.round(x)}px ${Math.round(y)}px` : ""); }
function uiedOverlay(sel, name){
  const o = document.createElement("div"); o.className = "uied-ov"; o.innerHTML = `<i>${esc(name)}</i><b></b>`;
  o.addEventListener("pointerdown", e => {
    if(e.button) return;
    e.preventDefault(); e.stopPropagation(); UIED.reg = sel; uiedSnap();
    const resize = e.target.tagName === "B", t0 = uiedXY(sel), el = document.querySelector(sel);
    const r0 = el ? el.getBoundingClientRect() : {width:0, height:0}, x0 = e.clientX, y0 = e.clientY;
    o.setPointerCapture(e.pointerId);
    o.onpointermove = m => {
      if(resize){ uiedSet(sel, "width", Math.max(8, Math.round(r0.width + m.clientX - x0)) + "px"); uiedSet(sel, "height", Math.max(8, Math.round(r0.height + m.clientY - y0)) + "px"); }
      else uiedTranslate(sel, t0.x + m.clientX - x0, t0.y + m.clientY - y0);
    };
    o.onpointerup = () => { o.onpointermove = o.onpointerup = null; uiedRender(); };
  });
  o.addEventListener("dblclick", () => { uiedSnap(); const r = UIED.store.rules[sel]; if(r){ delete r.translate; delete r.width; delete r.height; if(!Object.keys(r).length) delete UIED.store.rules[sel]; } uiedSave(); uiedRender(); });
  uiedEl("uied").appendChild(o);
  return o;
}
function uiedPlace(box, el, label){
  const r = el && el.isConnected ? el.getBoundingClientRect() : null;
  if(!r || (!r.width && !r.height)){ box.style.display = "none"; return; }
  box.style.display = "block"; box.style.left = r.left + "px"; box.style.top = r.top + "px"; box.style.width = r.width + "px"; box.style.height = r.height + "px";
  const i = box.querySelector("i"); if(i && label) i.textContent = label;
}
let uiedFrame = 0;
function uiedLoop(){
  UIED.raf = 0; if(!UIED.open) return;
  // keep the panel in the open dialog, since a modal dialog blocks everything outside it
  const root = uiedEl("uied"), dlg = [...document.querySelectorAll("dialog[open]")].pop(), want = dlg || document.body;
  if(root.parentNode !== want) want.appendChild(root);
  if(UIED.el && !UIED.el.isConnected && !(uiedFrame % 10)){ const n = UIED.sel ? document.querySelector(UIED.sel) : null; if(n) UIED.el = n; }
  uiedFrame++;
  uiedPlace(uiedEl("uiedHover"), UIED.mode === "pick" ? UIED.hover : null, UIED.hover ? uiedName(UIED.hover) : "");
  uiedPlace(uiedEl("uiedSelBox"), UIED.tab === "pick" ? UIED.el : null, UIED.el ? uiedName(UIED.el) : "");
  if(UIED.mode === "layout"){
    for(const [name, sel] of uiedRegions()){
      let o = UIED.ov.get(sel); if(!o){ o = uiedOverlay(sel, name); UIED.ov.set(sel, o); }
      const el = document.querySelector(sel); uiedPlace(o, el);
      o.classList.toggle("cur", UIED.reg === sel);
    }
  }
  UIED.raf = requestAnimationFrame(uiedLoop);
}
function uiedOpen(){
  if(!devMode()) return;
  uiedBuild(); UIED.open = true; uiedEl("uied").hidden = false;
  const b = uiedEl("uiedBtn"); if(b) b.setAttribute("aria-pressed", "true");
  uiedRender(); if(!UIED.raf) UIED.raf = requestAnimationFrame(uiedLoop);
}
function uiedClose(){
  UIED.open = false; UIED.mode = null; UIED.hover = null;
  for(const o of UIED.ov.values()) o.remove();
  UIED.ov.clear();
  const r = uiedEl("uied"); if(r){ r.hidden = true; if(r.parentNode !== document.body) document.body.appendChild(r); }
  const b = uiedEl("uiedBtn"); if(b) b.setAttribute("aria-pressed", "false");
}
// Called when dev mode flips (main.js) so the button, the edits and the panel follow it.
function uiedSync(){
  const b = uiedEl("uiedBtn"); if(b) b.hidden = !devMode();
  if(!devMode()) uiedClose();
  uiedApply();
}
{
  uiedLoad();
  for(const t of UIED_SWALLOW) window.addEventListener(t, uiedGrab, true);
  window.addEventListener("pointermove", uiedMove, true);
  window.addEventListener("keydown", uiedKey, true);
  new MutationObserver(uiedApply).observe(document.documentElement, {attributes:true, attributeFilter:["data-theme"]});
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", uiedApply);
  const b = uiedEl("uiedBtn");
  if(b) b.onclick = () => UIED.open ? uiedClose() : uiedOpen();
  uiedSync();
}
