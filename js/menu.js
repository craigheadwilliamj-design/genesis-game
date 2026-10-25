/* =====================================================================
   MENU
   The build sidebar: a tab on the left that opens into groups, each
   with its own dropdown of tools. Prices come from the data, so a
   balance change in data.js shows up here by itself.
   ===================================================================== */

// What each group holds. {tool} picks a tool, {sub} opens a dropdown of tools, {fence} picks a fence.
const HABITAT_PROPS = ["burrow", "cavesm", "cavelg", "canopysm", "canopylg", "shelter", "barn", "screen", "traysm", "traymd", "traylg", "post", "logs", "wallow", "ball", "icefish", "icefruit", "iceshell", "shank", "buglog", "hay", "pbale"];
const BUILD_MENU = [
  {id:"paths", label:"Path Tools", items:[
    {label:"Guest Paths", tool:"path", price:() => `${money(pathChunkCost("g"))}/chunk`, note:"A 5 m square a chunk. Drag along the grid, straight or diagonal. Lay paths side by side for a wider walk."},
    {label:"Wooden Bridges", tool:"bridge", price:() => `${money(pathChunkCost("b"))}/chunk`, note:"The only path that crosses water. Drag it over the water, from one bank to the other."},
    {label:"Staff Paths", tool:"service", price:() => `${money(pathChunkCost("s"))}/chunk`, note:"Staff only: guests won't walk it. A staff path that touches a guest path or the entrance walk is joined to it for staff."},
    {label:"Tram Track", tool:"tram", tech:"transit", price:() => `${money(TRAM.perMeter)}/m`, note:"Guests ride it between tram stations, six times faster than walking. Draw it beside your paths and put a station at each stop."},
    {label:"Bins", tool:"bin"},
    {label:"Benches", tool:"bench"},
    {label:"Picnic Areas", tool:"picnic"},
    {label:"Lamp Posts", tool:"lamp"},
    {label:"Security Cameras", tool:"camera", tech:"cameras", note:"Watches the paths within a short radius and sends the nearest guard to any vandal it sees. Needs a Security Office with guards."},
    {label:"Donation Boxes", tool:"donate", note:"Guests who pass one may drop a little in, more if they learned something. A small bonus, counted under Donations."},
    {label:"Info Signs", tool:"sign"},
    {label:"Do Not Feed Signs", tool:"nofeed", note:"Guests are less likely to throw trash into an exhibit with one beside its fence. Put it on the path within 20 m of the fence."},
    {label:"Quiet Signs", tool:"quiet", note:"Guests near one keep their voices down (rowdy ones mostly don't), so shy animals in exhibits within 20 m of the sign feel less crowded and hide less. Put it on the path within 20 m of the fence."},
  ]},
  {id:"land-buy", label:"Land", items:[
    {label:"Buy Land", tool:"parcels", price:() => `from ${money(Math.min(...SALE_CELLS.filter(([i, j]) => !parcelHome(i, j)).map(([i, j]) => parcelPrice(i, j))))}`, note:"Buy the plots around your park to build further out. Each costs a daily property tax."},
  ]},
  {id:"exhibits", label:"Exhibit Tools", items:[
    {label:"Vivariums", sub:["vivS", "vivM", "vivL"]},
    {label:"Aquariums", sub:["aquaS", "aquaM", "aquaL"]},
    {label:"Gates", tool:"gate", price:() => money(GATE_COST)},
    {label:"Viewing Platforms", tool:"platform"},
    {label:"Viewing Galleries", tool:"gallery"},
    {label:"Habitat Props", props:HABITAT_PROPS, note:"Place these inside an open exhibit. Barns, caves and burrows cover animals from heat waves, cold snaps and storms. Canopies cover them from heat and storms, but not the cold. Animals walk inside to hide, sleep and wait out bad weather, and aren't seen there. A privacy screen by the fence shields shy animals from the path's view without hiding them. Keepers walk in to fill food trays, which each hold one kind of food. Rubbing posts, log piles and mud wallows give bored animals something to do."},
    {label:"Fence Types", fences:true, note:"Pick a fence, then tap corners on the map. Close it on the first corner to make an exhibit, then give it a keeper gate. Or tap the last corner again to leave it open, like a hedge row along a path. Hedges and rope fences are only for show: guests like them, but they can't hold animals."},
  ]},
  {id:"land", label:"Landscaping", items:[
    {label:"Water", water:true, note:"Pick a water type, then drag a box to lay it in 5 m chunks, like a path. Inside an exhibit it's for the animals. Out in the park guests enjoy it, and only wooden bridges cross it."},
    ...Object.entries(LAND).filter(([k, t]) => !t.period && !t.statue && !t.vivToy && !HABITAT_PROPS.includes(k)).map(([k, t], i, all) => ({label:t.label, tool:"land-" + k, tech:t.tech, shapes:k === "rock" || k === "boulder" ? k : undefined, price:() => money(t.price),
      note:i === all.length - 1 ? "Inside an open exhibit, animals like water and rocks, and fish eaters need water. Out in the park, rocks dress up the paths." : undefined})),
    {label:"Paint Ground", paint:true, note:"Pick a biome, then drag a box to paint its ground. Out in the park it is only looks. Inside an exhibit it costs the biome's grading price a m², and the biome with the most ground becomes the exhibit's biome. Paint can cover earlier paint. Tap a patch to change its biome, or use Erase."},
    {label:"Statues", statues:true, note:"Bronze on a stone plinth that matches the theme around it. Place them anywhere outside the exhibits. Guests stop to look, and learn a lot from the people's plaques. Grants unlock more."},
    ...Object.keys(PLANTS_OF).map(period => ({label:period + " plants", period, note:period === "Devonian" ? "Every period has its own small, medium and large plants for each biome that existed then, and animals only count plants from their exhibit's own biome. Others make them unhappy. Groves from an animal's own era feed and shelter it. Every Mesozoic and Paleozoic plant uses a plant of its size grown at the Botany Lab. Out in the park, only Quaternary plants grow until the Research Lab researches sterile prehistoric plants." : undefined})),
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
    {label:"Dive Shack", tool:"diveshack"},
    {label:"Break Room", tool:"breakroom"},
    {label:"Workshop", tool:"workshop"},
    {label:"Custodian Closet", tool:"closet"},
    {label:"Paleo-Medicine Center", tool:"pmc"},
    {label:"Vehicle Depot", tool:"depot"},
    {label:"Security Office", tool:"security"},
    {label:"Tool Shed", tool:"toolshed"},
    {label:"Generator", tool:"generator"},
    {label:"Draw Work Zone", tool:"zone", price:() => "Free"},
  ]},
  {id:"mgmt", label:"Park Management", items:[
    {label:"Research Lab", tool:"oracle"},
    {label:"Time Travel Lab", tool:"ghost"},
    {label:"Genetics Lab", tool:"tar"},
    {label:"Botany Lab", tool:"ceres"},
  ]},
  {id:"logi", label:"Logistics Buildings", items:[
    {label:"Delivery Dock", tool:"dock"},
    {label:"Warehouse", tool:"warehouse"},
    {label:"Cold Store", tool:"coldstore"},
    {label:"Hay Farm", tool:"farm"},
    {label:"Livestock Ranch", tool:"ranch"},
    {label:"Fish Hatchery", tool:"hatchery"},
    {label:"Insectary", tool:"insectary"},
    {label:"Fruit Orchard", tool:"orchard"},
    {label:"Shellfish Farm", tool:"shellfarm"},
    {label:"Paleo-Greenhouse", tool:"greenhouse"},
  ]},
];

