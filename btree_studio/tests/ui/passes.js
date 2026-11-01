// Monitor with a real firmware log (examples/c99): leaves are logged only with their result,
// so the Studio must find where each pass of the tree ends and start the next one clean.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
const xml = fs.readFileSync(path.join(__dirname, '../../../examples/c99/tools/btree_robot/delivery.xml'), 'utf8');
const log = fs.readFileSync(path.join(__dirname, 'fixtures/delivery.log'), 'utf8').split('\n');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME });
  const pg = await b.newPage({ viewport: { width: 1400, height: 850 }, reducedMotion: 'reduce' });
  const errors = [];
  pg.on('pageerror', e => errors.push(e.message));
  const ok = (name, cond, info) => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? ' ' + JSON.stringify(info) : '')); if (!cond) process.exitCode = 1; };
  await pg.goto('http://localhost:' + (process.env.PORT || 8799) + '/');
  await pg.waitForFunction(() => document.body.classList.contains('ready'));
  await pg.evaluate(x => { BTStore.addProject(BTModel.projectFromImport(BTModel.importXml(x), 'robot')); }, xml);
  await pg.keyboard.press('F3');

  // Shown status of each array node (index -> status or null) right after feeding `lines`.
  const feed = lines => pg.evaluate(ls => {
    ls.forEach(l => BTDebug.handleLine(l));
    const p = BTStore.S.projects.find(x => x.name === 'robot');
    return BTModel.compiledOrder(p).map(e => BTDebug.nodeStatus(p, p.trees[e.treeId], e.nodeId, e.ctx));
  }, lines);
  const passes = [];
  log.forEach(l => { if (l.startsWith('===')) passes.push([]); else if (l.startsWith('[BTREE]')) passes[passes.length - 1].push(l); });
  ok('fixture has 3 deliveries', passes.length === 3, passes.map(p => p.length));

  let shown = await feed(passes[0]);
  ok('pass 1: charged, door opened, delivered', shown[1] === 'success' && shown[3] === 'success' && shown[7] === 'success', shown);

  shown = await feed([passes[1][0]]);  // pass 2 starts: battery_ok succeeds
  ok('pass 2 starts clean: only node 0 shown', shown[0] === 'success' && shown.slice(1).every(s => s === null), shown);

  shown = await feed(passes[1].slice(1));
  ok('pass 2: charge (not run) stays empty', shown[1] === null && shown[7] === 'success', shown);

  shown = await feed(passes[2]);
  ok('pass 3: ends at the Inverter, deliver_package not shown', shown[5] === 'fail' && shown[7] === null, shown);

  const c = await pg.evaluate(() => BTDebug.counters());
  ok('every line matched the tree', c.mismatches === 0 && c.events === passes.flat().length, c);
  ok('no page errors', !errors.length, errors);
  await b.close();
})();
