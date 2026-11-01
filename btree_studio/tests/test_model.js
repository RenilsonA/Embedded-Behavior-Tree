// Unit tests for frontend/js/model.js.  Run: node tests/test_model.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const M = require('../frontend/js/model.js');

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('ok  ' + name); }

test('XML round-trip preserves every tree and attribute', () => {
  for (const f of ['examples/bc680z.xml', '../Scripts/tree-examples/simple.xml']) {
    const xml = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    const p1 = M.projectFromImport(M.importXml(xml), 'p');
    const out1 = M.exportXml(p1);
    const p2 = M.projectFromImport(M.importXml(out1), 'p');
    assert.strictEqual(M.exportXml(p2), out1, f);
    assert.strictEqual(p2.treeOrder.length, p1.treeOrder.length);
  }
});

test('new project: main tree with Root + Action leaf', () => {
  const p = M.makeProject('demo');
  const t = p.trees[p.mainTreeId];
  const root = t.nodes[t.rootId];
  assert.strictEqual(root.children.length, 1);
  assert.strictEqual(t.nodes[root.children[0]].type, 'action');
  assert.deepStrictEqual(M.validateProject(p).filter(i => i.level === 'error'), []);
});

test('child limits: root 1, decorator 1, leaf 0, control many', () => {
  const p = M.makeProject('d'); const t = p.trees[p.mainTreeId];
  assert.strictEqual(M.canAcceptChild(t, t.rootId, 'action'), false);
  const leaf = t.nodes[t.nodes[t.rootId].children[0]];
  assert.strictEqual(M.canAcceptChild(t, leaf.id, 'action'), false);
  const w = M.wrapNode(t, leaf.id, 'inverter');
  assert.strictEqual(M.canAcceptChild(t, w.id, 'action'), false);
  const s = M.wrapNode(t, w.id, 'sequence');
  for (let i = 0; i < 20; i++) M.addNode(t, M.makeNode('action', { code: 'a' + i }), s.id);
  assert.strictEqual(t.nodes[s.id].children.length, 21);
});

test('move: reorder siblings and refuse moving into own descendant', () => {
  const p = M.makeProject('d'); const t = p.trees[p.mainTreeId];
  const leaf = t.nodes[t.rootId].children[0];
  const seq = M.wrapNode(t, leaf, 'sequence');
  const a = M.addNode(t, M.makeNode('action', { code: 'a' }), seq.id);
  const b = M.addNode(t, M.makeNode('action', { code: 'b' }), seq.id);
  assert.ok(M.moveNode(t, b.id, seq.id, 0));
  assert.deepStrictEqual(t.nodes[seq.id].children, [b.id, leaf, a.id]);
  assert.ok(M.moveNode(t, b.id, seq.id, 3));
  assert.deepStrictEqual(t.nodes[seq.id].children, [leaf, a.id, b.id]);
  const inner = M.addNode(t, M.makeNode('fallback'), seq.id);
  assert.strictEqual(M.moveNode(t, seq.id, inner.id), false);
});

test('delete keeping children splices them into the parent', () => {
  const p = M.makeProject('d'); const t = p.trees[p.mainTreeId];
  const leaf = t.nodes[t.rootId].children[0];
  const seq = M.wrapNode(t, leaf, 'sequence');
  const fb = M.wrapNode(t, leaf, 'fallback');
  M.addNode(t, M.makeNode('condition', { code: 'c' }), fb.id);
  M.deleteNode(t, fb.id, true);
  assert.strictEqual(t.nodes[seq.id].children.length, 2);
  assert.ok(!t.nodes[fb.id]);
});