// Names the build menu shows when they differ from the building's own label
const BUILD_NAMES = {vivS:"Small", vivM:"Medium", vivL:"Large", aquaS:"Small", aquaM:"Medium", aquaL:"Large", kiosk:"Cart", food:"Stand", restaurant:"Restaurant", cart:"Cart", shop:"Stand", megastore:"Shop",
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
  paint:'<rect x="3" y="5" width="18" height="14" rx="2" fill="#BFA96C"/><path d="M3 12l6-7h6l-9 14H5a2 2 0 0 1-2-2z" fill="#7DAA68"/><path d="M15 19l6-8v6a2 2 0 0 1-2 2z" fill="#DFC48A"/>',
  zone:'<path d="M4 7l7-3 9 4-2 11-9 2-6-6z" fill="#E0A030" fill-opacity=".35" stroke="#E0A030" stroke-width="1.8" stroke-dasharray="3 2" stroke-linejoin="round"/>',
  viv:'<rect x="3" y="6" width="18" height="13" rx="1.5" fill="#A9D3DA" stroke="#24414A" stroke-width="1.6"/>',
  aqua:'<rect x="3" y="6" width="18" height="13" rx="1.5" fill="#A9D3DA" stroke="#24414A" stroke-width="1.6"/><rect x="4" y="9" width="16" height="9" fill="#3E86A8"/><path d="M4 9h16" stroke="#BFE6F5" stroke-width="1"/><circle cx="9" cy="14" r="1.2" fill="#BFE6F5"/><circle cx="12" cy="11.5" r=".8" fill="#BFE6F5"/>',
  grid:'<path d="M4 4h16v16H4zM4 9.3h16M4 14.6h16M9.3 4v16M14.6 4v16" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="14.6" cy="9.3" r="2.2" fill="currentColor"/>',
  supply:'<path d="M4 18L12 6l8 12" fill="none" stroke="#E0A030" stroke-width="2" stroke-dasharray="3 2"/><circle cx="4" cy="18" r="2" fill="#E0A030"/><circle cx="20" cy="18" r="2" fill="#E0A030"/>',
  bulldoze:'<g transform="matrix(-1 0 0 1 24 0)"><path d="M2 9h2.5v11H2z" fill="currentColor"/><path d="M4.5 13l4-1M4.5 17h4" stroke="currentColor" stroke-width="1.6"/><path d="M8 11h4V5h6l2 6h1v6H8z" fill="currentColor"/><path d="M13.3 6.5h3.6l1.3 4.5h-4.9z" fill="#1F3A2B" fill-opacity=".75"/><rect x="7.5" y="17.5" width="15" height="5" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="10" cy="20" r="1.1" fill="currentColor"/><circle cx="15" cy="20" r="1.1" fill="currentColor"/><circle cx="20" cy="20" r="1.1" fill="currentColor"/></g>',
  move:'<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  select:'<path d="M5 3l14 8-6 1.5L10 19z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
};
// The picture a menu tool shows when it has one in the sprite pack: a vivarium's thumbnail, a building's or path prop's front view, a habitat prop, a rock, a fence section, a path or water tile
const PATH_TILES = {path:"guest", service:"staff", bridge:"bridge"};
function menuSprite(tool){
  const has = p => typeof SPRITE_PACK !== "undefined" && SPRITE_PACK[p] ? p : null, k = tool.replace(/^land-/, "");
  if(PATH_TILES[tool]) return has(`sprites/path/${PATH_TILES[tool]}.png`);
  if(tool === "water") return has("sprites/water/temperate-1.png");
  if(/^(water|paint)-/.test(tool)) return has(`sprites/${tool.startsWith("water") ? "water" : "ground"}/${tool.replace(/^\w+-/, "")}-1.png`);
  if(tool === "gate") return has("sprites/fence/wood-gate.png");
  if(tool.startsWith("fence-")) return has(`sprites/fence/${k.slice(6)}-pristine.png`);
  if(BUILDINGS[tool] && BUILDINGS[tool].aqua) return null;   // drawn icon until aquariums have thumbnails
  if(BUILDINGS[tool] && BUILDINGS[tool].viv) return has(`sprites/menu/viv-${BUILDINGS[tool].viv}.png`);   // thumbnails from tools/pixelvivicon.py
  if(BUILDINGS[tool]) return (BLD_PICS[tool] || typeof PROP_PICS !== "undefined" && PROP_PICS[tool]) && has(`sprites/bld/${tool}-front.png`);   // only the pictures the map draws (a blank placeholder may sit in the pack)
  if(tool === "land-rock" || tool === "land-boulder") return has(`sprites/rocks/${k}-temperate-1.png`);
  return tool.startsWith("land-") && (has(`sprites/shelter/${k}.png`) || has(`sprites/tray/${k}.png`) || has(`sprites/viv/${k}.png`) || has(`sprites/plants/${k}.png`));
}
function menuIcon(tool, color, glyph){
  const pic = menuSprite(tool), img = a => `<image href="${spriteUrl(pic)}" ${a} style="image-rendering:pixelated"/>`;
  // path, water and ground tiles show a patch at their own pixel size (an 8 px water or ground tile repeated), the rest fit the box standing on its bottom edge
  let inner = !pic ? ICON_LINES[tool] || ICON_LINES[(tool.match(/^(water|paint)-/) || [])[1]] : PATH_TILES[tool] ? img(`x="0" y="0" width="96" height="96"`)
    : /^(water|paint)\b/.test(tool) ? [0, 8, 16].flatMap(x => [0, 8, 16].map(y => img(`x="${x}" y="${y}" width="8.01" height="8.01"`))).join("")
    : img(`x="1" y="1" width="22" height="22" preserveAspectRatio="xMidYMax meet"`);
  const b = BUILDINGS[tool];
  if(!inner && b) inner = b.aqua ? ICON_LINES.aqua : b.viv ? ICON_LINES.viv : `<rect x="3" y="6" width="18" height="13" rx="2" fill="${b.color}"/>${b.glyph ? `<text x="12" y="13" class="glyph" font-size="10">${esc(b.glyph)}</text>` : ""}`;
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
    const props = it.props.filter(k => !toyHidden(k));
    const rows = props.map(k => { const t = LAND[k];
      return `<button class="srow sub" data-tool="land-${k}" aria-pressed="false" data-tech="${t.tech || ""}">${menuIcon("land-" + k)}<span class="tl"><b>${esc(t.label)}</b><span class="price">${money(t.price)}</span></span></button>`; }).join("");
    return `<div class="sitem" data-open="props"><button class="srow head" aria-expanded="false">${menuIcon("land-" + props[0])}<span class="tl"><b>${esc(it.label)}</b><span class="price">${priceRange2(props)}</span></span><i class="chev" aria-hidden="true"></i></button><div class="ssub"><p class="snote">${esc(it.note)}</p>${rows}</div></div>`;
  }
  if(it.fences){
    const rows = Object.entries(BARRIERS).filter(([, b]) => !b.pool || poolsOn()).map(([key, b]) => `<button class="srow sub" data-fence="${key}" aria-pressed="false" data-tech="${b.tech || ""}">${menuIcon(menuSprite("fence-" + key) ? "fence-" + key : b.hedge ? "hedge" : "", b.color)}<span class="tl"><b>${esc(b.label)}</b><span class="price">${money(fenceRate(key))}/m</span></span></button>`).join("");
    const rates = Object.keys(BARRIERS).filter(k => !BARRIERS[k].pool || poolsOn()).map(fenceRate);
    return `<div class="sitem" data-open="fence"><button class="srow head" aria-expanded="false">${menuIcon(menuSprite("fence-wood") ? "fence-wood" : "exhibit-fence", "#3B3226")}<span class="tl"><b>${esc(it.label)}</b><span class="price">${money(Math.min(...rates))}–${money(Math.max(...rates))}/m</span></span><i class="chev" aria-hidden="true"></i></button><div class="ssub"><p class="snote">${esc(it.note)}</p>${rows}</div></div>`;
  }
  if(it.statues){
    const keys = Object.keys(LAND).filter(k => LAND[k].statue && (!LAND[k].sp || speciesAvailable(LAND[k].sp))), row = k => { const t = LAND[k], g = statueGrant(k);
      return `<button class="srow sub" data-tool="land-${k}" aria-pressed="false" data-tech="" data-lock="${k}"${g ? ` title="${esc(statueHint(k))}"` : ""}>${menuIcon("land-" + k)}<span class="tl"><b>${esc(t.label)}</b><span class="price">${money(t.price)}${t.free ? "" : ", grant"}</span></span></button>`; };
    const rows = `<p class="snote">Animals</p>${keys.filter(k => !LAND[k].initials).map(row).join("")}<p class="snote">People</p>${keys.filter(k => LAND[k].initials).map(row).join("")}`;
    return `<div class="sitem" data-open="statues"><button class="srow head" aria-expanded="false">${menuIcon("land-st-owen")}<span class="tl"><b>${esc(it.label)}</b><span class="price">${priceRange2(keys)}</span></span><i class="chev" aria-hidden="true"></i></button><div class="ssub"><p class="snote">${esc(it.note)}</p>${rows}</div></div>`;
  }
  if(it.period){
    const quat = it.period === "Quaternary", biomes = quat ? Object.keys(BIOMES).filter(b => PLANTS_OF.Quaternary[b] || PARK_PLANTS_OF[b]) : Object.keys(PLANTS_OF[it.period]);
    const rows = biomes.map(biome => `<p class="snote" data-pbiome="${biome}">${esc(BIOMES[biome].label)}</p>` + bySize((PLANTS_OF[it.period][biome] || []).concat(quat ? PARK_PLANTS_OF[biome] || [] : [])).map(k => plantRow(k, "size")).join("")).join("");
    const ks = Object.values(PLANTS_OF[it.period]).map(l => l[1]), first = ks.find(k => PLANT_SPRITES[k]) || ks[0];   // the first medium plant with a picture
    return `${it.note ? `<p class="snote">${esc(it.note)}</p>` : ""}<div class="sitem" data-open="plants-${it.period}"><button class="srow head" aria-expanded="false">${plantIcon(first)}<span class="tl"><b>${esc(it.label)}</b><span class="price">${biomes.length} biomes</span></span><i class="chev" aria-hidden="true"></i></button><div class="ssub">${plantBiomeSelect()}${rows}</div></div>`;
  }
  if(it.water || it.paint){   // Water and Paint Ground list their types like the other lists: a row picks that type and turns the tool on
    const own = typeof state !== "undefined" && state ? parkBiome() : DEFAULT_BIOME, attr = it.water ? "data-water" : "data-paint";
    const opts = it.water ? [["auto", "Own biome", "The water that goes with the ground it's laid on", "water-" + own]].concat(waterTypes().map(k => [k, waterLabel(k), SEA_WATER[k] ? "Sea water for pool animals" : BIOMES[k].ground, "water-" + k]))
      : Object.keys(BIOMES).map(b => [b, BIOMES[b].label, BIOMES[b].ground, "paint-" + b]).concat([["erase", "Erase", "Take ground paint off", "bulldoze"]]);
    const price = k => it.water ? `${money(waterRate(k))}/m²` : k === "erase" ? "Free" : `$${BIOMES[k].perSqM.toFixed(2)}/m² in exhibits`;
    const rows = opts.map(([k, label, tip, icon]) => `<button class="srow sub" ${attr}="${k}" aria-pressed="false" title="${esc(tip)}">${menuIcon(icon)}<span class="tl"><b>${esc(label)}</b><span class="price">${price(k)}</span></span></button>`).join("");
    return `<div class="sitem" data-open="${it.water ? "water" : "paint"}"><button class="srow head" aria-expanded="false">${menuIcon(it.water ? "water" : "paint")}<span class="tl"><b>${esc(it.label)}</b><span class="price">${it.water ? `${money(WATER.perSqM)}/m²` : "Free in the park"}</span></span><i class="chev" aria-hidden="true"></i></button><div class="ssub"><p class="snote">${esc(it.note)}</p>${rows}</div></div>`;
  }
  if(it.sub){
    const rows = it.sub.filter(t => !buildingHidden(t)).map(t => `<button class="srow sub" data-tool="${t}" aria-pressed="false" data-tech="${BUILDINGS[t].tech || ""}">${menuIcon(t)}<span class="tl"><b>${esc(toolLabel(t))}</b><span class="price">${money(BUILDINGS[t].price)}</span></span></button>`).join("");
    return `<div class="sitem" data-open="${it.sub[0]}"><button class="srow head" aria-expanded="false">${menuIcon(it.sub[0])}<span class="tl"><b>${esc(it.label)}</b><span class="price">${priceRange(it.sub)}</span></span><i class="chev" aria-hidden="true"></i></button><div class="ssub">${rows}</div></div>`;
  }
  const b = BUILDINGS[it.tool], price = it.price ? it.price() : money(b.price);
  return `<button class="srow" data-tool="${it.tool}" aria-pressed="false" data-tech="${it.tech || (b ? b.tech || "" : "")}">${menuIcon(it.tool)}<span class="tl"><b>${esc(it.label)}</b><span class="price">${price}</span></span></button>${it.shapes ? `<div class="shapes" data-shapes="${it.shapes}"></div>` : ""}${it.note ? `<p class="snote">${esc(it.note)}</p>` : ""}`;
}

