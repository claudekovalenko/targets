'use strict';

const STORAGE_KEY = 'targets.v1';

const $ = (sel, root = document) => root.querySelector(sel);
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

// ---------- dates ----------

function todayISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function daysBetween(fromISO, toISO) {
  return Math.round((parseISO(toISO) - parseISO(fromISO)) / 86400000);
}

// Monday of the week containing the given date.
function weekStartISO(iso) {
  const d = parseISO(iso);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function addDaysISO(iso, days) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function formatDate(iso) {
  if (!iso) return '';
  return parseISO(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ---------- state ----------

function seedTargets() {
  const steps = [
    'Pray over the vision and who this is for',
    'Choose the account name and set up the profile (photo, bio, link)',
    'Decide the weekly rhythm (e.g. Mon scripture, Wed short teaching Reel, Fri encouragement)',
    'Get a phone tripod, a small mic and good lighting',
    'Batch-create the first 4 weeks of posts before launch',
    'Launch: first post on January 1',
    'Post consistently for 90 days',
    'Reach the first 100 followers',
    'Go Live for a teaching or Q&A',
  ];
  return [{
    id: uid(),
    title: 'Preach the Word on Instagram',
    category: 'Faith',
    why: 'To grow in the Word and preach it — sharing the Gospel and encouragement with people where they already are.',
    startDate: `${new Date().getFullYear() + 1}-01-01`,
    targetDate: `${new Date().getFullYear() + 1}-12-31`,
    cadence: 3,
    link: '',
    milestones: steps.map(text => ({ id: uid(), text, done: false })),
    log: [],
    archived: false,
    createdAt: new Date().toISOString(),
  }];
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Could not read saved targets', e);
  }
  return seedTargets();
}

const state = {
  targets: load(),
  view: { name: 'list' },
  showArchived: false,
  editingId: null,
  loggingId: null,
};

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.targets));
  } catch (e) {
    toast('Could not save — storage is unavailable');
  }
}

const findTarget = id => state.targets.find(t => t.id === id);

// ---------- derived ----------

function progressOf(t) {
  if (!t.milestones.length) return 0;
  return Math.round((t.milestones.filter(m => m.done).length / t.milestones.length) * 100);
}

function statusOf(t) {
  const today = todayISO();
  if (t.milestones.length && t.milestones.every(m => m.done)) return { cls: 'status-done', label: 'Complete' };
  if (t.startDate && t.startDate > today) {
    const days = daysBetween(today, t.startDate);
    return { cls: '', label: `Starts in ${days} day${days === 1 ? '' : 's'}` };
  }
  return { cls: 'status-active', label: 'Active' };
}

function thisWeekCount(t) {
  const start = weekStartISO(todayISO());
  return t.log.filter(e => e.date >= start).length;
}

// Consecutive weeks (ending with this week or last week) where the rhythm was met.
function weekStreak(t) {
  if (!t.cadence) return 0;
  const counts = {};
  for (const e of t.log) {
    const w = weekStartISO(e.date);
    counts[w] = (counts[w] || 0) + 1;
  }
  let week = weekStartISO(todayISO());
  // The current week isn't over yet, so don't break the streak because of it.
  if ((counts[week] || 0) < t.cadence) week = addDaysISO(week, -7);
  let streak = 0;
  while ((counts[week] || 0) >= t.cadence) {
    streak++;
    week = addDaysISO(week, -7);
  }
  return streak;
}

function nextStep(t) {
  return t.milestones.find(m => !m.done);
}

