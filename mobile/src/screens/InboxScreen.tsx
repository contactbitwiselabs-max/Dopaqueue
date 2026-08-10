import React, { useState } from 'react';
import {
  View, Text, FlatList, SafeAreaView, TouchableOpacity, ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import withObservables from '@nozbe/with-observables';
import { database } from '../database';
import QueueItem from '../database/models/QueueItem';
import { Q } from '@nozbe/watermelondb';
import SaveItem from '../components/SaveItem';
import SaveDetailSheet from '../components/SaveDetailSheet';
import { LayoutGrid, SlidersHorizontal, Zap, List, KanbanSquare, Search } from 'lucide-react-native';
import { colors, typography, spacing, borderRadius } from '../constants/theme';
import EmptyInboxAnimation from '../components/EmptyInboxAnimation';
import SaveCardGallery from '../components/SaveCardGallery';
import SaveKanbanBoard from '../components/SaveKanbanBoard';

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
  const navigation = useNavigation<any>();
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'gallery' | 'board'>('list');

  const handleItemPress = (item: QueueItem) => setSelectedItem(item);
  
  const handleArchive = async (item: QueueItem) => {
    await database.write(async () => { await item.update(i => { i.watched = true; }); });
  };
  
  const handleDelete = async (item: QueueItem) => {
    await database.write(async () => { await item.update(i => { i.deleted = true; }); });
  };

  const handleLongPress = async (item: QueueItem) => {
    await database.write(async () => { await item.update(i => { i.isPinned = !i.isPinned; }); });
  };

  const toggleViewMode = () => {
    if (viewMode === 'list') setViewMode('gallery');
    else if (viewMode === 'gallery') setViewMode('board');
    else setViewMode('list');
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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
      {/* ── Header ── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md }}>
        <Text style={{ flex: 1, ...typography.h1, color: colors.text }}>Inbox</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Search')} style={{ marginRight: spacing.md }}>
          <Search color={colors.textMuted} size={22} />
        </TouchableOpacity>
        <TouchableOpacity onPress={toggleViewMode} style={{ marginRight: spacing.md }}>
          {viewMode === 'list' ? <List color={colors.textMuted} size={22} /> :
           viewMode === 'gallery' ? <LayoutGrid color={colors.textMuted} size={22} /> :
           <KanbanSquare color={colors.textMuted} size={22} />}
        </TouchableOpacity>
        <TouchableOpacity>
          <SlidersHorizontal color={colors.textMuted} size={22} />
        </TouchableOpacity>
      </View>

      {/* ── Filter Pill Row ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md, flexDirection: 'row', alignItems: 'center' }}
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
                borderRadius: borderRadius.full,
                backgroundColor: active ? colors.primary : colors.background,
                borderWidth: 1,
                borderColor: active ? colors.primary : colors.border,
                marginRight: index < FILTERS.length - 1 ? spacing.sm : 0,
              }}
            >
              <Text style={{ ...typography.bodyMedium, fontSize: 13, color: active ? colors.textLight : colors.textMuted }}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── List or Empty State ── */}
      {filteredItems.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxl }}>
          
          <EmptyInboxAnimation />

          <Text style={{ ...typography.h2, color: colors.text, textAlign: 'center', marginBottom: spacing.sm }}>
            You're all caught up!
          </Text>
          <Text style={{ ...typography.body, color: colors.textMuted, textAlign: 'center', lineHeight: 22 }}>
            Your dopamine budget{'\n'}is balanced.
          </Text>
          
          <TouchableOpacity
            style={{
              marginTop: spacing.xl,
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: colors.primary,
              paddingHorizontal: spacing.lg, paddingVertical: 14,
              borderRadius: borderRadius.full,
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            <Zap color={colors.textLight} size={18} fill={colors.textLight} style={{ marginRight: 6 }} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {viewMode === 'list' && (
            <FlatList
              data={filteredItems}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <SaveItem
                  item={item}
                  onPress={handleItemPress}
                  onLongPress={handleLongPress}
                  onArchive={handleArchive}
                  onDelete={handleDelete}
                />
              )}
              contentContainerStyle={{ paddingTop: spacing.xs, paddingBottom: 120 }}
              showsVerticalScrollIndicator={false}
            />
          )}
          {viewMode === 'gallery' && (
            <SaveCardGallery
              items={filteredItems}
              onPress={handleItemPress}
              onLongPress={handleLongPress}
            />
          )}
          {viewMode === 'board' && (
            <SaveKanbanBoard
              items={filteredItems}
              onPress={handleItemPress}
              onLongPress={handleLongPress}
            />
          )}
        </View>
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
      Q.sortBy('is_pinned', Q.desc),
      Q.sortBy('saved_at', Q.desc)
    )
}));

export default enhance(InboxScreenComponent);
