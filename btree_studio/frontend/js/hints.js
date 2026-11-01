/* BTree Studio - contextual hints: a discreet line in the corner of the canvas telling what can be
 * done right now (nothing selected, a node selected, loose nodes, monitor live/past...).
 * Closing it with × hides the hints for good (Ctrl+K › "Mostrar dicas" brings them back). */
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
      if (T.isPast()) return k(', .', 'passo') + k('Shift+,.', 'falhas') + k('Espaço', 'reproduzir') + k('End', 'ao vivo');
      return k('Espaço', 'pausar') + '<span class="h-item">clique na linha do tempo (ou no terminal) para voltar no tempo</span>';
    }
    if (M.looseRoots(cur.tree).length) {
      return '<span class="h-item">Nó solto: arraste a <b>bolinha de cima</b> até um pai para ligá-lo (não dá para salvar com nós soltos)</span>';
    }
    var v = window.BTCanvas.selectedVNode();
    var many = window.BTCanvas.selectedVNodes().length > 1;
    if (many) return k('Del', 'excluir') + k('Ctrl+C', 'copiar') + k('Ctrl+D', 'duplicar') + k('Esc', 'limpar seleção');
    if (v && v.readonly) return '<span class="h-item">Nó de outra árvore: duplo clique abre a subárvore para editar</span>';
    if (v && v.node.type === 'root') return k('Espaço', 'adicionar filho') + k('Ctrl+K', 'comandos');
    if (v) {
      var t = M.TYPES[v.node.type];
      return k('Espaço', t.maxChildren > v.node.children.length ? 'adicionar filho' : 'adicionar') +
        k('Enter', v.node.type === 'subtree' ? 'abrir' : 'editar') + k('Del', 'excluir') + k('Alt+←→', 'reordenar') + k('Ctrl+K', 'comandos');
    }
    return '<span class="h-item">Duplo clique no vazio: novo nó</span>' + k('Ctrl+K', 'comandos e busca') + k('F', 'ajustar à tela') + k('F1', 'ajuda');
  }

  function update() {
    pending = false;
    var html = content();
    if (html === last) return;
    last = html;
    if (!html) { box.hidden = true; return; }
    var show = function () {
      box.innerHTML = '<span class="h-items">' + html + '</span><button class="h-close" title="Ocultar dicas (Ctrl+K › Mostrar dicas traz de volta)">' + I.icon('x', 12) + '</button>';
      box.querySelector('.h-close').onclick = function () { Store.setSetting('hints', false); UI.toast('Dicas ocultas. Para trazer de volta: Ctrl+K › Mostrar dicas.', 'info', 3500); };
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
