# Shared by the Allosaurus clip scripts: rigkit's Rig, with leg IK that copes with root thighs, plus the part ids and the standing stance.
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'carcharodontosaurus'))
from rigkit import Rig as _Rig, rd, sm, unwrap
class Rig(_Rig):   # a root thigh's parent frame is the world
  def leg(self, pose, thigh, shin, foot, ankle, foot_r=0.0, knee=1):
    th = self.by[thigh]; saved = th['parent']
    if saved is None:
      th['parent'] = '_w'; self.by['_w'] = {'id': '_w', 'lx': 0, 'ly': 0, 'parent': None}
    try: return _Rig.leg(self, pose, thigh, shin, foot, ankle, foot_r, knee)
    finally: th['parent'] = saved
BODY, NECK, HEAD, JAW, TAIL, TAIL2 = 'n282', 'n280', 'n272', 'n274', 'n276', 'n278'
LEGS = [('n254', 'n256', 'n258'), ('n264', 'n262', 'n260')]   # near, far: thigh, shin, foot
ARMS = ('n270', 'n284')
STAND = {'n254': (62.0, 67.0), 'n264': (61.0, 67.0)}   # the standing stance: near foot a little forward, far foot a little back (the ankle's world place)
CROUCH = 3.0   # the body rides this low standing so the legs have room to bend
FACE = 1       # the animal faces right, so a positive turn tips the nose down
