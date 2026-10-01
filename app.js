'use strict';

const STORAGE_KEY = 'targets.v1';
// Which built-in targets have already been offered, so a deleted one isn't re-added.
const SEEDED_KEY = 'targets.seeded';

const $ = (sel, root = document) => root.querySelector(sel);
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

// ---------- dates ----------

function toISO(d) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

const todayISO = () => toISO(new Date());

function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function daysBetween(fromISO, toISO_) {
  return Math.round((parseISO(toISO_) - parseISO(fromISO)) / 86400000);
}

// Monday of the week containing the given date.
function weekStartISO(iso) {
  const d = parseISO(iso);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toISO(d);
}

function addDaysISO(iso, days) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

function formatDate(iso, opts = { month: 'short', day: 'numeric', year: 'numeric' }) {
  return iso ? parseISO(iso).toLocaleDateString(undefined, opts) : '';
}

// ---------- seeds ----------

const SEEDS = {
  preach: () => ({
    title: 'Preach the Word on Instagram',
    category: 'Faith',
    kind: 'standard',
    why: 'To grow in the Word and preach it — sharing the Gospel and encouragement with people where they already are.',
    startDate: `${new Date().getFullYear() + 1}-01-01`,
    targetDate: `${new Date().getFullYear() + 1}-12-31`,
    cadence: 3,
    steps: [
      'Pray over the vision and who this is for',
      'Choose the account name and set up the profile (photo, bio, link)',
      'Decide the weekly rhythm (e.g. Mon scripture, Wed short teaching Reel, Fri encouragement)',
      'Get a phone tripod, a small mic and good lighting',
      'Batch-create the first 4 weeks of posts before launch',
      'Launch: first post on January 1',
      'Post consistently for 90 days',
      'Reach the first 100 followers',
      'Go Live for a teaching or Q&A',
    ],
  }),
  library: () => ({
    title: 'Build an Annotated Library',
    category: 'Library',
    kind: 'library',
    why: 'A physical library of books I have read deeply, marked up and made my own — books I carry with me and can one day pass on. Digital too, but the shelf comes first.',
    startDate: todayISO(),
    targetDate: '',
    cadence: 0,
    steps: [
      'Choose an annotation system (pen colours, symbols, margin notes)',
      'Get annotation tools: archival pens, pencil, page tabs',
      'Clear a dedicated shelf for annotated books',
      'List the first 10 books to own and annotate',
      'Finish annotating the first book',
      'Annotate 12 books this year',
      'Set up a digital library to sit alongside the physical one',
    ],
  }),
};

function makeTarget(seedKey) {
  const s = SEEDS[seedKey]();
  return {
    id: uid(),
    seedKey,
    title: s.title,
    category: s.category,
    kind: s.kind,
    why: s.why,
    startDate: s.startDate,
    targetDate: s.targetDate,
    cadence: s.cadence,
    link: '',
    milestones: s.steps.map(text => ({ id: uid(), text, done: false })),
    log: [],
    books: [],
    archived: false,
    createdAt: new Date().toISOString(),
  };
}

function normalize(t) {
  return { kind: 'standard', milestones: [], log: [], books: [], cadence: 0, ...t };
}

function load() {
  let targets = null;
  let seeded = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      targets = JSON.parse(raw);
      // Data saved before seeds were tracked already had the Instagram target.
      seeded = JSON.parse(localStorage.getItem(SEEDED_KEY) || '["preach"]');
    }
  } catch (e) {
    console.warn('Could not read saved targets', e);
  }
  targets = (targets || []).map(normalize);
  for (const key of Object.keys(SEEDS)) {
    if (!seeded.includes(key)) {
      targets.push(makeTarget(key));
      seeded.push(key);
    }
  }
  try { localStorage.setItem(SEEDED_KEY, JSON.stringify(seeded)); } catch (e) { /* storage unavailable */ }
  return targets;
}

const state = {
  targets: load(),
  view: { name: 'list' },
  showArchived: false,
  shelfFilter: 'all',
  editingId: null,
  loggingId: null,
  book: null, // { targetId, bookId|null }
};

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.targets));
  } catch (e) {
    toast('Could not save — storage is unavailable');
  }
}

const findTarget = id => state.targets.find(t => t.id === id);

// ---------- colour ----------

