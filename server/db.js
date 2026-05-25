import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let pool;

function getConfig() {
  if (process.env.MYSQL_URL) {
    return { uri: process.env.MYSQL_URL, ssl: { rejectUnauthorized: false } };
  }
  if (process.env.DATABASE_URL) {
    return { uri: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } };
  }
  return {
    host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost',
    port: Number(process.env.MYSQLPORT || process.env.DB_PORT || 3306),
    user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
    password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '',
    database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'railway',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    waitForConnections: true,
    connectionLimit: 10,
  };
}

export async function initDb() {
  const config = getConfig();
  pool = config.uri
    ? mysql.createPool({ ...config, connectionLimit: 10, waitForConnections: true })
    : mysql.createPool(config);

  const schema = [
    `CREATE TABLE IF NOT EXISTS categories (
      id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      image VARCHAR(500),
      display_order INT DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sku VARCHAR(80) UNIQUE NOT NULL,
      name VARCHAR(200) NOT NULL,
      description TEXT,
      price DECIMAL(10,2) NOT NULL,
      sale_price DECIMAL(10,2) NULL,
      image VARCHAR(500),
      brand VARCHAR(100),
      category_id VARCHAR(50),
      google_category VARCHAR(255),
      stock INT DEFAULT 0,
      gtin VARCHAR(30),
      featured TINYINT(1) DEFAULT 0,
      active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_category (category_id),
      INDEX idx_active (active)
    )`,
    `CREATE TABLE IF NOT EXISTS orders (
      id BIGINT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(120) NOT NULL,
      phone VARCHAR(30) NOT NULL,
      address VARCHAR(255) NOT NULL,
      city VARCHAR(100),
      notes TEXT,
      subtotal DECIMAL(10,2) NOT NULL,
      discount DECIMAL(10,2) DEFAULT 0,
      coupon_code VARCHAR(50),
      shipping_cost DECIMAL(10,2) DEFAULT 0,
      total DECIMAL(10,2) NOT NULL,
      tracking_number VARCHAR(100) DEFAULT '',
      status VARCHAR(20) DEFAULT 'pending',
      payment_method VARCHAR(20) DEFAULT 'cod',
      payment_status VARCHAR(20) DEFAULT 'pending',
      stripe_session_id VARCHAR(255) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS order_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id BIGINT NOT NULL,
      product_id INT NOT NULL,
      product_name VARCHAR(200) NOT NULL,
      quantity INT NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      INDEX idx_order (order_id)
    )`,
    `CREATE TABLE IF NOT EXISTS order_status_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id BIGINT NOT NULL,
      status VARCHAR(20) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_order (order_id)
    )`,
    `CREATE TABLE IF NOT EXISTS reviews (
      id BIGINT PRIMARY KEY,
      product_id INT NOT NULL,
      name VARCHAR(80) NOT NULL,
      rating INT NOT NULL,
      comment TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_product (product_id)
    )`,
    `CREATE TABLE IF NOT EXISTS coupons (
      code VARCHAR(50) PRIMARY KEY,
      type ENUM('percent','fixed') NOT NULL,
      value DECIMAL(10,2) NOT NULL,
      min_order DECIMAL(10,2) DEFAULT 0,
      active TINYINT(1) DEFAULT 1,
      expires_at DATE NULL
    )`,
    `CREATE TABLE IF NOT EXISTS newsletter (
      email VARCHAR(120) PRIMARY KEY,
      subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS store (
      id INT PRIMARY KEY DEFAULT 1,
      name VARCHAR(100),
      tagline TEXT,
      email VARCHAR(120),
      phone VARCHAR(30),
      whatsapp VARCHAR(30),
      address VARCHAR(255),
      shipping_info TEXT,
      free_shipping_min DECIMAL(10,2) DEFAULT 300,
      promo_active TINYINT(1) DEFAULT 0,
      promo_title VARCHAR(120) DEFAULT '',
      promo_text VARCHAR(255) DEFAULT '',
      promo_link VARCHAR(255) DEFAULT '/sales'
    )`,
    `CREATE TABLE IF NOT EXISTS admin_sessions (
      token VARCHAR(64) PRIMARY KEY,
      expires_at BIGINT NOT NULL
    )`,
  ];

  for (const sql of schema) {
    await pool.query(sql);
  }

  await migrateOrderPaymentColumns();
  await migrateStorePromoColumns();

  const [[{ c }]] = await pool.query('SELECT COUNT(*) AS c FROM products');
  if (c === 0) await seedFromJson();
  else await ensureStore();
}

