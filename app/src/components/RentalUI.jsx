import { useLanguage } from "../context/Language";
import { t } from "../domain/language";
export function StatusBadge({
  status
}) {
  useLanguage();
  return <span className={`status-badge status-${String(status).toLowerCase().replace("_", "-")}`}>
      {t(String(status))}
    </span>;
}
export function LoadingBlock({
  label = t("Loading data")
}) {
  useLanguage();
  return <div className="state-panel" role="status">
      <span className="spinner" />
      <p>{t(label)}…</p>
    </div>;
}
export function ErrorBlock({
  message,
  onRetry
}) {
  useLanguage();
  return <div className="state-panel state-error" role="alert">
      <strong>{t("We could not load this information.")}</strong>
      <p>{t(message)}</p>
      {onRetry && <button className="button button-secondary" onClick={onRetry}>{t("Try again")}</button>}
    </div>;
}
export function EmptyBlock({
  title,
  text
}) {
  useLanguage();
  return <div className="state-panel">
      <strong>{t(title)}</strong>
      <p>{t(text)}</p>
    </div>;
}