// A plant's row in the build menu. Park plants are listed in the Quaternary dropdown with the other Quaternary plants (both grow in exhibits and out in the park).
const bySize = ks => ks.slice().sort((a, b) => PLANT_SIZES.indexOf(LAND[a].size) - PLANT_SIZES.indexOf(LAND[b].size));
// A plant's menu icon: its real sprite when it has one (pixelated, fitted to the icon box), else the drawn icon
const plantIcon = k => PLANT_SPRITES[k] ? `<svg class="ticon" viewBox="0 0 24 24" aria-hidden="true"><image href="${spriteUrl(`sprites/plants/${k}.png`)}" x="1" y="1" width="22" height="22" preserveAspectRatio="xMidYMax meet" style="image-rendering:pixelated"/></svg>` : menuIcon("land-" + k);
// The biome dropdown at the top of every plant list. It only filters what the lists show (a plant's biome is part of the plant), and one pick covers all the lists.
const plantBiomeSelect = () => `<select class="plantbiome" aria-label="Biome" title="Show one biome's plants"><option value="">All biomes</option>${Object.keys(BIOMES).map(k => `<option value="${k}">${esc(BIOMES[k].label)}</option>`).join("")}</select><p class="snote" data-pnone hidden>No plants of this biome here.</p>`;
let plantBiomeMenu = null;
function refreshPlantBiome(){
  document.querySelectorAll("#sideMenu [data-pbiome]").forEach(el => { el.hidden = !!plantBiomeMenu && el.dataset.pbiome !== plantBiomeMenu; });
  document.querySelectorAll("#sideMenu .plantbiome").forEach(sel => {
    sel.value = plantBiomeMenu || "";
    const box = sel.parentNode, none = box.querySelector("[data-pnone]");
    if(none) none.hidden = !plantBiomeMenu || !!box.querySelector("button[data-pbiome]:not([hidden])");
  });
}
document.addEventListener("change", ev => {
  if(!ev.target.matches || !ev.target.matches("#sideMenu .plantbiome")) return;
  plantBiomeMenu = ev.target.value || null; refreshPlantBiome();
});
const plantRow = (k, tail) => { const t = LAND[k], water = t.aquatic ? ", in water" : t.wet ? ", land or water" : "", where = tail === "biome" ? esc(BIOMES[t.biome].label.toLowerCase()) : t.size;
  return `<button class="srow sub" data-tool="land-${k}" data-pbiome="${t.biome}" aria-pressed="false" data-tech="${t.tech || ""}">${plantIcon(k)}<span class="tl"><b>${esc(t.label)}</b><span class="price">${money(t.price)}${potKey(t) ? " + plant" : ""}, ${where}${water}</span></span></button>`; };

