const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME });
  const pg = await b.newPage({ viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' });
  const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await pg.goto('http://localhost:' + (process.env.PORT || 8799) + '/'); await pg.waitForFunction(() => document.body.classList.contains('ready'));
  await pg.evaluate(() => BTStore.addProject(BTModel.makeProject('t1'))); await pg.waitForTimeout(300);
  const box = async sel => { const r = await pg.locator(sel).first().boundingBox(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, r }; };
  const drag = async (a, c) => { await pg.mouse.move(a.x, a.y); await pg.mouse.down(); await pg.mouse.move(a.x + 8, a.y + 8, { steps: 2 }); await pg.mouse.move(c.x, c.y, { steps: 8 }); await pg.mouse.up(); await pg.waitForTimeout(200); };
  const st = () => pg.evaluate(() => { const t = BTStore.tabTree(); return { loose: BTModel.looseRoots(t).length, n: Object.keys(t.nodes).length }; });
  const results = [];
  const ok = (name, cond, info) => { results.push((cond ? 'PASS ' : 'FAIL ') + name + (info ? ' ' + JSON.stringify(info) : '')); };
  const wrap = await box('#canvasWrap');

  // 1. drop position correct at 50% zoom
  await pg.evaluate(() => { for (let i = 0; i < 4; i++) BTCanvas.zoomAt(1 / 1.2); }); await pg.waitForTimeout(100);
  const target = { x: wrap.r.x + 150, y: wrap.r.y + 150 };
  await drag(await box('.pal-item.cat-condition'), target);
  const nb = await box('.node.loose');
  ok('drop lands under cursor at low zoom', Math.abs(nb.x - target.x) < 40 && Math.abs(nb.y - target.y) < 30, { node: [nb.x, nb.y], target });

  // 2. delete loose with keyboard, undo brings it back
  await pg.locator('.node.loose').click(); await pg.keyboard.press('Delete'); await pg.waitForTimeout(150);
  ok('Del removes loose node', (await st()).loose === 0);
  await pg.keyboard.press('Control+z'); await pg.waitForTimeout(150);
  ok('undo restores loose node', (await st()).loose === 1);

  // 3. drag loose node onto Root (full) -> refused, onto action -> refused (leaf)
  await pg.keyboard.press('f'); await pg.waitForTimeout(150);
  await drag(await box('.node.loose'), await box('.node.t-action'));
  ok('loose onto leaf refused', (await st()).loose === 1);

  // 4. wrap action with sequence via palette drop, then drop loose onto sequence center -> linked
  await drag(await box('.pal-item.cat-control'), await box('.node.t-action'));
  ok('palette control onto leaf wraps it', await pg.locator('.node.t-sequence').count() === 1);
  await pg.keyboard.press('f'); await pg.waitForTimeout(150);
  await drag(await box('.node.loose'), await box('.node.t-sequence'));
  ok('loose onto sequence links it', (await st()).loose === 0);

  // 5. monitor mode: drag does nothing, ports hidden
  await pg.click('#modeMonitor'); await pg.waitForTimeout(200);
  const before = await pg.evaluate(() => BTModel.exportXml(BTStore.activeProject()));
  const a = await box('.node.t-action');
  await drag(a, { x: wrap.r.x + 40, y: wrap.r.y + 300 });
  const after = await pg.evaluate(() => BTModel.exportXml(BTStore.activeProject()));
  ok('monitor drag does not edit', before === after);
  await pg.hover('.node.t-action');
  ok('ports hidden in monitor', !(await pg.locator('.node.t-action .port.in').isVisible()));
  await pg.click('#modeEditor'); await pg.waitForTimeout(200);

  // 6. '+' on a full root: what happens?
  await pg.hover('.node.t-root');
  ok('+ hidden on full root', !(await pg.locator('.node.t-root .quick-add').isVisible()));

  // 7. right-click edge -> insert decorator
  const e = await pg.evaluate(() => { const h = document.querySelector('.edge-hit'); const len = h.getTotalLength(); const p = h.getPointAtLength(len * 0.6); const m = h.getScreenCTM(); return { x: p.x * m.a + m.e, y: p.y * m.d + m.f }; });
  await pg.mouse.click(e.x, e.y, { button: 'right' }); await pg.waitForTimeout(200);
  const menu = await pg.locator('#ctxMenu').innerText();
  ok('edge context menu', /Desconectar/.test(menu), menu.split('\n').slice(0, 3));
  await pg.keyboard.press('Escape');

  // 8. text editing in inspector, then Ctrl+Z inside input should not break
  await pg.locator('.node.t-action').first().click();
  await pg.keyboard.press('Enter'); await pg.keyboard.type('9bad'); await pg.waitForTimeout(200);
  const prob = await pg.locator('#problemCount').innerText();
  ok('invalid function name flagged', prob !== '', prob);

  console.log(results.join('\n'));
  console.log('errors', errs);
  if (errs.length || results.some(r => r.startsWith('FAIL'))) process.exitCode = 1;
  await pg.screenshot({ path: require('os').tmpdir() + '/btstudio-e-end.png' });
  await b.close();
})();
