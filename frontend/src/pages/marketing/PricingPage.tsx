import * as React from 'react';
import { SeoHead } from '../../components/seo/SeoHead';
import { Badge } from '../../components/ui/badge';
import { PricingCalculator } from '../../components/marketing/PricingCalculator';
import { FAQAccordion } from '../../components/marketing/FAQAccordion';
import { CTASection } from '../../components/marketing/CTASection';
import { FAQS_DATA } from '../../domains/marketing/data/faqs';
import { Check, X, Sparkles } from 'lucide-react';

export function PricingPage() {
  const pricingFaqs = FAQS_DATA.filter(
    (f) => f.category === 'Pricing' || f.category === 'General'
  );

  const featureMatrix = [
    { feature: 'Core Cloud POS & Barcode Scanner', inv: true, bundle: true, gym: false },
    { feature: 'Real-Time Inventory & Multi-Warehouse', inv: true, bundle: true, gym: false },
    { feature: 'WhatsApp Customer E-Receipts', inv: true, bundle: true, gym: true },
    { feature: 'Batch Expiry & Low Stock Alerts', inv: true, bundle: true, gym: false },
    { feature: 'Gym Member Database & Recurring Dues', inv: false, bundle: true, gym: true },
    { feature: 'QR Turnstile & Digital Passes', inv: false, bundle: true, gym: true },
    { feature: 'Class & Trainer Schedule Manager', inv: false, bundle: true, gym: true },
    { feature: 'Custom Organization Subdomain', inv: true, bundle: true, gym: true },
    { feature: 'Unified Single Sign-On (SSO)', inv: false, bundle: true, gym: false },
    { feature: 'Paystack & Bank Transfer Integration', inv: true, bundle: true, gym: true },
    { feature: '24/7 Lagos WhatsApp Priority Support', inv: true, bundle: true, gym: true },
  ];

  return (
    <>
      <SeoHead
        title="Pricing & Plans — Transparent Naira SaaS Subscriptions | Orvio Hub"
        description="Simple, predictable Naira pricing for Orvio Inventory & POS (₦10k/mo), Gym Management (₦8k/mo), and All-in-One Enterprise Bundle (₦15k/mo)."
        keywords={[
          'Orvio pricing',
          'POS software price Nigeria',
          'Gym software cost Nigeria',
          'SaaS subscription naira',
        ]}
      />

      <div className="space-y-20 py-12">
        {/* Header Hero */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <Badge variant="glow" className="mb-4">
            <Sparkles className="h-3.5 w-3.5 mr-1" />
            Simple & Transparent Local Pricing
          </Badge>
          <h1 className="text-4xl sm:text-6xl font-black text-slate-900 tracking-tight max-w-4xl mx-auto leading-tight">
            Invest in Software That <span className="gradient-text">Pays for Itself</span>
          </h1>
          <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            All plans include a 14-day free trial with full access. No debit card required to get started. Switch or cancel anytime.
          </p>
        </section>

        {/* Interactive Pricing Calculator Component */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <PricingCalculator />
        </section>

        {/* Feature Comparison Matrix Table */}
        <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <Badge variant="secondary" className="mb-2">
              Side-by-Side Breakdown
            </Badge>
            <h3 className="text-3xl font-black text-slate-900 tracking-tight">
              Detailed Feature Comparison Matrix
            </h3>
          </div>

          <div className="rounded-3xl border border-slate-200/90 bg-white overflow-hidden shadow-sm">
            <div className="grid grid-cols-12 bg-slate-900 text-white p-4 font-bold text-xs sm:text-sm">
              <div className="col-span-6">Platform Capabilities</div>
              <div className="col-span-2 text-center text-indigo-300">Inventory</div>
              <div className="col-span-2 text-center text-emerald-300">Bundle</div>
              <div className="col-span-2 text-center text-sky-300">Gym</div>
            </div>

            <div className="divide-y divide-slate-100 text-xs sm:text-sm">
              {featureMatrix.map((row) => (
                <div key={row.feature} className="grid grid-cols-12 p-3.5 items-center">
                  <div className="col-span-6 font-medium text-slate-800">{row.feature}</div>
                  <div className="col-span-2 flex justify-center">
                    {row.inv ? (
                      <Check className="h-4 w-4 text-emerald-600 stroke-[3]" />
                    ) : (
                      <X className="h-4 w-4 text-slate-300" />
                    )}
                  </div>
                  <div className="col-span-2 flex justify-center bg-indigo-50/50 py-1 rounded-md">
                    {row.bundle ? (
                      <Check className="h-4 w-4 text-indigo-600 stroke-[3]" />
                    ) : (
                      <X className="h-4 w-4 text-slate-300" />
                    )}
                  </div>
                  <div className="col-span-2 flex justify-center">
                    {row.gym ? (
                      <Check className="h-4 w-4 text-emerald-600 stroke-[3]" />
                    ) : (
                      <X className="h-4 w-4 text-slate-300" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing FAQs */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <Badge variant="secondary" className="mb-2">
              Billing Queries
            </Badge>
            <h3 className="text-3xl font-black text-slate-900 tracking-tight">
              Pricing FAQs
            </h3>
          </div>

          <FAQAccordion items={pricingFaqs} />
        </section>

        <CTASection
          title="Ready to Automate Your Operations?"
          subtitle="Start your 14-day free trial today. Cancel anytime with a single click."
        />
      </div>
    </>
  );
}
