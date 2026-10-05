import * as React from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { getSignupUrl } from '../../app/config/authUrls';

export function MarketingLayout() {
  const { pathname } = useLocation();

  // Scroll to top whenever route changes
  React.useEffect(() => {
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      try {
        window.scrollTo({ top: 0, left: 0 });
      } catch {
        // Safe fallback in test environments
      }
    }
  }, [pathname]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-indigo-500 selection:text-white antialiased">
      {/* Top Notification Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white text-xs py-2 px-4 text-center font-medium border-b border-indigo-700/50">
        <span className="inline-flex items-center gap-2">
          <span className="bg-indigo-500/30 text-indigo-200 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border border-indigo-400/30">
            Launch Special
          </span>
          Get 2 Months Free on all annual plans + Free Onboarding Support for your team!
          <a
            href={getSignupUrl()}
            className="underline underline-offset-2 font-bold hover:text-indigo-200 transition-colors ml-1 hidden sm:inline"
          >
            Claim Offer →
          </a>
        </span>
      </div>

      <Navbar />

      <main className="flex-1">
        <Outlet />
      </main>

      <Footer />

      {/* Global Toast notifications */}
      <Toaster position="top-right" richColors closeButton />
    </div>
  );
}
