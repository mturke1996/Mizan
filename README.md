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
2. أضف متغيرات البيئة من ملف `.env.vercel` (محلي فقط):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` (مفتاح anon العام)
3. **لا تضف** `SUPABASE_SERVICE_ROLE_KEY` إلى Vercel — إضافة العملاء تتم عبر Edge Function على Supabase (`supervisor-customer-admin`) والمفتاح موجود هناك تلقائياً.
4. Build Command: `npm run build`
5. Output Directory: `dist`
6. بعد أول نشر، أضف نطاق Vercel إلى إعدادات Auth و CORS في Supabase إن لزم.

الملف [`vercel.json`](vercel.json) يضبط إعادة توجيه SPA لمسارات React Router.

## الأوامر

| الأمر | الغرض |
|-------|--------|
| `npm run build` | بناء الإنتاج |
| `npm run typecheck` | فحص TypeScript |
| `npm test` | اختبارات الوحدة |
