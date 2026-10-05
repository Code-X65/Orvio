import type { AppProduct } from '../types';

export const APPS_DATA: AppProduct[] = [
  {
    id: 'inventory',
    slug: 'inventory',
    name: 'Orvio Inventory & POS',
    tagline: 'Smart stock control, fast checkout & automated WhatsApp receipts for Nigerian retail.',
    description:
      'Eliminate stockouts, track batch expiries, manage multiple store branches, and speed up checkout with integrated barcode scanning and Naira payments.',
    badge: 'Flagship App',
    status: 'available',
    monthlyPrice: 10000,
    annualPrice: 100000,
    features: [
      {
        title: 'Real-time Stock Tracking',
        description: 'Instant visibility on stock counts across warehouse, storefront, and online orders.',
        iconName: 'Boxes',
        tag: 'Core',
      },
      {
        title: 'High-speed POS Terminal',
        description: 'Fast barcode lookups, offline-mode cashier sync, split payments, and receipt printing.',
        iconName: 'ReceiptText',
        tag: 'Speed',
      },
      {
        title: 'WhatsApp E-Receipts & Alerts',
        description: 'Automatically send branded purchase receipts and restock alerts straight to customer WhatsApp.',
        iconName: 'MessageSquare',
        tag: 'Nigerian-first',
      },
      {
        title: 'Multi-Branch & Warehouse Sync',
        description: 'Transfer stock between Ikeja, Lekki, and Abuja branches with automated transit auditing.',
        iconName: 'Building2',
      },
      {
        title: 'Batch & Expiry Monitoring',
        description: 'First-In First-Out (FIFO) tracking with early warning alerts to prevent perishable wastage.',
        iconName: 'ClockAlert',
      },
      {
        title: 'Paystack & Card Integration',
        description: 'Accept direct Naira debit cards, bank transfers, and USSD payments with automatic reconciliation.',
        iconName: 'CreditCard',
      },
    ],
    benefits: [
      'Reduce inventory shrinkage and unrecorded loss by up to 88%',
      'Accelerate cashier checkout times from 2 minutes to under 20 seconds',
      'Instant real-time sales reports accessible from your smartphone anywhere',
      'No complicated server setup — works on laptops, tablets, and POS terminals',
    ],
    metrics: [
      { label: 'Faster Checkout', value: '4.5x' },
      { label: 'Shrinkage Reduction', value: '88%' },
      { label: 'Active Retailers', value: '350+' },
    ],
    useCases: [
      {
        title: 'Supermarkets & Mini-Marts',
        desc: 'Scan thousands of SKUs rapidly with barcode scanners and manage cash drawers effortlessly.',
        icon: 'ShoppingCart',
      },
      {
        title: 'Pharmacies & Chemist Stores',
        desc: 'Enforce expiry date tracking and keep precise records of prescription drug batches.',
        icon: 'Pill',
      },
      {
        title: 'Fashion & Boutique Stores',
        desc: 'Manage apparel size/color variants and generate instant WhatsApp receipts.',
        icon: 'Shirt',
      },
      {
        title: 'Wholesalers & Distributors',
        desc: 'Bulk inventory re-orders, credit customer balances, and multi-warehouse transfers.',
        icon: 'Truck',
      },
    ],
  },
  {
    id: 'gym',
    slug: 'gym',
    name: 'Orvio Gym Management',
    tagline: 'Automate member subscriptions, class scheduling & QR turnstile access for fitness hubs.',
    description:
      'Manage memberships, collect recurring Naira dues, automate workout session bookings, and track gym attendance with sleek QR code passes.',
    badge: 'Top Rated',
    status: 'available',
    monthlyPrice: 8000,
    annualPrice: 80000,
    features: [
      {
        title: 'Automated Membership Dues',
        description: 'Collect monthly, quarterly, and annual fees automatically via Paystack recurring billing.',
        iconName: 'CreditCard',
        tag: 'Automated',
      },
      {
        title: 'QR Code & Biometric Check-in',
        description: 'Speedy check-in via member digital passes, stopping unauthorized gym access.',
        iconName: 'QrCode',
        tag: 'Security',
      },
      {
        title: 'Class & Trainer Booking',
        description: 'Members can easily reserve slots for Spin, HIIT, Yoga, and Personal Training sessions.',
        iconName: 'CalendarCheck',
      },
      {
        title: 'WhatsApp Expiry Reminders',
        description: 'Send automated renewal nudges 7, 3, and 1 day before membership expiration.',
        iconName: 'BellRing',
        tag: 'Retention',
      },
      {
        title: 'Trainer Commissions & Payouts',
        description: 'Automatically compute trainer performance, private session fees, and monthly splits.',
        iconName: 'Users',
      },
      {
        title: 'Member Mobile Portal',
        description: 'Dedicated client interface for workout logging, payment receipts, and schedule viewing.',
        iconName: 'Smartphone',
      },
    ],
    benefits: [
      'Boost membership renewal rates by up to 34% with automated WhatsApp nudges',
      'Zero unauthorized entries with automated QR code validation at the front desk',
      'Effortless trainer scheduling without double-booked time slots',
      'Comprehensive cash flow and member retention analytics',
    ],
    metrics: [
      { label: 'Member Retention', value: '+34%' },
      { label: 'Check-in Speed', value: '< 2s' },
      { label: 'Active Gyms', value: '180+' },
    ],
    useCases: [
      {
        title: 'Commercial Fitness Centers',
        desc: 'Handle hundreds of daily members with automated gate access and tiered memberships.',
        icon: 'Dumbbell',
      },
      {
        title: 'Boutique Yoga & Pilates Studios',
        desc: 'Class capacity limits, waitlists, and pack passes for specialized instructors.',
        icon: 'Sparkles',
      },
      {
        title: 'CrossFit & Martial Arts Dojos',
        desc: 'Track member belt/level progression, event registrations, and equipment dues.',
        icon: 'Flame',
      },
      {
        title: 'Hotel & Residential Estate Gyms',
        desc: 'Resident authentication, guest day-passes, and facility usage monitoring.',
        icon: 'Building',
      },
    ],
  },
  {
    id: 'platform',
    slug: 'platform',
    name: 'Orvio Hub Platform Engine',
    tagline: 'The unified operating system uniting all your business apps under your custom domain.',
    description:
      'Just like Odoo, but optimized for African scale. One single login, one unified subscription, custom subdomains (e.g. acme.orvio.com), and instant modular scalability.',
    badge: 'Core Engine',
    status: 'available',
    monthlyPrice: 15000,
    annualPrice: 150000,
    features: [
      {
        title: 'Multi-Tenant Subdomains',
        description: 'Each organization gets an isolated, secure subdomain like yourcompany.orvio.com.',
        iconName: 'Globe',
        tag: 'Isolation',
      },
      {
        title: 'Unified Single Sign-On (SSO)',
        description: 'Switch seamlessly between Inventory, POS, and Gym without re-authenticating.',
        iconName: 'ShieldCheck',
      },
      {
        title: 'Centralized App Switcher',
        description: 'Launch and toggle between company tools in one click from the global top navigation.',
        iconName: 'LayoutGrid',
      },
      {
        title: 'Consolidated Billing & Wallet',
        description: 'Pay once for all apps in Naira with a single invoice and itemized tax receipts.',
        iconName: 'Wallet',
      },
      {
        title: 'Granular Role-Based Access',
        description: 'Assign Cashier, Manager, Accountant, and Admin roles with exact permission limits.',
        iconName: 'Lock',
      },
      {
        title: 'Open API & Webhooks',
        description: 'Connect to your accounting tools, custom hardware, or WhatsApp chatbots easily.',
        iconName: 'Code2',
      },
    ],
    benefits: [
      'Stop paying 5 separate software subscriptions across different vendors',
      'Zero sync lag between inventory, cashier desks, and executive dashboards',
      'Bank-grade AES-256 data encryption and NDPA compliance',
      'Modular architecture: install only what you need today, activate more tomorrow',
    ],
    metrics: [
      { label: 'Uptime SLA', value: '99.95%' },
      { label: 'Cost Savings', value: '65%' },
      { label: 'App Sync Latency', value: '< 50ms' },
    ],
    useCases: [
      {
        title: 'Multi-Service Enterprises',
        desc: 'Run a gym with an in-house protein shake bar and retail merchandise store on one unified platform.',
        icon: 'Layers',
      },
      {
        title: 'Expanding Chain Businesses',
        desc: 'Centralize management for 10+ retail locations across Lagos, Abuja, and Port Harcourt.',
        icon: 'Network',
      },
    ],
  },
];
