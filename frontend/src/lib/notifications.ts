import { toast } from 'sonner';

export const notify = {
  success(message: string) { toast.success(message); },
  info(message: string) { toast.info(message); },
  error(message = 'We could not complete that. Please try again.', options?: { description?: string }) { toast.error(message, options); },
};
