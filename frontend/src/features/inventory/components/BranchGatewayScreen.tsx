import * as React from 'react';
import {
  Store,
  Warehouse,
  Building2,
  Building,
  Plus,
  ArrowRight,
  Search,
  ArrowLeft,
  Sparkles,
  Layers,
  Package,
  Boxes,
  MapPin,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Link } from 'react-router-dom';
import { SeoHead } from '../../../components/seo/SeoHead';
import type { Branch, BranchType } from '../branches-api';

export interface BranchGatewayScreenProps {
  organization: {
    id?: string;
    name: string;
    subdomain?: string;
    currency?: string;
  };
  branches: Array<Branch | {
    id: string;
    name: string;
    code?: string | null;
    type: string;
    is_primary?: boolean;
    address?: any;
    total_products?: number;
    total_on_hand?: number;
  }>;
  onSelectBranch: (branchId: string) => void;
  onOpenAddBranch: () => void;
}

function getBranchIcon(type: string) {
  switch (type.toLowerCase()) {
    case 'warehouse':
      return <Warehouse className="w-5 h-5 text-amber-400" />;
    case 'headquarters':
      return <Building2 className="w-5 h-5 text-indigo-400" />;
    case 'studio':
      return <Building className="w-5 h-5 text-teal-400" />;
    case 'store':
    default:
      return <Store className="w-5 h-5 text-[#fbb945]" />;
  }
}

