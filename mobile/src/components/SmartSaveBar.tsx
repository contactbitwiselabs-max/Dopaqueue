import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { X, Flag, Tag, FolderOpen, Clock } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '../constants/theme';
import { database } from '../database';
import QueueItem from '../database/models/QueueItem';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (data: { url: string; note: string; urgency: string; tag: string; collection: string }) => void;
}

const QUICK_ACTIONS = [
  { id: 'urgency',    label: 'Must See',   icon: Flag,       color: colors.danger, bg: '#FEF2F2' },
  { id: 'tag',        label: '+ Tag',       icon: Tag,        color: colors.textMuted, bg: colors.surface },
  { id: 'collection', label: 'Collection', icon: FolderOpen, color: colors.textMuted, bg: colors.surface },
  { id: 'timer',      label: 'Timer',      icon: Clock,      color: colors.textMuted, bg: colors.surface },
];

// Very simple NLP: highlight dates and #tags in the input text
function parseNLP(text: string): { urgency: string; tag: string; clean: string } {
  let urgency = '';
  let tag = '';
  let clean = text;

  const dateWords: Record<string, string> = {
    'today': 'High', 'tonight': 'High',
    'tomorrow': 'High',
    'this weekend': 'Medium', 'weekend': 'Medium',
    'next week': 'Low',
  };

  for (const [word, val] of Object.entries(dateWords)) {
    if (text.toLowerCase().includes(word)) { urgency = val; break; }
  }

  const tagMatch = text.match(/#(\w+)/);
  if (tagMatch) { tag = tagMatch[1]; }

  return { urgency, tag, clean };
}

export default function SmartSaveBar({ visible, onClose, onSave }: Props) {
  const [inputText, setInputText] = useState('');
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [uniqueTags, setUniqueTags] = useState<string[]>([]);

  useEffect(() => {
    if (visible) {
      // Fetch all unique tags when bar opens
      const fetchTags = async () => {
        const items = await database.collections.get<QueueItem>('queue_items').query().fetch();
        const tags = new Set<string>();
        items.forEach(i => {
          if (i.tags) {
            i.tags.split(',').forEach(t => tags.add(t.trim().replace(/^#/, '')));
          }
          if (i.note && i.note.includes('#')) {
            const match = i.note.match(/#(\w+)/g);
            if (match) match.forEach(t => tags.add(t.replace('#', '')));
          }
        });
        setUniqueTags(Array.from(tags));
      };
      fetchTags();
    }
  }, [visible]);

  const parsed = parseNLP(inputText);
  const hasUrl = inputText.startsWith('http') || inputText.includes('://');

  const handleSave = () => {
    if (!inputText.trim()) return;
    onSave({ url: inputText, note: '', urgency: parsed.urgency, tag: parsed.tag, collection: '' });
    setInputText('');
    onClose();
  };

  const currentTypingTag = inputText.match(/#(\w*)$/)?.[1];
  const suggestedTags = currentTypingTag !== undefined
    ? uniqueTags.filter(t => t.toLowerCase().startsWith(currentTypingTag.toLowerCase()))
    : [];

  const handleTagSelect = (tag: string) => {
    setInputText(inputText.replace(/#(\w*)$/, `#${tag} `));
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      {/* Backdrop */}
      <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} activeOpacity={1} onPress={onClose} />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}
      >
        <View style={{
          backgroundColor: colors.background,
          borderTopLeftRadius: 28, borderTopRightRadius: 28,
          paddingTop: spacing.md, paddingHorizontal: spacing.md, paddingBottom: spacing.xl,
        }}>
          {/* Drag handle */}
          <View style={{ width: 36, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.md }} />

          {/* ── Main Input ── */}
          <View style={{
            backgroundColor: colors.surface, borderRadius: borderRadius.xl, paddingHorizontal: 14, paddingVertical: 12,
            flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.md,
            borderWidth: 1, borderColor: inputText ? colors.primary : colors.surface,
          }}>
            <TextInput
              style={{ flex: 1, ...typography.body, color: colors.text, minHeight: 44, maxHeight: 120 }}
              placeholder="Paste link or type natural language…"
              placeholderTextColor={colors.textMuted}
              value={inputText}
              onChangeText={setInputText}
              multiline
              autoFocus
            />
            {inputText.length > 0 && (
              <TouchableOpacity onPress={() => setInputText('')} style={{ padding: 4, marginTop: 2 }}>
                <X color={colors.textMuted} size={16} />
              </TouchableOpacity>
            )}
          </View>

          {/* ── Tag Suggestions ── */}
          {suggestedTags.length > 0 && (
            <View style={{ marginBottom: spacing.md }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {suggestedTags.map(tag => (
                    <TouchableOpacity
                      key={tag}
                      onPress={() => handleTagSelect(tag)}
                      style={{ backgroundColor: '#DBEAFE', paddingHorizontal: 12, paddingVertical: 6, borderRadius: borderRadius.full }}
                    >
                      <Text style={{ fontSize: 13, color: colors.info, fontWeight: '600' }}>#{tag}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* ── NLP Detected Chips (shown when date/tag detected) ── */}
          {(parsed.urgency || parsed.tag) ? (
            <View style={{ marginBottom: spacing.md }}>
              <Text style={{ ...typography.caption, color: colors.textMuted, marginBottom: 6 }}>Detected</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {parsed.urgency ? (
                  <View style={{ backgroundColor: colors.primaryLight, paddingHorizontal: 10, paddingVertical: 5, borderRadius: borderRadius.full, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={{ fontSize: 12, color: colors.primaryDark, fontWeight: '600' }}>📅 {inputText.match(/(today|tomorrow|tonight|weekend|this weekend|next week)/i)?.[0]}</Text>
                  </View>
                ) : null}
                {parsed.tag ? (
                  <View style={{ backgroundColor: '#DBEAFE', paddingHorizontal: 10, paddingVertical: 5, borderRadius: borderRadius.full, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={{ fontSize: 12, color: colors.info, fontWeight: '600' }}>#{parsed.tag}</Text>
                  </View>
                ) : null}
                {parsed.urgency === 'Medium' || parsed.urgency === 'Low' ? (
                  <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 5, borderRadius: borderRadius.full }}>
                    <Text style={{ fontSize: 12, color: colors.warning, fontWeight: '600' }}>
                      {parsed.urgency === 'Medium' ? '🟡 Medium' : '🔵 Low'}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}

          {/* ── Quick Action Chips ── */}
          <Text style={{ ...typography.caption, color: colors.textMuted, marginBottom: 8 }}>Quick Actions</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {QUICK_ACTIONS.map(action => {
                const Ic = action.icon;
                const active = activeAction === action.id;
                return (
                  <TouchableOpacity
                    key={action.id}
                    onPress={() => setActiveAction(active ? null : action.id)}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 6,
                      paddingHorizontal: 14, paddingVertical: 9,
                      borderRadius: borderRadius.full,
                      backgroundColor: active ? action.bg : colors.surface,
                      borderWidth: 1,
                      borderColor: active ? action.color : colors.surface,
                    }}
                  >
                    <Ic color={active ? action.color : colors.textMuted} size={15} />
                    <Text style={{ ...typography.bodyMedium, fontSize: 13, color: active ? action.color : colors.text }}>
                      {action.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* ── Save Button ── */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={!inputText.trim()}
            style={{
              backgroundColor: colors.primary,
              borderRadius: borderRadius.xl, paddingVertical: 16,
              alignItems: 'center',
              opacity: inputText.trim() ? 1 : 0.4,
            }}
          >
            <Text style={{ ...typography.bodyMedium, fontSize: 16, color: colors.textLight }}>
              {hasUrl ? '⚡ Save to Inbox' : '⚡ Smart Save'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
