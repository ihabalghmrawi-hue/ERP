"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type QuickActionType =
  | "new_sale_invoice"
  | "new_purchase_invoice"
  | "new_customer"
  | "new_supplier"
  | "new_product"
  | "new_payment"
  | "new_journal_entry";

export interface PendingAction {
  type: QuickActionType;
  prefill?: Record<string, unknown>;
}

interface PendingActionContextType {
  action: PendingAction | null;
  dispatch: (action: PendingAction) => void;
  consume: (type: QuickActionType) => PendingAction | null;
  clear: () => void;
}

// ── Context ───────────────────────────────────────────────────────────────────

const PendingActionContext = createContext<PendingActionContextType>({
  action: null,
  dispatch: () => {},
  consume: () => null,
  clear: () => {},
});

export function PendingActionProvider({ children }: { children: ReactNode }) {
  const [action, setAction] = useState<PendingAction | null>(null);

  const dispatch = useCallback((a: PendingAction) => setAction(a), []);
  const clear    = useCallback(() => setAction(null), []);

  const consume = useCallback((type: QuickActionType): PendingAction | null => {
    if (action?.type === type) {
      const snapshot = action;
      setAction(null);
      return snapshot;
    }
    return null;
  }, [action]);

  return (
    <PendingActionContext.Provider value={{ action, dispatch, consume, clear }}>
      {children}
    </PendingActionContext.Provider>
  );
}

export function usePendingAction() {
  return useContext(PendingActionContext);
}
