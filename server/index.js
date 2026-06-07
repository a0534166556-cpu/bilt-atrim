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
  getUserByEmail,
  getUserById,
  createUser,
  updateUserProfile,
  getOrdersByEmail,
} from './db.js';
import { verifyPassword, createSessionToken } from './auth.js';
import { isEmailConfigured, notifyOrderConfirmation, notifyOrderShipped, notifyAdminNewOrder, sendContactFormEmail } from './email.js';
import {
  translateToHebrew,
  translateProductFields,
  translateProductFieldsToEnglish,
  needsTranslation,
  translateEnglishProductsInDb,
} from './translate.js';
import { buildOrderFromBody } from './orderBuild.js';
import {
  isCjConfigured,
  searchCjProducts,
  importCjProducts,
  getMyCjProducts,
  syncMyCjProductsToStore,
  recalculateAllCjPrices,
  recalculateStaleCjPrices,
  recalcPricesFromStoredCost,
  refreshStaleCjVideos,
  refreshAllCjVideos,
  refreshProductVideos,
  revalidateAndRefreshVideos,
  cleanDeadCjVideos,
  getCjProductDetail,
} from './cj.js';
import { DEFAULT_MARKUP_PERCENT } from './pricing.js';
import {
  getPaymentConfig,
  createStripeCheckoutSession,
  verifyStripeSession,
  handleStripeWebhook,
  isStripeEnabled,
} from './payments.js';
import { mapProductMediaForClient, streamCjVideo } from './media.js';

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
  return mapProductMediaForClient({
    ...p,
    effectivePrice: getEffectivePrice(p),
    onSale,
    discountPercent,
    reviewCount: productReviews.length,
    averageRating: Math.round(avg * 10) / 10,
  });
}

app.get('/api/media/cj-video', asyncHandler(streamCjVideo));

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

async function getSessionFromRequest(req) {
  await cleanExpiredSessions();
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  const session = await getAdminSession(token);
  if (!session || Date.now() > session.expires) {
    if (token) await deleteAdminSession(token);
    return null;
  }
  return { token, ...session };
}

async function requireAuth(req, res, next) {
  const session = await getSessionFromRequest(req);
  if (!session) return res.status(401).json({ error: 'נדרשת התחברות' });
  req.user = session;
  next();
}

async function requireAdmin(req, res, next) {
  const session = await getSessionFromRequest(req);
  if (!session) return res.status(401).json({ error: 'נדרשת התחברות מנהל' });
  if (session.role !== 'admin') {
    return res.status(403).json({ error: 'אין הרשאת מנהל' });
  }
  req.user = session;
  next();
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    address: user.address || '',
    city: user.city || '',
    role: user.role,
  };
}

function orderUserId(req) {
  return req.user?.userId && req.user.role === 'customer' ? req.user.userId : null;
}

app.post(
  '/api/auth/register',
  asyncHandler(async (req, res) => {
    const { name, email, phone, address, city, password } = req.body || {};
    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ error: 'יש למלא שם, אימייל וסיסמה' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'סיסמה – לפחות 6 תווים' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'אימייל לא תקין' });
    }
    const user = await createUser({
      name: name.trim(),
      email: email.trim(),
      phone: phone?.trim(),
      address: address?.trim(),
      city: city?.trim(),
      password,
      role: 'customer',
    });
    const token = createSessionToken();
    const expires = Date.now() + 30 * 24 * 60 * 60 * 1000;
    await saveAdminSession(token, expires, user.id);
    res.status(201).json({ token, user: publicUser(user) });
  })
);

app.post(
  '/api/auth/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};
    if (!email?.trim() || !password) {
      return res.status(400).json({ error: 'יש למלא אימייל וסיסמה' });
    }
    const user = await getUserByEmail(email.trim());
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return res.status(401).json({ error: 'אימייל או סיסמה שגויים' });
    }
    const token = createSessionToken();
    const expires =
      user.role === 'admin'
        ? Date.now() + 24 * 60 * 60 * 1000
        : Date.now() + 30 * 24 * 60 * 60 * 1000;
    await saveAdminSession(token, expires, user.id);
    res.json({ token, user: publicUser(user) });
  })
);

