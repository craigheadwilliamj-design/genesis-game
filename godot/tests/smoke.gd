extends SceneTree
# Headless checks. Run from the repo root:
#   godot --headless --path godot --script res://tests/smoke.gd
const GameData = preload("res://scripts/data.gd")
const SimCore = preload("res://scripts/sim.gd")
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
	quit(1 if fails > 0 else 0)
