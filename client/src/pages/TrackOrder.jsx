import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  trackOrder,
  formatPrice,
  ORDER_STATUS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from '../api';

export default function TrackOrder() {
  const [orderId, setOrderId] = useState('');
  const [email, setEmail] = useState('');
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setOrder(null);
    try {
      const data = await trackOrder(orderId, email);
      setOrder(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container page track-page">
      <Helmet><title>מעקב הזמנה | מרקט גוגל</title></Helmet>
      <h1>מעקב הזמנה</h1>
      <p>הזן את מספר ההזמנה והאימייל שבו השתמשת</p>

      <form className="track-form" onSubmit={handleSubmit}>
        <label>
          מספר הזמנה
          <input value={orderId} onChange={(e) => setOrderId(e.target.value)} required />
        </label>
        <label>
          אימייל
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'מחפש...' : 'חפש הזמנה'}
        </button>
      </form>

      {order && (
        <div className="order-track-result">
          <h2>הזמנה #{order.id}</h2>
          <span className={`status-badge status-${ORDER_STATUS[order.status]?.color}`}>
            {ORDER_STATUS[order.status]?.label}
          </span>
          <p><strong>תאריך:</strong> {new Date(order.createdAt).toLocaleString('he-IL')}</p>
          <p><strong>סכום:</strong> {formatPrice(order.total)}</p>
          <p>
            <strong>תשלום:</strong>{' '}
            {PAYMENT_METHOD_LABELS[order.paymentMethod] || order.paymentMethod}
            {' – '}
            {PAYMENT_STATUS_LABELS[order.paymentStatus] || order.paymentStatus}
          </p>
          <p><strong>כתובת:</strong> {order.address}{order.city ? `, ${order.city}` : ''}</p>
          {order.trackingNumber && (
            <p className="tracking-number">
              <strong>מספר מעקב:</strong> {order.trackingNumber}
            </p>
          )}
          {order.discount > 0 && (
            <p><strong>הנחה:</strong> {formatPrice(order.discount)} {order.couponCode && `(${order.couponCode})`}</p>
          )}
          <h3>פריטים</h3>
          <ul>
            {order.items.map((i, idx) => (
              <li key={idx}>{i.name} × {i.quantity}</li>
            ))}
          </ul>
          {order.statusHistory?.length > 0 && (
            <>
              <h3>היסטוריית סטטוס</h3>
              <ul className="status-history">
                {order.statusHistory.map((h, idx) => (
                  <li key={idx}>
                    {ORDER_STATUS[h.status]?.label} – {new Date(h.at).toLocaleString('he-IL')}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
