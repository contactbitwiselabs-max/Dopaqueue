import React, { useState } from 'react';
import {
  View, Text, FlatList, SafeAreaView, TouchableOpacity, ScrollView,
} from 'react-native';
import withObservables from '@nozbe/with-observables';
import { database } from '../database';
import QueueItem from '../database/models/QueueItem';
import { Q } from '@nozbe/watermelondb';
import SaveItem from '../components/SaveItem';
import SaveDetailSheet from '../components/SaveDetailSheet';
import { LayoutGrid, SlidersHorizontal } from 'lucide-react-native';

// Filter pill definitions
const FILTERS = [
  { id: 'all',         label: 'All' },
  { id: 'unprocessed', label: 'Unprocessed' },
  { id: 'high',        label: '🔴 High' },
  { id: 'youtube',     label: 'YouTube' },
  { id: 'article',     label: 'Article' },
];

interface Props {
  queueItems: QueueItem[];
}

const InboxScreenComponent = ({ queueItems }: Props) => {
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null);

  const handleItemPress = (item: QueueItem) => {
    setSelectedItem(item);
  };

  const handleArchive = async (item: QueueItem) => {
    await database.write(async () => { await item.update(i => { i.watched = true; }); });
  };

  const handleDelete = async (item: QueueItem) => {
    await database.write(async () => { await item.update(i => { i.deleted = true; }); });
  };

  // Client-side filter
  const filteredItems = queueItems.filter(item => {
    if (activeFilter === 'all')         return true;
    if (activeFilter === 'unprocessed') return !item.watched;
    if (activeFilter === 'high')        return item.urgency === 'High' || item.urgency === 'Tomorrow';
    if (activeFilter === 'youtube')     return (item.url || '').toLowerCase().includes('youtube') || (item.url || '').toLowerCase().includes('youtu.be');
    if (activeFilter === 'article')     return item.platform === 'Article' || (item.url || '').toLowerCase().includes('medium') || (item.url || '').toLowerCase().includes('substack');
    return true;
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      {/* ── Header ── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
        <Text style={{ flex: 1, fontSize: 28, fontWeight: '800', color: '#111827' }}>Inbox</Text>
        <TouchableOpacity style={{ marginRight: 12 }}>
          <LayoutGrid color="#6B7280" size={22} />
        </TouchableOpacity>
        <TouchableOpacity>
          <SlidersHorizontal color="#6B7280" size={22} />
        </TouchableOpacity>
      </View>

      {/* ── Filter Pill Row ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12, flexDirection: 'row', alignItems: 'center' }}
      >
        {FILTERS.map((f, index) => {
          const active = activeFilter === f.id;
          return (
            <TouchableOpacity
              key={f.id}
              onPress={() => setActiveFilter(f.id)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 99,
                backgroundColor: active ? '#16a34a' : '#ffffff',
                borderWidth: 1,
                borderColor: active ? '#16a34a' : '#E5E7EB',
                marginRight: index < FILTERS.length - 1 ? 8 : 0,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: active ? '#ffffff' : '#374151' }}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── List or Empty State ── */}
      {filteredItems.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
          {/* Big green circle checkmark */}
          <View style={{
            width: 100, height: 100, borderRadius: 50,
            backgroundColor: '#DCFCE7',
            alignItems: 'center', justifyContent: 'center',
            marginBottom: 24,
          }}>
            <View style={{
              width: 72, height: 72, borderRadius: 36,
              backgroundColor: '#16a34a',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ fontSize: 36, color: '#fff' }}>✓</Text>
            </View>
          </View>
          <Text style={{ fontSize: 22, fontWeight: '800', color: '#111827', textAlign: 'center', marginBottom: 8 }}>
            You're all caught up!
          </Text>
          <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22 }}>
            Your dopamine budget{'\n'}is balanced.
          </Text>
          <TouchableOpacity
            style={{
              marginTop: 28,
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: '#16a34a',
              paddingHorizontal: 24, paddingVertical: 14,
              borderRadius: 99,
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>⚡ Smart Save Something</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <SaveItem
              item={item}
              onPress={handleItemPress}
              onArchive={handleArchive}
              onDelete={handleDelete}
            />
          )}
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ── Save Detail Bottom Sheet ── */}
      <SaveDetailSheet
        item={selectedItem}
        visible={!!selectedItem}
        onClose={() => setSelectedItem(null)}
      />
    </SafeAreaView>
  );
};

const enhance = withObservables([], () => ({
  queueItems: database.collections
    .get<QueueItem>('queue_items')
    .query(
      Q.where('deleted', false),
      Q.where('watched', false),
      Q.sortBy('saved_at', Q.desc)
    )
}));

export default enhance(InboxScreenComponent);
