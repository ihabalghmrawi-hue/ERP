"use client";

import { S, C } from "@/lib/engine/design";
import { useLang } from "@/hooks/useLang";
import { DB } from "@/lib/db/database";
import { fmt, fmtDate } from "@/lib/engine/helpers";
import { KPI }       from "@/components/ui/KPI";
import { DataTable } from "@/components/ui/DataTable";

interface Props { addToast: (msg: string, type?: "success" | "error" | "info") => void; }

export function Treasury({ addToast }: Props) {
  const { t } = useLang();
  const db = DB.get();

  const cashAccts = db.accounts.filter(
    (a) => a.type === "asset" && a.category === "current_asset"
  );
  const totalCash = cashAccts.reduce((s, a) => s + (a.balance || 0), 0);

  return (
    <div>
      <div style={S.pageTitle}>{t("treasuryTitle")}</div>
      <div style={S.pageSub}>{t("treasurySubtitle")}</div>

      <div style={S.grid(Math.min(cashAccts.length + 1, 4))}>
        <KPI label={t("totalCash")} value={fmt(totalCash)} color={C.success} icon="💰" />
        {cashAccts.slice(0, 3).map((a) => (
          <KPI key={a.id} label={a.name} value={fmt(a.balance || 0)} color={C.accentMid} icon="🏦" />
        ))}
      </div>

      <div style={S.card}>
        <div style={S.sectionHeader}>
          <div />
          <div style={S.sectionTitle}>{t("transactionLedger")} ({db.treasury.length})</div>
        </div>
        <DataTable
          headers={[
            { label: t("reconciled") }, { label: t("amount") }, { label: t("reference") },
            { label: t("description") }, { label: t("account") },
            { label: t("type") }, { label: t("date") }, { label: t("transactionId") },
          ]}
          rows={db.treasury.map((tx) => [
            tx.reconciled
              ? <span key="rec" style={S.badge("success")}>✓</span>
              : <span key="rec" style={S.badge("warning")}>—</span>,
            <span key="amt" style={{ fontWeight: 800, color: tx.amount >= 0 ? C.success : C.danger }}>
              {tx.amount >= 0 ? "+" : ""}{fmt(tx.amount)}
            </span>,
            <span key="ref" style={{ color: C.accentMid }}>{tx.ref || "—"}</span>,
            tx.description,
            tx.accountName || "—",
            <span key="tp" style={S.badge(tx.type === "receipt" ? "success" : tx.type === "payment" ? "danger" : "info")}>
              {tx.type === "receipt" ? t("receipt") : tx.type === "payment" ? t("payment") : t("transfer")}
            </span>,
            fmtDate(tx.date),
            <span key="id" style={{ color: C.textMuted, fontSize: 12 }}>{tx.id}</span>,
          ])}
          emptyMsg={t("noTxYet")}
        />
      </div>
    </div>
  );
}
