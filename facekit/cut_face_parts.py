"""Cut the face parts (eye, brow, mouth) out of a drawn template, ready to use as textures.

Usage:
    pip install pillow psd-tools
    python3 cut_face_parts.py face-template.psd -o ../img/parts    # from a layered PSD
    python3 cut_face_parts.py my-face.png -o out                    # from a single flat image (e.g. made by an image AI)

From a PSD:
    Takes the layers named eye / brow / mouth (目 / 眉 / 口 also work).
From a flat image:
    Crops each frame from face-layout.json and makes the background transparent: every pixel connected
    to the frame border whose color is close to the border color is removed. Works best on a solid
    green background (face-template-ai.png). White or skin-colored backgrounds also work, but light
    parts touching the background (eye whites, soft shadows) can get eaten.
    The image must use the template's layout (1024x768 or the same aspect ratio).

Output:
    eye.png / brow.png / mouth.png, each the size of its frame (image center = frame center).
    Eye and brow come from the frame on the RIGHT side of the image (the character's left).
    The other side is mirrored automatically when applied.
"""
import argparse
import json
from collections import deque
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
LAYOUT = json.loads((HERE / "face-layout.json").read_text(encoding="utf-8"))
W, H = LAYOUT["canvas"]
NAMES = {"eye": ["eye", "目"], "brow": ["brow", "眉"], "mouth": ["mouth", "口"]}


def frame(part):
    (cx, cy), (bw, bh) = LAYOUT["parts"][part]["center"], LAYOUT["parts"][part]["size"]
    return cx - bw // 2, cy - bh // 2, cx - bw // 2 + bw, cy - bh // 2 + bh


def from_psd(path):
    from psd_tools import PSDImage
    psd = PSDImage.open(path)
    if psd.size != (W, H):
        raise SystemExit(f"The PSD is {psd.size}. It must be {W}x{H}, the same as the template.")
    out = {}
    for layer in psd.descendants():
        if layer.is_group():
            continue
        for part, names in NAMES.items():
            if layer.name.strip().lower() in names and part not in out:
                canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
                img = layer.composite()
                if img is not None:
                    canvas.alpha_composite(img.convert("RGBA"), (layer.left, layer.top))
                out[part] = canvas.crop(frame(part))
    missing = [p for p in NAMES if p not in out]
    if missing:
        print("Layers not found:", ", ".join(missing), "(name them eye / brow / mouth)")
    return out


def remove_background(img, tol=48):
    """Make the background transparent: flood-fill from the border over pixels close to the border color.
    Edge pixels get partial alpha, and a green background's color spill is removed from them."""
    px = img.load()
    w, h = img.size
    border = [px[x, 0] for x in range(w)] + [px[x, h - 1] for x in range(w)] + [px[0, y] for y in range(h)] + [px[w - 1, y] for y in range(h)]
    bg = tuple(sorted(c[i] for c in border)[len(border) // 2] for i in range(3))   # median border color = background
    dist = lambda c: max(abs(c[0] - bg[0]), abs(c[1] - bg[1]), abs(c[2] - bg[2]))
    green = bg[1] > 150 and bg[1] - max(bg[0], bg[2]) > 80   # a green-screen background
    seen = bytearray(w * h)
    q = deque([(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)])
    while q:
        x, y = q.popleft()
        if seen[y * w + x] or dist(px[x, y]) > tol:
            continue
        seen[y * w + x] = 1
        r, g, b, a = px[x, y]
        px[x, y] = (r, g, b, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx]:
                q.append((nx, ny))
    for y in range(h):   # pixels next to the removed area: fade by how close they are to the background
        for x in range(w):
            if seen[y * w + x]:
                continue
            if any(0 <= nx < w and 0 <= ny < h and seen[ny * w + nx] for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1))):
                r, g, b, a = px[x, y]
                if green:
                    g = min(g, max(r, b))   # remove green spill
                px[x, y] = (r, g, b, min(a, round(255 * min(1, dist(px[x, y]) / (tol * 2.5)))))
    return img


def from_flat(path, tol):
    img = Image.open(path).convert("RGBA")
    if img.size != (W, H):
        if abs(img.width / img.height - W / H) > 0.01:
            print(f"Warning: aspect ratio differs from the template ({W}:{H}). Stretching {img.size} to {W}x{H}.")
        img = img.resize((W, H), Image.LANCZOS)
    has_alpha = img.getchannel("A").getextrema()[0] < 255
    return {p: (img.crop(frame(p)) if has_alpha else remove_background(img.crop(frame(p)), tol)) for p in NAMES}


def main():
    ap = argparse.ArgumentParser(description="Cut eye / brow / mouth out of a face template drawing")
    ap.add_argument("src", help="face-template.psd, or a flat image (png/jpg) drawn on the template layout")
    ap.add_argument("-o", "--out", default=".", help="output folder")
    ap.add_argument("--tol", type=int, default=48, help="flat images: how close to the background color counts as background (larger removes more)")
    a = ap.parse_args()
    parts = from_psd(a.src) if a.src.lower().endswith(".psd") else from_flat(a.src, a.tol)
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    for part, img in parts.items():
        img.save(out / f"{part}.png")
        print(f"{out / (part + '.png')}  {img.size[0]}x{img.size[1]}")


if __name__ == "__main__":
    main()
