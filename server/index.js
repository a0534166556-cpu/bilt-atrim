import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import {
  initDb,
  getStore,
  updateStore,
  getCategories,
  getAllProducts,
  getProductById,
  getReviews,
  getReviewsByProduct,
  addReview,
  createProduct,
  updateProduct,
  deleteProduct,
  duplicateProduct,
  validateCoupon,
  getCoupons,
  createCoupon,
  deleteCoupon,
  subscribeNewsletter,
  newsletterExists,
  createOrder,
  getOrderByIdAndEmail,
  getAllOrders,
  updateOrder,
  getAdminStats,
  saveAdminSession,
  deleteAdminSession,
  getAdminSession,
  cleanExpiredSessions,
  getEffectivePrice,
  importCjProductsToStore,
  deleteDemoProducts,
} from './db.js';
import { isEmailConfigured, notifyOrderConfirmation, notifyOrderShipped } from './email.js';
import { translateToHebrew, translateProductFields, needsTranslation } from './translate.js';
import { buildOrderFromBody } from './orderBuild.js';
import {
  isCjConfigured,
  searchCjProducts,
  importCjProducts,
  getMyCjProducts,
  syncMyCjProductsToStore,
  recalculateAllCjPrices,
} from './cj.js';
import {
  getPaymentConfig,
  createStripeCheckoutSession,
  verifyStripeSession,
  handleStripeWebhook,
  isStripeEnabled,
} from './payments.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const SITE_URL = process.env.SITE_URL || 'http://localhost:5173';
const API_URL = process.env.API_URL || `http://localhost:${PORT}`;
const CURRENCY = 'ILS';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const STOCK_RESTORE_STATUSES = ['pending', 'confirmed'];

const app = express();
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

app.use(cors());

app.post(
  '/api/payments/webhook',
  express.raw({ type: 'application/json' }),
  asyncHandler(async (req, res) => {
    const signature = req.headers['stripe-signature'];
    if (!signature) return res.status(400).send('חסר חתימת Stripe');
    try {
      await handleStripeWebhook(req.body, signature);
      res.json({ received: true });
    } catch (err) {
      console.error('Stripe webhook:', err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
    }
  })
);

app.use(express.json({ limit: '2mb' }));

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function enrichProduct(p, reviews) {
  const productReviews = reviews.filter((r) => r.productId === p.id);
  const avg =
    productReviews.length > 0
      ? productReviews.reduce((s, r) => s + r.rating, 0) / productReviews.length
      : 0;
  const onSale = !!(p.salePrice && p.salePrice < p.price);
  const discountPercent = onSale
    ? Math.round((1 - p.salePrice / p.price) * 100)
    : 0;
  return {
    ...p,
    effectivePrice: getEffectivePrice(p),
    onSale,
    discountPercent,
    reviewCount: productReviews.length,
    averageRating: Math.round(avg * 10) / 10,
  };
}

function filterPublicProducts(products, query = {}) {
  const { category, q, sort, minPrice, maxPrice, featured, onSale } = query;
  let list = products.filter((p) => p.active !== false);
  if (category) list = list.filter((p) => p.category === category);
  if (featured === 'true') list = list.filter((p) => p.featured);
  if (onSale === 'true') {
    list = list.filter((p) => p.salePrice && p.salePrice < p.price);
  }
  if (q) {
    const term = q.toLowerCase();
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.description.toLowerCase().includes(term) ||
        p.brand.toLowerCase().includes(term) ||
        p.sku.toLowerCase().includes(term)
    );
  }
  if (minPrice) list = list.filter((p) => getEffectivePrice(p) >= Number(minPrice));
  if (maxPrice) list = list.filter((p) => getEffectivePrice(p) <= Number(maxPrice));
  switch (sort) {
    case 'price-asc':
      list.sort((a, b) => getEffectivePrice(a) - getEffectivePrice(b));
      break;
    case 'price-desc':
      list.sort((a, b) => getEffectivePrice(b) - getEffectivePrice(a));
      break;
    case 'name':
      list.sort((a, b) => a.name.localeCompare(b.name, 'he'));
      break;
    case 'newest':
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      break;
    case 'discount':
      list.sort((a, b) => {
        const da = a.salePrice && a.salePrice < a.price ? 1 - a.salePrice / a.price : 0;
        const db = b.salePrice && b.salePrice < b.price ? 1 - b.salePrice / b.price : 0;
        return db - da;
      });
      break;
    default:
      list.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
  }
  return list;
}

