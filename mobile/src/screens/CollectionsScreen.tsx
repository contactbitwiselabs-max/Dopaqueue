import React, { useState } from 'react';
import {
  View, Text, ScrollView, SafeAreaView, TouchableOpacity, Modal,
  TextInput, Dimensions, Switch, Image
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import withObservables from '@nozbe/with-observables';
import { database } from '../database';
import Collection from '../database/models/Collection';
import QueueItem from '../database/models/QueueItem';
import { Q } from '@nozbe/watermelondb';
import { Plus, X, Brain, Popcorn, Code2, BookOpen, Lightbulb, Briefcase, Star, Heart, Music, Globe, Sparkles } from 'lucide-react-native';
import { spacing, typography, borderRadius, shadows, useTheme } from '../constants/theme';

const { width } = Dimensions.get('window');
const CARD_SIZE = (width - spacing.xxl) / 2;

const ICON_OPTIONS = [
  { key: 'brain',    icon: Brain },
  { key: 'popcorn',  icon: Popcorn },
  { key: 'code',     icon: Code2 },
  { key: 'book',     icon: BookOpen },
  { key: 'idea',     icon: Lightbulb },
  { key: 'work',     icon: Briefcase },
  { key: 'star',     icon: Star },
  { key: 'heart',    icon: Heart },
  { key: 'music',    icon: Music },
  { key: 'globe',    icon: Globe },
];

function getIconConfig(key?: string) {
  return ICON_OPTIONS.find(i => i.key === key) || ICON_OPTIONS[0];
}

const CollectionCard = ({ collection, count, onPress }: { collection: Collection, count: number, onPress: () => void }) => {
  const { colors: themeColors, isDark } = useTheme();
  const iconConf = getIconConfig((collection as any).icon);
  const IconComp = iconConf.icon;
  const isSmart = (collection as any).isSmart;
  const coverImage = (collection as any).coverImage;
  const cardColor = (collection as any).color || themeColors.primary;

  return (
    <View style={{ flex: 1 }}>
      <TouchableOpacity
        onPress={onPress}
        style={{
          flex: 1,
          backgroundColor: themeColors.background,
          borderRadius: borderRadius.xl,
          minHeight: 160,
          ...shadows.sm,
          overflow: 'hidden',
        }}
      >
        {/* Cover Image or Color Block */}
        {coverImage ? (
          <Image source={{ uri: coverImage }} style={{ width: '100%', height: 70, backgroundColor: cardColor }} />
        ) : (
          <View style={{ width: '100%', height: 70, backgroundColor: cardColor, opacity: isDark ? 0.2 : 0.15 }} />
        )}

        {/* Icon (overlapping) */}
        <View style={{
          position: 'absolute', top: 50, left: spacing.md,
          width: 40, height: 40, borderRadius: borderRadius.md,
          backgroundColor: themeColors.surface,
          alignItems: 'center', justifyContent: 'center',
          ...shadows.sm,
        }}>
          <IconComp color={cardColor} size={22} />
        </View>

        {/* Smart Badge */}
        {isSmart && (
          <View style={{ position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.5)', padding: 4, borderRadius: 100 }}>
            <Sparkles color="#FBBF24" size={14} />
          </View>
        )}

        {/* Content */}
        <View style={{ padding: spacing.md, paddingTop: 28, flex: 1, justifyContent: 'flex-end' }}>
          <Text style={{ ...typography.bodyMedium, fontSize: 15, color: themeColors.text, marginBottom: 2 }} numberOfLines={2}>
            {collection.name}
          </Text>
          <View style={{ height: 3, backgroundColor: themeColors.surface, borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
            <View style={{ width: `${Math.min(100, (count / 40) * 100)}%` as any, height: '100%', backgroundColor: cardColor, borderRadius: 2 }} />
          </View>
          <Text style={{ ...typography.caption, color: themeColors.textMuted, marginTop: 4 }}>{count} saved</Text>
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
}

const CollectionsScreenComponent = ({ collections }: Props) => {
  const navigation = useNavigation<any>();
  const { colors: themeColors, isDark } = useTheme();
  
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('brain');
  const [selectedColor, setSelectedColor] = useState(themeColors.primary);
  const [isSmart, setIsSmart] = useState(false);
  const [filterRules, setFilterRules] = useState('');

  const COLOR_OPTIONS = [themeColors.primary, themeColors.info, '#7C3AED', themeColors.danger, themeColors.warning, '#0D9488', '#E11D48', '#F59E0B'];

  const handleCreateCollection = async () => {
    if (!newName.trim()) return;
    await database.write(async () => {
      await database.get<Collection>('collections').create(c => {
        c.name = newName.trim();
        (c as any).color = selectedColor;
        (c as any).icon = selectedIcon;
        (c as any).isSmart = isSmart;
        if (isSmart) (c as any).filterRules = filterRules;
      });
    });
    setNewName('');
    setIsSmart(false);
    setFilterRules('');
    setAddModalVisible(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.surface }}>
      {/* ── Header ── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md }}>
        <Text style={{ flex: 1, ...typography.h1, color: themeColors.text }}>Collections</Text>
        <TouchableOpacity
          onPress={() => setAddModalVisible(true)}
          style={{ width: 36, height: 36, borderRadius: borderRadius.full, backgroundColor: themeColors.primary, alignItems: 'center', justifyContent: 'center' }}
        >
          <Plus color={themeColors.textLight} size={20} />
        </TouchableOpacity>
      </View>

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
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} activeOpacity={1} onPress={() => setAddModalVisible(false)} />
        <View style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          backgroundColor: themeColors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28,
          padding: spacing.xl, paddingBottom: 40,
        }}>
          {/* Modal Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg }}>
            <Text style={{ flex: 1, ...typography.h3, color: themeColors.text }}>New Collection</Text>
            <TouchableOpacity onPress={() => setAddModalVisible(false)}>
              <X color={themeColors.textMuted} size={24} />
            </TouchableOpacity>
          </View>

          {/* Collection Name */}
          <TextInput
            value={newName}
            onChangeText={setNewName}
            placeholder="Collection Name"
            placeholderTextColor={themeColors.textMuted}
            style={{
              backgroundColor: themeColors.surface, borderRadius: borderRadius.lg, padding: spacing.md,
              ...typography.body, color: themeColors.text, borderWidth: 1, borderColor: themeColors.border,
              marginBottom: spacing.lg,
            }}
          />

          {/* Smart Collection Toggle */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: isSmart ? spacing.md : spacing.xl }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Sparkles color={themeColors.warning} size={18} />
              <Text style={{ ...typography.bodyMedium, color: themeColors.text }}>Smart Collection</Text>
            </View>
            <Switch value={isSmart} onValueChange={setIsSmart} trackColor={{ true: themeColors.primary }} />
          </View>

          {isSmart && (
            <TextInput
              value={filterRules}
              onChangeText={setFilterRules}
              placeholder="e.g., #tech or youtube.com"
              placeholderTextColor={themeColors.textMuted}
              style={{
                backgroundColor: themeColors.surface, borderRadius: borderRadius.lg, padding: spacing.md,
                ...typography.body, color: themeColors.text, borderWidth: 1, borderColor: themeColors.border,
                marginBottom: spacing.xl,
              }}
            />
          )}

          {/* Choose Icon */}
          <Text style={{ ...typography.bodyMedium, fontSize: 13, color: themeColors.textMuted, marginBottom: spacing.sm }}>Choose Icon</Text>
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
                    backgroundColor: active ? selectedColor : themeColors.surface,
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: active ? 0 : 1,
                    borderColor: themeColors.border,
                  }}
                >
                  <Ic color={active ? '#FFF' : themeColors.textMuted} size={24} />
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Create Button */}
          <TouchableOpacity
            onPress={handleCreateCollection}
            style={{
              backgroundColor: themeColors.primary, borderRadius: borderRadius.xl,
              paddingVertical: spacing.md, alignItems: 'center',
              opacity: newName.trim().length > 0 ? 1 : 0.5,
            }}
            disabled={!newName.trim()}
          >
            <Text style={{ ...typography.bodyMedium, fontSize: 16, color: themeColors.textLight }}>Create Collection</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const enhance = withObservables([], () => ({
  collections: database.collections.get<Collection>('collections').query(Q.sortBy('name', Q.asc)),
}));

export default enhance(CollectionsScreenComponent);
