/* BTree Studio - right panel: node/tree/project properties (Editor) and live info (Monitor). */
(function () {
  'use strict';
  var M = window.BTModel, Store = window.BTStore, UI = window.BTUI, I = window.BTIcons;
  var S = Store.S, T = M.TYPES, el = UI.el;
  var box;
  var renderedFor = null;

  function section(title, children, extraClass) {
    return el('section', { class: 'insp-sec ' + (extraClass || '') }, [title ? el('h4', { text: title }) : null].concat(children));
  }

  // Collapsible section ("submenu"): secondary info stays out of the way; open state is remembered.
  var folds = {};
  function fold(title, children, defaultOpen) {
    var d = el('details', { class: 'insp-sec' }, [el('summary', { text: title })].concat(children));
    d.open = title in folds ? folds[title] : !!defaultOpen;
    d.addEventListener('toggle', function () { folds[title] = d.open; });
    return d;
  }

  function field(label, input, opts) {
    opts = opts || {};
    var err = el('div', { class: 'field-error' });
    var wrapEl = el('label', { class: 'field' }, [
      el('span', { class: 'flabel', html: UI.esc(label) + (opts.required ? ' <em>*</em>' : '') }),
      input,
      opts.hint ? el('div', { class: 'hint', html: opts.hint }) : null,
      err
    ]);
    wrapEl.setError = function (msg) { err.textContent = msg || ''; input.classList.toggle('invalid', !!msg); };
    return wrapEl;
  }

  function humanMs(v) {
    var ms = Number(v);
    if (!v || isNaN(ms)) return '';
    if (ms < 1000) return ms + ' ms';
    var parts = [];
    var d = Math.floor(ms / 86400000); ms %= 86400000;
    var h = Math.floor(ms / 3600000); ms %= 3600000;
    var m = Math.floor(ms / 60000); ms %= 60000;
    var s = ms / 1000;
    if (d) parts.push(d + ' d');
    if (h) parts.push(h + ' h');
    if (m) parts.push(m + ' min');
    if (s) parts.push((Math.round(s * 1000) / 1000).toString().replace('.', ',') + ' s');
    return '= ' + parts.join(' ');
  }

  function cName(project, tree, code) {
    return 'btree_' + project.name.toLowerCase() + '_' + tree.name + '_' + (code || '…');
  }

  /* ------------------------------------------------------------------ *
   * Editor: node properties
   * ------------------------------------------------------------------ */
  var focusTarget = null;

  function renderNode(v, project) {
    var n = v.node, t = T[n.type];
    var parts = [];
    parts.push(el('div', { class: 'insp-head cat-' + t.cat }, [
      el('span', { class: 'big-icon', html: I.icon(t.icon, 20) }),
      el('div', {}, [el('div', { class: 'insp-title', text: t.label }), el('div', { class: 'insp-sub', text: v.tree.name + (v.readonly ? ' (read-only here)' : '') })])
    ]));
    parts.push(el('p', { class: 'insp-desc', text: t.desc }));
    var ro = v.readonly || S.mode !== 'editor';

    if (v.readonly) {
      parts.push(el('div', { class: 'callout' }, [
        el('span', { html: I.icon('info', 16) }),
        el('span', { text: 'This node belongs to the subtree "' + v.tree.name + '". Open it to edit.' })
      ]));
      parts.push(el('button', { class: 'btn', html: I.icon('external', 15) + 'Open ' + UI.esc(v.tree.name), onclick: function () {
        var h = v; while (h && !h.subtreeHost) h = h.parent;
        if (h) window.BTCanvas.openSubtree(h.subtreeHost);
      } }));
    }

    var fields = [];
    if (t.cat === 'control') {
      var lab = el('input', { class: 'input', value: n.props.label || '', placeholder: 'e.g. Patrol', disabled: ro, spellcheck: 'false' });
      lab.addEventListener('input', function () {
        Store.mutate(project.id, function () { if (lab.value.trim()) n.props.label = lab.value; else delete n.props.label; }, 'label:' + n.id);
      });
      fields.push(field('Branch label (optional)', lab, { hint: 'Only to identify this branch in the diagram.' }));
      focusTarget = lab;
    }
    if (t.field && t.field.kind === 'ident') {
      var inp = el('input', { class: 'input mono', value: n.props.code || '', placeholder: t.field.placeholder, disabled: ro, spellcheck: 'false', autocomplete: 'off' });
      var preview = el('code', { class: 'cpreview', text: cName(project, v.tree, n.props.code) });
      var f = field(t.field.label, inp, { required: true });
      f.appendChild(el('div', { class: 'hint' }, ['Generated function: ', preview]));
      var check = function () { f.setError(M.fieldError(n.type, inp.value)); preview.textContent = cName(project, v.tree, inp.value.trim()); };
      inp.addEventListener('input', function () {
        // spaces are never valid in C names: convert them on the fly
        if (/\s/.test(inp.value)) { var pos = inp.selectionStart; inp.value = inp.value.replace(/\s/g, '_'); inp.setSelectionRange(pos, pos); }
        check();
        Store.mutate(project.id, function () { n.props.code = inp.value.trim(); }, 'code:' + n.id);
      });
      check();
      fields.push(f);
      focusTarget = inp;
      // suggestions: function names already used in the project
      var used = {};
      project.treeOrder.forEach(function (tid) {
        var tr = project.trees[tid];
        Object.keys(tr.nodes).forEach(function (nid) { var x = tr.nodes[nid]; if (x.type === n.type && x.props.code && x.id !== n.id) used[x.props.code] = true; });
      });
      var names = Object.keys(used).sort();
      if (names.length && !ro) {
        var dl = el('datalist', { id: 'dl-' + n.id });
        names.forEach(function (nm) { dl.appendChild(el('option', { value: nm })); });
        inp.setAttribute('list', dl.id);
        f.appendChild(dl);
      }
    }
    if (t.field && t.field.kind === 'uint') {
      var human = el('span', { class: 'human' });
      var fu;
      var input = UI.uintInput(n.props[t.field.key] || '', t.field.min, t.field.max, function (val) {
        fu.setError(M.fieldError(n.type, val));
        human.textContent = n.type === 'sleep' ? humanMs(val) : '';
        Store.mutate(project.id, function () { n.props[t.field.key] = val; }, 'num:' + n.id);
      });
      input.disabled = ro;
      var row = el('div', { class: 'with-unit' }, [input, el('span', { class: 'unit', text: t.field.unit })]);
      fu = field(t.field.label, row, {
        required: true,
        hint: 'Digits only, from ' + t.field.min + ' to ' + t.field.max.toLocaleString('en-US') +
          (n.type === 'sleep' ? ' (uint32).' : ' (uint16, firmware limit).') + ' Use ↑/↓ to adjust.'
      });
      fu.setError = (function (orig) { return function (msg) { orig(msg); input.classList.toggle('invalid', !!msg); }; })(fu.setError);
      fu.setError(M.fieldError(n.type, n.props[t.field.key]));
      human.textContent = n.type === 'sleep' ? humanMs(n.props[t.field.key]) : '';
      fu.insertBefore(human, fu.querySelector('.field-error'));
      fields.push(fu);
      focusTarget = input;
    }
    if (n.type === 'subtree') {
      var sel = el('select', { class: 'input', disabled: ro });
      sel.appendChild(el('option', { value: '', text: '(choose the tree)' }));
      project.treeOrder.forEach(function (tid) {
        var tr = project.trees[tid];
        if (tr.id === v.tree.id) return;
        sel.appendChild(el('option', { value: tr.id, text: (tr.id === project.mainTreeId ? '★ ' : '') + tr.name }));
      });
      sel.value = project.trees[n.props.ref] ? n.props.ref : '';
      sel.addEventListener('change', function () {
        Store.mutate(project.id, function () { n.props.ref = sel.value; delete n.props.missingRef; });
      });
      var fsub = field('Called tree', sel, { required: true });
      if (n.props.missingRef && !project.trees[n.props.ref]) fsub.setError('The tree "' + n.props.missingRef + '" does not exist in this project.');
      fields.push(fsub);
      focusTarget = sel;
      var actions = el('div', { class: 'btn-row' }, [
        el('button', { class: 'btn sm', disabled: !project.trees[n.props.ref], html: I.icon('external', 14) + 'Open', onclick: function () { window.BTCanvas.openSubtree(v); } }),
        el('button', { class: 'btn sm', disabled: !project.trees[n.props.ref], html: I.icon(v.expanded ? 'collapse' : 'expand', 14) + (v.expanded ? 'Collapse' : 'Expand here'), onclick: function () { window.BTCanvas.toggleExpand(v); } }),
        ro ? null : el('button', { class: 'btn sm', html: I.icon('plus', 14) + 'New tree', onclick: function () {
          window.BTApp.newTree(project.id, false).then(function (tr) {
            if (tr) Store.mutate(project.id, function () { n.props.ref = tr.id; delete n.props.missingRef; });
          });
        } })
      ]);
      fields.push(actions);
    }
    if (n.type === 'root') {
      var isMain = v.tree.id === project.mainTreeId;
      fields.push(el('div', { class: 'kv' }, [
        el('span', { text: 'Tree' }), el('b', { text: v.tree.name }),
        el('span', { text: 'Role' }), el('b', { html: isMain ? I.icon('star', 13, 'star') + ' Main' : 'Subtree' })
      ]));
    }
    if (n.type === 'unknown') {
      fields.push(el('div', { class: 'kv' }, [el('span', { text: 'Tag XML' }), el('b', { class: 'mono', text: '<' + n.props.tag + '>' })]));
    }
    if (fields.length) parts.push(section('Properties', fields));

    // structure / quick actions
    if (!ro && n.type !== 'root') {
      var C = window.BTCanvas;
      var btns = el('div', { class: 'btn-grid' }, [
        t.maxChildren > n.children.length ? el('button', { class: 'btn sm', html: I.icon('plus', 14) + 'Child', onclick: function (e) {
          var r = e.currentTarget.getBoundingClientRect();
          UI.contextMenu(r.left, r.bottom + 4, C.typeMenu(function () { return true; }, function (ty) { C.addChild(v, ty); }));
        } }) : null,
        el('button', { class: 'btn sm', html: I.icon('wrap', 14) + 'Wrap', onclick: function (e) {
          var r = e.currentTarget.getBoundingClientRect();
          UI.contextMenu(r.left, r.bottom + 4, C.typeMenu(function (ty) { return M.isDecorator(ty) || M.isControl(ty); }, function (ty) { C.wrapWith(v, ty); }));
        } }),
        el('button', { class: 'btn sm', html: I.icon('duplicate', 14) + 'Duplicate', onclick: function () { C.duplicate(); } }),
        el('button', { class: 'btn sm danger-ghost', html: I.icon('trash', 14) + 'Delete', onclick: function () { C.deleteSelection(); } })
      ]);
      parts.push(section('Actions', [btns]));
    } else if (!ro && n.type === 'root' && n.children.length === 0) {
      var C2 = window.BTCanvas;
      parts.push(section('Actions', [el('button', { class: 'btn sm', html: I.icon('plus', 14) + 'Add child', onclick: function (e) {
        var r = e.currentTarget.getBoundingClientRect();
        UI.contextMenu(r.left, r.bottom + 4, C2.typeMenu(function () { return true; }, function (ty) { C2.addChild(v, ty); }));
      } })]));
    }

    var cap = t.maxChildren === Infinity ? 'min. 1' : (t.maxChildren === 0 ? 'none' : 'max. ' + t.maxChildren);
    var info = [el('span', { text: 'Children' }), el('b', { title: t.maxChildren === Infinity ? 'Accepts 1 or more children' : '', text: n.children.length + ' (' + cap + ')' })];
    if (M.isCompiled(n.type)) {
      var cur = window.BTCanvas.current();
      var order = M.compiledOrder(project);
      var idxs = [];
      order.forEach(function (e, i) { if (e.nodeId === n.id && (v.ctx === null || e.ctx === v.ctx)) idxs.push(i); });
      info.push(el('span', { text: 'Firmware index' }), el('b', { class: 'mono', text: idxs.length ? '#' + idxs.join(', #') : '(outside the main tree)' }));
      if (cur) info.push(el('span', { text: 'Tree in log' }), el('b', { class: 'mono', text: M.logNameOf(project) }));
    }
    parts.push(fold('Details', [el('div', { class: 'kv' }, info)]));
    return parts;
  }

  function renderMany(vs) {
    var C = window.BTCanvas;
    var count = {};
    vs.forEach(function (v) { var l = T[v.node.type].label; count[l] = (count[l] || 0) + 1; });
    return [
      el('div', { class: 'insp-head cat-root' }, [
        el('span', { class: 'big-icon', html: I.icon('duplicate', 20) }),
        el('div', {}, [el('div', { class: 'insp-title', text: vs.length + ' nodes selected' }),
          el('div', { class: 'insp-sub', text: Object.keys(count).map(function (k) { return count[k] + '× ' + k; }).join(', ') })])
      ]),
      section('Actions', [el('div', { class: 'btn-grid' }, [
        el('button', { class: 'btn sm', html: I.icon('copy', 14) + 'Copy', onclick: function () { C.copySelection(); } }),
        el('button', { class: 'btn sm', html: I.icon('duplicate', 14) + 'Duplicate', onclick: function () { C.duplicate(); } }),
        el('button', { class: 'btn sm danger-ghost', html: I.icon('trash', 14) + 'Delete', onclick: function () { C.deleteSelection(); } })
      ])]),
      el('p', { class: 'insp-desc', text: 'Copy takes only these nodes, keeping the links between them. Delete removes only these nodes; any remaining children become loose.' })
    ];
  }

  /* ------------------------------------------------------------------ *
   * Editor: tree / project properties (nothing selected)
   * ------------------------------------------------------------------ */
  function renderTree(tree, project) {
    var A = window.BTApp;
    var isMain = tree.id === project.mainTreeId;
    var parts = [];
    parts.push(el('div', { class: 'insp-head cat-root' }, [
      el('span', { class: 'big-icon', html: I.icon('tree', 20) }),
      el('div', {}, [el('div', { class: 'insp-title', text: tree.name }), el('div', { class: 'insp-sub', html: isMain ? I.icon('star', 12, 'star') + ' Main tree' : 'Subtree' })])
    ]));
    var nodes = Object.keys(tree.nodes).length - 1;
    parts.push(section('Tree', [
      el('div', { class: 'kv' }, [el('span', { text: 'Nodes' }), el('b', { text: String(nodes) })]),
      el('div', { class: 'btn-row' }, [
        el('button', { class: 'btn sm', html: I.icon('rename', 14) + 'Rename', onclick: function () { A.renameTree(project.id, tree.id); } }),
        isMain ? null : el('button', { class: 'btn sm', html: I.icon('star', 14) + 'Set as main', onclick: function () { A.setMainTree(project.id, tree.id); } }),
        el('button', { class: 'btn sm danger-ghost', disabled: isMain, title: isMain ? 'Set another tree as main before deleting this one.' : '', html: I.icon('trash', 14) + 'Delete', onclick: function () { A.deleteTree(project.id, tree.id); } })
      ])
    ]));

    var logIn = el('input', { class: 'input mono', value: project.logName || '', placeholder: project.name.toUpperCase(), spellcheck: 'false' });
    logIn.addEventListener('input', function () {
      Store.mutate(project.id, function () { project.logName = logIn.value.trim(); }, 'logname:' + project.id);
    });
    var order = M.compiledOrder(project);
    var issues = M.validateProject(project);
    var errs = issues.filter(function (i) { return i.level === 'error'; }).length;
    parts.push(fold('Project', [
      el('div', { class: 'kv' }, [
        el('span', { text: 'Name' }), el('b', { text: project.name }),
        el('span', { text: 'Trees' }), el('b', { text: String(project.treeOrder.length) }),
        el('span', { text: 'Nodes in firmware' }), el('b', { text: String(order.length) }),
        el('span', { text: 'Problems' }), el('b', { class: errs ? 'bad' : 'good', text: errs ? errs + ' error(s)' : 'No errors' })
      ]),
      field('Name in log ("Tree:" field)', logIn, { hint: 'The firmware prints the project name in upper case. Leave empty to use <b>' + UI.esc(project.name.toUpperCase()) + '</b>.' }),
      el('div', { class: 'btn-row' }, [
        el('button', { class: 'btn sm', html: I.icon('rename', 14) + 'Rename project', onclick: function () { A.renameProject(project.id); } }),
        el('button', { class: 'btn sm', html: I.icon('download', 14) + 'Export XML', onclick: function () { A.exportXml(project.id); } }),
        S.backend && S.backend.generatorAvailable ? el('button', { class: 'btn sm', html: I.icon('code', 14) + 'Generate C code', onclick: function () { A.generateCode(project.id); } }) : null
      ])
    ]));
    parts.push(el('button', { class: 'link-help', html: I.icon('help', 14) + 'How to edit the tree? (F1)', onclick: function () { window.BTApp.help(); } }));
    return parts;
  }

  /* ------------------------------------------------------------------ *
   * Monitor panel
   * ------------------------------------------------------------------ */
  var STATUS_TXT = { running: 'Running', success: 'Success', fail: 'Fail', standby: 'Standby' };
  function timeAgo(t) {
    var s = Math.round((Date.now() - t) / 1000);
    if (s < 2) return 'now';
    if (s < 60) return s + ' s ago';
    var m = Math.round(s / 60);
    return m < 60 ? m + ' min ago' : Math.round(m / 60) + ' h ago';
  }

  function nodeLabel(project, ev) {
    var tr = project.trees[ev.treeId];
    var n = tr && tr.nodes[ev.nodeId];
    if (!n) return '#' + ev.index;
    var t = T[n.type];
    var body = t.field ? n.props[t.field.key] : '';
    return t.label + (body ? ': ' + body + (t.field.unit ? ' ' + t.field.unit : '') : '');
  }

  function renderMonitor() {
    var D = window.BTDebug;
    var project = Store.tabProject() || Store.activeProject();
    var conn = D.conn();
    var c = D.counters();
    var parts = [];
    parts.push(el('div', { class: 'insp-head cat-monitor' }, [
      el('span', { class: 'big-icon', html: I.icon('activity', 20) }),
      el('div', {}, [el('div', { class: 'insp-title', text: 'Monitor' }), el('div', { class: 'insp-sub', text: conn.connected ? conn.label : 'No data source' })])
    ]));
    if (!conn.connected) {
      parts.push(el('div', { class: 'callout' }, [el('span', { html: I.icon('plug', 16) }), el('span', { html: 'Choose a source in the <b>Terminal</b> panel (UART, SWD/RTT, Web Serial, simulation or saved log) and click Connect.' })]));
      parts.push(el('button', { class: 'btn primary', html: I.icon('plug', 15) + 'Open connection', onclick: function () { window.BTApp.showBottom('terminal'); document.getElementById('srcKind').focus(); } }));
    }
    parts.push(section('Legend', [el('div', { class: 'legend' }, ['running', 'success', 'fail', 'standby'].map(function (s) {
      return el('div', { class: 'lg' }, [el('span', { class: 'sw st-' + s }), el('span', { text: STATUS_TXT[s] })]);
    }))]));

    if (project) {
      var last = D.lastRunning();
      var lastEl = null;
      if (last && last.projectId === project.id) {
        lastEl = el('button', { class: 'now-running', title: 'Locate in tree', onclick: function () { D.locate(last.projectId, last); } }, [
          el('span', { class: 'sw st-running pulse' }),
          el('span', { class: 'mono', text: '#' + last.index }),
          el('span', { class: 'nr-label', text: nodeLabel(project, last) })
        ]);
      }
      parts.push(section('Running now', [lastEl || el('div', { class: 'hint', text: 'No node running yet.' })]));
      parts.push(fold('Statistics', [
        el('div', { class: 'kv' }, [
          el('span', { text: 'Project' }), el('b', { text: project.name }),
          el('span', { text: 'Expected Tree in log' }), el('b', { class: 'mono', text: M.logNameOf(project) }),
          el('span', { text: 'Lines received' }), el('b', { text: c.lines.toLocaleString('en-US') }),
          el('span', { text: '[BTREE] events' }), el('b', { text: c.events.toLocaleString('en-US') }),
          el('span', { text: 'Mismatches' }), el('b', { class: c.mismatches ? 'bad' : '', title: 'Events whose index/type does not match the Studio tree', text: String(c.mismatches) })
        ])
      ]));

      var sv = window.BTCanvas.selectedVNode();
      if (sv && sv.node.type !== 'root') {
        var t = T[sv.node.type];
        var st = D.nodeStatus(project, sv.tree, sv.node.id, sv.ctx);
        var stats = M.isCompiled(sv.node.type) ? D.stats(project.id, sv.ctx === null ? null : sv.ctx, sv.node.id) : null;
        var kv = [el('span', { text: 'Node' }), el('b', { text: nodeLabel(project, { treeId: sv.tree.id, nodeId: sv.node.id }) }),
          el('span', { text: 'State' }), el('b', {}, [el('span', { class: 'sw st-' + (st || 'standby') }), ' ' + STATUS_TXT[st || 'standby']])];
        if (stats) {
          kv.push(el('span', { text: 'Running / Success / Fail' }), el('b', { class: 'mono', text: stats.running + ' / ' + stats.success + ' / ' + stats.fail }));
          kv.push(el('span', { text: 'Last event' }), el('b', { text: timeAgo(stats.last) }));
        }
        parts.push(section('Selected: ' + t.label, [el('div', { class: 'kv' }, kv)]));
      }
    }

    var follow = el('input', { type: 'checkbox', checked: !!S.settings.follow });
    follow.addEventListener('change', function () { Store.setSetting('follow', follow.checked); });
    parts.push(fold('Options', [
      el('label', { class: 'chk' }, [follow, 'Follow the running node']),
      el('div', { class: 'btn-row' }, [
        el('button', { class: 'btn sm', html: I.icon('reset', 14) + 'Reset states', onclick: function () { D.resetStatuses(); } }),
        el('button', { class: 'btn sm', html: I.icon('expand', 14) + 'Expand subtrees', onclick: function () { window.BTCanvas.setAllExpanded(true); } })
      ])
    ]));

    var rec = D.recent().filter(function (e) { return !project || e.projectId === project.id; }).slice(0, 25);
    if (rec.length && project) {
      parts.push(fold('Latest transitions', [el('div', { class: 'recent' }, rec.map(function (e) {
        return el('button', { class: 'rc', title: 'Locate', onclick: function () { D.locate(e.projectId, e); } }, [
          el('span', { class: 'sw st-' + e.status }),
          el('span', { class: 'mono idx', text: '#' + e.index }),
          el('span', { class: 'rc-label', text: nodeLabel(project, e) }),
          el('span', { class: 'rc-time', text: new Date(e.time).toLocaleTimeString('en-US') })
        ]);
      }))]));
    }
    return parts;
  }

  /* ------------------------------------------------------------------ */
  function render(force) {
    var tab = Store.activeTab();
    var sel = S.selection;
    var keyNow = S.mode + '|' + (tab ? tab.id : '') + '|' + (sel ? sel.ctx + '>' + sel.nodeId : '') + '|' + S.multi.length;
    var focusedInside = box.contains(document.activeElement) && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName);
    if (!force && keyNow === renderedFor && focusedInside) return;
    var scroll = box.scrollTop;
    var same = keyNow === renderedFor;
    renderedFor = keyNow;
    focusTarget = null;
    box.innerHTML = '';
    var parts;
    if (S.mode === 'monitor') parts = renderMonitor();
    else {
      var project = Store.tabProject(tab), tree = Store.tabTree(tab);
      var v = window.BTCanvas.selectedVNode(), many = window.BTCanvas.selectedVNodes();
      if (many.length > 1 && project) parts = renderMany(many);
      else if (v && project) parts = renderNode(v, project);
      else if (tree) parts = renderTree(tree, project);
      else parts = [el('div', { class: 'insp-empty' }, [el('span', { html: I.icon('tree', 28) }), el('p', { text: 'Open a tree in the workspace to see its properties.' })])];
    }
    parts.forEach(function (p) { if (p) box.appendChild(p); });
    if (same) box.scrollTop = scroll;
  }

  function focusField() {
    if (S.mode !== 'editor') return;
    render(true);
    if (focusTarget && !focusTarget.disabled) { focusTarget.focus(); if (focusTarget.select) focusTarget.select(); }
  }

  var monitorTimer = null;
  function init() {
    box = document.getElementById('inspector');
    Store.on('selection', function () { render(); });
    Store.on('structure', function () { render(); });
    Store.on('mode', function () { render(true); });
    Store.on('connection', function () { if (S.mode === 'monitor') render(true); });
    Store.on('debug', function () {
      if (S.mode !== 'monitor' || monitorTimer) return;
      monitorTimer = setTimeout(function () { monitorTimer = null; render(true); }, 250);
    });
    render(true);
  }

  window.BTInspector = { init: init, render: render, focusField: focusField };
})();
