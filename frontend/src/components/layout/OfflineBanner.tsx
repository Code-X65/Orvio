import * as React from 'react';
import { WifiOff, Wifi } from 'lucide-react';

export function OfflineBanner() {
  const [isOnline, setIsOnline] = React.useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [showRestored, setShowRestored] = React.useState(false);
  const hideTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowRestored(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => {
        setShowRestored(false);
      }, 3500);
    };

    const handleOffline = () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      setShowRestored(false);
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  // If online and not showing the temporary restored notification, render nothing
  if (isOnline && !showRestored) {
    return null;
  }

  if (showRestored) {
    return (
      <aside
        aria-live="polite"
        className="fixed top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none select-none transition-all duration-300"
      >
        <div className="backdrop-blur-md bg-[#16181d]/95 border border-emerald-500/40 text-emerald-200 px-4 py-2 rounded-full shadow-2xl flex items-center gap-2.5 text-xs font-medium animate-in slide-in-from-top duration-300">
          <span className="relative flex h-2 w-2">
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
          <Wifi className="w-3.5 h-3.5 text-emerald-400" />
          <span>Connection restored — back online</span>
        </div>
      </aside>
    );
  }

  // Currently offline state
  return (
    <aside
      aria-live="assertive"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 select-none transition-all duration-300"
    >
      <div className="backdrop-blur-md bg-[#16181d]/95 border border-amber-500/40 text-amber-200 px-4 py-2 rounded-full shadow-2xl flex items-center gap-2.5 text-xs font-medium animate-in slide-in-from-top duration-300">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
        </span>
        <WifiOff className="w-3.5 h-3.5 text-amber-400" />
        <span>You're currently offline — changes will sync once reconnected</span>
      </div>
    </aside>
  );
}
