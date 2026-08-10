import React, { useState, useEffect } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity } from 'react-native';
import { Play, Pause, RotateCcw, Target } from 'lucide-react-native';

export default function FocusScreen() {
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((time) => time - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsActive(false);
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  const toggleTimer = () => setIsActive(!isActive);
  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(25 * 60);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
        <Text style={{ fontSize: 28, fontWeight: '800', color: '#111827' }}>Focus Mode</Text>
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
        <View style={{
          width: 280, height: 280, borderRadius: 140,
          backgroundColor: '#ffffff',
          borderWidth: 8, borderColor: isActive ? '#16a34a' : '#E5E7EB',
          alignItems: 'center', justifyContent: 'center',
          shadowColor: '#16a34a',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: isActive ? 0.2 : 0.05,
          shadowRadius: 20,
          elevation: 10,
          marginBottom: 40
        }}>
          <Text style={{ fontSize: 72, fontWeight: '800', color: '#111827', fontVariant: ['tabular-nums'] }}>
            {formatTime(timeLeft)}
          </Text>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#6B7280', marginTop: 8, textTransform: 'uppercase', letterSpacing: 2 }}>
            {isActive ? 'Deep Work' : 'Ready'}
          </Text>
        </View>
        <View style={{
          width: '100%',
          backgroundColor: '#ffffff',
          borderRadius: 16,
          padding: 16,
          flexDirection: 'row',
          alignItems: 'center',
          shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
          marginBottom: 40
        }}>
          <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
            <Target color="#16a34a" size={24} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#16a34a', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
              Current Focus
            </Text>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }} numberOfLines={1}>
              Figma UI Design Tutorial
            </Text>
            <Text style={{ fontSize: 14, color: '#6B7280', marginTop: 2 }}>YouTube Video • 45m</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 24 }}>
          <TouchableOpacity 
            onPress={resetTimer}
            style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}
          >
            <RotateCcw color="#4B5563" size={24} />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={toggleTimer}
            style={{ 
              width: 80, height: 80, borderRadius: 40, 
              backgroundColor: isActive ? '#DCFCE7' : '#16a34a', 
              alignItems: 'center', justifyContent: 'center',
              shadowColor: '#16a34a', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8
            }}
          >
            {isActive ? <Pause color="#16a34a" size={32} fill="#16a34a" /> : <Play color="#ffffff" size={32} fill="#ffffff" style={{ marginLeft: 4 }} />}
          </TouchableOpacity>
          <View style={{ width: 56, height: 56 }} />
        </View>
      </View>
    </SafeAreaView>
  );
}
