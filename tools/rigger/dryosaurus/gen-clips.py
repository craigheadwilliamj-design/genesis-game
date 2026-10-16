# Writes the Dryosaurus walk, idle and rest clips into its rigger project (the parts are left alone; the other clips are replaced).
#   python3 -I tools/rigger/dryosaurus/gen-clips.py IN.json OUT.json ['{"S":15,"fps":10}']   (IN is dryosaurus-rig.json; contact sheets go to $SHEETS if set)
# A light two-legged runner. walk: each foot planted flat, sliding back at body speed, rolling onto its toes at push-off, swinging forward lifted
# (far leg half a cycle behind), the body bobbing over the planted foot, the tail and neck counter-swinging, the little arms swinging. The thighs are
# root parts, so each hip is shifted with the body's bob by hand. idle: dips the head to browse, chews, lifts it to look round, flicks the tail.
# rest: crouches, sinks onto its belly with the legs folded, tail laid out, head lowered. Uses the 2-bone leg IK in the Carcharodontosaurus's rigkit.py.
import json, math, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'carcharodontosaurus'))
from rigkit import Rig as _Rig, rd, sm, unwrap, I
class Rig(_Rig):   # the thighs are root parts here, so a leg's parent frame is the world
  def worlds(self, pose, _w=_Rig.worlds): return _w(self, pose)
  def leg(self, pose, thigh, shin, foot, ankle, foot_r=0.0, knee=1):
    th = self.by[thigh]; saved = th['parent']
    if saved is None:
      th['parent'] = '_w'; self.by['_w'] = {'id': '_w', 'lx': 0, 'ly': 0, 'parent': None}
    try: return _Rig.leg(self, pose, thigh, shin, foot, ankle, foot_r, knee)
    finally: th['parent'] = saved
K = dict(N=12, fps=10, ds=.62, S=14.0, crouch=.8, lift=3.0, bob=.7, tail=3.0, neck=3.0, arm=14.0, heel=20.0, knee=-1, drop=11.5)
if len(sys.argv) > 3: K.update(json.loads(sys.argv[3]))
P = json.load(open(sys.argv[1])); R = Rig(P)
BODY, NECK, HEAD, JAW, TAIL = 'n216', 'n246', 'n248', 'n228', 'n240'
LEGS = [('n236', 'n234', 'n230', 'n232', 0, 1, 48.0), ('n224', 'n222', 'n218', 'n220', .5, -1, 56.0)]   # thigh, shin, foot, forearm, phase, arm sign, standing ankle x
ARMS = ('n232', 'n220')
GROUND_Y = 66.0   # the ankle's height standing (the sole is the row under it)
TOE, SOLE = 4.0, 2.0
FLOOR = 69.0
def base(bdy=0.0, rb=0.0):
  p = {BODY: {'r': rd(rb), 'dx': 0, 'dy': rd(bdy)}}
  for th, *_ in LEGS: p[th] = {'r': 0, 'dx': 0, 'dy': rd(bdy)}   # a hip rides the body
  return p
def at(keys, i):
  for (f0, *a), (f1, *b) in zip(keys, keys[1:]):
    if f0 <= i <= f1:
      t = sm((i - f0)/(f1 - f0)); return [x + (y - x)*t for x, y in zip(a, b)]
  return keys[-1][1:]
def finish(name, frames):
  return {'name': name, 'fps': K['fps'] if name == 'walk' else K.get('fps_' + name, 8), 'frames': unwrap(frames)}
# ---- walk
walk = []
for i in range(K['N']):
  f = i/K['N']
  up = math.cos(4*math.pi*(f - K['ds']/2 + .25))
  bdy = K['crouch'] - K['bob']*up
  p = base(bdy)
  p[TAIL] = {'r': rd(K['tail']*math.sin(2*math.pi*f) + .8*K['bob']*up), 'dx': 0, 'dy': 0}
  p[NECK] = {'r': rd(K['neck']*math.sin(2*math.pi*(f + .15)) - .8*K['bob']*up), 'dx': 0, 'dy': 0}
  p[HEAD] = {'r': rd(-.6*K['neck']*math.sin(2*math.pi*(f + .15))), 'dx': 0, 'dy': 0}
  for th, sh, ft, arm, off, sg, sx in LEGS:
    mid = sx + 1.0
    fl = (f + off) % 1
    if fl < K['ds']:
      t = fl/K['ds']; x = mid + K['S']/2 - K['S']*t; lift = 0.0; fr = 0.0
      roll = sm((t - .75)/.25)
      if roll > 0:
        a = math.radians(K['heel']*roll); fr = K['heel']*roll
        cx, cy = TOE*math.cos(a) - SOLE*math.sin(a), TOE*math.sin(a) + SOLE*math.cos(a)
        x, lift = x + TOE - cx, cy - SOLE
    else:
      t = (fl - K['ds'])/(1 - K['ds'])
      x = mid - K['S']/2 + K['S']*sm(t); lift = K['lift']*math.sin(math.pi*t)
      fr = K['heel']*(1 - sm(t*2)) - 6*math.sin(math.pi*t)*(t > .5)
      a = math.radians(fr)
      lift = max(lift, max(x0*math.sin(a) + SOLE*math.cos(a) for x0 in (-1, TOE)) - SOLE + .25*math.sin(math.pi*t))
    R.leg(p, th, sh, ft, (x, GROUND_Y - lift), fr, K['knee'])
    p[arm] = {'r': rd(sg*K['arm']*math.sin(2*math.pi*f)), 'dx': 0, 'dy': 0}
  walk.append(p)
