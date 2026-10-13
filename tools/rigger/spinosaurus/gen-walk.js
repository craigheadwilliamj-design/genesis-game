// Builds the Spinosaurus walk clip from the rig in spinosaurus-rig.json (parts and joints by hand in the rigger, already shaded).
// NOTE: idle and rest were posed by hand in the rigger (spinosaurus-source.json); this script only regenerates walk and swim. The shading and texture (colors kept) come from tools/pixelspin_rig_shade.py (source.json in, clips.json out).
//   node tools/rigger/spinosaurus/gen-walk.js [OUT_DIR] ['{"S":12,"lift":4}']
// Writes spinosaurus-walk.json (the project with the walk) and walk-sheet.png (a contact sheet).
// 2-bone IK on each hind leg (stance foot planted and sliding back at body speed, swing foot lifted, far leg half a cycle behind),
// body bob, tail and neck counter-motion, small arms swinging. Swim: body low in the water (the game clips everything under the waterline,
// row K.waterline; pass it to rigtogame.py as --waterline), legs tucked back and paddling slowly, head up, a big tail wave. The body sits `sink` px low so the legs have a bend to work with.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs'), path = require('path');
const here = __dirname, OUT = path.resolve(process.argv[2] || here);
const K = Object.assign({N:8, S:12, ax:53, ay:67, sink:2.5, lift:4, bob:.8, tail:7, neck:3, fps:8, ds:.6, arm:10, swimDy:8, swimTail:9, waterline:50}, JSON.parse(process.argv[3] || '{}'));
fs.mkdirSync(OUT, {recursive:true});
(async()=>{
 const proj = JSON.parse(fs.readFileSync(path.join(here, 'spinosaurus-rig.json'), 'utf8'));
 const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox']});
 const p = await b.newPage({viewport:{width:1300, height:800}}); const errs = [];
 p.on('pageerror', e => errs.push(e.message));
 await p.goto('file:///home/user/genesis-game/tools/rigger/index.html');
 const out = await p.evaluate(async ([proj, K]) => {
  await openProject(proj);
  const D = 180/Math.PI, TAU = 2*Math.PI, rd = x => +x.toFixed(1), by = id => P.nodes.find(n => n.id === id);
  const sm = t => (1 - Math.cos(Math.PI*t))/2;
  const ID = {body:'n156', neck:'n158', head:'n160', jaw:'n162', tail:'n184', tailEnd:'n186',
    near:{thigh:'n172', shin:'n174', foot:'n176', arm:'n164', hand:'n166', off:0, sgn:1},
    far:{thigh:'n178', shin:'n180', foot:'n182', arm:'n168', hand:'n170', off:.5, sgn:-1}};
  const legs = [ID.near, ID.far], frames = [];
  for(let i = 0; i < K.N; i++){
    const f0 = i/K.N, pose = {};
    const bob = -K.bob*Math.cos(4*Math.PI*(f0 - K.ds/2));      // positive = body low
    pose[ID.body] = {r:0, dx:0, dy:rd(K.sink + bob)};
    pose[ID.tail] = {r:rd(K.tail*Math.sin(TAU*f0) + 2*bob), dx:0, dy:0};
    pose[ID.tailEnd] = {r:rd(K.tail*.8*Math.sin(TAU*(f0 - .15))), dx:0, dy:0};
    pose[ID.neck] = {r:rd(K.neck*Math.sin(TAU*(f0 + .1)) - 1.5*bob), dx:0, dy:0};
    pose[ID.head] = {r:rd(1.5*bob), dx:0, dy:0};
    pose[ID.jaw] = {r:0, dx:0, dy:0};
    const W = worlds(pose), Mb = W[ID.body];
    for(const L of legs){
      const fl = (f0 + L.off) % 1; let ax, ay;
      if(fl < K.ds){ const t = fl/K.ds; ax = K.ax + K.S/2 - K.S*t; ay = K.ay; }
      else { const t = (fl - K.ds)/(1 - K.ds); ax = K.ax - K.S/2 + K.S*sm(t); ay = K.ay - K.lift*Math.sin(Math.PI*t); }
      const th = by(L.thigh), sh = by(L.shin), ft = by(L.foot);
      const [hx, hy] = apply(Mb, th.lx, th.ly);
      const v1 = [sh.lx, sh.ly], v2 = [ft.lx, ft.ly], L1 = Math.hypot(...v1), L2 = Math.hypot(...v2);
      let dx = ax - hx, dy = ay - hy, d = Math.hypot(dx, dy);
      d = Math.min(Math.max(d, Math.abs(L1 - L2) + .3), L1 + L2 - .05);
      const ph = Math.atan2(dy, dx), al = Math.acos(Math.max(-1, Math.min(1, (L1*L1 + d*d - L2*L2)/(2*L1*d))));
      const cr = (a, c) => a[0]*c[1] - a[1]*c[0], chordRest = [v1[0] + v2[0], v1[1] + v2[1]], sRest = Math.sign(cr(chordRest, v1));
      let best = null;
      for(const th1 of [ph + al, ph - al]){ const Kx = L1*Math.cos(th1), Ky = L1*Math.sin(th1); if(Math.sign(cr([dx, dy], [Kx, Ky])) === sRest) best = th1; }
      if(best === null) best = ph + al;
      const th1rest = Math.atan2(v1[1], v1[0]), th2rest = Math.atan2(v2[1], v2[0]);
      const kx = hx + L1*Math.cos(best), ky = hy + L1*Math.sin(best), th2 = Math.atan2(ay - ky, ax - kx);
      const r1 = (best - th1rest)*D, tot2 = (th2 - th2rest)*D, r2 = tot2 - r1;
      const r3 = -tot2 - (fl >= K.ds ? 10*Math.sin(Math.PI*((fl - K.ds)/(1 - K.ds))) : 0);   // foot level, toes down a little in the swing
      pose[L.thigh] = {r:rd(r1), dx:0, dy:0}; pose[L.shin] = {r:rd(r2), dx:0, dy:0}; pose[L.foot] = {r:rd(r3), dx:0, dy:0};
      pose[L.arm] = {r:rd(K.arm*L.sgn*Math.cos(TAU*f0)), dx:0, dy:0};
      pose[L.hand] = {r:rd(-.6*K.arm*L.sgn*Math.cos(TAU*(f0 - .1))), dx:0, dy:0};
    }
    frames.push(pose);
  }
  const swim = [];
  for(let i = 0; i < K.N; i++){
    const f = i/K.N, pose = {};
    pose[ID.body] = {r:rd(.8*Math.sin(TAU*f)), dx:0, dy:rd(K.swimDy + .5*Math.sin(TAU*2*f + 1))};
    pose[ID.tail] = {r:rd(K.swimTail*Math.sin(TAU*f)), dx:0, dy:0};
    pose[ID.tailEnd] = {r:rd(K.swimTail*.9*Math.sin(TAU*(f - .15))), dx:0, dy:0};
    pose[ID.neck] = {r:rd(-3 + 1.5*Math.sin(TAU*(f + .2))), dx:0, dy:0};
    pose[ID.head] = {r:rd(-2 + 1.2*Math.sin(TAU*(f + .3))), dx:0, dy:0};
    pose[ID.jaw] = {r:0, dx:0, dy:0};
    for(const L of legs){
      const a = 55 + 9*Math.sin(TAU*(f + L.off));   // a slow paddle, the legs swept back
      pose[L.thigh] = {r:rd(a), dx:0, dy:0}; pose[L.shin] = {r:rd(25 + 8*Math.sin(TAU*(f + L.off - .2))), dx:0, dy:0}; pose[L.foot] = {r:rd(-a - 20), dx:0, dy:0};
      pose[L.arm] = {r:rd(25 + 6*Math.sin(TAU*(f + L.off))), dx:0, dy:0}; pose[L.hand] = {r:rd(15), dx:0, dy:0};
    }
    swim.push(pose);
  }
  P.clips = [{name:'walk', fps:K.fps, frames}, {name:'swim', fps:6, frames:swim}]; ci = 0; cur = 0; sel = null; save(true);
  const Z = 4, cols = 4, rows = Math.ceil(frames.length/cols), c = document.createElement('canvas'); c.width = 100*Z*cols; c.height = 75*Z*rows;
  const x = c.getContext('2d'); x.fillStyle = '#23272e'; x.fillRect(0, 0, c.width, c.height); x.imageSmoothingEnabled = false;
  frames.forEach((f, i) => { x.save(); x.translate((i%cols)*100*Z, Math.floor(i/cols)*75*Z); x.beginPath(); x.rect(0, 0, 100*Z, 75*Z); x.clip();
    x.strokeStyle = '#3a8'; x.setLineDash([6, 6]); x.beginPath(); x.moveTo(0, 68*Z); x.lineTo(100*Z, 68*Z); x.stroke(); x.setLineDash([]);
    x.scale(Z, Z); drawPose(x, f, 1, true); x.restore();
    x.fillStyle = '#fff'; x.font = '12px sans-serif'; x.fillText('frame ' + i, (i%cols)*100*Z + 6, Math.floor(i/cols)*75*Z + 14); });
  const sc = document.createElement('canvas'); sc.width = 100*Z*cols; sc.height = 75*Z*2;
  const sx = sc.getContext('2d'); sx.fillStyle = '#23272e'; sx.fillRect(0, 0, sc.width, sc.height); sx.imageSmoothingEnabled = false;
  swim.forEach((f, i) => { sx.save(); sx.translate((i%cols)*100*Z, Math.floor(i/cols)*75*Z); sx.beginPath(); sx.rect(0, 0, 100*Z, 75*Z); sx.clip();
    sx.scale(Z, Z); drawPose(sx, f, 1, true); sx.restore();
    sx.fillStyle = 'rgba(60,140,255,.35)'; sx.fillRect((i%cols)*100*Z, Math.floor(i/cols)*75*Z + K.waterline*Z, 100*Z, (75 - K.waterline)*Z); });
  return {walk:c.toDataURL('image/png'), swim:sc.toDataURL('image/png'), proj:JSON.stringify(pruned())};
 }, [proj, K]);
 fs.writeFileSync(path.join(OUT, 'walk-sheet.png'), Buffer.from(out.walk.split(',')[1], 'base64'));
 fs.writeFileSync(path.join(OUT, 'swim-sheet.png'), Buffer.from(out.swim.split(',')[1], 'base64'));
 fs.writeFileSync(path.join(OUT, 'spinosaurus-walk.json'), out.proj);
 console.log('errors', errs); await b.close();
})();
