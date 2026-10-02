/* =====================================================================
   GUEST SERVICES
   What food stands and gift shops sell (each one is an empty shell until
   you give it a menu), benches and picnic areas, trash bins and litter,
   restroom dirt, and the night cleaning crew who tidy up after closing.
   ===================================================================== */

let litterPts = new Map();   // litter square -> spots along the footpaths inside it, for drawing specks
let binSpots = [];           // bins guests can reach, with where they stand: [{b, x, y}]

const isVendor = b => !!BUILDINGS[b.type].kind;
const menuOf = b => b.menu || [];
const menuItem = (b, id) => menuOf(b).find(m => m.id === id) || null;

// The needs a building takes care of. A stand's come from its menu; a gift shop with anything to sell serves shoppers.
function servesOf(b){
  const t = BUILDINGS[b.type];
  if(!t.kind) return t.serves || [];
  const out = new Set();
  if(t.kind === "merch"){ if(menuOf(b).length) out.add("shop"); }
  else for(const m of menuOf(b)) for(const k of Object.keys(MENU[m.id].fills || {})) out.add(k);
  if(t.seats) out.add("energy");
  return [...out];
}

/* ---------- menus ---------- */

// The menu a stand or shop from before menus existed gets
const OLD_MENUS = {food:["burger", "soda"], shop:["plush", "tshirt", "map"]};
function addToMenu(b, id){
  const t = BUILDINGS[b.type], m = MENU[id];
  if(!t.kind || !m || m.kind !== t.kind) return "That isn't sold here.";
  if(menuItem(b, id)) return "It's already on the menu.";
  if(menuOf(b).length >= t.menuSlots) return `${t.label}s have room for ${t.menuSlots} item${t.menuSlots === 1 ? "" : "s"}. Take one off first.`;
  b.menu = menuOf(b).concat([{id, price:m.price}]);
  return null;
}
function dropFromMenu(b, id){ b.menu = menuOf(b).filter(m => m.id !== id); }
function setMenuPrice(b, id, price){ const m = menuItem(b, id); if(m) m.price = clamp(Math.round(price), 1, MENU[id].price * 4); }
// Share of guests who'll pay this price: everyone at the usual price or less, nobody at double
const willPay = (id, price) => clamp(1 - PRICE_SENSE * (price - MENU[id].price) / MENU[id].price, 0, 1);

/* ---------- being served ---------- */

// A party gets to the front of the line. Returns what it spent.
function serveAt(p, b, why){
  const t = BUILDINGS[b.type], n = p.n;
  let bill = 0, served = n;
  if(t.kind === "food"){
    // each need that's bad enough gets the best thing on the menu for it, if the price is right
    for(const need of ["hunger", "thirst", "energy"]){
      if(p.needs[need] < 25 && need !== why) continue;
      let best = null;
      for(const m of menuOf(b)){
        const f = (MENU[m.id].fills || {})[need]; if(!f) continue;
        const score = f * willPay(m.id, m.price);
        if(!best || score > best.score) best = {m, f, score, will:willPay(m.id, m.price)};
      }
      if(!best) continue;
      if(best.will < .6) thinks(p, "priceyFood");
      if(Math.random() > best.will || p.cash - bill < best.m.price * n) continue;
      buy(p, b, best.m, n); bill += best.m.price * n;
    }
    if(bill && !p.needs.hunger) thinks(p, "fed");
    served = bill ? n : 0;
  } else if(t.kind === "merch"){
    // each guest might pick something: happier guests buy more
    served = 0;
    const keen = clamp((p.mood - 30) / 60, .15, .9), menu = menuOf(b);
    for(let i = 0; i < n && menu.length; i++){
      const m = menu[Math.floor(Math.random() * menu.length)], will = willPay(m.id, m.price);
      if(will < .6) thinks(p, "priceyGift");
      if(Math.random() < keen * will && p.cash - bill >= m.price){ buy(p, b, m, 1); bill += m.price; served++; }
    }
  } else if(b.type === "restroom"){
    p.needs.bladder = 0;
    if((b.dirt || 0) >= RESTROOM.gross){ thinks(p, "grossLoo"); p.mood -= 6; }
    b.dirt = Math.min(100, (b.dirt || 0) + RESTROOM.dirtPerGuest * n);
  }
  if(t.seats && (why === "energy" || t.kind)){ p.needs.energy = 0; if(why === "energy") thinks(p, "rested"); }
  if(t.kind && !bill && why !== "shop" && why !== "energy"){ thinks(p, "broke"); p.mood -= 6; p.cool.hunger = p.cool.thirst = state.minute + 120; }
  if(!b.served || b.served.day !== state.day) b.served = {day:state.day, n:0, money:0, items:{}};
  b.served.n += served;
  return bill;
}
// Hand over one item to each of n guests: they pay, you pay for the stock, and they may be left holding a wrapper
function buy(p, b, m, n){
  const it = MENU[m.id];
  p.cash -= m.price * n;
  earn(m.price * n, it.kind === "food" ? "food" : "shop");
  spend(it.cost * n, "supplies");
  for(const [k, v] of Object.entries(it.fills || {})) p.needs[k] = Math.max(0, p.needs[k] - v);
  if(it.joy) p.mood += it.joy;
  if(m.id === "map") p.map = true;
  if(it.litter){ p.trash = (p.trash || 0) + n; p.trashAt = state.minute; }
  if(it.kind === "food") state.today.servedFood += n; else state.today.servedShop += n;
  if(!b.served || b.served.day !== state.day) b.served = {day:state.day, n:0, money:0, items:{}};
  b.served.money += m.price * n;
  b.served.items[m.id] = (b.served.items[m.id] || 0) + n;
}

