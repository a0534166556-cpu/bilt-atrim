import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import PageHelmet from '../components/PageHelmet';
import { verifyPayment } from '../api';

export default function OrderSuccess() {
  const { orderId } = useParams();
  const { clearCart } = useCart();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const isCod = !sessionId;
  const [paidOnline, setPaidOnline] = useState(isCod);
  const [verifying, setVerifying] = useState(!!sessionId);

  useEffect(() => {
    if (!sessionId) return;
    verifyPayment(sessionId)
      .then(() => {
        setPaidOnline(true);
        clearCart();
      })
      .catch(() => setPaidOnline(false))
      .finally(() => setVerifying(false));
  }, [sessionId, clearCart]);

  return (
    <div className="container page order-success">
      <PageHelmet title="ההזמנה התקבלה" />
      <div className="success-icon">✓</div>
      <h1>{verifying ? 'מאשרים תשלום...' : 'תודה על ההזמנה!'}</h1>
      <p>מספר הזמנה: <strong>{orderId}</strong></p>
      {verifying && <p>ממתינים לאישור התשלום מהבנק...</p>}
      {!verifying && sessionId && paidOnline && (
        <p className="payment-confirmed">✓ התשלום בכרטיס אשראי אושר בהצלחה</p>
      )}
      {!verifying && sessionId && !paidOnline && (
        <p className="payment-pending">
          התשלום עדיין בעיבוד. אם חויבתם – ההזמנה תאושר תוך דקות. לשאלות: צרו קשר.
        </p>
      )}
      {isCod && (
        <p>שמרו את המספר – תוכלו לעקוב אחרי ההזמנה בדף מעקב הזמנה.</p>
      )}
      {!verifying && (
        <p className="order-email-hint">
          {isCod
            ? 'אם הגדרתם מייל בשרת – אישור ההזמנה יישלח לכתובת האימייל שהזנתם.'
            : paidOnline
              ? 'אישור ההזמנה נשלח לכתובת האימייל שהזנתם.'
              : 'לאחר אישור התשלום יישלח אליכם מייל עם פרטי ההזמנה.'}
        </p>
      )}
      <div className="success-actions">
        <Link to="/track-order" className="btn btn-outline">מעקב הזמנה</Link>
        <Link to="/" className="btn btn-primary">חזרה לחנות</Link>
      </div>
    </div>
  );
}
