// Builds the Prionosuchus walk, idle and rest clips from the rig in prionosuchus-rig.json (parts and joints by hand in the rigger).
//   node tools/rigger/prionosuchus/gen-clips.js [OUT_DIR] ['{"S":4.4,"lift":1.2}']
// Writes OUT_DIR/prionosuchus.json (the rig with its clips; OUT_DIR defaults to this folder), <clip>-sheet.png and <clip>.gif for each clip.
// The legs are one short piece each (a thigh part with a foot dash under it), so there is no IK: the leg swings about its hip, drops a
// little to keep the stance foot on the ground, and lifts in the swing. Lateral-sequence walk: near hind, near front, far hind, far front, a quarter cycle apart.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs'), path = require('path');
const here = __dirname, OUT = path.resolve(process.argv[2] || here);
const K = Object.assign({N:8, S:4.4, ds:.7, lift:1.2, bob:.45, tail:4.5, head:1.4, fps:8, splootF:80, splootDy:0, tuckH:58, tuckDy:-2, lie:4}, JSON.parse(process.argv[3] || '{}'));
fs.mkdirSync(OUT, {recursive:true});
(async()=>{
 const proj = JSON.parse(fs.readFileSync(path.join(here, 'prionosuchus-rig.json'), 'utf8'));
 const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox']});
 const p = await b.newPage({viewport:{width:1300, height:800}}); const errs = [];
 p.on('pageerror', e => errs.push(e.message));
 await p.goto('file:///home/user/genesis-game/tools/rigger/index.html');
 const out = await p.evaluate(async ([proj, K]) => {
  await openProject(proj);
  P.nodes.forEach(n => { n.name = n.name.replace(/\.png$/i, ''); });   // the parts are named after their files, so the game's picture names don't end in -png.png
  const R = Math.PI/180, TAU = 2*Math.PI, rd = x => +x.toFixed(2), by = id => P.nodes.find(n => n.id === id);
  const ID = {body:'n28', head:'n30', jaw:'n32', tail:'n34',
    // [leg, foot, phase in the cycle]
    legs:[['n38','n40',0], ['n36','n42',.25], ['n44','n48',.5], ['n46','n50',.75]]};
  const sm = t => (1 - Math.cos(Math.PI*t))/2;
  // ---- walk ----
  const walk = [];
  for(let i = 0; i < K.N; i++){
    const f = i/K.N, pose = {};
    pose[ID.body] = {r:0, dx:0, dy:rd(K.bob*Math.sin(TAU*2*f))};
    pose[ID.tail] = {r:rd(K.tail*Math.sin(TAU*(f + .1))), dx:0, dy:0};
    pose[ID.head] = {r:rd(K.head*Math.sin(TAU*(f + .35))), dx:0, dy:0};
    for(const [lg, ft, off] of ID.legs){
      const L = by(ft).ly, fl = (f + off) % 1; let ox, lift = 0;
      if(fl < K.ds) ox = K.S/2 - K.S*(fl/K.ds);                       // stance: the foot slides back under the body
      else { const t = (fl - K.ds)/(1 - K.ds); ox = -K.S/2 + K.S*sm(t); lift = K.lift*Math.sin(Math.PI*t); }
      const r = -Math.asin(Math.max(-1, Math.min(1, ox/L)))/R;
      pose[lg] = {r:rd(r), dx:0, dy:rd(L*(1 - Math.cos(r*R)) - lift)};
      pose[ft] = {r:rd(-r), dx:0, dy:0};                                 // the foot stays flat
    }
    walk.push(pose);
  }
  // ---- idle: head lifts, jaw gapes wide, snaps shut, tail flicks ----
  const gape = [0, 0, 5, 12, 18, 18, 14, 4, -1, 0, 0, 0], lifth = [0, -1, -3, -4, -4, -4, -3, -1, 1, 0, 0, 0], flick = [0, 0, 0, 0, 1, 3, 6, 5, 2, 0, 0, 0];
  const idle = gape.map((g, i) => ({[ID.jaw]:{r:g, dx:0, dy:0}, [ID.head]:{r:lifth[i], dx:0, dy:0}, [ID.tail]:{r:flick[i], dx:0, dy:0}}));
  idle[0] = {};
  // ---- rest: it lowers onto its belly, hind legs tucked back and front legs stretched forward (a sploot), tail up off the ground, jaw closed, belly on the ground (ground row 45) ----
  const rest = [];
  for(let i = 0; i < 10; i++){
    const e = sm(i/9), pose = {};
    pose[ID.body] = {r:0, dx:0, dy:rd(K.lie*e)};
    pose[ID.tail] = {r:rd(11*e), dx:0, dy:0};
    pose[ID.head] = {r:rd(1*e), dx:0, dy:0};
    pose[ID.jaw] = {r:0, dx:0, dy:0};
    for(const [lg, ft] of ID.legs){
      const front = lg === 'n36' || lg === 'n46';   // front legs stretch forward along the ground (a sploot), hind legs tuck back
      const a = front ? -K.splootF : K.tuckH;
      pose[lg] = {r:rd(a*e), dx:0, dy:rd((front ? K.splootDy : K.tuckDy)*e)}; pose[ft] = {r:rd(-a*e), dx:0, dy:0};
    }
    rest.push(pose);
  }
  P.clips = [{name:'walk', fps:K.fps, frames:walk}, {name:'idle', fps:K.fps, frames:idle}, {name:'rest', fps:K.fps, frames:rest}];
  P.ground = 46; ci = 0; cur = 0; sel = null; save(true);
  const res = {proj:JSON.stringify(pruned()), clips:{}};
  const W = P.cell.w, H = P.cell.h;
  for(const cl of P.clips){
    const n = cl.frames.length, Z = 4, cols = Math.min(n, 4), rows = Math.ceil(n/cols), c = document.createElement('canvas');
    c.width = W*Z*cols; c.height = H*Z*rows; const x = c.getContext('2d'); x.fillStyle = '#23272e'; x.fillRect(0, 0, c.width, c.height); x.imageSmoothingEnabled = false;
    cl.frames.forEach((f, i) => { x.save(); x.translate((i%cols)*W*Z, Math.floor(i/cols)*H*Z); x.beginPath(); x.rect(0, 0, W*Z, H*Z); x.clip();
      x.strokeStyle = '#3a8'; x.setLineDash([5, 5]); x.beginPath(); x.moveTo(0, (P.ground + .5)*Z); x.lineTo(W*Z, (P.ground + .5)*Z); x.stroke(); x.setLineDash([]);
      x.save(); x.translate(0, -18*Z); x.scale(Z, Z); drawPose(x, f, 1, true); x.restore();
      x.fillStyle = '#fff'; x.font = '12px sans-serif'; x.fillText(cl.name + ' ' + (i + 1), 6, 14); x.restore(); });
    const g = makeGif(cl, 6, false, [...Array(n).keys()]).bytes, s = []; for(let i = 0; i < g.length; i += 8192) s.push(String.fromCharCode.apply(null, g.subarray(i, i + 8192)));
    const zc = document.createElement('canvas'), zz = 12, zx = 30, zy = 28, zw = 66, zh = 22, zcols = 2, zrows = Math.ceil(n/zcols);
    zc.width = zw*zz*zcols; zc.height = zh*zz*zrows; const z = zc.getContext('2d'); z.fillStyle = '#23272e'; z.fillRect(0, 0, zc.width, zc.height); z.imageSmoothingEnabled = false;
    cl.frames.forEach((f, i) => { z.save(); z.translate((i%zcols)*zw*zz, Math.floor(i/zcols)*zh*zz); z.beginPath(); z.rect(0, 0, zw*zz, zh*zz); z.clip();
      z.strokeStyle = '#3a8'; z.beginPath(); z.moveTo(0, (P.ground - zy)*zz); z.lineTo(zw*zz, (P.ground - zy)*zz); z.stroke();
      z.save(); z.scale(zz, zz); z.translate(-zx, -zy); drawPose(z, f, 1, true); z.restore(); z.fillStyle = '#fff'; z.font = '12px sans-serif'; z.fillText(cl.name + ' ' + (i + 1), 6, 14); z.restore(); });
    res.clips[cl.name] = {zoom:zc.toDataURL('image/png'), sheet:c.toDataURL('image/png'), gif:btoa(s.join(''))};
  }
  return res;
 }, [proj, K]);
 fs.writeFileSync(path.join(OUT, 'prionosuchus.json'), out.proj);
 for(const [n, c] of Object.entries(out.clips)){
  fs.writeFileSync(path.join(OUT, n + '-sheet.png'), Buffer.from(c.sheet.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(OUT, n + '-zoom.png'), Buffer.from(c.zoom.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(OUT, n + '.gif'), Buffer.from(c.gif, 'base64'));
 }
 console.log('written to', OUT, 'errors', errs);
 await b.close();
})();
