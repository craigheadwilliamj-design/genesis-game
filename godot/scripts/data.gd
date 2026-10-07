extends RefCounted
# Tuning constants and content, read from data/data.json.
# That file is made from js/data.js by `node tools/export_data.js`: re-run it after a balance change there.
# Names match the JS ones, so `GameData.get_const("OPEN_MIN")` is `OPEN_MIN` in data.js.
# Note: JSON numbers arrive as floats. Wrap in int() where a whole number matters.

static var _d: Dictionary = {}
static var _species: Dictionary = {}

static func _load() -> void:
	if not _d.is_empty():
		return
	var f := FileAccess.open("res://data/data.json", FileAccess.READ)
	if f == null:
		push_error("data/data.json is missing. Run: node tools/export_data.js")
		return
	var parsed = JSON.parse_string(f.get_as_text())
	if parsed is Dictionary:
		_d = parsed
		for s in _d.get("SPECIES", []):
			_species[s["id"]] = s

static func get_const(key: String, fallback = null):
	_load()
	return _d.get(key, fallback)

static func species(id: String) -> Dictionary:
	_load()
	return _species.get(id, {})
