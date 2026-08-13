import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Dimensions, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, spacing, borderRadius } from '../constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');

const ONBOARDING_STEPS = [
  {
    title: 'Save Anything Instantly',
    description: 'Stop losing links in your notes app. Use the Share button from any app to instantly save videos, articles, and ideas to Dopaqueue.',
    image: require('../../assets/onboarding_step_1.png'),
    bg: colors.primaryLight
  },
  {
    title: 'Smart Organization',
    description: 'Our natural language Smart Save bar lets you assign tags, collections, and due dates just by typing.',
    image: require('../../assets/onboarding_step_2.png'),
    bg: '#DBEAFE'
  },
  {
    title: 'Achieve Inbox Zero',
    description: 'Process your saves like an email inbox. Swipe right to archive, swipe left to delete. Keep your dopamine budget balanced.',
    image: require('../../assets/onboarding_step_3.png'),
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

  const handlePrevious = () => {
    if (currentIndex > 0) {
      scrollRef.current?.scrollTo({ x: width * (currentIndex - 1), animated: true });
    }
  };

  const onScroll = (e: any) => {
    const x = e.nativeEvent.contentOffset.x;
    setCurrentIndex(Math.round(x / width));
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* ── Header ── */}
      <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.xl, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ ...typography.bodyMedium, color: colors.textMuted, fontWeight: '600' }}>
          Step {currentIndex + 1} of {ONBOARDING_STEPS.length}
        </Text>
        <TouchableOpacity onPress={completeOnboarding}>
          <Text style={{ ...typography.bodyMedium, color: colors.primary, fontWeight: '700' }}>Skip</Text>
        </TouchableOpacity>
      </View>

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
          return (
            <View key={index} style={{ width, flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl }}>
              <View style={{ width: 280, height: 280, marginBottom: spacing.xxl, alignItems: 'center', justifyContent: 'center' }}>
                <Image source={step.image} style={{ width: '100%', height: '100%', resizeMode: 'contain' }} />
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
        {/* Previous Button */}
        {currentIndex > 0 ? (
          <TouchableOpacity onPress={handlePrevious} style={{ padding: 12 }}>
            <Text style={{ ...typography.bodyMedium, color: colors.textMuted, fontWeight: '600' }}>Back</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 60 }} />
        )}

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
            width: currentIndex === ONBOARDING_STEPS.length - 1 ? 140 : 110,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ ...typography.bodyMedium, color: colors.textLight, fontWeight: '700' }}>
            {currentIndex === ONBOARDING_STEPS.length - 1 ? 'Get Started' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
