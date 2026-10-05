import * as React from 'react';
import { Link } from 'react-router-dom';
import { Home, ArrowRight, HelpCircle, Layers, Boxes, Dumbbell } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { SeoHead } from '../../components/seo/SeoHead';

export function NotFoundPage() {
  return (
    <>
      <SeoHead
        title="404 — Page Not Found | Orvio Hub"
        description="The page you are looking for does not exist on Orvio Hub. Explore our business apps or return home."
      />

      <div className="py-24 mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center space-y-8">
        <Badge variant="destructive" className="text-xs px-3 py-1">
          Error 404
        </Badge>

        <h1 className="text-5xl sm:text-7xl font-black text-slate-900 tracking-tight">
          Page Not Found
        </h1>

        <p className="text-base sm:text-lg text-slate-600 max-w-lg mx-auto">
          We couldn't find the page you were looking for. It may have been moved, renamed, or is temporarily unavailable.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link to="/">
            <Button variant="primary" size="lg" className="gap-2">
              <Home className="h-4 w-4" />
              <span>Return to Homepage</span>
            </Button>
          </Link>
          <Link to="/contact">
            <Button variant="outline" size="lg" className="gap-2">
              <HelpCircle className="h-4 w-4" />
              <span>Contact Support</span>
            </Button>
          </Link>
        </div>

        {/* Quick Links */}
        <div className="pt-12 border-t border-slate-200 mt-12 max-w-md mx-auto">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-4">
            Popular Destinations:
          </span>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <Link
              to="/products/inventory"
              className="p-3 rounded-xl bg-white border border-slate-200 hover:border-indigo-400 flex items-center justify-between group"
            >
              <span className="font-semibold text-slate-800">Inventory & POS</span>
              <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
            </Link>
            <Link
              to="/products/gym"
              className="p-3 rounded-xl bg-white border border-slate-200 hover:border-emerald-400 flex items-center justify-between group"
            >
              <span className="font-semibold text-slate-800">Gym Hub</span>
              <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-emerald-600 transition-colors" />
            </Link>
            <Link
              to="/pricing"
              className="p-3 rounded-xl bg-white border border-slate-200 hover:border-indigo-400 flex items-center justify-between group"
            >
              <span className="font-semibold text-slate-800">Pricing & Plans</span>
              <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
            </Link>
            <Link
              to="/blog"
              className="p-3 rounded-xl bg-white border border-slate-200 hover:border-indigo-400 flex items-center justify-between group"
            >
              <span className="font-semibold text-slate-800">SME Blog</span>
              <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
