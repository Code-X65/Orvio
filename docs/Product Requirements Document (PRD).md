# Product Requirements Document: Orvio

**Version:** 0.9 (MVP-focused)  
**Date:** 2026-09-28  
**Owner:** Product (Code X / Orviohub team)

## Executive Summary

Orvio is a Nigerian, multi-tenant SaaS for small retailers and wholesalers. It unifies inventory, POS, WhatsApp orders, and local payments (Paystack, Flutterwave, and Moniepoint) in a lightweight system.

The MVP consists of Orvio Inventory, Orvio POS, a WhatsApp Orders channel, and a payments abstraction layer. Organizations, branches, products, stock movements, sales orders, and payment intents are core entities.

## Product Vision

### Vision

Enable Nigerian small businesses to sell everywhere and track everything with a simple, affordable, reliable operations platform.

### Mission

Provide a lightweight, Nigeria-native inventory and POS system that works offline, integrates WhatsApp selling, and accepts local payments without ERP complexity.

### Problem Statement

- Nigerian SMBs lose sales and profit visibility through stockouts, theft, and manual spreadsheets.
- Existing tools are too heavy and expensive, or too narrow.
- Internet and power unreliability make cloud-only POS risky.
- WhatsApp is a primary sales channel but rarely syncs automatically with inventory and payments.
- SMBs need Naira pricing, local support, and clear ROI.

### Value Proposition

- Owners see real stock, daily profit, and unified POS/WhatsApp sales.
- Staff get fast checkout, simple adjustments, and clear roles/PINs.
- Accountants get clean sales, tax, cost, export, and reconciliation data.

### Product Principles

1. Nigeria-first: Naira, VAT/WHT concepts, local receipts, WhatsApp, and local payment rails.
2. Lightweight by default: daily operating needs only.
3. Offline-capable POS.
4. Unified inventory ledger across POS, WhatsApp, and manual channels.
5. Transparent pricing.
6. NDPA-aware security, role-based access, and audit logs.

## Market and Users

### Target Market

- Primary: retailers, mini-marts, provision stores, pharmacies, fashion boutiques, and spare-parts shops in urban and semi-urban Nigeria.
- Secondary: wholesalers and distributors with one to five branches.

### User Roles

| Role | Core access | Must not |
|---|---|---|
| Owner-admin | Full organization admin, billing, roles, branches | Be locked out by staff |
| Store manager | Branch staff, approvals, reports | Change billing or audit logs |
| Cashier | POS sales, permitted discounts, approved voids | Change costs, access full profit reports |
| Storekeeper | Stock receipt, counts, adjustments | Approve high-value adjustments |
| Accountant | Read-only reports and exports | Modify stock or transactions |
| Support agent | Consent-based support/admin tools | Impersonate without consent |

## Goals

### Business Goals

- Acquire 100 paying SMBs in Lagos within six months.
- Achieve more than 80% 90-day retention.
- Maintain more than 70% SaaS gross margin.

### Product Goals

- Let merchants know daily sales and gross profit without manual calculation.
- Reduce stockouts and shrinkage through real-time stock visibility and controlled adjustments.
- Support product import and first sale within one day.
- Enable at least 30% of early merchants to take at least 10% of orders through WhatsApp within three months.
- Keep POS usable during typical outages.

## User Journeys

### Discovery to Sign-up to Onboarding

1. Visitor arrives from a landing page, referral, or WhatsApp ad and selects **Start Free**.
2. Registers with email/phone and password; OAuth may be added later.
3. Verifies email and phone.
4. Creates an organization with business name, timezone, Naira currency, address, and optional CAC/TIN/tax settings.
5. Creates the first branch (store or warehouse).
6. Imports products with CSV or adds them manually.
7. Optionally invites staff with a role and branch assignment.
8. Lands on the dashboard with stock summary and a **Create Sale** call to action.

Validation includes contact verification, password strength, optional CAC/TIN fields, duplicate-account handling, invalid CSV handling, and failed-invite handling. Send welcome, onboarding-tip, and invitation emails.

### Authentication

1. User signs in using email/phone and password.
2. The system validates credentials and establishes a session.
3. The user is routed to the dashboard or the next incomplete onboarding step.

### Initial Setup

The initial setup must create the organization, its first branch, and initial products before POS use. It should support manual product entry and CSV import, then offer staff invitations as an optional final step.

## Jobs to Be Done

- Owners need yesterday's sales, gross profit, and low-stock items each morning.
- Cashiers need fast checkout that continues during connectivity loss.
- Merchants need WhatsApp carts to become tracked orders with payment links.
- Storekeepers need reasoned receiving, damage, and adjustment records.

## Roadmap

- **0-6 months:** MVP launch with Inventory, POS, WhatsApp Orders, Payments, and 50-100 paying Lagos shops.
- **6-18 months:** Purchasing, advanced reporting, multi-branch optimization, and additional payment providers.
- **18+ months:** Ecommerce, light manufacturing, accounting, and logistics integrations.
