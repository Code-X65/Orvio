import * as React from 'react';
import {
  Globe,
  MessageSquare,
  CreditCard,
  WifiOff,
  LayoutGrid,
  ShieldCheck,
  Zap,
  Building2,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';

export function FeatureGrid() {
  const features = [
    {
      icon: LayoutGrid,
      title: 'Unified Multi-App Switcher',
      tag: 'Modular Architecture',
      description:
        'Switch between Inventory, POS, and Gym Management in one click. Install apps as your business grows, just like Odoo.',
      badgeVariant: 'default' as const,
    },
    {
      icon: Globe,
      title: 'Dedicated Organization Subdomains',
      tag: 'Data Isolation',
      description:
        'Give your business a clean, branded portal at yourname.orvio.com. Isolated data partition, custom staff logins, and bank-grade security.',
      badgeVariant: 'glow' as const,
    },
    {
      icon: MessageSquare,
      title: 'Automated WhatsApp Receipts & Reminders',
      tag: '98% Open Rate',
      description:
        'Send professional digital PDF receipts, low-stock manager alerts, and gym renewal reminders directly to WhatsApp.',
      badgeVariant: 'emerald' as const,
    },
    {
      icon: CreditCard,
      title: 'Native Naira Rails & Paystack Integration',
      tag: 'Nigerian-First',
      description:
        'Accept debit cards, direct bank transfers, and USSD without currency conversion headaches or surprise dollar price hikes.',
      badgeVariant: 'amber' as const,
    },
    {
      icon: WifiOff,
      title: 'Offline-Resilient Cashier Terminal',
      tag: 'Zero Downtime',
      description:
        'Never halt checkout during internet cuts. Cashiers scan and print uninterrupted, syncing to the cloud as soon as connection restores.',
      badgeVariant: 'default' as const,
    },
    {
      icon: ShieldCheck,
      title: 'NDPA Compliance & Role Security',
      tag: 'Enterprise Trust',
      description:
        'Granular role permissions (Cashier, Store Manager, Accountant, Admin) with complete audit trails and daily cloud backups.',
      badgeVariant: 'default' as const,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {features.map((f) => {
        const Icon = f.icon;
        return (
          <Card key={f.title} className="card-glow border-slate-200/90 bg-white">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <Icon className="h-6 w-6" />
                </div>
                <Badge variant={f.badgeVariant} className="text-[11px]">
                  {f.tag}
                </Badge>
              </div>
              <CardTitle className="text-lg font-bold text-slate-900 mt-3">
                {f.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-xs text-slate-600 leading-relaxed">
                {f.description}
              </CardDescription>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
