import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ComponentProps } from 'react';

import { cn } from '../../lib/utils';

export const Modal = Dialog.Root;
export const ModalTrigger = Dialog.Trigger;
export const ModalClose = Dialog.Close;
export const ModalTitle = Dialog.Title;
export const ModalDescription = Dialog.Description;

export function ModalContent({ className, children, ...props }: ComponentProps<typeof Dialog.Content>) {
  return <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm" /><Dialog.Content className={cn('fixed left-1/2 top-1/2 z-50 w-[calc(100%-3rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-sm border border-white/10 bg-card p-6 shadow-2xl focus:outline-none', className)} {...props}>{children}<Dialog.Close className="absolute right-4 top-4 rounded-sm p-1 text-slate-400 hover:bg-white/5 hover:text-white focus-visible:outline-none" aria-label="Close dialog"><X size={18} /></Dialog.Close></Dialog.Content></Dialog.Portal>;
}
