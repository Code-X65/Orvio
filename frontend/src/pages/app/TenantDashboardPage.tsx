import * as React from 'react';
import {
  Package,
  Store,
  Dumbbell,
  Users,
  Settings,
  Plus,
  Grid,
  Laptop,
  Clock,
  LogOut,
  X,
  Loader2,
} from 'lucide-react';
import { useWorkspace, WorkspaceProvider } from '../../contexts/WorkspaceContext';
import { getSubdomainFromHostname, getAccountsBaseUrl } from '../../app/config/authUrls';
import { SeoHead } from '../../components/seo/SeoHead';
import { Button } from '../../components/ui/button';
import { resendVerificationEmail } from '../../domains/auth/api';
import { getAppById } from '../../features/apps/catalog';
import { AppMarketplaceModal } from '../../features/apps/components/AppMarketplaceModal';
import { toast } from 'sonner';
import { logout } from '../../lib/api/auth';
import { ApiError } from '../../lib/api/client';
import { useAuthStore } from '../../stores/auth-store';

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    return err.message || fallback;
  }
  if (err instanceof Error) {
    return err.message || fallback;
  }
  return fallback;
}

interface LaunchpadAppTile {
  id: string;
  name: string;
  iconRenderer: React.ReactNode;
  onClick?: () => void;
  isPrimary?: boolean;
}

