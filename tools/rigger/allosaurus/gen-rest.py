# Writes the Allosaurus rest clip into a rigger project (the parts and other clips are left alone).
#   python3 tools/rigger/allosaurus/gen-rest.py allosaurus-clips.json allosaurus-clips.json ['{"drop":13,"fps":6}']
# From the standing stance it crouches with its nose dipped, then sinks onto its belly like a resting bird, legs folded under it (the knee
# bends forward the whole way; the feet shuffle a little forward as it sits, as far as the ground needs), arms tucked, tail laid along the
# ground, and lowers its head to rest its chin. The game plays it once and holds the last frame. Each part is kept above the ground row
# (rigkit.Rig.lowest), the tail and head by searching for the turn that just clears it. Keyframes are for a right-facing animal, turned by FACE.
import json, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from allokit import *
FOREARMS = ('n268', 'n266')
K = dict(fps=6, drop=11.0, knee=1, fold={'n254': 68.0, 'n264': 70.0}, arms=-70.0, neck=16.0, head=6.0)
if len(sys.argv) > 3: K.update(json.loads(sys.argv[3]))
P = json.load(open(sys.argv[1])); R = Rig(P)
FLOOR = 69.0   # the bottom edge of the ground row: nothing drawn goes below it
D = K['drop']
# keyframes: frame, body tip (+ nose down), body sink, neck, head, arms
KEYS = [(0, 0, 0, 0, 0, 0),
        (4, 4, 4.5, 6, 2, -20),                     # crouches, nose dipping
        (9, 1.5, D, 10, 3, K['arms']),              # down onto its belly
        (13, 0, D, K['neck'], K['head'], K['arms']),  # lays its head down
        (15, 0, D, K['neck'] + 1, K['head'] + 1, K['arms'])]   # a last settle
def at(i):
  for (f0, *a), (f1, *b) in zip(KEYS, KEYS[1:]):
    if f0 <= i <= f1:
      t = sm((i - f0)/(f1 - f0)); return [x + (y - x)*t for x, y in zip(a, b)]
  return KEYS[-1][1:]
def clear_either(p, part, r0, step=1.0):   # the smallest turn either way from r0 that clears the floor
  for n in range(0, 181):
    for r in (r0 + n*step, r0 - n*step):
      p[part] = dict(p.get(part, {'dx': 0, 'dy': 0}), r=rd(r))
      if R.lowest(p).get(part, 0) <= FLOOR + .01: return r
  return r0
def clear(p, part, r0, step):   # turn `part` from r0 by `step` until it no longer goes under the floor
  r = r0
  for _ in range(200):
    p[part] = dict(p.get(part, {'dx': 0, 'dy': 0}), r=rd(r))
    if R.lowest(p).get(part, 0) <= FLOOR + .01: return r
    r += step
  return r
s = FACE
frames = []
for i in range(KEYS[-1][0] + 1):
  rb, bdy, nk, hd, ar = at(i)
  bd = rd(bdy + CROUCH)
  p = {BODY: {'r': rd(s*rb), 'dx': 0, 'dy': bd}, NECK: {'r': rd(s*nk), 'dx': 0, 'dy': 0}, HEAD: {'r': rd(s*hd), 'dx': 0, 'dy': 0},
       JAW: {'r': 0, 'dx': 0, 'dy': 0}, TAIL: {'r': 0, 'dx': 0, 'dy': 0}, TAIL2: {'r': 0, 'dx': 0, 'dy': 0}}
  for a in ARMS: p[a] = {'r': rd(s*ar), 'dx': 0, 'dy': 0}
  for th, sh, ft in LEGS: p[th] = {'r': 0, 'dx': 0, 'dy': bd}   # the hip rides the body
  plan = sm(min(1, i/KEYS[2][0]))   # how far the feet have shuffled toward the fold, done as the belly lands
  def place(e):
    for th, sh, ft in LEGS: R.leg(p, th, sh, ft, (STAND[th][0] + (K['fold'][th] - STAND[th][0])*e, 67.0), 0.0, K['knee'])
    lo = R.lowest(p); return max(lo[k] for leg in LEGS for k in leg) - FLOOR
  # the shuffle nearest the plan that keeps both legs above the ground
  place(min((x/50 for x in range(51)), key=lambda x: (max(0, round(place(x), 2)), abs(x - plan))))
  clear(p, TAIL, 0, .25); clear(p, TAIL2, 0, .25)   # the tail lies along the ground: lifted only as much as it needs
  for a in ARMS: clear(p, a, p[a]['r'], 2.0)   # the upper arms too
  for fa in FOREARMS: clear_either(p, fa, 0)   # the little forearms fold up out of the ground
  clear(p, NECK, s*nk, -.5); clear(p, HEAD, s*hd, -.5)   # the chin rests on the ground, never in it
  frames.append(p)
clip = {'name': 'rest', 'fps': K['fps'], 'frames': unwrap(frames)}
P['clips'] = [clip if c['name'] == 'rest' else c for c in P['clips']] if any(c['name'] == 'rest' for c in P['clips']) else P['clips'] + [clip]
json.dump(P, open(sys.argv[2], 'w'), separators=(',', ':'))
bad = [(i + 1, {k: round(v, 2) for k, v in R.lowest(f).items() if v > FLOOR + .3}) for i, f in enumerate(frames)]
print('rest:', len(frames), 'frames; under the ground:', [b for b in bad if b[1]] or 'none')
