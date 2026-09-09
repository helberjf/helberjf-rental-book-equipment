import { useLanguage } from "../context/Language";
import { t, getLocale } from "../domain/language";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ErrorBlock, LoadingBlock, StatusBadge } from "../components/RentalUI";
import { formatEventDate, getCalendarDays, toLocalDateKey } from "../domain/rental-utils";
import api from "../services/axios";
import { getApiError } from "../services/errors";
const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const changeMonth = (month, amount) => {
  const [year, monthNumber] = month.split("-").map(Number);
  const value = new Date(Date.UTC(year, monthNumber - 1 + amount, 1));
  return value.toISOString().slice(0, 7);
};
export default function Calendar() {
  useLanguage();
  const [month, setMonth] = useState(toLocalDateKey(new Date()).slice(0, 7));
  const [events, setEvents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [selectedDay, setSelectedDay] = useState(toLocalDateKey(new Date()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const days = useMemo(() => getCalendarDays(month), [month]);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const startAt = new Date(`${days[0].key}T03:00:00.000Z`);
      const lastDate = new Date(`${days.at(-1).key}T03:00:00.000Z`);
      lastDate.setUTCDate(lastDate.getUTCDate() + 1);
      const [response, staff] = await Promise.all([api.get("/api/calendar/events", {
        params: {
          startAt: startAt.toISOString(),
          endAt: lastDate.toISOString()
        }
      }), api.get('/api/staff-bookings')]);
      setEvents([...response.data.result, ...staff.data.result.map(b => ({
        id: `staff-${b.id}`,
        start: b.startAt,
        end: b.endAt,
        responsibleName: b.title,
        responsibleContact: b.employee.contact,
        employeeNames: [b.employee.name],
        equipment: [],
        status: "CONFIRMED",
        staffBooking: true
      }))]);
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setLoading(false);
    }
  }, [days]);
  useEffect(() => {
    void load();
  }, [load]);
  const eventsByDay = useMemo(() => {
    const grouped = new Map();
    days.forEach(day => {
      const from = new Date(`${day.key}T00:00:00-03:00`);
      const until = new Date(from.getTime() + 86400000);
      grouped.set(day.key, events.filter(event => new Date(event.start) < until && new Date(event.end) > from));
    });
    return grouped;
  }, [events, days]);
  if (loading) return <LoadingBlock label={t("Building calendar")} />;
  if (error) return <ErrorBlock message={error} onRetry={load} />;
  const monthTitle = new Intl.DateTimeFormat(getLocale(), {
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(`${month}-01T00:00:00Z`));
  return <div className="calendar-layout">
      <section className="panel calendar-panel">
        <div className="calendar-toolbar">
          <div>
            <span className="eyebrow">{t("MONTHLY SCHEDULE")}</span>
            <h2>{monthTitle}</h2>
          </div>
          <div className="calendar-controls">
            <Link className="button button-primary" to={`/admin/rentals?date=${selectedDay}`}>{t("+ New event")}</Link>
            <button className="icon-button" onClick={() => setMonth(changeMonth(month, -1))} aria-label={t("Previous month")}>←</button>
            <button className="button button-secondary" onClick={() => setMonth(toLocalDateKey(new Date()).slice(0, 7))}>{t("Today")}</button>
            <button className="icon-button" onClick={() => setMonth(changeMonth(month, 1))} aria-label={t("Next month")}>→</button>
          </div>
        </div>

        <div className="calendar-weekdays">
          {weekdays.map(day => <span key={t(day)}>{t(day)}</span>)}
        </div>
        <div className="calendar-grid">
          {days.map(day => {
          const dayEvents = eventsByDay.get(day.key) ?? [];
          const isToday = day.key === toLocalDateKey(new Date());
          return <div className={`calendar-day ${!day.currentMonth ? "outside" : ""}`} key={day.key}>
                <button type="button" aria-label={day.key} aria-pressed={selectedDay === day.key} className={`day-number ${isToday ? "today" : ""}`} onClick={() => {
              setSelectedDay(day.key);
              setSelected(null);
            }}>{day.day}</button>
                <div className="day-events">
                  {dayEvents.slice(0, 3).map(event => <button className={`calendar-event event-${event.status.toLowerCase().replace("_", "-")}`} key={event.id} onClick={() => setSelected(event)}>
                      <strong>{formatEventDate(event.start, {
                    hour: "2-digit",
                    minute: "2-digit"
                  })}</strong>
                      <span>{event.responsibleName}</span>
                    </button>)}
                  {dayEvents.length > 3 && <small className="more-events">+{dayEvents.length - 3} {t("more")}</small>}
                </div>
              </div>;
        })}
        </div>
        <section className="day-agenda">
          <div className="panel-header"><h3>{formatEventDate(`${selectedDay}T12:00:00-03:00`, {
              dateStyle: 'long'
            })}</h3><Link className="text-link" to={`/admin/rentals?date=${selectedDay}`}>{t("New booking on this date")}</Link></div>
          {(eventsByDay.get(selectedDay) ?? []).map(event => <button className="agenda-card" key={event.id} onClick={() => setSelected(event)}><strong>{event.responsibleName}</strong><span>{formatEventDate(event.start, {
              hour: '2-digit',
              minute: '2-digit'
            })} – {formatEventDate(event.end, {
              hour: '2-digit',
              minute: '2-digit'
            })}</span><small>{event.employeeNames.join(', ')}</small></button>)}
          {!eventsByDay.get(selectedDay)?.length && <p>{t("No events on this date")}</p>}
        </section>
      </section>

      <aside className="panel calendar-detail">
        {selected ? <>
            <div className="panel-header"><div><span className="eyebrow">{t("EVENT DETAILS")}</span><h3>{selected.responsibleName}</h3></div><button className="icon-button" onClick={() => setSelected(null)}>×</button></div>
            <StatusBadge status={selected.status} />
            <dl>
              <div><dt>{t("Date")}</dt><dd>{formatEventDate(selected.start, {
                weekday: "long",
                day: "2-digit",
                month: "long",
                year: "numeric"
              })}</dd></div>
              <div><dt>{t("Time")}</dt><dd>{formatEventDate(selected.start, {
                hour: "2-digit",
                minute: "2-digit"
              })} – {formatEventDate(selected.end, {
                hour: "2-digit",
                minute: "2-digit"
              })}</dd></div>
              <div><dt>{t("Contact")}</dt><dd>{selected.responsibleContact}</dd></div>
              <div><dt>{t("Employee")}</dt><dd>{selected.employeeNames.join(", ")}</dd></div>
              <div><dt>{t("Equipment")}</dt><dd>{selected.equipment.join(", ")}</dd></div>
            </dl>
          </> : <div className="calendar-placeholder">
            <span>▦</span>
            <strong>{t("Select an event")}</strong>
            <p>{t("Choose any booking in the calendar to see its schedule, staff and equipment.")}</p>
          </div>}
      </aside>
    </div>;
}
