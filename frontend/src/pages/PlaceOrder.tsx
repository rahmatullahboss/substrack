import { useState, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

interface OrderItem {
  description: string;
  qty: number;
  unit_price: number;
}

function calcTotal(items: OrderItem[]) {
  return items.reduce((s, i) => s + i.qty * i.unit_price, 0);
}

function fmt(n: number) {
  return `$${Number(n).toFixed(2)}`;
}

export default function PlaceOrder() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [items, setItems] = useState<OrderItem[]>([
    { description: "Monthly Plan", qty: 1, unit_price: 25 },
  ]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const updateItem = (idx: number, field: keyof OrderItem, value: string | number) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  };

  const addItem = () =>
    setItems((prev) => [...prev, { description: "", qty: 1, unit_price: 25 }]);

  const removeItem = (idx: number) =>
    setItems((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/public/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_email: email.trim(),
          customer_name: name.trim() || undefined,
          items: items.map((it) => ({
            description: it.description,
            qty: Number(it.qty),
            unit_price: Number(it.unit_price),
          })),
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }

      // Redirect to public invoice page
      navigate(`/invoice/${data.invoice_number}`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const total = calcTotal(items);

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: "#fff", minHeight: "100vh", color: "#111827" }}>

      {/* Navbar */}
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 48px", borderBottom: "1px solid #f3f4f6",
        position: "sticky", top: 0, background: "rgba(255,255,255,0.95)",
        backdropFilter: "blur(12px)", zIndex: 100,
      }}>
        <Link to="/" style={{ fontWeight: 800, fontSize: "1.2rem", color: "#4f46e5", textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
          ⚡ Substrack
        </Link>
        <Link to="/" style={{ color: "#6b7280", fontSize: "0.9rem", textDecoration: "none", fontWeight: 500 }}>
          ← Back
        </Link>
      </nav>

      {/* Main */}
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "56px 24px" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{
            display: "inline-block", padding: "5px 14px", background: "#ede9fe",
            borderRadius: 20, color: "#7c3aed", fontSize: "0.75rem",
            fontWeight: 700, marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.5px",
          }}>
            Place Order
          </div>
          <h1 style={{ fontSize: "2rem", fontWeight: 900, color: "#111827", marginBottom: 8, letterSpacing: "-0.5px" }}>
            Subscribe to Substrack
          </h1>
          <p style={{ color: "#6b7280", fontSize: "1rem", lineHeight: 1.6 }}>
            Fill in your details below. You'll receive an invoice instantly.
          </p>
        </div>

        {/* Form Card */}
        <form onSubmit={handleSubmit} style={{
          background: "#fafafa", border: "1.5px solid #e5e7eb",
          borderRadius: 20, padding: "36px", display: "flex", flexDirection: "column", gap: 20,
        }}>

          {/* Customer Info */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#374151", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.3px" }}>
                Email *
              </label>
              <input
                type="email" required autoFocus
                placeholder="you@email.com"
                value={email} onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "#4f46e5")}
                onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#374151", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.3px" }}>
                Name
              </label>
              <input
                type="text"
                placeholder="Your name"
                value={name} onChange={(e) => setName(e.target.value)}
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "#4f46e5")}
                onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
              />
            </div>
          </div>

          {/* Line Items */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.3px" }}>
                Items *
              </label>
              <button type="button" onClick={addItem} style={smBtnStyle}>+ Add Item</button>
            </div>

            {/* Column headers */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 64px 96px 36px", gap: 6, marginBottom: 6 }}>
              {["Description", "Qty", "Price", ""].map((h) => (
                <span key={h} style={{ fontSize: "0.7rem", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.3px" }}>{h}</span>
              ))}
            </div>

            {items.map((item, idx) => (
              <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 64px 96px 36px", gap: 6, marginBottom: 6, alignItems: "center" }}>
                <input
                  style={{ ...inputStyle, padding: "8px 12px" }}
                  placeholder="Plan, service..."
                  value={item.description} required
                  onChange={(e) => updateItem(idx, "description", e.target.value)}
                  onFocus={(e) => (e.target.style.borderColor = "#4f46e5")}
                  onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
                />
                <input
                  type="number" min="0.01" step="0.01"
                  style={{ ...inputStyle, padding: "8px 8px", textAlign: "center" }}
                  value={item.qty}
                  onChange={(e) => updateItem(idx, "qty", parseFloat(e.target.value) || 0)}
                />
                <input
                  type="number" min="0" step="0.01"
                  style={{ ...inputStyle, padding: "8px 10px" }}
                  value={item.unit_price}
                  onChange={(e) => updateItem(idx, "unit_price", parseFloat(e.target.value) || 0)}
                />
                {items.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "1.1rem", padding: "0 4px" }}
                  >
                    ✕
                  </button>
                ) : <span />}
              </div>
            ))}
          </div>

          {/* Total */}
          <div style={{
            background: "linear-gradient(135deg, #f5f3ff, #ede9fe)",
            border: "1.5px solid #c4b5fd", borderRadius: 12, padding: "16px 20px",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ fontWeight: 700, color: "#374151" }}>Total (USD)</span>
            <span style={{ fontSize: "1.5rem", fontWeight: 900, color: "#4f46e5" }}>{fmt(total)}</span>
          </div>

          {/* Notes */}
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#374151", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.3px" }}>
              Notes (optional)
            </label>
            <textarea
              rows={2}
              placeholder="Any additional info..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
              onFocus={(e) => (e.target.style.borderColor = "#4f46e5")}
              onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
            />
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: "#fef2f2", border: "1px solid #fecaca",
              borderRadius: 10, padding: "12px 16px", color: "#dc2626", fontSize: "0.9rem",
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "15px", background: loading ? "#a5b4fc" : "linear-gradient(135deg, #4f46e5, #7c3aed)",
              color: "#fff", border: "none", borderRadius: 12,
              fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: "1rem",
              cursor: loading ? "not-allowed" : "pointer",
              boxShadow: loading ? "none" : "0 4px 16px rgba(79,70,229,0.3)",
              transition: "all 0.2s",
            }}
          >
            {loading ? "Placing Order..." : `Place Order — ${fmt(total)}`}
          </button>

          <p style={{ textAlign: "center", color: "#9ca3af", fontSize: "0.8rem", margin: 0 }}>
            You'll receive an invoice immediately after placing your order.
          </p>
        </form>

        {/* Already have an invoice? */}
        <p style={{ textAlign: "center", marginTop: 32, color: "#6b7280", fontSize: "0.875rem" }}>
          Already placed an order?{" "}
          <Link to="/#tracker" style={{ color: "#4f46e5", fontWeight: 600, textDecoration: "none" }}>
            Check subscription status →
          </Link>
        </p>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  border: "1.5px solid #e5e7eb",
  borderRadius: 8,
  fontSize: "0.9rem",
  fontFamily: "Inter, sans-serif",
  background: "#fff",
  color: "#111827",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.15s",
};

const smBtnStyle: React.CSSProperties = {
  padding: "5px 12px",
  background: "#ede9fe",
  border: "none",
  borderRadius: 6,
  color: "#7c3aed",
  fontWeight: 600,
  fontSize: "0.8rem",
  cursor: "pointer",
  fontFamily: "Inter, sans-serif",
};
