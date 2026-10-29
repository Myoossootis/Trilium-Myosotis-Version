# DSH chat renderer

The offline DSH chat renderer bundles KaTeX 0.19.1 (Khan Academy and contributors) and markdown-it 15.0.3 (Vitaly Puzrin, Alex Kocharin and contributors), both MIT licensed. Unmodified browser distributions, complete license texts, exact npm source URLs, SHA-512 package integrity and SHA-256 script digests are in `customizations/vendor/dsh-chat-markdown/`. The generated note is built by `tools/build_dsh_chat_formatter.py`; the local delimiter integration is in `customizations/frontend/dsh-chat-format.js`. Native MathML output is used; no KaTeX font files are distributed.

# Home Pages

The homepage card styles, 12-column layout design and pointer sorting helper are adapted from [jepicaju862-lab/home-pages](https://github.com/jepicaju862-lab/home-pages), revision `2f98a7c44432a5e077977535f94093487417c735` (Home Pages 0.3.1).

Copyright Home Pages contributors (author: and). Licensed under GNU GPL version 3 only. The full license is in `customizations/licenses/home-pages-GPL-3.0.txt`. Adaptations for the Trilium Preact lifecycle, local note storage, existing ToDo and Pomodoro services, and original-workbench navigation are provided in source form in this repository. The pointer helper was transpiled from the upstream `src/ui/sortable.ts` using Node's TypeScript transform; Obsidian services are not bundled or executed.

# Apex Dashboard

Pomodoro activity-color hashing and donut/heatmap interaction adapted from [PandoraReads/apex-dashboard](https://github.com/PandoraReads/apex-dashboard), revision `556a33e110e55946dcd6d3dde7c2f72a65585ccf`. Obsidian-specific services were rewritten for the existing Trilium runtime and Preact UI.

MIT License

Copyright (c) 2025 PandoraReads

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## DeepSeek official whale

`customizations/assets/deepseek/whale.svg` is the official favicon from https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/web/public/favicon.svg . The upstream MIT license is preserved beside it as `LICENSE.txt`. DeepSeek and its logo remain trademarks of their owner; this integration is not an official DeepSeek product. The SVG path is unchanged; UI rendering may inherit the theme foreground color.

## Windows runtime helpers

Python embeddable 3.13.9 is redistributed from the official python.org distribution under the PSF license; its complete license remains in `trilium-portable/myosotis-tools/python/LICENSE.txt`. GitHub CLI 2.102.0 is redistributed under MIT with `GITHUB_CLI_LICENSE.txt`. Version, upstream URL and SHA-256 provenance files accompany both helpers. Pure Python PyYAML 6.0.3 is included solely for installing the DSH profile overlay; its MIT license is `python/PyYAML-LICENSE.txt`, source: https://pypi.org/project/PyYAML/6.0.3/ . No system credentials or local Python environment are bundled.

## Icon-pack fonts

The seed retains Font Awesome Free fonts (Fonticons, Inc.; SIL OFL 1.1 for fonts, with the upstream combined license in `customizations/licenses/font-awesome-LICENSE.txt`, source https://github.com/FortAwesome/Font-Awesome). Noto Color Emoji is Copyright 2013 Google LLC, SIL OFL 1.1 (`noto-color-emoji-OFL.txt`, source https://github.com/googlefonts/noto-emoji). Material Symbols are Google Material Design icons under Apache-2.0 (`material-symbols-LICENSE.txt`, source https://github.com/google/material-design-icons). Font files remain unmodified. The existing electronic-symbols and Tabler source packages retain their own notices and licenses in their respective directories.
