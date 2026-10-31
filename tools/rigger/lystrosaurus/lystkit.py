# Shared by the Lystrosaurus clip script: the rigger's forward kinematics and 2-bone leg IK (rigkit.py of the Carcharodontosaurus) plus a preview
# renderer (parts turned about their joints with whole-pixel positions, nearest-neighbour like the rigger) for contact sheets and GIFs.
import base64, io, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'carcharodontosaurus'))
from rigkit import *
from PIL import Image

BODY, HEAD, JAW, TAIL = 'n8', 'n4', 'n6', 'n10'
# [thigh or upper arm, leg or forearm, foot] of each limb; every limb hangs off the body
FAR_FRONT, FAR_BACK, NEAR_FRONT, NEAR_BACK = ('n95', 'n97', 'n99'), ('n89', 'n91', 'n93'), ('n18', 'n20', 'n22'), ('n12', 'n14', 'n16')
LIMBS = [FAR_FRONT, FAR_BACK, NEAR_FRONT, NEAR_BACK]
FRONT = (FAR_FRONT[0], NEAR_FRONT[0])

class View(Rig):
  def __init__(self, P):
    Rig.__init__(self, P)
    self.img = {n['id']: Image.open(io.BytesIO(base64.b64decode(P['assets'][n['asset']].split(',')[1]))).convert('RGBA') for n in P['nodes']}
  def render(self, pose, size=None, bg=None):
    W, H = size or (self.P['cell']['w'], self.P['cell']['h']); out = Image.new('RGBA', (W, H), bg or (0, 0, 0, 0))
    wd = self.worlds(pose)
    for n in self.P['nodes']:
      if pose.get(n['id'], {}).get('v') == 0: continue   # hidden in this frame
      m = wd[n['id']]; ox, oy = round(m[4]), round(m[5])
      # world -> image: image point = joint + inverse(linear part) * (world - origin)
      a, b, c, d = m[0], m[1], m[2], m[3]; det = a*d - b*c
      ia, ib, ic, id_ = d/det, -c/det, -b/det, a/det
      px, py = n['px'], n['py']
      coef = (ia, ib, px - ia*ox - ib*oy, ic, id_, py - ic*ox - id_*oy)
      out.alpha_composite(self.img[n['id']].transform((W, H), Image.AFFINE, coef, Image.NEAREST))
    return out

def sheet(view, frames, path, cols=None, k=3, bg=(214, 228, 240, 255), crop=(10, 36, 92, 75)):
  cols = cols or min(len(frames), 6); rows = (len(frames) + cols - 1)//cols
  w, h = crop[2] - crop[0], crop[3] - crop[1]; S = Image.new('RGBA', (cols*w*k, rows*h*k), bg)
  for i, f in enumerate(frames):
    im = Image.new('RGBA', (100, 75), bg); im.alpha_composite(view.render(f)); im = im.crop(crop).resize((w*k, h*k), Image.NEAREST)
    S.paste(im, ((i % cols)*w*k, (i//cols)*h*k))
  S.convert('RGB').save(path)

def gif(view, frames, path, fps, k=4, crop=(10, 36, 92, 75), bg=(214, 228, 240)):
  ims = []
  for f in frames:
    im = Image.new('RGBA', (100, 75), bg + (255,)); im.alpha_composite(view.render(f)); ims.append(im.crop(crop).resize(((crop[2] - crop[0])*k, (crop[3] - crop[1])*k), Image.NEAREST).convert('P', palette=Image.ADAPTIVE))
  ims[0].save(path, save_all=True, append_images=ims[1:], duration=int(1000/fps), loop=0, disposal=2)
