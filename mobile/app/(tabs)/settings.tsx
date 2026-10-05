import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  User,
  Building2,
  LogOut,
} from 'lucide-react-native';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { useAuthStore } from '../../src/stores/auth-store';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, organization, activeSubdomain, clearSession } = useAuthStore();

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out of this workspace?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await clearSession();
          router.replace('/(auth)');
        },
      },
    ]);
  };

  const handleSwitchWorkspace = async () => {
    await clearSession();
    router.replace('/(auth)');
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-950">
      <ScrollView className="flex-1 px-5 pt-3">
        {/* Header */}
        <View className="mb-5">
          <Text className="text-xl font-black text-white">Settings</Text>
          <Text className="text-xs text-slate-400">Account profile & workspace preferences</Text>
        </View>

        {/* User Card */}
        <Card className="mb-4 p-4">
          <View className="flex-row items-center gap-3.5 mb-3">
            <View className="w-12 h-12 rounded-2xl bg-indigo-600 items-center justify-center">
              <User color="#ffffff" size={24} />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-bold text-white">
                {user?.fullName || 'Active User'}
              </Text>
              <Text className="text-xs text-slate-400">{user?.email || 'admin@company.com'}</Text>
              <View className="mt-1 flex-row items-center gap-1.5">
                <Text className="text-[10px] uppercase font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                  {user?.status || 'Active'}
                </Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Organization Card */}
        <Card className="mb-4 p-4 space-y-3">
          <Text className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Active Workspace
          </Text>

          <View className="flex-row items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
            <View className="flex-row items-center gap-2.5">
              <Building2 color="#818cf8" size={18} />
              <View>
                <Text className="text-xs font-bold text-white">
                  {organization?.name || activeSubdomain}
                </Text>
                <Text className="text-[11px] text-slate-400">
                  {organization?.subdomain || activeSubdomain}.orvio.com
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={handleSwitchWorkspace}
              className="px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/30"
            >
              <Text className="text-[11px] font-bold text-indigo-400">Switch</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* App Info & Sign Out */}
        <Card className="mb-6 p-4 space-y-2">
          <View className="flex-row items-center justify-between py-2 border-b border-slate-800">
            <Text className="text-xs text-slate-300">App Version</Text>
            <Text className="text-xs font-mono text-slate-400">1.0.0 (Expo SDK 57)</Text>
          </View>
          <View className="flex-row items-center justify-between py-2">
            <Text className="text-xs text-slate-300">Native Platform</Text>
            <Text className="text-xs font-mono text-slate-400">iOS & Android</Text>
          </View>
        </Card>

        <Button
          title="Sign Out of Workspace"
          variant="destructive"
          size="lg"
          onPress={handleSignOut}
          leftIcon={<LogOut color="#ffffff" size={16} />}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
