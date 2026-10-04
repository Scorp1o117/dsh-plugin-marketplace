import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
const manifest=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
const source=await readFile(new URL('../client.js',import.meta.url),'utf8');
test('the installed plugin opens its own configuration from the Plugins page',()=>{
  let bundle;vm.runInNewContext(source,{window:{__ModuleLoader__:{load(value){bundle=value}}},setInterval(){},clearInterval(){},setTimeout(){},clearTimeout(){},console});
  const bindings=[],entries=[];const scope={getSnapshot:()=>({status:'ready',writable:true,value:{}}),subscribe:()=>()=>{}};
  const plugin=bundle.factory(name=>{assert.equal(name,'react');return {createElement:(type,props,...children)=>({type,props,children})}});
  plugin.apply({locale:{bind:()=>key=>key,register:()=>()=>{}},effect:fn=>fn(),configForms:{get:ns=>{bindings.push(ns);return scope}},connection:{},slots:{inject:(_name,fn)=>fn(),register:(options,render)=>{entries.push({options,render});return ()=>{}}}});
  const page=entries.find(entry=>entry.options.name==='plugins.bundle.config');
  assert.ok(page,'community configuration must use the bundle configuration slot');
  assert.equal(page.options.key,manifest.name,'the key must match the installed npm bundle');
  assert.equal(entries.some(entry=>entry.options.name==='settings.section'),false,'configuration must not remain in global settings');
  assert.equal(bindings.length,1,'one shared form owns the namespace revision');
  const node=page.render({view:'page',t:key=>key});assert.equal(typeof node.type,'function');assert.equal(node.props.scope,scope);
  if(manifest.name==='dsh-soul-md')assert.ok(entries.some(entry=>entry.options.id==='soul-md-persona'),'retain the conversation persona switcher');
  assert.ok(manifest.files.includes('client.js'));assert.equal(manifest.dsh.client.platform,'web');
});

test('pending install and explanation requests show progress and a missing acknowledgement times out', () => {
  let bundle;
  const timers = [];
  const cleared = [];
  vm.runInNewContext(source, {
    window: { __ModuleLoader__: { load(value) { bundle = value; } } },
    setTimeout(callback, ms) { const timer = { callback, ms }; timers.push(timer); return timer; },
    clearTimeout(timer) { cleared.push(timer); }, console,
  });
  const pluginRow = { fullName: 'owner/example' };
  let state = { items: [pluginRow], open: pluginRow };
  const snapshot = { status: 'ready', value: {
    install: { pkg: 'example', ts: 1 }, aiExplain: { repo: 'owner/example', ts: 2 },
  } };
  const effects = [];
  let hook = 0;
  const react = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useState: () => hook++ === 0 ? [0, () => {}] : hook === 2 ? [state, (update) => { state = update(state); }] : [snapshot, () => {}],
    useEffect: (callback) => effects.push(callback), useCallback: (callback) => callback,
  };
  const plugin = bundle.factory(() => react);
  let render;
  plugin.apply({ locale: { bind: () => key => key, register: () => () => {} }, effect: fn => fn(),
    configForms: { get: () => ({ getSnapshot: () => snapshot }) }, connection: {},
    slots: { inject: (_name, fn) => fn(), register: (_options, callback) => { render = callback; } },
  });
  const page = render({ t: key => key });
  const tree = page.type(page.props);
  const nodes = [];
  const visit = (node) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== 'object') return;
    nodes.push(node); (node.children || []).forEach(visit);
  };
  visit(tree);
  const detail = nodes.find(node => node.type?.name === 'DetailPanel');
  assert.equal(detail.props.installState.status, 'running');
  assert.equal(detail.props.installState.pkg, 'example');
  assert.equal(detail.props.explainState.status, 'running');
  assert.equal(detail.props.explainState.repo, 'owner/example');
  // Only run the two acknowledgement effects; no external fetches are needed.
  const disposeInstall = effects[2]();
  const disposeExplain = effects[3]();
  assert.deepEqual(timers.map(timer => timer.ms), [15000, 15000]);
  timers.forEach(timer => timer.callback());
  assert.equal(state.installError.key, 'hostTimeout');
  assert.equal(state.explainError.key, 'hostTimeout');
  disposeInstall(); disposeExplain();
  assert.equal(cleared.length, 2);
});
