/* Device-local named projects. Keep complete design state, not just the visible pixels. */
(function (root) {
  'use strict';
  const KEY = 'yarnside.workspace.v1', clone = value => JSON.parse(JSON.stringify(value));
  function validSnapshot(s) {
    if (!s || s.version !== 1 || !s.design || !s.plan) return false;
    const d = s.design, P = d.P;
    if (!Array.isArray(P) || !P.length || !Array.isArray(P[0])) return false;
    const H = P.length, W = P[0].length;
    if (!H || !W || H * W > 9000000 || !P.every(row => Array.isArray(row) && row.length === W && row.every(L => /^[ABCD]$/.test(L)))) return false;
    for (const L of ['G', 'K', 'mine', 'auto']) if (!Array.isArray(d[L]) || d[L].length !== H || !d[L].every(row => Array.isArray(row) && row.length === W && row.every(v => Number.isInteger(v) && v >= 0 && v <= (L === 'G' ? 3 : 1)))) return false;
    if (!Array.isArray(d.yarn) || d.yarn.length !== H || !d.yarn.every(y => y == null || y === 'A' || y === 'B')) return false;
    if (!d.linked || typeof d.linked !== 'object' || Array.isArray(d.linked) || Object.entries(d.linked).some(([L, from]) => !/^[CD]$/.test(L) || !/^[AB]$/.test(from))) return false;
    return ['A', 'B', 'C', 'D'].every(L => Array.isArray(s.plan[L]) && s.plan[L].length && s.plan[L].every(e => Number.isInteger(e.row) && e.row >= 1 && /^#[a-f\d]{6}$/i.test(e.hex)));
  }
  const validData = saved => saved && saved.version === 1 && Array.isArray(saved.projects) && saved.projects.every(p => p && typeof p.id === 'string' && typeof p.name === 'string' && validSnapshot(p.snapshot));
  function create({ getSnapshot, loadSnapshot }) {
    const $ = id => document.getElementById(id);
    let db = { version: 1, currentId: null, projects: [] }, blocked = false, last = '';
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { const saved = JSON.parse(raw);
        if (!validData(saved)) throw Error('Invalid saved projects');
        db = saved;
      }
    } catch (e) { blocked = true; $('projectNote').textContent = 'Saved projects could not be read. Existing saved data has been left untouched.'; }
    let activeId = null;
    function list() {
      const box = $('projectList'), selected = box.value || db.currentId; box.innerHTML = '';
      db.projects.slice().sort((a, b) => b.updatedAt - a.updatedAt).forEach(p => { const option = document.createElement('option'); option.value = p.id; option.textContent = p.name; box.appendChild(option); });
      box.value = db.projects.some(p => p.id === selected) ? selected : db.currentId || '';
      $('openProject').disabled = !db.projects.length; $('resumeProject').hidden = !db.projects.some(p => p.id === db.currentId);
    }
    function autosave() {
      const snapshot = getSnapshot(); if (!snapshot) return true;
      if (blocked) { $('saveStatus').textContent = 'Autosave unavailable on this device.'; return false; }
      const name = ($('projectName').value || '').trim().slice(0, 80) || 'Untitled design', fingerprint = JSON.stringify({ name, snapshot });
      if (activeId && last === fingerprint) return true;
      let next, id = activeId, savedName = name;
      try { const raw = localStorage.getItem(KEY); next = raw ? JSON.parse(raw) : clone(db); if (!validData(next)) throw Error('Invalid saved projects'); }
      catch (e) { $('saveStatus').textContent = 'Could not read saved projects. Keep this page open; existing data was not replaced.'; return false; }
      // Merge projects saved in another tab; conflicting edits become a new copy.
      const remote = next.projects.find(p => p.id === id), previous = db.projects.find(p => p.id === id);
      if (remote && previous && JSON.stringify(remote.snapshot) !== JSON.stringify(previous.snapshot)) { id = null; savedName += ' copy'; }
      id = id || Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      const record = { id, name: savedName, updatedAt: Date.now(), snapshot }, index = next.projects.findIndex(p => p.id === id);
      if (index < 0) next.projects.push(record); else next.projects[index] = record;
      next.currentId = id;
      try { localStorage.setItem(KEY, JSON.stringify(next)); }
      catch (e) { $('saveStatus').textContent = 'Could not autosave. Keep this page open; device storage may be full.'; return false; }
      db = next; activeId = id; last = fingerprint;
      $('projectName').value = savedName; $('saveStatus').textContent = 'Saved on this device'; list(); return true;
    }
    function open(id) {
      if (!autosave()) return;
      try { const raw = localStorage.getItem(KEY); if (raw) { const latest = JSON.parse(raw); if (!validData(latest)) throw Error('Invalid saved projects'); db = latest; } }
      catch (e) { $('projectNote').textContent = 'Could not open the saved project. Existing data has been left untouched.'; return; }
      const project = db.projects.find(p => p.id === id); if (!project) return;
      activeId = project.id; db.currentId = project.id; last = '';
      $('projectName').value = project.name; loadSnapshot(clone(project.snapshot));
    }
    $('resumeProject').onclick = () => open(db.currentId);
    $('openProject').onclick = () => open($('projectList').value);
    $('projectName').onchange = autosave;
    $('copyProject').onclick = () => { if (!getSnapshot() || !autosave()) return; activeId = null; last = ''; $('projectName').value = ($('projectName').value || 'Untitled design') + ' copy'; autosave(); };
    list();
    return { autosave, newProject() { if (!autosave()) return false; activeId = null; last = ''; $('projectName').value = 'Untitled design'; return true; } };
  }
  root.MosaicWorkspace = { create, validSnapshot, KEY };
})(window);
