import * as React from 'react';
import { SeoHead } from '../../components/seo/SeoHead';
import { Badge } from '../../components/ui/badge';
import { FileText } from 'lucide-react';

export function TermsPage() {
  return (
    <>
      <SeoHead
        title="Terms of Service | Orvio Hub"
        description="Review the terms, billing rules, and service level conditions governing the use of Orvio Hub SaaS platform."
        keywords={['Terms of service', 'SaaS agreement Nigeria', 'Orvio terms']}
      />

      <div className="py-12 mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-12">
        <header className="space-y-4">
          <Badge variant="secondary">
            <FileText className="h-3.5 w-3.5 mr-1" />
            Terms of Service
          </Badge>
          <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight">
            Terms of Service & Merchant Agreement
          </h1>
          <p className="text-xs text-slate-500">
            Effective Date: September 30, 2026 • Governing Laws of the Federal Republic of Nigeria.
          </p>
        </header>

        <div className="prose prose-slate max-w-none space-y-8 text-sm text-slate-700 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900">1. Acceptance of Terms</h2>
            <p>
              By accessing or creating an account on Orvio Hub (including registering an organization subdomain or subscribing to Orvio Inventory, POS, or Gym), you agree to be bound by these Terms of Service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900">2. Free Trial & Subscriptions</h2>
            <p>
              Orvio offers a 14-day free trial on all plans without requiring debit card details. At the conclusion of the trial period, continuous service requires an active subscription billed in Nigerian Naira (NGN) on a monthly or annual cycle.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900">3. Organization Subdomains & Security</h2>
            <p>
              Merchants are granted a license to utilize their designated organization subdomain (e.g. yourcompany.orvio.com). You are solely responsible for maintaining the confidentiality of staff passwords and for all actions taken under your credentials.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900">4. Service Uptime & Offline Operation</h2>
            <p>
              Orvio Hub commits to a <strong>99.95% cloud service availability target</strong>. While our POS cashier terminal features offline caching capabilities, merchants are responsible for maintaining suitable local hardware and connectivity to synchronize transaction logs.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900">5. Cancellation & Refunds</h2>
            <p>
              You may cancel your subscription at any time from your organization billing portal. Upon cancellation, your service will remain active until the end of your prepaid billing period, with zero termination penalties.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
