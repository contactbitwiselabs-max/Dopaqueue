import React, { useState } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, ScrollView, Switch, Alert, ActivityIndicator } from 'react-native';
import { Settings, User, Bell, Shield, LogOut, Cloud, ChevronRight } from 'lucide-react-native';
import { typography, spacing, borderRadius, useTheme } from '../constants/theme';
import { syncDatabase } from '../database/sync';

interface SettingRowProps {
  icon: React.ReactNode;
  label: string;
  right?: React.ReactNode;
  textColor?: string;
  borderBottom?: boolean;
}

const SettingRow = ({ icon, label, right, textColor, borderBottom = true }: SettingRowProps) => {
  const { colors: themeColors } = useTheme();
  return (
    <View style={{ 
      flexDirection: 'row', 
      alignItems: 'center', 
      padding: spacing.md, 
      borderBottomWidth: borderBottom ? 1 : 0, 
      borderBottomColor: themeColors.border 
    }}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: themeColors.surface, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md }}>
        {icon}
      </View>
      <Text style={{ flex: 1, ...typography.body, color: textColor || themeColors.text }}>{label}</Text>
      {right || <ChevronRight color={themeColors.textMuted} size={20} />}
    </View>
  );
};

export default function ProfileScreen() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const { colors: themeColors, isDark } = useTheme();

  const handleSync = async () => {
    try {
      setIsSyncing(true);
      await syncDatabase();
      setLastSync(new Date().toLocaleTimeString());
      Alert.alert('Sync Complete', 'Your queue is up to date.');
    } catch (e: any) {
      Alert.alert('Sync Failed', e.message || 'Please check your connection and Supabase credentials.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* ── Header ── */}
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.lg }}>
          <Text style={{ ...typography.h1, color: themeColors.text }}>Profile</Text>
        </View>

        {/* ── Profile Info ── */}
        <View style={{ alignItems: 'center', marginBottom: spacing.xxl }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: themeColors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md }}>
            <User color={themeColors.primaryDark} size={40} />
          </View>
          <Text style={{ ...typography.h2, color: themeColors.text, marginBottom: 4 }}>Alex Hunter</Text>
          <Text style={{ ...typography.body, color: themeColors.textMuted }}>alex@dopaqueue.app</Text>
        </View>

        {/* ── Cloud Sync ── */}
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.xl }}>
          <Text style={{ ...typography.h3, color: themeColors.text, marginBottom: spacing.md }}>Cloud Sync</Text>
          <View style={{ backgroundColor: themeColors.surface, borderRadius: borderRadius.lg, padding: spacing.md, gap: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <Cloud color={themeColors.textMuted} size={24} />
                <View>
                  <Text style={{ ...typography.bodyMedium, color: themeColors.text }}>Supabase Sync</Text>
                  <Text style={{ ...typography.caption, color: themeColors.textMuted }}>
                    {lastSync ? `Last synced: ${lastSync}` : 'Sync your saves across devices'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={handleSync}
                disabled={isSyncing}
                style={{
                  backgroundColor: themeColors.primary,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: borderRadius.full,
                  opacity: isSyncing ? 0.7 : 1
                }}
              >
                {isSyncing ? (
                  <ActivityIndicator color={themeColors.textLight} size="small" />
                ) : (
                  <Text style={{ ...typography.bodyMedium, color: themeColors.textLight, fontSize: 13 }}>Sync Now</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── Settings Sections ── */}
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.xl }}>
          <Text style={{ ...typography.h3, color: themeColors.text, marginBottom: spacing.md }}>Preferences</Text>
          <View style={{ backgroundColor: themeColors.surface, borderRadius: borderRadius.lg, overflow: 'hidden' }}>
            <SettingRow
              icon={<Bell color={themeColors.textMuted} size={20} />}
              label="Push Notifications"
              right={<Switch value={notificationsEnabled} onValueChange={setNotificationsEnabled} trackColor={{ true: themeColors.primary }} />}
            />
            <SettingRow
              icon={<Settings color={themeColors.textMuted} size={20} />}
              label="Dark Mode"
              right={<Switch value={isDark} disabled trackColor={{ true: themeColors.primary }} />}
              borderBottom={false}
            />
          </View>
        </View>

        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.xl }}>
          <Text style={{ ...typography.h3, color: themeColors.text, marginBottom: spacing.md }}>Account</Text>
          <View style={{ backgroundColor: themeColors.surface, borderRadius: borderRadius.lg, overflow: 'hidden' }}>
            <SettingRow
              icon={<Shield color={themeColors.textMuted} size={20} />}
              label="Privacy & Security"
            />
            <SettingRow
              icon={<LogOut color={themeColors.danger} size={20} />}
              label="Sign Out"
              textColor={themeColors.danger}
              borderBottom={false}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
