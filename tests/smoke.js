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
    // the old slanted plot becomes the grid-aligned rectangle; new parks start with it
    const oldPlot = JSON.parse(JSON.stringify(state)); oldPlot.boundary = OLD_PLOT.map(p => p.slice());
    out.plotRectangle = JSON.stringify(upgradeSave(oldPlot).boundary) === JSON.stringify(PARK_PLOT) && JSON.stringify(newPark().boundary) === JSON.stringify(PARK_PLOT) &&
      PARK_PLOT.every(([x, y]) => x % 5 === 0 && y % 5 === 0);
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
    state.science.tech.push("medpaleo", "ref-Carboniferous"); state.buildings.find(b => b.id === "b-pmc").store = {meds:10};
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

    // without the era's medicine, contemporary medicine eases a patient down to its era's floor, and it goes home chronic
    state.science.tech = state.science.tech.filter(t => t !== "medpaleo");
    state.buildings.find(b => b.id === "b-pmc").store = {meds:0};
    const m0 = state.today.medicine; state.health.cmeds = 0;
    const pal = {a:{id:"a-w", sp:"arth", sick:{kind:"illness", sev:50}}, home:"e-v", med:null};
    state.health.ward.push(pal);
    healthNight();
    out.modernRestock = state.today.medicine - m0 === MODERN.stock * MODERN.cost && state.health.cmeds === MODERN.stock - HEALTH.dose;
    out.modernEases = pal.med === "modern" && Math.abs(pal.a.sick.sev - (50 - HEALTH.healPerNight * MODERN.heal.paleozoic)) < 1e-9 && !pal.cured;
    for(let i = 0; i < 5 && !pal.cured; i++) healthNight();
    out.modernLeavesChronic = pal.cured && pal.a.sick && pal.a.sick.chronic && pal.a.sick.sev === MODERN.floor.paleozoic;
    // Cenozoic animals respond better and are left less ill
    out.modernByEra = MODERN.heal.cenozoic > MODERN.heal.mesozoic && MODERN.heal.mesozoic > MODERN.heal.paleozoic && MODERN.floor.cenozoic < MODERN.floor.paleozoic;
    // a chronic case holds steady overnight instead of getting worse
    state.health.ward = []; state.staff.transfers = state.staff.transfers.filter(t => t.animalId !== "a-w");
    viv.animals[1].sick = {kind:"illness", sev:MODERN.floor.paleozoic, chronic:true};
    healthNight();
    out.chronicHolds = viv.animals[1].sick && viv.animals[1].sick.sev === MODERN.floor.paleozoic;
    // a vet won't dart a chronic case for more contemporary medicine, but cures it once the era's medicine is in
    out.chronicNotRetreated = !fieldTreatable(viv.animals[1]);
    state.science.tech.push("medpaleo", "ref-Carboniferous"); state.buildings.find(b => b.id === "b-pmc").store = {meds:10};
    out.chronicCuredWithEraMeds = fieldTreatable(viv.animals[1]);
    delete viv.animals[1].sick;
    // science buildings got cheaper
    out.cheaperScience = BUILDINGS.oracle.price === 9000 && BUILDINGS.ghost.price === 15000 && BUILDINGS.tar.price === 12000 && BUILDINGS.ceres.price === 10000 && BUILDINGS.pmc.price === 6000;

    // vets dart escaped animals and keepers carry them home
    vetsNight(); keepersNight();
    const node = kGraph.anchors["b-st"];
    state.safety.loose.push({id:"a-x", sp:"arth", from:"e-v", at:node.k, x:node.x, y:node.y, next:null, t:0, status:"loose"});
    let vetDarted = false;
    out.escapeReturned = run(600, () => { if(state.safety.loose[0] && state.safety.loose[0].byVet) vetDarted = true; return !state.safety.loose.length; }) && viv.animals.some(a => a.id === "a-x");
    out.vetDartedEscape = vetDarted;

    // an animal on a path nobody can walk to is left to keepers, and a breakout starts at the exhibit's gate stop
    vetsNight(); keepersNight(); state.safety.loose = [];
    const iso = {k:"iso", x:50, y:50, adj:new Map(), svc:new Set()}, iso2 = {k:"iso2", x:80, y:50, adj:new Map(), svc:new Set()};
    iso.adj.set(iso2, 30); iso2.adj.set(iso, 30); kGraph.nodes.set("iso", iso); kGraph.nodes.set("iso2", iso2);
    state.safety.loose.push({id:"a-y", sp:"arth", from:"e-v", at:"iso", x:50, y:50, next:null, t:0, status:"loose"});
    run(30, () => false);
    out.vetFlagsUnreachable = state.safety.loose[0].noVet === true && needsKeeper(state.safety.loose[0]);
    kGraph.nodes.delete("iso"); kGraph.nodes.delete("iso2"); state.safety.loose = [];
    viv.animals.push({id:"a-z", sp:"arth"}); breakOut(viv, viv.animals[viv.animals.length - 1]);
    out.breakoutAtGate = state.safety.loose[0].at === kGraph.anchors["e-v"].k;
    state.safety.loose = []; viv.animals = viv.animals.filter(a => a.id !== "a-z");

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

    // a keeper feeds the exhibit from the dock's stock, then a custodian restocks the station
    state.staff.keepers.push({id:"k-1", name:"K", stamina:100});
    const run = (mins, until) => { for(let i = 0; i < mins; i++){ state.minute = OPEN_MIN + 60; tick(1); if(until()) return true; } return false; };
    viv.stock = {};
    out.keeperFeeds = run(900, () => (viv.stock.paleoflora || 0) + (viv.stock.plants || 0) >= 1);
    out.foodLeftDock = stockOf(dock, "plants") < 12;
    dock.store = {plants:60};
    viv.stock = {plants:storeMax(viv, "paleoflora"), paleoflora:storeMax(viv, "paleoflora")};
    // keepers leave restocking to custodians: nothing moves to the station until one is hired
    out.keeperNoRestock = !run(300, () => stockOf(st, "plants") >= 5);
    state.buildings.push({id:"b-cl2", type:"closet", points:rectPts(210, 250, BUILDINGS.closet.w, BUILDINGS.closet.d, H)});
    state.staff.custodians.push({id:"c-r", name:"R"}); recompute(); buildKeeperGraph(); buildGuestGraph();
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

    // an idle keeper tidies an exhibit however clean it is
    viv.dirt = 10; keepersNight(); crew.forEach(c => { c.job = "idle"; c.wait = 0; });
    out.idleKeeperTidies = run(600, () => viv.dirt < 5);
    keepersNight();

    // reshaping a zone: cancel puts it back, Done keeps it and pulls in what's now inside
    state.zones.push({id:"z-e", name:"Edit", color:"#fff", points:[[100,100],[140,100],[140,140],[100,140]]});
    const lone = {id:"e-lone", name:"Lone", viv:"S", points:rectPts(180, 120, 6, 4, 0), animals:[], happy:70}; state.exhibits.push(lone);
    startZoneEdit("z-e"); zoneById("z-e").points = [[100,100],[200,100],[200,140],[100,140]]; setTool("select");
    out.zoneEditCancel = JSON.stringify(zoneById("z-e").points) === JSON.stringify([[100,100],[140,100],[140,140],[100,140]]) && !lone.zone;
    startZoneEdit("z-e"); zoneById("z-e").points = [[100,100],[200,100],[200,140],[100,140]]; finishZoneEdit();
    out.zoneEditDone = zoneById("z-e").points[1][0] === 200 && lone.zone === "z-e" && tool === "select";
    state.exhibits = state.exhibits.filter(e => e !== lone); dropZone("z-e"); state.zones = state.zones.filter(z => z.id !== "z-e");

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

  // A keeper fetches food from a dock far out on a service road, with a break room near the station
  Object.assign(checks, await page.evaluate(() => {
    const out = {};
    startWith(newPark(), false); setSpeed(0);
    const realRandom = Math.random; Math.random = () => .99;
    state.money = 1e6; state.staff.feedFrom = 0; state.safety.escapesFrom = 999; state.health.from = 999;
    state.paths.push({id:"p-k1", points:[[205,235],[100,235],[100,120],[300,120],[300,235],[205,235]]});
    state.paths.push({id:"s-k1", type:"service", points:[[205,235],[205,140]]});
    state.paths.push({id:"s-k2", type:"service", points:[[205,140],[205,60],[380,60]]});
    const ex = (id, pts, sp, n, gate) => state.exhibits.push({id, name:id, points:pts, gate, animals:Array.from({length:n}, (_, i) => ({id:id + i, sp})), happy:80, cond:100, stock:{}});
    ex("e-k1", [[104,124],[204,124],[204,231],[104,231]], "lyst", 4, [204,180]);
    ex("e-k2", [[206,124],[296,124],[296,231],[206,231]], "dime", 2, [206,180]);
    const B = (id, type, x, y) => state.buildings.push({id, type, points:rectPts(x, y, BUILDINGS[type].w, BUILDINGS[type].d, 0)});
    B("b-kst", "station", 214, 265); B("b-kdock", "dock", 380, 67); B("b-kbr", "breakroom", 197, 265);
    afterChange();
    const dock = buildingById("b-kdock"), st = buildingById("b-kst");
    out.dockLayout = ["b-kst", "b-kdock", "b-kbr", "e-k1", "e-k2"].every(id => !!kGraph.anchors[id]);
    dock.store = {plants:100, meat:100};
    state.staff.keepers.push({id:"k-d", name:"D", stamina:100}); syncCrew();
    const day = state.day;
    while(state.day === day && !(state.exhibits[1].stock.meat > 0)) tick(1);
    out.dockToExhibit = state.day === day && state.exhibits[1].stock.meat > 0 && stockOf(dock, "meat") < 100 && state.staff.keepers[0].stamina > 50;

    // a worn-out keeper holding food delivers it before taking a break
    const c = crew.find(x => x.id === "k-d"), k = state.staff.keepers.find(x => x.id === "k-d");
    state.exhibits[1].stock = {}; c.route = []; c.job = "idle"; c.wait = 0; c.plan = null; c.haul = null; c.at = kGraph.anchors["b-kdock"];
    setCarry(c, {type:"meat", amount:10}); k.stamina = 10;
    decide(c, k);
    out.deliverBeforeRest = c.job === "toExhibit";

    // food still in hand at closing stays with the keeper overnight, and gets delivered the next day
    keepersNight();
    out.carryOvernight = !!c.carry && c.carry.amount === 10 && k.carry && k.carry.amount === 10;
    state.minute = OPEN_MIN; let fed = false;
    for(let i = 0; i < 300 && !fed; i++){ tick(1); fed = state.exhibits[1].stock.meat > 0; }
    out.carryDeliveredNextDay = fed;

    // a station full of one food doesn't send keepers to fetch another it has no room for
    for(const x of crew){ x.haul = null; setCarry(x, null); }
    st.store = {plants:storeCap(st)};
    const near = list => list.length ? {b:list[0]} : null;
    const h = pickHaul(null, near, CUSTODIAN_GOODS, custCarry());
    out.fullStoreNoHaul = !h || h.d !== st;
    Math.random = realRandom;
    return out;
  }));

  // Guests: parties walk to food and restrooms, pay where they're served, and their mood sets guest comfort
  Object.assign(checks, await page.evaluate(() => {
    const out = {};
    startWith(newPark(), false); setSpeed(0);
    state.money = 1e6; state.staff.feedFrom = 999; state.safety.escapesFrom = 999; state.health.from = 999;
    state.paths.push({id:"p-loop", points:[[205,235],[100,235],[100,120],[300,120],[300,235],[205,235]]});
    const ex = (id, pts, sp, n) => state.exhibits.push({id, name:id, points:pts, animals:Array.from({length:n}, (_, i) => ({id:id + i, sp})), happy:80, cond:100});
    ex("e-g1", [[104,124],[180,124],[180,231],[104,231]], "lyst", 4);
    ex("e-g2", [[220,124],[296,124],[296,231],[220,231]], "dryo", 4);
    const B = (id, type, x, y) => state.buildings.push({id, type, points:rectPts(x, y, BUILDINGS[type].w, BUILDINGS[type].d, 0)});
    B("b-f", "food", 92, 150); B("b-r", "restroom", 305, 150); B("b-s", "shop", 240, 242);
    // a new stand is an empty shell until it has a menu
    afterChange();
    out.emptyShellServesNothing = !servesOf(buildingById("b-f")).length;
    addToMenu(buildingById("b-f"), "burger"); addToMenu(buildingById("b-f"), "soda"); addToMenu(buildingById("b-s"), "plush");
    out.menuSlotsLimit = !!addToMenu(buildingById("b-f"), "pizza");
    out.guestStops = ["b-f", "b-r", "b-s", "e-g1", "e-g2", "gate"].every(id => !!gGraph.anchors[id]);
    // a party's route to a stop matches a plain walk there
    const f = guestField("b-f"), w = walkFrom(gGraph.anchors.gate, null, new Set());
    out.guestField = Math.abs(f.dist.get(gGraph.anchors.gate) - w.dist.get(gGraph.anchors["b-f"])) < 1e-6;

    // a thirsty party walks to the food stand, pays, and stops being thirsty
    state.minute = OPEN_MIN + 60; const t0 = state.today.tickets;
    guestsArrive(2); const p = parties[0];
    out.ticketPaid = state.today.tickets - t0 === state.ticket * 2;
    p.needs = {hunger:10, thirst:70, bladder:0, energy:0}; p.until = CLOSE_MIN; p.spd = 1.15;   // a quick walker, so one soda is enough when it gets there
    // only the parties set up here: nobody new comes in
    const run = (mins, until) => { for(let i = 0; i < mins; i++){ derived.demand = 0; guestsTick(state.minute, state.minute + 1); state.minute++; if(until()) return true; } return false; };
    // (it may grab a meal too if it got hungry on the way)
    out.partyDrinks = run(400, () => p.needs.thirst < 20) && state.today.food >= MENU.soda.price * 2 && state.buildings.find(b => b.id === "b-f").served.money === state.today.food;
    // and then the restroom
    p.needs.bladder = 75; p.needs.energy = 0; p.mood = 70;
    out.partyRestroom = run(400, () => p.needs.bladder < 5);
    // nowhere to eat: they say so
    const fs = state.buildings.find(b => b.id === "b-f"); state.buildings = state.buildings.filter(b => b !== fs); afterChange();
    p.needs.hunger = 80; p.needs.energy = 0; p.dest = null; p.why = null;
    p.home = false; p.mood = 70; p.until = CLOSE_MIN; planParty(p);
    out.noFoodThought = p.thought.has("noFood");
    state.buildings.push(fs); afterChange();
    // going home: the party walks out the gate and its mood counts
    p.needs.energy = 0; p.mood = 70;
    const before = state.today.moodN; goHome(p);
    out.partyLeaves = run(600, () => p.gone) && !parties.includes(p) && state.today.moodN === before + 2;

    // a desperate party gives up on a long queue
    guestsArrive(1); const q = parties[parties.length - 1];
    svcQ.set("b-r", {queue:[q], busy:[{readyAt:1e9}, {readyAt:1e9}, {readyAt:1e9}, {readyAt:1e9}]}); q.in = "b-r"; q.waited = 0; q.why = "bladder"; q.dest = "b-r";
    run(GUEST.patience + 2, () => false);
    out.queueGivesUp = !q.in && q.thought.has("queue") && !svcQ.get("b-r").queue.includes(q);
    svcQ.clear();

    // a death takes one guest from the party nearest the loose animal
    resetParties(); guestsArrive(3); const v = parties[0];
    const n0 = guestCount();
    state.safety.loose = [{id:"l-x", sp:"trex", status:"loose", at:null, x:v.at.x, y:v.at.y}];
    const rr = Math.random; Math.random = () => 0; harmGuests(1); Math.random = rr;
    out.deathTakesGuest = guestCount() === n0 - 1 && v.n === 2 && state.safety.deaths === 1;
    state.safety.loose = []; state.safety.deaths = 0;

    // a full day: guests come, go, and leave a mood behind for the rating
    resetParties(); state.minute = OPEN_MIN; state.today = freshLedger(); state.guestLog = freshGuestLog();
    const day = state.day;
    while(state.day === day) tick(2);
    const h = state.history[state.history.length - 1];
    out.dayOfGuests = h.guests > 20 && state.guestLog.mood > 20 && state.guestLog.last.guests === h.guests && !parties.length;
    out.comfortFromMood = derived.parts.find(x => x.label === "Guest comfort").score === clamp((state.guestLog.mood - GUEST.badMood) / (GUEST.goodMood - GUEST.badMood), 0, 1);

    // a tired party sits on a bench, and gets up rested
    const bench = {id:"b-bench", type:"bench", points:rectPts(96.8, 200, BUILDINGS.bench.w, BUILDINGS.bench.d, Math.PI / 2)};
    state.buildings.push(bench); afterChange();
    resetParties(); state.minute = OPEN_MIN + 60; guestsArrive(2); const tp1 = parties[0];
    tp1.needs = {hunger:0, thirst:0, bladder:0, energy:75}; tp1.until = CLOSE_MIN;
    out.benchRests = !!gGraph.anchors["b-bench"] && run(400, () => tp1.needs.energy < 5) && bench.served && bench.served.n === 2;

    // trash goes in a bin nearby; a full bin spills onto the path; the night crew clears it all, for a fee
    const bin = {id:"b-bin", type:"bin", points:rectPts(96.7, 180, BUILDINGS.bin.w, BUILDINGS.bin.d, Math.PI / 2)};
    state.buildings.push(bin); afterChange();
    state.litter = {};
    tp1.at = nearestGuestNode(100, 180); tp1.trash = 3; tp1.trashAt = state.minute; trashCheck(tp1);
    out.binCatchesTrash = bin.fill === 3 && !tp1.trash && litterTotal() === 0;
    bin.fill = LITTER.binCap; tp1.trash = 2; trashCheck(tp1);
    out.fullBinSpills = litterTotal() === 2;
    // with no bin in reach, trash held long enough ends up on the ground
    const far = nearestGuestNode(300, 125); tp1.at = far; tp1.trash = 1; tp1.trashAt = state.minute - LITTER.holdMin;
    const rr2 = Math.random; Math.random = () => 0; trashCheck(tp1); Math.random = rr2;
    out.dropsLitter = litterAt(far.x, far.y) === 1;
    const rest = buildingById("b-r"); rest.dirt = 40;
    const bill = cleaningBill(), c0 = state.today.cleaning;
    servicesNight();
    out.nightCleaning = bill === Math.round(3 * LITTER.nightCost + LITTER.binCap * LITTER.binNightCost + 40 * RESTROOM.nightCost) &&
      state.today.cleaning - c0 === bill && litterTotal() === 0 && bin.fill === 0 && rest.dirt === 0;
    // a filthy restroom only gets the desperate
    rest.dirt = RESTROOM.avoid + 5; tp1.at = gGraph.gate; tp1.needs.bladder = 70;
    out.filthyRestroomAvoided = !bestStop(tp1, "bladder");
    tp1.needs.bladder = GUEST.desperate + 1;
    out.desperateUseIt = !!bestStop(tp1, "bladder");
    rest.dirt = 0;
    // prices: everyone pays the usual price, half pay 50% more, nobody pays double
    out.priceSense = willPay("burger", 8) === 1 && Math.abs(willPay("burger", 12) - .5) < 1e-9 && willPay("burger", 16) === 0;
    resetParties();

    // stock goes physical: a stand with nothing on its shelves serves nobody, and a custodian carries stock out to it
    state.logi.guestFrom = 0;
    const kio = {id:"b-kio", type:"kiosk", points:rectPts(305, 200, BUILDINGS.kiosk.w, BUILDINGS.kiosk.d, Math.PI / 2)};
    const wh = {id:"b-wh", type:"warehouse", points:rectPts(250, 111.5, BUILDINGS.warehouse.w, BUILDINGS.warehouse.d, 0)};
    const cl = {id:"b-cl", type:"closet", points:rectPts(160, 115, BUILDINGS.closet.w, BUILDINGS.closet.d, 0)};
    state.buildings.push(kio, wh, cl); afterChange();
    addToMenu(kio, "soda");
    out.noStockNoSale = !servesOf(kio).length && !!kGraph.anchors["b-kio"] && !!kGraph.anchors["b-wh"] && !!kGraph.anchors["b-cl"];
    wh.store = {drinks:100};
    hireCustodian(); syncCustodians();
    const work = (mins, until) => { for(let i = 0; i < mins; i++){ state.minute = OPEN_MIN + 60; custodiansTick(1); if(until()) return true; } return false; };
    out.custodianRestocks = work(600, () => stockOf(kio, "drinks") > 0) && stockOf(wh, "drinks") < 100 && servesOf(kio).includes("thirst");
    // a sale takes as many units as the item costs to stock
    const sb = stockOf(kio, "drinks"), sp2 = newParty(2); sp2.needs = {hunger:0, thirst:80, bladder:0, energy:0}; sp2.cash = 100;
    serveAt(sp2, kio, "thirst");
    out.saleUsesStock = Math.abs(sb - stockOf(kio, "drinks") - MENU.soda.cost * 2) < 1e-9 && state.logi.used.drinks >= MENU.soda.cost * 2;
    // custodians scrub dirty restrooms and sweep litter
    for(const c of ccrew){ c.haul = null; setCustCarry(c, null); c.route = []; c.job = "idle"; c.wait = 0; }
    wh.store = {}; rest.dirt = 60;
    out.custodianScrubs = work(600, () => !rest.dirt);
    const lk = litterKey(100, 200); state.litter = {[lk]:10};
    out.custodianSweeps = work(900, () => !state.litter[lk]);
    // the dock orders stock for stands and shops too
    out.dockOrdersStock = dockOrders({type:"dock"}).drinks > 0;
    state.staff.custodians = []; syncCustodians();

    // vandalism: a rowdy, unhappy party breaks the bench beside it, and a broken bench seats nobody
    const rr4 = Math.random;
    const sec = {id:"b-sec", type:"security", points:rectPts(130, 114.5, BUILDINGS.security.w, BUILDINGS.security.d, 0)};
    const ws = {id:"b-ws", type:"workshop", points:rectPts(93, 130, BUILDINGS.workshop.w, BUILDINGS.workshop.d, Math.PI / 2)};
    state.buildings.push(sec, ws); bench.cond = 100; afterChange();
    resetParties(); guestsArrive(2); const vp = parties[0];
    vp.at = nearestGuestNode(100, 200); vp.rowdy = true; vp.mood = 10;
    Math.random = () => 0; const hit = vandalize(vp); Math.random = rr4;
    out.vandalBreaksBench = !!hit && hit.b === bench && propCond(bench) === 100 - VANDAL.propHit && vp.vandal && vandalLog().acts === 1;
    bench.cond = 10;
    out.brokenBenchUseless = isBroken(bench) && !servesOf(bench).length;
    // a guard nearby puts vandals off, and throws this one out
    const d0 = deterrence(100, 200);
    hireGuard(); syncGuards(); gcrew[0].at = nearestNode(100, 200); gcrew[0].route = [];
    out.guardDeters = deterrence(100, 200) <= d0 * SECURITY.deterCut + 1e-9;
    guardWatch();
    out.guardCatches = vp.gone && vp.ejected && vandalLog().caught === 1;
    // with cameras, vandalism near the office sends the nearest guard
    state.science.tech.push("cameras");
    resetParties(); guestsArrive(2); const cp = parties[0]; cp.at = nearestGuestNode(130, 120); cp.rowdy = true;
    gcrew[0].at = nearestNode(300, 235); gcrew[0].chase = null;
    Math.random = () => 0; vandalize(cp); Math.random = rr4;
    out.cameraSendsGuard = cp.wanted && gcrew[0].chase === cp;
    state.science.tech = state.science.tech.filter(t => t !== "cameras");
    state.staff.guards = []; syncGuards(); resetParties();
    // a mechanic fixes the broken bench, and a custodian scrubs off graffiti
    hireMechanic();
    const fix = (mins, until) => { for(let i = 0; i < mins; i++){ state.minute = OPEN_MIN + 60; mechanicsTick(1); if(until()) return true; } return false; };
    out.mechanicFixesProp = fix(900, () => propCond(bench) >= 99.9);
    state.staff.mechanics = [];
    const fs4 = buildingById("b-f"); fs4.graffiti = 80; hireCustodian(); syncCustodians();
    out.custodianScrubsGraffiti = work(900, () => !fs4.graffiti);
    state.staff.custodians = []; syncCustodians();

    // education: an info sign by an exhibit teaches far more than looking, unless it's broken
    resetParties(); state.minute = OPEN_MIN + 60;
    const g1 = state.exhibits.find(e => e.id === "e-g1"), kid = () => { guestsArrive(2); return parties[parties.length - 1]; };
    const e0 = kid(); seeExhibit(e0, g1);
    const sign = {id:"b-sign", type:"sign", points:rectPts(96.9, 170, BUILDINGS.sign.w, BUILDINGS.sign.d, Math.PI / 2)};
    state.buildings.push(sign); afterChange();
    const e1 = kid(); seeExhibit(e1, g1);
    out.signTeaches = e0.edu === EDU.see && Math.abs(e1.edu - (EDU.see + EDU.sign * 1.25)) < 1e-9 && e1.mood > e0.mood;
    sign.cond = 10; const e2 = kid(); seeExhibit(e2, g1); sign.cond = 100;
    out.brokenSignTeachesNothing = e2.edu === EDU.see;
    // a field guide teaches a little, and makes every exhibit after teach more
    const e3 = kid(); buy(e3, buildingById("b-s"), {id:"guide", price:12}, 1); seeExhibit(e3, g1);
    out.guideBoosts = e3.guide && Math.abs(e3.edu - (EDU.guide + (EDU.see + EDU.sign * 1.25) * EDU.guideBoost)) < 1e-9;
    // the Education Center: a sight once everything else is seen, and a fee at the door
    state.science.tech.push("education");
    const ed = {id:"b-ed", type:"edcenter", points:rectPts(200, 111.5, BUILDINGS.edcenter.w, BUILDINGS.edcenter.d, 0), fee:4};
    state.buildings.push(ed); afterChange();
    const e4 = kid(); e4.seen = new Set(["e-g1", "e-g2"]); e4.cash = 100; e4.until = CLOSE_MIN;
    out.centerIsSight = !!gGraph.anchors["b-ed"] && pickSight(e4) === ed;
    const fee0 = state.today.edfees; serveAt(e4, ed, "see");
    out.centerTeaches = e4.edu === EDU.center && state.today.edfees - fee0 === 8 && ed.served.n === 2;
    ed.fee = EDU.centerFee * 2; const e5 = kid(); e5.cash = 100; serveAt(e5, ed, "see");
    out.centerTooDear = !e5.edu && e5.thought.has("priceyEdu");
    // learned guests litter less
    const rr5 = Math.random; Math.random = () => LITTER.drop * .8; state.litter = {};
    const lit = edu => { const x = kid(); x.edu = edu; x.at = nearestGuestNode(300, 200); x.trash = 1; x.trashAt = -999; trashCheck(x); return !x.trash; };
    out.learnedLitterLess = lit(0) && !lit(100);
    Math.random = rr5; state.litter = {};
    // leaving guests donate for what they learned, and it goes into the Education rating
    const e6 = kid(); e6.edu = 50; const don0 = state.today.donations, n0e = state.today.eduN;
    partyLeaves(e6);
    out.donations = Math.abs(state.today.donations - don0 - 2 * EDU.donate * .5) < 1e-9 && state.today.eduN === n0e + 2;
    state.today.eduSum = 30 * 20; state.today.eduN = 20; recompute();
    const edPart = derived.parts.find(x => x.label === "Education");
    out.educationRating = !!edPart && Math.abs(edPart.score - 30 / EDU.full) < 1e-9 && Math.abs(derived.parts.reduce((s, x) => s + x.max, 0) - 5) < 1e-9;
    state.buildings = state.buildings.filter(b => b !== ed && b !== sign); afterChange(); resetParties();

    // lodging: hotels need stars and a busy park first
    const r0 = state.rating, h0 = state.history; state.rating = 2;
    const lock1 = hotelLocked("lodge"); state.rating = 3; state.history = [{guests:100}];
    const lock2 = hotelLocked("lodge"); state.history = [{guests:400}];
    out.hotelUnlock = /3 stars/.test(lock1) && /300 guests/.test(lock2) && !hotelLocked("lodge") && /4 stars/.test(hotelLocked("resort"));
    const lodge = {id:"b-lodge", type:"lodge", points:rectPts(150, 245.5, BUILDINGS.lodge.w, BUILDINGS.lodge.d, 0)};
    state.buildings.push(lodge); afterChange();
    const gf0 = state.logi.guestFrom; state.logi.guestFrom = 999;   // suppliers bring toiletries for now
    // guests book rooms overnight and pay for them, and the rooms get dirty
    const book = (guests, stars) => { state.today.guests = guests; state.rating = stars; lodgingNight(); return lodge.booked.rooms; };
    const rm0 = state.today.rooms;
    out.hotelBooks = book(1000, 5) === BUILDINGS.lodge.rooms && state.today.rooms - rm0 === BUILDINGS.lodge.rooms * BUILDINGS.lodge.roomPrice
      && state.lodging.stays[0].n === BUILDINGS.lodge.rooms * LODGING.perRoom && lodge.dirt === LODGING.dirtPerNight;
    lodge.dirt = 0; const clean = book(200, 5); lodge.dirt = 100; const dirty = book(200, 5); lodge.dirt = 0;
    lodge.rate = BUILDINGS.lodge.roomPrice * 1.5; const dear = book(200, 5); lodge.rate = BUILDINGS.lodge.roomPrice * 2; const tooDear = book(200, 5); delete lodge.rate;
    out.hotelDirtyAndDear = clean > dirty && dirty > 0 && clean > dear && tooDear === 0;
    // once stock is physical, each room needs toiletries
    state.logi.guestFrom = 0; lodge.store = {merch:LODGING.toiletries * 5};
    out.hotelToiletries = book(1000, 5) === 5 && stockOf(lodge, "merch") < 1e-9;
    state.logi.guestFrom = 999; lodge.dirt = 0;
    // next morning the hotel guests start at the hotel, without buying a ticket
    book(1000, 5); resetParties();
    const tk0 = state.today.tickets, gs0 = state.today.guests;
    hotelGuestsArrive();
    out.hotelGuestsMorning = parties.length === BUILDINGS.lodge.rooms && parties.every(x => x.at === gGraph.anchors["b-lodge"] && x.hotel === "b-lodge")
      && state.today.tickets === tk0 && state.today.guests - gs0 === BUILDINGS.lodge.rooms * LODGING.perRoom && !state.lodging.stays.length;
    resetParties();
    // a custodian cleans the rooms
    lodge.dirt = 70; hireCustodian(); syncCustodians();
    out.custodianCleansHotel = work(900, () => !lodge.dirt);
    state.staff.custodians = []; syncCustodians();
    state.buildings = state.buildings.filter(b => b !== lodge); afterChange(); state.rating = r0; state.history = h0; state.logi.guestFrom = gf0;

    // lots of guests stay quick to simulate
    state.minute = OPEN_MIN + 120;
    for(let i = 0; i < 1500; i++) guestsArrive(2);
    out.partyCap = parties.length === GUEST.maxParties && guestCount() === 3000;
    for(let i = 0; i < 30; i++) tick(.8);
    const tp = performance.now(); for(let i = 0; i < 50; i++) tick(.8);
    out.guestPerf = (performance.now() - tp) / 50 < 15;

    // old saves get a guest log, and stands and shops from before menus keep what they sold
    const old = JSON.parse(JSON.stringify(state)); delete old.guestLog; delete old.today.moodSum; delete old.litter;
    for(const b of old.buildings) if(b.type === "food" || b.type === "shop") delete b.menu;
    const up = upgradeSave(old);
    out.oldSaveGuests = !!up.guestLog && up.guestLog.mood === null && up.today.moodSum === 0;
    const old2 = JSON.parse(JSON.stringify(state)); delete old2.logi.guestFrom; delete old2.staff.custodians; old2.day = 20;
    const up2 = upgradeSave(old2);
    const old3 = JSON.parse(JSON.stringify(state)); delete old3.staff.guards; delete old3.guestLog.vandal;
    const up3 = upgradeSave(old3);
    const old4 = JSON.parse(JSON.stringify(state)); delete old4.guestLog.edu; delete old4.today.eduSum; delete old4.today.donations;
    const up4 = upgradeSave(old4);
    const old5 = JSON.parse(JSON.stringify(state)); delete old5.lodging; delete old5.today.rooms;
    const up5 = upgradeSave(old5);
    out.oldSaveLodging = Array.isArray(up5.lodging.stays) && up5.today.rooms === 0;
    out.oldSaveEducation = up4.guestLog.edu === null && up4.today.eduSum === 0 && up4.today.donations === 0;
    out.oldSaveSecurity = Array.isArray(up3.staff.guards) && up3.guestLog.vandal && up3.guestLog.vandal.acts === 0;
    out.oldSaveGuestGoods = up2.logi.guestFrom === 23 && Array.isArray(up2.staff.custodians) && up2.logi.guestNotice === true;
    out.oldSaveMenus = up.buildings.find(b => b.type === "food").menu.map(m => m.id).join() === "burger,soda" &&
      up.buildings.find(b => b.type === "shop").menu.map(m => m.id).join() === "plush,tshirt,map" && !!up.litter && up.guestLog.notice === true;
    resetParties();

    // build sidebar and the Move tool
    out.menuBuilt = document.querySelectorAll("#sideMenu .sgroup").length >= 6 && !!document.querySelector('[data-tool="campground"]') && !!document.querySelector('[data-fence="concrete"]');
    out.fencePrice = exhibitCost([[0,0],[40,0],[40,40],[0,40]], "bars") - exhibitCost([[0,0],[40,0],[40,40],[0,40]]) === Math.round(160 * BARRIERS.bars.perMeter);
    {
      const ex = {id:"e-mv", name:"Mv", points:[[200,200],[240,200],[240,240],[200,240]], animals:[], happy:70, cond:100, gate:[220,200]};
      const keep = [state.exhibits, state.buildings, state.paths];
      state.exhibits = [ex]; state.buildings = []; state.paths = [];
      const m = startMove(ex, "exhibit", {clientX:0, clientY:0});
      moveBy(m, 10, 20);
      out.moveShifts = ex.points[0][0] === 210 && ex.points[0][1] === 220 && ex.gate[0] === 230 && ex.gate[1] === 220 && !moveProblem("exhibit", ex);
      moveBy(m, 5000, 0);
      out.moveBlocked = !!moveProblem("exhibit", ex);
      moveBy(m, 0, 0);
      out.moveRestores = ex.points[0][0] === 200 && ex.gate[1] === 200;
      [state.exhibits, state.buildings, state.paths] = keep;
    }
    {
      const ex = {id:"e-rs", name:"Rs", points:[[200,200],[240,200],[240,240],[200,240]], animals:[], happy:70, cond:100, gate:[220,200]};
      const keep = [state.exhibits, state.buildings, state.paths], money0 = state.money;
      state.exhibits = [ex]; state.buildings = []; state.paths = [];
      const orig = ex.points.map(p => p.slice());
      ex.points[2] = [260, 260];
      out.reshapeOk = !reshapeProblem(ex, orig) && reshapeCost(ex, orig) > 0;
      commitReshape(ex, orig);
      out.reshapePaid = state.money < money0;
      const o2 = ex.points.map(p => p.slice()); ex.points[2] = [200, 200];
      out.reshapeCrossBlocked = !!reshapeProblem(ex, o2);
      ex.points = o2;
      mvCorner = {id:"e-rs", i:3}; state.exhibits = [ex]; deleteMoveCorner();
      out.cornerDeleted = ex.points.length === 3;
      [state.exhibits, state.buildings, state.paths] = keep;
    }
    out.campgroundIsHotel = isHotel({type:"campground"});
    return out;
  }));

  // Science: research, trips, clones, and growing all run on park minutes, not days
  Object.assign(checks, await page.evaluate(() => {
    const out = {};
    startWith(newPark(), false); setSpeed(0);
    events.toast = () => {};
    state.money = 1e7; state.day = 3; state.starters = []; state.staff.feedFrom = 0; state.safety.escapesFrom = 99;
    const H = Math.PI / 2;
    state.buildings.push({id:"b-or", type:"oracle", points:rectPts(230, 262, 24, 16, H)});
    state.buildings.push({id:"b-gh", type:"ghost",  points:rectPts(180, 262, 28, 20, H)});
    state.buildings.push({id:"b-ta", type:"tar",    points:rectPts(230, 290, 26, 18, H)});
    state.buildings.push({id:"b-ce", type:"ceres",  points:rectPts(180, 290, 26, 18, H)});
    state.paths.push({id:"p-t", name:"t", points:[[205,262],[222,262]]}, {id:"p-t2", name:"t2", points:[[205,262],[193,262]]}, {id:"p-t3", name:"t3", points:[[205,290],[217,290]]}, {id:"p-t4", name:"t4", points:[[205,290],[193,290]]});
    recompute(); buildKeeperGraph();
    out.sciReachable = ["oracle", "ghost", "tar", "ceres"].every(t => !!dept(t));
    const sc = state.science, adv = (mins, fn) => { for(let i = 0; i < mins; i++){ if(state.minute >= CLOSE_MIN - 2){ state.day++; state.minute = OPEN_MIN; } tick(1); if(fn && fn()) return true; } return false; };
    state.minute = OPEN_MIN + 60;

    // research: needs a paleontologist, takes time proportional to cost, and finishes mid-day
    out.needsPaleo = !!startProject("tech", "bars");
    hireScientist("paleo");
    sc.points = 100;
    out.startResearch = startProject("tech", "bars") === null && sc.points === 85 && !hasTech("bars");
    const t15 = sc.projects[0].end - sc.projects[0].start;
    out.oneAtATime = !!startProject("tech", "moat") && sc.projects.length === 1;
    out.researchTakesTime = adv(60) === false && !hasTech("bars");
    const day0 = state.day;
    out.researchFinishesMidDay = adv(600, () => hasTech("bars")) && state.day === day0;
    sc.points = 100; startProject("tech", "moat");
    out.pricierIsSlower = sc.projects[0].end - sc.projects[0].start === t15 * 4;
    sc.projects = [];
    // points accrue with time, not at night
    const pts0 = sc.points; state.minute = OPEN_MIN + 60; tick(60);
    out.pointsTrickle = Math.abs(sc.points - pts0 - RESEARCH_PER_PALEO * 60 / DAY_MIN) < 1e-6;

    // animals are unlocked one by one under their period
    const small = SPECIES.filter(x => !x.viv).sort((a, c) => a.space - c.space)[0], big = SPECIES.slice().sort((a, c) => c.space - a.space)[0];
    out.tripLockedFirst = !!tripProblem(small.id, small.period);
    sc.points = 500; state.minute = OPEN_MIN + 60;
    out.unlockAnimal = startProject("species", small.id) === null && !isUnlocked(small.id);
    out.unlockCostScales = unlockPoints(big) > unlockPoints(small);
    adv(projectMinutes(unlockPoints(small)) + 5, () => isUnlocked(small.id));
    out.animalUnlocked = isUnlocked(small.id) && !sc.unlocked.includes(small.period);

    // trips: need a team, take minutes, and come back mid-day
    out.needsTeam = !!tripProblem(small.id, small.period);
    hireScientist("temporal");
    out.tripOk = !tripProblem(small.id, small.period);
    const mny = state.money; state.minute = OPEN_MIN + 60;
    out.launch = launchTrip(small.id, small.period) && state.money === mny - tripOdds(small.id, small.period).cost && sc.trips.length === 1;
    out.oneTeamOneTrip = !!tripProblem(small.id, small.period);
    const trip = sc.trips[0];
    out.tripLength = trip.end - trip.start === Math.round(PERIOD_BY_ID[small.period].days * DAY_MIN);
    const realRandom = Math.random;
    Math.random = () => .99;   // never empty-handed bonus-free good find
    out.tripReturns = adv(trip.end - nowMin() + 2, () => !sc.trips.length) && !!sc.dna[small.id];
    Math.random = realRandom;

    // a genome takes about 3 trips for the smallest animal and 8 for the largest
    const avgTrips = id => {
      const p = SPECIES_BY_ID[id].period; let total = 0; const N = 600;
      for(let n = 0; n < N; n++){ delete sc.dna[id]; let k = 0; while(!genomeDone(id) && k < 60){ tripReturns({sp:id, period:p}); k++; } total += k; }
      return total / N;
    };
    const tiny = SPECIES.slice().sort((a, c) => a.space - c.space)[0];
    sc.unlocked.push(big.id);
    const aSmall = avgTrips(tiny.id), aBig = avgTrips(big.id);
    out.smallGenome3 = aSmall > 2.6 && aSmall < 4.2;
    out.bigGenome8 = aBig > 6.8 && aBig < 9.2;
    out.bigTakesMoreTrips = aBig > aSmall + 3 && tripOdds(big.id, big.period).trips > tripOdds(tiny.id, tiny.period).trips + 4;
    out.genomeVaries = (() => { const ns = []; for(let n = 0; n < 40; n++){ delete sc.dna[big.id]; let k = 0; while(!genomeDone(big.id) && k < 60){ tripReturns({sp:big.id, period:big.period}); k++; } ns.push(k); } return Math.min(...ns) < Math.max(...ns); })();

    // cloning: time depends on size and the upgrades, and runs on minutes
    sc.dna[small.id] = {genome:100, quality:90}; hireScientist("gene");
    const base = cloneMinutes(small.id);
    out.cloneTimed = base === Math.round((1 + small.space / CLONE_DAYS_PER_SPACE) * DAY_MIN);
    state.rating = 5; state.minute = OPEN_MIN + 60;
    out.cloneOrder = orderClone(small.id, null) && sc.clones.length === 1;
    out.incubatorCount = incubators() === 1;
    sc.tech.push("incub1", "fast1");
    out.upgradesApply = incubators() === 2 && Math.abs(cloneMinutes(small.id) - base * TAR_UPGRADE.speed) <= 1;
    out.secondLane = (() => { const before = nowMin(); orderClone(small.id, null); return sc.clones[1].lane === 1 && sc.clones[1].start <= before + 1; })();
    out.cloneFinishes = adv(base + 5, () => sc.ready.length >= 1);
    sc.tar = null;

    // CERES: needs a botanist, flora unlocked, and complete plant DNA from GHOST; then it grows planting stock in its beds
    out.noBotanist = growProblem("flora", "mesozoic") === "Hire a botanist at CERES to tend a growing bed.";
    hireScientist("botanist");
    out.floraLocked = /ORACLE/.test(growProblem("flora", "mesozoic"));
    sc.tech.push("paleoflora", "mesoplant", "medmeso");
    out.floraNeedsDna = /plant DNA/.test(growProblem("flora", "mesozoic")) && !ceresRate();
    sc.dna[PLANT_DNA.mesozoic.id] = {genome:50, quality:80};
    out.halfDnaNotEnough = !!growProblem("flora", "mesozoic");
    sc.dna[PLANT_DNA.mesozoic.id] = {genome:100, quality:80};
    out.floraGrows = growProblem("flora", "mesozoic") === null && ceresRate() > 0;
    const ex = {id:"e-fl", name:"Fl", points:[[300,200],[340,200],[340,240],[300,240]], animals:[], happy:70, cond:100};
    out.replantNeedsStock = /planting stock/.test(replantProblem(ex, "mesozoic"));
    state.minute = OPEN_MIN + 60;
    growBatch("flora", "mesozoic");
    out.bedBusy = state.ceres.beds.length === 1 && !state.ceres.plants.mesozoic;
    out.batchTakesTime = adv(60) === false && !state.ceres.plants.mesozoic;
    out.batchDone = adv(growMinutes("flora", "mesozoic"), () => state.ceres.plants.mesozoic === 1);
    out.replantNeedsTwoBatches = batchesFor(ex) === 2 && /planting stock/.test(replantProblem(ex, "mesozoic"));
    state.ceres.plants.mesozoic = 2;
    out.replantWithStock = replantProblem(ex, "mesozoic") === null;
    state.ceres.plants.mesozoic = 0;
    // medicine comes from batches, not a steady trickle
    state.ceres.meds = 0; state.minute = OPEN_MIN + 60;
    out.medNoTrickle = (adv(30), state.ceres.meds === 0);
    out.medGrows = growBatch("med", "mesozoic") && adv(growMinutes("med", "mesozoic") + 5, () => state.ceres.meds >= 20);
    state.ceres.auto.mesozoic = true; state.ceres.meds = 0;
    out.autoRestocks = adv(growMinutes("med", "mesozoic") * 2 + 10, () => state.ceres.meds >= 20);
    state.ceres.auto.mesozoic = false;

    // medicine only cures a period's animals once refined for it
    sc.tech.push("medceno");
    const jur = SPECIES.find(x => x.period === "Jurassic");
    out.unrefinedCantTreat = !canTreat(jur);
    sc.tech.push("ref-Jurassic");
    out.refinedTreats = canTreat(jur) && !canTreat(SPECIES.find(x => x.period === "Triassic"));
    sc.points = 100;
    out.refineNeedsEra = projectProblem("refine", "Permian") === "Research Paleozoic medicine first.";
    out.refineOk = projectProblem("refine", "Cretaceous") === null;

    // saves from before timed science keep their unlocked periods, trips, and clones
    const oldS = JSON.parse(JSON.stringify(newPark()));
    oldS.day = 6; oldS.starters = ["arth"]; oldS.science.unlocked = ["Cretaceous"]; delete oldS.science.projects;
    oldS.science.trips = [{period:"Jurassic", sp:"dryo", back:7}]; oldS.science.clones = [{id:"c1", sp:"lyst", exhibitId:null, q:90, lane:0, done:8}];
    oldS.science.tech = ["paleoflora", "mesoplant", "medmeso"]; delete oldS.science.crew.botanist; delete oldS.ceres;
    oldS.buildings.push({id:"b-c", type:"ceres", points:rectPts(180, 290, 26, 18, H)});
    const up = upgradeSave(oldS);
    out.oldUnlocksAnimals = up.science.unlocked.includes("trex") && up.science.unlocked.every(id => SPECIES_BY_ID[id]) && !up.science.unlocked.includes("arth");
    out.oldTripEnds = up.science.trips[0].end === 7 * DAY_MIN && up.science.trips[0].back === undefined;
    out.oldCloneEnds = up.science.clones[0].end === 8 * DAY_MIN && up.science.clones[0].done === undefined;
    out.oldKeepsFlora = up.science.dna[PLANT_DNA.mesozoic.id].genome === 100 && up.science.crew.botanist === 1 && up.ceres.auto.mesozoic === true && up.science.tech.includes("ref-Jurassic");

    // landscaping: ponds and rocks inside open exhibits
    const keepEx = state.exhibits, keepBld = state.buildings, keepMoney = state.money; state.money = 1e6; state.buildings = [];
    const lx = {id:"e-land", name:"Land test", points:[[100,100],[160,100],[160,160],[100,160]], animals:[], happy:70, cond:100, land:[]};
    state.exhibits = [lx];
    const fish = SPECIES.find(s => !s.viv && s.diet.includes("piscivore"));
    lx.animals = [{id:"a-l1", sp:fish.id, q:90}];
    out.landMenu = !!document.querySelector('[data-tool="land-pond"]');
    setTool("land-pond"); out.landTool = tool === "land-pond" && $("#drawbar").classList.contains("on"); setTool("select");
    out.landRejectsOutside = !landSpot(10, 10, "pond").ok && !landSpot(103, 130, "pond").ok;
    const dryTarget = exhibitReport(lx).target, dryIll = illChance(lx, lx.animals[0]).p;
    out.landDryFlagged = thirsty(lx, fish) && exhibitReport(lx).issues.some(i => i.bad && /Dry/.test(i.text)) && illChance(lx, lx.animals[0]).why.includes("no water");
    const spot = landSpot(130, 130, "pond");
    out.landAcceptsInside = spot.ok && spot.e === lx;
    placeLand(lx, "pond", 130, 130);
    out.landOverlapRejected = !landSpot(133, 130, "pond").ok;
    out.landPondHelps = !thirsty(lx, fish) && exhibitReport(lx).target > dryTarget && illChance(lx, lx.animals[0]).p < dryIll;
    state.money = 100; out.landNeedsMoney = /Costs/.test(landSpot(140, 110, "boulder").why || ""); state.money = 1e6;
    placeLand(lx, "rock", 110, 150);
    // ponds and rocks ride along when the exhibit moves
    const mv = startMove(lx, "exhibit", {clientX:0, clientY:0}); moveBy(mv, 10, 5);
    out.landMoves = lx.land[0].x === 140 && lx.land[0].y === 135 && lx.points[0][0] === 110;
    moveBy(mv, 0, 0);
    // an outline that would leave one outside the fence is refused
    const orig = lx.points.map(p => p.slice()); lx.points[1] = [105, 100];
    out.landReshapeGuard = /outside the fence/.test(reshapeProblem(lx, orig) || ""); lx.points = orig;
    // bulldozing one refunds part of its price
    const f0 = lx.land[1], n0 = lx.land.length;
    out.landRefund = refundFor("land", f0) === Math.round(LAND[f0.type].price * COST.refundShare) && landRefund(lx) > 0;
    removeItem("land", f0);
    out.landBulldoze = lx.land.length === n0 - 1 && !lx.land.includes(f0);
    state.exhibits = keepEx; state.buildings = keepBld; state.money = keepMoney;
    // old saves get an empty list for open exhibits only
    const oldL = JSON.parse(JSON.stringify(newPark()));
    oldL.exhibits.push({id:"e-old", name:"Old", points:[[1,1],[2,1],[2,2]], animals:[], happy:70}, {id:"e-oldv", name:"OldV", points:[[1,1],[2,1],[2,2]], animals:[], happy:70, viv:"S"});
    const upl = upgradeSave(oldL);
    out.oldGetsLand = upl.exhibits.find(e => e.id === "e-old").land.length === 0 && upl.exhibits.find(e => e.id === "e-oldv").land === undefined;

    // planted Paleo-Flora: groves need research and CERES planting stock, keep old grazers off grass, feed them, and make them happier
    const keepTech = [...sc.tech], keepPlants = {...state.ceres.plants}, keepFeed = state.staff.feedFrom;
    state.money = 1e6; state.buildings = []; state.staff.feedFrom = 0;
    const gx = {id:"e-grove", name:"Grove test", points:[[100,100],[160,100],[160,160],[100,160]], animals:[], happy:70, cond:100, land:[], flora:"cenozoic"};
    state.exhibits = [gx];
    const grazer = SPECIES.find(s => !s.viv && foodType(s) === "paleoflora" && GRASS_INTOLERANT.includes(s.period) && ERA_OF[s.period] === "mesozoic");
    gx.animals = [1, 2, 3].map(i => ({id:"a-g" + i, sp:grazer.id, q:90}));
    sc.tech = sc.tech.filter(t => t !== "mesoplant"); state.ceres.plants.mesozoic = 0;
    out.groveNeedsTech = /Research/.test(landSpot(115, 115, "cycads").why || "");
    sc.tech.push("mesoplant");
    out.groveNeedsStock = /planting stock/.test(landSpot(115, 115, "cycads").why || "");
    out.treesNeedNoStock = landSpot(115, 115, "trees").ok;
    const grassyBefore = grassyFloor(gx) && grassSick(gx, grazer), groveTarget = exhibitReport(gx).target;
    state.ceres.plants.mesozoic = 3;
    for(const [x, y] of [[115, 115], [135, 115], [115, 135]]) placeLand(gx, "cycads", x, y);
    out.groveUsesStock = state.ceres.plants.mesozoic === 0 && gx.land.length === 3;
    out.grovesStopGrass = grassyBefore && !grassyFloor(gx) && !grassSick(gx, grazer);
    out.grovesHappier = exhibitReport(gx).target > groveTarget && exhibitReport(gx).issues.some(i => /own era/.test(i.text));
    // browsing: the stock drains slower, but keepers are still needed
    const pn = dailyNeed(gx).paleoflora, share = browseShare(gx, "paleoflora", pn);
    gx.stock = {paleoflora:100}; eatTick(60); const withGroves = 100 - gx.stock.paleoflora;
    const kept = gx.land; gx.land = []; gx.stock = {paleoflora:100}; eatTick(60); const without = 100 - gx.stock.paleoflora; gx.land = kept;
    out.grovesBrowse = share > 0 && share <= HAB.browseMax && withGroves < without && Math.abs(withGroves - without * (1 - share)) < 1e-6;
    out.treesFeedPlantsOnly = browseRate(gx, "plants") === 0 && browseRate(gx, "paleoflora") === 3 * LAND.cycads.browse;
    sc.tech = keepTech; state.ceres.plants = keepPlants; state.staff.feedFrom = keepFeed;
    state.exhibits = keepEx; state.buildings = keepBld; state.money = keepMoney;

    // weather: tomorrow's forecast comes true, animals without cover suffer, shelters and groves help
    const keepW = {...state.weather}, rnd = Math.random;
    const nw = newPark().weather;
    out.weatherStartsFair = nw.today === "fair" && nw.next === "fair" && nw.from === WEATHER.startDay;
    state.weather = {today:"fair", next:"storm", from:0};
    Math.random = () => .999; rollWeather();
    out.forecastComesTrue = state.weather.today === "storm" && state.weather.next === "storm";
    state.weather.from = state.day + 10; rollWeather(); Math.random = rnd;
    out.fairBeforeStart = state.weather.next === "fair";
    state.money = 1e6; state.buildings = [];
    const wxSp = SPECIES.find(s => !s.viv && s.space >= 100 && !COLD_HARDY.includes(s.id) && !s.predator);
    const wx = {id:"e-wx", name:"Weather test", points:[[100,100],[160,100],[160,160],[100,160]], animals:[1, 2, 3].map(i => ({id:"a-w" + i, sp:wxSp.id, q:90})), happy:70, cond:100, land:[]};
    state.exhibits = [wx];
    const at = (k, f) => { state.weather.today = k; return f(); };
    out.stormExposes = at("storm", () => exposure(wx) === 1 && exhibitReport(wx).issues.some(i => i.bad && /Storm/.test(i.text)));
    out.stormHurts = at("storm", () => exhibitReport(wx).target) < at("fair", () => exhibitReport(wx).target)
      && at("storm", () => illChance(wx, wx.animals[0]).p) > at("fair", () => illChance(wx, wx.animals[0]).p)
      && at("storm", () => injuryChance(wx, wx.animals[0]).p) > at("fair", () => injuryChance(wx, wx.animals[0]).p)
      && Math.abs(at("storm", () => wearPerDay(wx)) - at("fair", () => wearPerDay(wx)) * WEATHER.kinds.storm.wear) < 1e-9;
    placeLand(wx, "trees", 115, 145);
    out.grovesShadeOnlyWhenHot = at("hot", () => exposure(wx)) < 1 && at("cold", () => exposure(wx)) === 1;
    placeLand(wx, "shelter", 130, 120);
    out.shelterCovers = coverOf(wx).shelter >= at("cold", () => coverOf(wx).need) && at("cold", () => exposure(wx)) === 0 && at("storm", () => exhibitReport(wx).issues.some(i => /Sheltered/.test(i.text)));
    const hardy = SPECIES_BY_ID[COLD_HARDY.find(id => SPECIES_BY_ID[id] && !SPECIES_BY_ID[id].viv)];
    const hx = {...wx, id:"e-hx", land:[], animals:[{id:"a-h", sp:hardy.id, q:90}]};
    out.coldHardy = at("cold", () => exposure(hx)) === 0 && at("storm", () => exposure(hx)) === 1;
    // an exhibit beside the entrance walk, so guests want to come
    state.exhibits = [{...wx, id:"e-wx2", points:[[206.5,240],[246,240],[246,280],[206.5,280]], land:[]}];
    const d1 = at("fair", () => (recompute(), derived.demand)), d2 = at("storm", () => (recompute(), derived.demand));
    out.stormFewerGuests = d1 > 0 && Math.abs(d2 - d1 * WEATHER.kinds.storm.guests) < 1e-6;
    state.exhibits = keepEx; state.buildings = keepBld; state.money = keepMoney;
    state.weather = keepW; recompute();
    const oldW = JSON.parse(JSON.stringify(newPark())); delete oldW.weather; oldW.day = 20;
    out.oldGetsWeather = upgradeSave(oldW).weather.from === 23 && oldW.weather.today === "fair";
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
