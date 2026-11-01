/* BTree Studio - monitor timeline: every [BTREE] event of the open project as a bar.
 * Click/drag = go back in time, wheel = zoom, ,/. = step, Shift+,/. = previous/next failure,
 * Space = pause/replay, End = live. The lower track is an overview of the whole history. */
(function () {
  'use strict';
  var M = window.BTModel, Store = window.BTStore, UI = window.BTUI, I = window.BTIcons;
  var S = Store.S;
  var D = function () { return window.BTDebug; };

  var bar, cvs, ovw, tip, pos, btnPlay, btnLive, badgeTxt, emptyEl;
  var playing = 0, pending = false, colors = null;
  var win = { size: null, end: null };   // visible window over the filtered list (null = automatic / follow)
  var hover = -1;                         // filtered position under the mouse (-1 = none)
  var STATUS_TXT = { running: 'Running', success: 'Success', fail: 'Failure', standby: 'Standby' };
  var MIN_COL = 3, MAX_COL = 9;

  function cssColors() {
    var cs = getComputedStyle(document.documentElement), g = function (n) { return cs.getPropertyValue(n).trim(); };
    return { running: g('--st-running'), success: g('--st-success'), fail: g('--st-fail'), standby: g('--st-standby'),
      accent: g('--accent'), muted: g('--muted'), panel: g('--panel'), text: g('--text'), border: g('--border-strong') };
  }

  function speed() { return Number(document.getElementById('simSpeed').value) || 1; }

  /* ------------------------------------------------------------------ *
   * Filtered history: only the ops of the project shown on the canvas
   * ------------------------------------------------------------------ */
  function projectId() { var p = Store.tabProject() || Store.activeProject(); return p ? p.id : null; }

  function model() {
    var ops = D().history(), pid = projectId(), list = [];
    for (var i = 0; i < ops.length; i++) if (ops[i].pid === pid) list.push(i);
    var va = D().viewAt();
    var q;                                   // filtered ops applied at the current view
    if (va === null) q = list.length;
    else { q = 0; while (q < list.length && list[q] < va) q += 1; }
    return { ops: ops, list: list, F: list.length, q: q, live: va === null };
  }

  // global "viewAt" that shows the first q filtered ops
  function globalAt(m, q) {
    if (q <= 0) return m.F ? m.list[0] : 0;
    return m.list[Math.min(q, m.F) - 1] + 1;
  }

  function geometry(m) {
    var W = cvs.clientWidth;
    var fit = Math.max(1, Math.floor(W / MIN_COL));
    var size = Math.max(1, Math.min(m.F, win.size || fit));
    var end = win.end === null ? m.F : Math.max(size, Math.min(m.F, win.end));
    var start = Math.max(0, end - size);
    var col = Math.min(MAX_COL, W / Math.max(size, 1));
    return { W: W, H: cvs.clientHeight, start: start, end: end, size: size, col: col };
  }

  // keeps the playhead inside the window when stepping/replaying
  function keepVisible(m, q) {
    var g = geometry(m);
    if (q < g.start) win.end = Math.min(m.F, q + Math.floor(g.size * 0.8));
    else if (q > g.end) win.end = Math.min(m.F, q + Math.floor(g.size * 0.2));
    if (win.end !== null && win.end >= m.F) win.end = null;
  }

  /* ------------------------------------------------------------------ *
   * Drawing
   * ------------------------------------------------------------------ */
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; draw(); });
  }

  function sizeCanvas(c) {
    var dpr = window.devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    var ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return ctx;
  }

  function barH(o) { return o.status === 'running' ? 0.38 : o.status === 'success' ? 0.68 : 0.95; }

  function draw() {
    if (S.mode !== 'monitor' || !bar) return;
    var m = model(), g = geometry(m);
    if (!colors) colors = cssColors();
    bar.classList.toggle('past', !m.live);
    bar.classList.toggle('empty', !m.F);
    emptyEl.hidden = !!m.F;
    var c = sizeCanvas(cvs);
    if (!m.F) {
      sizeCanvas(ovw);
      btnLive.hidden = true;
      pos.textContent = '';
      tip.hidden = true;
      updateBadge(null);
      return;
    }
    // main strip
    var w = g.col >= 3 ? g.col - 1 : Math.max(1, g.col);
    for (var i = g.start; i < g.end; i++) {
      var o = m.ops[m.list[i]], x = (i - g.start) * g.col;
      if (o.k === 'reset') { c.fillStyle = colors.muted; c.globalAlpha = 0.55; c.fillRect(x, 1, 1, g.H - 2); c.globalAlpha = 1; continue; }
      var h = barH(o) * g.H;
      c.fillStyle = colors[o.status] || colors.standby;
      c.globalAlpha = i === hover - 1 ? 1 : 0.92;
      c.fillRect(x, g.H - h, w, h);
    }
    c.globalAlpha = 1;
    var px = (m.q - g.start) * g.col;
    if (!m.live && m.q < g.end) {
      c.fillStyle = colors.panel; c.globalAlpha = 0.6;
      c.fillRect(Math.max(0, px), 0, (g.end - g.start) * g.col - Math.max(0, px), g.H);
      c.globalAlpha = 1;
    }
    if (px >= -1 && px <= g.W + 1) {
      c.fillStyle = m.live ? colors.accent : colors.text;
      c.fillRect(Math.max(0, Math.min(g.W - 2, px - 1)), 0, 2, g.H);
    }
    // overview: whole history, failures as red ticks, the visible window as a frame
    var oc = sizeCanvas(ovw), OW = ovw.clientWidth, OH = ovw.clientHeight, k = OW / m.F;
    oc.fillStyle = colors.border; oc.globalAlpha = 0.35; oc.fillRect(0, 0, OW, OH); oc.globalAlpha = 1;
    oc.fillStyle = colors.fail;
    for (i = 0; i < m.F; i++) if (m.ops[m.list[i]].status === 'fail') oc.fillRect(Math.floor(i * k), 0, Math.max(1, k), OH);
    oc.fillStyle = colors.accent; oc.globalAlpha = 0.35;
    oc.fillRect(g.start * k, 0, Math.max(3, (g.end - g.start) * k), OH);
    oc.globalAlpha = 1;
    oc.fillStyle = m.live ? colors.accent : colors.text;
    oc.fillRect(Math.min(OW - 2, m.q * k), 0, 2, OH);

    btnLive.hidden = m.live;
    pos.textContent = m.live ? m.F.toLocaleString('en-US') + ' events' : m.q + ' / ' + m.F;
    btnPlay.innerHTML = I.icon(playing || m.live ? 'pause' : 'play', 15);
    btnPlay.title = m.live ? 'Pause and inspect the history (Space)' : playing ? 'Pause playback (Space)' : 'Play from here (Space)';
    updateBadge(m.live ? null : m.q + ' of ' + m.F);
    placeTip(m, g);
  }

  // Floating label: the event under the mouse, or (in the past) the event at the playhead.
  function placeTip(m, g) {
    var at = hover > 0 ? hover : (!m.live ? m.q : -1);
    if (at < 0) { tip.hidden = true; return; }
    var o = at > 0 ? m.ops[m.list[at - 1]] : null;
    tip.innerHTML = describe(o, true);
    tip.hidden = false;
    var sr = cvs.getBoundingClientRect(), br = bar.getBoundingClientRect();
    var x = sr.left - br.left + (at - g.start - 0.5) * g.col;
    var tw = tip.offsetWidth;
    tip.style.left = Math.max(0, Math.min(br.width - tw, x - tw / 2)) + 'px';
    tip.classList.toggle('hovering', hover >= 0);
  }

  function updateBadge(txt) {
    var badge = document.getElementById('monitorBadge');
    badge.classList.toggle('past', !!txt);
    badgeTxt.textContent = txt ? 'History: event ' + txt : 'Monitor: editing locked';
  }

  function describe(o, html) {
    if (!o) return '<span class="tl-muted">start of history</span>';
    if (o.k === 'reset') return '<span class="tl-muted">(new tree run)</span>';
    var p = Store.project(o.pid), tree = p && p.trees[o.treeId], n = tree && tree.nodes[o.nodeId];
    var t = n ? M.TYPES[n.type] : null;
    var body = n ? (t.field ? n.props[t.field.key] : n.props.label) || '' : '';
    var time = new Date(o.time), pad = function (x, l) { return String(x).padStart(l || 2, '0'); };
    var ts = pad(time.getHours()) + ':' + pad(time.getMinutes()) + ':' + pad(time.getSeconds()) + '.' + pad(time.getMilliseconds(), 3);
    return '<span class="chip st-' + o.status + '">' + STATUS_TXT[o.status] + '</span>' +
      '<span class="mono tl-muted">#' + o.index + '</span> <b>' + UI.esc(t ? t.label : '?') + '</b>' +
      (body ? ' <span class="mono">' + UI.esc(body) + '</span>' : '') + ' <span class="tl-muted mono">' + ts + '</span>';
  }

  /* ------------------------------------------------------------------ *
   * Navigation
   * ------------------------------------------------------------------ */
  function focusCurrent() {
    var m = model();
    if (m.live || m.q === 0) { window.BTCanvas.focusEvent(null); return; }
    var o = m.ops[m.list[m.q - 1]];
    if (o && o.k === 'ev') window.BTCanvas.focusEvent(o.nodeId, o.ctx, !!S.settings.follow);
    else window.BTCanvas.focusEvent(null);
  }

  // q = filtered position; fx: true = animate like a live event, 'stay' = never switch to live
  function goTo(q, fx) {
    var m = model();
    if (!m.F) return;
    q = Math.max(0, Math.min(m.F, q));
    if (q >= m.F && fx === true) { live(); return; }
    keepVisible(m, q);
    D().setViewAt(globalAt(m, q), fx === true ? true : 'stay');
    focusCurrent();
    schedule();
  }

  function step(delta) { stop(); var m = model(); if (m.F) goTo(m.q + delta, delta > 0 ? true : 'stay'); }

  function jumpFail(dir) {
    stop();
    var m = model();
    if (!m.F) return;
    for (var q = m.q + dir; q >= 1 && q <= m.F; q += dir) {
      if (m.ops[m.list[q - 1]].status === 'fail') { goTo(q, 'stay'); return; }
    }
    UI.toast(dir < 0 ? 'No failure before this point.' : 'No failure after this point.', 'info', 1600);
  }

  function pause() { stop(); var m = model(); if (m.live && m.F) goTo(m.F, 'stay'); }
  function stop() { if (playing) { clearTimeout(playing); playing = 0; schedule(); } }
  function play() {
    if (model().live) return;
    var tick = function () {
      var m = model();
      if (m.live) { playing = 0; schedule(); return; }
      goTo(m.q + 1, true);
      playing = model().live ? 0 : setTimeout(tick, 260 / speed());
      schedule();
    };
    playing = setTimeout(tick, 10);
    schedule();
  }
  function toggle() {
    var m = model();
    if (!m.F) return;
    if (m.live) pause(); else if (playing) stop(); else play();
  }
  function live() { stop(); win.end = null; D().setViewAt(null); focusCurrent(); schedule(); }

  // terminal integration: clicking a [BTREE] line shows the tree at that moment
  function jumpToOp(op) {
    var g = D().indexOfOp(op);
    if (g < 0) return false;
    stop();
    var m = model();
    var q = m.list.indexOf(g);
    if (q < 0) return false;
    goTo(q + 1, 'stay');
    return true;
  }

  function posAt(e, m, g) {
    var r = cvs.getBoundingClientRect();
    return Math.max(0, Math.min(m.F, g.start + Math.round((e.clientX - r.left) / g.col)));
  }

  function connectOrSimulate(kind) {
    var src = document.getElementById('srcKind');
    if (kind === 'sim') { src.value = 'sim'; src.dispatchEvent(new Event('change')); D().connect(); }
    else { window.BTApp.showBottom('terminal'); src.focus(); }
  }

  function init() {
    bar = document.getElementById('timeline');
    cvs = document.getElementById('tlCanvas');
    ovw = document.getElementById('tlOverview');
    tip = document.getElementById('tlTip');
    pos = document.getElementById('tlPos');
    emptyEl = document.getElementById('tlEmpty');
    btnPlay = document.getElementById('tlPlay');
    btnLive = document.getElementById('tlLive');
    badgeTxt = document.querySelector('#monitorBadge .txt');
    document.getElementById('tlBack').onclick = function (e) { if (e.shiftKey) jumpFail(-1); else step(-1); };
    document.getElementById('tlFwd').onclick = function (e) { if (e.shiftKey) jumpFail(1); else step(1); };
    document.getElementById('tlSim').onclick = function () { connectOrSimulate('sim'); };
    document.getElementById('tlConnect').onclick = function () { connectOrSimulate('conn'); };
    btnPlay.onclick = toggle;
    btnLive.onclick = live;

    var scrubbing = false;
    cvs.addEventListener('pointerdown', function (e) {
      var m = model();
      if (!m.F) return;
      e.preventDefault();
      stop();
      scrubbing = true;
      cvs.setPointerCapture(e.pointerId);
      goTo(posAt(e, m, geometry(m)), 'stay');
    });
    cvs.addEventListener('pointermove', function (e) {
      var m = model();
      if (!m.F) return;
      var q = posAt(e, m, geometry(m));
      if (scrubbing) { hover = -1; goTo(q, 'stay'); return; }
      hover = Math.max(1, q);
      schedule();
    });
    cvs.addEventListener('pointerleave', function () { hover = -1; schedule(); });
    var end = function () { scrubbing = false; };
    cvs.addEventListener('pointerup', end);
    cvs.addEventListener('pointercancel', end);
    // wheel: zoom around the mouse; horizontal scroll / Shift+wheel: move the window
    cvs.addEventListener('wheel', function (e) {
      var m = model();
      if (!m.F) return;
      e.preventDefault();
      var g = geometry(m);
      var horizontal = e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY);
      if (horizontal) {
        var d = Math.round((e.deltaX || e.deltaY) / g.col);
        win.end = Math.max(g.size, Math.min(m.F, g.end + (d || (e.deltaY > 0 ? 1 : -1))));
      } else {
        var r = cvs.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width;
        var anchor = g.start + fx * g.size;
        var size = Math.round(g.size * Math.exp(e.deltaY * 0.0025));
        size = Math.max(12, Math.min(Math.max(12, m.F), size));
        var start = Math.max(0, Math.round(anchor - fx * size));
        win.size = size >= Math.floor(g.W / MIN_COL) && size >= m.F ? null : size;
        win.end = Math.min(m.F, start + size);
      }
      if (win.end >= m.F) win.end = null;
      schedule();
    }, { passive: false });
    // overview: click/drag moves the window there
    var ovDrag = false;
    var moveWin = function (e) {
      var m = model(), g = geometry(m), r = ovw.getBoundingClientRect();
      var center = (e.clientX - r.left) / r.width * m.F;
      win.end = Math.round(Math.max(g.size, Math.min(m.F, center + g.size / 2)));
      if (win.end >= m.F) win.end = null;
      schedule();
    };
    ovw.addEventListener('pointerdown', function (e) { if (!model().F) return; ovDrag = true; ovw.setPointerCapture(e.pointerId); moveWin(e); });
    ovw.addEventListener('pointermove', function (e) { if (ovDrag) moveWin(e); });
    ovw.addEventListener('pointerup', function () { ovDrag = false; });

    Store.on('history-log', schedule);
    Store.on('tabs', function () { win = { size: null, end: null }; schedule(); });
    Store.on('mode', function () { if (S.mode !== 'monitor') { stop(); if (D().viewAt() !== null) live(); } schedule(); });
    Store.on('settings', function () { colors = null; schedule(); });
    Store.on('connection', schedule);
    new ResizeObserver(schedule).observe(cvs);
    schedule();
  }

  window.BTTimeline = {
    init: init, step: step, toggle: toggle, live: live, jumpFail: jumpFail, jumpToOp: jumpToOp,
    isPast: function () { return D().viewAt() !== null; }, hasEvents: function () { return model().F > 0; }
  };
})();
