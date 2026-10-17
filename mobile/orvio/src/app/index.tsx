import React, { useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DemoWorkspace } from '@/components/demo-workspace';
import { WelcomeBanners } from '@/components/welcome-banners';
import { BottomTabInset, MaxContentWidth } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function HomeScreen() {
  const theme = useTheme();
  const [currentView, setCurrentView] = useState<'tour' | 'workspace'>('tour');
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const transitionTo = (nextView: 'tour' | 'workspace') => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();

    // Switch view halfway through fade
    setTimeout(() => {
      setCurrentView(nextView);
    }, 200);
  };

  return (
    <View style={[styles.outerContainer, { backgroundColor: theme.background }]}>
      <SafeAreaView
        edges={['top', 'left', 'right']}
        style={[styles.safeArea, { backgroundColor: theme.background }]}
      >
        <Animated.View style={[styles.contentContainer, { opacity: fadeAnim }]}>
          {currentView === 'tour' ? (
            <WelcomeBanners onEnterWorkspace={() => transitionTo('workspace')} />
          ) : (
            <DemoWorkspace onReopenTour={() => transitionTo('tour')} />
          )}
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingBottom: Platform.select({
      ios: BottomTabInset,
      android: BottomTabInset,
      default: 0,
    }),
  },
  contentContainer: {
    flex: 1,
  },
});
