# Rebuilds the Cotylorhynchus `idle` clip (played once now and then while it stands) in the hand-made project, leaving parts, joints and other clips alone.
#   python3 tools/rigger/cotylorhynchus/gen-idle.py IN.json OUT.json ['{"dip":12}']   (SHEETS=<dir> also writes idle-sheet.png and idle.gif)
# Breathes in, tips forward to drop its head and sniff the ground, chomps twice, lifts its head back up and settles. The feet stay planted:
# each limb turns stiff about its hip (cotykit.stiff) to cancel the body's tip and sinks or rises there to cancel its drop.
import json, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cotykit import *
K = dict(N=18, fps=6, tip=1.6, drop=.6, dip=12, chomp=9, breath=.4, tail=1.5, name='idle')
if len(sys.argv) > 3: K.update(json.loads(sys.argv[3]))
P = json.load(open(sys.argv[1])); V = View(P); rest = rests(V)
def env(t, a, b, c, d):   # 0 before a, eases up to 1 by b, holds, eases back to 0 from c to d
  return sm((t - a)/(b - a)) if t < c else 1 - sm((t - c)/(d - c))
frames = []
for i in range(K['N']):
  t = i/(K['N'] - 1); pose = {}
  breath = K['breath']*math.sin(math.pi*min(1, t/.25))*(t < .25)   # one breath in and out before it leans
  lean = env(t, .2, .42, .72, .95)                                    # tips forward, head down, then back
  pose[BODY] = {'r': rd(K['tip']*lean), 'dx': 0, 'dy': rd(K['drop']*lean - breath)}
  ch = max(0, math.sin(2*math.pi*(t - .42)/.15)) if .42 <= t <= .72 else 0   # two chomps while the head is down
  pose[HEAD] = {'r': rd(K['dip']*lean - 2*ch), 'dx': 0, 'dy': 0}
  pose[JAW] = {'r': rd(K['chomp']*ch), 'dx': 0, 'dy': 0}
  pose[TAIL] = {'r': rd(-K['tip']*lean + K['tail']*math.sin(2*math.pi*t)), 'dx': 0, 'dy': 0}
  for limb in LIMBS: stiff(V, pose, limb, x=rest[limb][0], y=rest[limb][1])
  frames.append(pose)
frames[0] = frames[-1] = {}   # starts and ends on the standing pose
unwrap(frames)
save(P, {'name': K['name'], 'fps': K['fps'], 'frames': frames}, sys.argv[2])
print('idle:', len(frames), 'frames at', K['fps'], 'fps')
out = os.environ.get('SHEETS')
if out: sheet(V, frames, os.path.join(out, 'idle-sheet.png'), cols=6, k=4); gif(V, frames, os.path.join(out, 'idle.gif'), K['fps'])