app.get(
  '/api/auth/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.user.userId) {
      const fresh = await getUserById(req.user.userId);
      if (fresh) return res.json({ user: publicUser(fresh) });
    }
    res.json({
      user: {
        id: req.user.userId,
        email: req.user.email,
        name: req.user.name,
        phone: req.user.phone,
        address: '',
        city: '',
        role: req.user.role,
      },
    });
  })
);

app.put(
  '/api/account/profile',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'customer' || !req.user.userId) {
      return res.status(403).json({ error: 'זמין ללקוחות בלבד' });
    }
    const { name, phone, address, city } = req.body || {};
    if (!name?.trim()) {
      return res.status(400).json({ error: 'יש למלא שם' });
    }
    const updated = await updateUserProfile(req.user.userId, {
      name,
      phone,
      address,
      city,
    });
    res.json({ user: publicUser(updated) });
  })
);

app.post(
  '/api/auth/logout',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.user.token) await deleteAdminSession(req.user.token);
    res.json({ ok: true });
  })
);

app.get(
  '/api/account/orders',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'customer') {
      return res.status(403).json({ error: 'זמין ללקוחות בלבד' });
    }
    const orders = await getOrdersByEmail(req.user.email);
    res.json(orders);
  })
);

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

const videoRefreshAt = new Map();

app.post(
  '/api/products/:id/refresh-videos',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'מזהה לא תקין' });

    const product = await getProductById(id);
    if (!product) return res.status(404).json({ error: 'מוצר לא נמצא' });

    if (!isCjConfigured() || !product.cjPid) {
      return res.json({ videos: mapProductMediaForClient(product).videos });
    }

    const last = videoRefreshAt.get(id) || 0;
    if (Date.now() - last < 60_000) {
      const fresh = await getProductById(id);
      return res.json({ videos: mapProductMediaForClient(fresh).videos });
    }
    videoRefreshAt.set(id, Date.now());

    try {
      await refreshProductVideos(id);
    } catch (err) {
      console.warn('refresh-videos on demand:', err.message);
    }
    const fresh = await getProductById(id);
    res.json({ videos: mapProductMediaForClient(fresh).videos });
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
    const { text, name, description, direction = 'toHebrew' } = req.body || {};
    const toEnglish = direction === 'toEnglish';

    if (text?.trim()) {
      if (toEnglish) {
        const { translateToEnglish } = await import('./translate.js');
        const translated = await translateToEnglish(text);
        return res.json({ translated });
      }
      const translated = await translateToHebrew(text);
      return res.json({ translated, needsTranslation: needsTranslation(text) });
    }
    if (name || description) {
      const translated = toEnglish
        ? await translateProductFieldsToEnglish({ name: name || '', description: description || '' })
        : await translateProductFields({ name: name || '', description: description || '' });
      return res.json(translated);
    }
    res.status(400).json({ error: 'חסר טקסט לתרגום' });
  })
);

