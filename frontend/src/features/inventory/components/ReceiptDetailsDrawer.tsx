import * as React from 'react';
import {
  X,
  FileText,
  Building2,
  Calendar,
  Store,
  User,
  PackageCheck,
  DollarSign,
  ArrowRight,
  Loader2,
  Receipt,
  Layers,
  FileCheck2,
} from 'lucide-react';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { stockReceiptsApi, type StockReceiptDetail } from '../stock-receipts-api';

export interface ReceiptDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  receiptId?: string | null;
  onViewSupplier?: (supplierId: string) => void;
}

export function ReceiptDetailsDrawer({
  isOpen,
  onClose,
  receiptId,
  onViewSupplier,
}: ReceiptDetailsDrawerProps) {
  const [mounted, setMounted] = React.useState(isOpen);
  const [animating, setAnimating] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [receipt, setReceipt] = React.useState<StockReceiptDetail | null>(null);

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

  React.useEffect(() => {
    if (isOpen && receiptId) {
      setLoading(true);
      setErrorMsg(null);
      stockReceiptsApi
        .getReceipt(receiptId)
        .then((data) => {
          setReceipt(data);
        })
        .catch((err: any) => {
          setErrorMsg(err.message || 'Failed to load stock receipt details');
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setReceipt(null);
    }
  }, [isOpen, receiptId]);

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
          className={`w-screen max-w-2xl bg-[#121316] border-l border-[#2d3139] shadow-2xl flex flex-col pointer-events-auto transform transition-transform duration-300 ease-in-out ${
            animating ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-[#2d3139] flex items-center justify-between bg-[#16181d]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-white tracking-tight">
                    {receipt ? receipt.reference : 'Stock Receipt Details'}
                  </h2>
                  {receipt && (
                    <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-semibold uppercase">
                      {receipt.status}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Audit trail and product lines for confirmed stock intake
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
                <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                <p className="text-xs text-slate-400 font-medium">Loading receipt record...</p>
              </div>
            ) : errorMsg ? (
              <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {errorMsg}
              </div>
            ) : receipt ? (
              <div className="space-y-6">
                {/* Metrics Summary Strip */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-4 rounded-xl bg-[#181a20] border border-[#2d3139] space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Product Lines
                    </span>
                    <div className="text-xl font-bold font-mono text-white">
                      {receipt.lineCount}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#181a20] border border-emerald-500/20 space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                      Total Units Received
                    </span>
                    <div className="text-xl font-bold font-mono text-emerald-400">
                      +{receipt.totalQuantity.toLocaleString()}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#181a20] border border-[#2d3139] space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Total Cost
                    </span>
                    <div className="text-xl font-bold font-mono text-slate-200">
                      {receipt.totalCost !== null ? `₦${receipt.totalCost.toLocaleString()}` : '—'}
                    </div>
                  </div>
                </div>

                {/* Metadata Card */}
                <div className="p-4 rounded-xl bg-[#181a20] border border-[#2d3139] grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold uppercase text-slate-500 flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-slate-400" /> Supplier / Vendor
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{receipt.supplierName}</span>
                      {onViewSupplier && (
                        <button
                          onClick={() => {
                            triggerClose();
                            onViewSupplier(receipt.supplierId);
                          }}
                          className="text-[11px] text-blue-400 hover:text-blue-300 underline"
                        >
                          View Vendor
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold uppercase text-slate-500 flex items-center gap-1">
                      <Store className="w-3 h-3 text-slate-400" /> Destination Branch
                    </span>
                    <span className="font-semibold text-white">{receipt.branchName}</span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold uppercase text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" /> Receipt Date
                    </span>
                    <span className="font-mono text-slate-300">
                      {new Date(receipt.receiptDate).toLocaleString()}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold uppercase text-slate-500 flex items-center gap-1">
                      <User className="w-3 h-3 text-slate-400" /> Received By
                    </span>
                    <span className="font-medium text-slate-300">
                      {receipt.receivedByName || 'System / Storekeeper'}
                    </span>
                  </div>

                  {receipt.supplierInvoiceNumber && (
                    <div className="space-y-1 sm:col-span-2 pt-2 border-t border-[#23262f]">
                      <span className="text-[10px] font-semibold uppercase text-slate-500 flex items-center gap-1">
                        <FileText className="w-3 h-3 text-slate-400" /> Supplier Invoice / Delivery Note #
                      </span>
                      <span className="font-mono text-slate-200">{receipt.supplierInvoiceNumber}</span>
                    </div>
                  )}

                  {receipt.notes && (
                    <div className="space-y-1 sm:col-span-2 pt-2 border-t border-[#23262f]">
                      <span className="text-[10px] font-semibold uppercase text-slate-500">
                        Delivery Notes
                      </span>
                      <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{receipt.notes}</p>
                    </div>
                  )}
                </div>

                {/* Items Breakdown Table */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-[#fbb945]" />
                    <span>Received Products Breakdown</span>
                  </h4>

                  <div className="border border-[#2d3139] rounded-xl overflow-hidden bg-[#14151a]">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-[#2d3139] text-slate-400 font-medium bg-[#16181d]">
                          <th className="py-2.5 px-3">Product / SKU</th>
                          <th className="py-2.5 px-3 text-center">Qty Received</th>
                          <th className="py-2.5 px-3 text-right">Unit Cost</th>
                          <th className="py-2.5 px-3 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#23262f] text-slate-300">
                        {receipt.items.map((item) => (
                          <tr key={item.id} className="hover:bg-white/[0.02]">
                            <td className="py-3 px-3">
                              <div className="font-semibold text-white">{item.productName}</div>
                              <div className="text-[11px] font-mono text-slate-400">
                                SKU: {item.variantSku || item.productSku}
                              </div>
                              {item.notes && (
                                <div className="text-[10px] text-slate-400 italic mt-0.5">
                                  {item.notes}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className="font-mono font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                                +{item.quantityReceived}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-slate-300">
                              {item.unitCost !== null ? `₦${item.unitCost.toLocaleString()}` : '—'}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-semibold text-white">
                              {item.totalCost !== null ? `₦${item.totalCost.toLocaleString()}` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      {receipt.totalCost !== null && (
                        <tfoot>
                          <tr className="border-t border-[#2d3139] bg-[#16181d]/80 font-semibold text-white">
                            <td className="py-2.5 px-3">Total Estimated Value</td>
                            <td className="py-2.5 px-3 text-center font-mono text-emerald-400">
                              +{receipt.totalQuantity}
                            </td>
                            <td className="py-2.5 px-3"></td>
                            <td className="py-2.5 px-3 text-right font-mono text-[#fbb945]">
                              ₦{receipt.totalCost.toLocaleString()}
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>

                {/* Linked Stock Movements Audit Trail */}
                {receipt.movements && receipt.movements.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <FileCheck2 className="w-3.5 h-3.5 text-blue-400" />
                      <span>Ledger Balance Impacts</span>
                    </h4>

                    <div className="space-y-2">
                      {receipt.movements.map((m) => (
                        <div
                          key={m.id}
                          className="p-3 rounded-lg bg-[#14151a] border border-[#23262f] flex items-center justify-between text-xs"
                        >
                          <span className="font-mono text-slate-400 text-[11px]">
                            Movement ID: {m.id.slice(0, 12)}...
                          </span>
                          <div className="flex items-center gap-2 font-mono text-xs">
                            <span className="text-slate-400">{m.balanceBefore}</span>
                            <ArrowRight className="w-3 h-3 text-slate-600" />
                            <span className="text-emerald-400 font-bold">{m.balanceAfter} units</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
