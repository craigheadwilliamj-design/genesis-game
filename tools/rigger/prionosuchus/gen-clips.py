# Writes every Prionosuchus clip from the hand-made rig (prionosuchus-rig.json: parts drawn and shaded in the pixel editor; each limb is one
# leg piece off the body with a foot under it; head, jaw, one tail piece) into prionosuchus.json, which is what gets exported. The parts are
# left alone, except that hidden layers (a traced reference) and the editor's test clips are dropped.
#   python3 -I tools/rigger/prionosuchus/gen-clips.py IN.json OUT.json      (SHEETS=<dir> also writes contact sheets and GIFs)
# walk: a low sprawling lateral-sequence crawl (near hind, near front, far hind, far front, a quarter cycle apart): no IK, each leg swings
#   about its hip or shoulder with the foot kept flat, the joint giving so the stance foot stays on the ground; the swing foot lifts, its toes
#   hanging a little; the body bobs, the head nods and the tail sways, never into the ground.
# stand: breathing. idle: lifts its snout, gapes wide and snaps shut, tail flick. dynamic idle: lunges, snapping sideways at fish twice, and
#   settles back. rest: sinks onto its belly with the forelegs splayed forward and the hind legs back, lays the tail down and lowers its head
#   a little (the game holds the last frame). swim: low in the water (the game clips everything under the waterline, WL), legs tucked
#   back along the flank, a big tail wave and a little body roll.
# One-shots start and end on the standing pose; the script prints any part that dips under the ground row.
import json, math, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'lystrosaurus'))
from lystkit import View, rd, sm, unwrap
from PIL import Image

BODY, HEAD, JAW, TAIL = 'n2', 'n6', 'n4', 'n8'
# [leg, foot] of each limb
FAR_FRONT, FAR_BACK, NEAR_FRONT, NEAR_BACK = ('n28', 'n30'), ('n32', 'n34'), ('n16', 'n14'), ('n12', 'n10')
LIMBS = [FAR_FRONT, FAR_BACK, NEAR_FRONT, NEAR_BACK]
FRONT = (FAR_FRONT[0], NEAR_FRONT[0])
WL = 69   # the swim clip's waterline row (rigtogame.py --waterline)

P = json.load(open(sys.argv[1]))
P['nodes'] = [n for n in P['nodes'] if not n.get('hidden')]
used = {n['asset'] for n in P['nodes']}; P['assets'] = {k: v for k, v in P['assets'].items() if k in used}
V = View(P)
W0 = V.worlds({})
L0 = V.lowest({}); GND = {l[0]: max(L0[k] for k in l) for l in LIMBS}   # each limb's standing ground row (bottom edge)
GROUND = max(GND.values())
LEG = {l[0]: GND[l[0]] - W0[l[0]][5] for l in LIMBS}   # hip or shoulder down to the sole

def bottom(p, parts):
  W = V.worlds(p)
  return max(W[k][1]*(x + .5) + W[k][3]*(y + .5) + round(W[k][5]) for k in parts for x, y in V.pix[k]) + .5

def limb(p, lm, a, toe=0.0, lift=0.0, fit=True, dx=0.0):
  """a leg turned `a` degrees in the world about its hip or shoulder (negative swings it forward), the foot flat on the ground plus `toe`;
  with fit the joint gives up or down so the limb's lowest pixel sits `lift` over its ground row"""
  lg, ft = lm; b = p[BODY]['r']
  p[lg] = {'r': rd(a - b), 'dx': rd(dx), 'dy': 0}; p[ft] = {'r': rd(toe - a), 'dx': 0, 'dy': 0}
  if fit:
    for _ in range(3): p[lg]['dy'] = rd(p[lg]['dy'] + GND[lg] - lift - bottom(p, lm))
    while bottom(p, lm) > GND[lg] + .45: p[lg]['dy'] = rd(p[lg]['dy'] - .25)   # the whole-pixel rounding can leave it a row low
  return p

def ang(lg, ox):   # the leg's world turn that puts the foot `ox` px ahead of where it stands
  return -math.degrees(math.asin(max(-.9, min(.9, ox/LEG[lg]))))

def tailr(p, want):   # the tail at `want` degrees, or raised as far as keeps it out of the ground
  p[TAIL] = {'r': rd(want), 'dx': 0, 'dy': 0}
  while V.lowest(p)[TAIL] > GROUND + .05: p[TAIL]['r'] = rd(p[TAIL]['r'] + .5)
  return p

