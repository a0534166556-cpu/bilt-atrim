import { translateProductFields } from './translate.js';
import { calculateRetailPriceIls, extractShippingUsd } from './pricing.js';

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

function enhanceImageUrl(url) {
  if (!url || typeof url !== 'string') return '';
  let u = url.trim();
  if (u.startsWith('//')) u = `https:${u}`;
  if (!/^https?:\/\//i.test(u)) return '';
  return u
    .replace(/_\d+x\d+(?=\.\w+$)/i, '')
    .replace(/-(\d+)x(\d+)(?=\.\w+$)/i, '')
    .replace(/\/thumbnail\//i, '/')
    .replace(/\?x-oss-process=[^&]+/gi, '');
}

function extractUrlsFromHtml(html) {
  const urls = [];
  if (!html || typeof html !== 'string') return urls;
  const imgRe = /<img[^>]+src=["']([^"']+)["']/gi;
  const videoRe = /<video[^>]+src=["']([^"']+)["']/gi;
  const sourceRe = /<source[^>]+src=["']([^"']+)["']/gi;
  let m;
  while ((m = imgRe.exec(html))) urls.push({ type: 'image', url: m[1] });
  while ((m = videoRe.exec(html))) urls.push({ type: 'video', url: m[1] });
  while ((m = sourceRe.exec(html))) urls.push({ type: 'video', url: m[1] });
  return urls;
}

function collectImages(p) {
  const urls = [];
  const seen = new Set();
  const add = (u) => {
    const enhanced = enhanceImageUrl(u);
    if (enhanced && !seen.has(enhanced)) {
      seen.add(enhanced);
      urls.push(enhanced);
    }
  };
  add(p.bigImage);
  add(p.productImage);
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
  const desc = p.descriptionEn || p.description || p.productDescription || '';
  extractUrlsFromHtml(desc).forEach((item) => {
    if (item.type === 'image') add(item.url);
  });
  return urls.slice(0, 24);
}

function videoEntry(url, poster = '') {
  const u = String(url).trim();
  if (!/^https?:\/\//i.test(u)) return null;
  return {
    url: u,
    poster: enhanceImageUrl(poster) || '',
  };
}

function collectVideos(p) {
  const list = [];
  const seen = new Set();
  const add = (url, poster) => {
    const entry = videoEntry(url, poster || p.productImage || p.bigImage);
    if (entry && !seen.has(entry.url)) {
      seen.add(entry.url);
      list.push(entry);
    }
  };

  if (p.videoUrl) add(p.videoUrl);

  const arrays = [
    p.productVideo,
    p.productVideos,
    p.videos,
    p.videoList,
  ];
  for (const arr of arrays) {
    if (!Array.isArray(arr)) continue;
    for (const v of arr) {
      if (typeof v === 'string') {
        if (v.includes('.mp4') || v.includes('video')) add(v);
        else add(`https://video-cf.cjdropshipping.com/${v}`, p.productImage);
      } else if (v) {
        add(v.videoUrl || v.url || v.src, v.cover || v.poster || v.thumbnail || v.image);
      }
    }
  }

  const desc = p.descriptionEn || p.description || p.productDescription || '';
  extractUrlsFromHtml(desc).forEach((item) => {
    if (item.type === 'video') add(item.url);
  });

  return list.slice(0, 10);
}

function collectVideo(p) {
  const videos = collectVideos(p);
  return videos[0]?.url || '';
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
    videos: collectVideos(item),
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
  const params = new URLSearchParams({ pid });
  params.append('features', 'enable_video');
  params.append('features', 'enable_description');
  const data = await cjRequest(`/product/query?${params}`);
  const p = data.data || {};
  const variants = p.variantList || p.variants || [];
  const images = collectImages(p);
  const videos = collectVideos(p);
  const videoUrl = videos[0]?.url || '';
  const sellPrices = variants
    .map((v) => Number(v.sellPrice ?? v.price))
    .filter((n) => n > 0);
  const costUsd =
    sellPrices.length > 0
      ? Math.min(...sellPrices)
      : Number(p.sellPrice ?? p.productSellPrice ?? p.productPrice ?? 0);
  const shippingUsd = extractShippingUsd(p, variants);
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
    videos,
    videoUrl,
    price: costUsd,
    costUsd,
    shippingUsd,
    stock: stock || 99,
    categoryName: p.categoryName || '',
  };
}

/** מעדכן מחירי מכירה בשקלים לכל המוצרים מ-CJ שכבר בחנות */
export async function recalculateAllCjPrices(markupPercent = 30) {
  const { getAllProducts, updateProduct } = await import('./db.js');
  const products = await getAllProducts();
  const cjProducts = products.filter((p) => p.cjPid);
  const results = [];

  for (const p of cjProducts) {
    try {
      const detail = await getCjProductDetail(p.cjPid);
      const retail = calculateRetailPriceIls(detail.costUsd ?? detail.price, {
        markupPercent,
        shippingUsd: detail.shippingUsd,
      });
      await updateProduct(p.id, { price: retail });
      results.push({ id: p.id, name: p.name, price: retail, costUsd: detail.costUsd });
      await new Promise((r) => setTimeout(r, 300));
    } catch (err) {
      results.push({ id: p.id, error: err.message });
    }
  }
  return results;
}

export async function importCjProducts(
  pids,
  { markupPercent = 30, categoryId = 'electronics', translateToHebrew = true } = {}
) {
  const imported = [];
  const skipped = [];

  const markup = Number(markupPercent);
  const validMarkup = Number.isFinite(markup) ? markup : 30;

  for (const pid of pids) {
    if (!pid) continue;
    try {
      const detail = await getCjProductDetail(pid);
      let name = detail.name;
      let description = detail.description;
      if (translateToHebrew) {
        try {
          const translated = await translateProductFields({ name, description });
          name = translated.name;
          description = translated.description;
        } catch (err) {
          console.warn(`CJ translate ${pid}:`, err.message);
        }
      }
      const costUsd = Number(detail.costUsd ?? detail.price);
      const retail = calculateRetailPriceIls(costUsd, {
        markupPercent: validMarkup,
        shippingUsd: detail.shippingUsd,
      });
      imported.push({
        ...detail,
        name,
        description,
        cost: costUsd,
        retail,
        categoryId,
      });
    } catch (err) {
      skipped.push({ pid, error: err.message });
    }
  }

  return { imported, skipped };
}

export async function syncMyCjProductsToStore({
  markupPercent = 30,
  categoryId = 'electronics',
  translateToHebrew = true,
} = {}) {
  const myProducts = await getAllMyCjProducts();
  if (!myProducts.length) {
    return { myProducts: [], imported: [], skipped: [], message: 'אין מוצרים ב-CJ – לחץ Added על מוצרים ב-CJ קודם' };
  }
  const pids = myProducts.map((p) => p.pid);
  const { imported, skipped } = await importCjProducts(pids, {
    markupPercent,
    categoryId,
    translateToHebrew,
  });
  return { myProducts, imported, skipped };
}
