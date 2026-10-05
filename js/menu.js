/* =====================================================================
   MENU
   The build sidebar: a tab on the left that opens into groups, each
   with its own dropdown of tools. Prices come from the data, so a
   balance change in data.js shows up here by itself.
   ===================================================================== */

// What each group holds. {tool} picks a tool, {sub} opens a dropdown of tools, {fence} picks a fence.
const HABITAT_PROPS = ["burrow", "cavesm", "cavelg", "canopysm", "canopylg", "shelter", "barn", "traysm", "traymd", "traylg", "post", "logs", "wallow", "ball", "icefish", "icefruit", "shank", "buglog", "hay", "pbale"];
const BUILD_MENU = [
  {id:"paths", label:"Path Tools", items:[
    {label:"Guest Paths", tool:"path", price:() => `${money(COST.pathPerMeter)}/m`},
    {label:"Wide Paths", tool:"wide", price:() => `${money(WIDE_PATH.perMeter)}/m`, note:"10 m wide. Holds twice the crowd before guests feel packed. Use it where the walk is busy."},
    {label:"Wooden Bridges", tool:"bridge", price:() => `${money(BRIDGE.perMeter)}/m`, note:"The only path that crosses water. Draw it like a path, from one bank over to the other."},
    {label:"Staff Paths", tool:"service", price:() => `${money(SERVICE_ROAD.perMeter)}/m`, note:"Staff paths always layer under guest paths where they meet."},
    {label:"Tram Track", tool:"tram", tech:"transit", price:() => `${money(TRAM.perMeter)}/m`, note:"Guests ride it between tram stations, six times faster than walking. Draw it beside your paths and put a station at each stop."},
    {label:"Bins", tool:"bin"},
    {label:"Benches", tool:"bench"},
    {label:"Picnic Areas", tool:"picnic"},
    {label:"Lamp Posts", tool:"lamp"},
    {label:"Security Cameras", tool:"camera", tech:"cameras", note:"Watches the paths within a short radius and sends the nearest guard to any vandal it sees. Needs a Security Office with guards."},
    {label:"Info Signs", tool:"sign"},
    {label:"Do Not Feed Signs", tool:"nofeed", note:"Guests are less likely to throw trash into an exhibit with one beside its fence. Put it on the path within 20 m of the fence."},
  ]},
  {id:"land-buy", label:"Land", items:[
    {label:"Buy Land", tool:"parcels", price:() => `from ${money(Math.min(...PARCEL_CELLS.filter(([i, j]) => !parcelHome(i, j)).map(([i, j]) => parcelPrice(i, j))))}`, note:"Buy the plots around your park to build further out. Each costs a daily property tax."},
  ]},
  {id:"exhibits", label:"Exhibit Tools", items:[
    {label:"Vivariums", sub:["vivS", "vivM", "vivL"]},
    {label:"Gates", tool:"gate", price:() => money(GATE_COST)},
    {label:"Viewing Platforms", tool:"platform"},
    {label:"Habitat Props", props:HABITAT_PROPS, note:"Place these inside an open exhibit. Barns, caves and burrows cover animals from heat waves, cold snaps and storms. Canopies cover them from heat and storms, but not the cold. Keepers walk in to fill food trays, which each hold one kind of food. Rubbing posts, log piles and mud wallows give bored animals something to do."},
    {label:"Fence Types", fences:true, note:"Pick a fence, then tap corners on the map. Close it on the first corner to make an exhibit, then give it a keeper gate. Or tap the last corner again to leave it open, like a hedge row along a path. Hedges are weak, but guests love them."},
  ]},
  {id:"land", label:"Landscaping", items:[
    {label:"Water", tool:"water", price:() => `${money(WATER.perSqM)}/m²`, note:"Draw it like a fence: tap the shore corners, then the first one again. Inside an exhibit it's for the animals. Out in the park guests enjoy it, and only wooden bridges cross it."},
    ...Object.entries(LAND).filter(([k, t]) => !t.period && !t.statue && !t.vivToy && !HABITAT_PROPS.includes(k)).map(([k, t], i, all) => ({label:t.label, tool:"land-" + k, tech:t.tech, price:() => money(t.price),
      note:i === all.length - 1 ? "Inside an open exhibit, animals like water and rocks, and fish eaters need water. Out in the park, rocks dress up the paths." : undefined})),
    {label:"Park Plants", parkPlants:true, note:"Modern plants grow anywhere: in gardens along the paths, where guests enjoy them, or in an exhibit of their biome, where they count as Quaternary plants. Mangroves, cattails and cypress knees can stand in water, and water lilies only grow in it."},
    {label:"Statues", statues:true, note:"Bronze on a stone plinth that matches the theme around it. Place them anywhere outside the exhibits. Guests stop to look, and learn a lot from the people's plaques. Grants unlock more."},
    ...Object.keys(PLANTS_OF).map(period => ({label:period + " plants", period, note:period === "Devonian" ? "Every period has its own small, medium and large plants for each biome that existed then, and animals only count plants from their exhibit's own biome. Others make them unhappy. Groves from an animal's own era feed and shelter it. Every Mesozoic and Paleozoic plant uses a plant of its size grown at CERES. Out in the park, only Quaternary plants grow until ORACLE researches sterile prehistoric plants." : undefined})),
  ]},
  {id:"guest", label:"Guest Buildings", items:[
    {label:"Restroom", tool:"restroom"},
    {label:"Dining", sub:["kiosk", "food", "restaurant"]},
    {label:"Retail", sub:["cart", "shop", "megastore"]},
    {label:"Hotels", sub:["campground", "lodge", "resort"]},
    {label:"Education Center", tool:"edcenter"},
    {label:"Tram Station", tool:"tramstop"},
  ]},
  {id:"staff", label:"Staff Buildings", items:[
    {label:"Keeper Hut", tool:"station"},
    {label:"Break Room", tool:"breakroom"},
    {label:"Workshop", tool:"workshop"},
    {label:"Custodian Closet", tool:"closet"},
    {label:"Paleo-Medicine Center", tool:"pmc"},
    {label:"Vehicle Depot", tool:"depot"},
    {label:"Security Office", tool:"security"},
    {label:"Tool Shed", tool:"toolshed"},
    {label:"Generator", tool:"generator"},
  ]},
  {id:"mgmt", label:"Park Management", items:[
    {label:"Draw Work Zone", tool:"zone", price:() => "Free"},
    {label:"ORACLE", tool:"oracle"},
    {label:"GHOST", tool:"ghost"},
    {label:"TAR", tool:"tar"},
    {label:"CERES", tool:"ceres"},
  ]},
  {id:"logi", label:"Logistics Buildings", items:[
    {label:"Delivery Dock", tool:"dock"},
    {label:"Warehouse", tool:"warehouse"},
    {label:"Cold Store", tool:"coldstore"},
    {label:"Hay Farm", tool:"farm"},
    {label:"Livestock Ranch", tool:"ranch"},
    {label:"Fish Hatchery", tool:"hatchery"},
    {label:"Insectary", tool:"insectary"},
    {label:"Paleo-Greenhouse", tool:"greenhouse"},
  ]},
];

