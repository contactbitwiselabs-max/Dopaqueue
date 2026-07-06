import { getSettings, setSettings, resetAllData, getQueue, getNotes } from '../../shared/storage.js';
import { supabaseClient } from '../../shared/supabase.js';
import { showToast } from '../components/toast.js';

const BUDGET_OPTIONS = [30, 60, 90, 120];

export function render(container) {
  const settings = getSettings();

  container.innerHTML = `
    <div class="card settings-card">
      <h2>Daily Budget</h2>
      <div class="settings__budget-options" id="budgetOptions">
        ${BUDGET_OPTIONS.map(
          (min) => `<button class="btn budget-option" data-minutes="${min}">${min} min</button>`
        ).join('')}
      </div>
    </div>

    <div class="card settings-card">
      <h2>BYOK AI Integration</h2>
      <p class="settings__hint">Used by History Analyzer (coming soon).</p>
      <label class="settings__label">Provider</label>
      <select id="aiProvider">
        <option value="gemini">Google Gemini</option>
        <option value="openai">OpenAI</option>
        <option value="claude">Anthropic Claude</option>
      </select>
      <label class="settings__label">API Key</label>
      <input type="password" id="aiApiKey" placeholder="sk-…" />
      <button class="btn btn--primary" id="saveAiBtn" type="button">Save</button>
    </div>

    <div class="card settings-card">
      <h2>Export Data</h2>
      <p class="settings__hint">Download your saved videos, channels, transcripts, and notes.</p>
      <div style="display: flex; gap: 8px; margin-top: 8px;">
        <button class="btn btn--primary" id="exportCsvBtn" type="button">Export to CSV (Excel)</button>
        <button class="btn btn--primary" id="exportMdBtn" type="button">Export to Markdown</button>
      </div>
    </div>

    <div class="card settings-card">
      <h2>Cloud Sync</h2>
      <p class="settings__hint">Sync your data across devices using Supabase.</p>
      <div id="syncStatus">Checking sync status...</div>
      <div style="margin-top: 12px; display: flex; gap: 8px;">
        <button class="btn btn--primary" id="syncNowBtn" style="display: none;">Sync Now</button>
        <button class="btn" id="signOutBtn" style="display: none;">Sign Out</button>
        <button class="btn btn--primary" id="signInBtn" style="display: none;">Sign In</button>
      </div>
    </div>

    <div class="card settings-card">
      <h2>Reset</h2>
      <p class="settings__hint">Clears all saved videos, notes, game progress, and settings.</p>
      <button class="btn btn--danger" id="resetBtn" type="button">Clear All Data</button>
    </div>
  `;

  highlightBudget(container, settings.dailyBudgetMinutes);

  container.querySelector('#aiProvider').value = settings.aiProvider;
  container.querySelector('#aiApiKey').value = settings.aiApiKey;

  const syncStatusEl = container.querySelector('#syncStatus');
  const syncNowBtn = container.querySelector('#syncNowBtn');
  const signOutBtn = container.querySelector('#signOutBtn');
  const signInBtn = container.querySelector('#signInBtn');

  supabaseClient.auth.getSession().then(({ data: { session } }) => {
    if (session) {
      syncStatusEl.textContent = `Signed in as ${session.user.email}`;
      syncNowBtn.style.display = 'block';
      signOutBtn.style.display = 'block';
    } else {
      syncStatusEl.textContent = 'Not signed in. Data is saved locally only.';
      signInBtn.style.display = 'block';
    }
  });

  signInBtn.addEventListener('click', () => {
    location.hash = '#/login';
  });

  signOutBtn.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    render(container); // re-render to update UI
    showToast('Signed out of cloud sync.');
  });

  syncNowBtn.addEventListener('click', async () => {
    syncNowBtn.disabled = true;
    syncNowBtn.textContent = 'Syncing...';
    try {
      const { syncWithCloud } = await import('../../shared/sync.js');
      await syncWithCloud();
      showToast('Sync complete!');
    } catch (err) {
      console.error(err);
      showToast('Sync failed: ' + err.message);
    } finally {
      syncNowBtn.disabled = false;
      syncNowBtn.textContent = 'Sync Now';
    }
  });

  container.querySelectorAll('.budget-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      const minutes = Number(btn.dataset.minutes);
      const updated = { ...getSettings(), dailyBudgetMinutes: minutes };
      setSettings(updated);
      highlightBudget(container, minutes);
      showToast(`Daily budget set to ${minutes} min. Takes effect on next reset.`);
    });
  });

  container.querySelector('#saveAiBtn').addEventListener('click', () => {
    const updated = {
      ...getSettings(),
      aiProvider: container.querySelector('#aiProvider').value,
      aiApiKey: container.querySelector('#aiApiKey').value,
    };
    setSettings(updated);
    showToast('AI settings saved.');
  });

  container.querySelector('#resetBtn').addEventListener('click', () => {
    if (confirm('This will permanently delete all your saved videos, notes, and progress. Continue?')) {
      resetAllData();
      render(container);
      showToast('All data cleared.');
    }
  });

  container.querySelector('#exportCsvBtn').addEventListener('click', handleExportCsv);
  container.querySelector('#exportMdBtn').addEventListener('click', handleExportMd);
}