// ---------- rendering ----------

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = u => (/^https?:\/\//i.test(u || '') ? u : '');

function render() {
  const app = $('#app');
  const v = state.view;
  $('#backBtn').hidden = v.name === 'list';
  $('#addBtn').hidden = v.name !== 'list';

  if (v.name === 'detail') {
    const t = findTarget(v.id);
    if (!t) { state.view = { name: 'list' }; return render(); }
    $('#pageTitle').textContent = t.title;
    app.innerHTML = renderDetail(t);
  } else {
    $('#pageTitle').textContent = state.showArchived ? 'Archived Targets' : 'My Targets';
    app.innerHTML = renderList();
  }
  $('#toggleArchived').textContent = state.showArchived ? 'Show active targets' : 'Show archived targets';
}

function renderList() {
  const list = state.targets.filter(t => !!t.archived === state.showArchived);
  if (!list.length) {
    return `<div class="empty">
      <p>${state.showArchived ? 'No archived targets.' : 'No targets yet.'}</p>
      ${state.showArchived ? '' : '<p>Tap <strong>+</strong> to add what you’re pursuing.</p>'}
    </div>`;
  }
  return list.map(t => {
    const p = progressOf(t);
    const s = statusOf(t);
    const next = nextStep(t);
    return `<button class="card target-card" data-open="${t.id}">
      ${t.category ? `<span class="chip">${esc(t.category)}</span>` : ''}
      <span class="chip ${s.cls}">${esc(s.label)}</span>
      <h3>${esc(t.title)}</h3>
      <div class="progress"><span style="width:${p}%"></span></div>
      <div class="muted">${p}% of steps done${t.cadence ? ` · ${thisWeekCount(t)}/${t.cadence} this week` : ''}</div>
      ${next ? `<div class="muted">Next: ${esc(next.text)}</div>` : ''}
    </button>`;
  }).join('');
}

function renderDetail(t) {
  const p = progressOf(t);
  const s = statusOf(t);
  const week = thisWeekCount(t);
  const link = safeUrl(t.link);
  const dots = t.cadence
    ? `<div class="week-dots" aria-label="${week} of ${t.cadence} this week">${
        Array.from({ length: Math.max(t.cadence, week) }, (_, i) => `<i class="${i < week ? 'on' : ''}"></i>`).join('')
      }</div>`
    : '';
  const log = [...t.log].sort((a, b) => b.date.localeCompare(a.date));

  return `
  <section class="card">
    ${t.category ? `<span class="chip">${esc(t.category)}</span>` : ''}
    <span class="chip ${s.cls}">${esc(s.label)}</span>
    ${t.why ? `<p class="why">${esc(t.why)}</p>` : ''}
    <div class="muted">
      ${t.startDate ? `Start: ${formatDate(t.startDate)}` : ''}
      ${t.targetDate ? ` · Target: ${formatDate(t.targetDate)}` : ''}
    </div>
    ${link ? `<p><a class="link-btn" href="${esc(link)}" target="_blank" rel="noopener">Open link ↗</a></p>` : ''}
    <div class="progress"><span style="width:${p}%"></span></div>
    <div class="muted">${p}% of steps done</div>
  </section>

  <div class="stats">
    <div class="card stat"><strong>${t.cadence ? `${week}/${t.cadence}` : week}</strong><span>This week</span></div>
    <div class="card stat"><strong>${weekStreak(t)}</strong><span>Week streak</span></div>
    <div class="card stat"><strong>${t.log.length}</strong><span>Total logged</span></div>
  </div>
  ${dots ? `<div class="card">${t.cadence ? `<div class="muted">Weekly rhythm: ${t.cadence}× per week</div>` : ''}${dots}</div>` : ''}

  <div class="actions">
    <button class="primary" data-log="${t.id}">+ Log progress</button>
  </div>

  <h2 class="section-title">Steps</h2>
  <section class="card">
    ${t.milestones.length ? `<ul class="milestones">${t.milestones.map(m => `
      <li class="${m.done ? 'done' : ''}">
        <input type="checkbox" data-toggle="${m.id}" ${m.done ? 'checked' : ''} aria-label="Mark step done">
        <span>${esc(m.text)}</span>
        <button class="x-btn del" data-delstep="${m.id}" aria-label="Remove step">×</button>
      </li>`).join('')}</ul>` : '<p class="muted">No steps yet.</p>'}
    <form class="add-step" data-addstep="${t.id}">
      <input name="step" placeholder="Add a step…" required>
      <button class="ghost small" type="submit">Add</button>
    </form>
  </section>

  <h2 class="section-title">Activity</h2>
  <section class="card">
    ${log.length ? `<ul class="log">${log.map(e => `
      <li>
        <div class="date">${formatDate(e.date)}</div>
        <div class="body">
          ${esc(e.note)}
          ${e.tag ? `<div><span class="chip">${esc(e.tag)}</span></div>` : ''}
          ${safeUrl(e.link) ? `<div><a href="${esc(e.link)}" target="_blank" rel="noopener">View ↗</a></div>` : ''}
        </div>
        <button class="x-btn" data-dellog="${e.id}" aria-label="Remove entry">×</button>
      </li>`).join('')}</ul>` : '<p class="muted">Nothing logged yet. Every post, sermon, or study session counts.</p>'}
  </section>

  <div class="actions">
    <button class="ghost" data-edit="${t.id}">Edit target</button>
    <button class="ghost" data-archive="${t.id}">${t.archived ? 'Unarchive' : 'Archive'}</button>
    <button class="danger" data-delete="${t.id}">Delete</button>
  </div>`;
}

// ---------- dialogs ----------

function openTargetDialog(id = null) {
  state.editingId = id;
  const form = $('#targetForm');
  form.reset();
  const t = id ? findTarget(id) : null;
  $('#targetDialogTitle').textContent = t ? 'Edit target' : 'New target';
  if (t) {
    form.title.value = t.title;
    form.category.value = t.category || '';
    form.why.value = t.why || '';
    form.startDate.value = t.startDate || '';
    form.targetDate.value = t.targetDate || '';
    form.cadence.value = t.cadence || '';
    form.link.value = t.link || '';
    form.milestones.value = t.milestones.map(m => m.text).join('\n');
  } else {
    form.startDate.value = todayISO();
  }
  const cats = [...new Set(state.targets.map(t => t.category).filter(Boolean))];
  $('#categoryList').innerHTML = cats.map(c => `<option value="${esc(c)}">`).join('');
  $('#targetDialog').showModal();
}

$('#targetForm').addEventListener('submit', e => {
  const f = e.target;
  const lines = f.milestones.value.split('\n').map(s => s.trim()).filter(Boolean);
  const data = {
    title: f.title.value.trim(),
    category: f.category.value.trim(),
    why: f.why.value.trim(),
    startDate: f.startDate.value,
    targetDate: f.targetDate.value,
    cadence: Math.max(0, parseInt(f.cadence.value, 10) || 0),
    link: f.link.value.trim(),
  };
  if (state.editingId) {
    const t = findTarget(state.editingId);
    // Keep done-state for steps whose text didn't change.
    const prev = new Map(t.milestones.map(m => [m.text, m]));
    Object.assign(t, data, {
      milestones: lines.map(text => prev.get(text) || { id: uid(), text, done: false }),
    });
  } else {
    const t = { id: uid(), ...data, milestones: lines.map(text => ({ id: uid(), text, done: false })), log: [], archived: false, createdAt: new Date().toISOString() };
    state.targets.unshift(t);
    state.view = { name: 'detail', id: t.id };
  }
  save();
  render();
});

function openLogDialog(id) {
  state.loggingId = id;
  const f = $('#logForm');
  f.reset();
  f.date.value = todayISO();
  $('#logDialog').showModal();
}

$('#logForm').addEventListener('submit', e => {
  const f = e.target;
  const t = findTarget(state.loggingId);
  if (!t) return;
  t.log.push({ id: uid(), date: f.date.value, note: f.note.value.trim(), tag: f.tag.value.trim(), link: f.link.value.trim() });
  save();
  render();
  toast('Logged — keep going!');
});

document.querySelectorAll('[data-close]').forEach(btn =>
  btn.addEventListener('click', () => btn.closest('dialog').close()));

// ---------- events ----------

$('#app').addEventListener('click', e => {
  const el = e.target.closest('[data-open],[data-log],[data-edit],[data-archive],[data-delete],[data-delstep],[data-dellog]');
  if (!el) return;
  const d = el.dataset;
  const t = state.view.name === 'detail' ? findTarget(state.view.id) : null;

  if (d.open) { state.view = { name: 'detail', id: d.open }; window.scrollTo(0, 0); return render(); }
  if (d.log) return openLogDialog(d.log);
  if (d.edit) return openTargetDialog(d.edit);
  if (d.archive) {
    const a = findTarget(d.archive);
    a.archived = !a.archived;
    save();
    state.view = { name: 'list' };
    toast(a.archived ? 'Archived' : 'Restored');
    return render();
  }
  if (d.delete) {
    if (!confirm('Delete this target and all its activity? This cannot be undone.')) return;
    state.targets = state.targets.filter(x => x.id !== d.delete);
    save();
    state.view = { name: 'list' };
    return render();
  }
  if (d.delstep && t) {
    t.milestones = t.milestones.filter(m => m.id !== d.delstep);
    save();
    return render();
  }
  if (d.dellog && t) {
    if (!confirm('Remove this entry?')) return;
    t.log = t.log.filter(x => x.id !== d.dellog);
    save();
    return render();
  }
});

$('#app').addEventListener('change', e => {
  const id = e.target.dataset.toggle;
  if (!id) return;
  const t = findTarget(state.view.id);
  const m = t.milestones.find(x => x.id === id);
  m.done = e.target.checked;
  save();
  render();
  if (m.done) toast('Step complete ✓');
});

$('#app').addEventListener('submit', e => {
  const id = e.target.dataset.addstep;
  if (!id) return;
  e.preventDefault();
  const text = e.target.step.value.trim();
  if (!text) return;
  findTarget(id).milestones.push({ id: uid(), text, done: false });
  save();
  render();
});

$('#addBtn').addEventListener('click', () => openTargetDialog());
$('#backBtn').addEventListener('click', () => { state.view = { name: 'list' }; render(); });
$('#menuBtn').addEventListener('click', () => $('#menuDialog').showModal());

$('#toggleArchived').addEventListener('click', () => {
  state.showArchived = !state.showArchived;
  state.view = { name: 'list' };
  $('#menuDialog').close();
  render();
});

$('#exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), targets: state.targets }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `targets-backup-${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

$('#importInput').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const targets = Array.isArray(data) ? data : data.targets;
    if (!Array.isArray(targets)) throw new Error('No targets found');
    if (!confirm(`Replace your current targets with ${targets.length} from this backup?`)) return;
    state.targets = targets.map(t => ({ milestones: [], log: [], ...t }));
    save();
    state.view = { name: 'list' };
    $('#menuDialog').close();
    render();
    toast('Backup restored');
  } catch (err) {
    alert('That file could not be imported: ' + err.message);
  } finally {
    e.target.value = '';
  }
});

let toastTimer;
function toast(msg) {
  let el = $('.toast');
  if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); }
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 1800);
}

// ---------- PWA ----------

let installPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  installPrompt = e;
  $('#installBtn').hidden = false;
});
$('#installBtn').addEventListener('click', async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  $('#installBtn').hidden = true;
});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
}

save();
render();
