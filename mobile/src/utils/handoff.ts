import * as Notifications from 'expo-notifications';
import { database } from '../database';
import QueueItem from '../database/models/QueueItem';
import { Q } from '@nozbe/watermelondb';

// This is a simulated WebSocket/Realtime listener for cross-device handoff.
// In a production environment, this would listen to Supabase Realtime events.
// Since we are offline-first, we mock the behavior by listening to WatermelonDB inserts.

export function initializeHandoffListener() {
  const queueItemsCollection = database.collections.get<QueueItem>('queue_items');

  // We observe the count of items. If it jumps unexpectedly (e.g. from a background sync),
  // we could trigger a push. Since WatermelonDB doesn't easily expose "source" of change 
  // (local vs remote) out of the box in simple observers, we simulate it here by 
  // polling or simply exposing a mock function for the demo.

  console.log('📱 Handoff Listener initialized. Waiting for cross-device saves...');
}

export async function simulateRemoteSave(url: string, title: string) {
  // 1. Simulate the item arriving in the local DB from a remote sync
  await database.write(async () => {
    await database.get<QueueItem>('queue_items').create(item => {
      item.url = url;
      item.title = title;
      item.savedAt = Date.now();
      item.watched = false;
      item.deleted = false;
      item.status = 'To Watch';
    });
  });

  // 2. Trigger a local notification to inform the user it arrived from Desktop
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Saved from Desktop 💻',
      body: `Ready to view on your phone: ${title || url}`,
      data: { url },
    },
    trigger: null, // trigger immediately
  });
}
