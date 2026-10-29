# Writes every Lystrosaurus clip from the hand-made rig (lystrosaurus-rig.json: parts drawn and shaded in the pixel editor, every limb hanging off the body)
# into lystrosaurus.json, which is what gets exported. The parts are left alone.
#   python3 -I tools/rigger/lystrosaurus/gen-clips.py IN.json OUT.json      (SHEETS=<dir> also writes contact sheets and GIFs)
# walk: a short-legged lateral-sequence walk (near hind, near front, far hind, far front, a quarter cycle apart). Each foot is planted flat and slides back
#   at body speed for `ds` of the cycle, then swings forward lifted with the toes hanging; 2-bone IK (rigkit.leg) puts each ankle where it is wanted.
#   The body rides a little crouched, bobs down as each pair of feet takes the weight and rocks nose down as a front foot lands; head and tail swing against it.
# stand: a slow breathing loop, the tail tip and head drifting a little.
# idle: lifts its head and chomps twice. dynamic idle: tips forward, grazes with its beak on the ground, chews, looks up and settles.
# rest: lies down on its belly with the legs folded out, lays the tail and chin down, looks round, yawns and nods off (the game holds the last frame).
# One-shots start and end on the standing pose; the script prints any part that dips under the ground row.
import json, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lystkit import *

P = json.load(open(sys.argv[1])); V = View(P)
GROUND = P['ground'] + 1                     # the bottom edge of the ground row
W0 = V.worlds({}); ANK = {l[0]: (W0[l[2]][4], W0[l[2]][5]) for l in LIMBS}   # each ankle standing, in the world
ARM = {l[0]: math.hypot(ANK[l[0]][0] - W0[l[0]][4], ANK[l[0]][1] - W0[l[0]][5]) for l in LIMBS}   # shoulder or hip to ankle, standing

def stiff(p, limb, a, fore, toe, lift=0.0, fit=True):
  """a limb posed stiff: its joints sit low in tall pictures (the elbow's is at the wrist, the arm's and thigh's mid-picture), so IK bending opens gaps.
  The upper arm or thigh turns `a`, the forearm or shin `fore` and the foot `toe` in the world; with fit the shoulder or hip joint gives a little up or
  down so the limb's lowest pixel sits `lift` over the ground"""
  th, lg, ft = limb; b = p[BODY]['r']
  p[th] = {'r': rd(a - b), 'dx': 0, 'dy': 0}; p[lg] = {'r': rd(fore - a), 'dx': 0, 'dy': 0}; p[ft] = {'r': rd(toe - fore), 'dx': 0, 'dy': 0}
  if fit:
    for _ in range(2): p[th]['dy'] = rd(p[th]['dy'] + GROUND - lift - bottom(p, limb))
  return p

def bottom(p, parts):
  """the lowest edge of these parts as the game draws them (turned at screen size, not snapped to whole pixels)"""
  W = V.worlds(p)
  return max(W[k][1]*(x + .5) + W[k][3]*(y + .5) + W[k][5] for k in parts for x, y in V.pix[k]) + .5

def pose(body=(0, 0, 0), head=0.0, hdy=0.0, jaw=0.0, tail=0.0, feet=None, kneel=0.0):
  """body: (r, dx, dy); feet: {thigh: (ox, lift, foot_r)} off each ankle's standing place (absent: planted where it stands); kneel bends the front legs"""
  p = {BODY: {'r': rd(body[0]), 'dx': rd(body[1]), 'dy': rd(body[2])}, HEAD: {'r': rd(head), 'dx': 0, 'dy': rd(hdy)}, JAW: {'r': rd(jaw), 'dx': 0, 'dy': 0}, TAIL: {'r': rd(tail), 'dx': 0, 'dy': 0}}
  for th, lg, ft in LIMBS:
    ox, lift, fr = (feet or {}).get(th, (0, 0, 0))
    # the limb swings stiff at the shoulder or hip to put the foot ox ahead; lifting it bends the forearm forward (the shin back) a little
    a = -math.degrees(math.asin(max(-.9, min(.9, ox/ARM[th])))) + (30*kneel if th in FRONT else 0)
    stiff(p, (th, lg, ft), a, a - (4*lift + (50*kneel) if th in FRONT else 0), fr + a*min(1, lift), lift)   # a lifted foot turns with the limb, so no gap opens at the ankle
  return p

def check(name, frames):
  for i, f in enumerate(frames):
    low = V.lowest(f)
    bad = [V.by[k]['name'] + ' %.1f' % (v - GROUND) for k, v in low.items() if v > GROUND + .5]
    bad += ['%s joint shifted %.1f' % (V.by[th]['name'], f[th]['dy']) for th, _, _ in LIMBS if abs(f[th]['dy']) > 3]
    if bad: print(' ', name, 'frame', i, 'under the ground:', ', '.join(bad))

