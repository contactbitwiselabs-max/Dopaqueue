import { QueueItem } from '../types';

export interface ExportOptions {
  format: 'markdown' | 'json' | 'csv' | 'notion' | 'readwise' | 'obsidian';
  includeContent?: boolean;
  includeThumbnails?: boolean;
  includeMetadata?: boolean;
  template?: string;
  filename?: string;
}

export interface ExportResult {
  success: boolean;
  data?: string;
  filename?: string;
  error?: string;
}

/**
 * Export queue items to various formats
 */
export class Exporter {
  private items: QueueItem[];
  private options: ExportOptions;

  constructor(items: QueueItem[], options: ExportOptions = { format: 'markdown' }) {
    this.items = items;
    this.options = options;
  }

  /**
   * Main export method
   */
  async export(): Promise<ExportResult> {
    try {
      switch (this.options.format) {
        case 'markdown':
          return this.exportMarkdown();
        case 'json':
          return this.exportJSON();
        case 'csv':
          return this.exportCSV();
        case 'notion':
          return this.exportNotion();
        case 'readwise':
          return this.exportReadwise();
        case 'obsidian':
          return this.exportObsidian();
        default:
          throw new Error(`Unsupported format: ${this.options.format}`);
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Export failed',
      };
    }
  }

  /**
   * Export to Markdown format
   */
  private exportMarkdown(): ExportResult {
    const lines: string[] = [];
    
    // Front matter
    lines.push('---');
    lines.push(`title: "DopaQueue Export"`);
    lines.push(`date: "${new Date().toISOString()}"`);
    lines.push(`items: ${this.items.length}`);
    lines.push('---');
    lines.push('');
    
    // Table of contents
    lines.push('# DopaQueue Export');
    lines.push('');
    lines.push(`Exported on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`);
    lines.push(`Total items: ${this.items.length}`);
    lines.push('');
    lines.push('## Table of Contents');
    lines.push('');
    
    this.items.forEach((item, index) => {
      const title = item.title || 'Untitled';
      const anchor = this.slugify(title);
      lines.push(`${index + 1}. [${title}](#${anchor})`);
    });
    lines.push('');
    lines.push('---');
    lines.push('');

    // Items
    this.items.forEach((item, index) => {
      const title = item.title || 'Untitled';
      const anchor = this.slugify(title);
      
      lines.push(`## ${index + 1}. ${title} {#${anchor}}`);
      lines.push('');
      
      if (this.options.includeMetadata) {
        lines.push('### Metadata');
        lines.push('');
        lines.push(`- **URL:** ${item.url}`);
        lines.push(`- **Platform:** ${item.platform || 'Unknown'}`);
        lines.push(`- **Type:** ${item.contentType || item.type || 'video'}`);
        lines.push(`- **Channel:** ${item.channel || 'N/A'}`);
        lines.push(`- **Author:** ${item.author || 'N/A'}`);
        lines.push(`- **Saved:** ${item.savedAt ? new Date(item.savedAt).toLocaleDateString() : 'N/A'}`);
        lines.push(`- **Tags:** ${item.tags?.join(', ') || 'None'}`);
        lines.push(`- **Urgency:** ${item.urgency || 0}`);
        lines.push(`- **Watched:** ${item.watched ? 'Yes' : 'No'}`);
        if (item.note) lines.push(`- **Note:** ${item.note}`);
        lines.push('');
      }
      
      if (this.options.includeContent && item.transcript) {
        lines.push('### Transcript');
        lines.push('');
        lines.push(item.transcript);
        lines.push('');
      }
      
      if (this.options.includeThumbnails && item.thumbnail) {
        lines.push('### Thumbnail');
        lines.push('');
        lines.push(`![${title}](${item.thumbnail})`);
        lines.push('');
      }
      
      lines.push('---');
      lines.push('');
    });
    
    const data = lines.join('\n');
    const filename = this.options.filename || `dopaqueue-export-${Date.now()}.md`;
    
    return { success: true, data, filename };
  }

  /**
   * Export to JSON format
   */
  private exportJSON(): ExportResult {
    const data = {
      exportInfo: {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        itemCount: this.items.length,
        source: 'DopaQueue',
      },
      items: this.items.map(item => ({
        id: item.id,
        title: item.title,
        url: item.url,
        platform: item.platform,
        contentType: item.contentType || item.type,
        channel: item.channel,
        author: item.author,
        authorUrl: item.authorUrl,
        thumbnail: item.thumbnail,
        savedAt: item.savedAt,
        updatedAt: item.updatedAt,
        tags: item.tags,
        note: item.note,
        transcript: this.options.includeContent ? item.transcript : undefined,
        urgency: item.urgency,
        watched: item.watched,
        tags: item.tags,
        group: item.group,
        priority: item.priority,
      })),
    };
    
    const dataStr = JSON.stringify(data, null, 2);
    const filename = this.options.filename || `dopaqueue-export-${Date.now()}.json`;
    
    return { success: true, data: dataStr, filename };
  }

