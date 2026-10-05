import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-indigo-50 text-indigo-700 border border-indigo-200/60',
        primary:
          'border-transparent bg-indigo-600 text-white shadow-sm',
        emerald:
          'border-transparent bg-emerald-50 text-emerald-700 border border-emerald-200/60',
        amber:
          'border-transparent bg-amber-50 text-amber-800 border border-amber-200/60',
        secondary:
          'border-transparent bg-slate-100 text-slate-800',
        destructive:
          'border-transparent bg-rose-50 text-rose-700 border border-rose-200/60',
        outline: 'border border-slate-200 text-slate-700 bg-white',
        glow:
          'bg-indigo-600/10 text-indigo-600 border border-indigo-500/20 shadow-[0_0_12px_rgba(99,102,241,0.25)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
