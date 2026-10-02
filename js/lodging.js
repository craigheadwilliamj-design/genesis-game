/* =====================================================================
   LODGING
   Bigger parks can build hotels. Each night, some of the day's guests
   book a room, depending on the stars, the room rate, and how clean the
   hotel is. They pay for the room, and next morning they start the day
   at the hotel with no ticket to buy. Rooms use toiletries, which
   custodians bring in, and get dirty, which custodians clean.
   ===================================================================== */

const isHotel = b => !!BUILDINGS[b.type].rooms;
const hotels = () => state.buildings.filter(b => isHotel(b) && isReachable(b));
const roomRate = b => b.rate ?? BUILDINGS[b.type].roomPrice;
// Share of guests who'll pay this rate: everyone at the usual price or less, nobody at double
const roomWill = b => clamp(1 - PRICE_SENSE * (roomRate(b) - BUILDINGS[b.type].roomPrice) / BUILDINGS[b.type].roomPrice, 0, 1);
const hotelClean = b => 1 - LODGING.dirtyCut * (b.dirt || 0) / 100;
const lastGuests = () => state.history.length ? state.history[state.history.length - 1].guests : 0;
function freshLodging(){ return {stays:[], last:{booked:0, guests:0, money:0}}; }

// Why this hotel can't be built yet, or null
function hotelLocked(type){
  const t = BUILDINGS[type];
  if(t.minRating && state.rating < t.minRating) return `Your park needs ${t.minRating} stars first.`;
  if(t.minGuests && lastGuests() < t.minGuests) return `Your park needs ${t.minGuests} guests a day first. Yesterday had ${lastGuests()}.`;
  return null;
}
// Toiletries on hand for this many rooms. Before stock is physical, suppliers bring them.
const roomsStocked = b => guestGoodsFree() ? Infinity : Math.floor(stockOf(b, "merch") / LODGING.toiletries);

// After closing: guests book rooms for tonight, the best-looking hotels first
function lodgingNight(){
  const L = state.lodging;
  let want = state.today.guests * LODGING.stayShare * state.rating / 5;
  const hs = hotels().sort((a, b) => roomWill(b) * hotelClean(b) - roomWill(a) * hotelClean(a));
  L.stays = []; L.last = {booked:0, guests:0, money:0};
  for(const b of hs){
    const t = BUILDINGS[b.type];
    const rooms = Math.min(t.rooms, roomsStocked(b), Math.floor(want * roomWill(b) * hotelClean(b) / LODGING.perRoom));
    b.booked = {day:state.day, rooms:Math.max(0, rooms), money:Math.max(0, rooms) * roomRate(b)};
    if(rooms <= 0) continue;
    want -= rooms * LODGING.perRoom;
    const units = rooms * LODGING.toiletries;
    if(guestGoodsFree()) spend(units * GUEST_GOOD_PRICE, "supplies"); else takeGood(b, "merch", units);
    state.logi.used.merch = (state.logi.used.merch || 0) + units;
    earn(rooms * roomRate(b), "rooms");
    b.dirt = Math.min(100, (b.dirt || 0) + LODGING.dirtPerNight * rooms / t.rooms);
    L.stays.push({hotel:b.id, n:rooms * LODGING.perRoom});
    L.last.booked += rooms; L.last.guests += rooms * LODGING.perRoom; L.last.money += rooms * roomRate(b);
  }
}
// Morning: last night's hotel guests come out and start their day. They bought their pass with the room.
function hotelGuestsArrive(){
  const L = state.lodging;
  if(!L.stays.length || !gGraph) return;
  for(const s of L.stays){
    const b = buildingById(s.hotel), at = b && gGraph.anchors[b.id];
    if(!at) continue;
    state.today.guests += s.n;
    for(let left = s.n; left > 0; left -= LODGING.perRoom){
      const n = Math.min(LODGING.perRoom, left), p = newParty(n);
      if(p.thought.delete("pricey")) p.mood += 8;   // their pass came with the room
      p.at = at; p.hotel = b.id; p.cash *= LODGING.cashBoost; p.until = Math.min(CLOSE_MIN, p.until + LODGING.stayBoost);
      if(parties.length < GUEST.maxParties) parties.push(p);
    }
  }
  L.stays = [];
}
