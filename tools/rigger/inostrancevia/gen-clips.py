# Writes every Inostrancevia clip from the hand-made rig (inostrancevia-rig.json: parts drawn and shaded in the pixel editor, every limb hanging off the body,
# the same layout as the Dimetrodon's) into inostrancevia.json, which is what gets exported. The parts are left alone.
#   python3 -I tools/rigger/inostrancevia/gen-clips.py IN.json OUT.json      (SHEETS=<dir> also writes contact sheets and GIFs)
# walk: a heavy lateral-sequence plod (near hind, near front, far hind, far front, a quarter cycle apart): feet planted and sliding back at body
#   speed, heel rolling up at push-off, then lifted with the knee or elbow bending and the toes hanging; the body sways and rocks, the head nods.
# stand: breathing. idle: rears its head and gapes wide to bare the sabers, snaps shut. dynamic idle: tips forward to sniff the ground twice, looks
#   up and snaps. rest: lies down like a cat: sits back on its folded hind legs, walks its forepaws out and lowers its chest, yawns, settles its
#   head (the game holds the last frame).
# Near and far limbs each keep their own standing ground row (the far feet sit a pixel higher). One-shots start and end on the standing pose; the
# script prints any part that dips under the ground row.
import json, math, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'lystrosaurus'))
from lystkit import View, rd, sm, unwrap
from PIL import Image

BODY, HEAD, JAW, TAIL = 'n6', 'n22', 'n4', 'n20'
# [thigh or upper arm, leg or forearm, foot] of each limb
FAR_FRONT, FAR_BACK, NEAR_FRONT, NEAR_BACK = ('n45', 'n41', 'n43'), ('n35', 'n37', 'n39'), ('n18', 'n16', 'n14'), ('n8', 'n10', 'n12')
LIMBS = [FAR_FRONT, FAR_BACK, NEAR_FRONT, NEAR_BACK]
FRONT = (FAR_FRONT[0], NEAR_FRONT[0])

P = json.load(open(sys.argv[1])); V = View(P)
W0 = V.worlds({}); ANK = {l[0]: (W0[l[2]][4], W0[l[2]][5]) for l in LIMBS}
ARM = {l[0]: math.hypot(ANK[l[0]][0] - W0[l[0]][4], ANK[l[0]][1] - W0[l[0]][5]) for l in LIMBS}   # shoulder or hip to ankle, standing
L0 = V.lowest({}); GND = {l[0]: max(L0[k] for k in l) for l in LIMBS}   # each limb's standing ground row (bottom edge)
GROUND = max(GND.values())

def bottom(p, parts):
  W = V.worlds(p)
  return max(W[k][1]*(x + .5) + W[k][3]*(y + .5) + W[k][5] for k in parts for x, y in V.pix[k]) + .5

def stiff(p, limb, a, fore, toe, lift=0.0, fit=True):
  """a limb turned as one piece about its shoulder or hip (upper `a`, lower `fore`, foot `toe`, all in the world); with fit the joint gives a little
  up or down so the limb's lowest pixel sits `lift` over its ground row"""
  th, lg, ft = limb; b = p[BODY]['r']
  p[th] = {'r': rd(a - b), 'dx': 0, 'dy': 0}; p[lg] = {'r': rd(fore - a), 'dx': 0, 'dy': 0}; p[ft] = {'r': rd(toe - fore), 'dx': 0, 'dy': 0}
  if fit:
    for _ in range(2): p[th]['dy'] = rd(p[th]['dy'] + GND[th] - lift - bottom(p, limb))
  return p

def pose(body=(0, 0, 0), head=0.0, hdy=0.0, jaw=0.0, tail=0.0, feet=None, kneel=0.0):
  """body: (r, dx, dy); feet: {thigh: (ox, lift, foot_r)} off each ankle's standing place; kneel bends the front legs"""
  p = {BODY: {'r': rd(body[0]), 'dx': rd(body[1]), 'dy': rd(body[2])}, HEAD: {'r': rd(head), 'dx': 0, 'dy': rd(hdy)}, JAW: {'r': rd(jaw), 'dx': 0, 'dy': 0}, TAIL: {'r': rd(tail), 'dx': 0, 'dy': 0}}
  for th, lg, ft in LIMBS:
    ox, lift, fr = (feet or {}).get(th, (0, 0, 0))
    a = -math.degrees(math.asin(max(-.9, min(.9, ox/ARM[th])))) + (20*kneel if th in FRONT else 0)
    stiff(p, (th, lg, ft), a, a - (3*lift + 34*kneel if th in FRONT else -4*lift), fr + a*min(1, lift), lift)
  return p

def check(name, frames):
  for i, f in enumerate(frames):
    bad = [V.by[k]['name'] + ' %.1f' % (v - GROUND) for k, v in V.lowest(f).items() if v > GROUND + .5]
    if name != 'rest': bad += ['%s joint shifted %.1f' % (V.by[th]['name'], f[th]['dy']) for th, _, _ in LIMBS if abs(f[th]['dy']) > 3]   # lying, the joints slide up into the flank
    if bad: print(' ', name, 'frame', i, ':', ', '.join(bad))

