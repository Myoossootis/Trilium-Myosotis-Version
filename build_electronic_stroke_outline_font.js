/* Convert the source's geometric strokes to closed font contours.
 *
 * This keeps the symbols as line art (unlike bitmap tracing, which can turn a
 * stroked circle into a solid disk).  svg-path-outline generates the outside
 * and inside edges of each stroke; svgicons2svgfont/svg2ttf then packages those
 * contours as a conventional TrueType/WOFF2 icon font.
 */
const fs = require('fs');
const path = require('path');
const { DOMParser } = require('@xmldom/xmldom');
const outline = require('svg-path-outline');
const { SVGPathData, SVGPathDataTransformer } = require('svg-pathdata');
const { SVGIcons2SVGFontStream } = require('svgicons2svgfont');
const svg2ttf = require('svg2ttf');

const root = __dirname;
const source = path.join(root, 'vendor-electronic-symbols-20260918', 'SVG');
const out = path.join(root, 'electronic-symbols-font-20260918');
const outlineDir = path.join(out, 'outline-paths');
fs.mkdirSync(outlineDir, { recursive: true });

const manifest = JSON.parse(fs.readFileSync(
  path.join(root, 'vendor-electronic-symbols-20260918', 'manifest.json'),
  'utf8',
));
const symbols = manifest.map((entry, index) => [
  entry.id,
  `${entry.filename}.svg`,
  0xF700 + index,
]);
if (symbols.length === 0 || symbols.length > 0x1900) {
  throw new Error(`Unexpected electronic-symbols manifest size: ${symbols.length}`);
}

const NONE = new Set(['', 'none', 'transparent']);

function localName(node) {
  return (node.localName || node.nodeName || '').split(':').pop();
}

function attr(node, name, inherited) {
  if (node.hasAttribute && node.hasAttribute(name)) return node.getAttribute(name);
  return inherited[name];
}

