import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, Image, TextInput,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { ExternalLink, FolderOpen, Clock, PenLine, X, Plus, Hash } from 'lucide-react-native';
import QueueItem from '../database/models/QueueItem';

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
  { id: 'open',       label: 'Open Link', Icon: ExternalLink, color: '#16a34a', bg: '#DCFCE7' },
  { id: 'move',       label: 'Move',      Icon: FolderOpen,  color: '#2563EB', bg: '#DBEAFE' },
  { id: 'timer',      label: 'Set Timer', Icon: Clock,       color: '#D97706', bg: '#FEF3C7' },
  { id: 'note',       label: 'Add Note',  Icon: PenLine,     color: '#6B7280', bg: '#F9FAFB' },
];

export default function SaveDetailSheet({ item, visible, onClose }: Props) {
  const [note, setNote] = useState('');

  if (!item) return null;

  const platform = getPlatformLabel(item.url, item.platform);

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      {/* Backdrop */}
      <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} activeOpacity={1} onPress={onClose} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}
      >
        <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', maxHeight: '88%' }}>
          {/* ── Header Thumbnail ── */}
          {item.thumbnail ? (
            <Image
              source={{ uri: item.thumbnail }}
              style={{ width: '100%', height: 180, backgroundColor: '#F3F4F6' }}
              resizeMode="cover"
            />
          ) : (
            <View style={{ width: '100%', height: 180, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 48 }}>🔗</Text>
            </View>
          )}

          {/* Close button over image */}
          <TouchableOpacity
            onPress={onClose}
            style={{
              position: 'absolute', top: 12, right: 12,
              width: 32, height: 32, borderRadius: 16,
              backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X color="#fff" size={18} />
          </TouchableOpacity>

          <ScrollView style={{ paddingHorizontal: 20, paddingTop: 16 }} showsVerticalScrollIndicator={false}>
            {/* ── Title ── */}
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#111827', lineHeight: 27, marginBottom: 10 }}>
              {item.title || item.url}
            </Text>

            {/* ── Metadata Row ── */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <View style={{ backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                <Text style={{ fontSize: 12, color: '#6B7280', fontWeight: '600' }}>{platform}</Text>
              </View>
              <Text style={{ fontSize: 12, color: '#9CA3AF' }}>{timeAgo(item.savedAt)}</Text>
              <Text style={{ fontSize: 12, color: '#9CA3AF' }}>• ~12 min</Text>
            </View>

            {/* ── 4 Action Buttons ── */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 }}>
              {ACTION_BUTTONS.map(({ id, label, Icon, color, bg }) => (
                <TouchableOpacity
                  key={id}
                  style={{ alignItems: 'center', gap: 6 }}
                >
                  <View style={{
                    width: 52, height: 52, borderRadius: 16,
                    backgroundColor: bg, alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon color={color} size={22} />
                  </View>
                  <Text style={{ fontSize: 11, color: '#6B7280', fontWeight: '500' }}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── "Why I saved this" Notes ── */}
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 8 }}>Why I saved this</Text>
            <TextInput
              style={{
                backgroundColor: '#F9FAFB',
                borderRadius: 12, padding: 12,
                fontSize: 14, color: '#111827',
                borderWidth: 1, borderColor: '#F3F4F6',
                minHeight: 80, textAlignVertical: 'top',
                marginBottom: 12,
              }}
              placeholder="Important insights, key takeaways…"
              placeholderTextColor="#9CA3AF"
              value={note}
              onChangeText={setNote}
              multiline
            />

            {/* ── Tags Row ── */}
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', paddingBottom: 40 }}>
              <View style={{ backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 }}>
                <Text style={{ fontSize: 12, color: '#6B7280', fontWeight: '500' }}>#tech</Text>
              </View>
              <View style={{ backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 }}>
                <Text style={{ fontSize: 12, color: '#6B7280', fontWeight: '500' }}>#ai</Text>
              </View>
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Plus color="#9CA3AF" size={14} />
                <Text style={{ fontSize: 12, color: '#9CA3AF' }}>Add Tag</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
