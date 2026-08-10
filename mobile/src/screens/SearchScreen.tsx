import React, { useState } from 'react';
import { View, Text, TextInput, FlatList, SafeAreaView, TouchableOpacity } from 'react-native';
import withObservables from '@nozbe/with-observables';
import { database } from '../database';
import QueueItem from '../database/models/QueueItem';
import { Q } from '@nozbe/watermelondb';
import SaveItem from '../components/SaveItem';
import SaveDetailSheet from '../components/SaveDetailSheet';
import { Search, ChevronLeft } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '../constants/theme';
import { useNavigation } from '@react-navigation/native';

const SearchResults = ({ query, items }: { query: string, items: QueueItem[] }) => {
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null);

  const handleArchive = async (item: QueueItem) => {
    await database.write(async () => { await item.update(i => { i.watched = true; }); });
  };
  
  const handleDelete = async (item: QueueItem) => {
    await database.write(async () => { await item.update(i => { i.deleted = true; }); });
  };

  const handleLongPress = async (item: QueueItem) => {
    await database.write(async () => { await item.update(i => { i.isPinned = !i.isPinned; }); });
  };

  return (
    <>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 100, paddingTop: spacing.md }}
        ListEmptyComponent={
          query.length > 2 ? (
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <Text style={{ ...typography.body, color: colors.textMuted }}>No results found.</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <SaveItem
            item={item}
            onPress={setSelectedItem}
            onLongPress={handleLongPress}
            onArchive={handleArchive}
            onDelete={handleDelete}
          />
        )}
      />
      <SaveDetailSheet
        item={selectedItem}
        visible={!!selectedItem}
        onClose={() => setSelectedItem(null)}
      />
    </>
  );
};

const EnhancedSearchResults = withObservables(['query'], ({ query }: { query: string }) => ({
  items: database.collections
    .get<QueueItem>('queue_items')
    .query(
      Q.where('deleted', false),
      Q.or(
        Q.where('title', Q.like(`%${Q.sanitizeLikeString(query)}%`)),
        Q.where('url', Q.like(`%${Q.sanitizeLikeString(query)}%`)),
        Q.where('note', Q.like(`%${Q.sanitizeLikeString(query)}%`)),
        Q.where('tags', Q.like(`%${Q.sanitizeLikeString(query)}%`))
      )
    )
}))(SearchResults);

export default function SearchScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const navigation = useNavigation();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: spacing.sm }}>
            <ChevronLeft color={colors.text} size={28} />
          </TouchableOpacity>
          <Text style={{ ...typography.h1, color: colors.text }}>Search</Text>
        </View>
        
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, paddingHorizontal: spacing.md, paddingVertical: 12, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border }}>
          <Search color={colors.textMuted} size={20} />
          <TextInput 
            style={{ flex: 1, marginLeft: spacing.sm, ...typography.body, color: colors.text }}
            placeholder="Search saves, tags, platforms..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoFocus
          />
        </View>
      </View>

      {searchQuery.length > 2 ? (
        <EnhancedSearchResults query={searchQuery} />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ ...typography.body, color: colors.textMuted, textAlign: 'center', marginHorizontal: 40 }}>
            Type at least 3 characters to search across all your saved content.
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}
