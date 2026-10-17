import * as React from 'react';
import {
  X,
  Plus,
  Store,
  Warehouse,
  Building2,
  Building,
  Check,
  Star,
  Trash2,
  Edit2,
  AlertTriangle,
  Loader2,
  Boxes,
  PackageCheck,
  ShieldAlert,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { toast } from 'sonner';
import {
  branchApi,
  type Branch,
  type BranchType,
  type BranchStatus,
  type CreateBranchPayload,
  type UpdateBranchPayload,
} from '../branches-api';
import { BranchCatalogModal } from './BranchCatalogModal';

interface BranchManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBranchId?: string;
  onSelectBranch?: (branch: Branch) => void;
  onBranchesUpdated?: () => void;
  onOpenAddWizard?: () => void;
}

export function BranchManagementModal({
  isOpen,
  onClose,
  currentBranchId,
  onSelectBranch,
  onBranchesUpdated,
  onOpenAddWizard,
}: BranchManagementModalProps) {
  const [mounted, setMounted] = React.useState(isOpen);
  const [animating, setAnimating] = React.useState(false);

  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);

  // Form View state: 'list' | 'create' | 'edit' | 'archive'
  const [view, setView] = React.useState<'list' | 'create' | 'edit' | 'archive'>('list');
  const [activeBranch, setActiveBranch] = React.useState<Branch | null>(null);
  const [catalogBranch, setCatalogBranch] = React.useState<Branch | null>(null);

  // Form fields
  const [name, setName] = React.useState('');
  const [code, setCode] = React.useState('');
  const [type, setType] = React.useState<BranchType>('store');
  const [status, setStatus] = React.useState<BranchStatus>('active');
  const [isPrimary, setIsPrimary] = React.useState(false);
  const [phone, setPhone] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [street, setStreet] = React.useState('');
  const [city, setCity] = React.useState('');
  const [state, setState] = React.useState('');
  const [country, setCountry] = React.useState('');
  const [postalCode, setPostalCode] = React.useState('');

  // Archive modal state
  const [archiveReason, setArchiveReason] = React.useState('');
  const [confirmWithStock, setConfirmWithStock] = React.useState(false);
  const [archiveError, setArchiveError] = React.useState<string | null>(null);

  // Fetch branches
  const fetchBranches = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await branchApi.getBranches({ includeDeleted: false });
      setBranches(res.branches || []);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load branches');
    } finally {
      setLoading(false);
    }
  }, []);

  // Manage enter/exit animation states
  React.useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isOpen) {
      setMounted(true);
      timer = setTimeout(() => {
        setAnimating(true);
      }, 20);
    } else {
      setAnimating(false);
      timer = setTimeout(() => {
        setMounted(false);
      }, 300);
    }
    return () => clearTimeout(timer);
  }, [isOpen]);

  const triggerClose = React.useCallback(() => {
    setAnimating(false);
    setTimeout(() => {
      onClose();
    }, 300);
  }, [onClose]);

  React.useEffect(() => {
    if (isOpen) {
      fetchBranches();
      setView('list');
      setActiveBranch(null);
    }
  }, [isOpen, fetchBranches]);

  const openCreateForm = () => {
    setName('');
    setCode('');
    setType('store');
    setStatus('active');
    setIsPrimary(branches.length === 0);
    setPhone('');
    setEmail('');
    setStreet('');
    setCity('');
    setState('');
    setCountry('');
    setPostalCode('');
    setView('create');
  };

  const openEditForm = (branch: Branch) => {
    setActiveBranch(branch);
    setName(branch.name);
    setCode(branch.code || '');
    setType(branch.type);
    setStatus(branch.status);
    setIsPrimary(branch.is_primary);
    setPhone(branch.phone || '');
    setEmail(branch.email || '');
    setStreet(branch.address?.street || '');
    setCity(branch.address?.city || '');
    setState(branch.address?.state || '');
    setCountry(branch.address?.country || '');
    setPostalCode(branch.address?.postalCode || '');
    setView('edit');
  };

  const openArchiveDialog = (branch: Branch) => {
    setActiveBranch(branch);
    setArchiveReason('');
    setConfirmWithStock(false);
    setArchiveError(null);
    setView('archive');
  };

  const handleSaveBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Branch name is required');
      return;
    }

    try {
      setSubmitting(true);
      const addressPayload =
        street || city || state || country || postalCode
          ? {
              street: street.trim() || undefined,
              city: city.trim() || undefined,
              state: state.trim() || undefined,
              country: country.trim() || undefined,
              postalCode: postalCode.trim() || undefined,
            }
          : undefined;

      if (view === 'create') {
        const payload: CreateBranchPayload = {
          name: name.trim(),
          code: code.trim().toUpperCase() || undefined,
          type,
          status,
          isPrimary,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          address: addressPayload,
        };
        const res = await branchApi.createBranch(payload);
        toast.success(`Branch "${res.branch.name}" created successfully`);
      } else if (view === 'edit' && activeBranch) {
        const payload: UpdateBranchPayload = {
          name: name.trim(),
          code: code.trim().toUpperCase() || null,
          type,
          status,
          isPrimary,
          phone: phone.trim() || null,
          email: email.trim() || null,
          address: addressPayload || null,
        };
        await branchApi.updateBranch(activeBranch.id, payload);
        toast.success(`Branch "${name.trim()}" updated successfully`);
      }

      await fetchBranches();
      onBranchesUpdated?.();
      setView('list');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save branch');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetPrimary = async (branch: Branch) => {
    if (branch.is_primary) return;
    try {
      setSubmitting(true);
      await branchApi.updateBranch(branch.id, { isPrimary: true });
      toast.success(`"${branch.name}" is now the primary branch`);
      await fetchBranches();
      onBranchesUpdated?.();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to set primary branch');
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchiveConfirm = async () => {
    if (!activeBranch) return;
    const hasStock = (activeBranch.total_on_hand ?? 0) > 0;

    if (hasStock && !confirmWithStock) {
      setArchiveError('You must confirm archiving this branch with units on hand.');
      return;
    }
    if (hasStock && !archiveReason.trim()) {
      setArchiveError('A reason is required when archiving a branch with stock on hand.');
      return;
    }

    try {
      setSubmitting(true);
      setArchiveError(null);
      await branchApi.deleteBranch(activeBranch.id, {
        confirmWithStock,
        reason: archiveReason.trim() || undefined,
      });
      toast.success(`Branch "${activeBranch.name}" archived successfully`);
      await fetchBranches();
      onBranchesUpdated?.();
      setView('list');
      setActiveBranch(null);
    } catch (err: any) {
      const msg = err?.message || 'Failed to archive branch';
      setArchiveError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const getBranchTypeIcon = (t: BranchType) => {
    switch (t) {
      case 'store':
        return <Store className="w-4 h-4 text-[#fbb945]" />;
      case 'warehouse':
        return <Warehouse className="w-4 h-4 text-emerald-400" />;
      case 'studio':
        return <Building className="w-4 h-4 text-cyan-400" />;
      case 'headquarters':
        return <Building2 className="w-4 h-4 text-purple-400" />;
      default:
        return <Store className="w-4 h-4 text-slate-400" />;
    }
  };

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" data-testid="branch-management-drawer">
      {/* Backdrop with fade in/out animation */}
      <div
        onClick={triggerClose}
        className={`fixed inset-0 bg-black/75 backdrop-blur-xs transition-opacity duration-300 ease-in-out cursor-pointer ${
          animating ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
      />

      {/* Slide-over Right Hand Panel (h-screen with slide animation) */}
      <aside
        className={`fixed inset-y-0 right-0 w-full max-w-xl h-screen bg-[#181a20] border-l border-[#2d3139] text-slate-100 shadow-2xl flex flex-col z-50 transform transition-transform duration-300 ease-out ${
          animating ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#2d3139] flex items-center justify-between bg-[#181a20] shrink-0">
          <div className="flex items-center gap-3">
            {view !== 'list' && (
              <button
                type="button"
                onClick={() => setView('list')}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/5 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="w-8 h-8 rounded bg-[#985184]/20 border border-[#985184]/30 flex items-center justify-center text-[#985184]">
              <Store className="w-4 h-4 text-[#fbb945]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                {view === 'list' && 'Branch Management Hub'}
                {view === 'create' && 'Add New Branch'}
                {view === 'edit' && `Edit: ${activeBranch?.name}`}
                {view === 'archive' && `Archive Branch: ${activeBranch?.name}`}
              </h2>
              <p className="text-xs text-slate-400">
                {view === 'list' && 'Manage multiple retail stores, warehouses, and fulfillment locations.'}
                {view === 'create' && 'Set up a new operational location for your organization.'}
                {view === 'edit' && 'Update branch contact details, operational type, and primary status.'}
                {view === 'archive' && 'Safely retire an inactive branch while preserving inventory records.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={triggerClose}
            className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-white/5 cursor-pointer"
            data-testid="branch-drawer-close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 text-slate-200 bg-[#141519]">
          {/* ================= VIEW: LIST ================= */}
          {view === 'list' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-1">
                <div className="text-xs text-slate-400">
                  {branches.length} {branches.length === 1 ? 'Location' : 'Locations'} configured
                </div>
                <Button
                  size="sm"
                  onClick={onOpenAddWizard || openCreateForm}
                  className="bg-[#985184] hover:bg-[#854372] text-white text-xs h-8 px-3 rounded-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Branch</span>
                </Button>
              </div>

              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-[#fbb945]" />
                  <span className="text-xs">Loading branches...</span>
                </div>
              ) : branches.length === 0 ? (
                <div className="py-10 text-center space-y-3 bg-[#141519] border border-[#2d3139] rounded-lg p-6">
                  <Store className="w-8 h-8 text-slate-500 mx-auto" />
                  <p className="text-sm text-slate-300 font-medium">No branches configured yet</p>
                  <Button
                    size="sm"
                    onClick={onOpenAddWizard || openCreateForm}
                    className="bg-[#985184] hover:bg-[#854372] text-white text-xs cursor-pointer"
                  >
                    Create First Branch
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {branches.map((b) => {
                    const isCurrent = b.id === currentBranchId;
                    return (
                      <div
                        key={b.id}
                        className={`p-4 rounded-lg border transition-all ${
                          isCurrent
                            ? 'bg-[#252830]/80 border-[#985184]/50 ring-1 ring-[#985184]/30'
                            : 'bg-[#141519] border-[#2d3139] hover:border-[#3d424e]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-md bg-[#252830] border border-[#363a45] flex items-center justify-center shrink-0 mt-0.5">
                              {getBranchTypeIcon(b.type)}
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-sm text-white">{b.name}</span>
                                {b.code && (
                                  <Badge
                                    variant="outline"
                                    className="bg-[#181a20] border-[#363a45] text-slate-300 font-mono text-[10px] px-1.5 py-0"
                                  >
                                    {b.code}
                                  </Badge>
                                )}
                                {b.is_primary && (
                                  <Badge
                                    variant="outline"
                                    className="bg-[#fbb945]/15 border-[#fbb945]/40 text-[#fbb945] font-semibold text-[10px] flex items-center gap-1 px-1.5 py-0"
                                  >
                                    <Star className="w-2.5 h-2.5 fill-[#fbb945]" />
                                    Primary
                                  </Badge>
                                )}
                                <span
                                  className={`text-[10px] px-1.5 py-0.5 rounded capitalize ${
                                    b.status === 'active'
                                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                      : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                                  }`}
                                >
                                  {b.status}
                                </span>
                              </div>

                              <div className="flex items-center gap-4 text-xs text-slate-400 pt-1">
                                <span className="flex items-center gap-1.5">
                                  <Boxes className="w-3.5 h-3.5 text-slate-400" />
                                  <span>{b.total_products ?? 0} SKUs</span>
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <PackageCheck className="w-3.5 h-3.5 text-slate-400" />
                                  <span>{b.total_on_hand ?? 0} on hand</span>
                                </span>
                                {(b.total_reserved ?? 0) > 0 && (
                                  <span className="text-[#fbb945] font-medium">
                                    {b.total_reserved} reserved
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Quick Actions */}
                          <div className="flex items-center gap-2 shrink-0">
                            {!b.is_primary && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSetPrimary(b)}
                                disabled={submitting}
                                className="h-7 px-2 text-[11px] border-[#2d3139] bg-[#181a20] text-slate-300 hover:text-white hover:bg-[#252830]"
                                title="Make Primary Branch"
                              >
                                Set Primary
                              </Button>
                            )}

                            {onSelectBranch && !isCurrent && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  onSelectBranch(b);
                                  triggerClose();
                                }}
                                className="h-7 px-2 text-[11px] border-[#985184]/40 bg-[#985184]/10 text-white hover:bg-[#985184]/20"
                              >
                                Switch
                              </Button>
                            )}

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setCatalogBranch(b)}
                              className="h-7 px-2 text-[11px] border-[#2d3139] bg-[#181a20] text-[#fbb945] hover:text-white hover:bg-[#252830]"
                              title="Manage Branch Catalog"
                            >
                              Catalog
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEditForm(b)}
                              className="h-7 w-7 p-0 text-slate-400 hover:text-white hover:bg-[#252830]"
                              title="Edit Branch"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>

                            {!b.is_primary && branches.length > 1 && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openArchiveDialog(b)}
                                className="h-7 w-7 p-0 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
                                title="Archive Branch"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ================= VIEW: CREATE OR EDIT FORM ================= */}
          {(view === 'create' || view === 'edit') && (
            <form onSubmit={handleSaveBranch} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-300">
                    Branch Name <span className="text-[#fbb945]">*</span>
                  </label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Victoria Island Flagship, Lagos Hub"
                    required
                    className="bg-[#141519] border-[#2d3139] text-white text-xs h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Branch Code
                  </label>
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="e.g. VI-01"
                    className="bg-[#141519] border-[#2d3139] text-white text-xs font-mono h-9 uppercase"
                  />
                  <span className="text-[10px] text-slate-400">Short identifier for receipts and barcodes</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Branch Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as BranchType)}
                    className="w-full bg-[#141519] border border-[#2d3139] rounded-md text-white text-xs h-9 px-2.5 focus:outline-hidden focus:border-[#985184]"
                  >
                    <option value="store">Store (Retail POS)</option>
                    <option value="warehouse">Warehouse (Fulfillment)</option>
                    <option value="studio">Studio (Showroom)</option>
                    <option value="headquarters">Headquarters</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as BranchStatus)}
                    className="w-full bg-[#141519] border border-[#2d3139] rounded-md text-white text-xs h-9 px-2.5 focus:outline-hidden focus:border-[#985184]"
                  >
                    <option value="active">Active (Open for business)</option>
                    <option value="inactive">Inactive (Temporarily closed)</option>
                  </select>
                </div>

                <div className="space-y-1.5 flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isPrimary}
                      onChange={(e) => setIsPrimary(e.target.checked)}
                      disabled={view === 'edit' && activeBranch?.is_primary}
                      className="rounded border-[#2d3139] bg-[#141519] text-[#985184] focus:ring-[#985184] h-4 w-4"
                    />
                    <span className="text-xs font-medium text-slate-200">Set as Primary Branch</span>
                  </label>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Phone</label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+234 800 000 0000"
                    className="bg-[#141519] border-[#2d3139] text-white text-xs h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Email</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="branch@orvio.app"
                    className="bg-[#141519] border-[#2d3139] text-white text-xs h-9"
                  />
                </div>

                {/* Address Section */}
                <div className="sm:col-span-2 pt-2 border-t border-[#2d3139]/60">
                  <div className="text-xs font-semibold text-slate-300 mb-2">Location Address</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <Input
                        value={street}
                        onChange={(e) => setStreet(e.target.value)}
                        placeholder="Street Address"
                        className="bg-[#141519] border-[#2d3139] text-white text-xs h-9"
                      />
                    </div>
                    <div>
                      <Input
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="City"
                        className="bg-[#141519] border-[#2d3139] text-white text-xs h-9"
                      />
                    </div>
                    <div>
                      <Input
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        placeholder="State / Province"
                        className="bg-[#141519] border-[#2d3139] text-white text-xs h-9"
                      />
                    </div>
                    <div>
                      <Input
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        placeholder="Country"
                        className="bg-[#141519] border-[#2d3139] text-white text-xs h-9"
                      />
                    </div>
                    <div>
                      <Input
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value)}
                        placeholder="Postal / ZIP Code"
                        className="bg-[#141519] border-[#2d3139] text-white text-xs h-9"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#2d3139]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setView('list')}
                  className="border-[#2d3139] bg-[#141519] text-slate-300 hover:text-white text-xs h-9"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#985184] hover:bg-[#854372] text-white text-xs h-9 px-4 flex items-center gap-1.5"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{view === 'create' ? 'Create Branch' : 'Save Changes'}</span>
                </Button>
              </div>
            </form>
          )}

          {/* ================= VIEW: ARCHIVE CONFIRMATION ================= */}
          {view === 'archive' && activeBranch && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-200 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-sm text-rose-300">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  <span>Archive Branch "{activeBranch.name}"</span>
                </div>
                <p className="text-xs text-rose-200/90 leading-relaxed">
                  Archiving removes this branch from active selection across your POS, checkout, and inventory views.
                </p>
              </div>

              {/* Check reserved stock */}
              {(activeBranch.total_reserved ?? 0) > 0 ? (
                <div className="p-4 rounded-lg bg-[#252830] border border-amber-500/30 text-amber-200 text-xs space-y-1.5">
                  <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span>Active Reserved Orders Detected</span>
                  </div>
                  <p>
                    This branch currently has{' '}
                    <span className="font-bold text-white">{activeBranch.total_reserved} units</span> reserved in
                    pending customer orders. You must fulfill or cancel these orders before this branch can be archived.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(activeBranch.total_on_hand ?? 0) > 0 && (
                    <div className="p-3.5 rounded-lg bg-[#252830] border border-[#3d424e] space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Total Stock On Hand</span>
                        <span className="font-bold text-[#fbb945]">{activeBranch.total_on_hand} units</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Stock records will be preserved in frozen state and will not count towards active totals. If you restore this branch later, the stock counts will be restored.
                      </p>

                      <label className="flex items-start gap-2 pt-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={confirmWithStock}
                          onChange={(e) => setConfirmWithStock(e.target.checked)}
                          className="mt-0.5 rounded border-[#2d3139] bg-[#141519] text-[#985184] focus:ring-[#985184] h-4 w-4"
                        />
                        <span className="text-xs text-slate-200 font-medium">
                          I confirm archiving this branch with {activeBranch.total_on_hand} units on hand
                        </span>
                      </label>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">
                      Reason for Archiving {(activeBranch.total_on_hand ?? 0) > 0 && <span className="text-[#fbb945]">*</span>}
                    </label>
                    <textarea
                      value={archiveReason}
                      onChange={(e) => setArchiveReason(e.target.value)}
                      placeholder="e.g. Store lease ended, consolidating into Main Warehouse"
                      rows={3}
                      className="w-full bg-[#141519] border border-[#2d3139] rounded-md text-white text-xs p-2.5 focus:outline-hidden focus:border-[#985184]"
                    />
                  </div>

                  {archiveError && (
                    <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded">
                      {archiveError}
                    </div>
                  )}
                </div>
              )}

              {/* Archive Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#2d3139]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setView('list')}
                  className="border-[#2d3139] bg-[#141519] text-slate-300 hover:text-white text-xs h-9"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleArchiveConfirm}
                  disabled={submitting || (activeBranch.total_reserved ?? 0) > 0}
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs h-9 px-4 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Archive Branch</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {catalogBranch && (
        <BranchCatalogModal
          isOpen={Boolean(catalogBranch)}
          onClose={() => setCatalogBranch(null)}
          branch={catalogBranch}
          branches={branches}
          onCatalogUpdated={fetchBranches}
        />
      )}
    </div>
  );
}
