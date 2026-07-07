// DopaQueue Export Utilities
// Functions to export queue data to Markdown, CSV, Notion, etc.

export function exportToMarkdown(items, title = 'DopaQueue') {
  const lines = [
    `# ${title}`,
    '',
    `Exported on: ${new Date().toLocaleString()}`,
    '',
    '| Title | Channel | Type | Saved | Transcript | Notes |',
    '|-------|---------|------|-------|-----------|-------|',
  ];

  for (const item of items) {
    const title = (item.title || '').replace(/\|/g, '\\|');
    const channel = (item.channel || '—').replace(/\|/g, '\\|');
    const type = item.type || 'video';
    const saved = item.savedAt ? new Date(item.savedAt).toLocaleDateString() : '—';
    const hasTranscript = item.transcript ? '✓' : '—';
    const notes = (item.description || '').slice(0, 50).replace(/\|/g, '\\|');

    lines.push(`| [${title}](${item.url}) | ${channel} | ${type} | ${saved} | ${hasTranscript} | ${notes} |`);
  }

  // Add transcripts section if any item has one
  const itemsWithTranscript = items.filter((i) => i.transcript);
  if (itemsWithTranscript.length > 0) {
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## Transcripts');
    lines.push('');

    for (const item of itemsWithTranscript) {
      lines.push(`### ${item.title}`);
      lines.push(`**Channel**: ${item.channel || '—'}`);
      lines.push(`**URL**: ${item.url}`);
      lines.push(`**Saved**: ${new Date(item.savedAt).toLocaleString()}`);
      lines.push('');
      lines.push(item.transcript);
      lines.push('');
    }
  }

  return lines.join('\n');
}

export function exportToCSV(items) {
  const headers = ['Title', 'URL', 'Channel', 'Type', 'Saved Date', 'Watched', 'Description', 'Transcript Length'];
  const rows = items.map((item) => [
    escapeCSV(item.title || ''),
    escapeCSV(item.url || ''),
    escapeCSV(item.channel || ''),
    item.type || 'video',
    item.savedAt ? new Date(item.savedAt).toLocaleString() : '',
    item.watched ? 'Yes' : 'No',
    escapeCSV(item.description || ''),
    item.transcript ? item.transcript.length : 0,
  ]);

  const lines = [headers.map(escapeCSV).join(','), ...rows.map((r) => r.join(','))];
  return lines.join('\n');
}

function escapeCSV(str) {
  if (!str) return '""';
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportToJSON(items) {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      itemCount: items.length,
      items,
    },
    null,
    2
  );
}

// Generate Notion import format (markdown-like with metadata)
export function exportToNotion(items) {
  const lines = [];

  for (const item of items) {
    lines.push(`# ${item.title || 'Untitled'}`);
    lines.push(`- **URL**: ${item.url}`);
    lines.push(`- **Channel**: ${item.channel || '—'}`);
    lines.push(`- **Type**: ${item.type || 'video'}`);
    lines.push(`- **Saved**: ${item.savedAt ? new Date(item.savedAt).toLocaleString() : '—'}`);
    lines.push(`- **Watched**: ${item.watched ? 'Yes' : 'No'}`);
    if (item.description) {
      lines.push(`- **Notes**: ${item.description}`);
    }
    if (item.transcript) {
      lines.push('');
      lines.push('## Transcript');
      lines.push(item.transcript);
    }
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

// Download file helper
export function downloadFile(content, filename, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Build filename with timestamp
export function buildExportFilename(format, title = 'DopaQueue') {
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const ext = format === 'csv' ? 'csv' : format === 'json' ? 'json' : 'md';
  return `${title}-${timestamp}.${ext}`;
}
