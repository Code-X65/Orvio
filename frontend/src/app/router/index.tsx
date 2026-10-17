import * as React from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { MarketingLayout } from '../../components/layout/MarketingLayout';

import { LandingPage } from '../../pages/marketing/LandingPage';
import { ProductsPage } from '../../pages/marketing/ProductsPage';
import { InventoryProductPage } from '../../pages/marketing/InventoryProductPage';
import { GymProductPage } from '../../pages/marketing/GymProductPage';
import { PlatformPage } from '../../pages/marketing/PlatformPage';
import { PricingPage } from '../../pages/marketing/PricingPage';
import { AboutPage } from '../../pages/marketing/AboutPage';
import { ContactPage } from '../../pages/marketing/ContactPage';
import { BlogPage } from '../../pages/marketing/BlogPage';
import { BlogPostPage } from '../../pages/marketing/BlogPostPage';
import { PrivacyPage } from '../../pages/marketing/PrivacyPage';
import { TermsPage } from '../../pages/marketing/TermsPage';
import { NotFoundPage } from '../../pages/marketing/NotFoundPage';
import { SignupPage } from '../../pages/auth/SignupPage';
import { LoginPage } from '../../pages/auth/LoginPage';
import { ForgotPasswordPage } from '../../pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '../../pages/auth/ResetPasswordPage';
import { VerifyEmailPage } from '../../pages/auth/VerifyEmailPage';
import { AcceptInvitePage } from '../../pages/auth/AcceptInvitePage';
import { TrialPage } from '../../pages/marketing/TrialPage';
import { TrialThanksPage } from '../../pages/marketing/TrialThanksPage';
import { TenantDashboardPage } from '../../pages/app/TenantDashboardPage';
import { InventoryPage } from '../../pages/app/InventoryPage';
import { AuthGuard } from '../guards/AuthGuard';
import { GuestGuard } from '../guards/GuestGuard';
import { SubdomainGuard } from '../guards/SubdomainGuard';
import { RbacRouteGuard } from '../guards/RbacRouteGuard';
import { isTenantSubdomain, getAccountsBaseUrl } from '../config/authUrls';

function RootRedirect({ path }: { path: string }) {
  React.useEffect(() => {
    const search = window.location.search;
    const base = getAccountsBaseUrl();
    window.location.replace(`${base}${path}${search}`);
  }, [path]);

  return null;
}

