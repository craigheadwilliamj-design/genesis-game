extends RefCounted
# Math helpers for shapes on the map. Port of js/geometry.js. Everything is measured in meters.
# A point is [x, y] and a shape is an Array of points (plain arrays, so they save to JSON like the JS ones).
# Use it as: const Geo = preload("res://scripts/geometry.gd") then Geo.area(pts).

static func dist(a: Array, b: Array) -> float:
	var dx: float = a[0] - b[0]
	var dy: float = a[1] - b[1]
	return sqrt(dx * dx + dy * dy)

# Area of a shape in square meters
static func area(pts: Array) -> float:
	var a := 0.0
	var n := pts.size()
	for i in n:
		var p: Array = pts[i]
		var q: Array = pts[(i + 1) % n]
		a += p[0] * q[1] - q[0] * p[1]
	return absf(a) / 2.0

# Distance around the edge of a closed shape
static func perimeter(pts: Array) -> float:
	var l := 0.0
	var n := pts.size()
	for i in n:
		l += dist(pts[i], pts[(i + 1) % n])
	return l

# Length of an open line
static func line_length(pts: Array) -> float:
	var l := 0.0
	for i in range(1, pts.size()):
		l += dist(pts[i - 1], pts[i])
	return l

static func centroid(pts: Array) -> Array:
	var n := pts.size()
	if n == 0:
		return [0.0, 0.0]
	var a := 0.0
	var cx := 0.0
	var cy := 0.0
	for i in n:
		var p: Array = pts[i]
		var q: Array = pts[(i + 1) % n]
		var f: float = p[0] * q[1] - q[0] * p[1]
		a += f
		cx += (p[0] + q[0]) * f
		cy += (p[1] + q[1]) * f
	if absf(a) < 1e-9:
		var sx := 0.0
		var sy := 0.0
		for p in pts:
			sx += p[0]
			sy += p[1]
		return [sx / n, sy / n]
	return [cx / (3.0 * a), cy / (3.0 * a)]

static func bbox(pts: Array) -> Dictionary:
	var x0 := INF
	var y0 := INF
	var x1 := -INF
	var y1 := -INF
	for p in pts:
		x0 = minf(x0, p[0])
		y0 = minf(y0, p[1])
		x1 = maxf(x1, p[0])
		y1 = maxf(y1, p[1])
	return {"x0": x0, "y0": y0, "x1": x1, "y1": y1}

# Is the point (x, y) inside the shape?
static func in_poly(x: float, y: float, pts: Array) -> bool:
	var c := false
	var j := pts.size() - 1
	for i in pts.size():
		var a: Array = pts[i]
		var b: Array = pts[j]
		var dy: float = b[1] - a[1]
		if dy == 0.0:
			dy = 1e-12
		if ((a[1] > y) != (b[1] > y)) and (x < (b[0] - a[0]) * (y - a[1]) / dy + a[0]):
			c = not c
		j = i
	return c

# Closest point on the segment a-b to (px, py): {x, y, t, d}
static func seg_proj(px: float, py: float, a: Array, b: Array) -> Dictionary:
	var dx: float = b[0] - a[0]
	var dy: float = b[1] - a[1]
	var l: float = dx * dx + dy * dy
	var t := 0.0
	if l != 0.0:
		t = clampf(((px - a[0]) * dx + (py - a[1]) * dy) / l, 0.0, 1.0)
	var x: float = a[0] + t * dx
	var y: float = a[1] + t * dy
	return {"x": x, "y": y, "t": t, "d": sqrt((px - x) * (px - x) + (py - y) * (py - y))}

static func _orient(p: Array, q: Array, r: Array) -> float:
	return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])

