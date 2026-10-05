import * as React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Package,
  Dumbbell,
  ShoppingBag,
  Store,
  CreditCard,
  Receipt,
  Users,
  Calendar,
  Layers,
  Sparkles,
  Check,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  Globe,
  MessageSquare,
  Building2,
  Zap,
  TrendingUp,
  FileText,
  DollarSign,
  PieChart,
  Briefcase,
  User,
  Phone,
  Mail,
  Lock,
  RotateCcw,
  AlertCircle,
} from 'lucide-react';
import { SeoHead } from '../../components/seo/SeoHead';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { startFreeTrial, checkSubdomainAvailability, checkEmailAvailability } from '../../features/trial/api';
import { useAuthStore } from '../../stores/auth-store';
import { toast } from 'sonner';

export interface AppItem {
  id: string;
  name: string;
  category: 'Operations' | 'Sales' | 'Finance' | 'Productivity';
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  backendKey: 'inventory' | 'gym';
  description: string;
}

const APPS_LIST: AppItem[] = [
  // Operations
  {
    id: 'inventory',
    name: 'Inventory',
    category: 'Operations',
    icon: Package,
    iconBg: 'bg-amber-500/10 border-amber-500/20',
    iconColor: 'text-amber-500',
    backendKey: 'inventory',
    description: 'Stock tracking, barcode scans & multi-branch',
  },
  {
    id: 'pos',
    name: 'Point of Sale',
    category: 'Operations',
    icon: Store,
    iconBg: 'bg-rose-500/10 border-rose-500/20',
    iconColor: 'text-rose-500',
    backendKey: 'inventory',
    description: 'Fast retail checkout & thermal printer',
  },
  {
    id: 'gym',
    name: 'Gym Management',
    category: 'Operations',
    icon: Dumbbell,
    iconBg: 'bg-emerald-500/10 border-emerald-500/20',
    iconColor: 'text-emerald-500',
    backendKey: 'gym',
    description: 'Memberships, biometric gates & classes',
  },
  {
    id: 'ecommerce',
    name: 'eCommerce Store',
    category: 'Operations',
    icon: ShoppingBag,
    iconBg: 'bg-purple-500/10 border-purple-500/20',
    iconColor: 'text-purple-500',
    backendKey: 'inventory',
    description: 'Online store & WhatsApp orders',
  },

  // Sales
  {
    id: 'crm',
    name: 'CRM',
    category: 'Sales',
    icon: Users,
    iconBg: 'bg-teal-500/10 border-teal-500/20',
    iconColor: 'text-teal-500',
    backendKey: 'inventory',
    description: 'Leads, deals & customer tracking',
  },
  {
    id: 'sales',
    name: 'Sales & Quotes',
    category: 'Sales',
    icon: TrendingUp,
    iconBg: 'bg-indigo-500/10 border-indigo-500/20',
    iconColor: 'text-indigo-500',
    backendKey: 'inventory',
    description: 'Quotations, proforma & sales orders',
  },
  {
    id: 'subscriptions',
    name: 'Subscriptions',
    category: 'Sales',
    icon: CreditCard,
    iconBg: 'bg-sky-500/10 border-sky-500/20',
    iconColor: 'text-sky-500',
    backendKey: 'gym',
    description: 'Automated recurring billing & plans',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Marketing',
    category: 'Sales',
    icon: MessageSquare,
    iconBg: 'bg-emerald-500/10 border-emerald-500/20',
    iconColor: 'text-emerald-600',
    backendKey: 'inventory',
    description: 'Broadcast alerts & receipt sharing',
  },

  // Finance
  {
    id: 'invoicing',
    name: 'Invoicing',
    category: 'Finance',
    icon: Receipt,
    iconBg: 'bg-blue-500/10 border-blue-500/20',
    iconColor: 'text-blue-500',
    backendKey: 'inventory',
    description: 'Custom invoices, taxes & reminders',
  },
  {
    id: 'accounting',
    name: 'Accounting',
    category: 'Finance',
    icon: PieChart,
    iconBg: 'bg-violet-500/10 border-violet-500/20',
    iconColor: 'text-violet-500',
    backendKey: 'inventory',
    description: 'Ledgers, chart of accounts & balance sheet',
  },
  {
    id: 'expenses',
    name: 'Expenses',
    category: 'Finance',
    icon: DollarSign,
    iconBg: 'bg-cyan-500/10 border-cyan-500/20',
    iconColor: 'text-cyan-500',
    backendKey: 'inventory',
    description: 'Employee reimbursements & receipts',
  },

  // Productivity
  {
    id: 'appointments',
    name: 'Appointments',
    category: 'Productivity',
    icon: Calendar,
    iconBg: 'bg-pink-500/10 border-pink-500/20',
    iconColor: 'text-pink-500',
    backendKey: 'gym',
    description: 'Online booking calendar & reminders',
  },
  {
    id: 'employees',
    name: 'Employees & HR',
    category: 'Productivity',
    icon: Briefcase,
    iconBg: 'bg-amber-600/10 border-amber-600/20',
    iconColor: 'text-amber-600',
    backendKey: 'inventory',
    description: 'Staff directory, shifts & permissions',
  },
  {
    id: 'website',
    name: 'Website Builder',
    category: 'Productivity',
    icon: Globe,
    iconBg: 'bg-indigo-600/10 border-indigo-600/20',
    iconColor: 'text-indigo-600',
    backendKey: 'inventory',
    description: 'Custom landing pages & domain hosting',
  },
];

