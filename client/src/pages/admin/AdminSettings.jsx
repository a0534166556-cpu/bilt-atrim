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
    const { name, value, type, checked } = e.target;
    setForm((f) => ({
      ...f,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const updated = await adminUpdateStore({
        ...form,
        freeShippingMin: Number(form.freeShippingMin) || 0,
        promoActive: !!form.promoActive,
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
        <h2 className="form-section-title">פרטי חנות</h2>
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

        <h2 className="form-section-title">באנר מבצעים (באתר)</h2>
        <div className="form-grid">
          <label className="checkbox-label full-width">
            <input
              type="checkbox"
              name="promoActive"
              checked={!!form.promoActive}
              onChange={handleChange}
            />
            הצג באנר מבצעים בראש האתר
          </label>
          <label>כותרת הבאנר
            <input name="promoTitle" value={form.promoTitle || ''} onChange={handleChange} placeholder="מבצע השבוע!" />
          </label>
          <label>טקסט משני
            <input name="promoText" value={form.promoText || ''} onChange={handleChange} placeholder="עד 50% הנחה על מוצרים נבחרים" />
          </label>
          <label className="full-width">קישור (נתיב או URL)
            <input name="promoLink" value={form.promoLink || '/sales'} onChange={handleChange} placeholder="/sales" />
          </label>
        </div>

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'שומר...' : 'שמור הגדרות'}
        </button>
      </form>
    </AdminLayout>
  );
}
