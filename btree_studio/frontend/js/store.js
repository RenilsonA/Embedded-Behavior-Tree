/* BTree Studio - application state, undo/redo and persistence. */
(function () {
  'use strict';
  var M = window.BTModel;
  var LS_KEY = 'btstudio.workspace.v3';

  var S = {
    projects: [],
    activeProjectId: null,
    tabs: [],            // { id, projectId, treeId, ctx }  ctx: null | '' | '/subNodeId/...'
    activeTabId: null,
    selection: null,     // { tabId, nodeId, ctx, treeId }  primary (last clicked) node
    multi: [],           // more selected nodes in the same tab: [{ nodeId, ctx }]
    edge: null,          // selected edge: vnode key of its child
    mode: 'editor',
    expanded: {},        // key: ctx + '>' + subtreeNodeId -> true (SubTree expanded inline)
    dirty: {},           // projectId -> true (unsaved to disk)
    settings: { theme: 'dark', showIndex: false, follow: true, bottomHeight: 240, bottomCollapsed: true, sidebarWidth: 270, inspectorWidth: 300, motion: true, hints: true, minimap: true },
    backend: null,       // /api/info payload when the local server is available
    clipboard: null
  };

  /* ------------------------------ events ------------------------------ */
  var listeners = {};
  function on(topic, fn) { (listeners[topic] = listeners[topic] || []).push(fn); }
  var pending = {};
  var scheduled = false;
  // Topics: workspace, tabs, structure, selection, mode, validation, history, settings, dirty
  function emit(topic) {
    pending[topic] = true;
    if (scheduled) return;
    scheduled = true;
    Promise.resolve().then(flush);
  }
  function flush() {
    scheduled = false;
    var topics = pending;
    pending = {};
    Object.keys(topics).forEach(function (t) { (listeners[t] || []).forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } }); });
    persistSoon();
  }
  function emitAll() { ['workspace', 'tabs', 'structure', 'selection', 'mode', 'validation', 'history', 'dirty'].forEach(emit); }

  /* ------------------------------ getters ----------------------------- */
  function project(id) { return S.projects.find(function (p) { return p.id === id; }) || null; }
  function activeProject() { return project(S.activeProjectId); }
  function activeTab() { return S.tabs.find(function (t) { return t.id === S.activeTabId; }) || null; }
  function tabTree(tab) {
    tab = tab || activeTab();
    if (!tab) return null;
    var p = project(tab.projectId);
    return p ? p.trees[tab.treeId] || null : null;
  }
  function tabProject(tab) { tab = tab || activeTab(); return tab ? project(tab.projectId) : null; }

  /* ------------------------------ history ----------------------------- */
  var undoStack = [], redoStack = [];
  var lastMerge = { key: null, t: 0 };

  function snapshot(p) { return JSON.stringify(p); }

  function restoreProject(json) {
    var data = JSON.parse(json);
    var idx = S.projects.findIndex(function (p) { return p.id === data.id; });
    if (idx >= 0) S.projects[idx] = data; else S.projects.push(data);
    // drop tabs/selection that point to things that no longer exist
    S.tabs = S.tabs.filter(function (t) { var p = project(t.projectId); return p && p.trees[t.treeId]; });
    if (!activeTab()) S.activeTabId = S.tabs.length ? S.tabs[S.tabs.length - 1].id : null;
    if (S.selection) {
      var tr = project(data.id) && project(data.id).trees[S.selection.treeId];
      if (tr && !tr.nodes[S.selection.nodeId]) S.selection = null;
    }
    S.dirty[data.id] = true;
    return data;
  }

  /**
   * Apply a change to a project, recording undo history.
   * fn(project) may return false to cancel the change.
   * mergeKey: consecutive changes with the same key within 1.2s become one undo step (typing).
   */
  function mutate(projectId, fn, mergeKey) {
    var p = project(projectId);
    if (!p) return false;
    var before = snapshot(p);
    var res = fn(p);
    if (res === false) return false;
    var now = Date.now();
    if (!(mergeKey && lastMerge.key === mergeKey && now - lastMerge.t < 1200 && undoStack.length)) {
      undoStack.push({ projectId: projectId, json: before });
      if (undoStack.length > 200) undoStack.shift();
    }
    lastMerge = { key: mergeKey || null, t: now };
    redoStack = [];
    S.dirty[projectId] = true;
    emit('structure'); emit('workspace'); emit('validation'); emit('history'); emit('dirty');
    return res === undefined ? true : res;
  }

  function undo() {
    var rec = undoStack.pop();
    if (!rec) return false;
    var cur = project(rec.projectId);
    if (cur) redoStack.push({ projectId: rec.projectId, json: snapshot(cur) });
    restoreProject(rec.json);
    lastMerge = { key: null, t: 0 };
    emitAll();
    return true;
  }

  function redo() {
    var rec = redoStack.pop();
    if (!rec) return false;
    var cur = project(rec.projectId);
    if (cur) undoStack.push({ projectId: rec.projectId, json: snapshot(cur) });
    restoreProject(rec.json);
    lastMerge = { key: null, t: 0 };
    emitAll();
    return true;
  }

  function canUndo() { return undoStack.length > 0; }
  function canRedo() { return redoStack.length > 0; }

  /* ------------------------------ tabs -------------------------------- */
  function openTab(projectId, treeId, ctx, opts) {
    var p = project(projectId);
    if (!p || !p.trees[treeId]) return null;
    if (ctx === undefined) ctx = treeId === p.mainTreeId ? '' : null;
    var tab = S.tabs.find(function (t) { return t.projectId === projectId && t.treeId === treeId && t.ctx === ctx; });
    if (!tab) {
      tab = { id: M.uid('tab'), projectId: projectId, treeId: treeId, ctx: ctx };
      var idx = S.tabs.findIndex(function (t) { return t.id === S.activeTabId; });
      if (opts && opts.replaceActive && idx >= 0 && !opts.keep) S.tabs.splice(idx + 1, 0, tab);
      else S.tabs.push(tab);
    }
    S.activeTabId = tab.id;
    S.activeProjectId = projectId;
    if (!opts || !opts.keepSelection) S.selection = null;
    emit('tabs'); emit('structure'); emit('selection'); emit('workspace');
    return tab;
  }

  function closeTab(tabId) {
    var idx = S.tabs.findIndex(function (t) { return t.id === tabId; });
    if (idx < 0) return;
    S.tabs.splice(idx, 1);
    if (S.activeTabId === tabId) {
      var next = S.tabs[idx] || S.tabs[idx - 1] || null;
      S.activeTabId = next ? next.id : null;
      if (next) S.activeProjectId = next.projectId;
      S.selection = null;
    }
    emit('tabs'); emit('structure'); emit('selection'); emit('workspace');
  }

  function activateTab(tabId) {
    var tab = S.tabs.find(function (t) { return t.id === tabId; });
    if (!tab) return;
    S.activeTabId = tabId;
    S.activeProjectId = tab.projectId;
    S.selection = null;
    emit('tabs'); emit('structure'); emit('selection'); emit('workspace');
  }

  function select(nodeId, ctx, treeId) {
    var tab = activeTab();
    if (!nodeId || !tab) S.selection = null;
    else S.selection = { tabId: tab.id, nodeId: nodeId, ctx: ctx, treeId: treeId || tab.treeId };
    S.multi = [];
    S.edge = null;
    emit('selection');
  }

  function isSelected(nodeId, ctx) {
    var s = S.selection;
    if (s && s.tabId === S.activeTabId && s.nodeId === nodeId && s.ctx === ctx) return true;
    return S.multi.some(function (m) { return m.nodeId === nodeId && m.ctx === ctx; });
  }

  // Ctrl+click: add/remove one node from the selection.
  function toggleSelect(nodeId, ctx, treeId) {
    var s = S.selection;
    if (!s || s.tabId !== S.activeTabId) return select(nodeId, ctx, treeId);
    if (s.nodeId === nodeId && s.ctx === ctx) {
      var next = S.multi.shift();
      S.selection = next ? Object.assign({}, s, { nodeId: next.nodeId, ctx: next.ctx }) : null;
    } else if (isSelected(nodeId, ctx)) {
      S.multi = S.multi.filter(function (m) { return !(m.nodeId === nodeId && m.ctx === ctx); });
    } else {
      S.multi.push({ nodeId: s.nodeId, ctx: s.ctx });
      S.selection = Object.assign({}, s, { nodeId: nodeId, ctx: ctx, treeId: treeId || s.treeId });
    }
    S.edge = null;
    emit('selection');
  }

  function selectEdge(key) {
    S.selection = null; S.multi = []; S.edge = key;
    emit('selection');
  }

  /* ------------------------------ projects ---------------------------- */
  function projectNames() { return S.projects.map(function (p) { return p.name; }); }

  function addProject(p, openMain) {
    S.projects.push(p);
    S.activeProjectId = p.id;
    S.dirty[p.id] = true;
    if (openMain !== false) openTab(p.id, p.mainTreeId, '');
    emitAll();
    return p;
  }

  function removeProject(id) {
    var p = project(id);
    S.projects = S.projects.filter(function (x) { return x.id !== id; });
    S.tabs = S.tabs.filter(function (t) { return t.projectId !== id; });
    undoStack = undoStack.filter(function (r) { return r.projectId !== id; });
    redoStack = redoStack.filter(function (r) { return r.projectId !== id; });
    delete S.dirty[id];
    if (!activeTab()) S.activeTabId = S.tabs.length ? S.tabs[0].id : null;
    if (S.activeProjectId === id) S.activeProjectId = S.projects.length ? S.projects[0].id : null;
    S.selection = null;
    emitAll();
    if (p && p.meta && p.meta.onDisk && S.backend) {
      return api('/api/project/delete', { name: p.meta.diskName || p.name });
    }
    return Promise.resolve();
  }

  /* ------------------------------ backend ----------------------------- */
  function api(path, body) {
    var opts = body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
    return fetch(path, opts).then(function (r) { return r.json(); }).then(function (data) {
      if (!data.ok) throw new Error(data.error || 'Erro no servidor');
      return data;
    });
  }

  function probeBackend() {
    if (location.protocol === 'file:') return Promise.resolve(null);
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 1500);
    return fetch('/api/info', ctrl ? { signal: ctrl.signal } : {}).then(function (r) { return r.json(); })
      .then(function (info) { clearTimeout(timer); S.backend = info && info.ok ? info : null; return S.backend; })
      .catch(function () { clearTimeout(timer); S.backend = null; return null; });
  }

  function projectMeta(p) {
    var main = p.trees[p.mainTreeId];
    return { logName: p.logName || '', mainTree: main ? main.name : '', author: p.meta.author || '', email: p.meta.email || '', version: p.meta.version || '' };
  }

  // Saves to disk (server) when available; always persists to the browser.
  function saveProject(id) {
    var p = project(id);
    if (!p) return Promise.reject(new Error('Projeto não encontrado'));
    var loose = M.looseNodes(p).length;
    if (loose) return Promise.reject(new Error(p.name + ': ' + loose + ' nó(s) solto(s). Ligue-os a um pai (ou exclua) para salvar.'));
    persistNow();
    if (!S.backend) {
      delete S.dirty[id];
      emit('dirty'); emit('workspace');
      return Promise.resolve({ where: 'browser' });
    }
    var xml = M.exportXml(p);
    var chain = Promise.resolve();
    if (p.meta.onDisk && p.meta.diskName && p.meta.diskName !== p.name) {
      chain = api('/api/project/rename', { old: p.meta.diskName, new: p.name });
    }
    return chain.then(function () {
      return api('/api/project/save', { name: p.name, xml: xml, meta: projectMeta(p) });
    }).then(function (res) {
      p.meta.onDisk = true;
      p.meta.diskName = p.name;
      delete S.dirty[id];
      emit('dirty'); emit('workspace');
      persistNow();
      return { where: 'disk', path: res.path };
    });
  }

  function saveAll() {
    var ids = Object.keys(S.dirty).filter(function (id) { return project(id); });
    return Promise.all(ids.map(saveProject));
  }

  function projectFromDisk(entry) {
    var imp = M.importXml(entry.xml, entry.name);
    if (entry.meta && entry.meta.mainTree) imp.mainTreeName = entry.meta.mainTree;
    var p = M.projectFromImport(imp, entry.name);
    p.logName = (entry.meta && entry.meta.logName) || '';
    p.meta = { onDisk: true, diskName: entry.name, author: entry.meta.author || '', email: entry.meta.email || '', version: entry.meta.version || '' };
    return p;
  }

  /* ------------------------------ local persistence ------------------- */
  var persistTimer = null;
  function persistSoon() { clearTimeout(persistTimer); persistTimer = setTimeout(persistNow, 400); }
  function persistNow() {
    clearTimeout(persistTimer);
    try {
      var data = {
        projects: S.projects,
        activeProjectId: S.activeProjectId,
        tabs: S.tabs.map(function (t) {
          var p = project(t.projectId); var tr = p && p.trees[t.treeId];
          return tr ? { project: p.name, tree: tr.name, ctx: t.ctx, active: t.id === S.activeTabId } : null;
        }).filter(Boolean),
        dirty: Object.keys(S.dirty).map(function (id) { var p = project(id); return p ? p.name : null; }).filter(Boolean),
        settings: S.settings,
        expanded: S.expanded
      };
      localStorage.setItem(LS_KEY, JSON.stringify(data));
    } catch (e) { /* storage full or blocked: ignore */ }
  }

  function loadLocal() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function restoreTabs(saved) {
    S.tabs = [];
    S.activeTabId = null;
    (saved || []).forEach(function (st) {
      var p = S.projects.find(function (x) { return x.name === st.project; });
      var tr = p && M.findTreeByName(p, st.tree);
      if (!tr) return;
      // instance contexts contain node ids that may be regenerated: fall back to "any instance"
      var ctx = st.ctx;
      if (ctx && ctx.split('/').some(function (id) { return id && !Object.keys(p.trees).some(function (tid) { return p.trees[tid].nodes[id]; }); })) ctx = null;
      var tab = { id: M.uid('tab'), projectId: p.id, treeId: tr.id, ctx: ctx };
      S.tabs.push(tab);
      if (st.active) { S.activeTabId = tab.id; S.activeProjectId = p.id; }
    });
    if (!S.activeTabId && S.tabs.length) { S.activeTabId = S.tabs[0].id; S.activeProjectId = S.tabs[0].projectId; }
  }

  // Startup: local storage + disk (server) merge. Returns a summary for toasts.
  function init() {
    var local = loadLocal();
    var summary = { recovered: [], fromDisk: 0 };
    if (local) {
      S.settings = Object.assign(S.settings, local.settings || {});
      S.expanded = local.expanded || {};
    }
    var localProjects = (local && local.projects) || [];
    var localDirty = (local && local.dirty) || [];
    return probeBackend().then(function (info) {
      if (!info) {
        S.projects = localProjects;
        S.projects.forEach(function (p) { if (localDirty.indexOf(p.name) >= 0) S.dirty[p.id] = true; });
        return null;
      }
      return api('/api/workspace').then(function (ws) {
        var byName = {};
        ws.projects.forEach(function (e) { byName[e.name] = e; });
        var result = [];
        localProjects.forEach(function (lp) {
          var isDirty = localDirty.indexOf(lp.name) >= 0;
          if (isDirty) {
            result.push(lp); S.dirty[lp.id] = true;
            if (byName[lp.name] || (lp.meta && lp.meta.onDisk)) summary.recovered.push(lp.name);
            delete byName[lp.meta && lp.meta.diskName ? lp.meta.diskName : lp.name];
          } else if (byName[lp.name]) {
            // disk is the source of truth; keep local object (same ids) if identical
            var disk = byName[lp.name];
            delete byName[lp.name];
            var same = false;
            try { same = M.exportXml(lp) === disk.xml; } catch (e) { same = false; }
            if (same) { lp.meta = Object.assign(lp.meta || {}, { onDisk: true, diskName: lp.name }); result.push(lp); }
            else { try { result.push(projectFromDisk(disk)); summary.fromDisk += 1; } catch (e) { console.error(e); result.push(lp); } }
          } else if (!(lp.meta && lp.meta.onDisk)) {
            result.push(lp); S.dirty[lp.id] = true;   // never saved to disk
          }
          // else: was on disk but deleted externally -> drop
        });
        Object.keys(byName).forEach(function (name) {
          try { result.push(projectFromDisk(byName[name])); summary.fromDisk += 1; }
          catch (e) { console.error('Falha ao carregar ' + name, e); summary.error = (summary.error || '') + name + ': ' + e.message + ' '; }
        });
        S.projects = result;
        return info;
      }).catch(function (e) {
        console.error(e);
        S.projects = localProjects;
      });
    }).then(function () {
      restoreTabs(local && local.tabs);
      if (!S.activeProjectId && S.projects.length) S.activeProjectId = S.projects[0].id;
      emitAll();
      emit('settings');
      return summary;
    });
  }

  function setMode(mode) {
    if (S.mode === mode) return;
    S.mode = mode;
    emit('mode'); emit('structure');
  }

  function setSetting(key, value) { S.settings[key] = value; emit('settings'); }

  window.BTStore = {
    S: S, on: on, emit: emit, emitAll: emitAll,
    project: project, activeProject: activeProject, activeTab: activeTab, tabTree: tabTree, tabProject: tabProject,
    mutate: mutate, undo: undo, redo: redo, canUndo: canUndo, canRedo: canRedo,
    openTab: openTab, closeTab: closeTab, activateTab: activateTab, select: select,
    isSelected: isSelected, toggleSelect: toggleSelect, selectEdge: selectEdge,
    projectNames: projectNames, addProject: addProject, removeProject: removeProject,
    api: api, probeBackend: probeBackend, saveProject: saveProject, saveAll: saveAll, persistNow: persistNow,
    init: init, setMode: setMode, setSetting: setSetting
  };
})();
