import { useCallback, useEffect, useMemo, useState } from "react";
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
  const [month, setMonth] = useState(toLocalDateKey(new Date()).slice(0, 7));
  const [events, setEvents] = useState([]);
  const [selected, setSelected] = useState(null);
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
      const response = await api.get("/api/calendar/events", {
        params: { startAt: startAt.toISOString(), endAt: lastDate.toISOString() },
      });
      setEvents(response.data.result);
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { void load(); }, [load]);

  const eventsByDay = useMemo(() => {
    const grouped = new Map();
    events.forEach((event) => {
      const key = toLocalDateKey(event.start);
      grouped.set(key, [...(grouped.get(key) ?? []), event]);
    });
    return grouped;
  }, [events]);

  if (loading) return <LoadingBlock label="Building calendar" />;
  if (error) return <ErrorBlock message={error} onRetry={load} />;

  const monthTitle = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));

  return (
    <div className="calendar-layout">
      <section className="panel calendar-panel">
        <div className="calendar-toolbar">
          <div>
            <span className="eyebrow">MONTHLY SCHEDULE</span>
            <h2>{monthTitle}</h2>
          </div>
          <div className="calendar-controls">
            <button className="icon-button" onClick={() => setMonth(changeMonth(month, -1))} aria-label="Previous month">←</button>
            <button className="button button-secondary" onClick={() => setMonth(toLocalDateKey(new Date()).slice(0, 7))}>Today</button>
            <button className="icon-button" onClick={() => setMonth(changeMonth(month, 1))} aria-label="Next month">→</button>
          </div>
        </div>

        <div className="calendar-weekdays">
          {weekdays.map((day) => <span key={day}>{day}</span>)}
        </div>
        <div className="calendar-grid">
          {days.map((day) => {
            const dayEvents = eventsByDay.get(day.key) ?? [];
            const isToday = day.key === toLocalDateKey(new Date());
            return (
              <div className={`calendar-day ${!day.currentMonth ? "outside" : ""}`} key={day.key}>
                <span className={`day-number ${isToday ? "today" : ""}`}>{day.day}</span>
                <div className="day-events">
                  {dayEvents.slice(0, 3).map((event) => (
                    <button className={`calendar-event event-${event.status.toLowerCase().replace("_", "-")}`} key={event.id} onClick={() => setSelected(event)}>
                      <strong>{formatEventDate(event.start, { hour: "2-digit", minute: "2-digit" })}</strong>
                      <span>{event.responsibleName}</span>
                    </button>
                  ))}
                  {dayEvents.length > 3 && <small className="more-events">+{dayEvents.length - 3} more</small>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <aside className="panel calendar-detail">
        {selected ? (
          <>
            <div className="panel-header"><div><span className="eyebrow">EVENT DETAILS</span><h3>{selected.responsibleName}</h3></div><button className="icon-button" onClick={() => setSelected(null)}>×</button></div>
            <StatusBadge status={selected.status} />
            <dl>
              <div><dt>Date</dt><dd>{formatEventDate(selected.start, { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</dd></div>
              <div><dt>Time</dt><dd>{formatEventDate(selected.start, { hour: "2-digit", minute: "2-digit" })} – {formatEventDate(selected.end, { hour: "2-digit", minute: "2-digit" })}</dd></div>
              <div><dt>Contact</dt><dd>{selected.responsibleContact}</dd></div>
              <div><dt>Employee</dt><dd>{selected.employeeNames.join(", ")}</dd></div>
              <div><dt>Equipment</dt><dd>{selected.equipment.join(", ")}</dd></div>
            </dl>
          </>
        ) : (
          <div className="calendar-placeholder">
            <span>▦</span>
            <strong>Select an event</strong>
            <p>Choose any booking in the calendar to see its schedule, staff and equipment.</p>
          </div>
        )}
      </aside>
    </div>
  );
}
