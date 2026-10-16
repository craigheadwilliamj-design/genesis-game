# Builds the Lystrosaurus rest clip in a rigger project: it lies down on its belly, looks round, and nods off with its chin on the ground.
#   python3 tools/rigger/lystrosaurus/gen-rest.py IN.json OUT.json ['{"drop":5.5,"fps":6}']
# The game plays the clip once and holds the last frame, so it ends asleep. The legs stay under the animal and fold as the body sinks:
# each ankle stays on the ground row (spreading a little, front feet forward and hind feet back) and the thigh and leg bend to meet it.
import json, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lystkit import *
K = dict(fps=6, lie=7, drop=5.5, spread=3.0, tilt=1.0, name='rest')
if len(sys.argv) > 3: K.update(json.loads(sys.argv[3]))
P = json.load(open(sys.argv[1])); V = View(P)
W0 = V.worlds({}); rest = {t: (W0[f][4], W0[f][5]) for t, l, f in LIMBS}
FRONT = (FAR_FRONT[0], NEAR_FRONT[0])
def pose_at(e, hr, hdy, jaw=0.0, breath=0.0):
  """e: how far down it has lain (0 standing, 1 on its belly); hr, hdy: the head's turn and drop; jaw: opening; breath: the body's rise"""
  body = {'r': rd(K['tilt']*sm(e)), 'dx': 0, 'dy': rd(K['drop']*sm(e) - breath)}
  p = {BODY: body, HEAD: {'r': rd(hr), 'dx': 0, 'dy': rd(hdy)}, JAW: {'r': rd(jaw), 'dx': 0, 'dy': 0}}
  for limb in LIMBS:
    th, lg, ft = limb; hx, hy = V.hip(p, limb, body)
    p[th] = {'r': 0, 'dx': rd(hx), 'dy': rd(hy)}
    V.leg(p, th, lg, ft, (rest[th][0] + (1 if th in FRONT else -1)*K['spread']*sm(e), rest[th][1]), 0.0, 1)
  return p
frames = [pose_at(i/(K['lie'] - 1), 4*sm(i/(K['lie'] - 1)), .8*sm(i/(K['lie'] - 1))) for i in range(K['lie'])]   # lies down, the head dipping with it
# (head turn, head drop, jaw, breath): a look round, a yawn, drifts off, nods awake, drifts off again and sleeps
for hr, hdy, jaw, br in [(4, .8, 0, 0), (2, .5, 0, .2), (0, .2, 0, 0), (2, .5, 0, .2), (4, .8, 0, 0), (5, 1, 10, .2), (6, 1, 22, .3), (5, 1, 10, .2), (5, 1, 0, 0),
                         (7, 1.4, 0, .2), (9, 1.8, 0, 0), (11, 2.2, 0, .3), (13, 2.6, 0, 0), (7, 1.2, 0, .2), (5, .9, 0, 0), (6, 1.2, 0, .2),
                         (9, 1.8, 0, 0), (12, 2.4, 0, .3), (14, 2.8, 0, 0), (15, 3, 0, .3), (15, 3, 0, 0), (15, 3, 0, .3), (15, 3, 0, 0)]:
  frames.append(pose_at(1, hr, hdy, jaw, br))
unwrap(frames)
rest_clip = {'name': K['name'], 'fps': K['fps'], 'frames': frames}
P['clips'] = [c for c in P['clips'] if c['name'] != K['name']] + [rest_clip]
json.dump(P, open(sys.argv[2], 'w'), separators=(',', ':'))
print('rest:', len(frames), 'frames at', K['fps'], 'fps')
out = os.environ.get('SHEETS')
if out: sheet(V, frames, os.path.join(out, 'rest-sheet.png'), cols=6, k=3); gif(V, frames, os.path.join(out, 'rest.gif'), K['fps'])
