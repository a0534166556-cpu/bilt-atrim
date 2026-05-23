import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const SITE_URL = process.env.SITE_URL || 'http://localhost:5173';
const API_URL = process.env.API_URL || `http://localhost:${PORT}`;
const CURRENCY = 'ILS';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

const dataPath = path.join(__dirname, 'data', 'products.json');
const ordersPath = path.join(__dirname, 'data', 'orders.json');
const storePath = path.join(__dirname, 'data', 'store.json');
const reviewsPath = path.join(__dirname, 'data', 'reviews.json');
const sessionsPath = path.join(__dirname, 'data', 'sessions.json');
const couponsPath = path.join(__dirname, 'data', 'coupons.json');
const newsletterPath = path.join(__dirname, 'data', 'newsletter.json');
const SHIPPING_COST = 29;

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const sessions = new Map();

function loadSessions() {
  if (fs.existsSync(sessionsPath)) {
    const data = JSON.parse(fs.readFileSync(sessionsPath, 'utf-8'));
    Object.entries(data).forEach(([k, v]) => sessions.set(k, v));
  }
}
function saveSessions() {
  fs.writeFileSync(sessionsPath, JSON.stringify(Object.fromEntries(sessions), null, 2));
}
loadSessions();

function loadData() {
  return JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
}
function saveData(data) {
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}
function loadStore() {
  return JSON.parse(fs.readFileSync(storePath, 'utf-8'));
}
function saveStore(store) {
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
}
function loadOrders() {
  if (!fs.existsSync(ordersPath)) return [];
  return JSON.parse(fs.readFileSync(ordersPath, 'utf-8'));
}
function saveOrders(orders) {
  fs.writeFileSync(ordersPath, JSON.stringify(orders, null, 2));
}
function loadReviews() {
  if (!fs.existsSync(reviewsPath)) return [];
  return JSON.parse(fs.readFileSync(reviewsPath, 'utf-8'));
}
function saveReviews(reviews) {
  fs.writeFileSync(reviewsPath, JSON.stringify(reviews, null, 2));
}
function loadCoupons() {
  if (!fs.existsSync(couponsPath)) return [];
  return JSON.parse(fs.readFileSync(couponsPath, 'utf-8'));
}
function saveCoupons(coupons) {
  fs.writeFileSync(couponsPath, JSON.stringify(coupons, null, 2));
}
function loadNewsletter() {
  if (!fs.existsSync(newsletterPath)) return [];
  return JSON.parse(fs.readFileSync(newsletterPath, 'utf-8'));
}
function saveNewsletter(list) {
  fs.writeFileSync(newsletterPath, JSON.stringify(list, null, 2));
}

function validateCoupon(code, subtotal) {
  const coupon = loadCoupons().find(
    (c) => c.code.toUpperCase() === code.toUpperCase() && c.active
  );
  if (!coupon) return { error: 'קוד קופון לא תקין' };
  if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
    return { error: 'פג תוקף הקופון' };
  }
  if (coupon.minOrder && subtotal < coupon.minOrder) {
    return { error: `מינימום הזמנה: ${coupon.minOrder} ₪` };
  }
  let discount =
    coupon.type === 'percent'
      ? Math.round(subtotal * (coupon.value / 100))
      : coupon.value;
  discount = Math.min(discount, subtotal);
  return { coupon, discount };
}

function calcShipping(subtotal, store) {
  const min = store?.freeShippingMin || 0;
  if (min > 0 && subtotal >= min) return 0;
  return subtotal > 0 ? SHIPPING_COST : 0;
}

const STOCK_RESTORE_STATUSES = ['pending', 'confirmed'];

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getEffectivePrice(p) {
  return p.salePrice && p.salePrice < p.price ? p.salePrice : p.price;
}

function enrichProduct(p, reviews = []) {
  const productReviews = reviews.filter((r) => r.productId === p.id);
  const avg =
    productReviews.length > 0
      ? productReviews.reduce((s, r) => s + r.rating, 0) / productReviews.length
      : 0;
  return {
    ...p,
    effectivePrice: getEffectivePrice(p),
    onSale: !!(p.salePrice && p.salePrice < p.price),
    reviewCount: productReviews.length,
    averageRating: Math.round(avg * 10) / 10,
  };
}

