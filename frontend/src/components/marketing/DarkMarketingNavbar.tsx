import * as React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

export function DarkMarketingNavbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const location = useLocation();

  // Close mobile menu on location change
  React.useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <header className="w-full border-b border-[#31283c]/60 bg-[#121016]/90 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between py-4">
        {/* Brand Logo */}
        <div className="flex items-center justify-start">
          <Link
            to="/"
            className="group flex items-center space-x-1.5 focus:outline-none focus:ring-2 focus:ring-[#714b67] rounded-lg px-1 transition-transform duration-200 active:scale-95"
            aria-label="Orvio Home"
          >
            <span className="text-3xl font-extrabold tracking-tight text-white group-hover:text-amber-50 transition-colors">
              orvio
            </span>
            <span className="h-2.5 w-2.5 rounded-full bg-[#714b67] group-hover:bg-[#fbb945] animate-pulse transition-colors duration-300" />
          </Link>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center justify-center space-x-7 text-sm font-medium text-slate-300">
          <Link
            to="/#apps"
            className="nav-interactive-link hover:text-white transition-colors duration-150 py-1"
          >
            Apps
          </Link>
          <Link
            to="/platform"
            className="nav-interactive-link hover:text-white transition-colors duration-150 py-1"
          >
            Industries
          </Link>
          <Link
            to="/blog"
            className="nav-interactive-link hover:text-white transition-colors duration-150 py-1"
          >
            Community
          </Link>
          <Link
            to="/pricing"
            className="nav-interactive-link hover:text-white transition-colors duration-150 py-1"
          >
            Pricing
          </Link>
          <Link
            to="/contact"
            className="nav-interactive-link hover:text-white transition-colors duration-150 py-1"
          >
            Help
          </Link>
        </nav>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-3 sm:space-x-4">
          <Link
            to="/login"
            className="text-sm font-medium text-slate-300 hover:text-white px-3 py-2 transition-all duration-200 hover:scale-105 active:scale-95"
          >
            Sign in
          </Link>
          <Link
            to="/trial"
            className="shimmer-btn text-sm font-semibold text-white px-4 py-2 rounded-lg shadow-md hover:shadow-[#714b67]/40 hover:scale-105 active:scale-95 transition-all duration-200"
          >
            Try it free
          </Link>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden text-slate-300 hover:text-white p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#714b67]"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[#31283c]/60 bg-[#121016]/95 backdrop-blur-lg px-6 py-4 space-y-3">
          <Link
            to="/#apps"
            className="block py-2 text-base font-medium text-slate-200 hover:text-white"
          >
            Apps
          </Link>
          <Link
            to="/platform"
            className="block py-2 text-base font-medium text-slate-200 hover:text-white"
          >
            Industries
          </Link>
          <Link
            to="/blog"
            className="block py-2 text-base font-medium text-slate-200 hover:text-white"
          >
            Community
          </Link>
          <Link
            to="/pricing"
            className="block py-2 text-base font-medium text-slate-200 hover:text-white"
          >
            Pricing
          </Link>
          <Link
            to="/contact"
            className="block py-2 text-base font-medium text-slate-200 hover:text-white"
          >
            Help
          </Link>
        </div>
      )}
    </header>
  );
}
