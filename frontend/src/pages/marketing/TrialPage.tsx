import * as React from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { SeoHead } from '../../components/seo/SeoHead';
import { DarkMarketingNavbar } from '../../components/marketing/DarkMarketingNavbar';

interface AppDefinition {
  id: string;
  name: string;
  color: string;
  iconBg: string;
  iconColor: string;
  icon: React.ReactNode;
}

interface AppSection {
  id: string;
  title: string;
  apps: AppDefinition[];
}

const APP_SECTIONS: AppSection[] = [
  {
    id: 'website',
    title: 'Website',
    apps: [
      {
        id: 'website',
        name: 'Website',
        color: 'cyan',
        iconBg: 'bg-cyan-500/10',
        iconColor: 'text-cyan-400',
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24">
            <path d="M12 2a10 10 0 100 20 10 10 0 000-20z" stroke="currentColor" strokeWidth="2" />
            <path d="M2.5 9h19M2.5 15h19" stroke="currentColor" strokeWidth="1.8" />
            <ellipse cx="12" cy="12" rx="4" ry="10" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        ),
      },
      {
        id: 'ecommerce',
        name: 'eCommerce',
        color: 'fuchsia',
        iconBg: 'bg-fuchsia-500/15',
        iconColor: 'text-fuchsia-400',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
            <line x1="3" x2="21" y1="6" y2="6" />
            <path d="M16 10a4 4 0 01-8 0" />
          </svg>
        ),
      },
      {
        id: 'blog',
        name: 'Blog',
        color: 'sky',
        iconBg: 'bg-sky-500/10',
        iconColor: 'text-sky-400',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M12 19l7-7 3 3-7 7-3-3z" />
            <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
            <path d="M2 2l7.586 7.586" />
            <circle cx="11" cy="11" r="2" />
          </svg>
        ),
      },
      {
        id: 'forum',
        name: 'Forum',
        color: 'rose',
        iconBg: 'bg-rose-500/10',
        iconColor: 'text-rose-400',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
          </svg>
        ),
      },
      {
        id: 'elearning',
        name: 'eLearning',
        color: 'teal',
        iconBg: 'bg-teal-500/10',
        iconColor: 'text-teal-400',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
            <path d="M6 12v5c3 3 9 3 12 0v-5" />
          </svg>
        ),
      },
      {
        id: 'events',
        name: 'Events',
        color: 'emerald',
        iconBg: 'bg-emerald-500/10',
        iconColor: 'text-emerald-400',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <rect height="18" rx="2" ry="2" width="18" x="3" y="4" />
            <line x1="16" x2="16" y1="2" y2="6" />
            <line x1="8" x2="8" y1="2" y2="6" />
            <line x1="3" x2="21" y1="10" y2="10" />
            <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
          </svg>
        ),
      },
    ],
  },
  {
    id: 'sales',
    title: 'Sales',
    apps: [
      {
        id: 'crm',
        name: 'CRM',
        color: 'teal',
        iconBg: 'bg-teal-500/10',
        iconColor: 'text-teal-400',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87" />
            <path d="M16 3.13a4 4 0 010 7.75" />
          </svg>
        ),
      },
      {
        id: 'pos',
        name: 'Point of Sale',
        color: 'amber',
        iconBg: 'bg-amber-500/15',
        iconColor: 'text-amber-400',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M6 16h12" />
          </svg>
        ),
      },
      {
        id: 'sales',
        name: 'Sales',
        color: 'indigo',
        iconBg: 'bg-indigo-500/10',
        iconColor: 'text-indigo-400',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
          </svg>
        ),
      },
      {
        id: 'subscriptions',
        name: 'Subscriptions',
        color: 'purple',
        iconBg: 'bg-purple-500/10',
        iconColor: 'text-purple-400',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        ),
      },
      {
        id: 'invoicing',
        name: 'Invoicing',
        color: 'sky',
        iconBg: 'bg-sky-500/10',
        iconColor: 'text-sky-400',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        ),
      },
      {
        id: 'rental',
        name: 'Rental',
        color: 'emerald',
        iconBg: 'bg-emerald-500/10',
        iconColor: 'text-emerald-400',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <rect x="1" y="3" width="15" height="13" />
            <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
            <circle cx="5.5" cy="18.5" r="2.5" />
            <circle cx="18.5" cy="18.5" r="2.5" />
          </svg>
        ),
      },
    ],
  },
  {
    id: 'operations',
    title: 'Operations',
    apps: [
      {
        id: 'accounting',
        name: 'Accounting',
        color: 'rose',
        iconBg: 'bg-rose-500/10',
        iconColor: 'text-rose-400',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <rect x="2" y="3" width="20" height="18" rx="2" />
            <line x1="8" y1="7" x2="16" y2="7" />
            <line x1="8" y1="11" x2="16" y2="11" />
            <line x1="8" y1="15" x2="12" y2="15" />
          </svg>
        ),
      },
      {
        id: 'gym',
        name: 'Gym Management',
        color: 'fuchsia',
        iconBg: 'bg-fuchsia-500/10',
        iconColor: 'text-fuchsia-400',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M6 5v14M18 5v14M3 9v6M21 9v6M3 12h18" strokeLinecap="round" />
          </svg>
        ),
      },
      {
        id: 'project',
        name: 'Project',
        color: 'sky',
        iconBg: 'bg-sky-500/10',
        iconColor: 'text-sky-400',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
          </svg>
        ),
      },
      {
        id: 'timesheets',
        name: 'Timesheets',
        color: 'violet',
        iconBg: 'bg-violet-500/10',
        iconColor: 'text-violet-400',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        ),
      },
      {
        id: 'fieldservice',
        name: 'Field Service',
        color: 'amber',
        iconBg: 'bg-amber-500/10',
        iconColor: 'text-amber-400',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
          </svg>
        ),
      },
      {
        id: 'helpdesk',
        name: 'Helpdesk',
        color: 'teal',
        iconBg: 'bg-teal-500/10',
        iconColor: 'text-teal-400',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        ),
      },
      {
        id: 'planning',
        name: 'Planning',
        color: 'emerald',
        iconBg: 'bg-emerald-500/10',
        iconColor: 'text-emerald-400',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        ),
      },
    ],
  },
  {
    id: 'supply-chain',
    title: 'Manufacturing & Supply Chain',
    apps: [
      {
        id: 'inventory',
        name: 'Inventory',
        color: 'amber',
        iconBg: 'bg-amber-500/15',
        iconColor: 'text-amber-400',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
        ),
      },
      {
        id: 'manufacturing',
        name: 'Manufacturing',
        color: 'rose',
        iconBg: 'bg-rose-500/10',
        iconColor: 'text-rose-400',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M2 20h20M5 20V8l5 4V4l5 4v12" />
          </svg>
        ),
      },
      {
        id: 'purchase',
        name: 'Purchase',
        color: 'teal',
        iconBg: 'bg-teal-500/10',
        iconColor: 'text-teal-400',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="9" cy="21" r="1" />
            <circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
          </svg>
        ),
      },
      {
        id: 'maintenance',
        name: 'Maintenance',
        color: 'sky',
        iconBg: 'bg-sky-500/10',
        iconColor: 'text-sky-400',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
          </svg>
        ),
      },
      {
        id: 'quality',
        name: 'Quality',
        color: 'emerald',
        iconBg: 'bg-emerald-500/10',
        iconColor: 'text-emerald-400',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
        ),
      },
    ],
  },
  {
    id: 'hr',
    title: 'Human Resources',
    apps: [
      {
        id: 'employees',
        name: 'Employees',
        color: 'purple',
        iconBg: 'bg-purple-500/10',
        iconColor: 'text-purple-400',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        ),
      },
      {
        id: 'recruitment',
        name: 'Recruitment',
        color: 'blue',
        iconBg: 'bg-blue-500/10',
        iconColor: 'text-blue-400',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        ),
      },
      {
        id: 'time-off',
        name: 'Time Off',
        color: 'emerald',
        iconBg: 'bg-emerald-500/10',
        iconColor: 'text-emerald-400',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 14 14" />
          </svg>
        ),
      },
      {
        id: 'appraisals',
        name: 'Appraisals',
        color: 'amber',
        iconBg: 'bg-amber-500/10',
        iconColor: 'text-amber-400',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        ),
      },
    ],
  },
];

