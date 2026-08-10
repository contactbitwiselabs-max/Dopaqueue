import React, { useMemo } from 'react';
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { Flame, CheckCircle2, TrendingUp, Calendar, ArrowUpRight } from 'lucide-react-native';
import withObservables from '@nozbe/with-observables';
import { database } from '../database';
import QueueItem from '../database/models/QueueItem';
import { Q } from '@nozbe/watermelondb';

interface Props {
  queueItems: QueueItem[];
}

const StatsScreenComponent = ({ queueItems }: Props) => {
  const { totalSaved, totalProcessed, completionRate, dayStreak, graphData, mostActiveTag } = useMemo(() => {
    const totalSaved = queueItems.length;
    const processedItems = queueItems.filter(item => item.watched);
    const totalProcessed = processedItems.length;
    const completionRate = totalSaved > 0 ? Math.round((totalProcessed / totalSaved) * 100) : 0;

    // Day Streak (Very simple calculation for demo)
    let dayStreak = 0;
    if (totalSaved > 0) dayStreak = 1;

    // Most active tag
    const tagCounts: Record<string, number> = {};
    queueItems.forEach(item => {
      const match = item.note?.match(/#(\w+)/);
      if (match) {
        tagCounts[match[1]] = (tagCounts[match[1]] || 0) + 1;
      }
    });
    let mostActiveTag = Object.keys(tagCounts).sort((a, b) => tagCounts[b] - tagCounts[a])[0] || 'none';

    // Graph data (last 7 days activity - mock distribution over last 7 days based on real counts)
    const today = new Date();
    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const graphData = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - i));
      const dayName = days[d.getDay()];
      
      // Count items saved on this day
      const itemsThisDay = queueItems.filter(item => {
        const itemDate = new Date(item.savedAt);
        return itemDate.getDate() === d.getDate() && itemDate.getMonth() === d.getMonth();
      }).length;
      
      return { day: dayName, height: Math.min(itemsThisDay * 20, 100) || 5 }; // min height 5%
    });

    return { totalSaved, totalProcessed, completionRate, dayStreak, graphData, mostActiveTag };
  }, [queueItems]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        
        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
          <Text style={{ fontSize: 28, fontWeight: '800', color: '#111827' }}>Stats</Text>
          <Text style={{ fontSize: 15, color: '#6B7280', marginTop: 4 }}>Your dopamine budget overview</Text>
        </View>

        {/* Big Highlight Cards */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 20, gap: 16, marginTop: 12 }}>
          
          <View style={{ 
            flex: 1, backgroundColor: '#16a34a', borderRadius: 20, padding: 20,
            shadowColor: '#16a34a', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 6
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Flame color="#ffffff" size={24} fill="#ffffff" />
            </View>
            <Text style={{ fontSize: 32, fontWeight: '800', color: '#ffffff' }}>{dayStreak}</Text>
            <Text style={{ fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.9)' }}>Day Streak</Text>
          </View>

          <View style={{ 
            flex: 1, backgroundColor: '#ffffff', borderRadius: 20, padding: 20,
            shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 4
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <CheckCircle2 color="#16a34a" size={24} />
            </View>
            <Text style={{ fontSize: 32, fontWeight: '800', color: '#111827' }}>{completionRate}%</Text>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#6B7280' }}>Completion</Text>
          </View>

        </View>

        {/* Weekly Chart */}
        <View style={{ paddingHorizontal: 20, marginTop: 32 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 16 }}>Activity This Week</Text>
          
          <View style={{ 
            backgroundColor: '#ffffff', borderRadius: 20, padding: 24,
            shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 4
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 120 }}>
              {graphData.map((data, i) => (
                <View key={i} style={{ alignItems: 'center', width: '10%' }}>
                  <View style={{ width: 12, height: `${data.height}%` as any, backgroundColor: i === 6 ? '#16a34a' : '#E5E7EB', borderRadius: 6 }} />
                  <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 12, fontWeight: '600' }}>
                    {data.day}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Stats List */}
        <View style={{ paddingHorizontal: 20, marginTop: 32 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 16 }}>All-Time Metrics</Text>
          
          <View style={{ backgroundColor: '#ffffff', borderRadius: 20, overflow: 'hidden' }}>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
              <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                <ArrowUpRight color="#3B82F6" size={20} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#111827' }}>Total Saved</Text>
              </View>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>{totalSaved}</Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
              <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                <CheckCircle2 color="#16a34a" size={20} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#111827' }}>Total Processed</Text>
              </View>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>{totalProcessed}</Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}>
              <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                <TrendingUp color="#D97706" size={20} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#111827' }}>Most Active Tag</Text>
              </View>
              <View style={{ backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151' }}>#{mostActiveTag}</Text>
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
