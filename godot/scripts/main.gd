extends Node2D
# Map view: pan and zoom camera, the 5 m grid, land parcels, the home plot and entrance, the path tool, and a small HUD.
# Units are meters (same as the JS game), so 1 world unit = 1 m.
const GameData = preload("res://scripts/data.gd")
const SimCore = preload("res://scripts/sim.gd")
const Geo = preload("res://scripts/geometry.gd")

const GRID := 5.0
const PAN_KEYS_SPEED := 400.0   # screen px per second at zoom 1
const TOOLS := {"pan": "Pan", "path": "Path", "wide": "Wide path", "service": "Service road", "exhibit": "Exhibit"}
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
var build_opt: OptionButton
var fence_opt: OptionButton
var fence_ids: Array = []
var fence_sel := "wood"         # the fence new exhibits are built with
var build_ids: Array = []       # building ids in the dropdown, after its heading
var build_type := ""
var rot := 0                    # turns of 45 degrees for the building being placed
var ghost: Dictionary = {}      # where the building would go under the mouse

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
	bar.offset_right = 1000
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
	build_opt = OptionButton.new()
	build_opt.focus_mode = Control.FOCUS_NONE
	build_opt.add_item("Buildings")
	var defs: Dictionary = GameData.get_const("BUILDINGS")
	for id in sim.building_types():
		build_ids.append(id)
		build_opt.add_item("%s  %s" % [defs[id]["label"], sim.money_text(int(defs[id]["price"]))])
	build_opt.item_selected.connect(_pick_building)
	bar.add_child(build_opt)
	fence_opt = OptionButton.new()
	fence_opt.focus_mode = Control.FOCUS_NONE
	for key in sim.barrier_keys():
		fence_ids.append(key)
		fence_opt.add_item("%s  $%d/m" % [sim.barrier_def(key)["label"], int(sim.fence_rate(key))])
	fence_opt.item_selected.connect(func(i: int): fence_sel = fence_ids[i])
	bar.add_child(fence_opt)
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
	ghost = {}
	build_opt.select(0)
	if t == "exhibit":
		_set_status("Exhibit: click to drop fence corners. Click the first corner to close it. Pick the fence from the dropdown. Backspace undoes, Esc cancels.")
	else:
		_set_status("" if t == "pan" or t == "build" else "%s: click to add points. Click the last point again, or press Enter, to finish. Esc cancels." % TOOLS[t])
	queue_redraw()

func _pick_building(index: int) -> void:
	if index == 0:
		_set_tool("pan")
		_select_button("pan")
		return
	var keep := index
	_set_tool("build")
	build_opt.select(keep)
	build_type = build_ids[keep - 1]
	for b in get_tree().get_nodes_in_group("tool_buttons"):
		b.button_pressed = false
	_set_status("R turns it. Click to build. Esc cancels.")

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
	if tool == "build":
		var m := get_global_mouse_position()
		ghost = sim.building_spot(build_type, m.x, m.y, rot)
		_ghost_status()
		queue_redraw()
	elif tool != "pan":
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
	if tool == "exhibit":
		_exhibit_status()
		return
	var pts := _preview_pts()
	var type := _path_type()
	var problem := sim.path_problem(pts, type)
	if problem != "":
		_set_status(problem, true)
	else:
		_set_status("%s, %d m: %s. Click the last point again to build." % [TOOLS[tool], int(Geo.line_length(pts)), sim.money_text(sim.path_cost(pts, type))])

func _ghost_status() -> void:
	if Time.get_ticks_msec() < toast_until or ghost.is_empty():
		return
	if not ghost["ok"]:
		_set_status(ghost["why"], true)
	else:
		var note := "" if ghost["has_path"] else " No path nearby, so it won't work until one reaches it."
		_set_status("%s. Click to build.%s" % [sim.money_text(ghost["price"]), note])

func _build_tap() -> void:
	if ghost.is_empty():
		return
	var m := get_global_mouse_position()
	var label: String = sim.building_def(build_type)["label"]
	var problem := sim.place_building(build_type, m.x, m.y, rot)
	if problem != "":
		_set_status(problem, true, 2500)
	else:
		_set_status("Built %s for %s." % [label.to_lower(), sim.money_text(int(sim.building_def(build_type)["price"]))], false, 2500)
		if sim.building_def(build_type).get("unique", false):
			_set_tool("pan")
			_select_button("pan")

func _exhibit_status() -> void:
	if draw_pts.size() < 3:
		_set_status("Click to drop the next fence corner.")
		return
	var problem := sim.exhibit_problem(draw_pts, fence_sel)
	if problem != "":
		_set_status(problem, true)
	else:
		_set_status("Exhibit, %d m², %s. Click the first corner to close it." % [int(Geo.area(draw_pts)), sim.money_text(sim.exhibit_cost(draw_pts, fence_sel))])

