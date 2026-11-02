# Writes every Tiktaalik clip from the hand-made rig (tiktaalik-rig.json: parts drawn and shaded in the pixel editor; body, tail, head, jaws, a near
# and far front and back fin) into tiktaalik-clips.json, which is what gets exported. The parts are left alone; the body is moved so the rest pose sits
# in the game's 100 x 75 cell, centered, fins on row 43.
#   python3 -I tools/rigger/tiktaalik/gen-clips.py      (SHEETS=<dir> also writes contact sheets and GIFs)
# A vivarium animal doesn't walk, so there is no walk clip. stand: a slow breathing loop. gape: lifts its head and gapes (the rig's hand-set pose at the
#   top), snaps shut. push-up: props itself up on its front fins, looks up, settles. rest: fins fold back along the body, belly down, a yawn, chin down.
# Also draws sprites/tikt.png (stand frame 0). The script prints any part that dips under the ground row.
import json, math, os, sys
here = os.path.dirname(os.path.abspath(__file__)); root = os.path.join(here, '..', '..', '..'); sys.path.insert(0, os.path.join(here, '..'))
from rigdraw import Draw
from PIL import Image

BODY, TAIL, HEAD, JAW = 'n2', 'n12', 'n6', 'n4'
FRONT, BACK = ('n8', 'n45'), ('n10', 'n47')   # near, far
FINS = FRONT + BACK
P = json.load(open(os.path.join(here, 'tiktaalik-rig.json'))); P['clips'] = []
D = Draw(P)
box = D.pose({}).getchannel('A').point(lambda v: 255 if v > 127 else 0).getbbox()
ox, oy = round((100 - (box[2] - box[0])) / 2) - box[0], 43 - (box[3] - 1)
P['cell'] = {'w': 100, 'h': 75}; P['ground'] = 44
for n in P['nodes']:
  if not n.get('parent'): n['lx'] += ox; n['ly'] += oy
D = Draw(P)
pix = {}
for n in P['nodes']:
  a = D.assets[n['asset']]; w, h = a.size; px = a.load()
  pix[n['id']] = [(x + .5 - n['px'], y + .5 - n['py']) for y in range(h) for x in range(w) if px[x, y][3] > 127]
def bottom(pose, k):
  m = D.mat(D.nodes[k], pose); return max(m[3]*x + m[4]*y + m[5] for x, y in pix[k]) + .5
GROUND = max(bottom({}, k) for k in FINS)

def P_(**kw):   # a pose from part turns: P_(n6=-10) or P_(n2=(r, dx, dy))
  return {k: (dict(r=v[0], dx=v[1], dy=v[2]) if isinstance(v, tuple) else dict(r=v, dx=0, dy=0)) for k, v in kw.items() if v != 0}
def plant(pose, parts=FINS):   # shift each fin along the body so its tip stays on the ground
  for k in parts:
    for _ in range(3):
      d = GROUND - bottom(pose, k)
      if abs(d) < .05: break
      q = pose.setdefault(k, dict(r=0, dx=0, dy=0)); q['dy'] = round(q['dy'] + d, 2)
  return pose
def lift(up, tilt, **kw):   # the body raised `up` px with its front tipped up `tilt` degrees, fins kept planted
  return plant(P_(n2=(-tilt, 0, -up), **kw))
def clip(name, fps, frames): P['clips'].append({'name': name, 'fps': fps, 'frames': frames})

clip('stand', 1000 / 600, [{}, lift(.6, 0, n6=-2), {}, P_(n12=3, n6=1)])
clip('gape', 1000 / 130, [
  P_(n6=-8, n8=2, n45=2, n12=2), P_(n6=-18, n4=6, n8=5, n45=5, n12=5), P_(n6=-28, n4=18, n8=7, n45=7, n12=8),
  P_(n6=-32, n4=28, n8=8, n45=8, n12=9.5), P_(n6=-32, n4=28, n8=8, n45=8, n12=9.5), P_(n6=-30, n8=7, n45=7, n12=8),
  P_(n6=-18, n8=4, n45=4, n12=5), P_(n6=-7, n8=1, n45=1, n12=2)])
clip('push-up', 1000 / 130, [lift(.6, 1), lift(1.4, 2.5, n6=-3), lift(2, 3, n6=-6), lift(2, 3, n6=-12), lift(2, 3, n6=-12, n4=5),
  lift(2, 3, n6=-4), lift(1.2, 2, n6=-1), lift(.4, .5)])
def rest(t, **kw):   # t 0..1: fins fold back flat along the body as the belly settles onto the ground
  return P_(n2=(0, 0, t), n8=30*t, n45=30*t, n10=28*t, n47=28*t, n12=0, **kw)
clip('rest', 6, [rest(.25, n6=1), rest(.5, n6=2), rest(.75, n6=3), rest(1, n6=4), rest(1, n6=-3, n4=8), rest(1, n6=1, n4=2), rest(1, n6=5)])

for c in P['clips']:
  for i, f in enumerate(c['frames']):
    for k in D.nodes:
      b = bottom(f, k)
      if b > GROUND + .6: print(f"{c['name']} {i}: {D.nodes[k]['name']} {b - GROUND:.1f} px under the ground")
json.dump(P, open(os.path.join(here, 'tiktaalik-clips.json'), 'w'), separators=(',', ':'))
D.pose({}).save(os.path.join(root, 'sprites', 'tikt.png'))
print('moved the body by', ox, oy, '; ground row', GROUND)

S = os.environ.get('SHEETS')
if S:
  k = 6; crop = (8, 26, 92, 48)
  for c in P['clips']:
    fr = [D.pose(f).crop(crop) for f in [{}] + c['frames']]
    w, h = fr[0].size; sh = Image.new('RGBA', (w * k, h * k * len(fr)), (214, 228, 240, 255))
    for i, im in enumerate(fr):
      bg = Image.new('RGBA', im.size, (214, 228, 240, 255)); bg.alpha_composite(im); sh.paste(bg.resize((w * k, h * k), Image.NEAREST), (0, i * h * k))
    sh.save(os.path.join(S, f"{c['name']}.png"))