function TenantDashboardInner() {
  const { clearSession } = useAuthStore();
  const {
    user,
    organization,
    installedProducts,
    isEmailUnverified,
    installApp,
    uninstallApp,
    setPrimaryApp,
  } = useWorkspace();

  const currentSubdomain = getSubdomainFromHostname() || organization?.subdomain || 'demo';

  const [resendingEmail, setResendingEmail] = React.useState(false);
  const [resendCooldown, setResendCooldown] = React.useState(0);
  const [isMarketplaceOpen, setIsMarketplaceOpen] = React.useState(false);
  const [activeAppModal, setActiveAppModal] = React.useState<{ title: string; desc: string } | null>(null);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = React.useState(false);
  const [selectedAppId, setSelectedAppId] = React.useState<string>('employees');

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
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to resend verification link. Please try again.'));
    } finally {
      setResendingEmail(false);
    }
  };

  const orgName = organization?.name || currentSubdomain || 'acme';

  const handleSignOut = async () => {
    try {
      await logout();
    } catch {
      // Ignore network error on signout
    } finally {
      clearSession();
      window.location.href = `${getAccountsBaseUrl()}/login`;
    }
  };

  const showRedirectPopup = (title: string, desc: string) => {
    setActiveAppModal({ title, desc });
  };

  const userInitials = user?.fullName
    ? user.fullName
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'J';

  // Build the icon renderer helper without background colors
  const getAppTileIcon = (productKey: string) => {
    const key = productKey.toLowerCase();
    if (key === 'inventory') {
      return (
        <div className="w-14 h-14 bg-transparent flex items-center justify-center">
          <div className="w-11 h-11 relative flex items-center justify-center">
            <div className="w-10 h-10 bg-amber-500 rounded-xl rotate-12 shadow-sm flex items-center justify-center">
              <div className="w-4 h-4 bg-purple-600 rounded-md" />
            </div>
          </div>
        </div>
      );
    }

    if (key === 'pos') {
      return (
        <div className="w-14 h-14 bg-transparent flex items-center justify-center">
          <Store className="w-11 h-11 text-rose-500" />
        </div>
      );
    }

    if (key === 'gym') {
      return (
        <div className="w-14 h-14 bg-transparent flex items-center justify-center">
          <Dumbbell className="w-11 h-11 text-emerald-400" />
        </div>
      );
    }

    const catalogApp = getAppById(key);
    const IconCmp = catalogApp?.icon || Package;
    return (
      <div className="w-14 h-14 bg-transparent flex items-center justify-center">
        <IconCmp className={`w-11 h-11 ${catalogApp?.iconColor || 'text-indigo-400'}`} />
      </div>
    );
  };

  // 1. Only show the active applications the organization is registered for (no background)
  const registeredAppTiles: LaunchpadAppTile[] = installedProducts.map((p) => {
    const catalogApp = getAppById(p.product_key);
    const appName = catalogApp?.name || p.product_key.charAt(0).toUpperCase() + p.product_key.slice(1);
    return {
      id: p.product_key,
      name: appName,
      isPrimary: p.is_primary,
      iconRenderer: getAppTileIcon(p.product_key),
      onClick: () => {
        setSelectedAppId(p.product_key);
        showRedirectPopup(appName, `Opening workspace module for ${appName}...`);
      },
    };
  });

  // 2. Employees Icon (no background color)
  const employeesTile: LaunchpadAppTile = {
    id: 'employees',
    name: 'Employees',
    iconRenderer: (
      <div className="w-14 h-14 bg-transparent flex items-center justify-center group-hover:scale-105 transition-transform">
        <div className="flex flex-col items-center justify-center">
          <div className="w-5 h-5 rounded-full bg-purple-400 mb-1" />
          <div className="flex items-center gap-1">
            <div className="w-3.5 h-3 rounded-t-lg bg-amber-400" />
            <div className="w-5 h-3.5 rounded-t-lg bg-teal-400" />
            <div className="w-3.5 h-3 rounded-t-lg bg-purple-400" />
          </div>
        </div>
      </div>
    ),
    onClick: () => {
      setSelectedAppId('employees');
      showRedirectPopup('Employees', 'Opening staff directory, cashier pins & role permissions...');
    },
  };

  // 3. Apps / Marketplace Icon (no background color)
  const appsMarketplaceTile: LaunchpadAppTile = {
    id: 'apps',
    name: 'Apps',
    iconRenderer: (
      <div className="w-14 h-14 bg-transparent flex items-center justify-center group-hover:scale-105 transition-transform">
        <div className="w-11 h-11 rounded-full relative overflow-hidden grid grid-cols-2 grid-rows-2">
          <div className="bg-rose-500" />
          <div className="bg-teal-400" />
          <div className="bg-amber-400" />
          <div className="bg-purple-500" />
        </div>
      </div>
    ),
    onClick: () => {
      setSelectedAppId('apps');
      setIsMarketplaceOpen(true);
    },
  };

  // 4. Organization Settings Icon (no background color)
  const settingsTile: LaunchpadAppTile = {
    id: 'settings',
    name: 'Settings',
    iconRenderer: (
      <div className="w-14 h-14 bg-transparent flex items-center justify-center group-hover:scale-105 transition-transform">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center shadow-md">
          <div className="w-4 h-4 rounded-full bg-[#111215]" />
        </div>
      </div>
    ),
    onClick: () => {
      setSelectedAppId('settings');
      showRedirectPopup('Settings', 'Opening organization settings, business profile & currency parameters...');
    },
  };

  // Combine only the required tiles: Active Registered Apps + Employees + Apps (Marketplace) + Settings
  const allTiles: LaunchpadAppTile[] = [
    ...registeredAppTiles,
    employeesTile,
    appsMarketplaceTile,
    settingsTile,
  ];

  return (
    <>
      <SeoHead
        title={`${orgName} | Tenant Workspace Dashboard`}
        description="Launch active applications, manage employees, configure organization settings, and add marketplace apps."
      />

      <div
        className="min-h-screen bg-[#111215] text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white relative overflow-x-hidden font-sans"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255, 255, 255, 0.07) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      >
        {/* Subtle Ambient Glow */}
        <div className="fixed top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-indigo-900/10 rounded-full blur-[140px] pointer-events-none -z-10" />

        {/* Top Header Bar */}
        <header className="h-14 bg-transparent px-4 sm:px-8 flex items-center justify-between sticky top-0 z-40">
          {/* Left: Optional Branding / Workspace identifier */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-500 hidden sm:inline-block">
                {currentSubdomain}.orvio.app
              </span>
            </div>
          </div>

          {/* Right: Quick Action Icons + Org Name + Profile Avatar */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* AI Assistant Icon */}
            <button
              type="button"
              onClick={() => showRedirectPopup('AI Workspace Copilot', 'Connecting to intelligent business automation agent...')}
              className="flex items-center gap-1 px-1.5 py-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer group"
              title="AI Assistant"
            >
              <span className="text-xs font-black bg-gradient-to-r from-amber-400 via-rose-400 to-indigo-400 bg-clip-text text-transparent group-hover:brightness-125">
                AI
              </span>
            </button>

            {/* Terminal View Icon */}
            <button
              type="button"
              onClick={() => showRedirectPopup('Terminal Workspace', 'Opening terminal operations & POS cash desk...')}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              title="Terminal View"
            >
              <Laptop className="h-4 w-4" />
            </button>

            {/* Notifications / Clock */}
            <button
              type="button"
              onClick={() => showRedirectPopup('Activity & Notifications', 'Loading 3 recent activity logs and alerts...')}
              className="relative p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              title="Recent Notifications"
            >
              <Clock className="h-4 w-4" />
              <span className="absolute -top-0.5 -right-0.5 bg-rose-500 text-[9px] font-bold text-white w-3.5 h-3.5 rounded-full flex items-center justify-center shadow">
                3
              </span>
            </button>

            {/* Organization Name */}
            <div className="flex items-center gap-1 text-xs text-slate-300 font-medium px-2 py-1 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
              <span>{orgName}</span>
            </div>

            {/* User Profile Avatar with dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="w-7 h-7 rounded-full bg-[#185a53] text-teal-200 font-bold text-xs flex items-center justify-center shadow cursor-pointer hover:ring-2 hover:ring-teal-400/30 transition-all"
              >
                {userInitials}
              </button>

              {/* Profile Dropdown */}
              {isProfileMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsProfileMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-[#181a20] border border-white/10 shadow-2xl p-2 z-50 animate-in fade-in-50 zoom-in-95 duration-150">
                    <div className="px-3 py-2 border-b border-white/5 mb-1">
                      <div className="text-xs font-bold text-white truncate">
                        {user?.fullName || 'Tenant Admin'}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono truncate">
                        {user?.email || 'admin@orvio.app'}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        setIsMarketplaceOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-slate-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer text-left"
                    >
                      <Grid className="h-3.5 w-3.5 text-indigo-400" />
                      <span>App Marketplace</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        showRedirectPopup('Settings', 'Opening organization settings...');
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-slate-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer text-left"
                    >
                      <Settings className="h-3.5 w-3.5 text-amber-400" />
                      <span>Organization Settings</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        showRedirectPopup('Employees', 'Opening staff & role management...');
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-slate-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer text-left"
                    >
                      <Users className="h-3.5 w-3.5 text-purple-400" />
                      <span>Manage Employees</span>
                    </button>

                    <div className="border-t border-white/5 my-1" />

                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer text-left font-semibold"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Email Verification Reminder if unverified */}
        {isEmailUnverified && (
          <div className="bg-amber-500/15 border-b border-amber-500/25 px-4 py-2 backdrop-blur-md">
            <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
              <div className="flex items-center gap-2 text-xs text-amber-200">
                <span>⚠️</span>
                <span>
                  Please verify your organization email (<span className="text-white font-semibold">{user?.email}</span>) to unlock all features.
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={resendingEmail || resendCooldown > 0}
                onClick={handleResendEmail}
                className="h-6 text-[11px] font-semibold bg-amber-500/10 border-amber-500/40 text-amber-300 hover:bg-amber-500/20"
              >
                {resendingEmail ? 'Sending...' : resendCooldown > 0 ? `Resend (${resendCooldown}s)` : 'Resend Email'}
              </Button>
            </div>
          </div>
        )}

        {/* Main Content Area - Centered Launchpad */}
        <main className="flex-1 flex flex-col items-center justify-center py-12 px-4 sm:px-6 max-w-5xl mx-auto w-full">
          {/* Centered Launchpad with transparent icon graphics */}
          <div className="w-full max-w-3xl mx-auto">
            <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12">
              {allTiles.map((app) => {
                const isSelected = selectedAppId === app.id;

                return (
                  <div
                    key={app.id}
                    onClick={() => {
                      setSelectedAppId(app.id);
                      if (app.onClick) app.onClick();
                    }}
                    className="flex flex-col items-center group cursor-pointer select-none transition-all w-20"
                  >
                    {/* Transparent icon container with smooth hover lift */}
                    <div className="relative flex flex-col items-center">
                      <div className="transition-transform duration-200 group-hover:-translate-y-2 group-hover:scale-105">
                        {app.iconRenderer}
                      </div>
                    </div>

                    {/* App Label */}
                    <span
                      className={`text-xs font-medium mt-2.5 text-center transition-colors truncate max-w-[85px] ${
                        isSelected
                          ? 'text-white font-semibold'
                          : 'text-slate-300 group-hover:text-white'
                      }`}
                    >
                      {app.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </main>
      </div>

      {/* Redirecting Interactive Popup Dialog */}
      {activeAppModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-[#181a20] border border-white/10 rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setActiveAppModal(null)}
              className="absolute top-4 right-4 p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/5"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 mx-auto flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Redirecting to {activeAppModal.title}</h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                {activeAppModal.desc}
              </p>
            </div>

            <div className="pt-2 flex items-center justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setActiveAppModal(null)}
                className="h-8 text-xs font-semibold border-white/10 text-slate-300 hover:text-white"
              >
                Stay on Launchpad
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* App Store & Marketplace Modal */}
      <AppMarketplaceModal
        isOpen={isMarketplaceOpen}
        onClose={() => setIsMarketplaceOpen(false)}
        installedProducts={installedProducts}
        onInstall={installApp}
        onUninstall={uninstallApp}
        onSetPrimary={setPrimaryApp}
      />
    </>
  );
}

export function TenantDashboardPage() {
  return (
    <WorkspaceProvider>
      <TenantDashboardInner />
    </WorkspaceProvider>
  );
}
