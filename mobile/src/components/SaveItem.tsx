import React from 'react';
import { View, Text, Image, TouchableOpacity, Animated } from 'react-native';
import withObservables from '@nozbe/with-observables';
import QueueItem from '../database/models/QueueItem';
import { CheckCheck, Trash2 } from 'lucide-react-native';
import { Swipeable } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

// --- Helpers ---
function getPlatformInfo(url: string, platform?: string): { label: string; color: string; bg: string } {
  const u = (platform || url || '').toLowerCase();
  if (u.includes('youtube') || u.includes('youtu.be')) return { label: 'YouTube', color: '#FF0000', bg: '#FEE2E2' };
  if (u.includes('twitter') || u.includes('x.com'))   return { label: 'X (Twitter)', color: '#111827', bg: '#F3F4F6' };
  if (u.includes('instagram'))                         return { label: 'Instagram', color: '#c026d3', bg: '#FAE8FF' };
  if (u.includes('tiktok'))                            return { label: 'TikTok', color: '#111827', bg: '#F3F4F6' };
  if (u.includes('reddit'))                            return { label: 'Reddit', color: '#EA580C', bg: '#FFF7ED' };
  if (u.includes('medium') || u.includes('.blog') || u.includes('substack')) return { label: 'Article', color: '#4B5563', bg: '#F9FAFB' };
  return { label: 'Link', color: '#4B5563', bg: '#F3F4F6' };
}

function getUrgencyDot(urgency?: string): string | null {
  if (!urgency || urgency === 'Unscheduled') return null;
  if (urgency === 'Tomorrow' || urgency === 'High') return '#EF4444'; // red
  if (urgency === 'Weekend' || urgency === 'Medium') return '#EAB308'; // yellow
  return '#3B82F6'; // blue – Whenever / Low
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
}

const SaveItemComponent = ({ item, onPress, onArchive, onDelete }: Props) => {
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
        style={{ width: 80, marginBottom: 12, marginRight: 16, borderRadius: 16, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center' }}
      >
        <Animated.View style={{ transform: [{ scale }], alignItems: 'center' }}>
          <Trash2 color="#fff" size={22} />
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700', marginTop: 4 }}>Delete</Text>
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
        style={{ width: 80, marginBottom: 12, marginLeft: 16, borderRadius: 16, backgroundColor: '#16a34a', justifyContent: 'center', alignItems: 'center' }}
      >
        <Animated.View style={{ transform: [{ scale }], alignItems: 'center' }}>
          <CheckCheck color="#fff" size={22} />
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700', marginTop: 4 }}>Archive</Text>
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
        style={{
          backgroundColor: '#ffffff',
          marginHorizontal: 16,
          marginBottom: 12,
          borderRadius: 16,
          padding: 12,
          flexDirection: 'row',
          alignItems: 'center',
          // Subtle card shadow
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 4,
          elevation: 2,
        }}
      >
        {/* Thumbnail */}
        <View style={{ width: 90, height: 64, borderRadius: 10, overflow: 'hidden', backgroundColor: '#F3F4F6', flexShrink: 0 }}>
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
            position: 'absolute', bottom: 4, left: 4,
            backgroundColor: platformInfo.bg, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6,
          }}>
            <Text style={{ fontSize: 9, fontWeight: '700', color: platformInfo.color }}>{platformInfo.label}</Text>
          </View>
        </View>

        {/* Content */}
        <View style={{ flex: 1, marginLeft: 12, justifyContent: 'center' }}>
          {/* Title */}
          <Text numberOfLines={2} style={{ fontSize: 14, fontWeight: '600', color: '#111827', lineHeight: 19 }}>
            {item.title || item.url}
          </Text>
          {/* Meta row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 6, flexWrap: 'wrap' }}>
            <Text style={{ fontSize: 12, color: '#9CA3AF' }}>{timeAgo(item.savedAt)}</Text>
            {item.collection ? (
              <View style={{ backgroundColor: '#F3F4F6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99 }}>
                <Text style={{ fontSize: 11, color: '#6B7280', fontWeight: '500' }}>#{item.collection}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Urgency dot — top right corner */}
        {urgencyColor ? (
          <View style={{
            position: 'absolute', top: 12, right: 12,
            width: 8, height: 8, borderRadius: 4,
            backgroundColor: urgencyColor,
          }} />
        ) : null}
      </TouchableOpacity>
    </Swipeable>
  );
};

const enhance = withObservables(['item'], ({ item }) => ({ item }));
export default enhance(SaveItemComponent);