// Names the build menu shows when they differ from the building's own label
const BUILD_NAMES = {vivS:"Small", vivM:"Medium", vivL:"Large", kiosk:"Cart", food:"Stand", restaurant:"Restaurant", cart:"Cart", shop:"Stand", megastore:"Shop",
  campground:"Campground", lodge:"Safari Lodge", resort:"Resort Hotel"};

const ICON_LINES = {
  path:'<path d="M5 21c1-6 5-6 7-10s2-6 6-8" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" opacity=".35"/><path d="M5 21c1-6 5-6 7-10s2-6 6-8" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="2 3"/>',
  wide:'<path d="M5 21c1-6 5-6 7-10s2-6 6-8" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" opacity=".35"/><path d="M5 21c1-6 5-6 7-10s2-6 6-8" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="2 3"/>',
  tram:'<path d="M4 20L20 4" stroke="currentColor" stroke-width="5" stroke-linecap="butt" opacity=".35"/><path d="M4 20L20 4" stroke="currentColor" stroke-width="5" stroke-dasharray="1 2.4"/><path d="M2.8 18.6L18.6 2.8M5.4 21.2L21.2 5.4" stroke="currentColor" stroke-width="1" fill="none"/>',
  service:'<path d="M4 20L20 4" stroke="currentColor" stroke-width="5" stroke-linecap="round" opacity=".4"/><path d="M4 20L20 4" stroke="currentColor" stroke-width="1.4" stroke-dasharray="3 3"/>',
  gate:'<path d="M3 12h5M16 12h5" stroke="currentColor" stroke-width="2.5"/><rect x="8" y="8" width="8" height="8" rx="1" fill="#D8B04A" stroke="#1D2B22" stroke-width="1.4"/>',
  platform:'<rect x="3" y="9" width="18" height="7" rx="1" fill="#B08654" stroke="#1D2B22" stroke-width="1.2"/><path d="M5 16v4M19 16v4" stroke="currentColor" stroke-width="1.4"/>',
  water:'<path d="M4 9l6-4 9 2 2 7-5 6-9-1-3-5z" fill="#4C93C9" stroke="#2F6F9F" stroke-width="1.4" stroke-linejoin="round"/><path d="M8 12c2-1.5 4 1.5 6 0" fill="none" stroke="#7DB6DD" stroke-width="1.4" stroke-linecap="round"/>',
  bridge:'<path d="M2 15c4-3 6-3 10 0s6 3 10 0" fill="none" stroke="#4C93C9" stroke-width="2.2" opacity=".7"/><path d="M3 11.5L21 11.5" stroke="#4A3220" stroke-width="7.5"/><path d="M3 11.5L21 11.5" stroke="#B48A5A" stroke-width="5.5"/><path d="M3 11.5L21 11.5" stroke="#6E4E30" stroke-width="5.5" stroke-dasharray=".6 2"/>',
  hedge:'<path d="M3 16h18" stroke="#24461F" stroke-width="6.5" stroke-linecap="round"/><path d="M3 16h18" stroke="#4E8A3E" stroke-width="5" stroke-linecap="round"/><path d="M3 16h18" stroke="#6BA851" stroke-width="3" stroke-dasharray="0 3.4" stroke-linecap="round"/>',
  ...Object.fromEntries(Object.entries(LAND).filter(([, t]) => t.statue).map(([k, t]) => ["land-" + k, `<rect x="3" y="3" width="18" height="18" rx="3" fill="#D9D4C7" stroke="#1F3D2B" stroke-width="1.2"/><circle cx="12" cy="12" r="${t.initials ? 6 : 7.5}" fill="#9C6B33" stroke="#4E3115" stroke-width="1"/><text x="12" y="12.5" class="glyph" font-size="${(t.initials || "x").length > 2 ? 5.2 : t.initials ? 6.4 : 9}" style="fill:#F6E7C1;stroke:#3A2410">${t.initials || (SPECIES.find(s => s.id === t.sp) || {name:"?"}).name[0]}</text>`])),
  "land-rock":'<circle cx="12" cy="13" r="6" fill="#8E9188" stroke="#4E524C" stroke-width="1.4"/><circle cx="10" cy="11" r="2.4" fill="#B7BBB2" opacity=".7"/>',
  "land-boulder":'<circle cx="9" cy="14" r="5" fill="#767A74" stroke="#4E524C" stroke-width="1.4"/><circle cx="16" cy="11" r="4" fill="#8E9188" stroke="#4E524C" stroke-width="1.4"/>',
  ...Object.fromEntries(Object.entries(LAND).filter(([, t]) => t.flora).map(([k, t]) => ["land-" + k,
    t.r < 4.5 ? `<circle cx="9" cy="13" r="3.4" fill="${t.color}" stroke="#1F3A2B" stroke-width="1"/><circle cx="15" cy="11" r="3" fill="${t.color}" stroke="#1F3A2B" stroke-width="1"/>` : `<circle cx="8" cy="11" r="5" fill="${t.color}" stroke="#1F3A2B" stroke-width="1"/><circle cx="16" cy="10" r="4.5" fill="${t.color}" stroke="#1F3A2B" stroke-width="1"/><circle cx="12" cy="16" r="5" fill="${t.color}" stroke="#1F3A2B" stroke-width="1"/>`])),
  "land-shelter":'<rect x="6" y="6" width="12" height="12" rx="1.5" fill="#9A7B55" stroke="#3B3226" stroke-width="1.4"/><path d="M6 12h12" stroke="#3B3226" stroke-width="1"/>',
  "land-burrow":'<ellipse cx="12" cy="14" rx="9" ry="6" fill="#8A6B47" stroke="#3B3226" stroke-width="1.4"/><ellipse cx="12" cy="14" rx="3.5" ry="2.4" fill="#2A211A"/>',
  "land-cavesm":'<path d="M4 19L6 9L13 5L20 10L19 19Z" fill="#6F6A62" stroke="#3B3226" stroke-width="1.4"/><path d="M9 19A3 4 0 0 1 15 19Z" fill="#1E1B17"/>',
  "land-cavelg":'<path d="M2 20L4 8L12 3L21 8L22 20Z" fill="#5B5750" stroke="#3B3226" stroke-width="1.4"/><path d="M7 20A5 6 0 0 1 17 20Z" fill="#1E1B17"/>',
  "land-canopysm":'<circle cx="12" cy="12" r="7" fill="#B9A77E" fill-opacity=".85" stroke="#3B3226" stroke-width="1.4"/><path d="M12 5V19M6 8.5L18 15.5M6 15.5L18 8.5" stroke="#3B3226" stroke-opacity=".5"/>',
  "land-canopylg":'<circle cx="12" cy="12" r="10" fill="#A8946A" fill-opacity=".85" stroke="#3B3226" stroke-width="1.4"/><path d="M12 2V22M3.3 7L20.7 17M3.3 17L20.7 7" stroke="#3B3226" stroke-opacity=".5"/>',
  "land-traysm":'<circle cx="12" cy="12" r="5" fill="#8A8F96" stroke="#6E737A" stroke-width="1.4"/><circle cx="12" cy="12" r="3.4" fill="#4B4F55"/><circle cx="12" cy="12" r="1.8" fill="#6BAA3A"/>',
  "land-traymd":'<circle cx="12" cy="12" r="7.5" fill="#8A8F96" stroke="#6E737A" stroke-width="1.4"/><circle cx="12" cy="12" r="5.6" fill="#4B4F55"/><circle cx="12" cy="12" r="3.4" fill="#6BAA3A"/>',
  "land-traylg":'<circle cx="12" cy="12" r="10" fill="#8A8F96" stroke="#6E737A" stroke-width="1.4"/><circle cx="12" cy="12" r="7.8" fill="#4B4F55"/><circle cx="12" cy="12" r="5.2" fill="#6BAA3A"/>',
  "land-barn":'<rect x="3" y="4" width="18" height="16" rx="1.5" fill="#7E6142" stroke="#3B3226" stroke-width="1.4"/><path d="M3 12h18" stroke="#3B3226" stroke-width="1"/>',
  parcels:'<path d="M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".55"/><rect x="9" y="9" width="6" height="6" fill="#D8B04A" stroke="#1D2B22" stroke-width="1.2"/>',
  zone:'<path d="M4 7l7-3 9 4-2 11-9 2-6-6z" fill="#E0A030" fill-opacity=".35" stroke="#E0A030" stroke-width="1.8" stroke-dasharray="3 2" stroke-linejoin="round"/>',
  viv:'<rect x="3" y="6" width="18" height="13" rx="1.5" fill="#A9D3DA" stroke="#24414A" stroke-width="1.6"/>',
  grid:'<path d="M4 4h16v16H4zM4 9.3h16M4 14.6h16M9.3 4v16M14.6 4v16" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="14.6" cy="9.3" r="2.2" fill="currentColor"/>',
  supply:'<path d="M4 18L12 6l8 12" fill="none" stroke="#E0A030" stroke-width="2" stroke-dasharray="3 2"/><circle cx="4" cy="18" r="2" fill="#E0A030"/><circle cx="20" cy="18" r="2" fill="#E0A030"/>',
  bulldoze:'<path d="M3 17h11v-5H9l-2-4H3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="6" cy="19" r="1.8" fill="currentColor"/><circle cx="11" cy="19" r="1.8" fill="currentColor"/><path d="M14 14h6l1 4h-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  move:'<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  select:'<path d="M5 3l14 8-6 1.5L10 19z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
};
function menuIcon(tool, color, glyph){
  let inner = ICON_LINES[tool];
  const b = BUILDINGS[tool];
  if(!inner && b) inner = b.viv ? ICON_LINES.viv : `<rect x="3" y="6" width="18" height="13" rx="2" fill="${b.color}"/>${b.glyph ? `<text x="12" y="13" class="glyph" font-size="10">${esc(b.glyph)}</text>` : ""}`;
  if(!inner && color) inner = `<path d="M3 16h18" stroke="${color}" stroke-width="5" stroke-linecap="round"/><path d="M3 16h18" stroke="#fff" stroke-width="1" stroke-dasharray="1 4" opacity=".6"/>`;
  return `<svg class="ticon" viewBox="0 0 24 24" aria-hidden="true">${inner || ""}</svg>`;
}

