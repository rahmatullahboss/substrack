import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSetup, setIsSetup] = useState(false);
  const [email, setEmail] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error?.includes("setup")) {
          setIsSetup(true);
          setError("");
        } else {
          setError(data.error || "Login failed");
        }
        return;
      }

      localStorage.setItem("substrack_token", data.token);
      localStorage.setItem("substrack_email", data.email);
      navigate("/admin");
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSetup = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Setup failed");
        return;
      }

      localStorage.setItem("substrack_token", data.token);
      localStorage.setItem("substrack_email", data.email);
      navigate("/admin");
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card card fade-in">
        <div style={{ fontSize: "2.5rem", marginBottom: "8px" }}>⚡</div>
        <h1 className="page-title">Substrack</h1>
        <p className="page-subtitle">
          {isSetup ? "Create your admin account" : "Admin Login"}
        </p>

        <form onSubmit={isSetup ? handleSetup : handleLogin}>
          {isSetup && (
            <div className="form-group">
              <label className="form-label">Admin Email</label>
              <input
                type="email"
                className="form-input"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              placeholder={isSetup ? "Create a password (min 6 chars)" : "Enter password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus={!isSetup}
              minLength={isSetup ? 6 : 1}
            />
          </div>

          {error && <p className="error-msg">{error}</p>}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", marginTop: "16px", justifyContent: "center" }}
            disabled={loading}
          >
            {loading ? "Please wait..." : isSetup ? "Create Account" : "Login"}
          </button>
        </form>

        {!isSetup && (
          <button
            onClick={() => setIsSetup(true)}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              fontSize: "0.8rem",
              marginTop: "16px",
              cursor: "pointer",
              fontFamily: "var(--font)",
            }}
          >
            First time? Set up admin account →
          </button>
        )}

        <a
          href="/"
          style={{
            display: "block",
            marginTop: "24px",
            color: "var(--text-muted)",
            fontSize: "0.85rem",
            textDecoration: "none",
          }}
        >
          ← Back to status check
        </a>
      </div>
    </div>
  );
}
