const API = '/api';

async function request(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = localStorage.getItem('adminToken');
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      'השרת לא מחובר – הוסף RAILWAY_BACKEND_URL ב-Netlify ועשה Deploy, או בדוק ש-Railway Online'
    );
  }
  if (!res.ok) throw new Error(data.error || 'שגיאה בשרת');
  return data;
}

function ensureArray(data, label) {
  if (!Array.isArray(data)) {
    throw new Error(`${label} – בדוק חיבור Railway ב-Netlify`);
  }
  return data;
}

export async function fetchStore() {
  return request(`${API}/store`);
}

export async function fetchProducts(params = {}) {
  const qs = new URLSearchParams(params).toString();
  const data = await request(`${API}/products${qs ? `?${qs}` : ''}`);
  return ensureArray(data, 'מוצרים');
}

export async function fetchProduct(id) {
  return request(`${API}/products/${id}`);
}

export async function fetchRelated(id) {
  return request(`${API}/products/${id}/related`);
}

export async function fetchCategories() {
  const data = await request(`${API}/categories`);
  return ensureArray(data, 'קטגוריות');
}

export async function fetchReviews(productId) {
  return request(`${API}/products/${productId}/reviews`);
}

export async function addReview(productId, review) {
  return request(`${API}/products/${productId}/reviews`, {
    method: 'POST',
    body: JSON.stringify(review),
  });
}

export async function validateCoupon(code, subtotal) {
  return request(`${API}/coupons/validate`, {
    method: 'POST',
    body: JSON.stringify({ code, subtotal }),
  });
}

export async function subscribeNewsletter(email) {
  return request(`${API}/newsletter`, {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function fetchPaymentConfig() {
  return request(`${API}/payments/config`);
}

export async function createStripeCheckout(order) {
  return request(`${API}/payments/checkout`, { method: 'POST', body: JSON.stringify(order) });
}

export async function verifyPayment(sessionId) {
  return request(`${API}/payments/verify?session_id=${encodeURIComponent(sessionId)}`);
}

export async function createOrder(order) {
  return request(`${API}/orders`, { method: 'POST', body: JSON.stringify(order) });
}

export async function trackOrder(orderId, email) {
  return request(`${API}/orders/track?orderId=${orderId}&email=${encodeURIComponent(email)}`);
}

export async function translateProductContent({ name, description }) {
  return request(`${API}/translate`, {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  });
}

export async function adminLogin(password) {
  return request(`${API}/admin/login`, { method: 'POST', body: JSON.stringify({ password }) });
}

export async function adminStats() {
  return request(`${API}/admin/stats`);
}

export async function adminProducts() {
  return request(`${API}/admin/products`);
}

export async function adminCreateProduct(product) {
  return request(`${API}/admin/products`, { method: 'POST', body: JSON.stringify(product) });
}

export async function adminUpdateProduct(id, product) {
  return request(`${API}/admin/products/${id}`, { method: 'PUT', body: JSON.stringify(product) });
}

export async function adminDeleteProduct(id) {
  return request(`${API}/admin/products/${id}`, { method: 'DELETE' });
}

export async function adminOrders() {
  return request(`${API}/admin/orders`);
}

export async function adminUpdateOrderStatus(id, updates) {
  return request(`${API}/admin/orders/${id}`, { method: 'PATCH', body: JSON.stringify(updates) });
}

export async function exportOrdersCsv() {
  const token = localStorage.getItem('adminToken');
  const res = await fetch(`${API}/admin/export/orders`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('שגיאה בייצוא');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `orders-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function adminUpdateStore(store) {
  return request(`${API}/admin/store`, { method: 'PUT', body: JSON.stringify(store) });
}

export async function adminLogout() {
  return request(`${API}/admin/logout`, { method: 'POST' });
}

export async function adminCoupons() {
  return request(`${API}/admin/coupons`);
}

export async function adminCreateCoupon(coupon) {
  return request(`${API}/admin/coupons`, { method: 'POST', body: JSON.stringify(coupon) });
}

export async function adminDeleteCoupon(code) {
  return request(`${API}/admin/coupons/${code}`, { method: 'DELETE' });
}

export async function adminDuplicateProduct(id) {
  return request(`${API}/admin/products/${id}/duplicate`, { method: 'POST' });
}

export async function adminCjStatus() {
  return request(`${API}/admin/cj/status`);
}

export async function adminCjSearch(q, page = 1) {
  const params = new URLSearchParams({ q, page: String(page), size: '20' });
  return request(`${API}/admin/cj/search?${params}`);
}

export async function adminCjImport(pids, { markupPercent, categoryId, translateToHebrew }) {
  return request(`${API}/admin/cj/import`, {
    method: 'POST',
    body: JSON.stringify({ pids, markupPercent, categoryId, translateToHebrew }),
  });
}

export async function adminCjMyProducts(page = 1) {
  const params = new URLSearchParams({ page: String(page), size: '50' });
  return request(`${API}/admin/cj/my-products?${params}`);
}

export async function adminCjSyncMy({ markupPercent, categoryId, translateToHebrew }) {
  return request(`${API}/admin/cj/sync-my`, {
    method: 'POST',
    body: JSON.stringify({ markupPercent, categoryId, translateToHebrew }),
  });
}

export async function adminCjRecalculatePrices(markupPercent = 30) {
  return request(`${API}/admin/cj/recalculate-prices`, {
    method: 'POST',
    body: JSON.stringify({ markupPercent }),
  });
}

export async function adminTranslateProduct(id) {
  return request(`${API}/admin/products/${id}/translate`, { method: 'POST' });
}


export function formatPrice(price) {
  const n = Number(price);
  if (!Number.isFinite(n)) return '₪0';
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 0,
  }).format(n);
}

export const ORDER_STATUS = {
  awaiting_payment: { label: 'ממתין לתשלום', color: 'warning' },
  pending: { label: 'ממתין לאישור', color: 'warning' },
  confirmed: { label: 'אושר', color: 'info' },
  shipped: { label: 'נשלח', color: 'primary' },
  delivered: { label: 'נמסר', color: 'success' },
  cancelled: { label: 'בוטל', color: 'danger' },
};

export const PAYMENT_METHOD_LABELS = {
  stripe: 'כרטיס אשראי',
  cod: 'מזומן / העברה',
};

export const PAYMENT_STATUS_LABELS = {
  pending: 'ממתין לתשלום',
  paid: 'שולם',
  failed: 'נכשל',
};
