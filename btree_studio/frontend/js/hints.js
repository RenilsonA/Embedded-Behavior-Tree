/* BTree Studio - contextual hints: a discreet line in the corner of the canvas telling what can be
 * done right now (nothing selected, a node selected, loose nodes, monitor live/past...).
 * Closing it with × hides the hints for good (Ctrl+K › "Show hints" brings them back). */
(function () {
  'use strict';
  var M = window.BTModel, Store = window.BTStore, UI = window.BTUI, I = window.BTIcons;
  var S = Store.S;

  var box, last = '', pending = false;

  function k(keys, text) {
    return '<span class="h-item">' + keys.split(' ').map(function (x) { return '<kbd>' + UI.esc(UI.kbd(x.replace(/_/g, ' '))) + '</kbd>'; }).join('') + UI.esc(text) + '</span>';
  }

  function content() {
    if (S.settings.hints === false || window.BTCanvas.isDragging()) return '';
    var cur = window.BTCanvas.current();
    if (!cur) return '';
    if (S.mode === 'monitor') {
      var T = window.BTTimeline;
      if (!T || !T.hasEvents()) return '';
      if (T.isPast()) return k(', .', 'step') + k('Shift+,.', 'failures') + k('Space', 'play') + k('End', 'live');
      return k('Space', 'pause') + '<span class="h-item">click the timeline (or the terminal) to go back in time</span>';
    }
    if (M.looseRoots(cur.tree).length) {
      return '<span class="h-item">Loose node: drag its <b>top dot</b> to a parent to link it (projects with loose nodes cannot be saved)</span>';
    }
    var v = window.BTCanvas.selectedVNode();
    var many = window.BTCanvas.selectedVNodes().length > 1;
    if (many) return k('Del', 'delete') + k('Ctrl+C', 'copy') + k('Ctrl+D', 'duplicate') + k('Esc', 'clear selection');
    if (v && v.readonly) return '<span class="h-item">Node from another tree: double-click opens the subtree to edit</span>';
    if (v && v.node.type === 'root') return k('Space', 'add child') + k('Ctrl+K', 'commands');
    if (v) {
      var t = M.TYPES[v.node.type];
      return k('Space', t.maxChildren > v.node.children.length ? 'add child' : 'add') +
        k('Enter', v.node.type === 'subtree' ? 'open' : 'edit') + k('Del', 'delete') + k('Alt+←→', 'reorder') + k('Ctrl+K', 'commands');
    }
    return '<span class="h-item">Double-click on empty space: new node</span>' + k('Ctrl+K', 'commands and search') + k('F', 'fit to screen') + k('F1', 'help');
  }

  function update() {
    pending = false;
    var html = content();
    if (html === last) return;
    last = html;
    if (!html) { box.hidden = true; return; }
    var show = function () {
      box.innerHTML = '<span class="h-items">' + html + '</span><button class="h-close" title="Hide hints (Ctrl+K › Show hints brings them back)">' + I.icon('x', 12) + '</button>';
      box.querySelector('.h-close').onclick = function () { Store.setSetting('hints', false); UI.toast('Hints hidden. To bring them back: Ctrl+K › Show hints.', 'info', 3500); };
      box.classList.remove('swap');
    };
    if (box.hidden || !window.BTCanvas.motionOK()) { box.hidden = false; show(); return; }
    box.classList.add('swap');
    setTimeout(show, 140);
  }

  function schedule() { if (!pending) { pending = true; setTimeout(update, 60); } }

  function init() {
    box = document.getElementById('hints');
    ['selection', 'structure', 'mode', 'settings', 'history-log', 'tabs'].forEach(function (t) { Store.on(t, schedule); });
    window.addEventListener('pointerup', schedule);
    update();
  }

  window.BTHints = { init: init };
})();
