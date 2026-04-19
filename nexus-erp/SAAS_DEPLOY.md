# 🚀 BOB ERP SaaS — دليل النشر والتشغيل الكامل

## 🗺 البنية المعمارية

```
┌─────────────────────────────────────────────────────┐
│                    SaaSShell                        │
│   (نقطة الدخول الرئيسية — يتحكم بكل الشاشات)       │
└─────────┬───────────────────────┬───────────────────┘
          │                       │
    ┌─────▼──────┐          ┌─────▼──────────────┐
    │ Super Admin│          │  Company ERP App   │
    │   Panel    │          │  (per tenant)       │
    └────────────┘          └────────────────────┘
          │                       │
    ┌─────▼──────┐          ┌─────▼──────────────┐
    │  SaaSDB    │          │    TenantDB         │
    │ (global)   │          │ (isolated per co.)  │
    └────────────┘          └────────────────────┘
    localStorage:           localStorage:
    nexus_saas_global       nexus_tenant_{id}
```

## 📦 الملفات الجديدة (SaaS Layer)

```
src/saas/
├── types.ts              ← تعريفات: Plan, Company, Subscription, SuperAdmin
├── saasDB.ts             ← قاعدة بيانات عالمية (شركات + مشرفون)
├── tenantDB.ts           ← قاعدة بيانات منعزلة لكل شركة
├── accessGuard.ts        ← حراسة الوصول: انتهاء الاشتراك + حدود الخطة
├── SaaSShell.tsx         ← Shell رئيسي: يوجّه بين كل الشاشات
├── ERPApp.tsx            ← تطبيق ERP مرتبط بالـ tenant
└── screens/
    ├── SuperAdminSetup.tsx   ← إعداد أول مدير (مرة واحدة)
    ├── SuperAdminLogin.tsx   ← دخول المدير العام
    ├── SuperAdminPanel.tsx   ← لوحة إدارة كل الشركات
    ├── CompanyLogin.tsx      ← دخول الشركات (2-step)
    ├── CompanyRegister.tsx   ← تسجيل شركة جديدة + اختيار خطة
    └── SubscriptionWall.tsx  ← شاشة انتهاء الاشتراك

deploy/
├── nginx.conf            ← Nginx reverse proxy + SSL
├── setup-vps.sh          ← إعداد VPS كامل (Ubuntu 22.04)
├── deploy.sh             ← نشر بدون توقف (zero-downtime)
├── Dockerfile            ← Docker multi-stage build
└── docker-compose.yml    ← Docker Compose (app + nginx + certbot)
```

---

## ⚡ تشغيل محلي (Development)

```bash
cd nexus-erp
npm install
npm run dev
# http://localhost:3000
```

**أول تشغيل:**
1. شاشة إنشاء **Super Admin** تظهر تلقائياً (مرة واحدة فقط)
2. بعدها: شاشة **تسجيل الدخول للشركات**
3. للوصول لـ Super Admin Panel: اضغط "دخول المدير العام" في أسفل شاشة الدخول

---

## 🛤 رحلة المستخدم الكاملة

### للعميل الجديد (Self-Service):
```
1. يزور الموقع → يضغط "سجّل مجاناً"
2. يختار خطته (trial/starter/pro/enterprise)
3. يملأ بيانات الشركة والمدير
4. يدخل مباشرة للنظام بفترة تجريبية 14 يوم
5. قبل انتهاء التجربة يُرسَل له إشعار
6. عند الانتهاء: شاشة SubscriptionWall تمنع الدخول
7. يتواصل معك للدفع وتجديد الاشتراك من Admin Panel
```

### للمدير العام (أنت):
```
1. تدخل من: /app ← "دخول المدير العام" (أسفل الصفحة)
2. ترى جميع الشركات + MRR + إحصائيات
3. تجدد اشتراك شركة: Subscriptions ← اختر الشركة ← تجديد
4. تعلّق شركة: Companies ← تعليق
5. تضيف شركة يدوياً: "شركة جديدة"
```

---

## 🏗 النشر على VPS (Ubuntu 22.04)