async function migrateStorePromoColumns() {
  const cols = [
    ['promo_active', 'TINYINT(1) DEFAULT 0'],
    ['promo_title', "VARCHAR(120) DEFAULT ''"],
    ['promo_text', "VARCHAR(255) DEFAULT ''"],
    ['promo_link', "VARCHAR(255) DEFAULT '/sales'"],
  ];
  for (const [name, def] of cols) {
    try {
      await pool.query(`ALTER TABLE store ADD COLUMN ${name} ${def}`);
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') throw e;
    }
  }
}

async function migrateOrderPaymentColumns() {
  const cols = [
    ["payment_method", "VARCHAR(20) DEFAULT 'cod'"],
    ["payment_status", "VARCHAR(20) DEFAULT 'pending'"],
    ['stripe_session_id', 'VARCHAR(255) DEFAULT NULL'],
  ];
  for (const [name, def] of cols) {
    try {
      await pool.query(`ALTER TABLE orders ADD COLUMN ${name} ${def}`);
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') throw e;
    }
  }
}

async function ensureStore() {
  const [[row]] = await pool.query('SELECT id FROM store WHERE id = 1');
  if (!row) await insertDefaultStore();
}

async function insertDefaultStore() {
  await pool.query(
    `INSERT INTO store (id, name, tagline, email, phone, whatsapp, address, shipping_info, free_shipping_min)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'מרקט גוגל',
      'החנות שלך למכירה בגוגל ובאינטרנט',
      'support@example.com',
      '03-1234567',
      '972501234567',
      'ישראל',
      'משלוח חינם בהזמנה מעל 300 ₪ | 3-5 ימי עסקים',
      300,
    ]
  );
}

async function seedFromJson() {
  const dataPath = path.join(__dirname, 'data', 'products.json');
  const couponsPath = path.join(__dirname, 'data', 'coupons.json');
  const storePath = path.join(__dirname, 'data', 'store.json');

  if (fs.existsSync(storePath)) {
    const s = JSON.parse(fs.readFileSync(storePath, 'utf-8'));
    await pool.query(
      `INSERT INTO store (id, name, tagline, email, phone, whatsapp, address, shipping_info, free_shipping_min)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [s.name, s.tagline, s.email, s.phone, s.whatsapp, s.address, s.shipping_info, s.freeShippingMin || 300]
    );
  } else {
    await insertDefaultStore();
  }

  if (fs.existsSync(dataPath)) {
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    for (const cat of data.categories || []) {
      await pool.query('INSERT IGNORE INTO categories (id, name, image) VALUES (?, ?, ?)', [
        cat.id,
        cat.name,
        cat.image,
      ]);
    }
    for (const p of data.products || []) {
      await pool.query(
        `INSERT INTO products (sku, name, description, price, sale_price, image, brand, category_id, google_category, stock, gtin, featured, active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          p.sku,
          p.name,
          p.description,
          p.price,
          p.salePrice || null,
          p.image,
          p.brand,
          p.category,
          p.googleCategory,
          p.stock,
          p.gtin || '',
          p.featured ? 1 : 0,
          p.active !== false ? 1 : 0,
          p.createdAt || new Date(),
        ]
      );
    }
  }

  if (fs.existsSync(couponsPath)) {
    const coupons = JSON.parse(fs.readFileSync(couponsPath, 'utf-8'));
    for (const c of coupons) {
      await pool.query(
        'INSERT IGNORE INTO coupons (code, type, value, min_order, active, expires_at) VALUES (?, ?, ?, ?, 1, ?)',
        [c.code, c.type, c.value, c.minOrder || 0, c.expiresAt || null]
      );
    }
  }
  console.log('MySQL seeded with initial data');
}

function mapProduct(row) {
  if (!row) return null;
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    description: row.description || '',
    price: Number(row.price),
    salePrice: row.sale_price != null ? Number(row.sale_price) : null,
    image: row.image || '',
    brand: row.brand || '',
    category: row.category_id,
    googleCategory: row.google_category || '',
    stock: Number(row.stock) || 0,
    gtin: row.gtin || '',
    featured: !!row.featured,
    active: !!row.active,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
  };
}

export function getEffectivePrice(p) {
  return p.salePrice && p.salePrice < p.price ? p.salePrice : p.price;
}

export async function getStore() {
  const [[row]] = await pool.query('SELECT * FROM store WHERE id = 1');
  if (!row) return null;
  return {
    name: row.name,
    tagline: row.tagline,
    email: row.email,
    phone: row.phone,
    whatsapp: row.whatsapp,
    address: row.address,
    shippingInfo: row.shipping_info,
    freeShippingMin: Number(row.free_shipping_min),
    promoActive: !!row.promo_active,
    promoTitle: row.promo_title || '',
    promoText: row.promo_text || '',
    promoLink: row.promo_link || '/sales',
  };
}

export async function updateStore(data) {
  const current = await getStore();
  const s = { ...current, ...data };
  await pool.query(
    `UPDATE store SET name=?, tagline=?, email=?, phone=?, whatsapp=?, address=?, shipping_info=?, free_shipping_min=?,
     promo_active=?, promo_title=?, promo_text=?, promo_link=? WHERE id=1`,
    [
      s.name,
      s.tagline,
      s.email,
      s.phone,
      s.whatsapp,
      s.address,
      s.shippingInfo,
      s.freeShippingMin ?? 300,
      s.promoActive ? 1 : 0,
      s.promoTitle || '',
      s.promoText || '',
      s.promoLink || '/sales',
    ]
  );
  return getStore();
}

export async function getCategories() {
  const [rows] = await pool.query('SELECT * FROM categories ORDER BY display_order, name');
  return rows.map((r) => ({ id: r.id, name: r.name, image: r.image }));
}

export async function getAllProducts() {
  const [rows] = await pool.query('SELECT * FROM products ORDER BY id');
  return rows.map(mapProduct);
}

export async function getProductById(id) {
  const [[row]] = await pool.query('SELECT * FROM products WHERE id = ?', [id]);
  return mapProduct(row);
}

export async function getReviews() {
  const [rows] = await pool.query('SELECT * FROM reviews ORDER BY created_at DESC');
  return rows.map((r) => ({
    id: r.id,
    productId: r.product_id,
    name: r.name,
    rating: r.rating,
    comment: r.comment,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

export async function getReviewsByProduct(productId) {
  const reviews = await getReviews();
  return reviews.filter((r) => r.productId === Number(productId));
}

export async function addReview(productId, { name, rating, comment }) {
  const id = Date.now();
  await pool.query(
    'INSERT INTO reviews (id, product_id, name, rating, comment) VALUES (?, ?, ?, ?, ?)',
    [id, productId, name.slice(0, 80), rating, (comment || '').slice(0, 500)]
  );
  return { id, productId, name, rating, comment, createdAt: new Date().toISOString() };
}

export async function createProduct(body) {
  const [result] = await pool.query(
    `INSERT INTO products (sku, name, description, price, sale_price, image, brand, category_id, google_category, stock, gtin, featured, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      body.sku || `SKU-${Date.now()}`,
      body.name,
      body.description || '',
      Number(body.price),
      body.salePrice ? Number(body.salePrice) : null,
      body.image || '',
      body.brand || '',
      body.category,
      body.googleCategory || '',
      Number(body.stock) || 0,
      body.gtin || '',
      body.featured ? 1 : 0,
      body.active !== false ? 1 : 0,
    ]
  );
  return getProductById(result.insertId);
}

export async function updateProduct(id, body) {
  const existing = await getProductById(id);
  if (!existing) return null;
  await pool.query(
    `UPDATE products SET sku=?, name=?, description=?, price=?, sale_price=?, image=?, brand=?, category_id=?, google_category=?, stock=?, gtin=?, featured=?, active=? WHERE id=?`,
    [
      body.sku ?? existing.sku,
      body.name ?? existing.name,
      body.description ?? existing.description,
      body.price != null ? Number(body.price) : existing.price,
      body.salePrice != null ? (body.salePrice ? Number(body.salePrice) : null) : existing.salePrice,
      body.image ?? existing.image,
      body.brand ?? existing.brand,
      body.category ?? existing.category,
      body.googleCategory ?? existing.googleCategory,
      body.stock != null ? Number(body.stock) : existing.stock,
      body.gtin ?? existing.gtin,
      body.featured != null ? (body.featured ? 1 : 0) : existing.featured ? 1 : 0,
      body.active != null ? (body.active ? 1 : 0) : existing.active ? 1 : 0,
      id,
    ]
  );
  return getProductById(id);
}

export async function deleteProduct(id) {
  await pool.query('DELETE FROM products WHERE id = ?', [id]);
}

export async function duplicateProduct(id) {
  const p = await getProductById(id);
  if (!p) return null;
  return createProduct({
    ...p,
    sku: `${p.sku}-COPY`,
    name: `${p.name} (עותק)`,
    featured: false,
  });
}

export async function getCoupons() {
  const [rows] = await pool.query('SELECT * FROM coupons WHERE active = 1');
  return rows.map((c) => ({
    code: c.code,
    type: c.type,
    value: Number(c.value),
    minOrder: Number(c.min_order),
    active: !!c.active,
    expiresAt: c.expires_at ? c.expires_at.toISOString?.().slice(0, 10) || String(c.expires_at) : null,
  }));
}

export async function validateCoupon(code, subtotal) {
  const [[coupon]] = await pool.query(
    'SELECT * FROM coupons WHERE UPPER(code) = UPPER(?) AND active = 1',
    [code]
  );
  if (!coupon) return { error: 'קוד קופון לא תקין' };
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return { error: 'פג תוקף הקופון' };
  }
  if (coupon.min_order && subtotal < Number(coupon.min_order)) {
    return { error: `מינימום הזמנה: ${coupon.min_order} ₪` };
  }
  let discount =
    coupon.type === 'percent'
      ? Math.round(subtotal * (Number(coupon.value) / 100))
      : Number(coupon.value);
  discount = Math.min(discount, subtotal);
  return {
    coupon: {
      code: coupon.code,
      type: coupon.type,
      value: Number(coupon.value),
      minOrder: Number(coupon.min_order),
    },
    discount,
  };
}