test('validation: required/invalid function names, numeric fields, empty control, broken subtree, cycles', () => {
  const p = M.makeProject('d'); const t = p.trees[p.mainTreeId];
  const leaf = t.nodes[t.nodes[t.rootId].children[0]];
  leaf.props.code = '';
  assert.ok(M.validateProject(p).some(i => /obrigatório/.test(i.message)));
  leaf.props.code = 'Inimigo?';
  assert.ok(M.validateProject(p).some(i => /inválido em C/.test(i.message)));
  leaf.props.code = 'ok';
  M.wrapNode(t, leaf.id, "sleep");
  assert.strictEqual(M.fieldError('sleep', '4294967295'), null);
  assert.ok(M.fieldError('sleep', '4294967296'));
  assert.ok(M.fieldError('sleep', '12a'));
  assert.ok(M.fieldError('retry', '0'));
  assert.ok(M.fieldError('retry', '65536'));
  const sub = M.makeTree('sub', false); M.addTreeToProject(p, sub);
  M.addNode(sub, M.makeNode('subtree', { ref: p.mainTreeId }), sub.rootId);
  M.addNode(t, M.makeNode('fallback'), t.rootId);
  const issues = M.validateProject(p).map(i => i.message).join('\n');
  assert.ok(/Root aceita apenas 1 filho/.test(issues));
  assert.ok(/precisa de pelo menos 1 filho/.test(issues));
  M.addNode(t, M.makeNode('subtree', { ref: sub.id }), t.nodes[t.rootId].children[1]);
  assert.ok(/ciclo/.test(M.validateProject(p).map(i => i.message).join('\n')));
});

test('log parser accepts every status/type string printed by btree_common.c', () => {
  const statuses = { 'Running': 'running', 'Success': 'success', 'Re-execute': 'running', 'Fail': 'fail', 'Stand by': 'standby', 'Error': 'fail' };
  const types = { 'Condition': 'condition', 'Action': 'action', 'Action Sleep': 'sleep', 'Retry Until Success': 'retry', 'Repeat': 'repeat',
    'Keep Running Until Success': 'keep_running', 'Inverter': 'inverter', 'Force Success': 'force_success', 'Force Fail': 'force_failure',
    'Reactive Action Sleep': 'sleep', 'Reactive Keep Running Until Success': 'keep_running' };
  for (const [s, ns] of Object.entries(statuses)) for (const [ty, nt] of Object.entries(types)) {
    const line = `[BTREE] | Tree: MAIN | Node: 12 | Status: ${s} | Type: ${ty}`;
    const r = M.parseLogLine(line);
    assert.ok(r, line);
    assert.strictEqual(r.status, ns); assert.strictEqual(r.type, nt); assert.strictEqual(r.index, 12); assert.strictEqual(r.tree, 'MAIN');
  }
  const r = M.parseLogLine('\x1b[32mI (1234) app: [BTREE] | Tree: MAIN | Node: 3 | Status: Success | Type: Action | Function: btree_main_tree_x\r');
  assert.strictEqual(r.fn, 'btree_main_tree_x'); assert.strictEqual(r.index, 3);
  assert.strictEqual(M.parseLogLine('hello world'), null);
  assert.strictEqual(M.parseLogLine(M.formatLogLine('MAIN', 4, 'standby', 'sleep')).status, 'standby');
});

test('compiled order inlines every SubTree instance separately', () => {
  const xml = '<root><BehaviorTree ID="main"><Sequence><SubTree ID="s"/><Script code="x"/><SubTree ID="s"/></Sequence></BehaviorTree>' +
    '<BehaviorTree ID="s"><Inverter><ScriptCondition code="c"/></Inverter></BehaviorTree></root>';
  const p = M.projectFromImport(M.importXml(xml), 'p');
  const order = M.compiledOrder(p);
  assert.deepStrictEqual(order.map(e => p.trees[e.treeId].nodes[e.nodeId].type), ['inverter', 'condition', 'action', 'inverter', 'condition']);
  assert.notStrictEqual(order[0].ctx, order[3].ctx);
  assert.strictEqual(order[2].ctx, '');
});

test('main tree detection on import', () => {
  const p = M.projectFromImport(M.importXml('<root main_tree_to_execute="b"><BehaviorTree ID="a"><Script code="x"/></BehaviorTree><BehaviorTree ID="b"><SubTree ID="a"/></BehaviorTree></root>'), 'p');
  assert.strictEqual(p.trees[p.mainTreeId].name, 'b');
  const q = M.projectFromImport(M.importXml('<root><BehaviorTree ID="a"><Script code="x"/></BehaviorTree><BehaviorTree ID="b"><SubTree ID="a"/></BehaviorTree></root>'), 'p');
  assert.strictEqual(q.trees[q.mainTreeId].name, 'b', 'first tree not referenced by others');
});

