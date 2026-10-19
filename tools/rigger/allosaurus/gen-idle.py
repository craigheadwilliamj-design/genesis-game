# Writes the Allosaurus idle into a rigger project (the parts and other clips are left alone).
#   python3 tools/rigger/allosaurus/gen-idle.py allosaurus-clips.json allosaurus-clips.json ['{"fps":8,"roar":26}']
# It dips its head to sniff the ground, lifts, rears back and roars with a shake of the head, snaps its jaw shut and settles.
# The game holds the first frame while it stands and plays the clip once now and then, so the first and last frames are the same standing stance (STAND).
# The feet stay planted (2-bone IK on each leg) however the body tips and sinks. Keyframes are written for a right-facing animal (+ is nose down) and turned by FACE (1 here).
import json, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from allokit import *
K = dict(fps=8, roar=26.0, rear=8.0, knee=1)
if len(sys.argv) > 3: K.update(json.loads(sys.argv[3]))
P = json.load(open(sys.argv[1])); R = Rig(P)
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
frames = []
for i in range(KEYS[-1][0] + 1):
  rb, bdy, nk, hd, jw, tl, ar = at(i); s = FACE
  bd = rd(bdy + CROUCH)
  p = {BODY: {'r': rd(s*rb), 'dx': 0, 'dy': bd}, NECK: {'r': rd(s*nk), 'dx': 0, 'dy': 0}, HEAD: {'r': rd(s*hd), 'dx': 0, 'dy': 0},
       JAW: {'r': rd(s*jw), 'dx': 0, 'dy': 0}, TAIL: {'r': rd(s*tl), 'dx': 0, 'dy': 0}, TAIL2: {'r': rd(s*.6*tl), 'dx': 0, 'dy': 0}}
  for a in ARMS: p[a] = {'r': rd(s*ar), 'dx': 0, 'dy': 0}
  for th, sh, ft in LEGS:
    p[th] = {'r': 0, 'dx': 0, 'dy': bd}   # the hip rides the body
    R.leg(p, th, sh, ft, STAND[th], 0.0, K['knee'])
  frames.append(p)
clip = {'name': 'idle', 'fps': K['fps'], 'frames': unwrap(frames)}
P['clips'] = [clip if c['name'] == 'idle' else c for c in P['clips']] if any(c['name'] == 'idle' for c in P['clips']) else P['clips'] + [clip]
json.dump(P, open(sys.argv[2], 'w'), separators=(',', ':'))
low = [max(R.lowest(fr).values()) for fr in frames]
print('idle:', len(frames), 'frames; lowest drawn row', round(min(low), 2), 'to', round(max(low), 2), '(ground row bottom is 69)')
