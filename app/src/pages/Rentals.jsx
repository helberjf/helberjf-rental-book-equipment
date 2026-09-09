import { useLanguage } from "../context/Language";
import { t } from "../domain/language";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { EmptyBlock, LoadingBlock, StatusBadge } from "../components/RentalUI";
import { buildEventRange, buildRentalItems, formatCurrency, formatEventDate, moneyToCents, toLocalDateKey } from "../domain/rental-utils";
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
  selectedUnitIds: []
});
const unitNames = rental => rental.items.flatMap(item => item.units.map(unit => unit.identifier)).join(", ");
export default function Rentals() {
  useLanguage();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState(() => ({
    ...initialForm(),
    date: searchParams.get('date') || toLocalDateKey(new Date())
  }));
  const [amountEdited, setAmountEdited] = useState(false);
  const [products, setProducts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [rentals, setRentals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [availabilityVersion, setAvailabilityVersion] = useState(0);
  const [availabilityLoading, setAvailabilityLoading] = useState(true);
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
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await loadRentals();
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setLoading(false);
    }
  }, [loadRentals]);
  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);
  useEffect(() => {
    if (!form.date || !form.startTime || !form.endTime) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setAvailabilityLoading(true);
      try {
        const range = buildEventRange(form.date, form.startTime, form.endTime);
        const config = { params: range, signal: controller.signal };
        const [equipment, staff] = await Promise.all([api.get('/api/products', config), api.get('/api/employees', config)]);
        if (!controller.signal.aborted) {
          setProducts(equipment.data.result);
          setEmployees(staff.data.result);
        }
      } catch (requestError) {
        if (!controller.signal.aborted) setError(getApiError(requestError));
      } finally {
        if (!controller.signal.aborted) setAvailabilityLoading(false);
      }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [form.date, form.endTime, form.startTime, availabilityVersion]);
  const suggestedAmount = buildRentalItems(products, form.selectedUnitIds).reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
  const chargedValue = amountEdited ? form.finalAmount : (suggestedAmount / 100).toFixed(2);
  const filteredRentals = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rentals.filter(rental => {
      const matchesStatus = !status || rental.status === status;
      const haystack = [rental.code, rental.customer.name, rental.customer.contact, unitNames(rental)].join(" ").toLowerCase();
      return matchesStatus && (!term || haystack.includes(term));
    });
  }, [rentals, search, status]);
  const updateForm = (field, value) => {
    if (field === 'finalAmount') setAmountEdited(true);
    if (['date', 'startTime', 'endTime'].includes(field)) setAvailabilityLoading(true);
    setForm(current => ({
      ...current,
      [field]: value,
      ...(['date', 'startTime', 'endTime'].includes(field) ? {
        employeeIds: [],
        selectedUnitIds: []
      } : {})
    }));
  };
  const toggleListValue = (field, value) => {
    setForm(current => ({
      ...current,
      [field]: current[field].includes(value) ? current[field].filter(item => item !== value) : [...current[field], value]
    }));
  };
  const submit = async event => {
    event.preventDefault();
    setError("");
    setNotice("");
    const items = buildRentalItems(products, form.selectedUnitIds);
    if (form.employeeIds.length === 0) {
      setError(t("Select at least one employee."));
      return;
    }
    try {
      setSaving(true);
      const {
        startAt,
        endAt
      } = buildEventRange(form.date, form.startTime, form.endTime);
      const receivedAmountCents = moneyToCents(form.receivedAmount);
      await api.post("/api/rentals", {
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        responsibleName: form.responsibleName,
        responsibleContact: form.responsibleContact,
        responsibleEmail: form.responsibleEmail,
        venue: form.venue,
        notes: form.notes,
        finalAmountCents: moneyToCents(chargedValue),
        employeeIds: form.employeeIds,
        items,
        confirm: true,
        ...(receivedAmountCents > 0 ? {
          initialPayment: {
            amountCents: receivedAmountCents,
            method: "PIX",
            status: "CONFIRMED",
            paidAt: new Date().toISOString()
          }
        } : {})
      });
      setForm(initialForm());
      setAmountEdited(false);
      setNotice(t("Event created and equipment reserved successfully."));
      await loadRentals();
      setAvailabilityLoading(true);
      setAvailabilityVersion(current => current + 1);
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setSaving(false);
    }
  };
  const confirmDraft = async rental => {
    setError("");
    try {
      await api.post(`/api/rentals/${rental.id}/confirm`);
      setNotice(t("Event confirmed."));
      await loadRentals();
      setAvailabilityLoading(true);
      setAvailabilityVersion(current => current + 1);
    } catch (requestError) {
      setError(getApiError(requestError));
    }
  };
  const addPayment = async event => {
    event.preventDefault();
    if (!paymentRental) return;
    try {
      setSaving(true);
      await api.post(`/api/rentals/${paymentRental.id}/payments`, {
        amountCents: moneyToCents(paymentAmount),
        method: "PIX",
        status: "CONFIRMED",
        paidAt: new Date().toISOString()
      });
      setNotice(t("Payment recorded."));
      setPaymentRental(null);
      setPaymentAmount("");
      await loadRentals();
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setSaving(false);
    }
  };
  if (loading) return <LoadingBlock label={t("Loading event management")} />;
  return <div className="page-stack">
      {(notice || error) && <div className={`notice ${error ? "notice-error" : "notice-success"}`}>
          <span>{error || notice}</span>
          <button onClick={() => {
        setError("");
        setNotice("");
      }} aria-label={t("Dismiss")}>×</button>
        </div>}

      <div className="rentals-layout">
        <form className="panel rental-form" onSubmit={submit}>
          <div className="panel-header">
            <div><span className="eyebrow">{t("NEW BOOKING")}</span><h3>{t("Event details")}</h3></div>
            <span className="step-chip">01</span>
          </div>

          <div className="form-grid three-columns">
            <label>{t("Event date")}<input type="date" required value={form.date} onChange={e => updateForm("date", e.target.value)} /></label>
            <label>{t("Start time")}<input type="time" required value={form.startTime} onChange={e => updateForm("startTime", e.target.value)} /></label>
            <label>{t("End time")}<input type="time" required value={form.endTime} onChange={e => updateForm("endTime", e.target.value)} /></label>
          </div>

          <div className="form-grid two-columns">
            <label>{t("Responsible person")}<input required minLength="2" placeholder={t("Full name")} value={form.responsibleName} onChange={e => updateForm("responsibleName", e.target.value)} /></label>
            <label>{t("Contact")}<input required minLength="5" placeholder={t("Phone or WhatsApp")} value={form.responsibleContact} onChange={e => updateForm("responsibleContact", e.target.value)} /></label>
            <label>{t("Email")} <span>{t("optional")}</span><input type="email" placeholder="name@example.com" value={form.responsibleEmail} onChange={e => updateForm("responsibleEmail", e.target.value)} /></label>
            <label>{t("Venue")} <span>{t("optional")}</span><input placeholder={t("Event location")} value={form.venue} onChange={e => updateForm("venue", e.target.value)} /></label>
            <label>{t("Amount charged")}<input required type="number" min="0" step="0.01" inputMode="decimal" placeholder="0.00" value={chargedValue} onChange={e => updateForm("finalAmount", e.target.value)} /></label>
            <label>{t("Amount received")}<input inputMode="decimal" placeholder="0.00" value={form.receivedAmount} onChange={e => updateForm("receivedAmount", e.target.value)} /></label>
          </div>

          <fieldset>
            <button type="button" className="button button-secondary" onClick={() => setAmountEdited(false)}>{t("Use standard prices")}</button>
            <legend>{t("Equipment units")}</legend>
            <p className="field-help">{t("Availability updates automatically for the selected date and time.")}</p>
            <p className="field-help">{t("For service-only events, leave equipment unselected and enter the agreed price.")}</p>
            <div className="equipment-groups">
              {products.map(product => <div className="equipment-group" key={product.id}>
                  <strong>{product.name}</strong>
                  <span>{product.category}</span>
                  <div className="unit-grid">
                    {product.units.map(unit => <label className={`unit-option ${!unit.available ? "unavailable" : ""}`} key={unit.id}>
                        <input type="checkbox" disabled={availabilityLoading || !unit.available} checked={form.selectedUnitIds.includes(unit.id)} onChange={() => toggleListValue("selectedUnitIds", unit.id)} />
                        <span>{unit.identifier}</span>
                        <small>{unit.available ? t("Available") : t("Booked")}</small>
                      </label>)}
                  </div>
                </div>)}
            </div>
          </fieldset>

          <fieldset>
            <legend>{t("Assigned employees")}</legend>
            <div className="check-row">
              {employees.map(employee => <label className="check-pill" key={employee.id}>
                  <input type="checkbox" disabled={availabilityLoading || employee.available === false} checked={form.employeeIds.includes(employee.id)} onChange={() => toggleListValue("employeeIds", employee.id)} />
                  {employee.name}
                  {employee.available === false && <small>{t("Booked")}</small>}
                </label>)}
            </div>
          </fieldset>

          <label>{t("Notes")} <span>{t("optional")}</span><textarea rows="3" placeholder={t("Access instructions, clothing, special requirements\u2026")} value={form.notes} onChange={e => updateForm("notes", e.target.value)} /></label>

          <button className="button button-primary button-wide" disabled={saving || availabilityLoading}>
            {saving ? t("Saving event\u2026") : t("Create event and reserve equipment")}
          </button>
        </form>

        <aside className="form-summary">
          <span className="eyebrow">{t("LIVE SUMMARY")}</span>
          <h3>{form.responsibleName || t("New event")}</h3>
          <dl>
            <div><dt>{t("Schedule")}</dt><dd>{form.date}<br />{form.startTime} – {form.endTime}</dd></div>
            <div><dt>{t("Equipment")}</dt><dd>{form.selectedUnitIds.length} {t("units")}</dd></div>
            <div><dt>{t("Staff")}</dt><dd>{form.employeeIds.length || t("Not assigned")}</dd></div>
            <div><dt>{t("Charged")}</dt><dd>{formatCurrency(moneyToCents(chargedValue))}</dd></div>
            <div><dt>{t("Remaining")}</dt><dd>{formatCurrency(Math.max(moneyToCents(chargedValue) - moneyToCents(form.receivedAmount), 0))}</dd></div>
          </dl>
          <p>{t("Overnight events automatically end on the following day.")}</p>
        </aside>
      </div>

      <section className="panel">
        <div className="panel-header events-toolbar">
          <div><span className="eyebrow">{t("EVENT PIPELINE")}</span><h3>{t("All bookings")}</h3></div>
          <div className="filter-row">
            <input type="search" placeholder={t("Search name, contact or unit")} value={search} onChange={e => setSearch(e.target.value)} />
            <select value={status} onChange={e => setStatus(e.target.value)}>
              <option value="">{t("All statuses")}</option>
              <option value="DRAFT">{t("Draft")}</option>
              <option value="CONFIRMED">{t("Confirmed")}</option>
              <option value="IN_PROGRESS">{t("In progress")}</option>
              <option value="COMPLETED">{t("Completed")}</option>
              <option value="CANCELLED">{t("Cancelled")}</option>
            </select>
          </div>
        </div>

        {filteredRentals.length === 0 ? <EmptyBlock title={t("No events found")} text={t("Create a booking above or change the current filters.")} /> : <div className="table-wrap">
            <table>
              <thead><tr><th>{t("Date & time")}</th><th>{t("Responsible")}</th><th>{t("Equipment")}</th><th>{t("Employee")}</th><th>{t("Charged")}</th><th>{t("Received")}</th><th>{t("Remaining")}</th><th>{t("Status")}</th><th /></tr></thead>
              <tbody>
                {filteredRentals.map(rental => <tr key={rental.id}>
                    <td data-label={t("Date & time")}><strong>{formatEventDate(rental.startAt, {
                    day: "2-digit",
                    month: "short",
                    year: "numeric"
                  })}</strong><small>{formatEventDate(rental.startAt, {
                    hour: "2-digit",
                    minute: "2-digit"
                  })} – {formatEventDate(rental.endAt, {
                    hour: "2-digit",
                    minute: "2-digit"
                  })}</small></td>
                    <td data-label={t("Responsible")}><strong>{rental.customer.name}</strong><small>{rental.customer.contact}</small></td>
                    <td data-label={t("Equipment")}>{unitNames(rental) || t("Quantity item")}</td>
                    <td data-label={t("Employee")}>{rental.employees.map(employee => employee.name).join(", ")}</td>
                    <td data-label={t("Charged")}>{formatCurrency(rental.finalAmountCents)}</td>
                    <td className="positive-value" data-label={t("Received")}>{formatCurrency(rental.receivedAmountCents)}</td>
                    <td className={rental.remainingAmountCents ? "warning-value" : "positive-value"} data-label={t("Remaining")}>{formatCurrency(rental.remainingAmountCents)}</td>
                    <td data-label={t("Status")}><StatusBadge status={rental.status} /></td>
                    <td className="row-actions">
                      {rental.status === "DRAFT" && <button className="button button-small button-secondary" onClick={() => void confirmDraft(rental)}>{t("Confirm")}</button>}
                      {rental.status !== "CANCELLED" && rental.remainingAmountCents > 0 && <button className="button button-small button-ghost" onClick={() => setPaymentRental(rental)}>{t("+ Payment")}</button>}
                    </td>
                  </tr>)}
              </tbody>
            </table>
          </div>}
      </section>

      {paymentRental && <div className="modal-backdrop" role="presentation" onMouseDown={() => setPaymentRental(null)}>
          <form className="modal-card" onSubmit={addPayment} onMouseDown={event => event.stopPropagation()}>
            <div className="panel-header"><div><span className="eyebrow">{t("RECEIVE PAYMENT")}</span><h3>{paymentRental.customer.name}</h3></div><button type="button" className="icon-button" onClick={() => setPaymentRental(null)}>×</button></div>
            <p>{t("Open balance:")} <strong>{formatCurrency(paymentRental.remainingAmountCents)}</strong></p>
            <label>{t("Payment amount")}<input autoFocus required inputMode="decimal" placeholder="0.00" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} /></label>
            <button className="button button-primary button-wide" disabled={saving}>{saving ? t("Saving\u2026") : t("Confirm PIX payment")}</button>
          </form>
        </div>}
    </div>;
}