# ---- idle (first and last frames are the standing stance)
STAND = {'n236': (48.0, GROUND_Y), 'n224': (56.0, GROUND_Y)}
ikeys = [(0, 0, 0, 0, 0, 0, 0),          # frame, body sink, neck, head, jaw, tail, arms
         (5, .6, 12, 10, 0, -1, 6), (7, .6, 13, 11, 4, -1, 6), (9, .6, 12, 10, 0, -1, 6), (11, .6, 13, 11, 4, -1, 6), (13, .6, 12, 10, 0, -1, 6),   # head down, nibbling
         (19, .2, -5, -6, 0, 3, -8),     # head up, looking round
         (24, .2, -7, -10, 0, 4, -8), (29, .2, -5, -4, 0, -3, -8),
         (33, 0, 0, 0, 0, 0, 0)]
idle = []
for i in range(ikeys[-1][0] + 1):
  bd, nk, hd, jw, tl, ar = at(ikeys, i)
  p = base(bd)
  p[NECK] = {'r': rd(nk), 'dx': 0, 'dy': 0}; p[HEAD] = {'r': rd(hd), 'dx': 0, 'dy': 0}; p[JAW] = {'r': rd(jw), 'dx': 0, 'dy': 0}; p[TAIL] = {'r': rd(tl), 'dx': 0, 'dy': 0}
  for a in ARMS: p[a] = {'r': rd(ar), 'dx': 0, 'dy': 0}
  for th, sh, ft, *_ in LEGS: R.leg(p, th, sh, ft, STAND[th], 0.0, K['knee'])
  idle.append(p)
# ---- rest
D = K['drop']
rkeys = [(0, 0, 0, 0, 0), (4, 3.5, 4, 2, -10), (9, D, 8, 2, -40), (13, D, 14, 6, -40), (15, D + .2, 15, 7, -40)]   # frame, body sink, neck, head, arms
def clear(p, part, r0, step):
  r = r0
  for _ in range(240):
    p[part] = dict(p.get(part, {'dx': 0, 'dy': 0}), r=rd(r))
    if R.lowest(p).get(part, 0) <= FLOOR + .01: return r
    r += step
  return r
rest = []
for i in range(rkeys[-1][0] + 1):
  bd, nk, hd, ar = at(rkeys, i)
  p = base(bd)
  p[NECK] = {'r': rd(nk), 'dx': 0, 'dy': 0}; p[HEAD] = {'r': rd(hd), 'dx': 0, 'dy': 0}; p[JAW] = {'r': 0, 'dx': 0, 'dy': 0}; p[TAIL] = {'r': 0, 'dx': 0, 'dy': 0}
  for a in ARMS: p[a] = {'r': rd(ar), 'dx': 0, 'dy': 0}
  e = sm(min(1, i/9))
  for th, sh, ft, *_ in LEGS: R.leg(p, th, sh, ft, (STAND[th][0] + 4*e, GROUND_Y), 0.0, K['knee'])
  for a in ARMS:   # the arms tuck up against the chest, turned whichever way clears the floor with the least change
    cand = []
    for st in (-1, 1):
      r = p[a]['r']
      for _ in range(240):
        p[a] = dict(p[a], r=rd(r))
        if R.lowest(p).get(a, 0) <= FLOOR + .01: break
        r += st
      cand.append(r)
    p[a] = dict(p[a], r=rd(min(cand, key=lambda r: abs(r - ar))))
  clear(p, TAIL, 0, .25); clear(p, NECK, nk, -.5); clear(p, HEAD, hd, -.5)
  rest.append(p)
P['clips'] = [finish('walk', walk), finish('idle', idle), finish('rest', rest)]
P['clips'][1]['fps'] = 8; P['clips'][2]['fps'] = 6
json.dump(P, open(sys.argv[2], 'w'), separators=(',', ':'))
for nm, fr in (('walk', walk), ('idle', idle), ('rest', rest)):
  low = [max(R.lowest(f).values()) for f in fr]
  print(nm, len(fr), 'frames; lowest row', round(max(low), 2), '(floor 69)')
