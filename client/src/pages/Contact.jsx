import { Helmet } from 'react-helmet-async';
import { useStore } from '../context/StoreContext';

export default function Contact() {
  const { store } = useStore();

  return (
    <div className="container page contact-page">
      <Helmet><title>צור קשר | מרקט גוגל</title></Helmet>
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
      <div className="contact-info-box">
        <h2>שעות פעילות</h2>
        <p>ראשון–חמישי: 9:00–18:00 | שישי: 9:00–13:00</p>
        <p>{store?.shippingInfo}</p>
      </div>
    </div>
  );
}
