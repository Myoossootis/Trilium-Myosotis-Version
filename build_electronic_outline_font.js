/* Build a conventional outline icon font from the upstream SVG symbols.
 *
 * The upstream drawings intentionally use SVG strokes.  A TrueType/WOFF2
 * glyph cannot retain arbitrary SVG stroke attributes, so we first expand the
 * strokes to filled outlines with svg-outline-stroke, then feed the result to
 * svgicons2svgfont and svg2ttf.  This is the same conversion class used by
 * Fontello-style webfont pipelines and is kept separate from the SVG-table
 * experiment in build_electronic_svg_font.py.
 */
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { Readable } = require('stream');
const outlineStroke = require('./.font-build-tools/node_modules/svg-outline-stroke');
const { SVGIcons2SVGFontStream } = require('./.font-build-tools/node_modules/svgicons2svgfont');
const svg2ttf = require('./.font-build-tools/node_modules/svg2ttf');

const root = __dirname;
const source = path.join(root, 'vendor-electronic-symbols-20260918', 'SVG');
const out = path.join(root, 'electronic-symbols-font-preview-20260918');
const outlined = path.join(out, 'outlined-svg');
fs.mkdirSync(outlined, { recursive: true });

const symbols = [
  ['electronic-bjt-npn', 'Transistor-COM-BJT-NPN.svg', 0xF700],
  ['electronic-bjt-pnp', 'Transistor-COM-BJT-PNP.svg', 0xF701],
  ['electronic-mosfet-n', 'Transistor-COM-MOSFET-N.svg', 0xF702],
  ['electronic-mosfet-p', 'Transistor-COM-MOSFET-P.svg', 0xF703],
  ['electronic-ferrite-bead', 'Inductor-COM-Ferrite-Bead.svg', 0xF704],
  ['electronic-opamp', 'IC-COM-OpAmp.svg', 0xF705],
  ['electronic-crystal', 'Miscellaneous-COM-Crystal_Oscillator.svg', 0xF706],
  ['electronic-relay-spst-no', 'Relay-COM-COM-SPST-NO.svg', 0xF707],
];

function charFor(codepoint) {
  return String.fromCodePoint(codepoint);
}

async function outlineAll() {
  for (const [name, filename] of symbols) {
    const input = fs.readFileSync(path.join(source, filename));
    // The source drawings are small but deliberately simple.  Potrace traces
    // the rendered stroke at the SVG's intrinsic size, retaining the source
    // proportions while producing closed filled contours.
    const svg = await outlineStroke(input, { color: '#000000', optCurve: true, threshold: 128 });
    fs.writeFileSync(path.join(outlined, `${name}.svg`), svg);
  }
}

function makeSvgFont() {
  return new Promise((resolve, reject) => {
    const destination = path.join(out, 'electronic-symbols-outline.svg');
    const stream = new SVGIcons2SVGFontStream({
      fontName: 'electronic-symbols-preview',
      fontId: 'electronic-symbols-preview',
      fontHeight: 1000,
      ascent: 900,
      descent: 100,
      fixedWidth: true,
      centerHorizontally: true,
      centerVertically: true,
      normalize: true,
      preserveAspectRatio: true,
      log: () => {},
    });
    stream.on('error', reject);
    const output = fs.createWriteStream(destination);
    output.on('error', reject);
    output.on('finish', () => resolve(destination));
    stream.pipe(output);
    for (const [name, , codepoint] of symbols) {
      const file = path.join(outlined, `${name}.svg`);
      const glyph = fs.createReadStream(file);
      glyph.metadata = { unicode: [charFor(codepoint)], name };
      glyph.on('error', reject);
      stream.write(glyph);
    }
    stream.end();
  });
}

async function main() {
  await outlineAll();
  const svgFont = await makeSvgFont();
  const ttf = svg2ttf(fs.readFileSync(svgFont, 'utf8'), {
    copyright: 'Source symbols: chris-pikul/electronic-symbols; generated preview only',
    description: 'Electronic symbols preview font',
    version: '1.0',
  });
  fs.writeFileSync(path.join(out, 'electronic-symbols-outline.ttf'), Buffer.from(ttf.buffer));
  console.log(svgFont);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
