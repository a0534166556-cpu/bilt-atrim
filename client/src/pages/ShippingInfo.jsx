import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { formatPrice } from '../api';

export default function ShippingInfo() {
  const { store } = useStore();
  const min = store?.freeShippingMin;

  return (
    <div className="container page info-page">
      <Helmet><title>{`משלוחים | ${store?.name || 'החנות'}`}</title></Helmet>
      <h1>משלוחים</h1>
      <div className="info-card">
        <p>{store?.shippingInfo || 'משלוח לכל הארץ'}</p>
        <ul>
          <li>עלות משלוח רגילה: 29 ₪ (אלא אם צוין אחרת בקופה)</li>
          {min > 0 && (
            <li>משלוח חינם בהזמנה מעל {formatPrice(min)}</li>
          )}
          <li>זמן אספקה משוער: 3–8 ימי עסקים</li>
          <li>מספר מעקב יישלח במייל לאחר שליחת ההזמנה</li>
        </ul>
        <Link to="/track-order" className="btn btn-outline">מעקב הזמנה</Link>
      </div>
    </div>
  );
}