test('loose nodes: allowed while editing, flagged as errors, excluded from XML, linkable', () => {
  const p = M.makeProject('d'); const t = p.trees[p.mainTreeId];
  const seq = M.wrapNode(t, t.nodes[t.rootId].children[0], 'sequence');
  const xmlBefore = M.exportXml(p);
  const loose = M.addNode(t, M.makeNode('condition', { code: 'ok' }), null);
  loose.pos = { x: 300, y: 200 };
  assert.deepStrictEqual(M.looseRoots(t), [loose.id]);
  assert.ok(M.validateProject(p).some(i => i.level === 'error' && i.nodeId === loose.id));
  assert.strictEqual(M.compiledOrder(p).length, 1, 'loose node is not compiled');
  assert.ok(!M.linkNode(t, seq.id, loose.id), 'a leaf cannot become a parent');
  assert.ok(M.linkNode(t, loose.id, seq.id, 0));
  assert.strictEqual(loose.pos, undefined);
  assert.deepStrictEqual(M.looseNodes(p), []);
  assert.notStrictEqual(M.exportXml(p), xmlBefore);
  // detach a branch: it keeps its children and becomes loose again
  assert.ok(M.floatNode(t, seq.id, { x: 10, y: 20 }));
  assert.deepStrictEqual(M.looseRoots(t), [seq.id]);
  assert.strictEqual(t.nodes[seq.id].children.length, 2);
  assert.ok(!M.linkNode(t, t.rootId, seq.id), 'root never gets a parent');
  assert.ok(M.linkNode(t, seq.id, t.rootId));
  assert.deepStrictEqual(M.validateProject(p).filter(i => i.level === 'error'), []);
});

test('compiledOrder: end = last compiled descendant (decorator span)', () => {
  const xml = '<root><BehaviorTree ID="m"><Sequence><RetryUntilSuccessful num_attempts="3"><Sequence><Script code="a"/><Script code="b"/></Sequence></RetryUntilSuccessful><Script code="c"/></Sequence></BehaviorTree></root>';
  const p = M.projectFromImport(M.importXml(xml), 'p');
  assert.deepStrictEqual(M.compiledOrder(p).map(e => e.end), [2, 1, 2, 3]);
});

test('exportSelection copies only selected nodes, keeping links among them', () => {
  const xml = '<root><BehaviorTree ID="m"><Sequence><Fallback><Script code="a"/><Script code="b"/></Fallback><Script code="c"/></Sequence></BehaviorTree></root>';
  const p = M.projectFromImport(M.importXml(xml), 'p'); const t = p.trees[p.mainTreeId];
  const seq = t.nodes[t.nodes[t.rootId].children[0]], fb = t.nodes[seq.children[0]], a = fb.children[0], c = seq.children[1];
  assert.deepStrictEqual(M.exportSelection(t, [seq.id]), [{ type: 'sequence', props: {}, children: [] }], 'one node, no children');
  const f = M.exportSelection(t, [seq.id, fb.id, a]);
  assert.strictEqual(f.length, 1);
  assert.strictEqual(f[0].children[0].children[0].props.code, 'a', 'chain seq > fallback > a kept');
  assert.strictEqual(f[0].children.length, 1, 'unselected c dropped');
  assert.strictEqual(M.exportSelection(t, [a, c, t.rootId]).length, 2, 'unrelated nodes -> two roots, root never copied');
});

test('deleteOnly removes just the node; surviving children become loose', () => {
  const xml = '<root><BehaviorTree ID="m"><Sequence><Fallback><Script code="a"/><Script code="b"/></Fallback><Script code="c"/></Sequence></BehaviorTree></root>';
  const p = M.projectFromImport(M.importXml(xml), 'p'); const t = p.trees[p.mainTreeId];
  const seq = t.nodes[t.nodes[t.rootId].children[0]], fb = seq.children[0], c = seq.children[1];
  assert.ok(M.deleteOnly(t, [seq.id], () => ({ x: 1, y: 2 })));
  assert.strictEqual(t.nodes[seq.id], undefined);
  assert.deepStrictEqual(t.nodes[t.rootId].children, []);
  assert.deepStrictEqual(M.looseRoots(t).sort(), [fb, c].sort());
  assert.strictEqual(t.nodes[fb].children.length, 2, 'fallback keeps its own children');
  // deleting parent and child together: grandchildren float, nothing dangles
  assert.ok(M.deleteOnly(t, [fb, t.nodes[fb].children[0]], () => ({ x: 0, y: 0 })));
  assert.strictEqual(Object.keys(t.nodes).length, 3);
  assert.ok(!M.deleteOnly(t, [t.rootId], () => ({})), 'root is never deleted');
});

console.log(`\n${passed} testes passaram.`);
