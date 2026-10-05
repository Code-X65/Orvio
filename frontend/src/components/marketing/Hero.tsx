import * as React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, Play, ShieldCheck, CheckCircle2, TrendingUp, Users } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { AppSwitcherMockup } from './AppSwitcherMockup';
import { DemoModal } from './DemoModal';
import { getSignupUrl } from '../../app/config/authUrls';

export function Hero() {
  const [demoOpen, setDemoOpen] = React.useState(false);

  return (
    <section className="relative pt-12 pb-20 overflow-hidden hero-gradient">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-indigo-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
        {/* Top Tagline Pill */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-200/80 text-indigo-700 text-xs font-semibold mb-6 shadow-sm hover:bg-indigo-100/60 transition-colors">
          <Sparkles className="h-3.5 w-3.5 text-indigo-600 animate-pulse" />
          <span>The Next-Gen SaaS Operating System for Nigeria</span>
          <span className="text-slate-300">•</span>
          <span className="text-indigo-900 font-bold">Try Free for 14 Days</span>
        </div>

        {/* Main Headline */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-slate-900 max-w-4xl mx-auto leading-[1.1]">
          One Platform. <br className="hidden sm:inline" />
          <span className="gradient-text">Multiple Apps.</span> Total Control.
        </h1>

        {/* Subtitle */}
        <p className="mt-6 text-base sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Orvio Hub brings <strong>Inventory, Barcode POS, Gym Management</strong>, and unified billing under one single roof — just like Odoo, built natively for Nigerian businesses.
        </p>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <a href={getSignupUrl()} className="w-full sm:w-auto">
            <Button variant="primary" size="xl" className="w-full sm:w-auto gap-3 text-base shadow-indigo-600/30">
              <Sparkles className="h-5 w-5" />
              <span>Start 14-Day Free Trial</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </a>

          <Button
            type="button"
            variant="outline"
            size="xl"
            onClick={() => setDemoOpen(true)}
            className="w-full sm:w-auto gap-2.5 text-base border-slate-300 bg-white/80 hover:bg-white"
          >
            <Play className="h-4 w-4 fill-slate-900 text-slate-900" />
            <span>Watch Guided Tour</span>
          </Button>
        </div>

        {/* Trust Points */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-600 font-medium">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>No debit card required</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>Dedicated organization subdomain</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>Paystack & WhatsApp integrated</span>
          </div>
        </div>

        {/* Live Interactive Mockup Showcase */}
        <div className="mt-14">
          <AppSwitcherMockup />
        </div>
      </div>

      {/* Demo Modal */}
      <DemoModal open={demoOpen} onOpenChange={setDemoOpen} />
    </section>
  );
}
