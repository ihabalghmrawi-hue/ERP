"use client";

import { DatabaseState, createInitialDatabaseState, createDefaultAccounts } from "@/lib/db/database";

// ─────────────────────────────────────────────────────────────────
// Storage key helpers
// ─────────────────────────────────────────────────────────────────

function getKey(companyId: string): string {
  return `nexus_tenant_${companyId}`;
}

// ─────────────────────────────────────────────────────────────────
// Data integrity: count meaningful records to compare two states
// Used to decide which copy (local vs server) is richer / newer
// ─────────────────────────────────────────────────────────────────

function dataScore(state: any): number {
  if (!state || typeof state !== "object") return -1;
  return (
    (state.invoices?.length         || 0) * 10 +
    (state.purchaseOrders?.length   || 0) * 10 +
    (state.customers?.length        || 0) * 5  +
    (state.suppliers?.length        || 0) * 5  +
    (state.products?.length         || 0) * 5  +
    (state.journalEntries?.length   || 0) * 3  +
    (state.users?.length            || 0) * 2
  );
}

// Returns true only if the state contains at least some real user data
function hasRealData(state: any): boolean {
  return dataScore(state) > 0;
}

// ─────────────────────────────────────────────────────────────────
// Migration: add missing fields without touching existing data
// Safe to run multiple times (idempotent)
// ─────────────────────────────────────────────────────────────────

function migrate(raw: any): DatabaseState {
  // If input is null/undefined/string, start fresh — never overwrite
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return createInitialDatabaseState();
  }

  const state = raw as DatabaseState;

  // Array fields — ensure they exist
  if (!Array.isArray(state.users))               state.users               = [];
  if (!Array.isArray(state.accounts))            state.accounts            = [];
  if (!Array.isArray(state.journalEntries))      state.journalEntries      = [];
  if (!Array.isArray(state.customers))           state.customers           = [];
  if (!Array.isArray(state.suppliers))           state.suppliers           = [];
  if (!Array.isArray(state.products))            state.products            = [];
  if (!Array.isArray(state.invoices))            state.invoices            = [];
  if (!Array.isArray(state.purchaseOrders))      state.purchaseOrders      = [];
  if (!Array.isArray(state.treasury))            state.treasury            = [];
  if (!Array.isArray(state.warehouses))          state.warehouses          = [];
  if (!Array.isArray(state.inventoryMovements))  state.inventoryMovements  = [];
  if (!Array.isArray(state.activityLog))         state.activityLog         = [];
  if (!Array.isArray(state.emailLog))            state.emailLog            = [];
  if (!Array.isArray(state.bankStatements))      state.bankStatements      = [];
  if (!Array.isArray(state.financialPeriods))    state.financialPeriods    = [];

  // Counters — add missing keys, never reset existing ones
  if (!state.counters || typeof state.counters !== "object") {
    state.counters = { je: 1, inv: 1, po: 1, tx: 1, bs: 1, fp: 1 };
  } else {
    const c = state.counters as Record<string, number>;
    if (!c.je || isNaN(c.je)) c.je = 1;
    if (!c.inv || isNaN(c.inv)) c.inv = 1;
    if (!c.po || isNaN(c.po)) c.po = 1;
    if (!c.tx || isNaN(c.tx)) c.tx = 1;
    if (!c.bs || isNaN(c.bs)) c.bs = 1;
    if (!c.fp || isNaN(c.fp)) c.fp = 1;
  }

  // Settings — merge with defaults, never wipe
  if (!state.settings || typeof state.settings !== "object") {
    state.settings = createInitialDatabaseState().settings;
  } else {
    const defaults = createInitialDatabaseState().settings;
    state.settings = { ...defaults, ...state.settings };
  }

  // Chart of accounts — seed defaults only if completely empty
  if (state.accounts.length === 0) {
    state.accounts = createDefaultAccounts();
  }

  // Backfill audit fields on journal entries (additive, never destructive)
  state.journalEntries = state.journalEntries.map((je: any) => ({
    createdAt:  je.createdAt  || (je.date ? je.date + "T00:00:00.000Z" : new Date().toISOString()),
    createdBy:  je.createdBy  || "system",
    sourceType: je.sourceType || "manual",
    sourceId:   je.sourceId   || je.reference || je.id || "",
    ...je, // existing fields always win
  }));

  return state;
}

// ─────────────────────────────────────────────────────────────────
// Read/write localStorage safely
// ─────────────────────────────────────────────────────────────────

function readLocal(companyId: string): DatabaseState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(getKey(companyId));
    if (!raw) return null;
    return JSON.parse(raw) as DatabaseState;
  } catch {
    return null;
  }
}

function writeLocal(companyId: string, state: DatabaseState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getKey(companyId), JSON.stringify(state));
  } catch (e) {
    console.error("[TenantDB] localStorage write failed:", e);
  }
}

// ─────────────────────────────────────────────────────────────────
// Push state to server (non-blocking, logs failures)
// ─────────────────────────────────────────────────────────────────

