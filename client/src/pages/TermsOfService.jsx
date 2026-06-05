import { Link } from 'react-router-dom';
import PageHelmet from '../components/PageHelmet';
import { useStore } from '../context/StoreContext';

export default function TermsOfService() {
  const { store } = useStore();
  const name = store?.name || 'החנות';

  return (
    <div className="container page info-page">
      <PageHelmet title="תנאי שימוש" description={`תנאי שימוש של ${name}`} />
      <h1>תנאי שימוש</h1>
      <div className="info-card">
        <p>עודכן: {new Date().toLocaleDateString('he-IL')}</p>
        <h2>1. כללי</h2>
        <p>
          שימוש באתר {name} מהווה הסכמה לתנאים אלה. אם אינך מסכים – אל תשתמש באתר.
        </p>
        <h2>2. הזמנות ותשלום</h2>
        <ul>
          <li>מחירים בשקלים וכוללים מע"מ ככל שנדרש בחוק</li>
          <li>משלוח נגבה בנפרד בקופה (אלא אם צוין אחרת)</li>
          <li>תשלום בכרטיס – דרך Stripe מאובטח</li>
          <li>תשלום במזומן/העברה – לפי הוראות שנשלחו במייל</li>
        </ul>
        <h2>3. משלוחים</h2>
        <p>
          זמני משלוח משוערים בלבד. לפרטים ראו{' '}
          <Link to="/shipping">מידע משלוחים</Link>.
        </p>
        <h2>4. החזרות</h2>
        <p>
          לפי <Link to="/returns">מדיניות החזרות</Link> שלנו.
        </p>
        <h2>5. אחריות</h2>
        <p>
          המוצרים נמכרים כפי שהם. אחריות יצרן לפי חוק. לפגמים –{' '}
          <Link to="/contact">צור קשר</Link> תוך 14 יום.
        </p>
        <h2>6. קניין רוחני</h2>
        <p>כל התוכן באתר (טקסט, עיצוב, לוגו) שייך ל{name} ואין להעתיק ללא אישור.</p>
      </div>
    </div>
  );
}
