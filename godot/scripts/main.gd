extends Node2D
# Map view: pan and zoom camera, the 5 m grid, land parcels, the home plot and entrance, plus a small HUD.
# Units are meters (same as the JS game), so 1 world unit = 1 m.
const GameData = preload("res://scripts/data.gd")
const SimCore = preload("res://scripts/sim.gd")

const GRID := 5.0
const PAN_KEYS_SPEED := 400.0   # screen px per second at zoom 1
var sim: SimCore
var cam: Camera2D
var hud: Label
var speed := 1                  # 0 paused, 1 / 2 / 3 fast
var dragging := false

func _ready() -> void:
	sim = SimCore.new()
	cam = Camera2D.new()
	add_child(cam)
	cam.position = Vector2(210, 152)
	cam.zoom = Vector2(2.2, 2.2)
	var layer := CanvasLayer.new()
	add_child(layer)
	hud = Label.new()
	hud.position = Vector2(12, 8)
	hud.add_theme_font_size_override("font_size", 20)
	hud.add_theme_color_override("font_outline_color", Color.BLACK)
	hud.add_theme_constant_override("outline_size", 4)
	layer.add_child(hud)
	sim.changed.connect(_refresh_hud)
	_refresh_hud()

func _process(delta: float) -> void:
	if speed > 0:
		var per_sec := float(GameData.get_const("MINUTES_PER_SECOND", 12))
		sim.tick(delta * per_sec * speed)
	var dir := Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")
	if dir != Vector2.ZERO:
		cam.position += dir * PAN_KEYS_SPEED * delta / cam.zoom.x

func _refresh_hud() -> void:
	var s: Dictionary = sim.state
	hud.text = "Day %d   %s   $%s   x%d%s" % [s["day"], sim.clock_text(), _commas(int(s["money"])), speed, "  (paused)" if speed == 0 else ""]

func _commas(n: int) -> String:
	var t := str(absi(n))
	var out := ""
	while t.length() > 3:
		out = "," + t.substr(t.length() - 3) + out
		t = t.substr(0, t.length() - 3)
	return ("-" if n < 0 else "") + t + out

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		var mb := event as InputEventMouseButton
		if mb.pressed and (mb.button_index == MOUSE_BUTTON_WHEEL_UP or mb.button_index == MOUSE_BUTTON_WHEEL_DOWN):
			_zoom_at(1.15 if mb.button_index == MOUSE_BUTTON_WHEEL_UP else 1.0 / 1.15)
		elif mb.button_index == MOUSE_BUTTON_MIDDLE or mb.button_index == MOUSE_BUTTON_RIGHT:
			dragging = mb.pressed
	elif event is InputEventMouseMotion and dragging:
		cam.position -= (event as InputEventMouseMotion).relative / cam.zoom.x
	elif event is InputEventKey and event.pressed and not event.echo:
		match (event as InputEventKey).keycode:
			KEY_SPACE: speed = 0 if speed > 0 else 1
			KEY_1: speed = 1
			KEY_2: speed = 2
			KEY_3: speed = 3
		_refresh_hud()

# Zoom keeping the point under the mouse where it is
func _zoom_at(factor: float) -> void:
	var before := get_global_mouse_position()
	var z := clampf(cam.zoom.x * factor, 0.4, 12.0)
	cam.zoom = Vector2(z, z)
	cam.position += before - get_global_mouse_position()

func _draw() -> void:
	var parcels: Dictionary = GameData.get_const("PARCELS", {})
	var xs: Array = parcels.get("xs", [])
	var ys: Array = parcels.get("ys", [])
	# land for sale: faint parcel outlines
	for i in range(xs.size() - 1):
		for j in range(ys.size() - 1):
			var r := Rect2(xs[i], ys[j], xs[i + 1] - xs[i], ys[j + 1] - ys[j])
			draw_rect(r, Color(0, 0, 0, 0.12), false, 0.6)
	# the home plot, with its 5 m grid
	var plot := Rect2(0, 0, 420, 305)
	draw_rect(plot, Color(0.45, 0.62, 0.38))
	var gc := Color(1, 1, 1, 0.12)
	var x := 0.0
	while x <= plot.size.x:
		draw_line(Vector2(x, 0), Vector2(x, plot.size.y), gc, 0.15)
		x += GRID
	var y := 0.0
	while y <= plot.size.y:
		draw_line(Vector2(0, y), Vector2(plot.size.x, y), gc, 0.15)
		y += GRID
	draw_rect(plot, Color(0.95, 0.85, 0.45), false, 1.2)
	# paths and the entrance gate
	for p in sim.state["paths"]:
		var pts := PackedVector2Array()
		for q in p["points"]:
			pts.append(Vector2(q[0], q[1]))
		draw_polyline(pts, Color(0.78, 0.72, 0.6), 4.0)
	var g: Array = sim.state["gate"]
	draw_circle(Vector2(g[0], g[1]), 4.0, Color(0.85, 0.65, 0.2))