def pose(body=(0, 0, 0), head=0.0, hdy=0.0, jaw=0.0, tail=0.0, feet=None):
  """body: (r, dx, dy); feet: {leg: (ox, lift, toe)} off each foot's standing place"""
  p = {BODY: {'r': rd(body[0]), 'dx': rd(body[1]), 'dy': rd(body[2])}, HEAD: {'r': rd(head), 'dx': 0, 'dy': rd(hdy)}, JAW: {'r': rd(jaw), 'dx': 0, 'dy': 0}}
  for lm in LIMBS:
    ox, lift, toe = (feet or {}).get(lm[0], (0, 0, 0))
    limb(p, lm, ang(lm[0], ox - body[1]), toe, lift)
  return tailr(p, tail)

def check(name, frames):
  for i, f in enumerate(frames):
    bad = [V.by[k]['name'] + ' %.1f' % (v - GROUND) for k, v in V.lowest(f).items() if v > GROUND + .5]
    if name == 'swim': continue   # under water, nothing touches the ground
    if name != 'rest': bad += ['%s joint shifted %.1f' % (V.by[lg]['name'], f[lg]['dy']) for lg, _ in LIMBS if abs(f[lg]['dy']) > 2.5]
    if bad: print(' ', name, 'frame', i, ':', ', '.join(bad))

def walk(N=12, fps=8, ds=.7, S=7.0, lift=1.3, bob=.35, hang=10, roll=10):
  PHASE = {NEAR_BACK[0]: 0, NEAR_FRONT[0]: .25, FAR_BACK[0]: .5, FAR_FRONT[0]: .75}
  out = []
  for i in range(N):
    f = i/N
    p = {BODY: {'r': 0, 'dx': 0, 'dy': rd(bob*math.sin(4*math.pi*f + .6))}, HEAD: {'r': rd(1.2*math.sin(4*math.pi*(f + .2))), 'dx': 0, 'dy': 0}, JAW: {'r': 0, 'dx': 0, 'dy': 0}}
    for lm in LIMBS:
      fl = (f + PHASE[lm[0]]) % 1
      if fl < ds:
        u = fl/ds; ox, up = S/2 - S*u, 0.0
        toe = roll*max(0, (u - .75)/.25)   # the heel peels up at push-off
      else:
        t = (fl - ds)/(1 - ds); s = math.sin(math.pi*t); ox = -S/2 + S*sm(t); up = lift*s
        toe = roll*(1 - t)*(1 - t) + hang*s
      limb(p, lm, ang(lm[0], ox), toe, up)
    out.append(tailr(p, 1.5 + 1.5*math.sin(2*math.pi*(f + .1))))
  print('walk:', N, 'frames; rstep at rsize %.2f:' % RSIZE, round(S/ds/(P['cell']['w']/(2.5*RSIZE))/N, 4))
  return {'name': 'walk', 'fps': fps, 'frames': unwrap(out)}

def stand(N=12, fps=6):
  out = []
  for i in range(N):
    a = 2*math.pi*i/N; br = (1 - math.cos(a))/2
    out.append(pose((0, 0, -.4*br), head=-.8*br + .5*math.sin(a), tail=1 + math.sin(a + 1)))
  return {'name': 'stand', 'fps': fps, 'frames': unwrap(out)}

def gape(fps=8):
  # lifts its snout, opens the long jaws wide, holds, snaps them shut, flicks the tail
  def g(h, j, tl=0.0): return pose(head=h, jaw=j, tail=tl)
  keys = [g(0, 0), g(-2, 3), g(-4, 10), g(-6, 20), g(-7, 28), g(-7, 30), g(-7, 30, 1), g(-6, 29, 2), g(-2, 0, 5), g(0, -1, 7), g(1, 0, 5),
          g(0, 0, 2), g(0, 0)]
  return {'name': 'idle', 'fps': fps, 'frames': unwrap(keys)}

def snap(fps=10):
  # lunges forward, snout down, snaps twice (a fish, two tries), then settles back; the feet stay planted
  def g(x, h, j, tl=0.0, br=0.0):
    return pose((br, x, 0), head=h, jaw=j, tail=tl, feet={l[0]: (0, 0, 0) for l in LIMBS})
  keys = [g(0, 0, 0), g(-1, -2, 4), g(-1.5, -4, 14), g(2, 3, 20), g(3, 6, 0, 2), g(3, 5, 0, 3), g(2.5, 2, 12, 2), g(3, 6, 16), g(3.5, 7, 0, 3),
          g(3, 6, 0, 4), g(2, 4, 2, 3), g(1, 2, 0, 2), g(0, 0, 0, 1), g(0, 0, 0)]
  return {'name': 'dynamic idle', 'fps': fps, 'frames': unwrap(keys)}

