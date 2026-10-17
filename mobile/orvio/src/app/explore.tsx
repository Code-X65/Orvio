import React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Collapsible } from '@/components/ui/collapsible';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { OrvioLogo } from '@/components/orvio-logo';

export default function ExploreScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const insets = {
    ...safeAreaInsets,
    bottom: safeAreaInsets.bottom + BottomTabInset + Spacing.three,
  };
  const theme = useTheme();

  const modules = [
    {
      title: 'Orvio Inventory & POS',
      badge: 'Core Module • Installed',
      badgeColor: theme.success,
      icon: 'cube-outline' as const,
      desc: 'Real-time stock synchronization, multi-store warehouses, barcode scanning, and instant WhatsApp receipts.',
    },
    {
      title: 'Orvio Multi-Branch Engine',
      badge: 'Active Hub',
      badgeColor: theme.primary,
      icon: 'git-branch-outline' as const,
      desc: 'Seamless inter-branch transfers, location-isolated stock thresholds, and branch manager role audits.',
    },
    {
      title: 'Orvio Accounting & Tax',
      badge: 'Available Add-on',
      badgeColor: theme.secondaryDark,
      icon: 'calculator-outline' as const,
      desc: 'Automated VAT calculation, cash flow ledgers, expense reconciliations, and P&L financial summaries.',
    },
    {
      title: 'Orvio Gym & Membership',
      badge: 'Ecosystem App',
      badgeColor: theme.accent,
      icon: 'barbell-outline' as const,
      desc: 'Access turnstile integrations, recurring subscription billing, trainer booking, and member digital passes.',
    },
    {
      title: 'Orvio Payroll & HR',
      badge: 'Upcoming',
      badgeColor: theme.textSecondary,
      icon: 'people-outline' as const,
      desc: 'Automated staff salary disbursal, shift attendance biometric integration, and staff performance metrics.',
    },
  ];

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentInset={insets}
      contentContainerStyle={[
        styles.contentContainer,
        {
          paddingTop: Platform.select({
            android: insets.top + Spacing.two,
            ios: insets.top + Spacing.two,
            default: Spacing.four,
          }),
          paddingBottom: insets.bottom,
        },
      ]}
    >
      <ThemedView style={styles.container}>
        {/* Brand Banner */}
        <View style={styles.brandHero}>
          <OrvioLogo size={48} showGlow={true} />
          <ThemedText type="subtitle" style={styles.heroTitle}>
            Orvio Ecosystem
          </ThemedText>
          <ThemedText style={styles.centerText} themeColor="textSecondary">
            Explore modular business applications designed to connect seamlessly under your custom
            subdomain.
          </ThemedText>
        </View>

        {/* Modular Apps List */}
        <ThemedView style={styles.sectionsWrapper}>
          {modules.map((mod, index) => (
            <Collapsible
              key={index}
              title={mod.title}
            >
              <View style={styles.modBody}>
                <View style={[styles.modBadge, { backgroundColor: theme.backgroundElement }]}>
                  <Ionicons name={mod.icon} size={15} color={mod.badgeColor} />
                  <ThemedText type="smallBold" style={{ color: mod.badgeColor }}>
                    {mod.badge}
                  </ThemedText>
                </View>
                <ThemedText type="small" themeColor="textSecondary" style={styles.modDesc}>
                  {mod.desc}
                </ThemedText>
              </View>
            </Collapsible>
          ))}

          <Collapsible title="Multi-Tenant Subdomain Architecture">
            <ThemedText type="small">
              Each company gets a dedicated workspace subdomain (e.g.,{' '}
              <ThemedText type="code">yourbrand.orvio.com</ThemedText>) with isolated database
              partitions, multi-branch role management, and centralized billing.
            </ThemedText>
          </Collapsible>
        </ThemedView>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
  },
  container: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.four,
  },
  brandHero: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  heroTitle: {
    fontWeight: '800',
    marginTop: 6,
  },
  centerText: {
    textAlign: 'center',
    maxWidth: 420,
    fontSize: 13,
    lineHeight: 18,
  },
  sectionsWrapper: {
    gap: Spacing.two,
    alignSelf: 'stretch',
  },
  modBody: {
    gap: 8,
    paddingTop: 4,
  },
  modBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  modDesc: {
    lineHeight: 19,
  },
});
