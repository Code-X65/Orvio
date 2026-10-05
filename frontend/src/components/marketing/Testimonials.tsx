import * as React from 'react';
import { Star, Quote, MapPin, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { TESTIMONIALS_DATA } from '../../domains/marketing/data/testimonials';

export function Testimonials() {
  return (
    <div className="space-y-8">
      <div className="text-center max-w-2xl mx-auto">
        <Badge variant="emerald" className="mb-3">
          Proven Social Proof
        </Badge>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">
          Trusted by 500+ Nigerian Retailers, Pharmacies & Gym Owners
        </h2>
        <p className="mt-3 text-sm text-slate-600 leading-relaxed">
          See how business founders across Lagos, Abuja, and Port Harcourt run streamlined, profitable operations with Orvio Hub.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {TESTIMONIALS_DATA.map((t) => (
          <Card key={t.id} className="card-glow border-slate-200/90 flex flex-col justify-between p-6">
            <CardContent className="p-0 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex text-amber-400">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-amber-400" />
                  ))}
                </div>
                <Badge variant="secondary" className="text-[10px]">
                  {t.appName}
                </Badge>
              </div>

              <blockquote className="text-xs text-slate-700 leading-relaxed italic">
                "{t.quote}"
              </blockquote>

              {t.stat && (
                <div className="flex items-center gap-1.5 p-2 rounded-lg bg-emerald-50 border border-emerald-200/60 text-emerald-800 text-xs font-bold">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span>{t.stat}</span>
                </div>
              )}
            </CardContent>

            <div className="pt-4 mt-4 border-t border-slate-100 flex items-center gap-3">
              <img
                src={t.avatar}
                alt={t.name}
                className="h-10 w-10 rounded-full object-cover ring-2 ring-indigo-500/20"
              />
              <div>
                <h4 className="text-xs font-bold text-slate-900">{t.name}</h4>
                <p className="text-[11px] text-slate-500">{t.role} • {t.company}</p>
                <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                  <MapPin className="h-2.5 w-2.5" />
                  <span>{t.location}</span>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
