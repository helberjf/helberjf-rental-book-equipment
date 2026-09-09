import { useCallback, useEffect, useState } from 'react';
import api from '../services/axios';
import { getApiError } from '../services/errors';
import { buildEventRange, formatEventDate, toLocalDateKey } from '../domain/rental-utils';
import { t } from '../domain/language';
import { useLanguage } from '../context/Language';
import { EmptyBlock } from '../components/RentalUI';

export default function Team() {
  useLanguage();
  const [employees, setEmployees] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [person, setPerson] = useState({ name: '', contact: '' });
  const [form, setForm] = useState({ employeeId: '', title: '', date: toLocalDateKey(new Date()), startTime: '18:00', endTime: '22:00', notes: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [rentals, setRentals] = useState([]);
  const load = useCallback(async () => {
    try {
      const [staff, reservations, events] = await Promise.all([api.get('/api/employees'), api.get('/api/staff-bookings'), api.get('/api/rentals')]);
      setEmployees(staff.data.result); setBookings(reservations.data.result); setRentals(events.data.result);
    } catch (e) { setError(getApiError(e)); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const update = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const save = async (event, kind) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      if (kind === 'person') {
        await api.post('/api/employees', person); setPerson({ name: '', contact: '' }); setMessage('Employee added.');
      } else {
        const range = buildEventRange(form.date, form.startTime, form.endTime);
        await api.post('/api/staff-bookings', { employeeId: Number(form.employeeId), title: form.title, notes: form.notes, ...range });
        setMessage('Reservation created.');
      }
      await load();
    } catch (e) { setError(getApiError(e)); } finally { setBusy(false); }
  };
  const cancel = async (id) => {
    if (!window.confirm(t('Cancel this staff reservation?'))) return;
    setBusy(true); setError('');
    try { await api.delete(`/api/staff-bookings/${id}`); setMessage('Reservation cancelled.'); await load(); }
    catch (e) { setError(getApiError(e)); } finally { setBusy(false); }
  };
  const schedule = [
    ...bookings.map(b => ({ ...b, name: b.employee.name, manual: true })),
    ...rentals.filter(r => !['DRAFT', 'CANCELLED'].includes(r.status)).flatMap(r => r.employees.map(e => ({ id: `${r.id}-${e.id}`, name: e.name, title: r.customer.name, startAt: r.startAt, endAt: r.endAt }))),
  ].sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
  return <div className="page-stack">
    {error && <div role="alert" className="notice notice-error">{t(error)}</div>}
    {message && <div role="status" className="notice notice-success">{t(message)}</div>}
    <div className="catalog-forms">
      <form className="panel rental-form" onSubmit={e => save(e, 'person')}>
        <h2>{t('New employee')}</h2>
        <label>{t('Name')}<input required minLength={2} maxLength={120} value={person.name} onChange={e => setPerson({ ...person, name: e.target.value })} /></label>
        <label>{t('Contact')}<input type="tel" maxLength={80} value={person.contact} onChange={e => setPerson({ ...person, contact: e.target.value })} /></label>
        <button className="button button-primary" disabled={busy}>{t('Add employee')}</button>
      </form>
      <form className="panel rental-form" onSubmit={e => save(e, 'booking')}>
        <h2>{t('Reserve employee')}</h2>
        <div className="form-grid two-columns">
          <label>{t('Employee')}<select required value={form.employeeId} onChange={e => update('employeeId', e.target.value)}><option value="">—</option>{employees.map(e => <option value={e.id} key={e.id}>{e.name}</option>)}</select></label>
          <label>{t('Reservation title')}<input required minLength={2} maxLength={120} value={form.title} onChange={e => update('title', e.target.value)} /></label>
        </div>
        <div className="form-grid three-columns">{[['date','Date','date'],['startTime','Start time','time'],['endTime','End time','time']].map(([key,label,type]) => <label key={key}>{t(label)}<input type={type} required value={form[key]} onChange={e => update(key,e.target.value)} /></label>)}</div>
        <p className="field-help">{t('Overnight events automatically end on the following day.')}</p>
        <label>{t('Notes')}<textarea maxLength={2000} value={form.notes} onChange={e => update('notes', e.target.value)} /></label>
        <button className="button button-primary" disabled={busy || !employees.length}>{t('Reserve time')}</button>
      </form>
    </div>
    <section className="panel"><div className="panel-header"><h2>{t('Team')}</h2><span className="record-count">{employees.length}</span></div>
      <div className="catalog-grid">{employees.map(e => <article className="catalog-card" key={e.id}><span className="person-avatar" aria-hidden="true">{e.name.slice(0,2).toUpperCase()}</span><h3>{e.name}</h3><p>{e.contact || '—'}</p></article>)}</div>
      {!employees.length && <EmptyBlock title="No employees yet" text="Add your first team member." />}
    </section>
    <section className="panel"><h2>{t('Staff reservations')}</h2>
      <div className="agenda-list">{schedule.map(b => <article className="agenda-card" key={`${b.manual ? 'manual' : 'event'}-${b.id}`}><div><strong>{b.name}</strong><p>{b.title}</p><small>{formatEventDate(b.startAt, { dateStyle:'medium', timeStyle:'short' })} → {formatEventDate(b.endAt, { dateStyle:'medium', timeStyle:'short' })}</small>{b.notes && <p>{b.notes}</p>}</div>{b.manual && <button className="button button-ghost" disabled={busy} onClick={() => cancel(b.id)}>{t('Cancel reservation')}</button>}</article>)}</div>
      {!schedule.length && <p>{t('No staff reservations')}</p>}
    </section>
  </div>;
}
