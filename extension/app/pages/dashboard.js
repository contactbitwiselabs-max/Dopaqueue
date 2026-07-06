import { getSavedVideos, addToQueue, updateQueueItem, removeFromQueue, getNotes, addNote, subscribe } from '../../shared/storage.js';
import { awardForNote } from '../services/game.js';
import { extractYouTubeVideoId, SNOOZE_HOURS } from '../../shared/constants.js';
import { mountPlant } from '../components/plant.js';
import { renderVideoCard } from '../components/video-card.js';
import { openPlayer } from '../components/player.js';
import { showToast } from '../components/toast.js';

let plantHandle = null;
let watchingItemId = null;
let activePlayer = null;

let unsubQueue = null;
let unsubNotes = null;

export function render(container) {
  container.innerHTML = `
    <div class="dashboard-grid">
      <div id="gardenCol"></div>

      <div id="queueSection">
        <div class="card">
          <h2>Your Saved Videos <span id="queueCount" class="badge"></span></h2>
          <form id="addLinkForm" class="add-link-form">
            <input type="url" id="addLinkInput" placeholder="Paste a YouTube link…" required />
            <button class="btn btn--primary" type="submit">Add</button>
          </form>
          <div id="queueList" class="queue-list"></div>
        </div>
      </div>

      <div>
        <div class="card">
          <h2>Reflection</h2>
          <p class="note-form__prompt" id="notePrompt">Watch a video to unlock the takeaway prompt.</p>
          <textarea id="noteText" placeholder="What's your key takeaway from this video?" disabled></textarea>
          <button class="btn btn--primary" id="submitNoteBtn" type="button" disabled>Submit Takeaway</button>
          <h3 class="recent-notes__heading">Recent Notes</h3>
          <div id="recentNotes" class="recent-notes"></div>
        </div>
      </div>
    </div>
  `;

  plantHandle = mountPlant(container.querySelector('#gardenCol'));

  renderQueue(container);
  renderRecentNotes(container);

  unsubQueue = subscribe('dq_queue', () => renderQueue(container));
  unsubNotes = subscribe('dq_notes', () => renderRecentNotes(container));

  container.querySelector('#addLinkForm').addEventListener('submit', (e) => {
    e.preventDefault();
    handleAddLink(container);
  });

  container.querySelector('#submitNoteBtn').addEventListener('click', () => {
    handleSubmitNote(container);
  });
}

export function destroy() {
  activePlayer?.close();
  activePlayer = null;
  plantHandle = null;
  watchingItemId = null;
  if (unsubQueue) unsubQueue();
  if (unsubNotes) unsubNotes();
}

function handleAddLink(container) {
  const input = container.querySelector('#addLinkInput');
  const url = input.value.trim();
  if (!url) return;

  const videoId = extractYouTubeVideoId(url);
  if (!videoId) {
    showToast('Only YouTube links are supported right now.');
    return;
  }

  const existing = getSavedVideos().find((item) => item.url === url);
  if (existing) {
    showToast('Already in your queue.');
    return;
  }

  addToQueue({
    id: videoId,
    url,
    title: url,
    channel: null,
    thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    category: 'Uncategorized',
    savedAt: Date.now(),
    reminder: null,
    watched: false,
    noteId: null,
  });

  input.value = '';
  renderQueue(container);
  showToast('Saved to your queue.');
}

function renderQueue(container) {
  const queue = getSavedVideos().slice().sort((a, b) => b.savedAt - a.savedAt);
  const listEl = container.querySelector('#queueList');
  container.querySelector('#queueCount').textContent = queue.length;

  listEl.innerHTML = '';
  if (queue.length === 0) {
    listEl.innerHTML = '<p class="queue-list__empty">No saved videos yet — paste a link above to get started.</p>';
    return;
  }

  queue.forEach((item) => {
    const card = renderVideoCard(item, {
      onWatch: (video) => handleWatch(container, video),
      onRemove: (video) => {
        removeFromQueue(video.id);
        renderQueue(container);
      },
      onSnooze: (video) => {
        updateQueueItem(video.id, { reminder: Date.now() + SNOOZE_HOURS * 60 * 60 * 1000 });
        renderQueue(container);
        showToast(`Snoozed for ${SNOOZE_HOURS}h.`);
      },
    });
    listEl.appendChild(card);
  });
}

async function handleWatch(container, video) {
  activePlayer = await openPlayer(video.id, {
    onEnded: () => {
      watchingItemId = video.id;
      const prompt = container.querySelector('#notePrompt');
      const textarea = container.querySelector('#noteText');
      const submitBtn = container.querySelector('#submitNoteBtn');
      prompt.textContent = `What's your key takeaway from "${video.title}"?`;
      textarea.disabled = false;
      submitBtn.disabled = false;
      textarea.focus();
      container.querySelector('#queueSection').scrollIntoView({ behavior: 'smooth' });
    },
    onClose: () => {
      activePlayer = null;
    },
  });
}

function handleSubmitNote(container) {
  if (!watchingItemId) return;
  const textarea = container.querySelector('#noteText');
  const text = textarea.value.trim();
  if (!text) return;

  const video = getSavedVideos().find((item) => item.id === watchingItemId);

  const note = {
    id: `note_${Date.now()}`,
    videoId: watchingItemId,
    videoTitle: video?.title || 'Untitled video',
    text,
    createdAt: Date.now(),
    coinsEarned: 10,
  };

  addNote(note);
  updateQueueItem(watchingItemId, { watched: true, noteId: note.id });
  awardForNote();

  const gardenCol = container.querySelector('#gardenCol');
  gardenCol.querySelector('.plant-card__visual')?.classList.add('plant-bounce');
  setTimeout(() => gardenCol.querySelector('.plant-card__visual')?.classList.remove('plant-bounce'), 400);
  plantHandle?.refresh();

  textarea.value = '';
  textarea.disabled = true;
  container.querySelector('#submitNoteBtn').disabled = true;
  container.querySelector('#notePrompt').textContent = 'Watch a video to unlock the takeaway prompt.';
  watchingItemId = null;

  renderQueue(container);
  renderRecentNotes(container);
  showToast('+10 coins, +15 minutes restored 🌱');
}

function renderRecentNotes(container) {
  const notes = getNotes().slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
  const el = container.querySelector('#recentNotes');
  el.innerHTML = '';

  if (notes.length === 0) {
    el.innerHTML = '<p class="recent-notes__empty">No notes yet.</p>';
    return;
  }

  notes.forEach((note) => {
    const item = document.createElement('div');
    item.className = 'recent-note';
    item.innerHTML = `
      <p class="recent-note__title">${escapeHtml(note.videoTitle)}</p>
      <p class="recent-note__text">${escapeHtml(note.text)}</p>
      <p class="recent-note__date">${new Date(note.createdAt).toLocaleDateString()}</p>
    `;
    el.appendChild(item);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
