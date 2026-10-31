"""Guest gear: hats, umbrellas and backpacks pinned onto the guest sprites (GUEST_GEAR in data.js), and park jackets recolored into each guest kind's strips.
A gear picture is drawn facing right like the guests, at the same 0.13 m a pixel. Its anchor (ax, ay in GUEST_GEAR) is the pixel that lands on the body's point:
head = top middle of the head, hand = the front hand, back = the top of the back. Run from the repo root; pass a path to also save a preview sheet."""
import sys
from PIL import Image
from genesis_style import PAL, image, sheet

OUT = "sprites/human/gear/"
PAL.update({
  "1":(214,92,74), "2":(189,72,58), "3":(140,50,42), "p":(231,221,195),            # beanie: red knit, cream pom
  "4":(96,160,84), "5":(63,124,69), "6":(43,84,45),                                # T-Rex cap: greens
  "7":(196,150,88), "8":(165,125,74), "9":(110,85,49),                             # Sabertooth cap: tans
  "O":(66,53,29), "Y":(222,182,72), "q":(240,228,170),                             # umbrella shaft, yellow panels, their light
  "j":(150,160,104), "J":(116,126,80), "o":(176,96,52),                            # Triceratops pack: green-grey, frill
  "R":(206,98,58), "K":(160,70,44), "N":(110,46,32),                               # Dimetrodon pack: orange, sail, dark
})

GEAR = {
  # head anchor at (3, 2): the head's top middle sits under the crown
  "beanie": ["...pp...",
             "..1122..",
             ".112222.",
             "11222222",
             "23232323",
             "32323232"],
  # anchor (3, 1); brim sticks out forward over the face, teeth hang under it
  "cap-trex": [".44455....",
               "44Y55555..",
               "4555555...",
               "6666666555",
               ".......w.w"],
  "cap-sabre": [".7.8.8....",
                "7788888...",
                "7898989...",
                "9999999888",
                ".......w.w",
                ".......w.w"],
  # hand anchor at (6, 21), just under the shaft
  "umbrella": ["......O......",
               "....qqYqq....",
               "..qYYY5YYYq..",
               ".YYY555555YY.",
               "YY55555555555",
               "6.6.6.6.6.6.6",
               "......O......",
               "......O......",
               "......O......",
               "......O......",
               "......O......",
               "......O......",
               "......O......",
               "......O......",
               "......O......",
               "......O......",
               "......O......",
               "......O......",
               "......O......",
               "......O......",
               "......O......"],
  # back anchor at (2, 2): the pack overlaps the back by two pixels and its strap runs over the shoulder
  "pack-tri": ["..w...",
               ".ooo..",
               "oojoo.",
               "jjjJJJ",
               "jjjJ..",
               "jjJJ..",
               "jjJJ..",
               ".JJ..."],
  "pack-dime": [".K.K..",
                ".KNKN.",
                "RRRRK.",
                "RRRRNN",
                "RRRK..",
                "RRRK..",
                "RRKK..",
                ".KK..."],
}
for row in GEAR["pack-tri"] + GEAR["pack-dime"]: assert len(row) == 6, row

# Jackets: each kind's shirt colors (darkest first) become the park jacket's greens, and bare arms above the hand become sleeves
JACKET = [(43,84,45), (48,94,50), (63,124,69)]
LOGO = (222,182,72)
JACKET_SET = {c + (255,) for c in JACKET}
KINDS = {
  "guest":  {"shirt":[(190,53,169), (194,51,167), (212,106,198)], "skin":[(221,182,157)]},
  "guest2": {"shirt":[(154,34,34), (180,40,40)], "skin":[(70,44,20)]},
  "guest3": {"shirt":[(52,156,136), (60,178,156)], "skin":[(158,113,62)]},
  "guest4": {"shirt":[(122,20,151), (133,22,164)], "skin":[(225,191,168), (221,183,157), (209,159,124)]},
  "guest5": {"shirt":[(25,25,23), (33,33,32)], "skin":[(229,193,161)]},
}

def jacket(src, k):
  im = Image.open(src).convert("RGBA"); p = im.load(); K = KINDS[k]
  shirt = {c + (255,): JACKET[min(2, i + (3 - len(K["shirt"])))] for i, c in enumerate(K["shirt"])}
  skin = {c + (255,) for c in K["skin"]}
  mid = JACKET[1] + (255,)
  tops = [next(y for y in range(32) if any(p[x, y][3] for x in range(f * 16, f * 16 + 16))) for f in range(im.width // 16)]
  for f in range(im.width // 16):
    x0, t = f * 16, 17 + tops[f] - tops[0]                                                # first shirt row, moved by the walk's bob
    for y in range(t, t + 7):
      for x in range(x0, x0 + 16):
        c = p[x, y]
        if c in shirt: p[x, y] = shirt[c]
        elif c in skin:
          below = p[x, y + 1] if y + 1 < 32 else (0, 0, 0, 0)
          above = p[x, y - 1]
          if below in skin and y + 1 < t + 7: p[x, y] = mid                           # sleeve; the lowest skin pixel stays as the hand
          elif above in JACKET_SET and x - x0 >= 5: p[x, y] = mid                     # bare midriff under the shirt
    p[x0 + 9, t + 2] = LOGO + (255,)
  return im

if __name__ == "__main__":
  ims = []
  for name, g in GEAR.items():
    im = image(g); im.save(OUT + name + ".png"); ims.append(im)
  for k in KINDS:
    for s in ("walk", "wait"):
      im = jacket(f"sprites/human/{k}-{s}.png", k); im.save(f"sprites/human/{k}-jacket-{s}.png"); ims.append(im)
  if len(sys.argv) > 1: sheet(ims, 6, sys.argv[1])