/* ---------- litter and bins ---------- */

const litterKey = (x, y) => Math.floor(x / LITTER.cell) + ":" + Math.floor(y / LITTER.cell);
const litterAt = (x, y) => state.litter[litterKey(x, y)] || 0;
function addLitter(x, y, n){ const k = litterKey(x, y); state.litter[k] = (state.litter[k] || 0) + n; }
function nearBin(x, y){
  let best = null, bd = LITTER.binReach;
  for(const s of binSpots){ const d = Math.hypot(s.x - x, s.y - y); if(d < bd){ bd = d; best = s.b; } }
  return best;
}
// At each corner a party holding trash looks for a bin. After a while some give up and drop it.
function trashCheck(p){
  if(!p.trash || !p.at) return;
  const b = nearBin(p.at.x, p.at.y);
  if(b){
    const room = Math.max(0, LITTER.binCap - (b.fill || 0)), put = Math.min(room, p.trash);
    b.fill = (b.fill || 0) + put;
    // a full bin overflows onto the ground beside it
    if(p.trash > put){ const [bx, by] = centroid(b.points); addLitter(bx, by, p.trash - put); }
    p.trash = 0; return;
  }
  if(state.minute - p.trashAt < LITTER.holdMin) return;
  if(Math.random() < LITTER.drop + LITTER.dirtyDrop * litterAt(p.at.x, p.at.y)){ addLitter(p.at.x, p.at.y, p.trash); p.trash = 0; }
  else p.trashAt = state.minute;
}
// Where along the footpaths each litter square's specks go. Called when the guest map is rebuilt.
function indexLitterSpots(nodes){
  binSpots = state.buildings.filter(b => b.type === "bin" && isReachable(b)).map(b => { const [x, y] = centroid(b.points); return {b, x, y}; });
  litterPts = new Map();
  for(const n of nodes.values()) for(const m of n.adj.keys()){
    if(m.k < n.k) continue;
    const L = Math.hypot(m.x - n.x, m.y - n.y);
    for(let s = 1; s < L; s += 1.5){
      const x = n.x + (m.x - n.x) * s / L, y = n.y + (m.y - n.y) * s / L, k = litterKey(x, y);
      if(!litterPts.has(k)) litterPts.set(k, []);
      litterPts.get(k).push([x, y, (m.y - n.y) / L, -(m.x - n.x) / L]);
    }
  }
}
// Specks to draw: a few spots in each square with litter, picked the same way every time so they don't jump around
function litterSpecks(){
  const out = [];
  for(const [k, n] of Object.entries(state.litter)){
    const pts = litterPts.get(k); if(!pts || n < 1) continue;
    let h = 0; for(const c of k) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    for(let i = 0; i < Math.min(14, Math.ceil(n)); i++){
      h = (h * 1103515245 + 12345) >>> 0;
      const [x, y, nx, ny] = pts[h % pts.length], side = ((h >> 8) % 300) / 100 - 1.5;
      out.push([x + nx * side, y + ny * side, h % 3]);
    }
  }
  return out;
}
const litterTotal = () => Object.values(state.litter).reduce((s, n) => s + n, 0);

/* ---------- the night cleaning crew ---------- */

// What tonight's cleaning will cost: litter on the paths, full bins, and dirty restrooms
function cleaningBill(){
  let bill = litterTotal() * LITTER.nightCost;
  for(const b of state.buildings){
    if(b.type === "bin") bill += (b.fill || 0) * LITTER.binNightCost;
    if(b.type === "restroom") bill += (b.dirt || 0) * RESTROOM.nightCost;
  }
  return Math.round(bill);
}
// After closing, contract cleaners pick up the litter, empty the bins, and scrub the restrooms
function servicesNight(){
  const bill = cleaningBill();
  if(bill) spend(bill, "cleaning");
  state.litter = {};
  for(const b of state.buildings){ if(b.type === "bin") b.fill = 0; if(b.type === "restroom") b.dirt = 0; }
}
