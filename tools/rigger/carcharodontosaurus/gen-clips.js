// NOTE: the game now uses the hand-animated project, carcharodontosaurus-hand.json (walk, idle, rest made in the rigger: python3 tools/rigtogame.py tools/rigger/carcharodontosaurus/carcharodontosaurus-hand.json carc --walk walk --idle idle --rest rest, then sprites/carc.png is its idle frame 0).
// This script is the earlier procedural version (IK walk, shaded and toed from the flat rig); running it overwrites carcharodontosaurus-clips.json only.
// Builds the Carcharodontosaurus walk, idle and rest clips from the rig in carcharodontosaurus-rig.json (parts and joints by hand in the rigger).
//   node tools/rigger/carcharodontosaurus/gen-clips.js [OUT_DIR] ['{"S":12,"lift":4}']
// Writes carcharodontosaurus-clips.json (the project with the three clips), walk/idle/rest contact sheets and rest.png (the rest pose).
// Walk: the thighs are re-parented to the body so they follow its bob, then 2-bone IK on each hind leg (stance foot planted and sliding back
// at body speed, swing foot lifted, far leg half a cycle behind), body bob, tail and neck counter-motion, small arms swinging.
// Idle: it looks round, jaw gapes, tail flicks. Rest: it lowers onto its belly with the legs folded under it, head lowered, tail on the ground.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
const here = __dirname, OUT = path.resolve(process.argv[2] || here);
const K = Object.assign({N:8, S:15, ax:53, ay:66.5, lift:5, bob:.9, tail:6, neck:3, fps:8, ds:.6,
  lie:15, restN:10, shade:true, restTail:6, restNeck:6, restHead:6, restThigh:-85, restShin:160, restFoot:-60, restArm:10}, JSON.parse(process.argv[3] || '{}'));
