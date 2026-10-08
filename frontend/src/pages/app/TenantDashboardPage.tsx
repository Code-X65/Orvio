import * as React from 'react';
import {
  Package,
  Store,
  Dumbbell,
  Users,
  Settings,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Zap,
  Sparkles,
  Clock,
  CreditCard,
  ArrowUpRight,
  LogOut,
  ChevronRight,
  TrendingUp,
  Plus,
  Star,
  Layers,
  ShoppingBag,
  Activity,
  Receipt,
  FileText,
  AlertCircle,
  Menu,
  X,
  Search,
  LayoutDashboard,
  Grid,
  Bell,
  Command,
  ChevronDown,
  Building2,
  Laptop,
} from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';
import { getSubdomainFromHostname, getAccountsBaseUrl, getTenantWorkspaceUrl } from '../../app/config/authUrls';
import { SeoHead } from '../../components/seo/SeoHead';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { CopyUrlButton } from '../../features/signup/components/CopyUrlButton';
import { resendVerificationEmail } from '../../domains/auth/api';
import {
  fetchWorkspaceDetails,
  installWorkspaceProduct,
  uninstallWorkspaceProduct,
  setPrimaryWorkspaceProduct,
  type WorkspaceProductItem,
} from '../../features/apps/api';
import { APPS_LIST, getAppById, type AppItem } from '../../features/apps/catalog';
import { AppMarketplaceModal } from '../../features/apps/components/AppMarketplaceModal';
import { toast } from 'sonner';
import { logout } from '../../lib/api/auth';

