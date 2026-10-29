# Sources and reproducible components

Runtime: Trilium Notes **0.105.0**, Windows x64, upstream commit `a0908a6e1e1741a3c3824d803da07300183dcb0c`.

Corresponding upstream source: https://github.com/TriliumNext/Trilium/tree/a0908a6e1e1741a3c3824d803da07300183dcb0c . Source archive: https://github.com/TriliumNext/Trilium/archive/a0908a6e1e1741a3c3824d803da07300183dcb0c.zip . Upstream AGPL-3.0-only license is included as `LICENSE`.

The runtime's only local application patch is inline SVG icon-pack support. Source is `customizations/svg-icons/runtime.js`; the archive/executable integrity patcher and exact anchors are in `tools/patch_svg_icon_support.cjs`. Existing Chromium and Electron licenses remain in the runtime. This is a custom, unsigned build.

Plugin sources are in `customizations/` and root `trilium-*.js` / `trilium-*.css`. The sanitized `trilium-seed-data/document.db` additionally contains the full editable code notes and required historical plugin resources. It is directly inspectable with SQLite or Trilium's code-note editor. `MyoMarketData` records each feature's component IDs.

`tools/build_integrated_seed.py` constructs a seed from allowlisted program notes and synthetic defaults, using an existing public seed as the schema/default-options template. `tools/build_integrated_release.py` copies only explicit program/runtime sources. `tools/portable_bootstrap.py` generates a distinct database identity on each fresh installation and preserves an existing database.

Bundled helper provenance and licenses are under `trilium-portable/myosotis-tools/`: Python embeddable 3.13.9 (PSF), GitHub CLI 2.102.0 (MIT), and pure Python PyYAML 6.0.3 (MIT). Credentials and local profiles are excluded. See `THIRD_PARTY_NOTICES.md` for other plugin dependencies.
