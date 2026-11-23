# A generated or scanned painting of a part's template (tools/picture.mjs) → the part's drawn picture (outfit.jacket.picture.src).
#   python tools/picture-fit.py <painting> <template.png (clear round the part)> <out.png> [colors=64] [views=-]
#   colors 0: all colors (soft shading in dark cloth bands into hard lines at 64)
#   views h | v: the painting's front and back views side by side (h) or stacked (v), each fitted by its bounding box onto the template's
#   view (an image AI keeps neither the template's proportions nor its layout); -: the painting is the template's size as it is
# The painting is fitted to the template's size; its outline and paper are left out (6 px in from the template's outline: stretched over the
# sides they showed as dark streaks) and the inside's colors spread out to 5 px past it (the picture is read between pixels).
import sys, os
import numpy as np
from PIL import Image, ImageChops, ImageFilter
src, tpl, out = sys.argv[1:4]; colors = int(sys.argv[4]) if len(sys.argv) > 4 else 64; views = sys.argv[5] if len(sys.argv) > 5 else "-"
T = Image.open(tpl).convert("RGBA")
P = Image.open(src).convert("RGB")
if views in ("h", "v"):   # (the template's side column, if any, is left blank: a side view is fitted by hand)
    ink = lambda im: ImageChops.difference(im, Image.new("RGB", im.size, "white")).convert("L").point(lambda v: 255 if v > 40 else 0).getbbox()
    tw, th = T.size; pw, ph = P.size; fit = Image.new("RGB", T.size, "white")
    pv = [P.crop((0, 0, pw // 2, ph)), P.crop((pw // 2, 0, pw, ph))] if views == "h" else [P.crop((0, 0, pw, ph // 2)), P.crop((0, ph // 2, pw, ph))]
    for i in range(2):
        tb, pb = T.crop((0, i * th // 2, tw, (i + 1) * th // 2)).getchannel("A").getbbox(), ink(pv[i])
        fit.paste(pv[i].crop(pb).resize((tb[2] - tb[0], tb[3] - tb[1]), Image.LANCZOS), (tb[0], tb[1] + i * th // 2))
    P = fit
g = np.asarray(P.resize(T.size, Image.LANCZOS)).astype(np.float32)
A = T.getchannel("A").point(lambda v: 255 if v > 127 else 0)
ero = np.asarray(A.filter(ImageFilter.MinFilter(13))) > 0
dil = np.asarray(A.filter(ImageFilter.MaxFilter(11))) > 0
known = ero & (g.min(axis=2) < 200); col = np.where(known[..., None], g, 0)
for _ in range(16):
    s = np.zeros_like(col); n = np.zeros(known.shape, np.float32)
    for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        s += np.roll(col * known[..., None], (dy, dx), (0, 1)); n += np.roll(known, (dy, dx), (0, 1))
    new = (~known) & (n > 0); col[new] = s[new] / n[new][:, None]; known = known | new
im = Image.fromarray(np.dstack([col, np.where(dil & known, 255, 0)]).astype(np.uint8), "RGBA")
(im.quantize(colors, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE) if colors else im).save(out, optimize=True)
print(out, os.path.getsize(out))
