# Draws the seamless path tiles in the Dimetrodon's flat, simple style: sprites/path/guest.png (warm concrete paving square slabs), staff.png (dark asphalt with gravel dashes
# and pour seams) and bridge.png (wooden planks with butt joints and nails). Each is 96 px = 12.48 m at ROCK_MPP (0.13 m a pixel, the same grid the path layer's edges are cut to,
# so the tile and the stair-stepped outline share pixels). Fully opaque, used as the #pt-<kind> patterns (index.html) behind the path chunks (pathart.js). Everything is
# structured and rhythmic (rows of dashes, plank gaps) with no random scatter, light from the top left, a lit top-left row and a shaded bottom-right row on each slab or plank.
# Features wrap over the edges. Usage: python3 -I tools/pixelpath_flat.py [outdir]
import sys, os
from PIL import Image

def hexc(h): return tuple(int(h[i:i+2], 16) for i in (1, 3, 5))
def mix(a, b, t): return tuple(round(x * (1 - t) + y * t) for x, y in zip(a, b))
WHITE, BLACK = (255, 255, 255), (0, 0, 0)
N = 96

def hsh(a, b): return ((a * 73856093) ^ (b * 19349663) ^ 0x5bd1e995) * 2654435761 >> 7 & 0xffff

def guest():
    BASE = hexc("#C9BFA8")   # PATH_CELLS.kinds.g.color: plain poured concrete, no slabs or joints
    dash = mix(BASE, BLACK, .08); lite = mix(BASE, WHITE, .07)
    px = {(x, y): BASE for x in range(N) for y in range(N)}
    for r in range(N // 8):   # faint trowel dashes on a fixed lattice, a darker run and a lighter one in alternate rows
        for k in range(3):
            x = (r * 11 + k * 32 + 4) % N; y = r * 8 + 3
            for i in range(5): px[((x + i) % N, y)] = dash if (r + k) % 2 else lite
    return px

def staff():
    BASE = hexc("#5A5F64")   # PATH_CELLS.kinds.s.color
    dark = mix(BASE, BLACK, .2); lite = mix(BASE, WHITE, .12); peb = mix(BASE, WHITE, .3); pebs = mix(BASE, BLACK, .32); seam = mix(BASE, BLACK, .3); seamlit = mix(BASE, WHITE, .1)
    px = {(x, y): BASE for x in range(N) for y in range(N)}
    for r in range(N // 4):   # rows of short gravel dashes every 4 px, the dash lengths and offsets repeating in a fixed rhythm
        y = r * 4 + 1
        for k in range(3):
            x = (r * 13 + k * 32 + (r % 3) * 5) % N; n = (4, 6, 5)[(r + k) % 3]
            for i in range(n): px[((x + i) % N, y)] = dark if (r + k) % 2 else lite
    for r in range(N // 12):   # pebbles on a lattice: a lit pixel with a dark one under and to the right
        for k in range(4):
            x = (r * 7 + k * 24 + 5) % N; y = r * 12 + 7 + (k % 2) * 4
            px[(x, y)] = peb; px[(x + 1, y)] = peb; px[(x + 1, y + 1)] = pebs; px[(x + 2, y + 1)] = pebs
    for P in (0, 48):   # pour seams: a dashed dark line with a lit pixel row beside it, horizontal and vertical, every 6.2 m
        for i in range(N):
            if i % 8 < 6:
                px[(i, P)] = seam; px[(i, (P + 1) % N)] = seamlit
                px[(P, i)] = seam; px[((P + 1) % N, i)] = seamlit
    return px

def bridge():
    BASE = hexc("#A9825A")   # PATH_CELLS.kinds.b.color
    tones = [BASE, mix(BASE, WHITE, .1), mix(BASE, BLACK, .09)]
    gap = mix(BASE, BLACK, .55); lit = mix(BASE, WHITE, .24); shade = mix(BASE, BLACK, .2); grain = mix(BASE, BLACK, .16); nail = mix(BASE, BLACK, .45)
    px = {}
    PH = 6; L = 48   # a plank is 0.78 m wide and 6.2 m long, laid across; the butt joints step along each row
    for row in range(N // PH):
        y0 = row * PH; start = (row * 19) % L
        for seg in range(N // L):
            x0 = (start + seg * L) % N; t = tones[hsh(row, seg) % 3]
            for y in range(PH):
                for x in range(L):
                    c = t
                    if y == PH - 1: c = gap                  # the gap between planks
                    elif y == PH - 2: c = shade
                    elif y == 0: c = lit
                    if x == L - 1: c = gap                   # the butt joint
                    px[((x0 + x) % N, (y0 + y) % N)] = c
            for i in range(7): px[((x0 + 10 + i) % N, (y0 + 2) % N)] = grain
            for i in range(5): px[((x0 + 30 + i) % N, (y0 + 3) % N)] = grain
            for nx in (3, L - 5):   # nails near the ends
                px[((x0 + nx) % N, (y0 + 2) % N)] = nail
    return px

def save(px, path):
    im = Image.new("RGB", (N, N))
    for (x, y), c in px.items(): im.putpixel((x % N, y % N), c)
    im.save(path)

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "sprites", "path")
    os.makedirs(out, exist_ok=True)
    for name, f in (("guest", guest), ("staff", staff), ("bridge", bridge)): save(f(), os.path.join(out, name + ".png"))
    print("wrote", out)
