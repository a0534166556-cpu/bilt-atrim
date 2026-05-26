const CJ_BASE = 'https://developers.cjdropshipping.com/api2.0/v1';

/** CJ_ACCESS_TOKEN = API Key (CJxxx@api@...) – מומר אוטומטית ל-access token */
const tokenCache = {
  accessToken: null,
  refreshToken: null,
  accessExpiry: 0,
  refreshExpiry: 0,
};

export function isCjConfigured() {
  return Boolean(process.env.CJ_ACCESS_TOKEN?.trim());
}

function getApiKey() {
  const key = process.env.CJ_ACCESS_TOKEN?.trim();
  if (!key) throw new Error('CJ_ACCESS_TOKEN לא מוגדר ב-Railway');
  return key;
}

function isApiKey(value) {
  return value.includes('@api@');
}

async function fetchAccessToken(apiKey) {
  const res = await fetch(`${CJ_BASE}/authentication/getAccessToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey }),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.result && data.code !== 200) {
    throw new Error(data.message || 'שגיאה באימות CJ – בדוק את מפתח ה-API');
  }
  const d = data.data || {};
  tokenCache.accessToken = d.accessToken;
  tokenCache.refreshToken = d.refreshToken;
  tokenCache.accessExpiry = d.accessTokenExpiryDate
    ? new Date(d.accessTokenExpiryDate).getTime()
    : Date.now() + 14 * 24 * 60 * 60 * 1000;
  tokenCache.refreshExpiry = d.refreshTokenExpiryDate
    ? new Date(d.refreshTokenExpiryDate).getTime()
    : Date.now() + 179 * 24 * 60 * 60 * 1000;
  return d.accessToken;
}

async function refreshAccessToken(refreshToken) {
  const res = await fetch(`${CJ_BASE}/authentication/refreshAccessToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.result && data.code !== 200) {
    throw new Error(data.message || 'שגיאה ברענון טוקן CJ');
  }
  const d = data.data || {};
  tokenCache.accessToken = d.accessToken;
  tokenCache.refreshToken = d.refreshToken || refreshToken;
  tokenCache.accessExpiry = d.accessTokenExpiryDate
    ? new Date(d.accessTokenExpiryDate).getTime()
    : Date.now() + 14 * 24 * 60 * 60 * 1000;
  tokenCache.refreshExpiry = d.refreshTokenExpiryDate
    ? new Date(d.refreshTokenExpiryDate).getTime()
    : tokenCache.refreshExpiry;
  return d.accessToken;
}

async function ensureAccessToken() {
  const credential = getApiKey();
  const now = Date.now();
  const buffer = 5 * 60 * 1000;

  if (tokenCache.accessToken && tokenCache.accessExpiry > now + buffer) {
    return tokenCache.accessToken;
  }

  if (!isApiKey(credential)) {
    return credential;
  }

  if (tokenCache.refreshToken && tokenCache.refreshExpiry > now + buffer) {
    try {
      return await refreshAccessToken(tokenCache.refreshToken);
    } catch {
      tokenCache.refreshToken = null;
    }
  }

  return fetchAccessToken(credential);
}

function clearTokenCache() {
  tokenCache.accessToken = null;
  tokenCache.refreshToken = null;
  tokenCache.accessExpiry = 0;
  tokenCache.refreshExpiry = 0;
}

