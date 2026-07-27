# Design Spec: Mizan App Rebrand & Comprehensive UI/UX Overhaul

## 1. Executive Summary & Goals
Mizan (ميزان) is a comprehensive financial and business management platform (Web + Android Capacitor app).
This project completely elevates the visual identity, application icon system across all platforms (Android mipmap levels, Web favicon, PWA icons, SVG mark), and delivers a high-end Executive Dark-Tech design system across the entire application interface.

## 2. Brand & Iconography System
- **Core Concept**: Modern Executive Geometric Balance Mark fused with abstract letter 'M' and security shield geometry.
- **Color Palette**:
  - Deep Canvas: `#0B0F19` / Dark Slate `#0F172A`
  - Emerald Accent: `#10B981` (Financial balance, positive growth)
  - Warm Gold Accent: `#F59E0B` (Wealth, precision, premium status)
  - Card & Surface: Slate dark `#1E293B` with high glass opacity & subtle 1px border glows (`rgba(255,255,255,0.08)`)
- **Icon Deliverables**:
  - `public/icons/mizan-mark.svg` — Precision vector SVG logo
  - `public/icons/mizan-192.png` — 192x192 PNG for PWA & web
  - `public/icons/mizan-512.png` — 512x512 PNG for PWA & web
  - `public/favicon.ico` / `public/apple-touch-icon.png`
  - `android/app/src/main/res/mipmap-*` — All Android launcher icons (hdpi, mdpi, xhdpi, xxhdpi, xxxhdpi)
  - Android splash screens and window background accents.

## 3. UI/UX & Design Tokens Overhaul
- **Typography**: IBM Plex Sans Arabic for crisp legibility and professional financial figures.
- **Glassmorphism & Micro-Interactions**:
  - Framer Motion page transitions and card hover elevation.
  - Interactive haptic feedback on mobile actions.
- **Components Enhanced**:
  - Dashboard: Hero financial overview, summary stats cards, interactive recharts, quick action speed dial.
  - Wallets & Transactions: Clean wallet cards, status badges, formatted currency chips.
  - Invoices & Debts: High-readability table layouts, customer ledger modals, PDF print previews.
  - Projects & Inventory: Multi-tab inventory, barcode scanner modal, stock level indicators.
  - Settings & Workspace: Workspace switcher, supervisor options, backup & sync status.

## 4. Technical Architecture & Quality Assurance
- **Tech Stack**: React 19, TypeScript, Vite, Tailwind CSS v4, Motion, Lucide React, Capacitor 8.
- **Quality Criteria**:
  - Clean build check (`npm run build`)
  - Typecheck validation (`npm run typecheck`)
  - Unit & snapshot tests (`npm run test`)
  - Android Capacitor sync (`npm run cap:sync`)
