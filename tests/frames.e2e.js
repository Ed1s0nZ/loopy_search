import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { cp, mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, relative } from 'node:path';

test('real Chrome: closed shadow DOM and exact-document iframe routing', { timeout: 90000 }, async t => {
  const temp = await mkdtemp(join(tmpdir(), 'loopy-frame-test-'));
  const extension = join(temp, 'extension'); let context; let desiredFrame; let modelCalls = 0; const bodies = [];
  let behavior = 'frame'; let pendingModel; let desiredTab; let navigationUrl;
  const child = createServer((req, res) => {
    res.setHeader('content-type', 'text/html');
    res.end(req.url.startsWith('/nested-parent') ? '<p>nested parent</p><iframe src="/child?nested" height="100"></iframe>'
      : `<title>child</title><p>${req.url.includes('?nested') ? 'nested-only' : 'cross-origin-only'}</p><input aria-label="child query"><button>child button</button><div style="height:1200px"></div>`);
  });
  await new Promise(resolve => child.listen(0, '127.0.0.1', resolve));
  const childUrl = `http://127.0.0.1:${child.address().port}/child`;
  const server = createServer(async (req, res) => {
    if (req.url === '/chat/completions') {
      let body = ''; for await (const chunk of req) body += chunk;
      bodies.push(body); modelCalls++; const input = JSON.parse(body);
      const observations = input.messages.filter(message => message.role === 'user').map(message => { try { return JSON.parse(Array.isArray(message.content) ? message.content.filter(part => part.type === 'text').map(part => part.text).join('') : message.content).observation; } catch { return null; } }).filter(Boolean);
      const observation = observations.at(-1);
      const executed = input.messages.some(message => message.role === 'assistant' && message.content.includes('"tool":"fill"'));
      let action = observation.frameId === 0 ? { tool: 'switch_frame', args: { frameId: desiredFrame } }
        : !executed ? { tool: 'fill', args: { snapshotId: observation.snapshotId, elementId: observation.elements.find(item => item.label === 'child query').id, value: 'confirmed-child' } }
          : { tool: 'finish', args: { summary: 'local test complete' } };
      if (behavior.startsWith('shadow')) {
        const count = input.messages.filter(message => message.role === 'assistant' && message.content.includes('"tool":"fill"')).length;
        action = count < 2 ? { tool: 'fill', args: { snapshotId: observation.snapshotId, elementId: observation.elements.find(item => item.label === 'shadow query').id, value: `shadow-auto-${count}` } } : { tool: 'finish', args: { summary: 'shadow complete' } };
      }
      if (behavior === 'vision-switch') {
        const switches = input.messages.filter(message => message.role === 'assistant' && message.content.includes('"tool":"switch_frame"')).length;
        action = switches < 2 ? { tool: 'switch_frame', args: { frameId: switches === 0 ? desiredFrame : 0 } } : { tool: 'finish', args: { summary: 'visual frame test' } };
      }
      if (behavior === 'tab-mix' || behavior === 'frame-navigate') {
        const steps = input.messages.filter(message => message.role === 'assistant').length;
        const sequence = behavior === 'tab-mix'
          ? [{ tool: 'list_frames', args: {} }, { tool: 'switch_frame', args: { frameId: desiredFrame } }, { tool: 'switch_tab', args: { tabId: desiredTab } }, { tool: 'switch_frame', args: { frameId: desiredFrame } }]
          : [{ tool: 'switch_frame', args: { frameId: desiredFrame } }, { tool: 'scroll', args: { direction: 'down', amount: 200 } }, { tool: 'navigate', args: { url: navigationUrl } }];
        action = sequence[steps] || { tool: 'finish', args: { summary: 'mixed scope complete' } };
      }
      const respond = () => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(action) } }] })); };
      if (behavior === 'shadow-slow') { pendingModel = respond; return; }
      respond(); return;
    }
    res.setHeader('content-type', 'text/html');
    if (req.url === '/same') { res.end('<p>same-origin-only</p><input aria-label="same query">'); return; }
    res.end(`<title>frame fixture</title><div id="closed"><span slot="action">distributed-action</span></div><div id="hidden" hidden></div>
      <iframe src="${childUrl}" height="180"></iframe>
      <iframe srcdoc="<p>srcdoc-only</p><input aria-label='srcdoc query'>" height="180"></iframe>
      <iframe src="${childUrl}?hidden" style="display:none"></iframe>
      <iframe src="/same" height="80"></iframe><iframe id="blank" height="80"></iframe>
      <iframe id="nested-parent" src="${childUrl.replace('/child', '/nested-parent')}" height="180"></iframe>
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
      args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--window-size=1100,1000'], viewport: null });
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const page = await context.newPage(); await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(() => frames.length === 6 && document.querySelector('#closed').getBoundingClientRect().height > 0);
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
    await t.test('closed-slot hidden parent and new shadow roots invalidate existing observations', async () => {
      await page.evaluate(() => fixtureRoot.querySelector('button').style.opacity = '0');
      let observation = await run('observe');
      assert(!observation.text.includes('distributed-action')); assert(!observation.elements.some(item => item.label.includes('distributed-action')));
      await page.evaluate(() => fixtureRoot.querySelector('button').style.opacity = '1');
      observation = await run('observe'); assert(observation.text.includes('distributed-action'));
      await page.evaluate(() => fixtureRoot.querySelector('#nested').shadowRoot.append(document.createElement('div')));
      observation = await run('observe');
      await page.evaluate(() => fixtureRoot.querySelector('#nested').shadowRoot.lastElementChild.attachShadow({ mode: 'closed' }).innerHTML = '<p>new-root</p>');
      const input = observation.elements.find(item => item.label === 'shadow query');
      assert.equal((await run('execute', { key: observation.documentKey, action: { tool: 'fill', args: { snapshotId: observation.snapshotId, elementId: input.id, value: 'forbidden' } } })).error, 'STALE_SNAPSHOT');
      assert((await run('observe')).text.includes('new-root'));
      await page.evaluate(() => fixtureRoot.querySelector('#nested').shadowRoot.lastElementChild.remove());
    });
    await t.test('sensitive composed ancestors and shadow editors never contribute values or region text', async () => {
      await page.evaluate(() => {
        const region = document.createElement('section'); region.id = 'api-secret-region';
        region.innerHTML = '<p>private-region-content</p><input aria-label="ordinary query">'; fixtureRoot.append(region);
        const editor = document.createElement('div'); editor.id = 'shadow-editor'; editor.contentEditable = 'true'; editor.textContent = 'private-editor-content'; fixtureRoot.append(editor);
      });
      const observation = await run('observe'); assert(!observation.error, observation.message);
      assert(!JSON.stringify(observation).includes('private-region-content')); assert(!observation.text.includes('private-editor-content'));
      assert(!observation.elements.some(item => item.label.includes('ordinary query')));
      await page.evaluate(() => { fixtureRoot.querySelector('#api-secret-region').remove(); fixtureRoot.querySelector('#shadow-editor').remove(); });
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
    const call = (action, payload = {}) => harness.evaluate(({ action, payload }) => chrome.runtime.sendMessage({ action, ...payload }), { action, payload });
    const waitTask = async status => {
      for (let i = 0; i < 120; i++) {
        const state = (await call('assistant:get')).data.state;
        if (state.status === status) return state;
        if (state.status === 'failed') throw new Error(JSON.stringify(state.error));
        await new Promise(resolve => setTimeout(resolve, 30));
      }
      throw new Error(`Missing task state ${status}`);
    };
    await t.test('visual frame switching removes old images and requires new root screenshot consent', async () => {
      behavior = 'vision-switch'; desiredFrame = cross.frameId;
      const tabId = await harness.evaluate(() => globalThis.frameTestTab); const current = await run('catalog');
      const selected = current.filter(item => [0, cross.frameId].includes(item.frameId)); const before = modelCalls;
      const reply = await call('assistant:prepare', { tabId, mode: 'read', vision: true, task: 'local visual frames', frameIds: selected.map(item => item.frameId), frameDocuments: selected });
      assert(reply.success, reply.error); assert.equal(reply.data.status, 'preview', JSON.stringify(reply.data.error));
      const firstImage = reply.data.preview.vision.id;
      await call('assistant:preview', { id: reply.data.id, previewId: reply.data.preview.id });
      let state = await waitTask('preview'); assert.equal(state.frameId, cross.frameId); assert.equal(state.preview.vision, undefined); assert.equal(modelCalls, before + 1);
      await call('assistant:preview', { id: state.id, previewId: state.preview.id });
      state = await waitTask('preview'); assert.equal(state.frameId, 0); assert(state.preview.vision); assert.notEqual(state.preview.vision.id, firstImage);
      const childRequest = JSON.parse(bodies[before + 1]); assert(!JSON.stringify(childRequest).includes('image_url')); assert(!JSON.stringify(childRequest).includes('data:image'));
      await call('assistant:preview', { id: state.id, previewId: state.preview.id }); await waitTask('completed'); assert.equal(modelCalls, before + 3);
      behavior = 'frame';
    });
    const prepareAuto = async limit => {
      const tabId = await harness.evaluate(() => globalThis.frameTestTab);
      const response = await call('assistant:prepare', { tabId, mode: 'auto', task: 'local shadow test' }); assert(response.success, response.error);
      const state = response.data; const element = state.preview.elements.find(item => item.label === 'shadow query'); assert(element);
      const approval = await call('assistant:preview', { id: state.id, previewId: state.preview.id, automation: { grants: [{ elementId: element.id, tool: 'fill' }], limit, acknowledged: true } }); assert(approval.success, approval.error);
      return state;
    };
    await t.test('closed-root automatic grants follow live nodes and enforce action budget', async () => {
      behavior = 'shadow'; await prepareAuto(2); let state = await waitTask('completed');
      assert.equal(state.events.filter(event => event.type === 'automatic').length, 2);
      assert.equal(await page.evaluate(() => fixtureRoot.querySelector('input').value), 'shadow-auto-1');
      await prepareAuto(1); state = await waitTask('confirmation');
      assert.equal(state.automation.remaining, 0); assert.equal(await page.evaluate(() => fixtureRoot.querySelector('input').value), 'shadow-auto-0');
      await call('assistant:stop');
    });
    await t.test('replacing a closed-root node while the model waits cannot reuse automatic consent', async () => {
      behavior = 'shadow-slow'; pendingModel = null; await prepareAuto(2);
      for (let i = 0; !pendingModel && i < 100; i++) await new Promise(resolve => setTimeout(resolve, 20)); assert(pendingModel);
      await page.evaluate(() => { const input = fixtureRoot.querySelector('input'); const replacement = input.cloneNode(); replacement.value = ''; input.replaceWith(replacement); });
      pendingModel(); const state = await waitTask('failed'); assert.equal(state.error.code, 'STALE_SNAPSHOT');
      assert.equal(await page.evaluate(() => fixtureRoot.querySelector('input').value), '');
      behavior = 'frame';
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
    await t.test('nested cross-origin frames require selection and respect hidden ancestor clipping', async () => {
      const current = await run('catalog'); const nested = current.find(item => item.url.endsWith('/child?nested')); assert(nested && nested.parentFrameId !== 0);
      assert.equal((await run('observe', { frameId: nested.frameId })).error, 'FRAME_SCOPE');
      const selected = current.filter(item => [0, cross.frameId, nested.frameId].includes(item.frameId));
      await run('prepare', { ids: selected.map(item => item.frameId), documents: selected });
      await page.locator('#nested-parent').scrollIntoViewIfNeeded();
      const observation = await run('observe', { frameId: nested.frameId }); assert(!observation.error, observation.message); assert(observation.text.includes('nested-only'));
      await page.locator('#nested-parent').evaluate(element => element.style.display = 'none');
      assert.equal((await run('observe', { frameId: nested.frameId })).error, 'FRAME_HIDDEN');
      await page.locator('#nested-parent').evaluate(element => element.style.display = ''); await page.evaluate(() => scrollTo(0, 0));
    });
    await t.test('sandbox document either exposes its own safe DOM or returns explicit browser refusal', async () => {
      const before = new Set((await run('catalog')).map(item => item.frameId));
      await page.evaluate(() => new Promise(resolve => { const frame = document.createElement('iframe'); frame.id = 'sandbox-test'; frame.sandbox = ''; frame.srcdoc = '<p>sandbox-isolated-only</p>'; frame.addEventListener('load', resolve, { once: true }); document.body.prepend(frame); }));
      const current = await run('catalog'); const isolated = current.find(item => !before.has(item.frameId)); assert(isolated);
      const selected = current.filter(item => [0, cross.frameId, isolated.frameId].includes(item.frameId)); await run('prepare', { ids: selected.map(item => item.frameId), documents: selected });
      await page.locator('#sandbox-test').scrollIntoViewIfNeeded();
      const observation = await run('observe', { frameId: isolated.frameId });
      if (observation.error) { assert.equal(observation.error, 'PAGE_UNAVAILABLE'); t.diagnostic('Chrome refused sandbox scripting explicitly'); }
      else { assert(observation.text.includes('sandbox-isolated-only')); assert(!observation.text.includes('closed-visible')); t.diagnostic('Chrome permits isolated-world observation of this sandbox document'); }
      await page.locator('#sandbox-test').evaluate(element => element.remove());
      await page.evaluate(() => scrollTo(0, 0));
    });
    await t.test('node and shadow-root budgets fail explicitly; bounded output recovers after removal', async () => {
      await page.evaluate(() => {
        const box = document.createElement('section'); box.id = 'budget'; const fragment = document.createDocumentFragment();
        for (let i = 0; i < 15100; i++) { const item = document.createElement('div'); item.textContent = 'node'; fragment.append(item); }
        box.append(fragment); document.body.append(box);
      });
      assert.equal((await run('observe')).error, 'DOCUMENT_LIMIT');
      const reply = await call('assistant:prepare', { tabId: await harness.evaluate(() => globalThis.frameTestTab), mode: 'read', task: 'local budget test' });
      assert(reply.success, reply.error); assert.equal(reply.data.error.code, 'DOCUMENT_LIMIT');
      await harness.waitForFunction(() => document.querySelector('#result').textContent.includes('DOCUMENT_LIMIT'));
      await page.locator('#budget').evaluate(element => element.remove());
      await page.evaluate(() => {
        const box = document.createElement('section'); box.id = 'budget';
        for (let i = 0; i < 65; i++) { const host = document.createElement('div'); host.attachShadow({ mode: 'closed' }).textContent = 'root'; box.append(host); }
        document.body.append(box);
      });
      assert.equal((await run('observe')).error, 'DOCUMENT_LIMIT'); await page.locator('#budget').evaluate(element => element.remove());
      await page.evaluate(() => {
        const box = document.createElement('section'); box.id = 'budget';
        for (let i = 0; i < 100; i++) { const button = document.createElement('button'); button.textContent = `budget button ${i}`; box.append(button); }
        const paragraph = document.createElement('p'); paragraph.textContent = 'visible bounded text '.repeat(1000); box.append(paragraph); document.body.append(box);
      });
      const observation = await run('observe'); assert(!observation.error, observation.message);
      assert.equal(observation.elements.length, 80); assert(observation.text.length <= 12000);
      await page.locator('#budget').evaluate(element => element.remove()); assert(!(await run('observe')).error);
    });
    await t.test('replacing an iframe refuses the old document and does not authorize its replacement', async () => {
      const current = await run('catalog'); const target = current.find(item => item.url === childUrl);
      const selected = current.filter(item => [0, target.frameId].includes(item.frameId)); await run('prepare', { ids: selected.map(item => item.frameId), documents: selected });
      const observation = await run('observe', { frameId: target.frameId }); assert(!observation.error, observation.message);
      await page.evaluate(url => new Promise(resolve => {
        const old = [...document.querySelectorAll('iframe')].find(frame => frame.src === url); const replacement = old.cloneNode();
        replacement.addEventListener('load', resolve, { once: true }); old.replaceWith(replacement);
      }), childUrl);
      const input = observation.elements.find(item => item.label === 'child query');
      assert.equal((await run('execute', { key: observation.documentKey, action: { tool: 'fill', args: { snapshotId: observation.snapshotId, elementId: input.id, value: 'forbidden' } } })).error, 'FRAME_SCOPE');
      const replacement = (await run('catalog')).find(item => item.url === childUrl); assert.notEqual(replacement.frameId, target.frameId);
      assert.equal((await run('observe', { frameId: replacement.frameId })).error, 'FRAME_SCOPE');
      assert.equal(await page.frames().find(frame => frame.url() === childUrl).locator('input').inputValue(), '');
      cross = replacement;
      const next = await run('catalog'); const renewed = next.filter(item => [0, replacement.frameId].includes(item.frameId));
      await run('prepare', { ids: renewed.map(item => item.frameId), documents: renewed });
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
    await t.test('switching tabs resets to root and refuses the previous tab child frame', async () => {
      const other = await context.newPage(); await other.goto(`http://127.0.0.1:${server.address().port}/same`);
      try {
        const tabId = await harness.evaluate(() => globalThis.frameTestTab);
        desiredTab = await harness.evaluate(async () => (await chrome.tabs.query({})).find(tab => tab.url.endsWith('/same')).id);
        const current = await run('catalog'); desiredFrame = current.find(item => item.url === childUrl).frameId;
        const selected = current.filter(item => [0, desiredFrame].includes(item.frameId)); behavior = 'tab-mix';
        const reply = await call('assistant:prepare', { tabId, tabIds: [tabId, desiredTab], mode: 'read', task: 'local mixed tabs', frameIds: selected.map(item => item.frameId), frameDocuments: selected }); assert(reply.success, reply.error);
        await call('assistant:preview', { id: reply.data.id, previewId: reply.data.preview.id });
        let state = await waitTask('preview'); assert.equal(state.frameId, desiredFrame);
        await call('assistant:preview', { id: state.id, previewId: state.preview.id });
        state = await waitTask('preview'); assert.equal(state.tabId, desiredTab); assert.equal(state.frameId, 0);
        assert.deepEqual(state.preview.frames.map(frame => frame.frameId), [0]);
        await call('assistant:preview', { id: state.id, previewId: state.preview.id });
        state = await waitTask('failed'); assert.equal(state.error.code, 'FRAME_SCOPE');
        assert.equal(other.url(), `http://127.0.0.1:${server.address().port}/same`);
      } finally { await other.close(); }
    });
    await t.test('child scrolling stays in its document; confirmed navigation replaces the entire tab', async () => {
      behavior = 'frame-navigate'; navigationUrl = `http://127.0.0.1:${server.address().port}/same`;
      const tabId = await harness.evaluate(() => globalThis.frameTestTab); const current = await run('catalog'); desiredFrame = current.find(item => item.url === childUrl).frameId;
      const selected = current.filter(item => [0, desiredFrame].includes(item.frameId));
      const reply = await call('assistant:prepare', { tabId, mode: 'assist', task: 'local root navigation', frameIds: selected.map(item => item.frameId), frameDocuments: selected }); assert(reply.success, reply.error);
      await call('assistant:preview', { id: reply.data.id, previewId: reply.data.preview.id });
      let state = await waitTask('preview'); assert.equal(state.frameId, desiredFrame);
      const parentScroll = await page.evaluate(() => scrollY);
      await call('assistant:preview', { id: state.id, previewId: state.preview.id });
      state = await waitTask('confirmation'); assert.equal(state.pending.action.tool, 'navigate'); assert.notEqual(page.url(), navigationUrl);
      assert.equal(await page.frames().find(frame => frame.url() === childUrl).evaluate(() => scrollY), 200);
      assert.equal(await page.evaluate(() => scrollY), parentScroll);
      await call('assistant:confirm', { id: state.id, confirmationId: state.pending.id, approved: true });
      state = await waitTask('preview'); assert.equal(state.frameId, 0); assert.equal(page.url(), navigationUrl); assert.equal(page.frames().length, 1);
      assert.deepEqual(state.preview.frames.map(frame => frame.frameId), [0]);
      await call('assistant:preview', { id: state.id, previewId: state.preview.id }); await waitTask('completed');
    });
    await t.test('frame picker renders at sidebar width and drops stale catalog when target closes', async () => {
      const tabId = await harness.evaluate(() => globalThis.frameTestTab);
      await harness.locator('#target').selectOption(String(tabId)); await harness.locator('#framePicker summary').click();
      await harness.locator('#loadFrames').click(); await harness.waitForFunction(() => document.querySelector('#frameChoices input'));
      assert.equal(await harness.locator('#frameChoices input').count(), 1);
      await mkdir('artifacts', { recursive: true }); await harness.setViewportSize({ width: 420, height: 1000 });
      for (const colorScheme of ['light', 'dark']) {
        await harness.emulateMedia({ colorScheme }); await harness.screenshot({ path: `artifacts/frames-${colorScheme}-420.png`, fullPage: true });
      }
      const other = await context.newPage(); await other.goto(`http://127.0.0.1:${server.address().port}/same`);
      await page.close(); await harness.locator('#refreshTabs').click();
      await harness.waitForFunction(() => document.querySelector('#frameChoices').childElementCount === 0);
      assert.notEqual(await harness.locator('#target').inputValue(), String(tabId));
      assert((await harness.locator('#frameHint').textContent()).includes('默认只访问顶层'));
      await other.close();
    });
  } finally {
    await context?.close(); await Promise.all([new Promise(resolve => server.close(resolve)), new Promise(resolve => child.close(resolve))]);
    await rm(temp, { recursive: true, force: true });
  }
});

