// Builds the Coelophysis walk and rest clips on the hand-made rig in coelophysis-rig.json (parts, joints, shading and both idles made in the rigger).
//   node tools/rigger/coelophysis/gen-clips.js [OUT_DIR] ['{"S":10,"lift":3}']
// Writes coelophysis-clips.json (the project with walk, idle, idle2 and rest), contact sheets of each clip, and in the repo
// sprites/coel.png (the standing pose) and sprites/coel-walk.png (the walk strip, the fallback when rigs are off or in a vivarium).
// The rig's "rest" clip is its second idle (it rears up and looks round), so it is renamed idle2; "idle" (it stoops and hisses) is kept.
// The thighs are roots, not children of the body (the idles bend the body over the hips with the legs still), so the walk shifts them with the body's bob.
// Walk: 2-bone IK on each hind leg (stance foot planted and sliding back at body speed, swing foot lifted, far leg half a cycle behind),
// body bob, tail and neck counter-motion, small arms swinging. Rest: the ankles stay put while the hips sink (IK, knees forward) until it lies
// on its belly, then the head and neck lower and the tail settles on the ground.
// Then: python3 tools/rigtogame.py tools/rigger/coelophysis/coelophysis-clips.json coel --walk walk --idle idle idle2 --rest rest
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs'), path = require('path');
const here = __dirname, OUT = path.resolve(process.argv[2] || here), ROOT = path.join(here, '..', '..', '..');
const K = Object.assign({N:8, S:10, sink:1.2, lift:3, bob:.6, tail:5, neck:2.5, fps:8, ds:.6, arm:7,
  restN:12, lie:13.5, restNeck:14, restHead:-8, restTail:-6, restTailEnd:-3, restArm:-70}, JSON.parse(process.argv[3] || '{}'));
