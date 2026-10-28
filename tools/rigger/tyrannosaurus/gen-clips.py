# Writes the Tyrannosaurus clips from the hand-made rig (parts and picture untouched).
#   python3 -I tools/rigger/tyrannosaurus/gen-clips.py tools/rigger/tyrannosaurus/trex-rig.json tools/rigger/tyrannosaurus/trex-clips.json [SHEETS=<dir> in the env for contact sheets]
# Faces right, knees forward. Every clip keeps the feet where they belong with rigkit.py's 2-bone leg IK (the thighs hang off the body, so the
# hips ride its bob and tip on their own), and every part above the ground row (Rig.lowest).
#   walk: a 12-frame heavy stride like the Allosaurus's: foot planted flat and sliding back at body speed, heel up at push-off, swung forward lifted;
#         the far leg half a cycle behind; the body rises over each planted foot, tail and neck swing against it, the little arms swing.
#   idle: the standing loop, a slow breath (body sinks and lifts, head and tail sway a little). No repeated end frame, so it loops evenly.
#   idle2: lifts its head and opens its jaw wide in a yawn, then closes it. Starts and ends on the standing pose.
#   idle dynamic: rears back, then drops its body forward low and roars with the head shaking, snaps shut and settles back up.
#   rest: crouches, sinks onto its belly with the legs folded under, lays the tail along the ground and rests its chin. Played once, last frame held.
import json, math, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'carcharodontosaurus'))
from rigkit import Rig, rd, sm, unwrap
BODY, NECK, HEAD, JAW, TAIL, TAIL2 = 'n2', 'n16', 'n20', 'n18', 'n12', 'n14'
LEGS = [('n8', 'n6', 'n10'), ('n133', 'n131', 'n129')]   # near, far: thigh, shin, foot
ARMS = ('n4', 'n135')
P = json.load(open(sys.argv[1])); R = Rig(P)
FLOOR = 75.0                                                     # the bottom edge of the ground row (74)
GROUND_Y = R.worlds({})['n10'][5]                                # the ankle's height standing (71)
STAND = {th: tuple(R.worlds({})[ft][4:]) for th, sh, ft in LEGS} # each ankle where the picture has it
TOE, HEEL, SOLE = 6.5, -2.5, 3.5                                 # the foot's front and back corners and the sole's bottom edge, from the ankle

def keyed(KEYS, i):   # eased keyframes: (frame, values...)
  for (f0, *a), (f1, *b) in zip(KEYS, KEYS[1:]):
    if f0 <= i <= f1:
      t = sm((i - f0)/(f1 - f0)); return [x + (y - x)*t for x, y in zip(a, b)]
  return KEYS[-1][1:]
def body_pose(rb=0, bdy=0, nk=0, hd=0, jw=0, tl=0, tl2=None, ar=0):
  p = {BODY: {'r': rd(rb), 'dx': 0, 'dy': rd(bdy)}, NECK: {'r': rd(nk), 'dx': 0, 'dy': 0}, HEAD: {'r': rd(hd), 'dx': 0, 'dy': 0},
       JAW: {'r': rd(jw), 'dx': 0, 'dy': 0}, TAIL: {'r': rd(tl), 'dx': 0, 'dy': 0}, TAIL2: {'r': rd(.6*tl if tl2 is None else tl2), 'dx': 0, 'dy': 0}}
  for a in ARMS: p[a] = {'r': rd(ar), 'dx': 0, 'dy': 0}
  return p
def planted(p):   # both feet flat where they stand
  for th, sh, ft in LEGS: R.leg(p, th, sh, ft, STAND[th], 0.0, 1)
  return p
def clear(p, part, r0, step):   # turn `part` from r0 by `step` until it no longer goes under the floor
  r = r0
  for _ in range(200):
    p[part] = dict(p.get(part, {'dx': 0, 'dy': 0}), r=rd(r))
    if R.lowest(p).get(part, 0) <= FLOOR + .01: return r
    r += step
  return r

