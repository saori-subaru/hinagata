# A generated or scanned painting of a part's template (tools/picture.mjs) → the part's drawn picture (outfit.jacket.picture.src).
#   python tools/picture-fit.py <painting> <template.png (clear round the part)> <out.png> [colors=64]
# The painting is fitted to the template's size; its outline and paper are left out (6 px in from the template's outline: stretched over the
# sides they showed as dark streaks) and the inside's colors spread out to 5 px past it (the picture is read between pixels).
import sys, os
import numpy as np
from PIL import Image, ImageFilter
src, tpl, out = sys.argv[1:4]; colors = int(sys.argv[4]) if len(sys.argv) > 4 else 64
T = Image.open(tpl).convert("RGBA")
g = np.asarray(Image.open(src).convert("RGB").resize(T.size, Image.LANCZOS)).astype(np.float32)
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
im.quantize(colors, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(out, optimize=True)
print(out, os.path.getsize(out))
