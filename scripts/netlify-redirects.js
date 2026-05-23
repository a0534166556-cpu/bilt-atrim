import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backend = (process.env.RAILWAY_BACKEND_URL || '').replace(/\/$/, '');
const publicDir = path.join(__dirname, '..', 'client', 'public');
fs.mkdirSync(publicDir, { recursive: true });

if (!backend) {
  const spaOnly = '/*  /index.html  200\n';
  fs.writeFileSync(path.join(publicDir, '_redirects'), spaOnly, 'utf-8');
  console.warn(
    '⚠ RAILWAY_BACKEND_URL לא הוגדר – האתר יעלה (סטטי), אבל מוצרים/סל/תשלום לא יעבדו.\n' +
      '   אחרי ש-Railway מוכן: הוסף את המשתנה ב-Netlify ו-Redeploy.'
  );
  process.exit(0);
}

const redirects = `# נוצר אוטומטית – מפנה API ל-Railway
/api/*  ${backend}/api/:splat  200!
/feed/*  ${backend}/feed/:splat  200!
/sitemap.xml  ${backend}/sitemap.xml  200!
/robots.txt  ${backend}/robots.txt  200!
/*  /index.html  200
`;

fs.writeFileSync(path.join(publicDir, '_redirects'), redirects, 'utf-8');
console.log('✓ _redirects נוצר – API →', backend);
