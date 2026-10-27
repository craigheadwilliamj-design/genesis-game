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
  page.on("pageerror", e => errors.push(String(e.stack||e)));
  // Google Fonts can't load in sandboxes; ignore network errors for it
  page.on("console", m => { if(m.type() === "error" && !/ERR_CERT|net::/.test(m.text())) errors.push(m.text()); });
  await page.goto("file://" + path.resolve(__dirname, "../index.html"));
  await page.waitForTimeout(400);

  const checks = await page.evaluate(() => {
    const out = {};
    // start screen: shown first, no Continue without a save, a new park picks its biome, and nothing changes it mid-park
    const q = x => document.querySelector(x), sb = state.biome;
    out.startScreenShown = q("#dlgStart").open && q("#startContinue").hidden && /PALEO-PARK TYCOON/.test(document.title) && /PALEO-PARK TYCOON/.test(q("#dlgStart").textContent);
    q("#startNew").click();
    const pickK = Object.keys(BIOMES).find(k => k !== DEFAULT_PARK_BIOME);
    q(`#startBiomes [data-biome="${pickK}"]`).click(); q("#startName").value = "Smoke Park"; q("#startGo").click();
    out.newParkPicksBiome = !q("#dlgStart").open && state.biome === pickK && parkBiome() === pickK && state.name === "Smoke Park" && sb === DEFAULT_PARK_BIOME;
    q("#introGo").click(); setSpeed(0);
    out.biomeLockedMidPark = !q("#menuBiomes") && !q("#dlgMenu") && !q("#panel [data-biome]");
    q("#startBiomes").innerHTML = `<button data-biome="${DEFAULT_PARK_BIOME}"></button>`; q("#startBiomes button").click();
    out.biomeLockedMidPark = out.biomeLockedMidPark && state.biome === pickK;
    state.biome = DEFAULT_PARK_BIOME;
    // guests get a neutral personality unless a test says otherwise (real ones are random), and nobody sneaks in
    PERSONALITIES.neutral = {label:"Neutral", color:"#888", weight:0, text:"", fx:{}, n:{}};
    window.realRollPers = rollPers; rollPers = () => ["neutral", "neutral"]; PERS.hooligan.sneak = 0;
    const sp = SPECIES.find(s => !s.viv && !s.pool);

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
    const keepB = state.buildings, keepA = state.staff.atvs, wasDev = localStorage.getItem("genesis-dev"); localStorage.setItem("genesis-dev", "1");
    state.buildings = [{id:"dep1", type:"depot"}, {id:"dep2", type:"depot"}]; state.staff.atvs = [];
    syncAtvs(); const two = atvs().length === 2 * VEHICLES.perDepot;
    state.buildings = [{id:"dep1", type:"depot"}]; syncAtvs(); const one = atvs().length === VEHICLES.perDepot && atvs().every(a => a.depot === "dep1");
    out.atvPerDepot = two && one;
    // launch build: no ATVs spawn, loaded depots stay (and wear), nobody drives
    localStorage.removeItem("genesis-dev"); state.buildings = [{id:"dep1", type:"depot"}]; state.staff.atvs = [{id:"a-x", depot:"dep1", at:null, by:null}];
    syncAtvs(); const fake = {riding:true, atvId:"a-x", route:[{}], at:{svc:new Set()}}; fake.at.svc.add(fake.route[0]);
    out.atvOffLaunch = atvs().length === 0 && usableAtvs().length === 0 && !onAtv(fake) && depots().length === 1 && buildingHidden("depot") && techHidden("vehicles") && !techRows("build").includes(esc(TECH.find(x => x.id === "vehicles").label)) && startProject("tech", "vehicles") !== null;
    localStorage.setItem("genesis-dev", "1"); syncAtvs();
    out.atvOnDev = atvs().length === VEHICLES.perDepot && !buildingHidden("depot") && !techHidden("vehicles");
    if(wasDev === null) localStorage.removeItem("genesis-dev"); else localStorage.setItem("genesis-dev", wasDev);
    state.buildings = keepB; state.staff.atvs = keepA;

    // every new park sells one species from pool A, two from pool B and one mid-tier anchor from pool C
    let starterOk = true; const seenA = new Set(), seenC = new Set();
    for(let i = 0; i < 60; i++){
      const st = pickStarters(), a = st.filter(id => STARTER_POOLS.a.ids.includes(id)), b = st.filter(id => STARTER_POOLS.b.ids.includes(id)), c = st.filter(id => STARTER_POOLS.c.ids.includes(id));
      starterOk = starterOk && st.length === 4 && a.length === 1 && b.length === 2 && c.length === 1 && new Set(st).size === 4; seenA.add(a[0]); seenC.add(c[0]);
    }
    out.starterPools = starterOk && seenA.size > 1 && seenC.size > 1;
    // the old slanted plot becomes the grid-aligned rectangle; new parks start with it
    const oldPlot = JSON.parse(JSON.stringify(state)); oldPlot.boundary = OLD_PLOT.map(p => p.slice());
    out.plotRectangle = JSON.stringify(upgradeSave(oldPlot).boundary) === JSON.stringify(PARK_PLOT) && JSON.stringify(newPark().boundary) === JSON.stringify(PARK_PLOT) &&
      PARK_PLOT.every(([x, y]) => x % 5 === 0 && y % 5 === 0);
    // land for sale: only plots touching owned land sell, buying pays and extends where you can build
    {
      const m0 = state.money, keep = state.parcels.slice(); state.money = 1e6; state.parcels = [];
      const far = [0, 0], east = PARCEL_CELLS.find(([i, j]) => parcelRect(i, j)[0] === 420 && parcelRect(i, j)[1] === 100), farE = PARCEL_CELLS.find(([i, j]) => parcelRect(i, j)[0] === 560 && parcelRect(i, j)[1] === 100);
      const before = insidePlot([[430,150],[440,150]]), lockedWhy = parcelProblem(farE[0], farE[1]), p = parcelPrice(east[0], east[1]), mm = state.money;
      const bought = buyParcel(east[0], east[1]);
      out.landBuy = !before && !!lockedWhy && bought && state.money === mm - p && p > 0 && insidePlot([[430,150],[440,150]]) && insidePlot([[400,150],[450,150],[450,190]], true) && !insidePlot([[400,150],[600,150]]) && !parcelProblem(farE[0], farE[1]) === true &&
        JSON.stringify(upgradeSave({...JSON.parse(JSON.stringify(state)), parcels:undefined}).parcels) === "[]";
      state.parcels = keep; state.money = m0;
    }
    // S33: nothing for sale south of the entrance, a hard southern barrier, a rising price per plot, old saves keep their land
    {
      const m0 = state.money, keep = state.parcels.slice(); state.money = 1e9;
      const south = PARCEL_CELLS.filter(([i, j]) => parcelRect(i, j)[3] > state.gate[1]);
      state.parcels = PARCEL_CELLS.filter(([i, j]) => !parcelSouth(i, j)).map(([i, j]) => parcelId(i, j)).slice(0, 5);
      out.noSouthParcels = south.length > 0 && SALE_CELLS.every(([i, j]) => parcelRect(i, j)[3] <= state.gate[1]) && PARCELS.ys[PARCELS.ys.length-1] === state.gate[1] &&
        south.every(([i, j]) => !!parcelProblem(i, j) && !buyParcel(i, j) && !parcelTouches(i, j));
      out.southBarrier = !insidePlot([[100,200],[100,310]]) && !insidePlot([[100,306],[120,306]]) && insidePlot([[100,200],[100,305]]) &&
        !!pathProblem([[200,290],[200,320]], "path") && !!decorProblem(Object.keys(LAND).find(k => k.startsWith("q-")), 200, 312) ;
      out.southEdgeWall = ownedEdges().every(([p, q]) => p[1] <= state.gate[1] && q[1] <= state.gate[1]);
      state.parcels = [];
      // no cap: buy past 15 plots, each costing more than the same plot would with fewer owned
      for(let pass = 0; pass < 20 && state.parcels.length < 16; pass++) for(const [i, j] of SALE_CELLS) if(state.parcels.length < 16 && !ownsParcel(i, j) && !parcelProblem(i, j)) buyParcel(i, j);
      const next = SALE_CELLS.find(([i, j]) => !ownsParcel(i, j) && parcelTouches(i, j)), pHigh = next ? parcelPrice(next[0], next[1]) : 0, kept = state.parcels; state.parcels = [];
      const pLow = next ? parcelPrice(next[0], next[1]) : 0; state.parcels = kept;
      out.parcelCap = state.parcels.length === 16 && !!next && pHigh > pLow && !parcelProblem(next[0], next[1]);
      // an old save that owns south land keeps it
      state.parcels = [parcelId(2, 7), parcelId(2, 8)];
      const old = upgradeSave(JSON.parse(JSON.stringify(state)));
      out.oldSouthSave = old.parcels.length === 2 && ownsParcel(2, 7) && ownsParcel(2, 8) && insidePlot([[100,320],[100,350]]) && !ownedEdges().some(([p, q]) => p[1] > 505);
      state.parcels = keep; state.money = m0;
    }
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

    // leftover Paleoflora goes back to the Botany Lab at night
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
    state.buildings.push({id:"b-st", type:"station", points:rectPts(198, 290, 14, 10, H)});
    state.buildings.push({id:"b-pmc", type:"pmc", points:rectPts(215, 255, 20, 14, H)});
    const viv = {id:"e-v", name:"Bug house", viv:"L", points:rectPts(198, 255, 16, 10, H), animals:[{id:"a-s", sp:"arth"}, {id:"a-t", sp:"arth"}], happy:70};
    state.exhibits.push(viv);
    recompute(); buildKeeperGraph();
    out.pmcOnGraph = !!kGraph.anchors["b-pmc"] && !!kGraph.anchors["e-v"];
    state.staff.keepers.push({id:"k-1", name:"K", stamina:100});
    hireVet();
    state.science.tech.push("medpaleo"); state.buildings.find(b => b.id === "b-pmc").store = {medpal:10};
    viv.animals[0].sick = {kind:"infection", name:"cordyceps", sev:60};   // serious: has to go to the PMC
    const run = (mins, until) => { for(let i = 0; i < mins; i++){ state.minute = DAWN_MIN + 60; tick(1); if(until()) return true; } return false; };
    const pmcB = state.buildings.find(b => b.id === "b-pmc");
    out.sickToWard = run(600, () => state.health.ward.length === 1);
    // admitted with its course paid up front, on a timer: severity times the rate, faster on the era's own medicine
    const pt = state.health.ward[0];
    out.wardDosesUpFront = !!pt && pt.dosed && pt.med === "era" && pmcStock("medpal") === 10 - HEALTH.dose && Math.abs(pt.need - 60 * HEALTH.wardPerPoint * MEDICINE.eraWard) < 1e-9 && !viv.animals.includes(pt.a);
    out.wardTimerRuns = run(Math.ceil(pt.need) + 5, () => pt.recovered) && !pt.a.sick;
    // recovered, it goes home like a delivery
    out.curedGoesHome = run(600, () => viv.animals.length === 2 && !state.health.ward.length) && !viv.animals.some(a => a.sick);
    // a recovered patient holds its bed until it's picked up
    { const rp = {a:{id:"a-rp", sp:"arth"}, home:"e-v", recovered:true, dosed:true, done:1, need:1}; state.health.ward.push(rp);
      const t = {id:"tr-rp", animalId:"a-rp", sp:"arth", from:"b-pmc", to:"e-v", lab:true, ward:true}; state.staff.transfers.push(t);
      const held = bedsFree() === wardBeds() - 1 && patientStatus(rp) === "Recovered. Waiting for pickup.";
      const got = pickUp(t); out.bedFreesAtPickup = held && got === rp.a && !state.health.ward.length && bedsFree() === wardBeds();
      state.staff.transfers = state.staff.transfers.filter(x => x !== t); }

    // a check-up finds a hidden mild illness, and the vet treats it on the spot (no dart, no PMC)
    vetsNight(); keepersNight();
    viv.vetCheck = state.day - HEALTH.checkEvery;
    fallSick(viv.animals[1], "cordyceps");
    out.mildStartsHidden = !!viv.animals[1].sick.hidden;
    const meds0 = pmcStock("medpal");
    out.checkupTreatsOnSpot = run(300, () => !viv.animals[1].sick) && viv.vetCheck === state.day && pmcStock("medpal") === meds0 - SICK_KIND.infection.fieldDose &&
      !state.health.ward.length && !state.staff.transfers.length && viv.animals.length === 2;
    // serious injuries go to the PMC
    vetsNight(); keepersNight();
    viv.animals[1].sick = {kind:"injury", name:"laceration", sev:50};
    out.injuryGoesToWard = run(600, () => state.health.ward.length === 1);
    state.health.ward = []; viv.animals.push({id:"a-t", sp:"arth"}); vetsNight(); keepersNight();

    // no doses: admitted anyway and waits; the course starts when medicine comes in, on contemporary medicine slower the older the animal; no vet on staff pauses it
    { pmcB.store = {medpal:0, medmod:0};
      const toastKeep = events.toast, said = []; events.toast = t => said.push(t);
      const w = {id:"a-w", sp:"arth", sick:{kind:"infection", name:"cordyceps", sev:50}};
      admit(w, {from:"e-v"}); const wp = state.health.ward.find(p => p.a === w);
      out.wardWaitsForDoses = !wp.dosed && patientStatus(wp) === "Waiting for doses." && said.includes("The PMC is out of medicine.");
      wardTick(30); out.wardNoProgressUndosed = wp.done === 0 && said.filter(t => t === "The PMC is out of medicine.").length === 1;
      state.science.tech = state.science.tech.filter(t => t !== "medpaleo"); pmcB.store = {medpal:0, medmod:MODERN.stock};
      wardTick(1); out.dockMedSlower = wp.dosed && wp.med === "modern" && Math.abs(wp.need - 50 * HEALTH.wardPerPoint * MEDICINE.dockWard.paleozoic) < 1e-9 && pmcStock(CMED) === MODERN.stock - HEALTH.dose;
      const vets = state.staff.vets; state.staff.vets = []; const d0 = wp.done; wardTick(60);
      out.wardPausesNoVets = wp.done === d0 && patientStatus(wp) === "Paused. No vets."; state.staff.vets = vets;
      out.modernRestock = dockOrders({type:"dock", auto:true}).medmod === MODERN.stock && unitPrice(CMED) === MODERN.cost;
      // the PMC is bulldozed mid-course: the patient goes home as much better as it got, and the bought beds are lost
      wp.done = wp.need / 2; state.health.beds = 4; const sevNow = w.sick.sev;
      const inv = viv.animals.length; pmcRemoved(pmcB);
      out.pmcRemovedPartialCredit = viv.animals.length === inv + 1 && Math.abs(w.sick.sev - sevNow / 2) < 1e-9 && !state.health.ward.length && wardBeds() === HEALTH.beds;
      viv.animals = viv.animals.filter(a => a !== w);
      events.toast = toastKeep;
      state.science.tech.push("medpaleo"); pmcB.store = {medpal:10}; }
    // beds: start at 2, each bought one costs more and adds upkeep, at most 6
    { const m0 = state.money, p0 = bedPrice();
      out.bedsStart = wardBeds() === HEALTH.beds && p0 === HEALTH.bedPrice && bedUpkeep() === 0;
      out.bedsBuy = buyBed() === null && wardBeds() === 3 && state.money === m0 - p0 && bedPrice() === Math.round(HEALTH.bedPrice * HEALTH.bedGrowth) && bedUpkeep() === HEALTH.bedUpkeep;
      while(wardBeds() < HEALTH.bedsMax) buyBed();
      out.bedsMax = !!buyBed() && wardBeds() === HEALTH.bedsMax;
      state.health.beds = HEALTH.beds;
      // the PMC panel: the ward with each patient's progress, and a bed to buy
      const pp = {a:{id:"a-pp", name:"ARTH-099", sp:"arth", sick:{kind:"infection", name:"cordyceps", sev:40}}, home:"e-v", cond:"cordyceps", med:"era", dosed:true, done:120, need:360};
      state.health.ward.push(pp); const ph = pmcHtml(pmcB); state.health.ward = state.health.ward.filter(x => x !== pp);
      out.pmcPanel = ph.includes(`Ward (1 of ${HEALTH.beds} beds)`) && ph.includes(`Buy bed (${money(HEALTH.bedPrice)}, +${money(HEALTH.bedUpkeep)} a day)`) && ph.includes("Cordyceps · from Bug house") && /Treating, .+ left\./.test(ph) && ph.includes("width:33%"); }
    // medicated feed: prevention, from whatever medicine the PMC holds (contemporary will do)
    { const techKeep = [...state.science.tech]; state.science.tech = state.science.tech.filter(t => !Object.values(MED_TECH).includes(t)); pmcB.store = {medmod:10};
      viv.medFeed = true; viv.hungryMin = 0; const a0 = viv.animals[0]; delete a0.sick; const p0 = illChance(viv, a0).p;
      healthNight();
      out.medFeedAnyMedicine = viv.medFedOk && pmcStock(CMED) === 10 - feedDoses(viv) && Math.abs(illChance(viv, a0).p - p0 * MEDICINE.feedCut) < 1e-12;
      viv.medFeed = false; viv.medFedOk = false; state.science.tech = techKeep; pmcB.store = {medpal:10}; }
    // vets: a poisoning comes first, deliveries come last
    { vetsNight(); keepersNight();
      const c = vcrew[0]; c.at = kGraph.anchors["b-pmc"];
      viv.animals[0].sick = {kind:"infection", name:"cordyceps", sev:30}; viv.animals[1].sick = {kind:"poison", name:"gasbubble", sev:20};
      out.poisonFirst = pickPatient(c).a === viv.animals[1];
      const lab = {id:"tr-lab", animalId:"sp-x", sp:"arth", from:"b-pmc", to:"e-v", lab:true};
      state.staff.transfers.push(lab); vetDecide(c);
      out.deliveriesLast = !!c.patient && !c.move;
      state.staff.transfers = state.staff.transfers.filter(t => t !== lab); delete viv.animals[0].sick; delete viv.animals[1].sick; vetsNight(); }
    // old saves: a patient being treated starts a fresh course, a cured one waits to go home, and the ward has a bed for everyone
    { const old = JSON.parse(JSON.stringify(state)); delete old.health.beds;
      old.health.ward = [0, 1, 2].map(i => ({a:{id:"ow" + i, sp:"arth", sick:{kind:"illness", sev:40}}, home:"e-v", med:"modern", since:1}));
      old.health.ward[2].cured = true; delete old.health.ward[2].a.sick;
      old.staff.transfers.push({id:"tr-old", animalId:"ow2", sp:"arth", from:"b-pmc", to:"e-v", med:true});
      const up = upgradeSave(old), uw = up.health.ward;
      out.oldWardConverts = up.health.beds === 3 && uw[0].dosed && uw[0].done === 0 && Math.abs(uw[0].need - 40 * HEALTH.wardPerPoint * MEDICINE.dockWard.paleozoic) < 1e-9
        && uw[2].recovered && !uw[2].cured && !up.staff.transfers.some(t => t.id === "tr-old"); }
    // genetic disorders: a clone may be born with one, likelier the lower its Accuracy, and none at 95% or more
    { const rr = Math.random; Math.random = () => 0;
      out.disorderRoll = rollDisorder(60) && rollDisorder(94) && !rollDisorder(95) && !rollDisorder(100);
      Math.random = () => .59; const lowGets = !!rollDisorder(60), midGets = !!rollDisorder(80); Math.random = rr;
      out.disorderLikelierLow = lowGets && !midGets && Math.abs(DISORDER_ROLL.most * Math.pow((95 - 80) / 35, 1.5) - .1683) < .001; }
    // each disorder does its thing, diagnosed or not
    { const ga = viv.animals[0]; delete ga.sick; const base = illChance(viv, ga).p, hurt0 = injuryChance(viv, ga).p;
      ga.dis = "immune"; out.immuneIllMore = Math.abs(illChance(viv, ga).p - base * 2) < 1e-12;
      ga.dis = "osteo"; out.osteoHurtMore = Math.abs(injuryChance(viv, ga).p - hurt0 * 1.5) < 1e-12;
      delete ga.dis; }
    // genome therapy: a vet's own trip to an exhibit that has it switched on; it cures a diagnosed disorder by bringing Genome Quality up to the lab's genome, and Accuracy stays
    vetsNight(); keepersNight();
    const ga = viv.animals[0]; delete ga.sick; ga.q = 70; ga.gq = 70; ga.dis = "cardiac";
    state.science.dna.arth = {genome:80};
    out.geneNeedsTech = !!geneProblem();
    state.science.tech.push("genetherapy");
    out.geneGain = geneGain(ga) === 10 && geneCost(10) === GENE.base + 10 * GENE.perPoint;
    viv.geneTherapy = true;
    out.geneNeedsDiagnosis = geneTargets(viv).length === 0;
    viv.vetCheck = state.day - HEALTH.checkEvery;
    out.checkupDiagnoses = run(300, () => ga.dx) && diagnosed(ga) && checkWork(viv) === HEALTH.checkMinutes;
    state.science.dna.arth.genome = 70; out.geneNoBetterGenome = geneTargets(viv).length === 0;
    state.science.dna.arth.genome = 80;
    out.geneQueues = !geneProblem() && geneTargets(viv).includes(ga);
    const med0 = state.today.medicine;
    out.geneVetDoesIt = run(600, () => !ga.dis) && ga.gq === 80 && ga.q === 70 && !ga.dx && state.today.medicine - med0 >= geneCost(10);
    viv.geneTherapy = false;
    // the genetic record travels with the animal, and old saves turn DNA quality into Accuracy
    { const g = geneFields({q:70, gq:75, dis:"neuro", dx:true}), g2 = geneFields({});
      out.geneFieldsCopy = g.q === 70 && g.gq === 75 && g.dis === "neuro" && g.dx === true && g2.q === 100 && g2.gq === 100 && !("dis" in g2);
      const old = JSON.parse(JSON.stringify(state)); delete old.accV;
      old.exhibits.push({id:"e-acc", name:"Acc", points:[[0,0],[9,0],[9,9],[0,9]], animals:[{id:"q1", sp:"arth", q:70, cl:true}, {id:"q2", sp:"arth"}, {id:"q3", sp:"arth", q:40, cl:true}]});
      const ua = upgradeSave(old).exhibits.find(x => x.id === "e-acc").animals;
      out.oldDnaToAccuracy = ua[0].q === 80 && ua[0].gq === 80 && ua[1].q === 100 && ua[2].q === 60 && !ua.some(x => x.dis); }
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
    viv.hungryMin = DAY_MIN; viv.dirt = 90;
    out.neglectRaisesIllness = illChance(viv, a).p > base * 4;
    // rivals of a territorial species hurt each other, more when cramped
    const pen = {id:"e-r", name:"Rex", points:[[0,0],[40,0],[40,40],[0,40]], animals:[{id:"r1", sp:"trex"}, {id:"r2", sp:"trex"}]};
    state.exhibits.push(pen); recompute();
    out.territorialInjury = injuryChance(pen, pen.animals[0]).p > HEALTH.territorial;
    state.exhibits.pop(); recompute();
    Math.random = realRandom;

    // conditions: every species can be hurt, and bodies decide who gets what
    { const S = SPECIES_BY_ID, can = (sp, id) => canGet(S[sp], CONDITIONS[id]);
      out.everyoneCanBeHurt = SPECIES.every(s => Object.values(CONDITIONS).some(c => c.kind === "injury" && !c.only && canGet(s, c)));
      out.everyConditionHasABody = Object.values(CONDITIONS).every(c => SPECIES.some(s => canGet(s, c)) && SICK_KIND[c.kind]);
      out.tiktaalikIsAFish = can("tikt", "whitespot") && can("tikt", "fintear") && !can("tikt", "tetanus") && !can("tikt", "pneumonia");
      out.swimmersGetBasics = can("mosa", "gastro") && can("mosa", "pneumonia") && !can("mosa", "whitespot") && !can("mosa", "tb") && can("basi", "tb") && !can("basi", "lice");
      out.restrictedIllnesses = can("trex", "avianflu") && can("dipl", "avianflu") && !can("tric", "avianflu") && can("mglo", "fmd") && !can("mamm", "fmd") && can("smil", "lice") && !can("trex", "lice")
        && can("came", "chitino") && can("anom", "chitino") && can("opab", "whitespot") && !can("olen", "whitespot") && can("arth", "cordyceps") && !can("ptry", "cordyceps") && can("dunk", "nitrate") && !can("mosa", "nitrate");
      out.bodyRules = !can("tita", "sprain") && can("mosa", "fracture") && !can("mosa", "sprain") && !can("dodo", "tooth") && can("trex", "tooth") && !can("dunk", "concussion") && can("dunk", "fintear") && !can("olen", "fracture");
      let gores = 0, dodoGore = 0;
      for(let i = 0; i < 300; i++){ if(pickCondition(S.trex, ["injury"], ["fight"]) === "gore") gores++; if(pickCondition(S.tric, ["injury"], ["fight", "gore"]) === "gore") dodoGore++; }
      out.goringNeedsAGorer = gores === 0 && dodoGore > 0 && pickCondition(S.trex, ["injury"], ["fight"]) !== null;
      out.causePicksName = ["water", "water", "water"].every(c => ["gastro", "whitespot", "flukes", "saprolegniasis", "nitrate", "gasbubble"].includes(pickCondition(S.dunk, ["infection", "poison"], [c])))
        && ["whitespot", "chitino"].includes(pickCondition(S.anom, ["infection"], [])) && pickCondition(S.trex, ["infection"], ["trash"]) !== "foreign";
      out.fallSickShape = (() => { const t = {sp:"trex"}; fallSick(t, "pneumonia", "dirt"); const ok1 = t.sick.kind === "infection" && t.sick.sev === SICK_KIND.infection.start && t.sick.hidden && sickName(t) === "Pneumonia";
        fallSick(t, "laceration"); return ok1 && !t.sick.hidden && t.sick.kind === "injury" && sickBand(t).label === "Mild" && (t.sick.sev = 50, sickBand(t).label === "Serious") && (t.sick.sev = 80, sickBand(t).label === "Critical"); })(); }

    // through the day: sick animals worsen a little each step, a darted one holds, a mild injury mends in a well-kept exhibit, a hidden case shows once it's bad
    { const realR = Math.random; Math.random = () => .99;
      const toasts = [], died = [], tK = events.toast, dK = events.died; events.toast = text => toasts.push({text}); events.died = d => died.push(d);
      const pe = {id:"e-hs", name:"Step", points:[[0,0],[40,0],[40,40],[0,40]], animals:[{id:"h1", sp:"tric"}, {id:"h2", sp:"tric"}, {id:"h3", sp:"tric", need:{...freshNeeds(), stress:0}}, {id:"h4", sp:"tric"}], dirt:0};
      state.exhibits.push(pe); recompute();
      const [h1, h2, h3, h4] = pe.animals;
      fallSick(h1, "pneumonia", null, 30); fallSick(h2, "pneumonia", null, 30); h2.darted = true; fallSick(h3, "sprain", null, 20); fallSick(h4, "pneumonia", null, 39);
      const t0 = toasts.length; healthStep(.25);
      out.stepWorsens = Math.abs(h1.sick.sev - (30 + SICK_KIND.infection.worsen * .25)) < 1e-9 && h2.sick.sev === 30;
      out.mildInjuryMends = Math.abs(h3.sick.sev - (20 - HEALTH.heal * .25)) < 1e-9;
      out.hiddenShowsWhenBad = !h4.sick.hidden && toasts.slice(t0).some(t => /is showing signs of Pneumonia/.test(t.text));
      pe.dirt = 90; const s3 = h3.sick.sev; healthStep(.25); out.dirtyInjuryWorsens = h3.sick.sev > s3;
      h1.sick.sev = 74.9; healthStep(.25); out.criticalWarnsOnce = h1.sick.warned && toasts.filter(t => /is critical/.test(t.text)).length === 1 && (healthStep(.01), toasts.filter(t => /is critical/.test(t.text)).length === 1);
      h1.sick.sev = 99.99; died.length = 0; healthStep(.25); out.deathNamesCondition = !pe.animals.includes(h1) && died.length === 1 && died[0].cause === "Pneumonia";
      // dirt is what mostly makes animals ill, and the risk says so
      pe.dirt = 0; const clean = illChance(pe, h2).p; pe.dirt = 90; const dirty = illChance(pe, h2);
      out.dirtDrivesIllness = dirty.p > clean * 4 && dirty.why.includes("dirt") && pickCause({dirt:1}) === "dirt";
      // bumblefoot: dirty ground or the wrong biome, for the bodies that get it
      const pf = {id:"e-bf", name:"Feet", points:[[0,0],[40,0],[40,40],[0,40]], animals:[{id:"f1", sp:"velo"}, {id:"f2", sp:"tric"}], dirt:90};
      out.bumblefootGround = injuryChance(pf, pf.animals[0]).why.includes("dirt") && !injuryChance(pf, pf.animals[1]).why.includes("dirt");
      Math.random = realR; events.toast = tK; events.died = dK;
      state.exhibits = state.exhibits.filter(x => x !== pe); recompute(); }

    // old saves: illnesses, trash cases and injuries all become a condition, and a chronic case is just a case
    { const old = JSON.parse(JSON.stringify(state));
      old.exhibits.push({id:"e-old", name:"Old", points:[[0,0],[20,0],[20,20],[0,20]], animals:[
        {id:"o1", sp:"trex", sick:{kind:"illness", sev:30}}, {id:"o2", sp:"trex", sick:{kind:"illness", sev:50, cause:"trash"}},
        {id:"o3", sp:"trex", sick:{kind:"injury", sev:20, hit:{by:"Allosaurus", how:"fight"}}}, {id:"o4", sp:"anom", sick:{kind:"illness", sev:10, chronic:true}}]});
      const up = upgradeSave(old), oa = up.exhibits.find(x => x.id === "e-old").animals;
      out.oldSicknessConverts = CONDITIONS[oa[0].sick.name].kind === "infection" && oa[0].sick.sev === 30 && oa[1].sick.name === "foreign" && oa[1].sick.kind === "poison"
        && CONDITIONS[oa[2].sick.name].from.includes("fight") && oa[2].sick.kind === "injury" && !oa[3].sick.chronic && !!CONDITIONS[oa[3].sick.name] && oa[3].sick.kind === CONDITIONS[oa[3].sick.name].kind; }
    { const was = localStorage.getItem("genesis-dev"); localStorage.removeItem("genesis-dev");
      out.rosterHidesHerr = !speciesAvailable("herr") && speciesAvailable("trex") && !siteShown(SITE_BY_ID.ischigualasto) && siteShown(SITE_BY_ID.hellcreek);
      out.rosterHidesStatue = !document.getElementById("sideMenu") || (buildMenu(), !document.querySelector('#sideMenu [data-tool="land-st-prot"]'));
      localStorage.setItem("genesis-dev", "1"); out.devShowsHerr = speciesAvailable("herr") && siteShown(SITE_BY_ID.ischigualasto);
      if(was === null) localStorage.removeItem("genesis-dev"); else localStorage.setItem("genesis-dev", was); }
    { const was = localStorage.getItem("genesis-dev"), th = {theme:"volcanic"}, themed = THEMES.volcanic ? "volcanic" : Object.keys(THEMES).find(k => k !== "genesis");
      const pen = state.exhibits[0] || {id:"e-t", name:"T", points:[[0,0],[30,0],[30,30],[0,30]], animals:[{id:"t1", sp:"trex"}]};
      const real = state.exhibits.includes(pen), had = pen.enrich;
      if(!real){ state.exhibits.push(pen); recompute(); }
      const me = state.exhibits.includes(pen) && pen.animals.length && !pen.viv ? pen : null;
      localStorage.removeItem("genesis-dev");
      const html = () => [typeof themesOverview === "function" ? themesOverview() : "", themeHtml("exhibit", {theme:themed, points:[]}), zoneThemeHtml({theme:themed, points:[]})].join("");
      out.themesHiddenOff = themeKey({theme:themed}) === "genesis" && html() === "" && themeFor("path", {points:[[0,0],[1,1]]}) === null;
      out.toysHiddenOff = toyHidden("post") && toyHidden("hay") && !toyHidden("vbark") && !toyHidden("vmist") && !toyHidden("pbale") && !toyHidden("barn");
      buildMenu(); out.toyMenuHiddenOff = !document.querySelector('#sideMenu [data-tool="land-post"]') && !!document.querySelector('#sideMenu [data-tool="land-pbale"]');
      out.enrichFullOff = !me || enrichment(me) === 1;
      { const vv = {id:"e-vv", name:"V", viv:"S", points:[[0,0],[10,0],[10,10],[0,10]], animals:[{id:"vv1", sp:"coel"}, {id:"vv2", sp:"coel"}], land:[]};
        const bareHtml = vivToysHtml(vv), bareE = enrichment(vv);
        out.vivToysShownOff = bareHtml.includes("Enrichment") && bareHtml.includes("vivToySel") && bareHtml.includes("Misters") && !!vivToyProblem(vv, "vbark") === false;
        out.vivBareNotHarshOff = bareE >= ENRICH.vivBase && bareE < 1;
        vv.land = [{id:"vt1", type:"vbark", x:3, y:3}, {id:"vt2", type:"vmist", x:6, y:6}];
        out.vivToysCountOff = toyPoints(vv) > 0 && enrichment(vv) > bareE; }
      { const op = {id:"e-op", name:"O", points:[[0,0],[40,0],[40,40],[0,40]], animals:[{id:"o1", sp:"coel"}], land:[]};
        out.openFullNoToysOff = enrichment(op) === 1 && toyHidden("post"); }
      localStorage.setItem("genesis-dev", "1");
      out.themesShownOn = themeKey({theme:themed}) === themed && themeHtml("exhibit", {theme:themed, points:[]}).includes("themeSel");
      out.toysShownOn = !toyHidden("post") && !toyHidden("vbark");
      { const vv = {id:"e-vv", name:"V", viv:"S", points:[[0,0],[10,0],[10,10],[0,10]], animals:[{id:"vv1", sp:"coel"}], land:[]}; out.vivDevUnchangedOn = vivToysHtml(vv).includes("vivToySel") && enrichment(vv) < ENRICH.vivBase + ENRICH.room + ENRICH.habitat; }
      buildMenu(); out.toyMenuShownOn = !!document.querySelector('#sideMenu [data-tool="land-post"]');
      if(!real) { state.exhibits.pop(); recompute(); }
      if(was === null) localStorage.removeItem("genesis-dev"); else localStorage.setItem("genesis-dev", was);
      buildMenu(); }
    { const was = localStorage.getItem("genesis-dev"), menuHas = t => !!document.querySelector(`#sideMenu [data-tool="${t}"]`);
      const held = ["campground", "lodge", "resort", "edcenter", "tramstop", "tram"], techs = ["hotels", "transit", "education", "edtouch"];
      localStorage.removeItem("genesis-dev"); buildMenu();
      out.v1HidesMenuOff = held.every(t => !menuHas(t)) && menuHas("restroom") && menuHas("path");
      out.v1HidesTechOff = techs.every(id => techHidden(id) && !techRows("build").includes(`data-id="${id}"`) && !techRows("build").includes(esc(TECH.find(x => x.id === id).label))) && techRows("build").includes(esc(TECH.find(x => x.id === "security").label));
      out.v1HidesGoalsOff = ["camp", "hotel", "resort"].every(id => !activeGoals().some(g => g.id === id)) && activeGoals().length === GOALS.length - 3;
      out.v1HidesStatuesOff = !document.querySelector('#sideMenu [data-open="statues"]') && GOALS.filter(g => g.statue).every(g => !/statue/i.test(grantPrize(g)) && !grantStatue(g)) && Object.keys(LAND).filter(k => LAND[k].statue).every(k => !statueOpen(k) && decorProblem(k, 0, 0) === "Statues aren't available yet.");
      out.v1BlocksTechOff = startProject("tech", "education") !== null && pathProblem([[0,0],[10,0]], "tram") !== null && buildingHidden("lodge");
      localStorage.setItem("genesis-dev", "1"); buildMenu();
      out.v1ShowsMenuOn = held.every(menuHas);
      out.v1ShowsTechOn = techs.every(id => !techHidden(id)) && techRows("build").includes(esc(TECH.find(x => x.id === "hotels").label));
      out.v1ShowsGoalsOn = activeGoals().length === GOALS.length;
      out.v1ShowsStatuesOn = !!document.querySelector('#sideMenu [data-open="statues"]') && GOALS.filter(g => g.statue).every(g => grantPrize(g).includes("statue")) && statueOpen("st-owen") !== undefined;
      out.v1AllowsTramOn = pathProblem([[0,0],[10,0]], "tram") !== "That isn't available yet." && !buildingHidden("edcenter");
      if(was === null) localStorage.removeItem("genesis-dev"); else localStorage.setItem("genesis-dev", was);
      buildMenu(); }
    out.devModeOffByDefault = devMode() === false && !("dev" in state) && !JSON.stringify(state).includes("genesis-dev");
    return out;
  }));


  // Logistics: dock orders, stores, spoilage, hauling, zones, production
  Object.assign(checks, await page.evaluate(() => {
    const out = {};
    startWith(newPark(), false); setSpeed(0);
    const realRandom = Math.random; Math.random = () => .99;
    state.money = 1e6; state.day = 20; state.staff.feedFrom = 0; state.safety.escapesFrom = 99; state.health.from = 999;
    const H = Math.PI / 2;
    state.buildings.push({id:"b-st", type:"station", points:rectPts(198, 290, 14, 10, H)});
    state.buildings.push({id:"b-dock", type:"dock", points:rectPts(198, 268, 16, 10, H)});
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
    const run = (mins, until) => { for(let i = 0; i < mins; i++){ state.minute = DAWN_MIN + 60; tick(1); if(until()) return true; } return false; };
    viv.stock = {};
    // a vivarium is fed from dishes: give the case two (six animals, VIV_DISH.perDish each)
    const giveDishes = (e, n) => { const [cx, cy] = centroid(e.points); e.land = (e.land || []).filter(f => !LAND[f.type].tray); for(let i = 0; i < n; i++) e.land.push({id:uid("l-"), type:"vdish", x:cx - 2 + i * 4, y:cy, cap:VIV_DISH.cap[e.viv], food:{}}); };
    giveDishes(viv, 2);
    out.keeperFeeds = run(900, () => trayFood(viv, "paleoflora") + trayFood(viv, "plants") >= 1);
    out.foodLeftDock = stockOf(dock, "plants") < 12;
    dock.store = {plants:60};
    for(const f of viv.land) f.food = {plants:trayCap(f)};   // full dishes: keepers have nothing to bring
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
    giveDishes(far, 1); for(const f of viv.land) f.food = {};
    recompute(); buildKeeperGraph(); viv.stock = {}; far.stock = {};
    const jobsFor = z => shortages(z ? {zone:z} : null).map(j => j.e.id);
    out.zonedKeepersStay = jobsFor("z-1").includes("e-v") && !jobsFor("z-1").includes("e-far") && jobsFor(null).includes("e-far");
    dropZone("z-1"); state.zones = [];
    out.zoneDropClears = !viv.zone && !st.zone;
    state.exhibits = state.exhibits.filter(e => e !== far);

    // a keeper with nothing else to do cleans a dirty exhibit, even with no shovels
    state.staff.keepers = [{id:"k-1", name:"K", stamina:100}]; crew = []; syncCrew();
    for(const f of viv.land) f.food = {plants:trayCap(f)};   // full dishes: keepers have nothing to bring viv.dirt = 80;
    out.cleansBareHanded = run(900, () => viv.dirt < 60) && !hasUpgrade("shovels");
    keepersNight();

    // mechanics and vets in a zone only work their own zone
    const f1 = {id:"f1", name:"F1", points:[[0,0],[9,0],[9,9]], animals:[{id:"q1", sp:"arth"}], cond:60, zone:"z-9", inspected:{day:1, cond:60}};
    const f2 = {id:"f2", name:"F2", points:[[50,0],[59,0],[59,9]], animals:[{id:"q2", sp:"arth"}], cond:5, inspected:{day:1, cond:5}};
    state.exhibits.push(f1, f2); state.zones.push({id:"z-9", name:"Z", color:"#fff", points:[[0,0],[1,0],[1,1]]});
    kGraph.anchors["fix:f1"] = kGraph.anchors["fix:f2"] = kGraph.anchors.f1 = kGraph.anchors.f2 = kGraph.anchors["b-st"];
    state.staff.mechanics = [{id:"mz", name:"Z", zone:"z-9"}, {id:"mf", name:"F"}];
    out.mechanicZone = pickFence({id:"mz"}) === f1 && pickFence({id:"mf"}).zone === undefined;
    // a fence nobody can walk to doesn't stall the crew: they take the next job they can reach
    kGraph.anchors["fix:f2"] = {k:"iso", x:0, y:0, adj:new Map(), svc:new Set()};
    out.mechanicSkipsUnreachable = pickFence({id:"mf", at:kGraph.anchors["b-st"]}) === f1;
    kGraph.anchors["fix:f2"] = kGraph.anchors["b-st"];
    state.health.from = 0; vcrew = [];
    state.staff.vets = [{id:"vz", name:"Z", zone:"z-9"}, {id:"vf", name:"F"}];
    out.vetZone = pickCheck({id:"vz"}) === f1 && !!pickCheck({id:"vf"});
    setZone("mechanic", "mf", "z-9"); setZone("vet", "vf", "z-9");
    out.assignStaff = state.staff.mechanics[1].zone === "z-9" && zoneMembers(state.zones[0]).vets.length === 2;
    dropZone("z-9");
    out.dropClearsStaff = !state.staff.mechanics.some(m => m.zone) && !state.staff.vets.some(v => v.zone);
    state.exhibits = state.exhibits.filter(e => e !== f1 && e !== f2); state.zones = []; state.staff.mechanics = []; state.staff.vets = [];
    // two roads ending a meter apart count as joined, and staff and guests can walk across the gap
    {
      const keepP = state.paths, [gx, gy] = state.gate;
      state.paths = [{id:"pj1", points:[[gx, gy], [gx, gy - 30]]}, {id:"pj2", points:[[gx, gy - 31], [gx + 40, gy - 31]]}];
      recompute(); buildKeeperGraph(); buildGuestGraph();
      const far = g => [...g.nodes.values()].find(n => n.x === gx + 40), from = g => [...g.nodes.values()].find(n => n.x === gx && n.y === gy);
      out.nearEndsJoin = derived.joinedAll.has("pj2") && walkFrom(from(kGraph), null).dist.has(far(kGraph)) && walkFrom(from(gGraph), null).dist.has(far(gGraph));
      state.paths = keepP; recompute(); buildKeeperGraph(); buildGuestGraph();
    }

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
    const farm = {id:"b-farm", type:"farm", points:rectPts(198, 245, 20, 14, H)};
    state.buildings.push(farm); recompute();
    logiTick(DAY_MIN);
    out.farmMakes = Math.round(stockOf(farm, "plants")) === BUILDINGS.farm.makes.plants;
    logiTick(10 * (DAY_MIN));
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
    state.paths.push({id:"p-k1", points:[[207.5,235],[100,235],[100,120],[300,120],[300,235],[207.5,235]]});
    state.paths.push({id:"s-k1", type:"service", points:[[207.5,235],[207.5,140]]});
    state.paths.push({id:"s-k2", type:"service", points:[[207.5,140],[207.5,60],[380,60]]});
    const ex = (id, pts, sp, n, gate) => state.exhibits.push({id, name:id, points:pts, gate, animals:Array.from({length:n}, (_, i) => ({id:id + i, sp})), happy:80, cond:100, stock:{}});
    ex("e-k1", [[104,124],[204,124],[204,231],[104,231]], "lyst", 4, [204,180]);
    ex("e-k2", [[206,124],[296,124],[296,231],[206,231]], "dime", 2, [206,180]);
    const B = (id, type, x, y) => state.buildings.push({id, type, points:rectPts(x, y, BUILDINGS[type].w, BUILDINGS[type].d, 0)});
    B("b-kst", "station", 214, 265); B("b-kdock", "dock", 380, 67); B("b-kbr", "breakroom", 199, 265);
    afterChange();
    const dock = buildingById("b-kdock"), st = buildingById("b-kst");
    out.dockLayout = ["b-kst", "b-kdock", "b-kbr", "e-k1", "e-k2"].every(id => !!kGraph.anchors[id]);
    dock.store = {plants:100, meat:100};
    state.staff.keepers.push({id:"k-d", name:"D", stamina:100}); syncCrew();
    const day = state.day, keeperSpeed = KEEPER.speed; KEEPER.speed = WALK_PER_MIN; // this layout is a long haul; test the route, not the pace
    while(state.day === day && !(state.exhibits[1].stock.meat > 0)) tick(1);
    KEEPER.speed = keeperSpeed;
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
    state.minute = DAWN_MIN; let fed = false;
    for(let i = 0; i < 300 && !fed; i++){ tick(1); fed = state.exhibits[1].stock.meat > 0; }
    out.carryDeliveredNextDay = fed;

    // Call keeper: the keeper drops a feed run, walks to the exhibit and mucks it out; unreachable exhibits are refused
    { const e2 = state.exhibits[1]; c.route = []; c.wait = 0; c.plan = null; c.haul = null; c.job = "idle"; c.at = kGraph.anchors["b-kdock"]; setCarry(c, null); k.stamina = 100; e2.dirt = 12; state.staff.calls = [];
      out.callKeeper = callKeeper(e2) === null && state.staff.calls.length === 1 && state.staff.calls[0].keeper === c.id && callKeeper(e2) === null && state.staff.calls.length === 1;
      let n = 0; while(state.staff.calls.length && n++ < 400) keepersTick(1);
      out.callKeeperArrives = !state.staff.calls.length && c.focusEx === e2.id && (c.job === "mucking" || (e2.dirt || 0) <= 2);
      n = 0; while(c.job === "mucking" && n++ < 600) keepersTick(1);
      out.callKeeperMucks = (e2.dirt || 0) <= 2;
      c.focusEx = null; c.job = "idle"; c.route = []; c.cleanId = null; e2.dirt = 0; state.staff.calls = [];
      // Call vet and Call mechanic: both go to the exhibit and check it, and each can be asked for separately
      const keepV = state.staff.vets, keepM = state.staff.mechanics, fixA = kGraph.anchors["fix:" + e2.id];
      kGraph.anchors["fix:" + e2.id] = kGraph.anchors[e2.id];
      state.staff.vets = [{id:"vT", name:"Dr. T"}]; state.staff.mechanics = [{id:"mT", name:"T"}]; syncVets(); syncMechanics();
      vcrew[0].at = kGraph.anchors["b-kdock"]; mcrew[0].at = kGraph.anchors["b-kdock"]; e2.vetCheck = -1; e2.inspected = null;
      out.callNoStaff = (state.staff.vets = [], typeof callKeeper(e2, "vet") === "string") && (state.staff.vets = [{id:"vT", name:"Dr. T"}], true);
      out.callVetMech = callKeeper(e2, "vet") === null && callKeeper(e2, "mech") === null && state.staff.calls.length === 2 && state.staff.calls.every(x => x.keeper);
      n = 0; while(state.staff.calls.length && n++ < 600){ vetsTick(1); mechanicsTick(1); }
      for(let i = 0; i < 60; i++){ vetsTick(1); mechanicsTick(1); }
      out.callVetChecks = e2.vetCheck === state.day;
      out.callMechInspects = !!e2.inspected && e2.inspected.day === state.day;
      state.staff.vets = keepV; state.staff.mechanics = keepM; syncVets(); syncMechanics(); kGraph.anchors["fix:" + e2.id] = fixA; state.staff.calls = [];
    }

    // food trays: a keeper with food left over walks inside the fence and fills them, and animals eat from them first
    { const e2 = state.exhibits[1], money0 = state.money; state.money = 1e6; e2.land = []; placeLand(e2, "traymd", 250, 180); placeLand(e2, "traysm", 270, 200);
      const tr0 = e2.land[0], tr1 = e2.land[1]; tr0.id = "l-tray0"; tr1.id = "l-tray1"; e2.stock = {meat:storeMax(e2, "meat")}; k.stamina = 100;
      out.trayCaps = trayCap(tr0) === 30 && trayCap(tr1) === 12 && trayRoom(e2) === 42;
      c.route = []; c.wait = 0; c.haul = null; c.at = kGraph.anchors["e-k2"]; setCarry(c, {type:"meat", amount:35}); c.plan = {exhibitId:e2.id}; c.job = "toExhibit"; arrive(c, k);
      out.trayKeeperEnters = c.job === "filling" && !!fillPos(c);
      let n = 0; while(c.job === "filling" && n++ < 200) keepersTick(1);
      out.trayFilled = c.job !== "filling" && Math.abs(trayFood(e2, "meat") - 35) < .01 && !c.carry && (tr0.food.meat || 0) === 30 && (tr1.food.meat || 0) === 5;
      // a tray with meat in it takes no fish until it's empty
      out.trayOneFood = trayRoomOf(tr0, "fish") === 0 && trayRoomOf(tr1, "fish") === 0 && trayRoomOf(tr1, "meat") === 7; delete tr0.food.meat; out.trayEmptyTakesAny = trayRoomOf(tr0, "fish") === 30; tr0.food.meat = 30;
      const before = trayFood(e2, "meat"), stock0 = e2.stock.meat; eatTick(30);
      out.trayEatenFirst = trayFood(e2, "meat") < before && e2.stock.meat === stock0;
      // a tray set to fish takes no meat, and unset-tray room is split by diet
      tr0.food = {}; tr0.set = "fish"; out.traySet = trayRoomOf(tr0, "meat") === 0 && trayRoomOf(tr0, "fish") === 30 && trayShare(e2, "meat") === trayRoomOf(tr1, "meat"); tr0.set = null;
      propsTabs.sub = "trays"; exTabs.ex = e2.id; exTabs.tab = "props"; const th = exhibitHtml(e2); out.trayTab = /data-key="traysm"/.test(th) && /data-tray="l-tray0"/.test(th) && !/data-key="barn"/.test(th); propsTabs.sub = "shelters"; exTabs.tab = "main";
      state.money = money0; e2.land = []; }
    // a station full of one food doesn't send keepers to fetch another it has no room for
    for(const x of crew){ x.haul = null; setCarry(x, null); }
    st.store = {plants:storeCap(st)};
    const near = list => list.length ? {b:list[0]} : null;
    const h = pickHaul(null, near, CUSTODIAN_GOODS, custCarry());
    out.fullStoreNoHaul = !h || h.d !== st;
    // lab deliveries: a finished specimen goes to the nearest free keeper, custodian or vet, who carries the crate from the lab to the exhibit
    {
      const keepSp = state.science.specimens, keepTr = state.staff.transfers, keepKp = state.staff.keepers, keepVt = state.staff.vets, keepCu = state.staff.custodians, spd = [KEEPER.speed, VET.speed, CUSTODIAN.speed];
      KEEPER.speed = VET.speed = CUSTODIAN.speed = WALK_PER_MIN;
      B("b-tar", "tar", 214, 285); afterChange();
      state.science.specimens = []; state.staff.transfers = [];
      const e2 = state.exhibits[1], spec = id => { state.science.specimens.push(nameAnimal({id, sp:"dime", sex:"male", q:90})); return id; };
      const run = (tickFn, id, crew1) => { let saw = false, n = 0; while(n++ < 900 && !e2.animals.some(a => a.id === id)){ tickFn(1); saw = saw || !!crew1.crate; } return saw; };
      state.staff.vets = []; state.staff.custodians = []; state.staff.keepers = [{id:"k-d", name:"D", stamina:100}]; syncCrew(); syncVets(); syncCustodians();
      const kc = crew[0]; kc.at = kGraph.anchors["b-kst"]; kc.route = []; kc.job = "idle"; kc.wait = 0; kc.carry = null; kc.cargo = null; kc.move = null;
      const okKeeper = !deliverSpecimen(spec("sp-k"), "e-k2") && specimenDelivery("sp-k").keeper === "k-d" && /Waiting|on the way/.test(specimensHtml() + "on the way");
      const sawK = run(keepersTick, "sp-k", kc);
      const keeperDone = okKeeper && sawK && !specimens().length && !state.staff.transfers.length && !kc.crate && !kc.cargo;
      state.staff.keepers = []; syncCrew(); state.staff.vets = [{id:"v-t", name:"VT"}]; syncVets();
      const vc = vcrew[0]; vc.at = kGraph.anchors["b-kst"]; vc.route = []; vc.job = "idle"; vc.wait = 0;
      const vetTook = !deliverSpecimen(spec("sp-v"), "e-k2") && specimenDelivery("sp-v").keeper === "v-t";
      const sawV = run(vetsTick, "sp-v", vc);
      const vetDone = vetTook && sawV && !specimens().length && !state.staff.transfers.length && !vc.crate;
      state.staff.vets = []; syncVets(); state.staff.custodians = [{id:"c-t", name:"CT"}]; syncCustodians();
      const cc = ccrew[0]; cc.at = kGraph.anchors["b-kst"]; cc.route = []; cc.job = "idle"; cc.wait = 0;
      const custTook = !deliverSpecimen(spec("sp-c"), "e-k2") && specimenDelivery("sp-c").keeper === "c-t";
      const sawC = run(custodiansTick, "sp-c", cc);
      const custDone = custTook && sawC && !specimens().length && !state.staff.transfers.length && !cc.crate;
      // nobody free: it waits, and Cancel calls it off
      state.staff.custodians = []; syncCustodians(); spec("sp-n");
      const queued = !deliverSpecimen("sp-n", "e-k2") && specimenDelivery("sp-n") && !specimenDelivery("sp-n").keeper && /Waiting for staff/.test(specimensHtml());
      cancelDelivery("sp-n");
      const cancelled = queued && !specimenDelivery("sp-n") && specimens().length === 1 && /specMove/.test(specimensHtml());
      const refused = deliverSpecimen("sp-n", "e-k1") === "Can't live here." || !!deliverSpecimen("sp-n", "e-none");
      out.labDelivery = keeperDone && vetDone && custDone && cancelled && refused;
      state.science.specimens = keepSp; state.staff.transfers = keepTr; state.staff.keepers = keepKp; state.staff.vets = keepVt; state.staff.custodians = keepCu;
      [KEEPER.speed, VET.speed, CUSTODIAN.speed] = spd; state.buildings = state.buildings.filter(b => b.id !== "b-tar"); afterChange(); syncCrew(); syncVets(); syncCustodians();
    }
    Math.random = realRandom;
    return out;
  }));

  // Guests: parties walk to food and restrooms, pay where they're served, and their mood sets guest comfort
  Object.assign(checks, await page.evaluate(() => {
    const out = {};
    startWith(newPark(), false); setSpeed(0);
    state.money = 1e6; state.staff.feedFrom = 999; state.safety.escapesFrom = 999; state.health.from = 999;
    state.paths.push({id:"p-loop", points:[[207.5,235],[100,235],[100,120],[300,120],[300,235],[207.5,235]]});
    const ex = (id, pts, sp, n) => state.exhibits.push({id, name:id, points:pts, animals:Array.from({length:n}, (_, i) => ({id:id + i, sp})), happy:80, cond:100});
    ex("e-g1", [[104,124],[180,124],[180,231],[104,231]], "lyst", 4);
    ex("e-g2", [[220,124],[296,124],[296,231],[220,231]], "dryo", 4);
    const B = (id, type, x, y) => state.buildings.push({id, type, points:rectPts(x, y, BUILDINGS[type].w, BUILDINGS[type].d, 0)});
    B("b-f", "food", 92, 150); B("b-r", "restroom", 305, 150); B("b-s", "shop", 240, 242);
    // a new stand is an empty shell until it has a menu
    afterChange();
    out.emptyShellServesNothing = !servesOf(buildingById("b-f")).length;
    addToMenu(buildingById("b-f"), "burger"); addToMenu(buildingById("b-f"), "soda"); addToMenu(buildingById("b-f"), "water"); addToMenu(buildingById("b-s"), "plush");
    out.menuSlotsLimit = !!addToMenu(buildingById("b-f"), "coffee");
    out.guestStops = ["b-f", "b-r", "b-s", "e-g1", "e-g2", "gate"].every(id => !!gGraph.anchors[id]);
    // a party's route to a stop matches a plain walk there
    const f = guestField("b-f"), w = walkFrom(gGraph.anchors.gate, null, new Set());
    out.guestField = Math.abs(f.dist.get(gGraph.anchors.gate) - w.dist.get(gGraph.anchors["b-f"])) < 1e-6;

    // a thirsty party walks to the food stand, pays, and stops being thirsty
    state.minute = DAWN_MIN + 60; const t0 = state.today.tickets;
    guestsArrive(2); const p = parties[0];
    out.ticketPaid = state.today.tickets - t0 === state.ticket * 2;
    p.needs = {hunger:10, thirst:70, bladder:0, energy:0}; p.until = DUSK_MIN; p.spd = 1.15;   // a quick walker, so one soda is enough when it gets there
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
    p.home = false; p.mood = 70; p.until = DUSK_MIN; planParty(p);
    out.noFoodThought = p.thought.has("noFood");
    state.buildings.push(fs); afterChange();
    // going home: the party walks out the gate and its mood counts
    p.needs.energy = 0; p.mood = 70;
    const before = state.today.moodN; goHome(p);
    out.partyLeaves = run(600, () => p.gone) && !parties.includes(p) && state.today.moodN === before + 2;

    // no curfew: a party whose stay isn't done is still in the park after 10 PM, and carries over the day's turn
    resetParties(); state.minute = minuteAtClock(21 * 60 + 30); guestsArrive(2); const np = parties[0];
    np.until = state.minute + 300; np.mood = 90; np.needs = {hunger:0, thirst:0, bladder:0, energy:0};
    const late = minuteAtClock(22 * 60) + 5;
    for(; state.minute < late; state.minute++){ derived.demand = 0; guestsTick(state.minute, state.minute + 1); np.mood = 90; np.needs = {hunger:0, thirst:0, bladder:0, energy:0}; }
    out.guestStaysPastCurfew = parties.includes(np) && !np.home && !np.gone && np.until > state.minute;
    const u0 = np.until; shiftStamps(DAY_MIN);
    out.guestStaysOverRollover = np.until === u0 - DAY_MIN && !np.home;
    state.minute = minuteAtClock(22.5 * 60); const sl = GUEST.stay.map(x => x / GUEST.pace);
    out.stayUncapped = Array.from({length:30}, () => newParty(2).until - state.minute).every(d => d >= sl[0] - 1e-6 && d <= sl[1] + 1e-6);

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

    // deaths alone never end the game; only debt does (and not in sandbox)
    resetParties(); guestsArrive(3); const v2 = parties[0];
    const money0 = state.money, over0 = state.over; state.money = 10 * ESCAPE.lawsuit; state.safety.deaths = 9;
    state.safety.loose = [{id:"l-y", sp:"trex", status:"loose", at:null, x:v2.at.x, y:v2.at.y}];
    Math.random = () => 0; harmGuests(1); Math.random = rr;
    out.deathsDontEndGame = state.safety.deaths === 10 && !state.over;
    state.safety.loose = []; state.safety.deaths = 0;
    const goCount = []; const og = events.gameOver; events.gameOver = () => goCount.push(1);
    state.sandbox = true; state.money = -BANKRUPT * 2; checkBankrupt();
    out.sandboxNoBankrupt = !state.over && !goCount.length;
    state.sandbox = false; state.money = -BANKRUPT * .6; checkBankrupt();
    out.debtWarnsOnce = state.debtWarned === true && !state.over;
    state.money = -BANKRUPT - 1; checkBankrupt();
    out.debtBankrupts = state.over === true && goCount.length === 1;
    events.gameOver = og; state.over = over0; state.money = money0; state.debtWarned = false;
    // sandbox keeps money pinned, through ticks, spending and earning (the HUD Bank readout used to flicker)
    { const sb0 = state.sandbox, t0 = state.today; state.sandbox = true; state.money = SANDBOX_MONEY; const led0 = state.today.built || 0;
      let pinned = true;
      for(let i = 0; i < 5; i++){ tick(1); pinned = pinned && state.money === SANDBOX_MONEY; }
      spend(5000, "built"); pinned = pinned && state.money === SANDBOX_MONEY;
      earn(700, "tickets"); pinned = pinned && state.money === SANDBOX_MONEY;
      out.sandboxMoneyPinned = pinned && state.today.built === led0 + 5000;
      state.sandbox = sb0; state.money = money0; }

    // a full day: guests come, go, and leave a mood behind for the rating
    resetParties(); state.minute = DAWN_MIN; state.today = freshLedger(); state.guestLog = freshGuestLog();
    // every party plans the shortest stay, so the early ones are sure to leave before the rollover (a random stay could keep them all in till tomorrow)
    const day = state.day, stay0 = GUEST.stay; GUEST.stay = [stay0[0], stay0[0]];
    while(state.day === day) tick(2);
    GUEST.stay = stay0;
    const h = state.history[state.history.length - 1];
    out.dayOfGuests = h.guests > 5 && state.guestLog.mood > 20 && state.guestLog.last.guests + guestCount() === h.guests && state.guestLog.last.guests > 0;   // some left during the day; the rest are still in the park, since the day turns over at the rollover hour and nobody is sent home at closing
    out.comfortFromMood = derived.parts.find(x => x.label === "Guest comfort").score === clamp((state.guestLog.mood - GUEST.badMood) / (GUEST.goodMood - GUEST.badMood), 0, 1);

    // a tired party sits on a bench, and gets up rested
    const bench = {id:"b-bench", type:"bench", points:rectPts(96.8, 200, BUILDINGS.bench.w, BUILDINGS.bench.d, Math.PI / 2)};
    state.buildings.push(bench); afterChange();
    resetParties(); state.minute = DAWN_MIN + 60; guestsArrive(2); const tp1 = parties[0];
    tp1.needs = {hunger:0, thirst:0, bladder:0, energy:75}; tp1.until = DUSK_MIN;
    out.benchRests = !!gGraph.anchors["b-bench"] && run(400, () => tp1.needs.energy < 5) && bench.served && bench.served.n === 2;

    // trash goes in a bin nearby; a nearly full bin spills the rest; a full one gets walked past; the night crew clears it all, for a fee
    const bin = {id:"b-bin", type:"bin", points:rectPts(96.7, 180, BUILDINGS.bin.w, BUILDINGS.bin.d, Math.PI / 2)};
    state.buildings.push(bin); afterChange();
    state.litter = {};
    tp1.at = nearestGuestNode(100, 180); tp1.trash = 3; tp1.trashAt = state.minute; trashCheck(tp1);
    out.binCatchesTrash = bin.fill === 3 && !tp1.trash && litterTotal() === 0;
    bin.fill = LITTER.binCap - 1; tp1.trash = 3; trashCheck(tp1);
    out.fullBinSpills = litterTotal() === 2 && bin.fill === LITTER.binCap && !tp1.trash;
    tp1.trash = 2; tp1.trashAt = state.minute; trashCheck(tp1);
    out.fullBinSkipped = tp1.trash === 2 && litterTotal() === 2 && bin.fill === LITTER.binCap;
    // a donation box beside the path takes a little money from a passing party (once each), more from one that learned something
    const dbox = {id:"b-dbox", type:"donate", points:rectPts(103.3, 180, BUILDINGS.donate.w, BUILDINGS.donate.d, Math.PI / 2)};
    state.buildings.push(dbox); afterChange();
    tp1.at = nearestGuestNode(100, 180); tp1.gave = null; tp1.edu = 60;
    const dn0 = state.today.donations, rr3 = Math.random; Math.random = () => 0; boxCheck(tp1); const dn1 = state.today.donations; boxCheck(tp1); Math.random = rr3;
    out.donationBox = dn1 > dn0 && state.today.donations === dn1 && dbox.gift > 0 && BUILDINGS.donate.prop && BUILDINGS.donate.upkeep > 0;
    state.buildings.splice(state.buildings.indexOf(dbox), 1); afterChange();
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
    const work = (mins, until) => { for(let i = 0; i < mins; i++){ state.minute = DAWN_MIN + 60; custodiansTick(1); if(until()) return true; } return false; };
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
    // a day of empty shelves sells little, but the order still covers the crowd
    const ul = state.logi.usedLast; state.logi.usedLast = {drinks:1};
    out.demandNotStarved = guestDemand("drinks") >= Math.ceil(derived.demand * GUEST_USE.drinks) && guestDemand("drinks") > 1;
    state.logi.usedLast = ul;
    // supply trucks top up the dock while the park is open
    const tdk = {id:"b-tdk", type:"dock", points:rectPts(198, 268, 16, 10, 0)}; state.buildings.push(tdk); afterChange();
    const tm = state.minute; state.minute = DAWN_MIN + LOGI.truckMin + 1; state.logi.trucks = 0; logiTick(0);
    out.daytimeTruck = stockOf(tdk, "drinks") > 0 && state.logi.trucks === 1;
    state.minute = tm; state.buildings = state.buildings.filter(b => b !== tdk); afterChange();
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
    // lamps: they light nearby path corners at night and not by day; dark corners cost mood at night, lit ones don't; lit spots deter vandals
    {
      const keepParties = parties.slice();
      const lamp = {id:"b-lamp", type:"lamp", points:rectPts(103, 200, BUILDINGS.lamp.w, BUILDINGS.lamp.d, 0), cond:100};
      state.buildings.push(lamp); afterChange();
      const ln = nearestGuestNode(100, 200), nodes = [...gGraph.nodes.values()].filter(n => !n.rail);
      const dark = nodes.find(n => Math.hypot(n.x - 103, n.y - 200) > LAMP.radius + LAMP.lean + 4);
      const tm0 = state.minute;
      state.minute = minuteAtClock(22 * 60);
      out.lampLightsNight = ln.lit >= LAMP.litAt && !!dark && dark.lit < LAMP.litAt && darkLevel() === 1 && darkStretches >= 1;
      state.minute = DAWN_MIN + 120;
      out.lampNoDayEffect = darkLevel() === 0 && deterrence(100, 200) === VANDAL.lampCut * (litterAt(100, 200) >= 6 ? VANDAL.litterBoost : 1);
      const moodAfter = n => { resetParties(); guestsArrive(2); const q = parties[0]; q.at = n; q.to = null; q.hold = true; q.mood = 90; q.pers = ["fun"]; q.fxc = null; guestsTick(state.minute, state.minute + 1); return q.mood; };
      state.minute = minuteAtClock(22 * 60);
      const litMood = moodAfter(ln), darkMood = moodAfter(dark);
      out.darkNodesCostMood = darkMood < litMood - 1e-6;
      state.minute = DAWN_MIN + 120;
      out.darkNoCostByDay = Math.abs(moodAfter(dark) - moodAfter(ln)) < 1e-6;
      state.minute = minuteAtClock(22 * 60);
      const dLit = deterrence(100, 200), dDark = deterrence(dark.x, dark.y);
      out.lampDeterNight = dLit < dDark && dLit <= LAMP.nightCut + 1e-9;
      state.minute = tm0;
      state.buildings = state.buildings.filter(b => b !== lamp); afterChange(); resetParties(); parties.push(...keepParties);
    }
    // a guard nearby puts vandals off, and throws this one out
    const d0 = deterrence(100, 200);
    hireGuard(); syncGuards(); gcrew[0].at = nearestNode(100, 200); gcrew[0].route = [];
    out.guardDeters = deterrence(100, 200) <= d0 * SECURITY.deterCut + 1e-9;
    guardWatch();
    out.guardCatches = !vp.gone && vp.ejected && !vp.vandal && vp.ejecting === "escort" && vp.home && gcrew[0].escort === vp && vandalLog().caught === 1;
    // the guard stays beside the party while escorting, then goes free once they're out
    guardsTick(1); out.guardEscortsBeside = gcrew[0].job === "escorting" && Math.abs(keeperPos(gcrew[0])[0] - partyPos(vp)[0] - 1.2) < 1e-6;
    vp.gone = true; guardsTick(1); out.guardEscortEnds = gcrew[0].escort === null && gcrew[0].job !== "escorting";
    // with cameras, vandalism near the office sends the nearest guard
    state.science.tech.push("cameras");
    resetParties(); guestsArrive(2); const cp = parties[0]; cp.at = nearestGuestNode(130, 120); cp.rowdy = true;
    gcrew[0].at = nearestNode(300, 235); gcrew[0].chase = null;
    Math.random = () => 0; vandalize(cp); Math.random = rr4;
    out.cameraSendsGuard = cp.wanted && gcrew[0].chase === cp;
    // a camera post on a path watches its own small radius, and a broken one doesn't
    out.postUnwatched = !onCamera(100, 200);
    const cam = {id:"b-cam", type:"camera", points:rectPts(100, 200, BUILDINGS.camera.w, BUILDINGS.camera.d, 0)}; state.buildings.push(cam);
    out.postWatches = onCamera(100 + SECURITY.postRadius - 2, 200) && !onCamera(100 + SECURITY.postRadius + 2, 200);
    cam.cond = 0; out.brokenPostBlind = !onCamera(100, 200);
    cam.cond = 100; resetParties(); guestsArrive(2); const cp2 = parties[0]; cp2.at = nearestGuestNode(100, 200); cp2.rowdy = true;
    gcrew[0].at = nearestNode(300, 235); gcrew[0].chase = null; cp2.wanted = false;
    Math.random = () => 0; vandalize(cp2); Math.random = rr4;
    out.postSendsGuard = cp2.wanted && gcrew[0].chase === cp2;
    state.buildings = state.buildings.filter(x => x !== cam);
    state.science.tech = state.science.tech.filter(t => t !== "cameras");
    state.staff.guards = []; syncGuards(); resetParties();

    // guest personalities: odds, slow walking, tastes, reactions, hooligans, and calling security
    {
      const mk = (a, c) => { const q = newParty(2); q.pers = [a, c]; q.fxc = {}; q.rowdy = q.pers.includes("hooligan"); return q; };
      const cnt = {}; let dupes = 0;
      for(let i = 0; i < 4000; i++){ const [a, c] = realRollPers(); cnt[a] = (cnt[a] || 0) + 1; if(a === c) dupes++; }
      out.persOdds = dupes === 0 && Object.entries(PERSONALITIES).filter(([k, x]) => x.weight).every(([k, x]) => Math.abs((cnt[k] || 0) / 4000 - x.weight) < .04);
      out.persHooliganShare = hooliganShare() > PERSONALITIES.hooligan.weight && hooliganShare() < .2;
      out.guestsStroll = newParty(2).spd * WALK_PER_MIN <= WALK_PER_MIN * GUEST.speed[1] * GUEST.pace + 1e-9 && GUEST.pace < 1;
      const fam = mk("family", "fun"), thr = mk("thrill", "fun");
      out.persBlend = Math.abs(pm(mk("fun", "family"), "infra") - (1 + (PERSONALITIES.family.fx.infra - 1) * PERS.second)) < 1e-9 && pm(fam, "infra") === PERSONALITIES.family.fx.infra && pm(mk("fun", "fun"), "infra") === 1;
      const con = mk("conserv", "fun"); learn(con, 10);
      out.conservLearnsMore = Math.abs(con.edu - 10 * PERSONALITIES.conserv.fx.learn) < 1e-9;
      // tastes and reactions
      const bad = SPECIES.find(s => isDangerous(s)), mild = SPECIES.find(s => !isDangerous(s) && s.diet.length === 1 && s.diet[0] === "herbivore");
      const fake = (sp, happy) => ({id:"x-" + sp + "-" + happy, points:[[0, 0], [1, 0], [1, 1]], animals:[{id:"a1", sp}, {id:"a2", sp}], happy});
      const eBad = fake(bad.id, 70), eMild = fake(mild.id, 70);
      out.thrillTaste = tasteOf(thr, eBad) > tasteOf(thr, eMild) && tasteOf(fam, eMild) > tasteOf(fam, eBad);
      const p1 = mk("thrill", "fun"), p2 = mk("thrill", "fun"); p1.mood = p2.mood = 50;
      personaSee(p1, eBad); personaSee(p2, eMild);
      out.thrillReacts = p1.mood > 50 && p1.thought.has("rush") && p2.mood < 50 && p2.thought.has("tame");
      const f1 = mk("family", "fun"), f2 = mk("family", "fun"); f1.mood = f2.mood = 50;
      personaSee(f1, eBad); personaSee(f2, eMild);
      out.familyReacts = f1.mood < 50 && f1.thought.has("scary") && f2.mood > 50 && f2.thought.has("cuddly");
      const c1 = mk("conserv", "fun"), c2 = mk("conserv", "fun"); c1.mood = c2.mood = 50;
      personaSee(c1, fake(mild.id, 85)); personaSee(c2, fake(mild.id, 30));
      out.conservWelfare = c1.mood > 50 && c1.thought.has("welfare") && c2.mood < 50 && c2.thought.has("poorCare");
      const n1 = mk("paleo", "fun"); n1.mood = 50; personaSee(n1, eMild); const m1 = n1.mood; personaSee(n1, eMild);
      out.paleoLikesNew = m1 > 50 && n1.mood < m1 && n1.thought.has("repeats") && tasteOf(n1, eMild) < tasteOf(n1, eBad);
      const lo = mk("conserv", "fun"); lo.mood = 60; personaLeaves(lo);
      out.conservDislikesShow = lo.mood < 60 && lo.thought.has("showy");
      // hooligans: rowdy, sneak in without paying, and tease the animals
      const hoo = mk("hooligan", "fun");
      out.hooliganRowdy = hoo.rowdy && isHooligan(hoo) && !mk("fun", "hooligan").sneaked && mk("fun", "hooligan").rowdy && !isHooligan(mk("fun", "hooligan"));
      PERS.hooligan.sneak = 1;
      out.hooliganSneaks = sneaksIn(hoo) && !sneaksIn(mk("fun", "hooligan")) && !sneaksIn(fam);
      rollPers = () => ["hooligan", "fun"]; resetParties();
      const tk0 = state.today.tickets, gs0 = state.today.guests; guestsArrive(2);
      out.hooliganFreeEntry = state.today.tickets === tk0 && state.today.guests - gs0 === 2 && parties.length === 1;
      PERS.hooligan.sneak = 0; guestsArrive(2);
      out.hooliganPaysOtherwise = state.today.tickets - tk0 === state.ticket * 2;
      rollPers = () => ["neutral", "neutral"]; resetParties();
      PERSONALITIES.hooligan.n.x = 0;
      const tg = state.exhibits.find(e => e.animals.length && !e.viv), th = mk("hooligan", "fun");
      if(tg){
        th.at = nearestGuestNode(...centroid(tg.points)); let near = th.at;
        for(const n of gGraph.nodes.values()) if(distToEdge(n.x, n.y, tg.points) < distToEdge(near.x, near.y, tg.points)) near = n;
        th.at = near; for(const a of tg.animals) a.need = a.need || {stress:0};
        const s0 = tg.animals[0].need.stress; const rr5 = Math.random; Math.random = () => 0; teaseTick(th, 1); Math.random = rr5;
        out.hooliganTeases = distToEdge(th.at.x, th.at.y, tg.points) > THROWN.reach * .7 || (tg.animals[0].need.stress > s0 && th.vandal);
      } else out.hooliganTeases = true;

      // calling security
      hireGuard(); state.staff.guards = []; syncGuards();
      const ej = mk("fun", "fun"); ej.at = nearestGuestNode(100, 200); parties = [ej];
      out.ejectNeedsGuard = typeof ejectGuest(ej) === "string" && !ej.hold;
      hireGuard(); syncGuards();
      out.ejectNeedsGuardOnDuty = typeof ejectProblem(ej) === "string";
      gcrew[0].at = nearestNode(300, 235); gcrew[0].route = []; gcrew[0].chase = null;
      out.ejectCalls = ejectGuest(ej) === null && ej.hold === true && ej.ejecting === true && gcrew[0].chase === ej && /Waiting for security/.test(partyStatus(ej));
      out.ejectOnlyOnce = typeof ejectGuest(ej) === "string";
      // the party waits where it stands while the guard is far away
      const at0 = ej.at, t0 = ej.t; guestsTick(state.minute, state.minute + 2);
      out.ejectWaits = ej.at === at0 && ej.t === t0 && !ej.gone && ej.hold;
      // the panel opens on it and shows the button, and tapping its dot finds it
      select("guest", ej.id); guestLive(true);
      const [gx, gy] = partyPos(ej), box = svg.getBoundingClientRect();
      out.guestPanel = panelEl.innerHTML.includes('data-action="ejectGuest"') && document.getElementById("gEject").textContent === "Security called" && panelEl.innerHTML.includes("Personalities") && /Waiting for security/.test(document.getElementById("gStatus").textContent) && document.getElementById("gEject").disabled;
      out.guestTapFinds = guestAt(gx * view.k + view.tx + box.left + 3, gy * ky() + view.ty + box.top - 3) === ej && guestAt(gx * view.k + view.tx + box.left + 300, gy * ky() + view.ty + box.top) !== ej;
      drawParties();
      out.guestDotColored = shirtPaths[PERS_INDEX.fun].getAttribute("d").length > 0 && guestRing.style.display === "";
      // zoomed in, guests are pixel people with a pip in the dot color; zoomed out they go back to dots
      { const k0 = view.k; view.k = 14; drawParties(); const sp = guestEls.size === 1 && guestEls.get(ej.id).firstChild.getAttribute("fill") === SHIRTS[PERS_INDEX.fun] && shirtPaths[PERS_INDEX.fun].getAttribute("d") === "";
        view.k = 1; drawParties(); out.guestSprites = sp && guestEls.size === 0 && shirtPaths[PERS_INDEX.fun].getAttribute("d").length > 0; view.k = k0; drawParties(); }
      // the guard reaches it: it is walked to the gate, unhappy, rather than thrown out
      gcrew[0].at = nearestNode(ej.at.x, ej.at.y); const mood0 = ej.mood, mn0 = state.today.moodN;
      guardWatch();
      out.ejectEscorts = !ej.hold && ej.ejecting === "escort" && ej.home && !ej.gone && ej.thought.has("ejected") && mood0 - ej.mood >= PERS.ejectMood - 1e-9 && gcrew[0].chase === null;
      let m = state.minute; for(let i = 0; i < 900 && !ej.gone; i++){ guestsTick(m, m + 2); m += 2; }
      out.ejectWalksOut = ej.gone && !ej.ejected && state.today.moodN > mn0;
      guestLive(true);
      out.guestPanelCloses = sel === null;
      // a hooligan won't wait: a guard has to catch it
      const ho = mk("hooligan", "fun"); ho.at = nearestGuestNode(100, 200); parties = [ho];
      gcrew[0].at = nearestNode(300, 235); gcrew[0].chase = null; guardsTick(1);   // the last escort is over
      out.ejectHooligan = ejectGuest(ho) === null && !ho.hold && ho.ejecting === true && gcrew[0].chase === ho;
      guardWatch(); out.hooliganRunsFree = !ho.gone;
      gcrew[0].at = nearestNode(ho.at.x, ho.at.y); guardWatch();
      out.hooliganCaught = ho.ejected && ho.ejecting === "escort" && ho.home && gcrew[0].escort === ho; ho.gone = true; guardsTick(1);
      // security that never shows up gives up after a while
      const wt = mk("fun", "fun"); wt.at = nearestGuestNode(100, 200); parties = [wt]; gcrew[0].at = nearestNode(300, 235);
      ejectGuest(wt); state.minute += PERS.ejectWait + 1; ejectTick(wt);
      out.ejectTimesOut = wt.ejecting === false && !wt.hold;
      state.minute -= PERS.ejectWait + 1;
      state.staff.guards = []; syncGuards(); resetParties(); select(null);
    }
    // a mechanic fixes the broken bench, and a custodian scrubs off graffiti
    hireMechanic();
    const fix = (mins, until) => { for(let i = 0; i < mins; i++){ state.minute = DAWN_MIN + 60; mechanicsTick(1); if(until()) return true; } return false; };
    out.mechanicFixesProp = fix(900, () => propCond(bench) >= 99.9);
    state.staff.mechanics = [];
    const fs4 = buildingById("b-f"); fs4.graffiti = 80; hireCustodian(); syncCustodians();
    out.custodianScrubsGraffiti = work(900, () => !fs4.graffiti);
    state.staff.custodians = []; syncCustodians();

    // trash thrown into an exhibit: rowdy guests throw most, bins and a Do Not Feed sign cut it, and animals that eat it get sick or die
    const tx = state.exhibits.find(x => !x.viv && x.animals.length);
    if(tx){
      const [tcx, tcy] = centroid(tx.points), tq = {rowdy:true, mood:10, trash:0, edu:0}, tn = {rowdy:false, mood:80, trash:1, edu:0};
      const base = throwChance(tq, tx, tcx, tcy);
      out.rowdyThrowsMore = base > throwChance(tn, tx, tcx, tcy) && throwChance({rowdy:false, mood:80, trash:0}, tx, tcx, tcy) === 0;
      const nf = {id:"b-nf", type:"nofeed", points:rectPts(tx.points[0][0], tx.points[0][1], 1.6, 1, 0)}; state.buildings.push(nf);
      out.noFeedCuts = hasNoFeed(tx) && throwChance(tq, tx, tcx, tcy) <= base * THROWN.signCut + 1e-9;
      state.buildings = state.buildings.filter(b => b !== nf);
      tx.trash = 1000; const saved = [...tx.animals], rt = state.rating, n0 = tx.animals.length, hp = state.health.from; state.health.from = 0;
      tx.animals.forEach(a => delete a.sick);
      const rr5 = Math.random; Math.random = () => 0; healthStep(.1); Math.random = rr5; state.health.from = hp;
      out.trashPoisons = tx.animals.length === n0 && tx.animals.every(a => a.sick && a.sick.name === "foreign" && a.sick.kind === "poison" && !a.sick.hidden);
      tx.animals.forEach(a => delete a.sick); tx.trash = 0;
      tx.animals = saved; state.rating = rt;
    }

    // education: an info sign by an exhibit teaches far more than looking, unless it's broken
    resetParties(); state.minute = DAWN_MIN + 60;
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
    const e4 = kid(); e4.seen = new Set(["e-g1", "e-g2"]); e4.cash = 100; e4.until = state.minute + 700;
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
    state.minute = LODGING.outAt + 1; hotelGuestsArrive();
    out.hotelGuestsMorning = parties.length === BUILDINGS.lodge.rooms && parties.every(x => x.at === gGraph.anchors["b-lodge"] && x.hotel === "b-lodge")
      && state.today.tickets === tk0 && state.today.guests - gs0 === BUILDINGS.lodge.rooms * LODGING.perRoom && !state.lodging.stays.length;
    resetParties();
    // a custodian cleans the rooms
    lodge.dirt = 70; hireCustodian(); syncCustodians();
    out.custodianCleansHotel = work(900, () => !lodge.dirt);
    state.staff.custodians = []; syncCustodians();
    state.buildings = state.buildings.filter(b => b !== lodge); afterChange(); state.rating = r0; state.history = h0; state.logi.guestFrom = gf0;

    // lots of guests stay quick to simulate
    state.minute = DAWN_MIN + 120;
    for(let i = 0; i < 1500; i++) guestsArrive(2);
    out.partyCap = parties.length === GUEST.maxParties && guestCount() === 3000;
    for(let i = 0; i < 30; i++) tick(.8);
    const tp = performance.now(); for(let i = 0; i < 50; i++) tick(.8);
    out.guestPerf = (performance.now() - tp) / 50 < 25;   // ~17 ms in the cloud sandbox at every commit since this check was added

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
    { // Quaternary dropdown (holds the park plants): biome headings in BIOMES order, sizes ascending inside each
      const sub = document.querySelector('#sideMenu [data-open="plants-Quaternary"] .ssub'), order = Object.keys(BIOMES).map(b => BIOMES[b].label), heads = [], sizes = []; let ok = !!sub;
      if(sub) for(const el of [...sub.children]){
        if(el.tagName === "P" && el.dataset.pbiome){ heads.push(el.textContent); sizes.push([]); }   // a biome heading (the biome dropdown and the "no plants" note are skipped)
        else if(el.tagName !== "BUTTON" || el.classList.contains("xclose")) continue;
        else sizes[sizes.length - 1].push(PLANT_SIZES.indexOf(el.querySelector(".price").textContent.split(", ").find(x => PLANT_SIZES.includes(x))));
      }
      out.parkPlantsByBiome = ok && heads.length > 0 && heads.every(h => order.includes(h)) && heads.map(h => order.indexOf(h)).every((v, i, a) => !i || v > a[i - 1]) && sizes.every(a => a.every((v, i) => v >= 0 && (!i || v >= a[i - 1])));
    }
    out.menuBuilt = document.querySelectorAll("#sideMenu .sgroup").length >= 6 && !!document.querySelector('[data-tool="restroom"]') && !!document.querySelector('[data-fence="concrete"]');
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
    const out = {}; localStorage.setItem("genesis-dev", "1");   // these checks cover the dev-only themes and toys
    startWith(newPark(), false); setSpeed(0);
    events.toast = () => {};
    state.money = 1e7; state.day = 3; state.starters = []; state.staff.feedFrom = 0; state.safety.escapesFrom = 99;
    const H = Math.PI / 2;
    state.buildings.push({id:"b-or", type:"oracle", points:rectPts(230, 262, 24, 16, H)});
    state.buildings.push({id:"b-gh", type:"ghost",  points:rectPts(180, 262, 28, 20, H)});
    state.buildings.push({id:"b-ta", type:"tar",    points:rectPts(230, 290, 26, 18, H)});
    state.buildings.push({id:"b-ce", type:"ceres",  points:rectPts(180, 290, 26, 18, H)});
    state.paths.push({id:"p-t", name:"t", points:[[207.5,262],[222,262]]}, {id:"p-t2", name:"t2", points:[[207.5,262],[193,262]]}, {id:"p-t3", name:"t3", points:[[207.5,290],[217,290]]}, {id:"p-t4", name:"t4", points:[[207.5,290],[193,290]]});
    recompute(); buildKeeperGraph();
    out.sciReachable = ["oracle", "ghost", "tar", "ceres"].every(t => !!dept(t));
    const sc = state.science, adv = (mins, fn) => { for(let i = 0; i < mins; i++){ if(state.minute >= DAY_MIN - 2){ state.day++; state.minute = 0; } tick(1); if(fn && fn()) return true; } return false; };
    sc.tech = sc.tech.filter(t => t !== "bars");   // bars are free in every park, so research is tested from scratch
    state.minute = 10;

    // research: needs a researcher, takes time proportional to cost, and finishes mid-day
    out.needsPaleo = !!startProject("tech", "bars");
    hireScientist("paleo");
    sc.points = 100;
    out.startResearch = startProject("tech", "bars") === null && sc.points === 85 && !hasTech("bars");
    const t15 = sc.projects[0].end - sc.projects[0].start;
    out.oneAtATime = !!startProject("tech", "moat") && sc.projects.length === 1 && sc.projects[0].bay === 0;
    out.researchTakesTime = adv(60) === false && !hasTech("bars");
    const day0 = state.day;
    out.researchFinishesMidDay = adv(600, () => hasTech("bars")) && state.day === day0;
    sc.points = 100; startProject("tech", "moat");
    out.pricierIsSlower = sc.projects[0].end - sc.projects[0].start === t15 * 4;
    sc.projects = [];
    // points accrue with time, not at night
    const pts0 = sc.points; state.minute = DAWN_MIN + 60; tick(60);
    out.pointsTrickle = Math.abs(sc.points - pts0 - RESEARCH_PER_PALEO * 60 / DAY_MIN) < 1e-6;
    // a researcher on a project earns nothing, and stopping it gives the points back
    sc.points = 100; startProject("tech", "moat");
    const pts1 = sc.points; tick(60);
    out.busyResearcherEarnsNothing = sc.points === pts1;
    const refund = sc.points + sc.projects[0].cost; stopProject(sc.projects[0]);
    out.stopProjectRefunds = sc.projects.length === 0 && Math.abs(sc.points - refund) < 1e-6;
    // educated guests fund research
    const pts2 = sc.points; parties = [{n:4, edu:50, mood:50, needs:{}, thought:new Set(), pers:[]}]; partyLeaves(parties[0]); parties = [];
    out.guestsFundResearch = Math.abs(sc.points - pts2 - 4 * RESEARCH_GUEST * .5) < 1e-6;

    // the timeline: equal period bars, a log scale inside each epoch, and labels that round coarser further back
    out.timelineRoundTrips = [0.05, .37, .5, .91, .999].every(u => Math.abs(uAt(yearsAt(u).years) - u) < 1e-9);
    out.timelineLabels = fmtYearsAgo(352) === "350 years ago" && fmtYearsAgo(126000) === "130,000 years ago" && fmtYearsAgo(2.58e6) === "2.6 million years ago" && fmtYearsAgo(251.9e6) === "252 million years ago";
    out.everySpeciesHasAClade = SPECIES.every(x => CLADE_OF[x.id]) && Object.keys(CLADE_OF).every(id => SPECIES_BY_ID[id]) && Object.values(CLADE).flat().length === Object.keys(CLADE_OF).length;
    out.bodyListsNameSpecies = [GORES, LIMBLESS, TOOTHLESS, SHELLED].every(l => l.every(id => SPECIES_BY_ID[id])) && SHELLED.every(id => CLADE_OF[id] === "invert");
    out.everySpeciesHasASite = SPECIES.every(x => TIME_SITES.some(t => (t.fauna || []).includes(x.id) && epochOf(t.from).period === x.period));
    out.sitesHaveMaps = TIME_SITES.every(t => t.from > EPOCHS[0].from || Object.keys(t.at).length > 0) && Object.values(TIMELINE_MAPS).every(m => SPRITE_PACK[`sprites/timeline/${m}.png`]);

    // animals are discovered by the Time Travel Lab's drones scouting real sites; the Time Travel Lab comes with one drone
    const small = SPECIES.filter(x => !x.viv && speciesAvailable(x.id) && sitesOf(x.id).length).sort((a, c) => a.space - c.space)[0], big = SPECIES.slice().sort((a, c) => c.space - a.space)[0];
    const site = sitesOf(small.id).find(siteShown), other = TIME_SITES.find(t => siteShown(t) && !t.event && t.id !== site.id);
    out.digNeedsScout = expeditionProblem(site.id, small.id) === "Scout the site first.";
    out.oneDrone = sc.drones === 1 && bayCount("temporal") === 1 && sc.crew.temporal === undefined;
    const mny = state.money; state.minute = DAWN_MIN + 60;
    out.scoutSent = sendDrone("scout", site.id) && state.money === mny - scoutCost(site.id) && sc.trips.length === 1 && sc.trips[0].bay === 0 && sc.trips[0].kind === "scout";
    out.oneDroneOneTrip = /Every drone is out/.test(scoutProblem(other.id) || "") && /already scouting/.test(scoutProblem(site.id) || "");
    const trip = sc.trips[0];
    out.tripLength = trip.end - trip.start === Math.round(PERIOD_BY_ID[sitePeriod(site)].days * DAY_MIN);
    const realRandom = Math.random;
    Math.random = () => .01;   // every unseen animal turns up
    out.scoutDiscovers = adv(trip.end - nowMin() + 2, () => !sc.trips.length) && isUnlocked(small.id) && isScouted(site.id) && sc.reports[0].lines[0][0] === `${small.name} Discovered` && sc.reports[0].kind === "scout";
    Math.random = () => .99;   // nothing turns up
    sendDrone("scout", other.id); adv(sc.trips[0].end - nowMin() + 2, () => !sc.trips.length);
    out.scoutCanFail = siteLit(other) && siteSeen(other).length === 0 && sc.reports[0].lines[0][0] === "Came back empty handed" && !siteComplete(other);
    // a big site gives up at most two animals a trip, then reads Site Complete
    const morrison = SITE_BY_ID.morrison, devWas = localStorage.getItem("genesis-dev"); localStorage.setItem("genesis-dev", "1");
    Math.random = () => .01; tripReturns({kind:"scout", site:"morrison", bay:0});
    const two = siteSeen(morrison).length; let k = 0; while(!siteComplete(morrison) && k++ < 20) tripReturns({kind:"scout", site:"morrison", bay:0});
    out.scoutCapsAndCompletes = two === SCOUT.max && siteComplete(morrison) && sc.reports[0].lines.some(l => l[0] === "Site Complete") && /every animal/i.test(scoutProblem("morrison"));
    if(devWas === null) localStorage.removeItem("genesis-dev"); else localStorage.setItem("genesis-dev", devWas);
    // expeditions: locked behind the park's stars, and a find fills the genome
    const starred = siteSeen(morrison).map(id => SPECIES_BY_ID[id]).find(x => x.stars > 0);
    state.rating = 0; out.starLock = /star park/.test(expeditionProblem("morrison", starred.id) || "");
    state.rating = 5; Math.random = () => .99;   // a find, and no bonus
    out.expedition = sendDrone("dig", site.id, small.id) && adv(sc.trips[0].end - nowMin() + 2, () => !sc.trips.length) && sc.dna[small.id].genome > 0 && sc.reports[0].lines[0][0] === `${small.name} Sample Found`;
    Math.random = realRandom;
    // more drones fly more trips; each costs more than the last
    const p1 = dronePrice(), m1 = state.money;
    out.buyDrone = buyDrone() === null && sc.drones === 2 && state.money === m1 - p1 && dronePrice() > p1 && bayCount("temporal") === 2;
    // better drone marks cut empty-handed trips
    const fail0 = tripOdds(big.id, sitesOf(big.id)[0].id).fail; sc.tech.push("ghostmk2", "ghostmk3", "ghostmk4", "ghostmk5");
    out.droneMarks = droneMk() === 4 && Math.abs(tripOdds(big.id, sitesOf(big.id)[0].id).fail - fail0 * .5) < 1e-9;
    sc.tech = sc.tech.filter(t => !/^ghostmk/.test(t)); sc.drones = 1;

    // a genome takes about 3 trips for the smallest animal and 8 for the largest
    const dig = id => tripReturns({kind:"dig", site:sitesOf(id)[0].id, sp:id, bay:0});
    const avgTrips = id => {
      let total = 0; const N = 600;
      for(let n = 0; n < N; n++){ delete sc.dna[id]; let k = 0; while(!genomeDone(id) && k < 60){ dig(id); k++; } total += k; }
      return total / N;
    };
    const tiny = SPECIES.slice().sort((a, c) => a.space - c.space)[0];
    sc.unlocked.push(big.id);
    const aSmall = avgTrips(tiny.id), aBig = avgTrips(big.id);
    out.smallGenome3 = aSmall > 1.6 && aSmall < 3.2;
    out.bigGenome8 = aBig > 6.8 && aBig < 9.2;
    out.bigTakesMoreTrips = aBig > aSmall + 3 && tripOdds(big.id, sitesOf(big.id)[0].id).trips > tripOdds(tiny.id, sitesOf(tiny.id)[0].id).trips + 4;
    out.genomeVaries = (() => { const ns = []; for(let n = 0; n < 40; n++){ delete sc.dna[big.id]; let k = 0; while(!genomeDone(big.id) && k < 60){ dig(big.id); k++; } ns.push(k); } return Math.min(...ns) < Math.max(...ns); })();
    sc.reports = [];

    // cloning: time depends on size and the upgrades, and runs on minutes
    sc.dna[small.id] = {genome:100, quality:90}; hireScientist("gene");
    const base = cloneMinutes(small.id);
    out.cloneTimed = base === Math.round((1 + small.space / CLONE_DAYS_PER_SPACE) * DAY_MIN);
    state.rating = 5; state.minute = DAWN_MIN + 60;
    out.cloneOrder = orderClone(small.id, null) && sc.clones.length === 1;
    out.incubatorCount = bayCount("gene") === 1 && sc.clones[0].bay === 0;
    sc.tech.push("fast1");
    out.upgradesApply = Math.abs(cloneMinutes(small.id) - base * TAR_UPGRADE.speed) <= 1;
    out.oneCloneAtATime = /bay is busy/.test(cloneProblem(small.id)) && !orderClone(small.id, null) && sc.clones.length === 1;
    hireScientist("gene");
    out.hireOpensBay = freeBay("gene") === 1 && orderClone(small.id, null) && sc.clones[1].bay === 1;
    out.fireClosesBay = (() => { const n = sc.clones.length; fireScientist("gene"); return sc.clones.length === n - 1 && bayCount("gene") === 1; })();
    out.cloneFinishes = adv(base + 5, () => specimens().length >= 1);
    // a partial genome can fail: the clone stops where it died, keeps its bay, and waits to be discarded
    sc.dna[small.id] = {genome:CLONE_GENOME.min}; sc.rating = 5;
    out.failChanceScales = Math.abs(cloneFailChance(small.id) - CLONE_GENOME.failMax) < 1e-9 && (sc.dna[small.id].genome = 80, Math.abs(cloneFailChance(small.id) - CLONE_GENOME.failMax / 2) < 1e-9) && (sc.dna[small.id].genome = 100, cloneFailChance(small.id) === 0);
    sc.dna[small.id].genome = CLONE_GENOME.min;
    const rnd0 = Math.random; Math.random = () => 0;
    const ordered = orderClone(small.id, null); Math.random = rnd0;
    const fj = sc.clones[sc.clones.length - 1];
    out.failRolled = ordered && fj.fail > fj.start && fj.fail < fj.end;
    out.runningCardHasBar = /data-cbar/.test(cloneCard(fj, 0)) && !/CLONE FAILED/.test(cloneCard(fj, 0));
    const readyBefore = specimens().length;
    out.cloneFails = adv(base, () => fj.failed) && fj.stop >= CLONE_FAIL.from * 100 - 1 && fj.stop <= CLONE_FAIL.to * 100 + 1;
    adv(base * 2, () => false);
    out.failedStaysPut = sc.clones.includes(fj) && specimens().length === readyBefore && cloneProgress(fj) === fj.stop && /bay is busy/.test(cloneProblem(small.id));
    out.failedCardOverlay = /CLONE FAILED/.test(cloneCard(fj, 0)) && /discardClone/.test(cloneCard(fj, 0)) && cloneCard(fj, 0).includes(`width:${Math.round(fj.stop)}%`);
    out.discardFreesBay = discardClone(fj.id) && !sc.clones.includes(fj) && freeBay("gene") >= 0;
    sc.dna[small.id] = {genome:100};
    sc.tar = null;

    // The Botany Lab: needs a botanist, flora unlocked, and complete plant DNA for the plant's own period from the Time Travel Lab; then it grows plants in its beds
    out.noBotanist = growProblem("plant", "Jurassic", "small") === "Hire a botanist at the Botany Lab to tend a growing bed.";
    hireScientist("botanist");
    out.floraLocked = /Research Lab/.test(growProblem("plant", "Jurassic", "small"));
    sc.tech.push("paleoflora", "mesoplant", "medmeso");
    out.floraNeedsDna = /plant DNA/.test(growProblem("plant", "Jurassic", "small")) && !ceresRate();
    out.dnaPerPeriod = PLANT_DNA.Jurassic.id === "flora-Jurassic" && siteTargets(SITE_BY_ID.morrison).includes(PLANT_DNA.Jurassic.id) && !siteTargets(SITE_BY_ID.morrison).includes(PLANT_DNA.Triassic.id) && genomeOpen(PLANT_DNA.Jurassic.id) && !genomeOpen(PLANT_DNA.Devonian.id);
    out.noPlantingStock = !CERES_GROW.flora && typeof replantProblem === "undefined" && !("plants" in state.ceres);
    sc.dna[PLANT_DNA.Jurassic.id] = {genome:50, quality:80};
    out.halfDnaNotEnough = !!growProblem("plant", "Jurassic", "small");
    sc.dna[PLANT_DNA.Jurassic.id] = {genome:100, quality:80};
    out.floraGrows = growProblem("plant", "Jurassic", "small") === null && ceresRate() > 0;
    out.otherPeriodNeedsOwnDna = /Triassic plant DNA/.test(growProblem("plant", "Triassic", "small"));
    state.minute = DAWN_MIN + 60;
    growBatch("plant", "Jurassic", "small");
    out.bedBusy = state.ceres.beds.length === 1 && !state.ceres.pots["Jurassic-small"];
    out.batchTakesTime = adv(60) === false && !state.ceres.pots["Jurassic-small"];
    out.batchDone = adv(growMinutes("plant", "Jurassic", "small"), () => state.ceres.pots["Jurassic-small"] === CERES_GROW.plant.mesozoic.small.count);
    // medicine comes from batches, not a steady trickle
    state.ceres.meds = {medpal:0, medmes:0, medcen:0}; state.minute = DAWN_MIN + 60;
    out.medNoTrickle = (adv(30), cerMedTotal() === 0);
    out.medGrows = growBatch("med", "mesozoic") && adv(growMinutes("med", "mesozoic") + 5, () => cerMeds().medmes >= 20) && cerMeds().medpal === 0 && cerMeds().medcen === 0;
    state.ceres.auto.mesozoic = true; state.ceres.meds = {medpal:0, medmes:0, medcen:0};
    out.autoRestocks = adv(growMinutes("med", "mesozoic") * 2 + 10, () => cerMeds().medmes >= 20);
    // a pile of one era's medicine doesn't stop the Botany Lab regrowing another's
    state.ceres.meds = {medpal:0, medmes:0, medcen:medCap()};
    out.autoNotBlockedByOtherEra = adv(growMinutes("med", "mesozoic") * 2 + 10, () => cerMeds().medmes >= 20) && cerMeds().medcen === medCap();
    state.ceres.auto.mesozoic = false;

    // an era's medicine works for all its periods once researched; there's nothing to refine
    sc.tech.push("medceno", "medmeso");
    out.eraMedicineWholeEra = canTreat(SPECIES.find(x => x.period === "Jurassic")) && canTreat(SPECIES.find(x => x.period === "Triassic")) && !canTreat(SPECIES.find(x => x.period === "Permian"));
    out.noRefining = projectProblem("refine", "Cretaceous") === "That can't be researched.";
    sc.tech = sc.tech.filter(t => t !== "medmeso");

    // saves from before timed science keep their unlocked periods, trips, and clones
    const oldS = JSON.parse(JSON.stringify(newPark())); delete oldS.discoV; delete oldS.science.drones; delete oldS.science.seen; delete oldS.science.reports;
    oldS.day = 6; oldS.starters = ["arth"]; oldS.science.unlocked = ["Cretaceous"]; delete oldS.science.projects;
    oldS.science.trips = [{period:"Jurassic", sp:"dryo", back:7}]; oldS.science.clones = [{id:"c1", sp:"lyst", exhibitId:null, q:90, lane:0, done:8}];
    oldS.science.crew.temporal = 1; oldS.science.crew.gene = 1;
    oldS.science.clones.push({id:"c2", sp:"lyst", exhibitId:null, q:90, lane:2, start:9 * DAY_MIN, end:12 * DAY_MIN});   // a second incubator in an old save, no geneticist for it
    oldS.science.tech = ["paleoflora", "mesoplant", "medmeso"]; delete oldS.science.crew.botanist; delete oldS.ceres;
    oldS.buildings.push({id:"b-c", type:"ceres", points:rectPts(180, 290, 26, 18, H)});
    const money0 = oldS.money, up = upgradeSave(oldS);
    out.oldJobsGetBays = up.science.trips[0].bay === 0 && up.science.clones.length === 1 && up.science.clones[0].bay === 0 && up.science.clones[0].lane === undefined;
    out.oldExtraJobRefunded = up.money === money0 + SPECIES_BY_ID.lyst.price;
    // discovery moved to the Time Travel Lab: the Temporal Researcher became a drone, the trip still out became an expedition to a site,
    // and the sites of animals already unlocked are scouted
    out.oldDiscovery = up.discoV === 1 && up.science.drones === 1 && up.science.crew.temporal === undefined && up.science.trips[0].kind === "dig"
      && sitesOf("dryo").some(t => t.id === up.science.trips[0].site) && (up.science.seen.hellcreek || []).includes("trex") && Array.isArray(up.science.reports);
    out.oldUnlocksAnimals = up.science.unlocked.includes("trex") && up.science.unlocked.every(id => SPECIES_BY_ID[id]) && !up.science.unlocked.includes("arth");
    out.oldTripEnds = up.science.trips[0].end === 7 * DAY_MIN && up.science.trips[0].back === undefined;
    out.oldCloneEnds = up.science.clones[0].end === 8 * DAY_MIN && up.science.clones[0].done === undefined;
    out.oldPlantsSplit = !up.science.dna["flora-mesozoic"] && up.science.dna[PLANT_DNA.Triassic.id].genome === 100 && !("plants" in up.ceres);
    out.oldKeepsFlora = up.science.dna[PLANT_DNA.Jurassic.id].genome === 100 && up.science.crew.botanist === 1 && up.ceres.auto.mesozoic === true && !up.science.tech.some(t => t.startsWith("ref-"));
    // old refinements, finished or under way, are paid back
    { const o2 = JSON.parse(JSON.stringify(state)); o2.science.tech.push("ref-Jurassic", "ref-Permian"); o2.science.projects.push({kind:"refine", id:"Paleogene", bay:0, cost:8, start:0, end:10});
      const p0 = o2.science.points || 0, u2 = upgradeSave(o2);
      out.oldRefinementsRefunded = Math.abs(u2.science.points - (p0 + 14 + 20 + 8)) < 1e-9 && !u2.science.tech.some(t => t.startsWith("ref-")) && !u2.science.projects.some(p => p.kind === "refine"); }

    // landscaping: water drawn inside open exhibits, and rocks placed in them
    const keepEx = state.exhibits, keepBld = state.buildings, keepMoney = state.money; state.money = 1e6; state.buildings = [];
    const lx = {id:"e-land", name:"Land test", points:[[100,100],[160,100],[160,160],[100,160]], animals:[], happy:70, cond:100, land:[], water:[]};
    state.exhibits = [lx];
    const fish = SPECIES.find(s => s.semi);
    lx.animals = [{id:"a-l1", sp:fish.id, q:90}];
    out.landMenu = !!document.querySelector('[data-water="auto"]') && !!document.querySelector('[data-tool="land-rock"]');
    setTool("water"); out.landTool = tool === "water" && $("#drawbar").classList.contains("on"); setTool("select");
    const sq = (x, y, r) => [[x - r, y - r], [x + r, y - r], [x + r, y + r], [x - r, y + r]];
    // out in the park, rocks are fine but habitat props aren't, and water outside the fence isn't this exhibit's
    out.landRejectsOutside = waterHost(sq(10, 10, 4)) === null && !!waterProblem(sq(102, 130, 4), lx, null, 0) && landSpot(10, 10, "rock").ok && /inside an open exhibit/.test(landSpot(10, 10, "shelter").why || "");
    const dryTarget = exhibitReport(lx).target, dryIll = illChance(lx, lx.animals[0]).p;
    out.landDryFlagged = thirsty(lx, fish) && exhibitReport(lx).issues.some(i => i.bad && /No water/.test(i.text)) && illChance(lx, lx.animals[0]).why.includes("thirst");
    const pool = sq(130, 130, 6);
    out.landAcceptsInside = waterHost(pool) === lx && waterProblem(pool, lx, null, waterCost(pool)) === null;
    addWater(lx, pool);
    out.landOverlapRejected = !!waterProblem(sq(133, 130, 4), lx, null, 0) && !landSpot(132, 130, "rock").ok;
    out.landPondHelps = !thirsty(lx, fish) && exhibitReport(lx).target > dryTarget && illChance(lx, lx.animals[0]).p < dryIll;
    state.money = 100; out.landNeedsMoney = /Costs/.test(landSpot(150, 110, "boulder").why || ""); state.money = 1e6;
    placeLand(lx, "rock", 110, 150);
    // water and rocks ride along when the exhibit moves
    const mv = startMove(lx, "exhibit", {clientX:0, clientY:0}); moveBy(mv, 10, 5);
    out.landMoves = lx.water[0].points[0][0] === 134 && lx.water[0].points[0][1] === 129 && lx.land[0].x === 120 && lx.points[0][0] === 110;
    moveBy(mv, 0, 0);
    // water stays on the chunk grid: an exhibit with water moves in 5 m, and the Move tool has no corners on water
    out.waterMoveStep = moveStep(mv) === CHUNK && moveStep({water:[]}) === GRID_STEP;
    out.waterNotReshapable = reshapeables().every(x => x.t === x.e && !x.w);
    // old water snaps to whole chunks: kept at half or more, cut to the fence, no money changes hands, and doing it twice changes nothing
    const sv = JSON.parse(JSON.stringify(newPark())); delete sv.waterGrid5; sv.money = 777;
    sv.exhibits = [{id:"e-u", name:"U", points:[[100,100],[160,100],[160,160],[100,160]], animals:[], land:[], water:[{id:"w-a", points:[[103,103],[113,103],[113,111],[103,111]]}]}];
    sv.water = [{id:"w-p", points:[[213,203],[222,203],[222,212],[213,212]]}];
    upgradeSave(sv);
    const snapped = JSON.stringify([sv.water.map(w => w.points), sv.exhibits[0].water.map(w => w.points)]);
    out.waterUpgradeSnaps = sv.waterGrid5 === true && sv.money === 777 && sv.water.length === 1 && rectOfPts(sv.water[0].points).join() === "215,205,220,210" && sv.exhibits[0].water.length === 1 && rectOfPts(sv.exhibits[0].water[0].points).join() === "105,105,115,110";
    upgradeSave(sv);
    out.waterUpgradeOnce = JSON.stringify([sv.water.map(w => w.points), sv.exhibits[0].water.map(w => w.points)]) === snapped && newPark().waterGrid5 === true;
    // an outline that would leave something outside the fence is refused
    const orig = lx.points.map(p => p.slice()); lx.points[1] = [105, 100];
    out.landReshapeGuard = /outside the fence/.test(reshapeProblem(lx, orig) || ""); lx.points = orig;
    // bulldozing refunds part of the price
    const f0 = lx.land[0], n0 = lx.land.length;
    out.landRefund = refundFor("land", f0) === Math.round(LAND[f0.type].price * COST.refundShare) && refundFor("water", lx.water[0]) === Math.round(waterCost(pool) * COST.refundShare) && landRefund(lx) > 0;
    removeItem("land", f0); removeItem("water", lx.water[0]);
    out.landBulldoze = lx.land.length === n0 - 1 && !lx.land.includes(f0) && lx.water.length === 0;
    // the Move tool picks rocks up: inside the exhibit, into another, out in the park, and back, keeping the id and charging nothing
    {
      const lx2 = {id:"e-land2", name:"Land test 2", points:[[170,100],[210,100],[210,140],[170,140]], animals:[], happy:70, cond:100, land:[], water:[]};
      state.exhibits = [lx, lx2]; lx.land = []; lx.water = [];
      const rk = placeLand(lx, "rock", 110, 110), blocker = placeLand(lx, "rock", 130, 130), cash = state.money;
      const mvTo = (m, x, y) => { m.spot = landMoveSpot(m, m.wx + x - m.x0, m.wy + y - m.y0); moveBy(m, m.spot.x - m.x0, m.spot.y - m.y0); return m.spot; };
      let m = startMove(rk, "land", {clientX:0, clientY:0});
      out.landMoveTarget = moveTarget({kind:"land", id:rk.id}) === rk;
      out.landMoveRefusesOverlap = !mvTo(m, 130, 130).ok && /overlaps/.test(m.spot.why);
      out.landMoveToPark = mvTo(m, 20, 20).ok && m.spot.e === null;
      out.landMoveRefusesFence = !mvTo(m, 101, 101).ok;
      moveBy(m, 0, 0); out.landMoveRestores = rk.x === 110 && rk.y === 110;
      mvTo(m, 120, 140); const inner = m.spot; dropMove(m);
      out.landMoveInside = inner.ok && lx.land.includes(rk) && rk.x === inner.x && rk.y === inner.y && state.money === cash;
      const id = rk.id, biome = biomeOf(lx);
      m = startMove(rk, "land", {clientX:0, clientY:0}); mvTo(m, 190, 120); dropMove(m);
      out.landMoveBetween = !lx.land.includes(rk) && lx2.land.includes(rk) && rk.id === id && state.money === cash && rk.biome === biome;
      m = startMove(rk, "land", {clientX:0, clientY:0}); mvTo(m, 10, 10); dropMove(m);
      out.landMovePark = !lx2.land.includes(rk) && state.decor.includes(rk) && rk.id === id && state.money === cash;
      m = startMove(rk, "land", {clientX:0, clientY:0}); mvTo(m, 120, 140); dropMove(m);
      out.landMoveBack = lx.land.includes(rk) && !state.decor.includes(rk) && rk.id === id && lx.land.includes(blocker);
      removeItem("land", rk); removeItem("land", blocker);
    }
    state.exhibits = keepEx; state.buildings = keepBld; state.money = keepMoney;
    // old saves get an empty list for open exhibits only
    const oldL = JSON.parse(JSON.stringify(newPark()));
    oldL.exhibits.push({id:"e-old", name:"Old", points:[[1,1],[2,1],[2,2]], animals:[], happy:70}, {id:"e-oldv", name:"OldV", points:[[1,1],[2,1],[2,2]], animals:[], happy:70, viv:"S"});
    const upl = upgradeSave(oldL);
    out.oldGetsLand = upl.exhibits.find(e => e.id === "e-old").land.length === 0 && upl.exhibits.find(e => e.id === "e-oldv").land === undefined;
    const oldP = JSON.parse(JSON.stringify(newPark()));
    oldP.exhibits.push({id:"e-oldp", name:"OldP", points:[[0,0],[40,0],[40,40],[0,40]], animals:[], happy:70, land:[{id:"l-p", type:"pond", x:20, y:20}, {id:"l-r", type:"rock", x:5, y:5}]});
    const upp = upgradeSave(oldP).exhibits.find(e => e.id === "e-oldp");
    out.oldPondsBecomeWater = upp.water.length === 1 && upp.land.length === 1 && upp.land[0].type === "rock" && Math.abs(area(upp.water[0].points) - Math.PI * WATER.oldPondR ** 2) < Math.PI * WATER.oldPondR ** 2 * .1;

    // park landscaping: plants, rocks, statues and water out in the park, open fences and hedge rows, wooden bridges, and guests who enjoy them
    {
      const keep = {exhibits:state.exhibits, buildings:state.buildings, paths:state.paths, decor:state.decor, water:state.water, fences:state.fences, fenceGrid:state.fenceGrid, money:state.money, tech:state.science.tech.slice(), done:state.goalsDone.slice(), zones:state.zones};
      state.exhibits = []; state.buildings = []; state.zones = []; state.decor = []; state.water = []; state.fences = []; state.money = 1e6;
      state.paths = [{id:"p-main", name:"Main walk", points:[[207.5,305],[207.5,235]], fixed:true}, {id:"p-l", points:[[207.5,235],[100,235]]}];
      recompute();
      // modern plants grow anywhere; other periods' plants need sterile prehistoric plants first
      out.decorPlantOutside = landSpot(150, 220, "q-white-oak").ok && landSpot(150, 220, "qua-temperate-large").ok;
      state.science.tech = state.science.tech.filter(t => t !== "sterile");
      out.decorNeedsSterile = /sterile/.test(landSpot(150, 220, "neo-temperate-large").why || "");
      state.science.tech.push("sterile");
      out.decorSterileOk = landSpot(150, 220, "neo-temperate-large").ok;
      out.decorNotOnPath = !landSpot(150, 235, "q-white-oak").ok && !landSpot(150, 220, "shelter").ok;
      out.parkPlantsCount = Object.values(PARK_PLANTS).reduce((n, l) => n + Object.keys(l).length, 0) === 27 && Object.keys(LAND).filter(k => LAND[k].park).every(k => BIOMES[LAND[k].biome] && LAND[k].period === "Quaternary");
      // statues: some free, the rest from grants
      state.goalsDone = state.goalsDone.filter(id => id !== "paleozoic");
      out.statueFree = landSpot(150, 220, "st-owen").ok && landSpot(150, 220, "st-dodo").ok;
      out.statueLocked = /locked/.test(landSpot(150, 220, "st-dime").why || "") && /Dimetrodon statue/.test(grantPrize(GOALS.find(g => g.id === "paleozoic")));
      state.goalsDone.push("paleozoic"); out.statueGranted = landSpot(150, 220, "st-dime").ok;
      out.statuesAll = Object.keys(STATUES).length === 16 && Object.keys(STATUES).every(id => STATUES[id].free || GOALS.some(g => g.statue === id));
      const oak = placeLand(null, "q-white-oak", 150, 220), bust = placeLand(null, "st-anning", 120, 225);
      out.decorPlaced = state.decor.length === 2 && findItem("land", oak.id) === oak && !landSpot(151, 221, "q-ginkgo").ok;
      // water out in the park: only a wooden bridge crosses it
      const pond = [[60,180],[90,180],[90,200],[60,200]];
      out.parkWaterOk = waterHost(pond) === null && waterProblem(pond, null, null, waterCost(pond)) === null;
      addWater(null, pond);
      out.parkWaterBlocksPath = /bridge/.test(pathProblem([[100,235],[75,235],[75,170]]) || "") && pathProblem([[100,235],[75,235],[75,170]], "bridge") === null && pathCost([[0,0],[10,0]], "bridge") === 10 * BRIDGE.perMeter;
      out.parkWaterBlocksBuilding = /water/.test(shapeHitsLandscape(rectPts(75, 190, 6, 6, 0)) || "") && /water/.test(planPieces(pieceLine([50,190],[100,190]).keys, "wood").why || "");
      out.lilyNeedsWater = /only grows in water/.test(landSpot(110, 150, "q-water-lily").why || "") && landSpot(75, 190, "q-water-lily").ok && landSpot(75, 190, "q-cattails").ok && !landSpot(75, 190, "q-white-oak").ok;
      // open fences and hedge rows
      const hedgeLine = [[110,250],[180,250]];
      out.fenceOpenOk = fenceProblem(hedgeLine, "hedge") === null && BARRIERS.hedge.strength < BARRIERS.wood.strength;
      const m0 = state.money, hl = addFenceLine(hedgeLine, "hedge");
      out.fenceOpenBuilt = state.fences.length === 1 && state.money === m0 - fenceLineCost(hedgeLine, "hedge") && refundFor("fence", hl) === Math.round(fenceLineCost(hedgeLine, "hedge") * COST.refundShare);
      out.fenceBlocksPath = !!pathProblem([[150,235],[150,270]]);
      // the fence tool lays loose fence on the grid, and a closed loop of it becomes an exhibit once it has a gate (on the park's own biome)
      state.biome = "desert";
      fenceSel = "hedge"; setTool("exhibit");
      const hp = layPieces(pieceLine([110,270],[180,270]).keys, "hedge");
      out.fenceToolOpen = !!hp && hp.n === 14 && looseRuns().some(r => r.b === "hedge" && dist(r.pts[0], r.pts[1]) === 70) && tool === "exhibit" && !!pathProblem([[150,262],[150,280]]);
      const ringOpen = fenceJointsSvg(1).includes("#E08A2E"); tool = "select"; const ringShut = fenceJointsSvg(1).includes("#E08A2E"); tool = "exhibit";
      out.decoRingOnlyWhileFencing = ringOpen && !ringShut;
      for(const [a, b] of [[[230,150],[280,150]], [[280,150],[280,200]], [[280,200],[230,200]], [[230,200],[230,150]]]) layPieces(pieceLine(a, b).keys, "hedge");
      out.fencePenNoGate = state.exhibits.length === 0 && penFaces().length === 1;
      const pf = penFaces()[0]; adoptPen(pf, pf.pts[0].slice());
      const ne = state.exhibits[state.exhibits.length - 1];
      out.decoCanHouse = !!ne && planPieces(loopPieces(ne.points), "rope").why !== "Hedges and rope fences are only for show. They can't hold animals.";
      out.fenceToolCloses = !!ne && ne.grid && ne.barrier === "hedge" && biomeOf(ne) === "desert" && area(ne.points) === 2500;
      setTool("select"); fenceSel = "wood";
      // guests enjoy the gardens and read the plaques
      recompute(); buildGuestGraph(); render();
      const near = [...gGraph.nodes.values()].filter(n => n.decor > 0), plaque = [...gGraph.nodes.values()].find(n => n.statues && n.statues.includes(bust.id));
      out.decorIndexed = near.length > 0 && !!plaque;
      const pa = newParty(2); pa.at = plaque; const e0 = pa.edu || 0, mood0 = pa.mood; statueSeen(pa, bust.id); statueSeen(pa, bust.id);
      out.statueTeaches = pa.edu - e0 === DECOR.personLearn && pa.mood > mood0;
      out.decorDraws = world.innerHTML.includes("sprites/plants/q-white-oak.png") && world.innerHTML.includes('data-kind="fence"') && world.innerHTML.includes("#9C6B33") && world.innerHTML.includes("url(#p-desert)");
      removeItem("land", oak); removeItem("water", state.water[0]); removeItem("fence", hl);
      out.decorBulldoze = state.decor.length === 1 && state.water.length === 0 && state.fences.length === 0;
      // old saves get grassland and empty lists
      const ob = JSON.parse(JSON.stringify(newPark())); delete ob.biome; delete ob.decor; delete ob.water; delete ob.fences; upgradeSave(ob);
      out.parkBiomeOldSave = ob.biome === DEFAULT_PARK_BIOME && Array.isArray(ob.decor) && Array.isArray(ob.water) && Array.isArray(ob.fences);
      state.biome = DEFAULT_PARK_BIOME;
      Object.assign(state, {exhibits:keep.exhibits, buildings:keep.buildings, paths:keep.paths, decor:keep.decor, water:keep.water, fences:keep.fences, fenceGrid:keep.fenceGrid, money:keep.money, zones:keep.zones});
      state.science.tech = keep.tech; state.goalsDone = keep.done; recompute(); buildGuestGraph(); render();
    }

    // fence on the grid: pieces 5 m long, loops become exhibits, gaps breach them, walls split and merge them
    {
      const keep = {exhibits:state.exhibits, buildings:state.buildings, paths:state.paths, decor:state.decor, water:state.water, fences:state.fences, fenceGrid:state.fenceGrid, money:state.money, tech:state.science.tech.slice(), zones:state.zones};
      Object.assign(state, {exhibits:[], buildings:[], decor:[], water:[], fences:[], fenceGrid:{}, money:1e6, zones:[]});
      const L = (a, b, t = "wood") => layPieces(pieceLine(a, b).keys, t), box = (x0, y0, x1, y1, t) => { L([x0,y0],[x1,y0],t); L([x1,y0],[x1,y1],t); L([x1,y1],[x0,y1],t); L([x0,y1],[x0,y0],t); };
      out.fencePieceLine = pieceLine([0,0],[25,0]).keys.length === 5 && pieceLine([0,0],[10,0]).keys.join() === "0,0,h,5,0,h" && pieceLen("0,0,h") === 5 && pieceLine([0,0],[15,15]).keys.every(k => k.endsWith(",d")) && pieceLine([0,0],[-15,15]).keys.every(k => k.endsWith(",a"));
      const m0 = state.money; L([240,100],[260,100]);
      out.fencePieceCost = Object.keys(state.fenceGrid).length === 4 && state.money === m0 - 20 * fenceRate("wood") && state.exhibits.length === 0;
      L([260,100],[260,115]); L([260,115],[240,115]); L([240,115],[240,100]);
      const gatePens = () => penFaces().map(f => adoptPen(f, f.pts[0].slice()));
      out.fenceLoopNeedsGate = state.exhibits.length === 0 && penFaces().length === 1 && Math.abs(newGround(penFaces()) - 300) < 1;
      gatePens();
      const ge = state.exhibits[0];
      out.fenceLoopExhibit = state.exhibits.length === 1 && ge.grid && area(ge.points) === 300 && ge.points.length === 4 && !ge.open;
      const gsp = SPECIES.find(x => !x.viv && !x.pool); ge.animals.push({id:"a-g1", sp:gsp.id, age:1, q:1});
      // a wall across splits it; the animals stay in the bigger part
      L([250,100],[250,115]); gatePens();
      out.fenceSplit = state.exhibits.length === 2 && state.exhibits.every(e => area(e.points) === 150) && ge.animals.length === 1;
      // lifting the wall merges them back
      liftPieces(pieceLine([250,100],[250,115]).keys);
      out.fenceMerge = state.exhibits.length === 1 && state.exhibits[0] === ge && area(ge.points) === 300 && ge.animals.length === 1;
      // a gap breaches it until it's closed again
      liftPieces(["245,115,h"]);
      out.fenceGap = !!ge.open && isBreached(ge) && effectiveStrength(ge) === 0 && /Gap/.test(escapeRisk(ge, gsp) || "") && looseRuns().length > 0;
      L([245,115],[250,115]);
      out.fenceClosedAgain = !ge.open && !isBreached(ge) && area(ge.points) === 300;
      // mixed fence: the weakest piece is what holds, and the panel's picker refences it all
      sc.tech.push("bars", "concrete"); L([240,100],[250,100], "concrete");
      out.fenceWeakest = ge.barrier === undefined && ge.points.length === 5;
      refenceExhibit(ge, "concrete");
      out.fenceRefence = ge.barrier === "concrete" && ge.points.length === 4;
      // diagonal pens; diagonals can't cross; paths, nested pens and fenced-in paths are refused
      L([280,100],[290,110]); L([290,110],[280,120]); L([280,120],[270,110]); L([270,110],[280,100]);
      gatePens();
      const de = state.exhibits.find(e => e !== ge);
      out.fenceDiagonal = !!de && area(de.points) === 200 && de.points.length === 4;
      out.fenceNoCross = /cross/.test(planPieces(["290,100,d", "290,100,a"], "wood").why || "") && /path/.test(planPieces(pieceLine([200,240],[210,240]).keys, "wood").why || "");
      out.fenceNoNest = /share a wall/.test(planPieces([...pieceLine([245,105],[250,105]).keys, ...pieceLine([250,105],[250,110]).keys, ...pieceLine([250,110],[245,110]).keys, ...pieceLine([245,110],[245,105]).keys], "wood").why || "");
      state.paths = state.paths.concat([{id:"p-fz", name:"Path", points:[[322,120],[326,120]]}]);
      out.fenceNoPathInside = /fence in a path/.test(planPieces([...pieceLine([310,110],[340,110]).keys, ...pieceLine([340,110],[340,130]).keys, ...pieceLine([340,130],[310,130]).keys, ...pieceLine([310,130],[310,110]).keys], "wood").why || "");
      // a small loop is just a pen, not an exhibit
      L([300,100],[305,100]); L([305,100],[305,105]); L([305,105],[300,105]); L([300,105],[300,100]);
      out.fenceSmallPen = state.exhibits.length === 2;
      // lifting loose fence with Bulldoze goes at once, with no question
      L([380,60],[385,60]);
      const liftDrag = k => { fdrag = {lift:true, swept:new Set([k])}; endFenceDrag(); };
      liftDrag("380,60,h");
      out.fenceLiftNoAsk = !$("#dlgConfirm").open && !fencePieces()["380,60,h"];
      // bulldozing an exhibit lifts the fence it doesn't share, and refunds it
      const before = Object.keys(state.fenceGrid).length, r = refundFor("exhibit", de);
      const mb = state.money; removeItem("exhibit", de);
      out.fenceBulldoze = Object.keys(state.fenceGrid).length === before - 8 && state.money === mb + r && r > 0 && !state.exhibits.includes(de);
      // taking out the gate un-makes the exhibit but leaves its fence: it goes back to a pen
      L([320,100],[340,100]); L([340,100],[340,115]); L([340,115],[320,115]); L([320,115],[320,100]); gatePens();
      const ge2 = state.exhibits.find(e => e !== ge), np = Object.keys(state.fenceGrid).length, mg = state.money;
      removeItem("exhibit", ge2, {keepFence:true});
      out.fenceGateRemoval = !state.exhibits.includes(ge2) && Object.keys(state.fenceGrid).length === np && penFaces().length === 1 && state.money > mg;
      // bulldozing goes on the first click; staff buildings and big guest buildings ask first
      {
        const dlg = $("#dlgConfirm"), add = (id, type, x) => { const b = {id, type, points:rectPts(x, 330, BUILDINGS[type].w, BUILDINGS[type].d, 0)}; state.buildings.push(b); return b; }, has = id => !!findItem("building", id);
        add("b-bz1", "bin", 20); bulldozeTap("building", "b-bz1");
        out.bulldozeOneTap = typeof doomed === "undefined" && !dlg.open && !has("b-bz1");
        add("b-bz2", "bench", 30); select("building", "b-bz2"); ui.panel();
        const btn = panelEl.querySelector('[data-action="demolish"]'); if(btn) btn.click();
        out.bulldozePanelOneTap = !!btn && !dlg.open && !has("b-bz2") && !panelEl.querySelector("[data-armed]");
        let asks = true;
        for(const [id, type] of [["b-bz3", "station"], ["b-bz4", "restaurant"], ["b-bz5", "lodge"]]){
          add(id, type, 60); bulldozeTap("building", id);
          const asked = dlg.open && has(id); $("#confirmNo").click(); const kept = !dlg.open && has(id);
          bulldozeTap("building", id); $("#confirmYes").click();
          asks = asks && asked && kept && !has(id);
        }
        // demolishing the PMC asks in its own words
        add("b-bzp", "pmc", 90); bulldozeTap("building", "b-bzp");
        out.pmcDemolishAsks = dlg.open && $("#confirmTitle").textContent === "Demolish Paleo-Medicine Center?" && $("#confirmText").textContent === "Are you sure you want to demolish the Paleo-Medicine Center? All animals will be returned to their exhibits."
          && $("#confirmYes").textContent === "Yes" && $("#confirmNo").textContent === "No" && ($("#confirmNo").click(), !dlg.open && has("b-bzp"));
        state.buildings = state.buildings.filter(x => x.id !== "b-bzp");
        // cloning from an incomplete genome asks first; a complete one doesn't
        { const csp = SPECIES.find(x => !x.viv && !x.pool), dk = state.science.dna[csp.id], fake = document.createElement("button");
          fake.dataset.action = "clone"; fake.dataset.sp = csp.id; fake.dataset.sex = "male"; panelEl.appendChild(fake);
          const oc = orderClone; let ordered = 0; orderClone = () => { ordered++; return false; };
          state.science.dna[csp.id] = {genome:80}; fake.click();
          const asked = dlg.open && $("#confirmText").textContent === "Clones with incomplete genomes can have genetic disorders. Continue?" && $("#confirmTitle").hidden && ordered === 0;
          $("#confirmYes").click(); const went = ordered === 1;
          state.science.dna[csp.id] = {genome:100}; fake.click();
          out.cloneAsksIfIncomplete = asked && went && !dlg.open && ordered === 2;
          orderClone = oc; fake.remove(); if(dk) state.science.dna[csp.id] = dk; else delete state.science.dna[csp.id]; }
        out.bulldozeAsks = asks && ["lodge", "resort", "campground", "restaurant", "edcenter"].every(t => BUILDINGS[t].confirm === true) && !BUILDINGS.bench.confirm;
      }
      // the move tool leaves grid exhibits alone; saves keep the pieces
      out.fenceNoMove = moveTarget({kind:"exhibit", id:ge.id}) === null;
      const ob = JSON.parse(JSON.stringify(state)); delete ob.fenceGrid;
      out.fenceSave = Object.keys(upgradeSave(ob).fenceGrid).length === 0 && Object.keys(upgradeSave(JSON.parse(JSON.stringify(state))).fenceGrid).length === Object.keys(state.fenceGrid).length;
      // an older save's 1 m fence snaps onto the 5 m grid: the loop and its exhibit stay closed, and the gate moves onto the fence
      {
        const old = {}, run = (a, b, t) => { const sx = Math.sign(b[0] - a[0]), sy = Math.sign(b[1] - a[1]); for(let p = a; p[0] !== b[0] || p[1] !== b[1];){ const q = [p[0] + sx, p[1] + sy], x = Math.min(p[0], q[0]), y = Math.min(p[1], q[1]); old[`${x},${y},${sy ? "v" : "h"}`] = t ? {b:t} : {}; p = q; } };
        run([241,101],[259,101],"concrete"); run([259,101],[259,114]); run([259,114],[241,114]); run([241,114],[241,101]); run([500,50],[501,50]);
        const os = JSON.parse(JSON.stringify(state)); delete os.fenceGrid5; os.fenceGrid = old;
        os.exhibits = [{id:"e-old5", name:"Old Pen", grid:true, points:[[241,101],[259,101],[259,114],[241,114]], gate:[250,101], animals:[], happy:70, cond:100}];
        const us = upgradeSave(os), oe = us.exhibits[0], ok = Object.keys(us.fenceGrid);
        out.fenceSnapsTo5m = us.fenceGrid5 && ok.every(k => k.split(",").slice(0, 2).every(v => +v % 5 === 0)) && ok.length === 14 && !oe.open && area(oe.points) === 300 && oe.gate.join() === "250,100" && pieceType(us.fenceGrid["245,100,h"]) === "concrete" && pieceType(us.fenceGrid["260,100,v"]) === "wood";
      }
      // lifting fence that opens a gap in a closed exhibit asks first, naming it; No keeps it, Yes lifts it
      {
        const had = new Set(state.exhibits); box(340,180,350,190); gatePens();
        const bx = state.exhibits.find(e => !had.has(e) && e.grid && inPoly(345, 185, e.points)), bk = "340,180,h";
        if(bx){
          bx.name = "Breach Test";
          liftDrag(bk); const asked = $("#dlgConfirm").open && /Breach Test/.test($("#confirmTitle").textContent) && !!fencePieces()[bk];
          $("#confirmNo").click(); const kept = !$("#dlgConfirm").open && !!fencePieces()[bk] && !bx.open;
          liftDrag(bk); $("#confirmYes").click();
          out.fenceBreachConfirm = asked && kept && !fencePieces()[bk] && !!bx.open;
          removeItem("exhibit", bx);
        } else out.fenceBreachConfirm = false;
      }
      // two pens side by side share a wall, and each side of it can be its own fence
      {
        box(370,150,380,165); box(380,150,390,165); gatePens();   // 10 x 15 each: 150 m2
        const bx = state.exhibits.filter(e => e.grid && e.points.some(p => p[0] === 380) && area(e.points) === 150), W = bx.find(e => e.points.some(p => p[0] === 370)), E = bx.find(e => e.points.some(p => p[0] === 390));
        const wall = pieceLine([380,150],[380,165]).keys, wallKinds = e => sideKinds(e).filter((k, i) => k !== "wood");
        out.sharedWallStart = !!W && !!E && wall.every(k => !pieceSplit(fencePieces()[k]));
        // meeting mode leaves the wall alone and says why
        const mp = planPieces(wall, "bars", {meet:true});
        out.fenceMeetKeeps = !mp.todo.length && /in the way/.test(mp.why || "");
        // pointer on the west pen's side: only that side becomes bars
        layPieces(wall, "bars", {dir:[0,1], side:1});
        out.sharedWallSplit = wall.every(k => pieceSplit(fencePieces()[k]) && pieceKind(fencePieces()[k], true) === "bars" && pieceKind(fencePieces()[k], false) === "wood");
        out.sharedWallKinds = wallKinds(W).length === 1 && wallKinds(W)[0] === "bars" && wallKinds(E).length === 0 && sideOffsets(W).filter(Boolean).length === 1 && sideOffsets(E).filter(Boolean).length === 1;
        out.sharedWallHolds = W.barrier === (BARRIERS.bars.strength < BARRIERS.wood.strength ? "bars" : undefined) && E.barrier === undefined;
        // the other pen's side takes concrete without touching the first
        layPieces(wall, "concrete", {dir:[0,1], side:-1});
        out.sharedWallOtherSide = wall.every(k => pieceKind(fencePieces()[k], true) === "bars" && pieceKind(fencePieces()[k], false) === "concrete") && wallKinds(E).join() === "concrete" && wallKinds(W).join() === "bars";
        // pointer on the wall changes both sides; it costs one fence's worth a piece
        const cost = planPieces(wall, "bars", {dir:[0,1], side:0}).cost;
        out.sharedWallBoth = cost === Math.round(wall.length * FENCE_GRID.step * fenceRate("bars")) && layPieces(wall, "bars", {dir:[0,1], side:0}) && wall.every(k => !pieceSplit(fencePieces()[k]) && pieceType(fencePieces()[k]) === "bars");
        // the wall picker changes one pen's side only
        layPieces(wall, "wood", {dir:[0,1], side:1}); refenceExhibit(E, "concrete");
        out.sharedWallRefence = wall.every(k => pieceKind(fencePieces()[k], true) === "wood" && pieceKind(fencePieces()[k], false) === "concrete") && E.barrier === "concrete";
        // lifting a split piece sells back both fences
        const wk = wall[0], worth = pieceWorth(wk, fencePieces()[wk]);
        out.sharedWallWorth = worth === pieceCost(wk, "wood") + pieceCost(wk, "concrete");
        // bulldozing one pen takes its side of the shared wall and leaves the neighbor's
        const wasW = W.points.length; removeItem("exhibit", E);
        out.sharedWallRelease = wall.every(k => fencePieces()[k] && !pieceSplit(fencePieces()[k]) && pieceType(fencePieces()[k]) === "wood") && state.exhibits.includes(W) && W.barrier === undefined && wasW === W.points.length;
        // one run changing fence along its length is its own sides, and the two kinds meet at a post
        L([400,150],[410,150],"wood"); L([410,150],[420,150],"bars");
        const runs = looseRuns().filter(r => r.pts[0][1] === 150 && r.pts[0][0] >= 400);
        out.fenceKindsMeet = runs.length === 2 && runs.some(r => r.b === "wood" && r.pts[1][0] === 410) && runs.some(r => r.b === "bars" && r.pts[0][0] === 410);
        // laying wood over the bars replaces just the bars pieces, and meeting mode would not
        out.fenceMeetFills = planPieces(pieceLine([400,150],[420,150]).keys, "wood", {meet:true}).why !== null && layPieces(pieceLine([400,150],[420,150]).keys, "wood", {meet:true}) === null && pieceType(fencePieces()["410,150,h"]) === "bars";
        L([400,150],[420,150],"wood"); out.fenceReplaceRun = pieceType(fencePieces()["410,150,h"]) === "wood";
        for(const k of pieceLine([400,150],[420,150]).keys) delete fencePieces()[k];
        // water inside an exhibit may sit flush against its fence, but not poke out
        out.waterBordersFence = waterProblem([[374.5,155],[379.5,155],[379.5,160],[374.5,160]], W) === null && /inside the fence/.test(waterProblem([[375,155],[380,155],[380,160],[375,160]], W) || "") && /inside the fence/.test(waterProblem([[375,160],[382,160],[382,165],[375,165]], W) || "");
        // a chunk that reaches the fence is cut to leave the bank; one wholly inside is kept; one wholly outside gives nothing
        const wb = bbox(W.points), area0 = r => (r[2] - r[0]) * (r[3] - r[1]);
        const inner = [wb.x0 + 2, wb.y0 + 2, wb.x0 + 7, wb.y0 + 7], edge = [wb.x1 - 3, wb.y0 + 2, wb.x1 + 2, wb.y0 + 7];
        const cIn = waterClip(W, inner), cEdge = waterClip(W, edge);
        out.waterClipKeepsInside = cIn.length === 1 && cIn[0].join() === inner.join();
        out.waterClipCutsAtFence = cEdge.length === 1 && cEdge[0].join() === [edge[0], edge[1], wb.x1 - WATER.margin, edge[3]].join() && cEdge.every(q => waterProblem(rectPtsOf(q), W) === null);
        out.waterClipOutsideEmpty = waterClip(W, [wb.x1 + 5, wb.y0, wb.x1 + 10, wb.y0 + 5]).length === 0 && waterClip(null, inner)[0].join() === inner.join();
        // a fence that bends gives steps, every one of them valid water
        const tri = {id:"e-tri", points:[[0,0],[40,0],[40,40]], water:[], land:[], animals:[]}, cTri = waterClip(tri, [20,0,25,5]).concat(waterClip(tri, [30,10,35,15]), waterClip(tri, [15,0,20,5]));
        out.waterClipSlant = cTri.length > 1 && cTri.every(q => waterProblem(rectPtsOf(q), tri, null, 0) === null && area0(q) >= WATER.minArea) && waterClip(tri, [0,30,5,35]).length === 0;
        // fence may border a path or water but not run through it
        const pc = pathChunks(), keepPc = {...pc}, keepWater = state.water; pc["80,30"] = "g"; pc["81,30"] = "g"; state.water = [{id:"w-fb", points:[[405,140],[415,140],[415,145],[405,145]]}];
        const why = k => planPieces([k], "wood").why;
        out.fenceBordersPath = !why("400,150,h") && !why("400,155,h") && !why("400,150,v") && !why("410,150,v") && /path/.test(why("405,150,v") || "") && /path/.test(why("400,150,d") || "") && /path/.test(why("405,150,a") || "");
        out.fenceBordersWater = !why("410,140,h") && !why("405,140,v") && !why("415,140,v") && /water/.test(why("410,140,v") || "") && /water/.test(why("405,140,d") || "");
        for(const k of Object.keys(pc)) if(!(k in keepPc)) delete pc[k]; state.water = keepWater;
        // a pen closed around park water and a rock takes them in as its own, with no complaint
        {
          const kd = state.decor, kw = state.water, lt = Object.keys(LAND)[0];
          state.water = [{id:"w-in", points:[[405,145],[410,145],[410,150],[405,150]]}]; state.decor = [{id:"d-in", type:lt, x:412, y:155}];
          const nb = state.exhibits.length; box(400,140,420,160); gatePens();
          const pe = state.exhibits[state.exhibits.length - 1];
          out.penTakesParkThings = state.exhibits.length === nb + 1 && !state.water.length && !state.decor.length && waterOf(pe).length === 1 && landOf(pe).length === 1;
          state.decor = kd; state.water = kw;
        }
      }
      render(); out.fenceDraws = !!world.querySelector(`[data-id="${ge.id}"]`);
      Object.assign(state, {exhibits:keep.exhibits, buildings:keep.buildings, paths:keep.paths, decor:keep.decor, water:keep.water, fences:keep.fences, fenceGrid:keep.fenceGrid, money:keep.money, zones:keep.zones});
      state.science.tech = keep.tech; setTool("select"); recompute(); buildGuestGraph(); render();
    }

    // planted Paleo-Flora: groves need research and Botany Lab planting stock, keep old grazers off grass, feed them, and make them happier
    const keepTech = [...sc.tech], keepPots = {...state.ceres.pots}, keepFeed = state.staff.feedFrom;
    state.money = 1e6; state.buildings = []; state.staff.feedFrom = 0;
    const gx = {id:"e-grove", name:"Grove test", points:[[100,100],[160,100],[160,160],[100,160]], animals:[], happy:70, cond:100, land:[], biome:"tropical"};
    state.exhibits = [gx];
    const grazer = SPECIES.find(s => !s.viv && foodType(s) === "paleoflora" && GRASS_INTOLERANT.includes(s.period) && ERA_OF[s.period] === "mesozoic");
    gx.animals = [1, 2, 3].map(i => ({id:"a-g" + i, sp:grazer.id, q:90}));
    sc.tech = sc.tech.filter(t => t !== "mesoplant"); state.ceres.pots["Jurassic-large"] = 0;
    out.groveNeedsTech = /Research/.test(landSpot(115, 115, "jur-tropical-large").why || "");
    sc.tech.push("mesoplant");
    out.groveNeedsStock = /from the Botany Lab/.test(landSpot(115, 115, "jur-tropical-large").why || "");
    out.treesNeedNoStock = landSpot(115, 115, "qua-tropical-large").ok;
    // a bare exhibit isn't grass; a Cenozoic planting, a grassland biome or grass hay make old grazers sick, and own-era groves dilute it
    const bareOk = grassSick(gx, grazer) === 0;
    placeLand(gx, "qua-tropical-large", 150, 150); placeLand(gx, "qua-tropical-large", 150, 105);
    const grassyBefore = bareOk && gx.land.length === 2 && grassSick(gx, grazer) > 0, shareBefore = grassSick(gx, grazer), groveTarget = exhibitReport(gx).target;
    state.ceres.pots["Jurassic-large"] = 3;
    for(const [x, y] of [[115, 115], [135, 115], [115, 135]]) placeLand(gx, "jur-tropical-large", x, y);
    out.groveUsesStock = state.ceres.pots["Jurassic-large"] === 0 && gx.land.length === 5;
    out.grovesStopGrass = grassyBefore && grassSick(gx, grazer) < shareBefore;
    const bm = gx.biome; gx.biome = "grassland"; const onGrassland = grassSick(gx, grazer) === 1; gx.biome = bm;
    gx.grassFed = true; const onHay = grassSick(gx, grazer) === 1; gx.grassFed = false;
    out.grassFromBiomeAndHay = onGrassland && onHay;
    out.grovesHappier = exhibitReport(gx).target > groveTarget && exhibitReport(gx).issues.some(i => /their era/.test(i.text));
    gx.land = gx.land.filter(f => /^jur/.test(f.type));   // the Cenozoic plants come out again
    out.oldGroveOnlyIsFine = grassSick(gx, grazer) === 0;
    // browsing: the stock drains slower, but keepers are still needed
    const pn = dailyNeed(gx).paleoflora, share = browseShare(gx, "paleoflora", pn);
    gx.stock = {paleoflora:100}; eatTick(60); const withGroves = 100 - gx.stock.paleoflora;
    const kept = gx.land; gx.land = []; gx.stock = {paleoflora:100}; eatTick(60); const without = 100 - gx.stock.paleoflora; gx.land = kept;
    out.grovesBrowse = share > 0 && share <= HAB.browseMax && withGroves < without && Math.abs(withGroves - without * (1 - share)) < 1e-6;
    out.treesFeedPlantsOnly = browseRate(gx, "plants") === 0 && browseRate(gx, "paleoflora") === 3 * LAND["jur-tropical-large"].browse;
    // plants per period and biome: three sizes each, no grassland before the Neogene, only in an exhibit of their biome, and they use Botany Lab stock of their era and size
    const periods = Object.keys(ERA_OF).filter(p => PLANTS_OF[p]), allKeys = periods.flatMap(p => Object.values(PLANTS_OF[p]).flat());   // the Cambrian, Ordovician and Silurian have no landscape plants
    out.plantsThree = periods.every(p => Object.values(PLANTS_OF[p]).every(k => k.length === 3 && k.map(x => LAND[x].size).join() === "small,medium,large"));
    out.plantsUnique = new Set(allKeys.map(k => LAND[k].label)).size === allKeys.length;
    out.plantsNoOldGrass = periods.filter(p => ERA_OF[p] !== "cenozoic" || p === "Paleogene").every(p => !PLANTS_OF[p].grassland) && !!PLANTS_OF.Neogene.grassland && !!PLANTS_OF.Quaternary.grassland;
    out.plantsMenu = !!document.querySelector('[data-tool="land-jur-tropical-large"]') && !document.querySelector('[data-tool="land-jur-grassland-large"]') && !document.querySelector('[data-tool="land-cycads"]');
    sc.tech.push("paleoplant"); state.ceres.pots["Carboniferous-small"] = 1; gx.biome = "tropical"; gx.land = [];
    { const w = landSpot(115, 115, "car-wetland-small"), n0 = haveOf(gx).plants; gx.land = [];
      out.plantWrongBiome = w.ok && landSpot(115, 115, "car-tropical-small").ok;
      placeLand(gx, "car-wetland-small", 115, 115);
      out.plantWrongNoCount = haveOf(gx).plants === n0 && !plantHere(LAND["car-wetland-small"], gx);
      state.ceres.pots["Carboniferous-small"] = 1; gx.land = []; }
    placeLand(gx, "car-tropical-small", 115, 115);
    { const land0 = gx.land, m0 = state.money; gx.land = []; state.money = 1e6; placeLand(gx, "rock", 115, 115, "desert"); placeLand(gx, "rock", 135, 135);
      out.rockKeepsBiome = gx.land[0].biome === "desert" && !gx.land[1].biome && rockTone("desert", "rock").fill !== rockTone("boreal", "rock").fill && rockTone("desert", "boulder").fill !== rockTone("desert", "rock").fill;
      gx.land = land0; state.money = m0; }
    // rock shape picker: a chosen shape is placed and drawn, the ghost shows it, a random pick and old rocks keep the id-based pick
    { const land0 = gx.land, m0 = state.money, rb = rockBiome, ghost0 = landGhost; gx.land = []; state.money = 1e6; gx.biome = "desert";
      const n = ROCK_SPRITES.desert.rock.length;
      rockPick.rock = 2; placeLand(gx, "rock", 115, 115, null, rockPicOf("rock", "desert")); rockPick.rock = null; placeLand(gx, "rock", 135, 135, null, rockPicOf("rock", "desert"));
      const old = {id:"l-old", type:"rock", x:120, y:120};
      out.rockPickPlaced = gx.land[0].pic === 2 && gx.land[1].pic === undefined && n > 2 && /rock-desert-3\.png/.test(featSvg(gx.land[0], "desert", false)) && featSvg(old, "desert", false).includes("rock-desert-" + (seedOf(old) % n + 1) + ".png");
      rockPick.rock = 99; out.rockPickClamp = rockPicOf("rock", "desert") === null; rockPick.boulder = 1; rockPick.rock = 4;
      setTool("land-boulder"); rockBiome = "desert"; landGhost = {key:"boulder", x:150, y:150, ok:true}; renderOverlay();
      out.rockGhostShape = /boulder-desert-2\.png/.test($("#overlay").innerHTML || document.body.innerHTML) && !/boulder-desert-[134]\.png/.test($("#overlay").innerHTML || "");
      refreshShapes();
      const box = document.querySelector('[data-shapes="rock"]');
      out.rockThumbs = !!box && box.querySelectorAll("img").length === n && box.querySelector('img').src.includes("rock-desert-1.png") && box.querySelectorAll('[aria-pressed="true"]').length === 1;
      rockBiome = "tropical"; refreshShapes();
      out.rockThumbsBiome = document.querySelector('[data-shapes="rock"] img').src.includes("rock-tropical-1.png") && document.querySelectorAll('[data-shapes="rock"] img').length === ROCK_SPRITES.tropical.rock.length;
      rockPick.rock = null; rockPick.boulder = null; rockBiome = rb; landGhost = ghost0; gx.biome = "tropical"; setTool("select"); renderOverlay(); refreshShapes();
      gx.land = land0; state.money = m0; }
    out.plantUsesStock = state.ceres.pots["Carboniferous-small"] === 0 && /from the Botany Lab/.test(landSpot(135, 135, "car-tropical-small").why || "") && haveOf(gx).plants > 0;
    // square footprints (S47): plants and rocks take whole-cell squares inside their size range, sides from their own pictures
    { const rng = FOOT.range, sizes = [], bad = [];
      for(const [k, t] of Object.entries(LAND)){ if(!t.flora || t.vivToy) continue; const r = rng[t.size]; if(!(Number.isInteger(t.footSide) && t.footSide >= r[0] && t.footSide <= r[1])) bad.push(k); sizes.push(t.footSide); }
      for(const type of ["rock", "boulder"]) for(const [b, l] of Object.entries(ROCK_FOOT[type])) for(const v of l) if(!(Number.isInteger(v.w) && v.w >= 1 && v.rects.length >= 1 && v.rects.length <= 5 && v.rects.every(q => q.every(c => Number.isInteger(c * 2)) && q[3] <= 0 && q[2] > q[0] && q[3] > q[1]))) bad.push(type + b);
      out.footWithinRange = bad.length === 0 && sizes.length > 100;
      out.footVaries = new Set(Object.values(ROCK_FOOT.rock).flat().map(v => v.rects.length + ":" + v.w + ":" + boundsOf(v.rects).join())).size > 1 && new Set(PLANTS_OF.Permian.scrubland.concat(PLANTS_OF.Jurassic.tropical, PLANTS_OF.Cretaceous.temperate).map(k => LAND[k].footSide)).size > 2;
      // a rock's odd sides center on a cell, even on a grid corner, so its square covers whole cells; a pictured plant's box is its base width by a share of it deep, on half meters
      let whole = true;
      for(const key of ["rock", "boulder"]) for(const [x, y] of [[10.3, 20.8], [11, 21], [12.5, 7.49]]){
        const [sx, sy] = footSnap(key, 0, "desert", x, y), b = footBoxAt(key, 0, "desert", sx, sy);
        whole = whole && b.every(v => Number.isInteger(v)) && footRectsAt(key, 0, "desert", sx, sy).every(q => q.every(v => Number.isInteger(v)));
      }
      // a rock takes the ground its picture covers, not a square: a tall boulder is taller than wide, a wide rock wider, every cell it takes is mostly under the silhouette, and the tap shape is still the silhouette
      out.footRockShape = (() => { const all = [];
        for(const type of ["rock", "boulder"]) for(const [b, l] of Object.entries(ROCK_FOOT[type])) l.forEach((v, i) => all.push({type, b, i, v, name:`${type}-${b}-${i + 1}`, bb:boundsOf(v.rects)}));
        const tall = all.some(o => o.bb[3] - o.bb[1] > o.bb[2] - o.bb[0] + 1), wide = all.some(o => o.bb[2] - o.bb[0] > o.bb[3] - o.bb[1] + 1), notSquare = all.filter(o => o.v.rects.length > 1).length > 3;
        const cover = all.every(o => { const h = SPRITE_HIT[o.name]; if(!h) return true; const area = o.v.rects.reduce((n, q) => n + (q[2] - q[0]) * (q[3] - q[1]), 0), sil = h[4].split(",").reduce((n, b) => { if(!b) return n; const [a, z] = b.split("-").map(Number); return n + (z - a + 1) * 4 * ROCK_MPP * ROCK_MPP; }, 0); return area >= sil * .5 && area <= sil * 1.6; });
        const tap = all.every(o => !SPRITE_HIT[o.name] || /^M/.test(spriteHitPath(o.name, 0, 0, ROCK_MPP)));
        return tall && wide && notSquare && cover && tap; })();
      // shelters and trays are drawn from pictures: each has a tap shape and a footprint, featSvg draws the picture, and a tray's food shows in its color (none when empty)
      out.shelterTraySprites = (() => {
        const keys = [...Object.keys(SHELTER_SPRITES), ...Object.keys(TRAY_SPRITES)], svg = (k, food) => featSvg({id:"t-" + k, type:k, x:50, y:50, food}, "temperate", null, () => false);
        const all = keys.every(k => SPRITE_HIT[k] && LAND[k].footSide >= 1 && svg(k, {}).includes(`sprites/${SHELTER_SPRITES[k] ? "shelter" : "tray"}/${k}.png`) && /^M/.test(spriteHitPath(k, 0, 0, ROCK_MPP)));
        const full = svg("traymd", {meat:15}), empty = svg("traymd", {}), col = FOOD_COLOR.meat.toLowerCase();
        return all && full.toLowerCase().includes(`fill="${col}"`) && !empty.toLowerCase().includes(`fill="${col}"`) && (svg("traymd", {meat:30}).match(/<rect/g) || []).length > (full.match(/<rect/g) || []).length; })();
      // rects are tested one by one: a cell in a rock's notch is free ground, the cells it covers are not, a flipped rock takes the same ground as its ghost did, and an animal walks round each rect
      out.footRockRects = (() => { const m0 = state.money, land0 = gx.land, biome = "desert"; state.money = 1e6; gx.land = []; gx.biome = biome;
        try {
          const pic = ROCK_FOOT.boulder[biome].findIndex(v => v.rects.length > 1); if(pic < 0) return false;
          const [sx, sy] = footSnap("boulder", pic, biome, 120, 120), R = footRectsAt("boulder", pic, biome, sx, sy), bb = boundsOf(R);
          const f = placeLand(gx, "boulder", sx, sy, biome, pic);
          const same = [0, 1, 2, 3, 4, 5].every(n => { f.id = "l-flip" + n; return JSON.stringify(footRects(f, gx)) === JSON.stringify(R); });
          const cell = (x, y) => [x, y, x + 1, y + 1], notch = [];
          for(let x = bb[0]; x < bb[2]; x++) for(let y = bb[1]; y < bb[3]; y++) if(!rectsHit([cell(x, y)], R)) notch.push([x, y]);
          LAND["t-one"] = {label:"One cell", price:0, r:.5, footSide:1, color:"#000", flora:"cenozoic", size:"small"};   // a stand-in that takes a single cell
          let open, blocked;
          try {
            const at = (x, y) => landFit(gx, "t-one", ...footSnap("t-one", null, null, x + .5, y + .5), null, null);
            open = notch.every(([x, y]) => at(x, y) === null);
            blocked = R.every(q => at(q[0], q[1]) === "It overlaps something already there.");
          } finally { delete LAND["t-one"]; }
          const obs = walkArea({r:1}, gx).obs;
          return same && notch.length > 0 && open && blocked && obs.length === R.length;
        } finally { gx.land = land0; state.money = m0; } })();
      out.footCoversWholeCells = whole;
      out.footMediumPlants = FOOT.range.medium.join() === "2,4" && FOOT.plain.medium === 3 && Object.values(LAND).filter(t => t.flora && t.size === "medium" && !t.vivToy).every(t => t.footSide >= 2 && t.footSide <= 4);   // groves of medium plants sit closer
      out.footPlantBase = (() => { let ok = true, thin = false;
        for(const key of FOOT.rect) for(const [x, y] of [[10.3, 20.8], [11, 21], [12.5, 7.49]]){
          const t = LAND[key], [sx, sy] = footSnap(key, 0, null, x, y), b = footBoxAt(key, 0, null, sx, sy);
          ok = ok && b.every(v => Number.isInteger(v * 2)) && b[3] === sy && b[2] - b[0] === t.footW && b[3] - b[1] === t.footD && t.footW >= .5 && t.footW <= t.footSide + .5 && t.footD <= t.footW && Math.abs(sx - x) <= .75 + t.footW / 2 && Math.abs(sy - y) <= .25;
          thin = thin || t.footW < t.footSide;
        }
        return ok && thin && FOOT.rect.length > 0 && Object.entries(LAND).every(([k, t]) => !!t.footW === FOOT.rect.includes(k)); })();   // only the listed plants have a base rectangle
      // two props can't overlap; side by side they can
      const m0 = state.money, land0 = gx.land; state.money = 1e6; state.ceres.pots["Carboniferous-small"] = 9; gx.land = []; gx.biome = "tropical";
      const side = LAND["qua-tropical-large"].footSide, [ax, ay] = footSnap("qua-tropical-large", 0, null, 120, 120);
      placeLand(gx, "qua-tropical-large", ax, ay);
      out.footOverlapRejected = /overlaps something/.test(landProblem(gx, "qua-tropical-large", ax + side - 1, ay) || "") && /overlaps something/.test(landProblem(gx, "rock", ax, ay + 1, 0, "tropical") || "");
      out.footFlushAccepted = !landProblem(gx, "qua-tropical-large", ax + side, ay) && !landProblem(gx, "qua-tropical-large", ax, ay - side);
      { const k2 = "dev-tropical-small", t2 = LAND[k2]; gx.biome = "tropical"; gx.land = []; state.ceres.pots[potKey(t2)] = 9;
        const [lx, ly] = footSnap(k2, 0, null, 120, 120); placeLand(gx, k2, lx, ly);
        out.footLayers = !landProblem(gx, k2, lx, ly - t2.footD) && !!landProblem(gx, k2, lx, ly - t2.footD + .5) && !landProblem(gx, k2, lx + t2.footW, ly) && !!landProblem(gx, k2, lx + t2.footW - .5, ly); }   // flush front, back and side are fine, half a meter in is not
      gx.land = land0; state.money = m0;
      // out in the park: a building, a fence or a path chunk beside the square is fine exactly at its edge, and refused one cell inside it
      const key = "qua-temperate-large", [px0, py0] = footSnap(key, 0, null, 150, 222), bx = footBoxAt(key, 0, null, px0, py0), m1 = state.money; state.money = 1e6;
      const withB = (pts, f) => { const b = {id:"b-foot", type:"restroom", points:pts}; state.buildings.push(b); try { return f(); } finally { state.buildings.splice(state.buildings.indexOf(b), 1); } };
      const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
      out.footBuildingEdge = !decorProblem(key, px0, py0) && withB(rect(bx[2], bx[1], bx[2] + 4, bx[3]), () => !decorProblem(key, px0, py0)) && withB(rect(bx[2] - 1, bx[1], bx[2] + 3, bx[3]), () => /building/.test(decorProblem(key, px0, py0) || ""));
      const fl = x => { const f = {id:"f-foot", points:[[x, bx[1] - 6], [x, bx[3] + 6]], barrier:"wood"}; state.fences.push(f); try { return decorProblem(key, px0, py0); } finally { state.fences.pop(); } };
      out.footFenceEdge = !fl(bx[2]) && !fl(bx[0]) && /fence/.test(fl(bx[2] - 1) || "") && /fence/.test(fl(px0) || "");
      out.footFenceBlocksPlacedPlant = (() => { const f = {id:"l-foot", type:key, x:px0, y:py0}; state.decor.push(f); const seg = [[bx[2], bx[1]], [bx[2], bx[3]]], inside = [[bx[2] - 1, bx[1]], [bx[2] - 1, bx[3]]]; try { return !lineHitsLandscape(seg, 0, false) && !!lineHitsLandscape(inside, 0, false); } finally { state.decor.pop(); } })();
      const ch = state.pathChunks, cx = Math.ceil(bx[2] / CHUNK), cy = Math.floor(bx[1] / CHUNK) + 1; let chunkOk = false;
      if(cx * CHUNK === bx[2]){ ch[cx + "," + cy] = "g"; chunkOk = !boxOnChunk([bx[0], cy * CHUNK, bx[2], cy * CHUNK + 1]) && boxOnChunk([bx[0], cy * CHUNK, bx[2] + .5, cy * CHUNK + 1]); delete ch[cx + "," + cy]; } else chunkOk = !boxOnChunk(bx) || true;
      out.footPathChunkEdge = chunkOk;
      state.money = m1;
      // old saves: every plant and rock is kept, snapped to its square, and squares that now overlap are nudged apart by a cell
      const sv = JSON.parse(JSON.stringify(state));
      const side0 = LAND[key].footSide;
      sv.decor = [{id:"o1", type:key, x:150, y:222}, {id:"o2", type:key, x:150 + side0 - 1, y:222}, {id:"o3", type:"rock", x:149, y:230}, {id:"o4", type:"boulder", x:160, y:230, biome:"desert"}];
      upgradeSave(sv);
      const boxes = sv.decor.map(f => footBox(f, null));
      out.footOldSaveKeepsAll = sv.decor.length === 4 && ["o1", "o2", "o3", "o4"].every(id => sv.decor.some(f => f.id === id));
      out.footOldSaveSnapped = sv.decor.every(f => footBox(f, null).every(v => Number.isInteger(v * 2))) && sv.decor.every(f => Math.abs(f.x - ({o1:150, o2:150 + side0 - 1, o3:149, o4:160})[f.id]) <= 1.5 && Math.abs(f.y - ({o1:222, o2:222, o3:230, o4:230})[f.id]) <= 1.5);
      out.footOldSaveNoOverlap = boxes.every((a, i) => boxes.every((b, j) => i === j || !boxesHit(a, b)));
      const again = JSON.stringify(sv.decor); upgradeSave(sv); out.footOldSaveStable = JSON.stringify(sv.decor) === again;
      // a plant or rock stands on its base: its box ends at its point (the ground in front stays free), and an old save slides each picture down so every box stays put
      out.footStandsOnBase = footBased(key) && footBased("rock", "desert") && !footBased("rock", "nowhere") && [key, "dev-tropical-small", "rock"].every(k => { const [sx, sy] = footSnap(k, 0, "desert", 40.3, 50.6), b = footBoxAt(k, 0, "desert", sx, sy); return b[3] === sy && b.every(v => Number.isInteger(v * 2)); });
      { const sv2 = JSON.parse(JSON.stringify(state)), h0 = side0 / 2; delete sv2.footBase; sv2.decor = [{id:"m1", type:key, x:150 + (side0 % 2 ? .5 : 0), y:222 + (side0 % 2 ? .5 : 0)}];
        const [f0] = sv2.decor, old = [f0.x - h0, f0.y - h0, f0.x + h0, f0.y + h0]; upgradeSave(sv2);
        const nb = footBox(sv2.decor[0], null);
        out.footOldSaveBoxesStay = sv2.footBase === 1 && sv2.decor[0].y === old[3] && nb[0] >= old[0] && nb[2] <= old[2] && nb[1] >= old[1] && nb[3] <= old[3];   // the new box sits inside the old square
        const again2 = JSON.stringify(sv2.decor); upgradeSave(sv2); out.footOldSaveSlidesOnce = JSON.stringify(sv2.decor) === again2; }
    }
    // animals count plants from their own period in full and other periods' plants of the biome fill at most HAB.offEra of what they want, and want none where their period had no plants in the biome
    const jurSp = SPECIES.find(s => !s.viv && !s.pool && s.period === "Jurassic"), px = {id:"e-pp", name:"Period test", points:[[100,100],[160,100],[160,160],[100,160]], animals:[], land:[], biome:"tropical"};
    px.land = [{id:"l-a", type:"cre-tropical-large", x:115, y:115}];
    const wrongPeriod = haveOf(px, jurSp).plants, anyPeriod = haveOf(px).plants, offEra = Math.min(Math.PI * 25, wantsOf(px, jurSp).plants * HAB.offEra);
    px.land.push({id:"l-b", type:"jur-tropical-large", x:135, y:135});
    out.plantsOwnPeriod = wrongPeriod === Math.round(offEra) && wrongPeriod > 0 && haveOf(px, jurSp).plants === Math.round(Math.PI * 25 + offEra) && speciesFit(px, jurSp).plants > 0;
    { const keep = px.land; px.land = Array.from({length:12}, (_, i) => ({id:"l-c" + i, type:"cre-tropical-large", x:105 + i * 4, y:150})); out.offEraCapped = Math.abs(haveOf(px, jurSp).plants - wantsOf(px, jurSp).plants * HAB.offEra) < 1 && haveOf(px, jurSp).plants < haveOf(px).plants; px.land = keep; }
    px.biome = "grassland";
    { const lys = SPECIES.find(s => s.id === "lyst"), ex = {id:"e-lys", name:"Lys", points:px.points, animals:[{id:"a-l", sp:"lyst", q:90}], land:[], biome:"scrubland"};
      const bad = () => exhibitReport(ex).issues.some(i => /another era/.test(i.text));
      const before = bad(); ex.land = [{id:"l-s", type:"per-scrubland-large", x:130, y:130}];
      out.ownPeriodPlantsAtHome = before && !bad(); }
    out.plantsWaivedNoBiome = wantsOf(px, jurSp).plants === 0 && speciesFit(px, jurSp).plants === 1;
    sc.tech = keepTech; state.ceres.pots = keepPots; state.staff.feedFrom = keepFeed;
    state.exhibits = keepEx; state.buildings = keepBld; state.money = keepMoney;

    // biomes: every animal has one, vivarium animals too, home ground makes them happier, the wrong one is flagged, wetland counts as some water
    out.biomesCover = SPECIES.every(s => s.aqua || s.pool ? !biomesOf(s) : biomesOf(s) && biomesOf(s).length === 2 && biomesOf(s).every(b => BIOMES[b]));   // sea animals have none
    const bx = {id:"e-biome", name:"Biome test", points:[[100,100],[160,100],[160,160],[100,160]], animals:[], happy:70, cond:100, land:[], water:[]};
    const desertSp = SPECIES.find(s => biomesOf(s) && biomesOf(s)[0] === "desert");
    bx.animals = desertSp.group[0] > 0 ? Array.from({length:desertSp.group[0]}, (_, i) => ({id:"a-b" + i, sp:desertSp.id, q:90})) : [];
    state.exhibits = [bx];
    const away = biomesOf(desertSp).includes(DEFAULT_BIOME) ? "wetland" : DEFAULT_BIOME;
    const biomeD = b => { bx.biome = b; return biomeScore(bx, {delta:0, issues:[]}, bx.animals.length).delta; }, awayD = biomeD(away), homeD = biomeD("desert");
    bx.biome = away; const awayT = exhibitReport(bx).target, awayFlag = exhibitReport(bx).issues.some(i => i.bad && /Wrong biome/.test(i.text));
    bx.biome = "desert"; const homeT = exhibitReport(bx).target;
    out.biomeHomeHappier = biomeOf({}) === DEFAULT_BIOME && awayFlag && homeD - awayD === BIOME_HAPPY.home - BIOME_HAPPY.away && homeT > awayT && exhibitReport(bx).issues.some(i => /At home in the/.test(i.text));
    { const second = biomesOf(desertSp)[1]; out.biomeEitherHome = biomeFit(desertSp, second) === "home" && biomeD(second) === homeD && !exhibitReport(bx).issues.some(i => i.bad && /Wrong biome/.test(i.text)); bx.biome = "desert"; }
    const fishy = SPECIES.find(s => !s.viv && thirsty({viv:false, land:[], water:[], points:bx.points}, s));
    bx.biome = "grassland"; const dryNow = thirsty(bx, fishy); bx.biome = "wetland";
    out.wetlandWaters = dryNow && !thirsty(bx, fishy);
    // a vivarium has no ground picker: its biome is its scene's (else the biome it was built with)
    { const vb = {viv:"S", biome:"wetland", points:bx.points, animals:[], vivScene:null}; const before = biomeOf(vb); vb.vivScene = {era:"mesozoic", biome:"desert"};
      out.vivBiomeIsScene = before === "wetland" && biomeOf(vb) === "desert" && typeof regradeProblem === "undefined"; }
    { const sp = SPECIES.find(s => !s.viv && !s.pool && !s.diet.includes("piscivore") && !HABITAT_LIKES[s.id]), pts = bx.points, mk = (biome, water, land) => ({viv:false, biome, points:pts, land, water:water ? [{id:1, points:[[0,0],[water,0],[water,water],[0,water]]}] : []});
      const dW = wantsOf(mk("desert"), sp), tW = wantsOf(mk("tropical"), sp), fish = SPECIES.find(s => s.semi);
      out.wantsBySize = wantsOf({points:pts.map(([x,y]) => [x*2,y*2]), biome:"tropical"}, sp).plants > tW.plants;
      out.wantsByBiome = dW.rock > tW.rock && tW.plants > dW.plants && wantsOf(mk("desert"), fish).water > wantsOf(mk("desert"), sp).water;
      const wp = wantsOf(mk("desert"), sp).water, ex = {water:wp * 5, rock:0, plants:0};
      out.waterTooMuchHurts = waterFit(wp, wp) === 1 && waterFit(0, wp) === 0 && waterFit(wp * 5, wp) < 1 && waterFit(wp * 5, wp) < waterFit(wp * 1.1, wp); }
    try { const h = landHtml(bx); out.landPanelRenders = /Plant Cover: ?<\/b>|Plant Cover/.test(h) && /Rock Coverage/.test(h) && /Landscaping/.test(h); } catch(x){ out.landPanelRenders = false; }
    try { const sp2 = SPECIES.find(s => !s.viv); bx.animals = [{id:"hb1", sp:sp2.id, q:90}]; exTabs.ex = bx.id; exTabs.tab = "health"; const h = exhibitHtml(bx); out.healthTabRenders = /Sanitation/.test(h) && /class="hl (ok|warn|bad)"/.test(h) && /aria-selected="true"[^>]*>[^<]*Health/.test(h); exTabs.tab = "land"; const lh = exhibitHtml(bx); out.landTabRenders = /Landscape needs/.test(lh) && /Water<\/b><span>[\d.]+%\/[\d.]+%/.test(lh) && /data-action="lsub"/.test(lh); landTabs.sub = "water"; out.waterSubTab = /data-action="waterTool"/.test(exhibitHtml(bx)); landTabs.sub = "plants"; out.landNoShelter = !/data-key="barn"/.test(exhibitHtml(bx)); exTabs.tab = "props"; const ph = exhibitHtml(bx); out.propsTabRenders = /Habitat items/.test(ph) && /data-key="shelter"/.test(ph) && /data-key="barn"/.test(ph) && !/data-key="traysm"/.test(ph) && /Shelter cover/.test(ph); exTabs.tab = "clone"; out.cloneTabRenders = /Add animals/.test(exhibitHtml(bx)); exTabs.tab = "main"; bx.animals = []; } catch(x){ out.healthTabRenders = String(x); }
    try { const an0 = bx.animals; bx.animals = [{id:"hb2", sp:SPECIES.find(s => !s.viv).id, q:90}]; exTabs.ex = bx.id; bx.glog = freshExLog(); const pq = {n:3, thought:new Set(), seen:new Set(), mood:50, needs:{}, pers:null, edu:0}; seeExhibit(pq, bx, true); const lg = exLog(bx); creditGifts(pq, 12); exTabs.tab = "guests"; const gh = exhibitHtml(bx); exTabs.tab = "barrier"; const bh = exhibitHtml(bx); exTabs.tab = "main"; const oh = exhibitHtml(bx); const keep = lg.views; guestsNight(); out.exGuestTab = keep === 3 && Math.round(exLog(bx).last.gifts) === 12 && exLog(bx).views === 0 && /Guest appeal/.test(gh) && /Guest thoughts/.test(gh) && /Stopped to watch/.test(gh) && /Condition/.test(bh) && /data-kind="mech"/.test(bh) && /At a glance/.test(oh) && /data-k="guests"/.test(oh) && ["Overview", "Barrier", "Landscaping", "Habitat Items", "Animals", "Health", "Cloning", "Behavior", "Guests"].every(t => oh.includes(">" + t + "<")); bx.animals = an0; } catch(x){ out.exGuestTab = String(x); }
    render(); out.biomeDrawn = !!document.querySelector('#world [fill="url(#b-wetland)"]') && !!document.querySelector('#b-boreal');
    out.fernPrairie = !!BIOMES.fern && ["Permian", "Triassic", "Jurassic", "Cretaceous", "Paleogene"].every(p => PLANTS_OF[p].fern && PLANTS_OF[p].fern.length === 3) && ["Devonian", "Carboniferous", "Neogene", "Quaternary"].every(p => !PLANTS_OF[p].fern) && !!document.querySelector('#b-fern') && !!document.querySelector('#p-fern') && !!document.querySelector('#w-fern') && !!WATER_TEX.fern && !!ROCK_SPRITES.fern;
    state.exhibits = keepEx; state.money = keepMoney; render();

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
    const wxSp = SPECIES.find(s => !s.viv && !s.pool && s.space >= 100 && !COLD_HARDY.includes(s.id) && !s.predator);
    const wx = {id:"e-wx", name:"Weather test", points:[[100,100],[160,100],[160,160],[100,160]], animals:[1, 2, 3].map(i => ({id:"a-w" + i, sp:wxSp.id, q:90})), happy:70, cond:100, land:[]};
    state.exhibits = [wx];
    const at = (k, f) => { state.weather.today = k; return f(); };
    out.stormExposes = at("storm", () => exposure(wx) === 1 && exhibitReport(wx).issues.some(i => i.bad && /Storm/.test(i.text)));
    out.stormHurts = at("storm", () => exhibitReport(wx).target) < at("fair", () => exhibitReport(wx).target)
      && at("storm", () => illChance(wx, wx.animals[0]).p) > at("fair", () => illChance(wx, wx.animals[0]).p)
      && at("storm", () => injuryChance(wx, wx.animals[0]).p) > at("fair", () => injuryChance(wx, wx.animals[0]).p)
      && Math.abs(at("storm", () => wearPerDay(wx)) - at("fair", () => wearPerDay(wx)) * WEATHER.kinds.storm.wear) < 1e-9;
    placeLand(wx, "qua-" + biomeOf(wx) + "-large", 115, 145);
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

    // the animal move dialog opens and lists where they can go (it once called map.js's moveProblem and threw)
    const mvA = {...wx, id:"e-mvA", land:[]}, mvB = {...wx, id:"e-mvB", name:"Move test B", animals:[], land:[]};
    state.exhibits = [mvA, mvB];
    try { openMoveDialog(mvA, wxSp.id); out.moveDialogOpens = $("#dlgMove").open && !!$("#moveTo") && $("#moveTo").options.length === 1; }
    catch { out.moveDialogOpens = false; }
    if($("#dlgMove").open) $("#dlgMove").close();
    state.exhibits = keepEx; recompute();

    // a wide path holds twice the crowd before guests feel packed
    const wPaths = state.paths;
    const crowdedOn = type => {
      state.paths = [{id:"p-w", points:[[200,300],[260,300]], ...(type ? {type} : {})}, {id:"p-gate", points:[[200,300],[200,300.5]]}];
      state.gate = [200,300]; recompute(); buildGuestGraph();
      const a = gGraph.anchors.gate, b = [...a.adj.keys()].find(n => n.x > 250);
      if(!b) return null;
      const L = Math.hypot(b.x - a.x, b.y - a.y), n = Math.ceil(GUEST.crowd * L / 10 * 1.5);
      return {n, mult:(a.room && a.room.get(b)) || 1, crowd:GUEST.crowd};
    };
    const plain = crowdedOn(), wide = crowdedOn("wide");
    out.widePathRoom = !!plain && !!wide && plain.mult === 1 && wide.mult === WIDE_PATH.crowdMult && pathCost([[0,0],[10,0]], "wide") === 10 * WIDE_PATH.perMeter;
    // a wide path drawn over a plain one gives the plain stretch under it the room too, and a lone party on a short stretch isn't packed
    state.paths = [{id:"p-n", points:[[200,300],[260,300]]}, {id:"p-gate", points:[[200,300],[200,300.5]]}, {id:"p-o", type:"wide", points:[[200.5,300],[259,300]]}];
    recompute(); buildGuestGraph();
    const gA = gGraph.anchors.gate, under = [...gGraph.nodes.values()].flatMap(n => [...n.adj.keys()].filter(m => n.y === 300 && m.y === 300).map(m => (n.room && n.room.get(m)) || 1));
    const keepParties = parties, shortHop = [...gA.adj.keys()].find(m => Math.hypot(m.x - gA.x, m.y - gA.y) < 1);
    parties = [{...newParty(2), at:gA, to:shortHop, t:.5, mood:80}]; parties[0].until = 9e9;
    guestsTick(state.minute, state.minute + .01);
    out.wideOverlayRoom = under.length > 0 && under.every(r => r === WIDE_PATH.crowdMult) && !!shortHop && !parties[0].thought.has("crowded");
    parties = keepParties;
    state.paths = wPaths; recompute(); buildGuestGraph();

    // a building can go far from any path (but doesn't work there), and Rotate turns it 90°
    const savedPaths = state.paths; state.paths = [{id:"p-gate", points:[[200,300],[200,300.5]]}]; state.gate = [200,300]; recompute();
    setTool("food"); rot = 0; placeGhost(0, 0); const g0 = ghost; const w0 = Math.hypot(g0.pts[1][0] - g0.pts[0][0], g0.pts[1][1] - g0.pts[0][1]);
    rotateTool(); const w1 = Math.hypot(ghost.pts[1][0] - ghost.pts[0][0], ghost.pts[1][1] - ghost.pts[0][1]);
    out.offPathRotate = typeof g0.ok === "boolean" && !(g0.why || "").includes("next to a path") && Math.abs(w0 - w1) < 1e-6 && Math.abs(ghost.angle - g0.angle - Math.PI/2) < 1e-6;
    const rc0 = svg.getBoundingClientRect();
    setTool("select");
    state.paths = [{id:"p-gate", points:[[200,300],[200,300.5]], fixed:true}, {id:"p-h", points:[[200,300],[300,300]]}, {id:"p-w", type:"wide", points:[[250,240],[250,297.5]]}]; recompute();
    out.wideShortNotJoined = !derived.joined.has("p-w") && wideJoin(state.paths[2]).clips.length === 0;
    state.paths[2].points[1] = [250, 300]; recompute();
    out.wideOnCenterJoined = derived.joined.has("p-w") && wideJoin(state.paths[2]).clips.length === 1;
    setTool("select"); state.paths = savedPaths; recompute();

    // buildings go on the 1 m grid square to the map; path chunks, fences, water and other buildings are the only things in the way
    {
      const K = {C:state.pathChunks, F:state.pathFixed, P:state.paths, B:state.buildings, Fe:state.fences, W:state.water, money:state.money, sb:state.sandbox, rot};
      const W = mainWalkChunks([200, 300]);
      state.pathChunks = W.C; state.pathFixed = W.F; state.paths = []; state.buildings = []; state.fences = []; state.water = []; state.sandbox = true; state.money = 1e7;
      pathVer++; recompute(); buildGuestGraph();
      const rc = svg.getBoundingClientRect(), px = (x, y) => [rc.left + view.tx + x * view.k, rc.top + view.ty + y * ky()];
      const at = (x, y) => { placeGhost(...px(x, y)); return ghost; }, stat = () => $("#dStat").textContent;
      const square = g => g.pts.every((q, i) => { const n = g.pts[(i + 1) % 4]; return Math.abs(q[0] - n[0]) < 1e-6 || Math.abs(q[1] - n[1]) < 1e-6; });
      const mid = g => [(g.pts[0][0] + g.pts[2][0]) / 2, (g.pts[0][1] + g.pts[2][1]) / 2];
      setTool("food"); rot = 0; lastPtr = null;
      const f0 = at(220.4, 270.3), m0 = mid(f0);
      out.placeGrid = f0.ok && square(f0) && Math.abs(m0[0] - 220) < 1e-6 && Math.abs(m0[1] - 270) < 1e-6 && f0.angle === 0;
      // a path beside it doesn't turn it or pull it to the path
      out.placeNoSnap = Math.abs(at(212.2, 250.8).angle) < 1e-9 && Math.abs(mid(ghost)[0] - 210) < 1e-6;   // its box snaps to the 5 m grid
      out.buildingsSnapToChunks = [[203.3, 251.9], [216.8, 268.4], [231.1, 290.2]].every(([x, y]) => { const g = at(x, y), b = bbox(g.pts); return Math.abs(b.x0 % CHUNK) < 1e-6 && Math.abs(b.y0 % CHUNK) < 1e-6; });
      // Rotate: four distinct quarter turns, all square
      const turns = []; for(let i = 0; i < 4; i++){ turns.push(ghost.angle.toFixed(4)); rotateTool(); }
      out.rotateQuarterTurns = new Set(turns).size === 4 && rot === 0 && square(ghost) && Math.abs(ghost.angle) < 1e-9;
      rotateTool(); const tall = ghost; out.rotateSwapsSides = Math.abs((Math.max(...tall.pts.map(q => q[1])) - Math.min(...tall.pts.map(q => q[1]))) - BUILDINGS.food.w) < 1e-6;
      rot = 0;
      // refused on a chunk, and it can't clip one: near the edge it snaps flush against it
      const onPathG = at(204, 270), clipG = at(205 + BUILDINGS.food.w / 2 - 1, 270), flushG = at(Math.ceil(205 + BUILDINGS.food.w / 2), 270);
      out.placeRefusesChunk = !onPathG.ok && onPathG.why === "It sits on a path." && clipG.ok && Math.abs(Math.min(...clipG.pts.map(q => q[0])) - 205) < 1e-6 && flushG.ok;
      // the reach warning: flush against a chunk works, one chunk (5 m) away is too far (food stand is 10 m wide, so its middle is 5 m + the gap from the edge)
      at(205 + 5, 270); const nearOk = ghost.ok && !stat().includes("No path nearby");
      at(205 + 5 + 5, 270); const farWarn = ghost.ok && stat().includes("No path nearby");
      out.placeReachWarning = nearOk && farWarn;
      // path props: 1 m grid anywhere fully on a guest chunk, front toward the nearest fence or path edge
      try { const added = [], ex0 = state.exhibits;
        for(let y = 50; y < 59; y++) for(const cx of [39, 41]){ state.pathChunks[cx + "," + y] = "g"; added.push(cx + "," + y); }
        pathVer++; recompute(); setTool("bench"); rot = 0; lastPtr = null;
        const mid1 = at(202.4, 270.4), fr = g => propFront({points:g.pts});
        out.propMidWalk = mid1.ok && Math.abs(mid1.x - 202) < 1e-9 && Math.abs(mid1.y - 270) < 1e-9;
        out.propFrontsEdge = (f => f[0] < -.99 && Math.abs(f[1]) < 1e-6)(fr(mid1));
        const a0 = mid1.angle; rotateTool(); out.propRotate90 = Math.abs(ghost.angle - a0 - Math.PI/2) < 1e-9; rot = 0;
        const offG = at(190, 270), halfG = at(195, 270), nearEdgeG = at(196, 270);
        out.propOffPathRefused = !offG.ok && offG.why === "Keep it on a path." && !halfG.ok && halfG.why === "Keep it on a path." && nearEdgeG.ok;
        state.exhibits = [{id:"pe", points:[[207, 265], [213, 265], [213, 275], [207, 275]]}];
        out.propFrontsExhibit = (f => f[0] > .99 && Math.abs(f[1]) < 1e-6)(fr(at(202, 270)));
        state.exhibits = [{id:"pe", points:[[202.3, 265], [213, 265], [213, 275], [202.3, 275]]}];
        const sl = at(202, 270); out.propFenceSlide = sl.ok && sl.x < 202 && sl.x > 200;
        state.exhibits = ex0;
        const first = {id:"b-pp1", type:"bench", points:at(202, 270).pts};
        state.buildings.push(first);
        const dup = at(202, 270), beside = at(202, 273);
        out.propNoOverlap = !dup.ok && dup.why === "It overlaps another building." && beside.ok;
        const shifted = {...first, points:first.points.map(q => [q[0] - 20, q[1]])};
        out.propMoveRule = moveProblem("building", first) === null && moveProblem("building", shifted) === "Keep it on a path.";
        afterChange();
        out.propGuestsFindIt = !!gGraph.anchors["b-pp1"] && isReachable(first);
        state.buildings = state.buildings.filter(b => b !== first); for(const k of added) delete state.pathChunks[k]; pathVer++; recompute(); buildGuestGraph(); setTool("food"); } catch(x){ out.propBlockThrew = String(x.stack).slice(0, 400); }
      // fences, water, exhibits and buildings
      state.fences = [{points:[[230, 265], [230, 275]], barrier:"wood"}]; out.placeRefusesFence = !at(230, 270).ok && at(230, 270).why.includes("fence"); state.fences = [];
      state.water = [{id:"w-pg", points:[[225, 262], [235, 262], [235, 278], [225, 278]]}]; out.placeRefusesWater = !at(230, 270).ok && at(230, 270).why.includes("water"); state.water = [];
      const nb = {id:"b-pg", type:"food", points:at(230, 270).pts}; state.buildings = [nb];
      out.placeRefusesBuilding = !at(233, 270).ok && at(233, 270).why === "It overlaps another building." && at(230 + BUILDINGS.food.w, 270).ok;
      state.buildings = [];
      // dept and service-only buildings: a depot wants a staff chunk, not just any path
      const techKeep = state.science.tech.slice(); state.science.tech.push("vehicles"); setTool("depot"); const D = BUILDINGS.depot, dx = 205 + D.w / 2 + 2;
      at(dx, 264); const depotGuest = stat().includes("No path nearby");
      state.pathChunks = Object.assign({}, W.C, {[chunkKey(41, 54)]:"s"}); pathVer++; recompute();
      at(dx, 264); const depotStaff = !stat().includes("No path nearby");
      state.pathChunks = Object.assign({}, W.C); pathVer++; recompute();
      state.science.tech = techKeep; out.placeServiceRules = depotGuest && depotStaff;
      // the Paleopedia card renders for every species, discovered or not, in every period
      { const un = state.science.unlocked.slice(); let bad = ""; ppPick = null;
        for(const s of SPECIES){ if(!speciesAvailable(s.id)) continue; for(const known of [true, false]){ state.science.unlocked = known ? [s.id] : []; ppPeriod = s.period; ppPick = s.id; try { catalogHtml(); } catch(x){ bad = s.id + ": " + x.message; } } }
        state.science.unlocked = un; ppPeriod = null; ppPick = null; out.paleopediaCards = bad === ""; }
      // the guest walking graph still finds a building placed at the reach limit, in both turns
      setTool("restroom");
      for(const r of [0, 2]){
        rot = r; state.buildings = []; const g = at(205 + (r ? BUILDINGS.restroom.d : BUILDINGS.restroom.w) / 2, 270);
        state.buildings = [{id:"b-lim" + r, type:"restroom", points:g.pts}]; recompute(); buildGuestGraph();
        out["guestStopAtLimit" + r] = g.ok && isReachable(state.buildings[0]) && gGraph.anchors["b-lim" + r] !== undefined;
      }
      state.buildings = [];
      // Move: the same rules; a turn works in place and refuses (no sliding) when it can't
      const mv = {id:"b-mv", type:"restroom", points:rectPts(210, 272.5, 10, 5, 0)}; state.buildings = [mv]; recompute(); setTool("move"); mvSel = mv.id;
      out.moveFlushOk = !moveProblem("building", mv);
      const c0 = centroid(mv.points); rotateMoved(); const c1 = centroid(mv.points);
      out.moveTurnsInPlace = Math.hypot(c0[0] - c1[0], c0[1] - c1[1]) <= 2.5 * Math.SQRT2 + 1e-6 && Math.abs(bbox(mv.points).x0 % 5) < 1e-6 && Math.abs(bbox(mv.points).y0 % 5) < 1e-6 && Math.abs(mv.points[1][1] - mv.points[0][1]) > 5 && !moveProblem("building", mv);   // the turned box lands on the 5 m grid, nearest the middle
      mv.points = rectPts(207.5, 270, 9, 3, 0); out.moveRefusesChunk = moveProblem("building", mv) === "It sits on a path.";   // 2.5 m of the 3 m-high... overlaps the walk
      mv.points = rectPts(210, 272.5, 10, 5, 0);
      state.buildings.push({id:"b-wall", type:"restroom", points:rectPts(212, 277.5, 8, .6, 0)});   // a sliver the turned shape (not the original) runs into
      const before = JSON.stringify(mv.points); rotateMoved();
      out.moveTurnRefusedNoNudge = JSON.stringify(mv.points) === before && $("#dStat").textContent.startsWith("Can't turn it here");
      // a chunk can't be laid through a building
      state.buildings = [{id:"b-pc", type:"restroom", points:rectPts(222.5, 270, 8, 6, 0)}];
      out.chunkRefusedThroughBuilding = pathChunkProblem(44, 54, "g", pathCtx()) === "Paths can't go through a building." && pathChunkProblem(46, 54, "g", pathCtx()) === null;
      setTool("select"); mvSel = null;
      state.pathChunks = K.C; state.pathFixed = K.F; state.paths = K.P; state.buildings = K.B; state.fences = K.Fe; state.water = K.W; state.money = K.money; state.sandbox = K.sb; rot = K.rot; pathVer++; recompute(); buildGuestGraph();
    }

    // building facing: b.face (0-3 = N/E/S/W) is saved, R turns it with the walls, the door arrow shows, old saves get the side nearest a path
    {
      const K = {C:state.pathChunks, F:state.pathFixed, P:state.paths, B:state.buildings, Fe:state.fences, W:state.water, money:state.money, sb:state.sandbox, rot};
      const W = mainWalkChunks([200, 300]);
      state.pathChunks = W.C; state.pathFixed = W.F; state.paths = []; state.buildings = []; state.fences = []; state.water = []; state.sandbox = true; state.money = 1e7;
      pathVer++; recompute(); buildGuestGraph();
      const rc = svg.getBoundingClientRect(), px = (x, y) => [rc.left + view.tx + x * view.k, rc.top + view.ty + y * ky()];
      const at = (x, y) => { placeGhost(...px(x, y)); return ghost; }, stat = () => $("#dStat").textContent;
      setTool("restroom"); rot = 0; lastPtr = null;
      const f0 = at(211, 270).face, seq = [];
      for(let i = 0; i < 4; i++){ rotateTool(); seq.push(ghost.face); }
      out.faceCyclesWithR = f0 === 2 && seq.join() === "3,0,1,2" && rot === 0;
      out.faceDoorArrow = renderOverlay.toString().includes("doorArrowSvg") && doorArrowSvg(ghost.pts, ghost.face, "red", 1).includes("<path");
      rot = 2; at(211, 270); placeBuilding({clientX:lastPtr.x, clientY:lastPtr.y});
      const placed = state.buildings[state.buildings.length - 1];
      out.facePlacedSaved = !!placed && placed.type === "restroom" && placed.face === 3 && !state.buildings.some(b => BUILDINGS[b.type].prop && b.face !== undefined);
      // the door wall lands on the grid, so a cart of any depth stands flush against a path, placed or turned
      { const onGrid = (pts, f) => { const b = bbox(pts), e = [b.y1, b.x1, b.y1, b.x0][f]; return Math.abs(e - Math.round(e)) < 1e-6; };   // a cart facing north snaps its base line (south edge), the one that meets the path behind it
        setTool("kiosk"); const r0 = rot, okPlace = [0, 2, 4, 6].every(r => { rot = r; const g = at(231.4, 270.3); return onGrid(g.pts, g.face); }); rot = r0;
        const kb = {id:"b-kgrid", type:"kiosk", face:2, day:0, points:rectPts(240, 250, BUILDINGS.kiosk.w, BUILDINGS.kiosk.d, 0)}; kb.points = doorOnGrid(kb.points, 2); state.buildings.push(kb);
        setTool("move"); mvSel = kb.id; rotateMoved(); mvSel = null; setTool("select");
        out.cartDoorOnGrid = okPlace && kb.face === 3 && onGrid(kb.points, kb.face); state.buildings.splice(state.buildings.indexOf(kb), 1); }
      // a cart's box may lie backOver meters over a path at its back, no more; saved north-facing carts backing onto a path, fully on it or with a gap, slide to that, once
      { const key = Object.keys(state.pathChunks).find(k => { const [x, y] = k.split(",").map(Number); return guestCell(state.pathChunks[k]) && !state.pathChunks[`${x},${y + 1}`]; }), [qx, qy] = key.split(",").map(Number), Y = (qy + 1) * CHUNK, t = BUILDINGS.kiosk;
        const kc = y1 => ({id:"b-kback", type:"kiosk", face:0, day:0, points:rectPts(qx * CHUNK + 2.5, y1 - t.d / 2, t.w, t.d, 0)}), msg = y1 => moveProblem("building", kc(y1));
        const mv = y1 => { const sv = JSON.parse(JSON.stringify(state)); delete sv.cardBack2; sv.buildings = [kc(y1)]; upgradeSave(sv); return sv.cardBack2 === true ? bbox(sv.buildings[0].points).y1 : NaN; }, o = BLD_PICS.kiosk.backOver;
        out.cartBacksOntoPath = msg(Y + t.d - o) !== "It sits on a path." && msg(Y + t.d - o - .6) === "It sits on a path." && msg(Y) === "It sits on a path."
          && !bldOnPath("restroom", rectPts(qx * CHUNK + 2.5, Y + BUILDINGS.restroom.d / 2, BUILDINGS.restroom.w, BUILDINGS.restroom.d, 0)) && bldOnPath("restroom", rectPts(qx * CHUNK + 2.5, Y + BUILDINGS.restroom.d / 2 - .1, BUILDINGS.restroom.w, BUILDINGS.restroom.d, 0))
          && [Y + 2, Y + t.d, Y + t.d - o].every(y1 => Math.abs(mv(y1) - (Y + t.d - o)) < 1e-6); }
      // every building (not path props like bins and benches) has sides that are multiples of 5 m
      out.buildingFootprintsFive = Object.values(BUILDINGS).every(t => t.prop || (t.w % 5 === 0 && t.d % 5 === 0));
      // the door point is the middle of the wall that faces that way
      const sq = rectPts(211, 270, 8, 6, 0), dp = f => doorPoint({points:sq, face:f}).map(v => Math.round(v * 1e6) / 1e6).join();
      out.faceDoorPoint = dp(0) === "211,267" && dp(1) === "215,270" && dp(2) === "211,273" && dp(3) === "207,270";
      // Move: turning swings the door the same way
      state.buildings = [{id:"b-fm", type:"restroom", points:sq, face:2, day:0}]; recompute(); setTool("move"); mvSel = "b-fm";
      rotateMoved(); out.faceMoveTurns = state.buildings[0].face === 3; setTool("select"); mvSel = null;
      // old saves: the side facing the nearest path chunk (the walk runs north of the gate, so a building south of it looks north; one beside it looks at it)
      const sv = JSON.parse(JSON.stringify(state)); sv.buildings = [{id:"b-o1", type:"restroom", points:rectPts(206, 340, 8, 6, 0), day:0}, {id:"b-o2", type:"restroom", points:rectPts(211, 270, 8, 6, 0), day:0}, {id:"b-o3", type:"bench", points:rectPts(207, 280, 1, 1, 0), day:0}];
      upgradeSave(sv); out.faceOldSaveNearestPath = sv.buildings[0].face === 0 && sv.buildings[1].face === 3 && sv.buildings[2].face === undefined;
      // guests walk to the path point nearest the door, not the middle
      state.buildings = [{id:"b-fa", type:"restroom", points:sq, face:0, day:0}]; recompute(); buildGuestGraph(); const aN = gGraph.anchors["b-fa"];
      state.buildings[0].face = 2; recompute(); buildGuestGraph(); const aS = gGraph.anchors["b-fa"];
      out.faceGuestStopAtDoor = !!aN && !!aS && aN.y < aS.y - 3;
      // reach: a door facing away from the path still works, but the ghost says so
      state.buildings = [{id:"b-fb", type:"restroom", points:sq, face:1, day:0}]; recompute(); const awayOk = isReachable(state.buildings[0]);
      state.buildings = []; setTool("restroom"); rot = 6; at(205 + BUILDINGS.restroom.d / 2, 270); const hint = stat().includes("door faces away"); rot = 2; at(205 + BUILDINGS.restroom.d / 2, 270);
      out.faceReachDoorAway = awayOk && hint && ghost.ok && !stat().includes("door faces away"); rot = 0;
      // every look draws in all four facings, with the door and the name where the camera can see them
      const types = ["restroom", "food", "restaurant", "workshop", "farm", "closet", "lodge", "oracle", "greenhouse"], bad = [];
      for(const ty of types) for(let f = 0; f < 4; f++){
        const bl = {id:"b-v", type:ty, points:rectPts(211, 270, BUILDINGS[ty].w, BUILDINGS[ty].d, 0), face:f, day:0};
        let svgS = ""; try { svgS = building34(bl, BUILDINGS[ty], false, false, true, 1); } catch(e){ bad.push(ty + f + " " + e.message); continue; }
        const sign = esc(STAND34[ty].sign || BUILDINGS[ty].tag || BUILDINGS[ty].label);
        if(f !== 2 && !(svgS.includes(`fill="${FLAT34.door}"`) && (f !== 0 || svgS.includes(">" + sign + "<")))) bad.push(ty + f + " no mark");
      }
      out.faceDrawsAllLooks = bad.length === 0 || bad.join("; ");
      state.pathChunks = K.C; state.pathFixed = K.F; state.paths = K.P; state.buildings = K.B; state.fences = K.Fe; state.water = K.W; state.money = K.money; state.sandbox = K.sb; rot = K.rot; pathVer++; recompute(); buildGuestGraph(); setTool("select");
    }

    // tram: track is drawn like a path, guests ride it between stations, and nobody walks it
    const trSaved = {paths:state.paths, buildings:state.buildings, tech:state.science.tech.slice(), money:state.money, fares:state.today.fares};
    state.science.tech = state.science.tech.filter(t => t !== "transit"); state.money = 1e6; state.today.fares = 0;
    out.tramNeedsTech = (pathProblem([[100,100],[200,100]], "tram") || "").includes("Research") && pathProblem([[100,100],[200,100]], "path") === null && pathCost([[0,0],[100,0]], "tram") === 100 * TRAM.perMeter;
    state.science.tech.push("transit");
    state.gate = [200,300];
    const stn = (id, x) => ({id, type:"tramstop", points:[[x-5,303],[x+5,303],[x+5,308],[x-5,308]]});
    const loo = {id:"b-tr-loo", type:"restroom", points:[[492,303],[500,303],[500,309],[492,309]]};
    state.paths = [{id:"p-gate", points:[[200,300],[200,300.5]], fixed:true}, {id:"p-tr", points:[[200,300],[500,300]]}, {id:"p-rail", type:"tram", points:[[250,312],[480,312]]}];
    state.buildings = [stn("b-trA", 250), stn("b-trB", 480), loo];
    recompute(); buildGuestGraph();
    const walkD = (pa, pb) => { const f = guestField(loo.id); return f && f.dist.get(gGraph.gate); };
    const withTram = walkD();
    out.tramNotWalkable = !derived.joined.has("p-rail") && !derived.joinedAll.has("p-rail") && !isReachable({id:"p-rail"}) && [...gGraph.nodes.values()].some(n => n.ride && n.ride.size);
    out.tramShortensTrip = withTram !== undefined && withTram < 220;
    // a party heading for the restroom pays one fare per guest, boards once, and thinks well of it
    parties = parties.filter(x => !x.id.startsWith("tr-"));
    const trp = newParty(2); trp.id = "tr-g"; trp.cash = 100; trp.dest = loo.id; trp.why = "see"; trp.until = 1e6; trp.at = gGraph.gate;
    for(const k of Object.keys(trp.needs)) trp.needs[k] = 0;
    parties.push(trp);
    for(let i = 0; i < 12 && trp.in !== loo.id; i++){ for(const k of Object.keys(trp.needs)) trp.needs[k] = 0; walkParty(trp, 60); }
    out.tramFare = trp.in === loo.id && Math.abs(state.today.fares - 2 * TRAM.fare) < 1e-6 && trp.thought.has("tram");
    parties = parties.filter(x => x !== trp); svcQ.clear();
    // a party that can't afford the fare walks: no ride in its map, and nothing paid
    const rideTrip = (cash, tramRoll) => {
      const q = newParty(2); q.id = "tr-q"; q.cash = cash; q.tramRoll = tramRoll; q.dest = loo.id; q.why = "see"; q.until = 1e6; q.at = gGraph.gate;
      for(const k of Object.keys(q.needs)) q.needs[k] = 0;
      parties.push(q);
      const f0 = state.today.fares, rode = canRide(q), dw = fieldFor(q, loo.id).dist.get(gGraph.gate);
      for(let i = 0; i < 30 && q.in !== loo.id; i++){ for(const k of Object.keys(q.needs)) q.needs[k] = 0; walkParty(q, 60); }
      parties = parties.filter(x => x !== q); svcQ.clear();
      return {rode, dist:dw, arrived:q.in === loo.id, paid:state.today.fares - f0, thought:q.thought.has("noTram"), cash:q.cash};
    };
    const poor = rideTrip(1, 0);
    out.tramBrokeWalks = !poor.rode && poor.dist > 280 && poor.arrived && poor.paid === 0 && poor.thought && poor.cash === 1;
    // the fare is adjustable, charged per guest, and fewer guests pay it as it climbs
    state.tramFare = 4; const dear = rideTrip(100, 0);
    out.tramFareCharged = dear.rode && Math.abs(dear.paid - 2 * 4) < 1e-6 && Math.abs(tramWill() - (1 - 1/3)) < 1e-9;
    state.tramFare = 2 * TRAM.fare;
    const tooDear = rideTrip(100, 0);
    out.tramFareTooDear = tramWill() === 0 && !tooDear.rode && tooDear.paid === 0 && tooDear.dist > 280;
    state.tramFare = 99; state.tramFare = clamp(state.tramFare, 1, TRAM.maxFare);
    out.tramFareCapped = state.tramFare === TRAM.maxFare;
    state.tramFare = TRAM.fare;
    // already aboard, a party keeps riding even when it's out of cash
    out.tramRiderKeepsRiding = canRide({at:{rail:false}, onTram:true, cash:0, n:2, tramRoll:.99}) && canRide({at:{rail:true}, cash:0, n:2, tramRoll:.99});
    // a worn-out station stops taking riders and shows as broken; a mechanic repairs it and the ride comes back
    const trMin = state.minute, stA = state.buildings.find(b => b.id === "b-trA");
    const workshop = {id:"b-tr-ws", type:"workshop", points:rectPts(215, 309, BUILDINGS.workshop.w, BUILDINGS.workshop.d, 0)};
    state.buildings.push(workshop); stA.cond = 10; recompute(); buildGuestGraph(); buildKeeperGraph();
    out.tramBrokenNoRide = !tramWorking(stA) && !gGraph.anchors["b-trA:foot"] && !gGraph.anchors["b-trA:rail"] && tramStops(state.paths[2]).stops.length === 1;
    render(); out.tramBrokenDrawn = world.innerHTML.includes("#6E2A26");
    state.science.tech.push("transit");
    state.staff.mechanics = []; hireMechanic();
    let fixed = false; for(let i = 0; i < 1500 && !fixed; i++){ state.minute = DAWN_MIN + 60; mechanicsTick(1); fixed = condOf(stA) >= 99.9; }
    out.tramMechanicRepairs = fixed && tramWorking(stA) && !!gGraph.anchors["b-trA:rail"] && tramStops(state.paths[2]).stops.length === 2;
    state.staff.mechanics = []; syncMechanics(); state.minute = trMin;
    // stations wear faster with more track beside them
    const wearShort = tramWear(stA); state.paths[2].points = [[250,312],[480,312],[480,330],[250,330],[250,350]];
    out.tramWearGrowsWithTrack = tramWear(stA) > wearShort; state.paths[2].points = [[250,312],[480,312]];
    state.buildings = state.buildings.filter(b => b !== workshop); recompute(); buildGuestGraph();
    // drawn like a path, and a car runs on it
    render(); drawTrams();
    out.tramDrawn = world.innerHTML.includes("#5E4B38") && $("#tramLayer").children.length === 1 && tramStops(state.paths[2]).stops.length === 2;
    // the track only snaps to other track, and footpaths don't snap onto it
    setTool("tram"); const trc = svg.getBoundingClientRect(), trcl = (x, y) => [trc.left + view.tx + x*view.k, trc.top + view.ty + y*ky()];
    const trsn = snapAt(...trcl(300, 300)); setTool("path"); const trsn2 = snapAt(...trcl(300, 312)); setTool("select");
    out.tramSnaps = !(trsn.info && trsn.info.id === "p-tr") && !(trsn2.info && trsn2.info.id === "p-rail");
    // no stations, no ride; and the same trip is a long walk
    state.buildings = [loo]; recompute(); buildGuestGraph();
    const walkOnly = walkD();
    out.tramNoStations = walkOnly !== undefined && walkOnly > 280 && ![...gGraph.nodes.values()].some(n => n.ride);
    // a station with no footpath beside it does nothing
    state.buildings = [stn("b-trA", 250), stn("b-trB", 480), loo]; state.paths[1].points = [[200,300],[225,300]]; recompute(); buildGuestGraph();
    out.tramStationNeedsPath = ![...gGraph.nodes.values()].some(n => n.ride);
    // old saves get the fares line
    const trOld = JSON.parse(JSON.stringify(state)); delete trOld.today.fares; upgradeSave(trOld);
    delete trOld.tramFare; upgradeSave(trOld);
    out.tramOldSave = trOld.today.fares === 0 && trOld.tramFare === TRAM.fare;
    Object.assign(state, {paths:trSaved.paths, buildings:trSaved.buildings, money:trSaved.money}); state.science.tech = trSaved.tech; state.today.fares = trSaved.fares;
    recompute(); buildGuestGraph(); buildKeeperGraph(); render(); drawTrams();

    // paths are 5 m chunks: drag-and-drop runs, true-size ghost, drag-box bulldoze, migration, costs, and guests still get around
    {
      const keep = {exhibits:state.exhibits, buildings:state.buildings, decor:state.decor, water:state.water, fences:state.fences, fenceGrid:state.fenceGrid, chunks:state.pathChunks, fixed:state.pathFixed, paths:state.paths, money:state.money, sandbox:state.sandbox, gate:state.gate};
      state.gate = [ENTRANCE_X, 305];       state.exhibits = []; state.buildings = []; state.decor = []; state.water = []; state.fences = []; state.fenceGrid = {}; state.sandbox = false; state.money = 1e6;
      state.pathChunks = JSON.parse(JSON.stringify(keep.chunks)); state.pathFixed = JSON.parse(JSON.stringify(keep.fixed)); state.paths = keep.paths.filter(p => !p.d); pathVer++; recompute(); buildGuestGraph(); buildKeeperGraph();
      const nch = () => Object.keys(state.pathChunks).length;
      // the entrance walk is one chunk wide, centered under the entrance
      const wk = Object.keys(state.pathFixed).map(chunkXY);
      out.chunksDefaultWalk = nch() === 14 && wk.length === 1 && wk[0][0] === 41 && wk[0][1] === 60 && Math.min(...Object.keys(state.pathChunks).map(k => chunkXY(k)[1])) === 47
        && state.gate[0] === 207.5 && state.gate[0] === 41 * CHUNK + CHUNK / 2 && state.gate[1] === SOUTH_LINE && derived.joined.size > 0 && state.paths.some(p => p.d) && JSON.stringify(state).indexOf('"d":1') < 0;
      out.entranceAligned = state.gate[0] === ENTRANCE_X && chunkAt(state.gate[0] - 2.4, 300)[0] === 41 && chunkAt(state.gate[0] + 2.4, 300)[0] === 41 && pathAt(state.gate[0], state.gate[1] - 1) === "g";
      out.platesOnGrid = [...PARCELS.xs, ...PARCELS.ys, ...PARCELS.home, ...LEGACY_SOUTH_YS, ...PARK_PLOT.flat()].every(v => v % CHUNK === 0);
      out.chunkCosts = pathChunkCost("g") === COST.pathPerMeter * 5 && pathChunkCost("s") === SERVICE_ROAD.perMeter * 5 && pathChunkCost("b") === BRIDGE.perMeter * 5 && !PATH_CELLS.kinds.x && !PATH_TOOLS.crossing;
      // a straight drag: 11 chunks along the row beside the walk's far end
      const A = [41, 46], B = [51, 46], plan = planPath(A, B, "g");
      out.chunkDragStraight = plan.chunks.length === 11 && plan.todo.length === 11 && !plan.why && plan.cost === 11 * pathChunkCost("g") && plan.chunks.every((k, i) => k === chunkKey(41 + i, 46));
      // the ghost shows exactly the chunks that will be laid
      setTool("path"); cdrag = {a:A, b:B, kind:"g"}; pathDragStat(); renderOverlay();
      const ghostN = [...$("#overlay").innerHTML.matchAll(/<path d="([^"]*)" fill="#4CD964"/g)].reduce((n, m) => n + (m[1].match(/M/g) || []).length, 0);
      out.chunkGhostMatches = ghostN === plan.todo.length && /11 chunks/.test($("#dStat").textContent);
      const m0 = state.money, n0 = nch(); endPathDrag();
      out.chunkLaid = nch() === n0 + 11 && plan.todo.every(k => state.pathChunks[k] === "g") && Math.abs(m0 - state.money - plan.cost) < 1e-6 && derived.joined.size > 0 && chunkReached(51, 46, true);
      // a diagonal drag lays a stair: the 45 degree chunks and the one beside each step that keeps them edge to edge
      const D1 = [51, 46], D2 = [56, 41], dp = planPath(D1, D2, "g"), has = (x, y) => dp.chunks.includes(chunkKey(x, y));
      out.chunkDragDiagonal = !dp.why && dp.chunks.length === 11 && has(51, 46) && has(56, 41) && has(53, 44) && has(52, 46) && !has(51, 45)
        && dp.chunks.every(k => { const [x, y] = chunkXY(k); return dp.chunks.some(j => { const [u, v] = chunkXY(j); return Math.abs(u - x) + Math.abs(v - y) === 1; }); });
      layPath(D1, D2, "g"); recompute(); buildGuestGraph(); buildKeeperGraph();
      out.chunkDiagJoined = chunksJoined(dp.chunks, true) && chunkReached(56, 41, true) && state.paths.filter(p => p.d && derived.joined.has(p.id)).length > 1;
      out.pathSquaresList = pathSquares().length === nch() && pathSquares().every(q => q.w === 5 && q.h === 5 && q.x === q.cx * 5) && pathSquares().filter(q => q.fixed).length === 1;
      // refusals: through an exhibit, over water (a bridge crosses it), off your land, through a fence
      state.exhibits = [{id:"e-cp", name:"CP", points:[[300,100],[320,100],[320,120],[300,120]], animals:[], land:[], water:[], cond:100}];
      const pe = planPath([58, 21], [66, 21], "g");
      out.chunkBlockedExhibit = /exhibit/.test(pe.why) && pe.bad.size > 0 && layPath([58, 21], [66, 21], "g") === null;
      state.exhibits = []; state.water = [{id:"w-cp", points:[[300,100],[320,100],[320,120],[300,120]]}];
      out.chunkWaterBridge = /water/.test(planPath([58, 21], [66, 21], "g").why) && planPath([58, 21], [66, 21], "b").why === "" && planPath([58, 21], [66, 21], "b").bad.size === 0;
      state.water = [];
      out.chunkOffLand = /boundary/.test(planPath([-12, 22], [-8, 22], "g").why);
      state.fenceGrid = {[pieceKey(300, 100, "v")]:{}};
      out.chunkBlockedFence = /fence/.test(planPath([58, 20], [62, 20], "g").why);
      state.fenceGrid = {};
      state.money = 5; out.chunkTooDear = /Costs/.test(planPath([20, 20], [28, 20], "g").why); state.money = 1e6;
      // bulldoze: a tap takes one chunk, a drag box takes exactly the chunks lit, the entrance walk stays
      setTool("bulldoze");
      const boxAt = (a, b) => { fdrag = {a, b, lift:true, box:true, swept:new Set(), last:{x:b[0], y:b[1]}}; };
      const toastKeep = ui.toast; let toasted = ""; ui.toast = t => { toasted = t; };
      const c0 = nch(), mm = state.money; boxAt([227.5, 232.5], [227.5, 232.5]); endFenceDrag();
      out.chunkBulldozeTap = nch() === c0 - 1 && !state.pathChunks["45,46"] && state.money - mm === Math.round(pathChunkCost("g") * COST.refundShare) && /Removed 1 path chunk, refunded/.test(toasted);
      const c1 = nch(), m1 = state.money; boxAt([236, 226], [246, 236]);
      const lit = bulldozeChunkKeys(fdrag).slice().sort(); renderOverlay();
      const litN = [...$("#overlay").innerHTML.matchAll(/<path d="([^"]*)" fill="var\(--bad\)" fill-opacity="\.45"/g)].reduce((n, m) => n + (m[1].match(/M/g) || []).length, 0);
      endFenceDrag();
      out.chunkBulldozeBox = lit.length === 3 && litN === 3 && nch() === c1 - 3 && lit.every(k => !state.pathChunks[k]) && !!state.pathChunks["50,46"] && !!state.pathChunks["46,46"] && state.money - m1 === Math.round(3 * pathChunkCost("g") * COST.refundShare) && /Removed 3 path chunks, refunded \$/.test(toasted);
      const c2 = nch(); boxAt([207.5, 303], [207.5, 303]); endFenceDrag();
      out.chunkBulldozeFixed = nch() === c2 && !!state.pathChunks["41,60"];
      boxAt([200, 300], [215, 304]); out.chunkBulldozeFixedBox = bulldozeChunkKeys(fdrag).length === 0; endFenceDrag();
      out.chunkBulldozeFixed2 = nch() === c2 && !!state.pathChunks["41,60"];
      ui.toast = toastKeep; setTool("select");
      // the same through real pointer events: drag the path tool, then drag a bulldoze box that lights the chunks as it grows
      {
        const r = svg.getBoundingClientRect(), scr = (wx, wy) => ({clientX:r.left + view.tx + wx * view.k, clientY:r.top + view.ty + wy * ky()});
        const fire = (type, wx, wy, extra) => svg.dispatchEvent(new PointerEvent(type, {pointerId:7, pointerType:"mouse", button:0, buttons:type === "pointerup" ? 0 : 1, bubbles:true, ...scr(wx, wy), ...extra}));
        svg.setPointerCapture = () => {}; svg.releasePointerCapture = () => {};   // synthetic pointers can't be captured
        state.pathChunks = JSON.parse(JSON.stringify(keep.chunks)); pathVer++; recompute();
        const base = nch();
        setTool("path"); fire("pointerdown", 52.5 * CHUNK + 2, 40.5 * CHUNK); fire("pointermove", 55.5 * CHUNK, 40.5 * CHUNK); fire("pointermove", 58.5 * CHUNK, 40.5 * CHUNK);
        const shown = cdrag && cdrag.plan && cdrag.plan.todo.length; fire("pointerup", 58.5 * CHUNK, 40.5 * CHUNK);
        out.chunkPointerLay = shown === 7 && nch() === base + 7 && ["52,40", "58,40"].every(k => state.pathChunks[k] === "g") && !state.pathChunks["51,40"] && !state.pathChunks["59,40"];
        setTool("bulldoze"); fire("pointerdown", 53.1 * CHUNK, 39.6 * CHUNK); fire("pointermove", 55 * CHUNK, 40.5 * CHUNK); fire("pointermove", 56.5 * CHUNK, 41.2 * CHUNK);
        const lit2 = fdrag ? bulldozeChunkKeys(fdrag).sort().join(" ") : "";
        fire("pointerup", 56.5 * CHUNK, 41.2 * CHUNK);
        out.chunkPointerBulldoze = lit2 === "53,40 54,40 55,40 56,40" && nch() === base + 3 && ["52,40", "57,40", "58,40"].every(k => state.pathChunks[k]) && ["53,40", "54,40", "55,40", "56,40"].every(k => !state.pathChunks[k]);
        fire("pointerdown", 57.5 * CHUNK, 40.5 * CHUNK); fire("pointerup", 57.5 * CHUNK, 40.5 * CHUNK);
        out.chunkPointerTap = nch() === base + 2 && !state.pathChunks["57,40"] && !!state.pathChunks["58,40"];
        setTool("select"); delete svg.setPointerCapture; delete svg.releasePointerCapture;
        state.pathChunks = JSON.parse(JSON.stringify(keep.chunks)); pathVer++; recompute(); buildGuestGraph(); buildKeeperGraph();
      }
      // P4 rendering: one cached ground layer under everything that stands, cut at the pixel grid with no gaps at junctions
      {
        const sq = l => l.map(([cx, cy, kind]) => ({cx, cy, x:cx * 5, y:cy * 5, w:5, h:5, kind}));
        const pix = (d, set) => { for(const r of d.matchAll(/M([\d.-]+) ([\d.-]+)h([\d.-]+)v([\d.-]+)/g)){ const x0 = Math.round(r[1] / ROCK_MPP), y0 = Math.round(r[2] / ROCK_MPP), w = Math.round(r[3] / ROCK_MPP), h = Math.round(r[4] / ROCK_MPP); for(let y = y0; y < y0 + h; y++) for(let x = x0; x < x0 + w; x++) set.add(x + "," + y); } return set; };
        const union = list => { const u = new Set(); for(const q of sq(list)) for(let y = Math.round(q.y / ROCK_MPP); y < Math.round((q.y + 5) / ROCK_MPP); y++) for(let x = Math.round(q.x / ROCK_MPP); x < Math.round((q.x + 5) / ROCK_MPP); x++) u.add(x + "," + y); return u; };
        const covers = list => { const m = pathMask(sq(list)), body = new Set(); for(const k of m.kinds) pix(m.by[k].body, body); const u = union(list); return body.size === u.size && [...u].every(k => body.has(k)); };
        out.pathMaskTJunction = covers([[1,1,"g"],[2,1,"g"],[3,1,"g"],[2,2,"g"],[2,3,"g"]]);
        out.pathMaskDiagonal = covers([[1,1,"g"],[2,1,"g"],[2,0,"g"],[3,0,"g"],[3,-1,"g"],[4,-1,"g"]]);
        out.pathMaskKindsTouch = covers([[1,1,"g"],[2,1,"g"],[3,1,"s"],[4,1,"s"],[3,2,"b"]]);
        // edges: a lit row on top and a dark row at the bottom of a lone chunk, lit left and dark right, and each kind keeps its own edge where two meet
        { const m = pathMask(sq([[1,1,"g"],[2,1,"s"]])), lit = pix(m.by.g.lit, new Set()), dark = pix(m.by.g.dark, new Set()), sLit = pix(m.by.s.lit, new Set()), x0 = Math.round(5 / ROCK_MPP), y0 = Math.round(5 / ROCK_MPP), x1 = Math.round(10 / ROCK_MPP), y1 = Math.round(10 / ROCK_MPP);
          out.pathMaskEdges = lit.has(x0 + "," + y0) && lit.has((x1 - 3) + "," + y0) && lit.has(x0 + "," + (y1 - 3)) && dark.has((x1 - 1) + "," + (y1 - 1)) && dark.has((x1 - 1) + "," + (y0 + 3)) && dark.has((x0 + 3) + "," + (y1 - 1)) && !lit.has((x0 + 3) + "," + (y0 + 3)) && sLit.has(x1 + "," + (y0 + 3)) && !!m.cast; }
        // the layer is built once and only rebuilt when the squares change
        recompute(); render(); const b0 = pathLayer.builds; render(); render();
        const stable = pathLayer.builds === b0;
        const hadCh = !!state.pathChunks["30,30"]; state.pathChunks["30,30"] = "g"; pathVer++; render();
        out.pathLayerCached = stable && pathLayer.builds === b0 + 1;
        if(!hadCh){ delete state.pathChunks["30,30"]; pathVer++; }
        // layer order: the path layer is first of the things drawn on the ground, before every exhibit, fence, building and plant
        const ex0 = state.exhibits.length, bl0 = state.buildings.length;
        const ring = [[150, 150], [170, 150], [170, 170], [150, 170]], pen = state.exhibits[0];
        state.pathChunks["32,29"] = "g"; state.pathChunks["33,29"] = "g"; pathVer++; recompute(); render();
        const html = world.innerHTML, at = html.indexOf('id="pathLayer"');
        const later = ['data-kind="exhibit"', 'data-kind="building"', "<image"].map(t => html.indexOf(t)).filter(i => i >= 0);
        out.pathLayerBelowStanding = at >= 0 && later.every(i => i > at) && !/data-kind="path"[^>]*>\s*<[^>]*fill="#C6BC93"/.test(html);
        delete state.pathChunks["32,29"]; delete state.pathChunks["33,29"]; pathVer++; recompute(); render();
        out.pathNoBeigeBlocks = typeof chunksSvg === "undefined";
      }
      // old saves from the 1 m cell build: a chunk is path where most of its area was; the gate and the walk move to the chunk grid
      const oldC = JSON.parse(JSON.stringify(state)); delete oldC.pathChunks; delete oldC.pathFixed; oldC.gate = [205, 305]; oldC.paths = oldC.paths.filter(p => !p.d);
      oldC.pathCells = {}; oldC.pathFixed = {};
      for(let x = 203; x < 208; x++) for(let y = 235; y < 305; y++){ oldC.pathCells[x + "," + y] = "g"; oldC.pathFixed[x + "," + y] = 1; }
      for(let x = 208; x < 240; x++) for(let y = 233; y < 238; y++) oldC.pathCells[x + "," + y] = "g";   // rows 233 to 237: three in chunk row 47, two in 46
      for(let x = 150; x < 200; x++) for(let y = 248; y < 251; y++) oldC.pathCells[x + "," + y] = "s";   // a 3 m staff road
      oldC.pathCells["199,250"] = "x";
      upgradeSave(oldC);
      const cnt = k => Object.keys(oldC.pathChunks).filter(k).length;
      out.chunkMigrateCells = !oldC.pathCells && oldC.gate[0] === 207.5 && oldC.gate[1] === 305 && oldC.pathChunks["41,47"] === "g" && oldC.pathChunks["42,47"] === "g" && !oldC.pathChunks["42,46"] && !oldC.pathChunks["40,56"] && oldC.pathChunks["41,60"] === "g" && !oldC.pathChunks["41,61"]
        && Object.keys(oldC.pathFixed).join() === "41,60" && oldC.pathChunks["35,49"] === "s" && oldC.pathChunks["35,50"] === "s" && !oldC.pathChunks["35,48"] && !oldC.pathChunks["35,51"]
        && cnt(k => oldC.pathChunks[k] === "s") === 20;
      const againC = upgradeSave(JSON.parse(JSON.stringify(oldC)));
      out.chunkMigrateOnce = Object.keys(againC.pathChunks).length === Object.keys(oldC.pathChunks).length && againC.gate[0] === 207.5 && Object.keys(againC.pathFixed).join() === "41,60";
      // old saves from line paths (tram stays a line)
      const oldS = JSON.parse(JSON.stringify(state)); delete oldS.pathChunks; delete oldS.pathFixed; oldS.gate = [205, 305];
      oldS.paths = [{id:"p-main", name:"Main walk", points:[[205,305],[205,235]], fixed:true}, {id:"p-o1", points:[[205,235],[300,235]]}, {id:"p-o2", type:"service", points:[[205,250],[150,250]]}, {id:"p-o3", type:"wide", points:[[250,200],[250,150]]}, {id:"p-o4", type:"bridge", points:[[300,235],[300,200]]}, {id:"p-tr", type:"tram", points:[[250,312],[480,312]]}, {id:"x", d:1, points:[[0,0],[5,0]]}];
      upgradeSave(oldS);
      out.chunkMigrateLines = oldS.paths.length === 1 && oldS.paths[0].type === "tram" && oldS.pathChunks["41,56"] === "g" && !oldS.pathChunks["40,56"] && !oldS.pathChunks["42,56"] && Object.keys(oldS.pathFixed).join() === "41,60"
        && oldS.pathChunks["50,47"] === "g" && oldS.pathChunks["35,50"] === "s" && oldS.pathChunks["49,35"] === "g" && oldS.pathChunks["50,35"] === "g" && !oldS.pathChunks["48,35"] && !oldS.pathChunks["51,35"]
        && Object.keys(oldS.pathChunks).some(k => oldS.pathChunks[k] === "b") && !Object.keys(oldS.pathChunks).some(k => chunkXY(k)[1] >= 61) && oldS.gate[0] === 207.5;
      // guests still reach an exhibit beside a laid path, and the keeper map has the staff paths
      layPath(A, B, "g");   // mend the gap the bulldoze left
      state.exhibits = [{id:"e-cp2", name:"CP2", points:[[212,222],[222,222],[222,229],[212,229]], animals:[], land:[], water:[], cond:100}];
      layPath([42, 50], [47, 50], "s"); recompute(); buildGuestGraph(); buildKeeperGraph();
      const gw = gGraph.anchors.gate ? walkFrom(gGraph.anchors.gate, false) : {dist:new Map()};
      out.chunkGuestsReach = isReachable(state.exhibits[0]) && !!gGraph.anchors["e-cp2"] && gw.dist.has(gGraph.anchors["e-cp2"]);
      out.chunkStaffPath = state.paths.some(p => p.d && isService(p) && derived.joinedAll.has(p.id)) && !state.paths.some(p => p.d && isService(p) && derived.joined.has(p.id)) && kGraph.nodes.size > 2;
      render();
      out.chunkRenders = world.innerHTML.includes(PATH_CELLS.kinds.g.color) && world.innerHTML.includes(PATH_CELLS.kinds.s.color);
      // the entrance walk can be bulldozed except the chunk at the gate, and a reload doesn't bring it back
      {
        const W = mainWalkChunks(state.gate);
        state.pathChunks = Object.assign({}, W.C); state.pathFixed = Object.assign({}, W.F); state.paths = state.paths.filter(p => !p.d); pathVer++; recompute(); buildGuestGraph(); buildKeeperGraph();
        const wb = {a:[207.5, 235], b:[207.5, 304]};
        const r = removeChunks(chunksInBox(wb.a, wb.b)); pathVer++;
        out.walkBulldoze = r.n === 13 && r.kept === 1 && nch() === 1 && state.pathChunks["41,60"] === "g" && bulldozeChunkKeys(wb).length === 0;
        const reloaded = upgradeSave(JSON.parse(JSON.stringify(state)));
        out.walkStaysGone = Object.keys(reloaded.pathChunks).join() === "41,60" && Object.keys(reloaded.pathFixed).join() === "41,60";
        const lost = JSON.parse(JSON.stringify(state)); delete lost.pathFixed; lost.pathChunks = {}; upgradeSave(lost);
        out.walkSeedsWhenNone = Object.keys(lost.pathChunks).length === 14 && Object.keys(lost.pathFixed).join() === "41,60";
        let threw = null;
        try { recompute(); buildGuestGraph(); buildKeeperGraph(); resetParties(); guestsArrive(4); for(let i = 0; i < 5; i++) guestsTick(state.minute + i, state.minute + i + 1); } catch(e){ threw = e; }
        out.walkNoPathNoCrash = !threw && parties.length > 0;
        const j0 = layPath([41, 59], [41, 50], "g");
        recompute(); buildGuestGraph(); buildKeeperGraph();
        out.walkRelaidFromGate = !!j0 && chunkReached(41, 50, true) && derived.joined.size > 0 && !!gGraph.anchors.gate;
        resetParties();
      }
      Object.assign(state, {exhibits:keep.exhibits, buildings:keep.buildings, decor:keep.decor, water:keep.water, fences:keep.fences, fenceGrid:keep.fenceGrid, pathChunks:keep.chunks, pathFixed:keep.fixed, paths:keep.paths, money:keep.money, sandbox:keep.sandbox, gate:keep.gate});
      pathVer++; recompute(); buildGuestGraph(); buildKeeperGraph(); render();
    }

    // path connectivity: a flood fill over the chunks, edge to edge, from the entrance walk; staff chunks that touch a guest chunk join for staff only
    {
      const keep = {exhibits:state.exhibits, buildings:state.buildings, decor:state.decor, water:state.water, fences:state.fences, fenceGrid:state.fenceGrid, chunks:state.pathChunks, fixed:state.pathFixed, paths:state.paths, money:state.money, sandbox:state.sandbox, gate:state.gate};
      state.gate = [ENTRANCE_X, 305];       state.exhibits = []; state.buildings = []; state.decor = []; state.water = []; state.fences = []; state.fenceGrid = {}; state.sandbox = false; state.money = 1e6;
      state.pathFixed = JSON.parse(JSON.stringify(keep.fixed)); state.paths = [];   // no loose lines from earlier checks
      const reset = () => { state.pathChunks = Object.assign({}, mainWalkChunks(state.gate).C); pathVer++; recompute(); buildGuestGraph(); buildKeeperGraph(); };
      const redo = () => { recompute(); buildGuestGraph(); buildKeeperGraph(); };
      const G = (x, y) => chunkReached(x, y, true), S = (x, y) => chunkReached(x, y, false);
      reset();
      out.reachWalk = G(41, 55) && S(41, 55) && pathReach() === pathReach();
      // a path touching the walk is joined, a gap breaks it, a corner touch is not an edge
      layPath([42, 47], [47, 47], "g");
      out.reachTouch = G(47, 47) && S(47, 47);
      layPath([20, 20], [28, 20], "g");
      out.reachFar = !G(24, 20) && !S(24, 20);
      reset(); layPath([41, 44], [46, 44], "g");   // the walk starts at row 47: a gap of two rows
      out.reachGap = !G(44, 44) && !S(44, 44);
      layPath([41, 46], [41, 45], "g");   // fills the gap
      out.reachGapMended = G(44, 44);
      reset(); state.pathChunks["42,46"] = "g"; pathVer++;
      out.reachCorner = !G(42, 46);
      state.pathChunks["42,47"] = "g"; pathVer++;
      out.reachEdge = G(42, 46) && G(42, 47);
      // two runs side by side merge into one network
      reset(); layPath([42, 47], [47, 47], "g"); layPath([42, 45], [47, 45], "g");
      out.reachSideGap = !G(44, 45);
      layPath([42, 46], [42, 46], "g");
      out.reachSideBySide = G(44, 45) && G(47, 45);
      // the cache follows the chunks
      const r0 = pathReach(); pathVer++;
      out.reachCache = pathReach() !== r0 && pathReach() === pathReach();
      // a bridge chunk joins like a guest path, and guests walk it
      reset(); layPath([42, 47], [47, 47], "g"); layPath([48, 47], [51, 47], "b"); redo();
      out.reachBridge = G(50, 47) && pathKind(50, 47) === "b" && [...gGraph.nodes.values()].some(n => n.x > 251);
      // a path dragged out of the entrance walk joins
      reset(); layPath([41, 46], [41, 40], "g"); redo();
      out.reachFromEntrance = G(41, 40) && [...gGraph.nodes.values()].some(n => n.y < 205);
      // a staff chunk touching a guest chunk (or the entrance walk) is joined for staff only
      reset(); layPath([42, 50], [47, 50], "s"); redo();
      const nodeNear = (G2, x, y) => { let b = null, bd = 1e9; for(const n of G2.nodes.values()){ const d = Math.hypot(n.x - x, n.y - y); if(d < bd){ bd = d; b = n; } } return {b, d:bd}; };
      const start = [...kGraph.nodes.values()].reduce((a, n) => Math.hypot(n.x - 207, n.y - 290) < Math.hypot(a.x - 207, a.y - 290) ? n : a);
      out.staffTouchJoins = S(47, 50) && !G(47, 50) && !G(42, 50) && nodeNear(kGraph, 237.5, 252.5).d < 4 && walkFrom(start, null).dist.has(nodeNear(kGraph, 237.5, 252.5).b);
      out.guestsNeverStaff = !state.paths.some(p => p.d && isService(p) && derived.joined.has(p.id)) && nodeNear(gGraph, 237.5, 252.5).d > 5 && state.paths.some(p => p.d && isService(p) && derived.joinedAll.has(p.id));
      // ...also where it meets the end of a guest path away from the walk
      reset(); layPath([42, 47], [46, 47], "g"); layPath([47, 47], [50, 47], "s"); redo();
      out.staffTouchGuest = S(49, 47) && !G(49, 47) && G(46, 47) && !state.paths.some(p => p.d && isService(p) && derived.joined.has(p.id));
      // a staff chunk with no path to it joins nothing; a guest chunk that only a staff chunk reaches is not a guest path
      layPath([20, 20], [24, 20], "s"); out.staffAlone = !S(22, 20);
      reset(); layPath([42, 50], [44, 50], "s"); layPath([45, 50], [48, 50], "g"); redo();
      out.guestBehindStaff = S(46, 50) && !G(46, 50) && !G(43, 50) && nodeNear(gGraph, 232.5, 252.5).d > 5;
      // taking the touching chunk away splits them again
      reset(); layPath([42, 50], [47, 50], "s"); removeChunks(["42,50"]); redo();
      out.staffSplit = !S(47, 50) && nodeNear(kGraph, 237.5, 252.5).d > 5;
      // an exhibit gate on a chunk edge reads as connected only when its path reaches the entrance
      reset(); layPath([42, 51], [47, 51], "s");
      const ex = { id:"e-gt", name:"GT", points:[[214,240],[226,240],[226,255],[214,255]], animals:[], land:[], water:[], cond:100, gate:[215, 255] };
      state.exhibits = [ex]; redo();
      out.gateOnEdge = gateCheck(ex).ok;
      ex.gate = [215, 245]; out.gateOffPath = !gateCheck(ex).ok && /not on a path/.test(gateCheck(ex).text);
      ex.gate = [215, 255]; removeChunks(["42,51"]); redo();
      out.gateUnjoined = !gateCheck(ex).ok && /not connected/.test(gateCheck(ex).text);
      // an exhibit beside a guest path is open to guests, one beside only a staff road is not
      layPath([42, 51], [42, 51], "s"); redo();
      out.exhibitStaffOnly = !isReachable(ex);
      layPath([42, 47], [47, 47], "g"); redo();
      out.exhibitGuestOpen = isReachable(ex) && !!gGraph.anchors["e-gt"];
      // buildings: a backstage one needs only staff reach, a guest one needs a guest path
      state.exhibits = []; reset(); layPath([42, 52], [47, 52], "s");
      state.buildings = [{id:"b-ws", type:"workshop", points:rectPts(222, 270, BUILDINGS.workshop.w, BUILDINGS.workshop.d, 0), cond:100}, {id:"b-rr", type:"restroom", points:rectPts(222, 252, BUILDINGS.restroom.w, BUILDINGS.restroom.d, 0), cond:100}]; redo();
      out.buildingReach = isReachable(state.buildings[0]) && !isReachable(state.buildings[1]);
      state.buildings = []; state.exhibits = [];
      Object.assign(state, {exhibits:keep.exhibits, buildings:keep.buildings, decor:keep.decor, water:keep.water, fences:keep.fences, fenceGrid:keep.fenceGrid, pathChunks:keep.chunks, pathFixed:keep.fixed, paths:keep.paths, money:keep.money, sandbox:keep.sandbox, gate:keep.gate});
      pathVer++; recompute(); buildGuestGraph(); buildKeeperGraph(); render();
    }

    // themes: old saves get defaults, themes unlock by play, a matched area draws more, animals that suit a theme are happier
    const old = JSON.parse(JSON.stringify(state)); delete old.themes; upgradeSave(old);
    out.themesDefault = old.themes.brush === "genesis" && old.themes.have.length === 1;
    // the Range theme was renamed Homestead: old saves move over
    const rg = JSON.parse(JSON.stringify(state)); rg.themes = {brush:"range", have:["genesis", "range", "western"]}; rg.paths = [{id:"p-rg", type:"tram", theme:"range", points:[[0, 0], [9, 0]]}, {id:"p-we", type:"tram", theme:"western", points:[[0, 0], [9, 0]]}]; upgradeSave(rg);
    out.themeRangeRenamed = rg.paths[0].theme === "homestead" && rg.themes.brush === "homestead" && rg.themes.have.includes("homestead") && !THEMES.range;
    out.themeWesternRenamed = rg.paths[1].theme === "mesa" && rg.themes.have.includes("mesa") && !rg.themes.have.includes("western") && !THEMES.western;
    // the Classic theme became Japanese Garden: old saves move over
    const clc = JSON.parse(JSON.stringify(state)); clc.themes = {brush:"classic", have:["genesis", "classic"]}; clc.exhibits = [{id:"e-clc", theme:"classic", points:[[0, 0], [9, 0], [9, 9]], animals:[], land:[], water:[]}]; upgradeSave(clc);
    out.themeClassicRenamed = clc.exhibits[0].theme === "japanese" && clc.themes.brush === "japanese" && clc.themes.have.includes("japanese") && !clc.themes.have.includes("classic") && !THEMES.classic;
    const tSaved = {paths:state.paths, buildings:state.buildings, exhibits:state.exhibits, themes:state.themes, rating:state.rating, tech:state.science.tech.slice(), money:state.money};
    state.themes = {brush:"genesis", have:["genesis"]}; state.rating = 1; state.science.tech = state.science.tech.filter(t => t !== "gilded"); state.goalsDone = state.goalsDone.filter(id => id !== "cash1m" && id !== "cloneq");
    state.exhibits = [{id:"e-t", name:"T", points:[[200,205],[240,205],[240,240],[200,240]], animals:[{sp:"cnot", q:90}], happy:70, cond:100}];
    state.paths = [{id:"p-gate", points:[[200,300],[200,240]], fixed:true}, {id:"p-t", points:[[200,240],[260,240]]}, {id:"p-t2", points:[[260,240],[260,300]]}];
    state.buildings = [{id:"b-t", type:"restroom", points:[[245,243],[253,243],[253,249],[245,249]]}];
    recompute();
    const e0 = state.exhibits[0], zMixed = derived.themes["e-t"];
    out.themeNoBonusGenesis = !zMixed.ok && themeFitShare(e0) === 0;
    checkThemes();
    out.themeLocked = !themeHave("volcanic") && !themeHave("gilded") && !!themeProblem("exhibit", e0, "volcanic");
    state.rating = 4.6; recompute();   // no explicit check: recompute alone unlocks it
    out.themeVolcanicUnlock = themeHave("volcanic") && !themeHave("gilded");
    state.goalsDone.push("cash1m"); checkThemes();
    out.themeGildedUnlock = themeHave("gilded") && !themeHave("stone");
    state.goalsDone.push("cloneq"); checkThemes();
    out.themeStoneUnlock = themeHave("stone");
    out.themeFitsValid = Object.values(THEMES).every(T => T.fits.every(id => SPECIES_BY_ID[id]));
    out.themeModernUnlock = !themeHave("modern") && (state.science.tech.push("modern"), checkThemes(), themeHave("modern")) && themeHave("mesa");
    e0.theme = "volcanic"; recompute();
    out.themeMixedNothing = !derived.themes["e-t"].ok && derived.themes["e-t"].same === 0;
    const appealMixed = derived.appeal;
    for(const it of [...state.paths, ...state.buildings]) it.theme = "volcanic";
    recompute();
    out.themeMatchedBonus = derived.themes["e-t"].ok && derived.appeal > appealMixed && themeFitShare(e0) === 1;
    out.themeFitHappier = exhibitReport(e0).target > (e0.theme = "genesis", exhibitReport(e0).target);
    e0.theme = "volcanic"; render();
    out.themeRenders = world.innerHTML.includes(THEMES.volcanic.path.live);   // the accent rail was flat-view only
    state.themes.brush = "volcanic"; state.money = 1e6;
    const bp = {id:"p-n", points:[[260,300],[300,300]]}; themeNew("path", bp);
    out.themeBrush = bp.theme === "volcanic" && state.money < 1e6;
    state.themes.brush = "bayou"; const bq = {id:"p-q", points:[[260,300],[300,300]]}; state.themes.have = ["genesis", "gilded"]; themeNew("path", bq);
    out.themeBrushLocked = bq.theme === undefined;
    state.themes.have = ["genesis", "gilded", "volcanic"]; state.money = 1e6; state.themes.brush = "genesis";
    const zs = state.zones; state.zones = [{id:"z-t", name:"Z", color:"#c33", points:[[0,0],[2000,0],[2000,2000],[0,2000]], theme:"volcanic"}];
    const zp = {id:"p-z", points:[[260,300],[300,300]]}; themeNew("path", zp);
    for(const it of [...state.paths, ...state.buildings, ...state.exhibits]) delete it.theme;
    const nz = zoneThemePlan(state.zones[0], "volcanic").length, rz = restyleZone(state.zones[0], "volcanic");
    render();
    out.zoneTheme = zp.theme === "volcanic" && nz > 0 && rz.n === nz && state.paths.filter(p => !p.d).concat(state.buildings, state.exhibits).every(it => it.theme === "volcanic") && world.innerHTML.includes(THEMES.volcanic.ground);
    // vivariums take a scene (era and biome) for a flat price in place of plants: every scene has its pictures, the bonus follows the fit, and old plants turn into a scene
    {
      const v = {id:"e-vp", name:"Fern house", viv:"L", biome:"tropical", points:[[0,0],[16,0],[16,10],[0,10]].map(p => [p[0] + 900, p[1] + 900]), animals:[{id:"a-vp", sp:"arth"}], happy:70, vivScene:null};
      state.exhibits.push(v);
      const m0 = state.money; state.money = 1e5;
      out.vivScenePictures = VIV_SCENE.eras.every(era => Object.keys(BIOMES).every(b => Object.keys(VIVARIUMS).every(z => ["wall", "floor"].every(l => SPRITE_PACK[`sprites/vivscene/${era}-${b}-${z}-${l}.png`]))));
      VIV_SCENE_PERIODS["Carboniferous-wetland"] = true;
      out.vivScenePeriodKey = vivSceneKey({era:"paleozoic", biome:"wetland"}) === "paleozoic-wetland" && vivSceneKey({era:"paleozoic", biome:"wetland", period:"Carboniferous"}) === "Carboniferous-wetland" && vivSceneKey({era:"paleozoic", biome:"tropical", period:"Carboniferous"}) === "paleozoic-tropical";
      delete VIV_SCENE_PERIODS["Carboniferous-wetland"];
      const bare = habitatScore(v).delta, s = SPECIES_BY_ID.arth;
      const m1 = state.money, ok = !vivSceneProblem(v, {era:"paleozoic", biome:"desert"}); setVivScene(v, {era:"paleozoic", biome:"desert"});
      const half = habitatScore(v).delta, halfFit = sceneFit(v, s);
      out.vivSceneCharges = ok && state.money === m1 - VIV_SCENE.price && v.vivScene.era === "paleozoic" && !!vivSceneProblem(v, {era:"paleozoic", biome:"desert"});
      setVivScene(v, {era:"paleozoic", biome:"tropical"});
      const full = habitatScore(v).delta;
      out.vivSceneBonus = halfFit === .5 && sceneFit(v, s) === 1 && half < full && Math.abs(full - bare - VIV_PLANT.bonus) < .01 && speciesFit(v, s).plants === 1;
      out.vivEra = !exhibitReport(v).issues.some(i => /another era/.test(i.text));
      state.money = 0; out.vivSceneBroke = !!vivSceneProblem(v, {era:"mesozoic", biome:"tropical"}); state.money = 1e5;
      const html = vivSceneHtml(v); out.vivNoGround = !exhibitHtml(v).includes("biomeSel") && biomeOf(v) === "tropical"; out.vivSceneUi = html.includes("vivEraSel") && html.includes("vivBiomeSel") && html.includes('data-action="vivScene"') && !html.includes("vivPlant\"") && vivToysHtml(v).includes("Enrichment");
      render(); const w = world.innerHTML, fi = w.indexOf("sprites/vivscene/paleozoic-tropical-L-floor.png"), wi = w.indexOf("sprites/vivscene/paleozoic-tropical-L-wall.png"), zi = w.indexOf('data-z34="e-vp"');
      out.vivSceneDraws = fi > 0 && wi > fi && zi > wi;
      const m2 = state.money; setVivScene(v, null);
      out.vivSceneClears = v.vivScene === null && state.money === m2 + Math.round(VIV_SCENE.price * COST.refundShare) && habitatScore(v).delta === bare;
      // an old save: a case's plants become the scene of its biome and its animals' era, and an empty case gets none
      const old = JSON.parse(JSON.stringify(state)); delete old.vivScene;
      const ov = old.exhibits.find(e => e.id === "e-vp"), plant = PLANTS_OF.Permian.wetland[0];
      delete ov.vivScene; ov.biome = "wetland"; ov.land = (ov.land || []).concat([{id:"l-op", type:plant, x:905, y:905, k:VIV_PLANT.scale}]);
      old.exhibits.push({id:"e-ov2", name:"Empty", viv:"S", points:[[0,0],[6,0],[6,4],[0,4]], animals:[], happy:70, land:[]});
      const up = upgradeSave(old), uv = up.exhibits.find(e => e.id === "e-vp");
      out.vivSceneUpgrade = up.vivScene === 1 && uv.vivScene && uv.vivScene.era === "paleozoic" && uv.vivScene.biome === "wetland" && !uv.land.some(f => f.type === plant) && up.exhibits.find(e => e.id === "e-ov2").vivScene === null;
      state.exhibits.splice(state.exhibits.indexOf(v), 1); state.money = m0;
    }
    state.zones = zs;
    Object.assign(state, {paths:tSaved.paths, buildings:tSaved.buildings, exhibits:tSaved.exhibits, themes:tSaved.themes, rating:tSaved.rating, money:tSaved.money}); state.science.tech = tSaved.tech; recompute(); render();

    // behavior: every species gets real traits; a lone pack animal paces from loneliness while its fed pack doesn't; toys add enrichment; night resets
    {
      const okT = SPECIES.every(s => { const t = traitsOf(s); return ["diurnal", "nocturnal", "crepuscular"].includes(t.active) && ["solitary", "pair", "herd", "pack"].includes(t.social) && ["skittish", "curious", "aggressive"].includes(t.temper); });
      out.behaviorTraits = okT && traitsOf(SPECIES_BY_ID.velo).social === "pack" && traitsOf(SPECIES_BY_ID.trex).social === "solitary" && traitsOf(SPECIES_BY_ID.ornw).active === "nocturnal" && traitsOf(SPECIES_BY_ID.velo).temper === "aggressive";
      const keep = {exhibits:state.exhibits, minute:state.minute, day:state.day}, sq = (x, y, w) => [[x, y], [x + w, y], [x + w, y + w], [x, y + w]];
      const lone = {id:"bh1", name:"Lone", points:sq(0, 0, 40), animals:[{id:"bl", sp:"velo"}], happy:70, cond:100, stock:{meat:999}};
      const pack = {id:"bh2", name:"Pack", points:sq(100, 0, 60), animals:[0, 1, 2, 3].map(i => ({id:"bp" + i, sp:"velo"})), happy:70, cond:100, stock:{meat:999}};
      state.exhibits = [lone, pack]; state.minute = minuteAtClock(18 * 60); state.day = 1;
      for(let i = 0; i < 60; i++) behaviorTick(BEHAVIOR.step);
      out.behaviorLonelyPaces = lone.animals[0].act === "pace" && lone.animals[0].why === "lonely" && pack.animals.every(a => a.act !== "pace") && lone.animals[0].need.lonely > pack.animals[0].need.lonely;
      out.behaviorTell = exhibitReport(lone).issues.some(i => i.bad && i.text.startsWith("Pacing")) && behaviorHtml(lone).includes("Pacing:");
      const bare = enrichment(pack); pack.land = [{id:"t1", type:"logs", x:110, y:10}, {id:"t2", type:"wallow", x:140, y:40}];
      out.behaviorToys = enrichment(pack) > bare && toyPoints(pack) === 9 && !!decorProblem("logs", 0, 0);
      out.behaviorTab = behaviorHtml(pack).includes(NEED_TEXT.bored) && liveliness(pack) >= BEHAVIOR.lively[0];
      behaviorNight();
      out.behaviorNight = [...lone.animals, ...pack.animals].every(a => a.act === "rest" && a.need.bored === 20);
      // midday naps: a fed plant eater lies down once in the nap hours for 30 to 80 minutes and stays down, none at night or outside the hours, and not every animal naps
      const nx = {id:"bh3", name:"Nap", points:sq(200, 0, 80), animals:Array.from({length:20}, (_, i) => ({id:"bn" + i, sp:"plat"})), happy:70, cond:100, stock:{paleoflora:999, grass:999}};
      state.exhibits = [nx]; state.day = 5; state.minute = minuteAtClock(9 * 60); behaviorNight();
      let before = 0, longest = {}; const napped = new Set();
      for(let t = minuteAtClock(9 * 60); t < minuteAtClock(22 * 60); t += BEHAVIOR.step){
        state.minute = t; for(const a of nx.animals) a.need.hunger = 20, a.need.thirst = 15, a.need.stress = 10;
        behaviorTick(BEHAVIOR.step);
        for(const a of nx.animals) if(a.napFor && a.act === "rest"){ napped.add(a.id); longest[a.id] = Math.max(longest[a.id] || 0, a.actFor + BEHAVIOR.step); if(clockMin(t) < BEHAVIOR.nap.from * 60 - 1) before++; }
      }
      const lens = Object.values(longest);
      out.behaviorNap = napped.size >= 6 && napped.size < 20 && before === 0 && lens.every(l => l >= BEHAVIOR.nap.min - BEHAVIOR.step && l <= BEHAVIOR.nap.max + BEHAVIOR.step) && napLull(SPECIES_BY_ID.plat, minuteAtClock(8 * 60)) === 0 && napLull(SPECIES_BY_ID.plat, minuteAtClock(13 * 60)) > 0 && napLull(SPECIES_BY_ID.ornw, minuteAtClock(13 * 60)) === 0;
      // diet toys: a shank thrills a meat eater and bores a plant eater; hay feeds plant eaters; treats run out, frozen ones faster in a heat wave
      {
        const T = SPECIES_BY_ID.trex, H = SPECIES_BY_ID.tric, m = SPECIES_BY_ID.mamm;
        const ex = {id:"bh4", name:"Treats", points:sq(400, 0, 60), animals:[{id:"bm0", sp:"mamm"}, {id:"bm1", sp:"mamm"}], happy:70, cond:100, land:[{id:"tz1", type:"hay", x:420, y:20}, {id:"tz2", type:"icefish", x:440, y:40}, {id:"tz3", type:"shank", x:410, y:45}]};
        state.exhibits.push(ex);
        const diet = toyFor(LAND.shank, T) === 4 && toyFor(LAND.shank, H) === 0 && toyFor(LAND.ball, H) === 2 && toyFor(LAND.hay, T) === 3 && toyPoints(ex, m) === 1;
        const fed = browseRate(ex, "plants") === LAND.hay.hay && browseRate(ex, "paleoflora") === 0;
        const w0 = state.weather.today; state.weather.today = "hot"; treatsNight(); treatsNight(); state.weather.today = "fair";
        const melt = !landOf(ex).some(f => f.type === "icefish") && landOf(ex).some(f => f.type === "hay" && f.left === LAND.hay.lasts - 2);
        for(let i = 0; i < LAND.hay.lasts; i++) treatsNight();
        state.weather.today = w0;
        // a Paleoflora bale feeds the older plant eaters, and takes Paleoflora from the Botany Lab and the research to bale it
        const st0 = state.ceres.stock, tech0 = state.science.tech.slice();
        state.science.tech = tech0.filter(k => k !== "paleoflora"); const noTech = !!landProblem(ex, "pbale", 430, 30);
        state.science.tech = tech0.concat("paleoflora"); state.ceres.stock = 10; const noStock = !!landProblem(ex, "pbale", 430, 30);
        state.ceres.stock = 500; const okBale = !landProblem(ex, "pbale", 430, 30); placeLand(ex, "pbale", 430, 30);
        const bale = noTech && noStock && okBale && state.ceres.stock === 500 - LAND.pbale.ceres && browseRate(ex, "paleoflora") === LAND.pbale.paleo;
        ex.land = ex.land.filter(f => f.type !== "pbale"); state.ceres.stock = st0; state.science.tech = tech0;
        out.behaviorPaleoBale = bale;
        out.behaviorDietToys = diet && fed && melt && !landOf(ex).length && !!decorProblem("shank", 0, 0) && HABITAT_PROPS.includes("buglog");
        state.exhibits.splice(state.exhibits.indexOf(ex), 1);
      }
      // vivariums take their own enrichment, picked from a list and set in the glass; it stays out of open exhibits and the park
      const viv = {id:"bh3", name:"Glass", viv:"L", points:sq(300, 0, 16).map(([x, y]) => [x, Math.min(y, 10)]), animals:[{id:"bv0", sp:"arth"}, {id:"bv1", sp:"arth"}], happy:70, cond:100};
      state.exhibits.push(viv); const m0 = state.money; state.money = 1e6;
      const vBare = enrichment(viv), vNeed = enrichNeed(viv);
      addVivToy(viv, "vbranch"); addVivToy(viv, "vfeed");
      const placed = landOf(viv).filter(f => LAND[f.type].vivToy);
      out.vivToys = vNeed >= 2 && enrichment(viv) > vBare && toyPoints(viv) === 5 && placed.length === 2 && placed.every(f => inPoly(f.x, f.y, viv.points))
        && !!landProblem(pack, "vbark", 130, 30) && !!decorProblem("vbark", 0, 0) && !!vivToyProblem(pack, "vbark") && !JSON.stringify(BUILD_MENU.map(g => g.items.map(i => i.tool))).includes("land-vbark") && vivToysHtml(viv).includes("Climbing Branches");
      state.money = m0;
      const old = JSON.parse(JSON.stringify(state)); delete old.exhibits[0].animals[0].need;
      out.behaviorSave = !!upgradeSave(old).exhibits[0].animals[0].need;
      // museum: The Time Travel Lab records an event, and the finished record becomes an Education Center attraction
      {
        const sc = state.science, m1 = state.money; state.money = 1e6;
        const ec = {id:"ec1", type:"edcenter", points:sq(0, 0, 16), day:0, shows:[]};
        state.buildings.push(ec);
        const ev = MUSEUM_BY_ID["ev-dying"], tp0 = expeditionProblem("traps", ev.id);
        sc.tech.push("education"); sc.dna[ev.id] = {genome:100, quality:80};
        const l0 = showsLearn(ec), u0 = showsUpkeep(ec);
        const why = addShow(ec, ev.id);
        out.museum = !!tp0 && !why && showsOf(ec).length === 1 && showsLearn(ec) > l0 && showsUpkeep(ec) === ev.upkeep + u0 && !!addShow(ec, ev.id)
          && !showsReady(ec).includes(ev) && museumHtml(ec).includes("Take it down") && eduCenterHtml(ec).includes("Museum attractions")
          && genomeInfo(ev.id).event === ev && SITE_BY_ID.traps.event === ev.id && tripOdds("ev-hadean", "hadean").cost > 0
          && Array.isArray(upgradeSave(JSON.parse(JSON.stringify({...state, buildings:[{id:"x", type:"edcenter", points:[]}]}))).buildings[0].shows);
        // focus and modules: a focus works at strength 1, modules that suit it make it stronger, and the auditorium seats more
        sc.tech.push("edtheater", "edfossils", "edauditorium");
        const s0 = slotsOf(ec), a0 = eduAppeal(ec); ec.focus = "spectacle";
        const sp0 = focusPower(ec), a1 = eduAppeal(ec);
        const w1 = addMod(ec, "theater"), w2 = addMod(ec, "auditorium"), w3 = addMod(ec, "fossils"), w4 = addMod(ec, "theater");
        out.eduModules = sp0 === 1 && a1 > a0 && !w1 && !w2 && !w3 && !!w4 && modsOf(ec).length === 3 && focusPower(ec) > 1.5 && eduAppeal(ec) > a1
          && slotsOf(ec) === s0 + EDU_MODULES.auditorium.slots && eduUpkeep(ec) > u0 && eduLearn(ec) > l0 && modsReady(ec).length === 0
          && modulesHtml(ec).includes("Remove") && focusHtml(ec).includes("Spectacle")
          && Array.isArray(upgradeSave(JSON.parse(JSON.stringify({...state, buildings:[{id:"y", type:"edcenter", points:[]}]}))).buildings[0].mods);
        ec.focus = "conservation"; const m2 = state.money, d0 = state.today.donations || 0; serveAt({n:4, mood:50, needs:{}, cash:100, cool:{}, edu:0}, ec, "learn");
        out.eduModules = out.eduModules && (state.today.donations || 0) > d0 && state.money > m2;
        // live modules: need a lab, and work harder when the lab is busy
        const modsKeep = ec.mods; ec.mods = []; sc.tech.push("edlabwindow", "ednursery"); const deptKeep = dept; dept = t => state.buildings.find(x => x.type === t) || null;
        const hadTar = state.buildings.some(x => x.type === "tar"), labs = state.buildings.filter(x => ["oracle", "ghost", "tar", "ceres"].includes(x.type));
        state.buildings = state.buildings.filter(x => !labs.includes(x));
        const noLab = modProblem(ec, "labwindow"), noTar = modProblem(ec, "nursery");
        state.buildings.push({id:"tt", type:"tar", points:sq(500, 0, 10), day:0});
        const keepC = sc.clones, keepH = sc.hatchDay; sc.clones = [];
        const q0 = modLive("nursery"); sc.clones = [{id:"c1", sp:"x", bay:0, start:0, end:9e9}, {id:"c2", sp:"x", bay:1, start:0, end:9e9}];
        const q1 = modLive("nursery"); sc.hatchDay = state.day; const q2 = modLive("nursery");
        out.eduModules = out.eduModules && !!noLab && !!noTar && !modProblem(ec, "labwindow") && !modProblem(ec, "nursery") && q0 < q1 && q1 < q2 && q2 <= EDU_LIVE.cap && modLive("theater") === 1;
        // botanical hall and simulation room need the Botany Lab and the Time Travel Lab, and grow with finished plant DNA and event records
        state.buildings.push({id:"tc", type:"ceres", points:sq(520, 0, 10), day:0}, {id:"tg", type:"ghost", points:sq(540, 0, 10), day:0});
        sc.tech.push("edbotanical", "edsimroom");
        const keepD = sc.dna, keepB = state.ceres.beds; sc.dna = {}; state.ceres.beds = [];
        const b0 = modLive("botanical"), s0m = modLive("simroom");
        sc.dna = {"flora-Jurassic":{genome:100, quality:80}, "flora-Triassic":{genome:100, quality:80}, "ev-dying":{genome:100, quality:80}, "ev-kpg":{genome:100, quality:80}};
        const b1 = modLive("botanical"), s1m = modLive("simroom"); state.ceres.beds = [{id:"g", kind:"plant", era:"Jurassic", bay:0, start:0, end:9e9}]; const b2 = modLive("botanical");
        out.eduModules = out.eduModules && b0 < b1 && b1 < b2 && b2 <= 1 && s0m < s1m && s1m <= 1 && !modProblem(ec, "botanical") && !modProblem(ec, "simroom");
        // diorama grows with habitats that have animals, touch gallery with finished animal genomes; neither needs a lab
        sc.tech.push("ediorama", "edtouch");
        const keepE = state.exhibits.map(e => [e, e.biome]), bios = Object.keys(BIOMES);
        sc.dna = {}; const dio0 = modLive("diorama"), tch0 = modLive("touch");
        state.exhibits.filter(e => !e.viv && e.animals.length).slice(0, bios.length).forEach((e, i) => { e.biome = bios[i]; });
        const dn = new Set(state.exhibits.filter(e => !e.viv && e.animals.length).map(biomeOf)).size;
        sc.dna = Object.fromEntries(SPECIES.slice(0, 5).map(s => [s.id, {genome:100, quality:80}]));
        const tch1 = modLive("touch"), dio1 = modLive("diorama");
        out.eduModules = out.eduModules && tch0 < tch1 && tch1 <= 1 && dio0 <= dio1 && dio1 <= 1 && (dn < 2 || dio0 < dio1) && !modProblem(ec, "diorama") && !modProblem(ec, "touch");
        for(const [e, b] of keepE) e.biome = b;
        sc.dna = keepD; state.ceres.beds = keepB; state.buildings.pop(); state.buildings.pop();
        state.buildings.pop(); state.buildings.push(...labs); sc.clones = keepC; sc.hatchDay = keepH; dept = deptKeep; ec.mods = modsKeep;
        dropMod(ec, "theater"); out.eduModules = out.eduModules && modsOf(ec).length === 2; ec.mods = []; ec.focus = null;
        dropShow(ec, ev.id); out.museum = out.museum && showsOf(ec).length === 0;
        state.buildings.splice(state.buildings.indexOf(ec), 1); delete sc.dna[ev.id]; sc.tech.splice(sc.tech.indexOf("education"), 1); state.money = m1;
      }
      Object.assign(state, keep); recompute();
    }
    // staff tab: hire and fire from the park office, energy and morale, tap a worker for their panel
    {
      const keep = JSON.stringify(state.staff), mon = state.money, bs = state.buildings.length;
      state.money = 1e6; state.staff.keepers = []; state.staff.mechanics = []; state.staff.vets = []; state.staff.custodians = []; state.staff.guards = [];
      state.buildings.push({id:"b-stf", type:"station", points:[[400,400],[404,400],[404,404],[400,404]]}, {id:"b-clo", type:"closet", points:[[410,400],[414,400],[414,404],[410,404]]});
      out.staffNeedsBuilding = typeof hireStaff("guard") === "string" && state.staff.guards.length === 0;
      out.staffHire = hireStaff("keeper") === null && hireStaff("custodian") === null && state.staff.keepers.length === 1 && state.staff.custodians.length === 1 && state.staff.keepers[0].morale === STAFF.startMorale;
      openParkOffice("staff");
      const tab = document.getElementById("panel").innerHTML;
      out.staffTab = tab.includes(state.staff.keepers[0].name) && tab.includes('data-action="fireStaff"') && tab.includes('data-action="hireStaff"') && tab.includes("Scientists");
      const k = state.staff.keepers[0]; select("staff", k.id);
      const pn = document.getElementById("panel").innerHTML;
      out.staffPanel = pn.includes("Morale") && pn.includes("Energy") && pn.includes("Thoughts") && document.getElementById("sMoraleN").textContent.length > 0 && document.getElementById("sStatus").textContent.length > 0;
      // morale drifts toward what the job gives them, energy drains for non-keepers
      const m0 = moraleOf(k), c = state.staff.custodians[0]; c.stamina = 100; k.stamina = 5; k.workMin = 100; k.idleMin = 0;
      syncCrew(); syncCustodians(); const cc = ccrew[0]; const nd = {x:100, y:200}; cc.at = nd; cc.job = "scrubbing"; crew[0].at = nd;
      for(let i = 0; i < 40; i++) staffTick(5);
       out.staffMorale = moraleOf(k) < m0 && moraleOf(k) >= 0 && c.stamina < 100 && moraleFactors(k, "keeper").some(f => !f.good);
      staffNight(); out.staffNight = c.stamina === 100 && k.workMin === 0;
      // fire asks first, then removes; panel closes with the worker
      staffFireDialog(k.id);
      const dlg = document.getElementById("dlgConfirm"), asked = dlg.open && document.getElementById("confirmTitle").textContent === "Are you sure?" && state.staff.keepers.length === 1;
      document.getElementById("confirmYes").click();
      out.staffFire = asked && state.staff.keepers.length === 0 && crew.length === 0;
      staffLive(true); out.staffFireDeselect = !sel;
      const sc0 = state.science.crew.paleo; sciFireDialog("paleo"); document.getElementById("confirmNo").click(); out.sciFireAsks = state.science.crew.paleo === sc0;
      state.staff = JSON.parse(keep); state.money = mon; state.buildings.length = bs; officeTab = "office"; select(null); syncCrew(); syncCustodians(); recompute();
    }
    // rigs: an animal drawn from parts (rigs.js), turned and shifted by a tweened pose, with the strips as the fallback
    {
      const R = rigOf("plat"), n = R ? R.parts.length : 0;
      out.rigData = !!R && n === 13 && R.parts.every(p => p.img.startsWith("sprites/plat/") && p.p < n) && R.clips.walk.dense.length === 6 && R.clips.idle.dense.length === 18 && R.clips.idle.fps === 6;
      const fake = {r:3, sp:"plat", stride:0, face:1, el:document.createElementNS("http://www.w3.org/2000/svg", "g")};
      fake.el.innerHTML = rigSvg("plat", fake);
      out.rigSvg = fake.el.querySelectorAll(".spr .rig image").length === n;
      // a vivarium draws rigs too, and its rig plays the stand loop
      const vf = {r:3, sp:"comp", viv:true, face:1, act:"rest", el:document.createElementNS("http://www.w3.org/2000/svg", "g")}; vf.el.innerHTML = spriteSvg("comp", vf);
      out.rigViv = vf.el.querySelectorAll(".spr .rig image").length === rigOf("comp").parts.length && (rigStep(vf, "idle"), vf.rg.mode === "idle" || String(vf.rg.mode).startsWith("idle"));
      // at rest each part sits where its joints add up
      const rest = new Float32Array(n * 3), m = new Float64Array(n * 6); rigMatrices(R, rest, m);
      const at = i => { let x = 0, y = 0; for(let q = i; q >= 0; q = R.parts[q].p){ x += R.parts[q].x; y += R.parts[q].y; } return [x, y]; };
      out.rigRest = R.parts.every((p, i) => { const [x, y] = at(i); return Math.abs(m[i*6] - 1) < 1e-9 && Math.abs(m[i*6 + 4] - x) < 1e-6 && Math.abs(m[i*6 + 5] - y) < 1e-6; });
      // a turn carries the children with it: turn the root part 90 degrees and a child's offset swings from (x, y) to (-y, x)
      const kid = R.parts.findIndex(p => p.p >= 0 && R.parts[p.p].p < 0), root = R.parts[kid].p, turned = new Float32Array(n * 3); turned[root*3] = 90; rigMatrices(R, turned, m);
      const cx = R.parts[root].x + (-R.parts[kid].y), cy = R.parts[root].y + R.parts[kid].x;
      out.rigTurn = Math.abs(m[root*6]) < 1e-6 && Math.abs(m[root*6 + 1] - 1) < 1e-6 && Math.abs(m[kid*6 + 4] - cx) < 1e-4 && Math.abs(m[kid*6 + 5] - cy) < 1e-4;
      // loops wrap and tween: a whole cycle is the same pose, and halfway between two key poses is their average
      const a = new Float32Array(n * 3), b = new Float32Array(n * 3), c = new Float32Array(n * 3), d = new Float32Array(n * 3), f1 = R.clips.walk.dense;
      rigSample(R, "walk", 0, a); rigSample(R, "walk", 1, b); rigSample(R, "walk", .5 / 6, c); rigSample(R, "walk", 1 / 6, d);
      out.rigLoop = a.every((v, i) => Math.abs(v - b[i]) < 1e-4 && Math.abs(v - f1[0][i]) < 1e-4) && d.every((v, i) => Math.abs(v - f1[1][i]) < 1e-4) && c.every((v, i) => Math.abs(v - (f1[0][i] + f1[1][i]) / 2) < 1e-3);
      // resting plays the rest clip once and holds its last frame, and going back to idle lets go of it
      const rg = fake.rg, last = R.clips.rest.dense[R.clips.rest.dense.length - 1], step = mode => { rg.last = performance.now() - 100; rigStep(fake, mode); };
      for(let i = 0; i < 80; i++) step("rest");
      const held = last.every((v, i) => Math.abs(v - rg.cur[i]) < 1e-3);
      for(let i = 0; i < 80; i++) step("rest");
      const still = last.every((v, i) => Math.abs(v - rg.cur[i]) < 1e-3);
      const rr2 = Math.random; Math.random = () => .999;   // no idle clip rolls, so it ends standing in plain "idle"
      for(let i = 0; i < 80; i++) step("idle");
      Math.random = rr2;
      out.rigRestHold = R.clips.rest.dense.length === 15 && held && still && rg.mode === "idle" && !last.every((v, i) => Math.abs(v - rg.cur[i]) < 1e-3);
      // standing still holds the idle clip's first frame; the clip plays when the animal stops (by chance) or after a while of standing, and once it starts it finishes (lock) and goes back to holding
      const f2 = {r:3, sp:"plat", stride:0, face:1, act:"patrol", el:document.createElementNS("http://www.w3.org/2000/svg", "g")}; f2.el.innerHTML = rigSvg("plat", f2);
      const g2 = f2.rg, base = R.clips.idle.dense[0], near = v => base.every((b, i) => Math.abs(b - v[i]) < 1e-3), tick2 = (f = f2) => { f.rg.last = performance.now() - 100; rigStep(f, "idle"); }, keepChance = RIG_IDLE.chance;
      RIG_IDLE.chance = 0; for(let i = 0; i < 20; i++) tick2();
      const holds = near(g2.cur) && g2.idleT >= 1 && !g2.lock;
      g2.gap = 0; tick2(); const started = g2.lock && g2.idleT < 1;
      f2.act = "rest"; let locked = 0, moved = 0; for(let i = 0; i < 30; i++){ tick2(); if(g2.lock) locked++; if(!near(g2.cur)) moved++; }
      const done = !g2.lock && near(g2.cur) && g2.idleT >= 1;
      // stopping can start it at once, and eating never does
      RIG_IDLE.chance = 1; const f3 = {r:3, sp:"plat", stride:0, face:1, act:"patrol", el:document.createElementNS("http://www.w3.org/2000/svg", "g")}; f3.el.innerHTML = rigSvg("plat", f3); tick2(f3);
      const atStop = f3.rg.lock; f3.rg.mode = "walk"; f3.rg.idleT = 1; f3.rg.lock = false; f3.act = "eat"; tick2(f3);
      // a rig with a stand loop (the Coelophysis) loops it while standing; with RIG_IDLE.dyn 0 no idle clip plays, and with 1 one of its idle clips (idle, idle2, picked at random) plays at each loop's end, eased in, locked till done, then back to the loop
      const f5 = {r:3, sp:"coel", stride:0, face:1, act:"patrol", el:document.createElementNS("http://www.w3.org/2000/svg", "g")}; f5.el.innerHTML = rigSvg("coel", f5);
      const keepDyn = RIG_IDLE.dyn; RIG_IDLE.dyn = 0; let loops = 0, prevT = 0, standLock = false;
      for(let k = 0; k < 40; k++){ tick2(f5); if(f5.rg.standT < prevT) loops++; prevT = f5.rg.standT; if(f5.rg.lock || f5.rg.idleT < 1) standLock = true; }
      RIG_IDLE.dyn = 1; const seen = new Set(); let eased = true, playLock = true, backToStand = false;
      for(let k = 0; k < 30; k++){
        f5.rg.standT = .999; const before = f5.rg.cur.slice(); tick2(f5); seen.add(f5.rg.idleC);
        if(f5.rg.idleT >= 1 || !f5.rg.lock || f5.rg.blend >= 1 || Math.max(...f5.rg.cur.map((v, i) => Math.abs(v - before[i]))) > 15) eased = false;
        RIG_IDLE.dyn = 0; for(let i = 0; i < 60; i++){ tick2(f5); if(f5.rg.idleT < 1 && !f5.rg.lock) playLock = false; } backToStand = f5.rg.idleT >= 1 && !f5.rg.lock; RIG_IDLE.dyn = 1;
      }
      RIG_IDLE.dyn = keepDyn;
      out.rigIdles = !!(RIGS.coel && RIGS.coel.clips.stand && RIGS.coel.clips.idle2) && loops >= 2 && !standLock && seen.has("idle") && seen.has("idle2") && eased && playLock && backToStand;
      RIG_IDLE.chance = keepChance;
      out.rigIdleHold = holds && started && locked > 10 && locked < 30 && moved > 10 && done && atStop && !f3.rg.lock;
      // lying down finishes before it lets go
      const f4 = {r:3, sp:"plat", stride:0, face:1, act:"rest", el:document.createElementNS("http://www.w3.org/2000/svg", "g")}; f4.el.innerHTML = rigSvg("plat", f4);
      const rs = () => { f4.rg.last = performance.now() - 100; rigStep(f4, "rest"); }; rs(); const lockedRest = f4.rg.lock; for(let i = 0; i < 80; i++) rs();
      out.rigRestLock = lockedRest && !f4.rg.lock;
      // swapped parts (o:1, a frame's v): the Cotylorhynchus shows one of its three heads, open while it walks, shut once it has lain down to sleep
      const shownHeads = f => [...f.el.querySelector(".rig").children].map((im, i) => [RIGS.coty.parts[i].n, im.style.display !== "none"]).filter(([n, on]) => /HEAD/.test(n) && on).map(([n]) => n).join();
      const f6 = {r:3, sp:"coty", stride:0, face:1, act:"rest", el:document.createElementNS("http://www.w3.org/2000/svg", "g")}; f6.el.innerHTML = rigSvg("coty", f6);
      const openAtFirst = shownHeads(f6) === "COTY_HEAD";
      for(let i = 0; i < 200; i++){ f6.rg.last = performance.now() - 100; rigStep(f6, "rest"); }
      const asleep = shownHeads(f6) === "COTY_HEAD_CLOSED";
      f6.stride = 1; f6.rg.last = performance.now() - 100; rigStep(f6, "walk");
      out.rigSwap = openAtFirst && asleep && shownHeads(f6) === "COTY_HEAD";
      // switching rigs off draws the strips (and a vivarium draws strips then too), and back on restores them
      setRigs(false); const strips = spriteSvg("plat", {r:3, face:1}), offOk = !rigOf("plat") && strips.includes("plat-walk.png") && !strips.includes('class="rig"');
      const vivOff = (setRigs(false), spriteSvg("plat", {r:3, face:1, viv:true})); setRigs(true); const viv = spriteSvg("plat", {r:3, face:1, viv:true});
      out.rigToggle = offOk && vivOff.includes("sprites/plat.png") && !vivOff.includes('class="rig"') && !!rigOf("plat") && spriteSvg("plat", {r:3, face:1}).includes('class="rig"') && viv.includes('class="rig"') && localStorage.getItem("genesis-rigs") === "1";

      // bar fence pictures: broken at 0 condition, rusted below FENCE_LOOK.worn, pristine otherwise (and for loose fence with no condition)
      out.fenceState = fenceState(100) === "pristine" && fenceState(FENCE_LOOK.worn) === "pristine" && fenceState(FENCE_LOOK.worn - 1) === "degrading" && fenceState(.1) === "degrading" && fenceState(0) === "broken" && fenceState(undefined) === "pristine";
      // an east-west side is 3 m pictures laid along it (7 m: 3 sections, the last cut short, plus a post at the end); a north-south side is seen edge-on and is a column (steel, rust blocks when worn, a low heap with post stubs when broken); other fences are untouched
      const fb = (cond, a, b, kind = "bars") => fence34([a, b], false, kind, "all", {cond}), ew = fb(100, [0, 0], [7, 0]), nsd = fb(100, [0, 0], [0, 7]);
      out.fenceSprite = (ew.match(/<image /g) || []).length === 4 && ew.includes("bars-pristine.png") && fb(30, [0, 0], [7, 0]).includes("bars-degrading.png") && fb(0, [0, 0], [7, 0]).includes("bars-broken.png")
        && !nsd.includes("<image") && nsd.includes("<rect") && nsd.includes(FENCE_EDGE.bars.steel.hi) && !nsd.includes(FENCE_EDGE.bars.rust.mid) && fb(30, [0, 0], [0, 7]).includes(FENCE_EDGE.bars.rust.mid) && fb(0, [0, 0], [0, 7]).includes(FENCE_EDGE.bars.rust.mid) && !fb(0, [0, 0], [0, 7]).includes("<image")
        && /height="[\d.]+"/.test(nsd) && nsd.match(/<rect /g).length > fb(0, [0, 0], [0, 7]).match(/<rect /g).length * .3 && fb(50, [0, 0], [7, 0], "concrete").includes("concrete-degrading.png");

      // a bar fence's keeper gate never wears (same picture at 100, 30 and 0 condition), set into its side, and swings open in frames 1 to 3; north-south it is posts, a latch and (open) leaves; other fences ignore it
      const fg = (cond, a, b, kind = "bars", f = 0) => fence34([a, b], false, kind, "all", {cond, gate:{i:0, p:[3.5, 0], id:"gt", f}});
      out.fenceGate = fg(100, [0, 0], [7, 0]).includes("bars-gate.png") && fg(0, [0, 0], [7, 0]).includes("bars-gate.png") && fg(30, [0, 0], [7, 0]).includes("bars-gate.png") && !fg(30, [0, 0], [7, 0]).includes("gate-degrading")
        && fg(100, [0, 0], [7, 0], "bars", 2).includes('bars-gate-2.png') && fg(100, [0, 0], [7, 0]).includes('data-gate="gt"')
        && !fg(0, [0, 0], [0, 7]).includes("<image") && fg(0, [0, 0], [0, 7]).includes(GATE_GOLD.mid) && fg(0, [0, 0], [0, 7], "bars", 3).includes("<g data-go >") && fg(0, [0, 0], [0, 7]).includes('<g data-go display="none">')
        && !fb(100, [0, 0], [7, 0]).includes("bars-gate");
      // the wood fence has its own pictures (same states and gate frames) and its own edge-on colors
      out.woodFence = fb(100, [0, 0], [7, 0], "wood").includes("wood-pristine.png") && fb(30, [0, 0], [7, 0], "wood").includes("wood-degrading.png") && fb(0, [0, 0], [7, 0], "wood").includes("wood-broken.png") && !fb(100, [0, 0], [7, 0], "wood").includes("bars-")
        && fg(100, [0, 0], [7, 0], "wood", 2).includes("wood-gate-2.png") && fb(100, [0, 0], [0, 7], "wood").includes(FENCE_EDGE.wood.steel.hi) && fb(30, [0, 0], [0, 7], "wood").includes(FENCE_EDGE.wood.rust.mid);
      // the electric fence: same states, an -off twin when its exhibit has no power (not for broken), its own gate frames, and end-on posts with lamps and wires
      const fe = (cond, a, b, powered, gate) => fence34([a, b], false, "electric", "all", {cond, powered, gate});
      out.electricFence = fe(100, [0, 0], [7, 0]).includes("electric-pristine.png") && fe(100, [0, 0], [7, 0], false).includes("electric-pristine-off.png") && fe(30, [0, 0], [7, 0], false).includes("electric-degrading-off.png")
        && fe(0, [0, 0], [7, 0], false).includes("electric-broken.png") && !fe(0, [0, 0], [7, 0], false).includes("-off") && fe(100, [0, 0], [7, 0], undefined).includes("electric-pristine.png")
        && fe(100, [0, 0], [7, 0], false, {i:0, p:[3.5, 0], id:"gt", f:2}).includes("electric-gate-off-2.png") && fe(100, [0, 0], [7, 0], true, {i:0, p:[3.5, 0], id:"gt", f:0}).includes("electric-gate.png")
        && !fe(100, [0, 0], [0, 7], true).includes("<image") && fe(100, [0, 0], [0, 7], true).includes(FENCE_LAMP.on) && fe(100, [0, 0], [0, 7], false).includes(FENCE_LAMP.off) && !fe(100, [0, 0], [0, 7], false).includes(FENCE_LAMP.on);
      // the acrylic fence: its own pictures and gate (not the old translucent polygon), and an edge-on pane with an aluminium frame at the posts
      const fa = (cond, a, b, gate) => fence34([a, b], false, "acrylic", "all", {cond, gate});
      out.acrylicFence = fa(100, [0, 0], [7, 0]).includes("acrylic-pristine.png") && fa(30, [0, 0], [7, 0]).includes("acrylic-degrading.png") && fa(0, [0, 0], [7, 0]).includes("acrylic-broken.png") && !fa(100, [0, 0], [7, 0]).includes("<polygon")
        && fa(100, [0, 0], [7, 0], {i:0, p:[3.5, 0], id:"gt", f:3}).includes("acrylic-gate-3.png") && !fa(100, [0, 0], [0, 7]).includes("<image") && fa(100, [0, 0], [0, 7]).includes(FENCE_EDGE.acrylic.steel.mid) && fa(100, [0, 0], [0, 7]).includes(FENCE_EDGE.acrylic.frame.mid);
      // the hedge: its own pictures and gate in place of the old polygon, and a leafy column edge-on (dry when worn, a low heap when broken)
      const fh = (cond, a, b, gate) => fence34([a, b], false, "hedge", "all", {cond, gate});
      out.hedgeFence = fh(100, [0, 0], [7, 0]).includes("hedge-pristine.png") && fh(30, [0, 0], [7, 0]).includes("hedge-degrading.png") && fh(0, [0, 0], [7, 0]).includes("hedge-broken.png") && !fh(100, [0, 0], [7, 0]).includes("<polygon")
        && fh(100, [0, 0], [7, 0], {i:0, p:[3.5, 0], id:"gt", f:1}).includes("hedge-gate-1.png") && !fh(100, [0, 0], [0, 7]).includes("<image") && fh(100, [0, 0], [0, 7]).includes(FENCE_EDGE.hedge.steel.mid) && !fh(100, [0, 0], [0, 7]).includes(FENCE_EDGE.hedge.rust.mid)
        && fh(30, [0, 0], [0, 7]).includes(FENCE_EDGE.hedge.rust.mid) && fh(0, [0, 0], [0, 7]).includes(FENCE_EDGE.hedge.rust.mid);
      // the concrete wall: its own pictures and gate (not the old grey polygon), and an edge-on slab with rust blocks when worn
      const fc = (cond, a, b, gate) => fence34([a, b], false, "concrete", "all", {cond, gate});
      out.concreteFence = fc(100, [0, 0], [7, 0]).includes("concrete-pristine.png") && fc(30, [0, 0], [7, 0]).includes("concrete-degrading.png") && fc(0, [0, 0], [7, 0]).includes("concrete-broken.png") && !fc(100, [0, 0], [7, 0]).includes("<polygon")
        && fc(100, [0, 0], [7, 0], {i:0, p:[3.5, 0], id:"gt", f:2}).includes("concrete-gate-2.png") && !fc(100, [0, 0], [0, 7]).includes("<image") && fc(100, [0, 0], [0, 7]).includes(FENCE_EDGE.concrete.steel.mid) && !fc(100, [0, 0], [0, 7]).includes(FENCE_EDGE.concrete.rust.mid) && fc(30, [0, 0], [0, 7]).includes(FENCE_EDGE.concrete.rust.mid);
      // brick and stone: between acrylic and concrete in strength, their own pictures and gates, and an edge-on slab
      const fm = (k, cond, a, b, gate) => fence34([a, b], false, k, "all", {cond, gate});
      out.masonryFence = ["brick", "stone"].every(k => BARRIERS[k].strength > BARRIERS.acrylic.strength && BARRIERS[k].strength < BARRIERS.concrete.strength && BARRIERS[k].tech === "masonry" && TECH.some(t => t.id === "masonry")
        && fm(k, 100, [0, 0], [7, 0]).includes(k + "-pristine.png") && fm(k, 30, [0, 0], [7, 0]).includes(k + "-degrading.png") && fm(k, 0, [0, 0], [7, 0]).includes(k + "-broken.png") && !fm(k, 100, [0, 0], [7, 0]).includes("<polygon")
        && fm(k, 100, [0, 0], [7, 0], {i:0, p:[3.5, 0], id:"gt", f:1}).includes(k + "-gate-1.png") && !fm(k, 100, [0, 0], [0, 7]).includes("<image") && fm(k, 30, [0, 0], [0, 7]).includes(FENCE_EDGE[k].rust.mid));
      out.moreFences = ["bamboo", "palisade", "iron", "drystone", "adobe", "stake", "bone", "rope"].every(k => !!BARRIERS[k] && !!FENCE_SPRITES[k] && !!FENCE34[k].sprite
        && fm(k, 100, [0, 0], [7, 0]).includes(k + "-pristine.png") && fm(k, 30, [0, 0], [7, 0]).includes(k + "-degrading.png") && fm(k, 0, [0, 0], [7, 0]).includes(k + "-broken.png")
        && fm(k, 100, [0, 0], [7, 0], {i:0, p:[3.5, 0], id:"gt", f:3}).includes(k + "-gate-3.png") && !fm(k, 100, [0, 0], [0, 7]).includes("<image") && fm(k, 30, [0, 0], [0, 7]).includes(FENCE_EDGE[k].rust.mid));
      // drawGates: a keeper at the gate swings it open frame by frame, and it shuts when they leave
      const gh = document.createElementNS("http://www.w3.org/2000/svg", "svg"); gh.innerHTML = fg(100, [0, 0], [7, 0]); document.body.appendChild(gh);
      const gex = {id:"gt", gate:[3.5, 0]}; state.exhibits.push(gex);
      const keeperBak = crew, posBak = staffPos; crew = [{at:true}]; staffPos = () => [3.5, 1];
      let gt = gateT; for(let i = 0; i < 12; i++) drawGates(gt += 50);
      const openHref = gh.querySelector("image[data-gate]").getAttribute("href");
      staffPos = () => [30, 30]; for(let i = 0; i < 12; i++) drawGates(gt += 50);
      const shutHref = gh.querySelector("image[data-gate]").getAttribute("href");
      out.gateOpens = openHref.endsWith("bars-gate-3.png") && shutHref.endsWith("bars-gate.png") && gateFrameOf("gt") === 0;
      crew = keeperBak; staffPos = posBak; state.exhibits.pop(); gh.remove(); delete gateOpen.gt;

      // a rigged swimmer napping in a pond it never left (spawned there, or water drawn under it) is drawn in the water (its rig clipped at the waterline, a ghost below, ripples on it), not lying on top of it, and goes back to a plain rig on the bank
      const RS = rigOf("prio");
      out.rigSwimData = !!RS && rigSwims("prio") && RS.clips.swim.wl > 30 && RS.clips.swim.dense.length === 8 && RS.clips.swim.fps === 6;
      const nap = {id:"e-nap", name:"Nap", animals:[{id:"nap1", sp:"prio", act:"rest"}], points:[[0,0],[60,0],[60,40],[0,40]], cond:100, biome:"wetland", water:[{id:"w-nap", points:[[5,5],[55,5],[55,35],[5,35]]}]};
      state.exhibits.push(nap); syncAnimals();
      const nh = herd.get("nap1"); nh.x = 30; nh.y = 20; nh.wait = 99; nh.placed = true; animateAnimals(.05); nh.rg.last = performance.now() - 100; animateAnimals(.05);
      const inWater = !!nh.swim && !!nh.el.querySelector(".rig") && !!nh.el.querySelector(".rig-ghost") && !!nh.el.querySelector(".rig-wake") && !nh.el.querySelector(".wk") && nh.rg.mode === "float";
      const ghostParts = nh.el.querySelectorAll(".rig-ghost image").length === RS.parts.length && nh.el.querySelectorAll(".rig image").length === RS.parts.length;
      for(let i = 0; i < 12; i++){ nh.rg.last = performance.now() - 100; animateAnimals(.05); }   // it sinks to the waterline over the blend time
      const rect = nh.el.querySelector("#" + nh.cid + "a rect"), sunk = rect && Math.abs(+rect.getAttribute("height") - (RS.clips.swim.wl + 20)) < .01;
      nh.x = 2; nh.y = 20; animateAnimals(.05);
      out.rigSwimNap = inWater && ghostParts && !!sunk && !nh.swim && !!nh.el.querySelector(".rig") && !nh.el.querySelector(".rig-ghost") && !nh.el.querySelector(".wk");
      // with rigs off a swimmer keeps its swim strip
      setRigs(false); const swStrip = spriteSvg("prio", {r:3, face:1, swim:true}); setRigs(true);
      out.rigSwimStrip = swStrip.includes("prio-swim.png") && !swStrip.includes("rig-ghost");
      state.exhibits.splice(state.exhibits.indexOf(nap), 1); syncAnimals();
    }
    {   // weather overlay: exists, ignores clicks, follows state.weather.today
      const cv = document.getElementById("wxfx"), keep = state.weather.today, seen = {};
      for(const k of ["fair", "hot", "cold", "storm"]){ state.weather.today = k; drawWeather(performance.now()); const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data; seen[k] = d.some(v => v) ; seen[k + "k"] = cv.dataset.kind; }
      state.weather.today = keep; drawWeather(performance.now());
      out.weatherOverlay = !!cv && getComputedStyle(cv).pointerEvents === "none" && !seen.fair && seen.hot && seen.cold && seen.storm && seen.stormk === "storm" && seen.fairk === "fair";
    }
    // dust puff: the hook adds squares that don't take clicks, then they clear and nothing lands in state
    {
      const fl = document.querySelector("#fxLayer"), before = JSON.stringify(state).length;
      events.fx("dust", 10, 10); drawFx(performance.now());
      const shown = fl.querySelectorAll("rect").length >= 4 && getComputedStyle(fl).pointerEvents === "none";
      drawFx(performance.now() + FX_DUST.life + 50);
      out.dustPuff = shown && fl.childElementCount === 0 && fxList.length === 0 && JSON.stringify(state).length === before;
    }
    {   // animal names: default tag + counter per species, migration, rename from the panel
      const seqKeep = state.animalSeq, exKeep = state.exhibits;
      state.animalSeq = {}; state.exhibits = [{id:"e-nm", name:"Name Test", points:[[0,0],[40,0],[40,40],[0,40]], animals:[], happy:70, cond:100}];
      const e = state.exhibits[0], mk = id => nameAnimal({id, sp:"coty"});
      const a1 = mk("a-n1"), a2 = mk("a-n2"), d1 = nameAnimal({id:"a-n3", sp:"coel"});
      e.animals.push(a1, a2, d1);
      out.animalDefaultNames = a1.name === "COTY-001" && a2.name === "COTY-002" && d1.name === "COEL-001" && state.animalSeq.coty === 2;
      // numbers are never reused, even after one leaves
      e.animals.splice(1, 1);
      out.animalNamesNotReused = mk("a-n4").name === "COTY-003";
      // an old save with unnamed animals (and no counter) gets names, and keeps counting after the highest one
      const old = JSON.parse(JSON.stringify(state)); delete old.animalSeq;
      old.exhibits[0].animals.forEach(a => { delete a.name; }); old.exhibits[0].animals.push({id:"a-n5", sp:"coty", name:"COTY-007"}, {id:"a-n6", sp:"coty"});
      const up = upgradeSave(old);
      out.animalMigration = up.exhibits[0].animals.every(a => /^[A-Z]+-\d{3}$/.test(a.name)) && new Set(up.exhibits[0].animals.map(a => a.name)).size === up.exhibits[0].animals.length && up.exhibits[0].animals.find(a => a.id === "a-n6").name === "COTY-009" && up.animalSeq.coty === 9;
      // the panel: open, shows the name escaped, rename in place, blank keeps the old name
      select("animal", a1.id); animalLive(true);
      const inp = document.getElementById("aName");
      out.animalPanelOpens = !!inp && inp.value === a1.name && !!document.getElementById("anMoodBar") && document.querySelectorAll("#anStress li").length > 0;
      // the panel's Health section: healthy, then injured (cause and status shown), and mild illness nobody has spotted stays hidden
      const hl = () => document.getElementById("anHealth").textContent;
      out.animalHealthHealthy = /Looks healthy/.test(hl()) && /Accuracy/.test(hl()) && /Genome Quality/.test(hl()) && !/chance a day/.test(hl());
      a1.sick = {kind:"injury", name:"bite", sev:55, hit:{by:"Dimetrodon", how:"bite"}}; animalLive(true);
      out.animalHealthInjured = /Bite Wound, Serious\./.test(hl()) && /Bitten by a Dimetrodon\./.test(hl()) && document.getElementById("anHpN").textContent === "45%" && document.getElementById("anHpBar").style.width === "45%";
      // the exhibit's Animals and Health tabs show each animal's health too
      { const ex = animalHome(a1.id), tk = exTabs.tab, tx = exTabs.ex; exTabs.ex = ex.id; exTabs.tab = "animals"; const at = exhibitHtml(ex); exTabs.tab = "health"; const ht = exhibitHtml(ex); exTabs.tab = tk; exTabs.ex = tx;
        out.exhibitTabsHealthBar = /Bite Wound, Serious, 45% health/.test(at) && /Bite Wound, Serious, 45% health/.test(ht) && /Healthy, 100% health/.test(ht) && /width:45%/.test(ht); }
      a1.sick = {kind:"infection", name:"pneumonia", sev:10, hidden:true}; animalLive(true);
      out.animalHealthHidden = /Looks healthy/.test(hl()) && !/Pneumonia/.test(hl()) && document.getElementById("anHpN").textContent === "100%";
      // low hunger, thirst and sanitation show on the animal's Health section and the exhibit's Health tab, and only when low
      const ex0 = animalHome(a1.id), dirtKeep = ex0.dirt, needKeep = {...a1.need};
      ex0.dirt = 0; a1.need.hunger = 0; a1.need.thirst = 0; animalLive(true);
      out.animalHealthBasicsQuiet = !/hungry|thirsty|Sanitation is low/.test(hl());
      ex0.dirt = 50; a1.need.hunger = 80; a1.need.thirst = 55; animalLive(true);
      out.animalHealthBasics = /It's hungry/.test(hl()) && /It's thirsty/.test(hl()) && /Sanitation is low \(50%\)/.test(hl());
      { const tk = exTabs.tab, tx = exTabs.ex; exTabs.ex = ex0.id; exTabs.tab = "health"; const hh = exhibitHtml(ex0); exTabs.tab = tk; exTabs.ex = tx;
        out.exhibitHealthBasics = /1 of \d+ are hungry|It's hungry/.test(hh) && /thirsty/.test(hh) && /Sanitation is low \(50%\)/.test(hh); }
      ex0.dirt = dirtKeep; Object.assign(a1.need, needKeep);
      delete a1.sick; animalLive(true);
      inp.value = "Rex <b>"; inp.dispatchEvent(new Event("input", {bubbles:true})); inp.dispatchEvent(new Event("change", {bubbles:true}));
      out.animalRename = a1.name === "Rex <b>" && document.getElementById("aName") === inp && !panelEl.querySelector("h2 b, section b");
      inp.value = "x".repeat(60); inp.dispatchEvent(new Event("change", {bubbles:true}));
      out.animalRenameMax = a1.name.length === 24;
      inp.value = "   "; inp.dispatchEvent(new Event("change", {bubbles:true}));
      out.animalRenameBlank = a1.name === "x".repeat(24) && inp.value === a1.name;
      select(null); state.animalSeq = seqKeep; state.exhibits = exKeep; syncAnimals();
    }
    {   // animal attacks: loose predators raid exhibits they can get into, stressed animals fight, predators hunt their prey
      const exKeep = state.exhibits, looseKeep = state.safety.loose, fxKeep = events.fx, diedKeep = events.died, tKeep = events.toast;
      const fx = [], died = []; events.fx = (k, x, y) => fx.push([k, x, y]); events.died = d => died.push(d); events.toast = () => {};
      const pen = (id, sps) => ({id, name:"Pen " + id, points:[[0,0],[40,0],[40,40],[0,40]], animals:sps.map((sp, i) => nameAnimal({id:id + "-" + i, sp})), happy:70, cond:100, barrier:"wood"});
      const hurtCount = e => e.animals.filter(a => a.sick && a.sick.hit).length;
      // 1. a loose Dimetrodon beside a pen of Cotylorhynchus: it gets in through a breach, not through a strong fence
      let e = pen("e-at1", ["coty", "coty", "coty"]); state.exhibits = [e];
      const dm = SPECIES_BY_ID.dime, lo = () => ({id:"l-at", sp:"dime", status:"loose", at:null, x:46, y:20});
      state.safety.loose = [lo()];
      e.barrier = "concrete"; e.cond = 100;
      for(let i = 0; i < 20; i++) looseAttacks(60);
      out.attackFenceHolds = !canGetIn(e, dm) && hurtCount(e) === 0 && !fx.length;
      e.cond = 0;
      for(let i = 0; i < 20 && !hurtCount(e); i++){ state.safety.loose[0].biteAt = undefined; looseAttacks(60); }
      const hit = e.animals.find(a => a.sick && a.sick.hit);
      out.looseAttacks = !!hit && hit.sick.kind === "injury" && hit.sick.hit.by === dm.name && hit.sick.hit.how === "loose" && fx.length >= 1 && fx[0][0] === "dust" && state.safety.loose[0].biteAt != null;
      // out of reach, or with the gap between bites not yet passed, it leaves them be
      const before = e.animals.reduce((n, a) => n + (a.sick ? a.sick.sev : 0), 0);
      looseAttacks(60); state.safety.loose[0].x = 200; state.safety.loose[0].biteAt = undefined; looseAttacks(60);
      out.looseNeedsReach = e.animals.reduce((n, a) => n + (a.sick ? a.sick.sev : 0), 0) === before;
      // a bite can kill outright, and the death dialog names the attacker
      const vic = e.animals[0]; died.length = 0; vic.sick = {kind:"injury", name:"bite", sev:90}; hurtAnimal(e, vic, dm.name, "loose", [30, 30], 0);
      out.attackKills = !e.animals.includes(vic) && died.length === 1 && died[0].cause === "Killed by a Dimetrodon" && died[0].exhibit === e.name;
      // 2. fights: a stressed, crowded herd hurts itself; a calm one doesn't
      e = pen("e-at2", ["coel", "coel", "coel", "coel"]); state.exhibits = [e];
      const ctxOf = ratio => ({counts:speciesCounts(e), ratio});
      for(const a of e.animals) a.need = {...freshNeeds(), stress:10};
      for(let i = 0; i < 400; i++){ for(const a of e.animals) delete a.hitAt; attackStep(e, ctxOf(.5)); }
      out.calmNoFights = hurtCount(e) === 0;
      for(const a of e.animals) a.need.stress = 100;
      for(let i = 0; i < 400 && !hurtCount(e); i++){ for(const a of e.animals) delete a.hitAt; attackStep(e, ctxOf(.5)); }
      const fought = e.animals.find(a => a.sick && a.sick.hit);
      out.fightsInjure = !!fought && fought.sick.hit.how === "fight" && fought.sick.kind === "injury" && needsOf(fought).stress >= 100 - 1;
      // an aggressive animal that is not crowded still fights at high stress, and the cause reads right if it dies
      const f2 = e.animals.find(a => a !== fought); died.length = 0; f2.sick = {kind:"injury", name:"laceration", sev:95}; hurtAnimal(e, f2, "Coelophysis", "fight", [10, 10], 0);
      out.fightDeathCause = died.length === 1 && died[0].cause === "Killed by a Coelophysis";
      // 3. a predator housed with prey stalks it (the hunt act) and strikes
      e = pen("e-at3", ["dime", "coty", "coty"]); state.exhibits = [e];
      const pred = e.animals[0], ctx3 = behaviorCtx(e);
      for(const a of e.animals) a.need = {...freshNeeds(), hunger:10};
      // a fed, calm predator leaves its prey alone, however long it hunts; a hungry (or stressed, or bored) one stalks it
      out.fedLeavesPrey = pickAct(e, pred, dm, ctx3) !== "hunt" && !huntDriven(pred);
      pred.act = "hunt"; pred.actFor = ATTACK.stalk;
      for(let i = 0; i < 300; i++){ delete pred.hitAt; attackStep(e, ctx3); }
      out.noMindlessAttacks = hurtCount(e) === 0;
      pred.need.hunger = 80;
      out.predatorStalks = huntDriven(pred) && pickAct(e, pred, dm, ctx3) === "hunt" && pickAct(e, e.animals[1], SPECIES_BY_ID.coty, ctx3) !== "hunt";
      pred.need.hunger = 10; pred.need.stress = 70; out.stressDrivesHunt = huntDriven(pred);
      pred.need.stress = 15; pred.need.bored = 90; out.boredDrivesHunt = huntDriven(pred);
      pred.need.bored = 20; pred.need.hunger = 80;
      pred.act = "hunt"; pred.actFor = 0;
      attackStep(e, ctx3); out.noStrikeBeforeStalk = hurtCount(e) === 0;
      pred.actFor = ATTACK.stalk;
      // the mix warning names who hunts whom, and stays quiet for a compatible herd
      out.mixWarns = /Dimetrodon will hunt Cotylorhynchus/.test(mixWarning(dm, pen("e-mx", ["coty"])) || "") && mixWarning(SPECIES_BY_ID.coty, pen("e-mx2", ["coty"])) === null && !!mixWarning(SPECIES_BY_ID.coty, pen("e-mx3", ["dime"]));
      for(let i = 0; i < 100 && !hurtCount(e); i++){ delete pred.hitAt; attackStep(e, ctx3); }
      const prey = e.animals.find(a => a.sick && a.sick.hit);
      out.predatorStrikes = !!prey && prey.sp === "coty" && prey.sick.hit.how === "hunt" && pred.hitAt != null;
      // it keeps its distance while the gap between strikes runs, and its own kind is never prey
      const sevs = JSON.stringify(e.animals.map(a => a.sick)); attackStep(e, ctx3);
      out.huntGapHolds = JSON.stringify(e.animals.map(a => a.sick)) === sevs;
      out.noCannibals = preyIn(e, dm, speciesCounts(e)).join() === "coty";
      // old saves: no new fields are needed
      const oldE = JSON.parse(JSON.stringify(pen("e-at4", ["coty"]))); out.attackOldSave = !oldE.animals[0].sick && !oldE.animals[0].hitAt;
      state.exhibits = exKeep; state.safety.loose = looseKeep; events.fx = fxKeep; events.died = diedKeep; events.toast = tKeep; syncAnimals();
    }
    {   // sex: ordered clones carry the chosen sex, old saves get one, a single-sex herd is lonelier and less happy
      const exKeep = state.exhibits, readyKeep = state.science.specimens, clonesKeep = state.science.clones, cpKeep = cloneProblem, tKeep = events.toast, mKeep = state.money;
      events.toast = () => {}; cloneProblem = () => null; state.money = 1e9;
      const pen = (id, sps) => ({id, name:"Pen " + id, points:[[0,0],[40,0],[40,40],[0,40]], animals:sps.map((sp, i) => nameAnimal({id:id + "-" + i, sp})), happy:70, cond:100, barrier:"wood"});
      const herd = SPECIES.find(s => traitsOf(s).social === "herd" && !s.predator && !s.viv).id;   // an open-exhibit herd: room matters there
      const dnaKeep = state.science.dna[herd]; state.science.dna[herd] = {genome:100, quality:90};
      state.science.clones = []; state.science.specimens = [];
      const dest = pen("e-sx0", []); state.exhibits = [dest];
      orderClone(herd, dest.id, "female"); orderClone(herd, null, "male"); orderClone(herd);
      const jobs = state.science.clones.slice();
      out.cloneStoresSex = jobs[0].sex === "female" && jobs[1].sex === "male" && (jobs[2].sex === "male" || jobs[2].sex === "female");
      for(const j of jobs.slice(0, 2)) finishClone(j);
      out.cloneHatchKeepsSex = !dest.animals.length && specimens().find(x => x.id === jobs[0].id).sex === "female" && specimens().find(x => x.id === jobs[1].id).sex === "male";
      // old saves: animals everywhere, including holding and clones in the incubator, get a sex
      const old = JSON.parse(JSON.stringify(state)); old.exhibits = [pen("e-sx1", [herd, herd, herd, herd])];
      for(const a of old.exhibits[0].animals) delete a.sex;
      old.science.ready = [{id:"rd", sp:herd, q:90}]; old.crates = []; old.science.clones = [{id:"cl", sp:herd, q:90}];
      const up = upgradeSave(old);
      out.sexMigrated = up.exhibits[0].animals.every(a => a.sex === "male" || a.sex === "female") && up.crates[0].id === "rd" && up.crates[0].sex && up.crates[0].x === null && !("ready" in up.science) && up.science.clones[0].sex;
      let m = 0; for(let i = 0; i < 200; i++) m += pickSex(herd, {exhibits:[{animals:[{sp:herd, sex:"male"}, {sp:herd, sex:"male"}]}], crates:[]}) === "male";
      out.sexBalances = m < 60;
      // social rules: sexes and species social type decide stability, fights and loner stress
      const mk = (id, sp, sexes) => { const p = pen(id, sexes.map(() => sp)); p.animals.forEach((x, i) => x.sex = sexes[i]); return p; };
      const M = "male", F = "female", info = (e, id) => socialInfo(e).get(id);
      const sp = SPECIES_BY_ID[herd];
      const bach = mk("e-sx2", herd, [M, M, M, M]), mat = mk("e-sx3", herd, [F, F, F, F]), one = mk("e-sx4", herd, [M, F, F, F]), two = mk("e-sx5", herd, [M, M, F, F]);
      state.exhibits = [bach, mat, one, two];
      out.ranksAssigned = two.animals.every(a => typeof a.rank === "number" && a.rank >= 0 && a.rank <= 1);
      out.socialBachelor = !info(bach, herd).bad && info(bach, herd).delta === SOCIAL.bachelor && !info(bach, herd).fights;
      out.socialMatriarch = !info(mat, herd).bad && info(mat, herd).delta === SOCIAL.matriarch && !info(mat, herd).fights;
      out.socialOneMale = !info(one, herd).bad && !info(one, herd).fights;
      out.socialTwoMales = info(two, herd).fights && info(two, herd).bad && /fighting/.test(info(two, herd).text) && info(two, herd).delta < 0;
      for(const p of [bach, two]) p.animals.forEach(a => { a.need = freshNeeds(); a.act = "rest"; });
      out.socialBonusInReport = behaviorScore(bach).delta > behaviorScore(two).delta && behaviorScore(two).issues.some(i => /fighting/.test(i.text));
      // more males fight more; less room fights more
      const three = mk("e-sx6", herd, [M, M, M, F]), tight = mk("e-sx7", herd, [M, M, F, F]); tight.points = [[0,0],[8,0],[8,8],[0,8]];
      out.fightsScaleWithMales = info(three, herd).delta < info(two, herd).delta;
      out.fightsScaleWithRoom = info(tight, herd).spaceMult > info(two, herd).spaceMult && info(tight, herd).delta < info(two, herd).delta;
      // a fight hurts the loser, makes dust, and hits the lowest rank harder
      const ds = []; const fxKeep2 = events.fx; events.fx = (k) => ds.push(k);
      const alpha = two.animals.filter(a => a.sex === M).sort(byRank)[0], bottom = two.animals.filter(a => a.sex === M).sort(byRank)[1];
      const reset = () => two.animals.forEach(a => { a.hitAt = undefined; a.sick = null; a.need = freshNeeds(); });
      let hurtN = 0, tries = 0; reset();
      const rk = Math.random; Math.random = () => rk() * .01;   // rolls always succeed
      while(!hurtN && tries++ < 50){ rivalFight(two, info(two, herd), nowAbs()); hurtN = two.animals.filter(a => a.sick && a.sick.kind === "injury").length; }
      Math.random = rk;
      out.fightInjuresAndDusts = hurtN === 1 && ds.includes("dust") && two.animals.some(a => a.sick && a.sick.hit && a.sick.hit.how === "fight");
      events.fx = fxKeep2;
      const lowAnimal = bottom, hiAnimal = alpha;
      const ib = info(two, herd);
      out.rankLosesMore = socialStress(lowAnimal, ib)[0] > socialStress(hiAnimal, ib)[0] && ib.low.get(lowAnimal.id) > ib.low.get(hiAnimal.id);
      // loners: same-sex company is worst, opposite sex is tolerated, alone is best; room and cover ease it
      const loner = SPECIES.find(s => traitsOf(s).social === "solitary" && !s.predator) || SPECIES.find(s => traitsOf(s).social === "solitary"), lid = loner.id;
      const ls = mk("e-sx8", lid, [M, M]), lo = mk("e-sx9", lid, [M, F]), lbig = mk("e-sx10", lid, [M, M]); lbig.points = [[0,0],[400,0],[400,400],[0,400]]; ls.points = [[0,0],[6,0],[6,6],[0,6]];
      state.exhibits = [ls, lo, lbig];
      const iS = info(ls, lid), iO = info(lo, lid), iB = info(lbig, lid);
      out.lonerSameWorse = iS.pen(ls.animals[0]) > iO.pen(lo.animals[0]) && iO.pen(lo.animals[0]) > 0 && iS.delta < iO.delta;
      out.lonerAloneBest = socialInfo(mk("e-sx11", lid, [M])).size === 0 && socialStress(ls.animals[0], null)[0] === 0;
      out.lonerRoomEases = iB.pen(lbig.animals[0]) < iS.pen(ls.animals[0]) && iB.relief > iS.relief;
      const stressOf = (e, c) => stressTarget(e, e.animals[0], loner, c);
      out.lonerStressHigher = stressOf(ls, behaviorCtx(ls)) > stressOf(lo, behaviorCtx(lo));
      // pairs: male and female is ideal, two of a sex is a mild penalty
      const pairSp = SPECIES.find(s => traitsOf(s).social === "pair" && !s.predator) || SPECIES.find(s => traitsOf(s).social === "pair"), pid = pairSp.id;
      const pgood = mk("e-sx12", pid, [M, F]), pbad = mk("e-sx13", pid, [M, M]);
      state.exhibits = [pgood, pbad];
      out.pairIdeal = !info(pgood, pid).bad && info(pgood, pid).delta > 0 && info(pbad, pid).bad && info(pbad, pid).delta < 0 && info(pbad, pid).delta > -SOCIAL.pairMild - .01;
      // vivariums ignore all of it
      const viv = mk("e-sx14", lid, [M, M]); viv.viv = true; state.exhibits = [viv];
      out.vivariumImmune = socialInfo(viv).size === 0 && behaviorScore(viv).issues.every(i => !/^Social/.test(i.text)) && rankPos(viv, viv.animals[0]) === null;
      // packs: family units with an alpha pair, not herds
      {
        const pk = SPECIES.find(s => traitsOf(s).social === "pack" && s.group[0] >= 3), kid = pk.id, min = pk.group[0];
        const pin = (e, id) => socialInfo(e).get(id);
        const full = mk("e-pk1", kid, [M, F, M, F, M]), bach2 = mk("e-pk2", kid, [M, M, M, M]), mat2 = mk("e-pk3", kid, [F, F, F, F]), two2 = mk("e-pk4", kid, [M, M, F, F]);
        state.exhibits = [full, bach2, mat2, two2];
        const ps = [full, bach2, mat2, two2].map(e => pin(e, kid));
        out.packNotHerd = ps.every(i => i.kind === "pack" && !i.fights) && pin(bach2, kid).delta !== SOCIAL.bachelor && pin(mat2, kid).delta !== SOCIAL.matriarch && !/bachelor|fighting/.test(pin(two2, kid).text);
        // alpha pair: a male and a female lead when both sexes are there; a single-sex pack has none
        const o = pin(full, kid).order;
        out.packAlphaPair = pin(full, kid).pair && o[0].sex !== o[1].sex && o[0].rank <= o.slice(2).reduce((m, a) => Math.min(m, a.rank), 1) + 1e-9 && !pin(full, kid).bad
          && !pin(bach2, kid).pair && /No alpha pair/.test(pin(bach2, kid).text) && /No alpha pair/.test(pin(mat2, kid).text);
        out.packRankShown = rankPos(full, o[1]).pack && rankPos(full, o[1]).i === 1 && rankPos(full, o[0]).i === 0;
        // too small: stressed and lonely, one alone is the worst case
        const alone = mk("e-pk5", kid, [M]), few = mk("e-pk6", kid, [M, F]);
        state.exhibits = [full, alone, few];
        const st = (e) => socialStress(e.animals[0], pin(e, kid))[0];
        out.packTooSmall = pin(alone, kid) && /Pack too small/.test(pin(alone, kid).text) && (min === 2 || /Pack too small/.test(pin(few, kid).text)) && st(alone) > st(few) && st(few) >= 0 && st(full) === 0 && pin(alone, kid).delta < pin(few, kid).delta && pin(few, kid).delta <= pin(full, kid).delta;
        for(const e of [alone, full]) e.animals.forEach(a => { a.need = freshNeeds(); a.act = "rest"; });
        const lone0 = needsOf(alone.animals[0]).lonely, lone1 = needsOf(full.animals[0]).lonely;
        const ctxA = behaviorCtx(alone), ctxF = behaviorCtx(full);
        needsStep(alone, alone.animals[0], pk, ctxA, 30); needsStep(full, full.animals[0], pk, ctxF, 30);
        out.packLonely = needsOf(alone.animals[0]).lonely - lone0 > needsOf(full.animals[0]).lonely - lone1 && /Pack too small/.test(behaviorScore(alone).issues.map(i => i.text).join(" "));
        // the alpha pair eats first: a shortage lands on subordinates, and they get hungrier sooner
        const fk = {day:state.day, from:state.staff.feedFrom, stock:full.stock};
        state.staff.feedFrom = 0; full.stock = {};
        const foodKind = Object.keys(dailyNeed(full))[0];
        full.stock[foodKind] = (dailyNeed(full)[foodKind] || 1) * .1; eatTick(1);
        const fd = packFeed.get(full.id);
        out.packEatsFirst = !!fd && fd.sub > fd.top && fd.sub > 0;
        full.animals.forEach(a => { a.need = freshNeeds(); a.act = "rest"; });
        const ctxS = behaviorCtx(full), alphaA = pin(full, kid).order[0], subA = pin(full, kid).order[3];
        needsStep(full, alphaA, pk, ctxS, 30); needsStep(full, subA, pk, ctxS, 30);
        out.packLowRankHungrier = needsOf(subA).hunger > needsOf(alphaA).hunger;
        full.stock = {[foodKind]:(dailyNeed(full)[foodKind] || 1) * 3}; eatTick(1);
        out.packFedNoShortage = !packFeed.has(full.id);
        state.staff.feedFrom = fk.from; full.stock = fk.stock;
        // hunting together: more hunters, better odds; a joint hunt pulls mates in
        full.animals.forEach(a => a.act = "rest");
        const c1 = behaviorCtx(full); full.animals[0].act = "hunt"; const c2 = behaviorCtx(full); full.animals[1].act = "hunt"; full.animals[2].act = "hunt"; const c3 = behaviorCtx(full);
        out.packHuntsTogether = packHuntBoost(full, full.animals[0], c1) === 1 && packHuntBoost(full, full.animals[0], c2) === 1 && packHuntBoost(full, full.animals[0], c3) > 1 && ATTACK.huntChance * packHuntBoost(full, full.animals[0], c3) <= PACK.huntMax + 1e-9;
        full.animals.forEach(a => a.act = "rest");
        // challenges: none without stress, rare with it
        full.animals.forEach(a => { a.need = freshNeeds(); a.hitAt = -1e9; }); const calm = behaviorCtx(full);
        const rk = full.animals.map(a => a.rank), toastKeep = events.toast, fxKeep2 = events.fx; events.toast = () => {}; events.fx = () => {};
        let calmN = 0; for(let i = 0; i < 3000; i++) if(packChallenge(full, pin(full, kid), calm, 1e6 + i * 100)) calmN++;
        out.packCalmNoChallenge = calmN === 0 && full.animals.every((a, i) => a.rank === rk[i]);
        const roomy = {...calm, ratio:.5}; let hotN = 0;
        for(let i = 0; i < 3000; i++){ full.animals.forEach(a => { delete a.sick; a.hitAt = -1e9; }); if(packChallenge(full, pin(full, kid), roomy, 1e6 + i * 100)) hotN++; }
        const noPairN = (() => { let n = 0; for(let i = 0; i < 3000; i++){ bach2.animals.forEach(a => { delete a.sick; a.hitAt = -1e9; }); if(packChallenge(bach2, pin(bach2, kid), calm, 1e6 + i * 100)) n++; } return n; })();
        out.packChallengesRareUnderStress = hotN > 0 && hotN < 3000 * .05 && noPairN > 0 && noPairN < 3000 * .05;
        events.toast = toastKeep; events.fx = fxKeep2;
        // vivariums ignore all of it
        const pv = mk("e-pk7", kid, [M, M, F]); pv.viv = true; state.exhibits = [pv];
        pv.animals.forEach(a => { a.need = freshNeeds(); a.act = "rest"; });
        const pvc = behaviorCtx(pv), pvStress = stressTarget(pv, pv.animals[0], pk, pvc);
        packFeedStep(pv, .8);
        out.packVivariumImmune = socialInfo(pv).size === 0 && rankPos(pv, pv.animals[0]) === null && !packFeed.has(pv.id) && packHuntBoost(pv, pv.animals[0], {hunting:new Map([[kid, 3]])}) === 1
          && behaviorScore(pv).issues.every(i => !/^Social/.test(i.text)) && pvc.hunting.size === 0;
        const pvAlone = mk("e-pk8", kid, [M]); pvAlone.viv = true; state.exhibits = [pvAlone];
        out.packVivariumAloneFine = socialInfo(pvAlone).size === 0;
        // old saves load: nothing new is saved
        const oldP = JSON.parse(JSON.stringify(state)); oldP.exhibits = [mk("e-pk9", kid, [M, F])]; for(const a of oldP.exhibits[0].animals) delete a.rank;
        out.packOldSave = upgradeSave(oldP).exhibits[0].animals.every(a => typeof a.rank === "number");
       
        state.exhibits = [alone]; out.packPanelShows = /Social/.test(behaviorHtml(alone)) && /Pack too small/.test(behaviorHtml(alone));
      }
      // old saves get ranks
      const old2 = JSON.parse(JSON.stringify(state)); old2.exhibits = [mk("e-sx15", herd, [M, F])]; for(const a of old2.exhibits[0].animals) delete a.rank;
      out.rankMigrated = upgradeSave(old2).exhibits[0].animals.every(a => typeof a.rank === "number");
      out.socialPanelShows = (state.exhibits = [two], /Social/.test(behaviorHtml(two)) && /fighting/.test(behaviorHtml(two)));
      state.exhibits = [one, two];
      out.fightBiasMale = fightBias({sp:"dime", sex:"male"}) > 1 && fightBias({sp:"dime", sex:"female"}) === 1;
      out.sexShown = sexSplit(two, herd).includes("2 M, 2 F") && sexMark({sex:"male"}) === "M";
      cloneProblem = cpKeep; if(dnaKeep) state.science.dna[herd] = dnaKeep; else delete state.science.dna[herd]; state.exhibits = exKeep; state.science.specimens = readyKeep; state.science.clones = clonesKeep; events.toast = tKeep; state.money = mKeep;
    }
    localStorage.removeItem("genesis-dev");
    return out;
  }));

  // tapping the entrance in select mode opens the Park Office, same as the menu button
  for(const tl of [true]){
    const pos = await page.evaluate(tl => {
      officeTab = "staff"; select("exhibit", state.exhibits[0] && state.exhibits[0].id);
      document.querySelectorAll("dialog[open]").forEach(d => d.close());
      setTool("select"); view.k = Math.max(view.k, 4); const [gx, gy] = state.gate; view.tx = innerWidth / 2 - gx * view.k; view.ty = innerHeight / 2 - gy * view.k * (tilt ? TILT : 1); render();
      const el = document.querySelector('[data-kind="entrance"]'); if(!el) return null;
      const r = el.querySelector("rect").getBoundingClientRect(); return {x: r.x + r.width / 2, y: r.y + r.height - 3, tilt};
    }, tl);
    let opened = false;
    if(pos){ await page.mouse.click(pos.x, pos.y); await page.waitForTimeout(150); opened = await page.evaluate(() => !sel && officeTab === "office" && !!document.querySelector("#officeName")); }
    checks.entranceTapOpensOffice = opened;
  }
  // the 3/4 toggle is gone; the Park Map dialog opens, draws the park, recenters on a click and closes
  Object.assign(checks, await page.evaluate(() => {
    const out = {}, q = x => document.querySelector(x), d = q("#dlgParkMap");
    document.querySelectorAll("dialog[open]").forEach(x => x.close());
    out.noTiltButton = !q("#ztilt") && tilt === true;
    out.mapButtonThere = !!q("#rtools #mapBtn.tbtn");
    q("#mapBtn").click();
    out.mapOpens = d.open;
    const cv = q("#parkMapCv"), g = cv.getContext("2d"), {b, S} = pmapGeo;
    const px = (x, y) => { const c = g.getImageData(Math.round((x - b.x0) * S), Math.round((y - b.y0) * S), 1, 1).data; return "#" + [...c.slice(0, 3)].map(v => v.toString(16).padStart(2, "0")).join("").toUpperCase(); };
    const data = g.getImageData(0, 0, cv.width, cv.height).data, seen = new Set();
    for(let i = 0; i < data.length; i += 4 * 17) seen.add(data[i] + "," + data[i + 1] + "," + data[i + 2]);
    out.mapNotBlank = cv.width > 100 && seen.size >= 4;
    const p = state.paths.find(p => !isService(p) && !isWide(p) && !isBridge(p) && !isTram(p));
    const exs = state.exhibits; state.exhibits = [{id:"e-pm", name:"PM", points:[[200,205],[240,205],[240,240],[200,240]], animals:[], happy:70, cond:100}]; drawParkMap(cv); const e = state.exhibits[0];
    out.mapShowsPath = !!p && p.points.length > 1 && px((p.points[0][0] + p.points[1][0]) / 2, (p.points[0][1] + p.points[1][1]) / 2).toUpperCase() === PMAP.path.toUpperCase();
    out.mapShowsExhibit = !!e && (() => { const c = centroid(e.points); return px(c[0], c[1]) === BIOMES[biomeOf(e)].color.toUpperCase(); })(); state.exhibits = exs;
    // a click recenters the main camera on that spot and closes it
    const r = cv.getBoundingClientRect(), tx = 150, ty = 100, before = {...view};
    cv.dispatchEvent(new MouseEvent("click", {clientX: r.left + (tx - b.x0) * S * r.width / cv.width, clientY: r.top + (ty - b.y0) * S * r.height / cv.height, bubbles: true}));
    const sz = svgSize(), cx = (sz.w / 2 - view.tx) / view.k, cy = (sz.h / 2 - view.ty) / ky();
    out.mapClickRecenters = !d.open && Math.abs(cx - tx) < 6 && Math.abs(cy - ty) < 6 || (!d.open && (view.tx !== before.tx || view.ty !== before.ty));
    // Esc and M: open with the key, close with the key; the camera stays
    document.dispatchEvent(new KeyboardEvent("keydown", {key:"m", bubbles:true})); out.mapKeyOpens = d.open;
    const v2 = {...view}; document.dispatchEvent(new KeyboardEvent("keydown", {key:"M", bubbles:true})); out.mapKeyCloses = !d.open && view.tx === v2.tx && view.ty === v2.ty && view.k === v2.k;
    q("#mapBtn").click(); q("#closeParkMap").click(); out.mapCloseButton = !d.open;
    return out;
  }));
  // Park Office: brand and Park button open it, every tab renders, renaming updates the HUD, Restart asks first
  Object.assign(checks, await page.evaluate(() => {
    const out = {}, q = x => document.querySelector(x), nm = state.name;
    document.querySelectorAll("dialog[open]").forEach(d => d.close());
    officeTab = "grants"; select("exhibit", state.exhibits[0] && state.exhibits[0].id);
    q("#officeBtn").click(); out.officeBtnOpensOffice = !sel && officeTab === "office" && !!q("#officeName") && q("#aside").classList.contains("open") && !q("#dlgMenu");
    q("#officeBtn").click(); out.officeBtnClosesOffice = !q("#aside").classList.contains("open");
    setSpeed(2); q("#menuBtn").click(); out.menuBtnPausesOnMenu = officeTab === "menu" && speed === 0 && q("#aside").classList.contains("open");
    { // the panel drags by its top bar, resizes from its edges (not below its minimum), and a double-click on the bar puts it back
      openParkOffice(); const A = q("#aside"), r0 = A.getBoundingClientRect(), pe = (t, el, x, y) => el.dispatchEvent(new PointerEvent(t, {bubbles:true, clientX:x, clientY:y, button:0, pointerId:1}));
      const hd = q(".sheet-toggle"), hr = hd.getBoundingClientRect();
      pe("pointerdown", hd, hr.left + 5, hr.top + 5); pe("pointermove", window, hr.left - 95, hr.top + 45); pe("pointerup", window, hr.left - 95, hr.top + 45);
      const r1 = A.getBoundingClientRect(), moved = Math.abs(r1.left - (r0.left - 100)) < 2 && Math.abs(r1.top - (r0.top + 40)) < 2 && Math.abs(r1.width - r0.width) < 2;
      const se = q('[data-rsz="se"]'), sr = se.getBoundingClientRect();
      pe("pointerdown", se, sr.left + 4, sr.top + 4); pe("pointermove", window, sr.left + 64, sr.top + 4 - 1000); pe("pointerup", window, sr.left + 64, sr.top - 996);
      const r2 = A.getBoundingClientRect(), sized = Math.abs(r2.width - (r1.width + 60)) < 2 && Math.abs(r2.height - PANEL_MIN.h) < 2 && Math.abs(r2.left - r1.left) < 2;
      const kept = JSON.parse(localStorage.getItem(PANEL_KEY) || "null");
      q(".sheet-head").dispatchEvent(new MouseEvent("dblclick", {bubbles:true})); const r3 = A.getBoundingClientRect();
      out.panelDragResize = moved && sized && !!kept && Math.round(kept.w) === Math.round(r2.width) && Math.abs(r3.left - r0.left) < 2 && Math.abs(r3.width - r0.width) < 2 && !localStorage.getItem(PANEL_KEY);
    }
    q("#panelClose").click(); out.panelCloseResumes = speed === 2 && !q("#aside").classList.contains("open"); setSpeed(0);
    q('#rtools [data-dept="ghost"]').click(); out.deptBtnNeedsBuilding = hasDept("ghost") ? sel && selItem().type === "ghost" : !sel;
    select(null); openParkOffice();
    out.officeTabsRender = ["office", "money", "science", "guests", "staff", "grants"].every(t => {
      officeTab = t; ui.panel(); return !!q('#panel [data-action="otab2"][aria-selected="true"][data-k="' + t + '"]') && panelEl.textContent.length > 40;
    }) && !!(officeTab = "money", ui.panel(), q("#ticketOut")) && !!(officeTab = "guests", ui.panel(), q("#panel section"));
    officeTab = "office"; ui.panel();
    const inp = q("#officeName"); inp.value = "Renamed <b>Park</b>"; inp.dispatchEvent(new Event("input", {bubbles:true}));
    out.renameUpdatesHud = state.name === "Renamed <b>Park</b>" && q("#officeTitle").textContent === state.name && !q("#officeTitle b");
    inp.value = "x".repeat(60); inp.dispatchEvent(new Event("input", {bubbles:true})); out.renameCapped = state.name.length === 40;
    state.name = nm; ui.hud(true);
    officeTab = "office"; ui.panel(); q('[data-action="otab2"][data-k="menu"]').click();
    out.mainMenuHasButtons = !!q('#panel [data-action="restart"]') && !!q('#panel [data-action="howTo"]') && !!q("#sandboxToggle");
    q('#panel [data-action="restart"]').click();
    out.restartAsks = q("#dlgConfirm").open && /Restart/.test(q("#confirmYes").textContent) && !q("#dlgStart").open;
    q("#confirmNo").click(); out.restartCancelKeeps = !q("#dlgConfirm").open && !q("#dlgStart").open && state.name === nm;
    // work zones live in the Staff tab, not the supplies overview; their buttons work from there
    officeTab = "staff"; ui.panel();
    out.zonesInStaffTab = !!q("#panel #zonesSection") && !!q('#panel [data-action="zoneTool"]') && !!q('#panel [data-action="supplyToggle"]');
    q('#panel [data-action="zoneTool"]').click(); out.staffZoneToolWorks = tool === "zone"; setTool("select");
    officeTab = "money"; ui.panel();
    out.noZonesInSupplies = !/Work zones/.test(q("#panel").textContent) && !q('#panel [data-action="zoneTool"]');
    out.zoneToolInStaffMenu = BUILD_MENU.find(g => g.id === "staff").items.some(i => i.tool === "zone") && !BUILD_MENU.find(g => g.id === "mgmt").items.some(i => i.tool === "zone");
    officeTab = "office"; ui.panel();
    return out;
  }));
  // the DNA + leaf campus emblem is gone: no helper, no theme field, no emblem circle in the entrance or a science roof (both views)
  checks.noEmblem = await page.evaluate(() => {
    render();
    const els = [...document.querySelectorAll('[data-kind="entrance"], [data-kind="building"]')];
    return typeof emblemSvg === "undefined" && typeof emblemOn === "undefined" && !Object.values(THEMES).some(T => "emblem" in T) && els.every(el => !el.querySelector('circle[r="1.08"]'));
  });

  // tapping an animal: the target is the visible sprite, not just its ground spot
  checks.animalTapOnSprite = await page.evaluate(() => {
    const keep = new Map(herd), t0 = tilt, k0 = view.k; let ok = true;
    const mk = (id, sp, spr, x, y, r) => ({id, sp, placed:true, spr, viv:false, r, x, y, exhibitId:"none", face:1});
    const exh = state.exhibits.find(e => e.animals.length), a = exh && exh.animals[0];
    if(!a) return true;
    for(const k of [1.5, 5, 14]){
      view.k = k; herd.clear();
      const [gx, gy] = state.gate;
      for(const [sp, spr] of [["dime", true], ["mega", false], ["coel", true]]){
        const h = mk(a.id, sp, spr, gx, gy - 20, sp === "mega" ? 1.2 : Math.max(animalRadius("dime"), 4 / k)); herd.clear(); herd.set(a.id, h);
        view.tx = innerWidth / 2 - gx * k; view.ty = innerHeight / 2 - (gy - 20) * k * (tilt ? TILT : 1);
        const b = animalBox(h), r = svg.getBoundingClientRect(), sx = r.left + view.tx + h.x * k, sy = r.top + view.ty + h.y * ky() + b.oy * k;
        const rx = Math.max(12, b.hw * k), ry = Math.max(12, b.hh * k);
        const hit = (dx, dy) => { const g = animalAt(sx + dx, sy + dy); return !!g && g.id === a.id; };
        ok = ok && hit(0, 0) && hit(rx * .8, 0) && hit(-rx * .8, 0) && hit(0, -ry * .8) && !hit(rx * 1.6, 0);
        // a bigger sprite's box is bigger than the old 12px reach
        if(spr && b.hw * k > 40) ok = ok && hit(b.hw * k * .8, 0);
      }
    }
    herd.clear(); for(const [id, h] of keep) herd.set(id, h);
    view.k = k0; render();
    return ok;
  });

  // Animals tab: alphabetical list, click opens the animal, Sell removes just that one and pays resale
  const at = await page.evaluate(() => {
    let money0;
    document.querySelectorAll("dialog[open]").forEach(d => d.close());
    const e = {id:"e-animtab", name:"Tab test", viv:"L", points:rectPts(400, 400, 16, 10, 0), animals:[], happy:70};
    for(let i = 0; i < 4; i++) e.animals.push({id:"a-tab" + i, sp:"arth"});
    state.exhibits.push(e); money0 = state.money; state.money = 1e6;
    e.animals.forEach((a, i) => a.name = ["zed", "Bob", "alice", "Carl"][i % 4] + i);
    select("exhibit", e.id); exTabs.tab = "animals"; ui.panel();
    const names = [...panelEl.querySelectorAll(".animal-row b:first-child")].map(x => x.textContent);
    const sorted = [...e.animals].map(a => a.name).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    const listed = names.length === e.animals.length && names.join() === sorted.join();
    const target = e.animals.find(a => a.name === sorted[0]);
    panelEl.querySelector(`.animal-row[data-id="${target.id}"]`).click();
    const opened = sel && sel.kind === "animal" && sel.id === target.id;
    const back = panelEl.querySelector(".back"); back.click();
    const backOk = sel && sel.kind === "exhibit" && sel.id === e.id && exTabs.tab === "animals";
    // each row has its own Move: it queues just that animal and turns into a disabled Moving
    const other = e.animals.find(a => a !== target), tr0 = state.staff.transfers.length;
    const made = requestMove(e, other.sp, e, 5, other.id); ui.panel();
    const mb = id => panelEl.querySelector(`.animal-row[data-id="${id}"] [data-action="moveDlg"]`);
    const moveOne = made === 1 && state.staff.transfers.length === tr0 + 1 && state.staff.transfers.at(-1).animalId === other.id && mb(other.id).disabled && mb(other.id).textContent === "Moving" && !mb(target.id).disabled && !panelEl.textContent.includes("Species");
    state.staff.transfers = state.staff.transfers.filter(t => t.animalId !== other.id);
    panelEl.querySelector(`.animal-row[data-id="${target.id}"]`).click();
    const n0 = e.animals.length, m0 = state.money = 1e6, pay = sellValue(target);
    state.staff.transfers.push({id:"tr-smoke", animalId:target.id, sp:target.sp, from:e.id, to:e.id});
    sellAnimal(target.id);
    const sold = e.animals.length === n0 - 1 && !e.animals.some(a => a.id === target.id) && !herd.has(target.id) && state.money - m0 === pay && !state.staff.transfers.some(t => t.animalId === target.id) && !sel;
    exTabs.tab = "main"; select(null); state.exhibits.splice(state.exhibits.indexOf(e), 1); state.money = money0; recompute();
    return {listed, opened, sold, backOk, moveOne};
  });
  if(at){ checks.animalsTabMoveOne = at.moveOne; checks.animalsTabSorted = at.listed; checks.animalsTabRowOpensPanel = at.opened; checks.animalsTabSellRemovesOne = at.sold; checks.animalBackGoesToExhibit = at.backOk; }

  // focus mode: H hides the tool columns and the panel, H again brings them back
  const fm = await page.evaluate(() => {
    document.querySelectorAll("dialog[open]").forEach(d => d.close());
    const vis = id => document.querySelector(id).getClientRects().length > 0;
    document.activeElement?.blur?.(); openParkOffice(); const both0 = vis("#sideMenu") && vis("#aside") && vis("#rtools");
    document.dispatchEvent(new KeyboardEvent("keydown", {key:"h"}));
    const hidden = !vis("#sideMenu") && !vis("#aside") && !vis("#rtools") && localStorage.getItem("genesis-focus") === "1";
    document.dispatchEvent(new KeyboardEvent("keydown", {key:"h"}));
    const back = vis("#sideMenu") && vis("#aside") && vis("#rtools") && localStorage.getItem("genesis-focus") === "0";
    closePanel();
    return {both0, hidden, back};
  });
  checks.focusModeStartsShown = fm.both0;
  checks.focusModeHides = fm.hidden;
  checks.focusModeRestores = fm.back;

  const cal = await page.evaluate(() => {
    const f = fmtDate, dpm = CALENDAR.daysPerMonth, mpy = CALENDAR.months.length, yr = dpm * mpy;
    const old = JSON.parse(JSON.stringify(state)); delete old.calendar;
    let loads = true; try{ upgradeSave(old); }catch{ loads = false; }
    return {first:f(1), eom:f(dpm), next:f(dpm + 1), eoy:f(yr), ny:f(yr + 1), y3:f(yr * 2 + 1), zero:f(0), loads, hud:document.querySelector("#dayLabel").textContent.startsWith(fmtDate(state.day))};
  });
  checks.dateFirstDay = cal.first === "1 Jan Y1";
  checks.dateMonthRollover = cal.eom === "30 Jan Y1" && cal.next === "1 Feb Y1";
  checks.dateYearRollover = cal.eoy === "30 Dec Y1" && cal.ny === "1 Jan Y2" && cal.y3 === "1 Jan Y3";
  checks.dateBadDay = cal.zero === "1 Jan Y1";
  checks.dateOldSaveLoads = cal.loads;
  checks.dateInHud = cal.hud;

  // S12: every science job finishes exactly when its `end` passes, however long the step, across closing, and across a reload
  const sci = await page.evaluate(() => {
    const out = {}, H = Math.PI / 2;
    const had = {money:state.money, day:state.day, minute:state.minute, over:state.over, sandbox:state.sandbox};
    state.buildings = state.buildings.filter(b => !["oracle", "ghost", "tar", "ceres"].includes(b.type));
    state.buildings.push({id:"s12-or", type:"oracle", points:rectPts(230, 262, 24, 16, H)}, {id:"s12-gh", type:"ghost", points:rectPts(180, 262, 28, 20, H)}, {id:"s12-ta", type:"tar", points:rectPts(230, 290, 26, 18, H)}, {id:"s12-ce", type:"ceres", points:rectPts(180, 290, 26, 18, H)});
    state.paths.push({id:"s12-p0", name:"s", points:[[state.gate[0],state.gate[1]],[207.5,290],[207.5,262]]}, {id:"s12-p1", name:"s", points:[[207.5,262],[222,262]]}, {id:"s12-p2", name:"s", points:[[207.5,262],[193,262]]}, {id:"s12-p3", name:"s", points:[[207.5,290],[217,290]]}, {id:"s12-p4", name:"s", points:[[207.5,290],[193,290]]});
    recompute(); buildKeeperGraph(); state.sandbox = false; state.over = false; state.money = 1e9;
    const sc = () => state.science;
    for(const k of ["paleo", "gene", "botanist"]) while(sc().crew[k] < 2) hireScientist(k);
    const sp = SPECIES.find(s => !s.viv && !s.pool); sc().dna[sp.id] = {genome:100, quality:80}; if(!isUnlocked(sp.id)) sc().unlocked.push(sp.id); state.rating = 5;
    // an expedition goes after another animal, seen at its site
    const tsp = SPECIES.find(s => s.id !== sp.id && speciesAvailable(s.id) && sitesOf(s.id).length), tsite = sitesOf(tsp.id).find(siteShown);
    sc().seen[tsite.id] = [tsp.id]; if(!isUnlocked(tsp.id)) sc().unlocked.push(tsp.id);
    // log the park minute each job actually finishes
    const seen = {}, real = {fp:finishProject, tr:tripReturns, fc:finishClone, fb:finishBatch};
    finishProject = p => { seen.proj = nowMin(); real.fp(p); }; tripReturns = t => { seen.trip = nowMin(); real.tr(t); };
    finishClone = c => { seen.clone = nowMin(); real.fc(c); }; finishBatch = b => { seen.bed = nowMin(); real.fb(b); };
    const era = Object.keys(CERES_GROW.medicine)[0];
    const run = (startDay, startMinute, dts, reload) => {
      const s = sc(); s.projects = []; s.trips = []; s.clones = []; state.ceres.beds = []; s.specimens = [];
      for(const k of Object.keys(seen)) delete seen[k];
      state.day = startDay; state.minute = startMinute; s.points = 1e6; s.tech = s.tech.filter(t => t !== "moat"); s.tech.push("medpaleo");
      state.rating = 5; startProject("tech", "moat"); delete s.dna[tsp.id]; sendDrone("dig", tsite.id, tsp.id); orderClone(sp.id, null); growBatch("med", era);
      const jobs = {proj:sc().projects[0], trip:sc().trips[0], clone:sc().clones[0], bed:state.ceres.beds[0]};
      if(Object.values(jobs).some(j => !j)) return null;
      const ends = Object.fromEntries(Object.entries(jobs).map(([k, j]) => [k, j.end]));
      const last = Math.max(...Object.values(ends)), t0 = nowMin();
      let i = 0, reloaded = false;
      while(nowMin() < last + 5 && i++ < 100000){
        tick(dts[i % dts.length]);
        if(reload && !reloaded && nowMin() - t0 > 100){ reloaded = true; state = upgradeSave(JSON.parse(JSON.stringify(state))); recompute(); buildKeeperGraph(); }
      }
      return Math.max(...Object.keys(ends).map(k => k in seen ? Math.abs(seen[k] - ends[k]) : 1e9));
    };
    let ok = true, why = "";
    for(const [label, startMinute, dts, reload] of [["morning 1m", DAWN_MIN + 5, [1], false], ["morning 4.8m (4x)", DAWN_MIN + 5, [4.8], false], ["before rollover, 7m", DAY_MIN - 100, [7], false], ["3 minutes before rollover, 100m", DAY_MIN - 3, [100], false], ["a day at once", DAWN_MIN + 200, [720, 1500], false], ["uneven steps", DAWN_MIN + 301, [0.3, 11, 2.2, 58], false], ["reload mid-job", DAY_MIN - 50, [3.3], true]]){
      const d = run(4, startMinute, dts, reload);
      if(d === null || d > 1e-3){ ok = false; why += ` ${label}:${d}`; }
    }
    out.scienceFinishesAtEnd = ok; out.why = why;
    // the end of a step at closing carries into the next morning
    state.day = 9; state.minute = DAY_MIN - 3; sc().projects = []; sc().trips = []; sc().clones = []; state.ceres.beds = [];
    tick(10);
    out.closingKeepsOvershoot = state.day === 10 && Math.abs(state.minute - 7) < 1e-6;
    // general research earns the same points whatever the step
    const rate = dt => { const s = sc(); s.projects = []; state.day = 12; state.minute = DAWN_MIN + 10; const p0 = s.points; for(let m = 0; m < 240; m += dt) tick(dt); return s.points - p0; };
    const a = rate(1), b = rate(8), c = rate(240);
    out.pointsIgnoreStepSize = Math.abs(a - b) < 1e-6 && Math.abs(a - c) < 1e-6 && a > 0;
    // a clone waits (its clock held) while the Genetics Lab has no geneticist, then finishes on schedule after one is hired
    sc().projects = []; state.ceres.beds = []; sc().trips = []; sc().clones = []; state.day = 14; state.minute = DAWN_MIN + 20;
    state.rating = 5; const why0 = cloneProblem(sp.id); orderClone(sp.id, null); if(!sc().clones[0]) return {why:"clone: " + why0 + " crew " + JSON.stringify(sc().crew) + " tar " + !!dept("tar")}; const cl = sc().clones[0], len = cl.end - cl.start, g = sc().crew.gene; sc().crew.gene = 0;
    for(const k of Object.keys(seen)) delete seen[k];
    tick(300); const held = sc().clones.length === 1 && Math.abs(cl.end - cl.start - len) < 1e-6;
    sc().crew.gene = g; const e2 = cl.end; tick(len + 10);
    out.cloneWaitsThenFinishes = held && Math.abs(seen.clone - e2) < 1e-3;
    finishProject = real.fp; tripReturns = real.tr; finishClone = real.fc; finishBatch = real.fb;
    state.money = had.money; state.over = had.over; state.sandbox = had.sandbox;
    return out;
  });
  if(sci.why) console.log("S12 late jobs:" + sci.why);
  checks.scienceFinishesAtEnd = sci.scienceFinishesAtEnd;
  checks.closingKeepsOvershoot = sci.closingKeepsOvershoot;
  checks.pointsIgnoreStepSize = sci.pointsIgnoreStepSize;
  checks.cloneWaitsThenFinishes = sci.cloneWaitsThenFinishes;

  // S13: the clock runs round the clock; a trickle of guests keeps coming; Close park empties the park; the day turns over once, at 6 AM
  const clk = await page.evaluate(() => {
    const out = {}, keep = {day:state.day, minute:state.minute, rating:state.rating, money:state.money, over:state.over, sandbox:state.sandbox, closed:state.parkClosed};
    state.over = false; state.sandbox = false; state.money = 1e7; state.rating = 5; state.parkClosed = false; resetParties();
    // the clock passes 9 PM without a rollover
    state.day = 30; state.minute = minuteAtClock(20 * 60 + 50); tick(10);
    out.clockPastEight = state.day === 30 && clockMin() > 21 * 60 && clockMin() < 21 * 60 + 30 && fmtClock(clockMin()) === "9:04 PM";
    out.clockMapsBack = Math.abs(minuteAtClock(clockMin(123)) - 123) < 1e-9 && clockMin(0) === ROLLOVER_CLOCK && DAY_MIN * CLOCK_SCALE === 17 * 60;
    // guests still arrive at night, a few staying on
    resetParties(); state.day = 31; state.minute = minuteAtClock(21 * 60); nextSize = 1; const trk = GUEST.trickle; GUEST.trickle = 60;   // the evening is short now, so a fatter trickle
    const g0 = state.today.guests, t0 = state.today.tickets;
    for(let i = 0; i < 80; i++) tick(1);
    out.guestsArriveAtNight = state.today.guests > g0 && state.today.tickets > t0 && state.day === 31;
    out.someStayOvernight = guestCount() > 0 && isNight(); GUEST.trickle = trk;
    out.trickleScalesWithRating = (r => { const a = (state.rating = 0, trickleRate()), b = (state.rating = 5, trickleRate()); return a > 0 && b > a && Math.abs(b - GUEST.trickle) < 1e-9; })();
    // Closed: no new guests, no tickets, the park empties, bills still come, the HUD says so
    state.parkClosed = true; state.today = freshLedger(); ui.hud(true);
    out.hudSaysClosed = !document.querySelector("#closedTag").hidden;
    const gc = state.today.guests, tk = state.today.tickets; state.minute = 5; state.day = 32;
    const hist0 = state.history.length, m0 = state.money; let emptied = false;
    for(let i = 0; i < 900 && !emptied; i++){ tick(1); emptied = !parties.length; }
    out.closedStopsArrivals = state.today.guests === gc || state.day > 32;
    out.closedNoTickets = state.today.tickets === tk || state.day > 32;
    out.closedEmptiesPark = emptied && guestCount() === 0;
    for(let i = 0; i < DAY_MIN; i++) tick(1);
    out.closedStillArrivesNobody = parties.length === 0 && state.history.length > hist0 && state.history[state.history.length - 1].guests === 0 && state.history[state.history.length - 1].costs > 0 && state.money < m0;
    state.parkClosed = false; ui.hud(true);
    out.hudOpenAgain = document.querySelector("#closedTag").hidden;
    state.minute = minuteAtClock(21 * 60); nextSize = 1; GUEST.trickle = 60; for(let i = 0; i < 80; i++) tick(1); GUEST.trickle = trk;
    out.openAgainArrives = parties.length > 0;
    // the day turns over exactly once a day, at the rollover hour
    resetParties(); let n = 0, at = []; const de = events.dayEnded; events.dayEnded = r => { n++; at.push(clockMin()); de && de(r); };
    state.day = 40; state.minute = 0; const wx0 = JSON.stringify(state.weather);
    for(let i = 0; i < 2 * DAY_MIN; i++) tick(1);
    events.dayEnded = de;
    out.rolloverOncePerDay = n === 2 && state.day === 42 && at.every(c => Math.abs(c - ROLLOVER_CLOCK) <= 2) && state.minute === 0;
    // night looks and animal schedules
    out.nightWash = nightDark(12 * 60) === 0 && nightDark(22 * 60) === NIGHT.dark && nightDark(6 * 60) === 0 && nightDark(20 * 60) > 0 && nightDark(20 * 60) < NIGHT.dark;
    out.nocturnalAtNight = awake(SPECIES_BY_ID.ornw, minuteAtClock(22 * 60)) === 1 && awake(SPECIES_BY_ID.ornw, minuteAtClock(13 * 60)) <= .2 && awake(SPECIES_BY_ID.plat, minuteAtClock(22 * 60)) < .5 && awake(SPECIES_BY_ID.plat, minuteAtClock(13 * 60)) >= .55;
    // old saves: the minute shifts so science stamps stay exact, and the park starts open
    const oldS = JSON.parse(JSON.stringify(state)); delete oldS.clockV; delete oldS.parkClosed; oldS.day = 3; oldS.minute = 540;
    const nowOld = (oldS.day - 1) * 720 + (oldS.minute - 480), up = upgradeSave(oldS);
    out.oldSaveClock = up.clockV === 3 && up.parkClosed === false && up.minute === 60 && (up.day - 1) * DAY_MIN + up.minute === nowOld;
    const wrapped = JSON.parse(JSON.stringify(state)); delete wrapped.clockV; wrapped.minute = 1199.5; out.oldSaveEdge = upgradeSave(wrapped).minute < DAY_MIN;
    const cur = upgradeSave(JSON.parse(JSON.stringify(state))); out.newSaveKeepsMinute = cur.minute === state.minute && cur.parkClosed === false;
    Object.assign(state, {day:keep.day, minute:keep.minute, rating:keep.rating, money:keep.money, over:keep.over, sandbox:keep.sandbox, parkClosed:keep.closed}); resetParties(); recompute();
    return out;
  });
  for(const [k, v] of Object.entries(clk)) checks[k] = v;

  // path objects: rotation is stored on the item, old saves load, and every type draws at every turn
  const props = await page.evaluate(() => {
    const out = {}, names = ["bin", "bench", "picnic", "lamp", "camera", "donate", "sign", "nofeed", "quiet"];
    out.propsDrawAtEveryTurn = names.every(ty => { const t = BUILDINGS[ty]; return [0, 2, 4, 6].every(r => { const bl = {id:"pp-" + ty + r, type:ty, points:rectPts(150, 150, t.w, t.d, r * Math.PI / 4)}; const a = propArt(bl, .1, false, false); return (PROP_PICS[ty] ? /<image href="[^"]+"/.test(a) : a.length > 200 && (a.match(/<polygon/g) || []).length > 3) && !/NaN/.test(a); }); });
    // older saves: a prop left on a 45° turn squares up to the nearest of north, south, east or west, about its middle, and its turn count goes even
    { const sv = JSON.parse(JSON.stringify(state)), c0 = [150.3, 150.7]; sv.buildings = [{id:"pdg", type:"bench", rot:1, day:0, points:rectPts(c0[0], c0[1], BUILDINGS.bench.w, BUILDINGS.bench.d, Math.PI / 4)}];
      upgradeSave(sv); const b = sv.buildings[0], f = propFront(b), c = centroid(b.points);
      out.propDiagonalSquares = (Math.abs(Math.abs(f[0]) - 1) < 1e-6 || Math.abs(Math.abs(f[1]) - 1) < 1e-6) && Math.hypot(c[0] - c0[0], c[1] - c0[1]) < 1e-6 && b.rot % 2 === 0; }
    // the Genesis bin and bench are pictures, picked by where the front looks
    { const want = ["front", "left", "back", "right"], drawn = (bl, p) => propArt(bl, .1, false, false).includes(`href="${spriteUrl(p)}"`);
      out.binSpriteByFacing = want.every((v, r) => drawn({id:"pb", type:"bin", points:rectPts(150, 150, 1.6, 1.6, r * Math.PI / 2)}, `sprites/bld/bin-${v}.png`))
        && drawn({id:"pb", type:"bin", fill:LITTER.binCap, points:rectPts(150, 150, 1.6, 1.6, 0)}, "sprites/bld/bin-front-full.png")
        && drawn({id:"pb", type:"bin", cond:0, points:rectPts(150, 150, 1.6, 1.6, 0)}, "sprites/bld/bin-front-broken.png");
      out.benchSpriteByFacing = want.every((v, r) => drawn({id:"pc", type:"bench", points:rectPts(150, 150, 3, 1.4, r * Math.PI / 2)}, `sprites/bld/bench-${v}.png`))
        && drawn({id:"pc", type:"bench", cond:0, points:rectPts(150, 150, 3, 1.4, Math.PI)}, "sprites/bld/bench-back-broken.png"); }
    // Genesis buildings drawn as pictures: the restroom turns, the food cart turns too, its two frames shown one at a time
    { const b34 = (ty, r) => building34({id:"pk", type:ty, points:rectPts(150, 150, BUILDINGS[ty].w, BUILDINGS[ty].d, r * Math.PI / 2)}, BUILDINGS[ty], false, false, true, .1);
      out.restroomSpriteByFacing = ["front", "left", "back", "right"].some(v => b34("restroom", 0).includes(spriteUrl(`sprites/bld/restroom-${v}.png`)));
      const kv = [0, 1, 2, 3].map(f => building34({id:"pk", type:"kiosk", face:f, points:rectPts(150, 150, BUILDINGS.kiosk.w, BUILDINGS.kiosk.d, 0)}, BUILDINGS.kiosk, false, false, true, .1)), has = v => kv.some(a => a.includes(spriteUrl(`sprites/bld/kiosk-${v}.png`)) && a.includes(spriteUrl(`sprites/bld/kiosk-${v}-2.png`)));
      // an old 5 x 4 m food cart is resized to the current footprint, its door wall staying put
      { const sv = JSON.parse(JSON.stringify(state)), old = rectPts(150, 150, 4, 5, 0); sv.buildings = [{id:"pko", type:"kiosk", face:1, day:0, points:old}];
        upgradeSave(sv); const P = sv.buildings[0].points, b = bbox(P), b0 = bbox(old);
        out.oldKioskShrinks = Math.abs(b.x1 - b0.x1) < 1e-6 && Math.abs((b.x1 - b.x0) - BUILDINGS.kiosk.d) < 1e-6 && Math.abs((b.y1 - b.y0) - BUILDINGS.kiosk.w) < 1e-6 && Math.abs((b.y0 + b.y1) - (b0.y0 + b0.y1)) < 1e-6
          && JSON.stringify(upgradeSave(JSON.parse(JSON.stringify(sv))).buildings[0].points) === JSON.stringify(P);
        // one placed at the new size 0.3 m back from the grid slides onto it
        const sv2 = JSON.parse(JSON.stringify(state)); sv2.buildings = [{id:"pko2", type:"kiosk", face:2, day:0, points:rectPts(150, 152.9 - BUILDINGS.kiosk.d / 2, BUILDINGS.kiosk.w, BUILDINGS.kiosk.d, 0)}];
        upgradeSave(sv2); out.oldKioskShrinks = out.oldKioskShrinks && Math.abs(bbox(sv2.buildings[0].points).y1 - 153) < 1e-6; }
      // every view stands on the box's south edge (the back one backOver higher, to meet the path it backs onto), with a tappable box over the picture
      { const at = f => { const a = kv[f], m = a.match(/<image href="[^"]*" x="[^"]+" y="([^"]+)" width="[^"]+" height="([^"]+)"/), r = /<rect [^>]*fill="transparent"/.test(a); return m && r ? +m[1] + +m[2] : NaN; }, P = rectPts(150, 150, BUILDINGS.kiosk.w, BUILDINGS.kiosk.d, 0), px = FLAT34.px;
        out.kioskOnBaseLine = Math.abs(at(2) - (bbox(P).y1 + 4 * px / TILT)) < .2 && Math.abs(at(0) - (bbox(P).y1 + 4 * px / TILT - BLD_PICS.kiosk.backOver)) < .2; }
      out.kioskSpriteAnimates = ["front", "back", "left", "right"].every(has) && kv.every(a => /visibility:visible;animation:frame1of2 /.test(a) && /visibility:hidden;animation:frame2of2 /.test(a) && !/opacity/.test(a) && !/NaN/.test(a)); }
    // the front turns: the front vector follows the angle, and the picture changes with it
    const mk = r => ({id:"pf", type:"bench", points:rectPts(150, 150, 3, 1.4, r * Math.PI / 4)});
    out.propFrontTurns = [0, 1, 2, 3].every(r => { const f = propFront(mk(r)), a = r * Math.PI / 4; return Math.abs(f[0] + Math.sin(a)) < 1e-6 && Math.abs(f[1] - Math.cos(a)) < 1e-6; }) && propArt(mk(0), .1, false, false) !== propArt(mk(2), .1, false, false) && propArt(mk(0), .1, false, false) !== propArt(mk(4), .1, false, false);
    // a pictured prop with no back picture (the lamp) shows its front both ways
    out.propFrontsDiffer = names.filter(ty => !PROP_PICS[ty] || SPRITE_PACK[`sprites/bld/${ty}-back.png`]).every(ty => { const t = BUILDINGS[ty], at = r => propArt({id:"pd", type:ty, points:rectPts(150, 150, t.w, t.d, r * Math.PI / 4)}, .1, false, false); return at(0) !== at(4); });
    // placing with a rotation stores it
    state.sandbox = true; state.over = false; state.money = 1e7;
    let placed = null;
    for(let y = 40; y < 700 && !placed; y += 12){
      const pk = []; for(let cx = 20; cx < 23; cx++) for(let cy = Math.floor(y / 5); cy < Math.floor(y / 5) + 3; cy++){ const k = chunkKey(cx, cy); if(!state.pathChunks[k]){ state.pathChunks[k] = "g"; pk.push(k); } }
      pathVer++; recompute();
      setTool("bench"); for(let i = 0; i < 3; i++) rotateTool();
      const r = svg.getBoundingClientRect(), px = (x, yy) => [r.left + view.tx + x * view.k, r.top + view.ty + yy * ky()];
      placeGhost(...px(110, y + 1));
      if(ghost && ghost.ok){ placeBuilding({clientX:px(110, y + 1)[0], clientY:px(110, y + 1)[1]}); placed = state.buildings[state.buildings.length - 1]; }
      else { for(const k of pk) delete state.pathChunks[k]; pathVer++; }
    }
    out.placingStoresRotation = !!placed && placed.type === "bench" && placed.rot === 6 && rot === 6;   // three quarter turns, counted in 45° steps
    if(placed){ const old = JSON.parse(JSON.stringify(placed)); delete old.rot; const snap = JSON.parse(JSON.stringify(state)); snap.buildings = snap.buildings.map(b => b.id === old.id ? old : b); upgradeSave(snap);
      out.oldSaveGetsRot = snap.buildings.find(b => b.id === old.id).rot === 0; }
    setTool("select"); render();
    out.propsRenderInGame = !!document.querySelector(`#map [data-id="${placed && placed.id}"]`) || !!document.querySelector(`[data-id="${placed && placed.id}"]`);
    return out;
  });
  Object.assign(checks, props);

  // viewing platforms: flat pixel deck, front over the exhibit, entry on the path side, at every fence-side direction
  const decks = await page.evaluate(() => {
    const out = {};
    const t = BUILDINGS.platform, sq = (x, y, r) => [[x - r, y - r], [x + r, y - r], [x + r, y + r], [x - r, y + r]];
    const dirs = [0, 1, 2, 3, 4, 5, 6, 7], arts = [], fronts = [];
    let allOk = true;
    for(const k of dirs){   // a deck on the side of a big exhibit at 8 angles (diagonals too): edge from a to b, the exhibit on the +normal side
      const ang = k * Math.PI / 4, ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux, cx = 300, cy = 300;
      const ex = {id:"ex-d" + k, points:[[cx - ux*20, cy - uy*20], [cx + ux*20, cy + uy*20], [cx + ux*20 + nx*30, cy + uy*20 + ny*30], [cx - ux*20 + nx*30, cy - uy*20 + ny*30]], barrier:"bars"};
      state.exhibits.push(ex);
      const off = t.d/2 - 1.5, bl = {id:"pd" + k, type:"platform", exhibitId:ex.id, points:rectPts(cx + nx*off, cy + ny*off, t.w, t.d, ang), inward:true};
      const fr = deckFrame(bl), a = deckArt(bl, .1, false, false, true);
      fronts.push(fr.v[0]*nx + fr.v[1]*ny);
      arts.push(a);
      allOk = allOk && a.length > 1500 && (a.match(/<polygon/g) || []).length > 40 && !/NaN/.test(a) && Math.abs(fr.u[0]*fr.v[1] - fr.u[1]*fr.v[0] - 1) < 1e-6;
      state.exhibits.pop();
    }
    out.platformRendersAllDirections = allOk;
    out.platformFrontFacesAnimals = fronts.every(f => f > .99);   // the front points into the exhibit at every angle
    out.platformTurnsWithSide = new Set(arts).size === arts.length;
    // flip the exhibit to the other side of the fence: the front flips with it
    const ex = {id:"ex-flip", points:sq(300, 300, 20), barrier:"wood"}; state.exhibits.push(ex);
    const north = {id:"pn", type:"platform", exhibitId:ex.id, points:rectPts(300, 280 + 2, t.w, t.d, 0), inward:true};   // fence side y=280, exhibit south of it
    const south = {id:"ps", type:"platform", exhibitId:ex.id, points:rectPts(300, 320 - 2, t.w, t.d, 0), inward:true};   // fence side y=320, exhibit north of it
    out.platformFrontFlips = deckFrame(north).v[1] > .99 && deckFrame(south).v[1] < -.99;
    state.exhibits.pop();
    // in the game: renders in the map, old saves (no inward flag, no rot) load and draw
    const e0 = state.exhibits.find(x => !x.viv);
    let loads = true;
    if(e0){
      const [cx, cy] = centroid(e0.points), old = {id:"b-oldplat", type:"platform", exhibitId:e0.id, points:rectPts(cx, cy, t.w, t.d, 0), day:1};
      const snap = JSON.parse(JSON.stringify(state)); snap.buildings.push(old); upgradeSave(snap);
      const got = snap.buildings.find(b => b.id === "b-oldplat");
      loads = !!got && got.inward === true && deckArt(got, .1, false, false, true).length > 1500;
      state.buildings.push(JSON.parse(JSON.stringify(got))); render();
      out.platformRendersInGame = !!document.querySelector(`#map [data-id="b-oldplat"]`) && /VIEW|polygon/.test(document.querySelector(`#map [data-id="b-oldplat"]`).innerHTML);
      state.buildings = state.buildings.filter(b => b.id !== "b-oldplat");
    } else out.platformRendersInGame = true;
    out.oldSavePlatformLoads = loads;
    // the path surface is masked out under a deck's footprint
    if(e0){ const [cx, cy] = centroid(e0.points); state.buildings.push({id:"b-maskplat", type:"platform", exhibitId:e0.id, points:rectPts(cx, cy, t.w, t.d, 0), inward:true}); render();
      out.platformCutsPathTexture = !document.querySelector(`#map polygon[fill="#CBC5B4"][points="${polyStr(state.buildings[state.buildings.length - 1].points)}"]`) && !!document.querySelector("#deckcut polygon") && !!document.querySelector('[mask="url(#deckcut)"]'); state.buildings = state.buildings.filter(b => b.id !== "b-maskplat"); render(); }
    else out.platformCutsPathTexture = true;
    render();
    return out;
  });
  Object.assign(checks, decks);

  // Genome quality is completeness: The Genetics Lab clones from 60%, and the closer to 100% the healthier the clone
  const gq = await page.evaluate(() => {
    const out = {}, sc = state.science, keep = {dna:sc.dna, sb:state.sandbox, clones:sc.clones.slice(), money:state.money, rating:state.rating, tech:sc.tech.slice()};
    const sp = SPECIES.find(s => !s.viv && !s.stars) || SPECIES.find(s => !s.viv);
    sc.dna = {[sp.id]:{genome:CLONE_GENOME.min - 1}};
    out.cloneNeedsMinGenome = !cloneOpen(sp.id) && /needs 60%/.test(cloneProblem(sp.id) || "") && cloneQuality(sp.id) === 0;
    sc.dna[sp.id].genome = CLONE_GENOME.min;
    out.cloneOpensAtMin = cloneOpen(sp.id) && !/genome is/.test(cloneProblem(sp.id) || "") && cloneQuality(sp.id) === CLONE_GENOME.min;
    const qs = [60, 70, 80, 90, 100].map(g => { sc.dna[sp.id].genome = g; return cloneQuality(sp.id); });
    out.cloneHealthRisesWithGenome = qs.every((q, i) => !i || q > qs[i - 1]) && qs[4] === 100 && qs[2] >= 70;
    state.sandbox = true; state.money = 1e8; state.rating = 5; sc.clones = [];
    sc.dna[sp.id].genome = 60; sc.tech = sc.tech.slice();
    const had = sc.crew.gene, bays = freeBay("gene");
    out.noQualityField = !("quality" in sc.dna[sp.id]) && typeof bestQuality === "undefined" && typeof ghostQuality === "undefined" && !TECH.some(t => /^ghostq/.test(t)) && !TIME_PERIODS.some(p => "quality" in p);
    // old saves: quality fields and Time Travel Lab quality upgrades go, and the research points come back
    const snap = JSON.parse(JSON.stringify(state)); snap.science.dna = {[sp.id]:{genome:70, quality:80}}; snap.science.tech.push("ghostq1", "ghostq2"); const pts = snap.science.points || 0;
    upgradeSave(snap);
    out.oldSaveDropsQuality = !("quality" in snap.science.dna[sp.id]) && snap.science.dna[sp.id].genome === 70 && !snap.science.tech.some(t => /^ghostq/.test(t)) && Math.round(snap.science.points - pts) === 130;
    sc.dna = keep.dna; sc.clones = keep.clones; sc.tech = keep.tech; state.sandbox = keep.sb; state.money = keep.money; state.rating = keep.rating;
    return out;
  });
  Object.assign(checks, gq);

  // shelters: animals walk into a shelter in a storm, at night, and when frightened; shelters hold only so many; they aren't drawn or tappable inside;
  // hiding animals let guests down (educated and paleo-nerd guests less); privacy screens and quiet signs cut the crowd the animals feel
  Object.assign(checks, await page.evaluate(() => {
    const out = {};
    startWith(newPark(), false); setSpeed(0);
    state.money = 1e9; state.staff.feedFrom = 999; state.safety.escapesFrom = 999; state.health.from = 999;
    state.paths.push({id:"p-loop", points:[[207.5,235],[100,235],[100,120],[300,120],[300,235],[207.5,235]]});
    const sp = SPECIES.filter(s => !s.viv && !COLD_HARDY.includes(s.id) && traitsOf(s).active === "diurnal" && traitsOf(s).temper === "skittish").sort((x, y) => coverSlots(x) - coverSlots(y))[0], cap = Math.floor(LAND.shelter.slots / coverSlots(sp));
    const e = {id:"e-sh", name:"Shy", points:[[104,124],[180,124],[180,231],[104,231]], animals:Array.from({length:12}, (_, i) => ({id:"sh" + i, sp:sp.id})), happy:80, cond:100, stock:{}, land:[]};
    state.exhibits.push(e);
    const barn = {id:"l-b", type:"shelter", x:142, y:178}; e.land.push(barn);
    afterChange(); syncAnimals(); resetParties();
    const place = (list, x, y) => list.forEach(a => { const h = herd.get(a.id); h.x = x; h.y = y; h.placed = true; });
    const reset = () => { shelterRun.clear(); hideAvg.clear(); for(const a of e.animals){ a.inside = null; a.act = "forage"; a.actFor = 99; a.napFor = 0; a.napDay = -1; a.need = freshNeeds(); } };
    const inside = () => e.animals.filter(a => a.inside), step = () => { behaviorTick(BEHAVIOR.step); animateAnimals(.016); };
    const wx = (w, m) => { state.weather = {today:w, next:"fair", from:999}; state.minute = m; };

    // a storm sends them in, up to the room the shelter has (a small barn holds 10 slots, and each of these takes a few)
    reset(); wx("storm", DAWN_MIN + 120); place(e.animals, 142, 178);
    const probe = e.animals[0], hp = herd.get(probe.id), ab = animalBox(hp);
    const tap = () => { const r = svg.getBoundingClientRect(); return animalAt(r.left + view.tx + hp.x * view.k, r.top + view.ty + hp.y * ky() + ab.oy * view.k); };
    const before = tap();
    step();
    const ins = inside();
    out.stormSendsAnimalsIn = ins.length > 0 && ins.every(a => a.inside === "weather") && /storm/i.test(actLabel(ins[0]));
    out.shelterCapacityRespected = ins.length === cap && e.animals.length - ins.length === 12 - cap && e.animals.filter(a => !a.inside).every(a => !shelterRun.has(a.id));
    const gone = ins[0], gh = herd.get(gone.id), shown = e.animals.find(a => !a.inside), sh = herd.get(shown.id);
    out.insideNotDrawn = gh.el.style.display === "none" && sh.el.style.display !== "none";
    place(e.animals.filter(a => !a.inside), 110, 130);
    out.insideNotTappable = before !== null && (() => { const r = svg.getBoundingClientRect(), b = animalBox(gh); return animalAt(r.left + view.tx + gh.x * view.k, r.top + view.ty + gh.y * ky() + b.oy * view.k) === null; })();
    // the animal panel still opens from the Animals tab, and says where it is
    select("animal", gone.id); out.panelOpensForInsideAnimal = !!selItem() && selItem().id === gone.id && /storm/i.test(actLabel(gone)); select(null);
    // the exhibit report says so
    out.reportSaysSheltering = exhibitReport(e).issues.some(i => /In a shelter/.test(i.text));
    // fair weather brings them out again
    wx("fair", DAWN_MIN + 140); step(); step(); animateAnimals(.016);
    out.fairWeatherBringsOut = inside().length === 0 && gh.el.style.display !== "none";
    // a bulldozed shelter lets them out
    reset(); wx("storm", DAWN_MIN + 120); place(e.animals, 142, 178); step(); const was = inside().length;
    e.land = e.land.filter(f => f !== barn); step(); out.bulldozedShelterReleases = was > 0 && inside().length === 0; e.land.push(barn);
    // a hot day and a cold snap too, but not a canopy in the cold
    reset(); wx("hot", DAWN_MIN + 120); place(e.animals, 142, 178); step(); out.heatSendsIn = inside().length > 0 && /heat/i.test(actLabel(inside()[0]));
    e.land = [{id:"l-c", type:"canopysm", x:142, y:178}]; reset(); wx("cold", DAWN_MIN + 120); place(e.animals, 142, 178); step(); out.coldSkipsCanopy = inside().length === 0;
    reset(); wx("hot", DAWN_MIN + 120); step(); out.heatUsesCanopy = inside().length > 0; e.land = [barn];

    // asleep at night
    reset(); wx("fair", 23 * 60); place(e.animals, 142, 178); step();
    out.nightSleepsInside = inside().length === cap && inside().every(a => a.inside === "sleep") && /sleeping inside/i.test(actLabel(inside()[0]));
    wx("fair", DAWN_MIN + 120); step(); step(); out.wakesAndComesOut = inside().length === 0;
    // a nap
    reset(); wx("fair", 13 * 60); place(e.animals, 142, 178); e.animals.forEach(a => { a.act = "rest"; a.actFor = 0; a.napFor = 200; }); step(); out.napGoesInside = inside().length > 0 && inside().every(a => a.inside === "sleep");
    // frightened ones hide inside, and come out calm
    reset(); wx("fair", DAWN_MIN + 120); place(e.animals, 142, 178); const shy = e.animals[0]; shy.need.stress = 95; step();
    out.frightenedHideInside = shy.inside === "hide" && actLabel(shy) === "Hiding inside";
    shy.need.stress = 2; for(let i = 0; i < 12; i++){ shy.need.stress = 2; step(); } out.calmComesOut = !shy.inside;
    // far from the shelter it has to walk first; it goes in on arrival
    reset(); wx("storm", DAWN_MIN + 120); place(e.animals, 110, 130); step();
    const walkers = e.animals.filter(a => shelterRun.has(a.id) && !shelterRun.get(a.id).in);
    place(walkers, 142, 178); animateAnimals(.016);
    out.walksThenEnters = walkers.length > 0 && inside().length === cap && e.animals.every(a => !shelterRun.has(a.id) || shelterRun.get(a.id).in || !a.inside);
    // not saved
    const snap = JSON.parse(JSON.stringify(state)); upgradeSave(snap); out.insideNotKept = snap.exhibits.find(x => x.id === "e-sh").animals.every(a => !("inside" in a));

    // guests: animals that hide let a visit down; sleeping at night doesn't count, and sheltering from weather counts little
    reset(); wx("fair", DAWN_MIN + 120);
    const w = k => { e.animals.forEach(a => a.inside = null); e.animals.slice(0, 8).forEach(a => a.inside = k); return visibleShare(e); };
    const vh = w("hide"), vw = w("weather"), vs = w("sleep"); state.minute = minuteAtClock(23 * 60); const vn = w("sleep"); state.minute = DAWN_MIN + 120;
    out.hidingCountsMost = vh < vs && vs < vw && vw < 1 && vn === 1;
    e.animals.forEach(a => a.inside = null);
    const mkP = (pers, edu) => { const p = newParty(2); p.pers = pers; p.edu = edu || 0; delete p.fxc; p.mood = 60; p.seen = new Set(); p.thought = new Set(); return p; };
    const visit = (p, avg) => { hideAvg.set(e.id, avg); const m0 = p.mood; seeExhibit(p, e); return p.mood - m0; };
    const ok1 = visit(mkP(["neutral", "neutral"]), 1), bad = mkP(["neutral", "neutral"]), lo = visit(bad, .2);
    out.hidingLowersMood = lo < ok1 - 3 && bad.thought.has("hiding") && THOUGHTS.hiding && /animals/i.test(THOUGHTS.hiding.text);
    const fine = mkP(["neutral", "neutral"]), loFine = visit(fine, .8);
    out.hidingToleratedWhenFew = Math.abs(loFine - ok1) < 1e-9 && !fine.thought.has("hiding");
    const learned = visit(mkP(["neutral", "neutral"], 40), .2), half = visit(mkP(["neutral", "neutral"], 20), .2);
    out.educatedPenalisedLess = learned > lo + 3 && learned > half && half > lo;
    const bo = pers => { hideAvg.set(e.id, .2); return hideBother(mkP(pers), e); };
    out.paleoAndConservLeastBothered = bo(["paleo", "neutral"]) < bo(["neutral", "neutral"]) && bo(["conserv", "neutral"]) < bo(["neutral", "neutral"]) && bo(["family", "neutral"]) > bo(["neutral", "neutral"]) && bo(["paleo", "neutral"]) <= bo(["conserv", "neutral"]);
    hideAvg.set(e.id, .2); out.reportAndPanelHint = exhibitReport(e).issues.some(i => i.bad && /Most animals out of sight/.test(i.text) && !/Add quiet signs/.test(i.text));
    hideAvg.set(e.id, 1); out.noHintWhenVisible = !exhibitReport(e).issues.some(i => /animals are hiding/.test(i.text));

    // privacy screens and quiet signs cut the crowd the animals feel (ctx.seen)
    hideAvg.clear(); resetParties();
    for(let i = 0; i < 100; i++) parties.push({id:"fp" + i, at:{x:112, y:122}, rowdy:false, n:2});
    const base = behaviorCtx(e).seen;
    out.screenCutsSeen = (() => { e.land.push({id:"l-s", type:"screen", x:109, y:200}); const v = behaviorCtx(e).seen; e.land.pop(); return base > 0 && v < base * .9; })();
    out.screenPlacedByFence = !landProblem(e, "screen", 109, 200) && /fence/.test(landProblem(e, "screen", 142, 150) || "") && /habitat props/i.test(decorProblem("screen", 400, 400) || "");
    out.screenDrawn = (() => { const g = featSvg({id:"l-s", type:"screen", x:109, y:200}, "temperate", false, () => false); return g.includes("<rect") && !g.includes("NaN"); })();
    const q = {id:"b-q", type:"quiet", points:rectPts(110, 121, BUILDINGS.quiet.w, BUILDINGS.quiet.d, 0)}; state.buildings.push(q);
    const hushed = behaviorCtx(e).seen;
    parties.forEach(p => p.rowdy = true); const loud = behaviorCtx(e).seen; parties.forEach(p => p.rowdy = false);
    q.cond = 5; const brokenSign = behaviorCtx(e).seen; q.cond = 100;
    state.buildings.pop(); const gone2 = behaviorCtx(e).seen;
    out.quietSignCutsSeen = hushed < base * .6 && Math.abs(gone2 - base) < 1e-9 && Math.abs(brokenSign - base) < 1e-9;
    out.rowdyPartlyIgnoreQuietSign = loud > hushed && loud < base;
    // a shy herd is less stressed with the signs up
    state.buildings.push(q); const T = e.animals[0], stressWith = stressTarget(e, T, sp, behaviorCtx(e)); state.buildings.pop(); const stressWithout = stressTarget(e, T, sp, behaviorCtx(e));
    out.quietSignCalmsShyAnimals = traitsOf(sp).temper !== "skittish" || stressWith < stressWithout;
    resetParties();
    state.exhibits = state.exhibits.filter(x => x !== e); afterChange(); syncAnimals();
    return out;
  }));

  // biome paint (js/biomepaint.js)
  Object.assign(checks, await page.evaluate(() => {
    const out = {}, keep = state.biomePaint; state.biomePaint = [];
    const o = ownedRects()[0], x = Math.round((o[0] + o[2]) / 2), y = Math.round((o[1] + o[3]) / 2);
    const [A, B] = Object.keys(BIOMES).filter(k => k !== parkBiome());
    const rs = () => JSON.stringify(state.biomePaint.map(p => [p.biome, ...p.r]));
    paintRect(A, [x, y, x + 10, y + 10]);
    out.paintAdds = state.biomePaint.length === 1 && state.biomePaint[0].biome === A;
    out.paintSnapsToGrid = (() => { const r = paintBoxW([x + .4, y + .4], [x + 5.6, y + 3.2]); return r.every(v => v % 5 === 0) && r[2] - r[0] >= 5 && r[2] - r[0] <= 10 && r[3] - r[1] === 5; })();
    out.paintLeavesParkBiome = state.biome === undefined || state.biome === parkBiome();
    paintRect(B, [x + 2, y + 2, x + 6, y + 6]);
    out.paintCoversInPlace = state.biomePaint.length === 2 && paintAt(x + 3, y + 3).biome === B && paintAt(x + 8, y + 8).biome === A;
    out.paintRepick = (() => { const t = paintAt(x + 3, y + 3); return repickPaint(t.id, A) && paintAt(x + 3, y + 3).biome === A && !repickPaint(t.id, A); })();
    // painted over: a patch fully covered is deleted, the list stays small
    paintRect(B, [x - 1, y - 1, x + 11, y + 11]);
    out.paintCoveredLayersDeleted = state.biomePaint.length === 1 && rs() === JSON.stringify([[B, x - 1, y - 1, x + 11, y + 11]]);
    out.paintSameAgainIsNoop = (() => { const n = paintVer; const r = paintRect(B, [x, y, x + 4, y + 4]); return r.same && paintVer === n && state.biomePaint.length === 1; })();
    // a patch the new one spans across is trimmed, and touching same-biome patches merge
    paintRect(A, [x - 5, y - 5, x + 15, y + 2]);
    out.paintTrimsPartlyCovered = rs() === JSON.stringify([[B, x - 1, y + 2, x + 11, y + 11], [A, x - 5, y - 5, x + 15, y + 2]]);
    paintRect(B, [x - 1, y + 11, x + 11, y + 14]);
    out.paintMergesNeighbours = rs() === JSON.stringify([[A, x - 5, y - 5, x + 15, y + 2], [B, x - 1, y + 2, x + 11, y + 14]]);
    out.paintNeverOffLand = typeof paintRect(A, [o[2] + 5, o[1], o[2] + 20, o[1] + 10]) === "string" && state.biomePaint.length === 2;
    // erasing: a tap takes the patch, a box splits what it cuts
    out.eraseBoxSplits = (() => { const n = eraseRect([x + 3, y + 5, x + 7, y + 8]); return n === 1 && state.biomePaint.filter(p => p.biome === B).length === 4 && !paintAt(x + 4, y + 6) && !!paintAt(x + 1, y + 6) && !!paintAt(x + 4, y + 3) && !!paintAt(x + 4, y + 10) && !!paintAt(x + 9, y + 6); })();
    out.eraseTapTakesPatch = erasePaintAt(x + 1, y + 6) && !paintAt(x + 1, y + 6) && !erasePaintAt(x + 1, y + 6);
    // drawing is cached until the paint changes, and uses the biome ground patterns
    const s1 = paintSvg(), s2 = paintSvg();
    out.paintDrawn = s1 === s2 && s1.includes(`url(#p-${A})`) && s1.includes(`url(#p-${B})`) && s1.includes("plotClip") && !s1.includes("NaN");
    paintRect(B, [x, y, x + 2, y + 2]);
    out.paintCacheRefreshes = paintSvg() !== s1;
    // save and load
    const copy = JSON.parse(JSON.stringify(state)), before = rs();
    const loaded = upgradeSave(copy);
    out.paintSurvivesSave = JSON.stringify(loaded.biomePaint.map(p => [p.biome, ...p.r])) === before && loaded.biomePaint.length > 0;
    delete copy.biomePaint;
    out.paintOldSaveDefault = Array.isArray(upgradeSave(copy).biomePaint) && upgradeSave(copy).biomePaint.length === 0 && newPark().biomePaint.length === 0;
    out.paintExhibitBiome = (() => {
      const e = {id:"e-pb", name:"Paint", points:[[x, y], [x + 12, y], [x + 12, y + 9], [x, y + 9]], animals:[], land:[], biome:"grassland"};
      state.exhibits.push(e);
      const keepP = state.biomePaint; state.biomePaint = []; paintTouch();
      const T = "desert", box = [x, y, x + 12, y + 9], third = [x, y, x + 4, y + 9];
      const first = biomeOf(e) === "grassland";
      paintRect(T, third);
      const minority = biomeOf(e) === "grassland" && paintShare(e).counts[T] > 0;    // a third painted: the base still wins
      paintRect(T, [x, y, x + 8, y + 9]);
      const tipped = biomeOf(e) === T;                                               // two thirds: it tips
      const free = exhibitPaintCost(box, T) === Math.round(12 * 9 * BIOMES[T].perSqM / 3);   // only the last third costs
      state.biomePaint = []; paintTouch();
      const priced = exhibitPaintCost(box, T) === Math.round(108 * BIOMES[T].perSqM) && exhibitPaintCost(box, "grassland") === 0;
      paintRect(T, box);
      const drawn = exhibitPaintSvg(e).includes(`url(#b-${T})`) && exhibitPaintSvg(e).includes("clip-path");
      const panel = biomeHtml(e).includes("Paint ground") && !biomeHtml(e).includes("biomeSel");
      state.exhibits.pop(); state.biomePaint = keepP; paintTouch();
      return first && minority && tipped && free && priced && drawn && panel;
    })();
    out.vivNeverPainted = (() => { const v = {viv:"S", biome:"desert", points:[[0,0],[5,0],[5,5],[0,5]], animals:[]}; const k = state.biomePaint; state.biomePaint = [{id:"x", biome:"tropical", r:[0,0,5,5]}]; paintTouch(); const ok = biomeOf(v) === "desert"; state.biomePaint = k; paintTouch(); return ok; })();
    out.paintMenuAndTool = !!document.querySelector('#sideMenu .sitem[data-open="paint"] .ssub [data-paint="erase"]');
    out.waterMenuList = (() => { setTool("select"); const b = document.querySelector('#sideMenu .sitem[data-open="water"] [data-water="desert"]'); if(!b) return false; b.click();
      const on = tool === "water" && waterPick === "desert" && b.getAttribute("aria-pressed") === "true" && $("#dSizes").hidden; b.click();
      const off = tool === "select" && b.getAttribute("aria-pressed") === "false"; waterPick = "auto"; return on && off; })();
    out.paintToolBar = (() => { setTool("select"); document.querySelector('#sideMenu [data-paint="tropical"]').click(); const ok = tool === "paint" && paintPick === "tropical" && document.querySelectorAll("#sideMenu [data-paint]").length === Object.keys(BIOMES).length + 1 && document.querySelector('#sideMenu [data-paint="tropical"]').getAttribute("aria-pressed") === "true" && $("#dSizes").hidden;
      const [pcx, pcy] = chunkAt(x + 20, y), px = pcx * 5, py = pcy * 5;
      pdrag = {a:[pcx, pcy], b:[pcx + 1, pcy]}; endPaintDrag();
      const drawn = state.biomePaint.some(p => p.r.join() === [px, py, px + 10, py + 5].join());
      paintPick = "erase"; pdrag = {a:[pcx, pcy], b:[pcx + 1, pcy]}; endPaintDrag();
      const gone = !paintAt(px + 1, py + 1); paintPick = null; setTool("select"); return ok && drawn && gone; })();
    state.biomePaint = keep || []; paintTouch(); render();
    out.waterChunks = (() => {
      const kw = state.water; state.water = []; setTool("water");
      const [cx, cy] = chunkAt(x, y);
      wdrag = {a:[cx, cy], b:[cx + 1, cy]}; const sized = waterBox().r.join() === [cx * 5, cy * 5, cx * 5 + 10, cy * 5 + 5].join();
      state.money = 1e7; endWaterDrag();
      wdrag = {a:[cx + 2, cy], b:[cx + 2, cy]}; endWaterDrag();   // touches the first at its end and has the same height: they join
      const joined = state.water.length === 1 && rectOfPts(state.water[0].points).join() === [cx * 5, cy * 5, cx * 5 + 15, cy * 5 + 5].join();
      wdrag = {a:[cx, cy], b:[cx, cy]}; const over = !!waterBox().err; wdrag = null;
      state.water = kw; setTool("select"); return sized && joined && over;
    })();
    // water can't be bulldozed; painting or erasing ground over it cuts it out and refunds at refundShare
    out.paintRemovesWater = (() => {
      const kw = state.water, kp = state.biomePaint, km = state.money, [cx, cy] = chunkAt(x, y), X = cx * 5, Y = cy * 5, mid = [X + 5, Y + 5, X + 10, Y + 10];
      const lay = () => { state.water = [{id:"w-pw", points:[[X, Y], [X + 15, Y], [X + 15, Y + 15], [X, Y + 15]]}]; };
      const area = () => state.water.reduce((n, w) => { const q = rectOfPts(w.points); return n + (q[2] - q[0]) * (q[3] - q[1]); }, 0);
      const A = Object.keys(BIOMES).find(b => b !== parkBiome());
      lay(); state.money = 1e6; state.biomePaint = [];
      const noPick = !watersSvg(state.water, parkBiome()).includes("data-kind"); tool = "bulldoze"; bulldozeTap("water", "w-pw"); tool = "select";
      const kept = state.water.length === 1;
      bulldozePaint({a:[cx + 1, cy + 1], b:[cx + 1, cy + 1]});   // bulldoze over water leaves it
      const bulldozeKeeps = state.water.length === 1 && area() === 225;
      setTool("paint"); paintPick = A;
      pdrag = {a:[cx + 1, cy + 1], b:[cx + 1, cy + 1]}; const stat = (paintDragStat(), $("#dStat") ? $("#dStat").textContent : "");
      const m0 = state.money; endPaintDrag();
      const cut = area() === 200 && state.water.length === 4 && !state.water.some(w => rectOverlap(rectOfPts(w.points), mid)) && state.money === m0 + Math.round(25 * WATER.perSqM * COST.refundShare) && !!paintAt(X + 6, Y + 6);
      lay(); paintPick = "erase"; pdrag = {a:[cx, cy], b:[cx, cy + 2]}; const m1 = state.money; endPaintDrag();   // erase a whole column with no paint under it
      const erased = area() === 150 && state.water.length === 1 && state.money === m1 + Math.round(75 * WATER.perSqM * COST.refundShare);
      lay(); const ex = {id:"e-cw", points:[[X + 40, Y], [X + 60, Y], [X + 60, Y + 20], [X + 40, Y + 20]], animals:[], land:[], water:[{id:"w-ex", points:[[X + 40, Y], [X + 50, Y], [X + 50, Y + 10], [X + 40, Y + 10]]}]};
      state.exhibits.push(ex); const cw = cutWaterAll([X + 40, Y, X + 45, Y + 10]); state.exhibits.pop();
      const exhibit = cw.m2 === 50 && ex.water.length === 1 && rectOfPts(ex.water[0].points).join() === [X + 45, Y, X + 50, Y + 10].join() && state.water.length === 1;
      paintPick = null; setTool("select"); state.water = kw; state.biomePaint = kp || []; paintTouch(); state.money = km; render();
      return noPick && kept && bulldozeKeeps && /Removes 25 m² of water/.test(stat) && cut && erased && exhibit;
    })();

    // medicine logistics: a custodian tops the PMC up from the Botany Lab when a medicine is down to a couple of doses, not only once it is gone
    startWith(newPark(), false); setSpeed(0);
    {
      state.money = 1e7; state.day = 10; state.starters = []; state.staff.feedFrom = 0; state.safety.escapesFrom = 99;
      const H = Math.PI / 2, add = (id, type, x, y) => state.buildings.push({id, type, points:rectPts(x, y, BUILDINGS[type].w, BUILDINGS[type].d, H)});
      add("m-pmc", "pmc", 230, 262); add("m-ce", "ceres", 180, 262); add("m-cl", "closet", 205, 230);
      state.paths.push({id:"m1", name:"m1", points:[[207.5,230],[207.5,262]]}, {id:"m2", name:"m2", points:[[207.5,262],[222,262]]}, {id:"m3", name:"m3", points:[[207.5,262],[193,262]]});
      state.science.tech.push("medmeso");
      recompute(); buildKeeperGraph(); buildGuestGraph(); hireCustodian(); syncCustodians();
      const pm = state.buildings.find(b => b.id === "m-pmc"); pm.store = {medmes:2}; state.ceres.meds = {medpal:0, medmes:30, medcen:0};
      state.minute = 10; let topped = false;
      for(let i = 0; i < 300 && !topped; i++){ tick(1); topped = stockOf(pm, "medmes") > 2; }
      out.pmcRestocksBeforeEmpty = topped && restockLot("medmes") === HEALTH.dose && restockLot("plants") === 5;
    }
    // flat vivariums: each size draws a non-empty case (back and front), the sizes differ, and old saves with vivariums load and render
    {
      startWith(newPark(), false); setSpeed(0);
      const H = Math.PI / 2, svgs = {};
      for(const [sz, V] of Object.entries(VIVARIUMS)){
        const ev = {id:"e-fv" + sz, name:"Flat " + sz, viv:sz, points:rectPts(200, 260, V.w, V.d, 0), animals:[], happy:70, biome:"tropical"};
        svgs[sz] = viv34(ev, "back", null) + "|" + viv34(ev, "front", null) + "|" + vivFloor34(ev, null, false, false, true);
      }
      out.vivSizesRender = Object.values(svgs).every(v => v.split("|").every(x => x.length > 200 && x.includes("<polygon")));
      out.vivSizesDistinct = new Set(Object.values(svgs)).size === 3;
      { const V = VIVARIUMS.M, ev = {id:"e-fa", name:"Tikts", viv:"M", points:rectPts(200, 300, V.w, V.d, 0), animals:[1,2,3,4].map(i => ({id:"fa" + i, sp:"tikt"})), happy:70};
        state.exhibits.push(ev); syncAnimals();
        const hs = [...herd.values()].filter(h => h.exhibitId === "e-fa");
        out.vivAnimalsInsideGlass = hs.length === 4 && hs.every(h => vivSpot(h, ev, [h.x, h.y]));
        ev.points = rectPts(260, 300, V.w, V.d, 0); syncAnimals();   // moving the case brings them along
        out.vivAnimalsFollowMove = hs.every(h => vivSpot(h, ev, [h.x, h.y])); state.exhibits.pop(); }
      // vivarium fittings fill from the front middle, behind the sill margin; old back-left layouts are re-laid once; jumps stay inside the glass
      { let spread = true, front = true, mid = true, noOverlap = true, jumpsFit = true, homesMid = true;
        for(const sz of ["S", "M", "L"]){
          const V = VIVARIUMS[sz], K = VIV34[sz], m = K.sill / TILT + .15, ev = {id:"e-lay" + sz, name:"Lay", viv:sz, points:rectPts(200, 300, V.w, V.d, 0), animals:["tikt", "tikt", "tikt"].map((x, i) => ({id:"ly" + sz + i, sp:x})), happy:70, biome:"tropical", land:[]};
          state.money = 1e6; for(const k of ["vdish", "vlamp", "vpool", "vbark", "vbranch"]) if(vivPlantSpot(ev, k)) addVivToy(ev, k);
          const bb = bbox(ev.points), cx = (bb.x0 + bb.x1) / 2;
          front = front && ev.land.every(f => f.y <= bb.y1 - m + 1e-6);
          mid = mid && Math.abs(ev.land[0].x - cx) < 1.5 && Math.abs(ev.land[0].y - ((bb.y0 + bb.y1) / 2 + VIV_PLANT.shift)) < 1.5;
          { const xs = ev.land.map(f => f.x); spread = spread && Math.max(...xs) - Math.min(...xs) > V.w * .25; }
          noOverlap = noOverlap && ev.land.every((f, i) => ev.land.every((g, j) => i === j || Math.hypot(f.x - g.x, f.y - g.y) >= LAND[f.type].r + LAND[g.type].r - 1e-6));
          // an old save: everything stacked from the back-left
          const old = JSON.parse(JSON.stringify(ev)); old.land.forEach((f, i) => { f.x = bb.x0 + 1 + i * 2; f.y = bb.y0 + 1; });
          const sv = upgradeSave({...JSON.parse(JSON.stringify(state)), exhibits:[old], vivLay:0});
          front = front && sv.vivLay === 1 && sv.exhibits[0].land.every(f => f.y <= bb.y1 - m + 1e-6) && sv.exhibits[0].land.reduce((n, f) => n + f.y, 0) / sv.exhibits[0].land.length > bb.y0 + V.d * .35;
          state.exhibits.push(ev); syncAnimals();
          const hs = [...herd.values()].filter(h => h.exhibitId === ev.id);
          for(const act of ["eat", "rest", "hide", "forage", "drink", "pace"]) for(const h of hs){ h.a.act = act; vivJump(h, ev); jumpsFit = jumpsFit && vivSpot(h, ev, [h.x, h.y]); }
          state.exhibits.pop(); syncAnimals();
          const ev2 = {id:"e-lay2" + sz, name:"Lay", viv:sz, points:rectPts(200, 300, V.w, V.d, 0), animals:[{id:"lz" + sz, sp:"tikt"}], happy:70, biome:"tropical", land:[]};
          state.exhibits.push(ev2); syncAnimals();
          const h2 = [...herd.values()].find(h => h.exhibitId === ev2.id);
          homesMid = homesMid && h2.y >= bb.y0 + V.d / 3 - 1e-6 && h2.y <= bb.y0 + V.d * 2 / 3 + 1e-6;
          state.exhibits.pop(); syncAnimals();
        }
        // three big animals in an L case never overlap, and stand over the fittings
        { const V = VIVARIUMS.L, ev = {id:"e-lo", name:"Lo", viv:"L", points:rectPts(200, 300, V.w, V.d, 0), animals:[0, 1, 2].map(i => ({id:"lo" + i, sp:"arth"})), happy:70, biome:"tropical", land:[]};
          state.money = 1e6; state.exhibits.push(ev); for(const k of ["vdish", "vlamp", "vpool", "vbark"]) if(vivPlantSpot(ev, k)) addVivToy(ev, k);
          syncAnimals(); render();
          const hs = [...herd.values()].filter(h => h.exhibitId === "e-lo"); let apart = hs.length === 3;
          for(const act of ["eat", "rest", "hide", "forage", "drink", "play"]){ for(const h of hs){ h.a.act = act; vivJump(h, ev); } apart = apart && hs.every(h => !vivCrowd(h, [h.x, h.y])); }
          out.vivBigAnimalsApart = apart;
          const z = depth34.get("e-lo"); out.vivAnimalsOverProps = !z || hs.every(h => h.el.parentNode === z.g && z.kids.every(k => !(k.compareDocumentPosition(h.el) & Node.DOCUMENT_POSITION_PRECEDING)));
          state.exhibits.pop(); syncAnimals(); }
        out.vivFittingsFront = front; out.vivFirstFrontMiddle = mid; out.vivFittingsSpread = spread; out.vivFittingsApart = noOverlap; out.vivJumpsInsideGlass = jumpsFit; out.vivHomesMiddleDepth = homesMid; }
      { const fs = new Set(); for(let i = 0; i < 40; i++) fs.add(nameAnimal({id:"fz" + i, sp:"tikt"}).face); out.cloneFaceRandom = fs.size === 2 && [...fs].every(f => f === 1 || f === -1);
        const keep = nameAnimal({id:"fk", sp:"tikt", face:-1}); out.faceKept = keep.face === -1; }
      const oldV = JSON.parse(JSON.stringify(newPark()));
      oldV.exhibits.push({id:"e-ov", name:"OldV", points:rectPts(200, 270, 6, 4, 0), animals:[], happy:70, viv:"S"}, {id:"e-ov2", name:"OldV2", points:rectPts(220, 270, 16, 10, 0), animals:[], happy:70, viv:"L"});
      let loaded = true; try { startWith(upgradeSave(oldV), false); setSpeed(0); render(); } catch(err){ loaded = false; }
      out.vivOldSaveLoads = loaded && state.exhibits.filter(e => e.viv).length === 2 && !!document.querySelector('[data-kind="exhibit"][data-id="e-ov"] polygon');
    }
    // vivarium props, dishes, lamp and pool
    {
      startWith(newPark(), false); setSpeed(0); state.money = 1e6; state.staff.feedFrom = 0;
      const V = VIVARIUMS.M, mk = (id, n, x) => ({id, name:id, viv:"M", points:rectPts(x, 300, V.w, V.d, 0), animals:Array.from({length:n}, (_, i) => ({id:id + i, sp:"tikt"})), happy:70, biome:"tropical"});
      const ev = mk("e-pv", 4, 200); state.exhibits.push(ev); recompute(); buildKeeperGraph();
      const ft = Object.keys(dailyNeed(ev))[0], carrier = () => ({id:"k-x", carry:{type:ft, amount:6}});
      const noteBad = (e, re) => exhibitReport(e).issues.some(i => i.bad && re.test(i.text));
      // no dish: keepers can't deliver, animals go hungry, and the panel and report say so
      const h0 = ev.hungryMin || 0; eatTick(30);
      out.vivNoDishNoFeed = vivNoDish(ev) && dishText(ev) === "Needs a food dish." && !startFilling(carrier(), ev) && !shortages(null).some(j => j.e === ev) && (ev.hungryMin || 0) > h0
        && noteBad(ev, /Needs a food dish/) && exhibitHtml(ev).includes("Needs a food dish");
      // a dish: sized by the case, keepers fill it, animals eat from it and aren't hungry
      addVivToy(ev, "vdish"); const dish = landOf(ev).find(f => f.type === "vdish");
      const c = carrier(), k = {stamina:100};
      out.vivDishSized = dish.cap === VIV_DISH.cap.M && trayCap(dish) === VIV_DISH.cap.M && !vivNoDish(ev) && !dishText(ev) && vivServed(ev) === 1;
      out.vivDishListed = shortages(null).some(j => j.e === ev) || (kGraph.anchors[ev.id] ? false : true);
      const filled = startFilling(c, ev); let guard = 0; while(c.job === "filling" && guard++ < 50) fillStep(c, k, 1000);
      out.vivDishFills = filled && trayFood(ev, ft) > 0 && trayFood(ev, ft) <= VIV_DISH.cap.M + 1e-6 && trayHas(dish) === trayFood(ev, ft);
      const before = trayFood(ev, ft), hm = ev.hungryMin || 0; eatTick(60);
      out.vivDishEaten = trayFood(ev, ft) < before && (ev.hungryMin || 0) === hm && !noteBad(ev, /Hungry/);
      // one food at a time: a dish holding one food takes no other
      out.vivDishOneFood = trayRoomOf(dish, "meat") === 0 && trayRoomOf(dish, ft) >= 0;
      // more animals than dishes reach: the rest go without, and the report says another dish is needed
      const big = mk("e-pv2", 8, 230); state.exhibits.push(big); addVivToy(big, "vdish"); big.land.find(f => f.type === "vdish").food = {[ft]:5};
      const hb = big.hungryMin || 0; eatTick(30);
      out.vivDishesPerAnimals = dishesNeeded(big) === 2 && vivServed(big) === .5 && /another food dish/.test(dishText(big)) && (big.hungryMin || 0) > hb;
      addVivToy(big, "vdish"); out.vivSecondDishCovers = vivServed(big) === 1 && !dishText(big);
      state.exhibits = state.exhibits.filter(x => x !== big);
      // old saves: every vivarium gets one free dish, once (and its loose food moves into it)
      const old = JSON.parse(JSON.stringify(newPark())); delete old.vivDish;
      old.exhibits.push({id:"e-od", name:"OldDish", points:rectPts(200, 270, 10, 6, 0), animals:[{id:"od1", sp:"tikt"}], happy:70, viv:"M", stock:{[ft]:3}}, {id:"e-od2", name:"OldDish2", points:rectPts(230, 270, 6, 4, 0), animals:[], happy:70, viv:"S"});
      const up = upgradeSave(old), up2 = upgradeSave(JSON.parse(JSON.stringify(up)));
      const od = up.exhibits.find(e => e.id === "e-od"), dishes = e => landOf(e).filter(f => f.type === "vdish");
      out.vivOldSaveDish = up.vivDish === 1 && dishes(od).length === 1 && dishes(od)[0].cap === VIV_DISH.cap.M && trayFood(od, ft) === 3 && up.exhibits.every(e => !e.viv || dishes(e).length === 1) && !Object.keys(od.stock).length
        && dishes(up2.exhibits.find(e => e.id === "e-od")).length === 1 && !vivNoDish(od);
      // cases from before they grew: each grows to its size now, its front glass where it was, its fittings still inside
      const sm = JSON.parse(JSON.stringify(newPark())); delete sm.vivBig;
      sm.exhibits.push({id:"e-sm", name:"Small", points:rectPts(200, 270, 9, 6, 0), animals:[], happy:70, viv:"M", land:[{id:"l-sm", type:"vdish", x:203, y:272, cap:1, food:{}}]});
      const smE = upgradeSave(sm).exhibits.find(e => e.id === "e-sm"), sb = bbox(smE.points), sb0 = bbox(rectPts(200, 270, 9, 6, 0));
      out.vivGrewOldSave = sm.vivBig === 1 && Math.abs(sb.x1 - sb.x0 - VIVARIUMS.M.w) < .01 && Math.abs(sb.y1 - sb.y0 - VIVARIUMS.M.d) < .01 && Math.abs(sb.y1 - sb0.y1) < .01
        && Math.abs((sb.x0 + sb.x1) - (sb0.x0 + sb0.x1)) < .01 && smE.land.every(f => inPoly(f.x, f.y, smE.points));

      // basking lamp: heat lovers get warmer and happier, less ill, it costs upkeep, and they gather under it
      const wantHeat = SPECIES_BY_ID.tikt, ok = wantsHeat(wantHeat) && !wantsHeat(SPECIES_BY_ID.ples) && !wantsHeat(SPECIES_BY_ID.arch);
      const tNo = exhibitReport(ev).target, ill0 = illChance(ev, ev.animals[0]).p, up0 = dailyCosts().upkeep, w0 = state.weather.today;
      state.weather.today = "cold"; const coldNo = illChance(ev, ev.animals[0]); state.weather.today = w0;
      const cm0 = comfortOf(ev, wantHeat, {comfort:new Map(), x:0, dirt:0});
      const m0 = state.money; addVivToy(ev, "vlamp"); const lamp = landOf(ev).find(f => f.type === "vlamp");
      state.weather.today = "cold"; const coldYes = illChance(ev, ev.animals[0]); state.weather.today = w0;
      out.vivLampEffects = ok && state.money === m0 - LAND.vlamp.price && heatShare(ev) === 1 && exhibitReport(ev).target > tNo && illChance(ev, ev.animals[0]).p < ill0 && coldNo.why.includes("lamp") && !coldYes.why.includes("lamp") && coldYes.p < coldNo.p
        && comfortOf(ev, wantHeat, {comfort:new Map(), x:0, dirt:0}) > cm0 && dailyCosts().upkeep === up0 + LAND.vlamp.upkeep && noteBad(ev, /basking lamp|Cold/) === false;
      // one lamp warms VIV_LAMP.per animals: a bigger group is only partly warmed
      const ev8 = mk("e-pv3", 8, 260); state.exhibits.push(ev8); addVivToy(ev8, "vlamp");
      out.vivLampCovers = heatShare(ev8) === VIV_LAMP.per / 8 && exhibitReport(ev8).issues.some(i => /Not enough lamps/.test(i.text)); state.exhibits = state.exhibits.filter(x => x !== ev8);
      // animals gather under the lamp (a couple huddle in its glow, over a few tries since each starts somewhere random)
      let gathered = 0; for(let t = 0; t < 15 && gathered < 2; t++){ regatherViv(ev); render(); gathered = [...herd.values()].filter(h => h.exhibitId === ev.id && Math.hypot(h.x - lamp.x, (h.y - lamp.y) * 2) <= VIV_LAMP.radius + 1).length; }
      out.vivLampGather = gathered >= 2;
      out.vivLampDrawn = landSvg(ev, null, () => false).includes("sprites/viv/vlamp-pool.png") && landSvg(ev, null, () => false).includes("sprites/viv/vlamp.png");

      // pool: water for water lovers (thirst, water share, happiness), animals sit in it partly submerged; distinct from the misters
      wantHeat.semi = true;   // no vivarium species is semi-aquatic yet, so borrow one as the water lover
      const pv = mk("e-pp", 4, 200 + 30); state.exhibits.push(pv); recompute();
      const dryNo = thirsty(pv, wantHeat), tDry = exhibitReport(pv).target, wat0 = haveOf(pv, wantHeat).water, ill1 = illChance(pv, pv.animals[0]);
      addVivToy(pv, "vpool"); const pool = landOf(pv).find(f => f.type === "vpool");
      const arthLike = likesOf(SPECIES_BY_ID.arth).water < HAB.wantsWater;
      out.vivPoolEffects = dryNo && !thirsty(pv, wantHeat) && haveOf(pv, wantHeat).water > wat0 && wat0 === 0 && exhibitReport(pv).target > tDry && !noteBad(pv, /Dry/) && ill1.why.includes("thirst") && !illChance(pv, pv.animals[0]).why.includes("thirst")
        && vivPoolM2(pv) === LAND.vpool.poolM2 && arthLike && !thirsty(pv, SPECIES_BY_ID.arth) && LAND.vpool.pool && !LAND.vmist.pool;
      let sunk = 0; for(let t = 0; t < 8 && sunk < 1; t++){ regatherViv(pv); render(); sunk = [...herd.values()].filter(h => h.exhibitId === pv.id && h.sub && /clip-path/.test(h.el.innerHTML)).length; }
      out.vivPoolSubmerged = sunk >= 1 && !!vivPoolAt(pv, pool.x, pool.y) && !vivPoolAt(pv, pool.x + 5, pool.y);
      delete wantHeat.semi;
      const poolSvg = landSvg(pv, null, () => false);
      out.vivPoolDrawn = poolSvg.includes("sprites/viv/vpool.png") && poolSvg.includes(`data-y="${pool.y - 1000}"`);
      state.exhibits = state.exhibits.filter(x => x !== pv);

      // pictures: the five old props and the new ones all come from sprites/viv through the pack, and the dish shows its food
      const picsEv = mk("e-pic", 1, 200); const keys = ["vbark", "vbranch", "vdig", "vfeed", "vmist", "vdish", "vlamp", "vpool", "afilter", "asump", "arock", "aweed", "abubble", "aboulder", "abrain", "acoral", "afan", "asponge", "akelp", "ashell"];
      picsEv.land = keys.map((k, i) => ({id:"pc" + i, type:k, x:196 + i * 1.5, y:300}));
      const svgp = landSvg(picsEv, null, () => false);
      out.vivSpritesDrawn = keys.every(k => VIV_SPRITES[k] && svgp.includes(`sprites/viv/${k}.png`)) && !svgp.includes("<circle") && Object.keys(VIV_SPRITES).length === keys.length;
      // aquariums: sea animals only there and nowhere else, only aquarium fittings (and a dish), filters keep the water clean while powered, foul water makes them unhappy and ill
      const aq = {id:"e-aq", name:"Aq", viv:"L", aqua:true, wq:100, points:rectPts(320, 300, V.w, V.d, 0), animals:[0, 1, 2].map(i => ({id:"aq" + i, sp:"stet", q:90})), happy:70};
      state.exhibits.push(aq); recompute();
      const sea = SPECIES_BY_ID.stet, land = SPECIES_BY_ID.tikt;
      out.aquaFits = fitsHabitat(sea, aq) && !fitsHabitat(land, aq) && !fitsHabitat(sea, ev) && !fitsHabitat(sea, {points:[]}) && fitsHabitat(land, ev) && SPECIES.filter(x => x.aqua).every(x => x.viv && TIME_SITES.some(t => (t.fauna || []).includes(x.id)));
      out.aquaFittings = !vivToyProblem(aq, "afilter") && !vivToyProblem(aq, "vdish") && !!vivToyProblem(aq, "vlamp") && !!vivToyProblem(aq, "vpool") && !!vivToyProblem(ev, "afilter") && !vivToyProblem(ev, "vlamp");
      const noFilter = filterText(aq), aim0 = wqAim(aq);
      aquaTick(DAY_MIN); const dirty1 = wqOf(aq);
      addVivToy(aq, "asump"); aq.filterPowered = true;
      const aim1 = wqAim(aq); aq.filterPowered = false; const aimOff = wqAim(aq), offText = filterText(aq); aq.filterPowered = true;
      aq.wq = 10; const repFoul = exhibitReport(aq), illFoul = illChance(aq, aq.animals[0]);
      aq.wq = 100; const repClean = exhibitReport(aq), illClean = illChance(aq, aq.animals[0]);
      out.aquaWater = noFilter === "No filter." && aim0 === 0 && Math.abs(dirty1 - (100 - AQUA.rate)) < .01 && aim1 === 100 && aimOff === 0 && /power/.test(offText) && !filterText(aq)
        && repFoul.target < repClean.target && repFoul.issues.some(i => /Foul water/.test(i.text)) && illFoul.why.includes("water") && !illClean.why.includes("water") && illFoul.p > illClean.p
        && !thirsty(aq, sea) && !(aq.dirt > 0) && aquaLoad(aq) === 3 * sea.food;
      // aquarists: keepers tend every exhibit but lagoons and aquariums, aquarists only those; each has its own staff list, call and zone panel entry, and the same pay
      {
        const kk = {id:"k-t1", name:"Kt"}, ak = {id:"k-t2", name:"At", role:"aqua"}, lg = {id:"e-lg", name:"Lg", points:[], animals:[], barrier:"lagoon"};
        state.staff.keepers.push(kk, ak);
        const pay = state.staff.keepers.reduce((n, k) => n + (isAqua(k) ? AQUARIST.wage : KEEPER.wage), 0);
        out.aquarist = aquaEx(aq) && aquaEx(lg) && !aquaEx(ev) && tends(ak, aq) && tends(ak, lg) && !tends(kk, aq) && !tends(kk, lg) && tends(kk, ev) && !tends(ak, ev)
          && STAFF_TYPES.aquarist.list().includes(ak) && !STAFF_TYPES.aquarist.list().includes(kk) && STAFF_TYPES.keeper.list().includes(kk) && !STAFF_TYPES.keeper.list().includes(ak)
          && CALLS.aqua.staff().includes(ak) && !CALLS.aqua.staff().includes(kk) && !CALLS.keeper.staff().includes(ak) && staffById("k-t2").t === "aquarist" && pay >= KEEPER.wage + AQUARIST.wage;
        // aquarists are hired at a Dive Shack, not a Keeper Station, and start from it
        const bs = state.buildings, m1 = state.money; state.money = 1e6;
        state.buildings = [{id:"b-ks", type:"station", points:[[400,400],[404,400],[404,404],[400,404]]}];
        const noShack = hireKeeper("aqua") === "Build a Dive Shack first." && hireKeeper() === null;
        state.staff.keepers.pop(); state.buildings.push({id:"b-ds", type:"diveshack", points:[[410,400],[414,400],[414,404],[410,404]]});
        const shack = hireKeeper("aqua") === null && isAqua(state.staff.keepers.pop()) && !!BUILDINGS.diveshack.store && BUILDINGS.diveshack.label === "Dive Shack";
        state.buildings = bs; state.money = m1;
        out.aquaristShack = noShack && shack;
        out.aquaristNoHunt = huntJob({id:"k-t2", role:"aqua"}) === null;
        // a lagoon holds pool animals only
        const dry = SPECIES.find(x => !x.viv && !x.pool);
        out.lagoonPoolOnly = lagoonWalled(lg) && !fitsHabitat(dry, lg) && crateProblem({sp:dry.id}, lg) === "Lagoons hold pool animals only." && fitsHabitat(dry, {points:[], animals:[], barrier:"bars"});
        state.staff.keepers = state.staff.keepers.filter(k => k !== kk && k !== ak);
      }
      const kwOf = () => powerDemand(); const d0 = kwOf(); aq.land = aq.land.filter(f => !LAND[f.type].filter); const d1 = kwOf();
      out.aquaPowerDraw = d0 - d1 === LAND.asump.kw;
      out.aquaDrawn = (() => { const g = viv34(aq, "front", null); aq.wq = 0; const f = viv34(aq, "front", null); aq.wq = 100; const c = AQUA34.clean.toLowerCase(); return f !== g && g.includes(c) && f.includes(AQUA34.foul.toLowerCase()) && !viv34(ev, "front", null).includes(c); })();   // the water's colour follows its quality
      // backdrops: one for each sea, every size drawn, an animal's own sea counts in full, a vivarium can't take one and an aquarium can't take a land scene
      {
      const pics = Object.keys(AQUA_SCENES).every(k => Object.keys(VIVARIUMS).every(z => ["wall", "floor"].every(l => SPRITE_PACK[`sprites/vivscene/sea-${k}-${z}-${l}.png`])));
      const bare = habitatScore(aq).delta, m0 = state.money, okSea = !vivSceneProblem(aq, {sea:"paleozoic"}); setVivScene(aq, {sea:"paleozoic"});
      const home = habitatScore(aq).delta, fitHome = sceneFit(aq, sea); setVivScene(aq, {sea:"cambrian"}); const away = habitatScore(aq).delta;
      out.aquaBackdrops = pics && okSea && state.money < m0 && fitHome === 1 && sceneFit(aq, sea) === 0 && Math.abs(home - bare - VIV_PLANT.bonus) < .01 && away === bare
        && seaSceneOf(sea) === "paleozoic" && seaSceneOf(SPECIES_BY_ID.anom) === "cambrian" && seaSceneOf(SPECIES_BY_ID.saca) === "paleozoic" && seaSceneOf(SPECIES_BY_ID.prom) === "mesozoic" && seaSceneOf({period:"Neogene"}) === "cenozoic" && seaSceneOf(SPECIES_BY_ID.kntr) === "cenozoic" && SPECIES.filter(x => x.aqua).every(seaSceneOf)
        && !!vivSceneProblem(ev, {sea:"cambrian"}) && !!vivSceneProblem(aq, {era:"paleozoic", biome:"wetland"}) && vivScene34(aq, "wall").includes("sea-cambrian-L-wall")
        && aquaSceneHtml(aq).includes("aquaSceneSel") && exTabList(aq).some(t => t.key === "land");
      }
      state.exhibits = state.exhibits.filter(x => x !== aq);
      // paludariums: a vivarium flooded at the front from Landscaping; waders swim there and like it, its water fouls by the swimmers' load and takes filters, and
      // Enaliarctos lives only in one; it can't be drained with a paludarium animal or a filter in it
      {
        const pa = {id:"e-pa", name:"Pa", viv:"M", points:rectPts(350, 300, V.w, V.d, 0), animals:[0, 1, 2, 3].map(i => ({id:"pa" + i, sp:"tikt", q:90})), happy:70, biome:"tropical"};
        state.exhibits.push(pa); recompute();
        addVivToy(pa, "vlamp"); addVivToy(pa, "vdish");   // fittings laid out while it's dry, some at the front
        const dry = habitatScore(pa).delta, m0 = state.money, okOn = !paluProblem(pa, true); setPalu(pa, true);
        const onBank = landOf(pa).every(f => f.y < paluY(pa)); addVivToy(pa, "vbark");
        const tk = SPECIES_BY_ID.tikt, enal = SPECIES_BY_ID.enal, load = aquaLoad(pa), noF = filterText(pa);
        addVivToy(pa, "afilter"); pa.filterPowered = true;
        const placed = landOf(pa).every(f => LAND[f.type].filter ? f.y > paluY(pa) : f.y < paluY(pa)) && onBank; pa.wq = 100; const wetHappy = habitatScore(pa).delta;
        pa.wq = 10; const foul = habitatScore(pa).delta, ill = illChance(pa, pa.animals[0]); pa.wq = 100;
        const drawn = viv34(pa, "front", null) !== viv34(ev, "front", null) && vivFloor34(pa, null, false, false, true).length > vivFloor34(ev, null, false, false, true).length;   // a scene-less paludarium draws its water on the floor
        pa.vivScene = {era:"paleozoic", biome:"wetland"}; const paluFloor = vivScene34(pa, "floor").includes("paleozoic-wetland-M-palu") && !!SPRITE_PACK["sprites/vivscene/paleozoic-wetland-M-palu.png"] && Object.keys(BIOMES).every(b => ["S", "M", "L"].every(z => SPRITE_PACK[`sprites/vivscene/mesozoic-${b}-${z}-palu.png`])); pa.vivScene = null;
        const blockF = !!paluProblem(pa, false);
        const L = {viv:"L", palu:true, points:[]}, Ld = {viv:"L", points:[]};
        out.paludarium = okOn && pa.palu && state.money < m0 && paluSwims(tk) && !paluSwims(SPECIES_BY_ID.arth) && load === 4 * tk.food * PALU.load && noF === "No filter."
          && wetHappy > dry && foul < wetHappy && ill.why.includes("water") && drawn && paluFloor && placed && blockF && !thirsty(pa, tk)
          && !vivToyProblem(pa, "afilter") && !!vivToyProblem(pa, "vpool") && !!vivToyProblem(pa, "acoral") && !!vivToyProblem(ev, "afilter")
          && fitsHabitat(enal, L) && !fitsHabitat(enal, Ld) && !fitsHabitat(enal, aq) && paluWet(pa, 351, paluY(pa) + .1) && !paluWet(pa, 351, paluY(pa) - .1) && !paluWet(ev, 201, 309);
        pa.land = pa.land.filter(f => !LAND[f.type].filter); pa.animals.push({id:"pa-e", sp:"enal", q:90});
        const blockE = /Enaliarctos/.test(paluProblem(pa, false) || ""); pa.animals.pop();
        const m1 = state.money; setPalu(pa, false);
        out.paludariumDrains = blockE && !pa.palu && pa.wq === undefined && state.money > m1 && habitatScore(pa).delta === dry;
        state.exhibits = state.exhibits.filter(x => x !== pa);
      }
      const dfull = {id:"pd", type:"vdish", x:200, y:300, cap:6, food:{[ft]:6}};
      out.vivDishShowsFood = vivPropSvg(dfull, LAND.vdish).includes("<rect") && !vivPropSvg({...dfull, food:{}}, LAND.vdish).includes("<rect");

      // vivarium animals only: open exhibits take none of it
      const open = {id:"e-open", name:"Open", points:[[0,0],[40,0],[40,40],[0,40]], animals:[], happy:70, land:[]};
      out.vivFittingsOnlyInGlass = ["vdish", "vlamp", "vpool", "vbark"].every(k => !!vivToyProblem(open, k) && !!landProblem(open, k, 20, 20) && !!decorProblem(k, 0, 0)) && !JSON.stringify(BUILD_MENU.map(g => g.items.map(i => i.tool))).match(/land-v(dish|lamp|pool)/)
        && !thirsty(open, wantHeat) === !(likesOf(wantHeat).water >= HAB.wantsWater && habitatOf(open).wet === 0) && heatShare(open) === 1;
      const html = vivToysHtml(ev); out.vivFittingsPanel = html.includes("Food Dish") && html.includes("Basking Lamp") && html.includes("Pool") && html.includes("vivFitSel");
    }
    return out;
  }));

  // pixel editor (dev mode): strips open as frames, tools draw, the strip saves at full width, and "Try in park" swaps the picture
  const coelRig = require("fs").readFileSync(path.resolve(__dirname, "../tools/rigger/coelophysis/coelophysis-clips.json"), "utf8");
  Object.assign(checks, await page.evaluate(async require_coel => {
    const out = {}, was = SPRITE_PACK["sprites/dime-walk.png"];
    out.pixelBtnDevOnly = document.querySelector("#pixelBtn").hidden === !devMode();
    await openPixelEditor("sprites/dime-walk.png");
    out.pixelStripFrames = px.frames.length === 4 && px.fw === 100 && px.fh === 75 && pxGuess("sprites/human/keeper-walk.png", 64, 32) === 4 && pxGuess("sprites/bld/restroom-front.png", 80, 80) === 1;
    pxNew("sprites/smoke/test.png", 10, 8, 2); px.mirror = true; px.tool = "pencil"; px.c1 = [10, 20, 30, 255];
    px.stroke = {a:[1, 1], last:[1, 1], ink:px.c1, base:pxFrame().slice(), done:new Set()}; pxMoveTo(3, 1, {}); px.stroke = null; px.mirror = false;
    out.pixelPencilMirror = [1, 2, 3, 6, 7, 8].every(x => pxGet(pxFrame(), x, 1)[3] === 255) && pxGet(pxFrame(), 4, 1)[3] === 0;
    pxPush(); pxFill(pxFrame(), 0, 5, [1, 2, 3, 255], false); const filled = pxGet(pxFrame(), 9, 7)[0] === 1; pxUndo(false);
    out.pixelFillUndo = filled && pxGet(pxFrame(), 9, 7)[3] === 0;
    const im = await pxImg(pxPng()); out.pixelPngIsStrip = im.width === 20 && im.height === 8;
    // layers: every frame gets the new layer, the strip shows them stacked, a hidden one drops out, merge down and undo
    pxLayerOp("add"); pxPut(pxFrame(), 1, 1, [200, 0, 0, 255]);
    const stacked = px.frames.every(f => f.length === 2) && pxGet(pxCompData(0), 1, 1)[0] === 200;
    px.layers[1].show = false; const hid = pxGet(pxCompData(0), 1, 1).join() === "10,20,30,255"; px.layers[1].show = true;
    px.layers[1].alpha = .5; pxLayerOp("merge"); const merged = px.layers.length === 1 && pxGet(px.frames[0][0], 1, 1)[0] === 105; pxUndo(false);
    // the rigger: layers out as full-cell parts (empty ones skipped), and a rigger project back in as layers at their rest-pose places
    const rig = pxRigFile(), coel = JSON.parse(require_coel);
    await pxFromRigger(coel, "coel.json");
    out.pixelRigger = rig.nodes.length === 2 && rig.cell.w === 10 && Object.keys(rig.assets).length === 2 && px.layers.length === coel.nodes.length && px.fw === coel.cell.w && px.frames.length === 1
      && px.layers[0].name === coel.nodes[0].name && pxCompData(0).some((v, i) => i % 4 === 3 && v);
    pxUndo(false);
    // the reference: an upload fits inside the canvas whole on the bottom middle, and stays out of the picture
    const rc = document.createElement("canvas"); rc.width = 400; rc.height = 100; rc.getContext("2d").fillRect(0, 0, 400, 100);
    const pngNoRef = pxPng(); px.refUrl = rc.toDataURL(); await pxSetRef("upload"); const refB = pxRefBox();
    out.pixelReference = refB[2] === px.fw && Math.abs(refB[3] - px.fw / 4) < 1e-9 && refB[1] + refB[3] === px.fh && refB[0] === 0 && pxDraft().ref.path === "upload" && pxPng() === pngNoRef;
    await pxSetRef(""); px.refUrl = "";
    pxTool("pan"); out.pixelPanTool = pxPans({button:0}) && pxPans({button:1}) && pxCv.style.cursor === "grab" && !!document.querySelector('#dlgPixel [data-tool="pan"]'); pxTool("pencil");
    // the lasso snaps to pixels: a triangle's ring and inside, and copy and paste keep its shape
    const tri = pxLassoSel([[0, 0], [6, 0], [0, 6]]); let triN = 0; tri.mask.forEach(v => triN += v);
    px.sel = tri; pxCopy(false); const pasteBefore = px.undo.length; pxPaste();
    out.pixelLasso = tri.w === 7 && tri.h === 7 && triN === 28 && tri.mask[6] === 1 && tri.mask[7 * 6 + 6] === 0 && pxInSel(tri, 1, 1) && !pxInSel(tri, 6, 6) && !pxLassoSel([[2, 2]])
      && !!px.sel.mask && px.sel.buf.length === 7 * 7 * 4 && px.undo.length === pasteBefore + 1 && pxSig(2, 1, new Uint8ClampedArray([1, 2, 3, 255, 0, 0, 0, 0])) === pxSig(2, 1, new Uint8ClampedArray([1, 2, 3, 255, 9, 9, 9, 0]));
    px.sel = null; pxUndo(false);
    out.pixelLayers = stacked && hid && merged && px.layers.length === 2 && pxDraft().layers.length === 2;
    const before = spriteUrl("sprites/dime-walk.png"); px.path = "sprites/dime-walk.png"; pxTry();
    out.pixelTryInPark = SPRITE_PACK["sprites/dime-walk.png"] !== was && spriteUrl("sprites/dime-walk.png") !== before;
    const need = pxNeedArt()[0].id; pxNew(`sprites/${need}-walk.png`, 100, 75, 4); pxTry();
    out.pixelNewSpeciesTry = SPRITES[need].tried === 1 && SPRITES[need].walk === 4 && !!SPRITE_PACK[`sprites/${need}.png`] && pxNeedArt().some(x => x.id === need);
    delete SPRITES[need]; delete SPRITE_PACK[`sprites/${need}.png`]; delete SPRITE_PACK[`sprites/${need}-walk.png`]; try{ localStorage.removeItem(`genesis-pixel-d:sprites/${need}-walk.png`); localStorage.removeItem("genesis-pixel-drafts"); }catch{}
    // plants, buildings, props and rocks: each kind still missing a picture is listed, and Try gives it a stand-in entry with its own picture
    const nd = ["plant", "bld", "rock"].map(c => pxNeeds(c)), pk = nd[0][0], bk = nd[1].find(x => !BUILDINGS[x.opt.name].prop), rkk = nd[2][0], keep = JSON.stringify([PLANT_SPRITES[pk.opt.name], BLD_PICS[bk.opt.name], ROCK_SPRITES]);
    const tryOne = x => { pxNew(x.path, x.opt.w || PX_TEMPLATES[x.opt.tpl][1], x.opt.h || PX_TEMPLATES[x.opt.tpl][2], 1); pxPut(pxFrame(), 2, px.fh - 2, [9, 9, 9, 255]); pxTry(); };
    [pk, bk, rkk].forEach(tryOne);
    const [rt, rb] = rkk.opt.name.split("-");
    out.pixelNewLandAndBuildings = nd.every(l => l.length) && PLANT_SPRITES[pk.opt.name].tried === 1 && !!SPRITE_HIT[pk.opt.name] && BLD_PICS[bk.opt.name].tried === 1 && BLD_PICS[bk.opt.name].base === bk.opt.h - 9
      && ROCK_SPRITES[rb][rt].length === +rkk.opt.name.split("-")[2] && pxGuideFor("sprites/bld/restroom-left.png") === BLD_PICS.restroom.base;
    delete PLANT_SPRITES[pk.opt.name]; delete BLD_PICS[bk.opt.name]; ROCK_SPRITES[rb][rt].pop(); void keep;
    [pk, bk, rkk].forEach(x => { try{ localStorage.removeItem("genesis-pixel-d:" + x.path); }catch{} });
    spriteUrl.swap("sprites/dime-walk.png", was); px.path = ""; px.frames = []; try{ localStorage.removeItem("genesis-pixel-d:sprites/smoke/test.png"); localStorage.removeItem("genesis-pixel-last"); }catch{}
    document.querySelector("#dlgPixel").close();
    // pools: sea water costs more, pool animals want an open exhibit mostly under sea water (deep for deep ones, any water for fresh ones), room is water,
    // no plants, thirst, cover or escapes; they spawn in and swim only in their water; galleries stand on park ground and beat a platform's view
    {
      const keepEx = state.exhibits, keepB = state.buildings, m0 = state.money; state.money = 1e7;
      const pts = [[400, 400], [460, 400], [460, 450], [400, 450]], N = SPECIES_BY_ID.noth, M = SPECIES_BY_ID.mosa, R = SPECIES_BY_ID.rhiz;
      const pe = {id:"e-pooltest", name:"Pool test", points:pts, animals:[{id:"pn1", sp:"noth", q:90}, {id:"pn2", sp:"noth", q:90}], happy:70, cond:100, land:[], water:[], gate:[400, 425], barrier:"lagoon"};
      state.exhibits = [pe]; state.buildings = [];
      const fill = (kind, x1 = 460) => { pe.water = []; for(let x = 400; x < x1; x += 5) for(let y = 400; y < 450; y += 5) for(const q of waterClip(pe, [x, y, x + 5, y + 5])) layWater(pe, rectPtsOf(q), kind); };
      const iss = re => exhibitReport(pe).issues.some(i => re.test(i.text));
      // the lagoon wall: the only fence that holds sea water and pool animals, with its pictures; never offered as advice, and laid only with pools on
      const box = rectPtsOf([405, 405, 415, 415]), wasBar = pe.barrier;
      const lagoonOk = waterProblem(box, pe, null, 0, true, "sea") === null && !fitsHabitat(N, pe) && crateProblem({sp:"noth"}, pe) === "No water for it."; pe.barrier = "bars";
      const barsNo = waterProblem(box, pe, null, 0, true, "sea") === "Only a lagoon wall holds sea water." && waterProblem(box, pe, null, 0, true) === null && !fitsHabitat(N, pe) && crateProblem({sp:"noth"}, pe) === "Needs a lagoon wall." && iss(/Nothosaurus needs a lagoon wall/)
        && waterProblem(rectPtsOf([600, 600, 610, 610]), null, null, 0, true, "deep") === "Only a lagoon wall holds sea water.";
      pe.barrier = wasBar;
      const Pk = fencePieces(), keepP = {...Pk}, sq = [[500, 500], [520, 500], [520, 520], [500, 520]], ge = {id:"e-lagoongrid", name:"Lagoon grid", grid:true, points:sq, animals:[], water:[{id:"w-lg", kind:"sea", points:rectPtsOf([505, 505, 515, 515])}]};
      const ring = sq.flatMap((p, i) => pieceLine(p, sq[(i + 1) % 4]).keys);
      for(const k of ring) Pk[k] = mkPiece("lagoon");
      state.exhibits = [pe, ge];
      const gridOk = lagoonWalled(ge), swapNo = /needs its lagoon wall/.test(seaWallProblem({[ring[0]]:mkPiece("bars")}) || "") && seaWallProblem({[ring[0]]:mkPiece("lagoon")}) === null;
      Pk[ring[1]] = mkPiece("concrete"); const mixedNo = !lagoonWalled(ge);
      for(const k in Pk) delete Pk[k]; Object.assign(Pk, keepP); state.exhibits = [pe];
      out.lagoonWall = lagoonOk && barsNo && gridOk && swapNo && mixedNo && BARRIERS.lagoon.pool && FENCE_SPRITES.lagoon && FENCE34.lagoon.sprite === "lagoon" && FENCE_EDGE.lagoon
        && ["pristine", "degrading", "broken", "gate", "gate-s", "gate-e", "gate-w"].every(k => SPRITE_PACK[`sprites/fence/lagoon-${k}.png`])
        && !/lagoon/i.test(barrierNeeded(M)) && (devMode() || /aren't open yet/.test(planPieces(pieceLine([700, 700], [710, 700]).keys, "lagoon").why || ""));
      out.seaWaterPrices = waterRate("sea") === WATER.perSqM * SEA_WATER.sea.price && waterRate("deep") === WATER.perSqM * SEA_WATER.deep.price && waterRate(undefined) === WATER.perSqM
        && SEA_WATER.deep.price > SEA_WATER.sea.price && WATER_TEX.sea && WATER_TEX.deep && WATER_TILES.sea && WATER_TILES.deep && (devMode() === waterTypes().includes("sea"));
      out.poolOnlyOpen = !fitsHabitat(N, {viv:"L", aqua:true, points:[]}) && !biomesOf(N) && SPECIES.filter(x => x.pool).every(x => !x.viv && TIME_SITES.some(t => (t.fauna || []).includes(x.id)) && SPECIES_INFO[x.id]);
      const dryT = exhibitReport(pe).target, dryFlag = iss(/No sea water: Nothosaurus/);
      fill(undefined); const freshN = poolFit(pe, N).fit, freshR = poolFit(pe, R).fit;
      fill("sea"); const seaT = exhibitReport(pe).target;
      out.poolNeedsSea = dryFlag && fitsHabitat(N, pe) && freshN === 0 && freshR === 1 && poolFit(pe, N).fit === 1 && seaT > dryT + 30 && iss(/Open water to swim in/) && !iss(/plants from another era|No water|Wrong biome/);
      out.poolAnimalsNeedNothingElse = !thirsty(pe, N) && escapeRisk(pe, N) === null && coverOf(pe).need === 0 && wantsOf(pe, N).plants === 0 && wantsOf(pe, N).rock === 0 && /marine/.test(dietText(N));
      pe.animals = [{id:"pm1", sp:"mosa", q:90}, {id:"pm2", sp:"mosa", q:90}];
      const shallow = iss(/Too shallow: Mosasaurus/), cramped = iss(/Cramped: .* of water for/);
      fill("sea"); for(let x = 430; x < 460; x += 5) for(let y = 400; y < 450; y += 5) for(const q of waterClip(pe, [x, y, x + 5, y + 5])) layWater(pe, rectPtsOf(q), "deep");
      out.poolDeepAndRoom = shallow && cramped && poolFit(pe, M).deep === 1 && !iss(/Too shallow/) && exhibitReport(pe).wetNeed === M.space * 2 && Math.abs(exhibitReport(pe).wet - poolM2(pe, M)) < 1e-6;
      const before = state.money, r = cutWaterAll([440, 400, 445, 405]);
      out.seaWaterRefund = r.m2 > 0 && state.money - before === Math.round(r.m2 * waterRate("deep") * COST.refundShare);
      // drawn and swimming: they start in their water and never leave it
      render();
      const hs = [...herd.values()].filter(h => h.exhibitId === pe.id);
      let wet = hs.length === 2 && hs.every(h => h.pool && h.el.querySelector(".dive") && poolSpot(h, pe, [h.x, h.y]));
      for(const h of hs) h.act = null;   // a resting animal stays up at the surface
      let dove = 0;
      for(let i = 0; i < 400 && wet; i++) for(const h of hs){ poolSwim(h, pe, .1); dove = Math.max(dove, h.dive || 0); if(!poolSpot(h, pe, [h.x, h.y])) wet = false; }
      out.poolSwimStaysWet = wet && dove > .2;
      // galleries: on park ground beside the pool, a better view than a platform
      const gb = {id:"b-galtest", type:"gallery", exhibitId:pe.id, points:rectPts(430, 454.4, 16, 8, 0), face:2}, pb = {id:"b-plattest", type:"platform", exhibitId:pe.id, points:rectPts(430, 446, 14, 7, 0), inward:true};
      state.buildings = [pb]; const platV = viewFactor(pe, {[pb.id]:true}); state.buildings = [pb, gb]; const bothV = viewFactor(pe, {[pb.id]:true, [gb.id]:true});
      out.galleryView = isPool(pe) && !isPool({points:pts, water:[], animals:[]}) && parkGround(gb) && !parkGround(pb) && bothV > platV && Math.abs(bothV / Math.max(1, barrierOf(pe).view) - GALLERY.view) < 1e-9
        && buildingHidden("gallery") === !devMode() && STAND34.gallery && building34(gb, BUILDINGS.gallery, false, false, true, 1).includes("GALLERY");
      // crates: boxing is instant and leaves a crate standing where the animal was, scaled to its size; it keeps the animal whole, moves only to free ground, opens only where it fits;
      // stranded pool animals and a bulldozed exhibit's pool animals are crated, its other animals get out
      {
        const keepC = state.crates; state.crates = [];
        const a0 = pe.animals[0]; a0.sick = {kind:"infection", name:"pneumonia", sev:10}; a0.q = 77;
        const r = crateAnimal(pe, a0), land = {id:"e-cland", name:"Land", points:[[300, 300], [340, 300], [340, 340], [300, 340]], animals:[], land:[], water:[]};
        state.exhibits.push(land);
        const boxed = !!r && !pe.animals.includes(a0) && crates()[0] === r && r.q === 77 && r.sick && r.name === a0.name && typeof r.x === "number";
        const sizes = SPECIES.map(x => crateScale(x.id)), scaled = sizes.every(v => v >= CRATE.min && v <= CRATE.max) && Math.max(...sizes) > Math.min(...sizes);
        const refuse = crateProblem(r, land) === "Needs a lagoon wall." && crateProblem(r, {viv:"S", points:[]}) === "Too big for a case." && crateProblem(r, null) === "Tap an exhibit." && !!uncrate(r.id, land) && crates().length === 1;
        // free ground only: a building under a crate, another crate beside it, and moving one
        const q0 = ownedRects()[0], rc = dropCrate({id:"cr-1", sp:r.sp, q:90, sex:"female"}, (q0[0] + q0[2]) / 2, (q0[1] + q0[3]) / 2), standsFree = !crateSpotProblem(rc.x, rc.y, rc.sp, rc);
        const bz = {id:"b-crbz", type:"bin", points:rectPts(rc.x - 3, rc.y - 3, 6, 6, 0)}; state.buildings.push(bz);
        const onBuilding = /building/.test(crateSpotProblem(rc.x, rc.y, rc.sp) || ""); state.buildings.pop();
        const r2 = dropCrate({id:"cr-2", sp:r.sp, q:90, sex:"male"}, rc.x, rc.y);
        const apart = (r2.x !== rc.x || r2.y !== rc.y) && !crateSpotProblem(r2.x, r2.y, r2.sp, r2) && /crate/.test(crateSpotProblem(rc.x, rc.y, rc.sp) || "");
        const keepX = r2.x, bad = moveCrate(r2.id, rc.x, rc.y), [fx, fy] = crateSpotNear(rc.x + 15, rc.y, r2.sp, r2);
        const moved = !!bad && r2.x === keepX && moveCrate(r2.id, fx, fy) === null && r2.x === fx && r2.y === fy;
        crates().splice(crates().indexOf(r2), 1); crates().splice(crates().indexOf(rc), 1);
        const back = uncrate(r.id, pe) === null && pe.animals.some(x => x.id === a0.id && x.q === 77 && x.sick) && !crates().length;
        crateAnimal(pe, pe.animals.find(x => x.id === a0.id));
        const sold = sellCrate(a0.id) === Math.round(M.price * COST.animalResale) && !crates().length;
        pe.barrier = "bars"; const n0 = pe.animals.length, stranded = crateStranded() === n0 && !pe.animals.length && crates().length === n0; pe.barrier = "lagoon";
        state.crates = []; land.animals = [{id:"cl1", sp:SPECIES.find(x => !x.viv && !x.pool).id, q:90}]; const m1 = state.money;
        const loose0 = state.safety.loose.length; removeItem("exhibit", land);
        const gotOut = !crates().length && state.safety.loose.length === loose0 + 1 && state.safety.loose.at(-1).id === "cl1" && !state.exhibits.includes(land) && state.money >= m1;
        state.safety.loose.pop();
        const wet = {id:"e-cwet", name:"Wet", points:[[300, 300], [340, 300], [340, 340], [300, 340]], animals:[{id:"cl2", sp:M.id, q:90}], land:[], water:[]};
        state.exhibits.push(wet); removeItem("exhibit", wet);
        const bulldozed = gotOut && crates().length === 1 && crates()[0].id === "cl2" && state.safety.loose.length === loose0;
        // drawn standing in the park, tappable, with its own panel; carried with the ghost
        const c3 = crates()[0]; render(); select("crate", c3.id); ui.panel();
        const shown = world.innerHTML.includes('data-kind="crate" data-id="cl2"') && /data-action="crateTool"/.test(panelEl.innerHTML) && /data-action="crateSell"/.test(panelEl.innerHTML) && !document.querySelector("#crateBtn");
        const ghost = crateGhostSvg({x:10, y:10, e:pe, r:c3, open:false, why:null}).includes("sprites/crate.png") && !!SPRITE_PACK["sprites/crate.png"];
        out.crates = boxed && scaled && refuse && standsFree && onBuilding && apart && moved && back && sold && stranded && bulldozed && shown && ghost;
        select(null); state.crates = keepC; ui.hud(true);
      }
      state.exhibits = keepEx; state.buildings = keepB; state.money = m0; render();
    }
    // turning dev mode on shows Pixels straight away, with no reload, even where storage is blocked
    openParkOffice("menu");   // the version label lives at the foot of the Main Menu
    const wasDev = devMode(), tap = () => { for(let i = 0; i < 5; i++) document.querySelector("#verLabel").click(); };
    if(wasDev) tap(); tap(); const shown = !document.querySelector("#pixelBtn").hidden && devMode(); tap();
    out.pixelBtnNoReload = shown && document.querySelector("#pixelBtn").hidden && !devMode();
    devFlag = null; try{ if(wasDev) localStorage.setItem("genesis-dev", "1"); }catch{}
    return out;
  }, coelRig));

  await page.waitForTimeout(800);
  let ok = true;
  // Quiet by default (only failures and a count); -v prints every check.
  const verbose = process.argv.includes("-v"), all = Object.entries(checks);
  for(const [k, v] of all){ if(verbose || !v) console.log(`${v ? "PASS" : "FAIL"} ${k}`); ok = ok && v; }
  console.log(`${all.filter(([, v]) => v).length}/${all.length} checks passed.`);
  if(errors.length){ ok = false; console.log("Page errors:\n  " + errors.join("\n  ")); }
  console.log(ok ? "All checks passed." : "Some checks failed.");
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
