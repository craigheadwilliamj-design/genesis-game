# Builds the Cotylorhynchus idle clip in a rigger project: it leans down to crop the low plants, chomps three times, lifts its head
# still chewing, blinks, and settles back to standing.
#   python3 tools/rigger/cotylorhynchus/gen-idle.py IN.json OUT.json ['{"fps":8,"lean":3}']
# The game plays an idle once from the standing pose, so the first and last frames are the rest pose. Keyframes below are eased
# into each other (cosine); the eye swaps (COTY_HEAD open, COTY_HEAD_LID_DROOP, COTY_HEAD_CLOSED, see gen-rest.py) switch on a frame.
# As the body tips and sinks, each thigh turns and shifts so its ankle stays where it stands, and the foot turns back to stay flat.
import json, math, sys
K = dict(fps=8, name='idle', lean=4.0, sink=1.0, head=17.0, chomp=18.0, tail=1.5)
if len(sys.argv) > 3: K.update(json.loads(sys.argv[3]))
P = json.load(open(sys.argv[1]))
by = {n['id']: n for n in P['nodes']}
BODY, OPEN, DROOP, SHUT, JAW, TAIL = 'n184', 'n186', 'n212', 'n214', 'n188', ('n206', 'n208', 'n210')
LEGS = [('n198', 'n200'), ('n202', 'n204'), ('n190', 'n192'), ('n194', 'n196')]
rd = lambda x: round(x, 2) + 0.0
sm = lambda t: (1 - math.cos(math.pi*t))/2
def rot(x, y, r): c, s = math.cos(math.radians(r)), math.sin(math.radians(r)); return x*c - y*s, x*s + y*c
def solve(a, b, want):   # the thigh turn that puts the ankle (a, b) at x = want (bisection; x falls as r grows)
  lo, hi = -80.0, 80.0
  for _ in range(60):
    m = (lo + hi)/2
    if rot(a, b, m)[0] > want: lo = m
    else: hi = m
  return (lo + hi)/2
# keyframes: frame, body tip (deg, + is nose down), body sink (px), head turn (deg, + nose down), jaw open (deg), eye
L, S, H, J = K['lean'], K['sink'], K['head'], K['chomp']
KEYS = [(0, 0, 0, 0, 0, 'o'),
        (6, L, S, H, 0, 'o'),                                           # leans down to the plants
        (8, L, S, H - 1, J, 'o'), (10, L, S, H + 1, 0, 'o'),            # chomp
        (12, L, S, H - 1, J, 'o'), (14, L, S, H + 1, 0, 'o'),           # chomp
        (16, L, S, H - 1, J, 'o'), (18, L, S, H + 1, 0, 'o'),           # chomp
        (24, -.5, 0, -2, 0, 'o'),                                        # head up, a little past standing
        (26, -.5, 0, -2, J/2, 'o'), (28, -.5, 0, -2, 0, 'o'),           # chews
        (30, -.5, 0, -2, J/2, 'o'), (32, -.5, 0, -2, 0, 'o'),           # chews
        (37, 0, 0, 0, 0, 'o')]                                           # back to standing
BLINK = {33: 'd', 34: 'c', 35: 'd'}
def at(i):
  for (f0, *a), (f1, *b) in zip(KEYS, KEYS[1:]):
    if f0 <= i <= f1:
      t = sm((i - f0)/(f1 - f0)) if f1 > f0 else 0
      return [x + (y - x)*t for x, y in zip(a[:4], b[:4])]
  return KEYS[-1][1:5]
frames = []
for i in range(KEYS[-1][0] + 1):
  rb, bdy, hr, jaw = at(i); eye = BLINK.get(i, 'o'); p = {}
  p[BODY] = {'r': rd(rb), 'dx': 0, 'dy': rd(bdy)}
  u = i/KEYS[-1][0]
  for j, t in enumerate(TAIL):   # a lazy swish that only ever lifts (the tip lies on the ground when standing); the base cancels the body's tip
    lift = K['tail']*math.sin(math.pi*u)**2*(1 + math.sin(2*math.pi*(2*u - .1*j))/2)
    p[t] = {'r': rd((-rb if j == 0 else 0) + lift), 'dx': 0, 'dy': 0}
  for lg, ft in LEGS:   # keep each ankle where it stands: its rest place, seen from the tipped and sunk body
    hx, hy, a, b = by[lg]['lx'], by[lg]['ly'], by[ft]['lx'], by[ft]['ly']
    vx, vy = rot(hx + a, hy + b - bdy, -rb); vx -= hx; vy -= hy
    r = solve(a, b, vx)
    p[lg] = {'r': rd(r), 'dx': 0, 'dy': rd(vy - rot(a, b, r)[1])}
    p[ft] = {'r': rd(-r - rb), 'dx': 0, 'dy': 0}
  hp = {'r': rd(hr), 'dx': 0, 'dy': 0}
  p[OPEN] = dict(hp, v=1) if eye == 'o' else dict(hp)   # posed even when hidden: the jaw follows it
  p[JAW] = {'r': rd(jaw), 'dx': 0, 'dy': 0}
  if eye == 'd': p[DROOP] = dict(hp, v=1)
  if eye == 'c':   # a root part: put it where the head is
    h, s = by[OPEN], by[SHUT]
    x, y = rot(h['lx'], h['ly'], rb)
    p[SHUT] = {'r': rd(rb + hr), 'dx': rd(by[BODY]['lx'] + x - s['lx']), 'dy': rd(by[BODY]['ly'] + bdy + y - s['ly']), 'v': 1}
  frames.append(p)
clip = {'name': K['name'], 'fps': K['fps'], 'frames': frames}
P['clips'] = [c for c in P['clips'] if c['name'] != K['name']] + [clip]
json.dump(P, open(sys.argv[2], 'w'), separators=(',', ':'))
print(K['name'] + ':', len(frames), 'frames at', K['fps'], 'fps')