app.post(
  '/api/contact',
  asyncHandler(async (req, res) => {
    const { name, email, message } = req.body || {};
    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return res.status(400).json({ error: 'יש למלא שם, אימייל והודעה' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'אימייל לא תקין' });
    }
    const store = await getStore();
    if (!isEmailConfigured()) {
      return res.status(503).json({ error: 'שליחת הודעות לא זמינה – צור קשר בטלפון או WhatsApp' });
    }
    await sendContactFormEmail({
      name: name.trim(),
      email: email.trim(),
      message: message.trim(),
      store,
    });
    res.json({ message: 'ההודעה נשלחה! נחזור אליך בהקדם' });
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
    if (!req.body.acceptedTerms) {
      return res.status(400).json({ error: 'יש לאשר את תנאי השימוש ומדיניות הפרטיות' });
    }

    const session = await getSessionFromRequest(req);
    if (session) req.user = session;

    const { orderData, orderItems, total } = built;
    try {
      const orderId = await createOrder(orderData, orderItems, {
        paymentMethod: 'stripe',
        reserveStock: false,
        userId: orderUserId(req),
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
    if (!req.body.acceptedTerms) {
      return res.status(400).json({ error: 'יש לאשר את תנאי השימוש ומדיניות הפרטיות' });
    }

    const session = await getSessionFromRequest(req);
    if (session) req.user = session;

    try {
      const orderId = await createOrder(built.orderData, built.orderItems, {
        paymentMethod: 'cod',
        reserveStock: true,
        userId: orderUserId(req),
      });
      notifyOrderConfirmation(orderId).catch(() => {});
      notifyAdminNewOrder(orderId).catch(() => {});
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
    const { email, password } = req.body || {};
    if (email?.trim() && password) {
      const user = await getUserByEmail(email.trim());
      if (user?.role === 'admin' && (await verifyPassword(password, user.passwordHash))) {
        const token = createSessionToken();
        const expires = Date.now() + 24 * 60 * 60 * 1000;
        await saveAdminSession(token, expires, user.id);
        return res.json({ token, user: publicUser(user) });
      }
      return res.status(401).json({ error: 'אימייל או סיסמה שגויים' });
    }
    if (password === ADMIN_PASSWORD) {
      const token = createSessionToken();
      const expires = Date.now() + 24 * 60 * 60 * 1000;
      await saveAdminSession(token, expires);
      return res.json({ token, user: { role: 'admin' } });
    }
    return res.status(401).json({ error: 'יש למלא אימייל וסיסמה' });
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
      markupPercent = DEFAULT_MARKUP_PERCENT,
      categoryId = 'electronics',
      translateToHebrew = true,
    } = req.body;
    if (!Array.isArray(pids) || !pids.length) {
      return res.status(400).json({ error: 'בחר מוצרים לייבוא' });
    }
    const { imported, skipped } = await importCjProducts(pids, {
      markupPercent: Number(markupPercent) || DEFAULT_MARKUP_PERCENT,
      categoryId,
      translateToHebrew: translateToHebrew !== false,
    });
    const results = await importCjProductsToStore(
      imported,
      categoryId,
      Number(markupPercent) || 30
    );
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
  '/api/admin/cj/refresh-videos',
  requireAdmin,
  asyncHandler(async (req, res) => {
    if (!isCjConfigured()) {
      return res.status(503).json({ error: 'הוסף CJ_ACCESS_TOKEN ב-Railway' });
    }
    const { forceAll = true } = req.body || {};
    const results = forceAll
      ? await refreshAllCjVideos()
      : await refreshStaleCjVideos({ forceAll: false });
    res.json({
      updated: results.filter((r) => r.status === 'ok').length,
      noVideos: results.filter((r) => r.status === 'no-videos').length,
      failed: results.filter((r) => r.status === 'error').length,
      details: results,
    });
  })
);

app.post(
  '/api/admin/cj/clean-videos',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const results = await cleanDeadCjVideos();
    res.json({
      cleaned: results.length,
      totalRemoved: results.reduce((sum, r) => sum + r.removed, 0),
      details: results,
    });
  })
);

app.post(
  '/api/admin/cj/retranslate-descriptions',
  requireAdmin,
  asyncHandler(async (req, res) => {
    if (!isCjConfigured()) {
      return res.status(503).json({ error: 'הוסף CJ_ACCESS_TOKEN ב-Railway' });
    }
    const { needsDescriptionRetranslation } = await import('./descriptionFormat.js');
    const products = (await getAllProducts()).filter((p) => p.cjPid);
    const results = [];
    for (const p of products) {
      if (!needsDescriptionRetranslation(p.description) && !needsTranslation(p.description)) {
        results.push({ id: p.id, status: 'skipped' });
        continue;
      }
      try {
        const detail = await getCjProductDetail(p.cjPid);
        const translated = await translateProductFields({
          name: p.name,
          description: detail.description,
        });
        await updateProduct(p.id, {
          name: translated.name,
          description: translated.description,
        });
        results.push({ id: p.id, status: 'ok' });
        await new Promise((r) => setTimeout(r, 600));
      } catch (err) {
        results.push({ id: p.id, status: 'error', error: err.message });
      }
    }
    res.json({
      updated: results.filter((r) => r.status === 'ok').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
      failed: results.filter((r) => r.status === 'error').length,
      details: results,
    });
  })
);

app.post(
  '/api/admin/cj/recalculate-prices',
  requireAdmin,
  asyncHandler(async (req, res) => {
    if (!isCjConfigured()) {
      return res.status(503).json({ error: 'הוסף CJ_ACCESS_TOKEN ב-Railway' });
    }
    const { markupPercent = DEFAULT_MARKUP_PERCENT } = req.body || {};
    const results = await recalculateAllCjPrices(Number(markupPercent) || DEFAULT_MARKUP_PERCENT);
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
      markupPercent = DEFAULT_MARKUP_PERCENT,
      categoryId = 'electronics',
      translateToHebrew = true,
    } = req.body || {};
    const cat = String(categoryId || 'electronics');
    const { myProducts, imported, skipped, message } = await syncMyCjProductsToStore({
      markupPercent: Number(markupPercent) || DEFAULT_MARKUP_PERCENT,
      categoryId: cat,
      translateToHebrew: translateToHebrew !== false,
    });
    if (!myProducts.length) {
      return res.json({ synced: 0, message, myProducts: [], errors: [] });
    }
    const results = await importCjProductsToStore(
      imported,
      cat,
      Number(markupPercent) || 30
    );
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
      { loc: `${SITE_URL}/sales`, priority: '0.9' },
      { loc: `${SITE_URL}/contact`, priority: '0.6' },
      { loc: `${SITE_URL}/track-order`, priority: '0.6' },
      { loc: `${SITE_URL}/shipping`, priority: '0.5' },
      { loc: `${SITE_URL}/returns`, priority: '0.5' },
      { loc: `${SITE_URL}/privacy`, priority: '0.4' },
      { loc: `${SITE_URL}/terms`, priority: '0.4' },
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
  res.type('text/plain').send(`User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
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
    if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD === 'admin123') {
      console.warn('⚠️  ADMIN_PASSWORD לא הוגדר או ברירת מחדל – שנה ב-Railway לפני פרסום!');
    }
    if (!isEmailConfigured()) {
      console.warn('⚠️  SENDGRID_API_KEY / RESEND_API_KEY לא מוגדר – מיילים לא יישלחו');
    }
    recalcPricesFromStoredCost(DEFAULT_MARKUP_PERCENT)
      .then((rows) => {
        if (rows.length) {
          console.log(`מחירים: עודכנו ${rows.length} מוצרים מהעלות השמורה (ללא CJ)`);
        }
      })
      .catch((err) => console.warn('local price recalc:', err.message));

    if (isCjConfigured()) {
      recalculateAllCjPrices(DEFAULT_MARKUP_PERCENT)
        .then((rows) => {
          const ok = rows.filter((r) => r.price != null);
          if (ok.length) {
            console.log(`CJ: עודכנו מחירים ל-${ok.length} מוצרים (עלות+משלוח ×1.75 → שקל)`);
          }
        })
        .catch((err) => console.warn('CJ price recalc:', err.message));
    }
    translateEnglishProductsInDb({ getAllProducts, updateProduct })
      .then((rows) => {
        const ok = rows.filter((r) => r.status === 'ok');
        if (ok.length) console.log(`תורגמו ${ok.length} מוצרים מאנגלית לעברית במסד`);
      })
      .catch((err) => console.warn('Product Hebrew migration:', err.message));
    if (isCjConfigured()) {
      refreshStaleCjVideos()
        .then((rows) => {
          const ok = rows.filter((r) => r.status === 'ok');
          if (ok.length) console.log(`CJ: עודכנו סרטונים ל-${ok.length} מוצרים`);
        })
        .catch((err) => console.warn('CJ video refresh:', err.message));

      const SIX_HOURS = 6 * 60 * 60 * 1000;
      const timer = setInterval(() => {
        revalidateAndRefreshVideos()
          .then((rows) => {
            const ok = rows.filter((r) => r.status === 'ok');
            if (ok.length) console.log(`CJ: רענון תקופתי – חודשו סרטונים ל-${ok.length} מוצרים`);
          })
          .catch((err) => console.warn('CJ periodic video refresh:', err.message));
      }, SIX_HOURS);
      timer.unref?.();
    }
  });
}

start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
