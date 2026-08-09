import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, SafeAreaView, TouchableOpacity } from 'react-native';
import withObservables from '@nozbe/with-observables';
import { database } from '../database';
import Collection from '../database/models/Collection';
import QueueItem from '../database/models/QueueItem';
import { Q } from '@nozbe/watermelondb';
import { FolderOpen, Flame, Trophy } from 'lucide-react-native';

interface Props {
  collections: Collection[];
  totalSaved: number;
  totalWatched: number;
}

const CollectionsScreenComponent = ({ collections, totalSaved, totalWatched }: Props) => {
  const score = totalWatched * 10;
  
  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="px-5 pt-8 pb-4">
        <Text className="text-3xl font-extrabold text-gray-900 mb-6">Library</Text>
        
        {/* Gamification Stats */}
        <View className="flex-row gap-3 mb-6">
          <View className="flex-1 bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex-row items-center">
            <View className="w-10 h-10 rounded-full bg-orange-100 items-center justify-center mr-3">
              <Flame color="#ea580c" size={20} />
            </View>
            <View>
              <Text className="text-xs font-semibold text-gray-500 uppercase">Streak</Text>
              <Text className="text-xl font-black text-gray-900">3 Days</Text>
            </View>
          </View>
          <View className="flex-1 bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex-row items-center">
            <View className="w-10 h-10 rounded-full bg-yellow-100 items-center justify-center mr-3">
              <Trophy color="#eab308" size={20} />
            </View>
            <View>
              <Text className="text-xs font-semibold text-gray-500 uppercase">Score</Text>
              <Text className="text-xl font-black text-gray-900">{score}</Text>
            </View>
          </View>
        </View>

        <Text className="text-lg font-bold text-gray-900 mb-3">Your Collections</Text>
      </View>

      <FlatList
        data={collections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
        ListHeaderComponent={
          <View className="mb-6">
            <Text className="text-sm font-semibold text-gray-500 uppercase mb-3">Smart Collections</Text>
            <View className="flex-row gap-3">
              <TouchableOpacity className="bg-blue-50 px-4 py-3 rounded-xl border border-blue-100 flex-1 items-center">
                <Text className="text-blue-700 font-semibold">Articles</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-red-50 px-4 py-3 rounded-xl border border-red-100 flex-1 items-center">
                <Text className="text-red-700 font-semibold">Must See</Text>
              </TouchableOpacity>
            </View>
            <View className="flex-row gap-3 mt-3">
              <TouchableOpacity className="bg-green-50 px-4 py-3 rounded-xl border border-green-100 flex-1 items-center">
                <Text className="text-green-700 font-semibold">Videos</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-purple-50 px-4 py-3 rounded-xl border border-purple-100 flex-1 items-center">
                <Text className="text-purple-700 font-semibold">Weekend</Text>
              </TouchableOpacity>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View className="items-center justify-center py-10">
            <Text className="text-gray-400">No collections yet.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity className="bg-white p-4 mb-3 rounded-2xl shadow-sm border border-gray-100 flex-row items-center">
            <View 
              className="w-12 h-12 rounded-full items-center justify-center mr-4"
              style={{ backgroundColor: item.color ? `${item.color}20` : '#f3f4f6' }}
            >
              <FolderOpen color={item.color || '#9ca3af'} size={24} />
            </View>
            <View className="flex-1">
              <Text className="text-lg font-semibold text-gray-900">{item.name}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
};

const enhance = withObservables([], () => ({
  collections: database.collections
    .get<Collection>('collections')
    .query(Q.sortBy('name', Q.asc)),
  totalSaved: database.collections
    .get<QueueItem>('queue_items')
    .query(Q.where('deleted', false))
    .observeCount(),
  totalWatched: database.collections
    .get<QueueItem>('queue_items')
    .query(Q.where('watched', true), Q.where('deleted', false))
    .observeCount()
}));

export default enhance(CollectionsScreenComponent);
