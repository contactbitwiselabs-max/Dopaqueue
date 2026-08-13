import React, { useMemo } from 'react';
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Flame, CheckCircle2, TrendingUp, Calendar, ArrowUpRight, Trophy } from 'lucide-react-native';
import withObservables from '@nozbe/with-observables';
import { database } from '../database';
import QueueItem from '../database/models/QueueItem';
import { Q } from '@nozbe/watermelondb';
import { typography, spacing, borderRadius, shadows, useTheme } from '../constants/theme';
import { scheduleWeeklyReview } from '../utils/notifications';

interface Props {
  queueItems: QueueItem[];
}

const StatsScreenComponent = ({ queueItems }: Props) => {
  const { colors: themeColors } = useTheme();

  const { totalSaved, totalProcessed, completionRate, dayStreak, reviewScore, graphData, mostActiveTag } = useMemo(() => {
    const totalSaved = queueItems.length;
    const processedItems = queueItems.filter(item => item.watched);
    const totalProcessed = processedItems.length;
    const completionRate = totalSaved > 0 ? Math.round((totalProcessed / totalSaved) * 100) : 0;

    // Save Streak (Mock logic: if active in last 24h, streak continues)
    const activeRecently = queueItems.some(i => (Date.now() - i.savedAt) < 86400000);
    const dayStreak = activeRecently ? 4 : 0; // Mock current streak

    // Review Score: based on unprocessed items in the last 7 days
    const thisWeekItems = queueItems.filter(i => (Date.now() - i.savedAt) < 7 * 86400000);
    const unprocessedThisWeek = thisWeekItems.filter(i => !i.watched).length;
    let reviewScore = 'A+';
    if (unprocessedThisWeek > 5) reviewScore = 'B';
    if (unprocessedThisWeek > 15) reviewScore = 'C';
    if (unprocessedThisWeek > 30) reviewScore = 'F';

    // Most active tag
    const tagCounts: Record<string, number> = {};
    queueItems.forEach(item => {
      if (item.tags) {
        item.tags.split(',').forEach((t: string) => {
          const cleanTag = t.replace('#', '').trim();
          if (cleanTag) tagCounts[cleanTag] = (tagCounts[cleanTag] || 0) + 1;
        });
      }
    });
    let mostActiveTag = Object.keys(tagCounts).sort((a, b) => tagCounts[b] - tagCounts[a])[0] || 'none';

    // Graph data (last 7 days activity)
    const today = new Date();
    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const graphData = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - i));
      const dayName = days[d.getDay()];
      
      const itemsThisDay = queueItems.filter(item => {
        const itemDate = new Date(item.savedAt);
        return itemDate.getDate() === d.getDate() && itemDate.getMonth() === d.getMonth();
      }).length;
      
      return { day: dayName, height: Math.min(itemsThisDay * 20, 100) || 5 };
    });

    return { totalSaved, totalProcessed, completionRate, dayStreak, reviewScore, graphData, mostActiveTag };
  }, [queueItems]);

  const handleEnableWeeklyReview = async () => {
    await scheduleWeeklyReview();
    Alert.alert('Scheduled!', 'You will be notified every Sunday evening to review your Dopaqueue.');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        
        {/* Header */}
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
          <Text style={{ ...typography.h1, color: themeColors.text }}>Stats & Score</Text>
          <Text style={{ ...typography.body, color: themeColors.textMuted, marginTop: 4 }}>Your dopamine budget overview</Text>
        </View>

        {/* Big Highlight Cards */}
        <View style={{ flexDirection: 'row', paddingHorizontal: spacing.lg, gap: spacing.md, marginTop: spacing.md }}>
          
          <View style={{ 
            flex: 1, backgroundColor: themeColors.danger, borderRadius: borderRadius.xl, padding: spacing.lg,
            ...shadows.md, shadowColor: themeColors.danger
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
              <Flame color="#ffffff" size={24} fill="#ffffff" />
            </View>
            <Text style={{ fontSize: 32, fontWeight: '800', color: '#ffffff' }}>{dayStreak}</Text>
            <Text style={{ fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.9)' }}>Day Streak</Text>
          </View>

          <View style={{ 
            flex: 1, backgroundColor: themeColors.primary, borderRadius: borderRadius.xl, padding: spacing.lg,
            ...shadows.md, shadowColor: themeColors.primary
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
              <Trophy color="#ffffff" size={24} />
            </View>
            <Text style={{ fontSize: 32, fontWeight: '800', color: '#ffffff' }}>{reviewScore}</Text>
            <Text style={{ fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.9)' }}>Review Score</Text>
          </View>

        </View>

        {/* Weekly Chart */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xxl }}>
          <Text style={{ ...typography.h3, color: themeColors.text, marginBottom: spacing.md }}>Activity This Week</Text>
          
          <View style={{ 
            backgroundColor: themeColors.surface, borderRadius: borderRadius.xl, padding: spacing.xl,
            ...shadows.sm
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 120 }}>
              {graphData.map((data, i) => (
                <View key={i} style={{ alignItems: 'center', width: '10%' }}>
                  <View style={{ width: 12, height: `${data.height}%` as any, backgroundColor: i === 6 ? themeColors.primary : themeColors.border, borderRadius: 6 }} />
                  <Text style={{ ...typography.caption, color: themeColors.textMuted, marginTop: 12, fontWeight: '600' }}>
                    {data.day}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Weekly Review Prompt (Gamification) */}
        <TouchableOpacity
          onPress={handleEnableWeeklyReview}
          style={{
            marginHorizontal: spacing.lg, marginTop: spacing.xl,
            backgroundColor: themeColors.primaryLight, padding: spacing.lg, borderRadius: borderRadius.xl,
            flexDirection: 'row', alignItems: 'center'
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ ...typography.h3, color: themeColors.primaryDark, marginBottom: 4 }}>Weekly Review</Text>
            <Text style={{ ...typography.bodyMedium, color: themeColors.primaryDark, opacity: 0.8 }}>Turn on Sunday evening reminders to clear your Inbox.</Text>
          </View>
          <View style={{ width: 44, height: 44, backgroundColor: themeColors.primary, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
            <Calendar color="#fff" size={20} />
          </View>
        </TouchableOpacity>

        {/* Stats List */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xxl }}>
          <Text style={{ ...typography.h3, color: themeColors.text, marginBottom: spacing.md }}>All-Time Metrics</Text>
          
          <View style={{ backgroundColor: themeColors.surface, borderRadius: borderRadius.xl, overflow: 'hidden' }}>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: themeColors.border }}>
              <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: themeColors.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md }}>
                <ArrowUpRight color={themeColors.primaryDark} size={20} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...typography.bodyMedium, color: themeColors.text }}>Total Saved</Text>
              </View>
              <Text style={{ ...typography.h3, color: themeColors.text }}>{totalSaved}</Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: themeColors.border }}>
              <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: themeColors.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md }}>
                <CheckCircle2 color={themeColors.primaryDark} size={20} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...typography.bodyMedium, color: themeColors.text }}>Total Processed</Text>
              </View>
              <Text style={{ ...typography.h3, color: themeColors.text }}>{totalProcessed}</Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md }}>
              <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', marginRight: spacing.md }}>
                <TrendingUp color={themeColors.warning} size={20} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...typography.bodyMedium, color: themeColors.text }}>Most Active Tag</Text>
              </View>
              <View style={{ backgroundColor: themeColors.background, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: themeColors.border }}>
                <Text style={{ ...typography.caption, fontWeight: '600', color: themeColors.textMuted }}>#{mostActiveTag}</Text>
              </View>
            </View>

          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const enhance = withObservables([], () => ({
  queueItems: database.collections
    .get<QueueItem>('queue_items')
    .query(Q.where('deleted', false))
}));

export default enhance(StatsScreenComponent);
