# Builds the Scutosaurus walk clip in a rigger project, leaving the parts, joints and other clips alone.
#   python3 tools/rigger/scutosaurus/gen-walk.py IN.json OUT.json ['{"S":9,"lift":3}']
# A heavy lateral-sequence walk (near hind, near front, far hind, far front, a quarter cycle apart). The legs are root parts, so
# each hip rides the body's bob and each leg is solved with 2-bone IK: the stance ankle slides back at an even speed on the ground
# row while the body goes forward over it, and the swing ankle is lifted and carried forward. The hip offsets are the Idle clip's
# stance (hind legs a touch low, front legs raised and nearly straight), so walking and standing look like the same animal.
import json, math, sys
from kit import *
K = dict(N=12, fps=8, ds=.7, S=9.0, lift=3.0, bob=.7, pitch=.8, head=1.6, tail=2.2, cx_b=42.0, cx_f=68.0, ground=65.0, hip_b=(1, 1.5), hip_f=(-1, -4), toe=1.0)
if len(sys.argv) > 3: K.update(json.loads(sys.argv[3]))
P = json.load(open(sys.argv[1])); R = SRig(P)
LG = [('nb', 'b', 0), ('nf', 'f', .25), ('fb', 'b', .5), ('ff', 'f', .75)]
frames, short = [], 0
for i in range(K['N']):
  f, pose = i/K['N'], {}
  bob = K['bob']*math.sin(2*math.pi*2*f)           # down twice a cycle as a hind foot and then a front foot take the weight
  rb = K['pitch']*math.sin(2*math.pi*(2*f + .25))   # nose down as a front foot takes the weight, up as a hind one does
  pose[BODY] = {'r': rd(rb), 'dx': 0, 'dy': rd(bob)}
  pose[HEAD] = {'r': rd(K['head']*math.sin(2*math.pi*(2*f + .1)) - rb*.5), 'dx': 0, 'dy': 0}
  pose[JAW] = {'r': 0, 'dx': 0, 'dy': 0}
  pose[TAIL] = {'r': rd(K['tail']*math.sin(2*math.pi*(f - .1)) - rb), 'dx': 0, 'dy': 0}
  for key, end, off in LG:
    th, sh, ft = LEGS[key]; hd = K['hip_' + end]
    cx = K['cx_' + end]; fl = (f + off) % 1; lift = 0.0; fr = 0.0
    if fl < K['ds']:
      ox = K['S']/2 - K['S']*fl/K['ds']
      if fl/K['ds'] > .85: fr = K['toe']*8*(fl/K['ds'] - .85)/.15; lift = K['toe']*(fl/K['ds'] - .85)/.15   # the heel comes up as it pushes off
    else:
      t = (fl - K['ds'])/(1 - K['ds']); ox = -K['S']/2 + K['S']*sm(t); lift = K['lift']*math.sin(math.pi*t); fr = 8*(1 - t)*.0
    pose[th] = {'r': 0, 'dx': hd[0], 'dy': rd(hd[1] + bob)}
    short = max(short, leg_ik(R, pose, th, sh, ft, (cx + ox, K['ground'] - lift), fr))
  frames.append(pose)
unwrap(frames)
walk = {'name': 'walk', 'fps': K['fps'], 'frames': frames}
P['clips'] = [walk if c['name'] == 'walk' else c for c in P['clips']]
json.dump(P, open(sys.argv[2], 'w'), separators=(',', ':'))
print('walk:', K['N'], 'frames at', K['fps'], 'fps; worst reach shortfall %.2f px; rstep %.4f' % (short, K['S']/K['ds']/K['N']/40))
