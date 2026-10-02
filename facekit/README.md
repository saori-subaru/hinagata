# Face parts kit

The avatar's face is made by placing eye, brow and mouth images on the head. This folder has the template to draw them on and a tool that cuts your drawing into ready-to-use part images.

## Files

| File | What it is |
|---|---|
| `face-template.psd` | Layered template (1024x768). Bottom to top: `3d-clay` (hidden) / `3d-skin` / `guide` / `mirror-preview` / `mouth` / `brow` / `eye` |
| `face-template.png` | Everything flattened (preview) |
| `face-template-blank.png` | 3D head + frames, no parts |
| `face-template-ai.png` | Frames and the face outline on a solid green background. Give this to an image AI |
| `face-layout.json` | Frame positions and sizes. The source of truth; everything else follows it |
| `cut_face_parts.py` | Cuts `eye.png` / `brow.png` / `mouth.png` out of your drawing |
| `build_face_template.py` | Rebuilds the template (after changing frames or the 3D shots) |
| `3d-skin.png` / `3d-clay.png` | The head shot used as the bottom layers |

## Rules

- 1 px on the template = 1 px on the face. Don't scale.
- Draw the eye and brow **only in the frame on the right side of the image** (the character's left). The other side is mirrored automatically.
- Draw the mouth in the center frame.
- Keep each part inside its frame. The frame center is where the part sits on the face.
- Background: transparent (PSD layers or a transparent PNG). Only if that's impossible, use one solid color; solid green works best.

## Drawing

### In a painting app

1. Open `face-template.psd` (Photoshop, CLIP STUDIO PAINT, Krita, Photopea, ...).
2. Draw on the `eye` / `brow` / `mouth` layers (replace what's there). Keep the layer names.
3. Save as PSD and cut:

```sh
pip install pillow psd-tools
python3 cut_face_parts.py face-template.psd -o ../img/parts
```

This is exact: what's on each layer is what you get.

### As a transparent PNG

Any 1024x768 PNG with a transparent background, drawn on the template layout, is cut as-is (no background removal):

```sh
python3 cut_face_parts.py my-face.png -o ../img/parts
```

If your image AI can output transparent PNGs, ask for that and use this.

### With an image AI that can't do transparency

Give it `face-template-ai.png` and ask for the same layout. Example prompt:

> Using this exact 1024x768 layout, draw anime-style facial parts on the solid green (#00FF00) background: one eye inside the "eye - draw here" frame, one eyebrow inside the "brow - draw here" frame, and a mouth inside the "mouth" frame. Keep every part fully inside its frame. Leave the dashed frames empty. Do not draw the frames, labels, face outline or center line. Keep the background pure flat green with no shading.

Then cut (the background is removed automatically):

```sh
python3 cut_face_parts.py my-face.png -o ../img/parts
```

If some background remains, raise `--tol`; if parts of the drawing disappear, lower it (default 48).

On a green background nothing in the drawing gets lost. On a white or skin-colored background, light areas that touch the background (eye whites, soft shadows) can be eaten. If that happens, fix the part by hand: paste it into the PSD's layer, touch it up, and cut from the PSD.

## Changing the frames

Edit `face-layout.json` and run `python3 build_face_template.py`. Also update the anchors in `body.html` (`EYE` / `BROW` / `MOUTHP` and `PART_IMG`) to match. To reshoot the 3D layers, open `body.html` in a browser and call `sotaiFaceSheet("skin")` / `sotaiFaceSheet("clay")`; the returned `url` is the image.
