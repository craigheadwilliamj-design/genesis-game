extends Node2D
# Live animal dots wandering inside their exhibits. Positions aren't saved: they're made up fresh from the sim state.
# Vivarium animals stay put. Open-habitat animals walk to a random spot, wait a bit, and go again.
const GameData = preload("res://scripts/data.gd")
const Geo = preload("res://scripts/geometry.gd")

const SPEED := 3.0   # meters per second

var sim
var walkers := {}    # animal id -> {pos, target, wait, ex, sp}

func _process(delta: float) -> void:
	var seen := {}
	for e in sim.state["exhibits"]:
		for a in e["animals"]:
			seen[a["id"]] = true
			var w = walkers.get(a["id"])
			if w == null or w["ex"] != e["id"]:
				var p := Geo.random_inside(e["points"])
				w = {"pos": Vector2(p[0], p[1]), "target": null, "wait": randf_range(0.0, 2.0), "ex": e["id"], "sp": a["sp"]}
				walkers[a["id"]] = w
			if not e.has("viv"):
				_step(w, e, delta)
	for id in walkers.keys():
		if not seen.has(id):
			walkers.erase(id)
	if not walkers.is_empty():
		queue_redraw()

func _step(w: Dictionary, e: Dictionary, delta: float) -> void:
	if w["wait"] > 0.0:
		w["wait"] -= delta
		return
	if w["target"] == null:
		var p := Geo.random_inside(e["points"])
		w["target"] = Vector2(p[0], p[1])
	var to: Vector2 = w["target"] - w["pos"]
	var d := to.length()
	var step := SPEED * delta
	if d <= step:
		w["pos"] = w["target"]
		w["target"] = null
		w["wait"] = randf_range(1.0, 4.0)
	else:
		w["pos"] += to / d * step

func _draw() -> void:
	var colors: Dictionary = GameData.get_const("PERIOD_COLOR", {})
	for id in walkers:
		var w: Dictionary = walkers[id]
		var s: Dictionary = GameData.species(w["sp"])
		var r := clampf(0.8 + sqrt(float(s.get("space", 10))) * 0.08, 1.0, 3.5)
		draw_circle(w["pos"], r + 0.3, Color(0, 0, 0, 0.55))
		draw_circle(w["pos"], r, Color.html(colors.get(s.get("period", ""), "#ffffff")))
