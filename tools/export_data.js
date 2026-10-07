// Dumps the constants in js/data.js to godot/data/data.json so the Godot port reads the same numbers.
// Run: node tools/export_data.js   (re-run after any balance change in data.js)
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "../js/data.js"), "utf8");
const names = new Set([...src.matchAll(/^const ([A-Z_][A-Z0-9_]*)/gm)].map(m => m[1]));
for (const m of src.matchAll(/^const [A-Z_][A-Z0-9_]*\s*=[^;\n]*?,\s*([A-Z_][A-Z0-9_]*)\s*=/gm)) names.add(m[1]);
const body = src + "\nreturn {" + [...names].map(n => `${n}: typeof ${n} === 'undefined' ? undefined : ${n}`).join(",") + "};";
const all = new Function(body)();
const out = {}, skipped = [];
for (const [k, v] of Object.entries(all)) {
  if (v === undefined || typeof v === "function") { skipped.push(k); continue; }
  out[k] = v;
}
fs.writeFileSync(path.join(__dirname, "../godot/data/data.json"), JSON.stringify(out));
console.log("exported", Object.keys(out).length, "constants" + (skipped.length ? "; skipped " + skipped.join(", ") : ""));
