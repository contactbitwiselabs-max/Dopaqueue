import React, { useState } from 'react';
import { View, Text, TextInput, FlatList, SafeAreaView } from 'react-native';
import withObservables from '@nozbe/with-observables';
import { database } from '../database';
import QueueItem from '../database/models/QueueItem';
import { Q } from '@nozbe/watermelondb';
import SaveItem from '../components/SaveItem';
import { Search } from 'lucide-react-native';

const SearchResults = ({ query, items }: { query: string, items: QueueItem[] }) => {
  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ paddingBottom: 100 }}
      ListEmptyComponent={
        query.length > 2 ? (
          <View className="items-center mt-10">
            <Text className="text-gray-400">No results found.</Text>
          </View>
        ) : null
      }
      renderItem={({ item }) => (
        <SaveItem item={item} onPress={() => {}} />
      )}
    />
  );
};

const EnhancedSearchResults = withObservables(['query'], ({ query }: { query: string }) => ({
  items: database.collections
    .get<QueueItem>('queue_items')
    .query(
      Q.where('title', Q.like(`%${Q.sanitizeLikeString(query)}%`)),
      Q.where('deleted', false)
    )
}))(SearchResults);

export default function SearchScreen() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="px-5 pt-8 pb-4">
        <Text className="text-3xl font-extrabold text-gray-900 mb-4">Search</Text>
        
        <View className="flex-row items-center bg-white px-4 py-3 rounded-xl border border-gray-200">
          <Search color="#9ca3af" size={20} />
          <TextInput 
            className="flex-1 ml-3 text-base text-gray-900"
            placeholder="Search saves, tags, platforms..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
        </View>
      </View>

      {searchQuery.length > 2 ? (
        <EnhancedSearchResults query={searchQuery} />
      ) : (
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-400 text-center mx-10">
            Type at least 3 characters to search across all your saved content.
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}
