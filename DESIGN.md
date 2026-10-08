# Avatar library — design (draft)

Goal: turn `body.html` (one 800-line page: sculpt + clothes + hair + face + motion + UI) into a small library that a person — or an AI coding agent — can call with one line, plus a playground page built on top of it.

```js
import { createAvatar } from "./src/index.js";
const avatar = await createAvatar({ hair: { back: "short" }, outfit: { shoes: { color: "#c8564b" } } });
scene.add(avatar.object);
avatar.play("walk");
// each frame: avatar.update(dt)
```

## Principles

- **Plain ES modules, no build step.** Works from a CDN import map and from npm. `three` (>= 0.160) is a peer dependency.
- **Options are plain JSON.** Everything that defines a character is one serializable object. The playground can copy it as code, save it, and load it back; an agent can read and write it.
- **Every option has a default.** `createAvatar()` with no arguments gives today's character.
- **Async from day one.** `createAvatar` returns a Promise, so generation can move to a Web Worker later without changing the API.
- **Cheap changes stay cheap.** Colors, face parts and motion never regenerate geometry. Only shape, hair and clothing geometry do.

## Folder layout

```
site/avatar/
  src/
    index.js            createAvatar, defaults, presets (public entry)
    options.js          defaults, deep merge, validation against the schema
    sdf/
      prim.js           smin, E (ellipsoid), C (capsule), G (group), cut, plane, dPrim
      blend.js          blend, blendFast (spatial culling)
      mesh.js           surface nets, grad4, body distance grid reuse
    rig.js              joints, bones, skeleton, skin weights
    body/
      parts.js          builds the body part list from options.body (today's P / CUT / BODY_LIST)
      head.js           skull, nose, ears, eye sockets, temple / cheek displacement
      limbs.js          arms, legs, hands, feet
    clothes/            shirt.js, pants.js, socks.js, shoes.js (each: sdf from options + body)
    hair/               index.js (bangs / back / ahoge system), presets.js
    face/
      layer.js          face texture layer (front-projected head mesh), shading normals
      draw.js           code-drawn parts (round eyes, brows, mouths, ...)
      images.js         image parts (eye / brow / mouth PNGs, facekit layout)
    motion/             index.js (pose player, blending), presets.js (idle, walk, wave, sit, ...)
                        ik.js (two-bone IK), climb.js (climb / jump / fall poses, the climbing gait, body and stride measures)
    materials.js        toon ramp, outline, clay
    export.js           GLB export (A-pose, outlines off)
  presets/              JSON files: bodies, hairstyles, faces, outfits (templates for agents)
  editor/               the full editor (a): index.html + src/ (app, store, viewport, panel, i18n; imports ../src/)
  tools/
    shoot.mjs           render front / side / 3-4 / back PNGs from options (for agents to check their work)
  facekit/              (as now)
  docs/
    AGENTS.md           how to use and extend, for coding agents
    options.schema.json every option: type, range, default, names, rebuild cost (written by tools/schema.mjs)
  examples/             copy-paste examples (one character, a crowd of NPCs, walking, export)
```

## API

```ts
createAvatar(options?: AvatarOptions, settings?: { quality?: "game" | "lite" | "high" | "low", cell?: number, simplify?: number, cache?: boolean, cull?: boolean, onProgress?: (p: number) => void }): Promise<Avatar>

interface Avatar {
  object: THREE.Group          // add to your scene; contains the skinned meshes and the skeleton
  options: AvatarOptions       // fully resolved options (defaults filled in)
  bones: Record<BoneName, THREE.Bone>
  update(dt: number): void     // advance motion and blinking
  play(motion: string, opts?: { fade?: number }): void
  setColors(c: { skin?, hair?, eyes?, shirt?, pants?, socks?, shoes?, soles? }): void   // instant
  setWorn(w: { shirt?: boolean, pants?: boolean, socks?: boolean, shoes?: boolean }): void   // instant
  setOutline(o: { on?: boolean, width?: number, color?: string }): void   // instant
  setShading(style: "toon" | "smooth" | "flat" | { style?, bands?: 2 | 3, soften?: number }): void   // instant (soften re-smooths the shading normals, ~0.15 s)
  setFace(face: string | { eyes?, brows?, mouth?, cheeks?, nose? }): void   // instant: an expression id, or part ids by slot
  setFaceLayout(l: { eyeX?, eyeY?, eyeSize?, browX?, browY?, mouthY? }): void   // instant
  setBlush(b: { cheeks?, nose? }): void   // instant
  setHair(pick: { bangs?, back?, ahoge? }): void   // rebuilds the hair only
  rebuild(options: Partial<AvatarOptions>): Promise<void>  // (not yet) regenerates only what changed
  exportGLB(): Promise<ArrayBuffer>
  dispose(): void
}
```

**`avatar.options` is the recipe** (2026-10-02): every instant change above is written back into it, so saving or copying `avatar.options` (or `diff(DEFAULTS, avatar.options)`, only what differs) always gives back the character on screen. `resolveOptions` returns a fresh copy, so an avatar never changes `DEFAULTS` or the caller's object. One exception: `face.layout.eyeX / eyeY` also place the eye sockets in the head's shape, which only follows on the next build.

## Options

Two tiers, so the common knobs stay short and the sculpt details stay out of the way.

**Public** (documented with ranges, shown as sliders in the playground):

```jsonc
{
  "colors": { "skin": "#ffe0c8", "hair": "#6a4a30", "eyes": "#4f6a9a" },
  "outline": { "on": true, "width": 1, "color": "#3a2a3a" },   // art style: some games want no outline. avatar.setOutline() changes it instantly
  "shading": { "style": "toon", "bands": 2, "soften": 1 },   // "toon" (2 flat bands: light / shadow; bands: 3 adds a mid tone) | "smooth" (soft light falloff) | "flat" (no lighting). avatar.setShading() changes it instantly
  "face": {
    "parts": { "eyes": "round", "brows": "normal", "mouth": "smile", "cheeks": "none", "nose": null },   // ids in PART_LABELS (with ja / en names); "image" = a drawn part. nose null = follow noseShadow.on
    "images": { "eye": { "src": null }, "brow": { "src": null }, "mouth": { "src": null } },   // drawn parts (null = the bundled img/parts/*.png)
    "layout": { "eyeX": 0.096, "eyeY": 0.998, "browX": 0.088, "browY": 1.092, "mouthY": 0.896 }, "eyeSize": 1.25
  },   // expressions (EXPRESSIONS: normal, happy, sleeping, surprised, glare, ...) are presets of parts: avatar.setFace("happy")
  "hair": { "bangs": "none", "back": "short", "ahoge": false },
  "outfit": {
    "shirt": { "on": true, "color": "#7fb6e8", "sleeve": "short", "length": "tuck" },   // on: worn or not (avatar.setWorn)
    "pants": { "on": true, "color": "#5a4f7a", "length": "shorts", "hem": 0.3 },
    "socks": { "on": true, "color": "#f7f3ea", "top": 0.15 },
    "shoes": { "on": true, "color": "#c8564b", "soleColor": "#f4f1ea" }
  },
  "body": { "headSize": 1, "chubby": 0, "legLength": 1, "shoulderDrop": 0.008 }   // a few broad sliders (new)
}
```

**Advanced** (`body.sculpt`, `outfit.*.sculpt`): today's ~130 tuning values, renamed into nested, readable keys. For example:

| today (URL) | advanced key |
|---|---|
| `nz` | `body.sculpt.nose.tipZ` |
| `eta`, `etc` | `body.sculpt.ears.trimAngle`, `body.sculpt.ears.trimDepth` |
| `kix`, `kiy`, `kih` | `body.sculpt.knee.inner.depth / y / height` |
| `cy`, `ctl`, `cbw`, `cfr` | `outfit.shirt.sculpt.collar.y / tilt / bowl / front` |

Renaming also fixes two collisions in the current URL names (`cbw` and `cfw` each mean two different things).

The playground keeps reading URL parameters, but as `?o=<options JSON>` for sharing, plus `?view=` / `?pose=` / `?t=` for checking.

## What regenerates what

| change | cost |
|---|---|
| colors, outline, shading, face parts, motion | instant (and the cache key ignores colors, the outline and the shading, so recolored characters reuse the same meshes) |
| hair style | hair only (~0.5 s) |
| outfit on/off, outfit shape | that garment only |
| body shape | body + clothes + hair (a few seconds) |

## Speed (2026-10-02)

Measured on the default character (browser, software GL, 4 cores; Node gives similar ratios).

