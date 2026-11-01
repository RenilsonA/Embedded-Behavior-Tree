const { chromium } = require('playwright-core');
const exe = process.env.CHROME;
const SP = __dirname;
(async () => {
  const b = await chromium.launch({ executablePath: exe });
  const pg = await b.newPage({ viewport: { width: 1400, height: 850 }, reducedMotion: 'reduce' });
  const errors = [];
  pg.on('pageerror', e => errors.push(e.message));
  pg.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await pg.goto('http://localhost:' + (process.env.PORT || 8799) + '/');
  await pg.waitForFunction(() => document.body.classList.contains('ready'));
  await pg.evaluate(() => { BTStore.addProject(BTModel.makeProject('demo')); });
  await pg.waitForTimeout(300);
  const box = async sel => { const r = await pg.locator(sel).first().boundingBox(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, r }; };
  const dragTo = async (from, to) => { await pg.mouse.move(from.x, from.y); await pg.mouse.down(); await pg.mouse.move(from.x + 10, from.y + 10, { steps: 3 }); await pg.mouse.move(to.x, to.y, { steps: 8 }); await pg.mouse.up(); await pg.waitForTimeout(200); };
  const wrap = await box('#canvasWrap'); console.log('wrap', wrap.r);
  const state = () => pg.evaluate(() => { const t = BTStore.tabTree(); return { loose: BTModel.looseRoots(t).map(id => t.nodes[id].type), root: t.nodes[t.rootId].children.map(id => t.nodes[id].type) }; });

  // 1) palette -> empty canvas = loose node
  const pal = await box('.pal-item.cat-control');
  await dragTo(pal, { x: wrap.r.x + 250, y: wrap.r.y + 300 });
  let s = await state(); console.log('after palette drop', s);
  if (s.loose[0] !== 'sequence') throw new Error('palette drop did not create loose node');

  // 2) save is blocked
  await pg.click('#btnSave'); await pg.waitForTimeout(300);
  const modal = await pg.locator('#modalRoot').innerText(); console.log('modal:', modal.split('\n')[0]);
  if (!/loose nodes/.test(modal)) throw new Error('save not blocked');
  await pg.screenshot({ path: require('os').tmpdir() + '/btstudio-1-loose.png' });
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);

  // 3) drag connected action to empty space = disconnect
  // 3a) sideways drag of the only child does NOT unlink
  const act0 = await box('.node.t-action');
  await dragTo(act0, { x: act0.x + 200, y: act0.y });
  s = await state(); console.log('after sideways drag', s);
  if (s.root[0] !== 'action') throw new Error('sideways drag unlinked');
  await pg.hover('.node.t-action');
  const actIn = await box('.node.t-action .port.in');
  await dragTo(actIn, { x: wrap.r.x + wrap.r.width - 150, y: wrap.r.y + wrap.r.height - 80 });
  s = await state(); console.log('after disconnect', s);
  if (s.root.length !== 0 || s.loose.length !== 2) throw new Error('disconnect failed');

  // 4) sequence in-port -> root : link
  await pg.hover('.node.t-sequence');
  const pin = await box('.node.t-sequence .port.in');
  const root = await box('.node.t-root');
  await dragTo(pin, root);
  s = await state(); console.log('after link to root', s);
  if (s.root[0] !== 'sequence') throw new Error('link to root failed');

  // 5) sequence "+" -> loose action : link as child
  await pg.click('.node.t-sequence'); await pg.waitForTimeout(100);
  const plus = await box('.node.t-sequence .quick-add');
  const act2 = await box('.node.t-action');
  await dragTo(plus, act2);
  s = await state(); console.log('after link child', s);
  if (s.loose.length !== 0) throw new Error('child link failed');

  // 5b) reorder siblings by dragging sideways into empty space
  await pg.evaluate(() => { const p = BTStore.activeProject(), t = BTStore.tabTree(), seq = t.nodes[t.nodes[t.rootId].children[0]];
    BTStore.mutate(p.id, () => { BTModel.addNode(t, BTModel.makeNode('condition', { code: 'cond' }), seq.id); }); });
  await pg.waitForTimeout(300);
  const order = () => pg.evaluate(() => { const t = BTStore.tabTree(); return t.nodes[t.nodes[t.rootId].children[0]].children.map(id => t.nodes[id].type).join(','); });
  console.log('before reorder', await order());
  const a1 = await box('.node.t-action'), c1 = await box('.node.t-condition');
  await dragTo(a1, { x: c1.x + 140, y: c1.y + 60 });
  const o2 = await order(); console.log('after reorder', o2, await state());
  if (o2 !== 'condition,action') throw new Error('reorder failed');
  if ((await state()).loose.length) throw new Error('reorder unlinked');

  // 6) save now works
  await pg.click('#btnSave'); await pg.waitForTimeout(600);
  const toasts = await pg.locator('#toasts').innerText(); console.log('toast:', toasts.split('\n').slice(-1)[0]);
  if (!/Saved/.test(toasts)) throw new Error('save failed');
  await pg.screenshot({ path: require('os').tmpdir() + '/btstudio-2-linked.png' });

  // 7) monitor: stale states after the running node are cleared
  const xml = '<root main_tree_to_execute="m"><BehaviorTree ID="m"><Sequence><Script code="a"/><RetryUntilSuccessful num_attempts="3"><Sequence><Script code="b"/><Script code="c"/></Sequence></RetryUntilSuccessful><Script code="d"/></Sequence></BehaviorTree></root>';
  const res = await pg.evaluate(xml => {
    const p = BTModel.projectFromImport(BTModel.importXml(xml), 'dbg'); BTStore.addProject(p);
    const order = BTModel.compiledOrder(p), t = p.trees[p.mainTreeId];
    const L = (i, s) => BTDebug.handleLine(BTModel.formatLogLine('DBG', i, s, t.nodes[order[i].nodeId].type));
    const st = () => order.map(e => BTDebug.nodeStatus(p, t, e.nodeId, '') || '-').join(',');
    const out = {};
    // pass 1: a ok, retry, b ok, c ok, retry ok, d ok
    L(0,'running'); L(0,'success'); L(1,'running'); L(2,'running'); L(2,'success'); L(3,'running'); L(3,'success');
    L(1,'running'); out.reentry = st();          // decorator re-entered from child: children keep colors
    L(1,'success'); L(4,'running'); L(4,'success'); out.pass1 = st();
    L(0,'running'); out.restart = st();          // tree restarts: everything after node 0 cleared
    L(0,'success'); L(1,'running'); L(2,'running'); out.mid = st();  // b running: c, d must not be green
    L(2,'fail'); L(1,'running'); L(2,'running'); out.retry = st();
    return out;
  }, xml);
  console.log('monitor', res);
  const exp = { reentry: 'success,running,success,success,-', pass1: 'success,success,success,success,success', restart: 'running,-,-,-,-', mid: 'success,running,running,-,-', retry: 'success,running,running,-,-' };
  for (const k in exp) if (res[k] !== exp[k]) throw new Error(`monitor ${k}: ${res[k]} != ${exp[k]}`);

  // 8) narrow screen: inspector reachable as drawer
  await pg.setViewportSize({ width: 600, height: 800 });
  await pg.click('#btnInspector'); await pg.waitForTimeout(300);
  const ib = await pg.locator('#inspector').boundingBox(); console.log('inspector drawer', Math.round(ib.x), Math.round(ib.width));
  if (ib.x < 0 || ib.x + ib.width > 601) throw new Error('drawer offscreen');
  await pg.screenshot({ path: require('os').tmpdir() + '/btstudio-3-mobile.png' });
  console.log('page errors:', errors);
  if (errors.length) throw new Error('page errors');
  console.log('E2E OK');
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
