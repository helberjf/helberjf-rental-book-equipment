import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyBlock, ErrorBlock, LoadingBlock, StatusBadge } from "../components/RentalUI";
import {
  buildEventRange,
  buildRentalItems,
  formatCurrency,
  formatEventDate,
  moneyToCents,
  toLocalDateKey,
} from "../domain/rental-utils";
import api from "../services/axios";
import { getApiError } from "../services/errors";

const initialForm = () => ({
  date: toLocalDateKey(new Date()),
  startTime: "18:00",
  endTime: "22:00",
  responsibleName: "",
  responsibleContact: "",
  responsibleEmail: "",
  venue: "",
  finalAmount: "",
  receivedAmount: "",
  notes: "",
  employeeIds: [],
  selectedUnitIds: [],
});

const unitNames = (rental) =>
  rental.items
    .flatMap((item) => item.units.map((unit) => unit.identifier))
    .join(", ");

export default function Rentals() {
  const [form, setForm] = useState(initialForm);
  const [products, setProducts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [rentals, setRentals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [paymentRental, setPaymentRental] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");

  const loadRentals = useCallback(async () => {
    const response = await api.get("/api/rentals");
    setRentals(response.data.result);
  }, []);

  const loadEmployees = useCallback(async () => {
    const response = await api.get("/api/employees");
    setEmployees(response.data.result);
  }, []);

  const loadProducts = useCallback(async (range) => {
    const response = await api.get("/api/products", {
      params: range
        ? { startAt: range.startAt.toISOString(), endAt: range.endAt.toISOString() }
        : undefined,
    });
    setProducts(response.data.result);
  }, []);

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await Promise.all([loadRentals(), loadEmployees(), loadProducts()]);
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setLoading(false);
    }
  }, [loadEmployees, loadProducts, loadRentals]);

  useEffect(() => { void loadInitialData(); }, [loadInitialData]);

  useEffect(() => {
    if (!form.date || !form.startTime || !form.endTime) return;
    const timer = window.setTimeout(async () => {
      try {
        const range = buildEventRange(form.date, form.startTime, form.endTime);
        await loadProducts(range);
      } catch (requestError) {
        setError(getApiError(requestError));
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [form.date, form.endTime, form.startTime, loadProducts]);

  const filteredRentals = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rentals.filter((rental) => {
      const matchesStatus = !status || rental.status === status;
      const haystack = [
        rental.code,
        rental.customer.name,
        rental.customer.contact,
        unitNames(rental),
      ].join(" ").toLowerCase();
      return matchesStatus && (!term || haystack.includes(term));
    });
  }, [rentals, search, status]);

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const toggleListValue = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: current[field].includes(value)
        ? current[field].filter((item) => item !== value)
        : [...current[field], value],
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");

    const items = buildRentalItems(products, form.selectedUnitIds);
    if (items.length === 0) {
      setError("Select at least one equipment unit.");
      return;
    }
    if (form.employeeIds.length === 0) {
      setError("Select at least one employee.");
      return;
    }

    try {
      setSaving(true);
      const { startAt, endAt } = buildEventRange(form.date, form.startTime, form.endTime);
      const receivedAmountCents = moneyToCents(form.receivedAmount);
      await api.post("/api/rentals", {
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        responsibleName: form.responsibleName,
        responsibleContact: form.responsibleContact,
        responsibleEmail: form.responsibleEmail,
        venue: form.venue,
        notes: form.notes,
        finalAmountCents: moneyToCents(form.finalAmount),
        employeeIds: form.employeeIds,
        items,
        confirm: true,
        ...(receivedAmountCents > 0
          ? {
              initialPayment: {
                amountCents: receivedAmountCents,
                method: "PIX",
                status: "CONFIRMED",
                paidAt: new Date().toISOString(),
              },
            }
          : {}),
      });
      setForm(initialForm());
      setNotice("Event created and equipment reserved successfully.");
      await loadRentals();
      await loadProducts();
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setSaving(false);
    }
  };

  const confirmDraft = async (rental) => {
    setError("");
    try {
      await api.post(`/api/rentals/${rental.id}/confirm`);
      setNotice(`${rental.code} was confirmed.`);
      await loadRentals();
    } catch (requestError) {
      setError(getApiError(requestError));
    }
  };

  const addPayment = async (event) => {
    event.preventDefault();
    if (!paymentRental) return;
    try {
      setSaving(true);
      await api.post(`/api/rentals/${paymentRental.id}/payments`, {
        amountCents: moneyToCents(paymentAmount),
        method: "PIX",
        status: "CONFIRMED",
        paidAt: new Date().toISOString(),
      });
      setNotice(`Payment added to ${paymentRental.code}.`);
      setPaymentRental(null);
      setPaymentAmount("");
      await loadRentals();
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingBlock label="Loading event management" />;
  if (error && rentals.length === 0) return <ErrorBlock message={error} onRetry={loadInitialData} />;

  return (
    <div className="page-stack">
      {(notice || error) && (
        <div className={`notice ${error ? "notice-error" : "notice-success"}`}>
          <span>{error || notice}</span>
          <button onClick={() => { setError(""); setNotice(""); }} aria-label="Dismiss">×</button>
        </div>
      )}

      <div className="rentals-layout">
        <form className="panel rental-form" onSubmit={submit}>
          <div className="panel-header">
            <div><span className="eyebrow">NEW BOOKING</span><h3>Event details</h3></div>
            <span className="step-chip">01</span>
          </div>

          <div className="form-grid three-columns">
            <label>Event date<input type="date" required value={form.date} onChange={(e) => updateForm("date", e.target.value)} /></label>
            <label>Start time<input type="time" required value={form.startTime} onChange={(e) => updateForm("startTime", e.target.value)} /></label>
            <label>End time<input type="time" required value={form.endTime} onChange={(e) => updateForm("endTime", e.target.value)} /></label>
          </div>

          <div className="form-grid two-columns">
            <label>Responsible person<input required minLength="2" placeholder="Full name" value={form.responsibleName} onChange={(e) => updateForm("responsibleName", e.target.value)} /></label>
            <label>Contact<input required minLength="5" placeholder="Phone or WhatsApp" value={form.responsibleContact} onChange={(e) => updateForm("responsibleContact", e.target.value)} /></label>
            <label>Email <span>optional</span><input type="email" placeholder="name@example.com" value={form.responsibleEmail} onChange={(e) => updateForm("responsibleEmail", e.target.value)} /></label>
            <label>Venue <span>optional</span><input placeholder="Event location" value={form.venue} onChange={(e) => updateForm("venue", e.target.value)} /></label>
            <label>Amount charged<input required inputMode="decimal" placeholder="0.00" value={form.finalAmount} onChange={(e) => updateForm("finalAmount", e.target.value)} /></label>
            <label>Amount received<input inputMode="decimal" placeholder="0.00" value={form.receivedAmount} onChange={(e) => updateForm("receivedAmount", e.target.value)} /></label>
          </div>

          <fieldset>
            <legend>Equipment units</legend>
            <p className="field-help">Availability updates automatically for the selected date and time.</p>
            <div className="equipment-groups">
              {products.map((product) => (
                <div className="equipment-group" key={product.id}>
                  <strong>{product.name}</strong>
                  <span>{product.category}</span>
                  <div className="unit-grid">
                    {product.units.map((unit) => (
                      <label className={`unit-option ${!unit.available ? "unavailable" : ""}`} key={unit.id}>
                        <input
                          type="checkbox"
                          disabled={!unit.available}
                          checked={form.selectedUnitIds.includes(unit.id)}
                          onChange={() => toggleListValue("selectedUnitIds", unit.id)}
                        />
                        <span>{unit.identifier}</span>
                        <small>{unit.available ? "Available" : "Booked"}</small>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Assigned employees</legend>
            <div className="check-row">
              {employees.map((employee) => (
                <label className="check-pill" key={employee.id}>
                  <input type="checkbox" checked={form.employeeIds.includes(employee.id)} onChange={() => toggleListValue("employeeIds", employee.id)} />
                  {employee.name}
                </label>
              ))}
            </div>
          </fieldset>

          <label>Notes <span>optional</span><textarea rows="3" placeholder="Access instructions, clothing, special requirements…" value={form.notes} onChange={(e) => updateForm("notes", e.target.value)} /></label>

          <button className="button button-primary button-wide" disabled={saving}>
            {saving ? "Saving event…" : "Create event and reserve equipment"}
          </button>
        </form>

        <aside className="form-summary">
          <span className="eyebrow">LIVE SUMMARY</span>
          <h3>{form.responsibleName || "New event"}</h3>
          <dl>
            <div><dt>Schedule</dt><dd>{form.date}<br />{form.startTime} – {form.endTime}</dd></div>
            <div><dt>Equipment</dt><dd>{form.selectedUnitIds.length} unit{form.selectedUnitIds.length === 1 ? "" : "s"}</dd></div>
            <div><dt>Staff</dt><dd>{form.employeeIds.length || "Not assigned"}</dd></div>
            <div><dt>Charged</dt><dd>{formatCurrency(moneyToCents(form.finalAmount))}</dd></div>
            <div><dt>Remaining</dt><dd>{formatCurrency(Math.max(moneyToCents(form.finalAmount) - moneyToCents(form.receivedAmount), 0))}</dd></div>
          </dl>
          <p>Overnight events automatically end on the following day.</p>
        </aside>
      </div>

      <section className="panel">
        <div className="panel-header events-toolbar">
          <div><span className="eyebrow">EVENT PIPELINE</span><h3>All bookings</h3></div>
          <div className="filter-row">
            <input type="search" placeholder="Search name, contact or unit" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>

        {filteredRentals.length === 0 ? (
          <EmptyBlock title="No events found" text="Create a booking above or change the current filters." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date & time</th><th>Responsible</th><th>Equipment</th><th>Employee</th><th>Charged</th><th>Received</th><th>Remaining</th><th>Status</th><th /></tr></thead>
              <tbody>
                {filteredRentals.map((rental) => (
                  <tr key={rental.id}>
                    <td><strong>{formatEventDate(rental.startAt, { day: "2-digit", month: "short", year: "numeric" })}</strong><small>{formatEventDate(rental.startAt, { hour: "2-digit", minute: "2-digit" })} – {formatEventDate(rental.endAt, { hour: "2-digit", minute: "2-digit" })}</small></td>
                    <td><strong>{rental.customer.name}</strong><small>{rental.customer.contact}</small></td>
                    <td>{unitNames(rental) || "Quantity item"}</td>
                    <td>{rental.employees.map((employee) => employee.name).join(", ")}</td>
                    <td>{formatCurrency(rental.finalAmountCents)}</td>
                    <td className="positive-value">{formatCurrency(rental.receivedAmountCents)}</td>
                    <td className={rental.remainingAmountCents ? "warning-value" : "positive-value"}>{formatCurrency(rental.remainingAmountCents)}</td>
                    <td><StatusBadge status={rental.status} /></td>
                    <td className="row-actions">
                      {rental.status === "DRAFT" && <button className="button button-small button-secondary" onClick={() => void confirmDraft(rental)}>Confirm</button>}
                      {rental.status !== "CANCELLED" && rental.remainingAmountCents > 0 && <button className="button button-small button-ghost" onClick={() => setPaymentRental(rental)}>+ Payment</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {paymentRental && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setPaymentRental(null)}>
          <form className="modal-card" onSubmit={addPayment} onMouseDown={(event) => event.stopPropagation()}>
            <div className="panel-header"><div><span className="eyebrow">RECEIVE PAYMENT</span><h3>{paymentRental.customer.name}</h3></div><button type="button" className="icon-button" onClick={() => setPaymentRental(null)}>×</button></div>
            <p>Open balance: <strong>{formatCurrency(paymentRental.remainingAmountCents)}</strong></p>
            <label>Payment amount<input autoFocus required inputMode="decimal" placeholder="0.00" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} /></label>
            <button className="button button-primary button-wide" disabled={saving}>{saving ? "Saving…" : "Confirm PIX payment"}</button>
          </form>
        </div>
      )}
    </div>
  );
}
