import { useEffect, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { adminCoupons, adminCreateCoupon, adminDeleteCoupon } from '../../api';
import { useToast } from '../../context/ToastContext';

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState([]);
  const [form, setForm] = useState({ code: '', type: 'percent', value: '', minOrder: '', expiresAt: '' });
  const { showToast } = useToast();

  const load = () => adminCoupons().then(setCoupons).catch(console.error);
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await adminCreateCoupon({
        ...form,
        value: Number(form.value),
        minOrder: Number(form.minOrder) || 0,
        expiresAt: form.expiresAt || null,
      });
      showToast('קופון נוסף');
      setForm({ code: '', type: 'percent', value: '', minOrder: '', expiresAt: '' });
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDelete = async (code) => {
    if (!confirm(`למחוק קופון ${code}?`)) return;
    await adminDeleteCoupon(code);
    showToast('נמחק');
    load();
  };

  return (
    <AdminLayout title="קופונים והנחות">
      <form className="admin-form coupon-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label>קוד *
            <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          </label>
          <label>סוג
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="percent">אחוזים</option>
              <option value="fixed">סכום קבוע (₪)</option>
            </select>
          </label>
          <label>ערך *
            <input type="number" min="1" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} required />
          </label>
          <label>מינימום הזמנה
            <input type="number" min="0" value={form.minOrder} onChange={(e) => setForm({ ...form, minOrder: e.target.value })} />
          </label>
          <label>תפוגה
            <input type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
          </label>
        </div>
        <button type="submit" className="btn btn-primary">הוסף קופון</button>
      </form>

      <table className="admin-table" style={{ marginTop: '2rem' }}>
        <thead>
          <tr>
            <th>קוד</th>
            <th>סוג</th>
            <th>ערך</th>
            <th>מינימום</th>
            <th>תפוגה</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {coupons.map((c) => (
            <tr key={c.code}>
              <td><strong>{c.code}</strong></td>
              <td>{c.type === 'percent' ? 'אחוזים' : 'קבוע'}</td>
              <td>{c.type === 'percent' ? `${c.value}%` : `${c.value} ₪`}</td>
              <td>{c.minOrder || '—'}</td>
              <td>{c.expiresAt || 'ללא'}</td>
              <td>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c.code)}>מחק</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint" style={{ marginTop: '1rem' }}>קופונים לדוגמה: WELCOME10 (10%), SAVE50 (50 ₪)</p>
    </AdminLayout>
  );
}
