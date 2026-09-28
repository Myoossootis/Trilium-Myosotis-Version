from __future__ import annotations

import json
import re
import shutil
import xml.etree.ElementTree as ET
from pathlib import Path

from fontTools.fontBuilder import FontBuilder
from fontTools.ttLib import newTable
from fontTools.ttLib.tables.S_V_G_ import SVGDocument
from fontTools.ttLib.tables._g_l_y_f import Glyph as TTGlyph


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "vendor-electronic-symbols-20260918" / "SVG"
OUT = ROOT / "electronic-symbols-font-preview-20260918"


# The first test pack intentionally stays small.  The files are kept with their
# upstream names so the source-to-glyph mapping is easy to audit.
SYMBOLS = [
    ("electronic-bjt-npn", "Transistor-COM-BJT-NPN.svg", "BJT NPN", ["bjt", "npn", "transistor"]),
    ("electronic-bjt-pnp", "Transistor-COM-BJT-PNP.svg", "BJT PNP", ["bjt", "pnp", "transistor"]),
    ("electronic-mosfet-n", "Transistor-COM-MOSFET-N.svg", "MOSFET N", ["mosfet", "nmos", "transistor"]),
    ("electronic-mosfet-p", "Transistor-COM-MOSFET-P.svg", "MOSFET P", ["mosfet", "pmos", "transistor"]),
    ("electronic-ferrite-bead", "Inductor-COM-Ferrite-Bead.svg", "Ferrite bead", ["ferrite", "bead", "inductor"]),
    ("electronic-opamp", "IC-COM-OpAmp.svg", "Operational amplifier", ["opamp", "amplifier", "ic"]),
    ("electronic-crystal", "Miscellaneous-COM-Crystal_Oscillator.svg", "Crystal oscillator", ["crystal", "oscillator"]),
    ("electronic-relay-spst-no", "Relay-COM-COM-SPST-NO.svg", "Relay SPST NO", ["relay", "spst", "no"]),
]

BASE_CODEPOINT = 0xF700
UPSTREAM = "https://github.com/chris-pikul/electronic-symbols"


def source_svg(path: Path) -> tuple[str, tuple[float, float, float, float]]:
    raw = path.read_text(encoding="utf-8")
    ET.register_namespace("", "http://www.w3.org/2000/svg")
    root = ET.fromstring(raw)
    view_box = root.attrib.get("viewBox", "0 0 100 100").split()
    if len(view_box) != 4:
        raise ValueError(f"Invalid viewBox in {path}")
    x, y, width, height = (float(v) for v in view_box)

    # The source package uses black monochrome strokes/fills.  currentColor
    # makes the OpenType-SVG glyph behave like a normal Trilium icon font.
    for element in root.iter():
        for attr in ("fill", "stroke"):
            if element.attrib.get(attr, "").lower() in {"#000", "#000000", "black"}:
                element.set(attr, "currentColor")
    # Keep only the drawable children and place them in an explicit SVG root.
    body = "".join(ET.tostring(child, encoding="unicode") for child in list(root))
    # OpenType's SVG coordinate system is font-like (positive Y upwards).  The
    # transform maps the source's top-left SVG viewBox into a 0..900 em box.
    sx = 900.0 / width
    sy = 900.0 / height
    tx = -x * sx
    ty = -y * sy
    # Flip Y and leave a 100-unit descent for normal text-line alignment.
    doc = (
        '<svg xmlns="http://www.w3.org/2000/svg" '
        'viewBox="0 0 1000 1000" width="1000" height="1000">'
        f'<g transform="translate({tx:g} {900 + ty:g}) scale({sx:g} {-sy:g})">{body}</g></svg>'
    )
    return doc, (x, y, width, height)


