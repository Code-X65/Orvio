import * as React from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import type { FAQItem } from '../../domains/marketing/types';
import { cn } from '../../lib/utils';

export function FAQAccordion({ items }: { items: FAQItem[] }) {
  const [openIdx, setOpenIdx] = React.useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIdx(openIdx === idx ? null : idx);
  };

  return (
    <div className="space-y-3 max-w-4xl mx-auto">
      {items.map((item, idx) => {
        const isOpen = openIdx === idx;
        return (
          <div
            key={item.question}
            className={cn(
              'rounded-2xl border transition-all duration-200 overflow-hidden',
              isOpen
                ? 'border-indigo-200 bg-white shadow-sm'
                : 'border-slate-200/80 bg-white/70 hover:border-slate-300'
            )}
          >
            <button
              type="button"
              onClick={() => toggle(idx)}
              className="w-full flex items-center justify-between p-5 text-left font-bold text-slate-900 gap-4 cursor-pointer"
              aria-expanded={isOpen}
            >
              <div className="flex items-center gap-3 text-base">
                <HelpCircle className={cn('h-5 w-5 shrink-0 transition-colors', isOpen ? 'text-indigo-600' : 'text-slate-400')} />
                <span>{item.question}</span>
              </div>
              <ChevronDown
                className={cn(
                  'h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200',
                  isOpen && 'rotate-180 text-indigo-600'
                )}
              />
            </button>

            {isOpen && (
              <div className="px-5 pb-5 pt-0 text-sm text-slate-600 leading-relaxed border-t border-slate-100 mt-1 animate-in fade-in-50 duration-150">
                <div className="pt-3">{item.answer}</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
