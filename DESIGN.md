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
    materials.js        toon ramp, outline, clay
    export.js           GLB export (A-pose, outlines off)
  presets/              JSON files: bodies, hairstyles, faces, outfits (templates for agents)
  playground/           index.html + playground.js (the UI; imports src/)
  tools/
    shoot.mjs           render front / side / 3-4 / back PNGs from options (for agents to check their work)
  facekit/              (as now)
  docs/
    AGENTS.md           how to use and extend, for coding agents
    options.schema.json every option: type, range, default, rebuild yes/no
  examples/             copy-paste examples (one character, a crowd of NPCs, walking, export)
```

## API

```ts
createAvatar(options?: AvatarOptions, settings?: { quality?: "game" | "high" | "low", cell?: number, simplify?: number, cache?: boolean, cull?: boolean, onProgress?: (p: number) => void }): Promise<Avatar>

interface Avatar {
  object: THREE.Group          // add to your scene; contains the skinned meshes and the skeleton
  options: AvatarOptions       // fully resolved options (defaults filled in)
  bones: Record<BoneName, THREE.Bone>
  update(dt: number): void     // advance motion and blinking
  play(motion: string, opts?: { fade?: number }): void
  setColors(colors: Partial<Colors>): void          // instant
  setOutline(o: { on?: boolean, width?: number, color?: string }): void   // instant
  setShading(style: "toon" | "smooth" | "flat"): void   // instant
  setFace(face: Partial<FaceOptions>): Promise<void> // instant (redraws the face texture)
  rebuild(options: Partial<AvatarOptions>): Promise<void>  // regenerates only what changed
  exportGLB(): Promise<ArrayBuffer>
  dispose(): void
}
```

## Options

Two tiers, so the common knobs stay short and the sculpt details stay out of the way.

**Public** (documented with ranges, shown as sliders in the playground):

```jsonc
{
  "colors": { "skin": "#ffe0c8", "hair": "#6a4a30", "eyes": "#4f6a9a" },
  "outline": { "on": true, "width": 1, "color": "#3a2a3a" },   // art style: some games want no outline. avatar.setOutline() changes it instantly
  "shading": { "style": "toon" },   // "toon" (3 flat bands) | "smooth" (soft light falloff) | "flat" (no lighting). avatar.setShading() changes it instantly
  "face": {
    "eyes": "image", "brows": "image", "mouth": "image",   // or code-drawn: "round", "smile", "closed", ...
    "images": { "eye": "img/parts/eye.png", "brow": "img/parts/brow.png", "mouth": "img/parts/mouth.png" },
    "cheeks": "none"
  },
  "hair": { "bangs": "none", "back": "short", "ahoge": false },
  "outfit": {
    "shirt": { "color": "#7fb6e8" },                        // null = no shirt
    "pants": { "color": "#5a4f7a", "hem": 0.3 },
    "socks": { "color": "#f7f3ea", "top": 0.15 },
    "shoes": { "color": "#c8564b", "sole": "#f4f1ea" }
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
| `"game"` + `simplify: 0.4` (one thread) | ~1.9 s | ~14,000 |
| any of the above, second time (`cache`) | **~0.05 s** | same |

- **game quality**: building time is mostly grid sampling, so a coarser grid is the biggest lever. Only thin tips and cut edges (bang tips, hems, sock tops) get slightly rougher; the face parts are drawn into a texture and don't change.
- **workers** (`src/pool.js`, `src/worker.js`, `src/build.js`): the body and the hair are built at once, then the clothes (they read the body's grid). Each part's grid is sampled in slabs and its vertices are projected and weighted in slices, on 1–4 workers; the cheap steps in between run on the main thread. `surfaceNets` is split into the same steps (`sampleGrid → fixAmbiguous → extractVerts → projectVerts → quads`) and the part table is shared (`src/parts.js`), so the mesh is identical to a one-thread build (same `checksum()`). If workers can't start or a job doesn't answer in 15 s, everything falls back to the main thread.
- **cache**: built meshes (and which body vertices the clothes cover) go to IndexedDB under a key made of the resolved options (without colors, outline, shading and blush) and the source text of the generator modules (`src/cache.js`), so editing the sculpt code never returns a stale mesh. The newest 12 characters are kept.
- **the body's cell table** (`blendFast`): the list of parts that matter in each 4 cm cell is now built per cell on first use (a whole table cost ~0.25 s, paid again by every worker and by a cached build that never meshes).
- **cull**: body triangles deep (6 mm) inside a visible shirt, pants or shoes are left out of the body's index (about 4,000 at game quality). It follows each garment's `.m.visible`, so hiding a garment brings the body back. Socks are skipped (the leg is only ~2 mm inside).
- **simplify**: meshoptimizer after building. Simplifying the high-quality mesh to 1/10 (~15,000) looked the same as the original in a side-by-side check; it is optional because it needs the extra package (and it keeps the build on the main thread).
- `avatar.TIMES` shows where a build spent its time (ms per step).

## Playground

- 3D view on the left, panel on the right: Body / Face / Hair / Outfit / Motion.
- Panel generated from `options.schema.json` (public tier). An "Advanced" section shows sculpt values.
- Buttons: Copy as code (only the values that differ from the defaults), Save / Load JSON, Export GLB, Save PNG.
- "Generating…" indicator while geometry is rebuilt. Works on phones.
- English UI, Japanese toggle.
- Developer drawer (collapsed): clay, wireframe, bones, compare with reference sheet, face sheet export.

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

## Scope: chibi only, but wide within it

Low head-to-body ratio only (about 2 to 3 heads). Tall anime characters are well served by VRoid and game engines, and are heavy for browser games built with three.js — the target users here. Within chibi proportions, the goal is range: with effort the same system can make a cute anime girl or a knight in fantasy armor. What that takes:

- **Proportion sliders within the chibi range** (head size, leg length, chubbiness). Joints that these sliders move are computed from proportion values, and the parts attached to them are placed relative to those joints. No separate base bodies.
- **Hair is the biggest quality lever** for cute characters: long hair, layered bangs, ponytails, twin tails, made of strands on spring bones.
- **Hard surfaces** (armor plates, helmets, weapons) don't come out well from the soft blending used for the body. They are built as separate rigid meshes (simple shapes, beveled edges, or loaded models) attached to bones, with detail (engraving, trim) in textures.
- **Clothing beyond basics**: skirts, frills, capes on spring bones (see reference presets).

## Playground look

Should feel like a dependable developer tool, not a toy: neutral palette, one accent color, clear type hierarchy, consistent spacing, a visible version number, and links to the docs and the repository.

Open (2026-10-02): this was written for the GitHub playground. The maker on the site is for people who don't write code, so it may want the site's playful look instead, with the same engine underneath.

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
- **The engine moves to its own public repository** at some point. When is the owner's call.

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
- **Where the solo boss lives** (2026-10-02, decided): deep in the old-growth forest. Only people who widen the forest find it. Once found, the plaza's warp hole gains a second destination ("the boss's lair"), so later visits skip the forest. People who haven't found it see nothing new.
- The maker's look: see "Playground look" — the GitHub playground and the site's maker may want different looks.

## Face parts editor (plan, from Saori 2026-10-02)

When the face editor is built for real (beyond the check page's 枠つきPNGを読む):

- Reading a drawing asks for an **expression name** (e.g. にっこり笑顔).
- Only frames that have something drawn are read; empty frames are ignored.
- Each part that was read is registered under that name in its own slot: eyes「にっこり笑顔」, mouth「にっこり笑顔」, ... (parts accumulate; a later drawing doesn't replace an earlier name's parts).
- The name is also registered as an expression preset: choosing「にっこり笑顔」in the expressions sets every slot that has a part by that name (slots without one keep what they have).
- So one drawing = one expression, and its parts can still be mixed with other expressions'.

## Decisions

Decided: working name "Hinagata" (check npm before publishing); code-drawn face is the default; first body sliders are head size, chubbiness and leg length; chibi proportions only.
