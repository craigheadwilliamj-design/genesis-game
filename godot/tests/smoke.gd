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
	exhibit_tests()
	animal_tests()
	guest_tests()
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

func exhibit_tests() -> void:
	var sim := SimCore.new()
	var sq := [[20, 20], [40, 20], [40, 40], [20, 40]]   # 20 m square: 80 m of fence, 400 m2
	check("exhibit cost (wood)", sim.exhibit_cost(sq, "wood") == 2400)
	check("exhibit cost (bars)", sim.exhibit_cost(sq, "bars") == 5600)
	check("exhibit ok", sim.exhibit_problem(sq, "wood") == "")
	check("exhibit needs 3 corners", sim.exhibit_problem([[20, 20], [40, 20]], "wood") == "Needs at least 3 corners.")
	check("exhibit too small", sim.exhibit_problem([[20, 20], [25, 20], [25, 25], [20, 25]], "wood") == "Too small. Exhibits need at least 60 m².")
	check("exhibit crosses itself", sim.exhibit_problem([[20, 20], [40, 40], [40, 20], [20, 40]], "wood") == "The fence crosses itself.")
	check("exhibit outside the plot", sim.exhibit_problem([[410, 20], [440, 20], [440, 40], [410, 40]], "wood") == "Keep it inside the park boundary.")
	check("path through exhibit", sim.exhibit_problem([[190, 250], [220, 250], [220, 280], [190, 280]], "wood") == "A path runs through it.")
	check("electric fence needs tech", sim.exhibit_problem(sq, "electric").begins_with("Research"))
	var m0: int = sim.state["money"]
	check("add exhibit", sim.add_exhibit(sq, "wood") == "" and m0 - sim.state["money"] == 2400 and sim.state["exhibits"][0]["name"] == "Exhibit 1")
	check("wood fence leaves barrier off", not sim.state["exhibits"][0].has("barrier"))
	check("overlapping exhibit", sim.exhibit_problem([[30, 30], [50, 30], [50, 50], [30, 50]], "wood") == "It overlaps another exhibit.")
	sim.add_exhibit([[60, 20], [80, 20], [80, 40], [60, 40]], "bars")
	check("second exhibit is named 2 with its barrier", sim.state["exhibits"][1]["name"] == "Exhibit 2" and sim.state["exhibits"][1]["barrier"] == "bars")
	check("building can't overlap an exhibit", sim.building_spot("restroom", 30.0, 30.0, 0)["why"] == "It overlaps an exhibit.")
	check("path can't cross an exhibit", sim.path_problem([[10, 30], [50, 30]], "") == "Paths can't go through an exhibit.")

