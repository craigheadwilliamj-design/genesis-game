# Writes the Chalicotherium walk and rest clips into a rigger project (parts and the idle clips are left alone).
#   python3 tools/rigger/chalicotherium/gen-clips.py chalicotherium-rig.json chalicotherium-clips.json ['{"S":9,"crouch":2.5}']
# Faces right. All four limbs are 2-bone IK (rigkit.py): a lateral-sequence walk (near hind, near fore, far hind, far fore, a quarter
# cycle apart), each foot planted flat and sliding back at body speed, then swung forward lifted. The body crouches a little so the
# straight standing legs have reach to spare, rises over the planted feet, rocks, and the neck and head swing against it.
# Rest: lies down on its belly, hind feet drawn under, forelegs folded forward, then the head sinks and it sleeps.
# SHEETS=<dir> also writes contact sheets and GIFs of both clips there.
import json, math, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'carcharodontosaurus'))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from rigkit import Rig, rd, sm, unwrap
K = dict(N=12, fps=8, ds=.66, S=13.5, SF=12.0, crouch=3.5, lift=3.0, bob=.7, pitch=.7, neck=1.6, ear=6.0,
         lie=9, drop=18.0, fps_rest=6, hind_in=9.0, fore_out=15.0, head_down=24.0)
if len(sys.argv) > 3: K.update(json.loads(sys.argv[3]))
P = json.load(open(sys.argv[1])); R = Rig(P)
BODY, NECK, HEAD, JAW, EAR = 'n320', 'n312', 'n318', 'n314', 'n316'
LEGS = [('n298', 'n296', 'n294', 0, 0), ('n310', 'n308', 'n306', .25, 1), ('n292', 'n290', 'n288', .5, 0), ('n304', 'n302', 'n300', .75, 1)]   # thigh, shin, foot, phase, 1 for a foreleg
STAND = {}
W0 = R.worlds({})
for th, sh, ft, off, fore in LEGS: STAND[th] = (W0[ft][4], W0[ft][5])   # the ankle's world place standing
short = [0.0]

def limb(p, th, sh, ft, x, y, fr=0.0):
  short[0] = max(short[0], R.leg(p, th, sh, ft, (x, y), fr))

# ---- walk
frames = []
for i in range(K['N']):
  f, p = i/K['N'], {}
  up = math.cos(4*math.pi*(f - K['ds']/2 + .25))   # +1 high over planted feet, -1 as weight passes between
  bdy = K['crouch'] - K['bob']*up
  rb = K['pitch']*math.sin(4*math.pi*f + 1.0)
  p[BODY] = {'r': rd(rb), 'dx': 0, 'dy': rd(bdy)}
  p[NECK] = {'r': rd(-rb + K['neck']*math.sin(2*math.pi*(f + .1))), 'dx': 0, 'dy': 0}
  p[HEAD] = {'r': rd(-.6*K['neck']*math.sin(2*math.pi*(f + .1)) + .4*K['bob']*up), 'dx': 0, 'dy': 0}
  p[JAW] = {'r': 0, 'dx': 0, 'dy': 0}
  p[EAR] = {'r': rd(K['ear']*max(0, math.sin(2*math.pi*(2*f + .2)))**3), 'dx': 0, 'dy': 0}
  for th, sh, ft, off, fore in LEGS:
    S = K['SF'] if fore else K['S']
    ax, ay = STAND[th]
    fl = (f + off) % 1
    if fl < K['ds']: x = ax + S/2 - S*fl/K['ds']; lift = 0.0; fr = 0.0
    else:
      t = (fl - K['ds'])/(1 - K['ds']); x = ax - S/2 + S*sm(t); lift = K['lift']*math.sin(math.pi*t); fr = -9*math.sin(math.pi*t)   # toes up in the swing
    limb(p, th, sh, ft, x, ay - lift, fr)
  frames.append(p)
walk = {'name': 'walk', 'fps': K['fps'], 'frames': unwrap(frames)}
print('walk: %d frames; leg reach short by up to %.2f px' % (len(frames), short[0]))
low = [max(R.lowest(fr).values()) for fr in frames]
print('  lowest drawn row', round(min(low), 2), 'to', round(max(low), 2), '(standing: %.1f)' % max(R.lowest({}).values()))
print('  rstep for the game:', round((K['S']/K['ds'])/K['N']*.025, 4), '(set it in SPRITES)')

# ---- rest
short[0] = 0.0
def rest_at(e, hd, ear, breath):
  """e: how far down it has lain (0 standing, 1 on its belly); hd: how far the head has sunk (0..1); breath: body rise in px"""
  p, d = {}, K['drop']*sm(e)
  p[BODY] = {'r': 0, 'dx': 0, 'dy': rd(d - breath)}
  p[NECK] = {'r': rd(-K['head_down']*.35*sm(e) + K['head_down']*.7*hd), 'dx': 0, 'dy': 0}
  p[HEAD] = {'r': rd(K['head_down']*.5*hd), 'dx': 0, 'dy': 0}
  p[JAW] = {'r': 0, 'dx': 0, 'dy': 0}
  p[EAR] = {'r': rd(ear), 'dx': 0, 'dy': 0}
  for th, sh, ft, off, fore in LEGS:
    ax, ay = STAND[th]
    s = sm(e)
    x = ax + (K['fore_out'] if fore else K['hind_in'])*s
    limb(p, th, sh, ft, x, ay, 0.0)
  return p
fr = []
for i in range(K['lie']): e = i/(K['lie'] - 1); fr.append(rest_at(e, 0, 0, 0))
# a look round with an ear flick, then the head sinks and it sleeps, breathing
for hd, ear, br in [(0, 0, 0), (0, -14, 0), (0, 0, 0), (.1, 0, 0), (.3, 0, .2), (.5, 0, .4), (.7, 0, .2), (.85, 0, 0), (.95, 0, .3), (1, -10, .5), (1, 0, .3), (1, 0, 0), (1, 0, .4), (1, 0, .2)]:
  fr.append(rest_at(1, hd, ear, br))
rest = {'name': 'rest', 'fps': K['fps_rest'], 'frames': fr}
print('rest: %d frames; leg reach short by up to %.2f px' % (len(fr), short[0]))
low = [max(R.lowest(x).values()) for x in fr]
print('  lowest drawn row', round(min(low), 2), 'to', round(max(low), 2))

keep = [c for c in P['clips'] if c['name'] not in ('walk', 'rest')]
P['clips'] = keep + [walk, rest]
json.dump(P, open(sys.argv[2], 'w'), separators=(',', ':'))

if os.environ.get('SHEETS'):
  from rigdraw import Draw
  from PIL import Image
  D, out = Draw(P), os.environ['SHEETS']
  for c in (walk, rest):
    ims = [D.pose(x).convert('RGBA') for x in c['frames']]
    cols = 5; rows = (len(ims) + cols - 1)//cols; w, h = ims[0].size
    sheet = Image.new('RGBA', (cols*w*2, rows*h*2), (255, 255, 255, 255))
    for j, im in enumerate(ims):
      sheet.alpha_composite(im.resize((w*2, h*2), 0), ((j % cols)*w*2, (j//cols)*h*2))
    sheet.save(os.path.join(out, c['name'] + '-sheet.png'))
