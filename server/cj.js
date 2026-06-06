import { translateProductFields } from './translate.js';
import { pickCjDescription } from './descriptionFormat.js';
import {
  calculateRetailPriceIls,
  extractShippingUsd,
  extractCostUsd,
  getDefaultFallbackRetailIls,
  DEFAULT_MARKUP_PERCENT,
} from './pricing.js';
import {
  isPlayableCjVideoUrl,
  normalizeCjVideoUrl,
  checkVideoIsLive,
  MIN_PRODUCT_VIDEOS,
} from './media.js';

/** מחלץ את כתובת ה-CJ האמיתית, גם אם נשמרה בפורמט proxy */
function resolveRealVideoUrl(v) {
  if (typeof v === 'string') return v;
  if (v?.originalUrl) return v.originalUrl;
  const url = v?.url || '';
  const m = url.match(/[?&]url=([^&]+)/);
  if (m) {
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return url;
    }
  }
  return url;
}

/** משאיר רק סרטונים שבאמת מגישים וידאו (200) – מסיר קישורים מתים/פגי תוקף */
async function filterLiveVideos(videos = []) {
  const live = [];
  for (const v of videos) {
    const real = resolveRealVideoUrl(v);
    if (!real || !isPlayableCjVideoUrl(real)) continue;
    if (await checkVideoIsLive(real)) {
      live.push(typeof v === 'string' ? { url: real } : { ...v, url: real });
    }
  }
  return live;
}

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

