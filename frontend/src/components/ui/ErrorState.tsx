import * as React from 'react';
import {
  AlertCircle,
  WifiOff,
  Database,
  ServerOff,
  ShieldAlert,
  Clock,
  RefreshCw,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
} from 'lucide-react';
import { Button } from './button';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { parseApiError, type ParsedError } from '../../lib/api/error-parser';

export interface ErrorSecondaryAction {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: React.ReactNode;
}

export interface ErrorStateProps {
  /** Raw error (Error, ApiError, string, or ParsedError) */
  error?: unknown;
  /** Explicit title override */
  title?: string;
  /** Explicit description override */
  description?: string;
  /** Callback when user clicks Retry */
  onRetry?: () => void | Promise<void>;
  /** Indicates whether a retry operation is currently pending */
  isRetrying?: boolean;
  /** Secondary navigation or action */
  secondaryAction?: ErrorSecondaryAction;
  /** Layout mode: 'page' for full-screen immersive view, 'card' for inline widgets/panels */
  variant?: 'page' | 'card';
  /** Additional styling classes */
  className?: string;
}

export function ErrorState({
  error,
  title: propTitle,
  description: propDescription,
  onRetry,
  isRetrying = false,
  secondaryAction = {
    label: 'Return to Launchpad',
    href: '/dashboard',
    icon: <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />,
  },
  variant = 'page',
  className = '',
}: ErrorStateProps) {
  const [showDiagnostics, setShowDiagnostics] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const parsed: ParsedError = React.useMemo(() => {
    if (error && typeof error === 'object' && 'category' in error && 'title' in error) {
      return error as ParsedError;
    }
    return parseApiError(error);
  }, [error]);

  const displayTitle = propTitle || parsed.title;
  const displayDescription = propDescription || parsed.description;

  // Select contextual visual icon & colors
  const getIconConfig = () => {
    switch (parsed.category) {
      case 'network':
        return {
          icon: <WifiOff className="w-5 h-5 text-amber-400" />,
          badgeBg: 'bg-amber-500/10 border border-amber-500/20',
        };
      case 'database':
        return {
          icon: <Database className="w-5 h-5 text-rose-400" />,
          badgeBg: 'bg-rose-500/10 border border-rose-500/20',
        };
      case 'server':
        return {
          icon: <ServerOff className="w-5 h-5 text-rose-400" />,
          badgeBg: 'bg-rose-500/10 border border-rose-500/20',
        };
      case 'rate-limit':
        return {
          icon: <Clock className="w-5 h-5 text-amber-400" />,
          badgeBg: 'bg-amber-500/10 border border-amber-500/20',
        };
      case 'auth':
        return {
          icon: <ShieldAlert className="w-5 h-5 text-rose-400" />,
          badgeBg: 'bg-rose-500/10 border border-rose-500/20',
        };
      default:
        return {
          icon: <AlertCircle className="w-5 h-5 text-rose-400" />,
          badgeBg: 'bg-rose-500/10 border border-rose-500/20',
        };
    }
  };

  const { icon, badgeBg } = getIconConfig();

  const handleCopyDiagnostics = () => {
    const diagnosticPayload = {
      title: displayTitle,
      category: parsed.category,
      statusCode: parsed.statusCode,
      errorCode: parsed.code,
      requestId: parsed.requestId,
      details: parsed.debugDetails,
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.href : '',
    };

    navigator.clipboard.writeText(JSON.stringify(diagnosticPayload, null, 2));
    setCopied(true);
    toast.success('Diagnostic details copied to clipboard');
    setTimeout(() => setCopied(false), 2500);
  };

  const renderContent = () => (
    <div className="max-w-md w-full text-center space-y-4 py-4">
      {/* Contextual Icon Badge */}
      <div className={`w-11 h-11 rounded-lg ${badgeBg} flex items-center justify-center mx-auto shadow-sm transition-transform duration-300 hover:scale-105`}>
        {icon}
      </div>

      {/* Title & User-friendly Description */}
      <div>
        <h2 className="text-base font-semibold text-white tracking-tight">
          {displayTitle}
        </h2>
        <p className="text-xs text-slate-400 mt-1.5 leading-relaxed px-4">
          {displayDescription}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-center gap-3 pt-2">
        {secondaryAction && (
          secondaryAction.href ? (
            <Link to={secondaryAction.href}>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8.5 px-3 rounded-md bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                {secondaryAction.icon}
                {secondaryAction.label}
              </Button>
            </Link>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={secondaryAction.onClick}
              className="text-xs h-8.5 px-3 rounded-md bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              {secondaryAction.icon}
              {secondaryAction.label}
            </Button>
          )
        )}

        {onRetry && (
          <Button
            onClick={() => onRetry()}
            disabled={isRetrying}
            size="sm"
            className="bg-[#985184] hover:bg-[#854372] active:bg-[#743763] text-white text-xs h-8.5 px-4 rounded-md font-semibold cursor-pointer shadow-sm disabled:opacity-60 transition-all flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
            {isRetrying ? 'Retrying...' : 'Retry'}
          </Button>
        )}
      </div>

      {/* Collapsible Technical Diagnostics */}
      <div className="pt-2">
        <button
          type="button"
          onClick={() => setShowDiagnostics((prev) => !prev)}
          className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors inline-flex items-center gap-1 cursor-pointer select-none"
        >
          <span>{showDiagnostics ? 'Hide technical details' : 'Technical details'}</span>
          {showDiagnostics ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {showDiagnostics && (
          <div className="mt-3 p-3 rounded-lg bg-black/40 border border-white/10 text-left text-[11px] text-slate-400 font-mono space-y-2 backdrop-blur-sm animate-in fade-in duration-200">
            {parsed.requestId && (
              <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-1.5">
                <span className="text-slate-500">Request ID:</span>
                <span className="text-slate-300 select-all truncate max-w-[200px]">{parsed.requestId}</span>
              </div>
            )}
            {parsed.statusCode !== undefined && (
              <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-1.5">
                <span className="text-slate-500">HTTP Status:</span>
                <span className="text-slate-300">{parsed.statusCode}</span>
              </div>
            )}
            {parsed.code && (
              <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-1.5">
                <span className="text-slate-500">Error Code:</span>
                <span className="text-slate-300">{parsed.code}</span>
              </div>
            )}
            {parsed.debugDetails && (
              <div className="pt-1">
                <span className="text-slate-500 block mb-1">Diagnostic Log:</span>
                <p className="text-[10px] text-slate-400 bg-white/5 p-2 rounded max-h-24 overflow-y-auto break-all font-mono">
                  {parsed.debugDetails}
                </p>
              </div>
            )}
            <div className="pt-1 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyDiagnostics}
                className="h-6 text-[10px] px-2 text-slate-400 hover:text-white hover:bg-white/10 rounded cursor-pointer flex items-center gap-1"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied' : 'Copy details'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (variant === 'card') {
    return (
      <div
        className={`w-full bg-[#16181d] border border-white/10 rounded-xl p-6 flex flex-col items-center justify-center shadow-lg relative overflow-hidden ${className}`}
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-12 bg-[#985184]/10 rounded-full blur-2xl pointer-events-none" />
        {renderContent()}
      </div>
    );
  }

  // Variant: 'page' (Full screen with ambient Orvio theme)
  return (
    <div
      className={`min-h-screen bg-[#111215] text-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans selection:bg-[#985184] selection:text-white ${className}`}
      style={{
        backgroundImage: 'radial-gradient(circle, rgba(255, 255, 255, 0.07) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
    >
      {/* Subtle Ambient Glow with #985184 */}
      <div className="fixed top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#985184]/12 rounded-full blur-[140px] pointer-events-none -z-10" />

      {renderContent()}
    </div>
  );
}
