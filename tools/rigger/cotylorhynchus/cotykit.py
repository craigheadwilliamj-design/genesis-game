# Shared by the Cotylorhynchus clip scripts: the rigger's forward kinematics and preview renderer (lystkit.py of the Lystrosaurus) plus the
# part ids and a stiff-limb pose. Its limbs are tiny bones under big pictures, so bending a knee pulls the pieces apart: a limb is turned as
# one piece about its hip or shoulder, and the joint there gives a little (dx, dy) so the foot lands where it should.
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'lystrosaurus'))
from lystkit import *
BODY, HEAD, JAW, TAIL = 'n8', 'n22', 'n24', 'n6'
NEAR_BACK, NEAR_FRONT, FAR_BACK, FAR_FRONT = ('n16', 'n18', 'n20'), ('n10', 'n12', 'n14'), ('n43', 'n45', 'n47'), ('n37', 'n39', 'n41')
LIMBS = (NEAR_BACK, NEAR_FRONT, FAR_BACK, FAR_FRONT)
FRONT = (NEAR_FRONT, FAR_FRONT)

def rests(V):
  """each limb's ankle (the foot's joint) standing, in the world"""
  W = V.worlds({}); return {l: (W[l[2]][4], W[l[2]][5]) for l in LIMBS}

def stiff(V, pose, limb, x=None, y=None, r=None, foot=0.0, give=None):
  """turns the limb as one piece (r, or the turn that puts the ankle at world x) and shifts its hip so the ankle sits at world y
  (the shift clamped to `give`), the foot turned `foot` degrees in the world (0 is flat). Returns the ankle as posed."""
  th, lg, ft = limb
  pose[lg] = {'r': 0, 'dx': 0, 'dy': 0}
  if r is None:
    lo, hi = -80.0, 80.0                       # x falls as the turn grows
    for _ in range(50):
      r = (lo + hi)/2; pose[th] = {'r': r, 'dx': 0, 'dy': 0}
      if V.worlds(pose)[ft][4] > x: lo = r
      else: hi = r
  pose[th] = {'r': rd(r), 'dx': 0, 'dy': 0}
  if y is not None:
    W = V.worlds(pose); pm = W[V.by[th]['parent']]
    wy = y - W[ft][5]; det = pm[0]*pm[3] - pm[1]*pm[2]   # a world shift straight down, in the parent's frame
    dx, dy = -pm[2]*wy/det, pm[0]*wy/det
    if give is not None: k = min(1, give/max(1e-9, abs(dy))); dx, dy = dx*k, dy*k
    pose[th]['dx'], pose[th]['dy'] = rd(dx), rd(dy)
  W = V.worlds(pose); pb = math.degrees(math.atan2(W[lg][1], W[lg][0]))
  pose[ft] = {'r': rd(wrap(foot - pb)), 'dx': 0, 'dy': 0}
  W = V.worlds(pose); return W[ft][4], W[ft][5]

def save(P, clip, path, after=None):
  """puts the clip in the project in place of the one with its name (or after `after`, or at the end) and writes it"""
  names = [c['name'] for c in P['clips']]
  if clip['name'] in names: P['clips'][names.index(clip['name'])] = clip
  elif after in names: P['clips'].insert(names.index(after) + 1, clip)
  else: P['clips'].append(clip)
  json.dump(P, open(path, 'w'), separators=(',', ':'))
