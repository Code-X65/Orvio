import * as React from 'react';
import {
  Store,
  Warehouse,
  Building,
  Building2,
  Package,
  Check,
  ArrowRight,
  ArrowLeft,
  Mail,
  Phone,
  Lock,
  Rocket,
  Sparkles,
  Loader2,
  X,
  Star,
  MapPin,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { toast } from 'sonner';
import { useFormDraft } from '../../../hooks/useFormDraft';
import {
  branchApi,
  type Branch,
  type BranchType,
  type CreateBranchPayload,
} from '../branches-api';
import { categoryApi } from '../categories-api';
import { brandApi } from '../brands-api';
import { productApi } from '../products-api';
import {
  Layers,
  CheckSquare,
  Copy,
} from 'lucide-react';

const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT - Abuja', 'Gombe',
  'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos',
  'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto',
  'Taraba', 'Yobe', 'Zamfara',
];

export const BRANCH_OPERATIONAL_ROLES = [
  {
    id: 'store' as BranchType,
    label: 'Retail Store & Point-of-Sale',
    desc: 'Daily walk-in shoppers, cashier registers, barcode scanners & instant checkout',
    icon: Store,
    badge: 'Walk-in & POS',
  },
  {
    id: 'warehouse' as BranchType,
    label: 'Warehouse & Bulk Storage',
    desc: 'Pallet racking, B2B wholesale dispatch, freight receiving & regional fulfillment',
    icon: Warehouse,
    badge: 'Logistics & Dispatch',
  },
  {
    id: 'studio' as BranchType,
    label: 'Studio & Brand Showroom',
    desc: 'Sample displays, private consultations, appointment fittings & curated inventory',
    icon: Building,
    badge: 'Showroom & Studio',
  },
  {
    id: 'headquarters' as BranchType,
    label: 'Regional Headquarters & Hub',
    desc: 'Central operations center, admin management & multi-channel inventory routing',
    icon: Building2,
    badge: 'Executive Hub',
  },
];

interface AddBranchWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  organization: {
    id?: string;
    name: string;
    subdomain: string;
    currency?: string;
    businessEmail?: string | null;
    phone?: string | null;
  };
  branches?: Array<{
    id: string;
    name: string;
    code?: string | null;
    type?: string;
    is_primary?: boolean;
  }>;
  onBranchCreated: (branch: Branch) => void;
}

