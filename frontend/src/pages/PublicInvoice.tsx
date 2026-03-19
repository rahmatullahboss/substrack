import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

interface InvoiceData {
  order: {
    order_number: string;
    customer_email: string;
    customer_name: string | null;
    total_amount: number;
    currency: string;
  };
  invoice: {
    invoice_number: string;
    issued_date: string;
    status: string;
  };
}

export default function PublicInvoice() {
  const { invoiceNumber } = useParams<{ invoiceNumber: string }>();
  const [invoiceHtml, setInvoiceHtml] = useState<string>("");
  const [data, setData] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!invoiceNumber) return;

    const fetchInvoice = async () => {
      try {
        // Fetch JSON for meta info
        const jsonRes = await fetch(`/api/public/invoices/${invoiceNumber}`);
        if (!jsonRes.ok) {
          setError("Invoice not found. Please check your invoice number.");
          return;
        }
        const json = await jsonRes.json();
        setData(json);

        // Fetch HTML for rendering
        const htmlRes = await fetch(`/api/public/invoices/${invoiceNumber}?format=html`);
        const html = await htmlRes.text();
        setInvoiceHtml(html);
      } catch {
        setError("Failed to load invoice. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchInvoice();
  }, [invoiceNumber]);

  const handlePrint = () => {
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(invoiceHtml);
      w.document.close();
      w.focus();
      w.print();
    }
  };

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: "#f9fafb", minHeight: "100vh", color: "#111827" }}>

      {/* Navbar */}
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 48px", borderBottom: "1px solid #e5e7eb",
        background: "#fff", position: "sticky", top: 0, zIndex: 100,
      }}>
        <Link to="/" style={{ fontWeight: 800, fontSize: "1.2rem", color: "#4f46e5", textDecoration: "none" }}>
          ⚡ Substrack
        </Link>
        <div style={{ display: "flex", gap: 8 }}>
          {!loading && !error && (
            <button
              onClick={handlePrint}
              style={{
                padding: "8px 18px", background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
                color: "#fff", border: "none", borderRadius: 8,
                fontWeight: 700, fontSize: "0.875rem", cursor: "pointer",
                fontFamily: "Inter, sans-serif",
              }}
            >
              🖨️ Print / Save PDF
            </button>
          )}
          <Link to="/" style={{
            padding: "8px 16px", color: "#6b7280", textDecoration: "none",
            fontWeight: 500, fontSize: "0.875rem", display: "flex", alignItems: "center",
          }}>
            ← Home
          </Link>
        </div>
      </nav>

      <div style={{ maxWidth: 840, margin: "0 auto", padding: "40px 24px" }}>

        {loading && (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <div style={{
              width: 40, height: 40, border: "3px solid #e5e7eb",
              borderTopColor: "#4f46e5", borderRadius: "50%",
              animation: "spin 0.8s linear infinite", margin: "0 auto 16px",
            }} />
            <p style={{ color: "#6b7280" }}>Loading invoice...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {error && !loading && (
          <div style={{
            textAlign: "center", padding: "80px 24px",
            background: "#fff", borderRadius: 20, border: "1px solid #fecaca",
          }}>
            <div style={{ fontSize: "3rem", marginBottom: 16 }}>🔍</div>
            <h2 style={{ color: "#dc2626", marginBottom: 8 }}>Invoice Not Found</h2>
            <p style={{ color: "#6b7280", marginBottom: 24 }}>{error}</p>
            <Link to="/order" style={{
              padding: "10px 24px", background: "#4f46e5", color: "#fff",
              borderRadius: 8, textDecoration: "none", fontWeight: 700, fontSize: "0.9rem",
            }}>
              Place a New Order
            </Link>
          </div>
        )}

        {!loading && !error && data && (
          <>
            {/* Success Banner */}
            <div style={{
              background: "linear-gradient(135deg, #ecfdf5, #d1fae5)",
              border: "1.5px solid #a7f3d0", borderRadius: 16,
              padding: "20px 28px", marginBottom: 24,
              display: "flex", justifyContent: "space-between", alignItems: "center",
              flexWrap: "wrap", gap: 12,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: "1.8rem" }}>✅</span>
                <div>
                  <div style={{ fontWeight: 800, color: "#065f46", fontSize: "1rem" }}>
                    Order Confirmed!
                  </div>
                  <div style={{ color: "#047857", fontSize: "0.875rem", marginTop: 2 }}>
                    Invoice <strong>{data.invoice.invoice_number}</strong> • Order <strong>{data.order.order_number}</strong>
                  </div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 900, color: "#065f46", fontSize: "1.5rem" }}>
                  ${Number(data.order.total_amount).toFixed(2)}
                </div>
                <div style={{ color: "#047857", fontSize: "0.8rem" }}>USD Total</div>
              </div>
            </div>

            {/* Invoice iframe */}
            <div style={{
              background: "#fff", borderRadius: 16,
              border: "1px solid #e5e7eb", overflow: "hidden",
              boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
            }}>
              <iframe
                srcDoc={invoiceHtml}
                style={{ width: "100%", height: "70vh", border: "none", display: "block" }}
                title={`Invoice ${invoiceNumber}`}
              />
            </div>

            {/* Actions */}
            <div style={{
              display: "flex", justifyContent: "center", gap: 12,
              marginTop: 24, flexWrap: "wrap",
            }}>
              <button
                onClick={handlePrint}
                style={{
                  padding: "12px 28px", background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
                  color: "#fff", border: "none", borderRadius: 10,
                  fontWeight: 700, fontSize: "0.95rem", cursor: "pointer",
                  fontFamily: "Inter, sans-serif",
                  boxShadow: "0 4px 16px rgba(79,70,229,0.3)",
                }}
              >
                🖨️ Print / Save as PDF
              </button>
              <Link to="/#tracker" style={{
                padding: "12px 24px", background: "#f3f4f6",
                color: "#374151", textDecoration: "none", borderRadius: 10,
                fontWeight: 600, fontSize: "0.95rem",
              }}>
                🔍 Check Subscription Status
              </Link>
              <Link to="/order" style={{
                padding: "12px 24px", background: "#f3f4f6",
                color: "#374151", textDecoration: "none", borderRadius: 10,
                fontWeight: 600, fontSize: "0.95rem",
              }}>
                + New Order
              </Link>
            </div>

            {/* Note */}
            <p style={{ textAlign: "center", color: "#9ca3af", fontSize: "0.8rem", marginTop: 20 }}>
              Save this page URL to access your invoice anytime: <code style={{ background: "#f3f4f6", padding: "2px 6px", borderRadius: 4 }}>/invoice/{invoiceNumber}</code>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
