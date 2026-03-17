import { useState, useEffect, FormEvent } from "react";
import { Link } from "react-router-dom";
import { getTranslation, LanguageCode, languageNames, defaultLanguage } from "../translations";

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
  const [language, setLanguage] = useState<LanguageCode>(() => {
    const saved = localStorage.getItem("substrack_language") as LanguageCode;
    return saved || defaultLanguage;
  });
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);

  const t = getTranslation(language);

  const changeLanguage = (lang: LanguageCode) => {
    setLanguage(lang);
    localStorage.setItem("substrack_language", lang);
    setShowLanguageMenu(false);
  };

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
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <a href="#pricing" style={{ padding: "8px 16px", color: "#6b7280", textDecoration: "none", fontWeight: 500, fontSize: "0.9rem" }}>{t.nav.pricing}</a>
          <a href="#tracker" style={{ padding: "8px 16px", color: "#6b7280", textDecoration: "none", fontWeight: 500, fontSize: "0.9rem" }}>{t.nav.trackStatus}</a>
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowLanguageMenu(!showLanguageMenu)}
              style={{
                padding: "8px 16px",
                background: "#f3f4f6",
                border: "none",
                borderRadius: 8,
                color: "#6b7280",
                fontWeight: 500,
                fontSize: "0.9rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              🌐 {languageNames[language]}
            </button>
            {showLanguageMenu && (
              <div style={{
                position: "absolute",
                top: "100%",
                right: 0,
                marginTop: 8,
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                maxHeight: 300,
                overflowY: "auto",
                zIndex: 1000,
                minWidth: 180,
              }}>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "1fr",
                  gap: 2,
                  padding: 8,
                }}>
                  {(Object.keys(languageNames) as LanguageCode[]).slice(0, 20).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => changeLanguage(lang)}
                      style={{
                        padding: "8px 12px",
                        background: language === lang ? "#4f46e5" : "transparent",
                        border: "none",
                        borderRadius: 6,
                        color: language === lang ? "#fff" : "#111827",
                        fontWeight: language === lang ? 600 : 400,
                        fontSize: "0.85rem",
                        cursor: "pointer",
                        textAlign: "left",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {languageNames[lang]}
                    </button>
                  ))}
                </div>
                <div style={{
                  padding: 8,
                  borderTop: "1px solid #e5e7eb",
                  textAlign: "center",
                }}>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      const more = Object.keys(languageNames) as LanguageCode[];
                      const current = more.slice(0, 20);
                      const rest = more.slice(20);
                      if (rest.length > 0) {
                        alert(`More languages available: ${rest.map(l => languageNames[l]).join(", ")}`);
                      }
                    }}
                    style={{
                      color: "#4f46e5",
                      fontSize: "0.8rem",
                      textDecoration: "none",
                      fontWeight: 500,
                    }}
                  >
                    +{Object.keys(languageNames).length - 20} more
                  </a>
                </div>
              </div>
            )}
          </div>
          <Link to="/admin/login" style={{
            padding: "8px 20px", background: "#4f46e5", color: "#fff",
            borderRadius: 8, textDecoration: "none", fontWeight: 600, fontSize: "0.875rem",
          }}>{t.nav.admin}</Link>
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
          {t.hero.badge}
        </div>
        <h1 style={{
          fontSize: "clamp(2.2rem, 5vw, 3.5rem)", fontWeight: 900, lineHeight: 1.15,
          color: "#111827", marginBottom: 20, letterSpacing: "-1px",
        }}>
          {t.hero.title1}<br />
          <span style={{
            background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>{t.hero.title2}</span>
        </h1>
        <p style={{ fontSize: "1.15rem", color: "#6b7280", maxWidth: 540, margin: "0 auto 40px", lineHeight: 1.7 }}>
          {t.hero.description}
        </p>
        <a href="#tracker" style={{
          display: "inline-block", padding: "14px 32px",
          background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
          color: "#fff", borderRadius: 10, fontWeight: 700, fontSize: "1rem",
          textDecoration: "none", boxShadow: "0 4px 20px rgba(79,70,229,0.3)",
        }}>
          {t.hero.cta}
        </a>
      </section>

      {/* ── STATS BAR ── */}
      <section style={{
        display: "flex", justifyContent: "center", gap: "48px", flexWrap: "wrap",
        padding: "32px 24px", background: "#fff", borderTop: "1px solid #f3f4f6",
        borderBottom: "1px solid #f3f4f6",
      }}>
        {[
          { label: t.stats.activeSubscribers, value: publicStats ? String(publicStats.active_count) : "…" },
          { label: t.stats.singlePlan, value: "1" },
          { label: t.stats.slotsAvailable, value: "Limited" },
          { label: t.stats.support, value: "24/7" },
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
          }}>{t.plan.badge}</div>
          <h2 style={{ fontSize: "2rem", fontWeight: 800, color: "#111827", letterSpacing: "-0.5px" }}>
            {t.plan.title}
          </h2>
          <p style={{ color: "#6b7280", marginTop: 8, fontSize: "1rem" }}>
            {t.plan.description}
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
            }}>✦ {t.plan.planName}</div>

            {/* Price */}
            <div style={{ textAlign: "center", marginBottom: 32, marginTop: 8 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 6 }}>
                <span style={{ fontSize: "3.5rem", fontWeight: 900, color: "#111827", lineHeight: 1 }}>{t.plan.price}</span>
                <span style={{ color: "#9ca3af", fontSize: "1rem" }}>{t.plan.period}</span>
              </div>
              <p style={{ color: "#7c3aed", fontSize: "0.875rem", fontWeight: 600, marginTop: 6 }}>
                {t.plan.slotDescription}
              </p>
            </div>

            {/* What is Family Sharing */}
            <div style={{
              background: "rgba(255,255,255,0.7)", borderRadius: 12,
              padding: "20px 24px", marginBottom: 24, border: "1px solid #ddd6fe",
            }}>
              <div style={{ fontWeight: 700, color: "#4f46e5", marginBottom: 10, fontSize: "0.875rem", textTransform: "uppercase", letterSpacing: "0.4px" }}>
                {t.plan.whatIsFamilySharing}
              </div>
              <p style={{ color: "#374151", fontSize: "0.9rem", lineHeight: 1.7, margin: 0 }} dangerouslySetInnerHTML={{ __html: t.plan.familySharingDescription }} />
            </div>

            {/* Features */}
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 28px" }}>
              {t.plan.features.map((text, i) => (
                <li key={text} style={{
                  display: "flex", alignItems: "flex-start", gap: 10,
                  padding: "7px 0", fontSize: "0.92rem", color: "#374151",
                  borderBottom: "1px solid #ede9fe",
                }}>
                  <span style={{ color: "#059669", fontWeight: 800, flexShrink: 0, marginTop: 1 }}>✓</span>
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
                  {t.plan.creditsWarning.title}
                </div>
                <p style={{ color: "#92400e", fontSize: "0.85rem", lineHeight: 1.6, margin: 0 }} dangerouslySetInnerHTML={{ __html: t.plan.creditsWarning.description }} />
              </div>
            </div>

            <a href="#tracker" style={{
              display: "block", textAlign: "center",
              padding: "14px", background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
              color: "#fff", borderRadius: 10, fontWeight: 700, fontSize: "1rem",
              textDecoration: "none", boxShadow: "0 4px 16px rgba(124,58,237,0.3)",
            }}>
              {t.plan.checkStatus}
            </a>
          </div>

          {/* FAQ-style note */}
          <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {t.plan.faqs.map((item) => (
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
          }}>{t.tracker.badge}</div>
          <h2 style={{ fontSize: "1.8rem", fontWeight: 800, color: "#111827", marginBottom: 8, letterSpacing: "-0.5px" }}>
            {t.tracker.title}
          </h2>
          <p style={{ color: "#6b7280", marginBottom: 32, lineHeight: 1.6 }}>
            {t.tracker.description}
          </p>

          <form onSubmit={handleSearch} style={{ display: "flex", gap: 8 }}>
            <input
              type="email"
              placeholder={t.tracker.placeholder}
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
              {loading ? t.tracker.checking : t.tracker.checkButton}
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
              <div style={{ fontSize: "2rem", marginBottom: 8 }}>{t.tracker.notFound}</div>
              <p style={{ color: "#991b1b", fontWeight: 500 }}>
                {t.tracker.noSubscriptionFound} <strong>{email}</strong>
              </p>
            </div>
          )}

          {result?.found && result.latest && (() => {
            const s = result.latest!;
            const days = s.days_remaining;
            const statusColor = days <= 0 ? "#dc2626" : days <= 3 ? "#d97706" : "#059669";
            const statusBg = days <= 0 ? "#fef2f2" : days <= 3 ? "#fffbeb" : "#ecfdf5";
            const statusBorder = days <= 0 ? "#fecaca" : days <= 3 ? "#fde68a" : "#a7f3d0";
            const statusLabel = days <= 0 ? t.tracker.expired : days <= 3 ? t.tracker.expiringSoon : t.tracker.active;
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
                    {t.tracker.daysRemaining}
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
