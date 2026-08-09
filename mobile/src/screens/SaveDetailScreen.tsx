import React from 'react';
import { View, Text, SafeAreaView, ScrollView, Image } from 'react-native';
import QueueItem from '../database/models/QueueItem';
import { Clock, Tag, ExternalLink } from 'lucide-react-native';

export default function SaveDetailScreen({ route }: any) {
  // In a real app with navigation setup, we'd pass the item ID and fetch via withObservables
  const item: QueueItem = route?.params?.item;

  if (!item) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text>Item not found.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1">
        {item.thumbnail ? (
          <Image 
            source={{ uri: item.thumbnail }} 
            className="w-full h-64 bg-gray-100" 
            resizeMode="cover" 
          />
        ) : (
          <View className="w-full h-64 bg-gray-100 items-center justify-center">
            <ExternalLink color="#9ca3af" size={48} />
          </View>
        )}
        
        <View className="p-5">
          <View className="flex-row items-center justify-between mb-3">
            {item.platform && (
              <View className="bg-dopa-green/10 px-3 py-1 rounded-full">
                <Text className="text-xs font-bold text-dopa-green">{item.platform.toUpperCase()}</Text>
              </View>
            )}
            <View className="flex-row items-center">
              <Clock color="#9ca3af" size={14} />
              <Text className="text-xs text-gray-400 ml-1">
                {new Date(item.savedAt).toLocaleDateString()}
              </Text>
            </View>
          </View>
          
          <Text className="text-2xl font-bold text-gray-900 mb-4">{item.title}</Text>
          
          <View className="bg-gray-50 p-4 rounded-xl mb-4 border border-gray-100">
            <Text className="text-sm text-gray-600 mb-1">Source URL</Text>
            <Text className="text-sm text-blue-600 font-medium" numberOfLines={1}>{item.url}</Text>
          </View>

          {item.note && (
            <View className="mb-4">
              <Text className="text-sm font-semibold text-gray-900 mb-2">Notes</Text>
              <Text className="text-base text-gray-700 leading-relaxed">{item.note}</Text>
            </View>
          )}

          {item.collection && (
            <View className="flex-row items-center">
              <Tag color="#15803d" size={16} />
              <Text className="text-sm font-medium text-dopa-green ml-2">{item.collection}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