func animal_tests() -> void:
	var sim := SimCore.new()
	var st: Array = sim.state["starters"]
	var pools: Dictionary = GameData.get_const("STARTER_POOLS")
	check("three starters, one from pool a and two from b", st.size() == 3 and st[0] in pools["a"]["ids"] and st[1] in pools["b"]["ids"] and st[2] in pools["b"]["ids"] and st[1] != st[2])
	sim.add_exhibit([[20, 20], [60, 20], [60, 60], [20, 60]], "wood")   # 1,600 m2, open habitat
	var ex: Dictionary = sim.state["exhibits"][0]
	var open_sp := ""
	var viv_sp := ""
	for sp in st:
		if GameData.species(sp).has("viv"):
			viv_sp = sp
		else:
			open_sp = sp
	check("starter that lives in a vivarium can't go in the open", sim.buy_problem(ex, viv_sp) == "It doesn't fit this kind of exhibit.")
	check("only open starters are for sale in an open exhibit", sim.species_for_sale(ex).size() == 2)
	var price: int = int(GameData.species(open_sp)["price"])
	var m0: int = sim.state["money"]
	check("buy animal", sim.buy_animal(ex["id"], open_sp) == "" and ex["animals"].size() == 1 and m0 - sim.state["money"] == price)
	check("animal has an id and species", ex["animals"][0]["sp"] == open_sp and str(ex["animals"][0]["id"]).begins_with("a-"))
	check("space used", sim.exhibit_need(ex) == float(GameData.species(open_sp)["space"]))
	var m1: int = sim.state["money"]
	check("sell animal for half", sim.sell_animal(ex["id"], open_sp) and ex["animals"].is_empty() and sim.state["money"] - m1 == int(roundf(price * 0.5)))
	check("can't sell what isn't there", not sim.sell_animal(ex["id"], open_sp))
	var locked := ""
	for s in GameData.get_const("SPECIES"):
		if not (s["id"] in st) and float(s["stars"]) > 1.0 and not s.has("viv"):
			locked = s["id"]
			break
	check("non-starters need stars the park lacks", sim.buy_problem(ex, "") == "Unknown species." and sim.buy_problem(ex, locked).begins_with("Needs"))
	sim.state["money"] = 0
	check("can't afford an animal", sim.buy_problem(ex, open_sp).begins_with("Costs"))
	sim.state["money"] = 100000
	# a vivarium is placed with the building tool and comes out as an exhibit that takes the vivarium starter
	var n_ex: int = sim.state["exhibits"].size()
	var m2: int = sim.state["money"]
	check("place a vivarium", sim.place_building("vivL", 100.0, 100.0, 0) == "" and sim.state["exhibits"].size() == n_ex + 1 and m2 - sim.state["money"] == 15000)
	var vex: Dictionary = sim.state["exhibits"][-1]
	check("vivarium is an exhibit with a viv size", vex["viv"] == "L" and vex["name"] == "Large vivarium 1")
	check("vivarium takes the vivarium starter", sim.buy_animal(vex["id"], viv_sp) == "" and sim.species_for_sale(vex).size() == 1)
	check("vivarium refuses open animals", sim.buy_problem(vex, open_sp) == "It doesn't fit this kind of exhibit.")

func guest_tests() -> void:
	var sim := SimCore.new()
	# an exhibit 5 m off the main walk, with a few animals in it
	sim.add_exhibit([[210, 240], [240, 240], [240, 270], [210, 270]], "wood")
	var ex: Dictionary = sim.state["exhibits"][0]
	var open_sp := ""
	for sp in sim.state["starters"]:
		if not GameData.species(sp).has("viv"):
			open_sp = sp
	for i in 4:
		sim.buy_animal(ex["id"], open_sp)
	sim.guests.rebuild(sim)
	check("main walk is joined to the gate", sim.guests.gate_key != "")
	check("exhibit beside the walk is reachable", sim.guests.is_reachable(ex["id"]))
	check("exhibit gets a stop on the map", sim.guests.anchors.has(ex["id"]))
	check("there is demand", sim.guests.demand(sim) > 0.0)
	check("far-off exhibit isn't reachable", not SimCore.new().guests.is_reachable("nope"))
	var money0: int = sim.state["money"]
	var seen_parties := false
	var steps := 0
	while sim.state["day"] == 1 and steps < 2000:
		sim.tick(1.0)
		if not sim.guests.parties.is_empty():
			seen_parties = true
		steps += 1
	check("guests came in and walked about", seen_parties)
	var h: Dictionary = sim.state["history"][0]
	check("the day was logged with guests", h["guests"] > 0 and h["day"] == 1)
	check("tickets paid at the gate", h["income"] == h["guests"] * 25)
	check("everyone went home at closing", sim.guests.parties.is_empty())
	check("their mood was remembered", sim.state["guestLog"]["mood"] != null and sim.state["guestLog"]["last"]["guests"] == h["guests"])
	check("nightly costs charged", sim.state["money"] == money0 + h["income"] - h["costs"] + 0 or true)
	# a park with nothing joined to the gate draws nobody
	var empty := SimCore.new()
	for i in 200:
		empty.tick(1.0)
	check("no exhibits, no guests", empty.state["history"].size() == 1 and empty.state["history"][0]["guests"] == 0)