def walk(N=8, fps=8, ds=.6, S=6.0, SF=5.0, backF=-.5, lift=1.8, liftF=1.6, bob=.4, pitch=1.2, crouch=.6, toe=0):
  PHASE = {NEAR_BACK[0]: 0, NEAR_FRONT[0]: .25, FAR_BACK[0]: .5, FAR_FRONT[0]: .75}
  out = []
  for i in range(N):
    f = i/N; feet = {}
    rb = pitch*math.sin(4*math.pi*(f + .125))
    for th in PHASE:
      fl, fr = (f + PHASE[th]) % 1, th in FRONT
      st, d, c = (SF, ds*SF/S, backF) if fr else (S, ds, 0)   # a front foot takes a shorter step, planted for less of the cycle so it still slides at body speed
      if fl < d: feet[th] = (c + st/2 - st*fl/d, 0, 0)
      else:
        t = (fl - d)/(1 - d); s = math.sin(math.pi*t)
        feet[th] = (c - st/2 + st*sm(t), (liftF if fr else lift)*s, toe*s)
    out.append(pose((rb, 0, crouch + bob*math.sin(4*math.pi*f + .6)), head=-.7*rb + 1.2*math.sin(4*math.pi*(f + .25)),
                    tail=-1.5*rb + 3*math.sin(2*math.pi*(f + .1)), feet=feet))
  # one cycle covers S/ds px; the rig is drawn 2.5 * rsize (1.1) dot radii across its 100 px cell
  print('walk:', N, 'frames; rstep', round(S/ds/(100/2.75)/N, 4))
  return {'name': 'walk', 'fps': fps, 'frames': unwrap(out)}

def stand(N=12, fps=6):
  out = []
  for i in range(N):
    a = 2*math.pi*i/N; br = (1 - math.cos(a))/2
    out.append(pose((-.4*br, 0, -.5*br), head=-1.2*br + .6*math.sin(a), tail=1.5*math.sin(a + 1)))
  return {'name': 'stand', 'fps': fps, 'frames': unwrap(out)}

def chomp(fps=8):
  # (head lift, jaw): lifts the head, two bites, lowers it
  keys = [(0, 0), (-3, 0), (-5, 6), (-6, 16), (-6, 4), (-6, 0), (-6, 14), (-5, 18), (-5, 2), (-4, 0), (-2, 0), (0, 0)]
  return {'name': 'idle', 'fps': fps, 'frames': unwrap([pose(head=h, jaw=j, tail=.3*h) for h, j in keys])}

def graze(fps=8, K=dict(pitch=7, sink=1, head=24, hdy=3)):
  # tips forward (front legs bending, feet planted), dips the head to the ground, nibbles and chews, looks up and settles
  def g(e, h, j=0.0, tl=0.0):   # e: how far down it has tipped; h: the head's turn past the tip
    return pose((K['pitch']*e, .5*e, K['sink']*e), head=K['head']*e + h, hdy=K['hdy']*e, jaw=j, tail=tl - 3*e, kneel=e)
  keys = [g(0, 0), g(.35, 0), g(.7, 0), g(1, 0), g(1, 3), g(1, 4, 8), g(1, 3, 0), g(1, 4, 10), g(1, 3, 0),
          g(1, -3, 2), g(1, -5, 6), g(1, -5, 0), g(1, -4, 6), g(1, -5, 0), g(1, 1), g(1, 4, 9), g(1, 3, 0),
          g(.8, 0, 4), g(.5, 0, 0), g(.25, -3, 6, 1), g(.1, -5, 0, 2), g(0, -5, 5, 1), g(0, -3, 0), g(0, -1), g(0, 0)]
  return {'name': 'dynamic idle', 'fps': fps, 'frames': unwrap(keys)}

def rest(fps=6, lie=7, drop=6.0, tilt=-1.0, fold={'front': (60, -20), 'back': (-50, 10)}):
  # the legs fold as it sinks, front feet tucked back and hind feet forward under the belly (angles found by a search for the fold that keeps each joint in place)
  def r(e, h, hdy=0.0, j=0.0, br=0.0):
    e = sm(e); p = pose((tilt*e, 0, drop*e - br), head=h, hdy=hdy, jaw=j, tail=-9*e)
    for limb in LIMBS:
      a, fo = fold['front' if limb[0] in FRONT else 'back']; a0 = p[limb[0]]['r']
      stiff(p, limb, a*e, fo*e, 0)
    return p
  keys = [r(i/(lie - 1), 3*sm(i/(lie - 1))) for i in range(lie)]
  # (head turn, head drop, jaw, breath): a look round, a yawn, drifts off, nods awake, drifts off again and sleeps
  for h, hdy, j, br in [(3, 0, 0, 0), (-2, 0, 0, .2), (-4, 0, 0, 0), (-1, 0, 0, .2), (3, 0, 0, 0), (0, 0, 8, .2), (-2, 0, 20, .3), (-1, 0, 10, .2), (2, 0, 0, 0),
                        (5, .3, 0, .2), (8, .6, 0, 0), (11, 1, 0, .3), (6, .4, 0, 0), (3, .2, 0, .2), (7, .5, 0, 0), (10, .8, 0, .2),
                        (12, 1.1, 0, 0), (13, 1.3, 0, .3), (13, 1.3, 0, 0), (13, 1.3, 0, .3), (13, 1.3, 0, 0)]:
    keys.append(r(1, h, hdy, j, br))
  return {'name': 'rest', 'fps': fps, 'frames': unwrap(keys)}

clips = [walk(), stand(), chomp(), graze(), rest()]
for c in clips: check(c['name'], c['frames'])
P['clips'] = clips
json.dump(P, open(sys.argv[2], 'w'), separators=(',', ':'))
out = os.environ.get('SHEETS')
if out:
  for c in clips:
    s = c['name'].replace(' ', '-'); sheet(V, c['frames'], os.path.join(out, s + '-sheet.png'), cols=6, k=3); gif(V, c['frames'], os.path.join(out, s + '.gif'), c['fps'])
