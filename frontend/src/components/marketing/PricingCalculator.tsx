import * as React from 'react';
import { Link } from 'react-router-dom';
import { Check, Sparkles, Plus, ShieldCheck, Zap } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { PRICING_PLANS, PRICING_ADDONS } from '../../domains/marketing/data/pricing';
import { formatNaira } from '../../lib/utils';
import { getSignupUrl } from '../../app/config/authUrls';

export function PricingCalculator() {
  const [isAnnual, setIsAnnual] = React.useState(true);
  const [selectedAddons, setSelectedAddons] = React.useState<string[]>([]);

  const toggleAddon = (id: string) => {
    setSelectedAddons((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const addonsTotal = selectedAddons.reduce((sum, id) => {
    const addon = PRICING_ADDONS.find((a) => a.id === id);
    if (!addon) return sum;
    return sum + (isAnnual ? addon.annualPrice : addon.monthlyPrice);
  }, 0);

  return (
    <div className="space-y-12">
      {/* Billing Cycle Switcher */}
      <div className="flex flex-col items-center justify-center space-y-4">
        <div className="inline-flex items-center rounded-2xl bg-slate-200/70 p-1.5 border border-slate-300/60 shadow-inner">
          <button
            type="button"
            onClick={() => setIsAnnual(false)}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              !isAnnual
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Monthly Billing
          </button>
          <button
            type="button"
            onClick={() => setIsAnnual(true)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              isAnnual
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Annual Billing</span>
            <span className="bg-emerald-400 text-slate-950 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full">
              2 Months Free
            </span>
          </button>
        </div>
        <p className="text-xs text-slate-500 font-medium">
          All plans include a full 14-day risk-free trial. No debit card required to test.
        </p>
      </div>

      {/* Plan Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
        {PRICING_PLANS.map((plan) => {
          const price = isAnnual ? plan.annualPrice : plan.monthlyPrice;
          const displayPeriod = isAnnual ? '/year' : '/month';

          return (
            <Card
              key={plan.id}
              className={`relative flex flex-col justify-between transition-all duration-300 ${
                plan.popular
                  ? 'border-2 border-indigo-600 shadow-xl shadow-indigo-600/10 scale-105 z-10 bg-gradient-to-b from-white to-indigo-50/20'
                  : 'hover:border-slate-300 hover:shadow-lg'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <Badge variant="primary" className="py-1 px-3 text-xs uppercase font-extrabold tracking-wider">
                    <Sparkles className="h-3.5 w-3.5 mr-1" />
                    {plan.badge}
                  </Badge>
                </div>
              )}

              <div>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-2xl font-black text-slate-900">
                      {plan.name}
                    </CardTitle>
                    {!plan.popular && plan.badge && (
                      <Badge variant="secondary" className="text-[11px]">
                        {plan.badge}
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-xs mt-1 min-h-[36px]">
                    {plan.tagline}
                  </CardDescription>

                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                        {formatNaira(price)}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">
                        {displayPeriod}
                      </span>
                    </div>
                    {isAnnual && (
                      <span className="text-[11px] text-emerald-600 font-bold block mt-0.5">
                        Equivalent to {formatNaira(Math.round(price / 12))}/mo
                      </span>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 pt-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Included Capabilities
                  </div>
                  <ul className="space-y-2.5">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5 text-xs text-slate-700">
                        <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mt-0.5">
                          <Check className="h-3 w-3 stroke-[3]" />
                        </div>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </div>

              <CardFooter className="pt-4 border-t border-slate-100">
                <a href={getSignupUrl(plan.id)} className="w-full">
                  <Button
                    variant={plan.popular ? 'primary' : 'outline'}
                    size="lg"
                    className="w-full font-bold shadow-sm"
                  >
                    {plan.ctaText}
                  </Button>
                </a>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Interactive Custom Add-Ons & Total Simulator */}
      <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Plus className="h-5 w-5 text-indigo-600" />
              Customize with Modular Add-Ons
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Select optional hardware bridges and branch expansions for your organization.
            </p>
          </div>
          {selectedAddons.length > 0 && (
            <div className="bg-indigo-50 border border-indigo-200/80 px-4 py-2 rounded-xl text-xs">
              <span className="text-slate-600">Selected Add-Ons: </span>
              <span className="font-bold text-indigo-700">
                +{formatNaira(addonsTotal)} {isAnnual ? '/yr' : '/mo'}
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6">
          {PRICING_ADDONS.map((addon) => {
            const isSelected = selectedAddons.includes(addon.id);
            const price = isAnnual ? addon.annualPrice : addon.monthlyPrice;

            return (
              <div
                key={addon.id}
                onClick={() => toggleAddon(addon.id)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer select-none flex flex-col justify-between ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-50/50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/40'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900">{addon.name}</span>
                    <div
                      className={`h-5 w-5 rounded-md border flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                    {addon.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-baseline justify-between text-xs">
                  <span className="font-bold text-slate-900">
                    {formatNaira(price)}
                  </span>
                  <span className="text-slate-500 text-[11px]">
                    {addon.unit} ({isAnnual ? 'annual' : 'monthly'})
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
