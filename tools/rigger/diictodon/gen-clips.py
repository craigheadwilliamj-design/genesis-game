# Writes every Diictodon clip from the hand-made rig (diictodon-rig.json: parts drawn and shaded in the pixel editor, laid out like the Inostrancevia's,
# every limb hanging off the body) into diictodon.json, which is what gets exported. The parts are left alone. The posing is the Inostrancevia's, scaled down.
#   python3 -I tools/rigger/diictodon/gen-clips.py IN.json OUT.json      (SHEETS=<dir> also writes contact sheets and GIFs)
# walk: a quick lateral-sequence scurry (near hind, near front, far hind, far front, a quarter cycle apart): feet planted and sliding back at body
#   speed, heel rolling up at push-off, then lifted with the knee or elbow bending; the body sways and rocks, the head bobs.
# stand: breathing. idle: tips forward and scrapes at the ground with its forefeet, digging, then shakes its head. dynamic idle: noses the ground twice,
#   crops with the beak and chews, looks up. rest: sinks onto its belly with the legs folded out of sight, a look round, a yawn, chin down
#   (the game holds the last frame).
# Near and far limbs each keep their own standing ground row (the far feet sit a pixel higher). One-shots start and end on the standing pose; the
# script prints any part that dips under the ground row.
import json, math, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'lystrosaurus'))
from lystkit import View, rd, sm, unwrap
from PIL import Image

BODY, HEAD, JAW, TAIL = 'n4', 'n8', 'n6', 'n2'
# [thigh or upper arm, leg or forearm, foot] of each limb
FAR_FRONT, FAR_BACK, NEAR_FRONT, NEAR_BACK = ('n39', 'n35', 'n37'), ('n41', 'n43', 'n45'), ('n14', 'n12', 'n10'), ('n18', 'n20', 'n22')
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
    bad += ['%s joint shifted %.1f' % (V.by[th]['name'], f[th]['dy']) for th, _, _ in LIMBS if abs(f[th]['dy']) > 3]
    if bad: print(' ', name, 'frame', i, ':', ', '.join(bad))

def walk(N=12, fps=10, ds=.6, S=6.0, SF=5.0, lift=1.8, liftF=1.6, crouch=.3, bob=.4, pitch=.8, knee=40, elbow=22, hang=22, hangF=-14, roll=16, give=4):
  # each limb swings about its hip or shoulder, with its knee bending in the swing (`knee` degrees at the top of the step; a forearm swings `elbow` out ahead,
  # which keeps its big forefoot off the ground) and the toes hanging (`hang`; `hangF` tips the forefoot's toes up instead), the heel rolling up at push-off (`roll`) and the joint
  # giving a little mid-stance (`give`) as it takes the weight; the bends are capped by hand and the joint fits the foot to the ground
  PHASE = {NEAR_BACK[0]: 0, NEAR_FRONT[0]: .25, FAR_BACK[0]: .5, FAR_FRONT[0]: .75}
  out = []
  for i in range(N):
    f = i/N
    rb = pitch*math.sin(4*math.pi*(f + .125))
    p = pose((rb, 0, crouch + bob*math.sin(4*math.pi*f + .6)), head=-.6*rb + 2*math.sin(4*math.pi*(f + .2)), tail=-1.2*rb + 6*math.sin(2*math.pi*(f + .1)))
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

def dig(fps=10, pitch=6, sink=.5, head=16, hdy=1.5):
  # tips forward on bent front legs, scrapes the ground back under it with the near forefoot twice and the far one once, rises and shakes its head
  def g(e, nf=(0, 0, 0), ff=(0, 0, 0), h=0.0, j=0.0):   # e: how far down it has tipped; nf, ff: (ox, lift, toe) of the near and far forefoot
    return pose((pitch*e, .4*e, sink*e), head=head*e + h, hdy=hdy*e, jaw=j, tail=4*e, kneel=.6*e, feet={NEAR_FRONT[0]: nf, FAR_FRONT[0]: ff})
  reach, mid, back = (4, 1.5, -30), (1, .8, 0), (-4, 0, 30)
  keys = [g(0), g(.4), g(.8), g(1), g(1, reach), g(1, mid), g(1, back, h=1), g(1), g(1, reach), g(1, mid), g(1, back, h=1), g(1),
          g(1, ff=reach), g(1, ff=mid), g(1, ff=back, h=1), g(1), g(.6, h=-2), g(.2, h=-4), g(0, h=-3), g(0, h=3), g(0, h=-3), g(0, h=2), g(0)]
  return {'name': 'idle', 'fps': fps, 'frames': unwrap(keys)}