function filterPublicProducts(products, query = {}) {
  const { category, q, sort, minPrice, maxPrice, featured } = query;
  let list = products.filter((p) => p.active !== false);

  if (category) list = list.filter((p) => p.category === category);
  if (featured === 'true') list = list.filter((p) => p.featured);
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
    default:
      list.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
  }
  return list;
}

function requireAdmin(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'נדרשת התחברות מנהל' });
  }
  const session = sessions.get(token);
  if (Date.now() > session.expires) {
    sessions.delete(token);
    saveSessions();
    return res.status(401).json({ error: 'פג תוקף ההתחברות' });
  }
  next();
}

// ─── Public API ───

app.get('/api/store', (req, res) => {
  res.json(loadStore());
});

app.get('/api/products', (req, res) => {
  const data = loadData();
  const reviews = loadReviews();
  let products = filterPublicProducts(data.products, req.query);
  products = products.map((p) => enrichProduct(p, reviews));
  res.json(products);
});

app.get('/api/categories', (req, res) => {
  res.json(loadData().categories);
});

app.get('/api/products/:id/related', (req, res) => {
  const data = loadData();
  const reviews = loadReviews();
  const product = data.products.find((p) => p.id === Number(req.params.id));
  if (!product) return res.json([]);
  const related = data.products
    .filter((p) => p.id !== product.id && p.category === product.category && p.active !== false)
    .slice(0, 4)
    .map((p) => enrichProduct(p, reviews));
  res.json(related);
});

app.get('/api/products/:id/reviews', (req, res) => {
  const reviews = loadReviews().filter((r) => r.productId === Number(req.params.id));
  res.json(reviews.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
});

app.get('/api/products/:id', (req, res) => {
  const data = loadData();
  const product = data.products.find((p) => p.id === Number(req.params.id));
  if (!product || product.active === false) {
    return res.status(404).json({ error: 'מוצר לא נמצא' });
  }
  const reviews = loadReviews();
  res.json(enrichProduct(product, reviews));
});

app.post('/api/products/:id/reviews', (req, res) => {
  const { name, rating, comment } = req.body;
  if (!name || !rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'נתוני ביקורת לא תקינים' });
  }
  const data = loadData();
  const product = data.products.find((p) => p.id === Number(req.params.id));
  if (!product) return res.status(404).json({ error: 'מוצר לא נמצא' });

  const reviews = loadReviews();
  const review = {
    id: Date.now(),
    productId: product.id,
    name: name.slice(0, 80),
    rating: Number(rating),
    comment: (comment || '').slice(0, 500),
    createdAt: new Date().toISOString(),
  };
  reviews.push(review);
  saveReviews(reviews);
  res.status(201).json(review);
});

app.post('/api/coupons/validate', (req, res) => {
  const { code, subtotal } = req.body;
  if (!code) return res.status(400).json({ error: 'הזן קוד קופון' });
  const result = validateCoupon(code, Number(subtotal) || 0);
  if (result.error) return res.status(400).json({ error: result.error });
  res.json({ code: result.coupon.code, discount: result.discount });
});

app.post('/api/newsletter', (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'אימייל לא תקין' });
  }
  const list = loadNewsletter();
  if (list.some((e) => e.email === email)) {
    return res.status(400).json({ error: 'כבר רשום לניוזלטר' });
  }
  list.push({ email, subscribedAt: new Date().toISOString() });
  saveNewsletter(list);
  res.status(201).json({ message: 'נרשמת בהצלחה לניוזלטר!' });
});

