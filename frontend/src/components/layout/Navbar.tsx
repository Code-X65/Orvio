import * as React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Boxes,
  Dumbbell,
  Layers,
  ChevronDown,
  Menu,
  X,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';
import { getSignupUrl, getLoginUrl, getTrialUrl } from '../../app/config/authUrls';

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [productsOpen, setProductsOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const location = useLocation();

  React.useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close menus on route change
  React.useEffect(() => {
    setMobileMenuOpen(false);
    setProductsOpen(false);
  }, [location.pathname]);

  const navLinks = [
    { label: 'Platform', href: '/platform' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'About', href: '/about' },
    { label: 'Blog', href: '/blog' },
    { label: 'Contact', href: '/contact' },
  ];

  return (
    <header
      className={cn(
        'sticky top-0 z-40 w-full transition-all duration-300',
        scrolled
          ? 'bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-sm'
          : 'bg-white/70 backdrop-blur-sm border-b border-slate-100'
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 h-20">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-sky-500 text-white shadow-md shadow-indigo-500/25 group-hover:scale-105 transition-transform">
            <Zap className="h-5 w-5 fill-white text-white" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-extrabold tracking-tight text-slate-900">
                Orvio<span className="text-indigo-600">Hub</span>
              </span>
              <Badge variant="glow" className="text-[10px] px-1.5 py-0 font-bold hidden sm:inline-flex">
                NG
              </Badge>
            </div>
            <span className="text-[11px] font-medium text-slate-500 -mt-1 hidden sm:block">
              The Odoo for Nigerian Business
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-1 xl:gap-2">
          {/* Products Dropdown */}
          <div
            className="relative"
            onMouseEnter={() => setProductsOpen(true)}
            onMouseLeave={() => setProductsOpen(false)}
          >
            <button
              type="button"
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer',
                location.pathname.startsWith('/products')
                  ? 'text-indigo-600 bg-indigo-50/60 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              )}
              aria-expanded={productsOpen}
            >
              <span>Products</span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 transition-transform duration-200 text-slate-400',
                  productsOpen && 'rotate-180 text-indigo-600'
                )}
              />
            </button>

            {productsOpen && (
              <div className="absolute top-full left-0 w-80 pt-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="rounded-2xl border border-slate-200/90 bg-white p-3 shadow-xl ring-1 ring-black/5">
                  <div className="p-2 border-b border-slate-100 mb-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Modular Business Apps
                    </span>
                  </div>

                  <Link
                    to="/products/inventory"
                    className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors group/item"
                  >
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 group-hover/item:bg-indigo-600 group-hover/item:text-white transition-colors">
                      <Boxes className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-slate-900 group-hover/item:text-indigo-600">
                          Inventory & POS
                        </span>
                        <Badge variant="emerald" className="text-[10px] py-0 px-1.5">
                          Hot
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 leading-snug mt-0.5">
                        Stock control, barcode POS & WhatsApp receipts.
                      </p>
                    </div>
                  </Link>

                  <Link
                    to="/products/gym"
                    className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors group/item"
                  >
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 group-hover/item:bg-emerald-600 group-hover/item:text-white transition-colors">
                      <Dumbbell className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-slate-900 group-hover/item:text-emerald-600">
                          Gym Management
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 leading-snug mt-0.5">
                        Member subscriptions, QR check-in & bookings.
                      </p>
                    </div>
                  </Link>

                  <Link
                    to="/platform"
                    className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors group/item"
                  >
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600 group-hover/item:bg-sky-600 group-hover/item:text-white transition-colors">
                      <Layers className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-slate-900 group-hover/item:text-sky-600">
                        Platform Architecture
                      </span>
                      <p className="text-xs text-slate-500 leading-snug mt-0.5">
                        Multi-tenant subdomains & unified engine.
                      </p>
                    </div>
                  </Link>

                  <div className="mt-2 pt-2 border-t border-slate-100">
                    <Link
                      to="/products"
                      className="flex items-center justify-between px-2.5 py-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50/50 rounded-lg transition-colors"
                    >
                      <span>View All Products & Features</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>

          {navLinks.map((link) => {
            const isActive = location.pathname === link.href;
            return (
              <Link
                key={link.href}
                to={link.href}
                className={cn(
                  'px-3.5 py-2 text-sm font-medium rounded-lg transition-colors',
                  isActive
                    ? 'text-indigo-600 bg-indigo-50/60 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* CTA Actions */}
        <div className="hidden lg:flex items-center gap-3">
          <a
            href={getLoginUrl()}
            className="text-sm font-semibold text-slate-700 hover:text-indigo-600 px-3 py-2 transition-colors"
          >
            Sign In
          </a>
          <Link to="/trial">
            <Button variant="primary" size="default" className="shadow-sm">
              <Sparkles className="h-4 w-4" />
              <span>Start Free Trial</span>
            </Button>
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <div className="flex lg:hidden items-center gap-2">
          <Link to="/trial" className="sm:hidden">
            <Button variant="primary" size="sm">
              Try Free
            </Button>
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-b border-slate-200 bg-white/95 backdrop-blur-xl px-4 pt-2 pb-6 space-y-3 shadow-2xl animate-in slide-in-from-top-4 duration-200">
          <div className="space-y-1">
            <div className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-400">
              Apps & Products
            </div>
            <Link
              to="/products/inventory"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-800 hover:bg-indigo-50 font-medium"
            >
              <Boxes className="h-5 w-5 text-indigo-600" />
              <span>Orvio Inventory & POS</span>
            </Link>
            <Link
              to="/products/gym"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-800 hover:bg-emerald-50 font-medium"
            >
              <Dumbbell className="h-5 w-5 text-emerald-600" />
              <span>Orvio Gym Management</span>
            </Link>
            <Link
              to="/products"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-800 hover:bg-slate-100 font-medium text-sm text-indigo-600"
            >
              <Layers className="h-5 w-5" />
              <span>Explore All Products</span>
            </Link>
          </div>

          <div className="border-t border-slate-100 pt-3 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={cn(
                  'block px-3 py-2.5 rounded-xl text-base font-medium transition-colors',
                  location.pathname === link.href
                    ? 'bg-indigo-50 text-indigo-600 font-semibold'
                    : 'text-slate-700 hover:bg-slate-50'
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="border-t border-slate-100 pt-4 flex flex-col gap-2.5">
            <Link to="/trial" className="w-full">
              <Button variant="primary" size="lg" className="w-full">
                <Sparkles className="h-4 w-4" />
                <span>Start 14-Day Free Trial</span>
              </Button>
            </Link>
            <a
              href={getLoginUrl()}
              className="w-full text-center py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 rounded-xl"
            >
              Sign In to Your Workspace
            </a>
          </div>
        </div>
      )}
    </header>
  );
}

