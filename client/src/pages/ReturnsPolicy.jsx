import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useStore } from '../context/StoreContext';

export default function ReturnsPolicy() {
  const { store } = useStore();

  return (
    <div className="container page info-page">
      <Helmet><title>החזרות והחלפות | {store?.name || 'החנות'}</title></Helmet>
      <h1>החזרות והחלפות</h1>
      <div className="info-card">
        <ul>
          <li>ניתן להחזיר מוצר שלא נפתח תוך 14 יום מקבלת המשלוח</li>
          <li>החזר כספי לאחר אישור המוצר במחסן (עד 7 ימי עסקים)</li>
          <li>מוצר פגום? צרו קשר – נחליף או נזכה במלוא הסכום</li>
          <li>מוצרים בהתאמה אישית – ללא החזרה אלא אם יש פגם</li>
        </ul>
        <p>
          לשאלות: <Link to="/contact">צור קשר</Link>
          {store?.email && <> או {store.email}</>}
        </p>
      </div>
    </div>
  );
}
