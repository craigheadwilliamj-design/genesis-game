extends Node2D
# Map view: pan and zoom camera, the 5 m grid, land parcels, the home plot and entrance, the path tool, and a small HUD.
# Units are meters (same as the JS game), so 1 world unit = 1 m.
const GameData = preload("res://scripts/data.gd")
const SimCore = preload("res://scripts/sim.gd")
const Geo = preload("res://scripts/geometry.gd")

const GRID := 5.0
const PAN_KEYS_SPEED := 400.0   # screen px per second at zoom 1
const TOOLS := {"pan": "Pan", "path": "Path", "wide": "Wide path", "service": "Service road"}
const PATH_COLORS := {"": Color(0.80, 0.74, 0.62), "wide": Color(0.87, 0.81, 0.69), "service": Color(0.52, 0.52, 0.55)}

var sim: SimCore
var cam: Camera2D
var hud: Label
var status: Label
var speed := 1                  # 0 paused, 1 / 2 / 3 fast
var dragging := false
var tool := "pan"
var draw_pts: Array = []        # corners of the path being drawn
var draw_snaps: Array = []      # what each corner snapped to (null for open ground)
var hover: Dictionary = {}      # the snapped point under the mouse while a draw tool is active
var toast_until := 0

func _ready() -> void:
	sim = SimCore.new()
	cam = Camera2D.new()
	add_child(cam)
	cam.position = Vector2(210, 152)
	cam.zoom = Vector2(2.2, 2.2)
	var layer := CanvasLayer.new()
	add_child(layer)
	hud = _label(layer, 12, 8, 20)
	status = _label(layer, 12, 0, 16)
	status.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	status.offset_left = 12
	status.offset_top = -92
	var bar := HBoxContainer.new()
	layer.add_child(bar)
	bar.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	bar.offset_left = 12
	bar.offset_top = -56
	bar.offset_right = 520
	bar.offset_bottom = -12
	var group := ButtonGroup.new()
	for t in TOOLS:
		var b := Button.new()
		b.text = TOOLS[t]
		b.toggle_mode = true
		b.button_group = group
		b.button_pressed = t == "pan"
		b.focus_mode = Control.FOCUS_NONE
		b.add_to_group("tool_buttons")
		b.pressed.connect(_set_tool.bind(t))
		bar.add_child(b)
	sim.changed.connect(_refresh_hud)
	sim.layout_changed.connect(queue_redraw)
	_refresh_hud()

func _label(parent: Node, x: float, y: float, size: int) -> Label:
	var l := Label.new()
	l.position = Vector2(x, y)
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_outline_color", Color.BLACK)
	l.add_theme_constant_override("outline_size", 4)
	parent.add_child(l)
	return l

func _set_tool(t: String) -> void:
	tool = t
	draw_pts.clear()
	draw_snaps.clear()
	hover = {}
	_set_status("" if t == "pan" else "%s: click to add points. Click the last point again, or press Enter, to finish. Esc cancels." % TOOLS[t])
	queue_redraw()

func _path_type() -> String:
	return "" if tool == "path" else tool

func _set_status(text: String, bad := false, hold_ms := 0) -> void:
	status.text = text
	status.add_theme_color_override("font_color", Color(1, 0.55, 0.5) if bad else Color.WHITE)
	toast_until = Time.get_ticks_msec() + hold_ms

func _process(delta: float) -> void:
	if speed > 0:
		var per_sec := float(GameData.get_const("MINUTES_PER_SECOND", 12))
		sim.tick(delta * per_sec * speed)
	var dir := Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")
	dir.x += float(Input.is_key_pressed(KEY_D)) - float(Input.is_key_pressed(KEY_A))
	dir.y += float(Input.is_key_pressed(KEY_S)) - float(Input.is_key_pressed(KEY_W))
	if dir != Vector2.ZERO:
		cam.position += dir.limit_length(1.0) * PAN_KEYS_SPEED * delta / cam.zoom.x
	if tool != "pan":
		hover = snap_at(get_global_mouse_position(), Input.is_key_pressed(KEY_ALT))
		_preview_status()
		queue_redraw()

func _refresh_hud() -> void:
	var s: Dictionary = sim.state
	hud.text = "Day %d   %s   %s   x%d%s" % [s["day"], sim.clock_text(), sim.money_text(int(s["money"])), speed, "  (paused)" if speed == 0 else ""]

# The line under construction, with the hovered point as its end, and what it would cost or why it can't be built
func _preview_pts() -> Array:
	var pts := draw_pts.duplicate()
	if not hover.is_empty():
		pts.append([hover["x"], hover["y"]])
	return pts

func _preview_status() -> void:
	if Time.get_ticks_msec() < toast_until or draw_pts.is_empty():
		return
	var pts := _preview_pts()
	var type := _path_type()
	var problem := sim.path_problem(pts, type)
	if problem != "":
		_set_status(problem, true)
	else:
		_set_status("%s, %d m: %s. Click the last point again to build." % [TOOLS[tool], int(Geo.line_length(pts)), sim.money_text(sim.path_cost(pts, type))])