const priceRange = tools => {
  const ps = tools.map(t => BUILDINGS[t].price), lo = Math.min(...ps), hi = Math.max(...ps);
  return lo === hi ? money(lo) : `${money(lo)}–${money(hi)}`;
};
const priceRange2 = ks => { const ps = ks.map(k => LAND[k].price); return `${money(Math.min(...ps))}–${money(Math.max(...ps))}`; };
const toolLabel = t => BUILD_NAMES[t] || BUILDINGS[t].label;

function menuRow(it){
  if(it.props){
    const rows = it.props.map(k => { const t = LAND[k];
      return `<button class="srow sub" data-tool="land-${k}" aria-pressed="false" data-tech="${t.tech || ""}">${menuIcon("land-" + k)}<span class="tl"><b>${esc(t.label)}</b><span class="price">${money(t.price)}</span></span></button>`; }).join("");
    return `<div class="sitem" data-open="props"><button class="srow head" aria-expanded="false">${menuIcon("land-" + it.props[0])}<span class="tl"><b>${esc(it.label)}</b><span class="price">${priceRange2(it.props)}</span></span><i class="chev" aria-hidden="true"></i></button><div class="ssub"><p class="snote">${esc(it.note)}</p>${rows}</div></div>`;
  }
  if(it.fences){
    const rows = Object.entries(BARRIERS).map(([key, b]) => `<button class="srow sub" data-fence="${key}" aria-pressed="false" data-tech="${b.tech || ""}">${b.hedge ? menuIcon("hedge") : menuIcon("", b.color)}<span class="tl"><b>${esc(b.label)}</b><span class="price">${money(fenceRate(key))}/m</span></span></button>`).join("");
    const rates = Object.keys(BARRIERS).map(fenceRate);
    return `<div class="sitem" data-open="fence"><button class="srow head" aria-expanded="false">${menuIcon("exhibit-fence", "#3B3226")}<span class="tl"><b>${esc(it.label)}</b><span class="price">${money(Math.min(...rates))}–${money(Math.max(...rates))}/m</span></span><i class="chev" aria-hidden="true"></i></button><div class="ssub"><p class="snote">${esc(it.note)}</p>${rows}</div></div>`;
  }
  if(it.parkPlants){
    const rows = PLANT_SIZES.slice().reverse().map(size => `<p class="snote">${size[0].toUpperCase() + size.slice(1)}</p>` + Object.keys(PARK_PLANTS[size]).map(name => { const k = Object.keys(LAND).find(x => LAND[x].park && LAND[x].label === name), t = LAND[k];
      return `<button class="srow sub" data-tool="land-${k}" aria-pressed="false" data-tech="">${menuIcon("land-" + k)}<span class="tl"><b>${esc(t.label)}</b><span class="price">${money(t.price)}, ${esc(BIOMES[t.biome].label.toLowerCase())}${t.aquatic ? ", in water" : t.wet ? ", land or water" : ""}</span></span></button>`; }).join("")).join("");
    return `<div class="sitem" data-open="park-plants"><button class="srow head" aria-expanded="false">${menuIcon("land-q-white-oak")}<span class="tl"><b>${esc(it.label)}</b><span class="price">${priceRange2(Object.keys(LAND).filter(k => LAND[k].park))}</span></span><i class="chev" aria-hidden="true"></i></button><div class="ssub"><p class="snote">${esc(it.note)}</p>${rows}</div></div>`;
  }
  if(it.statues){
    const keys = Object.keys(LAND).filter(k => LAND[k].statue), row = k => { const t = LAND[k], g = statueGrant(k);
      return `<button class="srow sub" data-tool="land-${k}" aria-pressed="false" data-tech="" data-lock="${k}"${g ? ` title="${esc(statueHint(k))}"` : ""}>${menuIcon("land-" + k)}<span class="tl"><b>${esc(t.label)}</b><span class="price">${money(t.price)}${t.free ? "" : ", grant"}</span></span></button>`; };
    const rows = `<p class="snote">Animals</p>${keys.filter(k => !LAND[k].initials).map(row).join("")}<p class="snote">People</p>${keys.filter(k => LAND[k].initials).map(row).join("")}`;
    return `<div class="sitem" data-open="statues"><button class="srow head" aria-expanded="false">${menuIcon("land-st-owen")}<span class="tl"><b>${esc(it.label)}</b><span class="price">${priceRange2(keys)}</span></span><i class="chev" aria-hidden="true"></i></button><div class="ssub"><p class="snote">${esc(it.note)}</p>${rows}</div></div>`;
  }
  if(it.period){
    const rows = Object.entries(PLANTS_OF[it.period]).map(([biome, keys]) => `<p class="snote">${esc(BIOMES[biome].label)}</p>` + keys.map(k => { const t = LAND[k];
      return `<button class="srow sub" data-tool="land-${k}" aria-pressed="false" data-tech="${t.tech || ""}">${menuIcon("land-" + k)}<span class="tl"><b>${esc(t.label)}</b><span class="price">${money(t.price)}${potKey(t) ? " + plant" : ""}, ${t.size}</span></span></button>`; }).join("")).join("");
    const first = PLANTS_OF[it.period][Object.keys(PLANTS_OF[it.period])[0]][1];
    return `${it.note ? `<p class="snote">${esc(it.note)}</p>` : ""}<div class="sitem" data-open="plants-${it.period}"><button class="srow head" aria-expanded="false">${menuIcon("land-" + first)}<span class="tl"><b>${esc(it.label)}</b><span class="price">${Object.keys(PLANTS_OF[it.period]).length} biomes</span></span><i class="chev" aria-hidden="true"></i></button><div class="ssub">${rows}</div></div>`;
  }
  if(it.sub){
    const rows = it.sub.map(t => `<button class="srow sub" data-tool="${t}" aria-pressed="false" data-tech="${BUILDINGS[t].tech || ""}">${menuIcon(t)}<span class="tl"><b>${esc(toolLabel(t))}</b><span class="price">${money(BUILDINGS[t].price)}</span></span></button>`).join("");
    return `<div class="sitem" data-open="${it.sub[0]}"><button class="srow head" aria-expanded="false">${menuIcon(it.sub[0])}<span class="tl"><b>${esc(it.label)}</b><span class="price">${priceRange(it.sub)}</span></span><i class="chev" aria-hidden="true"></i></button><div class="ssub">${rows}</div></div>`;
  }
  const b = BUILDINGS[it.tool], price = it.price ? it.price() : money(b.price);
  return `<button class="srow" data-tool="${it.tool}" aria-pressed="false" data-tech="${it.tech || (b ? b.tech || "" : "")}">${menuIcon(it.tool)}<span class="tl"><b>${esc(it.label)}</b><span class="price">${price}</span></span></button>${it.note ? `<p class="snote">${esc(it.note)}</p>` : ""}`;
}

