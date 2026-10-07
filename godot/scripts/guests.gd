extends RefCounted
# Guests, stage one (guests.js). Parties arrive at the gate, pay for a ticket, walk the footpaths to the exhibits
# they fancy, look at the animals, and head home. Their mood when they leave feeds tomorrow's crowd.
# Not ported yet: needs (food, drink, restrooms), shops and queues, litter, decor, learning, the tram, vandalism,
# wide-path room, crowding, danger, and viewing platforms. Parties aren't saved.
# Nodes are Dictionaries keyed by "x:y" strings, and a party's `at`, `to` and `prev` are those keys ("" for none).
const GameData = preload("res://scripts/data.gd")
const Geo = preload("res://scripts/geometry.gd")

const REACH := 6.0                 # an exhibit within this many meters of a path counts as "on the path"
const ARRIVE_START := 480.0        # arrivals follow a hump: few at opening, busiest late morning, none after 4 PM
const ARRIVE_END := 960.0
const WALK_PER_MIN := 40.0 / 12.0  # meters a party walks per park minute (WALK_SPEED over MINUTES_PER_SECOND)

var parties: Array = []            # parties in the park right now
var nodes: Dictionary = {}         # key -> {k, x, y, adj: {key: meters}, sees: {key: [exhibit ids]}}
var anchors: Dictionary = {}       # exhibit id (or "gate") -> node key
var gate_key := ""
var reach: Dictionary = {}         # item id -> can guests (or staff, for departments) get to it
var fields: Dictionary = {}        # stop id -> quickest way there from every node, worked out when first needed
var dirty := true                  # the layout changed: rebuild the map before the next tick
var carry := 0.0                   # arrivals owed but not yet through the gate
var next_size := 1                 # how many are in the next party through the gate
var G: Dictionary = GameData.get_const("GUEST", {})

# ---------- reach and the guests' map ----------

static func node_key(x: float, y: float) -> String:
	return "%d:%d" % [roundi(x * 4.0), roundi(y * 4.0)]

# Does a corner of path p sit on path q?
static func _touches(p: Dictionary, q: Dictionary) -> bool:
	var qp: Array = q["points"]
	for v in p["points"]:
		for i in range(1, qp.size()):
			if Geo.seg_proj(v[0], v[1], qp[i - 1], qp[i])["d"] < 1.5:
				return true
	return false

# Paths joined up to the entrance. With guests_only, service roads don't count, because guests won't walk on them.
static func connected_path_ids(sim, guests_only: bool) -> Dictionary:
	var usable := []
	for p in sim.state["paths"]:
		var t: String = p.get("type", "")
		if t == "tram" or (guests_only and t == "service"):
			continue
		usable.append(p)
	var joined := {}
	var queue := []
	for p in usable:
		for v in p["points"]:
			if Geo.dist(v, sim.state["gate"]) < 2.0:
				joined[p["id"]] = true
				queue.append(p)
				break
	while not queue.is_empty():
		var p: Dictionary = queue.pop_front()
		for q in usable:
			if joined.has(q["id"]):
				continue
			if _touches(p, q) or _touches(q, p):
				joined[q["id"]] = true
				queue.append(q)
	return joined

static func _near(shape: Array, paths: Array) -> bool:
	for p in paths:
		if Geo.line_shape_dist(p["points"], shape) <= REACH:
			return true
	return false

func is_reachable(id: String) -> bool:
	return reach.get(id, false)

func _node(p: Array) -> Dictionary:
	var k := node_key(p[0], p[1])
	if not nodes.has(k):
		nodes[k] = {"k": k, "x": p[0], "y": p[1], "adj": {}}
	return nodes[k]

func _link(a: Dictionary, b: Dictionary) -> void:
	if a["k"] == b["k"]:
		return
	var d := sqrt((a["x"] - b["x"]) * (a["x"] - b["x"]) + (a["y"] - b["y"]) * (a["y"] - b["y"]))
	a["adj"][b["k"]] = d
	b["adj"][a["k"]] = d

# Closest point on any path copy to (x, y), within max_d: {c, i, r}, or {} if none
static func _nearest(copies: Array, x: float, y: float, max_d: float) -> Dictionary:
	var best := {}
	for c in copies:
		var pts: Array = c["pts"]
		for i in range(1, pts.size()):
			var r := Geo.seg_proj(x, y, pts[i - 1], pts[i])
			if r["d"] <= max_d and (best.is_empty() or r["d"] < best["r"]["d"]):
				best = {"c": c, "i": i, "r": r}
	return best

