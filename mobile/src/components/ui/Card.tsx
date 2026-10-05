import React from 'react';
import { View, ViewProps } from 'react-native';

export interface CardProps extends ViewProps {
  className?: string;
  children: React.ReactNode;
}

export function Card({ className = '', children, ...props }: CardProps) {
  return (
    <View
      className={`bg-slate-900/95 border border-slate-800 rounded-3xl p-5 shadow-2xl ${className}`}
      {...props}
    >
      {children}
    </View>
  );
}
