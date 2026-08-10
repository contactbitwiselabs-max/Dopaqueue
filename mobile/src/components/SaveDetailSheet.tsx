import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, Image, TextInput,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { ExternalLink, FolderOpen, Clock, PenLine, X, Plus, Hash } from 'lucide-react-native';
import QueueItem from '../database/models/QueueItem';
import { colors, spacing, typography, borderRadius } from '../constants/theme';
import { scheduleReminder } from '../utils/notifications';
import { Alert } from 'react-native';

interface Props {
  item: QueueItem | null;
  visible: boolean;
  onClose: () => void;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function getPlatformLabel(url: string, platform?: string): string {
  const u = (platform || url || '').toLowerCase();
  if (u.includes('youtube') || u.includes('youtu.be')) return 'YouTube';
  if (u.includes('twitter') || u.includes('x.com'))   return 'X (Twitter)';
  if (u.includes('instagram'))                         return 'Instagram';
  return 'Link';
}

const ACTION_BUTTONS = [
  { id: 'open',       label: 'Open Link', Icon: ExternalLink, color: colors.primary, bg: colors.primaryLight },
  { id: 'move',       label: 'Move',      Icon: FolderOpen,  color: colors.info, bg: '#DBEAFE' },
  { id: 'timer',      label: 'Set Timer', Icon: Clock,       color: colors.warning, bg: '#FEF3C7' },
  { id: 'note',       label: 'Add Note',  Icon: PenLine,     color: colors.textMuted, bg: colors.surface },
];

export default function SaveDetailSheet({ item, visible, onClose }: Props) {
  const [note, setNote] = useState('');

  if (!item) return null;

  const platform = getPlatformLabel(item.url, item.platform);

  const handleAction = (id: string) => {
    if (id === 'timer') {
      Alert.alert(
        'Set Reminder',
        'When do you want to be reminded?',
        [
          { text: 'In 1 hour', onPress: () => { scheduleReminder(item, 3600); Alert.alert('Reminder set!'); } },
          { text: 'Tomorrow', onPress: () => { scheduleReminder(item, 86400); Alert.alert('Reminder set!'); } },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      {/* Backdrop */}
      <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} activeOpacity={1} onPress={onClose} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}
      >
        <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', maxHeight: '88%' }}>
          {/* ── Header Thumbnail ── */}
          {item.thumbnail ? (
            <Image
              source={{ uri: item.thumbnail }}
              style={{ width: '100%', height: 180, backgroundColor: colors.surface }}
              resizeMode="cover"
            />
          ) : (
            <View style={{ width: '100%', height: 180, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 48 }}>🔗</Text>
            </View>
          )}

          {/* Close button over image */}
          <TouchableOpacity
            onPress={onClose}
            style={{
              position: 'absolute', top: spacing.md, right: spacing.md,
              width: 32, height: 32, borderRadius: borderRadius.full,
              backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X color={colors.textLight} size={18} />
          </TouchableOpacity>

          <ScrollView style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }} showsVerticalScrollIndicator={false}>
            {/* ── Title ── */}
            <Text style={{ ...typography.h3, color: colors.text, lineHeight: 27, marginBottom: spacing.sm }}>
              {item.title || item.url}
            </Text>

            {/* ── Metadata Row ── */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.lg }}>
              <View style={{ backgroundColor: colors.surface, paddingHorizontal: 8, paddingVertical: 3, borderRadius: borderRadius.sm }}>
                <Text style={{ ...typography.caption, color: colors.textMuted, fontWeight: '600' }}>{platform}</Text>
              </View>
              <Text style={{ ...typography.caption, color: colors.textMuted }}>{timeAgo(item.savedAt)}</Text>
              <Text style={{ ...typography.caption, color: colors.textMuted }}>• ~12 min</Text>
            </View>

            {/* ── 4 Action Buttons ── */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xl }}>
              {ACTION_BUTTONS.map(({ id, label, Icon, color, bg }) => (
                <TouchableOpacity
                  key={id}
                  onPress={() => handleAction(id)}
                  style={{ alignItems: 'center', gap: 6 }}
                >
                  <View style={{
                    width: 52, height: 52, borderRadius: borderRadius.xl,
                    backgroundColor: bg, alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon color={color} size={22} />
                  </View>
                  <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '500' }}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── "Why I saved this" Notes ── */}
            <Text style={{ ...typography.bodyMedium, color: colors.text, marginBottom: spacing.sm }}>Why I saved this</Text>
            <TextInput
              style={{
                backgroundColor: colors.surface,
                borderRadius: borderRadius.lg, padding: spacing.md,
                ...typography.body, color: colors.text,
                borderWidth: 1, borderColor: colors.border,
                minHeight: 80, textAlignVertical: 'top',
                marginBottom: spacing.md,
              }}
              placeholder="Important insights, key takeaways…"
              placeholderTextColor={colors.textMuted}
              value={note}
              onChangeText={setNote}
              multiline
            />

            {/* ── Tags Row ── */}
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', paddingBottom: 40 }}>
              <View style={{ backgroundColor: colors.surface, paddingHorizontal: 10, paddingVertical: 5, borderRadius: borderRadius.full }}>
                <Text style={{ fontSize: 12, color: colors.textMuted, fontWeight: '500' }}>#tech</Text>
              </View>
              <View style={{ backgroundColor: colors.surface, paddingHorizontal: 10, paddingVertical: 5, borderRadius: borderRadius.full }}>
                <Text style={{ fontSize: 12, color: colors.textMuted, fontWeight: '500' }}>#ai</Text>
              </View>
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Plus color={colors.textMuted} size={14} />
                <Text style={{ fontSize: 12, color: colors.textMuted }}>Add Tag</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
