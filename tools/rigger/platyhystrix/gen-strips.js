// Builds the Platyhystrix's vivarium pictures from platyhystrix-rig.json (parts, joints and clips made by hand in the rigger).
//   node tools/rigger/platyhystrix/gen-strips.js
// Writes sprites/plhy.png (the rest pose) and sprites/plhy-idle.png (frames side by side), plus idle-sheet.png and idle.gif to look at.
// Vivarium animals don't walk, so there is no walk clip. The strip is
//   frames 0-6: the basic loop, the first 7 frames of the "idle" clip (breathing),
//   frames 7-12: the rest of "idle" (the head dips and the jaw gapes, then it closes),
//   frames 13-31: "dynamic idle" (it shifts its legs, settles and looks round).
// map.js plays the basic loop and now and then one of the other two once (SPRITES.plhy: base, dyn, dynMs, dynGap).
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs'), path = require('path');
const here = __dirname, SPR = path.join(here, '..', '..', '..', 'sprites');
(async()=>{
 const proj = JSON.parse(fs.readFileSync(path.join(here, 'platyhystrix-rig.json'), 'utf8'));
 const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox']});
 const p = await b.newPage({viewport:{width:1300, height:800}}); const errs = [];
 p.on('pageerror', e => errs.push(e.message));
 await p.goto('file:///home/user/genesis-game/tools/rigger/index.html');
 const out = await p.evaluate(async proj => {
  await openProject(proj);
  const idle = P.clips.find(c => c.name === 'idle').frames, dyn = P.clips.find(c => c.name === 'dynamic idle').frames;
  const frames = [...idle, ...dyn], W = P.cell.w, H = P.cell.h;
  const draw = f => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; drawPose(x, f, 1, true); return c; };
  const strip = document.createElement('canvas'); strip.width = W*frames.length; strip.height = H; const sx = strip.getContext('2d');
  frames.forEach((f, i) => sx.drawImage(draw(f), i*W, 0));
  const Z = 5, cols = 4, rows = Math.ceil(frames.length/cols), sh = document.createElement('canvas'); sh.width = W*Z*cols; sh.height = H*Z*rows;
  const s = sh.getContext('2d'); s.fillStyle = '#23272e'; s.fillRect(0, 0, sh.width, sh.height); s.imageSmoothingEnabled = false;
  frames.forEach((f, i) => s.drawImage(strip, i*W, 0, W, H, (i%cols)*W*Z, Math.floor(i/cols)*H*Z, W*Z, H*Z));
  const g = makeGif({name:'idle', fps:8, frames}, 4, false, [...Array(frames.length).keys()]).bytes, gs = []; for(let i = 0; i < g.length; i += 8192) gs.push(String.fromCharCode.apply(null, g.subarray(i, i + 8192)));
  return {strip:strip.toDataURL('image/png'), stand:draw({}).toDataURL('image/png'), sheet:sh.toDataURL('image/png'), gif:btoa(gs.join('')), n:frames.length, ni:idle.length, nd:dyn.length};
 }, proj);
 const w = (f, d) => fs.writeFileSync(f, Buffer.from(d.split(',')[1] || d, 'base64'));
 w(path.join(SPR, 'plhy-idle.png'), out.strip); w(path.join(SPR, 'plhy.png'), out.stand);
 w(path.join(here, 'idle-sheet.png'), out.sheet); fs.writeFileSync(path.join(here, 'idle.gif'), Buffer.from(out.gif, 'base64'));
 console.log('frames', out.n, 'idle', out.ni, 'dyn', out.nd, 'errors', errs); await b.close();
})();
