import { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { adminUpdateStore } from '../../api';
import { useStore } from '../../context/StoreContext';
import { useToast } from '../../context/ToastContext';

export default function AdminSettings() {
  const { store, setStore } = useStore();
  const { showToast } = useToast();
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (store) setForm(store);
  }, [store]);

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const updated = await adminUpdateStore({
        ...form,
        freeShippingMin: Number(form.freeShippingMin) || 0,
      });
      setStore(updated);
      showToast('ההגדרות נשמרו');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!store) return <AdminLayout title="הגדרות"><p>טוען...</p></AdminLayout>;

  return (
    <AdminLayout title="הגדרות החנות">
      <form className="admin-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label>שם החנות
            <input name="name" value={form.name || ''} onChange={handleChange} />
          </label>
          <label>סלוגן
            <input name="tagline" value={form.tagline || ''} onChange={handleChange} />
          </label>
          <label>אימייל
            <input name="email" type="email" value={form.email || ''} onChange={handleChange} />
          </label>
          <label>טלפון
            <input name="phone" value={form.phone || ''} onChange={handleChange} />
          </label>
          <label>WhatsApp (מספר בינלאומי)
            <input name="whatsapp" value={form.whatsapp || ''} onChange={handleChange} placeholder="972501234567" />
          </label>
          <label>משלוח חינם מעל (₪)
            <input name="freeShippingMin" type="number" value={form.freeShippingMin || ''} onChange={handleChange} />
          </label>
          <label className="full-width">מידע משלוח (מוצג בראש האתר)
            <input name="shippingInfo" value={form.shippingInfo || ''} onChange={handleChange} />
          </label>
          <label className="full-width">כתובת
            <input name="address" value={form.address || ''} onChange={handleChange} />
          </label>
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'שומר...' : 'שמור הגדרות'}
        </button>
      </form>
    </AdminLayout>
  );
}
