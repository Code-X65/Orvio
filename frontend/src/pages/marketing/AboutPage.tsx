import * as React from 'react';
import { SeoHead } from '../../components/seo/SeoHead';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { CTASection } from '../../components/marketing/CTASection';
import {
  HeartHandshake,
  ShieldCheck,
  Zap,
  Building2,
  Users,
  Sparkles,
  MapPin,
  CheckCircle2,
} from 'lucide-react';

export function AboutPage() {
  const values = [
    {
      icon: Zap,
      title: 'Nigerian-First Engineering',
      desc: 'We engineer our software for unstable internet, volatile foreign exchange, and WhatsApp dominance. We solve local bottlenecks first.',
    },
    {
      icon: ShieldCheck,
      title: 'Obsessive Reliability',
      desc: 'Retail checkouts and gym turnstiles cannot freeze. We obsess over 99.95% uptime, offline caching, and bank-grade data security.',
    },
    {
      icon: HeartHandshake,
      title: 'Radical Simplicity',
      desc: 'No complex 300-page enterprise manuals. If a cashier or front-desk receptionist cannot master Orvio in 10 minutes, we redesign it.',
    },
    {
      icon: Users,
      title: 'Customer Empathy & Growth',
      desc: 'Our success is tied directly to the growth of our merchants. When your business opens its 5th branch, we celebrate with you.',
    },
  ];

  const team = [
    {
      name: 'Olumide Adeleke',
      role: 'Co-Founder & CEO',
      bio: 'Former fintech operations lead with 10+ years scaling African commerce systems.',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
    },
    {
      name: 'Tunde Adeleke',
      role: 'Co-Founder & Chief Technology Officer',
      bio: 'Distributed systems architect passionate about multi-tenant reliability and offline-first web apps.',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
    },
    {
      name: 'Chidinma Okonjo',
      role: 'Head of Customer Success & Onboarding',
      bio: 'Dedicated to helping retail managers and gym owners streamline daily operations seamlessly.',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80',
    },
  ];

  return (
    <>
      <SeoHead
        title="About Orvio Hub — Our Mission & African Commerce Story"
        description="Learn how Orvio Hub was founded in Lagos to give Nigerian SMEs world-class, modular business operating tools without dollar billing friction."
        keywords={['About Orvio', 'Orvio team Lagos', 'SaaS company Nigeria', 'African commerce ERP']}
      />

      <div className="space-y-20 py-12">
        {/* About Hero */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <Badge variant="glow" className="mb-4">
            <Building2 className="h-3.5 w-3.5 mr-1" />
            Our Mission & Roots
          </Badge>
          <h1 className="text-4xl sm:text-6xl font-black text-slate-900 tracking-tight max-w-4xl mx-auto leading-tight">
            Building the Digital Operating System for <span className="gradient-text">African Business</span>
          </h1>
          <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Founded in Lagos, Nigeria, Orvio Hub was born from a simple conviction: African entrepreneurs deserve world-class business software that understands their local environment.
          </p>
        </section>

        {/* Origin Story Grid */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center rounded-3xl bg-white border border-slate-200/90 p-8 sm:p-12 shadow-sm">
            <div className="lg:col-span-6 space-y-4">
              <Badge variant="secondary">The Orvio Story</Badge>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Why We Built Orvio Hub
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                In 2026, running a business in Nigeria still meant stitching together paper notebooks, WhatsApp groups, and expensive foreign SaaS tools billed in skyrocketing US dollars that crashed during broadband outages.
              </p>
              <p className="text-sm text-slate-600 leading-relaxed">
                We realized that what African SMEs needed wasn’t another complex, overpriced ERP, but a clean, modular suite inspired by Odoo — built ground-up with native Naira billing, offline resilience, and WhatsApp integration.
              </p>
              <p className="text-sm text-slate-600 leading-relaxed font-semibold text-slate-900">
                Today, Orvio powers hundreds of supermarkets, pharmacies, gyms, and multi-service hubs across Nigeria.
              </p>
            </div>

            <div className="lg:col-span-6 grid grid-cols-2 gap-4">
              <div className="p-6 rounded-2xl bg-indigo-50 border border-indigo-100">
                <div className="text-3xl font-black text-indigo-700">500+</div>
                <div className="text-xs font-semibold text-slate-600 mt-1">Active Nigerian Merchants</div>
              </div>
              <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-100">
                <div className="text-3xl font-black text-emerald-700">₦1.2B+</div>
                <div className="text-xs font-semibold text-slate-600 mt-1">GMV Reconciled Annually</div>
              </div>
              <div className="p-6 rounded-2xl bg-sky-50 border border-sky-100">
                <div className="text-3xl font-black text-sky-700">99.95%</div>
                <div className="text-xs font-semibold text-slate-600 mt-1">Cloud Service Uptime</div>
              </div>
              <div className="p-6 rounded-2xl bg-amber-50 border border-amber-100">
                <div className="text-3xl font-black text-amber-700">&lt; 2hr</div>
                <div className="text-xs font-semibold text-slate-600 mt-1">Lagos Support Response</div>
              </div>
            </div>
          </div>
        </section>

        {/* Core Values */}
        <section className="bg-slate-100/70 py-20 border-y border-slate-200/60">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <Badge variant="primary" className="mb-3">
                Our Core Principles
              </Badge>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">
                What Guides Every Feature We Build
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {values.map((v) => {
                const Icon = v.icon;
                return (
                  <Card key={v.title} className="bg-white border-slate-200/90 card-glow p-6 flex flex-col justify-between">
                    <div>
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 mb-4">
                        <Icon className="h-6 w-6" />
                      </div>
                      <h4 className="text-base font-bold text-slate-900">{v.title}</h4>
                      <p className="text-xs text-slate-600 mt-2 leading-relaxed">{v.desc}</p>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* Leadership Team */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <Badge variant="secondary" className="mb-3">
              Leadership
            </Badge>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              Meet the Builders Behind Orvio
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {team.map((m) => (
              <Card key={m.name} className="bg-white border-slate-200/90 card-glow overflow-hidden text-center p-6">
                <img
                  src={m.avatar}
                  alt={m.name}
                  className="h-28 w-28 rounded-full object-cover mx-auto ring-4 ring-indigo-500/10 mb-4 shadow-sm"
                />
                <h4 className="text-lg font-bold text-slate-900">{m.name}</h4>
                <p className="text-xs font-semibold text-indigo-600 mt-0.5">{m.role}</p>
                <p className="text-xs text-slate-600 mt-3 leading-relaxed">{m.bio}</p>
              </Card>
            ))}
          </div>
        </section>

        <CTASection
          title="Join Us on the Journey"
          subtitle="Experience the difference of business software built for your success."
        />
      </div>
    </>
  );
}
