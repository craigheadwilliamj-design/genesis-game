extends RefCounted
# The park simulation: no nodes, no drawing, so it can run headless in tests.
# Port of js/sim.js. Only the clock and the money so far; add systems here one at a time.
const GameData = preload("res://scripts/data.gd")

signal changed
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