def walk(N=12, fps=8, ds=.6, S=9.0, SF=8.0, lift=2.4, liftF=2.4, crouch=.4, bob=.5, pitch=.7, knee=40, elbow=22, hang=22, hangF=-14, roll=16, give=4):
  # each limb swings about its hip or shoulder, with its knee bending in the swing (`knee` degrees at the top of the step; a forearm swings `elbow` out ahead,
  # which keeps its big forefoot off the ground) and the toes hanging (`hang`; `hangF` tips the forefoot's toes up instead), the heel rolling up at push-off (`roll`) and the joint
  # giving a little mid-stance (`give`) as it takes the weight; the bends are capped by hand and the joint fits the foot to the ground
  PHASE = {NEAR_BACK[0]: 0, NEAR_FRONT[0]: .25, FAR_BACK[0]: .5, FAR_FRONT[0]: .75}
  out = []
  for i in range(N):
    f = i/N
    rb = pitch*math.sin(4*math.pi*(f + .125))
    p = pose((rb, 0, crouch + bob*math.sin(4*math.pi*f + .6)), head=-.6*rb + 1.5*math.sin(4*math.pi*(f + .2)), tail=-1.2*rb + 4*math.sin(2*math.pi*(f + .1)))
    for th, lg, ft in LIMBS:
      fl, fr = (f + PHASE[th]) % 1, th in FRONT
      st, d = (SF, ds*SF/S) if fr else (S, ds)   # a front foot takes a shorter step, planted for less of the cycle so it still slides at body speed
      if fl < d:
        u = fl/d; ox, up, bend = st/2 - st*u, 0.0, give*math.sin(math.pi*u)
        toe = roll*max(0, (u - .7)/.3)   # the heel peels up, the toes stay down
      else:
        t = (fl - d)/(1 - d); s = math.sin(math.pi*t); ox = -st/2 + st*sm(t); up = (liftF if fr else lift)*s
        bend = -elbow*math.sin(math.pi*t) if fr else knee*math.sin(math.pi*min(1, t*1.2))   # the forearm swings out ahead
        toe = roll*(1 - t)*(1 - t) + (hangF if fr else hang)*s*(1 - .4*t)
      ang = -math.degrees(math.asin(max(-.9, min(.9, ox/ARM[th]))))
      stiff(p, (th, lg, ft), ang - .3*bend, ang + .7*bend, ang + .7*bend + toe, up)
    out.append(p)
  print('walk:', N, 'frames; rstep at rsize %.1f:' % RSIZE, round(S/ds/(P['cell']['w']/(2.5*RSIZE))/N, 4))
  return {'name': 'walk', 'fps': fps, 'frames': unwrap(out)}

def stand(N=12, fps=6):
  out = []
  for i in range(N):
    a = 2*math.pi*i/N; br = (1 - math.cos(a))/2
    out.append(pose((-.4*br, 0, -.4*br), head=-1*br + .6*math.sin(a), tail=2*math.sin(a + 1)))
  return {'name': 'stand', 'fps': fps, 'frames': unwrap(out)}

def gape(fps=8):
  # (head lift, jaw, body rock): rears its head and drops the jaw wide to bare the sabers, holds the threat, snaps shut and settles
  keys = [(0, 0, 0), (-3, 2, -.3), (-6, 10, -.6), (-9, 26, -.9), (-11, 36, -1), (-11, 40, -1), (-10, 38, -1), (-11, 40, -1), (-11, 38, -.9), (-9, 30, -.7),
          (-7, 0, -.4), (-4, 0, 0), (-5, 8, 0), (-3, 0, 0), (-1, 0, 0), (0, 0, 0)]
  return {'name': 'idle', 'fps': fps, 'frames': unwrap([pose((r, 0, 0), head=h, jaw=j, tail=.3*h) for h, j, r in keys])}

def sniff(fps=8, K=dict(pitch=5, sink=.6, head=22, hdy=2)):
  # tips forward on bent front legs, noses the ground twice, looks up and snaps
  def g(e, h, j=0.0, tl=0.0):   # e: how far down it has tipped; h: the head's turn past the tip
    return pose((K['pitch']*e, .4*e, K['sink']*e), head=K['head']*e + h, hdy=K['hdy']*e, jaw=j, tail=tl - 3*e, kneel=e)
  keys = [g(0, 0), g(.3, 0), g(.7, 0), g(1, 0), g(1, 3), g(1, 1), g(1, 4), g(1, 0, 0, 1), g(1, -4, 0, 2), g(1, -2), g(1, 3, 3), g(1, 1),
          g(.6, -4, 0, 1), g(.2, -8, 0, 2), g(0, -10, 8), g(0, -10, 30), g(0, -9, 0), g(0, -6, 0, 1), g(0, -3), g(0, 0)]
  return {'name': 'dynamic idle', 'fps': fps, 'frames': unwrap(keys)}

