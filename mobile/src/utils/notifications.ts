import * as Notifications from 'expo-notifications';
import QueueItem from '../database/models/QueueItem';

export async function scheduleReminder(item: QueueItem, secondsFromNow: number) {
  const trigger = new Date(Date.now() + secondsFromNow * 1000);
  
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Time to process your save! ⚡',
      body: `You set a reminder for: ${item.title || item.url}`,
      data: { url: item.url, id: item.id },
    },
    trigger,
  });
}
