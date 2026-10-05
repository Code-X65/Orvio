import * as React from 'react';
import {
  Search,
  Check,
  Plus,
  Trash2,
  Star,
  Sparkles,
  Layers,
  X,
  Loader2,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { APPS_LIST, CATEGORIES, type AppCategory, type AppItem } from '../catalog';
import type { WorkspaceProductItem } from '../api';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { toast } from 'sonner';

export interface AppMarketplaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  installedProducts: WorkspaceProductItem[];
  onInstall: (productKey: string) => Promise<void>;
  onUninstall: (productKey: string) => Promise<void>;
  onSetPrimary: (productKey: string) => Promise<void>;
}

export function AppMarketplaceModal({
  isOpen,
  onClose,
  installedProducts,
  onInstall,
  onUninstall,
  onSetPrimary,
}: AppMarketplaceModalProps) {
  const [selectedCategory, setSelectedCategory] = React.useState<AppCategory | 'All'>('All');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [loadingKey, setLoadingKey] = React.useState<string | null>(null);

  if (!isOpen) return null;

  const installedKeys = new Set(installedProducts.map((p) => p.product_key.toLowerCase()));
  const primaryKey = installedProducts.find((p) => p.is_primary)?.product_key.toLowerCase();

  const filteredApps = APPS_LIST.filter((app) => {
    const matchesCategory = selectedCategory === 'All' || app.category === selectedCategory;
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      app.name.toLowerCase().includes(query) ||
      app.description.toLowerCase().includes(query) ||
      app.id.toLowerCase().includes(query) ||
      app.category.toLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  });

  const handleInstallClick = async (appId: string) => {
    setLoadingKey(appId);
    try {
      await onInstall(appId);
      toast.success(`${APPS_LIST.find((a) => a.id === appId)?.name || 'App'} installed successfully!`);
    } catch {
      toast.error('Failed to install app. Please try again.');
    } finally {
      setLoadingKey(null);
    }
  };

  const handleUninstallClick = async (appId: string) => {
    if (installedProducts.length <= 1) {
      toast.error('You must keep at least one active application in your workspace.');
      return;
    }
    setLoadingKey(appId);
    try {
      await onUninstall(appId);
      toast.success(`${APPS_LIST.find((a) => a.id === appId)?.name || 'App'} uninstalled.`);
    } catch {
      toast.error('Failed to uninstall app.');
    } finally {
      setLoadingKey(null);
    }
  };

  const handleSetPrimaryClick = async (appId: string) => {
    setLoadingKey(appId);
    try {
      await onSetPrimary(appId);
      toast.success(`Set ${APPS_LIST.find((a) => a.id === appId)?.name || 'App'} as primary default.`);
    } catch {
      toast.error('Failed to update primary app.');
    } finally {
      setLoadingKey(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 lg:p-8 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-5xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col z-10 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shadow-inner">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white tracking-tight">App Store & Module Marketplace</h2>
                <Badge variant="glow" className="text-[10px] font-bold">
                  Instant 1-Click Install
                </Badge>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Add business applications to your workspace. All apps are fully unlocked during your 14-day trial.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Toolbar: Search + Category Filters */}
        <div className="p-4 sm:px-6 bg-slate-950/20 border-b border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedCategory('All')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                selectedCategory === 'All'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              All Modules ({APPS_LIST.length})
            </button>
            {CATEGORIES.map((cat) => {
              const count = APPS_LIST.filter((a) => a.category === cat).length;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    selectedCategory === cat
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  {cat} ({count})
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search applications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Apps Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredApps.map((app) => {
              const isInstalled = installedKeys.has(app.id.toLowerCase());
              const isPrimary = primaryKey === app.id.toLowerCase();
              const IconComponent = app.icon;
              const isLoading = loadingKey === app.id;

              return (
                <div
                  key={app.id}
                  className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                    isInstalled
                      ? 'bg-slate-900/90 border-indigo-500/40 shadow-lg shadow-indigo-950/20'
                      : 'bg-slate-950/50 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Header with Icon & Badges */}
                    <div className="flex items-start justify-between">
                      <div
                        className={`h-11 w-11 rounded-2xl border ${app.iconBg} ${app.iconColor} flex items-center justify-center shadow-inner`}
                      >
                        <IconComponent className="h-5 w-5" />
                      </div>

                      <div className="flex items-center gap-1.5">
                        {isPrimary && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono">
                            <Star className="h-2.5 w-2.5 fill-amber-400" /> Primary
                          </span>
                        )}
                        {isInstalled && !isPrimary && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono">
                            <Check className="h-2.5 w-2.5" /> Installed
                          </span>
                        )}
                        <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                          {app.category}
                        </span>
                      </div>
                    </div>

                    {/* App Title & Description */}
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                        <span>{app.name}</span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">{app.description}</p>
                    </div>

                    <div className="text-[11px] text-slate-500 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60 leading-relaxed">
                      {app.details}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    {isInstalled ? (
                      <>
                        <div className="flex items-center gap-1.5">
                          {!isPrimary && (
                            <button
                              type="button"
                              disabled={isLoading}
                              onClick={() => handleSetPrimaryClick(app.id)}
                              className="text-[11px] text-slate-400 hover:text-amber-300 font-semibold px-2 py-1 rounded-lg hover:bg-slate-800/60 transition-colors flex items-center gap-1 cursor-pointer"
                              title="Set as Default Primary App"
                            >
                              <Star className="h-3 w-3" />
                              <span>Set Primary</span>
                            </button>
                          )}
                        </div>

                        {!isPrimary && (
                          <button
                            type="button"
                            disabled={isLoading}
                            onClick={() => handleUninstallClick(app.id)}
                            className="text-[11px] text-rose-400 hover:text-rose-300 font-semibold px-2 py-1 rounded-lg hover:bg-rose-500/10 transition-colors flex items-center gap-1 cursor-pointer"
                            title="Remove from Workspace"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>Uninstall</span>
                          </button>
                        )}
                      </>
                    ) : (
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        disabled={isLoading}
                        onClick={() => handleInstallClick(app.id)}
                        className="w-full h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {isLoading ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <>
                            <Plus className="h-3.5 w-3.5" />
                            <span>Install App</span>
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredApps.length === 0 && (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <Search className="h-8 w-8 mx-auto text-slate-600" />
              <p className="text-sm font-semibold text-slate-300">No applications match your search</p>
              <p className="text-xs text-slate-500">Try searching for a different keyword or select another category</p>
            </div>
          )}
        </div>

        {/* Footer info banner */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>
              <strong>{installedProducts.length}</strong> of {APPS_LIST.length} applications active in your workspace.
            </span>
          </div>

          <Button type="button" variant="outline" size="sm" onClick={onClose} className="h-8 text-xs font-bold border-slate-700">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
