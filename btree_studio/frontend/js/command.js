/* BTree Studio - command palette (Ctrl+K) and quick-add (Space/Tab, double-click on empty space, the node "+").
 * Type to filter; "action mover_braco" creates the Action already with the function name,
 * "sleep 500" a Sleep of 500 ms, "retry 3" a Retry with 3 attempts. */
(function () {
  'use strict';
  var M = window.BTModel, Store = window.BTStore, UI = window.BTUI, I = window.BTIcons;
  var S = Store.S, T = M.TYPES;
  var C = function () { return window.BTCanvas; };

  var root, input, listEl, footer, items = [], sel = 0, ctx = null;

  /* ------------------------------------------------------------------ *
   * Fuzzy matching: subsequence with bonuses for prefix / word starts.
   * ------------------------------------------------------------------ */
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function score(q, text) {
    if (!q) return 1;
    var t = norm(text);
    var direct = t.indexOf(q);
    if (direct === 0) return 100 - t.length * 0.1;
    if (direct > 0) return (/[\s_\-:/]/.test(t[direct - 1]) ? 80 : 60) - t.length * 0.1;
    var s = 0, j = 0, streak = 0;
    for (var i = 0; i < t.length && j < q.length; i++) {
      if (t[i] === q[j]) { streak += 1; s += 1 + streak + (i === 0 || /[\s_\-:/]/.test(t[i - 1]) ? 3 : 0); j += 1; }
      else streak = 0;
    }
    return j === q.length ? s : 0;
  }
  function bestScore(q, texts) { return Math.max.apply(null, texts.map(function (x) { return score(q, x); })); }

  /* ------------------------------------------------------------------ *
   * What adding a type does, given the context
   * ------------------------------------------------------------------ */
  function plan(type) {
    var cur = C().current();
    if (!cur) return null;
    if (ctx.at) return { how: 'loose', text: 'loose node here', run: function (props) { C().addLoose(type, ctx.at, props); } };
    var v = ctx.target || C().selectedVNode() || cur.root;
    if (v.readonly) v = cur.root;
    var label = T[v.node.type].label;
    if (ctx.force === 'child' || M.canAcceptChild(v.tree, v.node.id, type)) {
      if (!M.canAcceptChild(v.tree, v.node.id, type)) return null;
      return { how: 'child', text: 'child of ' + label, run: function (props) { C().addChild(v, type, ctx.index, props); } };
    }
    if ((M.isDecorator(type) || M.isControl(type)) && v.node.type !== 'root' && v.parent) {
      return { how: 'wrap', text: 'wrap ' + label, run: function (props) { C().wrapWith(v, type, props); } };
    }
    if (v.parent && M.canAcceptChild(v.tree, v.parent.node.id, type)) {
      return { how: 'sibling', text: 'after ' + label, run: function (props) { C().addSibling(v, type, true, props); } };
    }
    var at = C().viewCenter();
    return { how: 'loose', text: 'loose node', run: function (props) { C().addLoose(type, at, props); } };
  }

  // "sibling" alternative for Shift+Enter
  function siblingPlan(type) {
    var cur = C().current();
    var v = ctx.target || C().selectedVNode();
    if (!cur || !v || !v.parent || v.readonly || ctx.at) return null;
    if (!M.canAcceptChild(v.tree, v.parent.node.id, type)) return null;
    return function (props) { C().addSibling(v, type, true, props); };
  }

  function paramFor(type, raw) {
    var f = T[type].field;
    if (!f || !raw) return null;
    if (f.kind === 'ident') return M.C_IDENT_RE.test(raw) ? { key: f.key, value: raw, show: raw + '()' } : null;
    if (f.kind === 'uint') return /^\d+$/.test(raw) ? { key: f.key, value: String(Number(raw)), show: Number(raw).toLocaleString('en-US') + (f.unit ? ' ' + f.unit : '') } : null;
    return null;
  }

  function typeItems(q) {
    var out = [];
    var parts = q.split(/\s+/), head = parts[0], rest = parts.slice(1).join('_');
    Object.keys(T).forEach(function (type) {
      if (type === 'root' || type === 'unknown') return;
      var t = T[type];
      var names = [t.label, t.tag || '', type.replace(/_/g, ' ')];
      var sc = bestScore(q, names), param = null;
      if (rest) {
        var p = paramFor(type, parts.slice(1).join(T[type].field && T[type].field.kind === 'uint' ? '' : '_'));
        var sh = p ? bestScore(head, names) : 0;
        if (sh > sc) { sc = sh + 5; param = p; }
      }
      if (!sc) return;
      var pl = plan(type);
      if (!pl) return;
      out.push({
        group: 'Add node', icon: t.icon, cat: t.cat, label: t.label, score: sc,
        param: param ? param.show : '', detail: pl.text, desc: t.desc,
        run: function (shift) {
          var props = param ? {} : undefined;
          if (param) props[param.key] = param.value;
          var alt = shift && siblingPlan(type);
          (alt || pl.run)(props);
        }
      });
    });
    return out;
  }

  function nodeItems(q) {
    var cur = C().current();
    if (!cur || !q) return [];
    var out = [];
    cur.list.forEach(function (v) {
      if (v.node.type === 'root') return;
      var t = T[v.node.type];
      var sc = bestScore(q, [v.body || '', t.label + ' ' + (v.body || '')]);
      if (sc < 4) return;
      out.push({
        group: 'Go to node', icon: t.icon, cat: t.cat, label: v.body || t.label, detail: t.label + (v.readonly ? ' · ' + v.tree.name : ''), score: sc - 2,
        run: function () { C().revealNode(v.node.id, v.ctx); C().centerOn(v, true); }
      });
    });
    return out;
  }

  function treeItems(q) {
    var out = [];
    S.projects.forEach(function (p) {
      p.treeOrder.forEach(function (tid) {
        var tr = p.trees[tid], main = tid === p.mainTreeId;
        var sc = bestScore(q, [tr.name, p.name + ' ' + tr.name, 'open ' + tr.name]);
        if (!sc) return;
        out.push({ group: 'Trees', icon: main ? 'star' : 'subtree', label: tr.name, detail: p.name + (main ? ' · main' : ''), score: sc - 1,
          run: function () { Store.openTab(p.id, tid, main ? '' : null); } });
      });
    });
    return out;
  }

  function actions() {
    var A = window.BTApp, D = window.BTDebug, editor = S.mode === 'editor';
    var list = [
      { label: 'Fit to screen', icon: 'fit', key: 'F', run: function () { C().fit(); } },
      { label: editor ? 'Go to Monitor' : 'Go to Editor', icon: editor ? 'activity' : 'edit', key: editor ? 'F3' : 'F2', run: function () { Store.setMode(editor ? 'monitor' : 'editor'); } },
      { label: 'Simulate the main tree', icon: 'play', run: function () { document.getElementById('srcKind').value = 'sim'; document.getElementById('srcKind').dispatchEvent(new Event('change')); if (D.conn().connected) D.disconnect(); setTimeout(function () { D.connect(); A.showBottom('terminal'); }, 30); } },
      { label: 'Save', icon: 'save', key: 'Ctrl+S', run: A.save },
      { label: 'Undo', icon: 'undo', key: 'Ctrl+Z', run: function () { Store.undo(); } },
      { label: 'Redo', icon: 'redo', key: 'Ctrl+Y', run: function () { Store.redo(); } },
      { label: 'Expand all subtrees', icon: 'expand', run: function () { C().setAllExpanded(true); } },
      { label: 'Collapse all subtrees', icon: 'collapse', run: function () { C().setAllExpanded(false); } },
      { label: 'Show/hide firmware indices', icon: 'code', key: '#', run: function () { Store.setSetting('showIndex', !S.settings.showIndex); } },
      { label: S.settings.motion === false ? 'Turn animations on' : 'Turn animations off', icon: 'sparkles', run: function () { Store.setSetting('motion', S.settings.motion === false); } },
      { label: S.settings.hints === false ? 'Show corner hints' : 'Hide corner hints', icon: 'help', run: function () { Store.setSetting('hints', S.settings.hints === false); } },
      { label: 'Show/hide minimap', icon: 'map', run: function () { Store.setSetting('minimap', S.settings.minimap === false); } },
      { label: 'Toggle light/dark theme', icon: S.settings.theme === 'dark' ? 'sun' : 'moon', run: function () { Store.setSetting('theme', S.settings.theme === 'dark' ? 'light' : 'dark'); } },
      { label: 'New project…', icon: 'plus', run: A.newProject },
      { label: 'New subtree…', icon: 'tree-plus', run: function () { A.newTree(); } },
      { label: 'Open XML / .btproj…', icon: 'folder', key: 'Ctrl+O', run: function () { document.getElementById('fileOpen').click(); } },
      { label: 'Export XML', icon: 'download', run: function () { A.exportXml(); } },
      { label: 'Generate C code…', icon: 'code', run: function () { A.generateCode(); } },
      { label: 'Open example', icon: 'sparkles', run: A.loadExample },
      { label: 'Help and shortcuts', icon: 'help', key: 'F1', run: A.help }
    ];
    return list.map(function (a) { a.group = 'Commands'; return a; });
  }

  function build() {
    var q = norm(input.value.trim());
    var out;
    if (ctx.mode === 'add') out = typeItems(q);
    else {
      var acts = actions().map(function (a) { a.score = bestScore(q, [a.label]); return a; }).filter(function (a) { return a.score; });
      var editor = S.mode === 'editor' && C().current();
      out = (editor ? typeItems(q).map(function (x) { x.score -= q ? 3 : 50; return x; }) : []).concat(acts, treeItems(q).map(function (x) { if (!q) x.score -= 60; return x; }), nodeItems(q));
    }
    if (q) out.sort(function (a, b) { return b.score - a.score; });
    else if (ctx.mode !== 'add') out.sort(function (a, b) { return b.score - a.score; });
    items = out.slice(0, 60);
    sel = 0;
    render();
  }

  function render() {
    listEl.innerHTML = '';
    if (!items.length) { listEl.appendChild(UI.el('div', { class: 'cmd-empty', text: 'Nothing found.' })); return; }
    var lastGroup = null;
    // with a query results are ranked, so groups only show when browsing
    var showGroups = !input.value.trim() && ctx.mode !== 'add';
    items.forEach(function (it, i) {
      if (showGroups && it.group !== lastGroup) { listEl.appendChild(UI.el('div', { class: 'cmd-group', text: it.group })); lastGroup = it.group; }
      var row = UI.el('div', { class: 'cmd-item' + (i === sel ? ' active' : '') + (it.cat ? ' cat-' + it.cat : ''), role: 'option' }, [
        UI.el('span', { class: 'cmd-icon', html: I.has(it.icon) ? I.icon(it.icon, 14) : '' }),
        UI.el('span', { class: 'cmd-label' }, [it.label, it.param ? UI.el('span', { class: 'cmd-param', text: it.param }) : '']),
        UI.el('span', { class: 'cmd-detail', text: it.detail || '' }),
        it.key ? UI.el('kbd', { text: UI.kbd(it.key) }) : ''
      ]);
      row.addEventListener('pointerdown', function (e) { e.preventDefault(); choose(i, e.shiftKey); });
      row.addEventListener('pointermove', function () { if (sel !== i) { sel = i; mark(); } });
      listEl.appendChild(row);
    });
    mark();
  }

  function mark() {
    var rows = listEl.querySelectorAll('.cmd-item');
    rows.forEach(function (r, i) { r.classList.toggle('active', i === sel); });
    if (rows[sel]) rows[sel].scrollIntoView({ block: 'nearest' });
    var it = items[sel];
    footer.innerHTML = it && it.desc ? UI.esc(it.desc) : (ctx.mode === 'add'
      ? 'Type <kbd>action function_name</kbd>, <kbd>sleep 500</kbd>, <kbd>retry 3</kbd>… · <kbd>Shift+Enter</kbd> sibling'
      : '<kbd>↑↓</kbd> navigate · <kbd>Enter</kbd> run · <kbd>Esc</kbd> close');
  }

  function choose(i, shift) {
    var it = items[i];
    if (!it) return;
    var keep = ctx;
    close();
    ctx = keep;           // the item's action still reads the context (target, index, point)
    try { it.run(shift); } finally { ctx = null; }
    var w = document.getElementById('canvasWrap');
    if (w && !document.querySelector('#inspector :focus')) setTimeout(function () { if (!document.activeElement || document.activeElement === document.body) w.focus({ preventScroll: true }); }, 0);
  }

  function onKey(e) {
    e.stopPropagation();
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % Math.max(1, items.length); mark(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + items.length) % Math.max(1, items.length); mark(); }
    else if (e.key === 'Enter' || (e.key === 'Tab' && ctx.mode === 'add' && !e.shiftKey)) { e.preventDefault(); choose(sel, e.shiftKey); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); document.getElementById('canvasWrap').focus({ preventScroll: true }); }
  }

  function open(opts) {
    ctx = Object.assign({ mode: 'cmd' }, opts || {});
    UI.closeMenus();
    root.hidden = false;
    root.className = 'cmdk ' + ctx.mode + (ctx.x !== undefined ? ' anchored' : '');
    var head = root.querySelector('.cmd-head');
    if (ctx.mode === 'add') {
      var v = ctx.target || C().selectedVNode();
      head.textContent = ctx.at ? 'New loose node' : ctx.force === 'child' && v ? 'New child of ' + T[v.node.type].label + (v.body ? ' ' + v.body : '') : 'Add node';
      head.hidden = false;
      input.placeholder = 'Node type… (e.g. action open_door)';
    } else { head.hidden = true; input.placeholder = 'Find command, node, tree or function…'; }
    if (ctx.x !== undefined) {
      var w = 340, h = 360;
      root.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, ctx.x - 30)) + 'px';
      root.style.top = Math.max(8, Math.min(window.innerHeight - h - 8, ctx.y)) + 'px';
    } else { root.style.left = ''; root.style.top = ''; }
    input.value = '';
    build();
    input.focus();
  }

  function quickAdd(opts) {
    if (S.mode !== 'editor') { UI.toast('Switch to Editor mode to add nodes.', 'warning'); return; }
    if (!C().current()) return;
    if (opts.target && opts.target.readonly) return;
    open(Object.assign({ mode: 'add' }, opts));
  }

  function close() { if (root && !root.hidden) { root.hidden = true; ctx = null; } }

  function init() {
    root = UI.el('div', { id: 'cmdk', class: 'cmdk', hidden: true }, [
      UI.el('div', { class: 'cmd-head' }),
      UI.el('div', { class: 'cmd-input' }, [UI.el('span', { html: I.icon('search', 15) }), input = UI.el('input', { autocomplete: 'off', spellcheck: 'false' })]),
      listEl = UI.el('div', { class: 'cmd-list', role: 'listbox' }),
      footer = UI.el('div', { class: 'cmd-foot' })
    ]);
    document.body.appendChild(root);
    root.hidden = true;
    input.addEventListener('input', build);
    input.addEventListener('keydown', onKey);
    input.addEventListener('blur', function () { setTimeout(function () { if (document.activeElement !== input) close(); }, 120); });
  }

  window.BTCommand = { init: init, open: open, quickAdd: quickAdd, close: close, isOpen: function () { return !!(root && !root.hidden); } };
})();
