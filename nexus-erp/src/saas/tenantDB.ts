"use client";

import { DatabaseState, createInitialDatabaseState } from "@/lib/db/database";

// ─── Per-tenant storage ────────────────────────────────────
// Each company gets its own localStorage key: nexus_tenant_{companyId}
// This means Company A's data is NEVER accessible by Company B.

function getKey(companyId: string): string {
  return `nexus_tenant_${companyId}`;
}

function createInitialTenantState(): DatabaseState {
  return createInitialDatabaseState();
}

// ─── In-memory cache — only ONE tenant loaded at a time ───
let _companyId: string | null = null;
let _state: DatabaseState | null = null;

export const TenantDB = {
  // ── Load a tenant's data into memory ──────────────────
  load(companyId: string): DatabaseState {
    if (_companyId === companyId && _state) return _state;

    _companyId = companyId;
    if (typeof window === "undefined") {
      const state = createInitialTenantState();
      _state = state;
      return state;
    }

    try {
      const raw = localStorage.getItem(getKey(companyId));
      const state = raw ? (JSON.parse(raw) as DatabaseState) : createInitialTenantState();
      _state = state;
      return state;
    } catch {
      const state = createInitialTenantState();
      _state = state;
      return state;
    }
  },

  // ── Get current tenant state (must call load first) ───
  get(): DatabaseState {
    const state = _state;
    if (!state || !_companyId) {
      throw new Error("No tenant loaded. Call TenantDB.load(companyId) first.");
    }
    return state;
  },

  // ── Current company ID ─────────────────────────────────
  getCurrentCompanyId(): string | null {
    return _companyId;
  },

  // ── Persist to localStorage ────────────────────────────
  save(): void {
    if (!_state || !_companyId || typeof window === "undefined") return;
    try {
      localStorage.setItem(getKey(_companyId), JSON.stringify(_state));
    } catch (e) {
      console.error("TenantDB.save failed:", e);
    }
  },

  // ── Auto-incrementing IDs (tenant-scoped) ─────────────
  nextId(type: keyof DatabaseState["counters"]): number {
    const state = this.get();
    const id = state.counters[type];
    state.counters[type]++;
    this.save();
    return id;
  },

  // ── Reset this tenant's data ───────────────────────────
  reset(): void {
    if (!_companyId) return;
    _state = createInitialTenantState();
    if (typeof window !== "undefined") {
      localStorage.removeItem(getKey(_companyId));
    }
  },

  // ── Unload tenant from memory ──────────────────────────
  unload(): void {
    _companyId = null;
    _state = null;
  },

  // ── Export tenant data (for backup) ───────────────────
  export(companyId: string): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(getKey(companyId));
  },

  // ── Import tenant data (from backup) ──────────────────
  import(companyId: string, jsonData: string): void {
    if (typeof window === "undefined") return;
    const parsed = JSON.parse(jsonData) as DatabaseState;
    localStorage.setItem(getKey(companyId), JSON.stringify(parsed));
    if (_companyId === companyId) {
      _state = parsed;
    }
  },

  // ── Get storage size for this tenant ──────────────────
  getStorageSize(companyId: string): number {
    if (typeof window === "undefined") return 0;
    const raw = localStorage.getItem(getKey(companyId));
    return raw ? new Blob([raw]).size : 0;
  },
};
