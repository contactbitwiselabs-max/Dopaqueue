const CATEGORY_FALLBACK = 'Uncategorized';

function formatDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function isDueToday(item) {
  return !item.watched && item.reminder && item.reminder <= Date.now();
}

// Renders one queue card and wires its action buttons. Callbacks are
// provided by the caller (pages/dashboard.js) so this module stays a pure
// renderer with no direct storage dependency.
export function renderVideoCard(item, { onWatch, onRemove, onSnooze }) {
  const el = document.createElement('div');
  el.className = 'card video-card';

  const thumb = item.thumbnail
    ? `<img class="video-card__thumb" src="${item.thumbnail}" alt="" />`
    : `<div class="video-card__thumb video-card__thumb--placeholder">🎬</div>`;

  el.innerHTML = `
    ${thumb}
    <div class="video-card__body">
      <p class="video-card__title">${escapeHtml(item.title)}</p>
      <p class="video-card__meta">
        ${item.channel ? escapeHtml(item.channel) + ' · ' : ''}${formatDate(item.savedAt)}
      </p>
      <div class="video-card__badges">
        <span class="badge">${escapeHtml(item.category || CATEGORY_FALLBACK)}</span>
        ${isDueToday(item) ? '<span class="badge badge--due">Due Today</span>' : ''}
        ${item.watched ? '<span class="badge">Watched</span>' : ''}
      </div>
      <div class="video-card__actions">
        <button class="btn btn--primary" data-action="watch">Watch Now</button>
        <button class="btn" data-action="snooze">Snooze</button>
        <button class="btn btn--danger" data-action="remove">Remove</button>
      </div>
    </div>
  `;

  el.querySelector('[data-action="watch"]').addEventListener('click', () => onWatch(item));
  el.querySelector('[data-action="remove"]').addEventListener('click', () => onRemove(item));
  el.querySelector('[data-action="snooze"]').addEventListener('click', () => onSnooze(item));

  return el;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