function pushToServer(companyId: string, state: DatabaseState, token: string): void {
  fetch(`/api/tenant/${companyId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(state),
  }).catch((err) => {
    console.error("[TenantDB] server sync failed:", err);
  });
}

// ─────────────────────────────────────────────────────────────────
// In-memory singleton
// ─────────────────────────────────────────────────────────────────

let _companyId: string | null = null;
let _state: DatabaseState | null = null;
let _token: string | null = null;

export const TenantDB = {
  // ── Set auth token after login ─────────────────────────
  setToken(token: string): void {
    _token = token;
  },

  // ── Load from localStorage (fast, called first on login) ─
  load(companyId: string): DatabaseState {
    if (_companyId === companyId && _state) return _state;
    _companyId = companyId;

    if (typeof window === "undefined") {
      _state = createInitialDatabaseState();
      return _state;
    }

    const local = readLocal(companyId);
    _state = local ? migrate(local) : createInitialDatabaseState();

    // Persist the migrated version back to localStorage
    writeLocal(companyId, _state);

    return _state;
  },

  // ── Sync from server — SAFE version ───────────────────
  //
  // Rules:
  //   1. If server fetch fails → keep localStorage, return null
  //   2. If server returns empty/null data AND local has real data
  //      → re-push local to server (recovery), keep local
  //   3. If server has richer data than local → use server
  //   4. If local is richer or equal → keep local, push local to server
  //
  async loadFromServer(companyId: string): Promise<DatabaseState | null> {
    if (!_token || typeof window === "undefined") return null;

    let serverRaw: any = null;
    try {
      const res = await fetch(`/api/tenant/${companyId}`, {
        headers: { Authorization: `Bearer ${_token}` },
      });
      if (res.ok) {
        serverRaw = await res.json();
      }
    } catch (err) {
      console.error("[TenantDB] loadFromServer fetch failed:", err);
      return null; // network error — use whatever we have locally
    }

    const localRaw = readLocal(companyId);
    const localScore  = dataScore(localRaw);
    const serverScore = dataScore(serverRaw);

    // ── Case 1: Server has no real data ──────────────────
    if (!hasRealData(serverRaw)) {
      if (hasRealData(localRaw)) {
        // Local has good data the server doesn't know about — push it up
        const recovered = migrate(localRaw!);
        _state = recovered;
        _companyId = companyId;
        if (_token) pushToServer(companyId, recovered, _token);
        console.info("[TenantDB] server was empty — restored from localStorage and re-synced");
      }
      return null; // keep using current local state
    }

    // ── Case 2: Server has data ───────────────────────────
    if (serverScore > localScore) {
      // Server is richer (e.g. logged in from another device)
      const merged = migrate(serverRaw);
      _companyId = companyId;
      _state = merged;
      writeLocal(companyId, merged);
      console.info(`[TenantDB] server data used (score ${serverScore} > local ${localScore})`);
      return merged;
    }

    // ── Case 3: Local is richer or equal ─────────────────
    // Use local, but sync it to server in background to keep server up to date
    if (localRaw && _token) {
      const localMigrated = migrate(localRaw);
      _state = localMigrated;
      _companyId = companyId;
      writeLocal(companyId, localMigrated);
      pushToServer(companyId, localMigrated, _token);
      console.info(`[TenantDB] local data kept (score ${localScore} >= server ${serverScore}), syncing to server`);
      return localMigrated;
    }

    return null;
  },

  // ── Get current state ──────────────────────────────────
  get(): DatabaseState {
    if (!_state || !_companyId) {
      throw new Error("[TenantDB] No tenant loaded. Call TenantDB.load(companyId) first.");
    }
    return _state;
  },

  getCurrentCompanyId(): string | null {
    return _companyId;
  },

  // ── Save: localStorage first (immediate) + server (background) ─
  save(): void {
    if (!_state || !_companyId || typeof window === "undefined") return;

    // 1. localStorage — immediate, synchronous
    writeLocal(_companyId, _state);

    // 2. Server — background, non-blocking
    if (_token) {
      pushToServer(_companyId, _state, _token);
    }
  },

  // ── Auto-incrementing IDs ──────────────────────────────
  nextId(type: keyof DatabaseState["counters"]): number {
    const state = this.get();
    const current = (state.counters as Record<string, number>)[type as string] || 1;
    (state.counters as Record<string, number>)[type as string] = current + 1;
    this.save();
    return current;
  },

  // ── Reset tenant data (wipes everything) ──────────────
  reset(): void {
    if (!_companyId) return;
    _state = createInitialDatabaseState();
    if (typeof window !== "undefined") {
      localStorage.removeItem(getKey(_companyId));
    }
  },

  // ── Unload from memory (on logout) ────────────────────
  unload(): void {
    _companyId = null;
    _state = null;
    _token = null;
  },

  // ── Export backup as JSON string ──────────────────────
  export(companyId: string): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(getKey(companyId));
  },

  // ── Import backup from JSON string ────────────────────
  import(companyId: string, jsonData: string): void {
    if (typeof window === "undefined") return;
    try {
      const parsed = migrate(JSON.parse(jsonData));
      writeLocal(companyId, parsed);
      if (_companyId === companyId) {
        _state = parsed;
        if (_token) pushToServer(companyId, parsed, _token);
      }
    } catch (e) {
      console.error("[TenantDB] import failed:", e);
    }
  },

  // ── Storage size in bytes ──────────────────────────────
  getStorageSize(companyId: string): number {
    if (typeof window === "undefined") return 0;
    const raw = localStorage.getItem(getKey(companyId));
    return raw ? new Blob([raw]).size : 0;
  },
};
