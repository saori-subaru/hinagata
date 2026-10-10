# Hinagata

A 3D character engine for the browser, built on three.js: anime-style characters, tall (the default, about 4.5 heads), adult (about 6) or chibi.

- A character is a **recipe**: a small options object (JSON), not a mesh file. The body, clothes, hair and face are built from code at runtime.
- **Motions are code and fit the body**: walk (with the stride measured from the legs), jump, fall, climb with IK onto any surface the game describes.
- Comes with an **editor** (`editor/`) for making characters, and a test page (`body.html`).
- Online: **https://hinagata.pages.dev** (the editor) and https://hinagata.pages.dev/body.html (the test page), deployed on every push to `main` (`.github/workflows/site.yml`, files picked by `build_site.sh`).

```js
import { createAvatar } from "./src/index.js";   // needs an import map for "three"
const avatar = await createAvatar(recipe);   // the default body is tall; a chibi: { ...BODY_TYPES.standard, … }
scene.add(avatar.object);                    // about 1.6 units tall: scale it to your world (in metres: an adult about 1.7 m)
avatar.play("walk");
// every frame
avatar.update(dt);
```

Build the game's world at real scale and size the characters to it; the world's scale comes from what the game is, not from the default
character (a chibi game may scale its world to its chibis).

**Character files and versions.** The editor exports `{ "hinagata": 5, "name": …, "options": { the recipe } }`. `"hinagata"` is the recipe
version: the defaults the recipe is written against. Until 2026-10-06 the default body was the chibi; recipes stored without a version
(bare recipe files, the editor's saved characters, `?o=` links) and version 1 files are read with those old defaults, so they don't change.
Version 2 files (the first tall default, about 4 heads, that same day) keep that body; version 3 its head of 0.7 (about 4.2 heads, until
2026-10-10); version 4 about 4.5 heads; version 5 is today's (the long hair's length in base space, so it stays with the body type).
A bare options object passed in code uses today's defaults (the tall body). One function reads them all: `openRecipe` (src/options.js).

## Live sync with an agent

Have the agent keep the character in a file (`character.json`: a character file as above, its options only what differs from the defaults) and fine-tune it in the editor while both see each other's changes:

```sh
curl -O https://hinagata.pages.dev/sync.mjs     # once (or tools/sync.mjs here); Node 18+, no dependencies
node sync.mjs character.json                     # prints a link: open it
```

The editor opened from that link shows the file as a character of its own. When the agent (or anyone) saves the file, the editor follows within a moment, one undo step per change; what you change in the editor is written back into the file (keys in a steady order, so the agent reads your tweaks as a diff). The link carries a key made for this run: other pages can't read or write the file. Works in Chrome and Firefox (a page on the web reaching `127.0.0.1`).

### As an MCP server

The same helper serves the agent itself (`--mcp`): it changes the character, finds options, checks the recipe, and sees the character in a picture rendered by the open editor.

```sh
claude mcp add hinagata -- node /path/to/sync.mjs /path/to/character.json --mcp     # Claude Code; other agents: the same command as a stdio server
```

Tools: `editor_link` (the link to give the user), `get_recipe`, `update_recipe` (`{ set: { "dotted.path": value }, reset: [paths] }`, checked as it is written), `check_recipe`, `find_options` (by words, Japanese or English) and `screenshot` (`view`: free / front / side / back / face, `pose`: idle, walk, run, sitChair…; needs the editor open from the link). Run either this or the plain helper for a file, not both (they'd share the port: `--port` another).

**Lighter meshes.** `createAvatar(recipe, { quality: "lite" })` or `{ simplify: 0.15 }` thins the meshes with meshoptimizer. The face is
kept as built, and thinning stops before the shape would change by more than 1% of a part's size (it may keep more triangles than the share
asked for; the body doesn't go thin). After changing the engine, run the thinning check: `node tools/thin-check.mjs` (headless Chrome; builds
a tall, a chibi, a version-less recipe and a slim body at "fine", "lite" and 0.15, measures their depth front to back against the unthinned
build, writes front and side pictures to `thin-check-out/`, exits 1 when one went thin or spiky).

Design notes, API and decisions: [`DESIGN.md`](DESIGN.md).

Used by: the saon site (`saori-subaru/devlog`, as a git submodule at `site/avatar/`) and the forest game.

Public; the license is not decided yet.

**For agents**: [`llms.txt`](llms.txt) (also https://hinagata.pages.dev/llms.txt) — how to use it in a game, the recipe, and keeping the character live in the user's editor.
