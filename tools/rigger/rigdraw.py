"""Draw a rigger project's pose to a PIL image the way the rigger does (parent world matrix, turn about the joint, nearest-neighbor, no smoothing).
    from rigdraw import Draw; d = Draw(project); img = d.pose({nodeId: {"r": 10, "dx": 0, "dy": 0}})"""
import base64, io, math
from PIL import Image

class Draw:
    def __init__(self, proj):
        self.proj = proj; self.nodes = {n["id"]: n for n in proj["nodes"]}; self.W, self.H = proj["cell"]["w"], proj["cell"]["h"]
        self.assets = {k: Image.open(io.BytesIO(base64.b64decode(v.split(",", 1)[1]))).convert("RGBA") for k, v in proj["assets"].items()}
    def mat(self, n, pose):
        p = pose.get(n["id"], {}); r = math.radians(p.get("r", 0)); c, s = math.cos(r), math.sin(r)
        m = [c, -s, n["lx"] + p.get("dx", 0), s, c, n["ly"] + p.get("dy", 0)]
        if n.get("parent"):
            a = self.mat(self.nodes[n["parent"]], pose)
            m = [a[0]*m[0] + a[1]*m[3], a[0]*m[1] + a[1]*m[4], a[0]*m[2] + a[1]*m[5] + a[2], a[3]*m[0] + a[4]*m[3], a[3]*m[1] + a[4]*m[4], a[3]*m[2] + a[4]*m[5] + a[5]]
        return m
    def pose(self, pose):
        img = Image.new("RGBA", (self.W, self.H), (0, 0, 0, 0))
        for n in self.proj["nodes"]:
            im = self.assets[n["asset"]]
            if n.get("flip"): im = im.transpose(Image.FLIP_LEFT_RIGHT)
            a, b, c, d, e, f = self.mat(n, pose); det = a*e - b*d; ia, ib, ic, ie = e/det, -b/det, -d/det, a/det
            img = Image.alpha_composite(img, im.transform((self.W, self.H), Image.AFFINE, (ia, ib, n["px"] - (ia*c + ib*f), ic, ie, n["py"] - (ic*c + ie*f)), Image.NEAREST))
        return img