app.post('/api/orders', (req, res) => {
  const { name, email, phone, address, city, notes, items, couponCode } = req.body;
  if (!name || !email || !phone || !address || !items?.length) {
    return res.status(400).json({ error: 'יש למלא את כל השדות החובה' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'אימייל לא תקין' });
  }

  const data = loadData();
  const store = loadStore();
  const orderItems = [];

  for (const item of items) {
    const product = data.products.find((p) => p.id === Number(item.id));
    if (!product || product.active === false) {
      return res.status(400).json({ error: `מוצר ${item.name || ''} לא זמין` });
    }
    const qty = Math.max(1, Math.min(Number(item.quantity) || 1, product.stock));
    if (qty < (Number(item.quantity) || 1)) {
      return res.status(400).json({ error: `אין מספיק מלאי עבור ${product.name}` });
    }
    orderItems.push({
      id: product.id,
      name: product.name,
      quantity: qty,
      price: getEffectivePrice(product),
    });
  }

  const subtotal = orderItems.reduce((s, i) => s + i.price * i.quantity, 0);
  let discount = 0;
  let appliedCoupon = null;
  if (couponCode) {
    const couponResult = validateCoupon(couponCode, subtotal);
    if (couponResult.error) return res.status(400).json({ error: couponResult.error });
    discount = couponResult.discount;
    appliedCoupon = couponResult.coupon.code;
  }
  const afterDiscount = subtotal - discount;
  const shippingCost = calcShipping(afterDiscount, store);
  const total = afterDiscount + shippingCost;

  const stockBackup = data.products.map((p) => ({ id: p.id, stock: p.stock }));
  try {
    for (const item of orderItems) {
      const product = data.products.find((p) => p.id === item.id);
      product.stock -= item.quantity;
    }
    saveData(data);

    const order = {
      id: Date.now(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      address: address.trim(),
      city: (city || '').trim(),
      notes: (notes || '').trim(),
      items: orderItems,
      subtotal,
      discount,
      couponCode: appliedCoupon,
      shippingCost,
      total,
      trackingNumber: '',
      createdAt: new Date().toISOString(),
      status: 'pending',
      statusHistory: [{ status: 'pending', at: new Date().toISOString() }],
    };
    const orders = loadOrders();
    orders.unshift(order);
    saveOrders(orders);
    res.status(201).json({ orderId: order.id, message: 'ההזמנה התקבלה בהצלחה!', total });
  } catch (err) {
    stockBackup.forEach((b) => {
      const p = data.products.find((x) => x.id === b.id);
      if (p) p.stock = b.stock;
    });
    saveData(data);
    res.status(500).json({ error: 'שגיאה בשמירת ההזמנה' });
  }
});

app.get('/api/orders/track', (req, res) => {
  const { orderId, email } = req.query;
  if (!orderId || !email) {
    return res.status(400).json({ error: 'נדרש מספר הזמנה ואימייל' });
  }
  const order = loadOrders().find(
    (o) => o.id === Number(orderId) && o.email.toLowerCase() === email.toLowerCase()
  );
  if (!order) return res.status(404).json({ error: 'הזמנה לא נמצאה' });
  res.json(order);
});

// ─── Admin API ───

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'סיסמה שגויה' });
  }
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { expires: Date.now() + 24 * 60 * 60 * 1000 });
  saveSessions();
  res.json({ token });
});

app.post('/api/admin/logout', requireAdmin, (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    sessions.delete(token);
    saveSessions();
  }
  res.json({ ok: true });
});

app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const data = loadData();
  const orders = loadOrders();
  const revenue = orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0);
  res.json({
    totalProducts: data.products.length,
    activeProducts: data.products.filter((p) => p.active !== false).length,
    lowStock: data.products.filter((p) => p.stock < 5 && p.active !== false).length,
    totalOrders: orders.length,
    pendingOrders: orders.filter((o) => o.status === 'pending').length,
    revenue,
    recentOrders: orders.slice(0, 5),
  });
});

app.get('/api/admin/products', requireAdmin, (req, res) => {
  res.json(loadData().products);
});

