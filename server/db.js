import mysql from 'mysql2/promise';
import { calculateRetailPriceIls, DEFAULT_MARKUP_PERCENT } from './pricing.js';
import { hashPassword } from './auth.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let pool;

function getConfig() {
  const mysqlUri = process.env.MYSQL_URL || process.env.MYSQL_URI || process.env.DATABASE_URL;
  if (mysqlUri) {
    return { uri: mysqlUri, ssl: { rejectUnauthorized: false } };
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
    `CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(120) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(100) NOT NULL DEFAULT '',
      phone VARCHAR(30) DEFAULT '',
      role ENUM('admin','customer') NOT NULL DEFAULT 'customer',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS user_sessions (
      token VARCHAR(64) PRIMARY KEY,
      user_id INT NOT NULL,
      expires_at BIGINT NOT NULL,
      INDEX idx_user (user_id)
    )`,
  ];

  for (const sql of schema) {
    await pool.query(sql);
  }

  await migrateOrderPaymentColumns();
  await migrateStorePromoColumns();
  await migrateProductCjColumns();
  await migrateUserColumns();

  const [[{ c }]] = await pool.query('SELECT COUNT(*) AS c FROM products');
  if (c === 0) await seedFromJson();
  else await ensureStore();

  await ensureOwnerUser();
  await syncStoreOwnerContact();

  const removed = await deleteDemoProducts();
  if (removed > 0) console.log(`Removed ${removed} demo products`);
}

async function migrateProductCjColumns() {
  const cols = [
    ['cj_pid', 'VARCHAR(100) DEFAULT NULL'],
    ['cj_sku', 'VARCHAR(100) DEFAULT NULL'],
    ['images', 'JSON NULL'],
    ['video_url', 'VARCHAR(500) DEFAULT NULL'],
    ['videos', 'JSON NULL'],
    ['cost_usd', 'DECIMAL(10,2) DEFAULT NULL'],
    ['shipping_usd', 'DECIMAL(10,2) DEFAULT NULL'],
    ['price_locked', 'TINYINT(1) DEFAULT 0'],
  ];
  for (const [name, def] of cols) {
    try {
      await pool.query(`ALTER TABLE products ADD COLUMN ${name} ${def}`);
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') throw e;
    }
  }
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

async function migrateUserColumns() {
  try {
    await pool.query('ALTER TABLE orders ADD COLUMN user_id INT NULL');
  } catch (e) {
    if (e.code !== 'ER_DUP_FIELDNAME') throw e;
  }
  const cols = [
    ['address', "VARCHAR(255) DEFAULT ''"],
    ['city', "VARCHAR(100) DEFAULT ''"],
  ];
  for (const [name, def] of cols) {
    try {
      await pool.query(`ALTER TABLE users ADD COLUMN ${name} ${def}`);
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') throw e;
    }
  }
}

const OWNER_EMAIL = () =>
  (process.env.OWNER_EMAIL || process.env.ADMIN_EMAIL || 'a0534166556@gmail.com').toLowerCase();
const OWNER_PHONE = () => process.env.OWNER_PHONE || '0508254935';
const OWNER_WHATSAPP = () => process.env.OWNER_WHATSAPP || '972508254935';

async function ensureOwnerUser() {
  const [[admin]] = await pool.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  if (admin) return;

  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const passwordHash = await hashPassword(password);
  await pool.query(
    `INSERT INTO users (email, password_hash, name, phone, role) VALUES (?, ?, ?, ?, 'admin')`,
    [OWNER_EMAIL(), passwordHash, 'מנהל', OWNER_PHONE()]
  );
  console.log(`נוצר משתמש מנהל: ${OWNER_EMAIL()} (שנה סיסמה ב-Railway: ADMIN_PASSWORD)`);
}

async function syncStoreOwnerContact() {
  await pool.query(
    `UPDATE store SET email = ?, phone = ?, whatsapp = ?
     WHERE id = 1 AND (email IS NULL OR email = '' OR email = 'support@example.com')`,
    [OWNER_EMAIL(), OWNER_PHONE(), OWNER_WHATSAPP()]
  );
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
      'NovaShop',
      'החנות שלך למכירה בגוגל ובאינטרנט',
      'a0534166556@gmail.com',
      '0508254935',
      '972508254935',
      'ישראל',
      'משלוח חינם לכל הארץ | 7-14 ימי עסקים',
      0,
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
    cjPid: row.cj_pid || null,
    cjSku: row.cj_sku || null,
    costUsd: row.cost_usd != null ? Number(row.cost_usd) : null,
    shippingUsd: row.shipping_usd != null ? Number(row.shipping_usd) : null,
    priceLocked: !!row.price_locked,
    images: parseImagesColumn(row.images, row.image),
    videoUrl: row.video_url || '',
    videos: parseVideosColumn(row.videos, row.video_url),
  };
}

