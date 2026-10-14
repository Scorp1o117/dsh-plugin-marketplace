import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../client.js', import.meta.url), 'utf8');
const rows = ['owner/first', 'owner/second'].map(fullName => ({ fullName }));
const tick = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function fixture() {
  let bundle, render, disposed = false, listeners = new Set(), calls = [];
  let value = { aiExplainResult: { repo: rows[0].fullName, status: 'ok', text: 'previous success' } };
  let mode = 'accept';
  const scope = {
    getSnapshot: () => ({ status: 'ready', writable: true, value }),
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    dispose() { disposed = true; },
    mutate(ops) {
      calls.push(ops[0]);
      if (mode === 'hang') return new Promise(() => {});
      if (!disposed && mode === 'accept') {
        value = { ...value, [ops[0].path[0]]: ops[0].value };
        listeners.forEach(fn => fn());
      }
      return Promise.resolve(!disposed && mode === 'accept');
    },
  };
  const timers = new Set();
  vm.runInNewContext(source, {
    window: { __ModuleLoader__: { load(b) { bundle = b; } } },
    setTimeout(fn, ms) { const timer = { fn, ms }; timers.add(timer); return timer; },
    clearTimeout(timer) { timers.delete(timer); },
    // Browsing is independent of settings writes; keep seeded cards in place.
    fetch: () => new Promise(() => {}),
    URLSearchParams, console,
  });
  let slots = [], effects = [], index = 0, pendingEffects = [];
  const react = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useState(initial) {
      const key = index++;
      if (!(key in slots)) slots[key] = initial?.items ? { ...initial, items: rows, open: rows[1] } : initial;
      return [slots[key], update => { slots[key] = typeof update === 'function' ? update(slots[key]) : update; }];
    },
    useCallback: fn => fn,
    useEffect(fn, deps) {
      const key = index++;
      if (!effects[key] || deps.some((d, i) => !Object.is(d, effects[key].deps[i]))) {
        pendingEffects.push(() => { effects[key]?.cleanup?.(); effects[key] = { deps, cleanup: fn() }; });
      }
    },
  };
  const plugin = bundle.factory(() => react);
  plugin.apply({ locale: { bind: () => key => key, register: () => () => {} }, effect: fn => fn(),
    configForms: { get: () => scope }, connection: {},
    slots: { inject: (_name, fn) => fn(), register: (_spec, fn) => { render = fn; } },
  });
  const page = render({});
  function draw() {
    index = 0; pendingEffects = [];
    const tree = page.type(page.props);
    pendingEffects.forEach(fn => fn());
    return tree;
  }
  function find(tree, name) {
    if (!tree || typeof tree !== 'object') return;
    if (tree.type?.name === name) return tree;
    for (const child of (Array.isArray(tree) ? tree : tree.children || [])) {
      const hit = find(child, name); if (hit) return hit;
    }
  }
  draw();
  return {
    scope, calls, timers, draw, find,
    detail: () => find(draw(), 'DetailPanel'),
    get state() { return slots[2]; },
    get disposed() { return disposed; },
    get listeners() { return listeners.size; },
    mode: next => { mode = next; },
    open(row) { slots[2] = { ...slots[2], items: rows, open: row }; },
    acknowledge() { value = { ...value, aiExplain: {}, install: {} }; listeners.forEach(fn => fn()); },
    unmount() { effects.forEach(effect => effect?.cleanup?.()); slots = []; effects = []; },
  };
}

test('navigation releases subscriptions and preserves the shared form for all writes', async () => {
  const ui = fixture();
  for (let navigation = 0; navigation < 3; navigation++) {
    assert.equal(ui.listeners, 1);
    ui.unmount();
    assert.equal(ui.listeners, 0);
    assert.equal(ui.disposed, false);
    ui.draw();
    for (const action of ['install', 'update', 'remove', 'refresh']) {
      ui.detail().props.onInstall('example', action); await tick();
      assert.equal(ui.state.installError, null);
      assert.equal(ui.calls.at(-1).value.action, action);
    }
    ui.detail().props.onExplain(rows[1].fullName, '', ''); await tick();
    assert.equal(ui.state.explainErrors[rows[1].fullName], null);
  }
});

test('refused writes display an error on the clicked repository, without needing a result', async () => {
  const ui = fixture(); ui.mode('refuse');
  ui.detail().props.onExplain(rows[1].fullName, '', ''); await tick();
  let detail = ui.detail();
  assert.equal(detail.props.explainError, 'settings-not-applied');
  // Execute the real panel: its result still belongs to the previously successful card.
  const panel = detail.type(detail.props);
  assert.match(JSON.stringify(panel), /settings-not-applied/);
  ui.open(rows[0]); detail = ui.detail();
  assert.equal(detail.props.explainError, '');
  assert.equal(detail.props.explainState.text, 'previous success');
});

test('a write that never settles shows immediate progress and times out on the clicked card', () => {
  const ui = fixture(); ui.mode('hang');
  ui.detail().props.onExplain(rows[1].fullName, '', '');
  assert.equal(ui.detail().props.explainState.status, 'running');
  assert.equal(ui.timers.size, 1);
  [...ui.timers][0].fn();
  assert.equal(ui.detail().props.explainError, 'hostTimeout');
  assert.equal(ui.detail().props.explainState.status, 'error');
  ui.detail().props.onInstall('example', 'update'); ui.draw();
  assert.equal(ui.timers.size, 1);
  [...ui.timers][0].fn(); ui.draw();
  assert.equal(ui.state.installError.key, 'hostTimeout');
  ui.unmount(); assert.equal(ui.timers.size, 0);
});

test('acknowledgement and navigation cancel pending timers', async () => {
  const ui = fixture();
  ui.detail().props.onExplain(rows[1].fullName, '', ''); await tick(); ui.draw();
  assert.equal(ui.timers.size, 1);
  ui.acknowledge(); ui.draw();
  assert.equal(ui.timers.size, 0);
  ui.detail().props.onInstall('example'); await tick(); ui.draw();
  assert.equal(ui.timers.size, 1);
  ui.unmount(); assert.equal(ui.timers.size, 0);
});
