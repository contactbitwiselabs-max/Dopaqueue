import React from 'react';
import { View, Text, Image, TouchableOpacity, Animated } from 'react-native';
import withObservables from '@nozbe/with-observables';
import QueueItem from '../database/models/QueueItem';
import { CheckCheck, Trash2, Pin } from 'lucide-react-native';
import { Swipeable } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { colors, spacing, typography, borderRadius, shadows } from '../constants/theme';

// --- Helpers ---
function getPlatformInfo(url: string, platform?: string): { label: string; color: string; bg: string } {
  const u = (platform || url || '').toLowerCase();
  if (u.includes('youtube') || u.includes('youtu.be')) return { label: 'YouTube', color: '#FF0000', bg: '#FEE2E2' };
  if (u.includes('twitter') || u.includes('x.com'))   return { label: 'X (Twitter)', color: colors.text, bg: colors.surface };
  if (u.includes('instagram'))                         return { label: 'Instagram', color: '#c026d3', bg: '#FAE8FF' };
  if (u.includes('tiktok'))                            return { label: 'TikTok', color: colors.text, bg: colors.surface };
  if (u.includes('reddit'))                            return { label: 'Reddit', color: '#EA580C', bg: '#FFF7ED' };
  if (u.includes('medium') || u.includes('.blog') || u.includes('substack')) return { label: 'Article', color: colors.textMuted, bg: colors.surface };
  return { label: 'Link', color: colors.textMuted, bg: colors.surface };
}

function getUrgencyDot(urgency?: string): string | null {
  if (!urgency || urgency === 'Unscheduled') return null;
  if (urgency === 'Tomorrow' || urgency === 'High') return colors.urgencyMustSee;
  if (urgency === 'Weekend' || urgency === 'Medium') return colors.urgencySoon;
  return colors.urgencyWhenever;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

interface Props {
  item: QueueItem;
  onPress: (item: QueueItem) => void;
  onArchive?: (item: QueueItem) => void;
  onDelete?: (item: QueueItem) => void;
  onLongPress?: (item: QueueItem) => void;
}

const SaveItemComponent = ({ item, onPress, onArchive, onDelete, onLongPress }: Props) => {
  const platformInfo = getPlatformInfo(item.url, item.platform);
  const urgencyColor = getUrgencyDot(item.urgency);

  // ---- Swipe: Right side → Delete (Red) ----
  const renderRightActions = (_progress: any, dragX: any) => {
    const scale = dragX.interpolate({
      inputRange: [-100, -60, 0],
      outputRange: [1, 0.9, 0.5],
      extrapolate: 'clamp',
    });
    return (
      <TouchableOpacity
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onDelete && onDelete(item); }}
        style={{ width: 80, marginBottom: spacing.sm + 4, marginRight: spacing.md, borderRadius: borderRadius.xl, backgroundColor: colors.danger, justifyContent: 'center', alignItems: 'center' }}
      >
        <Animated.View style={{ transform: [{ scale }], alignItems: 'center' }}>
          <Trash2 color={colors.textLight} size={22} />
          <Text style={{ color: colors.textLight, fontSize: 11, fontWeight: '700', marginTop: spacing.xs }}>Delete</Text>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  // ---- Swipe: Left side → Archive (Green) ----
  const renderLeftActions = (_progress: any, dragX: any) => {
    const scale = dragX.interpolate({
      inputRange: [0, 60, 100],
      outputRange: [0.5, 0.9, 1],
      extrapolate: 'clamp',
    });
    return (
      <TouchableOpacity
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onArchive && onArchive(item); }}
        style={{ width: 80, marginBottom: spacing.sm + 4, marginLeft: spacing.md, borderRadius: borderRadius.xl, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' }}
      >
        <Animated.View style={{ transform: [{ scale }], alignItems: 'center' }}>
          <CheckCheck color={colors.textLight} size={22} />
          <Text style={{ color: colors.textLight, fontSize: 11, fontWeight: '700', marginTop: spacing.xs }}>Archive</Text>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  return (
    <Swipeable
      renderRightActions={renderRightActions}
      renderLeftActions={renderLeftActions}
      onSwipeableRightOpen={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onDelete && onDelete(item); }}
      onSwipeableLeftOpen={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onArchive && onArchive(item); }}
      friction={2}
      rightThreshold={60}
      leftThreshold={60}
    >
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => { Haptics.selectionAsync(); onPress(item); }}
        onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onLongPress && onLongPress(item); }}
        style={{
          backgroundColor: colors.background,
          marginHorizontal: spacing.md,
          marginBottom: spacing.sm + 4,
          borderRadius: borderRadius.xl,
          padding: spacing.lg / 2,
          flexDirection: 'row',
          alignItems: 'center',
          ...shadows.sm,
        }}
      >
        {/* Thumbnail */}
        <View style={{ width: 90, height: 64, borderRadius: borderRadius.md + 2, overflow: 'hidden', backgroundColor: colors.surface, flexShrink: 0 }}>
          {item.thumbnail ? (
            <Image source={{ uri: item.thumbnail }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: platformInfo.bg }}>
              <Text style={{ fontSize: 22 }}>
                {item.url?.includes('youtube') ? '▶' : item.url?.includes('twitter') || item.url?.includes('x.com') ? '𝕏' : '🔗'}
              </Text>
            </View>
          )}
          {/* Platform badge — small pill at bottom of thumb */}
          <View style={{
            position: 'absolute', bottom: spacing.xs, left: spacing.xs,
            backgroundColor: platformInfo.bg, paddingHorizontal: 5, paddingVertical: 2, borderRadius: borderRadius.md - 2,
          }}>
            <Text style={{ fontSize: 9, fontWeight: '700', color: platformInfo.color }}>{platformInfo.label}</Text>
          </View>
        </View>

        {/* Content */}
        <View style={{ flex: 1, marginLeft: spacing.md, justifyContent: 'center' }}>
          {/* Title */}
          <Text numberOfLines={2} style={{ ...typography.bodyMedium, fontSize: 14, color: colors.text, lineHeight: 19 }}>
            {item.title || item.url}
          </Text>
          {/* Meta row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 6, flexWrap: 'wrap' }}>
            <Text style={{ ...typography.caption, color: colors.textMuted }}>{timeAgo(item.savedAt)}</Text>
            {item.collection ? (
              <View style={{ backgroundColor: colors.surface, paddingHorizontal: 6, paddingVertical: 2, borderRadius: borderRadius.full }}>
                <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '500' }}>#{item.collection}</Text>
              </View>
            ) : null}
          </View>
          
          {/* Mini Progress Bar */}
          {(item as any).progressPercent > 0 && (
            <View style={{ height: 4, backgroundColor: colors.surface, borderRadius: 2, marginTop: 8, overflow: 'hidden', width: '80%' }}>
              <View style={{ width: `${(item as any).progressPercent}%`, height: '100%', backgroundColor: colors.primary }} />
            </View>
          )}
        </View>

        {/* Urgency dot and Pin — top right corner */}
        <View style={{ position: 'absolute', top: spacing.md, right: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {item.isPinned ? <Pin size={14} color={colors.warning} fill={colors.warning} /> : null}
          {urgencyColor ? (
            <View style={{
              width: 8, height: 8, borderRadius: borderRadius.full,
              backgroundColor: urgencyColor,
            }} />
          ) : null}
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
};

const enhance = withObservables(['item'], ({ item }) => ({ item }));
export default enhance(SaveItemComponent);
