/* ---------- guest view: a vivarium or aquarium seen straight through its front glass ---------- */
// Fullscreen, in true meters (no 3/4 tilt) on the map's 0.13 m pixel grid, with the case's base slab and glass edges: the front glass fills the window, the back pane is `back` as big (a little perspective, the eye `eye` of the way up the glass).
// The fittings are their own pictures standing on the floor at their depth (square pixels here; flat ones, a dish or a pool, squashed low), sorted in with the animals by depth.
// The animals are <use> copies of their pictures on the map (`.spr`), so rigs, strips, turns and pitch play here as they do there; each is placed by its x, swim height and depth.
const VIV_VIEW = {back:.82, eye:.5, tint:.5, flat:.35};
let vvEx = null, vvRaf = 0;
const vvN = v => v.toFixed(3);
function openVivView(e){
  if(!e || !e.viv || !VIVARIUMS[e.viv]) return;
  vvEx = e.id;
  const bb = bbox(e.points), W = bb.x1 - bb.x0, H = VIVARIUMS[e.viv].d * .45, K = VIV34[e.viv] || VIV34.M, E = H * VIV_VIEW.eye, B = VIV_VIEW.back;
  const w2 = W / 2, sub = e.aqua ? e.fresh ? AQUA34.gravel : AQUA34.sand : vivMix34(BIOMES[biomeOf(e)].color, "#5A4630", .4), wallCol = e.aqua ? e.fresh ? "#1E4A40" : "#1B4F78" : vivMix34(BIOMES[biomeOf(e)].color, "#FFFFFF", .15);
  // everything is drawn in whole 0.13 m pixels, as on the map: rects joined into one path per color and opacity; slanted edges step a pixel at a time
  const px = ROCK_MPP, sn = v => Math.round(v / px) * px, cells = {}, order = [];
  const R = (x0, y0, x1, y1, col, a = 1) => { x0 = sn(x0); x1 = sn(x1); y0 = sn(y0); y1 = sn(y1); if(x1 <= x0 || y1 <= y0) return; const k = col + "|" + a; if(!(k in cells)){ cells[k] = ""; order.push(k); } cells[k] += `M${vvN(x0)} ${vvN(y0)}H${vvN(x1)}V${vvN(y1)}H${vvN(x0)}z`; };
  const flush = () => { const out = order.map(k => { const [col, a] = k.split("|"); return `<path d="${cells[k]}" fill="${col}"${a !== "1" ? ` fill-opacity="${a}"` : ""} shape-rendering="crispEdges" pointer-events="none"/>`; }).join(""); order.length = 0; for(const k in cells) delete cells[k]; return out; };
  const rows = (ya, yb, f) => { for(let y = sn(Math.min(ya, yb)); y < sn(Math.max(ya, yb)) - 1e-6; y += px) f(y, clamp((y + px / 2 - ya) / (yb - ya), 0, 1)); };   // f(row top, share of the way from ya to yb)
  const lerp = (a, b, t) => a + (b - a) * t;
  let s = "";
  // the back pane: the scene's back wall from the sill up and the substrate under it, or a plain wall in the biome's (or the sea's) color, lighter in its top band
  const bx = -w2 * B, bw = W * B, top = (E - H) * B, sill = (E - K.sill) * B;
  R(bx, top, bx + bw, E * B, vivMix34(wallCol, "#000000", .15)); R(bx, top, bx + bw, lerp(top, E * B, .4), vivMix34(wallCol, "#FFFFFF", .1));
  s += flush();
  if(e.vivScene){ s += `<image href="${spriteUrl(`sprites/vivscene/${vivSceneKey(e.vivScene)}-${e.viv}-wall.png`)}" x="${vvN(sn(bx))}" y="${vvN(sn(top))}" width="${vvN(sn(bx + bw) - sn(bx))}" height="${vvN(sn(sill) - sn(top))}" preserveAspectRatio="none" style="image-rendering:pixelated"/>`; R(bx, sill, bx + bw, E * B, vivMix34(sub, "#000000", .3)); }
  // the floor from the back pane to the front glass, darker toward the back in stepped bands, with rows of short dashes
  const dk = vivMix34(sub, "#000000", .22), lt = vivMix34(sub, "#FFFFFF", .15);
  let r = 0;
  rows(E * B, E, (y, t) => { const x = lerp(w2 * B, w2, t); R(-x, y, x, y + px, vivMix34(sub, "#000000", .3 * (1 - Math.floor(t * 4) / 3)));
    if(r % 3 === 1) for(let dx = -x + ((r * 7) % 5) * px + px; dx < x - 4 * px; dx += 9 * px) R(dx, y, dx + 3 * px, y + px, Math.floor(r / 3) % 3 === 2 ? lt : dk, .7);
    r++; });
  // the lid's underside and the side panes, flat see-through tones
  rows(E - H, (E - H) * B, (y, t) => { const x = lerp(w2, w2 * B, t); R(-x, y, x, y + px, "#B0D6DA", .3); });
  for(const sd of [-1, 1]) for(let x = sn(w2 * B); x < sn(w2) - 1e-6; x += px){ const t = (x + px / 2 - w2 * B) / (w2 - w2 * B), y0 = lerp((E - H) * B, E - H, t), y1 = lerp(E * B, E, t); sd < 0 ? R(-x - px, y0, -x, y1, vivMix34(wallCol, "#000000", .35), .55) : R(x, y0, x + px, y1, vivMix34(wallCol, "#000000", .35), .55); }
  R(bx, top, bx + bw, top + px, "#BFE6F5", .35); R(bx, top, bx + px, E * B, "#BFE6F5", .35); R(bx + bw - px, top, bx + bw, E * B, "#BFE6F5", .35);   // the back pane's edges
  s += flush() + `<g id="vvAnimals"></g>`;
  // the water over everything in it: an aquarium's from the floor to the waterline, a paludarium's over its flooded front; its surface seen from below or above
  if(e.aqua || e.palu){
    const w = wqOf(e) / 100, col = vivMix34(AQUA34.foul, aquaClean34(e), w), a = ((AQUA34.alpha[0] + (AQUA34.alpha[1] - AQUA34.alpha[0]) * (1 - w)) * VIV_VIEW.tint).toFixed(2);
    const wl = e.palu ? paluLine(e) : aquaLine(e), t0 = e.palu ? (paluY(e) - bb.y0) / (bb.y1 - bb.y0) : 0, sb = B + (1 - B) * t0, fy = E - wl, fb = fy * sb, below = fy < fb;   // below: the surface is above the eye, seen from under it
    const surf = vivMix34(col, "#FFFFFF", .45);
    rows(fy, fb, (y, t) => { const x = lerp(w2, w2 * sb, t); R(-x, y, x, y + px, surf, (a * .8).toFixed(2)); if(below){ R(-w2, y, -x, y + px, col, a); R(x, y, w2, y + px, col, a); } });
    R(-w2, Math.max(fy, fb), w2, E, col, a);
    R(-w2, fy, w2, fy + px, vivMix34(col, "#FFFFFF", .6), .8);   // the waterline on the front glass
  }
  // the front glass: two stepped glints, top left, and one-pixel see-through edges
  for(const [x0, wd] of [[-w2 + W * .1, 2], [-w2 + W * .1 + 5 * px, 1]]) rows(E - H + 3 * px, E - 3 * px, (y, t) => R(x0 + Math.floor((1 - t) * (H - 6 * px) / px / 3) * px, y, x0 + (Math.floor((1 - t) * (H - 6 * px) / px / 3) + wd) * px, y + px, "#E8F4F4", .14));
  R(-w2, E - H, w2, E - H + px, "#BFE6F5", .6); R(-w2, E - H, -w2 + px, E, "#BFE6F5", .6); R(w2 - px, E - H, w2, E, "#BFE6F5", .6);
  // the base slab under the glass, as on the map: dark brown edge, lit row, brown tiles with staggered joints, darkest bottom row
  const Bs = Math.round(K.sill / px), C = PARK34;
  R(-w2, E, w2, E + px, C.C); R(-w2 + px, E + px, w2 - px, E + 2 * px, C.X); R(-w2 + px, E + 2 * px, w2 - px, E + (Bs - 1) * px, C.W); R(-w2, E + (Bs - 1) * px, w2, E + Bs * px, C.G);
  R(-w2, E, -w2 + px, E + Bs * px, C.C); R(w2 - px, E, w2, E + Bs * px, C.C); R(-w2 + px, E + px, -w2 + 2 * px, E + 2 * px, C.a);
  for(let j = 2; j < Bs - 1; j++) for(let x = -w2 + (3 + (j % 2) * 2) * px; x < w2 - 2 * px; x += 5 * px) R(x, E + j * px, x + px, E + (j + 1) * px, C.M);
  s += flush();
  const svg = $("#vvSvg");
  svg.setAttribute("viewBox", `${vvN(sn(-w2))} ${vvN(sn(E - H))} ${vvN(sn(w2) - sn(-w2))} ${vvN(sn(E + Bs * px) - sn(E - H))}`);
  svg.innerHTML = s;
  const kinds = [...new Set(e.animals.map(a => a.sp))].map(sp => `${SPECIES_BY_ID[sp].name} × ${e.animals.filter(a => a.sp === sp).length}`);
  $("#vvTitle").textContent = e.name;
  $("#vvMeta").textContent = kinds.length ? kinds.join(", ") : "No animals.";
  const d = $("#dlgVivView"); if(!d.open) d.showModal();
  cancelAnimationFrame(vvRaf); vvRaf = requestAnimationFrame(vvFrame);
}
// The case's fittings in the view, each {y: its depth, svg}
function vvProps(e, bb, E, B){
  const D = bb.y1 - bb.y0 || 1, cx = (bb.x0 + bb.x1) / 2;
  return landOf(e).filter(f => VIV_SPRITES[f.type] && LAND[f.type]).map(f => {
    const V = VIV_SPRITES[f.type], t = LAND[f.type], y = V.flat ? f.y : f.y + t.r * .3, sc = B + (1 - B) * clamp((y - bb.y0) / D, 0, 1), w = V.w * ROCK_MPP, h = V.h * ROCK_MPP * (V.flat ? VIV_VIEW.flat : 1);
    return {y, svg:`<image href="${spriteUrl(`sprites/viv/${f.type}.png`)}" preserveAspectRatio="none" style="image-rendering:pixelated" x="${vvN((f.x - cx - w / 2) * sc)}" y="${vvN((E - h) * sc)}" width="${vvN(w * sc)}" height="${vvN(h * sc)}"><title>${esc(t.label)}</title></image>`};
  });
}
// Each frame: every animal in the case, back to front, at its place seen through the glass
function vvFrame(){
  const d = $("#dlgVivView"), e = state.exhibits.find(x => x.id === vvEx);
  if(!d.open) return;
  if(!e){ d.close(); return; }
  const bb = bbox(e.points), cx = (bb.x0 + bb.x1) / 2, D = bb.y1 - bb.y0 || 1, H = VIVARIUMS[e.viv].d * .45, E = H * VIV_VIEW.eye, B = VIV_VIEW.back, wl = e.aqua ? aquaLine(e) : Infinity;
  const hs = [...herd.values()].filter(h => h.exhibitId === e.id && h.placed && h.a && !h.ins).sort((a, b) => a.y - b.y);
  const items = vvProps(e, bb, E, B);
  for(const h of hs){
    const S = SPRITES[h.sp], g = h.el.querySelector(".spr"), id = "vvs-" + h.a.id, t = clamp((h.y - bb.y0) / D, 0, 1), sc = B + (1 - B) * t;
    const ht = g && S ? h.r * 4 * (S.rsize || S.size || 1) / S.ratio * (S.foot || 1) : h.r * 2;
    const z = Math.max(0, Math.min(((h.lift || 0) + (h.bob || 0)) * TILT, wl - ht - .1));   // the map's heights are stretched by the tilt; here they're meters, kept under the waterline
    if(g && g.id !== id) g.id = id;
    const pic = g ? `<use href="#${id}"/>` : `<circle r="${h.r}" fill="${PERIOD_COLOR[SPECIES_BY_ID[h.sp].period]}"/>`;
    items.push({y:h.y, svg:`<g transform="translate(${vvN((h.x - cx) * sc)} ${vvN((E - z) * sc)}) scale(${vvN(sc)}) translate(0 ${vvN(-h.r * (g ? .5 : 1))})" opacity="${h.a.act === "hide" ? .45 : 1}"><title>${esc(h.a.name || SPECIES_BY_ID[h.sp].name)}</title>${pic}</g>`});
  }
  const g = $("#vvAnimals"); if(g) g.innerHTML = items.sort((a, b) => a.y - b.y).map(it => it.svg).join("");
  vvRaf = requestAnimationFrame(vvFrame);
}
function closeVivView(){ cancelAnimationFrame(vvRaf); vvEx = null; const d = $("#dlgVivView"); if(d.open) d.close(); }
$("#closeVivView").onclick = closeVivView;
$("#dlgVivView").addEventListener("close", () => { cancelAnimationFrame(vvRaf); vvEx = null; });
$("#dlgVivView").addEventListener("click", ev => { if(ev.target === $("#dlgVivView")) closeVivView(); });
