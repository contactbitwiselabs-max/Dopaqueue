import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useShareIntent } from 'expo-share-intent';
import { DatabaseProvider } from './src/database/DatabaseProvider';
import { database } from './src/database';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Inbox, FolderOpen, Search, PlusCircle } from 'lucide-react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import QueueItem from './src/database/models/QueueItem';
import './global.css'; 

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

import InboxScreen from './src/screens/InboxScreen';
import CollectionsScreen from './src/screens/CollectionsScreen';
import SearchScreen from './src/screens/SearchScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [savedItemTitle, setSavedItemTitle] = useState('');

  useEffect(() => {
    async function setupNotifications() {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
      }
    }
    setupNotifications();
  }, []);

  useEffect(() => {
    async function processShareIntent() {
      if (hasShareIntent && shareIntent.value) {
        try {
          await database.write(async () => {
            const newItem = await database.get<QueueItem>('queue_items').create(item => {
              item.url = shareIntent.value || '';
              item.title = 'Saved Link'; 
              item.savedAt = Date.now();
              item.watched = false;
              item.deleted = false;
            });
            setSavedItemTitle(newItem.url);
          });
          
          setShowSaveToast(true);
          setTimeout(() => setShowSaveToast(false), 4000);
          
        } catch (e) {
          console.error("Save intent failed", e);
        } finally {
          resetShareIntent();
        }
      }
    }
    processShareIntent();
  }, [hasShareIntent, shareIntent, resetShareIntent]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <DatabaseProvider>
        <NavigationContainer>
          <Tab.Navigator
            screenOptions={{
              tabBarActiveTintColor: '#15803d', // dopa-green
              tabBarInactiveTintColor: '#6b7280', // dopa-muted
              headerShown: false,
              tabBarStyle: {
                borderTopWidth: 1,
                borderTopColor: '#e5e7eb', // dopa-border
                paddingTop: 5,
                height: 60,
                paddingBottom: 10,
              }
            }}
          >
            <Tab.Screen 
              name="InboxTab" 
              component={InboxScreen} 
              options={{
                title: 'Inbox',
                tabBarIcon: ({ color, size }) => <Inbox color={color} size={size} />
              }}
            />
            <Tab.Screen 
              name="SearchTab" 
              component={SearchScreen} 
              options={{
                title: 'Search',
                tabBarIcon: ({ color, size }) => <Search color={color} size={size} />
              }}
            />
            <Tab.Screen 
              name="CollectionsTab" 
              component={CollectionsScreen} 
              options={{
                title: 'Collections',
                tabBarIcon: ({ color, size }) => <FolderOpen color={color} size={size} />
              }}
            />
          </Tab.Navigator>
        </NavigationContainer>

        {/* Quick Add FAB globally overlaid */}
        <TouchableOpacity 
          className="absolute bottom-24 right-6 bg-dopa-green rounded-full p-4 shadow-lg flex items-center justify-center"
          style={styles.fab}
          onPress={() => console.log('Quick Add tapped')}
        >
          <PlusCircle color="#fff" size={28} />
        </TouchableOpacity>

        {/* Smart Save Bar */}
        {showSaveToast && (
          <View style={styles.toastContainer} className="absolute bottom-24 left-5 right-24 bg-dopa-green p-4 rounded-xl shadow-lg flex-row justify-between items-center">
            <View className="flex-1 mr-3">
              <Text className="text-white font-bold">Saved to Inbox</Text>
              <Text className="text-white/80 text-sm" numberOfLines={1}>{savedItemTitle}</Text>
            </View>
            <TouchableOpacity className="bg-white/20 px-3 py-1 rounded-full">
              <Text className="text-white font-medium">Tag</Text>
            </TouchableOpacity>
          </View>
        )}
      </DatabaseProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  fab: {
    elevation: 8,
    shadowColor: '#15803d',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
  },
  toastContainer: {
    elevation: 6,
  }
});
