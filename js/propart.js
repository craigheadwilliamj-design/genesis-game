/* Path objects (bin, bench, picnic, lamp, camera, donation box, info sign, Do Not Feed sign) in the flat pixel style, 3/4 view.
   Each is a few boxes (`pbox`): one flat tone a face (left lightest, front base, right darkest, top lightest), every point snapped to the pixel grid by flatPoly34 (map.js).
   An item faces along +v of its footprint (`propFront`): the points are always rectPts(...) in that order, so the front turns with the rotation and old saves need nothing.
   Gameplay hook: nothing reads the facing yet. Benches/picnics could seat guests on the front side (services.js), a sign could only count for guests walking up to its face (hasSign in guests.js), and a camera could watch a cone out of its lens (onCamera in security.js). Use propFront(b). */
const PROP_FACES = ["back", "right", "front", "left"];   // the four sides of a box, in the order of its footprint's edges; the front is +v
const PROP_METAL = "#3A3A34", PROP_BROKEN = "#6E2A26", PROP_FULL = "#C0392B";
// the way the front of a path object points, a unit vector out of its +v side
function propFront(bl){ const P = bl.points, v = [P[3][0] - P[0][0], P[3][1] - P[0][1]], L = Math.hypot(v[0], v[1]) || 1; return [v[0] / L, v[1] / L]; }
// lit, base, shaded and top tones of one color
const propTones = c => [mixHex(c, "#FFFFFF", .2), c, mixHex(c, "#000000", .28), mixHex(c, "#FFFFFF", .36)];
// pictograms for the sign faces: X is the drawn pixel
const PROP_ICONS = {
  info:[".XX.", ".XX.", "....", ".XX.", ".XX.", ".XX.", ".XX."],
  dollar:["..X..", ".XXX.", "X.X..", ".XXX.", "..X.X", ".XXX.", "..X.."],
  quiet:["..XXXXX..", ".X.....X.", "X..X.X..X", "X.......X", "X...X...X", "X...X...X", "X.XXXXX.X", ".X.....X.", "..XXXXX.."],   // a face with a finger over its lips
  nofeed:(() => { const r = []; for(let y = 0; y < 9; y++){ let row = ""; for(let x = 0; x < 9; x++){ const d = Math.hypot(x - 4, y - 4); row += (d >= 3.2 && d < 4.5) || (x === y && d < 4.5) ? "X" : "."; } r.push(row); } return r; })(),
};

// A box of the item in its own frame: u across (width), v front to back, h up, all meters from the middle. `deco` draws on a face with Q(a0, a1, g0, g1, fill):
// a along the face as a reader sees it (from its middle), g up it. `slats` lays that many plank lines along u over the top.
function pbox(F, b){
  const k = F.k, W = (u, v) => [F.c[0] + (F.u[0]*u + F.v[0]*v)*k, F.c[1] + (F.u[1]*u + F.v[1]*v)*k];
  const C = [W(b.u0, b.v0), W(b.u1, b.v0), W(b.u1, b.v1), W(b.u0, b.v1)], N = [[0, -1], [1, 0], [0, 1], [-1, 0]], len = [b.u1 - b.u0, b.v1 - b.v0, b.u1 - b.u0, b.v1 - b.v0];
  let s = "";
  for(let i = 0; i < 4; i++){
    const nx = F.u[0]*N[i][0] + F.v[0]*N[i][1], ny = F.u[1]*N[i][0] + F.v[1]*N[i][1];
    if(ny <= .05) continue;   // facing away
    const A = C[i], B = C[(i+1) % 4];
    s += flatPoly34([lift34(b.h0*k)(A), lift34(b.h0*k)(B), lift34(b.h1*k)(B), lift34(b.h1*k)(A)], b.tone[nx < -.3 ? 0 : nx > .3 ? 2 : 1], "", true);
    const d = b.deco && b.deco[PROP_FACES[i]];
    if(d){
      const Q = (a0, a1, g0, g1, fill) => { const P = (a, g) => { const f = .5 - a / len[i]; return lift34(g*k)([A[0] + (B[0] - A[0])*f, A[1] + (B[1] - A[1])*f]); }; return flatPoly34([P(a0, g0), P(a1, g0), P(a1, g1), P(a0, g1)], fill, "", true); };
      s += d(Q, F.px);
    }
  }
  s += flatPoly34(C.map(lift34(b.h1*k)), b.tone[3], "", true);
  if(b.slats) for(let j = 1; j < b.slats; j++){ const t = j / b.slats, v = b.v0 + (b.v1 - b.v0)*t; s += flatLine34(lift34(b.h1*k)(W(b.u0, v)), lift34(b.h1*k)(W(b.u1, v)), b.tone[2], FLAT34.px); }
  return s;
}
// pixels of a pictogram on a face: rows of "X" (or any letter keyed in `on`), centered at along-position cx, bottom row at height g0, one pixel is px
function pbits(Q, px, rows, cx, g0, on){
  let s = "";
  rows.forEach((row, r) => { for(let c = 0; c < row.length;){ const ch = row[c]; if(ch === "."){ c++; continue; } let e = c; while(e < row.length && row[e] === ch) e++;
    s += Q(cx + (c - row.length / 2)*px, cx + (e - row.length / 2)*px, g0 + (rows.length - 1 - r)*px, g0 + (rows.length - r)*px, typeof on === "string" ? on : on[ch]); c = e; } });
  return s;
}

