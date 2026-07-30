// DopaQueue Export Utilities
// Functions to export queue data to Markdown, CSV, Notion, etc.
import { QueueItem } from '../types';

export function exportToMarkdown(items: QueueItem[], title = 'DopaQueue'): string {
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
      lines.push(item.transcript || '');
      lines.push('');
    }
  }

  return lines.join('\n');
}

export function exportToCSV(items: QueueItem[]): string {
  const headers = ['Title', 'URL', 'Channel', 'Type', 'Saved Date', 'Watched', 'Description', 'Transcript Length'];
  const rows = items.map((item) => [
    escapeCSV(item.title || ''),
    escapeCSV(item.url || ''),
    escapeCSV(item.channel || ''),
    item.type || 'video',
    item.savedAt ? new Date(item.savedAt).toLocaleString() : '',
    item.watched ? 'Yes' : 'No',
    escapeCSV(item.description || ''),
    item.transcript ? item.transcript.length.toString() : '0',
  ]);

  const lines = [headers.map(escapeCSV).join(','), ...rows.map((r) => r.join(','))];
  return lines.join('\n');
}

function escapeCSV(str: string): string {
  if (!str) return '""';
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportToJSON(items: QueueItem[]): string {
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

// Generate Notion & Obsidian import format (markdown-like with metadata and tags)
export function exportToNotion(items: QueueItem[]): string {
  const lines: string[] = [];

  for (const item of items) {
    lines.push(`# ${item.title || 'Untitled'}`);
    lines.push(`- **URL**: ${item.url}`);
    lines.push(`- **Channel**: ${item.channel || '—'}`);
    lines.push(`- **Type**: ${item.type || 'video'}`);
    lines.push(`- **Saved**: ${item.savedAt ? new Date(item.savedAt).toLocaleString() : '—'}`);
    lines.push(`- **Watched**: ${item.watched ? 'Yes' : 'No'}`);
    if (item.tags && item.tags.length > 0) {
      lines.push(`- **Tags**: ${item.tags.map(t => `#${t}`).join(' ')}`);
    }
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

// Generate Obsidian markdown format (with YAML frontmatter)
export function exportToObsidian(items: QueueItem[]): string {
  const lines: string[] = [];

  for (const item of items) {
    // YAML Frontmatter
    lines.push('---');
    lines.push(`title: "${(item.title || 'Untitled').replace(/"/g, '\\"')}"`);
    lines.push(`url: "${item.url || ''}"`);
    lines.push(`channel: "${(item.channel || '—').replace(/"/g, '\\"')}"`);
    lines.push(`type: "${item.type || 'video'}"`);
    if (item.savedAt) {
      lines.push(`saved: "${new Date(item.savedAt).toISOString()}"`);
    }
    lines.push(`watched: ${item.watched ? 'true' : 'false'}`);
    if (item.tags && item.tags.length > 0) {
      lines.push('tags:');
      for (const tag of item.tags) {
        lines.push(`  - ${tag}`);
      }
    }
    if (item.collection) {
      lines.push(`collection: "${item.collection}"`);
    }
    lines.push('---');
    lines.push('');

    // Body
    lines.push(`# ${item.title || 'Untitled'}`);
    lines.push('');
    
    if (item.description || item.note || item.notes) {
      lines.push('## Notes');
      lines.push(item.note || item.notes || item.description || '');
      lines.push('');
    }
    
    if (item.transcript) {
      lines.push('## Content / Transcript');
      lines.push(item.transcript);
      lines.push('');
    }
    
    // Separator between items if multiple
    if (items.length > 1) {
      lines.push('---');
      lines.push('');
    }
  }

  return lines.join('\n');
}

// Download file helper
export function downloadFile(content: string, filename: string, mimeType = 'text/plain'): void {
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
export function buildExportFilename(format: string, title = 'DopaQueue'): string {
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const ext = format === 'csv' ? 'csv' : format === 'json' ? 'json' : 'md';
  return `${title}-${timestamp}.${ext}`;
}

// Custom Markdown / YAML frontmatter template formatter
export function formatWithTemplate(item: any, template: string): string {
  if (!template) return '';
  const title = item.title || 'Untitled';
  const url = item.url || '';
  const channel = item.channel || 'Unknown Channel';
  const date = item.savedAt ? new Date(item.savedAt).toISOString() : new Date().toISOString();
  const tags = Array.isArray(item.tags) ? item.tags.join(', ') : '';
  const summary = Array.isArray(item.aiSummary) ? item.aiSummary.map((s: string) => `- ${s}`).join('\n') : (item.aiSummary || 'No summary available.');
  const actions = Array.isArray(item.aiActions) ? item.aiActions.map((a: string) => `- [ ] ${a}`).join('\n') : (item.aiActions || 'No action items available.');
  const transcript = item.transcript || 'No transcript saved.';

  return template
    .replace(/\{\{title\}\}/g, title)
    .replace(/\{\{url\}\}/g, url)
    .replace(/\{\{channel\}\}/g, channel)
    .replace(/\{\{date\}\}/g, date)
    .replace(/\{\{tags\}\}/g, tags)
    .replace(/\{\{summary\}\}/g, summary)
    .replace(/\{\{actions\}\}/g, actions)
    .replace(/\{\{transcript\}\}/g, transcript);
}

// Push item to custom Webhook (Notion API / Obsidian Local REST API / Zapier / Make)
export async function pushToWebhook(webhookUrl: string, item: any, customTemplate: string | null = null): Promise<Response> {
  if (!webhookUrl) throw new Error('Webhook URL is required');
  
  const payload = {
    id: item.id || Date.now().toString(),
    title: item.title || 'Untitled',
    url: item.url || '',
    channel: item.channel || '',
    savedAt: item.savedAt || Date.now(),
    tags: item.tags || [],
    aiSummary: item.aiSummary || [],
    aiActions: item.aiActions || [],
    formattedContent: customTemplate ? formatWithTemplate(item, customTemplate) : null,
  };

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Webhook push failed with status ${response.status}`);
  }

  return response;
}
