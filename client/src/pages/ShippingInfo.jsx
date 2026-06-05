import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useStore } from '../context/StoreContext';

export default function ShippingInfo() {
  const { store } = useStore();

  return (
    <div className="container page info-page">
      <Helmet><title>{`משלוחים | ${store?.name || 'החנות'}`}</title></Helmet>
      <h1>משלוחים</h1>
      <div className="info-card">
        <p>{store?.shippingInfo || 'משלוח חינם לכל הארץ'}</p>
        <ul>
          <li>🚚 משלוח חינם על כל ההזמנות – המחיר שאתם רואים הוא הסכום הסופי</li>
          <li>זמן אספקה משוער: 7–14 ימי עסקים</li>
          <li>מספר מעקב יישלח במייל לאחר שליחת ההזמנה</li>
        </ul>
        <Link to="/track-order" className="btn btn-outline">מעקב הזמנה</Link>
      </div>
    </div>
  );
}