const CATEGORY_COLORS = { faith: '#b8862f', library: '#7a2e3a', health: '#4f7a5c', family: '#5a6fa8', work: '#3f6f7a' };
const PALETTE = ['#b8862f', '#7a2e3a', '#4f7a5c', '#5a6fa8', '#3f6f7a', '#8a5a9e', '#b05a3c'];
const SPINES = ['#7a2e3a', '#2f4a3a', '#1f2f4f', '#6b4423', '#4a3a5e', '#8c5a2b', '#2e5560', '#5b2a2a', '#3d4a2a', '#2a2a2a'];

function hash(s) {
  let h = 0;
  for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

const catColor = t => CATEGORY_COLORS[(t.category || '').toLowerCase()] || PALETTE[hash(t.category || t.title) % PALETTE.length];
const spineColor = b => SPINES[hash(b.title + b.author) % SPINES.length];

// ---------- derived ----------

function progressOf(t) {
  if (!t.milestones.length) return 0;
  return Math.round((t.milestones.filter(m => m.done).length / t.milestones.length) * 100);
}

function statusOf(t) {
  const today = todayISO();
  if (t.milestones.length && t.milestones.every(m => m.done)) return { cls: 'neutral', label: 'Complete' };
  if (t.startDate && t.startDate > today) {
    const days = daysBetween(today, t.startDate);
    return { cls: 'neutral', label: `Starts in ${days} day${days === 1 ? '' : 's'}` };
  }
  return { cls: 'active', label: 'Active' };
}

function thisWeekCount(t) {
  const start = weekStartISO(todayISO());
  return t.log.filter(e => e.date >= start).length;
}

// Consecutive weeks where the rhythm was met. The current week only counts once it's met.
function weekStreak(t) {
  if (!t.cadence) return 0;
  const counts = {};
  for (const e of t.log) {
    const w = weekStartISO(e.date);
    counts[w] = (counts[w] || 0) + 1;
  }
  let week = weekStartISO(todayISO());
  if ((counts[week] || 0) < t.cadence) week = addDaysISO(week, -7);
  let streak = 0;
  while ((counts[week] || 0) >= t.cadence) {
    streak++;
    week = addDaysISO(week, -7);
  }
  return streak;
}

const nextStep = t => t.milestones.find(m => !m.done);

const BOOK_STATUS = {
  wishlist: 'Want to get',
  shelf: 'On my shelf',
  reading: 'Reading & marking',
  annotated: 'Annotated',
};
const FORMAT_LABEL = { physical: 'Physical', digital: 'Digital', both: 'Physical + digital' };

function libraryStats(t) {
  const owned = t.books.filter(b => b.status !== 'wishlist');
  return {
    owned: owned.length,
    annotated: t.books.filter(b => b.status === 'annotated').length,
    keepers: t.books.filter(b => b.keeper).length,
    reading: t.books.filter(b => b.status === 'reading'),
  };
}

// ---------- rendering ----------

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = u => (/^https?:\/\//i.test(u || '') ? u : '');
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function ring(pct) {
  const r = 24;
  const c = 2 * Math.PI * r;
  return `<div class="ring" aria-label="${pct}% complete">
    <svg viewBox="0 0 58 58"><circle class="track" cx="29" cy="29" r="${r}" fill="none" stroke-width="5"/>
    <circle class="fill" cx="29" cy="29" r="${r}" fill="none" stroke-width="5" stroke-linecap="round"
      stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${(c * (1 - pct / 100)).toFixed(2)}"/></svg>
    <span>${pct}%</span>
  </div>`;
}

function render() {
  const app = $('#app');
  const v = state.view;
  $('#backBtn').hidden = v.name === 'list';
  $('#addBtn').hidden = v.name !== 'list';
  $('#addBtn').setAttribute('aria-label', 'Add target');

  if (v.name === 'detail') {
    const t = findTarget(v.id);
    if (!t) { state.view = { name: 'list' }; return render(); }
    $('#topbarTitle').textContent = t.title;
    app.innerHTML = renderDetail(t);
  } else {
    $('#topbarTitle').textContent = state.showArchived ? 'Archived' : 'Targets';
    app.innerHTML = renderList();
  }
  $('#toggleArchived').textContent = state.showArchived ? 'Show active targets' : 'Show archived targets';
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function renderList() {
  const list = state.targets.filter(t => !!t.archived === state.showArchived);
  const all = state.targets.filter(t => !t.archived);
  const stepsDone = all.reduce((n, t) => n + t.milestones.filter(m => m.done).length, 0);
  const weekLogs = all.reduce((n, t) => n + thisWeekCount(t), 0);

  const hero = state.showArchived
    ? `<section class="hero"><div class="eyebrow">Archive</div><h1>Set aside, not forgotten</h1></section>`
    : `<section class="hero">
        <div class="eyebrow">${esc(formatDate(todayISO(), { weekday: 'long', month: 'long', day: 'numeric' }))}</div>
        <h1>${greeting()}.<br>Here’s what you’re pursuing.</h1>
      </section>
      <div class="summary">
        <div><strong>${all.length}</strong><span>${all.length === 1 ? 'Target' : 'Targets'}</span></div>
        <div><strong>${stepsDone}</strong><span>Steps done</span></div>
        <div><strong>${weekLogs}</strong><span>This week</span></div>
      </div>`;

  if (!list.length) {
    return hero + `<div class="empty">
      <div class="big">${state.showArchived ? 'Nothing archived' : 'No targets yet'}</div>
      ${state.showArchived ? '' : '<p>Tap <strong>+</strong> to add what you’re pursuing.</p>'}
    </div>`;
  }

  return hero + list.map(t => {
    const s = statusOf(t);
    const next = nextStep(t);
    let extra = '';
    if (t.kind === 'library') {
      const books = t.books.slice(-28);
      extra = books.length
        ? `<div class="mini-shelf" aria-hidden="true">${books.map(b =>
            `<i style="background:${spineColor(b)};height:${16 + (hash(b.title) % 10)}px;${b.status === 'wishlist' ? 'opacity:.3' : ''}"></i>`).join('')}</div>
           <div class="next">${plural(libraryStats(t).owned, 'book')} on the shelf · ${libraryStats(t).annotated} annotated</div>`
        : `<div class="next">Your shelf is ready for its first book.</div>`;
    } else if (t.cadence) {
      extra = `<div class="next">${thisWeekCount(t)} of ${t.cadence} this week</div>`;
    }
    return `<button class="card target-card" data-open="${t.id}" style="--cat:${catColor(t)}">
      ${ring(progressOf(t))}
      <div class="body">
        <div class="tags">
          ${t.category ? `<span class="chip">${esc(t.category)}</span>` : ''}
          <span class="chip ${s.cls}">${esc(s.label)}</span>
        </div>
        <h3>${esc(t.title)}</h3>
        ${next ? `<div class="next">Next: <b>${esc(next.text)}</b></div>` : ''}
        ${extra}
      </div>
    </button>`;
  }).join('');
}

function renderDetail(t) {
  const p = progressOf(t);
  const s = statusOf(t);
  const link = safeUrl(t.link);
  const color = catColor(t);

  const hero = `<section class="detail-hero">
    <div class="tags">
      ${t.category ? `<span class="chip">${esc(t.category)}</span>` : ''}
      <span class="chip ${s.cls}">${esc(s.label)}</span>
    </div>
    <h1>${esc(t.title)}</h1>
    ${t.why ? `<p class="why">“${esc(t.why)}”</p>` : ''}
    <div class="dates">
      ${t.startDate ? `<span>Start · ${formatDate(t.startDate)}</span>` : ''}
      ${t.targetDate ? `<span>Target · ${formatDate(t.targetDate)}</span>` : ''}
    </div>
    <div class="bar"><span style="width:${p}%"></span></div>
    <div class="muted">${p}% of steps done</div>
    ${link ? `<div class="actions"><a class="link-btn" href="${esc(link)}" target="_blank" rel="noopener">Open link ↗</a></div>` : ''}
  </section>`;

  const body = t.kind === 'library' ? renderLibrary(t) : renderActivityStats(t);

  return `<div style="--cat:${color}">
    ${hero}
    ${body}
    ${renderSteps(t)}
    ${renderLog(t)}
    <div class="actions">
      <button class="ghost" data-edit="${t.id}">Edit target</button>
      <button class="ghost" data-archive="${t.id}">${t.archived ? 'Unarchive' : 'Archive'}</button>
      <button class="danger" data-delete="${t.id}">Delete</button>
    </div>
  </div>`;
}

function renderActivityStats(t) {
  const week = thisWeekCount(t);
  const dots = t.cadence
    ? `<section class="card rhythm">
        <div><div class="muted">Weekly rhythm</div><strong>${t.cadence}× per week</strong></div>
        <div class="week-dots" aria-label="${week} of ${t.cadence} this week">${
          Array.from({ length: Math.max(t.cadence, week) }, (_, i) => `<i class="${i < week ? 'on' : ''}"></i>`).join('')
        }</div>
      </section>`
    : '';
  return `<div class="stats">
      <div class="card stat"><strong>${t.cadence ? `${week}/${t.cadence}` : week}</strong><span>This week</span></div>
      <div class="card stat"><strong>${weekStreak(t)}</strong><span>Week streak</span></div>
      <div class="card stat"><strong>${t.log.length}</strong><span>Total logged</span></div>
    </div>
    ${dots}
    <div class="actions"><button class="primary" data-log="${t.id}">+ Log progress</button></div>`;
}

function renderLibrary(t) {
  const st = libraryStats(t);
  const filters = [['all', 'All'], ['shelf', 'On shelf'], ['reading', 'Reading'], ['annotated', 'Annotated'], ['keepers', 'Keepers'], ['wishlist', 'Wishlist']];
  const f = state.shelfFilter;
  const books = t.books.filter(b =>
    f === 'all' ? true : f === 'keepers' ? b.keeper : b.status === f);

  const shelf = books.length
    ? `<div class="shelf">${books.map(b => {
        const h = 128 + (hash(b.title) % 40);
        const w = 34 + (hash(b.author + b.title) % 16);
        return `<div class="slot"><button class="spine ${b.status === 'wishlist' ? 'wishlist' : ''}" data-book="${b.id}"
          style="--spine:${spineColor(b)};height:${h}px;width:${w}px"
          title="${esc(b.title)}${b.author ? ' — ' + esc(b.author) : ''}">
          ${b.keeper ? '<span class="star" aria-label="Keeper">★</span>' : ''}
          ${b.status === 'annotated' ? '<span class="flag" aria-label="Annotated"></span>' : ''}
          <span class="t">${esc(b.title)}</span>
        </button></div>`;
      }).join('')}</div>`
    : `<div class="shelf-empty">
        <div class="big">${t.books.length ? 'No books here yet' : 'An empty shelf, full of promise'}</div>
        <p>${t.books.length ? 'Try another filter.' : 'Add the books you own, the ones you’re marking up, and the ones you want.'}</p>
      </div>`;

  const reading = st.reading.length
    ? `<div class="section-head"><h2>Reading now</h2></div>
       <div class="reading-now">${st.reading.map(b => `
        <button class="card book-row" data-book="${b.id}" style="--spine:${spineColor(b)}">
          <div class="cover"></div>
          <div>
            <div class="title">${esc(b.title)}</div>
            <div class="muted">${esc(b.author || '')}${b.marks?.length ? ` · ${plural(b.marks.length, 'passage')} marked` : ''}</div>
          </div>
        </button>`).join('')}</div>`
    : '';

  return `<div class="stats">
      <div class="card stat"><strong>${st.owned}</strong><span>On the shelf</span></div>
      <div class="card stat"><strong>${st.annotated}</strong><span>Annotated</span></div>
      <div class="card stat"><strong>${st.keepers}</strong><span>Keepers</span></div>
    </div>
    <div class="section-head">
      <h2>Bookshelf</h2>
      <button class="primary small" data-addbook="${t.id}">+ Add book</button>
    </div>
    <div class="filters" role="tablist">${filters.map(([k, label]) =>
      `<button data-filter="${k}" class="${f === k ? 'on' : ''}" role="tab" aria-selected="${f === k}">${label}</button>`).join('')}</div>
    <div class="shelf-wrap">${shelf}</div>
    <div class="legend">
      <span><i style="background:var(--gold)"></i>Ribbon = annotated</span>
      <span>★ = keeper</span>
      <span><i style="border:1.5px dashed var(--muted)"></i>Outline = wishlist</span>
    </div>
    ${reading}`;
}

function renderSteps(t) {
  return `<div class="section-head"><h2>Steps</h2><span class="muted">${t.milestones.filter(m => m.done).length}/${t.milestones.length}</span></div>
  <section class="card">
    ${t.milestones.length ? `<ul class="milestones">${t.milestones.map(m => `
      <li class="${m.done ? 'done' : ''}">
        <input type="checkbox" class="tick" data-toggle="${m.id}" ${m.done ? 'checked' : ''} aria-label="Mark step done">
        <span>${esc(m.text)}</span>
        <button class="x-btn" data-delstep="${m.id}" aria-label="Remove step">×</button>
      </li>`).join('')}</ul>` : '<p class="muted">No steps yet.</p>'}
    <form class="add-row" data-addstep="${t.id}">
      <input name="step" placeholder="Add a step…" required>
      <button class="ghost small" type="submit">Add</button>
    </form>
  </section>`;
}

function renderLog(t) {
  const log = [...t.log].sort((a, b) => b.date.localeCompare(a.date));
  const emptyMsg = t.kind === 'library'
    ? 'Finished annotating a book? Mark it Annotated and it shows up here.'
    : 'Nothing logged yet. Every post, sermon or study session counts.';
  return `<div class="section-head"><h2>Activity</h2>${t.kind === 'library' ? `<button class="ghost small" data-log="${t.id}">+ Log</button>` : ''}</div>
  <section class="card">
    ${log.length ? `<ul class="log">${log.map(e => `
      <li>
        <div class="date">${formatDate(e.date, { month: 'short', day: 'numeric' })}</div>
        <div class="body">
          ${esc(e.note)}
          ${e.tag || safeUrl(e.link) ? `<div class="tags">
            ${e.tag ? `<span class="chip">${esc(e.tag)}</span>` : ''}
            ${safeUrl(e.link) ? `<a class="muted" href="${esc(e.link)}" target="_blank" rel="noopener">View ↗</a>` : ''}
          </div>` : ''}
        </div>
        <button class="x-btn" data-dellog="${e.id}" aria-label="Remove entry">×</button>
      </li>`).join('')}</ul>` : `<p class="muted">${emptyMsg}</p>`}
  </section>`;
}

// ---------- target dialog ----------

function openTargetDialog(id = null) {
  state.editingId = id;
  const form = $('#targetForm');
  form.reset();
  const t = id ? findTarget(id) : null;
  $('#targetDialogTitle').textContent = t ? 'Edit target' : 'New target';
  if (t) {
    form.title.value = t.title;
    form.category.value = t.category || '';
    form.kind.value = t.kind || 'standard';
    form.why.value = t.why || '';
    form.startDate.value = t.startDate || '';
    form.targetDate.value = t.targetDate || '';
    form.cadence.value = t.cadence || '';
    form.link.value = t.link || '';
    form.milestones.value = t.milestones.map(m => m.text).join('\n');
  } else {
    form.startDate.value = todayISO();
  }
  const cats = [...new Set(state.targets.map(x => x.category).filter(Boolean))];
  $('#categoryList').innerHTML = cats.map(c => `<option value="${esc(c)}">`).join('');
  $('#targetDialog').showModal();
}

$('#targetForm').addEventListener('submit', e => {
  const f = e.target;
  const lines = f.milestones.value.split('\n').map(s => s.trim()).filter(Boolean);
  const data = {
    title: f.title.value.trim(),
    category: f.category.value.trim(),
    kind: f.kind.value,
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
    const t = normalize({ id: uid(), ...data, milestones: lines.map(text => ({ id: uid(), text, done: false })), archived: false, createdAt: new Date().toISOString() });
    state.targets.unshift(t);
    state.view = { name: 'detail', id: t.id };
  }
  save();
  render();
});

// ---------- log dialog ----------

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

// ---------- book dialog ----------

function currentBook() {
  const t = state.book && findTarget(state.book.targetId);
  return t && state.book.bookId ? t.books.find(b => b.id === state.book.bookId) : null;
}

function renderMarks() {
  const b = currentBook();
  $('#marksSection').hidden = !b;
  if (!b) return;
  $('#marksList').innerHTML = (b.marks || []).map(m => `
    <li><span>“${esc(m.text)}”</span>${m.page ? `<small>p. ${esc(m.page)}</small>` : ''}
    <button type="button" class="x-btn" data-delmark="${m.id}" aria-label="Remove passage">×</button></li>`).join('');
}

function openBookDialog(targetId, bookId = null) {
  state.book = { targetId, bookId };
  const f = $('#bookForm');
  f.reset();
  const b = currentBook();
  $('#bookDialogTitle').textContent = b ? 'Book' : 'Add a book';
  $('#deleteBookBtn').hidden = !b;
  if (b) {
    f.title.value = b.title;
    f.author.value = b.author || '';
    f.format.value = b.format || 'physical';
    f.status.value = b.status || 'shelf';
    f.keeper.checked = !!b.keeper;
    f.notes.value = b.notes || '';
  } else {
    f.status.value = 'shelf';
  }
  $('#markText').value = '';
  $('#markPage').value = '';
  renderMarks();
  $('#bookDialog').showModal();
}

$('#bookForm').addEventListener('submit', e => {
  const f = e.target;
  const t = findTarget(state.book.targetId);
  const data = {
    title: f.title.value.trim(),
    author: f.author.value.trim(),
    format: f.format.value,
    status: f.status.value,
    keeper: f.keeper.checked,
    notes: f.notes.value.trim(),
  };
  let b = currentBook();
  const wasAnnotated = b?.status === 'annotated';
  if (b) {
    Object.assign(b, data);
  } else {
    b = { id: uid(), ...data, marks: [], addedAt: todayISO() };
    t.books.push(b);
  }
  if (b.status === 'annotated' && !wasAnnotated) {
    b.annotatedAt = todayISO();
    t.log.push({ id: uid(), date: todayISO(), note: `Finished annotating “${b.title}”`, tag: b.author, link: '' });
    toast('Another book marked and made your own ✦');
  } else {
    toast(currentBook() ? 'Saved' : 'Added to your library');
  }
  save();
  render();
});

function addMark() {
  const b = currentBook();
  const text = $('#markText').value.trim();
  if (!b || !text) return;
  (b.marks ||= []).push({ id: uid(), text, page: $('#markPage').value.trim() });
  $('#markText').value = '';
  $('#markPage').value = '';
  save();
  renderMarks();
  $('#markText').focus();
}

$('#addMarkBtn').addEventListener('click', addMark);
$('#markText').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addMark(); } });
$('#markPage').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addMark(); } });

