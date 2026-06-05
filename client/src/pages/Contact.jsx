import { useState } from 'react';
import PageHelmet from '../components/PageHelmet';
import { useStore } from '../context/StoreContext';
import { submitContact } from '../api';
import { useToast } from '../context/ToastContext';

export default function Contact() {
  const { store } = useStore();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [sent, setSent] = useState(false);

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await submitContact(form);
      setSent(true);
      setForm({ name: '', email: '', message: '' });
      showToast('ההודעה נשלחה!');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container page contact-page">
      <PageHelmet title="צור קשר" />
      <h1>צור קשר</h1>
      <div className="contact-grid">
        <div className="contact-card">
          <h3>📧 אימייל</h3>
          <a href={`mailto:${store?.email}`}>{store?.email}</a>
        </div>
        <div className="contact-card">
          <h3>📞 טלפון</h3>
          <a href={`tel:${store?.phone}`}>{store?.phone}</a>
        </div>
        {store?.whatsapp && (
          <div className="contact-card">
            <h3>💬 WhatsApp</h3>
            <a
              href={`https://wa.me/${store.whatsapp}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary"
            >
              שלח הודעה
            </a>
          </div>
        )}
        <div className="contact-card">
          <h3>📍 כתובת</h3>
          <p>{store?.address}</p>
        </div>
      </div>

      <div className="contact-form-section">
        <h2>שלחו לנו הודעה</h2>
        {sent ? (
          <p className="contact-sent">תודה! קיבלנו את ההודעה ונחזור אליכם בהקדם.</p>
        ) : (
          <form className="contact-form" onSubmit={handleSubmit}>
            <label>
              שם
              <input name="name" required value={form.name} onChange={handleChange} />
            </label>
            <label>
              אימייל
              <input name="email" type="email" required value={form.email} onChange={handleChange} />
            </label>
            <label>
              הודעה
              <textarea name="message" rows={5} required value={form.message} onChange={handleChange} />
            </label>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'שולח...' : 'שליחה'}
            </button>
          </form>
        )}
      </div>

      <div className="contact-info-box">
        <h2>שעות פעילות</h2>
        <p>ראשון–חמישי: 9:00–18:00 | שישי: 9:00–13:00</p>
        <p>{store?.shippingInfo}</p>
      </div>
    </div>
  );
}
