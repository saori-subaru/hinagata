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

## Live sync with an agent

Have the agent keep the character in a file (`character.json`: the recipe, only what differs from the defaults) and fine-tune it in the editor while both see each other's changes:

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

Design notes, API and decisions: [`DESIGN.md`](DESIGN.md).

Used by: the saon site (`saori-subaru/devlog`, as a git submodule at `site/avatar/`) and the forest game.

Private for now; the license is not decided yet.