static func _stop(id: String, best: Dictionary) -> void:
	if not best.is_empty():
		best["c"]["adds"].append({"i": best["i"], "t": best["r"]["t"], "pt": [best["r"]["x"], best["r"]["y"]], "id": id})

# Work out what's reachable, then the map of footpaths with stops spliced in where exhibits meet them (buildGuestGraph)
func rebuild(sim) -> void:
	var joined := connected_path_ids(sim, true)
	var joined_all := connected_path_ids(sim, false)
	var guest_paths := []
	var any_paths := []
	for p in sim.state["paths"]:
		if joined.has(p["id"]):
			guest_paths.append(p)
		if joined_all.has(p["id"]):
			any_paths.append(p)
	reach = {}
	for e in sim.state["exhibits"]:
		reach[e["id"]] = _near(e["points"], guest_paths)
	for b in sim.state["buildings"]:
		reach[b["id"]] = _near(b["points"], any_paths if sim.building_def(b["type"]).get("dept", false) else guest_paths)

	var copies := []
	for p in guest_paths:
		copies.append({"pts": p["points"], "adds": []})
	# guests look in from a spot beside the fence, as near the middle of the exhibit as the paths go
	for e in sim.state["exhibits"]:
		if not reach[e["id"]]:
			continue
		var c: Array = Geo.centroid(e["points"])
		var best := {}
		var bd := INF
		var ep: Array = e["points"]
		for i in ep.size():
			var a: Array = ep[i]
			var b: Array = ep[(i + 1) % ep.size()]
			var l := Geo.dist(a, b)
			if l == 0.0:
				l = 1.0
			var s := 0.0
			while s <= l:
				var r := _nearest(copies, a[0] + (b[0] - a[0]) * s / l, a[1] + (b[1] - a[1]) * s / l, REACH + 1.0)
				if not r.is_empty():
					var d := Vector2(r["r"]["x"], r["r"]["y"]).distance_to(Vector2(c[0], c[1]))
					if d < bd:
						bd = d
						best = r
				s += 4.0
		_stop(e["id"], best)

	nodes = {}
	anchors = {}
	for c in copies:
		var seq := []
		var pts: Array = c["pts"]
		for i in pts.size():
			if i > 0:
				var here := []
				for a in c["adds"]:
					if a["i"] == i:
						here.append(a)
				here.sort_custom(func(x, y): return x["t"] < y["t"])
				for a in here:
					var n := _node(a["pt"])
					anchors[a["id"]] = n["k"]
					seq.append(n)
			seq.append(_node(pts[i]))
		for i in range(1, seq.size()):
			_link(seq[i - 1], seq[i])
	# a corner of one path sitting on the middle of another joins them
	var all := nodes.values()
	for c in copies:
		var pts: Array = c["pts"]
		for i in range(1, pts.size()):
			for n in all:
				var r := Geo.seg_proj(n["x"], n["y"], pts[i - 1], pts[i])
				if r["d"] >= 1.5:
					continue
				if r["t"] > 0.01 and r["t"] < 0.99:
					_link(n, _node(pts[i - 1]))
					_link(n, _node(pts[i]))
				else:
					_link(n, _node(pts[i - 1] if r["t"] <= 0.01 else pts[i]))
	gate_key = ""
	var gd := 3.0
	for n in nodes.values():
		var d := Vector2(n["x"], n["y"]).distance_to(Vector2(sim.state["gate"][0], sim.state["gate"][1]))
		if d < gd:
			gd = d
			gate_key = n["k"]
	if gate_key != "":
		anchors["gate"] = gate_key
	# which exhibits guests can see from each stretch of path
	var boxes := []
	for e in sim.state["exhibits"]:
		if reach[e["id"]]:
			var bb := Geo.bbox(e["points"])
			boxes.append({"e": e, "x0": bb["x0"] - REACH, "y0": bb["y0"] - REACH, "x1": bb["x1"] + REACH, "y1": bb["y1"] + REACH})
	for n in nodes.values():
		for mk in n["adj"]:
			if mk < n["k"]:
				continue
			var m: Dictionary = nodes[mk]
			var ids := []
			for o in boxes:
				if maxf(n["x"], m["x"]) >= o["x0"] and minf(n["x"], m["x"]) <= o["x1"] and maxf(n["y"], m["y"]) >= o["y0"] and minf(n["y"], m["y"]) <= o["y1"] \
						and Geo.line_shape_dist([[n["x"], n["y"]], [m["x"], m["y"]]], o["e"]["points"]) <= REACH:
					ids.append(o["e"]["id"])
			if not ids.is_empty():
				if not n.has("sees"):
					n["sees"] = {}
				if not m.has("sees"):
					m["sees"] = {}
				n["sees"][mk] = ids
				m["sees"][n["k"]] = ids
	fields = {}
	# everyone carries on from the same spot on the new map
	for p in parties:
		if p["at"] != "":
			if not nodes.has(p["at"]):
				p["at"] = _nearest_node(p["ax"], p["ay"])
			if p["at"] != "":
				p["ax"] = nodes[p["at"]]["x"]
				p["ay"] = nodes[p["at"]]["y"]
		p["to"] = ""
		p["t"] = 0.0
		p["prev"] = ""
		if p["dest"] != "" and not anchors.has(p["dest"]):
			p["dest"] = ""
			p["why"] = ""

