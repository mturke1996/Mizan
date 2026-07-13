# ميزان (Mizan)

تطبيق ويب عربي لإدارة المحافظ والمعاملات والمشاريع والديون والتحليلات.

## التشغيل المحلي

```bash
npm ci
cp .env.example .env.local
# املأ VITE_SUPABASE_URL و VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev
```

## النشر على Vercel

1. اربط مستودع GitHub بمشروع Vercel جديد (Framework Preset: Vite).
2. أضف متغيرات البيئة:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
3. Build Command: `npm run build`
4. Output Directory: `dist`
5. بعد أول نشر، أضف نطاق Vercel إلى إعدادات Auth و CORS في Supabase إن لزم.

الملف [`vercel.json`](vercel.json) يضبط إعادة توجيه SPA لمسارات React Router.

## الأوامر

| الأمر | الغرض |
|-------|--------|
| `npm run build` | بناء الإنتاج |
| `npm run typecheck` | فحص TypeScript |
| `npm test` | اختبارات الوحدة |