def rest(N=22, fps=5, F=(-45, -90, 0), B=(-65, 110, 0), sit=(-18, 3), lie=.6, tmax=6, head=(-4, 2), yawn=30):
  # lies down like a cat: lowers its hindquarters first, the thighs swinging forward into a haunch with the shanks folded back under them
  # (hind feet flat under the haunch, `B`), then walks its forepaws out and lowers the chest till the belly is on the ground, forearms flat
  # out ahead under the throat (`F`; each limb's (upper, lower, foot) world angles), a yawn that bares the sabers, then its head settles
  # (the game holds the last frame). `sit` is the body's (turn, drop) with only the rear down, the hips already at their lying height.
  # The hips lead and the hind legs follow: each folds only as far as keeps its foot on the ground, so it never folds up in the air.
  # A forepaw that can't reach the ground yet lifts (its joint never slides down out of the body), so the forepaws step out.
  drop = rd(GROUND - V.lowest({})[BODY] - .1)   # the belly down to the ground row
  def tailr(p, want):   # the tail turned `want`, or raised till it's out of the ground
    for r in range(int(10*want), 401):
      p[TAIL]['r'] = rd(r/10)
      if V.lowest(p)[TAIL] <= GROUND + .05: return
  lag = {NEAR_FRONT[0]: 0, FAR_FRONT[0]: .07}   # the far forepaw a step behind the near one
  out = []
  for i in range(N):
    t = i/(N - 1)
    hind = sm(max(0, min(1, t/.32)))                    # the rear goes down
    front = sm(max(0, min(1, (t - .26)/.36)))           # then the chest
    yw = math.sin(math.pi*max(0, min(1, (t - .66)/.2)))  # a yawn
    hd = sm(max(0, min(1, (t - .84)/.16)))               # the head settles
    r = sit[0]*hind*(1 - front) + lie*front
    dy = sit[1]*hind*(1 - front) + drop*front
    p = pose((r, 0, dy), head=-r + head[0]*front*(1 - hd) + head[1]*hd - 6*yw, jaw=yawn*yw)
    tailr(p, -tmax*front)
    for limb in LIMBS:
      if limb[0] in FRONT:
        e = sm(max(0, min(1, (t - .26)/.36 - lag[limb[0]]*3)))
      else:   # the least fold that keeps the foot on (not in) the ground
        lo, hi = 0.0, 1.0
        for _ in range(20):
          e = (lo + hi)/2; stiff(p, limb, B[0]*e, B[1]*e, B[2]*e, fit=False)
          if bottom(p, limb) > GND[limb[0]]: lo = e
          else: hi = e
        e = hi
      stiff(p, limb, *[a*e for a in (F if limb[0] in FRONT else B)])
      if p[limb[0]]['dy'] > .4: p[limb[0]]['dy'] = .4   # never out of the body: lift the foot instead
    out.append(p)
  out[0] = pose()
  return {'name': 'rest', 'fps': fps, 'frames': unwrap(out)}

CROP = (10, 36, 90, 75)
def sheet(frames, path, cols=6, k=4, bg=(214, 228, 240, 255)):
  rows = (len(frames) + cols - 1)//cols; w, h = CROP[2] - CROP[0], CROP[3] - CROP[1]; S = Image.new('RGBA', (cols*w*k, rows*h*k), bg)
  for i, f in enumerate(frames):
    im = Image.new('RGBA', (P['cell']['w'], P['cell']['h']), bg); im.alpha_composite(V.render(f))
    S.paste(im.crop(CROP).resize((w*k, h*k), Image.NEAREST), ((i % cols)*w*k, (i//cols)*h*k))
  S.convert('RGB').save(path)

def gif(frames, path, fps, k=5, bg=(214, 228, 240)):
  ims = []
  for f in frames:
    im = Image.new('RGBA', (P['cell']['w'], P['cell']['h']), bg + (255,)); im.alpha_composite(V.render(f))
    ims.append(im.crop(CROP).resize(((CROP[2] - CROP[0])*k, (CROP[3] - CROP[1])*k), Image.NEAREST).convert('P', palette=Image.ADAPTIVE))
  ims[0].save(path, save_all=True, append_images=ims[1:], duration=int(1000/fps), loop=0, disposal=2)

RSIZE = 1.5
clips = [walk(), stand(), gape(), sniff(), rest()]
for c in clips: check(c['name'], c['frames'])
P['clips'] = clips
json.dump(P, open(sys.argv[2], 'w'), separators=(',', ':'))
out = os.environ.get('SHEETS')
if out:
  for c in clips:
    s = c['name'].replace(' ', '-'); sheet(c['frames'], os.path.join(out, s + '-sheet.png')); gif(c['frames'], os.path.join(out, s + '.gif'), c['fps'])
