import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const STORAGE_KEY = 'cookiesAccepted';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
  }, []);

  const accept = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="cookie-banner" role="dialog" aria-label="הודעת עוגיות">
      <p>
        האתר משתמש בעוגיות (cookies) לשיפור החוויה ולתפקוד הסל וההזמנות.
        {' '}
        <Link to="/privacy">מדיניות פרטיות</Link>
      </p>
      <button type="button" className="btn btn-primary btn-sm" onClick={accept}>
        הבנתי
      </button>
    </div>
  );
}
