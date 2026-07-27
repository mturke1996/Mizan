# Design Spec: Executive Bento 2.0 Dashboard & Suite Overhaul

## 1. Vision & Architecture Overview
This specification details the comprehensive overhaul of Mizan's Dashboard & Application Suite. Building on the Executive Dark-Tech design system (`#0B0F19` canvas, Emerald `#10B981`, Warm Gold `#F59E0B`), this update introduces a **Bento 2.0 Motion-Engine Grid** with four high-impact executive interactive components and smart financial features.

## 2. New Executive Bento 2.0 Components
- **`CashFlowPredictor.tsx`**: AI Financial Runway Predictor & 90-Day Cash Projection. Calculates projected balance trends, safe monthly burn rate, remaining financial runway (in days/months), and dynamic AI financial advisory chips.
- **`ProjectProfitabilityMatrix.tsx`**: Interactive Project Risk & Profitability Heatmap. Visual grid displaying active projects sorted by ROI percentage, labor-to-revenue ratio, and status indicators with spring hover physics.
- **`QuickCommandBar.tsx`**: Rapid Financial Command & Shortcut Bar with Typewriter suggestions, quick transaction modal triggers, and instant search filter.
- **`DebtRecoveryTimeline.tsx`**: Chronological Waterfall Receivable & Debt Recovery Timeline card with client contact actions, due date urgency badges, and WhatsApp dispatch trigger.

## 3. Visual & Motion Standards (`design-taste-frontend-v1`)
- **Bento Card Styling**: Frosted glassmorphism (`backdrop-blur-md`, `border-white/10`, subtle `shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)]`).
- **Spring Physics**: Framer Motion `type: "spring", stiffness: 100, damping: 20` for all cards and dialogs.
- **Perpetual Micro-Interactions**: Isolated micro-components for pulse rings, live data tickers, and typewriter effects to ensure 60fps performance without parent re-renders.
- **Typography & Numerics**: High-legibility IBM Plex Sans Arabic combined with Monospace numeric formatting for financial amounts.

## 4. Integration into Dashboard Page
`DashboardPage.tsx` will be restructured into a dynamic 3-row Bento 2.0 Grid:
- **Row 1**: Executive Balance Overview & AI Runway Predictor (70/30 split)
- **Row 2**: Cash Flow & Metric Stream + Project Profitability Matrix (60/40 split)
- **Row 3**: Quick Command Bar + Debt Recovery Waterfall Timeline + Recent Transactions Stream

## 5. Verification Criteria
- `npm run typecheck`: Must pass with 0 errors.
- `npm run test`: All unit tests must pass.
- `npm run build`: Production bundle build check.
- `npm run cap:sync`: Sync build assets with Capacitor Android.
