import { Zap } from 'lucide-react';
import { SeoHead } from '../../components/seo/SeoHead';
import { SignupWizard } from '../../features/signup/SignupWizard';

export function SignupPage() {
  const getHomeUrl = () => {
    if (typeof window !== 'undefined') {
      const protocol = window.location.protocol;
      const hostname = window.location.hostname.replace(/^accounts\./, '');
      const port = window.location.port ? `:${window.location.port}` : '';
      return `${protocol}//${hostname}${port}/`;
    }
    return '/';
  };

  return (
    <>
      <SeoHead
        title="Start Your 14-Day Free Trial | Orvio Hub"
        description="Create your dedicated Orvio Hub workspace in 60 seconds. No credit card required."
      />

      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Background ambient lighting */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-10 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10">
          <a href={getHomeUrl()} className="inline-flex items-center gap-2.5 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 via-indigo-600 to-sky-400 text-white shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform">
              <Zap className="h-5 w-5 fill-white" />
            </div>
            <span className="text-2xl font-black tracking-tight text-white">
              Orvio<span className="text-indigo-400">Hub</span>
            </span>
          </a>
        </div>

        {/* Wizard Component */}
        <SignupWizard />
      </div>
    </>
  );
}