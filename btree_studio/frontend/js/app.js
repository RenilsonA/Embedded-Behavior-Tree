/* BTree Studio - application shell: workspace sidebar, palette, tabs, toolbar, dialogs, shortcuts. */
(function () {
  'use strict';
  var M = window.BTModel, Store = window.BTStore, UI = window.BTUI, I = window.BTIcons;
  var C = window.BTCanvas, D = window.BTDebug;
  var S = Store.S, T = M.TYPES, el = UI.el;

  var EXAMPLE_XML = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<root BTCPP_format="4" main_tree_to_execute="main" project_name="robot">',
    '  <BehaviorTree ID="main">',
    '    <ReactiveFallback name="Robo">',
    '      <Sequence name="Bateria baixa">',
    '        <ScriptCondition code="is_battery_low"/>',
    '        <SubTree ID="go_charge"/>',
    '      </Sequence>',
    '      <Sequence name="Patrulha">',
    '        <Script code="move_to_a"/>',
    '        <Sleep msec="1500"/>',
    '        <RetryUntilSuccessful num_attempts="3">',
    '          <Script code="move_to_b"/>',
    '        </RetryUntilSuccessful>',
    '        <Inverter>',
    '          <ScriptCondition code="obstacle_detected"/>',
    '        </Inverter>',
    '      </Sequence>',
    '      <ForceSuccess>',
    '        <Script code="idle"/>',
    '      </ForceSuccess>',
    '    </ReactiveFallback>',
    '  </BehaviorTree>',
    '  <BehaviorTree ID="go_charge">',
    '    <Fallback>',
    '      <ScriptCondition code="is_docked"/>',
    '      <Sequence>',
    '        <Script code="find_dock"/>',
    '        <Repeat num_cycles="2">',
    '          <Script code="align_with_dock"/>',
    '        </Repeat>',
    '        <KeepRunningUntilFailure>',
    '          <Script code="dock"/>',
    '        </KeepRunningUntilFailure>',
    '      </Sequence>',
    '    </Fallback>',
    '  </BehaviorTree>',
    '  <TreeNodesModel/>',
    '</root>'
  ].join('\n');

  /* ------------------------------------------------------------------ *
   * Validators
   * ------------------------------------------------------------------ */
  function identError(v) {
    if (!v) return 'Obrigatório.';
    if (!M.C_IDENT_RE.test(v)) return 'Use letras, números e _ (sem começar com número e sem espaços).';
    return null;
  }

  /* ------------------------------------------------------------------ *
   * Projects & trees
   * ------------------------------------------------------------------ */
  function newProject() {
    return UI.prompt('Novo projeto', 'Nome do projeto', M.uniqueName('projeto', Store.projectNames()), function (v) {
      return identError(v) || (Store.projectNames().indexOf(v) >= 0 ? 'Já existe um projeto com esse nome.' : null);
    }, 'O nome do projeto é usado nos arquivos C gerados e aparece em maiúsculas no campo "Tree:" do log.').then(function (name) {
      if (!name) return null;
      var p = M.makeProject(name);
      Store.addProject(p);
      UI.toast('Projeto "' + name + '" criado com a árvore principal "main".', 'success');
      return p;
    });
  }

  function newTree(projectId, open) {
    var p = Store.project(projectId || S.activeProjectId);
    if (!p) { UI.toast('Crie ou abra um projeto primeiro.', 'warning'); return Promise.resolve(null); }
    return UI.prompt('Nova subárvore em ' + p.name, 'Nome da árvore', M.uniqueName('subtree', M.treeNames(p)), function (v) {
      return identError(v) || (M.findTreeByName(p, v) ? 'Já existe uma árvore com esse nome neste projeto.' : null);
    }).then(function (name) {
      if (!name) return null;
      var tree = M.makeTree(name, true);
      Store.mutate(p.id, function () { M.addTreeToProject(p, tree); M.resolveRefsByName(p); });
      if (open !== false) Store.openTab(p.id, tree.id, null);
      return tree;
    });
  }

  function renameTree(projectId, treeId) {
    var p = Store.project(projectId), tree = p && p.trees[treeId];
    if (!tree) return;
    UI.prompt('Renomear árvore', 'Novo nome', tree.name, function (v) {
      return identError(v) || (v !== tree.name && M.findTreeByName(p, v) ? 'Já existe uma árvore com esse nome.' : null);
    }, 'As SubTrees que chamam esta árvore são atualizadas automaticamente.').then(function (name) {
      if (!name || name === tree.name) return;
      Store.mutate(p.id, function () { tree.name = name; M.resolveRefsByName(p); });
    });
  }

  function setMainTree(projectId, treeId) {
    var p = Store.project(projectId);
    if (!p || p.mainTreeId === treeId) return;
    var old = p.trees[p.mainTreeId];
    Store.mutate(p.id, function () { p.mainTreeId = treeId; });
    S.tabs.forEach(function (t) {
      if (t.projectId !== p.id) return;
      if (t.treeId === treeId) t.ctx = '';
      else if (t.ctx !== null) t.ctx = null;
    });
    Store.emit('tabs'); Store.emit('structure');
    UI.toast('"' + p.trees[treeId].name + '" agora é a árvore principal' + (old ? '. "' + old.name + '" pode ser excluída.' : '.'), 'success');
  }

  function treeRefCount(p, treeId) {
    var count = 0;
    p.treeOrder.forEach(function (tid) {
      var tr = p.trees[tid];
      Object.keys(tr.nodes).forEach(function (nid) { if (tr.nodes[nid].type === 'subtree' && tr.nodes[nid].props.ref === treeId) count += 1; });
    });
    return count;
  }

  function deleteTree(projectId, treeId) {
    var p = Store.project(projectId), tree = p && p.trees[treeId];
    if (!tree) return;
    if (treeId === p.mainTreeId) {
      UI.toast('"' + tree.name + '" é a árvore principal. Defina outra árvore como principal antes de excluí-la.', 'warning', 5000);
      return;
    }
    var refs = treeRefCount(p, treeId);
    UI.confirm('Excluir árvore', 'Excluir a árvore <b>' + UI.esc(tree.name) + '</b>?' +
      (refs ? '<br><br>' + I.icon('alert', 14) + ' Ela é chamada por <b>' + refs + '</b> nó(s) SubTree, que ficarão sem destino.' : '') +
      '<br><br>Você pode desfazer com ' + UI.kbd('Ctrl+Z') + '.', 'Excluir', true).then(function (ok) {
      if (!ok) return;
      Store.mutate(p.id, function () {
        p.treeOrder.forEach(function (tid) {
          var tr = p.trees[tid];
          Object.keys(tr.nodes).forEach(function (nid) {
            var n = tr.nodes[nid];
            if (n.type === 'subtree' && n.props.ref === treeId) { n.props.ref = ''; n.props.missingRef = tree.name; }
          });
        });
        delete p.trees[treeId];
        p.treeOrder = p.treeOrder.filter(function (id) { return id !== treeId; });
      });
      S.tabs.filter(function (t) { return t.treeId === treeId; }).forEach(function (t) { Store.closeTab(t.id); });
    });
  }

  function duplicateTree(projectId, treeId) {
    var p = Store.project(projectId), tree = p && p.trees[treeId];
    if (!tree) return;
    var copy = M.makeTree(M.uniqueName(tree.name + '_copia', M.treeNames(p)), false);
    var root = tree.nodes[tree.rootId];
    Store.mutate(p.id, function () {
      root.children.forEach(function (cid) { M.importBranch(copy, M.exportBranch(tree, cid), copy.rootId); });
      M.addTreeToProject(p, copy);
    });
    Store.openTab(p.id, copy.id, null);
  }

  function renameProject(projectId) {
    var p = Store.project(projectId);
    if (!p) return;
    UI.prompt('Renomear projeto', 'Novo nome', p.name, function (v) {
      return identError(v) || (v !== p.name && Store.projectNames().indexOf(v) >= 0 ? 'Já existe um projeto com esse nome.' : null);
    }, 'Lembre-se: o nome aparece em maiúsculas no campo "Tree:" do log do firmware.').then(function (name) {
      if (!name || name === p.name) return;
      Store.mutate(p.id, function () { p.name = name; });
    });
  }

  function deleteProject(projectId) {
    var p = Store.project(projectId);
    if (!p) return;
    var onDisk = p.meta && p.meta.onDisk && S.backend;
    UI.confirm('Excluir projeto', 'Excluir o projeto <b>' + UI.esc(p.name) + '</b> e todas as suas árvores?' +
      (onDisk ? '<br><br>' + I.icon('alert', 14) + ' A pasta do projeto no workspace também será apagada do disco.' : '') +
      '<br><br>Esta ação não pode ser desfeita.', 'Excluir projeto', true).then(function (ok) {
      if (!ok) return;
      Store.removeProject(p.id).then(function () { UI.toast('Projeto excluído.', 'success'); }).catch(function (e) { UI.toast(e.message, 'error'); });
    });
  }

  function closeProject(projectId) {
    // only for projects that are not on a server workspace
    var p = Store.project(projectId);
    if (!p) return;
    var go = S.dirty[p.id] ? UI.confirm('Fechar projeto', 'O projeto <b>' + UI.esc(p.name) + '</b> tem alterações não exportadas. Fechar mesmo assim?', 'Fechar', true) : Promise.resolve(true);
    go.then(function (ok) { if (ok) Store.removeProject(p.id); });
  }

  /* ------------------------------------------------------------------ *
   * Import / export / save / code generation
   * ------------------------------------------------------------------ */
  function openFiles(files) {
    files = Array.prototype.slice.call(files || []);
    if (!files.length) return;
    Promise.all(files.map(function (f) { return UI.readFile(f).then(function (text) { return { name: f.name, text: text }; }); })).then(function (list) {
      var byName = {};
      list.forEach(function (f) { byName[f.name] = f; });
      var projects = [];
      var used = {};
      // .btproj first: they include xml files
      list.filter(function (f) { return /\.btproj$/i.test(f.name); }).forEach(function (f) {
        try {
          var imp = M.importXml(f.text, f.name.replace(/\.btproj$/i, ''));
          var missing = [];
          imp.includes.forEach(function (path) {
            var base = path.split(/[\\/]/).pop();
            var inc = byName[base];
            if (!inc) { missing.push(base); return; }
            used[base] = true;
            var sub = M.importXml(inc.text, imp.name);
            imp.trees = imp.trees.concat(sub.trees);
            if (!imp.mainTreeName || !imp.trees.some(function (t) { return t.name === imp.mainTreeName; })) imp.mainTreeName = sub.mainTreeName;
          });
          if (missing.length) UI.toast('Selecione também: ' + missing.join(', ') + ' (incluídos por ' + f.name + ').', 'warning', 7000);
          if (imp.trees.length) projects.push(imp);
        } catch (e) { UI.toast(f.name + ': ' + e.message, 'error', 8000); }
      });
      list.filter(function (f) { return !/\.btproj$/i.test(f.name) && !used[f.name]; }).forEach(function (f) {
        try {
          var imp = M.importXml(f.text, f.name.replace(/\.xml$/i, '').replace(/[^A-Za-z0-9_]/g, '_'));
          if (!imp.trees.length) { UI.toast(f.name + ': nenhum <BehaviorTree> encontrado.', 'warning'); return; }
          projects.push(imp);
        } catch (e) { UI.toast(f.name + ': ' + e.message, 'error', 8000); }
      });
      var chain = Promise.resolve();
      projects.forEach(function (imp) { chain = chain.then(function () { return addImported(imp); }); });
    });
  }

  function addImported(imp) {
    var name = imp.name.replace(/[^A-Za-z0-9_]/g, '_');
    if (!/^[A-Za-z_]/.test(name)) name = 'p_' + name;
    var existing = S.projects.find(function (p) { return p.name === name; });
    var decide = existing ? UI.modal({
      title: 'Projeto já existe',
      body: '<p>Já existe um projeto chamado <b>' + UI.esc(name) + '</b> no workspace.</p>',
      buttons: [{ label: 'Cancelar', value: null }, { label: 'Importar como cópia', value: 'copy' }, { label: 'Substituir', kind: 'danger', value: 'replace' }]
    }) : Promise.resolve('new');
    return decide.then(function (choice) {
      if (!choice) return;
      if (choice === 'copy') name = M.uniqueName(name, Store.projectNames());
      var p = M.projectFromImport(imp, name);
      if (choice === 'replace') {
        p.meta = existing.meta || {};
        p.logName = existing.logName || '';
        S.projects = S.projects.filter(function (x) { return x.id !== existing.id; });
        S.tabs = S.tabs.filter(function (t) { return t.projectId !== existing.id; });
      }
      Store.addProject(p);
      var issues = M.validateProject(p).filter(function (i) { return i.level === 'error'; });
      UI.toast('Importado "' + p.name + '": ' + p.treeOrder.length + ' árvore(s)' + (issues.length ? ', ' + issues.length + ' problema(s) — veja a aba Problemas.' : '.'), issues.length ? 'warning' : 'success', 5000);
    });
  }

  // Loose nodes are fine while editing, but never reach a file.
  function blockedByLoose(p) {
    var loose = M.looseNodes(p);
    if (!loose.length) return false;
    UI.modal({ title: 'Há nós soltos em ' + p.name,
      body: '<p>Ligue estes nós a um pai (arraste a bolinha de cima até o pai) ou exclua-os antes de salvar/exportar:</p><ul class="issues">' +
        loose.slice(0, 12).map(function (l) {
          var t = M.TYPES[l.node.type], f = t.field ? l.node.props[t.field.key] : l.node.props.label;
          return '<li>' + UI.esc(l.tree.name + ': ' + t.label + (f ? ' "' + f + '"' : '')) + '</li>';
        }).join('') + '</ul>',
      buttons: [{ label: 'Fechar', value: null }, { label: 'Ver problemas', kind: 'primary', value: true }] }).then(function (v) { if (v) showBottom('problems'); });
    return true;
  }

  function exportXml(projectId) {
    var p = Store.project(projectId || S.activeProjectId);
    if (!p) { UI.toast('Nenhum projeto ativo.', 'warning'); return; }
    if (blockedByLoose(p)) return;
    UI.download(p.name + '.xml', M.exportXml(p), 'application/xml');
  }

  function exportBtproj(projectId) {
    var p = Store.project(projectId || S.activeProjectId);
    if (!p || blockedByLoose(p)) return;
    var btproj = '<?xml version="1.0" encoding="UTF-8"?>\n<root BTCPP_format="4" project_name="' + M.escapeXml(p.name) + '">\n    <include path="' + M.escapeXml(p.name) + '.xml"/>\n    <TreeNodesModel/>\n</root>\n';
    UI.download(p.name + '.btproj', btproj, 'application/xml');
    setTimeout(function () { exportXml(p.id); }, 300);
  }

  function save() {
    var ids = Object.keys(S.dirty).filter(function (id) { return Store.project(id); });
    if (!ids.length) { UI.toast('Nada para salvar.', 'info', 1400); return; }
    if (ids.some(function (id) { return blockedByLoose(Store.project(id)); })) return;
    Store.saveAll().then(function (res) {
      var disk = res.filter(function (r) { return r.where === 'disk'; });
      if (disk.length) UI.toast('Salvo em disco: ' + disk.map(function (r) { return r.path; }).join(', '), 'success');
      else UI.toast('Salvo no navegador. Para ter o arquivo, use Exportar › XML (ou rode o servidor para salvar em disco).', 'success', 5000);
    }).catch(function (e) { UI.toast('Erro ao salvar: ' + e.message, 'error'); });
  }

  function generateCode(projectId) {
    var p = Store.project(projectId || S.activeProjectId);
    if (!p) return;
    if (!S.backend) { UI.toast('A geração de código C precisa do servidor (python3 studio.py).', 'warning'); return; }
    var errors = M.validateProject(p).filter(function (i) { return i.level === 'error'; });
    if (errors.length) {
      UI.modal({ title: 'Corrija os problemas antes de gerar', body: '<p>O projeto tem ' + errors.length + ' erro(s):</p><ul class="issues">' +
        errors.slice(0, 12).map(function (e) { return '<li>' + UI.esc(e.message) + '</li>'; }).join('') + '</ul>',
        buttons: [{ label: 'Ver problemas', kind: 'primary', value: true }] }).then(function (v) { if (v) showBottom('problems'); });
      return;
    }
    var out = el('input', { class: 'input mono', value: p.meta.output || '', placeholder: S.backend.workspace + '/' + p.name + '/generated' });
    var author = el('input', { class: 'input', value: p.meta.author || '' });
    var email = el('input', { class: 'input', value: p.meta.email || '' });
    var version = el('input', { class: 'input', value: p.meta.version || '1.0' });
    var body = el('div', { class: 'form' }, [
      el('p', { class: 'hint', html: 'Executa <code>Scripts/btree_array_creator.py</code> com a árvore principal <b>' + UI.esc(p.trees[p.mainTreeId].name) + '</b> e o projeto <b>' + UI.esc(p.name) + '</b>.' }),
      el('label', { class: 'field' }, [el('span', { text: 'Pasta de saída' }), out]),
      el('div', { class: 'grid2' }, [
        el('label', { class: 'field' }, [el('span', { text: 'Autor' }), author]),
        el('label', { class: 'field' }, [el('span', { text: 'E-mail' }), email])
      ]),
      el('label', { class: 'field' }, [el('span', { text: 'Versão' }), version])
    ]);
    UI.modal({ title: 'Gerar código C — ' + p.name, body: body, width: '560px',
      buttons: [{ label: 'Cancelar', value: null }, { label: 'Gerar', kind: 'primary', icon: 'code', value: true }] }).then(function (go) {
      if (!go) return;
      p.meta.output = out.value.trim(); p.meta.author = author.value.trim(); p.meta.email = email.value.trim(); p.meta.version = version.value.trim();
      Store.persistNow();
      UI.toast('Gerando código…', 'info', 1500);
      Store.api('/api/generate', {
        project: p.name, mainTree: p.trees[p.mainTreeId].name, xml: M.exportXml(p),
        output: p.meta.output, author: p.meta.author, email: p.meta.email, version: p.meta.version
      }).then(function (res) {
        UI.modal({ title: 'Código gerado', width: '620px',
          body: '<p>Arquivos em <code>' + UI.esc(res.output) + '</code>:</p><ul class="files mono">' +
            res.files.map(function (f) { return '<li>' + UI.esc(f) + '</li>'; }).join('') + '</ul>' +
            '<p class="hint">Com <code>BTREE_COMMON_DEBUG == 1</code>, o firmware imprime <code>Tree: ' + UI.esc(M.logNameOf(p)) + '</code> — o Monitor reconhece automaticamente.</p>',
          buttons: [{ label: 'OK', kind: 'primary', value: true }] });
      }).catch(function (e) { UI.toast('Falha ao gerar: ' + e.message, 'error', 10000); });
    });
  }

  function fileMenu(x, y) {
    var p = Store.activeProject();
    UI.contextMenu(x, y, [
      { label: 'Novo projeto…', icon: 'plus', action: newProject },
      { label: 'Nova subárvore…', icon: 'subtree', disabled: !p, action: function () { newTree(); } },
      { label: 'Abrir XML / .btproj…', icon: 'folder', shortcut: UI.kbd('Ctrl+O'), action: function () { document.getElementById('fileOpen').click(); } },
      { label: 'Exemplo', icon: 'sparkles', action: loadExample },
      '-',
      { label: 'Exportar', icon: 'download', disabled: !p, submenu: p ? [
        { label: 'XML do projeto (.xml)', icon: 'download', action: function () { exportXml(); } },
        { label: 'Projeto Groot2 (.btproj + .xml)', icon: 'project', action: function () { exportBtproj(); } },
        { label: 'Copiar XML', icon: 'copy', action: function () { if (!blockedByLoose(p)) UI.copyText(M.exportXml(p), 'XML copiado.'); } }
      ] : null },
      { label: 'Gerar código C…', icon: 'code', disabled: !p || !S.backend || !S.backend.generatorAvailable,
        title: S.backend ? '' : 'Requer o servidor (python3 studio.py)', action: function () { generateCode(); } }
    ]);
  }

  /* ------------------------------------------------------------------ *
   * Sidebar: workspace tree
   * ------------------------------------------------------------------ */
  var collapsedProjects = {};
  function renderWorkspace() {
    var box = document.getElementById('workspaceTree');
    box.innerHTML = '';
    if (!S.projects.length) {
      box.appendChild(el('div', { class: 'ws-empty' }, [
        el('p', { text: 'Nenhum projeto ainda.' }),
        el('button', { class: 'btn sm primary', html: I.icon('plus', 14) + 'Novo projeto', onclick: newProject }),
        el('button', { class: 'btn sm', html: I.icon('folder', 14) + 'Abrir XML', onclick: function () { document.getElementById('fileOpen').click(); } })
      ]));
      return;
    }
    var activeTab = Store.activeTab();
    S.projects.forEach(function (p) {
      var collapsed = !!collapsedProjects[p.id];
      var issues = M.validateProject(p).filter(function (i) { return i.level === 'error'; }).length;
      var row = el('div', { class: 'ws-row ws-project' + (p.id === S.activeProjectId ? ' active' : ''), title: p.name + (S.dirty[p.id] ? ' (alterações não salvas)' : '') }, [
        el('span', { class: 'twisty' + (collapsed ? ' closed' : ''), html: I.icon('chevron', 14) }),
        el('span', { class: 'ws-icon', html: I.icon('project', 15) }),
        el('span', { class: 'ws-name', text: p.name }),
        S.dirty[p.id] ? el('span', { class: 'dirty-dot', title: 'Alterações não salvas' }) : null,
        issues ? el('span', { class: 'ws-badge bad', title: issues + ' erro(s)', text: String(issues) }) : null,
        el('button', { class: 'mini ws-act', title: 'Nova subárvore', html: I.icon('tree-plus', 14), onclick: function (e) { e.stopPropagation(); newTree(p.id); } }),
        el('button', { class: 'mini ws-act', title: 'Mais opções', html: I.icon('more', 14), onclick: function (e) { e.stopPropagation(); var r = e.currentTarget.getBoundingClientRect(); projectMenu(p, r.left, r.bottom + 2); } })
      ]);
      row.addEventListener('click', function (e) {
        if (e.target.closest('.twisty')) { collapsedProjects[p.id] = !collapsed; renderWorkspace(); return; }
        Store.openTab(p.id, p.mainTreeId, '');
      });
      row.addEventListener('contextmenu', function (e) { e.preventDefault(); projectMenu(p, e.clientX, e.clientY); });
      box.appendChild(row);
      if (collapsed) return;
      var order = p.treeOrder.slice().sort(function (a, b) { return (a === p.mainTreeId ? -1 : 0) - (b === p.mainTreeId ? -1 : 0); });
      order.forEach(function (tid) {
        var tree = p.trees[tid];
        var isMain = tid === p.mainTreeId;
        var isOpen = activeTab && activeTab.projectId === p.id && activeTab.treeId === tid;
        var refs = treeRefCount(p, tid);
        var trow = el('div', { class: 'ws-row ws-tree' + (isOpen ? ' active' : ''), title: (isMain ? 'Árvore principal' : 'Subárvore') + (refs ? ' — chamada ' + refs + 'x' : '') + '\nDuplo clique para renomear' }, [
          el('span', { class: 'ws-icon' + (isMain ? ' star' : ''), html: I.icon(isMain ? 'star' : 'subtree', 14) }),
          el('span', { class: 'ws-name', text: tree.name }),
          refs ? el('span', { class: 'ws-badge', text: refs + '×' }) : null,
          el('button', { class: 'mini ws-act', title: 'Mais opções', html: I.icon('more', 14), onclick: function (e) { e.stopPropagation(); var r = e.currentTarget.getBoundingClientRect(); treeMenu(p, tree, r.left, r.bottom + 2); } })
        ]);
        trow.addEventListener('click', function () { Store.openTab(p.id, tid, isMain ? '' : null); });
        trow.addEventListener('dblclick', function () { renameTree(p.id, tid); });
        trow.addEventListener('contextmenu', function (e) { e.preventDefault(); treeMenu(p, tree, e.clientX, e.clientY); });
        box.appendChild(trow);
      });
    });
  }

  function projectMenu(p, x, y) {
    UI.contextMenu(x, y, [
      { label: 'Abrir árvore principal', icon: 'star', action: function () { Store.openTab(p.id, p.mainTreeId, ''); } },
      { label: 'Nova subárvore…', icon: 'tree-plus', action: function () { newTree(p.id); } },
      '-',
      { label: 'Renomear projeto…', icon: 'rename', action: function () { renameProject(p.id); } },
      { label: 'Salvar', icon: 'save', shortcut: UI.kbd('Ctrl+S'), disabled: !S.dirty[p.id], action: function () {
        Store.saveProject(p.id).then(function (r) { UI.toast(r.where === 'disk' ? 'Salvo em ' + r.path : 'Salvo no navegador.', 'success'); }).catch(function (e) { UI.toast(e.message, 'error'); });
      } },
      { label: 'Exportar XML', icon: 'download', action: function () { exportXml(p.id); } },
      { label: 'Gerar código C…', icon: 'code', disabled: !S.backend || !S.backend.generatorAvailable, action: function () { generateCode(p.id); } },
      '-',
      { label: S.backend && p.meta.onDisk ? 'Excluir projeto (apaga do disco)' : 'Excluir projeto', icon: 'trash', danger: true, action: function () { deleteProject(p.id); } }
    ]);
  }

  function treeMenu(p, tree, x, y) {
    var isMain = tree.id === p.mainTreeId;
    UI.contextMenu(x, y, [
      { label: 'Abrir', icon: 'external', action: function () { Store.openTab(p.id, tree.id, isMain ? '' : null); } },
      { label: 'Renomear…', icon: 'rename', action: function () { renameTree(p.id, tree.id); } },
      { label: 'Definir como principal', icon: 'star', disabled: isMain, action: function () { setMainTree(p.id, tree.id); } },
      { label: 'Duplicar', icon: 'duplicate', action: function () { duplicateTree(p.id, tree.id); } },
      '-',
      { label: 'Excluir árvore', icon: 'trash', danger: true, disabled: isMain, title: isMain ? 'Defina outra árvore como principal primeiro' : '', action: function () { deleteTree(p.id, tree.id); } }
    ]);
  }

  /* ------------------------------------------------------------------ *
   * Palette
   * ------------------------------------------------------------------ */
  function renderPalette() {
    var box = document.getElementById('palette');
    var q = document.getElementById('paletteSearch').value.trim().toLowerCase();
    box.innerHTML = '';
    M.PALETTE.forEach(function (g) {
      var types = g.types.filter(function (t) { return !q || T[t].label.toLowerCase().indexOf(q) >= 0 || (T[t].tag || '').toLowerCase().indexOf(q) >= 0 || T[t].desc.toLowerCase().indexOf(q) >= 0; });
      if (!types.length) return;
      box.appendChild(el('div', { class: 'pal-group', text: g.title }));
      types.forEach(function (type) {
        var t = T[type];
        var item = el('div', { class: 'pal-item cat-' + t.cat, title: t.desc + '\n\nArraste para a árvore (ou para o vazio, solto), ou clique para adicionar ao nó selecionado.' }, [
          el('span', { class: 'pal-icon', html: I.icon(t.icon, 15) }),
          el('span', { class: 'pal-label', text: t.label })
        ]);
        item.addEventListener('pointerdown', function (e) { if (e.button === 0) { e.preventDefault(); C.startPaletteDrag(type, e); } });
        box.appendChild(item);
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * Tabs
   * ------------------------------------------------------------------ */
  function renderTabs() {
    var bar = document.getElementById('tabs');
    bar.innerHTML = '';
    var multiProject = S.projects.length > 1;
    S.tabs.forEach(function (tab) {
      var p = Store.project(tab.projectId), tree = p && p.trees[tab.treeId];
      if (!tree) return;
      var isMain = tree.id === p.mainTreeId;
      var t = el('div', { class: 'tab' + (tab.id === S.activeTabId ? ' active' : ''), title: p.name + ' › ' + tree.name + (tab.ctx ? ' (instância)' : '') }, [
        el('span', { class: 'tab-icon' + (isMain ? ' star' : ''), html: I.icon(isMain ? 'star' : 'subtree', 13) }),
        multiProject ? el('span', { class: 'tab-proj', text: p.name + ' ›' }) : null,
        el('span', { class: 'tab-name', text: tree.name }),
        tab.ctx && tab.ctx.length ? el('span', { class: 'tab-inst', title: 'Instância chamada a partir da árvore principal', html: I.icon('target', 11) }) : null,
        el('button', { class: 'tab-close', title: 'Fechar', html: I.icon('x', 12), onclick: function (e) { e.stopPropagation(); Store.closeTab(tab.id); } })
      ]);
      t.addEventListener('mousedown', function (e) { if (e.button === 1) { e.preventDefault(); Store.closeTab(tab.id); } });
      t.addEventListener('click', function () { Store.activateTab(tab.id); });
      t.addEventListener('dblclick', function () { renameTree(p.id, tree.id); });
      t.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        UI.contextMenu(e.clientX, e.clientY, [
          { label: 'Fechar', icon: 'x', action: function () { Store.closeTab(tab.id); } },
          { label: 'Fechar outras', icon: 'x', action: function () { S.tabs.filter(function (x) { return x.id !== tab.id; }).forEach(function (x) { Store.closeTab(x.id); }); } },
          '-',
          { label: 'Renomear árvore…', icon: 'rename', action: function () { renameTree(p.id, tree.id); } },
          { label: 'Definir como principal', icon: 'star', disabled: isMain, action: function () { setMainTree(p.id, tree.id); } }
        ]);
      });
      bar.appendChild(t);
    });
    var add = el('button', { class: 'tab-add', title: 'Nova subárvore', html: I.icon('plus', 14), onclick: function () { newTree(); } });
    bar.appendChild(add);
    var at = bar.querySelector('.tab.active');
    if (at && at.scrollIntoView) at.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  /* ------------------------------------------------------------------ *
   * Problems panel
   * ------------------------------------------------------------------ */
  function renderProblems() {
    var box = document.getElementById('problems');
    var countEl = document.getElementById('problemCount');
    box.innerHTML = '';
    var total = 0, errors = 0;
    S.projects.forEach(function (p) {
      var issues = M.validateProject(p);
      total += issues.length;
      errors += issues.filter(function (i) { return i.level === 'error'; }).length;
      if (!issues.length) return;
      box.appendChild(el('div', { class: 'pb-group', html: I.icon('project', 14) + UI.esc(p.name) + ' <span class="hint">' + issues.length + '</span>' }));
      issues.forEach(function (iss) {
        var tree = iss.treeId ? p.trees[iss.treeId] : null;
        var row = el('div', { class: 'pb-row ' + iss.level }, [
          el('span', { class: 'pb-icon', html: I.icon(iss.level === 'error' ? 'error' : 'alert', 14) }),
          el('span', { class: 'pb-msg', text: iss.message }),
          tree ? el('span', { class: 'pb-where', text: tree.name }) : null
        ]);
        if (tree) row.addEventListener('click', function () {
          var existing = S.tabs.find(function (t) { return t.projectId === p.id && t.treeId === tree.id; });
          if (existing) Store.activateTab(existing.id); else Store.openTab(p.id, tree.id);
          if (iss.nodeId) setTimeout(function () {
            var tab = Store.activeTab();
            if (!C.revealNode(iss.nodeId, tab.ctx)) C.revealNode(iss.nodeId, null);
          }, 60);
        });
        box.appendChild(row);
      });
    });
    if (!total) box.appendChild(el('div', { class: 'pb-ok', html: I.icon('check', 16) + 'Nenhum problema encontrado.' }));
    countEl.textContent = total ? String(total) : '';
    countEl.className = 'count' + (errors ? ' bad' : total ? ' warn' : '');
  }

  /* ------------------------------------------------------------------ *
   * Bottom panel, layout, theme, mode
   * ------------------------------------------------------------------ */
  // Wide screens: hide/show (remembered). Narrow screens: the panel slides over the canvas.
  var narrow = window.matchMedia('(max-width: 820px)');
  function togglePanel(which) {
    if (narrow.matches) {
      var other = which === 'sidebar' ? 'inspector' : 'sidebar';
      document.body.classList.remove('show-' + other);
      document.body.classList.toggle('show-' + which);
      return;
    }
    var key = which === 'sidebar' ? 'hideSidebar' : 'hideInspector';
    Store.setSetting(key, !S.settings[key]);
    setTimeout(function () { C.fit(true); }, 30);
  }

  function showBottom(tab) {
    if (S.settings.bottomCollapsed) Store.setSetting('bottomCollapsed', false);
    document.querySelectorAll('.btab').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === tab); });
    document.querySelectorAll('.bottom-body').forEach(function (b) { b.hidden = b.dataset.pane !== tab; });
  }

  function applySettings() {
    var st = S.settings;
    document.documentElement.dataset.theme = st.theme;
    var tb = document.getElementById('btnTheme');
    tb.innerHTML = I.icon(st.theme === 'dark' ? 'sun' : 'moon', 16);
    document.getElementById('sidebar').style.width = st.sidebarWidth + 'px';
    document.getElementById('inspector').style.width = st.inspectorWidth + 'px';
    document.getElementById('bottom').style.height = st.bottomCollapsed ? '' : st.bottomHeight + 'px';
    document.body.classList.toggle('bottom-collapsed', !!st.bottomCollapsed);
    document.body.classList.toggle('show-index', !!st.showIndex);
    document.body.classList.toggle('hide-sidebar', !!st.hideSidebar);
    document.body.classList.toggle('hide-inspector', !!st.hideInspector);
    document.body.classList.toggle('no-motion', st.motion === false);
    document.getElementById('btnSidebar').classList.toggle('active', !st.hideSidebar);
    document.getElementById('btnInspector').classList.toggle('active', !st.hideInspector);
  }

  var lastMode = null;
  function applyMode() {
    if (lastMode && lastMode !== S.mode) Store.setSetting('bottomCollapsed', S.mode === 'editor');
    lastMode = S.mode;
    document.body.classList.toggle('mode-editor', S.mode === 'editor');
    document.body.classList.toggle('mode-monitor', S.mode === 'monitor');
    document.getElementById('modeEditor').classList.toggle('active', S.mode === 'editor');
    document.getElementById('modeMonitor').classList.toggle('active', S.mode === 'monitor');
  }

  function updateHistoryButtons() {
    document.getElementById('btnUndo').disabled = !Store.canUndo();
    document.getElementById('btnRedo').disabled = !Store.canRedo();
    var dirty = Object.keys(S.dirty).length > 0;
    document.getElementById('btnSave').classList.toggle('has-changes', dirty);
    document.title = (dirty ? '• ' : '') + 'BTree Studio';
  }

  function initResizers() {
    document.querySelectorAll('.vresize').forEach(function (h) {
      var target = document.getElementById(h.dataset.target);
      var key = h.dataset.target === 'sidebar' ? 'sidebarWidth' : 'inspectorWidth';
      UI.makeResizer(h, function (dx, dy, start, base) {
        if (start) return target.getBoundingClientRect().width;
        var w = h.dataset.side === 'left' ? base + dx : base - dx;
        w = Math.max(200, Math.min(520, w));
        target.style.width = w + 'px';
        S.settings[key] = Math.round(w);
      }, function () { Store.emit('settings'); });
    });
    var bottom = document.getElementById('bottom');
    UI.makeResizer(document.getElementById('bottomResizer'), function (dx, dy, start, base) {
      if (start) { if (S.settings.bottomCollapsed) { S.settings.bottomCollapsed = false; applySettings(); } return bottom.getBoundingClientRect().height; }
      var hgt = Math.max(110, Math.min(window.innerHeight - 220, base - dy));
      bottom.style.height = hgt + 'px';
      S.settings.bottomHeight = Math.round(hgt);
    }, function () { Store.emit('settings'); });
  }

  function helpDialog() {
    var k = UI.kbd;
    var rows = [
      ['Salvar', k('Ctrl+S')], ['Abrir XML', k('Ctrl+O')], ['Desfazer / Refazer', k('Ctrl+Z') + ' / ' + k('Ctrl+Y')],
      ['Excluir nó(s) ou linha selecionada (os filhos ficam soltos)', 'Del'], ['Copiar / Recortar / Colar (só os nós selecionados)', k('Ctrl+C') + ' / ' + k('Ctrl+X') + ' / ' + k('Ctrl+V')],
      ['Selecionar vários', k('Ctrl+') + 'clique · Shift+arrastar no vazio · ' + k('Ctrl+A')],
      ['Comandos / buscar nó, função ou árvore', k('Ctrl+K')], ['Adicionar nó rápido (digite "action nome", "sleep 500"…)', 'Espaço / Tab · duplo clique no vazio'],
      ['Monitor: pausar/reproduzir histórico · passo a passo · falha anterior/próxima · ao vivo', 'Espaço · , / . · Shift+, / . · End'],
      ['Monitor: ver a árvore num instante do passado', 'clique na linha do tempo ou numa linha [BTREE] do terminal'],
      ['Duplicar', k('Ctrl+D')], ['Navegar entre nós', '← ↑ ↓ →'], ['Mover nó entre irmãos', k('Alt+←') + ' / ' + k('Alt+→')],
      ['Editar campo do nó / abrir SubTree', 'Enter'], ['Expandir/recolher SubTree', 'E'], ['Ajustar à tela', 'F'], ['Zoom', '+ / − / 0'],
      ['Modo Editor / Monitor', 'F2 / F3'], ['Mostrar/ocultar painel inferior', k('Ctrl+J')],
      ['Mostrar/ocultar painel esquerdo / direito', k('Ctrl+B') + ' / ' + k('Ctrl+I')], ['Copiar ao arrastar', 'Segure ' + k('Ctrl+') + ' ao soltar']
    ];
    UI.modal({
      title: 'Ajuda e atalhos', width: '640px',
      body: '<div class="help">' +
        '<h5>Como começar</h5><ol>' +
        '<li>Crie um projeto (<b>Arquivo › Novo projeto</b>): ele já vem com a árvore principal <b>main</b> e uma Action.</li>' +
        '<li>Arraste nós da paleta à esquerda para a árvore. Selecione um nó para editar suas propriedades à direita.</li>' +
        '<li>Use <b>Salvar</b> (servidor: grava em <code>workspace/</code>) ou <b>Exportar</b> para obter o XML usado pelo <code>btree_array_creator.py</code>.</li>' +
        '<li>No <b>Monitor</b>, conecte a UART/SWD (ou simule) — os nós ficam <span class="st-txt running">amarelos</span> em execução, <span class="st-txt success">verdes</span> em sucesso, <span class="st-txt fail">vermelhos</span> em falha e <span class="st-txt standby">cinza</span> em standby.</li></ol>' +
        '<h5>Editando a árvore</h5><ul>' +
        '<li>Solte um nó da paleta <b>sobre outro</b>: centro = filho, bordas = antes/depois. Um decorador sobre uma folha a <b>envolve</b>.</li>' +
        '<li>Solte no <b>vazio</b> e o nó fica <b>solto</b> (tracejado). Ligue arrastando a <b>bolinha de cima</b> até o pai, ou o <b>+</b> do pai até ele. Com nós soltos não dá para salvar.</li>' +
        '<li>Arrastar um nó ligado para os lados <b>muda a ordem</b> entre os irmãos — a ordem é o comportamento da árvore.</li>' +
        '<li>Para <b>desconectar</b>: arraste a bolinha de cima para o vazio, ou clique direito na <b>linha</b>.</li>' +
        '<li><b>Clique direito</b> em qualquer lugar mostra o que dá para fazer ali. Duplo clique numa SubTree a abre.</li></ul>' +
        '<h5>Formato do log</h5><pre class="mono">[BTREE] | Tree: %s | Node: %d | Status: %s | Type: %s | Function: %s</pre>' +
        '<p class="hint"><b>Tree</b> é o nome do projeto em maiúsculas; <b>Node</b> é o índice do nó no array gerado (ative <b>#</b> no canto inferior para ver os índices).</p>' +
        '<h5>Atalhos</h5><table class="keys">' + rows.map(function (r) { return '<tr><td>' + r[0] + '</td><td><kbd>' + r[1] + '</kbd></td></tr>'; }).join('') + '</table>' +
        '<p class="hint">Servidor: ' + (S.backend ? 'conectado (workspace em <code>' + UI.esc(S.backend.workspace) + '</code>)' : 'não detectado — os projetos ficam salvos no navegador.') + '</p></div>',
      buttons: [{ label: 'Fechar', kind: 'primary', value: true }]
    });
  }

  /* ------------------------------------------------------------------ *
   * Keyboard
   * ------------------------------------------------------------------ */
  function isTyping(e) {
    var t = e.target;
    return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  }

  function onKey(e) {
    var mod = e.ctrlKey || e.metaKey;
    var k = e.key;
    if (UI.hasModal()) {
      if (k === 'Escape') { e.preventDefault(); UI.closeTopModal(); }
      return;
    }
    if (mod && k.toLowerCase() === 'k') { e.preventDefault(); window.BTCommand.open(); return; }
    if (k === 'Escape') { UI.closeMenus(); if (!isTyping(e)) Store.select(null); else e.target.blur(); return; }
    if (mod && k.toLowerCase() === 's') { e.preventDefault(); save(); return; }
    if (mod && k.toLowerCase() === 'o') { e.preventDefault(); document.getElementById('fileOpen').click(); return; }
    if (mod && k.toLowerCase() === 'b') { e.preventDefault(); togglePanel('sidebar'); return; }
    if (mod && k.toLowerCase() === 'i') { e.preventDefault(); togglePanel('inspector'); return; }
    if (mod && k.toLowerCase() === 'j') { e.preventDefault(); Store.setSetting('bottomCollapsed', !S.settings.bottomCollapsed); return; }
    if (k === 'F1') { e.preventDefault(); helpDialog(); return; }
    if (k === 'F2') { e.preventDefault(); Store.setMode('editor'); return; }
    if (k === 'F3') { e.preventDefault(); Store.setMode('monitor'); return; }
    if (isTyping(e)) return;
    var v = C.selectedVNode();
    if (mod && !e.shiftKey && k.toLowerCase() === 'z') { e.preventDefault(); Store.undo(); return; }
    if (mod && (k.toLowerCase() === 'y' || (e.shiftKey && k.toLowerCase() === 'z'))) { e.preventDefault(); Store.redo(); return; }
    if (mod && k.toLowerCase() === 'c') { if (v) { e.preventDefault(); C.copySelection(); } return; }
    if (mod && k.toLowerCase() === 'x') { if (v) { e.preventDefault(); C.copySelection(true); } return; }
    if (mod && k.toLowerCase() === 'a') { e.preventDefault(); C.selectAll(); return; }
    if (mod && k.toLowerCase() === 'v') { e.preventDefault(); C.pasteInto(v || (C.current() && C.current().root)); return; }
    if (mod && k.toLowerCase() === 'd') { if (v) { e.preventDefault(); C.duplicate(); } return; }
    if (mod) return;
    // keys that only make sense while the canvas (not a button of a panel) has the focus
    var onCanvas = !document.activeElement || document.activeElement === document.body || document.activeElement.id === 'canvasWrap';
    if (S.mode === 'monitor') {
      if (k === ' ' && onCanvas) { e.preventDefault(); window.BTTimeline.toggle(); return; }
      if (k === ',' || k === '<') { e.preventDefault(); if (e.shiftKey) window.BTTimeline.jumpFail(-1); else window.BTTimeline.step(-1); return; }
      if (k === '.' || k === '>') { e.preventDefault(); if (e.shiftKey) window.BTTimeline.jumpFail(1); else window.BTTimeline.step(1); return; }
      if (k === 'End') { e.preventDefault(); window.BTTimeline.live(); return; }
    } else if ((k === ' ' || k === 'Tab') && onCanvas && !e.shiftKey && C.current()) {
      e.preventDefault();
      var tv = v && !v.readonly ? v : null;
      var el = tv && tv.el && tv.el.getBoundingClientRect();
      window.BTCommand.quickAdd(el ? { target: tv, x: el.left + el.width / 2, y: el.bottom + 8 } : {});
      return;
    }
    if (k === 'Delete' || k === 'Backspace') { if (v || S.edge) { e.preventDefault(); C.deleteSelection(); } return; }
    if (e.altKey && (k === 'ArrowLeft' || k === 'ArrowRight')) { e.preventDefault(); C.moveSibling(v, k === 'ArrowLeft' ? -1 : 1); return; }
    if (k.indexOf('Arrow') === 0) { e.preventDefault(); C.navigate(k.slice(5).toLowerCase()); return; }
    if (k === 'Enter' && v) { e.preventDefault(); if (v.node.type === 'subtree') C.openSubtree(v); else window.BTInspector.focusField(); return; }
    if ((k === 'e' || k === 'E') && v && v.node.type === 'subtree') { C.toggleExpand(v); return; }
    if (k === 'f' || k === 'F') { C.fit(); return; }
    if (k === '+' || k === '=') { C.zoomAt(1.2); return; }
    if (k === '-' || k === '_') { C.zoomAt(1 / 1.2); return; }
    if (k === '0') { C.resetZoom(); return; }
    if (k === '#') { Store.setSetting('showIndex', !S.settings.showIndex); return; }
  }

  /* ------------------------------------------------------------------ *
   * Boot
   * ------------------------------------------------------------------ */
  function loadExample() {
    var imp = M.importXml(EXAMPLE_XML);
    var name = M.uniqueName('robot', Store.projectNames());
    var p = M.projectFromImport(imp, name);
    Store.addProject(p);
    UI.toast('Projeto de exemplo criado. Experimente o Monitor › Simulação!', 'success', 4500);
  }

  function boot() {
    I.hydrate();
    C.init();
    window.BTInspector.init();
    window.BTCommand.init();
    document.getElementById('btnCmdk').onclick = function () { window.BTCommand.open(); };

    document.getElementById('btnAddProject').onclick = newProject;
    document.getElementById('btnAddTree').onclick = function () { newTree(); };
    document.getElementById('fileOpen').onchange = function (e) { openFiles(e.target.files); e.target.value = ''; };
    document.getElementById('btnSave').onclick = save;
    document.getElementById('btnFile').onclick = function (e) { var r = e.currentTarget.getBoundingClientRect(); fileMenu(r.left, r.bottom + 4); };
    document.getElementById('btnUndo').onclick = function () { Store.undo(); };
    document.getElementById('btnRedo').onclick = function () { Store.redo(); };
    document.getElementById('modeEditor').onclick = function () { Store.setMode('editor'); };
    document.getElementById('modeMonitor').onclick = function () { Store.setMode('monitor'); };
    document.getElementById('btnSidebar').onclick = function () { togglePanel('sidebar'); };
    document.getElementById('btnInspector').onclick = function () { togglePanel('inspector'); };
    document.getElementById('btnTheme').onclick = function () { Store.setSetting('theme', S.settings.theme === 'dark' ? 'light' : 'dark'); };
    document.getElementById('btnHelp').onclick = helpDialog;
    document.getElementById('paletteSearch').addEventListener('input', renderPalette);
    document.getElementById('btnToggleBottom').onclick = function () { Store.setSetting('bottomCollapsed', !S.settings.bottomCollapsed); };
    document.querySelectorAll('.btab').forEach(function (b) { b.addEventListener('click', function () { showBottom(b.dataset.tab); }); });
    document.querySelectorAll('#emptyState [data-action]').forEach(function (b) {
      b.addEventListener('click', function () {
        var a = b.dataset.action;
        if (a === 'new-project') newProject();
        else if (a === 'open') document.getElementById('fileOpen').click();
        else if (a === 'example') loadExample();
      });
    });
    // drag & drop of files onto the window
    window.addEventListener('dragover', function (e) { if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') >= 0) { e.preventDefault(); document.body.classList.add('file-drop'); } });
    window.addEventListener('dragleave', function (e) { if (!e.relatedTarget) document.body.classList.remove('file-drop'); });
    window.addEventListener('drop', function (e) {
      document.body.classList.remove('file-drop');
      if (e.dataTransfer && e.dataTransfer.files.length) { e.preventDefault(); openFiles(e.dataTransfer.files); }
    });
    document.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', function (e) {
      Store.persistNow();
      if (S.backend && Object.keys(S.dirty).length) { e.preventDefault(); e.returnValue = ''; }
    });
    initResizers();

    Store.on('workspace', renderWorkspace);
    Store.on('workspace', renderTabs);
    Store.on('tabs', renderTabs);
    Store.on('validation', renderProblems);
    Store.on('workspace', renderProblems);
    Store.on('history', updateHistoryButtons);
    Store.on('dirty', updateHistoryButtons);
    Store.on('dirty', renderWorkspace);
    Store.on('settings', applySettings);
    Store.on('mode', applyMode);

    renderPalette();
    Store.init().then(function (summary) {
      applySettings();
      applyMode();
      D.init();
      window.BTTimeline.init();
      window.BTHints.init();
      if (!S.tabs.length) {
        var p = Store.activeProject() || S.projects[0];
        if (p) Store.openTab(p.id, p.mainTreeId, '');
      }
      renderProblems();
      if (summary.recovered.length) UI.toast('Alterações não salvas recuperadas: ' + summary.recovered.join(', '), 'warning', 6000);
      if (summary.error) UI.toast('Erro ao carregar do workspace: ' + summary.error, 'error', 9000);
      if (!S.backend && location.protocol !== 'file:') {
        // served by something else (e.g. a static server): fine, browser storage is used
      }
      document.body.classList.add('ready');
    });
  }

  window.BTApp = {
    newProject: newProject, newTree: newTree, renameTree: renameTree, setMainTree: setMainTree, deleteTree: deleteTree,
    renameProject: renameProject, deleteProject: deleteProject, closeProject: closeProject, exportXml: exportXml,
    generateCode: generateCode, showBottom: showBottom, save: save, openFiles: openFiles, loadExample: loadExample, help: helpDialog
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
