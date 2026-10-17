import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface OrvioLogoProps {
  size?: number;
  showGlow?: boolean;
}

export function OrvioLogo({ size = 72, showGlow = true }: OrvioLogoProps) {
  const theme = useTheme();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Subtle continuous breathing pulse
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.06,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: true,
        }),
      ])
    );

    // Very gentle slow rotation for accent ring
    const rotateLoop = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 12000,
        useNativeDriver: true,
      })
    );

    pulseLoop.start();
    rotateLoop.start();

    return () => {
      pulseLoop.stop();
      rotateLoop.stop();
    };
  }, [pulseAnim, rotateAnim]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const radius = size * 0.32;
  const iconSize = size * 0.44;

  return (
    <View style={[styles.container, { width: size + 20, height: size + 20 }]}>
      {/* Background Soft Glow */}
      {showGlow && (
        <Animated.View
          style={[
            styles.glowRing,
            {
              width: size + 16,
              height: size + 16,
              borderRadius: (size + 16) / 2,
              backgroundColor: theme.primary,
              transform: [{ scale: pulseAnim }],
            },
          ]}
        />
      )}

      {/* Outer Rotating Accent Ring */}
      <Animated.View
        style={[
          styles.accentBorder,
          {
            width: size + 8,
            height: size + 8,
            borderRadius: (size + 8) / 2,
            borderColor: theme.secondary,
            transform: [{ rotate: spin }],
          },
        ]}
      />

      {/* Main Brand Container */}
      <Animated.View
        style={[
          styles.brandBadge,
          {
            width: size,
            height: size,
            borderRadius: radius,
            backgroundColor: theme.primary,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        <Ionicons name="cube" size={iconSize} color="#FFFFFF" />
        {/* Gold Accent Dot (The Orvio Hub beacon) */}
        <View
          style={[
            styles.goldDot,
            {
              width: size * 0.22,
              height: size * 0.22,
              borderRadius: (size * 0.22) / 2,
              backgroundColor: theme.secondary,
            },
          ]}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    position: 'absolute',
    opacity: 0.18,
  },
  accentBorder: {
    position: 'absolute',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    opacity: 0.45,
  },
  brandBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#985184',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
    position: 'relative',
  },
  goldDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});
