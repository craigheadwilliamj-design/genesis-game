# Builds the Cotylorhynchus rest clip in a rigger project: it lies down on its belly, blinks, drifts off, nods awake, and falls asleep.
#   python3 tools/rigger/cotylorhynchus/gen-rest.py IN.json OUT.json ['{"drop":3,"fps":6}']
# The game plays the clip once and holds the last frame, so it ends asleep. The eyes are the three swapped head parts (marked `off`,
# shown with v:1): COTY_HEAD (open), COTY_HEAD_LID_DROOP (half shut), COTY_HEAD_CLOSED (shut). COTY_HEAD is always posed even when
# hidden, because the jaw hangs off it. COTY_HEAD_CLOSED is a root part, so its pose is worked out to land where the head would be.
# Legs fold as the body sinks: each thigh turns (hind legs back, front legs forward) until the ankle is back at its standing height,
# and the foot turns back to stay flat, so the feet stay on the ground.
import json, math, sys
K = dict(fps=6, lie=8, drop=3.0, tail=(7.0, 1.0, -2.0), head=1.5)
if len(sys.argv) > 3: K.update(json.loads(sys.argv[3]))
P = json.load(open(sys.argv[1]))
by = {n['id']: n for n in P['nodes']}
BODY, OPEN, DROOP, SHUT, JAW, TAIL = 'n184', 'n186', 'n212', 'n214', 'n188', ('n206', 'n208', 'n210')
LEGS = [('n198', 'n200', 1), ('n202', 'n204', 1), ('n190', 'n192', -1), ('n194', 'n196', -1)]   # [thigh, foot, +1 tucks back, -1 reaches forward]
rd = lambda x: round(x, 2) + 0.0
sm = lambda t: (1 - math.cos(math.pi*t))/2
def ankle_y(a, b, r): return a*math.sin(math.radians(r)) + b*math.cos(math.radians(r))
def fold(a, b, want, side):   # the turn (on the given side) that brings the ankle up to `want` pixels below the hip
  lo, hi = 0.0, 89.0
  for _ in range(60):
    m = (lo + hi)/2
    if ankle_y(a, b, side*m) > want: lo = m
    else: hi = m
  return side*(lo + hi)/2
def pose_at(e, hr, hdy, eye):
  """e: how far down it has lain (0 standing, 1 on its belly); hr, hdy: the head's droop; eye: 'o' open, 'd' droopy, 'c' shut"""
  bdy, p = K['drop']*sm(e), {}
  p[BODY] = {'r': 0, 'dx': 0, 'dy': rd(bdy)}
  for j, t in enumerate(TAIL): p[t] = {'r': rd(K['tail'][j]*sm(min(1, 1.4*e))), 'dx': 0, 'dy': 0}   # lifts a little ahead of the hips sinking, so no part of it goes under the ground
  for lg, ft, side in LEGS:
    a, b = by[ft]['lx'], by[ft]['ly']
    r = fold(a, b, b - bdy, side) if bdy > 0 else 0.0
    p[lg] = {'r': rd(r), 'dx': 0, 'dy': 0}
    p[ft] = {'r': rd(-r), 'dx': 0, 'dy': 0}
  hp = {'r': rd(hr), 'dx': 0, 'dy': rd(hdy)}
  p[OPEN] = dict(hp, v=1) if eye == 'o' else dict(hp)   # posed even when hidden: the jaw follows it
  p[JAW] = {'r': 0, 'dx': 0, 'dy': 0}
  if eye == 'd': p[DROOP] = dict(hp, v=1)
  if eye == 'c':   # a root part: put it where the head is (body at its rest place plus its bob, then the head's offset and turn)
    h, s = by[OPEN], by[SHUT]
    p[SHUT] = {'r': rd(hr), 'dx': rd(by[BODY]['lx'] + h['lx'] - s['lx']), 'dy': rd(by[BODY]['ly'] + bdy + h['ly'] + hdy - s['ly']), 'v': 1}
  return p
frames = []
for i in range(K['lie']):   # lies down, the head dipping a little with it
  e = i/(K['lie'] - 1); frames.append(pose_at(e, K['head']*sm(e), 0, 'o'))
H = K['head']
# (head turn, head drop, eyes) after it is down: a look round with a blink, drifts off, nods awake, drifts off again and sleeps
for hr, hdy, eye in [(0, 0, 'o'), (0, 0, 'o'), (0, 0, 'd'), (0, 0, 'c'), (0, 0, 'o'), (0, 0, 'o'),
                     (1, .2, 'o'), (2, .4, 'd'), (3, .7, 'd'), (4, 1, 'd'), (5, 1.3, 'c'), (6, 1.6, 'c'), (7, 1.9, 'c'),
                     (2, .3, 'd'), (1, .2, 'o'), (1, .2, 'o'), (1.5, .3, 'd'),
                     (3, .6, 'd'), (4.5, 1, 'd'), (6, 1.4, 'c'), (7.5, 1.8, 'c'), (8.5, 2.1, 'c'), (9, 2.2, 'c')]:
  frames.append(pose_at(1, H + hr, hdy, eye))
rest = {'name': 'rest', 'fps': K['fps'], 'frames': frames}
P['clips'] = [c for c in P['clips'] if c['name'] != 'rest'] + [rest]
json.dump(P, open(sys.argv[2], 'w'), separators=(',', ':'))
print('rest:', len(frames), 'frames at', K['fps'], 'fps')
