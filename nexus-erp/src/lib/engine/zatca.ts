/**
 * ZATCA Phase 1 — Simplified E-invoicing QR Code
 *
 * Encodes the 5 required TLV (Tag-Length-Value) fields as base64.
 * The resulting string is the content of the QR code printed on invoices.
 *
 * Tags:
 *  1 — Seller name (string)
 *  2 — VAT registration number (string)
 *  3 — Invoice date & time (ISO 8601)
 *  4 — Invoice total with VAT (decimal string)
 *  5 — VAT amount (decimal string)
 */

function tlvField(tag: number, value: string): Uint8Array {
  const encoded = new TextEncoder().encode(value);
  const buf = new Uint8Array(2 + encoded.length);
  buf[0] = tag;
  buf[1] = encoded.length;
  buf.set(encoded, 2);
  return buf;
}

function concatBuffers(...bufs: Uint8Array[]): Uint8Array {
  const total = bufs.reduce((s, b) => s + b.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const b of bufs) { result.set(b, offset); offset += b.length; }
  return result;
}

export interface ZATCAInvoiceData {
  sellerName:   string;
  vatNumber:    string;
  invoiceDate:  string; // ISO datetime or date string
  totalWithVat: number;
  vatAmount:    number;
}

export function generateZATCAQRContent(data: ZATCAInvoiceData): string {
  const datetime = data.invoiceDate.length === 10
    ? data.invoiceDate + "T00:00:00Z"
    : data.invoiceDate;

  const tlv = concatBuffers(
    tlvField(1, data.sellerName),
    tlvField(2, data.vatNumber || "000000000000000"),
    tlvField(3, datetime),
    tlvField(4, data.totalWithVat.toFixed(2)),
    tlvField(5, data.vatAmount.toFixed(2)),
  );

  // Base64 encode (avoid spread of Uint8Array for TS downlevel compat)
  if (typeof btoa !== "undefined") {
    let binary = "";
    for (let i = 0; i < tlv.length; i++) binary += String.fromCharCode(tlv[i]);
    return btoa(binary);
  }
  return Buffer.from(tlv).toString("base64");
}

export function zatcaQRDataURL(data: ZATCAInvoiceData): Promise<string> {
  const content = generateZATCAQRContent(data);
  return import("qrcode").then((QRCode) =>
    QRCode.toDataURL(content, {
      errorCorrectionLevel: "M",
      width: 200,
      margin: 1,
    })
  );
}
