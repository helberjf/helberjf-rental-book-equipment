export function StatusBadge({ status }) {
  return (
    <span className={`status-badge status-${String(status).toLowerCase().replace("_", "-")}`}>
      {String(status).replace("_", " ")}
    </span>
  );
}

export function LoadingBlock({ label = "Loading data" }) {
  return (
    <div className="state-panel" role="status">
      <span className="spinner" />
      <p>{label}…</p>
    </div>
  );
}

export function ErrorBlock({ message, onRetry }) {
  return (
    <div className="state-panel state-error" role="alert">
      <strong>We could not load this information.</strong>
      <p>{message}</p>
      {onRetry && <button className="button button-secondary" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function EmptyBlock({ title, text }) {
  return (
    <div className="state-panel">
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}
