# Writes every Platyhystrix clip from the hand-made rig (platyhystrix-rig.json: parts drawn and shaded in the pixel editor, every limb hanging off the
# body like the Dimetrodon's, one hind limb only) into platyhystrix-clips.json, which is what gets exported. The parts are left alone.
#   python3 -I tools/rigger/platyhystrix/gen-clips.py IN.json OUT.json      (SHEETS=<dir> also writes contact sheets and GIFs)
# A vivarium animal doesn't walk, so there is no walk clip.
# stand: a slow breathing loop, the sail rising and falling with it. idle: lifts its head and gapes, then snaps shut. dynamic idle: tips forward on bent
#   front legs to nose the ground twice, looks up and gulps. rest: lies on its belly with the legs stretched flat along it, tail and chin down, a yawn,
#   then breathes slowly (the game holds the last frame).
# Also draws sprites/plhy.png and the sprites/plhy-idle.png strip (the fallback when rigs are off) and prints their SPRITES numbers.
# One-shots start and end on the standing pose; the script prints any part that dips under the ground row.
import json, math, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'lystrosaurus'))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from lystkit import View, rd, sm, unwrap
from rigdraw import Draw
from PIL import Image

BODY, HEAD, JAW, TAIL = 'n255', 'n259', 'n257', 'n261'
# [thigh or upper arm, leg or forearm, foot] of each limb
FAR_FRONT, NEAR_FRONT, NEAR_BACK = ('n276', 'n278', 'n280'), ('n263', 'n265', 'n267'), ('n269', 'n271', 'n273')
LIMBS = [FAR_FRONT, NEAR_FRONT, NEAR_BACK]
FRONT = (FAR_FRONT[0], NEAR_FRONT[0])

P = json.load(open(sys.argv[1])); V = View(P); D = Draw(P)
for n in P['nodes']:                         # the far upper arm is the near one mirrored about its joint (rigdraw draws flips; View doesn't)
  if n.get('flip'): V.pix[n['id']] = [(-x, y) for x, y in V.pix[n['id']]]
GROUND = max(V.lowest({}).values())          # the bottom edge of the lowest row the standing feet cover

def bottom(p, parts):
  W = V.worlds(p)
  return max(W[k][1]*(x + .5) + W[k][3]*(y + .5) + W[k][5] for k in parts for x, y in V.pix[k]) + .5

def stiff(p, limb, a, fore, toe, lift=0.0, fit=True):
  """a limb turned as one piece about its shoulder or hip (upper `a`, lower `fore`, foot `toe`, all in the world); with fit the joint gives a little
  up or down so the limb's lowest pixel sits `lift` over the ground"""
  th, lg, ft = limb; b = p[BODY]['r']
  p[th] = {'r': rd(a - b), 'dx': 0, 'dy': 0}; p[lg] = {'r': rd(fore - a), 'dx': 0, 'dy': 0}; p[ft] = {'r': rd(toe - fore), 'dx': 0, 'dy': 0}
  if fit:
    for _ in range(2): p[th]['dy'] = rd(p[th]['dy'] + GROUND - lift - bottom(p, limb))
  return p

def pose(body=(0, 0, 0), head=0.0, hdy=0.0, jaw=0.0, tail=0.0, kneel=0.0):
  """body: (r, dx, dy); kneel bends the front legs"""
  p = {BODY: {'r': rd(body[0]), 'dx': rd(body[1]), 'dy': rd(body[2])}, HEAD: {'r': rd(head), 'dx': 0, 'dy': rd(hdy)}, JAW: {'r': rd(jaw), 'dx': 0, 'dy': 0}, TAIL: {'r': rd(tail), 'dx': 0, 'dy': 0}}
  for limb in LIMBS:
    a = 25*kneel if limb[0] in FRONT else 0
    stiff(p, limb, a, a - (40*kneel if limb[0] in FRONT else 0), a)
  return p

def check(name, frames):
  for i, f in enumerate(frames):
    bad = [V.by[k]['name'] + ' %.1f' % (v - GROUND) for k, v in V.lowest(f).items() if v > GROUND + .5]
    bad += ['%s joint shifted %.1f' % (V.by[th]['name'], f[th]['dy']) for th, _, _ in LIMBS if abs(f[th]['dy']) > 3]
    if bad: print(' ', name, 'frame', i, ':', ', '.join(bad))

def stand(N=12, fps=6):
  out = []
  for i in range(N):
    a = 2*math.pi*i/N; br = (1 - math.cos(a))/2
    out.append(pose((-.5*br, 0, -.5*br), head=-1*br + .6*math.sin(a), tail=2*math.sin(a + 1)))
  return {'name': 'stand', 'fps': fps, 'frames': unwrap(out)}

def gape(fps=8):
  # (head lift, jaw, tail): lifts the head, gapes wide and holds it, snaps shut, settles
  keys = [(0, 0, 0), (-2, 2, 1), (-5, 10, 2), (-7, 22, 3), (-8, 30, 3), (-8, 32, 4), (-8, 30, 3), (-8, 32, 3), (-7, 26, 2), (-6, 0, 2), (-4, 0, 1),
          (-3, 5, 0), (-2, 0, 0), (-1, 0, 0), (0, 0, 0)]
  return {'name': 'idle', 'fps': fps, 'frames': unwrap([pose(head=h, jaw=j, tail=t) for h, j, t in keys])}

