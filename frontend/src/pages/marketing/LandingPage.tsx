import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  Boxes,
  Dumbbell,
  Layers,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Zap,
  TrendingUp,
  Sparkles,
} from 'lucide-react';
import { Hero } from '../../components/marketing/Hero';
import { FeatureGrid } from '../../components/marketing/FeatureGrid';
import { Testimonials } from '../../components/marketing/Testimonials';
import { PricingCalculator } from '../../components/marketing/PricingCalculator';
import { FAQAccordion } from '../../components/marketing/FAQAccordion';
import { CTASection } from '../../components/marketing/CTASection';
import { SeoHead } from '../../components/seo/SeoHead';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent } from '../../components/ui/card';
import { FAQS_DATA } from '../../domains/marketing/data/faqs';
import { APPS_DATA } from '../../domains/marketing/data/apps';
import { formatNaira } from '../../lib/utils';

export function LandingPage() {
  return (
    <>
      <SeoHead
        title="Orvio Hub — The Odoo for Nigerian Businesses | Inventory, POS & Gym SaaS"
        description="Orvio Hub brings Inventory, Barcode POS, Gym Management, and multi-tenant subdomains under one unified operating system built for Nigerian retail and SMEs."
        keywords={[
          'Inventory management software Nigeria',
          'POS terminal Lagos',
          'Gym management software Nigeria',
          'Multi-tenant business ERP Nigeria',
          'Paystack retail billing',
          'Odoo alternative Africa',
        ]}
      />

      <div className="space-y-20 sm:space-y-28">
        {/* 1. Hero Section with Live Mockup */}
        <Hero />

        {/* 2. Apps Showcase Carousel / Grid */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <Badge variant="glow" className="mb-3">
              Modular Apps Architecture
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Powerful Apps That Work Seamlessly Together
            </h2>
            <p className="mt-3 text-base text-slate-600">
              Install the app your business needs today. Connect more as you grow, with unified login and consolidated Naira billing.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {APPS_DATA.map((app) => (
              <Card
                key={app.id}
                className="card-glow border-slate-200/90 flex flex-col justify-between p-6 bg-white"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <Badge variant={app.id === 'inventory' ? 'emerald' : app.id === 'gym' ? 'primary' : 'secondary'}>
                      {app.badge}
                    </Badge>
                    <span className="text-xs font-bold text-slate-500">
                      From {formatNaira(app.monthlyPrice)}/mo
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-slate-900 mt-4">
                    {app.name}
                  </h3>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    {app.tagline}
                  </p>

                  <div className="mt-6 pt-4 border-t border-slate-100 space-y-2.5">
                    {app.benefits.slice(0, 3).map((benefit) => (
                      <div key={benefit} className="flex items-start gap-2 text-xs text-slate-700">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{benefit}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-8 pt-4 border-t border-slate-100">
                  <Link to={`/products/${app.slug}`} className="w-full">
                    <Button variant="outline" className="w-full justify-between group">
                      <span>Explore {app.name.split('&')[0]}</span>
                      <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* 3. Platform & Nigerian-First Features */}
        <section className="bg-slate-100/70 py-20 border-y border-slate-200/60">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-14">
              <Badge variant="amber" className="mb-3">
                Engineered for Nigerian Reality
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                Why Nigerian Businesses Choose Orvio Over Foreign Tools
              </h2>
              <p className="mt-3 text-base text-slate-600">
                Foreign software doesn't understand network drops, WhatsApp receipts, or Naira volatility. Orvio was created specifically to solve these bottlenecks.
              </p>
            </div>

            <FeatureGrid />
          </div>
        </section>

        {/* 4. Social Proof & Testimonials */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Testimonials />
        </section>

        {/* 5. Interactive Pricing Simulator */}
        <section className="bg-slate-100/60 py-20 border-y border-slate-200/60" id="pricing">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-14">
              <Badge variant="primary" className="mb-3">
                Transparent Local Pricing
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                Simple, Predictable Naira Subscriptions
              </h2>
              <p className="mt-3 text-base text-slate-600">
                No foreign exchange risk. No surprise price hikes. Choose the plan that fits your business scale.
              </p>
            </div>

            <PricingCalculator />
          </div>
        </section>

        {/* 6. FAQ Section */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <Badge variant="secondary" className="mb-3">
              Answers & Clarifications
            </Badge>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              Frequently Asked Questions
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Have questions about how Orvio Hub operates? We have got you covered.
            </p>
          </div>

          <FAQAccordion items={FAQS_DATA} />
        </section>

        {/* 7. Bottom Conversion Banner */}
        <CTASection />
      </div>
    </>
  );
}
