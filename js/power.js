/* =====================================================================
   POWER
   Generators power electrified fences across the whole park.
   When there isn't enough, the fences holding the strongest animals
   get power first. An unpowered electric fence is barely a fence.
   ===================================================================== */

let powerShortNotified = -1;   // the day we last warned about a shortage

const generators = () => state.buildings.filter(b => b.type === "generator");
const genOnline = b => condOf(b) >= POWER.offlineBelow;
function powerSupply(){ return generators().filter(genOnline).reduce((s, b) => s + BUILDINGS.generator.power, 0); }
function fenceDraw(e){ return e.barrier === "electric" && !e.viv ? perimeter(e.points) * POWER.perMeter : 0; }
function powerDemand(){ return state.exhibits.reduce((s, e) => s + fenceDraw(e), 0); }

// Decide which electric fences get power. Called whenever the park's numbers are reworked.
function updatePower(){
  let left = powerSupply();
  const fences = state.exhibits.filter(e => fenceDraw(e) > 0);
  // strongest animals first
  const pull = e => Math.max(0, ...e.animals.map(a => escapeStrength(SPECIES_BY_ID[a.sp])));
  fences.sort((a, b) => pull(b) - pull(a));
  let cut = 0;
  for(const e of fences){ const d = fenceDraw(e); e.powered = left >= d; if(e.powered) left -= d; else cut++; }
  for(const e of state.exhibits) if(e.barrier !== "electric") delete e.powered;
  if(cut && state.minute > OPEN_MIN && powerShortNotified !== state.day){
    powerShortNotified = state.day;
    events.toast(`Power shortage: ${cut} electrified fence${cut === 1 ? " has" : "s have"} no power. Build or repair generators.`, "bad");
  }
}

// The fence's full strength right now, before wear: electric fences without power are weak
function baseStrength(e){
  return e.barrier === "electric" && e.powered === false ? POWER.unpoweredStrength : barrierOf(e).strength;
}
