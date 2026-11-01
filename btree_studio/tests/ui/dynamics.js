// Quick add, command palette, hints and the monitor timeline (time travel must reproduce the past exactly).
const { chromium } = require('playwright-core');
const exe = process.env.CHROME;
(async () => {
  const b = await chromium.launch({ executablePath: exe });
  const pg = await b.newPage({ viewport: { width: 1400, height: 850 }, reducedMotion: 'reduce' });
  const errors = [];
  pg.on('pageerror', e => errors.push(e.message));
  pg.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const ok = (name, cond, info) => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? ' ' + JSON.stringify(info) : '')); if (!cond) process.exitCode = 1; };
  await pg.goto('http://localhost:' + (process.env.PORT || 8799) + '/');
  await pg.waitForFunction(() => document.body.classList.contains('ready'));
  await pg.evaluate(() => BTApp.loadExample());
  await pg.waitForTimeout(400);
  const kids = () => pg.evaluate(() => { const v = BTCanvas.selectedVNode(); return v.parent.node.children.map(id => v.tree.nodes[id].props.code || v.tree.nodes[id].type); });

  // 1. hints show something useful with nothing selected
  ok('hint without selection', /Double-click/.test(await pg.locator('#hints').innerText()));

  // 2. Space on a selected Sequence + "action abrir_porta" -> child Action with the function filled in
  await pg.click('.node.t-sequence >> nth=1');
  await pg.keyboard.press('Space');
  await pg.keyboard.type('action abrir_porta');
  await pg.keyboard.press('Enter');
  await pg.waitForTimeout(150);
  let sel = await pg.evaluate(() => { const v = BTCanvas.selectedVNode(); return { type: v.node.type, code: v.node.props.code, parent: v.parent.node.type }; });
  ok('quick add with parameter', sel.type === 'action' && sel.code === 'abrir_porta' && sel.parent === 'sequence', sel);

  // 3. Tab again on the new Action (a leaf) adds a sibling after it; "sleep 250" sets msec
  await pg.keyboard.press('Tab');
  await pg.keyboard.type('sleep 250');
  await pg.keyboard.press('Enter');
  await pg.waitForTimeout(150);
  sel = await pg.evaluate(() => { const v = BTCanvas.selectedVNode(); return { type: v.node.type, msec: v.node.props.msec }; });
  const order = await kids();
  ok('chained quick add -> sibling', sel.type === 'sleep' && sel.msec === '250' && order.indexOf('abrir_porta') === order.lastIndexOf('sleep') - 1, order);
  await pg.keyboard.press('Control+z'); await pg.keyboard.press('Control+z');
  await pg.waitForTimeout(150);

  // 4. double click on empty canvas -> loose node at that point
  const wrap = await pg.locator('#canvasWrap').boundingBox();
  await pg.mouse.dblclick(wrap.x + 120, wrap.y + wrap.height - 140);
  await pg.keyboard.type('repeat 4');
  await pg.keyboard.press('Enter');
  await pg.waitForTimeout(150);
  const loose = await pg.evaluate(() => BTModel.looseRoots(BTStore.tabTree()).map(id => BTStore.tabTree().nodes[id]));
  ok('double click creates loose node', loose.length === 1 && loose[0].type === 'repeat' && loose[0].props.num === '4', loose.map(n => n.type));
  await pg.waitForTimeout(300);
  ok('hint tells how to link loose node', /top dot/.test(await pg.locator('#hints').innerText()));
  await pg.keyboard.press('Control+z');

  // 5. Ctrl+K finds a node by function name and selects it
  await pg.keyboard.press('Control+k');
  await pg.keyboard.type('obstacle');
  await pg.keyboard.press('Enter');
  await pg.waitForTimeout(200);
  sel = await pg.evaluate(() => BTCanvas.selectedVNode() && BTCanvas.selectedVNode().node.props.code);
  ok('Ctrl+K go to node', sel === 'obstacle_detected', sel);

  // 6. monitor: empty timeline offers Simular; run, then check time travel against recorded live states
  await pg.keyboard.press('F3');
  await pg.waitForTimeout(150);
  ok('empty timeline offers simulation', await pg.locator('#tlSim').isVisible());
  await pg.evaluate(() => { document.getElementById('simSpeed').value = 4; });
  await pg.click('#tlSim');
  const snap = () => pg.evaluate(() => {
    const cur = BTCanvas.current();
    return { n: BTDebug.history().length, st: cur.list.map(v => BTDebug.nodeStatus(cur.project, v.tree, v.node.id, v.ctx) || '-').join(',') };
  });
  const snaps = [];
  for (let i = 0; i < 12; i++) { await pg.waitForTimeout(170); snaps.push(await snap()); }
  await pg.waitForTimeout(500);
  let mismatch = 0;
  for (const s of snaps) {
    const past = await pg.evaluate(n => { BTDebug.setViewAt(n, 'stay'); const cur = BTCanvas.current(); return cur.list.map(v => BTDebug.nodeStatus(cur.project, v.tree, v.node.id, v.ctx) || '-').join(','); }, s.n);
    if (past !== s.st) mismatch += 1;
  }
  ok('time travel reproduces the live states', mismatch === 0, { snapshots: snaps.length, mismatch });
  await pg.waitForTimeout(150);
  ok('badge shows history', /History/.test(await pg.locator('#monitorBadge').innerText()));

  // 7. step / failure jump / live
  await pg.locator('#canvasWrap').focus();
  const before = await pg.evaluate(() => BTDebug.viewAt());
  await pg.keyboard.press(',');
  ok('step back', await pg.evaluate(() => BTDebug.viewAt()) < before);
  await pg.evaluate(() => BTDebug.setViewAt(0, 'stay'));
  await pg.keyboard.press('Shift+.');
  const failOp = await pg.evaluate(() => { const o = BTDebug.history()[BTDebug.viewAt() - 1]; return o && o.status; });
  ok('jump to next failure', failOp === 'fail' || failOp === undefined, failOp);
  await pg.keyboard.press('End');
  ok('End returns live', await pg.evaluate(() => BTDebug.viewAt()) === null);

  // 8. clicking a [BTREE] terminal line goes back to that moment
  await pg.locator('#terminal .tl.bt').nth(2).click();
  await pg.waitForTimeout(150);
  const at = await pg.evaluate(() => BTDebug.viewAt());
  ok('terminal line jumps in time', at !== null && at > 0, at);
  await pg.click('#tlLive');
  await pg.click('#btnConnect');

  ok('no page errors', !errors.length, errors);
  console.log('errors', errors);
  await b.close();
})();