export function TenantDashboardPage() {
  const { user, organization, hydrate, isHydrated, clearSession } = useAuthStore();
  const currentSubdomain = getSubdomainFromHostname() || organization?.subdomain || 'demo';

  const [resendingEmail, setResendingEmail] = React.useState(false);
  const [resendCooldown, setResendCooldown] = React.useState(0);
  const [isMarketplaceOpen, setIsMarketplaceOpen] = React.useState(false);
  const [installedProducts, setInstalledProducts] = React.useState<WorkspaceProductItem[]>([]);
  const [loadingProducts, setLoadingProducts] = React.useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = React.useState(false);

  // Fetch workspace products when hydrated and verified
  React.useEffect(() => {
    if (!isHydrated) return;

    if (user?.emailVerifiedAt && organization?.status === 'active') {
      loadWorkspaceProducts();
    } else {
      // Use local default plan catalog without firing blocked 403 requests
      const defaultKey = organization?.planCode === 'gym' ? 'gym' : 'inventory';
      setInstalledProducts([
        {
          id: 'initial',
          org_id: organization?.id || 'org',
          product_key: defaultKey,
          status: 'active',
          is_primary: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);
      setLoadingProducts(false);
    }
  }, [isHydrated, user?.emailVerifiedAt, organization?.status, organization?.planCode]);

  // Sync email verification when tab regains focus if user is pending verification
  React.useEffect(() => {
    if (!user || user.emailVerifiedAt) return;

    const syncVerificationStatus = () => {
      if (document.visibilityState === 'visible') {
        import('../../lib/api/auth').then(({ getCurrentUser }) => {
          getCurrentUser()
            .then((res) => {
              if (res.user && res.user.emailVerifiedAt) {
                const state = useAuthStore.getState();
                if (state.accessToken && state.organization) {
                  state.setSession(
                    state.accessToken,
                    res.user,
                    {
                      ...state.organization,
                      status: 'active',
                    },
                    'authenticated'
                  );
                }
              }
            })
            .catch(() => {
              // Ignore background sync errors
            });
        });
      }
    };

    window.addEventListener('focus', syncVerificationStatus);
    return () => window.removeEventListener('focus', syncVerificationStatus);
  }, [user?.emailVerifiedAt]);

  const loadWorkspaceProducts = async () => {
    try {
      setLoadingProducts(true);
      const res = await fetchWorkspaceDetails();
      if (res.products && res.products.length > 0) {
        setInstalledProducts(res.products);
      } else {
        // Fallback to plan code if products not yet initialized in DB
        const defaultKey = organization?.planCode === 'gym' ? 'gym' : 'inventory';
        setInstalledProducts([
          {
            id: 'default',
            org_id: organization?.id || 'org',
            product_key: defaultKey,
            status: 'active',
            is_primary: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]);
      }
    } catch (err) {
      const defaultKey = organization?.planCode === 'gym' ? 'gym' : 'inventory';
      setInstalledProducts([
        {
          id: 'fallback',
          org_id: organization?.id || 'org',
          product_key: defaultKey,
          status: 'active',
          is_primary: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoadingProducts(false);
    }
  };

  React.useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const handleResendEmail = async () => {
    if (!user?.email || resendingEmail || resendCooldown > 0) return;
    setResendingEmail(true);
    try {
      await resendVerificationEmail(user.email);
      setResendCooldown(60);
      toast.success(`Verification link sent to ${user.email}`);
    } catch {
      toast.error('Failed to resend verification link. Please try again.');
    } finally {
      setResendingEmail(false);
    }
  };

  const isEmailUnverified = Boolean(user && !user.emailVerifiedAt);
  const orgName = organization?.name || (currentSubdomain ? currentSubdomain.toUpperCase() : 'Your Workspace');
  const workspaceUrl = getTenantWorkspaceUrl(currentSubdomain);

  const handleInstallApp = async (productKey: string) => {
    if (isEmailUnverified) {
      toast.error('Please verify your email address to add workspace applications.');
      return;
    }
    try {
      const updated = await installWorkspaceProduct(productKey);
      setInstalledProducts(updated);
    } catch {
      toast.error('Failed to install workspace app.');
    }
  };

  const handleUninstallApp = async (productKey: string) => {
    if (isEmailUnverified) {
      toast.error('Please verify your email address to modify workspace applications.');
      return;
    }
    try {
      const updated = await uninstallWorkspaceProduct(productKey);
      setInstalledProducts(updated);
    } catch {
      toast.error('Failed to uninstall workspace app.');
    }
  };

  const handleSetPrimaryApp = async (productKey: string) => {
    if (isEmailUnverified) {
      toast.error('Please verify your email address to set primary applications.');
      return;
    }
    try {
      const updated = await setPrimaryWorkspaceProduct(productKey);
      setInstalledProducts(updated);
    } catch {
      toast.error('Failed to update primary app.');
    }
  };

  const handleSignOut = async () => {
    try {
      await logout();
    } catch {
      // A network failure must not trap a user in the current browser session.
    } finally {
      clearSession();
      window.location.href = `${getAccountsBaseUrl()}/login`;
    }
  };

  // Map installed products to rich catalog items
  const installedAppItems: Array<{ product: WorkspaceProductItem; app: AppItem }> = installedProducts
    .map((p) => {
      const app = getAppById(p.product_key) || {
        id: p.product_key,
        name: p.product_key.charAt(0).toUpperCase() + p.product_key.slice(1),
        category: 'Operations',
        icon: Package,
        iconBg: 'bg-indigo-500/10 border-indigo-500/20',
        iconColor: 'text-indigo-400',
        badgeColor: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
        backendKey: (p.product_key === 'gym' ? 'gym' : 'inventory') as 'inventory' | 'gym',
        description: `${p.product_key} business workspace tool`,
        details: 'Configured and active in your organization workspace.',
        route: `/${p.product_key}`,
        statusLabel: 'Active Module',
        quickAction: 'Open Application',
      };
      return { product: p, app };
    })
    .sort((a, b) => (b.product.is_primary ? 1 : 0) - (a.product.is_primary ? 1 : 0));

  const activeKeys = new Set(installedProducts.map((p) => p.product_key.toLowerCase()));
  const hasGym = activeKeys.has('gym') || activeKeys.has('memberships');
  const hasPos = activeKeys.has('pos') || activeKeys.has('inventory');

  const userInitials = user?.fullName
    ? user.fullName
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'US';

  return (
    <>
      <SeoHead
        title={`${orgName} | Orvio Workspace Dashboard`}
        description="Manage your business operations, inventory, memberships, and branches on Orvio Hub."
      />

      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
        {/* Background Ambient Glows */}
        <div className="fixed top-0 left-72 w-[850px] h-[350px] bg-indigo-600/10 rounded-full blur-[160px] pointer-events-none -z-10" />
        <div className="fixed bottom-10 right-10 w-[450px] h-[450px] bg-sky-600/5 rounded-full blur-[180px] pointer-events-none -z-10" />

        {/* Prominent Email Verification Banner */}
        {isEmailUnverified && (
          <div className="bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-amber-500/20 border-b border-amber-500/30 px-4 py-2.5 sm:px-6 relative z-50 backdrop-blur-md">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
              <div className="flex items-center gap-2.5 text-xs text-amber-200">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 shrink-0 text-xs">
                  ⚠️
                </span>
                <span>
                  <strong>Please verify your organization email address:</strong> We sent a link to{' '}
                  <strong className="text-white underline">{user?.email}</strong>. Verify to unlock team invites.
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={resendingEmail || resendCooldown > 0}
                  onClick={handleResendEmail}
                  className="h-7 text-xs font-semibold bg-amber-500/10 border-amber-500/40 text-amber-300 hover:bg-amber-500/20 hover:text-white cursor-pointer"
                >
                  {resendingEmail ? (
                    'Sending...'
                  ) : resendCooldown > 0 ? (
                    `Resend in ${resendCooldown}s`
                  ) : (
                    'Resend Verification Email'
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Main Application Layout with Sidebar */}
        <div className="flex-1 flex flex-row overflow-hidden relative">
          {/* Mobile Sidebar Backdrop */}
          {isMobileSidebarOpen && (
            <div
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => setIsMobileSidebarOpen(false)}
            />
          )}

          {/* Premium Persistent Sidebar */}
          <aside
            className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-72 bg-slate-950/95 lg:bg-slate-950/60 border-r border-slate-800/80 backdrop-blur-2xl flex flex-col justify-between transition-transform duration-300 ease-in-out ${
              isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
            }`}
          >
            {/* Sidebar Top: Organization Header */}
            <div className="p-4 border-b border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-500 via-indigo-600 to-sky-400 text-white shadow-lg shadow-indigo-500/25 font-black text-lg ring-1 ring-white/20">
                    <Zap className="h-5 w-5 fill-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-white text-sm tracking-tight truncate max-w-[130px]">
                        {orgName}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                        {currentSubdomain}
                      </span>
                      <span className="text-[10px] uppercase font-mono text-emerald-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Live
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsMobileSidebarOpen(false)}
                  className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Sidebar Scrollable Nav Items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-none">
              {/* Section 1: Overview */}
              <div className="space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-3 pb-1">
                  Workspace Core
                </div>
                <button
                  type="button"
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold bg-indigo-600/15 text-indigo-300 border border-indigo-500/30 shadow-inner group transition-all cursor-pointer"
                >
                  <LayoutDashboard className="h-4 w-4 text-indigo-400" />
                  <span>Dashboard & Launchpad</span>
                </button>
              </div>

              {/* Section 2: Active / Installed Applications */}
              <div className="space-y-1">
                <div className="flex items-center justify-between px-3 pb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Active Apps ({installedProducts.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsMarketplaceOpen(true)}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold hover:underline cursor-pointer"
                  >
                    + Add
                  </button>
                </div>

                {installedAppItems.map(({ product, app }) => {
                  const IconComponent = app.icon;
                  const isPrimary = product.is_primary;

                  return (
                    <button
                      key={product.id || app.id}
                      type="button"
                      onClick={() => toast.info(`Switching to ${app.name}...`)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all group cursor-pointer ${
                        isPrimary
                          ? 'bg-slate-900/80 hover:bg-slate-900 text-white border border-indigo-500/30'
                          : 'text-slate-300 hover:text-white hover:bg-slate-900/60 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <div
                          className={`h-6 w-6 rounded-lg border ${app.iconBg} ${app.iconColor} flex items-center justify-center shrink-0`}
                        >
                          <IconComponent className="h-3.5 w-3.5" />
                        </div>
                        <span className="truncate">{app.name}</span>
                      </div>

                      {isPrimary && (
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0 ml-1" />
                      )}
                    </button>
                  );
                })}

                {/* Add More Apps Inline Button */}
                <button
                  type="button"
                  onClick={() => setIsMarketplaceOpen(true)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 border border-dashed border-slate-800 hover:border-indigo-500/30 transition-all cursor-pointer group mt-2"
                >
                  <Plus className="h-4 w-4 text-slate-500 group-hover:text-indigo-400" />
                  <span>Add More Applications</span>
                </button>
              </div>

              {/* Section 3: Management & Settings */}
              <div className="space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-3 pb-1">
                  Management
                </div>

                <button
                  type="button"
                  onClick={() => setIsMarketplaceOpen(true)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-900/60 transition-colors cursor-pointer"
                >
                  <Grid className="h-4 w-4 text-slate-500" />
                  <span>App Marketplace</span>
                </button>

                <button
                  type="button"
                  onClick={() => toast.info('Branch & Store settings coming soon')}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-900/60 transition-colors cursor-pointer"
                >
                  <Building2 className="h-4 w-4 text-slate-500" />
                  <span>Branches & Terminals</span>
                </button>

                <button
                  type="button"
                  onClick={() => toast.info('Team & Roles configuration coming soon')}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-900/60 transition-colors cursor-pointer"
                >
                  <Users className="h-4 w-4 text-slate-500" />
                  <span>Team & Cashiers</span>
                </button>

                <button
                  type="button"
                  onClick={() => toast.info('Billing management coming soon')}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-900/60 transition-colors cursor-pointer"
                >
                  <CreditCard className="h-4 w-4 text-slate-500" />
                  <span>Subscription & Invoices</span>
                </button>
              </div>
            </div>

            {/* Sidebar Bottom: User Profile Card & Sign Out */}
            <div className="p-3 border-t border-slate-800/80 bg-slate-950/80">
              <div className="p-2.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5 truncate">
                  <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-500 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm shadow-indigo-500/30">
                    {userInitials}
                  </div>
                  <div className="truncate">
                    <div className="text-xs font-bold text-white truncate">
                      {user?.fullName || 'Administrator'}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate font-mono">
                      {user?.email || 'admin@orvio.app'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSignOut}
                  title="Sign Out"
                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer ml-1 shrink-0"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </aside>

          {/* Main Dashboard Area */}
          <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
            {/* Command Header */}
            <header className="sticky top-0 z-30 h-16 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl px-4 sm:px-6 lg:px-8 flex items-center justify-between">
              {/* Left: Mobile Toggle & Breadcrumbs */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsMobileSidebarOpen(true)}
                  className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-900 rounded-xl"
                >
                  <Menu className="h-5 w-5" />
                </button>

                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400 font-medium">Workspace</span>
                  <span className="text-slate-600">/</span>
                  <span className="text-white font-bold">App Launchpad</span>
                </div>
              </div>

              {/* Right: Search shortcut & URL pill */}
              <div className="flex items-center gap-3">
                <div className="hidden md:flex items-center gap-2 text-xs text-slate-400 bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-1.5 font-mono">
                  <span className="text-indigo-300 font-bold">{currentSubdomain}.orvio.app</span>
                  <CopyUrlButton url={workspaceUrl} />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsMarketplaceOpen(true)}
                  className="h-8.5 px-3 text-xs font-bold bg-indigo-600/10 border-indigo-500/30 text-indigo-300 hover:bg-indigo-600 hover:text-white transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  <span>Add Apps</span>
                </Button>
              </div>
            </header>

            {/* Dashboard Content Container */}
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
              {/* Ultra-Premium Glass Hero Banner */}
              <div className="relative rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-indigo-950/50 via-slate-900/90 to-slate-900/80 border border-indigo-500/20 overflow-hidden shadow-2xl backdrop-blur-md">
                <div className="absolute -right-10 -top-10 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10 max-w-2xl space-y-3">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
                    <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Workspace Engine Online</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    Welcome to your hub, {user?.fullName?.split(' ')[0] || 'Merchant'}!
                  </h1>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Below are the business applications activated for your organization. You can launch tools immediately or install additional modules seamlessly from the app marketplace.
                  </p>
                </div>
              </div>

              {/* Dynamic Contextual Metrics (KPIs based on selected apps) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Metric 1: Installed Apps Counter */}
                <Card className="p-5 bg-slate-900/60 border-slate-800/80 rounded-2xl flex items-center justify-between hover:border-indigo-500/30 transition-all">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Active Applications</div>
                    <div className="text-2xl font-black text-white mt-1">
                      {installedProducts.length} <span className="text-xs font-normal text-slate-400">installed</span>
                    </div>
                    <div className="text-[11px] text-indigo-400 flex items-center gap-1 mt-0.5">
                      <CheckCircle2 className="h-3 w-3" /> Fully unlocked in trial
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20 shadow-inner">
                    <Layers className="h-5 w-5" />
                  </div>
                </Card>

                {/* Metric 2: Contextual App Status */}
                {hasGym ? (
                  <Card className="p-5 bg-slate-900/60 border-slate-800/80 rounded-2xl flex items-center justify-between hover:border-emerald-500/30 transition-all">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Gym & Studio</div>
                      <div className="text-base font-bold text-white mt-1">Biometrics Ready</div>
                      <div className="text-[11px] text-emerald-400 mt-0.5">Turnstiles & QR check-in</div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 shadow-inner">
                      <Dumbbell className="h-5 w-5" />
                    </div>
                  </Card>
                ) : hasPos ? (
                  <Card className="p-5 bg-slate-900/60 border-slate-800/80 rounded-2xl flex items-center justify-between hover:border-rose-500/30 transition-all">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Smart POS & Retail</div>
                      <div className="text-base font-bold text-white mt-1">Register 01 Online</div>
                      <div className="text-[11px] text-rose-400 mt-0.5">Thermal print & Barcode sync</div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20 shadow-inner">
                      <Store className="h-5 w-5" />
                    </div>
                  </Card>
                ) : (
                  <Card className="p-5 bg-slate-900/60 border-slate-800/80 rounded-2xl flex items-center justify-between hover:border-sky-500/30 transition-all">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Branch Terminal</div>
                      <div className="text-base font-bold text-white mt-1">Main Store (HQ)</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">Branch online</div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center border border-sky-500/20 shadow-inner">
                      <Store className="h-5 w-5" />
                    </div>
                  </Card>
                )}

                {/* Metric 3: Regional Currency & Branch */}
                <Card className="p-5 bg-slate-900/60 border-slate-800/80 rounded-2xl flex items-center justify-between hover:border-violet-500/30 transition-all">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Regional Currency</div>
                    <div className="text-base font-bold text-white mt-1">{organization?.currency || 'NGN'} (₦)</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Timezone: {organization?.timezone || 'Africa/Lagos'}</div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center border border-violet-500/20 shadow-inner">
                    <Clock className="h-5 w-5" />
                  </div>
                </Card>

                {/* Metric 4: Role & Security */}
                <Card className="p-5 bg-slate-900/60 border-slate-800/80 rounded-2xl flex items-center justify-between hover:border-emerald-500/30 transition-all">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Access & Security</div>
                    <div className="text-base font-bold text-white mt-1">Owner Privileges</div>
                    <div className="text-[11px] text-emerald-400 flex items-center gap-1 mt-0.5">
                      <ShieldCheck className="h-3 w-3" /> Full Administrator
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 shadow-inner">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                </Card>
              </div>

              {/* Dynamic Installed Applications Launchpad */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-white tracking-tight">Your Business Applications</h2>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-mono font-bold">
                        {installedProducts.length} Active
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Launch your active tools or manage your organization applications.
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsMarketplaceOpen(true)}
                    className="h-8 text-xs font-bold border-slate-700 hover:border-indigo-500 text-slate-300 hover:text-white cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    <span>Explore App Marketplace</span>
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {/* Render dynamic installed application cards */}
                  {installedAppItems.map(({ product, app }) => {
                    const IconComponent = app.icon;
                    const isPrimary = product.is_primary;

                    return (
                      <div
                        key={product.id || app.id}
                        className={`p-6 rounded-3xl border transition-all duration-300 group relative overflow-hidden flex flex-col justify-between ${
                          isPrimary
                            ? 'bg-gradient-to-b from-slate-900/95 via-slate-900/80 to-slate-950 border-indigo-500/40 shadow-xl shadow-indigo-950/30 ring-1 ring-indigo-500/20'
                            : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900/90'
                        }`}
                      >
                        {/* Top ambient glow for primary card */}
                        {isPrimary && (
                          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
                        )}

                        <div className="space-y-4 relative z-10">
                          {/* Top Badges */}
                          <div className="flex items-start justify-between">
                            <div
                              className={`w-12 h-12 rounded-2xl border ${app.iconBg} ${app.iconColor} flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner`}
                            >
                              <IconComponent className="h-6 w-6" />
                            </div>

                            <div className="flex items-center gap-1.5">
                              {isPrimary ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono shadow-sm shadow-amber-500/10">
                                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> Primary Terminal
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-800/80 text-slate-300 border border-slate-700">
                                  {app.category}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Title & Description */}
                          <div>
                            <h3 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors flex items-center justify-between">
                              <span>{app.name}</span>
                              <ArrowUpRight className="h-4 w-4 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                            </h3>
                            <p className="text-xs text-slate-400 mt-1 leading-relaxed">{app.description}</p>
                          </div>

                          {/* Detail Pill */}
                          <div className="text-[11px] text-slate-400 bg-slate-950/70 p-3 rounded-2xl border border-slate-800/80 leading-relaxed font-sans">
                            {app.details}
                          </div>
                        </div>

                        {/* Card Footer Actions */}
                        <div className="pt-5 flex items-center justify-between border-t border-slate-800/80 mt-5 relative z-10">
                          <span className="text-[11px] font-mono text-emerald-400 font-semibold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            {app.statusLabel || 'Online'}
                          </span>

                          <Button
                            size="sm"
                            variant={isPrimary ? 'primary' : 'outline'}
                            className={`h-8 text-xs font-bold cursor-pointer rounded-xl ${
                              isPrimary
                                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/25'
                                : 'border-slate-700 hover:border-slate-600 text-white'
                            }`}
                            onClick={() => {
                              toast.info(`Opening ${app.name} workspace...`);
                            }}
                          >
                            <span>{app.quickAction || 'Launch App'}</span>
                          </Button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Add More Apps CTA Card */}
                  <div
                    onClick={() => setIsMarketplaceOpen(true)}
                    className="p-6 rounded-3xl border-2 border-dashed border-slate-800 hover:border-indigo-500/50 bg-slate-950/40 hover:bg-slate-900/40 transition-all duration-300 cursor-pointer flex flex-col items-center justify-center text-center space-y-3 min-h-[260px] group"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center group-hover:scale-110 group-hover:bg-indigo-500/20 transition-all shadow-inner">
                      <Plus className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
                        Add Business Applications
                      </h3>
                      <p className="text-xs text-slate-400 max-w-xs mt-1">
                        Connect Point of Sale, eCommerce, Invoicing, WhatsApp broadcast, or CRM modules.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs font-bold border-slate-700 group-hover:border-indigo-500/40 group-hover:text-indigo-300 mt-2 rounded-xl"
                    >
                      <Sparkles className="h-3.5 w-3.5 mr-1" />
                      <span>Browse App Catalog</span>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Business Setup Checklist & Quick Operations */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Onboarding Checklist */}
                <Card className="p-6 bg-slate-900/80 border-slate-800 rounded-3xl space-y-4 lg:col-span-2 shadow-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-white tracking-tight">Getting Started Checklist</h3>
                      <p className="text-xs text-slate-400">Essential milestones to prepare for customer transactions</p>
                    </div>
                    <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/30">
                      2 / 4 Completed
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                    <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white line-through opacity-80">Create Administrator Account</div>
                        <div className="text-[11px] text-slate-400">Registered with {user?.email || 'verified work email'}</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white line-through opacity-80">Verify Workspace Subdomain</div>
                        <div className="text-[11px] text-slate-400">Live on {currentSubdomain}.orvio.app</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-indigo-950/20 border border-indigo-500/30 hover:bg-indigo-950/40 transition-colors cursor-pointer group">
                      <div className="w-5 h-5 rounded-full border border-indigo-400/50 flex items-center justify-center shrink-0 mt-0.5 text-indigo-300 text-[10px] font-bold">
                        3
                      </div>
                      <div className="flex-1">
                        <div className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors flex items-center justify-between">
                          <span>{hasGym ? 'Add Membership Plans' : 'Add First Catalog SKU'}</span>
                          <ChevronRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-indigo-400" />
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {hasGym ? 'Set recurring monthly rates & session packages' : 'Set unit prices, barcodes & initial stock counts'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-950/40 border border-slate-800/80 hover:bg-slate-900 transition-colors cursor-pointer group">
                      <div className="w-5 h-5 rounded-full border border-slate-600 flex items-center justify-center shrink-0 mt-0.5 text-slate-400 text-[10px] font-bold">
                        4
                      </div>
                      <div className="flex-1">
                        <div className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors flex items-center justify-between">
                          <span>Connect Payment Terminal</span>
                          <ChevronRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-indigo-400" />
                        </div>
                        <div className="text-[11px] text-slate-400">Enable Paystack, Flutterwave, or cash drawer printing</div>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Quick Admin Actions */}
                <Card className="p-6 bg-slate-900/80 border-slate-800 rounded-3xl space-y-4 flex flex-col justify-between shadow-xl">
                  <div>
                    <h3 className="text-base font-bold text-white tracking-tight">Administration & Team</h3>
                    <p className="text-xs text-slate-400">Quick shortcuts for business managers</p>

                    <div className="space-y-2 mt-4">
                      <button
                        type="button"
                        onClick={() => toast.info('Staff invitation modal coming soon')}
                        className="w-full text-left p-3 rounded-2xl bg-slate-950/50 hover:bg-slate-950 border border-slate-800/80 flex items-center justify-between group transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <Users className="h-4 w-4 text-indigo-400" />
                          <span className="text-xs font-bold text-slate-200 group-hover:text-white">Invite Team Staff</span>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-white" />
                      </button>

                      <button
                        type="button"
                        onClick={() => toast.info('Hardware sync wizard coming soon')}
                        className="w-full text-left p-3 rounded-2xl bg-slate-950/50 hover:bg-slate-950 border border-slate-800/80 flex items-center justify-between group transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <Receipt className="h-4 w-4 text-emerald-400" />
                          <span className="text-xs font-bold text-slate-200 group-hover:text-white">Receipt & Tax Settings</span>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-white" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsMarketplaceOpen(true)}
                        className="w-full text-left p-3 rounded-2xl bg-slate-950/50 hover:bg-slate-950 border border-slate-800/80 flex items-center justify-between group transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <Layers className="h-4 w-4 text-sky-400" />
                          <span className="text-xs font-bold text-slate-200 group-hover:text-white">Manage Installed Apps</span>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-white" />
                      </button>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between">
                    <span>Orvio Core Engine v2.4</span>
                    <span className="text-emerald-400 font-mono font-semibold">Status: Optimal</span>
                  </div>
                </Card>
              </div>
            </main>
          </div>
        </div>
      </div>

      {/* App Store & Marketplace Modal */}
      <AppMarketplaceModal
        isOpen={isMarketplaceOpen}
        onClose={() => setIsMarketplaceOpen(false)}
        installedProducts={installedProducts}
        onInstall={handleInstallApp}
        onUninstall={handleUninstallApp}
        onSetPrimary={handleSetPrimaryApp}
      />
    </>
  );
}