// Dev-only entries: the tram track, a dropdown with nothing left in it, or a held-back building
const menuHidden = it => (it.statues && !statuesOn()) || (it.tool === "tram" && !devMode()) || (it.tool && buildingHidden(it.tool)) || (it.sub && it.sub.every(buildingHidden));
// The left column's big buttons. Each opens a tray along the bottom (menu A): Buildings lists its groups, the others list their tools,
// and anything that holds a list opens that list in a second bar above it (menu B).
const BUILD_CATS = [
  {id:"build", label:"Buildings", groups:["guest", "staff", "mgmt", "logi"], icon:'<path d="M3 11l9-7 9 7M5 10v10h14V10" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><rect x="10" y="14" width="4" height="6" fill="currentColor"/>'},
  {id:"land", label:"Landscaping", groups:["land", "land-buy"], icon:'<g transform="translate(12 12) rotate(40) scale(1.2) translate(-12 -12)"><path d="M9 1.5h6v3.5H9z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M11 5h2v9h-2z" fill="currentColor"/><path d="M7.5 13.5h9v4.5c0 2.5-2 4-4.5 5-2.5-1-4.5-2.5-4.5-5z" fill="currentColor"/><path d="M12 15.5v4.5" stroke="#1F3A2B" stroke-opacity=".6" stroke-width="1.2"/></g>'},
  {id:"exhibits", label:"Exhibits", groups:["exhibits"], icon:'<path d="M5 3v18M19 3v18M5 7h14M5 12h14M5 17h14" stroke="currentColor" stroke-width="2"/>'},
  {id:"paths", label:"Paths", groups:["paths"], icon:'<path d="M8 21c0-5 6-5 6-9s-5-5-5-9M15 21c0-5 6-5 6-9s-5-5-5-9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'},
];
// Placeholder pictures for the Buildings groups until their pixel art is drawn
const GROUP_ICONS = {
  guest:'<circle cx="12" cy="6" r="3.2" fill="#F0C9A0"/><path d="M7 21v-7a5 5 0 0 1 10 0v7z" fill="#D9558C"/><path d="M9 6.5c0-3 6-3 6 0-1-1.5-5-1.5-6 0z" fill="#E8C34A"/>',
  staff:'<circle cx="12" cy="7" r="3.2" fill="#F0C9A0"/><path d="M7 5.5h10l-1-2.5H8z" fill="#8A7A4A"/><path d="M7 21v-7a5 5 0 0 1 10 0v7z" fill="#6E7B3E"/>',
  mgmt:'<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3" fill="#DDEFE6" fill-opacity=".25" stroke="#DDEFE6" stroke-width="1.8" stroke-linejoin="round"/><path d="M6.5 15.5h11l1.5 3a1.5 1.5 0 0 1-1.3 2H6.3a1.5 1.5 0 0 1-1.3-2z" fill="#5FD36E"/>',
  logi:'<rect x="2" y="7" width="12" height="9" fill="#8C939A"/><path d="M14 10h4l3 3v3h-7z" fill="#6E757C"/><circle cx="6.5" cy="17.5" r="2" fill="#3A3F44"/><circle cx="17" cy="17.5" r="2" fill="#3A3F44"/>',
};
let sideCat = null;   // the open tray's category, or null
const catOf = gid => (BUILD_CATS.find(c => c.groups.includes(gid)) || {}).id;
// A group's tools as one flat list: dropdowns inside it (Dining, Retail, Hotels) are spread out
const flatRows = it => it.sub ? it.sub.filter(t => !buildingHidden(t)).map(t => `<button class="srow sub" data-tool="${t}" aria-pressed="false" data-tech="${BUILDINGS[t].tech || ""}">${menuIcon(t)}<span class="tl"><b>${esc(toolLabel(t))}</b><span class="price">${money(BUILDINGS[t].price)}</span></span></button>`).join("") : menuRow(it);
function buildMenu(){
  const shown = g => g.items.filter(it => !menuHidden(it));
  const on = typeof supplyOn !== "undefined" && !!supplyOn, supply = `<button class="srow" id="supplyBtn" aria-pressed="${on}" title="Show where keepers haul goods: green farms, blue stores, gold exhibits">${menuIcon("supply")}<span class="tl"><b>Supply lines</b><span class="price">${on ? "On" : "Off"}</span></span></button>`;
  const groupEntry = g => `<div class="sitem sgroup" data-group="${g.id}" data-open="grp-${g.id}"><button class="srow head" aria-expanded="false"><svg class="ticon" viewBox="0 0 24 24" aria-hidden="true">${GROUP_ICONS[g.id] || ""}</svg><span class="tl"><b>${esc(g.label.replace(/ Buildings$/, ""))}</b></span></button><div class="ssub">${shown(g).map(flatRows).join("")}${g.id === "logi" ? supply : ""}</div></div>`;
  const trays = BUILD_CATS.map(c => { const gs = c.groups.map(id => BUILD_MENU.find(g => g.id === id)).filter(Boolean);
    const entries = c.id === "build" ? gs.map(groupEntry).join("") : gs.map(g => `<div class="sgroup" data-group="${g.id}">${shown(g).map(menuRow).join("")}</div>`).join("");
    return `<section class="tray" data-cat="${c.id}"><div class="tray-tab">${esc(c.label)}</div><div class="trayA">${entries}</div></section>`; }).join("");
  const big = BUILD_CATS.map(c => `<button class="tbtn big" id="cat-${c.id}" data-cat="${c.id}" aria-expanded="false" aria-controls="sideBody" title="${c.label}" aria-label="${c.label}"><svg viewBox="0 0 24 24" aria-hidden="true">${c.icon}</svg></button>`).join("");
  $("#sideMenu").innerHTML = `<div class="lefttools"><div class="smallrow">
    <button class="tbtn sm" data-tool="bulldoze" aria-pressed="false" title="Bulldoze: remove things (${Math.round(COST.refundShare * 100)}% back)" aria-label="Bulldoze">${menuIcon("bulldoze")}</button>
    <button class="tbtn sm" data-tool="move" aria-pressed="false" title="Move: drag a building, exhibit or path to a new spot" aria-label="Move">${menuIcon("move")}</button></div>
    ${big}</div>
    <div class="sidebody" id="sideBody" hidden>${trays}</div>`;
  // The bars have no room for the notes, so each note becomes its button's tooltip (a list's opening note goes on the button that opens it)
  document.querySelectorAll("#sideBody .snote:not([data-pbiome]):not([data-pnone])").forEach(p => {
    const prev = p.previousElementSibling, b = prev && prev.matches("button") ? prev : p.parentNode.matches(".ssub") ? p.parentNode.previousElementSibling : p.nextElementSibling && p.nextElementSibling.querySelector(".srow.head");
    if(b && !b.title) b.title = p.textContent;
  });
  // Every tray (menu A) and every list above it (menu B) gets a close button
  document.querySelectorAll("#sideBody .tray").forEach(t => t.insertAdjacentHTML("afterbegin", `<button class="xclose a" data-close="a" title="Close" aria-label="Close menu">×</button>`));
  document.querySelectorAll("#sideBody .ssub").forEach(s => s.insertAdjacentHTML("afterbegin", `<button class="xclose b" data-close="b" title="Close" aria-label="Close list">×</button>`));
  if(sideCat) sideOpen(sideCat);
}

