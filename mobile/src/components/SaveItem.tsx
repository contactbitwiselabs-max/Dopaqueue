import React from 'react';
import { View, Text, Image, TouchableOpacity, Animated } from 'react-native';
import withObservables from '@nozbe/with-observables';
import QueueItem from '../database/models/QueueItem';
import { ExternalLink, Tag, CheckCircle2, ArchiveX, PlayCircle, Film, Zap, FileText, Camera, Link2, Image as ImageIcon } from 'lucide-react-native';
import { Swipeable } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

function detectContentType(url: string, explicitType?: string) {
  if (explicitType) return explicitType;
  if (!url) return 'link';
  if (/youtube\.com\/shorts\//i.test(url)) return 'short';
  if (/instagram\.com\/reel/i.test(url)) return 'reel';
  if (/instagram\.com\/p\//i.test(url)) return 'post';
  if (/twitter\.com/i.test(url) || /x\.com/i.test(url) || /reddit\.com/i.test(url) || /linkedin\.com/i.test(url)) return 'post';
  if (/(youtube\.com|youtu\.be|tiktok\.com|vimeo\.com|twitch\.tv)/i.test(url)) return 'video';
  return 'link';
}

function getPlatformIcon(type: string) {
  switch (type) {
    case 'video': return <PlayCircle color="#9ca3af" size={24} />;
    case 'short': return <Zap color="#9ca3af" size={24} />;
    case 'reel': return <Film color="#9ca3af" size={24} />;
    case 'post': return <ImageIcon color="#9ca3af" size={24} />;
    case 'article': return <FileText color="#9ca3af" size={24} />;
    case 'screenshot': return <Camera color="#9ca3af" size={24} />;
    default: return <Link2 color="#9ca3af" size={24} />;
  }
}

interface Props {
  item: QueueItem;
  onPress: (item: QueueItem) => void;
  onArchive?: (item: QueueItem) => void;
  onDelete?: (item: QueueItem) => void;
}

const SaveItemComponent = ({ item, onPress, onArchive, onDelete }: Props) => {
  
  const renderRightActions = (progress: any, dragX: any) => {
    const scale = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });
    
    return (
      <TouchableOpacity 
        className="bg-red-500 justify-center items-end px-6 mb-3 mx-4 rounded-2xl"
        onPress={() => onDelete && onDelete(item)}
      >
        <Animated.View style={{ transform: [{ scale }] }}>
          <ArchiveX color="#fff" size={24} />
        </Animated.View>
      </TouchableOpacity>
    );
  };

  const renderLeftActions = (progress: any, dragX: any) => {
    const scale = dragX.interpolate({
      inputRange: [0, 100],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    });
    
    return (
      <TouchableOpacity 
        className="bg-dopa-green justify-center items-start px-6 mb-3 mx-4 rounded-2xl"
        onPress={() => onArchive && onArchive(item)}
      >
        <Animated.View style={{ transform: [{ scale }] }}>
          <CheckCircle2 color="#fff" size={24} />
        </Animated.View>
      </TouchableOpacity>
    );
  };

  return (
    <Swipeable
      renderRightActions={renderRightActions}
      renderLeftActions={renderLeftActions}
      onSwipeableRightOpen={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (onDelete) onDelete(item);
      }}
      onSwipeableLeftOpen={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (onArchive) onArchive(item);
      }}
    >
      <TouchableOpacity 
        activeOpacity={0.7}
        onPress={() => {
          Haptics.selectionAsync();
          onPress(item);
        }}
        className="bg-white p-4 mb-3 mx-4 rounded-2xl shadow-sm border border-gray-100 flex-row"
      >
        {item.thumbnail ? (
          <Image 
            source={{ uri: item.thumbnail }} 
            className="w-20 h-20 rounded-xl bg-gray-100" 
            resizeMode="cover" 
          />
        ) : (
          <View className="w-20 h-20 rounded-xl bg-gray-100 items-center justify-center">
            {getPlatformIcon(detectContentType(item.url, item.platform))}
          </View>
        )}

        <View className="flex-1 ml-4 justify-center">
          <View className="flex-row items-center mb-1">
            <View className="bg-dopa-green/10 px-2 py-0.5 rounded mr-2">
              <Text className="text-[10px] font-bold text-dopa-green">
                {(item.platform || detectContentType(item.url)).toUpperCase()}
              </Text>
            </View>
            <Text className="text-xs text-gray-400">
              {new Date(item.savedAt).toLocaleDateString()}
            </Text>
          </View>

          <Text className="text-base font-semibold text-gray-900" numberOfLines={2}>
            {item.title}
          </Text>
          
          <View className="flex-row items-center mt-2 flex-wrap">
            {item.collection && (
              <View className="flex-row items-center mr-3 mb-1">
                <Tag color="#15803d" size={12} />
                <Text className="text-xs text-dopa-green ml-1">{item.collection}</Text>
              </View>
            )}

            {item.urgency && item.urgency !== 'Unscheduled' && (
              <View className={`px-2 py-0.5 rounded-full border mb-1 ${
                item.urgency === 'Tomorrow' ? 'bg-red-50 border-red-200' :
                item.urgency === 'Weekend' ? 'bg-yellow-50 border-yellow-200' :
                'bg-blue-50 border-blue-200'
              }`}>
                <Text className={`text-[10px] font-medium ${
                  item.urgency === 'Tomorrow' ? 'text-red-600' :
                  item.urgency === 'Weekend' ? 'text-yellow-600' :
                  'text-blue-600'
                }`}>
                  {item.urgency}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
};

const enhance = withObservables(['item'], ({ item }) => ({
  item
}));

export default enhance(SaveItemComponent);
