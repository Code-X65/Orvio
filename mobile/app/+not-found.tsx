import React from 'react';
import { View, Text } from 'react-native';
import { Link, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertCircle } from 'lucide-react-native';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Screen Not Found' }} />
      <SafeAreaView className="flex-1 bg-slate-950 items-center justify-center p-5">
        <View className="items-center text-center space-y-3 max-w-sm">
          <AlertCircle color="#f43f5e" size={48} />
          <Text className="text-xl font-bold text-white text-center">Screen Not Found</Text>
          <Text className="text-xs text-slate-400 text-center">
            This route does not exist in the Orvio mobile app.
          </Text>
          <Link href="/(tabs)" className="mt-4">
            <Text className="text-sm font-bold text-indigo-400 underline">Return to Dashboard</Text>
          </Link>
        </View>
      </SafeAreaView>
    </>
  );
}
