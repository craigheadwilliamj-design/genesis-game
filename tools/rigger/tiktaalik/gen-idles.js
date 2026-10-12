// Builds the Tiktaalik's vivarium pictures from the rig in tiktaalik-rig.json (parts and joints by hand in the rigger).
//   node tools/rigger/tiktaalik/gen-idles.js [OUT_DIR]
// Writes OUT_DIR/tiktaalik.json (the rig with its clip), sprites/tikt.png (the rest pose) and sprites/tikt-idle.png (all the idle frames side by side),
// plus idle-sheet.png and idle.gif to look at. Vivarium animals don't walk, so there is no walk, rest or swim clip. The strip is
//   frames 0-3: the basic idle, a slow loop (a nose lift, a tail twitch),
//   frames 4-11: "look around", the head rises like a periscope, the jaw opens a crack, then it settles,
//   frames 12-19: "push-up", the forelimbs press down and lift the front twice, then it lowers.
// map.js plays the basic loop and, now and then, one of the other two once (SPRITES.tikt: base, dyn, dynMs, dynGap).
// The far forelimb is a root in the hand-made rig, so it is hung on the thorax here. Frames are placed so the animal fills the same box as before (x 2 to 97, belly on row 43).
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs'), path = require('path');
const here = __dirname, OUT = path.resolve(process.argv[2] || here), SPR = path.join(here, '..', '..', '..', 'sprites');
fs.mkdirSync(OUT, {recursive:true});
(async()=>{
 const proj = JSON.parse(fs.readFileSync(path.join(here, 'tiktaalik-rig.json'), 'utf8'));
 const far = proj.nodes.find(n => n.id === 'n98'); far.parent = 'n92'; far.lx = 9; far.ly = 2;   // on the thorax (it was at the world's 77,36, the thorax at 68,34)
 const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox']});
 const p = await b.newPage({viewport:{width:1300, height:800}}); const errs = [];
 p.on('pageerror', e => errs.push(e.message));
 await p.goto('file:///home/user/genesis-game/tools/rigger/index.html');
 const out = await p.evaluate(async proj => {
  await openProject(proj);
  const T = {abd:'n94', thorax:'n92', jaw:'n90', head:'n88', tail:'n100', fore:['n96', 'n98'], hind:'n102'};
  const o = (id, r, dx = 0, dy = 0) => ({[id]:{r, dx, dy}});
  const mk = (...ps) => Object.assign({}, ...ps);
  const base = [{}, mk(o(T.head, -2, 0, -1)), {}, mk(o(T.tail, 3), o(T.head, 1))];
  const hr = [-3, -7, -11, -12, -12, -8, -3, 0], jw = [0, 0, 0, 5, 7, 0, 0, 0], th = [0, -1, -2, -2, -2, -1, 0, 0];
  const look = hr.map((h, i) => mk(o(T.head, h), o(T.jaw, jw[i]), o(T.thorax, th[i]), o(T.tail, i > 3 ? 1.5*(i - 3)*(i < 7 ? 1 : 0) : 0)));
  look[7] = {};
  // push-up: the forelimbs swing down (r negative) and the front lifts, rear stays low
  const pl = [-25, -50, -25, -50, -50, -30, -10, 0], pt = [-.5, -1.5, -.5, -1.5, -1.5, -.5, 0, 0], ph = [0, -2, 0, -2, -3, -1, 0, 0], pj = [0, 0, 0, 0, 6, 0, 0, 0];
  const push = pl.map((l, i) => mk(...T.fore.map(f => o(f, l)), o(T.hind, l*.4), o(T.thorax, 0, 0, pt[i]), o(T.abd, 0, 0, -pt[i]*.7), o(T.head, ph[i]), o(T.jaw, pj[i])));
  push[7] = {};
  const frames = [...base, ...look, ...push];
  // place: measure the rest pose's box and move it onto x 2, bottom row 44 (the old picture's box)
  const W = P.cell.w, H = P.cell.h, draw = (f, ox, oy) => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.translate(ox, oy); drawPose(x, f, 1, true); return c; };
  const bb = c => { const d = c.getContext('2d').getImageData(0, 0, W, H).data; let x0 = W, y1 = 0; for(let y = 0; y < H; y++) for(let x = 0; x < W; x++) if(d[(y*W + x)*4 + 3] > 127){ if(x < x0) x0 = x; if(y > y1) y1 = y; } return [x0, y1]; };
  const [bx, by] = bb(draw({}, 0, 0)), ox = 2 - bx, oy = 43 - by;
  const strip = document.createElement('canvas'); strip.width = W*frames.length; strip.height = H; const sx = strip.getContext('2d');
  frames.forEach((f, i) => sx.drawImage(draw(f, ox, oy), i*W, 0));
  P.clips = [{name:'idle', fps:6, frames}]; P.ground = 43; ci = 0; cur = 0; sel = null; save(true);
  const Z = 6, cols = 4, rows = Math.ceil(frames.length/cols), sh = document.createElement('canvas'); sh.width = 70*Z*cols; sh.height = 24*Z*rows;
  const s = sh.getContext('2d'); s.fillStyle = '#23272e'; s.fillRect(0, 0, sh.width, sh.height); s.imageSmoothingEnabled = false; s.font = '12px sans-serif';
  frames.forEach((f, i) => { s.save(); s.translate((i%cols)*70*Z, Math.floor(i/cols)*24*Z); s.beginPath(); s.rect(0, 0, 70*Z, 24*Z); s.clip(); s.drawImage(strip, i*W + 15, 24, 70, 24, 0, 0, 70*Z, 24*Z); s.fillStyle = '#fff'; s.fillText('idle ' + i, 6, 14); s.restore(); });
  const cl = {name:'idle', fps:6, frames}, g = makeGif(cl, 6, false, [...Array(frames.length).keys()]).bytes, gs = []; for(let i = 0; i < g.length; i += 8192) gs.push(String.fromCharCode.apply(null, g.subarray(i, i + 8192)));
  return {proj:JSON.stringify(pruned()), strip:strip.toDataURL('image/png'), stand:draw({}, ox, oy).toDataURL('image/png'), sheet:sh.toDataURL('image/png'), gif:btoa(gs.join('')), n:frames.length};
 }, proj);
 const w = (f, d) => fs.writeFileSync(f, Buffer.from(d.split(',')[1] || d, 'base64'));
 fs.writeFileSync(path.join(OUT, 'tiktaalik.json'), out.proj);
 w(path.join(SPR, 'tikt-idle.png'), out.strip); w(path.join(SPR, 'tikt.png'), out.stand);
 w(path.join(OUT, 'idle-sheet.png'), out.sheet); fs.writeFileSync(path.join(OUT, 'idle.gif'), Buffer.from(out.gif, 'base64'));
 console.log('frames', out.n, 'errors', errs); await b.close();
})();
