import React from 'react';
import { Folder } from 'lucide-react';

export interface CategoryImageBadgeProps {
  imageUrl?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const CategoryImageBadge: React.FC<CategoryImageBadgeProps> = ({
  imageUrl,
  name,
  size = 'md',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'w-6 h-6 text-xs rounded-md',
    md: 'w-8 h-8 text-sm rounded-lg',
    lg: 'w-12 h-12 text-base rounded-xl',
  }[size];

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-6 h-6',
  }[size];

  if (imageUrl) {
    return (
      <div
        className={`relative shrink-0 overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 shadow-xs ${sizeClasses} ${className}`}
      >
        <img
          src={imageUrl}
          alt={name}
          className="w-full h-full object-cover object-center"
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div
      className={`shrink-0 flex items-center justify-center bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40 ${sizeClasses} ${className}`}
    >
      <Folder className={iconSizes} />
    </div>
  );
};