  /**
   * Export to CSV format
   */
  private exportCSV(): ExportResult {
    const headers = [
      'Title',
      'URL',
      'Platform',
      'Type',
      'Channel',
      'Author',
      'Saved Date',
      'Tags',
      'Urgency',
      'Watched',
      'Note',
      'Transcript',
    ];
    
    const rows = this.items.map(item => [
      this.escapeCSV(item.title || 'Untitled'),
      this.escapeCSV(item.url),
      this.escapeCSV(item.platform || ''),
      this.escapeCSV(item.contentType || item.type || ''),
      this.escapeCSV(item.channel || ''),
      this.escapeCSV(item.author || ''),
      item.savedAt ? new Date(item.savedAt).toISOString() : '',
      this.escapeCSV(item.tags?.join('; ') || ''),
      item.urgency?.toString() || '0',
      item.watched ? 'Yes' : 'No',
      this.escapeCSV(item.note || ''),
      this.options.includeContent ? this.escapeCSV(item.transcript || '') : '',
    ]);
    
    const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const filename = this.options.filename || `dopaqueue-export-${Date.now()}.csv`;
    
    return { success: true, data: csv, filename };
  }

  /**
   * Export to Notion format (markdown with Notion-specific blocks)
   */
  private exportNotion(): ExportResult {
    const blocks: any[] = [];
    
    // Title page
    blocks.push({
      object: 'block',
      type: 'heading_1',
      heading_1: {
        rich_text: [{ type: 'text', text: { content: 'DopaQueue Export' } }],
      },
    });
    
    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{ 
          type: 'text', 
          text: { 
            content: `Exported from DopaQueue on ${new Date().toLocaleDateString()}. ${this.items.length} items.` 
          } 
        }],
      },
    });
    
    blocks.push({
      object: 'block',
      type: 'divider',
      divider: {},
    });
    
    this.items.forEach((item, index) => {
      const title = item.title || 'Untitled';
      
      // Item heading
      blocks.push({
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: `${index + 1}. ${item.title || 'Untitled'}` } }],
        },
      });
      
      // URL as link
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            { type: 'text', text: { content: 'URL: ' }, annotations: { bold: true } },
            { type: 'text', text: { content: item.url }, annotations: { link: { url: item.url } } },
          ],
        },
      });
      
      // Metadata
      const metadata = [
        `Platform: ${item.platform || 'Unknown'}`,
        `Type: ${item.contentType || item.type || 'video'}`,
        `Channel: ${item.channel || 'N/A'}`,
        `Author: ${item.author || 'N/A'}`,
        `Saved: ${item.savedAt ? new Date(item.savedAt).toLocaleDateString() : 'N/A'}`,
      ];
      
      if (item.tags?.length) {
        metadata.push(`Tags: ${item.tags.join(', ')}`);
      }
      
      if (item.note) {
        metadata.push(`Note: ${item.note}`);
      }
      
      blocks.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{ type: 'text', text: { content: metadata.join(' | ') } }],
        },
      });
      
      // Transcript
      if (this.options.includeContent && item.transcript) {
        blocks.push({
          object: 'block',
          type: 'heading_3',
          heading_3: {
            rich_text: [{ type: 'text', text: { content: 'Transcript' } }],
          },
        });
        
        // Split transcript into chunks for Notion (2000 char limit per block)
        const chunks = this.chunkText(item.transcript, 2000);
        chunks.forEach(chunk => {
          blocks.push({
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{ type: 'text', text: { content: chunk } }],
            },
          });
        });
      }
      
      // Divider between items
      if (index < this.items.length - 1) {
        blocks.push({
          object: 'block',
          type: 'divider',
          divider: {},
        });
      }
    });
    
    const data = JSON.stringify(blocks, null, 2);
    const filename = this.options.filename || `dopaqueue-notion-${Date.now()}.json`;
    
    return { success: true, data, filename };
  }

  /**
   * Export to Readwise format (highlights format)
   */
  private exportReadwise(): ExportResult {
    // Readwise expects highlights in a specific format
    const highlights = this.items.map((item, index) => {
      const text = this.options.includeContent && item.transcript 
        ? item.transcript 
        : item.note || item.title || 'Untitled';
      
      return {
        text: text,
        title: item.title || 'Untitled',
        author: item.author || item.channel || 'Unknown',
        source: 'DopaQueue',
        source_url: item.url,
        category: 'article',
        location: index + 1,
        location_type: 'page',
        note: item.note || '',
        tags: item.tags || [],
        read_at: item.savedAt ? new Date(item.savedAt).toISOString() : new Date().toISOString(),
        metadata: {
          platform: item.platform,
          content_type: item.contentType || item.type,
          channel: item.channel,
          urgency: item.urgency,
        },
      };
    });
    
    const data = JSON.stringify({ highlights }, null, 2);
    const filename = this.options.filename || `dopaqueue-readwise-${Date.now()}.json`;
    
    return { success: true, data, filename };
  }

  /**
   * Export to Obsidian format (markdown with frontmatter and wikilinks)
   */
  private exportObsidian(): ExportResult {
    const lines: string[] = [];
    
    // Vault-level index
    lines.push('---');
    lines.push('title: "DopaQueue Index"');
    lines.push('tags: [dopaqueue, index]');
    lines.push('---');
    lines.push('');
    lines.push('# DopaQueue Index');
    lines.push('');
    lines.push(`Created: ${new Date().toISOString().split('T')[0]}`);
    lines.push(`Items: ${this.items.length}`);
    lines.push('');
    lines.push('## Items');
    lines.push('');
    
    this.items.forEach((item, index) => {
      const title = item.title || 'Untitled';
      const safeTitle = this.sanitizeFilename(title);
      lines.push(`- [[${safeTitle}]]`);
    });
    lines.push('');
    lines.push('---');
    lines.push('');
    
    // Individual notes
    this.items.forEach((item, index) => {
      const title = item.title || 'Untitled';
      const safeTitle = this.sanitizeFilename(title);
      
      lines.push('---');
      lines.push(`title: "${this.escapeYAML(title)}"`);
      lines.push(`date: ${item.savedAt ? new Date(item.savedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}`);
      lines.push(`tags: [dopaqueue, ${item.platform?.toLowerCase() || 'video'}, ${item.contentType || item.type || 'video'}]`);
      lines.push(`source: "${this.escapeYAML(item.url)}"`);
      lines.push(`platform: "${item.platform || 'Unknown'}"`);
      lines.push(`channel: "${item.channel || 'N/A'}"`);
      lines.push(`type: "${item.contentType || item.type || 'video'}"`);
      if (item.tags?.length) {
        lines.push(`topics: [${item.tags.map(t => this.escapeYAML(t)).join(', ')}]`);
      }
      lines.push('---');
      lines.push('');
      lines.push(`# ${title}`);
      lines.push('');
      lines.push(`[Original](${item.url})`);
      lines.push('');
      
      if (this.options.includeMetadata) {
        lines.push('## Metadata');
        lines.push('');
        lines.push(`- **Platform:** ${item.platform || 'Unknown'}`);
        lines.push(`- **Type:** ${item.contentType || item.type || 'video'}`);
        lines.push(`- **Channel:** ${item.channel || 'N/A'}`);
        lines.push(`- **Author:** ${item.author || 'N/A'}`);
        lines.push(`- **Saved:** ${item.savedAt ? new Date(item.savedAt).toLocaleDateString() : 'N/A'}`);
        if (item.tags?.length) lines.push(`- **Tags:** ${item.tags.join(', ')}`);
        lines.push('');
      }
      
      if (item.note) {
        lines.push('## Notes');
        lines.push('');
        lines.push(item.note);
        lines.push('');
      }
      
      if (this.options.includeContent && item.transcript) {
        lines.push('## Transcript');
        lines.push('');
        lines.push(item.transcript);
        lines.push('');
      }
      
      lines.push('---');
      lines.push('');
    });
    
    // Create index file
    const indexContent = lines.join('\n');
    const filename = this.options.filename || `dopaqueue-obsidian-${Date.now()}.md`;
    
    return { success: true, data: indexContent, filename };
  }

  // Helper methods
  
  private escapeCSV(text: string): string {
    if (!text) return '';
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
      return '"' + text.replace(/"/g, '""') + '"';
    }
    return text;
  }

  private escapeYAML(text: string): string {
    return text.replace(/"/g, '\\"').replace(/\n/g, '\\n');
  }

  private sanitizeFilename(text: string): string {
    return text
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 100);
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/--+/g, '-')
      .trim();
  }

  private chunkText(text: string, maxLength: number): string[] {
    const chunks: string[] = [];
    let start = 0;
    
    while (start < text.length) {
      let end = start + maxLength;
      
      if (end < text.length) {
        // Try to break at a sentence boundary
        const lastPeriod = text.lastIndexOf('. ', end);
        if (lastPeriod > start) {
          end = lastPeriod + 1;
        }
      }
      
      chunks.push(text.slice(start, end).trim());
      start = end;
    }
    
    return chunks;
  }
}

/**
 * Convenience function to export items
 */
export async function exportItems(
  items: QueueItem[],
  format: ExportOptions['format'],
  options?: Partial<ExportOptions>
): Promise<ExportResult> {
  const exporter = new Exporter(items, { format, ...options } as ExportOptions);
  return exporter.export();
}

/**
 * Download exported data as file
 */
export function downloadExport(result: ExportResult): void {
  if (!result.success || !result.data) {
    console.error('Export failed:', result.error);
    return;
  }
  
  const blob = new Blob([result.data], { 
    type: getMimeType(result.filename || '') 
  });
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = result.filename || 'export';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    md: 'text/markdown',
    json: 'application/json',
    csv: 'text/csv',
    txt: 'text/plain',
  };
  return mimeTypes[ext || ''] || 'text/plain';
}

export default Exporter;