function num(value, fallback = 0) {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

function circlePath(node) {
  const cx = num(node.getAttribute('cx'));
  const cy = num(node.getAttribute('cy'));
  const r = num(node.getAttribute('r'));
  return `M ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} Z`;
}

function rectPath(node) {
  const x = num(node.getAttribute('x'));
  const y = num(node.getAttribute('y'));
  const w = num(node.getAttribute('width'));
  const h = num(node.getAttribute('height'));
  return `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
}

function linePath(node) {
  return `M ${num(node.getAttribute('x1'))} ${num(node.getAttribute('y1'))} L ${num(node.getAttribute('x2'))} ${num(node.getAttribute('y2'))}`;
}

function normalizedCommands(d, includeCurves = false) {
  let path = new SVGPathData(d).transform(SVGPathDataTransformer.TO_ABS());
  if (includeCurves) {
    path = path
      .transform(SVGPathDataTransformer.NORMALIZE_HVZ())
      .transform(SVGPathDataTransformer.NORMALIZE_ST())
      .transform(SVGPathDataTransformer.A_TO_C());
  }
  return path.commands;
}

function splitSubpaths(commands) {
  const result = [];
  let current = [];
  for (const command of commands) {
    if (command.type === SVGPathData.MOVE_TO && current.length) {
      if (current.length > 1) result.push(current);
      current = [];
    }
    current.push(command);
  }
  if (current.length > 1) result.push(current);
  return result;
}

function encodeCommands(commands) {
  const path = new SVGPathData();
  path.commands = commands;
  return path.encode();
}

function outlinedSubpath(d, width, closed) {
  let result = outline(d, width / 2, { inside: true, outside: true, joints: 0 });
  if (!result) return '';
  const parts = splitSubpaths(normalizedCommands(result, true));
  if (!closed || parts.length < 2) return parts.map(encodeCommands).join(' ');
  // svg-path-outline emits the outside and inside contours with the same
  // winding.  Reverse the inner contour(s) so a font renderer preserves the
  // hole (rings, transistor circles and crystal bodies stay hollow).
  return parts
    .map((part, index) => (index === 0 ? encodeCommands(part) : encodeCommands(SVGPathDataTransformer.REVERSE_PATH(part))))
    .join(' ');
}

function outlinedPath(d, width) {
  const subpaths = splitSubpaths(normalizedCommands(d));
  return subpaths
    .map((part) => {
      const closed = part.some((command) => command.type === SVGPathData.CLOSE_PATH);
      return outlinedSubpath(encodeCommands(part), width, closed);
    })
    .filter(Boolean)
    .join(' ');
}

function collect(node, inherited, paths) {
  const state = {
    fill: attr(node, 'fill', inherited) || 'black',
    stroke: attr(node, 'stroke', inherited) || 'none',
    'stroke-width': attr(node, 'stroke-width', inherited) || '1',
    'stroke-dasharray': attr(node, 'stroke-dasharray', inherited) || 'none',
  };
  const tag = localName(node);
  let d = null;
  if (tag === 'path') d = node.getAttribute('d');
  if (tag === 'circle') d = circlePath(node);
  if (tag === 'rect') d = rectPath(node);
  if (tag === 'line') d = linePath(node);
  if (d) {
    // Normalize implicit line commands (e.g. "M 1 2 3 4") before passing
    // the path to svg-path-outline; its parser expects explicit commands.
    if (!NONE.has(state.fill) && state.fill !== 'none') paths.push(d);
    if (!NONE.has(state.stroke) && state.stroke !== 'none') {
      const width = num(state['stroke-width'], 1);
      try {
        // A dashed path is kept continuous in this first preview.  This only
        // affects the relay's guide line and avoids converting dash segments
        // into many tiny glyph contours.
        paths.push(outlinedPath(d, width));
      } catch (error) {
        throw new Error(`Cannot outline ${tag} path ${d}: ${error.message}`);
      }
    }
  }
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.nodeType === 1) collect(child, state, paths);
  }
}

function makeOutlineSvg(file) {
  const xml = fs.readFileSync(file, 'utf8');
  const doc = new DOMParser().parseFromString(xml, 'image/svg+xml');
  const rootNode = doc.documentElement;
  const viewBox = rootNode.getAttribute('viewBox') || '0 0 100 100';
  const parts = viewBox.trim().split(/\s+/).map(Number);
  const width = parts[2] || 100;
  const height = parts[3] || 100;
  const paths = [];
  collect(rootNode, {}, paths);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${width}" height="${height}"><g fill="#000">${paths.map((d) => `<path d="${d}"/>`).join('')}</g></svg>`;
}

function makeFont() {
  return new Promise((resolve, reject) => {
    const destination = path.join(out, 'electronic-symbols-stroke-outline.svg');
    const stream = new SVGIcons2SVGFontStream({
      fontName: 'electronic-symbols',
      fontId: 'electronic-symbols',
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
    const output = fs.createWriteStream(destination);
    stream.on('error', reject);
    output.on('error', reject);
    output.on('finish', () => resolve(destination));
    stream.pipe(output);
    for (const [name, , codepoint] of symbols) {
      const file = path.join(outlineDir, `${name}.svg`);
      const glyph = fs.createReadStream(file);
      glyph.metadata = { unicode: [String.fromCodePoint(codepoint)], name };
      glyph.on('error', reject);
      stream.write(glyph);
    }
    stream.end();
  });
}

async function main() {
  for (const [name, filename] of symbols) {
    fs.writeFileSync(path.join(outlineDir, `${name}.svg`), makeOutlineSvg(path.join(source, filename)));
  }
  const svgFont = await makeFont();
  const result = svg2ttf(fs.readFileSync(svgFont, 'utf8'), {
    copyright: 'Source symbols: chris-pikul/electronic-symbols; generated icon font',
    description: 'Electronic symbols icon font',
    version: '1.0',
  });
  fs.writeFileSync(path.join(out, 'electronic-symbols-stroke-outline.ttf'), Buffer.from(result.buffer));
  console.log(svgFont);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