# Do segments a-b and c-d properly cross (not just touch at an end)?
# A point within 5 cm of the other line counts as touching it, so fences that share a wall don't count as crossing.
static func seg_cross(a: Array, b: Array, c: Array, d: Array) -> bool:
	var d1 := _orient(c, d, a)
	var d2 := _orient(c, d, b)
	var d3 := _orient(a, b, c)
	var d4 := _orient(a, b, d)
	var lcd := dist(c, d)
	var lab := dist(a, b)
	var e1 := 0.05 * (lcd if lcd != 0.0 else 1.0)
	var e2 := 0.05 * (lab if lab != 0.0 else 1.0)
	return ((d1 > e1 and d2 < -e1) or (d1 < -e1 and d2 > e1)) and ((d3 > e2 and d4 < -e2) or (d3 < -e2 and d4 > e2))

static func seg_seg_dist(a: Array, b: Array, c: Array, d: Array) -> float:
	if seg_cross(a, b, c, d):
		return 0.0
	return minf(minf(seg_proj(a[0], a[1], c, d)["d"], seg_proj(b[0], b[1], c, d)["d"]), minf(seg_proj(c[0], c[1], a, b)["d"], seg_proj(d[0], d[1], a, b)["d"]))

# Distance from a point to the edge of a closed shape
static func dist_to_edge(x: float, y: float, pts: Array) -> float:
	var m := INF
	var n := pts.size()
	for i in n:
		m = minf(m, seg_proj(x, y, pts[i], pts[(i + 1) % n])["d"])
	return m

# Is the point clearly inside the shape (not just sitting on its fence)?
static func deep_inside(x: float, y: float, pts: Array, margin: float) -> bool:
	return in_poly(x, y, pts) and dist_to_edge(x, y, pts) > margin

# Closest distance between an open line and a closed shape (0 if they touch or cross)
static func line_shape_dist(line: Array, shape: Array) -> float:
	var m := INF
	for p in line:
		if in_poly(p[0], p[1], shape):
			return 0.0
	for i in range(1, line.size()):
		for j in shape.size():
			m = minf(m, seg_seg_dist(line[i - 1], line[i], shape[j], shape[(j + 1) % shape.size()]))
	return m

# Does the open line cut into the shape? Touching the edge is allowed.
static func line_enters_shape(line: Array, shape: Array) -> bool:
	for p in line:
		if deep_inside(p[0], p[1], shape, 0.5):
			return true
	for i in range(1, line.size()):
		for j in shape.size():
			if seg_cross(line[i - 1], line[i], shape[j], shape[(j + 1) % shape.size()]):
				return true
		var mx: float = (line[i - 1][0] + line[i][0]) / 2.0
		var my: float = (line[i - 1][1] + line[i][1]) / 2.0
		if deep_inside(mx, my, shape, 0.5):
			return true
	return false

# Do two closed shapes overlap? Sharing an edge is allowed.
static func shapes_overlap(shape_a: Array, shape_b: Array) -> bool:
	var closed_a := shape_a.duplicate()
	closed_a.append(shape_a[0])
	if line_enters_shape(closed_a, shape_b):
		return true
	for p in shape_b:
		if deep_inside(p[0], p[1], shape_a, 0.5):
			return true
	return false

# Does a self-crossing shape (like a figure 8) exist? Those make bad exhibits.
static func self_crosses(pts: Array) -> bool:
	var n := pts.size()
	for i in n:
		for j in range(i + 2, n):
			if i == 0 and j == n - 1:
				continue
			if seg_cross(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n]):
				return true
	return false

# A rectangle of width w and depth d, centered on (x, y), turned by angle (radians)
static func rect_pts(x: float, y: float, w: float, d: float, angle: float) -> Array:
	var c := cos(angle)
	var s := sin(angle)
	var hw := w / 2.0
	var hd := d / 2.0
	var out := []
	for uv in [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]]:
		out.append([x + uv[0] * c - uv[1] * s, y + uv[0] * s + uv[1] * c])
	return out

# A random point inside a shape
static func random_inside(pts: Array) -> Array:
	var b := bbox(pts)
	for i in 40:
		var x: float = b["x0"] + randf() * (b["x1"] - b["x0"])
		var y: float = b["y0"] + randf() * (b["y1"] - b["y0"])
		if in_poly(x, y, pts):
			return [x, y]
	return centroid(pts)
