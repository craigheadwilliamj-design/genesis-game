// Headless smoke test: node tests/smoke.js
// Loads index.html in Chromium, runs the sim for several days, and checks past fixes.
const path = require("path");
let chromium;
try { ({ chromium } = require("playwright")); }
catch { ({ chromium } = require("/opt/node22/lib/node_modules/playwright")); }

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  // Google Fonts can't load in sandboxes; ignore network errors for it
  page.on("console", m => { if(m.type() === "error" && !/ERR_CERT|net::/.test(m.text())) errors.push(m.text()); });
  await page.goto("file://" + path.resolve(__dirname, "../index.html"));
  await page.waitForTimeout(400);

  const checks = await page.evaluate(() => {
    const out = {};
    document.querySelector("#introGo").click(); setSpeed(0);
    const sp = SPECIES.find(s => !s.viv);

    // old saves without staff/safety upgrade without throwing
    const old = JSON.parse(JSON.stringify(state)); delete old.staff; delete old.safety;
    out.oldSaveUpgrade = !!upgradeSave(old).staff.mechanics;

    // walkFrom (heap Dijkstra) matches Bellman-Ford on a random graph
    const nodes = []; for(let i = 0; i < 60; i++) nodes.push({k:i, x:Math.random()*100, y:Math.random()*100, adj:new Map(), svc:new Set()});
    for(let i = 0; i < 200; i++){ const a = nodes[Math.floor(Math.random()*60)], c = nodes[Math.floor(Math.random()*60)]; if(a === c) continue; const d = Math.hypot(a.x-c.x, a.y-c.y); a.adj.set(c, d); c.adj.set(a, d); }
    const w = walkFrom(nodes[0], false), bf = new Map([[nodes[0], 0]]);
    for(let it = 0; it < 60; it++) for(const n of nodes) if(bf.has(n)) for(const [m, d] of n.adj){ const nd = bf.get(n) + d; if(!bf.has(m) || nd < bf.get(m) - 1e-9) bf.set(m, nd); }
    out.dijkstra = w.dist.size === bf.size && [...bf].every(([n, d]) => Math.abs(w.dist.get(n) - d) < 1e-6);

    // dailyNeed cache follows herd changes
    const e = {id:"x", animals:[{id:"a1", sp:sp.id}], points:[[0,0],[10,0],[10,10]]};
    const n1 = JSON.stringify(dailyNeed(e)); e.animals.push({id:"a2", sp:sp.id});
    out.needCache = n1 !== JSON.stringify(dailyNeed(e));

    // run 16 days of sim
    for(let i = 0; i < 400; i++) tick(30);
    out.simDays = state.day > 10;

    // carried food survives a save/reload
    state.staff.keepers.push({id:"k-t", name:"T", stamina:100}); syncCrew();
    setCarry(crew.find(x => x.id === "k-t"), {type:"meat", amount:7});
    state = JSON.parse(JSON.stringify(state)); crew = []; syncCrew();
    out.carryPersists = crew.find(x => x.id === "k-t").carry.amount === 7;

    // leftover Paleoflora goes back to CERES at night
    state.ceres.stock = 0; setCarry(crew.find(x => x.id === "k-t"), {type:"paleoflora", amount:3}); keepersNight();
    out.paleofloraReturned = state.ceres.stock === Math.min(3, ceresCap());

    // breakouts work with no path graph; the animal waits at its exhibit
    kGraph = {nodes:new Map(), anchors:{}};
    const ex = {id:"e1", name:"Pen", animals:[{id:"a9", sp:sp.id}], points:[[0,0],[20,0],[20,20],[0,20]], cond:100};
    state.exhibits.push(ex); breakOut(ex, ex.animals[0]); moveLoose(5);
    const lp = loosePos(state.safety.loose[state.safety.loose.length - 1]);
    out.looseNoGraph = !!lp && lp[0] === 10 && lp[1] === 10;

    // mechanics don't repair on credit
    state.money = -100; ex.cond = 10;
    state.staff.mechanics = [{id:"m1", name:"M"}];
    mcrew = [{id:"m1", at:{x:0, y:0, adj:new Map(), svc:new Set()}, route:[], t:0, job:"repairing", wait:0, target:"e1", work:0}];
    mechanicsTick(10);
    out.noRepairWhenBroke = state.money === -100 && ex.cond === 10;
    return out;
  });

  await page.waitForTimeout(800);
  let ok = true;
  for(const [k, v] of Object.entries(checks)){ console.log(`${v ? "PASS" : "FAIL"} ${k}`); ok = ok && v; }
  if(errors.length){ ok = false; console.log("Page errors:\n  " + errors.join("\n  ")); }
  console.log(ok ? "All checks passed." : "Some checks failed.");
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
