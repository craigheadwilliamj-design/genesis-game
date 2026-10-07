// Runs js/geometry.js on seeded test shapes and saves the answers to godot/tests/geometry_cases.json.
// The Godot test (tests/smoke.gd) then checks geometry.gd gives the same results.
// Run: node tools/geometry_cases.js
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "../js/geometry.js"), "utf8");
const G = new Function(src + "\nreturn {dist, area, perimeter, lineLength, centroid, bbox, inPoly, segProj, segCross, segSegDist, distToEdge, deepInside, lineShapeDist, lineEntersShape, shapesOverlap, selfCrosses, rectPts};")();

let seed = 12345;
const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const r = (lo, hi) => lo + rnd() * (hi - lo);
const rpt = () => [r(-20, 40), r(-20, 40)];
const rpoly = n => Array.from({length: n}, rpt);

const shapes = [
  [[0,0],[10,0],[10,10],[0,10]],                     // square
  [[0,0],[20,0],[20,10],[10,10],[10,20],[0,20]],     // L
  [[0,0],[10,0],[5,8]],                              // triangle
  G.rectPts(15, 15, 12, 6, 0.7),                     // turned rectangle
  [[0,0],[10,10],[10,0],[0,10]],                     // bowtie (crosses itself)
  [[10,0],[20,0],[20,10],[10,10]],                   // shares an edge with the square
  [[5,5],[15,5],[15,15],[5,15]],                     // overlaps the square
  [[0,0],[1,0],[2,0]],                               // flat, no area
  ...Array.from({length: 8}, (_, i) => rpoly(3 + i % 6)),
];
const points = Array.from({length: 40}, rpt).concat([[0,0],[10,10],[5,0],[10,5]]);
const lines = Array.from({length: 14}, () => rpoly(2 + Math.floor(rnd() * 3)));
const cases = [];
const add = (fn, args) => cases.push({fn, args, out: G[fn](...args)});

for (const s of shapes) {
  for (const f of ["area", "perimeter", "lineLength", "centroid", "bbox", "selfCrosses"]) add(f, [s]);
  for (const p of points) { add("inPoly", [p[0], p[1], s]); add("distToEdge", [p[0], p[1], s]); add("deepInside", [p[0], p[1], s, 0.5]); }
  for (const l of lines) { add("lineShapeDist", [l, s]); add("lineEntersShape", [l, s]); }
  for (const t of shapes) if (t.length >= 3 && s.length >= 3) add("shapesOverlap", [s, t]);
}
for (let i = 0; i < 80; i++) {
  const [a, b, c, d] = [rpt(), rpt(), rpt(), rpt()], p = rpt();
  add("segCross", [a, b, c, d]); add("segSegDist", [a, b, c, d]); add("segProj", [p[0], p[1], a, b]);
}
add("segCross", [[0,0],[10,0],[10,0],[20,0]]);      // collinear, touching ends
add("segProj", [3, 4, [1,1], [1,1]]);               // zero-length segment
add("rectPts", [10, 5, 8, 4, 0]); add("rectPts", [10, 5, 8, 4, 1.234]);
add("dist", [[0,0],[3,4]]);
fs.writeFileSync(path.join(__dirname, "../godot/tests/geometry_cases.json"), JSON.stringify(cases));
console.log(cases.length, "cases;", cases.filter(c => c.out === null || (typeof c.out === "number" && !isFinite(c.out))).length, "non-finite");
