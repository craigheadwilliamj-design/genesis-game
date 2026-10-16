import io, base64, json
from render import *
from rigkit import unwrap, sm, rd, wrap
import math
class SRig(Rig):
  def img(self, n):
    if not hasattr(self, '_im'): self._im = {}
    if n['id'] not in self._im: self._im[n['id']] = Image.open(io.BytesIO(base64.b64decode(self.P['assets'][n['asset']].split(',')[1]))).convert('RGBA')
    return self._im[n['id']]

# 2-bone IK like Rig.leg, but for a thigh that is a root part (the Scutosaurus legs hang off nothing, so the body's bob never moves them)
def leg_ik(R, pose, thigh, shin, foot, ankle, foot_r=0.0, knee=1):
  th, sh, ft = R.by[thigh], R.by[shin], R.by[foot]
  tp = pose.get(thigh, {}); hx, hy = th['lx'] + tp.get('dx', 0), th['ly'] + tp.get('dy', 0)
  v1, v2 = (sh['lx'], sh['ly']), (ft['lx'], ft['ly']); L1, L2 = math.hypot(*v1), math.hypot(*v2)
  dx, dy = ankle[0] - hx, ankle[1] - hy; d0 = math.hypot(dx, dy)
  d = min(max(d0, abs(L1 - L2) + .05), L1 + L2 - 1e-6)
  ph = math.atan2(dy, dx); al = math.acos(max(-1, min(1, (L1*L1 + d*d - L2*L2)/(2*L1*d))))
  side = 1 if (v1[0] + v2[0])*v1[1] - (v1[1] + v2[1])*v1[0] < 0 else -1
  a1 = ph - al*side*knee
  kx, ky = hx + L1*math.cos(a1), hy + L1*math.sin(a1)
  ex, ey = hx + d*math.cos(ph), hy + d*math.sin(ph)
  a2 = math.atan2(ey - ky, ex - kx)
  t1 = math.degrees(a1 - math.atan2(v1[1], v1[0])); t2 = math.degrees(a2 - math.atan2(v2[1], v2[0]))
  pose[thigh] = {'r': rd(wrap(t1)), 'dx': tp.get('dx', 0), 'dy': tp.get('dy', 0)}
  pose[shin] = {'r': rd(wrap(t2 - t1)), 'dx': 0, 'dy': 0}
  pose[foot] = {'r': rd(wrap(foot_r - t2)), 'dx': 0, 'dy': 0}
  return max(0, d0 - d)   # how far short the leg fell
# the legs: [thigh, shin, foot, hip offset (dx, dy) from the rest pose, ankle rest x]  (near back, near front, far back, far front)
LEGS = {'nb': ('n268', 'n270', 'n272'), 'nf': ('n260', 'n262', 'n264'), 'fb': ('n288', 'n284', 'n286'), 'ff': ('n294', 'n292', 'n290')}
BODY, HEAD, JAW, TAIL = 'n250', 'n252', 'n254', 'n258'
HIP = {'b': (42, 44), 'f': (73, 44)}   # hip joints in the rest pose
