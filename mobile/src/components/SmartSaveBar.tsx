import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal,
  KeyboardAvoidingView, Platform, ScrollView, Animated,
} from 'react-native';
import { X, Flag, Tag, FolderOpen, Clock, Mic } from 'lucide-react-native';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (data: { url: string; note: string; urgency: string; tag: string; collection: string }) => void;
}

const QUICK_ACTIONS = [
  { id: 'urgency',    label: 'Must See',   icon: Flag,       color: '#EF4444', bg: '#FEF2F2' },
  { id: 'tag',        label: '+ Tag',       icon: Tag,        color: '#6B7280', bg: '#F9FAFB' },
  { id: 'collection', label: 'Collection', icon: FolderOpen, color: '#6B7280', bg: '#F9FAFB' },
  { id: 'timer',      label: 'Timer',      icon: Clock,      color: '#6B7280', bg: '#F9FAFB' },
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

  const parsed = parseNLP(inputText);
  const hasUrl = inputText.startsWith('http') || inputText.includes('://');

  const handleSave = () => {
    if (!inputText.trim()) return;
    onSave({ url: inputText, note: '', urgency: parsed.urgency, tag: parsed.tag, collection: '' });
    setInputText('');
    onClose();
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
          backgroundColor: '#fff',
          borderTopLeftRadius: 28, borderTopRightRadius: 28,
          paddingTop: 16, paddingHorizontal: 16, paddingBottom: 32,
        }}>
          {/* Drag handle */}
          <View style={{ width: 36, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 16 }} />

          {/* ── Main Input ── */}
          <View style={{
            backgroundColor: '#F9FAFB', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
            flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12,
            borderWidth: 1, borderColor: inputText ? '#16a34a' : '#F3F4F6',
          }}>
            <TextInput
              style={{ flex: 1, fontSize: 15, color: '#111827', minHeight: 44, maxHeight: 120 }}
              placeholder="Paste link or type natural language…"
              placeholderTextColor="#9CA3AF"
              value={inputText}
              onChangeText={setInputText}
              multiline
              autoFocus
            />
            {inputText.length > 0 && (
              <TouchableOpacity onPress={() => setInputText('')} style={{ padding: 4, marginTop: 2 }}>
                <X color="#9CA3AF" size={16} />
              </TouchableOpacity>
            )}
          </View>

          {/* ── NLP Detected Chips (shown when date/tag detected) ── */}
          {(parsed.urgency || parsed.tag) ? (
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 6 }}>Detected</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {parsed.urgency ? (
                  <View style={{ backgroundColor: '#DCFCE7', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={{ fontSize: 12, color: '#16a34a', fontWeight: '600' }}>📅 {inputText.match(/(today|tomorrow|tonight|weekend|this weekend|next week)/i)?.[0]}</Text>
                  </View>
                ) : null}
                {parsed.tag ? (
                  <View style={{ backgroundColor: '#DBEAFE', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={{ fontSize: 12, color: '#2563EB', fontWeight: '600' }}>#{parsed.tag}</Text>
                  </View>
                ) : null}
                {parsed.urgency === 'Medium' || parsed.urgency === 'Low' ? (
                  <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 }}>
                    <Text style={{ fontSize: 12, color: '#D97706', fontWeight: '600' }}>
                      {parsed.urgency === 'Medium' ? '🟡 Medium' : '🔵 Low'}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}

          {/* ── Quick Action Chips ── */}
          <Text style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 8 }}>Quick Actions</Text>
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
                      borderRadius: 99,
                      backgroundColor: active ? action.bg : '#F9FAFB',
                      borderWidth: 1,
                      borderColor: active ? action.color : '#F3F4F6',
                    }}
                  >
                    <Ic color={active ? action.color : '#6B7280'} size={15} />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: active ? action.color : '#374151' }}>
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
              backgroundColor: '#16a34a',
              borderRadius: 14, paddingVertical: 16,
              alignItems: 'center',
              opacity: inputText.trim() ? 1 : 0.4,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>
              {hasUrl ? '⚡ Save to Inbox' : '⚡ Smart Save'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
