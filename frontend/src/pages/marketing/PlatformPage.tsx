import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  Layers,
  Globe,
  ShieldCheck,
  LayoutGrid,
  Wallet,
  Lock,
  Code2,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Server,
  Zap,
} from 'lucide-react';
import { SeoHead } from '../../components/seo/SeoHead';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card';
import { CTASection } from '../../components/marketing/CTASection';
import { APPS_DATA } from '../../domains/marketing/data/apps';
import { getSignupUrl } from '../../app/config/authUrls';

export function PlatformPage() {
  const platform = APPS_DATA.find((a) => a.id === 'platform')!;

  const comparisons = [
    {
      feature: 'Pricing Currency & Predictability',
      orvio: '100% Naira Pricing (Paystack/Transfers)',
      foreign: 'Billed in USD with volatile FX exchange fluctuations',
    },
    {
      feature: 'Multi-Tenant Subdomain Isolation',
      orvio: 'Included on all plans (yourbrand.orvio.com)',
      foreign: 'Often restricted to Enterprise $500+/mo tiers',
    },
    {
      feature: 'WhatsApp Automated Dispatch',
      orvio: 'Native direct integration for receipts & alerts',
      foreign: 'Requires expensive third-party Twilio/Zapier bridges',
    },
    {
      feature: 'Offline Cashier POS Sync',
      orvio: 'Built-in local storage sync for power/network drops',
      foreign: 'Often freezes or drops transactions offline',
    },
    {
      feature: 'Local Support & Onboarding',
      orvio: 'Dedicated Lagos WhatsApp & phone assistance',
      foreign: 'Email tickets across distant US/European time zones',
    },
  ];

  return (
    <>
      <SeoHead
        title="Platform Architecture & Multi-Tenant Engine | Orvio Hub"
        description="Discover Orvio Hub's modular multi-tenant architecture, organization subdomains, unified SSO, and centralized billing designed for Nigerian scale."
        keywords={[
          'Multi-tenant SaaS Nigeria',
          'Odoo alternative Africa',
          'Business ERP architecture',
          'Subdomain isolation SaaS',
        ]}
      />

      <div className="space-y-20 py-12">
        {/* Platform Hero */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <Badge variant="glow" className="mb-4">
            <Layers className="h-3.5 w-3.5 mr-1" />
            Core Platform Operating System
          </Badge>
          <h1 className="text-4xl sm:text-6xl font-black text-slate-900 tracking-tight max-w-4xl mx-auto leading-tight">
            One Operating System. <br />
            <span className="gradient-text">Infinite Business Modules.</span>
          </h1>
          <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Orvio is not just a single app — it is an expandable business platform. Connect your inventory, POS desks, gyms, and future modules through one high-performance hub.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href={getSignupUrl('bundle')} className="w-full sm:w-auto">
              <Button variant="primary" size="xl" className="w-full sm:w-auto font-bold shadow-indigo-600/30">
                <Sparkles className="h-5 w-5" />
                <span>Claim Your Organization Subdomain</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </a>
            <Link to="/products" className="w-full sm:w-auto">
              <Button variant="outline" size="xl" className="w-full sm:w-auto">
                Explore All Apps
              </Button>
            </Link>
          </div>
        </section>

        {/* Visual Architecture Diagram */}
        <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-slate-800 bg-slate-950 p-8 sm:p-12 text-white shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="text-center max-w-2xl mx-auto mb-10">
              <Badge variant="glow" className="bg-indigo-900/60 text-indigo-300 border-indigo-700/60 mb-2">
                System Topology
              </Badge>
              <h3 className="text-2xl sm:text-3xl font-black tracking-tight">
                How Orvio Hub Isolates & Synchronizes Data
              </h3>
            </div>

            {/* Architecture Node Map */}
            <div className="space-y-6">
              {/* Layer 1: Subdomain Gateway */}
              <div className="p-4 rounded-2xl bg-indigo-950/60 border border-indigo-700/60 text-center">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-300 block">
                  Gateway & Identity Layer
                </span>
                <div className="text-lg font-mono font-bold text-white mt-1">
                  https://<span className="text-emerald-400">yourbrand</span>.orvio.com
                </div>
                <div className="text-xs text-indigo-200 mt-1">
                  Single Sign-On (SSO) • NDPA Encrypted Sessions • Role Permissions
                </div>
              </div>

              {/* Layer 2: Modular Apps */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center">
                  <div className="text-xs font-bold text-indigo-400">App Module 01</div>
                  <div className="text-sm font-bold text-white mt-1">Inventory & POS</div>
                  <p className="text-[11px] text-slate-400 mt-1">Real-time SKUs & Cashiers</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center">
                  <div className="text-xs font-bold text-emerald-400">App Module 02</div>
                  <div className="text-sm font-bold text-white mt-1">Gym Management</div>
                  <p className="text-[11px] text-slate-400 mt-1">Subscriptions & QR Passes</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center">
                  <div className="text-xs font-bold text-sky-400">App Module 03</div>
                  <div className="text-sm font-bold text-white mt-1">Accounting & More</div>
                  <p className="text-[11px] text-slate-400 mt-1">Centralized Ledger</p>
                </div>
              </div>

              {/* Layer 3: Central Database & Naira Rails */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-center">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                  Centralized African Infrastructure
                </span>
                <div className="text-xs text-slate-300 mt-1 flex flex-wrap items-center justify-center gap-4">
                  <span>Paystack Naira Recurring</span>
                  <span>•</span>
                  <span>WhatsApp Cloud API</span>
                  <span>•</span>
                  <span>PostgreSQL Multi-Tenant Isolation</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {platform.features.map((f) => (
              <Card key={f.title} className="card-glow bg-white border-slate-200/90">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                      <Layers className="h-5 w-5" />
                    </div>
                    {f.tag && (
                      <Badge variant="glow" className="text-[10px]">
                        {f.tag}
                      </Badge>
                    )}
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
            ))}
          </div>
        </section>

        {/* Direct Comparison Table */}
        <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <Badge variant="emerald" className="mb-2">
              Why We Are Different
            </Badge>
            <h3 className="text-3xl font-black text-slate-900 tracking-tight">
              Orvio Hub vs. Legacy & Foreign Software
            </h3>
          </div>

          <div className="rounded-3xl border border-slate-200/90 bg-white overflow-hidden shadow-sm">
            <div className="grid grid-cols-12 bg-slate-900 text-white p-4 font-bold text-xs sm:text-sm">
              <div className="col-span-4">Capability / Dimension</div>
              <div className="col-span-4 text-emerald-400">Orvio Hub</div>
              <div className="col-span-4 text-slate-400">Foreign SaaS / Odoo</div>
            </div>

            <div className="divide-y divide-slate-100 text-xs sm:text-sm">
              {comparisons.map((c) => (
                <div key={c.feature} className="grid grid-cols-12 p-4 items-center gap-2">
                  <div className="col-span-4 font-bold text-slate-900">{c.feature}</div>
                  <div className="col-span-4 text-emerald-700 font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>{c.orvio}</span>
                  </div>
                  <div className="col-span-4 text-slate-500">{c.foreign}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <CTASection
          title="Consolidate Your Business Apps Today"
          subtitle="Get all your apps and your custom subdomain on Orvio Hub with zero setup fees."
        />
      </div>
    </>
  );
}
