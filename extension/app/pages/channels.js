import { getSavedChannels, updateChannelGroup, removeFromQueue } from '../../shared/storage.js';
import { showToast } from '../components/toast.js';

export function render(container) {
  container.innerHTML = `
    <div class="channels-page">
      <header class="page-header">
        <h1>Saved Channels</h1>
        <p class="page-subtitle">Organize your learning sources by grouping them.</p>
      </header>
      <div id="channelsContainer"></div>
    </div>
  `;
  renderChannels(container);
}

export function destroy() {
  // Nothing to clean up
}

function renderChannels(container) {
  const channels = getSavedChannels().sort((a, b) => b.savedAt - a.savedAt);
  const wrapper = container.querySelector('#channelsContainer');

  wrapper.innerHTML = '';
  if (channels.length === 0) {
    wrapper.innerHTML = '<p class="queue-list__empty">No saved channels yet. Visit a YouTube or Instagram channel page and click the extension to save it.</p>';
    return;
  }

  // Group channels
  const groups = {};
  channels.forEach((ch) => {
    const groupName = ch.group || 'Ungrouped';
    if (!groups[groupName]) groups[groupName] = [];
    groups[groupName].push(ch);
  });

  const sortedGroups = Object.keys(groups).sort((a, b) => {
    if (a === 'Ungrouped') return 1;
    if (b === 'Ungrouped') return -1;
    return a.localeCompare(b);
  });

  sortedGroups.forEach((groupName) => {
    const groupEl = document.createElement('div');
    groupEl.className = 'channel-group';
    groupEl.innerHTML = `<h2 class="channel-group__title">${escapeHtml(groupName)}</h2>`;

    const gridEl = document.createElement('div');
    gridEl.className = 'channel-grid';

    groups[groupName].forEach((ch) => {
      const card = document.createElement('div');
      card.className = 'channel-card';
      card.innerHTML = `
        <div class="channel-card__info">
          <h3><a href="${escapeHtml(ch.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(ch.title)}</a></h3>
          <p>${escapeHtml(ch.url)}</p>
        </div>
        <div class="channel-card__actions">
          <input type="text" class="channel-group-input" value="${escapeHtml(groupName)}" placeholder="Group name" data-id="${ch.id}" />
          <button class="btn btn--danger channel-remove-btn" data-id="${ch.id}">Remove</button>
        </div>
      `;
      gridEl.appendChild(card);
    });

    groupEl.appendChild(gridEl);
    wrapper.appendChild(groupEl);
  });

  // Attach events
  wrapper.querySelectorAll('.channel-group-input').forEach((input) => {
    input.addEventListener('change', (e) => {
      const newGroup = e.target.value.trim() || 'Ungrouped';
      const id = e.target.dataset.id;
      updateChannelGroup(id, newGroup);
      showToast(\`Moved to \${newGroup}\`);
      renderChannels(container);
    });
  });

  wrapper.querySelectorAll('.channel-remove-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.id;
      removeFromQueue(id);
      showToast('Channel removed');
      renderChannels(container);
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
