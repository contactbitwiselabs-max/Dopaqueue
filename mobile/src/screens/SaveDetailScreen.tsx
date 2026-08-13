import React from 'react';
import { View, Text, SafeAreaView, ScrollView, Image, StyleSheet } from 'react-native';
import QueueItem from '../database/models/QueueItem';
import { Clock, Tag, ExternalLink } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '../constants/theme';

export default function SaveDetailScreen({ route }: any) {
  const item: QueueItem = route?.params?.item;

  if (!item) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Item not found.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {item.thumbnail ? (
          <Image 
            source={{ uri: item.thumbnail }} 
            style={styles.image} 
            resizeMode="cover" 
          />
        ) : (
          <View style={styles.placeholderImage}>
            <ExternalLink color={colors.textMuted} size={48} />
          </View>
        )}
        
        <View style={styles.content}>
          <View style={styles.metaRow}>
            {item.platform && (
              <View style={styles.platformBadge}>
                <Text style={styles.platformText}>{item.platform.toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.dateRow}>
              <Clock color={colors.textMuted} size={14} />
              <Text style={styles.dateText}>
                {new Date(item.savedAt).toLocaleDateString()}
              </Text>
            </View>
          </View>
          
          <Text style={styles.title}>{item.title}</Text>
          
          <View style={styles.urlContainer}>
            <Text style={styles.urlLabel}>Source URL</Text>
            <Text style={styles.urlText} numberOfLines={1}>{item.url}</Text>
          </View>

          {item.note && (
            <View style={styles.noteContainer}>
              <Text style={styles.noteLabel}>Notes</Text>
              <Text style={styles.noteText}>{item.note}</Text>
            </View>
          )}

          {item.collection && (
            <View style={styles.collectionRow}>
              <Tag color={colors.primary} size={16} />
              <Text style={styles.collectionText}>{item.collection}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: colors.text,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  image: {
    width: '100%',
    height: 256,
    backgroundColor: colors.surface,
  },
  placeholderImage: {
    width: '100%',
    height: 256,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: spacing.lg,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  platformBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  platformText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primary,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    ...typography.caption,
    color: colors.textMuted,
    marginLeft: 4,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.md,
  },
  urlContainer: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  urlLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: 4,
  },
  urlText: {
    ...typography.bodyMedium,
    color: colors.info,
  },
  noteContainer: {
    marginBottom: spacing.md,
  },
  noteLabel: {
    ...typography.bodyMedium,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  noteText: {
    ...typography.body,
    color: colors.text,
    lineHeight: 24,
  },
  collectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  collectionText: {
    ...typography.bodyMedium,
    color: colors.primary,
    marginLeft: spacing.sm,
  },
});