def walk(N=12, fps=8, ds=.62, S=12.0, crouch=2.5, lift=3.0, bob=.6, pitch=.8, tail=3.0, neck=2.0, arm=10.0, heel=18.0):
  frames = []
  for i in range(N):
    f = i/N
    up = math.cos(4*math.pi*(f - ds/2 + .25))   # +1 high over a planted foot, -1 low as the weight passes between feet
    rb = pitch*math.sin(4*math.pi*f)
    p = body_pose(rb, crouch - bob*up, -rb + neck*math.sin(2*math.pi*(f + .15)) - .8*bob*up, -.5*neck*math.sin(2*math.pi*(f + .15)), 0,
                  tail*math.sin(2*math.pi*f) - rb + .8*bob*up, .6*tail*math.sin(2*math.pi*(f - .12)))
    for (th, sh, ft), off, sg, arm_id in zip(LEGS, (0, .5), (1, -1), ARMS):
      mid = STAND[th][0]; fl = (f + off) % 1
      if fl < ds:   # planted: slides back toward the tail, the heel peeling up in the last quarter
        t = fl/ds; x = mid + S/2 - S*t; ly = 0.0; fr = 0.0
        roll = sm((t - .75)/.25)
        if roll > 0:
          fr = heel*roll; a = math.radians(fr)
          cx, cy = TOE*math.cos(a) - SOLE*math.sin(a), TOE*math.sin(a) + SOLE*math.cos(a)   # the toe corner turned with the foot
          x, ly = x + TOE - cx, cy - SOLE                                                     # the ankle that keeps it on the ground
      else:         # swing: forward and lifted, toes trailing, then level to land
        t = (fl - ds)/(1 - ds)
        x = mid - S/2 + S*sm(t); ly = lift*math.sin(math.pi*t)
        fr = heel*(1 - sm(t*2)) - 6*math.sin(math.pi*t)*(t > .5); a = math.radians(fr)
        ly = max(ly, max(x0*math.sin(a) + SOLE*math.cos(a) for x0 in (TOE, HEEL)) - SOLE + .25*math.sin(math.pi*t))
      R.leg(p, th, sh, ft, (x, GROUND_Y - ly), fr, 1)
      p[arm_id] = {'r': rd(sg*arm*math.sin(2*math.pi*f)), 'dx': 0, 'dy': 0}
    frames.append(p)
  return {'name': 'walk', 'fps': fps, 'frames': unwrap(frames)}

def idle(N=12, fps=6, sink=.8):   # a breath: the body settles and lifts, the head and tail answer a beat later
  frames = []
  for i in range(N):
    f = i/N; b = (1 - math.cos(2*math.pi*f))/2; s = math.sin(2*math.pi*(f - .1))
    frames.append(planted(body_pose(.6*b, sink*b, -1.2*b + 1.0*s, .8*b - .6*s, 0, 1.5*s, 1.2*math.sin(2*math.pi*(f - .25)), 3*b)))
  return {'name': 'idle', 'fps': fps, 'frames': unwrap(frames)}

def oneshot(name, fps, KEYS):
  frames = []
  for i in range(KEYS[-1][0] + 1):
    rb, bdy, nk, hd, jw, tl, ar = keyed(KEYS, i)
    frames.append(planted(body_pose(rb, bdy, nk, hd, jw, tl, None, ar)))
  return {'name': name, 'fps': fps, 'frames': unwrap(frames)}

# keyframes: frame, body tip (+ nose down), body sink, neck, head, jaw, tail, arms
YAWN = [(0, 0, 0, 0, 0, 0, 0, 0),
        (3, -1.5, .3, -2, -4, 3, 1, -4),     # lifts its head
        (6, -2, .4, -3, -7, 18, 1.5, -6),    # jaw wide
        (9, -2, .4, -3, -8, 20, 1.5, -6),    # holds it
        (12, 0, .2, 0, 0, 0, 0, 0),          # snaps shut
        (13, 0, 0, 0, 0, 0, 0, 0)]
ROAR = [(0, 0, 0, 0, 0, 0, 0, 0),
        (4, -5, .8, -4, -6, 4, 4, -10),      # rears back, head up
        (8, 16, 3.5, -6, -12, 30, -9, 25),   # drops forward low, jaws open
        (10, 18, 4, -8, -15, 34, -10, 30),   # roars
        (12, 18, 4, -6, -11, 34, -10, 30), (14, 18, 4, -8, -16, 33, -10, 30), (16, 18, 4, -6, -11, 33, -10, 30), (18, 17, 4, -8, -15, 30, -10, 30),   # shakes its head
        (21, 8, 2, -3, -5, 0, -4, 12),       # snaps shut, coming up
        (24, -1, .4, 1, 1, 0, 1, -2),        # a little lift past standing
        (27, 0, 0, 0, 0, 0, 0, 0)]

