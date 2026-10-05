import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  Boxes,
  Dumbbell,
  Layers,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Clock,
  Zap,
} from 'lucide-react';
import { SeoHead } from '../../components/seo/SeoHead';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { CTASection } from '../../components/marketing/CTASection';
import { APPS_DATA } from '../../domains/marketing/data/apps';
import { formatNaira } from '../../lib/utils';
import { getSignupUrl } from '../../app/config/authUrls';

export function ProductsPage() {
  const futureApps = [
    {
      name: 'Orvio Accounting & Tax',
      tagline: 'FIRS & State automated tax schedules, balance sheets, and audit-ready reports.',
      status: 'Coming Q4 2026',
      icon: 'Calculator',
    },
    {
      name: 'Orvio Payroll & HR',
      tagline: 'PAYE, Pension, and direct bank salary disbursements for Nigerian team members.',
      status: 'Coming Q1 2027',
      icon: 'Users',
    },
  ];

  return (
    <>
      <SeoHead
        title="Products & Modular Business Apps | Orvio Hub"
        description="Explore Orvio Hub's modular suite of business applications: Inventory & POS, Gym Management, and Multi-tenant Platform Engine."
        keywords={['Orvio products', 'Inventory POS software', 'Gym membership platform', 'SaaS suite Nigeria']}
      />

      <div className="space-y-20 py-12">
        {/* Header Hero */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <Badge variant="glow" className="mb-4">
            Modular Enterprise Suite
          </Badge>
          <h1 className="text-4xl sm:text-6xl font-black text-slate-900 tracking-tight">
            Modular Apps Built to Scale With Your Ambition
          </h1>
          <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Every app in the Orvio ecosystem is designed to solve a specific Nigerian business pain point while staying natively interconnected under your custom subdomain.
          </p>
        </section>

        {/* Live Available Apps */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
          {APPS_DATA.map((app, idx) => {
            const isReverse = idx % 2 === 1;

            return (
              <div
                key={app.id}
                className={`flex flex-col ${
                  isReverse ? 'lg:flex-row-reverse' : 'lg:flex-row'
                } items-center gap-10 lg:gap-14 rounded-3xl border border-slate-200/90 bg-white p-8 sm:p-12 shadow-sm card-glow`}
              >
                {/* Left / Text Info */}
                <div className="flex-1 space-y-6">
                  <div className="flex items-center gap-3">
                    <Badge variant={app.id === 'inventory' ? 'emerald' : 'primary'}>
                      {app.badge}
                    </Badge>
                    <span className="text-xs font-bold text-slate-500">
                      Starting at {formatNaira(app.monthlyPrice)} / month
                    </span>
                  </div>

                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">
                    {app.name}
                  </h2>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {app.description}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    {app.features.slice(0, 4).map((f) => (
                      <div key={f.title} className="flex items-start gap-2.5 text-xs text-slate-700">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-slate-900">{f.title}: </strong>
                          <span>{f.description}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-slate-100">
                    <Link to={`/products/${app.slug}`}>
                      <Button variant="primary" size="lg" className="font-bold">
                        <span>Explore {app.name.split('&')[0]} Features</span>
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                    <a href={getSignupUrl(app.id)}>
                      <Button variant="outline" size="lg">
                        <span>Start Free Trial</span>
                      </Button>
                    </a>
                  </div>
                </div>

                {/* Right / Metrics Showcase Card */}
                <div className="w-full lg:w-[420px] rounded-2xl bg-slate-950 p-6 text-white border border-slate-800 space-y-6">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Performance Impact
                    </span>
                    <Badge variant="glow" className="text-[10px] bg-indigo-900/80 text-indigo-300">
                      Verified Metrics
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {app.metrics.map((m) => (
                      <div key={m.label} className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                        <div className="text-2xl font-black text-emerald-400">{m.value}</div>
                        <div className="text-[11px] text-slate-400 mt-1">{m.label}</div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-800/80">
                    <span className="text-xs font-semibold text-slate-300 block">
                      Target Nigerian Industries:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {app.useCases.map((u) => (
                        <span
                          key={u.title}
                          className="px-2.5 py-1 rounded-lg bg-slate-900 text-[11px] font-medium text-slate-300 border border-slate-800"
                        >
                          {u.title}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        {/* Future Apps Roadmap Preview */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-slate-900 p-8 sm:p-12 text-white border border-slate-800">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <Badge variant="glow" className="bg-indigo-950 text-indigo-300 border-indigo-700/60 mb-3">
                <Clock className="h-3 w-3 mr-1" />
                Product Roadmap
              </Badge>
              <h3 className="text-2xl sm:text-3xl font-black tracking-tight">
                Upcoming Apps in the Orvio Ecosystem
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 mt-2">
                We are actively engineering new modules to give Nigerian companies end-to-end operational freedom.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {futureApps.map((fa) => (
                <div
                  key={fa.name}
                  className="p-6 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-base font-bold text-white">{fa.name}</span>
                      <span className="px-2.5 py-1 rounded-full bg-slate-800 text-[10px] font-semibold text-indigo-300 border border-slate-700">
                        {fa.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                      {fa.tagline}
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-500">
                    Will integrate seamlessly with your existing Orvio organization subdomain.
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <CTASection
          title="Start with One App. Expand as You Grow."
          subtitle="Try Orvio Inventory, Gym, or the complete bundle free for 14 days."
        />
      </div>
    </>
  );
}