app.post('/api/admin/products', requireAdmin, (req, res) => {
  const data = loadData();
  const body = req.body;
  const maxId = data.products.reduce((m, p) => Math.max(m, p.id), 0);
  const product = {
    id: maxId + 1,
    sku: body.sku || `SKU-${maxId + 1}`,
    name: body.name,
    description: body.description || '',
    price: Number(body.price),
    salePrice: body.salePrice ? Number(body.salePrice) : null,
    image: body.image || '',
    brand: body.brand || '',
    category: body.category,
    googleCategory: body.googleCategory || '',
    stock: Number(body.stock) || 0,
    gtin: body.gtin || '',
    featured: !!body.featured,
    active: body.active !== false,
    createdAt: new Date().toISOString(),
  };
  if (!product.name || !product.price || !product.category) {
    return res.status(400).json({ error: 'שם, מחיר וקטגוריה הם שדות חובה' });
  }
  data.products.push(product);
  saveData(data);
  res.status(201).json(product);
});

app.put('/api/admin/products/:id', requireAdmin, (req, res) => {
  const data = loadData();
  const idx = data.products.findIndex((p) => p.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'מוצר לא נמצא' });
  const existing = data.products[idx];
  const body = req.body;
  data.products[idx] = {
    ...existing,
    sku: body.sku ?? existing.sku,
    name: body.name ?? existing.name,
    description: body.description ?? existing.description,
    price: body.price != null ? Number(body.price) : existing.price,
    salePrice: body.salePrice != null ? (body.salePrice ? Number(body.salePrice) : null) : existing.salePrice,
    image: body.image ?? existing.image,
    brand: body.brand ?? existing.brand,
    category: body.category ?? existing.category,
    googleCategory: body.googleCategory ?? existing.googleCategory,
    stock: body.stock != null ? Number(body.stock) : existing.stock,
    gtin: body.gtin ?? existing.gtin,
    featured: body.featured != null ? !!body.featured : existing.featured,
    active: body.active != null ? !!body.active : existing.active,
  };
  saveData(data);
  res.json(data.products[idx]);
});

app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
  const data = loadData();
  data.products = data.products.filter((p) => p.id !== Number(req.params.id));
  saveData(data);
  res.json({ ok: true });
});

app.get('/api/admin/orders', requireAdmin, (req, res) => {
  res.json(loadOrders());
});

app.patch('/api/admin/orders/:id', requireAdmin, (req, res) => {
  const orders = loadOrders();
  const order = orders.find((o) => o.id === Number(req.params.id));
  if (!order) return res.status(404).json({ error: 'הזמנה לא נמצאה' });

  const { status, trackingNumber } = req.body;
  const valid = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

  if (trackingNumber !== undefined) {
    order.trackingNumber = String(trackingNumber).trim();
  }

  if (status) {
    if (!valid.includes(status)) return res.status(400).json({ error: 'סטטוס לא תקין' });

    if (
      status === 'cancelled' &&
      order.status !== 'cancelled' &&
      STOCK_RESTORE_STATUSES.includes(order.status)
    ) {
      const data = loadData();
      for (const item of order.items) {
        const product = data.products.find((p) => p.id === Number(item.id));
        if (product) product.stock += item.quantity;
      }
      saveData(data);
    }

    if (status !== order.status) {
      order.status = status;
      order.statusHistory = order.statusHistory || [];
      order.statusHistory.push({ status, at: new Date().toISOString() });
    }
  }

  saveOrders(orders);
  res.json(order);
});

