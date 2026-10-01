/* =====================================================================
   GEOMETRY
   Math helpers for shapes on the map. Everything is measured in meters.
   A point is [x, y]. A shape is a list of points.
   ===================================================================== */

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// Area of a shape in square meters
function area(pts){
  let a = 0;
  for(let i = 0; i < pts.length; i++){ const [x1,y1] = pts[i], [x2,y2] = pts[(i+1) % pts.length]; a += x1*y2 - x2*y1; }
  return Math.abs(a) / 2;
}

// Distance around the edge of a closed shape
function perimeter(pts){ let l = 0; for(let i = 0; i < pts.length; i++) l += dist(pts[i], pts[(i+1) % pts.length]); return l; }

// Length of an open line
function lineLength(pts){ let l = 0; for(let i = 1; i < pts.length; i++) l += dist(pts[i-1], pts[i]); return l; }

function centroid(pts){
  let a = 0, cx = 0, cy = 0;
  for(let i = 0; i < pts.length; i++){ const [x1,y1] = pts[i], [x2,y2] = pts[(i+1) % pts.length]; const f = x1*y2 - x2*y1; a += f; cx += (x1+x2)*f; cy += (y1+y2)*f; }
  if(Math.abs(a) < 1e-9){ const n = pts.length; return [pts.reduce((s,p)=>s+p[0],0)/n, pts.reduce((s,p)=>s+p[1],0)/n]; }
  return [cx/(3*a), cy/(3*a)];
}

function bbox(pts){
  const xs = pts.map(p=>p[0]), ys = pts.map(p=>p[1]);
  return {x0:Math.min(...xs), y0:Math.min(...ys), x1:Math.max(...xs), y1:Math.max(...ys)};
}

// Is the point (x, y) inside the shape?
function inPoly(x, y, pts){
  let c = false;
  for(let i = 0, j = pts.length-1; i < pts.length; j = i++){
    const [xi,yi] = pts[i], [xj,yj] = pts[j];
    if(((yi > y) !== (yj > y)) && (x < (xj-xi)*(y-yi)/((yj-yi)||1e-12) + xi)) c = !c;
  }
  return c;
}

// Closest point on the segment a-b to (px, py)
function segProj(px, py, a, b){
  const dx = b[0]-a[0], dy = b[1]-a[1], L = dx*dx + dy*dy;
  const t = L ? clamp(((px-a[0])*dx + (py-a[1])*dy) / L, 0, 1) : 0;
  const x = a[0] + t*dx, y = a[1] + t*dy;
  return {x, y, t, d:Math.hypot(px-x, py-y)};
}

// Do segments a-b and c-d properly cross (not just touch at an end)?
// A point within 5 cm of the other line counts as touching it, so fences that share a wall don't count as crossing.
function segCross(a, b, c, d){
  const o = (p, q, r) => (q[0]-p[0])*(r[1]-p[1]) - (q[1]-p[1])*(r[0]-p[0]);
  const d1 = o(c,d,a), d2 = o(c,d,b), d3 = o(a,b,c), d4 = o(a,b,d);
  const e1 = .05 * (dist(c, d) || 1), e2 = .05 * (dist(a, b) || 1);
  return ((d1 > e1 && d2 < -e1) || (d1 < -e1 && d2 > e1)) && ((d3 > e2 && d4 < -e2) || (d3 < -e2 && d4 > e2));
}

function segSegDist(a, b, c, d){
  if(segCross(a, b, c, d)) return 0;
  return Math.min(segProj(a[0],a[1],c,d).d, segProj(b[0],b[1],c,d).d, segProj(c[0],c[1],a,b).d, segProj(d[0],d[1],a,b).d);
}

// Distance from a point to the edge of a closed shape
function distToEdge(x, y, pts){
  let m = Infinity;
  for(let i = 0; i < pts.length; i++) m = Math.min(m, segProj(x, y, pts[i], pts[(i+1) % pts.length]).d);
  return m;
}

// Is the point clearly inside the shape (not just sitting on its fence)?
function deepInside(x, y, pts, margin){ return inPoly(x, y, pts) && distToEdge(x, y, pts) > margin; }

// Closest distance between an open line and a closed shape (0 if they touch or cross)
function lineShapeDist(line, shape){
  let m = Infinity;
  for(const p of line) if(inPoly(p[0], p[1], shape)) return 0;
  for(let i = 1; i < line.length; i++)
    for(let j = 0; j < shape.length; j++)
      m = Math.min(m, segSegDist(line[i-1], line[i], shape[j], shape[(j+1) % shape.length]));
  return m;
}

// Does the open line cut into the shape? Touching the edge is allowed.
function lineEntersShape(line, shape){
  for(const p of line) if(deepInside(p[0], p[1], shape, 0.5)) return true;
  for(let i = 1; i < line.length; i++){
    for(let j = 0; j < shape.length; j++) if(segCross(line[i-1], line[i], shape[j], shape[(j+1) % shape.length])) return true;
    const mid = [(line[i-1][0]+line[i][0])/2, (line[i-1][1]+line[i][1])/2];
    if(deepInside(mid[0], mid[1], shape, 0.5)) return true;
  }
  return false;
}

// Do two closed shapes overlap? Sharing an edge is allowed.
function shapesOverlap(A, B){
  const closedA = A.concat([A[0]]);
  if(lineEntersShape(closedA, B)) return true;
  for(const p of B) if(deepInside(p[0], p[1], A, 0.5)) return true;
  return false;
}

// Does a self-crossing shape (like a figure 8) exist? Those make bad exhibits.
function selfCrosses(pts){
  const n = pts.length;
  for(let i = 0; i < n; i++) for(let j = i+2; j < n; j++){
    if(i === 0 && j === n-1) continue;
    if(segCross(pts[i], pts[(i+1)%n], pts[j], pts[(j+1)%n])) return true;
  }
  return false;
}

// A rectangle of width w and depth d, centered on (x, y), turned by angle (radians)
function rectPts(x, y, w, d, angle){
  const c = Math.cos(angle), s = Math.sin(angle), hw = w/2, hd = d/2;
  return [[-hw,-hd],[hw,-hd],[hw,hd],[-hw,hd]].map(([u,v]) => [x + u*c - v*s, y + u*s + v*c]);
}

// A random point inside a shape
function randomInside(pts){
  const b = bbox(pts);
  for(let i = 0; i < 40; i++){
    const x = b.x0 + Math.random()*(b.x1-b.x0), y = b.y0 + Math.random()*(b.y1-b.y0);
    if(inPoly(x, y, pts)) return [x, y];
  }
  return centroid(pts);
}