async function cjRequest(path, options = {}, retried = false) {
  const token = await ensureAccessToken();

  const res = await fetch(`${CJ_BASE}${path}`, {
    ...options,
    headers: {
      'CJ-Access-Token': token,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  const authFailed =
    data.message?.toLowerCase().includes('invalid api key') ||
    data.message?.toLowerCase().includes('access token') ||
    data.code === 1600001;

  if (authFailed && !retried && isApiKey(getApiKey())) {
    clearTokenCache();
    return cjRequest(path, options, true);
  }

  if (!data.result && data.code !== 200) {
    throw new Error(data.message || 'שגיאה מ-CJ Dropshipping');
  }
  return data;
}
function pickName(item) {
  const raw = item.productNameEn || item.productName || item.nameEn || item.name || 'מוצר CJ';
  return String(raw).replace(/^\[.*?\]\s*/, '').slice(0, 200);
}

function collectImages(p) {
  const urls = new Set();
  const add = (u) => {
    if (u && typeof u === 'string' && /^https?:\/\//i.test(u)) urls.add(u);
  };
  add(p.productImage);
  add(p.bigImage);
  if (Array.isArray(p.productImageSet)) p.productImageSet.forEach(add);
  if (Array.isArray(p.images)) {
    p.images.forEach((i) => add(typeof i === 'string' ? i : i?.url || i?.image));
  }
  if (Array.isArray(p.productImages)) p.productImages.forEach(add);
  if (p.imageList) {
    const list = typeof p.imageList === 'string' ? p.imageList.split(',') : p.imageList;
    if (Array.isArray(list)) list.forEach(add);
  }
  (p.variantList || p.variants || []).forEach((v) => {
    add(v.variantImage || v.image || v.imageUrl);
  });
  return [...urls].slice(0, 12);
}

function collectVideo(p) {
  if (p.videoUrl && /^https?:\/\//i.test(p.videoUrl)) return p.videoUrl;
  const videos = p.productVideos || p.videos || [];
  if (Array.isArray(videos) && videos.length) {
    const v = videos[0];
    const url = typeof v === 'string' ? v : v.videoUrl || v.url || v.src;
    if (url && /^https?:\/\//i.test(url)) return url;
  }
  return '';
}

function mapListItem(item) {
  const images = collectImages(item);
  const price = Number(item.sellPrice ?? item.price ?? item.salePrice ?? 0);
  return {
    pid: item.pid || item.productId || item.id,
    sku: item.productSku || item.sku || '',
    name: pickName(item),
    image: images[0] || item.productImage || '',
    images,
    videoUrl: collectVideo(item),
    price,
    categoryName: item.categoryName || item.threeCategoryName || '',
  };
}

export async function searchCjProducts(keyword = '', page = 1, size = 20) {
  const params = new URLSearchParams({
    page: String(page),
    size: String(Math.min(size, 50)),
  });
  if (keyword.trim()) params.set('keyWord', keyword.trim());

  const data = await cjRequest(`/product/listV2?${params}`);
  const list = data.data?.list || data.data?.content || data.data || [];
  const items = (Array.isArray(list) ? list : []).map(mapListItem).filter((p) => p.pid);

  return {
    list: items,
    total: data.data?.total ?? data.data?.totalRecords ?? items.length,
    page,
  };
}

/** מוצרים שלחצת עליהם "Added" ב-CJ */
export async function getMyCjProducts(page = 1, size = 50) {
  const params = new URLSearchParams({
    pageNum: String(page),
    pageSize: String(Math.min(size, 100)),
  });
  const data = await cjRequest(`/product/myProduct/query?${params}`);
  const list = Array.isArray(data.data)
    ? data.data
    : data.data?.list || data.data?.content || [];
  const items = list.map(mapListItem).filter((p) => p.pid);
  return {
    list: items,
    total: data.data?.total ?? items.length,
    page,
  };
}

export async function getAllMyCjProducts() {
  const all = [];
  let page = 1;
  for (;;) {
    const batch = await getMyCjProducts(page, 50);
    all.push(...batch.list);
    if (batch.list.length < 50) break;
    page += 1;
    if (page > 20) break;
  }
  return all;
}

export async function getCjProductDetail(pid) {
  const params = new URLSearchParams({
    pid,
    features: 'enable_video',
  });
  const data = await cjRequest(`/product/query?${params}`);
  const p = data.data || {};
  const variants = p.variantList || p.variants || [];
  const images = collectImages(p);
  const videoUrl = collectVideo(p);
  const sellPrices = variants
    .map((v) => Number(v.sellPrice ?? v.price))
    .filter((n) => n > 0);
  const sellPrice =
    sellPrices.length > 0
      ? Math.min(...sellPrices)
      : Number(p.sellPrice ?? p.productSellPrice ?? 0);
  const stock =
    variants.reduce((sum, v) => sum + (Number(v.inventory ?? v.stock) || 0), 0) || 99;

  const desc =
    p.descriptionEn ||
    p.description ||
    p.productDescription ||
    p.productNameEn ||
  '';

  return {
    pid: p.pid || p.productId || pid,
    sku: p.productSku || p.sku || `CJ-${pid}`,
    name: pickName(p),
    description: String(desc).slice(0, 8000),
    image: images[0] || '',
    images,
    videoUrl,
    price: sellPrice,
    stock: stock || 99,
    categoryName: p.categoryName || '',
  };
}

export async function importCjProducts(pids, { markupPercent = 30, categoryId = 'electronics' } = {}) {
  const imported = [];
  const skipped = [];

  const markup = Number(markupPercent);
  const validMarkup = Number.isFinite(markup) ? markup : 30;

  for (const pid of pids) {
    if (!pid) continue;
    try {
      const detail = await getCjProductDetail(pid);
      const cost = Number(detail.price);
      const validCost = Number.isFinite(cost) && cost > 0 ? cost : 1;
      const retail = Math.max(1, Math.ceil(validCost * (1 + validMarkup / 100)));
      imported.push({
        ...detail,
        cost,
        retail,
        categoryId,
      });
    } catch (err) {
      skipped.push({ pid, error: err.message });
    }
  }

  return { imported, skipped };
}

export async function syncMyCjProductsToStore({ markupPercent = 30, categoryId = 'electronics' } = {}) {
  const myProducts = await getAllMyCjProducts();
  if (!myProducts.length) {
    return { myProducts: [], imported: [], skipped: [], message: 'אין מוצרים ב-CJ – לחץ Added על מוצרים ב-CJ קודם' };
  }
  const pids = myProducts.map((p) => p.pid);
  const { imported, skipped } = await importCjProducts(pids, { markupPercent, categoryId });
  return { myProducts, imported, skipped };
}
