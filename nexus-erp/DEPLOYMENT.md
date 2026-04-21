# BOB ERP — Vercel Deployment Guide

## 1. متطلبات قبل الـ Deploy

- حساب Vercel (Hobby أو Pro)
- قاعدة بيانات PostgreSQL (Vercel Postgres أو Neon أو Supabase)
- (اختياري) Upstash Redis للـ KV caching

---

## 2. إعداد قاعدة البيانات

### خيار أ — Vercel Postgres (الأسهل)
1. Vercel Dashboard → Storage → Create → Postgres
2. بعد الإنشاء: اضغط `.env.local` tab → نسخ القيم
3. المتغيرات ستكون: `POSTGRES_URL` أو `DATABASE_URL`

### خيار ب — Neon.tech (مجاني)
1. سجّل في neon.tech وأنشئ مشروع
2. انسخ Connection String
3. أضفه كـ `DATABASE_URL`

---

## 3. Environment Variables في Vercel

اذهب إلى: **Vercel Dashboard → المشروع → Settings → Environment Variables**

أضف المتغيرات التالية:

| المتغير | القيمة | ملاحظة |
|---|---|---|
| `DATABASE_URL` | `postgresql://...` | Connection string لـ PostgreSQL |
| `JWT_SECRET` | (random 48 chars) | `openssl rand -base64 48` |
| `JWT_REFRESH_SECRET` | (random 48 chars) | يجب أن يختلف عن JWT_SECRET |
| `NEXTAUTH_SECRET` | (random 32 chars) | `openssl rand -base64 32` |
| `SETUP_SECRET` | (random 24 chars) | `openssl rand -hex 24` — لإنشاء أول سوبر أدمن |
| `KV_REST_API_URL` | (من Upstash) | اختياري |
| `KV_REST_API_TOKEN` | (من Upstash) | اختياري |

> **تنبيه:** تأكد من تفعيل البيئات: Production + Preview + Development

---

## 4. إعدادات المشروع في Vercel

- **Root Directory:** `nexus-erp`
- **Framework Preset:** Next.js
- **Build Command:** `npm run build` (تلقائي)
- **Output Directory:** `.next` (تلقائي)

---

## 5. بعد أول Deploy — إنشاء السوبر أدمن

الـ migrations تشتغل **تلقائياً** عند أول request للـ API.

لإنشاء السوبر أدمن:

```bash
curl -X POST https://YOUR_APP.vercel.app/api/setup \
  -H "Content-Type: application/json" \
  -d '{
    "setupKey": "YOUR_SETUP_SECRET",
    "name": "اسم المدير",
    "email": "admin@yourcompany.com",
    "password": "StrongPassword123!"
  }'
```

بعد النجاح، احذف `SETUP_SECRET` من Environment Variables في Vercel (أمان إضافي).

---

## 6. التحقق من نجاح الـ Deploy

```bash
# التحقق أن الـ API يعمل
curl https://YOUR_APP.vercel.app/api/setup
# يجب أن يرجع: {"bootstrapped": true}

# التحقق أن الـ DB متصل
curl https://YOUR_APP.vercel.app/api/admin/stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 7. مشاكل شائعة

| المشكلة | الحل |
|---|---|
| `DATABASE_URL is not set` | تأكد من إضافة المتغير في Vercel وأن الـ deployment تم بعد إضافته |
| `JWT_SECRET must be set in production` | أضف `JWT_SECRET` في Environment Variables |
| الـ data لا تحفظ بعد redeploy | أضف Upstash Redis أو استخدم Vercel Postgres فقط (لا تعتمد على File System) |
| `SETUP_SECRET not set` | أضف المتغير مؤقتاً، أنشئ الأدمن، ثم احذفه |
