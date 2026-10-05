import type { FAQItem } from '../types';

export const FAQS_DATA: FAQItem[] = [
  {
    category: 'General',
    question: 'What makes Orvio Hub different from standard foreign SaaS tools like Odoo or Square?',
    answer:
      'Orvio Hub is engineered specifically for Nigerian business realities. We provide localized Naira pricing, direct Paystack/Flutterwave integration, automated WhatsApp receipt dispatch, offline-capable POS terminals for unpredictable internet connectivity, and a local Lagos-based support team ready to assist you anytime.',
  },
  {
    category: 'General',
    question: 'How do subdomains work on Orvio Hub?',
    answer:
      'When your organization signs up, you claim a unique workspace URL (for example: yourcompany.orvio.com). All your staff, managers, and cashiers log in through this dedicated portal, ensuring isolated data security and professional branding.',
  },
  {
    category: 'Apps',
    question: 'Can I start with only the Inventory app and add Gym or other apps later?',
    answer:
      'Absolutely! Orvio Hub is modular. You can subscribe to just Orvio Inventory & POS (₦10k/mo) or Orvio Gym (₦8k/mo) today. Whenever your business expands, you can enable additional apps from your App Switcher instantly without data loss or re-configuration.',
  },
  {
    category: 'Apps',
    question: 'Does the POS work when the internet is slow or down?',
    answer:
      'Yes. The Orvio POS cashier interface has a built-in offline synchronization layer. Your cashiers can continue scanning barcodes, processing cash sales, and queuing receipts. As soon as your connection resumes, all transactions sync seamlessly to your main cloud database.',
  },
  {
    category: 'Pricing',
    question: 'Is there a free trial and do I need a debit card to register?',
    answer:
      'Every plan comes with a full 14-day free trial with zero restrictions. No credit or debit card is required to sign up and start testing with your real product or member data.',
  },
  {
    category: 'Pricing',
    question: 'What payment methods are supported for subscriptions?',
    answer:
      'We accept all Nigerian debit cards (Mastercard, Visa, Verve), direct bank transfers with automated confirmation, and USSD via our secure Paystack infrastructure.',
  },
  {
    category: 'Security',
    question: 'How is my business financial and customer data secured?',
    answer:
      'Orvio Hub employs enterprise-grade AES-256 bit encryption at rest and TLS 1.3 in transit. We comply strictly with the Nigeria Data Protection Act (NDPA) and perform daily automated backups with 99.95% cloud availability.',
  },
];