# ---------- snapping (snapAt in map.js) ----------
# Nearest corner, entrance or path to the point, so a new path really joins what it starts on. Alt skips snapping.
func snap_at(p: Vector2, free: bool) -> Dictionary:
	var open := {"x": p.x, "y": p.y, "info": null}
	if free:
		return open
	var r := 12.0 / cam.zoom.x
	var paths: Array = sim.state["paths"]
	var near_vertex := false
	for q in paths:
		for v in q["points"]:
			if Vector2(v[0], v[1]).distance_to(p) < r:
				near_vertex = true
	# anywhere on another path's body snaps onto its centerline
	var hit := {}
	if not near_vertex:
		for q in paths:
			var pts: Array = q["points"]
			for i in range(1, pts.size()):
				var pr := Geo.seg_proj(p.x, p.y, pts[i - 1], pts[i])
				if pr["d"] <= maxf(sim.half_width(q.get("type", "")), r * 0.8) and (hit.is_empty() or pr["d"] < hit["d"]):
					hit = {"x": pr["x"], "y": pr["y"], "d": pr["d"], "id": q["id"]}
	if not hit.is_empty():
		return {"x": hit["x"], "y": hit["y"], "info": {"type": "seg", "kind": "path", "id": hit["id"]}}
	var best := {"bd": r, "snap": null}
	_try_vertex(p, sim.state["gate"], "gate", "gate", best)
	for v in sim.state["boundary"]:
		_try_vertex(p, v, "boundary", "boundary", best)
	for q in paths:
		for v in q["points"]:
			_try_vertex(p, v, "path", q["id"], best)
	if best["snap"] != null:
		return best["snap"]
	best["bd"] = r * 0.8
	var bounds: Array = sim.state["boundary"]
	for i in bounds.size():
		var pr := Geo.seg_proj(p.x, p.y, bounds[i], bounds[(i + 1) % bounds.size()])
		if pr["d"] < best["bd"]:
			best["bd"] = pr["d"]
			best["snap"] = {"x": pr["x"], "y": pr["y"], "info": {"type": "seg", "kind": "boundary", "id": "boundary"}}
	return best["snap"] if best["snap"] != null else open

func _try_vertex(p: Vector2, v: Array, kind: String, id: String, best: Dictionary) -> void:
	var d := Vector2(v[0], v[1]).distance_to(p)
	if d < best["bd"]:
		best["bd"] = d
		best["snap"] = {"x": v[0], "y": v[1], "info": {"type": "vertex", "kind": kind, "id": id}}

# ---------- drawing a path ----------
func _draw_tap() -> void:
	var sn := snap_at(get_global_mouse_position(), Input.is_key_pressed(KEY_ALT))
	if not draw_pts.is_empty():
		var last: Array = draw_pts[-1]
		if Vector2(last[0], last[1]).distance_to(Vector2(sn["x"], sn["y"])) * cam.zoom.x < 14.0:
			_finish_draw()
			return
	draw_pts.append([sn["x"], sn["y"]])
	draw_snaps.append(sn["info"])
	queue_redraw()

func _finish_draw() -> void:
	var type := _path_type()
	var cost := sim.path_cost(draw_pts, type)
	var problem := sim.add_path(draw_pts, type, draw_snaps)
	if problem != "":
		_set_status(problem, true, 2500)
		return
	_set_status("Built a %s for %s." % [sim.path_name(type).to_lower(), sim.money_text(cost)], false, 2500)
	draw_pts.clear()
	draw_snaps.clear()
	queue_redraw()

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		var mb := event as InputEventMouseButton
		if mb.pressed and (mb.button_index == MOUSE_BUTTON_WHEEL_UP or mb.button_index == MOUSE_BUTTON_WHEEL_DOWN):
			_zoom_at(1.15 if mb.button_index == MOUSE_BUTTON_WHEEL_UP else 1.0 / 1.15)
		elif mb.button_index == MOUSE_BUTTON_LEFT and mb.pressed and tool != "pan":
			_draw_tap()
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
			KEY_ENTER, KEY_KP_ENTER:
				if tool != "pan" and not draw_pts.is_empty():
					_finish_draw()
			KEY_BACKSPACE:
				if not draw_pts.is_empty():
					draw_pts.pop_back()
					draw_snaps.pop_back()
					queue_redraw()
			KEY_ESCAPE:
				if draw_pts.is_empty():
					_set_tool("pan")
					_select_button("pan")
				else:
					draw_pts.clear()
					draw_snaps.clear()
					queue_redraw()
		_refresh_hud()

func _select_button(t: String) -> void:
	for b in get_tree().get_nodes_in_group("tool_buttons"):
		b.button_pressed = b.text == TOOLS[t]

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
	var plot := SimCore.HOME_PLOT
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
	# paths: widest and lightest first, so service roads sit on top where they cross
	for type in ["wide", "", "service"]:
		for p in sim.state["paths"]:
			if p.get("type", "") == type:
				_draw_path(p["points"], sim.half_width(type), PATH_COLORS[type])
	var g: Array = sim.state["gate"]
	draw_circle(Vector2(g[0], g[1]), 4.0, Color(0.85, 0.65, 0.2))
	# the path being drawn
	if tool != "pan":
		var pts := _preview_pts()
		if pts.size() >= 2:
			var ok := sim.path_problem(pts, _path_type()) == ""
			var c := Color(0.5, 1, 0.5, 0.65) if ok else Color(1, 0.4, 0.35, 0.65)
			_draw_path(pts, sim.half_width(_path_type()), c)
		for v in draw_pts:
			draw_circle(Vector2(v[0], v[1]), 1.0, Color.WHITE)
		if not hover.is_empty() and hover["info"] != null:
			draw_arc(Vector2(hover["x"], hover["y"]), 3.0, 0.0, TAU, 20, Color(1, 0.9, 0.3), 0.6)

func _draw_path(pts: Array, half: float, color: Color) -> void:
	var line := PackedVector2Array()
	for q in pts:
		line.append(Vector2(q[0], q[1]))
		draw_circle(Vector2(q[0], q[1]), half, color)   # round joints and ends
	if line.size() >= 2:
		draw_polyline(line, color, half * 2.0)