function extractMp4UrlsFromHtml(html) {
  const urls = [];
  if (!html || typeof html !== 'string') return urls;
  const re = /https?:\/\/[^\s"'<>]+\.(?:mp4|webm)(?:\?[^\s"'<>]*)?/gi;
  let m;
  while ((m = re.exec(html))) urls.push(m[0]);
  const dlRe = /https?:\/\/download-only-api\.cjdropshipping\.com\/[^\s"'<>]+/gi;
  while ((m = dlRe.exec(html))) urls.push(m[0]);
  return urls;
}

function mergeVideoEntries(...lists) {
  const seen = new Set();
  const out = [];
  for (const list of lists) {
    for (const v of list || []) {
      if (!v?.url || seen.has(v.url)) continue;
      seen.add(v.url);
      out.push(v);
    }
  }
  return out;
}

function videoEntry(url, poster = '') {
  const u = normalizeCjVideoUrl(url);
  if (!u || !isPlayableCjVideoUrl(u)) return null;
  return {
    url: u,
    poster: enhanceImageUrl(poster) || '',
  };
}

/** כתובות MP4 אמיתיות מ-CJ */
export async function fetchCjVideosByProductId(pid) {
  const data = await cjRequest('/product/queryVideosByProductId', {
    method: 'POST',
    body: JSON.stringify({ productId: String(pid) }),
  });
  const list = Array.isArray(data.data) ? data.data : [];
  return list
    .filter((v) => v.videoUrl && v.videoState !== 'DOWN_STATE' && v.videoState !== 'DELETE_STATE')
    .sort((a, b) => Number(a.videoType ?? 99) - Number(b.videoType ?? 99))
    .map((v) => videoEntry(v.videoUrl, v.coverURL || v.coverUrl || ''))
    .filter(Boolean);
}

async function collectAllProductVideos(p, pid) {
  const poster = p.productImage || p.bigImage || '';
  const desc = pickCjDescription(p);
  const parts = [];

  try {
    parts.push(await fetchCjVideosByProductId(pid));
  } catch (err) {
    console.warn(`CJ videos API ${pid}:`, err.message);
  }

  if (Array.isArray(p.productVideo)) {
    const fromField = p.productVideo
      .map((v) => videoEntry(v, poster))
      .filter(Boolean);
    parts.push(fromField);
  }

  parts.push(collectVideos(p));

  const fromHtml = extractMp4UrlsFromHtml(desc)
    .map((url) => videoEntry(url, poster))
    .filter(Boolean);
  parts.push(fromHtml);

  return mergeVideoEntries(...parts).slice(0, 10);
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
        if (v.startsWith('http')) add(v);
        else if (/\.(mp4|webm)/i.test(v)) add(`https://video-cf.cjdropshipping.com/${v}`);
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
  const price = extractCostUsd(item, item.variantList || item.variants || []);
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
  const videos = await collectAllProductVideos(p, pid);
  const videoUrl = videos[0]?.url || '';
  const costUsd = extractCostUsd(p, variants);
  const shippingUsd = extractShippingUsd(p, variants);
  const stock =
    variants.reduce((sum, v) => sum + (Number(v.inventory ?? v.stock) || 0), 0) || 99;

  const desc = pickCjDescription(p);

  return {
    pid: p.pid || p.productId || pid,
    sku: p.productSku || p.sku || `CJ-${pid}`,
    name: pickName(p),
    description: String(desc).slice(0, 12000),
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

let myProductPriceCache = null;

async function getMyProductUsdPrice(pid) {
  if (!myProductPriceCache) {
    const all = await getAllMyCjProducts();
    myProductPriceCache = new Map(all.map((item) => [String(item.pid), Number(item.price) || 0]));
  }
  return myProductPriceCache.get(String(pid)) || 0;
}

export function clearMyProductPriceCache() {
  myProductPriceCache = null;
}

/** מחיר ישן / שגוי במסד (כולל נוסחה ישנה עם משלוח כפול) */
export function isLikelyStaleCjPrice(price, markupPercent = DEFAULT_MARKUP_PERCENT) {
  const n = Number(price);
  if (!Number.isFinite(n) || n <= 0) return true;
  if (n < 8) return true;
  const fallback = getDefaultFallbackRetailIls(markupPercent);
  if (fallback != null && n === fallback) return true;
  return false;
}

async function resolveCostUsd(detail, cjPid) {
  let cost = Number(detail.costUsd ?? detail.price);
  if (Number.isFinite(cost) && cost > 0) return cost;
  const fromList = await getMyProductUsdPrice(cjPid);
  return fromList > 0 ? fromList : 0;
}

/** מעדכן מחירי מכירה בשקלים לכל המוצרים מ-CJ שכבר בחנות */
export async function recalculateAllCjPrices(markupPercent = DEFAULT_MARKUP_PERCENT, { onlyStale = false } = {}) {
  clearMyProductPriceCache();
  const { getAllProducts, updateProduct } = await import('./db.js');
  const products = await getAllProducts();
  let cjProducts = products.filter((p) => p.cjPid);
  if (onlyStale) {
    cjProducts = cjProducts.filter((p) => isLikelyStaleCjPrice(p.price));
  }
  const results = [];

  for (const p of cjProducts) {
    try {
      let costUsd = null;
      let shippingUsd;
      try {
        const detail = await getCjProductDetail(p.cjPid);
        costUsd = await resolveCostUsd(detail, p.cjPid);
        shippingUsd = detail.shippingUsd;
      } catch {
        /* CJ unavailable – fall back to stored cost below */
      }

      let usedStored = false;
      if (costUsd == null || !Number.isFinite(Number(costUsd)) || Number(costUsd) <= 0) {
        costUsd = p.costUsd;
        shippingUsd = p.shippingUsd;
        usedStored = true;
      }

      const retail = calculateRetailPriceIls(costUsd, { markupPercent, shippingUsd });
      if (retail == null) {
        results.push({ id: p.id, error: 'לא נמצא מחיר עלות (גם לא שמור)' });
        continue;
      }

      const update = { price: retail };
      if (!usedStored) {
        update.costUsd = costUsd;
        if (shippingUsd != null && Number.isFinite(Number(shippingUsd))) {
          update.shippingUsd = shippingUsd;
        }
      }
      await updateProduct(p.id, update);
      results.push({ id: p.id, name: p.name, price: retail, costUsd, fromStored: usedStored });
      if (!usedStored) await new Promise((r) => setTimeout(r, 300));
    } catch (err) {
      results.push({ id: p.id, error: err.message });
    }
  }
  return results;
}

export async function recalculateStaleCjPrices(markupPercent = DEFAULT_MARKUP_PERCENT) {
  return recalculateAllCjPrices(markupPercent, { onlyStale: true });
}

/**
 * חישוב מחיר מחדש מהעלות השמורה במסד – ללא פנייה ל-CJ.
 * מהיר, יציב, ורץ בכל הפעלת שרת כדי שהמחירים תמיד יתאימו לנוסחה.
 */
export async function recalcPricesFromStoredCost(markupPercent = DEFAULT_MARKUP_PERCENT) {
  const { getAllProducts, updateProduct } = await import('./db.js');
  const products = await getAllProducts();
  const results = [];
  for (const p of products) {
    if (p.costUsd == null || !Number.isFinite(Number(p.costUsd)) || Number(p.costUsd) <= 0) {
      continue;
    }
    const retail = calculateRetailPriceIls(p.costUsd, {
      markupPercent,
      shippingUsd: p.shippingUsd,
    });
    if (retail == null || retail === p.price) continue;
    await updateProduct(p.id, { price: retail });
    results.push({ id: p.id, name: p.name, price: retail });
  }
  return results;
}

function getStoredVideoUrls(product) {
  return [
    product.videoUrl,
    ...(product.videos || []).map((v) => (typeof v === 'string' ? v : v?.url)),
  ].filter(Boolean);
}

function needsVideoRefresh(product) {
  const urls = getStoredVideoUrls(product);
  const playable = urls
    .map((u) => normalizeCjVideoUrl(u))
    .filter((u) => u && isPlayableCjVideoUrl(u));
  const unique = [...new Set(playable)];
  if (unique.length < MIN_PRODUCT_VIDEOS) return true;
  if (unique.length !== urls.length) return true;
  return urls.some(
    (u) => u.includes('video-cf.cjdropshipping.com') && !/\.(mp4|webm)/i.test(u)
  );
}

/** מעדכן סרטונים – מתקן שבורים ומושך עד 3+ מ-CJ */
export async function refreshStaleCjVideos({ forceAll = false } = {}) {
  const { getAllProducts, updateProduct } = await import('./db.js');
  const products = (await getAllProducts()).filter((p) => p.cjPid);
  const results = [];

  for (const p of products) {
    if (!forceAll && !needsVideoRefresh(p)) continue;
    try {
      const detail = await getCjProductDetail(p.cjPid);
      const candidates = (detail.videos || []).filter((v) => isPlayableCjVideoUrl(v.url));
      const videos = await filterLiveVideos(candidates);
      if (!videos.length) {
        await updateProduct(p.id, { videoUrl: '', videos: [] });
        results.push({ id: p.id, status: 'no-videos' });
        continue;
      }
      await updateProduct(p.id, {
        videoUrl: videos[0]?.url || '',
        videos,
      });
      results.push({ id: p.id, status: 'ok', count: videos.length });
      await new Promise((r) => setTimeout(r, 400));
    } catch (err) {
      results.push({ id: p.id, status: 'error', error: err.message });
    }
  }
  return results;
}

/** עובר על כל המוצרים, בודק את הסרטונים השמורים ומסיר קישורים מתים (בלי קריאה ל-CJ) */
export async function cleanDeadCjVideos() {
  const { getAllProducts, updateProduct } = await import('./db.js');
  const products = await getAllProducts();
  const results = [];

  for (const p of products) {
    const stored = (p.videos || [])
      .map((v) => (typeof v === 'string' ? { url: v } : v))
      .filter((v) => v?.url);
    if (!stored.length && !p.videoUrl) continue;

    const live = await filterLiveVideos(stored);
    if (live.length !== stored.length) {
      await updateProduct(p.id, {
        videoUrl: live[0]?.url || '',
        videos: live,
      });
      results.push({ id: p.id, removed: stored.length - live.length, kept: live.length });
    }
  }
  return results;
}

export async function refreshAllCjVideos() {
  return refreshStaleCjVideos({ forceAll: true });
}

/** בודק חיות של הסרטונים השמורים; מוצרים עם סרטון מת/חסר → מושך טרי מ-CJ */
export async function revalidateAndRefreshVideos() {
  const { getAllProducts, getProductById, updateProduct } = await import('./db.js');
  const products = (await getAllProducts()).filter((p) => p.cjPid);
  const results = [];

  for (const p of products) {
    const stored = (p.videos || [])
      .map((v) => (typeof v === 'string' ? { url: v } : v))
      .filter((v) => v?.url);
    const live = await filterLiveVideos(stored);

    if (live.length >= MIN_PRODUCT_VIDEOS && live.length === stored.length) {
      continue;
    }

    try {
      const detail = await getCjProductDetail(p.cjPid);
      const candidates = (detail.videos || []).filter((v) => isPlayableCjVideoUrl(v.url));
      const fresh = await filterLiveVideos(candidates);
      const finalVideos = fresh.length ? fresh : live;
      await updateProduct(p.id, {
        videoUrl: finalVideos[0]?.url || '',
        videos: finalVideos,
      });
      results.push({ id: p.id, status: 'ok', count: finalVideos.length });
      await new Promise((r) => setTimeout(r, 400));
    } catch (err) {
      if (live.length !== stored.length) {
        await updateProduct(p.id, { videoUrl: live[0]?.url || '', videos: live });
      }
      results.push({ id: p.id, status: 'error', error: err.message });
    }
  }
  return results;
}

/** מושך כתובות סרטון טריות מ-CJ למוצר יחיד, מאמת ושומר. מחזיר את הסרטונים החיים */
export async function refreshProductVideos(productId) {
  const { getProductById, updateProduct } = await import('./db.js');
  const product = await getProductById(productId);
  if (!product?.cjPid) return null;

  const detail = await getCjProductDetail(product.cjPid);
  const candidates = (detail.videos || []).filter((v) => isPlayableCjVideoUrl(v.url));
  const videos = await filterLiveVideos(candidates);
  await updateProduct(product.id, {
    videoUrl: videos[0]?.url || '',
    videos,
  });
  return videos;
}

export async function importCjProducts(
  pids,
  { markupPercent = DEFAULT_MARKUP_PERCENT, categoryId = 'electronics', translateToHebrew = true } = {}
) {
  const doTranslate = translateToHebrew !== false;
  clearMyProductPriceCache();
  const imported = [];
  const skipped = [];

  const markup = Number(markupPercent);
  const validMarkup = Number.isFinite(markup) ? markup : DEFAULT_MARKUP_PERCENT;

  for (const pid of pids) {
    if (!pid) continue;
    try {
      const detail = await getCjProductDetail(pid);
      let name = detail.name;
      let description = detail.description;
      if (doTranslate) {
        try {
          const translated = await translateProductFields({ name, description });
          name = translated.name;
          description = translated.description;
        } catch (err) {
          console.warn(`CJ translate ${pid}:`, err.message);
        }
      }
      const costUsd = await resolveCostUsd(detail, pid);
      const retail = calculateRetailPriceIls(costUsd, {
        markupPercent: validMarkup,
        shippingUsd: detail.shippingUsd,
      });
      if (retail == null) {
        skipped.push({ pid, error: 'לא נמצא מחיר עלות ב-CJ' });
        continue;
      }
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
  markupPercent = DEFAULT_MARKUP_PERCENT,
  categoryId = 'electronics',
  translateToHebrew = true,
} = {}) {
  clearMyProductPriceCache();
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
