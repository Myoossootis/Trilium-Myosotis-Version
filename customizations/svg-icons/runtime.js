// Shared native SVG icon-pack support. Only monochrome geometric SVG is accepted.
function myoSafeSvg(input) {
    if (typeof input !== 'string' || input.length > 64000) throw Error('Invalid SVG size');
    const source = input.replace(/<!--[^]*?-->/g, '').trim();
    const tags = new Set(['svg','g','path','circle','rect','line','polyline','polygon','ellipse']);
    const geometry = new Set(['viewBox','d','cx','cy','r','x','y','x1','x2','y1','y2','width','height','rx','ry','points','stroke-width','stroke-miterlimit','stroke-dasharray','stroke-dashoffset','opacity','fill-opacity','stroke-opacity']);
    const enumerated = {'stroke-linecap':['butt','round','square'],'stroke-linejoin':['miter','round','bevel'],'fill-rule':['nonzero','evenodd']};
    let offset = 0, output = '', roots = 0;
    const stack = [];
    for (const match of source.matchAll(/<([^<>]+)>/g)) {
        if (source.slice(offset, match.index).trim()) throw Error('SVG text is unsupported');
        offset = match.index + match[0].length;
        const parsed = /^(\/)?([A-Za-z]+)([^]*?)(\/)?$/.exec(match[1]);
        if (!parsed || !tags.has(parsed[2])) throw Error('Unsafe SVG element');
        const [,close,tag,raw,self] = parsed;
        if (close) { if (raw.trim() || self || stack.pop() !== tag) throw Error('Invalid SVG nesting'); output += `</${tag}>`; continue; }
        if (!stack.length) { if (tag !== 'svg' || roots++) throw Error('SVG root required'); }
        else if (tag === 'svg') throw Error('Nested SVG is unsupported');
        let consumed = 0, attrs = '', seen = new Set();
        for (const attr of raw.matchAll(/([A-Za-z][A-Za-z0-9:-]*)\s*=\s*(["'])([^]*?)\2/g)) {
            if (raw.slice(consumed,attr.index).trim()) throw Error('Invalid SVG attributes');
            consumed = attr.index + attr[0].length;
            const name = attr[1], value = attr[3];
            if (seen.has(name)) throw Error('Duplicate SVG attribute'); seen.add(name);
            if (name === 'xmlns') { if (value !== 'http://www.w3.org/2000/svg') throw Error('Invalid SVG namespace'); continue; }
            if (name === 'data-name') continue;
            if (geometry.has(name)) {
                if (!/^[0-9A-Za-z.,+\-\s]+$/.test(value)) throw Error('Invalid SVG geometry');
            } else if (name === 'fill' || name === 'stroke') {
                if (!/^(none|currentColor|black|white|#[0-9a-fA-F]{3,8})$/.test(value)) throw Error('Unsupported SVG paint');
            } else if (enumerated[name]) { if (!enumerated[name].includes(value)) throw Error('Invalid SVG enum'); }
            else throw Error('Unsafe SVG attribute: ' + name);
            attrs += ` ${name}="${value}"`;
        }
        if (raw.slice(consumed).trim()) throw Error('Invalid SVG attributes');
        output += `<${tag}${tag==='svg'?' xmlns="http://www.w3.org/2000/svg"':''}${attrs}${self?'/':''}>`;
        if (!self) stack.push(tag);
    }
    if (stack.length || roots !== 1 || source.slice(offset).trim()) throw Error('Invalid SVG document');
    return output;
}
function myoSvgCss(manifest, prefix) {
    if (!/^[a-zA-Z0-9_-]+$/.test(prefix) || !manifest.icons || Array.isArray(manifest.icons) || Object.keys(manifest.icons).length>5000)
        throw Error('Invalid SVG icon pack');
    let css = `.${prefix}{display:inline-block;position:relative;width:1em;height:1em;line-height:1;vertical-align:-.1em;text-indent:-9999px;overflow:hidden;flex-shrink:0}
.${prefix}::before{content:""!important;display:block;position:absolute;inset:0;width:1em;height:1em;margin:auto;flex-shrink:0;background-color:currentColor;text-indent:0;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain}`;
    for (const [id, icon] of Object.entries(manifest.icons)) {
        if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw Error('Invalid SVG icon ID');
        const url = 'data:image/svg+xml,' + encodeURIComponent(myoSafeSvg(icon.svg)).replace(/'/g,'%27');
        css += `\n.${prefix}.${id}::before{-webkit-mask-image:url("${url}");mask-image:url("${url}")}`;
    }
    return css;
}
