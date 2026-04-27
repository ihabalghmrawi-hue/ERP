# AI CRM MVP (Next.js + Supabase)

A simple, scalable, production-ready MVP CRM tailored for SMB sales teams (real estate, finishing companies, and general sales teams).

## Folder Structure

```txt
crm-ai-mvp/
├─ supabase/
│  ├─ schema.sql
│  └─ seed.sql
├─ src/
│  ├─ app/
│  │  ├─ crm/page.tsx
│  │  ├─ crm/customers/[id]/page.tsx
│  │  └─ api/
│  │     ├─ customers/route.ts
│  │     ├─ customers/[id]/route.ts
│  │     ├─ dashboard/route.ts
│  │     └─ reports/export/route.ts
│  ├─ components/
│  │  ├─ dashboard-kpis.tsx
│  │  ├─ customer-card.tsx
│  │  └─ followups-list.tsx
│  └─ lib/
│     ├─ ai/scoring.ts
│     ├─ ai/insights.ts
│     ├─ followups/scheduler.ts
│     ├─ whatsapp/provider.ts
│     └─ types.ts
└─ docs/
   └─ architecture.md
```

## MVP Features Included

- Customer CRUD API + interaction timeline.
- Explainable AI scoring and segmentation.
- Configurable lead scoring engine.
- Auto follow-up scheduler with snooze/manual override model.
- WhatsApp provider abstraction (provider-agnostic).
- Dashboard KPI + pipeline endpoint.
- Excel export endpoint (structured rows ready for `.xlsx` writer).
- Supabase-ready SQL schema with keys, indexes, timestamps.
- Seed data for fast local demo.

## Tech Notes

- Frontend: Next.js App Router + Tailwind-style utility classes in components.
- Backend: Supabase Postgres schema compatible SQL.
- API: REST route handlers (easy to migrate to server actions).
- AI: Rule-based scoring and recommendations, easy to tune.
- Future: plug Python ML microservice for advanced scoring.

## How to Integrate Quickly

1. Create a Next.js app (App Router, TypeScript, Tailwind).
2. Copy `src/*` into your app.
3. Run `supabase/schema.sql` then `supabase/seed.sql`.
4. Replace in-memory repository stubs with Supabase client queries.
5. Wire `/api/reports/export` to your preferred XLSX generator (e.g. `exceljs`).

