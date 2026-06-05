import { Link } from 'react-router-dom';
import PageHelmet from '../components/PageHelmet';
import { useStore } from '../context/StoreContext';

export default function PrivacyPolicy() {
  const { store } = useStore();
  const name = store?.name || 'החנות';

  return (
    <div className="container page info-page">
      <PageHelmet title="מדיניות פרטיות" description={`מדיניות פרטיות של ${name}`} />
      <h1>מדיניות פרטיות</h1>
      <div className="info-card">
        <p>עודכן: {new Date().toLocaleDateString('he-IL')}</p>
        <h2>1. מי אנחנו</h2>
        <p>
          {name} מפעילה חנות מקוונת. לשאלות:{' '}
          {store?.email && <a href={`mailto:${store.email}`}>{store.email}</a>}
        </p>
        <h2>2. אילו נתונים נאספים</h2>
        <ul>
          <li>פרטי הזמנה: שם, כתובת, טלפון, אימייל</li>
          <li>פרטי תשלום – מעובדים ישירות על ידי Stripe (לא נשמרים אצלנו)</li>
          <li>עוגיות לשמירת סל, מועדפים והעדפות</li>
          <li>נרשמי ניוזלטר – כתובת אימייל בלבד</li>
        </ul>
        <h2>3. שימוש במידע</h2>
        <ul>
          <li>עיבוד ומשלוח הזמנות</li>
          <li>יצירת קשר ושירות לקוחות</li>
          <li>שליחת עדכוני הזמנה במייל</li>
        </ul>
        <h2>4. שיתוף עם צד שלישי</h2>
        <p>
          אנו משתפים פרטי משלוח עם ספקי משלוחים (כולל CJ Dropshipping) לצורך
          אספקת המוצר בלבד. לא מוכרים את המידע לגורמים אחרים.
        </p>
        <h2>5. זכויותיך</h2>
        <p>
          ניתן לבקש גישה, תיקון או מחיקת הנתונים שלך –{' '}
          <Link to="/contact">צור קשר</Link>.
        </p>
        <h2>6. אבטחה</h2>
        <p>אנו נוקטים באמצעי אבטחה סבירים להגנה על המידע. תשלומים מאובטחים דרך Stripe.</p>
      </div>
    </div>
  );
}
