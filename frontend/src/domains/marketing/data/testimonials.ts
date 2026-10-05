import type { Testimonial } from '../types';

export const TESTIMONIALS_DATA: Testimonial[] = [
  {
    id: '1',
    name: 'Olumide Adeleke',
    role: 'Managing Director',
    company: 'PrimeCare Pharmacy Group',
    location: 'Ikeja & Victoria Island, Lagos',
    quote:
      'Before Orvio, tracking medicine expiries across our 4 branches was a nightmare. Orvio Inventory alerted us to over ₦1.8M worth of products near expiry in our first month alone. The WhatsApp receipts feature makes our customers feel super premium!',
    rating: 5,
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    appName: 'Orvio Inventory & POS',
    stat: '₦1.8M saved in avoided expiry waste',
  },
  {
    id: '2',
    name: 'Chidinma Okonjo',
    role: 'Founder & Head Coach',
    company: 'Elevate Fitness & Performance',
    location: 'Lekki Phase 1, Lagos',
    quote:
      'Orvio Gym completely transformed our front desk. Members now scan their QR codes on arrival in 2 seconds, and Paystack charges their monthly renewal without us chasing bank transfers. Our renewal rate jumped by 38% in 60 days.',
    rating: 5,
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    appName: 'Orvio Gym Management',
    stat: '+38% membership renewal increase',
  },
  {
    id: '3',
    name: 'Babatunde Fashina',
    role: 'CEO',
    company: 'Apex Gourmet Supermarkets & Cafe',
    location: 'Garki & Wuse 2, Abuja',
    quote:
      'Having a single login for both our retail supermarket POS and our attached fitness lounge is a game-changer. It gives us Odoo-level multi-app power with Nigerian ease of use and local Naira billing. Best business decision of 2026.',
    rating: 5,
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    appName: 'Orvio Platform Bundle',
    stat: '100% unified daily reconciliations',
  },
];
