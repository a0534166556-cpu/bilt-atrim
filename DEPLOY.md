# פריסה ל-Railway עם MySQL

## שלב 1 – הוסף MySQL

1. בפרויקט Railway לחץ **+ New**
2. בחר **Database** → **MySQL**
3. אחרי שנוצר – לחץ על שירות **MySQL** → **Connect** → **Add to Service** (או Variables Reference) לשירות **bilt-atrim**

Railway יוסיף אוטומטית:
- `MYSQLHOST`
- `MYSQLPORT`
- `MYSQLUSER`
- `MYSQLPASSWORD`
- `MYSQLDATABASE`

## שלב 2 – משתני סביבה לשירות האתר (bilt-atrim)

| משתנה | ערך |
|--------|-----|
| `ADMIN_PASSWORD` | סיסמה חזקה |
| `SITE_URL` | `https://הכתובת-שלך.up.railway.app` |
| `NODE_ENV` | `production` |
| `STRIPE_SECRET_KEY` | מפתח סודי מ-[Stripe Dashboard](https://dashboard.stripe.com/apikeys) |
| `STRIPE_WEBHOOK_SECRET` | מ-Webhook (ראה למטה) |
| `CJ_ACCESS_TOKEN` | מפתח API מ-CJ (פורמט `CJxxx@api@...`) – השרת ממיר אוטומטית ל-access token |
| `SENDGRID_API_KEY` | מפתח מ-[SendGrid](https://app.sendgrid.com/settings/api_keys) (מיילים) |
| `RESEND_API_KEY` | חלופה ל-Resend אם אין SendGrid |
| `EMAIL_FROM` | כתובת שולח **מאומתת** ב-SendGrid (חובה!) |
| `EMAIL_FROM_NAME` | שם השולח, למשל `NovaShop` |

**אל תגדיר ידנית** את MYSQL* – Railway מחבר אותם מה-Database.

## מיילים ללקוחות (SendGrid)

1. [SendGrid](https://app.sendgrid.com) → **Settings → API Keys** → Create
2. ב-Railway הוסף `SENDGRID_API_KEY` (לא בקוד!)
3. **Settings → Sender Authentication** → אמת אימייל או דומיין
4. `EMAIL_FROM` = אותה כתובת מאומתת (למשל `support@yourdomain.com`)
5. Redeploy – בדוק: `/api/health` → `"email": true`

## תרגום מוצרים לעברית

- **ייבוא מ-CJ**: סמן "תרגם שם ותיאור לעברית" (ברירת מחדל: פעיל)
- **דף מוצר**: כפתור "תרגם לעברית" לתיאורים באנגלית
- **ניהול → עריכת מוצר**: "תרגם ושמור"

אופציונלי ב-Railway: `MYMEMORY_EMAIL` = האימייל שלך (מגדיל מכסת תרגום חינמית ב-MyMemory)

## מחירי CJ (דולר → שקל)

| משתנה | ברירת מחדל | משמעות |
|--------|------------|--------|
| `USD_TO_ILS` | `3.75` | שער דולר לשקל |
| `CJ_SHIPPING_USD` | `4` | משלוח ממוצע ליחידה (דולר) |

**נוסחה:** `(מחיר CJ ב-$ + משלוח) × שער × 1.30` (30% רווח)

מוצרי דמה נמחקים אוטומטית בהפעלת השרת. לעדכון מחירים קיימים: **סנכרן שוב** מ-CJ.

## תשלום בכרטיס אשראי (Stripe)

1. צור חשבון ב-[stripe.com](https://stripe.com) (תומך בשקלים ₪)
2. ב-**Developers → API keys** העתק את **Secret key** ל-`STRIPE_SECRET_KEY`
3. ב-**Developers → Webhooks** → **Add endpoint**:
   - URL: `https://הכתובת-שלך.up.railway.app/api/payments/webhook`
   - אירוע: `checkout.session.completed`
   - העתק את **Signing secret** ל-`STRIPE_WEBHOOK_SECRET`
4. Redeploy

במצב בדיקה (Test mode) אפשר לשלם עם כרטיס בדיקה: `4242 4242 4242 4242`

בלי Stripe – הלקוחות יכולים לשלם רק במזומן/העברה.

## שלב 3 – Deploy

Redeploy את שירות האתר. בהפעלה ראשונה:
- נוצרות טבלאות MySQL אוטומטית
- נטענים מוצרים לדוגמה (פעם אחת)

## מה נשמר ב-MySQL

- מוצרים, הזמנות, לקוחות, קופונים, ביקורות, הגדרות חנות
- **נשמר לצמידות** – גם אחרי Redeploy

## בדיקה

`https://הכתובת-שלך/api/health` → אמור להחזיר `{"ok":true,"database":"mysql","stripe":true}`

---

## Netlify (אתר) + Railway (שרת) – שילוב

הפרונט ב-Netlify, השרת + MySQL + תשלומים ב-Railway.

### שלב 1 – Railway (השרת)

1. פרוס את הפרויקט ב-Railway (Docker / מהריפו)
2. הוסף MySQL וחבר משתנים (כמו למעלה)
3. העתק את כתובת האתר, למשל: `https://bilt-atrim-production.up.railway.app`
4. בדוק: `https://.../api/health` עובד

### שלב 2 – Netlify (האתר ללקוחות)

1. **Add new site** → Import from GitHub → בחר `bilt-atrim`
2. Netlify יקרא אוטומטית מ-`netlify.toml` – **אל תשנה** Build command / Publish (אלא אם אין toml)
3. **Environment variables** → Add:

| משתנה | ערך |
|--------|-----|
| `RAILWAY_BACKEND_URL` | `https://הכתובת-שלך.up.railway.app` (בלי `/` בסוף) |

4. **Deploy site**

כל קריאה ל-`/api` מהדפדפן עוברת דרך Netlify ל-Railway (חנות מלאה, לא סטטי).

### שלב 3 – עדכן SITE_URL ב-Railway

אחרי ש-Netlify נותן כתובת (למשל `https://bilt-atrim.netlify.app`):

ב-**Railway** עדכן:
- `SITE_URL` = כתובת Netlify (ל-Stripe, sitemap, Google)

### סיכום

| מקום | מה רץ שם |
|------|-----------|
| **Netlify** | React (דפים, עיצוב) |
| **Railway** | API, MySQL, Stripe, פאנל מנהל |

**אל תגדיר** ב-Netlify: `MYSQL`, `STRIPE`, `ADMIN_PASSWORD` – רק ב-Railway.