### الخطوة 1: إعداد السيرفر

```bash
# اتصل بالسيرفر
ssh root@YOUR_SERVER_IP

# حمّل المشروع
git clone https://github.com/YOUR_USERNAME/nexus-erp.git /var/www/nexus-erp
cd /var/www/nexus-erp

# شغّل سكريبت الإعداد الكامل
chmod +x deploy/setup-vps.sh
bash deploy/setup-vps.sh
```

### الخطوة 2: إعداد متغيرات البيئة

```bash
cd /var/www/nexus-erp
cp .env.example .env.production
nano .env.production
```

**القيم المطلوبة:**
```env
NEXT_PUBLIC_APP_URL=https://app.nexuserp.com   # دومينك الفعلي
NEXTAUTH_SECRET=GENERATE_THIS_WITH_OPENSSL      # openssl rand -base64 32
NODE_ENV=production
```

### الخطوة 3: بناء وتشغيل التطبيق

```bash
# تثبيت الحزم
npm ci

# بناء النسخة الإنتاجية
npm run build

# تشغيل مع PM2
pm2 start ecosystem.config.js --env production

# حفظ قائمة العمليات
pm2 save

# التحقق من التشغيل
pm2 status
pm2 logs nexus-erp --lines 20
```

### الخطوة 4: SSL مجاني مع Let's Encrypt

```bash
# استبدل app.nexuserp.com بدومينك
certbot --nginx -d app.nexuserp.com

# تجديد تلقائي (يُضاف للـ cron تلقائياً)
certbot renew --dry-run
```

### الخطوة 5: التحقق النهائي

```bash
# تحقق من Nginx
nginx -t && systemctl status nginx

# تحقق من التطبيق
curl -I https://app.nexuserp.com

# تحقق من PM2
pm2 status
```

---

## 🔄 النشر عند التحديث (Zero-Downtime)

```bash
cd /var/www/nexus-erp
bash deploy/deploy.sh
```

---

## 🐳 بديل: النشر بـ Docker

```bash
# بناء وتشغيل
docker-compose -f deploy/docker-compose.yml up -d --build

# مراقبة اللوجز
docker-compose -f deploy/docker-compose.yml logs -f app

# إيقاف
docker-compose -f deploy/docker-compose.yml down
```

---

## 📊 خطط الاشتراك

| الخطة      | السعر/شهر | المستخدمون | الفواتير/شهر | المستودعات |
|------------|-----------|------------|-------------|------------|
| تجريبي     | مجاني     | 2          | 20          | 1          |
| البداية    | 199 ريال  | 5          | 200         | 2          |
| الاحترافي  | 499 ريال  | 20         | غير محدود  | 10         |
| المؤسسي    | 999 ريال  | غير محدود | غير محدود  | غير محدود |

---

## 🔧 أوامر PM2 المفيدة

```bash
pm2 status                         # حالة جميع العمليات
pm2 logs nexus-erp                 # عرض اللوجز
pm2 logs nexus-erp --lines 100     # آخر 100 سطر
pm2 restart nexus-erp              # إعادة تشغيل
pm2 reload nexus-erp               # إعادة تحميل (بدون انقطاع)
pm2 stop nexus-erp                 # إيقاف
pm2 delete nexus-erp               # حذف من PM2
pm2 monit                          # مراقبة مباشرة
```

---

## 📁 هيكل البيانات في localStorage

```
nexus_saas_global        ← شركات + مشرفون عامون (SaaS layer)
nexus_saas_session       ← الجلسة الحالية
nexus_tenant_company_00001  ← بيانات الشركة الأولى
nexus_tenant_company_00002  ← بيانات الشركة الثانية
...
```

كل شركة لها مساحة بيانات منعزلة تماماً.

---

## 🔐 الأمان

- كل شركة معزولة بـ `company_id` في localStorage
- منع الوصول عند انتهاء الاشتراك (`accessGuard.ts`)
- Rate limiting في Nginx
- Security headers في `next.config.js`
- HTTPS إلزامي في الإنتاج

---

*BOB ERP SaaS v2.0 — جاهز للبيع والنشر*
