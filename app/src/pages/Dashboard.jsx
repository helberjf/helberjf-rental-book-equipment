import { useLanguage } from "../context/Language";
import { t } from "../domain/language";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ErrorBlock, LoadingBlock, StatusBadge } from "../components/RentalUI";
import { formatCurrency, formatEventDate } from "../domain/rental-utils";
import api from "../services/axios";
import { getApiError } from "../services/errors";
const cards = data => [{
  label: t("Events this month"),
  value: data.events,
  hint: t("Confirmed and planned"),
  tone: "violet"
}, {
  label: t("Upcoming events"),
  value: data.futureEvents,
  hint: t("Still ahead this month"),
  tone: "blue"
}, {
  label: t("Amount received"),
  value: formatCurrency(data.receivedAmountCents),
  hint: t("Confirmed payments"),
  tone: "green"
}, {
  label: t("Open balance"),
  value: formatCurrency(data.remainingAmountCents),
  hint: t("Expected from clients"),
  tone: "amber"
}];
export default function Dashboard() {
  useLanguage();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setError("");
    try {
      const response = await api.get("/api/dashboard");
      setData(response.data.result);
    } catch (requestError) {
      setError(getApiError(requestError));
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  if (error) return <ErrorBlock message={error} onRetry={load} />;
  if (!data) return <LoadingBlock label={t("Loading overview")} />;
  return <div className="page-stack">
      <section className="hero-panel">
        <div>
          <span className="eyebrow">{t("OPERATIONS CENTER")}</span>
          <h2>{t("Every event, unit and payment in one place.")}</h2>
          <p>{t("Schedule equipment confidently and keep a clear view of what is coming next.")}</p>
        </div>
        <Link className="button button-primary" to="/admin/rentals">{t("+ New event")}</Link>
      </section>

      <section className="stats-grid">
        {cards(data).map(card => <article className={`stat-card tone-${card.tone}`} key={t(card.label)}>
            <span>{t(card.label)}</span>
            <strong>{card.value}</strong>
            <small>{t(card.hint)}</small>
          </article>)}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <span className="eyebrow">{t("NEXT ON THE ROAD")}</span>
            <h3>{t("Upcoming events")}</h3>
          </div>
          <Link className="text-link" to="/admin/calendar">{t("Open calendar \u2192")}</Link>
        </div>

        {data.upcomingRentals.length === 0 ? <div className="empty-inline">{t("No upcoming events yet. Create the first booking to get started.")}</div> : <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("Date & time")}</th>
                  <th>{t("Responsible")}</th>
                  <th>{t("Equipment")}</th>
                  <th>{t("Employee")}</th>
                  <th>{t("Status")}</th>
                  <th>{t("Balance")}</th>
                </tr>
              </thead>
              <tbody>
                {data.upcomingRentals.map(rental => <tr key={rental.id}>
                    <td data-label={t("Date & time")}>
                      <strong>{formatEventDate(rental.startAt, {
                    day: "2-digit",
                    month: "short",
                    year: "numeric"
                  })}</strong>
                      <small>{formatEventDate(rental.startAt, {
                    hour: "2-digit",
                    minute: "2-digit"
                  })} – {formatEventDate(rental.endAt, {
                    hour: "2-digit",
                    minute: "2-digit"
                  })}</small>
                    </td>
                    <td data-label={t("Responsible")}><strong>{rental.customer.name}</strong><small>{rental.customer.contact}</small></td>
                    <td data-label={t("Equipment")}>{rental.items.flatMap(item => item.units.map(unit => unit.identifier)).join(", ")}</td>
                    <td data-label={t("Employee")}>{rental.employees.map(employee => employee.name).join(", ")}</td>
                    <td data-label={t("Status")}><StatusBadge status={rental.status} /></td>
                    <td data-label={t("Balance")}>{formatCurrency(rental.remainingAmountCents)}</td>
                  </tr>)}
              </tbody>
            </table>
          </div>}
      </section>
    </div>;
}
