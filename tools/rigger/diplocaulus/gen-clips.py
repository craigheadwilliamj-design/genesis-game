# Writes the Diplocaulus clips into a copy of the hand-made rig, leaving its parts and joints alone.
#   python3 -I tools/rigger/diplocaulus/gen-clips.py [SHEETS_DIR]
# Reads diplocaulus-rig.json, writes diplocaulus-clips.json (what gets exported):
#   rigtogame.py tools/rigger/diplocaulus/diplocaulus-clips.json dcau --walk walk --stand idle --idle "look up" "tail swish" --rest rest --swim swim --waterline 35
# Each leg is one part, so a foot follows an arc about its hip: the turn is solved so the foot slides back at an even speed in stance
# and the leg's dy keeps a planted foot on its own row. Lateral-sequence walk (near hind, near front, far hind, far front, a quarter
# cycle apart), sprawled and low like a salamander. With a directory, also writes a contact sheet and a GIF a clip.
import json, math, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from rigdraw import Draw
HERE = os.path.dirname(os.path.abspath(__file__))
P = json.load(open(os.path.join(HERE, 'diplocaulus-rig.json')))
by = {n['id']: n for n in P['nodes']}
BODY, HEAD, TAIL, TIP = 'n2', 'n6', 'n8', 'n10'
FOOT = {'n4': (-2.5, 8), 'n23': (-2.5, 8), 'n12': (-4, 7), 'n21': (-4, 7)}   # the sole's middle from the hip, in the leg's picture
K = dict(N=12, fps=8, ds=.65, S=8.0, lift=2.0, bob=.35, pitch=.8)
rd = lambda x: round(x, 2) + 0.0
sm = lambda t: (1 - math.cos(math.pi*max(0, min(1, t))))/2
wave = lambda f, ph=0: math.sin(2*math.pi*(f + ph))
def turn(v, r):
  c, s = math.cos(math.radians(r)), math.sin(math.radians(r))
  return v[0]*c - v[1]*s, v[0]*s + v[1]*c
def solve(v, ox):   # the turn that moves the foot ox px forward of rest (x falls as r grows)
  lo, hi = -80.0, 80.0
  for _ in range(60):
    m = (lo + hi)/2
    if turn(v, m)[0] - v[0] > ox: lo = m
    else: hi = m
  return (lo + hi)/2
def leg(id, ox, lift, bob=0.0, rb=0.0):   # pose a leg so its foot sits ox forward and lift up of rest in the world, the body bobbed and rocked
  v, n = FOOT[id], by[id]
  wx, wy = n['lx'] + v[0] + ox, n['ly'] + v[1] - lift - bob
  c, s = math.cos(math.radians(-rb)), math.sin(math.radians(-rb))
  bx, by_ = wx*c - wy*s - n['lx'], wx*s + wy*c - n['ly']
  r = solve(v, bx - v[0])
  return {'r': rd(r), 'dx': 0, 'dy': rd(by_ - turn(v, r)[1])}
P0 = lambda r=0, dx=0, dy=0: {'r': rd(r), 'dx': rd(dx), 'dy': rd(dy)}

def walk():
  out = []
  for i in range(K['N']):
    f, pose = i/K['N'], {}
    bob = K['bob']*wave(2*f)
    rb = K['pitch']*wave(2*f, .25)
    pose[BODY] = P0(rb, 0, bob)
    pose[HEAD] = P0(-rb + 1.8*wave(f, .1))   # the head holds level against the rock, then a slow swing a stride
    pose[TAIL] = P0(-rb + 2.5*wave(f, .5))   # a wave down the tail, the tip later and wider
    pose[TIP] = P0(4*wave(f, .35))
    for id, off in (('n12', 0), ('n4', .25), ('n21', .5), ('n23', .75)):
      fl = (f + off) % 1
      if fl < K['ds']: ox, lift = K['S']/2 - K['S']*fl/K['ds'], .5   # half a px up: a turned sole's toe dips under its middle
      else:
        t = (fl - K['ds'])/(1 - K['ds']); ox, lift = -K['S']/2 + K['S']*sm(t), .5 + K['lift']*math.sin(math.pi*t)
      pose[id] = leg(id, ox - .5, lift, bob, rb)
    out.append(pose)
  return {'name': 'walk', 'fps': K['fps'], 'frames': out}

def stand():   # slow breathing: the flank swells, the head and tail tip drift
  out = []
  for i in range(8):
    f = i/8; b = .45*wave(f)
    out.append({BODY: P0(.4*wave(f), 0, -b*.6), HEAD: P0(-.4*wave(f) + .8*wave(f, .2)), TAIL: P0(-.4*wave(f)), TIP: P0(1.5*wave(f, .3)),
                **{id: P0(0, 0, b*.6) for id in FOOT}})
  return {'name': 'idle', 'fps': 4, 'frames': out}

def keys(ks, n):   # sample a list of (time, value) keys, smoothed between them, at n even steps
  out = []
  for i in range(n):
    t = i/(n - 1)
    for (t0, v0), (t1, v1) in zip(ks, ks[1:]):
      if t0 <= t <= t1:
        out.append(v0 + (v1 - v0)*sm((t - t0)/(t1 - t0 or 1))); break
  return out

