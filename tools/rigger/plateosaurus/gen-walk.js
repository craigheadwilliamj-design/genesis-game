const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const PARAMS = Object.assign({N:6, ds:2/3, S:11, af:2, lift:5, B:0.9, fps:8}, JSON.parse(process.argv[2] || '{}'));
(async()=>{
 const proj = JSON.parse(fs.readFileSync('walk/in.json','utf8'));
 const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
 const p = await b.newPage({viewport:{width:1300,height:800}}); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file:///home/user/genesis-game/tools/rigger/index.html');
 const out = await p.evaluate(async ([proj, K])=>{
  await openProject(proj);
  const by = id => P.nodes.find(n => n.id === id);
  // thighs follow the body
  setParent(by('n14'), 'n2'); setParent(by('n22'), 'n2');
  const D = 180/Math.PI, R = Math.PI/180, {N, ds, S, af, lift, B} = K;
  const legs = [{thigh:'n14', shin:'n16', foot:'n18', arm:'n12', off:0, sgn:1}, {thigh:'n22', shin:'n24', foot:'n26', arm:'n20', off:.5, sgn:-1}];
  const frames = [], dbg = [];
  for(let i = 0; i < N; i++){
    const f0 = (i + .5)/N, pose = {};
    const bob = -B*Math.cos(4*Math.PI*(f0 - ds/2));      // positive = body low
    pose.n2 = {r:0, dx:0, dy:+bob.toFixed(2)};
    pose.n10 = {r:+(2.2*bob/B).toFixed(1), dx:0, dy:0};   // tail tip lifts as the body drops
    pose.n6 = {r:+(-1.5*bob/B).toFixed(1), dx:0, dy:0};   // neck eases up, head stays level
    pose.n4 = {r:+(1.5*bob/B).toFixed(1), dx:0, dy:0};
    const W = worlds(pose), Mb = W.n2;
    for(const L of legs){
      const fl = (f0 + L.off) % 1; let ax, ay, fa = 0;
      if(fl < ds){ const t = fl/ds; ax = 60 + af - S*t; ay = 66; }
      else { const t = (fl - ds)/(1 - ds); ax = 60 + af - S + S*t; ay = 66 - lift*Math.sin(Math.PI*t); }
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
      const r1 = (best - th1rest)*D, tot2 = (th2 - th2rest)*D, r2 = tot2 - r1, r3 = fa - tot2;
      const rd = x => +x.toFixed(1);
      pose[L.thigh] = {r:rd(r1), dx:0, dy:0}; pose[L.shin] = {r:rd(r2), dx:0, dy:0}; pose[L.foot] = {r:rd(r3), dx:0, dy:0};
      pose[L.arm] = {r:rd(5*L.sgn*Math.cos(2*Math.PI*f0)), dx:0, dy:0};
      dbg.push({i, leg:L.thigh, fl:+fl.toFixed(2), ankle:[+ax.toFixed(1), +ay.toFixed(1)], r:[rd(r1), rd(r2), rd(r3)], reach:+d.toFixed(1)});
    }
    pose.n8 = {r:0, dx:0, dy:0};
    frames.push(pose);
  }
  P.clips[0].frames = frames; P.clips[0].fps = K.fps; ci = 0; cur = 0; sel = null;
  save(true);
  // contact sheet: 3 columns, 5x, ground line
  const Z = 5, cols = 3, rows = Math.ceil(N/cols), c = document.createElement('canvas'); c.width = 100*Z*cols; c.height = 75*Z*rows;
  const x = c.getContext('2d'); x.fillStyle = '#23272e'; x.fillRect(0, 0, c.width, c.height); x.imageSmoothingEnabled = false;
  frames.forEach((f, i) => { x.save(); x.translate((i%cols)*100*Z, Math.floor(i/cols)*75*Z); x.beginPath(); x.rect(0,0,100*Z,75*Z); x.clip(); x.strokeStyle = '#3a8'; x.setLineDash([6,6]); x.beginPath(); x.moveTo(0, 67.5*Z); x.lineTo(100*Z, 67.5*Z); x.stroke(); x.setLineDash([]); x.scale(Z, Z); drawPose(x, f, 1, true); x.restore();
    x.fillStyle = '#fff'; x.font = '14px sans-serif'; x.fillText('frame ' + (i+1), (i%cols)*100*Z + 6, Math.floor(i/cols)*75*Z + 16); });
  return {sheet:c.toDataURL('image/png'), strip:stripCanvas(clip()).toDataURL('image/png'), proj:JSON.stringify(pruned()), dbg};
 }, [proj, PARAMS]);
 fs.writeFileSync('walk/sheet.png', Buffer.from(out.sheet.split(',')[1], 'base64'));
 fs.writeFileSync('walk/plat-walk.png', Buffer.from(out.strip.split(',')[1], 'base64'));
 fs.writeFileSync('walk/Plateosaurus_Walk-rig-v2.json', out.proj);
 console.log(out.dbg.map(d=>JSON.stringify(d)).join('\n')); console.log('errors', errs);
 await b.close();
})();
