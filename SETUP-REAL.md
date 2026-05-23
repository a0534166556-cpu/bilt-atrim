# הפיכת האתר לחנות אמיתית – צ'קליסט

האתר ב-Netlify: `https://bilt-atrim.netlify.app` (או כתובת ה-deploy שלך)

---

## שלב 1 – דחיפת קוד ל-GitHub

ודא שב-GitHub יש את הקבצים: `server/db.js`, `netlify.toml`, `scripts/netlify-redirects.js`

---

## שלב 2 – Railway (שרת + MySQL)

### א. MySQL
1. Railway → **+ New** → **Database** → **MySQL**
2. MySQL → **Connect** → **Add to Service** → **bilt-atrim**

### ב. משתני סביבה (שירות האתר)
| משתנה | ערך |
|--------|-----|
| `ADMIN_PASSWORD` | סיסמה חזקה |
| `SITE_URL` | `https://bilt-atrim.netlify.app` |
| `NODE_ENV` | `production` |

(אופציונלי לתשלום בכרטיס: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`)

### ג. Deploy
**Redeploy** → חכה ל-**Success**

### ד. בדיקה
פתח בדפדפן:
```
https://bilt-atrim-production.up.railway.app/api/health
```
חייב להחזיר: `{"ok":true,"database":"mysql",...}`

אם "Not Found" – השרת לא עלה. בדוק **Logs** (לרוב חסר MySQL).

---

## שלב 3 – Netlify (חיבור לשרת)

1. **Site configuration** → **Environment variables**
2. הוסף:

| Key | Value |
|-----|--------|
| `RAILWAY_BACKEND_URL` | `https://bilt-atrim-production.up.railway.app` |

(בלי `/` בסוף – החלף בכתובת Railway האמיתית שלך)

3. **Deploys** → **Trigger deploy** → **Deploy site**

---

## שלב 4 – בדיקה סופית

1. `https://bilt-atrim.netlify.app/products` – אמורים להופיע מוצרים
2. הוסף לסל → תשלום
3. מנהל: `https://bilt-atrim.netlify.app/admin/login` (סיסמה מ-`ADMIN_PASSWORD`)

---

## סיכום

```
Netlify (אתר)  --RAILWAY_BACKEND_URL-->  Railway (API + MySQL)
```
