const { chromium } = require('playwright-core');
const STEPS = +process.env.STEPS || 1500, SEED = +process.env.SEED || 1;
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME });
  const pg = await b.newPage({ viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' });
  const errs = []; pg.on('pageerror', e => errs.push(e.stack || e.message)); pg.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await pg.goto('http://localhost:' + (process.env.PORT || 8799) + '/'); await pg.waitForFunction(() => document.body.classList.contains('ready'));
  await pg.click('[data-action="example"]'); await pg.waitForTimeout(300);
  const res = await pg.evaluate(async ({ STEPS, SEED }) => {
    let seed = SEED; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const pick = a => a[Math.floor(rnd() * a.length)];
    const C = BTCanvas, M = BTModel, St = BTStore, S = St.S;
    const tick = () => new Promise(r => setTimeout(r, 0));
    const TYPES = Object.keys(M.TYPES).filter(t => t !== 'root' && t !== 'unknown');
    const log = [];
    function check(op) {
      for (const p of S.projects) for (const tid of p.treeOrder) {
        const t = p.trees[tid]; if (!t) throw new Error('treeOrder dangling');
        const root = t.nodes[t.rootId]; if (!root || root.parent) throw new Error('bad root');
        const seen = {};
        for (const id in t.nodes) {
          const n = t.nodes[id];
          if (n.id !== id) throw new Error('id mismatch');
          for (const c of n.children) {
            if (!t.nodes[c]) throw new Error('dangling child ' + c);
            if (t.nodes[c].parent !== id) throw new Error('parent pointer wrong');
            if (seen[c]) throw new Error('node with two parents'); seen[c] = 1;
          }
          if (n.parent && !t.nodes[n.parent]) throw new Error('dangling parent');
          if (n.parent && t.nodes[n.parent].children.indexOf(id) < 0) throw new Error('parent does not list child');
          if (n.children.length > M.TYPES[n.type].maxChildren) throw new Error('too many children ' + n.type);
          if (!n.parent && n.type !== 'root' && !n.pos) throw new Error('loose without pos');
        }
        if (!M.looseNodes(p).length) {
          const x = M.exportXml(p), q = M.projectFromImport(M.importXml(x), p.name);
          if (M.exportXml(q) !== x) throw new Error('xml roundtrip');
        }
      }
      const cur = C.current();
      if (cur) {
        const dom = document.querySelectorAll('#nodes .node:not(.leaving)').length;
        if (dom !== cur.list.length) throw new Error('DOM nodes ' + dom + ' != view ' + cur.list.length);
        for (const v of cur.list) if (!isFinite(v.x) || !isFinite(v.y)) throw new Error('NaN position');
      }
    }
    const ops = {
      addChild: v => C.addChild(v, pick(TYPES)),
      addSibling: v => C.addSibling(v, pick(TYPES), rnd() < .5),
      del: v => C.deleteSelection(),
      delBranch: v => C.deleteBranch(v),
      multi: v => St.toggleSelect(v.node.id, v.ctx, v.tree.id),
      all: () => { if (C.current().list.length < 120) C.selectAll(); }, // select-all + duplicate doubles the tree
      edgeDel: v => { if (v.parent && !v.readonly) { St.selectEdge(v.key); C.deleteSelection(); } },
      wrap: v => C.wrapWith(v, pick(TYPES.filter(t => M.isDecorator(t) || M.isControl(t)))),
      change: v => C.changeTypeOf(v, pick(TYPES)),
      copyPaste: v => { C.copySelection(); const cur = C.current(); C.pasteInto(pick(cur.list)); },
      copyBranch: v => { C.copyBranch(v); C.pasteLoose({ x: rnd() * 800, y: rnd() * 400 }); },
      cut: v => C.copySelection(true),
      dup: v => C.duplicate(),
      moveSib: v => C.moveSibling(v, rnd() < .5 ? -1 : 1),
      disconnect: v => C.disconnect(v, { x: rnd() * 800 - 400, y: rnd() * 600 - 300 }),
      addLoose: () => C.addLoose(pick(TYPES), { x: rnd() * 800, y: rnd() * 400 }),
      pasteLoose: () => C.pasteLoose({ x: rnd() * 800, y: rnd() * 400 }),
      link: v => { const cur = C.current(); const p = pick(cur.list); if (p !== v && !v.readonly && !p.readonly && v.node.type !== 'root' && M.canAcceptChild(v.tree, p.node.id, v.node.type) && !M.isAncestor(v.tree, v.node.id, p.node.id)) C.link(v, p, rnd() * 600); },
      expand: v => { if (v.node.type === 'subtree' && v.tree.nodes[v.node.id]) C.toggleExpand(v); },
      undo: () => St.undo(), redo: () => St.redo(),
      tab: () => { const p = St.activeProject(); St.openTab(p.id, pick(p.treeOrder)); },
      mode: () => St.setMode(rnd() < .8 ? 'editor' : 'monitor'),
      select: v => St.select(v.node.id, v.ctx, v.tree.id),
    };
    const names = Object.keys(ops);
    for (let i = 0; i < STEPS; i++) {
      const cur = C.current(); if (!cur) { St.openTab(St.activeProject().id, St.activeProject().mainTreeId); await tick(); continue; }
      const v = pick(cur.list), op = pick(names);
      log.push(op + ':' + v.node.type + (v.readonly ? '(ro)' : '') + (v.loose ? '(loose)' : ''));
      try { ops[op](v); await tick(); await tick(); check(op); }
      catch (e) { return { fail: e.message, stack: (e.stack || '').split('\n').slice(0, 4).join(' | '), at: i, last: log.slice(-8) }; }
    }
    document.querySelectorAll('.modal-wrap, .modal').forEach(m => m.remove());
    return { ok: STEPS, ops: log.length, nodes: Object.keys(BTStore.tabTree() ? BTStore.tabTree().nodes : {}).length };
  }, { STEPS, SEED });
  console.log(JSON.stringify(res, null, 1));
  console.log('page errors', errs.slice(0, 5));
  if (res.fail || errs.length) process.exitCode = 1;
  await b.close();
})();
