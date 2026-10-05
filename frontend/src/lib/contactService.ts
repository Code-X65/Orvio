import { z } from 'zod';

export const ContactFormSchema = z.object({
  fullName: z.string().min(2, 'Please enter your full name'),
  email: z.string().email('Please enter a valid business email address'),
  phone: z.string().min(10, 'Please enter a valid Nigerian phone number (e.g. 08012345678)'),
  company: z.string().min(2, 'Please enter your company or business name'),
  interestedApp: z.enum(['inventory', 'gym', 'bundle', 'general'], {
    errorMap: () => ({ message: 'Please select an area of interest' }),
  }),
  message: z.string().min(10, 'Please tell us a bit more about your business needs (min 10 characters)'),
});

export type ContactFormData = z.infer<typeof ContactFormSchema>;

export const NewsletterSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

export type NewsletterData = z.infer<typeof NewsletterSchema>;

export async function submitContactForm(data: ContactFormData): Promise<{ success: boolean; message: string }> {
  // Simulate network latency
  await new Promise((resolve) => setTimeout(resolve, 800));

  // Validate on the client
  ContactFormSchema.parse(data);

  // Ready to connect to backend POST /api/v1/contact or Resend API in future
  return {
    success: true,
    message: `Thank you ${data.fullName}! An Orvio business specialist will reach out to you within 2 hours.`,
  };
}

export async function submitNewsletterSubscription(email: string): Promise<{ success: boolean; message: string }> {
  await new Promise((resolve) => setTimeout(resolve, 600));

  NewsletterSchema.parse({ email });

  return {
    success: true,
    message: 'You have been successfully subscribed to Orvio Business Insights!',
  };
}
