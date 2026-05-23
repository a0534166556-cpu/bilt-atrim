# פריסה ל-Railway

## הגדרות ב-Railway (מומלץ)

| שדה | ערך |
|-----|-----|
| **Root Directory** | *(ריק – שורש הפרויקט)* |
| **Build Command** | `npm run railway:build` |
| **Start Command** | `npm start` |

## משתני סביבה (Variables)

| משתנה | חובה | דוגמה |
|--------|------|--------|
| `NODE_ENV` | כן | `production` |
| `ADMIN_PASSWORD` | כן | סיסמה חזקה לפאנל ניהול |
| `SITE_URL` | כן | `https://YOUR-APP.up.railway.app` |
| `PORT` | אוטומטי | Railway מגדיר – אל תשנה |

אחרי הדיפלוי הראשון: העתק את כתובת האתר מ-Railway והדבק ב-`SITE_URL`, ואז Deploy מחדש.

## Netlify

לא מתאים לפרויקט הזה (יש שרת Express + API). השתמש ב-**Railway** בלבד.
