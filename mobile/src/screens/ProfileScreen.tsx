import React from 'react';
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity, Switch, Image } from 'react-native';
import { Settings, Bell, Moon, ChevronRight, LogOut, Cloud, Shield, Star } from 'lucide-react-native';

export default function ProfileScreen() {
  const [isDarkMode, setIsDarkMode] = React.useState(false);
  const [notifications, setNotifications] = React.useState(true);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        
        {/* Header & Profile */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 }}>
          <Text style={{ fontSize: 28, fontWeight: '800', color: '#111827', marginBottom: 24 }}>Profile</Text>
          
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
              <Text style={{ fontSize: 28, fontWeight: '700', color: '#16a34a' }}>AM</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#111827' }}>Amaan</Text>
              <Text style={{ fontSize: 15, color: '#6B7280', marginTop: 2 }}>amaan@example.com</Text>
            </View>
            <TouchableOpacity style={{ backgroundColor: '#F3F4F6', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 99 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151' }}>Edit</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Premium Banner */}
        <View style={{ paddingHorizontal: 20, marginBottom: 32 }}>
          <View style={{ backgroundColor: '#111827', borderRadius: 20, padding: 20, flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
              <Star color="#FBBF24" size={24} fill="#FBBF24" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#ffffff' }}>DopaQueue Pro</Text>
              <Text style={{ fontSize: 13, color: '#9CA3AF', marginTop: 2 }}>Unlimited saves & AI tags</Text>
            </View>
            <TouchableOpacity style={{ backgroundColor: '#16a34a', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 99 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#ffffff' }}>Upgrade</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Settings Sections */}
        <View style={{ paddingHorizontal: 20 }}>
          
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, marginLeft: 8 }}>
            Preferences
          </Text>
          <View style={{ backgroundColor: '#ffffff', borderRadius: 20, overflow: 'hidden', marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                <Moon color="#3B82F6" size={20} />
              </View>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '500', color: '#111827' }}>Dark Mode</Text>
              <Switch 
                value={isDarkMode} 
                onValueChange={setIsDarkMode}
                trackColor={{ false: '#E5E7EB', true: '#16a34a' }}
              />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                <Bell color="#D97706" size={20} />
              </View>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '500', color: '#111827' }}>Push Notifications</Text>
              <Switch 
                value={notifications} 
                onValueChange={setNotifications}
                trackColor={{ false: '#E5E7EB', true: '#16a34a' }}
              />
            </View>
          </View>

          <Text style={{ fontSize: 14, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, marginLeft: 8 }}>
            Account
          </Text>
          <View style={{ backgroundColor: '#ffffff', borderRadius: 20, overflow: 'hidden', marginBottom: 24 }}>
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#F3E8FF', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                <Cloud color="#9333EA" size={20} />
              </View>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '500', color: '#111827' }}>Cloud Sync</Text>
              <Text style={{ fontSize: 14, color: '#6B7280', marginRight: 8 }}>Synced just now</Text>
              <ChevronRight color="#D1D5DB" size={20} />
            </TouchableOpacity>
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#FCE7F3', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                <Shield color="#DB2777" size={20} />
              </View>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '500', color: '#111827' }}>Privacy & Security</Text>
              <ChevronRight color="#D1D5DB" size={20} />
            </TouchableOpacity>
          </View>

          {/* Log Out */}
          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: '#FEF2F2', borderRadius: 20 }}>
            <LogOut color="#DC2626" size={20} style={{ marginRight: 8 }} />
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#DC2626' }}>Log Out</Text>
          </TouchableOpacity>

        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
