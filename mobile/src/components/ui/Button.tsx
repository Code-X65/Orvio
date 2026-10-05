import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  TouchableOpacityProps,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';

export interface ButtonProps extends TouchableOpacityProps {
  title?: string;
  variant?: 'primary' | 'emerald' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children?: React.ReactNode;
}

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  children,
  disabled,
  onPress,
  className = '',
  ...props
}: ButtonProps) {
  const handlePress = (e: any) => {
    if (disabled || loading) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Ignored
    }
    onPress?.(e);
  };

  const getVariantClasses = () => {
    switch (variant) {
      case 'emerald':
        return 'bg-emerald-600 active:bg-emerald-700 shadow-emerald-500/20';
      case 'outline':
        return 'bg-transparent border border-slate-700 active:bg-slate-800';
      case 'ghost':
        return 'bg-transparent active:bg-slate-800';
      case 'destructive':
        return 'bg-rose-600 active:bg-rose-700 shadow-rose-500/20';
      case 'primary':
      default:
        return 'bg-indigo-600 active:bg-indigo-700 shadow-indigo-500/25';
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'h-9 px-3.5 rounded-lg';
      case 'lg':
        return 'h-13 px-6 rounded-2xl';
      case 'md':
      default:
        return 'h-11 px-4.5 rounded-xl';
    }
  };

  const getTextClasses = () => {
    switch (variant) {
      case 'outline':
        return 'text-slate-200 font-semibold';
      case 'ghost':
        return 'text-slate-300 font-medium';
      default:
        return 'text-white font-bold';
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={disabled || loading}
      onPress={handlePress}
      className={`flex-row items-center justify-center shadow-md ${getVariantClasses()} ${getSizeClasses()} ${disabled ? 'opacity-50' : ''} ${className}`}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color="#ffffff" size="small" />
      ) : (
        <View className="flex-row items-center justify-center gap-2">
          {leftIcon}
          {title ? (
            <Text className={`text-sm text-center ${getTextClasses()}`}>{title}</Text>
          ) : (
            children
          )}
          {rightIcon}
        </View>
      )}
    </TouchableOpacity>
  );
}
