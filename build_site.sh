#!/bin/sh
# ============================================================
#  build_site.sh — the files the site serves, into dist/ (no upload): sh build_site.sh
#
#  The site carries what pages load (and llms.txt, the agents' guide); notes and working files stay out (the same list as devlog's build_site.sh):
#  ⛔ notes (*.md), working data (*.psd *.py), tools (tools/ docs/ facekit/), the reference sheet (sotai-ref.jpg). examples/ is in: llms.txt links it
#  ⚠️ don't drop what a page loads: before excluding something new, grep the html / js for it
#  The top page (/) goes to the editor; the test page is /body.html
# ============================================================
set -e
cd "$(dirname "$0")"
rm -rf dist
mkdir dist
tar -cf - \
  --exclude='./.git' --exclude='./.github' --exclude='./dist' --exclude='.gitignore' --exclude='./build_site.sh' \
  --exclude='*.md' --exclude='*.psd' --exclude='*.py' \
  --exclude='./tools' --exclude='./docs' --exclude='./facekit' \
  --exclude='sotai-ref.jpg' \
  . | tar -C dist -xf -
# the live-sync helper is a tool, but people run it from the site (one file, no clone): curl -O https://hinagata.pages.dev/sync.mjs
cp tools/sync.mjs dist/sync.mjs
cp docs/options.schema.json dist/options.schema.json   # (its MCP tools check recipes and find options with it)

cat > dist/index.html <<'HTML'
<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Hinagata</title>
<meta http-equiv="refresh" content="0; url=editor/"><link rel="canonical" href="editor/"></head>
<body style="font-family:system-ui,sans-serif;padding:24px"><a href="editor/">Hinagata Editor</a> · <a href="body.html">素体の確認ページ</a></body></html>
HTML

# stop if something that should be left out is still there (once it is up, it is too late)
left=$(find dist -type f \( -name '*.md' -o -name '*.psd' -o -name '*.py' -o -name 'sotai-ref.jpg' \) | head -5)
if [ -n "$left" ]; then echo "⛔ still in dist/:"; echo "$left"; exit 1; fi
echo "dist/: $(find dist -type f | wc -l) files, $(du -sh dist | cut -f1)"
