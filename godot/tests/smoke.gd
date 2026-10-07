extends SceneTree
# Headless checks. Run from the repo root:
#   godot --headless --path godot --script res://tests/smoke.gd
const GameData = preload("res://scripts/data.gd")
const SimCore = preload("res://scripts/sim.gd")
const Geo = preload("res://scripts/geometry.gd")
var fails := 0

func check(name: String, ok: bool) -> void:
	print(("PASS " if ok else "FAIL ") + name)
	if not ok:
		fails += 1

func _init() -> void:
	check("species loaded", GameData.get_const("SPECIES", []).size() > 100)
	check("species lookup", GameData.species("icht").get("name", "") == "Ichthyostega")
	var sim := SimCore.new()
	check("starting money", sim.state["money"] == int(GameData.get_const("START")["money"]))
	sim.spend(1000, "built")
	check("spend", sim.state["money"] == 149000 and sim.state["today"]["built"] == 1000)
	sim.tick(sim.close_min() - sim.open_min())
	check("day rolls over", sim.state["day"] == 2 and sim.state["minute"] == sim.open_min())
	sim.save_game("user://smoke_save.json")
	var other := SimCore.new()
	check("save round trip", other.load_game("user://smoke_save.json") and other.state["day"] == 2)
	geometry_parity()
	quit(1 if fails > 0 else 0)

# geometry.gd must give the same answers as js/geometry.js (cases made by tools/geometry_cases.js)
func geometry_parity() -> void:
	var cases = JSON.parse_string(FileAccess.get_file_as_string("res://tests/geometry_cases.json"))
	if not (cases is Array):
		check("geometry cases file", false)
		return
	var bad := {}
	var total := {}
	for c in cases:
		var fn: String = c["fn"]
		total[fn] = total.get(fn, 0) + 1
		var got = call_geo(fn, c["args"])
		if not same(got, c["out"]):
			bad[fn] = bad.get(fn, 0) + 1
			if bad[fn] <= 2:
				print("  mismatch ", fn, " args=", c["args"], " js=", c["out"], " godot=", got)
	for fn in total:
		check("geometry %s (%d cases)" % [fn, total[fn]], not bad.has(fn))

func call_geo(fn: String, a: Array):
	match fn:
		"dist": return Geo.dist(a[0], a[1])
		"area": return Geo.area(a[0])
		"perimeter": return Geo.perimeter(a[0])
		"lineLength": return Geo.line_length(a[0])
		"centroid": return Geo.centroid(a[0])
		"bbox": return Geo.bbox(a[0])
		"inPoly": return Geo.in_poly(a[0], a[1], a[2])
		"segProj": return Geo.seg_proj(a[0], a[1], a[2], a[3])
		"segCross": return Geo.seg_cross(a[0], a[1], a[2], a[3])
		"segSegDist": return Geo.seg_seg_dist(a[0], a[1], a[2], a[3])
		"distToEdge": return Geo.dist_to_edge(a[0], a[1], a[2])
		"deepInside": return Geo.deep_inside(a[0], a[1], a[2], a[3])
		"lineShapeDist": return Geo.line_shape_dist(a[0], a[1])
		"lineEntersShape": return Geo.line_enters_shape(a[0], a[1])
		"shapesOverlap": return Geo.shapes_overlap(a[0], a[1])
		"selfCrosses": return Geo.self_crosses(a[0])
		"rectPts": return Geo.rect_pts(a[0], a[1], a[2], a[3], a[4])
	push_error("unknown geometry fn " + fn)
	return null

func same(a, b) -> bool:
	if a is Array and b is Array:
		if a.size() != b.size():
			return false
		for i in a.size():
			if not same(a[i], b[i]):
				return false
		return true
	if a is Dictionary and b is Dictionary:
		for k in b:
			if not a.has(k) or not same(a[k], b[k]):
				return false
		return a.size() == b.size()
	if (a is float or a is int) and (b is float or b is int):
		return absf(float(a) - float(b)) < 1e-6
	return a == b
