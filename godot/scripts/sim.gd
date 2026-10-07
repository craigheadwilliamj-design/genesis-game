extends RefCounted
# The park simulation: no nodes, no drawing, so it can run headless in tests.
# Port of js/sim.js. Only the clock and the money so far; add systems here one at a time.
const GameData = preload("res://scripts/data.gd")
const Geo = preload("res://scripts/geometry.gd")

const PATH_HALF_WIDTH := 2.5   # footpaths are 5 m wide
const UID_CHARS := "0123456789abcdefghijklmnopqrstuvwxyz"
# the home plot (PARK_PLOT in sim.js). Land for sale comes later.
const HOME_PLOT := Rect2(0, 0, 420, 305)

signal changed
signal layout_changed   # something was built or removed: redraw the map
signal day_ended(day: int)

var state: Dictionary = {}

func _init() -> void:
	state = new_park()

func open_min() -> float:
	return float(GameData.get_const("OPEN_MIN", 480))

func close_min() -> float:
	return float(GameData.get_const("CLOSE_MIN", 1200))

func new_park() -> Dictionary:
	var start: Dictionary = GameData.get_const("START", {})
	return {
		"version": 1,
		"name": "Genesis Park",
		"money": int(start.get("money", 150000)),
		"ticket": int(start.get("ticket", 25)),
		"rating": float(start.get("rating", 1)),
		"day": 1,
		"minute": open_min(),
		# home plot: x, y, w, h in meters (PARK_PLOT in sim.js)
		"boundary": [[0, 0], [420, 0], [420, 305], [0, 305]],
		"parcels": [],
		"gate": [205, 305],
		"exhibits": [],
		"decor": [], "water": [], "fences": [],
		"paths": [{"id": "p-main", "name": "Main walk", "points": [[205, 305], [205, 235]], "fixed": true}],
		"buildings": [],
		"today": fresh_ledger(),
		"history": [],
		"goalsDone": [],
		"over": false,
	}

func fresh_ledger() -> Dictionary:
	return {"guests": 0, "tickets": 0, "food": 0, "shop": 0, "feed": 0, "wages": 0, "upkeep": 0, "built": 0}

func spend(cost: int, kind: String) -> void:
	state["money"] -= cost
	state["today"][kind] = state["today"].get(kind, 0) + cost

func earn(amount: int, kind: String) -> void:
	state["money"] += amount
	state["today"][kind] = state["today"].get(kind, 0) + amount

func can_afford(cost: int) -> bool:
	return state["money"] >= cost

func money_text(n: int) -> String:
	var t := str(absi(n))
	var out := ""
	while t.length() > 3:
		out = "," + t.substr(t.length() - 3) + out
		t = t.substr(0, t.length() - 3)
	return ("-$" if n < 0 else "$") + t + out

func uid(prefix: String) -> String:
	var s := prefix
	for i in 7:
		s += UID_CHARS[randi() % UID_CHARS.length()]
	return s

# ---------- paths ----------
# A path's type is "" (footpath), "wide" or "service". Tram track and bridges come later.

func path_per_meter(type: String) -> float:
	match type:
		"service": return float(GameData.get_const("SERVICE_ROAD")["perMeter"])
		"wide": return float(GameData.get_const("WIDE_PATH")["perMeter"])
	return float(GameData.get_const("COST")["pathPerMeter"])

func half_width(type: String) -> float:
	match type:
		"service": return float(GameData.get_const("SERVICE_ROAD")["halfWidth"])
		"wide": return float(GameData.get_const("WIDE_PATH")["halfWidth"])
	return PATH_HALF_WIDTH

func path_name(type: String) -> String:
	match type:
		"service": return "Service road"
		"wide": return "Wide path"
	return "Path"

func path_cost(pts: Array, type: String) -> int:
	return int(roundf(Geo.line_length(pts) * path_per_meter(type)))

func in_owned(x: float, y: float) -> bool:
	return x >= HOME_PLOT.position.x - 1e-6 and y >= HOME_PLOT.position.y - 1e-6 and x <= HOME_PLOT.end.x + 1e-6 and y <= HOME_PLOT.end.y + 1e-6

# The plot is one rectangle, so checking the corners of a line is enough
func inside_plot(pts: Array) -> bool:
	for p in pts:
		if not in_owned(p[0], p[1]):
			return false
	return true

# Why this path can't be built, or "" if it can (pathProblem in map.js)
func path_problem(pts: Array, type: String) -> String:
	if pts.size() < 2:
		return "Needs at least 2 points."
	if Geo.line_length(pts) < 2.0:
		return "Too short."
	if not inside_plot(pts):
		return "Keep it inside the park boundary."
	for e in state["exhibits"]:
		if Geo.line_enters_shape(pts, e["points"]):
			return "Paths can't go through an exhibit."
	var buildings: Dictionary = GameData.get_const("BUILDINGS")
	for b in state["buildings"]:
		if not buildings[b["type"]].get("onPath", false) and Geo.line_enters_shape(pts, b["points"]):
			return "Paths can't go through a building."
	var cost := path_cost(pts, type)
	if not can_afford(cost):
		return "Costs %s. You have %s." % [money_text(cost), money_text(int(state["money"]))]
	return ""

# When a new path lands in the middle of another path, add a shared corner there so they really join
func insert_junction(path_id: String, x: float, y: float) -> void:
	for q in state["paths"]:
		if q["id"] != path_id:
			continue
		var pts: Array = q["points"]
		for v in pts:
			if Geo.dist(v, [x, y]) < 0.05:
				return
		for i in range(pts.size() - 1):
			if Geo.seg_proj(x, y, pts[i], pts[i + 1])["d"] < 0.05:
				pts.insert(i + 1, [x, y])
				return
		return

# Build a path. snaps[i] says what point i was snapped to (null for open ground). Returns "" or the reason it failed.
func add_path(pts: Array, type: String, snaps: Array) -> String:
	var problem := path_problem(pts, type)
	if problem != "":
		return problem
	for i in snaps.size():
		var sn = snaps[i]
		if sn != null and sn.get("kind", "") == "path" and sn.get("type", "") == "seg":
			insert_junction(sn["id"], pts[i][0], pts[i][1])
	spend(path_cost(pts, type), "built")
	var p := {"id": uid("p-"), "name": path_name(type), "points": pts.duplicate(true)}
	if type != "":
		p["type"] = type
	state["paths"].append(p)
	layout_changed.emit()
	changed.emit()
	return ""

# Move the park forward by dt_min park minutes (tick in sim.js)
func tick(dt_min: float) -> void:
	if state["over"]:
		return
	var m1: float = minf(close_min(), float(state["minute"]) + dt_min)
	state["minute"] = m1
	changed.emit()
	if m1 >= close_min():
		end_day()

func end_day() -> void:
	state["history"].append({"day": state["day"], "money": state["money"]})
	state["day"] += 1
	state["minute"] = open_min()
	state["today"] = fresh_ledger()
	day_ended.emit(state["day"] - 1)
	changed.emit()

func clock_text() -> String:
	var m := int(state["minute"])
	var h := m / 60
	return "%d:%02d %s" % [(h + 11) % 12 + 1, m % 60, "AM" if h < 12 else "PM"]

func save_game(path: String = "user://save.json") -> void:
	var f := FileAccess.open(path, FileAccess.WRITE)
	f.store_string(JSON.stringify(state))

func load_game(path: String = "user://save.json") -> bool:
	if not FileAccess.file_exists(path):
		return false
	var parsed = JSON.parse_string(FileAccess.get_file_as_string(path))
	if parsed is Dictionary:
		state = parsed
		changed.emit()
		return true
	return false
