const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const callbacks = [];
const events = {};
const docEvents = {};
let stored = JSON.stringify({ note1: { y: 450, time: 1, text: '', offset: 0 } });
const scroller = {
    scrollTop: 0, scrollHeight: 2000, clientHeight: 500, isConnected: true,
    style: {}, getClientRects: () => [1], getBoundingClientRect: () => ({ top: 0 }),
    addEventListener: (name, fn) => { events[name] = fn; }, removeEventListener() {}
};
let mode = null;
let content = { isConnected: true, getAttribute: () => mode, closest: () => scroller, querySelectorAll: () => [] };
let mutationCallback;
const context = { ntxId: 'tab1', note: { noteId: 'note1', type: 'text' } };
const root = { dataset: { ntxId: 'tab1' }, querySelector: () => content };
const sandbox = {
    window: { addEventListener() {} }, console,
    document: { body: {}, hidden: false, querySelectorAll: () => [root],
        addEventListener: (name, fn) => { docEvents[name] = fn; } },
    api: { getNoteContexts: () => [context] },
    localStorage: { getItem: () => stored, setItem: (_, value) => { stored = value; } },
    MutationObserver: class { constructor(fn) { mutationCallback = fn; } observe() {} }, ResizeObserver: class { observe() {} disconnect() {} },
    setTimeout: (fn, delay) => { const timer = { fn, delay }; callbacks.push(timer); return timer; },
    clearTimeout: timer => { if (timer) timer.cancelled = true; }
};
vm.runInNewContext(fs.readFileSync('customizations/frontend/reading-position.js', 'utf8'), sandbox);
callbacks.find(timer => timer.delay === 0).fn();
assert.equal(scroller.scrollTop, 450, 'saved position restored');
events.wheel();
scroller.scrollTop = 700;
docEvents.scroll({ target: scroller });
events.scroll();
callbacks.filter(timer => timer.delay === 250 && !timer.cancelled).at(-1).fn();
assert.equal(JSON.parse(stored).note1.y, 700, 'manual scroll saved');
// Read-only -> editor replaces the DOM while reusing its scroll container.
content.isConnected = false;
content = { isConnected: true, getAttribute: () => 'true', closest: () => scroller, querySelectorAll: () => [] };
scroller.scrollTop = 0;
docEvents.scroll({ target: scroller });
events.scroll();
callbacks.filter(timer => timer.delay === 250 && !timer.cancelled).at(-1).fn();
assert.equal(JSON.parse(stored).note1.y, 700, 'mode-switch reset cannot overwrite position');
mutationCallback();
callbacks.filter(timer => timer.delay === 100 && !timer.cancelled).at(-1).fn();
callbacks.filter(timer => timer.delay === 0 && !timer.cancelled).at(-1).fn();
assert.equal(scroller.scrollTop, 700, 'replacement editor restores read-only position');
events.wheel();
// Editor -> read-only can also change contenteditable on the same element.
content.getAttribute = () => null;
scroller.scrollTop = 0;
docEvents.scroll({ target: scroller });
mutationCallback();
callbacks.filter(timer => timer.delay === 100 && !timer.cancelled).at(-1).fn();
callbacks.filter(timer => timer.delay === 0 && !timer.cancelled).at(-1).fn();
assert.equal(scroller.scrollTop, 700, 'in-place mode switch restores position');
events.wheel();
context.note.noteId = 'note2';
scroller.scrollTop = 0;
docEvents.scroll({ target: scroller });
assert.equal(JSON.parse(stored).note1.y, 700, 'navigation reset does not overwrite old note');
for (const timer of callbacks.filter(timer => timer.delay === 500 && !timer.cancelled)) timer.fn();
assert.equal(scroller.scrollTop, 0, 'user input cancels late restore');
console.log('PASS: restore, manual scroll, both mode-switch paths, navigation guard, restore cancellation');
