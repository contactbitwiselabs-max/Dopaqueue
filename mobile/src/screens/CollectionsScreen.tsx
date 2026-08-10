import React, { useState } from 'react';
import {
  View, Text, ScrollView, SafeAreaView, TouchableOpacity, Modal,
  TextInput, Dimensions,
} from 'react-native';
import withObservables from '@nozbe/with-observables';
import { database } from '../database';
import Collection from '../database/models/Collection';
import QueueItem from '../database/models/QueueItem';
import { Q } from '@nozbe/watermelondb';
import { Plus, X, Brain, Popcorn, Code2, BookOpen, Lightbulb, Briefcase, Star, Heart, Music, Globe } from 'lucide-react-native';

const { width } = Dimensions.get('window');
const CARD_SIZE = (width - 48) / 2; // 2 columns, 16px side padding + 16px gap

// Icon picker options for new collection modal
const ICON_OPTIONS = [
  { key: 'brain',    icon: Brain,     color: '#7C3AED', bg: '#EDE9FE' },
  { key: 'popcorn',  icon: Popcorn,   color: '#DC2626', bg: '#FEE2E2' },
  { key: 'code',     icon: Code2,     color: '#2563EB', bg: '#DBEAFE' },
  { key: 'book',     icon: BookOpen,  color: '#9333EA', bg: '#F3E8FF' },
  { key: 'idea',     icon: Lightbulb, color: '#D97706', bg: '#FEF3C7' },
  { key: 'work',     icon: Briefcase, color: '#0D9488', bg: '#CCFBF1' },
  { key: 'star',     icon: Star,      color: '#F59E0B', bg: '#FEF3C7' },
  { key: 'heart',    icon: Heart,     color: '#E11D48', bg: '#FFE4E6' },
  { key: 'music',    icon: Music,     color: '#8B5CF6', bg: '#EDE9FE' },
  { key: 'globe',    icon: Globe,     color: '#0369A1', bg: '#E0F2FE' },
];

const COLOR_OPTIONS = ['#16a34a', '#2563EB', '#7C3AED', '#DC2626', '#D97706', '#0D9488', '#E11D48', '#F59E0B'];

// Preset collections to seed in case DB is empty (matching the mockup)
const PRESET_COLLECTIONS = [
  { name: 'Learn & Grow',    icon: 'brain',   color: '#7C3AED', bg: '#EDE9FE', count: 24 },
  { name: 'Entertainment',   icon: 'popcorn', color: '#DC2626', bg: '#FEE2E2', count: 18 },
  { name: 'Coding',          icon: 'code',    color: '#2563EB', bg: '#DBEAFE', count: 32 },
  { name: 'Books & Articles',icon: 'book',    color: '#9333EA', bg: '#F3E8FF', count: 15 },
  { name: 'Ideas & Inspiration', icon: 'idea', color: '#D97706', bg: '#FEF3C7', count: 9 },
  { name: 'Work & Career',   icon: 'work',    color: '#0D9488', bg: '#CCFBF1', count: 12 },
];

function getIconConfig(key?: string) {
  return ICON_OPTIONS.find(i => i.key === key) || ICON_OPTIONS[0];
}

interface Props {
  collections: Collection[];
  totalSaved: number;
}