export async function createCoupon(data) {
  await pool.query(
    'INSERT INTO coupons (code, type, value, min_order, active, expires_at) VALUES (?, ?, ?, ?, 1, ?)',
    [data.code.toUpperCase(), data.type, data.value, data.minOrder || 0, data.expiresAt || null]
  );
  return data;
}

export async function deleteCoupon(code) {
  await pool.query('DELETE FROM coupons WHERE code = ?', [code]);
}

export async function subscribeNewsletter(email) {
  await pool.query('INSERT INTO newsletter (email) VALUES (?)', [email]);
}

export async function newsletterExists(email) {
  const [[row]] = await pool.query('SELECT email FROM newsletter WHERE email = ?', [email]);
  return !!row;
}

async function mapOrder(row, items, history) {
  return {
    id: Number(row.id),
    name: row.name,
    email: row.email,
    phone: row.phone,
    address: row.address,
    city: row.city || '',
    notes: row.notes || '',
    subtotal: Number(row.subtotal),
    discount: Number(row.discount),
    couponCode: row.coupon_code,
    shippingCost: Number(row.shipping_cost),
    total: Number(row.total),
    trackingNumber: row.tracking_number || '',
    status: row.status,
    paymentMethod: row.payment_method || 'cod',
    paymentStatus: row.payment_status || 'pending',
    createdAt: new Date(row.created_at).toISOString(),
    items: items.map((i) => ({
      id: i.product_id,
      name: i.product_name,
      quantity: i.quantity,
      price: Number(i.price),
    })),
    statusHistory: history.map((h) => ({
      status: h.status,
      at: new Date(h.created_at).toISOString(),
    })),
  };
}

