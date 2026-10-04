# Hinagata

A chibi avatar engine for the browser, built on three.js.

- A character is a **recipe**: a small options object (JSON), not a mesh file. The body, clothes, hair and face are built from code at runtime.
- **Motions are code and fit the body**: walk (with the stride measured from the legs), jump, fall, climb with IK onto any surface the game describes.
- Comes with an **editor** (`editor/`) for making characters, and a test page (`body.html`).
- Online: **https://hinagata.pages.dev** (the editor) and https://hinagata.pages.dev/body.html (the test page), deployed on every push to `main` (`.github/workflows/site.yml`, files picked by `build_site.sh`).

```js
import { createAvatar } from "./src/index.js";   // needs an import map for "three"
const avatar = await createAvatar(recipe);
scene.add(avatar.object);
avatar.play("walk");
// every frame
avatar.update(dt);
```

Design notes, API and decisions: [`DESIGN.md`](DESIGN.md).

Used by: the saon site (`saori-subaru/devlog`, as a git submodule at `site/avatar/`) and the forest game.

Private for now; the license is not decided yet.
