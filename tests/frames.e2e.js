import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { cp, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, relative } from 'node:path';

test('real Chrome: closed shadow DOM and exact-document iframe routing', { timeout: 90000 }, async t => {
  const temp = await mkdtemp(join(tmpdir(), 'loopy-frame-test-'));
  const extension = join(temp, 'extension'); let context; let desiredFrame; let modelCalls = 0; const bodies = [];
  const child = createServer((req, res) => { res.setHeader('content-type', 'text/html'); res.end('<title>child</title><p>cross-origin-only</p><input aria-label="child query"><button>child button</button>'); });
  await new Promise(resolve => child.listen(0, '127.0.0.1', resolve));
  const childUrl = `http://127.0.0.1:${child.address().port}/child`;
  const server = createServer(async (req, res) => {
    if (req.url === '/chat/completions') {
      let body = ''; for await (const chunk of req) body += chunk;
      bodies.push(body); modelCalls++; const input = JSON.parse(body);
      const observations = input.messages.filter(message => message.role === 'user').map(message => { try { return JSON.parse(message.content).observation; } catch { return null; } }).filter(Boolean);
      const observation = observations.at(-1);
      const executed = input.messages.some(message => message.role === 'assistant' && message.content.includes('"tool":"fill"'));
      const action = observation.frameId === 0 ? { tool: 'switch_frame', args: { frameId: desiredFrame } }
        : !executed ? { tool: 'fill', args: { snapshotId: observation.snapshotId, elementId: observation.elements.find(item => item.label === 'child query').id, value: 'confirmed-child' } }
          : { tool: 'finish', args: { summary: 'local test complete' } };
      res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(action) } }] })); return;
    }
    res.setHeader('content-type', 'text/html');
    if (req.url === '/same') { res.end('<p>same-origin-only</p><input aria-label="same query">'); return; }
    res.end(`<title>frame fixture</title><div id="closed"><span slot="action">distributed-action</span></div><div id="hidden" hidden></div>
      <iframe src="${childUrl}" height="180"></iframe>
      <iframe srcdoc="<p>srcdoc-only</p><input aria-label='srcdoc query'>" height="180"></iframe>
      <iframe src="${childUrl}?hidden" style="display:none"></iframe>
      <iframe src="/same" height="80"></iframe><iframe id="blank" height="80"></iframe>
      <script>
      const root=document.querySelector('#closed').attachShadow({mode:'closed'});window.fixtureRoot=root;
      root.innerHTML='<p>closed-visible</p><input aria-label="shadow query"><input type="password" value="private-value"><button><slot name="action">slot-action</slot></button><select aria-label="shadow kind"><option value="one">one</option><option value="two">two</option></select><div id="nested"></div>';
      window.shadowClicks=0;root.querySelector('button').onclick=()=>window.shadowClicks++;
      root.querySelector('#nested').attachShadow({mode:'open'}).innerHTML='<p>nested-visible</p>';
      document.querySelector('#hidden').attachShadow({mode:'closed'}).innerHTML='<p>hidden-private</p><input aria-label="hidden query">';
      document.querySelector('#blank').contentDocument.body.innerHTML='<p>blank-inherited-only</p><input aria-label="blank query">';
      </script>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    // Test-only pregrant exercises real APIs; native optional-permission UI is not asserted.
    const source = resolve('.');
    await cp(source, extension, { recursive: true, filter: item => !relative(source, item).split('/').some(part => ['.git', 'node_modules', 'artifacts', 'docs', 'tests'].includes(part)) });
    const manifestFile = join(extension, 'manifest.json'); const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
    manifest.permissions.push('webNavigation'); manifest.optional_permissions = manifest.optional_permissions.filter(value => value !== 'webNavigation');
    await writeFile(manifestFile, JSON.stringify(manifest));
    context = await chromium.launchPersistentContext(join(temp, 'profile'), { channel: 'chromium', headless: true,
      args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`], viewport: { width: 1100, height: 900 } });
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const page = await context.newPage(); await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(() => frames.length === 5 && document.querySelector('#closed').getBoundingClientRect().height > 0);
    const harness = await context.newPage(); await harness.goto(`chrome-extension://${new URL(worker.url()).host}/assistant.html`);
    await harness.evaluate(async () => {
      const { createBrowserTools } = await import('./assistant/browser.js');
      globalThis.frameTestBrowser = createBrowserTools(chrome);
      const [tab] = (await chrome.tabs.query({})).filter(tab => tab.title === 'frame fixture');
      globalThis.frameTestTab = tab.id;
      globalThis.frameTestScope = await frameTestBrowser.prepareScope(tab.id, [tab.id], [], false);
    });
    const run = (operation, payload = {}) => harness.evaluate(async ({ operation, payload }) => {
      const browser = globalThis.frameTestBrowser, tab = globalThis.frameTestTab, scope = globalThis.frameTestScope;
      try {
        if (operation === 'observe') return await browser.observe(tab, [], undefined, scope, payload.frameId || 0);
        if (operation === 'catalog') return await browser.frames.catalog(tab, scope);
        if (operation === 'prepare') return await browser.frames.prepare(tab, payload.ids, scope, payload.documents);
        if (operation === 'execute') return await browser.execute(tab, payload.action, undefined, payload.key, scope);
        if (operation === 'list') return await browser.frames.list(tab, scope, []);
      } catch (error) { return { error: error.code, message: error.message }; }
    }, { operation, payload });
    let root, catalog, cross, srcdoc, hidden;
    await t.test('closed/nested roots and slot labels are observed; hidden hosts and values are excluded', async () => {
      root = await run('observe'); assert(!root.error, root.message);
      assert(root.text.includes('closed-visible')); assert(root.text.includes('nested-visible'));
      assert(root.elements.some(item => item.label.includes('distributed-action')));
      assert(!JSON.stringify(root).includes('hidden-private')); assert(!JSON.stringify(root).includes('private-value'));
      assert(!root.text.includes('cross-origin-only'));
      const input = root.elements.find(item => item.label === 'shadow query'); assert(input);
      assert((await run('execute', { key: root.documentKey, action: { tool: 'fill', args: { snapshotId: root.snapshotId, elementId: input.id, value: 'isolated-write' } } })).ok);
      assert.equal(await page.evaluate(() => fixtureRoot.querySelector('input').value), 'isolated-write');
      root = await run('observe');
      await page.evaluate(() => fixtureRoot.querySelector('p').textContent = 'changed');
      assert.equal((await run('execute', { key: root.documentKey, action: { tool: 'fill', args: { snapshotId: root.snapshotId, elementId: root.elements.find(item => item.label === 'shadow query').id, value: 'forbidden' } } })).error, 'STALE_SNAPSHOT');
    });
    await t.test('closed-root click/select work and hidden hosts invalidate old references', async () => {
      let observation = await run('observe');
      const button = observation.elements.find(item => item.label.includes('distributed-action'));
      assert((await run('execute', { key: observation.documentKey, action: { tool: 'click', args: { snapshotId: observation.snapshotId, elementId: button.id } } })).ok);
      assert.equal(await page.evaluate(() => window.shadowClicks), 1);
      observation = await run('observe');
      const select = observation.elements.find(item => item.tag === 'select');
      assert((await run('execute', { key: observation.documentKey, action: { tool: 'select', args: { snapshotId: observation.snapshotId, elementId: select.id, value: 'two' } } })).ok);
      assert.equal(await page.evaluate(() => fixtureRoot.querySelector('select').value), 'two');
      observation = await run('observe'); await page.evaluate(() => document.querySelector('#closed').hidden = true);
      assert.equal((await run('execute', { key: observation.documentKey, action: { tool: 'click', args: { snapshotId: observation.snapshotId, elementId: observation.elements.find(item => item.label.includes('distributed-action')).id } } })).error, 'STALE_SNAPSHOT');
      assert(!(await run('observe')).text.includes('closed-visible'));
      await page.evaluate(() => document.querySelector('#closed').hidden = false);
    });
    await t.test('only explicitly selected frames can be read; cross-origin and srcdoc route correctly', async () => {
      catalog = await run('catalog'); cross = catalog.find(item => item.url === childUrl); srcdoc = catalog.find(item => item.url === 'about:srcdoc'); hidden = catalog.find(item => item.url.includes('?hidden'));
      assert(cross && srcdoc && hidden);
      assert.equal((await run('observe', { frameId: cross.frameId })).error, 'FRAME_SCOPE');
      const selected = catalog.filter(item => [0, cross.frameId, srcdoc.frameId, hidden.frameId].includes(item.frameId));
      await run('prepare', { ids: selected.map(item => item.frameId), documents: selected });
      const observation = await run('observe', { frameId: cross.frameId }); assert(!observation.error, observation.message);
      assert(observation.text.includes('cross-origin-only')); assert(!observation.text.includes('closed-visible'));
      const input = observation.elements.find(item => item.label === 'child query');
      assert((await run('execute', { key: observation.documentKey, action: { tool: 'fill', args: { snapshotId: observation.snapshotId, elementId: input.id, value: 'child-write' } } })).ok);
      assert.equal(await page.frames().find(frame => frame.url() === childUrl).locator('input').inputValue(), 'child-write');
      const embedded = await run('observe', { frameId: srcdoc.frameId }); assert(!embedded.error, embedded.message);
      assert.equal(embedded.url, '[嵌入文档]'); assert(embedded.text.includes('srcdoc-only'));
      assert.equal((await run('observe', { frameId: hidden.frameId })).error, 'FRAME_HIDDEN');
    });
    await t.test('assistant switch pauses at child preview and fill waits for explicit confirmation', async () => {
      desiredFrame = cross.frameId;
      const call = (action, payload = {}) => harness.evaluate(({ action, payload }) => chrome.runtime.sendMessage({ action, ...payload }), { action, payload });
      const tabId = await harness.evaluate(() => globalThis.frameTestTab);
      await call('assistant:config', { config: { apiUrl: `http://127.0.0.1:${server.address().port}/chat/completions`, model: 'synthetic', apiKey: ['synthetic', 'local', 'only'].join('-') } });
      const selected = catalog.filter(item => [0, cross.frameId].includes(item.frameId));
      let reply = await call('assistant:prepare', { tabId, mode: 'assist', task: 'local test', frameIds: selected.map(item => item.frameId), frameDocuments: selected });
      assert(reply.success, reply.error); assert.equal(reply.data.status, 'preview'); assert.equal(modelCalls, 0);
      const waitState = async status => {
        for (let i = 0; i < 100; i++) {
          const state = (await call('assistant:get')).data.state;
          if (state.status === status) return state;
          assert.notEqual(state.status, 'failed', JSON.stringify(state.error));
          await new Promise(resolve => setTimeout(resolve, 30));
        }
        throw new Error(`Missing ${status}`);
      };
      await call('assistant:preview', { id: reply.data.id, previewId: reply.data.preview.id });
      let state = await waitState('preview'); assert.equal(state.frameId, cross.frameId); assert.equal(modelCalls, 1);
      assert(!bodies[0].includes('cross-origin-only'));
      await call('assistant:preview', { id: state.id, previewId: state.preview.id });
      state = await waitState('confirmation'); assert.equal(modelCalls, 2);
      assert.equal(await page.frames().find(frame => frame.url() === childUrl).locator('input').inputValue(), 'child-write');
      reply = await call('assistant:confirm', { id: state.id, confirmationId: state.pending.id, approved: true }); assert(reply.success, reply.error);
      await waitState('completed'); assert.equal(modelCalls, 3);
      assert.equal(await page.frames().find(frame => frame.url() === childUrl).locator('input').inputValue(), 'confirmed-child');
    });
    await t.test('same-origin and inherited about:blank remain separate explicitly selected documents', async () => {
      const current = await run('catalog'); const same = current.find(item => item.url.endsWith('/same'));
      const blank = current.find(item => item.url === 'about:blank'); assert(same && blank);
      assert.equal((await run('observe', { frameId: same.frameId })).error, 'FRAME_SCOPE');
      const selected = current.filter(item => [0, cross.frameId, same.frameId, blank.frameId].includes(item.frameId));
      await run('prepare', { ids: selected.map(item => item.frameId), documents: selected });
      const local = await run('observe', { frameId: same.frameId }); assert(!local.error, local.message); assert(local.text.includes('same-origin-only'));
      const inherited = await run('observe', { frameId: blank.frameId }); assert(!inherited.error, inherited.message);
      assert.equal(inherited.url, '[嵌入文档]'); assert(inherited.text.includes('blank-inherited-only'));
      assert(!inherited.text.includes('same-origin-only'));
    });
    await t.test('child reload rejects old document; parent reload revokes selected children', async () => {
      const observation = await run('observe', { frameId: cross.frameId });
      await page.frames().find(frame => frame.url() === childUrl).goto(childUrl);
      const input = observation.elements.find(item => item.label === 'child query');
      assert.equal((await run('execute', { key: observation.documentKey, action: { tool: 'fill', args: { snapshotId: observation.snapshotId, elementId: input.id, value: 'forbidden' } } })).error, 'STALE_SNAPSHOT');
      assert.equal(await page.frames().find(frame => frame.url() === childUrl).locator('input').inputValue(), '');
      await page.reload(); assert.deepEqual((await run('list')).map(item => item.frameId), [0]);
      assert.equal((await run('observe', { frameId: cross.frameId })).error, 'FRAME_SCOPE');
    });
  } finally {
    await context?.close(); await Promise.all([new Promise(resolve => server.close(resolve)), new Promise(resolve => child.close(resolve))]);
    await rm(temp, { recursive: true, force: true });
  }
});
