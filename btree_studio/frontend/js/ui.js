/* BTree Studio - generic UI helpers: toasts, modals, context menus, downloads. */
(function () {
  'use strict';
  var I = window.BTIcons;

  function esc(s) {
    return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === undefined || v === null || v === false) return;
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'text') e.textContent = v;
      else if (k.indexOf('on') === 0 && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else e.setAttribute(k, v === true ? '' : v);
    });
    (children || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }

  /* ------------------------------ toasts ------------------------------ */
  function toast(message, kind, ms) {
    var box = document.getElementById('toasts');
    var iconName = { error: 'error', success: 'check', warning: 'alert' }[kind] || 'info';
    var t = el('div', { class: 'toast ' + (kind || 'info'), html: I.icon(iconName, 16) + '<span>' + esc(message) + '</span>' });
    box.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('show'); });
    var close = function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 250); };
    t.addEventListener('click', close);
    setTimeout(close, ms || (kind === 'error' ? 6000 : 3200));
  }

  /* ------------------------------ modals ------------------------------ */
  var modalStack = [];
  function modal(opts) {
    // opts: { title, body (Node|string), buttons: [{label, kind, value, action}], width, onClose }
    return new Promise(function (resolve) {
      var root = document.getElementById('modalRoot');
      var overlay = el('div', { class: 'modal-overlay' });
      var box = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' });
      if (opts.width) box.style.width = opts.width;
      var head = el('div', { class: 'modal-head' }, [
        el('h3', { text: opts.title || '' }),
        el('button', { class: 'mini', title: 'Fechar (Esc)', html: I.icon('x', 16), onclick: function () { done(undefined); } })
      ]);
      var body = el('div', { class: 'modal-body' });
      if (typeof opts.body === 'string') body.innerHTML = opts.body; else if (opts.body) body.appendChild(opts.body);
      var foot = el('div', { class: 'modal-foot' });
      (opts.buttons || [{ label: 'OK', kind: 'primary', value: true }]).forEach(function (b) {
        var btn = el('button', { class: 'btn ' + (b.kind || ''), type: 'button', html: (b.icon ? I.icon(b.icon, 16) : '') + esc(b.label) });
        btn.addEventListener('click', function () {
          if (b.action) { var r = b.action(body); if (r === false) return; done(r === undefined ? b.value : r); }
          else done(b.value);
        });
        foot.appendChild(btn);
      });
      box.appendChild(head); box.appendChild(body); box.appendChild(foot);
      overlay.appendChild(box);
      root.appendChild(overlay);
      overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) done(undefined); });
      var entry = { done: null, box: box };
      modalStack.push(entry);
      function done(v) {
        overlay.classList.remove('show');
        modalStack.splice(modalStack.indexOf(entry), 1);
        setTimeout(function () { overlay.remove(); }, 150);
        if (opts.onClose) opts.onClose(v);
        resolve(v);
      }
      entry.done = done;
      entry.submit = function () {
        var primary = foot.querySelector('.btn.primary') || foot.querySelector('.btn:last-child');
        if (primary) primary.click();
      };
      requestAnimationFrame(function () {
        overlay.classList.add('show');
        var f = body.querySelector('input,select,textarea') || foot.querySelector('.btn.primary');
        if (f) { f.focus(); if (f.select && f.tagName === 'INPUT') f.select(); }
      });
    });
  }

  function hasModal() { return modalStack.length > 0; }
  function closeTopModal() { var m = modalStack[modalStack.length - 1]; if (m) m.done(undefined); }
  function submitTopModal() { var m = modalStack[modalStack.length - 1]; if (m) m.submit(); }

  function confirmDialog(title, message, okLabel, danger) {
    return modal({
      title: title,
      body: '<p>' + message + '</p>',
      buttons: [{ label: 'Cancelar', value: false }, { label: okLabel || 'Confirmar', kind: danger ? 'danger' : 'primary', value: true }]
    }).then(function (v) { return !!v; });
  }

  // validate(value) -> error string | null
  function prompt(title, label, value, validate, hint) {
    var input = el('input', { class: 'input', value: value || '', spellcheck: 'false' });
    var err = el('div', { class: 'field-error' });
    var body = el('div', { class: 'form' }, [
      el('label', { class: 'field' }, [el('span', { text: label }), input]),
      hint ? el('div', { class: 'hint', text: hint }) : null,
      err
    ]);
    function check() {
      var e = validate ? validate(input.value.trim()) : null;
      err.textContent = e || '';
      input.classList.toggle('invalid', !!e);
      return !e;
    }
    input.addEventListener('input', check);
    input.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); submitTopModal(); } });
    return modal({
      title: title, body: body,
      buttons: [{ label: 'Cancelar', value: null }, {
        label: 'OK', kind: 'primary',
        action: function () { if (!check()) { input.focus(); return false; } return input.value.trim(); }
      }]
    }).then(function (v) { return v === undefined ? null : v; });
  }

  /* ------------------------------ context menu ------------------------ */
  // items: [{ label, icon, shortcut, action, disabled, danger, submenu: [...] } | '-' ]
  function contextMenu(x, y, items) {
    var menu = document.getElementById('ctxMenu');
    closeMenus();
    menu.innerHTML = '';
    buildMenu(menu, items);
    menu.hidden = false;
    var r = menu.getBoundingClientRect();
    var vw = window.innerWidth, vh = window.innerHeight;
    menu.style.left = Math.max(4, Math.min(x, vw - r.width - 4)) + 'px';
    menu.style.top = Math.max(4, Math.min(y, vh - r.height - 4)) + 'px';
  }

  function buildMenu(container, items) {
    items.forEach(function (it) {
      if (!it) return;
      if (it === '-') { container.appendChild(el('div', { class: 'menu-sep' })); return; }
      if (it.header) { container.appendChild(el('div', { class: 'menu-header', text: it.header })); return; }
      var row = el('div', { class: 'menu-item' + (it.disabled ? ' disabled' : '') + (it.danger ? ' danger' : '') + (it.submenu ? ' has-sub' : '') });
      row.innerHTML = '<span class="mi-icon">' + (it.icon ? I.icon(it.icon, 15) : '') + '</span><span class="mi-label">' + esc(it.label) + '</span>' +
        (it.shortcut ? '<span class="mi-short">' + esc(it.shortcut) + '</span>' : '') +
        (it.submenu ? '<span class="mi-arrow">' + I.icon('chevron-right', 14) + '</span>' : '');
      if (it.title) row.title = it.title;
      if (it.submenu && !it.disabled) {
        var sub = el('div', { class: 'menu submenu' });
        buildMenu(sub, it.submenu);
        row.appendChild(sub);
        row.addEventListener('mouseenter', function () {
          sub.style.left = ''; sub.style.right = ''; sub.style.top = '';
          var rr = row.getBoundingClientRect();
          sub.classList.add('open');
          var sr = sub.getBoundingClientRect();
          if (rr.right + sr.width > window.innerWidth - 4) { sub.style.left = 'auto'; sub.style.right = '100%'; }
          if (sr.bottom > window.innerHeight - 4) sub.style.top = (window.innerHeight - 4 - sr.bottom - 6) + 'px';
        });
        row.addEventListener('mouseleave', function () { sub.classList.remove('open'); });
      } else if (!it.disabled && it.action) {
        row.addEventListener('click', function (e) { e.stopPropagation(); closeMenus(); it.action(); });
      }
      container.appendChild(row);
    });
  }

  function closeMenus() {
    var menu = document.getElementById('ctxMenu');
    if (menu) { menu.hidden = true; menu.innerHTML = ''; }
  }

  document.addEventListener('mousedown', function (e) {
    var menu = document.getElementById('ctxMenu');
    if (menu && !menu.hidden && !menu.contains(e.target)) closeMenus();
  });
  window.addEventListener('blur', closeMenus);
  window.addEventListener('resize', closeMenus);

  /* ------------------------------ files ------------------------------- */
  // System clipboard may be missing (http) or denied (tab without focus): never throw.
  function copyText(text, okMsg) {
    var c = navigator.clipboard;
    return (c ? c.writeText(text) : Promise.reject(new Error('sem clipboard'))).then(function () {
      if (okMsg) toast(okMsg, 'success', 1500);
    }, function () { if (okMsg) toast('O navegador bloqueou a área de transferência.', 'warning'); });
  }

  function download(filename, text, mime) {
    var blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    var a = el('a', { href: URL.createObjectURL(blob), download: filename });
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function readFile(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error); };
      r.readAsText(file);
    });
  }

  /* ------------------------------ uint input --------------------------- */
  // Input that only accepts digits and clamps to [min,max]. onChange(valueString, error)
  function uintInput(value, min, max, onChange) {
    var input = el('input', { class: 'input mono', inputmode: 'numeric', value: value || '', spellcheck: 'false', autocomplete: 'off' });
    input.addEventListener('beforeinput', function (e) {
      if (e.data && /\D/.test(e.data)) e.preventDefault();
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        var n = Number(input.value || 0) + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 100 : 1);
        n = Math.max(min, Math.min(max, n));
        input.value = String(n);
        input.dispatchEvent(new Event('input'));
      }
    });
    input.addEventListener('input', function () {
      var digits = input.value.replace(/\D/g, '');
      if (digits !== input.value) input.value = digits;
      if (digits.length > 1) { digits = digits.replace(/^0+(?=\d)/, ''); if (digits !== input.value) input.value = digits; }
      if (digits && Number(digits) > max) { input.value = String(max); digits = input.value; input.classList.add('clamped'); setTimeout(function () { input.classList.remove('clamped'); }, 500); }
      onChange(digits);
    });
    input.addEventListener('paste', function (e) {
      var text = (e.clipboardData || window.clipboardData).getData('text');
      if (/\D/.test(text.trim())) { e.preventDefault(); toast('Somente números são aceitos neste campo.', 'warning'); }
    });
    return input;
  }

  /* ------------------------------ resizers ----------------------------- */
  function makeResizer(handle, onMove, onEnd) {
    handle.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);
      handle.classList.add('active');
      document.body.classList.add('resizing');
      var sx = e.clientX, sy = e.clientY;
      var start = onMove(0, 0, true);
      function move(ev) { onMove(ev.clientX - sx, ev.clientY - sy, false, start); }
      function up() {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', up);
        handle.classList.remove('active');
        document.body.classList.remove('resizing');
        if (onEnd) onEnd();
      }
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up);
    });
  }

  var isMac = /Mac|iPhone|iPad/.test(navigator.platform || '');
  function kbd(s) { return isMac ? s.replace(/Ctrl\+/g, '⌘').replace(/Alt\+/g, '⌥') : s; }

  window.BTUI = {
    esc: esc, el: el, toast: toast, modal: modal, hasModal: hasModal, closeTopModal: closeTopModal, submitTopModal: submitTopModal,
    confirm: confirmDialog, prompt: prompt, contextMenu: contextMenu, closeMenus: closeMenus,
    download: download, copyText: copyText, readFile: readFile, uintInput: uintInput, makeResizer: makeResizer, kbd: kbd, isMac: isMac
  };
})();
