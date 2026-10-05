import * as React from 'react';
import { SeoHead } from '../../components/seo/SeoHead';
import { Badge } from '../../components/ui/badge';
import { ShieldCheck, Lock } from 'lucide-react';

export function PrivacyPage() {
  return (
    <>
      <SeoHead
        title="Privacy Policy & NDPA Compliance | Orvio Hub"
        description="Learn how Orvio Hub collects, processes, encrypts, and protects merchant and consumer data under the Nigeria Data Protection Act (NDPA)."
        keywords={['Orvio privacy policy', 'NDPA compliance Nigeria', 'Data security Orvio']}
      />

      <div className="py-12 mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-12">
        <header className="space-y-4">
          <Badge variant="glow">
            <ShieldCheck className="h-3.5 w-3.5 mr-1" />
            NDPA 2023 Compliant
          </Badge>
          <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight">
            Privacy & Data Protection Policy
          </h1>
          <p className="text-xs text-slate-500">
            Last updated: September 30, 2026 • Applies to all Orvio Hub software products and subdomains.
          </p>
        </header>

        <div className="prose prose-slate max-w-none space-y-8 text-sm text-slate-700 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900">1. Overview & Commitment</h2>
            <p>
              Orvio Technologies Ltd. ("Orvio", "we", "us", or "our") is dedicated to protecting the privacy, confidentiality, and security of our business customers ("Merchants") and their end-consumers. We adhere strictly to the <strong>Nigeria Data Protection Act (NDPA) 2023</strong> and international data protection standards.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900">2. Information We Collect</h2>
            <p>
              When you register and use Orvio Hub (including Inventory, POS, Gym, and custom organization subdomains), we collect:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Organization & Staff Details:</strong> Business name, CAC registration (where applicable), administrator names, email addresses, phone numbers, and cashier credentials.</li>
              <li><strong>Transaction & Inventory Data:</strong> SKU listings, sales receipts, customer phone numbers for WhatsApp e-receipt dispatch, and branch inventory logs.</li>
              <li><strong>Gym & Membership Data:</strong> Member names, subscription plans, check-in timestamps, and contact numbers for automated renewal nudges.</li>
              <li><strong>Payment Information:</strong> Handled securely via our PCI-DSS Level 1 certified partner (Paystack). Orvio never stores full debit card PAN numbers or CVVs.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900">3. How We Use Collected Information</h2>
            <p>We process collected data solely to:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Provide, maintain, and optimize Orvio Hub multi-app services and organization subdomains.</li>
              <li>Deliver automated customer purchase receipts and membership reminders via WhatsApp and email.</li>
              <li>Reconcile sales reports and process automated subscription billing in Nigerian Naira.</li>
              <li>Protect against fraud, inventory shrinkage, unauthorized access, and security breaches.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900">4. Data Storage, Isolation & Encryption</h2>
            <p>
              Every organization operates within an isolated tenant partition. All data in transit is encrypted using <strong>TLS 1.3</strong>, and data at rest is secured with <strong>AES-256 bit encryption</strong>. Daily automated backups are stored in geo-redundant secure cloud data facilities.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900">5. Your Rights Under NDPA</h2>
            <p>
              As a data subject under Nigerian law, you have the right to access, rectify, port, or request erasure of your personal data stored within our systems at any time.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900">6. Contact Our Data Protection Officer</h2>
            <p>
              For any privacy inquiries or NDPA rights requests, please contact our Data Protection Office at:
              <br />
              <strong>Email:</strong> privacy@orvio.com
              <br />
              <strong>Address:</strong> Adeola Odeku Street, Victoria Island, Lagos State, Nigeria.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