export function BranchGatewayScreen({
  organization,
  branches,
  onSelectBranch,
  onOpenAddBranch,
}: BranchGatewayScreenProps) {
  const [search, setSearch] = React.useState('');

  const filteredBranches = React.useMemo(() => {
    if (!search.trim()) return branches;
    const q = search.toLowerCase().trim();
    return branches.filter((b) =>
      b.name.toLowerCase().includes(q) ||
      (b.code && b.code.toLowerCase().includes(q)) ||
      (b.type && b.type.toLowerCase().includes(q))
    );
  }, [branches, search]);

  return (
    <div
      className="min-h-screen bg-[#111215] text-slate-100 flex flex-col relative overflow-hidden font-sans selection:bg-[#985184] selection:text-white"
      style={{
        backgroundImage: 'radial-gradient(circle, rgba(255, 255, 255, 0.06) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
    >
      <SeoHead
        title={`Select Branch Workspace — ${organization.name}`}
        description="Select an active branch to enter dedicated inventory workspace."
      />

      {/* Ambient Glows */}
      <div className="fixed top-12 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-[#985184]/15 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="fixed -bottom-20 right-10 w-[400px] h-[300px] bg-[#fbb945]/10 rounded-full blur-[120px] pointer-events-none -z-10" />

      {/* Top Navigation Bar */}
      <header className="w-full border-b border-white/10 bg-[#16181d]/60 backdrop-blur-md px-6 py-4 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Launchpad</span>
          </Link>
          <span className="text-slate-600">/</span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-white">{organization.name}</span>
            <Badge className="border-white/10 bg-white/5 text-[10px] text-[#fbb945] font-mono">
              Multi-Branch Gateway
            </Badge>
          </div>
        </div>

        <Button
          onClick={onOpenAddBranch}
          size="sm"
          className="bg-[#985184] hover:bg-[#854372] text-white text-xs h-8 rounded-sm font-semibold cursor-pointer shadow-md shadow-[#985184]/20"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Add Branch
        </Button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 z-10 flex flex-col">
        {/* Hero Section */}
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#985184]/15 border border-[#985184]/30 text-[#fbb945] mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            Branch Isolation & Switching
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Select Your Branch Workspace
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed">
            Each branch operates with isolated category hierarchies, brand catalogs, stock levels, and audit histories.
            Choose a location below to begin.
          </p>

          {/* Search Box */}
          <div className="mt-6 relative max-w-md mx-auto">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              placeholder="Search branches by name, code, or type..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 border-white/10 bg-[#16181d]/80 text-xs sm:text-sm text-white placeholder:text-slate-500 rounded-lg focus:border-[#985184]"
            />
          </div>
        </div>

        {/* Branch Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredBranches.map((b) => {
            const address = typeof b.address === 'object' && b.address ? b.address : null;
            const addressText = [address?.city, address?.state, address?.country].filter(Boolean).join(', ');

            return (
              <div
                key={b.id}
                onClick={() => onSelectBranch(b.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    onSelectBranch(b.id);
                  }
                }}
                className="group relative flex flex-col justify-between p-5 rounded-xl border border-white/10 bg-[#16181d]/70 hover:bg-[#1c1f26] hover:border-[#985184]/60 transition-all duration-200 cursor-pointer shadow-lg hover:shadow-[#985184]/15"
              >
                {/* Glow accent bar on hover */}
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-[#985184] to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-t-xl" />

                <div>
                  {/* Top card bar: Icon + Badges */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-[#985184]/15 group-hover:border-[#985184]/40 transition-colors">
                      {getBranchIcon(b.type || 'store')}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 justify-end">
                      {b.is_primary && (
                        <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-300 text-[10px] font-semibold">
                          Primary
                        </Badge>
                      )}
                      <Badge className="border-white/10 bg-white/5 text-slate-300 text-[10px] capitalize font-mono">
                        {b.type || 'store'}
                      </Badge>
                    </div>
                  </div>

                  {/* Branch Title & Code */}
                  <h3 className="text-base font-bold text-white group-hover:text-[#fbb945] transition-colors flex items-center gap-2">
                    {b.name}
                  </h3>
                  {b.code && (
                    <span className="text-[11px] font-mono text-slate-400 mt-0.5 block">
                      Code: {b.code}
                    </span>
                  )}

                  {/* Address Snippet */}
                  {addressText && (
                    <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-400">
                      <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                      <span className="truncate">{addressText}</span>
                    </div>
                  )}
                </div>

                {/* Card Footer: Metrics & Action */}
                <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
                    <div className="flex items-center gap-1">
                      <Package className="w-3.5 h-3.5 text-[#985184]" />
                      <span>{b.total_products ?? 0} prods</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Boxes className="w-3.5 h-3.5 text-[#fbb945]" />
                      <span>{b.total_on_hand ?? 0} in stock</span>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#fbb945] group-hover:translate-x-1 transition-transform">
                    Enter
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}

          {/* Special "Global / All Branches" Card */}
          <div
            onClick={() => onSelectBranch('all')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                onSelectBranch('all');
              }
            }}
            className="group relative flex flex-col justify-between p-5 rounded-xl border border-dashed border-white/20 bg-white/[0.02] hover:bg-white/[0.05] hover:border-[#985184]/50 transition-all cursor-pointer"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="w-10 h-10 rounded-lg bg-[#985184]/10 border border-[#985184]/20 flex items-center justify-center">
                  <Layers className="w-5 h-5 text-[#985184]" />
                </div>
                <Badge className="border-white/10 bg-white/5 text-[10px] text-slate-300">
                  Unified
                </Badge>
              </div>

              <h3 className="text-base font-bold text-white group-hover:text-[#fbb945] transition-colors">
                All Branches (Overview)
              </h3>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                Consolidated view across all {branches.length} locations. Ideal for organization administrators.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-xs font-semibold text-slate-300 group-hover:text-white">
              <span>View Global Catalog</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform text-[#985184]" />
            </div>
          </div>

          {/* Quick Create Card */}
          <div
            onClick={onOpenAddBranch}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                onOpenAddBranch();
              }
            }}
            className="group flex flex-col items-center justify-center p-6 rounded-xl border border-dashed border-white/20 bg-white/[0.01] hover:bg-[#985184]/5 hover:border-[#985184]/40 transition-all cursor-pointer text-center min-h-[160px]"
          >
            <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 group-hover:text-[#fbb945] group-hover:border-[#985184]/40 transition-colors mb-2">
              <Plus className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-white group-hover:text-[#fbb945] transition-colors">
              Add New Branch Location
            </span>
            <span className="text-[11px] text-slate-400 mt-0.5">
              Set up store, warehouse, studio or clone catalog
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
