import React, { useState, useRef } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../constants/theme';
import { Zap, Layers, Sparkles, ArrowRight, Check } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');

const ONBOARDING_STEPS = [
  {
    title: 'Save Anything Instantly',
    description: 'Stop losing links in your notes app. Use the Share button from any app to instantly save videos, articles, and ideas to Dopaqueue.',
    Icon: Zap,
    color: colors.primary,
    bg: colors.primaryLight
  },
  {
    title: 'Smart Organization',
    description: 'Our natural language Smart Save bar lets you assign tags, collections, and due dates just by typing.',
    Icon: Sparkles,
    color: colors.info,
    bg: '#DBEAFE'
  },
  {
    title: 'Achieve Inbox Zero',
    description: 'Process your saves like an email inbox. Swipe right to archive, swipe left to delete. Keep your dopamine budget balanced.',
    Icon: Layers,
    color: colors.warning,
    bg: '#FEF3C7'
  }
];

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const navigation = useNavigation<any>();

  const completeOnboarding = async () => {
    await AsyncStorage.setItem('has_completed_onboarding', 'true');
    navigation.replace('MainTabs');
  };

  const handleNext = () => {
    if (currentIndex < ONBOARDING_STEPS.length - 1) {
      scrollRef.current?.scrollTo({ x: width * (currentIndex + 1), animated: true });
    } else {
      completeOnboarding();
    }
  };

  const onScroll = (e: any) => {
    const x = e.nativeEvent.contentOffset.x;
    setCurrentIndex(Math.round(x / width));
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        bounces={false}
      >
        {ONBOARDING_STEPS.map((step, index) => {
          const { Icon } = step;
          return (
            <View key={index} style={{ width, flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl }}>
              <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: step.bg, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xxl }}>
                <Icon color={step.color} size={56} />
              </View>
              <Text style={{ ...typography.h1, color: colors.text, textAlign: 'center', marginBottom: spacing.md }}>
                {step.title}
              </Text>
              <Text style={{ ...typography.body, color: colors.textMuted, textAlign: 'center', lineHeight: 24 }}>
                {step.description}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      {/* ── Footer ── */}
      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, paddingTop: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Pagination Dots */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {ONBOARDING_STEPS.map((_, idx) => (
            <View
              key={idx}
              style={{
                width: currentIndex === idx ? 24 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: currentIndex === idx ? colors.primary : colors.surface
              }}
            />
          ))}
        </View>

        {/* Next/Start Button */}
        <TouchableOpacity
          onPress={handleNext}
          style={{
            backgroundColor: colors.primary,
            paddingHorizontal: spacing.lg,
            paddingVertical: 14,
            borderRadius: borderRadius.full,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8
          }}
        >
          <Text style={{ ...typography.bodyMedium, color: colors.textLight }}>
            {currentIndex === ONBOARDING_STEPS.length - 1 ? 'Get Started' : 'Next'}
          </Text>
          {currentIndex === ONBOARDING_STEPS.length - 1 ? (
            <Check color={colors.textLight} size={18} />
          ) : (
            <ArrowRight color={colors.textLight} size={18} />
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