app.get('/api/admin/export/orders', requireAdmin, (req, res) => {
  const orders = loadOrders();
  const header = 'מספר,תאריך,שם,אימייל,טלפון,סכום,סטטוס,מעקב\n';
  const rows = orders
    .map((o) =>
      [
        o.id,
        o.createdAt,
        o.name,
        o.email,
        o.phone,
        o.total,
        o.status,
        o.trackingNumber || '',
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    )
    .join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=orders.csv');
  res.send('\uFEFF' + header + rows);
});

app.get('/api/admin/coupons', requireAdmin, (req, res) => {
  res.json(loadCoupons());
});

app.post('/api/admin/coupons', requireAdmin, (req, res) => {
  const { code, type, value, minOrder, expiresAt } = req.body;
  if (!code || !type || value == null) {
    return res.status(400).json({ error: 'קוד, סוג וערך הם חובה' });
  }
  const coupons = loadCoupons();
  if (coupons.some((c) => c.code.toUpperCase() === code.toUpperCase())) {
    return res.status(400).json({ error: 'קוד קופון כבר קיים' });
  }
  const coupon = {
    code: code.toUpperCase(),
    type: type === 'fixed' ? 'fixed' : 'percent',
    value: Number(value),
    minOrder: Number(minOrder) || 0,
    active: true,
    expiresAt: expiresAt || null,
  };
  coupons.push(coupon);
  saveCoupons(coupons);
  res.status(201).json(coupon);
});

app.delete('/api/admin/coupons/:code', requireAdmin, (req, res) => {
  let coupons = loadCoupons();
  coupons = coupons.filter((c) => c.code !== req.params.code);
  saveCoupons(coupons);
  res.json({ ok: true });
});

app.post('/api/admin/products/:id/duplicate', requireAdmin, (req, res) => {
  const data = loadData();
  const original = data.products.find((p) => p.id === Number(req.params.id));
  if (!original) return res.status(404).json({ error: 'מוצר לא נמצא' });
  const maxId = data.products.reduce((m, p) => Math.max(m, p.id), 0);
  const copy = {
    ...original,
    id: maxId + 1,
    sku: `${original.sku}-COPY`,
    name: `${original.name} (עותק)`,
    featured: false,
    createdAt: new Date().toISOString(),
  };
  data.products.push(copy);
  saveData(data);
  res.status(201).json(copy);
});

app.put('/api/admin/store', requireAdmin, (req, res) => {
  const store = { ...loadStore(), ...req.body };
  saveStore(store);
  res.json(store);
});

// ─── Google feeds ───

app.get('/feed/google-shopping.xml', (req, res) => {
  const data = loadData();
  const items = data.products
    .filter((p) => p.active !== false && p.stock > 0)
    .map((p) => {
      const price = getEffectivePrice(p);
      const link = `${SITE_URL}/product/${p.id}`;
      return `
    <item>
      <g:id>${escapeXml(p.sku)}</g:id>
      <g:title>${escapeXml(p.name)}</g:title>
      <g:description>${escapeXml(p.description)}</g:description>
      <g:link>${escapeXml(link)}</g:link>
      <g:image_link>${escapeXml(p.image)}</g:image_link>
      <g:availability>in stock</g:availability>
      <g:price>${price.toFixed(2)} ${CURRENCY}</g:price>
      <g:brand>${escapeXml(p.brand)}</g:brand>
      <g:condition>new</g:condition>
      <g:google_product_category>${escapeXml(p.googleCategory)}</g:google_product_category>
      ${p.gtin ? `<g:gtin>${escapeXml(p.gtin)}</g:gtin>` : ''}
      ${p.salePrice && p.salePrice < p.price ? `<g:sale_price>${p.salePrice.toFixed(2)} ${CURRENCY}</g:sale_price>` : ''}
    </item>`;
    })
    .join('');

  const store = loadStore();
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
});

app.get('/sitemap.xml', (req, res) => {
  const data = loadData();
  const urls = [
    { loc: SITE_URL, priority: '1.0' },
    { loc: `${SITE_URL}/products`, priority: '0.9' },
    ...data.categories.map((c) => ({ loc: `${SITE_URL}/category/${c.id}`, priority: '0.8' })),
    ...data.products
      .filter((p) => p.active !== false)
      .map((p) => ({ loc: `${SITE_URL}/product/${p.id}`, priority: '0.7' })),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${escapeXml(u.loc)}</loc><changefreq>weekly</changefreq><priority>${u.priority}</priority></url>`).join('\n')}
</urlset>`;
  res.set('Content-Type', 'application/xml; charset=utf-8');
  res.send(xml);
});

app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\n\nSitemap: ${API_URL}/sitemap.xml\n`);
});

const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/feed')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`API: http://localhost:${PORT}`);
  console.log(`Admin password: ${ADMIN_PASSWORD} (set ADMIN_PASSWORD env to change)`);
  console.log(`Google feed: http://localhost:${PORT}/feed/google-shopping.xml`);
});
