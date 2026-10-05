import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  Dumbbell,
  CreditCard,
  QrCode,
  CalendarCheck,
  BellRing,
  Users,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Smartphone,
  Flame,
} from 'lucide-react';
import { SeoHead } from '../../components/seo/SeoHead';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card';
import { FAQAccordion } from '../../components/marketing/FAQAccordion';
import { CTASection } from '../../components/marketing/CTASection';
import { APPS_DATA } from '../../domains/marketing/data/apps';
import { formatNaira } from '../../lib/utils';
import { getSignupUrl } from '../../app/config/authUrls';

export function GymProductPage() {
  const app = APPS_DATA.find((a) => a.id === 'gym')!;

  const gymFaqs = [
    {
      category: 'Apps' as const,
      question: 'How do automated Paystack renewals work for monthly gym members?',
      answer:
        'When a member registers and pays their initial membership fee via Paystack, their card token is securely saved. On their next billing cycle, Orvio automatically attempts the renewal charge and sends an updated QR pass upon successful payment.',
    },
    {
      category: 'Apps' as const,
      question: 'Do members need to download a heavy mobile app for QR check-in?',
      answer:
        'No heavy app is required. Members receive a lightweight mobile web pass that can be saved directly to Apple Wallet, Google Wallet, or their phone home screen for instant 1-second front-desk scanning.',
    },
    {
      category: 'Apps' as const,
      question: 'Can we calculate trainer session commissions automatically?',
      answer:
        'Yes. You can assign commission rules per personal trainer (e.g. 60/40 split or fixed ₦5,000 per private session). Orvio tallies completed sessions and computes monthly trainer payouts automatically.',
    },
    {
      category: 'Apps' as const,
      question: 'Can we manage multiple gym locations or branches?',
      answer:
        'Yes. You can manage access across all your facilities and even offer "All-Access" passes that allow members to train in Lekki, Ikeja, or Abuja.',
    },
  ];

  return (
    <>
      <SeoHead
        title="Orvio Gym Management — Member Subscriptions, QR Access & WhatsApp Reminders"
        description="Automate gym membership renewals, class scheduling, trainer payouts, and turnstile QR check-in for Nigerian fitness hubs and studios."
        keywords={[
          'Gym software Nigeria',
          'Fitness studio booking Lagos',
          'Paystack gym subscription',
          'QR turnstile software Nigeria',
          'CrossFit management Nigeria',
        ]}
      />

      <div className="space-y-20 py-12">
        {/* Gym Hero */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="flex items-center gap-2">
                <Badge variant="primary" className="text-xs px-3 py-1">
                  <Dumbbell className="h-3.5 w-3.5 mr-1" />
                  Fitness & Studio Hub
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  ₦8,000 / month
                </Badge>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.15]">
                Automate Gym Memberships & <span className="gradient-text">Boost Renewals by 35%</span>
              </h1>

              <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl">
                Stop chasing members for manual bank transfer screenshots. Automate Paystack recurring dues, manage class bookings, and validate entry with 1-second QR passes.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 pt-2">
                <a href={getSignupUrl('gym')} className="w-full sm:w-auto">
                  <Button variant="primary" size="xl" className="w-full sm:w-auto font-bold shadow-indigo-600/30">
                    <Sparkles className="h-5 w-5" />
                    <span>Start 14-Day Free Trial</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </a>
                <Link to="/pricing" className="w-full sm:w-auto">
                  <Button variant="outline" size="xl" className="w-full sm:w-auto">
                    View Pricing & Plans
                  </Button>
                </Link>
              </div>

              <div className="pt-4 flex flex-wrap gap-6 text-xs text-slate-500 font-medium">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Paystack recurring billing
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  WhatsApp reminder sequence
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Turnstile QR validation
                </span>
              </div>
            </div>

            {/* Right Summary Highlight Card */}
            <div className="lg:col-span-5 rounded-3xl bg-slate-950 p-6 sm:p-8 text-white border border-slate-800 space-y-6 shadow-2xl">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Fitness Studio Results
                </span>
                <span className="text-xs text-indigo-400 font-semibold">180+ Active Gyms</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                  <div className="text-3xl font-black text-indigo-400">+34%</div>
                  <div className="text-xs text-slate-400 mt-1">Retention Boost</div>
                </div>
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                  <div className="text-3xl font-black text-emerald-400">&lt; 2s</div>
                  <div className="text-xs text-slate-400 mt-1">QR Turnstile Gate Speed</div>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Tailored For:
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-900">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                    <span>Commercial Gyms</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-900">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                    <span>Yoga & Pilates</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-900">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                    <span>CrossFit Boxes</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-900">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                    <span>Estate Health Clubs</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="bg-slate-100/70 py-20 border-y border-slate-200/60">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-14">
              <Badge variant="primary" className="mb-3">
                End-to-End Fitness Tools
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                Everything Your Front Desk & Trainers Need
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {app.features.map((f) => (
                <Card key={f.title} className="bg-white border-slate-200/90 card-glow">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                        <Dumbbell className="h-5 w-5" />
                      </div>
                      {f.tag && (
                        <Badge variant="primary" className="text-[10px]">
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
          </div>
        </section>

        {/* Gym FAQs */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <Badge variant="secondary" className="mb-3">
              Gym Management Clarifications
            </Badge>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              Frequently Asked Questions
            </h2>
          </div>

          <FAQAccordion items={gymFaqs} />
        </section>

        <CTASection
          title="Elevate Your Gym Experience Today"
          subtitle="Start your 14-day free trial of Orvio Gym Management. Setup in under 5 minutes."
        />
      </div>
    </>
  );
}
