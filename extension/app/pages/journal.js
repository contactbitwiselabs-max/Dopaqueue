import { getNotes, getQueue } from '../../shared/storage.js';
import { showToast } from '../components/toast.js';

let searchTerm = '';

export function render(container) {
  container.innerHTML = `
    <div class="card">
      <div class="journal__header">
        <h2>Journal</h2>
        <div class="journal__actions">
          <input type="text" id="journalSearch" placeholder="Search notes…" />
          <button class="btn" id="copyMarkdownBtn" type="button">Copy All as Markdown</button>
          <button class="btn" id="exportPdfBtn" type="button">Export as PDF</button>
        </div>
      </div>
      <div id="journalList"></div>
    </div>
  `;

  container.querySelector('#journalSearch').addEventListener('input', (e) => {
    searchTerm = e.target.value.toLowerCase();
    renderList(container);
  });

  container.querySelector('#copyMarkdownBtn').addEventListener('click', () => {
    copyAsMarkdown();
  });

  container.querySelector('#exportPdfBtn').addEventListener('click', () => {
    showToast('PDF export is coming soon.');
  });

  renderList(container);
}

export function destroy() {
  searchTerm = '';
}

function weekKey(date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  const monday = new Date(d);
  monday.setDate(d.getDate() - day);
  monday.setHours(0, 0, 0, 0);
  return monday.getTime();
}

function weekLabel(mondayTs) {
  const monday = new Date(mondayTs);
  const sunday = new Date(mondayTs);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `Week of ${fmt(monday)} – ${fmt(sunday)}`;
}

function getThumbnail(videoId) {
  const item = getQueue().find((q) => q.id === videoId);
  return item?.thumbnail || null;
}

function renderList(container) {
  const listEl = container.querySelector('#journalList');
  const notes = getNotes()
    .filter((note) => {
      if (!searchTerm) return true;
      return (
        note.videoTitle.toLowerCase().includes(searchTerm) ||
        note.text.toLowerCase().includes(searchTerm)
      );
    })
    .sort((a, b) => b.createdAt - a.createdAt);

  listEl.innerHTML = '';

  if (notes.length === 0) {
    listEl.innerHTML = '<p class="journal__empty">No notes match yet.</p>';
    return;
  }

  const groups = new Map();
  notes.forEach((note) => {
    const key = weekKey(note.createdAt);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(note);
  });

  const sortedWeeks = Array.from(groups.keys()).sort((a, b) => b - a);

  sortedWeeks.forEach((weekTs) => {
    const section = document.createElement('div');
    section.className = 'journal-week';
    section.innerHTML = `<h3 class="journal-week__label">${weekLabel(weekTs)}</h3>`;

    const entriesEl = document.createElement('div');
    entriesEl.className = 'journal-week__entries';

    groups.get(weekTs).forEach((note) => {
      const thumb = getThumbnail(note.videoId);
      const entry = document.createElement('div');
      entry.className = 'card journal-entry';
      entry.innerHTML = `
        ${thumb ? `<img class="journal-entry__thumb" src="${thumb}" alt="" />` : '<div class="journal-entry__thumb journal-entry__thumb--placeholder">🎬</div>'}
        <div class="journal-entry__body">
          <p class="journal-entry__title">${escapeHtml(note.videoTitle)}</p>
          <p class="journal-entry__text">${escapeHtml(note.text)}</p>
          <p class="journal-entry__date">${new Date(note.createdAt).toLocaleDateString()}</p>
        </div>
      `;
      entriesEl.appendChild(entry);
    });

    section.appendChild(entriesEl);
    listEl.appendChild(section);
  });
}

function copyAsMarkdown() {
  const notes = getNotes().slice().sort((a, b) => b.createdAt - a.createdAt);
  if (notes.length === 0) {
    showToast('No notes to export yet.');
    return;
  }

  const markdown = notes
    .map((note) => `### ${note.videoTitle}\n_${new Date(note.createdAt).toLocaleDateString()}_\n\n${note.text}\n`)
    .join('\n---\n\n');

  navigator.clipboard.writeText(markdown).then(
    () => showToast('Copied all notes as Markdown.'),
    () => showToast('Could not copy — clipboard permission denied.')
  );
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
