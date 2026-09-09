import { useState } from 'react';
import { useLanguage } from '../context/Language';
import { t } from '../domain/language';
import { formatCurrency, moneyToCents } from '../domain/rental-utils';
import { getApiError } from '../services/errors';
import api from '../services/axios';

export default function EventOperationsEditor({ rental, onClose, onSaved }) {
  useLanguage();
  const [notes, setNotes] = useState(rental.finalNotes || '');
  const [fees, setFees] = useState(Object.fromEntries(rental.employees.map(e => [e.id, ((e.costCents || 0) / 100).toFixed(2)])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async event => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await api.patch(`/api/rentals/${rental.id}/operations`, { finalNotes: notes, employeeFees: rental.employees.map(e => ({ employeeId:e.id, costCents:moneyToCents(fees[e.id]) })) });
      await onSaved(); onClose();
    } catch(e) { setError(getApiError(e)); } finally { setBusy(false); }
  };
  return <div className="modal-backdrop" onMouseDown={() => { if (!busy) onClose(); }}>
    <form className="modal-card" role="dialog" aria-modal="true" aria-label={t('Event operations')} onSubmit={save} onMouseDown={e => e.stopPropagation()}>
      <div className="panel-header"><h3>{rental.customer.name}</h3><button type="button" className="icon-button" disabled={busy} aria-label={t('Dismiss')} onClick={onClose}>×</button></div>
      {error && <div className="notice notice-error" role="alert">{error}</div>}
      <p>{t('Internal cost, separate from the client charge.')}</p>
      <div className="staff-fees">{rental.employees.map(e => <label key={e.id}>{e.name}<input autoFocus={e.id === rental.employees[0]?.id} aria-label={`${t('Staff fee')}: ${e.name}`} type="number" min="0" max="1000000" step="0.01" required inputMode="decimal" value={fees[e.id]} onChange={event => setFees(current => ({...current,[e.id]:event.target.value}))} /></label>)}</div>
      <strong>{t('Staff cost')}: {formatCurrency(Object.values(fees).reduce((sum,value) => sum + moneyToCents(value),0))}</strong>
      <label>{t('Final event notes')}<textarea rows={5} maxLength={4000} value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('Record returns, incidents and final observations.')} /></label>
      <button className="button button-primary" disabled={busy}>{t(busy ? 'Saving…' : 'Save changes')}</button>
    </form>
  </div>;
}
