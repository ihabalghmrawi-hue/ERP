# Architecture Notes (MVP)

## Overview

- **Presentation**: Next.js App Router pages and lightweight reusable components.
- **Domain**: Pure TypeScript modules (`lib/ai`, `lib/followups`, `lib/whatsapp`) for business logic.
- **Data**: Supabase PostgreSQL with clear relational schema and indexes.
- **Integration**: Provider-based adapter for WhatsApp APIs.

## Scalability Plan

1. Replace mock data with Supabase repositories.
2. Move AI logic into queue/worker jobs for heavy scoring workloads.
3. Add Redis caching for dashboard aggregates.
4. Add row-level security and tenant_id for SaaS multi-tenancy.

## RBAC (Bonus)

- `admin`: full access to customers, insights, reports.
- `sales`: scoped access to owned leads, interactions, follow-ups.

## Future ML Upgrade

- Keep current explainable rules as fallback.
- Add Python microservice endpoint (`/predict`) to return calibrated scores.
- Persist model version and confidence in `ai_insights`.
