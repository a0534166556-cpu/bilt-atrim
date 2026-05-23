import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

export default function OrderSuccess() {
  const { orderId } = useParams();

  return (
    <div className="container page order-success">
      <Helmet><title>ההזמנה התקבלה | מרקט גוגל</title></Helmet>
      <div className="success-icon">✓</div>
      <h1>תודה על ההזמנה!</h1>
      <p>מספר הזמנה: <strong>{orderId}</strong></p>
      <p>שמרו את המספר – תוכלו לעקוב אחרי ההזמנה בדף מעקב הזמנה.</p>
      <div className="success-actions">
        <Link to={`/track-order`} className="btn btn-outline">מעקב הזמנה</Link>
        <Link to="/" className="btn btn-primary">חזרה לחנות</Link>
      </div>
    </div>
  );
}
