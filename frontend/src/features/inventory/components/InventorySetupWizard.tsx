import * as React from 'react';
import {
  Store,
  Boxes,
  Sparkles,
  Cpu,
  HeartPulse,
  Coffee,
  Factory,
  Briefcase,
  CheckCircle2,
  Loader2,
  MapPin,
  Mail,
  Phone,
  ArrowRight,
  ArrowLeft,
  Package,
  Building,
  Lock,
  Check,
  Rocket,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import {
  submitInventoryBranchSetup,
  saveInventoryOnboardingDraft,
  type InventoryBranchSetupPayload,
} from '../api';
import { toast } from 'sonner';

const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT - Abuja', 'Gombe',
  'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos',
  'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto',
  'Taraba', 'Yobe', 'Zamfara'
];

export const BUSINESS_TYPES = [
  {
    id: 'retail_supermarket',
    label: 'Retail Store & Supermarket',
    desc: 'Daily fast-moving consumer goods, walk-in shoppers & point of sale counters',
    icon: Store,
  },
  {
    id: 'wholesale_distribution',
    label: 'Wholesale & Bulk Distribution',
    desc: 'B2B volume deliveries, pallet tracking & commercial warehouses',
    icon: Boxes,
  },
  {
    id: 'fashion_boutique',
    label: 'Fashion, Apparel & Boutique',
    desc: 'Clothing, footwear, variants (size/color), and accessories',
    icon: Sparkles,
  },
  {
    id: 'electronics_tech',
    label: 'Electronics, Gadgets & Tech',
    desc: 'Serialized devices, accessories, warranty tracking & tech items',
    icon: Cpu,
  },
  {
    id: 'pharmacy_cosmetics',
    label: 'Pharmacy, Health & Cosmetics',
    desc: 'Batch tracking, expiry dates, skincare products & pharmaceuticals',
    icon: HeartPulse,
  },
  {
    id: 'food_grocery',
    label: 'Food, Beverage & Grocery',
    desc: 'Specialty groceries, packaged delicacies, cold chain & beverages',
    icon: Coffee,
  },
  {
    id: 'manufacturing_other',
    label: 'Manufacturing & Production',
    desc: 'Raw materials, assembly components & finished stock output',
    icon: Factory,
  },
  {
    id: 'services_other',
    label: 'Services & General Inventory',
    desc: 'Service supplies, spare parts, equipment rental or custom catalog',
    icon: Briefcase,
  },
];

interface InventorySetupWizardProps {
  organization: {
    id: string;
    name: string;
    subdomain: string;
    currency: string;
    timezone: string;
    businessEmail?: string | null;
    phone?: string | null;
  };
  initialStepData?: any;
  userEmail?: string;
  userPhone?: string;
  onCompleted: () => void;
}