def build_font(font_path: Path, docs: list[tuple[int, str, str]]) -> None:
    glyph_order = [".notdef"] + [name for _, name, _ in docs]
    cmap = {codepoint: name for codepoint, name, _ in docs}
    metrics = {name: (1000, 0) for name in glyph_order}
    glyphs = {name: TTGlyph() for name in glyph_order}

    fb = FontBuilder(1000, isTTF=True)
    fb.setupGlyphOrder(glyph_order)
    fb.setupCharacterMap(cmap)
    fb.setupGlyf(glyphs)
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=900, descent=-100)
    fb.setupOS2(sTypoAscender=900, sTypoDescender=-100, usWinAscent=900, usWinDescent=100)
    fb.setupNameTable(
        {
            "familyName": "Electronic Symbols Preview",
            "styleName": "Regular",
            "uniqueFontIdentifier": "electronic-symbols-preview-20260918",
            "fullName": "Electronic Symbols Preview Regular",
            "psName": "ElectronicSymbolsPreview-Regular",
            "version": "Version 1.0",
        }
    )
    fb.setupPost()

    svg_table = newTable("SVG ")
    svg_table.docList = [SVGDocument(data, gid, gid) for gid, (_, _, data) in enumerate(docs, start=1)]
    fb.font["SVG "] = svg_table
    font_path.parent.mkdir(parents=True, exist_ok=True)
    fb.save(font_path)


def main() -> None:
    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / "source-svg").mkdir(parents=True)

    docs: list[tuple[int, str, str]] = []
    manifest_icons: dict[str, dict] = {}
    source_manifest: list[dict] = []
    for index, (icon_id, filename, label, terms) in enumerate(SYMBOLS):
        src = SOURCE / filename
        if not src.exists():
            raise FileNotFoundError(src)
        codepoint = BASE_CODEPOINT + index
        document, view_box = source_svg(src)
        docs.append((codepoint, icon_id, document))
        shutil.copy2(src, OUT / "source-svg" / filename)
        manifest_icons[icon_id] = {
            "glyph": chr(codepoint),
            "terms": [label, *terms],
        }
        source_manifest.append(
            {
                "id": icon_id,
                "label": label,
                "source": filename,
                "codepoint": f"U+{codepoint:04X}",
                "viewBox": [*view_box],
                "upstream": UPSTREAM,
            }
        )

    # Build both TTF (easy to inspect) and WOFF2 (what Trilium loads).
    # SVGDocument indexes use glyph IDs, not codepoints.
    build_font(OUT / "electronic-symbols-preview.ttf", docs)
    font = __import__("fontTools.ttLib", fromlist=["TTFont"]).TTFont(OUT / "electronic-symbols-preview.ttf")
    font.flavor = "woff2"
    font.save(OUT / "electronic-symbols-preview.woff2")

    (OUT / "icon-pack.json").write_text(
        json.dumps({"icons": manifest_icons}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (OUT / "source-manifest.json").write_text(
        json.dumps(source_manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (OUT / "font.css").write_text(
        "@font-face {\n"
        "  font-family: 'electronic-symbols-preview';\n"
        "  src: url('./electronic-symbols-preview.woff2') format('woff2'), url('./electronic-symbols-preview.ttf') format('truetype');\n"
        "  font-weight: normal;\n  font-style: normal;\n}\n"
        ".electronic-symbol { font-family: 'electronic-symbols-preview'; font-style: normal; font-weight: normal; }\n",
        encoding="utf-8",
    )

    rows = []
    for index, (icon_id, filename, label, terms) in enumerate(SYMBOLS):
        rows.append(
            f'<div class="item"><div class="icon">&#x{BASE_CODEPOINT + index:X};</div>'
            f'<div class="label">{label}<small>{filename}</small></div></div>'
        )
    (OUT / "preview.html").write_text(
        "<!doctype html><meta charset='utf-8'><title>Electronic Symbols Preview</title>"
        "<style>body{font-family:system-ui,sans-serif;background:#f6f2ea;color:#223;max-width:1100px;margin:30px auto;padding:0 24px}"
        ".grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.item{background:white;border:1px solid #d9d1c4;border-radius:12px;padding:16px;display:flex;align-items:center;gap:12px}"
        ".icon{font-family:'electronic-symbols-preview';font-size:64px;line-height:1;color:#21304b;width:80px;text-align:center}.label{font-weight:600}.label small{display:block;font-weight:400;color:#777;font-size:11px;word-break:break-all;margin-top:4px}"
        "@media(max-width:760px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}</style>"
        "<h1>Electronic Symbols · font preview</h1><p>OpenType-SVG test font; source: chris-pikul/electronic-symbols</p>"
        f"<div class='grid'>{''.join(rows)}</div>\n"
        "<link rel='stylesheet' href='./font.css'>",
        encoding="utf-8",
    )
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
