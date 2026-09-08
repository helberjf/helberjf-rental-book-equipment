import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ErrorBlock, LoadingBlock, StatusBadge } from "../components/RentalUI";
import { formatCurrency, formatEventDate } from "../domain/rental-utils";
import api from "../services/axios";
import { getApiError } from "../services/errors";

const cards = (data) => [
  { label: "Events this month", value: data.events, hint: "Confirmed and planned", tone: "violet" },
  { label: "Upcoming events", value: data.futureEvents, hint: "Still ahead this month", tone: "blue" },
  { label: "Amount received", value: formatCurrency(data.receivedAmountCents), hint: "Confirmed payments", tone: "green" },
  { label: "Open balance", value: formatCurrency(data.remainingAmountCents), hint: "Expected from clients", tone: "amber" },
];

export default function Dashboard() {
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
  if (!data) return <LoadingBlock label="Loading overview" />;

  return (
    <div className="page-stack">
      <section className="hero-panel">
        <div>
          <span className="eyebrow">OPERATIONS CENTER</span>
          <h2>Every event, unit and payment in one place.</h2>
          <p>Schedule equipment confidently and keep a clear view of what is coming next.</p>
        </div>
        <Link className="button button-primary" to="/admin/rentals">+ New event</Link>
      </section>

      <section className="stats-grid">
        {cards(data).map((card) => (
          <article className={`stat-card tone-${card.tone}`} key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <small>{card.hint}</small>
          </article>
        ))}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <span className="eyebrow">NEXT ON THE ROAD</span>
            <h3>Upcoming events</h3>
          </div>
          <Link className="text-link" to="/admin/calendar">Open calendar →</Link>
        </div>

        {data.upcomingRentals.length === 0 ? (
          <div className="empty-inline">No upcoming events yet. Create the first booking to get started.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date & time</th>
                  <th>Responsible</th>
                  <th>Equipment</th>
                  <th>Employee</th>
                  <th>Status</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {data.upcomingRentals.map((rental) => (
                  <tr key={rental.id}>
                    <td>
                      <strong>{formatEventDate(rental.startAt, { day: "2-digit", month: "short", year: "numeric" })}</strong>
                      <small>{formatEventDate(rental.startAt, { hour: "2-digit", minute: "2-digit" })} – {formatEventDate(rental.endAt, { hour: "2-digit", minute: "2-digit" })}</small>
                    </td>
                    <td><strong>{rental.customer.name}</strong><small>{rental.customer.contact}</small></td>
                    <td>{rental.items.flatMap((item) => item.units.map((unit) => unit.identifier)).join(", ")}</td>
                    <td>{rental.employees.map((employee) => employee.name).join(", ")}</td>
                    <td><StatusBadge status={rental.status} /></td>
                    <td>{formatCurrency(rental.remainingAmountCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