func _finish_exhibit() -> void:
	var cost := sim.exhibit_cost(draw_pts, fence_sel)
	var problem := sim.add_exhibit(draw_pts, fence_sel)
	if problem != "":
		_set_status(problem, true, 2500)
		return
	var e: Dictionary = sim.state["exhibits"][-1]
	_set_status("Built %s for %s." % [e["name"], sim.money_text(cost)], false, 2500)
	draw_pts.clear()
	draw_snaps.clear()
	queue_redraw()

# ---------- snapping (snapAt in map.js) ----------
# Nearest corner, entrance or path to the point, so a new path really joins what it starts on. Alt skips snapping.
func snap_at(p: Vector2, free: bool) -> Dictionary:
	var open := {"x": p.x, "y": p.y, "info": null}
	if free:
		return open
	var r := 12.0 / cam.zoom.x
	var paths: Array = sim.state["paths"]
	var path_kind := tool != "exhibit"   # drawing a path: anywhere on another path snaps onto its centerline
	var near_vertex := false
	for q in paths:
		for v in q["points"]:
			if Vector2(v[0], v[1]).distance_to(p) < r:
				near_vertex = true
	# anywhere on another path's body snaps onto its centerline
	var hit := {}
	if not near_vertex and path_kind:
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
	for q in sim.state["exhibits"]:
		for v in q["points"]:
			_try_vertex(p, v, "exhibit", q["id"], best)
	if best["snap"] != null:
		return best["snap"]
	best["bd"] = r * 0.8
	if not path_kind:
		for q in paths:
			for i in range(1, q["points"].size()):
				_try_segment(p, q["points"][i - 1], q["points"][i], "path", q["id"], best)
		for q in sim.state["exhibits"]:
			var ep: Array = q["points"]
			for i in ep.size():
				_try_segment(p, ep[i], ep[(i + 1) % ep.size()], "exhibit", q["id"], best)
	var bounds: Array = sim.state["boundary"]
	for i in bounds.size():
		var pr := Geo.seg_proj(p.x, p.y, bounds[i], bounds[(i + 1) % bounds.size()])
		if pr["d"] < best["bd"]:
			best["bd"] = pr["d"]
			best["snap"] = {"x": pr["x"], "y": pr["y"], "info": {"type": "seg", "kind": "boundary", "id": "boundary"}}
	return best["snap"] if best["snap"] != null else open

func _try_segment(p: Vector2, a: Array, b: Array, kind: String, id: String, best: Dictionary) -> void:
	var pr := Geo.seg_proj(p.x, p.y, a, b)
	if pr["d"] < best["bd"]:
		best["bd"] = pr["d"]
		best["snap"] = {"x": pr["x"], "y": pr["y"], "info": {"type": "seg", "kind": kind, "id": id}}

func _try_vertex(p: Vector2, v: Array, kind: String, id: String, best: Dictionary) -> void:
	var d := Vector2(v[0], v[1]).distance_to(p)
	if d < best["bd"]:
		best["bd"] = d
		best["snap"] = {"x": v[0], "y": v[1], "info": {"type": "vertex", "kind": kind, "id": id}}

# ---------- drawing a path ----------
func _draw_tap() -> void:
	var sn := snap_at(get_global_mouse_position(), Input.is_key_pressed(KEY_ALT))
	if tool == "exhibit":
		# tapping the first corner again closes the fence
		if draw_pts.size() >= 3 and Vector2(draw_pts[0][0], draw_pts[0][1]).distance_to(Vector2(sn["x"], sn["y"])) * cam.zoom.x < 14.0:
			_finish_exhibit()
			return
	elif not draw_pts.is_empty():
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
		elif mb.button_index == MOUSE_BUTTON_LEFT and mb.pressed and tool == "build":
			_build_tap()
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
			KEY_R:
				if tool == "build":
					rot = (rot + 1) % 8
			KEY_ENTER, KEY_KP_ENTER:
				if tool == "exhibit":
					_finish_exhibit()
				elif tool != "pan" and not draw_pts.is_empty():
					_finish_draw()
			KEY_BACKSPACE:
				if not draw_pts.is_empty():
					draw_pts.pop_back()
					draw_snaps.pop_back()
					queue_redraw()
			KEY_ESCAPE:
				if tool == "build" or draw_pts.is_empty():
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
	build_opt.select(0)

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
	for e in sim.state["exhibits"]:
		_draw_exhibit(e)
	# paths: widest and lightest first, so service roads sit on top where they cross
	for type in ["wide", "", "service"]:
		for p in sim.state["paths"]:
			if p.get("type", "") == type:
				_draw_path(p["points"], sim.half_width(type), PATH_COLORS[type])
	var g: Array = sim.state["gate"]
	draw_circle(Vector2(g[0], g[1]), 4.0, Color(0.85, 0.65, 0.2))
	for b in sim.state["buildings"]:
		_draw_building(b["points"], sim.building_def(b["type"]), 1.0, false)
	if tool == "build" and not ghost.is_empty():
		_draw_building(ghost["pts"], sim.building_def(build_type), 0.6, true, ghost["ok"])
	# the path being drawn
	if tool == "exhibit":
		_draw_exhibit_preview()
	elif tool != "pan" and tool != "build":
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