export async function getOrderByIdAndEmail(orderId, email) {
  const [[row]] = await pool.query('SELECT * FROM orders WHERE id = ? AND LOWER(email) = LOWER(?)', [
    orderId,
    email,
  ]);
  if (!row) return null;
  const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
  const [history] = await pool.query(
    'SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at',
    [orderId]
  );
  return mapOrder(row, items, history);
}

export async function getAllOrders() {
  const [orders] = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
  const result = [];
  for (const row of orders) {
    const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [row.id]);
    const [history] = await pool.query(
      'SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at',
      [row.id]
    );
    result.push(await mapOrder(row, items, history));
  }
  return result;
}

async function deductStock(conn, orderItems) {
  for (const item of orderItems) {
    const [[p]] = await conn.query(
      'SELECT stock, active FROM products WHERE id = ? FOR UPDATE',
      [item.id]
    );
    if (!p || !p.active) throw new Error(`מוצר ${item.name} לא זמין`);
    if (p.stock < item.quantity) throw new Error(`אין מספיק מלאי עבור ${item.name}`);
    await conn.query('UPDATE products SET stock = stock - ? WHERE id = ?', [
      item.quantity,
      item.id,
    ]);
  }
}

export async function createOrder(orderData, orderItems, options = {}) {
  const paymentMethod = options.paymentMethod || 'cod';
  const reserveStock = options.reserveStock ?? paymentMethod !== 'stripe';
  const status = paymentMethod === 'stripe' ? 'awaiting_payment' : 'pending';
  const paymentStatus = 'pending';

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const orderId = Date.now();

    if (reserveStock) {
      await deductStock(conn, orderItems);
    } else {
      for (const item of orderItems) {
        const [[p]] = await conn.query('SELECT stock, active FROM products WHERE id = ?', [
          item.id,
        ]);
        if (!p || !p.active) throw new Error(`מוצר ${item.name} לא זמין`);
        if (p.stock < item.quantity) throw new Error(`אין מספיק מלאי עבור ${item.name}`);
      }
    }

    await conn.query(
      `INSERT INTO orders (id, name, email, phone, address, city, notes, subtotal, discount, coupon_code, shipping_cost, total, tracking_number, status, payment_method, payment_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?)`,
      [
        orderId,
        orderData.name,
        orderData.email,
        orderData.phone,
        orderData.address,
        orderData.city,
        orderData.notes,
        orderData.subtotal,
        orderData.discount,
        orderData.couponCode,
        orderData.shippingCost,
        orderData.total,
        status,
        paymentMethod,
        paymentStatus,
      ]
    );

    for (const item of orderItems) {
      await conn.query(
        'INSERT INTO order_items (order_id, product_id, product_name, quantity, price) VALUES (?, ?, ?, ?, ?)',
        [orderId, item.id, item.name, item.quantity, item.price]
      );
    }

    await conn.query('INSERT INTO order_status_history (order_id, status) VALUES (?, ?)', [
      orderId,
      status,
    ]);

    await conn.commit();
    return orderId;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function setOrderStripeSession(orderId, sessionId) {
  await pool.query('UPDATE orders SET stripe_session_id = ? WHERE id = ?', [sessionId, orderId]);
}

export async function getOrderById(orderId) {
  const [[row]] = await pool.query('SELECT * FROM orders WHERE id = ?', [orderId]);
  if (!row) return null;
  const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
  const [history] = await pool.query(
    'SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at',
    [orderId]
  );
  return mapOrder(row, items, history);
}

export async function confirmOrderPayment(orderId, stripeSessionId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[order]] = await conn.query('SELECT * FROM orders WHERE id = ? FOR UPDATE', [orderId]);
    if (!order) throw new Error('הזמנה לא נמצאה');
    if (order.payment_status === 'paid') {
      await conn.commit();
      return orderId;
    }
    if (order.status !== 'awaiting_payment') {
      throw new Error('הזמנה לא ממתינה לתשלום');
    }

    const [items] = await conn.query('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
    const orderItems = items.map((i) => ({
      id: i.product_id,
      name: i.product_name,
      quantity: i.quantity,
      price: Number(i.price),
    }));
    await deductStock(conn, orderItems);

    await conn.query(
      `UPDATE orders SET status = 'confirmed', payment_status = 'paid', stripe_session_id = ? WHERE id = ?`,
      [stripeSessionId || order.stripe_session_id, orderId]
    );
    await conn.query('INSERT INTO order_status_history (order_id, status) VALUES (?, ?)', [
      orderId,
      'confirmed',
    ]);

    await conn.commit();
    return orderId;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function updateOrder(id, { status, trackingNumber }, stockRestoreStatuses) {
  const [[order]] = await pool.query('SELECT * FROM orders WHERE id = ?', [id]);
  if (!order) return null;

  if (trackingNumber !== undefined) {
    await pool.query('UPDATE orders SET tracking_number = ? WHERE id = ?', [
      String(trackingNumber).trim(),
      id,
    ]);
  }

  if (status && status !== order.status) {
    const hadStockReserved =
      order.status !== 'awaiting_payment' ||
      order.payment_status === 'paid';
    if (
      status === 'cancelled' &&
      order.status !== 'cancelled' &&
      hadStockReserved &&
      stockRestoreStatuses.includes(order.status)
    ) {
      const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [id]);
      for (const item of items) {
        await pool.query('UPDATE products SET stock = stock + ? WHERE id = ?', [
          item.quantity,
          item.product_id,
        ]);
      }
    }
    await pool.query('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
    await pool.query('INSERT INTO order_status_history (order_id, status) VALUES (?, ?)', [
      id,
      status,
    ]);
  }

  return getOrderByIdAndEmail(id, order.email);
}

export async function getAdminStats() {
  const [[products]] = await pool.query('SELECT COUNT(*) AS total FROM products');
  const [[active]] = await pool.query('SELECT COUNT(*) AS c FROM products WHERE active = 1');
  const [[lowStock]] = await pool.query('SELECT COUNT(*) AS c FROM products WHERE stock < 5 AND active = 1');
  const [[totalOrders]] = await pool.query('SELECT COUNT(*) AS c FROM orders');
  const [[pending]] = await pool.query(
    "SELECT COUNT(*) AS c FROM orders WHERE status IN ('pending', 'awaiting_payment')"
  );
  const [[revenue]] = await pool.query(
    "SELECT COALESCE(SUM(total),0) AS r FROM orders WHERE status NOT IN ('cancelled', 'awaiting_payment')"
  );
  const [[onSale]] = await pool.query(
    'SELECT COUNT(*) AS c FROM products WHERE active = 1 AND sale_price IS NOT NULL AND sale_price < price'
  );
  const orders = await getAllOrders();
  return {
    totalProducts: products.total,
    activeProducts: active.c,
    lowStock: lowStock.c,
    onSaleProducts: onSale.c,
    totalOrders: totalOrders.c,
    pendingOrders: pending.c,
    revenue: Number(revenue.r),
    recentOrders: orders.slice(0, 5),
  };
}

export async function saveAdminSession(token, expires) {
  await pool.query(
    'INSERT INTO admin_sessions (token, expires_at) VALUES (?, ?) ON DUPLICATE KEY UPDATE expires_at = ?',
    [token, expires, expires]
  );
}

export async function deleteAdminSession(token) {
  await pool.query('DELETE FROM admin_sessions WHERE token = ?', [token]);
}

export async function getAdminSession(token) {
  const [[row]] = await pool.query('SELECT expires_at FROM admin_sessions WHERE token = ?', [
    token,
  ]);
  if (!row) return null;
  return { expires: Number(row.expires_at) };
}

export async function cleanExpiredSessions() {
  await pool.query('DELETE FROM admin_sessions WHERE expires_at < ?', [Date.now()]);
}

export { pool };
