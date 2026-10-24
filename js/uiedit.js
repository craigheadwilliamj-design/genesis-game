/* ---------- UI editor (dev mode only) ----------
   Live-edit the game's look from inside the game: pick any element and change its styles, drag and resize
   the HUD pieces, retune the color variables, or type free CSS. Edits are rules in one <style id="uiedLive">
   and live in localStorage (never in `state`). The Export tab gives the CSS to hand over for baking in. */
const UIED_KEY = "genesis-uiedit";
const UIED_VARNAMES = {"--chrome":"Panel background", "--chrome-2":"Panel background, second shade", "--ink":"Main text", "--ink-2":"Soft text", "--line":"Lines and borders", "--gold":"Gold", "--gold-ink":"Gold text", "--forest":"Dark green (buttons, bars)", "--on-forest":"Text on dark green", "--money":"Money color", "--outside":"Land outside the park", "--grass":"Grass", "--field":"Input boxes", "--sel":"Selected highlight", "--good":"Good (green)", "--warn":"Warning (amber)", "--bad":"Bad (red)", "--fence":"Fence", "--dirt":"Dirt", "--boundary":"Park edge line", "--halo":"Label glow"};
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
  s.adds = Array.isArray(s.adds) ? s.adds : []; s.rules = s.rules || {}; s.css = typeof s.css === "string" ? s.css : ""; s.regions = Array.isArray(s.regions) ? s.regions : [];
  UIED.store = s;
}
function uiedSave(){ try{ localStorage.setItem(UIED_KEY, JSON.stringify(UIED.store)); }catch{} uiedApply(); }
function uiedIsDark(){
  const t = document.documentElement.dataset.theme;
  return t === "dark" || (t !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
}
const UIED_ADD_CSS = `.uied-add{box-sizing:border-box}
.uied-addbar{display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center;margin:6px 0}
.uied-addbar .meter{min-width:60px}
.uied-addbadge{display:inline-block;padding:2px 9px;border-radius:999px;font-size:12px;font-weight:600;background:var(--forest);color:var(--on-forest)}
.uied-adderr{color:var(--bad)}`;
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
  if(s.adds.length) out.push(forExport ? "/* Added elements. One per line, to build into the real UI:\n" + s.adds.map(a => JSON.stringify(a)).join("\n").replace(/\*\//g, "* /") + "\n*/" : UIED_ADD_CSS);
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
.uied-win{position:fixed;left:116px;top:56px;width:350px;max-height:calc(100vh - 72px);display:flex;flex-direction:column;background:#17212B;border:1px solid #3B4D5E;border-radius:8px;box-shadow:0 8px 28px rgba(0,0,0,.5);overflow:hidden}
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
#uied .uied-card{border:1px solid #3B4D5E;border-radius:6px;padding:6px 8px;margin:8px 0;background:#1B2835}
#uied .uied-card .cnt{color:#8FA6BC}
#uied .row>select{flex:1}
#uied input[type=range]{flex:1;padding:0}
#uied input[type=checkbox]{width:16px;height:16px}
#uied output{width:48px;text-align:right;color:#B9C8D6}
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
    const mv = m => { w.style.left = Math.max(0, Math.min(innerWidth - 80, m.clientX - dx)) + "px"; w.style.top = Math.max(0, Math.min(innerHeight - 40, m.clientY - dy)) + "px"; };
    const up = () => { e.currentTarget.removeEventListener("pointermove", mv); e.currentTarget.removeEventListener("pointerup", up); };
    e.currentTarget.addEventListener("pointermove", mv); e.currentTarget.addEventListener("pointerup", up);
  });
  const win = uiedEl("uiedWin");
  win.addEventListener("keydown", e => e.stopPropagation());   // typing here is never a game hotkey
  win.addEventListener("focusin", e => { if(e.target.matches("input,textarea,select")) uiedSnap(); if(e.target.dataset.ad) UIED.lastIn = {ad:e.target.dataset.ad, f:e.target.dataset.f}; });
  win.addEventListener("click", uiedClick);
  win.addEventListener("input", uiedInput);
  win.addEventListener("change", uiedChange);
  win.addEventListener("keydown", uiedStep);
}
const UIED_TABS = [["pick", "Change"], ["layout", "Move"], ["add", "Add"], ["colors", "Colors"], ["css", "Code"], ["export", "Send"]];
function uiedRender(){
  if(!UIED.open) return;
  uiedEl("uiedTabs").innerHTML = UIED_TABS.map(([k, n]) => `<button data-a="tab" data-k="${k}" ${UIED.tab === k ? 'class="on"' : ""}>${n}</button>`).join("");
  const body = uiedEl("uiedBody"), keep = body.scrollTop;
  body.innerHTML = ({pick:uiedPickHtml, layout:uiedLayoutHtml, add:uiedAddTabHtml, colors:uiedColorsHtml, css:uiedCssHtml, export:uiedExportHtml})[UIED.tab]();
  body.scrollTop = keep;
  if(UIED.tab === "pick" && UIED.el && UIED.adv) uiedLoadSource();
}
function uiedRow(sel, p){
  const ov = (UIED.store.rules[sel] || {})[p], cs = UIED.el && UIED.el.isConnected ? getComputedStyle(UIED.el).getPropertyValue(p).trim() : "";
  const v = ov ?? cs, hex = UIED_COLOR_PROPS.test(p) ? uiedHex(v) : null;
  return `<div class="row ${ov != null ? "chg" : ""}"><label title="${esc(p)}">${esc(p)}</label>${UIED_COLOR_PROPS.test(p) ? `<input type="color" data-p="${esc(p)}" data-sw="1" value="${hex || "#000000"}">` : ""}<input data-p="${esc(p)}" value="${esc(v)}" spellcheck="false">${ov != null ? `<button class="x" data-a="unset" data-p="${esc(p)}" title="Remove this edit">×</button>` : ""}</div>`;
}
// Plain-English controls: [label, css property, kind, min, max, unit]
const UIED_SIMPLE = [
  ["Text color", "color", "color"], ["Text size", "font-size", "range", 8, 60, "px"], ["Bold", "font-weight", "bold"],
  ["Fill color", "background-color", "color"], ["Round corners", "border-radius", "range", 0, 40, "px"],
  ["Space inside", "padding", "range", 0, 40, "px"], ["Space outside", "margin", "range", 0, 40, "px"],
  ["Outline color", "border-color", "color"], ["Outline size", "border-width", "range", 0, 10, "px"],
  ["Width", "width", "range", 10, 700, "px"], ["Height", "height", "range", 10, 500, "px"],
  ["How solid", "opacity", "range", 0, 100, "%"], ["Hide it", "display", "hide"],
];
const UIED_KINDS = {button:"Button", input:"Input box", select:"Dropdown", h1:"Heading", h2:"Heading", h3:"Heading", h4:"Heading", p:"Paragraph", span:"Text", a:"Link", svg:"Picture", img:"Picture", table:"Table", li:"List item", ul:"List", nav:"Menu bar", header:"Top bar", aside:"Side panel", dialog:"Window", section:"Section", label:"Label", i:"Bit"};
function uiedNice(el){   // a name a person would use: Button "Office"
  if(!el) return "";
  const txt = (el.getAttribute("aria-label") || el.getAttribute("title") || (el.children.length < 3 ? el.textContent : "") || "").replace(/\s+/g, " ").trim().slice(0, 28);
  const kind = UIED_KINDS[el.localName] || "Box";
  return txt ? `${kind} “${txt}”` : kind + (el.id ? ` (${el.id})` : el.classList[0] ? ` (${el.classList[0]})` : "");
}
function uiedSimpleRow(d, sel){
  const [label, prop, kind, min, max, unit] = d, ov = (UIED.store.rules[sel] || {})[prop], el = UIED.el;
  const cs = el && el.isConnected ? getComputedStyle(el).getPropertyValue(prop).trim() : "", v = ov ?? cs;
  let ctl;
  if(kind === "color"){ const hex = uiedHex(v); ctl = `<input type="color" data-sp="${prop}" value="${hex || "#000000"}">${hex ? "" : `<span class="hint">none yet</span>`}`; }
  else if(kind === "bold") ctl = `<input type="checkbox" data-sp="${prop}" ${+v >= 600 ? "checked" : ""}>`;
  else if(kind === "hide") ctl = `<input type="checkbox" data-sp="${prop}" ${ov === "none" ? "checked" : ""}>`;
  else {
    let n = unit === "%" ? (isFinite(+v) && v !== "" ? +v : 1) * 100 : parseFloat(v);
    if(!isFinite(n)) n = min; n = Math.round(Math.max(min, Math.min(max, n)));
    ctl = `<input type="range" data-sp="${prop}" min="${min}" max="${max}" step="1" value="${n}"><output>${n}${unit}</output>`;
  }
  return `<div class="row ${ov != null ? "chg" : ""}"><label>${label}</label>${ctl}${ov != null ? `<button class="x" data-a="unset" data-p="${prop}" title="Put this back how it was">×</button>` : ""}</div>`;
}
function uiedPickHtml(){
  const el = UIED.el, cur = UIED.sel;
  let h = `<div class="row"><button data-a="mode" data-m="pick" aria-pressed="${UIED.mode === "pick" && !UIED.placing}">${UIED.mode === "pick" && !UIED.placing ? "Click something in the game…" : "Click something to change it"}</button></div>`;
  if(!el) return h + `<div class="uied-card"><b>How this works</b><ol class="hint" style="padding-left:18px"><li>Press the button above.</li><li>Click anything in the game: a button, a number, a whole panel.</li><li>Sliders and color boxes show up here. Drag them and the game changes right away.</li><li>Happy with it? Open <b>Send</b>, copy, and paste it to Claude to make it permanent.</li></ol><div class="hint">Made a mess? Press Undo at the top.</div></div>`;
  if(!el.isConnected) h += `<p class="hint">The game redrew that. Click it again.</p>`;
  const cls = [...el.classList].map(c => "." + CSS.escape(c)).join(""), one = el.id ? "#" + CSS.escape(el.id) : uiedPath(el);
  h += `<h4>${esc(uiedNice(el))}</h4><div class="row"><button data-a="scope" data-s="${esc(one)}" aria-pressed="${cur === one}">Only this one</button>${cls ? `<button data-a="scope" data-s="${esc(cls)}" aria-pressed="${cur === cls}">All like it (${uiedCount(cls)})</button>` : ""}<button data-a="parent" title="Pick the box this sits in">⬆ Bigger</button></div>`;
  h += UIED_SIMPLE.map(d => uiedSimpleRow(d, cur)).join("");
  h += `<div class="row" style="margin-top:8px"><button data-a="movethis">Move or resize it</button><button data-a="resetsel">Reset this</button></div>
    <div class="row"><button data-a="adv" aria-pressed="${!!UIED.adv}">${UIED.adv ? "Hide" : "Show"} the technical stuff</button></div>`;
  if(UIED.adv) h += uiedAdvHtml(el, cur);
  return h;
}
function uiedAdvHtml(el, sel){
  const cands = el.isConnected ? uiedCands(el) : [{s:sel, n:uiedCount(sel)}];
  const up = []; for(let n = el.parentElement; n && n !== document.documentElement && up.length < 6; n = n.parentElement) up.unshift(n);
  UIED.chain = [...up, el]; UIED.kids = [...el.children].slice(0, 8);
  let h = `<div class="chips">${UIED.chain.map((n, i) => `<button data-a="goto" data-i="${i}" ${n === el ? 'class="on"' : ""}>${esc(uiedName(n).slice(0, 26))}</button>`).join("")}</div>`;
  if(UIED.kids.length) h += `<div class="chips"><span class="hint">Inside:</span>${UIED.kids.map((n, i) => `<button data-a="kid" data-i="${i}">${esc(uiedName(n).slice(0, 22))}</button>`).join("")}</div>`;
  h += `<h4>Which things get changed (CSS selector)</h4><div class="row"><select id="uiedCand" style="flex:1">${cands.map(c => `<option value="${esc(c.s)}" ${c.s === sel ? "selected" : ""}>${esc(c.s)}  (${c.n})</option>`).join("")}${cands.some(c => c.s === sel) ? "" : `<option selected value="${esc(sel)}">${esc(sel)}</option>`}</select></div>
    <div class="row"><input id="uiedSelIn" value="${esc(sel)}" spellcheck="false" style="flex:1"><span id="uiedCnt" class="hint">${uiedCount(sel)} match</span></div>`;
  for(const [g, ps] of UIED_PROPS) h += `<h4>${g}</h4>` + ps.map(p => uiedRow(sel, p)).join("");
  const extra = Object.keys(UIED.store.rules[sel] || {}).filter(p => !UIED_PROPS.some(([, ps]) => ps.includes(p)));
  h += `<h4>Other properties</h4>` + extra.map(p => uiedRow(sel, p)).join("") +
    `<div class="row"><input id="uiedXp" placeholder="property, e.g. gap" style="flex:1"><input id="uiedXv" placeholder="value" style="flex:1"><button data-a="addprop">Add</button></div>`;
  const m = el.isConnected ? uiedMatched(el) : [];
  h += `<h4>CSS rules that style it now</h4>` + (m.length ? m.slice(-10).reverse().map(r => `<pre class="pick" data-a="usesel" data-s="${esc(r.sel)}">${esc((r.media ? "@media " + r.media + " " : "") + r.sel)} {${esc(r.body.slice(0, 150))}${r.body.length > 150 ? "…" : ""}}</pre>`).join("") : `<div class="hint">None found.</div>`);
  return h + `<h4>Code that builds it</h4><div id="uiedSrc" class="hint">Looking…</div>`;
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
    <p class="hint">Gold boxes are the pieces you can move. Drag one to move it. Pull its corner square to make it bigger or smaller. Arrow keys nudge it (Shift for bigger steps). Double-click it to put it back.</p><h4>Pieces</h4>`;
  for(const [n, s] of uiedRegions()){
    const r = UIED.store.rules[s] || {}, t = uiedXY(s), set = r.translate || r.width || r.height;
    h += `<div class="row ${set ? "chg" : ""}"><label style="width:auto;flex:1" title="${esc(s)}">${esc(n)}</label><span class="hint">${set ? `${t.x}, ${t.y}${r.width ? ` · ${esc(r.width)} × ${esc(r.height || "auto")}` : ""}` : ""}</span>${set ? `<button class="x" data-a="regreset" data-s="${esc(s)}">×</button>` : ""}${UIED.store.regions.includes(s) ? `<button class="x" data-a="regdel" data-s="${esc(s)}" title="Stop listing this piece">−</button>` : ""}</div>`;
  }
  return h + `<div class="hint">Something missing from the list? On the Change tab, click it and press "Move or resize it".</div>
    <div class="row"><button data-a="resetlayout">${UIED.sure ? "Click again to put everything back" : "Reset all layout"}</button></div>`;
}
function uiedColorsHtml(){
  const th = uiedIsDark() ? "dark" : "light", mine = UIED.store.vars[th], cs = getComputedStyle(document.documentElement);
  let h = `<p class="hint">The game's main colors. Change one and everything that uses it changes. You're editing the <b>${th}</b> look. Switch the game's theme and come back to edit the other.</p>`;
  for(const n of uiedVarNames()){
    const v = mine[n] ?? cs.getPropertyValue(n).trim(), hex = uiedHex(v);
    h += `<div class="row ${n in mine ? "chg" : ""}"><label title="${esc(n)}">${esc(UIED_VARNAMES[n] || n.slice(2).replace(/-/g, " "))}</label>${hex ? `<input type="color" data-v="${esc(n)}" data-sw="1" value="${hex}">` : `<span style="width:26px;height:22px;flex:none;border:1px solid #3B4D5E;background:${esc(v)}"></span>`}<input data-v="${esc(n)}" value="${esc(v)}" spellcheck="false">${n in mine ? `<button class="x" data-a="unvar" data-v="${esc(n)}">×</button>` : ""}</div>`;
  }
  return h;
}
function uiedCssHtml(){
  return `<p class="hint">For people who know CSS. You can ignore this tab. Anything typed here is applied straight away.</p><textarea id="uiedFree" spellcheck="false" placeholder=".hbox { border-radius: 12px; }">${esc(UIED.store.css)}</textarea>`;
}
function uiedExportHtml(){
  const t = uiedCss(true);
  return `<p class="hint">Everything you've changed, written out. Press Copy and paste it into the chat with Claude. Claude will make the changes permanent in the game. Until then they only live in this browser, and only in dev mode.</p>
    <div class="row"><button data-a="copy">Copy for Claude</button><button data-a="resetall">${UIED.sure ? "Click again to delete every edit" : "Reset all"}</button></div>
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
  else if(a === "addnew"){ UIED.placing = {kind:b.dataset.k}; uiedMode("pick"); ui.toast("Now click where it should appear."); }
  else if(a === "addspot"){ UIED.placing = {retarget:b.dataset.id}; uiedMode("pick"); ui.toast("Now click the new spot."); }
  else if(a === "scope"){ UIED.sel = b.dataset.s; uiedRender(); }
  else if(a === "parent"){ const n = UIED.el && UIED.el.parentElement; if(n && n !== document.body && n !== document.documentElement) uiedSelect(n); }
  else if(a === "adv"){ UIED.adv = !UIED.adv; uiedRender(); }
  else if(a === "addel"){ uiedSnap(); S.adds = S.adds.filter(x => x.id !== b.dataset.id); uiedSave(); uiedAddsSync(); uiedRender(); }
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
  if(t.dataset.sp){
    const p = t.dataset.sp, sel = UIED.sel; let v;
    if(t.type === "checkbox") v = p === "font-weight" ? (t.checked ? "700" : "400") : (t.checked ? "none" : "");
    else if(t.type === "color") v = t.value;
    else { v = p === "opacity" ? String(t.value / 100) : t.value + "px"; const o = t.nextElementSibling; if(o && o.tagName === "OUTPUT") o.textContent = t.value + (p === "opacity" ? "%" : "px"); }
    if(/^border-(width|color)$/.test(p)) uiedSet(sel, "border-style", "solid");
    uiedSet(sel, p, v); return;
  }
  if(t.dataset.ad && t.tagName === "SELECT" && t.dataset.f === "expr") return;   // handled on change
  if(t.dataset.ad){
    const ad = UIED.store.adds.find(x => x.id === t.dataset.ad); if(!ad) return;
    ad[t.dataset.f] = t.value; uiedSave(); uiedAddsSync();
    const pair = t.closest(".row").querySelector(t.dataset.sw ? "input:not([data-sw])" : "input[data-sw]");
    if(pair && t.dataset.sw) pair.value = t.value; else if(pair){ const hx = uiedHex(t.value); if(hx) pair.value = hx; }
    if(t.dataset.f === "target"){ const c = t.closest(".uied-card").querySelector(".cnt"); if(c) c.textContent = `${Math.max(uiedCount(t.value.trim()), 0)} found`; }
    return;
  }
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
  const t = e.target;
  if(t.dataset.sp){ uiedRender(); return; }
  if(t.dataset.ins){
    const ad = UIED.store.adds.find(x => x.id === t.dataset.ins);
    if(ad && t.value){ uiedSnap(); ad.text = (ad.text || "") + (ad.text && !/\s$/.test(ad.text) ? " " : "") + `{${t.value}}`; uiedSave(); uiedAddsSync(); uiedRender(); }
    return;
  }
  if(t.dataset.ad && t.tagName === "SELECT"){
    const ad = UIED.store.adds.find(x => x.id === t.dataset.ad);
    if(ad && t.dataset.f === "expr"){ uiedSnap(); if(t.value === "__custom") ad.custom = true; else { ad.custom = false; ad.expr = t.value; } uiedSave(); uiedAddsSync(); }
    uiedRender(); return;
  }
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


/* ---------- added elements ---------- */
// Bars, colored text, badges or raw HTML put next to (or inside) any element on screen. Panels redraw all the time,
// so a MutationObserver puts them back before the next paint. Values are JS expressions: `it` is the picked item
// (the open exhibit, building...), `state` and `derived` are the game's, `$el` is the element it sits by.
const uiedFns = new Map();
function uiedEval(src, $el){
  try{
    let f = uiedFns.get(src); if(!f){ f = new Function("it", "$el", "return (" + src + "\n)"); uiedFns.set(src, f); }
    return {v:f(uiedItem(), $el)};
  }catch(e){ return {err:String(e && e.message || e)}; }
}
function uiedItem(){ try{ return sel ? findItem(sel.kind, sel.id) : null; }catch{ return null; } }
const uiedFmt = v => typeof v === "number" ? String(Math.round(v * 10) / 10) : String(v ?? "");
function uiedTpl(t, $el, raw){
  return String(t ?? "").split(/(\{[^{}]+\})/).map(p => {
    if(!/^\{[^{}]+\}$/.test(p)) return raw ? p : esc(p);
    const r = uiedEval(p.slice(1, -1), $el); return r.err ? `<span class="uied-adderr" title="${esc(r.err)}">⚠</span>` : esc(uiedFmt(r.v));
  }).join("");
}
function uiedAddHtml(a, $el){
  const st = a.style ? ` style="${esc(a.style)}"` : "", col = a.color && a.color !== "auto" ? a.color : "";
  if(a.kind === "bar"){
    const r = uiedEval(a.expr || "0", $el), m = uiedEval(a.max || "100", $el), mx = +m.v > 0 ? +m.v : 100, v = r.err ? 0 : +r.v || 0, pct = Math.max(0, Math.min(100, v / mx * 100));
    const val = r.err ? `<span class="uied-adderr" title="${esc(r.err)}">⚠</span>` : mx === 100 ? Math.round(v) + "%" : `${uiedFmt(v)}/${uiedFmt(mx)}`;
    return `<div class="uied-addbar"${st}>${a.label ? `<span>${esc(a.label)}</span>` : "<span></span>"}${meter(pct, col || happyColor(pct))}<span>${val}</span></div>`;
  }
  if(a.kind === "badge") return `<span class="uied-addbadge"${col ? ` style="background:${esc(col)};${esc(a.style || "")}"` : st}>${uiedTpl(a.text, $el)}</span>`;
  if(a.kind === "html") return `<div${st}>${uiedTpl(a.text, $el, true)}</div>`;
  return `<span${col || a.style ? ` style="${col ? "color:" + esc(col) + ";" : ""}${esc(a.style || "")}"` : ""}>${uiedTpl(a.text, $el)}</span>`;
}
let uiedBusy = false;
function uiedAddsSync(){
  if(uiedBusy) return; uiedBusy = true;
  try{
    const on = devMode() ? UIED.store.adds : [], keep = new Set();
    for(const a of on){
      if(!a.target) continue;
      let els = []; try{ els = [...document.querySelectorAll(a.target)].filter(e => !e.closest("#uied") && !e.closest("[data-uied-add]")).slice(0, 30); }catch{}
      for(const t of els){
        const w = a.where || "end";
        let m = w === "before" ? t.previousElementSibling : w === "after" ? t.nextElementSibling : [...t.children].find(c => c.dataset.uiedAdd === a.id && (w === "start" ? c === t.firstElementChild : true));
        if(!(m && m.dataset.uiedAdd === a.id)){
          m = document.createElement("div"); m.dataset.uiedAdd = a.id; m.className = "uied-add"; m.style.display = "contents";
          if(w === "before") t.before(m); else if(w === "after") t.after(m); else if(w === "start") t.prepend(m); else t.append(m);
        }
        keep.add(m);
        const h = uiedAddHtml(a, t); if(m.dataset.h !== h){ m.dataset.h = h; m.innerHTML = h; }
      }
    }
    document.querySelectorAll("[data-uied-add]").forEach(m => { if(!keep.has(m)) m.remove(); });
  }finally{ uiedBusy = false; if(uiedObs) uiedObs.takeRecords(); }
}
let uiedObs = null, uiedTimer = 0;
function uiedAddsStart(){
  if(uiedObs) return;
  uiedObs = new MutationObserver(recs => {
    if(!UIED.store.adds.length && !document.querySelector("[data-uied-add]")) return;
    if(recs.every(r => r.target.closest && r.target.closest("#map, #uied, #uiedLive"))) return;
    uiedAddsSync();
  });
  uiedObs.observe(document.body, {childList:true, subtree:true});
  uiedTimer = setInterval(() => { if(UIED.store.adds.length || document.querySelector("[data-uied-add]")) uiedAddsSync(); }, 300);
}
const UIED_PARK = [["state.money", "Money"], ["state.rating", "Park rating (stars)"], ["state.ticket", "Ticket price"], ["state.day", "Day number"], ["derived.avgHappy", "Average animal happiness"], ["derived.welfare", "Animal welfare"], ["derived.appeal", "Park appeal"], ["derived.variety", "Animal variety"], ["derived.demand", "Guest demand"], ["derived.comfort", "Guest comfort"]];
const uiedHum = k => k.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ").replace(/^./, c => c.toUpperCase());
function uiedFields(){   // [{e: expression, n: name, v: value now, g: group}]
  const out = [], it = uiedItem();
  if(it) for(const [k, v] of Object.entries(it)) if(typeof v === "number" && isFinite(v)) out.push({e:"it." + k, n:uiedHum(k), v, g:"What's open in the game right now"});
  for(const [e, n] of UIED_PARK){ const r = uiedEval(e); if(!r.err && typeof r.v === "number") out.push({e, n, v:r.v, g:"The whole park"}); }
  return out;
}
const UIED_ADD_KINDS = [["bar", "Bar"], ["text", "Colored text"], ["badge", "Badge"], ["html", "Custom HTML"]];
function uiedAddTabHtml(){
  const S = UIED.store, fields = uiedFields();
  let h = UIED.placing ? `<div class="uied-card" style="border-color:#E9C766"><b>Now click where it should appear.</b><div class="hint">Click anything in the game. Esc cancels.</div></div>`
    : `<p class="hint">Put something new into the game. Press a button, then click the spot in the game where it should go. Tip: open an exhibit's panel first if the bar should show that animal's numbers.</p>
    <div class="row">${UIED_ADD_KINDS.map(([k, n]) => `<button data-a="addnew" data-k="${k}">+ ${n}</button>`).join("")}</div>`;
  for(const a of S.adds){
    const f = (k, ph) => `data-ad="${a.id}" data-f="${k}" value="${esc(a[k] ?? "")}" placeholder="${esc(ph || "")}" spellcheck="false"`;
    let n = 0, first = null; try{ const l = a.target ? document.querySelectorAll(a.target) : []; n = l.length; first = [...l].find(e => !e.closest("[data-uied-add]")); }catch{}
    const known = fields.some(x => x.e === a.expr), custom = a.custom || (a.expr && !known && a.kind === "bar" && !/^it\b/.test(a.expr));
    h += `<div class="uied-card"><div class="row"><b style="flex:1">${esc((UIED_ADD_KINDS.find(k => k[0] === a.kind) || [0, a.kind])[1])}</b><button class="x" data-a="addel" data-id="${a.id}" title="Delete">×</button></div>
      <div class="row"><label>Placed</label><span class="hint" style="flex:1">${first ? esc(uiedNice(first)) : "not on screen right now"}${n > 1 ? ` and ${n - 1} more like it` : ""}</span><button data-a="addspot" data-id="${a.id}">Choose spot</button></div>
      <div class="row"><label>Where</label><select data-ad="${a.id}" data-f="where">${[["end", "Inside it, at the end"], ["start", "Inside it, at the start"], ["before", "Just before it"], ["after", "Just after it"]].map(([v, t]) => `<option value="${v}" ${a.where === v ? "selected" : ""}>${t}</option>`).join("")}</select></div>`;
    if(a.kind === "bar"){
      const groups = [...new Set(fields.map(x => x.g))];
      h += `<div class="row"><label>Label</label><input ${f("label", "e.g. Happiness")}></div>
        <div class="row"><label>Shows</label><select data-ad="${a.id}" data-f="expr">${groups.map(g => `<optgroup label="${esc(g)}">${fields.filter(x => x.g === g).map(x => `<option value="${esc(x.e)}" ${!custom && a.expr === x.e ? "selected" : ""}>${esc(x.n)} (${esc(uiedFmt(x.v))})</option>`).join("")}</optgroup>`).join("")}<option value="__custom" ${custom ? "selected" : ""}>Something else…</option></select></div>`;
      if(custom) h += `<div class="row"><label>Formula</label><input ${f("expr", "e.g. it.happy")}></div><div class="hint">A number from the game, like <code>it.happy</code> or <code>state.money / 1000</code>.</div>`;
      h += `<div class="row"><label>Full at</label><input ${f("max", "100")}></div>`;
    } else if(a.kind === "html") h += `<div class="row"><textarea style="min-height:70px" data-ad="${a.id}" data-f="text" spellcheck="false">${esc(a.text)}</textarea></div><div class="hint">Plain HTML. Put numbers in braces, like {Math.round(it.happy)}.</div>`;
    else h += `<div class="row"><label>Text</label><input ${f("text", "Happiness: {it.happy}%")}></div>
      <div class="row"><label>Add a number</label><select data-ins="${a.id}"><option value="">Choose…</option>${fields.map(x => `<option value="${esc(x.e)}">${esc(x.n)} (${esc(uiedFmt(x.v))})</option>`).join("")}</select></div>`;
    h += `<div class="row"><label>Color</label><input type="color" data-ad="${a.id}" data-f="color" data-sw="1" value="${uiedHex(a.color) || "#2f7d4a"}"><input ${f("color", "automatic")}></div>`;
    if(UIED.adv) h += `<div class="row"><label>Extra CSS</label><input ${f("style", "font-weight:700")}></div>`;
    h += `</div>`;
  }
  return h + `<div class="row"><button data-a="adv" aria-pressed="${!!UIED.adv}">${UIED.adv ? "Hide" : "Show"} the technical stuff</button></div>`;
}
function uiedPlaceAt(t){   // the click that says where a new thing goes
  const p = UIED.placing, c = uiedCands(t), target = (t.id ? c[0] : c.find(x => x.s.startsWith(".")) || c[c.length - 1]).s, S = UIED.store;
  UIED.placing = null; uiedSnap();
  if(p.retarget){ const a = S.adds.find(x => x.id === p.retarget); if(a){ a.target = target; a.where = t.children.length ? "end" : "after"; } }
  else {
    const it = uiedItem(), has = it && typeof it.happy === "number", k = p.kind;
    S.adds.push({id:"a" + Date.now().toString(36), kind:k, target, where:t.children.length ? "end" : "after", text:k === "html" ? "<b>Hello</b>" : k === "bar" ? "" : "Happiness: {it.happy}%", label:"Happiness", expr:has ? "it.happy" : "derived.avgHappy", max:"100", color:"auto", style:""});
  }
  uiedSave(); uiedAddsSync(); uiedMode(null); UIED.tab = "add"; uiedRender();
}

/* ---------- pick and layout modes ---------- */
const UIED_SWALLOW = ["pointerdown", "pointerup", "mousedown", "mouseup", "click", "dblclick", "touchstart", "touchend", "contextmenu"];
function uiedGrab(e){
  if(!UIED.open || !UIED.mode) return;
  const t = e.target;
  if(t && t.closest && t.closest("#uied, .uied-ov")) return;
  e.preventDefault(); e.stopImmediatePropagation();
  if(UIED.mode === "pick" && e.type === "pointerdown" && t.nodeType === 1 && t !== document.documentElement){ if(UIED.placing) uiedPlaceAt(t); else uiedSelect(t); }
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
  if(!m) UIED.placing = null;
  if(m === "layout") UIED.tab = "layout";
  if(m === "pick" && !UIED.placing) UIED.tab = "pick";
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
  uiedApply(); uiedAddsSync();
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
  uiedAddsStart();
  uiedSync();
}