const CATEGORIES: ('Operations' | 'Sales' | 'Finance' | 'Productivity')[] = [
  'Operations',
  'Sales',
  'Finance',
  'Productivity',
];

export function TrialPage() {
  const navigate = useNavigate();

  // Wizard Step State (1: App Selection, 2: Organization Form)
  const [currentStep, setCurrentStep] = React.useState<'apps' | 'org_details'>('apps');

  // Selected Apps state
  const [selectedAppIds, setSelectedAppIds] = React.useState<string[]>(['inventory']);

  // Organization Form State
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [organizationName, setOrganizationName] = React.useState('');
  const [subdomain, setSubdomain] = React.useState('');
  const [isSubdomainCustom, setIsSubdomainCustom] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [country] = React.useState('Nigeria');
  const [language, setLanguage] = React.useState('English');
  const [organizationSize, setOrganizationSize] = React.useState('1 - 5 employees');
  const [primaryInterest, setPrimaryInterest] = React.useState('Use it in my organization');

  // Subdomain Validation State
  const [subdomainStatus, setSubdomainStatus] = React.useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [subdomainReason, setSubdomainReason] = React.useState<string | null>(null);
  const [subdomainSuggestions, setSubdomainSuggestions] = React.useState<string[]>([]);

  // Email Validation State
  const [emailStatus, setEmailStatus] = React.useState<'idle' | 'checking' | 'available' | 'taken'>('idle');

  const [loading, setLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const deriveSlug = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 25);
  };

  const toggleAppSelection = (appId: string) => {
    setSelectedAppIds((prev) => {
      if (prev.includes(appId)) {
        if (prev.length === 1) {
          toast.error('Please keep at least one application selected');
          return prev;
        }
        return prev.filter((id) => id !== appId);
      } else {
        return [...prev, appId];
      }
    });
  };

  const handleOrgNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setOrganizationName(val);
    if (!isSubdomainCustom) {
      const slug = deriveSlug(val);
      setSubdomain(slug);
    }
  };

  const handleSubdomainChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsSubdomainCustom(true);
    const cleaned = e.target.value
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 30);
    setSubdomain(cleaned);
  };

  const handleResetSubdomain = () => {
    setIsSubdomainCustom(false);
    const slug = deriveSlug(organizationName);
    setSubdomain(slug);
  };

  const handlePickSuggestion = (candidate: string) => {
    setIsSubdomainCustom(true);
    setSubdomain(candidate);
  };

  React.useEffect(() => {
    const clean = subdomain.trim();
    if (!clean || clean.length < 3) {
      setSubdomainStatus('idle');
      setSubdomainReason(null);
      return;
    }

    const timer = setTimeout(async () => {
      setSubdomainStatus('checking');
      try {
        const res = await checkSubdomainAvailability(clean);
        if (res.available) {
          setSubdomainStatus('available');
          setSubdomainReason(null);
          setSubdomainSuggestions([]);
        } else {
          setSubdomainStatus('taken');
          setSubdomainReason(res.reason || 'ALREADY_TAKEN');
          setSubdomainSuggestions(res.suggestions || []);
        }
      } catch {
        setSubdomainStatus('idle');
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [subdomain]);

  // Real-time debounced email availability checker
  React.useEffect(() => {
    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setEmailStatus('idle');
      return;
    }

    const timer = setTimeout(async () => {
      setEmailStatus('checking');
      try {
        const res = await checkEmailAvailability(cleanEmail);
        if (res.available) {
          setEmailStatus('available');
        } else {
          setEmailStatus('taken');
        }
      } catch {
        setEmailStatus('idle');
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [email]);

  const handleContinueToOrgDetails = () => {
    if (selectedAppIds.length === 0) {
      toast.error('Please select at least one application to continue');
      return;
    }
    setCurrentStep('org_details');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!firstName.trim()) {
      setErrorMessage('First Name is required.');
      return;
    }

    if (!lastName.trim()) {
      setErrorMessage('Last Name is required.');
      return;
    }

    if (!organizationName.trim()) {
      setErrorMessage('Organization Name is required.');
      return;
    }

    if (!email.trim()) {
      setErrorMessage('Valid work email is required.');
      return;
    }

    if (emailStatus === 'taken') {
      setErrorMessage('This email address is already registered. Please log in or use a different email.');
      return;
    }

    if (!phone.trim()) {
      setErrorMessage('Phone number is required.');
      return;
    }

    // Format phone with +234 if not present
    let formattedPhone = phone.trim();
    if (!formattedPhone.startsWith('+')) {
      const cleanDigits = formattedPhone.replace(/\D/g, '');
      if (cleanDigits.startsWith('234')) {
        formattedPhone = `+${cleanDigits}`;
      } else if (cleanDigits.startsWith('0')) {
        formattedPhone = `+234${cleanDigits.slice(1)}`;
      } else {
        formattedPhone = `+234${cleanDigits}`;
      }
    }

    setLoading(true);

    try {
      // Map selected App IDs to backend products
      const selectedBackendApps: ('inventory' | 'gym')[] = Array.from(
        new Set(
          selectedAppIds.map((id) => {
            const item = APPS_LIST.find((a) => a.id === id);
            return item?.backendKey || 'inventory';
          })
        )
      );

      const primaryApp: 'inventory' | 'gym' = selectedAppIds.includes('gym') && !selectedAppIds.includes('inventory')
        ? 'gym'
        : 'inventory';

      const response = await startFreeTrial({
        selectedApps: selectedBackendApps.length > 0 ? selectedBackendApps : ['inventory'],
        primaryApp,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        fullName: `${firstName.trim()} ${lastName.trim()}`,
        organizationName: organizationName.trim(),
        subdomain: subdomain ? subdomain.toLowerCase().trim() : undefined,
        email: email.toLowerCase().trim(),
        phone: formattedPhone,
        country,
        language,
        organizationSize,
        primaryInterest,
      });

      useAuthStore.getState().setSession(
        response.accessToken,
        {
          id: response.user.id,
          email: response.user.email,
          fullName: response.user.fullName,
          phone: response.user.phone || null,
          status: response.user.status,
          emailVerifiedAt: response.user.emailVerifiedAt,
        },
        response.organization,
        'pending-verification'
      );

      navigate(
        `/thanks/trial?subdomain=${encodeURIComponent(response.organization.subdomain)}&token=${encodeURIComponent(response.accessToken)}`
      );
    } catch (err: any) {
      const msg = err.message || 'Could not start your free trial. Please check your information.';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const selectedAppsObjects = APPS_LIST.filter((app) => selectedAppIds.includes(app.id));

  return (
    <>
      <SeoHead
        title="Choose your Apps | Start Free Trial | Orvio Hub"
        description="Select your modular business applications for instant access on Orvio Hub."
      />

      <div className="min-h-screen bg-[#f8f9fa] text-slate-800 flex flex-col font-sans">
        {/* Top Minimalist Header */}
        <header className="w-full bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-sky-500 text-white shadow-md shadow-indigo-500/20 font-bold">
                <Zap className="h-5 w-5 fill-white" />
              </div>
              <span className="text-xl font-extrabold tracking-tight text-slate-900">
                Orvio<span className="text-indigo-600">Hub</span>
              </span>
            </Link>

            <div className="flex items-center gap-4 text-xs font-semibold text-slate-600">
              <Link to="/products" className="hover:text-indigo-600 hidden sm:inline-block">Apps</Link>
              <Link to="/pricing" className="hover:text-indigo-600 hidden sm:inline-block">Pricing</Link>
              <Link to="/contact" className="hover:text-indigo-600 hidden sm:inline-block">Help</Link>
              <Link to="/login" className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700">
                Sign In
              </Link>
            </div>
          </div>
        </header>

        {/* STEP 1: CHOOSE YOUR APPS (Odoo Style) */}
        {currentStep === 'apps' && (
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
            {/* Title Section with Cursive Accent & Organic Underline */}
            <div className="text-center space-y-2 mb-10">
              <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight relative inline-block">
                <span className="font-serif italic font-normal mr-2 text-slate-800">Choose your</span>
                <span className="relative font-black bg-gradient-to-r from-indigo-600 to-sky-600 bg-clip-text text-transparent">
                  Apps
                  {/* Organic curved underline */}
                  <svg
                    className="absolute -bottom-2.5 left-0 w-full h-3 text-emerald-400"
                    viewBox="0 0 100 12"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M2 9.5C25 3.5 75 3.5 98 9.5"
                      stroke="currentColor"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </h1>
              <p className="text-sm font-medium text-slate-500 pt-3">
                Free instant access. No credit card required.
              </p>
            </div>

            {/* 2-Column Layout: Grid of Apps on Left, Sticky Selection Summary Card on Right */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Column: Categorized Apps Grid (8 cols) */}
              <div className="lg:col-span-8 space-y-8">
                {CATEGORIES.map((category) => {
                  const categoryApps = APPS_LIST.filter((app) => app.category === category);
                  return (
                    <div key={category} className="space-y-3.5">
                      <h3 className="text-lg font-bold font-serif italic text-slate-800 tracking-tight">
                        {category}
                      </h3>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                        {categoryApps.map((app) => {
                          const isSelected = selectedAppIds.includes(app.id);
                          const IconComponent = app.icon;

                          return (
                            <button
                              key={app.id}
                              type="button"
                              onClick={() => toggleAppSelection(app.id)}
                              className={`flex items-center gap-3 p-3.5 rounded-2xl bg-white border text-left transition-all duration-150 cursor-pointer shadow-xs ${
                                isSelected
                                  ? 'border-indigo-600 ring-2 ring-indigo-500/20 shadow-md'
                                  : 'border-slate-200/90 hover:border-slate-300 hover:shadow-xs'
                              }`}
                            >
                              <div
                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${app.iconBg} ${app.iconColor}`}
                              >
                                <IconComponent className="h-5 w-5" />
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold text-slate-800 truncate">
                                  {app.name}
                                </div>
                                <div className="text-[11px] text-slate-400 truncate">
                                  {app.description}
                                </div>
                              </div>

                              {isSelected && (
                                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white">
                                  <Check className="h-3 w-3 stroke-[3]" />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Right Column: Sticky Summary & Continue Action Card (4 cols) */}
              <div className="lg:col-span-4 lg:sticky lg:top-24">
                <Card className="bg-white border-slate-200/90 shadow-xl rounded-3xl p-6 space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <h3 className="text-base font-bold text-slate-900">
                      {selectedAppIds.length} {selectedAppIds.length === 1 ? 'App' : 'Apps'} selected
                    </h3>
                    <Badge variant="glow" className="text-[10px] font-bold">
                      Instant Access
                    </Badge>
                  </div>

                  {/* List of Selected Apps */}
                  <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                    {selectedAppsObjects.map((app) => {
                      const IconComponent = app.icon;
                      return (
                        <div
                          key={app.id}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100"
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`flex h-7 w-7 items-center justify-center rounded-lg border ${app.iconBg} ${app.iconColor}`}
                            >
                              <IconComponent className="h-4 w-4" />
                            </div>
                            <span className="text-xs font-bold text-slate-800">{app.name}</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => toggleAppSelection(app.id)}
                            className="text-slate-400 hover:text-rose-500 text-xs px-1.5 font-bold"
                            title="Remove"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Green Banner: Odoo-style free entitlement badge */}
                  <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200/70 text-emerald-800 text-xs font-semibold text-center flex items-center justify-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Free 14-day trial, with unlimited users.</span>
                  </div>

                  {/* Big Prominent Continue Button */}
                  <Button
                    type="button"
                    variant="primary"
                    size="lg"
                    onClick={handleContinueToOrgDetails}
                    className="w-full h-13 text-base font-bold bg-[#714b67] hover:bg-[#5c3c54] text-white shadow-lg shadow-[#714b67]/25 rounded-2xl flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    <span>Continue</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>

                  <div className="pt-2 text-center text-[11px] text-slate-400 space-y-1">
                    <div className="flex items-center justify-center gap-1.5 font-medium">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                      <span>No credit card required</span>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </main>
        )}

        {/* STEP 2: ORGANIZATION DETAILS FORM (Get Started Screen) */}
        {currentStep === 'org_details' && (
          <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-in fade-in slide-in-from-bottom-3 duration-300">
            {/* Header: Cursive Get Started with Green Underline */}
            <div className="text-center space-y-2 mb-8">
              <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight font-serif italic relative inline-block">
                Get{' '}
                <span className="relative font-extrabold not-italic text-slate-900">
                  Started
                  {/* Green brush underline */}
                  <svg
                    className="absolute -bottom-2.5 left-0 w-full h-3 text-emerald-500"
                    viewBox="0 0 100 12"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M2 9.5C25 3.5 75 3.5 98 9.5"
                      stroke="currentColor"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </h1>
              <p className="text-sm font-semibold text-slate-600 pt-2">
                Free instant access. No credit card required.
              </p>
            </div>

            {/* Selected Apps Banner Card */}
            <div className="w-full bg-slate-100/70 border border-slate-200/80 rounded-2xl p-4 flex items-center justify-between shadow-xs mb-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {selectedAppsObjects.map((a) => a.name).join(', ') || 'Inventory'}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCurrentStep('apps')}
                className="text-xs font-semibold text-slate-600 hover:text-indigo-600 transition-colors cursor-pointer"
              >
                Change apps selection
              </button>
            </div>

            <Card className="bg-white border-slate-200/90 shadow-xl rounded-3xl p-6 sm:p-8 space-y-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                {errorMessage && (
                  <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center justify-between">
                    <span>{errorMessage}</span>
                    {errorMessage.includes('already exists') && (
                      <Link to="/login" className="font-bold underline ml-2">
                        Log In
                      </Link>
                    )}
                  </div>
                )}

                {/* 1. First Name and Last Name (2 Columns) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">
                      First Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Jame"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white transition-colors"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">
                      Last Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Bolaji"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white transition-colors"
                      required
                    />
                  </div>
                </div>

                {/* 2. Organization Name (Full Width) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Organization Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Company Name"
                    value={organizationName}
                    onChange={handleOrgNameChange}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white transition-colors"
                    required
                  />
                </div>

                {/* Subdomain Input with Custom Editing Power & Live Availability */}
                <div className="space-y-1.5 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/80">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5 text-indigo-600" />
                      <span>Workspace Subdomain</span>
                    </label>
                    {isSubdomainCustom && (
                      <button
                        type="button"
                        onClick={handleResetSubdomain}
                        className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer transition-colors"
                        title="Re-sync with Organization Name"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>Reset to name</span>
                      </button>
                    )}
                  </div>

                  <div className="relative flex items-center rounded-xl bg-white border border-slate-200 focus-within:border-indigo-600 focus-within:ring-2 focus-within:ring-indigo-500/10 transition-all overflow-hidden">
                    <span className="pl-3.5 pr-1 text-xs text-slate-400 font-mono select-none">
                      https://
                    </span>
                    <input
                      type="text"
                      placeholder="your-org"
                      value={subdomain}
                      onChange={handleSubdomainChange}
                      className="w-full bg-transparent py-2.5 px-1 text-xs text-indigo-700 font-mono font-bold focus:outline-none placeholder:text-slate-300"
                      required
                    />
                    <span className="pr-3.5 pl-1 text-xs text-slate-400 font-mono select-none">
                      .localhost:4000
                    </span>
                  </div>

                  {/* Real-time Status Badges & Suggestions */}
                  <div className="pt-1 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      {subdomainStatus === 'checking' && (
                        <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                          <span>Checking availability...</span>
                        </span>
                      )}

                      {subdomainStatus === 'available' && (
                        <span className="text-[11px] text-emerald-600 flex items-center gap-1.5 font-bold">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Subdomain is available</span>
                        </span>
                      )}

                      {subdomainStatus === 'taken' && (
                        <span className="text-[11px] text-rose-600 flex items-center gap-1.5 font-bold">
                          <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
                          <span>
                            {subdomainReason === 'RESERVED'
                              ? 'This subdomain is reserved for system use'
                              : subdomainReason === 'TOO_SHORT'
                              ? 'Subdomain must be at least 3 characters'
                              : subdomainReason === 'INVALID_CHARACTERS'
                              ? 'Only lowercase letters, numbers, and hyphens are allowed'
                              : 'Subdomain is already taken'}
                          </span>
                        </span>
                      )}

                      {subdomainStatus === 'idle' && (
                        <span className="text-[11px] text-slate-400">
                          3-30 lowercase characters, numbers or hyphens
                        </span>
                      )}
                    </div>

                    {/* Suggestions list when taken */}
                    {subdomainStatus === 'taken' && subdomainSuggestions.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[11px] text-slate-500 font-medium">Available alternatives:</span>
                        {subdomainSuggestions.map((candidate) => (
                          <button
                            key={candidate}
                            type="button"
                            onClick={() => handlePickSuggestion(candidate)}
                            className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors cursor-pointer"
                          >
                            {candidate}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. Email & Phone Number (2 Columns) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-indigo-600" />
                        <span>Work Email <span className="text-rose-500">*</span></span>
                      </label>
                      {emailStatus === 'checking' && (
                        <span className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin text-indigo-600" />
                          <span>Checking...</span>
                        </span>
                      )}
                      {emailStatus === 'available' && (
                        <span className="text-[11px] text-emerald-600 flex items-center gap-1 font-bold">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          <span>Available</span>
                        </span>
                      )}
                    </div>

                    <div className="relative flex items-center">
                      <input
                        type="email"
                        placeholder="e.g. you@company.com"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (errorMessage) setErrorMessage(null);
                        }}
                        className={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white transition-all ${
                          emailStatus === 'taken'
                            ? 'border-rose-400 focus:border-rose-600 bg-rose-50/40 pr-10'
                            : emailStatus === 'available'
                            ? 'border-emerald-400 focus:border-emerald-600 bg-emerald-50/20 pr-10'
                            : 'border-slate-200 focus:border-indigo-600'
                        }`}
                        required
                      />
                      {emailStatus === 'available' && (
                        <div className="absolute right-3.5 pointer-events-none">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        </div>
                      )}
                      {emailStatus === 'taken' && (
                        <div className="absolute right-3.5 pointer-events-none">
                          <AlertCircle className="h-4 w-4 text-rose-500" />
                        </div>
                      )}
                    </div>

                    {emailStatus === 'taken' && (
                      <div className="pt-0.5 text-[11px] text-rose-600 flex items-center justify-between">
                        <span className="font-medium">Account with this email already exists.</span>
                        <Link to="/login" className="font-bold underline text-indigo-600 hover:text-indigo-700 ml-1">
                          Log in &rarr;
                        </Link>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">
                      Phone Number <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex rounded-xl bg-slate-50 border border-slate-200 focus-within:border-indigo-600 focus-within:bg-white transition-colors overflow-hidden">
                      <div
                        className="flex items-center gap-1 px-3 bg-slate-100/90 border-r border-slate-200 text-xs font-bold text-slate-700 cursor-not-allowed select-none"
                        title="Nigeria (+234) is currently active"
                      >
                        <span className="text-sm">🇳🇬</span>
                        <span>+234</span>
                      </div>
                      <input
                        type="tel"
                        placeholder="907 332 5783"
                        value={phone}
                        maxLength={14}
                        onChange={(e) => {
                          const val = e.target.value;
                          const digitsOnly = val.replace(/\D/g, '');
                          if (digitsOnly.length <= 10) {
                            setPhone(val.replace(/[^\d\s-]/g, ''));
                          }
                        }}
                        className="w-full bg-transparent px-3 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* 4. Country & Language (2 Columns) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">
                      Country
                    </label>
                    <div className="relative">
                      <select
                        disabled
                        value={country}
                        className="w-full bg-slate-100/80 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 font-medium cursor-not-allowed appearance-none"
                        title="Nigeria is currently the default regional deployment"
                      >
                        <option value="Nigeria">Nigeria</option>
                      </select>
                      <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs">
                        ▼
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">
                      Language
                    </label>
                    <div className="relative">
                      <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 font-medium focus:outline-none focus:border-indigo-600 focus:bg-white transition-colors appearance-none cursor-pointer"
                      >
                        <option value="English">English</option>
                        <option value="French">French</option>
                        <option value="Spanish">Spanish</option>
                      </select>
                      <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs">
                        ▼
                      </div>
                    </div>
                  </div>
                </div>

                {/* 5. Organization Size & Primary Interest (2 Columns) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">
                      Organization size
                    </label>
                    <div className="relative">
                      <select
                        value={organizationSize}
                        onChange={(e) => setOrganizationSize(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 font-medium focus:outline-none focus:border-indigo-600 focus:bg-white transition-colors appearance-none cursor-pointer"
                      >
                        <option value="1 - 5 employees">1 - 5 employees</option>
                        <option value="5 - 20 employees">5 - 20 employees</option>
                        <option value="20 - 50 employees">20 - 50 employees</option>
                        <option value="50 - 250 employees">50 - 250 employees</option>
                        <option value="250+ employees">250+ employees</option>
                      </select>
                      <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs">
                        ▼
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">
                      Primary Interest
                    </label>
                    <div className="relative">
                      <select
                        value={primaryInterest}
                        onChange={(e) => setPrimaryInterest(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 font-medium focus:outline-none focus:border-indigo-600 focus:bg-white transition-colors appearance-none cursor-pointer"
                      >
                        <option value="Use it in my organization">Use it in my organization</option>
                        <option value="Provide services to other organizations">Provide services to other organizations</option>
                        <option value="Explore / Student / Learning">Explore / Student / Learning</option>
                      </select>
                      <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs">
                        ▼
                      </div>
                    </div>
                  </div>
                </div>

                {/* Legal / Policy Disclaimer */}
                <p className="text-[12px] text-slate-500 text-center pt-2">
                  By clicking on <strong className="text-slate-800">Start Now</strong>, you accept our{' '}
                  <Link to="/legal/subscription" className="text-indigo-600 underline font-medium hover:text-indigo-700">
                    Subscription Agreement
                  </Link>{' '}
                  and{' '}
                  <Link to="/legal/privacy" className="text-indigo-600 underline font-medium hover:text-indigo-700">
                    Privacy Policy
                  </Link>
                  .
                </p>

                {/* Centered Plum/Purple Start Now Button */}
                <div className="flex justify-center pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    disabled={loading || subdomainStatus === 'taken'}
                    className="min-w-[180px] h-12 text-sm font-bold bg-[#714b67] hover:bg-[#5c3c54] text-white shadow-lg shadow-[#714b67]/25 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Starting Trial...</span>
                      </>
                    ) : (
                      <span>Start Now</span>
                    )}
                  </Button>
                </div>
              </form>
            </Card>
          </main>
        )}
      </div>
    </>
  );
}