// Standard Marketing & Main App Router
export const marketingRouter = createBrowserRouter([
  {
    path: '/',
    element: <LandingPage />,
  },
  {
    element: <MarketingLayout />,
    children: [
      { path: 'products', element: <ProductsPage /> },
      { path: 'products/inventory', element: <InventoryProductPage /> },
      { path: 'products/gym', element: <GymProductPage /> },
      { path: 'platform', element: <PlatformPage /> },
      { path: 'pricing', element: <PricingPage /> },
      { path: 'about', element: <AboutPage /> },
      { path: 'contact', element: <ContactPage /> },
      { path: 'blog', element: <BlogPage /> },
      { path: 'blog/:slug', element: <BlogPostPage /> },
      { path: 'privacy', element: <PrivacyPage /> },
      { path: 'terms', element: <TermsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    path: '/dashboard',
    element: (
      <AuthGuard>
        <TenantDashboardPage />
      </AuthGuard>
    ),
  },
  {
    path: '/orvio',
    element: (
      <AuthGuard>
        <TenantDashboardPage />
      </AuthGuard>
    ),
  },
  {
    path: '/inventory',
    element: (
      <AuthGuard>
        <RbacRouteGuard requireApp="inventory">
          <InventoryPage />
        </RbacRouteGuard>
      </AuthGuard>
    ),
  },
  {
    path: '/inventory/*',
    element: (
      <AuthGuard>
        <RbacRouteGuard requireApp="inventory">
          <InventoryPage />
        </RbacRouteGuard>
      </AuthGuard>
    ),
  },
  {
    path: '/trial',
    element: <TrialPage />,
  },
  {
    path: '/thanks/trial',
    element: <TrialThanksPage />,
  },
  {
    path: '/signup',
    element: (
      <GuestGuard>
        <SignupPage />
      </GuestGuard>
    ),
  },
  {
    path: '/login',
    element: (
      <GuestGuard>
        <LoginPage />
      </GuestGuard>
    ),
  },
  {
    path: '/forgot-password',
    element: (
      <GuestGuard>
        <ForgotPasswordPage />
      </GuestGuard>
    ),
  },
  {
    path: '/reset-password',
    element: (
      <GuestGuard>
        <ResetPasswordPage />
      </GuestGuard>
    ),
  },
  {
    path: '/verify-email',
    element: <VerifyEmailPage />,
  },
  {
    path: '/invite',
    element: <AcceptInvitePage />,
  },
]);

// Dedicated Tenant Workspace Router (<subdomain>.localhost:4000 or <subdomain>.orvio.com)
export const tenantRouter = createBrowserRouter([
  {
    path: '/',
    element: (
      <AuthGuard>
        <TenantDashboardPage />
      </AuthGuard>
    ),
  },
  {
    path: '/dashboard',
    element: (
      <AuthGuard>
        <TenantDashboardPage />
      </AuthGuard>
    ),
  },
  {
    path: '/orvio',
    element: (
      <AuthGuard>
        <TenantDashboardPage />
      </AuthGuard>
    ),
  },
  {
    path: '/inventory',
    element: (
      <AuthGuard>
        <RbacRouteGuard requireApp="inventory">
          <InventoryPage />
        </RbacRouteGuard>
      </AuthGuard>
    ),
  },
  {
    path: '/inventory/*',
    element: (
      <AuthGuard>
        <RbacRouteGuard requireApp="inventory">
          <InventoryPage />
        </RbacRouteGuard>
      </AuthGuard>
    ),
  },
  {
    path: '/employees',
    element: (
      <AuthGuard>
        <RbacRouteGuard requireRole={['owner', 'manager']}>
          <TenantDashboardPage />
        </RbacRouteGuard>
      </AuthGuard>
    ),
  },
  {
    path: '/apps',
    element: (
      <AuthGuard>
        <RbacRouteGuard requireRole={['owner']}>
          <TenantDashboardPage />
        </RbacRouteGuard>
      </AuthGuard>
    ),
  },
  {
    path: '/settings',
    element: (
      <AuthGuard>
        <RbacRouteGuard requireRole={['owner', 'manager']}>
          <TenantDashboardPage />
        </RbacRouteGuard>
      </AuthGuard>
    ),
  },
  {
    path: '/trial',
    element: <RootRedirect path="/trial" />,
  },
  {
    path: '/thanks/trial',
    element: <RootRedirect path="/thanks/trial" />,
  },
  {
    path: '/signup',
    element: <RootRedirect path="/signup" />,
  },
  {
    path: '/login',
    element: (
      <GuestGuard>
        <LoginPage />
      </GuestGuard>
    ),
  },
  {
    path: '/forgot-password',
    element: (
      <GuestGuard>
        <ForgotPasswordPage />
      </GuestGuard>
    ),
  },
  {
    path: '/reset-password',
    element: (
      <GuestGuard>
        <ResetPasswordPage />
      </GuestGuard>
    ),
  },
  {
    path: '/verify-email',
    element: <VerifyEmailPage />,
  },
  {
    path: '/invite',
    element: <AcceptInvitePage />,
  },
  {
    path: '*',
    element: (
      <AuthGuard>
        <TenantDashboardPage />
      </AuthGuard>
    ),
  },
]);

export function AppRouter() {
  if (isTenantSubdomain()) {
    return (
      <SubdomainGuard>
        <RouterProvider router={tenantRouter} />
      </SubdomainGuard>
    );
  }

  return <RouterProvider router={marketingRouter} />;
}

