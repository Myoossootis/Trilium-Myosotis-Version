# Native SVG icon packs

Windows deployment updates `trilium.exe` and `resources/app.asar` as a matching pair. The executable's `ElectronAsar` integrity resource must contain the new archive header hash. Per-file hashes and block hashes are also updated; integrity validation stays enabled. Since this is a personal modified build, its obsolete official Authenticode signature is detached: the resulting executable is unsigned, not officially signed. Install only while all Trilium processes are closed. Both files are backed up and restored together on a deployment failure. Do not distribute only one of the two updated files.

Electronic Symbols now uses its 116 original SVGs, retaining the existing `electronic-symbols icon-id` classes and search terms. The native registry, picker, tree, tabs, title, launchers, and icon-pack preview use SVG CSS masks, preserving geometry while inheriting theme color. The original font attachment is retained for rollback but is not required by SVG packs.

A code/file note with MIME `application/json` and label `iconPack=your-prefix` can contain:

```json
{"format":"svg","version":1,"icons":{"example":{"svg":"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\"><path fill=\"none\" stroke=\"#000\" stroke-width=\"2\" d=\"M2 12h20\"/></svg>","terms":["example"]}}}
```

No font attachment is required. This version supports monochrome geometric SVGs: paths, groups, circles, lines, rectangles, ellipses, polygons, and polylines. Scripts, external resources, event handlers, styles, embedded HTML, filters, text, and unsupported attributes are rejected. Convert transforms to coordinates before importing. Multi-color rendering is not supported by masks.

Build the manifest with `python tools/install_svg_electronic_symbols.py --build customizations/svg-icons/electronic-symbols.json`. Install native runtime support using `node tools/patch_svg_icon_support.cjs path/to/resources/app.asar`, then update the database with `python tools/install_svg_electronic_symbols.py --db path/to/document.db`. Both installers create backups. Restart Trilium normally to load the changes. Never apply the SVG database migration to an unpatched runtime.

Tests: `node tools/test_svg_icons.cjs`; `node tools/build_svg_icons_preview.cjs` creates a browser fixture that decodes all 116 SVG images and checks class selection and inherited color. Keep the extracted runtime in sync using `node tools/patch_svg_icon_support.cjs --source trilium-asar-work-20260915`. Seed rebuilds automatically retain the SVG manifest. MIT source attribution and original license remain in `vendor-electronic-symbols-20260918/LICENSE`.

Real startup regression: launch the portable build with `TRILIUM_DATA_DIR` set to a disposable seed directory, `TRILIUM_DOCUMENT_PATH` pointing to its SQLite seed, `TRILIUM_PORT=37940`, and `--remote-debugging-port=37942 --user-data-dir=<isolated profile>`. Run `node tools/test_svg_native_startup.cjs`: it verifies real Electron boot, the native registry's 116 icons, the actual isolated preview iframe, and class-based SVG rendering. Close the test browser before deployment. Never use the personal database for tests.
