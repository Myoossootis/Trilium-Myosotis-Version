const assert = require('node:assert/strict');
const fs = require('node:fs');
const formatter = new Function(fs.readFileSync('customizations/frontend/dsh-chat-format.bundle.js', 'utf8'))();
const fixture = String.raw`## 为什么选 B

**负温度系数（CTAT）**：由 $V_{BE}$ 提供。

$$
V_{BE}=\frac{kT}{q}\ln\frac{I_C}{I_S}
$$

$I_S$ 随温度升高而强烈增大，因此 $V_{BE}$ 近似以 $-2\,\text{mV}/^\circ\text{C}$ 线性下降。

**正温度系数（PTAT）**：由 $\Delta V_{BE}$ 提供。

\[
\Delta V_{BE}=V_{BE1}-V_{BE2}=\frac{kT}{q}\ln N
\]

\(V_{REF}=V_{BE}+M\cdot\Delta V_{BE}\approx1.2\,\text{V}\)

- 行内公式
- 行间公式

| 类型 | 表达式 |
| --- | --- |
| PTAT | $\Delta V_{BE}$ |
`;
const html = formatter.render(fixture);
assert.equal((html.match(/<math /g) || []).length, 9);
assert.equal((html.match(/ds-math-display/g) || []).length, 2);
assert(html.includes('<h2>为什么选 B</h2>') && html.includes('<strong>') && html.includes('<table>'));
assert(!html.includes('ds-math-error'));
assert(formatter.render('`$x$`\n\n```tex\n$$x$$\n```').includes('<code>$x$</code>'));
assert(!formatter.render('`$x$`\n\n```tex\n$$x$$\n```').includes('<math'));
assert(!formatter.render(String.raw`价格 \$5 和 \$6`).includes('<math'));
for (let end = 0; end <= fixture.length; end++) assert.equal(typeof formatter.render(fixture.slice(0, end)), 'string');
const attack = formatter.render(String.raw`<img src=x onerror=alert(1)><script>alert(1)</script>

[bad](javascript:alert(1)) ![remote](https://example.invalid/tracker.png)

$\href{javascript:alert(1)}{bad}$`);
assert(!/<script\b|<img\b|href="javascript:/i.test(attack));
assert(!formatter.render('![remote](https://example.invalid/tracker.png)').includes('<img'));
assert(formatter.render('[official](https://example.com)').includes('rel="noopener noreferrer"'));
assert(formatter.render(String.raw`$\def\x{\x}\x$`).includes('ds-math-error'));
console.log('PASS reported CTAT/PTAT formulas, Markdown, code literals, incremental prefixes and HTML/URL/macro containment');
