// CommonMark + KaTeX, using native MathML so Shadow DOM needs no remote fonts.
function createDshFormatter(MarkdownIt, katex) {
    const markdown = new MarkdownIt({ html: false, breaks: true, linkify: true });
    const escape = markdown.utils.escapeHtml;
    const delimiters = [['$$', '$$', true], ['\\[', '\\]', true], ['\\(', '\\)', false], ['$', '$', false]];
    function closing(source, marker, start) {
        let at = source.indexOf(marker, start);
        while (at !== -1) {
            let slash = at - 1; while (slash >= 0 && source[slash] === '\\') slash--;
            if ((at - 1 - slash) % 2 === 0) return at;
            at = source.indexOf(marker, at + marker.length);
        }
        return -1;
    }
    markdown.inline.ruler.before('escape', 'dsh_math', (state, silent) => {
        const pair = delimiters.find(([open]) => state.src.startsWith(open, state.pos));
        if (!pair) return false;
        const [open, close, display] = pair, start = state.pos + open.length, end = closing(state.src, close, start);
        if (end < start || end + close.length > state.posMax) return false;
        const content = state.src.slice(start, end);
        if (open === '$' && (!content || /\n/.test(content) || /^\s|\s$/.test(content) || /\d/.test(state.src[end + 1] || ''))) return false;
        if (!silent) { const token = state.push('dsh_math', '', 0); token.content = content; token.meta = { display, open, close }; }
        state.pos = end + close.length; return true;
    });
    markdown.block.ruler.before('fence', 'dsh_math_block', (state, startLine, endLine, silent) => {
        const at = state.bMarks[startLine] + state.tShift[startLine];
        const pair = delimiters.slice(0, 2).find(([open]) => state.src.startsWith(open, at));
        if (!pair || state.sCount[startLine] - state.blkIndent >= 4) return false;
        const [open, close] = pair, start = at + open.length, end = closing(state.src, close, start);
        if (end < 0) return false;
        let line = startLine;
        while (line + 1 < endLine && state.bMarks[line + 1] <= end) line++;
        if (end > state.eMarks[line] || state.src.slice(end + close.length, state.eMarks[line]).trim()) return false;
        if (silent) return true;
        const token = state.push('dsh_math_block', '', 0); token.block = true; token.content = state.src.slice(start, end); token.meta = { display: true, open, close }; token.map = [startLine, line + 1];
        state.line = line + 1; return true;
    }, { alt: ['paragraph', 'reference', 'blockquote', 'list'] });
    function math(tokens, index) {
        const token = tokens[index], { display, open, close } = token.meta;
        try {
            const output = katex.renderToString(token.content.trim(), { displayMode: display, output: 'mathml', trust: false, throwOnError: true, strict: 'ignore', maxExpand: 1000, maxSize: 20, macros: {} });
            return `<span class="ds-math${display ? ' ds-math-display' : ''}">${output}</span>` + (token.block ? '\n' : '');
        } catch {
            return `<code class="ds-math-error" title="公式尚不完整或不支持">${escape(open + token.content + close)}</code>`;
        }
    }
    markdown.renderer.rules.dsh_math = math;
    markdown.renderer.rules.dsh_math_block = math;
    // Raw HTML is disabled. Markdown images stay text; actual chat images use
    // the existing authenticated DSH attachment path rather than remote URLs.
    markdown.renderer.rules.image = (tokens, index) => escape(tokens[index].content || '图片');
    markdown.validateLink = url => /^(https?:|mailto:)/i.test(url);
    const linkOpen = markdown.renderer.rules.link_open || ((tokens, index, options, env, self) => self.renderToken(tokens, index, options));
    markdown.renderer.rules.link_open = (tokens, index, options, env, self) => { tokens[index].attrSet('target', '_blank'); tokens[index].attrSet('rel', 'noopener noreferrer'); return linkOpen(tokens, index, options, env, self); };
    return { render: text => markdown.render(String(text || '')) };
}
