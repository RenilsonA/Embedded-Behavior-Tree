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
    '    <ReactiveFallback name="Robot">',
    '      <Sequence name="Low battery">',
    '        <ScriptCondition code="is_battery_low"/>',
    '        <SubTree ID="go_charge"/>',
    '      </Sequence>',
    '      <Sequence name="Patrol">',
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
    if (!v) return 'Required.';
    if (!M.C_IDENT_RE.test(v)) return 'Use letters, digits and _ (not starting with a digit, no spaces).';
    return null;
  }

  /* ------------------------------------------------------------------ *
   * Projects & trees
   * ------------------------------------------------------------------ */
  function newProject() {
    return UI.prompt('New project', 'Project name', M.uniqueName('project', Store.projectNames()), function (v) {
      return identError(v) || (Store.projectNames().indexOf(v) >= 0 ? 'A project with this name already exists.' : null);
    }, 'The project name is used in the generated C files and appears in upper case in the "Tree:" field of the log.').then(function (name) {
      if (!name) return null;
      var p = M.makeProject(name);
      Store.addProject(p);
      UI.toast('Project "' + name + '" created with the main tree "main".', 'success');
      return p;
    });
  }

  function newTree(projectId, open) {
    var p = Store.project(projectId || S.activeProjectId);
    if (!p) { UI.toast('Create or open a project first.', 'warning'); return Promise.resolve(null); }
    return UI.prompt('New subtree in ' + p.name, 'Tree name', M.uniqueName('subtree', M.treeNames(p)), function (v) {
      return identError(v) || (M.findTreeByName(p, v) ? 'A tree with this name already exists in this project.' : null);
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
    UI.prompt('Rename tree', 'New name', tree.name, function (v) {
      return identError(v) || (v !== tree.name && M.findTreeByName(p, v) ? 'A tree with this name already exists.' : null);
    }, 'SubTrees that call this tree are updated automatically.').then(function (name) {
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
    UI.toast('"' + p.trees[treeId].name + '" is now the main tree' + (old ? '. "' + old.name + '" can be deleted.' : '.'), 'success');
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
      UI.toast('"' + tree.name + '" is the main tree. Set another tree as main before deleting it.', 'warning', 5000);
      return;
    }
    var refs = treeRefCount(p, treeId);
    UI.confirm('Delete tree', 'Delete the tree <b>' + UI.esc(tree.name) + '</b>?' +
      (refs ? '<br><br>' + I.icon('alert', 14) + ' It is called by <b>' + refs + '</b> SubTree node(s), which will be left without a target.' : '') +
      '<br><br>You can undo with ' + UI.kbd('Ctrl+Z') + '.', 'Delete', true).then(function (ok) {
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
    UI.prompt('Rename project', 'New name', p.name, function (v) {
      return identError(v) || (v !== p.name && Store.projectNames().indexOf(v) >= 0 ? 'A project with this name already exists.' : null);
    }, 'Remember: the name appears in upper case in the "Tree:" field of the firmware log.').then(function (name) {
      if (!name || name === p.name) return;
      Store.mutate(p.id, function () { p.name = name; });
    });
  }

  function deleteProject(projectId) {
    var p = Store.project(projectId);
    if (!p) return;
    var onDisk = p.meta && p.meta.onDisk && S.backend;
    UI.confirm('Delete project', 'Delete the project <b>' + UI.esc(p.name) + '</b> and all its trees?' +
      (onDisk ? '<br><br>' + I.icon('alert', 14) + ' The project folder in the workspace will also be deleted from disk.' : '') +
      '<br><br>This cannot be undone.', 'Delete project', true).then(function (ok) {
      if (!ok) return;
      Store.removeProject(p.id).then(function () { UI.toast('Project deleted.', 'success'); }).catch(function (e) { UI.toast(e.message, 'error'); });
    });
  }

  function closeProject(projectId) {
    // only for projects that are not on a server workspace
    var p = Store.project(projectId);
    if (!p) return;
    var go = S.dirty[p.id] ? UI.confirm('Close project', 'The project <b>' + UI.esc(p.name) + '</b> has unexported changes. Close anyway?', 'Close', true) : Promise.resolve(true);
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
          if (missing.length) UI.toast('Also select: ' + missing.join(', ') + ' (included by ' + f.name + ').', 'warning', 7000);
          if (imp.trees.length) projects.push(imp);
        } catch (e) { UI.toast(f.name + ': ' + e.message, 'error', 8000); }
      });
      list.filter(function (f) { return !/\.btproj$/i.test(f.name) && !used[f.name]; }).forEach(function (f) {
        try {
          var imp = M.importXml(f.text, f.name.replace(/\.xml$/i, '').replace(/[^A-Za-z0-9_]/g, '_'));
          if (!imp.trees.length) { UI.toast(f.name + ': no <BehaviorTree> found.', 'warning'); return; }
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
      title: 'Project already exists',
      body: '<p>A project named <b>' + UI.esc(name) + '</b> already exists in the workspace.</p>',
      buttons: [{ label: 'Cancel', value: null }, { label: 'Import as copy', value: 'copy' }, { label: 'Replace', kind: 'danger', value: 'replace' }]
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
      UI.toast('Imported "' + p.name + '": ' + p.treeOrder.length + ' tree(s)' + (issues.length ? ', ' + issues.length + ' problem(s), see the Problems tab.' : '.'), issues.length ? 'warning' : 'success', 5000);
    });
  }

  // Loose nodes are fine while editing, but never reach a file.
  function blockedByLoose(p) {
    var loose = M.looseNodes(p);
    if (!loose.length) return false;
    UI.modal({ title: 'There are loose nodes in ' + p.name,
      body: '<p>Link these nodes to a parent (drag the top dot to the parent) or delete them before saving/exporting:</p><ul class="issues">' +
        loose.slice(0, 12).map(function (l) {
          var t = M.TYPES[l.node.type], f = t.field ? l.node.props[t.field.key] : l.node.props.label;
          return '<li>' + UI.esc(l.tree.name + ': ' + t.label + (f ? ' "' + f + '"' : '')) + '</li>';
        }).join('') + '</ul>',
      buttons: [{ label: 'Close', value: null }, { label: 'Show problems', kind: 'primary', value: true }] }).then(function (v) { if (v) showBottom('problems'); });
    return true;
  }

  function exportXml(projectId) {
    var p = Store.project(projectId || S.activeProjectId);
    if (!p) { UI.toast('No active project.', 'warning'); return; }
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
    if (!ids.length) { UI.toast('Nothing to save.', 'info', 1400); return; }
    if (ids.some(function (id) { return blockedByLoose(Store.project(id)); })) return;
    Store.saveAll().then(function (res) {
      var disk = res.filter(function (r) { return r.where === 'disk'; });
      if (disk.length) UI.toast('Saved to disk: ' + disk.map(function (r) { return r.path; }).join(', '), 'success');
      else UI.toast('Saved in the browser. To get the file, use Export › XML (or run the server to save to disk).', 'success', 5000);
    }).catch(function (e) { UI.toast('Error saving: ' + e.message, 'error'); });
  }

  function generateCode(projectId) {
    var p = Store.project(projectId || S.activeProjectId);
    if (!p) return;
    if (!S.backend) { UI.toast('C code generation needs the server (python3 studio.py).', 'warning'); return; }
    var errors = M.validateProject(p).filter(function (i) { return i.level === 'error'; });
    if (errors.length) {
      UI.modal({ title: 'Fix the problems before generating', body: '<p>The project has ' + errors.length + ' error(s):</p><ul class="issues">' +
        errors.slice(0, 12).map(function (e) { return '<li>' + UI.esc(e.message) + '</li>'; }).join('') + '</ul>',
        buttons: [{ label: 'Show problems', kind: 'primary', value: true }] }).then(function (v) { if (v) showBottom('problems'); });
      return;
    }
    var IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
    var input = function (id, value, cls, ph) { return el('input', { class: 'input ' + (cls || ''), id: id, value: value || '', placeholder: ph || '' }); };
    var f = {
      author: input('genAuthor', p.meta.author), email: input('genEmail', p.meta.email),
      version: input('genVersion', p.meta.version || '1.0'), copyright: input('genCopyright', p.meta.copyright, '', 'e.g. My Company Ltd.'),
      cproject: input('genProject', p.meta.cproject || p.name, 'mono'), prefix: input('genPrefix', p.meta.prefix, 'mono', 'optional'),
      output: input('genOutput', p.meta.output || (S.backend.workspace + '/' + p.name + '/generated'), 'mono')
    };
    var err = el('div', { class: 'field-error', id: 'genError' });
    var preview = el('div', { class: 'gen-tree mono', id: 'genPreview' });
    var browser = el('div', { class: 'gen-browser', id: 'genBrowser', hidden: true });
    var field = function (label, node, hint) { return el('label', { class: 'field' }, [el('span', { text: label }), node].concat(hint ? [el('small', { class: 'hint', html: hint })] : [])); };

    function values() {
      return { author: f.author.value.trim(), email: f.email.value.trim(), version: f.version.value.trim(), copyright: f.copyright.value.trim(),
        cproject: f.cproject.value.trim(), prefix: f.prefix.value.trim(), output: f.output.value.trim() };
    }
    function check(v) {
      if (!IDENT.test(v.cproject)) return 'Project: use letters, digits and _ (not starting with a digit).';
      if (v.prefix && !IDENT.test(v.prefix)) return 'Prefix: use letters, digits and _ (not starting with a digit).';
      if (!v.output) return 'Choose the output folder.';
      return '';
    }
    function request(v, dry) {
      return { project: v.cproject, mainTree: p.trees[p.mainTreeId].name, xml: M.exportXml(p), output: v.output,
        author: v.author, email: v.email, version: v.version, copyright: v.copyright, prefix: v.prefix, dryRun: !!dry };
    }

    // File tree of what will be written: tools/ src/ include/ › btree_<projeto>/ › files
    function renderTree(res) {
      var root = {};
      res.files.forEach(function (fl) {
        var parts = fl.path.split('/'), node = root;
        parts.forEach(function (part, i) { if (i === parts.length - 1) node[part] = fl; else node = node[part] = node[part] || {}; });
      });
      var order = { tools: 0, include: 1, src: 2 };
      var note = { tools: 'generated: array, common and the XML (always replaced)', include: 'your code: declarations', src: 'your code: implement the functions here' };
      function walk(node, depth, top) {
        return Object.keys(node).sort(function (a, b) { return (order[a] === undefined ? 9 : order[a]) - (order[b] === undefined ? 9 : order[b]) || a.localeCompare(b); }).map(function (k) {
          var v = node[k];
          var pad = { style: 'padding-left:' + (depth * 16) + 'px' };
          if (v && v.path) {
            var editable = !/^tools\//.test(v.path);
            var tag = !v.exists ? '<span class="gen-tag new">new</span>' : editable ? '<span class="gen-tag keep">exists: merged, your code is kept</span>' : '<span class="gen-tag over">exists: replaced</span>';
            return el('div', Object.assign({ class: 'gen-file', html: I.icon('code', 13) + UI.esc(k) + tag }, pad));
          }
          return el('div', { class: 'gen-dir' }, [el('div', Object.assign({ class: 'gen-dname', html: I.icon('folder-open', 13) + UI.esc(k) + '/' + (depth === 1 && note[k] ? '<span class="hint">' + note[k] + '</span>' : '') }, pad))]
            .concat(walk(v, depth + 1)));
        });
      }
      preview.innerHTML = '';
      preview.appendChild(el('div', { class: 'gen-dname gen-root', html: I.icon('folder', 13) + UI.esc(res.output) + '/' }));
      walk(root, 1).forEach(function (n) { preview.appendChild(n); });
    }
    var pending = 0;
    function refresh() {
      var v = values(), msg = check(v);
      err.textContent = msg;
      if (msg) { preview.innerHTML = ''; return; }
      var my = ++pending;
      preview.classList.add('loading');
      Store.api('/api/generate', request(v, true)).then(function (res) {
        if (my !== pending) return;
        preview.classList.remove('loading');
        renderTree(res);
      }).catch(function (e) { if (my === pending) { preview.classList.remove('loading'); err.textContent = e.message; } });
    }
    var timer = null;
    Object.keys(f).forEach(function (k) { f[k].addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(refresh, 300); }); });

    // Folder picker (folders seen by the local server)
    function browse(path) {
      Store.api('/api/fs/dirs?path=' + encodeURIComponent(path || '')).then(function (res) {
        browser.innerHTML = '';
        var bar = el('div', { class: 'gen-bbar' }, [
          el('button', { class: 'btn small', type: 'button', html: I.icon('arrow-left', 14) + 'Up', disabled: !res.parent, onclick: function () { browse(res.parent); } }),
          el('button', { class: 'btn small', type: 'button', text: 'Workspace', onclick: function () { browse(res.workspace); } }),
          el('button', { class: 'btn small', type: 'button', text: 'Home', onclick: function () { browse(res.home); } }),
          el('button', { class: 'btn small', type: 'button', html: I.icon('plus', 14) + 'New folder', onclick: function () {
            UI.prompt('New folder', 'Folder name inside ' + res.path, '').then(function (name) {
              if (!name) return;
              Store.api('/api/fs/mkdir', { path: res.path + '/' + name }).then(function (r) { browse(r.path); }).catch(function (e) { UI.toast(e.message, 'error'); });
            });
          } }),
          el('button', { class: 'btn small primary', type: 'button', html: I.icon('check', 14) + 'Use this folder', onclick: function () {
            f.output.value = res.path; browser.hidden = true; refresh();
          } })
        ]);
        browser.appendChild(bar);
        browser.appendChild(el('div', { class: 'gen-bpath mono', text: res.path }));
        var list = el('div', { class: 'gen-blist' });
        if (!res.dirs.length) list.appendChild(el('div', { class: 'hint', text: '(no subfolders)' }));
        res.dirs.forEach(function (d) {
          list.appendChild(el('button', { class: 'gen-bitem', type: 'button', html: I.icon('folder', 14) + UI.esc(d), onclick: function () { browse(res.path + '/' + d); } }));
        });
        browser.appendChild(list);
        browser.hidden = false;
      }).catch(function (e) { UI.toast(e.message, 'error'); });
    }
    var pick = el('button', { class: 'btn', type: 'button', id: 'genBrowse', html: I.icon('folder-open', 16) + 'Browse…', onclick: function () { browser.hidden ? browse(f.output.value) : (browser.hidden = true); } });

    var body = el('div', { class: 'form gen-form' }, [
      el('p', { class: 'hint', html: 'Generates the C code with <code>Scripts/</code> from the main tree <b>' + UI.esc(p.trees[p.mainTreeId].name) + '</b> (★).' }),
      el('div', { class: 'gen-section', text: 'File header' }),
      el('div', { class: 'grid2' }, [field('Author', f.author), field('E-mail', f.email)]),
      el('div', { class: 'grid2' }, [field('Version', f.version), field('Copyright', f.copyright)]),
      el('div', { class: 'gen-section', text: 'Code' }),
      el('div', { class: 'grid2' }, [
        field('Project', f.cproject, 'Name in <code>btree_&lt;project&gt;_…</code>'),
        field('Prefix', f.prefix, 'Becomes <code>&lt;prefix&gt;_btree_…</code>')
      ]),
      el('div', { class: 'gen-section', text: 'Destination' }),
      el('div', { class: 'field' }, [el('span', { text: 'Output folder' }), el('div', { class: 'gen-out' }, [f.output, pick])]),
      browser,
      err,
      preview
    ]);
    UI.modal({ title: 'Generate C code: ' + p.name, body: body, width: '720px',
      buttons: [{ label: 'Cancel', value: null }, { label: 'Generate', kind: 'primary', icon: 'code', value: true, action: function () {
        var msg = check(values()); err.textContent = msg; return msg ? false : true;
      } }] }).then(function (go) {
      if (!go) return;
      var v = values();
      p.meta.output = v.output; p.meta.author = v.author; p.meta.email = v.email; p.meta.version = v.version;
      p.meta.copyright = v.copyright; p.meta.prefix = v.prefix; p.meta.cproject = v.cproject;
      // The firmware logs "Tree: <PROJECT>": keep the Monitor matching it.
      if (v.cproject.toUpperCase() !== M.logNameOf(p)) p.logName = v.cproject.toUpperCase();
      Store.persistNow();
      UI.toast('Generating code…', 'info', 1500);
      Store.api('/api/generate', request(v, false)).then(function (res) {
        UI.modal({ title: 'Code generated', width: '640px',
          body: '<p>' + res.files.length + ' files in <code>' + UI.esc(res.output) + '</code>:</p><ul class="files mono">' +
            res.files.map(function (x) { return '<li>' + UI.esc(x) + '</li>'; }).join('') + '</ul>' +
            '<p class="hint">Add <code>btree-lib</code>, <code>tools/</code>, <code>include/</code> and <code>src/</code> to the build and implement ' +
            '<code>btree_common_delay_ms()</code>. With <code>BTREE_COMMON_DEBUG</code> non-zero, the firmware prints <code>Tree: ' + UI.esc(M.logNameOf(p)) + '</code>, which the Monitor recognizes.</p>',
          buttons: [{ label: 'OK', kind: 'primary', value: true }] });
      }).catch(function (e) { UI.toast('Generation failed: ' + e.message, 'error', 10000); });
    });
    refresh();
  }

  function fileMenu(x, y) {
    var p = Store.activeProject();
    UI.contextMenu(x, y, [
      { label: 'New project…', icon: 'plus', action: newProject },
      { label: 'New subtree…', icon: 'subtree', disabled: !p, action: function () { newTree(); } },
      { label: 'Open XML / .btproj…', icon: 'folder', shortcut: UI.kbd('Ctrl+O'), action: function () { document.getElementById('fileOpen').click(); } },
      { label: 'Example', icon: 'sparkles', action: loadExample },
      '-',
      { label: 'Export', icon: 'download', disabled: !p, submenu: p ? [
        { label: 'Project XML (.xml)', icon: 'download', action: function () { exportXml(); } },
        { label: 'Groot2 project (.btproj + .xml)', icon: 'project', action: function () { exportBtproj(); } },
        { label: 'Copy XML', icon: 'copy', action: function () { if (!blockedByLoose(p)) UI.copyText(M.exportXml(p), 'XML copied.'); } }
      ] : null },
      { label: 'Generate C code…', icon: 'code', disabled: !p || !S.backend || !S.backend.generatorAvailable,
        title: S.backend ? '' : 'Requires the server (python3 studio.py)', action: function () { generateCode(); } }
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
        el('p', { text: 'No projects yet.' }),
        el('button', { class: 'btn sm primary', html: I.icon('plus', 14) + 'New project', onclick: newProject }),
        el('button', { class: 'btn sm', html: I.icon('folder', 14) + 'Open XML', onclick: function () { document.getElementById('fileOpen').click(); } })
      ]));
      return;
    }
    var activeTab = Store.activeTab();
    S.projects.forEach(function (p) {
      var collapsed = !!collapsedProjects[p.id];
      var issues = M.validateProject(p).filter(function (i) { return i.level === 'error'; }).length;
      var row = el('div', { class: 'ws-row ws-project' + (p.id === S.activeProjectId ? ' active' : ''), title: p.name + (S.dirty[p.id] ? ' (unsaved changes)' : '') }, [
        el('span', { class: 'twisty' + (collapsed ? ' closed' : ''), html: I.icon('chevron', 14) }),
        el('span', { class: 'ws-icon', html: I.icon('project', 15) }),
        el('span', { class: 'ws-name', text: p.name }),
        S.dirty[p.id] ? el('span', { class: 'dirty-dot', title: 'Unsaved changes' }) : null,
        issues ? el('span', { class: 'ws-badge bad', title: issues + ' error(s)', text: String(issues) }) : null,
        el('button', { class: 'mini ws-act', title: 'New subtree', html: I.icon('tree-plus', 14), onclick: function (e) { e.stopPropagation(); newTree(p.id); } }),
        el('button', { class: 'mini ws-act', title: 'More options', html: I.icon('more', 14), onclick: function (e) { e.stopPropagation(); var r = e.currentTarget.getBoundingClientRect(); projectMenu(p, r.left, r.bottom + 2); } })
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
        var trow = el('div', { class: 'ws-row ws-tree' + (isOpen ? ' active' : ''), title: (isMain ? 'Main tree' : 'Subtree') + (refs ? ', called ' + refs + 'x' : '') + '\nDouble-click to rename' }, [
          el('span', { class: 'ws-icon' + (isMain ? ' star' : ''), html: I.icon(isMain ? 'star' : 'subtree', 14) }),
          el('span', { class: 'ws-name', text: tree.name }),
          refs ? el('span', { class: 'ws-badge', text: refs + '×' }) : null,
          el('button', { class: 'mini ws-act', title: 'More options', html: I.icon('more', 14), onclick: function (e) { e.stopPropagation(); var r = e.currentTarget.getBoundingClientRect(); treeMenu(p, tree, r.left, r.bottom + 2); } })
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
      { label: 'Open main tree', icon: 'star', action: function () { Store.openTab(p.id, p.mainTreeId, ''); } },
      { label: 'New subtree…', icon: 'tree-plus', action: function () { newTree(p.id); } },
      '-',
      { label: 'Rename project…', icon: 'rename', action: function () { renameProject(p.id); } },
      { label: 'Save', icon: 'save', shortcut: UI.kbd('Ctrl+S'), disabled: !S.dirty[p.id], action: function () {
        Store.saveProject(p.id).then(function (r) { UI.toast(r.where === 'disk' ? 'Saved to ' + r.path : 'Saved in the browser.', 'success'); }).catch(function (e) { UI.toast(e.message, 'error'); });
      } },
      { label: 'Export XML', icon: 'download', action: function () { exportXml(p.id); } },
      { label: 'Generate C code…', icon: 'code', disabled: !S.backend || !S.backend.generatorAvailable, action: function () { generateCode(p.id); } },
      '-',
      { label: S.backend && p.meta.onDisk ? 'Delete project (removes from disk)' : 'Delete project', icon: 'trash', danger: true, action: function () { deleteProject(p.id); } }
    ]);
  }

  function treeMenu(p, tree, x, y) {
    var isMain = tree.id === p.mainTreeId;
    UI.contextMenu(x, y, [
      { label: 'Open', icon: 'external', action: function () { Store.openTab(p.id, tree.id, isMain ? '' : null); } },
      { label: 'Rename…', icon: 'rename', action: function () { renameTree(p.id, tree.id); } },
      { label: 'Set as main', icon: 'star', disabled: isMain, action: function () { setMainTree(p.id, tree.id); } },
      { label: 'Duplicate', icon: 'duplicate', action: function () { duplicateTree(p.id, tree.id); } },
      '-',
      { label: 'Delete tree', icon: 'trash', danger: true, disabled: isMain, title: isMain ? 'Set another tree as main first' : '', action: function () { deleteTree(p.id, tree.id); } }
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
        var item = el('div', { class: 'pal-item cat-' + t.cat, title: t.desc + '\n\nDrag onto the tree (or onto empty space, loose), or click to add it to the selected node.' }, [
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
      var t = el('div', { class: 'tab' + (tab.id === S.activeTabId ? ' active' : ''), title: p.name + ' › ' + tree.name + (tab.ctx ? ' (instance)' : '') }, [
        el('span', { class: 'tab-icon' + (isMain ? ' star' : ''), html: I.icon(isMain ? 'star' : 'subtree', 13) }),
        multiProject ? el('span', { class: 'tab-proj', text: p.name + ' ›' }) : null,
        el('span', { class: 'tab-name', text: tree.name }),
        tab.ctx && tab.ctx.length ? el('span', { class: 'tab-inst', title: 'Instance called from the main tree', html: I.icon('target', 11) }) : null,
        el('button', { class: 'tab-close', title: 'Close', html: I.icon('x', 12), onclick: function (e) { e.stopPropagation(); Store.closeTab(tab.id); } })
      ]);
      t.addEventListener('mousedown', function (e) { if (e.button === 1) { e.preventDefault(); Store.closeTab(tab.id); } });
      t.addEventListener('click', function () { Store.activateTab(tab.id); });
      t.addEventListener('dblclick', function () { renameTree(p.id, tree.id); });
      t.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        UI.contextMenu(e.clientX, e.clientY, [
          { label: 'Close', icon: 'x', action: function () { Store.closeTab(tab.id); } },
          { label: 'Close others', icon: 'x', action: function () { S.tabs.filter(function (x) { return x.id !== tab.id; }).forEach(function (x) { Store.closeTab(x.id); }); } },
          '-',
          { label: 'Rename tree…', icon: 'rename', action: function () { renameTree(p.id, tree.id); } },
          { label: 'Set as main', icon: 'star', disabled: isMain, action: function () { setMainTree(p.id, tree.id); } }
        ]);
      });
      bar.appendChild(t);
    });
    var add = el('button', { class: 'tab-add', title: 'New subtree', html: I.icon('plus', 14), onclick: function () { newTree(); } });
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
    if (!total) box.appendChild(el('div', { class: 'pb-ok', html: I.icon('check', 16) + 'No problems found.' }));
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
      ['Save', k('Ctrl+S')], ['Open XML', k('Ctrl+O')], ['Undo / Redo', k('Ctrl+Z') + ' / ' + k('Ctrl+Y')],
      ['Delete selected node(s) or edge (children become loose)', 'Del'], ['Copy / Cut / Paste (selected nodes only)', k('Ctrl+C') + ' / ' + k('Ctrl+X') + ' / ' + k('Ctrl+V')],
      ['Select several', k('Ctrl+') + 'click · Shift+drag on empty space · ' + k('Ctrl+A')],
      ['Commands / find node, function or tree', k('Ctrl+K')], ['Quick add node (type "action name", "sleep 500"…)', 'Space / Tab · double-click on empty space'],
      ['Monitor: pause/play history · step · previous/next failure · live', 'Space · , / . · Shift+, / . · End'],
      ['Monitor: see the tree at a past instant', 'click the timeline or a [BTREE] line in the terminal'],
      ['Duplicate', k('Ctrl+D')], ['Move between nodes', '← ↑ ↓ →'], ['Move node among siblings', k('Alt+←') + ' / ' + k('Alt+→')],
      ['Edit node field / open SubTree', 'Enter'], ['Expand/collapse SubTree', 'E'], ['Fit to screen', 'F'], ['Zoom', '+ / − / 0'],
      ['Editor / Monitor mode', 'F2 / F3'], ['Show/hide bottom panel', k('Ctrl+J')],
      ['Show/hide left / right panel', k('Ctrl+B') + ' / ' + k('Ctrl+I')], ['Copy while dragging', 'Hold ' + k('Ctrl+') + ' when dropping']
    ];
    UI.modal({
      title: 'Help and shortcuts', width: '640px',
      body: '<div class="help">' +
        '<h5>Getting started</h5><ol>' +
        '<li>Create a project (<b>File › New project</b>): it comes with the main tree <b>main</b> and one Action.</li>' +
        '<li>Drag nodes from the palette on the left onto the tree. Select a node to edit its properties on the right.</li>' +
        '<li>Use <b>Save</b> (server: writes to <code>workspace/</code>) or <b>Export</b> to get the XML used by <code>btree_array_creator.py</code>.</li>' +
        '<li>In the <b>Monitor</b>, connect the UART/SWD (or simulate): nodes turn <span class="st-txt running">yellow</span> while running, <span class="st-txt success">green</span> on success, <span class="st-txt fail">red</span> on fail and <span class="st-txt standby">gray</span> on standby.</li></ol>' +
        '<h5>Editing the tree</h5><ul>' +
        '<li>Drop a palette node <b>onto another</b>: center = child, edges = before/after. A decorator dropped on a leaf <b>wraps</b> it.</li>' +
        '<li>Drop on <b>empty space</b> and the node is <b>loose</b> (dashed). Link it by dragging its <b>top dot</b> to the parent, or the parent’s <b>+</b> to it. Projects with loose nodes cannot be saved.</li>' +
        '<li>Dragging a linked node sideways <b>changes its order</b> among siblings: the order is the tree’s behavior.</li>' +
        '<li>To <b>disconnect</b>: drag the top dot to empty space, or right-click the <b>edge</b>.</li>' +
        '<li><b>Right-click</b> anywhere shows what can be done there. Double-click a SubTree to open it.</li></ul>' +
        '<h5>Log format</h5><pre class="mono">[BTREE] | Tree: %s | Node: %d | Status: %s | Type: %s | Function: %s</pre>' +
        '<p class="hint"><b>Tree</b> is the project name in upper case; <b>Node</b> is the node index in the generated array (turn on <b>#</b> in the bottom corner to see the indices).</p>' +
        '<h5>Shortcuts</h5><table class="keys">' + rows.map(function (r) { return '<tr><td>' + r[0] + '</td><td><kbd>' + r[1] + '</kbd></td></tr>'; }).join('') + '</table>' +
        '<p class="hint">Server: ' + (S.backend ? 'connected (workspace at <code>' + UI.esc(S.backend.workspace) + '</code>)' : 'not detected, projects are stored in the browser.') + '</p></div>',
      buttons: [{ label: 'Close', kind: 'primary', value: true }]
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
    UI.toast('Example project created. Try Monitor › Simulation!', 'success', 4500);
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
      if (summary.recovered.length) UI.toast('Unsaved changes recovered: ' + summary.recovered.join(', '), 'warning', 6000);
      if (summary.error) UI.toast('Error loading the workspace: ' + summary.error, 'error', 9000);
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
