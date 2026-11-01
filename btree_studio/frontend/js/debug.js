/* BTree Studio - monitor: log parsing, node states, data sources, terminal and simulator. */
(function () {
  'use strict';
  var M = window.BTModel, Store = window.BTStore, UI = window.BTUI, I = window.BTIcons;
  var S = Store.S;

  /* ------------------------------------------------------------------ *
   * Node states
   * ------------------------------------------------------------------ */
  var seq = 0;
  var states = {};    // projectId -> { inst: { 'ctx>nodeId': {s,t} }, latest: { nodeId: {s,t} }, stats: { key: {running,success,fail} }, lastIndex }
  var recent = [];    // last transitions [{ projectId, treeId, nodeId, ctx, index, status, time }]
  var counters = { lines: 0, events: 0, unmatched: 0, mismatches: 0, unknownTree: {} };
  var lastRunning = null;

  function newPState() { return { inst: {}, latest: {}, stats: {}, lastIndex: -1 }; }
  function pstate(pid) {
    var box = viewStates || states;
    return box[pid] || (box[pid] = newPState());
  }

  /* ------------------------------------------------------------------ *
   * History (time travel): every event/reset is recorded as an op; the tree can be shown
   * as it was after any op by replaying them on a copy. Live data keeps arriving meanwhile.
   * ------------------------------------------------------------------ */
  var HMAX = 20000;
  var hist = { base: {}, ops: [] };   // base = states before ops[0]
  var viewAt = null;                  // null = live, else number of ops applied (0..ops.length)
  var viewStates = null, viewCache = null;

  // Copies a project state keeping inst/latest sharing the same objects (clearAfter relies on it).
  function clonePState(st) {
    var map = new Map(), out = newPState();
    var cp = function (v) { if (!map.has(v)) map.set(v, { s: v.s, t: v.t }); return map.get(v); };
    Object.keys(st.inst).forEach(function (k) { out.inst[k] = cp(st.inst[k]); });
    Object.keys(st.latest).forEach(function (k) { out.latest[k] = cp(st.latest[k]); });
    Object.keys(st.stats).forEach(function (k) { out.stats[k] = Object.assign({}, st.stats[k]); });
    out.lastIndex = st.lastIndex;
    return out;
  }
  function cloneBox(box) { var o = {}; Object.keys(box).forEach(function (k) { o[k] = clonePState(box[k]); }); return o; }

  function applyOp(box, op) {
    if (op.k === 'reset') { if (op.pid) delete box[op.pid]; return; }
    var project = Store.project(op.pid);
    if (!project) return;
    var order = orderFor(project);
    if (!order[op.index]) return;
    var st = box[op.pid] || (box[op.pid] = newPState());
    if (op.status === 'running' && !op.reactive) clearAfter(st, order, op.index);
    st.lastIndex = op.index;
    var val = { s: op.status, t: op.seq };
    var k = key(op.ctx, op.nodeId);
    st.inst[k] = val;
    st.latest[op.nodeId] = val;
    var stat = st.stats[k] || (st.stats[k] = { running: 0, success: 0, fail: 0, standby: 0, last: 0 });
    stat[op.status] = (stat[op.status] || 0) + 1;
    stat.last = op.time;
  }

  function record(op) {
    hist.ops.push(op);
    if (hist.ops.length > HMAX) {
      var drop = hist.ops.splice(0, 2000);
      drop.forEach(function (o) { applyOp(hist.base, o); });
      viewCache = null;
      if (viewAt !== null) viewAt = Math.max(0, viewAt - drop.length);
    }
    Store.emit('history-log');
  }

  // Moves the view to "after n ops" (null = live). fx: animate the transition like a live event.
  function setViewAt(n, fx) {
    if (n !== null) n = Math.max(0, Math.min(hist.ops.length, n));
    if (n === hist.ops.length && n > 0 && fx !== 'stay') n = null;
    viewAt = n;
    if (n === null) { viewStates = null; viewCache = null; }
    else {
      if (!viewCache || viewCache.n > n) viewCache = { n: 0, box: cloneBox(hist.base) };
      for (var i = viewCache.n; i < n; i++) applyOp(viewCache.box, hist.ops[i]);
      viewCache.n = n;
      viewStates = viewCache.box;
    }
    window.BTCanvas.updateStatuses(fx === true);
    Store.emit('debug');
    Store.emit('history-log');
  }
  Store.on('structure', function () { orderCache = {}; if (viewAt !== null) { viewCache = null; setViewAt(viewAt, 'stay'); } });

  function opsUpTo() { return viewAt === null ? hist.ops : hist.ops.slice(0, viewAt); }

  function key(ctx, nodeId) { return (ctx === null ? '*' : ctx) + '>' + nodeId; }

  function own(st, ctx, nodeId) { return ctx === null ? st.latest[nodeId] : st.inst[key(ctx, nodeId)]; }

  // Returns { s, t } for any node, inferring control/root/subtree states from their children.
  function pair(project, tree, nodeId, ctx, cache, depth) {
    var n = tree.nodes[nodeId];
    if (!n || depth > 40) return null;
    var ck = tree.id + '|' + key(ctx, nodeId);
    if (cache && ck in cache) return cache[ck];
    var st = pstate(project.id);
    var res = null;
    var cat = M.TYPES[n.type].cat;
    if (cat === 'action' || cat === 'condition') {
      res = own(st, ctx, nodeId) || null;
    } else if (cat === 'decorator') {
      var o = own(st, ctx, nodeId) || null;
      var c = n.children.length ? pair(project, tree, n.children[0], ctx, cache, depth + 1) : null;
      if (o && (!c || o.t >= c.t)) res = o;
      else if (c && c.s === 'running') res = { s: 'running', t: c.t };
      else res = o || (c ? { s: 'running', t: c.t } : null);
    } else if (n.type === 'subtree') {
      var ref = project.trees[n.props.ref];
      res = ref ? pair(project, ref, ref.rootId, ctx === null ? null : ctx + '/' + n.id, cache, depth + 1) : null;
    } else if (n.type === 'root') {
      res = n.children.length ? pair(project, tree, n.children[0], ctx, cache, depth + 1) : null;
    } else {
      // control (and unknown): look at the most recently updated child
      var latest = null, latestIdx = -1;
      for (var i = 0; i < n.children.length; i++) {
        var cp = pair(project, tree, n.children[i], ctx, cache, depth + 1);
        if (cp && (!latest || cp.t > latest.t)) { latest = cp; latestIdx = i; }
      }
      if (latest) {
        var isLast = latestIdx === n.children.length - 1;
        var s = latest.s;
        if (n.type === 'sequence' || n.type === 'reactive_sequence') {
          if (s === 'success' && !isLast) s = 'running';
        } else if (n.type === 'fallback' || n.type === 'reactive_fallback') {
          if (s === 'fail' && !isLast) s = 'running';
        }
        res = { s: s, t: latest.t };
      }
    }
    if (cache) cache[ck] = res;
    return res;
  }

  function nodeStatus(project, tree, nodeId, ctx, cache) {
    var p = pair(project, tree, nodeId, ctx, cache, 0);
    return p ? p.s : null;
  }

  function resetStatuses(projectId) {
    if (projectId) { delete states[projectId]; record({ k: 'reset', pid: projectId, time: Date.now() }); }
    else { states = {}; hist = { base: {}, ops: [] }; viewAt = null; viewStates = null; viewCache = null; Store.emit('history-log'); }
    lastRunning = null;
    if (!projectId) recent = [];
    scheduleRefresh();
  }

  /* ------------------------------------------------------------------ *
   * Log ingestion
   * ------------------------------------------------------------------ */
  var orderCache = {};   // projectId -> { ref, order }  (invalidated on every structural change)
  function orderFor(project) {
    var c = orderCache[project.id];
    if (!c || c.ref !== project) { c = { ref: project, order: M.compiledOrder(project) }; orderCache[project.id] = c; }
    return c.order;
  }
  Store.on('structure', function () { orderCache = {}; });

  function projectForLog(treeName) {
    var up = String(treeName || '').toUpperCase();
    var p = S.projects.find(function (x) { return M.logNameOf(x) === up; });
    if (p) return { project: p, exact: true };
    // tolerate a trailing "_" or a name equal to the main tree name
    p = S.projects.find(function (x) { return M.logNameOf(x).replace(/_+$/, '') === up.replace(/_+$/, ''); }) ||
        S.projects.find(function (x) { var mt = x.trees[x.mainTreeId]; return mt && mt.name.toUpperCase() === up; });
    if (p) return { project: p, exact: true };
    var active = Store.activeProject();
    return active ? { project: active, exact: false } : null;
  }

  // Processes one raw line from any source. Returns the terminal record.
  function handleLine(text, time) {
    counters.lines += 1;
    var rec = { t: time || Date.now(), text: text, parsed: null, cls: '' };
    var parsed = M.parseLogLine(text);
    if (!parsed) { counters.unmatched += 1; Terminal.push(rec); return rec; }
    rec.parsed = parsed;
    rec.cls = 'bt st-' + parsed.status;
    counters.events += 1;
    var match = projectForLog(parsed.tree);
    if (!match) { rec.warn = 'Nenhum projeto aberto para receber este log.'; Terminal.push(rec); return rec; }
    if (!match.exact && !counters.unknownTree[parsed.tree]) {
      counters.unknownTree[parsed.tree] = true;
      UI.toast('Log com Tree "' + parsed.tree + '" não corresponde a nenhum projeto. Usando o projeto ativo "' + match.project.name + '". Ajuste o "Nome no log" do projeto.', 'warning', 7000);
    }
    var project = match.project;
    var order = orderFor(project);
    var entry = order[parsed.index];
    rec.projectId = project.id;
    if (!entry) {
      rec.warn = 'Node ' + parsed.index + ' não existe no projeto ' + project.name + ' (tem ' + order.length + ' nós). O XML pode estar diferente do firmware.';
      counters.mismatches += 1;
      Terminal.push(rec);
      return rec;
    }
    var tree = project.trees[entry.treeId];
    var node = tree && tree.nodes[entry.nodeId];
    rec.entry = entry;
    if (node && parsed.type && parsed.type !== node.type) {
      rec.warn = 'Tipo no log (' + parsed.rawType + ') difere do nó #' + parsed.index + ' no Studio (' + M.TYPES[node.type].label + '). XML e firmware podem estar dessincronizados.';
      counters.mismatches += 1;
    }
    seq += 1;
    var op = { k: 'ev', pid: project.id, index: parsed.index, status: parsed.status, reactive: !!parsed.reactive,
      nodeId: entry.nodeId, ctx: entry.ctx, treeId: entry.treeId, seq: seq, time: rec.t, fn: parsed.fn };
    applyOp(states, op);
    record(op);
    rec.op = op;
    var ev = { projectId: project.id, treeId: entry.treeId, nodeId: entry.nodeId, ctx: entry.ctx, index: parsed.index, status: parsed.status, time: rec.t, fn: parsed.fn };
    recent.unshift(ev);
    if (recent.length > 60) recent.pop();
    if (parsed.status === 'running') lastRunning = ev;
    Terminal.push(rec);
    scheduleRefresh(ev);
    return rec;
  }

  // A node starting to run means everything after it (pre-order) belongs to a previous pass:
  // drop those states so stale greens/reds don't linger (tree restart, retry/repeat loops, new branch).
  // Exceptions: reactive re-evaluations, and a decorator re-entered from its own child.
  function clearAfter(st, order, index) {
    if (st.lastIndex > index && st.lastIndex <= order[index].end) return;
    for (var j = index + 1; j < order.length; j++) {
      var k = key(order[j].ctx, order[j].nodeId);
      if (st.latest[order[j].nodeId] === st.inst[k]) delete st.latest[order[j].nodeId];
      delete st.inst[k];
    }
  }

  var refreshPending = false, followEv = null;
  function scheduleRefresh(ev) {
    if (ev && ev.status === 'running') followEv = ev;
    if (refreshPending) return;
    refreshPending = true;
    requestAnimationFrame(function () {
      refreshPending = false;
      if (viewAt !== null) { followEv = null; Store.emit('history-log'); return; } // looking at the past: live data waits
      window.BTCanvas.updateStatuses(true);
      if (S.settings.follow && S.mode === 'monitor' && followEv) {
        var cur = window.BTCanvas.current();
        if (cur) {
          var v = cur.byKey[key(followEv.ctx, followEv.nodeId)] || cur.byKey[key(null, followEv.nodeId)];
          if (v && v.el) {
            var r = document.getElementById('canvasWrap').getBoundingClientRect(), er = v.el.getBoundingClientRect();
            if (er.right < r.left + 20 || er.left > r.right - 20 || er.bottom < r.top + 20 || er.top > r.bottom - 20) window.BTCanvas.centerOn(v, true);
          }
        }
      }
      followEv = null;
      Store.emit('debug');
    });
  }

  /* ------------------------------------------------------------------ *
   * Terminal
   * ------------------------------------------------------------------ */
  var Terminal = (function () {
    var MAX = 20000, MAX_DOM = 4000;
    var buf = [];
    var pendingRows = [];
    var paused = false;
    var box, countEl;
    var filterText = '', onlyBt = false, showTime = true;

    function fmtTime(t) {
      var d = new Date(t);
      function p(n, l) { return String(n).padStart(l || 2, '0'); }
      return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()) + '.' + p(d.getMilliseconds(), 3);
    }

    function visible(rec) {
      if (onlyBt && !rec.parsed && !rec.sys) return false;
      if (filterText && rec.text.toLowerCase().indexOf(filterText) === -1) return false;
      return true;
    }

    function row(rec) {
      var e = document.createElement('div');
      e.className = 'tl ' + (rec.cls || '') + (rec.sys ? ' sys ' + rec.sys : '') + (rec.warn ? ' warn' : '');
      var html = '<span class="ts">' + fmtTime(rec.t) + '</span>';
      if (rec.parsed) {
        var p = rec.parsed;
        html += '<span class="chip st-' + p.status + '">' + UI.esc(p.rawStatus) + '</span>';
        html += '<span class="tx">' + highlight(rec.text) + '</span>';
        if (rec.warn) html += '<span class="tw" title="' + UI.esc(rec.warn) + '">' + I.icon('alert', 13) + '</span>';
        e.title = rec.entry ? 'Clique para localizar o nó #' + p.index + ' e ver a árvore neste instante' + (rec.warn ? '\n⚠ ' + rec.warn : '') : (rec.warn || '');
      } else {
        html += '<span class="tx">' + UI.esc(rec.text) + '</span>';
      }
      e.innerHTML = html;
      e._rec = rec;
      return e;
    }

    function highlight(text) {
      return UI.esc(text).replace(/(\[BTREE\])/, '<b class="tag">$1</b>')
        .replace(/(Tree:|Node:|Status:|Type:|Function:)/g, '<span class="k">$1</span>');
    }

    function push(rec) {
      buf.push(rec);
      if (buf.length > MAX) buf.splice(0, buf.length - MAX);
      if (visible(rec)) pendingRows.push(rec);
      schedule();
    }

    function sys(text, kind) { push({ t: Date.now(), text: text, sys: kind || 'info' }); }

    var sched = false;
    function schedule() {
      if (sched) return;
      sched = true;
      requestAnimationFrame(flush);
    }

    function flush() {
      sched = false;
      if (!box) return;
      var atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
      var rows = pendingRows.splice(0);
      if (rows.length > MAX_DOM) rows = rows.slice(-MAX_DOM);
      var frag = document.createDocumentFragment();
      rows.forEach(function (r) { frag.appendChild(row(r)); });
      box.appendChild(frag);
      var extra = box.childElementCount - MAX_DOM;
      for (var i = 0; i < extra; i++) box.removeChild(box.firstChild);
      if (!paused && (atBottom || rows.length)) box.scrollTop = box.scrollHeight;
      countEl.textContent = buf.length ? (buf.length > 999 ? Math.round(buf.length / 100) / 10 + 'k' : buf.length) : '';
    }

    function rerender() {
      box.innerHTML = '';
      pendingRows = buf.filter(visible).slice(-MAX_DOM);
      schedule();
    }

    function clear() { buf = []; pendingRows = []; box.innerHTML = ''; countEl.textContent = ''; }

    function exportText() {
      return buf.map(function (r) { return (showTime ? fmtTime(r.t) + ' ' : '') + r.text; }).join('\n') + '\n';
    }

    function init() {
      box = document.getElementById('terminal');
      countEl = document.getElementById('termCount');
      var f = document.getElementById('termFilter');
      f.addEventListener('input', function () { filterText = f.value.toLowerCase(); rerender(); });
      var ob = document.getElementById('termOnlyBt');
      ob.addEventListener('change', function () { onlyBt = ob.checked; rerender(); });
      var tm = document.getElementById('termTime');
      tm.addEventListener('change', function () { showTime = tm.checked; box.classList.toggle('no-time', !showTime); });
      var pause = document.getElementById('termPause');
      pause.addEventListener('click', function () {
        paused = !paused;
        pause.classList.toggle('active', paused);
        pause.innerHTML = I.icon(paused ? 'play' : 'pause', 16);
        pause.title = paused ? 'Retomar rolagem automática' : 'Pausar rolagem automática';
        if (!paused) box.scrollTop = box.scrollHeight;
      });
      document.getElementById('termClear').addEventListener('click', clear);
      document.getElementById('termSaveLog').addEventListener('click', function () {
        var d = new Date();
        UI.download('btree-log-' + d.toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.log', exportText());
      });
      box.addEventListener('click', function (e) {
        var r = e.target.closest('.tl');
        if (!r || !r._rec || !r._rec.entry) return;
        // in the monitor, a [BTREE] line also takes the tree back to that moment
        if (S.mode === 'monitor' && r._rec.op && window.BTTimeline && window.BTTimeline.jumpToOp(r._rec.op)) { locate(r._rec.projectId, r._rec.entry); return; }
        locate(r._rec.projectId, r._rec.entry);
      });
    }

    return { init: init, push: push, sys: sys, clear: clear, rerender: rerender };
  })();

  // Opens/activates a tab where the node is visible and selects it.
  function locate(projectId, entry) {
    var project = Store.project(projectId);
    if (!project) return;
    var cur = window.BTCanvas.current();
    if (cur && cur.project.id === projectId && window.BTCanvas.revealNode(entry.nodeId, entry.ctx)) return;
    if (cur && cur.project.id === projectId && cur.tab.ctx === null && cur.tree.id === entry.treeId && window.BTCanvas.revealNode(entry.nodeId, null)) return;
    Store.openTab(projectId, entry.treeId, entry.ctx, { keep: true });
    setTimeout(function () { window.BTCanvas.revealNode(entry.nodeId, entry.ctx); }, 50);
  }

  /* ------------------------------------------------------------------ *
   * Data sources
   * ------------------------------------------------------------------ */
  var conn = { kind: null, connected: false, label: 'Desconectado', busy: false };
  function setConn(patch) {
    Object.assign(conn, patch);
    Store.emit('connection');
  }

  // --- Server-Sent Events from studio.py (serial/tcp/process + /api/log injections)
  var es = null;
  function startEvents() {
    if (!S.backend || es || typeof EventSource === 'undefined') return;
    es = new EventSource('/api/events');
    es.onmessage = function (m) {
      var ev;
      try { ev = JSON.parse(m.data); } catch (e) { return; }
      if (ev.type === 'line') handleLine(ev.text, ev.t ? ev.t * 1000 : Date.now());
      else if (ev.type === 'status') {
        if (ev.connected) {
          setConn({ kind: ev.kind, connected: true, label: ev.description || ev.kind, server: true });
        } else if (conn.server) {
          if (ev.error) { Terminal.sys('Conexão encerrada: ' + ev.error, 'error'); UI.toast('Conexão encerrada: ' + ev.error, 'error'); }
          setConn({ kind: null, connected: false, label: 'Desconectado', server: false });
        }
      }
    };
    es.onerror = function () {
      if (conn.server) { setConn({ connected: false, label: 'Servidor indisponível', server: false }); }
    };
  }

  // --- Web Serial (Chrome / Edge, no server needed)
  var web = { port: null, reader: null, writer: null, keepReading: false };
  function webSerialSupported() { return typeof navigator !== 'undefined' && 'serial' in navigator; }

  function connectWebSerial(baud) {
    if (!webSerialSupported()) {
      UI.toast('Este navegador não suporta Web Serial. Use Chrome/Edge, ou rode o servidor (python3 studio.py) e escolha "Serial UART (servidor)".', 'error', 8000);
      return Promise.resolve();
    }
    return navigator.serial.requestPort().then(function (port) {
      return port.open({ baudRate: baud }).then(function () {
        web.port = port;
        web.keepReading = true;
        var info = port.getInfo ? port.getInfo() : {};
        var label = 'Web Serial' + (info.usbVendorId ? ' ' + info.usbVendorId.toString(16) + ':' + (info.usbProductId || 0).toString(16) : '') + ' @ ' + baud;
        setConn({ kind: 'webserial', connected: true, label: label, server: false });
        Terminal.sys('Conectado: ' + label, 'ok');
        readWebSerial();
      });
    }).catch(function (e) {
      if (e && e.name === 'NotFoundError') return; // user cancelled the picker
      UI.toast('Falha ao abrir porta: ' + (e && e.message ? e.message : e), 'error');
    });
  }

  function readWebSerial() {
    var decoder = new TextDecoder();
    var partial = '';
    function loop() {
      if (!web.port || !web.keepReading || !web.port.readable) return finish();
      web.reader = web.port.readable.getReader();
      function pump() {
        return web.reader.read().then(function (res) {
          if (res.done) return;
          partial += decoder.decode(res.value, { stream: true });
          var parts = partial.split('\n');
          partial = parts.pop();
          var now = Date.now();
          parts.forEach(function (l) { handleLine(l.replace(/\r$/, ''), now); });
          if (partial.length > 8192) { handleLine(partial, now); partial = ''; }
          return pump();
        });
      }
      pump().catch(function (e) {
        if (web.keepReading) Terminal.sys('Erro de leitura: ' + e.message, 'error');
      }).then(function () {
        try { web.reader.releaseLock(); } catch (e) { /* ignore */ }
        if (web.keepReading && web.port && web.port.readable) loop(); else finish();
      });
    }
    function finish() {
      if (conn.kind === 'webserial') {
        if (web.keepReading) Terminal.sys('Porta serial desconectada.', 'error');
        setConn({ kind: null, connected: false, label: 'Desconectado' });
      }
      var p = web.port;
      web.port = null;
      if (p) p.close().catch(function () {});
    }
    loop();
  }

  function disconnectWebSerial() {
    web.keepReading = false;
    if (web.reader) web.reader.cancel().catch(function () {});
    else if (web.port) { web.port.close().catch(function () {}); web.port = null; setConn({ kind: null, connected: false, label: 'Desconectado' }); }
  }

  if (webSerialSupported()) {
    navigator.serial.addEventListener('disconnect', function (e) {
      if (web.port && e.target === web.port) { Terminal.sys('Dispositivo removido.', 'error'); disconnectWebSerial(); }
    });
  }

  // --- Simulator: runs the project's main tree and emits lines in the firmware format
  var sim = { running: false, token: 0 };
  function simSpeed() { return Number(document.getElementById('simSpeed').value) || 1; }

  function startSimulation() {
    var project = Store.tabProject() || Store.activeProject();
    if (!project) { UI.toast('Abra um projeto para simular.', 'warning'); return; }
    var issues = M.validateProject(project).filter(function (i) { return i.level === 'error'; });
    if (issues.length) UI.toast('O projeto tem ' + issues.length + ' problema(s); a simulação pode ser incompleta.', 'warning');
    var token = ++sim.token;
    sim.running = true;
    setConn({ kind: 'sim', connected: true, label: 'Simulação: ' + project.name });
    Terminal.sys('Simulação iniciada — projeto ' + project.name + ' (Tree: ' + M.logNameOf(project) + ')', 'ok');
    var order = M.compiledOrder(project);
    var idx = {};
    order.forEach(function (e, i) { idx[key(e.ctx, e.nodeId)] = i; });
    var logName = M.logNameOf(project);
    var bias = {};

    function alive() { return sim.running && sim.token === token; }
    function wait(ms) { return new Promise(function (r) { setTimeout(r, ms / simSpeed()); }); }
    function emit(tree, n, ctx, status) {
      var i = idx[key(ctx, n.id)];
      if (i === undefined) return;
      var fn = n.props.code ? 'btree_' + project.name.toLowerCase() + '_' + tree.name + '_' + n.props.code : '';
      handleLine(M.formatLogLine(logName, i, status, n.type, fn));
    }
    function chance(n) {
      if (bias[n.id] === undefined) bias[n.id] = n.type === 'condition' ? 0.45 + Math.random() * 0.4 : 0.65 + Math.random() * 0.3;
      return Math.random() < bias[n.id];
    }

    function exec(tree, nodeId, ctx, depth) {
      if (!alive()) return Promise.resolve('fail');
      var n = tree.nodes[nodeId];
      if (!n || depth > 40) return Promise.resolve('fail');
      var t = n.type;
      var kids = n.children;
      function child(i) { return exec(tree, kids[i], ctx, depth + 1); }
      function seqRun(stopOn) {
        var i = 0;
        function next() {
          if (i >= kids.length) return Promise.resolve(stopOn === 'fail' ? 'success' : 'fail');
          return child(i++).then(function (r) { return r === stopOn ? r : next(); });
        }
        return next();
      }
      function finish(r) { emit(tree, n, ctx, r); return wait(120).then(function () { return r; }); }
      switch (t) {
        case 'root': return kids.length ? child(0) : Promise.resolve('success');
        case 'sequence': case 'reactive_sequence': return seqRun('fail');
        case 'fallback': case 'reactive_fallback': return seqRun('success');
        case 'unknown': return seqRun('fail');
        case 'subtree': {
          var ref = project.trees[n.props.ref];
          return ref ? exec(ref, ref.rootId, ctx + '/' + n.id, depth + 1) : Promise.resolve('fail');
        }
        case 'action':
          emit(tree, n, ctx, 'running');
          return wait(350 + Math.random() * 650).then(function () { return finish(chance(n) ? 'success' : 'fail'); });
        case 'condition':
          emit(tree, n, ctx, 'running');
          return wait(180).then(function () { return finish(chance(n) ? 'success' : 'fail'); });
        case 'sleep':
          emit(tree, n, ctx, 'running');
          return wait(Math.min(Number(n.props.msec) || 0, 2500)).then(function () { return finish('success'); });
        case 'retry': {
          var max = Math.min(Number(n.props.num) || 1, 20), k = 0;
          emit(tree, n, ctx, 'running');
          var loopR = function () {
            if (!kids.length || k >= max) return finish('fail');
            k += 1;
            return child(0).then(function (r) { return r === 'success' ? finish('success') : loopR(); });
          };
          return loopR();
        }
        case 'repeat': {
          var times = Math.min(Number(n.props.num) || 1, 20), j = 0;
          emit(tree, n, ctx, 'running');
          var loopP = function () {
            if (!kids.length || j >= times) return finish('success');
            j += 1;
            return child(0).then(loopP);
          };
          return loopP();
        }
        case 'keep_running': {
          var tries = 0;
          emit(tree, n, ctx, 'running');
          var loopK = function () {
            if (!kids.length) return finish('fail');
            tries += 1;
            return child(0).then(function (r) { return (r === 'success' || tries >= 12) ? finish('success') : loopK(); });
          };
          return loopK();
        }
        case 'inverter': case 'force_success': case 'force_failure':
          emit(tree, n, ctx, 'running');
          return (kids.length ? child(0) : Promise.resolve('fail')).then(function (r) {
            if (t === 'inverter') r = r === 'success' ? 'fail' : 'success';
            if (t === 'force_success') r = 'success';
            if (t === 'force_failure') r = 'fail';
            return finish(r);
          });
      }
      return Promise.resolve('fail');
    }

    var iteration = 0;
    function cycle() {
      if (!alive()) return;
      iteration += 1;
      resetStatuses(project.id);
      Terminal.sys('— execução ' + iteration + ' —', 'info');
      var main = project.trees[project.mainTreeId];
      exec(main, main.rootId, '', 0).then(function (r) {
        if (!alive()) return;
        Terminal.sys('Árvore terminou com ' + (r === 'success' ? 'SUCESSO' : 'FALHA'), r === 'success' ? 'ok' : 'error');
        return wait(1600).then(cycle);
      });
    }
    cycle();
  }

  function stopSimulation() {
    sim.running = false;
    sim.token += 1;
    if (conn.kind === 'sim') { Terminal.sys('Simulação parada.', 'info'); setConn({ kind: null, connected: false, label: 'Desconectado' }); }
  }

  // --- Replay of a saved log
  var replay = { lines: [], pos: 0, token: 0, running: false };
  function loadReplay(text, name) {
    replay.lines = text.split(/\r?\n/).filter(function (l) { return l.trim(); })
      // remove a leading time stamp written by "Salvar log" (hh:mm:ss.mmm)
      .map(function (l) { return l.replace(/^\d\d:\d\d:\d\d\.\d{3}\s/, ''); });
    replay.pos = 0;
    var bt = replay.lines.filter(function (l) { return M.parseLogLine(l); }).length;
    document.getElementById('srcHint').textContent = (name ? name + ': ' : '') + replay.lines.length + ' linhas (' + bt + ' [BTREE])';
    UI.toast('Log carregado: ' + replay.lines.length + ' linhas, ' + bt + ' eventos [BTREE]. Clique em Reproduzir.', 'success');
  }

  function startReplay() {
    if (!replay.lines.length) { UI.toast('Carregue um arquivo de log ou cole linhas primeiro.', 'warning'); return; }
    var token = ++replay.token;
    replay.running = true;
    if (replay.pos >= replay.lines.length) replay.pos = 0;
    setConn({ kind: 'replay', connected: true, label: 'Reproduzindo log' });
    function step() {
      if (!replay.running || replay.token !== token) return;
      if (replay.pos >= replay.lines.length) {
        Terminal.sys('Fim do log.', 'ok');
        replay.running = false;
        setConn({ kind: null, connected: false, label: 'Desconectado' });
        return;
      }
      handleLine(replay.lines[replay.pos++]);
      setTimeout(step, 220 / simSpeed());
    }
    step();
  }

  function stopReplay() {
    replay.running = false; replay.token += 1;
    if (conn.kind === 'replay') setConn({ kind: null, connected: false, label: 'Desconectado' });
  }

  // --- Unified connect / disconnect
  function sourceKind() { return document.getElementById('srcKind').value; }

  function connect() {
    var kind = sourceKind();
    if (conn.connected) return disconnect();
    if (kind !== 'webserial' && kind !== 'sim' && kind !== 'replay' && !S.backend) {
      UI.toast('Esta fonte precisa do servidor local. Rode "python3 studio.py" e abra http://localhost:8765', 'error', 8000);
      return;
    }
    if (S.mode !== 'monitor') Store.setMode('monitor');
    var baud = Number(document.getElementById('baud').value) || 115200;
    if (kind === 'webserial') return connectWebSerial(baud);
    if (kind === 'sim') return startSimulation();
    if (kind === 'replay') return startReplay();
    var cfg = { kind: kind };
    if (kind === 'serial') {
      cfg.port = document.getElementById('serialPort').value;
      cfg.baudrate = baud;
      if (!cfg.port) { UI.toast('Escolha uma porta serial (clique em ⟳ para atualizar a lista).', 'warning'); return; }
    } else if (kind === 'tcp') {
      cfg.host = document.getElementById('tcpHost').value.trim() || '127.0.0.1';
      cfg.port = Number(document.getElementById('tcpPort').value) || 9090;
    } else if (kind === 'jlink') {
      cfg.device = document.getElementById('jlDevice').value.trim();
      cfg.serial = document.getElementById('jlProbe').value;
      cfg.speed = Number(document.getElementById('jlSpeed').value) || 4000;
      cfg.rttAddress = document.getElementById('jlRtt').value.trim();
      if (!cfg.device) { UI.toast('Informe o dispositivo do J-Link (ex.: STM32F411RE).', 'warning'); return; }
    } else if (kind === 'process') {
      cfg.command = document.getElementById('procCmd').value.trim();
      if (!cfg.command) { UI.toast('Digite o comando (ex.: pyocd rtt -t stm32f411re).', 'warning'); return; }
    }
    setConn({ busy: true });
    startEvents();
    return Store.api('/api/connect', cfg).then(function (res) {
      Terminal.sys('Conectado: ' + (res.description || kind), 'ok');
      setConn({ busy: false, kind: kind, connected: true, label: res.description || kind, server: true });
      // the source may already have ended (e.g. a command that exits at once): reconcile with the server
      setTimeout(reconcileServer, 400);
    }).catch(function (e) {
      setConn({ busy: false });
      Terminal.sys('Falha ao conectar: ' + e.message, 'error');
      UI.toast('Falha ao conectar: ' + e.message, 'error', 8000);
    });
  }

  function reconcileServer() {
    if (!conn.server) return;
    Store.api('/api/info').then(function (info) {
      if (conn.server && info.bridge && !info.bridge.connected) setConn({ kind: null, connected: false, label: 'Desconectado', server: false });
    }).catch(function () { /* ignore */ });
  }

  function disconnect() {
    if (conn.kind === 'webserial') return disconnectWebSerial();
    if (conn.kind === 'sim') return stopSimulation();
    if (conn.kind === 'replay') return stopReplay();
    if (conn.server) {
      return Store.api('/api/disconnect', {}).then(function () {
        Terminal.sys('Desconectado.', 'info');
        setConn({ kind: null, connected: false, label: 'Desconectado', server: false });
      }).catch(function (e) { UI.toast(e.message, 'error'); });
    }
    setConn({ kind: null, connected: false, label: 'Desconectado' });
  }

  function send(text) {
    if (conn.kind === 'webserial' && web.port && web.port.writable) {
      var w = web.port.writable.getWriter();
      return w.write(new TextEncoder().encode(text)).finally(function () { w.releaseLock(); });
    }
    if (conn.server) return Store.api('/api/send', { data: text });
    return Promise.reject(new Error('Nenhum dispositivo conectado que aceite envio.'));
  }

  function refreshPorts(silent) {
    var sel = document.getElementById('serialPort');
    if (!S.backend) return;
    Store.api('/api/serial/ports').then(function (res) {
      var prev = sel.value;
      sel.innerHTML = '';
      if (!res.available) { sel.appendChild(UI.el('option', { value: '', text: 'pyserial não instalado' })); return; }
      if (!res.ports.length) sel.appendChild(UI.el('option', { value: '', text: '(nenhuma porta encontrada)' }));
      res.ports.forEach(function (p) {
        sel.appendChild(UI.el('option', { value: p.device, text: p.device + (p.description && p.description !== 'n/a' ? ' — ' + p.description : '') }));
      });
      if (prev && res.ports.some(function (p) { return p.device === prev; })) sel.value = prev;
      if (!silent) UI.toast(res.ports.length + ' porta(s) encontrada(s).', 'info', 1500);
    }).catch(function (e) { if (!silent) UI.toast(e.message, 'error'); });
  }

  function refreshProbes(silent) {
    var sel = document.getElementById('jlProbe');
    if (!S.backend) return;
    Store.api('/api/jlink/probes').then(function (res) {
      var prev = sel.value;
      sel.innerHTML = '';
      sel.appendChild(UI.el('option', { value: '', text: res.available ? '(primeiro J-Link)' : 'pylink não instalado' }));
      res.probes.forEach(function (p) { sel.appendChild(UI.el('option', { value: String(p.serial), text: p.serial + (p.product ? ' — ' + p.product : '') })); });
      if (prev && res.probes.some(function (p) { return String(p.serial) === prev; })) sel.value = prev;
      if (!silent) UI.toast(res.available ? res.probes.length + ' J-Link(s) encontrado(s).' : 'Instale: pip install pylink-square (e o software J-Link da SEGGER).', res.available ? 'info' : 'warning', 3000);
    }).catch(function (e) { if (!silent) UI.toast(e.message, 'error'); });
  }

  var SRC_HINTS = {
    webserial: 'Direto do navegador (Chrome/Edge). Não precisa do servidor.',
    serial: 'UART lida pelo servidor local (pyserial).',
    jlink: 'Lê o RTT direto do J-Link pelo SWD (pip install pylink-square). Não precisa de J-Link Commander/RTT Viewer aberto.',
    tcp: 'SWD: OpenOCD "rtt server start 9090 0" ou J-Link RTT (porta 19021).',
    process: 'Lê a saída de um comando, ex.: pyocd rtt, probe-rs attach, JLinkRTTClient.',
    sim: 'Executa a árvore principal do projeto ativo com resultados aleatórios.',
    replay: 'Reproduz um log salvo (.log/.txt) no formato [BTREE].'
  };

  function updateSourceUI() {
    var kind = sourceKind();
    document.querySelectorAll('.src-opts').forEach(function (el) {
      el.hidden = el.dataset.src.split(' ').indexOf(kind) === -1;
    });
    var hint = SRC_HINTS[kind];
    var needsServer = ['serial', 'jlink', 'tcp', 'process'].indexOf(kind) >= 0 && !S.backend;
    if (kind === 'webserial' && !webSerialSupported()) hint = 'Navegador sem Web Serial — use Chrome/Edge ou o servidor.';
    if (needsServer) hint = 'Requer o servidor: python3 studio.py';
    if (kind !== 'replay' || !replay.lines.length) document.getElementById('srcHint').textContent = hint || '';
    document.getElementById('srcHint').classList.toggle('bad', needsServer || (kind === 'webserial' && !webSerialSupported()));
    try { localStorage.setItem('btstudio.src', JSON.stringify(readSourceCfg())); } catch (e) { /* ignore */ }
  }

  function readSourceCfg() {
    return {
      kind: sourceKind(), baud: document.getElementById('baud').value, port: document.getElementById('serialPort').value,
      host: document.getElementById('tcpHost').value, tcpPort: document.getElementById('tcpPort').value,
      cmd: document.getElementById('procCmd').value, speed: document.getElementById('simSpeed').value,
      jlDevice: document.getElementById('jlDevice').value, jlSpeed: document.getElementById('jlSpeed').value, jlRtt: document.getElementById('jlRtt').value
    };
  }

  function renderConn() {
    var pill = document.getElementById('connPill');
    pill.className = 'conn-pill' + (conn.connected ? ' on' : '') + (conn.kind === 'sim' || conn.kind === 'replay' ? ' sim' : '');
    pill.querySelector('.txt').textContent = conn.busy ? 'Conectando…' : conn.label;
    var btn = document.getElementById('btnConnect');
    var label = conn.connected ? (conn.kind === 'sim' || conn.kind === 'replay' ? 'Parar' : 'Desconectar')
      : (sourceKind() === 'sim' ? 'Simular' : sourceKind() === 'replay' ? 'Reproduzir' : 'Conectar');
    btn.innerHTML = I.icon(conn.connected ? (conn.kind === 'sim' || conn.kind === 'replay' ? 'stop' : 'unplug') : (sourceKind() === 'sim' || sourceKind() === 'replay' ? 'play' : 'plug'), 15) + '<span>' + label + '</span>';
    btn.classList.toggle('danger', conn.connected);
    btn.classList.toggle('primary', !conn.connected);
    btn.disabled = !!conn.busy;
    document.getElementById('srcKind').disabled = conn.connected;
  }

  function init() {
    Terminal.init();
    var srcKind = document.getElementById('srcKind');
    try {
      var saved = JSON.parse(localStorage.getItem('btstudio.src') || 'null');
      if (saved) {
        srcKind.value = saved.kind || 'webserial';
        if (saved.baud) document.getElementById('baud').value = saved.baud;
        if (saved.host) document.getElementById('tcpHost').value = saved.host;
        if (saved.tcpPort) document.getElementById('tcpPort').value = saved.tcpPort;
        if (saved.cmd) document.getElementById('procCmd').value = saved.cmd;
        if (saved.speed) document.getElementById('simSpeed').value = saved.speed;
        if (saved.jlDevice) document.getElementById('jlDevice').value = saved.jlDevice;
        if (saved.jlSpeed) document.getElementById('jlSpeed').value = saved.jlSpeed;
        if (saved.jlRtt) document.getElementById('jlRtt').value = saved.jlRtt;
        if (saved.port) { document.getElementById('serialPort').appendChild(UI.el('option', { value: saved.port, text: saved.port })); document.getElementById('serialPort').value = saved.port; }
      } else if (!webSerialSupported() && S.backend) srcKind.value = 'serial';
    } catch (e) { /* ignore */ }
    var speedLabel = function () { document.getElementById('simSpeedLabel').textContent = document.getElementById('simSpeed').value + '×'; };
    document.getElementById('simSpeed').addEventListener('input', function () { speedLabel(); updateSourceUI(); });
    speedLabel();
    srcKind.addEventListener('change', function () { updateSourceUI(); renderConn(); if (sourceKind() === 'serial') refreshPorts(true); if (sourceKind() === 'jlink') refreshProbes(true); });
    document.getElementById('btnRefreshProbes').addEventListener('click', function () { refreshProbes(false); });
    ['baud', 'serialPort', 'tcpHost', 'tcpPort', 'procCmd', 'jlDevice', 'jlSpeed', 'jlRtt'].forEach(function (id) { document.getElementById(id).addEventListener('change', updateSourceUI); });
    document.getElementById('btnConnect').addEventListener('click', connect);
    document.getElementById('btnRefreshPorts').addEventListener('click', function () { refreshPorts(false); });
    document.getElementById('btnReplayLoad').addEventListener('click', function () { document.getElementById('fileReplay').click(); });
    document.getElementById('fileReplay').addEventListener('change', function (e) {
      var f = e.target.files[0];
      if (!f) return;
      UI.readFile(f).then(function (text) { loadReplay(text, f.name); });
      e.target.value = '';
    });
    document.getElementById('btnReplayPaste').addEventListener('click', function () {
      var ta = UI.el('textarea', { class: 'input mono', rows: 12, placeholder: '[BTREE] | Tree: MAIN | Node: 0 | Status: Running | Type: Action | Function: ...' });
      UI.modal({
        title: 'Colar log', width: '720px',
        body: UI.el('div', { class: 'form' }, [UI.el('p', { class: 'hint', text: 'Cole linhas do terminal do seu dispositivo. Linhas fora do formato [BTREE] também vão para o terminal.' }), ta]),
        buttons: [
          { label: 'Cancelar', value: null },
          { label: 'Processar agora', value: 'now' },
          { label: 'Carregar para reproduzir', kind: 'primary', value: 'replay' }
        ]
      }).then(function (v) {
        if (!v || !ta.value.trim()) return;
        if (v === 'now') { if (S.mode !== 'monitor') Store.setMode('monitor'); ta.value.split(/\r?\n/).forEach(function (l) { if (l.trim()) handleLine(l); }); }
        else loadReplay(ta.value, 'colado');
      });
    });
    document.getElementById('termSend').addEventListener('submit', function (e) {
      e.preventDefault();
      var input = document.getElementById('termInput');
      var eol = document.getElementById('termEol').value.replace('\\r', '\r').replace('\\n', '\n');
      var text = input.value;
      send(text + eol).then(function () {
        Terminal.push({ t: Date.now(), text: '› ' + text, sys: 'sent' });
        input.value = '';
      }).catch(function (err) { UI.toast(err.message, 'warning'); });
    });
    document.getElementById('connPill').addEventListener('click', function () {
      window.BTApp.showBottom('terminal');
      if (!conn.connected) document.getElementById('srcKind').focus();
    });
    Store.on('connection', renderConn);
    updateSourceUI();
    renderConn();
    if (S.backend) { startEvents(); refreshPorts(true); if (sourceKind() === 'jlink') refreshProbes(true); }
  }

  function opToEv(o) { return { projectId: o.pid, treeId: o.treeId, nodeId: o.nodeId, ctx: o.ctx, index: o.index, status: o.status, time: o.time, fn: o.fn }; }

  window.BTDebug = {
    init: init, handleLine: handleLine, nodeStatus: nodeStatus, resetStatuses: resetStatuses,
    stats: function (projectId, ctx, nodeId) { var st = (viewStates || states)[projectId]; return st ? st.stats[key(ctx, nodeId)] || null : null; },
    recent: function () {
      if (viewAt === null) return recent;
      return opsUpTo().filter(function (o) { return o.k === 'ev'; }).slice(-60).reverse().map(opToEv);
    },
    counters: function () { return counters; },
    lastRunning: function () {
      if (viewAt === null) return lastRunning;
      var ops = opsUpTo();
      for (var i = ops.length - 1; i >= 0; i--) if (ops[i].k === 'ev' && ops[i].status === 'running') return opToEv(ops[i]);
      return null;
    },
    history: function () { return hist.ops; }, indexOfOp: function (op) { return hist.ops.lastIndexOf(op); }, viewAt: function () { return viewAt; }, setViewAt: setViewAt,
    conn: function () { return conn; }, connect: connect, disconnect: disconnect, locate: locate, Terminal: Terminal,
    webSerialSupported: webSerialSupported
  };
})();
