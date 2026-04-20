/**
 * TaxService — محرك حساب ضريبة القيمة المضافة
 *
 * يدعم:
 * - السعر شامل/غير شامل الضريبة (Inclusive / Exclusive)
 * - تقريب قياسي (Standard Rounding) لمنزلتين عشريتين
 * - إعفاء ضريبي على مستوى المنتج أو العميل/المورد
 */

export type VatMode = "exclusive" | "inclusive";

export interface LineTaxResult {
  grossAmount: number;  // المبلغ المدخل (qty × price × (1-disc%))
  subtotal:    number;  // المبلغ قبل الضريبة
  tax:         number;  // قيمة الضريبة
  total:       number;  // المجموع النهائي
  taxRate:     number;  // نسبة الضريبة المطبقة
  mode:        VatMode;
  exempt:      boolean; // هل هذا السطر معفى؟
}

export const TaxService = {
  /** تقريب قياسي لمنزلتين عشريتين */
  round(n: number): number {
    return Math.round(n * 100) / 100;
  },

  /**
   * حساب ضريبة سطر واحد
   * @param grossAmount  المبلغ الإجمالي (qty × سعر × (1 - خصم%))
   * @param taxRate      نسبة الضريبة (0.15 = 15%)
   * @param mode         exclusive = الضريبة تضاف فوق السعر | inclusive = الضريبة مضمّنة
   * @param exempt       true = معفى من الضريبة تماماً
   */
  calcLine(
    grossAmount: number,
    taxRate:     number,
    mode:        VatMode,
    exempt:      boolean,
  ): LineTaxResult {
    const g = this.round(grossAmount);

    if (exempt || taxRate === 0) {
      return { grossAmount: g, subtotal: g, tax: 0, total: g, taxRate, mode, exempt };
    }

    if (mode === "inclusive") {
      // استخراج الضريبة من السعر الشامل
      // subtotal = gross / (1 + rate)
      // tax = gross - subtotal
      const subtotal = this.round(g / (1 + taxRate));
      const tax      = this.round(g - subtotal);
      return { grossAmount: g, subtotal, tax, total: g, taxRate, mode, exempt };
    }

    // exclusive: الضريبة تُضاف فوق السعر
    const subtotal = g;
    const tax      = this.round(subtotal * taxRate);
    const total    = this.round(subtotal + tax);
    return { grossAmount: g, subtotal, tax, total, taxRate, mode, exempt };
  },

  /**
   * هل هذا السطر معفى؟
   * الأولوية: إعفاء العميل/المورد > إعفاء المنتج
   */
  isExempt(productExempt: boolean, counterpartyExempt: boolean): boolean {
    return counterpartyExempt || productExempt;
  },

  /**
   * تجميع نتائج الأسطر لحساب إجماليات الفاتورة
   */
  sumLines(lines: LineTaxResult[]): { subtotal: number; tax: number; total: number } {
    const subtotal = this.round(lines.reduce((s, l) => s + l.subtotal, 0));
    const tax      = this.round(lines.reduce((s, l) => s + l.tax,      0));
    const total    = this.round(subtotal + tax);
    return { subtotal, tax, total };
  },

  /**
   * تحويل نسبة الضريبة إلى نص عرض (مثال: "15%")
   */
  fmtRate(rate: number): string {
    return `${(rate * 100).toFixed(rate * 100 % 1 === 0 ? 0 : 2)}%`;
  },

  /**
   * تصدير بيانات ضريبة إلى CSV
   */
  exportCSV(
    rows: { id: string; date: string; party: string; subtotal: number; tax: number; total: number; type: "sale" | "purchase" }[],
    vatName: string,
    currency: string,
  ): string {
    const header = `رقم المستند,التاريخ,الطرف,الوعاء الضريبي,${vatName},الإجمالي,النوع`;
    const lines = rows.map((r) =>
      [r.id, r.date, `"${r.party}"`, r.subtotal.toFixed(2), r.tax.toFixed(2), r.total.toFixed(2), r.type === "sale" ? "بيع" : "شراء"].join(",")
    );
    return [header, ...lines].join("\n");
  },
};
