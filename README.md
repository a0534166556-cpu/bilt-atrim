# מרקט גוגל – חנות React למכירת מוצרים

חנות מקוונת מלאה בעברית (RTL) ב-**React + Vite**, עם שרת **Express** לניהול מוצרים, הזמנות ו-Google Shopping.

## הפעלה

```bash
npm run install:all
npm run dev
```

- **חנות:** http://localhost:5173
- **פאנל ניהול:** http://localhost:5173/admin/login
- **סיסמת מנהל:** `admin123` (שנה עם `ADMIN_PASSWORD=הסיסמה-שלך`)

## לך כבעל החנות

| פעולה | איפה |
|--------|------|
| הוספת מוצר | ניהול → הוסף מוצר |
| עריכת מחיר/מלאי | ניהול → מוצרים → ערוך |
| צפייה בהזמנות | ניהול → הזמנות |
| שינוי שם/טלפון/משלוח | ניהול → הגדרות חנות |
| פיד Google Shopping | http://localhost:3001/feed/google-shopping.xml |

## ללקוחות

- חיפוש, סינון ומיון מוצרים
- סל קניות, מועדפים, ביקורות
- מעקב הזמנה (מספר + אימייל)
- מבצעים ומוצרים מומלצים
- WhatsApp וצור קשר

## חיבור ל-Google Merchant

1. [Google Merchant Center](https://merchants.google.com/)
2. הוסף פיד URL: `https://YOUR-DOMAIN.com/feed/google-shopping.xml`
3. בפרודקשן: `SITE_URL=https://your-domain.com npm run start --prefix server`

## עריכת מוצרים ידנית

קובץ: `server/data/products.json`
