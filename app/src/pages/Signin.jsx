import { useLanguage } from "../context/Language";
import { t } from "../domain/language";
import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../services/axios";
import { getApiError } from "../services/errors";
import LanguageSelect from '../context/Language';
export default function Signin() {
  useLanguage();
  const {
    user,
    signIn
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("admin@rentalbook.local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  if (user) return <Navigate to="/admin" replace />;
  const submit = async event => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await api.post("/api/auth/login", {
        email,
        password
      });
      signIn(response.data.result.user, response.data.result.token);
      navigate(location.state?.from || "/admin", {
        replace: true
      });
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setSaving(false);
    }
  };
  return <main className="login-page">
      <section className="login-visual">
        <div className="brand login-brand"><div className="brand-mark">RB</div><div><strong>Rental Book</strong><span>{t("Event equipment")}</span></div></div>
        <div>
          <span className="eyebrow">{t("CONTROL WITH CONFIDENCE")}</span>
          <h1>{t("One calendar for every event, unit and payment.")}</h1>
          <p>{t("Manage eight LED robots and the LED swing without schedule conflicts or missing balances.")}</p>
        </div>
        <div className="login-inventory"><span>8</span> {t("LED robots")} <i /> <span>1</span> {t("LED swing")}</div>
      </section>
      <section className="login-form-wrap">
        <form className="login-form" onSubmit={submit}>
          <LanguageSelect />
          <span className="eyebrow">{t("ADMIN ACCESS")}</span>
          <h2>{t("Welcome back")}</h2>
          <p>{t("Sign in to open the rental management workspace.")}</p>
          {error && <div className="notice notice-error">{error}</div>}
          <label>{t("Email address")}<input autoFocus type="email" required value={email} onChange={event => setEmail(event.target.value)} /></label>
          <label>{t("Password")}<input type="password" required minLength="8" value={password} onChange={event => setPassword(event.target.value)} /></label>
          <button className="button button-primary button-wide" disabled={saving}>{saving ? t("Signing in\u2026") : t("Sign in")}</button>
          <small>{t("Access is limited to authorized staff.")} <Link className="text-link" to="/">{t('Back to website')}</Link></small>
        </form>
      </section>
    </main>;
}