fs.mkdirSync(OUT, {recursive:true});
(async()=>{
 const proj = JSON.parse(fs.readFileSync(path.join(here, 'coelophysis-rig.json'), 'utf8'));
 const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox']});
 const p = await b.newPage({viewport:{width:1300, height:800}}); const errs = [];
 p.on('pageerror', e => errs.push(e.message));
 await p.goto('file://' + path.join(ROOT, 'tools', 'rigger', 'index.html'));
 const out = await p.evaluate(async ([proj, K]) => {
  await openProject(proj);
  const D = 180/Math.PI, TAU = 2*Math.PI, rd = x => +x.toFixed(1), by = id => P.nodes.find(n => n.id === id);
  const sm = t => (1 - Math.cos(Math.PI*t))/2;
  const ID = {body:'n156', neck:'n158', head:'n160', jaw:'n162', tail:'n164', tailEnd:'n166',
    near:{thigh:'n168', shin:'n170', foot:'n172', arm:'n174', off:0, sgn:1},
    far:{thigh:'n176', shin:'n178', foot:'n180', arm:'n182', off:.5, sgn:-1}};
  const legs = [ID.near, ID.far], W0 = worlds({});
  for(const L of legs){ L.ax = W0[L.foot][4]; L.ay = W0[L.foot][5]; }   // each ankle's place standing
  // 2-bone IK: turns for thigh, shin and foot that put the ankle at (ax, ay) with the knee bent forward, the foot level (tilt: toes down by that many degrees)
  const ik = (pose, L, ax, ay, tilt) => {
    const th = by(L.thigh), sh = by(L.shin), ft = by(L.foot), Wp = worlds(pose), hx = Wp[L.thigh][4], hy = Wp[L.thigh][5];
    const v1 = [sh.lx, sh.ly], v2 = [ft.lx, ft.ly], L1 = Math.hypot(...v1), L2 = Math.hypot(...v2);
    let dx = ax - hx, dy = ay - hy, d = Math.hypot(dx, dy);
    d = Math.min(Math.max(d, Math.abs(L1 - L2) + .3), L1 + L2 - .05);
    const ph = Math.atan2(dy, dx), al = Math.acos(Math.max(-1, Math.min(1, (L1*L1 + d*d - L2*L2)/(2*L1*d))));
    const best = Math.cos(ph + al) > Math.cos(ph - al) ? ph + al : ph - al;   // the knee that is further forward
    const kx = hx + L1*Math.cos(best), ky = hy + L1*Math.sin(best), th2 = Math.atan2(ay - ky, ax - kx);
    const r1 = (best - Math.atan2(v1[1], v1[0]))*D, tot2 = (th2 - Math.atan2(v2[1], v2[0]))*D;
    pose[L.thigh] = {r:rd(r1), dx:pose[L.thigh] ? pose[L.thigh].dx : 0, dy:pose[L.thigh] ? pose[L.thigh].dy : 0};
    pose[L.shin] = {r:rd(tot2 - r1), dx:0, dy:0}; pose[L.foot] = {r:rd(-tot2 - (tilt || 0)), dx:0, dy:0};
  };
  // ---- walk ----
  const walk = [];
  for(let i = 0; i < K.N; i++){
    const f0 = i/K.N, pose = {};
    const bob = K.sink - K.bob*Math.cos(4*Math.PI*(f0 - K.ds/2));      // positive = body low
    pose[ID.body] = {r:0, dx:0, dy:rd(bob)};
    for(const L of legs) pose[L.thigh] = {r:0, dx:0, dy:rd(bob)};      // the hips ride with the body
    pose[ID.tail] = {r:rd(K.tail*Math.sin(TAU*f0) + 1.5*(bob - K.sink)), dx:0, dy:0};
    pose[ID.tailEnd] = {r:rd(K.tail*.8*Math.sin(TAU*(f0 - .15))), dx:0, dy:0};
    pose[ID.neck] = {r:rd(K.neck*Math.sin(TAU*(f0 + .1)) - 1.5*(bob - K.sink)), dx:0, dy:0};
    pose[ID.head] = {r:rd(1.5*(bob - K.sink)), dx:0, dy:0};
    for(const L of legs){
      const fl = (f0 + L.off) % 1; let ax, ay, tilt = 0;
      if(fl < K.ds){ const t = fl/K.ds; ax = L.ax + K.S/2 - K.S*t; ay = L.ay; }
      else { const t = (fl - K.ds)/(1 - K.ds); ax = L.ax - K.S/2 + K.S*sm(t); ay = L.ay - K.lift*Math.sin(Math.PI*t); tilt = 12*Math.sin(Math.PI*t); }
      ik(pose, L, ax, ay, tilt);
      pose[L.arm] = {r:rd(K.arm*L.sgn*Math.cos(TAU*f0)), dx:0, dy:0};
    }
    walk.push(pose);
  }
  // ---- rest: the hips sink over planted ankles until it lies on its belly, then the neck droops, the head levels and the tail settles ----
  const rest = [];
  for(let i = 0; i < K.restN; i++){
    const u = i/(K.restN - 1), down = sm(Math.min(1, u/.7)), after = sm(Math.max(0, (u - .45)/.55)), pose = {};
    const dy = K.lie*down;
    pose[ID.body] = {r:rd(2*Math.sin(Math.PI*down)), dx:0, dy:rd(dy)};
    for(const L of legs) pose[L.thigh] = {r:0, dx:0, dy:rd(dy)};
    pose[ID.neck] = {r:rd(K.restNeck*after), dx:0, dy:0};
    pose[ID.head] = {r:rd(K.restHead*after), dx:0, dy:0};
    pose[ID.tail] = {r:rd(K.restTail*down), dx:0, dy:0};
    pose[ID.tailEnd] = {r:rd(K.restTailEnd*after), dx:0, dy:0};
    for(const L of legs){ ik(pose, L, L.ax + 1.5*down, L.ay, 0); pose[L.arm] = {r:rd(K.restArm*down), dx:0, dy:0}; }
    rest.push(pose);
  }
  const idle = P.clips.find(c => c.name === 'idle'), idle2 = P.clips.find(c => c.name === 'rest');
  P.clips = [{name:'walk', fps:K.fps, frames:walk}, {name:'idle', fps:idle.fps, frames:idle.frames}, {name:'idle2', fps:idle2.fps, frames:idle2.frames}, {name:'rest', fps:8, frames:rest}];
  ci = 0; cur = 0; sel = null; save(true);
  const sheet = (fr) => {
    const Z = 5, cols = 4, rows = Math.ceil(fr.length/cols), c = document.createElement('canvas'); c.width = 100*Z*cols; c.height = 75*Z*rows;
    const x = c.getContext('2d'); x.fillStyle = '#23272e'; x.fillRect(0, 0, c.width, c.height); x.imageSmoothingEnabled = false;
    fr.forEach((f, i) => { x.save(); x.translate((i%cols)*100*Z, Math.floor(i/cols)*75*Z); x.beginPath(); x.rect(0, 0, 100*Z, 75*Z); x.clip();
      x.strokeStyle = '#3a8'; x.setLineDash([6, 6]); x.beginPath(); x.moveTo(0, 57*Z); x.lineTo(100*Z, 57*Z); x.stroke(); x.setLineDash([]);
      x.scale(Z, Z); drawPose(x, f, 1, true); x.restore();
      x.fillStyle = '#fff'; x.font = '14px sans-serif'; x.fillText('frame ' + i, (i%cols)*100*Z + 6, Math.floor(i/cols)*75*Z + 16); });
    return c.toDataURL('image/png');
  };
  const sc = document.createElement('canvas'); sc.width = 100; sc.height = 75; drawPose(sc.getContext('2d'), {}, 1, true);
  return {walk:sheet(walk), rest:sheet(rest), stand:sc.toDataURL('image/png'), strip:stripCanvas(P.clips[0]).toDataURL('image/png'), proj:JSON.stringify(pruned())};
 }, [proj, K]);
 const w = (f, d) => fs.writeFileSync(f, Buffer.from(d.split(',')[1], 'base64'));
 w(path.join(OUT, 'walk-sheet.png'), out.walk); w(path.join(OUT, 'rest-sheet.png'), out.rest);
 w(path.join(ROOT, 'sprites', 'coel.png'), out.stand); w(path.join(ROOT, 'sprites', 'coel-walk.png'), out.strip);
 fs.writeFileSync(path.join(OUT, 'coelophysis-clips.json'), out.proj);
 console.log('errors', errs); await b.close();
})();