export function destroy() {}

function highlightBudget(container, minutes) {
  container.querySelectorAll('.budget-option').forEach((btn) => {
    btn.classList.toggle('budget-option--active', Number(btn.dataset.minutes) === minutes);
  });
}

function escapeCsv(str) {
  if (str == null) return '""';
  const text = String(str).replace(/"/g, '""');
  return `"${text}"`;
}

function triggerDownload(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function handleExportCsv() {
  const queue = getQueue();
  const notes = getNotes();
  const headers = ['Type', 'Title', 'URL', 'Category/Group', 'Saved At', 'Watched', 'Note', 'Transcript'];
  const rows = [headers.map(escapeCsv).join(',')];

  queue.forEach(item => {
    const note = notes.find(n => n.videoId === item.id)?.text || '';
    const date = new Date(item.savedAt).toISOString();
    const catGroup = item.type === 'channel' ? item.group : item.category;
    
    // Some transcripts might be very long. We'll include them in full in CSV.
    const row = [
      item.type,
      item.title,
      item.url,
      catGroup,
      date,
      item.watched ? 'Yes' : 'No',
      note,
      item.transcript || ''
    ];
    rows.push(row.map(escapeCsv).join(','));
  });

  triggerDownload(rows.join('\n'), `dopaqueue_export_${Date.now()}.csv`, 'text/csv;charset=utf-8;');
}

function handleExportMd() {
  const queue = getQueue();
  const notes = getNotes();
  
  let md = `# DopaQueue Export\n\n`;
  
  // Channels
  const channels = queue.filter(q => q.type === 'channel');
  if (channels.length > 0) {
    md += `## Channels\n\n`;
    md += `| Group | Title | URL |\n|---|---|---|\n`;
    channels.forEach(ch => {
      md += `| ${ch.group || 'Ungrouped'} | ${ch.title.replace(/\|/g, '\\|')} | [Link](${ch.url}) |\n`;
    });
    md += `\n`;
  }

  // Videos
  const videos = queue.filter(q => q.type !== 'channel');
  if (videos.length > 0) {
    md += `## Videos\n\n`;
    videos.forEach(v => {
      md += `### [${v.title.replace(/[\[\]]/g, '')}](${v.url})\n`;
      md += `- **Category:** ${v.category || 'Uncategorized'}\n`;
      md += `- **Saved At:** ${new Date(v.savedAt).toLocaleString()}\n`;
      md += `- **Watched:** ${v.watched ? 'Yes' : 'No'}\n`;
      
      const note = notes.find(n => n.videoId === v.id);
      if (note) {
        md += `\n**Takeaway Note:**\n> ${note.text.split('\n').join('\n> ')}\n`;
      }
      if (v.transcript) {
        // limit transcript preview or include full? MD can handle full but it might be huge.
        md += `\n<details><summary>Transcript</summary>\n\n${v.transcript}\n\n</details>\n`;
      }
      md += `\n---\n\n`;
    });
  }

  triggerDownload(md, `dopaqueue_export_${Date.now()}.md`, 'text/markdown;charset=utf-8;');
}
