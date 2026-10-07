extends Node2D
# Draws the parties in the park as dots in four shirt colors, bigger for bigger parties.
const SHIRTS := [Color(0.95, 0.35, 0.3), Color(0.3, 0.55, 0.95), Color(0.95, 0.85, 0.3), Color(0.9, 0.9, 0.9)]

var sim

func _process(_delta: float) -> void:
	if not sim.guests.parties.is_empty():
		queue_redraw()

func _draw() -> void:
	for p in sim.guests.parties:
		var pos: Vector2 = sim.guests.party_pos(p)
		var r := 0.9 + 0.2 * float(p["n"])
		draw_circle(pos, r + 0.3, Color(0, 0, 0, 0.6))
		draw_circle(pos, r, SHIRTS[p["shirt"]])
