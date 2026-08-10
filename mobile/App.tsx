import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useShareIntent } from 'expo-share-intent';
import { DatabaseProvider } from './src/database/DatabaseProvider';
import { database } from './src/database';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Inbox, FolderOpen, Clock, BarChart2, User, Plus } from 'lucide-react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import QueueItem from './src/database/models/QueueItem';
import './global.css';
import SmartSaveBar from './src/components/SmartSaveBar';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

import InboxScreen from './src/screens/InboxScreen';
import CollectionsScreen from './src/screens/CollectionsScreen';
import FocusScreen from './src/screens/FocusScreen';
import StatsScreen from './src/screens/StatsScreen';
import ProfileScreen from './src/screens/ProfileScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();
  const [saveBarVisible, setSaveBarVisible] = useState(false);
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
        setSaveBarVisible(true); // open the save bar with the shared link
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
          console.error('Save intent failed', e);
        } finally {
          resetShareIntent();
        }
      }
    }
    processShareIntent();
  }, [hasShareIntent, shareIntent, resetShareIntent]);

  const handleSaveFromBar = async (data: { url: string; note: string; urgency: string; tag: string; collection: string }) => {
    try {
      await database.write(async () => {
        await database.get<QueueItem>('queue_items').create(item => {
          item.url = data.url;
          item.title = 'Saved Link';
          item.savedAt = Date.now();
          item.watched = false;
          item.deleted = false;
          if (data.urgency) item.urgency = data.urgency;
          if (data.collection) item.collection = data.collection;
        });
      });
      setShowSaveToast(true);
      setTimeout(() => setShowSaveToast(false), 3000);
    } catch (e) {
      console.error('Save from bar failed', e);
    }
  };

  const appContent = (
    <GestureHandlerRootView style={{ flex: 1, width: '100%', height: '100%' }}>
      <DatabaseProvider>
        <NavigationContainer>
          <Tab.Navigator
            screenOptions={{
              tabBarActiveTintColor: '#16a34a',
              tabBarInactiveTintColor: '#9ca3af',
              headerShown: false,
              tabBarLabelStyle: {
                fontSize: 10,
                fontWeight: '600',
                marginTop: -4,
              },
              tabBarStyle: {
                borderTopWidth: 1,
                borderTopColor: '#f3f4f6',
                paddingTop: 8,
                height: 80,
                paddingBottom: 24,
                backgroundColor: '#ffffff',
                elevation: 0,
                shadowOpacity: 0,
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
              name="CollectionsTab"
              component={CollectionsScreen}
              options={{
                title: 'Collections',
                tabBarIcon: ({ color, size }) => <FolderOpen color={color} size={size} />
              }}
            />
            <Tab.Screen
              name="FocusTab"
              component={FocusScreen}
              options={{
                title: 'Focus',
                tabBarIcon: ({ color, size }) => <Clock color={color} size={size} />
              }}
            />
            <Tab.Screen
              name="StatsTab"
              component={StatsScreen}
              options={{
                title: 'Stats',
                tabBarIcon: ({ color, size }) => <BarChart2 color={color} size={size} />
              }}
            />
            <Tab.Screen
              name="ProfileTab"
              component={ProfileScreen}
              options={{
                title: 'Profile',
                tabBarIcon: ({ color, size }) => <User color={color} size={size} />
              }}
            />
          </Tab.Navigator>
        </NavigationContainer>

        {/* ── Global FAB ── */}
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setSaveBarVisible(true)}
        >
          <Plus color="#fff" size={26} strokeWidth={2.5} />
        </TouchableOpacity>

        {/* ── Save success toast ── */}
        {showSaveToast && (
          <View style={styles.toast}>
            <Text style={styles.toastText}>✓ Saved to Inbox</Text>
          </View>
        )}

        {/* ── Smart Save Bar Modal ── */}
        <SmartSaveBar
          visible={saveBarVisible}
          onClose={() => setSaveBarVisible(false)}
          onSave={handleSaveFromBar}
        />
      </DatabaseProvider>
    </GestureHandlerRootView>
  );

  if (Platform.OS === 'web') {
    return (
      <View style={styles.webContainer}>
        <View style={styles.mobileWrapper}>
          {appContent}
        </View>
      </View>
    );
  }

  return appContent;
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 96,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#16a34a',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
  },
  toast: {
    position: 'absolute',
    bottom: 100,
    left: 24,
    right: 24,
    backgroundColor: '#111827',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  toastText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  webContainer: {
    flex: 1,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh' as any,
    width: '100vw' as any,
  },
  mobileWrapper: {
    width: 375,
    height: 812,
    maxHeight: '95vh' as any,
    backgroundColor: '#fff',
    borderRadius: 40,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.15,
    shadowRadius: 40,
    elevation: 20,
    borderWidth: 10,
    borderColor: '#111827',
  },
});
