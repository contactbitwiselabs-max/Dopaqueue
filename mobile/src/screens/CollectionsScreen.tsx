import React, { useState } from 'react';
import {
  View, Text, ScrollView, SafeAreaView, TouchableOpacity, Modal,
  TextInput, Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import withObservables from '@nozbe/with-observables';
import { database } from '../database';
import Collection from '../database/models/Collection';
import QueueItem from '../database/models/QueueItem';
import { Q } from '@nozbe/watermelondb';
import { Plus, X, Brain, Popcorn, Code2, BookOpen, Lightbulb, Briefcase, Star, Heart, Music, Globe } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius, shadows } from '../constants/theme';

const { width } = Dimensions.get('window');
const CARD_SIZE = (width - spacing.xxl) / 2; // 2 columns, padding considerations

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

const COLOR_OPTIONS = [colors.primary, colors.info, '#7C3AED', colors.danger, colors.warning, '#0D9488', '#E11D48', '#F59E0B'];

function getIconConfig(key?: string) {
  return ICON_OPTIONS.find(i => i.key === key) || ICON_OPTIONS[0];
}

const CollectionCard = ({ collection, count, onPress }: { collection: Collection, count: number, onPress: () => void }) => {
  const iconConf = getIconConfig((collection as any).icon);
  const IconComp = iconConf.icon;
  return (
    <View style={{ flex: 1 }}>
      <TouchableOpacity
        onPress={onPress}
        style={{
          flex: 1,
          backgroundColor: colors.background,
          borderRadius: borderRadius.xl,
          padding: spacing.md,
          minHeight: 160,
          ...shadows.sm,
          justifyContent: 'space-between',
        }}
      >
        <View style={{
          width: 52, height: 52, borderRadius: borderRadius.lg,
          backgroundColor: iconConf.bg,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <IconComp color={collection.color || colors.primary} size={28} />
        </View>
        <View>
          <Text style={{ ...typography.bodyMedium, fontSize: 15, color: colors.text, marginBottom: 2 }} numberOfLines={2}>
            {collection.name}
          </Text>
          <View style={{ height: 3, backgroundColor: colors.surface, borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
            <View style={{ width: `${Math.min(100, (count / 40) * 100)}%` as any, height: '100%', backgroundColor: collection.color || colors.primary, borderRadius: 2 }} />
          </View>
          <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: 4 }}>{count} saved</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const EnhancedCollectionCard = withObservables(['collection'], ({ collection }: { collection: Collection }) => ({
  collection,
  count: database.collections.get<QueueItem>('queue_items').query(Q.where('collection', collection.name), Q.where('deleted', false)).observeCount()
}))(CollectionCard);

interface Props {
  collections: Collection[];
  totalSaved: number;
}

const CollectionsScreenComponent = ({ collections, totalSaved }: Props) => {
  const navigation = useNavigation<any>();
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('brain');
  const [selectedColor, setSelectedColor] = useState(colors.primary);

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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
      {/* ── Header ── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md }}>
        <Text style={{ flex: 1, ...typography.h1, color: colors.text }}>Collections</Text>
        <TouchableOpacity
          onPress={() => setAddModalVisible(true)}
          style={{ width: 36, height: 36, borderRadius: borderRadius.full, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}
        >
          <Plus color={colors.textLight} size={20} />
        </TouchableOpacity>
      </View>

      {/* ── 2-column Grid using ScrollView for cross-platform compatibility ── */}
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {Array.from({ length: Math.ceil(collections.length / 2) }, (_, rowIndex) => {
          const left = collections[rowIndex * 2];
          const right = collections[rowIndex * 2 + 1];
          return (
            <View key={rowIndex} style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md }}>
              {left ? <EnhancedCollectionCard collection={left} onPress={() => navigation.navigate('CollectionDetail', { collectionName: left.name })} /> : <View style={{ flex: 1 }} />}
              {right ? <EnhancedCollectionCard collection={right} onPress={() => navigation.navigate('CollectionDetail', { collectionName: right.name })} /> : <View style={{ flex: 1 }} />}
            </View>
          );
        })}
      </ScrollView>

      {/* ── Add Collection Modal ── */}
      <Modal visible={addModalVisible} transparent animationType="slide">
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} activeOpacity={1} onPress={() => setAddModalVisible(false)} />
        <View style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          backgroundColor: colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28,
          padding: spacing.xl, paddingBottom: 40,
        }}>
          {/* Modal Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg }}>
            <Text style={{ flex: 1, ...typography.h3, color: colors.text }}>New Collection</Text>
            <TouchableOpacity onPress={() => setAddModalVisible(false)}>
              <X color={colors.textMuted} size={24} />
            </TouchableOpacity>
          </View>

          {/* Icon Preview */}
          <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
            <View style={{
              width: 80, height: 80, borderRadius: borderRadius.xl,
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
            placeholderTextColor={colors.textMuted}
            style={{
              backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md,
              ...typography.body, color: colors.text, borderWidth: 1, borderColor: colors.border,
              marginBottom: spacing.lg,
            }}
          />

          {/* Choose Icon */}
          <Text style={{ ...typography.bodyMedium, fontSize: 13, color: colors.textMuted, marginBottom: spacing.sm }}>Choose Icon</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.lg }}>
            {ICON_OPTIONS.map(opt => {
              const Ic = opt.icon;
              const active = selectedIcon === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => setSelectedIcon(opt.key)}
                  style={{
                    width: 48, height: 48, borderRadius: borderRadius.lg, marginRight: spacing.sm,
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
          <Text style={{ ...typography.bodyMedium, fontSize: 13, color: colors.textMuted, marginBottom: spacing.sm }}>Choose Color</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl }}>
            {COLOR_OPTIONS.map(col => (
              <TouchableOpacity
                key={col}
                onPress={() => setSelectedColor(col)}
                style={{
                  width: 32, height: 32, borderRadius: borderRadius.full,
                  backgroundColor: col,
                  borderWidth: selectedColor === col ? 3 : 0,
                  borderColor: colors.textLight,
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
              backgroundColor: colors.primary, borderRadius: borderRadius.xl,
              paddingVertical: spacing.md, alignItems: 'center',
              opacity: newName.trim().length > 0 ? 1 : 0.5,
            }}
            disabled={!newName.trim()}
          >
            <Text style={{ ...typography.bodyMedium, fontSize: 16, color: colors.textLight }}>Create Collection</Text>
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
