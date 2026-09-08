import { useCallback, useEffect, useState } from "react";
import { EmptyBlock, ErrorBlock, LoadingBlock, StatusBadge } from "../components/RentalUI";
import { formatCurrency, formatEventDate, toLocalDateKey } from "../domain/rental-utils";
import api from "../services/axios";
import { getApiError } from "../services/errors";

export default function Reports() {
  const [month, setMonth] = useState(toLocalDateKey(new Date()).slice(0, 7));
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/api/reports/monthly", { params: { month } });
      setReport(response.data.result);
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <LoadingBlock label="Compiling monthly report" />;
  if (error) return <ErrorBlock message={error} onRetry={load} />;

  return (
    <div className="page-stack report-page">
      <section className="panel report-toolbar no-print">
        <div>
          <span className="eyebrow">REPORT PERIOD</span>
          <h3>Monthly performance</h3>
        </div>
        <div className="filter-row">
          <label>Month<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label>
          <button className="button button-primary" onClick={() => window.print()}>Print report</button>
        </div>
      </section>

      <header className="print-header">
        <div><span className="eyebrow">RENTAL BOOK EQUIPMENT</span><h1>Monthly rental report</h1></div>
        <p>Period: {month}</p>
      </header>

      <section className="stats-grid report-stats">
        <article className="stat-card tone-violet"><span>Total events</span><strong>{report.totals.events}</strong><small>All non-cancelled bookings</small></article>
        <article className="stat-card tone-blue"><span>Future events</span><strong>{report.totals.futureEvents}</strong><small>Events still ahead</small></article>
        <article className="stat-card tone-neutral"><span>Amount charged</span><strong>{formatCurrency(report.totals.chargedAmountCents)}</strong><small>Contracted revenue</small></article>
        <article className="stat-card tone-green"><span>Amount received</span><strong>{formatCurrency(report.totals.receivedAmountCents)}</strong><small>Confirmed payments</small></article>
        <article className="stat-card tone-amber"><span>Remaining balance</span><strong>{formatCurrency(report.totals.remainingAmountCents)}</strong><small>Still expected</small></article>
      </section>

      <section className="panel report-table">
        <div className="panel-header"><div><span className="eyebrow">EVENT LEDGER</span><h3>Monthly detail</h3></div><span className="record-count">{report.rentals.length} records</span></div>
        {report.rentals.length === 0 ? (
          <EmptyBlock title="No events in this month" text="Choose another period or create a new booking." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Time</th><th>Responsible</th><th>Contact</th><th>Employee</th><th>Equipment</th><th>Charged</th><th>Received</th><th>Remaining</th><th>Status</th></tr></thead>
              <tbody>
                {report.rentals.map((rental) => (
                  <tr key={rental.id}>
                    <td>{formatEventDate(rental.startAt, { day: "2-digit", month: "2-digit", year: "numeric" })}</td>
                    <td>{formatEventDate(rental.startAt, { hour: "2-digit", minute: "2-digit" })} – {formatEventDate(rental.endAt, { hour: "2-digit", minute: "2-digit" })}</td>
                    <td><strong>{rental.customer.name}</strong></td>
                    <td>{rental.customer.contact}</td>
                    <td>{rental.employees.map((employee) => employee.name).join(", ")}</td>
                    <td>{rental.items.flatMap((item) => item.units.map((unit) => unit.identifier)).join(", ")}</td>
                    <td>{formatCurrency(rental.finalAmountCents)}</td>
                    <td>{formatCurrency(rental.receivedAmountCents)}</td>
                    <td>{formatCurrency(rental.remainingAmountCents)}</td>
                    <td><StatusBadge status={rental.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer className="print-footer">Generated on {new Date().toLocaleString("en-GB")}</footer>
    </div>
  );
}