// Grey out what isn't researched yet. Called after anything changes.
// The shape pickers under Rock and Boulder: a Random button and one thumbnail per picture of the biome in use (rockBiomeNow), redrawn when that changes
function refreshShapes(){
  const b = rockBiomeNow();
  document.querySelectorAll("#sideMenu [data-shapes]").forEach(box => {
    const type = box.dataset.shapes, list = (ROCK_SPRITES[b] || {})[type] || [], sel = rockPicOf(type, b), key = b + "|" + sel + "|" + rockBiomeMenu;
    if(box.dataset.key === key) return;
    box.dataset.key = key;
    box.innerHTML = `<select class="shapebiome" aria-label="Stone biome" title="Which biome's stone to place"><option value="">Biome: auto (${esc(BIOMES[b].label)})</option>${Object.keys(BIOMES).map(k => `<option value="${k}"${k === rockBiomeMenu ? " selected" : ""}>${esc(BIOMES[k].label)}</option>`).join("")}</select>`
      + (list.length ? `<button class="shape rnd" data-shape="" aria-pressed="${sel == null}" title="Random shape">?</button>` + list.map((_, i) => `<button class="shape" data-shape="${i}" aria-pressed="${sel === i}" title="Shape ${i + 1}"><img src="${spriteUrl(`sprites/rocks/${type}-${b}-${i + 1}.png`)}" alt="Shape ${i + 1}"></button>`).join("") : "");
  });
}
document.addEventListener("change", ev => {
  if(!ev.target.matches || !ev.target.matches("#sideMenu .shapebiome")) return;
  rockBiomeMenu = ev.target.value || null; refreshShapes(); if(landGhost) renderOverlay();
});
document.addEventListener("click", ev => {
  const btn = ev.target.closest && ev.target.closest("#sideMenu [data-shape]"); if(!btn) return;
  const type = btn.parentNode.dataset.shapes; rockPick[type] = btn.dataset.shape === "" ? null : +btn.dataset.shape;
  if(tool !== "land-" + type) setTool("land-" + type);
  refreshShapes(); if(landGhost) renderOverlay();
});
// A Rock or Boulder picked from an exhibit's Landscaping tab opens the Landscaping tray, so its shape picker shows too
function showRockPicker(){
  if(tool !== "land-rock" && tool !== "land-boulder") return;
  if(sideCat !== "land") sideOpen("land");
  refreshShapes();
}
// The exhibit panel's Paint ground and Water buttons open the Landscaping tray with that list up as menu B, so you pick the type there
function openLandList(name){
  if(tool !== "select") cancelTool();
  if(sideCat !== "land") sideOpen("land");
  document.querySelectorAll("#sideBody .trayA .sitem.open").forEach(x => { x.classList.remove("open"); x.firstElementChild.setAttribute("aria-expanded", false); });
  const it = document.querySelector(`#sideBody .sitem[data-open="${name}"]`);
  if(it){ it.classList.add("open"); it.firstElementChild.setAttribute("aria-expanded", true); }
}
function refreshMenu(){
  if(!state) return;
  refreshShapes(); refreshPlantBiome();
  document.querySelectorAll("#sideMenu [data-tech]").forEach(b => { const t = b.dataset.tech, k = b.dataset.lock; b.classList.toggle("locked", (!!t && !hasTech(t)) || (!!k && !statueOpen(k))); });
}
