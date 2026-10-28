# Rebuilds the Cotylorhynchus `rest` clip (played once as it settles to rest, then its last frame is held) in the hand-made project,
# leaving parts, joints and other clips alone.
#   python3 tools/rigger/cotylorhynchus/gen-rest.py IN.json OUT.json ['{"drop":5}']   (SHEETS=<dir> also writes rest-sheet.png and rest.gif)
# Shifts its weight, sinks onto its belly with the limbs sprawling out flat like a lizard's (front feet forward, hind feet back, each limb
# stiff, cotykit.stiff, its hip rising into the flank so the foot stays on the ground), lays the tail down, then lowers its head.
import json, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cotykit import *
K = dict(N=14, fps=4, drop=4.9, front=-30, back=34, head=14, name='rest')
if len(sys.argv) > 3: K.update(json.loads(sys.argv[3]))
P = json.load(open(sys.argv[1])); V = View(P); rest = rests(V)
lying = {BODY: {'r': .6, 'dx': 0, 'dy': K['drop']}}
TAIL_DOWN = next(r/10 for r in range(-100, 101) if V.lowest({**lying, TAIL: {'r': r/10}})[TAIL] <= 75.05)   # the tail laid on the ground, not into it
frames = []
for i in range(K['N']):
  t = i/(K['N'] - 1); pose = {}
  shift = math.sin(math.pi*min(1, t/.2))*(t < .2)     # rocks back onto its hind legs a moment before going down
  down = sm((t - .15)/.5)                              # sinks onto the belly
  head = sm((t - .6)/.35)                              # then lays its head down
  pose[BODY] = {'r': rd(-.8*shift + .6*down), 'dx': rd(-.6*shift), 'dy': rd(K['drop']*down)}
  pose[HEAD] = {'r': rd(-1.5*shift + K['head']*head - .6*down), 'dx': 0, 'dy': 0}
  pose[JAW] = {'r': 0, 'dx': 0, 'dy': 0}
  pose[TAIL] = {'r': rd(.8*shift + TAIL_DOWN*down), 'dx': 0, 'dy': 0}
  for limb in LIMBS:
    if down < .01: stiff(V, pose, limb, x=rest[limb][0], y=rest[limb][1])
    else: stiff(V, pose, limb, r=(K['front'] if limb in FRONT else K['back'])*down - pose[BODY]['r'], y=rest[limb][1])
  frames.append(pose)
frames[0] = {}
unwrap(frames)
save(P, {'name': K['name'], 'fps': K['fps'], 'frames': frames}, sys.argv[2])
print('rest:', len(frames), 'frames at', K['fps'], 'fps')
out = os.environ.get('SHEETS')
if out: sheet(V, frames, os.path.join(out, 'rest-sheet.png'), cols=7, k=4); gif(V, frames, os.path.join(out, 'rest.gif'), K['fps'])
