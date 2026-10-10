// Rebuilds the Dimetrodon's walk clip and adds a rest clip, from the rig in dimetrodon-rig.json (parts and joints by hand in the rigger); the idle clip is kept as it was.
//   node tools/rigger/dimetrodon/gen-walk.js [OUT_DIR] ['{"S":7,"lift":2}']
// Writes OUT_DIR/dimetrodon.json (the rig with the new walk, its parts shaded by tools/pixeldime_rig_shade.py: the rig itself is flat), walk-sheet.png, walk.gif, rest-sheet.png and rest.gif (OUT_DIR defaults to this folder).
// Each leg is one short piece (hip joint, with a foot child), so the leg is aimed at where its ankle should be (no knee): stance ankles stay planted
// and slide back under the body at one speed, swing ankles lift and reach forward. Diagonal-couplet walk: near front with far back, far front with near back, half a cycle apart.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const here = __dirname, OUT = path.resolve(process.argv[2] || here);
const K = Object.assign({RN:10, drop:4.5, tuck:{n62:-50, n68:-50, n80:125, n76:60}, N:8, S:7, ds:.7, lift:2, bob:.6, tail:3.5, head:1.5, hind:.08, fps:8}, JSON.parse(process.argv[3] || '{}'));
fs.mkdirSync(OUT, {recursive:true});
(async()=>{
 const proj = JSON.parse(fs.readFileSync(path.join(here, 'dimetrodon-rig.json'), 'utf8'));
 const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox']});
 const p = await b.newPage({viewport:{width:1300, height:800}}); const errs = [];
 p.on('pageerror', e => errs.push(e.message));
 await p.goto('file:///home/user/genesis-game/tools/rigger/index.html');
 const out = await p.evaluate(async ([proj, K]) => {
  await openProject(proj);
  const R = Math.PI/180, D = 180/Math.PI, TAU = 2*Math.PI, rd = x => +x.toFixed(2), by = id => P.nodes.find(n => n.id === id);
  const ID = {body:'n60', head:'n56', jaw:'n58', tail:['n82', 'n84', 'n86']};
  // [leg, foot, phase]: near front and far back step together, far front and near back half a cycle later (the hind pair a touch behind its diagonal)
  const legs = [['n62', 'n64', 0], ['n76', 'n74', K.hind], ['n68', 'n66', .5], ['n80', 'n78', .5 + K.hind]];
  const sm = t => (1 - Math.cos(Math.PI*t))/2;
  const rest = {};   // each foot's rest ankle (the standing picture) is the middle of its stride and its ground
  const W0 = worlds({});
  for(const [lg, ft] of legs){ const a = apply(W0[ft], 0, 0); rest[ft] = a; }
  const walk = [];
  for(let i = 0; i < K.N; i++){
    const f = i/K.N, pose = {};
    const bob = K.bob*Math.cos(TAU*2*(f - .35));                      // twice a cycle, highest as a pair is mid-stance
    pose[ID.body] = {r:0, dx:0, dy:rd(bob)};
    pose[ID.head] = {r:rd(K.head*Math.sin(TAU*2*(f - .35) + 1)), dx:0, dy:0};   // head rides the bob a beat behind
    pose[ID.jaw] = {r:0, dx:0, dy:0};
    ID.tail.forEach((t, k) => { pose[t] = {r:rd(K.tail*(k ? .8 : .5)*Math.sin(TAU*(f - .12*k) + .4)), dx:0, dy:0}; });
    const Wb = worlds({[ID.body]:pose[ID.body]});
    for(const [lg, ft, off] of legs){
      const leg = by(lg), foot = by(ft), fl = (f + off) % 1, a0 = rest[ft];
      let ox, lift = 0, pitch = 0;
      if(fl < K.ds) ox = K.S/2 - K.S*(fl/K.ds);                        // stance: ankle slides back at body speed
      else { const t = (fl - K.ds)/(1 - K.ds); ox = -K.S/2 + K.S*sm(t); lift = K.lift*Math.sin(Math.PI*t); pitch = 10*Math.cos(Math.PI*t); }
      const tx = a0[0] + ox, ty = a0[1] - lift;                        // where the ankle should be in the world
      const [hx, hy] = apply(Wb[ID.body], leg.lx, leg.ly);             // the hip, with the body bob
      const v = [foot.lx, foot.ly], L = Math.hypot(...v), dx = tx - hx, dy = ty - hy;
      const r = Math.atan2(dy, dx) - Math.atan2(v[1], v[0]);           // aim the leg at the ankle; any shortfall is the leg reaching (a pixel or so)
      const reach = Math.hypot(dx, dy) - L, ux = dx/Math.hypot(dx, dy), uy = dy/Math.hypot(dx, dy);
      pose[lg] = {r:rd(r*D), dx:rd(ux*reach), dy:rd(uy*reach - bob*0)};
      pose[ft] = {r:rd(-r*D + pitch), dx:0, dy:0};                     // the foot stays flat in stance, toe down as it lifts, toe up as it lands
    }
    walk.push(pose);
  }
  // rest: it lowers its belly toward the ground, the front legs fold forward and the hind legs back, the tail comes up so its tip doesn't sink with the body, the head drops a little, and the last frame is held
  const lie = [];
  for(let i = 0; i < K.RN; i++){
    const e = sm(i/(K.RN - 1)), pose = {};
    pose[ID.body] = {r:0, dx:0, dy:rd(K.drop*e)};
    pose[ID.head] = {r:rd(-4*e), dx:0, dy:0};
    pose[ID.jaw] = {r:rd(3*e), dx:0, dy:0};
    pose[ID.tail[0]] = {r:rd(3.5*e + 3*e), dx:0, dy:0};   // on top of its rest angle, the lift that carries the tip back to the ground (a degree a pixel dropped, about)
    pose[ID.tail[1]] = {r:rd(-2*e + 2*e), dx:0, dy:0};
    for(const [lg, ft] of legs){
      const t = K.tuck[lg];                                              // the front legs fold forward, the hind legs sweep back, each from its own standing angle
      pose[lg] = {r:rd(t*e), dx:0, dy:0}; pose[ft] = {r:rd(-t*e), dx:0, dy:0};
    }
    lie.push(pose);
  }
  const rc = P.clips.find(c => c.name === 'rest');
  if(rc){ rc.frames = lie; rc.fps = K.fps; } else P.clips.push({name:'rest', fps:K.fps, frames:lie});
  // the walk takes the place of the old one; idle stays
  const wc = P.clips.find(c => c.name === 'walk'); wc.frames = walk; wc.fps = K.fps;
  ci = P.clips.indexOf(wc); cur = 0; sel = null;
  return {proj:JSON.stringify(pruned())};
 }, [proj, K]);
 fs.writeFileSync(path.join(OUT, 'dimetrodon.json'), out.proj);
 execFileSync('python3', [path.join(here, '..', '..', 'pixeldime_rig_shade.py'), path.join(OUT, 'dimetrodon.json')], {stdio:'inherit'});   // the parts get their texture
 const prev = await p.evaluate(async ([proj, K]) => {
  await openProject(proj);
  const res = {};
  for(const name of ['walk', 'rest']){
    const cl = P.clips.find(c => c.name === name), fr = cl.frames, n = fr.length; ci = P.clips.indexOf(cl); cur = 0; sel = null;
    const Z = 4, cols = 4, rows = Math.ceil(n/cols), W = P.cell.w, H = P.cell.h, c = document.createElement('canvas'); c.width = W*Z*cols; c.height = H*Z*rows;
    const x = c.getContext('2d'); x.fillStyle = '#23272e'; x.fillRect(0, 0, c.width, c.height); x.imageSmoothingEnabled = false;
    fr.forEach((f, i) => { x.save(); x.translate((i%cols)*W*Z, Math.floor(i/cols)*H*Z); x.beginPath(); x.rect(0, 0, W*Z, H*Z); x.clip();
      x.strokeStyle = '#3a8'; x.beginPath(); x.moveTo(0, 68*Z); x.lineTo(W*Z, 68*Z); x.stroke(); x.scale(Z, Z); drawPose(x, f, 1, true); x.restore();
      x.fillStyle = '#fff'; x.font = '14px sans-serif'; x.fillText(String(i), (i%cols)*W*Z + 4, Math.floor(i/cols)*H*Z + 14); });
    const g = makeGif(cl, 3, false, [...Array(n).keys()]);
    let bin = ''; g.bytes.forEach(v => bin += String.fromCharCode(v));
    res[name] = {sheet:c.toDataURL('image/png'), gif:btoa(bin)};
  }
  return res;
 }, [JSON.parse(fs.readFileSync(path.join(OUT, 'dimetrodon.json'), 'utf8')), K]);
 for(const name of ['walk', 'rest']){
  fs.writeFileSync(path.join(OUT, name + '-sheet.png'), Buffer.from(prev[name].sheet.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(OUT, name + '.gif'), Buffer.from(prev[name].gif, 'base64'));
 }
 console.log('errors', errs);
 await b.close();
})();
