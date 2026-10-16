# Draws poses of a rigger project to PNG contact sheets (whole pixels, nearest), for checking clips by eye.
#   from render import *; sheet(P, [pose, ...], 'out.png', scale=4, cols=6)
import base64, io, math, sys, os
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'carcharodontosaurus'))
from rigkit import Rig, mul, trans, rot, apply
def draw(R, pose, ground=True, bg=(214, 200, 150, 255)):
  P = R.P; W, H = P['cell']['w'], P['cell']['h']
  out = Image.new('RGBA', (W, H), bg)
  if ground:
    d = ImageDraw.Draw(out); d.line([(0, P['ground']), (W, P['ground'])], fill=(120, 100, 60, 255))
  worlds = R.worlds(pose)
  for n in P['nodes']:
    if n.get('hidden'): continue
    if n.get('off') and not pose.get(n['id'], {}).get('v'): continue
    im = R.img(n)
    m = worlds[n['id']]; m = mul([m[0], m[1], m[2], m[3], round(m[4]), round(m[5])], trans(-n['px'], -n['py']))
    a, b, c, d_, e, f = m; det = a*d_ - b*c
    inv = (d_/det, -c/det, (c*f - d_*e)/det, -b/det, a/det, (b*e - a*f)/det)
    layer = im.transform((W, H), Image.AFFINE, inv, resample=Image.NEAREST)
    out.alpha_composite(layer)
  return out
def sheet(P, poses, path, scale=4, cols=6, R=None):
  R = R or Rig(P); W, H = P['cell']['w'], P['cell']['h']
  rows = (len(poses) + cols - 1)//cols
  S = Image.new('RGBA', (cols*W*scale, rows*H*scale), (255, 255, 255, 255))
  for i, p in enumerate(poses):
    S.alpha_composite(draw(R, p).resize((W*scale, H*scale), Image.NEAREST), ((i % cols)*W*scale, (i//cols)*H*scale))
  S.convert('RGB').save(path)