func _nearest_node(x: float, y: float) -> String:
	var best := ""
	var bd := INF
	for n in nodes.values():
		var d := Vector2(n["x"], n["y"]).distance_to(Vector2(x, y))
		if d < bd:
			bd = d
			best = n["k"]
	return best

# The quickest way to a stop from everywhere: {dist: key -> meters, prev: key -> next key toward the stop}
func field(id: String) -> Dictionary:
	if fields.has(id):
		return fields[id]
	var f := {}
	if anchors.has(id):
		var start: String = anchors[id]
		var dist := {start: 0.0}
		var prev := {}
		var done := {}
		var open := [start]
		while not open.is_empty():
			var bi := 0
			for i in range(1, open.size()):
				if dist[open[i]] < dist[open[bi]]:
					bi = i
			var k: String = open[bi]
			open[bi] = open[-1]
			open.pop_back()
			if done.has(k):
				continue
			done[k] = true
			var adj: Dictionary = nodes[k]["adj"]
			for mk in adj:
				var nd: float = dist[k] + adj[mk]
				if nd < dist.get(mk, INF):
					dist[mk] = nd
					prev[mk] = k
					open.append(mk)
		f = {"dist": dist, "prev": prev}
	fields[id] = f
	return f

# ---------- demand ----------

# How much a species pulls guests: appeal stretched around a pivot, so showstoppers dominate (speciesDraw)
func species_draw(s: Dictionary) -> float:
	var pivot := float(G["drawPivot"])
	return pivot * pow(float(s["appeal"]) / pivot, float(G["drawPower"]))

func exhibit_appeal(sim, e: Dictionary) -> float:
	if e["animals"].is_empty():
		return 0.0
	var a := 0.0
	var counts: Dictionary = sim.species_counts(e)
	for sp in counts:
		a += species_draw(GameData.species(sp)) * sqrt(counts[sp]) * (0.4 + 0.6 * float(e["happy"]) / 100.0)
	return a   # viewing platforms and the like will multiply this later

func fair_ticket(sim) -> float:
	return 15.0 + float(sim.state["rating"]) * 6.0

# Guests who'd come today: how much there is to see, shaped by rating, ticket price and word of mouth
func demand(sim) -> float:
	var appeal := 0.0
	var shown := {}
	for e in sim.state["exhibits"]:
		if e["animals"].is_empty() or not reach.get(e["id"], false):
			continue
		var counts: Dictionary = sim.species_counts(e)
		for sp in counts:
			appeal += species_draw(GameData.species(sp)) * sqrt(counts[sp]) * (0.4 + 0.6 * float(e["happy"]) / 100.0)
			shown[sp] = true
	var fair := fair_ticket(sim)
	var price_f := clampf(1.0 - 1.2 * (float(sim.state["ticket"]) - fair) / fair, 0.05, 1.3)
	var told = sim.state["guestLog"].get("mood")
	var wom := 1.0
	if told != null:
		var wm := float(G["wordOfMouth"])
		wom = clampf(1.0 + wm * (float(told) - 60.0) / 40.0, 1.0 - wm, 1.0 + wm)
	return appeal * (1.0 + 0.06 * shown.size()) * 9.0 * (0.6 + 0.16 * float(sim.state["rating"])) * price_f * wom

static func arrival_share(m0: float, m1: float) -> float:
	var f := func(m: float) -> float:
		var t := clampf((m - ARRIVE_START) / (ARRIVE_END - ARRIVE_START), 0.0, 1.0)
		return (1.0 - cos(PI * t)) / 2.0
	return f.call(m1) - f.call(m0)

# ---------- arriving and leaving ----------

