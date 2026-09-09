import { useCallback, useEffect, useState } from 'react';
import api from '../services/axios';
import { getApiError } from '../services/errors';
import { formatCurrency, moneyToCents } from '../domain/rental-utils';
import { t } from '../domain/language';
import { useLanguage } from '../context/Language';
import { EmptyBlock } from '../components/RentalUI';
const initial = { name:'', category:'', description:'', color:'', weightKg:'', heightCm:'', widthCm:'', lengthCm:'', rate:'', identifiers:'' };
const measurements = [['weightKg','Weight (kg)'],['heightCm','Height (cm)'],['widthCm','Width (cm)'],['lengthCm','Length (cm)']];
export default function Equipment() {
  useLanguage();
  const [form, setForm] = useState(initial);
  const [editing, setEditing] = useState(null);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { try { setProducts((await api.get('/api/products')).data.result); } catch(e) { setError(getApiError(e)); } }, []);
  useEffect(() => { void load(); }, [load]);
  const update = (key,value) => setForm(current => ({ ...current,[key]:value }));
  const save = async e => {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const { rate, identifiers, ...data } = form;
      for (const [key] of measurements) data[key] = data[key] === '' ? null : Number(data[key]);
      const payload = { ...data, defaultRateCents: moneyToCents(rate), identifiers: identifiers.split(/\n|,/).map(s => s.trim()).filter(Boolean) };
      if (editing) await api.patch(`/api/products/${editing}`, payload); else await api.post('/api/products', payload);
      setForm(initial); setEditing(null); setNotice('Equipment saved.'); await load();
    } catch(e) { setError(getApiError(e)); } finally { setBusy(false); }
  };
  return <div className="page-stack">
    {error && <div role="alert" className="notice notice-error">{t(error)}</div>}{notice && <div role="status" className="notice notice-success">{t(notice)}</div>}
    <form className="panel rental-form" onSubmit={save}><div className="panel-header"><h2>{t(editing ? 'Edit equipment' : 'New equipment')}</h2>{editing && <button type="button" className="button button-ghost" onClick={() => { setEditing(null); setForm(initial); }}>{t('Cancel')}</button>}</div>
      <div className="form-grid two-columns">{[['name','Name'],['category','Category'],['color','Color']].map(([key,label]) => <label key={key}>{t(label)}<input required={key !== 'color'} maxLength={key === 'name' ? 120 : 80} minLength={key === 'color' ? 0 : 2} value={form[key]} onChange={e => update(key,e.target.value)} /></label>)}<label>{t('Default rental price')}<input required type="number" min="0" max="1000000" step="0.01" inputMode="decimal" value={form.rate} onChange={e => update('rate',e.target.value)} /></label></div>
      <div className="form-grid measurement-grid">{measurements.map(([key,label]) => <label key={key}>{t(label)}<input type="number" min="0.01" max="100000" step="0.01" inputMode="decimal" value={form[key]} onChange={e => update(key,e.target.value)} /></label>)}</div>
      <div className="form-grid two-columns"><label>{t('Description')}<textarea maxLength={2000} value={form.description} onChange={e => update('description',e.target.value)} /></label><label>{t('Unit identifiers')}<textarea required disabled={Boolean(editing)} placeholder={t('One identifier per line, e.g. ROBOT-09')} value={form.identifiers} onChange={e => update('identifiers',e.target.value)} /></label></div>
      <button className="button button-primary" disabled={busy}>{t(editing ? 'Save changes' : 'Add equipment')}</button>
    </form>
    <section className="panel"><div className="panel-header"><h2>{t('Equipment')}</h2><span className="record-count">{products.reduce((sum,p) => sum+p.units.length,0)} {t('units')}</span></div>
      <div className="catalog-grid">{products.map(p => <article className="catalog-card" key={p.id}><span className="eyebrow">{p.category}</span><h3>{p.name}</h3><strong className="catalog-price">{formatCurrency(p.defaultRateCents)}</strong><small>{t('Standard rental rate per unit')}</small><p>{p.description}</p><dl className="spec-list">{measurements.map(([key,label]) => <div key={key}><dt>{t(label)}</dt><dd>{p[key] ?? '—'}</dd></div>)}<div><dt>{t('Color')}</dt><dd>{p.color || '—'}</dd></div></dl><div className="unit-tags">{p.units.map(u => <span key={u.id}>{u.identifier}</span>)}</div></article>)}</div>
      <div className="edit-equipment-list">{products.map(p => <button key={p.id} className="button button-secondary" onClick={() => {
        setEditing(p.id); setForm({ name:p.name, category:p.category, description:p.description || '', color:p.color || '', rate:(p.defaultRateCents/100).toFixed(2), identifiers:p.units.map(u => u.identifier).join('\n'), ...Object.fromEntries(measurements.map(([key]) => [key,p[key] ?? ''])) });
        window.scrollTo({top:0,behavior:'smooth'});
      }}>{t('Edit equipment')}: {p.name}</button>)}</div>
      {!products.length && <EmptyBlock title="No equipment yet" text="Register equipment to start booking." />}
    </section>
  </div>;
}
