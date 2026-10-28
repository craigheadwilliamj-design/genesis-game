/* ---------- guest view: a vivarium or aquarium seen straight through its front glass ---------- */
// Fullscreen, in true meters (no 3/4 tilt): the front glass fills the window, the back pane is `back` as big (a little perspective, the eye `eye` of the way up the glass).
// The fittings are their own pictures standing on the floor at their depth (square pixels here; flat ones, a dish or a pool, squashed low), sorted in with the animals by depth.
// The animals are <use> copies of their pictures on the map (`.spr`), so rigs, strips, turns and pitch play here as they do there; each is placed by its x, swim height and depth.
const VIV_VIEW = {back:.82, eye:.5, tint:.5, flat:.35};
let vvEx = null, vvRaf = 0;
const vvN = v => v.toFixed(3);
function openVivView(e){
  if(!e || !e.viv || !VIVARIUMS[e.viv]) return;
  vvEx = e.id;
  const bb = bbox(e.points), W = bb.x1 - bb.x0, H = VIVARIUMS[e.viv].d * .45, K = VIV34[e.viv] || VIV34.M, E = H * VIV_VIEW.eye, B = VIV_VIEW.back;
  const w2 = W / 2, sub = e.aqua ? AQUA34.sand : vivMix34(BIOMES[biomeOf(e)].color, "#5A4630", .4), wallCol = e.aqua ? "#1B4F78" : vivMix34(BIOMES[biomeOf(e)].color, "#FFFFFF", .15);
  const P = pts => `points="${pts.map(p => vvN(p[0]) + "," + vvN(p[1])).join(" ")}"`, at = (x, y, s) => [x * s, y * s];
  let s = `<defs><linearGradient id="vvFloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${vivMix34(sub, "#000000", .3)}"/><stop offset="1" stop-color="${sub}"/></linearGradient>`
    + `<linearGradient id="vvWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${vivMix34(wallCol, "#FFFFFF", .2)}"/><stop offset="1" stop-color="${vivMix34(wallCol, "#000000", .25)}"/></linearGradient></defs>`;
  // the back pane: the scene's back wall from the sill up, the substrate under it; or a plain wash in the biome's (or the sea's) colour
  const bx = -w2 * B, bw = W * B, top = (E - H) * B, sill = (E - K.sill) * B;
  s += `<rect x="${vvN(bx)}" y="${vvN(top)}" width="${vvN(bw)}" height="${vvN(H * B)}" fill="url(#vvWall)"/>`;
  if(e.vivScene) s += `<image href="${spriteUrl(`sprites/vivscene/${vivSceneKey(e.vivScene)}-${e.viv}-wall.png`)}" x="${vvN(bx)}" y="${vvN(top)}" width="${vvN(bw)}" height="${vvN(sill - top)}" preserveAspectRatio="none" style="image-rendering:pixelated"/>`
    + `<rect x="${vvN(bx)}" y="${vvN(sill)}" width="${vvN(bw)}" height="${vvN(E * B - sill)}" fill="${vivMix34(sub, "#000000", .3)}"/>`;
  // the floor, the lid's underside and the side panes run from the front glass back to the back pane
  s += `<polygon ${P([[-w2, E], [w2, E], at(w2, E, B), at(-w2, E, B)])} fill="url(#vvFloor)"/>`;
  s += `<polygon ${P([[-w2, E - H], [w2, E - H], at(w2, E - H, B), at(-w2, E - H, B)])} fill="#DDEFF2" fill-opacity=".35"/>`;
  for(const x of [-w2, w2]) s += `<polygon ${P([[x, E - H], at(x, E - H, B), at(x, E, B), [x, E]])} fill="${vivMix34(wallCol, "#000000", .35)}" fill-opacity=".55"/>`;
  s += `<g id="vvAnimals"></g>`;
  // the water over everything in it: an aquarium's from the floor to the waterline, a paludarium's over its flooded front; its surface seen from below or above
  if(e.aqua || e.palu){
    const w = wqOf(e) / 100, col = vivMix34(AQUA34.foul, AQUA34.clean, w), a = (AQUA34.alpha[0] + (AQUA34.alpha[1] - AQUA34.alpha[0]) * (1 - w)) * VIV_VIEW.tint;
    const wl = e.palu ? paluLine(e) : aquaLine(e), t0 = e.palu ? (paluY(e) - bb.y0) / (bb.y1 - bb.y0) : 0, sb = B + (1 - B) * t0, fy = E - wl;
    const body = E > wl ? [[-w2, E], [w2, E], [w2, fy], at(w2, fy, sb), at(-w2, fy, sb), [-w2, fy]] : [[-w2, E], [w2, E], [w2, fy], [-w2, fy]];
    s += `<polygon ${P(body)} fill="${col}" fill-opacity="${a.toFixed(2)}" pointer-events="none"/>`;
    s += `<polygon ${P([[-w2, fy], [w2, fy], at(w2, fy, sb), at(-w2, fy, sb)])} fill="${vivMix34(col, "#FFFFFF", .45)}" fill-opacity="${(a * .8).toFixed(2)}" pointer-events="none"/>`;
    s += `<path d="M${vvN(-w2)} ${vvN(fy)}H${vvN(w2)}" stroke="${vivMix34(col, "#FFFFFF", .6)}" stroke-opacity=".8" stroke-width="${vvN(W / 400)}" pointer-events="none"/>`;
  }
  // a couple of glints on the front glass
  const gl = (x0, x1, op) => `<polygon ${P([[x0, E], [x0 + W * .03, E], [x1 + W * .03, E - H], [x1, E - H]])} fill="#FFFFFF" fill-opacity="${op}" pointer-events="none"/>`;
  s += gl(-w2 + W * .08, -w2 + W * .18, .06) + gl(-w2 + W * .24, -w2 + W * .3, .04);
  const svg = $("#vvSvg");
  svg.setAttribute("viewBox", `${vvN(-w2)} ${vvN(E - H)} ${vvN(W)} ${vvN(H)}`);
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