def rest(fps=7, drop=10.5, neck=12.0, head=6.0, fold=(46.0, 53.0)):
  KEYS = [(0, 0, 0, 0, 0, 0),
          (4, 4, 4, 5, 2, 20),                  # crouches, nose dipping
          (9, 1.5, drop, 8, 3, 40),             # down onto its belly
          (12, 0, drop, neck, head, 40),        # lays its head down
          (14, 0, drop, neck + 1, head + 1, 40)]
  frames = []
  for i in range(KEYS[-1][0] + 1):
    rb, bdy, nk, hd, ar = keyed(KEYS, i)
    p = body_pose(rb, bdy, nk, hd, 0, 0, 0, ar)
    plan = sm(min(1, i/KEYS[2][0]))   # the feet shuffle forward under the belly as it lands
    def place(e):
      for (th, sh, ft), fx in zip(LEGS, fold): R.leg(p, th, sh, ft, (STAND[th][0] + (fx - STAND[th][0])*e, GROUND_Y), 0.0, 1)
      lo = R.lowest(p); return max(lo[k] for leg in LEGS for k in leg) - FLOOR
    place(min((x/50 for x in range(51)), key=lambda x: (max(0, round(place(x), 2)), abs(x - plan))))   # nearest the plan that keeps the legs out of the ground
    clear(p, TAIL, 0, -.25); clear(p, TAIL2, 0, -.25)   # the tail lies along the ground, lifted only as much as it needs
    for a in ARMS: clear(p, a, p[a]['r'], -2.0)
    clear(p, NECK, nk, -.5); clear(p, HEAD, hd, -.5)    # the chin rests on the ground, never in it
    frames.append(p)
  return {'name': 'rest', 'fps': fps, 'frames': unwrap(frames)}

clips = {'walk': walk(), 'idle': idle(), 'idle2': oneshot('idle2', 6, YAWN), 'idle dynamic': oneshot('idle dynamic', 9, ROAR), 'rest': rest()}
P['clips'] = [clips[c['name']] for c in P['clips'] if c['name'] in clips] + [c for c in clips.values() if c['name'] not in {x['name'] for x in P['clips']}]
json.dump(P, open(sys.argv[2], 'w'), separators=(',', ':'))
for c in P['clips']:
  lo = [R.lowest(f) for f in c['frames']]
  feet = [round(max(l[k] for leg in LEGS for k in leg), 2) for l in lo]
  under = [(i, {R.by[k]['name']: round(v, 2) for k, v in l.items() if v > FLOOR + .3}) for i, l in enumerate(lo)]
  print(f"{c['name']}: {len(c['frames'])} frames; feet's lowest edge {min(feet)} to {max(feet)} (ground {FLOOR}); under the ground:", [u for u in under if u[1]] or 'none')
if os.environ.get('SHEETS'):
  sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
  from rigdraw import Draw
  from PIL import Image
  D = Draw(P); W, H = P['cell']['w'], P['cell']['h']
  for c in P['clips']:
    fr = [D.pose(f) for f in c['frames']]; cols = min(len(fr), 7); rows = -(-len(fr)//cols)
    sheet = Image.new('RGBA', (W*cols, H*rows), (205, 222, 200, 255))
    for i, im in enumerate(fr):
      x, y = (i % cols)*W, (i//cols)*H
      for u in range(W): sheet.putpixel((x + u, y + int(FLOOR) - 1), (150, 170, 140, 255))
      sheet.alpha_composite(im, (x, y))
    sheet.resize((sheet.width*3, sheet.height*3), Image.NEAREST).save(os.path.join(os.environ['SHEETS'], c['name'].replace(' ', '-') + '.png'))
    fr[0].save(os.path.join(os.environ['SHEETS'], c['name'].replace(' ', '-') + '.gif'), save_all=True, append_images=fr[1:], duration=int(1000/c['fps']), loop=0, disposal=2)