function buildMenu(){
  const groups = BUILD_MENU.map(g => `<section class="sgroup" data-group="${g.id}"><button class="shead" aria-expanded="false"><span>${esc(g.label)}</span><i class="chev" aria-hidden="true"></i></button><div class="sbody">${g.items.map(menuRow).join("")}</div></section>`).join("");
  const rest = `<section class="sgroup flat"><div class="stitle">Toggles</div>
    <button class="srow" id="gridBtn" aria-pressed="false" title="Snap corners and buildings to a 1 m grid (G). Hold Alt to place freely.">${menuIcon("grid")}<span class="tl"><b>Grid snapping</b><span class="price">Off. Press G</span></span></button>
    <button class="srow" id="supplyBtn" aria-pressed="false" title="Show where keepers haul goods: stores, farms and the exhibits they feed">${menuIcon("supply")}<span class="tl"><b>Supply lines</b><span class="price">Off</span></span></button></section>`;
  $("#sideMenu").innerHTML = `<div class="sidebar-top"><button class="sidetab" id="sideTab" aria-expanded="false" aria-controls="sideBody">${menuIcon("path").replace("ticon", "ticon tab")}<span class="tl"><b>Build</b></span></button>
    <button class="sidetab sel" data-tool="select" aria-pressed="true" title="Look around and pick things (Esc)">${menuIcon("select")}<span class="tl"><b>Select</b></span></button>
    <button class="sidetab" data-tool="bulldoze" aria-pressed="false" title="Remove things (${Math.round(COST.refundShare * 100)}% back)">${menuIcon("bulldoze")}<span class="tl"><b>Bulldoze</b></span></button>
    <button class="sidetab" data-tool="move" aria-pressed="false" title="Drag a building, exhibit or path to a new spot">${menuIcon("move")}<span class="tl"><b>Move</b></span></button></div>
    <div class="sidebody" id="sideBody" hidden>${groups}${rest}</div>`;
}

// Grey out what isn't researched yet. Called after anything changes.
function refreshMenu(){
  if(!state) return;
  document.querySelectorAll("#sideMenu [data-tech]").forEach(b => { const t = b.dataset.tech, k = b.dataset.lock; b.classList.toggle("locked", (!!t && !hasTech(t)) || (!!k && !statueOpen(k))); });
}