func _rand(a: float, b: float) -> float:
	return a + randf() * (b - a)

func _new_party(sim, n: int) -> Dictionary:
	var cash: Array = G["cash"]
	var stay: Array = G["stay"]
	var speed: Array = G["speed"]
	var p := {"id": sim.uid("g"), "n": n, "cash": n * _rand(cash[0], cash[1]), "mood": float(G["startMood"]) + 4.0 * float(sim.state["rating"]),
		"seen": {}, "until": float(sim.state["minute"]) + _rand(stay[0], stay[1]), "at": gate_key, "ax": 0.0, "ay": 0.0, "to": "", "t": 0.0, "prev": "",
		"dest": "", "why": "", "home": false, "done": false, "gone": false, "spd": _rand(speed[0], speed[1]), "off": (randf() * 2.0 - 1.0) * 1.4, "shirt": randi() % 4}
	if gate_key != "":
		p["ax"] = nodes[gate_key]["x"]
		p["ay"] = nodes[gate_key]["y"]
	if float(sim.state["ticket"]) > fair_ticket(sim) * 1.3:
		p["mood"] -= 8.0   # the ticket was too dear
	return p

func _arrive(sim, n: int) -> void:
	sim.state["today"]["guests"] += n
	sim.earn(int(sim.state["ticket"]) * n, "tickets")
	if parties.size() < int(G["maxParties"]):
		parties.append(_new_party(sim, n))
		return
	# the map is full: these guests tag along with a party that just got here
	var p: Dictionary = parties[parties.size() - 1 - randi() % mini(50, parties.size())]
	p["n"] += n

# A party walks out of the gate. How it feels now counts toward the day's guest comfort.
func _leaves(sim, p: Dictionary) -> void:
	if p["gone"]:
		return
	p["gone"] = true
	var t: Dictionary = sim.state["today"]
	t["moodSum"] = t.get("moodSum", 0.0) + clampf(p["mood"], 0.0, 100.0) * p["n"]
	t["moodN"] = t.get("moodN", 0) + p["n"]
	sim.state["guestLog"]["guests"] += p["n"]

func _go_home(p: Dictionary) -> void:
	if p["home"]:
		return
	p["home"] = true
	p["dest"] = ""
	p["why"] = ""

# Closing time: everyone still here goes home
func flush(sim) -> void:
	for p in parties:
		_leaves(sim, p)
	parties = []
	carry = 0.0

# Remember how today's guests felt, for tomorrow's crowd
func night(sim) -> void:
	var t: Dictionary = sim.state["today"]
	var L: Dictionary = sim.state["guestLog"]
	if t.get("moodN", 0) > 0:
		L["mood"] = t["moodSum"] / t["moodN"]
	L["last"] = {"guests": L["guests"]}
	L["guests"] = 0

# ---------- deciding where to go ----------

func _walk_mins(p: Dictionary, id: String) -> float:
	var f := field(id)
	if f.is_empty() or p["at"] == "" or not f["dist"].has(p["at"]):
		return 0.0
	return f["dist"][p["at"]] / (WALK_PER_MIN * p["spd"])

# Pick an exhibit not seen yet: popular ones, and close ones, are likelier
func _pick_sight(sim, p: Dictionary) -> Dictionary:
	var total := 0.0
	var opts := []
	for e in sim.state["exhibits"]:
		if p["seen"].has(e["id"]) or e["animals"].is_empty() or not anchors.has(e["id"]):
			continue
		var f := field(e["id"])
		if f.is_empty() or not f["dist"].has(p["at"]):
			continue
		var w: float = (exhibit_appeal(sim, e) + 1.0) / (1.0 + f["dist"][p["at"]] / 60.0)
		opts.append([e, w])
		total += w
	var r := randf() * total
	for o in opts:
		r -= o[1]
		if r <= 0.0:
			return o[0]
	return {}

# Work out where to head next. Called each time a party reaches a corner.
func _plan(sim, p: Dictionary) -> void:
	if p["home"]:
		p["dest"] = "gate"
		p["why"] = "home"
		return
	if p["dest"] != "":
		return
	var e := _pick_sight(sim, p)
	if not e.is_empty():
		p["dest"] = e["id"]
		p["why"] = "see"
		return
	# nothing new to see: a party that saw nothing at all is bored, and everyone starts thinking about home
	if not p["done"]:
		p["done"] = true
		var saw_any := false
		for id in p["seen"]:
			var x := sim.find_exhibit(id)
			if not x.is_empty() and not x["animals"].is_empty():
				saw_any = true
		if not saw_any:
			p["mood"] -= 15.0
		p["until"] = minf(p["until"], float(sim.state["minute"]) + 45.0)