def sniff(fps=8, K=dict(pitch=4, sink=.5, head=18, hdy=1.5)):
  # tips forward, nose to the ground twice, looks up and gulps
  def g(e, h, j=0.0, tl=0.0):
    return pose((K['pitch']*e, .3*e, K['sink']*e), head=K['head']*e + h, hdy=K['hdy']*e, jaw=j, tail=tl - 3*e, kneel=e)
  keys = [g(0, 0), g(.3, 0), g(.7, 0), g(1, 0), g(1, 3), g(1, 1), g(1, 4), g(1, 0, 0, 1), g(1, -4, 0, 2), g(1, -2), g(1, 3, 3), g(1, 1),
          g(.6, -4, 0, 1), g(.2, -8, 0, 2), g(0, -9, 5), g(0, -9, 16), g(0, -8, 0), g(0, -5, 0, 1), g(0, -2), g(0, 0)]
  return {'name': 'dynamic idle', 'fps': fps, 'frames': unwrap(keys)}

def rest(fps=6, lie=7, fold={'front': (-70, -90), 'back': (80, 80)}):
  # belly on the ground (the drop is measured from the body's own pixels); the legs stretch out flat along it, front feet forward and hind feet back
  drop = GROUND - V.lowest({})[BODY] - .5
  def r(e, h, hdy=0.0, j=0.0, br=0.0):
    e = sm(e); p = pose((-.5*e, 0, drop*e - br), head=h, hdy=hdy, jaw=j, tail=3*e)
    for limb in LIMBS:
      a, fo = fold['front' if limb[0] in FRONT else 'back']
      stiff(p, limb, a*e, fo*e, 0, fit=limb != FAR_FRONT)
    p[FAR_FRONT[0]]['dy'] = p[NEAR_FRONT[0]]['dy']   # the far arm's picture is mirrored, so it folds with the near one rather than fitting its own pixels
    return p
  keys = [r(i/(lie - 1), 3*sm(i/(lie - 1))) for i in range(lie)]
  # (head turn, head drop, jaw, breath): a look round, a yawn, then its chin sinks and it breathes slowly
  for h, hdy, j, br in [(3, 0, 0, 0), (-2, 0, 0, .2), (-4, 0, 0, 0), (0, 0, 0, .2), (3, 0, 8, 0), (-1, 0, 22, .3), (1, 0, 10, .2), (3, 0, 0, 0),
                        (5, .3, 0, .2), (7, .6, 0, 0), (8, .8, 0, .3), (8, .8, 0, 0), (8, .8, 0, .3), (8, .8, 0, 0)]:
    keys.append(r(1, h, hdy, j, br))
  print('rest: belly drops %.1f px' % drop)
  return {'name': 'rest', 'fps': fps, 'frames': unwrap(keys)}

def sheet(frames, path, cols=6, k=4, crop=(12, 38, 90, 75), bg=(214, 228, 240, 255)):
  rows = (len(frames) + cols - 1)//cols; w, h = crop[2] - crop[0], crop[3] - crop[1]; S = Image.new('RGBA', (cols*w*k, rows*h*k), bg)
  for i, f in enumerate(frames):
    im = Image.new('RGBA', (P['cell']['w'], P['cell']['h']), bg); im.alpha_composite(D.pose(f))
    S.paste(im.crop(crop).resize((w*k, h*k), Image.NEAREST), ((i % cols)*w*k, (i//cols)*h*k))
  S.convert('RGB').save(path)

def gif(frames, path, fps, k=5, crop=(12, 38, 90, 75), bg=(214, 228, 240)):
  ims = []
  for f in frames:
    im = Image.new('RGBA', (P['cell']['w'], P['cell']['h']), bg + (255,)); im.alpha_composite(D.pose(f))
    ims.append(im.crop(crop).resize(((crop[2] - crop[0])*k, (crop[3] - crop[1])*k), Image.NEAREST).convert('P', palette=Image.ADAPTIVE))
  ims[0].save(path, save_all=True, append_images=ims[1:], duration=int(1000/fps), loop=0, disposal=2)

clips = [stand(), gape(), sniff(), rest()]
for c in clips: check(c['name'], c['frames'])
P['clips'] = clips
json.dump(P, open(sys.argv[2], 'w'), separators=(',', ':'))
# the strips for when rigs are off: plhy.png is stand frame 0, plhy-idle.png the stand loop, then the idle and the dynamic idle
SPR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', 'sprites')
D.pose(clips[0]['frames'][0]).save(os.path.join(SPR, 'plhy.png'))
strip = [f for c in clips[:3] for f in c['frames']]; S = Image.new('RGBA', (P['cell']['w']*len(strip), P['cell']['h']))
for i, f in enumerate(strip): S.alpha_composite(D.pose(f), (i*P['cell']['w'], 0))
S.save(os.path.join(SPR, 'plhy-idle.png'))
n0, n1, n2 = (len(c['frames']) for c in clips[:3])
print('SPRITES.plhy: idle:%d, ms:%d, base:%d, dyn:[[%d,%d],[%d,%d]], dynMs:%d' % (len(strip), 1000/clips[0]['fps'], n0, n0, n1, n0 + n1, n2, 1000/clips[1]['fps']))
out = os.environ.get('SHEETS')
if out:
  for c in clips:
    s = c['name'].replace(' ', '-'); sheet(c['frames'], os.path.join(out, s + '-sheet.png')); gif(c['frames'], os.path.join(out, s + '.gif'), c['fps'])
