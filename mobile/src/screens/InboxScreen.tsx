import React from 'react';
import { View, Text, FlatList, SafeAreaView } from 'react-native';
import withObservables from '@nozbe/with-observables';
import { database } from '../database';
import QueueItem from '../database/models/QueueItem';
import { Q } from '@nozbe/watermelondb';
import SaveItem from '../components/SaveItem';

interface Props {
  queueItems: QueueItem[];
}

const InboxScreenComponent = ({ queueItems }: Props) => {
  const handleItemPress = (item: QueueItem) => {
    console.log("Pressed item:", item.id);
    // Navigate to detail screen or open link
  };

  const handleArchive = async (item: QueueItem) => {
    await database.write(async () => {
      await item.update(i => {
        i.watched = true;
      });
    });
  };

  const handleDelete = async (item: QueueItem) => {
    await database.write(async () => {
      await item.update(i => {
        i.deleted = true;
      });
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="px-5 pt-8 pb-4">
        <Text className="text-3xl font-extrabold text-gray-900">Inbox</Text>
        <Text className="text-gray-500 mt-1">
          {queueItems.length} {queueItems.length === 1 ? 'save' : 'saves'} to process
        </Text>
      </View>

      {queueItems.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-400 text-lg">You're all caught up!</Text>
        </View>
      ) : (
        <FlatList
          data={queueItems}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <SaveItem 
              item={item} 
              onPress={handleItemPress} 
              onArchive={handleArchive}
              onDelete={handleDelete}
            />
          )}
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}
    </SafeAreaView>
  );
};

const enhance = withObservables([], () => ({
  queueItems: database.collections
    .get<QueueItem>('queue_items')
    .query(
      Q.where('deleted', false),
      Q.where('watched', false),
      Q.sortBy('saved_at', Q.desc)
    )
}));

export default enhance(InboxScreenComponent);
