# Shared by the Lystrosaurus clip scripts: the rigger's forward kinematics (rigkit.py of the Carcharodontosaurus) plus a preview
# renderer (parts turned about their joints with whole-pixel positions, nearest-neighbour like the rigger) for contact sheets and GIFs.
import base64, io, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'carcharodontosaurus'))
from rigkit import *
from PIL import Image

BODY, HEAD, JAW = 'n188', 'n190', 'n192'
# [thigh, leg, foot] of each limb, and the rest place of its hip (a thigh is a root part, so it does not follow the body: the scripts shift it)
FAR_FRONT, FAR_BACK, NEAR_FRONT, NEAR_BACK = ('n209', 'n207', 'n197'), ('n213', 'n211', 'n195'), ('n203', 'n205', 'n201'), ('n219', 'n217', 'n199')
LIMBS = [FAR_FRONT, FAR_BACK, NEAR_FRONT, NEAR_BACK]

class View(Rig):
  def __init__(self, P):
    Rig.__init__(self, P)
    self.img = {n['id']: Image.open(io.BytesIO(base64.b64decode(P['assets'][n['asset']].split(',')[1]))).convert('RGBA') for n in P['nodes']}
  def worlds(self, pose):
    w = Rig.worlds(self, pose); w[None] = I   # a thigh is a root part: its parent is the world
    return w
  def hip(self, pose, limb, body_pose):
    """where a limb's thigh joint must sit (dx, dy from its rest place) to stay on the body, which is turned and shifted by body_pose"""
    th = self.by[limb[0]]; b = self.by[BODY]
    m = mul(trans(b['lx'] + body_pose.get('dx', 0), b['ly'] + body_pose.get('dy', 0)), rot(body_pose.get('r', 0)))
    x, y = apply(m, th['lx'] - b['lx'], th['ly'] - b['ly'])
    return x - th['lx'], y - th['ly']
  def render(self, pose, size=None, bg=None):
    W, H = size or (self.P['cell']['w'], self.P['cell']['h']); out = Image.new('RGBA', (W, H), bg or (0, 0, 0, 0))
    wd = self.worlds(pose)
    for n in self.P['nodes']:
      m = wd[n['id']]; ox, oy = round(m[4]), round(m[5])
      # world -> image: image point = joint + inverse(linear part) * (world - origin)
      a, b, c, d = m[0], m[1], m[2], m[3]; det = a*d - b*c
      ia, ib, ic, id_ = d/det, -c/det, -b/det, a/det
      px, py = n['px'], n['py']
      coef = (ia, ib, px - ia*ox - ib*oy, ic, id_, py - ic*ox - id_*oy)
      part = self.img[n['id']].transform((W, H), Image.AFFINE, coef, Image.NEAREST)
      out.alpha_composite(part)
    return out

def sheet(view, frames, path, cols=None, k=3, bg=(214, 228, 240, 255), crop=(14, 22, 92, 74)):
  cols = cols or min(len(frames), 6); rows = (len(frames) + cols - 1)//cols
  w, h = crop[2] - crop[0], crop[3] - crop[1]; S = Image.new('RGBA', (cols*w*k, rows*h*k), bg)
  for i, f in enumerate(frames):
    im = Image.new('RGBA', (100, 75), bg); im.alpha_composite(view.render(f)); im = im.crop(crop).resize((w*k, h*k), Image.NEAREST)
    S.paste(im, ((i % cols)*w*k, (i//cols)*h*k))
  S.convert('RGB').save(path)

def gif(view, frames, path, fps, k=4, crop=(14, 22, 92, 74), bg=(214, 228, 240)):
  ims = []
  for f in frames:
    im = Image.new('RGBA', (100, 75), bg + (255,)); im.alpha_composite(view.render(f)); ims.append(im.crop(crop).resize(((crop[2] - crop[0])*k, (crop[3] - crop[1])*k), Image.NEAREST).convert('P', palette=Image.ADAPTIVE))
  ims[0].save(path, save_all=True, append_images=ims[1:], duration=int(1000/fps), loop=0, disposal=2)
