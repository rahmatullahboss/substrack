import { getDb } from "./db";
import type { OrderItem } from "../schemas/order";

type Sql = ReturnType<typeof getDb>;

interface OrderForInvoice {
  order_id: number;
  order_number: string;
  customer_email: string;
  customer_name: string | null;
  order_date: string;
  items: OrderItem[];
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount: number;
  total_amount: number;
  currency: string;
  payment_method: string | null;
  notes: string | null;
}

interface InvoiceData {
  invoice_id: number;
  invoice_number: string;
  issued_date: string;
  due_date: string | null;
  status: string;
  notes: string | null;
}

export function getCurrencySymbol(currency: string): string {
  const map: Record<string, string> = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    JPY: "¥",
    BDT: "৳",
    INR: "₹",
  };
  return map[currency.toUpperCase()] ?? currency;
}

export function formatMoney(amount: number, currency: string): string {
  const sym = getCurrencySymbol(currency);
  return `${sym}${Number(amount).toFixed(2)}`;
}

export function computeOrderTotals(
  items: OrderItem[],
  taxRate: number,
  discount: number
): { subtotal: number; tax_amount: number; total_amount: number } {
  const subtotal = items.reduce(
    (sum, item) => sum + item.qty * item.unit_price,
    0
  );
  const tax_amount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
  const total_amount =
    Math.round((subtotal + tax_amount - discount) * 100) / 100;
  return { subtotal, tax_amount, total_amount };
}

export async function generateOrderNumber(sql: Sql): Promise<string> {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const result = (await sql`
    SELECT COUNT(*) as cnt FROM orders
    WHERE order_date = CURRENT_DATE
  `) as Array<{ cnt: number }>;
  const seq = String(Number(result[0].cnt) + 1).padStart(3, "0");
  return `ORD-${date}-${seq}`;
}

export async function generateInvoiceNumber(sql: Sql): Promise<string> {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const result = (await sql`
    SELECT COUNT(*) as cnt FROM invoices
    WHERE issued_date = CURRENT_DATE
  `) as Array<{ cnt: number }>;
  const seq = String(Number(result[0].cnt) + 1).padStart(3, "0");
  return `INV-${date}-${seq}`;
}

