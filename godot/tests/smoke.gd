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
	path_tests()
	building_tests()
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

func path_tests() -> void:
	var sim := SimCore.new()
	check("path cost (100 m footpath)", sim.path_cost([[0, 0], [100, 0]], "") == 1500)
	check("path cost (100 m wide path)", sim.path_cost([[0, 0], [100, 0]], "wide") == 3000)
	check("path too short", sim.path_problem([[10, 10], [11, 10]], "") == "Too short.")
	check("path outside the plot", sim.path_problem([[400, 10], [500, 10]], "") == "Keep it inside the park boundary.")
	check("path needs two points", sim.path_problem([[10, 10]], "") == "Needs at least 2 points.")
	check("path ok", sim.path_problem([[205, 235], [205, 100]], "") == "")
	var m0: int = sim.state["money"]
	check("add path", sim.add_path([[205, 235], [205, 100]], "", [null, null]) == "" and sim.state["paths"].size() == 2 and m0 - sim.state["money"] == 2025)
	check("path has no type field when plain", not sim.state["paths"][1].has("type"))
	sim.add_path([[100, 300], [205, 270]], "service", [null, {"type": "seg", "kind": "path", "id": "p-main"}])
	check("junction added to the path it lands on", sim.state["paths"][0]["points"].size() == 3 and sim.state["paths"][2]["type"] == "service")
	sim.state["money"] = 10
	check("can't afford", sim.add_path([[0, 0], [100, 0]], "", [null, null]).begins_with("Costs $1,500."))

func building_tests() -> void:
	var sim := SimCore.new()
	# a restroom pointed at the main walk snaps beside it: 2.5 m half width + 0.5 + half its 6 m depth
	var spot: Dictionary = sim.building_spot("restroom", 215.0, 270.0, 0)
	check("restroom snaps beside the path", spot["ok"] and spot["has_path"] and absf(spot["x"] - 211.0) < 1e-6 and absf(spot["y"] - 270.0) < 1e-6)
	check("restroom far from paths is fine", sim.building_spot("restroom", 50.0, 50.0, 0)["ok"])
	check("restroom far from paths has no path", not sim.building_spot("restroom", 50.0, 50.0, 0)["has_path"])
	check("bin needs a path", sim.building_spot("bin", 50.0, 50.0, 0)["why"] == "Move it next to a path.")
	check("outside the plot", sim.building_spot("restroom", 2.0, 2.0, 0)["why"] == "Keep it inside the park boundary.")
	var m0: int = sim.state["money"]
	check("place restroom", sim.place_building("restroom", 215.0, 270.0, 0) == "" and sim.state["buildings"].size() == 1 and m0 - sim.state["money"] == 4000)
	check("no overlapping buildings", sim.place_building("restroom", 215.0, 272.0, 0) == "It overlaps another building.")
	check("restaurant needs 2 stars", sim.building_spot("restaurant", 195.0, 270.0, 0)["why"] == "Your park needs 2 stars first.")
	check("tram station needs tech", sim.building_spot("tramstop", 195.0, 270.0, 0)["why"].begins_with("Research"))
	check("oracle is one per park", sim.place_building("oracle", 195.0, 270.0, 0) == "" and sim.building_spot("oracle", 195.0, 150.0, 0)["why"] == "You already have ORACLE. There's one per park.")
	# the greenhouse is behind an ORACLE tech and CERES; tech is checked first, as in the JS
	check("greenhouse needs its tech first", sim.building_spot("greenhouse", 195.0, 150.0, 0)["why"].begins_with("Research"))
	sim.state["science"]["tech"].append("greenhouse")
	check("then it needs CERES", sim.building_spot("greenhouse", 195.0, 150.0, 0)["why"] == "Build CERES first.")
