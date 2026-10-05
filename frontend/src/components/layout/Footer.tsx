import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  Zap,
  Mail,
  Phone,
  MapPin,
  ShieldCheck,
  Send,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { submitNewsletterSubscription } from '../../lib/contactService';

export function Footer() {
  const [email, setEmail] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [subscribed, setSubscribed] = React.useState(false);

  const handleNewsletter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    try {
      setLoading(true);
      const res = await submitNewsletterSubscription(email);
      toast.success(res.message);
      setSubscribed(true);
      setEmail('');
    } catch {
      toast.error('Failed to subscribe. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <footer className="bg-slate-950 text-slate-300 pt-16 pb-12 border-t border-slate-800">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Top Newsletter & Hook Bar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-12 border-b border-slate-800/80 items-center">
          <div className="lg:col-span-6">
            <h3 className="text-2xl font-bold text-white tracking-tight">
              Get the Orvio SME Growth Dispatch
            </h3>
            <p className="mt-2 text-sm text-slate-400 max-w-lg leading-relaxed">
              Join 2,400+ Nigerian retail, pharmacy, and gym entrepreneurs receiving our bi-weekly tactics on inventory efficiency, cash flow, and retail automation.
            </p>
          </div>

          <div className="lg:col-span-6">
            {subscribed ? (
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-300">
                <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                <span className="text-sm font-medium">
                  You are subscribed! Check your inbox for our latest retail playbook.
                </span>
              </div>
            ) : (
              <form onSubmit={handleNewsletter} className="flex flex-col sm:flex-row gap-3">
                <Input
                  type="email"
                  placeholder="Enter your business email..."
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-slate-900 border-slate-800 text-white placeholder:text-slate-500 h-12 rounded-xl focus:border-indigo-500"
                  required
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  disabled={loading}
                  className="shrink-0 h-12"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      <span>Subscribe</span>
                    </>
                  )}
                </Button>
              </form>
            )}
          </div>
        </div>

        {/* Main Footer Links */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 py-12">
          {/* Company Brand Column */}
          <div className="col-span-2 lg:col-span-2">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-sky-400 text-white">
                <Zap className="h-5 w-5 fill-white" />
              </div>
              <span className="text-xl font-extrabold text-white tracking-tight">
                Orvio<span className="text-indigo-400">Hub</span>
              </span>
            </Link>
            <p className="mt-4 text-sm text-slate-400 leading-relaxed max-w-sm">
              The modular business operating system engineered specifically for Nigerian retail, supermarkets, and fitness hubs. One platform. Multiple apps. Total control.
            </p>

            <div className="mt-6 space-y-2.5 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-indigo-400 shrink-0" />
                <span>Victoria Island, Lagos State, Nigeria</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-emerald-400 shrink-0" />
                <a href="tel:+23480000ORVIO" className="hover:text-white transition-colors">
                  +234 (0) 800 00 ORVIO
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-sky-400 shrink-0" />
                <a href="mailto:hello@orvio.com" className="hover:text-white transition-colors">
                  hello@orvio.com
                </a>
              </div>
            </div>
          </div>

          {/* Products Column */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Apps & Products
            </h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link to="/products/inventory" className="hover:text-white transition-colors">
                  Inventory & POS
                </Link>
              </li>
              <li>
                <Link to="/products/gym" className="hover:text-white transition-colors">
                  Gym Management
                </Link>
              </li>
              <li>
                <Link to="/platform" className="hover:text-white transition-colors">
                  Platform Architecture
                </Link>
              </li>
              <li>
                <Link to="/products" className="hover:text-white transition-colors">
                  All Apps Catalog
                </Link>
              </li>
              <li>
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  Accounting & Payroll <span className="text-[10px] text-indigo-400 font-semibold">(Soon)</span>
                </span>
              </li>
            </ul>
          </div>

          {/* Company Column */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Company
            </h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link to="/about" className="hover:text-white transition-colors">
                  About Orvio
                </Link>
              </li>
              <li>
                <Link to="/pricing" className="hover:text-white transition-colors">
                  Plans & Pricing
                </Link>
              </li>
              <li>
                <Link to="/blog" className="hover:text-white transition-colors">
                  Blog & Guides
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-white transition-colors">
                  Contact Support
                </Link>
              </li>
              <li>
                <a
                  href="https://wa.me/2348000000000?text=Hi%20Orvio%20Team%2C%20I%20would%20like%20to%20inquire%20about%20Orvio%20Hub"
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1.5"
                >
                  WhatsApp Helpdesk
                </a>
              </li>
            </ul>
          </div>

          {/* Legal & Compliance Column */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Legal & Trust
            </h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link to="/privacy" className="hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="hover:text-white transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <span className="flex items-center gap-1.5 text-xs text-emerald-400 mt-2">
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  <span>NDPA Compliant</span>
                </span>
              </li>
              <li>
                <span className="text-xs text-slate-400 block mt-1">
                  Paystack Secured 256-bit SSL
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Copyright */}
        <div className="pt-8 mt-4 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>© {new Date().getFullYear()} Orvio Technologies Ltd. All rights reserved. Built with pride for African business.</p>
          <div className="flex items-center gap-6">
            <Link to="/privacy" className="hover:text-slate-400">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-slate-400">
              Terms
            </Link>
            <Link to="/contact" className="hover:text-slate-400">
              Security
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