def look_up():   # lifts its head off the ground, looks up and round twice, lowers it
  n = 24
  hr = keys([(0, 0), (.2, -8), (.38, -5), (.5, -9), (.68, -6), (.85, -2), (1, 0)], n)   # past ~10 degrees the neck opens a gap
  br = keys([(0, 0), (.2, -2.5), (.85, -2), (1, 0)], n)
  tr = keys([(0, 0), (.2, 2.5), (.5, 1.5), (1, 0)], n)
  out = []
  for i in range(n):
    pose = {BODY: P0(br[i]), HEAD: P0(hr[i]), TAIL: P0(tr[i]), TIP: P0(2*math.sin(i/n*2*math.pi))}
    for id in FOOT: pose[id] = leg(id, -.5, 0, 0, br[i])
    out.append(pose)
  return {'name': 'look up', 'fps': 8, 'frames': out}

def tail_swish():   # a slow S down the tail and back, a front foot shifting under it
  n = 20; out = []
  for i in range(n):
    t = i/(n - 1); a = math.sin(math.pi*t)
    pose = {BODY: P0(.5*a), HEAD: P0(-.5*a + 2*a*math.sin(2*math.pi*t)), TAIL: P0(-4*a*math.sin(3*math.pi*t)), TIP: P0(-7*a*math.sin(3*math.pi*t - .9))}
    for id in FOOT: pose[id] = leg(id, -.5, 0, 0, .5*a)
    step = sm((t - .3)/.25) - sm((t - .7)/.25)   # the near front foot steps forward and back
    pose['n4'] = leg('n4', -.5 + 2.5*step, 1.4*math.sin(math.pi*min(1, max(0, (t - .3)/.25))) + 1.4*math.sin(math.pi*min(1, max(0, (t - .7)/.25))), 0, .5*a)
    out.append(pose)
  return {'name': 'tail swish', 'fps': 8, 'frames': out}

def rest():   # sinks onto its belly with the legs folding back along the flanks, the head down last, then breathes
  n = 14; out = []
  dy = keys([(0, 0), (.45, 2.7), (.55, 3), (1, 3)], 10)
  lg = keys([(0, 0), (.6, 1), (1, 1)], 10)
  hd = keys([(0, 0), (.4, -3), (.75, 0), (1, 0)], 10)
  for i in range(n):
    if i < 10: d, l, h, b = dy[i], lg[i], hd[i], 0
    else: d, l, h, b = dy[-1], 1, 0, .3*math.sin((i - 10)/4*2*math.pi)
    out.append({BODY: P0(0, 0, d - b), HEAD: P0(h - b), TAIL: P0(-1.5*l), TIP: P0(-3*l),
                'n4': P0(62*l, -1*l, -1.5*l), 'n23': P0(58*l, -1*l, -1.5*l), 'n12': P0(48*l, 0, -1*l), 'n21': P0(44*l, 0, -1*l)})
  return {'name': 'rest', 'fps': 6, 'frames': out}

def swim():   # legs laid back, the body rides low and the tail beats
  n = 8; out = []
  for i in range(n):
    f = i/n
    out.append({BODY: P0(.8*wave(f, .25), 0, .5*wave(f)), HEAD: P0(-.8*wave(f, .25) + 1.5*wave(f, .1)), TAIL: P0(5*wave(f)), TIP: P0(10*wave(f, -.2)),
                'n4': P0(70, -1, -1), 'n23': P0(66, -1, -1), 'n12': P0(55 + 6*wave(f), 0, -1), 'n21': P0(50 + 6*wave(f, .5), 0, -1)})
  return {'name': 'swim', 'fps': 8, 'frames': out}

P['clips'] = [walk(), stand(), look_up(), tail_swish(), rest(), swim()]
json.dump(P, open(os.path.join(HERE, 'diplocaulus-clips.json'), 'w'), separators=(',', ':'))
for c in P['clips']: print(c['name'], len(c['frames']), 'frames at', c['fps'], 'fps')
print('rstep %.4f' % (K['S']/K['ds']/40/K['N']))

if len(sys.argv) > 1:   # contact sheets (4x, frame numbers along the top) and GIFs
  from PIL import Image
  os.makedirs(sys.argv[1], exist_ok=True); d = Draw(P); g = P['ground']
  for c in P['clips']:
    ims = [d.pose(fr).crop((5, 18, 95, 58)) for fr in c['frames']]
    low = [max((y for y in range(im.height) for x in range(im.width) if im.getpixel((x, y))[3]), default=0) + 18 for im in ims]
    print(' ', c['name'], 'lowest rows', low, '(ground', g, ')')
    cols = 4; W, H = ims[0].width, ims[0].height
    sh = Image.new('RGBA', (W*cols, H*((len(ims) + cols - 1)//cols)), (235, 230, 215, 255))
    for k, im in enumerate(ims):
      x, y = (k % cols)*W, (k//cols)*H
      for gx in range(W): sh.putpixel((x + gx, y + g - 18), (150, 140, 120, 255))
      sh.alpha_composite(im, (x, y))
    sh.resize((sh.width*4, sh.height*4), 0).save(os.path.join(sys.argv[1], c['name'].replace(' ', '-') + '-sheet.png'))
    fr = [Image.alpha_composite(Image.new('RGBA', im.size, (235, 230, 215, 255)), im).resize((im.width*4, im.height*4), 0).convert('P') for im in ims]
    fr[0].save(os.path.join(sys.argv[1], c['name'].replace(' ', '-') + '.gif'), save_all=True, append_images=fr[1:], duration=int(1000/c['fps']), loop=0)