# Pick the next node to walk to. False means the party isn't walking anywhere for now.
func _head_out(sim, p: Dictionary) -> bool:
	_plan(sim, p)
	if p["dest"] != "":
		var goal: String = anchors.get(p["dest"], "")
		if goal == p["at"]:
			_reach_dest(sim, p)
			return false
		var f := field(p["dest"])
		var step: String = f["prev"].get(p["at"], "") if not f.is_empty() else ""
		if goal != "" and step != "":
			p["to"] = step
			return true
		p["dest"] = ""
		p["why"] = ""
		if p["home"]:
			_leaves(sim, p)
			return false
	# wander: any way but back the way we came
	var opts := []
	for k in nodes[p["at"]]["adj"]:
		if k != p["prev"]:
			opts.append(k)
	p["to"] = opts[randi() % opts.size()] if not opts.is_empty() else p["prev"]
	return p["to"] != ""

# Got where we were going
func _reach_dest(sim, p: Dictionary) -> void:
	var id: String = p["dest"]
	if id == "gate":
		_leaves(sim, p)
		return
	var e := sim.find_exhibit(id)
	if not e.is_empty():
		_see(sim, p, e)
	p["dest"] = ""
	p["why"] = ""

func _see(sim, p: Dictionary, e: Dictionary) -> void:
	if p["seen"].has(e["id"]):
		return
	p["seen"][e["id"]] = true
	if e["animals"].is_empty():
		return
	var a := exhibit_appeal(sim, e)
	p["mood"] += float(G["seeGain"]) * a / (a + 15.0)
	if float(e["happy"]) < 35.0:
		p["mood"] -= 4.0   # sad animals

func _walk(sim, p: Dictionary, left: float) -> void:
	for i in 40:
		if left <= 0.0 or p["gone"]:
			return
		if p["to"] == "":
			if not _head_out(sim, p):
				return
		var a: Dictionary = nodes[p["at"]]
		var length: float = maxf(a["adj"].get(p["to"], 0.01), 0.01)
		var rem: float = length * (1.0 - p["t"])
		if left < rem:
			p["t"] += left / length
			return
		left -= rem
		if a.has("sees") and a["sees"].has(p["to"]):
			for id in a["sees"][p["to"]]:
				var e := sim.find_exhibit(id)
				if not e.is_empty():
					_see(sim, p, e)
		p["prev"] = p["at"]
		p["at"] = p["to"]
		p["ax"] = nodes[p["at"]]["x"]
		p["ay"] = nodes[p["at"]]["y"]
		p["to"] = ""
		p["t"] = 0.0

# ---------- through the day ----------

func tick(sim, m0: float, m1: float) -> void:
	var dt := m1 - m0
	if dirty:
		rebuild(sim)
		dirty = false
	if gate_key != "":
		carry += demand(sim) * arrival_share(m0, m1)
		var sizes: Array = G["sizes"]
		while carry >= next_size:
			carry -= next_size
			_arrive(sim, next_size)
			next_size = int(sizes[randi() % sizes.size()])
	for p in parties:
		p["mood"] = clampf(p["mood"] - float(G["tire"]) * dt, 0.0, 100.0)
		# set off for the gate in time to be out by the time they planned to leave
		if not p["home"] and (m1 + _walk_mins(p, "gate") >= p["until"] or p["mood"] < float(G["quitBelow"])):
			_go_home(p)
		if p["at"] == "":
			if p["home"]:
				_leaves(sim, p)
			continue
		_walk(sim, p, WALK_PER_MIN * p["spd"] * dt)
	parties = parties.filter(func(p): return not p["gone"])

func guest_count() -> int:
	var n := 0
	for p in parties:
		n += p["n"]
	return n

# Where a party is on the map right now, shifted to one side of the path
func party_pos(p: Dictionary) -> Vector2:
	if p["at"] == "" or not nodes.has(p["at"]):
		return Vector2(-1000, -1000)
	var a: Dictionary = nodes[p["at"]]
	var pos := Vector2(a["x"], a["y"])
	if p["to"] != "" and nodes.has(p["to"]):
		var b: Dictionary = nodes[p["to"]]
		var to := Vector2(b["x"], b["y"])
		pos = pos.lerp(to, p["t"])
		var dir := (to - Vector2(a["x"], a["y"])).normalized()
		pos += Vector2(-dir.y, dir.x) * p["off"]
	return pos
