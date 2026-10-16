# Rebuilds the Carcharodontosaurus idle in a rigger project (the parts and other clips are left alone).
#   python3 tools/rigger/carcharodontosaurus/gen-idle.py IN.json OUT.json ['{"fps":8,"roar":28}']
# It dips its head to sniff the ground, lifts, rears back and roars with a shake of the head, snaps its jaw shut and settles.
# The game holds the first frame while it stands and plays the clip once now and then, so the first and last frames are the same standing stance (STAND).
# The feet stay planted (2-bone IK on each leg, see rigkit.py) however the body tips and sinks.
import json, math, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rigkit import Rig, rd, sm, unwrap
K = dict(fps=8, roar=28.0, rear=10.0, knee=-1)
if len(sys.argv) > 3: K.update(json.loads(sys.argv[3]))
P = json.load(open(sys.argv[1])); R = Rig(P)
BODY, NECK, HEAD, JAW, TAIL = 'n130', 'n132', 'n134', 'n136', 'n146'
LEGS = [('n140', 'n142', 'n144'), ('n148', 'n150', 'n152')]
ARMS = ('n138', 'n154')
A, G = K['rear'], K['roar']
# keyframes: frame, body tip (+ nose down), body sink, neck, head, jaw, tail, arms
KEYS = [(0,  0, 0, 0, 0, 0, 0, 0),
        (6,  2.5, .8, 9, 5, 0, -1, 4),          # head down to sniff
        (8,  2.5, .8, 10, 4, 2, -1, 4), (10, 2.5, .8, 9, 6, 0, -1, 4), (12, 2.5, .8, 10, 4, 2, -1, 4), (14, 2.5, .8, 9, 5, 0, -1, 4),   # sniff, sniff
        (20, -A, 1.6, -10, -6, 0, A*.8, -12),   # rears back, head high
        (24, -A, 1.6, -12, -10, G, A*.8, -18),  # roar
        (26, -A, 1.6, -11, -8, G, A*.8, -18), (28, -A, 1.6, -13, -11, G, A*.8, -18), (30, -A, 1.6, -11, -8, G, A*.8, -18), (32, -A, 1.6, -13, -11, G*.9, A*.8, -18),   # shakes its head
        (34, -A*.6, 1.2, -8, -4, 0, A*.5, -10), # snaps shut
        (38, 1, .4, 3, 2, 0, 0, 2),             # a little dip as it comes down
        (44, 0, 0, 0, 0, 0, 0, 0)]
def at(i):
  for (f0, *a), (f1, *b) in zip(KEYS, KEYS[1:]):
    if f0 <= i <= f1:
      t = sm((i - f0)/(f1 - f0)); return [x + (y - x)*t for x, y in zip(a, b)]
  return KEYS[-1][1:]
STAND = {'n140': (57.5, 67.0), 'n148': (51.5, 67.0)}   # the standing stance: near foot a little forward, far foot a little back, knees soft (the rest pose has both legs straight, one over the other)
CROUCH = 1.0
frames = []
for i in range(KEYS[-1][0] + 1):
  rb, bdy, nk, hd, jw, tl, ar = at(i)
  p = {BODY: {'r': rd(rb), 'dx': 0, 'dy': rd(bdy + CROUCH)}, NECK: {'r': rd(nk), 'dx': 0, 'dy': 0}, HEAD: {'r': rd(hd), 'dx': 0, 'dy': 0},
       JAW: {'r': rd(jw), 'dx': 0, 'dy': 0}, TAIL: {'r': rd(tl), 'dx': 0, 'dy': 0}}
  for a in ARMS: p[a] = {'r': rd(ar), 'dx': 0, 'dy': 0}
  for th, sh, ft in LEGS: R.leg(p, th, sh, ft, STAND[th], 0.0, K['knee'])
  frames.append(p)
clip = {'name': 'idle', 'fps': K['fps'], 'frames': unwrap(frames)}
P['clips'] = [clip if c['name'] == 'idle' else c for c in P['clips']]
json.dump(P, open(sys.argv[2], 'w'), separators=(',', ':'))
low = [max(R.lowest(fr).values()) for fr in frames]
print('idle:', len(frames), 'frames; lowest drawn row', round(max(low), 2), '(ground row bottom is 69)')
