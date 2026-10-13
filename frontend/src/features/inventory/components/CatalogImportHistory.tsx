import * as React from 'react';
import { History, ArrowRight, CheckCircle2, Clock, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import type { CatalogImportAudit } from '../catalog-api';
import { catalogApi } from '../catalog-api';

export function CatalogImportHistory() {
  const [imports, setImports] = React.useState<CatalogImportAudit[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchImports = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await catalogApi.getCatalogImports({ limit: 50 });
      setImports(res.imports);
    } catch (err: any) {
      setError(err?.message || 'Failed to load catalog import logs');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchImports();
  }, [fetchImports]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <History className="h-4 w-4 text-[#fbb945]" />
            Catalog Import History & Audit Log
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit trail of cross-branch product assignments and stock migrations
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchImports}
          disabled={loading}
          className="h-8 border-[#2d3139] bg-[#181a20] text-xs text-slate-300 hover:text-white"
        >
          <RefreshCw className={`mr-1.5 h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#2d3139] bg-[#141519]">
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-[#985184]" />
          </div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-rose-400">{error}</div>
        ) : imports.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No catalog imports have been recorded yet.
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#2d3139] bg-[#181a20]/60 text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Source → Target Branch</th>
                <th className="px-4 py-3 font-medium text-center">Products</th>
                <th className="px-4 py-3 font-medium">Stock Copied</th>
                <th className="px-4 py-3 font-medium">Imported By</th>
                <th className="px-4 py-3 font-medium">Notes</th>
                <th className="px-4 py-3 font-medium text-right">Date & Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2d3139]/60">
              {imports.map((item) => (
                <tr key={item.id} className="hover:bg-[#181a20]/50 transition-colors">
                  <td className="px-4 py-3 text-white font-medium">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-300">{item.source_branch_name}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                      <span className="text-[#fbb945] font-semibold">{item.target_branch_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex rounded-full bg-[#985184]/15 px-2 py-0.5 text-[11px] font-bold text-[#985184]">
                      {item.product_count}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {item.copy_stock ? (
                      <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px]">
                        Yes
                      </Badge>
                    ) : (
                      <Badge className="border-slate-500/30 bg-slate-500/10 text-slate-400 text-[10px]">
                        No (0 Stock)
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {item.user_name || 'System Admin'}
                  </td>
                  <td className="px-4 py-3 text-slate-400 truncate max-w-xs">
                    {item.notes || '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-400 font-mono text-[11px]">
                    {new Date(item.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