test('unmodified extension: optional frame permission is absent and top-level tools still work', { timeout: 30000 }, async () => {
  const profile = await mkdtemp(join(tmpdir(), 'loopy-frame-denial-')); let context;
  const server = createServer((req, res) => { res.setHeader('content-type', 'text/html'); res.end('<title>permission fixture</title><p>top-level available</p>'); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    context = await chromium.launchPersistentContext(profile, { channel: 'chromium', headless: true,
      args: [`--disable-extensions-except=${resolve('.')}`, `--load-extension=${resolve('.')}`] });
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const page = await context.newPage(); await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const harness = await context.newPage(); await harness.goto(`chrome-extension://${new URL(worker.url()).host}/assistant.html`);
    const result = await harness.evaluate(async () => {
      const { createBrowserTools } = await import('./assistant/browser.js'); const browser = createBrowserTools(chrome);
      const [tab] = (await chrome.tabs.query({})).filter(tab => tab.title === 'permission fixture');
      const scope = await browser.prepareScope(tab.id, [tab.id], [], false);
      let denied; try { await browser.frames.catalog(tab.id, scope); } catch (error) { denied = error.code; }
      return { permitted: await chrome.permissions.contains({ permissions: ['webNavigation'] }), denied,
        manifest: chrome.runtime.getManifest(), observation: await browser.observe(tab.id, [], undefined, scope) };
    });
    assert.equal(result.permitted, false); assert.equal(result.denied, 'FRAME_PERMISSION');
    assert(result.manifest.optional_permissions.includes('webNavigation')); assert(!result.manifest.permissions.includes('webNavigation'));
    assert(result.observation.text.includes('top-level available'));
  } finally { await context?.close(); await new Promise(resolve => server.close(resolve)); await rm(profile, { recursive: true, force: true }); }
});