export function TrialPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Selected apps state: defaults to POS and Inventory (2 apps selected)
  const [selectedApps, setSelectedApps] = React.useState<Map<string, AppDefinition>>(() => {
    const initialMap = new Map<string, AppDefinition>();
    
    // Look for initial apps in all sections
    const allApps = APP_SECTIONS.flatMap((s) => s.apps);
    const posApp = allApps.find((a) => a.id === 'pos');
    const invApp = allApps.find((a) => a.id === 'inventory');
    
    if (posApp) initialMap.set('pos', posApp);
    if (invApp) initialMap.set('inventory', invApp);

    // Also check query param ?app=
    const queryApp = searchParams.get('app');
    if (queryApp) {
      const match = allApps.find((a) => a.id === queryApp);
      if (match) initialMap.set(match.id, match);
    }

    return initialMap;
  });

  const toggleApp = (app: AppDefinition) => {
    setSelectedApps((prev) => {
      const next = new Map(prev);
      if (next.has(app.id)) {
        next.delete(app.id);
      } else {
        next.set(app.id, app);
      }
      return next;
    });
  };

  const removeApp = (appId: string) => {
    setSelectedApps((prev) => {
      const next = new Map(prev);
      next.delete(appId);
      return next;
    });
  };

  const handleContinue = () => {
    const appIds = Array.from(selectedApps.keys());
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('orvio_selected_apps', JSON.stringify(appIds));
    }
    navigate(`/signup?apps=${encodeURIComponent(appIds.join(','))}`);
  };

  const selectedCount = selectedApps.size;

  return (
    <div
      className="min-h-screen text-slate-100 flex flex-col selection:bg-[#714b67] selection:text-white antialiased font-sans"
      style={{
        backgroundColor: '#0d0b11',
        backgroundImage: `
          radial-gradient(at 0% 0%, rgba(113, 75, 103, 0.22) 0px, transparent 45%),
          radial-gradient(at 100% 0%, rgba(251, 185, 69, 0.09) 0px, transparent 40%),
          radial-gradient(at 50% 100%, rgba(113, 75, 103, 0.12) 0px, transparent 50%)
        `,
        backgroundAttachment: 'fixed',
      }}
    >
      <SeoHead
        title="Choose your Apps — Orvio"
        description="Select the apps your business needs today. Connect more as you grow, with unified login and consolidated billing."
      />

      {/* Unified Dark Marketing Navbar */}
      <DarkMarketingNavbar />

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-9 md:py-12">
        {/* Title */}
        <div className="text-center mb-10 sm:mb-14">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white inline-flex flex-wrap justify-center items-center gap-2">
            <span>Choose your</span>
            <span className="relative inline-block text-white font-extrabold">
              Apps
              <svg className="absolute -bottom-2 left-0 w-full overflow-visible" fill="none" height="10" preserveAspectRatio="none" viewBox="0 0 100 12">
                <path d="M2 9C28 2 75 2 98 8" stroke="#fbb945" strokeLinecap="round" strokeWidth="4.5" />
              </svg>
            </span>
          </h1>
          <p className="mt-4 text-sm sm:text-base text-slate-400 font-normal">
            Free instant access. No credit card required.
          </p>
        </div>

        {/* 2-Column Layout: Catalog Grid + Sticky Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Catalog Area (Left 8 Cols) */}
          <div className="lg:col-span-8 space-y-9">
            {APP_SECTIONS.map((section) => (
              <section key={section.id} className="space-y-3.5">
                <div className="flex items-baseline space-x-2.5">
                  <h2 className="font-handwriting text-3xl sm:text-4xl text-slate-100 font-bold tracking-wide italic">
                    {section.title}
                  </h2>
                  <span className="text-xs text-slate-500 font-semibold tracking-wide">
                    {section.apps.length} apps
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {section.apps.map((app) => {
                    const isSelected = selectedApps.has(app.id);
                    return (
                      <button
                        key={app.id}
                        type="button"
                        onClick={() => toggleApp(app)}
                        className={`group text-left px-4 py-3 rounded-xl border app-pill-transition relative flex items-center justify-between cursor-pointer focus:outline-none ${
                          isSelected
                            ? 'bg-[#231a2c] border-[#714b67] shadow-card-active'
                            : 'bg-[#16121f] border-[#262033] hover:border-[#39304a] hover:bg-[#1e182b]'
                        }`}
                      >
                        <div className="flex items-center space-x-3.5 min-w-0">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${app.iconBg} ${app.iconColor}`}>
                            {app.icon}
                          </div>
                          <span
                            className={`text-sm font-semibold truncate ${
                              isSelected ? 'text-white' : 'text-slate-200 group-hover:text-white'
                            }`}
                          >
                            {app.name}
                          </span>
                        </div>

                        {isSelected ? (
                          <span className="pill-check w-5 h-5 rounded-full bg-[#714b67] text-white flex items-center justify-center text-xs shadow-md border border-purple-400/40 shrink-0 ml-2">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </span>
                        ) : (
                          <span className="pill-check w-5 h-5 rounded-full border border-slate-700 bg-slate-800/40 opacity-0 group-hover:opacity-60 flex items-center justify-center transition-all shrink-0 ml-2" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          {/* Sticky Summary Drawer (Right 4 Cols) */}
          <div className="lg:col-span-4 sticky top-24">
            <div className="rounded-2xl border border-[#262033] bg-[#16121f] p-5 shadow-2xl backdrop-blur-md">
              <div className="flex items-center justify-between pb-3.5 border-b border-[#262033]">
                <h3 className="text-base font-bold text-white">Your Selection</h3>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#714b67]/20 text-purple-300 border border-[#714b67]/40">
                  {selectedCount} {selectedCount === 1 ? 'App selected' : 'Apps selected'}
                </span>
              </div>

              {/* Scrollable list */}
              <div className="py-3.5 space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                {selectedCount === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400 border border-dashed border-[#262033] rounded-xl">
                    Select an app from the left to get started
                  </div>
                ) : (
                  Array.from(selectedApps.values()).map((app) => (
                    <div
                      key={app.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-[#1e182b] border border-[#39304a]/70 group transition-all"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className={`w-7 h-7 rounded-lg ${app.iconBg} ${app.iconColor} flex items-center justify-center shrink-0`}>
                          {app.icon}
                        </div>
                        <span className="text-sm font-semibold text-slate-100 truncate">{app.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeApp(app.id)}
                        className="text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 p-1 rounded-md transition-colors shrink-0 ml-2"
                        title="Remove app"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Green Banner */}
              <div className="my-2.5 p-3 rounded-xl bg-[#142d20] border border-[#216345] text-center">
                <p className="text-xs font-semibold text-[#6ee7b7] leading-relaxed">
                  Free, with unlimited users,
                  <br className="hidden sm:inline" /> forever.
                </p>
              </div>

              {/* CTA Button */}
              <div className="mt-3">
                <button
                  type="button"
                  disabled={selectedCount === 0}
                  onClick={handleContinue}
                  className={`w-full py-3 px-4 rounded-xl font-bold text-sm text-white bg-[#714b67] hover:bg-[#87597b] active:scale-[0.98] transition-all shadow-glow-primary border border-purple-400/30 flex items-center justify-center space-x-2 group ${
                    selectedCount === 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                  }`}
                >
                  <span>Continue</span>
                  <svg className="w-4 h-4 text-purple-200 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>

              {/* Trust Note */}
              <div className="mt-3.5 pt-3 border-t border-[#262033]/60 flex items-center justify-center space-x-1.5 text-xs text-slate-400">
                <svg className="w-3.5 h-3.5 text-[#fbb945]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>No credit card required</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#262033] mt-16 py-8 bg-[#0d0b11]/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 space-y-4 sm:space-y-0">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-200">Orvio</span>
            <span>— All-in-one unified workspace &amp; business suite</span>
          </div>
          <div className="flex items-center space-x-6">
            <Link to="/privacy" className="hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-white transition-colors">
              Terms of Service
            </Link>
            <Link to="/contact" className="hover:text-white transition-colors">
              System Status
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
