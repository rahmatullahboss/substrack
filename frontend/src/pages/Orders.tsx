import { useState, useEffect, useCallback, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrderItem {
  description: string;
  qty: number;
  unit_price: number;
}

interface Order {
  order_id: number;
  order_number: string;
  subscription_id: number | null;
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
  status: "pending" | "paid" | "cancelled" | "refunded";
  payment_method: string | null;
  payment_date: string | null;
  notes: string | null;
  invoice_id: number | null;
  invoice_number: string | null;
  invoice_status: string | null;
}

interface OrderStats {
  total_orders: number;
  pending: number;
  paid: number;
  cancelled: number;
  refunded: number;
  total_revenue: number;
}

interface Toast {
  message: string;
  type: "success" | "error";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  pending: "badge-expiring",
  paid: "badge-active",
  cancelled: "badge-expired",
  refunded: "badge-expired",
};

const INVOICE_STATUS_COLORS: Record<string, string> = {
  draft: "badge-expiring",
  sent: "badge-expiring",
  paid: "badge-active",
  overdue: "badge-expired",
  cancelled: "badge-expired",
};

const PAYMENT_METHODS = ["", "bKash", "Cash", "Bank Transfer", "Card", "Stripe", "PayPal", "Other"];

function fmt(amount: number, currency = "USD") {
  const syms: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", BDT: "৳", INR: "₹" };
  return `${syms[currency] ?? currency}${Number(amount).toFixed(2)}`;
}

function fmtDate(d: string) {
  try {
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return d;
  }
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function calcTotals(items: OrderItem[], taxRate: number, discount: number) {
  const subtotal = items.reduce((s, i) => s + i.qty * i.unit_price, 0);
  const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
  const total = Math.round((subtotal + taxAmount - discount) * 100) / 100;
  return { subtotal, taxAmount, total };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Orders() {
  const navigate = useNavigate();
  const token = localStorage.getItem("substrack_token") || "";

  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [loading, setLoading] = useState(true);

  /* Filters */
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  /* Toast */
  const [toast, setToast] = useState<Toast | null>(null);
  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  /* Order modal */
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  /* Order form fields */
  const [formEmail, setFormEmail] = useState("");
  const [formName, setFormName] = useState("");
  const [formDate, setFormDate] = useState(today());
  const [formItems, setFormItems] = useState<OrderItem[]>([{ description: "", qty: 1, unit_price: 25 }]);
  const [formTaxRate, setFormTaxRate] = useState("0");
  const [formDiscount, setFormDiscount] = useState("0");
  const [formCurrency, setFormCurrency] = useState("USD");
  const [formPaymentMethod, setFormPaymentMethod] = useState("");
  const [formNotes, setFormNotes] = useState("");

  /* Invoice preview modal */
  const [previewInvoiceId, setPreviewInvoiceId] = useState<number | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [showPreview, setShowPreview] = useState(false);

  /* API helper */
  const apiCall = useCallback(
    async (url: string, options?: RequestInit) => {
      const res = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...options?.headers,
        },
      });
      if (res.status === 401) {
        localStorage.removeItem("substrack_token");
        navigate("/admin/login");
        return null;
      }
      return res;
    },
    [token, navigate]
  );

  /* Fetch orders */
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);

      const res = await apiCall(`/api/orders?${params}`);
      if (!res) return;
      const data = await res.json();
      setOrders(data.orders ?? []);
      setStats(data.stats ?? null);
    } catch {
      showToast("Failed to load orders", "error");
    } finally {
      setLoading(false);
    }
  }, [apiCall, search, statusFilter]);

  useEffect(() => {
    if (!token) { navigate("/admin/login"); return; }
    fetchOrders();
  }, [token, fetchOrders, navigate]);

  /* Form helpers */
  const resetForm = () => {
    setFormEmail(""); setFormName(""); setFormDate(today());
    setFormItems([{ description: "", qty: 1, unit_price: 25 }]);
    setFormTaxRate("0"); setFormDiscount("0"); setFormCurrency("USD");
    setFormPaymentMethod(""); setFormNotes(""); setEditingId(null);
  };

  const openAddModal = () => { resetForm(); setShowModal(true); };

  const openEditModal = (o: Order) => {
    setFormEmail(o.customer_email);
    setFormName(o.customer_name ?? "");
    setFormDate(o.order_date?.split("T")[0] ?? today());
    setFormItems(Array.isArray(o.items) ? o.items : []);
    setFormTaxRate(String(o.tax_rate ?? 0));
    setFormDiscount(String(o.discount ?? 0));
    setFormCurrency(o.currency ?? "USD");
    setFormPaymentMethod(o.payment_method ?? "");
    setFormNotes(o.notes ?? "");
    setEditingId(o.order_id);
    setShowModal(true);
  };

  /* Line item helpers */
  const updateItem = (idx: number, field: keyof OrderItem, value: string | number) => {
    setFormItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };

  const addItem = () => setFormItems(prev => [...prev, { description: "", qty: 1, unit_price: 25 }]);
  const removeItem = (idx: number) => setFormItems(prev => prev.filter((_, i) => i !== idx));

  /* Submit order */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    const body = {
      customer_email: formEmail,
      customer_name: formName || undefined,
      order_date: formDate,
      items: formItems.map(it => ({ ...it, qty: Number(it.qty), unit_price: Number(it.unit_price) })),
      tax_rate: parseFloat(formTaxRate) || 0,
      discount: parseFloat(formDiscount) || 0,
      currency: formCurrency,
      payment_method: formPaymentMethod || undefined,
      notes: formNotes || undefined,
    };

    try {
      const url = editingId ? `/api/orders/${editingId}` : "/api/orders";
      const method = editingId ? "PUT" : "POST";
      const res = await apiCall(url, { method, body: JSON.stringify(body) });
      if (!res) return;
      if (!res.ok) { const e = await res.json(); showToast(e.error || "Failed", "error"); return; }
      showToast(editingId ? "Order updated" : "Order created", "success");
      setShowModal(false); resetForm(); fetchOrders();
    } catch { showToast("Network error", "error"); }
    finally { setFormLoading(false); }
  };

  /* Pay order */
  const handlePay = async (id: number) => {
    const method = prompt("Payment method (e.g. bKash, Card, Cash):", "Cash");
    if (method === null) return;
    const res = await apiCall(`/api/orders/${id}/pay`, {
      method: "POST",
      body: JSON.stringify({ payment_method: method || undefined }),
    });
    if (!res) return;
    if (!res.ok) { const e = await res.json(); showToast(e.error || "Failed", "error"); return; }
    showToast("Order marked as paid ✓", "success");
    fetchOrders();
  };

  /* Cancel order */
  const handleCancel = async (id: number) => {
    if (!confirm("Cancel this order?")) return;
    const res = await apiCall(`/api/orders/${id}/cancel`, { method: "POST" });
    if (!res) return;
    if (!res.ok) { const e = await res.json(); showToast(e.error || "Failed", "error"); return; }
    showToast("Order cancelled", "success");
    fetchOrders();
  };

  /* Delete order */
  const handleDelete = async (id: number) => {
    if (!confirm("Delete this order permanently?")) return;
    const res = await apiCall(`/api/orders/${id}`, { method: "DELETE" });
    if (!res) return;
    if (!res.ok) { const e = await res.json(); showToast(e.error || "Failed", "error"); return; }
    showToast("Order deleted", "success");
    fetchOrders();
  };

  /* Generate invoice */
  const handleGenerateInvoice = async (orderId: number) => {
    const res = await apiCall("/api/invoices", {
      method: "POST",
      body: JSON.stringify({ order_id: orderId }),
    });
    if (!res) return;
    const data = await res.json();
    if (!res.ok) { showToast(data.error || "Failed", "error"); return; }
    showToast(`Invoice ${data.invoice.invoice_number} generated`, "success");
    fetchOrders();
  };

  /* View invoice HTML */
  const handleViewInvoice = async (invoiceId: number) => {
    setPreviewInvoiceId(invoiceId);
    const res = await apiCall(`/api/invoices/${invoiceId}/html`);
    if (!res) return;
    const html = await res.text();
    setPreviewHtml(html);
    setShowPreview(true);
  };

  /* Send invoice email */
  const handleSendInvoice = async (invoiceId: number) => {
    if (!confirm("Send invoice email to customer?")) return;
    const res = await apiCall(`/api/invoices/${invoiceId}/send`, { method: "POST" });
    if (!res) return;
    const data = await res.json();
    if (!res.ok) { showToast(data.error || "Failed", "error"); return; }
    showToast(`Invoice sent to ${data.to}`, "success");
    fetchOrders();
  };

  /* Computed totals */
  const { subtotal: fSubtotal, taxAmount: fTaxAmt, total: fTotal } = calcTotals(
    formItems, parseFloat(formTaxRate) || 0, parseFloat(formDiscount) || 0
  );

  const filteredOrders = orders;

  return (
    <div>
      {/* Navbar */}
      <nav className="navbar">
        <Link to="/admin" className="navbar-brand">⚡ <span>Substrack</span></Link>
        <div className="navbar-links">
          <Link to="/admin">Dashboard</Link>
          <Link to="/admin/orders" style={{ color: "var(--accent)" }}>Orders</Link>
          <Link to="/">Public</Link>
          <button onClick={() => { localStorage.removeItem("substrack_token"); navigate("/admin/login"); }}>Logout</button>
        </div>
      </nav>

      <div className="page-container fade-in">
        {/* Header */}
        <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 className="page-title">Orders & Invoices</h1>
            <p className="page-subtitle">Manage orders and generate invoices</p>
          </div>
          <button className="btn btn-primary" onClick={openAddModal}>+ New Order</button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="stats-grid">
            <div className="stat-card accent">
              <div className="stat-label">Total Orders</div>
              <div className="stat-value accent">{stats.total_orders}</div>
            </div>
            <div className="stat-card warning">
              <div className="stat-label">Pending</div>
              <div className="stat-value warning">{stats.pending}</div>
            </div>
            <div className="stat-card success">
              <div className="stat-label">Paid</div>
              <div className="stat-value success">{stats.paid}</div>
            </div>
            <div className="stat-card accent" style={{ background: "rgba(16,185,129,0.08)" }}>
              <div className="stat-label">Revenue</div>
              <div className="stat-value" style={{ color: "#34d399" }}>{fmt(Number(stats.total_revenue))}</div>
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="toolbar">
          <input
            type="text"
            className="form-input search-input"
            placeholder="Search by email, name or order #..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="filter-tabs">
            {["", "pending", "paid", "cancelled", "refunded"].map(f => (
              <button
                key={f}
                className={`filter-tab ${statusFilter === f ? "active" : ""}`}
                onClick={() => setStatusFilter(f)}
              >
                {f || "All"}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="loading"><div className="spinner" /></div>
        ) : filteredOrders.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📦</div>
            <p className="empty-state-text">No orders found</p>
            <button className="btn btn-primary" onClick={openAddModal}>Create your first order</button>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Invoice</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map(order => (
                  <tr key={order.order_id}>
                    <td>
                      <span style={{ fontFamily: "monospace", fontSize: "0.85rem", color: "var(--accent)" }}>
                        {order.order_number}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                        {order.customer_name || "—"}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{order.customer_email}</div>
                    </td>
                    <td>{fmtDate(order.order_date)}</td>
                    <td>
                      <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                        {fmt(order.total_amount, order.currency)}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${STATUS_COLORS[order.status] ?? "badge-active"}`}>
                        {order.status}
                      </span>
                    </td>
                    <td>
                      {order.invoice_number ? (
                        <span
                          className={`badge ${INVOICE_STATUS_COLORS[order.invoice_status ?? ""] ?? "badge-expiring"}`}
                          style={{ cursor: "pointer" }}
                          onClick={() => order.invoice_id && handleViewInvoice(order.invoice_id)}
                          title="Click to preview"
                        >
                          {order.invoice_number}
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>—</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                        {/* Pay */}
                        {order.status === "pending" && (
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => handlePay(order.order_id)}
                            title="Mark as paid"
                          >
                            ✓ Pay
                          </button>
                        )}
                        {/* Invoice */}
                        {!order.invoice_number && order.status !== "cancelled" && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleGenerateInvoice(order.order_id)}
                            title="Generate invoice"
                          >
                            🧾
                          </button>
                        )}
                        {order.invoice_id && (
                          <>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleViewInvoice(order.invoice_id!)}
                              title="Preview invoice"
                            >
                              👁
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleSendInvoice(order.invoice_id!)}
                              title="Email invoice"
                            >
                              ✉
                            </button>
                          </>
                        )}
                        {/* Edit */}
                        {order.status !== "paid" && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => openEditModal(order)}
                            title="Edit"
                          >
                            ✎
                          </button>
                        )}
                        {/* Cancel */}
                        {order.status === "pending" && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleCancel(order.order_id)}
                            title="Cancel"
                          >
                            ✕
                          </button>
                        )}
                        {/* Delete */}
                        {order.status !== "paid" && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(order.order_id)}
                            title="Delete"
                          >
                            🗑
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Create / Edit Order Modal ───────────────────────────────────────── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); resetForm(); }}>
          <div
            className="modal"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: "680px", width: "95vw", maxHeight: "90vh", overflowY: "auto" }}
          >
            <h2 className="modal-title">{editingId ? "Edit Order" : "New Order"}</h2>

            <form onSubmit={handleSubmit}>
              {/* Customer */}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Customer Email *</label>
                  <input
                    type="email" className="form-input" required autoFocus
                    placeholder="customer@email.com"
                    value={formEmail} onChange={e => setFormEmail(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Customer Name</label>
                  <input
                    type="text" className="form-input"
                    placeholder="John Doe"
                    value={formName} onChange={e => setFormName(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Order Date *</label>
                  <input
                    type="date" className="form-input" required
                    value={formDate} onChange={e => setFormDate(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Currency</label>
                  <select className="form-input" value={formCurrency} onChange={e => setFormCurrency(e.target.value)}>
                    {["USD", "EUR", "GBP", "BDT", "INR"].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Line Items */}
              <div className="form-group">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <label className="form-label" style={{ margin: 0 }}>Line Items *</label>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={addItem}>+ Add Item</button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {/* Items Header */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 110px 100px 32px", gap: "6px" }}>
                    <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Description</span>
                    <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Qty</span>
                    <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Unit Price</span>
                    <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Total</span>
                    <span />
                  </div>
                  {formItems.map((item, idx) => (
                    <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 80px 110px 100px 32px", gap: "6px", alignItems: "center" }}>
                      <input
                        className="form-input" style={{ padding: "8px 10px" }}
                        placeholder="Plan, Service, etc."
                        value={item.description}
                        onChange={e => updateItem(idx, "description", e.target.value)}
                        required
                      />
                      <input
                        type="number" className="form-input" style={{ padding: "8px 10px" }}
                        min="0.01" step="0.01"
                        value={item.qty}
                        onChange={e => updateItem(idx, "qty", parseFloat(e.target.value) || 0)}
                        required
                      />
                      <input
                        type="number" className="form-input" style={{ padding: "8px 10px" }}
                        min="0" step="0.01" placeholder="0.00"
                        value={item.unit_price}
                        onChange={e => updateItem(idx, "unit_price", parseFloat(e.target.value) || 0)}
                        required
                      />
                      <span style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: "0.9rem" }}>
                        {fmt(item.qty * item.unit_price, formCurrency)}
                      </span>
                      {formItems.length > 1 && (
                        <button type="button" onClick={() => removeItem(idx)} style={{
                          background: "none", border: "none", color: "var(--danger)",
                          cursor: "pointer", fontSize: "1rem", padding: "0",
                        }}>✕</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Tax, Discount */}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Tax Rate (%)</label>
                  <input
                    type="number" className="form-input" min="0" max="100" step="0.01"
                    value={formTaxRate} onChange={e => setFormTaxRate(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Discount ({formCurrency})</label>
                  <input
                    type="number" className="form-input" min="0" step="0.01"
                    value={formDiscount} onChange={e => setFormDiscount(e.target.value)}
                  />
                </div>
              </div>

              {/* Totals Summary */}
              <div style={{
                background: "var(--surface-hover)", borderRadius: "10px", padding: "16px",
                marginBottom: "16px", display: "flex", flexDirection: "column", gap: "6px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)", fontSize: "0.9rem" }}>
                  <span>Subtotal</span><span>{fmt(fSubtotal, formCurrency)}</span>
                </div>
                {parseFloat(formTaxRate) > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)", fontSize: "0.9rem" }}>
                    <span>Tax ({formTaxRate}%)</span><span>{fmt(fTaxAmt, formCurrency)}</span>
                  </div>
                )}
                {parseFloat(formDiscount) > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", color: "var(--danger)", fontSize: "0.9rem" }}>
                    <span>Discount</span><span>-{fmt(parseFloat(formDiscount), formCurrency)}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, color: "var(--text-primary)", fontSize: "1rem", borderTop: "1px solid var(--border)", paddingTop: "8px", marginTop: "4px" }}>
                  <span>Total</span><span style={{ color: "var(--accent)" }}>{fmt(fTotal, formCurrency)}</span>
                </div>
              </div>

              {/* Payment Method & Notes */}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Payment Method</label>
                  <select className="form-input" value={formPaymentMethod} onChange={e => setFormPaymentMethod(e.target.value)}>
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m || "Not specified"}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea
                  className="form-input" rows={2} style={{ resize: "vertical" }}
                  placeholder="Any additional notes..."
                  value={formNotes} onChange={e => setFormNotes(e.target.value)}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => { setShowModal(false); resetForm(); }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={formLoading}>
                  {formLoading ? "Saving..." : editingId ? "Update Order" : "Create Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Invoice Preview Modal ───────────────────────────────────────────── */}
      {showPreview && (
        <div className="modal-overlay" onClick={() => setShowPreview(false)}>
          <div
            className="modal"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: "820px", width: "95vw", maxHeight: "90vh", padding: 0, overflow: "hidden" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px", borderBottom: "1px solid var(--border)" }}>
              <h2 className="modal-title" style={{ margin: 0 }}>Invoice Preview</h2>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    const w = window.open("", "_blank");
                    if (w) { w.document.write(previewHtml); w.document.close(); }
                  }}
                >
                  🖨️ Open & Print
                </button>
                {previewInvoiceId && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => { handleSendInvoice(previewInvoiceId); setShowPreview(false); }}
                  >
                    ✉ Send Email
                  </button>
                )}
                <button className="btn btn-secondary btn-sm" onClick={() => setShowPreview(false)}>✕ Close</button>
              </div>
            </div>
            <iframe
              srcDoc={previewHtml}
              style={{ width: "100%", height: "70vh", border: "none", display: "block" }}
              title="Invoice Preview"
            />
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}
    </div>
  );
}
