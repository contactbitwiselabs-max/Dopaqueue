import React from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, Dimensions } from 'react-native';
import QueueItem from '../database/models/QueueItem';
import { colors, typography, spacing, borderRadius, shadows } from '../constants/theme';
import { Pin } from 'lucide-react-native';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - spacing.lg * 2 - spacing.md) / 2;

interface Props {
  items: QueueItem[];
  onPress: (item: QueueItem) => void;
  onLongPress: (item: QueueItem) => void;
}

const getPlatformColor = (platform?: string) => {
  if (platform === 'YouTube') return colors.danger;
  if (platform === 'X (Twitter)') return colors.info;
  if (platform === 'Instagram') return '#E1306C';
  return colors.primary;
};

export default function SaveCardGallery({ items, onPress, onLongPress }: Props) {
  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      numColumns={2}
      columnWrapperStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg, marginBottom: spacing.md }}
      contentContainerStyle={{ paddingTop: spacing.sm, paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => (
        <TouchableOpacity
          onPress={() => onPress(item)}
          onLongPress={() => onLongPress(item)}
          style={{
            width: CARD_WIDTH,
            backgroundColor: colors.background,
            borderRadius: borderRadius.lg,
            overflow: 'hidden',
            ...shadows.sm,
          }}
        >
          {item.thumbnail ? (
            <Image source={{ uri: item.thumbnail }} style={{ width: '100%', height: 110, backgroundColor: colors.surface }} resizeMode="cover" />
          ) : (
            <View style={{ width: '100%', height: 110, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 32 }}>🔗</Text>
            </View>
          )}
          
          <View style={{ padding: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ ...typography.caption, color: getPlatformColor(item.platform), fontWeight: '600' }} numberOfLines={1}>
                {item.platform || 'Link'}
              </Text>
              {item.isPinned && <Pin size={12} color={colors.warning} fill={colors.warning} />}
            </View>
            <Text style={{ ...typography.bodyMedium, color: colors.text, fontSize: 13, lineHeight: 18 }} numberOfLines={3}>
              {item.title || item.url}
            </Text>
          </View>
        </TouchableOpacity>
      )}
    />
  );
}
