import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ScrollView, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import withObservables from '@nozbe/with-observables';
import { database } from '../database';
import QueueItem from '../database/models/QueueItem';
import { Q } from '@nozbe/watermelondb';
import SaveItem from '../components/SaveItem';
import SaveDetailSheet from '../components/SaveDetailSheet';
import { LayoutGrid, SlidersHorizontal, List, KanbanSquare, Search, X } from 'lucide-react-native';
import { typography, spacing, borderRadius, useTheme } from '../constants/theme';
import EmptyInboxAnimation from '../components/EmptyInboxAnimation';
import SaveCardGallery from '../components/SaveCardGallery';
import SaveKanbanBoard from '../components/SaveKanbanBoard';

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
  const { colors: themeColors } = useTheme();

  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'gallery' | 'board'>('list');
  const [filtersModalVisible, setFiltersModalVisible] = useState(false);

  // Custom filter state
  const [customPlatform, setCustomPlatform] = useState<string | null>(null);
  const [customUrgency, setCustomUrgency] = useState<string | null>(null);

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

  // Advanced Filtering
  const filteredItems = queueItems.filter(item => {
    // If we have custom filters active, apply them first
    if (customPlatform && item.platform !== customPlatform) return false;
    if (customUrgency && item.urgency !== customUrgency) return false;

    // Standard Quick Filters
    if (activeFilter === 'all')         return true;
    if (activeFilter === 'unprocessed') return !item.watched;
    if (activeFilter === 'high')        return item.urgency === 'High' || item.urgency === 'Tomorrow';
    if (activeFilter === 'youtube')     return (item.url || '').toLowerCase().includes('youtube') || (item.url || '').toLowerCase().includes('youtu.be');
    if (activeFilter === 'article')     return item.platform === 'Article' || (item.url || '').toLowerCase().includes('medium') || (item.url || '').toLowerCase().includes('substack');
    return true;
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.surface }}>
      {/* ── Header ── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md }}>
        <Text style={{ flex: 1, ...typography.h1, color: themeColors.text }}>Inbox</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Search')} style={{ marginRight: spacing.md }}>
          <Search color={themeColors.textMuted} size={22} />
        </TouchableOpacity>
        <TouchableOpacity onPress={toggleViewMode} style={{ marginRight: spacing.md }}>
          {viewMode === 'list' ? <List color={themeColors.textMuted} size={22} /> :
           viewMode === 'gallery' ? <LayoutGrid color={themeColors.textMuted} size={22} /> :
           <KanbanSquare color={themeColors.textMuted} size={22} />}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setFiltersModalVisible(true)}>
          <SlidersHorizontal color={(customPlatform || customUrgency) ? themeColors.primary : themeColors.textMuted} size={22} />
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
              onPress={() => {
                setActiveFilter(f.id);
                setCustomPlatform(null);
                setCustomUrgency(null);
              }}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: borderRadius.full,
                backgroundColor: active ? themeColors.primary : themeColors.background,
                borderWidth: 1,
                borderColor: active ? themeColors.primary : themeColors.border,
                marginRight: index < FILTERS.length - 1 ? spacing.sm : 0,
              }}
            >
              <Text style={{ ...typography.bodyMedium, fontSize: 13, color: active ? themeColors.textLight : themeColors.textMuted }}>
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
          <Text style={{ ...typography.h2, color: themeColors.text, textAlign: 'center', marginBottom: spacing.sm }}>
            Inbox is Empty
          </Text>
          <Text style={{ ...typography.body, color: themeColors.textMuted, textAlign: 'center', lineHeight: 22 }}>
            Save links, notes, and tasks{'\n'}using the + button.
          </Text>
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

      {/* ── Filters & Custom Views Modal ── */}
      <Modal visible={filtersModalVisible} transparent animationType="slide">
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} activeOpacity={1} onPress={() => setFiltersModalVisible(false)} />
        <View style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          backgroundColor: themeColors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28,
          padding: spacing.xl, paddingBottom: 40,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg }}>
            <Text style={{ flex: 1, ...typography.h3, color: themeColors.text }}>Advanced Filters</Text>
            <TouchableOpacity onPress={() => setFiltersModalVisible(false)}>
              <X color={themeColors.textMuted} size={24} />
            </TouchableOpacity>
          </View>

          <Text style={{ ...typography.bodyMedium, color: themeColors.textMuted, marginBottom: spacing.sm }}>Urgency</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
            {['High', 'Medium', 'Low'].map(u => (
              <TouchableOpacity
                key={u}
                onPress={() => setCustomUrgency(customUrgency === u ? null : u)}
                style={{
                  paddingHorizontal: 16, paddingVertical: 8, borderRadius: borderRadius.full,
                  backgroundColor: customUrgency === u ? themeColors.primaryLight : themeColors.surface,
                  borderWidth: 1, borderColor: customUrgency === u ? themeColors.primary : themeColors.border,
                }}
              >
                <Text style={{ color: customUrgency === u ? themeColors.primaryDark : themeColors.text }}>{u}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={{ ...typography.bodyMedium, color: themeColors.textMuted, marginBottom: spacing.sm }}>Platform</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl, flexWrap: 'wrap' }}>
            {['YouTube', 'Twitter', 'Article', 'Link'].map(p => (
              <TouchableOpacity
                key={p}
                onPress={() => setCustomPlatform(customPlatform === p ? null : p)}
                style={{
                  paddingHorizontal: 16, paddingVertical: 8, borderRadius: borderRadius.full, marginBottom: spacing.sm,
                  backgroundColor: customPlatform === p ? themeColors.primaryLight : themeColors.surface,
                  borderWidth: 1, borderColor: customPlatform === p ? themeColors.primary : themeColors.border,
                }}
              >
                <Text style={{ color: customPlatform === p ? themeColors.primaryDark : themeColors.text }}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            onPress={() => {
              setCustomPlatform(null);
              setCustomUrgency(null);
              setFiltersModalVisible(false);
            }}
            style={{
              paddingVertical: spacing.md, alignItems: 'center',
            }}
          >
            <Text style={{ ...typography.bodyMedium, color: themeColors.textMuted }}>Clear Filters</Text>
          </TouchableOpacity>
        </View>
      </Modal>

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
