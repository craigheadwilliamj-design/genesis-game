# Rebuilds the Cotylorhynchus walk clip in the hand-made project (cotylorhynchus-clips.json), leaving parts, joints and other clips alone.
#   python3 tools/rigger/cotylorhynchus/gen-walk.py IN.json OUT.json ['{"S":9,"lift":2}']   (SHEETS=<dir> also writes walk-sheet.png and walk.gif)
# Lateral-sequence walk (near hind, near front, far hind, far front, a quarter cycle apart). Each limb is three parts (thigh or upper arm,
# leg or lower arm, foot) on very short bones under big pictures, so a limb swings stiff from the hip as one piece (the knee keeps its
# rest bend and the pieces stay joined), its foot flat on the ground in stance, the whole limb lifted at the hip in the swing;
# a hind heel peels up at push-off (the hip rising so the toes stay on the ground) and stays up a moment into the swing.
import json, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cotykit import *
PHASE = {NEAR_BACK: 0, NEAR_FRONT: .25, FAR_BACK: .5, FAR_FRONT: .75}
K = dict(N=12, fps=8, ds=.66, S=7.0, lift=1.6, bob=.3, pitch=1.4, head=1.6, tail=2.2, crouch=0, shift=-.5, toe=12, name='walk')
if len(sys.argv) > 3: K.update(json.loads(sys.argv[3]))
P = json.load(open(sys.argv[1])); V = View(P)
rest = rests(V); GROUND = max(V.lowest({})[l[2]] for l in LIMBS)
frames = []
for i in range(K['N']):
  f = i/K['N']; pose = {}
  bob = K['bob']*math.sin(4*math.pi*f + .6)                  # down twice a cycle, as each pair of feet take the weight
  rb = K['pitch']*math.sin(4*math.pi*(f + .125))             # nose down as a front foot lands, up as a hind one does
  pose[BODY] = {'r': rd(rb), 'dx': 0, 'dy': rd(K['crouch'] + bob)}
  pose[HEAD] = {'r': rd(-.6*rb + K['head']*math.sin(4*math.pi*(f + .25))), 'dx': 0, 'dy': 0}
  pose[JAW] = {'r': 0, 'dx': 0, 'dy': 0}
  pose[TAIL] = {'r': rd(-.8*rb + K['tail']*math.sin(2*math.pi*(f - .1))), 'dx': 0, 'dy': 0}   # swings once a stride, counter to the body
  for limb in PHASE:
    fl, lift, toe = (f + PHASE[limb]) % 1, 0.0, 0.0
    if fl < K['ds']:
      ox = K['S']/2 - K['S']*fl/K['ds']
      if fl > K['ds'] - .12: toe = K['toe']*(fl - K['ds'] + .12)/.12     # heel comes up as the foot pushes off
    else:
      t = (fl - K['ds'])/(1 - K['ds']); ox = -K['S']/2 + K['S']*sm(t); lift = K['lift']*math.sin(math.pi*t); toe = K['toe']*(1 - sm(min(1, t*2.5)))*.6
    if limb in FRONT: toe = 0                                    # a front foot stays flat; a hind one peels its heel up, the hip rising so its toes stay on the ground
    _, y = stiff(V, pose, limb, x=rest[limb][0] + ox + K['shift'])
    stiff(V, pose, limb, r=pose[limb[0]]['r'], y=y + max(-1.2, min(1.2, rest[limb][1] - y)) - lift, foot=toe, floor=GROUND)   # the hip gives a hair so the foot meets the ground row, and lifts the whole limb in the swing
  frames.append(pose)
unwrap(frames)
save(P, {'name': K['name'], 'fps': K['fps'], 'frames': frames}, sys.argv[2])
print('walk:', len(frames), 'frames at', K['fps'], 'fps; one cycle covers', round(K['S']/K['ds'], 1), 'px, so rstep', round(K['S']/K['ds']/40/K['N'], 4))
out = os.environ.get('SHEETS')
if out: sheet(V, frames, os.path.join(out, 'walk-sheet.png'), cols=4, k=4); gif(V, frames, os.path.join(out, 'walk.gif'), K['fps'])
