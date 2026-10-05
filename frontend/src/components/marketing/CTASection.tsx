import * as React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, ShieldCheck, PhoneCall } from 'lucide-react';
import { Button } from '../ui/button';
import { getSignupUrl } from '../../app/config/authUrls';

export function CTASection({
  title = 'Ready to Run Your Entire Business on Orvio?',
  subtitle = 'Join 500+ Nigerian retailers, pharmacies, and gym owners scaling with confidence. Start your 14-day free trial today.',
  buttonText = 'Get Started in 60 Seconds',
}: {
  title?: string;
  subtitle?: string;
  buttonText?: string;
}) {
  return (
    <section className="relative py-16 sm:py-24 bg-gradient-to-tr from-slate-950 via-indigo-950 to-slate-900 text-white overflow-hidden">
      {/* Decorative gradient blur */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center space-y-8">
        <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white max-w-3xl mx-auto leading-tight">
          {title}
        </h2>
        <p className="text-sm sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
          {subtitle}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <a href={getSignupUrl()} className="w-full sm:w-auto">
            <Button
              variant="emerald"
              size="xl"
              className="w-full sm:w-auto font-bold text-base shadow-lg shadow-emerald-950/50"
            >
              <Sparkles className="h-5 w-5" />
              <span>{buttonText}</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </a>

          <a
            href="https://wa.me/2348000000000?text=Hello%20Orvio%20Team%2C%20I%20would%20like%20to%20schedule%20a%20demo"
            target="_blank"
            rel="noreferrer"
            className="w-full sm:w-auto"
          >
            <Button
              variant="outline"
              size="xl"
              className="w-full sm:w-auto border-slate-700 bg-slate-900/80 text-slate-200 hover:bg-slate-800 hover:text-white"
            >
              <PhoneCall className="h-4 w-4 text-emerald-400" />
              <span>Chat on WhatsApp</span>
            </Button>
          </a>
        </div>

        <div className="pt-4 flex items-center justify-center gap-6 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-indigo-400" />
            <span>14-day free trial</span>
          </span>
          <span>•</span>
          <span>No credit card required</span>
          <span>•</span>
          <span>Instant setup</span>
        </div>
      </div>
    </section>
  );
}
