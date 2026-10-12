// Builds the Tiktaalik walk, idle, rest and swim clips from the rig in tiktaalik-rig.json (parts and joints by hand in the rigger).
//   node tools/rigger/tiktaalik/gen-clips.js [OUT_DIR] ['{"S":4,"lift":1}']
// Writes OUT_DIR/tiktaalik.json (the rig with its clips; OUT_DIR defaults to this folder), <clip>-sheet.png and <clip>.gif for each clip.
// Then: python3 tools/rigtogame.py tools/rigger/tiktaalik/tiktaalik.json tikt --walk walk --idle idle --rest rest --swim swim --waterline 37
// It is a belly-dragging fish with stubby limbs hanging back from the shoulder: a limb turns clockwise to sweep back, so a stance foot
// slides back under the body (r grows) and swings forward again lifted. Diagonal gait (near fore with far fore half a cycle behind, near hind with the far fore).
// The far forelimb is a root in the hand-made rig, so it is hung on the thorax here. No far hind limb in the picture.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs'), path = require('path');
const here = __dirname, OUT = path.resolve(process.argv[2] || here);
const K = Object.assign({N:8, S:4, ds:.65, lift:1, bob:.3, wag:2.2, tail:7, head:1.6, fps:8, swimTail:10, swimDy:1.5, lie:1, ground:43}, JSON.parse(process.argv[3] || '{}'));
fs.mkdirSync(OUT, {recursive:true});
(async()=>{
 const proj = JSON.parse(fs.readFileSync(path.join(here, 'tiktaalik-rig.json'), 'utf8'));
 const far = proj.nodes.find(n => n.id === 'n98'); far.parent = 'n92'; far.lx = 9; far.ly = 2;   // hang it on the thorax (it was at the world's 77,36, thorax at 68,34)
 const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox']});
 const p = await b.newPage({viewport:{width:1300, height:800}}); const errs = [];
 p.on('pageerror', e => errs.push(e.message));
 await p.goto('file:///home/user/genesis-game/tools/rigger/index.html');
 const out = await p.evaluate(async ([proj, K]) => {
  await openProject(proj);
  const R = Math.PI/180, TAU = 2*Math.PI, rd = x => +x.toFixed(2);
  const ID = {abd:'n94', thorax:'n92', jaw:'n90', head:'n88', tail:'n100',
    // [limb, phase in the cycle]
    legs:[['n96', 0], ['n98', .5], ['n102', .5]]};
  const sm = t => (1 - Math.cos(Math.PI*t))/2;
  const V = [-7, 4];   // the limbs' foot from their shoulder joint at rest
  const L = Math.hypot(V[0], V[1]);
  // limb pose for a foot offset ox along the ground (positive is back): the angle that puts the foot there, dropping the limb to keep it on the ground
  const swing = (ox, lift) => {
    // rotate (clockwise positive) so the foot's x is V[0] - ox; solve x' = x cos t - y sin t
    const tx = V[0] - ox, t0 = Math.atan2(V[1], V[0]);
    let t = Math.acos(Math.max(-1, Math.min(1, tx/L))); const cand = [t - t0, -t - t0].map(a => a); // angle of the new vector minus the old one
    let r = cand.reduce((m, a) => Math.abs(a) < Math.abs(m) ? a : m, 9);
    const y = V[0]*Math.sin(r) + V[1]*Math.cos(r);
    return {r:rd(r/R), dx:0, dy:rd(V[1] - y - lift)};
  };
  const walk = [];
  for(let i = 0; i < K.N; i++){
    const f = i/K.N, pose = {};
    pose[ID.thorax] = {r:rd(K.wag*.5*Math.sin(TAU*f)), dx:0, dy:rd(K.bob*Math.sin(TAU*2*f))};
    pose[ID.abd] = {r:rd(-K.wag*Math.sin(TAU*(f + .1))), dx:0, dy:0};
    pose[ID.tail] = {r:rd(K.tail*Math.sin(TAU*(f + .3))), dx:0, dy:0};
    pose[ID.head] = {r:rd(K.head*Math.sin(TAU*(f + .6))), dx:0, dy:0};
    for(const [lg, off] of ID.legs){
      const fl = (f + off) % 1; let ox, lift = 0;
      if(fl < K.ds) ox = K.S/2 - K.S*(fl/K.ds);
      else { const t = (fl - K.ds)/(1 - K.ds); ox = -K.S/2 + K.S*sm(t); lift = K.lift*Math.sin(Math.PI*t); }
      pose[lg] = swing(ox, lift);
    }
    walk.push(pose);
  }
  // idle: jaw gapes, head lifts, snaps shut, tail flicks
  const gape = [0, 0, 6, 14, 20, 20, 16, 5, -1, 0, 0, 0], lifth = [0, -1, -3, -5, -5, -5, -3, -1, 1, 0, 0, 0], flick = [0, 0, 0, 0, 2, 5, 8, 6, 2, 0, 0, 0];
  const idle = gape.map((g, i) => ({[ID.jaw]:{r:g, dx:0, dy:0}, [ID.head]:{r:lifth[i], dx:0, dy:0}, [ID.tail]:{r:flick[i], dx:0, dy:0}}));
  idle[0] = {};
  // rest: it flattens onto its belly, limbs swept back along the flanks, head down, tail eased
  const rest = [];
  for(let i = 0; i < 10; i++){
    const e = sm(i/9), pose = {};
    pose[ID.thorax] = {r:0, dx:0, dy:rd(K.lie*e)};
    pose[ID.tail] = {r:rd(-4*e), dx:0, dy:0};
    pose[ID.head] = {r:rd(2*e), dx:0, dy:0};
    for(const [lg] of ID.legs) pose[lg] = {r:rd(38*e), dx:0, dy:rd(-1*e)};
    rest.push(pose);
  }
  // swim: low in the water, limbs tucked back, body and tail wave
  const swim = [];
  for(let i = 0; i < K.N; i++){
    const f = i/K.N, pose = {};
    pose[ID.thorax] = {r:rd(1*Math.sin(TAU*f)), dx:0, dy:rd(K.swimDy + .3*Math.sin(TAU*2*f))};
    pose[ID.abd] = {r:rd(2.5*Math.sin(TAU*(f - .15))), dx:0, dy:0};
    pose[ID.tail] = {r:rd(K.swimTail*Math.sin(TAU*(f - .3))), dx:0, dy:0};
    pose[ID.head] = {r:rd(-1.5 + Math.sin(TAU*(f + .3))), dx:0, dy:0};
    for(const [lg, off] of ID.legs) pose[lg] = {r:rd(48 + 8*Math.sin(TAU*(f + off))), dx:0, dy:0};
    swim.push(pose);
  }
  P.clips = [{name:'walk', fps:K.fps, frames:walk}, {name:'idle', fps:K.fps, frames:idle}, {name:'rest', fps:K.fps, frames:rest}, {name:'swim', fps:6, frames:swim}];
  P.ground = K.ground; ci = 0; cur = 0; sel = null; save(true);
  const res = {proj:JSON.stringify(pruned()), clips:{}};
  const W = P.cell.w, H = P.cell.h;
  for(const cl of P.clips){
    const n = cl.frames.length, cols = Math.min(n, 4), rows = Math.ceil(n/cols), zw = 50, zh = 24, Z = 8, zx = 28, zy = 24;
    const c = document.createElement('canvas'); c.width = zw*Z*cols; c.height = zh*Z*rows; const x = c.getContext('2d'); x.fillStyle = '#23272e'; x.fillRect(0, 0, c.width, c.height); x.imageSmoothingEnabled = false;
    cl.frames.forEach((f, i) => { x.save(); x.translate((i%cols)*zw*Z, Math.floor(i/cols)*zh*Z); x.beginPath(); x.rect(0, 0, zw*Z, zh*Z); x.clip();
      x.strokeStyle = '#3a8'; x.beginPath(); x.moveTo(0, (P.ground - zy)*Z); x.lineTo(zw*Z, (P.ground - zy)*Z); x.stroke();
      x.save(); x.scale(Z, Z); x.translate(-zx, -zy); drawPose(x, f, 1, true); x.restore();
      x.fillStyle = '#fff'; x.font = '12px sans-serif'; x.fillText(cl.name + ' ' + (i + 1), 6, 14); x.restore(); });
    const g = makeGif(cl, 6, false, [...Array(n).keys()]).bytes, s = []; for(let i = 0; i < g.length; i += 8192) s.push(String.fromCharCode.apply(null, g.subarray(i, i + 8192)));
    res.clips[cl.name] = {sheet:c.toDataURL('image/png'), gif:btoa(s.join(''))};
  }
  return res;
 }, [proj, K]);
 fs.writeFileSync(path.join(OUT, 'tiktaalik.json'), out.proj);
 for(const [n, c] of Object.entries(out.clips)){
  fs.writeFileSync(path.join(OUT, n + '-sheet.png'), Buffer.from(c.sheet.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(OUT, n + '.gif'), Buffer.from(c.gif, 'base64'));
 }
 console.log('written to', OUT, 'errors', errs);
 await b.close();
})();
