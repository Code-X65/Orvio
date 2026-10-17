import React, { useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/use-theme';
import { OrvioLogo } from './orvio-logo';

interface WelcomeBannersProps {
  onEnterWorkspace: () => void;
}

interface BannerSlide {
  id: string;
  badge: string;
  badgeColor: string;
  title: string;
  highlight: string;
  description: string;
  renderVisual: () => React.ReactNode;
}

export function WelcomeBanners({ onEnterWorkspace }: WelcomeBannersProps) {
  const theme = useTheme();
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const screenWidth = Dimensions.get('window').width;
  const slideWidth = Math.min(screenWidth, 600);

  // Button scale animation for tactile feel
  const buttonScale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(buttonScale, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(buttonScale, {
      toValue: 1,
      friction: 4,
      useNativeDriver: true,
    }).start();
  };

  const slides: BannerSlide[] = [
    {
      id: 'banner-inventory',
      badge: 'ORVIO MULTI-BRANCH',
      badgeColor: theme.primary,
      title: 'Smart Inventory &',
      highlight: 'Real-Time Stock Sync',
      description:
        'Track live stock quantities across all your retail branches and warehouses with automatic low-stock warnings.',
      renderVisual: () => (
        <View style={[styles.visualCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View style={styles.cardHeader}>
            <View style={styles.branchHeaderLeft}>
              <View style={[styles.pulseDot, { backgroundColor: theme.success }]} />
              <Text style={[styles.cardHeaderTitle, { color: theme.text }]}>Live Branch Network</Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: theme.successLight }]}>
              <Text style={[styles.statusPillText, { color: theme.success }]}>99.2% Sync</Text>
            </View>
          </View>

          {/* Branch 1 */}
          <View style={styles.branchRow}>
            <View style={styles.branchInfo}>
              <Text style={[styles.branchName, { color: theme.text }]}>Ikeja Flagship Hub</Text>
              <Text style={[styles.branchMeta, { color: theme.textSecondary }]}>1,420 SKUs • Active</Text>
            </View>
            <View style={styles.branchProgressWrap}>
              <View style={[styles.progressBarBg, { backgroundColor: theme.backgroundElement }]}>
                <View style={[styles.progressBarFill, { width: '84%', backgroundColor: theme.primary }]} />
              </View>
              <Text style={[styles.stockPercent, { color: theme.primary }]}>84%</Text>
            </View>
          </View>

          {/* Branch 2 */}
          <View style={styles.branchRow}>
            <View style={styles.branchInfo}>
              <Text style={[styles.branchName, { color: theme.text }]}>Victoria Island Outlet</Text>
              <Text style={[styles.branchMeta, { color: theme.textSecondary }]}>680 SKUs • Low restock</Text>
            </View>
            <View style={styles.branchProgressWrap}>
              <View style={[styles.progressBarBg, { backgroundColor: theme.backgroundElement }]}>
                <View style={[styles.progressBarFill, { width: '42%', backgroundColor: theme.secondary }]} />
              </View>
              <Text style={[styles.stockPercent, { color: theme.secondaryDark }]}>42%</Text>
            </View>
          </View>

          {/* Alert Chip */}
          <View style={[styles.alertChip, { backgroundColor: theme.primaryLight, borderColor: theme.primary }]}>
            <Ionicons name="swap-horizontal" size={16} color={theme.primary} />
            <Text style={[styles.alertChipText, { color: theme.primary }]}>
              Transfer: 35 Scanner units en-route to VI Branch
            </Text>
          </View>
        </View>
      ),
    },
    {
      id: 'banner-pos',
      badge: 'HIGH-SPEED CHECKOUT',
      badgeColor: theme.secondaryDark,
      title: 'Fast Mobile POS &',
      highlight: 'WhatsApp E-Receipts',
      description:
        'Ring up sales in seconds, scan product barcodes with your phone, and automatically dispatch branded digital receipts.',
      renderVisual: () => (
        <View style={[styles.visualCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View style={styles.receiptHeader}>
            <View style={[styles.receiptBadge, { backgroundColor: theme.secondaryLight }]}>
              <Ionicons name="receipt-outline" size={18} color={theme.secondaryDark} />
            </View>
            <View>
              <Text style={[styles.receiptStoreName, { color: theme.text }]}>Orvio Electronics Ltd</Text>
              <Text style={[styles.receiptMeta, { color: theme.textSecondary }]}>POS Desk #02 • Terminal Active</Text>
            </View>
            <View style={[styles.paidBadge, { backgroundColor: theme.successLight }]}>
              <Ionicons name="checkmark-circle" size={14} color={theme.success} />
              <Text style={[styles.paidText, { color: theme.success }]}>PAID</Text>
            </View>
          </View>

          <View style={[styles.receiptDivider, { borderColor: theme.cardBorder }]} />

          <View style={styles.receiptItemRow}>
            <Text style={[styles.receiptItemName, { color: theme.text }]}>Wireless POS Terminal x1</Text>
            <Text style={[styles.receiptItemPrice, { color: theme.text }]}>₦48,500</Text>
          </View>
          <View style={styles.receiptItemRow}>
            <Text style={[styles.receiptItemName, { color: theme.text }]}>Thermal Roll 80mm (3-Pack)</Text>
            <Text style={[styles.receiptItemPrice, { color: theme.text }]}>₦6,000</Text>
          </View>

          <View style={[styles.receiptTotalRow, { backgroundColor: theme.backgroundElement }]}>
            <Text style={[styles.receiptTotalLabel, { color: theme.textSecondary }]}>Total Received</Text>
            <Text style={[styles.receiptTotalValue, { color: theme.text }]}>₦54,500</Text>
          </View>

          {/* WhatsApp Pill */}
          <View style={[styles.whatsappPill, { backgroundColor: '#E7FCE8', borderColor: '#86EFAC' }]}>
            <Ionicons name="logo-whatsapp" size={16} color="#15803D" />
            <Text style={styles.whatsappPillText}>WhatsApp E-Receipt delivered to +234 812 *** 491</Text>
          </View>
        </View>
      ),
    },
    {
      id: 'banner-workspace',
      badge: 'ENTERPRISE OPERATING SYSTEM',
      badgeColor: theme.accent,
      title: 'Unified Workspace &',
      highlight: 'Growth Command Hub',
      description:
        'Consolidate revenue analytics, audit trails, cashier permissions, and your custom subdomain into one command hub.',
      renderVisual: () => (
        <View style={[styles.visualCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View style={styles.analyticsHeader}>
            <View>
              <Text style={[styles.analyticsLabel, { color: theme.textSecondary }]}>Today's Net Revenue</Text>
              <View style={styles.analyticsValRow}>
                <Text style={[styles.analyticsValue, { color: theme.text }]}>₦1,428,500</Text>
                <View style={[styles.growthChip, { backgroundColor: theme.successLight }]}>
                  <Ionicons name="trending-up" size={14} color={theme.success} />
                  <Text style={[styles.growthText, { color: theme.success }]}>+22.4%</Text>
                </View>
              </View>
            </View>
            <View style={[styles.subdomainPill, { backgroundColor: theme.primaryLight }]}>
              <Text style={[styles.subdomainText, { color: theme.primary }]}>demo.orvio.com</Text>
            </View>
          </View>

          {/* Mini Sparkline Chart simulation */}
          <View style={styles.sparklineContainer}>
            {[45, 62, 50, 78, 65, 92, 85, 100].map((height, i) => (
              <View key={i} style={styles.sparklineCol}>
                <View
                  style={[
                    styles.sparklineBar,
                    {
                      height: (height / 100) * 44,
                      backgroundColor: i === 7 ? theme.primary : theme.primaryLight,
                      borderColor: i === 7 ? theme.primaryDark : 'transparent',
                    },
                  ]}
                />
                <Text style={[styles.sparklineLabel, { color: theme.textSecondary }]}>
                  {['9a', '10a', '11a', '12p', '1p', '2p', '3p', 'Now'][i]}
                </Text>
              </View>
            ))}
          </View>

          {/* Staff Roster Snippet */}
          <View style={styles.staffRow}>
            <View style={styles.staffLeft}>
              <Ionicons name="people-circle-outline" size={20} color={theme.primary} />
              <Text style={[styles.staffText, { color: theme.text }]}>3 Cashiers On Shift • Bank-grade Isolated</Text>
            </View>
            <View style={[styles.secureBadge, { backgroundColor: theme.backgroundElement }]}>
              <Ionicons name="shield-checkmark" size={13} color={theme.success} />
              <Text style={[styles.secureText, { color: theme.textSecondary }]}>SOC2</Text>
            </View>
          </View>
        </View>
      ),
    },
  ];

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / slideWidth);
    if (index !== activeIndex && index >= 0 && index < slides.length) {
      setActiveIndex(index);
    }
  };

  const handleNext = () => {
    if (activeIndex < slides.length - 1) {
      const nextIndex = activeIndex + 1;
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setActiveIndex(nextIndex);
    } else {
      onEnterWorkspace();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top Header Bar */}
      <View style={styles.topHeader}>
        <View style={styles.logoRow}>
          <OrvioLogo size={36} showGlow={false} />
          <View style={styles.logoTitleCol}>
            <Text style={[styles.logoBrandName, { color: theme.text }]}>ORVIO</Text>
            <Text style={[styles.logoBrandTag, { color: theme.primary }]}>BUSINESS OS</Text>
          </View>
        </View>

        <Pressable
          onPress={onEnterWorkspace}
          hitSlop={12}
          style={({ pressed }) => [
            styles.skipButton,
            { backgroundColor: theme.backgroundElement },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.skipButtonText, { color: theme.textSecondary }]}>Skip to Demo</Text>
          <Ionicons name="arrow-forward" size={14} color={theme.textSecondary} />
        </Pressable>
      </View>

      {/* Main Slides Carousel */}
      <FlatList
        ref={flatListRef}
        data={slides}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        snapToInterval={slideWidth}
        decelerationRate="fast"
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={[styles.slideContainer, { width: slideWidth }]}>
            {/* Slide Category Pill */}
            <View style={[styles.badgePill, { backgroundColor: theme.primaryLight }]}>
              <Ionicons name="sparkles" size={13} color={item.badgeColor} />
              <Text style={[styles.badgeText, { color: item.badgeColor }]}>{item.badge}</Text>
            </View>

            {/* Slide Headline */}
            <Text style={[styles.slideTitle, { color: theme.text }]}>
              {item.title}{' '}
              <Text style={{ color: theme.primary }}>{item.highlight}</Text>
            </Text>

            {/* Slide Subtext */}
            <Text style={[styles.slideDescription, { color: theme.textSecondary }]}>
              {item.description}
            </Text>

            {/* Interactive Feature Mockup */}
            <View style={styles.visualWrapper}>{item.renderVisual()}</View>
          </View>
        )}
      />

      {/* Footer: Pagination & Call-To-Action */}
      <View style={[styles.footer, { borderColor: theme.cardBorder }]}>
        {/* Pagination Dots */}
        <View style={styles.paginationRow}>
          {slides.map((_, index) => {
            const isActive = index === activeIndex;
            return (
              <View
                key={index}
                style={[
                  styles.paginationDot,
                  isActive
                    ? [styles.paginationDotActive, { backgroundColor: theme.primary }]
                    : [styles.paginationDotInactive, { backgroundColor: theme.backgroundSelected }],
                ]}
              />
            );
          })}
        </View>

        {/* Action Button */}
        <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
          <Pressable
            onPress={handleNext}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            style={[styles.primaryButton, { backgroundColor: theme.primary }]}
          >
            <Text style={styles.primaryButtonText}>
              {activeIndex === slides.length - 1 ? 'Enter Demo Workspace' : 'Continue'}
            </Text>
            <Ionicons
              name={activeIndex === slides.length - 1 ? 'rocket-outline' : 'chevron-forward'}
              size={18}
              color="#FFFFFF"
            />
          </Pressable>
        </Animated.View>

        {/* Reassurance Label */}
        <Text style={[styles.subFootNote, { color: theme.textSecondary }]}>
          Interactive Preview • No Sign-in Required
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.select({ ios: 14, android: 16, default: 16 }),
    paddingBottom: 10,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoTitleCol: {
    justifyContent: 'center',
  },
  logoBrandName: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  logoBrandTag: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: -2,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  skipButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.75,
  },
  listContent: {
    alignItems: 'center',
  },
  slideContainer: {
    paddingHorizontal: 22,
    paddingTop: 12,
    alignItems: 'center',
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    marginBottom: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  slideTitle: {
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 33,
    marginBottom: 8,
  },
  slideDescription: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 16,
    paddingHorizontal: 10,
  },
  visualWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  visualCard: {
    width: '100%',
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  branchHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cardHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  branchRow: {
    marginBottom: 12,
  },
  branchInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  branchName: {
    fontSize: 13,
    fontWeight: '600',
  },
  branchMeta: {
    fontSize: 12,
  },
  branchProgressWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressBarBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  stockPercent: {
    fontSize: 11,
    fontWeight: '700',
    width: 28,
    textAlign: 'right',
  },
  alertChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
  },
  alertChipText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },

  /* POS Slide Styles */
  receiptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  receiptBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  receiptStoreName: {
    fontSize: 13,
    fontWeight: '700',
  },
  receiptMeta: {
    fontSize: 11,
  },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 'auto',
  },
  paidText: {
    fontSize: 11,
    fontWeight: '800',
  },
  receiptDivider: {
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    marginVertical: 10,
  },
  receiptItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  receiptItemName: {
    fontSize: 13,
    fontWeight: '500',
  },
  receiptItemPrice: {
    fontSize: 13,
    fontWeight: '700',
  },
  receiptTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    marginTop: 6,
    marginBottom: 10,
  },
  receiptTotalLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  receiptTotalValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  whatsappPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  whatsappPillText: {
    fontSize: 11,
    color: '#15803D',
    fontWeight: '600',
    flex: 1,
  },

  /* Analytics Slide Styles */
  analyticsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  analyticsLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  analyticsValRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  analyticsValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  growthChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  growthText: {
    fontSize: 11,
    fontWeight: '700',
  },
  subdomainPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  subdomainText: {
    fontSize: 11,
    fontWeight: '700',
  },
  sparklineContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 60,
    paddingBottom: 6,
    marginBottom: 8,
  },
  sparklineCol: {
    alignItems: 'center',
    flex: 1,
  },
  sparklineBar: {
    width: 16,
    borderRadius: 4,
    borderWidth: 1,
  },
  sparklineLabel: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: 4,
  },
  staffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  staffLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  staffText: {
    fontSize: 11,
    fontWeight: '600',
  },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  secureText: {
    fontSize: 10,
    fontWeight: '700',
  },

  /* Footer Controls */
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderTopWidth: 1,
    alignItems: 'center',
    gap: 12,
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  paginationDot: {
    height: 6,
    borderRadius: 3,
  },
  paginationDotInactive: {
    width: 6,
  },
  paginationDotActive: {
    width: 24,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: Math.min(Dimensions.get('window').width - 40, 560),
    height: 52,
    borderRadius: 14,
    shadowColor: '#985184',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  subFootNote: {
    fontSize: 12,
    fontWeight: '500',
  },
});
