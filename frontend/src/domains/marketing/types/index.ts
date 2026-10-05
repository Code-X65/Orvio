export interface AppFeature {
  title: string;
  description: string;
  iconName: string;
  tag?: string;
}

export interface AppProduct {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  badge: string;
  status: 'available' | 'beta' | 'coming_soon';
  monthlyPrice: number;
  annualPrice: number;
  features: AppFeature[];
  benefits: string[];
  metrics: { label: string; value: string }[];
  useCases: { title: string; desc: string; icon: string }[];
}

export interface PricingPlan {
  id: string;
  name: string;
  tagline: string;
  monthlyPrice: number;
  annualPrice: number;
  popular?: boolean;
  badge?: string;
  features: string[];
  notIncluded?: string[];
  ctaText: string;
  ctaLink: string;
}

export interface PricingAddOn {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  unit: string;
}

export interface Testimonial {
  id: string;
  name: string;
  role: string;
  company: string;
  location: string;
  quote: string;
  rating: number;
  avatar: string;
  appName: string;
  stat?: string;
}

export interface FAQItem {
  question: string;
  answer: string;
  category: 'General' | 'Pricing' | 'Apps' | 'Security';
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: 'Inventory Tips' | 'Gym Management' | 'SME Growth' | 'Product Updates';
  author: {
    name: string;
    role: string;
    avatar: string;
  };
  publishedAt: string;
  readTime: string;
  coverImage: string;
  tags: string[];
}
