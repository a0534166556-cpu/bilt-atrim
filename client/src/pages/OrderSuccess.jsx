import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { verifyPayment } from '../api';

export default function OrderSuccess() {
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [paidOnline, setPaidOnline] = useState(!sessionId);
  const [verifying, setVerifying] = useState(!!sessionId);

  useEffect(() => {
    if (!sessionId) return;
    verifyPayment(sessionId)
      .then(() => setPaidOnline(true))
      .catch(() => setPaidOnline(false))
      .finally(() => setVerifying(false));
  }, [sessionId]);

  return (
    <div className="container page order-success">
      <Helmet><title>ההזמנה התקבלה | מרקט גוגל</title></Helmet>
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
      {!sessionId && (
        <p>שמרו את המספר – תוכלו לעקוב אחרי ההזמנה בדף מעקב הזמנה.</p>
      )}
      <div className="success-actions">
        <Link to="/track-order" className="btn btn-outline">מעקב הזמנה</Link>
        <Link to="/" className="btn btn-primary">חזרה לחנות</Link>
      </div>
    </div>
  );
}
