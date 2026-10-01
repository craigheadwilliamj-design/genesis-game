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

    // every new park sells one species from pool A and two from pool B
    let starterOk = true; const seenA = new Set();
    for(let i = 0; i < 60; i++){
      const st = pickStarters(), a = st.filter(id => STARTER_POOLS.a.ids.includes(id)), b = st.filter(id => STARTER_POOLS.b.ids.includes(id));
      starterOk = starterOk && st.length === 3 && a.length === 1 && b.length === 2 && new Set(st).size === 3; seenA.add(a[0]);
    }
    out.starterPools = starterOk && seenA.size > 1;
    const oldS = JSON.parse(JSON.stringify(state)); delete oldS.starters;
    out.oldSaveStarters = upgradeSave(oldS).starters.join() === "arth,lyst,hyps";

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
    state.science.tech.push("medpaleo"); state.buildings.find(b => b.id === "b-pmc").store = {meds:10};
    viv.animals[0].sick = {kind:"illness", sev:60};   // serious: has to go to the PMC
    const run = (mins, until) => { for(let i = 0; i < mins; i++){ state.minute = OPEN_MIN + 60; tick(1); if(until()) return true; } return false; };
    out.sickToWard = run(600, () => state.health.ward.length === 1);
    healthNight(); healthNight(); vetsNight(); keepersNight();   // two nights of treatment for a serious case
    const cured = state.health.ward[0] && state.health.ward[0].cured;
    out.treated = !!cured && pmcStock() === 10 - HEALTH.dose;
    out.curedGoesHome = run(600, () => viv.animals.length === 2 && !state.health.ward.length) && !viv.animals.some(a => a.sick);

    // a check-up finds a hidden mild illness, and the vet treats it on the spot (no dart, no PMC)
    vetsNight(); keepersNight();
    viv.vetCheck = state.day - HEALTH.checkEvery;
    fallSick(viv.animals[1], "illness", HEALTH.illStart);
    out.mildStartsHidden = !!viv.animals[1].sick.hidden;
    const meds0 = pmcStock();
    out.checkupTreatsOnSpot = run(300, () => !viv.animals[1].sick) && viv.vetCheck === state.day && pmcStock() === meds0 - HEALTH.fieldDose &&
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


  // Logistics: dock orders, stores, spoilage, hauling, zones, production
  Object.assign(checks, await page.evaluate(() => {
    const out = {};
    startWith(newPark(), false); setSpeed(0);
    const realRandom = Math.random; Math.random = () => .99;
    state.money = 1e6; state.day = 20; state.staff.feedFrom = 0; state.safety.escapesFrom = 99; state.health.from = 999;
    const H = Math.PI / 2;
    state.buildings.push({id:"b-st", type:"station", points:rectPts(196, 290, 14, 10, H)});
    state.buildings.push({id:"b-dock", type:"dock", points:rectPts(196, 268, 16, 10, H)});
    const viv = {id:"e-v", name:"Bugs", viv:"L", points:rectPts(214, 284, 16, 10, H), animals:[1,2,3,4,5,6].map(i => ({id:"a" + i, sp:"arth"})), happy:70};
    state.exhibits.push(viv);
    recompute(); buildKeeperGraph();
    const dock = state.buildings.find(b => b.id === "b-dock"), st = state.buildings.find(b => b.id === "b-st");
    out.storesOnGraph = !!kGraph.anchors["b-dock"] && !!kGraph.anchors["b-st"];
    // exhibits start empty and nothing is stocked yet
    out.hayDemand = parkDemand("plants") === 6;

    // the dock orders overnight and charges for it
    const m0 = state.money; dockDelivery();
    out.dockDelivers = Math.round(stockOf(dock, "plants")) === 6 * LOGI.autoDays && state.money === m0 - Math.round(12 * unitPrice("plants"));
    // partner parks pay while still feeding
    state.logi.flow = {}; dock.store = {}; state.staff.feedFrom = 99; const m1 = state.money; dockDelivery(); state.staff.feedFrom = 0;
    out.partnerPays = state.money === m1 && stockOf(dock, "plants") > 0;
    // a rush order lands now at a markup
    dock.store = {}; const m2 = state.money; out.rushOrder = !rushOrder(dock, "meat") && stockOf(dock, "meat") === LOGI.rushLot && state.money < m2;
    dock.store = {plants:12};

    // a keeper feeds the exhibit from the dock's stock, then restocks the station when nothing else needs doing
    state.staff.keepers.push({id:"k-1", name:"K", stamina:100});
    const run = (mins, until) => { for(let i = 0; i < mins; i++){ state.minute = OPEN_MIN + 60; tick(1); if(until()) return true; } return false; };
    viv.stock = {};
    out.keeperFeeds = run(900, () => (viv.stock.paleoflora || 0) + (viv.stock.plants || 0) >= 1);
    out.foodLeftDock = stockOf(dock, "plants") < 12;
    dock.store = {plants:60};
    viv.stock = {plants:storeMax(viv, "paleoflora"), paleoflora:storeMax(viv, "paleoflora")};
    out.keeperRestocks = run(1500, () => stockOf(st, "plants") >= 5);
    out.supplyLine = supplyLines().length > 0;
    keepersNight();

    // storing and rotting
    const cold = {id:"b-cold", type:"coldstore", points:rectPts(0, 0, 14, 10, 0), store:{meat:100}};
    const plain = {id:"b-p", type:"station", points:rectPts(30, 0, 14, 10, 0), store:{meat:100}};
    state.buildings.push(cold, plain);
    cold.powered = true; spoilNight();
    out.coldKeepsMeat = Math.round(stockOf(cold, "meat")) === Math.round(100 * (1 - GOODS.meat.spoil * LOGI.coldSpoil)) && Math.round(stockOf(plain, "meat")) === Math.round(100 * (1 - GOODS.meat.spoil));
    cold.store = {meat:100}; cold.powered = false; spoilNight();
    out.unpoweredColdRots = Math.round(stockOf(cold, "meat")) === Math.round(100 * (1 - GOODS.meat.spoil));
    // a store only takes what fits and what it holds
    const wh = {id:"b-w", type:"warehouse", points:rectPts(60, 0, 16, 12, 0)};
    out.storeHolds = addGood(wh, "meat", 10) === 0 && addGood(wh, "plants", 1e6) === storeCap(wh);
    state.buildings = state.buildings.filter(b => b !== cold && b !== plain);
    // coolers and crates
    state.staff.upgrades.push("coolers", "crates");
    out.upgradesWork = Math.abs(spoilRate(dock, "meat") - GOODS.meat.spoil * LOGI.coolerCut) < 1e-9 && storeCap(dock) === Math.round(BUILDINGS.dock.store.cap * LOGI.crateBoost);
    state.staff.upgrades = [];

    // zones: assign by drawing, keepers only feed their own zone
    const far = {id:"e-far", name:"Far", viv:"L", points:rectPts(214, 300, 16, 10, H), animals:[{id:"f1", sp:"arth"}], happy:70};
    state.exhibits.push(far);
    state.zones.push({id:"z-1", name:"North", color:"#E0A030", points:[[185,275],[225,275],[225,295],[185,295]]});
    autoZone(viv); autoZone(st);
    out.autoZone = viv.zone === "z-1" && st.zone === "z-1" && !far.zone;
    recompute(); buildKeeperGraph(); viv.stock = {}; far.stock = {};
    const jobsFor = z => shortages(z ? {zone:z} : null).map(j => j.e.id);
    out.zonedKeepersStay = jobsFor("z-1").includes("e-v") && !jobsFor("z-1").includes("e-far") && jobsFor(null).includes("e-far");
    dropZone("z-1"); state.zones = [];
    out.zoneDropClears = !viv.zone && !st.zone;
    state.exhibits = state.exhibits.filter(e => e !== far);

    // a keeper with nothing else to do cleans a dirty exhibit, even with no shovels
    state.staff.keepers = [{id:"k-1", name:"K", stamina:100}]; crew = []; syncCrew();
    viv.stock = {plants:storeMax(viv, "paleoflora"), paleoflora:storeMax(viv, "paleoflora")}; viv.dirt = 80;
    out.cleansBareHanded = run(900, () => viv.dirt < 60) && !hasUpgrade("shovels");
    keepersNight();

    // mechanics and vets in a zone only work their own zone
    const f1 = {id:"f1", name:"F1", points:[[0,0],[9,0],[9,9]], animals:[{id:"q1", sp:"arth"}], cond:60, zone:"z-9", inspected:{day:1, cond:60}};
    const f2 = {id:"f2", name:"F2", points:[[50,0],[59,0],[59,9]], animals:[{id:"q2", sp:"arth"}], cond:5, inspected:{day:1, cond:5}};
    state.exhibits.push(f1, f2); state.zones.push({id:"z-9", name:"Z", color:"#fff", points:[[0,0],[1,0],[1,1]]});
    kGraph.anchors["fix:f1"] = kGraph.anchors["fix:f2"] = kGraph.anchors.f1 = kGraph.anchors.f2 = kGraph.anchors["b-st"];
    state.staff.mechanics = [{id:"mz", name:"Z", zone:"z-9"}, {id:"mf", name:"F"}];
    out.mechanicZone = pickFence({id:"mz"}) === f1 && pickFence({id:"mf"}).zone === undefined;
    state.health.from = 0; vcrew = [];
    state.staff.vets = [{id:"vz", name:"Z", zone:"z-9"}, {id:"vf", name:"F"}];
    out.vetZone = pickCheck({id:"vz"}) === f1 && !!pickCheck({id:"vf"});
    setZone("mechanic", "mf", "z-9"); setZone("vet", "vf", "z-9");
    out.assignStaff = state.staff.mechanics[1].zone === "z-9" && zoneMembers(state.zones[0]).vets.length === 2;
    dropZone("z-9");
    out.dropClearsStaff = !state.staff.mechanics.some(m => m.zone) && !state.staff.vets.some(v => v.zone);
    state.exhibits = state.exhibits.filter(e => e !== f1 && e !== f2); state.zones = []; state.staff.mechanics = []; state.staff.vets = [];

    // production fills its own store through the day, and stops when full
    const farm = {id:"b-farm", type:"farm", points:rectPts(196, 245, 20, 14, H)};
    state.buildings.push(farm); recompute();
    logiTick(CLOSE_MIN - OPEN_MIN);
    out.farmMakes = Math.round(stockOf(farm, "plants")) === BUILDINGS.farm.makes.plants;
    logiTick(10 * (CLOSE_MIN - OPEN_MIN));
    out.farmStops = stockOf(farm, "plants") <= storeCap(farm);
    // farms cut what the dock orders
    dock.store = {};
    out.farmCutsOrders = dockOrders(dock).plants === Math.max(0, Math.ceil((6 - BUILDINGS.farm.makes.plants) * LOGI.autoDays));

    // old parks get a grace period and keep their medicine
    const oldPark = JSON.parse(JSON.stringify(state)); delete oldPark.logi; delete oldPark.zones; oldPark.staff.feedFrom = 3; oldPark.day = 10;
    const up = upgradeSave(oldPark);
    out.logiMigration = !!up.logi && Array.isArray(up.zones) && up.staff.feedFrom === 12 && up.logi.notice === true;
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