$('#marksList').addEventListener('click', e => {
  const id = e.target.closest('[data-delmark]')?.dataset.delmark;
  const b = currentBook();
  if (!id || !b) return;
  b.marks = b.marks.filter(m => m.id !== id);
  save();
  renderMarks();
});

$('#deleteBookBtn').addEventListener('click', () => {
  const b = currentBook();
  if (!b || !confirm(`Remove “${b.title}” from your library?`)) return;
  const t = findTarget(state.book.targetId);
  t.books = t.books.filter(x => x.id !== b.id);
  save();
  $('#bookDialog').close();
  render();
});

document.querySelectorAll('[data-close]').forEach(btn =>
  btn.addEventListener('click', () => btn.closest('dialog').close()));

// ---------- events ----------

$('#app').addEventListener('click', e => {
  const el = e.target.closest('[data-open],[data-log],[data-edit],[data-archive],[data-delete],[data-delstep],[data-dellog],[data-addbook],[data-book],[data-filter]');
  if (!el) return;
  const d = el.dataset;
  const t = state.view.name === 'detail' ? findTarget(state.view.id) : null;

  if (d.open) {
    state.view = { name: 'detail', id: d.open };
    state.shelfFilter = 'all';
    window.scrollTo(0, 0);
    return render();
  }
  if (d.log) return openLogDialog(d.log);
  if (d.edit) return openTargetDialog(d.edit);
  if (d.addbook) return openBookDialog(d.addbook);
  if (d.book && t) return openBookDialog(t.id, d.book);
  if (d.filter) { state.shelfFilter = d.filter; return render(); }
  if (d.archive) {
    const a = findTarget(d.archive);
    a.archived = !a.archived;
    save();
    state.view = { name: 'list' };
    toast(a.archived ? 'Archived' : 'Restored');
    return render();
  }
  if (d.delete) {
    if (!confirm('Delete this target and everything in it? This cannot be undone.')) return;
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
$('#backBtn').addEventListener('click', () => { state.view = { name: 'list' }; window.scrollTo(0, 0); render(); });
$('#menuBtn').addEventListener('click', () => $('#menuDialog').showModal());

window.addEventListener('scroll', () => {
  $('.topbar').classList.toggle('scrolled', window.scrollY > 40);
}, { passive: true });

$('#toggleArchived').addEventListener('click', () => {
  state.showArchived = !state.showArchived;
  state.view = { name: 'list' };
  $('#menuDialog').close();
  render();
});

$('#exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), targets: state.targets }, null, 2)], { type: 'application/json' });
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
    state.targets = targets.map(normalize);
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
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2000);
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