def rest(N=14, fps=6, front=-70, back=60):
  # sinks onto its belly (the body down to the ground row), forelegs splayed forward and hind legs back, each limb's joint sliding up into
  # the flank so the foot stays down; lays the tail down, then lays its head down a little, jaw shut
  drop = rd(GROUND - V.lowest({})[BODY] - .1)
  out = []
  for i in range(N):
    t = i/(N - 1)
    down = sm(min(1, t/.6)); hd = sm(max(0, (t - .5)/.4)); br = .25*math.sin(math.pi*max(0, (t - .85)/.15))
    p = {BODY: {'r': 0, 'dx': 0, 'dy': rd(drop*down - br)}, HEAD: {'r': 0, 'dx': 0, 'dy': 0}, JAW: {'r': 0, 'dx': 0, 'dy': 0}}
    for lm in LIMBS:
      limb(p, lm, (front if lm[0] in FRONT else back)*down)
      p[lm[0]]['dy'] = rd(min(0, p[lm[0]]['dy']))   # a joint only slides up into the body
    # the head laid down a little: a small tilt and at most a pixel down at the neck, since the head and body pictures overlap only a few
    # pixels there and a bigger drop opens a step between them (the chin stays just off the ground)
    p[HEAD] = {'r': rd(3*hd), 'dx': 0, 'dy': rd(1*hd)}
    out.append(tailr(p, 0))
  out[0] = pose()
  return {'name': 'rest', 'fps': fps, 'frames': unwrap(out)}

def swim(N=8, fps=6, dy=2, tuck=72, tail=6):
  out = []
  for i in range(N):
    f = i/N
    p = {BODY: {'r': rd(.6*math.sin(2*math.pi*f)), 'dx': 0, 'dy': rd(dy + .4*math.sin(4*math.pi*f + 1))},
         HEAD: {'r': rd(-2 + 1.2*math.sin(2*math.pi*(f + .3))), 'dx': 0, 'dy': 0}, JAW: {'r': 0, 'dx': 0, 'dy': 0},
         TAIL: {'r': rd(tail*math.sin(2*math.pi*f) - 3), 'dx': 0, 'dy': 0}}   # mostly down, so it stays under the surface
    for lm in LIMBS:
      a = tuck - (6 if lm[0] in FRONT else 0) + 6*math.sin(2*math.pi*(f + (.5 if lm[0] in FRONT else 0)))   # a slow paddle
      limb(p, lm, a, -a, fit=False)
    out.append(p)
  return {'name': 'swim', 'fps': fps, 'frames': unwrap(out)}

CROP = (8, 52, 92, 76)
def frame(f, bg, wl=None):
  im = Image.new('RGBA', (P['cell']['w'], P['cell']['h'] + 1), bg); r = V.render(f)
  if wl is not None:   # under the waterline the game draws a faint ghost
    lo = r.crop((0, wl, r.width, r.height)); a = lo.getchannel('A').point(lambda v: v*.3); lo.putalpha(a); r.paste(lo, (0, wl))
  im.alpha_composite(r)
  if wl is not None:
    for x in range(20, 98): im.putpixel((x, wl), (156, 203, 232, 255))
  return im.crop(CROP)

def sheet(frames, path, cols=6, k=5, bg=(214, 228, 240, 255), wl=None):
  rows = (len(frames) + cols - 1)//cols; w, h = CROP[2] - CROP[0], CROP[3] - CROP[1]; S = Image.new('RGBA', (cols*w*k, rows*h*k), bg)
  for i, f in enumerate(frames): S.paste(frame(f, bg, wl).resize((w*k, h*k), Image.NEAREST), ((i % cols)*w*k, (i//cols)*h*k))
  S.convert('RGB').save(path)

def gif(frames, path, fps, k=6, bg=(214, 228, 240, 255), wl=None):
  w, h = CROP[2] - CROP[0], CROP[3] - CROP[1]
  ims = [frame(f, bg, wl).resize((w*k, h*k), Image.NEAREST).convert('RGB').convert('P', palette=Image.ADAPTIVE) for f in frames]
  ims[0].save(path, save_all=True, append_images=ims[1:], duration=int(1000/fps), loop=0, disposal=2)

RSIZE = 1.25
clips = [walk(), stand(), gape(), snap(), rest(), swim()]
for c in clips: check(c['name'], c['frames'])
P['clips'] = clips
json.dump(P, open(sys.argv[2], 'w'), separators=(',', ':'))
out = os.environ.get('SHEETS')
if out:
  for c in clips:
    s = c['name'].replace(' ', '-'); wl = WL if c['name'] == 'swim' else None
    sheet(c['frames'], os.path.join(out, s + '-sheet.png'), wl=wl); gif(c['frames'], os.path.join(out, s + '.gif'), c['fps'], wl=wl)
