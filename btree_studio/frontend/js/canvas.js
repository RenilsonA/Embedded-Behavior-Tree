/* BTree Studio - tree canvas: layout, rendering, pan/zoom, selection, drag & drop, edit actions. */
(function () {
  'use strict';
  var M = window.BTModel, Store = window.BTStore, UI = window.BTUI, I = window.BTIcons;
  var S = Store.S;
  var T = M.TYPES;

  var H_GAP = 26, V_GAP = 46, ROOT_W = 84, ROOT_H = 34, CARD_H = 56, COMPACT_H = 36, MIN_W = 132, MAX_W = 280;

  var wrap, world, nodesLayer, edgesLayer;
  var view = { tx: 40, ty: 40, s: 1 };
  var viewByTab = {};
  var current = null;      // { tab, project, tree, root: vnode, byKey: {}, list: [] }
  var issuesByNode = {};
  var indexMap = null;     // key(ctx>nodeId) -> firmware index, or nodeId -> [indices] for ctx null
  var sparkLayer = null;   // <g> for the tick/result "sparks" that run along the edges in the monitor
  var layoutAnim = 0;      // requestAnimationFrame id of the running layout transition

  // Every animation respects the OS "reduce motion" preference (also used by the browser tests).
  var reduceMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  function motionOK() { return !reduceMotion.matches && S.settings.motion !== false; }
  function ease(k) { return 1 - Math.pow(1 - k, 3); }

  /* ------------------------------------------------------------------ *
   * Text measurement
   * ------------------------------------------------------------------ */
  var measureCtx = document.createElement('canvas').getContext('2d');
  function textW(text, font) { measureCtx.font = font; return measureCtx.measureText(text).width; }
  var FONT_HEAD = '600 11px ' + getComputedStyle(document.documentElement).getPropertyValue('--font-ui');
  var FONT_BODY = '500 13px ' + getComputedStyle(document.documentElement).getPropertyValue('--font-mono');

  /* ------------------------------------------------------------------ *
   * View model
   * ------------------------------------------------------------------ */
  function nodeKey(ctx, nodeId) { return (ctx === null ? '*' : ctx) + '>' + nodeId; }
  function childCtx(ctx, subNodeId) { return ctx === null ? null : ctx + '/' + subNodeId; }
  function expandKey(ctx, nodeId) { return (ctx === null ? '*' : ctx) + '>' + nodeId; }

  function bodyText(project, node) {
    var t = T[node.type];
    if (node.type === 'subtree') {
      var ref = project.trees[node.props.ref];
      return ref ? ref.name : (node.props.missingRef ? node.props.missingRef + ' ?' : '(choose the tree)');
    }
    if (t.field) {
      var v = node.props[t.field.key];
      if (t.field.kind === 'uint') return (v === '' || v === undefined ? '?' : Number(v).toLocaleString('en-US')) + ' ' + (t.field.unit || '');
      return v || '(unnamed)';
    }
    if (node.type === 'unknown') return '<' + node.props.tag + '>';
    return node.props.label || '';
  }

  function buildView(project, tree, ctx) {
    var byKey = {}, list = [];
    function make(treeObj, nodeId, c, parent, readonly, depth, guard) {
      var n = treeObj.nodes[nodeId];
      if (!n) return null;
      var v = { key: nodeKey(c, n.id), node: n, tree: treeObj, ctx: c, parent: parent, readonly: readonly, depth: depth, children: [] };
      var t = T[n.type];
      if (n.type === 'root') { v.w = ROOT_W; v.h = ROOT_H; }
      else {
        var body = bodyText(project, n);
        v.body = body;
        var compact = !body && (t.cat === 'control' || t.cat === 'decorator');
        v.h = compact ? COMPACT_H : CARD_H;
        var head = t.label + (t.cat === 'decorator' && t.field ? '' : '');
        var w = Math.max(textW(head.toUpperCase(), FONT_HEAD) + 64, body ? textW(body, FONT_BODY) + 30 : 0);
        if (n.type === 'subtree') w += 26;
        v.w = Math.round(Math.max(MIN_W, Math.min(MAX_W, w)));
      }
      byKey[v.key] = v;
      list.push(v);
      if (n.type === 'subtree') {
        var ref = project.trees[n.props.ref];
        v.expanded = !!(ref && S.expanded[expandKey(c, n.id)] && guard < 8);
        if (v.expanded) {
          var refRoot = ref.nodes[ref.rootId];
          var cc = childCtx(c, n.id);
          refRoot.children.forEach(function (cid) {
            var cv = make(ref, cid, cc, v, true, depth + 1, guard + 1);
            if (cv) { cv.subtreeHost = v; v.children.push(cv); }
          });
        }
      } else {
        n.children.forEach(function (cid) {
          var cv = make(treeObj, cid, c, v, readonly, depth + 1, guard);
          if (cv) v.children.push(cv);
        });
      }
      return v;
    }
    var root = make(tree, tree.rootId, ctx, null, false, 0, 0);
    var floats = M.looseRoots(tree).map(function (id) {
      var v = make(tree, id, ctx, null, false, 0, 0);
      v.loose = true;
      return v;
    });
    return { root: root, floats: floats, byKey: byKey, list: list };
  }

  /* ------------------------------------------------------------------ *
   * Layout (contour based tidy tree, top-down)
   * ------------------------------------------------------------------ */
  // The connected tree is auto-arranged around x=0; each loose branch is arranged the same way
  // but anchored at its own free position (node.pos), like nodes dropped on a Groot2 canvas.
  function layout(vm) {
    [vm.root].concat(vm.floats).forEach(function (r) {
      var branch = [];
      (function walk(v) { branch.push(v); v.children.forEach(walk); })(r);
      var rowH = [];
      branch.forEach(function (v) { rowH[v.depth] = Math.max(rowH[v.depth] || 0, v.h); });
      var rowTop = [r.loose ? (r.node.pos || { y: -160 }).y : 0];
      for (var d = 1; d < rowH.length; d++) rowTop[d] = rowTop[d - 1] + rowH[d - 1] + V_GAP;
      lay(r);
      place(r, r.loose ? (r.node.pos || { x: 0 }).x + r.w / 2 : 0, rowTop, rowH);
    });
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    vm.list.forEach(function (v) { minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x + v.w); minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y + v.h); });
    vm.bbox = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  function lay(v) {
    if (!v.children.length) {
      v.cl = [-v.w / 2]; v.cr = [v.w / 2];
      return;
    }
    v.children.forEach(lay);
    var offs = [0];
    var accL = v.children[0].cl.slice(), accR = v.children[0].cr.slice();
    for (var i = 1; i < v.children.length; i++) {
      var c = v.children[i];
      var shift = -Infinity;
      var common = Math.min(accR.length, c.cl.length);
      for (var k = 0; k < common; k++) shift = Math.max(shift, accR[k] - c.cl[k] + H_GAP);
      offs[i] = shift;
      for (k = 0; k < c.cl.length; k++) {
        if (k < accR.length) accR[k] = c.cr[k] + shift;
        else { accL[k] = c.cl[k] + shift; accR[k] = c.cr[k] + shift; }
      }
    }
    var center = (offs[0] + offs[offs.length - 1]) / 2;
    v.children.forEach(function (c, idx) { c.rel = offs[idx] - center; });
    v.cl = [-v.w / 2].concat(accL.map(function (x) { return x - center; }));
    v.cr = [v.w / 2].concat(accR.map(function (x) { return x - center; }));
    if (v.expanded) {
      // expanded SubTree behaves as a solid block so its frame never overlaps neighbours
      var mn = Math.min.apply(null, v.cl) - 10, mx = Math.max.apply(null, v.cr) + 10;
      v.cl = v.cl.map(function () { return mn; });
      v.cr = v.cr.map(function () { return mx; });
    }
  }

  function place(v, x, rowTop, rowH) {
    v.cx = x;
    v.x = Math.round(x - v.w / 2);
    v.y = rowTop[v.depth] + (v.node.type === 'root' ? (rowH[v.depth] - v.h) : 0);
    v.children.forEach(function (c) { place(c, x + c.rel, rowTop, rowH); });
  }

  /* ------------------------------------------------------------------ *
   * Rendering
   * ------------------------------------------------------------------ */
  function firmwareIndexLabel(v) {
    if (!indexMap || !M.isCompiled(v.node.type)) return '';
    if (v.ctx === null) {
      var arr = indexMap.byNode[v.node.id];
      if (!arr || !arr.length) return '';
      return arr.length > 3 ? '#' + arr.slice(0, 3).join(',') + '…' : '#' + arr.join(',');
    }
    var idx = indexMap.byKey[nodeKey(v.ctx, v.node.id)];
    return idx === undefined ? '' : '#' + idx;
  }

  function computeIndexMap(project) {
    var byKey = {}, byNode = {};
    M.compiledOrder(project).forEach(function (e, i) {
      byKey[nodeKey(e.ctx, e.nodeId)] = i;
      (byNode[e.nodeId] = byNode[e.nodeId] || []).push(i);
    });
    return { byKey: byKey, byNode: byNode };
  }

  function render() {
    var tab = Store.activeTab();
    var project = Store.tabProject(tab), tree = Store.tabTree(tab);
    // remember where every node was drawn, so the new layout can glide from there
    var prev = null, oldEls = null;
    if (current && tab && current.tab.id === tab.id && motionOK()) {
      prev = {}; oldEls = {};
      current.list.forEach(function (v) { prev[v.key] = { x: pos(v).x, y: pos(v).y, w: v.w, h: v.h }; oldEls[v.key] = v.el; });
    }
    if (layoutAnim) { cancelAnimationFrame(layoutAnim); layoutAnim = 0; }
    nodesLayer.innerHTML = '';
    edgesLayer.innerHTML = '';
    document.getElementById('emptyState').hidden = !!tree;
    if (!tree) { current = null; renderBreadcrumb(); return; }
    if (current && current.tab && current.tab.id !== tab.id) viewByTab[current.tab.id] = Object.assign({}, view);
    var firstTime = !current || current.tab.id !== tab.id;

    var vm = buildView(project, tree, tab.ctx);
    layout(vm);
    current = { tab: tab, project: project, tree: tree, root: vm.root, floats: vm.floats, byKey: vm.byKey, list: vm.list, bbox: vm.bbox };
    indexMap = computeIndexMap(project);
    issuesByNode = {};
    M.validateProject(project).forEach(function (iss) {
      if (iss.nodeId) (issuesByNode[iss.nodeId] = issuesByNode[iss.nodeId] || []).push(iss);
    });

    // SubTree frames
    vm.list.forEach(function (v) {
      if (!v.expanded || !v.children.length) return;
      var minX = Infinity, maxX = -Infinity, maxY = 0;
      (function walk(x) { x.children.forEach(function (c) { minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x + c.w); maxY = Math.max(maxY, c.y + c.h); walk(c); }); })(v);
      var f = svg('rect', { class: 'subframe', x: minX - 12, y: v.y + v.h + 14, width: maxX - minX + 24, height: maxY - (v.y + v.h + 14) + 12, rx: 12 });
      edgesLayer.appendChild(f);
    });
    // edges
    vm.list.forEach(function (v) {
      v.children.forEach(function (c) {
        var d = edgePath(v, c);
        var path = svg('path', { d: d, class: 'edge' + (c.readonly ? ' ro' : '') });
        path.dataset.key = c.key;
        c.edge = path;
        edgesLayer.appendChild(path);
        if (!c.readonly) {
          var hit = svg('path', { d: d, class: 'edge-hit' });
          hit.dataset.key = c.key;
          c.edgeHit = hit;
          hit.appendChild(svg('title', {})).textContent = 'Click: select (Del disconnects) · Right-click: insert a node in between';
          edgesLayer.appendChild(hit);
        }
      });
    });
    sparkLayer = svg('g', { class: 'sparks' });
    edgesLayer.appendChild(sparkLayer);
    // nodes
    var frag = document.createDocumentFragment();
    vm.list.forEach(function (v) { v.el = renderNode(project, v); frag.appendChild(v.el); });
    nodesLayer.appendChild(frag);
    applySelection();
    updateStatuses();
    renderBreadcrumb();
    if (prev) animateLayout(vm, prev, oldEls);

    if (firstTime) {
      var saved = viewByTab[tab.id];
      if (saved) { view = Object.assign({}, saved); applyView(); }
      else fit(true, true);
    }
    scheduleMinimap();
  }

  /* ------------------------------------------------------------------ *
   * Layout transitions: nodes glide to their new place, new ones grow out of
   * their parent, removed ones fade away. Edges follow the nodes every frame.
   * ------------------------------------------------------------------ */
  function pos(v) { return { x: v.ax !== undefined ? v.ax : v.x, y: v.ay !== undefined ? v.ay : v.y }; }

  function edgePath(v, c) {
    var a = pos(v), b = pos(c);
    var px = a.x + v.w / 2, py = a.y + v.h, cx = b.x + c.w / 2, cy = b.y;
    var my = py + Math.max(14, (cy - py) / 2);
    var r = Math.max(0, Math.min(8, Math.abs(cx - px) / 2, (cy - py) / 4));
    if (Math.abs(cx - px) < 1 || cy - py < 4) return 'M' + px + ' ' + py + 'L' + cx + ' ' + cy;
    var dir = cx > px ? 1 : -1;
    return 'M' + px + ' ' + py + 'V' + (my - r) + 'Q' + px + ' ' + my + ' ' + (px + dir * r) + ' ' + my +
      'H' + (cx - dir * r) + 'Q' + cx + ' ' + my + ' ' + cx + ' ' + (my + r) + 'V' + cy;
  }

  function redrawEdges() {
    current.list.forEach(function (v) {
      v.children.forEach(function (c) {
        if (!c.edge) return;
        var d = edgePath(v, c);
        c.edge.setAttribute('d', d);
        if (c.edgeHit) c.edgeHit.setAttribute('d', d);
      });
    });
  }

  function animateLayout(vm, prev, oldEls) {
    var moving = [];
    vm.list.forEach(function (v) {
      var p = prev[v.key], from;
      if (p) from = p;
      else {
        var anc = v.parent;
        while (anc && !prev[anc.key]) anc = anc.parent;
        var a = anc && prev[anc.key];
        from = a ? { x: a.x + a.w / 2 - v.w / 2, y: a.y + a.h / 2 - v.h / 2 } : { x: v.x, y: v.y };
        v.el.classList.add('entering');
        v.el.addEventListener('animationend', function () { v.el.classList.remove('entering'); }, { once: true });
      }
      if (Math.abs(from.x - v.x) > 0.5 || Math.abs(from.y - v.y) > 0.5) moving.push({ v: v, fx: from.x, fy: from.y });
    });
    // removed nodes: keep the old card for a moment and let it fade out
    Object.keys(oldEls).forEach(function (k) {
      if (vm.byKey[k]) return;
      var el = oldEls[k];
      el.classList.remove('selected', 'entering', 'bump');
      el.classList.add('leaving');
      nodesLayer.appendChild(el);
      setTimeout(function () { el.remove(); }, 260);
    });
    if (!moving.length) return;
    var t0 = performance.now(), DUR = 280;
    function frame(now) {
      var k = Math.min(1, (now - t0) / DUR), e = ease(k);
      moving.forEach(function (m) {
        var v = m.v;
        if (k >= 1) { delete v.ax; delete v.ay; }
        else { v.ax = m.fx + (v.x - m.fx) * e; v.ay = m.fy + (v.y - m.fy) * e; }
        v.el.style.left = pos(v).x + 'px';
        v.el.style.top = pos(v).y + 'px';
      });
      redrawEdges();
      layoutAnim = k < 1 ? requestAnimationFrame(frame) : 0;
    }
    frame(t0);
  }

  function svg(tag, attrs) {
    var e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }

  function renderNode(project, v) {
    var n = v.node, t = T[n.type];
    var e = document.createElement('div');
    e.className = 'node cat-' + t.cat + ' t-' + n.type + (v.readonly ? ' ro' : '') + (v.loose ? ' loose' : '') + (v.h === COMPACT_H ? ' compact' : '');
    e.style.left = v.x + 'px';
    e.style.top = v.y + 'px';
    e.style.width = v.w + 'px';
    e.style.height = v.h + 'px';
    e.dataset.key = v.key;
    if (n.type === 'root') {
      var main = v.tree.id === project.mainTreeId;
      e.innerHTML = '<span class="nicon">' + I.icon('root', 14) + '</span><span class="rname">' + UI.esc(main ? 'ROOT' : 'ROOT') + '</span>' +
        (v.readonly || n.children.length ? '' : '<button class="quick-add" title="Click: add child · Drag: link to an existing node">' + I.icon('plus', 13) + '</button>');
      e.title = 'Root of tree ' + v.tree.name;
      return e;
    }
    var issues = issuesByNode[n.id] || [];
    var errLevel = issues.some(function (i) { return i.level === 'error'; }) ? 'error' : (issues.length ? 'warning' : '');
    var idx = firmwareIndexLabel(v);
    var html = '<div class="nhead"><span class="nicon">' + I.icon(t.icon, 13) + '</span><span class="ntype">' + UI.esc(t.label) + '</span>' +
      '<span class="nidx">' + UI.esc(idx) + '</span>' +
      (errLevel && !v.readonly ? '<span class="nerr ' + errLevel + '" title="' + UI.esc(issues.map(function (i) { return i.message; }).join('\n')) + '">!</span>' : '') +
      '</div>';
    if (v.body !== undefined && v.body !== '' || n.type === 'subtree') {
      var empty = t.field && t.field.kind === 'ident' && !n.props.code;
      html += '<div class="nbody' + (empty ? ' placeholder' : '') + (t.cat === 'control' ? ' label' : '') + '">' + UI.esc(v.body) + '</div>';
    }
    if (n.type === 'subtree' && project.trees[n.props.ref]) {
      html += '<button class="sub-toggle" title="' + (v.expanded ? 'Collapse' : 'Expand here') + '">' + I.icon(v.expanded ? 'collapse' : 'expand', 13) + '</button>';
    }
    // ports: "in" (top) links this node to a parent; the "+" (bottom) adds or links children
    if (!v.readonly) html += '<span class="port in" title="Drag to the parent node to link' + (v.parent ? ' (drop on empty space to disconnect)' : '') + '"></span>';
    if (t.maxChildren > n.children.length && !v.readonly) html += '<button class="quick-add" title="Click: add child · Drag: link to an existing node">' + I.icon('plus', 13) + '</button>';
    if (v.loose) html += '<span class="loose-tag">loose</span>';
    e.innerHTML = html;
    var tip = t.label + (v.body ? ': ' + v.body : '') + (idx ? '  (firmware index ' + idx + ')' : '') + (v.readonly ? '\n(inside subtree ' + v.tree.name + ', open it to edit)' : '') +
      (v.loose ? '\nLoose node: drag the top dot to a parent (or a parent’s + to here). The project cannot be saved while there are loose nodes.' : '');
    e.title = tip;
    return e;
  }

  function renderBreadcrumb() {
    var bc = document.getElementById('breadcrumb');
    if (!current) { bc.innerHTML = ''; return; }
    var p = current.project, tr = current.tree, tab = current.tab;
    var parts = ['<span class="bc-proj">' + I.icon('project', 13) + UI.esc(p.name) + '</span>'];
    if (tab.ctx) {
      tab.ctx.split('/').filter(Boolean).forEach(function (sid) {
        var host = findNodeAnywhere(p, sid);
        if (host) parts.push('<span>' + UI.esc(host.tree.name) + '</span>');
      });
    }
    parts.push('<b>' + (tr.id === p.mainTreeId ? I.icon('star', 12, 'star') : '') + UI.esc(tr.name) + '</b>');
    if (tab.ctx === null && tr.id !== p.mainTreeId) parts.push('<span class="bc-note" title="Opened from the workspace: the monitor shows the latest state of any instance of this subtree">all instances</span>');
    bc.innerHTML = parts.join('<i class="bc-sep">›</i>');
  }

  function findNodeAnywhere(project, nodeId) {
    for (var i = 0; i < project.treeOrder.length; i++) {
      var tr = project.trees[project.treeOrder[i]];
      if (tr.nodes[nodeId]) return { tree: tr, node: tr.nodes[nodeId] };
    }
    return null;
  }

  /* ------------------------------------------------------------------ *
   * Status & selection (cheap updates, no relayout)
   * ------------------------------------------------------------------ */
  var STATUS_CLASSES = ['st-running', 'st-success', 'st-fail', 'st-standby'];
  // fx = true when called because of a new event (not on a re-render): changed nodes "bump" and a
  // spark runs along the edge — down to the child when it starts running (the tick), up to the
  // parent when it returns success/failure (the result). Sparks cascade by depth.
  function updateStatuses(fx) {
    if (!current) return;
    var monitor = S.mode === 'monitor';
    var D = window.BTDebug;
    var cache = {};
    var changed = [];
    current.list.forEach(function (v) {
      var st = monitor && D ? D.nodeStatus(current.project, v.tree, v.node.id, v.ctx, cache) : null;
      var cls = st ? 'st-' + st : (monitor ? 'st-standby' : '');
      if (v.status !== cls) {
        STATUS_CLASSES.forEach(function (c) { v.el.classList.remove(c); });
        if (cls) v.el.classList.add(cls);
        if (v.edge) {
          STATUS_CLASSES.forEach(function (c) { v.edge.classList.remove(c); });
          if (cls) v.edge.classList.add(cls);
        }
        if (v.status !== undefined && st && st !== 'standby') changed.push({ v: v, st: st });
        v.status = cls;
      }
    });
    if (fx && monitor && changed.length && motionOK()) playEffects(changed);
    scheduleMinimap();
  }

  var liveSparks = 0;
  function playEffects(changed) {
    var down = changed.filter(function (c) { return c.st === 'running'; });
    var up = changed.filter(function (c) { return c.st !== 'running'; });
    var minD = Math.min.apply(null, down.map(function (c) { return c.v.depth; }).concat([99]));
    var maxD = Math.max.apply(null, up.map(function (c) { return c.v.depth; }).concat([0]));
    var STEP = 70;
    down.forEach(function (c) { effect(c.v, c.st, (c.v.depth - minD) * STEP); });
    up.forEach(function (c) { effect(c.v, c.st, (maxD - c.v.depth) * STEP); });
  }

  function effect(v, st, delay) {
    setTimeout(function () {
      if (!v.el.isConnected) return;
      v.el.classList.remove('bump'); void v.el.offsetWidth; v.el.classList.add('bump');
    }, delay + (st === 'running' ? 260 : 0));
    if (!v.edge || !v.parent || liveSparks > 80) return;
    var d = v.edge.getAttribute('d');
    liveSparks += 1;
    setTimeout(function () {
      if (!sparkLayer || !sparkLayer.isConnected) { liveSparks -= 1; return; }
      var dot = svg('circle', { r: 5, class: 'spark ' + st });
      var am = svg('animateMotion', { dur: '0.32s', begin: 'indefinite', fill: 'freeze', path: d, keyPoints: st === 'running' ? '0;1' : '1;0', keyTimes: '0;1', calcMode: 'linear' });
      dot.appendChild(am);
      sparkLayer.appendChild(dot);
      try { am.beginElement(); } catch (e) { /* SMIL unavailable */ }
      setTimeout(function () { dot.remove(); liveSparks -= 1; }, 420);
    }, delay);
  }

  // Timeline: highlights the node of the event being inspected.
  var focusEl = null;
  function focusEvent(nodeId, ctx, center) {
    if (focusEl) { focusEl.classList.remove('tl-focus'); focusEl = null; }
    if (!current || !nodeId) return;
    var v = current.byKey[nodeKey(ctx, nodeId)] || current.byKey[nodeKey(null, nodeId)];
    if (!v) return;
    focusEl = v.el;
    focusEl.classList.add('tl-focus');
    if (center) ensureVisible(v);
  }

  function applySelection() {
    if (!current) return;
    current.list.forEach(function (v) {
      v.el.classList.toggle('selected', Store.isSelected(v.node.id, v.ctx));
      if (v.edge) v.edge.classList.toggle('sel', S.edge === v.key);
    });
  }

  function selectedVNode() {
    var sel = S.selection;
    if (!current || !sel || sel.tabId !== current.tab.id) return null;
    return current.byKey[nodeKey(sel.ctx, sel.nodeId)] || null;
  }

  // Primary selected node first, then the ones added with Ctrl+click / box selection.
  function selectedVNodes() {
    var v = selectedVNode();
    if (!v) return [];
    return [v].concat(S.multi.map(function (m) { return current.byKey[nodeKey(m.ctx, m.nodeId)]; }).filter(Boolean));
  }

  function selectMany(vs) {
    if (!vs.length) { Store.select(null); return; }
    Store.select(vs[0].node.id, vs[0].ctx, vs[0].tree.id);
    S.multi = vs.slice(1).map(function (v) { return { nodeId: v.node.id, ctx: v.ctx }; });
    Store.emit('selection');
  }

  /* ------------------------------------------------------------------ *
   * Pan / zoom
   * ------------------------------------------------------------------ */
  function applyView() {
    world.style.transform = 'translate(' + view.tx + 'px,' + view.ty + 'px) scale(' + view.s + ')';
    document.getElementById('zoomLabel').textContent = Math.round(view.s * 100) + '%';
    wrap.style.setProperty('--grid', (20 * view.s) + 'px');
    wrap.style.backgroundPosition = view.tx + 'px ' + view.ty + 'px';
    wakeMinimap();
    scheduleMinimap();
  }

  // Smooth camera: every programmatic move (fit, zoom buttons, centering, minimap) glides.
  var camAnim = 0;
  function stopCamera() { if (camAnim) { cancelAnimationFrame(camAnim); camAnim = 0; } }
  function animateView(to, ms) {
    stopCamera();
    if (!motionOK() || !ms) { view = { tx: to.tx, ty: to.ty, s: to.s }; applyView(); return; }
    var from = { tx: view.tx, ty: view.ty, s: view.s }, t0 = performance.now();
    // interpolate the scale geometrically so zooming feels even
    function frame(now) {
      var k = Math.min(1, (now - t0) / ms), e = ease(k);
      var s = from.s * Math.pow(to.s / from.s, e);
      // keep the world point under the screen center on a straight path
      var r = wrap.getBoundingClientRect(), cx = r.width / 2, cy = r.height / 2;
      var wx0 = (cx - from.tx) / from.s, wy0 = (cy - from.ty) / from.s;
      var wx1 = (cx - to.tx) / to.s, wy1 = (cy - to.ty) / to.s;
      var wx = wx0 + (wx1 - wx0) * e, wy = wy0 + (wy1 - wy0) * e;
      view = { s: s, tx: cx - wx * s, ty: cy - wy * s };
      if (k >= 1) view = { tx: to.tx, ty: to.ty, s: to.s };
      applyView();
      camAnim = k < 1 ? requestAnimationFrame(frame) : 0;
    }
    camAnim = requestAnimationFrame(frame);
  }

  function zoomAt(factor, cx, cy, animate) {
    var r = wrap.getBoundingClientRect();
    if (cx === undefined) { cx = r.width / 2; cy = r.height / 2; }
    var base = camAnim && animate ? (camTarget || view) : view;
    var ns = Math.max(0.15, Math.min(2.5, base.s * factor));
    var to = { tx: cx - (cx - base.tx) * (ns / base.s), ty: cy - (cy - base.ty) * (ns / base.s), s: ns };
    if (animate) { camTarget = to; animateView(to, 220); return; }
    stopCamera();
    view = to;
    applyView();
  }
  var camTarget = null;

  // instant: no animation (first time a tab is shown)
  function fit(capAtOne, instant) {
    if (!current) return;
    var r = wrap.getBoundingClientRect();
    var b = current.bbox;
    var pad = 50;
    var s = Math.min((r.width - pad * 2) / Math.max(b.w, 1), (r.height - pad * 2 - 30) / Math.max(b.h, 1));
    s = Math.max(0.15, Math.min(capAtOne ? 1 : 1.6, s));
    var to = { s: s, tx: (r.width - b.w * s) / 2 - b.x * s, ty: Math.max(pad, (r.height - b.h * s) / 2 - 10) - b.y * s };
    animateView(to, instant ? 0 : 420);
  }

  function centerOn(v, animate) {
    if (!v) return;
    var r = wrap.getBoundingClientRect();
    var tx = r.width / 2 - (v.cx) * view.s;
    var ty = r.height / 2 - (v.y + v.h / 2) * view.s;
    animateView({ tx: tx, ty: ty, s: view.s }, animate ? 360 : 0);
  }

  function centerOnPoint(p, animate) {
    var r = wrap.getBoundingClientRect();
    animateView({ tx: r.width / 2 - p.x * view.s, ty: r.height / 2 - p.y * view.s, s: view.s }, animate ? 300 : 0);
  }

  // Pan inertia: a quick flick keeps the canvas gliding for a moment.
  function glide(vx, vy) {
    stopCamera();
    if (!motionOK()) return;
    var last = performance.now();
    function frame(now) {
      var dt = Math.min(40, now - last); last = now;
      view.tx += vx * dt; view.ty += vy * dt;
      var f = Math.pow(0.992, dt);
      vx *= f; vy *= f;
      applyView();
      camAnim = Math.abs(vx) + Math.abs(vy) > 0.02 ? requestAnimationFrame(frame) : 0;
    }
    camAnim = requestAnimationFrame(frame);
  }

  function ensureVisible(v) {
    if (!v) return;
    var r = wrap.getBoundingClientRect();
    var x0 = v.x * view.s + view.tx, y0 = v.y * view.s + view.ty;
    var x1 = x0 + v.w * view.s, y1 = y0 + v.h * view.s;
    var m = 40;
    if (x0 < m || y0 < m || x1 > r.width - m || y1 > r.height - m) centerOn(v, true);
  }

  /* ------------------------------------------------------------------ *
   * Edit actions (used by canvas, palette, inspector and shortcuts)
   * ------------------------------------------------------------------ */
  function editable(v) {
    return S.mode === 'editor' && v && !v.readonly;
  }

  function guardEditor() {
    if (S.mode !== 'editor') { UI.toast('Switch to Editor mode to edit the tree.', 'warning'); return false; }
    return true;
  }

  function addChild(v, type, index, props) {
    if (!guardEditor() || !v) return null;
    if (v.readonly) { UI.toast('This node belongs to another tree. Open the subtree to edit it.', 'warning'); return null; }
    var tree = v.tree;
    if (!M.canAcceptChild(tree, v.node.id, type)) {
      var t = T[v.node.type];
      UI.toast(t.maxChildren === 0 ? t.label + ' does not accept children.' : t.label + ' accepts at most ' + t.maxChildren + ' child.', 'warning');
      return null;
    }
    var created = null;
    Store.mutate(current.project.id, function () {
      created = M.addNode(tree, M.makeNode(type, Object.assign({}, defaultProps(type), props)), v.node.id, index);
    });
    if (created) { Store.select(created.id, v.ctx, tree.id); afterCreate(created, !!props); }
    return created;
  }

  function defaultProps(type) {
    if (type === 'subtree') {
      var p = current.project;
      var candidate = p.treeOrder.map(function (id) { return p.trees[id]; }).find(function (t) { return t.id !== current.tree.id && t.id !== p.mainTreeId; });
      return { ref: candidate ? candidate.id : '' };
    }
    return undefined;
  }

  function afterCreate(node, quiet) {
    var t = T[node.type];
    if (quiet) return;
    if (t.field || node.type === 'subtree') setTimeout(function () { if (window.BTInspector) window.BTInspector.focusField(); }, 60);
  }

  function addSibling(v, type, after, props) {
    if (!v || !v.parent || v.node.type === 'root') return null;
    var p = v.parent;
    var idx = p.node.children.indexOf(v.node.id) + (after ? 1 : 0);
    return addChild(p, type, idx, props);
  }

  // Del: removes only the selected nodes (their children stay on the canvas, loose),
  // or disconnects the selected edge.
  function deleteSelection() {
    if (!guardEditor() || !current) return;
    var edgeChild = S.edge && current.byKey[S.edge];
    if (edgeChild) { disconnect(edgeChild); return; }
    var all = selectedVNodes();
    var vs = all.filter(function (v) { return !v.readonly && v.node.type !== 'root'; });
    if (!vs.length) {
      if (all.length) UI.toast(all[0].readonly ? 'Open the subtree to delete its nodes.' : 'The Root cannot be deleted.', 'warning');
      return;
    }
    var tree = vs[0].tree, ctx = vs[0].ctx, parent = vs[0].parent;
    Store.mutate(current.project.id, function () {
      return M.deleteOnly(tree, vs.map(function (v) { return v.node.id; }), function (cid) {
        var c = current.byKey[nodeKey(ctx, cid)];
        return c ? { x: c.x, y: c.y } : { x: 0, y: 0 };
      });
    });
    if (parent && tree.nodes[parent.node.id]) Store.select(parent.node.id, ctx, tree.id); else Store.select(null);
  }

  // Removes the node together with its whole branch.
  function deleteBranch(v) {
    if (!guardEditor() || !v || v.readonly || v.node.type === 'root') return;
    var parent = v.parent;
    Store.mutate(current.project.id, function () { return M.deleteNode(v.tree, v.node.id); });
    if (parent) Store.select(parent.node.id, v.ctx, v.tree.id); else Store.select(null);
  }

  function moveSibling(v, delta) {
    if (!guardEditor() || !v || !v.parent || v.readonly) return;
    var arr = v.parent.node.children;
    var i = arr.indexOf(v.node.id), j = i + delta;
    if (j < 0 || j >= arr.length) return;
    Store.mutate(current.project.id, function () { arr.splice(i, 1); arr.splice(j, 0, v.node.id); });
  }

  function wrapWith(v, type, props) {
    if (!guardEditor() || !v || v.readonly || v.node.type === 'root') return;
    var w = null;
    Store.mutate(current.project.id, function () {
      w = M.wrapNode(v.tree, v.node.id, type);
      if (w && props) Object.assign(w.props, props);
      return !!w;
    });
    if (w) { Store.select(w.id, v.ctx, v.tree.id); afterCreate(w, !!props); }
  }

  function changeTypeOf(v, type) {
    if (!guardEditor() || !v || v.readonly) return;
    var ok = Store.mutate(current.project.id, function () { return M.changeType(v.tree, v.node.id, type); });
    if (!ok) UI.toast('Not possible: the node has more children than ' + T[type].label + ' accepts.', 'warning');
  }

  // Clipboard = forest of branches. Ctrl+C copies only the selected nodes (links between them kept).
  function setClipboard(forest, what) {
    S.clipboard = forest;
    UI.copyText(JSON.stringify({ btstudio: 2, forest: forest }));
    UI.toast('Copied: ' + what, 'info', 1600);
  }

  function copySelection(cut) {
    var vs = selectedVNodes().filter(function (v) { return v.node.type !== 'root'; });
    if (!vs.length) return;
    vs = vs.filter(function (v) { return v.tree === vs[0].tree; });
    var one = vs[0];
    setClipboard(M.exportSelection(one.tree, vs.map(function (v) { return v.node.id; })),
      vs.length === 1 ? T[one.node.type].label + (one.body ? ' "' + one.body + '"' : '') : vs.length + ' nodes');
    if (cut) deleteSelection();
  }

  function copyBranch(v) {
    if (!v || v.node.type === 'root') return;
    setClipboard([M.exportBranch(v.tree, v.node.id)], 'branch of ' + T[v.node.type].label + ' (' + M.collectSubtree(v.tree, v.node.id).length + ' nodes)');
  }

  // A single copied branch goes under v (or next to it); anything else is pasted loose beside v.
  function pasteInto(v) {
    if (!guardEditor() || !S.clipboard || !v) return;
    if (v.readonly) { UI.toast('Open the subtree to paste into it.', 'warning'); return; }
    var forest = S.clipboard;
    if (forest.length === 1) {
      var type = forest[0].type, target = null, index;
      if (M.canAcceptChild(v.tree, v.node.id, type)) target = v;
      else if (v.parent && M.canAcceptChild(v.tree, v.parent.node.id, type)) { target = v.parent; index = v.parent.node.children.indexOf(v.node.id) + 1; }
      if (target) {
        var created = null;
        Store.mutate(current.project.id, function () { created = M.importBranch(target.tree, forest[0], target.node.id, index); });
        Store.select(created.id, target.ctx, target.tree.id);
        return;
      }
    }
    pasteForest(forest, { x: v.cx + v.w, y: v.y + v.h / 2 });
  }

  function pasteForest(forest, p) {
    var tree = current.tree, made = [];
    Store.mutate(current.project.id, function () {
      forest.forEach(function (b, i) {
        var n = M.importBranch(tree, b, null);
        n.pos = { x: Math.round(p.x - MIN_W / 2 + i * (MIN_W + 40)), y: Math.round(p.y - CARD_H / 2) };
        made.push(n);
      });
    });
    Store.select(made[0].id, current.tab.ctx, tree.id);
    S.multi = made.slice(1).map(function (n) { return { nodeId: n.id, ctx: current.tab.ctx }; });
    Store.emit('selection');
  }

  // Ctrl+D: copies of the selected nodes only; a single one goes right after the original.
  function duplicate() {
    var vs = selectedVNodes().filter(function (v) { return !v.readonly && v.node.type !== 'root'; });
    if (!guardEditor() || !vs.length) return;
    var tree = vs[0].tree;
    var forest = M.exportSelection(tree, vs.map(function (v) { return v.node.id; }));
    var top = vs.filter(function (v) { return vs.indexOf(v.parent) < 0; });
    var r = top[0];
    if (forest.length === 1 && r.parent && M.canAcceptChild(tree, r.parent.node.id, forest[0].type)) {
      var created = null;
      Store.mutate(current.project.id, function () { created = M.importBranch(tree, forest[0], r.parent.node.id, r.parent.node.children.indexOf(r.node.id) + 1); });
      Store.select(created.id, r.ctx, tree.id);
      return;
    }
    pasteForest(forest, { x: r.cx + r.w + 40, y: r.y + r.h / 2 });
  }

  function extractSubtree(v) {
    if (!guardEditor() || !v || v.readonly || v.node.type === 'root') return;
    var p = current.project;
    UI.prompt('Convert to subtree', 'Name of the new subtree', M.uniqueName('subtree', M.treeNames(p)), function (val) {
      if (!M.C_IDENT_RE.test(val)) return 'Use letters, digits and _ (not starting with a digit).';
      if (M.findTreeByName(p, val)) return 'A tree with this name already exists.';
      return null;
    }).then(function (name) {
      if (!name) return;
      var subNode = null;
      Store.mutate(p.id, function () {
        var branch = M.exportBranch(v.tree, v.node.id);
        var nt = M.makeTree(name, false);
        M.importBranch(nt, branch, nt.rootId);
        M.addTreeToProject(p, nt);
        var parentId = v.node.parent;
        var idx = v.tree.nodes[parentId].children.indexOf(v.node.id);
        M.deleteNode(v.tree, v.node.id);
        subNode = M.addNode(v.tree, M.makeNode('subtree', { ref: nt.id }), parentId, idx);
      });
      if (subNode) { Store.select(subNode.id, v.ctx, v.tree.id); UI.toast('Subtree "' + name + '" created.', 'success'); }
    });
  }

  function worldPoint(clientX, clientY) {
    var r = wrap.getBoundingClientRect();
    return { x: (clientX - r.left - view.tx) / view.s, y: (clientY - r.top - view.ty) / view.s };
  }

  function viewCenter() {
    var r = wrap.getBoundingClientRect();
    return worldPoint(r.left + r.width / 2, r.top + r.height / 2);
  }

  // Creates a loose node (no parent) centered at world point p.
  function addLoose(type, p, props) {
    if (!guardEditor() || !current) return null;
    var tree = current.tree, created = null;
    Store.mutate(current.project.id, function () {
      created = M.addNode(tree, M.makeNode(type, Object.assign({}, defaultProps(type), props)), null);
      created.pos = { x: Math.round(p.x - MIN_W / 2), y: Math.round(p.y - CARD_H / 2) };
    });
    Store.select(created.id, current.tab.ctx, tree.id);
    afterCreate(created, !!props);
    return created;
  }

  function pasteLoose(p) {
    if (!guardEditor() || !S.clipboard || !current) return;
    pasteForest(S.clipboard, p);
  }

  // Unlinks v from its parent; it stays on the canvas at p (top-left), as a loose node.
  function disconnect(v, p) {
    if (!guardEditor() || !v || v.readonly || v.node.type === 'root') return;
    p = p || { x: v.x, y: v.y + 40 };
    Store.mutate(current.project.id, function () { return M.floatNode(v.tree, v.node.id, p); });
    Store.select(v.node.id, v.ctx, v.tree.id);
  }

  // Index among parentV's children (ignoring childV) for a node placed at world x.
  function childIndexAt(parentV, childV, x) {
    var idx = 0;
    parentV.children.forEach(function (c) { if (c !== childV && c.cx < x) idx += 1; });
    var old = parentV.node.children.indexOf(childV ? childV.node.id : null);
    if (old >= 0 && old < idx + 1) idx += 1; // moveNode counts the node's old slot
    return idx;
  }

  function link(childV, parentV, x) {
    var idx = childIndexAt(parentV, childV, x);
    var ok = Store.mutate(current.project.id, function () { return M.linkNode(parentV.tree, childV.node.id, parentV.node.id, idx); });
    if (!ok) UI.toast('Link not allowed.', 'warning');
    else Store.select(childV.node.id, parentV.ctx, parentV.tree.id);
  }

  function openSubtree(v) {
    var ref = current.project.trees[v.node.props.ref];
    if (!ref) { UI.toast('This SubTree does not point to a valid tree.', 'warning'); return; }
    Store.openTab(current.project.id, ref.id, childCtx(v.ctx, v.node.id));
  }

  function toggleExpand(v) {
    var k = expandKey(v.ctx, v.node.id);
    if (S.expanded[k]) delete S.expanded[k]; else S.expanded[k] = true;
    Store.emit('structure');
  }

  /* ------------------------------------------------------------------ *
   * Menus
   * ------------------------------------------------------------------ */
  function typeMenu(filter, onPick) {
    var groups = [];
    M.PALETTE.forEach(function (g) {
      var items = g.types.filter(filter).map(function (type) {
        return { label: T[type].label, icon: T[type].icon, action: function () { onPick(type); } };
      });
      if (items.length) { if (groups.length) groups.push('-'); groups.push({ header: g.title }); groups = groups.concat(items); }
    });
    return groups;
  }

  function nodeMenu(v, x, y) {
    var n = v.node, t = T[n.type];
    var items = [];
    var edit = S.mode === 'editor' && !v.readonly;
    if (n.type === 'subtree') {
      items.push({ label: 'Open subtree', icon: 'external', shortcut: 'Double-click', action: function () { openSubtree(v); } });
      items.push({ label: v.expanded ? 'Collapse' : 'Expand here', icon: v.expanded ? 'collapse' : 'expand', shortcut: 'E', action: function () { toggleExpand(v); } });
      items.push('-');
    }
    if (v.readonly) {
      items.push({ label: 'Open ' + v.tree.name + ' to edit', icon: 'external', action: function () { openSubtree(findHost(v)); } });
      items.push({ label: 'Center', icon: 'target', action: function () { centerOn(v, true); } });
      UI.contextMenu(x, y, items);
      return;
    }
    var many = selectedVNodes();
    if (edit && many.length > 1 && Store.isSelected(n.id, v.ctx)) {
      UI.contextMenu(x, y, [
        { header: many.length + ' nodes selected' },
        { label: 'Copy', icon: 'copy', shortcut: UI.kbd('Ctrl+C'), action: function () { copySelection(); } },
        { label: 'Cut', icon: 'scissors', shortcut: UI.kbd('Ctrl+X'), action: function () { copySelection(true); } },
        { label: 'Duplicate', icon: 'duplicate', shortcut: UI.kbd('Ctrl+D'), action: duplicate },
        '-',
        { label: 'Delete', icon: 'trash', shortcut: 'Del', danger: true, action: deleteSelection }
      ]);
      return;
    }
    if (edit) {
      var canChild = t.maxChildren > n.children.length;
      var isRoot = n.type === 'root';
      if (canChild) items.push({ label: 'Add child', icon: 'plus', submenu: typeMenu(function () { return true; }, function (ty) { addChild(v, ty); }) });
      if (v.parent && M.canAcceptChild(v.tree, v.parent.node.id, 'action')) items.push({ label: 'Add sibling', icon: 'arrow-right', submenu: typeMenu(function () { return true; }, function (ty) { addSibling(v, ty, true); }) });
      if (v.parent) items.push({ label: 'Wrap with', icon: 'wrap', submenu: typeMenu(function (ty) { return M.isDecorator(ty) || M.isControl(ty); }, function (ty) { wrapWith(v, ty); }) });
      var swapTypes = isRoot ? [] : Object.keys(T).filter(function (ty) {
        if (ty === n.type || ty === 'root' || ty === 'unknown') return false;
        var tt = T[ty];
        if (t.cat === 'control') return tt.cat === 'control';
        if (t.cat === 'decorator') return tt.cat === 'decorator';
        if (n.type === 'action' || n.type === 'condition') return ty === 'action' || ty === 'condition';
        return false;
      });
      if (swapTypes.length) items.push({ label: 'Change type', icon: 'swap', submenu: typeMenu(function (ty) { return swapTypes.indexOf(ty) >= 0; }, function (ty) { changeTypeOf(v, ty); }) });
      if (items.length) items.push('-');
      if (!isRoot) {
        items.push({ label: 'Copy', icon: 'copy', shortcut: UI.kbd('Ctrl+C'), action: function () { copySelection(); } });
        if (n.children.length) items.push({ label: 'Copy branch', icon: 'copy', action: function () { copyBranch(v); } });
        items.push({ label: 'Cut', icon: 'scissors', shortcut: UI.kbd('Ctrl+X'), action: function () { copySelection(true); } });
      }
      items.push({ label: 'Paste', icon: 'paste', shortcut: UI.kbd('Ctrl+V'), disabled: !S.clipboard, action: function () { pasteInto(v); } });
      if (!isRoot) items.push({ label: 'Duplicate', icon: 'duplicate', shortcut: UI.kbd('Ctrl+D'), action: duplicate });
      if (v.parent) {
        items.push('-');
        if (n.type !== 'subtree') items.push({ label: 'Convert to subtree…', icon: 'subtree', action: function () { extractSubtree(v); } });
        items.push({ label: 'Disconnect from parent', icon: 'unplug', action: function () { disconnect(v); } });
      }
      if (!isRoot) {
        items.push('-');
        items.push({ label: 'Delete', icon: 'trash', shortcut: 'Del', danger: true, action: deleteSelection });
        if (n.children.length) items.push({ label: 'Delete branch', icon: 'trash', danger: true, action: function () { deleteBranch(v); } });
      }
    } else {
      items.push({ label: 'Center', icon: 'target', action: function () { centerOn(v, true); } });
      if (t.field && t.field.kind === 'ident' && n.props.code) items.push({ label: 'Copy function name', icon: 'copy', action: function () { UI.copyText(n.props.code, 'Copied: ' + n.props.code); } });
      if (S.mode === 'monitor') items.push({ label: 'Back to Editor to modify', icon: 'edit', action: function () { Store.setMode('editor'); } });
    }
    UI.contextMenu(x, y, items);
  }

  function findHost(v) { var h = v; while (h && !h.subtreeHost) h = h.parent; return h ? h.subtreeHost : v; }

  function edgeMenu(childV, x, y) {
    if (S.mode !== 'editor') return canvasMenu(x, y);
    Store.select(childV.node.id, childV.ctx, childV.tree.id);
    UI.contextMenu(x, y, [
      { header: T[childV.parent.node.type].label + ' → ' + T[childV.node.type].label },
      { label: 'Insert node here', icon: 'wrap', submenu: typeMenu(function (ty) { return M.isDecorator(ty) || M.isControl(ty); }, function (ty) { wrapWith(childV, ty); }) },
      { label: 'Disconnect', icon: 'unplug', danger: true, action: function () { disconnect(childV); } }
    ]);
  }

  function canvasMenu(x, y) {
    var at = worldPoint(x, y);
    var items = [
      { label: 'Fit to screen', icon: 'fit', shortcut: 'F', action: function () { fit(); } },
      { label: 'Zoom 100%', icon: 'search', shortcut: '0', action: function () { view.s = 1; applyView(); } }
    ];
    if (S.mode === 'editor' && current) {
      items.push('-');
      items.push({ label: 'New loose node here', icon: 'plus', submenu: typeMenu(function () { return true; }, function (ty) { addLoose(ty, at); }) });
      items.push({ label: 'Paste here (loose)', icon: 'paste', disabled: !S.clipboard, action: function () { pasteLoose(at); } });
      var root = current.root;
      items.push({ label: 'Paste into Root', icon: 'paste', disabled: !S.clipboard || S.clipboard.length !== 1 || !M.canAcceptChild(current.tree, root.node.id, S.clipboard[0].type), action: function () { pasteInto(root); } });
      items.push({ label: 'Expand all subtrees', icon: 'expand', action: function () { setAllExpanded(true); } });
      items.push({ label: 'Collapse all subtrees', icon: 'collapse', action: function () { setAllExpanded(false); } });
    } else if (current) {
      items.push('-');
      items.push({ label: 'Expand all subtrees', icon: 'expand', action: function () { setAllExpanded(true); } });
      items.push({ label: 'Collapse all subtrees', icon: 'collapse', action: function () { setAllExpanded(false); } });
    }
    UI.contextMenu(x, y, items);
  }

  function setAllExpanded(on) {
    if (!current) return;
    // expand repeatedly so nested subtrees open as well
    for (var pass = 0; pass < (on ? 6 : 1); pass++) {
      var vm = buildView(current.project, current.tree, current.tab.ctx);
      var changed = false;
      vm.list.forEach(function (v) {
        if (v.node.type !== 'subtree') return;
        var k = expandKey(v.ctx, v.node.id);
        if (on && !S.expanded[k] && current.project.trees[v.node.props.ref]) { S.expanded[k] = true; changed = true; }
        if (!on && S.expanded[k]) { delete S.expanded[k]; changed = true; }
      });
      if (!changed) break;
    }
    Store.emit('structure');
    setTimeout(function () { fit(); }, 30);
  }

  /* ------------------------------------------------------------------ *
   * Pointer interaction: pan, select, drag nodes, drop from palette, link ports
   * ------------------------------------------------------------------ */
  var drag = null; // { kind: 'pan'|'node'|'palette'|'link', ... }
  var ghost, dropIndicator, selBox, linkLine = null;

  function selectAll() {
    if (!current || S.mode !== 'editor') return;
    selectMany(current.list.filter(function (v) { return !v.readonly && v.node.type !== 'root'; }));
  }

  function vnodeFromEl(target) {
    var e = target && target.closest ? target.closest('.node') : null;
    return e && current ? current.byKey[e.dataset.key] : null;
  }

  function onPointerDown(e) {
    if (e.button === 2) return;
    stopCamera();
    UI.closeMenus();
    if (window.BTCommand) window.BTCommand.close();
    wrap.focus({ preventScroll: true });
    var v = vnodeFromEl(e.target);
    if (e.target.closest('.sub-toggle') && v) { e.stopPropagation(); toggleExpand(v); return; }
    var port = e.target.closest('.quick-add, .port.in');
    if (port && v && e.button === 0 && editable(v)) {
      e.stopPropagation();
      Store.select(v.node.id, v.ctx, v.tree.id);
      drag = { kind: 'link', from: port.classList.contains('in') ? 'in' : 'out', v: v, port: port, sx: e.clientX, sy: e.clientY, started: false, pointerId: e.pointerId };
      return;
    }
    // overlays (empty state, zoom bar, breadcrumb) keep their own clicks
    if (!v && e.target.closest('#emptyState, #zoomBar, #breadcrumb, #monitorBadge, #minimap, #timeline')) return;
    var edgeHit = e.target.closest('.edge-hit');
    if (!v && edgeHit && e.button === 0 && S.mode === 'editor') { Store.selectEdge(edgeHit.dataset.key); return; }
    if (v && e.button === 0) {
      if (e.ctrlKey || e.metaKey || e.shiftKey) { Store.toggleSelect(v.node.id, v.ctx, v.tree.id); return; }
      // clicking inside a multi-selection keeps it until the click ends (it may become a drag)
      var keep = S.multi.length && Store.isSelected(v.node.id, v.ctx);
      if (!keep) Store.select(v.node.id, v.ctx, v.tree.id);
      if (editable(v) && v.node.type !== 'root') {
        drag = { kind: 'node', v: v, sx: e.clientX, sy: e.clientY, started: false, pointerId: e.pointerId, keep: keep };
      }
      return;
    }
    if (e.button === 0 && e.shiftKey && current) {
      drag = { kind: 'box', sx: e.clientX, sy: e.clientY, pointerId: e.pointerId };
      wrap.setPointerCapture(e.pointerId);
      return;
    }
    if (e.button === 0 || e.button === 1) {
      if (!v && e.button === 0) Store.select(null);
      drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, tx: view.tx, ty: view.ty, pointerId: e.pointerId, samples: [] };
      wrap.setPointerCapture(e.pointerId);
      wrap.classList.add('panning');
    }
  }

  function startPaletteDrag(type, e) {
    if (!guardEditor()) return;
    if (!current) { UI.toast('Open a tree first.', 'warning'); return; }
    drag = { kind: 'palette', type: type, sx: e.clientX, sy: e.clientY, started: false, pointerId: e.pointerId };
  }

  function onPointerMove(e) {
    if (!drag) return;
    if (drag.kind === 'box') {
      var a = worldPoint(drag.sx, drag.sy), b = worldPoint(e.clientX, e.clientY);
      drag.rect = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
      selBox.hidden = false;
      Object.assign(selBox.style, { left: drag.rect.x + 'px', top: drag.rect.y + 'px', width: drag.rect.w + 'px', height: drag.rect.h + 'px' });
      return;
    }
    if (drag.kind === 'pan') {
      view.tx = drag.tx + (e.clientX - drag.sx);
      view.ty = drag.ty + (e.clientY - drag.sy);
      drag.samples.push({ x: e.clientX, y: e.clientY, t: performance.now() });
      if (drag.samples.length > 6) drag.samples.shift();
      applyView();
      return;
    }
    if (!drag.started) {
      if (Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) < 6) return;
      drag.started = true;
      var type = drag.kind === 'palette' ? drag.type : drag.v.node.type;
      ghost.innerHTML = '<span class="nicon">' + I.icon(T[type].icon, 13) + '</span>' + UI.esc(drag.kind === 'palette' ? T[type].label : (drag.v.body || T[type].label));
      ghost.className = 'cat-' + T[type].cat;
      ghost.hidden = false;
      if (drag.kind === 'node') drag.v.el.classList.add('dragging');
      if (drag.kind === 'link') { linkLine = svg('path', { class: 'link-line' }); edgesLayer.appendChild(linkLine); }
      document.body.classList.add('dragging-node');
    }
    ghost.style.transform = 'translate(' + (e.clientX + 12) + 'px,' + (e.clientY + 8) + 'px)';
    var hit = document.elementFromPoint(e.clientX, e.clientY);
    var target = vnodeFromEl(hit);
    var onCanvas = !!(hit && hit.closest('#canvasWrap') && !hit.closest('#zoomBar, #breadcrumb, #monitorBadge, #emptyState, #minimap, #timeline'));
    if (drag.kind === 'link') {
      var p = worldPoint(e.clientX, e.clientY), v = drag.v;
      var ax = v.cx, ay = drag.from === 'out' ? v.y + v.h : v.y;
      var bend = Math.max(30, Math.abs(p.y - ay) / 2) * (drag.from === 'out' ? 1 : -1);
      linkLine.setAttribute('d', 'M' + ax + ' ' + ay + 'C' + ax + ' ' + (ay + bend) + ' ' + p.x + ' ' + (p.y - bend) + ' ' + p.x + ' ' + p.y);
      drag.drop = target ? computeLink(target) : (onCanvas ? { free: true } : null);
      linkLine.classList.toggle('bad', !!(drag.drop && drag.drop.target && !drag.drop.ok));
    } else {
      drag.drop = target ? computeDrop(target, e) : (onCanvas ? freeDrop(e) : null);
    }
    showDropIndicator(drag.drop);
    // auto-pan near edges
    var r = wrap.getBoundingClientRect();
    var m = 30, dx = 0, dy = 0;
    if (e.clientX < r.left + m && e.clientX > r.left) dx = 12; else if (e.clientX > r.right - m && e.clientX < r.right) dx = -12;
    if (e.clientY < r.top + m && e.clientY > r.top) dy = 12; else if (e.clientY > r.bottom - m && e.clientY < r.bottom) dy = -12;
    if (dx || dy) { view.tx += dx; view.ty += dy; applyView(); }
  }

  // Dragging from a port: "out" (the + below) links the target as a child of drag.v,
  // "in" (dot on top) links drag.v as a child of the target.
  function computeLink(target) {
    if (target === drag.v) return { target: target, self: true };
    var parentV = drag.from === 'out' ? drag.v : target, childV = drag.from === 'out' ? target : drag.v;
    var res = { target: target, zone: 'inside', link: true, parentV: parentV, childV: childV, ok: false };
    var pt = T[parentV.node.type];
    if (target.readonly || parentV.tree !== childV.tree) res.reason = 'Node from another tree';
    else if (childV.node.type === 'root') res.reason = 'The Root cannot have a parent';
    else if (M.isAncestor(parentV.tree, childV.node.id, parentV.node.id)) res.reason = 'Would create a cycle';
    else if (childV.node.parent !== parentV.node.id && !M.canAcceptChild(parentV.tree, parentV.node.id, childV.node.type)) {
      res.reason = pt.maxChildren === 0 ? pt.label + ' does not accept children' : pt.label + ' already has the maximum number of children';
    } else res.ok = true;
    return res;
  }

  function computeDrop(target, e) {
    if (target.readonly) return { target: target, ok: false, reason: 'Node from another tree' };
    var type = drag.kind === 'node' ? drag.v.node.type : drag.type;
    var r = target.el.getBoundingClientRect();
    var fx = (e.clientX - r.left) / r.width;
    var zone = target.node.type === 'root' ? 'inside' : (fx < 0.25 ? 'before' : (fx > 0.75 ? 'after' : 'inside'));
    var tree = target.tree;
    var copy = drag.kind === 'node' && (e.ctrlKey || e.metaKey);
    if (drag.kind === 'node') {
      if (drag.v.tree !== tree) return { target: target, ok: false };
      if (target === drag.v) return { target: target, self: true };
      if (M.isAncestor(tree, drag.v.node.id, target.node.id) && !copy) return { target: target, zone: zone, ok: false, reason: 'Cannot drop inside itself' };
    }
    if (zone === 'inside') {
      var sameParent = drag.kind === 'node' && !copy && drag.v.node.parent === target.node.id;
      if (sameParent || M.canAcceptChild(tree, target.node.id, type)) return { target: target, zone: 'inside', ok: true, copy: copy };
      if (drag.kind === 'palette' && (M.isDecorator(type) || M.isControl(type)) && target.node.type !== 'root' && target.parent) return { target: target, zone: 'wrap', ok: true };
      return { target: target, zone: 'inside', ok: false, reason: T[target.node.type].maxChildren === 0 ? T[target.node.type].label + ' does not accept children' : 'Child limit reached' };
    }
    var parent = target.parent;
    if (!parent || parent.readonly) return { target: target, zone: zone, ok: false, reason: 'No parent to insert next to' };
    var same = drag.kind === 'node' && !copy && drag.v.node.parent === parent.node.id;
    var ok = same || M.canAcceptChild(tree, parent.node.id, type);
    return { target: target, zone: zone, ok: ok, copy: copy, reason: ok ? '' : T[parent.node.type].label + ' does not accept more children' };
  }

  // A linked node dropped on empty space is only reordered among its siblings (by x): moving a
  // node sideways changes the tree's behavior, never its links. Unlinking is done via the top dot.
  function freeDrop(e) {
    var d = { free: true, copy: drag.kind === 'node' && (e.ctrlKey || e.metaKey) }, v = drag.v;
    if (drag.kind !== 'node' || d.copy || !v.parent) return d;
    var x = worldPoint(e.clientX, e.clientY).x;
    var sibs = v.parent.children.filter(function (c) { return c !== v; });
    var n = sibs.filter(function (c) { return c.cx < x; }).length;
    d.reorder = true;
    d.index = childIndexAt(v.parent, v, x);
    if (sibs.length) d.bar = n < sibs.length ? { target: sibs[n], zone: 'before' } : { target: sibs[n - 1], zone: 'after' };
    return d;
  }

  function freeHint(d) {
    if (drag.kind === 'palette') return 'Create loose node here';
    if (drag.kind === 'link') return drag.from === 'out' ? 'Create child…' : (drag.v.parent ? 'Disconnect from parent' : 'Move here');
    if (d.copy) return 'Copy as loose node';
    if (d.reorder) return d.bar ? 'Reorder among siblings' : 'Only child: nothing to reorder';
    return 'Move here';
  }

  function showDropIndicator(d) {
    if (d && d.bar) {
      var hint = freeHint(d);
      showDropIndicator({ target: d.bar.target, zone: d.bar.zone, ok: true });
      ghost.dataset.hint = hint;
      return;
    }
    if (!d || d.self || d.free) {
      dropIndicator.hidden = true;
      ghost.dataset.hint = d && d.free ? freeHint(d) : '';
      ghost.classList.remove('bad');
      return;
    }
    var v = d.target;
    dropIndicator.hidden = false;
    dropIndicator.className = 'drop-ind ' + (d.ok ? 'ok ' : 'bad ') + (d.zone || 'inside');
    var pad = 4;
    if (d.zone === 'before' || d.zone === 'after') {
      var x = d.zone === 'before' ? v.x - H_GAP / 2 - 2 : v.x + v.w + H_GAP / 2 - 2;
      Object.assign(dropIndicator.style, { left: x + 'px', top: (v.y - 4) + 'px', width: '4px', height: (v.h + 8) + 'px' });
    } else {
      Object.assign(dropIndicator.style, { left: (v.x - pad) + 'px', top: (v.y - pad) + 'px', width: (v.w + pad * 2) + 'px', height: (v.h + pad * 2) + 'px' });
    }
    var hints = { inside: 'Add as child', before: 'Insert before', after: 'Insert after', wrap: 'Wrap this node' };
    var ok = d.link ? (drag.from === 'out' ? 'Link as child' : 'Link to this parent') : (d.copy ? 'Copy: ' : '') + hints[d.zone];
    ghost.dataset.hint = d.ok ? ok : (d.reason || 'Not allowed');
    ghost.classList.toggle('bad', !d.ok);
  }

  function onPointerUp(e) {
    if (!drag) return;
    var d = drag;
    drag = null;
    wrap.classList.remove('panning');
    if (d.kind === 'pan') {
      var sm = d.samples, a = sm[0], b = sm[sm.length - 1];
      if (a && b && b.t - a.t > 10 && performance.now() - b.t < 60) {
        var vx = (b.x - a.x) / (b.t - a.t), vy = (b.y - a.y) / (b.t - a.t);
        if (Math.abs(vx) + Math.abs(vy) > 0.35) glide(vx, vy);
      }
      return;
    }
    if (d.kind === 'box') {
      selBox.hidden = true;
      var r = d.rect;
      if (r) selectMany(current.list.filter(function (v) {
        return !v.readonly && v.node.type !== 'root' && v.x < r.x + r.w && v.x + v.w > r.x && v.y < r.y + r.h && v.y + v.h > r.y;
      }));
      return;
    }
    ghost.hidden = true;
    dropIndicator.hidden = true;
    document.body.classList.remove('dragging-node');
    if (linkLine) { linkLine.remove(); linkLine = null; }
    if (d.kind === 'node' && d.v.el) d.v.el.classList.remove('dragging');
    var all = function () { return true; };
    if (!d.started) {
      if (d.kind === 'node' && d.keep) Store.select(d.v.node.id, d.v.ctx, d.v.tree.id);
      if (d.kind === 'palette') addFromPalette(d.type);
      if (d.kind === 'link' && d.from === 'out') {
        var r = d.port.getBoundingClientRect();
        if (window.BTCommand) window.BTCommand.quickAdd({ target: d.v, force: 'child', x: r.left + r.width / 2, y: r.bottom + 6 });
        else UI.contextMenu(r.left, r.bottom + 4, [{ header: 'Add child to ' + T[d.v.node.type].label }].concat(typeMenu(all, function (ty) { addChild(d.v, ty); })));
      }
      return;
    }
    var drop = d.drop;
    if (!drop || drop.self || e.type === 'pointercancel') return;
    var p = worldPoint(e.clientX, e.clientY);
    if (drop.free) {
      if (d.kind === 'palette') { addLoose(d.type, p); return; }
      if (d.kind === 'link' && d.from === 'out') {
        if (window.BTCommand) window.BTCommand.quickAdd({ target: d.v, force: 'child', index: childIndexAt(d.v, null, p.x), x: e.clientX, y: e.clientY });
        else UI.contextMenu(e.clientX, e.clientY, [{ header: 'New child of ' + T[d.v.node.type].label }].concat(typeMenu(all, function (ty) { addChild(d.v, ty, childIndexAt(d.v, null, p.x)); })));
        return;
      }
      if (d.kind === 'link') { disconnect(d.v, { x: p.x - d.v.w / 2, y: p.y }); return; }
      var tl = { x: p.x - d.v.w / 2, y: p.y - d.v.h / 2 };
      if (drop.reorder) {
        var kids = d.v.parent.node.children, before = kids.join();
        Store.mutate(current.project.id, function () { M.moveNode(d.v.tree, d.v.node.id, d.v.parent.node.id, drop.index); return kids.join() !== before; });
        return;
      }
      if (!drop.copy) { disconnect(d.v, tl); return; }
      var copied = null, br = M.exportBranch(d.v.tree, d.v.node.id);
      Store.mutate(current.project.id, function () { copied = M.importBranch(d.v.tree, br, null); copied.pos = tl; });
      Store.select(copied.id, d.v.ctx, d.v.tree.id);
      return;
    }
    if (!drop.ok) return;
    if (d.kind === 'link') { link(drop.childV, drop.parentV, drop.childV.cx); return; }
    var tg = drop.target;
    if (drop.zone === 'wrap') { wrapWith(tg, d.type); return; }
    var parentV = drop.zone === 'inside' ? tg : tg.parent;
    var index;
    if (drop.zone !== 'inside') index = parentV.node.children.indexOf(tg.node.id) + (drop.zone === 'after' ? 1 : 0);
    if (d.kind === 'palette') { addChild(parentV, d.type, index); return; }
    if (drop.copy) {
      var branch = M.exportBranch(d.v.tree, d.v.node.id), created = null;
      Store.mutate(current.project.id, function () { created = M.importBranch(parentV.tree, branch, parentV.node.id, index); });
      if (created) Store.select(created.id, parentV.ctx, parentV.tree.id);
      return;
    }
    var ok = Store.mutate(current.project.id, function () { return M.linkNode(d.v.tree, d.v.node.id, parentV.node.id, index); });
    if (!ok) UI.toast('Move not allowed.', 'warning');
  }

  // Click on a palette item: add to the selected node (or as sibling / under root).
  function addFromPalette(type) {
    if (!guardEditor() || !current) return;
    var v = selectedVNode() || current.root;
    if (v.readonly) v = findHost(v);
    if (M.canAcceptChild(v.tree, v.node.id, type)) { addChild(v, type); return; }
    if ((M.isDecorator(type)) && v.node.type !== 'root') { wrapWith(v, type); return; }
    if (v.parent && M.canAcceptChild(v.tree, v.parent.node.id, type)) { addSibling(v, type, true); return; }
    addLoose(type, viewCenter());
    UI.toast('Node created loose. Link it by dragging its top dot to the parent.', 'info', 3500);
  }

  function onDblClick(e) {
    var v = vnodeFromEl(e.target);
    if (!v) {
      if (!(e.target === wrap || e.target === world || e.target.closest('#world'))) return;
      if (S.mode === 'editor' && current && window.BTCommand) window.BTCommand.quickAdd({ at: worldPoint(e.clientX, e.clientY), x: e.clientX, y: e.clientY });
      else fit();
      return;
    }
    if (v.node.type === 'subtree') { openSubtree(v); return; }
    if (v.readonly) { openSubtree(findHost(v)); return; }
    if (window.BTInspector) window.BTInspector.focusField();
  }

  function onContext(e) {
    e.preventDefault();
    var v = vnodeFromEl(e.target);
    var hit = e.target.closest('.edge-hit');
    if (v) { if (!Store.isSelected(v.node.id, v.ctx)) Store.select(v.node.id, v.ctx, v.tree.id); nodeMenu(v, e.clientX, e.clientY); }
    else if (hit && current && current.byKey[hit.dataset.key]) edgeMenu(current.byKey[hit.dataset.key], e.clientX, e.clientY);
    else canvasMenu(e.clientX, e.clientY);
  }

  function onWheel(e) {
    e.preventDefault();
    stopCamera();
    var r = wrap.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) >= 40 || e.deltaMode === 1) {
      var factor = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0018) * (e.ctrlKey ? 2.5 : 1));
      zoomAt(factor, e.clientX - r.left, e.clientY - r.top);
    } else {
      // trackpad two-finger scroll pans
      view.tx -= e.deltaX; view.ty -= e.deltaY; applyView();
    }
  }

  /* ------------------------------------------------------------------ *
   * Keyboard navigation (called from app.js)
   * ------------------------------------------------------------------ */
  function navigate(dir) {
    if (!current) return;
    var v = selectedVNode();
    if (!v) { Store.select(current.root.node.id, current.root.ctx, current.tree.id); return; }
    var next = null;
    if (dir === 'up') next = v.parent;
    else if (dir === 'down') next = v.children[0];
    else if (v.parent) {
      var sib = v.parent.children, i = sib.indexOf(v);
      next = sib[i + (dir === 'left' ? -1 : 1)];
    }
    if (next) { Store.select(next.node.id, next.ctx, next.tree.id); ensureVisible(next); }
  }

  function revealNode(nodeId, ctx) {
    if (!current) return;
    var v = current.byKey[nodeKey(ctx, nodeId)];
    if (!v) return false;
    Store.select(v.node.id, v.ctx, v.tree.id);
    ensureVisible(v);
    v.el.classList.remove('flash'); void v.el.offsetWidth; v.el.classList.add('flash');
    return true;
  }

  /* ------------------------------------------------------------------ *
   * Hover: highlights the path from the root down to the hovered node
   * ------------------------------------------------------------------ */
  var hlEdges = [];
  function highlightPath(v) {
    hlEdges.forEach(function (e) { e.classList.remove('hl'); });
    hlEdges = [];
    for (var x = v; x && x.parent; x = x.parent) if (x.edge) { x.edge.classList.add('hl'); hlEdges.push(x.edge); }
    if (v) v.children.forEach(function (c) { if (c.edge) { c.edge.classList.add('hl', 'hl-child'); hlEdges.push(c.edge); } });
  }

  /* ------------------------------------------------------------------ *
   * Minimap: overview of big trees; click or drag to move the camera.
   * Like a scrollbar, it only shows while the camera moves (and never when the
   * whole tree already fits on screen), so it doesn't cover nodes.
   * ------------------------------------------------------------------ */
  var mm = null, mmPending = false, mmColors = null;
  function scheduleMinimap() {
    if (!mm || mmPending) return;
    mmPending = true;
    requestAnimationFrame(function () { mmPending = false; drawMinimap(); });
  }

  function cssColors() {
    var cs = getComputedStyle(document.documentElement);
    var g = function (n) { return cs.getPropertyValue(n).trim(); };
    return {
      control: g('--c-control'), decorator: g('--c-decorator'), action: g('--c-action'), condition: g('--c-condition'),
      subtree: g('--c-subtree'), root: g('--c-root'), unknown: g('--c-unknown'), edge: g('--edge'), accent: g('--accent'),
      running: g('--st-running'), success: g('--st-success'), fail: g('--st-fail'), standby: g('--st-standby')
    };
  }

  function mmGeometry() {
    var b = current.bbox, W = mm.clientWidth, Hh = mm.clientHeight, pad = 8;
    var k = Math.min((W - pad * 2) / Math.max(b.w, 1), (Hh - pad * 2) / Math.max(b.h, 1));
    return { k: k, ox: (W - b.w * k) / 2 - b.x * k, oy: (Hh - b.h * k) / 2 - b.y * k, W: W, H: Hh };
  }

  function drawMinimap() {
    var box = document.getElementById('minimap');
    if (!current || S.settings.minimap === false) { box.classList.add('off'); return; }
    var r = wrap.getBoundingClientRect();
    var vx0 = -view.tx / view.s, vy0 = -view.ty / view.s, vw = r.width / view.s, vh = r.height / view.s;
    var b = current.bbox;
    var fits = b.x >= vx0 && b.y >= vy0 && b.x + b.w <= vx0 + vw && b.y + b.h <= vy0 + vh;
    // like a scrollbar: only while the camera moves (and a moment after) or when the mouse is near it
    var awake = mmDrag || mmHover || performance.now() < mmAwakeUntil;
    box.classList.toggle('off', (fits || !awake) && !mmDrag);
    if (fits && !mmDrag) return;
    var dpr = window.devicePixelRatio || 1;
    var W = mm.clientWidth, Hh = mm.clientHeight;
    if (mm.width !== W * dpr || mm.height !== Hh * dpr) { mm.width = W * dpr; mm.height = Hh * dpr; }
    var c = mm.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, Hh);
    if (!mmColors) mmColors = cssColors();
    var g = mmGeometry(), monitor = S.mode === 'monitor';
    c.strokeStyle = mmColors.edge; c.lineWidth = 1; c.globalAlpha = 0.8;
    c.beginPath();
    current.list.forEach(function (v) {
      v.children.forEach(function (ch) {
        c.moveTo(g.ox + (v.x + v.w / 2) * g.k, g.oy + (v.y + v.h) * g.k);
        c.lineTo(g.ox + (ch.x + ch.w / 2) * g.k, g.oy + ch.y * g.k);
      });
    });
    c.stroke();
    c.globalAlpha = 1;
    current.list.forEach(function (v) {
      var st = monitor && v.status ? v.status.slice(3) : '';
      c.fillStyle = st ? mmColors[st] : (mmColors[T[v.node.type].cat] || mmColors.unknown);
      var w = Math.max(2, v.w * g.k), hh = Math.max(2, v.h * g.k);
      c.fillRect(g.ox + v.x * g.k, g.oy + v.y * g.k, w, hh);
    });
    c.strokeStyle = mmColors.accent; c.lineWidth = 1.5;
    c.fillStyle = 'rgba(91,141,239,.10)';
    c.fillRect(g.ox + vx0 * g.k, g.oy + vy0 * g.k, vw * g.k, vh * g.k);
    c.strokeRect(g.ox + vx0 * g.k, g.oy + vy0 * g.k, vw * g.k, vh * g.k);
  }

  var mmDrag = false, mmHover = false, mmAwakeUntil = 0, mmSleep = 0, lastView = '';
  function wakeMinimap() {
    var k = view.tx.toFixed(1) + ',' + view.ty.toFixed(1) + ',' + view.s.toFixed(3);
    if (k === lastView) return;
    var first = lastView === '';
    lastView = k;
    if (first) return;
    mmAwakeUntil = performance.now() + 1600;
    clearTimeout(mmSleep);
    mmSleep = setTimeout(scheduleMinimap, 1650);
  }
  function initMinimap() {
    mm = document.getElementById('minimapCanvas');
    var toWorld = function (e) { var rr = mm.getBoundingClientRect(), g = mmGeometry(); return { x: (e.clientX - rr.left - g.ox) / g.k, y: (e.clientY - rr.top - g.oy) / g.k }; };
    mm.addEventListener('pointerdown', function (e) {
      if (!current) return;
      e.preventDefault(); e.stopPropagation();
      mmDrag = true;
      mm.setPointerCapture(e.pointerId);
      centerOnPoint(toWorld(e), true);
    });
    mm.addEventListener('pointermove', function (e) { if (mmDrag && current) centerOnPoint(toWorld(e), false); });
    var end = function () { mmDrag = false; scheduleMinimap(); };
    mm.addEventListener('pointerup', end);
    mm.addEventListener('pointercancel', end);
    Store.on('settings', function () { mmColors = null; scheduleMinimap(); });
    // while it is visible, the mouse over it keeps it open (it never pops up over nodes by itself)
    var box = document.getElementById('minimap');
    box.addEventListener('pointerenter', function () { mmHover = true; });
    box.addEventListener('pointerleave', function () { mmHover = false; mmAwakeUntil = performance.now() + 900; clearTimeout(mmSleep); mmSleep = setTimeout(scheduleMinimap, 950); });
    new ResizeObserver(scheduleMinimap).observe(wrap);
  }

  function init() {
    wrap = document.getElementById('canvasWrap');
    world = document.getElementById('world');
    nodesLayer = document.getElementById('nodes');
    edgesLayer = document.getElementById('edges');
    ghost = document.getElementById('dragGhost');
    dropIndicator = document.createElement('div');
    dropIndicator.className = 'drop-ind';
    dropIndicator.hidden = true;
    world.appendChild(dropIndicator);
    selBox = document.createElement('div');
    selBox.className = 'sel-box';
    selBox.hidden = true;
    world.appendChild(selBox);

    wrap.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    wrap.addEventListener('dblclick', onDblClick);
    wrap.addEventListener('contextmenu', onContext);
    wrap.addEventListener('wheel', onWheel, { passive: false });
    nodesLayer.addEventListener('pointerover', function (e) { if (!drag) highlightPath(vnodeFromEl(e.target)); });
    nodesLayer.addEventListener('pointerleave', function () { highlightPath(null); });
    document.getElementById('zoomIn').onclick = function () { zoomAt(1.25, undefined, undefined, true); };
    document.getElementById('zoomOut').onclick = function () { zoomAt(1 / 1.25, undefined, undefined, true); };
    document.getElementById('zoomLabel').onclick = function () { zoomAt(1 / view.s, undefined, undefined, true); };
    document.getElementById('toggleMinimap').onclick = function () { Store.setSetting('minimap', S.settings.minimap === false); };
    initMinimap();
    document.getElementById('zoomFit').onclick = function () { fit(); };
    document.getElementById('toggleIndex').onclick = function () { Store.setSetting('showIndex', !S.settings.showIndex); };
    window.addEventListener('resize', function () { applyView(); });

    Store.on('structure', render);
    Store.on('selection', applySelection);
    Store.on('mode', function () { updateStatuses(); });
    Store.on('settings', function () {
      document.body.classList.toggle('show-index', !!S.settings.showIndex);
      document.getElementById('toggleIndex').classList.toggle('active', !!S.settings.showIndex);
      document.getElementById('toggleMinimap').classList.toggle('active', S.settings.minimap !== false);
    });
    applyView();
  }

  window.BTCanvas = {
    init: init, render: render, updateStatuses: updateStatuses, fit: fit, zoomAt: zoomAt, centerOn: centerOn,
    selectedVNode: selectedVNode, current: function () { return current; }, nodeKey: nodeKey, childCtx: childCtx,
    addChild: addChild, addSibling: addSibling, deleteSelection: deleteSelection, deleteBranch: deleteBranch, moveSibling: moveSibling, wrapWith: wrapWith,
    changeTypeOf: changeTypeOf, copySelection: copySelection, copyBranch: copyBranch, pasteInto: pasteInto, duplicate: duplicate,
    selectedVNodes: selectedVNodes, selectMany: selectMany, selectAll: selectAll, extractSubtree: extractSubtree,
    openSubtree: openSubtree, toggleExpand: toggleExpand, startPaletteDrag: startPaletteDrag, addFromPalette: addFromPalette,
    addLoose: addLoose, pasteLoose: pasteLoose, disconnect: disconnect, link: link,
    navigate: navigate, revealNode: revealNode, nodeMenu: nodeMenu, typeMenu: typeMenu, setAllExpanded: setAllExpanded,
    isDragging: function () { return !!(drag && drag.started); },
    resetZoom: function () { zoomAt(1 / view.s, undefined, undefined, true); },
    focusEvent: focusEvent, worldPoint: worldPoint, viewCenter: viewCenter, ensureVisible: ensureVisible, motionOK: motionOK
  };
})();
