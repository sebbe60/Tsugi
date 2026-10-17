const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');

const base = 'chrome-extension://tsugi/window.html';
const source = { id: 7, windowId: 1, url: 'https://example.com/watch' };

function load(filename, globals = {}, imports = {}) {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, require: name => imports[name], ...globals });
  return exports;
}

function scenario({ contexts = [], contextUrl, queryTabs = [], legacy = false } = {}) {
  const calls = [];
  const chrome = {
    runtime: {
      getURL: () => base,
      ...(!legacy ? { getContexts: async () => contexts } : {}),
    },
    tabs: {
      query: async filter => filter.active ? [source] : queryTabs,
      sendMessage: async (id, message) => {
        calls.push({ kind: 'context', id, force: message.force });
        if (!contextUrl) throw Error('No content-script receiver');
        return { url: contextUrl };
      },
      create: async options => { calls.push({ kind: 'create', ...options }); return { id: 20, ...options }; },
      update: async (id, options) => { calls.push({ kind: 'update', id, ...options }); return { id, ...options }; },
    },
  };
  const slugs = load(path.join(__dirname, '../src/utils/slugs.ts'));
  const { openTsugiTab } = load(path.join(__dirname, '../src/background/desktopTab.ts'), { chrome }, { '../utils/slugs': slugs });
  return { openTsugiTab, calls };
}

function context(windowId = 1, tabId = 12, url = `${base}#/settings`) {
  return { frameId: 0, windowId, tabId, documentUrl: url };
}

test('opens a normal active tab at the library without a supported page', async () => {
  const s = scenario();
  await s.openTsugiTab(source);
  const created = s.calls.find(c => c.kind === 'create');
  assert.equal(created.url, `${base}#/library/watching`);
  assert.equal(created.active, true);
  assert.equal(created.windowId, 1);
});

test('direct provider pages open Watching instead of a title', async () => {
  const s = scenario();
  await s.openTsugiTab({ ...source, url: 'https://myanimelist.net/anime/1/Cowboy_Bebop' });
  assert.equal(s.calls.find(c => c.kind === 'create').url, `${base}#/library/watching`);
  assert.equal(s.calls.some(c => c.kind === 'context'), false);
});

test('does not request the source page title when opening Watching', async () => {
  const s = scenario({ contextUrl: 'https://anilist.co/manga/30013' });
  await s.openTsugiTab(source);
  assert.equal(s.calls.some(c => c.kind === 'context'), false);
  assert.equal(s.calls.find(c => c.kind === 'create').url, `${base}#/library/watching`);
});

test('floating-button titles do not override the Watching landing page', async () => {
  const s = scenario();
  await s.openTsugiTab({ ...source, url: 'https://myanimelist.net/anime/2' }, 'https://myanimelist.net/anime/1');
  assert.equal(s.calls.find(c => c.kind === 'create').url, `${base}#/library/watching`);
});

test('reuses extension runtime contexts without broad tabs permission or stored IDs', async () => {
  const s = scenario({ contexts: [context()] });
  await s.openTsugiTab(source);
  const updated = s.calls.find(c => c.kind === 'update');
  assert.equal(updated.id, 12);
  assert.equal(updated.url, `${base}#/library/watching`);
  assert.equal(s.calls.some(c => c.kind === 'create'), false);
});

test('existing tab returns to Watching even when called with a title', async () => {
  const s = scenario({ contexts: [context()] });
  await s.openTsugiTab(source, 'https://myanimelist.net/manga/2');
  assert.equal(s.calls.find(c => c.kind === 'update').url, `${base}#/library/watching`);
});

test('does not reuse settings, embedded frames or tabs in other browser windows', async () => {
  const s = scenario({ contexts: [context(2), context(1, 13, base.replace('window.html','settings.html')), { ...context(), frameId: 2 }] });
  await s.openTsugiTab(source);
  assert.equal(s.calls.some(c => c.kind === 'update'), false);
  assert.equal(s.calls.some(c => c.kind === 'create'), true);
});

test('supports browsers without runtime.getContexts', async () => {
  const s = scenario({ legacy: true, queryTabs: [{ id: 15 }] });
  await s.openTsugiTab(source);
  assert.equal(s.calls.find(c => c.kind === 'update').id, 15);
});

test('discovers the active source tab when legacy popup callers supply none', async () => {
  const s = scenario({ contextUrl: 'https://myanimelist.net/anime/1' });
  await s.openTsugiTab();
  assert.equal(s.calls[0].kind, 'create');
  assert.equal(s.calls.find(c => c.kind === 'create').url, `${base}#/library/watching`);
});
