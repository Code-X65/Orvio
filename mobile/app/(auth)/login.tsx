import React, { useState } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Building2,
  ArrowRight,
  Sparkles,
  ChevronLeft,
} from 'lucide-react-native';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { Card } from '../../src/components/ui/Card';
import { login, requestMagicLogin } from '../../src/lib/api/auth';
import { useAuthStore } from '../../src/stores/auth-store';

export default function LoginScreen() {
  const router = useRouter();
  const { activeSubdomain, setSession, clearSession } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendingMagic, setSendingMagic] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Please enter both email and password');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await login({
        email: email.trim().toLowerCase(),
        password,
        subdomain: activeSubdomain || undefined,
      });

      await setSession(
        res.accessToken,
        res.user,
        res.organization,
        res.user.emailVerifiedAt ? 'authenticated' : 'pending-verification'
      );

      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err?.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLogin = async () => {
    if (!email.trim() || !email.includes('@')) {
      Alert.alert('Email Required', 'Please enter your business email first to receive a sign-in setup link.');
      return;
    }

    setSendingMagic(true);
    try {
      await requestMagicLogin({
        email: email.trim().toLowerCase(),
        subdomain: activeSubdomain || undefined,
      });
      Alert.alert(
        'Sign-in Link Dispatched',
        `A one-click sign-in link has been sent to ${email.trim()}. Please check your inbox.`
      );
    } catch {
      Alert.alert('Error', 'Failed to dispatch magic sign-in link. Please try again.');
    } finally {
      setSendingMagic(false);
    }
  };

  const handleSwitchOrg = async () => {
    await clearSession();
    router.back();
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
          {/* Top Switch Header */}
          <View className="flex-row items-center justify-between mb-6">
            <TouchableOpacity
              onPress={handleSwitchOrg}
              className="flex-row items-center gap-1 py-1 px-2.5 rounded-lg bg-slate-900 border border-slate-800"
            >
              <ChevronLeft color="#818cf8" size={16} />
              <Text className="text-xs font-semibold text-indigo-400">Switch Workspace</Text>
            </TouchableOpacity>

            {activeSubdomain && (
              <View className="flex-row items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30">
                <Building2 color="#818cf8" size={13} />
                <Text className="text-xs font-mono font-bold text-indigo-300">
                  {activeSubdomain}
                </Text>
              </View>
            )}
          </View>

          {/* Card */}
          <Card>
            <View className="space-y-4">
              <View>
                <Text className="text-2xl font-black text-white tracking-tight">
                  Sign In
                </Text>
                <Text className="text-xs text-slate-400 mt-1">
                  Access your {activeSubdomain || 'Orvio'} inventory and POS desk
                </Text>
              </View>

              {error && (
                <View className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                  <Text className="text-xs text-rose-400 font-medium">{error}</Text>
                </View>
              )}

              <Input
                label="Business Email"
                required
                placeholder="admin@company.com"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (error) setError(null);
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                leftIcon={<Mail color="#64748b" size={18} />}
              />

              <Input
                label="Password"
                required
                placeholder="••••••••••••"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (error) setError(null);
                }}
                secureTextEntry={!showPassword}
                leftIcon={<Lock color="#64748b" size={18} />}
                rightIcon={
                  showPassword ? (
                    <EyeOff color="#94a3b8" size={18} />
                  ) : (
                    <Eye color="#94a3b8" size={18} />
                  )
                }
                onRightIconPress={() => setShowPassword(!showPassword)}
              />

              <Button
                title={loading ? 'Signing In...' : 'Sign In to Workspace'}
                loading={loading}
                disabled={!email.trim() || !password}
                onPress={handleLogin}
                rightIcon={<ArrowRight color="#ffffff" size={16} />}
                size="lg"
                className="mt-2"
              />

              {/* Magic Link Setup Fallback */}
              <TouchableOpacity
                onPress={handleMagicLogin}
                disabled={sendingMagic}
                className="pt-2 items-center flex-row justify-center gap-1.5"
              >
                <Sparkles color="#818cf8" size={14} />
                <Text className="text-xs font-semibold text-indigo-400 underline">
                  {sendingMagic ? 'Sending Setup Link...' : 'No password yet? Email me sign-in setup link'}
                </Text>
              </TouchableOpacity>
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