| settings | first build | vertices drawn |
|---|---|---|
| `quality: "high"` (6.8 mm cells, the old default; the playground still uses it) | ~5.4 s | ~156,000 |
| `quality: "game"` (13.6 mm cells, **default**), one thread (`workers: false`) | ~1.2–1.7 s | ~34,000 |
| `"game"` with workers (**default**) | ~0.86 s (~1.2 s the very first time on a page: the workers load) | same |
| `quality: "fine"` (built as "high", thinned to 22%, with workers) | ~5 s (+ meshoptimizer's download the first time) | ~37,000 |
| `"game"` + `simplify: 0.4` (one thread) | ~1.9 s | ~14,000 |
| any of the above, second time (`cache`) | **~0.05 s** | same |

- **game quality**: building time is mostly grid sampling, so a coarser grid is the biggest lever. Only thin tips and cut edges (bang tips, hems, sock tops) get slightly rougher; the face parts are drawn into a texture and don't change.
- **workers** (`src/pool.js`, `src/worker.js`, `src/build.js`): the body and the hair are built at once, then the clothes (they read the body's grid). Each part's grid is sampled in slabs and its vertices are projected and weighted in slices, on 1–4 workers; the cheap steps in between run on the main thread. `surfaceNets` is split into the same steps (`sampleGrid → fixAmbiguous → extractVerts → projectVerts → quads`) and the part table is shared (`src/parts.js`), so the mesh is identical to a one-thread build (same `checksum()`). If workers can't start or a job doesn't answer in 15 s, everything falls back to the main thread.
- **cache**: built meshes (and which body vertices the clothes cover) go to IndexedDB under a key made of the resolved options (without colors, outline, shading and blush) and the source text of the generator modules (`src/cache.js`), so editing the sculpt code never returns a stale mesh. The newest 12 characters are kept.
- **the body's cell table** (`blendFast`): the list of parts that matter in each 4 cm cell is now built per cell on first use (a whole table cost ~0.25 s, paid again by every worker and by a cached build that never meshes).
- **cull**: body triangles deep (6 mm) inside a visible shirt, pants or shoes are left out of the body's index (about 4,000 at game quality). It follows each garment's `.m.visible`, so hiding a garment brings the body back. Socks are skipped (the leg is only ~2 mm inside).
- **simplify**: meshoptimizer after building. Simplifying the high-quality mesh to 1/10 (~15,000) looked the same as the original in a side-by-side check; it needs the extra package (since 2026-10-05 the workers' meshes are thinned after they come back, so the build stays on the workers).
- `avatar.TIMES` shows where a build spent its time (ms per step).

## Playground

**Status (2026-10-02): the full editor (a) v0.1 is `editor/index.html`** (plain modules in `editor/src/`: `app.js` wiring, `store.js` recipe + undo + saved characters, `viewport.js` 3D view, `panel.js` panels from the schema, `i18n.js` en / ja). What it does:
- Panels per tab (body / face / hair / outfit / look) generated from `src/schema.js`: main values in order, values that only matter in some cases hidden until then (`when`), the rest under a folded "Advanced" with a filter. Each value shows a reset dot when it differs from the default; sections say what a change rebuilds.
- Changes with an `apply` method happen at once; others rebuild the avatar when the slider is released (the cache makes repeats fast). Undo / redo for every change (Ctrl/⌘+Z, Ctrl/⌘+Shift+Z).
- Characters saved in the browser (new, duplicate, delete, rename); share link (`?o=`), recipe JSON save / open, copy as code (only what differs), PNG (transparent), GLB.
- View: camera buttons, clay / wireframe / bones / floor, background, motions with play / pause / speed, mesh quality (game / high).
- Motions (2026-10-05, Saori: "下に横並びだと動きが全部入らない" / "乗り越えるとかよじ登るとか…静止ポーズしか見えない"): the bar under the view has the everyday motions and the poses checked most (stand, walk, run, wave, cheer, guard, A / T-pose, the sitting ones, hugging the knees: one tap; a wide screen shows them all, in two rows if needed, a narrow one scrolls them) and, at its right end, "more", which opens the whole list in groups at the right edge (in the middle it hid the character; opening on the other side from its button was confusing). The list stays open while motions are picked from it; a press anywhere else closes it. The first group plays motions through with what they need (`editor/src/demos.js`): pull up onto a ledge, vault a box, climb a wall, crawl, jump, hang and move along an edge, glide under a leaf. Their poses (mantleReach…, vault, climb, crawl, jump*, hang, glide) are steps a game strings together — it times them, moves the body and puts the hands and feet on the ledge with IK — so picked one by one they stood frozen with the hands in the air. The demos do what the forest game (genseirin player.js / climbpose.js) does: the same steps, timings, paths and IK, its metres scaled to this character's height. Climbing and crawling play in place (as the walk does): the wall's grooves slide down instead.
- Not yet: dragging bang tufts, comparing two characters, `avatar.rebuild()` for partial rebuilds, a dark theme.

- 3D view on the left, panel on the right: Body / Face / Hair / Outfit / Motion.
- Panel generated from `options.schema.json` (public tier). An "Advanced" section shows sculpt values.
- Buttons: Copy as code (only the values that differ from the defaults), Save / Load JSON, Export GLB, Save PNG.
- "Generating…" indicator while geometry is rebuilt. Works on phones.
- Language: see "Languages" below (the editor opens in English, with a Japanese toggle).
- Developer drawer (collapsed): clay, wireframe, bones, compare with reference sheet, face sheet export.

### Editor features (2026-10-02, the list for (a); (b) takes a subset)

Engine: **yes** = the engine has it, the editor only needs UI; **part** = there, but not in the recipe or not a library API yet; **no** = not in the engine yet.

| area | features | engine |
|---|---|---|
| recipe | new from a preset; save in the browser (a list of characters); save / load JSON; share by URL (`?o=`); copy as code (only what differs); undo / redo of every change; reset a section / all; count of values that differ from the defaults; two recipes side by side | editor-side |
| export | GLB (A-pose, no outlines) | yes |
| | PNG (transparent, fixed views) | editor-side |
| | face part template (frames to draw in) and reading a framed PNG back | done (2026-10-04): `src/face/sheet.js`, used by the editor; `body.html` still has its own copy of the one-face template |
| | VRM | no |
| view | orbit camera, view buttons (front / side / back / 3-4 / face), background, floor and shadow, reference image overlay | editor-side |
| | shading (toon / smooth / flat), outline (on / width / color), clay, wireframe, bones, quality, vertex count and build time | yes |
| body | body type presets (5), torso (7), limb thickness (5), knee / foot spacing, head scale / width / depth, skin color, sculpt (~160 values, folded) | yes |
| | leg length, chubbiness (proportion sliders that move joints) | no |
| face | parts by slot (eyes 7, brows 6, mouth 6, nose 3, cheeks 2), expressions, layout (eye spacing / height / size, brows, mouth), eye color, soft blush, nose / jaw shadows, ear line / shade, eye-area depth, blinking | yes |
| | drawn parts read from a framed PNG | part (see export) |
| | naming an expression when reading a drawing (see "Face parts editor") | no |
| hair | bangs (5), back (4: short / bob / flip / long), ahoge (on / size / direction), color, strands and angel ring, volume and hairline sculpt | yes |
| | dragging bang tufts (the data is in the recipe) | done (2026-10-04): in the editor's Hair tab (`editor/src/bangs.js`) and `body.html`; the engine rebuilds only the bangs (`avatar.setBangs`, every `hair.sculpt.nendo.*` value) and says where a tip is (`avatar.bangTipAt`) |
| | ponytails, twin tails, swaying strands (spring bones) | no |
| outfit | worn or not (each garment), shirt sleeve (3) / length (3) / collar, pants length (3) / hem, socks height, shoes and soles, colors | yes |
| | skirts, frills, capes, hats | no |
| | cloth textures (below) | no |
| motion | poses (9), freeze at a time | yes |
| | play / pause, speed, scrub | editor-side |
| | play once, hit events, held items (`attach`) | no (see "Sword presets") |
| extras | knight / beast / mage presets, extra bones, spring bones | no |

Still missing in the engine before the editor: `avatar.rebuild()` (today a body change means a whole new `createAvatar`, ~1 s with the cache warm).

### Options schema (2026-10-02, done)

`src/schema.js` describes every option by path; `docs/options.schema.json` is written from it (`node tools/schema.mjs`; `--check` fails when it is out of date). Each entry: `type` (number / boolean / color / enum / image / json), `default`, `min` / `max` / `step`, enum `options`, `label` and `section` in ja / en, `group` (the editor's tab), `tier` (main = shown, advanced = folded), `cost` (instant / paint / hair / clothes / body), `apply` (the avatar method that applies it without a rebuild) and `alsoShapes`.
- It is built from DEFAULTS, so a new option is never missing: about 80 main values are described by hand (`MAIN` in `src/schema.js`); every other value (the sculpt tuning) gets an entry made from its default, with a guessed range marked `soft` and an English label from its key. To promote a value to the editor's main panels, add it to `MAIN`.
- `checkOptions(options)` lists unknown paths, wrong types, enum values that don't exist and numbers outside a described range. `createAvatar` prints them as a warning (typos used to be ignored silently).

### Cloth textures (2026-10-02, Saori; plan)

Clothes get pictures the way the face does. Three layers, bottom to top:
1. **Base color** (exists).
2. **Pattern**: stripes, checks, dots… drawn in the shader from the angle around the body and the height (like the hair strands), so no texture and no UVs.
3. **Drawn picture**: like the face template, the editor exports a front and a back template of each garment; the drawing is read back and projected from the front and the back. Logos and one-point marks go here too.

The garments have no UVs (surface nets); layers 2 and 3 are projections, so they don't need any. The hard part is the seam at the sides where the front and back pictures meet.

## Reference presets

Each preset exists to show agents **one mechanism**, so they can copy the pattern to new parts.

| preset | parts | mechanism it teaches |
|---|---|---|
| Casual (baseline) | short hair, T-shirt, shorts, socks, shoes | plain skinned meshes + walk / idle. The minimum to compare against |
| Knight | helmet or big hat, shoulder pads, sword or staff in hand | **rigid attachments**: a separate mesh added to a bone (`bones.head.add(hat)`), no skinning. Needs a gripping hand shape |
| Beast | animal ears, fluffy tail | **procedural secondary motion**: ears and tail on short bone chains, driven by sine waves (tail sways when idle, ears bounce when running) |
| Mage / Fencer | long hair or ponytail, cape or robe hem | **spring bones**: 2-3 bone chains that follow their parent with a lag (tiny spring math, no physics engine), plus sphere colliders so the cape doesn't go through the back and legs |

Order to build them: Casual (what exists today) → Knight (cheapest) → Beast → Mage (hardest: springs + collisions).

### Extension points the library needs for these

- **Extra bones**: presets can add bone chains under existing bones (ears, tail, hair, cape), and their meshes are weighted to them.
- **Attachments**: `avatar.attach(boneName, object3d, offset)` for rigid parts; the hand gets an optional grip shape.
- **Behaviors**: small per-part update functions run every frame after the pose (`{ bone, update(t, dt, state) }`), used for sine-wave motion and springs alike.
- **Colliders**: spheres on body bones that spring chains are pushed out of.
- Export: spring and procedural motion are runtime-only. A GLB export carries the extra bones but not their behavior (VRM's spring bone extension could carry it later).

### Sword presets: one-handed and two-handed (2026-10-02, Saori)

Saori plans one-handed and two-handed sword presets. They should teach **mechanisms**, not baked animations, so an agent can copy them for other held things. The test case: "make a tennis game with this character" should work by copying the sword preset (racket instead of sword, forehand instead of slash).

What the sword presets must provide:
- **Holding**: attach an item to the hand bone with a gripping hand shape (`avatar.attach("hand.R", item)`), with a documented hand orientation, so an agent doesn't guess angles.
- **Play once and return**: wind-up → swing → follow-through → back to the stance, then a "done" signal. Today every motion loops.
- **Hit moment**: an event at the instant of contact (a sword deals damage there; a racket returns the ball there).
- **Item tip**: a marker for the business end (sword point / racket sweet spot), readable in world space for hit checks.
- **Both hands on one item** (two-handed): the second hand follows the item. The same build gives tennis's two-handed backhand.
- **Knobs on the swing**: height / direction (high, middle, low → a ball at any height) and speed (time the hit to an incoming ball; a charged slash).
- **The other hand stays free** with the one-handed sword (no shield): a serve's ball toss uses it.

Adding motions (checked 2026-10-02): agents can already add one — `POSES` is exported and `avatar.play(name)` accepts any name in it, and `bones` can be turned directly after `avatar.update()`. What's missing is listed above (play once, the hit event, a clock per motion: today `time` is one shared clock, so a one-shot motion has to track its own start), plus written bone axis conventions (which axis swings an arm forward).

### Motions written for any humanoid skeleton (2026-10-02, decided)

Use case (Saori): prototype the game feel with this engine, then maybe ship with characters made elsewhere (e.g. Tripo / Meshy, AI-made and auto-rigged) — or keep this engine to the end when the game is in its chibi style (Saori's own site and games).

The trap: motions tuned in the prototype (swing height, speed, hit moment) are written against this engine's bones, axes and chibi proportions. Swap the character and the tuned motions break, so the prototype's work is lost. Decided: **the motion and attachment layer is written against a standard humanoid skeleton, not against this engine's own rig**, so the tuned motions carry over to other humanoid characters and only the look changes.

- Bone names map to the VRM humanoid set (Mixamo names via a table). Today's names are already close: `hips, spine, chest, upperChest, neck, head, upperArm.L, lowerArm.L, hand.L, upperLeg.L, lowerLeg.L, foot.L` (and `.R`) ↔ VRM `leftUpperArm` etc.
- Rest pose differs: this engine binds in an A-pose (arms about 46° down); VRM's normalized rest is a T-pose; other rigs vary. Motions are stored relative to a normalized rest, and each skeleton gets a rest-pose correction when it's attached.
- Positions in motions (the hip lift, the item tip, swing height) are in units of the character's size (leg length / height), not metres, so a taller character swings at the same relative height.
- The pieces from the sword presets (holding, play once, hit event, tip, two hands, swing knobs) all go through this layer.
- Decide this before the sword presets: retrofitting it after the motions exist means rewriting them.
- Pitch that follows from it: "the feel you tune in the prototype carries over to the final characters" — stronger than "placeholder characters for prototypes".

### Motion list for the presets (2026-10-02, draft)

A light list, made now to find what the skeleton and the motion layer are missing **before** anything is polished. Angles and timings are decided when each preset is built. Today's motions: `idle, walk, wave, cheer, sitChair, sitChairGirl, sitFloor, hugKnees` (+ `aPose, tPose`); they keep working after the shoulder bones (only hugKnees changes, on purpose).

| group | motions | what it needs |
|---|---|---|
| common | idle, walk, run, turn in place | feet that don't slide (scaled to the character's size) |
| common | jump (take-off, air, landing) | hip height and travel scaled by leg length |
| common | flinch, fall down, get up | play once and return |
| one-handed sword | stance, horizontal slash, vertical slash, thrust, 3-hit combo | hit event, item tip, height / direction knobs |
| one-handed sword | charged slash, overhead wind-up | speed knob, **shoulder bones** |
| one-handed sword | toss something with the free hand | the other hand free (a tennis serve uses this) |
| two-handed sword | stance, overhead chop, sweep, spin slash | **both hands on one item**, shoulder bones |
| everyday | wave, cheer, sit, hug knees (exist) | a rounded back (three bend points) |

Check after building the shoulder bones: every row's "what it needs" is covered by the skeleton or the motion layer.

### Shoulder bones and a rounder back (2026-10-02, decided; done the same day)

Status: done. `shoulder.L/R` (20 bones now), `upperChest` at y 0.68, the trap part bound to `upperChest`, the shoulder bones take the top of the shoulder along the clavicle (`weights.js`). Poses that don't use the new bones look the same (screenshot diff: only outline pixels move). Hug-knees has a rounded back with the shoulders rolled forward and the face up; cheer lifts the shoulders with the arms (Saori to judge both looks).


Saori wants shoulder (clavicle) bones. Do this **before the sword presets**: once motions exist, changing the skeleton means rewriting them.

Why: arms raised above the head (sword wind-up, two-handed overhead chop, a tennis serve) need the shoulder itself to lift, or the shoulder line breaks (the same root as the "corner by the neck when the arms go up", today softened only by skin weights in `weights.js`). A hunched back (the hug-knees pose, which isn't rounded today) needs the shoulders to roll forward and a third bend point in the back. VRM and Mixamo both have shoulder bones.

History: before 2026-10-01 the arms hung from `chest` (0.62). Saori added `upperChest` at shoulder height (0.732) so both shoulders turn around a level point. That was the right aim, but it left only two bend points in the back (`spine` 0.50, `chest` 0.62): `upperChest` sits 8 mm under `neck` (0.740), so bending it tilts the neck and arms instead of rounding the back.

Plan:
1. Add `shoulder.L` / `shoulder.R` as children of `upperChest`, rooted near the base of the neck at shoulder height (about x ±0.02, y 0.732), each reaching to its `upperArm` joint. `upperArm.*` becomes a child of `shoulder.*`. The level shoulder pivot Saori wanted moves to these bones.
2. Move `upperChest` back down to the upper back (about y 0.68, near VRM's placement) so the back has three bend points (`spine`, `chest`, `upperChest`) and curves instead of folding.
3. Skin weights: the shoulder bones take the top of the shoulder (between the neck and the arm joint); revisit the shoulder band in `weights.js` (35668c9) — some of what it fakes may now come from the bone.
4. Hug-knees: bend spine + chest + upperChest a little each, roll the shoulders forward, drop the neck and head.

Done when:
- In the rest pose (and any pose not using the new bones) the character looks the same as before: screenshots from the fixed views match.
- Arms raised (T-pose and above the head): no corner by the neck, the shoulder line stays smooth.
- Hug-knees reads as a rounded back from the side.

Name tables for retargeting: `shoulder.L` ↔ VRM `leftShoulder` ↔ Mixamo `LeftShoulder` (and `.R`).

### Finger bones and the fist (2026-10-03, Saori; done)

Saori wanted the cheer jump's wind-up to close the hands into fists. A weapon's fist (outfit.weapon) is built into the hand's shape, so a pose can't open or close it: the fingers were parts on `hand.*` with no bones of their own.

Done: three bones per hand (28 bones now, with the skirt's two) — `fingers.*` at the knuckles (the four fingers bend as one), `fingerTips.*` at the fingers' middle (child of `fingers.*`), `thumb.*` at the thumb's root. Each open finger is now two capsules (base on `fingers`, tip on `fingerTips`; the joint blends narrowly so it doesn't swell); a weapon's built fist binds its parts the same way. A pose says `grip: { L, R }` (0 = open, 1 = a fist): the motion player turns those bones about axes made from the hand's frame (`HANDS`: D toward the fingers, N the palm, S the thumb's side, from the body), angles in `GRIP`. A hand that holds something is already a fist and is left alone. Gauntlets (`armorHands`) follow the finger bones.

Checked: the open hand looks the same as before (about 1% of pixels change in a close view); build time and per-frame cost unchanged within noise (bone update ~0.01 ms). Cheer: fists in front of the chin while crouching, open hands up top.

Name tables for retargeting: VRM and Mixamo have three bones per finger; `fingers.*` ↔ the four fingers' first joints, `fingerTips.*` ↔ their second (and third) joints, `thumb.*` ↔ the thumb's first joint.

### The skirt as cloth (2026-10-03, Saori; done)

Saori: sitting on the floor, the thighs poked out of the skirt, and weighting couldn't fix it. Skin weights alone can't: the thighs turn ~90° inside one piece of cloth, so weighting the skirt to them tears its sides open (a flap stood up from the front) and weighting it to the hips lets them poke through.

Done (`src/cloth.js`, only for `outfit.pants.kind = "skirt"`): each frame the skirt is moved as simple position-based cloth.
- The target is where the usual skinning puts each point (the skirt's weights are unchanged). Points are pulled toward it, fully at the waistband (pinned), loosely toward the hem, keeping a little of their motion (a soft sway).
- Two rounds of: edges longer than built are pulled back (the cloth doesn't stretch; it may bunch), points inside a thigh or shin are pushed out, points under the floor or the chair's seat are lifted onto it.
- The thigh and shin capsules are measured off each built body (`legCols` in `src/index.js`): at several points from just below the hip joint to the knee, how far the body reaches, so a fuller thigh (the girl's) gets a fuller capsule. Fixed radii missed the girl's mid-thigh.
- A thigh turned up past ~55° (sitting, crouching) pushes the front of the skirt over itself, not under (the nearest way tucked part of it beneath the thigh, which then showed through a hole); the back of the skirt stays under (you sit on it). A walking thigh uses the plain push.
- Points already inside a capsule when standing (the skirt's top over the thigh's root) may stay as close to its axis as they were then (not pushed out, not let further in).
- Then once, against the body's own surface (2026-10-03, Saori: "椅子や床に座ると太ももの付け根がすこし浮き出ちゃう、女の子体型でわかりやすい"). Capsules are round; the flesh of the hip and the thigh's root is not, and it bulges out when the thigh turns up. A third of the body's points around the hips and legs (those following the hips, spine or legs) are skinned each frame and put in a hash grid (4 cm cells); a skirt point's distance to the body is taken along the nearest body point's normal. Each skirt point may stay as close as it was when standing (1 mm of slack, else the body's 1 mm noise makes it jitter). This includes the pinned waistband: only its top 2% (the waist seam) is fully pinned now. A wider pinned band couldn't give way to the hip and folded open over it.
- Only the outer side of the 1-2 cm shell is moved; the inner side rides on the nearest outer point. When nothing has moved for 40 frames it stops computing.
- Drawn as the same skinned mesh: the cloth's points and normals are turned back through each point's blended bone matrix into rest positions, so the GPU's skinning puts them where the cloth is. Where the cloth sits on its target the built mesh is used unchanged: a standing skirt renders pixel-identical to before. (A separate plain mesh drawn instead shaded differently — a dark band on a standing skirt that we couldn't trace — so this way.) `cloth.rest()` puts the built mesh back for the glTF export.

Cost on the test machine (3-4× slower than a desktop), girl body, whole avatar update: 1.5 ms per frame without the body-surface step, 2.7 ms with it (walking, cheering). Sitting still, the cloth sleeps.

Not yet: hugging the knees shows the tops of the thighs (as a real skirt would); the space between the legs under a short skirt when sitting on the floor; the glTF export has the built skirt, not the cloth's motion.

### The dress (ワンピース) (2026-10-05, Saori: "ワンピースとかマントやローブ的な服がないね"; done)

`outfit.dress.on`: the shirt and a skirt as one garment, in one color (`dress.color`, null = the shirt's). Not a new mesh: the shirt is its top (sleeves and collar from `outfit.shirt`), and the pants mesh becomes its skirt whatever `pants.kind` is. `skirtOf(OPT)` (options.js) gives the skirt either way (a plain skirt or a dress's), and the clothes, the parts' bounds and weights and the cloth all read it. With longer legs (`body.proportion.legs`) the skirt's share left on the hips shrinks (`1 - (1 - follow) / legs`): the skirt is stretched below the hips with the legs, so what stayed on the hips hung that much deeper, under the thighs when they turned up, and the cloth crumpled pulling it over them (a tall body in a dress, sitting; 2026-10-05). While the dress is on, `shirt.on` / `pants.on` don't hide it (taking off the pants took the skirt away, 2026-10-05); `dress.on` puts it on and off.

- Its skirt starts under the chest (`dress.waist`, 0.57; an empire line), not at the pants' waist. Starting at the waist, the top hugged the chibi's round belly and the skirt flared out below it: a maternity dress. From under the chest the cloth falls over the belly.
- Its top ellipse is measured off the body at that height (just over the shirt), centered on the body. The plain skirt's ellipse is the hips', centered behind; at the chest it stood off the back as a ledge and let the belly push out in front.
- The front follows the thighs less (`dress.follow` 0.3; the plain skirt's 0.85). A dress is longer and wider, and when the thighs turned up (sitting) the front's flare turned up with them and stood out like a shelf. At 0.3 the colliders lay it over the thighs and the rest hangs past the knees; at 0.5 the hem rode up over the thighs.

Not yet: sitting on a chair, the cloth tents over each knee and sags between them (the cloth doesn't resist being squeezed, and the middle follows the hips); a real dress would stretch flat across. The outline speckles a little at those tents.

### The cape (マント) (2026-10-05, Saori; done)

`outfit.cape`: a shell over the shoulders that hangs down the back, open in front, moved as cloth. Only built when worn: `cape.on` rebuilds the clothes (and is in the mesh cache's key), so nobody else pays for it.

- Shape (`capeSdf`, clothes/index.js): over the shoulders, the body pushed out 2.6 cm (a mantle); from the shoulder line (`capeTop`) down, an elliptic cone measured off the body there, flaring toward the hem (`cape.flare`, half as much at the sides as at the back). Its front edge is behind the arms (the rest pose holds them out at 45°), and over the shoulders it wraps forward (`cape.wrap`). The collar is a little higher at the back. 1.8 cm thick, like the skirt (1.2 cm was thinner than the mesh's cell and the surface broke into specks).
- Over a skirt or a dress it is at least as wide as the skirt at every height (it goes on flaring below the hem), else the skirt showed through its sides. Above the skirt's top that floor narrows at 45° (a step there showed as a crack).
- Cloth (`cloth.js`, the skirt's): pinned at the collar, free toward the hem. It keeps off the legs, the arms and the body's surface from the hips to the shoulders (`bodyRegion`). The arms push it outward (away from the body's middle line): pushed the nearest way, it slipped in front of an arm swinging back. For the arms, points near them in the rest pose may not stay close (that rule is for the skirt over the thigh's root; here it let the arm through), and the arm capsules include the cape's thickness (its inner side rides on the outer one).
- `cape.sway`: the free points keep their place in the world when the whole character moves (the root's move since last frame is undone for them), so it trails behind walking and running. The skirt has 0 (unchanged). A move over 30 cm in a frame is a teleport.
- Sitting on a chair it isn't lifted onto the seat (it stood out sideways like a table): it hangs behind.

- `cape.air` (0.8; 2026-10-05, Saori: "もっと靡いて上に上がるようにすれば"): running, the hand swinging back went through the cape. Inertia alone (`sway`) only lagged it a little, the pull back to its shape won. Now the character's speed (root space, smoothed) moves each point's target back against the motion and up, growing toward the hem, with a small flutter; the collar is pinned and the cloth doesn't stretch, so the cape streams back and up around the collar (out of the arms' way), and settles back when the character stops. The skirt has none.

Not yet: it doesn't collide with the skirt as cloth (only its shape is wide enough); long hair lies over it without touching it.

### The robe (ローブ) (2026-10-05, Saori; done)

A robe is a dress down to the ankles (`dress.hem` now goes down to 0.03) with bell sleeves (`shirt.sleeve: "bell"`, any shirt can have them). The editor's outfit tab has "服のかたち" chips (shirt and pants / dress / robe) that set those values at once.

Bell sleeve (clothes/index.js, in the shirt): the long sleeve, plus a shell around the forearm from the elbow (as wide as the sleeve) widening to the cuff by `shirt.bell`. A symmetric bell read as a puff sleeve (its opening faced down the arm, unseen from the front), so it hangs: toward the cuff its middle drops below the arm (straight down across the forearm, in the rest pose) and its lower side reaches further, a slanted opening. It is rigid (skinned to the forearm): raising the arms, the bell's long side hangs along the arm.

### Neck width and length (2026-10-05, Saori: "頭を小さくすると首が太く見えるから、首の太さや長さもスライダーで弄れるようにしたい"; done)

- `body.sculpt.neck.width` is now a main slider ("首の太さ").
- `neck.follow` (1): the neck's width follows the head size, relative to the default head (`(head.scale / default)^follow`). A smaller head gets a thinner neck; at the default head nothing changes.
- `neck.length` (m): lifts the head. `headTransform` gained a `lift` (after the scale), and the head bone moves up by it, so everything built in head space comes along: the head, the face picture, the hair and its locks. The neck's capsule and the nape reach up by the same amount.

The default character renders pixel-identical.

### Proportions: longer legs and torso (2026-10-05, Saori: "ナヒーダは意外と等身高いけど、これくらいの頭身にするのは難しい？"; done)

The base body is about 3 heads tall (head 0.43 of 1.27 m); Nahida is about 4.5. A smaller head alone can't get there, and scaling the body up would scale its chibi thickness with it. `body.proportion.legs` / `.torso` (×) stretch the body upward instead: the legs (just above the ankle to the hip joint) and the torso (hip joint to the neck) get longer, their widths stay, the feet keep their shape, and everything above the neck moves up as one (head, face, hair). Legs 1.7, torso 1.35 and head 0.85 make about 4.5 heads.

How (`makeStretch`, body/index.js): a smooth monotone map of the height (fwd / inv, a table; the slope fades over 3 cm at each joint, no shading kink). Everything is still built at the base proportions (the SDFs, the clothes, the hair, the skin weights, the cache), and only when a mesh becomes geometry its points move up by fwd (normals by the slope). What moves the character uses the stretched space: the bones (`Jr`), the head's transform for what is placed in head space at run time (`HTr`: the locks, the face picture, the ear line), and the body read in place for colliders (`bodySdfR`). Things that read built geometry back in base terms take `inv` (the body's paint, culling under the clothes). Cloth tops and hems go through `fwd`. A pose's hip lift scales with the legs' length, and a seat's height goes through `fwd` (the editor's chair is raised the same way). The editor's whole-body views step back with the height, the face view moves up with the head.

Defaults render pixel-identical. Not yet: lock hair is as long as before (in head space), so on a tall body long locks end higher; weapons held in the hands stretch with the torso band.

### Tails: ponytail, twin tails, side tail (2026-10-05, Saori; done)

`hair.tail.kind`: "pony" (one, high at the back), "twin" (two, a little behind the ears), "side" (one, `side` L / R). Each is a bundle of locks (hair/locks.js `tailLocks`, the same moving ribbons as the other locks, part "tails") from a tie on the hair: the tie's place is found on the hair's surface at an angle around the head and a height (head space; `angle` / `y`, null = each kind's own), and the bundle leaves it outward (a ponytail more upward), arcs over and falls (a cubic Bezier), its tips fanning out (`spread`), then is pushed off the head and the body. A hair tie (`tie`: a ring on the head bone, part "tailTie") wraps the bundle where it has left the head (at the root it was buried in the hair). `size` (×, the "太さ" slider) scales the bundle and each lock's width together, and the tie with them (the volume alone only spread the same locks wider). `avatar.setTails(values)` rebuilds only them, so the editor's sliders apply at once. They work with any back hair; a ponytail reads best over short back hair.

The editor moves the ties by hand too (editor/src/ties.js, "頭の上で結び目を動かす"; Saori: "ドラッグで動かせるのもつけて"): a dot on each tie (`avatar.tailTies()`), dragged around the head and up or down; releasing it writes `hair.tail.angle` and `y` as one undo step. Twin tails move together, mirrored; a side tail dragged over to the other side changes sides; a ponytail stays in the middle.

**Waves (2026-10-05, Saori: Nahida's wavy tail and long side lock)**: `hair.tail.wave` (m, 0 = straight) snakes the whole bundle out and in from the head as it falls, `waves` times from the tie to the tips (all its locks together, a little apart in phase). A bang tuft's row takes a 10th value, the wave of its hanging part (side to side across its flat side; `nendo.waves` waves); the editor's tuft tool has it as "うねり(垂れた部分)". Drawn locks are as wavy as they are drawn.

### Gradients: hair tips and hems (2026-10-05, Saori; done)

Asked whether a loaded texture should do the gradients: not for the hair. Projected by height, a bang's tip (at the brows) and a long lock's (at the waist) would get different colors; the locks already know their own root-to-tip position. So gradients are their own settings, and textures (next) are for patterns.

- `withGrad(material, U)` (materials.js): mixes the material's color toward `U.color` along a per-vertex `gradT` (0 → 1), from `U.start` over `U.soft`. `U` is a set of uniforms shared by every material of that hair or garment, so `avatar.setGradient(target, values)` changes them all at once (instant; no rebuild, not in the mesh cache's key).
- Hair (`hair.gradient`): locks get `gradT` along each lock (root 0, tip 1); the hair's own mesh by height in head space (crown 0, lowest tip 1; the lowest tip is the back locks' when they hang below it: else a bang lock at the temple was the mesh's lowest point and turned green, 2026-10-05). `gradient.bangs` off leaves the bangs out (Nahida's bangs stay white while the rest goes green). Bangs that are part of the hair's mesh (block, hime, side) too: a vertex where the bangs' own shape is the surface (fading out over a few cm) gets no gradient (`hairGrad`, index.js). Where a bob's lumps poke through hime side locks, those bits are the bob's and do turn. `gradient.hanging` (default on): with the bangs left out, the bang tufts hanging long (below `lockHangY`) still take it, by their locks' `grad` (Nahida: white bangs, green-tipped side locks; 2026-10-05).
- Garments (`outfit.shirt / pants / dress / cape .gradient`): top 0 to hem 1 by height. A dress's runs from the collar to the skirt's hem over both its parts (the shirt's and the pants' are then unused).

Defaults render pixel-identical (off: the mix is by 0).

### Pictures on the garments (textures) (2026-10-05, Saori; done)

`outfit.shirt / pants / dress / cape .texture`: { src (path or data URL), mode, scale (m), rotate, x, y, opacity, blend: "over" | "multiply" }. The meshes have no UVs (they are remade from shapes on every change, so a hand-made UV layout like VRoid's can't exist), so the picture is projected (`withTex`, materials.js), from each vertex's place and normal when the mesh was made (`texP` / `texN`: they stay with the cloth when the skirt or the cape moves):
- tile: from the three axes, blended by the normal (patterns: checks, stripes, prints). Where two faces meet the two projections overlap a little.
- wrap: around the body's upright axis (a label, a border around a hem).
- front: once, from the front, centered at x / y (a print on the chest).

Uniforms are shared per garment, so `avatar.setTexture` is instant; a new src loads in the background into the garment's one texture object (disposed first: the GPU keeps a texture's size). The textures aren't in the mesh cache's key. A dress's covers both its parts. In the editor each garment's section has a "柄の画像" picture field; the rest of its controls show only once a picture is loaded (`when: { path: "*set" }` = anything but null).

A sharper blend between the projections (normal^8 instead of ^4) broke the shader on the test GPU (only a patch of the picture showed): kept at ^4.

### Painting on the character (2026-10-05, Saori: "VRoid みたくアプリ上でテクスチャを描けるといい"; done)

The meshes have no UVs, so each paintable part (`paint.body / shirt / pants / dress / cape .src`) has an atlas of six views of it (src/paint.js `paintLayout`): front, back, its left, its right, above, below, 600 px per m over a fixed box. A point of the surface shows the view its normal faces most (`paintGLSL`, in `withPaint`, materials.js, drawn over the color, the picture and the gradient). Points are taken where they were when the mesh was made, at the base proportions (`paintP`, before `body.proportion` stretches the body) with their normal (`paintN`), so paint stays put when the body moves, when its proportions change (it stretches with the body) and mostly when its shape changes a little.

The editor's brush (editor/src/paint.js, the outfit tab's "ペイント"): the left button paints whatever part it touches (`avatar.paintTargets()`). The touched point is turned back into the part's terms by interpolating `paintP` / `paintN` over the posed triangle, and a soft dab is drawn into every view that point could show in (`paintViews`: its own, and the next where the normal is nearly between), clipped to each view; so a stroke runs on across where the views meet, and from one part onto another (shorts → skin). Dabs fill the gaps between touches. The part's canvas shows at once (`avatar.paintSurface`); releasing writes it into the recipe as a PNG (one undo step; `sync` keeps the engine from reloading what it already shows). Eraser, color, size, opacity, softness; each painted part can be cleared.

Not yet: a view paints every surface of the part facing that way at that place (a garment's inside behind its outside gets the same paint; mostly unseen); hair isn't paintable.

### Robe fixes: bell sleeves in a T-pose, a leg kicked back through the hem (2026-10-05, Saori; done)

- Raising the arms, the bell sleeve's lower side stayed at the waist and stretched into a web: those points were nearest the hips, so they followed them. The bell's points now go to the forearm alone (`bellOf`, clothes/index.js: on the bell's surface and nearer it than the shirt without the bell; "off the body" alone missed the part lying against the hips), through the skin weights' `soft` (its bone can now be chosen by the point).
- Running, the back foot came out through an ankle-length robe. The feet had no collider (now heel to toe, with the shoe and the cloth's own thickness), and a leg kicked back fast went through the cloth in one step, which then was pushed out in front of it. The shins and the feet now keep the back of the skirt on their outside (`outward: "back"`, cloth.js) while they are behind the body. Not in front: sitting, that pushed a skirt down over the shins; there the nearest way stays.

### Elf ears (2026-10-05, Saori; done)

`body.sculpt.ears.elf`: a flat blade (`earTip.L/R`, a head part, added with the ears after the shape cuts) from the ear's middle out to the side, up by `angle` and back by `back` (degrees), tapering to a point like a leaf (widest at the ear), the tip bent up by `curve`, flat with its face toward the front. Its length counts from the ear's middle: the ear's own plate already reaches about 6 cm that way, so a first try at 8.5 cm hardly showed. Swept back 40° it hid behind the side hair from the front; 25° sticks out past it. The hair keeps off the tips as off the ears (`earDist`, hair/index.js).

### Drawing the face parts in the app (2026-10-05, Saori: "テンプレをダウンロードできるけど、アプリ上でも描けたら便利"; done)

editor/src/facepaint.js: the same "parts" template as the download (the head from the front, a red frame per part) under a clear drawing layer, in a dialog. The layer starts with the parts as they are now (each picture in its frame; the closed eye mirrored back onto the other eye), so drawing adds to them or redraws them. Pen (color, size, a pen's pressure), eraser, undo, clear; the part buttons zoom onto their frame (CSS, so the canvas keeps its pixels). "顔に反映" hands the drawing layer alone to the same reading as a loaded template (`applyTemplate` in app.js, `readFaceSheet`): every frame with something in it becomes that part, one undo step; drawing can go on and be put on again. It opens on ふつう, on a drawn expression (its row's "描く") or on a new expression (the first "顔に反映" makes it, later ones go into it).

A frame left empty keeps its old picture (as with a loaded template): erasing a part entirely doesn't remove it; "外す" does.

Drawing tools (2026-10-05, Saori: "下のサンプル絵レイヤーがあると描きづらいから表示非表示を切り替えたり、バケツツールとかパスみたいな最低限のお絵描きツール"): pen, eraser, bucket (the touched area of the drawing layer: pixels close to it in colour and opacity, touching, kept inside the frame clicked in, grown by a pixel so a line's soft edge leaves no pale seam), path (clicked points joined by a smooth Catmull-Rom line; the first point closes it, filled if "中を塗る"; double-click, Enter or "確定" ends it, Backspace takes a point back, Esc drops it) and eyedropper (the drawing's colour, else the template's). The template is in layers (Saori: "下絵はレイヤー形式にして、顔、顔のパーツで表示非表示と透明度"): the face (the head, skin only) and its parts (the guide face, 35% by default), each shown or hidden with its own opacity (kept in this browser), and the frames always above them (`faceSheetLayers`, face/sheet.js: the "parts" template's pieces apart). A layer over the drawing shows the path being drawn.
### Toes (barefoot) (2026-10-05, Saori: "ナヒーダは裸足だけど…靴を脱いだらちゃんと足の指がついてるように"; done)

`body.sculpt.foot.toes` (on): four toes along the front of the foot (chibi style: a fifth was below the grid and only blurred the edge), the big toe on the inside, each a small round piece with a narrow blend so the gaps show; big enough to read at the "game" grid too. Under a shoe the body isn't drawn (the clothes' culling already left out the body inside shoes), and the toes stay inside the shoe's shape (a shoe is made around the foot without them, 1.2 cm out; they sit 6 mm back so the sock over them doesn't poke out at the shoe's front). Socks follow them (toe bumps); clipping the sock to the toeless foot showed the toes' skin through it instead. With shoes on the default renders the same but for a few outline pixels at the soles.

Then (Saori: "足の指丸まってない？"): the toes sat under the foot's round front (a dome over them), so they read as curled. Now the foot's front top is shaved down to them (a cut after the body's parts, so the instep slopes to the toes), and the toes lie flat on the ground pointing forward, reaching a little further. Being longer and lower they would come out of a shoe made around the dome, so a shoe (and its sole) is made around the foot and a smooth toe box over the toes (`toeBox`, clothes only): its front is a little lower and longer than before, and the toes' bumps don't show through.

### Body types: chibi and tall (2026-10-05, Saori; done)

Each body type (standard, toddler, girl, sturdy) comes as a chibi (as before, plus the base proportions and head 0.9, so choosing it undoes a tall one) and a tall one (`<type>Tall`: legs 1.65, torso 1.3, head 0.82, limbs 0.84×, belly 0.82× but not under 0.6, a little more waist), made from the chibi in src/body/types.js; the toddler has no tall one (a contradiction). "kid" is gone (it looked like the toddler). The editor shows them in two rows (ちび / 高頭身) and sets every value a type has (torso, limbs, proportions, head size); the test page (body.html) keeps the chibi ones (it sets the torso and limbs only). (2026-10-06: the tall standard became the default body, and body.html offers every type with its proportions: see "The tall body is the default". Later that day the tall ones became about 5 heads: legs 2, head 0.7, arms of their own: see "The tall body at about 5 heads".)

### Shoe kinds (2026-10-05, Saori: "ブーツとかハイヒールとか紐付きスニーカー"; done)

`outfit.shoes.kind`:
- "sneaker": as before (renders the same).
- "laced": the same with laces, a part of its own ("laces", `laceColor`), made on its own fine grid (2.4 mm at most: they are 4 mm thick). Across the shoe's front slope in four rows, each lace from an eyelet over the top to another (three points found on the shoe's surface from inside it); further back, toward the opening, the leg comes out of the shoe and hid them. They cross: each row to the other side of the next (Saori chose this from bow / criss-cross / straight bars; a straight bar at the toe end was tried and dropped), with a bow: a knot, two flat loops out and up, two ends hanging forward, a little in front of the top row and above it (a first, small one at the row itself hid behind the leg).
- "boots": up the calf (`bootHeight`), made around the foot and the calf's parts (so it follows the calf), a little looser, flared at the top.
- "heels": low-cut pumps with a heel. A heel needs the foot tipped toes-down, so while they are worn the pose player tilts both feet by `heelAngle` in every pose and raises the body so the ball of the foot stays on the floor (`heelPose`: the tilt about the ankle, the lift, the heel's height). The heel is built slanted forward by the same angle, so tilted it stands straight down to the floor. Barefoot (shoes off) the feet are flat again. They have no rubber sole (the sneaker's white sole looked wrong on them): the shoe itself goes down to the floor, one color; and a pointed toe (a flat cone forward and a little toward the big toe, smoothly joined).

### The agents' guide (2026-10-05, Saori: "リポジトリ名をわたして、このツールでキャラを作ってテニスゲームつくって、とか言えば伝わるの?"; done)
`llms.txt` at the root (and on the site: https://hinagata.pages.dev/llms.txt): what an agent needs to use Hinagata in a game, short. It tells the agent to keep the character in `character.json` and start the live sync by default, handing the user the editor link (so nobody has to ask for it), and the MCP as the option; then the page setup (import map, the site's `src/index.js`, CORS open), the recipe (the schema on the site, checkOptions, body types), moving it in a game (poses, matching the gait speed so the feet don't slide, own poses, IK, instant setters) and the editor's links. Keep it in step with the API.
Tried the same day: an agent given only the user's one line and the guide built a playable tennis game (its own character.json, the sync started and the link given unasked, the gait matched, its own swing pose). What it had to guess went into the guide: the example page (examples/ is on the site now), restarting a pose (`update(0, { t: 0 })`), where `throw` / `chop` live and which way a bone's x turns, putting a racket in a hand, checkOptions in Node (schema.js), the helper's port, the weight (≈100k triangles, ≈5–10 ms per update on a 2.8 GHz cloud CPU).
The game itself is on the site (Saori: "そのテニスゲーム、私も遊べるようにして"): `examples/tennis/` (character.json, rival.json, the engine from `../../src/`), with a touch pad and a swing button on phones and a taller view on an upright screen.

### Live sync with a recipe file (2026-10-05, Saori: "エージェントに作ってもらったキャラを微調整するのがエディタのおもな使い道。エージェントの作業をリアルタイムにエディタに反映させるには"; done)
The file is the source of truth: the agent edits it as it edits any file (no MCP setup, any agent), the game loads it, and the editor follows it. `tools/sync.mjs` (Node, no dependencies; also served at https://hinagata.pages.dev/sync.mjs: one file to fetch, no clone) watches the file (its directory: editors that save by replacing it stay watched), sends each change to the editors over Server-Sent Events, and writes what an editor PUTs back into the file: only what differs from the defaults, pretty-printed with sorted keys (a steady diff), and its own write doesn't come back as a change. It listens on 127.0.0.1 only and every request needs the key it prints in the link (random per run: another page can't read or overwrite the file); CORS and Chrome's private-network preflight are answered.
The editor (`editor/src/sync.js`), opened with `?sync=<port>&key=<key>`: the file's recipe becomes a character of its own in the library (named after the file, `sync` on it), switched to on connect; a change from the file comes in as one undo step (only the values that changed, so instant ones apply at once and shapes rebuild); a finished change made here (not a live slider drag, not one that came from the file) is PUT a quarter second later. The header shows "⇄ <file> と同期中", or that the helper stopped (EventSource retries by itself) or can't be reached.
**MCP (2026-10-05, Saori: ②; done)**: `node sync.mjs character.json --mcp` is the same helper and an MCP server on stdio (JSON-RPC by hand, still no dependencies; its logs go to stderr). Tools: editor_link, get_recipe, update_recipe ({ set: { dotted path: value }, reset: [paths] }: written to the file, so the editor follows, and checked), check_recipe, find_options (words against the paths, labels, help and choices, main options first) and screenshot. The schema comes from docs/options.schema.json next to the file in the repository, else the site's copy (/options.schema.json, published with /sync.mjs); the check is the engine's checkOptions redone over it. A screenshot is asked of the newest editor connected: an SSE "request" { rid, cmd, args }, answered on POST /response. The editor (`vp.capture`) renders a square picture from one of the view buttons' cameras on the background colour, in a pose if asked (evaluated at 1.2 s, then back to the one playing), and puts the user's camera back.

### A skirt's front sitting down (2026-10-05, Saori: "座った時前が捲れ上がる"; done)
The skirt's front bones copied the thighs' turn. An A-line skirt's front already stands out from the body by its flare, so turned the whole 90° of a thigh raised to sit, its flare pointed up and the hem lifted over the lap. They now turn by the thigh's swing less that slant (atan(flare × 0.8), the front's own: a slerp toward the thigh's turn by 1 − slant / swing; a swing smaller than the slant doesn't move them).

**The lap (2026-10-05, Saori: "足の形がくっきり浮き出る")**: sitting, the skirt's front sank between the thighs and showed each one's shape. Three bridges from one thigh to the other (at 45%, 70% and 90% along them, as thick as the thinner one there) keep the front spanning the lap; a collider's far end may ride on another bone (`boneB`, cloth.js). They count as thighs (the front goes over them). Walking and running don't notice them (they lie inside the skirt between the legs).

**Cloth gets the last word (2026-10-05, Saori: "走った時後ろ足一番蹴り上げた時のスカートとかマントの布が伸びて千切れそう")**: each step ran its rounds as edges then collisions, so the colliders spoke last: a heel kicked up behind caught a few hem points and left them pulled out of the hem in a thin spike (the cape bunched around the shoe the same way). Three more edge rounds close each step (`EXTRA`, cloth.js): the hem lifts over the heel as a whole. Sitting is unchanged.

### Thin cloth at the game quality, and a "lite" quality (2026-10-05, Saori: "ゲーム用の表示にしても顔とかは崩れないけどスカートとかマントがジャギジャギ。まだ六万頂点もある。geminiはローポリ化すれば一万くらいまで減らせるって"; done)
- A skirt or a cape is a shell under 2 cm thick; meshed with the game's 16 mm cells it came out ragged and holed, the inside's outline showing through in specks. Their cells stop at 10.5 mm (`THIN`, parts.js): clean, a few thousand vertices more, and its cloth a few ms more per update (a skirt: 9 → 12 ms on a 2.8 GHz cloud CPU).
- Where the vertices go (a dressed character at game: ~45–65k): the body ~11k, the shirt / dress top ~10k, the hair's block ~6k, the hair locks 5–13k (each lock a ring of 6 points, 3 rings a link), the skirt, the cape. Surface nets make the same density everywhere, flat or not, so the meshes thin well: meshoptimizer's simplify to 15% is hard to tell apart at a game's distance.
- quality "lite": the game's cells, the meshes thinned to 15% (cloth to 60%: its inner side rides on the outer side's nearest points, and from big triangles the inside showed through in holes), the locks drawn lighter (a diamond of 4 points, 2 rings a link). The default character ~8k vertices, a dressed one with long hair and a cape ~23k (game: 41k / 65k). Building is as fast as the game's: the workers' meshes are thinned afterwards, their skin weights following the vertices meshoptimizer keeps. meshoptimizer comes from the import map's "meshoptimizer", else jsDelivr (the old hint pointed at a file that doesn't exist in its 1.x). The editor offers it as "軽量(ローポリ)".
- Thinned plainly, the cheeks showed the outline in lines (Saori). Now the thinning weighs the normals too (simplifyWithAttributes, so the toon bands and the outline keep their shape where the surface turns) and leaves the face (the head's front, on the body) as built. Tried for Gemini's "30k is enough even for high": high's meshes thinned to 20% come to about the game's count (~51k for a dressed character with many locks; the locks aren't thinned) and look like high.

### Hair on the run: streaming back, not bobbing (2026-10-05, Saori: "走ってる時の靡き方が、後ろじゃなくて上下にポヨンポヨンと流体のように動く"; done)
The locks are springs toward the shape the head carries; on a run's steps the head bobs, and nothing pushed the hair back (the editor plays the run in place). Now a pose can say how fast it would go (`air`, m/s: run 2.6, walk 1), and the avatar gives the locks the wind of that speed (less what the avatar itself is moving forward: in a game that moves it, its own motion trails the hair already). The wind pulls the free points along it (`DRAG` m/s² per m/s, hair/locks.js), and up and down a lock keeps only half its own motion against the head's per step (`VDAMP`), so it rides the bob instead of bouncing on it.

### Accessories (2026-10-05, Saori: Nahida's leaf hair ornament and golden anklets; done)
`accessories`: a list of small pieces, each riding on one bone (src/accessories.js): leaf, gem, flower, star, ball, and band (a ring around the limb through the point it was put on: bracelet, anklet, choker; its size is the ring's thickness). Plain little meshes, not shapes in the body's distance field, so adding and moving them is instant (`avatar.setAccessories(list)`). An item keeps `bone`, `at` (head space on the head, so it follows the head's size; elsewhere the offset from the bone's joint), `n` (the way the surface faced), `spin`, `size`, `color` and `mirror` (also on the other side, .L / .R swapped).
Editor (Outfit → "アクセサリー", editor/src/accessories.js): pick a kind and a color, "クリックで付ける", click where it goes (the hair too): it sits on the bone that moves that triangle most, facing the way it faces. While one is picked a click moves it; "もう1つ付ける" lets go. Size, turn, color, both sides, take off.
The same pass found the editor's Advanced fold gone since the drawn locks (a comment had swallowed the line that adds it): back.

### Climbing, jumping and falling: IK instead of clips (2026-10-03, Saori; done)

Saori wanted the forest game's character to climb giant trees and fall properly, and asked whether a motion AI (NVIDIA's Kimodo) or Mixamo could supply climbing. Not as drop-ins: both give an adult human's motion, and this body's arms (0.18 of 0.86 m) can't reach where an adult's hands go; the holds also change with every trunk. So climbing is code: a base pose plus IK that puts the hands and feet on the surface. Built in the forest first, then moved here so every game gets it (Saori: "このゲームを作り込むほどアバターエンジンの資産が増えて最高").

- `src/motion/ik.js`: `ik2(bones, LIMBS["hand.L"], target, pole)` — two-bone IK in world space after `avatar.update` (wrist / ankle onto a point, the elbow / knee toward the pole). `LIMBS`: the four limbs as bone chains with their side. `aim(bone, from, to)`.
- `src/motion/climb.js`: poses `jumpAir`, `jumpLand` (two frames of the cheer jump; the game's physics makes the height), `fall`, `hardLand` (the cheer wind-up crouch), `climb` (the base: arms up, knees open like a frog's; `sharp` so last frame's IK doesn't leak into the blend), `climbOver` (crouched on the edge after pulling up).
- `measureBody(avatar)`: shoulder and hip positions, arm and leg length (reach differs by body type). `measureStride(avatar, pose, period)`: how far a walk cycle carries the feet; play the walk at speed / stride and planted feet don't slide (the forest's feet slid at a third of the right cadence before).
- `climbLimbs(avatar, { body, phase, step, dir, right, out, place })`: the hands and feet, one at a time (right hand → left foot → left hand → right foot). Each holds still on the surface for 3/4 of the cycle while the body moves past it, then reaches to the next hold. The game drives `phase` by distance climbed / step (like the walk) and gives `place(lateral, up, lift)` = a point on its surface (the forest: a cylinder).
- Hands hold at chin height: the arms are too short to go over the big head. On a 0.86 m body, steps of 0.7 × arm at 3.2 cycles a second climb about 0.4 m/s.
- Exported from `src/index.js`. The editor lists the new poses (`climb` alone shows the base pose: the IK needs a surface).

**Running** (2026-10-03, done; `src/motion/run.js`): the forest's Shift had been the walk played fast (feet spinning at 1.85 m/s). Pose `run`: a forward lean, thighs swinging wide, the knee folding hard while the leg swings forward (the heel comes up under the bottom) and nearly straight at the strike, elbows bent about 90° and pumping against the legs, loose fists, hips and shoulders counter-turning; both feet leave the ground between steps. `sharp`: eased, the fast swing came out smaller and the feet slid (40%); followed exactly, a planted foot moves 5% of the body's speed. `measureGait(avatar, pose, period)`: the no-slide speed for any gait, from whichever foot is on the ground (measureStride's half-cycle rule assumes a walk's long stance). On the default body: 1.41 m/s at playback 1; the forest plays it at 1.4× (4 steps a second, 1.98 m/s; the walk is 1.09).

**Jumping apart from the banzai** (2026-10-03, Saori: 「バンザイとジャンプを分離したら？」; `src/motion/jump.js`): the forest had borrowed frames of the cheer jump, so every jump threw both arms straight up and a hard landing crouched with fists at the chin. The jump now has its own poses: `jumpRise` (legs straight, toes down, arms swung forward and up — they carry the jump), `jumpAir` (knees tucked a little, arms out for balance), `jumpLand` / `hardLand` (the knees take it, soles flat with the hips lowered by the legs' geometry, leaning in, arms reaching forward), `fall` (arms up and out, flapping), `crouch`. The banzai is its own pose too: `banzai` (both arms up and down, standing; the cheer jump's arms without the jump). `cheer` (the banzai jump) is unchanged. The climbing base keeps the raised arms as its own copy, so nothing here depends on the cheer jump except `banzai`.
- Arm turns, for writing poses: z turns first (from the A-pose's 46° out; negative brings the arm down to the side), then x (negative swings it forward). An arm reaching forward is `[-x, 0, -0.75]`; with z left near 0, a big x swings it out to the side instead.

**The jump's wind-up, the running jump, crouching and crawling** (2026-10-03, the forest's first phase: the body's moves):
- `jumpCrouch`: a quick dip with the arms pulled back (the forest holds it 0.08 s between the key and the take-off). `jumpLeap`: a running jump — legs split front and back, the arm opposite the front leg reaching forward.
- `sneak` (`src/motion/crawl.js`): walking crouched (knees bent, hips low, leaning in; `sharp`). Its no-slide speed comes from `measureGait`.
- `crawl` + `crawlLimbs(avatar, { body, phase, step, fwd, right, ground })`: on hands and knees, built the same way as the climbing — a base pose (the hips tip the body forward 1.25 rad, thighs hang to the knees, shins lie back along the ground, the head looks ahead) and IK putting the hands and the ankles on the ground, one limb at a time, each holding still for 3/4 of the cycle. It is the climbing gait with the ground as the surface.
- Heights (default body): standing 0.86 m, crouched about 0.62, crawling about 0.4. The game decides what fits under what (the forest: a log 0.48 m off the ground needs a crawl).

**Getting over things with weight** (2026-10-03, Saori: 「もう少し重力を感じる動きがいいな！よっこいしょとよじ登るみたいな。記号的な動きだと没入できない」; `src/motion/mantle.js`): the first pull-up slid the body up and over in one smooth move. Now it is steps, each its own pose; the game times them (longer for a higher edge) and keeps the hands on the edge with IK: `mantleReach` (hands up to the edge, knees giving), `mantlePull` (hauling: leaning in, one knee driven up, the other leg hanging), `mantleKnee` (one knee on the edge, chest over it), then `crouch` and standing up. Over something low: `vault` (weight on the hands, legs tucked and swung to one side, hips turned), then a landing in the knees. In the forest a 0.6 m log takes about 1.5 s to get onto (reach 0.22, haul 0.3 + 0.55 × height, knee 0.3, stand 0.34) and a 0.6 m root about 0.9 s to vault.

**Gliding under a held leaf, and holding a pole** (2026-10-03, Saori: 「登ったところからパラセールみたいに葉っぱでとべたら楽しそう」; `src/motion/glide.js`): `glide` hangs the body from both hands (legs trailing a little and swinging loosely, toes down, head looking ahead; sharp, since IK runs on it every frame). `holdPole(avatar, { at, up, right })` puts both hands on a pole at a world point, the left one a little higher, elbows out. The game owns the held thing (the forest's leaf: its mesh and where it sits); the engine only puts the body under it and the hands on it. The default body's arms are short (0.18 m at 0.86 m tall) and the head is big, so the hands cannot reach above the head: the forest holds the stalk in front of the chin, with the leaf above the head.

**In the water** (2026-10-04, Saori: 「今泳げないし、足がつかないところはいけない」; `src/motion/swim.js`): `swim` is a dog paddle for a big-headed body (the body tipped forward ~55°, the head turned back up so the eyes look ahead and the chin rides the surface, the hands paddling under the chin in turn, the legs kicking behind; `SWIM_W` rad/s at speed 1). `treadWater` stands upright, sculling at the sides and pedalling slowly. `wade` walks through water to the thighs: knees high, leaning in, arms raised out of the water. `swimHead(avatar)` gives the chin's height in the swim pose, so the game can float the feet point at water level minus that.

**Living in the wild** (2026-10-04, from the forest game, Saori: 「システムは後回しで、リアルな環境やモーションを先に全部作っておきたい」; `src/motion/survival.js`): poses for a survival game; the game decides when. The body: `pant` (bent over, hands on the knees, heaving), `shiver` (hugging itself, shoulders up, trembling), `limp` (the right leg stiff, dropping onto it), `lookAround`, `listen` (head turned and tilted, a hand by the face), `hide` (squatting low, arms round the knees, still). The ground: `balance` / `balanceWalk` (arms out, one foot before the other), `slide` (side-on down a slope), `stumble` (a trip caught by a big step), `roll` (a forward roll from a crouch to a crouch: the body turns about the hips, so the hips rise and fall by a measured table to keep the back and head on the ground), `hang` / `shimmy` (from an edge by the hands; the game's IK puts them on it). Water: `drink` (kneeling, scooping water to the mouth), `dive` (level under water, a breaststroke and a frog kick). The hands: `pickUp`, `carry` / `carryWalk`, `throw`, `push`, `chop` (an axe in both hands), `eat`, `fireDrill` (a hand drill, kneeling), `sleep` (curled on the side). One-shot moves loop over their length (`ONE_SHOT`: stumble, roll, throw, pickUp): play from t = 0 and stop after one.

Not yet: hanging by the hands; feet finding holds during the pull-up (the legs are posed, not placed).

### Loading Mixamo / VRM motions (2026-10-02, noted)

With the standard humanoid names (see "Motions written for any humanoid skeleton"), motions made for other characters can be loaded:
- Mixamo (FBX/GLB clips) and VRM motions (`.vrma`) go through a bone-name table, a rest-pose correction (their rest is a T-pose, this engine binds in an A-pose), and a proportion correction (hip height and travel scaled by leg length, or the feet slide and float).
- Expect trouble where the chibi proportions matter: hands near the face sink into the big head; arms folded in front sink into the thick torso. Big-limbed motions (walk, run, swing) transfer well.
- License: Mixamo motions may be used in games, but the files may not be redistributed. The engine can't ship Mixamo clips; users load the ones they downloaded themselves.

## Scope: chibi only, but wide within it

(Superseded 2026-10-06: the default body is the tall standard, about 5 heads, and the chibi types stay. See "The tall body is the default" at the end. What follows is the first plan, kept as it was.)

Low head-to-body ratio only (about 2 to 3 heads). Tall anime characters are well served by VRoid and game engines, and are heavy for browser games built with three.js — the target users here. Within chibi proportions, the goal is range: with effort the same system can make a cute anime girl or a knight in fantasy armor. What that takes:

- **Proportion sliders within the chibi range** (head size, leg length, chubbiness). Joints that these sliders move are computed from proportion values, and the parts attached to them are placed relative to those joints. No separate base bodies.
- **Hair is the biggest quality lever** for cute characters: long hair, layered bangs, ponytails, twin tails, made of strands on spring bones.
- **Hard surfaces** (armor plates, helmets, weapons) don't come out well from the soft blending used for the body. They are built as separate rigid meshes (simple shapes, beveled edges, or loaded models) attached to bones, with detail (engraving, trim) in textures.
- **Clothing beyond basics**: skirts, frills, capes on spring bones (see reference presets).

## Playground look

Two editors, one look (2026-10-02, Saori):
- **(a) the full editor** (the GitHub playground): every feature the engine has, built first.
- **(b) the site's maker**: built after (a), from the same parts. Fewer features, presets up front, the detailed parameters folded away. Same look as (a), not a separate playful style.

The look is "Atelier" (chosen from three tone mockups: a dark studio tool, a warm light one, a technical blueprint one): warm paper neutrals, one indigo accent, rounded panels and pill buttons, monospace for numbers. It should still feel like a dependable tool: clear type hierarchy, consistent spacing, a visible version number, links to the docs and the repository. A dark theme can come later as an option.

Details shown in the mockups that carry over:
- Settings the engine doesn't have yet (e.g. head size, leg length) are shown disabled and marked as coming, not hidden.
- Changes that rebuild geometry say so ("rebuilds the body, about 1 s").
- The sculpt values (about 160 for the body) start folded.
- The panel shows how many values differ from the defaults.

## Languages (2026-10-02, decided)

| where | default | other |
|---|---|---|
| the repository (code, comments, DESIGN.md, AGENTS.md, the options schema) | English (easiest for agents to read) | a Japanese README for people |
| (a) the full editor | English | Japanese toggle |
| (b) the site's maker | Japanese | English toggle |

Both editors take their text from one dictionary (ja / en), so neither language is an afterthought.

## Migration plan (each step keeps the character pixel-identical)

Status: steps 1-3 done (pixel-identical, checked with screenshots and a mesh/skin-weight checksum). `examples/minimal.html` uses `createAvatar` on its own. Sliders wait until the model, hair and motion are polished (relative placement makes sculpting slower).

1. Move pure code (sdf, mesh, rig, materials) into modules; `body.html` imports them.
2. Move body / clothes / hair / face / motion into modules that read an options object instead of URL parameters. Write `defaults` from today's values. Joints moved by the proportion sliders come from proportion values, and their parts are placed relative to them (see "Scope").
3. Wrap it in `createAvatar` and the `Avatar` object.
4. Build the playground on `createAvatar`; retire `body.html` (keep a redirect).
5. `tools/shoot.mjs`, then presets, then docs.

After each step: same vertex counts, and screenshots from fixed views compared against the previous step.

## Where it lives and who uses it (2026-10-02)

Two places, two kinds of people, one engine underneath.

**Decided**
- **GitHub is for people with agents.** They clone the repo, have their agent read it and add parts, and send them back as pull requests.
- **The site is for people who don't write code.** They make a character there and walk around with it. It is a place to visit, not a workbench.
- **No AI and no API keys in the site's maker.** It stays simple: pick parts, pick colors, tune the bangs.
- **An avatar is a recipe**: the options JSON, not a mesh and not code. Saved in the browser (localStorage) first; a server only when people want to show theirs to others.
- **The site only runs the library's own parts.** It never runs code from strangers.
- **Parts flow one way**: a pull request merged on GitHub → the part appears in the site's maker.
- **Its own repository** (2026-10-03, done): the engine moved out of `saori-subaru/devlog` (`site/avatar/`) into `saori-subaru/hinagata`, with its history (the commits since it was moved into `site/avatar/` on 2026-10-02). Private for now; public once the license is decided. Games use it without copying it: `devlog` has it as a git submodule at `site/avatar/` (so the plaza's and the forest's relative paths are unchanged), and the forest game (`saori-subaru/genseirin`, its own repository since 2026-10-03) has it at `avatar/`; devlog has the forest at `site/forest/`, so the site carries the engine twice (both submodules, same commit when in step). Engine work happens here, not inside `devlog/site/avatar/` (Saori: 「これからどんどん進化するよ」 — one source, every game follows it). On npm the bare name `hinagata` is taken (an unrelated scaffolding tool, 0.0.1): publish as a scoped name such as `@saon/hinagata`.

**Not decided yet**
- License.
- Writing parts as data (JSON) instead of code, so the site could take them without running anything.
- `AGENTS.md` with how to send a part as a pull request.
- The first parts are made by the owner.
- Automatic checks on part pull requests (does it fit the art style, is it light enough).
- A treasure hunt in the plaza (`site/lab/plaza.html`): walk, find, wear. If it happens, the gacha prototype (`gacha.html`) is not used — the gacha was only a test. What the prizes are is open: this engine focuses on the base body and template presets, so it may not grow enough parts to hand out as prizes.
- **The old-growth forest** (Moruri's scrapped `ref/jungle/`, 1 unit = 1 m, 128 m square) as the site's minigame place (2026-10-02): a treasure hunt (one-off finds) plus an idle side (set traps, close the site, come back later to collect). Traps run on timestamps in the browser, no server. Maybe also the stage for the "arcade idol" idea. Decided: the idle prototype `lab/idle.html` (放置の森) is dropped (file removed). Progression idea (2026-10-02): collect wood to widen the explorable area, which adds more trap spots.
- **Rewards from the games → character level** (2026-10-02): playing the games gives coins (dress-up, furniture) *and* EXP, because coins alone bore people who don't care for dress-up. Decided: levels are spent on **solo bosses first**; a shared raid boss only if enough people actually come (a raid that depends on headcount is a dead feature on a quiet site). Passing rewards from a game to the site needs the games and the site under one registrable domain (`*.pages.dev` are separate sites): own domain + one subdomain per game is the leading option.
- **Trips load during the ride** (2026-10-02): everything ends up under one domain (user: 「最終的に同じドメインにするつもり」). So a game doesn't open as a new page: the plaza page pulls it into a hidden frame the moment the train (or the warp hole) starts, the game builds itself behind the ride, and on arrival the frame is shown instead of navigating. Navigating would throw the work away; that is how every web page behaves, not an artifact limit. The same frame carries rewards back to the plaza (messages from the game frame), so one subdomain per game still works; plain paths would also share storage directly. Opening a game on its own (not from the plaza) still needs its normal start.
- **Forest map** (2026-10-03, built): the forest is one valley, 128 m wide and 256 m deep, laid out top-down first (`site/forest/src/map.js`) and split into five zones joined only by gates: ① entrance woods → bridge over the stream's pool → ② marsh → boardwalk over the mud → ③ rocks → ladder up a 5 m step → ④ old giants → tunnel under a giant root → ⑤ the boss's lair. Cliffs close the sides and both ends; each zone has one dead-end side path (for a treasure later). Gates are bought with wood (placeholder amounts 5 / 12 / 20 / 30); for now a test button builds them, progress is saved in the browser. Only zones you can reach, plus the next one (visible across the gate), are built.
- **The forest becomes its own game, reached by train** (2026-10-03, Saori: 「原生林はサイト内のおまけコンテンツじゃなくて、ちゃんと独立したゲームにしようかな」「広場からは他のと同じように汽車で行く」). It is one of the station's destinations, like the arena (listed in the plaza's own table, not in `games.js`, so the site's top page doesn't show it yet). The plaza's warp hole stays as an ornament: its card sends you to the station with the forest picked. Inside, you walk as the avatar engine's character; the plaza and the games' arrivals keep the Piilo look (Saori: 「他のゲームの入場演出とかはやっぱピーロがあってるかな」). Still open: whether rewards still flow back to the plaza, how the boss's lair is reached (the warp-hole idea below assumed the forest was part of the plaza), the game's name (「原生林」 for now). The game's own notes: `site/forest/DESIGN.md` (a life-or-death survival, combat allowed; Moruri stays the peaceful one).
- **Where the solo boss lives** (2026-10-02, decided): deep in the old-growth forest. Only people who widen the forest find it. Once found, the plaza's warp hole gains a second destination ("the boss's lair"), so later visits skip the forest (⚠️ written before the forest became its own game, see above: open again). People who haven't found it see nothing new.

## Face parts editor (plan, from Saori 2026-10-02)

When the face editor is built for real (beyond the check page's 枠つきPNGを読む):

- Reading a drawing asks for an **expression name** (e.g. にっこり笑顔).
- Only frames that have something drawn are read; empty frames are ignored.
- Each part that was read is registered under that name in its own slot: eyes「にっこり笑顔」, mouth「にっこり笑顔」, ... (parts accumulate; a later drawing doesn't replace an earlier name's parts).
- The name is also registered as an expression preset: choosing「にっこり笑顔」in the expressions sets every slot that has a part by that name (slots without one keep what they have).
- So one drawing = one expression, and its parts can still be mixed with other expressions'.

**Closed eye (2026-10-03, done)**: a drawn closed eye has its own fixed slot (`face.images.eyeClosed`), apart from named expressions, because the engine itself needs it: drawn eyes (`image`) blink with it (before, they blinked with the code-drawn closed eye, which didn't match the drawing), and the eye part `imageClosed` (絵のとじ目) shows it. On the framed template it is drawn in the frame on the other eye (where the dashed "don't draw" frame was), so both eyes are drawn in place; reading flips it to the side the face draws. Without a closed-eye drawing, blinking stays code-drawn. Not yet in `facekit/` (the PSD template and `cut_face_parts.py`). The same kind of fixed slot will be needed for an open mouth if characters talk.

## Decisions

**The jaw line and the skull's base (2026-10-04, Saori: "the jaw looks heavy; seen from below, under the ear bulges"; then, with a photo of a skull: "the back of the head ends higher, cut off level")**: seen from the side, the underside of the jaw ran level from the chin back to the neck, and the skull's ball reached down below the earlobe, so from below the back of the head showed under the ear. Now:
- the chin cut rises toward the back (`body.sculpt.chin.backRise` 0.7 per m behind `backZ` 0.12, at most `backMax` 7 cm), so the jaw line runs up toward the ear;
- behind the ear (`chin.napeZ` 0) the bottom of the head is level at `chin.napeY` 0.95, about the ear's height, as a real skull's base is, and the back of the neck reaches up to it (`body.sculpt.neck.nape`: a piece behind the neck only; lengthening the whole neck filled the corner under the jaw and joined up the jaw's outline seen from below, which Saori liked broken), so the back of the head ends there and the neck rises into it. The neck piece is thin (radius 4 cm, just behind the neck: a thicker one, further back, made the neck a thick column), and the base stays level (`chin.napeDrop`, a chamfer down to the neck at the back, was tried and looked unnatural; it is 0, and hair covers the base anyway);
- `jawU` is on (the lower face narrows into a U seen from the front: the sharp jaw from below). It leaves a faint crease across the cheek that shows only in the clay view (the face is shaded by its ellipsoid normals), so it stays.
Tried on the way: stopping the jaw's rise at the earlobe (it kept the bulge: the bulge was the skull, not the lobe), a softer `jawU` (lost the sharpness), raising only the sides behind the ear (a notch in front of the ear).

**The pointed chin, again (2026-10-05, Saori: the V chin looked like a skull; then the cheeks only got hollow and the chin stayed round)**: what makes a chin round or pointed seen from the front is the jaw's bottom line, cut by the chin plane, and that line was a flat U (it rose from the middle only as 0.95 x²). Now it rises straight from the chin toward the sides at the front (`chin.sharp` 0.3 m per m of |x|, fading out behind `sharpZ` so nothing changes under the ears; `chin.k` 0.03 so the cut leaves no crease on the cheek), and a small chin tip is added (`chinTip`, with `chin.point` lowering the cut's middle so it stays). The cheeks are not touched (no temple bulge or cheek fill / trim any more, see above). Eyes a little closer (`face.layout.eyeX` 0.088). In the editor: Body → Head → chin sharpness, chin tip.

**A sharp chin (2026-10-05, Saori: the shape, not the shading; round cheeks with a sharp chin, like Genshin's Nahida)**: seen from the front the lower face narrows in a V to a small chin (`body.sculpt.chin.v`: each side cut by a slanted plane, |x| = `halfW` 2 cm at the chin's bottom widening by `slope` 1.3 per m up; the cut fades out toward `y0` (the cheeks stay round) and toward the back (`z0`: nothing changes under the ears)). Off by default (Saori: it looked like a skull; taken back for now); it stays an option, in the editor under Body → Head. Tried first: lowering the chin cut's middle (`chin.point`: there is nothing below it to make a point of) and raising its sides (`chin.sides`: it carved the contour under the ears); both left at 0.

**The chin's edge (2026-10-04, tried and taken back)**: to keep the shadow under the chin off the front of the chin, the head's ellipsoid shading was carried down to the chin's edge (only faces facing down kept the real shading) and the chin cut's corner was tightened (`chin.k` 0.007). Saori could hardly see the shading part, and the tighter corner joined up the outline along the chin from below, where she liked it broken. Both removed; a different approach to come.

**Hair as locks (2026-10-04, Saori: "the hair is all thick, the tips fat, a helmet"; can long hair swing like Genshin's?)**: hair sampled from a distance field can't be thinner than about two grid cells (7-14 mm), so every lock came out thick with a blunt tip, and the hair was one rigid block on the head bone. Now `src/hair/locks.js` builds hair as **locks**: flat ribbons (a lens-shaped cross-section, a sharp point) made straight as triangles, each a chain of points that moves position-based like the skirt (the root rides on the head; the rest falls, keeps a damped motion, is pulled gently toward where the head would carry it, and stays out of the head and of spheres fitted inside the neck, back, shoulders and arms). The chains move in **world space**, so the hair trails when the character moves (running at 2.2 m/s the ends stream back ~20 cm). The mesh is skinned to the head bone; each frame the points are turned back into it (as cloth.js does).
- **Long** (`hair.sculpt.long.locks`): two layers of locks around the back of the head over the short hair's block, draped once at build. The inner layer shades a little darker.
- **Short** (`hair.sculpt.shortLocks.on`): shorter, stiffer locks lying over the block down to its hem, so the back is strands, not a bowl.
- **The nape** (`hair.sculpt.nape`, Saori: "the clipped part bulges; it should curve the other way"): below the back of the skull the short hair's block now follows the head and the neck together (a smooth union, so it runs into the neck with an inward curve) and thins toward the hem; the short locks lie along that surface from the crown to the hem (`surfaceLocks`) instead of hanging from the skull's widest point, and the hem is a U across the back.
- **No step on top** (Saori: "a step between the bangs and the back on top — a helmet from the front?"): the locks' roots were cut ends lifted 3-4 cm at once, the short locks sat 2-4 cm over the block, and the bangs and the back started at different places. Now every lock comes out of the hair gently (its lift and its thickness grow over its first third / fifth), the short locks lie half sunk in the block (the head keeps the block's size), cover 135° each side of the back so they meet the bangs, and the bangs grow from near the crown (`lockRoot` 70°, `lockRootSpread`) where the back's locks start too.
- **Hanging short hair is its own style** (`hair.back: "hang"`, "ショート(たらし)", the default; Saori: rather a hairstyle than an on/off switch): the short locks draped from the back of the head, standing off the curved-in nape, which shows under them. `"short"` lays them along the head (`surfaceLocks`, their shape in `shortLocks.lie`). Both sit on the short hair's block. (It was `shortLocks.hang` for a while.)
- **Long hair following the head first** (`hair.sculpt.long.hug`, off by default): above `long.yc` the drape holds the locks onto the head instead of only keeping them out of it, so they curve in below its widest part and hang only from there, like the old block. Tried on Saori's ask; she then preferred the locks falling straight from the top, so it stays an option.
- **No double gravity**: the rest shape is already draped under gravity and the locks are pulled toward it, so gravity on top made them sag a few cm off it (off the head). Now only the gravity the head's turn takes away acts (world down less the rest's down turned with the head): nothing when upright, the hair falls when the head bends or lies down.
- **The hairline under bangs made of locks** (Saori: the forehead's hairline showed through the gap; then: a hairline that moves with the hairstyle is wrong): the hairline belongs to the head and stays put. What showed was the block's 3.6 cm rim, hidden before by the bangs' own layer; now with nendo locks the block thins toward the front hairline (`nendo.lockTaper`, full thickness 8 cm above it), as hair does where it grows. (A first try lowered the hairline under these bangs instead, and covered the brows: reverted.)
- **A thin block under the locks** (`hair.sculpt.lockShell`, Saori: the bangs used to grow out of the block, now they lie over it, so it can be thinner; the head looked swollen): with both the bangs and the back made of locks the block is 1.6 cm thick instead of 3.6 cm (the ahoge stands on it). The bangs alone in front of a bob keep the block as it is.
- **Moving the tufts in the editor** (Saori: the test page's tuft dragging should be in the editor too): Hair tab → "Moving the tufts". A dot per tip rides on the head bone; dragging moves the tip around the head and up or down, releasing writes `hair.sculpt.nendo.tips` (one undo step) and the engine rebuilds only the bangs. The picked tuft's sweep and extra thickness are sliders; the lock shape (overlap, split width, thickness, puff) are main values in "Bang tufts". The old block's slope / skew / thickness don't shape the locks, so they are not offered there.
- **Flick out / curl in per tuft** (Saori): a tip row's 8th value (m) bends the lock away from the head and up (> 0) or in toward it (< 0). Since 2026-10-05 (Saori: "全体がななめに移動してる。途中からカーブしてくるんとはねる、顔に沿うみたいに") it is a real bend, not a shift: straight down to its middle (a hanging tuft: halfway down its hanging part), then each link turned a little more than the one before (`bendLock`, hair/locks.js; ±0.04 turns the tip about 150°), and a lock curling in stays 2 mm over the forehead, cheek or jaw it meets, so it follows the face. The back locks' flick (hanging and long, and one lock's own) bends the same way, kept out of the head and the body. In the editor's tuft tool as "はね(+) / 内巻き(−)" for the picked tuft.
- **Sweep as a curve** (2026-10-05, Saori: "流れも毛先が横に移動してるだけ。毛先をその方向にカーブさせる"): a tuft's sweep (the row's 6th value) ran each lock straight from its root to the swept tip, a slanted lock. Now the lock heads for the unswept tip and curves over to the swept one in its lower part (the offset grows with the square of the way past 40% of it). The block bangs' sweep is squared the same way (it bends near the tip instead of slanting).
- **Long, thin tufts** (Saori: e.g. one thin, long strand hanging at the side): a tip row's 9th value is the tuft's width (×, a narrow tuft splits into fewer locks), and a tip can go down to the waist in the editor: below `nendo.lockHangY` (0.86, head space) the tuft leaves the head and hangs straight down, softer (it swings like long hair) and kept off the neck, shoulders and chest. (Below the waist the hair would go through the legs and bottom, which have no colliders: not offered.) The long back hair goes down to the thighs since 2026-10-05 (Saori: "ロングヘアの長さいじれなくない?"): the locks' colliders have the bottom and the backs of the thighs now, and its slider is "長さ", right = longer (`reverse` in the schema: the value stays the tips' height). A hanging tuft leaves the head where the head is widest above that height (at the sides `lockHangY` is below the jaw, where the surface is the neck: side tufts hung from the neck as narrow as its radius, a row of strings; 2026-10-05, Saori's Nahida), its locks gather under the clump's middle as they fall, and it turns its flat side to the front where it hangs (`front` on a lock spec, createLocks).
- **Back locks in the editor** (Saori): Hair → "Back locks" for the hanging short hair (count, width, thickness, extra length, flick / curl, stiffness), the lying short hair (`shortLocks.lie`) and long hair (count, width, thickness, tip height down to the waist, flick / curl, stiffness). `avatar.setLocks(group, values)` rebuilds only the back locks (long ~0.7 s: they are draped), so the editor rebuilds them once a slider rests. `flick` bends the hanging locks out (> 0) or in (< 0) toward the tip.
- **Back locks one by one** (Saori): Hair → "Moving the back locks" (hanging short, lying short and long hair). A dot on each lock's tip: up / down makes it shorter or longer (down to the waist), left / right turns the whole lock around the head; the picked lock has width, thickness and flick / curl sliders. Kept as `hair.sculpt.<group>.edits: [{ i, dy, da, w, th, fl }]` by the lock's number (changing the count moves them to other locks); `avatar.backLocks()` gives the tips for the handles.
- **Drawn locks** (`hair.drawn`, Saori: draw the tufts like a picture): in the editor (Hair → "Drawn locks" → "Draw on the character") a stroke from a lock's root to its tip becomes one lock: over the hair it sticks to it, lifted by half its thickness (over the face, the body and the clothes only where they would hide it: a side lock drawn down to the shoulders stuck to the face's outline, 2026-10-05); off it, it stays in the plane facing the camera through the last point it touched (draw from the side to bend it sideways; a loop drawn from the front is a loop seen from the front: twisting curls like ringlets can't be drawn on a flat screen). Points in head space; brush width, thickness, how firmly it keeps its shape, mirror. The engine resamples each stroke (`drawnLocks` in hair/locks.js) and they swing like the other locks; `avatar.setDrawnHair(list)` rebuilds only them. "描いた毛束を動かす" (2026-10-05, Saori) gives each drawn lock three dots: the root moves the whole lock (onto the hair under the pointer), the middle bends it there (root and tip staying, a sine bump along its length), the tip turns and stretches it around its root with its shape kept (a rotation and a scale). A mirrored lock has dots on both sides. (The bangs' and the back locks' tools have one dot each, at the tip.)
- **My hairstyles** (editor; Saori): the whole `hair` of the recipe (style, shapes, tufts, drawn locks; not its color) saved by name in this browser (`hinagata.editor.hairs`), put on any character with one click.
- **Nendo bangs** (`hair.sculpt.nendo.locks`): the same tips Saori drew (angle, height, sweep) become locks from the top of the head; a wide clump splits into several locks gathering toward its tip (`lockSpan`, `lockRise`), with a little puff over the forehead (`puff`).
- Each of the three switches back to the old block with its flag. Hime, side, bob and flip are still blocks for now.
- **Two kinds of clumps** (2026-10-05, Saori: "かたまりのふさタイプの髪型を追加して、分け目は消していい"): the bangs "block" (ふさ(かたまり)) are the nendo tips as the old one layer, next to "nendo" (ふさ(毛束)) as locks; the tuft tool moves both. The "parted" bangs are gone (a tuft hung in the middle of the parting): old recipes' "parted" become "block" (`bangsId`, options.js), whose tufts can be dragged into a parting.
- Not yet: the angel ring and the strand lines were painted on the block, which the locks now cover; a skirt-like collision between locks; bob / flip / hime as locks.

**Clean shadows (2026-10-04, Saori; done)**: the toon bands stained the character: a band across the lower face, blotches on the shirt and the hair. The bands followed the mesh's normals, which carry every small bump where the blended shapes meet; three bands made twice the stains, and are too many for chibi characters anyway. Now:
- **2 bands by default** (light / shadow; `shading.bands: 3` keeps the old mid tone). The shadow is a little violet, not grey (three's toon shader only reads the ramp's red channel, so `toon()` reads its color). The ramp is 64 filtered texels: a crisp edge without jaggies. The edge sits at dot(N, L) = 0.2, so the side away from the light shows some shadow from the usual front-right view.
- **Shading normals** (`shadeN`, `smoothNormals` in `sdf/mesh.js`): each part's normals averaged with their neighbors' over about 2.2 cm (`shading.soften` scales it, 0 = the mesh's own). A neighbor only counts when it faces within 60°, so hems, rims and both sides of a strand stay apart. Body, clothes and hair; armor and weapons keep their hard edges; a skirt keeps the cloth's normals. The clay view and the outline use the real normals. ~0.15 s at high quality, not cached (it's cheap and follows `soften`).
- **The hair shades as one volume**: its shading normals lean 60 % toward the direction from the head's center (or from the vertical line under it, for hair hanging down), the way anime games do it, so light and shadow split the hair cleanly instead of strand by strand.
- **The face**: the head's ellipsoid normals (face.shading) are now taller and lower (y 0.96, radiusY 0.7) and reach down to the chin (head-space y 0.80–0.86), so the front of the face stays lit and only a thin shadow is left under the chin.

Decided: working name "Hinagata" (check npm before publishing); code-drawn face is the default; first body sliders are head size, chubbiness and leg length; chibi proportions only (2026-10-06: no longer, the default is tall).

**Drawn expressions and the face sheet (2026-10-04, done)**: drawn faces had one expression only (絵), so a character drawn by hand could not smile. A first try gave drawn versions of the four code expressions (fixed slots); Saori wanted her own, so it is a free list now: `face.drawn` = `[{ id, name, eye, brow, mouth, cheeks, blink }]`, as many as wanted, each named (泣く, 照れ, ウインク…). Each adds the expression and part ids `image@<id>` (listed by the avatar: `face.PRESETS`, `face.presetName`; `checkOptions` accepts them when the list has that id). A part not drawn falls back to the ふつう picture (`face.images.*`); the closed eye and the nose stay single slots; `blink: false` for expressions whose eyes are already closed. `src/face/sheet.js` makes the templates and reads them back: "parts" (the face picture's own 1024×768, as `body.html` had) and "sheet" (a header strip, then 3 tiles across: ふつう with all five frames, one tile per drawn expression in list order with its current parts faintly as a guide, and a how-to tile). A sheet is read by position, so it belongs to the list it was made from: the header says how many, and reading refuses a sheet whose row count doesn't fit (`err.code "count"`). Only frames with something drawn in them are read, so redrawing one part means drawing just that frame; `sheetChanges()` turns what was read into option changes. The editor's face tab has the list (rename, ぽっ / まばたき, remove) and what each expression has. Saori: テンプレってどの表情でも一緒でしょ — so the editor uses one template (the one-face "parts" kind, shown on screen with a save button, as the test page does; it used to download silently, which read as "the template is gone"). 描いた絵を読みこむ adds a drawing as a new expression at once, named 新しい表情 (2, 3 …) and renamed in its row (Saori: 読み込んだら「新しい表情」みたいな名前で登録されて、変えられるでいい); each row's 絵を読みこむ(上書き) redraws that expression — `readFaceSheet(avatar, im, { into: id })`, only the parts drawn are replaced, Undo brings them back (ふつう reads all five frames). The sheet kind stays in the library (all expressions in one file) but the editor doesn't offer it; one-picture loading moved to Advanced; drawn expressions join the expression chips and the part selectors. (Saori: エディタでもテンプレ一枚を読み込みたい / 表情も一種類しか登録できない)

**Its own site (2026-10-04)**: the engine's pages were only online through the station (devlog deploys the latest hinagata `main` into `/avatar/` when the station itself deploys), so a push here waited for some devlog push. Now hinagata deploys itself to Cloudflare Pages on every push to `main`: `https://hinagata.pages.dev` → the editor, `/body.html` → the test page (`.github/workflows/site.yml`; the project is made on the first run; secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in this repository). `build_site.sh` serves the same files devlog serves from it — notes, PSDs, scripts, `tools/ docs/ facekit/ examples/` and the reference sheet stay out (the repository is private, the site is public). The station keeps taking the engine into `/avatar/` as before (its games load it from there). (Saori: サイトを持たせたい)

### "fine": "high" thinned (2026-10-05; first as "game", see the next section, Saori: "geminiは原神のキャラでも三万〜五万頂点、高画質版でも三万あれば十分のはずって"; done)
- Gemini was right in principle: a grid spends its vertices evenly, flat or curved, while a hand-made model (or meshoptimizer) spends them where the surface turns. So "fine" builds at the high quality's 6.8 mm cells and thins to 22% (`simplifyWithAttributes`: the normals count, the face is kept as built): about the vertices the old 13.6 mm game had (the default character 41k → 37k, a Nahida trial 53k → 50k), and side by side it can't be told from "high".
- Cloth is the exception: the skirt and the cape are built at the cells they had (`partClothCell(13.6 mm)` = 10.5 mm, `clothH` in partSpec) and not thinned. Thinned (to 45% or 70%), their uneven triangles drew broken outline strokes over a seated lap, and unthinned at the high cells the cloth simulation cost a third more (a dress with a cape and long hair: 29 → 41 ms an update). As built, it costs what it did.
- The cost: the first build takes ~5 s instead of ~1.5 s (the high grid; thinning itself is a few hundred ms). The cache returns it at once after that. Without meshoptimizer (offline, blocked CDN), "fine" warns and builds the old way (13.6 mm, unthinned) instead of failing; an explicit `simplify` still fails loudly.

### A game's start and frame time (2026-10-05, Saori: the tennis game made with Hinagata was far below the one made with plain three.js, "キャラの読み込みにすごい時間かかった"; done)
- The plain game's characters were capsules and boxes: built in milliseconds, no simulation. Ours are built from distance fields in the browser and their hair and cloth are simulated every frame; both costs have to stay small or the engine drags the game down.
- The tennis page took 14 s to start; the two characters were 3.5 s of it. 10 s went to `measureGait`: it reads the feet over a run cycle at 97 times, each with `update(…, { instant: true })`, and every instant update settled the hair (20 steps) and the cloth (10). Measuring needs only the bones: those calls pass `detail: "off"` now (it holds with instant too). The page starts in 3.7 s.
- "game" as "high" thinned (the section above) built 3x as long: two players 3.5 s → 9.9 s. "game" is the 13.6 mm build again; the thinned one is "fine".
- Armor that isn't worn is no longer built up front (it was, so putting it on was instant): it is built when put on (`setWorn`, on the main thread, ~0.2 s at "game"). `settings.spare` builds it anyway; the editor passes it. This saved less than hoped: the PROF times of worker parts include waiting in the queue, the empty parts cost little.
- Level of detail: `update(dt, { camera })` measures the character's height on the screen. At 25% of the view's height or more the hair and cloth are simulated every frame, from 10% every 2nd, below that every 4th, off the screen not at all (`avatar.detail`; `{ detail }` sets it). A step for several frames pulls toward the rest shape as much as those frames would have (`1 - (1 - k)^n`: without it, the long hair and the cape streamed out flat behind at "low"), and the hair's forces get the share n small steps would have moved it, (n + 1) / 2n. Characters start at a random frame of the cycle, so several take their frames in turns. A dress, a cape and long hair: 29 / 14 / 6 / 0 ms.
- Not done: a lite-first, refine-later load. Even "lite" evaluates the same shapes, so it is only ~1.5x faster to show (two players 1.7 s against 2.2–3.5 s), and the refining would run while the game is played. Shipping the built meshes with a game (a file next to character.json) would make the start instant at any quality; left for when it is needed.
- llms.txt now starts with "the game is the job": the agent spends its time on the game (rules, controls, camera, UI, sound, a bot that plays it), starts the character in a few minutes and leaves the fine-tuning to the user; and "Keep it fast" (pass the camera, quality, measure once). The tennis example is no longer pointed to as a model.

### Dressing another rig: avatar.follow (2026-10-05, Saori: the plain three.js tennis game with Hinagata characters; "着せ替え作っていいよ")
- The experiment first: the plain game's mannequin (capsules on a joint tree, world-axes at rest, arms straight down) was dressed in tall Hinagata characters in about 100 lines, its animation code untouched. The arm directions matched to within 6° (the spine shared over three bones accounts for that); hands looking closer to the face were the 4.5-heads body, not the copying.
- `src/follow.js`: each joint's turn from its rest (root space) → the bone's turn from its rest, conjugated where the rest directions differ: a limb bone gets `off⁻¹(parent) · turn · off(self)`, `off` turning the avatar's rest direction onto the rig's (hands and feet ride with the forearm / shin's). A rig with one spine joint: its turn split 0.4 / 0.3 / 0.3 over spine, chest, upper chest (powers of one turn: they multiply back to it). Hip height: the rig's pelvis rise, in the avatar's units (÷ scale ÷ legK). The avatar takes the rig root's world place; `attach` moves a held object onto the bone, wrapped in `off⁻¹ · rest` so it sits as it did.
- The collarbones: with arms raised over the head (the mannequin's celebration) the shoulders sank into the arm. The avatar's own poses lift the shoulder bone (level 0.15, straight up 0.28: tPose, cheer); follow lifts it by the arm's angle from straight down (0.3 · (a − 0.7) / 2.2, clamped), the upper arm turned back by the same so the arm points where the rig's does.
- `fit: { height }`: a chibi fitted by its legs to a tall mannequin stood 2.5 m tall; by height it is 1.72 m like the others.
- The pose is an ordinary entry in POSES (`__followN`, `sharp`), so blinking, the hair, cloth and LOD all work as usual.

### A character's own expressions: face.expressions (2026-10-05, Saori: "表情が笑顔とかになるなら、キャラクターごとのセット単位に")
- A game asks for names (`EXPRESSION_SET`: normal, happy, sad, angry, surprised); `setFace(name)` takes the character's own version first (`face.expressions[name]`: parts by slot, drawn ones too), then for "normal" the face it was built with, then the stock expression. Stock "sad" and "angry" were added.
- Editor, face tab: "表情セット" rows: "今の顔を登録" stores the current face under that name, "見る" shows it, "戻す" drops it. It is one value in the schema (`whole`: not walked into), applied by `setExpressions` without a rebuild.
- body.head.scale goes down to 0.6 (was 0.8): about 0.7 makes a tall body some 5 heads tall ("もうちょっと頭小さく").

### No outlines inside the hair (2026-10-05, Saori: "髪の部分にやたら線がおおいね。内側の房には輪郭線出さないとかできないかな")
- Every lock has its own outline shell, so wherever a lock lay over another lock or over the hair's block, a line crossed the hair. Now the hair's surfaces (hair, locks, bangs, drawn, tails) write 1 into the stencil where they are drawn, and their outline shells are drawn after them (renderOrder 1) only where the stencil isn't 1: the outer edge, and the edges over the face, the body and the clothes, keep their line; between the locks there is none. Ties keep theirs everywhere.
- Then (Saori: "ごめん後ろ髪のことだった。前はあっさりしちゃうから"): `outline.hairInner` "front" (default): the bangs and drawn locks keep their lines everywhere (also over the back hair), only the back hair's block, its locks and the tails draw theirs off the hair; "none": no hair outline over the hair; "all": as before. Applied by setOutline and checked every update (rebuilds and setShading replace the hair's materials). Needs a stencil buffer (three's default until r163); without one nothing changes.

### Hair and capes at a sprint (2026-10-05, Saori, the tennis game: "走ると髪のなびき方が直線状になってなんかへん")
- The locks were simulated in world space with their velocity damped against the world, so the avatar's own speed acted as an air drag without limit. At a run's 2–3 units/s that streamed the hair nicely; a tennis player runs 7 m/s, and the hair (and the cape) lay out flat behind in a straight line.
- Now a lock's swing is damped against the head's motion (horizontally too, as it already was vertically), and the stream comes from the wind alone: the avatar's own horizontal motion through the air (smoothed), plus a pose's `air` played in place, softly capped at 3 of the avatar's own units a second (`3·tanh(w/3)`, scaled with the avatar). DRAG 2.4 → 10 (the wind now does what the world's drag did). The wind flutters along each lock (±35%, and a little up and down), so the hair streams in waves, not a ruler line.
- The cape's carry (its free points left behind as the character moves) is capped the same way: at most 3 units a second's worth per frame.

### The retest, and what is next (2026-10-05)
- `examples/tennis-agent/`: a fresh agent told only 「https://github.com/saori-subaru/hinagata のツールでキャラを作って、three.jsでテニスゲーム作って」 with the rewritten llms.txt (it read only the internet: checked in its transcript). 55 min, full rules, crowd and boards, a title / close-up / results, a bot played every level without errors; two Hinagata characters with their own swings. Far better than the first attempt (`examples/tennis/`, whose serve didn't work), but Saori still finds the plain three.js game (`examples/tennis-dressed/` is that game, dressed in Hinagata with `follow`) the better game.
- Why: not the missing sports moves (the plain game wrote its own swings too) but the rig the moves are written against. The plain agent designed its own mannequin (arms straight down, axes of its own choosing); ours had to learn the A-pose arms, the twist and the racket's angle by trial, wrote its own aim helpers and went round six screenshot rounds, and the 0.35 s pose ease softened its swings. The dressed game shows the rig itself is fine (the mannequin's moves copied within 6°). And the chibi default pulled the game toward a toy (the court shrunk to the chibi's height).
- What to do next is in TODO.md (宿題): recommend moves made on the game's own simple rig and dressed with `follow`; aim / hold / instant-switch helpers for posing the avatar directly; the sync helper for several files; and a retest.

### The joints to pose by hand: avatar.joints (2026-10-06, Saori: "mvp制作の補助としてhinagataを制作したのに、使うことによってかえってゲームのクオリティが下がったり、手間取って時間がかかったりすることが問題")
- The measure: a game made with Hinagata must take no longer than one made without it, and be no worse. The retest agent lost its ~20 min to the bones' rest: they bind in an A-pose (arms 44° down), so "swing forward" (x) swung an arm out sideways, and the twist and a racket's angle were found by trial.
- The bind pose stays (the body is built from distance fields and skinned in it: arms down, they would melt into the sides; it is also where the shoulders bend least). What changes is what a game writes moves against: `avatar.joints`, a tree of Groups inside the avatar's object (hips, spine, chest, upperChest, neck, head, arms, legs; no collarbones: they rise by themselves), rotations zero at rest, the world's axes, the arms hanging at the sides as in idle (straight down they would be in the hips). The avatar follows it through `follow` (its own rig, `place: false`: the avatar's object isn't moved). Saori asked why not the T-pose, the standard: it is the standard for exchanging motions (VRM, Mixamo: converted at the door); written by hand, the arms near the body (where a game's moves mostly are) give small angles with the same sign on both sides.
- `play("joints")`, `play(name, { blend })` (seconds; 0 switches at once: the 0.35 s ease softened a swing), `copyMotion(name, t)` (a built-in move written back onto the joints: off(parent) · bone turns · off(self)⁻¹; walk, run and sitChair come back exact, cheer and wave within 3 mm, guard not: its arms depend on the weapons), `hold(object, hand, { along, face })` (the object's axis through the fist past the thumb / the axis facing as the palm does, at the fist's middle `HANDS.G`, the hand closed by `held` in the pose player, kept at its world size).
- llms.txt: a section "Your own moves: pose the joints"; and the chibi look doesn't set the game (the retest's game turned childish and simple: Saori).


### The tall body is the default; recipes have a version (2026-10-06, Saori)
- Why (Saori): the default character was a chibi (about 3 heads) only because the chibi was the easier one to build first. When people ask an agent to make a game with Hinagata, the agent takes the chibi default, shrinks the game's world to its 1.35 m and the game comes out childish (the tennis retest: the court shrunk to the chibi). The tall body should be the default, and the chibi stays fully available. Her rule: the world's scale comes from what the game is, not from the default character; a chibi game may scale its world to its chibis.
- The default body is `BODY_TYPES.standardTall` (legs 1.65, torso 1.3, head 0.82, the standard's torso with slimmer limbs and belly; the same evening: legs 2, head 0.7, see the next section): `createAvatar()` without body options gives it, about 1.62 units tall (the chibi types 1.36). Nothing else in DEFAULTS changed. The neck's width still follows the head relative to 0.9 (`HEAD_SCALE0`, now a constant; read from DEFAULTS it would have thinned every neck). Every BODY_TYPES fragment sets all of torso, thickness, proportion and head.scale, so `BODY_TYPES.standard` (and girl, sturdy, toddler) gives the same chibi as before on the new default; checked for every type against the old engine.
- The old default body was not `BODY_TYPES.standard`: it had the toddler's torso and limbs (all 1, thighTop 0.9). That is what old recipes are read with.
- Recipes are "only what differs from the defaults", so a new default would have turned every saved chibi tall. So recipes have a version (`RECIPE_VERSION` 2, options.js) and what each change of the defaults replaced is kept (`OLD_DEFAULTS[2]`: the chibi body). `openRecipe(input, { bare })` is the one door for every recipe coming in: a character file `{ "hinagata": n, "name", "options" }` says its version; bare options are `bare` (today's by default). A recipe of an older version gets the old values filled in under it, so it comes out in today's terms as the same character. `recipeAt(version, options)` writes one back at an older version; `characterFile(options, name)` makes today's file.
- Which is which: version 1 = stored without a version, made against the chibi defaults: bare recipe files (the sync helper's character.json, agents' files written before), `{ "hinagata": 1 }` files (the editor's export until now), the editor's characters saved in a browser (the library's `v` was 1; on loading it is brought to 2 once, each recipe with the old body written in), `?o=` links made before (the editor and body.html). A bare options object passed in code is today's: code is written against the docs of its day, while files and links were saved under the old defaults. `createAvatar(url)` fetches a file, so a bare file there is version 1, the same file the sync helper and the editor read that way.
- Writing: the editor's export and its links carry the version (`{ hinagata: 2, name, options }`; a link is that JSON in `?o=`). The sync keeps a file's form and version: a bare file stays bare and is written back relative to the chibi defaults, a character file stays one; a new file is `{ "hinagata": 2, "options": {} }`. sync.mjs (no dependencies) only knows where the options are in a file; the editor does the versions. `get_recipe` tells the agent when a file is version 1.
- The editor: a new character is tall; the body type rows (ちび / 高頭身) as before. The camera frames the first character for its height and frames again when a character of another height is built (it was framed for the chibi). The demos, sitting (the chair scaled), climbing, mantling, hanging, vaulting, crawling and the measures were already relative to the body: checked on the tall default (stride 1.13 against the chibi's 0.70, leg 0.56 / 0.36).
- body.html: builds the default (tall); its views, written for the chibi, have their heights put on the body's stretch (`fy`: the face views still look at the face) and the whole-body views step back; every body type (chibi and tall) with its proportions and head size. The three-view comparison with the reference sheet is a chibi's: pick 標準(ちび) or 幼児(ちび) for it.
- Examples: tennis/ and tennis-agent/ files are marked version 1 (they stay chibi games); tennis-dressed reads pasted links and files through openRecipe; minimal.html sizes its character to 1.7 m in a world in metres.
- llms.txt starts with "scale and body": build the world in metres, size the character to it, the default (tall) unless the user asks for chibi / cute / kids, nothing childish unless asked; the character file with its version; the first code example picks the body and sizes it.
- Games that pin Hinagata as a submodule are not affected until they update. The forest (genseirin) builds its recipe from `BODY_TYPES` (its own recipeOf: always a whole body type, then scaled to 0.86 m by its measured height), so it gets the same chibi; "kid", which its picker still offers, was already gone and falls back to standard. The saon site (devlog) no longer has the submodule: `/avatar/` passes through to hinagata.pages.dev, so it follows main (the editor's saved characters on that origin are brought to version 2 on the first visit).

### The tall body at about 5 heads; recipe version 3 (2026-10-06, Saori)
- Why (Saori, an animator, looking at the tall default): "普通に頭でかすぎてバランス悪い" — the head too big, the balance off. Then, on the
  first tries: "今の高等身で頭の大きさだけ0.7くらいにしたらいいんじゃない？ あと足が短過ぎる気がする" — keep the tall body, the head about 0.7,
  longer legs. The default stays tall; the chibi types stay as they were.
- Measured (chin to crown without hair, against the height without hair, from the built head's distance function): chibi 2.97 heads (head
  0.43 of 1.27), the first tall default 3.92 (0.39 of 1.53; it was called "about 4.5"), the new tall 4.77 (0.33 of 1.58; with the hair on
  top, 1.68 high). The hip joint at 0.48 of the height (was 0.42).
- The tall types (src/body/types.js `tall`): legs 1.65 → 2, head 0.82 → 0.7, torso 1.3 as it was, the same thickness. Tried legs 1.8 / 1.9 /
  2.0 at head 0.7 side by side (4.58 / 4.67 / 4.77 heads); 2.0 looked balanced. The face, the hair and the drawn parts scale with the head as
  one, so they keep their look (no oversized eyes, no helmet hair: the same face, smaller); expressions checked.
- Later the same evening, two changes from Saori looking at it in the editor:
  - "足の長さ伸ばすと股上ものびる": the legs' stretch ran from the ankle up to the hip joint, but the pelvis reaches about 0.08 below the hip
    joint, so the bottom of the pelvis was stretched with the legs: the crotch hung low and the rise looked long. The legs now stretch from
    the crotch (hip joint − 0.08) down (src/body/index.js makeStretch). This shortens every tall body by that band × (legs − 1); the legs
    below the crotch are as long as before.
  - She set legs 1.76, torso 1.13, arms 1.17 by hand and asked for them as the default ("その値を既定にしておいて"): the tall types and DEFAULTS
    now use them (were legs 2, torso 1.3, arms 1.45). Version 3 was not published before this, so it is not a new version; the two
    presets (src/presets.js) pin the values they were made with.
  - She also said the body lines (the hip-to-thigh line, the flesh between the legs) are not finished for the tall body: the shapes were
    tuned on the chibi and are only stretched. To do: re-sculpt them for the tall body, part by part, from her notes.
- The arms: stretched with the torso (as the chibi's are), the hands of the longer body only reached the crotch, the hand stretched upright
  by the torso. Lengthening the arms in the stretch's terms either put the hands below the hip joint, where the legs' stretch (×2) would pull
  them long, or laid the rest arm flatter, and every pose (written on the A-pose) then held the arms out from the body. So arms can have a
  length of their own: `body.proportion.arms` (×, null = stretched with the torso, as before and for the chibi): the arm is laid out at the
  stretched arm's angle, that many times the base arm's length, and isn't stretched at all; it rides up with the shoulder (makeStretch's
  rigid arms: a vertex moves by its skin weight on the arm bones, fwd for the rest; the bones by `ST.bone`; the paint, the culling under the
  clothes and the jaw shade read the points where they were made, `basePos`; the body read in place for colliders looks for the arm where it
  went). Tall: 1.45, the fingertips on the upper thigh in the idle pose. `body.proportion.hands` (×, around the wrist; tall 1.1: unstretched,
  the chibi's hands looked small), `body.proportion.shoulders` (×: the shoulder joint out, the shoulder's flesh, the slope from the neck,
  the chest and the armpit's cut with it; sturdyTall 1.1, the others 1). The hand keeps its angle to a steeper forearm (handFrame), held
  things and weapons follow it; the meshing boxes around the arms grow by `armReach`. Ported from the stopped 7-head attempt (hinagata-wt-real),
  without its grown-up face changes (a chibi face at 7 heads looked like a monster; at 5 heads the face needs nothing).
- Ranges: legs up to 2.4 (was 2), torso up to 1.7 (was 1.6); arms 0.8–2, hands 0.7–1.5, shoulders 0.85–1.5.
- Versions: recipes are only what differs from the defaults, so the version went up to 3 (`RECIPE_VERSION`), and `OLD_DEFAULTS[3]` keeps
  what changed (legs 1.65, head 0.82, arms null, hands 1, shoulders 1). A version 2 file, link or the editor's library (`v: 2`) is read with
  the first tall body, exactly (checked: the same 3.92 heads); version 1 and bare files with the chibi (2.97, arms null). The editor's export,
  its links and new sync files write version 3; the sync keeps a file's own version and `get_recipe` says which body an older one means.
  Bare options in code are today's (the 5-head body).
- The editor's face view looks at the face wherever the head is and comes nearer as the head is smaller (it framed the chibi's head).
- Checked on the new tall (editor, a comparison page): walk (stride 1.35 against the chibi's 0.70), run, sitting on the chair, jump,
  pulling up onto a ledge, climbing a wall, hanging from an edge, gliding under the leaf, crawling, swimming; avatar.joints, copyMotion,
  hold; a skirt with long sleeves, a dress, a cape with a sword and shield, full armor with a spear, long hair running. No console errors.

### Thinning that keeps the shape, and a check for it (2026-10-06, found by the forest; Saori: "おおもとのエンジンが改悪された")
- What happened: the forest (saori-subaru/genseirin) builds its chibi with `createAvatar(recipe, { simplify: 0.15 })`. Moved from 12483f8 to
  3269ae5, the body went paper-thin from the side (the grass skirt a cup), on phones too. 0.25 held, but weighed about twice as much; the
  forest went back to 12483f8.
- Why: not the error limit. 12483f8 thinned with `target_error` 1 too (the triangle count decides), positions only. b571629 (the lite quality,
  2026-10-05) kept the face as built (`vertex_lock`, so the outline doesn't draw lines on the cheeks) and counted the normals, but still asked
  for `simplify` of the *whole* mesh's triangles. The face kept took the share from the rest: a chibi's face is about a fifth of its body
  (4.3k of 22.4k triangles at 13.6 mm), so at 0.15 the rest of the body had to go to almost nothing: the torso flattened to a third of its
  depth, triangles spiked from the shoulders to the thighs, the version-less chibi's shins vanished, the tall body lost 30% of its depth.
  Tried: without the lock everything held (98–102%); without the normals (12483f8's way) too; weaker normals were worse.
- Now (`simplified` in src/index.js): the share is of what may be thinned, and the face's triangles come on top of it
  (target = face + share × the rest). And a brake: `THIN_ERROR` 0.01, thinning stops before the shape (with the normals) would change by more
  than 1% of the part's size, even short of the count. At 0.15 the body changes by 0.3–0.4%, so it doesn't hold today; it is there for the
  next share that asks too much. The cheeks keep the face as built, as before.
- The check (`node tools/thin-check.mjs`, tools/thin-check.html; one command, headless Chrome over the DevTools protocol, no dependencies):
  four bodies (the tall default; the forest's chibi with its grass skirt; a version-less recipe file, read with the old chibi defaults; the
  slim girlTall with a skirt), each built unthinned ("game" cells, simplify 1: the reference) and at "fine", "lite" and simplify 0.15,
  cut across at the hips, waist, chest, upper chest, head and shins (the body with its clothes: the body isn't drawn under them). A cut whose
  depth (front to back, near the middle) or width is under 90% or over 112% of the reference's fails (thin, or spiky); exit code 1. It writes
  front and side pictures with the numbers (thin-check-out/thin-check.png) and the cuts and per-part triangles (thin-check.json). Run it after
  changing the engine (CLAUDE.md). `--only case`, `--runs full,s0.15` (an older engine without "fine" / "lite"), `--out dir`.
- Numbers (triangles of what is drawn, outlines not counted, one character; the browser's renderer.info counts shadows too, about 2x):

  | | 12483f8, 0.15 | 3269ae5, 0.15 (broken) | now, 0.15 | now, lite | unthinned |
  |---|---|---|---|---|---|
  | the forest's chibi | 20,255 (10.3k vertices) | 30,487 | 33,207 (16.8k) | 26,067 (13.1k) | 66,513 |
  | tall default | — (no tall body then) | 20,164 | 22,617 (12.1k) | 16,037 (8.7k) | 56,275 |
  | version-less chibi | — | 17,516 | 19,616 (10.5k) | 17,096 (9.2k) | 70,373 |
  | slim (girlTall) | — | 28,244 | 30,752 (16.0k) | 24,172 (12.6k) | 70,653 |

  The forest's chibi at 0.15, by part: body 3,352 → 6,978 (the face kept, 4.3k), grass skirt 1,830 → 9,800, hair and locks the same (15k).
  The skirt is the weight: since 711507b cloth is meshed finer at the game cells (16.3k triangles unthinned, was 5.7k), and since the lite
  quality it is thinned less (0.15 × 4 = 60%: from big triangles the inside showed through). Not changed here: thinning cloth harder needs
  Saori's eye on a moving, seated skirt. "lite" (lighter locks too) is the forest's lighter choice: 26k.
- "fine" is heavier by the same rule: its face (at 6.8 mm, 15% of the body) now comes on top of the 22%: the default character 59.7k → 65.1k
  triangles (31.2k → 35.4k vertices; "game" has 56.3k / 32.8k). Its look is unchanged or better; lower FINE's share if the vertices matter.
### Where the tall body's length goes; bangs off the forehead (2026-10-06, Saori: "走った時に前髪がおでこにめり込む", "高等身にしたとき胸が引き延ばされてたてにのびる", "股の間の謎のたるんだ肉")
- The stretch (makeStretch) put the legs' length evenly from the ankle to the hip joint and the torso's evenly from the hip joint to the neck. The crotch's underside (0.406 at the base) is below the hip joint (0.44), so it was stretched with the legs (×1.65) and hung down between the thighs as a long tongue; the chest's round front went long (×1.3).
- (Merged into main 2026-10-07: main's own fix — 9383ce4, the legs stretch from the crotch down — was kept; the chest share below, body.proportion.chest, was not taken. Saori: 「足の伸びかたはメインの方優先」)
- Now the legs stretch only below the crotch (up to `crotch.y` + 0.02, lifted with hipY) and more there, so the hip joint ends at the same height; the chest (from 4 cm under the chest joint to the neck) takes `body.proportion.chest` (default 0.3) of the torso's stretch and the waist and belly the rest (×1.54 on the standard tall). The joints, the height and legK are as before (the hips 5 mm higher: the fades). `proportion.chest` 1 is the even torso of before.
- The nendo bangs (locks) had nothing to keep them off the head (no colliders: the short ones lie on the forehead, the colliders are the body's). Running, the head went ahead and the trailing locks went up to 3.3 cm into it (177 of the bangs' sampled vertices inside the skin; walking 1 cm). createLocks `floor`: each point stays out of a plane through where it rests, facing out (`outward` there), 1 mm slack. Running, walking: 0 inside.

### Paste code to open (2026-10-06, Saori: "コードを読み込める機能も欲しい。そしたらコピーしとくだけでバックアップできる")
- The export menu's コードを貼りつけて開く: a box to paste what コードをコピー copied, a share link (?o=…) or a recipe's JSON; it is added to the characters (the open one stays). The copied code's first line now says the character's name and the recipe's version (`// Hinagata character "…" (recipe version 2)`), so pasted back it comes back as it was made even after the defaults change again. Code without that line is read as today's (bare options in code are, openRecipe); a link and bare JSON as files are (a bare one is version 1). The recipe is the object literal after `createAvatar(`, to its closing brace.

### The expressions as drop-downs (2026-10-06, Saori: "表情が横並びだけどどんどん増えたら選びづらい"; "試着もプルダウンにしないと")
- Face tab: 表情 (try a face on) was a row of buttons, the stock ones then the character's drawn ones, growing down the panel with each drawing. Now one drop-down, grouped 共通 / このキャラの絵; it shows the face now, or "組んだ顔：…" when the parts match none.
- 表情セット: each row (ふつう 喜び 悲しみ 怒り 驚き) picks its face in a drop-down: any stock or drawn face, or the face built from the Parts section, named by what it is ("組んだ顔：まる目・ふつう・ω"; Saori: "今の顔のまま / 今の顔を登録 / 共通のまま" were too hard to follow, and "下のパーツで組んだ顔" said nothing either). A row with no entry shows what it gives: the stock face of its name (喜び → にこっ), and ふつう the built face; picking that removes the entry. 見る puts it on. (Before: make the face above, then "今の顔を登録" on the row.)
- Then edited one expression at a time (Saori: "悲しみの表情を変えたい場合どうするの？ 悲しい顔にして組んだ顔を選んで、そのあと喜びの顔にして…"): the face tab's 表情 block picks the expression to edit (ふつう 喜び 悲しみ 怒り 驚き), shows it on the character (`ctx.showFace` → avatar.setFace, kept over rebuilds, the character's own face again on leaving the tab), and has its eyes, brows, mouth and cheeks right there, writing straight into it: ふつう into face.parts (an old face.expressions.normal gives way), the others into face.expressions (the stock face of the name until one is changed; 「にこっ」に戻す removes it). もとにする表情 starts it from a stock or drawn face. Parts keeps the nose only; the expression set's JSON field is no longer shown.
- The five of the set are a row of buttons, not a drop-down (Saori: "表情セットはプルダウンじゃない方が良い"; they are fixed, so all in view); the block is called 表情セット again.
- もとにする表情 is gone (Saori: "基にする表情って何？"): it was an action that looked like a setting. A drawn template now goes into the expression the set is editing (panel.editExpr, applyTemplate): 悲しみ picked, a new drawing is named 悲しみ, saved in face.drawn and becomes face.expressions.sad; only ふつう puts it on the character's own face (before, every drawing went onto face.parts: drawing a sad face changed the own face). A drawn face is used for another expression by picking "絵: 名前" in its eyes, brows and mouth. A new expression's drawing reads its eye, brow and mouth only (the closed eye and the nose are shared: ふつう's).

### My parts (2026-10-06, Saori: "キャラAにパーツを追加してもキャラBでは選べない？"; "画風統一するならみんな同じの使いそう")
- Drawn parts belong to their character (face.drawn). マイパーツ, like マイ髪型: a drawn face's eye, brow and mouth pictures saved in this browser (localStorage `hinagata.editor.parts`; マイパーツに保存 on each card of 描いたパーツ, ふつう's too, named "<character>のふつう"). In any character the expression set's eyes / brows / mouth list them as "マイ: 名前"; picked, the drawing is copied into that character's face.drawn (`lib`: the my-parts id it came from, so it is copied once and then shows as its own "絵: 名前") and used. A recipe keeps its copy: a game or another browser needs nothing from the library. Removing one from my parts leaves the characters' copies.

### The template's eye frames (2026-10-06, Saori: "目ととじ目も並んでるしもうわけわからん。テンプレの目が枠からはみ出てる")
- The guide eye is drawn at face.eyeSize (1.25 by default) and its frames were sized for 1: it ran out of them. The eye frames now grow with the eye size: taller (not up into the brow's frame), wider up to 370 px (not into the nose's). Their middles stay, so templates made before read the same; a drawn picture is placed at its own pixels as before.
- The closed eye's frame sits on the other eye; an open guide eye under both looked like two eyes to draw. The guide under the closed eye's frame is now the closed eye (tileGuide: the drawn one, or the code's), in the downloaded template and in the in-app drawing.
- One place for a face (Saori: "パーツ増やしたらどんどん縦にふえる？"; "マイパーツは登録したら消す以外何もできない"): the 描いたパーツ cards are gone. The expression set has the drawing buttons for the expression picked (この顔を描く / 描き直す: ふつう its own pictures, another the drawn face it uses, else a new one named after it, so redrawing doesn't add another; 描いたテンプレを読み込む; テンプレを作る; まばたき for the drawn face it uses). Under it, 描いた絵: this character's drawings as small buttons with the eye's picture, and マイパーツ the same: clicking one puts its eyes, brows and mouth on the expression being edited (a my-parts one is copied in first), as a my hairstyle is put on; ☆ keeps a drawing in my parts, × removes it (expressions using a removed drawing go back to stock). Names and the cheek switch of a drawing are no longer edited there (an expression's cheeks are its own).
- Then (Saori): 「おこ」に戻す → デフォルトに戻す; ☆ → マイパーツへ (a symbol said nothing); and each drawing has 編集 again: it redraws the drawing in place (`onFacePaint(into, false)`: not put on the expression being edited; every expression using it changes with it). この顔を描く / 描き直す still puts what is drawn on the expression picked.

### The editor's wish list, part A (2026-10-07, Saori: "エディタを使っててこういうの欲しいなと思ったもの"; the whole list is TODO.md 5)
- Accessories: picking a kind put nothing on. The last one put stayed picked, so the next click moved it, and the tool might be off. Picking a kind now lets go of the picked one and switches the tool on (`acc.choose`).
- The tools that take the left button on the character (paint, accessories, the bangs' tufts, the back locks, the ties, drawn locks) are one at a time, and stop when another tab or any other value is touched ("キャラに描く、ふさを動かすなどは、タブを切り替えたり、別のスライダーをいじったら解除されてほしい"). panel.js `stopTools`, quietly: redrawing the panel there took a dragged slider out from under the pointer; the panel redraws when the change lands.
- Paint: ペン and 消しゴム are two buttons (the eraser did nothing until キャラに描く was on too); pressing the one in use puts it down. 左右対称 / 左右に are checkboxes.
- The hair tab: 髪型, 前髪のふさ, 後ろ髪の毛束, 結び髪, then the gradient and the paint (the schema's order; the tails were second). Each drag tool is a ドラッグで位置を動かす button at the foot of the section it moves; one whose section isn't shown (block bangs have no tuft values) stands on its own after the one before it.
- The bangs' gradient: setShading made every part's material anew and only the hair's block got its gradient back (the bangs, the back locks, the tails, and the garments' gradient, picture and paint were lost until a rebuild). A part keeps what its material is dressed in (`x.wrap`), and setShading puts it back on. Bangs in the block (block, hime, side) were measured by the whole head's height, so their tips were only halfway and the gradient (from 0.55) never reached them; they are measured over the bangs alone now, as bangs made of locks are.
- A shield is strapped to the forearm: its hand stays open (the hand's shape and the pose player) and makes a fist only in the guard.
- High heels were the sneaker's shape (the round chibi foot and a toe box 10 cm across over the toes, 1.2 cm out): 11.3 cm wide at the floor. In heels the foot (0.052 → 0.035), the toes and the toe box are narrower and the shoe is 0.6 cm out: 9.0 cm. The heel sinking into the floor is part B.
- The back (torso.back < 1) thinned the chest and the belly only: the back went flat up high and the pelvis and bottom stood out under it ("凹む場所が上すぎて、下半身がもっさりする"). The pelvis's back takes 0.75 of it and the bottom 0.6.
- Light armor: `armor.chest` "short", a breastplate ending under the chest, its lower edge to a point in front. The metal is darker: a deeper shadow band (78 / 180 / 255), a darker rim (0.5) and the lower side darker (it mirrors the ground).
- Paint on the character came out dotted across a round part: a point showed one view only (the one its normal faces most), and where the normal tipped over the stroke stopped. A point now shows its nearest views blended (src/paint.js SHOW 0.6, by alpha so an unpainted view fades the paint, doesn't darken it), and the brush paints into views down to 0.42 so they all have it. The brush also bridges short gaps: across parts (skin to shirt, shirt to pants: up to 3 brushes) and when the pointer missed for a moment (same part: up to 8 cm).
- Checked: tools/thin-check.html run in the browser (Node isn't on this machine): all ok.

### The editor's wish list, part B (2026-10-07, Saori; TODO.md 5)
- The waist ("くびれが上の方から細くなるだけ"): the cut at the sides was centered just under the chest (0.6) and 0.16 tall, so the side line ran straight in from the armpit. It sits between the ribs and the pelvis now, short (`body.sculpt.waist`: y 0.555, height 0.07, x 0.225, blend 0.04; `torso.waist` still its depth). The tall standard: hips 15.9, waist 10.3, chest 11.8 cm (half widths).
- Pants ("分厚くてシャツと段ができている"): `pants.offset` 0.016 → 0.011 (a default changed without a recipe version: every character's pants get thinner, as wanted). The waistband over a tucked shirt is the shirt itself 7 mm out from 5 cm under the top (it stood 7–10 mm out of the shirt at the sides and the back; 3 mm let the shirt show through in streaks at the cells' size).
- Skirts and dresses: where the hips stuck out of the cone, the cloth followed the body's own shape, so the bottom's round showed through whatever the sliders ("ワンピースでお尻の膨らみのシルエットが出てしまう"). DRAPE: per angle and height (48 × 1 cm), the cloth's radius is the cone's, or the line from the top's edge to the furthest the hips reach (1.5 cm out), then straight down under it. Its top goes over the shirt itself (7 mm) when the shirt's hem is inside, as the waistband does (a dress stood 2 cm off under the chest, the shirt 1.4: a step). A dress's top margin 0.02 → 0.015.
- The bare foot ("元の丸い足に脚の指をつけただけ"): the foot is a narrow heel, a long middle and the ball, wide and flat under the toes; the shin narrows to the ankle (0.057 → 0.045 at the ankle joint: it came down as thick as the calf, like a boot). Shoes are made around `shoeLast` (the round foot of before, not part of the body), so sneakers, boots and sabatons keep their shape.
- High heels sank into the floor (the toes about 2 cm): the foot pivots toes-down about the ankle, the ball on the floor. `heelBend`: the body and the shoes are read with the forefoot bent up at the ball by the same angle; tilted, it lies flat (lowest point −2.7 mm, the sole's own). The heel's spike is shorter by its end's radius.
- `body.proportion.feet` (×, 0.7–1.5): every part of the foot grown about the ankle, the sole on the floor; the heels' pieces, the bend's ball and the cape's foot collider with it.
- The jaw shadow: a lighter, pinker color (#ecd3d1, was #cfa294), and the neck's band all round to behind the ears (`neckX` 0.075–0.1, fading at `backZ` −0.05; only the front middle before: "耳下の首などが抜けてる").
- Elf ears: the blade rose out of the middle of a round ear, whose lower half showed under it. With elf ears the round ear is 0.62 of its size, inside the blade's root, which starts 3.5 cm further in and is at least 4.2 cm wide; the ear line and shade shrink with the ear.
- The ear line slid onto the ear in the root along the head's direction; the head's transform shifts with depth, so it landed off. It slides in head space against the head as made (bodySdfRaw), then goes into the root.
- The angel ring on hair made of locks: only the block had it, and under locks the block is a thin shell. The locks carry it (`withRing`, hairUV from their rest middle line: createLocks `uvAt`; the mesh is empty until the first update). Its color is a shared uniform that follows the hair color.
- Tied tails' tips ("先端がバラバラに広がっている"): the tips fanned out to 1.5 × the bundle's radius and the lengths varied ±15%. `hair.tail.gather` (default 0.8): the tips to the bundle's middle and the outer locks a little shorter, so the tail narrows to a point; 0 is the old fan. The locks of one tail swing as one: createLocks `group` / `cohere` draws each point's move off its rest toward the bundle's mean, and they share the flutter's phase. Long hair: the left, the back and the right each a group (cohere 0.45).
- Shading "soft" (アニメ(やわらか)): the toon's shadow color with the edge blended (smoothstep −0.19…0.36) and the lit side darkening a little toward the edge, as Crescendo Tower's matte look. Rim light (`shading.rim`, `avatar.setRim`): a fresnel edge added to every lit material (not outlines), checked each update so rebuilt materials get it.
- Light armor's waist plates (`armor.tassets`, off by default): a shell around the hips from the waist down, flaring, in two lames, open in front and at the back; its own mesh (armorWaist) on the hips and thighs.
- Checked: thin-check in the browser, all ok (four bodies, fine / lite / 0.15).

### The closed eye as its own entry, the other eye's frame (2026-10-07, Saori: "とじめをひだりに書く方式だと、オッドアイとかできないし、片側にハイライトが入ったキャラが変になる"; "テンプレは変えないでください。表情セットの普通の目の下に置く")
- The closed eye was drawn in the template's frame on the other eye and read back flipped, so a one-sided highlight came out on the wrong side, and that frame couldn't be the other eye. Now the expression set has とじ目 under ふつう's eyes: drawn (in-app or a "parts" template read into "closed") in the eye's own frame, kept the same way round as the open eye; it is used for blinking whatever the open eye is (the code's line without it) and as 絵のとじ目. Its in-app drawing shows the eye's frame alone over a closed guide eye.
- The template's frames didn't move. The frame on the other eye is the other eye now (`face.images.eyeL`; a drawn expression's `eyeL`): read as drawn, not flipped, and only when something is drawn there; empty, the eye is mirrored as before. Its label says so: 「左目: 描かなければ自動で左右反転」. A template drawn before with a closed eye in that frame now reads it as the other eye (Saori: the new way is fine).
- Later (Saori: "あとででいい"): the eye's highlight as a layer of its own, lit from one side.

### Extras and a full-body suit (2026-10-07, Saori: "追加したい汎用性の高そうなアイテム: 獣耳、獣尻尾、天使の輪、天使の羽、悪魔の羽、悪魔尻尾 … プラグスーツのような全身スーツ")
- `outfit.extras` (clothes/extras.js): `ears` cat / fox / bunny / bear (head space, wrapped like the hair, from inside the hair out; an inner side of their own color), `tail` cat / fox / devil (one lock from the back of the hips: createLocks with the hips as its bone, so it swings; a lock may carry its own width profile, `prof`: the devil's thin whip ends in a spade), `halo` (an unlit ring over the head, carried by the head), `wings` angel / devil (flat shapes on the upper back: feathers hanging from an arm, longer toward the tip / a bat's membrane between finger bones, bitten in arcs between their tips), with colors (null: the hair's; a devil's dark, an angel's white) and sizes.
- `outfit.suit`: the body itself 2.5 mm out (as the socks), a high collar to the feet, cut at the wrists; its accent color on the collar, the cuffs, the boots and the outer sides, painted by place and facing (a two-step gradient through withGrad).
- clothes/extras.js joins src/cache.js SOURCES (a mesh made from a file not listed there stayed cached after it changed).

### Garment silhouettes (2026-10-07, Saori: "スカートやワンピースの先を、おおきなギザギザにしたり、丸っこい段々にしたり、先端を上にカールさせて広げたり、逆にすぼめたり。ズボンを膨らませたり、先端を広げたり")
- A skirt or a dress (skirtOf: `hemShape`, `hemCount`, `hemDepth`, `curl`): "zigzag" and "scallop" cut the hem's edge up between points or round lobes; "tiers" (up to 5) is a shell per tier, flaring within it, its top tucked 1.2 cm up under the tier above, so each tier has its own hem and outline (one surface with steps was either too soft to read or jagged at the steps); `curl` flares the last part out and up (> 0) or draws it in (< 0).
- Where the cloth flares nearly flat, the shell's sideways thickness is thin across the cloth (its inside showed through in specks): it is thicker there by the slope.
- Pants: `puff` (balloon legs, gathered toward the hem) and `bell` (wider toward the hem): the cloth further out around each leg, faded out near the middle so the legs don't join.

### Fighting (2026-10-07, Saori: "両手剣 / 槍の構えモーションが体を突き抜けてるのをなおし、両手持ちに / 各武器ごとの攻撃モーション / ダメージくらい、気絶ピヨピヨ、倒れなど戦闘系モーション")
- `outfit.weapon.right` "greatsword": a grip long enough for both hands, a wide guard, a blade about 85 cm. Standing and walking it is held low in front in both hands, the blade forward and down (first it rested on the right shoulder in one hand: the blade pointed back and went into the elbow. Saori: "肩に担ぐなら、鞘をつけないと厳しい").
- `outfit.weapon.sheath` (default on) and `sheathColor`: a sword has a belt and an empty scabbard at the left hip, slanting back; a greatsword a scabbard across the back on a strap across the chest (Saori: "大剣の鞘は背中でOK"). Only to look at: the blade stays in the hand (sheathing and drawing: later, TODO.md).
- The spear's guard held it low in one hand at the side, and its shaft ran back through the leg. The spear and the greatsword guard in both hands now (guard_spear / guard_greatsword, played by "guard"): the left hand on the shaft (the grip below the right).
- One swing per weapon (motion/combat.js, ONE_SHOT): attack_sword, _axe, _spear, _staff, _greatsword, _punch, from the guard, wind up, strike, hold, back. "attack" plays the one for what the right hand holds; a shield (or a bare left hand) keeps its guard.
- hit (flinching back), stun (swaying on wobbly knees, the head lolling; `stars: true`: five stars circle over the head), down (the knockdown's fall, held lying).
- The arms were solved, not guessed: in the editor, on the tall standard body, the hands put where they should be with motion/ik.js, the weapon turned to point where it should, for two hands the left hand on the shaft; the angles read back are kept. Keyframes blend as turns (quaternions), eased. On a very different body the hands land a little off where they were aimed.

### The bare foot again; the scabbard on and off at once (2026-10-07, Saori, with a photo of legs: "足首が急に細くなってて、足の大きさを小さくすると、足首と分離しますね / 裸足の踵はもう少し削りたい / 足の裏をもう少し平くしたい")
- The shin narrowed to 0.045 at the ankle: too sudden. 0.05, and an instep: one capsule from the ankle joint (as thick as the leg there) down to the top of the forefoot, so the leg runs into the foot as one slope. Its top stays at the ankle when the feet are resized (a small foot came apart from the leg: every foot part shrank toward a point on the floor, away from the ankle).
- The heel stood out too far behind: its back at −0.059 (was −0.064), a little rounder blend.
- The sole is flat: the foot's parts reach 4 mm under the floor and FOOT_FLAT (a plane cut, y −0.003) cuts them level.
- weapon.sheath shows or hides the belt and the scabbard at once (avatar.setSheath; they are built whenever a sword or a greatsword is held).

### Swings that reach the one in front; a dagger; the waistband off the sleeves (2026-10-07, Saori: "剣も斧も正面にいる相手を斬りつける動きになっていない … 同じくらいの大きさの敵キャラが目の前にいると想定"; "振り上げた時の肘の曲がり方がおかしい"; "槍は…左手が持ててない"; "ワンピースを着た時のウエストの段が悪化 / 長袖で肘に変な盛り上がり")
- Solved in the editor against a same-size character standing 0.8 in front (a second avatar in the scene), with a solver that also turns the edge (the blade's width, the axe's edge) to lead the cut, and reports where the point ends. The sword's strike went straight down at its own feet (it read as a dagger held the other way): now wind-up (the arm up and out, the elbow high, not folded behind the head), the hit (a diagonal cut through the enemy's chest, the point 16 cm past its middle), the follow-through down past its legs. The axe: raised overhead, the head coming down on the enemy edge first.
- The spear: higher and nearer the middle, and the left hand's distance to the shaft measured: 0 in every frame (it was up to 24 cm off in the thrust); the thrust's frame chosen from a small search (the hand's depth, the left hand's place, the body's turn and lean) for the furthest reach with both hands on it.
- "dagger": a short leaf blade, held forward low (standing: hanging), a small scabbard at the hip; attack_dagger pulls back and stabs (it stops 6 cm short of the enemy at 0.8: a dagger closes in).
- The pants' waistband and a dress's skirt top went over the shirt with its sleeves: long sleeves at the elbows' height got the skirt round them (fins at the elbows). Only the torso now; and a dress's skirt top 3 mm over its own top (same color: nothing shows through), the pants 7 mm.

### A dress's skirt comes out from under its top (2026-10-07, Saori: "さっきより良くなったけどやっぱり段差が前のモデルより目立ってる気がする　くびれ周りを変えたからですかね")
- Not the waist: with the old waist cut (y 0.6, a long soft cut) the line was the same. It was the skirt's top edge 3 mm over the top, a rim the light caught as a pale line all round (the old skirt stood 6 mm off but its rim was rounder, so it read softer). Over its last 2 cm the skirt's top now sinks to 3 mm under the top, so it comes out from under it (same color, both following the same shape: no edge left). Checked in walk, sitChairGirl and banzai: the top doesn't show through.

### The mouth's profile (試作) (2026-10-07, Saori: "もとがちびだったので横顔はあえて真っ直ぐにしてた … 高頭身もたしたので、鼻の下の凹みや口のラインなどがあるタイプの横顔もありかも … 結局くちがテクスチャなので、つけすぎると変になりますよね")
- `body.sculpt.mouth.profile` (0 = the straight line as before, the default): the mouth cut's plane comes forward at the upper lip (8 mm × profile, 7 mm over the mouth) and at the chin (14 mm, 27 mm under it), narrow across, so seen from the side the line dips between them at the drawn mouth. Placed by `face.layout.mouthY` when built (moving the mouth on the picture doesn't move it until the next rebuild). A small piece (`jawFront`) gives the chin something to come forward from (the jaw ended at the plane there).
- Tried first with a dip of its own under the lower lip: the crease let the outline through over the drawn mouth (a line across it in front, its smile cut off; checked with the outline off). Without it the mouth stays as drawn up to about 1; at 1.5 the outline starts to show at the mouth again.
- Then (Saori: "口よりも鼻の下凹ました方がいいかと　かえるみたいになってますし"): the upper lip no longer comes forward; instead a soft dip under the nose (6 mm × profile, halfway from under the nose to the mouth, 1.4 cm tall, 6 cm wide: narrower made the nose's sides crease), and the chin forward by half as much as before (7 mm). The front and the drawn mouth stay as they are up to 2 (the slider's end now).
- Saori also: "横顔作るなら、顔の比率もっと縦に伸ばさないと無理そう". The lower face is a chibi's (the mouth about a tenth of the head above the chin): a lower-face length (stretching the head below the eyes, the face picture's mouth and nose moving with it) is the next thing to try, not done yet.
- Profile 2 without the chin (Saori: "横顔の口もと2で顎の出っ張りなくしてみて" → "この顔はデフォルメの別タイプとして使えそう"; "アステルの顔をこれにするといいかも"): the chin is its own value now, `mouth.chinOut` (0 = none, the default; 「横顔のあご先」), and `mouth.profile` is the dip alone. Astel's preset has profile 2.
- Saori: the cute default face is finished as it is; the profile and a longer face are for other types (tall male characters and so on), so their front may change.
- The slider is called 「鼻下のへこみ」 (Saori: "横顔の口元じゃなくて、鼻下のへこみでいいんじゃないでしょうか"); the option keeps its name, `body.sculpt.mouth.profile`.

### Face length below the eyes (試作) (2026-10-07, Saori: "横顔作るなら、顔の比率もっと縦に伸ばさないと無理そう" → "メインに入れて試作に進んでください")
- `body.head.faceLength` (1 = as before; 「顔の長さ（目から下）」, to 1.5): part of the head's transform (headTransform), so everything placed in head space follows: the head's shape, the face picture (its mouth and nose come down and stretch a little with it), the jaw shadow, the ear line, the hair and its locks. Below `faceY` (the eyes' height − 0.05, from face.layout.eyeY) heights are stretched by faceLength, with a soft knee (2 cm), at the front only (fading out from z 0.08 back to −0.06): the back of the head, the nape and the ears stay.
- Skin weights: the longer chin is all on the head bone (measured at 1.45), so it turns with the head.
- At 1.3–1.45 the round cheeks are stretched with it (a long round face from the front); a narrower jaw for a grown-up or a man is for the face-shape sliders on top (chin sharpness did little at 0.25).
- It lifted the chin over the neck (Saori: "顎がのびて首が短くなってますよ"): the head now goes up by as much as the chin comes down ((faceY − chin.y) × (faceLength − 1) × head.scale, added to neck.length's lift), so the neck under it stays as long.

### An E-line (試作) (2026-10-07, Saori: "はなしたのへこみをもっとふかくし、はなしたぜんたいをへこませ、やや口も凹ませ、顎はだしたままで、eラインを作ってみてください　それが作れれば展望があります")
- `mouth.recess` (「口もとの引っ込み」, 0–3): from under the nose to just under the mouth set back as a band (8 mm × recess, flat across the mouth, fading in over 2 cm under it and at the nose's underside; 7 cm wide). With the dip deeper (`profile` to 4) and the chin further forward (`chinOut` to 4), the mouth sits behind the line from the nose's tip to the chin's.
- The chin bump is taller now (1.3 cm, its middle 3 cm under the mouth): at 3.5 the narrow one (0.9 cm) stood out as a ledge. Its piece (jawFront) grows forward with chinOut (the chin stopped at the piece's front before).
- Seen working: faceLength 1.3, profile 3, recess 2, chinOut 3.5 (checked with the line from the nose's tip to the chin drawn in, `_cmp.html` sheet). At faceLength 1 it works too, cramped; the front stays as drawn.
- All taken out again the same day (Saori: "全てがダメです　0から作った方が早いかもしれません" → "鼻先の凹みだけは残して他は消しましょう　今のモデルのクオリティを上げた方がいいです"): faceLength, recess and chinOut are gone; only the dip under the nose (`mouth.profile`, 「鼻下のへこみ」, 0–2) stays. The way forward is the current model's quality, not a second face type.

### Locks don't stretch on a jump (2026-10-07, Saori: "ジャンプなどで上下に動いた時の髪がバネのように伸び縮みする")
- The links were pulled back to their length in four rounds a step (half each way): a 12-point chain didn't get there, so when the head went up or down fast the locks stretched a few % (long hair 3 %, a ponytail 6 % on a 60 cm jump) and then crumpled into waves coming down. After the rounds, each lock now walks from the root out and puts each point at its link's length from the one before (follow the leader); the move goes into its last position too, so it adds no speed of its own. Measured on the same jump: the tips sank 2.4 cm and rose 4.9 cm before, now 0.6 and 1.8 (they lift a little while falling and settle right after landing).
- Then falling and rising (Saori: "普通こんなふうに流体のように上下にポヨンポヨンするのではなくて、下に行ったら空気におされて全体的に外側に膨らんで、上に行ったら直線体にくっつくみたいに、横向きに大きく動くんじゃないでしょうか"): the roots' speed up or down (smoothed) gives a spread (SPR, −1..1; nothing under 0.6 m/s, so a run's bobbing doesn't, all of it 0.8 m/s over that). Falling, each point's rest place moves out from the head's middle line (from the roots' middle for a tail on the hips) by 0.35 × the lock's length at the tip (t^1.5 along it), rising in by 0.07 × it, and the points follow it more firmly (K + 0.1 × |SPR|); bangs (floor) a third of it. It comes in fast (12/s) and goes back slower (4/s). Tried and left: a push (a force) instead of a moved rest place — the tips answered late, at the landing, and stayed spread; pushing them up too — what was lifted fell back onto the lock on landing and crumpled it. The locks' own up-and-down against the head is kept at a quarter (VDAMP 0.5 → 0.25).

### Locks or a block, apart from the style (2026-10-07, Saori: "髪の毛の、毛束と塊の分離ですかね　姫カットの毛束タイプ、ロングの塊タイプなどが今なくて半端"; on the two short styles: "そのままだと垂らしと普通それぞれに塊を作ることになりますよね" → one short style)
- `hair.bangsForm` and `hair.backForm`: "locks" (each lock its own and moving) or "block" (one shape with the head), in the hair tab under 前髪 / 後ろ髪 (前髪の作り / 後ろ髪の作り). Bangs: ふさ (the nendo tips, as locks or one layer), 姫カット, 横流し, なし; back: ショート, ボブ, 外ハネ, ロング. Short hair in locks: `hair.nape` 「襟足」 "hang" (垂らす: off the back of the head, the nape showing; what ショート(たらし) was, and the default) or "lie" (沿わせる: along the head into the nape; what ショート was). The two short styles had the very same block (BACKS.hang = BACKS.short): one style now, so a block exists once.
- The engine still builds from its own switches (sculpt.nendo.locks, shortLocks.on, long.locks, and back "hang" for short hair hanging in locks): `hairForms(hair)` (options.js) sets them from the forms and gives the style built; `setHair` takes the forms too. Older values are read into the forms when options are resolved (`readHair`), so a saved character stays as it was: bangs "block"/"parted" → nendo in a block; back "hang" → short, locks, hanging; back "short" given without a nape → lying; those switches given false → a block. setBangs({ locks }) and setLocks(group, { on / locks }) set the form.
- Hime, side-swept, bob and flip have no locks yet: in locks they are built as their block (the help says so). Next: their locks.
- docs/options.schema.json regenerated (in the browser, as tools/schema.mjs writes it: no Node here); it hadn't been since 63d18f4.
- Hime and side-swept in locks: the hime cut is the nendo bangs' locks from the hime tips (bangLocks with { ...nendo, lockHangY 0.97, ...hime }: its side locks' tips are by the chin, where no hair lies, so they hang from the side of the head), each ending square (HIME_END: as wide down to its last tenth, then closing in). Side-swept: each of the block's four strands (hair/index.js SIDE) becomes a few locks side by side over the hair (sideLocks, by the strand's width, 2.6 cm a lock), coming together a little toward the tips. Left: bob and flip in locks.
- Bob and flip in locks: hanging from the back of the head as the short hair's (ringLocks), further round toward the face (150° each side of the back), down to that style's hem (BACKS.bob / flip side and back, plus `below`), over the short hair's block (the bob's own reaches the jaw); the bob's tips curl in a little (flick −0.01), the flip's out (0.012: at 0.04 they stood out flat like wings). Their own values: `hair.sculpt.bobLocks` / `flipLocks` (count, width, thick, below, flick, stiff, edits; the back locks tool edits them one by one too). Every style now has both forms.
- The hime locks cut straight across (Saori: "毛束姫カットの毛先がぱっつんじゃないですね"): they ended in a short point and the locks of a clump ended higher toward its sides (lockRise) and gathered toward its tip. Now as wide to the end, thinning there into a straight edge over the last 6 % (spec.blunt; the ribbon has no cap), all ending at the tip's height (lockRise 0) and running parallel (lockTipSpread 1: the tips as far apart as the roots).
- The bangs tool for every kind of bangs (Saori: "なんで姫カットとかって前髪動かせないんですかね" → "毛束の方の姫カットもうごかせるようになりますか"): it only moved hair.sculpt.nendo.tips. Now it works on the bangs shown (editor/src/bangs.js KINDS): ふさ (nendo.tips), 姫カット (hime.tips: the same rows; width and extra thickness only, it is a straight cut) and 横流し (`hair.sculpt.side.strands`: the four strands were constants in hair/index.js, now options; a dot on each strand's tip moves its angle and height, sliders for its width, bend and root). As locks or as a block alike. setBangs(values, group) takes "nendo" / "hime" / "side"; bangTipAt uses the hime's hanging height for its side locks; sideTipAt(th, ph) gives a strand's tip. The picked dot (blue) was opaque and the face drew over it where it sat a little inside: drawn with the others now (bangs, back locks, tails).

### Sparkly eyes, a ribbon, socks over the knee; ルミナ (2026-10-07, Saori: "このツールを使って超絶美少女を作ってください", "足りないパーツがある場合は作ってもOK")
Made a character with the tool (the preset ルミナ, src/presets.js) and added the parts she was missing:
- Eyes "sparkle" (キラキラ目, face/index.js): the round eye's build dressed up. An almond eye lifted at the outer corner, a bigger iris (fibers out from the pupil, an inner ring, a dark band under the lid, a glowing crescent at the bottom), a soft-edged pupil, highlights (a big oval, a four-pointed glint, small dots), a winged upper lash with two lashes standing up, lower lashes with two ticks, a soft eyeshadow at the outer corner. Colors from colors.eyes like the round eye; it blinks.
- Accessory "ribbon" (accessories.js): a bow, two loops puffed out and swept back a little, a knot, two tails with V-cut ends. Its normals are averaged over shared points (the leaf's flat normals would show facets on the soft cloth). Editor size 0.12.
- Socks above the knee: the socks' box stopped at y 0.17 (parts.js), so any `outfit.socks.top` over 0.17 was cut there although the slider went to 0.3; the box now reaches the top, and socks over 0.17 may follow the thighs too. The value is on the body before its legs are stretched (knee 0.25, hips 0.44, whatever the proportions); the slider goes to 0.38 (over-the-knee: 0.3–0.36).
- What she showed about placing accessories: a dress's collar comes up to the neck (a choker goes above it), and a band is a circle, so it can't sit on the waist (elliptical): a bow at the back of the waist instead.
- Checked with tools/thin-check.html in the browser (all ok; no Node here), docs/options.schema.json regenerated the same way.
- Her face (Saori: "ほおがこけて、りんかくが角ばっていますね"): the V chin (`chin.v.on`) made the jaw pointed with a corner under the cheek, and the default cheek trim (`cheekTrim.depth` 0.008) hollows the cheeks' side on any face. She has the trim off, a fuller cheek fill (0.007), longer cheeks (y 0.94, height 0.14, as シルヴィ) and an almost round jaw (`chin.sharp` 0.06).

### Jaw length (2026-10-07, Saori, with a picture of ルミナ's face, its lower part moved down: "顎をとがらせれば美少女っぽくなりますが、そうするには今のモデルは頬から下が短すぎてこけてしまってたんです")
- `body.head.jawLength` (「あごの長さ」, 1–1.6, Face shape): in the head transform (headTransform's jawLength / jawY), below a bend just under the mouth (face.layout.mouthY − 0.016, soft over about 1 cm) heights are stretched by it, at the front only (fading out from z 0.08 back to −0.06, as faceLength did): the nose, mouth and eyes stay where they are, and the jaw, its shadow and the side hair come down with it. The head goes up by as much as the chin comes down ((jawY − chin.y) × (jawLength − 1) × head.scale, added to neck.length's lift), so the neck stays as long.
- Not faceLength again (taken out, 1c15f37): that stretched from under the eyes, bringing the nose and mouth down. This keeps the face and gives a pointed chin room: with jawLength 1.4, chin.sharp 0.3 has no hollow under the cheeks (the V chin, `chin.v`, still leaves a corner under the ear).
- At 1 nothing changes (the transform is the identity; thin-check's numbers are as before). ルミナ: jawLength 1.4, chin.sharp 0.3.
- Then (Saori: "眼窩が左右にはみ出してるように見えます … 左右の輪郭の内向きへの角度を、もう少し垂直に"): the face's side went in steeply under the eyes, from the temples pushed out at the eyes' corners (`temple.depth` 0.006) to a narrow jaw (`jaw.width` 0.112). ルミナ: temple 0, cheeks.width 0.185, jaw.width 0.14 (her recipe only; the defaults stay).
- Lower still (Saori, with her picture beside ours: "りんかく（頬の頂点と顎）がもうすこしした、目の左右の幅がもう少し広い"): ルミナ jawLength 1.6, cheeks fullest lower and wider (y 0.92, width 0.2), jaw.width 0.145, temple 0.003.
- Then matched to her own edit of that face (参考.png: the eyes a little smaller with their sockets, a little higher and closer, the cheeks fullest a little lower), measured on the picture (the irises' bounds, the outline's width row by row) to 1–3 px: eyeSize 1.28, eyeX 0.091, eyeY 1.005, socketSize 0.94, cheeks.y 0.912, jaw.width 0.19, chin.sharp 0.15. The outline matched but the chin stayed round (Saori: "どうしても顎がとがらず丸くなってしまう"): the chin's bottom line is a curve (chin.curve) plus the V of chin.sharp, blended soft (chin.k), and a full jaw rounds it. Left for later: a chin that is pointed and full above it.
- Pushed as ルミナ: the face with jawLength 1.4 and chin.sharp 0.3 (the round cheeks, eyes 1.35), the one Saori picked ("いったんこの時のルミナを").

### Noses drawn in code (2026-10-07, Saori: "鼻を書いてみてもらえますか")
- `face.parts.nose`: "dot" (「点」: a small dark dot just under the nose's tip, as in her picture) and "line" (「線」: a short stroke down the shadow side with a soft shadow beside it), beside "shadow", "image" and "none". Placed at the nose's tip on the face picture (NOSEP), so they follow body.sculpt.nose.lift. ルミナ (as pushed) has none: she is the face from before the nose.

### Eye socket size; the sparkly eye's lower lashes (2026-10-07, Saori: "眼窩が輪郭に影響しないよう、目を眼窩ごとすこし小さくして")
- `body.sculpt.socketSize` (「眼窩の大きさ」, 0.7–1.2, Face shape): the eye sockets (the dip, its inner and under-eye parts, the band toward the temple) scaled around the eye's middle (face.layout eyeX / eyeY), their depth with them, so the shape stays and only its size changes. Not tied to face.eyeSize: that would reshape every character whose eyes aren't the default size. 1 = as before (thin-check's numbers unchanged).
- The sparkly eye's two lower-lash ticks stood off the lid line and, with smaller eyes, read as whiskers beside the eyes: now short and on the line.

### Width beside the eyes, moved out as it is (2026-10-07, Saori: "目の左右を広げるとなぜ輪郭の角度が頭に向かって開いていってしまうんですか" → "輪郭の左右の角度は変えずに並行移動する方法はないんですかね")
- Why it opened: faceNarrow (k > 1) scales the face across by a factor, so a cheek 10 cm out moves out ten times as far as the chin 1 cm out, and the sides tilt open toward the top; cheeks.width only grows the cheeks' ellipsoid, not the jaw under it.
- `body.sculpt.faceWiden.shift` (「目の横の幅」, 0–0.03 m head space, Face shape): a band beside the middle (inner 0.1, 0.06 wide) is stretched across and everything outside it moves out by shift, so the outline keeps its angles; only below the brows (fading 1.02 → 1.12, as faceNarrow) and above the chin (fading chin.y + 0.07 → chin.y), so the skull and the chin's point stay. The ears move with the sides; the eye sockets are added after it, so they stay under the eyes. Its fades shear it a little, so its distance is scaled by 1 / (1 + 1.5 × shift / fade height).
- Measured on ルミナ (outline width without hair, front, px from rows 200 to 315): faceNarrow 1.08 adds +23 … +8 … 0 (less and less down the face), faceWiden 0.012 adds +15 +15 +14 +14 +14 down to the cheeks' fullest, then 0 at the chin: the sides move out parallel and turn toward the same pointed chin.
- At 0 nothing changes (thin-check's numbers as before). The ears are ragged at "game" without it too (the hair covers them).

### ルミナ v2: a longer face in straight lines (2026-10-07, Saori: "顎を丸まらせないように直線で繋ぐ方法ってできますか" … "e3をルミナv2として入れてもらえますか？メインに")
- No new shape needed: the V chin (`chin.v`) already cuts the jaw with two planes. Its default slope (1.3) met the face far inside its side, which left the corner under the ear; aimed to meet the side where the jaw turns (slope = (side's half width − halfW) ÷ (corner height − chin.y)), the side runs straight into it. Measured (outline width, front, no hair, row by row): the steps down the jaw went 27 23 18 24 27 31 px (a curve) and with slope 1.7 at y0 0.94 went 27 27 27 28 29 32 (a straight line).
- Lower corner, same chin: lowering the corner (cheeks.y, chin.v.y0) with a steeper slope, so the line still ends at the chin's point.
- `CHARACTERS.lumina2` (「ルミナ v2」): ルミナ's own options (copied, so the two stay alike) with faceNarrow 1.02, jawLength 1.9, cheeks.y 0.885, chin.v { halfW 0.02, slope 3.2, y0 0.89, fadeY 0.03, k 0.01, z0 −0.02 }. ルミナ stays as she was.
- Sliders widened for her: jawLength to 2 (was 1.6), cheeks.y down to 0.86 (was 0.9).

### 「あごのとがり」 that keeps the cheeks round (2026-10-07, Saori: "頬丸いまま顎を尖らせるようにできませんか" / "いまの顎尖らせるスライダーはほおがこけるので、使い道がないんです")
- `body.sculpt.chin.taper` (「あごのとがり」, 0–1, Face shape) replaces chin.sharp on the slider. The face's front outline is measured at build time (half width W(y) of the head seen from the front over z ≥ 0, so the ears and the back of the head are left out; 0.002 steps, about as fast as before: a build 3.1 s → 2.9 s). It is convex all the way down (Sylvie's: 2.6 cm wide just above the chin's bottom, 11 cm a little higher), so no line from the chin touches it from outside; the jaw is cut along the straight line from just above the chin's bottom (narrowed by taper) to the outline at a joint not far above it (higher with taper), below the joint only, softened there over 0.025 (head space), front only (fading out behind z 0 to −0.12). Measured per face, so one value fits any face.
- Its 1 is 0.65 inside: beyond that the cut reached the chin's tip and shortened it. A first try that took the joint from the line of least slope found it at the top (the outline being convex) and cut the cheeks away; the joint now stays low.
- `chin.sharp` stays in the engine for the faces that use it (ルミナ 0.3, シルヴィ 0.1), folded as 「あごのV字(旧)」. The schema now honours `tier: "advanced"` on a described value (it was main whenever described).
- Measured on シルヴィ at the old 0.3 (outline width, front, no hair, rows 262…302): the cheeks' rows stay 204 199 193, and from there down it narrows straight to the chin.

### Head height above the brows (2026-10-07, Saori: "あたまの横幅はあるけど縦幅がなくて、シルヴィの眉毛より上を縮めたい場合どうすれば")
- `body.head.crown` (「頭の高さ(眉より上)」, 0.7–1.2, Head): in the head transform (headTransform's crown / crownY), above a bend just over the brows (face.layout.browY + 0.018, soft) heights are scaled by it, front and back alike: the skull, the hair and its locks, the tails and ties, and accessories on the head come down together; the face under the brows stays.
- Not skull.height: that lowers the head's ball alone, and the hair built around it broke up at the sides (Sylvie's side locks in pieces).
- At 1 nothing changes (thin-check's numbers as before).

### Legs that close in (2026-10-07, Saori, with a Genshin model beside ours: "基本ポーズで足を開いてるせいで、脚そのものや付け根が外側に張り出していて、腰をどれだけ狭くしても付け根が四角く張り出してる"; "くびれの下の膨らみをなんとかして欲しい")
- Why: the hip joints were fixed at x 0.11 (about the hips' half width) and the knees and ankles as far out (0.108, 0.116), so the legs came down as two parallel columns at the hips' width; under a narrow waist the outline went out to the hips and then straight down, with a corner (a robot's). Theirs meet at the top and close in to the knees.
- `body.joints.hipX` (「脚の付け根の間隔」, new; default 0.11 = as before) moves the hip joints; the thighs' own pieces (thighB, thighF, thighIn) follow the leg's line (legDX: how far it moved from the default line at their height), so at the defaults nothing changes (thin-check's numbers as before). kneeX and footX had no sliders: now 「膝の間隔」「足首の間隔」, in a new 「脚」 section.
- The round bulge under the waist was not the pelvis (narrowing torso.hips from 0.72 to 0.65 hardly changed it) but the thigh's round top: the thigh is a capsule from the hip joint, its top sphere (with its blend) reached out past the pelvis. `sculpt.thigh.topDrop` lowers it along the leg.
- ルミナ (and so ルミナ v2): hipX 0.09, kneeX 0.05, footX 0.05, torso.hips 0.8, thighTop 0.78, thigh 0.62, thigh.topDrop 0.06. Walking, running and sitting checked (no legs through each other). A long, strong waist (torso.waist 0.06, sculpt.waist height 0.12, blend 0.07) gives a smooth S line on the bare body, but the dress's top pinched in to it and stuck out at the sides over the skirt, so she keeps her waist (0.03).
- Not changed: the default body (every character would change). The sitting skirt is ragged as before (not from this).

### Leg shape: knees and calves (2026-10-07, Saori: "太ももから膝までが中心に向かって、膝から下は垂直に近い。膝上は内側に入っていて、膝下は少し外側にずれたところから始まる…膝はアウトラインに段がある。横から見ると、膝から膝下は少し後ろに出て中心の足に向かっているので段がある…いまただの棒に近い")
- `body.sculpt.legShape` (「脚の形(膝・ふくらはぎ)」, 0–1.5, Legs; 0 = as before): placed by the knee and ankle joints, so it fits legs closed in or apart. The thigh's capsule narrows at the knee and the calf's at the ankle; a kneecap at the knee's front; under the knee the calf's outer head (higher, outward) and inner head (lower, inward) and a bulge at the back, on the lower leg (they bend with it). The calf's pieces are thickened with body.thickness.calf like the others (which also drew their offsets in toward the bone: the first values hardly showed).
- The cut between the knees (KNEE_IN) had a fixed half width (0.035) made for knees at 0.108: with knees at 0.05 it shaved their insides straight. Its width now scales with kneeX (unchanged at the default).
- ルミナ (and ルミナ v2): legShape 1.5. Front: the knee narrows and the calf starts a little outside it; side: the calf stands out behind under the knee. Dressed, walking and sitting checked; the socks follow it.

### A skirt out of a strong waist (2026-10-07, Saori: "くびれは無理だったんですか" → "ワンピースというか、スカートの問題？")
- It was the skirt (a dress's and a plain one alike: drawn with the top hidden, the corners were on the skirt). Its top band follows the shirt for 6 cm, and under it the cloth is the cone (an ellipse at the hips' width, flaring) or draped over the hips 1.5 cm out (DRAPE); under a long, strong waist the band let go where the body was still narrow, so the skirt stepped out from it with a corner at each side (measured: 0.106 → 0.142 over 1.2 cm).
- Now: the cone starts from the body at the skirt's top, measured each way (TOPR), never wider than the old one; the drape's hips (skirtMask) are inside the body itself too, so the waist's cut applies; just under the top the drape is only 0.8 cm out, going to 1.5 cm over 6 cm; the band follows the shirt or the body, whichever is further out. The same strong waist now widens 0.114 → 0.128 → 0.138 → 0.148 → 0.154 without a step.
- Other characters: pixel differences of 0.04–0.4 % at the edges (a plain skirt 268 px of 64000, シルヴィ 78, ルミナ before this 84, a chibi dress 25, アステル 0), not visible side by side. thin-check passes (skirted cases a few hundred triangles fewer).
- `torso.waist`'s slider goes to 0.08 (was 0.04). ルミナ (and ルミナ v2): torso.waist 0.06, sculpt.waist height 0.12, blend 0.07.
- Still to look at: the scalloped hem's small black slivers (there before), and long pants on legs this close (the cloth fills between them).

### A 6-head body, in progress (2026-10-08, Saori, with a picture of a Genshin character standing; the work and its next steps are at the top of TODO.md)
- `body.sculpt.bustY` (m, default 0) moves the bust up or down; `body.sculpt.bustX` (m, default null = as before) sets each side's distance from the middle. The spacing was max(6 cm × the chest if over 1, the bust's radius): never under 6 cm, so on a narrow chest the bust stood apart and the chest looked wide. Neither has a slider yet; at their defaults nothing changes (thin-check as before).
- `proportion.chest` below 0 shortens the chest (the torso's stretch goes to the belly): shoulders to under the bust get shorter. Its slider is 0–1.
- (later the same day) The bust at `proportion.chest` −2 came out flat and pointed: the chest is squashed to half there, the bust with it. Below 0 the bust's height is now measured after the stretch (it reaches into the belly), so it stays round. But the real trouble was the belly: with the hips raised (`joints.hipY` 0.52) only 6 cm is left between the hip joint and the chest, and the torso's whole stretch went into it (3.25× at chest −2, 1.9× at 0): no waist, a △, and a belly pushed forward under the bust. Saori picked chest 0 with the bust and waist raised (B), then, with the three views beside it: "横から見ると凄い太って見える" — the toddler's torso is deeper than wide at the belly and hips, and the sliders can't take that out (the pelvis's depth is fixed; widening the hips loses to the waist cut).
- `body.adult` (on, prototype): the ribcage, waist, pelvis and bottom laid out after the stretch, from the shoulder joint and the hip joint by the torso's length T between them (chest −0.2 T, bust −0.15 T, waist −0.46 T from the shoulder joint, the pelvis +0.05 T from the hip joint: the reference's places), sizes in m after the stretch, read back through the stretch (`fin`). Clothes, weights and meshing use them as they are (the shirt and pants are made from the same parts). Off: nothing changes.
- Then (Saori: "臍から胸下が短いのかな"): measured against the picture (fractions of the height, hair's top to soles; the box had counted hidden parts under the floor, which put everything 2–3 % low), the torso was short: chin 0.825 / shoulders 0.783 / bust 0.721 / crotch 0.537 against 0.841 / 0.806 / 0.741 / 0.515, 5.8 heads against 6.3. With the adult torso the torso's stretch no longer smears anything, so it can be longer: torso 1.5, legs 2.15, hipY 0.5, head 0.44 → 6.28 heads, chin 0.839, shoulders 0.80, bust 0.735, crotch 0.518, knee 0.256.
- Then (Saori: "またが下がってる … 腰はさっきの位置のが近い", "横から見た時に胴体が猫背ぽいのと膝がちぎれそうなのが気になる … 背中を反らせる … 膝下で少し後ろにズレる"): hipY back to 0.52 (legs 2.1). The adult torso leans like the picture's: the chest 1.2 cm forward, the waist 2.4 cm forward (the hollow of the back), the pelvis 1.2 cm forward, the bottom 0.5 cm back. The knee joint 1.2 cm further back (adult.kneeZ, −0.018) and the back of the knee filled (kneeBack, made after the stretch): legShape's slim knee was pinched front and back seen from the side.
- Then (Saori: "くびれから上の背中あたりのラインに違和感 … 肩甲骨の位置が下すぎるのかな", "胸が不自然に上に詰まって見える … 見本は鎖骨からなだらかなラインで胸が繋がってるけど、ルミナは鎖骨から急に直角に胸がはじまってる"): the ribcage and the bust both reached above the shoulder joint, so 1.5 cm under the neck's front the chest stood 7 cm forward. Now everything ahead of a line from the neck's front at the collarbone (4 cm over the shoulder joint, z 3 cm) sloping forward 0.75 per m down is taken off the ribcage and the bust (adult.collar; the shirt follows, being made from them). The ribcage leans back at the top (adult.chest.tilt 0.35 rad) and shoulder blades (adult.blades) make the back fullest just under the shoulders, coming in from there to the waist.
- The armpit cut (body/index.js ARMPIT) on the slim adult chest made holes at the collarbones: the torso's side line it cuts outside runs on inward above the armpit. With adult on it only cuts under the shoulder joint.
- Then (Saori: "肩甲骨はちょっとやりすぎて不自然", "胸の下にすこし段があって、お腹で急にぐっと凹んでる … 胸の下の段をはっきりさせて、お腹の凹みはなだらかな方が自然"): the waist piece stood as far forward as the bust just under it (no step) and ended above the pelvis's top (a 1.5 cm dip between). It is now set back at the front (z 0.022, depth 0.048: its back stays where it was, so the hollow of the back stays) and longer, reaching down into a taller pelvis (waist −0.5 T, 0.3 T tall; pelvis 0.36 T). A wide blend between them (k 0.09) was tried: it filled the waist and the step under the bust, a tube again. The collarbone line had been cutting the bust's front too (only 1 cm stood out over the ribcage): its slope is 1 now (0.75), the bust round with a step under it. The shoulder blades smaller and closer in (they widened the chest by 1 cm seen from the front), the ribcage's lean 0.3.
- Then (Saori: "なんで鎖骨の下が窪んでるのかな"): between the neck's piece (trap, ending just under the collarbone) and the ribcage, whose top leans back, nothing came forward: the front went straight down 2 cm under the neck (z 0.037 → 0.044), then out 2 cm within 1.5 cm. An upper-chest piece (P.upperChest, after the stretch, reaching past the collarbone line) fills it and is cut by the line too, so the front from the collarbone to the bust follows the line: 0.037 / 0.042 / 0.053 / 0.073 / 0.089 at 0.80 … 0.76 of the height. Above the collarbone the line now goes straight up along the neck's front (it turned forward there before). The shirt and armor are made over it too (clothes pick "upperChest").
- Then (Saori: "肩甲骨の修正一旦戻して"): the shoulder blades off (adult.blades d 0), the ribcage's lean back to 0.25. And the hump between the shoulders seen from the side was not the blades: the upper-chest piece (centered at z 0, 10 cm deep) stood 5 cm out of the back (the back at 0.75 of the height was at z −0.10 against −0.05). It is centered at z 0.035, 7 cm deep now: the back runs −0.043 / −0.048 / −0.055 / −0.055 / −0.052 / −0.044 / −0.034 from 0.80 to 0.68. (Side views: the arms are lifted 35° and cut off at |x| 0.13 for them; that view showed the hump as well as the arms-down one, so it wasn't the view.)
- A VRoid body as the reference (2026-10-08, Saori made one: bald, a swimsuit, 1.555 m; kept out of git: its export carries the sample model's terms, no redistribution). It can be measured unclothed from any side. Against it the legs were the chibi's stretched 2.1× upright, with the knee 39 % of the way up from the ankle to the hip joint (VRoid 53 %: 0.252 against 0.323 of the height) and thin (mid-thigh 7.2 cm wide against 9.6, the knee 4.5 cm deep against 8.2).
- Adult legs (adult.on): the knee joint at adult.knee (0.53) of the way up, after the stretch; the thigh (a capsule hip→knee, flesh in front and behind), a small kneecap, the shin (a capsule knee→ankle) with the calf high behind it, all made after the stretch between the joints (adult.legs: radii in m); the chibi leg pieces and the knee cuts are left out; the same part names, so pants are made over them. With the knees and ankles at 6.6 cm from the middle (Lumina's 4.25 joined the knees) the legs stand like the VRoid body's from the front.
- fin no longer scales the distance down by the steepest stretch: the clothes stand off the body by distances, and scaled down they stood 2× as far off the adult legs (pants round the hands). After the stretch the distance is exact across, where these surfaces face.
- Then (Saori: "横から見た時膝の上で不自然に凹んでる", "膝から下が後ろにずれてなくない？ モデルの画像と重ねたらわかりやすいかも"): overlaid silhouettes (the VRoid body red, ours blue) showed her VRoid's ankle 2.4 cm behind its knee, ours ahead of it (the knee had been moved back). The feet's pieces and the shoes have their z written out in many places, so instead the leg under the knee leans back as a shear applied with the stretch (makeStretch shz: 0 at the knee, adult.shinBack −0.025 m at the ankle and below; points, normals, joints and the colliders' body alike). The knee back at −0.006. The thigh's front flesh reaches down to the knee (it ended above it: the dip), the kneecap flatter, the calf fuller and a little lower.
- Then (Saori: "ふくらはぎが突然途中で細くなってる"): the calf piece ended halfway down and only the shin's capsule went on to the ankle. A lower piece (calfLow, from 45 % down the shin to the heel, 2 → 1.2 cm) narrows the calf into the Achilles tendon; the shin's capsule thinner (2.8 → 1.6 cm) and a little back at the ankle, the calf fuller (4.6 cm deep, 2.4 cm back).
- Then (Saori made the VRoid body barefoot: "足のつき方が変 … かかとが後ろにですぎ、かかとの上で急に凹んでる"): the heel stood 2 cm behind the Achilles tendon's line, so above it the outline went in sharply. With adult on the heel is 1.1 cm further forward, the lower calf piece reaches down onto it (the tendon straight down to the heel), and the instep runs long and low to the toes (to z 0.085 × feet, 1.3 cm thick at the end; was to 0.05). The candidate's feet 1.08 (the VRoid foot is 2–3 cm longer).
- Then (Saori: "つま先がうえにかたむいて浮いてるのと、足の指が消えてる？ つま先側は指を含めてもう少し伸ばして薄くしたい"): (1) a character made with heels and its shoes taken off kept the heels' foot: bent up in front (heelBend) and narrowed (the toes too, out of sight). Now only when the heels are worn (heelsWorn: kind "heels" and shoes.on not false), for every character. (2) The long instep of the step before ended right where the toes are and buried them (at the fine cells too). With adult on the instep ends at the toes' roots (z 0.062 × feet), the foot is thinner (0.82 of foot.thickness) and no longer, the ball flatter, and the toes 2 cm further forward and flatter (0.8): the toes make the front. At the game cells (1.36 cm) the gaps between toes don't show; at fine they do, as lines.
- The adult body is built at "fine" unless a quality is asked for (createAvatar settings; 2026-10-08, Saori: "うん、いいよ"). At "game" its slim arms (2.4 cm radius on 1.36 cm cells) came out ridged like a spring and the toes' gaps didn't show; "fine" thins back to about as many triangles (the 6-head candidate unclothed 2.9 → 3.1 万, the body alone 1.3 → 1.5 万). It costs the build time (1.5–4× the first time; the cache after). Counted without the outline's shell (the same geometry drawn again): Saori's VRoid body 1.8 万 triangles, ours unclothed with short hair 2.9 万, Lumina dressed 8.9 万 (hair 3.9 万, clothes 3 万, body 1.3 万), Lumina at "lite" 3.6 万.
- The torso and shoulders beside the VRoid body (joints as fractions of the height, VRoid → ours): the shoulder joint 0.805 → 0.768, the hip joint 0.552 → 0.567: the torso between them 0.252 against 0.201, the shoulders 5 cm low (the bust and waist were at the right heights, the shoulders had come down to just over the bust); the head (its bone to the top) 0.128 against 0.170 with hair. The candidate now: torso 2.0, legs 2.2, head 0.38, hipY 0.52 → shoulder 0.802, hip 0.555, knee 0.318. The adult torso is placed by the VRoid's ratios between the joints: the bust 0.24 T under the shoulder joint (was 0.15), the ribcage −0.25 T and 0.3 T tall; the waist further forward (z 0.03: the back's hollow as deep as the VRoid's), the pelvis 1.14 and the thighs' tops 0.054 m (the VRoid is wider at the crotch). The candidate's bust 0.75 (the VRoid's is bigger than Lumina's 0.56).
- Then (Saori: "なんかさっきより離れてない？頭小さすぎじゃないん"): the head had been matched against the VRoid's bald head with our short hair on, so the head itself came out too small. With the hair hidden (its meshes), 0.48 matches the VRoid head from the front; from the side the VRoid's skull reaches further back and its jaw lower. Torso 2.0 and legs 2.2 kept: the shoulder joint 0.793, the hip 0.549, the knee 0.315 (of the height to the skull's top).
- Then (Saori: "腕がピッタリ体についてるから、Aポーズにした方が良くない？ 体細すぎる気がする"): compared in the A-pose (the VRoid's arms turned to our A-pose's angle, 64° down: our arms are steeper with a long torso), the VRoid body is about 20 % wider at the chest and waist and a third wider at the lower belly, its hips flaring from higher up (0.62 of the height). The adult torso: the ribcage 9.4 cm half-wide (was 8), 7.2 deep; the waist 7.4 × 5.6; the pelvis 12.6 cm, 0.4 T tall, centered 0.1 T over the hip joint; the thighs' tops 6 cm. The candidate's arms 0.62 / 0.58 (were 0.504 / 0.476).
- For comparing, the check page (_six.html, not committed) puts thin black underwear on the avatar (the posed body's skin where a bra and briefs would be, 1.5 mm out), like the VRoid body's bikini (Saori's idea).
