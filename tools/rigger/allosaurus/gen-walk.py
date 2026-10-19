# Writes the Allosaurus walk into a rigger project (parts and other clips are left alone).
#   python3 tools/rigger/allosaurus/gen-walk.py allosaurus-rig.json allosaurus-clips.json ['{"S":12,"crouch":3}']
# Faces right. A heavy theropod stride like the Carcharodontosaurus's (rigkit.py): each foot is planted flat and slides back at body speed,
# rolls up onto its toes at push-off, and swings forward lifted; the far leg is half a cycle behind. The thighs are root parts, so each hip
# rides the body's bob by hand. The body rises over each planted foot, the tail and neck swing against it, and the little arms swing.
import json, math, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'carcharodontosaurus'))
from rigkit import Rig as _Rig, rd, sm, unwrap
class Rig(_Rig):   # a root thigh's parent frame is the world
  def leg(self, pose, thigh, shin, foot, ankle, foot_r=0.0, knee=1):
    th = self.by[thigh]; saved = th['parent']
    if saved is None:
      th['parent'] = '_w'; self.by['_w'] = {'id': '_w', 'lx': 0, 'ly': 0, 'parent': None}
    try: return _Rig.leg(self, pose, thigh, shin, foot, ankle, foot_r, knee)
    finally: th['parent'] = saved
K = dict(N=12, fps=8, ds=.62, S=12.0, crouch=3.0, lift=3.0, bob=.7, pitch=.8, tail=3.0, neck=2.0, arm=10.0, heel=20.0, knee=1)
if len(sys.argv) > 3: K.update(json.loads(sys.argv[3]))
P = json.load(open(sys.argv[1])); R = Rig(P)
BODY, NECK, HEAD, JAW, TAIL = 'n282', 'n280', 'n272', 'n274', 'n276'
TAIL2 = 'n278'
LEGS = [('n254', 'n256', 'n258', 'n270', 0, 1), ('n264', 'n262', 'n260', 'n284', .5, -1)]   # near first: thigh, shin, foot, arm, phase, arm sign
GROUND_Y = 67.0   # the ankle's height standing (the sole is the row under it)
TOE, HEEL, SOLE = 5.0, -2.0, 2.0   # the foot's front and back corners in its frame (from the ankle) and its sole row
frames = []
for i in range(K['N']):
  f, p = i/K['N'], {}
  up = math.cos(4*math.pi*(f - K['ds']/2 + .25))   # +1 high over a planted foot, -1 low as weight passes between feet
  bdy = K['crouch'] - K['bob']*up
  rb = K['pitch']*math.sin(4*math.pi*f)
  p[BODY] = {'r': rd(rb), 'dx': 0, 'dy': rd(bdy)}
  p[TAIL] = {'r': rd(K['tail']*math.sin(2*math.pi*f) - rb + .8*K['bob']*up), 'dx': 0, 'dy': 0}
  p[TAIL2] = {'r': rd(.6*K['tail']*math.sin(2*math.pi*(f - .12))), 'dx': 0, 'dy': 0}
  p[NECK] = {'r': rd(-rb + K['neck']*math.sin(2*math.pi*(f + .15)) - .8*K['bob']*up), 'dx': 0, 'dy': 0}
  p[HEAD] = {'r': rd(-.5*K['neck']*math.sin(2*math.pi*(f + .15))), 'dx': 0, 'dy': 0}
  p[JAW] = {'r': 0, 'dx': 0, 'dy': 0}
  for th, sh, ft, arm, off, sg in LEGS:
    p[th] = {'r': 0, 'dx': 0, 'dy': rd(bdy)}   # the hip rides the body
    mid = R.by[th]['lx'] + R.by[sh]['lx'] + R.by[ft]['lx']   # the ankle's x standing
    fl = (f + off) % 1
    if fl < K['ds']:
      t = fl/K['ds']; x = mid + K['S']/2 - K['S']*t; lift = 0.0; fr = 0.0   # planted: slides back (toward the tail)
      roll = sm((t - .75)/.25)   # the last quarter of stance: the heel comes up, the foot pivots on its toes
      if roll > 0:
        fr = K['heel']*roll; a = math.radians(fr)
        cx, cy = TOE*math.cos(a) - SOLE*math.sin(a), TOE*math.sin(a) + SOLE*math.cos(a)   # the toe corner turned with the foot
        x, lift = x + TOE - cx, cy - SOLE                                                 # the ankle that keeps that corner on the ground
    else:
      t = (fl - K['ds'])/(1 - K['ds'])
      x = mid - K['S']/2 + K['S']*sm(t); lift = K['lift']*math.sin(math.pi*t)
      fr = K['heel']*(1 - sm(t*2)) - 6*math.sin(math.pi*t)*(t > .5)   # toes trail off the push, then level out to land
      a = math.radians(fr)
      lift = max(lift, max(x0*math.sin(a) + SOLE*math.cos(a) for x0 in (TOE, HEEL)) - SOLE + .25*math.sin(math.pi*t))   # high enough that neither end scrapes
    R.leg(p, th, sh, ft, (x, GROUND_Y - lift), fr, K['knee'])
    p[arm] = {'r': rd(sg*K['arm']*math.sin(2*math.pi*f)), 'dx': 0, 'dy': 0}
  frames.append(p)
clip = {'name': 'walk', 'fps': K['fps'], 'frames': unwrap(frames)}
P['clips'] = [clip if c['name'] == 'walk' else c for c in P['clips']]
json.dump(P, open(sys.argv[2], 'w'), separators=(',', ':'))
low = [max(R.lowest(fr).values()) for fr in frames]
print('walk:', K['N'], 'frames; lowest drawn row', round(min(low), 2), 'to', round(max(low), 2), '(ground row bottom is 69)')