async function requireAdmin(req, res, next) {
  await cleanExpiredSessions();
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'נדרשת התחברות מנהל' });
  const session = await getAdminSession(token);
  if (!session || Date.now() > session.expires) {
    if (token) await deleteAdminSession(token);
    return res.status(401).json({ error: 'פג תוקף ההתחברות' });
  }
  next();
}

app.get('/api/store', asyncHandler(async (req, res) => {
  res.json(await getStore());
}));

app.get('/api/products', asyncHandler(async (req, res) => {
  const products = await getAllProducts();
  const reviews = await getReviews();
  let list = filterPublicProducts(products, req.query);
  list = list.map((p) => enrichProduct(p, reviews));
  res.json(list);
}));

app.get('/api/categories', asyncHandler(async (req, res) => {
  res.json(await getCategories());
}));

app.get(
  '/api/products/:id/related',
  asyncHandler(async (req, res) => {
    const product = await getProductById(req.params.id);
    if (!product) return res.json([]);
    const products = await getAllProducts();
    const reviews = await getReviews();
    const related = products
      .filter((p) => p.id !== product.id && p.category === product.category && p.active !== false)
      .slice(0, 4)
      .map((p) => enrichProduct(p, reviews));
    res.json(related);
  })
);

app.get(
  '/api/products/:id/reviews',
  asyncHandler(async (req, res) => {
    res.json(await getReviewsByProduct(req.params.id));
  })
);

app.get(
  '/api/products/:id',
  asyncHandler(async (req, res) => {
    const product = await getProductById(req.params.id);
    if (!product || !product.active) return res.status(404).json({ error: 'מוצר לא נמצא' });
    const reviews = await getReviews();
    res.json(enrichProduct(product, reviews));
  })
);

app.post(
  '/api/products/:id/reviews',
  asyncHandler(async (req, res) => {
    const { name, rating, comment } = req.body;
    if (!name || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'נתוני ביקורת לא תקינים' });
    }
    const product = await getProductById(req.params.id);
    if (!product) return res.status(404).json({ error: 'מוצר לא נמצא' });
    const review = await addReview(product.id, { name, rating, comment });
    res.status(201).json(review);
  })
);

app.post(
  '/api/coupons/validate',
  asyncHandler(async (req, res) => {
    const { code, subtotal } = req.body;
    if (!code) return res.status(400).json({ error: 'הזן קוד קופון' });
    const result = await validateCoupon(code, Number(subtotal) || 0);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json({ code: result.coupon.code, discount: result.discount });
  })
);

app.post(
  '/api/newsletter',
  asyncHandler(async (req, res) => {
    const email = (req.body.email || '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'אימייל לא תקין' });
    }
    if (await newsletterExists(email)) {
      return res.status(400).json({ error: 'כבר רשום לניוזלטר' });
    }
    await subscribeNewsletter(email);
    res.status(201).json({ message: 'נרשמת בהצלחה לניוזלטר!' });
  })
);

app.post(
  '/api/translate',
  asyncHandler(async (req, res) => {
    const { text, name, description } = req.body || {};
    if (text?.trim()) {
      const translated = await translateToHebrew(text);
      return res.json({ translated, needsTranslation: needsTranslation(text) });
    }
    if (name || description) {
      const translated = await translateProductFields({
        name: name || '',
        description: description || '',
      });
      return res.json(translated);
    }
    res.status(400).json({ error: 'חסר טקסט לתרגום' });
  })
);

app.get('/api/payments/config', (req, res) => {
  res.json(getPaymentConfig());
});

app.post(
  '/api/payments/checkout',
  asyncHandler(async (req, res) => {
    if (!isStripeEnabled()) {
      return res.status(503).json({ error: 'תשלום בכרטיס אשראי לא זמין כרגע' });
    }
    const built = await buildOrderFromBody(req.body);
    if (built.error) return res.status(400).json({ error: built.error });

    const { orderData, orderItems, total } = built;
    try {
      const orderId = await createOrder(orderData, orderItems, {
        paymentMethod: 'stripe',
        reserveStock: false,
      });
      const checkoutUrl = await createStripeCheckoutSession(orderId, orderData, orderItems);
      res.status(201).json({ orderId, checkoutUrl, total });
    } catch (err) {
      res.status(400).json({ error: err.message || 'שגיאה ביצירת תשלום' });
    }
  })
);

