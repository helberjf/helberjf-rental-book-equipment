import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../services/axios";
import { getApiError } from "../services/errors";

export default function Signin() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("admin@rentalbook.local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (user) return <Navigate to="/admin" replace />;

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await api.post("/api/auth/login", { email, password });
      signIn(response.data.result.user, response.data.result.token);
      navigate(location.state?.from || "/admin", { replace: true });
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-visual">
        <div className="brand login-brand"><div className="brand-mark">RB</div><div><strong>Rental Book</strong><span>Event equipment</span></div></div>
        <div>
          <span className="eyebrow">CONTROL WITH CONFIDENCE</span>
          <h1>One calendar for every event, unit and payment.</h1>
          <p>Manage eight LED robots and the LED swing without schedule conflicts or missing balances.</p>
        </div>
        <div className="login-inventory"><span>8</span> LED robots <i /> <span>1</span> LED swing</div>
      </section>
      <section className="login-form-wrap">
        <form className="login-form" onSubmit={submit}>
          <span className="eyebrow">ADMIN ACCESS</span>
          <h2>Welcome back</h2>
          <p>Sign in to open the rental management workspace.</p>
          {error && <div className="notice notice-error">{error}</div>}
          <label>Email address<input autoFocus type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>Password<input type="password" required minLength="8" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <button className="button button-primary button-wide" disabled={saving}>{saving ? "Signing in…" : "Sign in"}</button>
          <small>Access is limited to authorized staff.</small>
        </form>
      </section>
    </main>
  );
}