export function AddBranchWizardModal({
  isOpen,
  onClose,
  organization,
  branches = [],
  onBranchCreated,
}: AddBranchWizardModalProps) {
  const draftKey = `branch_wizard_${organization.id || organization.subdomain}`;
  const { draft, saveDraft, clearDraft, hasDraft } = useFormDraft<{
    currentStep?: number;
    branchType?: BranchType;
    branchName?: string;
    branchCode?: string;
    isPrimary?: boolean;
    useOrgEmail?: boolean;
    customEmail?: string;
    useOrgPhone?: boolean;
    customPhone?: string;
    state?: string;
    city?: string;
    streetAddress?: string;
    area?: string;
    catalogMode?: 'empty' | 'clone_all' | 'selective';
  }>(draftKey, {});

  // Step state (1: Role, 2: Identity, 3: Location, 4: Catalog Setup)
  const [currentStep, setCurrentStep] = React.useState<number>(1);

  // Step 1: Operational Role
  const [branchType, setBranchType] = React.useState<BranchType>('store');

  // Step 2: Branch Identity & Contact
  const [branchName, setBranchName] = React.useState<string>('');
  const [branchCode, setBranchCode] = React.useState<string>('');
  const [isPrimary, setIsPrimary] = React.useState<boolean>(false);
  const [useOrgEmail, setUseOrgEmail] = React.useState<boolean>(true);
  const [customEmail, setCustomEmail] = React.useState<string>('');
  const [useOrgPhone, setUseOrgPhone] = React.useState<boolean>(true);
  const [customPhone, setCustomPhone] = React.useState<string>('');

  // Step 3: Physical Location
  const country = 'Nigeria';
  const [state, setState] = React.useState<string>('Lagos');
  const [city, setCity] = React.useState<string>('');
  const [streetAddress, setStreetAddress] = React.useState<string>('');
  const [area, setArea] = React.useState<string>('');

  const [catalogMode, setCatalogMode] = React.useState<'empty' | 'clone_all' | 'selective'>('empty');
  const [sourceBranches, setSourceBranches] = React.useState<Array<{ id: string; name: string; code?: string | null; type?: string; is_primary?: boolean }>>(branches);
  const [selectedSourceBranchId, setSelectedSourceBranchId] = React.useState<string>('');
  const [copyStock, setCopyStock] = React.useState<boolean>(false);
  const [importTaxonomy, setImportTaxonomy] = React.useState<boolean>(true);

  // Selective items state
  const [availableCategories, setAvailableCategories] = React.useState<Array<{ id: string; name: string }>>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = React.useState<string[]>([]);
  const [availableBrands, setAvailableBrands] = React.useState<Array<{ id: string; name: string }>>([]);
  const [selectedBrandIds, setSelectedBrandIds] = React.useState<string[]>([]);
  const [availableProducts, setAvailableProducts] = React.useState<Array<{ id: string; name: string; sku: string }>>([]);
  const [selectedProductIds, setSelectedProductIds] = React.useState<string[]>([]);
  const [isLoadingCatalogData, setIsLoadingCatalogData] = React.useState(false);

  // Submission & Celebration state
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);
  const [createdBranch, setCreatedBranch] = React.useState<Branch | null>(null);

  // Load existing branches if not passed in props
  React.useEffect(() => {
    if (isOpen) {
      if (branches && branches.length > 0) {
        setSourceBranches(branches);
        setSelectedSourceBranchId(branches[0].id);
      } else if (typeof branchApi.getBranches === 'function') {
        branchApi.getBranches({ activeOnly: true })?.then((res) => {
          const list = (res as any)?.branches || res?.branches || [];
          setSourceBranches(list);
          if (list.length > 0) {
            setSelectedSourceBranchId(list[0].id);
          }
        }).catch(() => {});
      }
    }
  }, [isOpen, branches]);

  // Load catalog items for selective import when source branch changes
  React.useEffect(() => {
    if (currentStep === 4 && catalogMode === 'selective' && selectedSourceBranchId) {
      let isMounted = true;
      setIsLoadingCatalogData(true);
      Promise.all([
        categoryApi.getCategories({ branchId: selectedSourceBranchId }),
        brandApi.getBrands({ branchId: selectedSourceBranchId, limit: 100 }),
        productApi.getProducts({ branchId: selectedSourceBranchId, limit: 100 }),
      ]).then(([catRes, brandRes, prodRes]) => {
        if (!isMounted) return;
        const cats = (catRes as any)?.data?.categories || catRes?.categories || [];
        const flatCats: Array<{ id: string; name: string }> = [];
        const flatten = (items: any[]) => {
          for (const item of items) {
            flatCats.push({ id: item.id, name: item.name });
            if (item.children) flatten(item.children);
          }
        };
        flatten(cats);
        setAvailableCategories(flatCats);
        setSelectedCategoryIds(flatCats.map((c) => c.id));

        const brandsList = (brandRes as any)?.brands || brandRes?.brands || [];
        setAvailableBrands(brandsList);
        setSelectedBrandIds(brandsList.map((b: any) => b.id));

        const prodsList = (prodRes as any)?.products || prodRes?.products || [];
        setAvailableProducts(prodsList);
        setSelectedProductIds(prodsList.map((p: any) => p.id));
      }).catch(() => {
        // silent fail fallback
      }).finally(() => {
        if (isMounted) setIsLoadingCatalogData(false);
      });

      return () => { isMounted = false; };
    }
  }, [currentStep, catalogMode, selectedSourceBranchId]);

  // Reset wizard when modal opens, or restore draft
  React.useEffect(() => {
    if (isOpen) {
      if (hasDraft && draft) {
        setCurrentStep(draft.currentStep || 1);
        setBranchType(draft.branchType || 'store');
        setBranchName(draft.branchName || '');
        setBranchCode(draft.branchCode || '');
        setIsPrimary(draft.isPrimary || false);
        setUseOrgEmail(draft.useOrgEmail ?? true);
        setCustomEmail(draft.customEmail || '');
        setUseOrgPhone(draft.useOrgPhone ?? true);
        setCustomPhone(draft.customPhone || '');
        setState(draft.state || 'Lagos');
        setCity(draft.city || '');
        setStreetAddress(draft.streetAddress || '');
        setArea(draft.area || '');
        setCatalogMode(draft.catalogMode || 'empty');
        setCopyStock(false);
        setIsSubmitting(false);
        setCreatedBranch(null);
      } else {
        setCurrentStep(1);
        setBranchType('store');
        setBranchName('');
        setBranchCode('');
        setIsPrimary(false);
        setUseOrgEmail(true);
        setCustomEmail('');
        setUseOrgPhone(true);
        setCustomPhone('');
        setState('Lagos');
        setCity('');
        setStreetAddress('');
        setArea('');
        setCatalogMode('empty');
        setCopyStock(false);
        setIsSubmitting(false);
        setCreatedBranch(null);
      }
    }
  }, [isOpen]);

  // Auto-save unsubmitted wizard progress
  React.useEffect(() => {
    if (isOpen && (branchName || branchCode || customEmail || customPhone || city || streetAddress || area)) {
      saveDraft({
        currentStep,
        branchType,
        branchName,
        branchCode,
        isPrimary,
        useOrgEmail,
        customEmail,
        useOrgPhone,
        customPhone,
        state,
        city,
        streetAddress,
        area,
        catalogMode,
      });
    }
  }, [
    isOpen,
    currentStep,
    branchType,
    branchName,
    branchCode,
    isPrimary,
    useOrgEmail,
    customEmail,
    useOrgPhone,
    customPhone,
    state,
    city,
    streetAddress,
    area,
    catalogMode,
    saveDraft,
  ]);

  const defaultEmail = organization.businessEmail || '';
  const defaultPhone = organization.phone || '';

  const handleStep1Next = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentStep(2);
  };

  const handleStep2Next = (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchName.trim()) {
      toast.error('Branch name is required.');
      return;
    }
    if (!branchCode.trim()) {
      toast.error('Branch code / abbreviation is required.');
      return;
    }
    setCurrentStep(3);
  };

  const handleStep3Next = (e: React.FormEvent) => {
    e.preventDefault();
    if (!streetAddress.trim()) {
      toast.error('Street address is required.');
      return;
    }
    if (!city.trim()) {
      toast.error('City / LGA is required.');
      return;
    }

    if (sourceBranches.length > 0) {
      setCurrentStep(4);
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!streetAddress.trim()) {
      toast.error('Street address is required.');
      return;
    }
    if (!city.trim()) {
      toast.error('City / LGA is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const finalEmail = useOrgEmail ? defaultEmail : customEmail;
      const finalPhone = useOrgPhone ? defaultPhone : customPhone;

      const payload: CreateBranchPayload = {
        name: branchName.trim(),
        code: branchCode.trim().toUpperCase(),
        type: branchType,
        status: 'active',
        isPrimary,
        email: finalEmail.trim() || undefined,
        phone: finalPhone.trim() || undefined,
        address: {
          country,
          state,
          city: city.trim(),
          street: streetAddress.trim(),
          postalCode: area.trim() || undefined,
        },
        catalogSetup: sourceBranches.length > 0 && catalogMode !== 'empty' ? {
          mode: catalogMode,
          sourceBranchId: selectedSourceBranchId || undefined,
          categoryIds: catalogMode === 'selective' ? selectedCategoryIds : undefined,
          brandIds: catalogMode === 'selective' ? selectedBrandIds : undefined,
          productIds: catalogMode === 'selective' ? selectedProductIds : undefined,
          copyStock,
          importTaxonomy,
        } : { mode: 'empty' },
      };

      const res = await branchApi.createBranch(payload);
      clearDraft();
      setCreatedBranch(res.branch);
      toast.success(`Branch "${res.branch.name}" is now live!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create branch';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteAndSwitch = () => {
    if (createdBranch) {
      onBranchCreated(createdBranch);
      onClose();
    }
  };

  if (!isOpen) return null;

  const steps = sourceBranches.length > 0 ? [
    { num: 1, title: 'Operational Role', desc: 'Store, Warehouse, Studio' },
    { num: 2, title: 'Identity & Code', desc: 'Naming & Contact' },
    { num: 3, title: 'Physical Location', desc: 'Nigeria Address' },
    { num: 4, title: 'Catalog Setup', desc: 'Clone or Fresh' },
  ] : [
    { num: 1, title: 'Operational Role', desc: 'Store, Warehouse, Studio' },
    { num: 2, title: 'Identity & Code', desc: 'Naming & Contact' },
    { num: 3, title: 'Physical Location', desc: 'Nigeria Address' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-150 overflow-y-auto">
      {/* Wizard Dialog Container with Ambient Styling */}
      <div
        className="w-full max-w-3xl bg-[#111215] text-slate-100 rounded-lg border border-white/10 shadow-2xl relative overflow-hidden font-sans my-auto selection:bg-[#985184] selection:text-white"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255, 255, 255, 0.06) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      >
        {/* Subtle Ambient Glow with #985184 */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[250px] bg-[#985184]/15 rounded-full blur-[120px] pointer-events-none -z-10" />

        {/* Modal Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 text-slate-400 hover:text-white rounded-md hover:bg-white/5 transition-colors cursor-pointer"
          title="Close Wizard"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Content Container */}
        <div className="p-6 sm:p-10 relative z-10">
          {/* ================= CELEBRATION SCREEN ================= */}
          {createdBranch ? (
            <div className="text-center py-6 sm:py-10 space-y-6 max-w-lg mx-auto">
              <div className="relative inline-block">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#fbb945]/15 border border-[#fbb945]/30 flex items-center justify-center mx-auto text-[#fbb945] animate-bounce duration-1000">
                  <Rocket className="w-8 h-8 sm:w-10 sm:h-10 text-[#fbb945]" />
                </div>
                <div className="absolute -top-1 -right-1 bg-[#985184] text-white p-1 rounded-full shadow-lg">
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>

              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-[#fbb945] bg-[#fbb945]/10 px-2.5 py-1 rounded-full border border-[#fbb945]/20">
                  New Location Configured
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-3">
                  {createdBranch.name} is Live!
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
                  Branch stock isolation, checkout registers, and fulfillment routing are now active for this location.
                </p>
              </div>

              {/* Branch Summary Card */}
              <div className="bg-[#181a20] border border-[#2d3139] p-4 rounded-md text-left space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Branch Code</span>
                  <span className="font-mono font-bold text-white uppercase">{createdBranch.code || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Operational Role</span>
                  <span className="capitalize text-slate-200">{createdBranch.type}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Primary Status</span>
                  <span className="text-[#fbb945] font-semibold">{createdBranch.is_primary ? 'Primary Branch' : 'Secondary Branch'}</span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-white/5">
                  <span className="text-slate-400">Location</span>
                  <span className="text-slate-200">
                    {createdBranch.address?.city || 'City'}, {createdBranch.address?.state || 'Nigeria'}
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  onClick={handleCompleteAndSwitch}
                  className="w-full bg-[#985184] hover:bg-[#854372] text-white font-semibold h-11 text-sm rounded-sm shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Open {createdBranch.name} Workspace</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Header Title */}
              <div className="text-center mb-6 sm:mb-8">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 text-slate-400 text-xs font-mono mb-2">
                  <Package className="w-3.5 h-3.5 text-[#fbb945]" />
                  <span>Add Branch • Step {currentStep} of 3</span>
                  {hasDraft && (
                    <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-400 text-[10px] py-0 px-2 font-normal ml-2">
                      Draft Restored
                    </Badge>
                  )}
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                  {currentStep === 1 && 'What is the role of this new location?'}
                  {currentStep === 2 && 'Branch branding & contact points'}
                  {currentStep === 3 && 'Where is this branch located?'}
                </h1>
                <p className="mt-1.5 text-xs sm:text-sm text-slate-400 max-w-lg mx-auto">
                  {currentStep === 1 &&
                    `Define whether this location operates as a retail counter, fulfillment warehouse, or regional studio for ${organization.name}.`}
                  {currentStep === 2 &&
                    'Establish branch code abbreviations, register identifiers, and operational phone/email.'}
                  {currentStep === 3 &&
                    'Specify physical store or warehouse address for dispatch, audits, and logistics.'}
                </p>
              </div>

              {/* Minimal Step Indicator Bar */}
              <div className="mb-8 grid grid-cols-3 gap-3 border-b border-white/10 pb-4">
                {steps.map((step) => {
                  const isActive = currentStep === step.num;
                  const isDone = currentStep > step.num;

                  return (
                    <div
                      key={step.num}
                      className="flex items-center gap-2 sm:gap-2.5 cursor-default select-none"
                    >
                      <div
                        className={`w-5 h-5 rounded-sm flex items-center justify-center text-[11px] font-bold shrink-0 transition-colors ${
                          isDone
                            ? 'bg-[#fbb945] text-[#111215]'
                            : isActive
                            ? 'bg-[#985184] text-white shadow-sm'
                            : 'bg-white/10 text-slate-400'
                        }`}
                      >
                        {isDone ? <Check className="w-3 h-3" /> : step.num}
                      </div>
                      <div className="min-w-0">
                        <div
                          className={`text-xs font-bold truncate ${
                            isActive ? 'text-white' : isDone ? 'text-slate-300' : 'text-slate-500'
                          }`}
                        >
                          {step.title}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate hidden sm:block">{step.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* STEP 1: OPERATIONAL ROLE */}
              {currentStep === 1 && (
                <form onSubmit={handleStep1Next} className="space-y-6">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                      Select Operational Model <span className="text-[#fbb945]">*</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1">
                      {BRANCH_OPERATIONAL_ROLES.map((role) => {
                        const Icon = role.icon;
                        const isSelected = branchType === role.id;

                        return (
                          <div
                            key={role.id}
                            onClick={() => setBranchType(role.id)}
                            className={`group flex items-start gap-3 p-3.5 rounded-sm cursor-pointer select-none transition-all ${
                              isSelected
                                ? 'bg-white/5 shadow-sm -translate-y-0.5 border-l-2 border-[#985184]'
                                : 'hover:bg-white/5 hover:-translate-y-0.5 border-l-2 border-transparent'
                            }`}
                          >
                            <div
                              className={`w-9 h-9 rounded-sm flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${
                                isSelected ? 'bg-[#985184]/25 text-[#fbb945]' : 'bg-white/5 text-slate-400'
                              }`}
                            >
                              <Icon className="w-5 h-5 text-[#fbb945]" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1">
                                <div
                                  className={`text-xs font-bold transition-colors ${
                                    isSelected ? 'text-white' : 'text-slate-200 group-hover:text-white'
                                  }`}
                                >
                                  {role.label}
                                </div>
                                <span className="text-[10px] text-[#fbb945] font-mono shrink-0 hidden sm:inline">
                                  {role.badge}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 mt-1 leading-snug">{role.desc}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Step 1 Actions */}
                  <div className="pt-6 flex items-center justify-between border-t border-white/10">
                    <div className="text-xs text-slate-500 font-mono">Step 1 of 3</div>
                    <Button
                      type="submit"
                      size="sm"
                      className="bg-[#985184] hover:bg-[#854372] text-white font-semibold px-6 h-9 text-xs rounded-sm transition-all flex items-center gap-2 cursor-pointer shadow-sm"
                    >
                      <span>Continue to Branch Identity</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </form>
              )}

              {/* STEP 2: BRANCH IDENTITY & CONTACT */}
              {currentStep === 2 && (
                <form onSubmit={handleStep2Next} className="space-y-6">
                  {/* Branch Name & Abbreviation Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                        Branch Name <span className="text-[#fbb945]">*</span>
                      </label>
                      <input
                        type="text"
                        value={branchName}
                        onChange={(e) => setBranchName(e.target.value)}
                        placeholder="e.g. Abuja Central Fulfillment Hub"
                        required
                        className="w-full bg-transparent border-0 border-b border-white/20 focus:border-[#985184] focus:ring-0 text-white placeholder:text-slate-600 h-10 text-xs font-medium transition-colors rounded-none outline-none"
                      />
                      <p className="text-[11px] text-slate-500 mt-1">Full display name for this location.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                        Branch Code / Abbrev <span className="text-[#fbb945]">*</span>
                      </label>
                      <input
                        type="text"
                        value={branchCode}
                        onChange={(e) => setBranchCode(e.target.value.toUpperCase())}
                        placeholder="e.g. ABJ-01"
                        maxLength={10}
                        required
                        className="w-full bg-transparent border-0 border-b border-white/20 focus:border-[#985184] focus:ring-0 text-white placeholder:text-slate-600 h-10 text-xs font-mono font-bold uppercase tracking-wider text-center transition-colors rounded-none outline-none"
                      />
                      <p className="text-[11px] text-slate-500 mt-1 text-center">e.g. VI-01, ABJ, WHS</p>
                    </div>
                  </div>

                  {/* Primary Branch Option */}
                  <div className="pt-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isPrimary}
                        onChange={(e) => setIsPrimary(e.target.checked)}
                        className="w-3.5 h-3.5 rounded-sm border-white/20 bg-transparent text-[#985184] focus:ring-0 cursor-pointer"
                      />
                      <span className="text-xs font-semibold text-slate-200">
                        Designate as Primary Branch
                      </span>
                    </label>
                    <p className="text-[11px] text-slate-500 mt-0.5 ml-5.5">
                      New products without an explicit branch target will allocate stock to this location by default.
                    </p>
                  </div>

                  {/* Contact Details (Email & Phone) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-3 border-t border-white/10">
                    {/* Branch Email */}
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Branch Email
                      </label>
                      <div className="flex items-center gap-2 mb-1">
                        <input
                          type="checkbox"
                          id="newBranchUseOrgEmail"
                          checked={useOrgEmail}
                          onChange={(e) => setUseOrgEmail(e.target.checked)}
                          className="w-3.5 h-3.5 rounded-sm border-white/20 bg-transparent text-[#985184] focus:ring-0 cursor-pointer"
                        />
                        <label htmlFor="newBranchUseOrgEmail" className="text-xs text-slate-400 cursor-pointer">
                          Use organization email
                        </label>
                      </div>
                      {useOrgEmail ? (
                        <div className="flex items-center gap-2 h-10 text-xs text-slate-400 border-0 border-b border-white/10 font-mono">
                          <Mail className="w-3.5 h-3.5 text-slate-500" />
                          <span className="truncate">{defaultEmail || 'Default Org Email'}</span>
                        </div>
                      ) : (
                        <input
                          type="email"
                          value={customEmail}
                          onChange={(e) => setCustomEmail(e.target.value)}
                          placeholder="branch@orvio.app"
                          className="w-full bg-transparent border-0 border-b border-white/20 focus:border-[#985184] focus:ring-0 text-white placeholder:text-slate-600 h-10 text-xs transition-colors rounded-none outline-none"
                        />
                      )}
                    </div>

                    {/* Branch Phone */}
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Branch Phone
                      </label>
                      <div className="flex items-center gap-2 mb-1">
                        <input
                          type="checkbox"
                          id="newBranchUseOrgPhone"
                          checked={useOrgPhone}
                          onChange={(e) => setUseOrgPhone(e.target.checked)}
                          className="w-3.5 h-3.5 rounded-sm border-white/20 bg-transparent text-[#985184] focus:ring-0 cursor-pointer"
                        />
                        <label htmlFor="newBranchUseOrgPhone" className="text-xs text-slate-400 cursor-pointer">
                          Use organization phone
                        </label>
                      </div>
                      {useOrgPhone ? (
                        <div className="flex items-center gap-2 h-10 text-xs text-slate-400 border-0 border-b border-white/10 font-mono">
                          <Phone className="w-3.5 h-3.5 text-slate-500" />
                          <span className="truncate">{defaultPhone || 'Default Org Phone'}</span>
                        </div>
                      ) : (
                        <input
                          type="tel"
                          value={customPhone}
                          onChange={(e) => setCustomPhone(e.target.value)}
                          placeholder="+234 800 000 0000"
                          className="w-full bg-transparent border-0 border-b border-white/20 focus:border-[#985184] focus:ring-0 text-white placeholder:text-slate-600 h-10 text-xs transition-colors rounded-none outline-none"
                        />
                      )}
                    </div>
                  </div>

                  {/* Step 2 Actions */}
                  <div className="pt-6 flex items-center justify-between border-t border-white/10">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentStep(1)}
                      className="text-xs h-9 rounded-sm border border-white/10 bg-transparent text-slate-400 hover:text-white flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back</span>
                    </Button>

                    <Button
                      type="submit"
                      size="sm"
                      className="bg-[#985184] hover:bg-[#854372] text-white font-semibold px-6 h-9 text-xs rounded-sm transition-all flex items-center gap-2 cursor-pointer shadow-sm"
                    >
                      <span>Continue to Location Address</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </form>
              )}

              {/* STEP 3: PHYSICAL LOCATION ADDRESS */}
              {currentStep === 3 && (
                <form onSubmit={handleStep3Next} className="space-y-6">
                  {/* Country (Pre-selected to Nigeria) */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                      Country
                    </label>
                    <div className="relative">
                      <div className="flex items-center justify-between h-10 border-0 border-b border-white/20 text-xs text-slate-300 cursor-not-allowed select-none">
                        <div className="flex items-center gap-2">
                          <span className="text-base leading-none">🇳🇬</span>
                          <span className="font-semibold text-white">Nigeria</span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-[#fbb945] font-mono">
                          <Lock className="w-3 h-3 text-[#fbb945]" />
                          <span>Primary Operating Region</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* State & City Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* State */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                        State <span className="text-[#fbb945]">*</span>
                      </label>
                      <select
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        className="w-full bg-transparent border-0 border-b border-white/20 px-0 h-10 text-xs text-white focus:outline-none focus:border-[#985184] rounded-none cursor-pointer"
                      >
                        {NIGERIAN_STATES.map((st) => (
                          <option key={st} value={st} className="bg-[#111215] text-white">
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* City / LGA */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                        City / LGA <span className="text-[#fbb945]">*</span>
                      </label>
                      <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="e.g. Central Business District"
                        required
                        className="w-full bg-transparent border-0 border-b border-white/20 focus:border-[#985184] focus:ring-0 text-white placeholder:text-slate-600 h-10 text-xs transition-colors rounded-none outline-none"
                      />
                    </div>
                  </div>

                  {/* Street Address */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                      Street Address <span className="text-[#fbb945]">*</span>
                    </label>
                    <input
                      type="text"
                      value={streetAddress}
                      onChange={(e) => setStreetAddress(e.target.value)}
                      placeholder="e.g. Plot 405 Constitution Avenue"
                      required
                      className="w-full bg-transparent border-0 border-b border-white/20 focus:border-[#985184] focus:ring-0 text-white placeholder:text-slate-600 h-10 text-xs transition-colors rounded-none outline-none"
                    />
                  </div>

                  {/* Area / Landmark (Optional) */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                      Area / Landmark <span className="text-slate-500 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      placeholder="e.g. Near World Trade Centre"
                      className="w-full bg-transparent border-0 border-b border-white/20 focus:border-[#985184] focus:ring-0 text-white placeholder:text-slate-600 h-10 text-xs transition-colors rounded-none outline-none"
                    />
                  </div>

                  {/* Step 3 Actions */}
                  <div className="pt-6 flex items-center justify-between border-t border-white/10">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentStep(2)}
                      disabled={isSubmitting}
                      className="text-xs h-9 rounded-sm border border-white/10 bg-transparent text-slate-400 hover:text-white flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back</span>
                    </Button>

                    <Button
                      type="submit"
                      size="sm"
                      disabled={isSubmitting}
                      className="bg-[#985184] hover:bg-[#854372] text-white font-semibold px-6 h-9 text-xs rounded-sm transition-all flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
                    >
                      {sourceBranches.length > 0 ? (
                        <>
                          <span>Continue to Catalog Setup</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      ) : isSubmitting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Creating Branch...</span>
                        </>
                      ) : (
                        <>
                          <span>Complete & Launch Branch</span>
                          <Sparkles className="w-3.5 h-3.5" />
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              )}

              {/* STEP 4: CATALOG SETUP (START FRESH, CLONE ENTIRE, SELECTIVE) */}
              {currentStep === 4 && (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-tight">
                      Catalog Setup for New Branch
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Choose how this branch initializes its category tree, brands, and product catalog.
                    </p>
                  </div>

                  {/* 3 Catalog Setup Mode Options */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Mode 1: Start Fresh */}
                    <div
                      onClick={() => setCatalogMode('empty')}
                      className={`p-4 rounded-lg border cursor-pointer transition-all ${
                        catalogMode === 'empty'
                          ? 'border-[#985184] bg-[#985184]/15 shadow-md shadow-[#985184]/10'
                          : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center mb-3 text-[#fbb945]">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-bold text-white">Start Fresh</h4>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                        Empty catalog. Set up custom categories, brands, and products manually.
                      </p>
                    </div>

                    {/* Mode 2: Clone Entire Catalog */}
                    <div
                      onClick={() => setCatalogMode('clone_all')}
                      className={`p-4 rounded-lg border cursor-pointer transition-all ${
                        catalogMode === 'clone_all'
                          ? 'border-[#985184] bg-[#985184]/15 shadow-md shadow-[#985184]/10'
                          : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center mb-3 text-[#fbb945]">
                        <Copy className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-bold text-white">Clone Entire Catalog</h4>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                        Duplicates all categories, brands, and products from an existing branch.
                      </p>
                    </div>

                    {/* Mode 3: Selective Import */}
                    <div
                      onClick={() => setCatalogMode('selective')}
                      className={`p-4 rounded-lg border cursor-pointer transition-all ${
                        catalogMode === 'selective'
                          ? 'border-[#985184] bg-[#985184]/15 shadow-md shadow-[#985184]/10'
                          : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center mb-3 text-[#fbb945]">
                        <CheckSquare className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-bold text-white">Selective Import</h4>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                        Pick specific categories, brands, and products to import into this branch.
                      </p>
                    </div>
                  </div>

                  {/* If Clone or Selective, pick source branch */}
                  {catalogMode !== 'empty' && (
                    <div className="space-y-4 pt-2">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                          Source Branch to Replicate From
                        </label>
                        <select
                          value={selectedSourceBranchId}
                          onChange={(e) => setSelectedSourceBranchId(e.target.value)}
                          className="w-full bg-[#16181d] border border-white/15 px-3 py-2 text-xs text-white rounded-md focus:outline-none focus:border-[#985184]"
                        >
                          {sourceBranches.map((sb) => (
                            <option key={sb.id} value={sb.id}>
                              {sb.name} {sb.code ? `(${sb.code})` : ''} {sb.is_primary ? '★ Primary' : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Include Categories & Brands Option */}
                      <label className="flex items-center gap-2 cursor-pointer select-none pt-1">
                        <input
                          type="checkbox"
                          checked={importTaxonomy}
                          onChange={(e) => setImportTaxonomy(e.target.checked)}
                          className="w-3.5 h-3.5 rounded-sm border-white/20 bg-transparent text-[#985184] focus:ring-0 cursor-pointer"
                        />
                        <span className="text-xs font-semibold text-slate-200">
                          Include associated Categories & Brands (Smart Reconciled)
                        </span>
                      </label>
                      <p className="text-[11px] text-slate-500 -mt-2 ml-5.5">
                        {importTaxonomy
                          ? 'Preserves tree hierarchy and links existing categories/brands in target branch without duplicate slugs.'
                          : 'Imports products as Unassigned so you can organize categories from scratch.'}
                      </p>

                      {/* Copy Stock Option */}
                      <label className="flex items-center gap-2 cursor-pointer select-none pt-1">
                        <input
                          type="checkbox"
                          checked={copyStock}
                          onChange={(e) => setCopyStock(e.target.checked)}
                          className="w-3.5 h-3.5 rounded-sm border-white/20 bg-transparent text-[#985184] focus:ring-0 cursor-pointer"
                        />
                        <span className="text-xs font-semibold text-slate-200">
                          Copy current stock quantities into new branch
                        </span>
                      </label>
                      <p className="text-[11px] text-slate-500 -mt-2 ml-5.5">
                        If unchecked, catalog items are imported with 0 quantity on hand, ready for fresh stock intake.
                      </p>

                      {/* Selective item pickers */}
                      {catalogMode === 'selective' && (
                        <div className="space-y-3 pt-2">
                          {isLoadingCatalogData ? (
                            <div className="flex items-center gap-2 py-4 text-xs text-slate-400">
                              <Loader2 className="w-4 h-4 animate-spin text-[#985184]" />
                              <span>Loading catalog items from source branch...</span>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {/* Categories checklist */}
                              <div className="border border-white/10 rounded-lg p-3 bg-white/[0.01]">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-semibold text-white">
                                    Categories ({selectedCategoryIds.length}/{availableCategories.length})
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSelectedCategoryIds(
                                        selectedCategoryIds.length === availableCategories.length
                                          ? []
                                          : availableCategories.map((c) => c.id)
                                      )
                                    }
                                    className="text-[11px] text-[#fbb945] hover:underline"
                                  >
                                    {selectedCategoryIds.length === availableCategories.length ? 'Deselect All' : 'Select All'}
                                  </button>
                                </div>
                                <div className="max-h-28 overflow-y-auto space-y-1.5 pr-2">
                                  {availableCategories.length === 0 ? (
                                    <p className="text-[11px] text-slate-500">No categories in source branch</p>
                                  ) : (
                                    availableCategories.map((cat) => (
                                      <label key={cat.id} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={selectedCategoryIds.includes(cat.id)}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              setSelectedCategoryIds([...selectedCategoryIds, cat.id]);
                                            } else {
                                              setSelectedCategoryIds(selectedCategoryIds.filter((id) => id !== cat.id));
                                            }
                                          }}
                                          className="w-3.5 h-3.5 rounded-sm border-white/20 bg-transparent text-[#985184] focus:ring-0"
                                        />
                                        <span>{cat.name}</span>
                                      </label>
                                    ))
                                  )}
                                </div>
                              </div>

                              {/* Brands checklist */}
                              <div className="border border-white/10 rounded-lg p-3 bg-white/[0.01]">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-semibold text-white">
                                    Brands ({selectedBrandIds.length}/{availableBrands.length})
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSelectedBrandIds(
                                        selectedBrandIds.length === availableBrands.length
                                          ? []
                                          : availableBrands.map((b) => b.id)
                                      )
                                    }
                                    className="text-[11px] text-[#fbb945] hover:underline"
                                  >
                                    {selectedBrandIds.length === availableBrands.length ? 'Deselect All' : 'Select All'}
                                  </button>
                                </div>
                                <div className="max-h-28 overflow-y-auto space-y-1.5 pr-2">
                                  {availableBrands.length === 0 ? (
                                    <p className="text-[11px] text-slate-500">No brands in source branch</p>
                                  ) : (
                                    availableBrands.map((b) => (
                                      <label key={b.id} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={selectedBrandIds.includes(b.id)}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              setSelectedBrandIds([...selectedBrandIds, b.id]);
                                            } else {
                                              setSelectedBrandIds(selectedBrandIds.filter((id) => id !== b.id));
                                            }
                                          }}
                                          className="w-3.5 h-3.5 rounded-sm border-white/20 bg-transparent text-[#985184] focus:ring-0"
                                        />
                                        <span>{b.name}</span>
                                      </label>
                                    ))
                                  )}
                                </div>
                              </div>

                              {/* Products checklist */}
                              <div className="border border-white/10 rounded-lg p-3 bg-white/[0.01]">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-semibold text-white">
                                    Products ({selectedProductIds.length}/{availableProducts.length})
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSelectedProductIds(
                                        selectedProductIds.length === availableProducts.length
                                          ? []
                                          : availableProducts.map((p) => p.id)
                                      )
                                    }
                                    className="text-[11px] text-[#fbb945] hover:underline"
                                  >
                                    {selectedProductIds.length === availableProducts.length ? 'Deselect All' : 'Select All'}
                                  </button>
                                </div>
                                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-2">
                                  {availableProducts.length === 0 ? (
                                    <p className="text-[11px] text-slate-500">No products in source branch</p>
                                  ) : (
                                    availableProducts.map((p) => (
                                      <label key={p.id} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={selectedProductIds.includes(p.id)}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              setSelectedProductIds([...selectedProductIds, p.id]);
                                            } else {
                                              setSelectedProductIds(selectedProductIds.filter((id) => id !== p.id));
                                            }
                                          }}
                                          className="w-3.5 h-3.5 rounded-sm border-white/20 bg-transparent text-[#985184] focus:ring-0"
                                        />
                                        <span className="truncate">{p.name}</span>
                                        <span className="text-[10px] text-slate-500 font-mono">({p.sku})</span>
                                      </label>
                                    ))
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step 4 Actions */}
                  <div className="pt-6 flex items-center justify-between border-t border-white/10">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentStep(3)}
                      disabled={isSubmitting}
                      className="text-xs h-9 rounded-sm border border-white/10 bg-transparent text-slate-400 hover:text-white flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back to Location</span>
                    </Button>

                    <Button
                      type="submit"
                      size="sm"
                      disabled={isSubmitting}
                      className="bg-[#985184] hover:bg-[#854372] text-white font-semibold px-6 h-9 text-xs rounded-sm transition-all flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Creating Branch...</span>
                        </>
                      ) : (
                        <>
                          <span>Complete & Launch Branch</span>
                          <Sparkles className="w-3.5 h-3.5" />
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