fs.mkdirSync(OUT, {recursive:true});
(async()=>{
 // the rig's parts are flat base colors: shade them first (tools/pixelcarc_rig_shade.py) so the clips, previews and game pictures carry the texture; {"shade":false} leaves them flat
 let rigFile = path.join(here, 'carcharodontosaurus-rig.json');
 if(K.shade !== false){
  const tmp = path.join(os.tmpdir(), 'carc-shaded-' + process.pid + '.json');
  execFileSync('python3', ['-B', '-I', path.join(here, '..', '..', 'pixelcarc_rig_shade.py'), rigFile, tmp], {stdio:'inherit'});
  rigFile = tmp;
 }
 const proj = JSON.parse(fs.readFileSync(rigFile, 'utf8'));
 const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox']});
 const p = await b.newPage({viewport:{width:1300, height:800}}); const errs = [];
 p.on('pageerror', e => errs.push(e.message));
 await p.goto('file:///home/user/genesis-game/tools/rigger/index.html');
 const out = await p.evaluate(async ([proj, K]) => {
  await openProject(proj);
  const R = Math.PI/180, D = 180/Math.PI, TAU = 2*Math.PI, rd = x => +x.toFixed(1), by = id => P.nodes.find(n => n.id === id);
  const sm = t => (1 - Math.cos(Math.PI*t))/2;
  const ID = {body:'n130', neck:'n132', head:'n134', jaw:'n136', tail:'n146',
    near:{thigh:'n140', shin:'n142', foot:'n144', arm:'n138', off:0, sgn:1},
    far:{thigh:'n148', shin:'n150', foot:'n152', arm:'n154', off:.5, sgn:-1}};
  setParent(by(ID.near.thigh), ID.body); setParent(by(ID.far.thigh), ID.body);   // the thighs follow the body
  const legs = [ID.near, ID.far];
  const frames = [];
  // ---- walk ----
  for(let i = 0; i < K.N; i++){
    const f0 = i/K.N, pose = {};
    const bob = -K.bob*Math.cos(4*Math.PI*(f0 - K.ds/2));      // positive = body low
    pose[ID.body] = {r:0, dx:0, dy:rd(bob)};
    pose[ID.tail] = {r:rd(K.tail*Math.sin(TAU*f0) + 2*bob), dx:0, dy:0};
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
      // the foot stays level with the ground (in the swing it points a little down)
      const r3 = -tot2 - (fl >= K.ds ? 10*Math.sin(Math.PI*((fl - K.ds)/(1 - K.ds))) : 0);
      pose[L.thigh] = {r:rd(r1), dx:0, dy:0}; pose[L.shin] = {r:rd(r2), dx:0, dy:0}; pose[L.foot] = {r:rd(r3), dx:0, dy:0};
      pose[L.arm] = {r:rd(8*L.sgn*Math.cos(TAU*f0)), dx:0, dy:0};
    }
    frames.push(pose);
  }
  const walk = frames.slice();
  // ---- idle: it lifts its head and looks round, jaw gapes, snaps shut, tail flicks, then settles (12 frames, first is the rest pose) ----
  const nk = [0, -2, -4, -5, -5, -3, 2, 4, 3, 1, 0, 0], hd = [0, -3, -5, -3, 0, 4, 6, 3, 0, -1, 0, 0], jw = [0, 0, 0, 4, 14, 14, 18, 6, 0, 0, 0, 0];
  const tl = [0, 0, 1, 2, 3, 5, 5, 3, 1, 0, 0, 0], bd = [0, .3, .6, .6, .3, 0, 0, .3, .3, 0, 0, 0];
  const idle = nk.map((n, i) => ({[ID.neck]:{r:n, dx:0, dy:0}, [ID.head]:{r:hd[i], dx:0, dy:0}, [ID.jaw]:{r:jw[i], dx:0, dy:0}, [ID.tail]:{r:tl[i], dx:0, dy:0}, [ID.body]:{r:0, dx:0, dy:bd[i]}}));
  idle[0] = {};
  // ---- rest: it crouches, then lowers onto its belly with its legs folded under, head down, tail along the ground ----
  const rest = [];
  for(let i = 0; i < K.restN; i++){
    const e = sm(i/(K.restN - 1)), pose = {};
    pose[ID.body] = {r:0, dx:0, dy:rd(K.lie*e)};
    pose[ID.tail] = {r:rd(K.restTail*e), dx:0, dy:0};
    pose[ID.neck] = {r:rd(K.restNeck*e), dx:0, dy:0};
    pose[ID.head] = {r:rd(K.restHead*e), dx:0, dy:0};
    pose[ID.jaw] = {r:0, dx:0, dy:0};
    for(const L of legs){
      pose[L.thigh] = {r:rd(K.restThigh*e), dx:0, dy:0};
      pose[L.shin] = {r:rd(K.restShin*e), dx:0, dy:0};
      pose[L.foot] = {r:rd(K.restFoot*e), dx:0, dy:0};
      pose[L.arm] = {r:rd(K.restArm*e), dx:0, dy:0};
    }
    rest.push(pose);
  }
  P.clips[0].frames = walk; P.clips[0].fps = K.fps;
  P.clips[1].frames = idle; P.clips[1].fps = 8;
  P.clips[2].frames = rest; P.clips[2].fps = 8;
  ci = 0; cur = 0; sel = null; save(true);
  const sheet = (fr) => {
    const Z = 4, cols = 4, rows = Math.ceil(fr.length/cols), c = document.createElement('canvas'); c.width = 100*Z*cols; c.height = 75*Z*rows;
    const x = c.getContext('2d'); x.fillStyle = '#23272e'; x.fillRect(0, 0, c.width, c.height); x.imageSmoothingEnabled = false;
    fr.forEach((f, i) => { x.save(); x.translate((i%cols)*100*Z, Math.floor(i/cols)*75*Z); x.beginPath(); x.rect(0, 0, 100*Z, 75*Z); x.clip();
      x.strokeStyle = '#3a8'; x.setLineDash([6, 6]); x.beginPath(); x.moveTo(0, 69*Z); x.lineTo(100*Z, 69*Z); x.stroke(); x.setLineDash([]);
      x.scale(Z, Z); drawPose(x, f, 1, true); x.restore();
      x.fillStyle = '#fff'; x.font = '12px sans-serif'; x.fillText('frame ' + i, (i%cols)*100*Z + 6, Math.floor(i/cols)*75*Z + 14); });
    return c.toDataURL('image/png');
  };
  const rc = document.createElement('canvas'); rc.width = 100; rc.height = 75; drawPose(rc.getContext('2d'), {}, 1, true);
  return {walk:sheet(walk), idle:sheet(idle), rest:sheet(rest), restPng:rc.toDataURL('image/png'), proj:JSON.stringify(pruned())};
 }, [proj, K]);
 const w = (f, d) => fs.writeFileSync(path.join(OUT, f), Buffer.from(d.split(',')[1], 'base64'));
 w('walk-sheet.png', out.walk); w('idle-sheet.png', out.idle); w('rest-sheet.png', out.rest); w('rest.png', out.restPng);
 fs.writeFileSync(path.join(OUT, 'carcharodontosaurus-clips.json'), out.proj);
 console.log('errors', errs); await b.close();
})();
