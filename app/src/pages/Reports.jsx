import { useLanguage } from "../context/Language";
import { t, getLocale } from "../domain/language";
import { useCallback, useEffect, useState } from "react";
import { EmptyBlock, ErrorBlock, LoadingBlock, StatusBadge } from "../components/RentalUI";
import { formatCurrency, formatEventDate, toLocalDateKey } from "../domain/rental-utils";
import api from "../services/axios";
import { getApiError } from "../services/errors";
export default function Reports() {
  useLanguage();
  const [month, setMonth] = useState(toLocalDateKey(new Date()).slice(0, 7));
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/api/reports/monthly", {
        params: {
          month
        }
      });
      setReport(response.data.result);
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setLoading(false);
    }
  }, [month]);
  useEffect(() => {
    void load();
  }, [load]);
  if (loading) return <LoadingBlock label={t("Compiling monthly report")} />;
  if (error) return <ErrorBlock message={error} onRetry={load} />;
  return <div className="page-stack report-page">
      <section className="panel report-toolbar no-print">
        <div>
          <span className="eyebrow">{t("REPORT PERIOD")}</span>
          <h3>{t("Monthly performance")}</h3>
        </div>
        <div className="filter-row">
          <label>{t("Month")}<input type="month" value={month} onChange={event => setMonth(event.target.value)} /></label>
          <button className="button button-primary" onClick={() => window.print()}>{t("Print report")}</button>
        </div>
      </section>

      <header className="print-header">
        <div><span className="eyebrow">RENTAL BOOK EQUIPMENT</span><h1>{t("Monthly rental report")}</h1></div>
        <p>{t("Period:")} {month}</p>
      </header>

      <section className="stats-grid report-stats">
        <article className="stat-card tone-violet"><span>{t("Total events")}</span><strong>{report.totals.events}</strong><small>{t("All non-cancelled bookings")}</small></article>
        <article className="stat-card tone-blue"><span>{t("Future events")}</span><strong>{report.totals.futureEvents}</strong><small>{t("Events still ahead")}</small></article>
        <article className="stat-card tone-neutral"><span>{t("Amount charged")}</span><strong>{formatCurrency(report.totals.chargedAmountCents)}</strong><small>{t("Contracted revenue")}</small></article>
        <article className="stat-card tone-green"><span>{t("Amount received")}</span><strong>{formatCurrency(report.totals.receivedAmountCents)}</strong><small>{t("Confirmed payments")}</small></article>
        <article className="stat-card tone-amber"><span>{t("Remaining balance")}</span><strong>{formatCurrency(report.totals.remainingAmountCents)}</strong><small>{t("Still expected")}</small></article>
      </section>

      <section className="panel report-table">
        <p><strong>{t('Staff cost')}: {formatCurrency(report.totals.staffCostCents || 0)}</strong> · {t('Internal cost, separate from the client charge.')}</p>
        <div className="panel-header"><div><span className="eyebrow">{t("EVENT LEDGER")}</span><h3>{t("Monthly detail")}</h3></div><span className="record-count">{report.rentals.length} {t("records")}</span></div>
        {report.rentals.length === 0 ? <EmptyBlock title={t("No events in this month")} text={t("Choose another period or create a new booking.")} /> : <div className="table-wrap">
            <table>
              <thead><tr><th>{t("Date")}</th><th>{t("Time")}</th><th>{t("Responsible")}</th><th>{t("Contact")}</th><th>{t("Employee")}</th><th>{t("Equipment")}</th><th>{t("Charged")}</th><th>{t("Received")}</th><th>{t("Remaining")}</th><th>{t("Status")}</th></tr></thead>
              <tbody>
                {report.rentals.map(rental => <tr key={rental.id}>
                    <td data-label={t("Date")}>{formatEventDate(rental.startAt, {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric"
                })}</td>
                    <td data-label={t("Time")}>{formatEventDate(rental.startAt, {
                  hour: "2-digit",
                  minute: "2-digit"
                })} – {formatEventDate(rental.endAt, {
                  hour: "2-digit",
                  minute: "2-digit"
                })}</td>
                    <td data-label={t("Responsible")}><strong>{rental.customer.name}</strong>{rental.finalNotes && <small className="event-final-notes"><b>{t('Final event notes')}: </b>{rental.finalNotes}</small>}</td>
                    <td data-label={t("Contact")}>{rental.customer.contact}</td>
                    <td data-label={t("Employee")}>{rental.employees.map(employee => <small key={employee.id}>{employee.name}: {formatCurrency(employee.costCents || 0)}</small>)}</td>
                    <td data-label={t("Equipment")}>{rental.items.flatMap(item => item.units.map(unit => unit.identifier)).join(", ")}</td>
                    <td data-label={t("Charged")}>{formatCurrency(rental.finalAmountCents)}</td>
                    <td data-label={t("Received")}>{formatCurrency(rental.receivedAmountCents)}</td>
                    <td data-label={t("Remaining")}>{formatCurrency(rental.remainingAmountCents)}</td>
                    <td data-label={t("Status")}><StatusBadge status={rental.status} /></td>
                  </tr>)}
              </tbody>
            </table>
          </div>}
      </section>

      <footer className="print-footer">{t("Generated on")} {new Date().toLocaleString(getLocale())}</footer>
    </div>;
}
