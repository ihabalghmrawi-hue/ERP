"use client";

import { DatabaseState, createInitialDatabaseState } from "@/lib/db/database";

// ─── Per-tenant storage ────────────────────────────────────────
// Primary:   server-side PostgreSQL (via API route /api/tenant/:id)
// Secondary: localStorage (instant local cache + offline support)

function getKey(companyId: string): string {
  return `nexus_tenant_${companyId}`;
}

function createInitialTenantState(): DatabaseState {
  return createInitialDatabaseState();
}

// ─── In-memory state ──────────────────────────────────────────
let _companyId: string | null = null;
let _state: DatabaseState | null = null;
let _token: string | null = null; // JWT for server API calls

export const TenantDB = {
  // ── Set auth token (call after login) ─────────────────
  setToken(token: string): void {
    _token = token;
  },

  // ── Load tenant into memory from localStorage ─────────
  load(companyId: string): DatabaseState {
    if (_companyId === companyId && _state) return _state;
    _companyId = companyId;

    if (typeof window === "undefined") {
      _state = createInitialTenantState();
      return _state;
    }

    try {
      const raw = localStorage.getItem(getKey(companyId));
      _state = raw ? (JSON.parse(raw) as DatabaseState) : createInitialTenantState();
      if (!_state.emailLog) _state.emailLog = [];
    } catch {
      _state = createInitialTenantState();
    }
    return _state;
  },

  // ── Sync from server → overwrites localStorage ────────
  // Call after login to hydrate data on a new device.
  async loadFromServer(companyId: string): Promise<DatabaseState | null> {
    if (!_token || typeof window === "undefined") return null;
    try {
      const res = await fetch(`/api/tenant/${companyId}`, {
        headers: { Authorization: `Bearer ${_token}` },
      });
      if (!res.ok) return null;
      const data = (await res.json()) as DatabaseState;
      if (!data.emailLog) data.emailLog = [];
      // Update in-memory + localStorage
      _companyId = companyId;
      _state = data;
      localStorage.setItem(getKey(companyId), JSON.stringify(data));
      return data;
    } catch {
      return null;
    }
  },

  // ── Get current tenant state ───────────────────────────
  get(): DatabaseState {
    if (!_state || !_companyId) {
      throw new Error("No tenant loaded. Call TenantDB.load(companyId) first.");
    }
    return _state;
  },

  getCurrentCompanyId(): string | null {
    return _companyId;
  },

  // ── Persist to localStorage + background server sync ──
  save(): void {
    if (!_state || !_companyId || typeof window === "undefined") return;

    // 1. Immediate localStorage write (keeps UI responsive)
    try {
      localStorage.setItem(getKey(_companyId), JSON.stringify(_state));
    } catch (e) {
      console.error("TenantDB.save (localStorage) failed:", e);
    }

    // 2. Fire-and-forget POST to server (PostgreSQL persistence)
    if (_token) {
      const id = _companyId;
      const body = JSON.stringify(_state);
      fetch(`/api/tenant/${id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${_token}`,
        },
        body,
      }).catch(() => {}); // non-blocking, non-fatal
    }
  },

  // ── Auto-incrementing IDs ─────────────────────────────
  nextId(type: keyof DatabaseState["counters"]): number {
    const state = this.get();
    const id = state.counters[type];
    state.counters[type]++;
    this.save();
    return id;
  },

  // ── Reset this tenant's data ──────────────────────────
  reset(): void {
    if (!_companyId) return;
    _state = createInitialTenantState();
    if (typeof window !== "undefined") {
      localStorage.removeItem(getKey(_companyId));
    }
  },

  // ── Unload tenant from memory ─────────────────────────
  unload(): void {
    _companyId = null;
    _state = null;
    _token = null;
  },

  // ── Export / Import (backup) ──────────────────────────
  export(companyId: string): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(getKey(companyId));
  },

  import(companyId: string, jsonData: string): void {
    if (typeof window === "undefined") return;
    const parsed = JSON.parse(jsonData) as DatabaseState;
    if (!parsed.emailLog) parsed.emailLog = [];
    localStorage.setItem(getKey(companyId), JSON.stringify(parsed));
    if (_companyId === companyId) _state = parsed;
  },

  getStorageSize(companyId: string): number {
    if (typeof window === "undefined") return 0;
    const raw = localStorage.getItem(getKey(companyId));
    return raw ? new Blob([raw]).size : 0;
  },
};
