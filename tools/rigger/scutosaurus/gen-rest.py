# Builds the Scutosaurus rest clip in a rigger project: it starts from the Idle stance, sinks onto its belly with the legs folding
# under it (hind feet tuck back, front feet reach forward), settles, and lets its head droop to sleep. The game plays the clip once and
# holds the last frame, so it ends asleep. The hips ride the body down and every leg is solved with the same 2-bone IK as the walk.
#   python3 tools/rigger/scutosaurus/gen-rest.py IN.json OUT.json ['{"drop":8,"fps":6}']
import json, math, sys
from kit import *
K = dict(fps=6, lie=8, drop=8.0, tuck=(-3.0, 9.0), tail=-5.0, head=15.0, breath=.5)
if len(sys.argv) > 3: K.update(json.loads(sys.argv[3]))
P = json.load(open(sys.argv[1])); R = SRig(P)
idle0 = next(c for c in P['clips'] if c['name'] == 'Idle')['frames'][0]
# where each leg stands in the Idle stance: the hip as posed there, and the ankle it reaches (the near legs are unposed there)
def stance(key):
  th, sh, ft = LEGS[key]; W = R.worlds(idle0); a = W[ft]
  return idle0.get(th, {}).get('dx', 0), idle0.get(th, {}).get('dy', 0), a[4], a[5]
def pose_at(e, hr, breath):
  """e: how far down it has lain (0 standing, 1 on its belly); hr: the head's droop; breath: a pixel of rise and fall"""
  d = K['drop']*sm(e) + breath; p = {}
  p[BODY] = {'r': 0, 'dx': 0, 'dy': rd(d)}
  p[TAIL] = {'r': rd(K['tail']*sm(e)), 'dx': 0, 'dy': 0}
  p[HEAD] = {'r': rd(hr), 'dx': 0, 'dy': 0}
  p[JAW] = {'r': 0, 'dx': 0, 'dy': 0}
  for key in LEGS:
    th, sh, ft = LEGS[key]; end = 'b' if key[1] == 'b' else 'f'
    hx, hy, ax, ay = stance(key)
    p[th] = {'r': 0, 'dx': hx, 'dy': rd(hy + d)}
    tx = ax + (K['tuck'][0] if end == 'b' else K['tuck'][1])*sm(e)   # hind feet slide back, front feet reach forward
    leg_ik(R, p, th, sh, ft, (tx, ay), 0.0)
  return p
frames = []
for i in range(K['lie']):   # lies down, the head dipping a little with it
  e = i/(K['lie'] - 1); frames.append(pose_at(e, K['head']*.3*sm(e), 0))
# settled: a breath or two, a look round, then the head sinks and it sleeps
for hr, br in [(.3, 0), (.3, .3), (.3, .5), (.4, .3), (.3, 0), (.2, -.2), (.3, 0),
               (.5, .2), (.7, .4), (.9, .5), (.7, .3),
               (.55, .1), (.62, 0), (.55, 0), (.6, .1)]:
  frames.append(pose_at(1, K['head']*(.3 + hr*.3), br*K['breath']*2))
for j in range(1, 6): frames.append(pose_at(1, K['head']*(.45 + .55*sm(j/5)), K['breath']*2*math.sin(j*1.1)*.5))   # head droops
for j in range(4): frames.append(pose_at(1, K['head'], K['breath']*2*[0, .5, 1, .5][j]))   # asleep: it breathes slowly
rest = {'name': 'Rest', 'fps': K['fps'], 'frames': frames}
P['clips'] = [rest if c['name'] == 'Rest' else c for c in P['clips']]
json.dump(P, open(sys.argv[2], 'w'), separators=(',', ':'))
print('rest:', len(frames), 'frames at', K['fps'], 'fps')
