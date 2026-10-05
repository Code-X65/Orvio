import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  Boxes,
  ReceiptText,
  MessageSquare,
  Building2,
  ClockAlert,
  CreditCard,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  Sparkles,
  WifiOff,
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

export function InventoryProductPage() {
  const app = APPS_DATA.find((a) => a.id === 'inventory')!;

  const inventoryFaqs = [
    {
      category: 'Apps' as const,
      question: 'Can I connect a physical barcode scanner and thermal receipt printer?',
      answer:
        'Yes. Orvio Inventory & POS supports standard USB and Bluetooth barcode scanners and ESC/POS 58mm & 80mm thermal receipt printers out-of-the-box without complicated driver installations.',
    },
    {
      category: 'Apps' as const,
      question: 'How do WhatsApp receipts work for shoppers?',
      answer:
        'During checkout, the cashier asks the customer for their phone number (or selects an existing profile). Upon hitting "Complete Sale", Orvio immediately sends a clean, PDF e-receipt with your company logo and itemized breakdown via WhatsApp.',
    },
    {
      category: 'Apps' as const,
      question: 'How does multi-branch inventory transfer work?',
      answer:
        'You can create stock transfer requests between branches (e.g., Ikeja to Lekki). The receiving branch verifies physical quantities upon arrival before the central system reconciles total counts.',
    },
    {
      category: 'Apps' as const,
      question: 'What happens if my retail shop loses internet connection?',
      answer:
        'The POS cashier interface operates in offline cache mode. Sales continue processing smoothly. Once your router or mobile hotspot reconnects, all pending transactions sync automatically to the cloud.',
    },
  ];

  return (
    <>
      <SeoHead
        title="Orvio Inventory & POS — Smart Retail Stock Control & WhatsApp Receipts"
        description="Eliminate inventory leakage, speed up cashier checkout, track batch expiries, and send automatic WhatsApp receipts with Orvio Inventory & POS for Nigerian retail."
        keywords={[
          'Inventory software Nigeria',
          'POS cashier Lagos',
          'Retail barcode software',
          'Pharmacy expiry tracking Nigeria',
          'Supermarket POS Nigeria',
        ]}
      />

      <div className="space-y-20 py-12">
        {/* Product Hero */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="flex items-center gap-2">
                <Badge variant="emerald" className="text-xs px-3 py-1">
                  <Boxes className="h-3.5 w-3.5 mr-1" />
                  Flagship Retail Product
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  ₦10,000 / month
                </Badge>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.15]">
                Smart Stock Control & <span className="gradient-text-emerald">High-Speed POS</span> for Nigerian Retail
              </h1>

              <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl">
                Eliminate unrecorded stock loss, track product batch expiries, and delight customers with automated branded WhatsApp receipts from one easy-to-use platform.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 pt-2">
                <a href={getSignupUrl('inventory')} className="w-full sm:w-auto">
                  <Button variant="emerald" size="xl" className="w-full sm:w-auto font-bold">
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
                  Works offline & online
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Barcode scanner ready
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Paystack integrated
                </span>
              </div>
            </div>

            {/* Right Summary Highlight Card */}
            <div className="lg:col-span-5 rounded-3xl bg-slate-950 p-6 sm:p-8 text-white border border-slate-800 space-y-6 shadow-2xl">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Proven Store Impact
                </span>
                <span className="text-xs text-emerald-400 font-semibold">350+ Stores in Nigeria</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                  <div className="text-3xl font-black text-emerald-400">88%</div>
                  <div className="text-xs text-slate-400 mt-1">Shrinkage Reduction</div>
                </div>
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                  <div className="text-3xl font-black text-indigo-400">&lt; 20s</div>
                  <div className="text-xs text-slate-400 mt-1">Average Checkout Time</div>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Ideal For:
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-900">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    <span>Supermarkets</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-900">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    <span>Pharmacies</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-900">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    <span>Boutiques</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-900">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    <span>Wholesalers</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Core Features Deep Dive */}
        <section className="bg-slate-100/70 py-20 border-y border-slate-200/60">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-14">
              <Badge variant="emerald" className="mb-3">
                Full-Featured Capability
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                Everything You Need to Run an Efficient Store
              </h2>
              <p className="mt-3 text-base text-slate-600">
                From stock receiving at your warehouse dock to the final Paystack receipt at the cash desk.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {app.features.map((f) => (
                <Card key={f.title} className="bg-white border-slate-200/90 card-glow">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                        <Boxes className="h-5 w-5" />
                      </div>
                      {f.tag && (
                        <Badge variant="emerald" className="text-[10px]">
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

        {/* Use Cases Section */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <Badge variant="secondary" className="mb-3">
              Industry Tailoring
            </Badge>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              Designed for High-Volume Nigerian Merchants
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {app.useCases.map((uc) => (
              <div
                key={uc.title}
                className="p-6 rounded-2xl border border-slate-200/90 bg-white space-y-3 card-glow"
              >
                <h4 className="text-base font-bold text-slate-900">{uc.title}</h4>
                <p className="text-xs text-slate-600 leading-relaxed">{uc.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Product FAQs */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <Badge variant="secondary" className="mb-3">
              Inventory & POS Clarifications
            </Badge>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              Frequently Asked Questions
            </h2>
          </div>

          <FAQAccordion items={inventoryFaqs} />
        </section>

        <CTASection
          title="Eliminate Stock Loss & Transform Your Retail Store"
          subtitle="Start your 14-day free trial of Orvio Inventory & POS. No debit card required."
        />
      </div>
    </>
  );
}
