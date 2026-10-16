# Rebuilds the Carcharodontosaurus walk in a rigger project (the parts and other clips are left alone).
#   python3 tools/rigger/carcharodontosaurus/gen-walk.py IN.json OUT.json ['{"S":16,"crouch":2.5}']
# A heavy theropod stride: the body rides a little crouched so the legs have room to reach, each foot is planted flat and slides back
# at body speed, rolls up onto its toes at push-off, and swings forward lifted; the far leg is half a cycle behind. The body rises over
# each planted foot and dips between, the tail and neck swing against the body so the head stays steady, and the little arms swing.
import json, math, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rigkit import Rig, rd, sm, unwrap
K = dict(N=12, fps=8, ds=.62, S=14.0, mid=58.0, crouch=1.2, lift=3.0, bob=.8, pitch=1.0, tail=3.0, neck=2.0, arm=10.0, heel=22.0, knee=-1)
if len(sys.argv) > 3: K.update(json.loads(sys.argv[3]))
P = json.load(open(sys.argv[1])); R = Rig(P)
BODY, NECK, HEAD, JAW, TAIL = 'n130', 'n132', 'n134', 'n136', 'n146'
LEGS = [('n140', 'n142', 'n144', 'n138', 0, 1), ('n148', 'n150', 'n152', 'n154', .5, -1)]   # thigh, shin, foot, arm, phase, arm sign
GROUND_Y = 67.0   # the ankle's height standing (the sole is the row under it)
TOE, SOLE = 6.0, 2.0   # the toe tip's bottom corner in the foot's frame (from the ankle), the pivot for push-off; the heel's is (-1, SOLE)
frames = []
for i in range(K['N']):
  f, p = i/K['N'], {}
  up = math.cos(4*math.pi*(f - K['ds']/2 + .25))   # +1 high over a planted foot, -1 low as weight passes between feet
  bdy = K['crouch'] - K['bob']*up
  rb = K['pitch']*math.sin(4*math.pi*f)
  p[BODY] = {'r': rd(rb), 'dx': 0, 'dy': rd(bdy)}
  p[TAIL] = {'r': rd(K['tail']*math.sin(2*math.pi*f) - rb + .8*K['bob']*up), 'dx': 0, 'dy': 0}
  p[NECK] = {'r': rd(-rb + K['neck']*math.sin(2*math.pi*(f + .15)) - .8*K['bob']*up), 'dx': 0, 'dy': 0}
  p[HEAD] = {'r': rd(-.5*K['neck']*math.sin(2*math.pi*(f + .15))), 'dx': 0, 'dy': 0}
  p[JAW] = {'r': 0, 'dx': 0, 'dy': 0}
  for th, sh, ft, arm, off, sg in LEGS:
    fl = (f + off) % 1
    if fl < K['ds']:
      t = fl/K['ds']; x = K['mid'] + K['S']/2 - K['S']*t; lift = 0.0; fr = 0.0
      roll = sm((t - .75)/.25)   # the last quarter of stance: heel comes up, the foot pivots on its toes
      if roll > 0:
        a = math.radians(K['heel']*roll); fr = K['heel']*roll
        cx, cy = TOE*math.cos(a) - SOLE*math.sin(a), TOE*math.sin(a) + SOLE*math.cos(a)   # the toe corner turned with the foot
        x, lift = x + TOE - cx, cy - SOLE                                         # the ankle that keeps that corner on the ground
    else:
      t = (fl - K['ds'])/(1 - K['ds'])
      x = K['mid'] - K['S']/2 + K['S']*sm(t); lift = K['lift']*math.sin(math.pi*t)
      fr = K['heel']*(1 - sm(t*2)) - 6*math.sin(math.pi*t)*(t > .5)   # toes trail off the push, then level out to land
      a = math.radians(fr)
      lift = max(lift, max(x0*math.sin(a) + SOLE*math.cos(a) for x0 in (-1, TOE)) - SOLE + .25*math.sin(math.pi*t))   # always high enough that neither end of the foot scrapes
    R.leg(p, th, sh, ft, (x, GROUND_Y - lift), fr, K['knee'])
    p[arm] = {'r': rd(sg*K['arm']*math.sin(2*math.pi*f)), 'dx': 0, 'dy': 0}
  frames.append(p)
clip = {'name': 'walk', 'fps': K['fps'], 'frames': unwrap(frames)}
P['clips'] = [clip if c['name'] == 'walk' else c for c in P['clips']]
json.dump(P, open(sys.argv[2], 'w'), separators=(',', ':'))
low = [max(R.lowest(fr).values()) for fr in frames]
print('walk:', K['N'], 'frames; lowest drawn row', round(max(low), 2), '(ground row bottom is 69)')
