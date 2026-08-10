import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useShareIntent } from 'expo-share-intent';
import { DatabaseProvider } from './src/database/DatabaseProvider';
import { database, seedDatabase } from './src/database';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Inbox, FolderOpen, Archive, BarChart2, User, Plus } from 'lucide-react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import QueueItem from './src/database/models/QueueItem';
import AsyncStorage from '@react-native-async-storage/async-storage';
import './global.css';
import SmartSaveBar from './src/components/SmartSaveBar';
import { colors, shadows } from './src/constants/theme';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

import InboxScreen from './src/screens/InboxScreen';
import CollectionsScreen from './src/screens/CollectionsScreen';
import CollectionDetailScreen from './src/screens/CollectionDetailScreen';
import FocusScreen from './src/screens/FocusScreen';
import StatsScreen from './src/screens/StatsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SearchScreen from './src/screens/SearchScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        headerShown: false,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: -4,
        },
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingTop: 8,
          height: 80,
          paddingBottom: 24,
          backgroundColor: colors.background,
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
          title: 'Archive',
          tabBarIcon: ({ color, size }) => <Archive color={color} size={size} />
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
  );
}

export default function App() {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();
  const [saveBarVisible, setSaveBarVisible] = useState(false);
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [isFirstLaunch, setIsFirstLaunch] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkOnboarding() {
      const hasCompleted = await AsyncStorage.getItem('has_completed_onboarding');
      setIsFirstLaunch(hasCompleted !== 'true');
    }
    checkOnboarding();
  }, []);

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
    seedDatabase();
  }, []);

  useEffect(() => {
    async function processShareIntent() {
      if (hasShareIntent && shareIntent.value) {
        setSaveBarVisible(true);
        resetShareIntent();
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
          if (data.tag) item.note = `#${data.tag}`;
        });
      });
      setShowSaveToast(true);
      setTimeout(() => setShowSaveToast(false), 3000);
    } catch (e) {
      console.error('Save from bar failed', e);
    }
  };

  if (isFirstLaunch === null) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />; // Splash/Loading state
  }

  const appContent = (
    <GestureHandlerRootView style={{ flex: 1, width: '100%', height: '100%' }}>
      <SafeAreaProvider>
        <DatabaseProvider database={database}>
          <NavigationContainer>
            <Stack.Navigator initialRouteName={isFirstLaunch ? "Onboarding" : "MainTabs"} screenOptions={{ headerShown: false, animation: 'fade' }}>
              <Stack.Screen name="Onboarding" component={OnboardingScreen} />
              <Stack.Screen name="MainTabs" component={TabNavigator} />
              <Stack.Screen name="CollectionDetail" component={CollectionDetailScreen} />
              <Stack.Screen name="Search" component={SearchScreen} />
            </Stack.Navigator>
          </NavigationContainer>

          <TouchableOpacity
            style={styles.fab}
            onPress={() => setSaveBarVisible(true)}
          >
            <Plus color="#fff" size={26} strokeWidth={2.5} />
          </TouchableOpacity>

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
      </SafeAreaProvider>
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
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
  },
  toast: {
    position: 'absolute',
    bottom: 100,
    left: 24,
    right: 24,
    backgroundColor: colors.text,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    ...shadows.md,
  },
  toastText: {
    color: colors.textLight,
    fontSize: 14,
    fontWeight: '600',
  },
  webContainer: {
    flex: 1,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh' as any,
    width: '100vw' as any,
  },
  mobileWrapper: {
    width: 375,
    height: 812,
    maxHeight: '95vh' as any,
    backgroundColor: colors.background,
    borderRadius: 40,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.15,
    shadowRadius: 40,
    elevation: 20,
    borderWidth: 10,
    borderColor: colors.text,
  },
});
