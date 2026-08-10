import React from 'react';
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { Flame, CheckCircle2, TrendingUp, Calendar, ArrowUpRight } from 'lucide-react-native';

export default function StatsScreen() {
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
            <Text style={{ fontSize: 32, fontWeight: '800', color: '#ffffff' }}>12</Text>
            <Text style={{ fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.9)' }}>Day Streak</Text>
          </View>

          <View style={{ 
            flex: 1, backgroundColor: '#ffffff', borderRadius: 20, padding: 20,
            shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 4
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <CheckCircle2 color="#16a34a" size={24} />
            </View>
            <Text style={{ fontSize: 32, fontWeight: '800', color: '#111827' }}>84%</Text>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#6B7280' }}>Completion</Text>
          </View>

        </View>

        {/* Weekly Chart Placeholder */}
        <View style={{ paddingHorizontal: 20, marginTop: 32 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 16 }}>Activity This Week</Text>
          
          <View style={{ 
            backgroundColor: '#ffffff', borderRadius: 20, padding: 24,
            shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 4
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 120 }}>
              {/* Bar Chart Mockup */}
              {[40, 70, 45, 90, 60, 30, 80].map((height, i) => (
                <View key={i} style={{ alignItems: 'center', width: '10%' }}>
                  <View style={{ width: 12, height: `${height}%`, backgroundColor: i === 3 ? '#16a34a' : '#E5E7EB', borderRadius: 6 }} />
                  <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 12, fontWeight: '600' }}>
                    {['M','T','W','T','F','S','S'][i]}
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
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>248</Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
              <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                <CheckCircle2 color="#16a34a" size={20} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#111827' }}>Total Processed</Text>
              </View>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>184</Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}>
              <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                <TrendingUp color="#D97706" size={20} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#111827' }}>Most Active Tag</Text>
              </View>
              <View style={{ backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151' }}>#design</Text>
              </View>
            </View>

          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
