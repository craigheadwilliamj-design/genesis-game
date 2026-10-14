# Rebuilds the Cotylorhynchus walk clip in a rigger project, leaving the parts, joints and other clips alone.
#   python3 tools/rigger/cotylorhynchus/gen-walk.py IN.json OUT.json ['{"S":5,"lift":1.2}']
# Lateral-sequence walk (near hind, near front, far hind, far front, a quarter cycle apart), like the Prionosuchus. Each leg is a
# thigh plus a foot: the thigh turns about the hip so the ankle slides back at an even speed in stance and swings forward lifted,
# the thigh drops so the stance ankle keeps its height (the sole stays on the ground row), and the foot turns back so it stays flat.
# The swapped head parts (`off` on the node, `v:1` in a pose) are kept: the open-eyed head is shown in every frame.
import json, math, sys
K = dict(N=12, fps=8, ds=.75, S=5.0, lift=1.2, bob=.4, tail=(.5, .8, 1.2), head=1.2)
if len(sys.argv) > 3: K.update(json.loads(sys.argv[3]))
P = json.load(open(sys.argv[1]))
by = {n['id']: n for n in P['nodes']}
BODY, HEAD, JAW, TAIL = 'n184', 'n186', 'n188', ('n206', 'n208', 'n210')
LEGS = [('n198', 'n200', 0), ('n190', 'n192', .25), ('n202', 'n204', .5), ('n194', 'n196', .75)]   # [thigh, foot, phase]
rd = lambda x: round(x, 2) + 0.0
sm = lambda t: (1 - math.cos(math.pi*t))/2
def ankle(a, b, r):   # the ankle (a, b) from the hip, turned r degrees clockwise on screen
  c, s = math.cos(math.radians(r)), math.sin(math.radians(r))
  return a*c - b*s, a*s + b*c
def solve(a, b, ox):   # the turn that moves the ankle ox pixels forward of rest (bisection; x falls as r grows)
  lo, hi = -60.0, 60.0
  for _ in range(60):
    m = (lo + hi)/2
    if ankle(a, b, m)[0] - a > ox: lo = m
    else: hi = m
  return (lo + hi)/2
frames = []
for i in range(K['N']):
  f, pose = i/K['N'], {}
  bob = K['bob']*math.sin(2*math.pi*2*f)        # down twice a cycle, as each hind foot takes the weight
  pose[BODY] = {'r': 0, 'dx': 0, 'dy': rd(bob)}
  pose[HEAD] = {'r': rd(K['head']*math.sin(2*math.pi*(2*f + .15))), 'dx': 0, 'dy': 0, 'v': 1}
  pose[JAW] = {'r': 0, 'dx': 0, 'dy': 0}
  for j, t in enumerate(TAIL):                  # a wave down the tail, each piece a little later and wider
    pose[t] = {'r': rd(K['tail'][j]*math.sin(2*math.pi*(f - .12*j))), 'dx': 0, 'dy': 0}
  for lg, ft, off in LEGS:
    a, b = by[ft]['lx'], by[ft]['ly']
    fl, lift = (f + off) % 1, 0.0
    if fl < K['ds']: ox = K['S']/2 - K['S']*fl/K['ds']
    else:
      t = (fl - K['ds'])/(1 - K['ds']); ox = -K['S']/2 + K['S']*sm(t); lift = K['lift']*math.sin(math.pi*t)
    r = solve(a, b, ox)
    pose[lg] = {'r': rd(r), 'dx': 0, 'dy': rd(b - ankle(a, b, r)[1] - lift - bob)}   # cancel the body bob so planted feet stay put
    pose[ft] = {'r': rd(-r), 'dx': 0, 'dy': 0}
  frames.append(pose)
walk = {'name': 'walk', 'fps': K['fps'], 'frames': frames}
P['clips'] = [walk if c['name'] == 'walk' else c for c in P['clips']]
if not any(c['name'] == 'walk' for c in P['clips']): P['clips'].insert(0, walk)
json.dump(P, open(sys.argv[2], 'w'), separators=(',', ':'))
print('walk:', K['N'], 'frames at', K['fps'], 'fps')