def sniff(fps=8, K=dict(pitch=5, sink=.5, head=24, hdy=2)):
  # tips forward on bent front legs, noses the ground twice, crops with the beak and chews, looks up
  def g(e, h, j=0.0, tl=0.0):   # e: how far down it has tipped; h: the head's turn past the tip
    return pose((K['pitch']*e, .4*e, K['sink']*e), head=K['head']*e + h, hdy=K['hdy']*e, jaw=j, tail=tl - 3*e, kneel=e)
  keys = [g(0, 0), g(.3, 0), g(.7, 0), g(1, 0), g(1, 3), g(1, 1), g(1, 4), g(1, 0, 0, 1), g(1, -4, 0, 2), g(1, -2), g(1, 3, 3), g(1, 1),
          g(.6, -4, 0, 1), g(.2, -6, 6, 2), g(0, -6, 0), g(0, -6, 6), g(0, -5, 0), g(0, -4, 5, 1), g(0, -3), g(0, 0)]
  return {'name': 'dynamic idle', 'fps': fps, 'frames': unwrap(keys)}

def rest(fps=5, lie=7, drop=6.5, fold={FAR_FRONT[0]: (30, 100), NEAR_FRONT[0]: (35, 110), FAR_BACK[0]: (-10, 80), NEAR_BACK[0]: (-65, -70)}):
  # sinks onto its belly with the legs folded under it, out of sight (each limb's fold found by a search for the one that hides the most of it
  # behind the body while its joint stays put); a joint fits its foot to the ground on the way down and is back in place once the legs are folded)
  def r(e, h, hdy=0.0, j=0.0, br=0.0):
    e = sm(e); p = pose((-.5*e, 0, drop*e - br), head=h, hdy=hdy, jaw=j, tail=4*e)
    for limb in LIMBS:
      a, fo = fold[limb[0]]
      stiff(p, limb, a*e, fo*e, 0); p[limb[0]]['dy'] = rd(p[limb[0]]['dy']*(1 - e))
    return p
  keys = [r(i/(lie - 1), 3*sm(i/(lie - 1))) for i in range(lie)]
  # (head turn, head drop, jaw, breath): a look round, a wide yawn, then its chin sinks and it breathes slowly
  for h, hdy, j, br in [(3, 0, 0, 0), (-2, 0, 0, .2), (-4, 0, 0, 0), (0, 0, 0, .2), (-2, 0, 10, 0), (-5, 0, 24, .3), (-3, 0, 10, .2), (3, 0, 0, 0),
                        (6, .3, 0, .2), (9, .6, 0, 0), (11, .9, 0, .3), (11, .9, 0, 0), (11, .9, 0, .3), (11, .9, 0, 0)]:
    keys.append(r(1, h, hdy, j, br))
  return {'name': 'rest', 'fps': fps, 'frames': unwrap(keys)}

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

RSIZE = 1
clips = [walk(), stand(), dig(), sniff(), rest()]
for c in clips: check(c['name'], c['frames'])
P['clips'] = clips
json.dump(P, open(sys.argv[2], 'w'), separators=(',', ':'))
out = os.environ.get('SHEETS')
if out:
  for c in clips:
    s = c['name'].replace(' ', '-'); sheet(c['frames'], os.path.join(out, s + '-sheet.png')); gif(c['frames'], os.path.join(out, s + '.gif'), c['fps'])
