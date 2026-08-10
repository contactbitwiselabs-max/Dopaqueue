import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, FlatList, Dimensions } from 'react-native';
import QueueItem from '../database/models/QueueItem';
import { colors, typography, spacing, borderRadius, shadows } from '../constants/theme';
import { Pin } from 'lucide-react-native';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = width * 0.75;

interface Props {
  items: QueueItem[];
  onPress: (item: QueueItem) => void;
  onLongPress: (item: QueueItem) => void;
}

export default function SaveKanbanBoard({ items, onPress, onLongPress }: Props) {
  // Group items by Urgency (High, Tomorrow, Whenever, None/Other)
  const columns = [
    { id: 'high', title: 'High Priority', items: items.filter(i => i.urgency === 'High' || i.urgency === '🔴 High') },
    { id: 'tomorrow', title: 'Soon', items: items.filter(i => i.urgency === 'Tomorrow' || i.urgency === '🟡 Soon') },
    { id: 'whenever', title: 'Whenever', items: items.filter(i => i.urgency === 'Whenever' || i.urgency === '🔵 Whenever') },
    { id: 'unassigned', title: 'Unassigned', items: items.filter(i => !i.urgency) },
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 120, paddingTop: spacing.sm, gap: spacing.lg }}
    >
      {columns.map(col => (
        <View key={col.id} style={{ width: COLUMN_WIDTH, backgroundColor: colors.background, borderRadius: borderRadius.lg, padding: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
            <Text style={{ ...typography.h3, color: colors.text }}>{col.title}</Text>
            <View style={{ backgroundColor: colors.surface, paddingHorizontal: 8, paddingVertical: 2, borderRadius: borderRadius.full }}>
              <Text style={{ ...typography.caption, color: colors.textMuted }}>{col.items.length}</Text>
            </View>
          </View>

          <FlatList
            data={col.items}
            keyExtractor={item => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => onPress(item)}
                onLongPress={() => onLongPress(item)}
                style={{
                  backgroundColor: colors.surface,
                  padding: spacing.md,
                  borderRadius: borderRadius.md,
                  marginBottom: spacing.sm,
                  ...shadows.sm,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ ...typography.caption, color: colors.textMuted, fontWeight: '500' }}>
                    {item.platform || 'Link'}
                  </Text>
                  {item.isPinned && <Pin size={12} color={colors.warning} fill={colors.warning} />}
                </View>
                <Text style={{ ...typography.bodyMedium, color: colors.text, fontSize: 14 }} numberOfLines={2}>
                  {item.title || item.url}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      ))}
    </ScrollView>
  );
}
