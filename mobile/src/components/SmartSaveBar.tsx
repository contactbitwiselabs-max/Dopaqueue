import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal,
  KeyboardAvoidingView, Platform, ScrollView, Alert
} from 'react-native';
import { X, Flag, Tag, FolderOpen, Clock } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { typography, spacing, borderRadius, useTheme } from '../constants/theme';
import { database } from '../database';
import QueueItem from '../database/models/QueueItem';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (data: { url: string; note: string; urgency: string; tag: string; collection: string }) => void;
  initialValue?: string;
}

// Very simple NLP: detect dates and #tags in the input text
function parseNLP(text: string): { urgency: string; tag: string; clean: string } {
  let urgency = '';
  let tag = '';
  const clean = text; // We keep clean = text; URL/note split happens at save time

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

export default function SmartSaveBar({ visible, onClose, onSave, initialValue }: Props) {
  const { colors: themeColors } = useTheme();

  const [inputText, setInputText] = useState('');
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [uniqueTags, setUniqueTags] = useState<string[]>([]);

  // Quick actions use theme colors — defined inside component
  const QUICK_ACTIONS = [
    { id: 'urgency',    label: 'Must See',   icon: Flag,       color: themeColors.danger,    bg: '#FEF2F2' },
    { id: 'tag',        label: '+ Tag',       icon: Tag,        color: themeColors.textMuted,  bg: themeColors.surface },
    { id: 'collection', label: 'Collection', icon: FolderOpen, color: themeColors.textMuted,  bg: themeColors.surface },
    { id: 'timer',      label: 'Timer',      icon: Clock,      color: themeColors.textMuted,  bg: themeColors.surface },
  ];

  // Save Templates (Presets)
  const TEMPLATES = [
    { id: 'research', label: 'Research', icon: '🧠', tag: 'research', collection: 'Learn & Grow' },
    { id: 'watch', label: 'Watch Later', icon: '🍿', tag: 'video', collection: 'Watchlist' },
    { id: 'read', label: 'Read Later', icon: '📖', tag: 'article', collection: 'Reading List' },
  ];

  const applyTemplate = (template: typeof TEMPLATES[0]) => {
    let newText = inputText;
    if (!newText.includes(`#${template.tag}`)) {
      newText += ` #${template.tag}`;
    }
    setInputText(newText.trim());
  };

  useEffect(() => {
    if (visible) {
      const fetchTags = async () => {
        const items = await database.collections.get<QueueItem>('queue_items').query().fetch();
        const tags = new Set<string>();
        items.forEach(i => {
          if (i.tags) {
            i.tags.split(',').forEach((t: string) => tags.add(t.trim().replace(/^#/, '')));
          }
          if (i.note && i.note.includes('#')) {
            const match = i.note.match(/#(\w+)/g);
            if (match) match.forEach((t: string) => tags.add(t.replace('#', '')));
          }
        });
        setUniqueTags(Array.from(tags).filter(Boolean));
      };
      fetchTags();
      if (initialValue) {
        setInputText(initialValue);
      }
    } else {
      // Reset state when closed
      setInputText('');
      setActiveAction(null);
    }
  }, [visible, initialValue]);

  const parsed = parseNLP(inputText);
  const hasUrl = inputText.startsWith('http') || inputText.includes('://');

  const handleSave = async () => {
    if (!inputText.trim()) return;

    // Digital Wellbeing: Daily Save Limit Check
    try {
      const today = new Date().toDateString();
      const lastSaveDate = await AsyncStorage.getItem('last_save_date');
      const saveCountStr = await AsyncStorage.getItem('daily_saves_count');
      let saveCount = saveCountStr ? parseInt(saveCountStr, 10) : 0;

      if (lastSaveDate !== today) {
        saveCount = 0;
        await AsyncStorage.setItem('last_save_date', today);
      }

      if (saveCount >= 10) {
        Alert.alert(
          'Dopamine Budget Exceeded 🛑',
          "You've saved a lot today! Try processing your Inbox before saving more.",
          [{ text: 'Got it' }]
        );
        return;
      }

      await AsyncStorage.setItem('daily_saves_count', (saveCount + 1).toString());
    } catch (e) {
      console.warn('Failed to check save limit', e);
    }

    const { urgency, tag } = parsed;

    // Extract URL from text (first http(s) token)
    const words = inputText.split(/\s+/);
    const urlToken = words.find(w => w.startsWith('http'));
    const url = urlToken || '';
    // Everything that isn't the URL is the note
    const note = words.filter(w => !w.startsWith('http')).join(' ').trim();

    // Smart Routing Heuristics based on URL
    let finalCollection = '';
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) {
      finalCollection = 'Watchlist';
    } else if (lowerUrl.includes('medium.com') || lowerUrl.includes('substack.com')) {
      finalCollection = 'Reading List';
    } else if (lowerUrl.includes('github.com')) {
      finalCollection = 'Code';
    }

    onSave({ url, note, urgency, tag, collection: finalCollection });
    setInputText('');
    setActiveAction(null);
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
          backgroundColor: themeColors.background,
          borderTopLeftRadius: 28, borderTopRightRadius: 28,
          paddingTop: spacing.md, paddingHorizontal: spacing.md, paddingBottom: spacing.xl,
        }}>
          {/* Drag handle */}
          <View style={{ width: 36, height: 4, backgroundColor: themeColors.border, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.md }} />

          {/* ── Main Input ── */}
          <View style={{
            backgroundColor: themeColors.surface, borderRadius: borderRadius.xl, paddingHorizontal: 14, paddingVertical: 12,
            flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.md,
            borderWidth: 1, borderColor: inputText ? themeColors.primary : themeColors.border,
          }}>
            <TextInput
              style={{ flex: 1, ...typography.body, color: themeColors.text, minHeight: 44, maxHeight: 120 }}
              placeholder="Paste link or type natural language…"
              placeholderTextColor={themeColors.textMuted}
              value={inputText}
              onChangeText={setInputText}
              multiline
              autoFocus
            />
            {inputText.length > 0 && (
              <TouchableOpacity onPress={() => setInputText('')} style={{ padding: 4, marginTop: 2 }}>
                <X color={themeColors.textMuted} size={16} />
              </TouchableOpacity>
            )}
          </View>

          {/* ── Tag Suggestions ── */}
          {suggestedTags.length > 0 && (
            <View style={{ marginBottom: spacing.md }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {suggestedTags.map(t => (
                    <TouchableOpacity
                      key={t}
                      onPress={() => handleTagSelect(t)}
                      style={{ backgroundColor: '#DBEAFE', paddingHorizontal: 12, paddingVertical: 6, borderRadius: borderRadius.full }}
                    >
                      <Text style={{ fontSize: 13, color: themeColors.info, fontWeight: '600' }}>#{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* ── NLP Detected Chips ── */}
          {(parsed.urgency || parsed.tag) ? (
            <View style={{ marginBottom: spacing.md }}>
              <Text style={{ ...typography.caption, color: themeColors.textMuted, marginBottom: 6 }}>Detected</Text>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {parsed.urgency ? (
                  <View style={{ backgroundColor: themeColors.primaryLight, paddingHorizontal: 10, paddingVertical: 5, borderRadius: borderRadius.full, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={{ fontSize: 12, color: themeColors.primaryDark, fontWeight: '600' }}>
                      📅 {inputText.match(/(today|tomorrow|tonight|weekend|this weekend|next week)/i)?.[0]}
                    </Text>
                  </View>
                ) : null}
                {parsed.tag ? (
                  <View style={{ backgroundColor: '#DBEAFE', paddingHorizontal: 10, paddingVertical: 5, borderRadius: borderRadius.full }}>
                    <Text style={{ fontSize: 12, color: themeColors.info, fontWeight: '600' }}>#{parsed.tag}</Text>
                  </View>
                ) : null}
                {parsed.urgency === 'Medium' ? (
                  <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 5, borderRadius: borderRadius.full }}>
                    <Text style={{ fontSize: 12, color: themeColors.warning, fontWeight: '600' }}>🟡 Medium</Text>
                  </View>
                ) : null}
                {parsed.urgency === 'Low' ? (
                  <View style={{ backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: borderRadius.full }}>
                    <Text style={{ fontSize: 12, color: themeColors.info, fontWeight: '600' }}>🔵 Low</Text>
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}

          {/* ── Quick Action Chips ── */}
          <Text style={{ ...typography.caption, color: themeColors.textMuted, marginBottom: 8 }}>Quick Actions</Text>
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
                      backgroundColor: active ? action.bg : themeColors.surface,
                      borderWidth: 1,
                      borderColor: active ? action.color : themeColors.border,
                    }}
                  >
                    <Ic color={active ? action.color : themeColors.textMuted} size={15} />
                    <Text style={{ ...typography.bodyMedium, fontSize: 13, color: active ? action.color : themeColors.text }}>
                      {action.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* ── Save Templates ── */}
          <Text style={{ ...typography.caption, color: themeColors.textMuted, marginBottom: 8 }}>Templates</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {TEMPLATES.map(tmpl => (
                <TouchableOpacity
                  key={tmpl.id}
                  onPress={() => applyTemplate(tmpl)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    paddingHorizontal: 12, paddingVertical: 8,
                    borderRadius: borderRadius.full,
                    backgroundColor: themeColors.surface,
                    borderWidth: 1, borderColor: themeColors.border,
                  }}
                >
                  <Text>{tmpl.icon}</Text>
                  <Text style={{ ...typography.bodyMedium, fontSize: 13, color: themeColors.text }}>
                    {tmpl.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* ── Save Button ── */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={!inputText.trim()}
            style={{
              backgroundColor: themeColors.primary,
              borderRadius: borderRadius.xl, paddingVertical: 16,
              alignItems: 'center',
              opacity: inputText.trim() ? 1 : 0.4,
            }}
          >
            <Text style={{ ...typography.bodyMedium, fontSize: 16, color: themeColors.textLight }}>
              {hasUrl ? '⚡ Save to Inbox' : '⚡ Smart Save'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
