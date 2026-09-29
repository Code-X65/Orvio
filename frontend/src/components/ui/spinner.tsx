import { LoaderCircle } from 'lucide-react';
import type { HTMLAttributes } from 'react';

import { cn } from '../../lib/utils';

export function Spinner({ className, label = 'Loading', ...props }: HTMLAttributes<HTMLSpanElement> & { label?: string }) {
  return <span role="status" aria-label={label} className={cn('inline-flex items-center', className)} {...props}><LoaderCircle className="size-4 animate-spin" aria-hidden="true" /><span className="sr-only">{label}</span></span>;
}
