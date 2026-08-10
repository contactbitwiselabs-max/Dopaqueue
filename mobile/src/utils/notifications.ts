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

export async function scheduleWeeklyReview() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Weekly Review Time! 🏆',
      body: 'Time to clear out your Dopaqueue inbox and process this week\'s saves.',
    },
    trigger: {
      weekday: 1, // Sunday
      hour: 18,   // 6:00 PM
      minute: 0,
      repeats: true,
    },
  });
}
