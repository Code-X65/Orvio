import * as React from 'react';
import {
  X,
  Building2,
  Phone,
  Mail,
  MapPin,
  User,
  FileText,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  XCircle,
  PackagePlus,
  ArrowUpRight,
  Edit2,
  Archive,
  RefreshCw,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import {
  supplierApi,
  type Supplier,
  type SupplierDetail,
  type CreateSupplierPayload,
  type UpdateSupplierPayload,
} from '../suppliers-api';

export interface SupplierDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  supplierId?: string | null;
  mode?: 'create' | 'edit' | 'view';
  onSaved?: (supplier: Supplier) => void;
  onReceiveStock?: (supplier: Supplier) => void;
  onViewReceipt?: (receiptId: string) => void;
}

export function SupplierDrawer({
  isOpen,
  onClose,
  supplierId,
  mode: initialMode = 'view',
  onSaved,
  onReceiveStock,
  onViewReceipt,
}: SupplierDrawerProps) {
  const [mounted, setMounted] = React.useState(isOpen);
  const [animating, setAnimating] = React.useState(false);
  const [currentMode, setCurrentMode] = React.useState<'create' | 'edit' | 'view'>(
    supplierId ? initialMode : 'create'
  );

  React.useEffect(() => {
    setCurrentMode(supplierId ? initialMode : 'create');
  }, [supplierId, initialMode, isOpen]);

  React.useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isOpen) {
      setMounted(true);
      timer = setTimeout(() => setAnimating(true), 20);
    } else {
      setAnimating(false);
      timer = setTimeout(() => setMounted(false), 300);
    }
    return () => clearTimeout(timer);
  }, [isOpen]);

  const triggerClose = React.useCallback(() => {
    setAnimating(false);
    setTimeout(() => {
      onClose();
    }, 300);
  }, [onClose]);

  // Form State
  const [name, setName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [contactPerson, setContactPerson] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [taxId, setTaxId] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [isActive, setIsActive] = React.useState(true);

  // Status & Feedback
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [supplierData, setSupplierData] = React.useState<SupplierDetail | null>(null);
  const [duplicateWarning, setDuplicateWarning] = React.useState<string | null>(null);

  // Load supplier details
  const fetchSupplier = React.useCallback(async (id: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await supplierApi.getSupplier(id);
      setSupplierData(data);
      setName(data.name || '');
      setPhone(data.phone || '');
      setEmail(data.email || '');
      setContactPerson(data.contactPerson || '');
      setAddress(data.address || '');
      setTaxId(data.taxId || '');
      setNotes(data.notes || '');
      setIsActive(data.isActive);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load supplier details');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (isOpen && supplierId) {
      fetchSupplier(supplierId);
    } else if (isOpen && !supplierId) {
      setName('');
      setPhone('');
      setEmail('');
      setContactPerson('');
      setAddress('');
      setTaxId('');
      setNotes('');
      setIsActive(true);
      setSupplierData(null);
      setDuplicateWarning(null);
      setErrorMsg(null);
    }
  }, [isOpen, supplierId, fetchSupplier]);

  // Debounced duplicate check
  React.useEffect(() => {
    if (currentMode === 'view' || !name.trim()) {
      setDuplicateWarning(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await supplierApi.checkDuplicates({
          name: name.trim(),
          phone: phone.trim() || undefined,
          excludeId: supplierId || undefined,
        });
        if (res.hasDuplicates && res.matches.length > 0) {
          const names = res.matches.map((m) => m.name).join(', ');
          setDuplicateWarning(`Potential duplicate: A supplier with similar details already exists (${names}).`);
        } else {
          setDuplicateWarning(null);
        }
      } catch {
        // ignore duplicate check errors
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [name, phone, supplierId, currentMode]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Supplier name is required');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      if (currentMode === 'create') {
        const payload: CreateSupplierPayload = {
          name: name.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          contactPerson: contactPerson.trim() || null,
          address: address.trim() || null,
          taxId: taxId.trim() || null,
          notes: notes.trim() || null,
          isActive,
        };

        const res = await supplierApi.createSupplier(payload);
        if (onSaved) onSaved(res.supplier);
        triggerClose();
      } else if (currentMode === 'edit' && supplierId) {
        const payload: UpdateSupplierPayload = {
          name: name.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          contactPerson: contactPerson.trim() || null,
          address: address.trim() || null,
          taxId: taxId.trim() || null,
          notes: notes.trim() || null,
          isActive,
        };

        const updated = await supplierApi.updateSupplier(supplierId, payload);
        if (onSaved) onSaved(updated);
        setCurrentMode('view');
        fetchSupplier(supplierId);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save supplier');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    if (!supplierId || !supplierData) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      if (supplierData.isActive) {
        await supplierApi.deactivateSupplier(supplierId);
      } else {
        await supplierApi.activateSupplier(supplierId);
      }
      await fetchSupplier(supplierId);
      if (onSaved && supplierData) {
        onSaved({ ...supplierData, isActive: !supplierData.isActive });
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update supplier status');
    } finally {
      setSaving(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={triggerClose}
        className={`fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${
          animating ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10 pointer-events-none">
        <div
          className={`w-screen max-w-xl bg-[#121316] border-l border-[#2d3139] shadow-2xl flex flex-col pointer-events-auto transform transition-transform duration-300 ease-in-out ${
            animating ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-[#2d3139] flex items-center justify-between bg-[#16181d]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[#fbb945] flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-tight">
                  {currentMode === 'create'
                    ? 'Add New Supplier'
                    : currentMode === 'edit'
                    ? `Edit Supplier: ${name || 'Supplier'}`
                    : name || 'Supplier Details'}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {currentMode === 'create'
                    ? 'Enter vendor contact and purchasing details'
                    : currentMode === 'edit'
                    ? 'Update vendor information'
                    : 'Vendor profile and stock receipt history'}
                </p>
              </div>
            </div>

            <button
              onClick={triggerClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24 space-y-3">
                <Loader2 className="w-8 h-8 text-[#fbb945] animate-spin" />
                <p className="text-xs text-slate-400 font-medium">Loading vendor profile...</p>
              </div>
            ) : currentMode === 'view' && supplierData ? (
              /* ================= VIEW MODE ================= */
              <div className="space-y-6">
                {/* Top Banner Card */}
                <div className="p-5 rounded-xl bg-[#181a20] border border-[#2d3139] space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-white tracking-tight">{supplierData.name}</h3>
                      {supplierData.contactPerson && (
                        <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-1">
                          <User className="w-3.5 h-3.5 text-slate-500" />
                          <span>Contact: <strong className="text-slate-200">{supplierData.contactPerson}</strong></span>
                        </p>
                      )}
                    </div>
                    <Badge
                      className={`text-[11px] font-semibold border ${
                        supplierData.isActive
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                      }`}
                    >
                      {supplierData.isActive ? 'Active Vendor' : 'Deactivated'}
                    </Badge>
                  </div>

                  {/* Quick Action Buttons */}
                  <div className="flex items-center gap-2 pt-2 border-t border-[#23262f]">
                    {supplierData.isActive && onReceiveStock && (
                      <Button
                        size="sm"
                        onClick={() => {
                          triggerClose();
                          onReceiveStock(supplierData);
                        }}
                        className="bg-[#fbb945] hover:bg-[#e5a83d] text-black font-semibold text-xs h-8 gap-1.5 shadow-sm"
                      >
                        <PackagePlus className="w-3.5 h-3.5" />
                        Receive Stock Delivery
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCurrentMode('edit')}
                      className="border-[#2d3139] bg-[#14151a] hover:bg-[#1a1c23] text-slate-200 text-xs h-8 gap-1.5"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                      Edit Details
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleToggleActive}
                      disabled={saving}
                      className="border-[#2d3139] bg-[#14151a] hover:bg-[#1a1c23] text-slate-200 text-xs h-8 gap-1.5 ml-auto"
                    >
                      {saving ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : supplierData.isActive ? (
                        <>
                          <Archive className="w-3.5 h-3.5 text-slate-400" />
                          Deactivate
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                          Activate
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Contact & Profile Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-lg bg-[#14151a] border border-[#23262f] space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                      <Phone className="w-3 h-3 text-slate-400" /> Phone Number
                    </span>
                    <p className="text-xs font-mono text-slate-200">
                      {supplierData.phone || <span className="text-slate-600 italic">Not provided</span>}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-lg bg-[#14151a] border border-[#23262f] space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                      <Mail className="w-3 h-3 text-slate-400" /> Email Address
                    </span>
                    <p className="text-xs text-slate-200 truncate">
                      {supplierData.email ? (
                        <a href={`mailto:${supplierData.email}`} className="text-blue-400 hover:underline">
                          {supplierData.email}
                        </a>
                      ) : (
                        <span className="text-slate-600 italic">Not provided</span>
                      )}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-lg bg-[#14151a] border border-[#23262f] space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400" /> Business Address
                    </span>
                    <p className="text-xs text-slate-200">
                      {supplierData.address || <span className="text-slate-600 italic">Not provided</span>}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-lg bg-[#14151a] border border-[#23262f] space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                      <FileText className="w-3 h-3 text-slate-400" /> Tax Identification (TIN)
                    </span>
                    <p className="text-xs font-mono text-slate-200">
                      {supplierData.taxId || <span className="text-slate-600 italic">None</span>}
                    </p>
                  </div>
                </div>

                {/* Notes */}
                {supplierData.notes && (
                  <div className="p-3.5 rounded-lg bg-[#14151a] border border-[#23262f] space-y-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Internal Purchasing Notes
                    </span>
                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {supplierData.notes}
                    </p>
                  </div>
                )}

                {/* Recent Receipts Section */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <span>Receipt History</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#23262f] text-slate-300 font-mono">
                        {supplierData.receiptsCount}
                      </span>
                    </h4>
                  </div>

                  {supplierData.recentReceipts && supplierData.recentReceipts.length > 0 ? (
                    <div className="border border-[#23262f] rounded-lg overflow-hidden bg-[#14151a]">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-[#23262f] text-slate-400 font-medium bg-[#16181d]">
                            <th className="py-2.5 px-3">Reference</th>
                            <th className="py-2.5 px-3">Date</th>
                            <th className="py-2.5 px-3">Branch</th>
                            <th className="py-2.5 px-3 text-center">Lines</th>
                            <th className="py-2.5 px-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#23262f]/60 text-slate-300">
                          {supplierData.recentReceipts.map((rcpt) => (
                            <tr key={rcpt.id} className="hover:bg-white/[0.02] transition-colors">
                              <td className="py-2.5 px-3 font-mono font-bold text-[#fbb945]">
                                {rcpt.reference}
                              </td>
                              <td className="py-2.5 px-3 text-slate-400">
                                {new Date(rcpt.receiptDate).toLocaleDateString()}
                              </td>
                              <td className="py-2.5 px-3 font-medium text-white">{rcpt.branchName}</td>
                              <td className="py-2.5 px-3 text-center font-mono text-slate-400">
                                {rcpt.itemCount}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                {onViewReceipt && (
                                  <button
                                    onClick={() => {
                                      triggerClose();
                                      onViewReceipt(rcpt.id);
                                    }}
                                    className="text-xs text-blue-400 hover:text-blue-300 inline-flex items-center gap-0.5"
                                  >
                                    <span>View</span>
                                    <ArrowUpRight className="w-3 h-3" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-6 rounded-lg bg-[#14151a] border border-[#23262f] text-center space-y-2">
                      <p className="text-xs text-slate-400">No stock receipts recorded for this vendor yet.</p>
                      {supplierData.isActive && onReceiveStock && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            triggerClose();
                            onReceiveStock(supplierData);
                          }}
                          className="border-[#2d3139] text-xs h-7 text-[#fbb945] hover:bg-[#fbb945]/10"
                        >
                          Receive First Stock Delivery
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* ================= CREATE / EDIT FORM ================= */
              <form onSubmit={handleSave} className="space-y-4">
                {errorMsg && (
                  <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                    <XCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {duplicateWarning && (
                  <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                    <span>{duplicateWarning}</span>
                  </div>
                )}

                {/* Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-200">
                    Supplier / Vendor Name <span className="text-rose-400">*</span>
                  </label>
                  <Input
                    placeholder="e.g. Apex Global Foods Ltd"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="bg-[#181a20] border-[#2d3139] text-white text-xs h-9 focus:border-[#fbb945]"
                  />
                </div>

                {/* Contact Person & Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-200">Contact Representative</label>
                    <Input
                      placeholder="e.g. Babatunde Ade"
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value)}
                      className="bg-[#181a20] border-[#2d3139] text-white text-xs h-9 focus:border-[#fbb945]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-200">Phone Number</label>
                    <Input
                      placeholder="e.g. +234 801 234 5678"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="bg-[#181a20] border-[#2d3139] text-white text-xs h-9 focus:border-[#fbb945]"
                    />
                  </div>
                </div>

                {/* Email & Tax ID */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-200">Email Address</label>
                    <Input
                      type="email"
                      placeholder="sales@vendor.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-[#181a20] border-[#2d3139] text-white text-xs h-9 focus:border-[#fbb945]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-200">Tax ID / TIN</label>
                    <Input
                      placeholder="e.g. 1029384756"
                      value={taxId}
                      onChange={(e) => setTaxId(e.target.value)}
                      className="bg-[#181a20] border-[#2d3139] text-white text-xs h-9 focus:border-[#fbb945]"
                    />
                  </div>
                </div>

                {/* Address */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-200">Physical Address / Warehouse</label>
                  <Input
                    placeholder="e.g. 15 Warehouse Road, Ikeja, Lagos"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="bg-[#181a20] border-[#2d3139] text-white text-xs h-9 focus:border-[#fbb945]"
                  />
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-200">Internal Notes</label>
                  <textarea
                    rows={3}
                    placeholder="Payment terms, delivery schedules, preferred contact methods..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-[#181a20] border border-[#2d3139] rounded-md p-2.5 text-white text-xs focus:outline-none focus:border-[#fbb945] leading-relaxed resize-none"
                  />
                </div>

                {/* Status Toggle (Edit Mode) */}
                {currentMode === 'edit' && (
                  <div className="pt-2 flex items-center justify-between p-3.5 rounded-lg bg-[#14151a] border border-[#23262f]">
                    <div>
                      <span className="text-xs font-semibold text-white block">Vendor Status</span>
                      <span className="text-[11px] text-slate-400">
                        {isActive ? 'Supplier is active and available for receipts' : 'Supplier is deactivated'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsActive(!isActive)}
                      className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        isActive ? 'bg-[#fbb945]' : 'bg-[#2d3139]'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-black shadow-lg ring-0 transition duration-200 ease-in-out ${
                          isActive ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                )}

                {/* Actions Footer */}
                <div className="pt-4 border-t border-[#2d3139] flex items-center justify-end gap-2.5">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (currentMode === 'edit') setCurrentMode('view');
                      else triggerClose();
                    }}
                    className="border-[#2d3139] bg-[#14151a] text-slate-300 text-xs h-9"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={saving}
                    className="bg-[#fbb945] hover:bg-[#e5a83d] text-black font-bold text-xs h-9 px-4 gap-1.5 shadow-sm"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Saving Vendor...
                      </>
                    ) : currentMode === 'create' ? (
                      'Save Supplier'
                    ) : (
                      'Save Changes'
                    )}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
