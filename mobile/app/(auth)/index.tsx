import React, { useState } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Zap, Building2, ArrowRight, AlertCircle } from 'lucide-react-native';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { Card } from '../../src/components/ui/Card';
import { checkSubdomain } from '../../src/lib/api/auth';
import { useAuthStore } from '../../src/stores/auth-store';

export default function SubdomainScreen() {
  const router = useRouter();
  const { setSubdomain } = useAuthStore();
  const [subdomainInput, setSubdomainInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLookup = async () => {
    const clean = subdomainInput.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    if (!clean) {
      setError('Please enter your workspace subdomain');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await checkSubdomain(clean);
      if (res.available) {
        setError(`No organization workspace found for "${clean}".`);
      } else {
        await setSubdomain(clean);
        router.push('/(auth)/login');
      }
    } catch {
      // In local dev without network, allow proceeding to login
      await setSubdomain(clean);
      router.push('/(auth)/login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-950">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          keyboardShouldPersistTaps="handled"
          className="px-5 py-6"
        >
          {/* Logo & Header */}
          <View className="items-center mb-8">
            <View className="w-14 h-14 rounded-2xl bg-indigo-600 items-center justify-center shadow-xl shadow-indigo-500/30 mb-4">
              <Zap color="#ffffff" size={28} />
            </View>
            <Text className="text-3xl font-black text-white tracking-tight">
              Orvio<Text className="text-indigo-400">Hub</Text>
            </Text>
            <Text className="text-xs text-slate-400 mt-1.5 text-center">
              Modular inventory, POS cashier desk & business management
            </Text>
          </View>

          {/* Subdomain Input Card */}
          <Card>
            <View className="space-y-4">
              <View>
                <Text className="text-lg font-bold text-white tracking-tight">
                  Find Your Workspace
                </Text>
                <Text className="text-xs text-slate-400 mt-1">
                  Enter your organization subdomain to continue
                </Text>
              </View>

              <Input
                label="Organization Subdomain"
                required
                placeholder="company-slug"
                value={subdomainInput}
                onChangeText={(text) => {
                  setSubdomainInput(text.toLowerCase().replace(/[^a-z0-9]/g, ''));
                  if (error) setError(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                leftIcon={<Building2 color="#64748b" size={18} />}
                rightIcon={
                  <Text className="text-xs font-bold text-indigo-400 select-none">
                    .orvio.com
                  </Text>
                }
              />

              {error && (
                <View className="flex-row items-center gap-1.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                  <AlertCircle color="#f43f5e" size={16} />
                  <Text className="text-xs text-rose-400 flex-1">{error}</Text>
                </View>
              )}

              <Button
                title={loading ? 'Locating Workspace...' : 'Continue to Sign In'}
                loading={loading}
                disabled={!subdomainInput.trim()}
                onPress={handleLookup}
                rightIcon={<ArrowRight color="#ffffff" size={16} />}
                size="lg"
                className="mt-2"
              />
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