export function generateInvoiceHtml(
  order: OrderForInvoice,
  invoice: InvoiceData
): string {
  const sym = getCurrencySymbol(order.currency);

  const itemRows = order.items
    .map(
      (item) => `
      <tr>
        <td class="desc">${escapeHtml(item.description)}</td>
        <td class="num">${item.qty}</td>
        <td class="num">${sym}${Number(item.unit_price).toFixed(2)}</td>
        <td class="num bold">${sym}${(item.qty * item.unit_price).toFixed(2)}</td>
      </tr>`
    )
    .join("");

  const statusColor: Record<string, string> = {
    draft: "#94a3b8",
    sent: "#818cf8",
    paid: "#34d399",
    overdue: "#f87171",
    cancelled: "#6b7280",
  };

  const badgeColor = statusColor[invoice.status] ?? "#94a3b8";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${invoice.invoice_number}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', sans-serif;
      background: #f8fafc;
      color: #1e293b;
      padding: 32px;
    }
    .invoice-wrapper {
      max-width: 760px;
      margin: 0 auto;
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 4px 32px rgba(0,0,0,0.08);
      overflow: hidden;
    }
    .invoice-header {
      background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
      padding: 40px 48px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .brand { color: #fff; }
    .brand h1 { font-size: 1.8rem; font-weight: 700; letter-spacing: -0.5px; }
    .brand p { color: #a5b4fc; font-size: 0.85rem; margin-top: 4px; }
    .invoice-meta { text-align: right; }
    .invoice-meta .inv-num {
      font-size: 1.1rem;
      font-weight: 700;
      color: #a5b4fc;
    }
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 8px;
      color: #fff;
      background: ${badgeColor};
    }
    .invoice-body { padding: 40px 48px; }
    .bill-to-section {
      display: flex;
      justify-content: space-between;
      margin-bottom: 40px;
    }
    .bill-block h3 {
      font-size: 0.7rem;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 8px;
    }
    .bill-block p { font-size: 0.95rem; color: #1e293b; line-height: 1.6; }
    .bill-block .name { font-weight: 600; font-size: 1rem; }
    .dates-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      background: #f1f5f9;
      border-radius: 12px;
      padding: 20px 24px;
      margin-bottom: 32px;
    }
    .date-item h4 {
      font-size: 0.7rem;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 6px;
    }
    .date-item p { font-size: 0.95rem; font-weight: 600; color: #1e293b; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    thead tr { border-bottom: 2px solid #e2e8f0; }
    thead th {
      font-size: 0.7rem;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      padding: 12px 8px;
      text-align: left;
    }
    th.num, td.num { text-align: right; }
    tbody tr { border-bottom: 1px solid #f1f5f9; }
    tbody td {
      padding: 14px 8px;
      font-size: 0.9rem;
      color: #374151;
    }
    td.desc { color: #1e293b; }
    td.bold { font-weight: 600; color: #1e293b; }
    .totals-section {
      display: flex;
      justify-content: flex-end;
      margin-top: 8px;
    }
    .totals-box {
      min-width: 280px;
      background: #f8fafc;
      border-radius: 12px;
      padding: 20px 24px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 0;
      font-size: 0.9rem;
      color: #475569;
    }
    .totals-row.total {
      border-top: 2px solid #e2e8f0;
      margin-top: 8px;
      padding-top: 14px;
      font-size: 1.1rem;
      font-weight: 700;
      color: #1e293b;
    }
    .totals-row.total span:last-child { color: #4f46e5; }
    .notes-section {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #e2e8f0;
    }
    .notes-section h4 {
      font-size: 0.75rem;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 8px;
    }
    .notes-section p { font-size: 0.9rem; color: #475569; line-height: 1.6; }
    .invoice-footer {
      background: #f8fafc;
      padding: 24px 48px;
      text-align: center;
      font-size: 0.8rem;
      color: #94a3b8;
      border-top: 1px solid #e2e8f0;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .invoice-wrapper { box-shadow: none; border-radius: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="invoice-wrapper">
    <div class="invoice-header">
      <div class="brand">
        <h1>⚡ Substrack</h1>
        <p>Subscription Management</p>
      </div>
      <div class="invoice-meta">
        <div class="inv-num">${invoice.invoice_number}</div>
        <div class="status-badge">${invoice.status}</div>
      </div>
    </div>

    <div class="invoice-body">
      <div class="bill-to-section">
        <div class="bill-block">
          <h3>Bill To</h3>
          <p class="name">${escapeHtml(order.customer_name || "—")}</p>
          <p>${escapeHtml(order.customer_email)}</p>
        </div>
        <div class="bill-block" style="text-align:right">
          <h3>Order</h3>
          <p class="name">${order.order_number}</p>
          ${order.payment_method ? `<p style="color:#64748b;font-size:0.85rem">${escapeHtml(order.payment_method)}</p>` : ""}
        </div>
      </div>

      <div class="dates-grid">
        <div class="date-item">
          <h4>Invoice Date</h4>
          <p>${formatDateDisplay(invoice.issued_date)}</p>
        </div>
        <div class="date-item">
          <h4>Order Date</h4>
          <p>${formatDateDisplay(order.order_date)}</p>
        </div>
        <div class="date-item">
          <h4>Due Date</h4>
          <p>${invoice.due_date ? formatDateDisplay(invoice.due_date) : "—"}</p>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width:50%">Description</th>
            <th class="num">Qty</th>
            <th class="num">Unit Price</th>
            <th class="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
      </table>

      <div class="totals-section">
        <div class="totals-box">
          <div class="totals-row">
            <span>Subtotal</span>
            <span>${formatMoney(order.subtotal, order.currency)}</span>
          </div>
          ${
            order.tax_rate > 0
              ? `<div class="totals-row">
            <span>Tax (${order.tax_rate}%)</span>
            <span>${formatMoney(order.tax_amount, order.currency)}</span>
          </div>`
              : ""
          }
          ${
            order.discount > 0
              ? `<div class="totals-row">
            <span>Discount</span>
            <span style="color:#ef4444">-${formatMoney(order.discount, order.currency)}</span>
          </div>`
              : ""
          }
          <div class="totals-row total">
            <span>Total</span>
            <span>${formatMoney(order.total_amount, order.currency)}</span>
          </div>
        </div>
      </div>

      ${
        order.notes || invoice.notes
          ? `<div class="notes-section">
        <h4>Notes</h4>
        <p>${escapeHtml(order.notes ?? invoice.notes ?? "")}</p>
      </div>`
          : ""
      }
    </div>

    <div class="invoice-footer">
      <p>Thank you for your business! · Generated by Substrack</p>
    </div>
  </div>

  <div class="no-print" style="text-align:center;margin-top:24px">
    <button onclick="window.print()" style="
      background: #4f46e5; color: #fff; border: none;
      padding: 12px 32px; border-radius: 8px; font-size: 1rem;
      font-weight: 600; cursor: pointer; font-family: inherit;
    ">🖨️ Print / Save as PDF</button>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDateDisplay(d: string): string {
  try {
    return new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return d;
  }
}
