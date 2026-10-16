# Rebuilds the Lystrosaurus walk clip in a rigger project, leaving the parts, joints and other clips alone.
#   python3 tools/rigger/lystrosaurus/gen-walk.py IN.json OUT.json ['{"S":7,"lift":2.2}']
# A short-legged lateral-sequence walk (near hind, near front, far hind, far front, a quarter cycle apart). Each foot is planted flat and
# slides back under the body at body speed for `ds` of the cycle, then swings forward lifted; the thigh and leg are solved by 2-bone IK
# (rigkit.leg) so the ankle goes where it is wanted. The hips are root parts, so each is shifted with the body's bob and rock.
# The body bobs down as each pair of feet take the weight and the head rides against the body's rock so it nods a little less than the body.
import json, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lystkit import *
K = dict(N=8, fps=8, ds=.6, S=17.0, lift=3.2, bob=.6, pitch=1.2, head=1.5, shift=.0, name='walk')
if len(sys.argv) > 3: K.update(json.loads(sys.argv[3]))
P = json.load(open(sys.argv[1])); V = View(P)
rest = {}   # each foot's ankle (the foot part's joint) standing, in the world
W0 = V.worlds({})
for t, l, f in LIMBS: rest[t] = (W0[f][4], W0[f][5])
PHASE = {NEAR_BACK[0]: 0, NEAR_FRONT[0]: .25, FAR_BACK[0]: .5, FAR_FRONT[0]: .75}
frames = []
for i in range(K['N']):
  f = i/K['N']; pose = {}
  bob = K['bob']*math.sin(4*math.pi*f + .6)            # down twice a cycle
  rb = K['pitch']*math.sin(4*math.pi*(f + .125))       # rocks nose down as a front foot lands, up as a hind one does
  body = {'r': rd(rb), 'dx': 0, 'dy': rd(bob)}
  pose[BODY] = body
  pose[HEAD] = {'r': rd(-.6*rb + K['head']*math.sin(4*math.pi*(f + .25))), 'dx': 0, 'dy': 0}
  pose[JAW] = {'r': 0, 'dx': 0, 'dy': 0}
  for limb in LIMBS:
    th, lg, ft = limb
    hx, hy = V.hip(pose, limb, body)
    pose[th] = {'r': 0, 'dx': rd(hx), 'dy': rd(hy)}
    fl, lift = (f + PHASE[th]) % 1, 0.0
    if fl < K['ds']: ox = K['S']/2 - K['S']*fl/K['ds']
    else:
      t = (fl - K['ds'])/(1 - K['ds']); ox = -K['S']/2 + K['S']*sm(t); lift = K['lift']*math.sin(math.pi*t)
    V.leg(pose, th, lg, ft, (rest[th][0] + ox + K['shift'], rest[th][1] - lift), 0.0, 1)
  frames.append(pose)
unwrap(frames)
clip = {'name': K['name'], 'fps': K['fps'], 'frames': frames}
P['clips'] = [clip if c['name'] == K['name'] else c for c in P['clips']]
if not any(c['name'] == K['name'] for c in P['clips']): P['clips'].insert(0, clip)
json.dump(P, open(sys.argv[2], 'w'), separators=(',', ':'))
print('walk:', len(frames), 'frames at', K['fps'], 'fps; one cycle covers', round(K['S']/K['ds'], 1), 'px, so rstep', round(K['S']/K['ds']/40/K['N'], 4))
if len(sys.argv) > 4 or True:
  import os
  out = os.environ.get('SHEETS')
  if out:
    sheet(V, frames, os.path.join(out, 'walk-sheet.png'), cols=4, k=4); gif(V, frames, os.path.join(out, 'walk.gif'), K['fps'])
