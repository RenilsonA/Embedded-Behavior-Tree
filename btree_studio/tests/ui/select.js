// Selection / delete / copy semantics with the real mouse and keyboard.
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME });
  const pg = await b.newPage({ viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' });
  const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await pg.goto('http://localhost:' + (process.env.PORT || 8799) + '/'); await pg.waitForFunction(() => document.body.classList.contains('ready'));
  const xml = '<root main_tree_to_execute="m"><BehaviorTree ID="m"><Sequence name="S"><Fallback name="F"><Script code="a"/><Script code="b"/></Fallback><Script code="c"/></Sequence></BehaviorTree></root>';
  const load = () => pg.evaluate(xml => { BTStore.S.projects.slice().forEach(p => BTStore.removeProject(p.id)); BTStore.addProject(BTModel.projectFromImport(BTModel.importXml(xml), 'sel')); }, xml).then(() => pg.waitForTimeout(250));
  const st = () => pg.evaluate(() => { const t = BTStore.tabTree(); return { n: Object.keys(t.nodes).length - 1, loose: BTModel.looseRoots(t).map(id => t.nodes[id].type).sort().join(','), rootKids: t.nodes[t.rootId].children.length }; });
  const res = []; const ok = (name, c, info) => res.push((c ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? ' ' + JSON.stringify(info) : ''));
  const node = sel => pg.locator(sel).first();

  // 1. Del on a control node removes only it
  await load();
  await node('.node.t-sequence').click(); await pg.keyboard.press('Delete'); await pg.waitForTimeout(200);
  let s = await st();
  ok('Del removes only the control node', s.n === 4 && s.loose === 'action,fallback' && s.rootKids === 0, s);
  await pg.keyboard.press('Control+z'); await pg.waitForTimeout(200);

  // 2. Ctrl+C on a control copies only it
  await node('.node.t-fallback').click(); await pg.keyboard.press('Control+c'); await pg.keyboard.press('Escape');
  await node('.node.t-root').click(); await pg.keyboard.press('Control+v'); await pg.waitForTimeout(200);
  s = await st();
  ok('Ctrl+C/V copies a single node', s.n === 6 && s.loose === 'fallback', s);
  await pg.keyboard.press('Control+z'); await pg.waitForTimeout(200);

  // 3. Ctrl+click several connected nodes -> copy keeps their links
  await node('.node.t-fallback').click();
  await pg.locator('.node.t-action').nth(0).click({ modifiers: ['Control'] });
  await pg.locator('.node.t-action').nth(2).click({ modifiers: ['Control'] });
  const multi = await pg.locator('#inspector .insp-title').innerText();
  ok('inspector shows multi-selection', /3 nodes/.test(multi), multi);
  await pg.keyboard.press('Control+c'); await pg.keyboard.press('Escape');
  await node('.node.t-root').click(); await pg.keyboard.press('Control+v'); await pg.waitForTimeout(200);
  const pasted = await pg.evaluate(() => { const t = BTStore.tabTree(); return BTModel.looseRoots(t).map(id => t.nodes[id].type + '[' + t.nodes[id].children.length + ']').sort().join(','); });
  ok('multi copy keeps links (fallback>a) and c separate', pasted === 'action[0],fallback[1]', pasted);
  await pg.keyboard.press('Control+z'); await pg.waitForTimeout(200);

  // 4. click an edge then Del disconnects it
  const e = await pg.evaluate(() => { const t = BTStore.tabTree(); const c = BTCanvas.current().list.find(v => v.node.type === 'fallback'); const h = [...document.querySelectorAll('.edge-hit')].find(x => x.dataset.key === c.key); const p = h.getPointAtLength(h.getTotalLength() * 0.75), m = h.getScreenCTM(); return { x: p.x * m.a + m.e, y: p.y * m.d + m.f }; });
  await pg.mouse.click(e.x, e.y); await pg.waitForTimeout(100);
  ok('edge gets selected', await pg.locator('.edge.sel').count() === 1);
  await pg.keyboard.press('Delete'); await pg.waitForTimeout(200);
  s = await st();
  ok('Del on edge disconnects (nothing deleted)', s.n === 5 && s.loose === 'fallback', s);
  await pg.keyboard.press('Control+z'); await pg.waitForTimeout(200);

  // 5. "Copy branch" only for nodes with children
  await node('.node.t-action').click({ button: 'right' }); await pg.waitForTimeout(100);
  ok('leaf menu has no "Copy branch"', !/Copy branch/.test(await pg.locator('#ctxMenu').innerText()));
  await pg.keyboard.press('Escape');
  await node('.node.t-sequence').click({ button: 'right' }); await pg.waitForTimeout(100);
  await pg.locator('#ctxMenu').getByText('Copy branch').click();
  await node('.node.t-root').click({ button: 'right' }); await pg.waitForTimeout(100);
  await pg.mouse.click(300, 600, { button: 'right' }); await pg.waitForTimeout(100);
  await pg.locator('#ctxMenu').getByText('Paste here (loose)').click(); await pg.waitForTimeout(200);
  s = await st();
  ok('branch copy pastes the whole branch', s.n === 10 && s.loose === 'sequence', s);
  await pg.keyboard.press('Control+z'); await pg.waitForTimeout(200);

  // 6. Shift+drag box selection, then Del removes all of them
  const a = await node('.node.t-fallback').boundingBox(), c = await pg.locator('.node.t-action').nth(2).boundingBox();
  await pg.keyboard.down('Shift');
  await pg.mouse.move(a.x - 15, a.y - 15); await pg.mouse.down(); await pg.mouse.move(c.x + c.width + 15, c.y + c.height + 80, { steps: 6 }); await pg.mouse.up();
  await pg.keyboard.up('Shift'); await pg.waitForTimeout(150);
  const nsel = await pg.locator('.node.selected').count();
  ok('box selects fallback, a, b, c', nsel === 4, nsel);
  await pg.keyboard.press('Delete'); await pg.waitForTimeout(200);
  s = await st();
  ok('Del removes the selected nodes only', s.n === 1 && s.loose === '' && s.rootKids === 1, s);

  console.log(res.join('\n')); console.log('errors', errs);
  if (errs.length || res.some(r => r.startsWith('FAIL'))) process.exitCode = 1;
  await b.close();
})();
