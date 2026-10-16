# Shared helpers for the Carcharodontosaurus clip scripts: forward kinematics like the rigger's worlds(), 2-bone leg IK,
# and a ground check from the parts' own pixels. Matrices are [a, b, c, d, e, f]; a positive turn is clockwise on screen.
import base64, io, json, math
from PIL import Image
I = [1, 0, 0, 1, 0, 0]
def mul(m, n): return [m[0]*n[0] + m[2]*n[1], m[1]*n[0] + m[3]*n[1], m[0]*n[2] + m[2]*n[3], m[1]*n[2] + m[3]*n[3], m[0]*n[4] + m[2]*n[5] + m[4], m[1]*n[4] + m[3]*n[5] + m[5]]
def trans(x, y): return [1, 0, 0, 1, x, y]
def rot(d): r = math.radians(d); c, s = math.cos(r), math.sin(r); return [c, s, -s, c, 0, 0]
def apply(m, x, y): return m[0]*x + m[2]*y + m[4], m[1]*x + m[3]*y + m[5]
rd = lambda x: round(x, 2) + 0.0
wrap = lambda a: (a + 180) % 360 - 180   # an angle in -180..180, so tweens never spin the long way round
sm = lambda t: (1 - math.cos(math.pi*max(0, min(1, t))))/2
class Rig:
  def __init__(self, P):
    self.P, self.by = P, {n['id']: n for n in P['nodes']}
    self.pix = {}
    for n in P['nodes']:
      im = Image.open(io.BytesIO(base64.b64decode(P['assets'][n['asset']].split(',')[1]))).convert('RGBA')
      self.pix[n['id']] = [(u - n['px'], v - n['py']) for v in range(im.height) for u in range(im.width) if im.getpixel((u, v))[3] > 16]
  def worlds(self, pose):
    out = {}
    def get(n):
      if n['id'] in out: return out[n['id']]
      p = pose.get(n['id'], {}); pm = get(self.by[n['parent']]) if n.get('parent') else I
      out[n['id']] = mul(pm, mul(trans(n['lx'] + p.get('dx', 0), n['ly'] + p.get('dy', 0)), rot(p.get('r', 0))))
      return out[n['id']]
    for n in self.P['nodes']: get(n)
    return out
  def lowest(self, pose, skip=()):
    """the lowest drawn pixel row (its bottom edge) of each part, as the rigger draws it with whole pixels"""
    W, low = self.worlds(pose), {}
    for n in self.P['nodes']:
      if n['id'] in skip or (n.get('off') and not pose.get(n['id'], {}).get('v')): continue
      m = W[n['id']]; ox, oy = round(m[4]), round(m[5])
      low[n['id']] = max(m[1]*(x + .5) + m[3]*(y + .5) + oy for x, y in self.pix[n['id']]) + .5
    return low
  def leg(self, pose, thigh, shin, foot, ankle, foot_r=0.0, knee=1):
    """poses thigh, shin and foot so the ankle lands on `ankle` (world) and the foot turns foot_r in the world. knee: +1 bends like the rest pose, -1 the other way"""
    th, sh, ft = self.by[thigh], self.by[shin], self.by[foot]
    pm = self.worlds(pose)[th['parent']]
    base = math.degrees(math.atan2(pm[1], pm[0]))   # the parent's own turn in the world
    hx, hy = apply(pm, th['lx'] + pose.get(thigh, {}).get('dx', 0), th['ly'] + pose.get(thigh, {}).get('dy', 0))
    v1, v2 = (sh['lx'], sh['ly']), (ft['lx'], ft['ly']); L1, L2 = math.hypot(*v1), math.hypot(*v2)
    dx, dy = ankle[0] - hx, ankle[1] - hy; d = math.hypot(dx, dy)
    d = min(max(d, abs(L1 - L2) + .05), L1 + L2 - 1e-6)
    ph = math.atan2(dy, dx); al = math.acos(max(-1, min(1, (L1*L1 + d*d - L2*L2)/(2*L1*d))))
    rest_side = 1 if (v1[0] + v2[0])*v1[1] - (v1[1] + v2[1])*v1[0] < 0 else -1
    a1 = ph - al*rest_side*knee
    kx, ky = hx + L1*math.cos(a1), hy + L1*math.sin(a1)
    ex, ey = hx + d*math.cos(ph), hy + d*math.sin(ph)    # the ankle as reached (clamped to the leg's length)
    a2 = math.atan2(ey - ky, ex - kx)
    t1 = math.degrees(a1 - math.atan2(v1[1], v1[0])); t2 = math.degrees(a2 - math.atan2(v2[1], v2[0]))
    pose[thigh] = {'r': rd(wrap(t1 - base)), 'dx': pose.get(thigh, {}).get('dx', 0), 'dy': pose.get(thigh, {}).get('dy', 0)}
    pose[shin] = {'r': rd(wrap(t2 - t1)), 'dx': 0, 'dy': 0}
    pose[foot] = {'r': rd(wrap(foot_r - t2)), 'dx': 0, 'dy': 0}
    return math.hypot(ankle[0] - ex, ankle[1] - ey)   # how far short the leg fell

def unwrap(frames):
  """turns each part's angle by whole turns to sit nearest the frame before, so the game's tween between frames never spins a part the long way"""
  prev = {}
  for f in frames:
    for k, v in f.items():
      if 'r' in v and k in prev:
        while v['r'] - prev[k] > 180: v['r'] = rd(v['r'] - 360)
        while v['r'] - prev[k] < -180: v['r'] = rd(v['r'] + 360)
      if 'r' in v: prev[k] = v['r']
  return frames
