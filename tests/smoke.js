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

    // ATVs are shared and stay parked: ride a service road, walk a gap, and no ATV is there on the far side
    const mk = (k, x) => ({k, x, y:0, adj:new Map(), svc:new Set()});
    const [A, B, C, D, E] = [mk("A", 0), mk("B", 100), mk("C", 200), mk("D", 300), mk("E", 400)];
    const ln = (a, b, svc) => { const d = Math.abs(a.x - b.x); a.adj.set(b, d); b.adj.set(a, d); if(svc){ a.svc.add(b); b.svc.add(a); } };
    ln(A, B, true); ln(B, C, false); ln(C, D, true); ln(D, E, true);
    const rider = {riding:false};
    let wv = walkFrom(A, rider, new Set([A])), rv = routeTo(wv, E);
    out.atvPlan = rv.mount === A && rv.park === B && Math.abs(wv.dist.get(E) - (100/VEHICLES.speedMult + 100 + 200)) < 1e-6;   // ride A-B, walk B-E
    // on foot at C with the only free ATV parked at B: no riding the C-D-E road
    wv = walkFrom(C, rider, new Set([B])); out.atvLeftBehind = !routeTo(wv, E).mount && Math.abs(wv.dist.get(E) - 200) < 1e-6;
    // walking back to a parked ATV to use it
    wv = walkFrom(C, rider, new Set([A])); rv = routeTo(wv, A); out.atvFetch = !rv.mount && Math.abs(wv.dist.get(A) - 200) < 1e-6;
    wv = walkFrom(B, rider, new Set([B])); out.atvRemount = routeTo(wv, A).mount === B && Math.abs(wv.dist.get(A) - 100/VEHICLES.speedMult) < 1e-6;
    // each depot brings 3 ATVs, shared by everyone, and demolishing it takes them
    const keepB = state.buildings, keepA = state.staff.atvs;
    state.buildings = [{id:"dep1", type:"depot"}, {id:"dep2", type:"depot"}]; state.staff.atvs = [];
    syncAtvs(); const two = atvs().length === 2 * VEHICLES.perDepot;
    state.buildings = [{id:"dep1", type:"depot"}]; syncAtvs(); const one = atvs().length === VEHICLES.perDepot && atvs().every(a => a.depot === "dep1");
    state.buildings = keepB; state.staff.atvs = keepA;
    out.atvPerDepot = two && one;

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

  // Paleo-medicine end to end, on a fresh park: dart, carry to the PMC, treat, carry home; then an escape
  Object.assign(checks, await page.evaluate(() => {
    const out = {};
    startWith(newPark(), false); setSpeed(0);
    // no surprise illnesses or injuries from the nightly rolls; this block sets up its own cases
    const realRandom = Math.random; Math.random = () => .99;
    state.money = 1e6; state.day = 20; state.staff.feedFrom = 0; state.safety.escapesFrom = 99;
    const H = Math.PI / 2;
    state.buildings.push({id:"b-st", type:"station", points:rectPts(196, 290, 14, 10, H)});
    state.buildings.push({id:"b-pmc", type:"pmc", points:rectPts(215, 255, 20, 14, H)});
    const viv = {id:"e-v", name:"Bug house", viv:"L", points:rectPts(196, 255, 16, 10, H), animals:[{id:"a-s", sp:"arth"}, {id:"a-t", sp:"arth"}], happy:70};
    state.exhibits.push(viv);
    recompute(); buildKeeperGraph();
    out.pmcOnGraph = !!kGraph.anchors["b-pmc"] && !!kGraph.anchors["e-v"];
    state.staff.keepers.push({id:"k-1", name:"K", stamina:100});
    hireVet();
    state.science.tech.push("medpaleo"); state.ceres.meds = 10;
    viv.animals[0].sick = {kind:"illness", sev:60};   // serious: has to go to the PMC
    const run = (mins, until) => { for(let i = 0; i < mins; i++){ state.minute = OPEN_MIN + 60; tick(1); if(until()) return true; } return false; };
    out.sickToWard = run(600, () => state.health.ward.length === 1);
    healthNight(); healthNight(); vetsNight(); keepersNight();   // two nights of treatment for a serious case
    const cured = state.health.ward[0] && state.health.ward[0].cured;
    out.treated = !!cured && state.ceres.meds === 10 - HEALTH.dose;
    out.curedGoesHome = run(600, () => viv.animals.length === 2 && !state.health.ward.length) && !viv.animals.some(a => a.sick);

    // a check-up finds a hidden mild illness, and the vet treats it on the spot (no dart, no PMC)
    vetsNight(); keepersNight();
    viv.vetCheck = state.day - HEALTH.checkEvery;
    fallSick(viv.animals[1], "illness", HEALTH.illStart);
    out.mildStartsHidden = !!viv.animals[1].sick.hidden;
    const meds0 = state.ceres.meds;
    out.checkupTreatsOnSpot = run(300, () => !viv.animals[1].sick) && viv.vetCheck === state.day && state.ceres.meds === meds0 - HEALTH.fieldDose &&
      !state.health.ward.length && !state.staff.transfers.length && viv.animals.length === 2;
    // injuries always go to the PMC
    vetsNight(); keepersNight();
    viv.animals[1].sick = {kind:"injury", sev:20};
    out.injuryGoesToWard = run(600, () => state.health.ward.length === 1);
    state.health.ward = []; viv.animals.push({id:"a-t", sp:"arth"}); vetsNight(); keepersNight();

    // without the era's medicine, a patient only stabilizes
    state.science.tech = state.science.tech.filter(t => t !== "medpaleo");
    state.health.ward.push({a:{id:"a-w", sp:"arth", sick:{kind:"illness", sev:50}}, home:"e-v", dosed:false});
    healthNight();
    out.stableWithoutMedicine = state.health.ward.find(p => p.a.id === "a-w").a.sick.sev === 50;
    state.health.ward = [];

    // vets dart escaped animals and keepers carry them home
    vetsNight(); keepersNight();
    const node = kGraph.anchors["b-st"];
    state.safety.loose.push({id:"a-x", sp:"arth", from:"e-v", at:node.k, x:node.x, y:node.y, next:null, t:0, status:"loose"});
    let vetDarted = false;
    out.escapeReturned = run(600, () => { if(state.safety.loose[0] && state.safety.loose[0].byVet) vetDarted = true; return !state.safety.loose.length; }) && viv.animals.some(a => a.id === "a-x");
    out.vetDartedEscape = vetDarted;

    // hungry, dirty animals fall ill more than well-kept ones
    const a = viv.animals[1], base = illChance(viv, a).p;
    viv.hungryMin = CLOSE_MIN - OPEN_MIN; viv.dirt = 90;
    out.neglectRaisesIllness = illChance(viv, a).p > base * 4;
    // rivals of a territorial species hurt each other, more when cramped
    const pen = {id:"e-r", name:"Rex", points:[[0,0],[40,0],[40,40],[0,40]], animals:[{id:"r1", sp:"trex"}, {id:"r2", sp:"trex"}]};
    state.exhibits.push(pen); recompute();
    out.territorialInjury = injuryChance(pen, pen.animals[0]).p > HEALTH.territorial;
    state.exhibits.pop(); recompute();
    Math.random = realRandom;
    return out;
  }));

  await page.waitForTimeout(800);
  let ok = true;
  for(const [k, v] of Object.entries(checks)){ console.log(`${v ? "PASS" : "FAIL"} ${k}`); ok = ok && v; }
  if(errors.length){ ok = false; console.log("Page errors:\n  " + errors.join("\n  ")); }
  console.log(ok ? "All checks passed." : "Some checks failed.");
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