function parseVideosColumn(videosCol, fallbackVideoUrl) {
  if (videosCol) {
    try {
      const parsed = typeof videosCol === 'string' ? JSON.parse(videosCol) : videosCol;
      if (Array.isArray(parsed) && parsed.length) {
        return parsed
          .map((v) =>
            typeof v === 'string'
              ? { url: v, poster: '' }
              : { url: v?.url || '', poster: v?.poster || '' }
          )
          .filter((v) => v.url);
      }
    } catch {
      /* ignore */
    }
  }
  if (fallbackVideoUrl) return [{ url: fallbackVideoUrl, poster: '' }];
  return [];
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function safePrice(value, min = 1) {
  return Math.max(min, safeNumber(value, min));
}

/** מחיר מכירה בש"ח – לא מחיר CJ בדולרים */
function resolveStorePriceIls(item, markupPercent = DEFAULT_MARKUP_PERCENT) {
  const retail = Number(item.retail);
  if (Number.isFinite(retail) && retail >= 5) return Math.ceil(retail);

  const costUsd = Number(item.cost ?? item.costUsd);
  if (Number.isFinite(costUsd) && costUsd > 0) {
    const fromCost = calculateRetailPriceIls(costUsd, {
      markupPercent,
      shippingUsd: item.shippingUsd,
    });
    if (fromCost != null) return fromCost;
  }

  const raw = Number(item.price);
  if (Number.isFinite(raw) && raw > 0 && raw < 20) {
    const fromUsd = calculateRetailPriceIls(raw, {
      markupPercent,
      shippingUsd: item.shippingUsd,
    });
    if (fromUsd != null) return fromUsd;
  }

  return safePrice(item.retail ?? item.price, 5);
}

function parseImagesColumn(imagesCol, fallbackImage) {
  if (!imagesCol) return fallbackImage ? [fallbackImage] : [];
  try {
    const parsed = typeof imagesCol === 'string' ? JSON.parse(imagesCol) : imagesCol;
    if (Array.isArray(parsed) && parsed.length) return parsed;
  } catch {
    /* ignore */
  }
  return fallbackImage ? [fallbackImage] : [];
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
  const images = body.images?.length ? body.images : body.image ? [body.image] : [];
  const mainImage = images[0] || body.image || '';
  const [result] = await pool.query(
    `INSERT INTO products (sku, name, description, price, sale_price, image, brand, category_id, google_category, stock, gtin, featured, active, cj_pid, cj_sku, images, video_url, videos, cost_usd, shipping_usd, price_locked)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      body.sku || `SKU-${Date.now()}`,
      body.name,
      body.description || '',
      Number(body.price),
      body.salePrice ? Number(body.salePrice) : null,
      mainImage,
      body.brand || '',
      body.category,
      body.googleCategory || '',
      Math.max(0, Math.floor(safeNumber(body.stock, 0))),
      body.gtin || '',
      body.featured ? 1 : 0,
      body.active !== false ? 1 : 0,
      body.cjPid || null,
      body.cjSku || null,
      images.length ? JSON.stringify(images) : null,
      body.videoUrl || null,
      body.videos?.length ? JSON.stringify(body.videos) : null,
      body.costUsd != null && Number.isFinite(Number(body.costUsd)) ? Number(body.costUsd) : null,
      body.shippingUsd != null && Number.isFinite(Number(body.shippingUsd)) ? Number(body.shippingUsd) : null,
      body.priceLocked ? 1 : 0,
    ]
  );
  return getProductById(result.insertId);
}

export async function getProductByCjPid(cjPid) {
  if (cjPid == null || cjPid === '') return null;
  const [[row]] = await pool.query('SELECT id FROM products WHERE cj_pid = ?', [String(cjPid)]);
  return row ? Number(row.id) : null;
}

export async function importCjProductsToStore(cjItems, categoryId, markupPercent = DEFAULT_MARKUP_PERCENT) {
  const results = [];
  const cat = categoryId && String(categoryId) !== 'NaN' ? String(categoryId) : 'electronics';
  const markup = Number(markupPercent);
  const validMarkup = Number.isFinite(markup) ? markup : 30;

  for (const item of cjItems) {
    if (!item?.pid) {
      results.push({ pid: null, status: 'failed', error: 'חסר מזהה מוצר מ-CJ' });
      continue;
    }
    try {
      const images = item.images?.length ? item.images : item.image ? [item.image] : [];
      const name = String(item.name || 'מוצר CJ').slice(0, 200);
      const payload = {
        sku: (item.sku || `CJ-${String(item.pid).slice(0, 8)}`).slice(0, 80),
        name,
        description: String(item.description || name).slice(0, 8000),
        price: resolveStorePriceIls(item, validMarkup),
        image: images[0] || '',
        images,
        videoUrl: item.videoUrl || item.videos?.[0]?.url || '',
        videos: item.videos?.length ? item.videos : item.videoUrl ? [{ url: item.videoUrl, poster: images[0] || '' }] : [],
        brand: 'CJ Dropshipping',
        category: cat,
        googleCategory: 'Electronics',
        stock: Math.max(0, Math.floor(safeNumber(item.stock, 99))),
        featured: false,
        active: true,
        cjPid: String(item.pid),
        cjSku: String(item.sku || ''),
        costUsd: Number(item.cost ?? item.costUsd),
        shippingUsd: Number(item.shippingUsd),
      };
      const existingId = await getProductByCjPid(item.pid);
      if (existingId) {
        await updateProduct(existingId, payload);
        results.push({ pid: item.pid, status: 'updated', productId: existingId });
        continue;
      }
      const product = await createProduct(payload);
      results.push({ pid: item.pid, status: 'imported', productId: product.id });
    } catch (err) {
      results.push({ pid: item.pid, status: 'failed', error: err.message });
    }
  }
  return results;
}

export async function updateProduct(id, body) {
  const existing = await getProductById(id);
  if (!existing) return null;
  const images =
    body.images != null
      ? body.images
      : existing.images?.length
        ? existing.images
        : existing.image
          ? [existing.image]
          : [];
  const mainImage = images[0] || (body.image ?? existing.image);
  await pool.query(
    `UPDATE products SET sku=?, name=?, description=?, price=?, sale_price=?, image=?, brand=?, category_id=?, google_category=?, stock=?, gtin=?, featured=?, active=?, images=?, video_url=?, videos=?, cost_usd=?, shipping_usd=?, price_locked=? WHERE id=?`,
    [
      body.sku ?? existing.sku,
      body.name ?? existing.name,
      body.description ?? existing.description,
      body.price != null ? safePrice(body.price, 1) : existing.price,
      body.salePrice != null
        ? body.salePrice
          ? safePrice(body.salePrice, 1)
          : null
        : existing.salePrice,
      mainImage,
      body.brand ?? existing.brand,
      body.category ?? existing.category,
      body.googleCategory ?? existing.googleCategory,
      body.stock != null ? Math.max(0, Math.floor(safeNumber(body.stock, 0))) : existing.stock,
      body.gtin ?? existing.gtin,
      body.featured != null ? (body.featured ? 1 : 0) : existing.featured ? 1 : 0,
      body.active != null ? (body.active ? 1 : 0) : existing.active ? 1 : 0,
      images.length ? JSON.stringify(images) : null,
      body.videoUrl != null ? body.videoUrl || null : existing.videoUrl || null,
      body.videos != null
        ? body.videos.length
          ? JSON.stringify(body.videos)
          : null
        : existing.videos?.length
          ? JSON.stringify(existing.videos)
          : null,
      body.costUsd != null && Number.isFinite(Number(body.costUsd))
        ? Number(body.costUsd)
        : existing.costUsd,
      body.shippingUsd != null && Number.isFinite(Number(body.shippingUsd))
        ? Number(body.shippingUsd)
        : existing.shippingUsd,
      body.priceLocked != null ? (body.priceLocked ? 1 : 0) : existing.priceLocked ? 1 : 0,
      id,
    ]
  );
  return getProductById(id);
}

export async function deleteProduct(id) {
  await pool.query('DELETE FROM products WHERE id = ?', [id]);
}

/** מוחק מוצרי דמה (ללא cj_pid) – TechPro, SoundMax וכו' */
export async function deleteDemoProducts() {
  const [rows] = await pool.query('SELECT id FROM products WHERE cj_pid IS NULL');
  if (!rows.length) return 0;
  for (const row of rows) {
    await pool.query('DELETE FROM reviews WHERE product_id = ?', [row.id]);
  }
  const [result] = await pool.query('DELETE FROM products WHERE cj_pid IS NULL');
  return result.affectedRows || 0;
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
  const userId = options.userId || null;

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
      `INSERT INTO orders (id, user_id, name, email, phone, address, city, notes, subtotal, discount, coupon_code, shipping_cost, total, tracking_number, status, payment_method, payment_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?)`,
      [
        orderId,
        userId,
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
    if (userId) {
      saveUserContactFromOrder(userId, orderData).catch(() => {});
    }
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
      return { orderId, newlyConfirmed: false };
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
    return { orderId, newlyConfirmed: true };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function updateOrder(id, { status, trackingNumber, paymentStatus }, stockRestoreStatuses) {
  const [[order]] = await pool.query('SELECT * FROM orders WHERE id = ?', [id]);
  if (!order) return null;

  if (trackingNumber !== undefined) {
    await pool.query('UPDATE orders SET tracking_number = ? WHERE id = ?', [
      String(trackingNumber).trim(),
      id,
    ]);
  }

  if (paymentStatus && paymentStatus !== order.payment_status) {
    await pool.query('UPDATE orders SET payment_status = ? WHERE id = ?', [paymentStatus, id]);
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

export async function saveAdminSession(token, expires, userId = null) {
  if (userId) {
    await pool.query(
      'INSERT INTO user_sessions (token, user_id, expires_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE expires_at = ?',
      [token, userId, expires, expires]
    );
    return;
  }
  await pool.query(
    'INSERT INTO admin_sessions (token, expires_at) VALUES (?, ?) ON DUPLICATE KEY UPDATE expires_at = ?',
    [token, expires, expires]
  );
}

export async function deleteAdminSession(token) {
  await pool.query('DELETE FROM admin_sessions WHERE token = ?', [token]);
  await pool.query('DELETE FROM user_sessions WHERE token = ?', [token]);
}

export async function getAdminSession(token) {
  const [[userRow]] = await pool.query(
    `SELECT s.expires_at, u.id, u.email, u.name, u.phone, u.role
     FROM user_sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = ?`,
    [token]
  );
  if (userRow) {
    return {
      expires: Number(userRow.expires_at),
      userId: userRow.id,
      email: userRow.email,
      name: userRow.name,
      phone: userRow.phone,
      role: userRow.role,
    };
  }
  const [[row]] = await pool.query('SELECT expires_at FROM admin_sessions WHERE token = ?', [token]);
  if (!row) return null;
  return { expires: Number(row.expires_at), role: 'admin' };
}

export async function cleanExpiredSessions() {
  const now = Date.now();
  await pool.query('DELETE FROM admin_sessions WHERE expires_at < ?', [now]);
  await pool.query('DELETE FROM user_sessions WHERE expires_at < ?', [now]);
}

export async function getUserByEmail(email) {
  const [[row]] = await pool.query('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
  if (!row) return null;
  return mapUser(row);
}

export async function getUserById(id) {
  const [[row]] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
  if (!row) return null;
  return mapUser(row);
}

function mapUser(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone || '',
    address: row.address || '',
    city: row.city || '',
    role: row.role,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
  };
}

export async function createUser({ email, password, name, phone, address, city, role = 'customer' }) {
  const normalized = email.trim().toLowerCase();
  const [[existing]] = await pool.query('SELECT id FROM users WHERE email = ?', [normalized]);
  if (existing) throw new Error('כבר קיים משתמש עם אימייל זה');

  const passwordHash = await hashPassword(password);
  const [result] = await pool.query(
    'INSERT INTO users (email, password_hash, name, phone, address, city, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [normalized, passwordHash, name.trim(), phone?.trim() || '', address?.trim() || '', city?.trim() || '', role]
  );
  return getUserById(result.insertId);
}

/** עדכון פרטי פרופיל של לקוח (שם, טלפון, כתובת, עיר) */
export async function updateUserProfile(id, { name, phone, address, city }) {
  await pool.query(
    'UPDATE users SET name = ?, phone = ?, address = ?, city = ? WHERE id = ?',
    [
      (name ?? '').trim(),
      (phone ?? '').trim(),
      (address ?? '').trim(),
      (city ?? '').trim(),
      id,
    ]
  );
  return getUserById(id);
}

/** שמירת פרטי המשלוח האחרונים על הפרופיל, כדי שימולאו אוטומטית בפעם הבאה */
export async function saveUserContactFromOrder(userId, orderData) {
  if (!userId) return;
  try {
    await pool.query(
      `UPDATE users
       SET name = ?, phone = ?, address = ?, city = ?
       WHERE id = ?`,
      [
        orderData.name || '',
        orderData.phone || '',
        orderData.address || '',
        orderData.city || '',
        userId,
      ]
    );
  } catch {
    /* best-effort */
  }
}

export async function getOrdersByEmail(email) {
  const [rows] = await pool.query(
    'SELECT * FROM orders WHERE email = ? ORDER BY created_at DESC',
    [email.toLowerCase()]
  );
  const result = [];
  for (const row of rows) {
    const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [row.id]);
    const [history] = await pool.query(
      'SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at',
      [row.id]
    );
    result.push(await mapOrder(row, items, history));
  }
  return result;
}

export { pool };
