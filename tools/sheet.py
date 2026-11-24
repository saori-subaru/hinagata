# A character beside its design sheet at the same scale, and their outlines in numbers (fitting by eye missed widths by centimetres).
#
#   python tools/sheet.py args  <height m> <feet y,top y>             the shot's range for tools/shot.mjs (--y … --w … --px …)
#   python tools/sheet.py compare <sheet.jpg> <shot.png> <feet y,top y> <front x[,side x]> [rows: from,to,step] [hue: lo,hi]
#
#   height: the character's (node tools/measure.mjs: to the top of the skull, without the hair). feet y, top y: the sheet's pixel rows of
#   the floor under the feet and of the top of the skull (the hair's top less its thickness). front x, side x: the pixel columns of the
#   middle of the sheet's front view and of its side view (the body's axis there).
#   Shoot with the args it prints and --views 0,90 (the front, her left side), then compare: writes <shot>-sheet.png (each sheet view beside
#   the shot's) and prints, for each height (a share of the character's height), the outline's left and right ends from the middle, as
#   shares of the height, sheet | shot. With hue (degrees: 55,75 = yellow-green) only pixels of that color count (one garment's outline).
import sys
import numpy as np
from PIL import Image

PX, PAD_TOP, PAD_FEET = 1022, 119, 20   # the shot's rows; rows above the skull's top and under the floor (the skull to the floor: 883 rows)
SPAN = PX - PAD_TOP - PAD_FEET
def args(height):
    p = SPAN / height; print(f"--y {-PAD_FEET / p:.4f},{(PX - PAD_FEET) / p:.4f} --w {280.5 / p:.4f} --px {PX} --pose aPose --views 0,90")
def mask(a, bg, hue):
    if hue is None: return np.abs(a.astype(int) - np.array(bg)).sum(2) > 36
    f = a.astype(float) / 255; mx, mn = f.max(2), f.min(2); d = mx - mn + 1e-9; r, g, b = f[..., 0], f[..., 1], f[..., 2]
    h = np.where(mx == r, (g - b) / d % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    return (h >= hue[0]) & (h <= hue[1]) & (d / (mx + 1e-9) > 0.25) & (mx > 0.35)
def compare(sheet_path, shot_path, rows, mids, span=(0.98, 0.02, 0.04), hue=None):
    sheet, shot = Image.open(sheet_path).convert("RGB"), Image.open(shot_path).convert("RGB")
    feet, top = rows; k = SPAN / (feet - top); S = sheet.resize((round(sheet.width * k), round(sheet.height * k)), Image.LANCZOS)   # the sheet at the shot's scale
    W = shot.width // 2; out = Image.new("RGB", (W * 2 * len(mids), PX), "white"); A, B = np.asarray(S), np.asarray(shot)
    ms, mo = mask(A, A[3, 3], hue), mask(B, B[3, 3], hue); y0 = round(feet * k) - (PX - PAD_FEET)   # the sheet's row at the shot's row 0
    for i, cx in enumerate(mids):
        x0 = round(cx * k) - W // 2; out.paste(S.crop((x0, y0, x0 + W, y0 + PX)), (2 * i * W, 0)); out.paste(shot.crop((i * W, 0, (i + 1) * W, PX)), ((2 * i + 1) * W, 0))
    name = shot_path.rsplit(".", 1)[0] + "-sheet.png"; out.save(name); print(name)
    def ends(m, y, x0, c):
        if y < 0 or y >= m.shape[0]: return "      -      "
        q = np.where(m[y, max(0, x0):x0 + W])[0]; return f"{(q.min() + max(0, x0) - c) / SPAN:+.3f} {(q.max() + max(0, x0) - c) / SPAN:+.3f}" if len(q) > 3 else "      -      "
    print("height   " + "   ".join(f"sheet {v}      shot {v}   " for v in ["front", "side"][:len(mids)]))
    h = span[0]
    while h >= span[1] - 1e-9:
        r = PX - PAD_FEET - round(h * SPAN)
        print(f"{h:.3f}   " + "   ".join(f"{ends(ms, r + y0, round(cx * k) - W // 2, round(cx * k))}  {ends(mo, r, i * W, i * W + W // 2)}" for i, cx in enumerate(mids))); h -= span[2]

if __name__ == "__main__":
    a = sys.argv[1:]; nums = lambda s: [float(v) for v in s.split(",")]
    if len(a) >= 2 and a[0] == "args": args(float(a[1]))
    elif len(a) >= 5 and a[0] == "compare": compare(a[1], a[2], nums(a[3]), nums(a[4]), tuple(nums(a[5])) if len(a) > 5 else (0.98, 0.02, 0.04), nums(a[6]) if len(a) > 6 else None)
    else: print(__doc__ or "usage: python tools/sheet.py args <height> | compare <sheet> <shot> <feet y,top y> <front x[,side x]> [from,to,step] [hue lo,hi]"); sys.exit(1)
