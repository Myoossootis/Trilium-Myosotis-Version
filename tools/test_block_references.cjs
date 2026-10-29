const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const noop = () => {};
const button = { style: {}, setAttribute: noop, addEventListener: noop };
const window = { addEventListener: noop };
const registeredEvents = [];
let appendedButtons = 0;
vm.runInNewContext(fs.readFileSync('customizations/frontend/block-references.js', 'utf8'), {
    window, console, URLSearchParams,
    document: { createElement: () => button, body: { append: () => { appendedButtons++; } }, querySelectorAll: () => [],
        addEventListener: name => registeredEvents.push(name) },
    MutationObserver: class { observe() {} }, location: { hash: '' }, setTimeout: noop, clearTimeout: noop
});
const { describe, makeLink, parseLink, locate } = window.__myosotisBlockReferences;
assert.equal(appendedButtons, 0, 'no floating copy button added to the page');
assert.equal(registeredEvents.includes('pointerover'), false, 'no paragraph hover listener');
const block = (tagName, textContent, id = '') => ({ tagName, textContent, id });
const a = block('H2', '7.3 Bootstrap 电容值', 'myo-ref-test');
const b = block('P', '电压变化 = 电荷 / 电容');
const c = block('P', '电压变化 = 电荷 / 电容');
let items = [a, b, c];
const content = { querySelectorAll: selector => selector.includes(',') ? items : items.filter(item => item.tagName.toLowerCase() === selector) };
const locator = describe(a, content);
assert.equal(parseLink(makeLink('abc123', locator)).locator.text, '7.3 Bootstrap 电容值');
a.textContent = '7.3 已改写的标题';
items.unshift(block('P', '新增的前文'));
assert.equal(locate(content, locator), a, 'persistent ID survives edit and insertion');
const repeated = describe(c, content);
assert.equal(repeated.ordinal, 1);
assert.equal(locate(content, repeated), c, 'duplicate text disambiguated by occurrence');
c.textContent = '已删除原句';
assert.equal(locate(content, repeated), undefined, 'missing reference is not redirected to a different paragraph');
assert.equal(parseLink('#root/abc123?myoref=bad-json'), null);
assert.equal(parseLink(makeLink('abc123', { ...locator, tag: 'script' })), null);
assert.equal(parseLink(makeLink('abc123', { ...locator, ordinal: -1 })), null);
assert.equal(parseLink('#root/abc123'), null, 'normal note links left alone');
console.log('PASS: locator roundtrip, persistent ID, duplicate text, missing targets, malformed links');
