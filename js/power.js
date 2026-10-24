/* =====================================================================
   POWER
   Generators power electrified fences and aquarium filters across the whole park.
   When there isn't enough, the fences holding the strongest animals
   get power first. An unpowered electric fence is barely a fence.
   ===================================================================== */

let powerShortNotified = -1;   // the day we last warned about a shortage

const generators = () => state.buildings.filter(b => b.type === "generator");
const genOnline = b => condOf(b) >= POWER.offlineBelow;
function powerSupply(){ return generators().filter(genOnline).reduce((s, b) => s + BUILDINGS.generator.power, 0); }
function fenceDraw(e){ return e.barrier === "electric" && !e.viv ? perimeter(e.points) * POWER.perMeter : 0; }
const coldStores = () => state.buildings.filter(b => storeOf(b) && storeOf(b).cold);
function powerDemand(){ return state.exhibits.reduce((s, e) => s + fenceDraw(e) + filterKw(e), 0) + coldStores().length * LOGI.coldPower; }

// Decide which electric fences and aquarium filters get power. Called whenever the park's numbers are reworked.
function updatePower(){
  let left = powerSupply();
  const fences = state.exhibits.filter(e => fenceDraw(e) > 0);
  // strongest animals first
  const pull = e => Math.max(0, ...e.animals.map(a => escapeStrength(SPECIES_BY_ID[a.sp])));
  fences.sort((a, b) => pull(b) - pull(a));
  let cut = 0, dry = 0;
  for(const e of fences){ const d = fenceDraw(e); e.powered = left >= d; if(e.powered) left -= d; else cut++; }
  for(const e of state.exhibits) if(e.barrier !== "electric") delete e.powered;
  // aquarium and paludarium filters come next, the biggest loads first; an unpowered filter cleans nothing
  for(const e of state.exhibits.filter(wetCase).sort((a, b) => aquaLoad(b) - aquaLoad(a))){ const d = filterKw(e); e.filterPowered = left >= d; if(e.filterPowered) left -= d; else if(e.animals.length) dry++; }
  // cold stores come after fences; without power they only keep food like a plain store
  for(const b of coldStores()){ b.powered = left >= LOGI.coldPower; if(b.powered) left -= LOGI.coldPower; }
  if((cut || dry) && state.minute > 0 && powerShortNotified !== state.day){
    powerShortNotified = state.day;
    const what = [cut ? `${cut} electrified fence${cut === 1 ? "" : "s"}` : "", dry ? `${dry} aquarium${dry === 1 ? "'s" : "s'"} filters` : ""].filter(Boolean).join(" and ");
    events.toast(`Power shortage: ${what} without power. Build or repair generators.`, "bad");
  }
}

// The fence's full strength right now, before wear: electric fences without power are weak
function baseStrength(e){
  return e.barrier === "electric" && e.powered === false ? POWER.unpoweredStrength : barrierOf(e).strength;
}