export function InventorySetupWizard({
  organization,
  initialStepData,
  userEmail,
  userPhone,
  onCompleted,
}: InventorySetupWizardProps) {
  const storageKey = `orvio_inv_wizard_${organization.id}`;

  // Step state
  const [currentStep, setCurrentStep] = React.useState<number>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.currentStep) return parsed.currentStep;
      }
    } catch {
      // Ignore storage errors
    }
    return initialStepData?.step || 1;
  });

  // Step 1: Business Category
  const [businessType, setBusinessType] = React.useState<string>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.businessType) return parsed.businessType;
      }
    } catch {
      // Ignore
    }
    return initialStepData?.businessType || 'retail_supermarket';
  });

  const [businessDescription, setBusinessDescription] = React.useState<string>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.businessDescription) return parsed.businessDescription;
      }
    } catch {
      // Ignore
    }
    return initialStepData?.businessDescription || '';
  });

  // Step 2: Branch Identity & Contact
  const [branchName, setBranchName] = React.useState<string>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.branchName) return parsed.branchName;
      }
    } catch {
      // Ignore
    }
    return initialStepData?.branchName || `${organization.name} Main Branch`;
  });

  const [branchCode, setBranchCode] = React.useState<string>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.branchCode) return parsed.branchCode;
      }
    } catch {
      // Ignore
    }
    return initialStepData?.branchCode || 'HQ';
  });

  const [useOrgEmail, setUseOrgEmail] = React.useState<boolean>(true);
  const [customEmail, setCustomEmail] = React.useState<string>('');
  const [useOrgPhone, setUseOrgPhone] = React.useState<boolean>(true);
  const [customPhone, setCustomPhone] = React.useState<string>('');

  // Step 3: Physical Location
  const country = 'Nigeria';
  const [state, setState] = React.useState<string>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.state) return parsed.state;
      }
    } catch {
      // Ignore
    }
    return initialStepData?.state || 'Lagos';
  });

  const [city, setCity] = React.useState<string>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.city) return parsed.city;
      }
    } catch {
      // Ignore
    }
    return initialStepData?.city || '';
  });

  const [streetAddress, setStreetAddress] = React.useState<string>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.streetAddress) return parsed.streetAddress;
      }
    } catch {
      // Ignore
    }
    return initialStepData?.streetAddress || '';
  });

  const [area, setArea] = React.useState<string>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.area) return parsed.area;
      }
    } catch {
      // Ignore
    }
    return initialStepData?.area || '';
  });

  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);
  const [showCelebration, setShowCelebration] = React.useState<boolean>(false);

  // Sync to local storage
  React.useEffect(() => {
    try {
      const stateToSave = {
        currentStep,
        businessType,
        businessDescription,
        branchName,
        branchCode,
        state,
        city,
        streetAddress,
        area,
      };
      localStorage.setItem(storageKey, JSON.stringify(stateToSave));
    } catch {
      // Ignore quota errors
    }
  }, [
    currentStep,
    businessType,
    businessDescription,
    branchName,
    branchCode,
    state,
    city,
    streetAddress,
    area,
    storageKey,
  ]);

  const defaultEmail = organization.businessEmail || userEmail || '';
  const defaultPhone = organization.phone || userPhone || '';

  const handleStep1Next = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessType) {
      toast.error('Please select a business category to continue.');
      return;
    }
    try {
      await saveInventoryOnboardingDraft({
        currentStep: 'branch_identity',
        stepData: {
          step: 2,
          businessType,
          businessDescription,
        },
      });
    } catch {
      // Non-blocking
    }
    setCurrentStep(2);
  };

  const handleStep2Next = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchName.trim()) {
      toast.error('Branch name is required.');
      return;
    }
    if (!branchCode.trim()) {
      toast.error('Branch code / abbreviation is required.');
      return;
    }
    try {
      await saveInventoryOnboardingDraft({
        currentStep: 'branch_location',
        stepData: {
          step: 3,
          businessType,
          businessDescription,
          branchName: branchName.trim(),
          branchCode: branchCode.trim(),
        },
      });
    } catch {
      // Non-blocking
    }
    setCurrentStep(3);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

      const payload: any = {
        branchName: branchName.trim(),
        branchCode: branchCode.trim().toUpperCase(),
        businessType,
        businessDescription: businessDescription.trim() || undefined,
        email: finalEmail.trim() || undefined,
        phone: finalPhone.trim() || undefined,
        useOrgEmail,
        useOrgPhone,
        address: {
          country,
          state,
          city: city.trim(),
          area: area.trim() || undefined,
          streetAddress: streetAddress.trim(),
        },
        location: {
          country,
          state,
          city: city.trim(),
          area: area.trim() || undefined,
          streetAddress: streetAddress.trim(),
        },
        currency: organization.currency || 'NGN',
      };

      await submitInventoryBranchSetup(payload);
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // Ignore
      }
      setShowCelebration(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to complete setup';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = [
    { num: 1, title: 'Category', desc: 'Industry Model' },
    { num: 2, title: 'Identity', desc: 'Branch Code' },
    { num: 3, title: 'Location', desc: 'Nigeria Address' },
  ];

  return (
    <div
      className="min-h-screen bg-[#111215] text-slate-100 flex flex-col justify-center items-center py-10 px-4 sm:px-6 lg:px-8 relative overflow-x-hidden font-sans selection:bg-[#985184] selection:text-white"
      style={{
        backgroundImage: 'radial-gradient(circle, rgba(255, 255, 255, 0.07) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
    >
      {/* Subtle Ambient Glow with #985184 */}
      <div className="fixed top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#985184]/12 rounded-full blur-[140px] pointer-events-none -z-10" />

      <div className="w-full max-w-3xl relative z-10">
        {/* Header Title without borders */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 text-slate-400 text-xs font-mono mb-2">
            <Package className="w-3.5 h-3.5 text-[#fbb945]" />
            <span>Inventory Setup • Step {currentStep} of 3</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            {currentStep === 1 && 'What type of business are you running?'}
            {currentStep === 2 && 'Name your primary branch & code'}
            {currentStep === 3 && 'Where is this branch located?'}
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm text-slate-400 max-w-lg mx-auto">
            {currentStep === 1 &&
              `Tailor inventory workflows and product catalog for ${organization.name}.`}
            {currentStep === 2 &&
              'Establish branch branding, contact points, and receipt abbreviations.'}
            {currentStep === 3 &&
              'Specify physical store or warehouse address for dispatch and stock audits.'}
          </p>
        </div>

        {/* Minimal Step Indicator Bar */}
        <div className="mb-8 grid grid-cols-3 gap-4 border-b border-white/5 pb-4">
          {steps.map((step) => {
            const isActive = currentStep === step.num;
            const isDone = currentStep > step.num;

            return (
              <div
                key={step.num}
                className="flex items-center gap-2.5 cursor-default select-none"
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

        {/* Form Container (No card background, no card borders) */}
        <div className="bg-transparent">
          {/* STEP 1: BUSINESS CATEGORY */}
          {currentStep === 1 && (
            <form onSubmit={handleStep1Next} className="space-y-6">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
                  Select Business Category <span className="text-[#fbb945]">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
                  {BUSINESS_TYPES.map((bt) => {
                    const Icon = bt.icon;
                    const isSelected = businessType === bt.id;

                    return (
                      <div
                        key={bt.id}
                        onClick={() => setBusinessType(bt.id)}
                        className={`group flex items-start gap-3 p-3 rounded-sm cursor-pointer select-none transition-all ${
                          isSelected
                            ? 'bg-white/5 shadow-sm -translate-y-0.5 border-l-2 border-[#985184]'
                            : 'hover:bg-white/5 hover:-translate-y-0.5'
                        }`}
                      >
                        <div
                          className={`w-9 h-9 rounded-sm flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${
                            isSelected ? 'bg-[#985184]/25 text-[#fbb945]' : 'bg-transparent text-slate-400'
                          }`}
                        >
                          <Icon className="w-5 h-5 text-[#fbb945]" />
                        </div>
                        <div className="min-w-0">
                          <div
                            className={`text-xs font-bold transition-colors ${
                              isSelected ? 'text-white' : 'text-slate-200 group-hover:text-white'
                            }`}
                          >
                            {bt.label}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{bt.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Optional Description */}
              <div className="pt-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Business Tagline or Notes <span className="text-slate-500 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={businessDescription}
                  onChange={(e) => setBusinessDescription(e.target.value)}
                  placeholder="e.g. Premium retail supermarket & lifestyle provisions"
                  className="w-full bg-transparent border-0 border-b border-white/20 focus:border-[#985184] focus:ring-0 text-white placeholder:text-slate-600 h-10 text-xs transition-colors rounded-none outline-none"
                />
              </div>

              {/* Step 1 Actions */}
              <div className="pt-6 flex items-center justify-between border-t border-white/5">
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
                    placeholder="e.g. Apex Ikeja Flagship"
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
                    placeholder="e.g. HQ"
                    maxLength={10}
                    required
                    className="w-full bg-transparent border-0 border-b border-white/20 focus:border-[#985184] focus:ring-0 text-white placeholder:text-slate-600 h-10 text-xs font-mono font-bold uppercase tracking-wider text-center transition-colors rounded-none outline-none"
                  />
                  <p className="text-[11px] text-slate-500 mt-1 text-center">e.g. HQ, LAG, IBO</p>
                </div>
              </div>

              {/* Contact Details (Email & Phone) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-3 border-t border-white/5">
                {/* Branch Email */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Branch Email
                  </label>
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="checkbox"
                      id="useOrgEmail"
                      checked={useOrgEmail}
                      onChange={(e) => setUseOrgEmail(e.target.checked)}
                      className="w-3.5 h-3.5 rounded-sm border-white/20 bg-transparent text-[#985184] focus:ring-0 cursor-pointer"
                    />
                    <label htmlFor="useOrgEmail" className="text-xs text-slate-400 cursor-pointer">
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
                      placeholder="branch@orvio.com"
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
                      id="useOrgPhone"
                      checked={useOrgPhone}
                      onChange={(e) => setUseOrgPhone(e.target.checked)}
                      className="w-3.5 h-3.5 rounded-sm border-white/20 bg-transparent text-[#985184] focus:ring-0 cursor-pointer"
                    />
                    <label htmlFor="useOrgPhone" className="text-xs text-slate-400 cursor-pointer">
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
              <div className="pt-6 flex items-center justify-between border-t border-white/5">
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
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Country (Pre-selected to Nigeria, cursor disabled on hover) */}
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
                      <span>Primary Region</span>
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Multi-country inventory support coming in next release.</p>
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
                    placeholder="e.g. Ikeja"
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
                  placeholder="e.g. Plot 12 Allen Avenue"
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
                  placeholder="e.g. Opposite Ikeja City Mall"
                  className="w-full bg-transparent border-0 border-b border-white/20 focus:border-[#985184] focus:ring-0 text-white placeholder:text-slate-600 h-10 text-xs transition-colors rounded-none outline-none"
                />
              </div>

              {/* Step 3 Actions */}
              <div className="pt-6 flex items-center justify-between border-t border-white/5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentStep(2)}
                  className="text-xs h-9 rounded-sm border border-white/10 bg-transparent text-slate-400 hover:text-white flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </Button>

                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                  className="bg-[#985184] hover:bg-[#854372] text-white font-semibold px-6 h-9 text-xs rounded-sm transition-all flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                      <span>Activating Inventory...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Complete Setup & Launch</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* POST-ONBOARDING CELEBRATION & WELCOME */}
      {showCelebration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-[#111215] border border-white/10 rounded-sm max-w-md w-full p-6 text-center space-y-4 shadow-2xl relative">
            <div className="w-12 h-12 rounded-sm bg-[#fbb945]/15 text-[#fbb945] flex items-center justify-center mx-auto">
              <Rocket className="w-6 h-6 animate-bounce" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white tracking-tight">
                Welcome to Orvio Inventory!
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
                <span className="text-white font-medium">{organization.name}</span> is ready. Your primary branch{' '}
                <span className="text-[#fbb945] font-semibold">{branchName} ({branchCode})</span> has been established in {state}, Nigeria.
              </p>
            </div>

            {/* Quick Summary Badges */}
            <div className="grid grid-cols-3 gap-2 py-3 border-y border-white/5 text-left">
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-500 font-mono">Branch</div>
                <div className="text-xs font-semibold text-slate-200 truncate">{branchCode}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-500 font-mono">Region</div>
                <div className="text-xs font-semibold text-slate-200 truncate">{state}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-500 font-mono">Currency</div>
                <div className="text-xs font-semibold text-slate-200">{organization.currency || 'NGN'}</div>
              </div>
            </div>

            <div className="pt-2">
              <Button
                onClick={() => {
                  setShowCelebration(false);
                  onCompleted();
                }}
                className="w-full bg-[#985184] hover:bg-[#854372] text-white font-semibold text-xs h-9 rounded-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <span>Enter Inventory Workspace</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
