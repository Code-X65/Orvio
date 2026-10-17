import * as React from 'react';
import { Link } from 'react-router-dom';
import { SeoHead } from '../../components/seo/SeoHead';
import { DemoModal } from '../../components/marketing/DemoModal';
import { DarkMarketingNavbar } from '../../components/marketing/DarkMarketingNavbar';

interface AppTile {
  id: string;
  name: string;
  icon: React.ReactNode;
}

export function LandingPage() {
  const [isDemoOpen, setIsDemoOpen] = React.useState(false);

  const apps: AppTile[] = [
    // Row 1
    {
      id: 'accounting',
      name: 'Accounting',
      icon: (
        <svg className="app-icon-glyph w-12 h-12" fill="none" viewBox="0 0 48 48">
          <circle cx="16" cy="16" fill="#f87171" r="4.5" />
          <circle cx="32" cy="32" fill="#2dd4bf" r="4.5" />
          <path d="M34 14L14 34" stroke="#f97316" strokeLinecap="round" strokeWidth="5" />
        </svg>
      ),
    },
    {
      id: 'knowledge',
      name: 'Knowledge',
      icon: (
        <svg className="app-icon-glyph w-12 h-12" fill="none" viewBox="0 0 48 48">
          <path d="M14 10H28V36L21 31L14 36V10Z" fill="#a855f7" />
          <path d="M22 14H36V40L29 35L22 40V14Z" fill="#2dd4bf" fillOpacity="0.9" />
        </svg>
      ),
    },
    {
      id: 'sign',
      name: 'Sign',
      icon: (
        <svg className="app-icon-glyph w-12 h-12" fill="none" viewBox="0 0 48 48">
          <path
            d="M12 28C16 18 22 14 26 19C30 24 24 33 18 33C14 33 16 26 24 25C30 24 34 26 38 29"
            stroke="#38bdf8"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="4"
          />
        </svg>
      ),
    },
    {
      id: 'crm',
      name: 'CRM',
      icon: (
        <svg className="app-icon-glyph w-12 h-12" fill="none" viewBox="0 0 48 48">
          <path d="M11 20L19 14L28 22L21 28L11 20Z" fill="#2dd4bf" />
          <path d="M37 20L29 14L20 22L27 28L37 20Z" fill="#818cf8" />
          <path d="M20 25L24 29L28 25L24 21L20 25Z" fill="#f43f5e" />
        </svg>
      ),
    },
    {
      id: 'studio',
      name: 'Studio',
      icon: (
        <svg className="app-icon-glyph w-12 h-12" fill="none" viewBox="0 0 48 48">
          <path d="M14 14L34 34M14 34L34 14" stroke="#a855f7" strokeLinecap="round" strokeWidth="5" />
          <path d="M12 18L18 12M30 36L36 30" stroke="#38bdf8" strokeLinecap="round" strokeWidth="4" />
        </svg>
      ),
    },
    {
      id: 'subscriptions',
      name: 'Subscriptions',
      icon: (
        <svg className="app-icon-glyph w-12 h-12" fill="none" viewBox="0 0 48 48">
          <path d="M24 10C31.7 10 38 16.3 38 24C38 27.5 36.7 30.7 34.6 33.2" stroke="#2dd4bf" strokeLinecap="round" strokeWidth="4.5" />
          <path d="M24 38C16.3 38 10 31.7 10 24C10 20.5 11.3 17.3 13.4 14.8" stroke="#fbb945" strokeLinecap="round" strokeWidth="4.5" />
          <polyline points="37 30 35 34 31 34" stroke="#2dd4bf" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
          <polyline points="11 18 13 14 17 14" stroke="#fbb945" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
        </svg>
      ),
    },

    // Row 2
    {
      id: 'ai',
      name: 'AI',
      icon: (
        <svg className="app-icon-glyph w-12 h-12" fill="none" viewBox="0 0 48 48">
          <path d="M12 36L20 12H24L32 36H27L25 30H19L17 36H12ZM20 26H24L22 18L20 26Z" fill="#a855f7" />
          <rect fill="#f87171" height="24" rx="2.5" width="5" x="34" y="12" />
        </svg>
      ),
    },
    {
      id: 'pos',
      name: 'Point of Sale',
      icon: (
        <svg className="app-icon-glyph w-12 h-12" fill="none" viewBox="0 0 48 48">
          <path d="M10 20H38L35 30C34.5 32 33 33 31 33H17C15 33 13.5 32 13 30L10 20Z" fill="#fbb945" />
          <path d="M16 20V32M24 20V32M32 20V32" stroke="#a855f7" strokeWidth="3" />
          <rect fill="#a855f7" height="5" rx="2" width="24" x="12" y="15" />
        </svg>
      ),
    },
    {
      id: 'discuss',
      name: 'Discuss',
      icon: (
        <svg className="app-icon-glyph w-12 h-12" fill="none" viewBox="0 0 48 48">
          <path d="M12 24C12 17.37 17.37 12 24 12C30.63 12 36 17.37 36 24C36 30.63 30.63 36 24 36H12V24Z" fill="#f97316" />
        </svg>
      ),
    },
    {
      id: 'documents',
      name: 'Documents',
      icon: (
        <svg className="app-icon-glyph w-12 h-12" fill="none" viewBox="0 0 48 48">
          <rect fill="#38bdf8" height="22" rx="3" width="16" x="13" y="14" />
          <rect fill="#fb923c" fillOpacity="0.9" height="22" rx="3" width="16" x="19" y="11" />
        </svg>
      ),
    },
    {
      id: 'project',
      name: 'Project',
      icon: (
        <svg className="app-icon-glyph w-12 h-12" fill="none" viewBox="0 0 48 48">
          <path d="M12 24L21 33L36 17" stroke="#2dd4bf" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5.5" />
          <path d="M21 24L36 17" stroke="#3b82f6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5.5" />
        </svg>
      ),
    },
    {
      id: 'timesheets',
      name: 'Timesheets',
      icon: (
        <svg className="app-icon-glyph w-12 h-12" fill="none" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r="14" stroke="#f43f5e" strokeWidth="4.5" />
          <path d="M24 24L31 16" stroke="#38bdf8" strokeLinecap="round" strokeWidth="4.5" />
          <circle cx="24" cy="24" fill="#38bdf8" r="3" />
        </svg>
      ),
    },

    // Row 3
    {
      id: 'fieldservice',
      name: 'Field Service',
      icon: (
        <svg className="app-icon-glyph w-12 h-12" fill="none" viewBox="0 0 48 48">
          <path d="M25 10L16 25H25L23 38L32 23H23L25 10Z" fill="#f43f5e" />
          <path d="M23 15L18 25H25L23 35L29 25H24L25 15Z" fill="#fbb945" />
        </svg>
      ),
    },
    {
      id: 'planning',
      name: 'Planning',
      icon: (
        <svg className="app-icon-glyph w-12 h-12" fill="none" viewBox="0 0 48 48">
          <rect fill="#fbb945" height="16" rx="3" width="13" x="10" y="16" />
          <rect fill="#2dd4bf" height="16" rx="3" width="13" x="25" y="16" />
          <path d="M18 20L14 24L18 28" stroke="#121016" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          <path d="M30 20L34 24L30 28" stroke="#121016" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </svg>
      ),
    },
    {
      id: 'helpdesk',
      name: 'Helpdesk',
      icon: (
        <svg className="app-icon-glyph w-12 h-12" fill="none" viewBox="0 0 48 48">
          <rect fill="#2dd4bf" height="28" rx="3" width="12" x="18" y="10" />
          <rect fill="#0d9488" height="12" rx="3" width="28" x="10" y="18" />
          <rect fill="#121016" height="8" width="8" x="20" y="20" />
        </svg>
      ),
    },
    {
      id: 'ecommerce',
      name: 'eCommerce',
      icon: (
        <svg className="app-icon-glyph w-12 h-12" fill="none" viewBox="0 0 48 48">
          <path d="M12 18L15 36H33L36 18H12Z" fill="#a855f7" />
          <path d="M19 18V14C19 11.2 21.2 9 24 9C26.8 9 29 11.2 29 14V18" stroke="#f1f5f9" strokeLinecap="round" strokeWidth="3" />
        </svg>
      ),
    },
    {
      id: 'website',
      name: 'Website',
      icon: (
        <svg className="app-icon-glyph w-12 h-12" fill="none" viewBox="0 0 48 48">
          <circle cx="24" cy="24" fill="#0284c7" r="14" />
          <path d="M10 24C16 28 20 20 26 24C32 28 35 24 38 22" stroke="#2dd4bf" strokeLinecap="round" strokeWidth="3.5" />
          <path d="M12 18C18 14 24 16 36 16" stroke="#ffffff" strokeLinecap="round" strokeWidth="2" />
        </svg>
      ),
    },
    {
      id: 'email',
      name: 'Email Marketing',
      icon: (
        <svg className="app-icon-glyph w-12 h-12" fill="none" viewBox="0 0 48 48">
          <path d="M37 11L11 23L22 28L37 11Z" fill="#38bdf8" />
          <path d="M37 11L28 37L22 28L37 11Z" fill="#0284c7" />
          <path d="M22 28V35L26 31" stroke="#38bdf8" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </svg>
      ),
    },

    // Row 4
    {
      id: 'purchase',
      name: 'Purchase',
      icon: (
        <svg className="app-icon-glyph w-12 h-12" fill="none" viewBox="0 0 48 48">
          <rect fill="#2dd4bf" height="8" rx="2" width="26" x="11" y="14" />
          <rect fill="#a855f7" height="6" rx="1.5" width="26" x="11" y="24" />
          <rect fill="#f43f5e" height="4" rx="1" width="26" x="11" y="32" />
        </svg>
      ),
    },
    {
      id: 'inventory',
      name: 'Inventory',
      icon: (
        <svg className="app-icon-glyph w-12 h-12" fill="none" viewBox="0 0 48 48">
          <polygon fill="#fbb945" points="24,10 36,17 24,24 12,17" />
          <polygon fill="#f97316" points="12,17 24,24 24,38 12,31" />
          <polygon fill="#a855f7" points="24,24 36,17 36,31 24,38" />
        </svg>
      ),
    },
    {
      id: 'manufacturing',
      name: 'Manufacturing',
      icon: (
        <svg className="app-icon-glyph w-12 h-12" fill="none" viewBox="0 0 48 48">
          <rect fill="#2dd4bf" height="14" rx="2" width="9" x="10" y="24" />
          <rect fill="#fbb945" height="20" rx="2" width="9" x="20" y="18" />
          <rect fill="#f43f5e" height="26" rx="2" width="9" x="30" y="12" />
        </svg>
      ),
    },
    {
      id: 'sales',
      name: 'Sales',
      icon: (
        <svg className="app-icon-glyph w-12 h-12" fill="none" viewBox="0 0 48 48">
          <rect fill="#a855f7" height="14" rx="1.5" width="6" x="12" y="24" />
          <rect fill="#f43f5e" height="22" rx="1.5" width="6" x="21" y="16" />
          <rect fill="#fbb945" height="28" rx="1.5" width="6" x="30" y="10" />
        </svg>
      ),
    },
    {
      id: 'hr',
      name: 'HR',
      icon: (
        <svg className="app-icon-glyph w-12 h-12" fill="none" viewBox="0 0 48 48">
          <circle cx="24" cy="16" fill="#a855f7" r="4.5" />
          <path d="M16 32C16 27 20 25 24 25C28 25 32 27 32 32H16Z" fill="#a855f7" />
          <circle cx="14" cy="20" fill="#fbb945" r="3.5" />
          <path d="M8 32C8 28 11 27 14 27C15.5 27 17 27.5 18 28.5" stroke="#fbb945" strokeLinecap="round" strokeWidth="2.5" />
          <circle cx="34" cy="20" fill="#2dd4bf" r="3.5" />
          <path d="M40 32C40 28 37 27 34 27C32.5 27 31 27.5 30 28.5" stroke="#2dd4bf" strokeLinecap="round" strokeWidth="2.5" />
        </svg>
      ),
    },
    {
      id: 'dashboard',
      name: 'Dashboard',
      icon: (
        <svg className="app-icon-glyph w-12 h-12" fill="none" viewBox="0 0 48 48">
          <rect fill="#a855f7" height="10" rx="3" width="10" x="12" y="12" />
          <rect fill="#f43f5e" height="10" rx="3" width="10" x="26" y="12" />
          <rect fill="#38bdf8" height="10" rx="3" width="10" x="12" y="26" />
          <rect fill="#2dd4bf" height="10" rx="3" width="10" x="26" y="26" />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-[#121016] text-slate-100 antialiased selection:bg-[#714b67] selection:text-white relative overflow-x-hidden font-sans">
      <SeoHead
        title="Orvio - All your business on one platform | Multi-App Suite"
        description="One Platform. Multiple Apps. Total Control. Streamline your POS, inventory, accounting, CRM, and eCommerce in one unified dark business suite."
        keywords={[
          'Orvio',
          'Business platform',
          'Modular ERP',
          'POS and Inventory Nigeria',
          'Unified business software',
        ]}
      />

      {/* Ambient Background Orbs */}
      <div aria-hidden="true" className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="ambient-orb-1 absolute -top-24 left-1/4 w-[500px] h-[500px] rounded-full bg-[#714b67]/15 blur-[120px]" />
        <div className="ambient-orb-2 absolute top-1/3 -right-20 w-[450px] h-[450px] rounded-full bg-[#fbb945]/10 blur-[130px]" />
      </div>

      {/* Header */}
      <DarkMarketingNavbar />

      {/* Hero Section */}
      <section className="relative pt-12 pb-16 md:pt-16 md:pb-24 px-4 overflow-hidden z-10">
        <div className="max-w-4xl mx-auto text-center relative z-10">
          {/* Main Headline */}
          <h1
            className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-tight md:leading-snug"
            style={{ fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.035em', fontWeight: 800 }}
          >
            One Platform.{' '}
            <span className="brush-highlight inline-block ml-1 mr-1">
              Multiple Apps.
            </span>{' '}
            Total Control.
          </h1>

          {/* Subheadline with squiggly curve */}
          <p className="mt-4 sm:mt-6 text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-slate-100">
            Simple, efficient, yet{' '}
            <span className="squiggle-underline text-white">
              affordable!
              <svg fill="none" preserveAspectRatio="none" viewBox="0 0 160 12" xmlns="http://www.w3.org/2000/svg">
                <path
                  className="squiggle-path"
                  d="M3 6.5C18 1.5 32 1.5 45 6.5C58 11.5 72 11.5 85 6.5C98 1.5 112 1.5 125 6.5C138 11.5 150 11 157 6"
                  stroke="#38bdf8"
                  strokeLinecap="round"
                  strokeWidth="3"
                />
              </svg>
            </span>
          </p>

          {/* Hero Call-to-Actions */}
          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-4 relative">
            <Link
              to="/trial"
              className="shimmer-btn w-full sm:w-auto px-7 py-3 rounded-lg text-base font-semibold text-white hover:scale-105 active:scale-95 shadow-lg shadow-[#714b67]/30 transition-all duration-200"
            >
              Start now - It's <span className="font-extrabold">free</span>
            </Link>

            <button
              type="button"
              onClick={() => setIsDemoOpen(true)}
              className="group relative overflow-hidden w-full sm:w-auto px-7 py-3 rounded-lg text-base font-medium text-slate-300 hover:text-white bg-[#1f1b26] hover:bg-[#282232] border border-[#31283c] hover:border-[#fbb945]/40 hover:scale-105 active:scale-95 shadow-sm transition-all duration-200"
            >
              <span className="relative z-10">Meet an advisor</span>
              <span className="absolute inset-0 bg-gradient-to-r from-[#714b67]/20 to-[#fbb945]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </button>

            {/* Handwritten Annotation with Arrow */}
            <div className="hidden lg:flex items-center absolute -right-28 sm:-right-36 top-1 text-left select-none pointer-events-none transform translate-y-3">
              <div className="floating-callout flex items-center">
                <svg
                  className="w-16 h-16 text-[#fbb945]/80 mr-2 transform -rotate-12 drop-shadow"
                  fill="none"
                  viewBox="0 0 80 80"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M68 62C55 50 35 38 22 18M22 18L18 30M22 18L32 15"
                    stroke="#fbb945"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.6"
                  />
                </svg>
                <div className="font-handwriting leading-tight transform rotate-2">
                  <span className="block text-2xl md:text-3xl font-bold text-[#fbb945] drop-shadow">
                    US$ 7.25 / month
                  </span>
                  <span className="block text-xl md:text-2xl font-bold text-slate-300 tracking-wide">
                    for ALL apps
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* App Launcher Section */}
      <main
        id="apps"
        className="relative bg-gradient-to-b from-[#181520] via-[#14121a] to-[#121016] border-t border-[#31283c]/50 pt-16 pb-28 px-4 sm:px-6 lg:px-8 z-10"
      >
        <div aria-hidden="true" className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-64 bg-[#714b67]/10 blur-3xl pointer-events-none rounded-full" />
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-y-10 gap-x-6 justify-items-center">
            {apps.map((app) => (
              <Link
                key={app.id}
                to={`/trial?app=${app.id}`}
                className="app-card group flex flex-col items-center focus:outline-none"
              >
                <div className="app-icon-container w-20 h-20 rounded-2xl flex items-center justify-center p-3.5">
                  {app.icon}
                </div>
                <span className="app-label mt-3 text-sm font-medium text-slate-300 text-center">
                  {app.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#31283c]/80 py-10 bg-[#0d0b11]/80 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-white text-sm">orvio</span>
            <span>— All-in-one unified workspace &amp; business operating system</span>
          </div>
          <div className="flex items-center space-x-6">
            <Link to="/privacy" className="hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-white transition-colors">
              Terms of Service
            </Link>
            <Link to="/pricing" className="hover:text-white transition-colors">
              Pricing Plans
            </Link>
          </div>
        </div>
      </footer>

      {/* Interactive Demo Modal */}
      <DemoModal open={isDemoOpen} onOpenChange={setIsDemoOpen} />
    </div>
  );
}
