import { useState, useEffect, FormEvent, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";

interface Subscription {
  subscription_id: number;
  customer_email: string;
  customer_name: string | null;
  plan_name: string;
  amount_paid: number | null;
  payment_date: string;
  expiry_date: string;
  duration_days: number;
  status: string;
  days_remaining: number;
  notes: string | null;
}

interface Stats {
  active_count: number;
  expiring_soon: number;
  expired_count: number;
  total_count: number;
}

interface Toast {
  message: string;
  type: "success" | "error";
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [token, setToken] = useState(localStorage.getItem("substrack_token") || "");
  const [subscriptions, setSubs] = useState<Subscription[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  // Form fields
  const [formEmail, setFormEmail] = useState("");
  const [formName, setFormName] = useState("");
  const [formPlan, setFormPlan] = useState("Monthly");
  const [formAmount, setFormAmount] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);
  const [formDuration, setFormDuration] = useState("30");
  const [formNotes, setFormNotes] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

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

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);

      const res = await apiCall(`/api/subscriptions?${params.toString()}`);
      if (!res) return;

      const data = await res.json();
      setSubs(data.subscriptions);
      setStats(data.stats);
    } catch (err) {
      showToast("Failed to load data", "error");
    } finally {
      setLoading(false);
    }
  }, [apiCall, search, statusFilter]);

  useEffect(() => {
    if (!token) {
      navigate("/admin/login");
      return;
    }
    fetchData();
  }, [token, fetchData, navigate]);

  const resetForm = () => {
    setFormEmail("");
    setFormName("");
    setFormPlan("Monthly");
    setFormAmount("");
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormDuration("30");
    setFormNotes("");
    setEditingId(null);
  };

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (sub: Subscription) => {
    setFormEmail(sub.customer_email);
    setFormName(sub.customer_name || "");
    setFormPlan(sub.plan_name);
    setFormAmount(sub.amount_paid?.toString() || "");
    setFormDate(sub.payment_date.split("T")[0]);
    setFormDuration(sub.duration_days.toString());
    setFormNotes(sub.notes || "");
    setEditingId(sub.subscription_id);
    setShowModal(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormLoading(true);

    const body = {
      customer_email: formEmail,
      customer_name: formName || undefined,
      plan_name: formPlan,
      amount_paid: formAmount ? parseFloat(formAmount) : undefined,
      payment_date: formDate,
      duration_days: parseInt(formDuration),
      notes: formNotes || undefined,
    };

    try {
      const url = editingId
        ? `/api/subscriptions/${editingId}`
        : "/api/subscriptions";
      const method = editingId ? "PUT" : "POST";

      const res = await apiCall(url, { method, body: JSON.stringify(body) });
      if (!res) return;

      if (!res.ok) {
        const err = await res.json();
        showToast(err.error || "Failed to save", "error");
        return;
      }

      showToast(editingId ? "Subscription updated" : "Subscription added", "success");
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (err) {
      showToast("Network error", "error");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this subscription?")) return;

    try {
      const res = await apiCall(`/api/subscriptions/${id}`, { method: "DELETE" });
      if (!res) return;

      showToast("Subscription deleted", "success");
      fetchData();
    } catch (err) {
      showToast("Failed to delete", "error");
    }
  };

  const handleRenew = async (id: number) => {
    const today = new Date().toISOString().split("T")[0];
    try {
      const res = await apiCall(`/api/subscriptions/${id}/renew`, {
        method: "POST",
        body: JSON.stringify({ payment_date: today, duration_days: 30 }),
      });
      if (!res) return;

      showToast("Subscription renewed!", "success");
      fetchData();
    } catch (err) {
      showToast("Failed to renew", "error");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("substrack_token");
    localStorage.removeItem("substrack_email");
    navigate("/admin/login");
  };

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return d;
    }
  };

  const getStatusBadge = (sub: Subscription) => {
    if (sub.status === "expired" || sub.days_remaining < 0) {
      return <span className="badge badge-expired">Expired</span>;
    }
    if (sub.days_remaining <= 3) {
      return <span className="badge badge-expiring">Expiring</span>;
    }
    return <span className="badge badge-active">Active</span>;
  };

  return (
    <div>
      {/* Navbar */}
      <nav className="navbar">
        <Link to="/admin" className="navbar-brand">
          ⚡ <span>Substrack</span>
        </Link>
        <div className="navbar-links">
          <Link to="/admin/orders">Orders</Link>
          <Link to="/">Public Page</Link>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </nav>

      <div className="page-container fade-in">
        {/* Header */}
        <div
          className="page-header"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">Manage your subscriptions</p>
          </div>
          <button className="btn btn-primary" onClick={openAddModal}>
            + Add Subscription
          </button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="stats-grid">
            <div className="stat-card accent">
              <div className="stat-label">Total</div>
              <div className="stat-value accent">{stats.total_count}</div>
            </div>
            <div className="stat-card success">
              <div className="stat-label">Active</div>
              <div className="stat-value success">{stats.active_count}</div>
            </div>
            <div className="stat-card warning">
              <div className="stat-label">Expiring Soon</div>
              <div className="stat-value warning">{stats.expiring_soon}</div>
            </div>
            <div className="stat-card danger">
              <div className="stat-label">Expired</div>
              <div className="stat-value danger">{stats.expired_count}</div>
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="toolbar">
          <input
            type="text"
            className="form-input search-input"
            placeholder="Search by email or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="filter-tabs">
            {["", "active", "expired", "cancelled"].map((f) => (
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
          <div className="loading">
            <div className="spinner" />
          </div>
        ) : subscriptions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <p className="empty-state-text">No subscriptions found</p>
            <button className="btn btn-primary" onClick={openAddModal}>
              Add your first subscription
            </button>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Plan</th>
                  <th>Payment</th>
                  <th>Expiry</th>
                  <th>Days Left</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((sub) => (
                  <tr key={sub.subscription_id}>
                    <td>
                      <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                        {sub.customer_name || "—"}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                        {sub.customer_email}
                      </div>
                    </td>
                    <td>{sub.plan_name}</td>
                    <td>{formatDate(sub.payment_date)}</td>
                    <td>{formatDate(sub.expiry_date)}</td>
                    <td>
                      <span
                        style={{
                          fontWeight: 700,
                          color:
                            sub.days_remaining <= 0
                              ? "var(--danger)"
                              : sub.days_remaining <= 3
                                ? "var(--warning)"
                                : "var(--success)",
                        }}
                      >
                        {sub.days_remaining > 0 ? sub.days_remaining : 0}
                      </span>
                    </td>
                    <td>{getStatusBadge(sub)}</td>
                    <td>
                      <div style={{ display: "flex", gap: "4px" }}>
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => handleRenew(sub.subscription_id)}
                          title="Renew"
                        >
                          ↻
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => openEditModal(sub)}
                          title="Edit"
                        >
                          ✎
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(sub.subscription_id)}
                          title="Delete"
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">
              {editingId ? "Edit Subscription" : "Add Subscription"}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Customer Email *</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="customer@email.com"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Customer Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="John Doe"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Payment Date *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Duration (Days)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={formDuration}
                    onChange={(e) => setFormDuration(e.target.value)}
                    min="1"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Plan Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Monthly"
                    value={formPlan}
                    onChange={(e) => setFormPlan(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Amount Paid</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="0.00"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    step="0.01"
                    min="0"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea
                  className="form-input"
                  placeholder="Any notes..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={2}
                  style={{ resize: "vertical" }}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={formLoading}
                >
                  {formLoading
                    ? "Saving..."
                    : editingId
                      ? "Update"
                      : "Add Subscription"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>{toast.message}</div>
      )}
    </div>
  );
}