const CollectionsScreenComponent = ({ collections, totalSaved }: Props) => {
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('brain');
  const [selectedColor, setSelectedColor] = useState('#16a34a');

  // Merge real DB collections with presets for display
  const displayItems = collections.length > 0
    ? collections.map(c => ({
        id: c.id,
        name: c.name,
        icon: (c as any).icon || 'brain',
        color: c.color || '#16a34a',
        bg: getIconConfig((c as any).icon).bg,
        count: 0, // TODO: query count per collection
      }))
    : PRESET_COLLECTIONS.map((p, i) => ({ id: String(i), ...p }));

  const handleCreateCollection = async () => {
    if (!newName.trim()) return;
    await database.write(async () => {
      await database.get<Collection>('collections').create(c => {
        c.name = newName.trim();
        c.color = selectedColor;
        (c as any).icon = selectedIcon;
      });
    });
    setNewName('');
    setAddModalVisible(false);
  };

  const renderCollectionCard = (item: typeof displayItems[0]) => {
    const iconConf = getIconConfig(item.icon);
    const IconComp = iconConf.icon;
    return (
      <View key={item.id} style={{ flex: 1 }}>
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: '#ffffff',
            borderRadius: 20,
            padding: 16,
            minHeight: 160,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.06,
            shadowRadius: 4,
            elevation: 2,
            justifyContent: 'space-between',
          }}
        >
          {/* Icon block */}
          <View style={{
            width: 52, height: 52, borderRadius: 14,
            backgroundColor: iconConf.bg,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <IconComp color={item.color} size={28} />
          </View>
          {/* Bottom text */}
          <View>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 2 }} numberOfLines={2}>
              {item.name}
            </Text>
            {/* Progress bar */}
            <View style={{ height: 3, backgroundColor: '#F3F4F6', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
              <View style={{ width: `${Math.min(100, (item.count / 40) * 100)}%` as any, height: '100%', backgroundColor: item.color, borderRadius: 2 }} />
            </View>
            <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>{item.count} saved</Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      {/* ── Header ── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 }}>
        <Text style={{ flex: 1, fontSize: 28, fontWeight: '800', color: '#111827' }}>Collections</Text>
        <TouchableOpacity
          onPress={() => setAddModalVisible(true)}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#16a34a', alignItems: 'center', justifyContent: 'center' }}
        >
          <Plus color="#fff" size={20} />
        </TouchableOpacity>
      </View>

      {/* ── 2-column Grid using ScrollView for cross-platform compatibility ── */}
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {Array.from({ length: Math.ceil(displayItems.length / 2) }, (_, rowIndex) => {
          const left = displayItems[rowIndex * 2];
          const right = displayItems[rowIndex * 2 + 1];
          return (
            <View key={rowIndex} style={{ flexDirection: 'row', gap: 16, marginBottom: 16 }}>
              {left ? renderCollectionCard(left) : null}
              {right ? renderCollectionCard(right) : <View style={{ flex: 1 }} />}
            </View>
          );
        })}
      </ScrollView>

      {/* ── Add Collection Modal ── */}
      <Modal visible={addModalVisible} transparent animationType="slide">
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} activeOpacity={1} onPress={() => setAddModalVisible(false)} />
        <View style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28,
          padding: 24, paddingBottom: 40,
        }}>
          {/* Modal Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
            <Text style={{ flex: 1, fontSize: 20, fontWeight: '800', color: '#111827' }}>New Collection</Text>
            <TouchableOpacity onPress={() => setAddModalVisible(false)}>
              <X color="#9CA3AF" size={24} />
            </TouchableOpacity>
          </View>

          {/* Icon Preview */}
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <View style={{
              width: 80, height: 80, borderRadius: 24,
              backgroundColor: getIconConfig(selectedIcon).bg,
              alignItems: 'center', justifyContent: 'center',
            }}>
              {(() => { const I = getIconConfig(selectedIcon).icon; return <I color={getIconConfig(selectedIcon).color} size={40} />; })()}
            </View>
          </View>

          {/* Collection Name */}
          <TextInput
            value={newName}
            onChangeText={setNewName}
            placeholder="Collection Name"
            placeholderTextColor="#9CA3AF"
            style={{
              backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14,
              fontSize: 16, color: '#111827', borderWidth: 1, borderColor: '#F3F4F6',
              marginBottom: 20,
            }}
          />

          {/* Choose Icon */}
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#6B7280', marginBottom: 10 }}>Choose Icon</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
            {ICON_OPTIONS.map(opt => {
              const Ic = opt.icon;
              const active = selectedIcon === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => setSelectedIcon(opt.key)}
                  style={{
                    width: 48, height: 48, borderRadius: 14, marginRight: 10,
                    backgroundColor: opt.bg,
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: active ? 2 : 0,
                    borderColor: opt.color,
                  }}
                >
                  <Ic color={opt.color} size={24} />
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Choose Color */}
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#6B7280', marginBottom: 10 }}>Choose Color</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
            {COLOR_OPTIONS.map(col => (
              <TouchableOpacity
                key={col}
                onPress={() => setSelectedColor(col)}
                style={{
                  width: 32, height: 32, borderRadius: 16,
                  backgroundColor: col,
                  borderWidth: selectedColor === col ? 3 : 0,
                  borderColor: '#fff',
                  shadowColor: col,
                  shadowOpacity: selectedColor === col ? 0.5 : 0,
                  shadowOffset: { width: 0, height: 2 },
                  shadowRadius: 4,
                  elevation: selectedColor === col ? 4 : 0,
                }}
              />
            ))}
          </View>

          {/* Create Button */}
          <TouchableOpacity
            onPress={handleCreateCollection}
            style={{
              backgroundColor: '#16a34a', borderRadius: 14,
              paddingVertical: 16, alignItems: 'center',
              opacity: newName.trim().length > 0 ? 1 : 0.5,
            }}
            disabled={!newName.trim()}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>Create Collection</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const enhance = withObservables([], () => ({
  collections: database.collections.get<Collection>('collections').query(Q.sortBy('name', Q.asc)),
  totalSaved: database.collections.get<QueueItem>('queue_items').query(Q.where('deleted', false)).observeCount(),
}));

export default enhance(CollectionsScreenComponent);
