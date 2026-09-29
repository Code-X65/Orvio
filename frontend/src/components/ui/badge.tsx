import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';

import { cn } from '../../lib/utils';

const badgeVariants = cva('inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide', {
  variants: {
    variant: {
      default: 'border-primary/60 bg-primary/20 text-[#D4A8C9]',
      secondary: 'border-white/10 bg-white/5 text-slate-300',
      destructive: 'border-red-400/40 bg-red-400/10 text-red-400',
      success: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-400',
    },
  },
  defaultVariants: { variant: 'default' },
});

export interface BadgeProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}
export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
