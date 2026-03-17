import { useState, useEffect, FormEvent } from "react";
import { Link } from "react-router-dom";

interface SubscriptionResult {
  customer_name: string | null;
  customer_email: string;
  plan_name: string;
  payment_date: string;
  expiry_date: string;
  duration_days: number;
  status: string;
  days_remaining: number;
  computed_status: string;
}

interface PublicStats {
  active_count: number;
  total_count: number;
}

export default function StatusCheck() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    found: boolean;
    subscriptions?: SubscriptionResult[];
    latest?: SubscriptionResult;
    message?: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [publicStats, setPublicStats] = useState<PublicStats | null>(null);

  useEffect(() => {
    fetch("/api/public/stats")
      .then((r) => r.json())
      .then((data: PublicStats) => setPublicStats(data))
      .catch(() => {}); // silently ignore if endpoint unavailable
  }, []);


  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(
        `/api/public/status?email=${encodeURIComponent(email.trim())}`
      );
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Something went wrong"); return; }
      setResult(data);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: "#fff", color: "#111827", minHeight: "100vh" }}>

      {/* ── NAVBAR ── */}
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 48px", borderBottom: "1px solid #f3f4f6",
        position: "sticky", top: 0, background: "rgba(255,255,255,0.9)",
        backdropFilter: "blur(12px)", zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, fontSize: "1.2rem", color: "#4f46e5" }}>
          ⚡ Substrack
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a href="#pricing" style={{ padding: "8px 16px", color: "#6b7280", textDecoration: "none", fontWeight: 500, fontSize: "0.9rem" }}>Pricing</a>
          <a href="#tracker" style={{ padding: "8px 16px", color: "#6b7280", textDecoration: "none", fontWeight: 500, fontSize: "0.9rem" }}>Track Status</a>
          <Link to="/admin/login" style={{
            padding: "8px 20px", background: "#4f46e5", color: "#fff",
            borderRadius: 8, textDecoration: "none", fontWeight: 600, fontSize: "0.875rem",
          }}>Admin →</Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{
        textAlign: "center", padding: "96px 24px 80px",
        background: "linear-gradient(180deg, #f5f3ff 0%, #ffffff 100%)",
      }}>
        <div style={{
          display: "inline-block", padding: "6px 16px", background: "#ede9fe",
          borderRadius: 20, color: "#7c3aed", fontSize: "0.8rem", fontWeight: 600,
          marginBottom: 24, letterSpacing: "0.3px",
        }}>
          Subscription Management, Simplified
        </div>
        <h1 style={{
          fontSize: "clamp(2.2rem, 5vw, 3.5rem)", fontWeight: 900, lineHeight: 1.15,
          color: "#111827", marginBottom: 20, letterSpacing: "-1px",
        }}>
          Track Your Subscription<br />
          <span style={{
            background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>Status Anytime</span>
        </h1>
        <p style={{ fontSize: "1.15rem", color: "#6b7280", maxWidth: 540, margin: "0 auto 40px", lineHeight: 1.7 }}>
          Enter your email below to instantly check when your subscription renews,
          how many days remain, and your plan details.
        </p>
        <a href="#tracker" style={{
          display: "inline-block", padding: "14px 32px",
          background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
          color: "#fff", borderRadius: 10, fontWeight: 700, fontSize: "1rem",
          textDecoration: "none", boxShadow: "0 4px 20px rgba(79,70,229,0.3)",
        }}>
          Check My Status ↓
        </a>
      </section>

      {/* ── STATS BAR ── */}
      <section style={{
        display: "flex", justifyContent: "center", gap: "48px", flexWrap: "wrap",
        padding: "32px 24px", background: "#fff", borderTop: "1px solid #f3f4f6",
        borderBottom: "1px solid #f3f4f6",
      }}>
        {[
          { label: "Active Subscribers", value: publicStats ? String(publicStats.active_count) : "…" },
          { label: "Single Plan", value: "1" },
          { label: "Slots Available", value: "Limited" },
          { label: "Support", value: "24/7" },
        ].map((s) => (
          <div key={s.label} style={{ textAlign: "center" }}>
            <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#4f46e5" }}>{s.value}</div>
            <div style={{ fontSize: "0.8rem", color: "#9ca3af", fontWeight: 500, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </section>

      {/* ── PLAN ── */}
      <section id="pricing" style={{ padding: "80px 24px", background: "#fafafa" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{
            display: "inline-block", padding: "5px 14px", background: "#ede9fe",
            borderRadius: 20, color: "#7c3aed", fontSize: "0.75rem",
            fontWeight: 700, marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.5px",
          }}>Our Plan</div>
          <h2 style={{ fontSize: "2rem", fontWeight: 800, color: "#111827", letterSpacing: "-0.5px" }}>
            One Plan. Full Power.
          </h2>
          <p style={{ color: "#6b7280", marginTop: 8, fontSize: "1rem" }}>
            We offer a single, carefully curated subscription — Google Gemini Ultra via Family Sharing.
          </p>
        </div>

        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          {/* Main Plan Card */}
          <div style={{
            background: "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)",
            border: "2px solid #c4b5fd", borderRadius: 20, padding: "40px",
            position: "relative", boxShadow: "0 8px 32px rgba(124,58,237,0.1)",
          }}>
            {/* Badge */}
            <div style={{
              position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)",
              background: "linear-gradient(135deg, #7c3aed, #4f46e5)", color: "#fff",
              padding: "6px 20px", borderRadius: 20, fontSize: "0.8rem", fontWeight: 700,
              whiteSpace: "nowrap", boxShadow: "0 4px 12px rgba(124,58,237,0.3)",
            }}>✦ Google Gemini Ultra — Family Sharing</div>

            {/* Price */}
            <div style={{ textAlign: "center", marginBottom: 32, marginTop: 8 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 6 }}>
                <span style={{ fontSize: "3.5rem", fontWeight: 900, color: "#111827", lineHeight: 1 }}>$25</span>
                <span style={{ color: "#9ca3af", fontSize: "1rem" }}>/ month</span>
              </div>
              <p style={{ color: "#7c3aed", fontSize: "0.875rem", fontWeight: 600, marginTop: 6 }}>
                Single Family Sharing Slot
              </p>
            </div>

            {/* What is Family Sharing */}
            <div style={{
              background: "rgba(255,255,255,0.7)", borderRadius: 12,
              padding: "20px 24px", marginBottom: 24, border: "1px solid #ddd6fe",
            }}>
              <div style={{ fontWeight: 700, color: "#4f46e5", marginBottom: 10, fontSize: "0.875rem", textTransform: "uppercase", letterSpacing: "0.4px" }}>
                🔗 What is Google Family Sharing?
              </div>
              <p style={{ color: "#374151", fontSize: "0.9rem", lineHeight: 1.7, margin: 0 }}>
                Google One Family Sharing lets the primary account holder share their Gemini Ultra subscription
                with up to 5 family members. Each member gets their own separate Google account with full
                Gemini Ultra access — <strong>1 slot = your own independent Google account</strong>,
                not shared storage or shared sessions.
              </p>
            </div>

            {/* Features */}
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 28px" }}>
              {[
                ["✓", "Google Gemini Ultra (most powerful Gemini model)", "#059669"],
                ["✓", "Your own independent Google account slot", "#059669"],
                ["✓", "Full Gemini Advanced access in Gmail, Docs, Sheets", "#059669"],
                ["✓", "6TB Google One storage included", "#059669"],
                ["✓", "Deep Research, long context & advanced features", "#059669"],
                ["✓", "Monthly subscription — cancel anytime", "#059669"],
              ].map(([icon, text, color]) => (
                <li key={text} style={{
                  display: "flex", alignItems: "flex-start", gap: 10,
                  padding: "7px 0", fontSize: "0.92rem", color: "#374151",
                  borderBottom: "1px solid #ede9fe",
                }}>
                  <span style={{ color, fontWeight: 800, flexShrink: 0, marginTop: 1 }}>{icon}</span>
                  {text}
                </li>
              ))}
            </ul>

            {/* NO CREDITS WARNING */}
            <div style={{
              background: "#fff7ed", border: "1.5px solid #fed7aa",
              borderRadius: 10, padding: "16px 20px", marginBottom: 24,
              display: "flex", gap: 12, alignItems: "flex-start",
            }}>
              <span style={{ fontSize: "1.2rem", flexShrink: 0 }}>⚠️</span>
              <div>
                <div style={{ fontWeight: 700, color: "#c2410c", marginBottom: 4, fontSize: "0.875rem" }}>
                  Credits Not Included
                </div>
                <p style={{ color: "#92400e", fontSize: "0.85rem", lineHeight: 1.6, margin: 0 }}>
                  This plan does <strong>not</strong> include any AI credits (API access, image generation quotas, etc.).
                  If you need Gemini API credits or additional Google AI Studio usage,
                  those must be purchased separately from your own Google account.
                </p>
              </div>
            </div>

            <a href="#tracker" style={{
              display: "block", textAlign: "center",
              padding: "14px", background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
              color: "#fff", borderRadius: 10, fontWeight: 700, fontSize: "1rem",
              textDecoration: "none", boxShadow: "0 4px 16px rgba(124,58,237,0.3)",
            }}>
              Check My Subscription Status
            </a>
          </div>

          {/* FAQ-style note */}
          <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {[
              { q: "Is this my own Google account?", a: "Yes. You use your own existing Google account — we just add it to the family group." },
              { q: "Do other family members see me?", a: "No. Each slot is fully private. Members do not see each other's data or usage." },
              { q: "What if I already have Google One?", a: "You can still join. The family share gives you Gemini Ultra on top of your existing plan." },
              { q: "Can I use Gemini API with this?", a: "No. API credits are not included. This covers Gemini Advanced (web/app) only." },
            ].map((item) => (
              <div key={item.q} style={{
                background: "#fff", border: "1px solid #f3f4f6",
                borderRadius: 12, padding: "16px",
              }}>
                <div style={{ fontWeight: 700, color: "#111827", fontSize: "0.85rem", marginBottom: 6 }}>❓ {item.q}</div>
                <div style={{ color: "#6b7280", fontSize: "0.82rem", lineHeight: 1.6 }}>{item.a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TRACKER ── */}
      <section id="tracker" style={{ padding: "80px 24px", background: "#fff" }}>
        <div style={{ maxWidth: 520, margin: "0 auto", textAlign: "center" }}>
          <div style={{
            display: "inline-block", padding: "5px 14px", background: "#ede9fe",
            borderRadius: 20, color: "#7c3aed", fontSize: "0.75rem",
            fontWeight: 700, marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.5px",
          }}>Live Status Check</div>
          <h2 style={{ fontSize: "1.8rem", fontWeight: 800, color: "#111827", marginBottom: 8, letterSpacing: "-0.5px" }}>
            Check Your Subscription
          </h2>
          <p style={{ color: "#6b7280", marginBottom: 32, lineHeight: 1.6 }}>
            Enter the email address you used when subscribing to see your current plan and expiry.
          </p>

          <form onSubmit={handleSearch} style={{ display: "flex", gap: 8 }}>
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              style={{
                flex: 1, padding: "12px 16px", border: "2px solid #e5e7eb",
                borderRadius: 10, fontSize: "0.95rem", outline: "none",
                fontFamily: "Inter, sans-serif", transition: "border-color 0.2s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#4f46e5")}
              onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "12px 24px", background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
                color: "#fff", border: "none", borderRadius: 10,
                fontWeight: 700, fontSize: "0.9rem", cursor: "pointer",
                fontFamily: "Inter, sans-serif", whiteSpace: "nowrap",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "..." : "Check →"}
            </button>
          </form>

          {error && (
            <p style={{ color: "#dc2626", marginTop: 12, fontSize: "0.9rem" }}>{error}</p>
          )}

          {result && !result.found && (
            <div style={{
              marginTop: 28, padding: 24, background: "#fef2f2",
              border: "1px solid #fecaca", borderRadius: 12, textAlign: "center",
            }}>
              <div style={{ fontSize: "2rem", marginBottom: 8 }}>🔍</div>
              <p style={{ color: "#991b1b", fontWeight: 500 }}>
                No subscription found for <strong>{email}</strong>
              </p>
            </div>
          )}

          {result?.found && result.latest && (() => {
            const s = result.latest!;
            const days = s.days_remaining;
            const statusColor = days <= 0 ? "#dc2626" : days <= 3 ? "#d97706" : "#059669";
            const statusBg = days <= 0 ? "#fef2f2" : days <= 3 ? "#fffbeb" : "#ecfdf5";
            const statusBorder = days <= 0 ? "#fecaca" : days <= 3 ? "#fde68a" : "#a7f3d0";
            const statusLabel = days <= 0 ? "❌ Expired" : days <= 3 ? "⚠️ Expiring Soon" : "✅ Active";
            return (
              <div style={{ marginTop: 28, textAlign: "left" }}>
                {/* Status badge */}
                <div style={{
                  display: "flex", justifyContent: "center", marginBottom: 20,
                  padding: "10px 0", background: statusBg,
                  border: `1px solid ${statusBorder}`, borderRadius: 12,
                }}>
                  <span style={{ color: statusColor, fontWeight: 700, fontSize: "1rem" }}>{statusLabel}</span>
                </div>

                {/* Days remaining big number */}
                <div style={{ textAlign: "center", marginBottom: 20 }}>
                  <div style={{ fontSize: "4rem", fontWeight: 900, color: statusColor, lineHeight: 1 }}>
                    {Math.max(0, days)}
                  </div>
                  <div style={{ color: "#9ca3af", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: 4 }}>
                    days remaining
                  </div>
                </div>

                {/* Details */}
                <div style={{ background: "#f9fafb", border: "1px solid #f3f4f6", borderRadius: 12, overflow: "hidden" }}>
                  {([
                    s.customer_name ? ["Name", s.customer_name] : null,
                    ["Plan", s.plan_name],
                    ["Payment Date", formatDate(s.payment_date)],
                    ["Expiry Date", formatDate(s.expiry_date)],
                  ].filter(Boolean) as string[][]).map(([label, value]) => (
                    <div key={label} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "12px 16px", borderBottom: "1px solid #f3f4f6",
                    }}>
                      <span style={{ color: "#6b7280", fontSize: "0.875rem" }}>{label}</span>
                      <span style={{ color: "#111827", fontWeight: 600, fontSize: "0.875rem" }}>{value}</span>
                    </div>
                  ))}
                </div>

                {/* History */}
                {result.subscriptions && result.subscriptions.length > 1 && (
                  <div style={{ marginTop: 16 }}>
                    <p style={{ color: "#9ca3af", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
                      History ({result.subscriptions.length} records)
                    </p>
                    {result.subscriptions.slice(1).map((sub, i) => (
                      <div key={i} style={{
                        display: "flex", justifyContent: "space-between",
                        padding: "8px 12px", background: "#f9fafb",
                        borderRadius: 8, marginBottom: 6, fontSize: "0.85rem",
                      }}>
                        <span style={{ color: "#6b7280" }}>{formatDate(sub.payment_date)} → {formatDate(sub.expiry_date)}</span>
                        <span style={{ color: sub.status === "active" ? "#059669" : "#9ca3af", fontWeight: 600 }}>
                          {sub.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ padding: "72px 24px", background: "#f9fafb" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: "1.8rem", fontWeight: 800, marginBottom: 8, letterSpacing: "-0.5px" }}>How It Works</h2>
          <p style={{ color: "#6b7280", marginBottom: 48 }}>Simple and transparent — no hidden terms.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 32 }}>
            {[
              { step: "01", icon: "💳", title: "Subscribe", desc: "Choose a plan and complete your payment with us directly." },
              { step: "02", icon: "📧", title: "Get Confirmed", desc: "Your subscription is registered and linked to your email." },
              { step: "03", icon: "🔍", title: "Track Anytime", desc: "Enter your email here to see your plan status at any time." },
              { step: "04", icon: "🔄", title: "Renew Easily", desc: "We'll remind you before expiry so you never lose access." },
            ].map((item) => (
              <div key={item.step} style={{ textAlign: "center" }}>
                <div style={{
                  width: 56, height: 56, background: "#ede9fe", borderRadius: 14,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1.5rem", margin: "0 auto 16px",
                }}>{item.icon}</div>
                <div style={{ fontSize: "0.7rem", color: "#7c3aed", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>
                  Step {item.step}
                </div>
                <div style={{ fontWeight: 700, marginBottom: 6, color: "#111827" }}>{item.title}</div>
                <div style={{ color: "#6b7280", fontSize: "0.875rem", lineHeight: 1.6 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{
        padding: "32px 48px", borderTop: "1px solid #f3f4f6",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        flexWrap: "wrap", gap: 12, background: "#fff",
      }}>
        <div style={{ fontWeight: 700, color: "#4f46e5" }}>⚡ Substrack</div>
        <p style={{ color: "#9ca3af", fontSize: "0.8rem" }}>
          © {new Date().getFullYear()} Substrack. All rights reserved.
        </p>
        <Link to="/admin/login" style={{ color: "#9ca3af", fontSize: "0.8rem", textDecoration: "none" }}>Admin Login</Link>
      </footer>
    </div>
  );
}