# A building: its footprint in the type's color with its letter on top. The ghost is tinted green or red.
func _draw_building(pts: Array, def: Dictionary, alpha: float, is_ghost: bool, ok := true) -> void:
	var poly := PackedVector2Array()
	for q in pts:
		poly.append(Vector2(q[0], q[1]))
	var fill := Color.html(def.get("color", "#888888"))
	if is_ghost:
		fill = fill.lerp(Color(0.4, 1, 0.4) if ok else Color(1, 0.35, 0.3), 0.55)
	fill.a = alpha
	draw_colored_polygon(poly, fill)
	var outline := poly.duplicate()
	outline.append(poly[0])
	draw_polyline(outline, Color(0, 0, 0, 0.6 * alpha), 0.4)
	var c: Array = Geo.centroid(pts)
	var font := ThemeDB.fallback_font
	var glyph: String = def.get("glyph", "?")
	draw_set_transform(Vector2(c[0], c[1]), 0.0, Vector2(0.15, 0.15))
	var sz := font.get_string_size(glyph, HORIZONTAL_ALIGNMENT_LEFT, -1, 40)
	draw_string(font, Vector2(-sz.x / 2.0, sz.y * 0.3), glyph, HORIZONTAL_ALIGNMENT_LEFT, -1, 40, Color(1, 1, 1, alpha))
	draw_set_transform_matrix(Transform2D.IDENTITY)

# An exhibit: ground in its biome's color, fenced in the barrier's color, named in the middle
func _draw_exhibit(e: Dictionary) -> void:
	var poly := PackedVector2Array()
	for q in e["points"]:
		poly.append(Vector2(q[0], q[1]))
	var biome: String = e.get("biome", GameData.get_const("DEFAULT_BIOME", "grassland"))
	var fill := Color.html(GameData.get_const("BIOMES")[biome]["color"])
	fill.a = 0.85
	draw_colored_polygon(poly, fill)
	var fence := Color.html(sim.barrier_def(e.get("barrier", "wood"))["color"])
	var outline := poly.duplicate()
	outline.append(poly[0])
	draw_polyline(outline, fence, 1.0)
	var c: Array = Geo.centroid(e["points"])
	var font := ThemeDB.fallback_font
	draw_set_transform(Vector2(c[0], c[1]), 0.0, Vector2(0.2, 0.2))
	var sz := font.get_string_size(e["name"], HORIZONTAL_ALIGNMENT_LEFT, -1, 24)
	draw_string(font, Vector2(-sz.x / 2.0, sz.y * 0.3), e["name"], HORIZONTAL_ALIGNMENT_LEFT, -1, 24, Color(1, 1, 1, 0.9))
	draw_set_transform_matrix(Transform2D.IDENTITY)

# The fence being drawn: its corners, the next edge to the pointer, and the closed shape tinted green or red
func _draw_exhibit_preview() -> void:
	if draw_pts.is_empty():
		return
	var poly := PackedVector2Array()
	for v in draw_pts:
		poly.append(Vector2(v[0], v[1]))
	if draw_pts.size() >= 3:
		var ok := sim.exhibit_problem(draw_pts, fence_sel) == ""
		draw_colored_polygon(poly, Color(0.5, 1, 0.5, 0.35) if ok else Color(1, 0.4, 0.35, 0.35))
	var line := poly.duplicate()
	if not hover.is_empty():
		line.append(Vector2(hover["x"], hover["y"]))
	if line.size() >= 2:
		draw_polyline(line, Color.WHITE, 0.6)
	for i in draw_pts.size():
		draw_circle(poly[i], 1.6 if i == 0 and draw_pts.size() >= 3 else 1.0, Color(1, 0.9, 0.3) if i == 0 else Color.WHITE)
	if not hover.is_empty() and hover["info"] != null:
		draw_arc(Vector2(hover["x"], hover["y"]), 3.0, 0.0, TAU, 20, Color(1, 0.9, 0.3), 0.6)
