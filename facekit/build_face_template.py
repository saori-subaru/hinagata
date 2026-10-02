"""Build the face drawing template (face-template.psd and the preview PNGs).

Usage:
    pip install pillow psd-tools
    python3 build_face_template.py

Inputs (this folder):
    3d-skin.png / 3d-clay.png   the head shot straight from the front, in face-texture coordinates
                                (made with sotaiFaceSheet() in body.html)
    face-layout.json            where each part's frame is
    ../img/parts/*.png          the current part images (eye / brow / mouth)
Outputs:
    face-template.psd           layered template. Bottom to top:
                                3d-clay, 3d-skin, guide, mirror-preview, mouth, brow, eye
    face-template.png           everything flattened (preview)
    face-template-blank.png     3D + frames, no parts
    face-template-ai.png        frames and the face outline on a solid green background,
                                for image-generation AI (green is easy to key out cleanly)
"""
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps
from psd_tools import PSDImage
from psd_tools.api.layers import PixelLayer

HERE = Path(__file__).resolve().parent
PARTS_DIR = HERE.parent / "img" / "parts"
LAYOUT = json.loads((HERE / "face-layout.json").read_text(encoding="utf-8"))
W, H = LAYOUT["canvas"]
COLORS = {"eye": (40, 110, 230), "brow": (30, 160, 80), "mouth": (220, 60, 80)}
GREEN = (0, 255, 0)


def font(size):
    for path in ["DejaVuSans.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "Arial.ttf"]:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            pass
    return ImageFont.load_default()


def box(part, mirrored=False):
    """(left, top, right, bottom) of a part's frame. mirrored = flipped across the face center line"""
    (cx, cy), (bw, bh) = LAYOUT["parts"][part]["center"], LAYOUT["parts"][part]["size"]
    if mirrored:
        cx = W - cx
    return cx - bw // 2, cy - bh // 2, cx - bw // 2 + bw, cy - bh // 2 + bh


def guide_layer(on_green=False):
    """Frames, center ticks and labels. Lines are drawn just outside the frames so they never end up in a cut-out part."""
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    f = font(18)
    line_col = (40, 40, 40, 200) if on_green else (120, 120, 120, 160)
    inside = lambda y: any(box(p)[1] - 4 <= y <= box(p)[3] + 4 and box(p)[0] <= W // 2 <= box(p)[2] for p in LAYOUT["parts"])
    for y in range(0, H, 16):   # face center line (dashed), skipped inside frames
        if not inside(y) and not inside(y + 8):
            d.line([(W // 2, y), (W // 2, y + 8)], fill=line_col, width=1)
    for part, info in LAYOUT["parts"].items():
        c = (20, 20, 20) if on_green else COLORS[part]
        l, t, r, b = box(part)
        d.rectangle([l - 3, t - 3, r + 2, b + 2], outline=c + (230,), width=2)
        cx, cy = info["center"]
        for (x0, y0, x1, y1) in [(cx, b + 3, cx, b + 13), (l - 14, cy, l - 4, cy), (r + 3, cy, r + 13, cy)]:
            d.line([(x0, y0), (x1, y1)], fill=c + (230,), width=2)   # center ticks (outside the frame; none on top, the label is there)
        d.text((l, t - 26), part + ("  - draw here" if info["mirror"] else ""), fill=c + (255,), font=f)
        if info["mirror"]:   # the other side is mirrored automatically: dashed frame only
            ml, mt, mr, mb = box(part, mirrored=True)
            for x in range(ml - 3, mr + 3, 12):
                d.line([(x, mt - 3), (min(x + 6, mr + 2), mt - 3)], fill=c + (150,), width=2)
                d.line([(x, mb + 2), (min(x + 6, mr + 2), mb + 2)], fill=c + (150,), width=2)
            for y in range(mt - 3, mb + 3, 12):
                d.line([(ml - 3, y), (ml - 3, min(y + 6, mb + 2))], fill=c + (150,), width=2)
                d.line([(mr + 2, y), (mr + 2, min(y + 6, mb + 2))], fill=c + (150,), width=2)
            d.text((ml, mt - 26), "mirrored (auto)", fill=c + (200,), font=f)
    return img


def part_layer(part):
    """The current part image centered in its frame, on a full-size transparent canvas"""
    src = Image.open(PARTS_DIR / f"{part}.png").convert("RGBA")
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    cx, cy = LAYOUT["parts"][part]["center"]
    img.alpha_composite(src, (round(cx - src.width / 2), round(cy - src.height / 2)))
    return img


def outline_from(shot):
    """The dark outline of the head from the 3D shot, as a thin gray line"""
    gray = shot.convert("L")
    mask = gray.point(lambda v: 255 if v < 90 else 0)
    line = Image.new("RGBA", (W, H), (60, 60, 60, 255))
    line.putalpha(mask)
    return line


def main():
    base_skin = Image.open(HERE / "3d-skin.png").convert("RGBA")
    base_clay = Image.open(HERE / "3d-clay.png").convert("RGBA")
    guide = guide_layer()
    parts = {p: part_layer(p) for p in ["mouth", "brow", "eye"]}
    mirror = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for p in ["eye", "brow"]:
        mirror.alpha_composite(ImageOps.mirror(parts[p]))
    mirror.putalpha(mirror.getchannel("A").point(lambda a: a * 55 // 100))   # reference only, so faint

    psd = PSDImage.new(mode="RGBA", size=(W, H))
    layers = [("3d-clay", base_clay, False), ("3d-skin", base_skin, True), ("guide", guide, True), ("mirror-preview", mirror, True)]
    layers += [(p, parts[p], True) for p in ["mouth", "brow", "eye"]]
    for name, img, visible in layers:   # bottom to top
        bbox = img.getbbox() or (0, 0, 1, 1)
        layer = PixelLayer.frompil(img.crop(bbox), psd, name, bbox[1], bbox[0])
        layer.visible = visible
        psd.append(layer)
    psd.save(HERE / "face-template.psd")

    flat = base_skin.copy()
    flat.alpha_composite(guide)
    flat.convert("RGB").save(HERE / "face-template-blank.png")
    flat.alpha_composite(mirror)
    for p in ["mouth", "brow", "eye"]:
        flat.alpha_composite(parts[p])
    flat.convert("RGB").save(HERE / "face-template.png")

    ai = Image.new("RGBA", (W, H), GREEN + (255,))
    ai.alpha_composite(outline_from(base_skin))
    ai.alpha_composite(guide_layer(on_green=True))
    ai.convert("RGB").save(HERE / "face-template-ai.png")
    print("wrote face-template.psd / face-template.png / face-template-blank.png / face-template-ai.png")


if __name__ == "__main__":
    main()
