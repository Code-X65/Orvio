import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Zap,
  TrendingUp,
  Package,
  Users,
  CreditCard,
  ArrowUpRight,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react-native';
import { Card } from '../../src/components/ui/Card';
import { useAuthStore } from '../../src/stores/auth-store';

export default function DashboardScreen() {
  const { user, organization, activeSubdomain } = useAuthStore();

  const isEmailUnverified = Boolean(user && !user.emailVerifiedAt);
  const orgName = organization?.name || (activeSubdomain ? activeSubdomain.toUpperCase() : 'Orvio Workspace');

  return (
    <SafeAreaView className="flex-1 bg-slate-950">
      <ScrollView className="flex-1 px-5 pt-4">
        {/* Top Workspace Header */}
        <View className="flex-row items-center justify-between mb-5">
          <View className="flex-row items-center gap-2.5">
            <View className="w-10 h-10 rounded-xl bg-indigo-600 items-center justify-center shadow-lg shadow-indigo-500/25">
              <Zap color="#ffffff" size={20} />
            </View>
            <View>
              <Text className="text-base font-black text-white">{orgName}</Text>
              <Text className="text-[11px] font-mono text-indigo-400">
                {organization?.subdomain || activeSubdomain}.orvio.com
              </Text>
            </View>
          </View>

          <View className="flex-row items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <ShieldCheck color="#34d399" size={13} />
            <Text className="text-[10px] font-bold text-emerald-400">Active</Text>
          </View>
        </View>

        {/* Verification Warning Banner if Unverified */}
        {isEmailUnverified && (
          <View className="mb-5 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex-row items-start gap-2.5">
            <AlertCircle color="#fbbf24" size={18} />
            <View className="flex-1">
              <Text className="text-xs font-bold text-amber-300">
                Please verify your organization email
              </Text>
              <Text className="text-[11px] text-amber-200/80 mt-0.5">
                Check inbox for {user?.email || 'your email'} to unlock full features.
              </Text>
            </View>
          </View>
        )}

        {/* Quick Stats Grid */}
        <View className="grid grid-cols-2 gap-3 mb-5">
          <Card className="p-4 bg-slate-900 border-slate-800">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-[11px] font-semibold text-slate-400">Today&apos;s Sales</Text>
              <TrendingUp color="#34d399" size={15} />
            </View>
            <Text className="text-xl font-black text-white">₦142,500</Text>
            <Text className="text-[10px] text-emerald-400 mt-1 font-medium">+18% vs yesterday</Text>
          </Card>

          <Card className="p-4 bg-slate-900 border-slate-800">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-[11px] font-semibold text-slate-400">Low Stock</Text>
              <Package color="#f59e0b" size={15} />
            </View>
            <Text className="text-xl font-black text-white">12 items</Text>
            <Text className="text-[10px] text-amber-400 mt-1 font-medium">Reorder required</Text>
          </Card>
        </View>

        {/* Active Apps & Fast Navigation */}
        <Text className="text-sm font-bold text-white mb-3 tracking-tight">
          Installed Applications
        </Text>

        <View className="space-y-2.5 mb-8">
          <Card className="p-3.5 flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 items-center justify-center">
                <Package color="#0ea5e9" size={20} />
              </View>
              <View>
                <Text className="text-xs font-bold text-white">Inventory & Stock Master</Text>
                <Text className="text-[11px] text-slate-400">Barcode tracking, reorder alerts</Text>
              </View>
            </View>
            <ArrowUpRight color="#64748b" size={16} />
          </Card>

          <Card className="p-3.5 flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 items-center justify-center">
                <CreditCard color="#10b981" size={20} />
              </View>
              <View>
                <Text className="text-xs font-bold text-white">POS Cashier Terminal</Text>
                <Text className="text-[11px] text-slate-400">Quick receipts, discounts, payments</Text>
              </View>
            </View>
            <ArrowUpRight color="#64748b" size={16} />
          </Card>

          <Card className="p-3.5 flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 items-center justify-center">
                <Users color="#818cf8" size={20} />
              </View>
              <View>
                <Text className="text-xs font-bold text-white">Staff & Cashier Permissions</Text>
                <Text className="text-[11px] text-slate-400">Role-based access & branch control</Text>
              </View>
            </View>
            <ArrowUpRight color="#64748b" size={16} />
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