app.get(
  '/api/payments/verify',
  asyncHandler(async (req, res) => {
    const { session_id: sessionId } = req.query;
    if (!sessionId) return res.status(400).json({ error: 'חסר מזהה תשלום' });
    const result = await verifyStripeSession(sessionId);
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json({ orderId: result.orderId, paid: true });
  })
);

app.post(
  '/api/orders',
  asyncHandler(async (req, res) => {
    const paymentMethod = req.body.paymentMethod === 'stripe' ? 'stripe' : 'cod';
    if (paymentMethod === 'stripe') {
      return res.status(400).json({ error: 'לתשלום בכרטיס השתמשו בכפתור תשלום מאובטח' });
    }

    const built = await buildOrderFromBody(req.body);
    if (built.error) return res.status(400).json({ error: built.error });

    try {
      const orderId = await createOrder(built.orderData, built.orderItems, {
        paymentMethod: 'cod',
        reserveStock: true,
      });
      res.status(201).json({
        orderId,
        message: 'ההזמנה התקבלה בהצלחה!',
        total: built.total,
        paymentMethod: 'cod',
      });
    } catch (err) {
      res.status(400).json({ error: err.message || 'שגיאה בשמירת ההזמנה' });
    }
  })
);

app.get(
  '/api/orders/track',
  asyncHandler(async (req, res) => {
    const { orderId, email } = req.query;
    if (!orderId || !email) {
      return res.status(400).json({ error: 'נדרש מספר הזמנה ואימייל' });
    }
    const order = await getOrderByIdAndEmail(orderId, email);
    if (!order) return res.status(404).json({ error: 'הזמנה לא נמצאה' });
    res.json(order);
  })
);

app.post(
  '/api/admin/login',
  asyncHandler(async (req, res) => {
    if (req.body.password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'סיסמה שגויה' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + 24 * 60 * 60 * 1000;
    await saveAdminSession(token, expires);
    res.json({ token });
  })
);

app.post(
  '/api/admin/logout',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) await deleteAdminSession(token);
    res.json({ ok: true });
  })
);

app.get(
  '/api/admin/stats',
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.json(await getAdminStats());
  })
);

app.get(
  '/api/admin/products',
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.json(await getAllProducts());
  })
);

app.post(
  '/api/admin/products',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = req.body;
    if (!body.name || !body.price || !body.category) {
      return res.status(400).json({ error: 'שם, מחיר וקטגוריה הם שדות חובה' });
    }
    const product = await createProduct(body);
    res.status(201).json(product);
  })
);

app.put(
  '/api/admin/products/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const product = await updateProduct(Number(req.params.id), req.body);
    if (!product) return res.status(404).json({ error: 'מוצר לא נמצא' });
    res.json(product);
  })
);

app.delete(
  '/api/admin/products/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    await deleteProduct(Number(req.params.id));
    res.json({ ok: true });
  })
);

app.get(
  '/api/admin/orders',
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.json(await getAllOrders());
  })
);

app.patch(
  '/api/admin/orders/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const orders = await getAllOrders();
    const existing = orders.find((o) => o.id === Number(req.params.id));
    if (!existing) return res.status(404).json({ error: 'הזמנה לא נמצאה' });
    const order = await updateOrder(
      Number(req.params.id),
      req.body,
      STOCK_RESTORE_STATUSES
    );
    if (req.body.trackingNumber && order?.trackingNumber && !existing.trackingNumber) {
      notifyOrderShipped(order.id).catch(() => {});
    }
    res.json(order);
  })
);

app.get(
  '/api/admin/export/orders',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const orders = await getAllOrders();
    const header = 'מספר,תאריך,שם,אימייל,טלפון,סכום,סטטוס,מעקב\n';
    const rows = orders
      .map((o) =>
        [o.id, o.createdAt, o.name, o.email, o.phone, o.total, o.status, o.trackingNumber || '']
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(',')
      )
      .join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=orders.csv');
    res.send('\uFEFF' + header + rows);
  })
);

app.get(
  '/api/admin/coupons',
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.json(await getCoupons());
  })
);

