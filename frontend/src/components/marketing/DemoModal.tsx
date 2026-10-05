import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { getSignupUrl } from '../../app/config/authUrls';
import {
  Boxes,
  Dumbbell,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Play,
  CheckCircle2,
} from 'lucide-react';

interface DemoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DemoModal({ open, onOpenChange }: DemoModalProps) {
  const [step, setStep] = React.useState(0);

  const steps = [
    {
      title: '1. Multi-Tenant Subdomain Onboarding',
      icon: ShieldCheck,
      badge: 'Step 1: Setup',
      desc: 'Set up your dedicated workspace in under 60 seconds at yourbrand.orvio.com. Add your staff with tailored permissions.',
      highlights: [
        'Isolated database security per business',
        'Custom logo & WhatsApp brand identity',
        'Role-based staff logins (Cashier, Manager, Admin)',
      ],
    },
    {
      title: '2. Lightning-Fast Barcode POS & Inventory',
      icon: Boxes,
      badge: 'Step 2: Operations',
      desc: 'Scan products instantly with physical barcode scanners. Print or send WhatsApp receipts with zero manual intervention.',
      highlights: [
        'Works offline with instant cloud sync on reconnection',
        'Automatic low-stock and batch expiry alerts',
        'Direct Paystack card & bank transfer verification',
      ],
    },
    {
      title: '3. Member Management & Automated Renewals',
      icon: Dumbbell,
      badge: 'Step 3: Retention',
      desc: 'For gym and studio owners: digital QR check-in gates and automated Paystack tokenized recurring subscription billing.',
      highlights: [
        'Automated WhatsApp renewal nudges 7, 3 & 1 days before expiry',
        'Trainer commission auto-calculator',
        'Fast 1-second turnstile QR access pass',
      ],
    },
  ];

  const current = steps[step];
  const Icon = current.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden bg-slate-950 text-white border-slate-800">
        <div className="bg-gradient-to-r from-indigo-900/60 to-slate-900 p-6 border-b border-slate-800">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="glow" className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30">
              <Sparkles className="h-3 w-3 mr-1" />
              Interactive Product Walkthrough
            </Badge>
          </div>
          <DialogTitle className="text-2xl font-black text-white tracking-tight">
            How Orvio Hub Powers Nigerian Businesses
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-sm mt-1">
            Explore the core workflow that saves Nigerian retailers & fitness entrepreneurs over 15 hours weekly.
          </DialogDescription>
        </div>

        <div className="p-6 space-y-6">
          {/* Progress Indicators */}
          <div className="grid grid-cols-3 gap-2">
            {steps.map((s, idx) => (
              <button
                key={s.title}
                type="button"
                onClick={() => setStep(idx)}
                className={`text-left p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  step === idx
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className="text-[10px] text-slate-400">0{idx + 1}</div>
                <div className="truncate">{s.badge.split(':')[1]}</div>
              </button>
            ))}
          </div>

          {/* Current Step Content Box */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-white">{current.title}</h4>
                <p className="text-xs text-slate-400 mt-0.5">{current.desc}</p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800/80 space-y-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Key Capabilities:
              </span>
              {current.highlights.map((h) => (
                <div key={h} className="flex items-start gap-2.5 text-xs text-slate-300">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{h}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-900/90 px-6 py-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            Step {step + 1} of {steps.length}
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {step > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep(step - 1)}
                className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700"
              >
                Previous
              </Button>
            )}
            {step < steps.length - 1 ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setStep(step + 1)}
              >
                <span>Next Feature</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <a href={getSignupUrl()} className="w-full sm:w-auto">
                <Button variant="emerald" size="sm" className="w-full sm:w-auto">
                  <span>Start 14-Day Free Trial</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </a>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
