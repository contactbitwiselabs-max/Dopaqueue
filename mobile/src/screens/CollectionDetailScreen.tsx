import React, { useState } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, FlatList } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import withObservables from '@nozbe/with-observables';
import { database } from '../database';
import QueueItem from '../database/models/QueueItem';
import { Q } from '@nozbe/watermelondb';
import SaveItem from '../components/SaveItem';
import SaveDetailSheet from '../components/SaveDetailSheet';
import { ChevronLeft } from 'lucide-react-native';
import { colors, typography, spacing } from '../constants/theme';
import EmptyInboxAnimation from '../components/EmptyInboxAnimation';

const CollectionDetailScreenComponent = ({ queueItems }: { queueItems: QueueItem[] }) => {
  const route = useRoute();
  const navigation = useNavigation();
  const { collectionName } = route.params as { collectionName: string };
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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: spacing.md }}>
          <ChevronLeft color={colors.text} size={28} />
        </TouchableOpacity>
        <Text style={{ flex: 1, ...typography.h1, color: colors.text }}>{collectionName}</Text>
      </View>

      {queueItems.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <EmptyInboxAnimation />
          <Text style={{ ...typography.h3, color: colors.textMuted, marginTop: spacing.md }}>No items here yet.</Text>
        </View>
      ) : (
        <FlatList
          data={queueItems}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <SaveItem
              item={item}
              onPress={setSelectedItem}
              onLongPress={handleLongPress}
              onArchive={handleArchive}
              onDelete={handleDelete}
            />
          )}
          contentContainerStyle={{ paddingTop: spacing.xs, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      <SaveDetailSheet
        item={selectedItem}
        visible={!!selectedItem}
        onClose={() => setSelectedItem(null)}
      />
    </SafeAreaView>
  );
};

const enhance = withObservables(['route'], ({ route }) => ({
  queueItems: database.collections
    .get<QueueItem>('queue_items')
    .query(
      Q.where('deleted', false),
      Q.where('watched', false),
      Q.where('collection', route.params.collectionName),
      Q.sortBy('is_pinned', Q.desc),
      Q.sortBy('saved_at', Q.desc)
    )
}));

export default enhance(CollectionDetailScreenComponent);
