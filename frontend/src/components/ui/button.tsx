import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex h-11 items-center justify-center gap-2 rounded-sm px-4 text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-[#86597A]',
        destructive: 'bg-destructive text-white hover:bg-red-500',
        outline: 'border border-white/10 bg-transparent text-foreground hover:bg-white/5',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-white/10',
        ghost: 'text-foreground hover:bg-white/5',
      },
      size: { sm: 'h-9 px-3 text-xs', default: 'h-11 px-4', lg: 'h-12 px-6 text-base', icon: 'h-11 w-11 px-0' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, type = 'button', ...props }, ref) => (
  <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
));
Button.displayName = 'Button';