app.post(
  '/api/admin/coupons',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { code, type, value, minOrder, expiresAt } = req.body;
    if (!code || !type || value == null) {
      return res.status(400).json({ error: 'קוד, סוג וערך הם חובה' });
    }
    const coupon = await createCoupon({
      code: code.toUpperCase(),
      type: type === 'fixed' ? 'fixed' : 'percent',
      value: Number(value),
      minOrder: Number(minOrder) || 0,
      expiresAt: expiresAt || null,
    });
    res.status(201).json(coupon);
  })
);

app.delete(
  '/api/admin/coupons/:code',
  requireAdmin,
  asyncHandler(async (req, res) => {
    await deleteCoupon(req.params.code);
    res.json({ ok: true });
  })
);

app.post(
  '/api/admin/products/:id/duplicate',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const copy = await duplicateProduct(Number(req.params.id));
    if (!copy) return res.status(404).json({ error: 'מוצר לא נמצא' });
    res.status(201).json(copy);
  })
);

app.post(
  '/api/admin/products/delete-demo',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const removed = await deleteDemoProducts();
    res.json({ removed, message: removed ? `נמחקו ${removed} מוצרי דמה` : 'אין מוצרי דמה' });
  })
);

app.post(
  '/api/admin/products/:id/translate',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const product = await getProductById(Number(req.params.id));
    if (!product) return res.status(404).json({ error: 'מוצר לא נמצא' });
    const translated = await translateProductFields({
      name: product.name,
      description: product.description,
    });
    const updated = await updateProduct(product.id, translated);
    res.json(updated);
  })
);

app.put(
  '/api/admin/store',
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.json(await updateStore(req.body));
  })
);

app.get(
  '/api/admin/cj/status',
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.json({ configured: isCjConfigured() });
  })
);

app.get(
  '/api/admin/cj/search',
  requireAdmin,
  asyncHandler(async (req, res) => {
    if (!isCjConfigured()) {
      return res.status(503).json({ error: 'הוסף CJ_ACCESS_TOKEN ב-Railway' });
    }
    const { q = '', page = '1', size = '20' } = req.query;
    const result = await searchCjProducts(String(q), Number(page) || 1, Number(size) || 20);
    res.json(result);
  })
);

app.post(
  '/api/admin/cj/import',
  requireAdmin,
  asyncHandler(async (req, res) => {
    if (!isCjConfigured()) {
      return res.status(503).json({ error: 'הוסף CJ_ACCESS_TOKEN ב-Railway' });
    }
    const {
      pids,
      markupPercent = 30,
      categoryId = 'electronics',
      translateToHebrew = true,
    } = req.body;
    if (!Array.isArray(pids) || !pids.length) {
      return res.status(400).json({ error: 'בחר מוצרים לייבוא' });
    }
    const { imported, skipped } = await importCjProducts(pids, {
      markupPercent: Number(markupPercent) || 30,
      categoryId,
      translateToHebrew: translateToHebrew !== false,
    });
    const results = await importCjProductsToStore(imported, categoryId);
    res.status(201).json({
      imported: results.filter((r) => r.status === 'imported').length,
      updated: results.filter((r) => r.status === 'updated').length,
      failed: skipped.length,
      details: results,
      errors: skipped,
    });
  })
);

app.get(
  '/api/admin/cj/my-products',
  requireAdmin,
  asyncHandler(async (req, res) => {
    if (!isCjConfigured()) {
      return res.status(503).json({ error: 'הוסף CJ_ACCESS_TOKEN ב-Railway' });
    }
    const { page = '1', size = '50' } = req.query;
    const result = await getMyCjProducts(Number(page) || 1, Number(size) || 50);
    res.json(result);
  })
);

app.post(
  '/api/admin/cj/recalculate-prices',
  requireAdmin,
  asyncHandler(async (req, res) => {
    if (!isCjConfigured()) {
      return res.status(503).json({ error: 'הוסף CJ_ACCESS_TOKEN ב-Railway' });
    }
    const { markupPercent = 30 } = req.body || {};
    const results = await recalculateAllCjPrices(Number(markupPercent) || 30);
    const ok = results.filter((r) => r.price != null);
    res.json({
      updated: ok.length,
      failed: results.length - ok.length,
      details: results,
    });
  })
);

