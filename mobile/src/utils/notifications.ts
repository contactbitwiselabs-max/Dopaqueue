import * as Notifications from 'expo-notifications';
import QueueItem from '../database/models/QueueItem';

export async function scheduleReminder(item: QueueItem, secondsFromNow: number) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Time to process your save! ⚡',
      body: `You set a reminder for: ${item.title || item.url}`,
      data: { url: item.url, id: item.id },
    },
    trigger: { 
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: secondsFromNow 
    },
  });
}

export async function scheduleWeeklyReview() {
  // In expo-notifications CalendarTriggerInput: weekday 1 = Sunday
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Weekly Review Time! 🏆',
      body: "Time to clear out your Dopaqueue inbox and process this week's saves.",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      weekday: 1, // 1 = Sunday in Expo
      hour: 18,
      minute: 0,
      repeats: true,
    },
  });
}
