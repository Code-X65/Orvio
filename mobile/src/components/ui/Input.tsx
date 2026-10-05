import React from 'react';
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
} from 'react-native';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightIconPress?: () => void;
  required?: boolean;
  containerClassName?: string;
}

export function Input({
  label,
  error,
  leftIcon,
  rightIcon,
  onRightIconPress,
  required,
  containerClassName = '',
  className = '',
  ...props
}: InputProps) {
  return (
    <View className={`space-y-1.5 ${containerClassName}`}>
      {label && (
        <Text className="text-xs font-semibold text-slate-300">
          {label} {required && <Text className="text-rose-400">*</Text>}
        </Text>
      )}

      <View className="flex-row items-center bg-slate-950 border border-slate-800 rounded-xl px-3.5 h-12 focus:border-indigo-500">
        {leftIcon && <View className="mr-2.5">{leftIcon}</View>}

        <TextInput
          placeholderTextColor="#64748b"
          className={`flex-1 text-sm text-white font-medium ${className}`}
          {...props}
        />

        {rightIcon && (
          <TouchableOpacity
            disabled={!onRightIconPress}
            onPress={onRightIconPress}
            className="ml-2.5"
          >
            {rightIcon}
          </TouchableOpacity>
        )}
      </View>

      {error && <Text className="text-[11px] text-rose-400 font-medium">{error}</Text>}
    </View>
  );
}
