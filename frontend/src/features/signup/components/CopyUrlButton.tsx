import * as React from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '../../../components/ui/button';

export interface CopyUrlButtonProps {
  url: string;
  className?: string;
}

export function CopyUrlButton({ url, className }: CopyUrlButtonProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Fallback or ignore
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className={`h-8 px-2.5 text-xs border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition-all ${className ?? ''}`}
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-emerald-400" />
          <span className="text-emerald-400 font-medium">Copied!</span>
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5 text-slate-400" />
          <span>Copy URL</span>
        </>
      )}
    </Button>
  );
}
