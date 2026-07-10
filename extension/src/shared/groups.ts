// DopaQueue Channel Groups Module
// Manages grouping, categorization, and bulk operations on saved channels

import { getQueue, getSavedVideos, updateQueueItem } from './storage';
import { QueueItem } from '../types';

export interface GroupStats {
  name: string;
  totalItems: number;
  watchedItems: number;
  unwatchedItems: number;
  uniqueChannels: number;
  channels: string[];
}

export function getChannelGroups(): Map<string, QueueItem[]> {
  // Extract unique groups from saved items
  const items = getQueue();
  const groups = new Map<string, QueueItem[]>();

  for (const item of items) {
    if (item.group && !item.deleted) {
      if (!groups.has(item.group)) {
        groups.set(item.group, []);
      }
      groups.get(item.group)!.push(item);
    }
  }

  return groups;
}

export function getItemsByGroup(groupName: string): QueueItem[] {
  const items = getQueue();
  return items.filter((i) => i.group === groupName && !i.deleted);
}

export function getItemsByChannel(channelId: string): QueueItem[] {
  const items = getQueue();
  return items.filter(
    (i) =>
      (i.channel === channelId || i.channel?.includes(channelId)) &&
      !i.deleted
  );
}

export function groupItemsByChannel(): Map<string, QueueItem[]> {
  const videos = getSavedVideos();
  const byChannel = new Map<string, QueueItem[]>();

  for (const item of videos) {
    const ch = item.channel || 'Unknown';
    if (!byChannel.has(ch)) {
      byChannel.set(ch, []);
    }
    byChannel.get(ch)!.push(item);
  }

  return byChannel;
}

export function createChannelGroup(groupName: string, description = ''): Promise<any> {
  // Store group metadata in chrome.storage
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      resolve(null);
      return;
    }

    chrome.storage.local.get(['dq_channel_groups'], (res) => {
      const groups: Record<string, any> = res.dq_channel_groups || {};
      if (groups[groupName]) {
        resolve(groups[groupName]);
        return;
      }

      groups[groupName] = {
        id: crypto.randomUUID(),
        name: groupName,
        description,
        createdAt: Date.now(),
        items: [],
      };

      chrome.storage.local.set({ dq_channel_groups: groups }, () => {
        resolve(groups[groupName]);
      });
    });
  });
}

export function deleteChannelGroup(groupName: string): Promise<void> {
  // Remove group and ungroup all items in it
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      resolve();
      return;
    }

    chrome.storage.local.get(['dq_channel_groups'], (res) => {
      const groups: Record<string, any> = res.dq_channel_groups || {};
      delete groups[groupName];

      // Ungroup items
      const items = getItemsByGroup(groupName);
      for (const item of items) {
        updateQueueItem(item.id, { group: undefined });
      }

      chrome.storage.local.set({ dq_channel_groups: groups }, () => {
        resolve();
      });
    });
  });
}

export function addItemToGroup(itemId: string, groupName: string) {
  const items = getQueue();
  const item = items.find((i) => i.id === itemId);
  if (!item) return;

  updateQueueItem(itemId, { group: groupName });
}

export function removeItemFromGroup(itemId: string) {
  updateQueueItem(itemId, { group: undefined });
}

export function bulkAddToGroup(itemIds: string[], groupName: string) {
  for (const id of itemIds) {
    addItemToGroup(id, groupName);
  }
}

export function getGroupStats(groupName: string): GroupStats {
  const items = getItemsByGroup(groupName);
  const watched = items.filter((i) => i.watched).length;
  const total = items.length;

  // Get unique channels in group
  const channels = new Set(items.map((i) => i.channel).filter(Boolean) as string[]);

  return {
    name: groupName,
    totalItems: total,
    watchedItems: watched,
    unwatchedItems: total - watched,
    uniqueChannels: channels.size,
    channels: Array.from(channels),
  };
}

export function getAllGroupStats(): GroupStats[] {
  const groups = getChannelGroups();
  const stats: GroupStats[] = [];

  for (const [groupName] of groups) {
    stats.push(getGroupStats(groupName));
  }

  return stats;
}

// Export group as Markdown
export function exportGroupToMarkdown(groupName: string): string {
  const items = getItemsByGroup(groupName);
  const stats = getGroupStats(groupName);

  const lines = [
    `# ${groupName}`,
    '',
    `Items: ${stats.totalItems} (${stats.watchedItems} watched)`,
    `Channels: ${stats.uniqueChannels}`,
    '',
  ];

  if (stats.channels.length > 0) {
    lines.push('**Channels**:');
    stats.channels.forEach((ch) => lines.push(`- ${ch}`));
    lines.push('');
  }

  lines.push('| Title | Watched | Saved |');
  lines.push('|-------|---------|-------|');

  for (const item of items) {
    const title = (item.title || '').substring(0, 50);
    const watched = item.watched ? '✓' : '—';
    const saved = item.savedAt ? new Date(item.savedAt).toLocaleDateString() : '—';
    lines.push(`| [${title}](${item.url}) | ${watched} | ${saved} |`);
  }

  return lines.join('\n');
}