// The item drawn in pixels. `inv` is 1 / view.k, `on`/`dead` the selected and doomed states (the only ones that get an outline).
function propArt(bl, inv, on, dead){
  const t = BUILDINGS[bl.type], T = themeOf(bl), P = bl.points, c = centroid(P), px0 = FLAT34.px;
  const uu = [P[1][0] - P[0][0], P[1][1] - P[0][1]], ul = Math.hypot(uu[0], uu[1]) || 1, fv = propFront(bl);
  const k = Math.min(1.5, Math.max(1, 4.5*inv / (Math.max(t.w, t.d) / 2)));   // a little bigger than true size when far out, never giant (the tap area in map.js stays generous)
  const F = {c, u:[uu[0] / ul, uu[1] / ul], v:fv, k, px:px0 / k};
  const broken = isBroken(bl), full = bl.type === "bin" && (bl.fill || 0) >= LITTER.binCap;
  if(PROP_PICS[bl.type] && T === THEMES.genesis) return propSprite34(bl, k, broken ? "-broken" : full ? "-full" : "", on, dead);
  const col =broken ? PROP_BROKEN : full ? PROP_FULL : themeFill(bl, t.color);
  const metal = broken ? PROP_BROKEN : T === THEMES.genesis ? PROP_METAL : mixHex(PROP_METAL, T.edge, .35);
  const TC = propTones(col), TM = propTones(metal), TD = propTones(mixHex(col, "#000000", .22)), px = F.px;
  const bx = (u0, u1, v0, v1, h0, h1, tone, deco, slats) => ({u0, u1, v0, v1, h0, h1, tone, deco, slats});
  const DARK = "#14281C", PALE = "#F4F1E8", GOLD = FLAT34.gold, LENS = "#FFF6C8";
  const boxes = [];
  const pole = (h) => { boxes.push(bx(-.3, .3, -.3, .3, 0, .5, TM, {front:Q => Q(-.3, .3, .38, .5, broken ? PROP_BROKEN : GOLD)}), bx(-.08, .08, -.08, .08, .5, h, TM)); };
  if(bl.type === "bin"){
    // a square bin with a lid; the flap opening is on the front, rails on the back, grooves down the sides
    const flap = Q => broken ? "" : Q(-.3, .3, .6, .95, DARK) + Q(-.3, .3, .95, .95 + px, TC[3]) + Q(-.3, .3, .6 - px, .6, TC[2]);
    boxes.push(bx(-.5, .5, -.45, .45, 0, 1.05, TC, {front:Q => flap(Q) + Q(-.5, .5, 0, .14, TC[2]), back:Q => Q(-.32, -.2, .1, .95, TC[2]) + Q(.2, .32, .1, .95, TC[2]), left:Q => Q(-.45, .45, .35, .35 + px, TC[2]) + Q(-.45, .45, .65, .65 + px, TC[2]), right:Q => Q(-.45, .45, .35, .35 + px, TC[2]) + Q(-.45, .45, .65, .65 + px, TC[2])}));
    boxes.push(bx(-.58, .58, -.53, .53, 1.05, 1.22, TD, {front:Q => Q(-.58, .58, 1.05, 1.05 + px, TD[2])}));
  } else if(bl.type === "bench"){
    // seat on the front half, the backrest behind it, end frames in metal; slat grooves on the front, a plain backrest from behind
    for(const s of [-1, 1]) boxes.push(bx(s*1.15 - .1, s*1.15 + .1, -.45, .5, 0, .46, TM), bx(s*.95 - .06, s*.95 + .06, -.5, -.38, .46, .5, TM));
    boxes.push(bx(-1.4, 1.4, -.1, .5, .42, .5, TC, {front:Q => Q(-1.4, 1.4, .45, .45 + px*.6, TC[2])}, 3));
    boxes.push(bx(-1.4, 1.4, -.5, -.38, .5, 1.1, TC, {front:Q => Q(-1.4, 1.4, .7, .7 + px*.7, TC[2]) + Q(-1.4, 1.4, .92, .92 + px*.7, TC[2]), back:Q => Q(-1.4, -1.25, .5, 1.1, TM[1]) + Q(1.25, 1.4, .5, 1.1, TM[1])}));
  } else if(bl.type === "picnic"){
    // a table with a bench along each long side; the front (long side) has the gold name plate and the apron, the back shows the cross braces
    for(const s of [-1, 1]) boxes.push(bx(s*2 - .1, s*2 + .1, -1.3, 1.3, .28, .36, TM), bx(s*2 - .1, s*2 + .1, -.12, .12, 0, .78, TM), bx(s*2 - .1, s*2 + .1, -1.5, -1.3, 0, .44, TM), bx(s*2 - .1, s*2 + .1, 1.3, 1.5, 0, .44, TM));
    boxes.push(bx(-2.6, 2.6, 1.05, 1.55, .38, .46, TC, null, 2), bx(-2.6, 2.6, -1.55, -1.05, .38, .46, TC, null, 2));
    boxes.push(bx(-2.4, 2.4, -.7, .7, .62, .72, TD, {front:Q => Q(-2.4, 2.4, .62, .72, TD[1])}));
    boxes.push(bx(-2.6, 2.6, -.85, .85, .72, .84, TC, {front:Q => Q(-.3, .3, .74, .82, broken ? PROP_BROKEN : GOLD) + Q(-2.6, 2.6, .72, .72 + px*.6, TC[2]), back:Q => Q(-2.6, 2.6, .72, .72 + px*.6, TC[2])}, 5));
  } else if(bl.type === "lamp"){
    // the head's lens faces front, the back is plain housing
    pole(3.7);
    boxes.push(bx(-.06, .06, 0, .5, 3.6, 3.72, TM));
    boxes.push(bx(-.3, .3, -.1, .58, 3.72, 4.12, TC, {front:Q => broken ? "" : Q(-.22, .22, 3.8, 4.04, LENS) + Q(-.22, -.14, 3.96, 4.04, "#FFFFFF"), left:Q => Q(-.4, .4, 3.88, 3.88 + px*.7, TC[2]), right:Q => Q(-.4, .4, 3.88, 3.88 + px*.7, TC[2]), back:Q => Q(-.16, .16, 3.8, 4.04, TM[1])}));
  } else if(bl.type === "camera"){
    // the lens looks out of the front; the cable box is on the back
    pole(3.35);
    boxes.push(bx(-.1, .1, -.1, .1, 3.2, 3.42, TM));
    boxes.push(bx(-.26, .26, -.4, .56, 3.42, 3.86, TC, {front:Q => broken ? "" : Q(-.18, .18, 3.52, 3.78, DARK) + Q(-.1, .1, 3.58, 3.72, TC[1]) + Q(-.1, -.04, 3.66, 3.72, "#E8F0FF") + Q(.2, .24, 3.78, 3.82, "#E5484D"), back:Q => Q(-.1, .1, 3.5, 3.7, TM[1]) + Q(-.1, .1, 3.7, 3.7 + px, GOLD), left:Q => Q(-.4, .4, 3.6, 3.6 + px*.7, TC[2]), right:Q => Q(-.4, .4, 3.6, 3.6 + px*.7, TC[2])}));
    boxes.push(bx(-.3, .3, -.35, .72, 3.86, 3.94, TM));
  } else if(bl.type === "donate"){
    // the slot and the coin sign on the front; a lock plate on the back; a gold band round the sides
    boxes.push(bx(-.5, .5, -.45, .45, 0, .1, TM));
    boxes.push(bx(-.44, .44, -.4, .4, .1, 1.35, TC, {
      front:Q => broken ? "" : Q(-.3, .3, .35, .98, TC[0]) + pbits(Q, px, PROP_ICONS.dollar, 0, .4, GOLD) + Q(-.24, .24, 1.1, 1.1 + px*1.2, DARK) + Q(-.28, .28, 1.1 + px*1.2, 1.1 + px*2.2, GOLD),
      back:Q => Q(-.12, .12, .55, .8, GOLD) + Q(-.03, .03, .6, .7, DARK),
      left:Q => Q(-.4, .4, .3, .3 + px, GOLD), right:Q => Q(-.4, .4, .3, .3 + px, GOLD)}));
    boxes.push(bx(-.52, .52, -.47, .47, 1.35, 1.5, TD));
  } else {
    // info and Do Not Feed signs: a thin board on two posts. The painted face is the front; the back is bare grey with two bolts.
    const icon = bl.type === "nofeed" ? PROP_ICONS.nofeed : bl.type === "quiet" ? PROP_ICONS.quiet : PROP_ICONS.info, top = 1 + 9*px;
    for(const s of [-1, 1]) boxes.push(bx(s*.6 - .05, s*.6 + .05, -.06, .06, 0, 1.6, TM));
    boxes.push(bx(-.75, .75, -.06, .06, 1, top, TC, {
      front:Q => broken ? "" : Q(-.75, .75, top - px, top, PALE) + Q(-.75, .75, 1, 1 + px, PALE) + Q(-.75, -.75 + px, 1, top, PALE) + Q(.75 - px, .75, 1, top, PALE) + pbits(Q, px, icon, 0, 1 + px, PALE),
      back:Q => Q(-.75, .75, 1, top, TM[0]) + Q(-.68, -.55, 1.08, 1.08 + px, TM[2]) + Q(.55, .68, 1.08, 1.08 + px, TM[2]) + Q(-.68, -.55, top - px*2, top - px, TM[2]) + Q(.55, .68, top - px*2, top - px, TM[2])}));
  }
  // far boxes first; at the same depth the lower one first
  const wy = b => F.c[1] + (F.u[1]*(b.u0 + b.u1) + F.v[1]*(b.v0 + b.v1)) / 2 * k;
  boxes.sort((a, b) => wy(a) - wy(b) || a.h0 - b.h0);
  // the shadow: the ground the boxes cover, thrown down and to the right by the tallest one
  const sh = Math.max(...boxes.map(b => b.h1)) * .22 * k, ex = f => Math[f](...boxes.flatMap(b => [b.u0, b.u1])), ey = f => Math[f](...boxes.flatMap(b => [b.v0, b.v1]));
  const foot = [[ex("min"), ey("min")], [ex("max"), ey("min")], [ex("max"), ey("max")], [ex("min"), ey("max")]].map(([u, v]) => [c[0] + (F.u[0]*u + F.v[0]*v)*k + sh*.8, c[1] + (F.u[1]*u + F.v[1]*v)*k + sh*.6]);
  let s = flatPoly34(foot, "#1D2B22", "", true).replace('fill="#1D2B22"', 'fill="#1D2B22" fill-opacity=".22"');
  for(const b of boxes) s += pbox(F, b);
  if(on || dead) s += `<polygon points="${polyStr(P)}" fill="none" stroke="${dead ? "var(--bad)" : "var(--sel)"}" stroke-width="2.5" stroke-linejoin="round" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
  return s;
}
// Genesis path objects drawn as pictures in the restroom's style (sprites/bld/<type>-<front|back|left|right>[-full|-broken].png, made by tools/pixelbin.py and tools/pixelbench.py), picked by where the item's front looks.
// Each view is [width, height, front]: the picture is centered across, and the bottom of its base (the third row from the bottom, above the 2 shadow rows) sits `front` m in front of the middle, scaled by k like the drawn props.
// A bench's end-on views cheat the projection (its end profile with a short top, not two tall strips running back), standing in the middle of the footprint.
const PROP_PICS = {
  bin:{front:[14, 21, .45], back:[14, 21, .45], left:[14, 21, .45], right:[14, 21, .45]},
  bench:{front:[26, 16, .5], back:[26, 12, .5], left:[12, 15, .5], right:[12, 15, .5]},
};
function propSprite34(bl, k, st, on, dead){
  const [fx, fy] = propFront(bl), view = Math.abs(fy) >= Math.abs(fx) ? (fy > 0 ? "front" : "back") : fx < 0 ? "left" : "right";
  const [w, h, e] = PROP_PICS[bl.type][view], px = FLAT34.px * k, [cx, cy] = centroid(bl.points), [x, y] = flatSnap34([cx - w / 2 * px, cy + e * k - (h - 2) * px / TILT]);
  return `<image href="${spriteUrl(`sprites/bld/${bl.type}-${view}${st}.png`)}" x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${(w * px).toFixed(2)}" height="${(h * px / TILT).toFixed(2)}" preserveAspectRatio="none" style="image-rendering:pixelated" pointer-events="none"/>`
    + (on || dead ? `<polygon points="${polyStr(bl.points)}" fill="none" stroke="${dead ? "var(--bad)" : "var(--sel)"}" stroke-width="2.5" stroke-linejoin="round" vector-effect="non-scaling-stroke" pointer-events="none"/>` : "");
}
// the flat (top-down) view's front mark: a short bar from the middle out through the front edge, so rotation shows there too
function propFrontMark(bl, r){
  const [cx, cy] = centroid(bl.points), [fx, fy] = propFront(bl);
  return `<path d="M${(cx + fx*r*.25).toFixed(2)} ${(cy + fy*r*.25).toFixed(2)}L${(cx + fx*r*.95).toFixed(2)} ${(cy + fy*r*.95).toFixed(2)}" stroke="#fff" stroke-opacity=".9" stroke-width="2.4" stroke-linecap="round" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
}

/* Viewing platforms in the flat pixel style, 3/4 view. A raised deck on stilts with a rail all round, steps down to the path on one long side and the viewing rail (with a small VIEW sign) on the other.
   The deck's footprint is rectPts(...) of the fence side it snapped to, so the long axis follows that side at any angle, diagonals included. Nothing is saved for the facing: the side whose middle lies inside the exhibit is
   the animal side (the frame's +v, the front, like the path objects), the other long side is the entry. Same boxes (`pbox`) and tones as the path objects. */
const DECK = {h:2.2, step:.55, steps:3, gap:1.6, rail:1.1, seg:1.75};
function deckFrame(bl){
  const P = bl.points, w = Math.hypot(P[1][0] - P[0][0], P[1][1] - P[0][1]), d = Math.hypot(P[3][0] - P[0][0], P[3][1] - P[0][1]), c = centroid(P);
  const a = w >= d ? [P[1][0] - P[0][0], P[1][1] - P[0][1]] : [P[3][0] - P[0][0], P[3][1] - P[0][1]], al = Math.hypot(a[0], a[1]) || 1;
  let u = [a[0] / al, a[1] / al], v = [-u[1], u[0]];
  const hw = Math.max(w, d) / 2, hd = Math.min(w, d) / 2, e = state.exhibits.find(x => x.id === bl.exhibitId);
  if(e){   // the animal side is the long side that lies over the exhibit
    const at = s => inPoly(c[0] + v[0]*hd*s, c[1] + v[1]*hd*s, e.points), plus = at(1), minus = at(-1);
    let flip = false;
    if(plus !== minus) flip = !plus;
    else { const [ex, ey] = centroid(e.points); flip = (ex - c[0])*v[0] + (ey - c[1])*v[1] < 0; }
    if(flip) v = [-v[0], -v[1]];
  }
  if(u[0]*v[1] - u[1]*v[0] < 0) u = [-u[0], -u[1]];   // a proper turn, so lettering on the front reads the right way round
  return {c, u, v, hw, hd, e};
}
function deckArt(bl, inv, on, dead, reach){
  const t = BUILDINGS.platform, T = themeOf(bl), D = DECK, fr = deckFrame(bl), {c, hw, hd, e} = fr, px0 = FLAT34.px;
  const F = {c, u:fr.u, v:fr.v, k:1, px:px0}, px = px0, H = D.h;
  const col = themeFill(bl, t.color), fk = e && FENCE34[e.barrier], rc = fk ? mixHex(fk.col, col, .35) : mixHex(col, "#000000", .3);   // the rail takes the fence's color
  const TC = propTones(col), TD = propTones(mixHex(col, "#000000", .3)), TR = propTones(rc), TS = propTones("#F4F1E8");
  const GOLD = FLAT34.gold, INK = "#14281C", boxes = [];
  const bx = (u0, u1, v0, v1, h0, h1, tone, deco, slats) => ({u0, u1, v0, v1, h0, h1, tone, deco, slats});
  // stilts under the deck, along both long sides
  const nst = Math.max(2, Math.round(2*hw / 3.5) + 1);
  for(let i = 0; i < nst; i++){ const uu = -hw + .5 + (2*hw - 1) * i / (nst - 1); for(const sv of [-1, 1]) boxes.push(bx(uu - .2, uu + .2, sv*(hd - .45) - .2, sv*(hd - .45) + .2, 0, H - .4, TD)); }
  // the deck: planks run along it, a gold trim under the viewing edge, a pale stripe on the entry side
  boxes.push(bx(-hw, hw, -hd, hd, H - .4, H, TC, {front:Q => Q(-hw, hw, H - .4, H - .4 + px, GOLD), back:Q => Q(-D.gap, D.gap, H - .4, H - .4 + px*2, TS[1]), left:Q => Q(-hd, hd, H - .4, H - .4 + px, TC[2]), right:Q => Q(-hd, hd, H - .4, H - .4 + px, TC[2])}, Math.max(2, Math.round(hd * 2))));
  // steps down to the path on the entry side
  for(let j = 0; j < D.steps; j++){ const top = H - D.step * (j + 1); boxes.push(bx(-D.gap + .1, D.gap - .1, -hd - D.step * (j + 1), -hd - D.step * j, 0, top, TC, {front:Q => Q(-D.gap + .1, D.gap - .1, top - px, top, TC[2])})); }
  // railings: posts and a top and middle rail in runs of D.seg; the entry side is open at the steps
  const run = (u0, v0, u1, v1) => {
    const L = Math.hypot(u1 - u0, v1 - v0), n = Math.max(1, Math.round(L / D.seg));
    for(let i = 0; i <= n; i++){ const uu = u0 + (u1 - u0) * i / n, vv = v0 + (v1 - v0) * i / n; boxes.push(bx(uu - .08, uu + .08, vv - .08, vv + .08, H, H + D.rail, TR)); }
    for(let i = 0; i < n; i++){ const a = [u0 + (u1 - u0) * i / n, v0 + (v1 - v0) * i / n], b = [u0 + (u1 - u0) * (i + 1) / n, v0 + (v1 - v0) * (i + 1) / n];
      for(const [h0, h1] of [[H + D.rail - .13, H + D.rail], [H + .5, H + .6]]) boxes.push(bx(Math.min(a[0], b[0]) - .07, Math.max(a[0], b[0]) + .07, Math.min(a[1], b[1]) - .07, Math.max(a[1], b[1]) + .07, h0, h1, TR)); }
  };
  const r = .2;
  run(-hw + r, hd - r, hw - r, hd - r);   // the viewing rail, over the animals
  run(-hw + r, -hd + r, -hw + r, hd - r); run(hw - r, -hd + r, hw - r, hd - r);   // the two ends
  run(-hw + r, -hd + r, -D.gap, -hd + r); run(D.gap, -hd + r, hw - r, -hd + r);   // the entry side, open at the steps
  // the sign hung on the viewing rail, facing the animals
  boxes.push(bx(-1.4, 1.4, hd - r - .06, hd - r + .06, H + .18, H + 1.0, TS, {front:Q => Q(-1.4, 1.4, H + .18, H + .18 + px, GOLD) + Q(-1.4, 1.4, H + 1.0 - px, H + 1.0, GOLD) + flatText34(Q, 1, 0, H + .3, "VIEW", INK)}));
  const wy = b => c[1] + (F.u[1]*(b.u0 + b.u1) + F.v[1]*(b.v0 + b.v1)) / 2;
  boxes.sort((a, b) => wy(a) - wy(b) || a.h0 - b.h0);
  const sh = H * .22, foot = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([uu, vv]) => [c[0] + F.u[0]*uu + F.v[0]*vv + sh*.8, c[1] + F.u[1]*uu + F.v[1]*vv + sh*.6]);
  let s = `<polygon points="${polyStr(bl.points)}" fill="transparent"/><polygon points="${polyStr(bl.points.map(lift34(H + D.rail)))}" fill="transparent"/>`;   // something to tap
  s += flatPoly34(foot, "#1D2B22", "", true).replace('fill="#1D2B22"', 'fill="#1D2B22" fill-opacity=".22"');
  for(const b of boxes) s += pbox(F, b);
  if(on || dead || !reach) s += `<polygon points="${polyStr(bl.points)}" fill="none" stroke="${dead ? "var(--bad)" : on ? "var(--sel)" : "var(--bad)"}" stroke-width="${on || dead ? 3 : 1.5}" ${!on && !dead ? `stroke-dasharray="4 3"` : ""} stroke-linejoin="round" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
  return s;
}