app.post(
  '/api/admin/cj/sync-my',
  requireAdmin,
  asyncHandler(async (req, res) => {
    if (!isCjConfigured()) {
      return res.status(503).json({ error: 'הוסף CJ_ACCESS_TOKEN ב-Railway' });
    }
    const {
      markupPercent = 30,
      categoryId = 'electronics',
      translateToHebrew = true,
    } = req.body || {};
    const cat = String(categoryId || 'electronics');
    const { myProducts, imported, skipped, message } = await syncMyCjProductsToStore({
      markupPercent: Number(markupPercent) || 30,
      categoryId: cat,
      translateToHebrew: translateToHebrew !== false,
    });
    if (!myProducts.length) {
      return res.json({ synced: 0, message, myProducts: [], errors: [] });
    }
    const results = await importCjProductsToStore(imported, cat);
    const dbFailed = results.filter((r) => r.status === 'failed').length;
    res.status(201).json({
      synced: results.filter((r) => r.status !== 'failed').length,
      imported: results.filter((r) => r.status === 'imported').length,
      updated: results.filter((r) => r.status === 'updated').length,
      failed: skipped.length + dbFailed,
      myProductsCount: myProducts.length,
      details: results,
      errors: skipped,
      message: message || null,
    });
  })
);

app.get(
  '/feed/google-shopping.xml',
  asyncHandler(async (req, res) => {
    const products = await getAllProducts();
    const store = await getStore();
    const items = products
      .filter((p) => p.active && p.stock > 0)
      .map((p) => {
        const price = getEffectivePrice(p);
        return `
    <item>
      <g:id>${escapeXml(p.sku)}</g:id>
      <g:title>${escapeXml(p.name)}</g:title>
      <g:description>${escapeXml(p.description)}</g:description>
      <g:link>${escapeXml(`${SITE_URL}/product/${p.id}`)}</g:link>
      <g:image_link>${escapeXml(p.image)}</g:image_link>
      <g:availability>in stock</g:availability>
      <g:price>${price.toFixed(2)} ${CURRENCY}</g:price>
      <g:brand>${escapeXml(p.brand)}</g:brand>
      <g:condition>new</g:condition>
      <g:google_product_category>${escapeXml(p.googleCategory)}</g:google_product_category>
      ${p.gtin ? `<g:gtin>${escapeXml(p.gtin)}</g:gtin>` : ''}
    </item>`;
      })
      .join('');
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escapeXml(store.name)} - פיד מוצרים</title>
    <link>${escapeXml(SITE_URL)}</link>
    <description>${escapeXml(store.tagline)}</description>
    ${items}
  </channel>
</rss>`;
    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.send(xml);
  })
);

app.get(
  '/sitemap.xml',
  asyncHandler(async (req, res) => {
    const products = await getAllProducts();
    const categories = await getCategories();
    const urls = [
      { loc: SITE_URL, priority: '1.0' },
      { loc: `${SITE_URL}/products`, priority: '0.9' },
      ...categories.map((c) => ({ loc: `${SITE_URL}/category/${c.id}`, priority: '0.8' })),
      ...products
        .filter((p) => p.active)
        .map((p) => ({ loc: `${SITE_URL}/product/${p.id}`, priority: '0.7' })),
    ];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${escapeXml(u.loc)}</loc><changefreq>weekly</changefreq><priority>${u.priority}</priority></url>`).join('\n')}
</urlset>`;
    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.send(xml);
  })
);

app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\n\nSitemap: ${API_URL}/sitemap.xml\n`);
});

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    database: 'mysql',
    stripe: isStripeEnabled(),
    email: isEmailConfigured(),
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'שגיאת שרת' });
});

const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/feed')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

async function start() {
  if (
    !process.env.MYSQLHOST &&
    !process.env.MYSQL_URL &&
    !process.env.MYSQL_URI &&
    !process.env.DATABASE_URL
  ) {
    console.error('ERROR: MySQL not configured. Add MySQL service on Railway and link variables.');
    process.exit(1);
  }
  await initDb();
  console.log('MySQL connected and tables ready');
  app.listen(PORT, () => {
    console.log(`Shop running on port ${PORT}`);
    console.log(`Google feed: ${SITE_URL}/feed/google-shopping.xml`);
  });
}

start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
