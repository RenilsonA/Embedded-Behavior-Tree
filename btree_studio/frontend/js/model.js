/* BTree Studio - data model.
 * Pure logic (no DOM): node types, project/tree structure, XML import/export,
 * validation and the firmware node index order. Also loadable from Node.js for tests.
 */
(function (global) {
  'use strict';

  var UINT32_MAX = 4294967295;
  var UINT16_MAX = 65535;
  var C_IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

  /* ------------------------------------------------------------------ *
   * Node types
   * ------------------------------------------------------------------ */
  // cat: root | control | decorator | action | condition | subtree | unknown
  // field: the editable value shown on the card and in the properties panel
  var TYPES = {
    root: { cat: 'root', label: 'Root', icon: 'root', maxChildren: 1, desc: 'Início da árvore. Aceita exatamente 1 filho.' },

    sequence: { cat: 'control', tag: 'Sequence', label: 'Sequence', icon: 'sequence', maxChildren: Infinity,
      desc: 'Lógica E: executa os filhos em ordem e para no primeiro que falhar.' },
    fallback: { cat: 'control', tag: 'Fallback', label: 'Fallback', icon: 'fallback', maxChildren: Infinity,
      desc: 'Lógica OU: executa os filhos em ordem e para no primeiro que tiver sucesso.' },
    reactive_sequence: { cat: 'control', tag: 'ReactiveSequence', label: 'Reactive Sequence', icon: 'reactive_sequence', maxChildren: Infinity,
      desc: 'Como o Sequence, mas reavalia os filhos anteriores a cada tick.' },
    reactive_fallback: { cat: 'control', tag: 'ReactiveFallback', label: 'Reactive Fallback', icon: 'reactive_fallback', maxChildren: Infinity,
      desc: 'Como o Fallback, mas reavalia os filhos anteriores a cada tick.' },

    action: { cat: 'action', tag: 'Script', label: 'Action', icon: 'action', maxChildren: 0,
      field: { key: 'code', attr: 'code', kind: 'ident', label: 'Função', placeholder: 'nome_da_funcao', required: true },
      desc: 'Folha de ação: chama a função C implementada no firmware.' },
    condition: { cat: 'condition', tag: 'ScriptCondition', label: 'Condition', icon: 'condition', maxChildren: 0,
      field: { key: 'code', attr: 'code', kind: 'ident', label: 'Função', placeholder: 'nome_da_condicao', required: true },
      desc: 'Folha de condição: chama a função C que retorna sucesso ou falha.' },
    sleep: { cat: 'action', tag: 'Sleep', label: 'Sleep', icon: 'sleep', maxChildren: 0,
      field: { key: 'msec', attr: 'msec', kind: 'uint', min: 0, max: UINT32_MAX, unit: 'ms', label: 'Duração', required: true, def: 1000 },
      desc: 'Espera um tempo (em ms). Máximo 4294967295 (uint32).' },

    retry: { cat: 'decorator', tag: 'RetryUntilSuccessful', label: 'Retry Until Success', icon: 'retry', maxChildren: 1,
      field: { key: 'num', attr: 'num_attempts', kind: 'uint', min: 1, max: UINT16_MAX, unit: 'tentativas', label: 'Tentativas', required: true, def: 3 },
      desc: 'Executa o filho até X vezes enquanto ele falhar.' },
    repeat: { cat: 'decorator', tag: 'Repeat', label: 'Repeat', icon: 'repeat', maxChildren: 1,
      field: { key: 'num', attr: 'num_cycles', kind: 'uint', min: 1, max: UINT16_MAX, unit: 'vezes', label: 'Repetições', required: true, def: 3 },
      desc: 'Repete o filho X vezes, independente de sucesso ou falha.' },
    keep_running: { cat: 'decorator', tag: 'KeepRunningUntilFailure', label: 'Keep Running Until Success', icon: 'keep_running', maxChildren: 1,
      desc: 'Executa o filho indefinidamente até ele ter sucesso.' },
    inverter: { cat: 'decorator', tag: 'Inverter', label: 'Inverter', icon: 'inverter', maxChildren: 1,
      desc: 'Inverte o resultado do filho (sucesso ↔ falha).' },
    force_success: { cat: 'decorator', tag: 'ForceSuccess', label: 'Force Success', icon: 'force_success', maxChildren: 1,
      desc: 'Retorna sucesso sempre que o filho terminar.' },
    force_failure: { cat: 'decorator', tag: 'ForceFailure', label: 'Force Fail', icon: 'force_failure', maxChildren: 1,
      desc: 'Retorna falha sempre que o filho terminar.' },

    subtree: { cat: 'subtree', tag: 'SubTree', label: 'SubTree', icon: 'subtree', maxChildren: 0,
      desc: 'Chama outra árvore do projeto. Expanda ou abra para ver os filhos.' },

    unknown: { cat: 'unknown', label: 'Desconhecido', icon: 'unknown', maxChildren: Infinity,
      desc: 'Nó não suportado pelo firmware (preservado na exportação).' }
  };

  var PALETTE = [
    { title: 'Controle', types: ['sequence', 'fallback', 'reactive_sequence', 'reactive_fallback'] },
    { title: 'Ação', types: ['action', 'condition', 'sleep'] },
    { title: 'Decorador', types: ['retry', 'repeat', 'keep_running', 'inverter', 'force_success', 'force_failure'] },
    { title: 'Subárvore', types: ['subtree'] }
  ];

  var TAG_TO_TYPE = {};
  Object.keys(TYPES).forEach(function (t) { if (TYPES[t].tag) TAG_TO_TYPE[TYPES[t].tag] = t; });

  // Strings printed by btree_common_node_type_string() in the firmware.
  var LOG_TYPE_TO_TYPE = {
    'condition': 'condition',
    'action': 'action',
    'action sleep': 'sleep',
    'retry until success': 'retry',
    'repeat': 'repeat',
    'keep running until success': 'keep_running',
    'inverter': 'inverter',
    'force success': 'force_success',
    'force fail': 'force_failure'
  };

  function isControl(type) { return TYPES[type] && TYPES[type].cat === 'control'; }
  function isDecorator(type) { return TYPES[type] && TYPES[type].cat === 'decorator'; }
  function isLeaf(type) { var c = TYPES[type] && TYPES[type].cat; return c === 'action' || c === 'condition'; }
  // Nodes that exist in the compiled firmware array (and therefore print logs).
  function isCompiled(type) { return isLeaf(type) || isDecorator(type); }

  /* ------------------------------------------------------------------ *
   * Ids
   * ------------------------------------------------------------------ */
  var uidCounter = 0;
  var uidPrefix = Math.random().toString(36).slice(2, 6);
  function uid(p) { uidCounter += 1; return (p || 'n') + uidPrefix + uidCounter.toString(36); }

  /* ------------------------------------------------------------------ *
   * Construction
   * ------------------------------------------------------------------ */
  function makeNode(type, props) {
    var t = TYPES[type];
    var node = { id: uid('n'), type: type, parent: null, children: [], props: {} };
    if (t && t.field && t.field.def !== undefined) node.props[t.field.key] = String(t.field.def);
    if (t && t.field && t.field.kind === 'ident') node.props.code = '';
    if (props) Object.keys(props).forEach(function (k) { node.props[k] = props[k]; });
    return node;
  }

  function addNode(tree, node, parentId, index) {
    tree.nodes[node.id] = node;
    node.parent = parentId || null;
    if (parentId) {
      var p = tree.nodes[parentId];
      if (index === undefined || index < 0 || index > p.children.length) p.children.push(node.id);
      else p.children.splice(index, 0, node.id);
    }
    return node;
  }

  function makeTree(name, withDefaultChild) {
    var tree = { id: uid('t'), name: name, rootId: null, nodes: {} };
    var root = makeNode('root');
    addNode(tree, root, null);
    tree.rootId = root.id;
    if (withDefaultChild !== false) addNode(tree, makeNode('action', { code: 'action' }), root.id);
    return tree;
  }

  function makeProject(name) {
    var project = { id: uid('p'), name: name, logName: '', mainTreeId: null, trees: {}, treeOrder: [], meta: {} };
    var main = makeTree('main', true);
    addTreeToProject(project, main);
    project.mainTreeId = main.id;
    return project;
  }

  function addTreeToProject(project, tree) {
    project.trees[tree.id] = tree;
    project.treeOrder.push(tree.id);
    return tree;
  }

  function findTreeByName(project, name) {
    for (var i = 0; i < project.treeOrder.length; i++) {
      var t = project.trees[project.treeOrder[i]];
      if (t && t.name === name) return t;
    }
    return null;
  }

  function uniqueName(base, taken) {
    var name = base, i = 2;
    while (taken.indexOf(name) !== -1) { name = base + '_' + i; i += 1; }
    return name;
  }

  function treeNames(project) { return project.treeOrder.map(function (id) { return project.trees[id].name; }); }

  /* ------------------------------------------------------------------ *
   * Tree editing helpers (all pure mutations on the tree object)
   * ------------------------------------------------------------------ */
  function canAcceptChild(tree, parentId, childType) {
    var p = tree.nodes[parentId];
    if (!p) return false;
    var t = TYPES[p.type];
    if (!t || t.maxChildren === 0) return false;
    if (childType === 'root') return false;
    return p.children.length < t.maxChildren;
  }

  function isAncestor(tree, maybeAncestorId, nodeId) {
    var cur = tree.nodes[nodeId];
    while (cur) {
      if (cur.id === maybeAncestorId) return true;
      cur = cur.parent ? tree.nodes[cur.parent] : null;
    }
    return false;
  }

  function detach(tree, nodeId) {
    var n = tree.nodes[nodeId];
    if (!n || !n.parent) return -1;
    var p = tree.nodes[n.parent];
    var idx = p.children.indexOf(nodeId);
    if (idx >= 0) p.children.splice(idx, 1);
    n.parent = null;
    return idx;
  }

  function attach(tree, nodeId, parentId, index) {
    var n = tree.nodes[nodeId];
    var p = tree.nodes[parentId];
    n.parent = parentId;
    if (index === undefined || index < 0 || index > p.children.length) p.children.push(nodeId);
    else p.children.splice(index, 0, nodeId);
  }

  // Move node to (parentId, index). Returns false if not allowed.
  function moveNode(tree, nodeId, parentId, index) {
    var n = tree.nodes[nodeId];
    if (!n || n.type === 'root') return false;
    if (isAncestor(tree, nodeId, parentId)) return false;
    var sameParent = n.parent === parentId;
    if (!sameParent && !canAcceptChild(tree, parentId, n.type)) return false;
    var oldIdx = detach(tree, nodeId);
    if (sameParent && index !== undefined && oldIdx >= 0 && oldIdx < index) index -= 1;
    attach(tree, nodeId, parentId, index);
    return true;
  }

  function collectSubtree(tree, nodeId) {
    var out = [];
    var stack = [nodeId];
    while (stack.length) {
      var id = stack.pop();
      var n = tree.nodes[id];
      if (!n) continue;
      out.push(id);
      for (var i = 0; i < n.children.length; i++) stack.push(n.children[i]);
    }
    return out;
  }

  function deleteNode(tree, nodeId, keepChildren) {
    var n = tree.nodes[nodeId];
    if (!n || n.type === 'root') return false;
    var parent = tree.nodes[n.parent];
    var idx = detach(tree, nodeId);
    if (keepChildren && parent) {
      // Splice the children into the parent's place (only if the parent can hold them).
      var room = TYPES[parent.type].maxChildren - parent.children.length;
      if (n.children.length <= room) {
        n.children.slice().forEach(function (cid, k) { attach(tree, cid, parent.id, idx + k); });
        n.children = [];
      }
    }
    collectSubtree(tree, nodeId).forEach(function (id) { delete tree.nodes[id]; });
    return true;
  }

  // Loose ("solto") nodes: branch roots without a parent, kept in tree.nodes with a canvas position.
  // They are allowed while editing but block saving/exporting until linked to the tree.
  function looseRoots(tree) {
    return Object.keys(tree.nodes).filter(function (id) { var n = tree.nodes[id]; return n.type !== 'root' && !n.parent; });
  }

  function looseNodes(project) {
    var out = [];
    project.treeOrder.forEach(function (tid) {
      var tree = project.trees[tid];
      looseRoots(tree).forEach(function (id) { out.push({ tree: tree, node: tree.nodes[id] }); });
    });
    return out;
  }

  function floatNode(tree, nodeId, pos) {
    var n = tree.nodes[nodeId];
    if (!n || n.type === 'root') return false;
    detach(tree, nodeId);
    n.pos = { x: Math.round(pos.x), y: Math.round(pos.y) };
    return true;
  }

  // Link nodeId (loose or not) under parentId; clears its free position.
  function linkNode(tree, nodeId, parentId, index) {
    if (!moveNode(tree, nodeId, parentId, index)) return false;
    delete tree.nodes[nodeId].pos;
    return true;
  }

  // Serializable copy of a branch: { type, props, children: [...] }
  function exportBranch(tree, nodeId) {
    var n = tree.nodes[nodeId];
    return { type: n.type, props: JSON.parse(JSON.stringify(n.props)), children: n.children.map(function (c) { return exportBranch(tree, c); }) };
  }

  // Copy of a selection: only the chosen nodes, keeping the links between them.
  // Returns a forest: one branch per selected node whose parent is not selected.
  function exportSelection(tree, ids) {
    var sel = {};
    ids.forEach(function (id) { if (tree.nodes[id] && tree.nodes[id].type !== 'root') sel[id] = true; });
    function br(id) {
      var n = tree.nodes[id];
      return { type: n.type, props: JSON.parse(JSON.stringify(n.props)), children: n.children.filter(function (c) { return sel[c]; }).map(br) };
    }
    return Object.keys(sel).filter(function (id) { return !sel[tree.nodes[id].parent]; }).map(br);
  }

  // Removes only the given nodes (never their branches): surviving children become loose at posOf(childId).
  function deleteOnly(tree, ids, posOf) {
    var gone = {};
    ids.forEach(function (id) { if (tree.nodes[id] && tree.nodes[id].type !== 'root') gone[id] = true; });
    var list = Object.keys(gone);
    list.forEach(function (id) {
      tree.nodes[id].children.slice().forEach(function (c) { if (!gone[c]) floatNode(tree, c, posOf(c)); });
    });
    list.forEach(function (id) { detach(tree, id); });
    list.forEach(function (id) { delete tree.nodes[id]; });
    return list.length > 0;
  }

  function importBranch(tree, branch, parentId, index) {
    var node = makeNode(branch.type, branch.props);
    addNode(tree, node, parentId, index);
    (branch.children || []).forEach(function (b) { importBranch(tree, b, node.id); });
    return node;
  }

  // Wrap nodeId with a new parent of type wrapType (decorator or control).
  function wrapNode(tree, nodeId, wrapType) {
    var n = tree.nodes[nodeId];
    if (!n || n.type === 'root' || !n.parent) return null;
    var parentId = n.parent;
    var idx = detach(tree, nodeId);
    var w = makeNode(wrapType);
    addNode(tree, w, parentId, idx);
    attach(tree, nodeId, w.id);
    return w;
  }

  function changeType(tree, nodeId, newType) {
    var n = tree.nodes[nodeId];
    if (!n || n.type === 'root' || newType === 'root' || !TYPES[newType]) return false;
    var oldT = TYPES[n.type], newT = TYPES[newType];
    if (n.children.length > newT.maxChildren) return false;
    var keep = {};
    if (n.props.label) keep.label = n.props.label;
    if (oldT.field && newT.field && oldT.field.kind === newT.field.kind) keep[newT.field.key] = n.props[oldT.field.key];
    n.type = newType;
    n.props = keep;
    if (newT.field && keep[newT.field.key] === undefined) {
      if (newT.field.def !== undefined) n.props[newT.field.key] = String(newT.field.def);
      else n.props[newT.field.key] = '';
    }
    return true;
  }

  /* ------------------------------------------------------------------ *
   * Minimal XML parser (works in browsers and Node; no DOM needed)
   * ------------------------------------------------------------------ */
  function decodeEntities(s) {
    return s.replace(/&(#x[0-9a-fA-F]+|#\d+|lt|gt|amp|quot|apos);/g, function (m, e) {
      if (e === 'lt') return '<';
      if (e === 'gt') return '>';
      if (e === 'amp') return '&';
      if (e === 'quot') return '"';
      if (e === 'apos') return "'";
      if (e[1] === 'x') return String.fromCharCode(parseInt(e.slice(2), 16));
      return String.fromCharCode(parseInt(e.slice(1), 10));
    });
  }

  function escapeXml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function parseXml(text) {
    var pos = 0, len = text.length;
    var rootEl = { tag: '#document', attrs: {}, children: [] };
    var stack = [rootEl];
    function err(msg) {
      var line = text.slice(0, pos).split('\n').length;
      throw new Error('XML inválido (linha ' + line + '): ' + msg);
    }
    while (pos < len) {
      var lt = text.indexOf('<', pos);
      if (lt < 0) break;
      pos = lt;
      if (text.startsWith('<!--', pos)) {
        var endC = text.indexOf('-->', pos);
        if (endC < 0) err('comentário não fechado');
        pos = endC + 3;
      } else if (text.startsWith('<?', pos)) {
        var endP = text.indexOf('?>', pos);
        if (endP < 0) err('instrução não fechada');
        pos = endP + 2;
      } else if (text.startsWith('<![CDATA[', pos)) {
        var endD = text.indexOf(']]>', pos);
        if (endD < 0) err('CDATA não fechado');
        pos = endD + 3;
      } else if (text.startsWith('<!', pos)) {
        var endB = text.indexOf('>', pos);
        pos = endB < 0 ? len : endB + 1;
      } else if (text[pos + 1] === '/') {
        var endT = text.indexOf('>', pos);
        if (endT < 0) err('tag não fechada');
        var closeName = text.slice(pos + 2, endT).trim();
        var top = stack.pop();
        if (!top || top.tag !== closeName) err('esperado </' + (top ? top.tag : '?') + '>, encontrado </' + closeName + '>');
        pos = endT + 1;
      } else {
        var m = /^<([A-Za-z_][\w:.-]*)/.exec(text.slice(pos, pos + 200));
        if (!m) err('tag inválida');
        var el = { tag: m[1], attrs: {}, children: [] };
        pos += m[0].length;
        var attrRe = /\s*([A-Za-z_][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')|\s*(\/?)>/y;
        var selfClosing = false, closed = false;
        while (pos < len) {
          attrRe.lastIndex = pos;
          var a = attrRe.exec(text);
          if (!a) err('atributo inválido em <' + el.tag + '>');
          pos = attrRe.lastIndex;
          if (a[1]) { el.attrs[a[1]] = decodeEntities(a[3] !== undefined ? a[3] : a[4]); continue; }
          selfClosing = a[5] === '/';
          closed = true;
          break;
        }
        if (!closed) err('tag <' + el.tag + '> não fechada');
        stack[stack.length - 1].children.push(el);
        if (!selfClosing) stack.push(el);
      }
    }
    if (stack.length !== 1) err('tag <' + stack[stack.length - 1].tag + '> não fechada');
    return rootEl;
  }

  /* ------------------------------------------------------------------ *
   * Import / export (BehaviorTree.CPP v4 format, Groot2 compatible)
   * ------------------------------------------------------------------ */
  function elementToNode(tree, el, parentId, refs) {
    var type = TAG_TO_TYPE[el.tag] || 'unknown';
    var t = TYPES[type];
    var props = {};
    var extra = {};
    Object.keys(el.attrs).forEach(function (k) {
      var v = el.attrs[k];
      if (k === 'name') props.label = v;
      else if (t.field && k === t.field.attr) props[t.field.key] = v;
      else if (type === 'subtree' && k === 'ID') props.ref = v;
      else extra[k] = v;
    });
    if (type === 'unknown') props.tag = el.tag;
    if (Object.keys(extra).length) props.extra = extra;
    var node = makeNode(type);
    node.props = props;
    if (t.field && props[t.field.key] === undefined) props[t.field.key] = '';
    addNode(tree, node, parentId);
    if (type === 'subtree') refs.push(node);
    el.children.forEach(function (c) { elementToNode(tree, c, node.id, refs); });
    return node;
  }

  // Returns { name, mainTreeName, trees: [tree] } ; SubTree refs resolved to tree ids.
  function importXml(text, fallbackName) {
    var doc = parseXml(text);
    var rootEl = doc.children.find(function (c) { return c.tag === 'root'; });
    if (!rootEl) throw new Error('Arquivo sem elemento <root>.');
    var bts = rootEl.children.filter(function (c) { return c.tag === 'BehaviorTree'; });
    var includes = rootEl.children.filter(function (c) { return c.tag === 'include'; }).map(function (c) { return c.attrs.path; });
    var trees = [];
    var refs = [];
    bts.forEach(function (bt, i) {
      var tree = makeTree(bt.attrs.ID || ('tree_' + (i + 1)), false);
      bt.children.forEach(function (c) { elementToNode(tree, c, tree.rootId, refs); });
      if (bt.attrs.name) tree.nodes[tree.rootId].props.label = bt.attrs.name;
      trees.push(tree);
    });
    var byName = {};
    trees.forEach(function (t) { byName[t.name] = t; });
    refs.forEach(function (n) {
      var refName = n.props.ref || '';
      var target = byName[refName];
      n.props.ref = target ? target.id : '';
      if (!target) n.props.missingRef = refName;
    });
    var mainName = rootEl.attrs.main_tree_to_execute || '';
    if (!mainName || !byName[mainName]) {
      if (byName.main) mainName = 'main';
      else if (byName.MainTree) mainName = 'MainTree';
      else {
        // first tree not referenced by any other tree
        var referenced = {};
        refs.forEach(function (n) { if (n.props.ref) referenced[n.props.ref] = true; });
        var candidate = trees.find(function (t) { return !referenced[t.id]; });
        mainName = candidate ? candidate.name : (trees[0] ? trees[0].name : '');
      }
    }
    return {
      name: rootEl.attrs.project_name || fallbackName || 'Projeto',
      mainTreeName: mainName,
      trees: trees,
      includes: includes
    };
  }

  // Resolve SubTree refs by name, used when merging several files.
  function resolveRefsByName(project, pendingNames) {
    Object.keys(project.trees).forEach(function (tid) {
      var tree = project.trees[tid];
      Object.keys(tree.nodes).forEach(function (nid) {
        var n = tree.nodes[nid];
        if (n.type === 'subtree' && !n.props.ref && n.props.missingRef) {
          var t = findTreeByName(project, n.props.missingRef);
          if (t) { n.props.ref = t.id; delete n.props.missingRef; }
        }
      });
    });
  }

  function projectFromImport(imp, name) {
    var project = { id: uid('p'), name: name || imp.name, logName: '', mainTreeId: null, trees: {}, treeOrder: [], meta: {} };
    imp.trees.forEach(function (t) { addTreeToProject(project, t); });
    var main = findTreeByName(project, imp.mainTreeName);
    if (!main) {
      main = makeTree('main', true);
      addTreeToProject(project, main);
    }
    project.mainTreeId = main.id;
    resolveRefsByName(project);
    return project;
  }

  function nodeToXml(project, tree, nodeId, depth, out) {
    var n = tree.nodes[nodeId];
    var t = TYPES[n.type];
    var pad = new Array(depth + 1).join('  ');
    var tag = n.type === 'unknown' ? (n.props.tag || 'Unknown') : t.tag;
    var attrs = '';
    if (n.type === 'subtree') {
      var ref = project.trees[n.props.ref];
      attrs += ' ID="' + escapeXml(ref ? ref.name : (n.props.missingRef || '')) + '"';
    }
    if (n.props.label) attrs += ' name="' + escapeXml(n.props.label) + '"';
    if (t.field) attrs += ' ' + t.field.attr + '="' + escapeXml(n.props[t.field.key] || '') + '"';
    if (n.props.extra) Object.keys(n.props.extra).forEach(function (k) { attrs += ' ' + k + '="' + escapeXml(n.props.extra[k]) + '"'; });
    if (!n.children.length) { out.push(pad + '<' + tag + attrs + '/>'); return; }
    out.push(pad + '<' + tag + attrs + '>');
    n.children.forEach(function (c) { nodeToXml(project, tree, c, depth + 1, out); });
    out.push(pad + '</' + tag + '>');
  }

  function exportXml(project) {
    var out = [];
    var main = project.trees[project.mainTreeId];
    out.push('<?xml version="1.0" encoding="UTF-8"?>');
    out.push('<root BTCPP_format="4"' + (main ? ' main_tree_to_execute="' + escapeXml(main.name) + '"' : '') +
      ' project_name="' + escapeXml(project.name) + '">');
    var order = project.treeOrder.slice();
    // main tree first
    order.sort(function (a, b) { return (a === project.mainTreeId ? -1 : 0) - (b === project.mainTreeId ? -1 : 0); });
    order.forEach(function (tid) {
      var tree = project.trees[tid];
      var root = tree.nodes[tree.rootId];
      out.push('  <BehaviorTree ID="' + escapeXml(tree.name) + '">');
      root.children.forEach(function (c) { nodeToXml(project, tree, c, 2, out); });
      out.push('  </BehaviorTree>');
      out.push('');
    });
    out.push('  <!-- Description of Node Models (used by Groot) -->');
    out.push('  <TreeNodesModel/>');
    out.push('</root>');
    return out.join('\n') + '\n';
  }

  /* ------------------------------------------------------------------ *
   * Firmware order: index printed as "Node: %d" in the log.
   * Same order produced by Scripts/btree_array_creator.py: pre-order walk,
   * only leaves (action/condition/sleep) and decorators are numbered,
   * control nodes and Root are dropped, SubTrees are inlined.
   * Each entry: { treeId, nodeId, ctx, end } (end = index of its last compiled descendant) where ctx identifies the SubTree
   * instance path ("" for the main tree, "/<subtreeNodeId>/..." inside).
   * ------------------------------------------------------------------ */
  function compiledOrder(project, startTreeId) {
    var order = [];
    var tree0 = project.trees[startTreeId || project.mainTreeId];
    if (!tree0) return order;
    function visit(tree, nodeId, ctx, depth) {
      var n = tree.nodes[nodeId];
      if (!n || depth > 64) return;
      if (n.type === 'subtree') {
        var ref = project.trees[n.props.ref];
        if (ref) visit(ref, ref.rootId, ctx + '/' + n.id, depth + 1);
        return;
      }
      var e = isCompiled(n.type) ? { treeId: tree.id, nodeId: n.id, ctx: ctx } : null;
      if (e) order.push(e);
      for (var i = 0; i < n.children.length; i++) visit(tree, n.children[i], ctx, depth + 1);
      if (e) e.end = order.length - 1;
    }
    visit(tree0, tree0.rootId, '', 0);
    linkTargets(project, tree0, order);
    return order;
  }

  /* Next node after each compiled node, exactly as Scripts/ flattens the tree: e.st on SUCCESS,
   * e.ft on FAIL, -1 (BTREE_DEFINITION_TREE_UNRELATED) when the whole tree ends there.
   * A decorator's child always returns to the decorator. */
  function linkTargets(project, tree0, order) {
    var at = {};
    order.forEach(function (e, i) { at[e.ctx + '|' + e.nodeId] = i; });
    function first(tree, nodeId, ctx, depth) {
      var n = tree.nodes[nodeId];
      if (!n || depth > 64) return null;
      if (n.type === 'subtree') {
        var ref = project.trees[n.props.ref];
        return ref ? first(ref, ref.rootId, ctx + '/' + n.id, depth + 1) : null;
      }
      if (isCompiled(n.type)) return at[ctx + '|' + n.id];
      for (var i = 0; i < n.children.length; i++) {
        var f = first(tree, n.children[i], ctx, depth + 1);
        if (f !== null && f !== undefined) return f;
      }
      return null;
    }
    function link(tree, nodeId, ctx, onS, onF, depth) {
      var n = tree.nodes[nodeId];
      if (!n || depth > 64) return;
      if (n.type === 'subtree') {
        var ref = project.trees[n.props.ref];
        if (ref) link(ref, ref.rootId, ctx + '/' + n.id, onS, onF, depth + 1);
        return;
      }
      if (isCompiled(n.type)) {
        var idx = at[ctx + '|' + n.id];
        order[idx].st = onS;
        order[idx].ft = onF;
        if (n.children.length) link(tree, n.children[0], ctx, idx, idx, depth + 1);
        return;
      }
      var isFallback = n.type === 'fallback' || n.type === 'reactive_fallback';
      for (var i = 0; i < n.children.length; i++) {
        var next = null;
        for (var j = i + 1; j < n.children.length && (next === null || next === undefined); j++) next = first(tree, n.children[j], ctx, depth + 1);
        var hasNext = next !== null && next !== undefined;
        if (n.type === 'root') link(tree, n.children[i], ctx, onS, onF, depth + 1);
        else if (isFallback) link(tree, n.children[i], ctx, onS, hasNext ? next : onF, depth + 1);
        else link(tree, n.children[i], ctx, hasNext ? next : onS, onF, depth + 1);
      }
    }
    link(tree0, tree0.rootId, '', -1, -1, 0);
  }

  /* ------------------------------------------------------------------ *
   * Validation
   * ------------------------------------------------------------------ */
  function fieldError(type, value) {
    var f = TYPES[type].field;
    if (!f) return null;
    var v = value === undefined || value === null ? '' : String(value).trim();
    if (f.kind === 'ident') {
      if (!v) return 'Nome da função é obrigatório.';
      if (!C_IDENT_RE.test(v)) return 'Nome de função inválido em C: use letras, números e _ (sem começar com número).';
      return null;
    }
    if (f.kind === 'uint') {
      if (!v) return f.label + ' é obrigatório.';
      if (!/^\d+$/.test(v)) return f.label + ' deve conter apenas números.';
      var num = Number(v);
      if (num < f.min) return f.label + ' deve ser no mínimo ' + f.min + '.';
      if (num > f.max) return f.label + ' deve ser no máximo ' + f.max + '.';
    }
    return null;
  }

  function subtreeCycle(project) {
    // returns a set of tree ids that are part of a SubTree cycle
    var inCycle = {};
    var state = {};
    function deps(tree) {
      var out = [];
      Object.keys(tree.nodes).forEach(function (nid) {
        var n = tree.nodes[nid];
        if (n.type === 'subtree' && project.trees[n.props.ref]) out.push(n.props.ref);
      });
      return out;
    }
    function dfs(tid, path) {
      if (state[tid] === 1) {
        path.slice(path.indexOf(tid)).forEach(function (x) { inCycle[x] = true; });
        return;
      }
      if (state[tid] === 2) return;
      state[tid] = 1;
      path.push(tid);
      deps(project.trees[tid]).forEach(function (d) { dfs(d, path); });
      path.pop();
      state[tid] = 2;
    }
    project.treeOrder.forEach(function (tid) { dfs(tid, []); });
    return inCycle;
  }

  // Returns [{ level: 'error'|'warning', treeId, nodeId, message }]
  function validateProject(project) {
    var issues = [];
    var cycles = subtreeCycle(project);
    var names = {};
    if (!project.trees[project.mainTreeId]) issues.push({ level: 'error', message: 'O projeto não possui árvore principal.' });
    if (!C_IDENT_RE.test(project.name)) issues.push({ level: 'warning', message: 'Nome do projeto "' + project.name + '" não é um identificador C válido (usado nos nomes gerados).' });
    project.treeOrder.forEach(function (tid) {
      var tree = project.trees[tid];
      if (names[tree.name]) issues.push({ level: 'error', treeId: tid, message: 'Nome de árvore duplicado: ' + tree.name });
      names[tree.name] = true;
      if (!C_IDENT_RE.test(tree.name)) issues.push({ level: 'error', treeId: tid, nodeId: tree.rootId, message: 'Nome de árvore inválido: "' + tree.name + '" (use letras, números e _).' });
      if (cycles[tid]) issues.push({ level: 'error', treeId: tid, nodeId: tree.rootId, message: 'A árvore ' + tree.name + ' chama a si mesma via SubTree (ciclo).' });
      Object.keys(tree.nodes).forEach(function (nid) {
        var n = tree.nodes[nid];
        var t = TYPES[n.type];
        var where = { treeId: tid, nodeId: nid };
        function add(level, msg) { issues.push(Object.assign({ level: level, message: msg }, where)); }
        if (n.type === 'root') {
          if (n.children.length === 0) add('error', tree.name + ': a Root precisa de 1 filho.');
          if (n.children.length > 1) add('error', tree.name + ': a Root aceita apenas 1 filho.');
        } else if (t.cat === 'control') {
          if (n.children.length === 0) add('error', t.label + (n.props.label ? ' "' + n.props.label + '"' : '') + ' precisa de pelo menos 1 filho.');
        } else if (t.cat === 'decorator') {
          if (n.children.length !== 1) add('error', t.label + ' precisa de exatamente 1 filho.');
        } else if (n.type === 'subtree') {
          if (!project.trees[n.props.ref]) add('error', 'SubTree sem árvore válida' + (n.props.missingRef ? ' ("' + n.props.missingRef + '" não existe)' : '') + '.');
        } else if (n.type === 'unknown') {
          add('warning', 'Nó <' + n.props.tag + '> não é suportado pelo firmware.');
        }
        if (n.type !== 'root' && !n.parent) add('error', tree.name + ': ' + t.label + (t.field && n.props[t.field.key] ? ' "' + n.props[t.field.key] + '"' : '') + ' está solto — ligue-o a um pai para poder salvar.');
        var fe = fieldError(n.type, t.field ? n.props[t.field.key] : undefined);
        if (fe) add('error', fe);
      });
    });
    return issues;
  }

  /* ------------------------------------------------------------------ *
   * Log line parsing: [BTREE] | Tree: %s | Node: %d | Status: %s | Type: %s | Function: %s
   * ------------------------------------------------------------------ */
  var LOG_RE = /\[BTREE\]\s*\|\s*Tree:\s*([^|]*?)\s*\|\s*Node:\s*(\d+)\s*\|\s*Status:\s*([^|]*?)\s*\|\s*Type:\s*([^|]*?)\s*(?:\|\s*Function:\s*([^|]*?)\s*)?$/;

  function normalizeStatus(raw) {
    var s = String(raw || '').toLowerCase().replace(/[\s_-]/g, '');
    if (s.indexOf('run') === 0) return 'running';
    if (s.indexOf('reexec') === 0) return 'running';
    if (s.indexOf('succ') === 0) return 'success';
    if (s.indexOf('fail') === 0) return 'fail';
    if (s.indexOf('err') === 0) return 'fail';
    if (s.indexOf('stand') === 0) return 'standby';
    return 'standby';
  }

  function parseLogLine(line) {
    // strip ANSI escape codes and trailing CR
    var clean = String(line).replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').replace(/\r/g, '');
    var m = LOG_RE.exec(clean);
    if (!m) return null;
    var rawType = m[4].trim();
    var reactive = /^reactive\s+/i.test(rawType);
    var baseType = rawType.replace(/^reactive\s+/i, '').toLowerCase();
    return {
      tree: m[1].trim(),
      index: parseInt(m[2], 10),
      rawStatus: m[3].trim(),
      status: normalizeStatus(m[3]),
      rawType: rawType,
      type: LOG_TYPE_TO_TYPE[baseType] || null,
      reactive: reactive,
      fn: m[5] ? m[5].trim() : null
    };
  }

  var LOG_STATUS_TEXT = { running: 'Running', success: 'Success', fail: 'Fail', standby: 'Stand by' };
  var LOG_TYPE_TEXT = {
    condition: 'Condition', action: 'Action', sleep: 'Action Sleep', retry: 'Retry Until Success', repeat: 'Repeat',
    keep_running: 'Keep Running Until Success', inverter: 'Inverter', force_success: 'Force Success', force_failure: 'Force Fail'
  };

  function formatLogLine(treeName, index, status, type, fn) {
    var s = '[BTREE] | Tree: ' + treeName + ' | Node: ' + index + ' | Status: ' + (LOG_STATUS_TEXT[status] || status) +
      ' | Type: ' + (LOG_TYPE_TEXT[type] || type);
    if (fn) s += ' | Function: ' + fn;
    return s;
  }

  // Name printed as "Tree:" by the firmware: project name in upper case.
  function logNameOf(project) { return (project.logName || project.name || '').toUpperCase(); }

  /* ------------------------------------------------------------------ *
   * (De)serialization of the whole workspace (localStorage)
   * ------------------------------------------------------------------ */
  function cloneProject(p) { return JSON.parse(JSON.stringify(p)); }

  var BTModel = {
    UINT32_MAX: UINT32_MAX, UINT16_MAX: UINT16_MAX, C_IDENT_RE: C_IDENT_RE,
    TYPES: TYPES, PALETTE: PALETTE, TAG_TO_TYPE: TAG_TO_TYPE, LOG_TYPE_TO_TYPE: LOG_TYPE_TO_TYPE,
    isControl: isControl, isDecorator: isDecorator, isLeaf: isLeaf, isCompiled: isCompiled,
    uid: uid, makeNode: makeNode, addNode: addNode, makeTree: makeTree, makeProject: makeProject,
    addTreeToProject: addTreeToProject, findTreeByName: findTreeByName, uniqueName: uniqueName, treeNames: treeNames,
    canAcceptChild: canAcceptChild, isAncestor: isAncestor, moveNode: moveNode, deleteNode: deleteNode,
    looseRoots: looseRoots, looseNodes: looseNodes, floatNode: floatNode, linkNode: linkNode,
    collectSubtree: collectSubtree, exportBranch: exportBranch, exportSelection: exportSelection, deleteOnly: deleteOnly, importBranch: importBranch, wrapNode: wrapNode,
    changeType: changeType, parseXml: parseXml, importXml: importXml, projectFromImport: projectFromImport,
    resolveRefsByName: resolveRefsByName, exportXml: exportXml, escapeXml: escapeXml,
    compiledOrder: compiledOrder, validateProject: validateProject, fieldError: fieldError,
    parseLogLine: parseLogLine, formatLogLine: formatLogLine, normalizeStatus: normalizeStatus, logNameOf: logNameOf,
    cloneProject: cloneProject
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = BTModel;
  global.BTModel = BTModel;
})(typeof window !== 'undefined' ? window : globalThis);
